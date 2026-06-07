'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Trash2, CheckCircle, AlertTriangle, Bell, Mail } from 'lucide-react';

interface Subscriber {
  userId: string;
  email?: string;
  chatId?: string | null;
  linked?: boolean;
  active?: boolean;
  addedAt?: string;
  addedBy?: string;
}

// Environment is implicit: dev-tools in dev → dev data, in prod → prod data.
const ENV = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

const fmtDate = (v?: string) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return v;
  }
};

export default function EconomicAlertSubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/economic-alert-subscribers', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setSubscribers(json.subscribers || []);
    } catch (e) {
      setMsg({ kind: 'err', text: `Load failed: ${e instanceof Error ? e.message : String(e)}` });
      setSubscribers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!e) return;
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch('/api/economic-alert-subscribers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: e, addedBy: 'dev-tools' }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg({
        kind: 'ok',
        text: json.linked
          ? `Added ${e} — Telegram linked (chatId ${json.chatId}). They'll receive alerts.`
          : `Added ${e} — pending: ${json.warning || 'user has not linked Telegram yet'}.`,
      });
      setEmail('');
      await load();
    } catch (err) {
      setMsg({ kind: 'err', text: `Add failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setAdding(false);
    }
  };

  const remove = async (sub: Subscriber) => {
    if (!confirm(`Remove ${sub.email || sub.userId} from the allowlist?`)) return;
    setMsg(null);
    try {
      const res = await fetch('/api/economic-alert-subscribers', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: sub.userId }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg({ kind: 'ok', text: `Removed ${sub.email || sub.userId}.` });
      await load();
    } catch (err) {
      setMsg({ kind: 'err', text: `Remove failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Bell className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold">Economic-Alert Beta Subscribers</h1>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${
            ENV === 'prod'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          }`}
        >
          {ENV.toUpperCase()}
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Allowlist for the <code>economic-alert-trade-plan</code> agent (untested — beta). Add a user by
        email; resolution to their Telegram chat happens in vibetrader-web. You are viewing{' '}
        <b>{ENV}</b> data.
      </p>

      {/* add form + refresh */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="user@example.com"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <button
          onClick={add}
          disabled={adding || !email.trim()}
          className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> {adding ? 'Adding…' : 'Add'}
        </button>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg mb-4 ${
            msg.kind === 'ok'
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {msg.kind === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* table */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-left text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Telegram</th>
              <th className="px-4 py-2 font-medium">Chat ID</th>
              <th className="px-4 py-2 font-medium">Added</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {loading ? 'Loading…' : 'No subscribers on this allowlist yet.'}
                </td>
              </tr>
            )}
            {subscribers.map((s) => (
              <tr key={s.userId} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-4 py-2">
                  <div className="font-medium">{s.email || '—'}</div>
                  <div className="text-xs text-gray-400 font-mono">{s.userId}</div>
                </td>
                <td className="px-4 py-2">
                  {s.linked ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="w-3 h-3" /> Linked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" /> Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{s.chatId || '—'}</td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {fmtDate(s.addedAt)}
                  {s.addedBy ? <div className="text-gray-400">by {s.addedBy}</div> : null}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => remove(s)}
                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        {subscribers.length} subscriber{subscribers.length === 1 ? '' : 's'} on the <b>{ENV}</b>{' '}
        allowlist. The admin reviewer (TELEGRAM_ADMIN_CHAT_ID) always receives alerts in addition to
        this list.
      </p>
    </div>
  );
}
