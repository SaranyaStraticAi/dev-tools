'use client';

import { useState } from 'react';
import { NewsletterType, RedditPost, SAMPLE_REDDIT_POSTS } from '../constants';
import {
    WEEKLY_SYSTEM_PROMPT, WEEKLY_USER_TEMPLATE,
    PUZZLE_SYSTEM_PROMPT, PUZZLE_USER_TEMPLATE,
} from '../constants';

interface PromptEditorProps {
    weeklySystem: string;
    weeklyUser: string;
    puzzleSystem: string;
    puzzleUser: string;
    onWeeklySystemChange: (v: string) => void;
    onWeeklyUserChange:   (v: string) => void;
    onPuzzleSystemChange: (v: string) => void;
    onPuzzleUserChange:   (v: string) => void;
    onClose: () => void;
    defaultTab?: NewsletterType;
    lastPublishedAt?: string;
    posts?: RedditPost[]; // live posts from parent — so preview shows real data
}

export default function PromptEditor({
    weeklySystem, weeklyUser, puzzleSystem, puzzleUser,
    onWeeklySystemChange, onWeeklyUserChange,
    onPuzzleSystemChange, onPuzzleUserChange,
    onClose,
    defaultTab = 'weekly',
    lastPublishedAt,
    posts = SAMPLE_REDDIT_POSTS,
}: PromptEditorProps) {
    const [activeTab,    setActiveTab]    = useState<NewsletterType>(defaultTab);
    const [showExpanded, setShowExpanded] = useState(false);

    const isWeekly  = activeTab === 'weekly';
    const system    = isWeekly ? weeklySystem : puzzleSystem;
    const userTmpl  = isWeekly ? weeklyUser   : puzzleUser;
    const setSystem = isWeekly ? onWeeklySystemChange : onPuzzleSystemChange;
    const setUser   = isWeekly ? onWeeklyUserChange   : onPuzzleUserChange;
    const resetSys  = () => setSystem(isWeekly ? WEEKLY_SYSTEM_PROMPT : PUZZLE_SYSTEM_PROMPT);
    const resetUsr  = () => setUser(isWeekly ? WEEKLY_USER_TEMPLATE   : PUZZLE_USER_TEMPLATE);

    // Actual runtime values for each token
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const postsStr = posts.map(p =>
        `#${p.rank} [${p.flair}] ${p.title}\n   Upvotes: ${p.upvotes} | Comments: ${p.comments} | Posted: ${p.created_utc}\n   URL: ${p.url}`
    ).join('\n\n');

    return (
        <div className="w-full border rounded-2xl bg-card shadow-lg overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/40">
                <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold">✏️ Edit Prompts</span>
                    {lastPublishedAt && (
                        <span className="text-[9px] bg-green-500/15 text-green-500 border border-green-500/25 px-2 py-0.5 rounded-full font-mono">
                            ☁️ Azure · {new Date(lastPublishedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
                <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">✕ Close</button>
            </div>

            {/* Tab switcher */}
            <div className="px-5 pt-4 pb-0">
                <div className="flex gap-1 p-1 bg-muted rounded-xl border w-fit">
                    <button onClick={() => setActiveTab('weekly')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'weekly' ? 'bg-green-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                        📅 Thursday Weekly
                    </button>
                    <button onClick={() => setActiveTab('puzzle')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'puzzle' ? 'bg-purple-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                        🧩 Tuesday Puzzle
                    </button>
                </div>
                <div className="mt-3 mb-4 p-3 rounded-xl bg-muted/30 border text-[11px] text-muted-foreground leading-relaxed">
                    {activeTab === 'weekly' ? (
                        <><strong className="text-foreground">Thursday Weekly</strong> — Pain+Solution formula, 300–450 words, opens with trader pain, delivers insight, one CTA link.
                        <span className="block mt-1 text-[10px] opacity-70">System prompt = full playbook brief. User prompt = tells AI to find the pain and write weekly format.</span></>
                    ) : (
                        <><strong className="text-foreground">Tuesday Puzzle</strong> — MCQ trading scenario, 80–120 words setup, 4 options A B C D, leaderboard line, reply hook.
                        <span className="block mt-1 text-[10px] opacity-70">System prompt = same playbook brief. User prompt = tells AI to write MCQ puzzle format.</span></>
                    )}
                </div>
            </div>

            <div className="px-5 pb-5 flex flex-col gap-4">

                {/* System prompt */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">System prompt</label>
                        <button onClick={resetSys} className="text-[10px] text-purple-500 font-bold hover:underline">Reset to default</button>
                    </div>
                    <textarea value={system} onChange={e => setSystem(e.target.value)}
                        className={`w-full h-56 p-4 font-mono text-xs border rounded-xl bg-background outline-none leading-relaxed resize-y focus:ring-2 ${activeTab === 'weekly' ? 'focus:ring-green-500' : 'focus:ring-purple-500'}`}/>
                </div>

                {/* User prompt */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">User prompt</label>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${activeTab === 'weekly' ? 'bg-green-500/15 text-green-600' : 'bg-purple-500/15 text-purple-500'}`}>
                                {activeTab === 'weekly' ? 'thursday-specific' : 'puzzle-specific'}
                            </span>
                        </div>
                        <button onClick={resetUsr} className="text-[10px] text-purple-500 font-bold hover:underline">Reset</button>
                    </div>
                    <textarea value={userTmpl} onChange={e => setUser(e.target.value)}
                        className={`w-full min-h-[130px] p-4 font-mono text-[11px] border rounded-xl bg-background outline-none resize-y focus:ring-2 ${activeTab === 'weekly' ? 'focus:ring-green-500' : 'focus:ring-purple-500'}`}/>

                    {/* ── What the AI receives — hover pills for tooltips, expand for full view ── */}
                    <div className="border rounded-xl bg-muted/20 overflow-visible">
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">What the AI receives</span>

                                {/* {date} pill with tooltip */}
                                <span className="relative group cursor-default">
                                    <span className="text-[9px] bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded font-mono font-bold border border-orange-500/20 select-none">{'{date}'}</span>
                                    <span className="absolute bottom-full left-0 mb-2 z-50 hidden group-hover:block pointer-events-none">
                                        <span className="block bg-card border border-border rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                                            <span className="block text-[9px] text-muted-foreground mb-0.5">replaces with →</span>
                                            <span className="text-[11px] font-mono text-orange-500 font-bold">{todayStr}</span>
                                        </span>
                                        <span className="block w-0 h-0 ml-3" style={{borderLeft:'5px solid transparent',borderRight:'5px solid transparent',borderTop:'5px solid var(--color-border-secondary)'}}/>
                                    </span>
                                </span>

                                {/* {posts} pill with tooltip */}
                                <span className="relative group cursor-default">
                                    <span className="text-[9px] bg-blue-500/20 text-blue-500 px-1.5 py-0.5 rounded font-mono font-bold border border-blue-500/20 select-none">{'{posts}'}</span>
                                    <span className="absolute bottom-full left-0 mb-2 z-50 hidden group-hover:block pointer-events-none w-80">
                                        <span className="block bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
                                            <span className="block text-[9px] text-muted-foreground mb-1">replaces with {posts.length} Reddit posts →</span>
                                            <span className="block whitespace-pre-wrap text-[10px] font-mono text-foreground max-h-40 overflow-y-auto">{postsStr.slice(0, 500)}{postsStr.length > 500 ? '\n…' : ''}</span>
                                        </span>
                                        <span className="block w-0 h-0 ml-3" style={{borderLeft:'5px solid transparent',borderRight:'5px solid transparent',borderTop:'5px solid var(--color-border-secondary)'}}/>
                                    </span>
                                </span>
                            </div>

                            <button onClick={() => setShowExpanded(v => !v)}
                                className="text-[9px] text-muted-foreground hover:text-foreground font-bold transition-colors">
                                {showExpanded ? 'collapse ▲' : 'expand full prompt ▼'}
                            </button>
                        </div>

                        {/* Collapsed — template with tokens highlighted */}
                        {!showExpanded && (
                            <div className="px-3 py-2.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-muted-foreground max-h-20 overflow-hidden relative select-none">
                                {userTmpl.split(/(\{date\}|\{posts\})/).map((part, i) => {
                                    if (part === '{date}')  return <mark key={i} className="bg-orange-500/25 text-orange-500 rounded px-0.5 not-italic font-bold">{'{date}'}</mark>;
                                    if (part === '{posts}') return <mark key={i} className="bg-blue-500/25 text-blue-500 rounded px-0.5 not-italic font-bold">{'{posts}'}</mark>;
                                    return <span key={i}>{part}</span>;
                                })}
                                <span className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-muted/30 to-transparent pointer-events-none"/>
                            </div>
                        )}

                        {/* Expanded — fully resolved, exactly what AI gets */}
                        {showExpanded && (
                            <div className="px-3 py-2.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-foreground max-h-96 overflow-y-auto">
                                <span className="text-[9px] text-green-500 font-bold block mb-1.5">Fully resolved — this is exactly what the AI receives:</span>
                                {userTmpl.replace('{date}', todayStr).replace('{posts}', postsStr)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tip */}
                <div className="text-[10px] text-muted-foreground bg-muted/20 border rounded-lg p-3 leading-relaxed">
                    💡 Changes here apply immediately — click <strong className="text-foreground">📅 Thursday Weekly</strong> or <strong className="text-foreground">🧩 Tuesday Puzzle</strong> to regenerate with the new prompts.
                </div>
            </div>
        </div>
    );
}
