'use client';

// ─────────────────────────────────────────────────────────────────────────────
// useNewsletterPage.ts — all state and all functions for the newsletter tester
// Extracted from page.tsx so the page itself stays clean and readable.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
    NewsletterType, RedditPost, SAMPLE_REDDIT_POSTS,
    WEEKLY_SYSTEM_PROMPT, WEEKLY_USER_TEMPLATE,
    PUZZLE_SYSTEM_PROMPT, PUZZLE_USER_TEMPLATE,
} from '../constants';
import { parseNewsletter, renderTemplate } from '../components/emailUtils';
import { formatPosts } from '../components/utils';

export function useNewsletterPage() {
    const [type, setType] = useState<NewsletterType>('weekly');

    // ── AI prompt state ───────────────────────────────────────────────────────
    const [weeklySystem, setWeeklySystem] = useState(WEEKLY_SYSTEM_PROMPT);
    const [weeklyUser,   setWeeklyUser]   = useState(WEEKLY_USER_TEMPLATE);
    const [puzzleSystem, setPuzzleSystem] = useState(PUZZLE_SYSTEM_PROMPT);
    const [puzzleUser,   setPuzzleUser]   = useState(PUZZLE_USER_TEMPLATE);
    const [showPrompts,  setShowPrompts]  = useState(false);

    // ── Reddit posts state ────────────────────────────────────────────────────
    const [posts,           setPosts]           = useState<RedditPost[]>(SAMPLE_REDDIT_POSTS);
    const [fetchingReddit,  setFetchingReddit]  = useState(false);
    const [redditFetchedAt, setRedditFetchedAt] = useState<string | undefined>(undefined);
    const [redditError,     setRedditError]     = useState('');

    // ── Azure sync state ──────────────────────────────────────────────────────
    const [promptsLoading,  setPromptsLoading]  = useState(true);
    const [publishing,      setPublishing]      = useState(false);
    const [publishStatus,   setPublishStatus]   = useState<'idle'|'success'|'error'>('idle');
    const [azureSource,     setAzureSource]     = useState(false);
    const [lastPublishedAt, setLastPublishedAt] = useState<string | undefined>(undefined);

    // ── Template state — loaded from blob, blob is source of truth ────────────
    const [weeklyTemplate, setWeeklyTemplate] = useState('');
    const [puzzleTemplate, setPuzzleTemplate] = useState('');
    const [blobLoadError,  setBlobLoadError]  = useState('');

    // ── Template editor UI ────────────────────────────────────────────────────
    const [templateType, setTemplateType] = useState<NewsletterType>('weekly');

    // ── Output state ──────────────────────────────────────────────────────────
    const [rawText,   setRawText]   = useState('');
    const [bannerUrl, setBannerUrl] = useState('');
    const [emailHtml, setEmailHtml] = useState('');
    const [loading,   setLoading]   = useState(false);
    const [step,      setStep]      = useState('');
    const [error,     setError]     = useState('');

    // ── On mount: load prompts + templates from Azure Blob ───────────────────
    useEffect(() => {
        (async () => {
            try {
                const res  = await fetch('/api/newsletter-prompts');
                if (!res.ok) throw new Error('fetch failed');
                const data = await res.json();
                if (data.exists && data.prompts) {
                    const p = data.prompts;
                    if (p.weeklySystem)   setWeeklySystem(p.weeklySystem);
                    if (p.weeklyUser)     setWeeklyUser(p.weeklyUser);
                    if (p.puzzleSystem)   setPuzzleSystem(p.puzzleSystem);
                    if (p.puzzleUser)     setPuzzleUser(p.puzzleUser);
                    if (p.weeklyTemplate) setWeeklyTemplate(p.weeklyTemplate);
                    if (p.puzzleTemplate) setPuzzleTemplate(p.puzzleTemplate);
                    if (p.publishedAt)    setLastPublishedAt(p.publishedAt);
                    setAzureSource(true);
                    if (!p.weeklyTemplate || !p.puzzleTemplate) {
                        setBlobLoadError('⚠️ Templates missing from blob — publish from dev-tools to fix');
                    }
                } else {
                    setBlobLoadError('⚠️ Blob has no prompts yet — publish once to initialise');
                }
            } catch (e: any) {
                setBlobLoadError(`⚠️ Could not load from Azure: ${e.message}`);
            } finally {
                setPromptsLoading(false);
            }
        })();
    }, []);

    // ── Publish current prompts + templates to Azure ──────────────────────────
    const publishToAzure = async () => {
        setPublishing(true); setPublishStatus('idle');
        try {
            const res = await fetch('/api/newsletter-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weeklySystem, weeklyUser, puzzleSystem, puzzleUser, weeklyTemplate, puzzleTemplate }),
            });
            if (!res.ok) throw new Error('Publish failed');
            setPublishStatus('success'); setAzureSource(true);
            setLastPublishedAt(new Date().toISOString());
            setTimeout(() => setPublishStatus('idle'), 4000);
        } catch {
            setPublishStatus('error');
            setTimeout(() => setPublishStatus('idle'), 4000);
        } finally { setPublishing(false); }
    };

    // ── Fetch live Reddit posts ───────────────────────────────────────────────
    const fetchLiveReddit = async () => {
        setFetchingReddit(true); setRedditError('');
        try {
            const res  = await fetch('/api/reddit-posts?subreddit=Forex&t=week&limit=10');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fetch failed');
            setPosts(data.posts); setRedditFetchedAt(data.fetchedAt);
        } catch (e: any) { setRedditError(e.message); }
        finally { setFetchingReddit(false); }
    };

    // ── Handle inline template edits (re-renders preview live) ───────────────
    const handleTemplateChange = (val: string) => {
        if (templateType === 'weekly') setWeeklyTemplate(val);
        else setPuzzleTemplate(val);
        // If there's already a generated result for this type, re-render live
        if (rawText && templateType === type && type === 'weekly') {
            setEmailHtml(renderTemplate(val, parseNewsletter(rawText), 'weekly', bannerUrl));
        }
    };

    // ── Reload a single template from Azure ──────────────────────────────────
    const reloadTemplateFromAzure = async (t: NewsletterType) => {
        const res  = await fetch('/api/newsletter-prompts');
        const data = await res.json();
        if (data.exists && data.prompts) {
            if (t === 'weekly' && data.prompts.weeklyTemplate) setWeeklyTemplate(data.prompts.weeklyTemplate);
            if (t === 'puzzle' && data.prompts.puzzleTemplate) setPuzzleTemplate(data.prompts.puzzleTemplate);
        }
    };

    // ── Generate newsletter via AI ────────────────────────────────────────────
    const handleGenerate = async (chosenType: NewsletterType) => {
        const tmplToUse = chosenType === 'weekly' ? weeklyTemplate : puzzleTemplate;
        if (!tmplToUse || tmplToUse.startsWith('<!--')) {
            setError('Template not loaded from Azure yet. Wait for blob to load or publish first.');
            return;
        }
        setType(chosenType); setLoading(true); setError(''); setRawText(''); setEmailHtml(''); setBannerUrl('');
        const sys    = chosenType === 'weekly' ? weeklySystem : puzzleSystem;
        const tmpl   = chosenType === 'weekly' ? weeklyUser   : puzzleUser;
        const today  = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const prompt = tmpl.replace('{date}', today).replace('{posts}', formatPosts(posts));
        try {
            setStep('🤖 Writing newsletter...');
            const res  = await fetch('/api/newsletter-generate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt: sys, userPrompt: prompt }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Generation failed');
            const raw = data.text as string;
            setRawText(raw);

            const parsed = parseNewsletter(raw);
            let finalBannerUrl = '';
            
            // 2. Generate banner PNG and upload to Azure
            if (chosenType === 'weekly' && parsed.subject) {
                setStep('🖼️ Generating banner image...');
                try {
                    const bannerRes = await fetch('/api/generate-banner', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subject: parsed.subject })
                    });
                    if (bannerRes.ok) {
                        const bannerData = await bannerRes.json();
                        finalBannerUrl = bannerData.url;
                        setBannerUrl(finalBannerUrl);
                    }
                } catch (err) {
                    console.error('Banner generation failed:', err);
                }
            }

            setStep('🌐 Building HTML...');
            const htmlTmpl = chosenType === 'weekly' ? weeklyTemplate : puzzleTemplate;
            setEmailHtml(renderTemplate(htmlTmpl, parsed, chosenType, finalBannerUrl));
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); setStep(''); }
    };

    // ── Download current HTML ─────────────────────────────────────────────────
    const downloadHtml = () => {
        if (!emailHtml) return;
        const blob = new Blob([emailHtml], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${new Date().toISOString().slice(0,10)}_${type === 'weekly' ? 'thursday' : 'tuesday'}_${type}.html`;
        a.click(); URL.revokeObjectURL(url);
    };

    // ── Derived values ────────────────────────────────────────────────────────
    const parsed = rawText ? parseNewsletter(rawText) : null;

    return {
        // Types
        type, templateType, setTemplateType,
        // Prompts
        weeklySystem, setWeeklySystem,
        weeklyUser,   setWeeklyUser,
        puzzleSystem, setPuzzleSystem,
        puzzleUser,   setPuzzleUser,
        showPrompts,  setShowPrompts,
        // Reddit
        posts, setPosts,
        fetchingReddit, redditFetchedAt, redditError,
        fetchLiveReddit,
        resetReddit: () => { setPosts(SAMPLE_REDDIT_POSTS); setRedditFetchedAt(undefined); setRedditError(''); },
        // Azure
        promptsLoading, publishing, publishStatus,
        azureSource, lastPublishedAt,
        blobLoadError,
        publishToAzure,
        // Templates
        weeklyTemplate, puzzleTemplate,
        handleTemplateChange, reloadTemplateFromAzure,
        // Output
        rawText, emailHtml, loading, step, error,
        parsed,
        handleGenerate, downloadHtml,
    };
}
