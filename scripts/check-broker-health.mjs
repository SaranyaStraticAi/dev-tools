#!/usr/bin/env node
// Pull every user with a MetaApi broker connection from Azure Table Storage
// and call MetaApi to derive a health status (Healthy / Inactive / Degraded /
// Down / Unknown). Writes a summary to stdout and a CSV to ./broker-health.csv.
//
// Run from repo root:   node scripts/check-broker-health.mjs
// Optional env:         CONCURRENCY=10  CSV_OUT=path/to/file.csv

import fs from 'node:fs';
import path from 'node:path';
import { TableClient } from '@azure/data-tables';

// ── 1. Load .env.local ─────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}

const AZURE_CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const TOKEN = process.env.METAAPI_MASTER_TOKEN;
if (!AZURE_CONN) { console.error('AZURE_STORAGE_CONNECTION_STRING missing'); process.exit(1); }
if (!TOKEN)      { console.error('METAAPI_MASTER_TOKEN missing');           process.exit(1); }

const CONCURRENCY = Number(process.env.CONCURRENCY ?? 8);
const CSV_OUT = process.env.CSV_OUT ?? 'broker-health.csv';

// ── 2. Helpers ─────────────────────────────────────────────────────────────
const PROV_BASE = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
const clientBase = (region) => `https://mt-client-api-v1.${region}.agiliumtrade.ai`;

async function fetchJson(url, timeoutMs = 12000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
        const r = await fetch(url, {
            headers: { 'auth-token': TOKEN, Accept: 'application/json' },
            signal: ctl.signal,
        });
        if (!r.ok) {
            const body = await r.text().catch(() => '');
            return { ok: false, status: r.status, error: body || `HTTP ${r.status}` };
        }
        return { ok: true, data: await r.json() };
    } catch (e) {
        return { ok: false, status: null, error: e.name === 'AbortError' ? 'timeout' : e.message };
    } finally {
        clearTimeout(t);
    }
}

// Health rules (revised — there is no /connection-status REST endpoint).
// Signals:
//   prov.state             — container lifecycle
//   prov.connectionStatus  — broker-connection state (the real source of truth)
//   acctInfoOk             — true if account-information responded 200 (terminal alive)
//   acctInfo404            — true if it 404'd (terminal not currently connected — normal when broker logged out)
//   tradeAllowed           — only meaningful when acctInfoOk
function deriveStatus(prov, acctInfoOk, acctInfo404, acctInfoStatus, tradeAllowed) {
    if (!prov) return { status: 'Unknown', reason: 'Provisioning API unavailable' };

    const state = prov.state ?? 'UNKNOWN';
    const conn = prov.connectionStatus ?? 'UNKNOWN';

    if (['DEPLOY_FAILED', 'REDEPLOY_FAILED', 'UNDEPLOY_FAILED', 'DELETE_FAILED'].includes(state)) {
        return { status: 'Down', reason: `state=${state}` };
    }
    if (state === 'UNDEPLOYED') return { status: 'Down', reason: 'Undeployed' };

    if (['DEPLOYING', 'UNDEPLOYING', 'DELETING', 'CREATED'].includes(state)) {
        return { status: 'Degraded', reason: `Transitional ${state}` };
    }
    if (state !== 'DEPLOYED') return { status: 'Degraded', reason: `Unexpected state ${state}` };

    // From here state === 'DEPLOYED'.
    // Broker disconnect → Inactive (user-side, not infra).
    if (conn === 'DISCONNECTED_FROM_BROKER') return { status: 'Inactive', reason: 'Disconnected from broker' };
    if (conn === 'DISCONNECTED')             return { status: 'Inactive', reason: 'Terminal disconnected' };

    if (conn === 'CONNECTED') {
        // Container is up and the broker says we're connected. Verify the terminal actually serves data.
        if (acctInfoOk) {
            if (tradeAllowed === false) return { status: 'Degraded', reason: 'Trading not allowed' };
            return { status: 'Healthy', reason: 'OK' };
        }
        if (acctInfo404) {
            // Provisioning says CONNECTED but terminal doesn't answer — mismatch / lagging sync.
            return { status: 'Degraded', reason: 'connectionStatus=CONNECTED but account-information 404' };
        }
        return { status: 'Degraded', reason: `account-information failed (HTTP ${acctInfoStatus ?? '?'})` };
    }

    return { status: 'Degraded', reason: `Unknown connectionStatus=${conn}` };
}

async function checkOne(accountId) {
    const provRes = await fetchJson(`${PROV_BASE}/users/current/accounts/${accountId}`, 15000);
    if (!provRes.ok) {
        if (provRes.status === 404) return { status: 'Down', reason: '404 not found in MetaApi', state: null, connectionStatus: null, region: null };
        return { status: 'Unknown', reason: `Provisioning ${provRes.error}`, state: null, connectionStatus: null, region: null };
    }
    const prov = provRes.data;
    const region = prov.region;

    let acctInfoOk = false;
    let acctInfo404 = false;
    let acctInfoStatus = null;
    let tradeAllowed = null;

    if (region) {
        const acctRes = await fetchJson(
            `${clientBase(region)}/users/current/accounts/${accountId}/account-information`,
            8000,
        );
        acctInfoStatus = acctRes.status;
        if (acctRes.ok) {
            acctInfoOk = true;
            tradeAllowed = acctRes.data?.tradeAllowed ?? null;
        } else if (acctRes.status === 404) {
            acctInfo404 = true;
        }
    }

    const { status, reason } = deriveStatus(prov, acctInfoOk, acctInfo404, acctInfoStatus, tradeAllowed);
    return {
        status,
        reason,
        state: prov.state ?? null,
        connectionStatus: prov.connectionStatus ?? null,
        region: region ?? null,
    };
}

// Tiny semaphore
async function pMap(items, fn, concurrency) {
    const results = new Array(items.length);
    let next = 0, done = 0;
    const total = items.length;
    return new Promise((resolve) => {
        const worker = async () => {
            while (true) {
                const i = next++;
                if (i >= items.length) return;
                try { results[i] = await fn(items[i], i); }
                catch (e) { results[i] = { error: e.message }; }
                done++;
                if (done % 10 === 0 || done === total) {
                    process.stdout.write(`\r  ${done}/${total} checked`);
                }
            }
        };
        Promise.all(Array.from({ length: concurrency }, worker)).then(() => {
            process.stdout.write('\n');
            resolve(results);
        });
    });
}

// ── 3. Pull rows from Azure Table Storage ──────────────────────────────────
console.log('Scanning UserBrokerConnections for RowKey=metaapi…');
const table = TableClient.fromConnectionString(AZURE_CONN, 'UserBrokerConnections');
const rows = [];
for await (const e of table.listEntities({ queryOptions: { filter: `RowKey eq 'metaapi'` } })) {
    let meta = {};
    if (e.metadata) {
        try { meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata; }
        catch { /* ignore */ }
    }
    const accountId = e.accountId ?? meta.accountId ?? null;
    rows.push({
        userId: e.partitionKey,
        accountId,
        cachedConnected: !!e.connected,
        cachedRegion: meta.region ?? null,
        cachedBroker: meta.brokerName ?? null,
    });
}
console.log(`Found ${rows.length} broker rows.`);

const withAcct = rows.filter(r => r.accountId);
const withoutAcct = rows.length - withAcct.length;
if (withoutAcct) console.log(`  ${withoutAcct} rows have no accountId — skipping those.`);

// ── 4. Health-check each ───────────────────────────────────────────────────
console.log(`Checking ${withAcct.length} accounts (concurrency=${CONCURRENCY})…`);
const start = Date.now();
const checks = await pMap(withAcct, (r) => checkOne(r.accountId), CONCURRENCY);
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

// ── 5. Aggregate + report ──────────────────────────────────────────────────
const merged = withAcct.map((r, i) => ({ ...r, ...checks[i] }));
const counts = merged.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
}, {});

console.log(`\nDone in ${elapsed}s.\n`);
console.log('Status counts:');
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(10)}  ${v}`);
}

const problems = merged.filter(r => r.status !== 'Healthy' && r.status !== 'Inactive');
console.log(`\nNon-Healthy / Non-Inactive (${problems.length}):`);
for (const r of problems.slice(0, 50)) {
    const acct = String(r.accountId ?? '').padEnd(38);
    const state = String(r.state ?? '—').padEnd(15);
    console.log(`  ${r.status.padEnd(9)} ${acct} state=${state} ${r.reason}`);
}
if (problems.length > 50) console.log(`  …${problems.length - 50} more (see CSV)`);

// CSV
const csvHeader = 'userId,accountId,status,reason,state,connectionStatus,region,cachedBroker,cachedConnected\n';
const csvRows = merged.map(r =>
    [r.userId, r.accountId, r.status, r.reason, r.state ?? '', r.connectionStatus ?? '', r.region ?? '', r.cachedBroker ?? '', r.cachedConnected]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
).join('\n');
fs.writeFileSync(CSV_OUT, csvHeader + csvRows + '\n');
console.log(`\nCSV written to ${CSV_OUT}`);
