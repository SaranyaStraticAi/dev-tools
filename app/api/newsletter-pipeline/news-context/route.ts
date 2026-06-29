import { NextRequest, NextResponse } from 'next/server';
import { newsContextTool } from '../tools/05-newsContextTool';

export const maxDuration = 180; // 3 minutes timeout

export async function POST(req: NextRequest) {
    try {
        const { currencyOrEvent } = await req.json().catch(() => ({ currencyOrEvent: '' }));

        if (!currencyOrEvent || typeof currencyOrEvent !== 'string' || currencyOrEvent.trim().length === 0) {
            return NextResponse.json({ 
                success: false, 
                error: 'Please provide a valid search query or asset/event name.' 
            }, { status: 400 });
        }

        console.log(`[news-context-api] Running newsContextTool for query: "${currencyOrEvent}"...`);
        
        // Mock a DeepAnalysisResult since newsContextTool only needs currencyOrEvent
        const mockAnalysisResult: any = {
            currencyOrEvent: currencyOrEvent.trim(),
            dominantPainTheme: '',
            emotionalIntensity: '',
            keyPhrases: [],
            bestPost: null,
            supportingPosts: [],
            analysisNotes: ''
        };

        const result = await newsContextTool(mockAnalysisResult);

        return NextResponse.json({ 
            success: true, 
            news: result
        });
    } catch (error: any) {
        console.error('[news-context-api] Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Failed to fetch news context' 
        }, { status: 500 });
    }
}
