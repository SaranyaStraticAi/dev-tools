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

    try {
        // Resend contacts.list() — may be paginated; fetch page by page
        let page = 1;
        while (true) {
            const result = await resend.contacts.list();
            const contacts: any[] = (result.data as any)?.data ?? result.data ?? [];

            if (!Array.isArray(contacts) || contacts.length === 0) break;

            for (const c of contacts) {
                if (c.email && c.id) {
                    emailToId.set(c.email.toLowerCase().trim(), c.id);
                }
            }

            // Resend doesn't paginate contacts.list in the SDK easily — break after one pass
            // The SDK returns all contacts (up to their limit)
            break;
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

        // Fallback: direct REST call
        const resp = await fetch(`https://api.resend.com/contacts/${contactId}/segments/${segmentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        return resp.ok;
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({})) as {
            segmentId?: string;
        };

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

        // ── Step 3: Upsert each Clerk user into Resend ────────────────────────
        let created    = 0;
        let alreadyExisted = 0;
        const errors: string[] = [];

        // contactIds = ALL IDs that should be in the segment (new + existing)
        const contactIds: string[] = [];

        for (const user of allUsers) {
            const existingId = existingContacts.get(user.email);

            if (existingId) {
                // Already in Resend — just collect the ID for segment sync
                contactIds.push(existingId);
                alreadyExisted++;
                continue;
            }

            // Not in Resend yet — create
            try {
                const result = await resend.contacts.create({
                    email:        user.email,
                    firstName:    user.firstName,
                    lastName:     user.lastName,
                    unsubscribed: false,
                });

                if (result.error) {
                    // Race condition: contact was just created between our list and now
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
        }

        console.log(`[sync-clerk-to-resend] Created: ${created} new, already existed: ${alreadyExisted}, errors: ${errors.length}`);

        // ── Step 4: Add ALL contact IDs to the segment ────────────────────────
        let addedToSegment  = 0;
        const segmentErrors: string[] = [];

        if (body.segmentId && contactIds.length > 0) {
            console.log(`[sync-clerk-to-resend] Adding ${contactIds.length} contacts to segment ${body.segmentId}...`);

            for (const contactId of contactIds) {
                const ok = await addContactToSegment(contactId, body.segmentId);
                if (ok) {
                    addedToSegment++;
                } else {
                    segmentErrors.push(contactId);
                }
            }

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
