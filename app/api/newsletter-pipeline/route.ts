import { NextRequest } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';
import { redditDiscoverTool }     from './tools/01-redditDiscoverTool';
import { llmPickSubredditsTool }  from './tools/02-llmPickSubredditsTool';
import { redditFetchPostsTool }   from './tools/03-redditFetchPostsTool';
import { redditDeepAnalysisTool } from './tools/04-redditDeepAnalysisTool';
import { newsContextTool }        from './tools/05-newsContextTool';
import { newsletterWriterTool }   from './tools/06-newsletterWriterTool';
import { complianceReviewTool } from './tools/07-complianceReviewTool';
import { bannerImageTool }        from './tools/08-bannerImageTool';

export const maxDuration = 300;

function extractSubject(rawText: string): string {
    const match = rawText.match(/^SUBJECT:\s*(.+)$/m);
    return match?.[1]?.trim() || 'Vibe Trader Weekly';
}

// Newsletter title is shorter (4-5 words) and different from subject.
// Used for the banner overlay so banner and email header are not identical.
function extractNewsletterTitle(rawText: string): string {
    const match = rawText.match(/^NEWSLETTER_TITLE:\s*(.+)$/m);
    return match?.[1]?.trim() || extractSubject(rawText);
}

async function loadBlobPrompts(): Promise<{ weeklySystem: string; weeklyUser: string; weeklyTemplate: string }> {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    const container  = BlobServiceClient.fromConnectionString(connStr).getContainerClient('newsletter-prompts');
    const blob       = container.getBlockBlobClient('active-prompts.json');
    const exists     = await blob.exists();
    if (!exists) throw new Error('active-prompts.json not found in blob — publish prompts first');
    const data = JSON.parse((await blob.downloadToBuffer()).toString('utf-8'));
    if (!data.weeklySystem || !data.weeklyUser) throw new Error('active-prompts.json missing weeklySystem or weeklyUser — republish prompts');
    return {
        weeklySystem:   data.weeklySystem   as string,
        weeklyUser:     data.weeklyUser     as string,
        weeklyTemplate: data.weeklyTemplate as string || '',
    };
}

export async function POST(req: NextRequest) {
    try {
        const { rediscover } = await req.json().catch(() => ({ rediscover: false }));
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                function sendEvent(step: string, status: string, data?: any) {
                    const payload = JSON.stringify({ step, status, data });
                    controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                }

                try {
                    // ── Load prompts from blob first ──────────────────────────
                    sendEvent('prompts', 'running', { message: 'Loading prompts from Azure Blob...' });
                    const { weeklySystem, weeklyUser, weeklyTemplate } = await loadBlobPrompts();
                    sendEvent('prompts', 'done', { message: 'Prompts loaded ✓' });
                    console.log(`[pipeline] Loaded prompts from blob — system: ${weeklySystem.length} chars | user: ${weeklyUser.length} chars | template: ${weeklyTemplate.length} chars`);

                    // ── Tool 1: Discover communities ──────────────────────────
                    sendEvent('discover', 'pending');
                    console.log('[pipeline] starting discover...');
                    const discovered = await redditDiscoverTool();
                    sendEvent('discover', 'done', { count: discovered.length });

                    // ── Tool 2: LLM picks communities ─────────────────────────
                    sendEvent('pick', 'pending');
                    console.log('[pipeline] starting pick...');
                    const picked = await llmPickSubredditsTool(discovered);
                    sendEvent('pick', 'done', { picked });

                    // ── Tool 3: Fetch posts ───────────────────────────────────
                    sendEvent('fetch', 'pending');
                    console.log('[pipeline] starting fetch...');
                    const { posts, fetchedFrom } = await redditFetchPostsTool(picked, 'week');
                    sendEvent('fetch', 'done', { count: posts.length, fetchedFrom });

                    // ── Tool 4: Deep analysis ─────────────────────────────────
                    sendEvent('analyze', 'pending');
                    console.log('[pipeline] starting analyze...');
                    const analysis = await redditDeepAnalysisTool(posts);
                    sendEvent('analyze', 'done', { analysis });

                    // ── Tool 5: News context ──────────────────────────────────
                    sendEvent('news', 'pending');
                    console.log('[pipeline] starting news...');
                    const news = await newsContextTool(analysis);
                    sendEvent('news', 'done', { news });

                    // ── Tool 6: Write newsletter ──────────────────────────────
                    sendEvent('write', 'pending');
                    console.log('[pipeline] starting write...');
                    const writeResult = await newsletterWriterTool(analysis, news, {
                        systemPrompt: weeklySystem,
                        userTemplate: weeklyUser,
                    });
                    sendEvent('write', 'done');

                    // ── Tool 7: Compliance Review ──────────────────────────────
                    sendEvent('review', 'pending');
                    console.log('[pipeline] starting review...');
                    const reviewResult = await complianceReviewTool(writeResult.rawText);
                    sendEvent('review', 'done', { passed: reviewResult.passed, flags: reviewResult.flags });

                    // ── Tool 8: Banner ────────────────────────────────────────
                    sendEvent('banner', 'pending');
                    console.log('[pipeline] starting banner...');
                    // Use NEWSLETTER_TITLE for the banner (shorter, 4-5 words)
                    // so the banner overlay and the email subject line are different
                    const finalRawText = reviewResult.fixedText;
                    const subject         = extractSubject(finalRawText);
                    const newsletterTitle = extractNewsletterTitle(finalRawText);
                    console.log(`[pipeline] subject: "${subject}" | banner title: "${newsletterTitle}"`);
                    let bannerUrl = '';
                    try {
                        const bannerResult = await bannerImageTool(newsletterTitle, req.url);
                        bannerUrl = bannerResult.url;
                        sendEvent('banner', 'done', { bannerUrl });
                    } catch (err: any) {
                        console.error('[pipeline] banner generation failed:', err);
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
