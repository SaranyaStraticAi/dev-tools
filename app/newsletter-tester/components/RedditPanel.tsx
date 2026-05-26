'use client';

import { useState } from 'react';
import { RedditPost, SAMPLE_REDDIT_POSTS } from '../constants';

interface RedditPanelProps {
    posts: RedditPost[];
    fetchingReddit: boolean;
    redditFetchedAt?: string;
    redditFromBlob?: boolean;
    redditError: string;
    redditSubsSource?: string;
    redditSubsUsed?: string[];
    onFetchLive: (rediscover?: boolean) => void;
    onResetSamples: () => void;
    onPostsChange: (posts: RedditPost[]) => void;
}

const SOURCE_LABEL: Record<string, { label: string; colour: string }> = {
    'llm-picked':          { label: '🤖 LLM-picked',         colour: 'text-purple-400' },
    'blob-cached':         { label: '☁️ Cached (7d)',         colour: 'text-blue-400'   },
    'subscriber-fallback': { label: '📊 Top by subscribers', colour: 'text-yellow-400' },
    'hardcoded-fallback':  { label: '⚠️ Fallback list',      colour: 'text-red-400'    },
};

export default function RedditPanel({
    posts, fetchingReddit, redditFetchedAt, redditFromBlob,
    redditError, redditSubsSource, redditSubsUsed = [],
    onFetchLive, onResetSamples, onPostsChange,
}: RedditPanelProps) {
    const [showSubs, setShowSubs] = useState(false);
    const subsInfo = redditSubsSource ? SOURCE_LABEL[redditSubsSource] : null;

    return (
        <div className="w-full max-w-3xl border rounded-2xl overflow-hidden bg-card shadow-sm">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="px-5 py-3 border-b bg-muted/40 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Reddit posts this week
                    </span>
                    {/* Live / cached / sample */}
                    {redditFetchedAt && !redditFromBlob
                        ? <span className="flex items-center gap-1 text-[10px] text-green-500 font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
                              Live · {new Date(redditFetchedAt).toLocaleTimeString()}
                          </span>
                        : redditFromBlob
                        ? <span className="flex items-center gap-1 text-[10px] text-blue-400 font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"/>
                              ☁️ Cached · {redditFetchedAt ? new Date(redditFetchedAt).toLocaleDateString() : ''}
                          </span>
                        : <span className="flex items-center gap-1 text-[10px] text-yellow-500 font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block"/>
                              Sample data
                          </span>
                    }
                    {/* How subreddits were chosen */}
                    {subsInfo && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted ${subsInfo.colour}`}>
                            {subsInfo.label}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => onFetchLive(false)} disabled={fetchingReddit}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all disabled:opacity-60">
                        {fetchingReddit
                            ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin rounded-full"/>Fetching…</>
                            : '🔴 Fetch Live Reddit'}
                    </button>
                    <button onClick={() => onFetchLive(true)} disabled={fetchingReddit}
                        title="Force fresh Reddit community search + LLM pick (bypasses 7-day cache)"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all disabled:opacity-60">
                        🤖 Rediscover
                    </button>
                    <button onClick={onResetSamples}
                        className="text-[10px] text-purple-500 font-bold hover:underline">
                        Reset to samples
                    </button>
                </div>
            </div>

            {/* ── LLM-chosen subreddits pill row ──────────────────────────── */}
            {redditSubsUsed.length > 0 && (
                <div className="px-5 py-2 border-b bg-muted/20 flex items-center gap-2 flex-wrap">
                    <button onClick={() => setShowSubs(s => !s)}
                        className="text-[10px] text-muted-foreground font-bold hover:text-foreground transition-colors shrink-0">
                        {showSubs ? '▲ Hide' : '▼ Show'} subreddits ({redditSubsUsed.length})
                    </button>
                    {showSubs && redditSubsUsed.map(sub => (
                        <a key={sub} href={`https://reddit.com/r/${sub}`} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-orange-400 font-bold px-1.5 py-0.5 bg-orange-500/10 rounded border border-orange-500/20 hover:bg-orange-500/20 transition-colors">
                            r/{sub}
                        </a>
                    ))}
                </div>
            )}

            {/* ── Error ───────────────────────────────────────────────────── */}
            {redditError && (
                <div className="px-5 py-2 bg-red-500/10 text-red-400 text-[11px]">❌ {redditError}</div>
            )}

            {/* ── Post list ───────────────────────────────────────────────── */}
            <div className="divide-y max-h-72 overflow-y-auto">
                {posts.map((post, i) => (
                    <div key={post.rank} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
                        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 mt-0.5">#{post.rank}</span>
                        <div className="flex-1 min-w-0">
                            <input value={post.title}
                                onChange={e => { const n=[...posts]; n[i]={...n[i],title:e.target.value}; onPostsChange(n); }}
                                className="w-full text-sm font-medium bg-transparent border-none outline-none focus:bg-muted/40 rounded px-1 -mx-1"/>
                            {post.selftext !== undefined && (
                                <div className="mt-1 mb-1.5 pl-0.5">
                                    <textarea value={post.selftext} rows={2}
                                        onChange={e => { const n=[...posts]; n[i]={...n[i],selftext:e.target.value}; onPostsChange(n); }}
                                        placeholder="No post content body (empty)"
                                        className="w-full text-xs text-muted-foreground bg-muted/20 border border-muted/50 rounded-lg p-2 outline-none focus:ring-1 focus:ring-orange-500/30 resize-y font-sans leading-relaxed"/>
                                </div>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-muted-foreground">
                                    👍
                                    <input type="number" value={post.upvotes}
                                        onChange={e => { const n=[...posts]; n[i]={...n[i],upvotes:Number(e.target.value)}; onPostsChange(n); }}
                                        className="w-16 bg-transparent border-none outline-none text-[10px] text-muted-foreground ml-1"/>
                                    upvotes
                                </span>
                                {post.subreddit && (
                                    <span className="text-[10px] text-orange-400 font-bold px-1.5 py-0.5 bg-orange-500/10 rounded border border-orange-500/20">
                                        r/{post.subreddit}
                                    </span>
                                )}
                                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">{post.flair}</span>
                                {post.url && !post.url.includes('sample') && (
                                    <a href={post.url} target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] text-blue-500 hover:underline truncate max-w-[160px]">↗ reddit</a>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
