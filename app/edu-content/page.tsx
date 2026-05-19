'use client';

import { useState } from 'react';

// ── Default prompts (mirrors vibe-edu-content Python scripts) ──────────────

const DEFAULT_TOPIC_PROMPT = `You are a senior forex and financial markets educator.

You will receive:
- A summary of today's forex/market news plus key points
- A list of upcoming economic events this week

Your job is to decide the BEST trading concepts to teach traders today.
The concepts must be directly relevant to today's news or this week's events.
Pick concepts that will genuinely help traders understand what is happening in the market RIGHT NOW.

Rules:
- Choose concepts that are actionable and educational, not just a news summary.
- Each concept must be a real trading/forex topic (e.g. "Non-Farm Payrolls and USD Volatility", "How CPI Data Moves Forex Pairs", "Trading the FOMC Decision", "Bollinger Band Squeeze", etc.)
- Assign a difficulty: Beginner, Intermediate, or Advanced — based on how complex the concept is.
- Write a short reason (1 sentence) explaining why this topic is relevant TODAY.

Respond ONLY with a valid JSON list of objects. No markdown. No explanation outside the JSON.
Format:
[
  {
    "topic": "<concept name>",
    "difficulty": "Beginner" | "Intermediate" | "Advanced",
    "reason": "<why this is relevant today>"
  }
]`;

const DEFAULT_LESSON_PROMPT = `# ROLE
You are a Financial Educator and Visual Designer. You create premium "Educational Cards" for traders.

# GOAL
Explain a specific trading or financial concept clearly and visually.

# STYLE
Format: Square 1:1 ratio.
- Background: Deep blueprint blue (#002b5c) or clean dark charcoal.
- Aesthetic: Technical, precise, clean. Think "Modern Textbook" meets "Bloomberg Terminal".
- Visuals: Use schematic diagrams, technical lines, or symbols related to the topic.

# CARD STRUCTURE
1. **Title**: The name of the concept (Large, Bold).
2. **The "What"**: A 1-sentence simple definition.
3. **The "How it Works"**: 3 clear bullet points or a simple step-by-step.
4. **The "Why it Matters"**: One key takeaway for a trader.
5. **Difficulty Badge**: (Beginner / Intermediate / Advanced).

# OUTPUT FORMAT
## LESSON PLAN
[Detailed breakdown of the text]

## FINAL IMAGE PROMPT
Create a premium technical blueprint-style educational card for: [Topic].
Include large white bold title: [Topic].
Design should be clean with white technical lines and schematic icons on a deep blue background.
Avoid cluttered text; use clear hierarchy and elegant spacing.
Style: Minimalist Infographic x Apple Design x Bloomberg Editorial.`;

// ── Types ──────────────────────────────────────────────────────────────────
type Stage = 'idle' | 'fetching-context' | 'picking-topic' | 'writing-lesson' | 'generating-image' | 'done' | 'error';

interface TopicResult { topic: string; difficulty: string; reason: string; }

const DIFFICULTY_COLOR: Record<string, string> = {
    Beginner:     'bg-green-500/20 text-green-400 border-green-500/30',
    Intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Advanced:     'bg-red-500/20 text-red-400 border-red-500/30',
};

function extractImagePrompt(lesson: string): string {
    const match = lesson.match(/##\s*FINAL IMAGE PROMPT\s*\n([\s\S]*)/i);
    if (match) return match[1].trim().split(/\n---\s*$/)[0].trim();
    return lesson.trim();
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function EduContentPage() {
    const [topicPrompt,  setTopicPrompt]  = useState(DEFAULT_TOPIC_PROMPT);
    const [lessonPrompt, setLessonPrompt] = useState(DEFAULT_LESSON_PROMPT);
    const [showPrompts,  setShowPrompts]  = useState(false);
    const [activeTab,    setActiveTab]    = useState<'topic' | 'lesson'>('topic');

    const [stage,   setStage]   = useState<Stage>('idle');
    const [stepMsg, setStepMsg] = useState('');
    const [error,   setError]   = useState('');

    const [topicResult,  setTopicResult]  = useState<TopicResult | null>(null);
    const [lessonText,   setLessonText]   = useState('');
    const [imageDataUrl, setImageDataUrl] = useState('');
    const [newsItems,    setNewsItems]    = useState<string[]>([]);
    const [calItems,     setCalItems]     = useState<string[]>([]);

    const isRunning = stage !== 'idle' && stage !== 'done' && stage !== 'error';

    async function handleGenerate() {
        setStage('fetching-context');
        setStepMsg('📡 Fetching live forex news & economic calendar…');
        setError('');
        setTopicResult(null);
        setLessonText('');
        setImageDataUrl('');
        setNewsItems([]);
        setCalItems([]);

        try {
            // ── Step 1: Pick topic ──────────────────────────────────────────
            setStage('picking-topic');
            setStepMsg('🤖 GPT is picking today\'s best topic…');

            const topicRes = await fetch('/api/edu-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step: 'topic', topicPrompt }),
            });
            const topicData = await topicRes.json();
            if (!topicData.ok) throw new Error(topicData.error || 'Topic pick failed');

            setTopicResult(topicData.topic);
            setNewsItems(topicData.news  || []);
            setCalItems(topicData.calendar || []);

            // ── Step 2: Write lesson ────────────────────────────────────────
            setStage('writing-lesson');
            setStepMsg(`✏️ Writing lesson for "${topicData.topic.topic}"…`);

            const lessonRes = await fetch('/api/edu-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    step: 'lesson',
                    lessonPrompt,
                    topic:      topicData.topic.topic,
                    difficulty: topicData.topic.difficulty,
                }),
            });
            const lessonData = await lessonRes.json();
            if (!lessonData.ok) throw new Error(lessonData.error || 'Lesson failed');
            setLessonText(lessonData.lesson);

            // ── Step 3: Get image API config ────────────────────────────────
            setStage('generating-image');
            setStepMsg('🎨 Generating visual card via GPT-Image-2… (this takes ~30s)');

            const cfgRes  = await fetch('/api/edu-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step: 'image-config' }),
            });
            const cfg = await cfgRes.json();
            if (cfg.error) throw new Error(cfg.error);

            const cleanPrompt = extractImagePrompt(lessonData.lesson);
            let imgRes: Response | null = null;
            let lastErrorMsg = '';

            // Retry loop up to 3 attempts with exponential backoff
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    if (attempt > 1) {
                        const delay = attempt === 2 ? 4000 : 8000;
                        setStepMsg(`🎨 Azure DALL-E busy (429). Retrying in ${delay / 1000}s (Attempt ${attempt}/3)…`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        setStepMsg('🎨 Generating visual card via GPT-Image-2… (this takes ~30s)');
                    }

                    imgRes = await fetch(cfg.url, {
                        method: 'POST',
                        headers: { 'api-key': cfg.apiKey, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: cfg.deployment, prompt: cleanPrompt, n: 1, size: '1024x1024' }),
                        signal: AbortSignal.timeout(120000),
                    });

                    if (imgRes.ok) {
                        break;
                    } else {
                        const errText = await imgRes.text();
                        lastErrorMsg = `Image API ${imgRes.status}: ${errText}`;
                        // If it's a 429, we definitely want to retry
                        if (imgRes.status !== 429) {
                            throw new Error(lastErrorMsg);
                        }
                    }
                } catch (e: any) {
                    lastErrorMsg = e.message || 'Unknown network error';
                    if (attempt === 3) {
                        throw new Error(lastErrorMsg);
                    }
                }
            }

            if (!imgRes || !imgRes.ok) {
                throw new Error(lastErrorMsg || 'Image generation failed');
            }

            const imgData = await imgRes.json();
            const item    = imgData.data?.[0];
            if (item?.b64_json) {
                setImageDataUrl(`data:image/png;base64,${item.b64_json}`);
            } else if (item?.url) {
                setImageDataUrl(item.url);
            } else {
                throw new Error('No image data returned');
            }

            setStage('done');
            setStepMsg('');
        } catch (e: any) {
            setError(e.message || 'Something went wrong');
            setStage('error');
            setStepMsg('');
        }
    }

    return (
        <div className="flex flex-col items-center min-h-screen bg-background py-10 px-4 gap-8">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="text-center">
                <h1 className="text-2xl font-bold tracking-tight">🎓 Edu Content Tester</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Generate · edit prompts · preview lesson card · see image
                </p>
            </div>

            {/* ── Generate button ──────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleGenerate}
                    disabled={isRunning}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg"
                >
                    {isRunning
                        ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full"/>{' '}Running…</>
                        : '▶ Generate Lesson Card'}
                </button>
                <button
                    onClick={() => setShowPrompts(v => !v)}
                    className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${showPrompts ? 'bg-muted border-border text-foreground' : 'text-muted-foreground hover:text-foreground border-border'}`}
                >
                    ✏️ {showPrompts ? 'Hide' : 'Edit'} Prompts
                </button>
            </div>

            {/* ── Live step indicator ──────────────────────────────────────── */}
            {isRunning && stepMsg && (
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border bg-card shadow-sm">
                    <span className="w-3.5 h-3.5 border-2 border-muted border-t-foreground animate-spin rounded-full"/>
                    <span className="text-sm text-muted-foreground animate-pulse">{stepMsg}</span>
                </div>
            )}

            {/* ── Error ───────────────────────────────────────────────────── */}
            {stage === 'error' && error && (
                <div className="w-full max-w-3xl p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm text-center">
                    ❌ {error}
                </div>
            )}

            {/* ── Topic result card ────────────────────────────────────────── */}
            {topicResult && (
                <div className="w-full max-w-3xl border rounded-2xl bg-card shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b bg-muted/40 flex items-center gap-2">
                        <span className="text-sm font-bold">📌 GPT Picked Topic</span>
                    </div>
                    <div className="px-5 py-4 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <p className="text-base font-bold">{topicResult.topic}</p>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${DIFFICULTY_COLOR[topicResult.difficulty] || 'bg-muted text-muted-foreground border-border'}`}>
                                {topicResult.difficulty}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">💡 {topicResult.reason}</p>
                    </div>
                </div>
            )}

            {/* ── Context used (news + calendar) ──────────────────────────── */}
            {(newsItems.length > 0 || calItems.length > 0) && (
                <details className="w-full max-w-3xl border rounded-2xl bg-card shadow-sm overflow-hidden group">
                    <summary className="px-5 py-3 cursor-pointer text-sm font-bold flex items-center gap-2 select-none list-none border-b bg-muted/40">
                        <span>📡 Context fed to GPT</span>
                        <span className="ml-auto text-muted-foreground text-xs group-open:hidden">▼ expand</span>
                        <span className="ml-auto text-muted-foreground text-xs hidden group-open:inline">▲ collapse</span>
                    </summary>
                    <div className="px-5 py-4 flex flex-col gap-4">
                        {newsItems.length > 0 && (
                            <div>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">News</p>
                                <ul className="flex flex-col gap-1">
                                    {newsItems.map((n, i) => <li key={i} className="text-xs text-muted-foreground leading-relaxed">• {n}</li>)}
                                </ul>
                            </div>
                        )}
                        {calItems.length > 0 && (
                            <div>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Economic Calendar</p>
                                <ul className="flex flex-col gap-1">
                                    {calItems.map((c, i) => <li key={i} className="text-xs font-mono text-muted-foreground">• {c}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                </details>
            )}

            {/* ── Lesson text ──────────────────────────────────────────────── */}
            {lessonText && (
                <div className="w-full max-w-3xl border rounded-2xl bg-card shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b bg-muted/40">
                        <span className="text-sm font-bold">📖 Generated Lesson</span>
                    </div>
                    <pre className="px-5 py-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">{lessonText}</pre>
                </div>
            )}

            {/* ── Generated image ──────────────────────────────────────────── */}
            {imageDataUrl && (
                <div className="w-full max-w-3xl border rounded-2xl bg-card shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b bg-muted/40 flex items-center justify-between">
                        <span className="text-sm font-bold">🖼️ Generated Card</span>
                        <a
                            href={imageDataUrl}
                            download={`edu-card-${topicResult?.topic?.replace(/\s+/g, '-') || 'lesson'}.png`}
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg transition-colors"
                        >
                            ⬇ Download
                        </a>
                    </div>
                    <div className="p-4">
                        <img
                            src={imageDataUrl}
                            alt="Generated educational card"
                            className="w-full rounded-xl shadow-lg"
                        />
                    </div>
                </div>
            )}

            {/* ── Prompt Editor ────────────────────────────────────────────── */}
            {showPrompts && (
                <div className="w-full max-w-3xl border rounded-2xl bg-card shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/40">
                        <span className="text-sm font-bold">✏️ Edit Prompts</span>
                        <button onClick={() => setShowPrompts(false)} className="text-xs text-muted-foreground hover:text-foreground">✕ Close</button>
                    </div>

                    {/* Tabs */}
                    <div className="px-5 pt-4">
                        <div className="flex gap-1 p-1 bg-muted rounded-xl border w-fit">
                            <button
                                onClick={() => setActiveTab('topic')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'topic' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                🎯 Topic Picker
                            </button>
                            <button
                                onClick={() => setActiveTab('lesson')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'lesson' ? 'bg-purple-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                📝 Lesson Writer
                            </button>
                        </div>

                        <div className="mt-3 mb-4 p-3 rounded-xl bg-muted/30 border text-[11px] text-muted-foreground leading-relaxed">
                            {activeTab === 'topic' ? (
                                <><strong className="text-foreground">Topic Picker</strong> — GPT reads today's live forex news + economic calendar and decides the best concept to teach. Must return valid JSON with topic, difficulty, reason.</>
                            ) : (
                                <><strong className="text-foreground">Lesson Writer</strong> — GPT writes the full lesson card and image prompt. The <code className="bg-muted px-1 rounded text-[10px]">## FINAL IMAGE PROMPT</code> section is extracted and sent to GPT-Image-2.</>
                            )}
                        </div>
                    </div>

                    <div className="px-5 pb-5">
                        {activeTab === 'topic' ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">System Prompt — Topic Picker</label>
                                    <button onClick={() => setTopicPrompt(DEFAULT_TOPIC_PROMPT)} className="text-[10px] text-blue-500 font-bold hover:underline">Reset to default</button>
                                </div>
                                <textarea
                                    value={topicPrompt}
                                    onChange={e => setTopicPrompt(e.target.value)}
                                    className="w-full h-72 p-4 font-mono text-xs border rounded-xl bg-background outline-none leading-relaxed resize-y focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">System Prompt — Lesson Writer</label>
                                    <button onClick={() => setLessonPrompt(DEFAULT_LESSON_PROMPT)} className="text-[10px] text-purple-500 font-bold hover:underline">Reset to default</button>
                                </div>
                                <textarea
                                    value={lessonPrompt}
                                    onChange={e => setLessonPrompt(e.target.value)}
                                    className="w-full h-72 p-4 font-mono text-xs border rounded-xl bg-background outline-none leading-relaxed resize-y focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                        )}

                        <p className="mt-3 text-[10px] text-muted-foreground bg-muted/20 border rounded-lg p-3 leading-relaxed">
                            💡 Changes apply immediately on next generate — prompts are not saved to Azure, they reset on page reload.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
