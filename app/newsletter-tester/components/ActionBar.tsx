'use client';
// ActionBar.tsx — the row of main action buttons
import { NewsletterType } from '../constants';
import type { SendStatus } from '../hooks/useNewsletterPage';

interface ActionBarProps {
    activeType:    NewsletterType;
    loading:       boolean;
    showPrompts:   boolean;
    publishing:    boolean;
    publishStatus: 'idle' | 'success' | 'error';
    sendStatus:    SendStatus;
    hasHtml:       boolean;
    onGeneratePipeline: (rediscover?: boolean) => void;
    onGeneratePuzzle:   () => void;
    onTypeSwitch:       (type: NewsletterType) => void;
    onTogglePrompts:    () => void;
    onPublish:          () => void;
    onSend:             () => void;
}

export default function ActionBar({
    activeType, loading, showPrompts, publishing, publishStatus,
    sendStatus, hasHtml,
    onGeneratePipeline, onGeneratePuzzle, onTypeSwitch, onTogglePrompts, onPublish, onSend,
}: ActionBarProps) {

    const sendLabel = () => {
        if (sendStatus === 'sending') return <><span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full"/>Sending…</>;
        if (sendStatus === 'sent')    return <>✅ Sent!</>;
        if (sendStatus === 'error')   return <>❌ Failed</>;
        return <>📨 Send via Resend</>;
    };

    const sendClass = () => {
        const base = 'px-6 py-4 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-60';
        if (sendStatus === 'sent')    return `${base} bg-emerald-600 text-white`;
        if (sendStatus === 'error')   return `${base} bg-red-600 text-white`;
        if (sendStatus === 'sending') return `${base} bg-orange-500 text-white cursor-wait`;
        return `${base} bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20`;
    };

    return (
        <div className="flex items-center gap-3 flex-wrap justify-center">
            <button onClick={() => { onTypeSwitch('weekly'); onGeneratePipeline(false); }} disabled={loading}
                className={`px-8 py-4 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-60 ${activeType==='weekly'&&loading ? 'bg-emerald-800 text-white cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                {activeType==='weekly'&&loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full"/> : '🚀'} Thursday Weekly
            </button>
            <button onClick={() => { onTypeSwitch('puzzle'); onGeneratePuzzle(); }} disabled={loading}
                className={`px-8 py-4 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-60 ${activeType==='puzzle'&&loading ? 'bg-purple-700 text-white cursor-wait' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}>
                {activeType==='puzzle'&&loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full"/> : '🧩'} Tuesday Puzzle
            </button>
            
            <button
                onClick={onPublish}
                disabled={publishing}
                className={`px-8 py-4 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-60 ${publishing ? 'bg-blue-800 text-white cursor-wait' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
                {publishing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full"/> : '☁️'} Publish to Azure
            </button>
            
            <button
                onClick={onSend}
                disabled={!hasHtml || sendStatus === 'sending'}
                className={sendClass()}
            >
                {sendLabel()}
            </button>
        </div>
    );
}
