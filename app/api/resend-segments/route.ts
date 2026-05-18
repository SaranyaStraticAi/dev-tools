// app/api/resend-segments/route.ts
// GET  → list all segments
// POST → create a new segment

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ── GET — list segments ───────────────────────────────────────────────────────
export async function GET() {
    try {
        const result = await resend.segments.list();

        if (result.error) {
            console.error('[resend-segments] list error:', result.error);
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        const segments = (result.data as any)?.data ?? result.data ?? [];
        return NextResponse.json({ segments });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}

// ── POST — create segment ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as { name: string };

        if (!body.name?.trim()) {
            return NextResponse.json({ error: 'Segment name is required' }, { status: 400 });
        }

        const result = await resend.segments.create({ name: body.name.trim() });

        if (result.error) {
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ segment: result.data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}
