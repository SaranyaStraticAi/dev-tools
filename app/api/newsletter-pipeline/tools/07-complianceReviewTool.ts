// Tool 7 — complianceReviewTool
// Reviews and autocorrects the generated newsletter text for compliance guidelines.

import { callAI } from './base';
import { REVIEW_SYSTEM_PROMPT, REVIEW_USER_TEMPLATE } from './prompts';

export interface ComplianceReviewResult {
    passed: boolean;
    wordCount: number;
    flags: string[];
    fixedText: string;
}

export async function complianceReviewTool(
    draftText: string
): Promise<ComplianceReviewResult> {
    const userPrompt = REVIEW_USER_TEMPLATE.replace('{draft_text}', draftText);
    
    // Call AI with a low temperature for strict compliance checking
    const rawResponse = await callAI(REVIEW_SYSTEM_PROMPT, userPrompt, 0.2);
    
    try {
        // Find the JSON block in case the AI added markdown around it
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : rawResponse;
        
        const result = JSON.parse(jsonStr) as ComplianceReviewResult;
        
        // Ensure required fields exist
        if (typeof result.passed !== 'boolean') result.passed = false;
        if (!result.flags) result.flags = [];
        if (!result.fixedText) result.fixedText = draftText; // fallback
        if (typeof result.wordCount !== 'number') result.wordCount = 0;

        return result;
    } catch (e) {
        console.error('[complianceReviewTool] Error parsing JSON:', e, 'Raw:', rawResponse);
        // Fallback gracefully
        return {
            passed: false,
            wordCount: 0,
            flags: ['Failed to parse JSON response from LLM reviewer.'],
            fixedText: draftText
        };
    }
}
