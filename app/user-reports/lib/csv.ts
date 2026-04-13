import type { UserRow } from '../types';

const CSV_HEADER =
  'clerkId,email,firstName,lastName,country,city,createdAt,lastSignInAt,lastActiveAt,activityStatus,' +
  'onboardingComplete,betaAgreed,brokerConnected,brokerType,lastSymbol,lastTimeframe,' +
  'favoritePairsCount,recentPairsCount,chatThreadCount,lessonsCompleted,totalTradeDays,totalTrades,' +
  'telegramConnected,engagementLevel,experienceLevel,tradesPerWeek,traderType,priority,barrier,surveyStatus,bucket,' +
  'daysSinceSignup,daysSinceActive,engagementScore,outreachSegment,behavioralBucket';

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCSV(row: UserRow): string {
  return [
    row.clerkId,
    row.email,
    row.firstName,
    row.lastName,
    row.country,
    row.city,
    row.createdAt,
    row.lastSignInAt,
    row.lastActiveAt,
    row.activityStatus,
    row.onboardingComplete,
    row.betaAgreed,
    row.brokerConnected,
    row.brokerType,
    row.lastSymbol,
    row.lastTimeframe,
    row.favoritePairsCount,
    row.recentPairsCount,
    row.chatThreadCount,
    row.lessonsCompleted,
    row.totalTradeDays,
    row.totalTrades,
    row.telegramConnected,
    row.engagementLevel,
    row.experienceLevel,
    row.tradesPerWeek,
    row.traderType,
    row.priority,
    row.barrier,
    row.surveyStatus,
    row.bucket,
    row.daysSinceSignup.toString(),
    row.daysSinceActive.toString(),
    row.engagementScore.toString(),
    row.outreachSegment,
    row.behavioralBucket,
  ]
    .map(escapeCSV)
    .join(',');
}

export function downloadCSV(rows: UserRow[], filename?: string) {
  const csvContent = [CSV_HEADER, ...rows.map(rowToCSV)].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `user-report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
