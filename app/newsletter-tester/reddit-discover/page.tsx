'use client';

import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Search, Flame, Users, ExternalLink, RefreshCw, Layers, Sparkles, Copy, Check, ChevronDown, ChevronUp, AlertCircle, Cpu } from 'lucide-react';

interface Community {
    name:        string;
    subscribers: number;
    description: string;
    url:         string;
}

export default function RedditDiscoverTesterPage() {
    const { accounts } = useMsal();
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [running, setRunning]           = useState(false);
    const [currentStep, setCurrentStep]   = useState<'idle'|'prompts'|'queries'|'searching'|'complete'|'error'>('idle');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [userPrompt, setUserPrompt]     = useState('');
    const [showPromptsPanel, setShowPromptsPanel] = useState(false);
    const [queries, setQueries]           = useState<string[]>([]);
    const [searchProgress, setSearchProgress] = useState({ currentQuery: '', index: 0, total: 0, foundCount: 0 });
    const [communities, setCommunities]   = useState<Community[]>([]);
    const [error, setError]               = useState<string | null>(null);
    const [filterText, setFilterText]     = useState('');
    const [copiedIndex, setCopiedIndex]   = useState<number | null>(null);
    const [activeTab, setActiveTab]       = useState<'table' | 'json'>('table');

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('employee_session');
        if (saved) setEmployeeAccount(saved);
    }, []);

    const userEmail  = accounts[0]?.username;
    const isAllowed  = userEmail === 'masood@aity.dev' || employeeAccount === 'ketki@vibetrader.com' || userEmail === 'ketki@vibetrader.com';

    if (!mounted) return null;
    if (!isAllowed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background">
                <span className="text-2xl">🔒</span>
                <p className="text-sm text-muted-foreground mt-2">Access Denied. Only Masood and Ketki are allowed.</p>
            </div>
        );
    }

    const runDiscovery = async () => {
        setRunning(true); setCurrentStep('prompts'); setError(null);
        setCommunities([]); setQueries([]);
        setSearchProgress({ currentQuery: '', index: 0, total: 0, foundCount: 0 });
        try {
            const res = await fetch('/api/newsletter-pipeline/reddit-discover', { method: 'POST' });
            if (!res.body) throw new Error('No readable response body');
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const payload = JSON.parse(line.slice(6).trim());
                        if (payload.step === 'prompts') { setSystemPrompt(payload.system || ''); setUserPrompt(payload.user || ''); }
                        else if (payload.step === 'queries') { setCurrentStep('queries'); if (payload.queries) setQueries(payload.queries); }
                        else if (payload.step === 'searching') { setCurrentStep('searching'); setSearchProgress({ currentQuery: payload.query || '', index: payload.index || 0, total: payload.total || 0, foundCount: payload.foundCount || 0 }); }
                        else if (payload.step === 'complete') { setCurrentStep('complete'); setCommunities(payload.communities || []); }
                        else if (payload.step === 'error') { setCurrentStep('error'); setError(payload.message || 'Failed'); }
                    } catch {}
                }
            }
        } catch (err: any) { setError(err.message || 'Unexpected error'); setCurrentStep('error'); }
        finally { setRunning(false); }
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const filteredCommunities = communities.filter(c =>
        c.name.toLowerCase().includes(filterText.toLowerCase()) ||
        c.description.toLowerCase().includes(filterText.toLowerCase())
    );
    const totalSubscribers = communities.reduce((sum, c) => sum + c.subscribers, 0);

    return (
        <div className="flex flex-col items-center min-h-screen bg-background text-foreground py-10 px-4 gap-8">

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="text-center max-w-2xl flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-600 text-xs font-semibold uppercase tracking-wider">
                    <Sparkles size={12} />
                    Tool 1 In Isolation
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    Reddit Discover Tester
                </h1>
                <p className="text-sm text-muted-foreground">
                    Test the AI discovery queries and find active trading subreddits on Reddit.
                </p>
                <a href="/newsletter-tester"
                    className="mt-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                    ← Back to Pipeline Tester
                </a>
            </div>

            {/* ── Prompts Used Panel ───────────────────────────────────────── */}
            {(systemPrompt || userPrompt) && (
                <div className="w-full max-w-4xl bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    <button
                        onClick={() => setShowPromptsPanel(!showPromptsPanel)}
                        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Cpu className="text-purple-500" size={18} />
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Prompts Used for Discovery</h3>
                                <p className="text-xs text-muted-foreground">Click to view System and User prompts sent to the LLM</p>
                            </div>
                        </div>
                        {showPromptsPanel ? <ChevronUp size={16} className="text-muted-foreground"/> : <ChevronDown size={16} className="text-muted-foreground"/>}
                    </button>
                    {showPromptsPanel && (
                        <div className="border-t border-border p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20">
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">System Prompt</span>
                                <pre className="text-[11px] font-mono bg-background border border-border rounded-xl p-4 text-foreground max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {systemPrompt}
                                </pre>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">User Prompt</span>
                                <pre className="text-[11px] font-mono bg-background border border-border rounded-xl p-4 text-foreground max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {userPrompt}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Action Panel ────────────────────────────────────────────── */}
            <div className="w-full max-w-4xl bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Run Subreddit Discovery</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Calls the AI to brainstorm queries, then runs them against the Reddit Search API.
                        </p>
                    </div>
                    <button onClick={runDiscovery} disabled={running}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                            running ? 'bg-purple-100 text-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                        }`}>
                        {running ? <><RefreshCw className="animate-spin" size={16}/>Running AI Discovery...</> : <><Flame size={16}/>Start AI Discovery</>}
                    </button>
                </div>

                {/* ── Progress Steps ─────────────────────────────────────── */}
                {running && (
                    <div className="flex flex-col gap-4 p-5 border border-border rounded-xl bg-muted/30">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Discovery Progress</h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-start gap-3">
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                    queries.length > 0 ? 'bg-green-100 text-green-600 border border-green-300' : 'bg-purple-100 text-purple-600 animate-pulse'
                                }`}>{queries.length > 0 ? '✓' : '1'}</div>
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold text-foreground">Step 1: AI Brainstorms Search Queries</h4>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        {queries.length > 0 ? `AI generated ${queries.length} queries` : 'Generating search queries...'}
                                    </p>
                                    {queries.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto p-2 bg-background border border-border rounded-lg">
                                            {queries.map((q, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-muted text-foreground rounded border border-border text-[10px]">{q}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                    currentStep === 'complete' ? 'bg-green-100 text-green-600 border border-green-300' :
                                    currentStep === 'searching' ? 'bg-purple-100 text-purple-600 animate-pulse' : 'bg-muted text-muted-foreground'
                                }`}>{currentStep === 'complete' ? '✓' : '2'}</div>
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold text-foreground">Step 2: Scan Reddit API in Batches</h4>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        {currentStep === 'searching' ? `Searching: "${searchProgress.currentQuery}" (${searchProgress.index}/${searchProgress.total})`
                                         : currentStep === 'complete' ? 'Scan complete.' : 'Waiting...'}
                                    </p>
                                    {currentStep === 'searching' && (
                                        <div className="mt-2 flex flex-col gap-1">
                                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden border border-border">
                                                <div className="bg-purple-500 h-1.5 rounded-full transition-all duration-300"
                                                    style={{ width: `${(searchProgress.index / searchProgress.total) * 100}%` }}/>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                                <span>Found: <strong className="text-purple-600">{searchProgress.foundCount}</strong></span>
                                                <span>{Math.round((searchProgress.index / searchProgress.total) * 100)}%</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Error ─────────────────────────────────────────────── */}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle size={16}/><div><span className="font-bold">Failed: </span>{error}</div>
                    </div>
                )}

                {/* ── Results ───────────────────────────────────────────── */}
                {communities.length > 0 && currentStep === 'complete' && (
                    <div className="flex flex-col gap-6 mt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-muted/40 rounded-xl border border-border flex items-center gap-3">
                                <div className="p-2 bg-purple-50 rounded-lg"><Layers size={18} className="text-purple-600"/></div>
                                <div><p className="text-xs text-muted-foreground">Unique Subreddits</p><p className="text-lg font-bold text-foreground">{communities.length}</p></div>
                            </div>
                            <div className="p-4 bg-muted/40 rounded-xl border border-border flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-lg"><Users size={18} className="text-indigo-600"/></div>
                                <div><p className="text-xs text-muted-foreground">Combined Reach</p><p className="text-lg font-bold text-foreground">{totalSubscribers.toLocaleString()}</p></div>
                            </div>
                            <div className="p-4 bg-muted/40 rounded-xl border border-border flex items-center gap-3">
                                <div className="p-2 bg-green-50 rounded-lg"><Flame size={18} className="text-green-600"/></div>
                                <div><p className="text-xs text-muted-foreground">Discovery Mode</p><p className="text-lg font-bold text-foreground">Fully Dynamic</p></div>
                            </div>
                        </div>

                        <div className="flex border-b border-border">
                            <button
                                onClick={() => setActiveTab('table')}
                                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                                    activeTab === 'table'
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Table View
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

                        {activeTab === 'table' ? (
                            <>
                                <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-3 py-2">
                                    <Search className="text-muted-foreground" size={18}/>
                                    <input type="text" placeholder="Search discovered subreddits..." value={filterText}
                                        onChange={e => setFilterText(e.target.value)}
                                        className="bg-transparent text-sm w-full outline-none placeholder:text-muted-foreground text-foreground"/>
                                </div>

                                <div className="border border-border rounded-xl overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-muted/60 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                <th className="px-4 py-3">Subreddit</th>
                                                <th className="px-4 py-3 text-right">Subscribers</th>
                                                <th className="px-4 py-3">Description</th>
                                                <th className="px-4 py-3 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-xs divide-y divide-border">
                                            {filteredCommunities.length > 0 ? filteredCommunities.map((c, i) => (
                                                <tr key={c.name} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 font-semibold text-purple-600 whitespace-nowrap">r/{c.name}</td>
                                                    <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">{c.subscribers.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{c.description || 'No description'}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button onClick={() => handleCopy(c.name, i)} title="Copy"
                                                                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                                                                {copiedIndex === i ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
                                                            </button>
                                                            <a href={c.url} target="_blank" rel="noopener noreferrer" title="Open on Reddit"
                                                                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors flex items-center">
                                                                <ExternalLink size={14}/>
                                                            </a>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">No subreddits match your search.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <pre className="text-xs font-mono bg-muted/30 border border-border rounded-xl p-4 text-foreground max-h-[500px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                {JSON.stringify(communities, null, 2)}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
