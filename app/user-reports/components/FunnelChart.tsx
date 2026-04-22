'use client';

import {
  FunnelChart,
  Funnel,
  Cell,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from 'recharts';
import type { ReportSummary, FunnelStage } from '../types';

interface Props {
  summary: ReportSummary;
}

const STAGE_CONFIG: Array<{ key: FunnelStage; label: string; color: string }> = [
  { key: 'signed-up',        label: 'Signed Up',       color: '#bfdbfe' },
  { key: 'onboarded',        label: 'Onboarded',       color: '#93c5fd' },
  { key: 'surveyed',         label: 'Surveyed',        color: '#60a5fa' },
  { key: 'exploring',        label: 'Exploring',       color: '#3b82f6' },
  { key: 'broker-connected', label: 'Broker Connected',color: '#2563eb' },
  { key: 'trading',          label: 'Trading',         color: '#1d4ed8' },
];

// Recharts FunnelChart uses cumulative counts (each stage = users at that stage OR higher)
function buildFunnelData(summary: ReportSummary) {
  const stages = ['signed-up', 'onboarded', 'surveyed', 'exploring', 'broker-connected', 'trading'] as FunnelStage[];
  // Build cumulative counts: each row = users who reached THIS stage or beyond
  const cumulative: number[] = [];
  let running = 0;
  for (let i = stages.length - 1; i >= 0; i--) {
    running += summary.funnel[stages[i]] ?? 0;
    cumulative.unshift(running);
  }
  return STAGE_CONFIG.map((s, i) => ({
    name: s.label,
    value: cumulative[i],
    color: s.color,
    stageKey: s.key,
  }));
}

function conversionLabel(summary: ReportSummary, fromKey: FunnelStage): string {
  const conv = summary.funnelConversions.find((c) => c.from === fromKey);
  if (!conv) return '';
  return ` → ${Math.round(conv.rate * 100)}%`;
}

export function ActivationFunnelChart({ summary }: Props) {
  const data = buildFunnelData(summary);
  const total = data[0]?.value || 1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Activation Funnel</h3>
        <span className="text-xs text-gray-400">Cumulative users per stage</span>
      </div>

      {/* Stage legend with counts and conversion rates */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4">
        {STAGE_CONFIG.map((s, i) => {
          const count = data[i]?.value ?? 0;
          const conv = i < STAGE_CONFIG.length - 1 ? conversionLabel(summary, s.key) : '';
          return (
            <div key={s.key} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: s.color }} />
              <span className="text-gray-600 dark:text-gray-400">{s.label}</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{count.toLocaleString()}</span>
              <span className="text-gray-400">({Math.round((count / total) * 100)}%)</span>
              {conv && <span className="text-indigo-500 font-medium">{conv}</span>}
            </div>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <FunnelChart>
          <Tooltip
            formatter={(value: unknown) => [Number(value).toLocaleString(), 'Users']}
          />
          <Funnel
            dataKey="value"
            data={data}
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <LabelList
              dataKey="name"
              position="right"
              style={{ fontSize: 11, fill: '#6b7280' }}
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
