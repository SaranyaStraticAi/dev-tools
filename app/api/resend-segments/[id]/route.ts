// app/api/resend-segments/[id]/route.ts
// GET    → list contacts inside a segment
// DELETE → delete the segment

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ── GET — list contacts in a segment ─────────────────────────────────────────
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        
        // Use fetch for segments contacts list as SDK might not have it clearly exposed
        const response = await fetch(`https://api.resend.com/segments/${id}/contacts`, {
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({ error: data.message ?? 'Failed to fetch contacts' }, { status: response.status });
        }

        return NextResponse.json({ contacts: data.data ?? [] });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}

// ── DELETE — remove a segment ─────────────────────────────────────────────────
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const result = await resend.segments.remove(id);

        if (result.error) {
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}
