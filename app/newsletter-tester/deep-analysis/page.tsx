'use client';

import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Sparkles, Brain, RefreshCw, AlertCircle, Cpu, ChevronDown, ChevronUp, Check, X, Flame, Target, MessageSquare, Quote } from 'lucide-react';

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

const DEFAULT_MOCK_POSTS: RedditPostRaw[] = [
    {
        id: 'post1',
        subreddit: 'Forex',
        title: 'NFP stopped me out on EURUSD',
        selftext: 'I was long EURUSD before NFP news release and my stop loss got hit during the initial spike. Then the price reversed and went exactly where I predicted. I am so mad right now, my prop firm account blew up.',
        upvotes: 120,
        upvoteRatio: 0.89,
        comments: 30,
        author: 'trader_joe',
        flair: 'Psychology',
        url: 'https://reddit.com/r/Forex/comments/post1',
        permalink: '/r/Forex/comments/post1',
        created_utc: '2026-05-24 14:32 UTC'
    },
    {
        id: 'post2',
        subreddit: 'Daytrading',
        title: 'Gold spreads are killing me',
        selftext: 'Is anyone else noticing massive spread widening on XAUUSD during NY open? I keep getting stopped out on small pullbacks because of the brokers.',
        upvotes: 80,
        upvoteRatio: 0.92,
        comments: 20,
        author: 'gold_bug',
        flair: 'Question',
        url: 'https://reddit.com/r/Daytrading/comments/post2',
        permalink: '/r/Daytrading/comments/post2',
        created_utc: '2026-05-24 15:45 UTC'
    }
];

export default function DeepAnalysisTesterPage() {
    const { accounts } = useMsal();
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [inputJson, setInputJson] = useState(JSON.stringify(DEFAULT_MOCK_POSTS, null, 2));
    const [running, setRunning] = useState(false);
    
    // Results
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [systemPrompt, setSystemPrompt] = useState('');
    const [userPrompt, setUserPrompt] = useState('');
    const [showPromptsPanel, setShowPromptsPanel] = useState(false);
    const [activeTab, setActiveTab] = useState<'report' | 'json'>('report');

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('employee_session');
        if (saved) setEmployeeAccount(saved);
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

    const runAnalysis = async () => {
        setRunning(true);
        setError(null);
        setAnalysisResult(null);
        setSystemPrompt('');
        setUserPrompt('');
        
        let parsedPosts: RedditPostRaw[] = [];
        try {
            parsedPosts = JSON.parse(inputJson);
            if (!Array.isArray(parsedPosts) || parsedPosts.length === 0) {
                throw new Error('Input must be a non-empty array of post objects.');
            }
        } catch (e: any) {
            setError(`Invalid JSON: ${e.message}`);
            setRunning(false);
            return;
        }

        try {
            const res = await fetch('/api/newsletter-pipeline/deep-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ posts: parsedPosts }),
            });
            const data = await res.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to complete analysis.');
            }

            setAnalysisResult(data.analysis);
            if (data.analysis?.prompts) {
                setSystemPrompt(data.analysis.prompts.system || '');
                setUserPrompt(data.analysis.prompts.user || '');
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
                    Tool 4 In Isolation
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    Deep Analysis Tester
                </h1>
                <p className="text-sm text-muted-foreground">
                    Run AI Deep Analysis on posts to extract dominant sentiment, asset tags, and complaints.
                </p>
                <a href="/newsletter-tester"
                    className="mt-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                    ← Back to Pipeline Tester
                </a>
            </div>

            {/* ── Prompts Panel ────────────────────────────────────────────── */}
            {(systemPrompt || userPrompt) && (
                <div className="w-full max-w-4xl bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    <button
                        onClick={() => setShowPromptsPanel(!showPromptsPanel)}
                        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Cpu className="text-purple-500" size={18} />
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Prompts Used for Analysis</h3>
                                <p className="text-xs text-muted-foreground">Click to view System and User prompts sent to the LLM</p>
                            </div>
                        </div>
                        {showPromptsPanel ? <ChevronUp size={16} className="text-muted-foreground"/> : <ChevronDown size={16} className="text-muted-foreground"/>}
                    </button>
                    {showPromptsPanel && (
                        <div className="border-t border-border p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20">
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">System Prompt</span>
                                <pre className="text-[11px] font-mono bg-background border border-border rounded-xl p-4 text-foreground max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {systemPrompt}
                                </pre>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">User Prompt</span>
                                <pre className="text-[11px] font-mono bg-background border border-border rounded-xl p-4 text-foreground max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {userPrompt}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Main Workspace ───────────────────────────────────────────── */}
            <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* ── Input Panel ─────────────────────────────────────────── */}
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
                    <div>
                        <h2 className="text-base font-bold text-foreground">Reddit Posts Input (JSON)</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Provide a list of posts. The backend fetches comments for each post before running the LLM analyst.
                        </p>
                    </div>

                    <textarea
                        value={inputJson}
                        onChange={(e) => setInputJson(e.target.value)}
                        rows={16}
                        className="w-full text-xs font-mono p-4 bg-muted/40 border border-border rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-foreground resize-none leading-relaxed"
                    />

                    <button
                        onClick={runAnalysis}
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
                                Analyzing Dataset...
                            </>
                        ) : (
                            <>
                                <Brain size={16} />
                                Run Deep Analysis (Tool 4)
                            </>
                        )}
                    </button>
                </div>

                {/* ── Output / Results Panel ──────────────────────────────── */}
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 shadow-sm min-h-[400px]">
                    <div>
                        <h2 className="text-base font-bold text-foreground">AI Analysis Report</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Extracted market sentiment and trader pains.
                        </p>
                    </div>

                    {running && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="animate-spin text-purple-500" size={32} />
                            <span className="text-xs text-muted-foreground">AI is running sentiment intelligence analysis...</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-2">
                            <AlertCircle size={16} />
                            <div><span className="font-bold">Error:</span> {error}</div>
                        </div>
                    )}

                    {!running && !error && !analysisResult && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground border border-dashed border-border rounded-xl p-8">
                            <Brain size={32} className="text-muted-foreground/50 mb-2" />
                            <span className="text-xs">Provide mock posts on the left and click "Run Deep Analysis" to inspect results.</span>
                        </div>
                    )}

                    {!running && !error && analysisResult && (
                        <div className="flex flex-col gap-6 flex-1">
                            {/* Tab Switcher */}
                            <div className="flex border-b border-border">
                                <button
                                    onClick={() => setActiveTab('report')}
                                    className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                                        activeTab === 'report'
                                            ? 'border-purple-600 text-purple-600'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Structured Report
                                </button>
                                <button
                                    onClick={() => setActiveTab('json')}
                                    className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                                        activeTab === 'json'
                                            ? 'border-purple-600 text-purple-600'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Raw JSON Output
                                </button>
                            </div>

                            {activeTab === 'report' ? (
                                <div className="flex flex-col gap-5 overflow-y-auto max-h-[500px] pr-1">
                                    
                                    {/* Metrics Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3.5 bg-muted/40 rounded-xl border border-border flex items-center gap-2.5">
                                            <Flame size={16} className="text-red-500 shrink-0" />
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Intensity</p>
                                                <p className="text-xs font-bold text-foreground capitalize">{analysisResult.emotionalIntensity || 'Medium'}</p>
                                            </div>
                                        </div>
                                        <div className="p-3.5 bg-muted/40 rounded-xl border border-border flex items-center gap-2.5">
                                            <Target size={16} className="text-purple-500 shrink-0" />
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Asset / Event</p>
                                                <p className="text-xs font-bold text-foreground">{analysisResult.currencyOrEvent || 'Unknown'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Dominant Pain Theme */}
                                    <div className="flex flex-col gap-1.5 p-4 bg-purple-50/30 border border-purple-100 rounded-xl">
                                        <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Dominant Pain Theme</span>
                                        <p className="text-xs font-semibold text-foreground leading-relaxed">
                                            {analysisResult.dominantPainTheme}
                                        </p>
                                    </div>

                                    {/* Key Phrases */}
                                    {analysisResult.keyPhrases && analysisResult.keyPhrases.length > 0 && (
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                <Quote size={12} />
                                                Verbatim Quotes / Phrases
                                            </span>
                                            <div className="flex flex-col gap-1.5">
                                                {analysisResult.keyPhrases.map((phrase: string, idx: number) => (
                                                    <span key={idx} className="text-xs italic bg-muted/30 border border-border p-2.5 rounded-lg text-foreground block">
                                                        "{phrase}"
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Analysis Notes */}
                                    {analysisResult.analysisNotes && (
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Analyst Notes & Context</span>
                                            <p className="text-xs text-muted-foreground bg-muted/10 border border-border p-3.5 rounded-xl leading-relaxed whitespace-pre-line">
                                                {analysisResult.analysisNotes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <pre className="text-xs font-mono bg-muted/30 border border-border rounded-xl p-4 text-foreground max-h-[500px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {JSON.stringify(analysisResult, null, 2)}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
