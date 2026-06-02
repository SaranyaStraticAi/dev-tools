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
        const { analysis, news, systemPrompt, userTemplate } = body;

        if (!analysis || !news) {
            return NextResponse.json({ 
                success: false, 
                error: 'Please provide valid analysis and news context structures.' 
            }, { status: 400 });
        }

        let activeSystem = systemPrompt;
        let activeUserTemplate = userTemplate;

        if (!activeSystem || !activeUserTemplate) {
            console.log('[newsletter-writer-api] Loading active prompts from Azure Blob...');
            try {
                const blobPrompts = await loadBlobPrompts();
                if (!activeSystem) activeSystem = blobPrompts.weeklySystem;
                if (!activeUserTemplate) activeUserTemplate = blobPrompts.weeklyUser;
            } catch (e: any) {
                console.warn('[newsletter-writer-api] Blob load failed, using local fallback:', e.message);
                const { WEEKLY_SYSTEM_PROMPT, WEEKLY_USER_TEMPLATE } = await import('../tools/prompts');
                if (!activeSystem) activeSystem = WEEKLY_SYSTEM_PROMPT;
                if (!activeUserTemplate) activeUserTemplate = WEEKLY_USER_TEMPLATE;
            }
        }

        console.log('[newsletter-writer-api] Running newsletterWriterTool...');
        const result = await newsletterWriterTool(analysis, news, {
            systemPrompt: activeSystem,
            userTemplate: activeUserTemplate
        });

        return NextResponse.json({ 
            success: true, 
            result,
            prompts: {
                system: activeSystem,
                userTemplate: activeUserTemplate
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
