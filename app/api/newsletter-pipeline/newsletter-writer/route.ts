import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';
import { newsletterWriterTool } from '../tools/06-newsletterWriterTool';

export const maxDuration = 180; // 3 minutes timeout

async function loadBlobPrompts(): Promise<{ weeklySystem: string; weeklyUser: string }> {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    const container  = BlobServiceClient.fromConnectionString(connStr).getContainerClient('newsletter-prompts');
    const blob       = container.getBlockBlobClient('active-prompts.json');
    const exists     = await blob.exists();
    if (!exists) throw new Error('active-prompts.json not found in blob — publish prompts first');
    const data = JSON.parse((await blob.downloadToBuffer()).toString('utf-8'));
    if (!data.weeklySystem || !data.weeklyUser) throw new Error('active-prompts.json missing weeklySystem or weeklyUser');
    return {
        weeklySystem:   data.weeklySystem   as string,
        weeklyUser:     data.weeklyUser     as string,
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { analysis, news } = body;

        if (!analysis || !news) {
            return NextResponse.json({ 
                success: false, 
                error: 'Please provide valid analysis and news context structures.' 
            }, { status: 400 });
        }

        console.log('[newsletter-writer-api] Loading active prompts from Azure Blob...');
        const blobPrompts = await loadBlobPrompts();

        console.log('[newsletter-writer-api] Running newsletterWriterTool...');
        const result = await newsletterWriterTool(analysis, news, {
            systemPrompt: blobPrompts.weeklySystem,
            userTemplate: blobPrompts.weeklyUser
        });

        return NextResponse.json({ 
            success: true, 
            result,
            prompts: {
                system: blobPrompts.weeklySystem,
                userTemplate: blobPrompts.weeklyUser
            }
        });
    } catch (error: any) {
        console.error('[newsletter-writer-api] Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Failed to generate newsletter text' 
        }, { status: 500 });
    }
}
