// Tool 7 — bannerImageTool
// Uses the existing /api/generate-banner route which overlays the subject line
// on your Canva-designed banner background (banner-bg.png).
// No GPT-Image-2 — same banner design as the rest of your newsletters.

export interface BannerResult { url: string; }

export async function bannerImageTool(
    subject: string,
    requestUrl: string, // pass req.url from the route so we can build the correct host
): Promise<BannerResult> {
    // Build absolute URL using the same host as the incoming request
    const base    = new URL(requestUrl);
    const apiUrl  = `${base.protocol}//${base.host}/api/generate-banner`;

    console.log('[bannerImageTool] Calling generate-banner with subject:', subject.slice(0, 80));

    const res = await fetch(apiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subject }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`generate-banner failed: ${(err as any)?.error || res.status}`);
    }

    const data = await res.json();
    if (!data.url) throw new Error('generate-banner returned no URL');

    console.log('[bannerImageTool] Banner URL:', data.url);
    return { url: data.url };
}
