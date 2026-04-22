import { NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import {
  initTableClients,
  fetchSurveyForUser,
  fetchBrokerInfo,
  fetchTradingMetrics,
  fetchLessonsCompleted,
  fetchChatMetrics,
  pointQuery,
} from '@/app/user-reports/lib/azure-tables';
import {
  classifyActivity,
  classifyEngagement,
  buildBucket,
  formatDate,
  daysSince,
  computeEngagementScore,
  computeOutreachSegment,
  computeBehavioralBucket,
  computeFunnelStage,
  computeFeatureBreadth,
  computeOutreachPriority,
  computeNextBestAction,
} from '@/app/user-reports/lib/classify';
import type {
  UserRow,
  ReportSummary,
  OnboardingStateEntity,
  UserPreferencesEntity,
  TelegramEntity,
  FunnelStage,
  FunnelConversion,
  SignupCohort,
  SurveyDropOff,
} from '@/app/user-reports/types';

const FUNNEL_STAGES: FunnelStage[] = [
  'signed-up',
  'onboarded',
  'surveyed',
  'exploring',
  'broker-connected',
  'trading',
];

function sendEvent(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  event: string,
  data: unknown
) {
  const encoder = new TextEncoder();
  const text = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return writer.write(encoder.encode(text));
}

/** ISO week label, e.g. "2025-W03" */
function isoWeek(dateStr: string): string {
  if (!dateStr) return 'unknown';
  const d = new Date(dateStr);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function POST() {
  const clerkSecretKey = process.env.CLERK_LIVE_SECRET_KEY;
  const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!clerkSecretKey) {
    return NextResponse.json({ error: 'CLERK_LIVE_SECRET_KEY not configured' }, { status: 500 });
  }
  if (!azureConnectionString) {
    return NextResponse.json(
      { error: 'AZURE_STORAGE_CONNECTION_STRING not configured' },
      { status: 500 }
    );
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      const clerk = createClerkClient({ secretKey: clerkSecretKey });
      const tables = initTableClients(azureConnectionString);

      // ── Phase 1: Fetch all Clerk users ──
      const allUsers: Awaited<ReturnType<typeof clerk.users.getUserList>>['data'] = [];
      let offset = 0;
      const limit = 500;

      const firstPage = await clerk.users.getUserList({ limit, offset });
      allUsers.push(...firstPage.data);
      const totalUsers = firstPage.totalCount;

      await sendEvent(writer, 'progress', {
        phase: 'clerk',
        current: allUsers.length,
        total: totalUsers,
        message: `Fetching Clerk users... ${allUsers.length} / ${totalUsers}`,
      });

      offset += limit;
      while (allUsers.length < totalUsers) {
        const page = await clerk.users.getUserList({ limit, offset });
        allUsers.push(...page.data);
        await sendEvent(writer, 'progress', {
          phase: 'clerk',
          current: allUsers.length,
          total: totalUsers,
          message: `Fetching Clerk users... ${allUsers.length} / ${totalUsers}`,
        });
        offset += limit;
      }

      // ── Phase 2: Enrich each user from Azure Tables ──
      const BATCH_SIZE = 10;
      const rows: UserRow[] = [];

      for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
        const batch = allUsers.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (user) => {
            const userId = user.id;

            const [
              survey,
              sessionPage,
              onboardingState,
              brokerInfo,
              prefs,
              watchlist,
              chatMetrics,
              lessonsCompleted,
              tradingMetrics,
              telegramEntity,
            ] = await Promise.all([
              fetchSurveyForUser(tables.survey, userId),
              clerk.sessions.getSessionList({ userId, limit: 1 }).catch(() => null),
              pointQuery<OnboardingStateEntity>(tables.onboarding, userId, 'state'),
              fetchBrokerInfo(tables.broker, userId),
              pointQuery<UserPreferencesEntity>(tables.prefs, userId, 'preferences'),
              pointQuery<UserPreferencesEntity>(tables.prefs, userId, 'watchlist'),
              fetchChatMetrics(tables.threads, tables.messages, userId),
              fetchLessonsCompleted(tables.lessons, userId),
              fetchTradingMetrics(tables.metrics, userId),
              pointQuery<TelegramEntity>(tables.telegram, 'telegram', userId),
            ]);

            // Survey
            const q1 = survey['q1'];
            const q2 = survey['q2'];
            const q3 = survey['q3'];
            const q4 = survey['q4'];
            const answeredCount = [q1, q2, q3, q4].filter(Boolean).length;
            const surveyStatus: UserRow['surveyStatus'] =
              answeredCount === 4 ? 'complete' : answeredCount > 0 ? 'incomplete' : 'no-survey';

            // Survey completion date (most recent answeredAt)
            const surveyCompletionDate = [q1, q2, q3, q4]
              .filter(Boolean)
              .map((q) => q!.answeredAt)
              .filter(Boolean)
              .sort()
              .at(-1) ?? '';

            // Geo from session
            const latestSession = sessionPage?.data?.[0];
            const country = latestSession?.latestActivity?.country || '';
            const city = latestSession?.latestActivity?.city || '';

            // Watchlist counts and pair names
            let favoritePairsCount = 0;
            let recentPairsCount = 0;
            if (watchlist?.favorites) {
              try { favoritePairsCount = JSON.parse(watchlist.favorites).length; } catch { /* ignore */ }
            }
            if (watchlist?.recentPairs) {
              try { recentPairsCount = JSON.parse(watchlist.recentPairs).length; } catch { /* ignore */ }
            }

            const activityStatus = classifyActivity(user.lastActiveAt);

            const createdAtStr = formatDate(user.createdAt);
            const lastActiveAtStr = formatDate(user.lastActiveAt);
            const brokerConnectedStr = brokerInfo.connected ? 'true' : 'false';
            const onboardingCompleteStr = onboardingState?.completedAt ? 'true' : 'false';
            const telegramConnectedStr = telegramEntity?.chatId ? 'true' : 'false';
            const telegramVerifiedStr = telegramEntity?.verified ? 'true' : 'false';
            const chatThreadCountStr = chatMetrics.threadCount.toString();
            const lessonsCompletedStr = lessonsCompleted.toString();
            const recentPairsCountStr = recentPairsCount.toString();
            const favoritePairsCountStr = favoritePairsCount.toString();
            const totalTradesStr = tradingMetrics.totalTrades.toString();
            const priority = q3?.answer || '';
            const barrier = q4?.answer || '';

            const engagementLevel = classifyEngagement({
              brokerConnected: brokerConnectedStr,
              totalTrades: totalTradesStr,
              activityStatus,
              onboardingComplete: onboardingCompleteStr,
            });

            const partialRow: Omit<UserRow, 'bucket' | 'daysSinceSignup' | 'daysSinceActive' | 'engagementScore' | 'outreachSegment' | 'behavioralBucket' | 'funnelStage' | 'featureBreadthScore' | 'outreachPriority' | 'nextBestAction'> = {
              clerkId: userId,
              email: user.emailAddresses[0]?.emailAddress || '',
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              country,
              city,
              createdAt: createdAtStr,
              lastSignInAt: formatDate(user.lastSignInAt),
              lastActiveAt: lastActiveAtStr,
              activityStatus,
              onboardingComplete: onboardingCompleteStr,
              betaAgreed: onboardingState?.betaAgreementAccepted ? 'true' : 'false',
              onboardingCurrentStep: onboardingState?.currentStep || '',
              brokerConnected: brokerConnectedStr,
              brokerType: brokerInfo.types.join('|'),
              brokerConnectionDate: brokerInfo.firstConnectionDate || '',
              lastSymbol: prefs?.lastSymbol || '',
              lastTimeframe: prefs?.lastTimeframe || '',
              favoritePairsCount: favoritePairsCountStr,
              recentPairsCount: recentPairsCountStr,
              chatThreadCount: chatThreadCountStr,
              lessonsCompleted: lessonsCompletedStr,
              totalTradeDays: tradingMetrics.totalDays.toString(),
              totalTrades: totalTradesStr,
              telegramConnected: telegramConnectedStr,
              telegramVerified: telegramVerifiedStr,
              engagementLevel,
              experienceLevel: q1?.answer || '',
              tradesPerWeek: q2?.answer || '',
              traderType: q2?.traderType || '',
              priority,
              barrier,
              surveyStatus,
              surveyAnsweredCount: answeredCount,
              surveyCompletionDate,
              chatLastDate: chatMetrics.lastDate,
              chatUserMsgCount: chatMetrics.userMsgCount,
            };

            const bucket = buildBucket(partialRow);
            const scoreInput = {
              onboardingComplete: onboardingCompleteStr,
              surveyStatus,
              brokerConnected: brokerConnectedStr,
              chatThreadCount: chatThreadCountStr,
              lessonsCompleted: lessonsCompletedStr,
              recentPairsCount: recentPairsCountStr,
              favoritePairsCount: favoritePairsCountStr,
              telegramConnected: telegramConnectedStr,
            };
            const engagementScore = computeEngagementScore(scoreInput);
            const outreachSegment = computeOutreachSegment({ brokerConnected: brokerConnectedStr, priority, barrier, surveyStatus });
            const behavioralBucket = computeBehavioralBucket({
              brokerConnected: brokerConnectedStr,
              engagementLevel,
              activityStatus,
              surveyStatus,
              chatThreadCount: chatThreadCountStr,
              recentPairsCount: recentPairsCountStr,
              favoritePairsCount: favoritePairsCountStr,
            });

            const funnelInput = {
              totalTrades: totalTradesStr,
              brokerConnected: brokerConnectedStr,
              chatThreadCount: chatThreadCountStr,
              lessonsCompleted: lessonsCompletedStr,
              favoritePairsCount: favoritePairsCountStr,
              surveyStatus,
              onboardingComplete: onboardingCompleteStr,
            };
            const funnelStage = computeFunnelStage(funnelInput);
            const featureBreadthScore = computeFeatureBreadth({
              onboardingComplete: onboardingCompleteStr,
              surveyStatus,
              brokerConnected: brokerConnectedStr,
              chatThreadCount: chatThreadCountStr,
              lessonsCompleted: lessonsCompletedStr,
              telegramConnected: telegramConnectedStr,
            });
            const outreachPriority = computeOutreachPriority({
              engagementScore,
              activityStatus,
              surveyStatus,
              brokerConnected: brokerConnectedStr,
            });
            const nextBestAction = computeNextBestAction({
              engagementLevel,
              onboardingComplete: onboardingCompleteStr,
              surveyStatus,
              brokerConnected: brokerConnectedStr,
              totalTrades: totalTradesStr,
              activityStatus,
              chatThreadCount: chatThreadCountStr,
              lessonsCompleted: lessonsCompletedStr,
              favoritePairsCount: favoritePairsCountStr,
            });

            return {
              ...partialRow,
              bucket,
              daysSinceSignup: daysSince(createdAtStr),
              daysSinceActive: daysSince(lastActiveAtStr),
              engagementScore,
              featureBreadthScore,
              outreachSegment,
              behavioralBucket,
              funnelStage,
              outreachPriority,
              nextBestAction,
            } as UserRow;
          })
        );

        rows.push(...batchResults);
        await sendEvent(writer, 'progress', {
          phase: 'enrich',
          current: Math.min(i + BATCH_SIZE, allUsers.length),
          total: allUsers.length,
          message: `Enriching user data... ${Math.min(i + BATCH_SIZE, allUsers.length)} / ${allUsers.length}`,
        });
      }

      // ── Phase 3: Compute summary ──

      // Funnel counts
      const funnelCounts = Object.fromEntries(
        FUNNEL_STAGES.map((s) => [s, 0])
      ) as Record<FunnelStage, number>;
      for (const row of rows) funnelCounts[row.funnelStage]++;

      // Funnel conversions (sequential stage-over-stage rates)
      const funnelConversions: FunnelConversion[] = [];
      for (let i = 0; i < FUNNEL_STAGES.length - 1; i++) {
        const from = FUNNEL_STAGES[i];
        const to = FUNNEL_STAGES[i + 1];
        // Users who reached "to" or beyond (cumulative from top down)
        const fromCount = FUNNEL_STAGES.slice(i).reduce((sum, s) => sum + funnelCounts[s], 0);
        const toCount = FUNNEL_STAGES.slice(i + 1).reduce((sum, s) => sum + funnelCounts[s], 0);
        funnelConversions.push({
          from,
          to,
          rate: fromCount > 0 ? toCount / fromCount : 0,
        });
      }

      // Signup cohorts (last 12 weeks)
      const cohortMap = new Map<string, { total: number; activated: number }>();
      const ACTIVATED_STAGES: FunnelStage[] = ['exploring', 'broker-connected', 'trading'];
      for (const row of rows) {
        const week = isoWeek(row.createdAt);
        const existing = cohortMap.get(week) ?? { total: 0, activated: 0 };
        existing.total++;
        if (ACTIVATED_STAGES.includes(row.funnelStage)) existing.activated++;
        cohortMap.set(week, existing);
      }
      const signupCohorts: SignupCohort[] = Array.from(cohortMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([week, { total, activated }]) => ({
          week,
          total,
          activated,
          rate: total > 0 ? activated / total : 0,
        }));

      // Avg time to broker connection
      const brokerTimes = rows
        .filter((r) => r.brokerConnected === 'true' && r.brokerConnectionDate && r.createdAt)
        .map((r) => daysSince(r.createdAt) - daysSince(r.brokerConnectionDate));
      const avgTimeToBroker =
        brokerTimes.length > 0
          ? Math.round(brokerTimes.reduce((a, b) => a + b, 0) / brokerTimes.length)
          : null;

      // Survey drop-off
      const dropOffMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      for (const row of rows) dropOffMap[row.surveyAnsweredCount]++;
      const surveyDropOff: SurveyDropOff[] = [0, 1, 2, 3, 4].map((n) => ({
        answeredCount: n,
        userCount: dropOffMap[n] ?? 0,
      }));

      const summary: ReportSummary = {
        total: rows.length,
        engagement: {
          power: rows.filter((r) => r.engagementLevel === 'power').length,
          engaged: rows.filter((r) => r.engagementLevel === 'engaged').length,
          casual: rows.filter((r) => r.engagementLevel === 'casual').length,
          ghost: rows.filter((r) => r.engagementLevel === 'ghost').length,
        },
        activity: {
          active: rows.filter((r) => r.activityStatus === 'active').length,
          recent: rows.filter((r) => r.activityStatus === 'recent').length,
          lapsed: rows.filter((r) => r.activityStatus === 'lapsed').length,
          dormant: rows.filter((r) => r.activityStatus === 'dormant').length,
          never: rows.filter((r) => r.activityStatus === 'never').length,
        },
        survey: {
          complete: rows.filter((r) => r.surveyStatus === 'complete').length,
          incomplete: rows.filter((r) => r.surveyStatus === 'incomplete').length,
          'no-survey': rows.filter((r) => r.surveyStatus === 'no-survey').length,
        },
        adoption: {
          onboarded: rows.filter((r) => r.onboardingComplete === 'true').length,
          brokerConnected: rows.filter((r) => r.brokerConnected === 'true').length,
          hasTrades: rows.filter((r) => parseInt(r.totalTrades) > 0).length,
          hasChats: rows.filter((r) => parseInt(r.chatThreadCount) > 0).length,
          hasLessons: rows.filter((r) => parseInt(r.lessonsCompleted) > 0).length,
          telegramConnected: rows.filter((r) => r.telegramConnected === 'true').length,
        },
        topCountries: Object.entries(
          rows.reduce<Record<string, number>>((acc, r) => {
            const c = r.country || '(unknown)';
            acc[c] = (acc[c] || 0) + 1;
            return acc;
          }, {})
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([country, count]) => ({ country, count })),
        brokerTypes: Object.entries(
          rows.reduce<Record<string, number>>((acc, r) => {
            for (const t of r.brokerType.split('|').filter(Boolean)) {
              acc[t] = (acc[t] || 0) + 1;
            }
            return acc;
          }, {})
        )
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => ({ type, count })),
        buckets: Object.entries(
          rows
            .filter((r) => r.surveyStatus === 'complete')
            .reduce<Record<string, number>>((acc, r) => {
              acc[r.bucket] = (acc[r.bucket] || 0) + 1;
              return acc;
            }, {})
        )
          .sort((a, b) => b[1] - a[1])
          .map(([bucket, count]) => ({ bucket, count })),
        outreachSegments: Object.entries(
          rows.reduce<Record<string, number>>((acc, r) => {
            acc[r.outreachSegment] = (acc[r.outreachSegment] || 0) + 1;
            return acc;
          }, {})
        )
          .sort((a, b) => b[1] - a[1])
          .map(([segment, count]) => ({ segment: segment as import('@/app/user-reports/types').OutreachSegment, count })),
        behavioralBuckets: Object.entries(
          rows.reduce<Record<string, number>>((acc, r) => {
            acc[r.behavioralBucket] = (acc[r.behavioralBucket] || 0) + 1;
            return acc;
          }, {})
        )
          .sort((a, b) => b[1] - a[1])
          .map(([bucket, count]) => ({ bucket: bucket as import('@/app/user-reports/types').BehavioralBucket, count })),
        funnel: funnelCounts,
        funnelConversions,
        signupCohorts,
        avgTimeToBroker,
        surveyDropOff,
      };

      await sendEvent(writer, 'complete', { rows, summary });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      await sendEvent(writer, 'error', { message });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
