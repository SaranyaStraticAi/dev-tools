import { NextRequest, NextResponse } from 'next/server';

function getAzureConfig() {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;

    let resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;
    let deployment = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT_RAG || 'gpt-4.1-rag-summary';
    let apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';

    if (!resourceName && endpoint) {
        try {
            const url = new URL(endpoint);
            resourceName = url.hostname.split('.')[0];
        } catch (e) {
            console.error('Failed to parse endpoint URL:', endpoint);
        }
    }

    return { apiKey, resourceName, deployment, apiVersion };
}

export async function POST(req: NextRequest) {
    try {
        const {
            systemPrompt,
            userPromptTemplate,
            headline,
            summary,
            sentiment
        } = await req.json();

        if (!systemPrompt || !userPromptTemplate) {
            return NextResponse.json({ error: 'System and User prompt templates are required' }, { status: 400 });
        }

        const { apiKey, resourceName, deployment, apiVersion } = getAzureConfig();

        if (!apiKey || !resourceName) {
            throw new Error('Azure OpenAI credentials missing.');
        }

        const userPrompt = userPromptTemplate
            .replace('{headline}', headline || 'Market Move')
            .replace('{summary}', summary || '')
            .replace('{sentiment}', sentiment?.toString() || '0');


        const url = `https://${resourceName}.openai.azure.com/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

        console.log(`Backend Execution: Synchronizing with artist.py structure (System/User Roles)`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7 // Parity with artist.py
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Azure API Error:', JSON.stringify(data, null, 2));
            throw new Error(data.error?.message || 'Azure API returned an error');
        }

        return NextResponse.json({ text: data.choices[0].message.content });
    } catch (err: any) {
        console.error('Prompt Generation Error:', err);
        return NextResponse.json({ error: 'generation-failed', message: err.message }, { status: 500 });
    }
}
