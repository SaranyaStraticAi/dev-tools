// Tool 6b — puzzleWriterTool
// Uses the PUZZLE_SYSTEM_PROMPT to write the Tuesday Puzzle.

import { callAI } from './base';
import { PUZZLE_SYSTEM_PROMPT, PUZZLE_USER_TEMPLATE } from './prompts';

export interface PuzzleWriterOptions {
    systemPrompt?: string;
    userTemplate?: string;
}

export interface PuzzleWriterResult {
    rawText: string;
    usedPosts: any[];
}

export async function puzzleWriterTool(
    posts: any[],
    options?: PuzzleWriterOptions
): Promise<PuzzleWriterResult> {
    const sys = options?.systemPrompt || PUZZLE_SYSTEM_PROMPT;
    const tmpl = options?.userTemplate || PUZZLE_USER_TEMPLATE;

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    // Format top 5 posts
    const formattedPosts = posts.slice(0, 5).map(p => 
        `[${p.subreddit} | ${p.upvotes} upvotes] ${p.title}\n${p.selftext}`
    ).join('\n\n');

    let userPrompt = tmpl
        .replace('{date}', today)
        .replace('{posts}', formattedPosts);

    console.log('[puzzleWriterTool] Calling AI...');
    const rawText = await callAI(sys, userPrompt, 0.7);

    return {
        rawText,
        usedPosts: posts.slice(0, 5)
    };
}
