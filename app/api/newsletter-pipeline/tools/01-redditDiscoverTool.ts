// Tool 1 — redditDiscoverTool
// Step A: AI decides what search queries to run
// Step B: Search Reddit subreddits via RSS (no auth needed) instead of JSON API
// Returns Community[] — same shape as before so Tool 2 is unchanged.

import { fetchWithTimeout, USER_AGENT, callAI, parseJSON } from './base';

export interface Community {
    name:        string;
    subscribers: number;
    description: string;
    url:         string;
}

// ── Prompts (unchanged) ───────────────────────────────────────────────────────

export const REDDIT_DISCOVER_SYSTEM_PROMPT = `You are building a Reddit community discovery system for a forex and retail trading newsletter called Vibe Trader Weekly.
The newsletter targets retail traders — people trading currencies, indices, commodities with real money.

Generate search queries to run on Reddit's subreddit search to find every community where these traders gather.
Think broadly: forex, day trading, psychology, prop firms (FTMO, Apex), strategies (ICT, SMC, price action),
broker issues, algo trading, funded accounts, asset classes (gold, indices, currencies), beginner traders, etc.

Generate as many distinct queries as you think are genuinely needed to cover the full landscape.
Focus on variety — each query should surface different communities, not slight variations of the same topic.

Respond ONLY with a valid JSON array of search query strings. No markdown, no explanation.`;

export const REDDIT_DISCOVER_USER_PROMPT = `Generate all Reddit search queries needed to discover every community where retail forex and active traders discuss their experiences. Return as many as genuinely needed — you decide the count.`;

export async function aiGenerateSearchQueries(): Promise<string[]> {
    const raw     = await callAI(REDDIT_DISCOVER_SYSTEM_PROMPT, REDDIT_DISCOVER_USER_PROMPT, 0.7);
    const queries = parseJSON<string[]>(raw);
    if (!Array.isArray(queries) || queries.length === 0) throw new Error('AI returned no search queries');
    console.log(`[redditDiscoverTool] AI generated ${queries.length} queries:`, queries);
    return queries;
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

// Parse Reddit's subreddit search RSS — each <entry> is one subreddit
function parseSubredditRss(xml: string): Community[] {
    const communities: Community[] = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
    let match: RegExpExecArray | null;

    while ((match = entryRe.exec(xml)) !== null) {
        const entry = match[1];

        const rawTitle = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '';
        const link     = entry.match(/<link[^>]*href="([^"]+)"/)?.[1]         ?? '';
        const rawDesc  = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]
                      ?? entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1]
                      ?? '';

        // Title for subreddit RSS entries is usually "r/subredditname: description"
        // or just the subreddit name
        const titleDecoded = decodeHtml(rawTitle);
        const nameMatch    = titleDecoded.match(/^(?:r\/)?([A-Za-z0-9_]+)/);
        const name         = nameMatch?.[1] ?? '';

        if (!name) continue;

        // Subscriber count isn't in the RSS, default to 0 — Tool 2 filters by relevance anyway
        communities.push({
            name,
            subscribers: 0,
            description: stripHtml(decodeHtml(rawDesc)).slice(0, 200),
            url:         link || `https://reddit.com/r/${name}`,
        });
    }
    return communities;
}

// ── Search one query via RSS ──────────────────────────────────────────────────

async function searchSubredditsRss(query: string): Promise<Community[]> {
    // Use subreddits/search.rss — public, no auth required
    const url = `https://www.reddit.com/subreddits/search.rss?q=${encodeURIComponent(query)}&limit=25&sort=relevance`;
    try {
        const res = await fetchWithTimeout(url, 10000, {
            headers: { 'User-Agent': USER_AGENT },
            cache:   'no-store',
        });
        if (!res.ok) {
            console.warn(`[redditDiscoverTool] RSS ${res.status} for "${query}"`);
            return [];
        }
        const xml = await res.text();
        return parseSubredditRss(xml);
    } catch (e) {
        console.warn(`[redditDiscoverTool] query "${query}" failed:`, e);
        return [];
    }
}

// ── Main (same signature as before) ──────────────────────────────────────────

export async function searchRedditCommunities(
    queries: string[],
    onQueryProgress?: (query: string, index: number, total: number, foundCount: number) => void,
): Promise<Map<string, Community>> {
    const found    = new Map<string, Community>();
    const BATCH    = 3;
    const DELAY_MS = 1000;

    for (let i = 0; i < queries.length; i += BATCH) {
        const batch = queries.slice(i, i + BATCH);
        await Promise.allSettled(
            batch.map(async (query, batchIdx) => {
                const globalIndex = i + batchIdx;
                if (globalIndex >= queries.length) return;
                if (onQueryProgress) onQueryProgress(query, globalIndex, queries.length, found.size);

                const communities = await searchSubredditsRss(query);
                for (const c of communities) {
                    if (!found.has(c.name)) found.set(c.name, c);
                }
            }),
        );
        if (i + BATCH < queries.length) {
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }
    return found;
}

export async function redditDiscoverTool(): Promise<Community[]> {
    const queries = await aiGenerateSearchQueries();
    const found   = await searchRedditCommunities(queries);
    const all     = [...found.values()].sort((a, b) => b.subscribers - a.subscribers);

    if (all.length === 0) {
        throw new Error('Reddit subreddit search returned 0 communities — Reddit may be temporarily unavailable.');
    }

    console.log(`[redditDiscoverTool] Found ${all.length} unique communities`);
    return all;
}
