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
  metadata?: string; // JSON string: { agentKey, agentName, ... }
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
  const baseURL = `https://${resourceName}.cognitiveservices.azure.com/openai`;
  const azure = createAzure({ baseURL, apiKey, apiVersion, useDeploymentBasedUrls: true });
  return azure.chat(deployment);
}

function parseAgentKey(metadata?: string): string {
  if (!metadata) return 'unknown';
  try {
    const parsed = JSON.parse(metadata) as { agentKey?: string; agentName?: string };
    return parsed.agentKey || parsed.agentName || 'unknown';
  } catch {
    return 'unknown';
  }
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

    // Fetch all messages (user + assistant) to capture agentKey from assistant messages
    const allUserMessages: Array<{
      threadTitle: string;
      date: string;
      content: string;
      agentKey: string;
    }> = [];

    await Promise.all(
      recentThreads.map(async (thread) => {
        const msgEntities = tables.messages.listEntities<MessageEntity>({
          queryOptions: { filter: `PartitionKey eq '${thread.threadId}'` },
        });

        // Track current agent within this thread (set by assistant messages)
        let currentAgent = 'unknown';
        const threadMsgs: Array<{ role: string; content: string; date: string; metadata?: string }> = [];

        for await (const msg of msgEntities) {
          if (msg.role && msg.content) {
            threadMsgs.push({
              role: msg.role,
              content: msg.content,
              date: msg.timestamp || thread.createdAt,
              metadata: msg.metadata,
            });
          }
        }

        // Sort by timestamp to correctly pair agent with user message
        threadMsgs.sort((a, b) => a.date.localeCompare(b.date));

        for (const msg of threadMsgs) {
          if (msg.role === 'assistant' && msg.metadata) {
            currentAgent = parseAgentKey(msg.metadata);
          }
          if (msg.role === 'user') {
            allUserMessages.push({
              threadTitle: thread.title,
              date: msg.date,
              content: msg.content,
              agentKey: currentAgent,
            });
          }
        }
      })
    );

    if (allUserMessages.length === 0) {
      return NextResponse.json({ error: 'no-chats' });
    }

    // Sort by date, cap at 50 most recent
    const sortedMessages = allUserMessages
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-50);

    // Collect unique agents used
    const agentsUsed = [...new Set(sortedMessages.map((m) => m.agentKey).filter((a) => a !== 'unknown'))];

    const messagesText = sortedMessages
      .map((m) => {
        const dateStr = m.date ? new Date(m.date).toLocaleDateString() : '';
        const agentTag = m.agentKey !== 'unknown' ? ` | agent:${m.agentKey}` : '';
        return `[${m.threadTitle}${dateStr ? ` · ${dateStr}` : ''}${agentTag}] ${m.content}`;
      })
      .join('\n');

    const agentContext = agentsUsed.length > 0
      ? `Agents this user has interacted with: ${agentsUsed.join(', ')}.`
      : '';

    const prompt = `You are a sales analyst for VibeTrader — an AI-powered forex trading assistant.
Analyze these user chat messages and return ONLY valid JSON with no markdown or extra text.

Context: VibeTrader has multiple AI agents — "fundamental" (macro/news analysis), "news" (live news feed),
"chart" (technical analysis), "strategy" (strategy builder), and others. Users ask about forex pair
analysis (EUR/USD, XAU/USD etc.), ICT/SMC/RSI strategies, broker setup (MetaAPI, MT4/MT5),
risk management, and platform features. Each message is tagged with [threadTitle · date | agent:agentKey].
${agentContext}

Return this exact JSON:
{
  "topTopics": ["topic1", "topic2"],
  "topicCategories": {
    "marketAnalysis": 40,
    "strategyLearning": 30,
    "platformHelp": 20,
    "riskManagement": 5,
    "newsAndFundamentals": 5
  },
  "painPoints": ["pain1"],
  "featureRequests": ["req1"],
  "tradingInterests": ["XAUUSD", "EURUSD"],
  "agentsUsed": ["news", "fundamental"],
  "engagementPattern": "power",
  "sophisticationLevel": "intermediate",
  "sentimentSignal": "positive",
  "churnRisk": "low",
  "brokerReadiness": "exploring",
  "summary": "2-3 sentence summary"
}

Field rules:
- topTopics: max 5, be specific — "XAU/USD breakout analysis" not "gold"
- topicCategories: % breakdown summing to ~100, newsAndFundamentals covers news agent + macro questions
- painPoints: specific frustrations, errors, confusion signals — [] if none found
- featureRequests: things they wished existed or asked "can you do X" — [] if none
- tradingInterests: instruments/pairs/markets mentioned (use standard symbols)
- agentsUsed: which VibeTrader agents this user actually used (from agent: tags in messages)
- engagementPattern: "power" (10+ msgs recurring) | "moderate" (5-10) | "minimal" (2-4) | "one-shot" (1 session)
- sophisticationLevel: "beginner" | "intermediate" | "advanced" — based on terminology used
- sentimentSignal: "positive" | "neutral" | "frustrated" | "confused" — overall tone
- churnRisk: "low" | "medium" | "high" — high if frustration/long gaps/dropoff pattern
- brokerReadiness: "not-started" | "exploring" | "ready" | "connected" — how close to live trading
- summary: what this user wants, where they are stuck, what would convert them

User messages (chronological):
---
${messagesText}`;

    const model = getAzureModel();
    const { text } = await generateText({
      model,
      system: 'You are a sales analyst. Return only valid JSON, no markdown code blocks.',
      prompt,
      temperature: 0.2,
      maxOutputTokens: 1000,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'analysis-failed', message: 'Invalid LLM response format' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as ChatAnalysis;

    // Merge server-detected agentsUsed with LLM-detected (LLM may catch agent names from message content too)
    const mergedAgents = [...new Set([...agentsUsed, ...(parsed.agentsUsed ?? [])])];
    parsed.agentsUsed = mergedAgents;

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'analysis-failed', message }, { status: 500 });
  }
}
