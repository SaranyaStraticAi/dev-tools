import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

const CONTAINER_NAME = 'newsletter-assets';

// Next.js 15/16: params is now a Promise and must be awaited
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;

  if (!filename) {
    return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
  }

  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('Azure Storage Connection String is missing');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blobClient = containerClient.getBlobClient(filename);

    const exists = await blobClient.exists();
    if (!exists) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const downloadResponse = await blobClient.download();

    const contentType = downloadResponse.contentType || 'image/png';

    const body = downloadResponse.readableStreamBody;
    if (!body) {
      throw new Error('Failed to read blob stream');
    }

    return new Response(body as any, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error: any) {
    console.error('Asset Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to fetch asset', detail: error.message }, { status: 500 });
  }
}
