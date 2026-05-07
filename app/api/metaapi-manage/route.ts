import { NextRequest, NextResponse } from 'next/server';
import { TableClient } from '@azure/data-tables';

const PROVISIONING_BASE = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';

/**
 * POST /api/metaapi-manage
 * Body: { action: 'undeploy' | 'deploy' | 'delete', accountId: string, userId: string }
 *
 * undeploy — stops MetaAPI terminal + updates cache lifecycleState = UNDEPLOYED
 * deploy   — restarts terminal + updates cache lifecycleState = DEPLOYED
 * delete   — removes from MetaAPI + deletes UserBrokerConnections + AccountCache rows
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, accountId, userId } = body as {
            action: string;
            accountId: string;
            userId: string;
        };

        if (!action || !accountId || !userId) {
            return NextResponse.json({ error: 'action, accountId and userId are required' }, { status: 400 });
        }

        if (!['undeploy', 'deploy', 'delete'].includes(action)) {
            return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }

        const masterToken = process.env.METAAPI_MASTER_TOKEN;
        if (!masterToken) {
            return NextResponse.json({ error: 'METAAPI_MASTER_TOKEN not configured' }, { status: 500 });
        }

        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

        // ── 1. Call MetaAPI ───────────────────────────────────────────────────
        let url: string;
        let method: string;

        if (action === 'undeploy') {
            url = `${PROVISIONING_BASE}/users/current/accounts/${accountId}/undeploy`;
            method = 'POST';
        } else if (action === 'deploy') {
            url = `${PROVISIONING_BASE}/users/current/accounts/${accountId}/deploy`;
            method = 'POST';
        } else {
            url = `${PROVISIONING_BASE}/users/current/accounts/${accountId}`;
            method = 'DELETE';
        }

        const resp = await fetch(url, {
            method,
            headers: { 'auth-token': masterToken, 'Content-Type': 'application/json' },
        });

        if (!resp.ok) {
            let errBody = '';
            try { errBody = await resp.text(); } catch { /* */ }

            // For delete: if MetaAPI says 404, account is already gone — still clean up Azure Tables
            if (action === 'delete' && resp.status === 404) {
                // fall through to cleanup below
            } else {
                return NextResponse.json(
                    { error: `MetaAPI returned ${resp.status}`, details: errBody },
                    { status: resp.status }
                );
            }
        }

        const now = new Date().toISOString();
        const sideEffectErrors: string[] = [];

        // ── 2. Sync Azure Table Storage ───────────────────────────────────────
        if (connectionString) {

            if (action === 'undeploy') {
                // Update MetaApiAccountCache: lifecycleState = UNDEPLOYED
                try {
                    const cacheTable = TableClient.fromConnectionString(connectionString, 'MetaApiAccountCache');
                    await cacheTable.upsertEntity({
                        partitionKey: userId,
                        rowKey: accountId,
                        lifecycleState: 'UNDEPLOYED',
                        lastUndeployedAt: now,
                        lastUndeployReason: 'manual',
                    }, 'Merge');
                } catch (e: any) {
                    sideEffectErrors.push(`AccountCache update: ${e.message}`);
                }

                // Update UserBrokerConnections: connected = false
                try {
                    const brokerTable = TableClient.fromConnectionString(connectionString, 'UserBrokerConnections');
                    await brokerTable.upsertEntity({
                        partitionKey: userId,
                        rowKey: 'metaapi',
                        connected: false,
                        lastUpdated: now,
                    }, 'Merge');
                } catch (e: any) {
                    sideEffectErrors.push(`BrokerConnections update: ${e.message}`);
                }
            }

            if (action === 'deploy') {
                // Update MetaApiAccountCache: lifecycleState = DEPLOYING (not DEPLOYED yet — MetaAPI needs time)
                try {
                    const cacheTable = TableClient.fromConnectionString(connectionString, 'MetaApiAccountCache');
                    await cacheTable.upsertEntity({
                        partitionKey: userId,
                        rowKey: accountId,
                        lifecycleState: 'DEPLOYING',
                        lastDeployedAt: now,
                    }, 'Merge');
                } catch (e: any) {
                    sideEffectErrors.push(`AccountCache update: ${e.message}`);
                }
            }

            if (action === 'delete') {
                // Delete UserBrokerConnections row
                try {
                    const brokerTable = TableClient.fromConnectionString(connectionString, 'UserBrokerConnections');
                    await brokerTable.deleteEntity(userId, 'metaapi');
                } catch (e: any) {
                    if (e?.statusCode !== 404) sideEffectErrors.push(`BrokerConnections delete: ${e.message}`);
                }

                // Delete MetaApiAccountCache row
                try {
                    const cacheTable = TableClient.fromConnectionString(connectionString, 'MetaApiAccountCache');
                    await cacheTable.deleteEntity(userId, accountId);
                } catch (e: any) {
                    if (e?.statusCode !== 404) sideEffectErrors.push(`AccountCache delete: ${e.message}`);
                }

                // FreeTierUsage intentionally kept — audit trail
            }
        }

        return NextResponse.json({
            success: true,
            action,
            accountId,
            userId,
            ...(sideEffectErrors.length ? { sideEffectErrors } : {}),
        });

    } catch (error: any) {
        console.error('metaapi-manage error:', error);
        return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
    }
}
