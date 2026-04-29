import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const skip = (page - 1) * limit;

        const where = search ? {
            OR: [
                { campaign_name: { contains: search, mode: 'insensitive' as const } },
                { slug: { contains: search, mode: 'insensitive' as const } },
                { target_url: { contains: search, mode: 'insensitive' as const } },
            ]
        } : {};

        const [links, total] = await Promise.all([
            prisma.marketing_links.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' }
            }),
            prisma.marketing_links.count({ where })
        ]);

        return NextResponse.json({
            links,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching marketing links:', error);
        return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { campaign_name, target_url, description, custom_slug } = await request.json();

        if (!target_url) {
            return NextResponse.json({ error: 'Target URL is required' }, { status: 400 });
        }

        const slug = custom_slug || nanoid(8);

        const link = await prisma.marketing_links.create({
            data: {
                slug,
                target_url,
                campaign_name,
                description,
            }
        });

        return NextResponse.json(link);
    } catch (error: any) {
        console.error('Error creating marketing link:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
    }
}
