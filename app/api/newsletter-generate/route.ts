import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest) {
    try {
        const { systemPrompt, userPrompt } = await req.json();
        if (!systemPrompt || !userPrompt) {
            return NextResponse.json({ error: 'systemPrompt and userPrompt required' }, { status: 400 });
        }
        const { apiKey, resourceName, deployment, apiVersion } = getAzureConfig();
        if (!apiKey || !resourceName) {
            return NextResponse.json({ error: 'Azure OpenAI credentials missing in .env.local' }, { status: 500 });
        }

        const url = `https://${resourceName}.openai.azure.com/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user',   content: userPrompt },
                ],
                temperature: 0.75,
            }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || `Azure error ${response.status}`);
        return NextResponse.json({ text: data.choices[0].message.content });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
