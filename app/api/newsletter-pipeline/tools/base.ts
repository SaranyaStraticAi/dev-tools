// base.ts — shared helpers for all newsletter pipeline tools

export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

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
