// Tool 2 — llmPickSubredditsTool
// Receives full community list from Tool 1, AI picks ALL relevant ones.
// No hardcoded count limit — AI decides how many are worth using.

import { callAI, parseJSON } from './base';
import type { Community } from './01-redditDiscoverTool';



export const LLM_PICK_SYSTEM_PROMPT = `You are a content strategist for Vibe Trader Weekly — a newsletter specifically for FOREX and active RETAIL TRADERS who trade currency pairs, indices, and commodities with real money.

Your job: from the list below, select ONLY the communities where people actively discuss:
- Forex currency pair trading (EUR/USD, GBP/JPY, XAU/USD etc.)
- Day trading, swing trading, scalping with real money
- Trading psychology, losses, discipline, emotional struggles
- Prop firms and funded accounts (FTMO, Apex, TopStep etc.)
- Technical analysis, price action, SMC, ICT strategies
- Algorithmic and systematic trading
- Risk management, position sizing
- Futures trading (not crypto futures)
- Broker issues, spreads, slippage, withdrawals

STRICTLY EXCLUDE:
- wallstreetbets, WallStreetbetsELITE, or any meme stock community
- stocks, StockMarket, pennystocks, investing — pure stock market communities
- Any crypto or cryptocurrency trading community
- binaryoptions
- Indian, Philippine, or any country-specific stock market communities
- finance, personalfinance — general finance not active trading
- Any buy-and-hold, long-term investing, or passive income community
- Any community with "cracked", "free", "leaked", "pirat" in the name
- Any community promoting scams, signals sellers, or get-rich-quick schemes

ONLY include communities where the PRIMARY topic is active forex/retail trading with real money.
Do NOT set an artificial limit — include every relevant community regardless of how many.
Return subreddit names WITHOUT the r/ prefix.

Respond ONLY with a valid JSON array of subreddit name strings. No markdown, no explanation.`;

export const LLM_PICK_USER_TEMPLATE = `Here are Reddit communities discovered by searching for trading topics.
Select ONLY the ones focused on active forex, currency, and retail trading.
Strictly exclude meme stocks, crypto, country-specific stock markets, and general investing.

{communityList}

Return a JSON array of subreddit names only — no r/ prefix.`;

export async function llmPickSubredditsTool(
    communities: Community[],
    options?: { systemPrompt?: string; userTemplate?: string }
): Promise<string[]> {
    if (communities.length === 0) return [];

    const candidates = communities
        .sort((a, b) => b.subscribers - a.subscribers)
        .slice(0, 100);

    const communityList = candidates
        .map(c => `r/${c.name} | ${c.subscribers.toLocaleString()} members | ${c.description || 'No description'}`)
        .join('\n');

    const sys = options?.systemPrompt || LLM_PICK_SYSTEM_PROMPT;
    const tmpl = options?.userTemplate || LLM_PICK_USER_TEMPLATE;
    const raw    = await callAI(sys, tmpl.replace('{communityList}', communityList), 0.1);
    const picked = parseJSON<string[]>(raw);
    if (!Array.isArray(picked)) throw new Error('LLM did not return a JSON array');

    const cleaned = picked
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map(s => s.replace(/^r\//i, '').trim());

    console.log(`[llmPickSubredditsTool] LLM selected ${cleaned.length} from ${candidates.length} candidates (${communities.length} total found):`, cleaned);
    return cleaned;
}
