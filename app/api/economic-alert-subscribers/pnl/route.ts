/**
 * Economic-alert auto-trade P&L / equity-growth report — computed in dev-tools.
 *
 * Unlike the sibling subscribers route (a thin proxy to vibetrader-web), this reads
 * the shared Azure tables + MetaAPI master token + Clerk directly (same access the
 * metaapi-lookup/connections tools use), so no vibetrader-web endpoint is needed.
 * Read-only — never places/modifies/closes anything.
 *
 *   GET ?sinceHours=168 | ?event=<eventKey> [&names=false]
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildPnlReport } from '@/lib/econ-alert-pnl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Broker round-trips per user can be slow; give it room.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const event = sp.get('event');
  const sinceHoursRaw = sp.get('sinceHours');
  const sinceHours = sinceHoursRaw != null ? Number(sinceHoursRaw) : undefined;
  if (sinceHours != null && (!Number.isFinite(sinceHours) || sinceHours <= 0)) {
    return NextResponse.json({ error: 'sinceHours must be a positive number' }, { status: 400 });
  }

  try {
    const report = await buildPnlReport({
      sinceHours,
      event: event ?? null,
      resolveNames: sp.get('names') !== 'false',
    });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
