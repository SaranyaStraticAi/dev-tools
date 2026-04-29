'use client';

import { useState } from 'react';
import { Plus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LinkFormProps {
    onSuccess: () => void;
}

export function LinkForm({ onSuccess }: LinkFormProps) {
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [form, setForm] = useState({
        campaign_name: '',
        target_url: 'https://vibetrader.com',
        description: '',
        custom_slug: ''
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch('/api/marketing-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create link');

            setSuccess('Tracking link created successfully!');
            setForm({
                campaign_name: '',
                target_url: 'https://vibetrader.com',
                description: '',
                custom_slug: ''
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Plus size={20} className="text-blue-500" />
                Create New Trackable Link
            </h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Campaign Name</label>
                    <input
                        type="text"
                        placeholder="e.g., April Video Post - LinkedIn"
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={form.campaign_name}
                        onChange={e => setForm({ ...form, campaign_name: e.target.value })}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Target URL</label>
                    <input
                        type="url"
                        placeholder="https://vibetrader.com"
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={form.target_url}
                        onChange={e => setForm({ ...form, target_url: e.target.value })}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Custom Slug (Optional)</label>
                    <input
                        type="text"
                        placeholder="e.g., spring-promo"
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={form.custom_slug}
                        onChange={e => setForm({ ...form, custom_slug: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                    <input
                        type="text"
                        placeholder="Brief description of the post/video"
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                    />
                </div>
                <div className="md:col-span-2">
                    <button
                        type="submit"
                        disabled={creating}
                        className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                    >
                        {creating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        Generate Trackable Link
                    </button>
                </div>
            </form>

            {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}
            {success && (
                <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={20} />
                    {success}
                </div>
            )}
        </div>
    );
}
