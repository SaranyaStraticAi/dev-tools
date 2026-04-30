import { NextRequest, NextResponse } from 'next/server';

// Derived health label rules — see plan in /Users/.../plans/in-the-user-plan-wiggly-kay.md
export type HealthStatus = 'Healthy' | 'Inactive' | 'Degraded' | 'Down' | 'Unknown';

interface ProvisioningAccount {
    _id?: string;
    name?: string;
    state?: string;
    connectionStatus?: string;
    region?: string;
    platform?: string;
    reliability?: string;
    type?: string;
    login?: string | number;
    server?: string;
    tags?: string[];
    copyFactoryRoles?: string[];
    resourceSlots?: number;
    copyFactoryResourceSlots?: number;
    connections?: Array<{ region?: string; zone?: string; application?: string }>;
}

interface AccountInformation {
    broker?: string;
    currency?: string;
    server?: string;
    balance?: number;
    equity?: number;
    margin?: number;
    freeMargin?: number;
    leverage?: number;
    marginLevel?: number;
    tradeAllowed?: boolean;
    name?: string;
    login?: number;
    type?: string;
}

interface HealthBundle {
    status: HealthStatus;
    reason: string;
    checkedAt: string;
    provisioning: {
        state: string | null;
        connectionStatus: string | null;
        region: string | null;
        reliability: string | null;
        resourceSlots: number | null;
        copyFactoryResourceSlots: number | null;
        connections: Array<{ region?: string; zone?: string; application?: string }>;
        platform: string | null;
        server: string | null;
        login: string | number | null;
    } | null;
    accountInfo: {
        tradeAllowed: boolean | null;
        balance: number | null;
        equity: number | null;
        marginLevel: number | null;
        currency: string | null;
        leverage: number | null;
    } | null;
    errors: string[];
}

const PROVISIONING_BASE = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
const CLIENT_BASE = (region: string) => `https://mt-client-api-v1.${region}.agiliumtrade.ai`;

async function fetchJsonWithTimeout<T>(url: string, token: string, timeoutMs: number): Promise<{ ok: true; data: T } | { ok: false; status: number | null; error: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            headers: { 'auth-token': token, Accept: 'application/json' },
            signal: controller.signal,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            return { ok: false, status: res.status, error: text || `HTTP ${res.status}` };
        }
        return { ok: true, data: (await res.json()) as T };
    } catch (e) {
        const err = e as Error;
        const isAbort = err.name === 'AbortError';
        return { ok: false, status: null, error: isAbort ? 'timeout' : err.message };
    } finally {
        clearTimeout(timer);
    }
}

// Health rules. There is no /connection-status REST endpoint on the Client API
// (we tried — it 404s for every account), so the canonical broker-connection
// signal is provisioning's own `connectionStatus` field. We use the regional
// `account-information` endpoint as the live-reachability test.
function deriveStatus(
    prov: ProvisioningAccount | null,
    acctInfoOk: boolean,
    acctInfo404: boolean,
    acctInfoStatus: number | null,
    tradeAllowed: boolean | null,
): { status: HealthStatus; reason: string } {
    if (!prov) return { status: 'Unknown', reason: 'Provisioning API unavailable' };

    const state = prov.state ?? 'UNKNOWN';
    const conn = prov.connectionStatus ?? 'UNKNOWN';

    if (['DEPLOY_FAILED', 'REDEPLOY_FAILED', 'UNDEPLOY_FAILED', 'DELETE_FAILED'].includes(state)) {
        return { status: 'Down', reason: `Account in ${state}` };
    }
    if (state === 'UNDEPLOYED') {
        return { status: 'Down', reason: 'Container is undeployed' };
    }
    if (['DEPLOYING', 'UNDEPLOYING', 'DELETING', 'CREATED'].includes(state)) {
        return { status: 'Degraded', reason: `Container is ${state}` };
    }
    if (state !== 'DEPLOYED') {
        return { status: 'Degraded', reason: `Unexpected state ${state}` };
    }

    // Broker disconnect → Inactive (user-side, not infra problem).
    if (conn === 'DISCONNECTED_FROM_BROKER') return { status: 'Inactive', reason: 'Disconnected from broker' };
    if (conn === 'DISCONNECTED')             return { status: 'Inactive', reason: 'Terminal disconnected' };

    if (conn === 'CONNECTED') {
        if (acctInfoOk) {
            if (tradeAllowed === false) return { status: 'Degraded', reason: 'Trading is not allowed on the account' };
            return { status: 'Healthy', reason: 'All checks passed' };
        }
        if (acctInfo404) {
            return { status: 'Degraded', reason: 'connectionStatus=CONNECTED but account-information 404 — terminal not responding' };
        }
        return { status: 'Degraded', reason: `account-information failed (HTTP ${acctInfoStatus ?? '?'})` };
    }

    return { status: 'Degraded', reason: `Unknown connectionStatus=${conn}` };
}

export async function POST(request: NextRequest) {
    let accountId = '';
    try {
        const body = await request.json();
        accountId = (body?.accountId ?? '').toString().trim();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!accountId) {
        return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const token = process.env.METAAPI_MASTER_TOKEN;
    if (!token) {
        const bundle: HealthBundle = {
            status: 'Unknown',
            reason: 'Server token not configured',
            checkedAt: new Date().toISOString(),
            provisioning: null,
            accountInfo: null,
            errors: ['METAAPI_MASTER_TOKEN env var is not set'],
        };
        return NextResponse.json({ success: false, health: bundle }, { status: 200 });
    }

    const errors: string[] = [];

    // 1. Provisioning detail (required to know region)
    const provRes = await fetchJsonWithTimeout<ProvisioningAccount>(
        `${PROVISIONING_BASE}/users/current/accounts/${accountId}`,
        token,
        15000,
    );

    let prov: ProvisioningAccount | null = null;
    if (provRes.ok) {
        prov = provRes.data;
    } else {
        if (provRes.status === 404) {
            const bundle: HealthBundle = {
                status: 'Down',
                reason: 'Account not found in MetaApi',
                checkedAt: new Date().toISOString(),
                provisioning: null,
                accountInfo: null,
                errors: ['Provisioning API returned 404'],
            };
            return NextResponse.json({ success: true, health: bundle });
        }
        errors.push(`Provisioning: ${provRes.error}`);
    }

    // 2. Regional account-information — proves the deployed terminal actually answers.
    const region = prov?.region;
    let acct: AccountInformation | null = null;
    let acctInfoOk = false;
    let acctInfo404 = false;
    let acctInfoStatus: number | null = null;

    if (region) {
        const acctRes = await fetchJsonWithTimeout<AccountInformation>(
            `${CLIENT_BASE(region)}/users/current/accounts/${accountId}/account-information`,
            token,
            10000,
        );
        if (acctRes.ok) {
            acct = acctRes.data;
            acctInfoOk = true;
        } else {
            acctInfoStatus = acctRes.status;
            if (acctRes.status === 404) {
                acctInfo404 = true;
            } else if (acctRes.status !== 500) {
                errors.push(`AccountInfo: ${acctRes.error}`);
            }
        }
    } else if (prov) {
        errors.push('No region on account — skipped account-information');
    }

    const tradeAllowed = acct?.tradeAllowed ?? null;
    const { status, reason } = deriveStatus(prov, acctInfoOk, acctInfo404, acctInfoStatus, tradeAllowed);

    const bundle: HealthBundle = {
        status,
        reason,
        checkedAt: new Date().toISOString(),
        provisioning: prov
            ? {
                  state: prov.state ?? null,
                  connectionStatus: prov.connectionStatus ?? null,
                  region: prov.region ?? null,
                  reliability: prov.reliability ?? null,
                  resourceSlots: prov.resourceSlots ?? null,
                  copyFactoryResourceSlots: prov.copyFactoryResourceSlots ?? null,
                  connections: prov.connections ?? [],
                  platform: prov.platform ?? null,
                  server: prov.server ?? null,
                  login: prov.login ?? null,
              }
            : null,
        accountInfo: acct
            ? {
                  tradeAllowed: acct.tradeAllowed ?? null,
                  balance: acct.balance ?? null,
                  equity: acct.equity ?? null,
                  marginLevel: acct.marginLevel ?? null,
                  currency: acct.currency ?? null,
                  leverage: acct.leverage ?? null,
              }
            : null,
        errors,
    };

    return NextResponse.json({ success: true, health: bundle });
}
