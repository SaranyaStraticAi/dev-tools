'use client';

import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Sparkles, Image as ImageIcon, RefreshCw, AlertCircle, Eye, Download, Layers } from 'lucide-react';

export default function GenerateBannerTesterPage() {
    const { accounts } = useMsal();
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [subjectInput, setSubjectInput] = useState('Stopped out by news volatility before the rally...');
    const [running, setRunning] = useState(false);

    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');

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

    const runGenerateBanner = async () => {
        if (!subjectInput.trim()) {
            setError('Please enter subject text to generate.');
            return;
        }

        setRunning(true);
        setError(null);
        setBannerUrl(null);

        try {
            const res = await fetch('/api/newsletter-pipeline/generate-banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: subjectInput }),
            });
            const data = await res.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to generate banner.');
            }

            setBannerUrl(data.url || '');
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen bg-background text-foreground py-10 px-4 gap-8">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="text-center max-w-2xl flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-600 text-xs font-semibold uppercase tracking-wider">
                    <Sparkles size={12} />
                    Tool 7 In Isolation
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    Banner Generator Tester
                </h1>
                <p className="text-sm text-muted-foreground">
                    Test the Canvas layout engine by overlaying subject line text onto the newsletter hero banner.
                </p>
                <a href="/newsletter-tester"
                    className="mt-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                    ← Back to Pipeline Tester
                </a>
            </div>

            {/* ── Workspace ────────────────────────────────────────────────── */}
            <div className="w-full max-w-4xl bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
                
                {/* ── Input Controls ───────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="flex-1 flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-foreground">Subject Line / Banner Text</label>
                        <input
                            type="text"
                            value={subjectInput}
                            onChange={(e) => setSubjectInput(e.target.value)}
                            placeholder="e.g. Stopped out by news volatility before the rally..."
                            className="w-full text-sm px-3.5 py-2 border border-border rounded-xl outline-none focus:ring-1 focus:ring-purple-500 bg-background text-foreground"
                        />
                    </div>

                    <button
                        onClick={runGenerateBanner}
                        disabled={running}
                        className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                            running
                                ? 'bg-purple-100 text-purple-400 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                        }`}
                    >
                        {running ? (
                            <>
                                <RefreshCw className="animate-spin" size={16} />
                                Rendering Image...
                            </>
                        ) : (
                            <>
                                <ImageIcon size={16} />
                                Generate Banner (Tool 7)
                            </>
                        )}
                    </button>
                </div>

                {/* ── Error ─────────────────────────────────────────────── */}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle size={16} />
                        <div><span className="font-bold">Error:</span> {error}</div>
                    </div>
                )}

                {/* ── Results ───────────────────────────────────────────── */}
                {bannerUrl && !running && (
                    <div className="flex flex-col gap-6 mt-2">
                        
                        {/* Tab Switcher */}
                        <div className="flex border-b border-border">
                            <button
                                onClick={() => setActiveTab('preview')}
                                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                                    activeTab === 'preview'
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Image Preview
                            </button>
                            <button
                                onClick={() => setActiveTab('json')}
                                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                                    activeTab === 'json'
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                JSON View
                            </button>
                        </div>

                        {activeTab === 'preview' ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="p-2 border border-border bg-muted/20 rounded-2xl w-full max-w-2xl overflow-hidden shadow-sm">
                                    <img 
                                        src={bannerUrl} 
                                        alt="Generated Banner" 
                                        className="w-full h-auto rounded-xl object-contain"
                                    />
                                </div>

                                <a
                                    href={bannerUrl}
                                    download="newsletter-banner.png"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-xs font-bold px-5 py-2 border border-border hover:bg-muted rounded-xl transition-all shadow-sm cursor-pointer"
                                >
                                    <Download size={14} />
                                    Download Banner / Open Image
                                </a>
                            </div>
                        ) : (
                            <pre className="text-xs font-mono bg-muted/30 border border-border rounded-xl p-4 text-foreground max-h-[400px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                {JSON.stringify({ success: true, url: bannerUrl }, null, 2)}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
