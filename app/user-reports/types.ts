// ──────────────────────────────────────────────
// Azure Table entity shapes
// ──────────────────────────────────────────────

export interface SurveyResponseEntity {
  partitionKey: string;
  rowKey: string;
  question: string;
  answer: string;
  answeredAt: string;
  numericValue?: number;
  traderType?: string;
}

export interface OnboardingStateEntity {
  partitionKey: string;
  rowKey: string;
  currentStep?: string;
  betaAgreementAccepted?: boolean;
  completedAt?: string;
}

export interface BrokerConnectionEntity {
  partitionKey: string;
  rowKey: string;
  connected?: boolean;
  lastUpdated?: string;
}

export interface UserPreferencesEntity {
  partitionKey: string;
  rowKey: string;
  lastSymbol?: string;
  lastTimeframe?: string;
  favorites?: string;
  recentPairs?: string;
}

export interface LessonProgressEntity {
  partitionKey: string;
  rowKey: string;
  completedAt?: string;
}

export interface TradingFrequencyEntity {
  partitionKey: string;
  rowKey: string;
  tradesCount?: number;
}

export interface TelegramEntity {
  partitionKey: string;
  rowKey: string;
  chatId?: string;
  verified?: boolean;
}

// ──────────────────────────────────────────────
// Classification types
// ──────────────────────────────────────────────

export type ActivityStatus = 'active' | 'recent' | 'lapsed' | 'dormant' | 'never';
export type EngagementLevel = 'power' | 'engaged' | 'casual' | 'ghost';
export type SurveyStatus = 'complete' | 'incomplete' | 'no-survey';

export type OutreachSegment =
  | 'Broker-Connected (Power User)'
  | 'High-Intent: Simplicity Seekers'
  | 'High-Intent: Time-Savers'
  | 'Risk-Conscious: Safety First'
  | 'Education-Focused'
  | 'Automation Hunters'
  | 'General Interest';

export type BehavioralBucket =
  | '🔌 Power Users'
  | '⭐ Hot Leads'
  | '🎯 Warm Unsurveyed'
  | '💤 Dormant with Signal'
  | '📋 Needs Qualification'
  | '👻 Ghost Accounts';

// ──────────────────────────────────────────────
// Core data row
// ──────────────────────────────────────────────

export interface UserRow {
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  city: string;
  createdAt: string;
  lastSignInAt: string;
  lastActiveAt: string;
  activityStatus: ActivityStatus;
  // Onboarding
  onboardingComplete: string;
  betaAgreed: string;
  // Broker
  brokerConnected: string;
  brokerType: string;
  // Preferences
  lastSymbol: string;
  lastTimeframe: string;
  favoritePairsCount: string;
  recentPairsCount: string;
  // Engagement
  chatThreadCount: string;
  lessonsCompleted: string;
  totalTradeDays: string;
  totalTrades: string;
  telegramConnected: string;
  engagementLevel: EngagementLevel;
  // Survey
  experienceLevel: string;
  tradesPerWeek: string;
  traderType: string;
  priority: string;
  barrier: string;
  surveyStatus: SurveyStatus;
  bucket: string;
  // Computed enrichment fields
  daysSinceSignup: number;
  daysSinceActive: number;
  engagementScore: number;
  outreachSegment: OutreachSegment;
  behavioralBucket: BehavioralBucket;
}

// ──────────────────────────────────────────────
// Report summary (pre-computed server-side)
// ──────────────────────────────────────────────

export interface ReportSummary {
  total: number;
  engagement: Record<EngagementLevel, number>;
  activity: Record<ActivityStatus, number>;
  survey: Record<SurveyStatus, number>;
  adoption: {
    onboarded: number;
    brokerConnected: number;
    hasTrades: number;
    hasChats: number;
    hasLessons: number;
    telegramConnected: number;
  };
  topCountries: Array<{ country: string; count: number }>;
  brokerTypes: Array<{ type: string; count: number }>;
  buckets: Array<{ bucket: string; count: number }>;
  outreachSegments: Array<{ segment: OutreachSegment; count: number }>;
  behavioralBuckets: Array<{ bucket: BehavioralBucket; count: number }>;
}

// ──────────────────────────────────────────────
// SSE event payloads
// ──────────────────────────────────────────────

export type ProgressPhase = 'clerk' | 'enrich';

export interface ProgressEvent {
  phase: ProgressPhase;
  current: number;
  total: number;
  message: string;
}

export interface CompleteEvent {
  rows: UserRow[];
  summary: ReportSummary;
}

export interface ErrorEvent {
  message: string;
}
