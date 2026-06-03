import { NextRequest } from 'next/server';
import { redditDiscoverTool, REDDIT_DISCOVER_SYSTEM_PROMPT, REDDIT_DISCOVER_USER_PROMPT } from './tools/01-redditDiscoverTool';
import { llmPickSubredditsTool, LLM_PICK_SYSTEM_PROMPT, LLM_PICK_USER_TEMPLATE }  from './tools/02-llmPickSubredditsTool';
import { redditFetchPostsTool }   from './tools/03-redditFetchPostsTool';
import { redditDeepAnalysisTool, ANALYZE_SYSTEM_PROMPT, ANALYZE_USER_TEMPLATE } from './tools/04-redditDeepAnalysisTool';
import { newsContextTool }        from './tools/05-newsContextTool';
import { newsletterWriterTool }   from './tools/06-newsletterWriterTool';
import { puzzleWriterTool }       from './tools/06b-puzzleWriterTool';
import { complianceReviewTool }   from './tools/07-complianceReviewTool';
import { bannerImageTool }        from './tools/08-bannerImageTool';
import {
    WEEKLY_SYSTEM_PROMPT, WEEKLY_USER_TEMPLATE,
    PUZZLE_SYSTEM_PROMPT, PUZZLE_USER_TEMPLATE,
    WEEKLY_TEMPLATE, PUZZLE_TEMPLATE,
    REVIEW_SYSTEM_PROMPT, REVIEW_USER_TEMPLATE,
} from './tools/prompts';

// Load prompts from Azure Blob (active-prompts.json).
// Falls back to hardcoded prompts.ts if blob is unavailable or missing fields.
async function loadPrompts(requestUrl: string) {
    try {
        const base     = new URL(requestUrl);
        const apiUrl   = `${base.protocol}//${base.host}/api/newsletter-prompts`;
        const res      = await fetch(apiUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`newsletter-prompts API returned ${res.status}`);
        const data     = await res.json();
        const p        = data?.prompts;
        if (!data?.exists || !p) throw new Error('Blob has no prompts yet');

        console.log('[pipeline] Loaded prompts from Azure Blob ✓');
        return {
            weeklySystem:   p.weeklySystem   || WEEKLY_SYSTEM_PROMPT,
            weeklyUser:     p.weeklyUser     || WEEKLY_USER_TEMPLATE,
            weeklyTemplate: p.weeklyTemplate || WEEKLY_TEMPLATE,
            puzzleSystem:   p.puzzleSystem   || PUZZLE_SYSTEM_PROMPT,
            puzzleUser:     p.puzzleUser     || PUZZLE_USER_TEMPLATE,
            puzzleTemplate: p.puzzleTemplate || PUZZLE_TEMPLATE,
            discoverSystem: p.discoverSystem || REDDIT_DISCOVER_SYSTEM_PROMPT,
            discoverUser:   p.discoverUser   || REDDIT_DISCOVER_USER_PROMPT,
            pickSystem:     p.pickSystem     || LLM_PICK_SYSTEM_PROMPT,
            pickUser:       p.pickUser       || LLM_PICK_USER_TEMPLATE,
            analysisSystem: p.analysisSystem || ANALYZE_SYSTEM_PROMPT,
            analysisUser:   p.analysisUser   || ANALYZE_USER_TEMPLATE,
            reviewSystem:   p.reviewSystem   || REVIEW_SYSTEM_PROMPT,
            reviewUser:     p.reviewUser     || REVIEW_USER_TEMPLATE,
            source: 'blob' as const,
        };
    } catch (e: any) {
        console.warn('[pipeline] Blob prompt load failed — using hardcoded fallback:', e.message);
        return {
            weeklySystem:   WEEKLY_SYSTEM_PROMPT,
            weeklyUser:     WEEKLY_USER_TEMPLATE,
            weeklyTemplate: WEEKLY_TEMPLATE,
            puzzleSystem:   PUZZLE_SYSTEM_PROMPT,
            puzzleUser:     PUZZLE_USER_TEMPLATE,
            puzzleTemplate: PUZZLE_TEMPLATE,
            discoverSystem: REDDIT_DISCOVER_SYSTEM_PROMPT,
            discoverUser:   REDDIT_DISCOVER_USER_PROMPT,
            pickSystem:     LLM_PICK_SYSTEM_PROMPT,
            pickUser:       LLM_PICK_USER_TEMPLATE,
            analysisSystem: ANALYZE_SYSTEM_PROMPT,
            analysisUser:   ANALYZE_USER_TEMPLATE,
            reviewSystem:   REVIEW_SYSTEM_PROMPT,
            reviewUser:     REVIEW_USER_TEMPLATE,
            source: 'hardcoded' as const,
        };
    }
}

export const maxDuration = 300;

function extractSubject(rawText: string): string {
    const match = rawText.match(/^SUBJECT:\s*(.+)$/m);
    return match?.[1]?.trim() || 'Vibe Trader Weekly';
}

function extractNewsletterTitle(rawText: string): string {
    const match = rawText.match(/^NEWSLETTER_TITLE:\s*(.+)$/m);
    return match?.[1]?.trim() || extractSubject(rawText);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({ rediscover: false, type: 'weekly' }));
        const rediscover = body.rediscover;
        const type = body.type || 'weekly';
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                function sendEvent(step: string, status: string, data?: any) {
                    const payload = JSON.stringify({ step, status, data });
                    controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                }

                try {
                    // ── Load prompts from Azure Blob (falls back to hardcoded) ─
                    sendEvent('prompts', 'running', { message: 'Loading prompts from Azure Blob...' });
                    const prompts = await loadPrompts(req.url);
                    const { weeklySystem, weeklyUser, weeklyTemplate,
                            puzzleSystem, puzzleUser, puzzleTemplate,
                            discoverSystem, discoverUser,
                            pickSystem, pickUser,
                            analysisSystem, analysisUser,
                            reviewSystem, reviewUser } = prompts;
                    sendEvent('prompts', 'done', {
                        message: prompts.source === 'blob'
                            ? 'Prompts loaded from Azure Blob ✓'
                            : 'Blob unavailable — using hardcoded fallback ✓',
                        source: prompts.source,
                    });

                    // ── Tool 1: Discover communities via RSS ──────────────────
                    sendEvent('discover', 'pending');
                    console.log(`[pipeline][${type}] starting discover...`);
                    const discovered = await redditDiscoverTool({
                        systemPrompt: discoverSystem,
                        userPrompt: discoverUser,
                    });
                    sendEvent('discover', 'done', { count: discovered.length });

                    // ── Tool 2: LLM picks relevant communities ────────────────
                    sendEvent('pick', 'pending');
                    console.log(`[pipeline][${type}] starting pick...`);
                    const picked = await llmPickSubredditsTool(discovered, {
                        systemPrompt: pickSystem,
                        userTemplate: pickUser,
                    });
                    sendEvent('pick', 'done', { picked });

                    // ── Tool 3: Fetch posts via RSS ───────────────────────────
                    sendEvent('fetch', 'pending');
                    console.log(`[pipeline][${type}] starting fetch...`);
                    const { posts, fetchedFrom } = await redditFetchPostsTool(picked, 'week');
                    sendEvent('fetch', 'done', { count: posts.length, fetchedFrom });

                    if (type === 'puzzle') {
                        // ── PUZZLE PATH ───────────────────────────────────────
                        sendEvent('write', 'pending');
                        console.log(`[pipeline][${type}] starting puzzle write...`);
                        const writeResult = await puzzleWriterTool(posts, {
                            systemPrompt: puzzleSystem,
                            userTemplate: puzzleUser,
                        });
                        sendEvent('write', 'done');

                        sendEvent('complete', 'done', {
                            result: {
                                rawText:        writeResult.rawText,
                                usedPosts:      writeResult.usedPosts,
                                subredditsUsed: picked,
                                bannerUrl:      '',
                                weeklyTemplate: puzzleTemplate,
                            },
                        });
                        controller.close();
                        return;
                    }

                    // ── WEEKLY PATH ───────────────────────────────────────────
                    sendEvent('analyze', 'pending');
                    console.log(`[pipeline][${type}] starting analyze...`);
                    const analysis = await redditDeepAnalysisTool(posts, {
                        systemPrompt: analysisSystem,
                        userTemplate: analysisUser,
                    });
                    sendEvent('analyze', 'done', { analysis });

                    // ── Tool 5: News context ──────────────────────────────────
                    sendEvent('news', 'pending');
                    console.log(`[pipeline][${type}] starting news...`);
                    const news = await newsContextTool(analysis);
                    sendEvent('news', 'done', { news });

                    // ── Tool 6: Write newsletter ──────────────────────────────
                    sendEvent('write', 'pending');
                    console.log(`[pipeline][${type}] starting write...`);
                    const writeResult = await newsletterWriterTool(analysis, news, {
                        systemPrompt: weeklySystem,
                        userTemplate: weeklyUser,
                    });
                    sendEvent('write', 'done');

                    // ── Tool 7: Compliance Review ──────────────────────────────
                    sendEvent('review', 'pending');
                    console.log(`[pipeline][${type}] starting review...`);
                    const reviewResult = await complianceReviewTool(writeResult.rawText, {
                        systemPrompt: reviewSystem,
                        userTemplate: reviewUser,
                    });
                    sendEvent('review', 'done', { passed: reviewResult.passed, flags: reviewResult.flags });

                    // ── Tool 8: Banner ────────────────────────────────────────
                    sendEvent('banner', 'pending');
                    console.log(`[pipeline][${type}] starting banner...`);
                    const finalRawText = reviewResult.fixedText;
                    const subject         = extractSubject(finalRawText);
                    const newsletterTitle = extractNewsletterTitle(finalRawText);
                    let bannerUrl = '';
                    try {
                        const bannerResult = await bannerImageTool(newsletterTitle, req.url);
                        bannerUrl = bannerResult.url;
                        sendEvent('banner', 'done', { bannerUrl });
                    } catch (err: any) {
                        console.error(`[pipeline][${type}] banner failed:`, err);
                        sendEvent('banner', 'done', { bannerUrl: '' });
                    }

                    // ── Complete ──────────────────────────────────────────────
                    sendEvent('complete', 'done', {
                        result: {
                            rawText:        finalRawText,
                            usedPosts:      writeResult.usedPosts,
                            subredditsUsed: picked,
                            bannerUrl,
                            weeklyTemplate,
                        },
                    });
                    controller.close();

                } catch (err: any) {
                    console.error('[pipeline] Execution error:', err);
                    controller.enqueue(encoder.encode(
                        `data: ${JSON.stringify({ step: 'error', status: 'error', message: err.message })}\n\n`
                    ));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type':  'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection':    'keep-alive',
            },
        });

    } catch (err: any) {
        console.error('Error starting pipeline stream:', err);
        return new Response(
            JSON.stringify({ error: err.message || 'Failed to start pipeline' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
