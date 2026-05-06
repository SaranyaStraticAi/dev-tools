'use client';

// ─────────────────────────────────────────────────────────────────────────────
// OutputPanel.tsx — shows the generated newsletter output
// Contains:
//   - Subject + Preview metadata bar at the top
//   - Tab switcher: Preview (iframe) | HTML (pre) | Raw text (pre)
//   - Download .html button
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { NewsletterType } from '../constants';
import { parseNewsletter } from './emailUtils';

type ParsedNewsletter = ReturnType<typeof parseNewsletter>;

interface OutputPanelProps {
    emailHtml: string;
    rawText: string;
    parsed: ParsedNewsletter;
    newsletterType: NewsletterType;
    onDownload: () => void;
}

export default function OutputPanel({
    emailHtml,
    rawText,
    parsed,
    newsletterType,
    onDownload,
}: OutputPanelProps) {
    const [tab, setTab] = useState<'preview' | 'template' | 'raw'>('preview');

    return (
        <div className="w-full max-w-3xl flex flex-col gap-4">

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
            <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border w-fit flex-wrap">
                {(['preview', 'template', 'raw'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                        {t === 'preview' ? '👁 Preview' : t === 'template' ? '🌐 HTML' : '📄 Raw text'}
                    </button>
                ))}
                <button onClick={onDownload}
                    className="ml-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-all">
                    ⬇ Download .html
                </button>
            </div>

            {/* Preview tab — iframe rendering the email HTML */}
            {tab === 'preview' && (
                <div className="w-full border rounded-2xl overflow-hidden shadow-xl">
                    <div className="bg-muted/40 px-4 py-2 border-b flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400"/>
                        <div className="w-3 h-3 rounded-full bg-yellow-400"/>
                        <div className="w-3 h-3 rounded-full bg-green-400"/>
                        <span className="text-xs text-muted-foreground ml-2 font-mono">email preview</span>
                    </div>
                    <iframe srcDoc={emailHtml} className="w-full border-0" style={{ height: '720px' }} title="Newsletter preview"/>
                </div>
            )}

            {/* HTML tab — raw HTML source */}
            {tab === 'template' && (
                <pre className="w-full p-5 border rounded-2xl bg-card font-mono text-[10px] leading-relaxed overflow-auto max-h-[720px] whitespace-pre-wrap text-muted-foreground">
                    {emailHtml}
                </pre>
            )}

            {/* Raw tab — plain AI output text */}
            {tab === 'raw' && (
                <pre className="w-full p-5 border rounded-2xl bg-card font-mono text-xs leading-relaxed overflow-auto max-h-[720px] whitespace-pre-wrap text-foreground">
                    {rawText}
                </pre>
            )}
        </div>
    );
}
