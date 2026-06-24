// app/api/twitter-poll-prompts/route.ts
// GET  → load saved prompts from Azure Blob
// POST → save prompts to Azure Blob (all team members share the same prompts)
//
// Blob: twitter-poll-prompts/active-prompts.json
// Shape: { twitterPollSystem, twitterPollUser, publishedAt, publishedBy? }

import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

export const dynamic = 'force-dynamic';

const CONTAINER = 'twitter-poll-prompts';
const BLOB_NAME = 'active-prompts.json';

function getContainerClient() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    return BlobServiceClient.fromConnectionString(connStr).getContainerClient(CONTAINER);
}

// ── GET — load active prompts ─────────────────────────────────────────────────
export async function GET() {
    try {
        const container  = getContainerClient();
        const blobClient = container.getBlockBlobClient(BLOB_NAME);
        const exists     = await blobClient.exists();
        if (!exists) return NextResponse.json({ exists: false, prompts: null });
        const buf = await blobClient.downloadToBuffer();
        return NextResponse.json({ exists: true, prompts: JSON.parse(buf.toString('utf-8')) });
    } catch (err: any) {
        console.error('[twitter-poll-prompts GET]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ── POST — save prompts to Blob ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const { twitterPollSystem, twitterPollUser, publishedBy } = await req.json();
        if (!twitterPollSystem || !twitterPollUser) {
            return NextResponse.json({ error: 'twitterPollSystem and twitterPollUser are required' }, { status: 400 });
        }

        const container = getContainerClient();
        await container.createIfNotExists({ access: 'blob' });

        const publishedAt = new Date().toISOString();
        const payload     = JSON.stringify({ twitterPollSystem, twitterPollUser, publishedAt, publishedBy: publishedBy ?? null });

        const blob = container.getBlockBlobClient(BLOB_NAME);
        await blob.upload(Buffer.from(payload), Buffer.byteLength(payload), {
            blobHTTPHeaders: { blobContentType: 'application/json' },
            overwrite: true,
        } as any);

        console.log('[twitter-poll-prompts] Saved prompts to Blob at', publishedAt);
        return NextResponse.json({ success: true, publishedAt });
    } catch (err: any) {
        console.error('[twitter-poll-prompts POST]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
