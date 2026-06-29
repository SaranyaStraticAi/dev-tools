'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Copy, ExternalLink, CheckCircle, Download, Search, Sparkles } from 'lucide-react';
import { downloadCSV } from '../lib/csv';
import { ChatAnalysisPanel } from './ChatAnalysisPanel';
import type { UserRow, BehavioralBucket, FunnelStage } from '../types';

interface Props {
  rows: UserRow[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const TABS: Array<{ key: string; label: string; bucket?: BehavioralBucket }> = [
  { key: '⭐ Hot Leads',           label: 'Hot Leads',          bucket: '⭐ Hot Leads' },
  { key: '🎯 Warm Unsurveyed',     label: 'Warm Unsurveyed',    bucket: '🎯 Warm Unsurveyed' },
  { key: '💤 Dormant with Signal', label: 'Dormant w/ Signal',  bucket: '💤 Dormant with Signal' },
  { key: '📋 Needs Qualification', label: 'Needs Qualification',bucket: '📋 Needs Qualification' },
  { key: 'all',                    label: 'All (excl. brokers)', bucket: undefined },
];

const FUNNEL_COLORS: Record<FunnelStage, string> = {
  'signed-up':        'bg-gray-100 text-gray-600',
  onboarded:          'bg-blue-50 text-blue-600',
  surveyed:           'bg-indigo-50 text-indigo-600',
  exploring:          'bg-teal-50 text-teal-600',
  'broker-connected': 'bg-purple-100 text-purple-700',
  trading:            'bg-green-100 text-green-700',
};

const FUNNEL_LABELS: Record<FunnelStage, string> = {
  'signed-up':        'Signed Up',
  onboarded:          'Onboarded',
  surveyed:           'Surveyed',
  exploring:          'Exploring',
  'broker-connected': 'Broker',
  trading:            'Trading',
};

const ACTION_COLORS: Record<string, string> = {
  'Upsell / referral ask':                    'bg-purple-100 text-purple-700',
  'Send first trade guide':                   'bg-blue-100 text-blue-700',
  'Re-engage — broker connected but dormant': 'bg-orange-100 text-orange-700',
  'Send activation email':                    'bg-gray-100 text-gray-600',
  'Schedule broker setup call':               'bg-green-100 text-green-700',
  'Re-engagement campaign':                   'bg-yellow-100 text-yellow-700',
  'Request survey completion':                'bg-teal-100 text-teal-700',
  'Nurture — keep warm':                      'bg-gray-100 text-gray-500',
};

function relativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function priorityColor(score: number) {
  if (score >= 70) return 'text-red-600 font-bold';
  if (score >= 40) return 'text-yellow-600 font-semibold';
  return 'text-green-600';
}

function surveyOneLiner(row: UserRow): string {
  const parts: string[] = [];
  if (row.experienceLevel) parts.push(row.experienceLevel);
  if (row.tradesPerWeek) parts.push(row.tradesPerWeek);
  if (row.priority) parts.push(`goal: ${row.priority}`);
  if (row.barrier) parts.push(`barrier: ${row.barrier}`);
  return parts.join(' · ') || '—';
}

export function OutreachQueue({ rows, activeTab: externalTab, onTabChange }: Props) {
  const [internalTab, setInternalTab] = React.useState(TABS[0].key);
  const activeTab = externalTab ?? internalTab;
  const setTab = (t: string) => {
    setInternalTab(t);
    onTabChange?.(t);
  };

  const [contacted, setContacted] = React.useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('vt-outreach-contacted');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  const [search, setSearch] = React.useState('');
  const [activePanel, setActivePanel] = React.useState<{ userId: string; userName: string } | null>(null);

  const toggleContacted = (clerkId: string) => {
    setContacted((prev) => {
      const next = new Set(prev);
      if (next.has(clerkId)) next.delete(clerkId);
      else next.add(clerkId);
      try { localStorage.setItem('vt-outreach-contacted', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email).catch(() => {});
  };

  // Filter: exclude broker-connected from all tabs except 'All'
  const queueRows = React.useMemo(() => {
    const tab = TABS.find((t) => t.key === activeTab);
    let filtered = rows.filter((r) => r.brokerConnected !== 'true');
    if (tab?.bucket) filtered = filtered.filter((r) => r.behavioralBucket === tab.bucket);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) => r.email.toLowerCase().includes(q) ||
               `${r.firstName} ${r.lastName}`.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => b.outreachPriority - a.outreachPriority);
  }, [rows, activeTab, search]);

  const tabCounts = React.useMemo(() => {
    const excl = rows.filter((r) => r.brokerConnected !== 'true');
    return Object.fromEntries(
      TABS.map((t) => [
        t.key,
        t.bucket ? excl.filter((r) => r.behavioralBucket === t.bucket).length : excl.length,
      ])
    );
  }, [rows]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Outreach Queue</h3>
          <p className="text-xs text-gray-400 mt-0.5">Sorted by priority · Broker-connected users excluded</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email..."
              className="h-7 pl-7 text-xs w-48"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => downloadCSV(queueRows, `outreach-queue-${activeTab.replace(/[^a-z]/gi, '-')}.csv`)}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-100 dark:border-gray-700 px-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full px-1.5 py-0.5">
              {tabCounts[tab.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 uppercase text-[10px] tracking-wide">
              <th className="px-4 py-2 text-left w-12">Priority</th>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left">Stage</th>
              <th className="px-4 py-2 text-left">Score</th>
              <th className="px-4 py-2 text-left">Survey Summary</th>
              <th className="px-4 py-2 text-left">Chats</th>
              <th className="px-4 py-2 text-left">Next Action</th>
              <th className="px-4 py-2 text-right">Inactive</th>
              <th className="px-4 py-2 text-center w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {queueRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                  No users in this queue.
                </td>
              </tr>
            ) : (
              queueRows.slice(0, 200).map((row) => {
                const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Anonymous';
                const initials = name !== 'Anonymous'
                  ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                  : row.email.substring(0, 2).toUpperCase();
                const isContacted = contacted.has(row.clerkId);
                const actionColor = ACTION_COLORS[row.nextBestAction] ?? 'bg-gray-100 text-gray-600';

                return (
                  <tr key={row.clerkId} className={`hover:bg-gray-50 dark:hover:bg-gray-750 ${isContacted ? 'opacity-50' : ''}`}>
                    {/* Priority */}
                    <td className="px-4 py-2">
                      <span className={`tabular-nums text-sm ${priorityColor(row.outreachPriority)}`}>
                        {row.outreachPriority}
                      </span>
                    </td>

                    {/* User */}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 min-w-[160px]">
                        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[10px] font-medium text-blue-700 dark:text-blue-200">
                          {initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-gray-100 leading-tight">{name}</span>
                          <span className="text-gray-400 leading-tight">{row.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Funnel Stage */}
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${FUNNEL_COLORS[row.funnelStage]}`}>
                        {FUNNEL_LABELS[row.funnelStage]}
                      </Badge>
                    </td>

                    {/* Engagement Score */}
                    <td className="px-4 py-2">
                      <span className={`tabular-nums font-semibold ${row.engagementScore >= 30 ? 'text-purple-600' : row.engagementScore >= 15 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {row.engagementScore}
                      </span>
                    </td>

                    {/* Survey Summary */}
                    <td className="px-4 py-2 max-w-[220px]">
                      <span className="text-gray-500 truncate block" title={surveyOneLiner(row)}>
                        {surveyOneLiner(row)}
                      </span>
                    </td>

                    {/* Chat Activity */}
                    <td className="px-4 py-2">
                      {row.chatUserMsgCount > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-600 dark:text-gray-300 tabular-nums">
                            {row.chatUserMsgCount} msg{row.chatUserMsgCount !== 1 ? 's' : ''}
                            {row.chatLastDate && (
                              <span className="text-gray-400 ml-1">· {relativeTime(row.chatLastDate)}</span>
                            )}
                          </span>
                          <button
                            onClick={() => {
                              const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email;
                              setActivePanel({ userId: row.clerkId, userName: name });
                            }}
                            className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium"
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            Analyze
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Next Action */}
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${actionColor}`}>
                        {row.nextBestAction}
                      </span>
                    </td>

                    {/* Days Inactive */}
                    <td className="px-4 py-2 text-right">
                      <span className={`tabular-nums ${row.daysSinceActive <= 7 ? 'text-green-600' : row.daysSinceActive <= 30 ? 'text-blue-600' : row.daysSinceActive <= 90 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {row.daysSinceActive}d
                      </span>
                    </td>

                    {/* Quick Actions */}
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => copyEmail(row.email)}
                          title="Copy email"
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <a
                          href={`https://dashboard.clerk.com/apps/app/users/${row.clerkId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Clerk"
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => toggleContacted(row.clerkId)}
                          title={isContacted ? 'Mark as not contacted' : 'Mark as contacted'}
                          className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${isContacted ? 'text-green-500' : 'text-gray-300 hover:text-green-400'}`}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {queueRows.length > 200 && (
          <p className="text-center text-xs text-gray-400 py-2">
            Showing top 200 of {queueRows.length} — export CSV for full list
          </p>
        )}
      </div>

      {/* Chat Analysis Panel */}
      {activePanel && (
        <ChatAnalysisPanel
          userId={activePanel.userId}
          userName={activePanel.userName}
          onClose={() => setActivePanel(null)}
        />
      )}
    </div>
  );
}
