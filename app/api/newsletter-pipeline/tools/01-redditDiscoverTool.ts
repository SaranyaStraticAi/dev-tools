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

// No fallback list — if all proxy sources fail, the pipeline throws a clear error.

// ── Try fetching a Reddit search URL through multiple proxy sources ────────────
// Same pattern as Tool 3 (redditFetchPostsTool) which already works in production.
async function fetchSubredditSearch(query: string): Promise<any | null> {
    const targetUrl = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(query)}&limit=25&sort=relevance`;

    const sources = [
        // 1. Direct — works locally, blocked by 403 on Vercel datacenter IPs
        targetUrl,
        // 2. allorigins — CORS-free public proxy, returns raw body
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        // 3. corsproxy.io — another reliable public CORS proxy
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        // 4. codetabs — fallback
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    ];

    for (const src of sources) {
        try {
            const res = await fetchWithTimeout(src, 12000, {
                headers: { 'User-Agent': USER_AGENT },
                cache:   'no-store',
            });
            if (!res.ok) {
                console.warn(`[redditDiscoverTool] source returned ${res.status}: ${src.slice(0, 60)}`);
                continue;
            }
            const text = await res.text();
            if (!text?.trim()) continue;
            const parsed = JSON.parse(text);
            // Valid Reddit search response has data.children
            if (parsed?.data?.children) return parsed;
        } catch (e) {
            console.warn(`[redditDiscoverTool] proxy failed (${src.slice(0, 60)}):`, (e as Error).message);
        }
    }
    return null; // all sources failed for this query
}

export async function searchRedditCommunities(
    queries: string[],
    onQueryProgress?: (query: string, index: number, total: number, foundCount: number) => void,
): Promise<Map<string, Community>> {
    const found    = new Map<string, Community>();
    const BATCH    = 3;    // 3 parallel requests at a time
    const DELAY_MS = 800;  // 800ms between batches

    for (let i = 0; i < queries.length; i += BATCH) {
        const batch = queries.slice(i, i + BATCH);
        await Promise.allSettled(
            batch.map(async (query, batchIdx) => {
                const globalIndex = i + batchIdx;
                if (globalIndex >= queries.length) return;
                if (onQueryProgress) {
                    onQueryProgress(query, globalIndex, queries.length, found.size);
                }
                const data = await fetchSubredditSearch(query);
                if (!data) {
                    console.warn(`[redditDiscoverTool] all sources failed for query "${query}"`);
                    return;
                }
                for (const item of (data.data.children || [])) {
                    const d = item.data;
                    if (!d?.display_name || found.has(d.display_name)) continue;
                    found.set(d.display_name, {
                        name:        d.display_name as string,
                        subscribers: (d.subscribers || 0) as number,
                        description: ((d.public_description || d.title || '') as string).slice(0, 200),
                        url:         `https://reddit.com/r/${d.display_name}`,
                    });
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
        throw new Error('Reddit search returned 0 communities — all proxy sources failed. Check proxy availability.');
    }

    console.log(`[redditDiscoverTool] Found ${all.length} unique communities via proxy`);
    return all;
}
