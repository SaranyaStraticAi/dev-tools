/**
 * Proxy to vibetrader-web's economic-alert beta-subscriber API.
 *
 * The resolution (email -> Clerk userId -> linked Telegram chatId) lives in
 * vibetrader-web; this route just forwards with the shared x-api-key. The target
 * is IMPLICIT from this app's own environment: dev-tools in dev → dev vibetrader
 * (dev data), in prod → prod vibetrader (prod data). No manual toggle.
 *
 *   GET    ?strategyId=
 *   POST   { email, strategyId?, active?, addedBy?, note? }
 *   DELETE { email? | userId?, strategyId? }
 */
import { NextRequest, NextResponse } from 'next/server';

const SECRET = process.env.VIBE_TRADER_API_SECRET || '';
const BASE =
  process.env.NODE_ENV === 'production'
    ? process.env.VIBE_TRADER_API_URL_PROD || 'https://app.vibetrader.com'
    : process.env.VIBE_TRADER_API_URL_DEV || 'http://localhost:3000';

const PATH = '/api/economic-alert/subscribers';

async function forward(method: 'GET' | 'POST' | 'DELETE', opts: { query?: string; body?: unknown }) {
  if (!SECRET) {
    return NextResponse.json({ error: 'VIBE_TRADER_API_SECRET not configured' }, { status: 500 });
  }
  const url = `${BASE}${PATH}${opts.query ?? ''}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { 'x-api-key': SECRET, 'content-type': 'application/json' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: `Failed to reach ${BASE}`, detail: String(e) }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const strategyId = request.nextUrl.searchParams.get('strategyId');
  const query = strategyId ? `?strategyId=${encodeURIComponent(strategyId)}` : '';
  return forward('GET', { query });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return forward('POST', { body });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return forward('DELETE', { body });
}
