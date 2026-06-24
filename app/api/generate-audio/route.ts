import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'alloy' } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.AZURE_TTS_API_KEY;
    const endpoint = process.env.AZURE_TTS_ENDPOINT;
    
    // Deployment name we created via CLI
    const deployment = process.env.AZURE_OPENAI_TTS_DEPLOYMENT || 'tts';
    
    // Azure TTS API version
    const apiVersion = process.env.AZURE_OPENAI_TTS_API_VERSION || '2024-02-15-preview';

    if (!apiKey || !endpoint) {
      return NextResponse.json({ error: 'Azure OpenAI credentials missing' }, { status: 500 });
    }

    // Example endpoint format: https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/audio/speech?api-version=2024-02-15-preview
    const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/audio/speech?api-version=${apiVersion}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: deployment,
        input: text,
        voice: voice,
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      throw new Error(`Azure API Error: ${res.status} - ${errorData}`);
    }

    // Get the audio as an ArrayBuffer and return it
    const arrayBuffer = await res.arrayBuffer();
    
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });

  } catch (err: any) {
    console.error('[generate-audio]', err);
    return NextResponse.json({ error: err.message || 'Audio generation failed' }, { status: 500 });
  }
}
