// app/api/newsletter-metrics/route.ts
//
// GET  ?broadcastId=xxx&campaignId=yyy  → return accumulated metrics for a campaign/broadcast
// POST (no body check)                   → Resend webhook receiver — accumulates events in DB and memory
//

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ── In-memory metrics store ──────────────────────────────────────────────────
export interface BroadcastMetrics {
    broadcastId: string;
    campaignId?: string;
    delivered:   number;
    opened:      number;       // unique opens
    clicked:     number;       // unique clicks
    bounced:     number;
    complained:  number;
    unsubscribed:number;
    openRate:    number;       // % — calculated on read
    clickRate:   number;       // % — calculated on read
    lastUpdated: string;
}

// We use a global var so it survives Next.js hot-reload between requests
// (Next.js module cache persists across requests in the same process)
declare global {
    // eslint-disable-next-line no-var
    var _resendMetricStore: Map<string, BroadcastMetrics> | undefined;
}

function getStore(): Map<string, BroadcastMetrics> {
    if (!global._resendMetricStore) {
        global._resendMetricStore = new Map();
    }
    return global._resendMetricStore;
}

function getOrInit(broadcastId: string): BroadcastMetrics {
    const store = getStore();
    if (!store.has(broadcastId)) {
        store.set(broadcastId, {
            broadcastId,
            delivered:    0,
            opened:       0,
            clicked:      0,
            bounced:      0,
            complained:   0,
            unsubscribed: 0,
            openRate:     0,
            clickRate:    0,
            lastUpdated:  new Date().toISOString(),
        });
    }
    return store.get(broadcastId)!;
}

function recalcRates(m: BroadcastMetrics): BroadcastMetrics {
    const base = m.delivered || 1; // avoid div-by-zero
    m.openRate  = parseFloat(((m.opened  / base) * 100).toFixed(1));
    m.clickRate = parseFloat(((m.clicked / base) * 100).toFixed(1));
    return m;
}

// ── GET — return metrics for a campaignId or broadcastId ──────────────────────
export async function GET(req: NextRequest) {
    const broadcastId = req.nextUrl.searchParams.get('broadcastId');
    const campaignId = req.nextUrl.searchParams.get('campaignId');

    if (!broadcastId && !campaignId) {
        return NextResponse.json({ error: 'broadcastId or campaignId query param required' }, { status: 400 });
    }

    try {
        // 1. Try to fetch from database campaign
        let campaign = null;
        if (campaignId) {
            campaign = await prisma.email_campaigns.findUnique({
                where: { id: campaignId }
            });
        } else if (broadcastId) {
            campaign = await prisma.email_campaigns.findFirst({
                where: {
                    broadcast_ids: {
                        has: broadcastId
                    }
                }
            });
        }

        if (campaign) {
            const base = campaign.delivered || 1;
            const openRate = parseFloat(((campaign.opened / base) * 100).toFixed(1));
            const clickRate = parseFloat(((campaign.clicked / base) * 100).toFixed(1));
            return NextResponse.json({
                metrics: {
                    broadcastId: campaign.broadcast_ids[0] || broadcastId || '',
                    campaignId: campaign.id,
                    delivered: campaign.delivered,
                    opened: campaign.opened,
                    clicked: campaign.clicked,
                    bounced: campaign.bounced,
                    complained: campaign.complained,
                    unsubscribed: campaign.unsubscribed,
                    openRate,
                    clickRate,
                    lastUpdated: campaign.sent_at.toISOString(),
                }
            });
        }
    } catch (dbErr) {
        console.error('[newsletter-metrics] GET database error:', dbErr);
    }

    // 2. Fallback to in-memory store
    if (broadcastId) {
        const store   = getStore();
        const metrics = store.has(broadcastId)
            ? recalcRates(getOrInit(broadcastId))
            : { broadcastId, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0, openRate: 0, clickRate: 0, lastUpdated: new Date().toISOString() };

        return NextResponse.json({ metrics });
    }

    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
}

// ── POST — Resend webhook receiver ───────────────────────────────────────────
// Resend sends a POST to this URL for every tracked event.
// Configure this endpoint in Resend dashboard → Webhooks → add URL:
//   https://your-domain.com/api/newsletter-metrics
// Events to subscribe: email.delivered, email.opened, email.clicked,
//                      email.bounced, email.complained, email.unsubscribed
export async function POST(req: NextRequest) {
    try {
        const payload = await req.json() as {
            type: string;
            data: {
                broadcast_id?: string;
                email_id?: string;
                created_at?: string;
            };
        };

        const { type, data } = payload;
        const broadcastId = data?.broadcast_id;

        // Only handle events that belong to a broadcast
        if (!broadcastId) {
            return NextResponse.json({ ok: true, note: 'no broadcast_id, skipped' });
        }

        // Update in-memory fallback
        const m = getOrInit(broadcastId);
        switch (type) {
            case 'email.delivered':   m.delivered++;    break;
            case 'email.opened':      m.opened++;       break;
            case 'email.clicked':     m.clicked++;      break;
            case 'email.bounced':     m.bounced++;      break;
            case 'email.complained':  m.complained++;   break;
            case 'email.unsubscribed':m.unsubscribed++; break;
            default:
                break;
        }
        m.lastUpdated = new Date().toISOString();
        recalcRates(m);
        getStore().set(broadcastId, m);

        // Update database campaign if matching record exists
        try {
            const campaign = await prisma.email_campaigns.findFirst({
                where: {
                    broadcast_ids: {
                        has: broadcastId
                    }
                }
            });

            if (campaign) {
                const updateData: any = {};
                switch (type) {
                    case 'email.delivered':   updateData.delivered = { increment: 1 }; break;
                    case 'email.opened':      updateData.opened = { increment: 1 }; break;
                    case 'email.clicked':     updateData.clicked = { increment: 1 }; break;
                    case 'email.bounced':     updateData.bounced = { increment: 1 }; break;
                    case 'email.complained':  updateData.complained = { increment: 1 }; break;
                    case 'email.unsubscribed':updateData.unsubscribed = { increment: 1 }; break;
                }

                if (Object.keys(updateData).length > 0) {
                    await prisma.email_campaigns.update({
                        where: { id: campaign.id },
                        data: updateData
                    });
                    console.log(`[newsletter-metrics] DB campaign ${campaign.id} updated for event ${type}`);
                }
            }
        } catch (dbErr) {
            console.error('[newsletter-metrics] DB webhook update error:', dbErr);
        }

        console.log(`[newsletter-metrics] event=${type} broadcastId=${broadcastId}`, {
            delivered: m.delivered, opened: m.opened, clicked: m.clicked,
        });

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[newsletter-metrics] webhook error:', err);
        // Always return 200 to Resend to avoid retries on parse errors
        return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
    }
}
