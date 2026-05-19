// ─────────────────────────────────────────────────────────────────────────────
// emailUtils.ts
// Thursday Weekly → pure token substitution from blob weeklyTemplate
// Tuesday Puzzle  → Purple header, MCQ option boxes, leaderboard
// ─────────────────────────────────────────────────────────────────────────────

// ── Parse all named tokens from raw AI output ─────────────────────────────────
export function parseNewsletter(raw: string) {
    // Initialize with defaults for core keys to ensure UI compatibility
    const results: Record<string, string> = {
        subject: '',
        preview: '',
        opening: '',
        section1_title: '',
        section1_body: '',
        survey_question: '',
        survey_opt1: '',
        survey_opt2: '',
        survey_opt3: '',
        survey_opt4: '',
        section2_title: '',
        section2_body: '',
        cta: '',
        section3_title: '',
        section3_body: '',
        takeaway1: '',
        takeaway2: '',
        takeaway3: '',
        source1: '',
        source2: '',
        body: '', // kept for puzzle compat
    };

    // Regex explanation:
    // (?:\n|^)          -> Matches newline or start of string
    // ([A-Z0-9_]{3,})   -> Strict: 3+ uppercase chars/numbers/underscores (no spaces)
    // \s*:\s*           -> Followed by a colon (with optional spacing)
    // ([\s\S]*?)        -> Captures everything lazily
    // (?=\n[A-Z0-9_]{3,}\s*:|$) -> Until the next valid strict label or end of string
    const regex = /(?:\n|^)([A-Z0-9_]{3,})\s*:\s*([\s\S]*?)(?=\n[A-Z0-9_]{3,}\s*:|$)/g;

    let match;
    while ((match = regex.exec(raw)) !== null) {
        // Trim, lower-case, and replace any spaces with underscores so tokens are standard
        const label = match[1].trim().toLowerCase().replace(/\s+/g, '_');
        const value = match[2].trim();
        results[label] = value;
    }

    return results;
}

// ── Branded SVG banner generator removed (we now use /api/generate-banner to upload PNGs) ──

// ── Weekly renderer — pure token substitution ────────────────────────────────
export function renderTemplate(
    template: string,
    parsed: Record<string, string>,
    type: 'weekly' | 'puzzle' = 'weekly',
    bannerUrl: string = ''
): string {
    const bannerSrc = bannerUrl || 'https://via.placeholder.com/1200x500.png?text=Vibe+Trader';
    const bannerTag = `<img src="${bannerSrc}" alt="${(parsed.subject || '').replace(/"/g, "'")}" style="display:block;width:100%;max-width:600px;height:auto;"/>`;
    const nl = (s: string) => s.replace(/\\n\\n/g, '<br><br>').replace(/\n\n/g, '<br><br>');

    // Start with the provided template (from Azure)
    let filled = template;

    // 1. Special handling for the banner
    filled = filled.split('{banner}').join(bannerTag);

    // 1.5 Handle virtual "list" tokens (e.g. {sources_list} replaces all SOURCE1, SOURCE2... items)
    const buildList = (prefix: string, formatter: (v: string) => string) => {
        return Object.entries(parsed)
            .filter(([k]) => k.startsWith(prefix))
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([_, v]) => formatter(v))
            .join('');
    };

    const sourcesHtml   = buildList('source',   v => `<li style="margin-bottom:8px;"><a href="${v}" target="_blank" style="color:#8a50db;text-decoration:underline;">${v}</a></li>`);
    const takeawaysHtml = buildList('takeaway', v => `<li style="margin-bottom:8px;">${v}</li>`);

    if (sourcesHtml)   filled = filled.split('{sources_list}').join(`<ul style="padding-left:20px;margin:10px 0;">${sourcesHtml}</ul>`);
    if (takeawaysHtml) filled = filled.split('{takeaways_list}').join(`<ul style="padding-left:20px;margin:10px 0;">${takeawaysHtml}</ul>`);

    // 2. Dynamically replace all tokens found in the parsed AI output
    // This supports {source1}, {source2}, {source3}... as long as they are in the template
    Object.entries(parsed).forEach(([key, value]) => {
        const token = `{${key}}`;
        filled = filled.split(token).join(nl(value));
    });

    const bg = '#fafafa';
    // Returning a clean div wrapper instead of a full <html> document.
    // This makes it 100% HubSpot compatible while keeping the professional preview.
    return `
<div style="background-color:${bg}; padding: 20px 0px; font-family: Helvetica, Arial, sans-serif;">
  <!-- Preheader text for email clients -->
  <div style="display:none;font-size:1px;color:${bg};max-height:0;overflow:hidden;">${parsed.preview || ''}&nbsp;</div>
  
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg};">
    <tr>
      <td align="center">
        ${filled}
      </td>
    </tr>
  </table>
</div>`;
}



// ── Tuesday Puzzle builder ────────────────────────────────────────────────────
function parsePuzzleBody(body: string) {
    const result = { setup: '', options: [] as {letter:string,text:string}[], leaderboard: '', replyHook: '' };
    const lines = body.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim().split('\n');
    const setupLines: string[] = [], postLines: string[] = [];
    let curLetter = '', curLines: string[] = [], inOpts = false;
    for (const raw of lines) {
        const s = raw.trim();
        const opt = s.match(/^(?:(?:\*\*|\*)?\s*(?:Option\s*)?)?([A-D])[\)\.\:]\s*(?:\*\*|\*)?\s*(.*)/i);
        if (opt) {
            if (curLetter) result.options.push({ letter: curLetter, text: curLines.join('\n').trim() });
            curLetter = opt[1].toUpperCase(); curLines = [opt[2]]; inOpts = true; continue;
        }
        if (curLetter && inOpts) {
            if (/^\[.+\]/.test(s) || /last week/i.test(s) || /reply with/i.test(s)) {
                result.options.push({ letter: curLetter, text: curLines.join('\n').trim() });
                curLetter = ''; inOpts = false; postLines.push(s);
            } else { curLines.push(s); }
            continue;
        }
        if (!inOpts) setupLines.push(s); else postLines.push(s);
    }
    if (curLetter) result.options.push({ letter: curLetter, text: curLines.join('\n').trim() });
    result.setup = setupLines.join('\n').trim();
    for (const l of postLines) {
        const s = l.trim(); if (!s) continue;
        if (/last week|first 3/i.test(s)) result.leaderboard = s;
        else if (/reply.*answer/i.test(s)) result.replyHook = s;
    }
    return result;
}

function puzzleOptionBox(letter: string, text: string, correctAnswer: string, explanation: string): string {
    const formatted = text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    const encodedExplanation = encodeURIComponent(explanation);
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;background:#eef0f6;border-radius:8px;" class="puzzle-option">
      <tr><td style="padding:12px;font-size:14px;color:#333;">${formatted}</td></tr>
      <tr><td align="center" style="padding:10px;">
        <a href="https://www.vibetrader.com/puzzle?option=${letter}&correct=${correctAnswer}&explanation=${encodedExplanation}" 
           onclick="if(typeof checkAnswer === 'function') { event.preventDefault(); checkAnswer(this, '${letter}', '${correctAnswer}'); }"
           style="background:#4b3fa0;color:#fff;text-decoration:none;padding:10px 20px;border-radius:20px;display:inline-block;font-weight:bold;">Select Option ${letter}</a>
      </td></tr>
    </table>`;
}

export function processPuzzleTokens(parsed: Record<string, string>): Record<string, string> {
    if (!parsed.body) return parsed;
    
    const correctAnswer = (parsed.answer || '').trim().toUpperCase();
    const explanation = parsed.explanation || '';
    
    const p = parsePuzzleBody(parsed.body);
    const setupHtml   = p.setup.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    const optionsHtml = p.options.map(o => puzzleOptionBox(o.letter, o.text, correctAnswer, explanation)).join('');
    const leaderHtml  = p.leaderboard ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D8C9F3;border-radius:6px;margin:15px 0;"><tr><td style="font-size:14px;padding:10px;">&#127942; Last Week's Winner</td></tr><tr><td style="font-size:13px;color:#555;padding:0 10px 10px;">${p.leaderboard}</td></tr></table>` : '';
    const replyHtml   = p.replyHook ? `<p style="font-size:14px;color:#333;margin:10px 0;">${p.replyHook}</p>` : '';

    return {
        ...parsed,
        setup: setupHtml,
        options: optionsHtml,
        leaderboard: leaderHtml,
        reply_hook: replyHtml
    };
}
