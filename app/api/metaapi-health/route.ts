import { NextRequest, NextResponse } from 'next/server';

interface MetaApiAccountHealth {
    id: string;
    name: string;
    state: string;
    connectionStatus: string;
    region: string;
    platform: string;
    reliability: string;
    tags: string[];
    type: string;
    login: string;
    server: string;
    copyFactoryRoles: string[];
    resourceSlots: number;
    connections: Array<{
        region: string;
        zone: string;
        application: string;
    }>;
}

/**
 * POST /api/metaapi-health
 * Given a MetaAPI account ID, fetch live health status from the MetaAPI Provisioning API.
 */
export async function POST(request: NextRequest) {
    try {
        const { accountId } = await request.json();

        if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
            return NextResponse.json(
                { error: 'MetaAPI Account ID is required' },
                { status: 400 }
            );
        }

        const token = process.env.METAAPI_MASTER_TOKEN;
        if (!token) {
            console.error('[MetaAPI Health] METAAPI_MASTER_TOKEN is not set');
            return NextResponse.json(
                { error: 'METAAPI_MASTER_TOKEN not configured in .env.local' },
                { status: 500 }
            );
        }

        console.log(`[MetaAPI Health] Checking account: ${accountId.trim()}`);
        const url = `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId.trim()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        try {
            const response = await fetch(url, {
                headers: {
                    'auth-token': token,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 404) {
                    return NextResponse.json({
                        success: false,
                        error: `MetaAPI account ${accountId} not found (404)`,
                    });
                }
                const errorText = await response.text();
                return NextResponse.json({
                    success: false,
                    error: `MetaAPI API returned ${response.status}: ${errorText}`,
                });
            }

            const account: MetaApiAccountHealth = await response.json();
            console.log(`[MetaAPI Health] Provisioning API success: state=${account.state}, connectionStatus=${account.connectionStatus}, region=${account.region}`);

            // Also check live RPC connection status
            let rpcConnectionStatus: string | null = null;
            if (account.region) {
                try {
                    const rpcUrl = `https://mt-client-api-v1.${account.region}.agiliumtrade.ai/users/current/accounts/${accountId.trim()}/connection-status`;
                    const rpcController = new AbortController();
                    const rpcTimeoutId = setTimeout(() => rpcController.abort(), 10000);

                    const rpcResponse = await fetch(rpcUrl, {
                        headers: {
                            'auth-token': token,
                            'Accept': 'application/json',
                        },
                        signal: rpcController.signal,
                    });

                    clearTimeout(rpcTimeoutId);

                    if (rpcResponse.ok) {
                        const rpcData = await rpcResponse.json();
                        rpcConnectionStatus = rpcData.connected ? 'CONNECTED' : 'DISCONNECTED';
                    } else {
                        rpcConnectionStatus = 'UNKNOWN';
                    }
                } catch {
                    rpcConnectionStatus = 'UNREACHABLE';
                }
            }

            return NextResponse.json({
                success: true,
                health: {
                    id: account.id,
                    name: account.name,
                    state: account.state || 'UNKNOWN',
                    connectionStatus: account.connectionStatus || 'UNKNOWN',
                    rpcConnectionStatus,
                    region: account.region || 'unknown',
                    platform: account.platform || 'unknown',
                    reliability: account.reliability || 'unknown',
                    type: account.type || 'unknown',
                    login: account.login || 'unknown',
                    server: account.server || 'unknown',
                    tags: account.tags || [],
                    copyFactoryRoles: account.copyFactoryRoles || [],
                    resourceSlots: account.resourceSlots ?? 0,
                    connections: account.connections || [],
                },
            });
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                return NextResponse.json({
                    success: false,
                    error: 'MetaAPI Provisioning API request timed out after 15 seconds',
                });
            }
            throw error;
        }
    } catch (error: any) {
        console.error('[MetaAPI Health] Unhandled error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to check MetaAPI account health',
            },
            { status: 500 }
        );
    }
}
