'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download } from 'lucide-react';
import { downloadCSV } from '../lib/csv';
import type { UserRow, ActivityStatus, EngagementLevel, SurveyStatus, OutreachSegment, BehavioralBucket } from '../types';

interface ReportDataTableProps {
  columns: ColumnDef<UserRow, unknown>[];
  data: UserRow[];
  filters: {
    engagement: string;
    activity: string;
    survey: string;
    country: string;
    outreachSegment: string;
    behavioralBucket: string;
  };
  topCountries: Array<{ country: string; count: number }>;
}

// Hidden columns by default (too detailed for the default view)
const DEFAULT_HIDDEN: VisibilityState = {
  bucket: false,
  experienceLevel: false,
  telegramConnected: false,
  onboardingCurrentStep: false,
  clerkId: false,
};

export function ReportDataTable({ columns, data, filters, topCountries }: ReportDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(DEFAULT_HIDDEN);
  const [globalFilter, setGlobalFilter] = React.useState('');

  // Apply parent-controlled dimension filters to the data before passing to the table
  const filteredData = React.useMemo(() => {
    return data.filter((row) => {
      if (filters.engagement !== 'all' && row.engagementLevel !== filters.engagement) return false;
      if (filters.activity !== 'all' && row.activityStatus !== filters.activity) return false;
      if (filters.survey !== 'all' && row.surveyStatus !== filters.survey) return false;
      if (filters.country !== 'all' && row.country !== filters.country) return false;
      if (filters.outreachSegment !== 'all' && row.outreachSegment !== filters.outreachSegment) return false;
      if (filters.behavioralBucket !== 'all' && row.behavioralBucket !== filters.behavioralBucket) return false;
      return true;
    });
  }, [data, filters]);

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-3 py-4">
        <Input
          placeholder="Search name, email..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="text-sm text-gray-500">
            {table.getFilteredRowModel().rows.length} of {data.length} users
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCSV(filteredData)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800">
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    className="capitalize"
                    checked={col.getIsVisible()}
                    onCheckedChange={(value) => col.toggleVisibility(!!value)}
                  >
                    {col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-md shadow-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-gray-500">
                  No users match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Rows per page</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(val) => table.setPageSize(Number(val))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

const OUTREACH_SEGMENTS: OutreachSegment[] = [
  'Broker-Connected (Power User)',
  'High-Intent: Simplicity Seekers',
  'High-Intent: Time-Savers',
  'Risk-Conscious: Safety First',
  'Education-Focused',
  'Automation Hunters',
  'General Interest',
];

const BEHAVIORAL_BUCKETS: BehavioralBucket[] = [
  '🔌 Power Users',
  '⭐ Hot Leads',
  '🎯 Warm Unsurveyed',
  '💤 Dormant with Signal',
  '📋 Needs Qualification',
  '👻 Ghost Accounts',
];

// Filter bar — separate export so it can sit above the table
export function FilterBar({
  filters,
  onChange,
  topCountries,
}: {
  filters: { engagement: string; activity: string; survey: string; country: string; outreachSegment: string; behavioralBucket: string };
  onChange: (key: string, value: string) => void;
  topCountries: Array<{ country: string; count: number }>;
}) {
  const isFiltered = Object.values(filters).some((v) => v !== 'all');

  return (
    <div className="flex flex-wrap gap-2 items-center py-4">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-1">Filter:</span>

      <Select value={filters.outreachSegment} onValueChange={(v) => onChange('outreachSegment', v)}>
        <SelectTrigger className="h-8 w-52">
          <SelectValue placeholder="Outreach Segment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Segments</SelectItem>
          {OUTREACH_SEGMENTS.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.behavioralBucket} onValueChange={(v) => onChange('behavioralBucket', v)}>
        <SelectTrigger className="h-8 w-48">
          <SelectValue placeholder="Behavior" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Buckets</SelectItem>
          {BEHAVIORAL_BUCKETS.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.engagement} onValueChange={(v) => onChange('engagement', v)}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="Engagement" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Engagement</SelectItem>
          {(['power', 'engaged', 'casual', 'ghost'] as EngagementLevel[]).map((v) => (
            <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.activity} onValueChange={(v) => onChange('activity', v)}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="Activity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Activity</SelectItem>
          {(['active', 'recent', 'lapsed', 'dormant', 'never'] as ActivityStatus[]).map((v) => (
            <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.survey} onValueChange={(v) => onChange('survey', v)}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="Survey" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Survey</SelectItem>
          {(['complete', 'incomplete', 'no-survey'] as SurveyStatus[]).map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.country} onValueChange={(v) => onChange('country', v)}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Countries</SelectItem>
          {topCountries.map(({ country }) => (
            <SelectItem key={country} value={country}>{country}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            ['engagement', 'activity', 'survey', 'country', 'outreachSegment', 'behavioralBucket'].forEach(
              (k) => onChange(k, 'all')
            );
          }}
          className="text-gray-500 h-8"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
