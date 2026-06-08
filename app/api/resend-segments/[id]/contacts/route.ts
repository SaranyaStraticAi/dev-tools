// app/api/resend-segments/[id]/contacts/route.ts
// POST   → add an existing contact to this segment
// DELETE → remove a contact (or all contacts) from this segment

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const BATCH_SIZE = 4;
const DELAY_BETWEEN_BATCHES_MS = 1000;

// Helper to wrap Resend calls with retry logic for 429
async function callResendWithRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 1500): Promise<T> {
    try {
        const res = await fn();
        const err = (res as any)?.error;
        if (err && (err.statusCode === 429 || err.status === 429 || String(err.message).toLowerCase().includes('rate limit') || String(err.message).toLowerCase().includes('too many requests'))) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return callResendWithRetry(fn, retries - 1, delayMs * 2);
            }
        }
        return res;
    } catch (e: any) {
        const is429 = e.statusCode === 429 || e.status === 429 || String(e.message).toLowerCase().includes('rate limit') || String(e.message).toLowerCase().includes('too many requests');
        if (is429 && retries > 0) {
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
        if (i + batchSize < items.length && delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    return results;
}

// ── POST — add contact to segment ─────────────────────────────────────────────
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: segmentId } = await params;
        const body = await req.json() as { contactId: string };

        if (!body.contactId) {
            return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
        }

        // Using SDK as per docs: resend.contacts.segments.add
        const result = await callResendWithRetry<any>(() => (resend.contacts as any).segments.add({
            contactId: body.contactId,
            segmentId,
        }));

        if (result?.error) {
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}

// ── DELETE — remove contact from segment ─────────────────────────────────────
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: segmentId } = await params;
        const body = await req.json() as {
            contactId?: string;
            removeAll?: boolean;
            deletePermanently?: boolean;
        };

        if (body.removeAll) {
            // Fetch all contacts in this segment
            const fetchRes = await fetch(`https://api.resend.com/segments/${segmentId}/contacts`, {
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                }
            });
            const data = await fetchRes.json();
            if (!fetchRes.ok) {
                return NextResponse.json({ error: data.message ?? 'Failed to retrieve segment contacts' }, { status: fetchRes.status });
            }

            const contacts: any[] = data.data ?? [];
            if (contacts.length === 0) {
                return NextResponse.json({ ok: true, succeeded: 0, failed: 0 });
            }

            let succeeded = 0;
            let failed = 0;

            console.log(`[bulk-delete-segment] Processing ${contacts.length} contacts (deletePermanently: ${body.deletePermanently})...`);

            await runBatches(contacts, BATCH_SIZE, DELAY_BETWEEN_BATCHES_MS, async (contact) => {
                try {
                    if (body.deletePermanently) {
                        const result = await callResendWithRetry<any>(() => resend.contacts.remove({ id: contact.id }));
                        if (result?.error) {
                            console.warn(`Failed to delete contact ${contact.id}:`, result.error.message);
                            failed++;
                        } else {
                            succeeded++;
                        }
                    } else {
                        const result = await callResendWithRetry<any>(() => (resend.contacts as any).segments.remove({
                            contactId: contact.id,
                            segmentId,
                        }));
                        if (result?.error) {
                            console.warn(`Failed to remove contact ${contact.id} from segment:`, result.error.message);
                            failed++;
                        } else {
                            succeeded++;
                        }
                    }
                } catch (e: any) {
                    console.error(`Error deleting contact ${contact.id}:`, e.message);
                    failed++;
                }
            });

            return NextResponse.json({ ok: true, succeeded, failed });
        }

        // Single contact deletion from segment
        if (!body.contactId) {
            return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
        }

        const result = await callResendWithRetry<any>(() => (resend.contacts as any).segments.remove({
            contactId: body.contactId,
            segmentId,
        }));

        if (result?.error) {
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}
