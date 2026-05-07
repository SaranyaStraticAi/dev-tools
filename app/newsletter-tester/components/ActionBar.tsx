'use client';
// ActionBar.tsx — the row of 4 main action buttons
import { NewsletterType } from '../constants';

interface ActionBarProps {
    activeType: NewsletterType;
    loading: boolean;
    showPrompts: boolean;
    publishing: boolean;
    publishStatus: 'idle' | 'success' | 'error';
    onGenerate: (type: NewsletterType) => void;
    onTogglePrompts: () => void;
    onPublish: () => void;
}

export default function ActionBar({
    activeType, loading, showPrompts, publishing, publishStatus,
    onGenerate, onTogglePrompts, onPublish,
}: ActionBarProps) {
    return (
        <div className="flex items-center gap-3 flex-wrap justify-center">
            <button onClick={() => onGenerate('weekly')} disabled={loading}
                className={`px-8 py-4 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-60 ${activeType==='weekly'&&loading ? 'bg-green-700 text-white cursor-wait' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                {activeType==='weekly'&&loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full"/> : '📅'} Thursday Weekly
            </button>
            <button onClick={() => onGenerate('puzzle')} disabled={loading}
                className={`px-8 py-4 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-60 ${activeType==='puzzle'&&loading ? 'bg-purple-700 text-white cursor-wait' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}>
                {activeType==='puzzle'&&loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full"/> : '🧩'} Tuesday Puzzle
            </button>
            <button onClick={onTogglePrompts}
                className={`px-6 py-4 rounded-2xl font-bold text-sm border transition-all flex items-center gap-2 ${showPrompts ? 'border-purple-500 bg-purple-500/10 text-purple-500' : 'border-border hover:bg-muted'}`}>
                ✏️ Edit Prompts
            </button>
            <button onClick={onPublish} disabled={publishing}
                className={`px-6 py-4 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-60 ${publishStatus==='success' ? 'bg-green-600 text-white' : publishStatus==='error' ? 'bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'}`}>
                {publishing ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full"/>Publishing…</> : publishStatus==='success' ? '✅ Published!' : publishStatus==='error' ? '❌ Failed' : '☁️ Publish to Azure'}
            </button>
        </div>
    );
}
