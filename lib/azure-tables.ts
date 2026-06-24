// lib/azure-tables.ts
// Minimal Azure Table Storage client factory for dev-tools.
// Reads AZURE_STORAGE_CONNECTION_STRING from env.

import { TableClient } from '@azure/data-tables';

export function getTableClient(tableName: string): TableClient {
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!conn) throw new Error(`AZURE_STORAGE_CONNECTION_STRING not set — cannot connect to "${tableName}"`);
    return TableClient.fromConnectionString(conn, tableName);
}

export async function ensureTable(tableName: string): Promise<void> {
    try { await getTableClient(tableName).createTable(); } catch { /* already exists */ }
}
