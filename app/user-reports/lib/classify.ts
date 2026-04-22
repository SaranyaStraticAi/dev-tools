import type { ActivityStatus, EngagementLevel, OutreachSegment, BehavioralBucket, FunnelStage, UserRow } from '../types';

export function formatDate(ts: number | null | undefined): string {
  if (!ts) return '';
  return new Date(ts).toISOString().split('T')[0];
}

export function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function classifyActivity(lastActiveAt: number | null | undefined): ActivityStatus {
  if (!lastActiveAt) return 'never';
  const d = (Date.now() - lastActiveAt) / (1000 * 60 * 60 * 24);
  if (d <= 7) return 'active';
  if (d <= 30) return 'recent';
  if (d <= 90) return 'lapsed';
  return 'dormant';
}

export function classifyEngagement(row: {
  brokerConnected: string;
  totalTrades: string;
  activityStatus: ActivityStatus;
  onboardingComplete: string;
}): EngagementLevel {
  const hasBroker = row.brokerConnected === 'true';
  const hasTrades = parseInt(row.totalTrades || '0', 10) > 0;
  const isActive = row.activityStatus === 'active';
  const isRecent = row.activityStatus === 'recent';
  const onboarded = row.onboardingComplete === 'true';

  if (hasBroker && hasTrades && isActive) return 'power';
  if (hasBroker || hasTrades || isActive || isRecent) return 'engaged';
  if (onboarded) return 'casual';
  return 'ghost';
}

export function buildBucket(row: Omit<UserRow, 'bucket' | 'daysSinceSignup' | 'daysSinceActive' | 'engagementScore' | 'outreachSegment' | 'behavioralBucket' | 'funnelStage' | 'featureBreadthScore' | 'outreachPriority' | 'nextBestAction'>): string {
  if (row.surveyStatus === 'no-survey') return 'no-survey';
  if (row.surveyStatus === 'incomplete') return 'incomplete-survey';
  const parts = [row.experienceLevel, row.traderType, row.priority].filter(Boolean);
  return parts.join('-') || 'complete-unknown';
}

/**
 * Engagement score (0–75 max).
 *   +5  onboarded
 *   +5  survey complete
 *   +10 broker connected
 *   +min(chats, 5) * 3     (max 15)
 *   +min(lessons, 5) * 3   (max 15)
 *   +min(recentPairs, 5) * 2  (max 10)
 *   +min(favPairs, 5) * 2     (max 10)
 *   +5  telegram connected
 */
export function computeEngagementScore(row: {
  onboardingComplete: string;
  surveyStatus: string;
  brokerConnected: string;
  chatThreadCount: string;
  lessonsCompleted: string;
  recentPairsCount: string;
  favoritePairsCount: string;
  telegramConnected: string;
}): number {
  const cap = (n: string, max: number) => Math.min(parseInt(n || '0', 10), max);
  return (
    (row.onboardingComplete === 'true' ? 5 : 0) +
    (row.surveyStatus === 'complete' ? 5 : 0) +
    (row.brokerConnected === 'true' ? 10 : 0) +
    cap(row.chatThreadCount, 5) * 3 +
    cap(row.lessonsCompleted, 5) * 3 +
    cap(row.recentPairsCount, 5) * 2 +
    cap(row.favoritePairsCount, 5) * 2 +
    (row.telegramConnected === 'true' ? 5 : 0)
  );
}

/**
 * Outreach segment — 7-way classification used by sales/marketing.
 * Priority order: broker → priority/barrier combos → general
 */
export function computeOutreachSegment(row: {
  brokerConnected: string;
  priority: string;
  barrier: string;
  surveyStatus: string;
}): OutreachSegment {
  if (row.brokerConnected === 'true') return 'Broker-Connected (Power User)';
  if (row.surveyStatus !== 'complete') return 'General Interest';

  const { priority, barrier } = row;

  if (priority === 'Risk Management') return 'Risk-Conscious: Safety First';
  if (priority === 'Learning') return 'Education-Focused';
  if (priority === 'Automation') return 'Automation Hunters';
  if (priority === 'Profit Maximization') {
    if (barrier === 'Too complex to find opportunities') return 'High-Intent: Simplicity Seekers';
    if (barrier === 'Lack of time to analyze') return 'High-Intent: Time-Savers';
  }
  return 'General Interest';
}

/**
 * Behavioral bucket — 6 actionable buckets for the sales team.
 */
export function computeBehavioralBucket(row: {
  brokerConnected: string;
  engagementLevel: EngagementLevel;
  activityStatus: ActivityStatus;
  surveyStatus: string;
  chatThreadCount: string;
  recentPairsCount: string;
  favoritePairsCount: string;
}): BehavioralBucket {
  const hasBroker = row.brokerConnected === 'true';
  if (hasBroker) return '🔌 Power Users';

  const hasSignal =
    parseInt(row.chatThreadCount || '0', 10) > 0 ||
    parseInt(row.recentPairsCount || '0', 10) > 0 ||
    parseInt(row.favoritePairsCount || '0', 10) > 0;

  if (row.engagementLevel === 'ghost') return '👻 Ghost Accounts';

  if (row.surveyStatus === 'no-survey') return '🎯 Warm Unsurveyed';

  if (row.activityStatus === 'active' && row.surveyStatus === 'complete') return '⭐ Hot Leads';

  if ((row.activityStatus === 'dormant' || row.activityStatus === 'lapsed') && hasSignal) {
    return '💤 Dormant with Signal';
  }

  return '📋 Needs Qualification';
}

/**
 * Funnel stage — 6-stage activation funnel.
 * Assigns the HIGHEST stage the user has reached.
 */
export function computeFunnelStage(row: {
  totalTrades: string;
  brokerConnected: string;
  chatThreadCount: string;
  lessonsCompleted: string;
  favoritePairsCount: string;
  surveyStatus: string;
  onboardingComplete: string;
}): FunnelStage {
  if (parseInt(row.totalTrades || '0', 10) > 0) return 'trading';
  if (row.brokerConnected === 'true') return 'broker-connected';
  const hasExplored =
    parseInt(row.chatThreadCount || '0', 10) > 0 ||
    parseInt(row.lessonsCompleted || '0', 10) > 0 ||
    parseInt(row.favoritePairsCount || '0', 10) > 0;
  if (hasExplored) return 'exploring';
  if (row.surveyStatus === 'complete') return 'surveyed';
  if (row.onboardingComplete === 'true') return 'onboarded';
  return 'signed-up';
}

/**
 * Feature breadth score — how many of 6 product features have been adopted.
 * Returns 0-6.
 */
export function computeFeatureBreadth(row: {
  onboardingComplete: string;
  surveyStatus: string;
  brokerConnected: string;
  chatThreadCount: string;
  lessonsCompleted: string;
  telegramConnected: string;
}): number {
  return (
    (row.onboardingComplete === 'true' ? 1 : 0) +
    (row.surveyStatus === 'complete' ? 1 : 0) +
    (row.brokerConnected === 'true' ? 1 : 0) +
    (parseInt(row.chatThreadCount || '0', 10) > 0 ? 1 : 0) +
    (parseInt(row.lessonsCompleted || '0', 10) > 0 ? 1 : 0) +
    (row.telegramConnected === 'true' ? 1 : 0)
  );
}

/**
 * Outreach priority score — composite 1-100 score for sorting the outreach queue.
 * Higher = contact sooner.
 *
 * Components:
 *   - Engagement score (0-75) normalized to 0-40 points
 *   - Recency: active=+25, recent=+15, lapsed=+5, dormant/never=0
 *   - Survey: complete=+10, incomplete=+5
 *   - Not yet broker-connected bonus: +10 (they need outreach)
 * Total raw max ≈ 85, clamped and normalized to 1-100.
 */
export function computeOutreachPriority(row: {
  engagementScore: number;
  activityStatus: ActivityStatus;
  surveyStatus: string;
  brokerConnected: string;
}): number {
  const engagementPoints = Math.round((row.engagementScore / 75) * 40);

  const recencyPoints =
    row.activityStatus === 'active' ? 25 :
    row.activityStatus === 'recent' ? 15 :
    row.activityStatus === 'lapsed' ? 5 : 0;

  const surveyPoints =
    row.surveyStatus === 'complete' ? 10 :
    row.surveyStatus === 'incomplete' ? 5 : 0;

  const outreachBonus = row.brokerConnected !== 'true' ? 10 : 0;

  const raw = engagementPoints + recencyPoints + surveyPoints + outreachBonus;
  // Normalize to 1-100 (raw max ≈ 85)
  return Math.max(1, Math.min(100, Math.round((raw / 85) * 100)));
}

/**
 * Next best action — short recommendation string for the sales rep.
 */
export function computeNextBestAction(row: {
  engagementLevel: EngagementLevel;
  onboardingComplete: string;
  surveyStatus: string;
  brokerConnected: string;
  totalTrades: string;
  activityStatus: ActivityStatus;
  chatThreadCount: string;
  lessonsCompleted: string;
  favoritePairsCount: string;
}): string {
  const hasBroker = row.brokerConnected === 'true';
  const hasTrades = parseInt(row.totalTrades || '0', 10) > 0;
  const hasSignal =
    parseInt(row.chatThreadCount || '0', 10) > 0 ||
    parseInt(row.lessonsCompleted || '0', 10) > 0 ||
    parseInt(row.favoritePairsCount || '0', 10) > 0;

  if (hasBroker && hasTrades && row.activityStatus === 'active') return 'Upsell / referral ask';
  if (hasBroker && !hasTrades) return 'Send first trade guide';
  if (hasBroker) return 'Re-engage — broker connected but dormant';

  if (row.engagementLevel === 'ghost' && row.onboardingComplete !== 'true') return 'Send activation email';

  if (row.surveyStatus === 'complete' && !hasBroker && row.activityStatus === 'active') return 'Schedule broker setup call';

  if ((row.activityStatus === 'dormant' || row.activityStatus === 'lapsed') && hasSignal) return 'Re-engagement campaign';

  if (row.onboardingComplete === 'true' && row.surveyStatus !== 'complete') return 'Request survey completion';

  if (row.surveyStatus === 'complete' && !hasBroker) return 'Schedule broker setup call';

  return 'Nurture — keep warm';
}
