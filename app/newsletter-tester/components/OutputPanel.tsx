'use client';

// ─────────────────────────────────────────────────────────────────────────────
// OutputPanel.tsx — shows the generated newsletter output
// Contains:
//   - Subject + Preview metadata bar at the top
//   - Tab switcher: Preview (iframe) | HTML (pre) | Raw text (pre)
//   - Download .html button
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { NewsletterType } from '../constants';
import { parseNewsletter } from './emailUtils';

type ParsedNewsletter = ReturnType<typeof parseNewsletter>;

interface OutputPanelProps {
    emailHtml: string;
    rawText: string;
    parsed: ParsedNewsletter;
    newsletterType: NewsletterType;
}

export default function OutputPanel({
    emailHtml,
    rawText,
    parsed,
    newsletterType,
}: OutputPanelProps) {
    const [tab, setTab] = useState<'preview' | 'template' | 'raw'>('preview');
    const [editedHtml, setEditedHtml] = useState(emailHtml);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Sync with upstream generation
    useEffect(() => {
        setEditedHtml(emailHtml);
    }, [emailHtml]);

    const handleIframeLoad = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc || !doc.body) return;

        // Make the body of the iframe editable
        doc.body.contentEditable = 'true';
        
        // Listen for changes robustly
        const handleInput = () => {
            // We read the body innerHTML because renderTemplate returns a <div> wrapper,
            // so we don't want the <html><head><body> tags that the browser adds back in.
            setEditedHtml(doc.body.innerHTML);
        };
        
        doc.body.addEventListener('input', handleInput);
        doc.body.addEventListener('keyup', handleInput);

        // Use a MutationObserver to safely capture when whole blocks/tables are deleted
        const observer = new MutationObserver(handleInput);
        observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
    };

    const handleDownload = () => {
        if (!editedHtml) return;
        const blob = new Blob([editedHtml], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${new Date().toISOString().slice(0,10)}_${newsletterType === 'weekly' ? 'thursday' : 'tuesday'}_${newsletterType}.html`;
        a.click(); 
        URL.revokeObjectURL(url);
    };

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
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border w-fit flex-wrap">
                    {(['preview', 'template', 'raw'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            {t === 'preview' ? '👁 Preview' : t === 'template' ? '🌐 HTML' : '📄 Raw text'}
                        </button>
                    ))}
                </div>
                <button onClick={handleDownload}
                    className="ml-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-all shadow-sm">
                    ⬇ Download .html
                </button>
            </div>

            {/* Preview tab — iframe rendering the email HTML */}
            {/* We use hidden instead of unmounting so the iframe doesn't lose your edits when switching tabs */}
            <div className={`w-full border rounded-2xl overflow-hidden shadow-xl ring-2 ring-purple-500/20 ${tab === 'preview' ? 'block' : 'hidden'}`}>
                <div className="bg-muted/40 px-4 py-2 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400"/>
                        <div className="w-3 h-3 rounded-full bg-yellow-400"/>
                        <div className="w-3 h-3 rounded-full bg-green-400"/>
                        <span className="text-xs text-muted-foreground ml-2 font-mono">email preview</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-purple-500 text-white shadow-sm flex items-center gap-1">
                        <span className="animate-pulse">✨</span> Interactive Editing Mode
                    </span>
                </div>
                <iframe 
                    ref={iframeRef}
                    srcDoc={emailHtml} 
                    onLoad={handleIframeLoad}
                    className="w-full border-0 outline-none" 
                    style={{ height: '720px' }} 
                    title="Newsletter preview"
                />
            </div>

            {/* HTML tab — raw HTML source */}
            {tab === 'template' && (
                <pre className="w-full p-5 border rounded-2xl bg-card font-mono text-[10px] leading-relaxed overflow-auto max-h-[720px] whitespace-pre-wrap text-muted-foreground">
                    {editedHtml}
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
