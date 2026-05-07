import { NextResponse } from 'next/server';
import { TableClient } from '@azure/data-tables';

/**
 * GET /api/metaapi-connections/summary
 *
 * Cheap global-count endpoint. Streams the Azure table once, only inspecting
 * the `connected` boolean — no payload, no Clerk, no MetaApi calls.
 *
 * This is still a full table scan (RowKey filter is not partition-indexed),
 * but it's the minimum work possible to give the operator accurate global
 * Total / Connected / Disconnected counts independent of pagination.
 */
export async function GET() {
    try {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            return NextResponse.json({ error: 'AZURE_STORAGE_CONNECTION_STRING not configured' }, { status: 500 });
        }

        const tableClient = TableClient.fromConnectionString(connectionString, 'UserBrokerConnections');

        let total = 0;
        let connected = 0;
        for await (const e of tableClient.listEntities<{ connected?: boolean }>({
            queryOptions: { filter: `RowKey eq 'metaapi'`, select: ['connected'] },
        })) {
            total++;
            if (e.connected) connected++;
        }

        return NextResponse.json({
            total,
            connected,
            disconnected: total - connected,
        });
    } catch (error) {
        const err = error as Error;
        console.error('[metaapi-connections/summary] error:', err);
        return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 });
    }
}
