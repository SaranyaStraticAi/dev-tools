import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        
        // Manual cleanup (in case Cascade Delete isn't synced yet)
        await prisma.marketing_link_visitors.deleteMany({
            where: { link_id: id }
        });

        await prisma.marketing_links.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting marketing link:', error);
        return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
    }
}
