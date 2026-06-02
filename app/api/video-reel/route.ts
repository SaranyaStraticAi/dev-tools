/**
 * POST /api/video-reel
 *
 * Calls GPT-4 with the full v6 reel prompt (system + brief + market context)
 * and returns a parsed 3-scene JSON object.
 *
 * Body:
 *   systemPrompt   string  — the v6 brand/scene/visual rules
 *   brief          string  — TODAY'S CONTENT BRIEF block (day, notes, CTAs)
 *   marketContext  string  — MARKET CONTEXT or NEWS TRIGGER block
 *   temperature    number  — default 0.85
 */

import { NextRequest, NextResponse } from 'next/server';

function getAzureConfig() {
  const apiKey   = process.env.AZURE_OPENAI_API_KEY!;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
  const dep      = process.env.AZURE_OPENAI_DEPLOYMENT_RAG || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-rag-summary';
  const ver      = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';

  let resource = process.env.AZURE_OPENAI_RESOURCE_NAME || '';
  if (!resource && endpoint) {
    try { resource = new URL(endpoint).hostname.split('.')[0]; } catch {}
  }
  return { apiKey, resource, dep, ver };
}

const OUTPUT_SCHEMA = `{
  "voice": "Observer | Company | Product",
  "content_type": "Pain | Psychology | Education | Market | Product | Entertainment | Puzzle",
  "scene_1": {
    "duration_seconds": 12,
    "script_lines": ["line 1 on screen", "line 2 on screen", "line 3 on screen"],
    "sora_prompt": "Full Sora 2 visual direction for scene 1. Under 150 words. Shot type first."
  },
  "scene_2": {
    "duration_seconds": 12,
    "script_lines": ["line 1 on screen", "line 2 on screen", "line 3 on screen"],
    "sora_prompt": "Full Sora 2 visual direction for scene 2. Under 150 words. Shot type first."
  },
  "scene_3": {
    "duration_seconds": 8,
    "script_lines": ["line 1 on screen", "line 2 on screen"],
    "sora_prompt": "Full Sora 2 visual direction for scene 3. Under 150 words. Shot type first."
  },
  "instagram_caption": "Full caption matching the formula above exactly."
}
CRITICAL: duration_seconds must be exactly 4, 8, or 12. Sora 2 rejects all other values.`;

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, brief, marketContext, temperature = 0.85, fullUserPrompt } = await req.json();

    if (!systemPrompt || (!brief && !fullUserPrompt)) {
      return NextResponse.json({ error: 'systemPrompt and either brief or fullUserPrompt are required' }, { status: 400 });
    }

    const { apiKey, resource, dep, ver } = getAzureConfig();
    if (!apiKey || !resource) {
      return NextResponse.json({ error: 'Azure OpenAI credentials missing' }, { status: 500 });
    }

    const userContent = fullUserPrompt || [
      brief,
      marketContext ? `\n${marketContext}` : '',
      '\n## YOUR TASK',
      'Generate a complete Instagram reel package following the v6 skill above.',
      'Respond ONLY with valid raw JSON matching this schema — no preamble, no fences:',
      '',
      OUTPUT_SCHEMA,
    ].join('\n');

    const url = `https://${resource}.openai.azure.com/openai/deployments/${dep}/chat/completions?api-version=${ver}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent   },
        ],
        temperature,
        max_tokens: 2000,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Azure API ${res.status}`);
    }

    let raw: string = data.choices[0].message.content.trim();

    // Strip markdown fences if GPT-4 added them
    if (raw.includes('```')) {
      for (const part of raw.split('```')) {
        const p = part.startsWith('json') ? part.slice(4).trim() : part.trim();
        if (p.startsWith('{')) { raw = p; break; }
      }
    }

    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('[video-reel]', err);
    return NextResponse.json({ error: err.message || 'generation failed' }, { status: 500 });
  }
}
