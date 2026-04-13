'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UserRow, ActivityStatus, EngagementLevel, SurveyStatus, OutreachSegment, BehavioralBucket, FunnelStage } from '../types';

function ActivityBadge({ status }: { status: ActivityStatus }) {
  const variants: Record<ActivityStatus, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    recent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    lapsed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    dormant: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    never: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 capitalize ${variants[status]}`}>
      {status}
    </Badge>
  );
}

function EngagementBadge({ level }: { level: EngagementLevel }) {
  const variants: Record<EngagementLevel, string> = {
    power: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    engaged: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    casual: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    ghost: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 capitalize ${variants[level]}`}>
      {level}
    </Badge>
  );
}

function SurveyBadge({ status }: { status: SurveyStatus }) {
  const variants: Record<SurveyStatus, string> = {
    complete: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    incomplete: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    'no-survey': 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${variants[status]}`}>
      {status}
    </Badge>
  );
}

function FunnelBadge({ stage }: { stage: FunnelStage }) {
  const map: Record<FunnelStage, { label: string; cls: string }> = {
    'signed-up':        { label: 'Signed Up',  cls: 'bg-gray-100 text-gray-600' },
    onboarded:          { label: 'Onboarded',  cls: 'bg-blue-50 text-blue-600' },
    surveyed:           { label: 'Surveyed',   cls: 'bg-indigo-50 text-indigo-600' },
    exploring:          { label: 'Exploring',  cls: 'bg-teal-50 text-teal-600' },
    'broker-connected': { label: 'Broker',     cls: 'bg-purple-100 text-purple-700' },
    trading:            { label: 'Trading',    cls: 'bg-green-100 text-green-700' },
  };
  const { label, cls } = map[stage];
  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${cls}`}>{label}</Badge>
  );
}

function FeatureBreadthBar({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-3 rounded-sm ${i < score ? 'bg-blue-400' : 'bg-gray-200 dark:bg-gray-600'}`}
        />
      ))}
    </div>
  );
}

export const columns: ColumnDef<UserRow>[] = [
  {
    id: 'user',
    accessorFn: (row) => `${row.firstName} ${row.lastName} ${row.email}`,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        User
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const { firstName, lastName, email } = row.original;
      const name = [firstName, lastName].filter(Boolean).join(' ') || 'Anonymous';
      const initials = name !== 'Anonymous'
        ? name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
        : email.substring(0, 2).toUpperCase();
      return (
        <div className="flex items-center gap-3 min-w-[180px]">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-200">
            {initials}
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{name}</span>
            <span className="text-xs text-gray-500">{email}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'country',
    header: 'Country',
    cell: ({ row }) => (
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {row.getValue('country') || <span className="text-gray-400">—</span>}
      </span>
    ),
  },
  {
    accessorKey: 'funnelStage',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Stage
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <FunnelBadge stage={row.getValue('funnelStage')} />,
  },
  {
    accessorKey: 'outreachPriority',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Priority
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const score = row.getValue('outreachPriority') as number;
      const color = score >= 70 ? 'text-red-600 font-bold' : score >= 40 ? 'text-yellow-600 font-semibold' : 'text-green-600';
      return <span className={`text-sm tabular-nums ${color}`}>{score}</span>;
    },
    sortingFn: (a, b) => (a.getValue('outreachPriority') as number) - (b.getValue('outreachPriority') as number),
  },
  {
    accessorKey: 'nextBestAction',
    header: 'Next Action',
    cell: ({ row }) => {
      const action = row.getValue('nextBestAction') as string;
      const colorMap: Record<string, string> = {
        'Upsell / referral ask': 'bg-purple-100 text-purple-700',
        'Send first trade guide': 'bg-blue-100 text-blue-700',
        'Re-engage — broker connected but dormant': 'bg-orange-100 text-orange-700',
        'Send activation email': 'bg-gray-100 text-gray-600',
        'Schedule broker setup call': 'bg-green-100 text-green-700',
        'Re-engagement campaign': 'bg-yellow-100 text-yellow-700',
        'Request survey completion': 'bg-teal-100 text-teal-700',
        'Nurture — keep warm': 'bg-gray-100 text-gray-500',
      };
      const cls = colorMap[action] ?? 'bg-gray-100 text-gray-600';
      return <span className={`text-[10px] rounded px-2 py-0.5 font-medium ${cls}`}>{action}</span>;
    },
  },
  {
    accessorKey: 'activityStatus',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Activity
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <ActivityBadge status={row.getValue('activityStatus')} />,
  },
  {
    accessorKey: 'engagementLevel',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Engagement
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <EngagementBadge level={row.getValue('engagementLevel')} />,
  },
  {
    accessorKey: 'featureBreadthScore',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Features
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <FeatureBreadthBar score={row.getValue('featureBreadthScore')} />,
    sortingFn: (a, b) => (a.getValue('featureBreadthScore') as number) - (b.getValue('featureBreadthScore') as number),
  },
  {
    accessorKey: 'brokerConnected',
    header: 'Broker',
    cell: ({ row }) => {
      const connected = row.getValue('brokerConnected') === 'true';
      return connected ? (
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
          Connected
        </Badge>
      ) : (
        <span className="text-gray-400 text-xs">—</span>
      );
    },
  },
  {
    accessorKey: 'totalTrades',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Trades
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const val = row.getValue('totalTrades') as string;
      return <span className="text-sm tabular-nums">{parseInt(val) || '—'}</span>;
    },
    sortingFn: (a, b) => parseInt(a.getValue('totalTrades')) - parseInt(b.getValue('totalTrades')),
  },
  {
    accessorKey: 'chatThreadCount',
    header: 'AI Chats',
    cell: ({ row }) => {
      const val = row.getValue('chatThreadCount') as string;
      return <span className="text-sm tabular-nums">{parseInt(val) || '—'}</span>;
    },
  },
  {
    accessorKey: 'chatUserMsgCount',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Chat Msgs
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const count = row.getValue('chatUserMsgCount') as number;
      return <span className="text-sm tabular-nums">{count > 0 ? count : '—'}</span>;
    },
    sortingFn: (a, b) => (a.getValue('chatUserMsgCount') as number) - (b.getValue('chatUserMsgCount') as number),
  },
  {
    accessorKey: 'chatLastDate',
    header: 'Last Chat',
    cell: ({ row }) => {
      const date = row.getValue('chatLastDate') as string;
      if (!date) return <span className="text-gray-400 text-xs">—</span>;
      const d = new Date(date);
      return <span className="text-sm text-gray-500">{d.toLocaleDateString()}</span>;
    },
  },
  {
    accessorKey: 'lessonsCompleted',
    header: 'Lessons',
    cell: ({ row }) => {
      const val = row.getValue('lessonsCompleted') as string;
      return <span className="text-sm tabular-nums">{parseInt(val) || '—'}</span>;
    },
  },
  {
    accessorKey: 'surveyStatus',
    header: 'Survey',
    cell: ({ row }) => <SurveyBadge status={row.getValue('surveyStatus')} />,
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Joined
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-gray-500">{row.getValue('createdAt') || '—'}</span>
    ),
  },
  {
    accessorKey: 'lastActiveAt',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Last Active
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-gray-500">{row.getValue('lastActiveAt') || '—'}</span>
    ),
  },
  {
    accessorKey: 'engagementScore',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Score
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const score = row.getValue('engagementScore') as number;
      const color = score >= 30 ? 'text-purple-600' : score >= 15 ? 'text-blue-600' : 'text-gray-500';
      return <span className={`text-sm font-semibold tabular-nums ${color}`}>{score}</span>;
    },
    sortingFn: (a, b) => (a.getValue('engagementScore') as number) - (b.getValue('engagementScore') as number),
  },
  {
    accessorKey: 'outreachSegment',
    header: 'Outreach Segment',
    cell: ({ row }) => {
      const seg = row.getValue('outreachSegment') as OutreachSegment;
      const colorMap: Record<OutreachSegment, string> = {
        'Broker-Connected (Power User)': 'bg-purple-100 text-purple-700',
        'High-Intent: Simplicity Seekers': 'bg-blue-100 text-blue-700',
        'High-Intent: Time-Savers': 'bg-indigo-100 text-indigo-700',
        'Risk-Conscious: Safety First': 'bg-orange-100 text-orange-700',
        'Education-Focused': 'bg-teal-100 text-teal-700',
        'Automation Hunters': 'bg-yellow-100 text-yellow-700',
        'General Interest': 'bg-gray-100 text-gray-500',
      };
      return (
        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${colorMap[seg]}`}>
          {seg}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'behavioralBucket',
    header: 'Behavior',
    cell: ({ row }) => {
      const bucket = row.getValue('behavioralBucket') as BehavioralBucket;
      const colorMap: Record<BehavioralBucket, string> = {
        '🔌 Power Users': 'bg-purple-100 text-purple-700',
        '⭐ Hot Leads': 'bg-yellow-100 text-yellow-700',
        '🎯 Warm Unsurveyed': 'bg-blue-100 text-blue-700',
        '💤 Dormant with Signal': 'bg-orange-100 text-orange-700',
        '📋 Needs Qualification': 'bg-gray-100 text-gray-600',
        '👻 Ghost Accounts': 'bg-gray-50 text-gray-400',
      };
      return (
        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${colorMap[bucket]}`}>
          {bucket}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'daysSinceActive',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Inactive (days)
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const days = row.getValue('daysSinceActive') as number;
      const color = days <= 7 ? 'text-green-600' : days <= 30 ? 'text-blue-600' : days <= 90 ? 'text-yellow-600' : 'text-red-500';
      return <span className={`text-sm tabular-nums ${color}`}>{days}d</span>;
    },
    sortingFn: (a, b) => (a.getValue('daysSinceActive') as number) - (b.getValue('daysSinceActive') as number),
  },
  // Hidden by default
  {
    accessorKey: 'bucket',
    header: 'Bucket',
    cell: ({ row }) => (
      <span className="text-xs text-gray-500 font-mono">{row.getValue('bucket')}</span>
    ),
  },
  {
    accessorKey: 'experienceLevel',
    header: 'Experience',
    cell: ({ row }) => (
      <span className="text-sm capitalize">{row.getValue('experienceLevel') || '—'}</span>
    ),
  },
  {
    accessorKey: 'telegramConnected',
    header: 'Telegram',
    cell: ({ row }) => {
      const connected = row.getValue('telegramConnected') === 'true';
      return connected ? (
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-sky-100 text-sky-700">
          Yes
        </Badge>
      ) : (
        <span className="text-gray-400 text-xs">—</span>
      );
    },
  },
  {
    accessorKey: 'onboardingCurrentStep',
    header: 'Onboarding Step',
    cell: ({ row }) => (
      <span className="text-xs text-gray-500 font-mono">{row.getValue('onboardingCurrentStep') || '—'}</span>
    ),
  },
  {
    accessorKey: 'clerkId',
    header: 'Clerk ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-gray-400 truncate max-w-[140px] inline-block" title={row.getValue('clerkId')}>
        {row.getValue('clerkId')}
      </span>
    ),
  },
];
