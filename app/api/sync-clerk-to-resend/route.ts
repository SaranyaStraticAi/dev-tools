// app/api/sync-clerk-to-resend/route.ts
// POST → Fetch ALL Clerk Live users and upsert them into Resend.
//         ALL contacts (new AND already-existing) are added to the segment.
//
// Body: { segmentId?: string }
// Returns: { total, created, alreadyExisted, addedToSegment, errors }

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const CLERK_PAGE_SIZE = 500;
// We throttle to 4 requests per second to stay under Resend's 5 reqs/sec free-tier limit,
// leaving headroom for other app requests (like listing segments) not to hit 429.
const BATCH_SIZE = 4; 
const DELAY_BETWEEN_BATCHES_MS = 1000;

// Helper to wrap Resend calls with retry logic for 429 (Too Many Requests)
async function callResendWithRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 1500): Promise<T> {
    try {
        const res = await fn();
        const err = (res as any)?.error;
        if (err && (err.statusCode === 429 || err.status === 429 || String(err.message).toLowerCase().includes('rate limit') || String(err.message).toLowerCase().includes('too many requests'))) {
            if (retries > 0) {
                console.warn(`[sync-clerk-to-resend] ⚠️ 429 rate limit hit. Retrying in ${delayMs}ms... (Retries left: ${retries})`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return callResendWithRetry(fn, retries - 1, delayMs * 2);
            }
        }
        return res;
    } catch (e: any) {
        const is429 = e.statusCode === 429 || e.status === 429 || String(e.message).toLowerCase().includes('rate limit') || String(e.message).toLowerCase().includes('too many requests');
        if (is429 && retries > 0) {
            console.warn(`[sync-clerk-to-resend] ⚠️ 429 rate limit hit (thrown). Retrying in ${delayMs}ms... (Retries left: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return callResendWithRetry(fn, retries - 1, delayMs * 2);
        }
        throw e;
    }
}

// Helper to run promises in chunks with a rate-limit delay
async function runBatches<T, R>(
    items: T[],
    batchSize: number,
    delayMs: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
        
        // Wait between batches to respect rate limits
        if (i + batchSize < items.length && delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    return results;
}

// ── Fetch ALL users from Clerk Live instance (paginated) ──────────────────────
async function fetchAllClerkUsers() {
    const secretKey = process.env.CLERK_LIVE_SECRET_KEY;
    if (!secretKey) throw new Error('CLERK_LIVE_SECRET_KEY is not set');

    const client = createClerkClient({ secretKey });
    const users: Array<{ email: string; firstName: string; lastName: string }> = [];
    let offset = 0;

    while (true) {
        const list = await client.users.getUserList({ limit: CLERK_PAGE_SIZE, offset });
        if (!list.data || list.data.length === 0) break;

        for (const u of list.data) {
            const primaryEmail = u.emailAddresses?.find(e => e.id === u.primaryEmailAddressId);
            const email = primaryEmail?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress;
            if (email) {
                users.push({
                    email:     email.toLowerCase().trim(),
                    firstName: u.firstName ?? '',
                    lastName:  u.lastName  ?? '',
                });
            }
        }

        if (list.data.length < CLERK_PAGE_SIZE) break;
        offset += CLERK_PAGE_SIZE;
    }

    return users;
}

// ── Fetch ALL existing Resend contacts → build email → contactId map ──────────
async function fetchAllResendContacts(): Promise<Map<string, string>> {
    const emailToId = new Map<string, string>();
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    if (!audienceId) {
        console.warn('[sync-clerk-to-resend] RESEND_AUDIENCE_ID is not set in env');
        return emailToId;
    }

    try {
        let after: string | undefined = undefined;
        while (true) {
            const result = await callResendWithRetry(() => resend.contacts.list({
                audienceId,
                limit: 100,
                ...(after ? { after } : {}),
            }));
            const contacts: any[] = (result.data as any)?.data ?? result.data ?? [];

            if (!Array.isArray(contacts) || contacts.length === 0) break;

            for (const c of contacts) {
                if (c.email && c.id) {
                    emailToId.set(c.email.toLowerCase().trim(), c.id);
                }
            }

            if (contacts.length < 100) break;
            const lastContact = contacts[contacts.length - 1];
            if (!lastContact?.id) break;
            after = lastContact.id;
        }

        console.log(`[sync-clerk-to-resend] Found ${emailToId.size} existing Resend contacts`);
    } catch (e: any) {
        console.warn('[sync-clerk-to-resend] Could not fetch existing contacts:', e.message);
    }

    return emailToId;
}

// ── Add a contact to a segment via Resend REST API ────────────────────────────
async function addContactToSegment(contactId: string, segmentId: string): Promise<boolean> {
    try {
        // Try SDK first
        const addRes = await (resend.contacts as any).segments?.add?.({
            contactId,
            segmentId,
        });
        if (addRes && !addRes.error) return true;
        if (addRes?.error) {
            const err = addRes.error;
            if (err.statusCode === 429 || err.status === 429 || String(err.message).toLowerCase().includes('rate limit') || String(err.message).toLowerCase().includes('too many requests')) {
                throw err; // throw to trigger retry in callResendWithRetry
            }
        }

        // Fallback: direct REST call
        const resp = await fetch(`https://api.resend.com/contacts/${contactId}/segments/${segmentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        if (resp.status === 429) {
            throw new Error('429 rate limit exceeded');
        }
        return resp.ok;
    } catch (e) {
        if (e instanceof Error && (String(e.message).toLowerCase().includes('rate limit') || String(e.message).toLowerCase().includes('429'))) {
            throw e;
        }
        return false;
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({})) as {
            segmentId?: string;
        };

        const audienceId = process.env.RESEND_AUDIENCE_ID;
        if (!audienceId) {
            return NextResponse.json({ error: 'RESEND_AUDIENCE_ID is not set' }, { status: 500 });
        }

        // ── Step 1: Fetch all Clerk Live users ────────────────────────────────
        console.log('[sync-clerk-to-resend] Fetching all Clerk Live users...');
        const clerkUsers = await fetchAllClerkUsers();
        console.log(`[sync-clerk-to-resend] Found ${clerkUsers.length} Clerk Live users`);

        // Deduplicate by email
        const seen = new Set<string>();
        const allUsers = clerkUsers.filter(u => {
            if (seen.has(u.email)) return false;
            seen.add(u.email);
            return true;
        });

        // ── Step 2: Fetch existing Resend contacts to get their IDs ───────────
        const existingContacts = await fetchAllResendContacts();

        // ── Step 3: Upsert each Clerk user into Resend (Batched in parallel) ──
        let created    = 0;
        let alreadyExisted = 0;
        const errors: string[] = [];

        // contactIds = ALL IDs that should be in the segment (new + existing)
        const contactIds: string[] = [];

        console.log(`[sync-clerk-to-resend] Processing ${allUsers.length} users...`);

        await runBatches(allUsers, BATCH_SIZE, DELAY_BETWEEN_BATCHES_MS, async (user) => {
            const existingId = existingContacts.get(user.email);

            if (existingId) {
                contactIds.push(existingId);
                alreadyExisted++;
                return;
            }

            try {
                const result = await callResendWithRetry(() => resend.contacts.create({
                    email:        user.email,
                    firstName:    user.firstName,
                    lastName:     user.lastName,
                    unsubscribed: false,
                    audienceId,
                }));

                if (result.error) {
                    if (result.error.message?.toLowerCase().includes('already exists')) {
                        alreadyExisted++;
                    } else {
                        errors.push(`${user.email}: ${result.error.message}`);
                    }
                } else if (result.data?.id) {
                    contactIds.push(result.data.id);
                    created++;
                }
            } catch (e: any) {
                errors.push(`${user.email}: ${e.message}`);
            }
        });

        console.log(`[sync-clerk-to-resend] Created: ${created} new, already existed: ${alreadyExisted}, errors: ${errors.length}`);

        // ── Step 4: Add ALL contact IDs to the segment (Batched in parallel) ──
        let addedToSegment  = 0;
        const segmentErrors: string[] = [];

        const targetSegmentId = body.segmentId;
        if (targetSegmentId && contactIds.length > 0) {
            console.log(`[sync-clerk-to-resend] Adding ${contactIds.length} contacts to segment ${targetSegmentId}...`);

            await runBatches(contactIds, BATCH_SIZE, DELAY_BETWEEN_BATCHES_MS, async (contactId) => {
                try {
                    const ok = await callResendWithRetry(() => addContactToSegment(contactId, targetSegmentId));
                    if (ok) {
                        addedToSegment++;
                    } else {
                        segmentErrors.push(contactId);
                    }
                } catch (e) {
                    segmentErrors.push(contactId);
                }
            });

            console.log(`[sync-clerk-to-resend] Added to segment: ${addedToSegment}, failed: ${segmentErrors.length}`);
        }

        return NextResponse.json({
            ok:             true,
            total:          allUsers.length,
            created,
            alreadyExisted,
            addedToSegment,
            errors:         errors.slice(0, 20),
            segmentErrors:  segmentErrors.slice(0, 10),
        });

    } catch (err: any) {
        console.error('[sync-clerk-to-resend] unexpected error:', err);
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}
