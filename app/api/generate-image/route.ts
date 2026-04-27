export const maxDuration = 120; // 2 minutes for ultra-high-res 2026 models

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    console.log('🚀 Image Generation Started:', prompt?.slice(0, 50) + '...');

    if (!prompt) {
      return new Response('Prompt is required', { status: 400 });
    }

    const apiKey = process.env.AZURE_API_KEY!;
    const endpoint = process.env.AZURE_ENDPOINT!;
    const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT_NAME || 'gpt-image-2';
    
    // Switch to the unified v1 path which we know is reachable on your endpoint
    const url = `${endpoint.replace(/\/$/, '')}/openai/v1/images/generations`;
    console.log('📡 Calling Azure Universal v1 at:', url);

    const fullPrompt = `Generate a high-quality, professional image. 4K resolution, cinematic lighting, glassmorphism UI elements, dark mode aesthetic, vibrant purple and cyan highlights. Description: ${prompt}. No text in the image.`;

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: deployment,
        prompt: fullPrompt,
        n: 1,
        size: '1024x1024',
      }),
    });

    console.log(`⏱️ Azure Response Received (${((Date.now() - startTime)/1000).toFixed(1)}s):`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Azure Error Text:', errorText);
      throw new Error(`Azure API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const imageData = result.data?.[0];

    if (!imageData) {
      throw new Error('No image data returned from Azure');
    }

    console.log(`✨ DONE! Image data sent to client in ${((Date.now() - startTime)/1000).toFixed(1)}s`);
    
    // Return the JSON directly to the client instead of fetching the binary
    return new Response(JSON.stringify(imageData), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {

    console.error('❌ Azure GPT-Image-2 Fetch Error:', error);
    return new Response(error.message || 'Internal Server Error', { status: 500 });
  }
}





