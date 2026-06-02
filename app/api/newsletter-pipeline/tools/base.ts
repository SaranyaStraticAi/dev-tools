// base.ts — shared helpers for all newsletter pipeline tools

export const USER_AGENT = 'VibeTrader Newsletter Bot/1.0 (by /u/vibetrader_bot)';

// ── Reddit OAuth token (cached in-process for the token's lifetime) ──────────
let redditTokenCache: { token: string; expiresAt: number } | null = null;

export async function getRedditToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (redditTokenCache && Date.now() < redditTokenCache.expiresAt - 60_000) {
        return redditTokenCache.token;
    }

    const clientId     = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET must be set in .env.local — see https://www.reddit.com/prefs/apps');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
        method:  'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type':  'application/x-www-form-urlencoded',
            'User-Agent':    USER_AGENT,
        },
        body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Reddit OAuth failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    redditTokenCache = {
        token:     data.access_token as string,
        expiresAt: Date.now() + (data.expires_in as number) * 1000,
    };

    console.log('[reddit] Got fresh OAuth token, expires in', data.expires_in, 's');
    return redditTokenCache.token;
}

function getAzureConfig() {
    const apiKey     = process.env.AZURE_OPENAI_API_KEY || '';
    const endpoint   = process.env.AZURE_OPENAI_ENDPOINT || '';
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT_RAG || 'gpt-4.1-rag-summary';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';
    let resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME || '';
    if (!resourceName && endpoint) {
        try { resourceName = new URL(endpoint).hostname.split('.')[0]; } catch {}
    }
    return { apiKey, resourceName, deployment, apiVersion };
}

export async function callAI(system: string, user: string, temperature = 0.2): Promise<string> {
    const { apiKey, resourceName, deployment, apiVersion } = getAzureConfig();
    if (!apiKey || !resourceName) throw new Error('Azure OpenAI credentials missing');
    const url = `https://${resourceName}.openai.azure.com/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000); // 90s hard timeout
    try {
        const res  = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
            body:    JSON.stringify({
                messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
                temperature,
            }),
            signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Azure OpenAI error ${res.status}`);
        return data.choices[0].message.content as string;
    } finally {
        clearTimeout(timer);
    }
}

export function parseJSON<T>(raw: string): T {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned) as T;
}

export async function fetchWithTimeout(url: string, timeoutMs = 10000, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ── Reddit OAuth ─────────────────────────────────────────────────────────────
let cachedRedditToken: string | null = null;
let tokenExpiry = 0;

export async function getRedditOAuthToken(): Promise<string | null> {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    if (cachedRedditToken && Date.now() < tokenExpiry) {
        return cachedRedditToken;
    }

    try {
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const res = await fetchWithTimeout('https://www.reddit.com/api/v1/access_token', 10000, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': USER_AGENT
            },
            body: 'grant_type=client_credentials'
        });

        if (!res.ok) throw new Error(`Reddit auth failed: ${res.status}`);
        const data = await res.json();
        
        cachedRedditToken = data.access_token;
        // Token typically lives for 3600 seconds, expire slightly early
        tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);
        console.log('[reddit auth] Got new OAuth token');
        
        return cachedRedditToken;
    } catch (e) {
        console.warn('[reddit auth] Failed to get token:', e);
        return null;
    }
}
