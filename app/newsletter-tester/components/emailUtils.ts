// ─────────────────────────────────────────────────────────────────────────────
// emailUtils.ts
// Thursday Weekly → pure token substitution from blob weeklyTemplate
// Tuesday Puzzle  → Purple header, MCQ option boxes, leaderboard
// ─────────────────────────────────────────────────────────────────────────────

// ── Parse all named tokens from raw AI output ─────────────────────────────────
export function parseNewsletter(raw: string) {
    const get = (label: string) => {
        const m = raw.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
        return m ? m[1].trim() : '';
    };
    return {
        subject:         get('SUBJECT'),
        preview:         get('PREVIEW'),
        opening:         get('OPENING'),
        section1_title:  get('SECTION1_TITLE'),
        section1_body:   get('SECTION1_BODY'),
        survey_question: get('SURVEY_QUESTION'),
        survey_opt1:     get('SURVEY_OPT1'),
        survey_opt2:     get('SURVEY_OPT2'),
        survey_opt3:     get('SURVEY_OPT3'),
        survey_opt4:     get('SURVEY_OPT4'),
        section2_title:  get('SECTION2_TITLE'),
        section2_body:   get('SECTION2_BODY'),
        cta:             get('CTA'),
        section3_title:  get('SECTION3_TITLE'),
        section3_body:   get('SECTION3_BODY'),
        takeaway1:       get('TAKEAWAY1'),
        takeaway2:       get('TAKEAWAY2'),
        takeaway3:       get('TAKEAWAY3'),
        source1:         get('SOURCE1'),
        source2:         get('SOURCE2'),
        body: '', // kept for puzzle compat
    };
}

// ── Branded SVG banner ────────────────────────────────────────────────────────
export function generateHeroBannerDataUrl(subject: string): string {
    const words = subject.split(' ');
    let splitAt = Math.max(1, Math.round(words.length * 0.45));
    for (let i = Math.max(1, splitAt - 2); i < Math.min(words.length, splitAt + 3); i++) {
        if (words.slice(0, i).join(' ').length <= 42) splitAt = i;
        else break;
    }
    const line1 = words.slice(0, splitAt).join(' ');
    const line2 = words.slice(splitAt).join(' ');
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const l1 = esc(line1), l2 = esc(line2);
    const y1 = l2 ? '220' : '260';
    const btnY = l2 ? '340' : '320';
    const btnTY = String(parseInt(btnY) + 30);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500" viewBox="0 0 1200 500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#B8A4E8"/><stop offset="35%" stop-color="#C084E8"/>
      <stop offset="65%" stop-color="#D870C0"/><stop offset="100%" stop-color="#F472B6"/>
    </linearGradient>
    <radialGradient id="bp" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#7C3AED" stop-opacity="0.75"/><stop offset="100%" stop-color="#7C3AED" stop-opacity="0"/></radialGradient>
    <radialGradient id="bk" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#EC4899" stop-opacity="0.7"/><stop offset="100%" stop-color="#EC4899" stop-opacity="0"/></radialGradient>
    <radialGradient id="bb" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.65"/><stop offset="100%" stop-color="#8B5CF6" stop-opacity="0"/></radialGradient>
    <radialGradient id="ray" cx="30%" cy="50%" r="70%"><stop offset="0%" stop-color="rgba(255,255,255,0.18)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>
  </defs>
  <rect width="1200" height="500" fill="url(#bg)"/>
  <rect width="1200" height="500" fill="url(#ray)"/>
  <ellipse cx="-30" cy="420" rx="280" ry="260" fill="url(#bp)"/>
  <ellipse cx="1230" cy="-30" rx="300" ry="280" fill="url(#bk)"/>
  <ellipse cx="1100" cy="80" rx="220" ry="200" fill="url(#bb)" opacity="0.6"/>
  <ellipse cx="1250" cy="520" rx="240" ry="220" fill="url(#bk)" opacity="0.4"/>
  <text x="1045" y="58" font-family="Arial,sans-serif" font-size="22" font-weight="300" fill="rgba(255,255,255,0.95)">vibe</text>
  <text x="1094" y="56" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="white">&#x26A1;</text>
  <text x="1045" y="88" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="white">trader</text>
  <text x="80" y="${y1}" font-family="Arial,sans-serif" font-size="58" font-weight="300" fill="rgba(255,255,255,0.95)">${l1}</text>
  ${l2 ? `<text x="80" y="295" font-family="Arial,sans-serif" font-size="66" font-weight="800" fill="white">${l2}</text>` : ''}
  <rect x="80" y="${btnY}" width="262" height="52" rx="26" fill="rgba(45,20,90,0.88)"/>
  <text x="211" y="${btnTY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="white">Explore <tspan font-weight="700">Vibe Trader</tspan></text>
  <rect x="356" y="${btnY}" width="220" height="52" rx="26" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
  <text x="466" y="${btnTY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" fill="rgba(255,255,255,0.9)">vibetrader.com</text>
</svg>`;
    const b64 = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(svg))) : Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${b64}`;
}

// ── Weekly renderer — pure token substitution, no parsing logic ───────────────
// Template HTML comes entirely from the Azure blob (weeklyTemplate key).
// Designer edits HTML in dev-tools → Publish → Python pipeline uses same blob.
export function weeklyBodyToHtml(_body: string): string { return ''; } // legacy no-op

export function renderTemplate(
    template: string,
    parsed: ReturnType<typeof parseNewsletter>,
    type: 'weekly' | 'puzzle' = 'weekly'
): string {
    const bannerSrc = generateHeroBannerDataUrl(parsed.subject);
    const bannerTag = `<img src="${bannerSrc}" alt="${parsed.subject.replace(/"/g, "'")}" width="560" style="display:block;width:100%;max-width:560px;height:auto;"/>`;
    const nl = (s: string) => s.replace(/\\n\\n/g, '<br><br>').replace(/\n\n/g, '<br><br>');

    const filled = template
        .replace(/\{banner\}/g,          bannerTag)
        .replace(/\{subject\}/g,         parsed.subject)
        .replace(/\{preview\}/g,         parsed.preview)
        .replace(/\{opening\}/g,         nl(parsed.opening))
        .replace(/\{section1_title\}/g,  parsed.section1_title)
        .replace(/\{section1_body\}/g,   nl(parsed.section1_body))
        .replace(/\{survey_question\}/g, parsed.survey_question)
        .replace(/\{survey_opt1\}/g,     parsed.survey_opt1)
        .replace(/\{survey_opt2\}/g,     parsed.survey_opt2)
        .replace(/\{survey_opt3\}/g,     parsed.survey_opt3)
        .replace(/\{survey_opt4\}/g,     parsed.survey_opt4)
        .replace(/\{section2_title\}/g,  parsed.section2_title)
        .replace(/\{section2_body\}/g,   nl(parsed.section2_body))
        .replace(/\{cta\}/g,             parsed.cta)
        .replace(/\{section3_title\}/g,  parsed.section3_title)
        .replace(/\{section3_body\}/g,   nl(parsed.section3_body))
        .replace(/\{takeaway1\}/g,       parsed.takeaway1)
        .replace(/\{takeaway2\}/g,       parsed.takeaway2)
        .replace(/\{takeaway3\}/g,       parsed.takeaway3)
        .replace(/\{source1\}/g,         parsed.source1)
        .replace(/\{source2\}/g,         parsed.source2);

    const bg = '#fafafa';
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${parsed.subject}</title>
<style>body{margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;background:${bg};}table{border-spacing:0;border-collapse:collapse;}img{outline:none;text-decoration:none;border:none;}p{margin:0 0 10px 0;}a{color:#8a50db;text-decoration:underline;}</style>
</head>
<body style="margin:0;padding:0;background:${bg};">
<div style="display:none;font-size:1px;color:${bg};max-height:0;overflow:hidden;">${parsed.preview}&nbsp;</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};">
  <tr><td align="center" style="padding:20px 10px;">${filled}</td></tr>
</table>
</body></html>`;
}

// ── Tuesday Puzzle builder ────────────────────────────────────────────────────
function parsePuzzleBody(body: string) {
    const result = { setup: '', options: [] as {letter:string,text:string}[], leaderboard: '', replyHook: '' };
    const lines = body.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim().split('\n');
    const setupLines: string[] = [], postLines: string[] = [];
    let curLetter = '', curLines: string[] = [], inOpts = false;
    for (const raw of lines) {
        const s = raw.trim();
        const opt = s.match(/^([A-D])\)\s*(.*)/);
        if (opt) {
            if (curLetter) result.options.push({ letter: curLetter, text: curLines.join('\n').trim() });
            curLetter = opt[1]; curLines = [opt[2]]; inOpts = true; continue;
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

function puzzleOptionBox(letter: string, text: string): string {
    const formatted = text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;background:#eef0f6;border-radius:8px;">
      <tr><td style="padding:12px;font-size:14px;color:#333;">${formatted}</td></tr>
      <tr><td align="center" style="padding:10px;">
        <a href="https://www.vibetrader.com/puzzle?option=${letter}" style="background:#4b3fa0;color:#fff;text-decoration:none;padding:10px 20px;border-radius:20px;display:inline-block;font-weight:bold;">Select Option ${letter}</a>
      </td></tr>
    </table>`;
}

export function buildEmailHtml(subject: string, preview: string, body: string, type: 'weekly'|'puzzle'): string {
    if (type !== 'puzzle') throw new Error('Weekly must use renderTemplate() with blob template');
    const p = parsePuzzleBody(body);
    const setupHtml   = p.setup.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    const optionsHtml = p.options.map(o => puzzleOptionBox(o.letter, o.text)).join('');
    const leaderHtml  = p.leaderboard ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D8C9F3;border-radius:6px;margin:15px 0;"><tr><td style="font-size:14px;padding:10px;">&#127942; Last Week's Winner</td></tr><tr><td style="font-size:13px;color:#555;padding:0 10px 10px;">${p.leaderboard}</td></tr></table>` : '';
    const replyHtml   = p.replyHook ? `<p style="font-size:14px;color:#333;margin:10px 0;">${p.replyHook}</p>` : '';
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject}</title>
<style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;}table{border-spacing:0;border-collapse:collapse;}p{margin:0 0 10px 0;}</style>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;">
<div style="display:none;font-size:1px;color:#f5f5f5;max-height:0;overflow:hidden;">${preview}&nbsp;</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
  <tr><td align="center" style="padding:20px 10px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #ccc;border-radius:6px;">
      <tr><td style="background:#4b3fa0;color:#fff;text-align:center;padding:16px;font-size:20px;font-weight:bold;border-radius:6px 6px 0 0;">Your Weekly Market Challenge</td></tr>
      <tr><td style="padding:20px;">
        <p style="font-size:16px;font-weight:bold;color:#000;margin-bottom:14px;">${subject}</p>
        <p style="font-size:13px;font-weight:bold;margin-bottom:10px;color:#000;">THE SETUP</p>
        <p style="font-size:15px;line-height:1.6;color:#333;">${setupHtml}</p>
        <p style="font-size:13px;font-weight:bold;margin-top:20px;margin-bottom:8px;color:#000;">THE QUESTION</p>
        <p style="font-size:15px;line-height:1.6;color:#333;">Based on the setup above, which read is most accurate — and what should you do next?</p>
        ${optionsHtml}${replyHtml}
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr><td align="center"><a href="https://www.vibetrader.com/" style="border:2px solid #4b3fa0;color:#4b3fa0;text-decoration:none;padding:10px 24px;border-radius:25px;display:inline-block;font-weight:bold;font-size:14px;">Explore Vibe Trader</a></td></tr>
        </table>
        ${leaderHtml}
        <p style="font-size:14px;font-weight:bold;color:#5b3fa0;margin:15px 0;">Expert Tip: Discover the one mistake that causes 80% of traders to blow their accounts — even when their analysis is spot-on.</p>
        <p style="font-size:14px;color:#333;margin:15px 0;">Good luck solving the puzzle,<br><strong>&#8211; Vibe Trader</strong></p>
        <hr style="border:none;border-top:1px solid #ddd;margin:15px 0;">
        <p style="font-size:11px;color:#777;line-height:1.6;">&#9888; <strong>Disclaimer:</strong> Vibe Trader, Inc provides AI-powered tools for educational and informational purposes only. We do not offer financial, legal, or investment advice. Trading involves risk. Past performance is not indicative of future results.</p>
        <p style="font-size:12px;color:#333;margin-top:6px;"><strong>Contact us:</strong> <a href="mailto:team@vibetrader.com" style="color:#4b3fa0;text-decoration:none;">team@vibetrader.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
