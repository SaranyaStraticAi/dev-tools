'use client';

import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Sparkles, Download, RefreshCw, AlertCircle, Layers, CheckCircle, XCircle, Search, ExternalLink, Calendar, Copy, Check } from 'lucide-react';

interface RedditPostRaw {
    id: string;
    subreddit: string;
    title: string;
    selftext: string;
    upvotes: number;
    upvoteRatio: number;
    comments: number;
    author: string;
    flair: string;
    url: string;
    permalink: string;
    created_utc: string;
}

export default function FetchPostsTesterPage() {
    const { accounts } = useMsal();
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [subredditsInput, setSubredditsInput] = useState('Forex, Daytrading, PropFirmTrading');
    const [timeframe, setTimeframe] = useState('week');
    const [running, setRunning] = useState(false);

    const [posts, setPosts] = useState<RedditPostRaw[]>([]);
    const [fetchedFrom, setFetchedFrom] = useState<string[]>([]);
    const [failedFrom, setFailedFrom] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    
    const [filterText, setFilterText] = useState('');
    const [activeTab, setActiveTab] = useState<'table' | 'json'>('table');
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [isUsingPicked, setIsUsingPicked] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('employee_session');
        if (saved) setEmployeeAccount(saved);

        // Load picked subreddits from Tool 2 if available
        const picked = localStorage.getItem('reddit_picked_subreddits');
        if (picked) {
            setSubredditsInput(picked);
            setIsUsingPicked(true);
        }
    }, []);

    const userEmail = accounts[0]?.username;
    const isAllowed = userEmail === 'masood@aity.dev' || employeeAccount === 'ketki@vibetrader.com' || userEmail === 'ketki@vibetrader.com' || userEmail === 'saranya@vibetrader.com' || employeeAccount === 'saranya@vibetrader.com';

    if (!mounted) return null;

    if (!isAllowed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background">
                <span className="text-2xl">🔒</span>
                <p className="text-sm text-muted-foreground mt-2">Access Denied. Only Masood and Ketki are allowed.</p>
            </div>
        );
    }

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const runFetch = async () => {
        setRunning(true);
        setError(null);
        setPosts([]);
        setFetchedFrom([]);
        setFailedFrom([]);

        const subs = subredditsInput
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (subs.length === 0) {
            setError('Please enter at least one subreddit name.');
            setRunning(false);
            return;
        }

        try {
            const res = await fetch('/api/newsletter-pipeline/fetch-posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subreddits: subs, timeframe }),
            });
            const data = await res.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch posts.');
            }

            setPosts(data.posts || []);
            if (data.posts) {
                localStorage.setItem('reddit_fetched_posts', JSON.stringify(data.posts));
            }
            setFetchedFrom(data.fetchedFrom || []);
            setFailedFrom(data.failedFrom || []);
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setRunning(false);
        }
    };

    const filteredPosts = posts.filter(p => 
        p.title.toLowerCase().includes(filterText.toLowerCase()) || 
        p.subreddit.toLowerCase().includes(filterText.toLowerCase()) ||
        p.selftext.toLowerCase().includes(filterText.toLowerCase())
    );

    return (
        <div className="flex flex-col items-center min-h-screen bg-background text-foreground py-10 px-4 gap-8">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="text-center max-w-2xl flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-600 text-xs font-semibold uppercase tracking-wider">
                    <Sparkles size={12} />
                    Tool 3 In Isolation
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    Reddit Fetch Posts Tester
                </h1>
                <p className="text-sm text-muted-foreground">
                    Download top posts and comments from chosen subreddits directly from Reddit.
                </p>
                <a href="/newsletter-tester"
                    className="mt-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                    ← Back to Pipeline Tester
                </a>
            </div>

            {/* ── Workspace ────────────────────────────────────────────────── */}
            <div className="w-full max-w-4xl bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
                
                {/* ── Controls Row ────────────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4">
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-foreground">Subreddits (Comma Separated)</label>
                            {isUsingPicked && (
                                <span className="flex items-center gap-2 text-[10px] text-green-600 dark:text-green-400 font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Loaded from Tool 2
                                    <button
                                        onClick={() => {
                                            setSubredditsInput('Forex, Daytrading, PropFirmTrading');
                                            setIsUsingPicked(false);
                                            localStorage.removeItem('reddit_picked_subreddits');
                                        }}
                                        className="underline hover:text-green-700 font-bold ml-1 cursor-pointer"
                                    >
                                        Reset
                                    </button>
                                </span>
                            )}
                        </div>
                        <input
                            type="text"
                            value={subredditsInput}
                            onChange={(e) => setSubredditsInput(e.target.value)}
                            placeholder="e.g. Forex, Daytrading"
                            className="w-full text-sm px-3.5 py-2 border border-border rounded-xl outline-none focus:ring-1 focus:ring-purple-500 bg-background text-foreground"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-foreground">Timeframe</label>
                        <select
                            value={timeframe}
                            onChange={(e) => setTimeframe(e.target.value)}
                            className="w-full text-sm px-3.5 py-2 border border-border rounded-xl outline-none focus:ring-1 focus:ring-purple-500 bg-background text-foreground"
                        >
                            <option value="day">Past 24 Hours</option>
                            <option value="week">Past Week</option>
                            <option value="month">Past Month</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={runFetch}
                    disabled={running}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                        running
                            ? 'bg-purple-100 text-purple-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                    }`}
                >
                    {running ? (
                        <>
                            <RefreshCw className="animate-spin" size={16} />
                            Fetching Posts...
                        </>
                    ) : (
                        <>
                            <Download size={16} />
                            Fetch Posts (Tool 3)
                        </>
                    )}
                </button>

                {/* ── Error ─────────────────────────────────────────────── */}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle size={16} />
                        <div><span className="font-bold">Error:</span> {error}</div>
                    </div>
                )}

                {/* ── Results ───────────────────────────────────────────── */}
                {posts.length > 0 && !running && (
                    <div className="flex flex-col gap-6 mt-2">
                        
                        {/* ── Stats & Source List ─────────────────────────────── */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-muted/40 rounded-xl border border-border flex items-center gap-3">
                                <div className="p-2 bg-purple-55 rounded-lg"><Layers size={18} className="text-purple-600" /></div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Posts</p>
                                    <p className="text-lg font-bold text-foreground">{posts.length}</p>
                                </div>
                            </div>

                            <div className="p-4 bg-muted/40 rounded-xl border border-border flex items-start gap-3 col-span-2">
                                <div className="p-2 bg-indigo-50 rounded-lg shrink-0 mt-0.5"><CheckCircle size={18} className="text-indigo-600" /></div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">Fetch Status</p>
                                    <div className="text-xs font-semibold text-foreground flex flex-wrap gap-2 mt-1">
                                        {fetchedFrom.map(sub => (
                                            <span key={sub} className="px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded-md">✓ r/{sub}</span>
                                        ))}
                                        {failedFrom.map(sub => (
                                            <span key={sub} className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded-md">✗ r/{sub}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Tab Switcher ────────────────────────────────────── */}
                        <div className="flex items-center border-b border-border w-full">
                            <button
                                onClick={() => setActiveTab('table')}
                                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                                    activeTab === 'table'
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Table View
                            </button>
                            <button
                                onClick={() => setActiveTab('json')}
                                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                                    activeTab === 'json'
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                JSON View
                            </button>
                            <a
                                href="/newsletter-tester/deep-analysis"
                                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
                            >
                                Send to Deep Analysis (Tool 4) →
                            </a>
                        </div>

                        {activeTab === 'table' ? (
                            <>
                                <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-3 py-2">
                                    <Search className="text-muted-foreground" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search fetched posts..."
                                        value={filterText}
                                        onChange={(e) => setFilterText(e.target.value)}
                                        className="bg-transparent text-sm w-full outline-none placeholder:text-muted-foreground text-foreground"
                                    />
                                </div>

                                <div className="border border-border rounded-xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-muted/60 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    <th className="px-4 py-3">Subreddit</th>
                                                    <th className="px-4 py-3">Post Title</th>
                                                    <th className="px-4 py-3 text-right">Upvotes</th>
                                                    <th className="px-4 py-3 text-right">Comments</th>
                                                    <th className="px-4 py-3">Flair</th>
                                                    <th className="px-4 py-3 text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-xs divide-y divide-border">
                                                {filteredPosts.length > 0 ? (
                                                    filteredPosts.map((p, i) => (
                                                        <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                                                            <td className="px-4 py-3 font-semibold text-purple-600 whitespace-nowrap">
                                                                r/{p.subreddit}
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-foreground max-w-sm truncate" title={p.title}>
                                                                {p.title}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-foreground font-semibold">
                                                                {p.upvotes.toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-foreground font-semibold">
                                                                {p.comments.toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[10px] border border-border">
                                                                    {p.flair}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button
                                                                        onClick={() => handleCopy(p.title, i)}
                                                                        title="Copy Title"
                                                                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                                    >
                                                                        {copiedIndex === i ? (
                                                                            <Check size={14} className="text-green-500" />
                                                                        ) : (
                                                                            <Copy size={14} />
                                                                        )}
                                                                    </button>
                                                                    <a
                                                                        href={p.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        title="Open Post on Reddit"
                                                                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center cursor-pointer"
                                                                    >
                                                                        <ExternalLink size={14} />
                                                                    </a>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">
                                                            No posts match your search.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <pre className="text-xs font-mono bg-muted/30 border border-border rounded-xl p-4 text-foreground max-h-[500px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                {JSON.stringify(posts, null, 2)}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
