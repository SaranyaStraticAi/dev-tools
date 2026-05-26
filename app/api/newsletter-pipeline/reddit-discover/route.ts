import { NextRequest } from 'next/server';
import { 
    aiGenerateSearchQueries, 
    searchRedditCommunities, 
    REDDIT_DISCOVER_SYSTEM_PROMPT, 
    REDDIT_DISCOVER_USER_PROMPT 
} from '../tools/01-redditDiscoverTool';

export const maxDuration = 180; // 3 minutes timeout

export async function POST(req: NextRequest) {
    try {
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                function sendEvent(step: string, status: string, data?: any) {
                    const payload = JSON.stringify({ step, status, ...data });
                    controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                }

                try {
                    // Send the prompts being used
                    sendEvent('prompts', 'done', {
                        system: REDDIT_DISCOVER_SYSTEM_PROMPT,
                        user: REDDIT_DISCOVER_USER_PROMPT
                    });

                    // Step 1: AI brainstorm queries
                    sendEvent('queries', 'running');
                    const queries = await aiGenerateSearchQueries();
                    sendEvent('queries', 'done', { queries });

                    // Step 2: Search Reddit API using callback to track progress
                    sendEvent('searching', 'running', { index: 0, total: queries.length, foundCount: 0 });
                    
                    const found = await searchRedditCommunities(queries, (query, index, total, foundCount) => {
                        sendEvent('searching', 'running', { query, index: index + 1, total, foundCount });
                    });

                    const communities = [...found.values()].sort((a, b) => b.subscribers - a.subscribers);

                    // Complete
                    sendEvent('complete', 'done', { communities });
                    controller.close();

                } catch (err: any) {
                    console.error('[reddit-discover-api] Stream error:', err);
                    sendEvent('error', 'error', { message: err.message || 'Stream processing failed' });
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type':  'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection':    'keep-alive',
            },
        });

    } catch (err: any) {
        console.error('[reddit-discover-api] Request error:', err);
        return new Response(
            JSON.stringify({ error: err.message || 'Failed to start stream' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
