// Tool 5 — newsContextTool (v2)
// FIX 1: Always appends "forex trading" to search queries — stops unrelated results
//         e.g. "NFP" alone returns Sampoorna Foods. "NFP forex trading" = Non-Farm Payroll.
// FIX 2: Fetches actual article content from each URL — not just titles and links
// FIX 3: Filters out irrelevant articles before passing to Tool 6

import { fetchWithTimeout } from './base';
import type { DeepAnalysisResult } from './04-redditDeepAnalysisTool';

export interface NewsArticle {
    title:   string;
    url:     string;
    source:  string;
    content: string; // actual article text — empty string if fetch failed or paywalled
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
    'babypips.com',
    'financialjuice.com',
].join(' OR site:');

// Forex keywords — article must contain at least one to pass relevance check
const FOREX_KEYWORDS = [
    'forex', 'currency', 'EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD',
    'XAU', 'gold', 'crude oil', 'NFP', 'FOMC', 'CPI', 'interest rate',
    'pip', 'spread', 'retail trader', 'central bank', 'exchange rate',
    'US30', 'NAS100', 'indices', 'non-farm', 'payroll', 'federal reserve',
    'ECB', 'BOE', 'BOJ', 'monetary policy', 'fx market',
];


// Strip all HTML tags and noise — return clean readable text
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

// Truncate to first N words — keeps token usage under control in Tool 6
function truncateWords(text: string, maxWords = 800): string {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
}

// Check if article text is actually about forex trading
function isForexRelevant(text: string, query: string): boolean {
    const lower = text.toLowerCase();
    if (lower.includes(query.toLowerCase())) return true;
    return FOREX_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

// Fetch and extract plain text from a single article URL
// Returns empty string if paywalled, blocked, or times out
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
        if (!res.ok) {
            console.warn(`[newsContextTool] HTTP ${res.status} for ${url}`);
            return '';
        }
        const html = await res.text();
        const text = stripHtml(html);
        return truncateWords(text, 800);
    } catch (e) {
        console.warn(`[newsContextTool] fetchArticleContent failed for ${url}:`, (e as Error).message);
        return '';
    }
}

// Hit Serper search API — returns raw organic results array
async function searchSerper(q: string, apiKey: string): Promise<any[]> {
    try {
        const res = await fetchWithTimeout('https://google.serper.dev/search', 15000, {
            method:  'POST',
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q,
                num: 7,
                tbs: 'qdr:w', // past week only
                gl:  'us',
                hl:  'en',
            }),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.organic || []) as any[];
    } catch (e) {
        console.warn('[newsContextTool] Serper fetch failed:', e);
        return [];
    }
}

function extractDomain(url: string): string {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return 'unknown'; }
}


export async function newsContextTool(analysis: DeepAnalysisResult): Promise<NewsContext> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn('[newsContextTool] SERPER_API_KEY not set — skipping news fetch');
        return { query: analysis.currencyOrEvent, summary: '', referenceLinks: [] };
    }

    const rawQuery = analysis.currencyOrEvent || 'forex market';

    // ── FIX 1: Always append "forex trading" to anchor the search ────────────
    // Without this, "NFP" returns Sampoorna Foods, "gold" returns jewellery etc.
    const forexQuery = `${rawQuery} forex trading`;
    console.log(`[newsContextTool] Searching: "${forexQuery}" (past week only)`);

    // ── Step 1: Try trusted domain search first ───────────────────────────────
    let hits = await searchSerper(`${forexQuery} site:${FOREX_DOMAINS}`, apiKey);

    // ── Step 2: Fallback to open web if domain search returns nothing ─────────
    if (hits.length === 0) {
        console.warn('[newsContextTool] No domain results — trying open web');
        hits = await searchSerper(forexQuery, apiKey);
    }

    if (hits.length === 0) {
        console.warn('[newsContextTool] No results at all for:', forexQuery);
        return { query: rawQuery, summary: '', referenceLinks: [] };
    }

    console.log(`[newsContextTool] Got ${hits.length} results — fetching article content...`);

    // ── FIX 2: Fetch actual article content ───────────────────────────────────
    // Each article fetched in parallel with an 8s timeout
    const candidates = hits.slice(0, 5);
    const articles: NewsArticle[] = await Promise.all(
        candidates.map(async (h: any): Promise<NewsArticle> => {
            const url     = (h.link   as string) || '#';
            const title   = (h.title  as string) || rawQuery;
            const source  = (h.source as string) || extractDomain(url);
            const content = await fetchArticleContent(url);
            return { title, url, source, content };
        }),
    );

    // ── FIX 3: Filter irrelevant articles ─────────────────────────────────────
    // Discard anything that doesn't mention forex/trading/the query term
    const relevant = articles.filter(a => {
        const passes = isForexRelevant(`${a.title} ${a.content}`, rawQuery);
        if (!passes) console.warn(`[newsContextTool] Filtered out: "${a.title}" (${a.source})`);
        return passes;
    });

    // Fall back to all articles if filter removed everything — better than empty
    const finalArticles = relevant.length > 0 ? relevant : articles;

    console.log(
        `[newsContextTool] Final: ${finalArticles.length} articles —`,
        finalArticles.map(a => `${a.source} (${a.content ? a.content.split(' ').length + 'w' : 'no content'})`),
    );

    return { query: rawQuery, summary: '', referenceLinks: finalArticles };
}
