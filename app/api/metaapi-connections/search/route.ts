import { NextRequest, NextResponse } from 'next/server';
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
}

type SearchKind = 'userId' | 'email' | 'name' | 'none';

const RESULT_CAP = 25;

function rowFromEntity(entity: BrokerConnectionEntity): ConnectionRow {
    let meta: Record<string, unknown> = {};
    if (entity.metadata) {
        try {
            meta = typeof entity.metadata === 'string' ? JSON.parse(entity.metadata) : entity.metadata;
        } catch { /* malformed metadata — fall through to nulls */ }
    }
    const accountId = entity.accountId ?? (meta.accountId as string | undefined) ?? null;
    return {
        userId: entity.partitionKey,
        accountId,
        connected: entity.connected ?? false,
        lastUpdated: entity.lastUpdated ?? null,
        brokerName: (meta.brokerName as string | undefined) ?? null,
        server: (meta.server as string | undefined) ?? null,
        platform: (meta.platform as string | undefined) ?? null,
        region: (meta.region as string | undefined) ?? null,
    };
}

async function tryPointGet(table: TableClient, userId: string): Promise<BrokerConnectionEntity | null> {
    try {
        return await table.getEntity<BrokerConnectionEntity>(userId, 'metaapi');
    } catch (e) {
        const err = e as { statusCode?: number };
        if (err.statusCode === 404) return null;
        throw e;
    }
}

async function clerkUserIdsByEmail(email: string): Promise<string[]> {
    const ids: string[] = [];
    for (const secretKey of [process.env.CLERK_LIVE_SECRET_KEY, process.env.CLERK_SECRET_KEY]) {
        if (!secretKey) continue;
        try {
            const clerk = createClerkClient({ secretKey });
            const list = await clerk.users.getUserList({ emailAddress: [email], limit: RESULT_CAP });
            for (const u of list.data) ids.push(u.id);
        } catch (e) {
            console.error('[search] Clerk email lookup failed:', (e as Error).message);
        }
    }
    return Array.from(new Set(ids));
}

// Clerk's `query` param does a fuzzy match across firstName, lastName, email,
// username, web3 wallet, etc. — perfect for "search by name".
async function clerkUserIdsByQuery(query: string): Promise<string[]> {
    const ids: string[] = [];
    for (const secretKey of [process.env.CLERK_LIVE_SECRET_KEY, process.env.CLERK_SECRET_KEY]) {
        if (!secretKey) continue;
        try {
            const clerk = createClerkClient({ secretKey });
            const list = await clerk.users.getUserList({ query, limit: RESULT_CAP });
            for (const u of list.data) ids.push(u.id);
        } catch (e) {
            console.error('[search] Clerk query lookup failed:', (e as Error).message);
        }
    }
    return Array.from(new Set(ids));
}

export async function GET(request: NextRequest) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
        return NextResponse.json({ error: 'AZURE_STORAGE_CONNECTION_STRING not configured' }, { status: 500 });
    }

    const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
    if (!q) return NextResponse.json({ connections: [], searchKind: 'none' as SearchKind });

    const tableClient = TableClient.fromConnectionString(connectionString, 'UserBrokerConnections');

    // ── email ──────────────────────────────────────────────────────────────
    if (q.includes('@')) {
        const userIds = await clerkUserIdsByEmail(q);
        const found = await pointLookupAll(tableClient, userIds);
        return NextResponse.json({
            connections: found.map(rowFromEntity),
            searchKind: 'email' as SearchKind,
        });
    }

    // ── exact Clerk userId (e.g. pasted "user_2nGq…") ──────────────────────
    if (q.startsWith('user_')) {
        const exact = await tryPointGet(tableClient, q);
        return NextResponse.json({
            connections: exact ? [rowFromEntity(exact)] : [],
            searchKind: 'userId' as SearchKind,
        });
    }

    // ── name (fuzzy via Clerk's `query` param) ─────────────────────────────
    // Clerk searches across firstName, lastName, email, username — most
    // useful for "find users matching this text".
    const userIds = await clerkUserIdsByQuery(q);
    const found = await pointLookupAll(tableClient, userIds);
    return NextResponse.json({
        connections: found.map(rowFromEntity),
        searchKind: 'name' as SearchKind,
    });
}

async function pointLookupAll(table: TableClient, userIds: string[]): Promise<BrokerConnectionEntity[]> {
    if (userIds.length === 0) return [];
    const results = await Promise.all(userIds.map(id => tryPointGet(table, id)));
    return results.filter((e): e is BrokerConnectionEntity => e !== null);
}
