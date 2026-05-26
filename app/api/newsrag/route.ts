import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const limit = body.limit || 3;
        const query = body.query || 'Forex Market';

        // 1. Fetch semantic summary from NewsRAG
        const res = await fetch('https://newsrag-api-prod-global-ftheascbdfh9efe8.z03.azurefd.net/summarize', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify({ query, limit, format: 'json' }),
        });

        if (!res.ok) {
            return NextResponse.json(
                { error: `NewsRAG API returned status ${res.status}` },
                { status: res.status }
            );
        }

        const data = await res.json();
        const summary = data.summary || 'No summary available for this topic.';
        
        let referenceLinks = [];
        
        // 2. Try to get articles from NewsRAG
        if (data.articles && Array.isArray(data.articles) && data.articles.length > 0) {
            referenceLinks = data.articles.map((a: any) => ({
                title: a.title || 'Source Article',
                url: a.url || '#'
            }));
        } 
        // 3. Fallback: Fetch latest articles from Newsfeed Curator if NewsRAG omitted them
        else {
            try {
                const fallbackRes = await fetch(`https://func-newsfeed-curator-prod.azurewebsites.net/news_feed?limit=${limit}`);
                if (fallbackRes.ok) {
                    const fallbackData = await fallbackRes.json();
                    const articles = Array.isArray(fallbackData) ? fallbackData : (fallbackData.items || []);
                    referenceLinks = articles.map((a: any) => ({
                        title: a.headline || 'Market News',
                        url: Array.isArray(a.source_url) ? a.source_url[0] : (a.source_url || '#')
                    })).slice(0, limit);
                }
            } catch (fallbackErr) {
                console.error('Fallback newsfeed fetch failed:', fallbackErr);
            }
        }

        return NextResponse.json({ summary, referenceLinks });
    } catch (err: any) {
        console.error('Error proxying to NewsRAG:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to connect to NewsRAG API' },
            { status: 500 }
        );
    }
}
