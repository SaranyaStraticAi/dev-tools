'use client';

import type { ReportSummary, UserRow } from '../types';

interface SummaryCardsProps {
  summary: ReportSummary;
  filteredRows: UserRow[];
  totalRows: number;
}

function Card({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

export function SummaryCards({ summary, filteredRows, totalRows }: SummaryCardsProps) {
  const isFiltered = filteredRows.length !== totalRows;
  const n = filteredRows.length;

  // Re-derive stats from filtered rows
  const active = filteredRows.filter((r) => r.activityStatus === 'active').length;
  const brokerConnected = filteredRows.filter((r) => r.brokerConnected === 'true').length;
  const surveyComplete = filteredRows.filter((r) => r.surveyStatus === 'complete').length;
  const powerUsers = filteredRows.filter((r) => r.engagementLevel === 'power').length;
  const telegram = filteredRows.filter((r) => r.telegramConnected === 'true').length;

  const pct = (v: number) => (n > 0 ? `${Math.round((v / n) * 100)}%` : '0%');

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card
        label="Total Users"
        value={n}
        sub={isFiltered ? `of ${totalRows} total` : undefined}
        color="text-gray-900 dark:text-gray-100"
      />
      <Card
        label="Active (7d)"
        value={active}
        sub={pct(active)}
        color="text-green-600 dark:text-green-400"
      />
      <Card
        label="Broker Connected"
        value={brokerConnected}
        sub={pct(brokerConnected)}
        color="text-indigo-600 dark:text-indigo-400"
      />
      <Card
        label="Survey Complete"
        value={surveyComplete}
        sub={pct(surveyComplete)}
        color="text-blue-600 dark:text-blue-400"
      />
      <Card
        label="Power Users"
        value={powerUsers}
        sub={pct(powerUsers)}
        color="text-purple-600 dark:text-purple-400"
      />
      <Card
        label="Telegram"
        value={telegram}
        sub={pct(telegram)}
        color="text-sky-600 dark:text-sky-400"
      />
    </div>
  );
}
