// app/api/email-campaigns/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// GET /api/email-campaigns - List all email campaigns
export async function GET(req: NextRequest) {
    try {
        const campaigns = await (prisma.email_campaigns as any).findMany({
            orderBy: {
                sent_at: 'desc'
            }
        });
        return NextResponse.json({ campaigns });
    } catch (err: any) {
        console.error('[email-campaigns] GET error:', err);
        return NextResponse.json({ error: err.message ?? 'Failed to fetch campaigns' }, { status: 500 });
    }
}

// PATCH /api/email-campaigns - Cancel a scheduled broadcast
// Body: { id: string }
export async function PATCH(req: NextRequest) {
    try {
        const { id } = await req.json() as { id: string };
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        // Fetch the campaign from DB
        const campaign = await (prisma.email_campaigns as any).findUnique({ where: { id } });
        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }
        if (campaign.status !== 'scheduled') {
            return NextResponse.json({ error: 'Campaign is not in scheduled state' }, { status: 400 });
        }

        // Cancel each broadcast in Resend (by removing/deleting the scheduled broadcast)
        const cancelErrors: string[] = [];
        for (const broadcastId of campaign.broadcast_ids ?? []) {
            try {
                const res = await resend.broadcasts.remove(broadcastId);
                if (res?.error) {
                    console.warn(`[email-campaigns] remove broadcast ${broadcastId} error:`, res.error);
                    cancelErrors.push(`${broadcastId}: ${res.error.message}`);
                } else {
                    console.log(`[email-campaigns] ✅ Cancelled/Removed broadcast ${broadcastId}`);
                }
            } catch (e: any) {
                // If already sent, Resend throws — treat as non-fatal
                console.warn(`[email-campaigns] remove broadcast ${broadcastId} threw:`, e.message);
                cancelErrors.push(`${broadcastId}: ${e.message}`);
            }
        }

        // Update status to cancelled in DB regardless (Resend may already have sent it)
        await (prisma.email_campaigns as any).update({
            where: { id },
            data: { status: 'cancelled' },
        });

        return NextResponse.json({
            success: true,
            cancelErrors: cancelErrors.length > 0 ? cancelErrors : undefined,
        });
    } catch (err: any) {
        console.error('[email-campaigns] PATCH error:', err);
        return NextResponse.json({ error: err.message ?? 'Failed to cancel campaign' }, { status: 500 });
    }
}

// DELETE /api/email-campaigns?id=xxx - Delete an email campaign
export async function DELETE(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
        }

        await prisma.email_campaigns.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[email-campaigns] DELETE error:', err);
        return NextResponse.json({ error: err.message ?? 'Failed to delete campaign' }, { status: 500 });
    }
}
