// app/api/twitter-polls/generate/route.ts
// POST → SSE stream
// Fetches news via NEWSFEED_API_URL + economic calendar, then calls GPT-4.1.
// Accepts optional { systemPrompt } in body so the prompt editor can override it.

import { NextRequest } from 'next/server';
import { nanoid }      from 'nanoid';
import { callAI, parseJSON } from '../../newsletter-pipeline/tools/base';
import { PollQueue }   from '@/lib/twitter-poll-queue';
import type { TwitterPoll, PollAngle } from '@/lib/twitter-poll-queue';

export const maxDuration = 60;

// ── Default prompts ───────────────────────────────────────────────────────────
// Both are exported so page.tsx can seed the editors.
// {{TODAY}} and {{CONTEXT}} are replaced at runtime.

export const DEFAULT_SYSTEM_PROMPT =
`You are a financial content strategist creating engaging Twitter poll questions for VibeTrader — an AI-powered forex and trading platform used by retail traders worldwide.

Today's date: {{TODAY}}

Generate EXACTLY 3 poll objects. One per angle:
1. "directional"  — price direction for a specific pair/asset (e.g. "Will EUR/USD close higher today?")
2. "comparative"  — which of two assets/pairs will outperform (e.g. "Gold vs Bitcoin — which wins this week?")
3. "sentiment"    — trader opinion or market mood (e.g. "What's your biggest risk right now?")

TWITTER HARD LIMITS:
• question: MAX 140 chars
• Each option: MAX 25 chars
• 2–4 options per poll

Return ONLY a JSON array, no markdown, no extra text:
[
  {
    "question":  "Will EUR/USD close higher today?",
    "options":   ["Yes, higher", "No, lower", "Flat"],
    "hashtags":  ["Forex", "EURUSD", "ForexTrading"],
    "cashtags":  ["EURUSD", "DXY"],
    "angle":     "directional",
    "topicKey":  "eurusd-directional",
    "rationale": "CPI data today may push DXY (max 120 chars)"
  },
  ...2 more...
]

RULES:
• hashtags: 3–5, NO # prefix
• cashtags: 1–3, NO $ prefix
• topicKey: lowercase slug, format "{asset}-{angle}"
• Questions must be SPECIFIC to today's actual news — not generic filler`;

export const DEFAULT_USER_PROMPT =
`Today's market context:

{{CONTEXT}}

Generate 3 poll questions (one directional, one comparative, one sentiment) as a JSON array.`;

// ── Load prompts from Azure Blob (falls back to hardcoded defaults) ───────────
async function loadPromptsFromBlob(requestUrl: string): Promise<{
    systemPrompt: string;
    userPrompt:   string;
    source:       'blob' | 'default';
}> {
    try {
        const base   = new URL(requestUrl);
        const apiUrl = `${base.protocol}//${base.host}/api/twitter-poll-prompts`;
        const res    = await fetch(apiUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`twitter-poll-prompts API returned ${res.status}`);
        const data = await res.json();
        if (!data?.exists || !data?.prompts) throw new Error('No saved prompts in Blob yet');
        const { twitterPollSystem, twitterPollUser } = data.prompts;
        if (!twitterPollSystem || !twitterPollUser) throw new Error('Blob prompts missing fields');
        console.log('[twitter-polls] Loaded prompts from Azure Blob ✓');
        return { systemPrompt: twitterPollSystem, userPrompt: twitterPollUser, source: 'blob' };
    } catch (e: any) {
        console.warn('[twitter-polls] Blob prompt load failed — using defaults:', e.message);
        return { systemPrompt: DEFAULT_SYSTEM_PROMPT, userPrompt: DEFAULT_USER_PROMPT, source: 'default' };
    }
}

// ── News fetcher: NEWSFEED_API_URL (custom Azure Function) ───────────────────
// Response shape: { items: [{ headline, market_impact, published_at, ... }], pagination: {...} }

async function fetchTopNews(): Promise<string[]> {
    const baseUrl = process.env.NEWSFEED_API_URL;
    if (!baseUrl) {
        console.warn('[twitter-polls] NEWSFEED_API_URL not set');
        return [];
    }
    try {
        const url = new URL(`${baseUrl}/news_feed`);
        url.searchParams.set('limit', '10');
        url.searchParams.set('impact', 'High');
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
            console.error(`[twitter-polls] News feed returned ${res.status}`);
            return [];
        }
        const data = await res.json();
        // Response: { items: [{ headline, market_impact, published_at, ... }] }
        const items: { headline?: string }[] = data.items ?? [];
        const titles = items.slice(0, 8).map((n) => n.headline ?? '').filter(Boolean);
        console.log(`[twitter-polls] Fetched ${titles.length} headlines from newsfeed`);
        return titles;
    } catch (err) {
        console.error('[twitter-polls] News fetch failed:', err);
        return [];
    }
}

// ── Calendar fetcher ──────────────────────────────────────────────────────────

async function fetchCalendarEvents(): Promise<string[]> {
    const url = process.env.ECONOMIC_CALENDAR;
    if (!url) return [];
    try {
        const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return [];
        const data = await res.json();

        // Unwrap — try multiple shapes
        let items: Record<string, unknown>[] = [];
        if (Array.isArray(data))              items = data;
        else if (Array.isArray(data.events))  items = data.events;
        else if (Array.isArray(data.data))    items = data.data;
        else if (Array.isArray(data.results)) items = data.results;

        const today = new Date().toISOString().slice(0, 10);

        const filtered = items.filter((e) => {
            const impact = ((e.impact ?? e.importance ?? '') as string).toLowerCase();
            const date   = (e.date ?? e.eventDate ?? e.time ?? '') as string;
            return impact === 'high' && String(date).startsWith(today);
        });

        return filtered
            .slice(0, 6)
            .map((e) => (e.name ?? e.event ?? e.title ?? '') as string)
            .filter(Boolean);
    } catch { return []; }
}

// ── SSE handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const body         = await req.json().catch(() => ({}));
    const overrideSys  = typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : '';
    const overrideUser = typeof body.userPrompt   === 'string' ? body.userPrompt.trim()   : '';
    const today        = new Date().toISOString().slice(0, 10);

    const encoder = new TextEncoder();
    const stream  = new ReadableStream({
        async start(controller) {
            function send(step: string, status: string, data?: unknown) {
                controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ step, status, data })}\n\n`
                ));
            }

            try {
                // Step 1 — load prompts from Blob (or fall back to defaults)
                send('prompts', 'running', { message: 'Loading prompts from Azure Blob...' });
                const savedPrompts = await loadPromptsFromBlob(req.url);
                send('prompts', 'done', {
                    message: savedPrompts.source === 'blob'
                        ? 'Prompts loaded from Azure Blob ✓'
                        : 'No saved prompts — using defaults',
                    source: savedPrompts.source,
                });

                // Step 2 — fetch context
                send('context', 'running', { message: 'Fetching news from newsfeed + economic calendar...' });
                const [headlines, events] = await Promise.all([fetchTopNews(), fetchCalendarEvents()]);
                send('context', 'done', {
                    message: `${headlines.length} headlines, ${events.length} calendar events`,
                    headlines, events,
                });

                // Step 3 — build context string (injected into {{CONTEXT}})
                const lines: string[] = [];
                if (headlines.length > 0) {
                    lines.push('TOP MARKET NEWS TODAY:');
                    headlines.forEach((h, i) => lines.push(`${i + 1}. ${h}`));
                } else {
                    lines.push('No live news fetched — use your knowledge of current forex/market conditions.');
                }
                lines.push('');
                if (events.length > 0) {
                    lines.push('HIGH-IMPACT ECONOMIC EVENTS TODAY:');
                    events.forEach((e) => lines.push(`• ${e}`));
                } else {
                    lines.push('No high-impact economic events scheduled today.');
                }
                const contextString = lines.join('\n');

                // Step 4 — AI generation
                // Override order: body param > Blob > hardcoded default
                send('ai', 'running', { message: 'Generating 3 poll questions via GPT-4.1...' });

                const systemPrompt = (overrideSys  || savedPrompts.systemPrompt)
                    .replace('{{TODAY}}', today);

                const userPrompt   = (overrideUser || savedPrompts.userPrompt)
                    .replace('{{CONTEXT}}', contextString)
                    .replace('{{TODAY}}',   today);

                const rawOutput = await callAI(systemPrompt, userPrompt, 0.4);

                let parsed: Array<{
                    question: string; options: string[];
                    hashtags: string[]; cashtags: string[];
                    angle: PollAngle; topicKey: string; rationale: string;
                }>;

                try {
                    parsed = parseJSON(rawOutput);
                    if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
                } catch (err) {
                    send('ai', 'error', { message: `AI returned invalid JSON: ${String(err)}`, raw: rawOutput });
                    controller.close();
                    return;
                }
                send('ai', 'done', { message: `AI generated ${parsed.length} poll(s)` });

                // Step 4 — save
                send('save', 'running', { message: 'Saving to review queue...' });
                const polls: TwitterPoll[] = [];

                for (const raw of parsed) {
                    if (!raw.question || !Array.isArray(raw.options)) continue;
                    polls.push({
                        id:        nanoid(),
                        status:    'pending_review',
                        question:  raw.question.slice(0, 140),
                        options:   raw.options.map((o) => String(o).slice(0, 25)),
                        hashtags:  raw.hashtags  ?? [],
                        cashtags:  raw.cashtags  ?? [],
                        angle:     raw.angle,
                        topicKey:  raw.topicKey,
                        rationale: raw.rationale ?? '',
                        headlines, events,
                        createdAt: new Date().toISOString(),
                    });
                }

                await Promise.all(polls.map((p) => PollQueue.save(p)));

                send('save', 'done', { message: `${polls.length} poll(s) saved to review queue` });
                send('complete', 'done', { polls });
                controller.close();

            } catch (err: any) {
                controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ step: 'error', status: 'error', message: err.message })}\n\n`
                ));
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
}
