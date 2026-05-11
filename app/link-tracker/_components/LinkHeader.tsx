'use client';

import { Link2, MousePointerClick, BarChart2 } from 'lucide-react';

export function LinkHeader() {
    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Link2 className="text-blue-500" />
                    Social Media Link Tracker
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Every time you post on social media, generate a unique tracking link here and share that instead of vibetrader.com directly.
                    This tells you exactly <strong>which post / platform</strong> is driving the most visitors to the site.
                </p>
            </div>

            {/* How it works — 3 steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
                    <span className="text-2xl">1️⃣</span>
                    <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Fill in the form below</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select the platform (Instagram, LinkedIn etc.) and give the post a name.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-xl p-4">
                    <span className="text-2xl">2️⃣</span>
                    <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Copy your unique link</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">A short link is generated — use this in your post instead of vibetrader.com.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-4">
                    <span className="text-2xl">3️⃣</span>
                    <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">See who clicked it</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">The table below shows total clicks & unique visitors per post so you know what works.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
