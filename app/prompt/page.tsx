'use client';

import { useState, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_TEMPLATE, STATS_SYSTEM_PROMPT, STATS_USER_TEMPLATE, STATIC_NEWS, NewsItem } from './constants';
import NewsCarousel from './components/NewsCarousel';
import ContentControls from './components/ContentControls';
import PromptConfig from './components/PromptConfig';
import ResultPanel from './components/ResultPanel';

type Mode = 'cinematic' | 'stats';

export default function PromptTesterPage() {
    const [mode, setMode] = useState<Mode>('cinematic');
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [userTemplate, setUserTemplate] = useState(DEFAULT_USER_TEMPLATE);
    const [headline, setHeadline] = useState(STATIC_NEWS[0].headline);
    const [summary, setSummary] = useState(STATIC_NEWS[0].generated_news);
    const [sentiment, setSentiment] = useState(STATIC_NEWS[0].sentiment_score.toString());
    const [selectedId, setSelectedId] = useState<string | null>(STATIC_NEWS[0].id);
    const [isLoaded, setIsLoaded] = useState(false);

    // 1.5. Local Storage Persistence
    useEffect(() => {
        const savedSystem = localStorage.getItem('vibe_architect_system_prompt');
        const savedTemplate = localStorage.getItem('vibe_architect_user_template');

        if (savedSystem) setSystemPrompt(savedSystem);
        if (savedTemplate) setUserTemplate(savedTemplate);
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('vibe_architect_system_prompt', systemPrompt);
        localStorage.setItem('vibe_architect_user_template', userTemplate);
    }, [systemPrompt, userTemplate, isLoaded]);

    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 2. Selection Handler
    const selectItem = (item: NewsItem) => {
        setSelectedId(item.id);
        setHeadline(item.headline);
        setSummary(item.generated_news);
        setSentiment(item.sentiment_score.toString());
    };

    // 3. API Generation Handler
    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setResult('');

        try {
            const response = await fetch('/api/prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemPrompt,
                    userPromptTemplate: userTemplate,
                    headline,
                    summary,
                    sentiment: parseFloat(sentiment)
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Generation failed');
            setResult(data.text);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-4 max-w-[1600px] mx-auto overflow-hidden">
            {/* Header Section */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-600 rounded-lg shadow-lg shadow-purple-500/20">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Vibe Prompt Architect</h1>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest opacity-70">Real-Time Cinematic Generation</p>
                    </div>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={loading || !headline}
                    className="group px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold rounded-xl transition-all shadow-xl shadow-purple-500/30 flex items-center gap-3 active:scale-95"
                >
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" /> : <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                    {loading ? 'Processing...' : 'Generate Prompt'}
                </button>
            </div>

            {/* Horizontal News Carousel */}
            <NewsCarousel
                selectedId={selectedId}
                onSelect={selectItem}
            />

            {/* Main 3-Column Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-hidden pb-4 px-2">
                {/* Column 1: Content Controls */}
                <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-1 no-scrollbar">
                    <ContentControls
                        headline={headline}
                        setHeadline={setHeadline}
                        sentiment={sentiment}
                        setSentiment={setSentiment}
                        summary={summary}
                        setSummary={setSummary}
                    />
                </div>

                {/* Column 2: Prompt Configuration */}
                <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto pr-1 no-scrollbar">
                    <PromptConfig
                        systemPrompt={systemPrompt}
                        setSystemPrompt={setSystemPrompt}
                        userTemplate={userTemplate}
                        setUserTemplate={setUserTemplate}
                        mode={mode}
                        setMode={setMode}
                    />
                </div>

                {/* Column 3: Results Panel */}
                <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden relative">
                    <ResultPanel
                        result={result}
                        loading={loading}
                        error={error}
                    />
                </div>
            </div>

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
