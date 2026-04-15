'use client';

import * as React from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatAnalysis } from '../types';

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
}

function TagChip({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <TagChip key={i} label={item} color={color} />
        ))}
      </div>
    </div>
  );
}

const ENGAGEMENT_COLORS: Record<string, string> = {
  power:      'bg-purple-100 text-purple-700',
  moderate:   'bg-blue-100 text-blue-700',
  minimal:    'bg-gray-100 text-gray-600',
  'one-shot': 'bg-yellow-50 text-yellow-700',
};

const SOPHISTICATION_COLORS: Record<string, string> = {
  beginner:     'bg-orange-50 text-orange-700',
  intermediate: 'bg-teal-50 text-teal-700',
  advanced:     'bg-green-100 text-green-700',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive:   'bg-green-50 text-green-700',
  neutral:    'bg-gray-100 text-gray-600',
  frustrated: 'bg-red-100 text-red-700',
  confused:   'bg-yellow-50 text-yellow-700',
};

const CHURN_COLORS: Record<string, string> = {
  low:    'bg-green-50 text-green-700',
  medium: 'bg-yellow-50 text-yellow-700',
  high:   'bg-red-100 text-red-700',
};

const BROKER_READINESS_COLORS: Record<string, string> = {
  'not-started': 'bg-gray-100 text-gray-500',
  exploring:     'bg-blue-50 text-blue-600',
  ready:         'bg-orange-50 text-orange-700',
  connected:     'bg-green-100 text-green-700',
};

const AGENT_COLORS: Record<string, string> = {
  news:        'bg-sky-50 text-sky-700',
  fundamental: 'bg-indigo-50 text-indigo-700',
  chart:       'bg-violet-50 text-violet-700',
  strategy:    'bg-pink-50 text-pink-700',
};

export function ChatAnalysisPanel({ userId, userName, onClose }: Props) {
  const [analysis, setAnalysis] = React.useState<ChatAnalysis | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/user-reports/chat-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then((r) => r.json())
      .then((data: ChatAnalysis & { error?: string; message?: string }) => {
        if (cancelled) return;
        if (data.error === 'no-chats') {
          setError('This user has no chat messages to analyze.');
        } else if (data.error) {
          setError(data.message || 'Analysis failed. Please try again.');
        } else {
          setAnalysis(data);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to connect to analysis service.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId]);

  return (
    /* Slide-over backdrop */
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative w-full max-w-md h-full bg-white dark:bg-gray-900 shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Chat Analysis</h2>
            <p className="text-xs text-gray-400 mt-0.5">{userName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Analyzing chat history with AI...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {analysis && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Summary</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.summary}</p>
              </div>

              {/* Status badges row 1 */}
              <div className="flex flex-wrap gap-3">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Engagement</span>
                  <TagChip
                    label={analysis.engagementPattern.replace('-', ' ')}
                    color={ENGAGEMENT_COLORS[analysis.engagementPattern] ?? 'bg-gray-100 text-gray-600'}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Sophistication</span>
                  <TagChip
                    label={analysis.sophisticationLevel}
                    color={SOPHISTICATION_COLORS[analysis.sophisticationLevel] ?? 'bg-gray-100 text-gray-600'}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Sentiment</span>
                  <TagChip
                    label={analysis.sentimentSignal ?? 'neutral'}
                    color={SENTIMENT_COLORS[analysis.sentimentSignal ?? 'neutral'] ?? 'bg-gray-100 text-gray-600'}
                  />
                </div>
              </div>

              {/* Status badges row 2 */}
              <div className="flex flex-wrap gap-3">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Churn Risk</span>
                  <TagChip
                    label={analysis.churnRisk ?? 'low'}
                    color={CHURN_COLORS[analysis.churnRisk ?? 'low'] ?? 'bg-gray-100 text-gray-600'}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Broker Readiness</span>
                  <TagChip
                    label={(analysis.brokerReadiness ?? 'not-started').replace('-', ' ')}
                    color={BROKER_READINESS_COLORS[analysis.brokerReadiness ?? 'not-started'] ?? 'bg-gray-100 text-gray-600'}
                  />
                </div>
              </div>

              {/* Agents Used */}
              {analysis.agentsUsed && analysis.agentsUsed.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Agents Used</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.agentsUsed.map((agent, i) => (
                      <TagChip
                        key={i}
                        label={agent}
                        color={AGENT_COLORS[agent] ?? 'bg-gray-100 text-gray-600'}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Topic breakdown */}
              {analysis.topicCategories && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Topic Breakdown</p>
                  <div className="space-y-1.5">
                    {(Object.entries(analysis.topicCategories) as [string, number][])
                      .filter(([, v]) => v > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([key, value]) => (
                        <div key={key}>
                          <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span>{value}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${value}%` }} />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <Section title="Top Topics" items={analysis.topTopics} color="bg-blue-50 text-blue-700" />
              <Section title="Pain Points" items={analysis.painPoints} color="bg-red-50 text-red-700" />
              <Section title="Feature Requests" items={analysis.featureRequests} color="bg-purple-50 text-purple-700" />
              <Section title="Trading Interests" items={analysis.tradingInterests} color="bg-green-50 text-green-700" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
