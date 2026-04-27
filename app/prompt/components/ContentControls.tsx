import { Settings2 } from 'lucide-react';

interface ContentControlsProps {
    headline: string;
    setHeadline: (v: string) => void;
    summary: string;
    setSummary: (v: string) => void;
    sentiment: string;
    setSentiment: (v: string) => void;
}

export default function ContentControls({
    headline,
    setHeadline,
    summary,
    setSummary,
    sentiment,
    setSentiment
}: ContentControlsProps) {
    const sentimentValue = parseFloat(sentiment);

    return (
        <div className="p-5 bg-card rounded-2xl border shadow-sm space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b">
                <Settings2 className="w-3.5 h-3.5" />
                Content Controls
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Active Headline</label>
                <textarea
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="w-full p-3 bg-muted/30 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none transition-all min-h-[80px]"
                />
            </div>

            <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 flex justify-between">
                    Sentiment Score
                    <span className={`font-mono text-xs ${sentimentValue > 0.3 ? 'text-green-500' : sentimentValue < -0.3 ? 'text-red-500' : 'text-blue-500'}`}>
                        {sentimentValue.toFixed(1)}
                    </span>
                </label>
                <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={sentiment}
                    onChange={(e) => setSentiment(e.target.value)}
                    className="w-full accent-purple-600 h-1.5 rounded-full"
                />
                <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter opacity-40">
                    <span>Risk On</span>
                    <span>Neutral</span>
                    <span>Risk Off</span>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">News Narrative</label>
                <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full p-4 bg-muted/30 border rounded-xl text-xs leading-relaxed focus:ring-2 focus:ring-purple-500 outline-none transition-all min-h-[220px]"
                />
            </div>
        </div>
    );
}
