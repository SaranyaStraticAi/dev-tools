import { NextRequest, NextResponse } from 'next/server';
import { TableClient } from '@azure/data-tables';
import { createAzure } from '@ai-sdk/azure';
import { generateText } from 'ai';
import type { ChatAnalysis } from '@/app/user-reports/types';

interface ThreadEntity {
  threadId?: string;
  title?: string;
  createdAt?: string;
}

interface MessageEntity {
  role?: string;
  content?: string;
  timestamp?: string;
}

function getTableClients() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured');
  return {
    threads: TableClient.fromConnectionString(connectionString, 'UserThreads'),
    messages: TableClient.fromConnectionString(connectionString, 'ThreadMessages'),
  };
}

function getAzureModel() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

  if (!apiKey || !resourceName) throw new Error('Azure OpenAI credentials not configured');

  // In AI SDK 6, azure() uses the Responses API by default.
  // Must use .chat() to target the Chat Completions API which all Azure deployments support.
  const baseURL = `https://${resourceName}.cognitiveservices.azure.com/openai`;
  const azure = createAzure({ baseURL, apiKey, apiVersion, useDeploymentBasedUrls: true });
  return azure.chat(deployment);
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json() as { userId?: string };
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const tables = getTableClients();

    // Fetch all threads for this user
    const threads: Array<{ threadId: string; title: string; createdAt: string }> = [];
    const threadEntities = tables.threads.listEntities<ThreadEntity>({
      queryOptions: { filter: `PartitionKey eq '${userId}'` },
    });
    for await (const entity of threadEntities) {
      if (entity.threadId) {
        threads.push({
          threadId: entity.threadId,
          title: entity.title || 'Untitled',
          createdAt: entity.createdAt || '',
        });
      }
    }

    if (threads.length === 0) {
      return NextResponse.json({ error: 'no-chats' });
    }

    // Sort threads by createdAt desc, take 10 most recent
    const recentThreads = threads
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);

    // Fetch user messages from each thread
    const allUserMessages: Array<{ threadTitle: string; date: string; content: string }> = [];

    await Promise.all(
      recentThreads.map(async (thread) => {
        const msgEntities = tables.messages.listEntities<MessageEntity>({
          queryOptions: { filter: `PartitionKey eq '${thread.threadId}'` },
        });
        for await (const msg of msgEntities) {
          if (msg.role === 'user' && msg.content) {
            allUserMessages.push({
              threadTitle: thread.title,
              date: msg.timestamp || thread.createdAt,
              content: msg.content,
            });
          }
        }
      })
    );

    if (allUserMessages.length === 0) {
      return NextResponse.json({ error: 'no-chats' });
    }

    // Sort by date, cap at 50 messages
    const sortedMessages = allUserMessages
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-50);

    const messagesText = sortedMessages
      .map((m) => {
        const dateStr = m.date ? new Date(m.date).toLocaleDateString() : '';
        return `[${m.threadTitle}${dateStr ? ` · ${dateStr}` : ''}] ${m.content}`;
      })
      .join('\n');

    const prompt = `Analyze these AI trading assistant chat messages from a single user.
Return ONLY a valid JSON object with exactly these fields:
{
  "topTopics": ["topic1", "topic2"],
  "painPoints": ["pain1", "pain2"],
  "featureRequests": ["req1", "req2"],
  "tradingInterests": ["pair1", "pair2"],
  "engagementPattern": "power",
  "sophisticationLevel": "intermediate",
  "summary": "2-3 sentence summary"
}

Rules:
- topTopics: max 5 main topics they asked about (e.g. "EUR/USD analysis", "risk management", "broker setup")
- painPoints: frustrations, confusion, or barriers mentioned (empty array if none)
- featureRequests: features they wanted or wished existed (empty array if none)
- tradingInterests: instruments, pairs, or markets they discussed (empty array if none)
- engagementPattern: one of "power" (10+ msgs, recurring), "moderate" (5-10 msgs), "minimal" (2-4 msgs), "one-shot" (1 session)
- sophisticationLevel: one of "beginner", "intermediate", "advanced" based on terminology and questions
- summary: 2-3 sentences about what this user wants from the platform and their journey

User messages (chronological):
---
${messagesText}`;

    const model = getAzureModel();
    const { text } = await generateText({
      model,
      system: 'You are an analyst summarizing user chat behavior for a sales team. Return only valid JSON.',
      prompt,
      temperature: 0.2,
      maxOutputTokens: 1000,
    });

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'analysis-failed', message: 'Invalid LLM response format' }, { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]) as ChatAnalysis;
    return NextResponse.json(analysis);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'analysis-failed', message }, { status: 500 });
  }
}
