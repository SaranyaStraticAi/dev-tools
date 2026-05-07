import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

const CONTAINER = 'vibe-prompts';
const BLOB_NAME  = 'active-prompts.json';

function getBlobClient() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    const blobService = BlobServiceClient.fromConnectionString(connStr);
    const container   = blobService.getContainerClient(CONTAINER);
    return container.getBlockBlobClient(BLOB_NAME);
}

// GET — fetch current prompts (used by Python job + UI on load)
export async function GET() {
    try {
        const blobClient = getBlobClient();
        const exists = await blobClient.exists();
        if (!exists) {
            return NextResponse.json({ exists: false, prompts: null });
        }
        const download = await blobClient.downloadToBuffer();
        const prompts  = JSON.parse(download.toString('utf-8'));
        return NextResponse.json({ exists: true, prompts });
    } catch (err: any) {
        console.error('GET prompt-config error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — publish prompts from dev-tools UI
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { cinematicSystem, cinematicUser, statsSystem, statsUser } = body;

        if (!cinematicSystem || !statsSystem) {
            return NextResponse.json({ error: 'Missing prompt fields' }, { status: 400 });
        }

        const payload = JSON.stringify({
            cinematicSystem,
            cinematicUser,
            statsSystem,
            statsUser,
            publishedAt: new Date().toISOString(),
        });

        const blobClient = getBlobClient();

        // Create container if it doesn't exist
        const container = BlobServiceClient
            .fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!)
            .getContainerClient(CONTAINER);
        await container.createIfNotExists({ access: 'blob' });

        await blobClient.upload(Buffer.from(payload), Buffer.byteLength(payload), {
            blobHTTPHeaders: { blobContentType: 'application/json' },
            overwrite: true,
        } as any);

        return NextResponse.json({ success: true, publishedAt: new Date().toISOString() });
    } catch (err: any) {
        console.error('POST prompt-config error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
