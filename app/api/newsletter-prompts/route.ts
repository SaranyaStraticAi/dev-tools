import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

const CONTAINER   = 'newsletter-prompts';
const BLOB_NAME   = 'active-prompts.json';
const HISTORY_DIR = 'history';

function getContainerClient() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    return BlobServiceClient.fromConnectionString(connStr).getContainerClient(CONTAINER);
}

// GET
// ?history=weekly         → list weekly versions newest-first
// ?history=puzzle         → list puzzle versions newest-first
// ?history=<full/path>    → fetch a specific version's full content
// (no params)             → fetch active-prompts.json
export async function GET(req: NextRequest) {
    try {
        const container    = getContainerClient();
        const historyParam = req.nextUrl.searchParams.get('history');

        // ── List versions by type ─────────────────────────────────────────────
        if (historyParam === 'weekly' || historyParam === 'puzzle') {
            const prefix   = `${HISTORY_DIR}/${historyParam}/`;
            const versions: { name: string; publishedAt: string; label: string }[] = [];
            for await (const blob of container.listBlobsFlat({ prefix })) {
                const ts   = blob.name.replace(prefix, '').replace('.json', '').replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');
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

        // ── Fetch a specific history version by full blob path ────────────────
        if (historyParam) {
            const blob   = container.getBlockBlobClient(historyParam);
            const exists = await blob.exists();
            if (!exists) return NextResponse.json({ error: 'Version not found' }, { status: 404 });
            const buf    = await blob.downloadToBuffer();
            return NextResponse.json({ exists: true, prompts: JSON.parse(buf.toString('utf-8')) });
        }

        // ── Default: fetch active-prompts.json ────────────────────────────────
        const blobClient = container.getBlockBlobClient(BLOB_NAME);
        const exists     = await blobClient.exists();
        if (!exists) return NextResponse.json({ exists: false, prompts: null });
        const download   = await blobClient.downloadToBuffer();
        return NextResponse.json({ exists: true, prompts: JSON.parse(download.toString('utf-8')) });

    } catch (err: any) {
        console.error('GET newsletter-prompts error:', err.message, err.stack?.split('\n')[1]);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — publish all prompts + save TWO type-specific history snapshots
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { weeklySystem, weeklyUser, puzzleSystem, puzzleUser, weeklyTemplate, puzzleTemplate, sectionTemplates, changedType } = body;

        if (!weeklySystem || !weeklyUser || !puzzleSystem || !puzzleUser) {
            return NextResponse.json({ error: 'All four prompt fields are required' }, { status: 400 });
        }

        const publishedAt = new Date().toISOString();
        const safeTs      = publishedAt.replace(/:/g, '-').replace(/\./g, '-');

        const fullPayload = JSON.stringify({
            weeklySystem, weeklyUser, puzzleSystem, puzzleUser,
            weeklyTemplate:   weeklyTemplate   || null,
            puzzleTemplate:   puzzleTemplate   || null,
            sectionTemplates: sectionTemplates || null,
            publishedAt,
        });

        const weeklyPayload = JSON.stringify({
            weeklySystem, weeklyUser, weeklyTemplate: weeklyTemplate || null, publishedAt,
        });

        const puzzlePayload = JSON.stringify({
            puzzleSystem, puzzleUser, puzzleTemplate: puzzleTemplate || null, publishedAt,
        });

        const container = getContainerClient();
        await container.createIfNotExists({ access: 'blob' });

        const upload = async (blobName: string, data: string) => {
            const blob = container.getBlockBlobClient(blobName);
            await blob.upload(Buffer.from(data), Buffer.byteLength(data), {
                blobHTTPHeaders: { blobContentType: 'application/json' },
                overwrite: true,
            } as any);
        };

        // 1. Overwrite active blob (full payload — pipeline always reads this)
        await upload(BLOB_NAME, fullPayload);

        // 2. Per-type history snapshots — only snapshot the type that was actually changed.
        //    changedType is sent by the frontend (the active tab: 'weekly' | 'puzzle').
        //    Fall back to saving both if changedType is missing (e.g. old client).
        const saveWeekly = !changedType || changedType === 'weekly';
        const savePuzzle = !changedType || changedType === 'puzzle';
        if (saveWeekly) await upload(`${HISTORY_DIR}/weekly/${safeTs}.json`, weeklyPayload);
        if (savePuzzle) await upload(`${HISTORY_DIR}/puzzle/${safeTs}.json`, puzzlePayload);

        return NextResponse.json({ success: true, publishedAt });
    } catch (err: any) {
        console.error('POST newsletter-prompts error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE — delete a specific history version blob
// ?history=history/weekly/2026-05-15T…json  or  history/puzzle/…
export async function DELETE(req: NextRequest) {
    try {
        const blobName = req.nextUrl.searchParams.get('history');
        if (!blobName ||
            (!blobName.startsWith(`${HISTORY_DIR}/weekly/`) &&
             !blobName.startsWith(`${HISTORY_DIR}/puzzle/`))) {
            return NextResponse.json({ error: 'Invalid or missing blob name' }, { status: 400 });
        }
        const container = getContainerClient();
        const blob      = container.getBlockBlobClient(blobName);
        if (!await blob.exists()) return NextResponse.json({ error: 'Version not found' }, { status: 404 });
        await blob.delete();
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('DELETE newsletter-prompts error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
