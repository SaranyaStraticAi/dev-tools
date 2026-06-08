import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

// ─────────────────────────────────────────────────────────────────────────────
// Reddit posts — fully AI-driven, zero hardcoded subreddits.
//
// Flow:
//   1. DISCOVER  — hit Reddit's own /subreddits/search.json with topic queries.
//                  Gets back real community names + subscriber counts + descriptions.
//   2. LLM PICK  — send all discovered communities to Azure OpenAI.
//                  AI reads descriptions and picks the best ones for a
//                  forex/trading newsletter. No hardcoding — AI decides.
//   3. FETCH     — get top posts from the AI-chosen subreddits in parallel.
//   4. CACHE     — discovered subreddit list cached 7 days in Azure Blob.
//                  Posts cached per fetch.
//
// GET  (no params)    → discover → LLM pick → fetch posts
// GET  ?cached=1      → return last cached posts from blob
// GET  ?rediscover=1  → force fresh discovery even if cache is valid
// POST                → save a posts batch to blob
// ─────────────────────────────────────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

const BLOB_CONTAINER = 'newsletter-prompts';
const BLOB_POSTS_NAME = 'reddit-posts-cache.json';
const BLOB_SUBS_NAME = 'reddit-discovered-subs.json';
const SUBS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Safety fallback — only used if Reddit search AND LLM both fail completely
const FALLBACK_SUBS = ['Forex', 'Daytrading', 'trading', 'algotrading', 'technicalanalysis'];

// ── Azure Blob helpers ────────────────────────────────────────────────────────

function getContainerClient() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    return BlobServiceClient.fromConnectionString(connStr).getContainerClient(BLOB_CONTAINER);
}

async function readBlob(name: string): Promise<any | null> {
    try {
        const blob = getContainerClient().getBlockBlobClient(name);
        if (!(await blob.exists())) return null;
        return JSON.parse((await blob.downloadToBuffer()).toString('utf-8'));
    } catch { return null; }
}

async function writeBlob(name: string, payload: object): Promise<void> {
    try {
        const container = getContainerClient();
        await container.createIfNotExists({ access: 'blob' });
        const str = JSON.stringify(payload);
        const blob = container.getBlockBlobClient(name);
        await blob.upload(Buffer.from(str), Buffer.byteLength(str), {
            blobHTTPHeaders: { blobContentType: 'application/json' },
            overwrite: true,
        } as any);
    } catch (e) { console.warn('[writeBlob] failed:', e); }
}

// ── Azure OpenAI helper ───────────────────────────────────────────────────────

function getAzureConfig() {
    const apiKey = process.env.AZURE_OPENAI_API_KEY || '';
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
        || process.env.AZURE_OPENAI_DEPLOYMENT_RAG
        || 'gpt-4.1-rag-summary';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';
    let resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME || '';
    if (!resourceName && endpoint) {
        try { resourceName = new URL(endpoint).hostname.split('.')[0]; } catch { }
    }
    return { apiKey, resourceName, deployment, apiVersion };
}

async function callAzureOpenAI(system: string, user: string): Promise<string> {
    const { apiKey, resourceName, deployment, apiVersion } = getAzureConfig();
    if (!apiKey || !resourceName) throw new Error('Azure OpenAI credentials missing');
    const url = `https://${resourceName}.openai.azure.com/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            temperature: 0.1,
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Azure error ${res.status}`);
    return data.choices[0].message.content as string;
}

// ── Step 1: Discover communities from Reddit's own search API ─────────────────
// No hardcoded subreddit names here — Reddit search decides what exists.

async function discoverCommunities(): Promise<Array<{ name: string; subscribers: number; description: string }>> {
    const topics = ['forex trading', 'day trading', 'algorithmic trading', 'technical analysis trading'];
    const found = new Map<string, { name: string; subscribers: number; description: string }>();

    await Promise.allSettled(topics.map(async (topic) => {
        try {
            const url = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(topic)}&limit=15&sort=relevance`;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT },
                cache: 'no-store',
                signal: controller.signal,
            });
            clearTimeout(timer);
            if (!res.ok) return;
            const data = await res.json();
            for (const item of (data?.data?.children || [])) {
                const d = item.data;
                if (d?.display_name && d?.subscribers > 500 && !found.has(d.display_name)) {
                    found.set(d.display_name, {
                        name: d.display_name as string,
                        subscribers: d.subscribers as number,
                        description: ((d.public_description || d.title || '') as string).slice(0, 150),
                    });
                }
            }
        } catch { /* one topic failing is fine */ }
    }));

    return [...found.values()].sort((a, b) => b.subscribers - a.subscribers);
}

// ── Step 2: LLM picks the best communities ────────────────────────────────────
// AI reads real community data from Reddit and decides which ones to use.
// Zero hardcoding — the LLM makes the call.

async function llmPickCommunities(communities: Array<{ name: string; subscribers: number; description: string }>): Promise<string[]> {
    const candidateList = communities
        .slice(0, 35) // give LLM top 35 by subscribers to choose from
        .map(c => `r/${c.name} (${c.subscribers.toLocaleString()} members): ${c.description || 'No description'}`)
        .join('\n');

    const system = `You are a content strategist for a forex and retail trading newsletter.
You must select Reddit communities to monitor for trending trader discussions, pain points, and market talk.
Respond ONLY with a valid JSON array of subreddit name strings. No markdown, no explanation, no backticks.
Example output: ["Forex","Daytrading","algotrading"]`;

    const user = `Below are Reddit communities discovered by searching for trading topics.
Pick the 8 to 12 best subreddits for a forex/retail trading newsletter that wants:
- Real trader pain, losses, wins, emotions
- Forex currency pair discussions
- Technical analysis, chart setups
- Algorithmic and systematic trading
- General retail trading conversation

Exclude: meme stocks only, crypto only, gambling, investing-only, very niche or inactive subs.

Communities found by Reddit search:
${candidateList}

Return ONLY a JSON array of subreddit name strings.`;

    const raw = await callAzureOpenAI(system, user);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed) || parsed.length < 2) throw new Error('LLM returned invalid list');
    return parsed.filter((s): s is string => typeof s === 'string' && s.length > 0);
}

// ── Step 3: Get final subreddit list (cache → discover → LLM pick) ────────────

async function getSubreddits(forceRediscover: boolean): Promise<{ subs: string[]; source: string }> {

    // Check blob cache first (skip if forced rediscover)
    if (!forceRediscover) {
        const cached = await readBlob(BLOB_SUBS_NAME);
        if (cached?.subs?.length > 0) {
            const age = Date.now() - new Date(cached.discoveredAt).getTime();
            if (age < SUBS_CACHE_TTL_MS) {
                console.log(`[reddit] Using cached subs (${Math.round(age / 3600000)}h old):`, cached.subs);
                return { subs: cached.subs, source: 'blob-cached' };
            }
            console.log('[reddit] Cached subs stale (>7 days), rediscovering...');
        }
    }

    // Step 1: Hit Reddit search API
    const communities = await discoverCommunities();
    console.log(`[reddit] Reddit search found ${communities.length} communities`);

    if (communities.length === 0) {
        console.warn('[reddit] Reddit search returned nothing, using fallback');
        return { subs: FALLBACK_SUBS, source: 'hardcoded-fallback' };
    }

    // Step 2: LLM picks from what Reddit returned
    try {
        const picked = await llmPickCommunities(communities);
        console.log('[reddit] LLM picked:', picked);

        // Save to blob for 7 days
        await writeBlob(BLOB_SUBS_NAME, {
            subs: picked,
            source: 'llm-picked',
            discoveredAt: new Date().toISOString(),
            candidateCount: communities.length,
        });

        return { subs: picked, source: 'llm-picked' };
    } catch (e) {
        console.warn('[reddit] LLM pick failed, using top communities by subscribers:', e);
        // LLM failed → just take top 10 by subscriber count from what Reddit returned
        const topBySubs = communities.slice(0, 10).map(c => c.name);
        return { subs: topBySubs, source: 'subscriber-fallback' };
    }
}

// ── Step 4: Fetch posts from a single subreddit (with CORS-proxy fallbacks) ───

async function fetchSubreddit(subreddit: string, timeframe: string, perSubLimit: number): Promise<any[]> {
    const targetUrl = `https://www.reddit.com/r/${subreddit}/top.json?t=${timeframe}&limit=${perSubLimit}`;
    const sources = [
        targetUrl,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    ];

    for (const url of sources) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT },
                cache: 'no-store',
                signal: controller.signal,
            });
            clearTimeout(timer);
            if (!res.ok) continue;
            const text = await res.text();
            if (!text?.trim()) continue;
            const parsed = JSON.parse(text);
            if (!parsed?.data?.children) continue;

            return (parsed.data.children as any[]).map((item: any) => {
                const p = item.data;
                return {
                    subreddit,
                    title: p.title as string,
                    selftext: (p.selftext as string) || '',
                    upvotes: p.ups as number,
                    comments: p.num_comments as number,
                    author: p.author as string,
                    flair: (p.link_flair_text as string) || 'General',
                    url: `https://reddit.com${p.permalink as string}`,
                    created_utc: new Date((p.created_utc as number) * 1000)
                        .toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
                };
            });
        } catch { /* try next source */ }
    }
    return [];
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const cached = searchParams.get('cached') === '1';
    const forceRediscover = searchParams.get('rediscover') === '1';
    const timeframe = searchParams.get('t') || 'week';
    const finalLimit = parseInt(searchParams.get('limit') || '10', 10);
    const perSubLimit = parseInt(searchParams.get('perSub') || '25', 10);

    // Return cached posts from blob
    if (cached) {
        const data = await readBlob(BLOB_POSTS_NAME);
        if (!data) return NextResponse.json({ exists: false, posts: null });
        return NextResponse.json({ exists: true, ...data });
    }

    // Step 1+2: Discover communities + LLM picks the best ones
    let subreddits: string[];
    let subsSource: string;
    try {
        const result = await getSubreddits(forceRediscover);
        subreddits = result.subs;
        subsSource = result.source;
    } catch (e) {
        console.warn('[reddit] getSubreddits threw, using fallback:', e);
        subreddits = FALLBACK_SUBS;
        subsSource = 'hardcoded-fallback';
    }

    // Step 3: Fetch posts from LLM-chosen subreddits in parallel
    const results = await Promise.allSettled(
        subreddits.map(sub => fetchSubreddit(sub, timeframe, perSubLimit))
    );

    const allPosts: any[] = [];
    const fetchedFrom: string[] = [];
    const failedFrom: string[] = [];

    results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
            allPosts.push(...result.value);
            fetchedFrom.push(subreddits[i]);
        } else {
            failedFrom.push(subreddits[i]);
        }
    });

    if (allPosts.length === 0) {
        return NextResponse.json(
            { error: 'All subreddit fetches failed. Reddit may be rate-limiting.' },
            { status: 502 }
        );
    }

    // Deduplicate by title, sort by upvotes, take top N
    const seen = new Set<string>();
    const unique = allPosts.filter(p => {
        const key = p.title.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key); return true;
    });

    const top = unique
        .sort((a, b) => b.upvotes - a.upvotes)
        .slice(0, finalLimit)
        .map((p, i) => ({ rank: i + 1, ...p }));

    const response = {
        posts: top,
        fetchedAt: new Date().toISOString(),
        fetchedFrom,
        failedFrom,
        totalCandidates: unique.length,
        subredditsSource: subsSource,
        subredditsUsed: subreddits,
    };

    // Auto-save to blob in background
    writeBlob(BLOB_POSTS_NAME, { ...response, savedAt: new Date().toISOString() })
        .catch(e => console.warn('[reddit] blob save failed:', e));

    return NextResponse.json(response);
}

// ── POST — save a batch to blob ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const { posts, fetchedAt, fetchedFrom } = await req.json();
        if (!posts || !Array.isArray(posts) || posts.length === 0) {
            return NextResponse.json({ error: 'posts array is required' }, { status: 400 });
        }
        await writeBlob(BLOB_POSTS_NAME, {
            posts, fetchedAt, fetchedFrom,
            savedAt: new Date().toISOString(),
        });
        return NextResponse.json({ success: true, savedAt: new Date().toISOString() });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
