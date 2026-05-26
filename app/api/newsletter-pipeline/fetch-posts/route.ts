import { NextRequest, NextResponse } from 'next/server';
import { redditFetchPostsTool } from '../tools/03-redditFetchPostsTool';

export const maxDuration = 180; // 3 minutes timeout

export async function POST(req: NextRequest) {
    try {
        const { subreddits, timeframe = 'week' } = await req.json().catch(() => ({ subreddits: [], timeframe: 'week' }));

        if (!Array.isArray(subreddits) || subreddits.length === 0) {
            return NextResponse.json({ 
                success: false, 
                error: 'Please provide a valid, non-empty list of subreddits to fetch.' 
            }, { status: 400 });
        }

        console.log(`[fetch-posts-api] Fetching posts for subreddits: ${subreddits.join(', ')} with timeframe: ${timeframe}...`);
        const result = await redditFetchPostsTool(subreddits, timeframe);

        return NextResponse.json({ 
            success: true, 
            ...result
        });
    } catch (error: any) {
        console.error('[fetch-posts-api] Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Failed to fetch Reddit posts' 
        }, { status: 500 });
    }
}
