import VideoGeneratorDemo from '@/components/video-generator-demo';

export default function VideoGeneratorPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-violet-900 to-slate-900 text-white py-20 px-4">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold uppercase tracking-widest animate-pulse">
            Sora 2 · Azure East US 2 · Preview
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter">
            Prompt. <span className="text-violet-400 italic">Generate.</span> Ship.
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Turn any market news or trading topic into a cinematic AI video. Edit prompts, adjust duration, preview instantly.
          </p>
        </div>

        <VideoGeneratorDemo />

        <div className="border-t border-white/5 pt-12 text-center text-slate-500 text-sm">
          <p>© 2026 VibeTrader AI · Video generation powered by Azure OpenAI Sora 2</p>
        </div>
      </div>
    </main>
  );
}
