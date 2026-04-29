'use client';

import { useState } from 'react';
import { Search, BarChart2, CheckCircle2, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { MarketingLink } from './types';

interface LinkTableProps {
    links: MarketingLink[];
    loading: boolean;
    search: string;
    onSearchChange: (value: string) => void;
    onDelete: (id: string) => void;
}

export function LinkTable({ links, loading, search, onSearchChange, onDelete }: LinkTableProps) {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyToClipboard = (slug: string, id: string) => {
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/l/${slug}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Existing Links</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all w-full md:w-64"
                        value={search}
                        onChange={e => onSearchChange(e.target.value)}
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50">
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Campaign</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Link</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 text-center whitespace-nowrap">Total Hits</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 text-center whitespace-nowrap">Unique Users</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Created</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {loading ? (
                            Array(3).fill(0).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan={6} className="px-6 py-8 h-16 bg-slate-100/50 dark:bg-slate-800/50"></td>
                                </tr>
                            ))
                        ) : links.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    No links match your search.
                                </td>
                            </tr>
                        ) : (
                            links.map(link => (
                                <tr key={link.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-900 dark:text-white">{link.campaign_name}</div>
                                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{link.target_url}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 group">
                                            <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-blue-600 dark:text-blue-400 text-sm">
                                                /l/{link.slug}
                                            </code>
                                            <button
                                                onClick={() => copyToClipboard(link.slug, link.id)}
                                                className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded shadow-sm transition-all text-slate-400 hover:text-blue-500"
                                                title="Copy full link"
                                            >
                                                {copiedId === link.id ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold">
                                            <BarChart2 size={14} />
                                            {link.click_count}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold">
                                            <CheckCircle2 size={14} />
                                            {link.unique_clicks}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                        {new Date(link.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <a
                                            href={link.target_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex p-2 hover:bg-white dark:hover:bg-slate-800 rounded shadow-sm transition-all text-slate-400 hover:text-blue-500"
                                        >
                                            <ExternalLink size={18} />
                                        </a>
                                        <button
                                            onClick={() => onDelete(link.id)}
                                            className="inline-flex p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded shadow-sm transition-all text-slate-400 hover:text-red-500"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
