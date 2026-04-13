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

export type FunnelStage =
  | 'signed-up'        // created account only
  | 'onboarded'        // completed onboarding flow
  | 'surveyed'         // completed 4-question survey
  | 'exploring'        // has AI chat / lessons / watchlist activity
  | 'broker-connected' // connected a broker via MetaAPI
  | 'trading';         // has executed at least one trade

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
  onboardingCurrentStep: string;
  // Broker
  brokerConnected: string;
  brokerType: string;
  brokerConnectionDate: string;
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
  telegramVerified: string;
  engagementLevel: EngagementLevel;
  // Survey
  experienceLevel: string;
  tradesPerWeek: string;
  traderType: string;
  priority: string;
  barrier: string;
  surveyStatus: SurveyStatus;
  surveyAnsweredCount: number;
  surveyCompletionDate: string;
  bucket: string;
  // Computed enrichment fields
  daysSinceSignup: number;
  daysSinceActive: number;
  engagementScore: number;
  featureBreadthScore: number;
  outreachSegment: OutreachSegment;
  behavioralBucket: BehavioralBucket;
  funnelStage: FunnelStage;
  outreachPriority: number;
  nextBestAction: string;
  // Chat analysis fields
  chatLastDate: string;
  chatUserMsgCount: number;
}

// ──────────────────────────────────────────────
// Report summary (pre-computed server-side)
// ──────────────────────────────────────────────

export interface FunnelConversion {
  from: FunnelStage;
  to: FunnelStage;
  rate: number; // 0-1
}

export interface SignupCohort {
  week: string;       // ISO week label e.g. "2025-W12"
  total: number;
  activated: number;  // reached 'exploring' or beyond
  rate: number;       // activated / total (0-1)
}

export interface SurveyDropOff {
  answeredCount: number; // 0, 1, 2, 3, or 4
  userCount: number;
}

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
  // Action-oriented summary data
  funnel: Record<FunnelStage, number>;
  funnelConversions: FunnelConversion[];
  signupCohorts: SignupCohort[];
  avgTimeToBroker: number | null;
  surveyDropOff: SurveyDropOff[];
}

// ──────────────────────────────────────────────
// LLM Chat Analysis result
// ──────────────────────────────────────────────

export interface ChatAnalysis {
  topTopics: string[];
  painPoints: string[];
  featureRequests: string[];
  tradingInterests: string[];
  engagementPattern: 'power' | 'moderate' | 'minimal' | 'one-shot';
  sophisticationLevel: 'beginner' | 'intermediate' | 'advanced';
  summary: string;
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
