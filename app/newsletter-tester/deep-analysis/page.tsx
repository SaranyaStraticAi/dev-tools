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
    const [systemPrompt, setSystemPrompt] = useState(`You are a senior analyst for Vibe Trader Weekly, a professional forex and retail trading newsletter.
You have the COMPLETE Reddit dataset for this week — every post and every comment thread.

Find the dominant trader pain theme and return structured analysis as JSON.

CRITICAL RULE for "currencyOrEvent" field:
- First check: is the dominant pain theme PSYCHOLOGICAL or BEHAVIOURAL?
  * If the pain is about emotions, discipline, revenge trading, FOMO, blown accounts, psychology, mindset, confidence, fear, greed, or prop firm rule-breaking → set currencyOrEvent to "forex market". Do NOT hunt for a ticker.
  * Psychological pain has no specific instrument — using a random ticker produces irrelevant news.
- Second check (only if pain is NOT psychological): extract the actual asset or macro event most discussed
- Must be ONLY the asset name or event — maximum 4 words
- Correct format: "EUR/USD", "GBP/JPY", "NFP", "FOMC", "gold", "US30", "NAS100", "crude oil"
- Wrong format: "prop firm account blowups", "emotional trading after success", "funded account psychology"
- If truly no specific asset is mentioned → use "forex market"
- DO NOT default to any specific asset — read the actual data

Respond ONLY with valid JSON:
{
  "dominantPainTheme": "full description of the psychological or behavioral pain traders are expressing",
  "emotionalIntensity": "high|medium|low",
  "keyPhrases": ["exact phrase traders used verbatim", "another exact phrase"],
  "currencyOrEvent": "the specific asset or macro event most discussed — e.g. EUR/USD or NFP or gold or US30 — 4 words max, asset name only",
  "bestPostIndex": 0,
  "supportingPostIndices": [1, 3],
  "analysisNotes": "your reasoning about why this theme dominates"
}
No markdown, no backticks — raw JSON only.`);
    const [userPrompt, setUserPrompt] = useState(`Analyze the complete Reddit trading dataset for this week.\n\nCOMPLETE DATASET ({postCount} posts, {commentCount} comments):\n\n{fullDataset}`);
    const [showPromptsPanel, setShowPromptsPanel] = useState(true);
    const [activeTab, setActiveTab] = useState<'report' | 'json'>('report');

    const [error, setError] = useState<string | null>(null);



    // Save states
    const [savingPrompts, setSavingPrompts] = useState(false);
    const [saveStatusMsg, setSaveStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('employee_session');
        if (saved) setEmployeeAccount(saved);

        // Load active prompts from Azure Blob
        (async () => {
            try {
                const res = await fetch('/api/newsletter-prompts');
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                if (data.exists && data.prompts) {
                    if (data.prompts.analysisSystem) setSystemPrompt(data.prompts.analysisSystem);
                    if (data.prompts.analysisUser) setUserPrompt(data.prompts.analysisUser);
                }
            } catch (e) {
                console.warn('Failed to load prompts from Azure Blob:', e);
            }
        })();
    }, []);

    const handleSavePrompts = async () => {
        setSavingPrompts(true);
        setSaveStatusMsg(null);
        try {
            const postRes = await fetch('/api/newsletter-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    analysisSystem: systemPrompt,
                    analysisUser: userPrompt,
                    changedType: 'analysis'
                }),
            });
            const postData = await postRes.json();
            if (!postRes.ok) throw new Error(postData.error || 'Failed to save prompts');
            
            setSaveStatusMsg({ text: 'Prompts successfully published to Azure Blob!', type: 'success' });
            setTimeout(() => setSaveStatusMsg(null), 5000);
        } catch (e: any) {
            setSaveStatusMsg({ text: `Save failed: ${e.message}`, type: 'error' });
        } finally {
            setSavingPrompts(false);
        }
    };

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
                body: JSON.stringify({ 
                    posts: parsedPosts,
                    systemPrompt,
                    userPrompt
                }),
            });
            const data = await res.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to complete analysis.');
            }

            setAnalysisResult(data.analysis);
            if (data.analysis?.prompts) {
                setSystemPrompt(data.analysis.prompts.system || systemPrompt);
                setUserPrompt(data.analysis.prompts.userTemplate || userPrompt);
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
            <div className="w-full max-w-4xl bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <button
                    onClick={() => setShowPromptsPanel(!showPromptsPanel)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Cpu className="text-purple-500" size={18} />
                        <div>
                            <h3 className="text-sm font-bold text-foreground">Analysis Prompts (Edit Freely)</h3>
                            <p className="text-xs text-muted-foreground">Click to view/edit System and User prompts sent to the LLM</p>
                        </div>
                    </div>
                    {showPromptsPanel ? <ChevronUp size={16} className="text-muted-foreground"/> : <ChevronDown size={16} className="text-muted-foreground"/>}
                </button>
                {showPromptsPanel && (
                    <div className="border-t border-border bg-muted/20">
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">System Prompt</span>
                                <textarea
                                    value={systemPrompt}
                                    onChange={(e) => setSystemPrompt(e.target.value)}
                                    rows={10}
                                    className="w-full text-[11px] font-mono bg-background border border-border rounded-xl p-4 text-foreground outline-none focus:ring-1 focus:ring-purple-500 resize-y leading-relaxed"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">User Template</span>
                                <textarea
                                    value={userPrompt}
                                    onChange={(e) => setUserPrompt(e.target.value)}
                                    rows={10}
                                    className="w-full text-[11px] font-mono bg-background border border-border rounded-xl p-4 text-foreground outline-none focus:ring-1 focus:ring-purple-500 resize-y leading-relaxed"
                                />
                            </div>
                        </div>
                        <div className="px-6 pb-6 pt-2 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <button
                                onClick={handleSavePrompts}
                                disabled={savingPrompts}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                                    savingPrompts
                                        ? 'bg-purple-100 text-purple-400 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                                }`}
                            >
                                {savingPrompts ? (
                                    <>
                                        <RefreshCw className="animate-spin" size={14} />
                                        Saving to Azure...
                                    </>
                                ) : (
                                    <>☁️ Save & Publish to Azure Blob</>
                                )}
                            </button>
                            {saveStatusMsg && (
                                <span className={`text-xs font-medium px-3 py-1 rounded-lg ${
                                    saveStatusMsg.type === 'success' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                }`}>
                                    {saveStatusMsg.text}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

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
