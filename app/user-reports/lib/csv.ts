import type { UserRow } from '../types';

const CSV_HEADER =
  'clerkId,email,firstName,lastName,country,city,createdAt,lastSignInAt,lastActiveAt,activityStatus,' +
  'onboardingComplete,onboardingCurrentStep,betaAgreed,brokerConnected,brokerType,brokerConnectionDate,' +
  'lastSymbol,lastTimeframe,favoritePairsCount,recentPairsCount,chatThreadCount,lessonsCompleted,' +
  'totalTradeDays,totalTrades,telegramConnected,telegramVerified,engagementLevel,experienceLevel,' +
  'tradesPerWeek,traderType,priority,barrier,surveyStatus,surveyAnsweredCount,surveyCompletionDate,bucket,' +
  'daysSinceSignup,daysSinceActive,engagementScore,featureBreadthScore,funnelStage,outreachPriority,' +
  'nextBestAction,outreachSegment,behavioralBucket';

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
    row.onboardingCurrentStep,
    row.betaAgreed,
    row.brokerConnected,
    row.brokerType,
    row.brokerConnectionDate,
    row.lastSymbol,
    row.lastTimeframe,
    row.favoritePairsCount,
    row.recentPairsCount,
    row.chatThreadCount,
    row.lessonsCompleted,
    row.totalTradeDays,
    row.totalTrades,
    row.telegramConnected,
    row.telegramVerified,
    row.engagementLevel,
    row.experienceLevel,
    row.tradesPerWeek,
    row.traderType,
    row.priority,
    row.barrier,
    row.surveyStatus,
    row.surveyAnsweredCount.toString(),
    row.surveyCompletionDate,
    row.bucket,
    row.daysSinceSignup.toString(),
    row.daysSinceActive.toString(),
    row.engagementScore.toString(),
    row.featureBreadthScore.toString(),
    row.funnelStage,
    row.outreachPriority.toString(),
    row.nextBestAction,
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
