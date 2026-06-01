/**
 * GET  /api/video-reel/prompts        — list all saved prompt configs
 * POST /api/video-reel/prompts        — save a new prompt config
 * PATCH /api/video-reel/prompts?id=x  — toggle recommended / update note
 * DELETE /api/video-reel/prompts?id=x — delete a saved config
 *
 * Storage: Azure Blob Storage, container "video-reel-prompts"
 * Each blob: "{id}.json"
 */

import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

const CONTAINER = 'video-reel-prompts';

function getClient() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');
  return BlobServiceClient.fromConnectionString(conn);
}

async function getContainer() {
  const client    = getClient();
  const container = client.getContainerClient(CONTAINER);
  await container.createIfNotExists();
  return container;
}

// ── GET — list all saved configs ─────────────────────────────────────────────

export async function GET() {
  try {
    const container = await getContainer();
    const configs: any[] = [];

    for await (const blob of container.listBlobsFlat()) {
      if (!blob.name.endsWith('.json')) continue;
      const blobClient = container.getBlobClient(blob.name);
      const download   = await blobClient.download();
      const text       = await streamToString(download.readableStreamBody!);
      configs.push(JSON.parse(text));
    }

    // Sort newest first, recommended first
    configs.sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    });

    return NextResponse.json(configs);
  } catch (err: any) {
    console.error('[video-reel/prompts GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST — save a new config ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, day, systemPrompt, notes, marketContext, savedBy, recommendNote } = body;

    if (!name || !day || !systemPrompt) {
      return NextResponse.json({ error: 'name, day and systemPrompt are required' }, { status: 400 });
    }

    const id     = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const config = {
      id,
      name:          name.trim(),
      day,
      systemPrompt,
      notes:         notes ?? '',
      marketContext: marketContext ?? '',
      savedBy:       (savedBy ?? 'Designer').trim(),
      savedAt:       new Date().toISOString(),
      recommended:   false,
      recommendNote: recommendNote ?? '',
    };

    const container  = await getContainer();
    const blobClient = container.getBlockBlobClient(`${id}.json`);
    const json       = JSON.stringify(config, null, 2);
    await blobClient.upload(json, Buffer.byteLength(json), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (err: any) {
    console.error('[video-reel/prompts POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── PATCH — toggle recommended + update note ──────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id               = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const body      = await req.json();
    const container = await getContainer();
    const blobName  = `${id}.json`;
    const blob      = container.getBlobClient(blobName);

    const download = await blob.download();
    const text     = await streamToString(download.readableStreamBody!);
    const config   = JSON.parse(text);

    // Apply patches
    if (typeof body.recommended   === 'boolean') config.recommended   = body.recommended;
    if (typeof body.recommendNote === 'string')  config.recommendNote = body.recommendNote;

    const blockBlob = container.getBlockBlobClient(blobName);
    const updated   = JSON.stringify(config, null, 2);
    await blockBlob.upload(updated, Buffer.byteLength(updated), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });

    return NextResponse.json(config);
  } catch (err: any) {
    console.error('[video-reel/prompts PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id               = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const container = await getContainer();
    await container.deleteBlob(`${id}.json`);
    return NextResponse.json({ deleted: id });
  } catch (err: any) {
    console.error('[video-reel/prompts DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}
