'use client';

import type { SignupCohort } from '../types';

interface Props {
  cohorts: SignupCohort[];
}

function rateToColor(rate: number): string {
  if (rate >= 0.6) return 'bg-green-500 text-white';
  if (rate >= 0.4) return 'bg-green-300 text-green-900';
  if (rate >= 0.2) return 'bg-yellow-200 text-yellow-900';
  if (rate > 0) return 'bg-orange-100 text-orange-800';
  return 'bg-gray-100 text-gray-400';
}

export function CohortChart({ cohorts }: Props) {
  if (cohorts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Signup Cohort Activation</h3>
        <div className="flex items-center justify-center h-20 text-gray-400 text-sm">No cohort data yet</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Signup Cohort Activation</h3>
          <p className="text-xs text-gray-400 mt-0.5">% of weekly signups who reached Exploring or beyond</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> ≥60%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-300 inline-block" /> ≥40%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block" /> ≥20%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-100 inline-block" /> &lt;20%</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left pr-4 py-1 text-gray-400 font-medium whitespace-nowrap">Week</th>
              <th className="text-right pr-4 py-1 text-gray-400 font-medium">Signups</th>
              <th className="text-right pr-4 py-1 text-gray-400 font-medium">Activated</th>
              <th className="text-center py-1 text-gray-400 font-medium min-w-16">Rate</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.week} className="border-t border-gray-50 dark:border-gray-700">
                <td className="pr-4 py-1 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">{cohort.week}</td>
                <td className="pr-4 py-1 text-right tabular-nums text-gray-700 dark:text-gray-300">{cohort.total}</td>
                <td className="pr-4 py-1 text-right tabular-nums text-gray-700 dark:text-gray-300">{cohort.activated}</td>
                <td className="py-1 text-center">
                  <span className={`inline-block rounded px-2 py-0.5 tabular-nums font-semibold ${rateToColor(cohort.rate)}`}>
                    {Math.round(cohort.rate * 100)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
