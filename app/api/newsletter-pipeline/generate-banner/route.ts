import { NextRequest, NextResponse } from 'next/server';
import { bannerImageTool } from '../tools/08-bannerImageTool';

export const maxDuration = 180; // 3 minutes timeout

export async function POST(req: NextRequest) {
    try {
        const { subject } = await req.json().catch(() => ({ subject: '' }));

        if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
            return NextResponse.json({ 
                success: false, 
                error: 'Please provide a valid subject or banner title text.' 
            }, { status: 400 });
        }

        console.log(`[generate-banner-api] Generating banner for subject: "${subject}"...`);
        const result = await bannerImageTool(subject, req.url);

        return NextResponse.json({ 
            success: true, 
            ...result
        });
    } catch (error: any) {
        console.error('[generate-banner-api] Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Failed to generate banner image' 
        }, { status: 500 });
    }
}
