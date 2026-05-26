// ─────────────────────────────────────────────────────────────────────────────
// utils.ts — small helpers shared by page and components
// ─────────────────────────────────────────────────────────────────────────────
import { RedditPost } from '../constants';

/**
 * Converts an array of RedditPost objects into a plain-text block
 * that gets injected into the AI user prompt via {posts}.
 */
export function formatPosts(posts: RedditPost[]): string {
    return posts.map(p => {
        const src = p.subreddit ? ` (r/${p.subreddit})` : '';
        let text = `#${p.rank} [${p.flair}]${src} ${p.title}\n`;
        if (p.selftext && p.selftext.trim()) {
            const body = p.selftext.trim();
            const truncated = body.length > 800 ? body.slice(0, 800) + '...' : body;
            // Indent content lines slightly so they look nested under the title
            const indented = truncated.split('\n').map(line => `   ${line}`).join('\n');
            text += `${indented}\n`;
        }
        text += `   Upvotes: ${p.upvotes} | Comments: ${p.comments} | Posted: ${p.created_utc}\n` +
                `   URL: ${p.url}`;
        return text;
    }).join('\n\n');
}

// ── Template token lists ──────────────────────────────────────────────────────
// These are the {placeholder} names that can be inserted into the HTML template.
// They come from the AI output parsed by parseNewsletter() in emailUtils.ts.

export const WEEKLY_TOKENS = [
    '{banner}', '{subject}', '{preview}', '{opening}',
    '{section1_title}', '{section1_body}',
    '{survey_question}', '{survey_opt1}', '{survey_opt2}', '{survey_opt3}', '{survey_opt4}',
    '{section2_title}', '{section2_body}', '{cta}',
    '{section3_title}', '{section3_body}',
    '{takeaway1}', '{takeaway2}', '{takeaway3}',
    '{source1}', '{source2}',
];

export const PUZZLE_TOKENS = [
    '{subject}', '{preview}', '{setup}', '{options}', '{reply_hook}', '{leaderboard}',
];
