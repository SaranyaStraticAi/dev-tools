// Tool 5 — newsContextTool (v3)
// FIX 1: Smart search query — psychological pain uses targeted query not generic "forex market"
// FIX 2: Fetches actual article content from each URL — not just titles and links
// FIX 3: Filters out irrelevant articles before passing to Tool 6
// FIX 4: Drops articles with no content — never passes empty sources to Tool 6

import { fetchWithTimeout } from './base';
import type { DeepAnalysisResult } from './04-redditDeepAnalysisTool';

export interface NewsArticle {
    title:   string;
    url:     string;
    source:  string;
    content: string;
}

export interface NewsContext {
    query:          string;
    summary:        string;
    referenceLinks: NewsArticle[];
}

// Trusted forex news domains — domain-restricted search runs first
const FOREX_DOMAINS = [
    'forexlive.com',
    'fxstreet.com',
    'dailyfx.com',
    'investing.com',
    'reuters.com',
    'bloomberg.com',
    'financialjuice.com',
    'tradingpsychologyedge.com',
    'thebalancemoney.com',
].join(' OR site:');

// Psychology keywords — detect psych pain to use better search query
const PSYCH_KEYWORDS = [
    'psycholog', 'emotion', 'discipline', 'revenge trad', 'fomo', 'blown account',
    'mindset', 'fear', 'greed', 'anxiety', 'impulsive', 'overtrading', 'tilt',
    'panic', 'frustrat', 'self-control', 'behavior', 'behaviour',
];

// Forex keywords — article must contain at least one to pass relevance check
const FOREX_KEYWORDS = [
    'forex', 'currency', 'EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD',
    'XAU', 'gold', 'crude oil', 'NFP', 'FOMC', 'CPI', 'interest rate',
    'pip', 'spread', 'retail trader', 'central bank', 'exchange rate',
    'US30', 'NAS100', 'indices', 'non-farm', 'payroll', 'federal reserve',
    'ECB', 'BOE', 'BOJ', 'monetary policy', 'fx market', 'trading psychology',
    'risk management', 'position sizing', 'stop loss', 'drawdown',
];

// FIX 1: Build the right search query based on pain type
// Psychology pain: "forex market forex trading" returns babypips educational pages
// Use specific targeted query instead
function buildSearchQuery(rawQuery: string, dominantPain: string): string {
    const painLower = dominantPain.toLowerCase();
    const isPsych   = PSYCH_KEYWORDS.some(kw => painLower.includes(kw));
    if (isPsych || rawQuery === 'forex market') {
        return 'forex trading psychology risk management emotional discipline';
    }
    return `${rawQuery} forex trading`;
}

function stripHtml(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[\s\S]*?<\/aside>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function truncateWords(text: string, maxWords = 800): string {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
}

function isForexRelevant(text: string, query: string): boolean {
    const lower = text.toLowerCase();
    if (lower.includes(query.toLowerCase())) return true;
    return FOREX_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

async function fetchArticleContent(url: string): Promise<string> {
    try {
        const res = await fetchWithTimeout(url, 8000, {
            headers: {
                'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept':          'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            cache: 'no-store',
        });
        if (!res.ok) { console.warn(`[newsContextTool] HTTP ${res.status} for ${url}`); return ''; }
        const html = await res.text();
        return truncateWords(stripHtml(html), 800);
    } catch (e) {
        console.warn(`[newsContextTool] fetch failed for ${url}:`, (e as Error).message);
        return '';
    }
}

async function searchSerper(q: string, apiKey: string): Promise<any[]> {
    try {
        const res = await fetchWithTimeout('https://google.serper.dev/search', 15000, {
            method:  'POST',
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q, num: 7, tbs: 'qdr:w', gl: 'us', hl: 'en' }),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.organic || []) as any[];
    } catch (e) { console.warn('[newsContextTool] Serper failed:', e); return []; }
}

function extractDomain(url: string): string {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return 'unknown'; }
}

export async function newsContextTool(analysis: DeepAnalysisResult): Promise<NewsContext> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn('[newsContextTool] SERPER_API_KEY not set — skipping');
        return { query: analysis.currencyOrEvent, summary: '', referenceLinks: [] };
    }

    const rawQuery  = analysis.currencyOrEvent || 'forex market';
    const painTheme = analysis.dominantPainTheme || '';

    // FIX 1: Smart query based on pain type
    const searchQuery = buildSearchQuery(rawQuery, painTheme);
    console.log(`[newsContextTool] Searching: "${searchQuery}" (past week only)`);

    // Step 1: Domain-restricted search first
    let hits = await searchSerper(`${searchQuery} site:${FOREX_DOMAINS}`, apiKey);

    // Step 2: Open web fallback
    if (hits.length === 0) {
        console.warn('[newsContextTool] No domain results — trying open web');
        hits = await searchSerper(searchQuery, apiKey);
    }
    if (hits.length === 0) {
        console.warn('[newsContextTool] No results for:', searchQuery);
        return { query: rawQuery, summary: '', referenceLinks: [] };
    }

    console.log(`[newsContextTool] Got ${hits.length} results — fetching content...`);

    // FIX 2: Fetch actual article content (6 candidates, parallel, 8s timeout each)
    const articles: NewsArticle[] = await Promise.all(
        hits.slice(0, 6).map(async (h: any): Promise<NewsArticle> => {
            const url = (h.link as string) || '#';
            let content = await fetchArticleContent(url);
            
            // Fallback: If scraper is blocked (403/401) or returns no content, use the Google snippet
            if (!content || content.trim().length < 100) {
                content = (h.snippet as string) || '';
            }
            
            return {
                url,
                title:   (h.title  as string) || rawQuery,
                source:  (h.source as string) || extractDomain(url),
                content,
            };
        }),
    );

    // FIX 3: Filter irrelevant articles
    const relevant = articles.filter(a => {
        const passes = isForexRelevant(`${a.title} ${a.content}`, rawQuery);
        if (!passes) console.warn(`[newsContextTool] Filtered irrelevant: "${a.title}"`);
        return passes;
    });

    // FIX 4: Drop articles with no content — lowered limit to 20 to support snippets
    const withContent = (relevant.length > 0 ? relevant : articles)
        .filter(a => {
            const ok = a.content.trim().length > 20;
            if (!ok) console.warn(`[newsContextTool] Dropped (no content): "${a.title}" (${a.source})`);
            return ok;
        });

    const finalArticles = withContent.length > 0 ? withContent : [];

    console.log(
        `[newsContextTool] Final: ${finalArticles.length} articles with content —`,
        finalArticles.map(a => `${a.source} (${a.content.split(' ').length}w)`),
    );

    return { query: rawQuery, summary: '', referenceLinks: finalArticles };
}
