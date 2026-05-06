'use client';

import { IMAGE_SYSTEM_PROMPT, IMAGE_USER_TEMPLATE } from '../constants';

interface ImagePromptEditorProps {
    systemPrompt: string;
    userTemplate: string;
    onSystemChange: (v: string) => void;
    onUserChange: (v: string) => void;
    onClose: () => void;
    // If an image prompt was already generated this session, show it
    lastGeneratedPrompt?: string;
    // Let designer regenerate just the image with updated prompts
    onRegenerate?: () => void;
    regenerating?: boolean;
}

export default function ImagePromptEditor({
    systemPrompt,
    userTemplate,
    onSystemChange,
    onUserChange,
    onClose,
    lastGeneratedPrompt,
    onRegenerate,
    regenerating,
}: ImagePromptEditorProps) {

    const tokens = ['{subject}', '{type}', '{top_posts}'];

    return (
        <div className="w-full border rounded-2xl bg-card shadow-lg overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/40">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">🎨 Image Prompt Editor</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        controls what GPT-Image-2 generates
                    </span>
                </div>
                <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">✕ Close</button>
            </div>

            <div className="p-5 flex flex-col gap-5">

                {/* Explainer */}
                <div className="text-xs text-muted-foreground leading-relaxed bg-muted/30 border rounded-xl p-3">
                    <strong className="text-foreground">How it works:</strong> The <span className="font-mono bg-background px-1 rounded">System prompt</span> tells the LLM what style/rules to follow when writing the image prompt. The <span className="font-mono bg-background px-1 rounded">User template</span> is filled in with the actual newsletter subject + Reddit posts each run. The LLM's output (the image prompt it writes) is then sent directly to Azure GPT-Image-2.
                </div>

                {/* System prompt */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            System prompt — art director rules
                        </label>
                        <button
                            onClick={() => onSystemChange(IMAGE_SYSTEM_PROMPT)}
                            className="text-[10px] text-amber-500 font-bold hover:underline"
                        >
                            Reset to default
                        </button>
                    </div>
                    <textarea
                        value={systemPrompt}
                        onChange={e => onSystemChange(e.target.value)}
                        className="w-full h-56 p-4 font-mono text-xs border rounded-xl bg-background focus:ring-2 focus:ring-amber-500 outline-none leading-relaxed resize-y"
                        placeholder="Tell the LLM what style, mood, and rules to follow when writing the image prompt..."
                    />
                    <p className="text-[10px] text-muted-foreground">
                        Tip — change the style here to switch between Bloomberg editorial, cinematic dark, bright morning finance, etc.
                    </p>
                </div>

                {/* User template */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            User template — what gets filled in each run
                        </label>
                        <div className="flex items-center gap-2">
                            {tokens.map(t => (
                                <span key={t} className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-mono font-bold">{t}</span>
                            ))}
                            <button
                                onClick={() => onUserChange(IMAGE_USER_TEMPLATE)}
                                className="text-[10px] text-amber-500 font-bold hover:underline ml-1"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={userTemplate}
                        onChange={e => onUserChange(e.target.value)}
                        className="w-full min-h-[100px] p-4 font-mono text-[11px] border rounded-xl bg-background focus:ring-2 focus:ring-amber-500 outline-none resize-y"
                    />
                    {/* Token preview */}
                    <div className="p-3 font-mono text-[10px] border rounded-xl bg-muted/30 leading-relaxed whitespace-pre-wrap pointer-events-none select-none">
                        <span className="text-[9px] uppercase tracking-widest font-bold block mb-1 text-muted-foreground/60">Token preview</span>
                        {userTemplate.split(/(\{subject\}|\{type\}|\{top_posts\})/).map((part, i) => {
                            if (part === '{subject}')   return <mark key={i} className="bg-amber-500/25 text-amber-500 rounded px-0.5 not-italic font-bold">{'{subject}'}</mark>;
                            if (part === '{type}')      return <mark key={i} className="bg-orange-500/25 text-orange-400 rounded px-0.5 not-italic font-bold">{'{type}'}</mark>;
                            if (part === '{top_posts}') return <mark key={i} className="bg-blue-500/25 text-blue-400 rounded px-0.5 not-italic font-bold">{'{top_posts}'}</mark>;
                            return <span key={i} className="text-muted-foreground">{part}</span>;
                        })}
                    </div>
                </div>

                {/* Last generated image prompt — read only, shown for reference */}
                {lastGeneratedPrompt && (
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Last generated image prompt (sent to GPT-Image-2)
                        </label>
                        <div className="p-4 font-mono text-[11px] border border-dashed rounded-xl bg-muted/20 leading-relaxed text-muted-foreground whitespace-pre-wrap select-all">
                            {lastGeneratedPrompt}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            This is what the LLM wrote based on your system + user templates. Edit the templates above and click Regenerate Image to try a different style.
                        </p>
                    </div>
                )}

                {/* Regenerate button — only shows if there's a newsletter already generated */}
                {onRegenerate && (
                    <button
                        onClick={onRegenerate}
                        disabled={regenerating}
                        className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-black disabled:opacity-60 transition-all"
                    >
                        {regenerating
                            ? <><span className="w-4 h-4 border-2 border-black/20 border-t-black animate-spin rounded-full" /> Generating image...</>
                            : '🎨 Regenerate hero image with these prompts'
                        }
                    </button>
                )}

            </div>
        </div>
    );
}
