import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

const CONTAINER = 'newsletter-prompts';
const BLOB_NAME  = 'active-prompts.json';

function getBlobClient() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    const blobService = BlobServiceClient.fromConnectionString(connStr);
    return blobService.getContainerClient(CONTAINER).getBlockBlobClient(BLOB_NAME);
}

// GET — fetch current newsletter prompts (used by UI on load + Python pipeline)
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
        console.error('GET newsletter-prompts error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — publish prompts from the newsletter-tester UI
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { weeklySystem, weeklyUser, puzzleSystem, puzzleUser, weeklyTemplate, puzzleTemplate, sectionTemplates } = body;

        if (!weeklySystem || !weeklyUser || !puzzleSystem || !puzzleUser) {
            return NextResponse.json({ error: 'All four prompt fields are required' }, { status: 400 });
        }

        const payload = JSON.stringify({
            weeklySystem,
            weeklyUser,
            puzzleSystem,
            puzzleUser,
            weeklyTemplate:   weeklyTemplate   || null,
            puzzleTemplate:   puzzleTemplate   || null,
            sectionTemplates: sectionTemplates || null,
            publishedAt: new Date().toISOString(),
        });

        const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING!;
        const container = BlobServiceClient
            .fromConnectionString(connStr)
            .getContainerClient(CONTAINER);

        // Create container if it doesn't exist, with public blob access so Python can read
        await container.createIfNotExists({ access: 'blob' });

        const blobClient = container.getBlockBlobClient(BLOB_NAME);
        await blobClient.upload(Buffer.from(payload), Buffer.byteLength(payload), {
            blobHTTPHeaders: { blobContentType: 'application/json' },
            overwrite: true,
        } as any);

        return NextResponse.json({ success: true, publishedAt: new Date().toISOString() });
    } catch (err: any) {
        console.error('POST newsletter-prompts error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
