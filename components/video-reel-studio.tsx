'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Loader2, RefreshCw, ChevronDown, ChevronUp,
  Play, Download, FileText, Copy, Check, Wand2, Merge,
  Save, Star, Trash2, FolderOpen, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// ─── Types ────────────────────────────────────────────────────────────────────

type Scene = { duration_seconds: number; script_lines: string[]; sora_prompt: string };
type Reel = { voice: string; content_type: string; scene_1: Scene; scene_2: Scene; scene_3: Scene; instagram_caption: string };
type ClipSt = { status: 'idle' | 'submitting' | 'polling' | 'downloading' | 'done' | 'error'; elapsed: number; url: string | null; err: string | null };
type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
type SavedConfig = {
  id: string; name: string; day: DayKey;
  systemPrompt: string; notes: string; marketContext: string;
  savedBy: string; savedAt: string; recommended: boolean; recommendNote: string;
};

const initClip = (): ClipSt => ({ status: 'idle', elapsed: 0, url: null, err: null });
const DURATIONS = [4, 8, 12];

// ─── Day configs ──────────────────────────────────────────────────────────────

const DAYS: Record<DayKey, { label: string; format: string; type: string; notes: string; cta: string; follow: string; dataType: 'ta' | 'news' | 'none' }> = {
  monday: { label: 'Monday', format: 'A', type: 'Trading Puzzle', dataType: 'ta', cta: 'Comment BUY, SELL or WAIT — we reply to every answer.', follow: 'Follow — tomorrow we drop the analysis.', notes: 'Open with a chart setup at a key level. Build suspense through the reel. End on the question BUY SELL or WAIT. Do NOT reveal the answer — that is Friday Part 2. Observer voice. No product mention.' },
  tuesday: { label: 'Tuesday', format: 'B', type: 'Psychology / Trader Pain', dataType: 'none', cta: 'Send this to a trader who needs to hear this.', follow: 'Follow — more on why traders do this.', notes: 'Observer voice. Name a specific trader behavior precisely — revenge trading, moving stop losses, overtrading out of boredom, FOMO entries. Reframe as a system problem, not a character flaw.' },
  wednesday: { label: 'Wednesday', format: 'C', type: 'Market Insight', dataType: 'news', cta: 'Drop your read below.', follow: 'Follow — we break down moves like this as they happen.', notes: 'Use the news item as a TRIGGER only — NOT a news summary. Ask: what does this move make traders do emotionally? Observer voice. The insight must feel timeless.' },
  thursday: { label: 'Thursday', format: 'B', type: 'Entertainment / Relatable', dataType: 'none', cta: 'Tag a trader who has been here.', follow: "Follow — we say what most trading accounts won't.", notes: 'Observer voice. Shareable and relatable. Designed to get shares and tags. Keep it punchy.' },
  friday: { label: 'Friday', format: 'A', type: 'Puzzle Part 2 — Mon Answer', dataType: 'ta', cta: 'Comment if you got it right.', follow: 'Follow — Monday puzzle drops at 7pm.', notes: "This RESOLVES Monday's Puzzle. Breakdown: correct answer, why most got it wrong, the lesson. Reference 'the puzzle from Monday' in the script." },
};

const MOCK_TA = `## MARKET CONTEXT -- REAL DATA (use these exact numbers in script lines)
Symbol: EURUSD | Timeframe: 4H | Current price: 1.08470
Bias: BEARISH | Direction: SELL | Indicator agreement: 60%
Indicators:
  RSI: 71.4  (OVERBOUGHT)
  MACD: -0.00012  (BEARISH)
  ATR: 0.00812  (NEUTRAL)
  EMA: 1.08250  (BEARISH)
  ADX: 28.3  (NEUTRAL)

PUZZLE SETUP RULES:
  - The hook MUST name EURUSD as the pair being watched.
  - Use REAL price 1.08470 as the anchor.
  - Tension line MUST reference the strongest signal above.
  - Example script line: 'EURUSD. RSI at 71.4. What do you do?'`;

const MOCK_NEWS = `## NEWS TRIGGER -- REAL DATA (use as emotional trigger, NOT as news summary)
Market sentiment: Bearish (score -0.6)
Impact level: High
Summary: The Federal Reserve held rates steady but signalled fewer cuts than markets expected. Dollar strengthened. EUR/USD broke below 1.0850 support.
Key drivers:
  - Fed held rates — fewer cuts signalled than expected
  - Dollar index (DXY) up 0.8% on the session
  - EUR/USD broke 1.0850 support — next target 1.0780
  - Risk-off: equities down, gold and dollar up

WEDNESDAY REEL RULES:
  - Do NOT summarise or quote the news.
  - Ask: what does a bearish high-impact event make traders DO?
  - Observer voice. Reel must feel evergreen.`;

const DEFAULT_SYSTEM = `# VIBETRADER CONTENT GENERATION -- v6 SKILL

## WHO VIBETRADER IS
VibeTrader is a company. Not a trader. Not a founder. Not a personal brand.
Three voices — pick the right one:

Voice 1 (Company): calm team that built the infrastructure to fix trader inconsistency.
  Example: "We built VibeTrader for the trader who already knows what to do."
Voice 2 (Observer): studies traders from the outside. Precise. Psychologically sharp.
  Example: "Most traders know exactly what they did wrong — after the trade closes."
  Never: first-person trader confessions, "I've been there" language.
Voice 3 (Product): the product speaking. Calm, functional, no hype.
  Example: "VibeTrader doesn't override your strategy. It executes it."

## AUDIENCE
Global retail forex traders who already know their strategy — the problem is behavior under pressure.
They respond to: emotional accuracy, specific observed behaviors, psychological truth.
They reject: motivational content, profit claims, guru energy.

## REEL STRUCTURE — ALWAYS 3 SCENES
Scene 1 — HOOK (12s): Pattern interrupt. Max 10 words on screen.
Scene 2 — BUILD (12s): Deepen the tension. The line they nod at. No filler.
Scene 3 — LAND (8s): The insight lands. The reframe. Silence is powerful.

## DURATION RULE — CRITICAL
Sora 2 only accepts EXACTLY 4, 8, or 12 seconds.

## SCRIPT RULES
- On-screen text only. Grade 6 reading level. Max 4 words per frame.
- Hard cuts between frames. Fast-fast-PAUSE rhythm.
- NEVER first-person trader confessions as the brand voice.

## SORA 2 VISUAL DIRECTION
Lead with shot type. Under 150 words. NO real people, NO faces, NO brand logos.

VISUAL CONTINUITY — CRITICAL:
All 3 scenes are ONE continuous reel, not 3 separate videos.
Every sora_prompt MUST open with the same environment anchor line:
"Dark trading room. Single monitor glow. Same desk, same scene."
Then describe the specific shot for that scene.
Same room, same desk, same cold blue-black lighting across all 3 scenes.
Camera angle and framing can change — the ENVIRONMENT must not.

Visual vocabulary:
- Trading desk at night, monitor glow only, rest of room dark
- Over-the-shoulder shot, trader studying screen, hand hovering on mouse
- Slow camera push in toward the monitor
- Tight close-up on hands, fingers over keyboard, tense stillness
- Wide shot of empty desk — cold coffee, phone face-down, second monitor dark
- Chart on screen with red candles, position open, number showing a loss
- Abstract data streams in deep blue space, numbers flying
- Gold bars stacked on dark surface, warm amber light circling slowly
- Dark storm clouds over bright horizon — bearish environment
Lighting: monitor glow as primary. NEVER bright studio lighting.
Character: always mid-moment. No smiling.

## CAPTION FORMULA
Line 1: Hook — 1 line, max 10 words.
[blank line]
Body — 2 lines max.
[blank line]
Engagement CTA. Follow CTA with concrete reason.
[blank line]
#forextrading #tradingpsychology #aitrading #forexeducation #vibetrader
[blank line]
Disclaimer: VibeTrader, Inc. is a technology company providing behavioral analytics and educational software tools. It is not a registered investment adviser, broker-dealer, or financial planner. The platform does not provide personalized investment advice, trading recommendations, or portfolio management. All information is for educational purposes only. Users are solely responsible for their trading decisions. Trading financial instruments involves substantial risk of loss. Past performance is not indicative of future results.

ABSOLUTE RULES — NEVER: first-person confessions, profit claims, link in bio, more than 5 hashtags.
ALWAYS: observer/company/product voice, full disclaimer last, follow CTA every post.`;

const OUTPUT_SCHEMA_DISPLAY = `{
  "voice": "Observer | Company | Product",
  "content_type": "Pain | Psychology | Education | Market | Product | Entertainment | Puzzle",
  "scene_1": { "duration_seconds": 12, "script_lines": ["line 1", "line 2", "line 3"], "sora_prompt": "..." },
  "scene_2": { "duration_seconds": 12, "script_lines": ["line 1", "line 2", "line 3"], "sora_prompt": "..." },
  "scene_3": { "duration_seconds": 8,  "script_lines": ["line 1", "line 2"],           "sora_prompt": "..." },
  "instagram_caption": "Full caption matching the formula above exactly."
}
CRITICAL: duration_seconds must be exactly 4, 8, or 12.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── Scene card ───────────────────────────────────────────────────────────────

function SceneCard({ n, scene, onUpdate, onGenerate, clip }: {
  n: 1 | 2 | 3; scene: Scene; onUpdate: (s: Scene) => void; onGenerate: () => void; clip: ClipSt;
}) {
  const busy = ['submitting', 'polling', 'downloading'].includes(clip.status);
  return (
    <Card className="p-4 bg-background/50 border-primary/10 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-violet-400">Scene {n}</span>
        <div className="flex gap-1">
          {DURATIONS.map(d => (
            <button key={d} onClick={() => onUpdate({ ...scene, duration_seconds: d })} disabled={busy}
              className={`px-2 py-0.5 rounded text-xs font-semibold border transition-all ${scene.duration_seconds === d ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted/30 text-muted-foreground border-primary/10 hover:border-primary/30'}`}>
              {d}s
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">On-screen text</label>
        {scene.script_lines.map((line, i) => (
          <input key={i} value={line} disabled={busy}
            onChange={e => { const l = [...scene.script_lines]; l[i] = e.target.value; onUpdate({ ...scene, script_lines: l }); }}
            className="w-full px-2.5 py-1.5 rounded-lg bg-muted/40 border border-primary/10 focus:border-emerald-400/50 outline-none text-xs text-foreground font-mono" />
        ))}
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-semibold text-fuchsia-400 uppercase tracking-widest">
          Sora 2 prompt <span className="font-normal normal-case text-muted-foreground">{scene.sora_prompt.length}c</span>
        </label>
        <textarea value={scene.sora_prompt} disabled={busy} onChange={e => onUpdate({ ...scene, sora_prompt: e.target.value })}
          className="w-full min-h-[80px] px-2.5 py-2 rounded-lg bg-muted/40 border border-primary/10 focus:border-fuchsia-400/40 outline-none resize-y text-[11px] font-mono text-muted-foreground leading-relaxed" />
      </div>
      <Button onClick={onGenerate} disabled={busy || !scene.sora_prompt.trim()} size="sm"
        className="w-full bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-xs font-semibold disabled:opacity-40 h-8">
        {busy ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{clip.status === 'polling' ? `${clip.elapsed}s...` : clip.status === 'submitting' ? 'Queuing...' : 'Downloading...'}</>
          : clip.status === 'done' ? <><RefreshCw className="w-3 h-3 mr-1" />Re-gen</>
            : <><Play className="w-3 h-3 mr-1" />Generate Clip {n}</>}
      </Button>
      {clip.status === 'polling' && (
        <div className="h-0.5 bg-muted/40 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min((clip.elapsed / 120) * 100, 92)}%` }} />
        </div>
      )}
      {clip.status === 'error' && <p className="text-[10px] text-destructive">❌ {clip.err}</p>}
      {clip.url && (
        <div className="relative rounded-lg overflow-hidden bg-black border border-primary/10" style={{ aspectRatio: '9/16', maxHeight: '220px' }}>
          <video src={clip.url} controls autoPlay loop playsInline className="w-full h-full object-contain" />
          <a href={clip.url} download={`scene_${n}.mp4`} className="absolute top-2 right-2 p-1 rounded-md bg-black/60 border border-white/10">
            <Download className="w-3.5 h-3.5 text-white" />
          </a>
        </div>
      )}
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function VideoReelStudio() {
  const [day, setDay] = useState<DayKey>('monday');
  const [sysP, setSysP] = useState(DEFAULT_SYSTEM);
  const [notes, setNotes] = useState(DAYS.monday.notes);
  const [mktCtx, setMktCtx] = useState(MOCK_TA);
  const [showSys, setShowSys] = useState(false);
  const [showCtx, setShowCtx] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [reel, setReel] = useState<Reel | null>(null);
  const [clips, setClips] = useState<[ClipSt, ClipSt, ClipSt]>([initClip(), initClip(), initClip()]);
  const [merging, setMerging] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [mergeErr, setMergeErr] = useState<string | null>(null);
  const [continuity, setContinuity] = useState(true);
  const [lastFrames, setLastFrames] = useState<[string | null, string | null, string | null]>([null, null, null]);

  // Saved configs
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [showConfigs, setShowConfigs] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedBy, setSavedBy] = useState('Designer');
  const [saving, setSaving] = useState(false);
  const [recNote, setRecNote] = useState<Record<string, string>>({});

  const pollRefs = [useRef<any>(null), useRef<any>(null), useRef<any>(null)];

  useEffect(() => { fetchConfigs(); }, []);

  async function fetchConfigs() {
    try { const r = await fetch('/api/video-reel/prompts'); if (r.ok) setConfigs(await r.json()); } catch { }
  }

  async function handleSave() {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/video-reel/prompts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName, day, systemPrompt: sysP, notes, marketContext: mktCtx, savedBy }),
      });
      if (r.ok) { const cfg = await r.json(); setConfigs(prev => [cfg, ...prev]); setSaveName(''); setShowSaveForm(false); }
    } catch { } finally { setSaving(false); }
  }

  function handleLoad(cfg: SavedConfig) {
    setSysP(cfg.systemPrompt); setNotes(cfg.notes); setMktCtx(cfg.marketContext);
    if (cfg.day !== day) { setDay(cfg.day); setReel(null); setClips([initClip(), initClip(), initClip()]); }
    setShowConfigs(false);
  }

  async function handleRecommend(cfg: SavedConfig) {
    const note = recNote[cfg.id] ?? cfg.recommendNote;
    const r = await fetch(`/api/video-reel/prompts?id=${cfg.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommended: !cfg.recommended, recommendNote: note }),
    });
    if (r.ok) {
      const upd = await r.json();
      setConfigs(prev => prev.map(c => c.id === cfg.id ? upd : c)
        .sort((a, b) => a.recommended === b.recommended ? new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime() : a.recommended ? -1 : 1));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this saved config?')) return;
    await fetch(`/api/video-reel/prompts?id=${id}`, { method: 'DELETE' });
    setConfigs(prev => prev.filter(c => c.id !== id));
  }

  function changeDay(d: DayKey) {
    setDay(d); setNotes(DAYS[d].notes);
    setMktCtx(DAYS[d].dataType === 'ta' ? MOCK_TA : DAYS[d].dataType === 'news' ? MOCK_NEWS : '');
    setReel(null); setClips([initClip(), initClip(), initClip()]);
    setLastFrames([null, null, null]);
    setGenErr(null); setMergedUrl(null); setMergeErr(null);
  }

  // Extract last frame of a video blob URL as base64 JPEG (for Sora continuity conditioning)
  function extractLastFrame(videoUrl: string): Promise<string | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.preload = 'metadata';
      video.src = videoUrl;
      video.addEventListener('loadedmetadata', () => {
        video.currentTime = Math.max(0, video.duration - 0.05);
      });
      video.addEventListener('seeked', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 720;
          canvas.height = video.videoHeight || 1280;
          canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
        } catch { resolve(null); }
        video.src = '';
      });
      video.addEventListener('error', () => resolve(null));
      video.load();
    });
  }

  function buildBrief() {
    const d = DAYS[day];
    return ['## TODAY\'S CONTENT BRIEF', `Day: ${d.label}`, `Format: ${d.format} -- ${d.type}`,
      `CTA goal: Comments + Follows`, `Engagement CTA: ${d.cta}`, `Follow CTA hint: ${d.follow}`,
      `Director notes: ${notes}`].join('\n');
  }

  function buildFullUserPrompt() {
    const parts = [buildBrief()];
    if (mktCtx.trim()) parts.push('\n' + mktCtx);
    parts.push('\n## YOUR TASK');
    parts.push('Generate a complete Instagram reel package following the v6 skill above.');
    parts.push('Respond ONLY with valid raw JSON matching this schema — no preamble, no fences:');
    parts.push(''); parts.push(OUTPUT_SCHEMA_DISPLAY);
    return parts.join('\n');
  }

  async function handleGenerateScript() {
    setGenBusy(true); setGenErr(null); setReel(null);
    setClips([initClip(), initClip(), initClip()]); setMergedUrl(null); setMergeErr(null);
    try {
      const r = await fetch('/api/video-reel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: sysP, brief: buildBrief(), marketContext: mktCtx, temperature: 0.85 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `API ${r.status}`);
      setReel(data as Reel);
    } catch (e: any) { setGenErr(e.message || 'Script generation failed'); }
    finally { setGenBusy(false); }
  }

  async function handleGenerateClip(idx: number) {
    if (!reel) return;
    const scene = reel[`scene_${idx + 1}` as keyof Reel] as Scene;
    if (!scene.sora_prompt.trim()) return;
    setMergedUrl(null); setMergeErr(null);
    function upd(p: Partial<ClipSt>) { setClips(prev => { const c = [...prev] as [ClipSt, ClipSt, ClipSt]; c[idx] = { ...c[idx], ...p }; return c; }); }
    upd({ status: 'submitting', elapsed: 0, url: null, err: null });
    try {
      const cfg = await fetch('/api/generate-video').then(r => r.json());

      // Build Sora payload — add image conditioning from previous clip's last frame
      const prevFrame = continuity && idx > 0 ? lastFrames[idx - 1] : null;
      const soraBody: Record<string, unknown> = {
        model: 'sora-2',
        prompt: scene.sora_prompt,
        size: '720x1280',
        seconds: String(scene.duration_seconds),
      };
      if (prevFrame) {
        // Image conditioning: last frame of Scene N → first frame of Scene N+1
        soraBody.images = [{ b64_json: prevFrame }];
        console.log(`[sora] Scene ${idx + 1}: using last frame of scene ${idx} for continuity`);
      }

      const sub = await fetch(cfg.submitUrl, {
        method: 'POST', headers: { 'Api-key': cfg.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(soraBody),
      });
      const subData = await sub.json();
      if (!sub.ok) throw new Error(subData?.error?.message || `Submit failed`);
      const vid = subData.id || subData.video_id;
      if (!vid) throw new Error('No video_id');
      upd({ status: 'polling' });
      let elapsed = 0;
      await new Promise<void>((resolve, reject) => {
        pollRefs[idx].current = setInterval(async () => {
          elapsed += 5; upd({ elapsed });
          try {
            const r = await fetch(`${cfg.statusUrl}/${vid}`, { headers: { 'Api-key': cfg.apiKey } });
            if (!r.ok) return;
            const d = await r.json();
            if (['succeeded', 'completed'].includes(d.status)) { clearInterval(pollRefs[idx].current); resolve(); }
            else if (['failed', 'canceled', 'cancelled'].includes(d.status)) { clearInterval(pollRefs[idx].current); reject(new Error(`Job ${d.status}`)); }
          } catch { }
        }, 5000);
      });
      upd({ status: 'downloading' });
      const dl = await fetch(`${cfg.statusUrl}/${vid}/content`, { headers: { 'Api-key': cfg.apiKey } });
      if (!dl.ok) throw new Error(`Download failed`);
      const blobUrl = URL.createObjectURL(await dl.blob());
      upd({ status: 'done', url: blobUrl });

      // Extract last frame for next scene's continuity conditioning
      const frame = await extractLastFrame(blobUrl);
      if (frame) setLastFrames(prev => { const f = [...prev] as [string | null, string | null, string | null]; f[idx] = frame; return f; });

    } catch (e: any) { clearInterval(pollRefs[idx].current); upd({ status: 'error', err: e.message || 'Unknown' }); }
  }

  // Client-side merge via ffmpeg.wasm — works on Vercel, no server needed
  async function handleMerge() {
    if (!clips.some(c => c.status === 'done')) return;
    setMerging(true); setMergeErr(null); setMergedUrl(null);
    try {
      // Dynamic import — avoids SSR issues with browser-only WASM APIs
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();

      // Load ffmpeg core from jsDelivr CDN (single-threaded, no COOP/COEP needed)
      const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      // Write each ready clip into the ffmpeg virtual filesystem
      const entries: string[] = [];
      for (let i = 0; i < 3; i++) {
        if (clips[i].status === 'done' && clips[i].url) {
          const name = `clip${i}.mp4`;
          await ffmpeg.writeFile(name, await fetchFile(clips[i].url!));
          entries.push(`file '${name}'`);
        }
      }
      if (!entries.length) throw new Error('No clips to merge');

      // Concat list
      await ffmpeg.writeFile('list.txt', new TextEncoder().encode(entries.join('\n')));

      // Run concat — stream copy, no re-encode, fast
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'out.mp4']);

      // Read result and create blob URL
      const data = await ffmpeg.readFile('out.mp4');
      const buf = data instanceof Uint8Array ? data.buffer as ArrayBuffer : data as unknown as ArrayBuffer;
      setMergedUrl(URL.createObjectURL(new Blob([buf], { type: 'video/mp4' })));
    } catch (e: any) {
      setMergeErr(e.message || 'Merge failed');
    } finally { setMerging(false); }
  }

  function updateScene(n: 1 | 2 | 3, s: Scene) { if (reel) setReel({ ...reel, [`scene_${n}`]: s }); }

  function buildScriptTxt() {
    if (!reel) return '';
    let t = 0; const out = [`VIBETRADER REEL — ${DAYS[day].label.toUpperCase()}\n`];
    ([1, 2, 3] as const).forEach(n => {
      const sc = reel[`scene_${n}`]; const dur = sc.duration_seconds;
      out.push(`Scene ${n}  [${t}s–${t + dur}s]  (${dur}s)`);
      sc.script_lines.forEach((l, i) => out.push(`  [${t + Math.round(i * (dur / sc.script_lines.length))}s]  ${l}`));
      out.push(''); t += dur;
    });
    out.push(`Total: ${t}s\n\nSORA PROMPTS`);
    ([1, 2, 3] as const).forEach(n => out.push(`\nScene ${n}:\n${reel[`scene_${n}`].sora_prompt}`));
    return out.join('\n');
  }

  const d = DAYS[day];
  const doneCount = clips.filter(c => c.status === 'done').length;
  const anyBusy = clips.some(c => ['submitting', 'polling', 'downloading'].includes(c.status));

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 p-4">

      {/* Day selector */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(DAYS) as DayKey[]).map(k => (
          <button key={k} onClick={() => changeDay(k)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${day === k ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted/30 text-muted-foreground border-primary/10 hover:border-primary/30'}`}>
            {DAYS[k].label}
            <span className={`ml-1.5 text-xs font-normal ${day === k ? 'text-violet-200' : 'text-muted-foreground/50'}`}>Fmt {DAYS[k].format}</span>
          </button>
        ))}
      </div>

      {/* Brief pill */}
      <div className="px-4 py-2.5 rounded-xl bg-muted/30 border border-primary/10 text-sm flex items-center gap-3 flex-wrap">
        <span className="font-semibold text-violet-400">{d.type}</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-muted-foreground text-xs">CTA: <span className="text-foreground">{d.cta}</span></span>
        {d.dataType !== 'none' && (
          <><span className="text-muted-foreground/40">·</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.dataType === 'ta' ? 'bg-teal-500/10 text-teal-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {d.dataType === 'ta' ? '📈 TA data' : '📰 News data'}
            </span></>
        )}
      </div>

      {/* ── Saved configs panel ── */}
      <Card className="bg-background/40 border-emerald-500/20 overflow-hidden">
        <button className="w-full p-4 flex items-center justify-between text-sm font-semibold hover:text-foreground"
          onClick={() => setShowConfigs(!showConfigs)}>
          <span className="text-emerald-400 flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Saved Configs
            {configs.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px]">{configs.length}</span>
            )}
            {configs.some(c => c.recommended) && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5" /> {configs.filter(c => c.recommended).length} recommended
              </span>
            )}
          </span>
          {showConfigs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showConfigs && (
          <div className="border-t border-emerald-500/10 p-4 space-y-3">
            {configs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No saved configs yet. Save your current setup below.</p>
            )}
            {configs.map(cfg => (
              <div key={cfg.id} className={`rounded-xl border p-3 space-y-2 ${cfg.recommended ? 'border-amber-500/30 bg-amber-500/5' : 'border-primary/10 bg-background/40'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {cfg.recommended && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                      <span className="text-sm font-semibold text-foreground truncate">{cfg.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground capitalize">{cfg.day}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by {cfg.savedBy} · {new Date(cfg.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {cfg.recommended && cfg.recommendNote && (
                      <p className="text-xs text-amber-400 mt-1">⭐ {cfg.recommendNote}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => handleLoad(cfg)}
                      className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors">
                      Load
                    </button>
                    <button onClick={() => handleRecommend(cfg)}
                      className={`p-1.5 rounded-lg border transition-colors ${cfg.recommended ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-muted/30 border-primary/10 text-muted-foreground hover:text-amber-400'}`}
                      title={cfg.recommended ? 'Remove recommendation' : 'Recommend to Masood'}>
                      <Star className={`w-3.5 h-3.5 ${cfg.recommended ? 'fill-amber-400' : ''}`} />
                    </button>
                    <button onClick={() => handleDelete(cfg.id)}
                      className="p-1.5 rounded-lg bg-muted/30 border border-primary/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Recommend note input */}
                {!cfg.recommended && (
                  <div className="flex gap-2">
                    <input placeholder="Add a note before recommending (optional)..."
                      value={recNote[cfg.id] ?? ''}
                      onChange={e => setRecNote(prev => ({ ...prev, [cfg.id]: e.target.value }))}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-primary/10 text-xs text-foreground outline-none focus:border-amber-400/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* System prompt */}
      <Card className="bg-background/40 border-primary/10 overflow-hidden">
        <button className="w-full p-4 flex items-center justify-between text-sm font-semibold text-muted-foreground hover:text-foreground"
          onClick={() => setShowSys(!showSys)}>
          <span className="text-violet-400">v6 System Prompt <span className="font-normal text-muted-foreground normal-case">(brand rules, scene structure, Sora vocabulary)</span></span>
          {showSys ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showSys && (
          <div className="px-4 pb-4 pt-2 border-t border-primary/10">
            <textarea value={sysP} onChange={e => setSysP(e.target.value)}
              className="w-full min-h-[280px] p-3 rounded-xl bg-muted/40 border border-primary/10 focus:border-violet-400/40 outline-none resize-y text-xs font-mono text-muted-foreground leading-relaxed" />
          </div>
        )}
      </Card>

      {/* Director notes */}
      <Card className="p-4 bg-background/40 border-primary/10 space-y-2">
        <label className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
          Director notes <span className="font-normal normal-case text-muted-foreground ml-2">shapes the angle and energy of this day's reel</span>
        </label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          className="w-full p-3 rounded-xl bg-muted/40 border border-primary/10 focus:border-amber-400/40 outline-none resize-y text-sm text-foreground" />
      </Card>

      {/* Market context */}
      {d.dataType !== 'none' && (
        <Card className="bg-background/40 border-primary/10 overflow-hidden">
          <button className="w-full p-4 flex items-center justify-between text-sm font-semibold hover:text-foreground"
            onClick={() => setShowCtx(!showCtx)}>
            <span className={d.dataType === 'ta' ? 'text-teal-400' : 'text-amber-400'}>
              {d.dataType === 'ta' ? '📈 Market Context' : '📰 News Trigger'}
              <span className="font-normal normal-case text-muted-foreground ml-2">(injected into GPT-4 prompt — edit freely)</span>
            </span>
            {showCtx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showCtx && (
            <div className="px-4 pb-4 pt-2 border-t border-primary/10">
              <textarea value={mktCtx} onChange={e => setMktCtx(e.target.value)}
                className="w-full min-h-[160px] p-3 rounded-xl bg-muted/40 border border-primary/10 focus:border-teal-400/40 outline-none resize-y text-xs font-mono text-muted-foreground leading-relaxed" />
            </div>
          )}
        </Card>
      )}

      {/* Full user prompt preview */}
      <Card className="bg-background/40 border-sky-500/20 overflow-hidden">
        <div className="w-full p-4 flex items-center justify-between text-sm font-semibold">
          <button className="flex-1 flex items-center gap-2 text-left hover:text-foreground transition-colors"
            onClick={() => setShowPrompt(!showPrompt)}>
            <span className="text-sky-400">👁 Full User Prompt Preview</span>
            <span className="font-normal normal-case text-muted-foreground text-xs">— exactly what GPT-4 receives · updates live</span>
            {showPrompt ? <ChevronUp className="w-4 h-4 ml-auto text-muted-foreground" /> : <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />}
          </button>
          <CopyBtn text={buildFullUserPrompt()} />
        </div>
        {showPrompt && (
          <div className="border-t border-sky-500/10">
            <div className="px-4 pt-3 pb-1 flex gap-3 flex-wrap text-[10px] font-semibold uppercase tracking-widest">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Part 1 · Brief</span>
              {mktCtx.trim() && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Part 2 · Market context</span>}
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Part 3 · Task + schema</span>
            </div>
            <pre className="px-4 pb-4 pt-2 text-[11px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap overflow-auto max-h-[500px]">
              {buildFullUserPrompt()}
            </pre>
          </div>
        )}
      </Card>

      {/* ── Save config form ── */}
      <Card className="bg-background/40 border-emerald-500/10 p-4 space-y-3">
        {!showSaveForm ? (
          <button onClick={() => setShowSaveForm(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-all">
            <Save className="w-4 h-4" /> Save current config
          </button>
        ) : (
          <div className="space-y-3">
            <label className="text-xs font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Save This Config
            </label>
            <div className="flex gap-2">
              <input placeholder='Config name, e.g. "Monday bearish EURUSD v2"'
                value={saveName} onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="flex-1 px-3 py-2 rounded-lg bg-muted/40 border border-primary/10 focus:border-emerald-400/50 outline-none text-sm text-foreground" />
              <input placeholder="Saved by" value={savedBy} onChange={e => setSavedBy(e.target.value)}
                className="w-32 px-3 py-2 rounded-lg bg-muted/40 border border-primary/10 focus:border-emerald-400/50 outline-none text-sm text-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Saves: system prompt · director notes · market context · day ({DAYS[day].label})
            </p>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !saveName.trim()} size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-40">
                {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving...</> : <><Save className="w-3.5 h-3.5 mr-1.5" />Save</>}
              </Button>
              <Button onClick={() => { setShowSaveForm(false); setSaveName(''); }} size="sm" variant="outline"
                className="text-muted-foreground border-primary/20">Cancel</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Generate script */}
      <Button onClick={handleGenerateScript} disabled={genBusy}
        className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-base disabled:opacity-40">
        {genBusy ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />GPT-4 generating 3-scene script...</>
          : reel ? <><RefreshCw className="w-5 h-5 mr-2" />Re-generate Script</>
            : <><Wand2 className="w-5 h-5 mr-2" />Generate 3-Scene Script</>}
      </Button>

      {genErr && <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">❌ {genErr}</div>}

      {/* Scenes + merge */}
      {reel && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/40" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">3 Scenes · edit → generate → merge</span>
            <div className="flex-1 h-px bg-border/40" />
          </div>

          {/* Continuity mode toggle */}
          <div className="flex items-center justify-between px-1">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="text-violet-400 font-semibold">{reel.voice}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>{reel.content_type}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>{doneCount}/3 clips ready</span>
            </div>
            <button onClick={() => setContinuity(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${continuity
                ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                : 'bg-muted/30 border-primary/10 text-muted-foreground'
                }`}
              title="When ON: last frame of Scene 1 is fed into Scene 2 as starting image, and Scene 2 last frame into Scene 3. Keeps lighting, room and desk consistent across all 3 clips.">
              <Zap className={`w-3 h-3 ${continuity ? 'fill-violet-400' : ''}`} />
              Continuity {continuity ? 'ON' : 'OFF'}
              {continuity && lastFrames[0] && <span className="text-violet-400">· S1→S2</span>}
              {continuity && lastFrames[1] && <span className="text-violet-400"> S2→S3</span>}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([1, 2, 3] as const).map(n => (
              <SceneCard key={n} n={n} scene={reel[`scene_${n}`]} clip={clips[n - 1]}
                onUpdate={s => updateScene(n, s)} onGenerate={() => handleGenerateClip(n - 1)} />
            ))}
          </div>

          {/* Merge */}
          <Card className={`p-5 border transition-all ${mergedUrl ? 'border-violet-500/40 bg-background/60' : 'border-primary/10 bg-background/40'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Merge className="w-4 h-4 text-violet-400" /> Merge &amp; Preview Final Reel
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {doneCount === 0 ? 'Generate at least 1 clip to enable merge'
                    : doneCount < 3 ? `${doneCount}/3 clips ready`
                      : 'All 3 clips ready'}
                </p>
              </div>
              {mergedUrl && (
                <a href={mergedUrl} download="vibetrader-reel.mp4"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
              )}
            </div>
            <Button onClick={handleMerge} disabled={doneCount === 0 || anyBusy || merging}
              className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold disabled:opacity-40">
              {merging ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Merging...</>
                : mergedUrl ? <><RefreshCw className="w-4 h-4 mr-2" />Re-merge</>
                  : <><Merge className="w-4 h-4 mr-2" />Merge {doneCount} Clip{doneCount !== 1 ? 's' : ''} → Final Video</>}
            </Button>
            {mergeErr && <p className="text-xs text-destructive mt-3">❌ {mergeErr}</p>}
            {mergedUrl && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="relative rounded-2xl overflow-hidden bg-black border border-violet-500/30"
                  style={{ aspectRatio: '9/16', maxHeight: '420px', width: '100%', maxWidth: '240px' }}>
                  <video src={mergedUrl} controls autoPlay loop playsInline className="w-full h-full object-contain" />
                </div>
              </div>
            )}
          </Card>

          {/* Caption */}
          <Card className="p-5 bg-background/40 border-primary/10 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-sky-400 uppercase tracking-widest">Instagram Caption</label>
              <CopyBtn text={reel.instagram_caption} />
            </div>
            <textarea value={reel.instagram_caption} onChange={e => setReel({ ...reel, instagram_caption: e.target.value })}
              className="w-full min-h-[140px] p-3 rounded-xl bg-muted/40 border border-primary/10 focus:border-sky-400/40 outline-none resize-y text-sm text-foreground leading-relaxed" />
          </Card>

          {/* Script.txt */}
          <Card className="p-5 bg-background/40 border-primary/10 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Script.txt (for CapCut)
              </label>
              <CopyBtn text={buildScriptTxt()} />
            </div>
            <pre className="text-xs font-mono text-muted-foreground bg-muted/30 rounded-xl p-4 overflow-auto max-h-[200px] whitespace-pre-wrap leading-relaxed">
              {buildScriptTxt()}
            </pre>
          </Card>
        </>
      )}
    </div>
  );
}
