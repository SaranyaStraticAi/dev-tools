'use client';

// VersionHistory.tsx — shared component for newsletter-tester and prompt-tester
// Shows a list of past published versions; lets you preview + restore any one.

import { useState, useEffect } from 'react';
import { History, RotateCcw, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

export interface VersionMeta {
    name:        string;   // blob path  e.g. history/2026-05-15T10-30-00-000Z.json
    publishedAt: string;   // ISO string
    label:       string;   // human-readable e.g. "15 May 2026, 10:30"
}

interface VersionHistoryProps {
    /** API route to hit — e.g. '/api/newsletter-prompts' or '/api/prompt-config' */
    apiRoute: string;
    /** Called when user clicks Restore on a version. Receives the full prompts JSON blob. */
    onRestore: (prompts: Record<string, any>) => void;
    /** Optional: extra CSS classes on the outer wrapper */
    className?: string;
}

export default function VersionHistory({ apiRoute, onRestore, className = '' }: VersionHistoryProps) {
    const [open,      setOpen]      = useState(false);
    const [versions,  setVersions]  = useState<VersionMeta[]>([]);
    const [loading,   setLoading]   = useState(false);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [deleting,  setDeleting]  = useState<string | null>(null);
    const [error,     setError]     = useState('');

    // Load version list when panel opens
    useEffect(() => {
        if (!open) return;
        (async () => {
            setLoading(true); setError('');
            try {
                const res  = await fetch(`${apiRoute}?history=true`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to load history');
                setVersions(data.versions ?? []);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [open, apiRoute]);

    const handleRestore = async (v: VersionMeta) => {
        setRestoring(v.name);
        try {
            const res  = await fetch(`${apiRoute}?history=${encodeURIComponent(v.name)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch version');
            onRestore(data.prompts);
            setOpen(false);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setRestoring(null);
        }
    };

    const handleDelete = async (v: VersionMeta) => {
        if (!confirm(`Delete version "${v.label}"? This cannot be undone.`)) return;
        setDeleting(v.name);
        setError('');
        try {
            const res  = await fetch(`${apiRoute}?history=${encodeURIComponent(v.name)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete version');
            setVersions(prev => prev.filter(x => x.name !== v.name));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className={`rounded-2xl border border-border bg-card ${className}`}>
            {/* Header toggle */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50 rounded-2xl transition-colors"
            >
                <span className="flex items-center gap-2 text-muted-foreground">
                    <History className="w-4 h-4" />
                    Version History
                </span>
                {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {open && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                    {loading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading versions…
                        </div>
                    )}

                    {error && (
                        <p className="text-xs text-red-400 py-2">❌ {error}</p>
                    )}

                    {!loading && !error && versions.length === 0 && (
                        <p className="text-xs text-muted-foreground py-3">No history yet — publish once to start tracking versions.</p>
                    )}

                    {!loading && versions.map((v, i) => (
                        <div
                            key={v.name}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/40 border border-border hover:border-purple-500/40 transition-colors group"
                        >
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold">
                                    {i === 0 ? (
                                        <span className="text-green-400">● Latest&nbsp;·&nbsp;</span>
                                    ) : null}
                                    {v.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">{v.name.replace('history/', '')}</span>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
                                <button
                                    onClick={() => handleRestore(v)}
                                    disabled={restoring === v.name || deleting === v.name}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all disabled:opacity-60"
                                >
                                    {restoring === v.name
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <RotateCcw className="w-3 h-3" />}
                                    Restore
                                </button>
                                <button
                                    onClick={() => handleDelete(v)}
                                    disabled={deleting === v.name || restoring === v.name}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-60"
                                >
                                    {deleting === v.name
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <Trash2 className="w-3 h-3" />}
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}

                    {!loading && versions.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Restoring loads the version into the editor — you still need to hit Publish to make it live.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
