'use client';

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { UserRow, ReportSummary } from '../types';

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
// Engagement Chart (Pie)
// ──────────────────────────────────────────────

const ENGAGEMENT_COLORS: Record<string, string> = {
  power: '#7c3aed',
  engaged: '#2563eb',
  casual: '#0d9488',
  ghost: '#9ca3af',
};

export function EngagementChart({ rows }: { rows: UserRow[] }) {
  const counts = {
    power: rows.filter((r) => r.engagementLevel === 'power').length,
    engaged: rows.filter((r) => r.engagementLevel === 'engaged').length,
    casual: rows.filter((r) => r.engagementLevel === 'casual').length,
    ghost: rows.filter((r) => r.engagementLevel === 'ghost').length,
  };
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  return (
    <ChartCard title="Engagement Level">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
            labelLine={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={ENGAGEMENT_COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [value, name]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Activity Chart (Bar)
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
// Platform Adoption Chart (Horizontal Bar)
// ──────────────────────────────────────────────

export function AdoptionChart({ rows }: { rows: UserRow[] }) {
  const n = rows.length || 1;
  const data = [
    { name: 'Onboarded', value: rows.filter((r) => r.onboardingComplete === 'true').length },
    { name: 'Broker', value: rows.filter((r) => r.brokerConnected === 'true').length },
    { name: 'Has Trades', value: rows.filter((r) => parseInt(r.totalTrades) > 0).length },
    { name: 'AI Chats', value: rows.filter((r) => parseInt(r.chatThreadCount) > 0).length },
    { name: 'Lessons', value: rows.filter((r) => parseInt(r.lessonsCompleted) > 0).length },
    { name: 'Telegram', value: rows.filter((r) => r.telegramConnected === 'true').length },
  ].map((d) => ({ ...d, pct: Math.round((d.value / n) * 100) }));

  return (
    <ChartCard title="Platform Adoption">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
        >
          <XAxis type="number" domain={[0, n]} hide />
          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value, _name, props) => [
              `${value} (${props.payload?.pct}%)`,
              'Users',
            ]}
          />
          <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: (v: unknown) => `${Math.round((Number(v) / n) * 100)}%` }} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Country Chart (Horizontal Bar)
// ──────────────────────────────────────────────

export function CountryChart({ topCountries }: { topCountries: ReportSummary['topCountries'] }) {
  const data = topCountries.slice(0, 10).map(({ country, count }) => ({
    name: country === '(unknown)' ? 'Unknown' : country,
    value: count,
  }));

  return (
    <ChartCard title="Top Countries">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11 }} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
