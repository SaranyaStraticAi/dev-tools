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
Voice 2 (Observer): studies traders from the outside. Precise. Psychologically sharp.
Voice 3 (Product): the product speaking. Calm, functional, no hype.

## REEL STRUCTURE
Scenes: HOOK, BUILD, LAND.

## SCRIPT RULES
- On-screen text only. Grade 6 reading level. Max 4 words per frame.
- Hard cuts between frames. Fast-fast-PAUSE rhythm.

## SORA 2 VISUAL DIRECTION
Lead with shot type. Under 150 words. NO humans, NO silhouettes, NO characters, NO hands, NO shoulders, NO body parts, NO faces, NO brand logos. (Strict Azure safety moderation compliance).

Every sora_prompt MUST open with the same environment anchor line:
"Dark trading room. Single monitor glow. Same desk, same scene. Empty environment, no people."
Then describe the specific shot for that scene.

## CAPTION FORMULA
Line 1: Hook — 1 line, max 10 words.
Body — 2 lines max.
Engagement CTA. Follow CTA with concrete reason.
#forextrading #tradingpsychology #aitrading #forexeducation #vibetrader
Disclaimer: VibeTrader, Inc. is a technology company providing behavioral analytics and educational software tools.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resizeBase64Image(base64Str: string, targetWidth: number, targetHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64Str}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
    };
    img.onerror = (err) => {
      reject(err);
    };
  });
}

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

function SceneCard({ n, scene, onUpdate, onGenerate, onDelete, clip, refImage, refBusy, onGenerateRef, prevLastFrame, continuity }: {
  n: number; scene: Scene; onUpdate: (s: Scene) => void; onGenerate: () => void; onDelete: () => void; clip: ClipSt;
  refImage: string | null; refBusy: boolean; onGenerateRef: () => void;
  prevLastFrame: string | null; continuity: boolean;
}) {
  const busy = ['submitting', 'polling', 'downloading'].includes(clip.status);
  return (
    <Card className="p-4 bg-background/50 border-primary/10 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-violet-400">Clip {n}</span>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {DURATIONS.map(d => (
              <button key={d} onClick={() => onUpdate({ ...scene, duration_seconds: d })} disabled={busy}
                className={`px-2 py-0.5 rounded text-xs font-semibold border transition-all ${scene.duration_seconds === d ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted/30 text-muted-foreground border-primary/10 hover:border-primary/30'}`}>
                {d}s
              </button>
            ))}
          </div>
          <button onClick={onDelete} disabled={busy} className="p-1 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">On-screen text (optional)</label>
        <textarea value={scene.script_lines.join('\\n')} disabled={busy}
          onChange={e => { const l = e.target.value.split('\\n'); onUpdate({ ...scene, script_lines: l }); }}
          placeholder="Lines of text to burn into the video (one per line)..."
          className="w-full px-2.5 py-1.5 min-h-[60px] rounded-lg bg-muted/40 border border-primary/10 focus:border-emerald-400/50 outline-none text-xs text-foreground font-mono" />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-semibold text-fuchsia-400 uppercase tracking-widest">
          Sora 2 prompt <span className="font-normal normal-case text-muted-foreground">{scene.sora_prompt.length}c</span>
        </label>
        <textarea value={scene.sora_prompt} disabled={busy} onChange={e => onUpdate({ ...scene, sora_prompt: e.target.value })}
          className="w-full min-h-[80px] px-2.5 py-2 rounded-lg bg-muted/40 border border-primary/10 focus:border-fuchsia-400/40 outline-none resize-y text-[11px] font-mono text-muted-foreground leading-relaxed" />
      </div>

      {/* Reference image / Continuity frame */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest flex items-center gap-1">
            🎨 Reference image
            {refImage ? (
              <span className="font-normal normal-case text-emerald-400 ml-1">· feeds into Sora as first frame</span>
            ) : (
              n > 1 && continuity && prevLastFrame && <span className="font-normal normal-case text-emerald-400 ml-1">· auto-extracted from Clip {n-1} end</span>
            )}
          </label>
          <button onClick={onGenerateRef} disabled={busy || refBusy}
            className="text-[10px] px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 transition-all font-semibold flex items-center gap-1">
            {refBusy ? <><Loader2 className="w-2.5 h-2.5 animate-spin" />Generating...</> : refImage ? <><RefreshCw className="w-2.5 h-2.5" />Regenerate</> : <>Generate</>}
          </button>
        </div>
        {refImage ? (
          <div className="rounded-lg overflow-hidden border border-amber-500/20 bg-black" style={{ aspectRatio: '9/16', maxHeight: '160px' }}>
            <img src={`data:image/jpeg;base64,\${refImage}`} alt={`Clip \${n} reference`} className="w-full h-full object-cover" />
          </div>
        ) : n > 1 && continuity && prevLastFrame ? (
          <div className="rounded-lg overflow-hidden border border-emerald-500/20 bg-black" style={{ aspectRatio: '9/16', maxHeight: '160px' }}>
            <img src={`data:image/jpeg;base64,\${prevLastFrame}`} alt={`Clip \${n} starting frame`} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-primary/10 bg-muted/20 flex items-center justify-center text-[10px] text-muted-foreground/40 p-2 text-center" style={{ aspectRatio: '9/16', maxHeight: '80px' }}>
            {n === 1 ? 'no reference yet' : continuity ? `Waiting for Clip \${n-1} video...` : 'no reference (will generate from text)'}
          </div>
        )}
      </div>
      <Button onClick={onGenerate} disabled={busy || !scene.sora_prompt.trim()} size="sm"
        className="w-full bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-xs font-semibold disabled:opacity-40 h-8">
        {busy ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{clip.status === 'polling' ? `\${clip.elapsed}s...` : clip.status === 'submitting' ? 'Queuing...' : 'Downloading...'}</>
          : clip.status === 'done' ? <><RefreshCw className="w-3 h-3 mr-1" />Re-gen</>
            : <><Play className="w-3 h-3 mr-1" />Generate Clip {n}</>}
      </Button>
      {clip.status === 'polling' && (
        <div className="h-0.5 bg-muted/40 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-full transition-all duration-1000" style={{ width: `\${Math.min((clip.elapsed / 120) * 100, 92)}%` }} />
        </div>
      )}
      {clip.status === 'error' && <p className="text-[10px] text-destructive">❌ {clip.err}</p>}
      {clip.url && (
        <div className="relative rounded-lg overflow-hidden bg-black border border-primary/10" style={{ aspectRatio: '9/16', maxHeight: '220px' }}>
          <video src={clip.url} controls autoPlay loop playsInline className="w-full h-full object-contain" />
          <a href={clip.url} download={`clip_\${n}.mp4`} className="absolute top-2 right-2 p-1 rounded-md bg-black/60 border border-white/10">
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
  const [showSys, setShowSys] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null); // null = auto-assembled
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [rawScript, setRawScript] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [clips, setClips] = useState<ClipSt[]>([]);
  const [lastFrames, setLastFrames] = useState<(string | null)[]>([]);
  const [refImages, setRefImages] = useState<(string | null)[]>([]);
  const [refBusy, setRefBusy] = useState<boolean[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [mergeErr, setMergeErr] = useState<string | null>(null);
  const [mergeStatus, setMergeStatus] = useState('');
  const [continuity, setContinuity] = useState(true);

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
        body: JSON.stringify({ name: saveName, day, systemPrompt: sysP, savedBy }),
      });
      if (r.ok) { const cfg = await r.json(); setConfigs(prev => [cfg, ...prev]); setSaveName(''); setShowSaveForm(false); }
    } catch { } finally { setSaving(false); }
  }

  function handleLoad(cfg: SavedConfig) {
    setSysP(cfg.systemPrompt);
    if (cfg.day !== day) {
      setDay(cfg.day);
      setRawScript('');
      setScenes([]);
      setClips([]);
      setLastFrames([]);
      setRefImages([]);
      setRefBusy([]);
    }
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
    setDay(d);
    setRawScript('');
    setScenes([]);
    setClips([]);
    setLastFrames([]);
    setEditedPrompt(null);
    setRefImages([]);
    setRefBusy([]);
    setGenErr(null); setMergedUrl(null); setMergeErr(null);
  }

  function addScene() {
    setScenes([...scenes, { duration_seconds: 12, script_lines: [], sora_prompt: '' }]);
    setClips([...clips, initClip()]);
    setLastFrames([...lastFrames, null]);
    setRefImages([...refImages, null]);
    setRefBusy([...refBusy, false]);
  }

  function removeScene(idx: number) {
    setScenes(s => s.filter((_, i) => i !== idx));
    setClips(c => c.filter((_, i) => i !== idx));
    setLastFrames(f => f.filter((_, i) => i !== idx));
    setRefImages(r => r.filter((_, i) => i !== idx));
    setRefBusy(b => b.filter((_, i) => i !== idx));
  }

  function updateScene(idx: number, s: Scene) {
    const newScenes = [...scenes];
    newScenes[idx] = s;
    setScenes(newScenes);
  }

  async function generateRefImage(idx: number) {
    if (idx < 0 || idx >= scenes.length) return;
    const scene = scenes[idx];
    
    setRefBusy(prev => { const b=[...prev]; b[idx]=true; return b; });
    try {
      const cfg = await fetch('/api/generate-image').then(r => r.json());
      if (cfg.error) throw new Error(cfg.error);
      const prompt = scene.sora_prompt;
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Api-key': cfg.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:         cfg.deployment,
          prompt,
          size:          '1024x1792',
          quality:       'medium',
          n:             1,
          output_format: 'jpeg',    // valid values: 'jpeg' | 'png'  (NOT 'b64_json')
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Image API ${res.status}`);

      // Azure returns b64_json inline when output_format is set, or a URL — handle both
      let b64: string | null = data.data?.[0]?.b64_json ?? null;

      if (!b64) {
        const imgUrl = data.data?.[0]?.url ?? null;
        if (!imgUrl) throw new Error('No image returned from API');
        // Fetch the URL and convert to base64
        const imgRes  = await fetch(imgUrl);
        const imgBuf  = await imgRes.arrayBuffer();
        const bytes   = new Uint8Array(imgBuf);
        let binary = '';
        bytes.forEach(b => { binary += String.fromCharCode(b); });
        b64 = btoa(binary);
      }

      setRefImages(prev => { const r=[...prev]; r[idx]=b64; return r; });
    } catch(e:any) {
      console.error(`[ref-image] Clip ${idx+1}:`, e.message);
    } finally {
      setRefBusy(prev => { const b=[...prev]; b[idx]=false; return b; });
    }
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
      `CTA goal: Comments + Follows`, `Engagement CTA: ${d.cta}`, `Follow CTA hint: ${d.follow}`].join('\n');
  }

  function buildFullUserPrompt() {
    const parts = [buildBrief()];
    parts.push('\n## YOUR TASK');
    parts.push('Generate a complete script for this Reel.');
    parts.push('Write naturally, no JSON format required. Provide the full script and visual directions.');
    return parts.join('\n');
  }

  async function handleGenerateScript() {
    setGenBusy(true); setGenErr(null); setRawScript('');
    try {
      const body = editedPrompt !== null
        ? { systemPrompt: sysP, userPrompt: editedPrompt, temperature: 0.85 }
        : { systemPrompt: sysP, userPrompt: buildFullUserPrompt(), temperature: 0.85 };

      const r = await fetch('/api/video-reel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      setRawScript(data.script);
    } catch (e: any) { setGenErr(e.message || 'Script generation failed'); }
    finally { setGenBusy(false); }
  }

  async function handleGenerateClip(idx: number) {
    if (idx < 0 || idx >= scenes.length) return;
    const scene = scenes[idx];
    if (!scene.sora_prompt.trim()) return;
    setMergedUrl(null); setMergeErr(null);
    function upd(p: Partial<ClipSt>) { setClips(prev => { const c = [...prev]; c[idx] = { ...c[idx], ...p }; return c; }); }
    upd({ status: 'submitting', elapsed: 0, url: null, err: null });
    try {
      const cfg = await fetch('/api/generate-video').then(r => r.json());

      // Image conditioning priority:
      // 1. Reference image (designer explicitly generated + approved)
      // 2. Last frame of previous clip (continuity fallback)
      // 3. No conditioning
      const refFrame  = refImages[idx];
      const prevFrame = !refFrame && continuity && idx > 0 ? lastFrames[idx - 1] : null;
      let anchor      = refFrame ?? prevFrame;

      if (anchor) {
        try {
          // Resize to exactly 720x1280 to comply with Azure Sora 2 API requirements
          anchor = await resizeBase64Image(anchor, 720, 1280);
        } catch (resizeErr) {
          console.warn('[resize-image] failed to resize anchor, sending raw:', resizeErr);
        }
      }

      // Build Sora payload
      const soraBody: Record<string, unknown> = {
        model: 'sora-2',
        prompt: scene.sora_prompt,
        size: '720x1280',
        seconds: String(scene.duration_seconds),
      };
      if (anchor) {
        soraBody.input_reference = {
          image_url: `data:image/jpeg;base64,${anchor}`
        };
        console.log(`[sora] Clip ${idx+1}: conditioning from ${refFrame ? 'reference image' : 'prev clip last frame'}`);
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
            else if (['failed', 'canceled', 'cancelled'].includes(d.status)) {
              clearInterval(pollRefs[idx].current);
              const errMsg = d.error?.message || d.failure_reason || `Job ${d.status}`;
              reject(new Error(errMsg));
            }
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
      if (frame) setLastFrames(prev => { const f = [...prev]; f[idx] = frame; return f; });

    } catch (e: any) { 
      if (pollRefs[idx]) clearInterval(pollRefs[idx].current); 
      upd({ status: 'error', err: e.message || 'Unknown' }); 
    }
  }

  // Client-side merge via ffmpeg.wasm — works on Vercel, no server needed
  async function handleMerge() {
    if (!clips.some(c => c.status === 'done')) return;
    setMerging(true); setMergeErr(null); setMergedUrl(null); setMergeStatus('Initializing FFmpeg...');
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

      // Download Roboto Medium font for captions
      setMergeStatus('Loading Roboto font for captions...');
      try {
        await ffmpeg.writeFile(
          'font.ttf',
          await fetchFile('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf')
        );
      } catch (fontErr) {
        console.error('Failed to load font, captions might not render:', fontErr);
      }

      // Process and burn captions on each clip
      const entries: string[] = [];
      for (let i = 0; i < clips.length; i++) {
        if (clips[i].status === 'done' && clips[i].url) {
          const rawName = `clip${i}.mp4`;
          const textName = `clip_text${i}.mp4`;
          
          setMergeStatus(`Processing Clip ${i + 1} video...`);
          await ffmpeg.writeFile(rawName, await fetchFile(clips[i].url!));

          const scene = scenes[i];

          if (scene && scene.script_lines?.length > 0 && scene.script_lines.some(l => l.trim().length > 0)) {
            setMergeStatus(`Burning captions onto Clip ${i + 1}...`);
            const lines = scene.script_lines.filter(l => l.trim().length > 0);
            const totalDur = scene.duration_seconds || 8;
            const lineDur = totalDur / lines.length;

            const drawtextFilters: string[] = [];
            lines.forEach((line, j) => {
              if (!line.trim()) return;
              // Escape line text for ffmpeg drawtext filter
              const escapedLine = line
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "'\\\\''")
                .replace(/:/g, '\\:');
              
              const start = j * lineDur;
              const end = (j + 1) * lineDur;
              
              // Centered white text with black border
              drawtextFilters.push(
                `drawtext=fontfile=font.ttf:text='${escapedLine}':fontcolor=white:fontsize=44:borderw=4:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,${start},${end})'`
              );
            });

            if (drawtextFilters.length > 0) {
              const filter = drawtextFilters.join(',');
              // Re-encode video using preset ultrafast to burn subtitles
              await ffmpeg.exec([
                '-i', rawName,
                '-vf', filter,
                '-preset', 'ultrafast',
                '-crf', '22',
                textName
              ]);
              entries.push(`file '${textName}'`);
            } else {
              entries.push(`file '${rawName}'`);
            }
          } else {
            entries.push(`file '${rawName}'`);
          }
        }
      }

      if (!entries.length) throw new Error('No clips to merge');

      // Concat list
      setMergeStatus('Merging scenes into final video...');
      await ffmpeg.writeFile('list.txt', new TextEncoder().encode(entries.join('\n')));

      // Run concat — stream copy, no re-encode, fast
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'out.mp4']);

      // Read result and create blob URL
      const data = await ffmpeg.readFile('out.mp4');
      const buf = data instanceof Uint8Array ? data.buffer as ArrayBuffer : data as unknown as ArrayBuffer;
      setMergedUrl(URL.createObjectURL(new Blob([buf], { type: 'video/mp4' })));
      setMergeStatus('');
    } catch (e: any) {
      setMergeErr(e.message || 'Merge failed');
      setMergeStatus('');
    } finally { setMerging(false); }
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



      {/* Full user prompt preview — editable */}
      <Card className="bg-background/40 border-sky-500/20 overflow-hidden">
        <div className="w-full p-4 flex items-center justify-between text-sm font-semibold">
          <button className="flex-1 flex items-center gap-2 text-left hover:text-foreground transition-colors"
            onClick={() => setShowPrompt(!showPrompt)}>
            <span className="text-sky-400">👁 Full User Prompt</span>
            {editedPrompt !== null
              ? <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-semibold">✏️ Modified — this exact text will be sent to GPT-4</span>
              : <span className="font-normal normal-case text-muted-foreground text-xs">— auto-assembled · edit to override · updates live</span>
            }
            {showPrompt ? <ChevronUp className="w-4 h-4 ml-auto text-muted-foreground" /> : <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />}
          </button>
          <div className="flex items-center gap-1">
            {editedPrompt !== null && (
              <button onClick={() => setEditedPrompt(null)}
                className="px-2 py-1 rounded-md bg-muted/40 text-xs text-muted-foreground hover:text-foreground border border-primary/10 transition-colors">
                Reset
              </button>
            )}
            <CopyBtn text={editedPrompt ?? buildFullUserPrompt()} />
          </div>
        </div>
        {showPrompt && (
          <div className="border-t border-sky-500/10 p-4">
            {editedPrompt === null && (
              <div className="flex gap-3 flex-wrap text-[10px] font-semibold uppercase tracking-widest mb-3">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Part 1 · Brief</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Part 2 · Task</span>
                <span className="ml-auto text-muted-foreground/50 normal-case font-normal">Click in the box below to edit directly</span>
              </div>
            )}
            <textarea
              value={editedPrompt ?? buildFullUserPrompt()}
              onChange={e => setEditedPrompt(e.target.value)}
              className="w-full min-h-[400px] p-3 rounded-xl bg-muted/40 border border-sky-500/20 focus:border-sky-400/60 outline-none resize-y text-[11px] font-mono text-foreground leading-relaxed"
            />
            <p className="text-[10px] text-muted-foreground mt-2">
              {editedPrompt !== null
                ? 'You are in manual mode. GPT-4 will receive exactly what you typed above. Hit Reset to go back to auto.'
                : 'Auto mode. Editing any field above auto-updates this. Click inside to take manual control.'}
            </p>
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
        {genBusy ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />GPT-4 generating script...</>
          : rawScript ? <><RefreshCw className="w-5 h-5 mr-2" />Re-generate Script</>
            : <><Wand2 className="w-5 h-5 mr-2" />Generate Raw Script</>}
      </Button>

      {genErr && <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">❌ {genErr}</div>}

      {/* Raw script display */}
      {rawScript && (
        <Card className="p-5 bg-background/40 border-primary/10 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Generated Script (Raw Text)
            </label>
            <CopyBtn text={rawScript} />
          </div>
          <textarea value={rawScript} onChange={e => setRawScript(e.target.value)}
            className="w-full min-h-[300px] p-4 rounded-xl bg-muted/40 border border-primary/10 focus:border-sky-400/40 outline-none resize-y text-sm font-mono text-foreground leading-relaxed" />
        </Card>
      )}

      {/* Dynamic Scenes + merge */}
      <div className="flex items-center gap-3 mt-8 mb-4">
        <div className="flex-1 h-px bg-border/40" />
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Clip Generation Slots</span>
        <div className="flex-1 h-px bg-border/40" />
      </div>

      {/* Continuity mode toggle */}
      <div className="flex items-center justify-between px-1 mb-4">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{scenes.length} clips configured</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{doneCount}/{scenes.length} clips ready</span>
        </div>
        <button onClick={() => setContinuity(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${continuity
              ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
              : 'bg-muted/30 border-primary/10 text-muted-foreground'
            }`}
          title="When ON: last frame of Clip N is fed into Clip N+1 as starting image. Keeps lighting consistent across clips.">
          <Zap className={`w-3 h-3 ${continuity ? 'fill-violet-400' : ''}`} />
          Continuity {continuity ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenes.map((scene, i) => (
          <SceneCard key={i} n={i + 1} scene={scene} clip={clips[i]}
            refImage={refImages[i]} refBusy={refBusy[i]}
            onUpdate={s => updateScene(i, s)}
            onGenerate={() => handleGenerateClip(i)}
            onGenerateRef={() => generateRefImage(i)}
            onDelete={() => removeScene(i)}
            prevLastFrame={i > 0 ? lastFrames[i - 1] : null}
            continuity={continuity} />
        ))}
        
        {/* Add Clip Button */}
        <button onClick={addScene} className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary/10 rounded-xl bg-background/30 hover:bg-muted/20 hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground h-[220px]">
          <span className="text-2xl mb-2">+</span>
          <span className="text-sm font-semibold">Add Clip</span>
        </button>
      </div>

      {/* Merge */}
      {scenes.length > 0 && (
        <Card className={`p-5 border transition-all mt-6 ${mergedUrl ? 'border-violet-500/40 bg-background/60' : 'border-primary/10 bg-background/40'}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Merge className="w-4 h-4 text-violet-400" /> Merge &amp; Preview Final Reel
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {doneCount === 0 ? 'Generate at least 1 clip to enable merge'
                  : doneCount < scenes.length ? `${doneCount}/${scenes.length} clips ready`
                    : `All ${scenes.length} clips ready`}
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
            {merging ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {mergeStatus || 'Merging...'}
              </>
            ) : mergedUrl ? (
              <><RefreshCw className="w-4 h-4 mr-2" />Re-merge &amp; Burn Captions</>
            ) : (
              <><Merge className="w-4 h-4 mr-2" />Merge &amp; Burn Captions ({doneCount} Clip{doneCount !== 1 ? 's' : ''})</>
            )}
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
      )}
    </div>
  );
}
