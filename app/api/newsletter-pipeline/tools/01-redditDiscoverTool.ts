// Tool 1 — redditDiscoverTool
// Step A: AI decides what search queries to run — no hardcoded topics, no count limit
// Step B: Run queries in small batches with delays to avoid Reddit rate limiting
// Throws if Reddit returns 0 communities so the pipeline fails loudly, not silently.

import { fetchWithTimeout, USER_AGENT, callAI, parseJSON } from './base';

export interface Community {
    name:        string;
    subscribers: number;
    description: string;
    url:         string;
}

export const REDDIT_DISCOVER_SYSTEM_PROMPT = `You are building a Reddit community discovery system for a forex and retail trading newsletter called Vibe Trader Weekly.
The newsletter targets retail traders — people trading currencies, indices, commodities with real money.

Generate search queries to run on Reddit's subreddit search API to find every community where these traders gather.
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

export async function searchRedditCommunities(queries: string[], onQueryProgress?: (query: string, index: number, total: number, foundCount: number) => void): Promise<Map<string, Community>> {
    const found    = new Map<string, Community>();
    const BATCH    = 3;    // 3 parallel requests at a time — gentle on Reddit
    const DELAY_MS = 1000; // 1s between batches

    for (let i = 0; i < queries.length; i += BATCH) {
        const batch = queries.slice(i, i + BATCH);
        await Promise.allSettled(
            batch.map(async (query, batchIdx) => {
                const globalIndex = i + batchIdx;
                if (globalIndex >= queries.length) return;
                try {
                    if (onQueryProgress) {
                        onQueryProgress(query, globalIndex, queries.length, found.size);
                    }
                    const url = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(query)}&limit=25&sort=relevance`;
                    const res = await fetchWithTimeout(url, 10000, {
                        headers: { 'User-Agent': USER_AGENT },
                        cache:   'no-store',
                    });
                    if (!res.ok) {
                        console.warn(`[redditDiscoverTool] Reddit returned ${res.status} for "${query}"`);
                        return;
                    }
                    const data = await res.json();
                    for (const item of (data?.data?.children || [])) {
                        const d = item.data;
                        if (!d?.display_name || found.has(d.display_name)) continue;
                        found.set(d.display_name, {
                            name:        d.display_name       as string,
                            subscribers: (d.subscribers || 0)  as number,
                            description: ((d.public_description || d.title || '') as string).slice(0, 200),
                            url:         `https://reddit.com/r/${d.display_name}`,
                        });
                    }
                } catch (e) {
                    console.warn(`[redditDiscoverTool] query "${query}" failed:`, e);
                }
            }),
        );
        if (i + BATCH < queries.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }
    return found;
}

export async function redditDiscoverTool(): Promise<Community[]> {
    const queries = await aiGenerateSearchQueries();
    const found   = await searchRedditCommunities(queries);
    const all     = [...found.values()].sort((a, b) => b.subscribers - a.subscribers);

    if (all.length === 0) {
        throw new Error('Reddit search returned 0 communities — Reddit may be rate limiting. Try again in a few minutes.');
    }

    console.log(`[redditDiscoverTool] Found ${all.length} unique communities`);
    return all;
}
