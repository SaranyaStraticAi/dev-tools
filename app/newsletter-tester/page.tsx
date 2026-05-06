'use client';

// ─────────────────────────────────────────────────────────────────────────────
// page.tsx — Newsletter Tester page
//
// This file is intentionally thin. All state/logic lives in:
//   hooks/useNewsletterPage.ts
//
// All UI sections live in separate components:
//   components/RedditPanel.tsx      — Reddit posts card
//   components/TemplateEditor.tsx   — HTML template editor card
//   components/OutputPanel.tsx      — Preview / HTML / Raw output tabs
//   components/ActionBar.tsx        — 4 main action buttons
//   components/PromptEditor.tsx     — Prompt editor drawer (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

import { useNewsletterPage } from './hooks/useNewsletterPage';
import RedditPanel    from './components/RedditPanel';
import TemplateEditor from './components/TemplateEditor';
import OutputPanel    from './components/OutputPanel';
import ActionBar      from './components/ActionBar';
import PromptEditor   from './components/PromptEditor';

export default function NewsletterTesterPage() {
    const {
        // types
        type, templateType, setTemplateType,
        // prompts
        weeklySystem, setWeeklySystem,
        weeklyUser,   setWeeklyUser,
        puzzleSystem, setPuzzleSystem,
        puzzleUser,   setPuzzleUser,
        showPrompts,  setShowPrompts,
        // reddit
        posts, setPosts,
        fetchingReddit, redditFetchedAt, redditError,
        fetchLiveReddit, resetReddit,
        // azure
        promptsLoading, publishing, publishStatus,
        azureSource, lastPublishedAt,
        blobLoadError,
        publishToAzure,
        // templates
        weeklyTemplate, puzzleTemplate,
        handleTemplateChange, reloadTemplateFromAzure,
        // output
        rawText, emailHtml, loading, step, error,
        parsed,
        handleGenerate, downloadHtml,
    } = useNewsletterPage();

    // ── Loading screen ────────────────────────────────────────────────────────
    if (promptsLoading) return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 animate-spin rounded-full"/>
                <p className="text-xs">Loading from Azure…</p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col items-center min-h-screen bg-background py-10 px-4 gap-8">

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="text-center">
                <h1 className="text-2xl font-bold tracking-tight">Newsletter Tester</h1>
                <p className="text-sm text-muted-foreground mt-1">Generate · edit prompts · edit template · preview · publish</p>
                <div className="mt-2 flex items-center justify-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${azureSource ? 'bg-green-500' : 'bg-yellow-500'}`}/>
                    <span className="text-[10px] text-muted-foreground">
                        {azureSource
                            ? `Loaded from Azure${lastPublishedAt ? ` · ${new Date(lastPublishedAt).toLocaleString()}` : ''}`
                            : 'Using local defaults'}
                    </span>
                </div>
            </div>

            {/* ── Azure / blob error banner ────────────────────────────────── */}
            {blobLoadError && (
                <div className="w-full max-w-3xl flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-600 dark:text-yellow-400 text-xs">
                    <span>{blobLoadError}</span>
                </div>
            )}

            {/* ── Reddit posts card ────────────────────────────────────────── */}
            <RedditPanel
                posts={posts}
                fetchingReddit={fetchingReddit}
                redditFetchedAt={redditFetchedAt}
                redditError={redditError}
                onFetchLive={fetchLiveReddit}
                onResetSamples={resetReddit}
                onPostsChange={setPosts}
            />

            {/* ── 4 action buttons ─────────────────────────────────────────── */}
            <ActionBar
                activeType={type}
                loading={loading}
                showPrompts={showPrompts}
                publishing={publishing}
                publishStatus={publishStatus}
                onGenerate={handleGenerate}
                onTogglePrompts={() => setShowPrompts(v => !v)}
                onPublish={publishToAzure}
            />

            {/* ── Publish success banner ───────────────────────────────────── */}
            {publishStatus === 'success' && (
                <div className="w-full max-w-3xl flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-xs">
                    <span>☁️</span><span><strong>Published to Azure.</strong> Python pipeline picks this up on next run.</span>
                </div>
            )}

            {/* ── Generation loading indicator ─────────────────────────────── */}
            {loading && (
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border bg-card shadow-sm">
                    <span className="w-3.5 h-3.5 border-2 border-muted border-t-foreground animate-spin rounded-full"/>
                    <span className="text-sm text-muted-foreground animate-pulse">{step}</span>
                </div>
            )}

            {/* ── Error message ────────────────────────────────────────────── */}
            {error && (
                <div className="w-full max-w-3xl p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm text-center">
                    ❌ {error}
                </div>
            )}

            {/* ── HTML Template editor card ────────────────────────────────── */}
            <TemplateEditor
                templateType={templateType}
                weeklyTemplate={weeklyTemplate}
                puzzleTemplate={puzzleTemplate}
                onTemplateTypeChange={setTemplateType}
                onTemplateChange={handleTemplateChange}
                onReloadFromAzure={reloadTemplateFromAzure}
            />

            {/* ── Output panel (Preview / HTML / Raw tabs) ─────────────────── */}
            {emailHtml && parsed && (
                <OutputPanel
                    emailHtml={emailHtml}
                    rawText={rawText}
                    parsed={parsed}
                    newsletterType={type}
                    onDownload={downloadHtml}
                />
            )}

            {/* ── Prompt editor drawer ─────────────────────────────────────── */}
            {showPrompts && (
                <div className="w-full max-w-3xl">
                    <PromptEditor
                        weeklySystem={weeklySystem} weeklyUser={weeklyUser}
                        puzzleSystem={puzzleSystem} puzzleUser={puzzleUser}
                        onWeeklySystemChange={setWeeklySystem} onWeeklyUserChange={setWeeklyUser}
                        onPuzzleSystemChange={setPuzzleSystem} onPuzzleUserChange={setPuzzleUser}
                        onClose={() => setShowPrompts(false)}
                        defaultTab={type}
                        lastPublishedAt={lastPublishedAt}
                    />
                </div>
            )}

        </div>
    );
}
