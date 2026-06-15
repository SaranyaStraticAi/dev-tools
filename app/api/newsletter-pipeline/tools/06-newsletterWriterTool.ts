// Tool 6 — newsletterWriterTool
// Writes the Thursday newsletter using deep analysis + news context.
// System prompt and user template come from Azure Blob via the prompts parameter —
// NOT from hardcoded prompts.ts — so UI edits take effect immediately.

import { callAI } from './base';
import type { DeepAnalysisResult } from './04-redditDeepAnalysisTool';
import type { NewsContext } from './05-newsContextTool';

interface RedditPost {
    rank: number; subreddit?: string; title: string; selftext?: string;
    upvotes: number; comments: number; flair: string; url: string; created_utc: string;
}

export interface NewsletterWriterResult {
    rawText: string; usedPosts: RedditPost[]; attempt: number;
}

export type WeekType = 1 | 2 | 3 | 4;

export interface WriterPrompts {
    systemPrompt: string;
    userTemplate: string;
    weekType?: WeekType;
}

// ── Week-type override blocks injected at the top of the user prompt ──────────
// Each block overrides ONLY what changes for that week. Week 1 = default (empty).
const WEEK_OVERRIDES: Record<WeekType, string> = {
    1: '', // default behaviour — no override needed

    2: `═══════════════════════════════════════════════════
CONTENT TYPE: WEEK 2 — PAIN → MARKET INSIGHT
═══════════════════════════════════════════════════
This week is NOT a product-feature email. Strict overrides apply:

SECTION4 MUST be a market insight or educational framework — NOT a product feature description.
- Write 1–2 paragraphs of original, actionable insight that intellectually addresses the trader's dominant pain.
- Something the reader can apply to their thinking TODAY without needing any product or tool.
- End SECTION4_BODY with ONE soft sentence referencing Vibe Trader — nothing more.
- SECTION4_TITLE examples: "The Pattern Most Miss", "Why This Keeps Happening", "The Framework Behind It", "What the Data Actually Shows", "The Real Reason This Repeats"
- DO NOT use the PAIN-TO-FEATURE PRIORITY MAP. Do not name or describe any Vibe Trader feature in SECTION4.

CTA: Educational-oriented. Use one of: "Get the framework", "Learn the process", "Start here".
All other sections (OPENING, SECTION1, SECTION2, SECTION3) follow standard playbook rules.
═══════════════════════════════════════════════════

`,

    3: `═══════════════════════════════════════════════════
CONTENT TYPE: WEEK 3 — PRODUCT / FEATURE LAUNCH
═══════════════════════════════════════════════════
This week's newsletter spotlights a specific Vibe Trader feature as a launch or major announcement.

STRUCTURE OVERRIDE:
- OPENING: Trader's pain as the entry point — standard. No product mention yet.
- SECTION1: Why this pain is so persistent and what makes it hard to solve alone.
- SECTION2: Build anticipation — "this is exactly the problem [feature name] was built to solve." Create a bridge to the reveal.
- SECTION3: The future state — what changes for the trader when this pain is eliminated. Forward-looking.
- SECTION4: THE MAIN EVENT. Use the PAIN-TO-FEATURE PRIORITY MAP from DOCUMENT 4.
  Name the exact feature. Describe it in full: what it is, what it calculates or produces, how it works step by step.
  Make it feel like a meaningful announcement — not a footnote.
  SECTION4_TITLE: "Now Inside Vibe Trader" / "The Fix We Built" / "What We Just Shipped" / "Built for This Exact Problem"

CTA: Feature-specific action verb. Examples: "Try the Risk Engine", "See the Strategy Builder", "Access your backtest", "Use the AI analyst".
Tone: Slightly more energised than usual — this is a launch moment. Still no exclamation marks.
═══════════════════════════════════════════════════

`,

    4: `═══════════════════════════════════════════════════
CONTENT TYPE: WEEK 4 — COMMUNITY / DATA STORY
═══════════════════════════════════════════════════
This week leads with a community insight and data story — NOT a product pitch.

STRUCTURE OVERRIDE:
- OPENING: Trader's own voice, the shared pain — keep it human and relatable. Standard.
- SECTION1: Zoom out and frame this as a collective community pattern.
  Use phrases like "traders we hear from every week", "a pattern we keep seeing", "the data tells a clear story".
  Describe the trend authentically — do not invent specific numbers, but you may write "the majority of traders", "most of the positions we see", etc.
- SECTION2: Community response — how other traders are navigating this. What the ones who improved did differently. Human stories, not statistics.
- SECTION3: The lesson or shift — what the community is collectively moving toward. A mindset or approach change.
- SECTION4: A soft, brief Vibe Trader mention — 2 sentences maximum. Frame it as being part of the community, not a product pitch. Do NOT describe any feature in detail.
  SECTION4_TITLE: "What We're Seeing" / "The Community Verdict" / "What Traders Are Telling Us" / "The Shared Pattern"

CTA: Warm and low-pressure — "Join the conversation", "See how traders use it", "Start with us".
Tone for the whole email: Warmer and more human than usual. You are sharing insights with a peer, not selling anything.
═══════════════════════════════════════════════════

`,
};

function formatPosts(posts: RedditPost[]): string {
    return posts.map(p => {
        const src  = p.subreddit ? ` (r/${p.subreddit})` : '';
        let   text = `#${p.rank} [${p.flair}]${src} ${p.title}\n`;
        if (p.selftext?.trim()) {
            const body = p.selftext.trim();
            text += (body.length > 800 ? body.slice(0, 800) + '...' : body)
                .split('\n').map(l => `   ${l}`).join('\n') + '\n';
        }
        text += `   Upvotes: ${p.upvotes} | Comments: ${p.comments} | Posted: ${p.created_utc}\n   URL: ${p.url}`;
        return text;
    }).join('\n\n');
}

function toPost(p: any, rank: number): RedditPost {
    return {
        rank, subreddit: p.subreddit, title: p.title, selftext: p.selftext || '',
        upvotes: p.upvotes, comments: p.comments, flair: p.flair,
        url: p.url, created_utc: p.created_utc,
    };
}

export async function newsletterWriterTool(
    analysis: DeepAnalysisResult,
    news: NewsContext,
    prompts: WriterPrompts,
): Promise<NewsletterWriterResult> {
    const today = new Date().toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });

    const allPosts: RedditPost[] = [toPost(analysis.bestPost, 1)];
    analysis.supportingPosts.forEach((p, i) => allPosts.push(toPost(p, i + 2)));

    // Build external sources block — now includes actual article content from Tool 5 (v2)
    // Each article gets its title, URL, and the fetched body text so the AI writer
    // has real facts to work from, not just a headline it has to guess about.
    const externalSources = news.referenceLinks.length > 0
        ? news.referenceLinks.map((article, i) => {
            const lines = [
                `SOURCE ${i + 1}: ${article.title}`,
                `URL: ${article.url}`,
            ];
            if (article.content && article.content.trim().length > 50) {
                lines.push(`CONTENT:\n${article.content.trim()}`);
            }
            return lines.join('\n');
        }).join('\n\n---\n\n')
        : 'No external sources available this week.';

    const analysisContext = [
        `DEEP ANALYSIS (from reading all posts + comment threads):`,
        `• Dominant pain: ${analysis.dominantPainTheme}`,
        `• Emotional intensity: ${analysis.emotionalIntensity}`,
        `• Currency/event: ${analysis.currencyOrEvent}`,
        `• Key phrases: ${analysis.keyPhrases.slice(0, 8).map(p => `"${p}"`).join(', ')}`,
        `• Notes: ${analysis.analysisNotes}`,
        `\nANCHOR POST: "${analysis.bestPost.title}" (r/${analysis.bestPost.subreddit}, ${analysis.bestPost.upvotes} upvotes)`,
    ].join('\n');

    // Build user prompt from blob template
    const baseUserPrompt = prompts.userTemplate
        .replace('{date}', today)
        .replace('{analysis}', analysisContext)
        .replace('{anchor_post}', formatPosts([allPosts[0]]))
        .replace('{external_sources}', externalSources);

    // ── Inject week-type override at the TOP of the user prompt ───────────────
    // Week 1 override is empty (default behaviour). Weeks 2–4 prepend a block
    // that changes what SECTION4 should contain without touching the system prompt.
    const weekNum   = prompts.weekType ?? 1;
    const override  = WEEK_OVERRIDES[weekNum];
    const userPrompt = override ? `${override}${baseUserPrompt}` : baseUserPrompt;
    console.log(`[newsletterWriterTool] Week type: ${weekNum}${override ? ' (override injected)' : ' (default)'}`);

    // Attempt 1
    console.log('[newsletterWriterTool] Writing newsletter (attempt 1)...');
    let raw = await callAI(prompts.systemPrompt, userPrompt, 0.7);
    if (!raw.includes('ERROR: VALIDATION_FAILED')) {
        return { rawText: raw, usedPosts: allPosts, attempt: 1 };
    }

    // Attempt 2 — retry with stricter instruction
    console.warn('[newsletterWriterTool] Attempt 1 failed validation — retrying...');
    raw = await callAI(
        prompts.systemPrompt,
        userPrompt + '\n\nIMPORTANT: Previous attempt returned VALIDATION_FAILED. Only use whitelisted features in SECTION4_BODY.',
        0.5,
    );
    return { rawText: raw, usedPosts: allPosts, attempt: 2 };
}
