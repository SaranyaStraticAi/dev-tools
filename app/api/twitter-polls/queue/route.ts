// app/api/twitter-polls/queue/route.ts
// GET  ?status=pending_review|approved|rejected|posted  — list polls
// PATCH  { id, status: "approved"|"rejected", scheduledFor? }  — update status

import { NextRequest, NextResponse } from 'next/server';
import { PollQueue } from '@/lib/twitter-poll-queue';
import type { PollStatus } from '@/lib/twitter-poll-queue';

const VALID: PollStatus[] = ['pending_review', 'approved', 'rejected', 'posted'];

export async function GET(req: NextRequest) {
    const status = (req.nextUrl.searchParams.get('status') ?? 'pending_review') as PollStatus;
    if (!VALID.includes(status))
        return NextResponse.json({ error: `status must be one of: ${VALID.join(', ')}` }, { status: 400 });
    try {
        const polls = await PollQueue.list(status);
        return NextResponse.json({ polls });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const { id, status, scheduledFor } = await req.json().catch(() => ({}));
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (status !== 'approved' && status !== 'rejected')
        return NextResponse.json({ error: 'status must be "approved" or "rejected"' }, { status: 400 });
    try {
        await PollQueue.updateStatus(id, status as PollStatus, { scheduledFor });
        return NextResponse.json({ ok: true, id, status });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
