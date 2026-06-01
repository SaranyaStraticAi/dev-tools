'use client';

import { useState } from 'react';
import VideoGeneratorDemo from '@/components/video-generator-demo';
import VideoReelStudio   from '@/components/video-reel-studio';

export default function VideoGeneratorPage() {
  const [tab, setTab] = useState<'reel' | 'single'>('reel');

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-violet-900 to-slate-900 text-white py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold uppercase tracking-widest animate-pulse">
            Sora 2 · Azure East US 2 · Preview
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter">
            VibeTrader <span className="text-violet-400 italic">Video Studio</span>
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-base">
            Reel Studio runs the full Mon–Fri pipeline with editable prompts and live Sora 2 rendering.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center">
          <div className="flex bg-white/5 rounded-xl p-1 gap-1 border border-white/10">
            <button
              onClick={() => setTab('reel')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === 'reel'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎬 Reel Studio
              <span className="ml-2 text-[10px] font-normal opacity-60">Mon–Fri pipeline</span>
            </button>
            <button
              onClick={() => setTab('single')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === 'single'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚡ Single Video
              <span className="ml-2 text-[10px] font-normal opacity-60">free prompt</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {tab === 'reel' ? <VideoReelStudio /> : <VideoGeneratorDemo />}

        <div className="border-t border-white/5 pt-8 text-center text-slate-500 text-xs">
          © 2026 VibeTrader AI · Powered by Azure OpenAI Sora 2
        </div>
      </div>
    </main>
  );
}
