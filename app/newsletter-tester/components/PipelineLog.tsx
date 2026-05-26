'use client';

// ─────────────────────────────────────────────────────────────────────────────
// PipelineLog.tsx
// Collapsible panel that shows the full step-by-step pipeline trace after
// the Thursday newsletter run completes. Each step is individually expandable
// so the user can see exactly what went in and came out.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';

export interface PipelineLogEntry {
    step:        string;
    label:       string;
    icon:        string;
    status:      'pending' | 'done' | 'error';
    data?:       Record<string, any>;
    startedAt:   string;
    completedAt?: string;
}

interface PipelineLogProps {
    entries: PipelineLogEntry[];
    title?: string;
    promptMode?: 'full' | 'compressed';
}

// ── Pretty-print a value for display ────────────────────────────────────────
function renderValue(val: any): React.ReactNode {
    if (val === null || val === undefined) return <span className="text-muted-foreground italic">—</span>;
    if (typeof val === 'string') return <span className="text-emerald-400 break-all">{val}</span>;
    if (typeof val === 'number') return <span className="text-sky-400">{val.toLocaleString()}</span>;
    if (typeof val === 'boolean') return <span className="text-yellow-400">{String(val)}</span>;
    if (Array.isArray(val)) {
        if (val.length === 0) return <span className="text-muted-foreground italic">empty array</span>;
        // If array of strings, show as tags
        if (typeof val[0] === 'string') {
            return (
                <div className="flex flex-wrap gap-1 mt-1">
                    {val.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded text-[10px] text-emerald-400 font-mono">
                            {s}
                        </span>
                    ))}
                </div>
            );
        }
        // Array of objects → show count + collapsible
        return <span className="text-sky-400">[{val.length} items]</span>;
    }
    if (typeof val === 'object') {
        return (
            <div className="mt-1 space-y-1">
                {Object.entries(val).map(([k, v]) => (
                    <div key={k} className="flex gap-2 items-start">
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0 pt-0.5">{k}:</span>
                        <span className="text-xs">{renderValue(v)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return <span className="text-foreground">{String(val)}</span>;
}

// ── Step descriptions — shown as the "what happened" label ──────────────────
const STEP_DESCRIPTIONS: Record<string, string> = {
    discover: 'AI generated search queries, then searched Reddit to discover trading communities.',
    pick:     'AI reviewed all found communities and kept only active forex/trading subreddits, removing meme stocks and crypto.',
    fetch:    'Fetched the top posts from the past week across all chosen subreddits in parallel.',
    analyze:  'Downloaded full comment threads for each post, then AI read everything to find the dominant trader pain this week.',
    news:     'Used the identified currency/event to search trusted forex news sites for current articles.',
    write:    'AI wrote the complete newsletter draft using the Pain + Solution formula, grounded in real posts and news links.',
    review:   'AI Compliance Officer reviewed the draft against editorial guidelines and autocorrected any violations.',
    banner:   'Generated the email header banner image using the short newsletter title.',
    complete: 'Pipeline finished. Raw text was parsed and injected into the HTML email template.',
};

// ── Data field labels — human-readable names for the data keys ───────────────
const FIELD_LABELS: Record<string, string> = {
    count:              '# Items Found',
    picked:             'Chosen Subreddits',
    fetchedFrom:        'Subreddits Successfully Fetched',
    bannerUrl:          'Banner Image URL',
    dominantPainTheme:  'Dominant Trader Pain',
    emotionalIntensity: 'Emotional Intensity',
    keyPhrases:         'Key Phrases from Traders',
    currencyOrEvent:    'Currency / Event Identified',
    analysisNotes:      'Analyst Notes',
    query:              'News Search Query',
    referenceLinks:     'News Articles Found',
    passed:             'Compliance Check Passed',
    flags:              'Autocorrect Flags',
};

function StepRow({ entry, index, isLast, promptMode }: { entry: PipelineLogEntry; index: number; isLast: boolean; promptMode: 'full' | 'compressed' }) {
    const [open, setOpen] = useState(false);

    const duration = entry.completedAt && entry.startedAt
        ? Math.round((new Date(entry.completedAt).getTime() - new Date(entry.startedAt).getTime()) / 1000)
        : null;

    const hasData = entry.data && Object.keys(entry.data).length > 0;

    const statusColor = entry.status === 'done'    ? 'bg-emerald-500'
                      : entry.status === 'error'   ? 'bg-red-500'
                      : 'bg-yellow-400 animate-pulse';

    const borderColor = entry.status === 'done'    ? 'border-emerald-500/20 hover:border-emerald-500/40'
                      : entry.status === 'error'   ? 'border-red-500/20 hover:border-red-500/40'
                      : 'border-yellow-400/20';

    return (
        <div className="relative flex gap-3">
            {/* ── Vertical connector line ── */}
            {!isLast && (
                <div className="absolute left-[18px] top-8 bottom-0 w-px bg-border/50" />
            )}

            {/* ── Step number circle ── */}
            <div className="shrink-0 z-10 flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                    entry.status === 'done'  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' :
                    entry.status === 'error' ? 'bg-red-500/10 border-red-500 text-red-400' :
                    'bg-yellow-400/10 border-yellow-400 text-yellow-400'
                }`}>
                    {entry.status === 'done' ? '✓' : entry.status === 'error' ? '✗' : index + 1}
                </div>
            </div>

            {/* ── Step card ── */}
            <div className={`flex-1 mb-3 rounded-xl border ${borderColor} bg-card/60 transition-all overflow-hidden`}>
                {/* Header row */}
                <button
                    onClick={() => hasData && setOpen(v => !v)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${hasData ? 'cursor-pointer' : 'cursor-default'}`}
                >
                    <span className="text-base">{entry.icon}</span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">{entry.label}</span>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                            <span className={`text-[10px] font-medium ${
                                entry.status === 'done'  ? 'text-emerald-400' :
                                entry.status === 'error' ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                                {entry.status === 'done' ? 'Done' : entry.status === 'error' ? 'Error' : 'Running…'}
                            </span>
                            {duration !== null && (
                                <span className="text-[10px] text-muted-foreground">· {duration}s</span>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            {STEP_DESCRIPTIONS[entry.step] || ''}
                        </p>
                    </div>
                    {hasData && (
                        <span className="text-muted-foreground text-xs shrink-0">
                            {open ? '▲' : '▼'}
                        </span>
                    )}
                </button>

                {/* Expandable data panel */}
                {open && hasData && (
                    <div className="border-t border-border/50 px-4 py-3 bg-muted/20 space-y-3">
                        {Object.entries(entry.data!).map(([key, val]) => {
                            // Render AI prompts nicely
                            if (key === 'prompts' && typeof val === 'object' && val !== null) {
                                const prompts = val as { system?: string; user?: string; userTemplate?: string };
                                return (
                                    <div key={key} className="space-y-3 mt-4 border-t border-border/50 pt-3">
                                        <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                                            <span>🤖</span> AI Prompts Used
                                        </div>
                                        {prompts.system && (
                                            <div className="space-y-1">
                                                <div className="text-[10px] font-semibold text-muted-foreground tracking-wider">SYSTEM PROMPT</div>
                                                <pre className="text-[10px] pl-3 py-2 border-l-2 border-purple-500/30 bg-background/30 whitespace-pre-wrap font-mono text-muted-foreground max-h-60 overflow-y-auto">{prompts.system}</pre>
                                            </div>
                                        )}
                                        {prompts.user && (
                                            <div className="space-y-1">
                                                <div className="text-[10px] font-semibold text-muted-foreground tracking-wider">USER PROMPT</div>
                                                <pre className="text-[10px] pl-3 py-2 border-l-2 border-sky-500/30 bg-background/30 whitespace-pre-wrap font-mono text-muted-foreground max-h-60 overflow-y-auto">
                                                    {promptMode === 'compressed' && prompts.userTemplate ? prompts.userTemplate : prompts.user}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            // For analysis object — flatten it nicely
                            if (key === 'analysis' && typeof val === 'object' && val !== null) {
                                return Object.entries(val as Record<string, any>)
                                    .filter(([k]) => !['bestPostIndex', 'supportingPostIndices', 'bestPost', 'supportingPosts', 'prompts'].includes(k))
                                    .map(([k, v]) => (
                                        <div key={k} className="space-y-1">
                                            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                {FIELD_LABELS[k] || k}
                                            </div>
                                            <div className="text-xs pl-2">{renderValue(v)}</div>
                                        </div>
                                    ));
                            }
                            // For news referenceLinks — show as list of article links
                            if (key === 'news' && typeof val === 'object' && val !== null) {
                                const news = val as { query?: string; referenceLinks?: Array<{ title: string; url: string; source: string }> };
                                return (
                                    <div key={key} className="space-y-2">
                                        {news.query && (
                                            <div>
                                                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Search Query</div>
                                                <div className="text-xs pl-2 text-emerald-400 mt-1">{news.query}</div>
                                            </div>
                                        )}
                                        {news.referenceLinks && news.referenceLinks.length > 0 && (
                                            <div>
                                                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Articles Found</div>
                                                <div className="space-y-1 pl-2">
                                                    {news.referenceLinks.map((link, i) => (
                                                        <a
                                                            key={i}
                                                            href={link.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-start gap-2 group"
                                                        >
                                                            <span className="text-[10px] text-muted-foreground pt-0.5 shrink-0">{i + 1}.</span>
                                                            <span className="text-[11px] text-sky-400 group-hover:text-sky-300 underline underline-offset-2 break-all">{link.title}</span>
                                                            <span className="text-[9px] text-muted-foreground shrink-0 pt-0.5">{link.source}</span>
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {(!news.referenceLinks || news.referenceLinks.length === 0) && (
                                            <p className="text-[11px] text-muted-foreground pl-2 italic">No articles found — open web fallback was used.</p>
                                        )}
                                    </div>
                                );
                            }
                            // Banner URL — show as image preview
                            if (key === 'bannerUrl' && typeof val === 'string' && val) {
                                return (
                                    <div key={key} className="space-y-2">
                                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Banner Image</div>
                                        <img src={val} alt="Banner" className="rounded-lg max-h-20 object-cover w-full" />
                                    </div>
                                );
                            }
                            // Default
                            return (
                                <div key={key} className="space-y-1">
                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        {FIELD_LABELS[key] || key}
                                    </div>
                                    <div className="text-xs pl-2">{renderValue(val)}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PipelineLog({ entries, title = "Pipeline Process Log", promptMode = 'full' }: PipelineLogProps) {
    const [panelOpen, setPanelOpen] = useState(false);

    if (entries.length === 0) return null;

    const done  = entries.filter(e => e.status === 'done').length;
    const total = entries.length;
    const hasError = entries.some(e => e.status === 'error');

    return (
        <div className="w-full max-w-3xl">
            {/* ── Toggle button ── */}
            <button
                onClick={() => setPanelOpen(v => !v)}
                className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all ${
                    panelOpen
                        ? 'bg-card border-border rounded-b-none'
                        : 'bg-card border-border hover:border-foreground/20'
                }`}
            >
                <div className="flex items-center gap-3">
                    <span className="text-base">🔬</span>
                    <div className="text-left">
                        <div className="text-sm font-semibold text-foreground">{title}</div>
                        <div className="text-[11px] text-muted-foreground">
                            {hasError
                                ? 'Pipeline encountered an error — expand to see where it failed'
                                : `All ${total} steps completed — expand to see what each tool did`}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Progress pills */}
                    <div className="flex gap-1">
                        {entries.map((e, i) => (
                            <div
                                key={i}
                                title={e.label}
                                className={`w-2 h-2 rounded-full ${
                                    e.status === 'done'    ? 'bg-emerald-500' :
                                    e.status === 'error'   ? 'bg-red-500' :
                                    e.status === 'pending' ? 'bg-yellow-400' :
                                    'bg-muted'
                                }`}
                            />
                        ))}
                    </div>
                    <span className="text-[11px] text-muted-foreground">{done}/{total}</span>
                    <span className="text-muted-foreground text-xs">{panelOpen ? '▲' : '▼'}</span>
                </div>
            </button>

            {/* ── Expandable step list ── */}
            {panelOpen && (
                <div className="border border-t-0 border-border rounded-b-2xl bg-background/50 px-4 pt-4 pb-2">
                    <p className="text-[11px] text-muted-foreground mb-4 px-1">
                        Click any step below to see exactly what data went in and what came out.
                    </p>
                    {entries.map((entry, i) => (
                        <StepRow
                            key={entry.step}
                            entry={entry}
                            index={i}
                            isLast={i === entries.length - 1}
                            promptMode={promptMode}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
