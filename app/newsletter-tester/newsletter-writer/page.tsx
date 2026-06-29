'use client';

import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Sparkles, Edit, RefreshCw, AlertCircle, Cpu, ChevronDown, ChevronUp, Layers, CheckCircle, FileText, Check, Copy } from 'lucide-react';

const DEFAULT_MOCK_INPUT = {
    analysis: {
        dominantPainTheme: "Getting stopped out by news volatility before the actual market rally",
        emotionalIntensity: "high",
        currencyOrEvent: "NFP",
        keyPhrases: ["swept my stop", "news volatility", "prop firm blowup", "manipulation"],
        analysisNotes: "Traders are complaining that spreads widened and news volatility knocked them out of EURUSD longs just before price surged 100 pips.",
        bestPost: {
            id: "post1",
            subreddit: "Forex",
            title: "NFP stopped me out on EURUSD",
            selftext: "I was long EURUSD before NFP news release and my stop loss got hit during the initial spike. Then the price reversed and went exactly where I predicted. I am so mad right now, my prop firm account blew up.",
            upvotes: 120,
            comments: 30,
            flair: "Psychology",
            url: "https://reddit.com/r/Forex/comments/post1",
            created_utc: "2026-05-24 14:32 UTC",
            topComments: ["trader_bob: Same here, NYC spread widening swept my stops.", "scalper_joe: news trading is a trap"]
        },
        supportingPosts: []
    },
    news: {
        query: "NFP",
        summary: "",
        referenceLinks: [
            {
                title: "US Non-Farm Payrolls Surge by 272K in May, Spurring Dollar Rally",
                url: "https://www.forexlive.com/news/us-non-farm-payrolls-surge",
                source: "forexlive.com"
            }
        ]
    }
};

export default function NewsletterWriterTesterPage() {
    const { accounts } = useMsal();
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [inputJson, setInputJson] = useState(JSON.stringify(DEFAULT_MOCK_INPUT, null, 2));
    const [running, setRunning] = useState(false);

    // Results
    const [rawText, setRawText] = useState('');
    const [attempt, setAttempt] = useState(1);
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

        let parsedInput: any = {};
        try {
            parsedInput = JSON.parse(inputJson);
            if (!parsedInput.analysis || !parsedInput.news) {
                throw new Error('JSON must contain both "analysis" and "news" keys.');
            }
        } catch (e: any) {
            setError(`Invalid JSON: ${e.message}`);
            setRunning(false);
            return;
        }

        try {
            const res = await fetch('/api/newsletter-pipeline/newsletter-writer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedInput),
            });
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to generate newsletter content.');
            }

            setRawText(data.result.rawText || '');
            setAttempt(data.result.attempt || 1);
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
                    <Sparkles size={12} />
                    Tool 6 In Isolation
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    Newsletter Writer Tester
                </h1>
                <p className="text-sm text-muted-foreground">
                    Test the newsletter writer AI ghostwriter using prompts pulled in real-time from Azure Blob.
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
                        <h2 className="text-base font-bold text-foreground">Pipeline Inputs (JSON)</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Combined sentiment analysis details and market news sources.
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
                                Generating Newsletter...
                            </>
                        ) : (
                            <>
                                <Edit size={16} />
                                Generate Newsletter (Tool 6)
                            </>
                        )}
                    </button>
                </div>

                {/* ── Output / Results Panel ──────────────────────────────── */}
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 shadow-sm min-h-[450px]">
                    <div>
                        <h2 className="text-base font-bold text-foreground">AI Labeled Output</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Generated newsletter copy parsed into structured sections.
                        </p>
                    </div>

                    {running && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="animate-spin text-purple-500" size={32} />
                            <span className="text-xs text-muted-foreground">AI writer is drafting the HTML content...</span>
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
                            <FileText size={32} className="text-muted-foreground/50 mb-2" />
                            <span className="text-xs">Provide mock intelligence dataset and click "Generate Newsletter" to run.</span>
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
                                        Newsletter Preview
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
                                        Generated in {attempt} {attempt === 1 ? 'attempt' : 'attempts'}
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
