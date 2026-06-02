'use client';

import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Sparkles, RefreshCw, AlertCircle, Cpu, ChevronDown, ChevronUp, CheckCircle, FileText, Check, Copy, Puzzle } from 'lucide-react';

const DEFAULT_MOCK_INPUT = [
    {
        rank: 1,
        subreddit: "Forex",
        title: "I blew 40% of my account in one trade and I don't know what to do",
        selftext: "I didn't use a stop loss and overleveraged during the news release. The market moved 100 pips against me in minutes. I am completely devastated and thinking of quitting.",
        upvotes: 2841,
        comments: 312,
        flair: "Discussion",
        url: "https://reddit.com/r/Forex/comments/sample1",
        created_utc: "2026-04-29 08:14 UTC"
    },
    {
        rank: 2,
        subreddit: "Daytrading",
        title: "Why does my stop always get hit right before the move happens?",
        selftext: "It happens on EUR/USD almost daily. I set my stop loss at the recent swing low/high, price sweeps it by a few pips, and then goes exactly in my intended direction. Is this stop hunting by market makers?",
        upvotes: 1654,
        comments: 187,
        flair: "Question",
        url: "https://reddit.com/r/Forex/comments/sample2",
        created_utc: "2026-04-30 11:02 UTC"
    },
    {
        rank: 3,
        subreddit: "trading",
        title: "Been trading 2 years, still not consistently profitable",
        selftext: "I have read all the books and watched endless YouTube videos. I have green weeks and then lose it all in one day. I feel like I'm stuck in a loop of hope and failure.",
        upvotes: 1203,
        comments: 241,
        flair: "Advice",
        url: "https://reddit.com/r/Forex/comments/sample3",
        created_utc: "2026-05-01 09:45 UTC"
    }
];

export default function PuzzleWriterTesterPage() {
    const { accounts } = useMsal();
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [inputJson, setInputJson] = useState(JSON.stringify(DEFAULT_MOCK_INPUT, null, 2));
    const [running, setRunning] = useState(false);

    // Results
    const [rawText, setRawText] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [userTemplate, setUserTemplate] = useState('');
    const [showPromptsPanel, setShowPromptsPanel] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');
    const [copied, setCopied] = useState(false);
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

    const runWriter = async () => {
        setRunning(true);
        setError(null);
        setRawText('');
        setSystemPrompt('');
        setUserTemplate('');

        let parsedInput: any = [];
        try {
            parsedInput = JSON.parse(inputJson);
            if (!Array.isArray(parsedInput)) {
                throw new Error('JSON input must be an array of Reddit posts.');
            }
        } catch (e: any) {
            setError(`Invalid JSON: ${e.message}`);
            setRunning(false);
            return;
        }

        try {
            const res = await fetch('/api/newsletter-pipeline/puzzle-writer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedInput),
            });
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to generate puzzle content.');
            }

            setRawText(data.result.rawText || '');
            if (data.prompts) {
                setSystemPrompt(data.prompts.system || '');
                setUserTemplate(data.prompts.userTemplate || '');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setRunning(false);
        }
    };

    const handleCopyText = () => {
        navigator.clipboard.writeText(rawText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Helper to parse labeled output text
    const parseLabels = (text: string) => {
        if (!text) return [];
        const lines = text.split('\n');
        const sections: Array<{ label: string; content: string }> = [];
        let currentLabel = '';
        let currentContent: string[] = [];

        for (const line of lines) {
            const match = line.match(/^([A-Z0-9_]+):(.*)$/);
            if (match) {
                if (currentLabel) {
                    sections.push({ label: currentLabel, content: currentContent.join('\n').trim() });
                }
                currentLabel = match[1];
                currentContent = [match[2]];
            } else {
                if (currentLabel) {
                    currentContent.push(line);
                }
            }
        }
        if (currentLabel) {
            sections.push({ label: currentLabel, content: currentContent.join('\n').trim() });
        }
        return sections;
    };

    const parsedSections = parseLabels(rawText);

    return (
        <div className="flex flex-col items-center min-h-screen bg-background text-foreground py-10 px-4 gap-8">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="text-center max-w-2xl flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-600 text-xs font-semibold uppercase tracking-wider">
                    <Puzzle size={12} />
                    Tool 06b In Isolation
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    Tuesday Puzzle Writer Tester
                </h1>
                <p className="text-sm text-muted-foreground">
                    Test the Tuesday puzzle writer AI using prompt briefs pulled in real-time from Azure Blob.
                </p>
                <a href="/newsletter-tester"
                    className="mt-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                    ← Back to Pipeline Tester
                </a>
            </div>

            {/* ── Prompts Panel ────────────────────────────────────────────── */}
            {(systemPrompt || userTemplate) && (
                <div className="w-full max-w-4xl bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    <button
                        onClick={() => setShowPromptsPanel(!showPromptsPanel)}
                        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Cpu className="text-purple-500" size={18} />
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Prompts Used for Generation (Loaded from Azure Blob)</h3>
                                <p className="text-xs text-muted-foreground">Click to view active prompts currently published in Blob Storage</p>
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

            {/* ── Workspace ────────────────────────────────────────────────── */}
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* ── Input Panel ─────────────────────────────────────────── */}
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
                    <div>
                        <h2 className="text-base font-bold text-foreground">Pipeline Inputs (JSON Array)</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Scraped Reddit posts containing raw trader sentiment.
                        </p>
                    </div>

                    <textarea
                        value={inputJson}
                        onChange={(e) => setInputJson(e.target.value)}
                        rows={18}
                        className="w-full text-xs font-mono p-4 bg-muted/40 border border-border rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-foreground resize-none leading-relaxed"
                    />

                    <button
                        onClick={runWriter}
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
                                Generating Tuesday Puzzle...
                            </>
                        ) : (
                            <>
                                <Puzzle size={16} />
                                Generate Tuesday Puzzle (Tool 06b)
                            </>
                        )}
                    </button>
                </div>

                {/* ── Output / Results Panel ──────────────────────────────── */}
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 shadow-sm min-h-[450px]">
                    <div>
                        <h2 className="text-base font-bold text-foreground">AI Labeled Output</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Tuesday puzzle components parsed into structured sections.
                        </p>
                    </div>

                    {running && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="animate-spin text-purple-500" size={32} />
                            <span className="text-xs text-muted-foreground">AI writer is drafting the puzzle content...</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-2">
                            <AlertCircle size={16} />
                            <div><span className="font-bold">Error:</span> {error}</div>
                        </div>
                    )}

                    {!running && !error && !rawText && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground border border-dashed border-border rounded-xl p-8">
                            <Puzzle size={32} className="text-muted-foreground/50 mb-2" />
                            <span className="text-xs">Provide mock posts array and click "Generate Tuesday Puzzle" to run.</span>
                        </div>
                    )}

                    {!running && !error && rawText && (
                        <div className="flex flex-col gap-6 flex-1">
                            {/* Tab Switcher */}
                            <div className="flex border-b border-border justify-between items-center">
                                <div className="flex">
                                    <button
                                        onClick={() => setActiveTab('preview')}
                                        className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                                            activeTab === 'preview'
                                                ? 'border-purple-600 text-purple-600'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Puzzle Preview
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('json')}
                                        className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                                            activeTab === 'json'
                                                ? 'border-purple-600 text-purple-600'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Raw Text Output
                                    </button>
                                </div>

                                <button
                                    onClick={handleCopyText}
                                    className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground font-semibold border border-border"
                                >
                                    {copied ? (
                                        <>
                                            <Check size={12} className="text-green-500" />
                                            Copied
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={12} />
                                            Copy Raw Text
                                        </>
                                    )}
                                </button>
                            </div>

                            {activeTab === 'preview' ? (
                                <div className="flex flex-col gap-4 overflow-y-auto max-h-[520px] pr-1">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-lg border border-green-200 self-start uppercase">
                                        <CheckCircle size={12} />
                                        Generated Successfully
                                    </div>
                                    
                                    <div className="flex flex-col gap-4">
                                        {parsedSections.map((sec, idx) => (
                                            <div key={idx} className="p-4 bg-muted/20 border border-border rounded-xl flex flex-col gap-1.5 shadow-sm">
                                                <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-widest">{sec.label}</span>
                                                <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-medium">
                                                    {sec.content}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <pre className="text-xs font-mono bg-muted/30 border border-border rounded-xl p-4 text-foreground max-h-[520px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {rawText}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
