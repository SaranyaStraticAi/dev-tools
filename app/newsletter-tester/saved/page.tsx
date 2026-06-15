'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMsal } from "@azure/msal-react";
import { ArrowLeft, Mail, Calendar, Trash2, Loader2, Eye, RefreshCw, Send, CheckCircle, AlertCircle, Clock, Users, ChevronDown, ChevronUp, Pencil } from 'lucide-react';

interface SavedNewsletter {
    id:         string;
    subject:    string;
    body:       string | null;
    raw_text:   string | null;
    type:       string;
    created_at: string;
}

interface Segment {
    id:   string;
    name: string;
}

export default function SavedNewslettersPage() {
    const { accounts } = useMsal();
    const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Auth gating
    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('employee_session');
        if (saved) setEmployeeAccount(saved);
    }, []);

    const userEmail = accounts[0]?.username;
    const isAllowed = userEmail === 'masood@aity.dev' || employeeAccount === 'ketki@vibetrader.com' || userEmail === 'ketki@vibetrader.com' || userEmail === 'saranya@vibetrader.com' || employeeAccount === 'saranya@vibetrader.com';

    // State
    const [savedDrafts, setSavedDrafts] = useState<SavedNewsletter[]>([]);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedDraft, setSelectedDraft] = useState<SavedNewsletter | null>(null);
    
    // Send state
    const [showSendModal, setShowSendModal] = useState(false);
    const [selectedSegs, setSelectedSegs] = useState<string[]>([]);
    const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'scheduled' | 'error'>('idle');
    const [sendError, setSendError] = useState('');
    const [broadcastId, setBroadcastId] = useState<string | null>(null);
    // Scheduling state
    const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
    const [scheduledAt, setScheduledAt] = useState('');  // datetime-local value

    // Clerk → Resend sync state
    const [showSyncPanel, setShowSyncPanel] = useState(false);
    const [syncSegmentId, setSyncSegmentId] = useState('');
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
    const [syncResult, setSyncResult] = useState<{
        total: number; created: number; alreadyExisted: number;
        addedToSegment: number; errors: string[];
    } | null>(null);
    const [syncError, setSyncError] = useState('');

    // Fetch saved drafts
    const fetchDrafts = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/saved-newsletters');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to load saved newsletters');
            setSavedDrafts(data.saved ?? []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch segments
    const fetchSegments = useCallback(async () => {
        try {
            const res = await fetch('/api/resend-segments');
            if (!res.ok) return;
            const data = await res.json();
            if (data.segments) setSegments(data.segments);
        } catch (e) {
            console.warn('[fetchSegments] error', e);
        }
    }, []);

    useEffect(() => {
        if (isAllowed) {
            fetchDrafts();
            fetchSegments();
        }
    }, [isAllowed, fetchDrafts, fetchSegments]);

    // Handle delete
    const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to permanently delete this saved newsletter draft?')) return;

        try {
            const res = await fetch(`/api/saved-newsletters?id=${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to delete draft');
            setSavedDrafts(prev => prev.filter(d => d.id !== id));
            if (selectedDraft?.id === id) {
                setSelectedDraft(null);
            }
        } catch (err: any) {
            alert(err.message);
        }
    };

    // Handle Send
    const handleSendDraft = async () => {
        if (!selectedDraft || !selectedDraft.body) {
            setSendError('Selected draft has no HTML content');
            return;
        }

        // Validate schedule time is in the future (and within 72h)
        let isoScheduledAt: string | undefined;
        if (scheduleMode === 'later') {
            if (!scheduledAt) {
                setSendError('Please pick a date and time to schedule.');
                return;
            }
            const scheduledDate = new Date(scheduledAt);
            const now = new Date();
            const diffHours = (scheduledDate.getTime() - now.getTime()) / 3_600_000;
            if (diffHours <= 0) {
                setSendError('Scheduled time must be in the future.');
                return;
            }
            if (diffHours > 72) {
                setSendError('Resend only supports scheduling up to 72 hours in advance.');
                return;
            }
            isoScheduledAt = scheduledDate.toISOString();
        }

        setSendStatus('sending');
        setSendError('');
        setBroadcastId(null);

        try {
            const res = await fetch('/api/send-newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: selectedDraft.body,
                    subject: selectedDraft.subject,
                    segmentIds: selectedSegs,
                    type: selectedDraft.type,
                    ...(isoScheduledAt ? { scheduledAt: isoScheduledAt } : {}),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Send failed');
            setBroadcastId(data.broadcastId);
            setSendStatus(data.status === 'scheduled' ? 'scheduled' : 'sent');
            setTimeout(() => {
                setShowSendModal(false);
                setSendStatus('idle');
                setScheduleMode('now');
                setScheduledAt('');
            }, 4000);
        } catch (e: any) {
            setSendError(e.message ?? 'Unknown error');
            setSendStatus('error');
        }
    };

    // Clerk → Resend sync handler
    const handleSyncClerkContacts = async () => {
        setSyncStatus('syncing');
        setSyncError('');
        setSyncResult(null);
        try {
            const res = await fetch('/api/sync-clerk-to-resend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instance: 'live',  // always Live only
                    ...(syncSegmentId ? { segmentId: syncSegmentId } : {}),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Sync failed');
            setSyncResult(data);
            setSyncStatus('done');
            // Refresh segments after sync
            fetchSegments();
        } catch (e: any) {
            setSyncError(e.message ?? 'Unknown error');
            setSyncStatus('error');
        }
    };


    if (!mounted) return null;

    if (!isAllowed) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center flex flex-col gap-2">
                    <span className="text-2xl">🔒</span>
                    <p className="text-sm text-muted-foreground">Access Denied. Only Masood and Ketki are allowed.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background py-10 px-4">
            <div className="max-w-6xl mx-auto flex flex-col gap-6">

                {/* Header */}
                <div className="flex items-center justify-between gap-4 flex-wrap border-b pb-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <a href="/newsletter-tester"
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                                <ArrowLeft className="w-3.5 h-3.5" /> Back to Tester
                            </a>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            💾 Saved Newsletter Drafts
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage your saved Thursday or Tuesday newsletters, preview layouts, and send them when ready
                        </p>
                    </div>
                    <button
                        onClick={fetchDrafts}
                        className="px-3.5 py-2 text-xs font-bold rounded-xl border border-muted hover:bg-muted flex items-center gap-2 transition-all"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        ❌ {error}
                    </div>
                )}

                {/* Main Split Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-6 items-start">

                    {/* Left Panel: Saved Drafts List */}
                    <div className="flex flex-col gap-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 border rounded-2xl bg-card">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                <span className="text-sm text-muted-foreground">Loading saved drafts...</span>
                            </div>
                        ) : savedDrafts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 border rounded-2xl bg-card text-center">
                                <span className="text-4xl mb-2">📥</span>
                                <p className="text-sm font-semibold">No saved drafts yet.</p>
                                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                                    Generate a newsletter in the Tester, make any direct edits, and click the &quot;Save for Later&quot; button to keep it here.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {savedDrafts.map(draft => {
                                    const isSelected = selectedDraft?.id === draft.id;

                                    return (
                                        <div
                                            key={draft.id}
                                            onClick={() => setSelectedDraft(draft)}
                                            className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-3 group bg-card ${
                                                isSelected 
                                                    ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-500/5' 
                                                    : 'hover:border-indigo-500/50 hover:bg-muted/20'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <span className="text-base font-bold truncate group-hover:text-indigo-400 transition-colors">
                                                        {draft.subject}
                                                    </span>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            {new Date(draft.created_at).toLocaleDateString(undefined, { 
                                                                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        draft.type === 'puzzle' 
                                                            ? 'bg-blue-500/15 text-blue-400' 
                                                            : 'bg-indigo-500/15 text-indigo-400'
                                                    }`}>
                                                        {draft.type}
                                                    </span>
                                                    {/* Edit button */}
                                                    <a
                                                        href={`/newsletter-tester/saved/${draft.id}/edit`}
                                                        onClick={e => e.stopPropagation()}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Edit this draft"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </a>
                                                    <button
                                                        onClick={(e) => handleDeleteDraft(draft.id, e)}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Delete saved draft"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Selected Draft Action Panel */}
                    <div className="sticky top-6 flex flex-col gap-4">
                        {selectedDraft ? (
                            <div className="border rounded-2xl bg-card p-6 flex flex-col gap-5 shadow-xl">
                                
                                {/* Header Info */}
                                <div className="flex items-start justify-between border-b pb-4">
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <h3 className="font-extrabold text-base truncate">{selectedDraft.subject}</h3>
                                        <p className="text-[10px] text-muted-foreground">
                                            Saved Draft ID: <span className="font-mono">{selectedDraft.id}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Action buttons row */}
                                <div className="flex gap-2">
                                    {/* Edit button */}
                                    <a
                                        href={`/newsletter-tester/saved/${selectedDraft.id}/edit`}
                                        className="flex-1 py-3 bg-muted hover:bg-muted/80 border font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Pencil className="w-4 h-4" /> Edit Content
                                    </a>
                                    {/* Send button */}
                                    <button
                                        onClick={() => {
                                            setSelectedSegs([]);
                                            setSendStatus('idle');
                                            setSendError('');
                                            setScheduleMode('now');
                                            setScheduledAt('');
                                            setShowSendModal(true);
                                        }}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                                    >
                                        <Send className="w-4 h-4" /> Send Now
                                    </button>
                                </div>

                                {/* Preview container */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                        <Eye className="w-3.5 h-3.5" /> Live HTML Preview
                                    </span>
                                    <div className="w-full h-96 rounded-xl border bg-white overflow-hidden shadow-inner">
                                        <iframe
                                            srcDoc={selectedDraft.body ?? '<p className="text-muted-foreground p-4">No content available</p>'}
                                            className="w-full h-full border-0"
                                            title="Saved draft email preview"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground h-96">
                                <Mail className="w-12 h-12 text-muted-foreground/30 animate-pulse" />
                                <h3 className="font-bold text-sm text-foreground">No Draft Selected</h3>
                                <p className="text-xs max-w-[250px]">
                                    Click any saved newsletter draft on the left to preview it and launch the sending wizard.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Send Wizard Modal */}
                {showSendModal && selectedDraft && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-card border rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 shadow-xl animate-in zoom-in-95">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">Send Newsletter</h2>
                                <button onClick={() => setShowSendModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Select audience segments to target. If no segments are selected, it sends to the default Resend list.
                            </p>

                            {/* Status Banners */}
                            {sendStatus === 'sending' && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-xs">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    {scheduleMode === 'later' ? 'Scheduling newsletter...' : 'Sending newsletter...'}
                                </div>
                            )}
                            {sendStatus === 'sent' && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Sent successfully! Broadcast ID: {broadcastId}
                                </div>
                            )}
                            {sendStatus === 'scheduled' && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-xs">
                                    <Clock className="w-3.5 h-3.5" />
                                    Scheduled! Broadcast ID: {broadcastId}
                                </div>
                            )}
                            {sendStatus === 'error' && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Error: {sendError}
                                </div>
                            )}
                            {/* Schedule Toggle */}
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-muted-foreground">When to Send</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setScheduleMode('now')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                                            scheduleMode === 'now'
                                                ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                                                : 'border-muted hover:bg-muted'
                                        }`}
                                    >
                                        <Send className="w-3 h-3" /> Send Now
                                    </button>
                                    <button
                                        onClick={() => setScheduleMode('later')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                                            scheduleMode === 'later'
                                                ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                : 'border-muted hover:bg-muted'
                                        }`}
                                    >
                                        <Clock className="w-3 h-3" /> Schedule
                                    </button>
                                </div>
                                {scheduleMode === 'later' && (
                                    <div className="flex flex-col gap-1.5">
                                        <input
                                            type="datetime-local"
                                            value={scheduledAt}
                                            onChange={(e) => setScheduledAt(e.target.value)}
                                            min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                                            max={new Date(Date.now() + 72 * 3_600_000).toISOString().slice(0, 16)}
                                            className="w-full px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-foreground"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            ⏰ Resend supports scheduling up to <span className="font-semibold">72 hours</span> in advance.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* ── Clerk Sync Collapsible Panel ────────────────── */}
                            <div className="border border-dashed rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setShowSyncPanel(p => !p)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold hover:bg-muted transition-colors"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                                        Sync Clerk Contacts → Resend
                                    </span>
                                    {showSyncPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>

                                {showSyncPanel && (
                                    <div className="px-4 pb-4 pt-2 flex flex-col gap-3 border-t">
                                        <p className="text-[10px] text-muted-foreground">
                                            Fetches all users from your <strong>Live</strong> Clerk instance and upserts them into your Resend audience. Optionally add them to a specific segment.
                                        </p>

                                        {/* Segment picker */}
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Add to Segment (optional)</span>
                                            <select
                                                value={syncSegmentId}
                                                onChange={e => setSyncSegmentId(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            >
                                                <option value="">— No segment (audience only) —</option>
                                                {segments.map(seg => (
                                                    <option key={seg.id} value={seg.id}>{seg.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Sync result */}
                                        {syncStatus === 'done' && syncResult && (
                                            <div className="flex flex-col gap-1 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs">
                                                <span className="font-bold text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Sync complete!</span>
                                                <span className="text-muted-foreground">Total Clerk Live users: <strong>{syncResult.total}</strong></span>
                                                <span className="text-muted-foreground">Newly added to Resend: <strong className="text-green-400">{syncResult.created}</strong></span>
                                                <span className="text-muted-foreground">Already in Resend: <strong>{syncResult.alreadyExisted}</strong></span>
                                                {syncResult.addedToSegment > 0 && (
                                                    <span className="text-muted-foreground">✅ Added to segment: <strong className="text-indigo-400">{syncResult.addedToSegment}</strong> / {syncResult.total - syncResult.errors.length}</span>
                                                )}
                                                {syncResult.errors.length > 0 && (
                                                    <span className="text-red-400">{syncResult.errors.length} error(s) — see console</span>
                                                )}
                                            </div>
                                        )}
                                        {syncStatus === 'error' && (
                                            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                                                <AlertCircle className="w-3 h-3 inline mr-1" />{syncError}
                                            </div>
                                        )}

                                        {/* Sync button */}
                                        <button
                                            onClick={handleSyncClerkContacts}
                                            disabled={syncStatus === 'syncing'}
                                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            {syncStatus === 'syncing'
                                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing Clerk users...</>
                                                : <><Users className="w-3.5 h-3.5" /> Run Sync Now</>
                                            }
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Segments checkbox list */}
                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border-t border-b py-3 my-1">
                                {segments.map(seg => (
                                    <label key={seg.id} className="flex items-center gap-3 p-2.5 hover:bg-muted rounded-xl cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedSegs.includes(seg.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedSegs([...selectedSegs, seg.id]);
                                                } else {
                                                    setSelectedSegs(selectedSegs.filter(id => id !== seg.id));
                                                }
                                            }}
                                            className="rounded border-muted text-indigo-500 focus:ring-indigo-500 w-4 h-4"
                                        />
                                        <span className="text-sm font-medium">{seg.name}</span>
                                    </label>
                                ))}
                                {segments.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-4">No Resend segments loaded.</p>
                                )}
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 justify-end mt-2">
                                <button
                                    onClick={() => setShowSendModal(false)}
                                    disabled={sendStatus === 'sending'}
                                    className="px-4 py-2.5 border rounded-xl text-xs font-bold hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendDraft}
                                    disabled={sendStatus === 'sending' || sendStatus === 'sent' || sendStatus === 'scheduled'}
                                    className={`px-4 py-2.5 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm ${
                                        scheduleMode === 'later'
                                            ? 'bg-blue-500 hover:bg-blue-600'
                                            : 'bg-indigo-500 hover:bg-indigo-600'
                                    }`}
                                >
                                    {sendStatus === 'sending'
                                        ? (scheduleMode === 'later' ? 'Scheduling...' : 'Sending...')
                                        : sendStatus === 'sent' ? 'Sent ✓'
                                        : sendStatus === 'scheduled' ? 'Scheduled ✓'
                                        : scheduleMode === 'later' ? <><Clock className="w-3 h-3" /> Schedule</>
                                        : 'Confirm & Send'
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
