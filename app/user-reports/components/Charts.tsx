'use client';

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { UserRow, ReportSummary, BehavioralBucket, OutreachSegment } from '../types';

// ──────────────────────────────────────────────
// Shared chart card wrapper
// ──────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────
// Behavioral Bucket Chart (replaces Engagement Pie)
// ──────────────────────────────────────────────

const BUCKET_COLORS: Record<BehavioralBucket, string> = {
  '🔌 Power Users':          '#7c3aed',
  '⭐ Hot Leads':             '#d97706',
  '🎯 Warm Unsurveyed':      '#2563eb',
  '💤 Dormant with Signal':  '#ea580c',
  '📋 Needs Qualification':  '#6b7280',
  '👻 Ghost Accounts':       '#d1d5db',
};

export function BehavioralBucketChart({ summary }: { summary: ReportSummary }) {
  const data = summary.behavioralBuckets.map(({ bucket, count }) => ({
    name: bucket.replace(/^[^\s]+\s/, ''), // strip emoji for axis label
    fullName: bucket,
    value: count,
    color: BUCKET_COLORS[bucket as BehavioralBucket] ?? '#9ca3af',
  }));

  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <ChartCard title="Behavioral Buckets">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart layout="vertical" data={data} margin={{ top: 0, right: 50, left: 10, bottom: 0 }}>
          <XAxis type="number" domain={[0, total]} hide />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value: unknown, _name: unknown, props: { payload?: { fullName?: string } }) => [
              `${Number(value)} (${Math.round((Number(value) / total) * 100)}%)`,
              props.payload?.fullName ?? '',
            ]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: (v: unknown) => `${Math.round((Number(v) / total) * 100)}%` }}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Outreach Segment Chart (replaces Adoption bar)
// ──────────────────────────────────────────────

const SEGMENT_COLORS: Record<OutreachSegment, string> = {
  'Broker-Connected (Power User)':  '#7c3aed',
  'High-Intent: Simplicity Seekers':'#2563eb',
  'High-Intent: Time-Savers':       '#4f46e5',
  'Risk-Conscious: Safety First':   '#ea580c',
  'Education-Focused':              '#0d9488',
  'Automation Hunters':             '#d97706',
  'General Interest':               '#9ca3af',
};

export function OutreachSegmentChart({ summary }: { summary: ReportSummary }) {
  const data = summary.outreachSegments.map(({ segment, count }) => ({
    name: segment.length > 22 ? segment.slice(0, 22) + '…' : segment,
    fullName: segment,
    value: count,
    color: SEGMENT_COLORS[segment as OutreachSegment] ?? '#9ca3af',
  }));

  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <ChartCard title="Outreach Segments">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart layout="vertical" data={data} margin={{ top: 0, right: 50, left: 10, bottom: 0 }}>
          <XAxis type="number" domain={[0, total]} hide />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value: unknown, _name: unknown, props: { payload?: { fullName?: string } }) => [
              `${Number(value)} (${Math.round((Number(value) / total) * 100)}%)`,
              props.payload?.fullName ?? '',
            ]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: (v: unknown) => `${Math.round((Number(v) / total) * 100)}%` }}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Activity Chart (Bar) — kept
// ──────────────────────────────────────────────

const ACTIVITY_COLORS: Record<string, string> = {
  active: '#16a34a',
  recent: '#2563eb',
  lapsed: '#d97706',
  dormant: '#ea580c',
  never: '#9ca3af',
};

export function ActivityChart({ rows }: { rows: UserRow[] }) {
  const data = [
    { name: 'Active', value: rows.filter((r) => r.activityStatus === 'active').length, key: 'active' },
    { name: 'Recent', value: rows.filter((r) => r.activityStatus === 'recent').length, key: 'recent' },
    { name: 'Lapsed', value: rows.filter((r) => r.activityStatus === 'lapsed').length, key: 'lapsed' },
    { name: 'Dormant', value: rows.filter((r) => r.activityStatus === 'dormant').length, key: 'dormant' },
    { name: 'Never', value: rows.filter((r) => r.activityStatus === 'never').length, key: 'never' },
  ];

  return (
    <ChartCard title="Activity Status">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={ACTIVITY_COLORS[entry.key]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Survey Drop-off Chart
// ──────────────────────────────────────────────

export function SurveyDropOffChart({ summary }: { summary: ReportSummary }) {
  const labels = ['None', '1 Q', '2 Qs', '3 Qs', 'Complete'];
  const colors = ['#d1d5db', '#fca5a5', '#fcd34d', '#86efac', '#16a34a'];
  const data = summary.surveyDropOff.map((d, i) => ({
    name: labels[i] ?? `Q${d.answeredCount}`,
    value: d.userCount,
    color: colors[i] ?? '#9ca3af',
  }));

  return (
    <ChartCard title="Survey Completion Drop-off">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: unknown) => [Number(v), 'Users']} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Broker Type Chart
// ──────────────────────────────────────────────

export function BrokerTypeChart({ summary }: { summary: ReportSummary }) {
  const data = summary.brokerTypes.slice(0, 8).map(({ type, count }) => ({
    name: type,
    value: count,
  }));

  if (data.length === 0) {
    return (
      <ChartCard title="Broker Types">
        <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No broker data</div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Broker Types">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart layout="vertical" data={data} margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11 }} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Country Chart — kept
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Chat Activity Distribution
// ──────────────────────────────────────────────

export function ChatActivityChart({ rows }: { rows: UserRow[] }) {
  const data = [
    { name: '0 chats',   value: rows.filter((r) => r.chatUserMsgCount === 0).length,                                      color: '#d1d5db' },
    { name: '1–5 msgs',  value: rows.filter((r) => r.chatUserMsgCount >= 1 && r.chatUserMsgCount <= 5).length,             color: '#93c5fd' },
    { name: '6–20 msgs', value: rows.filter((r) => r.chatUserMsgCount >= 6 && r.chatUserMsgCount <= 20).length,            color: '#3b82f6' },
    { name: '20+ msgs',  value: rows.filter((r) => r.chatUserMsgCount > 20).length,                                        color: '#1d4ed8' },
  ];

  return (
    <ChartCard title="Chat Activity Distribution">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: unknown) => [Number(v), 'Users']} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Country Chart — kept
// ──────────────────────────────────────────────

export function CountryChart({ topCountries }: { topCountries: ReportSummary['topCountries'] }) {
  const data = topCountries.slice(0, 10).map(({ country, count }) => ({
    name: country === '(unknown)' ? 'Unknown' : country,
    value: count,
  }));

  return (
    <ChartCard title="Top Countries">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart layout="vertical" data={data} margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11 }} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
