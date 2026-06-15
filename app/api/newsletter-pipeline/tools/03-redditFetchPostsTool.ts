// Tool 3 — redditFetchPostsTool
// Fetches top posts from ALL LLM-chosen subreddits in parallel.
// Primary: RSS feed (no auth). Fallback: CORS proxies for JSON.

import { fetchWithTimeout, USER_AGENT, getRedditOAuthToken } from './base';

export interface RedditPostRaw {
    id: string; subreddit: string; title: string; selftext: string;
    upvotes: number; upvoteRatio: number; comments: number;
    author: string; flair: string; url: string; permalink: string; created_utc: string;
}

// ── RSS helpers ───────────────────────────────────────────────────────────────

function decodeHtml(str: string): string {
    return str
        .replace(/&amp;/g,  '&')
        .replace(/&lt;/g,   '<')
        .replace(/&gt;/g,   '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g,  "'")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .trim();
}

function stripHtml(str: string): string {
    return str.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function parsePostsRss(xml: string, subreddit: string): RedditPostRaw[] {
    const posts: RedditPostRaw[] = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
    let match: RegExpExecArray | null;

    while ((match = entryRe.exec(xml)) !== null) {
        const entry = match[1];

        const rawTitle   = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]     ?? '';
        const link       = entry.match(/<link[^>]*href="([^"]+)"/)?.[1]             ?? '';
        const author     = entry.match(/<name>([\s\S]*?)<\/name>/)?.[1]             ?? '';
        const updated    = entry.match(/<updated>([\s\S]*?)<\/updated>/)?.[1]       ?? '';
        const rawContent = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1]  ?? '';
        const idUrl      = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]                 ?? link;
        const category   = entry.match(/<category[^>]*term="([^"]+)"/)?.[1]         ?? subreddit;

        const title     = decodeHtml(rawTitle);
        const selftext  = stripHtml(decodeHtml(rawContent)).slice(0, 500);
        const id        = idUrl.split('/').filter(Boolean).slice(-1)[0] ?? Math.random().toString(36).slice(2);
        const permalink = link.replace('https://www.reddit.com', '');

        if (!title) continue;

        posts.push({
            id,
            subreddit: category || subreddit,
            title,
            selftext,
            upvotes:     0,   // not available in RSS
            upvoteRatio: 0,
            comments:    0,
            author:      decodeHtml(author),
            flair:       'General',
            url:         link,
            permalink,
            created_utc: updated
                ? new Date(updated).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
                : '',
        });
    }
    return posts;
}

// ── Fetch one subreddit via RSS (primary) then JSON proxies (fallback) ────────

async function fetchOneSub(subreddit: string, timeframe: string): Promise<RedditPostRaw[]> {
    const rssUrl = `https://www.reddit.com/r/${subreddit}/top.rss?t=${timeframe}&limit=50`;

    // ── Primary: CORS proxies for RSS ──────────────────────────────────────
    const rssProxies = [
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
        `https://thingproxy.freeboard.io/fetch/${rssUrl}`
    ];

    for (const src of rssProxies) {
        try {
            const res = await fetchWithTimeout(src, 10000, {
                headers: { 'User-Agent': USER_AGENT },
                cache:   'no-store',
            });
            if (!res.ok) continue;
            const xml = await res.text();
            if (!xml?.trim()) continue;
            const posts = parsePostsRss(xml, subreddit);
            if (posts.length > 0) return posts;
        } catch { /* try next proxy */ }
    }

    // ── Secondary: Direct RSS (as fallback, since direct requests get 403 on Vercel) ──
    try {
        const res = await fetchWithTimeout(rssUrl, 10000, {
            headers: { 'User-Agent': USER_AGENT },
            cache:   'no-store',
        });
        if (res.ok) {
            const xml   = await res.text();
            const posts = parsePostsRss(xml, subreddit);
            if (posts.length > 0) return posts;
        }
    } catch { /* fall through to JSON proxies */ }

    // ── Fallback: CORS proxies for JSON API ───────────────────────────────────
    const targetUrl = `https://www.reddit.com/r/${subreddit}/top.json?t=${timeframe}&limit=50`;
    const jsonProxies = [
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://thingproxy.freeboard.io/fetch/${targetUrl}`
    ];

    for (const src of jsonProxies) {
        try {
            const res = await fetchWithTimeout(src, 10000, {
                headers: { 'User-Agent': USER_AGENT },
                cache:   'no-store',
            });
            if (!res.ok) continue;
            const text = await res.text();
            if (!text?.trim()) continue;
            const parsed = JSON.parse(text);
            if (!parsed?.data?.children?.length) continue;
            return (parsed.data.children as any[]).map((item: any): RedditPostRaw => {
                const p = item.data;
                return {
                    id:          p.id          as string,
                    subreddit,
                    title:       p.title       as string,
                    selftext:    (p.selftext   as string) || '',
                    upvotes:     p.ups         as number,
                    upvoteRatio: p.upvote_ratio as number,
                    comments:    p.num_comments as number,
                    author:      p.author      as string,
                    flair:       (p.link_flair_text as string) || 'General',
                    url:         `https://reddit.com${p.permalink as string}`,
                    permalink:   p.permalink   as string,
                    created_utc: new Date((p.created_utc as number) * 1000)
                        .toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
                };
            });
        } catch { /* try next proxy */ }
    }

    return [];
}

// ── Main export (unchanged signature) ─────────────────────────────────────────

export async function redditFetchPostsTool(
    subreddits: string[], timeframe = 'week',
): Promise<{ posts: RedditPostRaw[]; fetchedFrom: string[]; failedFrom: string[] }> {
    if (subreddits.length === 0) return { posts: [], fetchedFrom: [], failedFrom: [] };

    // Fetch subreddits in small batches with a delay between them to prevent rate limiting.
    const results: Array<PromiseSettledResult<RedditPostRaw[]>> = [];
    const batchSize = 3;
    const delayMs = 500;

    for (let i = 0; i < subreddits.length; i += batchSize) {
        const batch = subreddits.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
            batch.map(sub => fetchOneSub(sub, timeframe))
        );
        results.push(...batchResults);

        if (i + batchSize < subreddits.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    const allPosts: RedditPostRaw[] = [];
    const fetchedFrom: string[]     = [];
    const failedFrom: string[]      = [];

    results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
            allPosts.push(...result.value);
            fetchedFrom.push(subreddits[i]);
        } else {
            failedFrom.push(subreddits[i]);
        }
    });

    // Deduplicate by title
    const seen   = new Set<string>();
    const unique = allPosts.filter(p => {
        const key = p.title.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key); return true;
    });

    const sorted = unique.sort((a, b) => b.upvotes - a.upvotes);
    console.log(`[redditFetchPostsTool] ${sorted.length} posts from ${fetchedFrom.length} subs (${failedFrom.length} failed)`);
    return { posts: sorted, fetchedFrom, failedFrom };
}
