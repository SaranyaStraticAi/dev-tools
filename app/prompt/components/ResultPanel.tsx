import { Sparkles } from 'lucide-react';

interface ResultPanelProps {
    result: string;
    loading: boolean;
    error: string | null;
}

export default function ResultPanel({ result, loading, error }: ResultPanelProps) {
    return (
        <div className={`
            flex flex-col h-full rounded-3xl border-2 border-dashed transition-all relative overflow-hidden
            ${loading ? 'bg-purple-50/50 border-purple-200 dark:bg-purple-950/10' : result ? 'bg-background border-green-500/30' : 'bg-muted/10 border-muted-foreground/20'}
        `}>
            <div className="p-4 border-b flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                    <div className={`w-2 h-2 rounded-full ${loading ? 'bg-purple-500 animate-ping' : result ? 'bg-green-500' : 'bg-gray-400'}`} />
                    Workspace Result
                </div>
                {result && (
                    <button
                        onClick={() => { navigator.clipboard.writeText(result) }}
                        className="text-[10px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-lg"
                    >
                        Copy Result
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 p-5 rounded-2xl text-sm font-medium">
                        <h4 className="font-black text-[10px] uppercase mb-1">Architecture Error</h4>
                        {error}
                    </div>
                )}

                {!result && !loading && !error && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 space-y-4">
                        <div className="w-20 h-20 rounded-full border-[3px] border-muted/50 border-dashed flex items-center justify-center text-4xl select-none group-hover:rotate-12 transition-transform italic font-black">?</div>
                        <p className="text-xs font-bold uppercase tracking-widest text-center max-w-[200px]">Select a neural node and start synthesis</p>
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-6">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-purple-600/20 border-t-purple-600 animate-spin"></div>
                            <Sparkles className="w-6 h-6 text-purple-600 absolute inset-0 m-auto animate-pulse" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="font-black text-[11px] uppercase tracking-[.2em] text-purple-600">Synthesizing Vision</p>
                            <p className="text-[10px] text-muted-foreground opacity-60">Mapping market news to cinematic branding...</p>
                        </div>
                    </div>
                )}

                {result && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            <div className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed p-6 bg-card rounded-2xl border shadow-sm border-green-500/10">
                                {result}
                            </div>
                        </div>

                        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/10 dark:to-emerald-950/10 border border-green-100 dark:border-green-900/30 rounded-2xl space-y-2">
                            <h4 className="text-[9px] font-black text-green-600 uppercase tracking-[.2em]">Deployment Advice</h4>
                            <p className="text-[10px] text-muted-foreground leading-snug">The Master Prompt Formula is optimized for **DALL-E 3 (Sweden Central)**. Paste results into the image prompt for high-alpha asset production.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
