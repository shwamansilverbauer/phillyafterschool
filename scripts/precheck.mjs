// The free pre-read before the monthly listing check. It reads every page the check would open, keeps each page's
// visible text, and says which pages are the same as when the listings that rest on them were last confirmed, so the
// paid check opens only the pages that changed, starting from the lines that changed.
//
//   node build.mjs && node scripts/precheck.mjs <folder>
//
// <folder> holds pages.json from the last run (the "precheck" branch, see .github/workflows/precheck.yml) and gets the
// new pages.json and report.json. Nothing here edits the site's data.
//
// Which pages: dist/data/check.json's "pages", "camps" and "weekend" lists, each read the way data/reading.json says
// it must be: a plain fetch, or a headless browser (Playwright's Chromium) for the pages marked "browser", which are
// JavaScript apps or have served an old copy to a plain fetch. Pages marked "person" block automated reading and are
// never requested. Like linkcheck.mjs, it honors robots.txt.
//
// What "the same" means: each page keeps up to four versions of its text (newest first, each with the first and last
// day it was seen). The listings' own dates say when the page was last confirmed (a program's lastVerified, a pickup
// list's "read", a camp's or weekend block's "checked"; the oldest of them when several listings share a page). The
// page is compared with the version it had on that day, so a change is still reported next month if this month's
// check was never merged. report.json sorts the pages into:
//   same        the text is what it was on the day it was last confirmed
//   sameSince   no version that old is kept yet; the text is unchanged since the oldest version kept ("since")
//   changed     different from that version: "added" and "removed" hold the lines that differ (order ignored)
//   new         read for the first time
//   thin        too little text to compare (under 15 lines): a JavaScript app's shell, a sign-in page, a bare form.
//               "The same" would mean nothing, so the check reads these as it always has
//   failed      no answer, or not a 200
//   closed      robots.txt asks automated readers to stay out
//   person      not requested: a person reads it (data/reading.json)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { robots as robotsFor, disallowed, UA_BASE } from './robots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.argv[2] || path.join(ROOT, '.precheck');
const UA = UA_BASE + ' PhillyAfterSchoolPreRead/1.0';
const TODAY = process.env.PRECHECK_TODAY || new Date().toISOString().slice(0, 10);   // the test sets the day
const MAX_LINES = 1500, MAX_CHARS = 60000, KEEP = 4, SHOW = 60, MIN_LINES = 15;

// The test points these at files of its own.
const check = JSON.parse(fs.readFileSync(process.env.PRECHECK_CHECK || path.join(ROOT, 'dist/data/check.json'), 'utf8'));
const programs = JSON.parse(fs.readFileSync(process.env.PRECHECK_PROGRAMS || path.join(ROOT, 'data/programs.json'), 'utf8'));
const byId = Object.fromEntries(programs.map(p => [p.id, p]));

// ----- every page, how to read it, which listings rest on it and when they were last confirmed -----
const pages = new Map();
const add = (url, how, who, confirmed) => {
  if (!/^https?:\/\//i.test(url || '')) return;
  const key = url.replace(/#.*$/, '');
  if (!pages.has(key)) pages.set(key, { url: key, how, who: [], dates: [] });
  const p = pages.get(key);
  if (how === 'person' || (how === 'browser' && p.how === 'fetch')) p.how = how;   // the strictest reading wins
  if (!p.who.includes(who)) p.who.push(who);
  if (confirmed) p.dates.push(confirmed);
};
for (const pg of check.pages || []) {
  for (const id of pg.programs || []) add(pg.url, pg.how, 'program ' + id, byId[id] && byId[id].lastVerified);
  for (const l of pg.lists || []) add(pg.url, pg.how, 'pickup list of ' + l.program, l.read);
}
for (const c of (check.camps && check.camps.list) || []) if (c.url) add(c.url, c.how || 'fetch', 'camp ' + c.camp, c.checked);
for (const w of check.weekend || []) if (w.url) add(w.url, w.how || 'fetch', 'weekend classes of ' + w.program, w.checked);
for (const p of pages.values()) p.confirmed = p.dates.length ? p.dates.sort()[0] : '';

// ----- a page's visible text, as lines -----
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
function htmlText(html) {
  const s = html.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|head|select)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<(br|hr)\b[^>]*>|<\/(p|div|li|h[1-6]|tr|td|th|section|article|header|footer|nav|dt|dd|table|ul|ol|blockquote|figcaption|label|button|a)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return lines(decode(s));
}
// One line per line of text, spaces tidied, the same line kept once, and the lines that change on their own every year
// or every day (copyright notices) left out, so they don't count as a change.
function lines(text) {
  const seen = new Set(), out = [];
  for (const raw of text.split('\n')) {
    const l = raw.replace(/\s+/g, ' ').trim();
    if (!l || l.length < 2 || seen.has(l)) continue;
    if (/^(©|\(c\)|copyright\b)/i.test(l) && l.length < 160) continue;
    seen.add(l); out.push(l);
    if (out.length >= MAX_LINES) break;
  }
  let n = 0; return out.filter(l => (n += l.length) <= MAX_CHARS);
}
const hash = ls => crypto.createHash('sha256').update(ls.join('\n')).digest('hex').slice(0, 16);

async function fetchPage(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  const type = r.headers.get('content-type') || '';
  const final = r.url && r.url !== url ? r.url : '';
  if (r.status !== 200) return { status: r.status, final };
  if (/pdf/.test(type)) { const buf = Buffer.from(await r.arrayBuffer()); return { status: 200, final, lines: ['(a PDF, compared by its bytes: ' + crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) + ')'] }; }
  return { status: 200, final, lines: htmlText(await r.text()) };
}
let browser = null;
async function browserPage(url) {
  if (!browser) {
    let pw; try { pw = await import('playwright'); } catch { return { status: 'error', note: 'Playwright is not installed here' }; }
    browser = await (pw.chromium || pw.default.chromium).launch();
  }
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();
  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});   // a JavaScript app fills in after load
    const status = r ? r.status() : 'error', final = page.url() !== url ? page.url() : '';
    if (status !== 200) return { status, final };
    return { status, final, lines: lines(await page.evaluate(() => document.body ? document.body.innerText : '')) };
  } finally { await ctx.close(); }
}

async function readOne(p) {
  if (p.how === 'person') return { status: 'person' };
  const u = new URL(p.url);
  if (disallowed(await robotsFor(u.origin, UA), u.pathname + u.search)) return { status: 'closed' };
  try { return p.how === 'browser' ? await browserPage(p.url) : await fetchPage(p.url); }
  catch (e) { return { status: 'error', note: String((e.cause && e.cause.code) || e.name || e.message).slice(0, 80) }; }
}

// ----- read them all: six plain fetches at a time, two browser pages at a time -----
// No page gets more than a minute, however it stalls (a script that never settles, a body that never ends), and
// the whole read stops starting pages after PRECHECK_MINUTES (25): what's left is reported as not read this time,
// and keeps the versions it had, so the job always finishes and always saves what it did read.
const before = (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'pages.json'), 'utf8')).pages || {}; } catch { return {}; } })();
const list = [...pages.values()];
const results = new Map();
const PAGE_MS = +process.env.PRECHECK_PAGE_MS || 60000, STOP_AT = Date.now() + (+process.env.PRECHECK_MINUTES || 25) * 60000;
const within = (work, ms, late) => { let t; return Promise.race([work.finally(() => clearTimeout(t)), new Promise(r => { t = setTimeout(() => r(late), ms); })]); };
let done = 0;
const pool = async (items, n) => { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) {
  const p = items[i++];
  results.set(p.url, Date.now() > STOP_AT ? { status: 'error', note: 'not read: the run was out of time' } : await within(readOne(p), PAGE_MS, { status: 'error', note: `no answer within ${PAGE_MS / 1000} seconds` }));
  if (++done % 25 === 0) console.log(`  read ${done} of ${list.length}`);
} })); };
console.log(`${list.length} pages to read: ${list.filter(p => p.how === 'fetch').length} by plain fetch, ${list.filter(p => p.how === 'browser').length} in a browser, ${list.filter(p => p.how === 'person').length} for a person.`);
await Promise.all([pool(list.filter(p => p.how !== 'browser'), 6), pool(list.filter(p => p.how === 'browser'), 2)]);
if (browser) await within(browser.close(), 20000, null);

// ----- compare, and keep the versions -----
const diff = (a, b) => { const A = new Set(a), B = new Set(b); return { added: b.filter(l => !A.has(l)).slice(0, SHOW), removed: a.filter(l => !B.has(l)).slice(0, SHOW), more: Math.max(0, b.filter(l => !A.has(l)).length - SHOW) + Math.max(0, a.filter(l => !B.has(l)).length - SHOW) }; };
const kept = {}, report = { ran: new Date().toISOString(), summary: {}, same: [], sameSince: [], changed: [], new: [], thin: [], failed: [], closed: [], person: [] };
for (const p of list) {
  const r = results.get(p.url) || { status: 'error' }, old = (before[p.url] && before[p.url].versions) || [];
  const row = { url: p.url, how: p.how, for: p.who, confirmed: p.confirmed || null };
  if (r.final) row.final = r.final;
  if (r.status === 'person' || r.status === 'closed') { report[r.status].push(row); if (old.length) kept[p.url] = before[p.url]; continue; }
  if (!r.lines) { report.failed.push({ ...row, status: r.status, ...(r.note ? { note: r.note } : {}) }); if (old.length) kept[p.url] = before[p.url]; continue; }
  const h = hash(r.lines);
  const versions = old.length && old[0].hash === h ? [{ ...old[0], last: TODAY, lines: r.lines }, ...old.slice(1)] : [{ hash: h, first: TODAY, last: TODAY, lines: r.lines }, ...old];
  kept[p.url] = { how: p.how, versions: versions.slice(0, KEEP) };
  if (r.lines.length < MIN_LINES) { report.thin.push({ ...row, lines: r.lines.length }); continue; }
  if (!old.length) { report.new.push(row); continue; }
  // the version the page had on the day its listings were last confirmed, or else the oldest one kept
  const then = (p.confirmed && old.find(v => v.first <= p.confirmed)) || null, base = then || old[old.length - 1];
  if (base.hash === h) { if (then) report.same.push(row); else report.sameSince.push({ ...row, since: base.first }); continue; }
  report.changed.push({ ...row, against: base.first, ...(then ? {} : { olderThanKept: true }), ...diff(base.lines || [], r.lines) });
}
for (const k of ['same', 'sameSince', 'changed', 'new', 'thin', 'failed', 'closed', 'person']) report.summary[k] = report[k].length;
report.summary.pages = list.length;
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(path.join(DIR, 'pages.json'), JSON.stringify({ read: TODAY, pages: kept }) + '\n');
fs.writeFileSync(path.join(DIR, 'report.json'), JSON.stringify(report, null, 1) + '\n');
const s = report.summary;
console.log(`${s.pages} pages: ${s.same} the same as when last confirmed, ${s.sameSince} unchanged since the oldest reading kept, ${s.changed} changed, ${s.new} read for the first time, ${s.thin} with too little text to compare, ${s.failed} didn't answer, ${s.closed} closed by robots.txt, ${s.person} for a person to read.`);
for (const c of report.changed) console.log(`  changed: ${c.url} (${c.for.join(', ')}): ${c.added.length + c.removed.length + c.more} lines`);
for (const f of report.failed) console.log(`  failed: ${f.url} ${f.status}${f.note ? ' ' + f.note : ''}`);
process.exit(0);   // a page that stalled past its minute may still hold the event loop open
