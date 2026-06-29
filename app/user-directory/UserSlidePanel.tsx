'use client';

import { X, Wifi, WifiOff, TrendingUp, MessageSquare, Copy, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import type { DirectoryUser } from '../api/user-directory/route';
import { useState, useEffect } from 'react';

// ── helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (v: string | null) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return v; }
};
const fmtPnl = (v: number) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en', { maximumFractionDigits: 2 })}`;
const pnlCls = (v: number) => v > 0 ? 'text-green-600' : v < 0 ? 'text-red-500' : 'text-gray-400';

function TagChip({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0">{label}</span>
      <span className={`text-xs text-right text-gray-900 dark:text-white break-all ${mono ? 'font-mono' : 'font-medium'}`}>{value ?? '—'}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{title}</p>
      <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-1">{children}</div>
    </div>
  );
}

// ── Chat Analysis inline ───────────────────────────────────────────────────────
const ENGAGEMENT_CLS: Record<string, string> = {
  power: 'bg-purple-100 text-purple-700', moderate: 'bg-blue-100 text-blue-700',
  minimal: 'bg-gray-100 text-gray-600', 'one-shot': 'bg-yellow-50 text-yellow-700',
};
const CHURN_CLS: Record<string, string> = {
  low: 'bg-green-50 text-green-700', medium: 'bg-yellow-50 text-yellow-700', high: 'bg-red-100 text-red-700',
};
const SENTIMENT_CLS: Record<string, string> = {
  positive: 'bg-green-50 text-green-700', neutral: 'bg-gray-100 text-gray-600',
  frustrated: 'bg-red-100 text-red-700', confused: 'bg-yellow-50 text-yellow-700',
};
const BROKER_CLS: Record<string, string> = {
  'not-started': 'bg-gray-100 text-gray-500', exploring: 'bg-blue-50 text-blue-600',
  ready: 'bg-orange-50 text-orange-700', connected: 'bg-green-100 text-green-700',
};

function ChatAnalysisSection({ userId }: { userId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/user-reports/chat-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.error === 'no-chats') setError('No chat history.');
        else if (d.error) setError(d.message || 'Analysis failed.');
        else setData(d);
      })
      .catch(() => { if (!cancelled) setError('Failed to fetch.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) return (
    <div className="flex items-center gap-2 text-gray-400 text-xs py-3">
      <Loader2 size={13} className="animate-spin" /> Analysing chat history with AI…
    </div>
  );
  if (error) return <p className="text-xs text-gray-400 italic py-2">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-3">
      {data.summary && (
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5">
          {data.summary}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {data.engagementPattern && <div><span className="text-[10px] text-gray-400 block mb-0.5">Engagement</span><TagChip label={data.engagementPattern} cls={ENGAGEMENT_CLS[data.engagementPattern] ?? 'bg-gray-100 text-gray-600'} /></div>}
        {data.sentimentSignal && <div><span className="text-[10px] text-gray-400 block mb-0.5">Sentiment</span><TagChip label={data.sentimentSignal} cls={SENTIMENT_CLS[data.sentimentSignal] ?? 'bg-gray-100 text-gray-600'} /></div>}
        {data.churnRisk && <div><span className="text-[10px] text-gray-400 block mb-0.5">Churn Risk</span><TagChip label={data.churnRisk} cls={CHURN_CLS[data.churnRisk] ?? 'bg-gray-100 text-gray-600'} /></div>}
        {data.brokerReadiness && <div><span className="text-[10px] text-gray-400 block mb-0.5">Broker Readiness</span><TagChip label={data.brokerReadiness} cls={BROKER_CLS[data.brokerReadiness] ?? 'bg-gray-100 text-gray-600'} /></div>}
      </div>
      {data.topicCategories && (
        <div className="space-y-1">
          {(Object.entries(data.topicCategories) as [string, number][])
            .filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                  <span className="capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span>{v}%</span>
                </div>
                <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
        </div>
      )}
      {data.agentsUsed?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.agentsUsed.map((a: string) => <TagChip key={a} label={a} cls="bg-indigo-50 text-indigo-700" />)}
        </div>
      )}
      {data.tradingInterests?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.tradingInterests.map((t: string) => <TagChip key={t} label={t} cls="bg-green-50 text-green-700" />)}
        </div>
      )}
      {data.painPoints?.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-400 mb-1">Pain Points</p>
          <div className="flex flex-wrap gap-1">{data.painPoints.map((p: string) => <TagChip key={p} label={p} cls="bg-red-50 text-red-700" />)}</div>
        </div>
      )}
    </div>
  );
}

// ── Flag & SubStatus legend ────────────────────────────────────────────────────
const FLAG_LEGEND: Record<string, { label: string; desc: string; cls: string }> = {
  no_db_row:        { label: 'No DB',      desc: 'Exists in Clerk but no row in Postgres — never triggered billing/onboarding', cls: 'bg-red-100 text-red-700' },
  no_email:         { label: 'No Email',   desc: 'Clerk user has no email address at all', cls: 'bg-orange-100 text-orange-700' },
  duplicate_email:  { label: 'Dup Email',  desc: 'Same email in both Dev and Live Clerk — signed up twice', cls: 'bg-yellow-100 text-yellow-700' },
  missing_db_email: { label: 'DB Email∅', desc: 'Has a Postgres row but email column is blank', cls: 'bg-orange-100 text-orange-700' },
};

const SUB_STATUS_LEGEND: Record<string, { desc: string; cls: string }> = {
  active:   { desc: 'Paying — subscription running', cls: 'bg-green-100 text-green-700' },
  canceled: { desc: 'Cancelled their subscription', cls: 'bg-red-100 text-red-700' },
  past_due: { desc: 'Payment failed — in grace period', cls: 'bg-yellow-100 text-yellow-700' },
  trialing: { desc: 'On free trial', cls: 'bg-blue-100 text-blue-700' },
};

// ── Main exported panel ────────────────────────────────────────────────────────
interface Props { user: DirectoryUser; onClose: () => void; }

export function UserSlidePanel({ user, onClose }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.clerkId;
  const winRate = user.strategyTrades > 0 ? ((user.strategyWins / user.strategyTrades) * 100).toFixed(1) : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg z-50 bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 dark:text-white truncate">{displayName}</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email ?? 'No email'}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                ${user.clerkInstance === 'Live' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                {user.clerkInstance}
              </span>
              {user.flags.map(f => {
                const info = FLAG_LEGEND[f];
                return info ? (
                  <span key={f} title={info.desc}
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded cursor-help ${info.cls}`}>
                    {info.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>
          <button onClick={onClose}
            className="ml-3 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Identity */}
          <Section title="Identity">
            <KV label="Clerk ID" value={
              <span className="flex items-center gap-1 justify-end">
                <span className="font-mono text-[10px]">{user.clerkId}</span>
                <button onClick={() => copy(user.clerkId, 'clerkId')} className="text-gray-300 hover:text-blue-500">
                  {copied === 'clerkId' ? <span className="text-green-500 text-[10px]">✓</span> : <Copy size={10} />}
                </button>
              </span>
            } />
            <KV label="Email" value={user.email} />
            <KV label="Name" value={displayName} />
            <KV label="Instance" value={user.clerkInstance} />
            <KV label="Joined" value={fmtDate(user.createdAt)} />
            <KV label="Last Sign In" value={fmtDate(user.lastSignInAt)} />
            <KV label="Last Active" value={fmtDate(user.lastActiveAt)} />
          </Section>

          {/* Billing */}
          <Section title="Billing & Plan">
            {!user.hasDbRow ? (
              <p className="text-xs text-red-500 py-2 italic">No Postgres row — plan data unavailable</p>
            ) : (
              <>
                <KV label="Plan" value={user.planName
                  ? <span className="text-emerald-600 capitalize">{user.planName}</span>
                  : <span className="text-gray-400 italic">Free</span>} />
                <KV label="Sub Status" value={user.subscriptionStatus ? (
                  <span title={SUB_STATUS_LEGEND[user.subscriptionStatus]?.desc ?? ''}
                    className={`px-2 py-0.5 rounded-full text-xs cursor-help
                      ${SUB_STATUS_LEGEND[user.subscriptionStatus]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                    {user.subscriptionStatus}
                  </span>
                ) : <span className="text-gray-400 italic">None</span>} />
                <KV label="Broker Paid" value={user.hasPaidForBroker
                  ? <span className="text-green-600">Yes</span>
                  : <span className="text-gray-400">No</span>} />
                {user.stripeCustomerId && (
                  <KV label="Stripe Customer" value={
                    <span className="flex items-center gap-1 justify-end">
                      <span className="font-mono text-[10px]">{user.stripeCustomerId}</span>
                      <button onClick={() => copy(user.stripeCustomerId!, 'stripe')}
                        className="text-gray-300 hover:text-blue-500">
                        {copied === 'stripe' ? <span className="text-green-500 text-[10px]">✓</span> : <Copy size={10} />}
                      </button>
                    </span>
                  } />
                )}
              </>
            )}
          </Section>

          {/* Broker */}
          <Section title="Broker / MetaAPI">
            <KV label="Status" value={user.brokerConnected
              ? <span className="flex items-center gap-1 text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Connected
                </span>
              : <span className="text-gray-400">Not connected</span>} />
            {user.metaApiAccountId && (
              <KV label="MetaAPI Account ID" value={
                <span className="flex items-center gap-1 justify-end">
                  <span className="font-mono text-[10px]">{user.metaApiAccountId}</span>
                  <button onClick={() => copy(user.metaApiAccountId!, 'accId')}
                    className="text-gray-300 hover:text-blue-500">
                    {copied === 'accId' ? <span className="text-green-500 text-[10px]">✓</span> : <Copy size={10} />}
                  </button>
                  <a href={`/metaapi-lookup?accountId=${user.metaApiAccountId}`}
                    className="text-gray-300 hover:text-blue-500" title="Open in MetaAPI Lookup">
                    <ExternalLink size={10} />
                  </a>
                </span>
              } />
            )}
            <KV label="Last Updated" value={fmtDate(user.brokerLastUpdated)} />
          </Section>

          {/* Strategy & Journal */}
          <Section title="Strategy & Journal">
            {user.strategyTotal === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">No strategies deployed</p>
            ) : (
              <>
                <KV label="Total Deployed" value={user.strategyTotal} />
                <KV label="Active Now" value={
                  <span className={user.strategyActive > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                    {user.strategyActive}
                  </span>} />
                <KV label="Total Trades" value={user.strategyTrades.toLocaleString()} />
                <KV label="Wins / Losses" value={`${user.strategyWins} / ${user.strategyLosses}`} />
                {winRate && (
                  <KV label="Win Rate" value={
                    <span className={Number(winRate) >= 55 ? 'text-green-600' : Number(winRate) < 45 ? 'text-red-500' : 'text-yellow-600'}>
                      {winRate}%
                    </span>} />
                )}
                {user.strategyTrades > 0 && (
                  <KV label="Net P&L" value={
                    <span className={pnlCls(user.strategyPnl)}>{fmtPnl(user.strategyPnl)}</span>} />
                )}
              </>
            )}
          </Section>

          {/* Chat */}
          <Section title="Chat">
            <KV label="Total Threads" value={user.chatThreadCount > 0
              ? <span className="text-sky-600 font-semibold">{user.chatThreadCount}</span>
              : <span className="text-gray-400">0</span>} />
            <KV label="Last Chat" value={fmtDate(user.chatLastDate)} />
          </Section>

          {/* Chat AI Analysis — lazy loaded */}
          {user.chatThreadCount > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Chat AI Analysis</p>
                {!showChat && (
                  <button onClick={() => setShowChat(true)}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                    Load analysis →
                  </button>
                )}
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-3">
                {showChat
                  ? <ChatAnalysisSection userId={user.clerkId} />
                  : <p className="text-xs text-gray-400 italic">
                      Click "Load analysis" to run AI analysis on this user's chat history.
                    </p>}
              </div>
            </div>
          )}

          {/* Flag details */}
          {user.flags.length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Flag Details</p>
              <div className="space-y-2">
                {user.flags.map(f => {
                  const info = FLAG_LEGEND[f];
                  return info ? (
                    <div key={f} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${info.cls}`}>
                      <span className="font-semibold flex-shrink-0">{info.label}:</span>
                      <span className="opacity-80">{info.desc}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
