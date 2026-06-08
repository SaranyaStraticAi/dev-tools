'use client';

import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { ShieldCheck, RefreshCw, AlertCircle, CheckCircle, FileText, Check, Copy, Cpu, ChevronUp, ChevronDown } from 'lucide-react';

export default function ComplianceReviewTesterPage() {
    const { accounts } = useMsal();
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [draftText, setDraftText] = useState('');
    const [running, setRunning] = useState(false);

    // Prompts
    const [systemPrompt, setSystemPrompt] = useState(`You are the Chief Compliance and Quality Officer for Vibe Trader Weekly.
Your job is to review the drafted newsletter and autocorrect ANY violations of our editorial and compliance guidelines.

=== STRICT GUIDELINES ===
1. No banned vocabulary: "chaos", "blow up", "scramble", "wild", "crazy", "insane", "haywire". Remove or replace them.
2. NO exclamation marks allowed anywhere in the body copy (Opening through Section 4). Remove them.
3. No specific trade recommendations (e.g. "buy EUR/USD at 1.0850", "short gold here"). Change them to observation levels (e.g. "watch the 1.0850 level").
4. No directional calls framed as instructions ("you should go long", "this is a buy signal").
5. No income claims or return promises.
6. No absolute language around risk tools ("never lose", "can't blow up"). Soften them (e.g. "better manage your risk").
7. No fake quotes attributed to real people or real traders.
8. No fake scarcity ("only 5 spots left", "limited time offer").
9. No pressure language ("act now", "don't miss this").
10. No specific brokers named negatively without factual basis.
11. CTA text MUST match an approved option: "Try Vibe Trader", "See how it works", "Start trading smarter", "Get the edge".
12. SUBJECT and NEWSLETTER_TITLE must be visibly different (fewer than 3 shared consecutive words). Rewrite the NEWSLETTER_TITLE if they are too similar.
13. Body copy length (Opening through Section 4) must be between 400 and 500 words.
14. No URLs are invented or modified.

=== YOUR OUTPUT FORMAT ===
Return a JSON object ONLY. No markdown, no preamble.
{
  "passed": false,
  "wordCount": 420,
  "flags": [
    "Removed exclamation mark in Section 1",
    "Replaced 'blow up' with 'experience severe drawdowns'",
    "Changed CTA to 'Try Vibe Trader'"
  ],
  "fixedText": "SUBJECT: ..."
}
If the draft perfectly meets all criteria, set "passed": true, leave "flags" empty, and return the original text in "fixedText".`);
    const [userTemplate, setUserTemplate] = useState(`Review and autocorrect the following newsletter draft:\n\n{draft_text}\n\nReturn only the JSON object.`);
    const [showPromptsPanel, setShowPromptsPanel] = useState(true);

    // Results
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);



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
                    if (data.prompts.reviewSystem) setSystemPrompt(data.prompts.reviewSystem);
                    if (data.prompts.reviewUser) setUserTemplate(data.prompts.reviewUser);
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
                    reviewSystem: systemPrompt,
                    reviewUser: userTemplate,
                    changedType: 'review'
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

    const runReview = async () => {
        setRunning(true);
        setError(null);
        setResult(null);

        if (!draftText.trim()) {
            setError('Please provide draft text to review.');
            setRunning(false);
            return;
        }

        try {
            const res = await fetch('/api/newsletter-pipeline/compliance-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    draftText,
                    systemPrompt,
                    userTemplate
                }),
            });
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to run compliance review.');
            }

            setResult(data.result);
            if (data.result?.prompts) {
                setSystemPrompt(data.result.prompts.system || systemPrompt);
                setUserTemplate(data.result.prompts.userTemplate || userTemplate);
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setRunning(false);
        }
    };

    const handleCopyText = () => {
        if (!result || !result.fixedText) return;
        navigator.clipboard.writeText(result.fixedText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col items-center min-h-screen bg-background text-foreground py-10 px-4 gap-8">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="text-center max-w-2xl flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold uppercase tracking-wider">
                    <ShieldCheck size={12} />
                    Tool 7 In Isolation
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    Compliance Reviewer Tester
                </h1>
                <p className="text-sm text-muted-foreground">
                    Test the AI compliance officer that autocorrects banned vocabulary, limits, and tone.
                </p>
                <a href="/newsletter-tester"
                    className="mt-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                    ← Back to Pipeline Tester
                </a>
            </div>

            {/* ── Prompts Panel ────────────────────────────────────────────── */}
            <div className="w-full max-w-5xl bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <button
                    onClick={() => setShowPromptsPanel(!showPromptsPanel)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Cpu className="text-blue-500" size={18} />
                        <div>
                            <h3 className="text-sm font-bold text-foreground">Compliance Reviewer Prompts (Edit Freely)</h3>
                            <p className="text-xs text-muted-foreground">Click to view/edit System and User prompts sent to the LLM</p>
                        </div>
                    </div>
                    {showPromptsPanel ? <ChevronUp size={16} className="text-muted-foreground"/> : <ChevronDown size={16} className="text-muted-foreground"/>}
                </button>
                {showPromptsPanel && (
                    <div className="border-t border-border bg-muted/20">
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">System Prompt</span>
                                <textarea
                                    value={systemPrompt}
                                    onChange={(e) => setSystemPrompt(e.target.value)}
                                    rows={12}
                                    className="w-full text-[11px] font-mono bg-background border border-border rounded-xl p-4 text-foreground outline-none focus:ring-1 focus:ring-blue-500 resize-y leading-relaxed"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">User Template</span>
                                <textarea
                                    value={userTemplate}
                                    onChange={(e) => setUserTemplate(e.target.value)}
                                    rows={12}
                                    className="w-full text-[11px] font-mono bg-background border border-border rounded-xl p-4 text-foreground outline-none focus:ring-1 focus:ring-blue-500 resize-y leading-relaxed"
                                />
                            </div>
                        </div>
                        <div className="px-6 pb-6 pt-2 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <button
                                onClick={handleSavePrompts}
                                disabled={savingPrompts}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                                    savingPrompts
                                        ? 'bg-blue-100 text-blue-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
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

            {/* ── Workspace ────────────────────────────────────────────────── */}
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* ── Input Panel ─────────────────────────────────────────── */}
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
                    <div>
                        <h2 className="text-base font-bold text-foreground">Newsletter Draft (Raw Text)</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Paste the output from Tool 6 (Newsletter Writer) here.
                        </p>
                    </div>

                    <textarea
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        placeholder="SUBJECT: ...\nPREVIEW: ...\nNEWSLETTER_TITLE: ..."
                        rows={18}
                        className="w-full text-xs font-mono p-4 bg-muted/40 border border-border rounded-xl outline-none focus:ring-1 focus:ring-blue-500 text-foreground resize-none leading-relaxed"
                    />

                    <button
                        onClick={runReview}
                        disabled={running}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                            running
                                ? 'bg-blue-100 text-blue-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                        }`}
                    >
                        {running ? (
                            <>
                                <RefreshCw className="animate-spin" size={16} />
                                Running Review...
                            </>
                        ) : (
                            <>
                                <ShieldCheck size={16} />
                                Run Compliance Review (Tool 7)
                            </>
                        )}
                    </button>
                </div>

                {/* ── Output / Results Panel ──────────────────────────────── */}
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 shadow-sm min-h-[450px]">
                    <div>
                        <h2 className="text-base font-bold text-foreground">Review Results & Autocorrect</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            The sanitized output and a list of applied fixes.
                        </p>
                    </div>

                    {running && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="animate-spin text-blue-500" size={32} />
                            <span className="text-xs text-muted-foreground">AI is reviewing the draft...</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-2">
                            <AlertCircle size={16} />
                            <div><span className="font-bold">Error:</span> {error}</div>
                        </div>
                    )}

                    {!running && !error && !result && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground border border-dashed border-border rounded-xl p-8">
                            <FileText size={32} className="text-muted-foreground/50 mb-2" />
                            <span className="text-xs">Provide a draft and click "Run Compliance Review" to see the autocorrected text.</span>
                        </div>
                    )}

                    {!running && !error && result && (
                        <div className="flex flex-col gap-6 flex-1">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-4 rounded-xl border flex flex-col gap-1 ${result.passed ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${result.passed ? 'text-green-600' : 'text-yellow-600'}`}>Status</span>
                                    <span className={`text-sm font-semibold ${result.passed ? 'text-green-800' : 'text-yellow-800'}`}>
                                        {result.passed ? 'Pass (Compliant)' : 'Flags Found & Fixed'}
                                    </span>
                                </div>
                                <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Word Count</span>
                                    <span className={`text-sm font-semibold ${result.wordCount >= 400 && result.wordCount <= 500 ? 'text-foreground' : 'text-red-500'}`}>
                                        {result.wordCount} words
                                    </span>
                                </div>
                            </div>

                            {/* Flags List */}
                            {result.flags && result.flags.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold text-foreground">Applied Fixes / Flags:</span>
                                    <ul className="list-disc pl-4 flex flex-col gap-1">
                                        {result.flags.map((flag: string, i: number) => (
                                            <li key={i} className="text-[11px] text-muted-foreground leading-relaxed">{flag}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Fixed Text Output */}
                            <div className="flex flex-col gap-2 mt-2 flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-foreground">Autocorrected Text:</span>
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
                                                Copy Fixed Text
                                            </>
                                        )}
                                    </button>
                                </div>
                                <pre className="text-[11px] font-mono bg-muted/30 border border-border rounded-xl p-4 text-foreground max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {result.fixedText}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
