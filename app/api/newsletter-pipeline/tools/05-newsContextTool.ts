// Tool 5 — newsContextTool
// Uses Serper (Google Search API) to find real current articles
// specifically about the currency pair or macro event from Tool 4.
// Searches trusted forex news domains only — no generic finance noise.

import { fetchWithTimeout } from './base';
import type { DeepAnalysisResult } from './04-redditDeepAnalysisTool';

export interface NewsContext {
    query:          string;
    summary:        string;
    referenceLinks: Array<{ title: string; url: string; source: string }>;
}

// Trusted forex news domains — specific, relevant, no generic finance sites
const FOREX_DOMAINS = [
    'forexlive.com',
    'fxstreet.com',
    'dailyfx.com',
    'investing.com',
    'reuters.com/markets/currencies',
    'bloomberg.com/markets/currencies',
    'babypips.com',
    'financialjuice.com',
].join(' OR site:');

export async function newsContextTool(analysis: DeepAnalysisResult): Promise<NewsContext> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn('[newsContextTool] SERPER_API_KEY not set — skipping news fetch');
        return { query: analysis.currencyOrEvent, summary: '', referenceLinks: [] };
    }

    // Tool 4 guarantees currencyOrEvent is short — "XAUUSD", "EUR/USD", "NFP" etc.
    const query = analysis.currencyOrEvent || 'forex market';

    // Build a targeted Google search — current week, trusted forex domains only
    const searchQuery = `${query} site:${FOREX_DOMAINS}`;

    console.log(`[newsContextTool] Searching Serper for: "${query}"`);

    try {
        const res = await fetchWithTimeout('https://google.serper.dev/search', 15000, {
            method:  'POST',
            headers: {
                'X-API-KEY':    apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q:   searchQuery,
                num: 5,
                tbs: 'qdr:w', // past week only — current articles
                gl:  'us',
                hl:  'en',
            }),
        });

        if (!res.ok) {
            console.warn(`[newsContextTool] Serper returned ${res.status}`);
            return { query, summary: '', referenceLinks: [] };
        }

        const data = await res.json();
        const hits = (data.organic || []) as any[];

        if (hits.length === 0) {
            // Retry without domain restriction — same query, open web
            console.warn(`[newsContextTool] No results with domain filter — retrying open search`);
            return await searchOpenWeb(query, apiKey);
        }

        const referenceLinks = hits.slice(0, 5).map((h: any) => ({
            title:  (h.title   as string) || query,
            url:    (h.link    as string) || '#',
            source: (h.source  as string) || extractDomain(h.link),
        }));

        console.log(`[newsContextTool] Serper found ${referenceLinks.length} articles for "${query}":`,
            referenceLinks.map(l => l.source));

        return { query, summary: '', referenceLinks };

    } catch (e) {
        console.warn('[newsContextTool] Serper failed:', e);
        return { query, summary: '', referenceLinks: [] };
    }
}

// Fallback — open web search if domain-restricted search returns nothing
async function searchOpenWeb(query: string, apiKey: string): Promise<NewsContext> {
    try {
        const res = await fetchWithTimeout('https://google.serper.dev/search', 15000, {
            method:  'POST',
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q:   `${query} forex trading news analysis`,
                num: 5,
                tbs: 'qdr:w',
                gl:  'us',
                hl:  'en',
            }),
        });
        if (!res.ok) return { query, summary: '', referenceLinks: [] };
        const data = await res.json();
        const hits = (data.organic || []) as any[];
        const referenceLinks = hits.slice(0, 5).map((h: any) => ({
            title:  (h.title  as string) || query,
            url:    (h.link   as string) || '#',
            source: (h.source as string) || extractDomain(h.link),
        }));
        console.log(`[newsContextTool] Open search found ${referenceLinks.length} articles`);
        return { query, summary: '', referenceLinks };
    } catch (e) {
        console.warn('[newsContextTool] Open search also failed:', e);
        return { query, summary: '', referenceLinks: [] };
    }
}

function extractDomain(url: string): string {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return 'unknown'; }
}
