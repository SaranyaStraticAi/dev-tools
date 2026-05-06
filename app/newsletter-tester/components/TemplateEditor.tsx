'use client';

// ─────────────────────────────────────────────────────────────────────────────
// TemplateEditor.tsx — the collapsible HTML template editor card
// Shows token buttons the user can click to insert into the textarea,
// and a raw textarea to edit the HTML template.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { NewsletterType } from '../constants';
import { WEEKLY_TOKENS, PUZZLE_TOKENS } from './utils';

interface TemplateEditorProps {
    templateType: NewsletterType;
    weeklyTemplate: string;
    puzzleTemplate: string;
    onTemplateTypeChange: (t: NewsletterType) => void;
    onTemplateChange: (val: string) => void;
    onReloadFromAzure: (type: NewsletterType) => void;
}

export default function TemplateEditor({
    templateType,
    weeklyTemplate,
    puzzleTemplate,
    onTemplateTypeChange,
    onTemplateChange,
    onReloadFromAzure,
}: TemplateEditorProps) {
    const [showTemplate, setShowTemplate] = useState(false);

    const currentTemplate = templateType === 'weekly' ? weeklyTemplate : puzzleTemplate;
    const tokens          = templateType === 'weekly' ? WEEKLY_TOKENS : PUZZLE_TOKENS;

    return (
        <div className="w-full max-w-3xl border rounded-2xl overflow-hidden bg-card shadow-sm">

            {/* Clickable header — toggles collapse */}
            <div
                role="button" tabIndex={0}
                onClick={() => setShowTemplate(v => !v)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowTemplate(v => !v); } }}
                className="w-full px-5 py-3 border-b bg-muted/40 flex items-center justify-between flex-wrap gap-2 hover:bg-muted/60 transition-colors cursor-pointer select-none"
            >
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold">🗂 HTML Template</span>

                    {/* Weekly / Puzzle switcher — clicks don't bubble to the collapse toggle */}
                    <div
                        className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg border cursor-default"
                        onClick={e => e.stopPropagation()}
                    >
                        <button type="button" onClick={() => onTemplateTypeChange('weekly')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${templateType === 'weekly' ? 'bg-green-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            📅 Weekly
                        </button>
                        <button type="button" onClick={() => onTemplateTypeChange('puzzle')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${templateType === 'puzzle' ? 'bg-purple-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            🧩 Puzzle
                        </button>
                    </div>

                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        {showTemplate ? 'click to collapse' : 'all tokens from AI output available as {placeholders}'}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {showTemplate && (
                        <button type="button"
                            className="text-[10px] text-purple-500 font-bold hover:underline"
                            onClick={e => { e.stopPropagation(); onReloadFromAzure(templateType); }}>
                            Reload from Azure
                        </button>
                    )}
                    <span className={`text-muted-foreground text-xs transition-transform duration-200 ${showTemplate ? 'rotate-180' : ''}`}>▾</span>
                </div>
            </div>

            {/* Body — only shown when expanded */}
            {showTemplate && (
                <>
                    {/* Token buttons — click to append the token to the textarea */}
                    <div className="px-5 py-2 border-b bg-muted/20 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-bold">Tokens:</span>
                        {tokens.map(t => (
                            <button key={t}
                                onClick={() => onTemplateChange(currentTemplate + t)}
                                className="font-mono text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25 transition-all">
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Raw HTML textarea */}
                    <textarea
                        value={currentTemplate}
                        onChange={e => onTemplateChange(e.target.value)}
                        spellCheck={false}
                        className="w-full p-4 font-mono text-[10px] leading-relaxed bg-background text-foreground outline-none resize-none border-0"
                        style={{ height: '420px' }}
                    />
                </>
            )}
        </div>
    );
}
