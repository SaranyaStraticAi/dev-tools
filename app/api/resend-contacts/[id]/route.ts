// app/api/resend-contacts/[id]/route.ts
// PATCH  → update contact (name, unsubscribed toggle)
// DELETE → remove contact permanently

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ── PATCH — update a contact ──────────────────────────────────────────────────
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json() as {
            firstName?:    string;
            lastName?:     string;
            unsubscribed?: boolean;
        };

        const audienceId = process.env.RESEND_AUDIENCE_ID;
        if (!audienceId) {
            return NextResponse.json({ error: 'RESEND_AUDIENCE_ID not set' }, { status: 500 });
        }

        const result = await resend.contacts.update({
            id,
            audienceId,
            firstName:    body.firstName,
            lastName:     body.lastName,
            unsubscribed: body.unsubscribed,
        });

        if (result.error) {
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ contact: result.data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}

// ── DELETE — remove a contact ─────────────────────────────────────────────────
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const result = await resend.contacts.remove({ id });

        if (result.error) {
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}
