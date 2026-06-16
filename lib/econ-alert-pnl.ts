/**
 * Economic-alert auto-trade P&L + equity-growth report — built entirely in dev-tools.
 *
 * Replicates (read-only) what the vibetrader-web `scripts/econ-alert-pnl-report.ts`
 * does, but using dev-tools' own access to the shared Azure tables + MetaAPI master
 * token + Clerk, so the admin page can show it without a vibetrader-web endpoint.
 *
 * Per user it answers:
 *   1. What the `economic-alert` harness auto-traded and the net P&L of those trades
 *      (realized + unrealized), matched trade-by-trade to live broker state.
 *   2. How their account equity grew over the period — a balance curve reconstructed
 *      from broker deal history ending at current equity, net deposits excluded.
 *
 * Data sources (read-only — never places/modifies/closes anything):
 *   - Azure `EconomicAlertTrades`   → execution records (positionId, sizing, status).
 *   - Azure `UserBrokerConnections` → userId → MetaAPI accountId (+ region in metadata).
 *   - MetaAPI provisioning + regional client API (METAAPI_MASTER_TOKEN).
 *   - Clerk (dev + live instances)  → userId → name/email.
 */
import { TableClient } from '@azure/data-tables';
import { createClerkClient } from '@clerk/backend';

const PROVISIONING_BASE = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
const CLIENT_BASE = (region: string) => `https://mt-client-api-v1.${region}.agiliumtrade.ai`;

/** Deal types that move the cash balance but are NOT trading P&L (deposits, credits, etc.). */
const NON_TRADING_DEAL_TYPES = new Set([
  'DEAL_TYPE_BALANCE',
  'DEAL_TYPE_CREDIT',
  'DEAL_TYPE_CORRECTION',
  'DEAL_TYPE_BONUS',
]);

// ---- types ---------------------------------------------------------------
type EconAlertTradeRow = {
  partitionKey: string; // eventKey
  rowKey: string; // userId
  status: string;
  positionId?: string;
  symbol?: string;
  side?: string;
  lots?: number;
  accountCurrency?: string;
  reservedAt?: string;
  placedAt?: string;
  error?: string;
};

interface BrokerConnectionEntity {
  partitionKey: string; // userId
  rowKey: string; // brokerType
  accountId?: string;
  metadata?: string;
}

interface MetaPosition {
  id?: string | number;
  profit?: number;
  swap?: number;
  commission?: number;
}
interface MetaDeal {
  positionId?: string | number;
  profit?: number;
  swap?: number;
  commission?: number;
  time?: string;
  type?: string;
}
interface MetaAccountInfo {
  balance?: number;
  equity?: number;
  currency?: string;
}

export type TradeState = 'OPEN' | 'CLOSED' | 'NOT_PLACED';
export interface PnlTradeLine {
  status: string;
  state: TradeState;
  side?: string;
  symbol?: string;
  lots?: number;
  event: string;
  pl?: number;
  positionId?: string;
  exitAt?: string;
  error?: string;
}
export interface PnlEquityPoint {
  time: string;
  balance: number;
}
export interface PnlUser {
  userId: string;
  name?: string;
  email?: string;
  currency: string;
  autoTradeNet: number;
  startBalance: number;
  currentBalance: number;
  currentEquity: number;
  netDeposits: number;
  growthAbs: number;
  growthPct: number | null;
  equityCurve: PnlEquityPoint[];
  brokerOk: boolean;
  trades: PnlTradeLine[];
}
export interface PnlReport {
  generatedAt: string;
  sinceHours: number | null;
  sinceIso: string | null;
  event: string | null;
  rowCount: number;
  statusCounts: Record<string, number>;
  byEvent: Array<{ event: string; symbol: string; side: string; placed: number; total: number }>;
  users: PnlUser[];
  grandNet: number;
}
export interface BuildPnlOptions {
  sinceHours?: number;
  event?: string | null;
  resolveNames?: boolean;
  now?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---- MetaAPI REST helpers ------------------------------------------------
async function metaGet<T>(url: string, token: string, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'auth-token': token, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve a user's MetaAPI accountId (+ region if stored) from UserBrokerConnections. */
async function resolveAccount(
  conn: string,
  userId: string
): Promise<{ accountId: string; region: string | null } | null> {
  const table = TableClient.fromConnectionString(conn, 'UserBrokerConnections');
  try {
    const e = await table.getEntity<BrokerConnectionEntity>(userId, 'metaapi');
    let region: string | null = null;
    if (e.metadata) {
      try {
        const md = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
        region = (md?.region as string) || null;
      } catch {
        /* malformed metadata */
      }
    }
    return e.accountId ? { accountId: e.accountId, region } : null;
  } catch {
    return null; // no metaapi connection for this user
  }
}

/** Fetch live broker state for one account: account info, open positions, deals in window. */
async function fetchBrokerState(
  accountId: string,
  region: string | null,
  token: string,
  startIso: string,
  endIso: string
): Promise<{ account: MetaAccountInfo; positions: MetaPosition[]; deals: MetaDeal[] } | null> {
  // Region is needed for the regional client API; resolve via provisioning if absent.
  let reg = region;
  if (!reg) {
    const prov = await metaGet<{ region?: string }>(
      `${PROVISIONING_BASE}/users/current/accounts/${accountId}`,
      token,
      15000
    );
    reg = prov?.region ?? null;
  }
  if (!reg) return null;

  const base = CLIENT_BASE(reg);
  const [account, positions, deals] = await Promise.all([
    metaGet<MetaAccountInfo>(`${base}/users/current/accounts/${accountId}/account-information`, token, 12000),
    metaGet<MetaPosition[]>(`${base}/users/current/accounts/${accountId}/positions`, token, 12000),
    metaGet<MetaDeal[]>(
      `${base}/users/current/accounts/${accountId}/history-deals/time/${encodeURIComponent(
        startIso
      )}/${encodeURIComponent(endIso)}?limit=1000&offset=0`,
      token,
      20000
    ),
  ]);
  if (!account) return null;
  return { account, positions: positions ?? [], deals: deals ?? [] };
}

/** Reconstruct a balance curve + growth from broker deals over [startIso, endIso]. */
function buildEquity(deals: MetaDeal[], account: MetaAccountInfo, startIso: string, endIso: string) {
  const currentBalance = account.balance ?? 0;
  const currentEquity = account.equity ?? currentBalance;

  const inWindow = deals
    .filter((d) => d.time && d.time >= startIso && d.time <= endIso)
    .sort((a, b) => (a.time! < b.time! ? -1 : a.time! > b.time! ? 1 : 0));

  const delta = (d: MetaDeal) => (d.profit ?? 0) + (d.swap ?? 0) + (d.commission ?? 0);
  const totalDelta = inWindow.reduce((s, d) => s + delta(d), 0);
  const netDeposits = inWindow
    .filter((d) => d.type && NON_TRADING_DEAL_TYPES.has(d.type))
    .reduce((s, d) => s + delta(d), 0);

  const startBalance = currentBalance - totalDelta;
  const equityCurve: PnlEquityPoint[] = [{ time: startIso, balance: round2(startBalance) }];
  let running = startBalance;
  for (const d of inWindow) {
    running += delta(d);
    equityCurve.push({ time: d.time as string, balance: round2(running) });
  }
  equityCurve.push({ time: endIso, balance: round2(currentEquity) });

  const growthAbs = currentEquity - startBalance - netDeposits;
  const growthPct = startBalance > 0 ? (growthAbs / startBalance) * 100 : null;

  return {
    startBalance: round2(startBalance),
    currentBalance: round2(currentBalance),
    currentEquity: round2(currentEquity),
    netDeposits: round2(netDeposits),
    growthAbs: round2(growthAbs),
    growthPct: growthPct === null ? null : round2(growthPct),
    equityCurve,
  };
}

/** Run async tasks with a small concurrency cap (broker round-trips are slow). */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---- Clerk name resolution (dev + live instances) ------------------------
async function resolveNames(userIds: string[]): Promise<Map<string, { name: string; email: string }>> {
  const names = new Map<string, { name: string; email: string }>();
  const instances = [process.env.CLERK_SECRET_KEY, process.env.CLERK_LIVE_SECRET_KEY].filter(
    Boolean
  ) as string[];
  if (instances.length === 0) return names;
  const clients = instances.map((secretKey) => createClerkClient({ secretKey }));
  await pool(userIds, 5, async (uid) => {
    for (const clerk of clients) {
      try {
        const u = await clerk.users.getUser(uid);
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '';
        const email =
          u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? '';
        names.set(uid, { name, email });
        return;
      } catch {
        /* try next instance */
      }
    }
  });
  return names;
}

// ---- main ----------------------------------------------------------------
export async function buildPnlReport(opts: BuildPnlOptions = {}): Promise<PnlReport> {
  const sinceHours = opts.event ? null : opts.sinceHours ?? 168;
  const event = opts.event ?? null;
  const doNames = opts.resolveNames !== false;
  const now = opts.now ?? Date.now();
  const nowIso = new Date(now).toISOString();

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
  const token = process.env.METAAPI_MASTER_TOKEN;

  const sinceIso = sinceHours ? new Date(now - sinceHours * 3600 * 1000).toISOString() : null;
  // History/curve window: the period for since-hours mode, or 14d for a single event.
  const historyStartIso = sinceIso ?? new Date(now - 14 * 24 * 3600 * 1000).toISOString();

  // ---- pull trade rows ----------------------------------------------------
  const tradesTable = TableClient.fromConnectionString(conn, 'EconomicAlertTrades');
  const rows: EconAlertTradeRow[] = [];
  const iter = event
    ? tradesTable.listEntities<EconAlertTradeRow>({
        queryOptions: { filter: `PartitionKey eq '${event.replace(/'/g, "''")}'` },
      })
    : tradesTable.listEntities<EconAlertTradeRow>();
  for await (const e of iter) {
    const at = String(e.placedAt ?? e.reservedAt ?? '');
    if (event || (sinceIso && at >= sinceIso)) rows.push(e);
  }

  // ---- overview -----------------------------------------------------------
  const statusCounts: Record<string, number> = {};
  const byEventMap: Record<string, { placed: number; total: number; symbol: string; side: string }> = {};
  for (const r of rows) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    const ev = (byEventMap[r.partitionKey] ??= {
      placed: 0,
      total: 0,
      symbol: r.symbol ?? '?',
      side: r.side ?? '?',
    });
    ev.total++;
    if (r.status === 'placed') ev.placed++;
  }
  const byEvent = Object.entries(byEventMap).map(([ev, v]) => ({ event: ev, ...v }));

  const userIds = [...new Set(rows.map((r) => r.rowKey))];
  const names = doNames ? await resolveNames(userIds) : new Map();

  // ---- per-user P&L + equity (concurrency-capped) -------------------------
  const users = await pool(userIds, 5, async (uid): Promise<PnlUser> => {
    const mine = rows.filter((r) => r.rowKey === uid);
    const placedRows = mine.filter((r) => r.status === 'placed' && r.positionId);

    let positions: MetaPosition[] = [];
    let deals: MetaDeal[] = [];
    let account: MetaAccountInfo | null = null;
    let brokerOk = false;
    if (placedRows.length > 0 && token) {
      const acc = await resolveAccount(conn, uid);
      if (acc) {
        const state = await fetchBrokerState(acc.accountId, acc.region, token, historyStartIso, nowIso);
        if (state) {
          ({ account, positions, deals } = state);
          brokerOk = true;
        }
      }
    }

    let autoTradeNet = 0;
    const trades: PnlTradeLine[] = [];
    for (const r of mine) {
      const base = {
        status: r.status,
        side: r.side,
        symbol: r.symbol,
        lots: r.lots,
        event: r.partitionKey,
        error: r.error,
      };
      if (r.status !== 'placed' || !r.positionId) {
        trades.push({ ...base, state: 'NOT_PLACED' });
        continue;
      }
      const pid = String(r.positionId);
      const op = positions.find((o) => String(o.id) === pid);
      if (op) {
        const pl = (op.profit ?? 0) + (op.swap ?? 0) + (op.commission ?? 0);
        autoTradeNet += pl;
        trades.push({ ...base, state: 'OPEN', pl: round2(pl), positionId: pid });
      } else {
        const dls = deals.filter((d) => String(d.positionId) === pid);
        const realized = dls.reduce(
          (s, d) => s + (d.profit ?? 0) + (d.swap ?? 0) + (d.commission ?? 0),
          0
        );
        autoTradeNet += realized;
        trades.push({
          ...base,
          state: 'CLOSED',
          pl: round2(realized),
          positionId: pid,
          exitAt: dls.length ? dls[dls.length - 1].time : undefined,
        });
      }
    }

    const currency = account?.currency || mine[0].accountCurrency || 'USD';
    const equity =
      account && brokerOk
        ? buildEquity(deals, account, historyStartIso, nowIso)
        : {
            startBalance: 0,
            currentBalance: 0,
            currentEquity: 0,
            netDeposits: 0,
            growthAbs: 0,
            growthPct: null,
            equityCurve: [] as PnlEquityPoint[],
          };

    return {
      userId: uid,
      name: names.get(uid)?.name || undefined,
      email: names.get(uid)?.email || undefined,
      currency,
      autoTradeNet: round2(autoTradeNet),
      brokerOk,
      ...equity,
      trades,
    };
  });

  // worst auto-trade P&L first (matches the script's ordering)
  users.sort((a, b) => a.autoTradeNet - b.autoTradeNet);
  const grandNet = round2(users.reduce((s, u) => s + u.autoTradeNet, 0));

  return {
    generatedAt: nowIso,
    sinceHours,
    sinceIso,
    event,
    rowCount: rows.length,
    statusCounts,
    byEvent,
    users,
    grandNet,
  };
}
