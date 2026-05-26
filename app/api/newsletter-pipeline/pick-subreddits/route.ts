import { NextRequest, NextResponse } from 'next/server';
import { 
    llmPickSubredditsTool, 
    LLM_PICK_SYSTEM_PROMPT, 
    LLM_PICK_USER_TEMPLATE 
} from '../tools/02-llmPickSubredditsTool';

export const maxDuration = 180; // 3 minutes timeout

export async function POST(req: NextRequest) {
    try {
        const { communities } = await req.json().catch(() => ({ communities: [] }));
        
        if (!Array.isArray(communities) || communities.length === 0) {
            return NextResponse.json({ 
                success: false, 
                error: 'Please provide a valid, non-empty list of candidate subreddits.' 
            }, { status: 400 });
        }

        console.log(`[llm-pick-subreddits-api] Running llmPickSubredditsTool with ${communities.length} candidates...`);
        const picked = await llmPickSubredditsTool(communities);

        return NextResponse.json({ 
            success: true, 
            picked,
            system: LLM_PICK_SYSTEM_PROMPT,
            userTemplate: LLM_PICK_USER_TEMPLATE
        });
    } catch (error: any) {
        console.error('[llm-pick-subreddits-api] Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Failed to run LLM filtering' 
        }, { status: 500 });
    }
}
