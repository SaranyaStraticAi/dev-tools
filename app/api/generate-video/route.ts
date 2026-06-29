import { NextRequest, NextResponse } from 'next/server';

// Returns Sora 2 config so client can call Azure directly
// Same resource as image generator: vibetrader-gpt5-resource (eastus2)
export async function GET() {
  const apiKey    = process.env.AZURE_API_KEY;
  const endpoint  = process.env.AZURE_ENDPOINT;
  const deployment = 'sora-2';

  if (!apiKey || !endpoint) {
    return NextResponse.json({ error: 'Sora 2 API credentials missing' }, { status: 500 });
  }

  return NextResponse.json({
    submitUrl: `${endpoint.replace(/\/$/, '')}/openai/v1/videos`,
    statusUrl: `${endpoint.replace(/\/$/, '')}/openai/v1/videos`,
    apiKey,
    deployment,
  });
}
