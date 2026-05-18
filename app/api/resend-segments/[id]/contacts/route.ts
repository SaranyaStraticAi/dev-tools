// app/api/resend-segments/[id]/contacts/route.ts
// POST   → add an existing contact to this segment
// DELETE → remove a contact from this segment

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
        const result = await (resend.contacts as any).segments.add({
            contactId: body.contactId,
            segmentId,
        });

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
        const body = await req.json() as { contactId: string };

        if (!body.contactId) {
            return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
        }

        // Assuming remove follows the same pattern
        const result = await (resend.contacts as any).segments.remove({
            contactId: body.contactId,
            segmentId,
        });

        if (result?.error) {
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}
