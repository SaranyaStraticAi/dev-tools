import { NextRequest, NextResponse } from 'next/server';
import { complianceReviewTool } from '../tools/07-complianceReviewTool';

export const maxDuration = 180; // 3 minutes timeout

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { draftText } = body;

        if (!draftText || typeof draftText !== 'string') {
            return NextResponse.json({ 
                success: false, 
                error: 'Please provide valid draftText.' 
            }, { status: 400 });
        }

        console.log('[compliance-review-api] Running complianceReviewTool...');
        const result = await complianceReviewTool(draftText);

        return NextResponse.json({ 
            success: true, 
            result
        });
    } catch (error: any) {
        console.error('[compliance-review-api] Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Failed to run compliance review' 
        }, { status: 500 });
    }
}
