'use client';

import { Link2 } from 'lucide-react';

export function LinkHeader() {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Link2 className="text-blue-500" />
                    Link Tracker
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Create and manage trackable links for marketing campaigns.
                </p>
            </div>
        </div>
    );
}
