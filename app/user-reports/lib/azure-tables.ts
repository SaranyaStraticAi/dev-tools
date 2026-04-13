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
): Promise<{ connected: boolean; types: string[] }> {
  try {
    const connected: string[] = [];
    const entities = brokerTable.listEntities<BrokerConnectionEntity>({
      queryOptions: { filter: `PartitionKey eq '${userId}'` },
    });
    for await (const entity of entities) {
      if (entity.connected) connected.push(entity.rowKey);
    }
    return { connected: connected.length > 0, types: connected };
  } catch {
    return { connected: false, types: [] };
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

export function initTableClients(connectionString: string) {
  return {
    survey: TableClient.fromConnectionString(connectionString, 'SurveyResponses'),
    onboarding: TableClient.fromConnectionString(connectionString, 'OnboardingState'),
    broker: TableClient.fromConnectionString(connectionString, 'UserBrokerConnections'),
    prefs: TableClient.fromConnectionString(connectionString, 'UserPreferences'),
    threads: TableClient.fromConnectionString(connectionString, 'UserThreads'),
    lessons: TableClient.fromConnectionString(connectionString, 'UserLessonProgress'),
    metrics: TableClient.fromConnectionString(connectionString, 'TradingFrequencyMetrics'),
    telegram: TableClient.fromConnectionString(connectionString, 'TelegramNotifications'),
  };
}

export type { OnboardingStateEntity, UserPreferencesEntity, TelegramEntity };
