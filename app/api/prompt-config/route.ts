import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

const CONTAINER   = 'vibe-prompts';
const BLOB_NAME   = 'active-prompts.json';
const HISTORY_DIR = 'history';

function getContainerClient() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    return BlobServiceClient.fromConnectionString(connStr).getContainerClient(CONTAINER);
}

// GET — fetch current prompts OR history list/version
// ?history=true        → list all versions (metadata only, newest first)
// ?history=<blobName>  → fetch a specific version's full content
export async function GET(req: NextRequest) {
    try {
        const container    = getContainerClient();
        const historyParam = req.nextUrl.searchParams.get('history');

        // ── List history versions ─────────────────────────────────────────────
        if (historyParam === 'true') {
            const versions: { name: string; publishedAt: string; label: string }[] = [];
            for await (const blob of container.listBlobsFlat({ prefix: HISTORY_DIR + '/' })) {
                const ts   = blob.name.replace(`${HISTORY_DIR}/`, '').replace('.json', '').replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');
                const date = new Date(ts);
                versions.push({
                    name:        blob.name,
                    publishedAt: blob.properties.lastModified?.toISOString() ?? ts,
                    label:       isNaN(date.getTime())
                        ? blob.name
                        : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                });
            }
            versions.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
            return NextResponse.json({ versions });
        }

        // ── Fetch a specific history version ──────────────────────────────────
        if (historyParam && historyParam !== 'true') {
            const blob    = container.getBlockBlobClient(historyParam);
            const exists  = await blob.exists();
            if (!exists)  return NextResponse.json({ error: 'Version not found' }, { status: 404 });
            const buf     = await blob.downloadToBuffer();
            const prompts = JSON.parse(buf.toString('utf-8'));
            return NextResponse.json({ exists: true, prompts });
        }

        // ── Default: fetch active-prompts.json ────────────────────────────────
        const blobClient = container.getBlockBlobClient(BLOB_NAME);
        const exists     = await blobClient.exists();
        if (!exists) return NextResponse.json({ exists: false, prompts: null });
        const download   = await blobClient.downloadToBuffer();
        const prompts    = JSON.parse(download.toString('utf-8'));
        return NextResponse.json({ exists: true, prompts });

    } catch (err: any) {
        console.error('GET prompt-config error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — publish prompts + save versioned snapshot to history/
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { cinematicSystem, cinematicUser, statsSystem, statsUser } = body;

        if (!cinematicSystem || !statsSystem) {
            return NextResponse.json({ error: 'Missing prompt fields' }, { status: 400 });
        }

        const now         = new Date();
        const publishedAt = now.toISOString();

        const payload = JSON.stringify({
            cinematicSystem,
            cinematicUser,
            statsSystem,
            statsUser,
            publishedAt,
        });

        const container = getContainerClient();
        await container.createIfNotExists({ access: 'blob' });

        // 1. Overwrite active blob
        const activeBlob = container.getBlockBlobClient(BLOB_NAME);
        await activeBlob.upload(Buffer.from(payload), Buffer.byteLength(payload), {
            blobHTTPHeaders: { blobContentType: 'application/json' },
            overwrite: true,
        } as any);

        // 2. Save timestamped history snapshot
        const safeTs      = publishedAt.replace(/:/g, '-').replace(/\./g, '-');
        const historyBlob = container.getBlockBlobClient(`${HISTORY_DIR}/${safeTs}.json`);
        await historyBlob.upload(Buffer.from(payload), Buffer.byteLength(payload), {
            blobHTTPHeaders: { blobContentType: 'application/json' },
            overwrite: true,
        } as any);

        return NextResponse.json({ success: true, publishedAt });
    } catch (err: any) {
        console.error('POST prompt-config error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE — delete a specific history version blob
// ?history=<blobName>  e.g. ?history=history/2026-05-15T10-30-00-000Z.json
export async function DELETE(req: NextRequest) {
    try {
        const blobName = req.nextUrl.searchParams.get('history');
        if (!blobName || !blobName.startsWith(HISTORY_DIR + '/')) {
            return NextResponse.json({ error: 'Invalid or missing blob name' }, { status: 400 });
        }
        const container = getContainerClient();
        const blob      = container.getBlockBlobClient(blobName);
        const exists    = await blob.exists();
        if (!exists) return NextResponse.json({ error: 'Version not found' }, { status: 404 });
        await blob.delete();
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('DELETE prompt-config error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
