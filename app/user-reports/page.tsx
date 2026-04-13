'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/app/components/ToastContext';
import { SummaryCards } from './components/SummaryCards';
import { ActivityChart, BehavioralBucketChart, OutreachSegmentChart, SurveyDropOffChart, BrokerTypeChart, CountryChart, ChatActivityChart } from './components/Charts';
import { ActivationFunnelChart } from './components/FunnelChart';
import { OutreachQueue } from './components/OutreachQueue';
import { CohortChart } from './components/CohortChart';
import { ReportDataTable, FilterBar } from './components/ReportDataTable';
import { columns } from './components/columns';
import { downloadCSV } from './lib/csv';
import type { UserRow, ReportSummary, ProgressEvent, FunnelStage } from './types';

type Filters = {
  engagement: string;
  activity: string;
  survey: string;
  country: string;
  outreachSegment: string;
  behavioralBucket: string;
};

const DEFAULT_FILTERS: Filters = {
  engagement: 'all',
  activity: 'all',
  survey: 'all',
  country: 'all',
  outreachSegment: 'all',
  behavioralBucket: 'all',
};

export default function UserReportsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [outreachTab, setOutreachTab] = useState('⭐ Hot Leads');
  const [showDataExplorer, setShowDataExplorer] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const outreachRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const filteredRows = rows
    ? rows.filter((row) => {
        if (filters.engagement !== 'all' && row.engagementLevel !== filters.engagement) return false;
        if (filters.activity !== 'all' && row.activityStatus !== filters.activity) return false;
        if (filters.survey !== 'all' && row.surveyStatus !== filters.survey) return false;
        if (filters.country !== 'all' && row.country !== filters.country) return false;
        if (filters.outreachSegment !== 'all' && row.outreachSegment !== filters.outreachSegment) return false;
        if (filters.behavioralBucket !== 'all' && row.behavioralBucket !== filters.behavioralBucket) return false;
        return true;
      })
    : [];

  const generateReport = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setRows(null);
    setSummary(null);
    setProgress(null);
    setFilters(DEFAULT_FILTERS);
    setShowDataExplorer(false);

    try {
      const response = await fetch('/api/user-reports/generate', {
        method: 'POST',
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to start report generation');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const eventBlocks = buffer.split('\n\n');
        buffer = eventBlocks.pop() ?? '';

        for (const block of eventBlocks) {
          const lines = block.split('\n');
          let eventType = '';
          let dataLine = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: ')) dataLine = line.slice(6).trim();
          }
          if (!dataLine) continue;

          try {
            const payload = JSON.parse(dataLine);
            if (eventType === 'progress') {
              setProgress(payload as ProgressEvent);
            } else if (eventType === 'complete') {
              setRows(payload.rows);
              setSummary(payload.summary);
            } else if (eventType === 'error') {
              throw new Error(payload.message);
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Report generation failed';
      showToast(msg, 'error');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  }, [showToast]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Scroll outreach queue into view and set tab when a summary card is clicked
  const scrollToQueue = (tab?: string) => {
    if (tab) setOutreachTab(tab);
    setTimeout(() => {
      outreachRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const progressPct =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const ACTIVATED: FunnelStage[] = ['exploring', 'broker-connected', 'trading'];
  const needsOutreachRows = filteredRows.filter(
    (r) => r.outreachPriority > 70 && r.brokerConnected !== 'true'
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sales &amp; marketing action dashboard — activation funnel, lead scoring, outreach queue
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rows && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCSV(filteredRows)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV{filteredRows.length !== rows.length ? ` (${filteredRows.length})` : ''}
            </Button>
          )}
          <Button onClick={generateReport} disabled={isGenerating} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating...' : rows ? 'Regenerate' : 'Generate Report'}
          </Button>
        </div>
      </div>

      {/* Progress */}
      {isGenerating && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {progress?.message ?? 'Starting...'}
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {progress?.phase === 'enrich' && progress.total > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Enriching from Azure Tables: {progress.current} / {progress.total} users
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isGenerating && !rows && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No report generated yet
          </h2>
          <p className="text-sm text-gray-500 max-w-sm">
            Click &ldquo;Generate Report&rdquo; to fetch all Clerk users and enrich them with survey,
            onboarding, broker, and activity data.
          </p>
        </div>
      )}

      {/* Dashboard */}
      {rows && summary && (
        <div className="space-y-6">

          {/* 1. KPI Cards (8, 2 rows of 4) */}
          <SummaryCards
            summary={summary}
            filteredRows={filteredRows}
            totalRows={rows.length}
            onHotLeadsClick={() => scrollToQueue('⭐ Hot Leads')}
            onNeedsOutreachClick={() => {
              setFilters((f) => ({ ...f }));
              scrollToQueue('all');
            }}
            onDormantClick={() => scrollToQueue('💤 Dormant with Signal')}
          />

          {/* 2. Activation Funnel (full width) */}
          <ActivationFunnelChart summary={summary} />

          {/* 3. Global filter bar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm px-4">
            <FilterBar
              filters={filters}
              onChange={handleFilterChange}
              topCountries={summary.topCountries}
            />
          </div>

          {/* 4. Outreach Queue (primary sales interaction) */}
          <div ref={outreachRef}>
            <OutreachQueue
              rows={filteredRows}
              activeTab={outreachTab}
              onTabChange={setOutreachTab}
            />
          </div>

          {/* 5. Charts grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BehavioralBucketChart summary={summary} />
            <OutreachSegmentChart summary={summary} />
            <ActivityChart rows={filteredRows} />
            <SurveyDropOffChart summary={summary} />
            <CountryChart topCountries={summary.topCountries} />
            <BrokerTypeChart summary={summary} />
            <ChatActivityChart rows={filteredRows} />
          </div>

          {/* 6. Cohort heatmap (full width) */}
          <CohortChart cohorts={summary.signupCohorts} />

          {/* 7. Full Data Explorer (collapsible) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-lg transition-colors"
              onClick={() => setShowDataExplorer((v) => !v)}
            >
              <span>Full Data Explorer ({filteredRows.length} users)</span>
              {showDataExplorer ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showDataExplorer && (
              <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
                <ReportDataTable
                  columns={columns}
                  data={rows}
                  filters={filters}
                  topCountries={summary.topCountries}
                />
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
