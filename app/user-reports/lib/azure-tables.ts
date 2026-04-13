import { TableClient } from '@azure/data-tables';
import type {
  SurveyResponseEntity,
  OnboardingStateEntity,
  BrokerConnectionEntity,
  UserPreferencesEntity,
  LessonProgressEntity,
  TradingFrequencyEntity,
  TelegramEntity,
} from '../types';

const QUESTION_KEYS = ['q1', 'q2', 'q3', 'q4'] as const;

export async function pointQuery<T extends object>(
  table: TableClient,
  partitionKey: string,
  rowKey: string
): Promise<T | null> {
  try {
    return await table.getEntity<T>(partitionKey, rowKey);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'statusCode' in err &&
      (err as { statusCode: number }).statusCode === 404
    ) {
      return null;
    }
    return null;
  }
}

export async function countPartition(table: TableClient, userId: string): Promise<number> {
  try {
    let count = 0;
    const entities = table.listEntities({ queryOptions: { filter: `PartitionKey eq '${userId}'` } });
    for await (const _ of entities) count++;
    return count;
  } catch {
    return 0;
  }
}

export async function fetchSurveyForUser(
  surveyTable: TableClient,
  userId: string
): Promise<Record<string, SurveyResponseEntity>> {
  const results = await Promise.all(
    QUESTION_KEYS.map(async (key) => {
      const entity = await pointQuery<SurveyResponseEntity>(surveyTable, userId, key);
      return entity ? { key, entity } : null;
    })
  );
  const dict: Record<string, SurveyResponseEntity> = {};
  for (const result of results) {
    if (result) dict[result.key] = result.entity;
  }
  return dict;
}

export async function fetchBrokerInfo(
  brokerTable: TableClient,
  userId: string
): Promise<{ connected: boolean; types: string[]; firstConnectionDate: string | null }> {
  try {
    const connected: string[] = [];
    let firstConnectionDate: string | null = null;
    const entities = brokerTable.listEntities<BrokerConnectionEntity>({
      queryOptions: { filter: `PartitionKey eq '${userId}'` },
    });
    for await (const entity of entities) {
      if (entity.connected) {
        connected.push(entity.rowKey);
        // Track earliest connection date across all connected brokers
        if (entity.lastUpdated) {
          if (!firstConnectionDate || entity.lastUpdated < firstConnectionDate) {
            firstConnectionDate = entity.lastUpdated;
          }
        }
      }
    }
    return { connected: connected.length > 0, types: connected, firstConnectionDate };
  } catch {
    return { connected: false, types: [], firstConnectionDate: null };
  }
}

export async function fetchTradingMetrics(
  metricsTable: TableClient,
  userId: string
): Promise<{ totalDays: number; totalTrades: number }> {
  try {
    let totalDays = 0;
    let totalTrades = 0;
    const entities = metricsTable.listEntities<TradingFrequencyEntity>({
      queryOptions: { filter: `PartitionKey eq '${userId}'` },
    });
    for await (const entity of entities) {
      totalDays++;
      totalTrades += entity.tradesCount ?? 0;
    }
    return { totalDays, totalTrades };
  } catch {
    return { totalDays: 0, totalTrades: 0 };
  }
}

export async function fetchLessonsCompleted(
  lessonTable: TableClient,
  userId: string
): Promise<number> {
  try {
    let completed = 0;
    const entities = lessonTable.listEntities<LessonProgressEntity>({
      queryOptions: { filter: `PartitionKey eq '${userId}'` },
    });
    for await (const entity of entities) {
      if (entity.completedAt) completed++;
    }
    return completed;
  } catch {
    return 0;
  }
}

export async function fetchChatMetrics(
  threadsTable: TableClient,
  messagesTable: TableClient,
  userId: string
): Promise<{ threadCount: number; lastDate: string; userMsgCount: number; threadIds: string[] }> {
  try {
    const threadIds: string[] = [];
    let lastDate = '';

    const threadEntities = threadsTable.listEntities<{ threadId?: string; createdAt?: string }>({
      queryOptions: { filter: `PartitionKey eq '${userId}'` },
    });

    for await (const entity of threadEntities) {
      if (entity.threadId) {
        threadIds.push(entity.threadId);
        const created = (entity as { createdAt?: string }).createdAt || '';
        if (created && (!lastDate || created > lastDate)) {
          lastDate = created;
        }
      }
    }

    // Count user messages across threads (cap at 10 most recent threads for perf)
    const recentThreadIds = threadIds.slice(0, 10);
    let userMsgCount = 0;
    await Promise.all(
      recentThreadIds.map(async (threadId) => {
        const msgEntities = messagesTable.listEntities<{ role?: string }>({
          queryOptions: { filter: `PartitionKey eq '${threadId}'` },
        });
        for await (const msg of msgEntities) {
          if (msg.role === 'user') userMsgCount++;
        }
      })
    );

    return { threadCount: threadIds.length, lastDate, userMsgCount, threadIds };
  } catch {
    return { threadCount: 0, lastDate: '', userMsgCount: 0, threadIds: [] };
  }
}

export function initTableClients(connectionString: string) {
  return {
    survey: TableClient.fromConnectionString(connectionString, 'SurveyResponses'),
    onboarding: TableClient.fromConnectionString(connectionString, 'OnboardingState'),
    broker: TableClient.fromConnectionString(connectionString, 'UserBrokerConnections'),
    prefs: TableClient.fromConnectionString(connectionString, 'UserPreferences'),
    threads: TableClient.fromConnectionString(connectionString, 'UserThreads'),
    messages: TableClient.fromConnectionString(connectionString, 'ThreadMessages'),
    lessons: TableClient.fromConnectionString(connectionString, 'UserLessonProgress'),
    metrics: TableClient.fromConnectionString(connectionString, 'TradingFrequencyMetrics'),
    telegram: TableClient.fromConnectionString(connectionString, 'TelegramNotifications'),
  };
}

export type { OnboardingStateEntity, UserPreferencesEntity, TelegramEntity };
