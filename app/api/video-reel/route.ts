/**
 * POST /api/video-reel
 *
 * Calls GPT-4 with system + user prompt and returns raw text script.
 * No JSON schema enforced — the LLM writes freely.
 *
 * Body:
 *   systemPrompt  string  — brand/scene/visual rules
 *   userPrompt    string  — the full assembled user message
 *   temperature   number  — default 0.85
 */

import { NextRequest, NextResponse } from 'next/server';

function getAzureConfig() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY!;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
  const dep = process.env.AZURE_OPENAI_DEPLOYMENT_RAG || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-rag-summary';
  const ver = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';

  let resource = process.env.AZURE_OPENAI_RESOURCE_NAME || '';
  if (!resource && endpoint) {
    try { resource = new URL(endpoint).hostname.split('.')[0]; } catch { }
  }
  return { apiKey, resource, dep, ver };
}

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userPrompt, temperature = 0.85 } = await req.json();

    if (!systemPrompt) {
      return NextResponse.json({ error: 'systemPrompt is required' }, { status: 400 });
    }
    if (!userPrompt) {
      return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 });
    }

    const { apiKey, resource, dep, ver } = getAzureConfig();
    if (!apiKey || !resource) {
      return NextResponse.json({ error: 'Azure OpenAI credentials missing' }, { status: 500 });
    }

    const url = `https://${resource}.openai.azure.com/openai/deployments/${dep}/chat/completions?api-version=${ver}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        temperature,
        max_tokens: 3000,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Azure API ${res.status}`);
    }

    const rawText: string = data.choices[0].message.content.trim();
    return NextResponse.json({ script: rawText });
  } catch (err: any) {
    console.error('[video-reel]', err);
    return NextResponse.json({ error: err.message || 'generation failed' }, { status: 500 });
  }
}
