import { NextRequest, NextResponse } from 'next/server';
import { redditDeepAnalysisTool } from '../tools/04-redditDeepAnalysisTool';

export const maxDuration = 180; // 3 minutes timeout

export async function POST(req: NextRequest) {
    try {
        const { posts, systemPrompt, userTemplate, userPrompt } = await req.json().catch(() => ({ posts: [] }));

        if (!Array.isArray(posts) || posts.length === 0) {
            return NextResponse.json({ 
                success: false, 
                error: 'Please provide a valid, non-empty list of Reddit posts to analyze.' 
            }, { status: 400 });
        }

        console.log(`[deep-analysis-api] Running redditDeepAnalysisTool with ${posts.length} posts...`);
        const result = await redditDeepAnalysisTool(posts, {
            systemPrompt,
            userTemplate: userTemplate || userPrompt
        });

        return NextResponse.json({ 
            success: true, 
            analysis: result
        });
    } catch (error: any) {
        console.error('[deep-analysis-api] Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Failed to analyze Reddit posts' 
        }, { status: 500 });
    }
}
