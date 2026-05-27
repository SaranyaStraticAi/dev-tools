// app/api/resend-segments/route.ts
// GET  → list all segments
// POST → create a new segment

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Helper to wrap Resend calls with retry logic for 429
async function callResendWithRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
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

// ── GET — list segments ───────────────────────────────────────────────────────
export async function GET() {
    try {
        const result = await callResendWithRetry<any>(() => resend.segments.list());

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

        const result = await callResendWithRetry<any>(() => resend.segments.create({ name: body.name.trim() }));

        if (result.error) {
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ segment: result.data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
}
