// Tool 1 — redditDiscoverTool
// Step A: AI decides what search queries to run — no hardcoded topics, no count limit
// Step B: Run queries in small batches via a fast parallel proxy race to avoid Reddit IP blocks and timeouts
// Throws if Reddit returns 0 communities so the pipeline fails loudly.

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

// ── Fast parallel proxy fetcher ──────────────────────────────────────────────
// Instead of trying proxies sequentially (which causes 300s timeouts),
// we fire them all in parallel and take the first successful response.
async function fetchSubredditSearchFast(query: string): Promise<any> {
    const targetUrl = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(query)}&limit=25&sort=relevance`;

    const sources = [
        targetUrl, // Direct (fast 403 on Vercel, works locally)
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
    ];

    const fetchSource = async (src: string) => {
        const res = await fetchWithTimeout(src, 8000, {
            headers: { 'User-Agent': USER_AGENT },
            cache:   'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text?.trim()) throw new Error('Empty body');
        const parsed = JSON.parse(text);
        if (parsed?.data?.children) return parsed;
        throw new Error('Invalid JSON structure');
    };

    try {
        // Promise.any returns the FIRST resolved promise.
        // If all reject, it throws an AggregateError.
        return await Promise.any(sources.map(src => fetchSource(src)));
    } catch (err) {
        return null;
    }
}

export async function searchRedditCommunities(
    queries: string[],
    onQueryProgress?: (query: string, index: number, total: number, foundCount: number) => void,
): Promise<Map<string, Community>> {
    const found    = new Map<string, Community>();
    const BATCH    = 5;   // 5 parallel requests at a time — slightly faster batching
    const DELAY_MS = 500; // 500ms delay between batches

    for (let i = 0; i < queries.length; i += BATCH) {
        const batch = queries.slice(i, i + BATCH);
        await Promise.allSettled(
            batch.map(async (query, batchIdx) => {
                const globalIndex = i + batchIdx;
                if (globalIndex >= queries.length) return;
                
                if (onQueryProgress) onQueryProgress(query, globalIndex, queries.length, found.size);

                const data = await fetchSubredditSearchFast(query);
                if (!data) {
                    console.warn(`[redditDiscoverTool] all proxy sources failed for "${query}"`);
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
            })
        );
        
        if (i + BATCH < queries.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }
    return found;
}

export async function redditDiscoverTool(): Promise<Community[]> {
    const queries = await aiGenerateSearchQueries();
    console.log(`[redditDiscoverTool] Running ${queries.length} AI queries via parallel proxy race...`);
    
    const found = await searchRedditCommunities(queries);
    const all   = [...found.values()].sort((a, b) => b.subscribers - a.subscribers);

    if (all.length === 0) {
        throw new Error('Reddit search returned 0 communities — all proxy sources failed.');
    }

    console.log(`[redditDiscoverTool] Found ${all.length} unique communities`);
    return all;
}
