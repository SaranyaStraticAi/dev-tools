'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Save, Loader2, Eye, Code2, FileText,
    CheckCircle, AlertCircle, RefreshCw, Monitor, Smartphone,
} from 'lucide-react';
import {
    parseNewsletter,
    renderTemplate,
    processPuzzleTokens,
} from '@/app/newsletter-tester/components/emailUtils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SavedDraft {
    id:         string;
    subject:    string;
    body:       string | null;
    raw_text:   string | null;
    type:       string;
    created_at: string;
}

type Tab    = 'preview' | 'html' | 'raw';
type Device = 'desktop' | 'mobile';

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EditSavedNewsletterPage() {
    const { accounts } = useMsal();
    const params  = useParams();
    const router  = useRouter();
    const id      = params?.id as string;

    // Auth
    const [mounted, setMounted] = useState(false);
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('employee_session');
        if (saved) setEmployeeAccount(saved);
    }, []);
    const userEmail  = accounts[0]?.username;
    const isAllowed  = userEmail === 'masood@aity.dev' || employeeAccount === 'ketki@vibetrader.com' || userEmail === 'ketki@vibetrader.com' || userEmail === 'saranya@vibetrader.com' || employeeAccount === 'saranya@vibetrader.com';

    // Draft loading
    const [draft, setDraft]       = useState<SavedDraft | null>(null);
    const [fetching, setFetching] = useState(true);
    const [fetchErr, setFetchErr] = useState('');

    // Editable state
    const [subject,  setSubject]  = useState('');
    const [rawText,  setRawText]  = useState('');
    const [editedHtml, setEditedHtml] = useState('');

    // Template (from Azure, for re-rendering when raw text changes)
    const [template, setTemplate] = useState('');

    // UI state
    const [tab,    setTab]    = useState<Tab>('preview');
    const [device, setDevice] = useState<Device>('desktop');
    const [dirty,  setDirty]  = useState(false);

    // Save state
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError,  setSaveError]  = useState('');

    // Iframe refs for live in-iframe editing
    const iframeRef    = useRef<HTMLIFrameElement>(null);
    const observerRef  = useRef<MutationObserver | null>(null);
    const isPushingRef = useRef(false);

    // ── Load the draft ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!id) return;
        (async () => {
            setFetching(true);
            setFetchErr('');
            try {
                const res  = await fetch(`/api/saved-newsletters?id=${id}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? 'Failed to load draft');
                const d: SavedDraft = data.draft;
                setDraft(d);
                setSubject(d.subject);
                setRawText(d.raw_text ?? '');
                setEditedHtml(d.body ?? '');
            } catch (e: any) {
                setFetchErr(e.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id]);

    // ── Load template from Azure (for re-rendering on raw text edits) ─────────
    useEffect(() => {
        (async () => {
            try {
                const res  = await fetch('/api/newsletter-prompts');
                if (!res.ok) return;
                const data = await res.json();
                if (data.exists && data.prompts) {
                    if (draft?.type === 'puzzle' && data.prompts.puzzleTemplate) {
                        setTemplate(data.prompts.puzzleTemplate);
                    } else if (data.prompts.weeklyTemplate) {
                        setTemplate(data.prompts.weeklyTemplate);
                    }
                }
            } catch { /* silently skip */ }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft?.type]);

    // ── Re-render HTML whenever raw text changes (if we have a template) ─────
    const reRenderFromRaw = useCallback((raw: string) => {
        if (!template || !raw) return;
        let parsed = parseNewsletter(raw);
        if (draft?.type === 'puzzle') parsed = processPuzzleTokens(parsed);
        const html = renderTemplate(template, parsed, draft?.type === 'puzzle' ? 'puzzle' : 'weekly', '');
        setEditedHtml(html);
        setDirty(true);
    }, [template, draft?.type]);

    // ── Iframe editing helpers ────────────────────────────────────────────────
    const getCleanHtml = (doc: Document) =>
        doc.body.innerHTML.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

    const handleIframeLoad = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc?.body) return;

        doc.body.contentEditable = 'true';

        const handleInput = () => {
            if (isPushingRef.current) return;
            setEditedHtml(getCleanHtml(doc));
            setDirty(true);
        };

        doc.body.addEventListener('input', handleInput);
        doc.body.addEventListener('keyup', handleInput);

        observerRef.current?.disconnect();
        const observer = new MutationObserver(handleInput);
        observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
        observerRef.current = observer;
    };

    const pushToIframe = (html: string) => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc?.body) return;
        isPushingRef.current = true;
        doc.body.innerHTML = html;
        doc.body.contentEditable = 'true';
        isPushingRef.current = false;
    };

    // ── HTML textarea edit → live-sync to iframe ──────────────────────────────
    const handleHtmlEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setEditedHtml(val);
        pushToIframe(val);
        setDirty(true);
    };

    // ── Raw text edit ─────────────────────────────────────────────────────────
    const handleRawEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setRawText(val);
        setDirty(true);
        reRenderFromRaw(val);
    };

    // ── Save changes ──────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaveStatus('saving');
        setSaveError('');
        try {
            const res = await fetch('/api/saved-newsletters', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    subject,
                    body:    editedHtml,
                    rawText: rawText || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to save');
            setSaveStatus('saved');
            setDirty(false);
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e: any) {
            setSaveError(e.message ?? 'Unknown error');
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 5000);
        }
    };

    // ── Render guards ─────────────────────────────────────────────────────────
    if (!mounted) return null;

    if (!isAllowed) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center flex flex-col gap-2">
                    <span className="text-2xl">🔒</span>
                    <p className="text-sm text-muted-foreground">Access Denied.</p>
                </div>
            </div>
        );
    }

    if (fetching) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <p className="text-sm">Loading draft…</p>
                </div>
            </div>
        );
    }

    if (fetchErr || !draft) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center flex flex-col gap-3">
                    <span className="text-4xl">❌</span>
                    <p className="text-sm text-red-400">{fetchErr || 'Draft not found.'}</p>
                    <button onClick={() => router.back()} className="text-xs underline text-muted-foreground">← Go back</button>
                </div>
            </div>
        );
    }

    const srcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body { margin: 0; padding: 0; background-color: #fafafa; }</style>
</head>
<body>${editedHtml}</body>
</html>`;

    return (
        <div className="min-h-screen bg-background py-8 px-4">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-4 flex-wrap border-b pb-5">
                    <div>
                        <a
                            href="/newsletter-tester/saved"
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2 transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Saved Drafts
                        </a>
                        <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            ✏️ Edit Draft
                        </h1>
                        <p className="text-xs text-muted-foreground mt-1">
                            Edit the content below. Changes reflect live in the preview. Save when done.
                        </p>
                    </div>

                    {/* Save button */}
                    <button
                        onClick={handleSave}
                        disabled={saveStatus === 'saving' || !dirty}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-50 ${
                            saveStatus === 'saved'
                                ? 'bg-green-600 text-white'
                                : saveStatus === 'error'
                                ? 'bg-red-600 text-white'
                                : dirty
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        {saveStatus === 'saving' ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                        ) : saveStatus === 'saved' ? (
                            <><CheckCircle className="w-4 h-4" /> Saved!</>
                        ) : saveStatus === 'error' ? (
                            <><AlertCircle className="w-4 h-4" /> Error</>
                        ) : (
                            <><Save className="w-4 h-4" /> Save Changes</>
                        )}
                    </button>
                </div>

                {/* Save error */}
                {saveStatus === 'error' && saveError && (
                    <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        ❌ {saveError}
                    </div>
                )}

                {/* Unsaved changes badge */}
                {dirty && saveStatus === 'idle' && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                        Unsaved changes
                    </div>
                )}

                {/* ── Subject editor ───────────────────────────────────────── */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Subject Line</label>
                    <input
                        type="text"
                        value={subject}
                        onChange={e => { setSubject(e.target.value); setDirty(true); }}
                        className="w-full px-4 py-3 rounded-xl border bg-card text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                        placeholder="Email subject line…"
                    />
                </div>

                {/* ── Main split: editor + preview ─────────────────────────── */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

                    {/* ── Left: Editor tabs ──────────────────────────────────── */}
                    <div className="flex flex-col gap-4">

                        {/* Tab bar */}
                        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border w-fit">
                            {([
                                { key: 'raw',  label: '📄 Raw Text', icon: FileText },
                                { key: 'html', label: '🌐 HTML',     icon: Code2    },
                            ] as { key: Tab; label: string; icon: any }[]).map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setTab(t.key)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        tab === t.key
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Raw text editor */}
                        {tab === 'raw' && (
                            <div className="flex flex-col gap-2">
                                <p className="text-[10px] text-muted-foreground px-1">
                                    ✏️ Edit the raw AI text below. Changes automatically re-render the HTML preview
                                    {template ? ' using the current template from Azure.' : ' (template not loaded — switch to HTML tab to edit directly).'}
                                </p>
                                {!template && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-xs">
                                        ⚠️ Template not loaded from Azure. Raw text edits won't auto-render. Use HTML tab instead.
                                    </div>
                                )}
                                <textarea
                                    value={rawText}
                                    onChange={handleRawEdit}
                                    spellCheck={false}
                                    rows={32}
                                    className="w-full p-4 border rounded-2xl bg-card font-mono text-[11px] leading-relaxed resize-y outline-none focus:ring-2 focus:ring-indigo-500/40 text-foreground"
                                    placeholder="No raw text available for this draft. Use the HTML tab to edit directly."
                                />
                                {template && rawText && (
                                    <button
                                        onClick={() => reRenderFromRaw(rawText)}
                                        className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border hover:bg-muted transition-all"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" /> Re-render Preview
                                    </button>
                                )}
                            </div>
                        )}

                        {/* HTML editor */}
                        {tab === 'html' && (
                            <div className="flex flex-col gap-2">
                                <p className="text-[10px] text-muted-foreground px-1">
                                    🌐 Edit the HTML directly — changes reflect in the preview instantly.
                                </p>
                                <textarea
                                    value={editedHtml}
                                    onChange={handleHtmlEdit}
                                    spellCheck={false}
                                    rows={32}
                                    className="w-full p-4 border rounded-2xl bg-card font-mono text-[10px] leading-relaxed resize-y outline-none focus:ring-2 focus:ring-purple-500/40 text-muted-foreground"
                                />
                            </div>
                        )}
                    </div>

                    {/* ── Right: Live preview ────────────────────────────────── */}
                    <div className="flex flex-col gap-4 sticky top-6">

                        {/* Preview header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border w-fit">
                                <button
                                    onClick={() => setTab('preview')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                        tab === 'preview'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Eye className="w-3.5 h-3.5" /> Preview
                                </button>
                            </div>
                            <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border">
                                <button
                                    onClick={() => setDevice('desktop')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${device === 'desktop' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Monitor className="w-3.5 h-3.5" /> Desktop
                                </button>
                                <button
                                    onClick={() => setDevice('mobile')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${device === 'mobile' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Smartphone className="w-3.5 h-3.5" /> Mobile
                                </button>
                            </div>
                        </div>

                        {/* Badge */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg border bg-purple-500 text-white shadow-sm flex items-center gap-1">
                                <span className="animate-pulse">✨</span> Interactive Editing Mode — click to edit directly
                            </span>
                        </div>

                        {/* Device frame + iframe */}
                        <div className="flex justify-center">
                            <div className={`relative transition-all duration-300 bg-white overflow-hidden shadow-2xl ${
                                device === 'mobile'
                                    ? 'w-[375px] h-[812px] border-[14px] border-slate-800 rounded-[40px]'
                                    : 'w-full h-[700px] border border-gray-200 rounded-xl'
                            }`}>
                                {device === 'mobile' && (
                                    <div className="w-full h-6 bg-slate-800 flex justify-center items-end pb-1 absolute top-0 left-0 z-10 pointer-events-none rounded-t-[26px]">
                                        <div className="w-1/3 h-4 bg-black rounded-b-2xl" />
                                    </div>
                                )}
                                <iframe
                                    ref={iframeRef}
                                    srcDoc={srcDoc}
                                    onLoad={handleIframeLoad}
                                    className="w-full h-full border-0 outline-none"
                                    title="Newsletter live preview"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Bottom save bar ──────────────────────────────────────── */}
                {dirty && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 bg-card border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4">
                        <span className="text-sm font-semibold">You have unsaved changes</span>
                        <button
                            onClick={handleSave}
                            disabled={saveStatus === 'saving'}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                        >
                            {saveStatus === 'saving'
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                                : <><Save className="w-3.5 h-3.5" /> Save Changes</>
                            }
                        </button>
                        <button
                            onClick={() => router.back()}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Discard
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
