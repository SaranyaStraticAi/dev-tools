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
