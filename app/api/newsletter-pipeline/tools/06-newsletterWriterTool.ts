// Tool 6 — newsletterWriterTool
// Writes the Thursday newsletter using deep analysis + news context.
// System prompt and user template come from Azure Blob via the prompts parameter —
// NOT from hardcoded prompts.ts — so UI edits take effect immediately.

import { callAI } from './base';
import type { DeepAnalysisResult } from './04-redditDeepAnalysisTool';
import type { NewsContext } from './05-newsContextTool';

interface RedditPost {
    rank: number; subreddit?: string; title: string; selftext?: string;
    upvotes: number; comments: number; flair: string; url: string; created_utc: string;
}

export interface NewsletterWriterResult {
    rawText: string; usedPosts: RedditPost[]; attempt: number;
}

export interface WriterPrompts {
    systemPrompt: string;
    userTemplate: string;
}

function formatPosts(posts: RedditPost[]): string {
    return posts.map(p => {
        const src  = p.subreddit ? ` (r/${p.subreddit})` : '';
        let   text = `#${p.rank} [${p.flair}]${src} ${p.title}\n`;
        if (p.selftext?.trim()) {
            const body = p.selftext.trim();
            text += (body.length > 800 ? body.slice(0, 800) + '...' : body)
                .split('\n').map(l => `   ${l}`).join('\n') + '\n';
        }
        text += `   Upvotes: ${p.upvotes} | Comments: ${p.comments} | Posted: ${p.created_utc}\n   URL: ${p.url}`;
        return text;
    }).join('\n\n');
}

function toPost(p: any, rank: number): RedditPost {
    return {
        rank, subreddit: p.subreddit, title: p.title, selftext: p.selftext || '',
        upvotes: p.upvotes, comments: p.comments, flair: p.flair,
        url: p.url, created_utc: p.created_utc,
    };
}

export async function newsletterWriterTool(
    analysis: DeepAnalysisResult,
    news: NewsContext,
    prompts: WriterPrompts,
): Promise<NewsletterWriterResult> {
    const today = new Date().toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });

    const allPosts: RedditPost[] = [toPost(analysis.bestPost, 1)];
    analysis.supportingPosts.forEach((p, i) => allPosts.push(toPost(p, i + 2)));

    const externalSources = news.summary || news.referenceLinks.length > 0
        ? [
            news.summary ? `MARKET SUMMARY:\n${news.summary}` : '',
            news.referenceLinks.length > 0
                ? `SOURCES:\n${news.referenceLinks.map(l => `- ${l.title}: ${l.url}`).join('\n')}`
                : '',
          ].filter(Boolean).join('\n\n')
        : 'No external sources available this week.';

    const analysisContext = [
        `DEEP ANALYSIS (from reading all posts + comment threads):`,
        `• Dominant pain: ${analysis.dominantPainTheme}`,
        `• Emotional intensity: ${analysis.emotionalIntensity}`,
        `• Currency/event: ${analysis.currencyOrEvent}`,
        `• Key phrases: ${analysis.keyPhrases.slice(0, 8).map(p => `"${p}"`).join(', ')}`,
        `• Notes: ${analysis.analysisNotes}`,
        `\nANCHOR POST: "${analysis.bestPost.title}" (r/${analysis.bestPost.subreddit}, ${analysis.bestPost.upvotes} upvotes)`,
    ].join('\n');

    // Build user prompt from blob template
    const userPrompt = prompts.userTemplate
        .replace('{date}', today)
        .replace('{analysis}', analysisContext)
        .replace('{anchor_post}', formatPosts([allPosts[0]]))
        .replace('{external_sources}', externalSources);

    // Attempt 1
    console.log('[newsletterWriterTool] Writing newsletter (attempt 1) using blob prompts...');
    let raw = await callAI(prompts.systemPrompt, userPrompt, 0.7);
    if (!raw.includes('ERROR: VALIDATION_FAILED')) {
        return { rawText: raw, usedPosts: allPosts, attempt: 1 };
    }

    // Attempt 2 — retry with stricter instruction
    console.warn('[newsletterWriterTool] Attempt 1 failed validation — retrying...');
    raw = await callAI(
        prompts.systemPrompt,
        userPrompt + '\n\nIMPORTANT: Previous attempt returned VALIDATION_FAILED. Only use whitelisted features in SECTION4_BODY.',
        0.5,
    );
    return { rawText: raw, usedPosts: allPosts, attempt: 2 };
}
