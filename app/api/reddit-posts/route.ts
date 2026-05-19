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

    let res: Response | null = null;
    let lastError: any = null;

    // 1. Try Direct Fetch (works great locally, but might be blocked on cloud platforms like Vercel)
    try {
        res = await fetch(targetUrl, {
            headers: { 'User-Agent': userAgent },
        });
        if (!res.ok) {
            res = null;
        }
    } catch (err: any) {
        lastError = err;
    }

    // 2. Try Codetabs Proxy
    if (!res) {
        const codetabsUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
        try {
            res = await fetch(codetabsUrl, {
                headers: { 'User-Agent': userAgent },
            });
            if (!res.ok) {
                res = null;
            }
        } catch (err: any) {
            lastError = err;
        }
    }

    // 3. Try Corsproxy.io as a last resort
    if (!res) {
        const corsproxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        try {
            res = await fetch(corsproxyUrl, {
                headers: { 'User-Agent': userAgent },
            });
            if (!res.ok) {
                res = null;
            }
        } catch (err: any) {
            lastError = err;
        }
    }

    if (!res) {
        return NextResponse.json({ error: `Reddit Proxy/Direct fetch failed. Last error: ${lastError?.message || 'unknown status'}` }, { status: 502 });
    }
    try {
        const data = await res.json();
        
        if (!data || !data.data || !data.data.children) {
             return NextResponse.json({ error: 'Invalid response from Reddit' }, { status: 502 });
        }

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