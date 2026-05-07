import { NextResponse } from 'next/server';
import { TableClient } from '@azure/data-tables';
import { createClerkClient } from '@clerk/backend';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BrokerConnectionEntity {
    partitionKey: string;
    rowKey: string;
    connected?: boolean;
    lastUpdated?: string;
    accountId?: string;
    metadata?: string;
}

interface AccountCacheEntity {
    partitionKey: string;
    rowKey: string;
    lifecycleState?: string;
    policy?: string;
    cachedBalance?: number;
    cachedEquity?: number;
    cachedAt?: string;
    lastDeployedAt?: string;
    lastUndeployedAt?: string;
    lastUndeployReason?: string;
    alwaysOnFlag?: boolean;
}

interface FreeTierUsageEntity {
    partitionKey: string;
    rowKey: string;
    lifetimeTrades?: number;
    deployedHoursAccrued?: number;
    lifetimeDeployments?: number;
    lastTradeAt?: string;
    lastDeployAt?: string;
    convertedAt?: string;
    convertedReason?: string;
}

export interface ConnectionRow {
    userId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    clerkInstance: string | null;

    // Broker connection
    connected: boolean;
    accountId: string | null;
    brokerName: string | null;
    server: string | null;
    platform: string | null;
    region: string | null;
    brokerLastUpdated: string | null;

    // Lifecycle (MetaApiAccountCache)
    lifecycleState: string | null;
    policy: string | null;
    cachedBalance: number | null;
    cachedEquity: number | null;
    cachedAt: string | null;
    lastDeployedAt: string | null;
    lastUndeployedAt: string | null;
    lastUndeployReason: string | null;
    alwaysOnFlag: boolean;

    // Usage (FreeTierUsage)
    lifetimeTrades: number;
    deployedHoursAccrued: number;
    lifetimeDeployments: number;
    deployedHoursRemaining: number; // 60 - accrued (free tier limit)
    lastTradeAt: string | null;
    lastDeployAt: string | null;
    convertedAt: string | null;
    convertedReason: string | null;

    // Cost (computed from usage + MetaAPI rate)
    lifetimeCostUsd: number;       // deployedHoursAccrued × $0.013
    minBilledCostUsd: number;      // lifetimeDeployments × $0.078 (6h min per deploy)
    actualCostUsd: number;         // max(lifetimeCostUsd, minBilledCostUsd) — what MetaAPI actually charges
    currentSessionCostUsd: number; // cost of current deployed session if deployed now
}

export interface ConnectionsSummary {
    total: number;
    connected: number;
    disconnected: number;
    deployed: number;
    undeployed: number;
    alwaysOn: number;
    weekendOnly: number;
    overnightAndWeekend: number;
    metaApiLiveData: boolean;
    totalDeployedHours: number;
    avgDeployedHours: number;
    totalActualCostUsd: number;        // sum of actualCostUsd across all accounts
    totalCurrentSessionCostUsd: number; // cost of all currently-deployed accounts
    projectedMonthlyCostUsd: number;   // based on currently-deployed × 720h/month
}

const CLERK_INSTANCES = [
    { name: 'Dev', secretKey: process.env.CLERK_SECRET_KEY || '' },
    { name: 'Live', secretKey: process.env.CLERK_LIVE_SECRET_KEY || '' },
];

const FREE_TIER_HOURS_LIMIT = 60;

// MetaAPI billing rate — configurable via METAAPI_RATE_PER_HOUR env var
// Default $0.0152/h ≈ $11/month per always-on account (720h × $0.0152)
// Set METAAPI_RATE_PER_HOUR in .env.local to match your actual MetaAPI invoice
const METAAPI_RATE_PER_HOUR = parseFloat(process.env.METAAPI_RATE_PER_HOUR || '0.0152');
const METAAPI_MIN_HOURS_PER_DEPLOY = 6;
const METAAPI_MIN_COST_PER_DEPLOY = METAAPI_RATE_PER_HOUR * METAAPI_MIN_HOURS_PER_DEPLOY;

// ── GET handler ────────────────────────────────────────────────────────────────

export async function GET() {
    try {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            return NextResponse.json({ error: 'AZURE_STORAGE_CONNECTION_STRING not configured' }, { status: 500 });
        }

        // ── 1. Scan UserBrokerConnections (metaapi rows) ───────────────────────
        const brokerTable = TableClient.fromConnectionString(connectionString, 'UserBrokerConnections');
        const brokerRows: BrokerConnectionEntity[] = [];
        for await (const entity of brokerTable.listEntities<BrokerConnectionEntity>({
            queryOptions: { filter: `RowKey eq 'metaapi'` },
        })) {
            brokerRows.push(entity);
        }

        // ── 2. Scan MetaApiAccountCache ────────────────────────────────────────
        const cacheTable = TableClient.fromConnectionString(connectionString, 'MetaApiAccountCache');
        const cacheMap = new Map<string, AccountCacheEntity>();
        try {
            for await (const entity of cacheTable.listEntities<AccountCacheEntity>()) {
                cacheMap.set(entity.partitionKey, entity);
            }
        } catch {
            // table may not exist yet — non-fatal
        }

        // ── 3. Scan FreeTierUsage ──────────────────────────────────────────────
        const usageTable = TableClient.fromConnectionString(connectionString, 'FreeTierUsage');
        const usageMap = new Map<string, FreeTierUsageEntity>();
        try {
            for await (const entity of usageTable.listEntities<FreeTierUsageEntity>()) {
                usageMap.set(entity.partitionKey, entity);
            }
        } catch {
            // table may not exist yet — non-fatal
        }

        // ── 4. MetaAPI live account data ───────────────────────────────────────
        const masterToken = process.env.METAAPI_MASTER_TOKEN;
        let metaApiAccounts: Record<string, any> = {};
        if (masterToken) {
            try {
                const resp = await fetch(
                    'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts?limit=1000',
                    { headers: { 'auth-token': masterToken, 'Content-Type': 'application/json' } }
                );
                if (resp.ok) {
                    const data = await resp.json();
                    const accounts: any[] = Array.isArray(data) ? data : (data.items || []);
                    for (const acc of accounts) {
                        if (acc.id) metaApiAccounts[acc.id] = acc;
                    }
                }
            } catch (e) {
                console.error('MetaAPI fetch error:', e);
            }
        }

        // ── 5. Clerk user enrichment ───────────────────────────────────────────
        const userIds = [...new Set(brokerRows.map(r => r.partitionKey))];
        const clerkUserMap: Record<string, { email: string | null; firstName: string | null; lastName: string | null; instance: string }> = {};

        for (const instance of CLERK_INSTANCES) {
            if (!instance.secretKey) continue;
            const client = createClerkClient({ secretKey: instance.secretKey });
            for (const userId of userIds) {
                if (clerkUserMap[userId]) continue;
                try {
                    const user = await client.users.getUser(userId);
                    const primaryEmail = user.emailAddresses?.find((e: any) => e.id === user.primaryEmailAddressId);
                    clerkUserMap[userId] = {
                        email: primaryEmail?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        instance: instance.name,
                    };
                } catch { /* not found in this instance */ }
            }
        }

        // ── 6. Assemble rows ───────────────────────────────────────────────────
        const connections: ConnectionRow[] = brokerRows.map(entity => {
            let meta: Record<string, any> = {};
            if (entity.metadata) {
                try { meta = typeof entity.metadata === 'string' ? JSON.parse(entity.metadata) : entity.metadata; } catch { /* */ }
            }

            const userId = entity.partitionKey;
            const accountId = entity.accountId ?? meta.accountId ?? null;
            const liveData = accountId ? (metaApiAccounts[accountId] ?? null) : null;
            const clerkUser = clerkUserMap[userId] ?? null;
            const cache = cacheMap.get(userId) ?? null;
            const usage = usageMap.get(userId) ?? null;

            const deployedHoursAccrued = Number(usage?.deployedHoursAccrued ?? 0);
            const lifetimeDeployments = Number(usage?.lifetimeDeployments ?? 0);

            // Cost calculation
            // MetaAPI charges per hour but bills a 6h minimum on every deploy start.
            // Actual cost = max(hours × rate, deployments × 6h-min × rate)
            const lifetimeCostUsd = deployedHoursAccrued * METAAPI_RATE_PER_HOUR;
            const minBilledCostUsd = lifetimeDeployments * METAAPI_MIN_COST_PER_DEPLOY;
            const actualCostUsd = Math.max(lifetimeCostUsd, minBilledCostUsd);

            // Current session cost: if deployed right now, how long has this session been running?
            const isDeployedNow = (cache?.lifecycleState ?? liveData?.state) === 'DEPLOYED';
            let currentSessionCostUsd = 0;
            if (isDeployedNow && cache?.lastDeployedAt) {
                const sessionHours = (Date.now() - new Date(cache.lastDeployedAt).getTime()) / (1000 * 60 * 60);
                const billableHours = Math.max(METAAPI_MIN_HOURS_PER_DEPLOY, sessionHours);
                currentSessionCostUsd = billableHours * METAAPI_RATE_PER_HOUR;
            } else if (isDeployedNow) {
                // deployed but no timestamp — assume minimum billing
                currentSessionCostUsd = METAAPI_MIN_COST_PER_DEPLOY;
            }

            return {
                userId,
                email: clerkUser?.email ?? null,
                firstName: clerkUser?.firstName ?? null,
                lastName: clerkUser?.lastName ?? null,
                clerkInstance: clerkUser?.instance ?? null,

                connected: liveData ? (liveData.connectionStatus === 'CONNECTED') : (entity.connected ?? false),
                accountId,
                brokerName: liveData?.brokerName ?? meta.brokerName ?? null,
                server: liveData?.server ?? meta.server ?? null,
                platform: liveData?.platform ?? meta.platform ?? null,
                region: liveData?.region ?? meta.region ?? null,
                brokerLastUpdated: entity.lastUpdated ?? null,

                lifecycleState: cache?.lifecycleState ?? liveData?.state ?? null,
                policy: cache?.policy ?? null,
                cachedBalance: cache?.cachedBalance ?? null,
                cachedEquity: cache?.cachedEquity ?? null,
                cachedAt: cache?.cachedAt ?? null,
                lastDeployedAt: cache?.lastDeployedAt ?? null,
                lastUndeployedAt: cache?.lastUndeployedAt ?? null,
                lastUndeployReason: cache?.lastUndeployReason ?? null,
                alwaysOnFlag: cache?.alwaysOnFlag ?? false,

                lifetimeTrades: Number(usage?.lifetimeTrades ?? 0),
                deployedHoursAccrued,
                lifetimeDeployments,
                deployedHoursRemaining: Math.max(0, FREE_TIER_HOURS_LIMIT - deployedHoursAccrued),
                lastTradeAt: usage?.lastTradeAt ?? null,
                lastDeployAt: usage?.lastDeployAt ?? null,
                convertedAt: usage?.convertedAt ?? null,
                convertedReason: usage?.convertedReason ?? null,

                lifetimeCostUsd,
                minBilledCostUsd,
                actualCostUsd,
                currentSessionCostUsd,
            };
        });

        // Sort: connected + deployed first, then by lastDeployedAt desc
        connections.sort((a, b) => {
            if (a.connected !== b.connected) return a.connected ? -1 : 1;
            if (a.lastDeployedAt && b.lastDeployedAt) return b.lastDeployedAt.localeCompare(a.lastDeployedAt);
            return 0;
        });

        const deployedNow = connections.filter(c => c.lifecycleState === 'DEPLOYED');

        const summary: ConnectionsSummary = {
            total: connections.length,
            connected: connections.filter(c => c.connected).length,
            disconnected: connections.filter(c => !c.connected).length,
            deployed: deployedNow.length,
            undeployed: connections.filter(c => c.lifecycleState === 'UNDEPLOYED').length,
            alwaysOn: connections.filter(c => c.policy === 'always-on').length,
            weekendOnly: connections.filter(c => c.policy === 'weekend-only').length,
            overnightAndWeekend: connections.filter(c => c.policy === 'overnight-and-weekend').length,
            metaApiLiveData: Object.keys(metaApiAccounts).length > 0,
            totalDeployedHours: connections.reduce((sum, c) => sum + c.deployedHoursAccrued, 0),
            avgDeployedHours: connections.length > 0
                ? connections.reduce((sum, c) => sum + c.deployedHoursAccrued, 0) / connections.length
                : 0,
            totalActualCostUsd: connections.reduce((sum, c) => sum + c.actualCostUsd, 0),
            totalCurrentSessionCostUsd: deployedNow.reduce((sum, c) => sum + c.currentSessionCostUsd, 0),
            // Projected monthly: currently-deployed accounts × $0.013/h × 720h/month
            projectedMonthlyCostUsd: deployedNow.length * METAAPI_RATE_PER_HOUR * 720,
        };

        return NextResponse.json({ connections, summary, ratePerHour: METAAPI_RATE_PER_HOUR });
    } catch (error: any) {
        console.error('metaapi-connections error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch connections' }, { status: 500 });
    }
}
