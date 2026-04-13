'use client';

import type { UserRow, ReportSummary, FunnelStage } from '../types';

interface Props {
  summary: ReportSummary;
  filteredRows: UserRow[];
  totalRows: number;
  onHotLeadsClick?: () => void;
  onNeedsOutreachClick?: () => void;
  onDormantClick?: () => void;
}

function Card({
  label,
  value,
  subtitle,
  color,
  onClick,
  mini,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
  onClick?: () => void;
  mini?: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
      {mini}
    </div>
  );
}

function pct(n: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

export function SummaryCards({ summary, filteredRows, totalRows, onHotLeadsClick, onNeedsOutreachClick, onDormantClick }: Props) {
  const n = filteredRows.length;
  const isFiltered = n !== totalRows;

  // Row 1 — Health metrics
  const ACTIVATED: FunnelStage[] = ['exploring', 'broker-connected', 'trading'];
  const activatedCount = filteredRows.filter((r) => ACTIVATED.includes(r.funnelStage)).length;
  const activationRate = pct(activatedCount, n);

  // Weakest funnel step from summary conversions
  let weakestLabel = '—';
  let weakestRate = 1;
  const stageLabel: Record<string, string> = {
    'signed-up': 'Signup',
    onboarded: 'Onboarded',
    surveyed: 'Surveyed',
    exploring: 'Exploring',
    'broker-connected': 'Broker',
    trading: 'Trading',
  };
  for (const conv of summary.funnelConversions) {
    if (conv.rate < weakestRate) {
      weakestRate = conv.rate;
      weakestLabel = `${stageLabel[conv.from]} → ${stageLabel[conv.to]}: ${Math.round(conv.rate * 100)}%`;
    }
  }

  const avgDays = summary.avgTimeToBroker !== null ? `${summary.avgTimeToBroker}d` : '—';

  // Row 2 — Action metrics
  const hotLeads = filteredRows.filter((r) => r.behavioralBucket === '⭐ Hot Leads').length;
  const needsOutreach = filteredRows.filter(
    (r) => r.outreachPriority > 70 && r.brokerConnected !== 'true'
  ).length;
  const dormantWithSignal = filteredRows.filter((r) => r.behavioralBucket === '💤 Dormant with Signal').length;

  // Survey mini progress bar
  const surveyComplete = filteredRows.filter((r) => r.surveyStatus === 'complete').length;
  const surveyIncomplete = filteredRows.filter((r) => r.surveyStatus === 'incomplete').length;
  const surveyBar = (
    <div className="flex h-1.5 rounded-full overflow-hidden gap-px mt-1">
      <div className="bg-green-400" style={{ width: pct(surveyComplete, n) }} title={`Complete: ${surveyComplete}`} />
      <div className="bg-yellow-400" style={{ width: pct(surveyIncomplete, n) }} title={`Partial: ${surveyIncomplete}`} />
      <div className="bg-gray-200 dark:bg-gray-600 flex-1" />
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Row 1 — Health */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          label="Total Users"
          value={n.toLocaleString()}
          subtitle={isFiltered ? `of ${totalRows.toLocaleString()} total` : 'all users'}
          color="text-gray-800 dark:text-gray-100"
        />
        <Card
          label="Activation Rate"
          value={activationRate}
          subtitle={`${activatedCount.toLocaleString()} reached Exploring+`}
          color="text-emerald-600 dark:text-emerald-400"
        />
        <Card
          label="Weakest Funnel Step"
          value={weakestRate < 1 ? `${Math.round(weakestRate * 100)}%` : '—'}
          subtitle={weakestLabel}
          color={weakestRate < 0.5 ? 'text-red-600' : weakestRate < 0.7 ? 'text-yellow-600' : 'text-green-600'}
        />
        <Card
          label="Avg Days to Broker"
          value={avgDays}
          subtitle="signup → first connection"
          color="text-indigo-600 dark:text-indigo-400"
        />
      </div>

      {/* Row 2 — Action */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          label="Hot Leads"
          value={hotLeads.toLocaleString()}
          subtitle="active + survey complete"
          color="text-yellow-600 dark:text-yellow-400"
          onClick={onHotLeadsClick}
        />
        <Card
          label="Needs Outreach"
          value={needsOutreach.toLocaleString()}
          subtitle="priority > 70, no broker"
          color="text-red-600 dark:text-red-400"
          onClick={onNeedsOutreachClick}
        />
        <Card
          label="Dormant w/ Signal"
          value={dormantWithSignal.toLocaleString()}
          subtitle="re-engageable leads"
          color="text-orange-600 dark:text-orange-400"
          onClick={onDormantClick}
        />
        <Card
          label="Survey Completion"
          value={pct(surveyComplete, n)}
          subtitle={`${surveyComplete} complete · ${surveyIncomplete} partial`}
          color="text-blue-600 dark:text-blue-400"
          mini={surveyBar}
        />
      </div>
    </div>
  );
}
