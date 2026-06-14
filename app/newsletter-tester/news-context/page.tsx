'use client';

import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Sparkles, Newspaper, RefreshCw, AlertCircle, Search, ExternalLink, Link, FileText, Globe } from 'lucide-react';

interface ReferenceLink {
    title: string;
    url: string;
    source: string;
}

interface NewsContext {
    query:          string;
    summary:        string;
    referenceLinks: ReferenceLink[];
}

export default function NewsContextTesterPage() {
    const { accounts } = useMsal();
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [queryInput, setQueryInput] = useState('NFP');
    const [running, setRunning] = useState(false);

    const [newsData, setNewsData] = useState<NewsContext | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'cards' | 'json'>('cards');
    const [isUsingAnalysis, setIsUsingAnalysis] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('employee_session');
        if (saved) setEmployeeAccount(saved);

        // Load query from Tool 4 analysis results if available
        const analysisRaw = localStorage.getItem('reddit_analysis_result');
        if (analysisRaw) {
            try {
                const analysis = JSON.parse(analysisRaw);
                if (analysis && analysis.currencyOrEvent) {
                    setQueryInput(analysis.currencyOrEvent);
                    setIsUsingAnalysis(true);
                }
            } catch {}
        }
    }, []);

    const userEmail = accounts[0]?.username;
    const isAllowed = userEmail === 'masood@aity.dev' || employeeAccount === 'ketki@vibetrader.com' || userEmail === 'ketki@vibetrader.com';

    if (!mounted) return null;

    if (!isAllowed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background">
                <span className="text-2xl">🔒</span>
                <p className="text-sm text-muted-foreground mt-2">Access Denied. Only Masood and Ketki are allowed.</p>
            </div>
        );
    }

    const runFetchNews = async () => {
        if (!queryInput.trim()) {
            setError('Please enter a query to search.');
            return;
        }

        setRunning(true);
        setError(null);
        setNewsData(null);

        try {
            const res = await fetch('/api/newsletter-pipeline/news-context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currencyOrEvent: queryInput }),
            });
            const data = await res.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch news context.');
            }

            setNewsData(data.news);
            if (data.news) {
                localStorage.setItem('reddit_news_context', JSON.stringify(data.news));
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen bg-background text-foreground py-10 px-4 gap-8">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="text-center max-w-2xl flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-600 text-xs font-semibold uppercase tracking-wider">
                    <Sparkles size={12} />
                    Tool 5 In Isolation
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    Market News Tester
                </h1>
                <p className="text-sm text-muted-foreground">
                    Search and fetch recent financial articles on currency pairs or macro events using Serper.
                </p>
                <a href="/newsletter-tester"
                    className="mt-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                    ← Back to Pipeline Tester
                </a>
            </div>

            {/* ── Workspace ────────────────────────────────────────────────── */}
            <div className="w-full max-w-4xl bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
                
                {/* ── Input Controls ───────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="flex-1 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-foreground">Asset or Macro Event Query</label>
                            {isUsingAnalysis && (
                                <span className="flex items-center gap-2 text-[10px] text-green-600 dark:text-green-400 font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Loaded from Tool 4
                                    <button
                                        onClick={() => {
                                            setQueryInput('NFP');
                                            setIsUsingAnalysis(false);
                                            localStorage.removeItem('reddit_analysis_result');
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
                            value={queryInput}
                            onChange={(e) => setQueryInput(e.target.value)}
                            placeholder="e.g. NFP, EUR/USD, gold, FOMC"
                            className="w-full text-sm px-3.5 py-2 border border-border rounded-xl outline-none focus:ring-1 focus:ring-purple-500 bg-background text-foreground"
                        />
                    </div>

                    <button
                        onClick={runFetchNews}
                        disabled={running}
                        className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                            running
                                ? 'bg-purple-100 text-purple-400 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                        }`}
                    >
                        {running ? (
                            <>
                                <RefreshCw className="animate-spin" size={16} />
                                Fetching News...
                            </>
                        ) : (
                            <>
                                <Newspaper size={16} />
                                Fetch Market News (Tool 5)
                            </>
                        )}
                    </button>
                </div>

                {/* ── Error ─────────────────────────────────────────────── */}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle size={16} />
                        <div><span className="font-bold">Error:</span> {error}</div>
                    </div>
                )}

                {/* ── Results ───────────────────────────────────────────── */}
                {newsData && !running && (
                    <div className="flex flex-col gap-6 mt-2">
                        
                        {/* Stats Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-muted/40 rounded-xl border border-border flex items-center gap-3">
                                <div className="p-2 bg-purple-55 rounded-lg"><Search size={18} className="text-purple-600" /></div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Search Target</p>
                                    <p className="text-lg font-bold text-foreground">"{newsData.query}"</p>
                                </div>
                            </div>

                            <div className="p-4 bg-muted/40 rounded-xl border border-border flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-lg"><Globe size={18} className="text-indigo-600" /></div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Articles Found</p>
                                    <p className="text-lg font-bold text-foreground">{newsData.referenceLinks.length}</p>
                                </div>
                            </div>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex items-center border-b border-border w-full">
                            <button
                                onClick={() => setActiveTab('cards')}
                                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                                    activeTab === 'cards'
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Articles View
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
                                href="/newsletter-tester/newsletter-writer"
                                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
                            >
                                Send to Tool 6 (Writer) →
                            </a>
                        </div>

                        {activeTab === 'cards' ? (
                            <div className="flex flex-col gap-4">
                                {newsData.referenceLinks.length > 0 ? (
                                    newsData.referenceLinks.map((link, idx) => (
                                        <div key={idx} className="p-4 bg-card border border-border rounded-xl flex items-start justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex flex-col gap-1 min-w-0">
                                                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider bg-purple-50 px-2 py-0.5 rounded border border-purple-100 self-start">
                                                    {link.source}
                                                </span>
                                                <h3 className="text-xs font-bold text-foreground leading-relaxed mt-1 break-words">
                                                    {link.title}
                                                </h3>
                                            </div>
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors flex items-center justify-center shrink-0"
                                            >
                                                <ExternalLink size={16} />
                                            </a>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl italic">
                                        No articles were found matching this query.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <pre className="text-xs font-mono bg-muted/30 border border-border rounded-xl p-4 text-foreground max-h-[500px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                {JSON.stringify(newsData, null, 2)}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
