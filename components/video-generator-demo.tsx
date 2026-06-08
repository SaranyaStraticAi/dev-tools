'use client';

import { useState, useRef } from 'react';
import {
  Sparkles, Download, Loader2, Video, RefreshCw,
  ChevronDown, ChevronUp, Clock, Settings2, Wand2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const DEFAULT_SYSTEM_PROMPT = `You are a Financial News Video Director for VibeTrader, an AI-powered forex trading platform.

Your job: Generate a precise, cinematic Sora 2 video prompt about financial markets.

RULES:
- Describe shot type first (aerial, close-up, tracking, wide, etc.)
- Describe the main subject and motion clearly
- Describe lighting, mood, and camera movement
- Keep under 200 words
- NO real people, NO faces, NO brand logos, NO copyrighted characters
- Use abstract financial visuals: empty trading floors, data streams, gold bars, oil, charts, cityscapes, currency

VISUAL VOCABULARY:
- Gold bars stacked on dark surface, warm amber light, camera circling slowly
- Abstract 3D data streams in deep blue space, numbers flying
- Empty trading floor at night, screens glowing green/red
- Dollar bills cascading in slow motion through dark space
- Stock chart lines animating with particle trails
- Dark storm clouds over bright financial district horizon
- Currency coins spinning in macro close-up

OUTPUT: Return ONLY the video prompt. No preamble, no labels, no markdown.`;

const DEFAULT_USER_PROMPT = `Create a cinematic financial market video about: {headline}

Make it visually dramatic and professional, suitable for VibeTrader social media.`;

const DURATION_OPTIONS = [
  { value: '4',  label: '4s',  desc: 'Quick' },
  { value: '8',  label: '8s',  desc: 'Balanced' },
  { value: '12', label: '12s', desc: 'Cinematic' },
];

const SIZE_OPTIONS = [
  { value: '1280x720', label: '1280×720', desc: 'Landscape' },
  { value: '720x1280', label: '720×1280', desc: 'Portrait'  },
  { value: '720x720',  label: '720×720',  desc: 'Square'    },
];

type GenStatus = 'idle' | 'prompting' | 'submitting' | 'polling' | 'downloading' | 'done' | 'error';

export default function VideoGeneratorDemo() {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt]     = useState(DEFAULT_USER_PROMPT);
  const [topic, setTopic]               = useState('');         // the {headline} variable
  const [soraPrompt, setSoraPrompt]     = useState('');         // GPT-4 generated, editable
  const [showAdvanced, setShowAdvanced] = useState(true);       // open by default
  const [seconds, setSeconds]           = useState('8');
  const [size, setSize]                 = useState('720x1280');
  const [status, setStatus]             = useState<GenStatus>('idle');
  const [statusMsg, setStatusMsg]       = useState('');
  const [pollSeconds, setPollSeconds]   = useState(0);
  const [videoUrl, setVideoUrl]         = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isGeneratingPrompt = status === 'prompting';
  const isGeneratingVideo  = ['submitting', 'polling', 'downloading'].includes(status);
  const isAnyLoading       = isGeneratingPrompt || isGeneratingVideo;

  // Step A: GPT-4 generates the Sora prompt → fills the soraPrompt box
  async function handleGeneratePrompt() {
    setError(null);
    setStatus('prompting');
    setSoraPrompt('');
    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          userPromptTemplate: userPrompt,
          headline: topic.trim() || 'latest forex and financial market movements',
          summary: '',
          sentiment: 0,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API error ${res.status}: ${txt}`);
      }
      const data = await res.json();
      const generated = (data.text || data.result || '').trim();
      if (!generated) throw new Error('GPT-4 returned empty response');
      setSoraPrompt(generated);
      setStatus('idle');
    } catch (err: any) {
      setError(err.message || 'Failed to generate prompt');
      setStatus('error');
    }
  }

  // Step B: Send soraPrompt to Sora 2 → poll → download
  async function handleGenerateVideo() {
    if (!soraPrompt.trim()) return;
    setError(null);
    setVideoUrl(null);
    try {
      const cfgRes = await fetch('/api/generate-video');
      if (!cfgRes.ok) throw new Error('Could not load Sora 2 config');
      const { submitUrl, statusUrl, apiKey, deployment } = await cfgRes.json();

      setStatus('submitting');
      setStatusMsg('Submitting to Sora 2...');

      const submitRes = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: deployment, prompt: soraPrompt, size, seconds }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitData?.error?.message || `Submit failed [${submitRes.status}]`);
      const videoId = submitData.id || submitData.video_id;
      if (!videoId) throw new Error('No video_id returned');

      setStatus('polling');
      setPollSeconds(0);
      let elapsed = 0;
      await new Promise<void>((resolve, reject) => {
        pollRef.current = setInterval(async () => {
          elapsed += 5;
          setPollSeconds(elapsed);
          setStatusMsg(`Sora 2 rendering... ${elapsed}s`);
          try {
            const r = await fetch(`${statusUrl}/${videoId}`, { headers: { 'Api-key': apiKey } });
            if (!r.ok) return;
            const d = await r.json();
            const st = d.status as string;
            if (st === 'succeeded' || st === 'completed') { clearInterval(pollRef.current!); resolve(); }
            else if (['failed', 'canceled', 'cancelled'].includes(st)) { clearInterval(pollRef.current!); reject(new Error(`Job ${st}`)); }
          } catch (_) {}
        }, 5000);
      });

      setStatus('downloading');
      setStatusMsg('Downloading video...');
      const dlRes = await fetch(`${statusUrl}/${videoId}/content`, { headers: { 'Api-key': apiKey } });
      if (!dlRes.ok) throw new Error(`Download failed [${dlRes.status}]`);
      const blob = await dlRes.blob();
      setVideoUrl(URL.createObjectURL(blob));
      setStatus('done');
      setStatusMsg('');
    } catch (err: any) {
      if (pollRef.current) clearInterval(pollRef.current);
      setError(err.message || 'Unknown error');
      setStatus('error');
    }
  }

  function handleReset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus('idle'); setStatusMsg(''); setVideoUrl(null);
    setError(null); setSoraPrompt(''); setPollSeconds(0);
  }

  function handleDownload() {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `vibetrader-sora2-${Date.now()}.mp4`;
    a.click();
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 p-6">

      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-400 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
          Sora 2 Video Studio
        </h2>
        <p className="text-muted-foreground text-sm">Powered by Azure OpenAI Sora 2 · East US 2</p>
      </div>

      {/* ── Settings row ── */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-background/40 border-primary/10">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5" /> Duration
          </label>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setSeconds(opt.value)} disabled={isAnyLoading}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  seconds === opt.value ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 border-primary/10 hover:border-primary/30 text-muted-foreground'}`}>
                <div>{opt.label}</div><div className="font-normal opacity-70">{opt.desc}</div>
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-4 bg-background/40 border-primary/10">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-3">
            <Settings2 className="w-3.5 h-3.5" /> Resolution
          </label>
          <div className="flex gap-2">
            {SIZE_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setSize(opt.value)} disabled={isAnyLoading}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  size === opt.value ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 border-primary/10 hover:border-primary/30 text-muted-foreground'}`}>
                <div>{opt.label}</div><div className="font-normal opacity-70">{opt.desc}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Prompts (collapsible, open by default) ── */}
      <Card className="bg-background/40 border-primary/10 overflow-hidden">
        <button className="w-full p-4 flex items-center justify-between text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowAdvanced(!showAdvanced)} disabled={isAnyLoading}>
          <span className="flex items-center gap-2"><Settings2 className="w-4 h-4" />System &amp; User Prompts</span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showAdvanced && (
          <div className="px-4 pb-4 space-y-4 border-t border-primary/10 pt-4">

            {/* Topic / headline variable */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
                Topic <span className="font-normal normal-case text-muted-foreground ml-2">fills <code className="bg-muted px-1 rounded">{'{headline}'}</code> in the user prompt below</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Gold prices surging amid dollar weakness  (leave blank for generic market video)"
                className="w-full p-3 rounded-xl bg-muted/40 border border-primary/10 focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 outline-none transition-all text-sm text-foreground placeholder:text-muted-foreground/40"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isAnyLoading}
              />
            </div>

            {/* System prompt */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-violet-400 uppercase tracking-widest">
                System Prompt <span className="font-normal normal-case text-muted-foreground ml-2">controls GPT-4 video director behaviour</span>
              </label>
              <textarea
                className="w-full min-h-[160px] p-3 rounded-xl bg-muted/40 border border-primary/10 focus:border-violet-400/40 outline-none transition-all resize-y text-xs font-mono text-muted-foreground"
                value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} disabled={isAnyLoading} />
            </div>

            {/* User prompt */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-fuchsia-400 uppercase tracking-widest">
                User Prompt <span className="font-normal normal-case text-muted-foreground ml-2">use <code className="bg-muted px-1 rounded">{'{headline}'}</code> as placeholder</span>
              </label>
              <textarea
                className="w-full min-h-[70px] p-3 rounded-xl bg-muted/40 border border-primary/10 focus:border-fuchsia-400/40 outline-none transition-all resize-y text-xs font-mono text-muted-foreground"
                value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} disabled={isAnyLoading} />
            </div>
          </div>
        )}
      </Card>

      {/* ── Generate Prompt button ── */}
      <Button onClick={handleGeneratePrompt} disabled={isAnyLoading}
        className="w-full h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold transition-all disabled:opacity-40">
        {isGeneratingPrompt
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />GPT-4 crafting Sora 2 prompt...</>
          : <><Wand2 className="w-4 h-4 mr-2" />Generate Video Prompt</>}
      </Button>

      {/* ── Sora Prompt box (auto-filled, editable) ── */}
      <Card className={`p-5 border transition-all ${soraPrompt ? 'border-violet-500/40 bg-background/50' : 'border-primary/10 bg-background/30'}`}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2 text-violet-400">
              <Wand2 className="w-3.5 h-3.5" /> Video Prompt
              {soraPrompt
                ? <span className="text-muted-foreground font-normal normal-case">· GPT-4 generated · edit freely before generating</span>
                : <span className="text-muted-foreground font-normal normal-case">· will be auto-filled after clicking Generate Video Prompt</span>}
            </label>
            {soraPrompt && <span className="text-xs text-muted-foreground/50">{soraPrompt.length} chars</span>}
          </div>
          <textarea
            placeholder="Click 'Generate Video Prompt' above — GPT-4 will write the Sora 2 prompt here automatically. You can then edit it before generating the video."
            className="w-full min-h-[140px] p-4 rounded-xl bg-muted/40 border border-violet-500/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 outline-none transition-all resize-y text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/30"
            value={soraPrompt}
            onChange={(e) => setSoraPrompt(e.target.value)}
            disabled={isAnyLoading}
          />
        </div>
      </Card>

      {/* ── Generate Video button ── */}
      <Button onClick={handleGenerateVideo} disabled={isAnyLoading || !soraPrompt.trim()}
        className="w-full h-12 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold text-base transition-all disabled:opacity-40">
        {isGeneratingVideo
          ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{statusMsg}</>
          : <><Sparkles className="w-5 h-5 mr-2" />Generate Video</>}
      </Button>

      {/* ── Error ── */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">❌ {error}</div>
      )}

      {/* ── Progress bar ── */}
      {status === 'polling' && (
        <Card className="p-4 bg-background/40 border-violet-500/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-violet-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Sora 2 rendering...</span>
            <span className="text-muted-foreground">{pollSeconds}s · typically 30–90s</span>
          </div>
          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min((pollSeconds / 120) * 100, 92)}%` }} />
          </div>
        </Card>
      )}

      {/* ── Video player ── */}
      {(videoUrl || isGeneratingVideo) && (
        <div className="relative rounded-2xl overflow-hidden bg-black border border-primary/10 flex items-center justify-center"
          style={{ aspectRatio: size === '720x1280' ? '9/16' : size === '720x720' ? '1/1' : '16/9', maxHeight: '70vh' }}>
          {videoUrl ? (
            <>
              <video src={videoUrl} controls autoPlay loop playsInline className="w-full h-full object-contain" />
              <div className="absolute top-3 right-3 flex gap-2">
                <Button size="icon" variant="secondary" className="bg-black/60 backdrop-blur-md hover:bg-black/80 border border-white/10" onClick={handleDownload}>
                  <Download className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="secondary" className="bg-black/60 backdrop-blur-md hover:bg-black/80 border border-white/10" onClick={handleReset}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 text-muted-foreground/40 p-10">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-violet-500/20 rounded-full animate-ping" />
                <Loader2 className="w-20 h-20 animate-spin text-violet-500/40" />
              </div>
              <p className="text-sm">{statusMsg}</p>
            </div>
          )}
        </div>
      )}

      {/* Generate Another */}
      {status === 'done' && (
        <Button onClick={handleReset} variant="outline" className="w-full h-11 border-primary/20 text-muted-foreground">
          <RefreshCw className="w-4 h-4 mr-2" /> Generate Another
        </Button>
      )}

    </div>
  );
}
