'use client';

// ─────────────────────────────────────────────────────────────────────────────
// RedditPanel.tsx — the Reddit posts section
// Shows a list of editable posts + a "Fetch Live Reddit" button.
// ─────────────────────────────────────────────────────────────────────────────

import { RedditPost, SAMPLE_REDDIT_POSTS } from '../constants';

interface RedditPanelProps {
    posts: RedditPost[];
    fetchingReddit: boolean;
    redditFetchedAt?: string;
    redditError: string;
    onFetchLive: () => void;
    onResetSamples: () => void;
    onPostsChange: (posts: RedditPost[]) => void;
}

export default function RedditPanel({
    posts,
    fetchingReddit,
    redditFetchedAt,
    redditError,
    onFetchLive,
    onResetSamples,
    onPostsChange,
}: RedditPanelProps) {
    return (
        <div className="w-full max-w-3xl border rounded-2xl overflow-hidden bg-card shadow-sm">

            {/* Header row */}
            <div className="px-5 py-3 border-b bg-muted/40 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Reddit posts this week
                    </span>
                    {redditFetchedAt
                        ? <span className="flex items-center gap-1 text-[10px] text-green-500 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
                            Live · {new Date(redditFetchedAt).toLocaleTimeString()}
                          </span>
                        : <span className="flex items-center gap-1 text-[10px] text-yellow-500 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block"/>
                            Sample data
                          </span>
                    }
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onFetchLive} disabled={fetchingReddit}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all disabled:opacity-60">
                        {fetchingReddit
                            ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin rounded-full"/>Fetching…</>
                            : '🔴 Fetch Live Reddit'}
                    </button>
                    <button onClick={onResetSamples}
                        className="text-[10px] text-purple-500 font-bold hover:underline">
                        Reset to samples
                    </button>
                </div>
            </div>

            {/* Error */}
            {redditError && (
                <div className="px-5 py-2 bg-red-500/10 text-red-400 text-[11px]">❌ {redditError}</div>
            )}

            {/* Post list — each post's title and upvotes are inline-editable */}
            <div className="divide-y max-h-72 overflow-y-auto">
                {posts.map((post, i) => (
                    <div key={post.rank} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
                        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 mt-0.5">
                            #{post.rank}
                        </span>
                        <div className="flex-1 min-w-0">
                            {/* Editable title */}
                            <input
                                value={post.title}
                                onChange={e => {
                                    const next = [...posts];
                                    next[i] = { ...next[i], title: e.target.value };
                                    onPostsChange(next);
                                }}
                                className="w-full text-sm font-medium bg-transparent border-none outline-none focus:bg-muted/40 rounded px-1 -mx-1"
                            />
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-muted-foreground">
                                    👍
                                    {/* Editable upvote count */}
                                    <input
                                        type="number"
                                        value={post.upvotes}
                                        onChange={e => {
                                            const next = [...posts];
                                            next[i] = { ...next[i], upvotes: Number(e.target.value) };
                                            onPostsChange(next);
                                        }}
                                        className="w-16 bg-transparent border-none outline-none text-[10px] text-muted-foreground ml-1"
                                    />
                                    upvotes
                                </span>
                                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                                    {post.flair}
                                </span>
                                {post.url && !post.url.includes('sample') && (
                                    <a href={post.url} target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] text-blue-500 hover:underline truncate max-w-[160px]">
                                        ↗ reddit
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
