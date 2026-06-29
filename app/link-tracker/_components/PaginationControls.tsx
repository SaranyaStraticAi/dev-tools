'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    page: number;
    totalPages: number;
    totalLinks: number;
    onPageChange: (page: number | ((prev: number) => number)) => void;
}

export function PaginationControls({ page, totalPages, totalLinks, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="text-sm text-slate-500">
                Showing page {page} of {totalPages} ({totalLinks} total links)
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => onPageChange((p: number) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronLeft size={20} />
                </button>
                <button
                    onClick={() => onPageChange((p: number) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );
}
