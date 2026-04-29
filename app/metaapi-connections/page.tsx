'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Users, Wifi, WifiOff, Copy, ExternalLink } from 'lucide-react';

interface ConnectionRow {
    userId: string;
    accountId: string | null;
    connected: boolean;
    lastUpdated: string | null;
    brokerName: string | null;
    server: string | null;
    platform: string | null;
    region: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    clerkInstance: string | null;
}

interface Summary {
    total: number;
    connected: number;
    disconnected: number;
    metaApiLiveData: boolean;
}

type FilterStatus = 'all' | 'connected' | 'disconnected';

export default function MetaApiConnectionsPage() {
    const [connections, setConnections] = useState<ConnectionRow[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [search, setSearch] = useState('');
    const [copied, setCopied] = useState<string | null>(null);

    const fetchConnections = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/metaapi-connections');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch');
            setConnections(data.connections ?? []);
            setSummary(data.summary ?? null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConnections(); }, [fetchConnections]);

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
    };

    const formatDate = (val: string | null) => {
        if (!val) return '—';
        try { return new Date(val).toLocaleString(); } catch { return val; }
    };

    const displayName = (row: ConnectionRow) => {
        const name = [row.firstName, row.lastName].filter(Boolean).join(' ');
        return name || row.email || row.userId;
    };

    const filtered = connections.filter(c => {
        if (filter === 'connected' && !c.connected) return false;
        if (filter === 'disconnected' && c.connected) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return (
                c.email?.toLowerCase().includes(q) ||
                c.userId.toLowerCase().includes(q) ||
                c.accountId?.toLowerCase().includes(q) ||
                c.brokerName?.toLowerCase().includes(q) ||
                c.firstName?.toLowerCase().includes(q) ||
                c.lastName?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8 pt-16 md:pt-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                MetaAPI Broker Connections
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                                All users connected via MetaAPI — for billing &amp; budget tracking
                                {summary?.metaApiLiveData && (
                                    <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                                        ✓ Live MetaAPI data
                                    </span>
                                )}
                            </p>
                        </div>
                        <button
                            onClick={fetchConnections}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            {loading ? 'Loading…' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {/* Summary cards */}
                {summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 flex items-center gap-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                <Users size={22} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">{summary.total}</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 flex items-center gap-4 cursor-pointer hover:ring-2 hover:ring-green-400 transition-all"
                            onClick={() => setFilter(filter === 'connected' ? 'all' : 'connected')}>
                            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                                <Wifi size={22} className="text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Connected</p>
                                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{summary.connected}</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 flex items-center gap-4 cursor-pointer hover:ring-2 hover:ring-red-400 transition-all"
                            onClick={() => setFilter(filter === 'disconnected' ? 'all' : 'disconnected')}>
                            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <WifiOff size={22} className="text-red-500 dark:text-red-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Disconnected</p>
                                <p className="text-3xl font-bold text-red-500 dark:text-red-400">{summary.disconnected}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-red-800 dark:text-red-400 font-medium">Error: {error}</p>
                    </div>
                )}

                {/* Filter + Search */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 flex flex-wrap gap-3 items-center">
                    <div className="flex gap-2">
                        {(['all', 'connected', 'disconnected'] as FilterStatus[]).map(f => (
                            <button key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                                    filter === f
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by email, user ID, account ID, broker…"
                        className="flex-1 min-w-[200px] px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {filtered.length} of {connections.length} rows
                    </span>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                    {loading && connections.length === 0 ? (
                        <div className="p-16 text-center text-gray-500 dark:text-gray-400">
                            <RefreshCw size={32} className="animate-spin mx-auto mb-3 opacity-50" />
                            Loading connections…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-16 text-center text-gray-500 dark:text-gray-400">
                            No connections found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                    <tr>
                                        {['Status', 'User', 'Email', 'MetaAPI Account ID', 'Broker', 'Server', 'Platform', 'Region', 'Last Updated'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {filtered.map((row, i) => (
                                        <tr key={row.userId + i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            {/* Status */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {row.connected ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                        Connected
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                                        Disconnected
                                                    </span>
                                                )}
                                            </td>

                                            {/* User */}
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{displayName(row)}</div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-xs text-gray-400 font-mono truncate max-w-[140px]">{row.userId}</span>
                                                    <button onClick={() => copyToClipboard(row.userId, `uid-${i}`)}
                                                        className="opacity-0 hover:opacity-100 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
                                                        title="Copy user ID">
                                                        <Copy size={11} />
                                                    </button>
                                                </div>
                                                {row.clerkInstance && (
                                                    <span className="text-xs text-indigo-500 dark:text-indigo-400">{row.clerkInstance}</span>
                                                )}
                                            </td>

                                            {/* Email */}
                                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                {row.email ?? <span className="text-gray-400 italic">—</span>}
                                            </td>

                                            {/* Account ID */}
                                            <td className="px-4 py-3">
                                                {row.accountId ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate max-w-[160px]">
                                                            {row.accountId}
                                                        </span>
                                                        <button
                                                            onClick={() => copyToClipboard(row.accountId!, `acc-${i}`)}
                                                            className="text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0"
                                                            title="Copy account ID"
                                                        >
                                                            {copied === `acc-${i}` ? <span className="text-green-500 text-xs">✓</span> : <Copy size={12} />}
                                                        </button>
                                                        <a
                                                            href={`/metaapi-lookup?accountId=${row.accountId}`}
                                                            className="text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0"
                                                            title="Open in MetaAPI Lookup"
                                                        >
                                                            <ExternalLink size={12} />
                                                        </a>
                                                    </div>
                                                ) : <span className="text-gray-400 italic text-sm">—</span>}
                                            </td>

                                            {/* Broker */}
                                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                {row.brokerName ?? <span className="text-gray-400">—</span>}
                                            </td>

                                            {/* Server */}
                                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                {row.server ?? <span className="text-gray-400">—</span>}
                                            </td>

                                            {/* Platform */}
                                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                {row.platform ?? <span className="text-gray-400">—</span>}
                                            </td>

                                            {/* Region */}
                                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                {row.region ?? <span className="text-gray-400">—</span>}
                                            </td>

                                            {/* Last Updated */}
                                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {formatDate(row.lastUpdated)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
