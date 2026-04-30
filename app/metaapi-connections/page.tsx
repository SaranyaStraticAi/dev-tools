'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Copy, ExternalLink, Activity, X, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface SummaryCounts {
    total: number;
    connected: number;
    disconnected: number;
}

type SearchKind = 'userId' | 'email' | 'name' | 'none';

interface ConnectionRow {
    userId: string;
    accountId: string | null;
    connected: boolean;
    lastUpdated: string | null;
    brokerName: string | null;
    server: string | null;
    platform: string | null;
    region: string | null;
}

interface ClerkUserSummary {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    instance: 'Live' | 'Dev';
}

interface PageInfo {
    size: number;
    requestedSize: number;
    nextContinuationToken: string | null;
}

type FilterStatus = 'all' | 'connected' | 'disconnected';

type HealthStatus = 'Healthy' | 'Inactive' | 'Degraded' | 'Down' | 'Unknown';

interface HealthBundle {
    status: HealthStatus;
    reason: string;
    checkedAt: string;
    provisioning: {
        state: string | null;
        connectionStatus: string | null;
        region: string | null;
        reliability: string | null;
        resourceSlots: number | null;
        copyFactoryResourceSlots: number | null;
        connections: Array<{ region?: string; zone?: string; application?: string }>;
        platform: string | null;
        server: string | null;
        login: string | number | null;
    } | null;
    accountInfo: {
        tradeAllowed: boolean | null;
        balance: number | null;
        equity: number | null;
        marginLevel: number | null;
        currency: string | null;
        leverage: number | null;
    } | null;
    errors: string[];
}

type HealthCellState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ok'; bundle: HealthBundle }
    | { kind: 'error'; message: string };

// Neutral palette: a single colored dot communicates status; chip stays outline.
const HEALTH_DOT: Record<HealthStatus, string> = {
    Healthy: 'bg-emerald-500',
    Inactive: 'bg-sky-400',
    Degraded: 'bg-amber-500',
    Down: 'bg-red-500',
    Unknown: 'bg-muted-foreground',
};

export default function MetaApiConnectionsPage() {
    const [connections, setConnections] = useState<ConnectionRow[]>([]);
    const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
    const [metaApiLiveData, setMetaApiLiveData] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [search, setSearch] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [healthByAccount, setHealthByAccount] = useState<Record<string, HealthCellState>>({});
    const [openDetail, setOpenDetail] = useState<{ row: ConnectionRow; bundle: HealthBundle } | null>(null);
    const [clerkByUser, setClerkByUser] = useState<Record<string, ClerkUserSummary | null>>({});
    const [summary, setSummary] = useState<SummaryCounts | null>(null);

    // Search-mode state. When `searchActive` is true we display searchResults
    // instead of the paginated `connections` list.
    const [searchActive, setSearchActive] = useState(false);
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<ConnectionRow[]>([]);
    const [searchKind, setSearchKind] = useState<SearchKind>('none');
    const searchSeq = useRef(0); // guard against stale responses from older queries

    const fetchClerkForUserIds = useCallback(async (userIds: string[]) => {
        if (userIds.length === 0) return;
        try {
            const res = await fetch('/api/clerk-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userIds }),
            });
            const data = await res.json();
            const users: Record<string, ClerkUserSummary> = data?.users ?? {};
            setClerkByUser(prev => {
                const next = { ...prev };
                // Mark every requested ID — null means "looked up, not found".
                for (const id of userIds) next[id] = users[id] ?? null;
                return next;
            });
        } catch (e) {
            console.error('Clerk batch fetch failed:', (e as Error).message);
        }
    }, []);

    const fetchConnections = useCallback(async (continuationToken?: string) => {
        const isFirstPage = !continuationToken;
        if (isFirstPage) setLoading(true);
        else setLoadingMore(true);
        setError(null);
        try {
            const url = new URL('/api/metaapi-connections', window.location.origin);
            url.searchParams.set('pageSize', '50');
            if (continuationToken) url.searchParams.set('continuationToken', continuationToken);

            const res = await fetch(url.toString());
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch');

            const newRows: ConnectionRow[] = data.connections ?? [];
            setConnections(prev => isFirstPage ? newRows : [...prev, ...newRows]);
            setPageInfo(data.page ?? null);
            setMetaApiLiveData(!!data.metaApiLiveData);

            // Lazy-load Clerk for the new rows (don't block the table render)
            const userIdsNeedingClerk = newRows
                .map(r => r.userId)
                .filter(id => clerkByUser[id] === undefined);
            if (userIdsNeedingClerk.length > 0) {
                void fetchClerkForUserIds(userIdsNeedingClerk);
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [clerkByUser, fetchClerkForUserIds]);

    // First-page load on mount only — fetchConnections changes when clerkByUser
    // updates, but we don't want to refetch the table every time Clerk data lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchConnections(); }, []);

    const fetchSummary = useCallback(async () => {
        try {
            const res = await fetch('/api/metaapi-connections/summary');
            if (!res.ok) return;
            const data = await res.json();
            setSummary({
                total: data.total ?? 0,
                connected: data.connected ?? 0,
                disconnected: data.disconnected ?? 0,
            });
        } catch (e) {
            console.error('Summary fetch failed:', (e as Error).message);
        }
    }, []);

    useEffect(() => { fetchSummary(); }, [fetchSummary]);

    // Debounced server-side search.
    useEffect(() => {
        const q = search.trim();
        if (!q) {
            setSearchActive(false);
            setSearchResults([]);
            setSearchKind('none');
            return;
        }
        const seq = ++searchSeq.current;
        setSearchActive(true);
        setSearching(true);
        const handle = setTimeout(async () => {
            try {
                const url = new URL('/api/metaapi-connections/search', window.location.origin);
                url.searchParams.set('q', q);
                const res = await fetch(url.toString());
                if (seq !== searchSeq.current) return; // a newer search has superseded us
                const data = await res.json();
                if (!res.ok) {
                    setSearchResults([]);
                    setSearchKind('none');
                    setError(data.error ?? 'Search failed');
                    return;
                }
                const rows: ConnectionRow[] = data.connections ?? [];
                setSearchResults(rows);
                setSearchKind((data.searchKind as SearchKind) ?? 'none');
                // Lazy Clerk for any matched userIds we don't already have.
                const need = rows.map(r => r.userId).filter(id => clerkByUser[id] === undefined);
                if (need.length > 0) void fetchClerkForUserIds(need);
            } catch (e) {
                if (seq === searchSeq.current) {
                    setSearchResults([]);
                    setError((e as Error).message);
                }
            } finally {
                if (seq === searchSeq.current) setSearching(false);
            }
        }, 300);
        return () => clearTimeout(handle);
    }, [search, clerkByUser, fetchClerkForUserIds]);

    const checkHealth = useCallback(async (accountId: string) => {
        setHealthByAccount(prev => ({ ...prev, [accountId]: { kind: 'loading' } }));
        try {
            const res = await fetch('/api/metaapi-connections/health', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId }),
            });
            const data = await res.json();
            if (data?.health) {
                setHealthByAccount(prev => ({ ...prev, [accountId]: { kind: 'ok', bundle: data.health } }));
            } else {
                setHealthByAccount(prev => ({
                    ...prev,
                    [accountId]: { kind: 'error', message: data?.error ?? 'Unknown error' },
                }));
            }
        } catch (e) {
            setHealthByAccount(prev => ({
                ...prev,
                [accountId]: { kind: 'error', message: (e as Error).message },
            }));
        }
    }, []);

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
        const clerk = clerkByUser[row.userId];
        if (clerk) {
            const name = [clerk.firstName, clerk.lastName].filter(Boolean).join(' ');
            return name || clerk.email || row.userId;
        }
        // Clerk lookup hasn't returned yet (or returned null) — fall back to userId.
        return row.userId;
    };

    // Search results replace the paginated dataset; status filter still applies.
    const sourceRows = searchActive ? searchResults : connections;
    const filtered = sourceRows.filter(c => {
        if (filter === 'connected' && !c.connected) return false;
        if (filter === 'disconnected' && c.connected) return false;
        return true;
    });

    const refreshAll = () => {
        setConnections([]);
        setPageInfo(null);
        setHealthByAccount({});
        fetchConnections();
        fetchSummary();
    };

    return (
        <div className="space-y-4">
            <div className="space-y-4">

                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                        <h1 className="text-xl font-semibold">MetaAPI Broker Connections</h1>
                        <p className="text-sm text-muted-foreground">
                            All users connected via MetaAPI — for billing &amp; budget tracking
                            {metaApiLiveData && <span className="ml-2 text-foreground">· live data</span>}
                        </p>
                    </div>
                    <Button onClick={refreshAll} disabled={loading} variant="outline" size="sm">
                        <RefreshCw className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Loading…' : 'Refresh'}
                    </Button>
                </div>

                {/* Summary cards */}
                {summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <SummaryStat label="Total" value={summary.total} />
                        <SummaryStat
                            label="Connected"
                            value={summary.connected}
                            active={filter === 'connected'}
                            onClick={() => setFilter(filter === 'connected' ? 'all' : 'connected')}
                            dot="bg-emerald-500"
                        />
                        <SummaryStat
                            label="Disconnected"
                            value={summary.disconnected}
                            active={filter === 'disconnected'}
                            onClick={() => setFilter(filter === 'disconnected' ? 'all' : 'disconnected')}
                            dot="bg-muted-foreground"
                        />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <Card className="border-destructive">
                        <CardContent className="pt-6">
                            <p className="text-sm text-destructive">{error}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Filters + Search */}
                <Card>
                    <CardContent className="pt-6 flex flex-wrap items-center gap-3">
                        <div className="flex gap-1">
                            {(['all', 'connected', 'disconnected'] as FilterStatus[]).map(f => (
                                <Button
                                    key={f}
                                    variant={filter === f ? 'default' : 'outline'}
                                    size="sm"
                                    className="capitalize"
                                    onClick={() => setFilter(f)}
                                >
                                    {f}
                                </Button>
                            ))}
                        </div>
                        <div className="relative flex-1 min-w-[240px]">
                            {searching ? (
                                <RefreshCw className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin pointer-events-none" />
                            ) : (
                                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                            )}
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by user ID, email, or name…"
                                className="pl-8 pr-8"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    title="Clear"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>
                        {searchActive && searchKind !== 'none' && (
                            <Badge variant="outline">
                                matched by {searchKind === 'userId' ? 'user ID' : searchKind}
                            </Badge>
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {searchActive
                                ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'}`
                                : `${filtered.length} of ${summary?.total ?? connections.length} rows loaded`}
                        </span>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card className="overflow-hidden">
                    {loading && connections.length === 0 ? (
                        <div className="p-16 text-center text-sm text-muted-foreground">
                            <RefreshCw className="animate-spin mx-auto mb-3 size-6" />
                            Loading connections…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-16 text-center text-sm text-muted-foreground">
                            No connections found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Health</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>MetaAPI Account ID</TableHead>
                                        <TableHead>Broker</TableHead>
                                        <TableHead>Server</TableHead>
                                        <TableHead>Platform</TableHead>
                                        <TableHead>Region</TableHead>
                                        <TableHead>Last Updated</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((row, i) => {
                                        const clerk = clerkByUser[row.userId];
                                        const clerkPending = clerk === undefined;
                                        const name = clerk ? [clerk.firstName, clerk.lastName].filter(Boolean).join(' ') : '';
                                        return (
                                            <TableRow key={row.userId + i}>
                                                {/* Status */}
                                                <TableCell>
                                                    <span className="inline-flex items-center gap-2 text-sm">
                                                        <span className={`size-1.5 rounded-full ${row.connected ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                                                        <span className={row.connected ? 'text-foreground' : 'text-muted-foreground'}>
                                                            {row.connected ? 'Connected' : 'Disconnected'}
                                                        </span>
                                                    </span>
                                                </TableCell>

                                                {/* Health */}
                                                <TableCell>
                                                    <HealthCell
                                                        accountId={row.accountId}
                                                        state={row.accountId ? healthByAccount[row.accountId] ?? { kind: 'idle' } : { kind: 'idle' }}
                                                        onCheck={() => row.accountId && checkHealth(row.accountId)}
                                                        onOpenDetail={(bundle) => setOpenDetail({ row, bundle })}
                                                    />
                                                </TableCell>

                                                {/* User */}
                                                <TableCell className="min-w-[180px]">
                                                    <div className="text-sm font-medium">
                                                        {clerkPending ? <Skeleton className="h-3 w-24" /> : (name || clerk?.email || row.userId)}
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <span className="text-xs font-mono text-muted-foreground truncate max-w-[160px]">{row.userId}</span>
                                                        <button
                                                            onClick={() => copyToClipboard(row.userId, `uid-${i}`)}
                                                            className="text-muted-foreground hover:text-foreground"
                                                            title="Copy user ID"
                                                        >
                                                            <Copy className="size-3" />
                                                        </button>
                                                    </div>
                                                    {clerk?.instance && (
                                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{clerk.instance}</span>
                                                    )}
                                                </TableCell>

                                                {/* Email */}
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                    {clerkPending ? (
                                                        <Skeleton className="h-3 w-32" />
                                                    ) : (clerk?.email ?? '—')}
                                                </TableCell>

                                                {/* Account ID */}
                                                <TableCell>
                                                    {row.accountId ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-mono truncate max-w-[160px]">{row.accountId}</span>
                                                            <button
                                                                onClick={() => copyToClipboard(row.accountId!, `acc-${i}`)}
                                                                className="text-muted-foreground hover:text-foreground shrink-0"
                                                                title="Copy account ID"
                                                            >
                                                                {copied === `acc-${i}` ? <span className="text-emerald-500 text-xs">✓</span> : <Copy className="size-3" />}
                                                            </button>
                                                            <a
                                                                href={`/metaapi-lookup?accountId=${row.accountId}`}
                                                                className="text-muted-foreground hover:text-foreground shrink-0"
                                                                title="Open in MetaAPI Lookup"
                                                            >
                                                                <ExternalLink className="size-3" />
                                                            </a>
                                                        </div>
                                                    ) : <span className="text-sm text-muted-foreground">—</span>}
                                                </TableCell>

                                                <TableCell className="text-sm whitespace-nowrap">{row.brokerName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                                <TableCell className="text-sm whitespace-nowrap">{row.server ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                                <TableCell className="text-sm whitespace-nowrap">{row.platform ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                                <TableCell className="text-sm whitespace-nowrap">{row.region ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(row.lastUpdated)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </Card>

                {/* Load More — browsing mode only */}
                {!searchActive && pageInfo?.nextContinuationToken && (
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            onClick={() => fetchConnections(pageInfo.nextContinuationToken ?? undefined)}
                            disabled={loadingMore}
                        >
                            {loadingMore && <RefreshCw className="animate-spin" />}
                            {loadingMore ? 'Loading…' : `Load more (${connections.length} of ${summary?.total ?? '?'} loaded)`}
                        </Button>
                    </div>
                )}

            </div>

            {openDetail && (
                <HealthDetailPanel
                    row={openDetail.row}
                    bundle={openDetail.bundle}
                    clerk={clerkByUser[openDetail.row.userId]}
                    onClose={() => setOpenDetail(null)}
                    onRecheck={() => {
                        if (openDetail.row.accountId) checkHealth(openDetail.row.accountId);
                        setOpenDetail(null);
                    }}
                />
            )}
        </div>
    );
}

function HealthCell({
    accountId,
    state,
    onCheck,
    onOpenDetail,
}: {
    accountId: string | null;
    state: HealthCellState;
    onCheck: () => void;
    onOpenDetail: (bundle: HealthBundle) => void;
}) {
    if (!accountId) return <span className="text-xs text-muted-foreground">—</span>;

    if (state.kind === 'idle') {
        return (
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onCheck}>
                <Activity className="size-3" /> Check
            </Button>
        );
    }

    if (state.kind === 'loading') {
        return (
            <Badge variant="outline" className="text-xs">
                <RefreshCw className="animate-spin" /> Checking…
            </Badge>
        );
    }

    if (state.kind === 'error') {
        return (
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs text-destructive border-destructive/40" onClick={onCheck} title={state.message}>
                Failed — retry
            </Button>
        );
    }

    const { bundle } = state;
    return (
        <div className="flex items-center gap-1.5">
            <button
                onClick={() => onOpenDetail(bundle)}
                title={`${bundle.reason} — click for details`}
                className="inline-flex"
            >
                <Badge variant="outline" className="text-xs gap-1.5 hover:bg-accent">
                    <span className={`size-1.5 rounded-full ${HEALTH_DOT[bundle.status]}`} />
                    {bundle.status}
                </Badge>
            </button>
            <button onClick={onCheck} title="Re-check" className="text-muted-foreground hover:text-foreground">
                <RefreshCw className="size-3" />
            </button>
        </div>
    );
}

function SummaryStat({
    label,
    value,
    active = false,
    onClick,
    dot,
}: {
    label: string;
    value: number;
    active?: boolean;
    onClick?: () => void;
    dot?: string;
}) {
    return (
        <Card
            className={`py-3 ${onClick ? 'cursor-pointer hover:bg-accent/30 transition-colors' : ''} ${active ? 'ring-2 ring-ring' : ''}`}
            onClick={onClick}
        >
            <div className="px-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    {dot && <span className={`size-2 rounded-full ${dot}`} />}
                    <span className="text-sm text-muted-foreground">{label}</span>
                </div>
                <span className="text-2xl font-semibold tabular-nums">{value}</span>
            </div>
        </Card>
    );
}

function PanelRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 text-xs py-1">
            <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</span>
            <span className="text-right text-gray-800 dark:text-gray-200">{value ?? '—'}</span>
        </div>
    );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {title}
            </div>
            <div className="px-3 py-2">{children}</div>
        </div>
    );
}

function HealthDetailPanel({
    row,
    bundle,
    clerk,
    onClose,
    onRecheck,
}: {
    row: ConnectionRow;
    bundle: HealthBundle;
    clerk: ClerkUserSummary | null | undefined;
    onClose: () => void;
    onRecheck: () => void;
}) {
    const fmtNum = (v: number | null | undefined, d = 2) =>
        v === null || v === undefined || Number.isNaN(v) ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: d });

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30" onClick={onClose}>
            <div
                className="w-full max-w-md h-full bg-background border-l shadow-xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b flex items-start justify-between gap-3 shrink-0">
                    <div className="min-w-0">
                        <Badge variant="outline" className="text-xs gap-1.5">
                            <span className={`size-1.5 rounded-full ${HEALTH_DOT[bundle.status]}`} />
                            {bundle.status}
                        </Badge>
                        <h2 className="mt-2 text-sm font-semibold truncate">
                            {[clerk?.firstName, clerk?.lastName].filter(Boolean).join(' ') || clerk?.email || row.userId}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{bundle.reason}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={onRecheck} title="Re-check">
                            <RefreshCw className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
                            <X className="size-4" />
                        </Button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    <PanelSection title="Account">
                        <PanelRow label="Account ID" value={<span className="font-mono text-[11px]">{row.accountId}</span>} />
                        <PanelRow label="Checked at" value={new Date(bundle.checkedAt).toLocaleString()} />
                    </PanelSection>

                    {bundle.provisioning && (
                        <PanelSection title="Provisioning (container)">
                            <PanelRow label="State" value={bundle.provisioning.state} />
                            <PanelRow label="Connection status" value={bundle.provisioning.connectionStatus} />
                            <PanelRow label="Region" value={bundle.provisioning.region} />
                            <PanelRow label="Reliability" value={bundle.provisioning.reliability} />
                            <PanelRow label="Resource slots" value={bundle.provisioning.resourceSlots} />
                            {!!bundle.provisioning.copyFactoryResourceSlots && (
                                <PanelRow label="CopyFactory slots" value={bundle.provisioning.copyFactoryResourceSlots} />
                            )}
                            <PanelRow label="Platform" value={bundle.provisioning.platform} />
                            <PanelRow label="Server" value={bundle.provisioning.server} />
                            <PanelRow label="Login" value={bundle.provisioning.login as React.ReactNode} />
                            <PanelRow label="Active connections" value={bundle.provisioning.connections.length} />
                            {bundle.provisioning.connections.length > 0 && (
                                <div className="mt-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                                    {bundle.provisioning.connections.map((c, i) => (
                                        <div key={i} className="text-[11px] text-gray-500 dark:text-gray-400">
                                            {c.region ?? '—'} / {c.zone ?? '—'} {c.application ? `· ${c.application}` : ''}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </PanelSection>
                    )}

                    {bundle.accountInfo && (
                        <PanelSection title="Account info">
                            <PanelRow label="Trade allowed" value={bundle.accountInfo.tradeAllowed === null ? '—' : bundle.accountInfo.tradeAllowed ? '✓ yes' : '✗ no'} />
                            <PanelRow label="Balance" value={fmtNum(bundle.accountInfo.balance)} />
                            <PanelRow label="Equity" value={fmtNum(bundle.accountInfo.equity)} />
                            <PanelRow label="Margin level" value={fmtNum(bundle.accountInfo.marginLevel)} />
                            <PanelRow label="Currency" value={bundle.accountInfo.currency} />
                            <PanelRow label="Leverage" value={bundle.accountInfo.leverage} />
                        </PanelSection>
                    )}

                    {bundle.errors.length > 0 && (
                        <PanelSection title="Errors">
                            {bundle.errors.map((e, i) => (
                                <div key={i} className="text-[11px] text-red-600 dark:text-red-400 py-0.5">{e}</div>
                            ))}
                        </PanelSection>
                    )}
                </div>
            </div>
        </div>
    );
}
