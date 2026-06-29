import { NextRequest, NextResponse } from 'next/server';

// This route just returns the Azure Image API config
// so the client can call it directly (bypassing Vercel timeout)
export async function GET() {
    const apiKey    = process.env.AZURE_IMAGE_API_KEY || process.env.AZURE_API_KEY;
    const endpoint  = process.env.AZURE_IMAGE_ENDPOINT || process.env.AZURE_ENDPOINT;
    const deployment = process.env.AZURE_IMAGE_DEPLOYMENT || 'gpt-image-2';

    if (!apiKey || !endpoint) {
        return NextResponse.json({ error: 'Azure Image API credentials missing' }, { status: 500 });
    }

    return NextResponse.json({
        url: `${endpoint.replace(/\/$/, '')}/openai/v1/images/generations`,
        apiKey,
        deployment,
    });
}
