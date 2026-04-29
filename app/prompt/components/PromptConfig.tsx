'use client';

import { Film, BarChart2 } from 'lucide-react';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_TEMPLATE, STATS_SYSTEM_PROMPT, STATS_USER_TEMPLATE } from '../constants';

type Mode = 'cinematic' | 'stats';

interface PromptConfigProps {
    systemPrompt: string;
    setSystemPrompt: (v: string) => void;
    userTemplate: string;
    setUserTemplate: (v: string) => void;
    mode: Mode;
    setMode: (m: Mode) => void;
}

export default function PromptConfig({
    systemPrompt,
    setSystemPrompt,
    userTemplate,
    setUserTemplate,
    mode,
    setMode,
}: PromptConfigProps) {

    const handleModeSwitch = (newMode: Mode) => {
        setMode(newMode);
        if (newMode === 'cinematic') {
            setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
            setUserTemplate(DEFAULT_USER_TEMPLATE);
        } else {
            setSystemPrompt(STATS_SYSTEM_PROMPT);
            setUserTemplate(STATS_USER_TEMPLATE);
        }
    };

    return (
        <div className="flex flex-col gap-4 flex-1">

            {/* Mode Toggle */}
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
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center block">
                        Input Template (User)
                    </label>
                    <div className="flex gap-2">
                        <span className="text-[8px] bg-muted px-1.5 py-0.5 rounded uppercase font-bold text-muted-foreground">{'{headline}'}</span>
                        <span className="text-[8px] bg-muted px-1.5 py-0.5 rounded uppercase font-bold text-muted-foreground">{'{sentiment}'}</span>
                    </div>
                </div>
                <textarea
                    value={userTemplate}
                    onChange={(e) => setUserTemplate(e.target.value)}
                    className="w-full flex-1 min-h-[140px] p-4 font-mono text-[11px] border rounded-2xl bg-card shadow-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
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
