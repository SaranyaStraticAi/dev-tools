import { NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { TableClient } from '@azure/data-tables';
import { Pool } from 'pg';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DirectoryUser {
  // Identity
  clerkId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  clerkInstance: 'Live' | 'Dev' | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  lastActiveAt: string | null;

  // Billing (Postgres users table)
  hasDbRow: boolean;
  planName: string | null;
  subscriptionStatus: string | null;
  hasPaidForBroker: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;

  // Broker (Azure Table Storage)
  brokerConnected: boolean;
  metaApiAccountId: string | null;
  brokerLastUpdated: string | null;

  // Chat (Azure Table Storage)
  chatThreadCount: number;
  chatLastDate: string | null;

  // Strategy + Journal (Postgres strategy_deployments)
  strategyTotal: number;
  strategyActive: number;
  strategyTrades: number;
  strategyWins: number;
  strategyLosses: number;
  strategyPnl: number;

  // Flags
  flags: string[];
}

export interface DirectorySummary {
  total: number;
  live: number;
  dev: number;
  withPlan: number;
  brokerConnected: number;
  withStrategies: number;
  withChats: number;
  missingDbRow: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(ts: number | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts).toISOString();
}

async function getClerkUsers(secretKey: string) {
  const clerk = createClerkClient({ secretKey });
  const allUsers: any[] = [];
  let offset = 0;
  const limit = 500;
  const first = await clerk.users.getUserList({ limit, offset });
  allUsers.push(...first.data);
  offset += limit;
  while (allUsers.length < first.totalCount) {
    const page = await clerk.users.getUserList({ limit, offset });
    allUsers.push(...page.data);
    offset += limit;
  }
  return allUsers;
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const liveKey = process.env.CLERK_LIVE_SECRET_KEY;
  const devKey = process.env.CLERK_SECRET_KEY;

  if (!connectionString) return NextResponse.json({ error: 'AZURE_STORAGE_CONNECTION_STRING missing' }, { status: 500 });
  if (!liveKey) return NextResponse.json({ error: 'CLERK_LIVE_SECRET_KEY missing' }, { status: 500 });

  try {
    // ── 1. Fetch all Clerk users (Live + Dev) ──────────────────────────────────
    const [liveUsers, devUsers] = await Promise.all([
      getClerkUsers(liveKey),
      devKey ? getClerkUsers(devKey) : Promise.resolve([]),
    ]);

    // Merge, Live takes priority for duplicate clerkIds
    const allClerkUsers = new Map<string, { user: any; instance: 'Live' | 'Dev' }>();
    for (const u of devUsers) allClerkUsers.set(u.id, { user: u, instance: 'Dev' });
    for (const u of liveUsers) allClerkUsers.set(u.id, { user: u, instance: 'Live' }); // Live overwrites

    // Detect duplicate emails across instances
    const emailToIds = new Map<string, string[]>();
    for (const [id, { user }] of allClerkUsers) {
      const email = user.emailAddresses?.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress
        ?? user.emailAddresses?.[0]?.emailAddress ?? null;
      if (email) {
        const existing = emailToIds.get(email) ?? [];
        emailToIds.set(email, [...existing, id]);
      }
    }
    const duplicateEmails = new Set<string>();
    for (const [email, ids] of emailToIds) {
      if (ids.length > 1) duplicateEmails.add(email);
    }

    // ── 2. Postgres: users table + strategy_deployments ───────────────────────
    const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

    const [usersResult, deploymentsResult] = await Promise.all([
      pool.query<{
        clerk_user_id: string;
        email: string;
        plan_name: string | null;
        subscription_status: string | null;
        has_paid_for_broker: boolean;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
      }>(`SELECT clerk_user_id, email, plan_name, subscription_status,
              has_paid_for_broker, stripe_customer_id, stripe_subscription_id
         FROM users`),
      pool.query<{
        user_id: string;
        status: string;
        trades: number | null;
        wins: number | null;
        losses: number | null;
        pnl: number | null;
      }>(`SELECT user_id, status, trades, wins, losses, pnl FROM strategy_deployments`),
    ]);

    await pool.end();

    const dbUsers = usersResult.rows;
    const deployments = deploymentsResult.rows;

    const dbMap = new Map(dbUsers.map(u => [u.clerk_user_id, u]));

    // Aggregate strategy_deployments per user
    const stratMap = new Map<string, {
      total: number; active: number;
      trades: number; wins: number; losses: number; pnl: number;
    }>();
    for (const d of deployments) {
      const uid = d.user_id;
      const existing = stratMap.get(uid) ?? { total: 0, active: 0, trades: 0, wins: 0, losses: 0, pnl: 0 };
      stratMap.set(uid, {
        total: existing.total + 1,
        active: existing.active + (d.status === 'active' ? 1 : 0),
        trades: existing.trades + (d.trades ?? 0),
        wins: existing.wins + (d.wins ?? 0),
        losses: existing.losses + (d.losses ?? 0),
        pnl: existing.pnl + (d.pnl ?? 0),
      });
    }

    // ── 3. Azure Table Storage: broker + threads ───────────────────────────────
    const brokerTable = TableClient.fromConnectionString(connectionString, 'UserBrokerConnections');
    const threadsTable = TableClient.fromConnectionString(connectionString, 'UserThreads');

    // Scan all broker rows (metaapi only)
    const brokerMap = new Map<string, { connected: boolean; accountId: string | null; lastUpdated: string | null }>();
    for await (const entity of brokerTable.listEntities<any>({ queryOptions: { filter: `RowKey eq 'metaapi'` } })) {
      brokerMap.set(entity.partitionKey, {
        connected: entity.connected ?? false,
        accountId: entity.accountId ?? null,
        lastUpdated: entity.lastUpdated ?? null,
      });
    }

    // Scan all thread rows — count per user
    const threadMap = new Map<string, { count: number; lastDate: string | null }>();
    for await (const entity of threadsTable.listEntities<any>()) {
      const uid = entity.partitionKey;
      const existing = threadMap.get(uid) ?? { count: 0, lastDate: null };
      const created = (entity as any).createdAt ?? null;
      const newLast = created && (!existing.lastDate || created > existing.lastDate) ? created : existing.lastDate;
      threadMap.set(uid, { count: existing.count + 1, lastDate: newLast });
    }

    // ── 4. Assemble rows ───────────────────────────────────────────────────────
    const rows: DirectoryUser[] = [];

    for (const [clerkId, { user, instance }] of allClerkUsers) {
      const email = user.emailAddresses?.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress
        ?? user.emailAddresses?.[0]?.emailAddress ?? null;

      const db = dbMap.get(clerkId) ?? null;
      const broker = brokerMap.get(clerkId) ?? null;
      const threads = threadMap.get(clerkId) ?? null;
      const strat = stratMap.get(clerkId) ?? null;

      const flags: string[] = [];
      if (!db) flags.push('no_db_row');
      if (!email) flags.push('no_email');
      if (email && duplicateEmails.has(email)) flags.push('duplicate_email');
      if (db && !db.email) flags.push('missing_db_email');

      rows.push({
        clerkId,
        email,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        clerkInstance: instance,
        createdAt: fmtDate(user.createdAt),
        lastSignInAt: fmtDate(user.lastSignInAt),
        lastActiveAt: fmtDate(user.lastActiveAt),

        hasDbRow: !!db,
        planName: db?.plan_name ?? null,
        subscriptionStatus: db?.subscription_status ?? null,
        hasPaidForBroker: db?.has_paid_for_broker ?? false,
        stripeCustomerId: db?.stripe_customer_id ?? null,
        stripeSubscriptionId: db?.stripe_subscription_id ?? null,

        brokerConnected: broker?.connected ?? false,
        metaApiAccountId: broker?.accountId ?? null,
        brokerLastUpdated: broker?.lastUpdated ?? null,

        chatThreadCount: threads?.count ?? 0,
        chatLastDate: threads?.lastDate ?? null,

        strategyTotal: strat?.total ?? 0,
        strategyActive: strat?.active ?? 0,
        strategyTrades: strat?.trades ?? 0,
        strategyWins: strat?.wins ?? 0,
        strategyLosses: strat?.losses ?? 0,
        strategyPnl: strat?.pnl ?? 0,

        flags,
      });
    }

    // Sort: Live first, then by lastActiveAt desc
    rows.sort((a, b) => {
      if (a.clerkInstance !== b.clerkInstance) return a.clerkInstance === 'Live' ? -1 : 1;
      if (a.lastActiveAt && b.lastActiveAt) return b.lastActiveAt.localeCompare(a.lastActiveAt);
      if (a.lastActiveAt) return -1;
      if (b.lastActiveAt) return 1;
      return 0;
    });

    const summary: DirectorySummary = {
      total: rows.length,
      live: rows.filter(r => r.clerkInstance === 'Live').length,
      dev: rows.filter(r => r.clerkInstance === 'Dev').length,
      withPlan: rows.filter(r => r.planName).length,
      brokerConnected: rows.filter(r => r.brokerConnected).length,
      withStrategies: rows.filter(r => r.strategyTotal > 0).length,
      withChats: rows.filter(r => r.chatThreadCount > 0).length,
      missingDbRow: rows.filter(r => !r.hasDbRow).length,
    };

    return NextResponse.json({ users: rows, summary });
  } catch (error: any) {
    console.error('user-directory error:', error);
    return NextResponse.json({ error: error.message ?? 'Failed' }, { status: 500 });
  }
}
