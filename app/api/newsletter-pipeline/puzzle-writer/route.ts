import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';
import { puzzleWriterTool } from '../tools/06b-puzzleWriterTool';
import { PUZZLE_SYSTEM_PROMPT, PUZZLE_USER_TEMPLATE } from '../tools/prompts';

export const maxDuration = 180; // 3 minutes timeout

async function loadBlobPrompts(): Promise<{ puzzleSystem: string; puzzleUser: string }> {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    const container  = BlobServiceClient.fromConnectionString(connStr).getContainerClient('newsletter-prompts');
    const blob       = container.getBlockBlobClient('active-prompts.json');
    const exists     = await blob.exists();
    if (!exists) throw new Error('active-prompts.json not found in blob — publish prompts first');
    const data = JSON.parse((await blob.downloadToBuffer()).toString('utf-8'));
    if (!data.puzzleSystem || !data.puzzleUser) throw new Error('active-prompts.json missing puzzleSystem or puzzleUser');
    return {
        puzzleSystem:   data.puzzleSystem   as string,
        puzzleUser:     data.puzzleUser     as string,
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { posts, systemPrompt, userTemplate } = body;

        if (!posts || !Array.isArray(posts)) {
            return NextResponse.json({ 
                success: false, 
                error: 'Please provide a valid array of Reddit posts.' 
            }, { status: 400 });
        }

        let activeSystem = systemPrompt;
        let activeUserTemplate = userTemplate;

        if (!activeSystem || !activeUserTemplate) {
            console.log('[puzzle-writer-api] Loading active prompts from Azure Blob...');
            try {
                const blobPrompts = await loadBlobPrompts();
                if (!activeSystem) activeSystem = blobPrompts.puzzleSystem;
                if (!activeUserTemplate) activeUserTemplate = blobPrompts.puzzleUser;
            } catch (e: any) {
                console.warn('[puzzle-writer-api] Azure Blob prompt load failed, using local defaults:', e.message);
                if (!activeSystem) activeSystem = PUZZLE_SYSTEM_PROMPT;
                if (!activeUserTemplate) activeUserTemplate = PUZZLE_USER_TEMPLATE;
            }
        }

        console.log('[puzzle-writer-api] Running puzzleWriterTool...');
        const result = await puzzleWriterTool(posts, {
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
        console.error('[puzzle-writer-api] Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Failed to generate puzzle text' 
        }, { status: 500 });
    }
}
