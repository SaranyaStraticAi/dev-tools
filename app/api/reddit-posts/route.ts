import { NextRequest, NextResponse } from 'next/server';

// Fetches top posts from r/Forex using Reddit public JSON API
// No API key needed - same as the Python pipeline (fetch_reddit.py)
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const subreddit = searchParams.get('subreddit') || 'Forex';
    const timeframe = searchParams.get('t') || 'week';
    const limit     = searchParams.get('limit') || '10';
    const url = `https://www.reddit.com/r/${subreddit}/top.json?t=${timeframe}&limit=${limit}`;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'VibeTraderNewsletterBot/1.0' },
        });
        if (!res.ok) {
            return NextResponse.json({ error: `Reddit returned ${res.status}` }, { status: 502 });
        }
        const data = await res.json();
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