// Tool 4 — redditDeepAnalysisTool
// Fetches full comment threads for ALL posts, sends everything to AI.
// AI reads every post + every comment and identifies the dominant trader pain.

import { fetchWithTimeout, USER_AGENT, callAI, parseJSON } from './base';
import type { RedditPostRaw } from './03-redditFetchPostsTool';

export interface PostWithComments extends RedditPostRaw {
    topComments: string[];
}

export interface DeepAnalysisResult {
    dominantPainTheme:  string;
    emotionalIntensity: string;
    keyPhrases:         string[];
    currencyOrEvent:    string;
    bestPost:           PostWithComments;
    supportingPosts:    PostWithComments[];
    analysisNotes:      string;
    prompts?:           { system: string; user: string; userTemplate?: string };
}

async function fetchComments(post: RedditPostRaw): Promise<string[]> {
    const url = `https://www.reddit.com/r/${post.subreddit}/comments/${post.id}.json?limit=100&depth=3&sort=top`;
    const sources = [
        url,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
    ];
    for (const src of sources) {
        try {
            const res = await fetchWithTimeout(src, 10000, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' });
            if (!res.ok) continue;
            const data = await res.json();
            const commentListing = Array.isArray(data) ? data[1] : null;
            if (!commentListing?.data?.children) continue;
            const comments: string[] = [];
            function extract(children: any[], depth = 0) {
                for (const child of children) {
                    if (child.kind !== 't1') continue;
                    const c = child.data;
                    if (!c.body || c.body === '[deleted]' || c.body === '[removed]') continue;
                    const indent = depth > 0 ? '  '.repeat(depth) + '↳ ' : '';
                    comments.push(`${indent}${c.author}: ${c.body.trim()}`);
                    if (c.replies?.data?.children?.length) extract(c.replies.data.children, depth + 1);
                }
            }
            extract(commentListing.data.children);
            return comments;
        } catch { /* try next */ }
    }
    return [];
}

function sanitizeText(text: string): string {
    if (!text) return '';
    // Truncate very long posts to avoid token limits and content filter issues
    const truncated = text.length > 1000 ? text.slice(0, 1000) + '...' : text;
    // Remove URLs which can contain suspicious domains
    return truncated.replace(/https?:\/\/\S+/g, '[link]').trim();
}

function formatPost(post: PostWithComments, index: number): string {
    const header = `═══ POST ${index + 1} ═══\nTitle: ${sanitizeText(post.title)}\nSubreddit: r/${post.subreddit}\nUpvotes: ${post.upvotes.toLocaleString()}\nComments: ${post.comments.toLocaleString()}\nFlair: ${post.flair}`;
    const body = post.selftext?.trim() ? `\nPost body:\n${sanitizeText(post.selftext)}` : '';
    const commentBlock = post.topComments.length > 0
        ? `\nTop comments:\n${post.topComments.slice(0, 15).map(c => sanitizeText(c)).join('\n')}`
        : '';
    return `${header}${body}${commentBlock}`;
}

export async function redditDeepAnalysisTool(posts: RedditPostRaw[]): Promise<DeepAnalysisResult> {
    if (posts.length === 0) throw new Error('No posts to analyze');

    // Cap at top 100 by upvotes — enough signal, avoids content filter overload
    const topPosts = posts.slice(0, 100);
    console.log(`[redditDeepAnalysisTool] Fetching comments for top ${topPosts.length} posts (from ${posts.length} total)...`);

    const postsWithComments: PostWithComments[] = await Promise.all(
        topPosts.map(async (post): Promise<PostWithComments> => {
            const topComments = await fetchComments(post);
            return { ...post, topComments };
        }),
    );

    const totalComments = postsWithComments.reduce((sum, p) => sum + p.topComments.length, 0);
    console.log(`[redditDeepAnalysisTool] Fetched ${totalComments} comments across ${posts.length} posts`);

    const fullDataset = postsWithComments.map((post, i) => formatPost(post, i)).join('\n\n');

    const system = `You are a senior analyst for Vibe Trader Weekly, a professional forex and retail trading newsletter.
You have the COMPLETE Reddit dataset for this week — every post and every comment thread.

Find the dominant trader pain theme and return structured analysis as JSON.

CRITICAL RULE for "currencyOrEvent" field:
- Extract the ACTUAL asset or macro event that appears most in the posts and comments this week
- Must be ONLY the asset name or event — maximum 4 words
- Correct format examples: "EUR/USD", "GBP/JPY", "NFP", "FOMC", "gold", "US30", "NAS100", "crude oil"
- Wrong format: "prop firm account blowups", "emotional trading after success", "funded account psychology"
- If posts are about trading psychology with no specific asset → find the most mentioned instrument in the comments
- If truly no specific asset is mentioned → use "forex market"
- DO NOT default to any specific asset — read the actual data and extract what traders are discussing THIS week

Respond ONLY with valid JSON:
{
  "dominantPainTheme": "full description of the psychological or behavioral pain traders are expressing",
  "emotionalIntensity": "high|medium|low",
  "keyPhrases": ["exact phrase traders used verbatim", "another exact phrase"],
  "currencyOrEvent": "the specific asset or macro event most discussed — e.g. EUR/USD or NFP or gold or US30 — 4 words max, asset name only",
  "bestPostIndex": 0,
  "supportingPostIndices": [1, 3],
  "analysisNotes": "your reasoning about why this theme dominates"
}
No markdown, no backticks — raw JSON only.`;

    const userTemplate = `Analyze the complete Reddit trading dataset for this week.\n\nCOMPLETE DATASET ({postCount} posts, {commentCount} comments):\n\n{fullDataset}`;

    const user = userTemplate
        .replace('{postCount}', postsWithComments.length.toString())
        .replace('{commentCount}', totalComments.toString())
        .replace('{fullDataset}', fullDataset);

    console.log(`[redditDeepAnalysisTool] Sending ${postsWithComments.length} posts + ${totalComments} comments to AI...`);
    const raw = await callAI(system, user, 0.2);

    const analysis = parseJSON<{
        dominantPainTheme: string; emotionalIntensity: string; keyPhrases: string[];
        currencyOrEvent: string; bestPostIndex: number; supportingPostIndices: number[]; analysisNotes: string;
    }>(raw);

    const bestPost       = postsWithComments[analysis.bestPostIndex] || postsWithComments[0];
    const supportingPosts = (analysis.supportingPostIndices || [])
        .filter((i: number) => i !== analysis.bestPostIndex && postsWithComments[i])
        .map((i: number) => postsWithComments[i]);

    console.log(`[redditDeepAnalysisTool] Pain: "${analysis.dominantPainTheme}" | Intensity: ${analysis.emotionalIntensity}`);
    return {
        dominantPainTheme: analysis.dominantPainTheme, emotionalIntensity: analysis.emotionalIntensity,
        keyPhrases: analysis.keyPhrases || [], currencyOrEvent: analysis.currencyOrEvent || 'Forex Market',
        bestPost, supportingPosts, analysisNotes: analysis.analysisNotes || '',
        prompts: { system, user, userTemplate },
    };
}
