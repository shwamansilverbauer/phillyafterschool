// A web page's visible text, as lines, for the scripts that read provider pages: the free pre-read (precheck.mjs)
// and the autopilot gate (gate.mjs). Scripts, styles and menus' markup are left out, one line per line of text,
// spaces tidied, a repeated line kept once, and copyright lines dropped, since the year turning over isn't a change.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™' };
export const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);

export function htmlText(html, opts = {}) {
  const s = html.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|head|select)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<(br|hr)\b[^>]*>|<\/(p|div|li|h[1-6]|tr|td|th|section|article|header|footer|nav|dt|dd|table|ul|ol|blockquote|figcaption|label|button|a)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return lines(decode(s), opts);
}

// One line per line of text. maxLines and maxChars cap how much is kept (the pre-read keeps 1,500 lines and 60,000
// characters; the gate, which searches for a quote, keeps much more).
export function lines(text, { maxLines = 1500, maxChars = 60000 } = {}) {
  const seen = new Set(), out = [];
  for (const raw of text.split('\n')) {
    const l = raw.replace(/\s+/g, ' ').trim();
    if (!l || l.length < 2 || seen.has(l)) continue;
    if (/^(©|\(c\)|copyright\b)/i.test(l) && l.length < 160) continue;
    seen.add(l); out.push(l);
    if (out.length >= maxLines) break;
  }
  let n = 0; return out.filter(l => (n += l.length) <= maxChars);
}

// Every link on a page, made absolute: href="…" and mailto: addresses.
export function htmlLinks(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const raw = decode((m[1] ?? m[2] ?? m[3] ?? '').trim());
    if (!raw || raw.startsWith('#') || /^javascript:/i.test(raw)) continue;
    try { out.add(new URL(raw, base).href); } catch { /* not a link */ }
  }
  return [...out];
}
