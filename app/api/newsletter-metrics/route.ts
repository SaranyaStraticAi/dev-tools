// app/api/newsletter-metrics/route.ts
//
// GET  ?broadcastId=xxx  → return accumulated metrics for a broadcast
// POST (no body check)   → Resend webhook receiver — accumulates events in memory
//
// ⚠️ In-memory store: resets on server restart / redeploy. Fine for dev testing.
//    For production, replace `metricStore` with DB writes (Prisma + Postgres).

import { NextRequest, NextResponse } from 'next/server';

// ── In-memory metrics store ──────────────────────────────────────────────────
export interface BroadcastMetrics {
    broadcastId: string;
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

// ── GET — return metrics for a broadcastId ───────────────────────────────────
export async function GET(req: NextRequest) {
    const broadcastId = req.nextUrl.searchParams.get('broadcastId');
    if (!broadcastId) {
        return NextResponse.json({ error: 'broadcastId query param required' }, { status: 400 });
    }

    // Also try to fetch live data from Resend API as supplement
    // (Resend doesn't expose aggregate stats via API yet, but we can at least
    //  return the in-memory accumulation from webhooks)
    const store   = getStore();
    const metrics = store.has(broadcastId)
        ? recalcRates(getOrInit(broadcastId))
        : { broadcastId, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0, openRate: 0, clickRate: 0, lastUpdated: new Date().toISOString() };

    return NextResponse.json({ metrics });
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

        const m = getOrInit(broadcastId);

        switch (type) {
            case 'email.delivered':   m.delivered++;    break;
            case 'email.opened':      m.opened++;       break;
            case 'email.clicked':     m.clicked++;      break;
            case 'email.bounced':     m.bounced++;      break;
            case 'email.complained':  m.complained++;   break;
            case 'email.unsubscribed':m.unsubscribed++; break;
            default:
                // ignore other event types (email.sent, etc.)
                break;
        }

        m.lastUpdated = new Date().toISOString();
        recalcRates(m);
        getStore().set(broadcastId, m);

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
