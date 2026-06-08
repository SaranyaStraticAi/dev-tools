'use client';

// ─────────────────────────────────────────────────────────────────────────────
// OutputPanel.tsx — shows the generated newsletter output
// Contains:
//   - Subject + Preview metadata bar at the top
//   - Tab switcher: Preview (iframe) | HTML (pre) | Raw text (pre) | Metrics
//   - Download .html button
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { NewsletterType } from '../constants';
import { parseNewsletter, buildPuzzlePreviewScript } from './emailUtils';
import type { BroadcastMetrics } from '@/app/api/newsletter-metrics/route';

type ParsedNewsletter = ReturnType<typeof parseNewsletter>;

interface OutputPanelProps {
    emailHtml:     string;
    rawText:       string;
    parsed:        ParsedNewsletter;
    newsletterType:NewsletterType;
    broadcastId?:  string | null;
    metrics?:      BroadcastMetrics | null;
    sendError?:    string;
    onSave?:       () => void;
    saveStatus?:   'idle' | 'saving' | 'saved' | 'error';
    saveError?:    string;
    onClear?:      () => void;
}

export default function OutputPanel({
    emailHtml,
    rawText,
    parsed,
    newsletterType,
    broadcastId,
    metrics,
    sendError,
    onSave,
    saveStatus = 'idle',
    saveError,
    onClear,
}: OutputPanelProps) {
    const [tab, setTab] = useState<'preview' | 'template' | 'raw' | 'metrics'>('preview');
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [editedHtml, setEditedHtml] = useState(emailHtml);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Sync with upstream generation
    useEffect(() => {
        setEditedHtml(emailHtml);
    }, [emailHtml]);

    // Ref to the MutationObserver watching the iframe body (so we can
    // temporarily disconnect it while we programmatically set innerHTML)
    const observerRef  = useRef<MutationObserver | null>(null);
    const isPushingRef = useRef(false);  // true while we're setting innerHTML ourselves

    const handleIframeLoad = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc || !doc.body) return;

        // Make the body of the iframe editable
        doc.body.contentEditable = 'true';

        // Strip the preview-only <script> block before syncing to editedHtml.
        const getCleanHtml = () =>
            doc.body.innerHTML.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

        const handleInput = () => {
            // Ignore changes WE made programmatically
            if (isPushingRef.current) return;
            setEditedHtml(getCleanHtml());
        };

        doc.body.addEventListener('input', handleInput);
        doc.body.addEventListener('keyup', handleInput);

        // Disconnect any previous observer before creating a new one
        observerRef.current?.disconnect();
        const observer = new MutationObserver(handleInput);
        observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
        observerRef.current = observer;
    };

    // Push HTML string into the live iframe body without reloading the frame.
    // Uses isPushingRef to suppress the MutationObserver callback while we write.
    const pushToIframe = (html: string) => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc || !doc.body) return;

        isPushingRef.current = true;
        doc.body.innerHTML = html;
        // Re-apply contentEditable because setting innerHTML resets it
        doc.body.contentEditable = 'true';
        isPushingRef.current = false;
    };

    // Called when the user edits the HTML textarea directly
    const handleHtmlEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newHtml = e.target.value;
        setEditedHtml(newHtml);
        pushToIframe(newHtml);
    };

    const handleDownload = () => {
        // Use editedHtml so that any in-iframe or textarea edits are included.
        // editedHtml already has the puzzle preview <script> stripped.
        const html = editedHtml || emailHtml;
        if (!html) return;
        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${new Date().toISOString().slice(0,10)}_${newsletterType === 'weekly' ? 'thursday' : 'tuesday'}_${newsletterType}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full max-w-4xl flex flex-col gap-4">

            {/* Subject + Preview metadata */}
            <div className="border rounded-2xl p-4 bg-card flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-16 shrink-0 mt-0.5">Subject</span>
                    <span className="text-sm font-semibold">{parsed.subject}</span>
                </div>
                <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-16 shrink-0 mt-0.5">Preview</span>
                    <span className="text-xs text-muted-foreground">{parsed.preview}</span>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
                <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border w-fit flex-wrap">
                    {(['preview', 'template', 'raw'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            {t === 'preview' ? '👁 Preview' : t === 'template' ? '🌐 HTML' : '📄 Raw text'}
                        </button>
                    ))}
                    <button onClick={() => setTab('metrics')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${tab === 'metrics' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                        📊 Metrics
                        {broadcastId && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"/>}
                    </button>
                </div>
                <div className="flex gap-2 items-center">
                    {onSave && (
                        <button onClick={onSave} disabled={saveStatus === 'saving'}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                                saveStatus === 'saved'
                                    ? 'bg-blue-600 text-white'
                                    : saveStatus === 'error'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50'
                            }`}>
                            {saveStatus === 'saving' ? (
                                <>
                                    <span className="w-3 h-3 border border-white/30 border-t-white animate-spin rounded-full inline-block"/>
                                    Saving...
                                </>
                            ) : saveStatus === 'saved' ? (
                                '✓ Saved draft'
                            ) : saveStatus === 'error' ? (
                                '❌ Error saving'
                            ) : (
                                '💾 Save for Later'
                            )}
                        </button>
                    )}
                    {onClear && (
                        <button onClick={onClear}
                            className="px-4 py-1.5 rounded-lg text-xs font-bold border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-all shadow-sm">
                            🗑️ Clear
                        </button>
                    )}
                    <button onClick={handleDownload}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-all shadow-sm">
                        ⬇ Download .html
                    </button>
                </div>
            </div>

            {/* Preview tab — iframe rendering the email HTML */}
            {/* We use hidden instead of unmounting so the iframe doesn't lose your edits when switching tabs */}
            <div className={`w-full flex flex-col items-center bg-gray-50/50 p-4 border rounded-2xl shadow-xl ring-2 ring-purple-500/20 ${tab === 'preview' ? 'block' : 'hidden'}`}>
                
                {/* Preview Toolbar */}
                <div className="w-full flex items-center justify-between mb-4 bg-white p-2 rounded-xl border shadow-sm">
                    <div className="flex bg-muted p-1 rounded-lg">
                        <button 
                            onClick={() => setDevice('desktop')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${device === 'desktop' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            💻 Desktop
                        </button>
                        <button 
                            onClick={() => setDevice('mobile')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${device === 'mobile' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            📱 Mobile
                        </button>
                    </div>

                    <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg border bg-purple-500 text-white shadow-sm flex items-center gap-1">
                        <span className="animate-pulse">✨</span> Interactive Editing Mode
                    </span>
                </div>

                {/* Device Frame */}
                <div className={`relative transition-all duration-300 ease-in-out bg-white overflow-hidden shadow-2xl ${device === 'mobile' ? 'w-[375px] h-[812px] border-[14px] border-slate-800 rounded-[40px]' : 'w-full max-w-3xl h-[800px] border border-gray-200 rounded-xl'}`}>
                    {device === 'mobile' && (
                        <div className="w-full h-6 bg-slate-800 flex justify-center items-end pb-1 absolute top-0 left-0 z-10 pointer-events-none rounded-t-[26px]">
                            <div className="w-1/3 h-4 bg-black rounded-b-2xl"></div>
                        </div>
                    )}
                    <iframe 
                        ref={iframeRef}
                        srcDoc={`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>body { margin: 0; padding: 0; background-color: #fafafa; }</style>
</head>
<body>
    ${emailHtml}
    ${newsletterType === 'puzzle' && parsed._correctAnswer
        ? buildPuzzlePreviewScript(parsed._correctAnswer)
        : ''
    }
</body>
</html>`} 
                        onLoad={handleIframeLoad}
                        className="w-full h-full border-0 outline-none relative z-0" 
                        title="Newsletter preview"
                    />
                </div>
            </div>

            {/* HTML tab — editable HTML source that live-syncs back to the iframe */}
            {tab === 'template' && (
                <div className="w-full flex flex-col gap-2">
                    <p className="text-[10px] text-muted-foreground px-1">
                        ✏️ Edit the HTML below — changes are reflected in the Preview iframe instantly.
                    </p>
                    <textarea
                        value={editedHtml}
                        onChange={handleHtmlEdit}
                        spellCheck={false}
                        className="w-full p-5 border rounded-2xl bg-card font-mono text-[10px] leading-relaxed overflow-auto h-[720px] whitespace-pre resize-none outline-none focus:ring-2 focus:ring-purple-500/40 text-muted-foreground"
                    />
                </div>
            )}

            {/* Raw tab — plain AI output text */}
            {tab === 'raw' && (
                <pre className="w-full p-5 border rounded-2xl bg-card font-mono text-xs leading-relaxed overflow-auto max-h-[720px] whitespace-pre-wrap text-foreground">
                    {rawText}
                </pre>
            )}

            {/* Metrics tab — Resend broadcast analytics */}
            {tab === 'metrics' && (
                <div className="w-full border rounded-2xl bg-card p-6 flex flex-col gap-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-sm">📊 Campaign Metrics</h3>
                            {broadcastId
                                ? <p className="text-[10px] text-muted-foreground mt-0.5">Broadcast ID: <span className="font-mono">{broadcastId}</span></p>
                                : <p className="text-[10px] text-muted-foreground mt-0.5">Send the newsletter first to see metrics</p>
                            }
                        </div>
                        {broadcastId && (
                            <div className="flex items-center gap-1.5 text-[10px] text-orange-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"/>
                                Auto-refreshing every 20s
                            </div>
                        )}
                    </div>

                    {/* Send error */}
                    {sendError && (
                        <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                            ❌ {sendError}
                        </div>
                    )}

                    {/* Waiting state */}
                    {!broadcastId && !sendError && (
                        <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                            <span className="text-4xl">📨</span>
                            <p className="text-sm">Click <strong>Send via Resend</strong> to send your newsletter and track metrics here.</p>
                            <p className="text-[10px] opacity-60">Requires RESEND_API_KEY and RESEND_AUDIENCE_ID in .env.local</p>
                        </div>
                    )}

                    {/* Metric cards */}
                    {metrics && (
                        <>
                            {/* Main KPIs */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <MetricCard label="Delivered" value={metrics.delivered} icon="📬" color="blue" />
                                <MetricCard label="Open Rate" value={`${metrics.openRate}%`} icon="👁" color="green"
                                    sub={`${metrics.opened} unique opens`} />
                                <MetricCard label="Click Rate" value={`${metrics.clickRate}%`} icon="🖱️" color="purple"
                                    sub={`${metrics.clicked} unique clicks`} />
                                <MetricCard label="Bounced" value={metrics.bounced} icon="↩️" color="red" />
                                <MetricCard label="Unsubscribed" value={metrics.unsubscribed} icon="🚫" color="yellow" />
                                <MetricCard label="Complaints" value={metrics.complained} icon="⚠️" color="orange" />
                            </div>
                            <p className="text-[10px] text-muted-foreground text-right">
                                Last updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
                                {' · '}Metrics via Resend webhooks
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 text-center">
                                ℹ️ Resend doesn&apos;t expose aggregate stats via REST API — metrics accumulate via webhooks.
                                Configure webhook URL in Resend dashboard → Webhooks → add <code className="font-mono">/api/newsletter-metrics</code>
                            </p>
                        </>
                    )}

                    {/* Sent but no metrics yet */}
                    {broadcastId && !metrics && (
                        <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                            <span className="w-6 h-6 border-2 border-orange-400/30 border-t-orange-400 animate-spin rounded-full"/>
                            <p className="text-sm">Newsletter sent! Waiting for delivery events...</p>
                            <p className="text-[10px] opacity-60">Metrics appear as recipients open/click. Webhook must be configured in Resend dashboard.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Metric card sub-component ─────────────────────────────────────────────────
function MetricCard({
    label, value, icon, color, sub
}: {
    label: string;
    value: string | number;
    icon: string;
    color: 'blue' | 'green' | 'purple' | 'red' | 'yellow' | 'orange';
    sub?: string;
}) {
    const colorMap: Record<string, string> = {
        blue:   'bg-blue-500/10   border-blue-500/20   text-blue-400',
        green:  'bg-green-500/10  border-green-500/20  text-green-400',
        purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        red:    'bg-red-500/10    border-red-500/20    text-red-400',
        yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    };
    return (
        <div className={`flex flex-col gap-1 p-4 rounded-xl border ${colorMap[color]}`}>
            <div className="flex items-center gap-1.5">
                <span>{icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
            </div>
            <span className="text-2xl font-black tabular-nums">{value}</span>
            {sub && <span className="text-[10px] opacity-60">{sub}</span>}
        </div>
    );
}
