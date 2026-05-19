import { NextRequest, NextResponse } from 'next/server';

const AZURE_OPENAI_ENDPOINT   = process.env.AZURE_OPENAI_ENDPOINT  || '';
const AZURE_OPENAI_API_KEY    = process.env.AZURE_OPENAI_API_KEY   || '';
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT_RAG || 'gpt-4.1-rag-summary';

const REPORTER_API_URL      = process.env.REPORTER_API_URL      || 'https://newsrag-api-prod-global-ftheascbdfh9efe8.z03.azurefd.net/summarize';
const ECONOMIC_CALENDAR_URL = process.env.ECONOMIC_CALENDAR_URL || 'https://economiccalenderwrapper.azurewebsites.net/api/geteconomiccalendar';

// ── Call Azure OpenAI chat ─────────────────────────────────────────────────
async function callAzureChat(systemPrompt: string, userMessage: string, temperature = 0.5) {
    const url = `${AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-01`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'api-key': AZURE_OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userMessage  },
            ],
            temperature,
            max_tokens: 800,
        }),
    });
    if (!res.ok) throw new Error(`Azure OpenAI error: ${res.status} — ${await res.text()}`);
    const data = await res.json();
    return (data.choices[0].message.content as string).trim();
}

// ── Fetch live news ────────────────────────────────────────────────────────
async function fetchNews(): Promise<string[]> {
    const res = await fetch(REPORTER_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'forex news', use_cache: true, format: 'json' }),
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Reporter API ${res.status}`);
    const data = await res.json();
    const lines: string[] = [];
    if (data.summary) lines.push(data.summary);
    (data.keyPoints || []).forEach((p: string) => { if (p?.trim()) lines.push(p.trim()); });
    if (data.sentiment || data.impactLevel)
        lines.push(`Sentiment: ${data.sentiment} | Impact: ${data.impactLevel}`);
    return lines;
}

// ── Fetch economic calendar ────────────────────────────────────────────────
async function fetchCalendar(): Promise<string[]> {
    const res = await fetch(ECONOMIC_CALENDAR_URL, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Calendar API ${res.status}`);
    const data = await res.json();
    const raw  = Array.isArray(data) ? data : (data.data || data.events || data.items || []);
    return (raw as any[]).slice(0, 10).map((ev: any) => {
        if (typeof ev === 'string') return ev;
        const parts = [
            ev.country || ev.currency,
            ev.title   || ev.event || ev.name,
            ev.impact  || ev.importance,
            ev.date    || ev.time  || ev.datetime,
        ];
        if (ev.forecast) parts.push(`Forecast: ${ev.forecast}`);
        if (ev.previous) parts.push(`Prev: ${ev.previous}`);
        return parts.filter(Boolean).join(' | ');
    });
}

// ── POST /api/edu-content ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { step } = body as { step: string; [k: string]: any };

        // ── 1. Pick topic via GPT ─────────────────────────────────────────────
        if (step === 'topic') {
            const [news, calendar] = await Promise.all([fetchNews(), fetchCalendar()]);

            const userMessage = `TODAY'S NEWS:\n${news.map(h => `- ${h}`).join('\n')}\n\nECONOMIC CALENDAR:\n${calendar.map(e => `- ${e}`).join('\n')}\n\nPick 1 best trading concept to teach today.`;

            let raw = await callAzureChat(body.topicPrompt, userMessage, 0.4);

            if (raw.startsWith('```')) {
                raw = raw.split('```')[1];
                if (raw.startsWith('json')) raw = raw.slice(4);
            }
            raw = raw.trim();

            let topics = JSON.parse(raw);
            if (!Array.isArray(topics)) topics = [topics];
            const topic = topics[0];

            return NextResponse.json({ ok: true, topic, news, calendar });
        }

        // ── 2. Generate lesson + image prompt ────────────────────────────────
        if (step === 'lesson') {
            const { lessonPrompt, topic, difficulty } = body;
            const lesson = await callAzureChat(
                lessonPrompt,
                `Topic: ${topic}\nDifficulty: ${difficulty}\nCreate a lesson and image prompt.`,
                0.7,
            );
            return NextResponse.json({ ok: true, lesson });
        }

        // ── 3. Return image API config (keys stay server-side) ────────────────
        if (step === 'image-config') {
            const apiKey     = process.env.AZURE_IMAGE_API_KEY || process.env.AZURE_API_KEY || '';
            const endpoint   = process.env.AZURE_IMAGE_ENDPOINT || process.env.AZURE_ENDPOINT || '';
            const deployment = process.env.AZURE_IMAGE_DEPLOYMENT || process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT_NAME || 'gpt-image-2';
            if (!apiKey || !endpoint)
                return NextResponse.json({ error: 'Image API not configured' }, { status: 500 });
            return NextResponse.json({
                url: `${endpoint.replace(/\/$/, '')}/openai/v1/images/generations`,
                apiKey,
                deployment,
            });
        }

        return NextResponse.json({ error: 'Unknown step' }, { status: 400 });
    } catch (e: any) {
        console.error('[edu-content]', e);
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}
