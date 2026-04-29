import { NextResponse } from 'next/server';
import { TableClient } from '@azure/data-tables';
import { createClerkClient } from '@clerk/backend';

interface BrokerConnectionEntity {
    partitionKey: string;
    rowKey: string;
    connected?: boolean;
    lastUpdated?: string;
    accountId?: string;
    metadata?: string;
}

interface ConnectionRow {
    userId: string;
    accountId: string | null;
    connected: boolean;
    lastUpdated: string | null;
    brokerName: string | null;
    server: string | null;
    platform: string | null;
    region: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    clerkInstance: string | null;
}

const CLERK_INSTANCES = [
    { name: 'Dev', secretKey: process.env.CLERK_SECRET_KEY || '' },
    { name: 'Live', secretKey: process.env.CLERK_LIVE_SECRET_KEY || '' },
];

/**
 * GET /api/metaapi-connections
 * Returns all users with a MetaAPI broker connection, enriched with
 * Clerk user details and live MetaAPI account data.
 */
export async function GET() {
    try {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            return NextResponse.json({ error: 'AZURE_STORAGE_CONNECTION_STRING not configured' }, { status: 500 });
        }

        // ── 1. Scan Azure Table Storage for all metaapi rows ───────────
        const tableClient = TableClient.fromConnectionString(connectionString, 'UserBrokerConnections');
        const entities = tableClient.listEntities<BrokerConnectionEntity>({
            queryOptions: { filter: `RowKey eq 'metaapi'` },
        });

        const rows: BrokerConnectionEntity[] = [];
        for await (const entity of entities) {
            rows.push(entity);
        }

        // ── 2. Fetch all accounts from MetaAPI REST API ────────────────
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
                console.error('MetaAPI REST fetch error:', e);
            }
        }

        // ── 3. Batch-fetch Clerk users ─────────────────────────────────
        const userIds = [...new Set(rows.map(r => r.partitionKey))];
        const clerkUserMap: Record<string, {
            email: string | null;
            firstName: string | null;
            lastName: string | null;
            instance: string;
        }> = {};

        for (const instance of CLERK_INSTANCES) {
            if (!instance.secretKey) continue;
            const client = createClerkClient({ secretKey: instance.secretKey });
            for (const userId of userIds) {
                if (clerkUserMap[userId]) continue;
                try {
                    const user = await client.users.getUser(userId);
                    const primaryEmail = user.emailAddresses?.find(e => e.id === user.primaryEmailAddressId);
                    clerkUserMap[userId] = {
                        email: primaryEmail?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        instance: instance.name,
                    };
                } catch { /* not found in this instance */ }
            }
        }

        // ── 4. Assemble final rows ─────────────────────────────────────
        const connections: ConnectionRow[] = rows.map(entity => {
            let meta: Record<string, any> = {};
            if (entity.metadata) {
                try {
                    meta = typeof entity.metadata === 'string' ? JSON.parse(entity.metadata) : entity.metadata;
                } catch { /* */ }
            }

            const accountId = entity.accountId ?? meta.accountId ?? null;
            const liveData = accountId ? (metaApiAccounts[accountId] ?? null) : null;
            const clerkUser = clerkUserMap[entity.partitionKey] ?? null;

            return {
                userId: entity.partitionKey,
                accountId,
                connected: liveData
                    ? (liveData.connectionStatus === 'CONNECTED')
                    : (entity.connected ?? false),
                lastUpdated: entity.lastUpdated ?? null,
                brokerName: liveData?.brokerName ?? meta.brokerName ?? null,
                server: liveData?.server ?? meta.server ?? null,
                platform: liveData?.platform ?? meta.platform ?? null,
                region: liveData?.region ?? meta.region ?? null,
                email: clerkUser?.email ?? null,
                firstName: clerkUser?.firstName ?? null,
                lastName: clerkUser?.lastName ?? null,
                clerkInstance: clerkUser?.instance ?? null,
            };
        });

        // Sort: connected first, then by lastUpdated desc
        connections.sort((a, b) => {
            if (a.connected !== b.connected) return a.connected ? -1 : 1;
            if (a.lastUpdated && b.lastUpdated) return b.lastUpdated.localeCompare(a.lastUpdated);
            return 0;
        });

        const summary = {
            total: connections.length,
            connected: connections.filter(c => c.connected).length,
            disconnected: connections.filter(c => !c.connected).length,
            metaApiLiveData: Object.keys(metaApiAccounts).length > 0,
        };

        return NextResponse.json({ connections, summary });
    } catch (error: any) {
        console.error('metaapi-connections error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch connections' }, { status: 500 });
    }
}
