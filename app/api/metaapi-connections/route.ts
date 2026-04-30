import { NextRequest, NextResponse } from 'next/server';
import { TableClient } from '@azure/data-tables';

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

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * GET /api/metaapi-connections?pageSize=50&continuationToken=...
 *
 * Returns a paginated slice of broker-connection rows from Azure Table
 * Storage, optionally enriched with live MetaApi account data (single bulk
 * REST call). User identity (email/name) is NOT fetched here — the UI
 * lazy-loads that per page from /api/clerk-users.
 *
 * NOTE on "scanning": Azure Table Storage only indexes (PartitionKey, RowKey).
 * Filtering by RowKey='metaapi' across all partitions is a full table scan;
 * we mitigate by exposing Azure's continuation tokens to the client.
 */
export async function GET(request: NextRequest) {
    try {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            return NextResponse.json({ error: 'AZURE_STORAGE_CONNECTION_STRING not configured' }, { status: 500 });
        }

        const url = new URL(request.url);
        const requestedPageSize = Number(url.searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE);
        const pageSize = Number.isFinite(requestedPageSize)
            ? Math.min(Math.max(1, requestedPageSize), MAX_PAGE_SIZE)
            : DEFAULT_PAGE_SIZE;
        const continuationToken = url.searchParams.get('continuationToken') ?? undefined;

        // ── 1. Pull ONE Azure page (server-paginated via continuation token) ──
        const tableClient = TableClient.fromConnectionString(connectionString, 'UserBrokerConnections');
        const iterator = tableClient
            .listEntities<BrokerConnectionEntity>({ queryOptions: { filter: `RowKey eq 'metaapi'` } })
            .byPage({ maxPageSize: pageSize, continuationToken });

        const { value: page } = await iterator.next();
        const rows: BrokerConnectionEntity[] = page ?? [];
        // Azure attaches the next token directly to the page array.
        const nextContinuationToken: string | null =
            (page as unknown as { continuationToken?: string })?.continuationToken ?? null;

        // ── 2. (Optional) MetaApi REST enrichment for the accountIds on this page only ──
        const accountIdsOnPage = rows
            .map(r => r.accountId)
            .filter((v): v is string => typeof v === 'string' && v.length > 0);

        const masterToken = process.env.METAAPI_MASTER_TOKEN;
        const metaApiAccounts: Record<string, Record<string, unknown>> = {};
        let metaApiLiveData = false;

        if (masterToken && accountIdsOnPage.length > 0) {
            try {
                // The list endpoint doesn't support id-filter, so we still pull all
                // accounts in one call and project the ones on this page. This is
                // O(1) request regardless of page size.
                const resp = await fetch(
                    'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts?limit=1000',
                    { headers: { 'auth-token': masterToken, 'Content-Type': 'application/json' } },
                );
                if (resp.ok) {
                    const data = await resp.json();
                    const accounts: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data.items ?? []);
                    const wantedSet = new Set(accountIdsOnPage);
                    for (const acc of accounts) {
                        const id = acc.id as string | undefined;
                        if (id && wantedSet.has(id)) metaApiAccounts[id] = acc;
                    }
                    metaApiLiveData = Object.keys(metaApiAccounts).length > 0;
                }
            } catch (e) {
                console.error('MetaAPI REST fetch error:', e);
            }
        }

        // ── 3. Assemble rows (no Clerk lookup — UI handles that) ─────────────
        const connections: ConnectionRow[] = rows.map(entity => {
            let meta: Record<string, unknown> = {};
            if (entity.metadata) {
                try {
                    meta = typeof entity.metadata === 'string' ? JSON.parse(entity.metadata) : entity.metadata;
                } catch { /* ignore malformed metadata */ }
            }

            const accountId = entity.accountId ?? (meta.accountId as string | undefined) ?? null;
            const liveData = accountId ? (metaApiAccounts[accountId] ?? null) : null;

            return {
                userId: entity.partitionKey,
                accountId,
                connected: liveData
                    ? liveData.connectionStatus === 'CONNECTED'
                    : (entity.connected ?? false),
                lastUpdated: entity.lastUpdated ?? null,
                brokerName: (liveData?.brokerName as string | undefined) ?? (meta.brokerName as string | undefined) ?? null,
                server: (liveData?.server as string | undefined) ?? (meta.server as string | undefined) ?? null,
                platform: (liveData?.platform as string | undefined) ?? (meta.platform as string | undefined) ?? null,
                region: (liveData?.region as string | undefined) ?? (meta.region as string | undefined) ?? null,
            };
        });

        // Sort within the page only: connected first, then lastUpdated desc
        connections.sort((a, b) => {
            if (a.connected !== b.connected) return a.connected ? -1 : 1;
            if (a.lastUpdated && b.lastUpdated) return b.lastUpdated.localeCompare(a.lastUpdated);
            return 0;
        });

        return NextResponse.json({
            connections,
            page: {
                size: connections.length,
                requestedSize: pageSize,
                nextContinuationToken,
            },
            metaApiLiveData,
        });
    } catch (error) {
        const err = error as Error;
        console.error('metaapi-connections error:', err);
        return NextResponse.json({ error: err.message ?? 'Failed to fetch connections' }, { status: 500 });
    }
}
