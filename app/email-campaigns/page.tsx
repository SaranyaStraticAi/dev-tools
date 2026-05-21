'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMsal } from "@azure/msal-react";
import { ArrowLeft, Mail, Calendar, Users, Trash2, Loader2, Eye, RefreshCw, BarChart2 } from 'lucide-react';
import type { BroadcastMetrics } from '@/app/api/newsletter-metrics/route';

interface EmailCampaign {
    id:            string;
    subject:       string;
    body:          string | null;
    type:          string;
    sent_at:       string;
    broadcast_ids: string[];
    segment_ids:   string[];
    delivered:     number;
    opened:        number;
    clicked:       number;
    bounced:       number;
    complained:    number;
    unsubscribed:  number;
}

interface Segment {
    id:   string;
    name: string;
}

export default function EmailCampaignsPage() {
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
    const isAllowed = userEmail === 'masood@aity.dev' || employeeAccount === 'ketki@vibetrader.com' || userEmail === 'ketki@vibetrader.com';

    // Page state
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
    const [selectedMetrics, setSelectedMetrics] = useState<BroadcastMetrics | null>(null);
    const [metricsLoading, setMetricsLoading] = useState(false);
    const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fetch campaigns
    const fetchCampaigns = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/email-campaigns');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to load campaigns');
            setCampaigns(data.campaigns ?? []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch segments to map names
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
            fetchCampaigns();
            fetchSegments();
        }
    }, [isAllowed, fetchCampaigns, fetchSegments]);

    // Fetch details/metrics for selected campaign
    const fetchCampaignMetrics = useCallback(async (campaignId: string) => {
        try {
            const res = await fetch(`/api/newsletter-metrics?campaignId=${campaignId}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.metrics) {
                setSelectedMetrics(data.metrics);
                // Also update the campaign in the local list
                setCampaigns(prev => prev.map(c => {
                    if (c.id === campaignId) {
                        return {
                            ...c,
                            delivered: data.metrics.delivered,
                            opened: data.metrics.opened,
                            clicked: data.metrics.clicked,
                            bounced: data.metrics.bounced,
                            complained: data.metrics.complained,
                            unsubscribed: data.metrics.unsubscribed,
                        };
                    }
                    return c;
                }));
            }
        } catch (e) {
            console.warn('[fetchCampaignMetrics] error', e);
        }
    }, []);

    // Handle selecting a campaign
    const handleSelectCampaign = (campaign: EmailCampaign) => {
        setSelectedCampaign(campaign);
        setSelectedMetrics(null);
        setMetricsLoading(true);

        // Fetch initial metrics
        fetchCampaignMetrics(campaign.id).finally(() => setMetricsLoading(false));

        // Setup polling every 15s
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        pollingInterval.current = setInterval(() => {
            fetchCampaignMetrics(campaign.id);
        }, 15000);
    };

    // Close details modal
    const handleCloseDetails = () => {
        setSelectedCampaign(null);
        setSelectedMetrics(null);
        if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
        }
    };

    // Clean up interval on unmount
    useEffect(() => {
        return () => {
            if (pollingInterval.current) clearInterval(pollingInterval.current);
        };
    }, []);

    // Handle delete campaign
    const handleDeleteCampaign = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this campaign record? (This will not delete the broadcast in Resend, just the local DB record)')) return;

        try {
            const res = await fetch(`/api/email-campaigns?id=${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to delete');
            setCampaigns(prev => prev.filter(c => c.id !== id));
            if (selectedCampaign?.id === id) {
                handleCloseDetails();
            }
        } catch (err: any) {
            alert(err.message);
        }
    };

    // Map segment IDs to Names
    const getSegmentNames = (segIds: string[]) => {
        if (!segIds || segIds.length === 0) return 'Default Audience';
        return segIds.map(id => {
            const match = segments.find(s => s.id === id);
            return match ? match.name : `Segment (${id.slice(0, 4)})`;
        }).join(', ');
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

                {/* ── Header ── */}
                <div className="flex items-center justify-between gap-4 flex-wrap border-b pb-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <a href="/newsletter-tester"
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                                <ArrowLeft className="w-3.5 h-3.5" /> Back to Tester
                            </a>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-transparent">
                            📧 Email Campaigns Manager
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Review past campaigns, track metrics in real time, and preview newsletter history
                        </p>
                    </div>
                    <button
                        onClick={fetchCampaigns}
                        className="px-3.5 py-2 text-xs font-bold rounded-xl border border-muted hover:bg-muted flex items-center gap-2 transition-all"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                </div>

                {/* ── Error banner ── */}
                {error && (
                    <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        ❌ {error}
                    </div>
                )}

                {/* ── Campaigns Layout ── */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-6 items-start">

                    {/* ── Left Side: List ── */}
                    <div className="flex flex-col gap-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 border rounded-2xl bg-card">
                                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                                <span className="text-sm text-muted-foreground">Loading campaigns from DB...</span>
                            </div>
                        ) : campaigns.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 border rounded-2xl bg-card">
                                <span className="text-4xl">📬</span>
                                <p className="text-sm font-semibold">No campaigns sent yet.</p>
                                <p className="text-xs text-muted-foreground">Send a newsletter in the tester to start tracking here.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {campaigns.map(camp => {
                                    const base = camp.delivered || 1;
                                    const openRate = ((camp.opened / base) * 100).toFixed(1);
                                    const clickRate = ((camp.clicked / base) * 100).toFixed(1);
                                    const isSelected = selectedCampaign?.id === camp.id;

                                    return (
                                        <div
                                            key={camp.id}
                                            onClick={() => handleSelectCampaign(camp)}
                                            className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-3 group bg-card ${
                                                isSelected 
                                                    ? 'border-purple-500 ring-1 ring-purple-500 bg-purple-500/5' 
                                                    : 'hover:border-purple-500/50 hover:bg-muted/20'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <span className="text-base font-bold truncate group-hover:text-purple-400 transition-colors">
                                                        {camp.subject}
                                                    </span>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            {new Date(camp.sent_at).toLocaleDateString(undefined, { 
                                                                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                                                            })}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Users className="w-3.5 h-3.5" />
                                                            {getSegmentNames(camp.segment_ids)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        camp.type === 'puzzle' 
                                                            ? 'bg-blue-500/15 text-blue-400' 
                                                            : 'bg-purple-500/15 text-purple-400'
                                                    }`}>
                                                        {camp.type}
                                                    </span>
                                                    <button
                                                        onClick={(e) => handleDeleteCampaign(camp.id, e)}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Delete campaign record"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quick metrics grid */}
                                            <div className="grid grid-cols-3 gap-2 border-t pt-3 mt-1">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Delivered</span>
                                                    <span className="text-sm font-extrabold">{camp.delivered}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Open Rate</span>
                                                    <span className="text-sm font-extrabold text-green-400">{openRate}%</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Click Rate</span>
                                                    <span className="text-sm font-extrabold text-purple-400">{clickRate}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Right Side: Details View ── */}
                    <div className="sticky top-6 flex flex-col gap-4">
                        {selectedCampaign ? (
                            <div className="border rounded-2xl bg-card p-6 flex flex-col gap-5 shadow-xl">
                                
                                {/* Detail Header */}
                                <div className="flex items-start justify-between border-b pb-4">
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <h3 className="font-extrabold text-base truncate">{selectedCampaign.subject}</h3>
                                        <p className="text-[10px] text-muted-foreground">
                                            Campaign ID: <span className="font-mono">{selectedCampaign.id}</span>
                                        </p>
                                    </div>
                                    <button 
                                        onClick={handleCloseDetails}
                                        className="text-xs text-muted-foreground hover:text-foreground border px-2.5 py-1 rounded-lg bg-background hover:bg-muted"
                                    >
                                        Close
                                    </button>
                                </div>

                                {/* Active Polling Banner */}
                                <div className="flex items-center justify-between text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 p-2.5 rounded-xl">
                                    <div className="flex items-center gap-1.5 font-semibold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"/>
                                        Auto-polling metrics in real time
                                    </div>
                                    <button
                                        onClick={() => fetchCampaignMetrics(selectedCampaign.id)}
                                        className="hover:underline flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-2.5 h-2.5" /> Poll Now
                                    </button>
                                </div>

                                {/* Detailed KPI Cards */}
                                {metricsLoading && !selectedMetrics ? (
                                    <div className="flex justify-center py-6">
                                        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <DetailMetricCard label="Delivered" value={selectedMetrics?.delivered ?? selectedCampaign.delivered} icon="📬" color="blue" />
                                        <DetailMetricCard label="Open Rate" value={`${selectedMetrics?.openRate ?? ((selectedCampaign.opened / (selectedCampaign.delivered || 1)) * 100).toFixed(1)}%`} icon="👁" color="green"
                                            sub={`${selectedMetrics?.opened ?? selectedCampaign.opened} unique opens`} />
                                        <DetailMetricCard label="Click Rate" value={`${selectedMetrics?.clickRate ?? ((selectedCampaign.clicked / (selectedCampaign.delivered || 1)) * 100).toFixed(1)}%`} icon="🖱️" color="purple"
                                            sub={`${selectedMetrics?.clicked ?? selectedCampaign.clicked} unique clicks`} />
                                        <DetailMetricCard label="Bounced" value={selectedMetrics?.bounced ?? selectedCampaign.bounced} icon="↩️" color="red" />
                                        <DetailMetricCard label="Unsubscribed" value={selectedMetrics?.unsubscribed ?? selectedCampaign.unsubscribed} icon="🚫" color="yellow" />
                                        <DetailMetricCard label="Complaints" value={selectedMetrics?.complained ?? selectedCampaign.complained} icon="⚠️" color="orange" />
                                    </div>
                                )}

                                {/* HTML Iframe Preview */}
                                <div className="flex flex-col gap-2 mt-2">
                                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                        <Eye className="w-3.5 h-3.5" /> Sent Email Body Preview
                                    </span>
                                    <div className="w-full h-80 rounded-xl border bg-white overflow-hidden shadow-inner">
                                        <iframe
                                            srcDoc={selectedCampaign.body ?? '<p className="text-muted-foreground p-4">No content available</p>'}
                                            className="w-full h-full border-0"
                                            title="Campaign email body preview"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground h-96">
                                <BarChart2 className="w-12 h-12 text-muted-foreground/30 animate-pulse" />
                                <h3 className="font-bold text-sm text-foreground">No Campaign Selected</h3>
                                <p className="text-xs max-w-[250px]">
                                    Click any campaign card on the left to inspect its live delivery metrics and HTML layout.
                                </p>
                            </div>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
}

// ── Metric card sub-component ─────────────────────────────────────────────────
function DetailMetricCard({
    label, value, icon, color, sub
}: {
    label: string;
    value: string | number;
    icon: string;
    color: 'blue' | 'green' | 'purple' | 'red' | 'yellow' | 'orange';
    sub?: string;
}) {
    const colorMap: Record<string, string> = {
        blue:   'bg-blue-500/10   border-blue-500/20   text-blue-400',
        green:  'bg-green-500/10  border-green-500/20  text-green-400',
        purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        red:    'bg-red-500/10    border-red-500/20    text-red-400',
        yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    };
    return (
        <div className={`flex flex-col gap-0.5 p-3 rounded-xl border ${colorMap[color]}`}>
            <div className="flex items-center gap-1.5">
                <span>{icon}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</span>
            </div>
            <span className="text-xl font-extrabold tabular-nums">{value}</span>
            {sub && <span className="text-[9px] opacity-60 leading-tight truncate">{sub}</span>}
        </div>
    );
}
