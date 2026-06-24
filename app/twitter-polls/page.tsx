'use client';
// app/twitter-polls/page.tsx
// Generate AI poll questions from live market news.
// Prompts are loaded from Azure Blob on mount — shared across all team members.
// Designer edits system + user prompts here and saves back to Blob.

import { useState, useRef, useEffect } from 'react';
import {
    CheckCircle, XCircle, RefreshCw, Loader2, Twitter,
    ChevronDown, ChevronUp, RotateCcw, Save, CloudOff,
} from 'lucide-react';
import type { TwitterPoll } from '@/lib/twitter-poll-queue';

// ── Hardcoded defaults (mirror route.ts) ─────────────────────────────────────

const DEFAULT_SYSTEM =
`You are a financial content strategist creating engaging Twitter poll questions for VibeTrader — an AI-powered forex and trading platform used by retail traders worldwide.

Today's date: {{TODAY}}

Generate EXACTLY 3 poll objects. One per angle:
1. "directional"  — price direction for a specific pair/asset (e.g. "Will EUR/USD close higher today?")
2. "comparative"  — which of two assets/pairs will outperform (e.g. "Gold vs Bitcoin — which wins this week?")
3. "sentiment"    — trader opinion or market mood (e.g. "What's your biggest risk right now?")

TWITTER HARD LIMITS:
• question: MAX 140 chars
• Each option: MAX 25 chars
• 2–4 options per poll

Return ONLY a JSON array, no markdown, no extra text:
[
  {
    "question":  "Will EUR/USD close higher today?",
    "options":   ["Yes, higher", "No, lower", "Flat"],
    "hashtags":  ["Forex", "EURUSD", "ForexTrading"],
    "cashtags":  ["EURUSD", "DXY"],
    "angle":     "directional",
    "topicKey":  "eurusd-directional",
    "rationale": "CPI data today may push DXY (max 120 chars)"
  },
  ...2 more...
]

RULES:
• hashtags: 3–5, NO # prefix
• cashtags: 1–3, NO $ prefix
• topicKey: lowercase slug, format "{asset}-{angle}"
• Questions must be SPECIFIC to today's actual news — not generic filler`;

const DEFAULT_USER =
`Today's market context:

{{CONTEXT}}

Generate 3 poll questions (one directional, one comparative, one sentiment) as a JSON array.`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry { step: string; status: string; message?: string; }
type Tab = 'pending_review' | 'approved' | 'rejected';

const ANGLE_BADGE: Record<string, string> = {
    directional: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    comparative: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    sentiment:   'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
    const icon =
        entry.status === 'running' ? <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" /> :
        entry.status === 'done'    ? <CheckCircle size={14} className="text-green-500 shrink-0" /> :
        entry.status === 'error'   ? <XCircle size={14} className="text-red-500 shrink-0" /> :
        <span className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground shrink-0 inline-block" />;
    return (
        <div className="flex items-center gap-2 text-sm py-0.5">
            {icon}
            <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{entry.step}</span>
            <span>{entry.message ?? entry.status}</span>
        </div>
    );
}

function PollCard({ poll, showActions, onApprove, onReject }: {
    poll: TwitterPoll; showActions: boolean;
    onApprove?: (id: string) => void; onReject?: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-sm flex flex-col">
            <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ANGLE_BADGE[poll.angle] ?? 'bg-gray-100 text-gray-700'}`}>
                    {poll.angle}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(poll.createdAt).toLocaleTimeString()}</span>
            </div>
            <p className="font-semibold leading-snug">{poll.question}</p>
            <div className="grid grid-cols-2 gap-1.5">
                {poll.options.map((o, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-center truncate">{o}</div>
                ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {poll.hashtags.map((h) => <span key={h} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">#{h}</span>)}
                {poll.cashtags.map((c) => <span key={c} className="text-xs bg-muted px-2 py-0.5 rounded-full text-green-700 dark:text-green-400 font-mono">${c}</span>)}
            </div>
            {poll.rationale && <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2 leading-relaxed">{poll.rationale}</p>}
            <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-auto pt-1">
                {open ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} {open ? 'Hide' : 'Show'} source context
            </button>
            {open && (poll.headlines.length > 0 || poll.events.length > 0) && (
                <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
                    {poll.headlines.length > 0 && <div><p className="font-semibold text-foreground mb-1">News used:</p><ul className="list-disc list-inside space-y-0.5">{poll.headlines.map((h, i) => <li key={i}>{h}</li>)}</ul></div>}
                    {poll.events.length > 0 && <div><p className="font-semibold text-foreground mb-1">Events:</p><ul className="list-disc list-inside space-y-0.5">{poll.events.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
                </div>
            )}
            {showActions && (
                <div className="flex gap-2 pt-1">
                    <button onClick={() => onApprove?.(poll.id)} className="flex items-center gap-1.5 flex-1 justify-center rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 transition-colors">
                        <CheckCircle size={14}/> Approve
                    </button>
                    <button onClick={() => onReject?.(poll.id)} className="flex items-center gap-1.5 flex-1 justify-center rounded-lg border border-border hover:bg-muted text-sm font-medium px-4 py-2 transition-colors">
                        <XCircle size={14}/> Reject
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TwitterPollsPage() {
    // Polls state
    const [generating, setGenerating] = useState(false);
    const [log,        setLog]        = useState<LogEntry[]>([]);
    const [tab,        setTab]        = useState<Tab>('pending_review');
    const [polls,      setPolls]      = useState<TwitterPoll[]>([]);
    const [loading,    setLoading]    = useState(false);
    const [toast,      setToast]      = useState<string | null>(null);

    // Prompt editor state
    const [promptOpen,   setPromptOpen]   = useState(false);
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM);
    const [userPrompt,   setUserPrompt]   = useState(DEFAULT_USER);
    const [savedAt,      setSavedAt]      = useState<string | null>(null);
    const [saving,       setSaving]       = useState(false);
    const [blobLoaded,   setBlobLoaded]   = useState(false);

    const logEnd = useRef<HTMLDivElement>(null);

    // Load prompts from Blob on mount
    useEffect(() => {
        fetch('/api/twitter-poll-prompts')
            .then(r => r.json())
            .then(data => {
                if (data?.exists && data?.prompts) {
                    if (data.prompts.twitterPollSystem) setSystemPrompt(data.prompts.twitterPollSystem);
                    if (data.prompts.twitterPollUser)   setUserPrompt(data.prompts.twitterPollUser);
                    if (data.prompts.publishedAt)       setSavedAt(data.prompts.publishedAt);
                }
                setBlobLoaded(true);
            })
            .catch(() => setBlobLoaded(true));
    }, []);

    useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [log]);
    useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);
    useEffect(() => { loadPolls(tab); }, [tab]); // eslint-disable-line

    async function loadPolls(status: Tab) {
        setLoading(true);
        try {
            const res  = await fetch(`/api/twitter-polls/queue?status=${status}`);
            const data = await res.json();
            setPolls(data.polls ?? []);
        } finally { setLoading(false); }
    }

    async function handleGenerate() {
        setGenerating(true); setLog([]);
        try {
            const res = await fetch('/api/twitter-polls/generate', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                // Only send if the user modified from what blob has (live override)
                body: JSON.stringify({
                    systemPrompt: systemPrompt !== DEFAULT_SYSTEM ? systemPrompt : undefined,
                    userPrompt:   userPrompt   !== DEFAULT_USER   ? userPrompt   : undefined,
                }),
            });
            if (!res.body) throw new Error('No stream');
            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let   buf     = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split('\n'); buf = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const ev  = JSON.parse(line.slice(6));
                        const msg = ev.data?.message;
                        setLog(prev => {
                            const i = prev.findIndex(e => e.step === ev.step);
                            const entry: LogEntry = { step: ev.step, status: ev.status, message: msg };
                            return i >= 0 ? prev.map((e, idx) => idx === i ? entry : e) : [...prev, entry];
                        });
                    } catch { /* ignore */ }
                }
            }
            if (tab === 'pending_review') await loadPolls('pending_review');
            else setTab('pending_review');
        } catch (err: any) {
            setLog(prev => [...prev, { step: 'error', status: 'error', message: err.message }]);
        } finally { setGenerating(false); }
    }

    async function handleSavePrompts() {
        setSaving(true);
        try {
            const res  = await fetch('/api/twitter-poll-prompts', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ twitterPollSystem: systemPrompt, twitterPollUser: userPrompt }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSavedAt(data.publishedAt);
            setToast('Prompts saved to Azure Blob ✓ — all team members will use these now');
        } catch (err: any) {
            setToast(`Save failed: ${err.message}`);
        } finally { setSaving(false); }
    }

    async function handleAction(id: string, status: 'approved' | 'rejected') {
        await fetch('/api/twitter-polls/queue', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
        });
        setToast(status === 'approved' ? 'Poll approved ✓' : 'Poll rejected');
        await loadPolls(tab);
    }

    const sysModified  = systemPrompt !== DEFAULT_SYSTEM;
    const userModified = userPrompt   !== DEFAULT_USER;
    const anyModified  = sysModified || userModified;

    const TABS: { key: Tab; label: string }[] = [
        { key: 'pending_review', label: 'Pending review' },
        { key: 'approved',       label: 'Approved' },
        { key: 'rejected',       label: 'Rejected' },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-5 pb-16">
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 max-w-sm bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg">
                    {toast}
                </div>
            )}

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/40">
                        <Twitter size={20} className="text-sky-600 dark:text-sky-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Twitter Poll Generator</h1>
                        <p className="text-sm text-muted-foreground">AI-generated from today's live market news — review before posting</p>
                    </div>
                </div>
                <button onClick={handleGenerate} disabled={generating}
                    className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                    {generating
                        ? <><Loader2 size={14} className="animate-spin"/> Generating...</>
                        : <><RefreshCw size={14}/> Generate polls</>}
                </button>
            </div>

            {/* ── Prompt editor ──────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header bar */}
                <button onClick={() => setPromptOpen(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-sm font-medium">
                    <span className="flex items-center gap-2">
                        {anyModified && !savedAt && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />}
                        Prompt editor
                        {!blobLoaded
                            ? <span className="text-xs text-muted-foreground font-normal">Loading from Blob...</span>
                            : savedAt
                                ? <span className="text-xs text-green-600 font-normal">
                                    Saved {new Date(savedAt).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                                  </span>
                                : <span className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                                    <CloudOff size={11}/> Not yet saved to Blob — team sees defaults
                                  </span>
                        }
                    </span>
                    {promptOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                </button>

                {promptOpen && (
                    <div className="border-t border-border p-4 space-y-5">

                        {/* ── System prompt ── */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">System prompt</label>
                                <div className="flex items-center gap-2">
                                    {sysModified && (
                                        <button onClick={() => setSystemPrompt(DEFAULT_SYSTEM)}
                                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors">
                                            <RotateCcw size={11}/> Reset
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">Defines the AI's role, output format, and rules. Use <code className="bg-muted px-1 rounded">{'{{TODAY}}'}</code> for today's date.</p>
                            <textarea
                                value={systemPrompt}
                                onChange={e => setSystemPrompt(e.target.value)}
                                rows={18}
                                spellCheck={false}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>

                        {/* ── User prompt ── */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">User prompt</label>
                                {userModified && (
                                    <button onClick={() => setUserPrompt(DEFAULT_USER)}
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors">
                                        <RotateCcw size={11}/> Reset
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Frames the live market data sent to the AI. Use{' '}
                                <code className="bg-muted px-1 rounded">{'{{CONTEXT}}'}</code> where you want the news + calendar inserted,
                                and <code className="bg-muted px-1 rounded">{'{{TODAY}}'}</code> for today's date.
                            </p>
                            <textarea
                                value={userPrompt}
                                onChange={e => setUserPrompt(e.target.value)}
                                rows={8}
                                spellCheck={false}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>

                        {/* Save button */}
                        <div className="flex items-center justify-between pt-1">
                            <p className="text-xs text-muted-foreground">
                                Saving publishes to Azure Blob — every team member gets the updated prompts automatically next time they generate.
                            </p>
                            <button onClick={handleSavePrompts} disabled={saving}
                                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50 shrink-0 ml-4">
                                {saving
                                    ? <><Loader2 size={14} className="animate-spin"/> Saving...</>
                                    : <><Save size={14}/> Save to Azure Blob</>
                                }
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Pipeline log ───────────────────────────────────────────── */}
            {log.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pipeline log</p>
                    {log.map((e, i) => <LogRow key={i} entry={e} />)}
                    <div ref={logEnd} />
                </div>
            )}

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <div className="flex gap-1 border-b border-border">
                {TABS.map(({ key, label }) => (
                    <button key={key} onClick={() => setTab(key)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === key ? 'border-sky-500 text-sky-600 dark:text-sky-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                        {label}
                    </button>
                ))}
                <button onClick={() => loadPolls(tab)} className="ml-auto px-2 py-2 text-muted-foreground hover:text-foreground" title="Refresh">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* ── Poll cards ─────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                    <Loader2 size={18} className="animate-spin"/> Loading...
                </div>
            ) : polls.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <Twitter size={36} className="mx-auto mb-3 opacity-25"/>
                    <p className="font-medium">No {tab.replace('_', ' ')} polls</p>
                    {tab === 'pending_review' && <p className="text-sm mt-1">Click <strong>Generate polls</strong> to create new ones</p>}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {polls.map(poll => (
                        <PollCard key={poll.id} poll={poll} showActions={tab === 'pending_review'}
                            onApprove={id => handleAction(id, 'approved')}
                            onReject={id  => handleAction(id, 'rejected')} />
                    ))}
                </div>
            )}
        </div>
    );
}
