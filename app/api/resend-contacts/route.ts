// app/api/resend-contacts/route.ts
// GET  → list all contacts (optionally filter by segment)
// POST → add a new contact

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ── GET — list contacts ───────────────────────────────────────────────────────
export async function GET() {
    try {
        console.log('[resend-contacts] fetching global list');
        
        const result = await resend.contacts.list();

        if (result.error) {
            console.error('[resend-contacts] list error:', result.error);
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        const contacts = result.data?.data ?? [];
        console.log(`[resend-contacts] success, found ${contacts.length} contacts`);
        
        return NextResponse.json({ contacts });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}

// ── POST — create a contact ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            email: string;
            firstName?: string;
            lastName?: string;
            unsubscribed?: boolean;
        };

        const result = await resend.contacts.create({
            email:        body.email,
            firstName:    body.firstName  ?? '',
            lastName:     body.lastName   ?? '',
            unsubscribed: body.unsubscribed ?? false,
        });

        if (result.error) {
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ contact: result.data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}
