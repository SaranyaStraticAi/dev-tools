import { NextRequest, NextResponse } from 'next/server';

// Fetches top posts from r/Forex using Reddit public JSON API
// No API key needed - same as the Python pipeline (fetch_reddit.py)
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const subreddit = searchParams.get('subreddit') || 'Forex';
    const timeframe = searchParams.get('t') || 'week';
    const limit     = searchParams.get('limit') || '10';

    // The target Reddit URL
    const targetUrl = `https://www.reddit.com/r/${subreddit}/top.json?t=${timeframe}&limit=${limit}`;
    
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    let data: any = null;
    const errors: string[] = [];

    const fetchSources = [
        {
            name: 'Direct Fetch',
            url: targetUrl,
        },
        {
            name: 'Codetabs Proxy',
            url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        },
        {
            name: 'Corsproxy.io',
            url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        },
        {
            name: 'Allorigins Proxy',
            url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        }
    ];

    for (const source of fetchSources) {
        try {
            const res = await fetch(source.url, {
                headers: { 'User-Agent': userAgent },
                cache: 'no-store',
            });
            if (!res.ok) {
                throw new Error(`HTTP status ${res.status}`);
            }
            const text = await res.text();
            if (!text || text.trim() === '') {
                throw new Error('Empty response body');
            }
            const parsed = JSON.parse(text);
            if (!parsed || !parsed.data || !parsed.data.children) {
                throw new Error('Invalid Reddit JSON structure (missing data.children)');
            }
            data = parsed;
            break;
        } catch (err: any) {
            errors.push(`${source.name}: ${err.message}`);
        }
    }

    if (!data) {
        return NextResponse.json({ 
            error: 'Failed to fetch Reddit posts from all sources.', 
            details: errors.join('; ') 
        }, { status: 502 });
    }

    try {

        const posts = (data.data.children as any[]).map((item, i) => {
            const p = item.data;
            return {
                rank:        i + 1,
                title:       p.title,
                upvotes:     p.ups,
                comments:    p.num_comments,
                author:      p.author,
                flair:       p.link_flair_text || 'General',
                url:         `https://reddit.com${p.permalink}`,
                created_utc: new Date(p.created_utc * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
            };
        });
        return NextResponse.json({ posts, fetchedAt: new Date().toISOString() });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}