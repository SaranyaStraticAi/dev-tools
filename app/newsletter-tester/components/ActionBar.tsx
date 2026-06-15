'use client';
// ActionBar.tsx — main action buttons including 4-week selector grid
import { NewsletterType, WeekType, WEEK_LABELS } from '../constants';
import type { SendStatus } from '../hooks/useNewsletterPage';

interface ActionBarProps {
    activeType:    NewsletterType;
    activeWeekType: WeekType;
    loading:       boolean;
    showPrompts:   boolean;
    publishing:    boolean;
    publishStatus: 'idle' | 'success' | 'error';
    sendStatus:    SendStatus;
    hasHtml:       boolean;
    onGenerateWeek:     (week: WeekType) => void;
    onGeneratePuzzle:   () => void;
    onTypeSwitch:       (type: NewsletterType) => void;
    onTogglePrompts:    () => void;
    onPublish:          () => void;
    onSend:             () => void;
}

export default function ActionBar({
    activeType, activeWeekType, loading, showPrompts, publishing, publishStatus,
    sendStatus, hasHtml,
    onGenerateWeek, onGeneratePuzzle, onTypeSwitch, onTogglePrompts, onPublish, onSend,
}: ActionBarProps) {

    const isWeeklyLoading = activeType === 'weekly' && loading;
    const isPuzzleLoading = activeType === 'puzzle' && loading;

    const sendLabel = () => {
        if (sendStatus === 'sending') return <><span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full"/>Sending…</>;
        if (sendStatus === 'sent')    return <>✅ Sent!</>;
        if (sendStatus === 'error')   return <>❌ Failed</>;
        return <>📨 Send via Resend</>;
    };

    const sendClass = () => {
        const base = 'px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-60';
        if (sendStatus === 'sent')    return `${base} bg-emerald-600 text-white`;
        if (sendStatus === 'error')   return `${base} bg-red-600 text-white`;
        if (sendStatus === 'sending') return `${base} bg-orange-500 text-white cursor-wait`;
        return `${base} bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20`;
    };

    return (
        <div className="flex items-start gap-3 flex-wrap justify-center">

            {/* ── 4 weekly buttons in a 2×2 grid ───────────────────────────── */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase text-center px-1">
                    Thursday Weekly
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                    {([1, 2, 3, 4] as WeekType[]).map(week => {
                        const meta      = WEEK_LABELS[week];
                        const isActive  = activeType === 'weekly' && activeWeekType === week;
                        const isRunning = isActive && loading;
                        return (
                            <button
                                key={week}
                                onClick={() => { onTypeSwitch('weekly'); onGenerateWeek(week); }}
                                disabled={loading}
                                title={meta.full}
                                className={[
                                    'px-3 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95',
                                    'flex items-center gap-1.5 disabled:opacity-60 text-white shadow-md',
                                    meta.color,
                                    isActive ? `ring-2 ${meta.ring} ring-offset-1 ring-offset-background` : '',
                                    isRunning ? 'cursor-wait' : '',
                                ].join(' ')}
                            >
                                {isRunning
                                    ? <span className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin rounded-full flex-shrink-0"/>
                                    : <span className="text-white/60 font-normal flex-shrink-0">W{week}</span>}
                                <span className="leading-tight">{meta.short}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Puzzle button ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase text-center px-1">
                    Tuesday
                </span>
                <button
                    onClick={() => { onTypeSwitch('puzzle'); onGeneratePuzzle(); }}
                    disabled={loading}
                    className={[
                        'px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95',
                        'flex items-center gap-2 disabled:opacity-60 h-full',
                        activeType === 'puzzle'
                            ? 'bg-purple-700 text-white ring-2 ring-purple-400 ring-offset-1 ring-offset-background'
                            : 'bg-purple-600 hover:bg-purple-700 text-white',
                        isPuzzleLoading ? 'cursor-wait' : '',
                    ].join(' ')}
                >
                    {isPuzzleLoading
                        ? <span className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin rounded-full"/>
                        : '🧩'}
                    Puzzle
                </button>
            </div>

            {/* ── Divider ───────────────────────────────────────────────────── */}
            <div className="w-px bg-border self-stretch mx-1 hidden sm:block"/>

            {/* ── Publish + Send ────────────────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase text-center px-1">
                    Manage
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={onPublish}
                        disabled={publishing}
                        className={[
                            'px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95',
                            'flex items-center gap-2 disabled:opacity-60',
                            publishing ? 'bg-blue-800 text-white cursor-wait' : 'bg-blue-600 hover:bg-blue-700 text-white',
                        ].join(' ')}
                    >
                        {publishing
                            ? <span className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin rounded-full"/>
                            : '☁️'}
                        Publish
                    </button>

                    <button
                        onClick={onSend}
                        disabled={!hasHtml || sendStatus === 'sending'}
                        className={sendClass()}
                    >
                        {sendLabel()}
                    </button>
                </div>
            </div>
        </div>
    );
}
