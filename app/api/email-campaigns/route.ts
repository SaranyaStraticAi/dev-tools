// app/api/email-campaigns/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/email-campaigns - List all email campaigns
export async function GET(req: NextRequest) {
    try {
        const campaigns = await prisma.email_campaigns.findMany({
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
