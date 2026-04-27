import ImageGeneratorDemo from '@/components/image-generator-demo';

export default function ImageGeneratorPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-purple-900 to-slate-900 text-white py-20 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest animate-pulse">
            New Feature: Multimodal Generation
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter">
            Imagine. <span className="text-primary italic">Generate.</span> Trade.
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Create high-fidelity trading visuals, educational assets, and more using the power of Google's most advanced AI models.
          </p>
        </div>

        <ImageGeneratorDemo />
        
        <div className="mt-20 border-t border-white/5 pt-12 text-center text-slate-500 text-sm">
          <p>© 2026 VibeTrader AI. All image generations are powered by Gemini Pro.</p>
        </div>
      </div>
    </main>
  );
}
