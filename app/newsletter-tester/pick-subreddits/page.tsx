'use client';

import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Sparkles, Flame, RefreshCw, Cpu, ChevronDown, ChevronUp, AlertCircle, Check, X, ShieldAlert } from 'lucide-react';

interface Community {
    name:        string;
    subscribers: number;
    description: string;
    url:         string;
}

const DEFAULT_MOCK_COMMUNITIES: Community[] = [
    {
        name: 'Forex',
        subscribers: 350000,
        description: 'Foreign Exchange trading, currency market strategies, analysis, charts, indicators.',
        url: 'https://reddit.com/r/Forex'
    },
    {
        name: 'wallstreetbets',
        subscribers: 15000000,
        description: 'Meme stock options trading, yolo trades, loss porn, stock market hype.',
        url: 'https://reddit.com/r/wallstreetbets'
    },
    {
        name: 'Daytrading',
        subscribers: 220000,
        description: 'Active day trading strategies, risk management, and psychology for options, futures, and forex.',
        url: 'https://reddit.com/r/Daytrading'
    },
    {
        name: 'Bitcoin',
        subscribers: 5000000,
        description: 'General discussions about Bitcoin and other cryptocurrencies.',
        url: 'https://reddit.com/r/Bitcoin'
    },
    {
        name: 'pennystocks',
        subscribers: 1800000,
        description: 'Speculative stock alerts, micro-cap stocks, pump and dumps.',
        url: 'https://reddit.com/r/pennystocks'
    },
    {
        name: 'PropFirmTrading',
        subscribers: 15000,
        description: 'Prop firm accounts, FTMO, FundedNext, Apex Trader Funding challenges, evaluations, payouts.',
        url: 'https://reddit.com/r/PropFirmTrading'
    },
    {
        name: 'binaryoptions',
        subscribers: 8000,
        description: 'Binary options trading platforms, brokers, signals.',
        url: 'https://reddit.com/r/binaryoptions'
    }
];

export default function LlmPickSubredditsTesterPage() {
    const { accounts } = useMsal();
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [inputJson, setInputJson] = useState(JSON.stringify(DEFAULT_MOCK_COMMUNITIES, null, 2));
    const [running, setRunning] = useState(false);
    const [pickedSubreddits, setPickedSubreddits] = useState<string[]>([]);
    const [lastProcessedCandidates, setLastProcessedCandidates] = useState<Community[]>([]);
    
    // Prompts
    const [systemPrompt, setSystemPrompt] = useState('');
    const [userTemplate, setUserTemplate] = useState('');
    const [showPromptsPanel, setShowPromptsPanel] = useState(false);

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

    const runFiltering = async () => {
        setRunning(true);
        setError(null);
        setPickedSubreddits([]);
        
        let parsedCandidates: Community[] = [];
        try {
            parsedCandidates = JSON.parse(inputJson);
            if (!Array.isArray(parsedCandidates) || parsedCandidates.length === 0) {
                throw new Error('Input must be a non-empty array of objects.');
            }
            setLastProcessedCandidates(parsedCandidates);
        } catch (e: any) {
            setError(`Invalid JSON: ${e.message}`);
            setRunning(false);
            return;
        }

        try {
            const res = await fetch('/api/newsletter-pipeline/pick-subreddits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ communities: parsedCandidates }),
            });
            const data = await res.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to filter subreddits.');
            }

            setPickedSubreddits(data.picked || []);
            setSystemPrompt(data.system || '');
            setUserTemplate(data.userTemplate || '');
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
                    Tool 2 In Isolation
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    AI Pick Best Subreddits Tester
                </h1>
                <p className="text-sm text-muted-foreground">
                    Test the AI content strategist filtering rules to select trading subreddits.
                </p>
                <a href="/newsletter-tester"
                    className="mt-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                    ← Back to Pipeline Tester
                </a>
            </div>

            {/* ── Prompts Used Panel ───────────────────────────────────────── */}
            {(systemPrompt || userTemplate) && (
                <div className="w-full max-w-4xl bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    <button
                        onClick={() => setShowPromptsPanel(!showPromptsPanel)}
                        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Cpu className="text-purple-500" size={18} />
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Prompts Used for Filtering</h3>
                                <p className="text-xs text-muted-foreground">Click to view System and User templates sent to the LLM</p>
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
                                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">User Template</span>
                                <pre className="text-[11px] font-mono bg-background border border-border rounded-xl p-4 text-foreground max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {userTemplate}
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
                        <h2 className="text-base font-bold text-foreground">Candidate Subreddits Input (JSON)</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Modify this JSON list to test how the AI filters various topics.
                        </p>
                    </div>

                    <textarea
                        value={inputJson}
                        onChange={(e) => setInputJson(e.target.value)}
                        rows={16}
                        className="w-full text-xs font-mono p-4 bg-muted/40 border border-border rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-foreground resize-none leading-relaxed"
                    />

                    <button
                        onClick={runFiltering}
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
                                Running AI Filter...
                            </>
                        ) : (
                            <>
                                <Flame size={16} />
                                Run AI Filter (Tool 2)
                            </>
                        )}
                    </button>
                </div>

                {/* ── Output / Results Panel ──────────────────────────────── */}
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 shadow-sm min-h-[400px]">
                    <div>
                        <h2 className="text-base font-bold text-foreground">AI Strategist Decisions</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Real-time approved vs. excluded subreddits.
                        </p>
                    </div>

                    {running && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="animate-spin text-purple-500" size={32} />
                            <span className="text-xs text-muted-foreground">AI is reviewing the communities...</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-2">
                            <AlertCircle size={16} />
                            <div><span className="font-bold">Error:</span> {error}</div>
                        </div>
                    )}

                    {!running && !error && lastProcessedCandidates.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground border border-dashed border-border rounded-xl p-8">
                            <Cpu size={32} className="text-muted-foreground/50 mb-2" />
                            <span className="text-xs">Provide candidates on the left and click "Run AI Filter" to see results.</span>
                        </div>
                    )}

                    {!running && !error && lastProcessedCandidates.length > 0 && (
                        <div className="flex flex-col gap-4 flex-1 overflow-y-auto max-h-[500px]">
                            {/* Approved Section */}
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    Approved ({pickedSubreddits.length})
                                </span>
                                
                                <div className="flex flex-col gap-2">
                                    {lastProcessedCandidates.filter(c => pickedSubreddits.includes(c.name)).map(c => (
                                        <div key={c.name} className="p-3 bg-green-50/50 border border-green-200 rounded-xl flex items-start justify-between gap-3">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs font-semibold text-green-700">r/{c.name}</span>
                                                <span className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{c.description || 'No description'}</span>
                                            </div>
                                            <Check size={14} className="text-green-600 shrink-0 mt-0.5" />
                                        </div>
                                    ))}
                                    {pickedSubreddits.length === 0 && (
                                        <span className="text-xs text-muted-foreground italic">None approved.</span>
                                    )}
                                </div>
                            </div>

                            <hr className="border-border my-2" />

                            {/* Excluded Section */}
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    Excluded ({lastProcessedCandidates.length - pickedSubreddits.length})
                                </span>
                                
                                <div className="flex flex-col gap-2">
                                    {lastProcessedCandidates.filter(c => !pickedSubreddits.includes(c.name)).map(c => (
                                        <div key={c.name} className="p-3 bg-red-50/30 border border-red-100 rounded-xl flex items-start justify-between gap-3 opacity-70">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs font-semibold text-red-700">r/{c.name}</span>
                                                <span className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{c.description || 'No description'}</span>
                                            </div>
                                            <X size={14} className="text-red-500 shrink-0 mt-0.5" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
