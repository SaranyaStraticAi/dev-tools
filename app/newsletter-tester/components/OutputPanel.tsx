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
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
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
</body>
</html>`} 
                        onLoad={handleIframeLoad}
                        className="w-full h-full border-0 outline-none relative z-0" 
                        title="Newsletter preview"
                    />
                </div>
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
