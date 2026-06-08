'use client';

// ─────────────────────────────────────────────────────────────────────────────
// useNewsletterPage.ts — all state and all functions for the newsletter tester
// Extracted from page.tsx so the page itself stays clean and readable.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import {
    NewsletterType, RedditPost, SAMPLE_REDDIT_POSTS,
    WEEKLY_SYSTEM_PROMPT, WEEKLY_USER_TEMPLATE,
    PUZZLE_SYSTEM_PROMPT, PUZZLE_USER_TEMPLATE,
} from '../constants';
import { parseNewsletter, renderTemplate, processPuzzleTokens } from '../components/emailUtils';
import { formatPosts } from '../components/utils';
import type { BroadcastMetrics } from '@/app/api/newsletter-metrics/route';
import type { PipelineLogEntry } from '../components/PipelineLog';

export type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

export function useNewsletterPage() {
    const [type, setType] = useState<NewsletterType>('weekly');

    // ── AI prompt state ───────────────────────────────────────────────────────
    const [weeklySystem, setWeeklySystem] = useState(WEEKLY_SYSTEM_PROMPT);
    const [weeklyUser,   setWeeklyUser]   = useState(WEEKLY_USER_TEMPLATE);
    const [puzzleSystem, setPuzzleSystem] = useState(PUZZLE_SYSTEM_PROMPT);
    const [puzzleUser,   setPuzzleUser]   = useState(PUZZLE_USER_TEMPLATE);
    const [showPrompts,  setShowPrompts]  = useState(false);

    // ── Reddit posts state ────────────────────────────────────────────────────
    const [posts,             setPosts]             = useState<RedditPost[]>(SAMPLE_REDDIT_POSTS);
    const [fetchingReddit,    setFetchingReddit]    = useState(false);
    const [redditFetchedAt,   setRedditFetchedAt]   = useState<string | undefined>(undefined);
    const [redditError,       setRedditError]       = useState('');
    const [redditFromBlob,    setRedditFromBlob]    = useState(false);
    const [redditSubsSource,  setRedditSubsSource]  = useState<string | undefined>(undefined);
    const [redditSubsUsed,    setRedditSubsUsed]    = useState<string[]>([]);

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

    // ── Resend state ──────────────────────────────────────────────────────────
    const [broadcastId,  setBroadcastId]  = useState<string | null>(null);
    const [segments,     setSegments]     = useState<any[]>([]);
    const [selectedSegs, setSelectedSegs] = useState<string[]>([]);
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendStatus,   setSendStatus]   = useState<SendStatus>('idle');
    const [sendError,    setSendError]    = useState('');
    const [metrics,      setMetrics]      = useState<BroadcastMetrics | null>(null);
    const metricsInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Pipeline log — persists after run so user can inspect every step ──────
    const [pipelineLog, setPipelineLog] = useState<PipelineLogEntry[]>([]);
    const pipelineLogRef = useRef<PipelineLogEntry[]>([]);

    // ── Persist generated pipeline state in localStorage ──────────────────────
    useEffect(() => {
        try {
            const savedRawText = localStorage.getItem('newsletter_rawText');
            if (savedRawText) setRawText(savedRawText);

            const savedEmailHtml = localStorage.getItem('newsletter_emailHtml');
            if (savedEmailHtml) setEmailHtml(savedEmailHtml);

            const savedBannerUrl = localStorage.getItem('newsletter_bannerUrl');
            if (savedBannerUrl) setBannerUrl(savedBannerUrl);

            const savedType = localStorage.getItem('newsletter_type') as NewsletterType | null;
            if (savedType) setType(savedType);

            const savedLog = localStorage.getItem('newsletter_pipelineLog');
            if (savedLog) {
                const parsedLog = JSON.parse(savedLog);
                setPipelineLog(parsedLog);
                pipelineLogRef.current = parsedLog;
            }
        } catch (e) {
            console.warn('[localStorage-load] failed to load state:', e);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('newsletter_rawText', rawText);
    }, [rawText]);

    useEffect(() => {
        localStorage.setItem('newsletter_emailHtml', emailHtml);
    }, [emailHtml]);

    useEffect(() => {
        localStorage.setItem('newsletter_bannerUrl', bannerUrl);
    }, [bannerUrl]);

    useEffect(() => {
        localStorage.setItem('newsletter_type', type);
    }, [type]);

    useEffect(() => {
        if (pipelineLog.length > 0) {
            localStorage.setItem('newsletter_pipelineLog', JSON.stringify(pipelineLog));
        } else {
            localStorage.removeItem('newsletter_pipelineLog');
        }
    }, [pipelineLog]);

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
                        setBlobLoadError('Templates missing from blob — publish from dev-tools to fix');
                    }
                } else {
                    setBlobLoadError('Blob has no prompts yet — publish once to initialise');
                }
            } catch (e: any) {
                setBlobLoadError(`Could not load from Azure: ${e.message}`);
            } finally {
                setPromptsLoading(false);
            }
        })();
    }, []);

    // ── Fetch segments on mount ──────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/resend-segments');
                if (!res.ok) return; // silently skip if resend isn't configured
                const data = await res.json();
                if (data.segments) setSegments(data.segments);
            } catch (e) {
                console.warn('[fetchSegments] error', e);
            }
        })();
    }, []);

    // ── On mount: load cached Reddit posts from Azure Blob ───────────────────
    // If blob has cached posts from a previous "Fetch Live Reddit", use those
    // instead of the hardcoded sample data. Falls back to samples silently.
    useEffect(() => {
        (async () => {
            try {
                const res  = await fetch('/api/reddit-posts?cached=1');
                if (!res.ok) return;
                const data = await res.json();
                if (data.exists && Array.isArray(data.posts) && data.posts.length > 0) {
                    setPosts(data.posts);
                    setRedditFetchedAt(data.fetchedAt);
                    setRedditFromBlob(true);
                }
            } catch (e) {
                console.warn('[reddit-blob-load] failed, using sample data:', e);
            }
        })();
    }, []);

    // ── Auto-poll metrics every 20s while a broadcast is live ─────────────────
    useEffect(() => {
        if (!broadcastId || broadcastId === 'emails-send' || sendStatus !== 'sent') {
            if (metricsInterval.current) {
                clearInterval(metricsInterval.current);
                metricsInterval.current = null;
            }
            return;
        }
        fetchMetrics(broadcastId);
        metricsInterval.current = setInterval(() => fetchMetrics(broadcastId), 20_000);
        return () => {
            if (metricsInterval.current) clearInterval(metricsInterval.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [broadcastId, sendStatus]);

    // ── Fetch metrics from our API ────────────────────────────────────────────
    const fetchMetrics = async (id: string) => {
        try {
            const res  = await fetch(`/api/newsletter-metrics?broadcastId=${id}`);
            const data = await res.json();
            if (res.ok && data.metrics) setMetrics(data.metrics);
        } catch (e) {
            console.warn('[fetchMetrics] error', e);
        }
    };

    // ── Send newsletter via Resend ────────────────────────────────────────────
    const handleSendViaResend = async () => {
        if (!emailHtml) { setSendError('Generate a newsletter first'); return; }
        const subject = rawText ? parseNewsletter(rawText).subject : 'Vibe Trader Newsletter';

        setSendStatus('sending'); setSendError(''); setBroadcastId(null); setMetrics(null);
        try {
            const res  = await fetch('/api/send-newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html: emailHtml, subject, segmentIds: selectedSegs, type }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Send failed');
            setBroadcastId(data.broadcastId);
            setSendStatus('sent');
        } catch (e: any) {
            setSendError(e.message ?? 'Unknown error');
            setSendStatus('error');
            setTimeout(() => setSendStatus('idle'), 5000);
        }
    };

    // ── Publish current prompts + templates to Azure ──────────────────────────
    const publishToAzure = async () => {
        setPublishing(true); setPublishStatus('idle');
        try {
            const res = await fetch('/api/newsletter-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // changedType tells the backend which newsletter tab is active
                // so it only creates a history snapshot for that type.
                body: JSON.stringify({ weeklySystem, weeklyUser, puzzleSystem, puzzleUser, weeklyTemplate, puzzleTemplate, changedType: type }),
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

    // ── Publish ONLY templates to Azure ─────────────────────────────────────────
    const publishTemplatesToAzure = async () => {
        setPublishing(true); setPublishStatus('idle');
        try {
            const res = await fetch('/api/newsletter-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weeklyTemplate, puzzleTemplate, changedType: type }),
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
    // rediscover=true → bypass 7-day blob cache, force fresh Reddit search + LLM pick
    const fetchLiveReddit = async (rediscover = false) => {
        setFetchingReddit(true); setRedditError('');
        try {
            const qs  = `limit=10&perSub=25${rediscover ? '&rediscover=1' : ''}`;
            const res  = await fetch(`/api/reddit-posts?${qs}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fetch failed');
            setPosts(data.posts);
            setRedditFetchedAt(data.fetchedAt);
            setRedditFromBlob(false);
            setRedditSubsSource(data.subredditsSource);
            setRedditSubsUsed(data.subredditsUsed || []);
        } catch (e: any) { setRedditError(e.message); }
        finally { setFetchingReddit(false); }
    };

    // ── Generate newsletter via FULL PIPELINE (7-tool SSE) ───────────────────
    // This replaces handleGenerate for the weekly newsletter.
    // Calls /api/newsletter-pipeline, reads the SSE stream, updates step
    // messages in real time, and populates all the same state as before.
    const handleGeneratePipeline = async (rediscover = false, pipelineType: NewsletterType = 'weekly') => {
        const tmplToUse = pipelineType === 'weekly' ? weeklyTemplate : puzzleTemplate;
        if (!tmplToUse || tmplToUse.startsWith('<!--')) {
            setError('Template not loaded from Azure yet. Wait for blob to load or publish first.');
            return;
        }
        setType(pipelineType);
        setLoading(true);
        setError('');
        setRawText('');
        setEmailHtml('');
        setBannerUrl('');
        setSendStatus('idle');
        setBroadcastId(null);
        setMetrics(null);
        setSendError('');

        // Reset pipeline log for this new run
        const initialLog: PipelineLogEntry[] = [];
        pipelineLogRef.current = initialLog;
        setPipelineLog([]);

        try {
            const res = await fetch('/api/newsletter-pipeline', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ rediscover, type: pipelineType }),
            });

            if (!res.ok || !res.body) {
                throw new Error(`Pipeline request failed: ${res.status}`);
            }

            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let   buffer  = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // Process all complete SSE events in the buffer
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // keep incomplete last line

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));

                        // ── Step metadata for the pipeline log ────────────────
                        const STEP_META: Record<string, { label: string; icon: string }> = {
                            discover: { label: 'Discover Subreddits',       icon: '🔍' },
                            pick:     { label: 'AI Pick Best Subreddits',   icon: '🤖' },
                            fetch:    { label: 'Fetch Reddit Posts',        icon: '📥' },
                            analyze:  { label: 'Deep Analysis (AI)',        icon: '🧠' },
                            news:     { label: 'Fetch Market News',         icon: '📰' },
                            write:    { label: 'Write Newsletter (AI)',     icon: '✍️' },
                            review:   { label: 'Compliance Review',         icon: '🛡️' },
                            banner:   { label: 'Generate Banner Image',     icon: '🖼️' },
                            complete: { label: 'Pipeline Complete',         icon: '✅' },
                        };

                        // Update step label in real time
                        const stepLabels: Record<string, string> = {
                            discover: '🔍 Searching Reddit for communities...',
                            pick:     '🤖 AI picking relevant subreddits...',
                            fetch:    '📥 Fetching posts from all subreddits...',
                            analyze:  '🧠 Reading all posts + comment threads...',
                            news:     '📰 Fetching market news context...',
                            write:    '✍️ Writing Thursday newsletter...',
                            review:   '🛡️ Reviewing for compliance...',
                            banner:   '🖼️ Generating banner image...',
                            complete: '✅ Newsletter ready',
                            error:    '❌ Pipeline error',
                        };
                        if (event.step && stepLabels[event.step]) {
                            setStep(event.status === 'done'
                                ? stepLabels[event.step].replace('...', ' ✓')
                                : stepLabels[event.step],
                            );
                        }

                        // ── Update pipeline log ───────────────────────────────
                        if (event.step && STEP_META[event.step]) {
                            const meta = STEP_META[event.step];
                            const now  = new Date().toISOString();
                            const log  = pipelineLogRef.current;
                            const existing = log.findIndex(e => e.step === event.step);

                            if (event.status === 'pending') {
                                // Add a new pending entry
                                const newEntry: PipelineLogEntry = {
                                    step:      event.step,
                                    label:     meta.label,
                                    icon:      meta.icon,
                                    status:    'pending',
                                    startedAt: now,
                                };
                                const updated = existing >= 0
                                    ? log.map((e, i) => i === existing ? newEntry : e)
                                    : [...log, newEntry];
                                pipelineLogRef.current = updated;
                                setPipelineLog([...updated]);
                            } else if (event.status === 'done') {
                                // Mark existing entry as done, attach data
                                const updated = log.map(e =>
                                    e.step === event.step
                                        ? { ...e, status: 'done' as const, completedAt: now, data: event.data || {} }
                                        : e
                                );
                                // If no pending entry existed yet (e.g. complete event), add it
                                const finalLog = updated.some(e => e.step === event.step)
                                    ? updated
                                    : [...updated, { step: event.step, label: meta.label, icon: meta.icon, status: 'done' as const, startedAt: now, completedAt: now, data: event.data || {} }];
                                pipelineLogRef.current = finalLog;
                                setPipelineLog([...finalLog]);
                            } else if (event.status === 'error') {
                                const updated = log.map(e =>
                                    e.step === event.step
                                        ? { ...e, status: 'error' as const, completedAt: now }
                                        : e
                                );
                                pipelineLogRef.current = updated;
                                setPipelineLog([...updated]);
                            }
                        }

                        // On completion — populate all state
                        if (event.step === 'complete' && event.data?.result) {
                            const result = event.data.result;
                            const raw    = result.rawText as string;
                            setRawText(raw);

                            // Update Reddit panel posts with what the pipeline used
                            if (result.usedPosts?.length) {
                                setPosts(result.usedPosts);
                                setRedditFetchedAt(new Date().toISOString());
                                setRedditFromBlob(false);
                                setRedditSubsSource('llm-picked');
                                setRedditSubsUsed(result.subredditsUsed || []);
                            }

                            // Build the HTML email
                            setStep('Building HTML...');
                            let parsed = parseNewsletter(raw);
                            if (pipelineType === 'puzzle') parsed = processPuzzleTokens(parsed);

                            const finalBannerUrl = result.bannerUrl || '';
                            if (finalBannerUrl) setBannerUrl(finalBannerUrl);
                            
                            const finalTemplate = result.weeklyTemplate || tmplToUse;
                            setEmailHtml(renderTemplate(finalTemplate, parsed, pipelineType, finalBannerUrl));
                        }

                        if (event.step === 'error') {
                            setError(event.message);
                        }
                    } catch { /* malformed SSE line — skip */ }
                }
            }
        } catch (e: any) {
            setError(e.message || 'Pipeline failed');
        } finally {
            setLoading(false);
            setStep('');
        }
    };
    const handleTemplateChange = (val: string) => {
        if (templateType === 'weekly') setWeeklyTemplate(val);
        else setPuzzleTemplate(val);
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
        setSendStatus('idle'); setBroadcastId(null); setMetrics(null); setSendError('');
        const sys    = chosenType === 'weekly' ? weeklySystem : puzzleSystem;
        const tmpl   = chosenType === 'weekly' ? weeklyUser   : puzzleUser;
        const today  = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        let prompt = tmpl.replace('{date}', today).replace('{posts}', formatPosts(posts));

        if (chosenType === 'weekly') {
            try {
                // 1. Pre-flight Topic Extraction
                setStep('Extracting key topic from Reddit...');
                const topicRes = await fetch('/api/newsletter-generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemPrompt: "You are a data extractor. Reply with ONLY the name of the primary currency pair, asset, or macroeconomic event mentioned in the text (e.g. XAU/USD, EUR/USD, CPI). If none, reply 'Forex Market'.",
                        userPrompt: formatPosts(posts)
                    })
                });
                const topicData = await topicRes.json();
                if (!topicRes.ok) throw new Error(topicData.error || 'Topic extraction failed');
                const extractedTopic = topicData.text.trim();

                // 2. Fetch Targeted NewsRAG Context
                setStep(`Fetching news for ${extractedTopic}...`);
                const newsRes = await fetch('/api/newsrag', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: extractedTopic, limit: 3, use_cache: true, format: 'json' })
                });
                
                if (!newsRes.ok) throw new Error(`NewsRAG API returned ${newsRes.status}`);
                const newsData = await newsRes.json();

                // Build the external sources string using NewsRAG's summary + referenceLinks
                const externalSources = `
MARKET SUMMARY FOR ${extractedTopic}:
${newsData.summary || 'No summary available.'}

SOURCES:
${newsData.referenceLinks?.map((l: any) => `- ${l.title}: ${l.url}`).join('\n') || 'None'}
`;
                prompt = prompt.replace('{external_sources}', externalSources.trim());
            } catch (e) {
                console.warn('Failed to fetch targeted news:', e);
                prompt = prompt.replace('{external_sources}', 'No external sources available');
            }
        }
        try {
            setStep('Writing newsletter...');
            const res  = await fetch('/api/newsletter-generate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt: sys, userPrompt: prompt }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Generation failed');
            const raw = data.text as string;
            setRawText(raw);

            let parsed = parseNewsletter(raw);
            if (chosenType === 'puzzle') parsed = processPuzzleTokens(parsed);

            let finalBannerUrl = '';
            if (chosenType === 'weekly' && parsed.subject) {
                setStep('Generating banner image...');
                try {
                    // Use newsletter_title (short 4-5 word title) for banner image text
                    // so the banner is visually distinct from the full email subject line.
                    const bannerTitle = parsed.newsletter_title?.trim() || parsed.subject;
                    const bannerRes = await fetch('/api/generate-banner', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subject: bannerTitle })
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

            setStep('Building HTML...');
            const htmlTmpl = chosenType === 'weekly' ? weeklyTemplate : puzzleTemplate;
            setEmailHtml(renderTemplate(htmlTmpl, parsed, chosenType, finalBannerUrl));
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); setStep(''); }
    };

    // ── Save for Later draft state ───────────────────────────────────────────
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState('');

    const handleSaveNewsletter = async () => {
        if (!emailHtml) {
            setSaveError('Generate a newsletter first');
            setSaveStatus('error');
            return;
        }
        const subject = parsed?.subject || (type === 'weekly' ? 'Thursday Weekly Newsletter' : 'Tuesday Puzzle Newsletter');
        
        setSaveStatus('saving');
        setSaveError('');
        try {
            const res = await fetch('/api/saved-newsletters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject,
                    body: emailHtml,
                    rawText,
                    type,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save newsletter');
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e: any) {
            setSaveError(e.message || 'Unknown error');
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 5000);
        }
    };

    // ── Restore a past version into editor state ──────────────────────────────
    const restoreVersion = (prompts: Record<string, any>) => {
        if (prompts.weeklySystem)   setWeeklySystem(prompts.weeklySystem);
        if (prompts.weeklyUser)     setWeeklyUser(prompts.weeklyUser);
        if (prompts.puzzleSystem)   setPuzzleSystem(prompts.puzzleSystem);
        if (prompts.puzzleUser)     setPuzzleUser(prompts.puzzleUser);
        if (prompts.weeklyTemplate) setWeeklyTemplate(prompts.weeklyTemplate);
        if (prompts.puzzleTemplate) setPuzzleTemplate(prompts.puzzleTemplate);
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

    // ── Clear generated state ──────────────────────────────────────────────────
    const handleClear = () => {
        setRawText('');
        setEmailHtml('');
        setBannerUrl('');
        setPipelineLog([]);
        localStorage.removeItem('newsletter_rawText');
        localStorage.removeItem('newsletter_emailHtml');
        localStorage.removeItem('newsletter_bannerUrl');
        localStorage.removeItem('newsletter_pipelineLog');
    };

    // ── Derived values ────────────────────────────────────────────────────────
    let parsed = rawText ? parseNewsletter(rawText) : null;
    if (parsed && type === 'puzzle') parsed = processPuzzleTokens(parsed);

    return {
        // Types
        type, setType, templateType, setTemplateType,
        // Prompts
        weeklySystem, setWeeklySystem,
        weeklyUser,   setWeeklyUser,
        puzzleSystem, setPuzzleSystem,
        puzzleUser,   setPuzzleUser,
        showPrompts,  setShowPrompts,
        // Reddit
        posts, setPosts,
        fetchingReddit, redditFetchedAt, redditError, redditFromBlob,
        redditSubsSource, redditSubsUsed,
        fetchLiveReddit,
        resetReddit: () => {
            setPosts(SAMPLE_REDDIT_POSTS);
            setRedditFetchedAt(undefined);
            setRedditError('');
            setRedditFromBlob(false);
            setRedditSubsSource(undefined);
            setRedditSubsUsed([]);
        },
        // Azure
        promptsLoading, publishing, publishStatus,
        azureSource, lastPublishedAt,
        blobLoadError,
        publishToAzure,
        publishTemplatesToAzure,
        restoreVersion,
        // Templates
        weeklyTemplate, puzzleTemplate,
        handleTemplateChange, reloadTemplateFromAzure,
        // Output
        rawText, emailHtml, loading, step, error,
        parsed,
        handleGenerate, handleGeneratePipeline, downloadHtml, handleClear,
        saveStatus, saveError, handleSaveNewsletter,
        // Resend
        broadcastId, sendStatus, sendError, metrics,
        handleSendViaResend, fetchMetrics,
        segments, selectedSegs, setSelectedSegs,
        showSendModal, setShowSendModal,
        // Pipeline log
        pipelineLog,
    };
}
