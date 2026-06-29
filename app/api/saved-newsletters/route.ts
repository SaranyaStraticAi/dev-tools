// app/api/saved-newsletters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/saved-newsletters        - List all saved newsletters
// GET /api/saved-newsletters?id=xxx  - Fetch a single saved newsletter by ID
export async function GET(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get('id');
        if (id) {
            const draft = await prisma.saved_newsletters.findUnique({ where: { id } });
            if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            return NextResponse.json({ draft });
        }
        const saved = await prisma.saved_newsletters.findMany({
            orderBy: { created_at: 'desc' }
        });
        return NextResponse.json({ saved });
    } catch (err: any) {
        console.error('[saved-newsletters] GET error:', err);
        return NextResponse.json({ error: err.message ?? 'Failed to fetch saved newsletters' }, { status: 500 });
    }
}

// POST /api/saved-newsletters - Save a new newsletter
export async function POST(req: NextRequest) {
    try {
        const { subject, body, rawText, type } = await req.json() as {
            subject: string;
            body: string;
            rawText?: string;
            type: string;
        };

        if (!subject || !body || !type) {
            return NextResponse.json({ error: 'subject, body, and type are required' }, { status: 400 });
        }

        const saved = await prisma.saved_newsletters.create({
            data: {
                subject,
                body,
                raw_text: rawText || null,
                type
            }
        });

        return NextResponse.json({ success: true, saved });
    } catch (err: any) {
        console.error('[saved-newsletters] POST error:', err);
        return NextResponse.json({ error: err.message ?? 'Failed to save newsletter' }, { status: 500 });
    }
}

// PATCH /api/saved-newsletters - Update a saved newsletter by ID
export async function PATCH(req: NextRequest) {
    try {
        const { id, subject, body, rawText } = await req.json() as {
            id: string;
            subject?: string;
            body?: string;
            rawText?: string;
        };
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }
        const updated = await prisma.saved_newsletters.update({
            where: { id },
            data: {
                ...(subject  !== undefined ? { subject }          : {}),
                ...(body     !== undefined ? { body }              : {}),
                ...(rawText  !== undefined ? { raw_text: rawText } : {}),
            },
        });
        return NextResponse.json({ success: true, saved: updated });
    } catch (err: any) {
        console.error('[saved-newsletters] PATCH error:', err);
        return NextResponse.json({ error: err.message ?? 'Failed to update saved newsletter' }, { status: 500 });
    }
}

// DELETE /api/saved-newsletters?id=xxx - Delete a saved newsletter
export async function DELETE(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
        }

        await prisma.saved_newsletters.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[saved-newsletters] DELETE error:', err);
        return NextResponse.json({ error: err.message ?? 'Failed to delete saved newsletter' }, { status: 500 });
    }
}
