'use client';

import { useState } from 'react';
import { Film, BarChart2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_TEMPLATE, STATS_SYSTEM_PROMPT, STATS_USER_TEMPLATE } from '../constants';

type Mode = 'cinematic' | 'stats';

interface PromptConfigProps {
    systemPrompt: string;
    setSystemPrompt: (v: string) => void;
    userTemplate: string;
    setUserTemplate: (v: string) => void;
    mode: Mode;
    setMode: (m: Mode) => void;
    // These are needed so Publish can send BOTH cinematic + stats at once
    cinematicSystem: string;
    cinematicUser: string;
    statsSystem: string;
    statsUser: string;
}

export default function PromptConfig({
    systemPrompt,
    setSystemPrompt,
    userTemplate,
    setUserTemplate,
    mode,
    setMode,
    cinematicSystem,
    cinematicUser,
    statsSystem,
    statsUser,
}: PromptConfigProps) {
    const [publishing, setPublishing] = useState(false);
    const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handlePublish = async () => {
        setPublishing(true);
        setPublishStatus('idle');
        try {
            const res = await fetch('/api/prompt-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cinematicSystem, cinematicUser, statsSystem, statsUser }),
            });
            if (!res.ok) throw new Error('Publish failed');
            setPublishStatus('success');
            setTimeout(() => setPublishStatus('idle'), 3000);
        } catch {
            setPublishStatus('error');
            setTimeout(() => setPublishStatus('idle'), 3000);
        } finally {
            setPublishing(false);
        }
    };

    const handleModeSwitch = (newMode: Mode) => setMode(newMode);

    return (
        <div className="flex flex-col gap-4 flex-1">

            {/* Mode Toggle + Publish Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 p-1 bg-muted rounded-xl border w-fit">
                    <button
                        onClick={() => handleModeSwitch('cinematic')}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            mode === 'cinematic'
                                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Film className="w-3.5 h-3.5" />
                        Cinematic
                    </button>
                    <button
                        onClick={() => handleModeSwitch('stats')}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            mode === 'stats'
                                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/30'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <BarChart2 className="w-3.5 h-3.5" />
                        Stats Card
                    </button>
                </div>

                {/* 🚀 Publish Button */}
                <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                        publishStatus === 'success'
                            ? 'bg-green-500 text-white'
                            : publishStatus === 'error'
                            ? 'bg-red-500 text-white'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                    } disabled:opacity-60`}
                >
                    {publishing ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                    ) : publishStatus === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : publishStatus === 'error' ? (
                        <AlertCircle className="w-3.5 h-3.5" />
                    ) : (
                        <Upload className="w-3.5 h-3.5" />
                    )}
                    {publishing ? 'Publishing...' : publishStatus === 'success' ? 'Published!' : publishStatus === 'error' ? 'Failed!' : 'Publish to Azure'}
                </button>
            </div>

            {/* Mode label */}
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest -mt-2">
                {mode === 'cinematic'
                    ? '🎬 Image 1 — Cinematic editorial visual'
                    : '📊 Image 2 — Carousel stats card'}
            </p>

            {/* System Prompt */}
            <div className="flex flex-col shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Engineering Logic (System)
                    </label>
                    <button
                        onClick={() => setSystemPrompt(mode === 'cinematic' ? DEFAULT_SYSTEM_PROMPT : STATS_SYSTEM_PROMPT)}
                        className="text-[10px] text-purple-600 font-bold hover:underline"
                    >
                        Reset to Default
                    </button>
                </div>
                <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full h-[320px] p-5 font-mono text-xs border rounded-2xl bg-card shadow-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all leading-relaxed"
                />
            </div>

            {/* User Template */}
            <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Input Template (User)
                    </label>
                    <div className="flex gap-1.5 items-center">
                        <span className="text-[8px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-bold font-mono">{'{headline}'}</span>
                        <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold font-mono">{'{summary}'}</span>
                        <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold font-mono">{'{sentiment}'}</span>
                        <span className="text-[8px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded font-bold font-mono">{'{market_impact}'}</span>
                    </div>
                </div>

                {/* Highlighted preview */}
                <div className="w-full min-h-[80px] p-4 font-mono text-[11px] border rounded-t-2xl bg-muted/40 leading-relaxed whitespace-pre-wrap break-words pointer-events-none select-none">
                    {userTemplate.split(/(\{headline\}|\{summary\}|\{sentiment\}|\{market_impact\})/).map((part, i) => {
                        if (part === '{headline}')     return <mark key={i} className="bg-orange-500/25 text-orange-400 rounded px-0.5 not-italic font-bold">{'{headline}'}</mark>;
                        if (part === '{summary}')      return <mark key={i} className="bg-blue-500/25 text-blue-400 rounded px-0.5 not-italic font-bold">{'{summary}'}</mark>;
                        if (part === '{sentiment}')    return <mark key={i} className="bg-green-500/25 text-green-400 rounded px-0.5 not-italic font-bold">{'{sentiment}'}</mark>;
                        if (part === '{market_impact}') return <mark key={i} className="bg-pink-500/25 text-pink-400 rounded px-0.5 not-italic font-bold">{'{market_impact}'}</mark>;
                        return <span key={i}>{part}</span>;
                    })}
                </div>

                {/* Editable textarea */}
                <textarea
                    value={userTemplate}
                    onChange={(e) => setUserTemplate(e.target.value)}
                    className="w-full min-h-[80px] p-4 font-mono text-[11px] border border-t-0 rounded-b-2xl bg-card shadow-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                />

                <button
                    onClick={() => setUserTemplate(mode === 'cinematic' ? DEFAULT_USER_TEMPLATE : STATS_USER_TEMPLATE)}
                    className="text-[10px] text-purple-600 font-bold hover:underline self-end mt-1"
                >
                    Reset Template
                </button>
            </div>
        </div>
    );
}
