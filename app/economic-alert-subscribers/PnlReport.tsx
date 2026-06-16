'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

interface EquityPoint {
  time: string;
  balance: number;
}
interface TradeLine {
  status: string;
  state: 'OPEN' | 'CLOSED' | 'NOT_PLACED';
  side?: string;
  symbol?: string;
  lots?: number;
  event: string;
  pl?: number;
  positionId?: string;
  exitAt?: string;
  error?: string;
}
interface PnlUser {
  userId: string;
  name?: string;
  email?: string;
  currency: string;
  autoTradeNet: number;
  startBalance: number;
  currentBalance: number;
  currentEquity: number;
  netDeposits: number;
  growthAbs: number;
  growthPct: number | null;
  equityCurve: EquityPoint[];
  brokerOk: boolean;
  trades: TradeLine[];
}
interface PnlReportData {
  ok: boolean;
  generatedAt: string;
  sinceHours: number | null;
  rowCount: number;
  statusCounts: Record<string, number>;
  byEvent: Array<{ event: string; symbol: string; side: string; placed: number; total: number }>;
  users: PnlUser[];
  grandNet: number;
}

const PERIODS = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
];

const money = (n: number, ccy: string) =>
  `${n >= 0 ? '+' : ''}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`;

/** Minimal inline SVG equity curve. */
function Sparkline({ points, up }: { points: EquityPoint[]; up: boolean }) {
  if (points.length < 2) return <span className="text-xs text-gray-400">no curve</span>;
  const w = 160;
  const h = 36;
  const vals = points.map((p) => p.balance);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.balance - min) / span) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const stroke = up ? '#10b981' : '#ef4444';
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export default function PnlReport({ env }: { env: string }) {
  const [hours, setHours] = useState(168);
  const [data, setData] = useState<PnlReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/economic-alert-subscribers/pnl?sinceHours=${hours}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || json.ok === false || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {/* controls */}
      <div className="flex items-center gap-2 mb-4">
        <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.hours}
              onClick={() => setHours(p.hours)}
              className={`px-3 py-1.5 text-sm font-medium ${
                hours === p.hours
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        {data && (
          <span className="ml-auto text-xs text-gray-400">
            {data.rowCount} trade rows · grand net{' '}
            <b className={data.grandNet >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              {money(data.grandNet, '')}
            </b>{' '}
            (mixed ccy)
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Auto-trade P&amp;L and account equity growth over the selected period, from live broker data
        (<b>{env}</b>). Equity growth excludes deposits/withdrawals. Read-only.
      </p>

      {err && (
        <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg mb-4 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      {loading && !data && <div className="text-center text-gray-400 py-10">Loading report…</div>}

      {data && data.users.length === 0 && !loading && (
        <div className="text-center text-gray-400 py-10 border border-gray-200 dark:border-gray-800 rounded-lg">
          No auto-trades in the last {PERIODS.find((p) => p.hours === hours)?.label}.
        </div>
      )}

      <div className="space-y-3">
        {data?.users.map((u) => {
          const label = u.name
            ? `${u.name}${u.email ? ` · ${u.email}` : ''}`
            : u.email || u.userId;
          const grew = (u.growthPct ?? 0) >= 0;
          const isOpen = open[u.userId];
          return (
            <div
              key={u.userId}
              className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setOpen((o) => ({ ...o, [u.userId]: !o[u.userId] }))}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40"
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{label}</div>
                  <div className="text-xs text-gray-400 font-mono truncate">{u.userId}</div>
                </div>

                {/* equity growth */}
                {u.brokerOk ? (
                  <div className="hidden sm:flex flex-col items-end">
                    <div
                      className={`inline-flex items-center gap-1 text-sm font-semibold ${
                        grew ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {grew ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {u.growthPct === null ? 'n/a' : `${grew ? '+' : ''}${u.growthPct.toFixed(2)}%`}
                    </div>
                    <div className="text-xs text-gray-400">
                      {u.startBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} →{' '}
                      {u.currentEquity.toLocaleString('en-US', { maximumFractionDigits: 0 })} {u.currency}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-amber-500">broker n/a</span>
                )}

                <div className="hidden md:block">
                  <Sparkline points={u.equityCurve} up={grew} />
                </div>

                {/* auto-trade net */}
                <div className="text-right shrink-0 w-28">
                  <div
                    className={`text-sm font-bold ${
                      u.autoTradeNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {money(u.autoTradeNet, u.currency)}
                  </div>
                  <div className="text-xs text-gray-400">auto-trade P&amp;L</div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30">
                  {u.netDeposits !== 0 && (
                    <div className="text-xs text-gray-500 mb-2">
                      Net deposits/withdrawals this period: {money(u.netDeposits, u.currency)} (excluded
                      from growth)
                    </div>
                  )}
                  {u.trades.length === 0 ? (
                    <div className="text-xs text-gray-400">No trade rows.</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="text-gray-400 text-left">
                        <tr>
                          <th className="py-1 pr-3 font-medium">State</th>
                          <th className="py-1 pr-3 font-medium">Trade</th>
                          <th className="py-1 pr-3 font-medium">P&amp;L</th>
                          <th className="py-1 pr-3 font-medium">Event</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {u.trades.map((t, i) => (
                          <tr key={i} className="border-t border-gray-100 dark:border-gray-800/60">
                            <td className="py-1 pr-3">
                              <span
                                className={`font-sans font-semibold ${
                                  t.state === 'OPEN'
                                    ? 'text-blue-500'
                                    : t.state === 'CLOSED'
                                      ? 'text-gray-500'
                                      : 'text-amber-500'
                                }`}
                              >
                                {t.state === 'NOT_PLACED' ? t.status.toUpperCase() : t.state}
                              </span>
                            </td>
                            <td className="py-1 pr-3">
                              {(t.side ?? '?').toUpperCase()} {t.symbol ?? '?'} {t.lots ?? '—'}l
                            </td>
                            <td
                              className={`py-1 pr-3 ${
                                t.pl == null
                                  ? 'text-gray-400'
                                  : t.pl >= 0
                                    ? 'text-emerald-600'
                                    : 'text-red-600'
                              }`}
                            >
                              {t.pl == null ? '—' : money(t.pl, '')}
                              {t.error ? (
                                <span className="font-sans text-amber-500"> · {t.error.slice(0, 60)}</span>
                              ) : null}
                            </td>
                            <td className="py-1 pr-3 text-gray-400 font-sans">{t.event}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
