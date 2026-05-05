'use client';

import { useState } from 'react';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_TEMPLATE, STATS_SYSTEM_PROMPT, STATS_USER_TEMPLATE, STATIC_NEWS, NewsItem } from './constants';
import NewsCarousel from './components/NewsCarousel';
import PromptConfig from './components/PromptConfig';

type Mode = 'cinematic' | 'stats';

export default function PromptTesterPage() {
    const [mode, setMode] = useState<Mode>('cinematic');
    const [cinematicSystem, setCinematicSystem] = useState(DEFAULT_SYSTEM_PROMPT);
    const [cinematicUser, setCinematicUser]     = useState(DEFAULT_USER_TEMPLATE);
    const [statsSystem, setStatsSystem]         = useState(STATS_SYSTEM_PROMPT);
    const [statsUser, setStatsUser]             = useState(STATS_USER_TEMPLATE);
    const [showPrompts, setShowPrompts]         = useState(false);

    const systemPrompt    = mode === 'cinematic' ? cinematicSystem : statsSystem;
    const userTemplate    = mode === 'cinematic' ? cinematicUser   : statsUser;
    const setSystemPrompt = (v: string) => mode === 'cinematic' ? setCinematicSystem(v) : setStatsSystem(v);
    const setUserTemplate = (v: string) => mode === 'cinematic' ? setCinematicUser(v)   : setStatsUser(v);
    const handleModeSwitch = (newMode: Mode) => setMode(newMode);

    const [headline, setHeadline]   = useState(STATIC_NEWS[0].headline);
    const [summary, setSummary]     = useState(STATIC_NEWS[0].generated_news);
    const [sentiment, setSentiment] = useState(STATIC_NEWS[0].sentiment_score.toString());
    const [selectedId, setSelectedId] = useState<string | null>(STATIC_NEWS[0].id);

    const [imageB64, setImageB64]       = useState<string | null>(null);
    const [loading, setLoading]         = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    const [error, setError]             = useState<string | null>(null);
    const [generatedPrompt, setGeneratedPrompt] = useState('');

    const selectItem = (item: NewsItem) => {
        setSelectedId(item.id);
        setHeadline(item.headline);
        setSummary(item.generated_news);
        setSentiment(item.sentiment_score.toString());
    };

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setImageB64(null);
        setGeneratedPrompt('');

        try {
            setLoadingStep('🧠 Writing image prompt...');
            const promptRes = await fetch('/api/prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt, userPromptTemplate: userTemplate, headline, summary, sentiment: parseFloat(sentiment) }),
            });
            const promptData = await promptRes.json();
            if (!promptRes.ok) throw new Error(promptData.message || 'Prompt generation failed');
            setGeneratedPrompt(promptData.text);

            setLoadingStep('🎨 Generating image... (1–3 mins)');
            const configRes = await fetch('/api/generate-image');
            const config = await configRes.json();
            if (!configRes.ok) throw new Error(config.error || 'Config fetch failed');

            const imageRes = await fetch(config.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'api-key': config.apiKey },
                body: JSON.stringify({ model: config.deployment, prompt: promptData.text, n: 1, size: '1024x1024' }),
            });
            const imageData = await imageRes.json();
            if (!imageRes.ok) throw new Error(imageData.error?.message || `Azure error ${imageRes.status}`);

            const imgItem = imageData.data?.[0];
            if (!imgItem) throw new Error('No image returned');

            if (imgItem.b64_json) {
                setImageB64(imgItem.b64_json);
            } else if (imgItem.url) {
                const urlRes = await fetch(imgItem.url);
                const blob = await urlRes.blob();
                const reader = new FileReader();
                reader.onloadend = () => setImageB64((reader.result as string).split(',')[1]);
                reader.readAsDataURL(blob);
            } else {
                throw new Error('No image data in response');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
            setLoadingStep('');
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen bg-background py-12 px-4 gap-8">

            {/* ── Title ── */}
            <div className="text-center">
                <h1 className="text-2xl font-bold tracking-tight">VibeTrader Image Generator</h1>
                <p className="text-sm text-muted-foreground mt-1">Pick a news item, choose a style, generate.</p>
            </div>

            {/* ── News Carousel ── */}
            <div className="w-full max-w-3xl">
                <NewsCarousel selectedId={selectedId} onSelect={selectItem} />
            </div>

            {/* ── Two Main Buttons ── */}
            <div className="flex items-center gap-4">
                {/* Cinematic */}
                <button
                    onClick={() => { handleModeSwitch('cinematic'); handleGenerate(); }}
                    disabled={loading}
                    className={`px-8 py-4 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2 ${
                        mode === 'cinematic' && loading
                            ? 'bg-purple-700 text-white cursor-wait'
                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/30'
                    } disabled:opacity-60`}
                >
                    {mode === 'cinematic' && loading
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                        : '🎬'}
                    Cinematic
                </button>

                {/* Stats Card */}
                <button
                    onClick={() => { handleModeSwitch('stats'); handleGenerate(); }}
                    disabled={loading}
                    className={`px-8 py-4 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2 ${
                        mode === 'stats' && loading
                            ? 'bg-cyan-700 text-white cursor-wait'
                            : 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-cyan-500/30'
                    } disabled:opacity-60`}
                >
                    {mode === 'stats' && loading
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                        : '📊'}
                    Stats Card
                </button>

                {/* Edit Prompts */}
                <button
                    onClick={() => setShowPrompts(v => !v)}
                    className="px-8 py-4 rounded-2xl font-bold text-sm border border-border hover:bg-muted transition-all shadow-sm flex items-center gap-2"
                >
                    ✏️ Edit Prompts
                </button>
            </div>

            {/* ── Loading Status ── */}
            {loading && (
                <p className="text-sm text-muted-foreground animate-pulse">{loadingStep}</p>
            )}

            {/* ── Error ── */}
            {error && (
                <div className="w-full max-w-2xl p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm text-center">
                    ❌ {error}
                </div>
            )}

            {/* ── Generated Image ── */}
            {imageB64 && (
                <div className="flex flex-col items-center gap-3 w-full max-w-2xl">
                    <img
                        src={`data:image/png;base64,${imageB64}`}
                        alt="Generated visual"
                        className="w-full rounded-2xl shadow-2xl border border-white/10"
                    />
                    <div className="flex gap-3">
                        <a
                            href={`data:image/png;base64,${imageB64}`}
                            download={`vibetrader-${mode}-${Date.now()}.png`}
                            className="px-4 py-2 bg-muted rounded-xl text-xs font-bold hover:bg-muted/80 transition-all"
                        >
                            ⬇️ Download
                        </a>
                        <details className="relative">
                            <summary className="px-4 py-2 bg-muted rounded-xl text-xs font-bold cursor-pointer hover:bg-muted/80 transition-all list-none">
                                📄 View Prompt
                            </summary>
                            <pre className="absolute bottom-10 left-0 w-[600px] max-h-64 overflow-auto p-4 bg-card border rounded-xl text-[10px] font-mono whitespace-pre-wrap z-10 shadow-xl">
                                {generatedPrompt}
                            </pre>
                        </details>
                    </div>
                </div>
            )}

            {/* ── Edit Prompts Panel ── */}
            {showPrompts && (
                <div className="w-full max-w-3xl border rounded-2xl p-6 bg-card shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-sm">Edit Prompts</h2>
                        <button onClick={() => setShowPrompts(false)} className="text-xs text-muted-foreground hover:text-foreground">✕ Close</button>
                    </div>
                    <PromptConfig
                        systemPrompt={systemPrompt}
                        setSystemPrompt={setSystemPrompt}
                        userTemplate={userTemplate}
                        setUserTemplate={setUserTemplate}
                        mode={mode}
                        setMode={handleModeSwitch}
                        cinematicSystem={cinematicSystem}
                        cinematicUser={cinematicUser}
                        statsSystem={statsSystem}
                        statsUser={statsUser}
                    />
                </div>
            )}

        </div>
    );
}
