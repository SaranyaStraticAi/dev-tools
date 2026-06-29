'use client';

import { useState } from 'react';
import { Link2, Copy, CheckCircle2, ExternalLink } from 'lucide-react';

const PLATFORMS = [
    { value: 'instagram', label: '📸 Instagram' },
    { value: 'twitter', label: '🐦 Twitter / X' },
    { value: 'linkedin', label: '💼 LinkedIn' },
    { value: 'facebook', label: '📘 Facebook' },
    { value: 'youtube', label: '▶️ YouTube' },
    { value: 'tiktok', label: '🎵 TikTok' },
    { value: 'whatsapp', label: '💬 WhatsApp' },
    { value: 'reddit', label: '🔴 Reddit' },
    { value: 'telegram', label: '✈️ Telegram' },
    { value: 'other', label: '🌐 Other' },
];

const POST_TYPES = [
    { value: 'post', label: 'Regular Post' },
    { value: 'reel', label: 'Reel / Short Video' },
    { value: 'story', label: 'Story' },
    { value: 'bio_link', label: 'Bio Link' },
    { value: 'paid_ad', label: 'Paid Ad' },
    { value: 'dm', label: 'Direct Message' },
    { value: 'comment', label: 'Comment' },
    { value: 'email', label: 'Email' },
];

const CREATED_BY = [
    { value: 'ketki', label: '👤 Ketki' },
    { value: 'goutham', label: '👤 Goutham' },
    { value: 'kalyani', label: '👤 Kalyani' },
];

interface LinkFormProps {
    onSuccess?: () => void;
}

export function LinkForm({ onSuccess }: LinkFormProps) {
    const [form, setForm] = useState({
        platform: '',
        post_type: 'post',
        campaign_name: '',
        created_by: '',
    });
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const buildLink = () => {
        const base = 'https://vibetrader.com';
        const params = new URLSearchParams();
        params.set('utm_source', form.platform);
        params.set('utm_medium', 'social');
        params.set('utm_campaign', form.campaign_name.trim().toLowerCase().replace(/\s+/g, '_'));
        params.set('utm_content', form.post_type);
        if (form.created_by) params.set('utm_term', form.created_by);
        return `${base}?${params.toString()}`;
    };

    const handleGenerate = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!form.platform) { setError('Please select a platform'); return; }
        if (!form.campaign_name.trim()) { setError('Please enter a campaign name'); return; }
        if (!form.created_by) { setError('Please select who is posting this'); return; }
        setGeneratedLink(buildLink());
        setCopied(false);
    };

    const copyLink = () => {
        if (!generatedLink) return;
        navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

    const reset = () => {
        setGeneratedLink(null);
        setCopied(false);
        setForm({ platform: '', post_type: 'post', campaign_name: '', created_by: '' });
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <Link2 size={20} className="text-blue-500" />
                Generate Link for a Post
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Fill in the details → get a unique link → paste it in your social media post. PostHog on vibetrader.com will automatically track every click.
            </p>

            <form onSubmit={handleGenerate} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Platform <span className="text-red-500">*</span>
                        </label>
                        <select
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={form.platform}
                            onChange={e => setForm({ ...form, platform: e.target.value })}
                        >
                            <option value="">-- Select Platform --</option>
                            {PLATFORMS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Post Type</label>
                        <select
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={form.post_type}
                            onChange={e => setForm({ ...form, post_type: e.target.value })}
                        >
                            {POST_TYPES.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Created By <span className="text-red-500">*</span>
                    </label>
                    <select
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={form.created_by}
                        onChange={e => setForm({ ...form, created_by: e.target.value })}
                    >
                        <option value="">-- Who is posting this? --</option>
                        {CREATED_BY.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Post / Campaign Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        placeholder='e.g. "AI Trading Reel May 8" or "LinkedIn Launch Post"'
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={form.campaign_name}
                        onChange={e => setForm({ ...form, campaign_name: e.target.value })}
                    />
                    <p className="text-xs text-slate-400">This name helps you identify which post drove the clicks in PostHog.</p>
                </div>

                {/* Live preview while typing */}
                {form.platform && form.campaign_name && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                        <p className="text-xs text-slate-400 mb-1 font-medium">Preview of your link:</p>
                        <code className="text-xs text-blue-500 break-all">{buildLink()}</code>
                    </div>
                )}

                {error && (
                    <p className="text-sm text-red-500 font-medium">⚠️ {error}</p>
                )}

                <button
                    type="submit"
                    className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    <Link2 size={18} />
                    Generate Link
                </button>
            </form>

            {/* Result box */}
            {generatedLink && (
                <div className="mt-6 p-5 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-400 dark:border-emerald-600 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                        <span className="font-bold text-emerald-700 dark:text-emerald-300 text-base">
                            Your tracking link is ready! 👇 Copy & paste this into your post
                        </span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl px-4 py-3 mb-3 break-all">
                        <code className="text-blue-600 dark:text-blue-400 font-bold text-sm">{generatedLink}</code>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={copyLink}
                            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all active:scale-95 shadow-md"
                        >
                            {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                            {copied ? '✅ Copied!' : 'Copy Link'}
                        </button>
                        <a
                            href={generatedLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:border-blue-400 hover:text-blue-500 transition-all"
                        >
                            <ExternalLink size={18} />
                            Test Link
                        </a>
                        <button
                            onClick={reset}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 font-semibold rounded-xl hover:border-slate-400 transition-all"
                        >
                            + New Link
                        </button>
                    </div>

                    <div className="mt-4 p-3 bg-white/60 dark:bg-slate-900/40 rounded-lg text-xs text-slate-500 space-y-1">
                        <p>✅ <strong>No DB needed</strong> — PostHog on vibetrader.com automatically captures this link's UTM params when someone clicks it.</p>
                        <p>📊 <strong>To see results:</strong> PostHog → Insights → break down <code>$pageview</code> by <code>utm_source</code> or <code>utm_campaign</code></p>
                    </div>
                </div>
            )}
        </div>
    );
}
