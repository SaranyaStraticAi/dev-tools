import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        const link = await prisma.marketing_links.findUnique({
            where: { slug }
        });

        if (!link) {
            return new NextResponse('Link not found', { status: 404 });
        }

        // 1. Get or Create Visitor Identity (Passport)
        let visitorId = request.cookies.get('vibe_visitor_id')?.value;
        if (!visitorId) {
            visitorId = nanoid();
        }

        // 2. Update total clicks (Atomic increment)
        await prisma.marketing_links.update({
            where: { id: link.id },
            data: { click_count: { increment: 1 } }
        });

        // 3. Track unique clicks by Visitor ID (Cookie)
        try {
            await prisma.marketing_link_visitors.create({
                data: {
                    link_id: link.id,
                    visitor_id: visitorId
                }
            });
            // If creation succeeds, it's a new unique browser for this specific link
            await prisma.marketing_links.update({
                where: { id: link.id },
                data: { unique_clicks: { increment: 1 } }
            });
        } catch (e) {
            // If it fails, they have already visited this link with this browser
        }

        // 4. Redirect and set/refresh the identity cookie
        const response = NextResponse.redirect(link.target_url);
        response.cookies.set('vibe_visitor_id', visitorId, {
            maxAge: 60 * 60 * 24 * 365, // 1 year
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        return response;
    } catch (error) {
        console.error('Error in redirection logic:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
