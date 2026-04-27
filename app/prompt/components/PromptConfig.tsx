import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_TEMPLATE } from '../constants';

interface PromptConfigProps {
    systemPrompt: string;
    setSystemPrompt: (v: string) => void;
    userTemplate: string;
    setUserTemplate: (v: string) => void;
}

export default function PromptConfig({
    systemPrompt,
    setSystemPrompt,
    userTemplate,
    setUserTemplate
}: PromptConfigProps) {
    return (
        <div className="flex flex-col gap-4 flex-1">
            <div className="flex flex-col shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Engineering Logic (System)</label>
                    <button onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)} className="text-[10px] text-purple-600 font-bold hover:underline">Reset to Default</button>
                </div>
                <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full h-[320px] p-5 font-mono text-xs border rounded-2xl bg-card shadow-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all leading-relaxed"
                />
            </div>

            <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center block">Input Template (User)</label>
                    <div className="flex gap-2">
                        <span className="text-[8px] bg-muted px-1.5 py-0.5 rounded uppercase font-bold text-muted-foreground">{'{headline}'}</span>
                        <span className="text-[8px] bg-muted px-1.5 py-0.5 rounded uppercase font-bold text-muted-foreground">{'{sentiment}'}</span>
                    </div>
                </div>
                <textarea
                    value={userTemplate}
                    onChange={(e) => setUserTemplate(e.target.value)}
                    className="w-full flex-1 min-h-[140px] p-4 font-mono text-[11px] border rounded-2xl bg-card shadow-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                />
                <button onClick={() => setUserTemplate(DEFAULT_USER_TEMPLATE)} className="text-[10px] text-purple-600 font-bold hover:underline self-end mt-1">Reset Template</button>
            </div>
        </div>
    );
}
