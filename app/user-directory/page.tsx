'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Search, Users, Wifi, ChevronUp, ChevronDown,
  Copy, ExternalLink, AlertTriangle, CheckCircle, MessageSquare,
  TrendingUp, X, Info, Building2, CreditCard, BarChart2
} from 'lucide-react';
import { ChatAnalysisPanel } from '../user-reports/components/ChatAnalysisPanel';
import type { DirectoryUser, DirectorySummary } from '../api/user-directory/route';

// ── helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (v: string | null) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return v; }
};
const fmtPnl = (v: number) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en', { maximumFractionDigits: 0 })}`;
const pnlClass = (v: number) =>
  v > 0 ? 'text-green-600 dark:text-green-400' : v < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400';

type SortKey = keyof DirectoryUser;
type SortDir = 'asc' | 'desc';
type Filters = { search: string; instance: string; plan: string; broker: string; flags: string };

// ── Tooltip ────────────────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info size={12} className="text-gray-400 hover:text-blue-500 cursor-help" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded-lg bg-gray-900 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-relaxed">
        {text}
      </span>
    </span>
  );
}

// ── Flag badges ────────────────────────────────────────────────────────────────
const FLAG_META: Record<string, { label: string; cls: string; tip: string }> = {
  no_db_row:        { label: 'No DB',       cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',        tip: 'User exists in Clerk but has no row in the Postgres users table — never triggered onboarding/Stripe event' },
  no_email:         { label: 'No Email',    cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', tip: 'Clerk account has no email address associated' },
  duplicate_email:  { label: 'Dup Email',   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', tip: 'Same email exists in both Dev and Live Clerk instances — same person signed up twice' },
  missing_db_email: { label: 'DB Email∅',   cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', tip: 'Postgres users row exists but the email column is blank' },
  plan_mismatch:    { label: 'Plan ≠',      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',    tip: 'Clerk publicMetadata.plan and Postgres users.plan_name disagree — billing-source drift' },
};

function FlagBadges({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map(f => {
        const info = FLAG_META[f] ?? { label: f, cls: 'bg-gray-100 text-gray-600', tip: '' };
        return (
          <span key={f} className={`group relative text-[10px] font-semibold px-1.5 py-0.5 rounded cursor-help ${info.cls}`}>
            {info.label}
            {info.tip && (
              <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-56 rounded-lg bg-gray-900 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-relaxed">
                {info.tip}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ── Sub status badge ───────────────────────────────────────────────────────────
const SUB_META: Record<string, { cls: string; tip: string }> = {
  active:      { cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   tip: 'Paying — subscription is live and running' },
  canceled:    { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           tip: 'User cancelled their subscription' },
  past_due:    { cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', tip: 'Payment failed — in grace period, may churn soon' },
  trialing:    { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       tip: 'On a free trial, not yet charged' },
  incomplete:  { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', tip: 'Checkout started but payment not completed' },
};

function SubStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>;
  const meta = SUB_META[status] ?? { cls: 'bg-gray-100 text-gray-600', tip: 'Unknown status from Stripe' };
  return (
    <span className={`group relative text-xs px-2 py-0.5 rounded-full font-medium capitalize cursor-help ${meta.cls}`}>
      {status.replace('_', ' ')}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded-lg bg-gray-900 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-relaxed">
        {meta.tip}
      </span>
    </span>
  );
}

// ── Sortable th ────────────────────────────────────────────────────────────────
function Th({ label, sortKey, tip, current, dir, onSort }: {
  label: string; sortKey: SortKey; tip?: string;
  current: SortKey; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th onClick={() => onSort(sortKey)}
      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-gray-900 dark:hover:text-white select-none">
      <span className="flex items-center gap-1.5">
        {label}
        {tip && <Tooltip text={tip} />}
        {active ? (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
      </span>
    </th>
  );
}

// ── User detail slide panel ────────────────────────────────────────────────────
function UserPanel({ user, onClose }: { user: DirectoryUser; onClose: () => void }) {
  const [showChat, setShowChat] = useState(false);
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.clerkId;

  const copy = (text: string) => navigator.clipboard.writeText(text);

  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
        <Icon size={13} className="text-gray-500" />
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );

  const Row = ({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) => (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 w-28">{label}</span>
      <span className={`text-xs text-right text-gray-800 dark:text-gray-200 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  );

  const winRate = user.strategyTrades > 0 ? Math.round((user.strategyWins / user.strategyTrades) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="relative w-full max-w-lg h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">{displayName}</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email ?? 'No email'}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                ${user.clerkInstance === 'Live'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                {user.clerkInstance}
              </span>
              {user.flags.length > 0 && <FlagBadges flags={user.flags} />}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 flex-shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Identity */}
          <Section icon={Users} title="Identity">
            <Row label="Clerk ID" value={
              <span className="flex items-center gap-1">
                <span className="font-mono">{user.clerkId}</span>
                <button onClick={() => copy(user.clerkId)} className="text-gray-400 hover:text-blue-500"><Copy size={10} /></button>
              </span>
            } />
            <Row label="Joined" value={fmtDate(user.createdAt)} />
            <Row label="Last Sign In" value={fmtDate(user.lastSignInAt)} />
            <Row label="Last Active" value={fmtDate(user.lastActiveAt)} />
          </Section>

          {/* Billing */}
          <Section icon={CreditCard} title="Billing">
            <Row label="Plan (Clerk)" value={
              user.clerkPlan
                ? <span className="font-medium text-emerald-600 dark:text-emerald-400 capitalize">{user.clerkPlan}</span>
                : <span className="italic text-gray-400">—</span>
            } />
            <Row label="Plan (DB)" value={
              user.planName
                ? <span className="font-medium text-emerald-600 dark:text-emerald-400 capitalize">{user.planName}</span>
                : <span className="italic text-gray-400">Free</span>
            } />
            <Row label="Sub Status" value={<SubStatusBadge status={user.subscriptionStatus} />} />
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Clerk publicMetadata</span>
                {user.clerkPublicMetadata && (
                  <button onClick={() => copy(JSON.stringify(user.clerkPublicMetadata, null, 2))}
                    className="text-gray-400 hover:text-blue-500" title="Copy JSON">
                    <Copy size={10} />
                  </button>
                )}
              </div>
              <pre className="text-[10px] font-mono bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded p-2 overflow-x-auto whitespace-pre text-gray-700 dark:text-gray-300 max-h-48">
{user.clerkPublicMetadata ? JSON.stringify(user.clerkPublicMetadata, null, 2) : '(empty)'}
              </pre>
            </div>
            <Row label="Broker Paid" value={
              <span className={user.hasPaidForBroker ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
                {user.hasPaidForBroker ? 'Yes' : 'No'}
              </span>
            } />
            {user.stripeCustomerId && (
              <Row label="Stripe Customer" value={
                <span className="flex items-center gap-1">
                  <span className="font-mono text-[10px]">{user.stripeCustomerId}</span>
                  <button onClick={() => copy(user.stripeCustomerId!)} className="text-gray-400 hover:text-blue-500"><Copy size={10} /></button>
                </span>
              } />
            )}
          </Section>

          {/* Broker */}
          <Section icon={Building2} title="Broker / MetaAPI">
            <Row label="Status" value={
              user.brokerConnected
                ? <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Connected</span>
                : <span className="text-gray-400">Not connected</span>
            } />
            {user.metaApiAccountId && (
              <Row label="Account ID" value={
                <span className="flex items-center gap-1">
                  <span className="font-mono text-[10px]">{user.metaApiAccountId}</span>
                  <button onClick={() => copy(user.metaApiAccountId!)} className="text-gray-400 hover:text-blue-500"><Copy size={10} /></button>
                  <a href={`/metaapi-lookup?accountId=${user.metaApiAccountId}`} className="text-gray-400 hover:text-blue-500"><ExternalLink size={10} /></a>
                </span>
              } />
            )}
            <Row label="Last Updated" value={fmtDate(user.brokerLastUpdated)} />
          </Section>

          {/* Chat */}
          <Section icon={MessageSquare} title="Chat Activity">
            <Row label="Threads" value={
              <span className={user.chatThreadCount > 0 ? 'font-semibold text-sky-600 dark:text-sky-400' : 'text-gray-400'}>
                {user.chatThreadCount > 0 ? user.chatThreadCount : 'None'}
              </span>
            } />
            <Row label="Last Chat" value={fmtDate(user.chatLastDate)} />
            {user.chatThreadCount > 0 && (
              <div className="pt-1">
                <button onClick={() => setShowChat(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-lg transition-colors border border-blue-100 dark:border-blue-800">
                  <MessageSquare size={13} />
                  Run AI Chat Analysis
                </button>
              </div>
            )}
          </Section>

          {/* Strategy + Journal */}
          <Section icon={BarChart2} title="Strategy & Journal">
            {user.strategyTotal === 0 ? (
              <p className="text-xs text-gray-400 italic">No strategies deployed yet</p>
            ) : (
              <>
                <Row label="Total Deployed" value={<span className="font-semibold text-indigo-600 dark:text-indigo-400">{user.strategyTotal}</span>} />
                <Row label="Active Now" value={
                  <span className={user.strategyActive > 0 ? 'font-semibold text-green-600 dark:text-green-400' : 'text-gray-400'}>
                    {user.strategyActive}
                  </span>
                } />
                <Row label="Total Trades" value={user.strategyTrades.toLocaleString()} />
                <Row label="Wins / Losses" value={
                  <span>
                    <span className="text-green-600 dark:text-green-400">{user.strategyWins}</span>
                    {' / '}
                    <span className="text-red-500 dark:text-red-400">{user.strategyLosses}</span>
                  </span>
                } />
                {winRate !== null && (
                  <Row label="Win Rate" value={
                    <span className={winRate >= 55 ? 'text-green-600 dark:text-green-400 font-semibold' : winRate >= 45 ? 'text-yellow-600' : 'text-red-500 font-semibold'}>
                      {winRate}%
                    </span>
                  } />
                )}
                <Row label="Net P&L" value={
                  <span className={`font-semibold ${pnlClass(user.strategyPnl)}`}>{fmtPnl(user.strategyPnl)}</span>
                } />
              </>
            )}
          </Section>
        </div>
      </div>

      {/* Chat Analysis sub-panel */}
      {showChat && (
        <ChatAnalysisPanel
          userId={user.clerkId}
          userName={displayName}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}

// ── Summary cards ──────────────────────────────────────────────────────────────
function SummaryCards({ s, filter, setFilter }: { s: DirectorySummary; filter: Filters; setFilter: (f: Filters) => void }) {
  const cards = [
    { label: 'Total',          value: s.total,          color: 'blue',    key: null,         val: '' },
    { label: 'Live',           value: s.live,            color: 'green',   key: 'instance',   val: 'Live' },
    { label: 'Dev',            value: s.dev,             color: 'purple',  key: 'instance',   val: 'Dev' },
    { label: 'Plan (Clerk)',   value: s.withClerkPlan,   color: 'emerald', key: 'plan',       val: 'paid' },
    { label: 'Plan (DB)',      value: s.withPlan,        color: 'emerald', key: 'plan',       val: 'paid' },
    { label: 'Plan ≠ DB',      value: s.planMismatch,    color: 'amber',   key: 'flags',      val: 'plan_mismatch' },
    { label: 'Broker On',      value: s.brokerConnected, color: 'teal',    key: 'broker',     val: 'connected' },
    { label: 'Has Strategies', value: s.withStrategies,  color: 'indigo',  key: null,         val: '' },
    { label: 'Has Chats',      value: s.withChats,       color: 'sky',     key: null,         val: '' },
    { label: 'No DB Row ⚠',   value: s.missingDbRow,    color: 'red',     key: 'flags',      val: 'no_db_row' },
  ];
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    sky: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  };
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-10 gap-3">
      {cards.map(c => {
        const isActive = c.key && (filter as any)[c.key] === c.val;
        return (
          <div key={c.label}
            onClick={() => { if (c.key) setFilter({ ...filter, [c.key]: isActive ? '' : c.val }); }}
            className={`bg-white dark:bg-gray-800 rounded-xl shadow p-3 flex flex-col gap-1
              ${c.key ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all' : ''}
              ${isActive ? 'ring-2 ring-blue-500' : ''}`}>
            <div className={`self-start p-1.5 rounded-md text-sm ${colorMap[c.color]}`}>
              <TrendingUp size={13} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{c.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">{c.label}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function UserDirectoryPage() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [summary, setSummary] = useState<DirectorySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('lastActiveAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filters, setFilters] = useState<Filters>({ search: '', instance: '', plan: '', broker: '', flags: '' });
  const [selected, setSelected] = useState<DirectoryUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/user-directory');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setUsers(data.users ?? []);
      setSummary(data.summary ?? null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(() => setCopied(null), 1500);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let r = users;
    if (filters.instance) r = r.filter(u => u.clerkInstance === filters.instance);
    if (filters.plan === 'paid') r = r.filter(u => !!u.clerkPlan || !!u.planName);
    if (filters.plan === 'free') r = r.filter(u => !u.clerkPlan && !u.planName);
    if (filters.broker === 'connected') r = r.filter(u => u.brokerConnected);
    if (filters.broker === 'disconnected') r = r.filter(u => !u.brokerConnected);
    if (filters.flags) r = r.filter(u => u.flags.includes(filters.flags));
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      r = r.filter(u =>
        u.email?.toLowerCase().includes(q) || u.clerkId.toLowerCase().includes(q) ||
        u.firstName?.toLowerCase().includes(q) || u.lastName?.toLowerCase().includes(q) ||
        u.clerkPlan?.toLowerCase().includes(q) ||
        u.planName?.toLowerCase().includes(q) || u.metaApiAccountId?.toLowerCase().includes(q)
      );
    }
    return [...r].sort((a, b) => {
      const av = (a as any)[sortKey] ?? ''; const bv = (b as any)[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      if (typeof av === 'boolean') return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [users, filters, sortKey, sortDir]);

  const thProps = { current: sortKey, dir: sortDir, onSort: handleSort };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6 pt-16 md:pt-6">
      <div className="max-w-[1600px] mx-auto space-y-5">

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Directory</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Unified view — Identity · Billing · Broker · Chat · Strategy · Journal</p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {summary && <SummaryCards s={summary} filter={filters} setFilter={setFilters} />}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
            Error: {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Search email, name, clerk ID, account ID…"
              className="w-full text-sm border-none outline-none bg-transparent dark:text-white placeholder:text-gray-400" />
          </div>
          {(['instance','plan','broker','flags'] as const).map(key => (
            <select key={key} value={(filters as any)[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
              className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white">
              {key === 'instance' && <><option value="">All instances</option><option value="Live">Live</option><option value="Dev">Dev</option></>}
              {key === 'plan' && <><option value="">All plans</option><option value="paid">Paid</option><option value="free">Free</option></>}
              {key === 'broker' && <><option value="">All broker</option><option value="connected">Connected</option><option value="disconnected">Not connected</option></>}
              {key === 'flags' && <><option value="">All flags</option><option value="no_db_row">No DB Row</option><option value="no_email">No Email</option><option value="duplicate_email">Duplicate Email</option><option value="plan_mismatch">Plan Mismatch</option></>}
            </select>
          ))}
          <button onClick={() => setFilters({ search: '', instance: '', plan: '', broker: '', flags: '' })}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline whitespace-nowrap">Clear</button>
          <span className="ml-auto text-xs text-gray-500 whitespace-nowrap">{filtered.length} / {users.length} users</span>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          {loading && !users.length ? (
            <div className="p-16 text-center text-gray-500">
              <RefreshCw size={28} className="animate-spin mx-auto mb-3 opacity-40" />
              <p className="text-sm">Loading all users — fetching Clerk, Postgres, Azure…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/60 sticky top-0 z-10">
                  <tr>
                    <Th label="User" sortKey="email" {...thProps} />
                    <Th label="Instance" sortKey="clerkInstance" {...thProps} />
                    <Th label="Plan (Clerk)" sortKey="clerkPlan" tip="Source of truth — publicMetadata.plan from Clerk" {...thProps} />
                    <Th label="Plan (DB)" sortKey="planName" tip="Fallback — users.plan_name from Postgres" {...thProps} />
                    <Th label="Sub Status" sortKey="subscriptionStatus" tip="Stripe subscription status — hover each badge for meaning" {...thProps} />
                    <Th label="Broker" sortKey="brokerConnected" {...thProps} />
                    <Th label="MetaAPI ID" sortKey="metaApiAccountId" {...thProps} />
                    <Th label="Chats" sortKey="chatThreadCount" tip="Number of chat threads in Azure Table Storage" {...thProps} />
                    <Th label="Strats" sortKey="strategyTotal" tip="Total strategy deployments from Postgres strategy_deployments" {...thProps} />
                    <Th label="Active" sortKey="strategyActive" tip="Currently active strategy deployments" {...thProps} />
                    <Th label="Trades" sortKey="strategyTrades" tip="Total trades across all strategies (journal data)" {...thProps} />
                    <Th label="P&L" sortKey="strategyPnl" tip="Net profit/loss across all strategy deployments" {...thProps} />
                    <Th label="Joined" sortKey="createdAt" {...thProps} />
                    <Th label="Last Active" sortKey="lastActiveAt" {...thProps} />
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1">Flags <Tooltip text="Issues detected: No DB row, missing email, duplicate accounts across Dev/Live" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={15} className="text-center py-12 text-gray-400 text-sm">No users found.</td></tr>
                  ) : filtered.map(u => (
                    <tr key={u.clerkId}
                      onClick={() => setSelected(u)}
                      className="hover:bg-blue-50/50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">

                      {/* User */}
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-gray-900 dark:text-white text-sm max-w-[180px] truncate">
                          {[u.firstName, u.lastName].filter(Boolean).join(' ') || <span className="text-gray-400 italic text-xs">No name</span>}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[160px] mt-0.5">{u.email ?? <span className="text-red-400 italic">no email</span>}</div>
                      </td>

                      {/* Instance */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                          ${u.clerkInstance === 'Live' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                          {u.clerkInstance}
                        </span>
                      </td>

                      {/* Plan (Clerk) */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {u.clerkPlan ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 capitalize">{u.clerkPlan}</span>
                          : <span className="text-xs text-gray-400 italic">—</span>}
                      </td>

                      {/* Plan (DB) */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {u.planName ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 capitalize">{u.planName}</span>
                          : <span className="text-xs text-gray-400 italic">Free</span>}
                      </td>

                      {/* Sub Status */}
                      <td className="px-3 py-2.5 whitespace-nowrap"><SubStatusBadge status={u.subscriptionStatus} /></td>

                      {/* Broker */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {u.brokerConnected
                          ? <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />On</span>
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>

                      {/* MetaAPI ID */}
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        {u.metaApiAccountId ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 truncate max-w-[120px]">{u.metaApiAccountId}</span>
                            <button onClick={() => copy(u.metaApiAccountId!, `acc-${u.clerkId}`)} className="text-gray-300 hover:text-blue-500">
                              {copied === `acc-${u.clerkId}` ? <span className="text-green-500 text-[10px]">✓</span> : <Copy size={10} />}
                            </button>
                            <a href={`/metaapi-lookup?accountId=${u.metaApiAccountId}`} className="text-gray-300 hover:text-blue-500"><ExternalLink size={10} /></a>
                          </div>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>

                      {/* Chats */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {u.chatThreadCount > 0 ? <span className="text-sm font-medium text-sky-600 dark:text-sky-400">{u.chatThreadCount}</span> : <span className="text-gray-400 text-xs">—</span>}
                      </td>

                      {/* Strats / Active / Trades / PnL */}
                      <td className="px-3 py-2.5 text-center">{u.strategyTotal > 0 ? <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{u.strategyTotal}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                      <td className="px-3 py-2.5 text-center">{u.strategyActive > 0 ? <span className="text-sm font-medium text-green-600 dark:text-green-400">{u.strategyActive}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                      <td className="px-3 py-2.5 text-center">{u.strategyTrades > 0 ? <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{u.strategyTrades.toLocaleString()}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                      <td className="px-3 py-2.5 text-right">{u.strategyTrades > 0 ? <span className={`text-sm font-semibold ${pnlClass(u.strategyPnl)}`}>{fmtPnl(u.strategyPnl)}</span> : <span className="text-gray-400 text-xs">—</span>}</td>

                      {/* Dates */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500">{fmtDate(u.createdAt)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500">{fmtDate(u.lastActiveAt)}</td>

                      {/* Flags */}
                      <td className="px-3 py-2.5"><FlagBadges flags={u.flags} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slide panel */}
      {selected && <UserPanel user={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
