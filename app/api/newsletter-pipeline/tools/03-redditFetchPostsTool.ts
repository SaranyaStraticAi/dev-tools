// Tool 3 — redditFetchPostsTool
// Fetches top posts from ALL LLM-chosen subreddits in parallel.
// Returns everything — no count limit. Tool 4 decides what matters.

import { fetchWithTimeout, USER_AGENT } from './base';

export interface RedditPostRaw {
    id: string; subreddit: string; title: string; selftext: string;
    upvotes: number; upvoteRatio: number; comments: number;
    author: string; flair: string; url: string; permalink: string; created_utc: string;
}

async function fetchOneSub(subreddit: string, timeframe: string): Promise<RedditPostRaw[]> {
    const targetUrl = `https://www.reddit.com/r/${subreddit}/top.json?t=${timeframe}&limit=50`;
    const sources = [
        targetUrl,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    ];
    for (const src of sources) {
        try {
            const res = await fetchWithTimeout(src, 10000, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' });
            if (!res.ok) continue;
            const text = await res.text();
            if (!text?.trim()) continue;
            const parsed = JSON.parse(text);
            if (!parsed?.data?.children?.length) continue;
            return (parsed.data.children as any[]).map((item: any): RedditPostRaw => {
                const p = item.data;
                return {
                    id: p.id as string, subreddit,
                    title: p.title as string, selftext: (p.selftext as string) || '',
                    upvotes: p.ups as number, upvoteRatio: p.upvote_ratio as number,
                    comments: p.num_comments as number, author: p.author as string,
                    flair: (p.link_flair_text as string) || 'General',
                    url: `https://reddit.com${p.permalink as string}`,
                    permalink: p.permalink as string,
                    created_utc: new Date((p.created_utc as number) * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
                };
            });
        } catch { /* try next source */ }
    }
    return [];
}

export async function redditFetchPostsTool(
    subreddits: string[], timeframe = 'week',
): Promise<{ posts: RedditPostRaw[]; fetchedFrom: string[]; failedFrom: string[] }> {
    if (subreddits.length === 0) return { posts: [], fetchedFrom: [], failedFrom: [] };

    const results = await Promise.allSettled(subreddits.map(sub => fetchOneSub(sub, timeframe)));
    const allPosts: RedditPostRaw[] = [];
    const fetchedFrom: string[] = [];
    const failedFrom: string[]  = [];

    results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
            allPosts.push(...result.value);
            fetchedFrom.push(subreddits[i]);
        } else { failedFrom.push(subreddits[i]); }
    });

    const seen = new Set<string>();
    const unique = allPosts.filter(p => {
        const key = p.title.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key); return true;
    });

    const sorted = unique.sort((a, b) => b.upvotes - a.upvotes);
    console.log(`[redditFetchPostsTool] ${sorted.length} posts from ${fetchedFrom.length} subs`);
    return { posts: sorted, fetchedFrom, failedFrom };
}
