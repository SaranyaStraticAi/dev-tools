'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    RefreshCw, Wifi, WifiOff, Copy, ExternalLink, AlertTriangle,
    ChevronDown, ChevronUp, Zap, Clock, TrendingUp, Activity,
    PowerOff, Power, Trash2, X, CheckCircle, DollarSign
} from 'lucide-react';
import type { ConnectionRow, ConnectionsSummary } from '../api/metaapi-connections/route';

// ── helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (v: string | null) => {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return v; }
};
const fmtDateTime = (v: string | null) => {
    if (!v) return '—';
    try { return new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return v; }
};
const fmtUsd = (v: number) => `$${v.toFixed(2)}`;

// ── Policy badge ───────────────────────────────────────────────────────────────
const POLICY_LABELS: Record<string, { label: string; cls: string; desc: string }> = {
    'always-on':             { label: 'Always On',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',    desc: 'Never undeployed — paid user with active strategies or manual override' },
    'weekend-only':          { label: 'Weekend Off', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',        desc: 'Undeployed on forex weekends only — paid user, no active strategies' },
    'overnight-and-weekend': { label: 'Free Tier',   cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', desc: 'Undeployed after 6h idle or on weekends — free tier user' },
};

// ── Lifecycle state badge ──────────────────────────────────────────────────────
const STATE_LABELS: Record<string, { label: string; cls: string }> = {
    'DEPLOYED':    { label: 'Deployed',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    'UNDEPLOYED':  { label: 'Undeployed', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
    'DEPLOYING':   { label: 'Deploying…', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    'UNDEPLOYING': { label: 'Stopping…',  cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

// ── Usage bar ──────────────────────────────────────────────────────────────────
function UsageBar({ used, total, label }: { used: number; total: number; label: string }) {
    const n = Number(used) || 0;
    const pct = Math.min(100, (n / total) * 100);
    const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
    return (
        <div className="w-full">
            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>{label}</span>
                <span>{n.toFixed(1)} / {total}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ── Confirm dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ action, row, onConfirm, onCancel, loading }: {
    action: 'undeploy' | 'deploy' | 'delete';
    row: ConnectionRow;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}) {
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email || row.userId;
    const configs = {
        undeploy: {
            title: 'Undeploy MetaAPI Account',
            desc: `This will stop the MetaAPI terminal for ${name}. The account still exists — they can redeploy. Billing stops while undeployed.`,
            btnCls: 'bg-yellow-600 hover:bg-yellow-700',
            btnLabel: 'Undeploy',
            icon: PowerOff,
        },
        deploy: {
            title: 'Deploy MetaAPI Account',
            desc: `This will start the MetaAPI terminal for ${name}. Billing resumes once deployed.`,
            btnCls: 'bg-green-600 hover:bg-green-700',
            btnLabel: 'Deploy',
            icon: Power,
        },
        delete: {
            title: '⚠️ Delete MetaAPI Account',
            desc: `This permanently deletes the MetaAPI account for ${name} (account ID: ${row.accountId}). This CANNOT be undone. The user will need to reconnect their broker.`,
            btnCls: 'bg-red-600 hover:bg-red-700',
            btnLabel: 'Permanently Delete',
            icon: Trash2,
        },
    };
    const cfg = configs[action];
    const Icon = cfg.icon;
    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <div className={`p-2 rounded-lg ${action === 'delete' ? 'bg-red-100 text-red-600' : action === 'undeploy' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
                            <Icon size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{cfg.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{cfg.desc}</p>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4 text-xs font-mono text-gray-600 dark:text-gray-300">
                        Account ID: {row.accountId ?? '—'}
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button onClick={onCancel} disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button onClick={onConfirm} disabled={loading}
                            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${cfg.btnCls} disabled:opacity-50`}>
                            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Icon size={14} />}
                            {loading ? 'Processing…' : cfg.btnLabel}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

// ── Summary cards ──────────────────────────────────────────────────────────────
function SummaryCards({ s, ratePerHour }: { s: ConnectionsSummary; ratePerHour: number }) {
    const monthlyPerAccount = (ratePerHour * 720).toFixed(2);
    const cards = [
        { label: 'Total',          value: s.total,               cls: 'text-blue-600 dark:text-blue-400',       icon: Activity },
        { label: 'Connected',      value: s.connected,           cls: 'text-green-600 dark:text-green-400',     icon: Wifi },
        { label: 'Deployed',       value: s.deployed,            cls: 'text-emerald-600 dark:text-emerald-400', icon: Power },
        { label: 'Undeployed',     value: s.undeployed,          cls: 'text-gray-500 dark:text-gray-400',       icon: PowerOff },
        { label: 'Always On',      value: s.alwaysOn,            cls: 'text-green-600 dark:text-green-400',     icon: CheckCircle },
        { label: 'Weekend Off',    value: s.weekendOnly,         cls: 'text-blue-600 dark:text-blue-400',       icon: Clock },
        { label: 'Free Tier',      value: s.overnightAndWeekend, cls: 'text-orange-600 dark:text-orange-400',   icon: Zap },
        { label: 'Avg Hours Used', value: `${Number(s.avgDeployedHours).toFixed(1)}h`, cls: 'text-purple-600 dark:text-purple-400', icon: TrendingUp },
    ];
    return (
        <div className="space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-wrap gap-6 items-center">
                <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-yellow-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Rate:</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">${ratePerHour}/h</span>
                    <span className="text-xs text-gray-400">(≈${monthlyPerAccount}/account/month always-on)</span>
                </div>
                <div className="h-5 w-px bg-gray-200 dark:bg-gray-600 hidden sm:block" />
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Lifetime spend:</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{fmtUsd(s.totalActualCostUsd)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Current sessions:</span>
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{fmtUsd(s.totalCurrentSessionCostUsd)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Projected monthly:</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">{fmtUsd(s.projectedMonthlyCostUsd)}</span>
                    <span className="text-xs text-gray-400">({s.deployed} deployed × ${monthlyPerAccount})</span>
                </div>
                <span className="text-[10px] text-gray-400 ml-auto">Set METAAPI_RATE_PER_HOUR in .env.local to match your invoice</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {cards.map(c => {
                    const Icon = c.icon;
                    return (
                        <div key={c.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-3">
                            <Icon size={14} className={`mb-1 ${c.cls}`} />
                            <p className={`text-2xl font-bold leading-none ${c.cls}`}>{c.value}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{c.label}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDismiss }: { msg: string; type: 'success' | 'error'; onDismiss: () => void }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 4000);
        return () => clearTimeout(t);
    }, [onDismiss]);
    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium
            ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {msg}
            <button onClick={onDismiss}><X size={14} /></button>
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────
type FilterStatus = 'all' | 'connected' | 'disconnected';
type FilterState = 'all' | 'DEPLOYED' | 'UNDEPLOYED';
type FilterPolicy = 'all' | 'always-on' | 'weekend-only' | 'overnight-and-weekend';
type SortKey = keyof ConnectionRow;

export default function MetaApiConnectionsPage() {
    const [connections, setConnections] = useState<ConnectionRow[]>([]);
    const [summary, setSummary] = useState<ConnectionsSummary | null>(null);
    const [ratePerHour, setRatePerHour] = useState<number>(0.0152);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [filterState, setFilterState] = useState<FilterState>('all');
    const [filterPolicy, setFilterPolicy] = useState<FilterPolicy>('all');
    const [search, setSearch] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('lastDeployedAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [pendingAction, setPendingAction] = useState<{ action: 'undeploy' | 'deploy' | 'delete'; row: ConnectionRow } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchConnections = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch('/api/metaapi-connections');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch');
            setConnections(data.connections ?? []);
            setSummary(data.summary ?? null);
            if (data.ratePerHour) setRatePerHour(data.ratePerHour);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchConnections(); }, [fetchConnections]);

    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const execAction = async () => {
        if (!pendingAction) return;
        const { action, row } = pendingAction;
        if (!row.accountId) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/metaapi-manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, accountId: row.accountId, userId: row.userId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Action failed');
            setToast({ msg: `${action.charAt(0).toUpperCase() + action.slice(1)} successful for ${row.email || row.userId}`, type: 'success' });
            setPendingAction(null);
            setTimeout(() => fetchConnections(), 1500);
        } catch (e: any) {
            setToast({ msg: e.message, type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const filtered = useMemo(() => {
        let r = connections;
        if (filterStatus === 'connected') r = r.filter(c => c.connected);
        if (filterStatus === 'disconnected') r = r.filter(c => !c.connected);
        if (filterState !== 'all') r = r.filter(c => c.lifecycleState === filterState);
        if (filterPolicy !== 'all') r = r.filter(c => c.policy === filterPolicy);
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter(c =>
                c.email?.toLowerCase().includes(q) ||
                c.userId.toLowerCase().includes(q) ||
                c.accountId?.toLowerCase().includes(q) ||
                c.brokerName?.toLowerCase().includes(q) ||
                c.server?.toLowerCase().includes(q)
            );
        }
        return [...r].sort((a, b) => {
            const av = (a as any)[sortKey] ?? '';
            const bv = (b as any)[sortKey] ?? '';
            if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
            return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
    }, [connections, filterStatus, filterState, filterPolicy, search, sortKey, sortDir]);

    function SortTh({ label, k }: { label: string; k: SortKey }) {
        const active = sortKey === k;
        return (
            <th onClick={() => handleSort(k)} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-gray-800 dark:hover:text-white select-none">
                <span className="flex items-center gap-1">{label}{active ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : null}</span>
            </th>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6 pt-16 md:pt-6">
            <div className="max-w-[1800px] mx-auto space-y-5">

                {/* Header */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MetaAPI Connections</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Usage tracking · Lifecycle state · Billing actions
                            {summary?.metaApiLiveData && <span className="ml-2 text-green-600 dark:text-green-400 font-medium">✓ Live MetaAPI data</span>}
                        </p>
                    </div>
                    <button onClick={fetchConnections} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors">
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>

                {summary && <SummaryCards s={summary} ratePerHour={ratePerHour} />}

                {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">Error: {error}</div>}

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-wrap gap-3 items-center">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search email, user ID, account ID, broker, server…"
                        className="flex-1 min-w-[200px] text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as FilterStatus)}
                        className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white">
                        <option value="all">All connections</option>
                        <option value="connected">Connected</option>
                        <option value="disconnected">Disconnected</option>
                    </select>
                    <select value={filterState} onChange={e => setFilterState(e.target.value as FilterState)}
                        className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white">
                        <option value="all">All states</option>
                        <option value="DEPLOYED">Deployed</option>
                        <option value="UNDEPLOYED">Undeployed</option>
                    </select>
                    <select value={filterPolicy} onChange={e => setFilterPolicy(e.target.value as FilterPolicy)}
                        className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white">
                        <option value="all">All policies</option>
                        <option value="always-on">Always On</option>
                        <option value="weekend-only">Weekend Off</option>
                        <option value="overnight-and-weekend">Free Tier</option>
                    </select>
                    <span className="text-xs text-gray-500 ml-auto whitespace-nowrap">{filtered.length} / {connections.length}</span>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
                    {loading && !connections.length ? (
                        <div className="p-16 text-center text-gray-400"><RefreshCw size={28} className="animate-spin mx-auto mb-3 opacity-40" />Loading…</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-16 text-center text-gray-400">No connections found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700/60 sticky top-0 z-10">
                                    <tr>
                                        <SortTh label="User" k="email" />
                                        <SortTh label="Broker Status" k="connected" />
                                        <SortTh label="Lifecycle" k="lifecycleState" />
                                        <SortTh label="Policy" k="policy" />
                                        <SortTh label="Hours Used" k="deployedHoursAccrued" />
                                        <SortTh label="Hours Left" k="deployedHoursRemaining" />
                                        <SortTh label="Trades" k="lifetimeTrades" />
                                        <SortTh label="Deployments" k="lifetimeDeployments" />
                                        <SortTh label="Cost (Lifetime)" k="actualCostUsd" />
                                        <SortTh label="Session Cost" k="currentSessionCostUsd" />
                                        <SortTh label="Balance" k="cachedBalance" />
                                        <SortTh label="MetaAPI Account" k="accountId" />
                                        <SortTh label="Broker" k="brokerName" />
                                        <SortTh label="Last Deployed" k="lastDeployedAt" />
                                        <SortTh label="Last Trade" k="lastTradeAt" />
                                        <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap sticky right-0 bg-gray-50 dark:bg-gray-700/60 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                    {filtered.map((row, i) => {
                                        const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || '—';
                                        const policy = row.policy ? POLICY_LABELS[row.policy] : null;
                                        const state = row.lifecycleState ? STATE_LABELS[row.lifecycleState] : null;
                                        const isDeployed = row.lifecycleState === 'DEPLOYED';
                                        return (
                                            <tr key={row.userId + i} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/30 transition-colors">

                                                {/* User */}
                                                <td className="px-3 py-2.5">
                                                    <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[160px]">{name}</div>
                                                    <div className="text-xs text-gray-500 truncate max-w-[160px]">{row.email ?? <span className="italic text-red-400">no email</span>}</div>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <span className="text-[10px] font-mono text-gray-400 truncate max-w-[120px]">{row.userId}</span>
                                                        <button onClick={() => copy(row.userId, `uid-${i}`)} className="text-gray-300 hover:text-blue-500">
                                                            {copied === `uid-${i}` ? <span className="text-green-500 text-[10px]">✓</span> : <Copy size={9} />}
                                                        </button>
                                                    </div>
                                                    {row.clerkInstance && <span className="text-[10px] text-indigo-500">{row.clerkInstance}</span>}
                                                </td>

                                                {/* Broker status */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {row.connected
                                                        ? <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Connected</span>
                                                        : <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-gray-300" />Disconnected</span>}
                                                </td>

                                                {/* Lifecycle */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {state ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${state.cls}`}>{state.label}</span> : <span className="text-gray-400 text-xs">—</span>}
                                                    {row.lastUndeployReason && <div className="text-[10px] text-gray-400 mt-0.5">{row.lastUndeployReason}</div>}
                                                </td>

                                                {/* Policy */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {policy ? <span title={policy.desc} className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-help ${policy.cls}`}>{policy.label}</span> : <span className="text-gray-400 text-xs">—</span>}
                                                    {row.alwaysOnFlag && <div className="text-[10px] text-green-500 mt-0.5">Manual override</div>}
                                                </td>

                                                {/* Hours used */}
                                                <td className="px-3 py-2.5 min-w-[110px]">
                                                    <UsageBar used={row.deployedHoursAccrued} total={60} label="" />
                                                    <div className="text-[10px] text-gray-500 mt-0.5">{Number(row.deployedHoursAccrued).toFixed(1)}h used</div>
                                                </td>

                                                {/* Hours remaining */}
                                                <td className="px-3 py-2.5 whitespace-nowrap text-center">
                                                    <span className={`text-sm font-semibold ${Number(row.deployedHoursRemaining) <= 10 ? 'text-red-500' : Number(row.deployedHoursRemaining) <= 20 ? 'text-yellow-500' : 'text-green-600 dark:text-green-400'}`}>
                                                        {Number(row.deployedHoursRemaining).toFixed(0)}h
                                                    </span>
                                                    <div className="text-[10px] text-gray-400">remaining</div>
                                                </td>

                                                {/* Trades */}
                                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                    {row.lifetimeTrades > 0
                                                        ? <div><span className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.lifetimeTrades}</span><UsageBar used={row.lifetimeTrades} total={10} label="" /></div>
                                                        : <span className="text-gray-400 text-xs">—</span>}
                                                </td>

                                                {/* Deployments */}
                                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                    {row.lifetimeDeployments > 0
                                                        ? <div><span className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.lifetimeDeployments}</span><UsageBar used={row.lifetimeDeployments} total={10} label="" /></div>
                                                        : <span className="text-gray-400 text-xs">—</span>}
                                                </td>

                                                {/* Lifetime cost */}
                                                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                                                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtUsd(Number(row.actualCostUsd) || 0)}</span>
                                                    <div className="text-[10px] text-gray-400">{Number(row.deployedHoursAccrued).toFixed(1)}h billed</div>
                                                </td>

                                                {/* Session cost */}
                                                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                                                    {(Number(row.currentSessionCostUsd) || 0) > 0
                                                        ? <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">{fmtUsd(Number(row.currentSessionCostUsd))}</span>
                                                        : <span className="text-gray-400 text-xs">—</span>}
                                                </td>

                                                {/* Balance */}
                                                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                                                    {row.cachedBalance != null
                                                        ? <div>
                                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">${row.cachedBalance.toLocaleString('en', { maximumFractionDigits: 2 })}</span>
                                                            {row.cachedEquity != null && <div className="text-[10px] text-gray-400">Eq: ${row.cachedEquity.toLocaleString('en', { maximumFractionDigits: 2 })}</div>}
                                                          </div>
                                                        : <span className="text-gray-400 text-xs">—</span>}
                                                </td>

                                                {/* MetaAPI Account */}
                                                <td className="px-3 py-2.5">
                                                    {row.accountId
                                                        ? <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 truncate max-w-[130px]">{row.accountId}</span>
                                                            <button onClick={() => copy(row.accountId!, `acc-${i}`)} className="text-gray-300 hover:text-blue-500 flex-shrink-0">
                                                                {copied === `acc-${i}` ? <span className="text-green-500 text-[10px]">✓</span> : <Copy size={9} />}
                                                            </button>
                                                            <a href={`/metaapi-lookup?accountId=${row.accountId}`} className="text-gray-300 hover:text-blue-500 flex-shrink-0"><ExternalLink size={9} /></a>
                                                          </div>
                                                        : <span className="text-gray-400 text-xs">—</span>}
                                                    {row.platform && <div className="text-[10px] text-gray-400">{row.platform} · {row.region}</div>}
                                                </td>

                                                {/* Broker */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="text-xs text-gray-700 dark:text-gray-300">{row.brokerName ?? '—'}</div>
                                                    {row.server && <div className="text-[10px] text-gray-400 truncate max-w-[100px]">{row.server}</div>}
                                                </td>

                                                {/* Last deployed */}
                                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500">{fmtDateTime(row.lastDeployedAt)}</td>

                                                {/* Last trade */}
                                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500">{fmtDate(row.lastTradeAt)}</td>

                                                {/* Actions — sticky right */}
                                                <td className="px-3 py-2.5 whitespace-nowrap sticky right-0 bg-white dark:bg-gray-800 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                                                    {row.accountId ? (
                                                        <div className="flex items-center gap-1.5">
                                                            {isDeployed ? (
                                                                <button onClick={() => setPendingAction({ action: 'undeploy', row })}
                                                                    title="Undeploy — stops terminal, saves billing"
                                                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 transition-colors">
                                                                    <PowerOff size={10} /> Undeploy
                                                                </button>
                                                            ) : (
                                                                <button onClick={() => setPendingAction({ action: 'deploy', row })}
                                                                    title="Deploy — restarts terminal"
                                                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 transition-colors">
                                                                    <Power size={10} /> Deploy
                                                                </button>
                                                            )}
                                                            <button onClick={() => setPendingAction({ action: 'delete', row })}
                                                                title="Delete permanently — cannot be undone"
                                                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors">
                                                                <Trash2 size={10} /> Delete
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 italic">No account ID</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {pendingAction && (
                <ConfirmDialog
                    action={pendingAction.action}
                    row={pendingAction.row}
                    onConfirm={execAction}
                    onCancel={() => setPendingAction(null)}
                    loading={actionLoading}
                />
            )}

            {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
}
