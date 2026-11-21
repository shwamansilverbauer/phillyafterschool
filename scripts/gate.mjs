// The autopilot gate: decides whether a research run's pull request can publish on its own, by checking every
// changed value against a quote re-read on the provider's own page. See docs/listings.md, "The autopilot gate".
//
//   node scripts/gate.mjs --local [--base origin/main] [--json] [--draft]
//       In a run's own session, before it opens a pull request: the working tree's data against main. Prints what
//       would publish and what is held, by listing, so held listings can go to a second pull request. Exit code 1
//       when anything is held. --draft adds a record to the evidence file for every changed value that has none,
//       with the path, old and new values filled in and the source and quote left for the run to fill.
//   node scripts/gate.mjs --pr <n> --stage <dir>
//   node scripts/gate.mjs --pr <n> --judge <dir> --tests passed|failed|skipped [--post]
//       In .github/workflows/autopilot.yml: --stage copies main's code and the pull request's allowlisted data
//       into <dir> (nothing else from the pull request is copied, and nothing from it is run); the workflow builds
//       and tests there; --judge runs the checks, writes <dir>/verdict.json and <dir>/comment.md, and with --post
//       comments on the pull request, labels it needs-josh when something is held, and, only when
//       data/autopilot.json on main says "on", squash-merges the exact commit it checked and starts the publish.
//   node scripts/gate.mjs --replay <from> [--out <file>] [--only 10,12]
//       The checks on pull requests that were already decided (merged or closed), from number <from> on. Ones with
//       no evidence file get evidence built from each listing's stored sources and pickup lists where the page
//       still shows the new value; the report says what share could be verified.
//   node scripts/gate.mjs --report [--with-replay <file>] [--out <file>]
//       The shadow report: for each run's pull request, what the gate said beside what Josh did, and whether the
//       test for switching autopilot on has been passed.
//
// Settings: scripts/gate.config.json. The switch: data/autopilot.json. Tests: tests/cases/06-gate.mjs, with a
// stand-in for the provider sites, GitHub and the domain registry (GATE_TEST_ORIGIN, GATE_API, GATE_TODAY).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { robots as robotsFor, disallowed, UA_BASE } from './robots.mjs';
import { htmlText, lines as linesOf, htmlLinks } from './page-text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/gate.config.json'), 'utf8'));
const UA = UA_BASE + ' PhillyAfterSchoolGate/1.0';
const API = (process.env.GATE_API || 'https://api.github.com').replace(/\/$/, '');
const REPO = process.env.GATE_REPO || process.env.GITHUB_REPOSITORY || 'shwamansilverbauer/phillyafterschool';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const TODAY = process.env.GATE_TODAY || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const MARK = 'pas-gate';
// Tests only: every outside page, robots.txt and the registry are asked of this stand-in instead, with the real host
// in an x-test-host header (tests/cases/06-gate.mjs).
const TEST_ORIGIN = (process.env.GATE_TEST_ORIGIN || '').replace(/\/$/, '');
const BOOK = new Set(CFG.bookkeeping);
const ALL_SCHOOLS = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/all-schools.json'), 'utf8')).schools || []; } catch { return []; } })();
const KINDS = ['update', 'new-listing', 'new-school', 'link', 'date', 'note', 'told', 'review', 'news'];
const OUTCOMES = ['published', 'held', 'declined', 'duplicate', 'needs-info', 'no-change'];
const HOWS = ['fetch', 'browser', 'person'];
const STRICT = { fetch: 0, browser: 1, person: 2 };

// ---------------------------------------------------------------- small helpers
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const sortKeys = v => Array.isArray(v) ? v.map(sortKeys) : isObj(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v;
const stripBook = v => Array.isArray(v) ? v.map(stripBook) : isObj(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => !BOOK.has(k)).map(([k, x]) => [k, stripBook(x)])) : v;
const canon = v => JSON.stringify(sortKeys(v === undefined ? null : v));
const same = (a, b) => canon(a) === canon(b);
const sameish = (a, b) => canon(stripBook(a ?? null)) === canon(stripBook(b ?? null));   // ignoring bookkeeping dates
const short = v => { if (v === undefined || v === null) return '(nothing)'; if (typeof v === 'string') return `“${v.length > 80 ? v.slice(0, 77) + '…' : v}”`; const s = JSON.stringify(v); return s.length > 80 ? s.slice(0, 77) + '…' : s; };
const isUrl = s => typeof s === 'string' && /^https?:\/\/\S+$/i.test(s.trim());
const isEmail = s => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s.trim());
const hostOf = u => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const regDomain = h => { const p = h.split('.'); if (p.length <= 2) return h; return p[p.length - 1].length === 2 && ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'].includes(p[p.length - 2]) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
const inHosts = (h, list) => !!h && list.some(x => h === x || h.endsWith('.' + x));
const isShared = h => inHosts(h, CFG.sharedHosts);
const normUrl = u => { try { const x = new URL(String(u).trim()); x.hash = ''; return x.href.replace(/^http:/, 'https:').replace('://www.', '://').replace(/\/$/, ''); } catch { return String(u || ''); } };
// Is a page on a listing's own website? The same registrable domain, or, where the website sits on a shared host
// (a Google site, a Sawyer page), under the website's own address.
const onSite = (url, website) => { if (!isUrl(url) || !isUrl(website)) return false; const h = hostOf(website); return isShared(h) ? normUrl(url).startsWith(normUrl(website)) : regDomain(hostOf(url)) === regDomain(h); };
const lastSeg = p => p.replace(/\[[^\]]*\]/g, '[]').split('.').pop();
const isBook = p => p === 'id' || (p !== '' && !p.endsWith(']') && BOOK.has(lastSeg(p)));   // a record's own id is its name, not a value
const join = (p, k) => p ? p + '.' + k : String(k);
const isAncestor = (a, b) => a === '' ? b !== '' : b.startsWith(a + '.') || b.startsWith(a + '[');
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const addMonths = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined; };
const git = (a, cwd = ROOT) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 512e6, stdio: ['ignore', 'pipe', 'pipe'] });
const gitShow = (ref, file, cwd = ROOT) => { try { return git(['show', `${ref}:${file}`], cwd); } catch { return null; } };
const parse = t => { if (t === null || t === undefined) return null; try { return JSON.parse(t); } catch { return undefined; } };

// ---------------------------------------------------------------- numbers, times, prices and dates in a text
// Every value's numbers must be found in its quote. Times and amounts are compared as plain numbers ("6:00 pm" and
// "6pm" are both 6; "$1,190.00" is 1190); dates by month and day, and by year when both sides give one.
const MONTH = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const numKey = s => { let x = String(s).replace(/,/g, ''); if (/\./.test(x)) x = x.replace(/0+$/, '').replace(/\.$/, ''); x = x.replace(/^0+(?=\d)/, ''); return 'n:' + x; };
export function tokens(text) {
  let t = String(text);
  const out = [];
  const take = (re, fn) => { t = t.replace(re, (...m) => { const pos = m[m.length - 2]; const r = fn(m); if (r) for (const x of [].concat(r)) out.push({ ...x, pos, end: pos + m[0].length }); return ' '.repeat(m[0].length); }); };
  take(/\b(20\d\d)-(\d\d)-(\d\d)\b/g, m => ({ k: 'date', date: { y: +m[1], m: +m[2], d: +m[3] } }));
  take(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(20\\d\\d)\\b)?`, 'gi'), m => ({ k: 'date', date: { y: m[3] ? +m[3] : null, m: MONTH[m[1].slice(0, 3).toLowerCase()], d: +m[2] } }));
  take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/g, m => +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31 ? { k: 'date', date: { y: m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null, m: +m[1], d: +m[2] } } : null);
  take(/\bnoon\b/gi, () => ({ k: 'n:12' }));
  take(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/gi, m => ({ k: 'n:' + (+m[1]) + (m[2] && m[2] !== '00' ? ':' + m[2] : '') }));
  take(/\b(\d{1,2}):(\d{2})\b/g, m => ({ k: 'n:' + (+m[1]) + (m[2] !== '00' ? ':' + m[2] : '') }));
  take(/\$\s?(\d[\d,]*)(?:\.(\d{1,2}))?/g, m => ({ k: numKey(m[1].replace(/,/g, '') + (m[2] && +m[2] ? '.' + m[2] : '')) }));
  take(/\b(\d[\d,]*(?:\.\d+)?)(?:st|nd|rd|th)?\b/g, m => ({ k: numKey(m[1]) }));
  return out.sort((a, b) => a.pos - b.pos);
}
// The numbers of a stored value (a string, a number, or a whole record), leaving out bookkeeping dates, links,
// email addresses and the words-only fields.
const SKIP_KEYS = new Set(['id', 'how', 'by', 'relation', 'types', 'tags', 'match', 'program']);
function valueTokens(v, key = '') {
  if (v === undefined || v === null || BOOK.has(key) || SKIP_KEYS.has(key)) return [];
  if (typeof v === 'number') return [{ k: numKey(v), alt: v > 0 && v < 1 ? numKey(Math.round(v * 1000) / 10) : null }];
  if (typeof v === 'string') return isUrl(v) || isEmail(v) ? [] : tokens(v);
  if (Array.isArray(v)) return v.flatMap(x => valueTokens(x, key));
  if (isObj(v)) return Object.entries(v).flatMap(([k, x]) => valueTokens(x, k));
  return [];
}
const tokId = t => t.k === 'date' ? `date:${t.date.y || ''}-${t.date.m}-${t.date.d}` : t.k;
function newTokens(oldV, newV) {
  const had = valueTokens(oldV);
  const seen = new Set(had.map(tokId)), hadDates = had.filter(t => t.k === 'date');
  const out = new Map();
  for (const t of valueTokens(newV)) {
    if (seen.has(tokId(t))) continue;
    if (t.k === 'date' && hadDates.some(d => d.date.m === t.date.m && d.date.d === t.date.d && (!d.date.y || !t.date.y || d.date.y === t.date.y))) continue;
    out.set(tokId(t), t);
  }
  return [...out.values()];
}
const tokenIn = (t, qs) => t.k === 'date'
  ? qs.some(q => q.k === 'date' && q.date.m === t.date.m && q.date.d === t.date.d && (!q.date.y || !t.date.y || q.date.y === t.date.y))
  : qs.some(q => q.k === t.k || (t.alt && q.k === t.alt));
const showTok = t => t.k === 'date' ? `${t.date.y ? t.date.y + '-' : ''}${String(t.date.m).padStart(2, '0')}-${String(t.date.d).padStart(2, '0')}` : t.k.slice(2);

// Text compared for a quote: lower case, accents and punctuation gone, one space between words.
export const norm = s => ' ' + String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';

// ---------------------------------------------------------------- the data, as records
// Each allowlisted file becomes a map of records, each with a key the evidence file uses as "listing":
// p:<program id>, s:<school id>, c:<camp id>, d:<school id> (its dates), n:<date>|<title> (What's new),
// r:<review>, geo:<address>, reading:<match>, and <file>:* for a file's own top-level fields.
const FILEKEY = { 'data/programs.json': 'p', 'data/schools.json': 's', 'data/camps.json': 'c', 'data/school-dates.json': 'd', 'data/news.json': 'n', 'data/reviews.json': 'r', 'data/geo.json': 'geo', 'data/reading.json': 'reading' };
function recordsOf(file, data) {
  const m = new Map();
  if (data === null || data === undefined) return m;
  const add = (k, v) => { let key = k, n = 1; while (m.has(key)) key = `${k}#${++n}`; m.set(key, v); };
  const rest = (obj, skip) => { const o = Object.fromEntries(Object.entries(obj).filter(([k]) => k !== skip)); if (Object.keys(o).length) m.set(path.basename(file, '.json') + ':*', o); };
  switch (FILEKEY[file]) {
    case 'p': case 's': for (const r of data) add(`${FILEKEY[file]}:${r.id}`, r); break;
    case 'c': for (const r of data.camps || []) add(`c:${r.id}`, r); rest(data, 'camps'); break;
    case 'd': for (const [id, v] of Object.entries(data.schools || {})) add(`d:${id}`, v); rest(data, 'schools'); break;
    case 'n': for (const r of data) add(`n:${r.date}|${r.title}`, r); break;
    case 'r': for (const r of data) add(`r:${r.id || r.program || ''}|${r.date || ''}|${r.name || ''}`, r); break;
    case 'geo': for (const [a, v] of Object.entries(data.places || {})) add(`geo:${a}`, v); rest(data, 'places'); break;
    case 'reading': for (const r of data) add(`reading:${r.match}`, r); break;
  }
  return m;
}

// ---------------------------------------------------------------- what changed, value by value
// Objects are compared key by key. A list of objects is compared element by element when every element has a key
// field (id, date, url, name, day, on or match): its path is written list[key], e.g. register.dates[2027-01-15] or
// sources[https://example.org/camp]; a repeated key gets #2, #3. Any other list is one value.
const KEYS = ['id', 'date', 'url', 'name', 'day', 'on', 'match'];
const keyField = els => els.length && els.every(isObj) ? KEYS.find(f => els.every(e => typeof e[f] === 'string' && e[f])) || null : null;
const keyed = (arr, f) => { const m = new Map(); for (const e of arr) { let k = e[f], n = 1; while (m.has(k)) k = `${e[f]}#${++n}`; m.set(k, e); } return m; };
function diffValue(p, a, b, out) {
  if (same(a, b)) return;
  if (isObj(a) && isObj(b)) { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffValue(join(p, k), a[k], b[k], out); return; }
  if (Array.isArray(a) && Array.isArray(b)) {
    const f = keyField([...a, ...b]);
    if (f) { const A = keyed(a, f), B = keyed(b, f); for (const k of new Set([...A.keys(), ...B.keys()])) diffValue(`${p}[${k}]`, A.get(k), B.get(k), out); return; }
  }
  if (!isBook(p)) out.push({ path: p, old: a, new: b });
}
// The value at a path in a record.
function splitPath(p) { const out = []; let i = 0, cur = ''; while (i < p.length) { const c = p[i]; if (c === '.') { if (cur) out.push({ k: cur }); cur = ''; i++; } else if (c === '[') { if (cur) out.push({ k: cur }); cur = ''; const j = p.indexOf(']', i); out.push({ idx: p.slice(i + 1, j) }); i = j + 1; } else { cur += c; i++; } } if (cur) out.push({ k: cur }); return out; }
function at(rec, p) {
  let v = rec;
  for (const s of splitPath(p)) {
    if (v === undefined || v === null) return undefined;
    if (s.k !== undefined) v = isObj(v) ? v[s.k] : undefined;
    else { if (!Array.isArray(v)) return undefined; const f = keyField(v); v = f ? keyed(v, f).get(s.idx) : undefined; }
  }
  return v;
}
// A change to a whole subtree, split into the changes to its parts.
function expand(ch) {
  const a = ch.old, b = ch.new;
  if ((isObj(a) || a === undefined || a === null) && (isObj(b) || b === undefined || b === null) && (isObj(a) || isObj(b))) {
    const out = []; diffValue(ch.path, isObj(a) ? a : {}, isObj(b) ? b : {}, out); return out;   // [] when only bookkeeping dates differ
  }
  if ((Array.isArray(a) || a == null) && (Array.isArray(b) || b == null) && (Array.isArray(a) || Array.isArray(b))) {
    const f = keyField([...(a || []), ...(b || [])]); if (!f) return null;
    const out = []; diffValue(ch.path, a || [], b || [], out); return out;
  }
  return null;
}

// ---------------------------------------------------------------- reading a page
const readingRules = list => (list || []).map(r => ({ match: String(r.match || '').toLowerCase(), how: r.how }));
const ruleHow = (url, rules) => { const u = String(url).toLowerCase().replace(/^https?:\/\/(www\.)?/, ''); let how = 'fetch'; for (const r of rules) if (r.match && u.startsWith(r.match.replace(/^www\./, '')) && STRICT[r.how] > STRICT[how]) how = r.how; return how; };
const limiter = n => { let active = 0; const q = []; const next = () => { if (active >= n || !q.length) return; active++; const { fn, res, rej } = q.shift(); fn().then(res, rej).finally(() => { active--; next(); }); }; return fn => new Promise((res, rej) => { q.push({ fn, res, rej }); next(); }); };
const fetchSlot = limiter(6), browserSlot = limiter(2);
const pages = new Map();
let browser = null;
const hiddenRes = CFG.hiddenInstructions.map(s => new RegExp(s, 'i'));
const hidden = text => { const t = String(text).replace(/\s+/g, ' '); for (const re of hiddenRes) { const m = re.exec(t); if (m) return m[0]; } return ''; };

function get(url, opts = {}) {
  const u = new URL(url);
  if (!TEST_ORIGIN || /^(127\.0\.0\.1|localhost)$/.test(u.hostname)) return fetch(url, opts);
  return fetch(TEST_ORIGIN + u.pathname + u.search, { ...opts, headers: { ...(opts.headers || {}), 'x-test-host': u.hostname } });
}
const finalOf = (r, asked) => TEST_ORIGIN && r.url.startsWith(TEST_ORIGIN) ? new URL(asked).origin + r.url.slice(TEST_ORIGIN.length) : r.url;
async function fetchText(url) {
  const r = await get(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  const type = r.headers.get('content-type') || '', final = finalOf(r, url);
  if (r.status !== 200) { r.body?.cancel?.().catch(() => {}); return { ok: false, why: `it answered ${r.status}`, final }; }
  if (/pdf/i.test(type)) { r.body?.cancel?.().catch(() => {}); return { ok: false, why: 'pdf', final }; }
  const html = (await r.text()).slice(0, 5e6);
  return { ok: true, final, lines: htmlText(html, { maxLines: 20000, maxChars: 600000 }), links: htmlLinks(html, final) };
}
async function browserText(url) {
  if (!browser) {
    let pw; try { pw = await import('playwright'); } catch { return { ok: false, why: 'nobrowser' }; }
    browser = await (pw.chromium || pw.default.chromium).launch();
  }
  const ctx = await browser.newContext({ userAgent: UA }); const page = await ctx.newPage();
  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    if (!r || r.status() !== 200) return { ok: false, why: `it answered ${r ? r.status() : 'nothing'}`, final: page.url() };
    if (/pdf/i.test(r.headers()['content-type'] || '')) return { ok: false, why: 'pdf' };
    const text = await page.evaluate(() => document.body ? document.body.innerText : '');
    const links = await page.$$eval('a[href]', as => as.map(a => a.href)).catch(() => []);
    return { ok: true, final: page.url(), lines: linesOf(text, { maxLines: 20000, maxChars: 600000 }), links };
  } finally { await ctx.close(); }
}
// Read a page once, however many records lean on it. how: fetch, browser or person.
function readPage(url, how) {
  const key = how + ' ' + normUrl(url);
  if (pages.has(key)) return pages.get(key);
  const p = (async () => {
    if (!isUrl(url)) return { ok: false, why: 'not a web address' };
    if (how === 'person') return { ok: false, why: 'person' };
    if (/\.pdf($|\?)/i.test(new URL(url).pathname) || /drive\.google\.com\/file\//i.test(url)) return { ok: false, why: 'pdf' };
    const u = new URL(url);
    if (disallowed(await robotsFor(u.origin, UA, get), u.pathname + u.search)) return { ok: false, why: 'closed' };
    try {
      const r = how === 'browser' ? await browserSlot(() => browserText(url)) : await fetchSlot(() => fetchText(url));
      if (r.ok) { r.joined = r.lines.join('\n'); r.normed = norm(r.joined); r.hidden = hidden(r.joined); }
      return r;
    } catch (e) { return { ok: false, why: 'it did not answer (' + String((e.cause && e.cause.code) || e.name || e.message).slice(0, 60) + ')' }; }
  })();
  pages.set(key, p);
  return p;
}
const whyText = (why, host) => ({
  person: `${host} can only be read by a person (data/reading.json), so the gate can't check it`,
  pdf: `${host} is a PDF or a file viewer, which the gate can't read yet`,
  closed: `robots.txt on ${host} asks automated readers to stay out`,
  nobrowser: `${host} has to be read in a browser (data/reading.json), and there is no browser here`,
}[why] || `${host} couldn't be read: ${why}`);
// How old a domain is, from the registry (RDAP). null when it can't be told.
const ages = new Map();
function domainYears(domain) {
  if (!ages.has(domain)) ages.set(domain, (async () => {
    try {
      const r = await get(CFG.newListing.rdap + encodeURIComponent(domain), { headers: { accept: 'application/rdap+json, application/json', 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (!r.ok) return null;
      const j = await r.json();
      const reg = (j.events || []).find(e => /registration/i.test(e.eventAction || ''));
      return reg ? daysBetween(reg.eventDate.slice(0, 10), TODAY) / 365.25 : null;
    } catch { return null; }
  })());
  return ages.get(domain);
}

// ---------------------------------------------------------------- the evidence file
function readEvidence(text, branch) {
  const errors = [], records = [];
  if (text === null || text === undefined) return { missing: true, errors, records, items: [] };
  const ev = parse(text);
  if (!isObj(ev)) return { errors: ['it is not valid JSON'], records, items: [] };
  if (typeof ev.run !== 'string' || !ev.run) errors.push('"run" is missing');
  if (!Array.isArray(ev.items)) { errors.push('"items" is not a list'); return { errors, records, items: [] }; }
  ev.items.forEach((it, i) => {
    const where = `item ${i + 1}${it && it.item ? ` (${it.item})` : ''}`;
    if (!isObj(it)) { errors.push(`${where} is not an object`); return; }
    if (typeof it.item !== 'string' || !it.item) errors.push(`${where} has no "item"`);
    if (!KINDS.includes(it.kind)) errors.push(`${where}: "kind" must be one of ${KINDS.join(', ')}`);
    if (!OUTCOMES.includes(it.outcome)) errors.push(`${where}: "outcome" must be one of ${OUTCOMES.join(', ')}`);
    const fields = it.fields === undefined ? [] : it.fields;
    if (!Array.isArray(fields)) { errors.push(`${where}: "fields" is not a list`); return; }
    if (fields.length && (typeof it.listing !== 'string' || !it.listing)) errors.push(`${where} changes values but names no "listing"`);
    fields.forEach((f, j) => {
      const w = `${where}, field ${j + 1}${f && f.path !== undefined ? ` (${f.path})` : ''}`;
      if (!isObj(f) || typeof f.path !== 'string') { errors.push(`${w} has no "path"`); return; }
      if (!('old' in f) || !('new' in f)) errors.push(`${w} needs both "old" and "new" (null for nothing)`);
      if (!isUrl(f.source)) errors.push(`${w}: "source" is not a web address`);
      if (typeof f.quote !== 'string') errors.push(`${w}: "quote" is missing`);
      else if (f.quote.length > CFG.quoteMax) errors.push(`${w}: the quote is ${f.quote.length} characters; ${CFG.quoteMax} at most`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.read || '')) errors.push(`${w}: "read" is not a date`);
      if (!HOWS.includes(f.how)) errors.push(`${w}: "how" must be fetch, browser or person`);
      records.push({ item: it.item, kind: it.kind, outcome: it.outcome, listing: it.listing, path: f.path, old: f.old ?? null, new: f.new ?? null, source: f.source, quote: typeof f.quote === 'string' ? f.quote : '', read: f.read, how: HOWS.includes(f.how) ? f.how : 'fetch' });
    });
  });
  return { errors, records, items: ev.items, run: ev.run };
}

// ---------------------------------------------------------------- the checks
// before/after: { '<file>': parsed data or null }. changed: every path the pull request changes.
export async function judge({ before, after, changed, evidenceText, branch, tests = 'skipped', buildCheck = true, mainReading = null }) {
  const whole = [], notes = [];
  const items = new Map();
  const item = (key, b, a) => {
    if (!items.has(key)) items.set(key, { key, label: labelOf(key, b, a, after, before), kind: !b ? 'new' : !a ? 'remove' : 'change', changes: [], held: [], checked: 0 });
    return items.get(key);
  };
  const evPath = CFG.evidenceDir + branch + '.json';

  // 1. Paths: only allowlisted files and the run's one evidence file.
  for (const f of changed) {
    if (CFG.allow.includes(f) || f === evPath) continue;
    if (f.startsWith(CFG.evidenceDir)) whole.push(`It changes ${f}. A run writes one evidence file, ${evPath}, and no other.`);
    else whole.push(`It changes ${f}, which is not a data file the autopilot may change.`);
  }
  for (const f of CFG.allow) if (after[f] === undefined && changed.includes(f)) whole.push(`${f} is not valid JSON.`);

  // 2. What changed, record by record.
  const recs = {};   // key -> { before, after }
  for (const f of CFG.allow) {
    if (!changed.includes(f)) continue;
    const B = recordsOf(f, before[f]), A = recordsOf(f, after[f] || null);
    for (const k of new Set([...B.keys(), ...A.keys()])) {
      const b = B.get(k), a = A.get(k);
      if (same(b, a)) continue;
      const list = [];
      if (!b || !a) list.push({ path: '', old: b, new: a });
      else diffValue('', b, a, list);
      if (!list.length) continue;   // only bookkeeping dates moved
      recs[k] = { before: b, after: a, file: f };
      item(k, b, a).changes.push(...list);
    }
  }
  if (!items.size && !whole.length) return finish({ whole, notes, items, tests, branch, nothing: true });

  // 3. The evidence file.
  const ev = readEvidence(evidenceText, branch);
  if (ev.missing && items.size) whole.push(`There is no evidence file (${evPath}), so no change can be checked.`);
  else if (ev.errors.length) whole.push(`The evidence file isn't in the expected shape: ${ev.errors.slice(0, 6).join('; ')}${ev.errors.length > 6 ? `; and ${ev.errors.length - 6} more` : ''}.`);
  const byListing = new Map();
  for (const r of ev.records) { if (!byListing.has(r.listing)) byListing.set(r.listing, []); byListing.get(r.listing).push(r); }
  for (const r of ev.records) { const h = hidden(r.quote); if (h) { const it = items.get(r.listing); (it ? it.held : whole).push(`A quote in the evidence has text that seems to talk to an AI or asks to skip a rule (“${h}”).`); } }

  const rules = [...readingRules(mainReading || before['data/reading.json']), ...readingRules(after['data/reading.json'])];
  const schoolsAfter = after['data/schools.json'] || before['data/schools.json'] || [];
  const schoolHosts = new Set(schoolsAfter.map(s => hostOf(s.website)).filter(Boolean));
  const isSchoolSite = u => schoolHosts.has(hostOf(u)) || inHosts(hostOf(u), CFG.districtHosts);
  const isCity = u => inHosts(hostOf(u), CFG.cityHosts);
  const allUrls = v => { const out = new Set(); const walk = x => { if (typeof x === 'string') { if (isUrl(x)) out.add(normUrl(x)); } else if (Array.isArray(x)) x.forEach(walk); else if (isObj(x)) Object.values(x).forEach(walk); }; walk(v); return out; };

  // 4. Each record's own rules, and the evidence for each of its changes.
  await Promise.all([...items.values()].map(async it => {
    const { key } = it, r = recs[key], b = r.before, a = r.after;
    const type = key.split(':')[0];
    // Files with rules of their own, where no quote is needed or none can exist.
    if (type === 'r') { it.held.push(...reviewReasons(b, a)); return; }
    if (type === 'n') { it.held.push('What’s new is written in the site’s own words, with no provider page to check it against, so Josh reads it first.'); return; }
    if (type === 'geo') { if (b || !Array.isArray(a) || !(a[0] > 39.8 && a[0] < 40.2 && a[1] > -75.35 && a[1] < -74.9)) it.held.push(b ? 'It moves or removes a place on the map that was already there.' : 'The new place on the map is not in Philadelphia.'); return; }
    if (type === 'reading') { if (!a) it.held.push('It takes a page out of data/reading.json, so the page would be trusted to a plain fetch again.'); else if (!['browser', 'person'].includes(a.how)) it.held.push(`"how" for ${a.match} must be browser or person.`); else if (b && STRICT[a.how] < STRICT[b.how]) it.held.push(`It loosens how ${a.match} is read (${b.how} to ${a.how}).`); return; }
    if (key.endsWith(':*')) { const bad = it.changes.filter(c => !(key === 'camps:*' && /^(todo|dropped)/.test(c.path))); if (bad.length) it.held.push(`It changes ${bad.map(c => c.path || 'the file').join(', ')} at the top of the file, which a run doesn't do.`); return; }
    if (!a) { it.held.push(type === 'd' ? 'It removes a school’s dates.' : `It removes ${it.label}. A run never removes a ${({ p: 'program', s: 'school', c: 'camp' })[type]}; a closed one waits for Josh.`); return; }
    if (b && a.id !== undefined && b.id !== a.id) it.held.push('It changes an id.');

    const list = byListing.get(key) || [];
    const site = type === 'd' ? (schoolsAfter.find(s => s.id === key.slice(2)) || {}).website : a.website;
    const known = allUrls(b);
    const sourceOk = u => type === 's' ? onSite(u, a.website) || (b && onSite(u, b.website)) || isCity(u) || inHosts(hostOf(u), CFG.districtHosts)
      : type === 'd' ? (site && (hostOf(u) === hostOf(site) || onSite(u, site))) || inHosts(hostOf(u), CFG.districtHosts) || isCity(u)
        : onSite(u, a.website) || (b && onSite(u, b.website)) || known.has(normUrl(u)) || isSchoolSite(u) || isCity(u);

    // Coverage: every change has a record with the same path, old and new value, or one for a part of the
    // record that holds it, or records for each of its own parts.
    const groups = [], missing = [], sourceEntries = [];
    const SRC_ENTRY = /(^|\.)sources\[[^\]]*\](\.(label|url))?$/;
    const cover = ch => {
      if (SRC_ENTRY.test(ch.path)) { sourceEntries.push(ch); return; }   // where a fact came from: checked as a link, below
      const exact = list.filter(x => x.path === ch.path && sameish(x.old, ch.old) && sameish(x.new, ch.new));
      if (exact.length) { groups.push({ path: ch.path, old: ch.old, new: ch.new, records: exact }); return; }
      const anc = list.filter(x => isAncestor(x.path, ch.path) && sameish(x.old, at(b, x.path)) && sameish(x.new, at(a, x.path)));
      if (anc.length) { const p = anc.map(x => x.path).sort((m, n) => n.length - m.length)[0]; if (!groups.some(g => g.path === p)) groups.push({ path: p, old: at(b, p), new: at(a, p), records: anc.filter(x => x.path === p) }); return; }
      const kids = expand(ch);
      if (kids) kids.forEach(cover); else missing.push(ch);
    };
    it.changes.forEach(cover);
    // A source added must be an allowed page that opens; one taken away must be dead, or lead to the one added.
    const entryUrl = v => isObj(v) ? v.url : typeof v === 'string' && isUrl(v) ? v : null;
    const added = sourceEntries.filter(c => c.old === undefined || c.old === null).map(c => entryUrl(c.new)).filter(Boolean);
    for (const c of sourceEntries) {
      const nu = entryUrl(c.new), ou = entryUrl(c.old);
      if (nu && nu !== ou) {
        if (!sourceOk(nu)) it.held.push(`The new source ${hostOf(nu)} isn't the ${type === 's' ? 'school’s' : 'program’s'} own site, a school’s site or the City’s listing.`);
        else { const pg = await readPage(nu, ruleHow(nu, rules)); if (!pg.ok && !['person', 'pdf', 'closed', 'nobrowser'].includes(pg.why)) it.held.push(`The new source ${nu} doesn’t open (${pg.why}).`); }
      }
      if (ou && !nu) {
        const pg = await readPage(ou, 'fetch');
        const leadsOn = pg.final && added.some(u => normUrl(u) === normUrl(pg.final));
        if (pg.ok && !leadsOn) it.held.push(`It takes away a source that still opens (${ou}).`);
      }
    }
    for (const m of missing.slice(0, 8)) it.held.push(list.some(x => x.path === m.path) ? `The evidence for ${m.path || 'the new record'} doesn't match the data: it should say ${short(m.old)} to ${short(m.new)}.` : `No evidence for ${m.path || 'the new record'} (${short(m.old)} to ${short(m.new)}).`);
    if (missing.length > 8) it.held.push(`And ${missing.length - 8} more changes with no evidence.`);
    if (list.some(x => x.kind === 'told')) it.held.push('It writes in what the program told us. The gate can’t see the message itself until the private queue arrives (Phase 2), so Josh reads it.');

    // Each record: an allowed source, a page that can be read, the quote on it.
    for (const g of groups) {
      g.found = [];
      await Promise.all(g.records.map(async x => {
        const host = hostOf(x.source) || x.source;
        if (!sourceOk(x.source)) { it.held.push(`${host} isn't ${type === 's' || type === 'd' ? 'the school’s own site' : 'the program’s own site'}, a school’s site or the City’s listing (${g.path || 'new record'}).`); return; }
        const how = [x.how, ruleHow(x.source, rules)].sort((m, n) => STRICT[n] - STRICT[m])[0];
        const pg = await readPage(x.source, how);
        if (!pg.ok) { it.held.push(whyText(pg.why, host) + ` (${g.path || 'new record'}).`); return; }
        if (pg.hidden) it.held.push(`The page at ${host} has text that seems to talk to an AI or asks to skip a rule (“${pg.hidden}”).`);
        g.page = g.page || pg;
        if (!x.quote.trim()) { g.found.push({ x, pg, quote: '' }); return; }
        if (!pg.normed.includes(norm(x.quote))) { it.held.push(`The quote for ${g.path || 'the new record'} isn't on ${host}.`); return; }
        g.found.push({ x, pg, quote: x.quote });
      }));
      if (!g.found.length) continue;
      it.checked++;
      const qt = g.found.flatMap(f => tokens(f.quote));
      // An update note's own date is a label for the day it was written, not a fact from the page.
      const label = v => /^updates\[[^\]]*\]$/.test(g.path) && isObj(v) ? { ...v, date: undefined } : /^updates\[[^\]]*\]\.date$/.test(g.path) ? undefined : v;
      const need = newTokens(label(g.old), label(g.new));
      const lacking = need.filter(t => !tokenIn(t, qt));
      if (lacking.length) it.held.push(`The quote for ${g.path || 'the new record'} doesn't have ${lacking.map(showTok).join(', ')} in it.`);
      // A value with words but no quote at all.
      const words = (typeof g.new === 'string' && !isUrl(g.new) && !isEmail(g.new)) || isObj(g.new) || (Array.isArray(g.new) && g.new.some(v => typeof v === 'string' && !isUrl(v)));
      if (words && !g.found.some(f => f.quote)) it.held.push(`There is no quote for ${g.path || 'the new record'}.`);
      // New links: on the program's own site, already in the listing, linked from the page read, or where the old link now leads.
      const oldUrls = allUrls(g.old);
      for (const u of allUrls(g.new)) {
        if (oldUrls.has(u) || known.has(u)) continue;
        if (g.found.some(f => normUrl(f.x.source) === u || normUrl(f.pg.final || '') === u || (f.pg.links || []).some(l => normUrl(l) === u))) continue;
        if (onSite(u, a.website) || (/sources\[/.test(g.path + '[') && sourceOk(u))) {   // a page on the program's own site, or an allowed source: it must open
          const pg = await readPage(u, ruleHow(u, rules));
          if (!pg.ok && !['person', 'pdf', 'closed', 'nobrowser'].includes(pg.why)) it.held.push(`The new link ${u} doesn’t open (${pg.why}).`);
          continue;
        }
        let moved = false;
        for (const o of oldUrls) { const pg = await readPage(o, 'fetch'); if (pg.ok && normUrl(pg.final || '') === u) moved = true; }
        if (!moved) it.held.push(`The new link ${u} isn't on the page read, and isn't where the old link now leads.`);
      }
      // New email addresses: on the page, and not a personal-looking one.
      for (const e of new Set(JSON.stringify(g.new ?? null).match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [])) {
        if ((JSON.stringify(g.old ?? null).toLowerCase()).includes(e.toLowerCase())) continue;
        if (CFG.freeMail.includes(e.split('@')[1].toLowerCase())) it.held.push(`The new email address is at ${e.split('@')[1]}, which can be a person’s own address.`);
        if (!g.found.some(f => f.pg.joined.toLowerCase().includes(e.toLowerCase()) || (f.pg.links || []).some(l => l.toLowerCase() === 'mailto:' + e.toLowerCase()))) it.held.push(`The new email address isn't on the page read.`);
      }
    }

    // The table of what waits for Josh.
    await holdRules(it, { type, b, a, groups, after, before, schoolsAfter, isSchoolSite, isCity, site });
  }));

  // 5. The run as a whole: its size, the build's notes, the tests.
  const pre = Object.keys(CFG.limits).find(p => branch.startsWith(p));
  const lim = pre ? CFG.limits[pre] : null;
  if (lim) {
    const listings = [...items.keys()].filter(k => /^[pc]:/.test(k)).length;
    const schools = [...items.values()].filter(i => i.key.startsWith('s:') && i.kind === 'new').length;
    const values = [...items.values()].reduce((n, i) => n + i.changes.length, 0);
    if (lim.listings && listings > lim.listings) whole.push(`It changes ${listings} listings; a ${pre.replace(/-$/, '')} run may change ${lim.listings} at most.`);
    if (lim.schools && schools > lim.schools) whole.push(`It adds ${schools} schools; a schools run may add ${lim.schools} at most.`);
    if (lim.values && values > lim.values) whole.push(`It changes ${values} values; a monthly check may change ${lim.values} at most.`);
  }
  if (buildCheck) {
    const [nb, na] = [buildNotes(before), buildNotes(after)];
    if (!na.ok) whole.push(`The build stops with this data: ${na.error}`);
    else if (nb.ok) {
      const had = new Set(nb.notes);
      for (const n of na.notes.filter(x => !had.has(x))) {
        const hit = [...items.values()].filter(i => { const id = i.key.split(':').slice(1).join(':'); return (id && n.includes(id)) || (i.label && n.includes(i.label)); });
        if (hit.length) hit.forEach(i => i.held.push(`The build has a new note: ${n}`)); else whole.push(`The build has a new note: ${n}`);
      }
    }
  }
  if (tests === 'failed') whole.push('A test fails with this data.');
  return finish({ whole, notes, items, tests, branch, buildCheck, evidence: ev });
}

// The rows of "What waits for Josh" that a pull request's data can show.
async function holdRules(it, { type, b, a, groups, after, before, schoolsAfter, isSchoolSite, isCity }) {
  const ch = it.changes;
  const found = groups.flatMap(g => (g.found || []).map(f => ({ ...f, path: g.path })));
  const quotesFor = p => found.filter(f => f.path === p || isAncestor(f.path, p) || isAncestor(p, f.path)).map(f => f.quote).join(' ');
  const flat = []; const walk = c => { const k = expand(c); if (k) k.forEach(walk); else flat.push(c); }; ch.forEach(walk);
  const schoolNames = id => { const s = schoolsAfter.find(x => x.id === id) || (before['data/schools.json'] || []).find(x => x.id === id); return s ? [s.name, s.shortName, ...(s.aliases || [])].filter(Boolean) : [id]; };

  // What the program told us wins over its site; a question for its managers waits until claims can be told apart.
  if (type === 'p' && b) {
    const told = (b.told || []).flatMap(t => (t.fields || []).map(f => ({ f, on: t.on })));
    for (const c of flat) {
      if (c.path.startsWith('told') || c.path.startsWith('asks')) continue;
      const t = told.find(x => c.path === x.f || isAncestor(x.f, c.path) || isAncestor(c.path, x.f));
      if (t) it.held.push(`It changes ${c.path}, which the program itself told us on ${t.on}. A disagreement becomes a question to its managers, never an overwrite.`);
    }
    for (const c of ch) {
      if (/^told(\[|$)/.test(c.path)) it.held.push(c.old === undefined || c.old === null ? 'It writes in what the program told us. The gate can’t see the message itself until the private queue arrives (Phase 2), so Josh reads it.' : 'It changes or removes something the program told us.');
      if (/^asks(\[|$)/.test(c.path)) it.held.push(c.new === undefined ? 'It removes a question to the program’s managers.' : 'It adds a question for the program’s managers. Until the gate can tell claimed listings apart, Josh sees each one first.');
    }
  }
  // A listing new to the site.
  if (it.kind === 'new' && (type === 'p' || type === 'c')) await newListing(it, { a, groups, before, isSchoolSite, isCity });
  // Pickup and on-site links: a source must name the school; a school leaving a pickup list waits.
  if (type === 'p') {
    const links = new Map();
    for (const c of flat) { const m = /^schools\.([^.[]+)(?:\.relation)?$/.exec(c.path); if (m) links.set(m[1], c); }
    if (it.kind === 'new') for (const id of Object.keys(a.schools || {})) links.set(id, { path: `schools.${id}`, old: undefined, new: a.schools[id] });
    for (const [id, c] of links) {
      if (c.new === undefined) { it.held.push(`It takes ${schoolNames(id)[0]} off the listing.`); continue; }
      const rel = isObj(c.new) ? c.new.relation : (at(a, `schools.${id}.relation`));
      if (!['pickup', 'onsite'].includes(rel)) continue;
      const q = norm(quotesFor(`schools.${id}`) + ' ' + quotesFor(`schools.${id}.relation`) + ' ' + quotesFor(''));
      if (!schoolNames(id).some(n => q.includes(norm(n)))) it.held.push(`No quote names ${schoolNames(id)[0]} for the ${rel === 'pickup' ? 'pickup' : 'on-site'} link.`);
    }
    for (const c of flat.filter(x => /^pickupLists\[/.test(x.path))) {
      const oldText = typeof c.old === 'string' ? c.old : isObj(c.old) ? c.old.text : null, newText = typeof c.new === 'string' ? c.new : isObj(c.new) ? c.new.text : null;
      if (!oldText) continue;
      if (newText === null || newText === undefined) { it.held.push('It removes a pickup list.'); continue; }
      for (const id of Object.keys(b.schools || {})) { const ns = schoolNames(id); if (ns.some(n => norm(oldText).includes(norm(n))) && !ns.some(n => norm(newText).includes(norm(n)))) it.held.push(`${ns[0]} has dropped off a pickup list.`); }
    }
  }
  // Looks closed.
  const closing = new RegExp(CFG.closingWords, 'i');
  for (const c of flat) if (typeof c.new === 'string' && closing.test(c.new) && !(typeof c.old === 'string' && closing.test(c.old))) { it.held.push(`It reads as if the ${type === 'c' ? 'camp' : 'program'} has closed (${c.path}). A run never removes one; Josh decides.`); break; }
  // Prices and hours.
  for (const c of flat) {
    const f = lastSeg(c.path);
    if (f === 'price' && c.old !== undefined && c.new !== undefined && (c.old === 'free') !== (c.new === 'free')) it.held.push(`The price changes from ${c.old} to ${c.new}.`);
    if (['cost', 'weekly', 'extended', 'eachDay', 'flat', 'monthCap'].includes(f) || /^rate\b/.test(c.path)) {
      const amt = v => { if (typeof v === 'number') return v; if (typeof v !== 'string') return null; const m = /\$\s?(\d[\d,]*(?:\.\d+)?)/.exec(v); return m ? +m[1].replace(/,/g, '') : null; };
      const o = amt(c.old), n = amt(c.new);
      if (o && n && Math.abs(n - o) / o > CFG.priceMove) it.held.push(`A price moves by more than ${Math.round(CFG.priceMove * 100)}% (${c.path}: ${o} to ${n}).`);
      if (typeof c.old === 'string' && typeof c.new === 'string' && (/\bfree\b/i.test(c.old) && !/\$/.test(c.old)) !== (/\bfree\b/i.test(c.new) && !/\$/.test(c.new))) it.held.push(`${c.path} flips between free and paid.`);
    }
    if (['pickupBy', 'hours'].includes(f) || /^weekend\.times/.test(c.path)) {
      const close = v => { if (typeof v !== 'string') return null; const ts = [...v.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?![\d:])/gi)].filter(m => m[3] || m[2]); if (!ts.length) return null; const m = ts[ts.length - 1]; let h = +m[1] % 12; const pm = m[3] ? /p/i.test(m[3]) : h >= 1 && h <= 8; if (pm) h += 12; return h * 60 + (+m[2] || 0); };
      const o = close(c.old), n = close(c.new);
      if (o !== null && n !== null && Math.abs(n - o) > CFG.closingMoveMinutes) it.held.push(`A closing time moves by more than an hour (${c.path}: ${short(c.old)} to ${short(c.new)}).`);
    }
  }
  // Dates emailed to parents, and the notes emailed with them.
  const dateLists = type === 'p' ? /^(register\.dates|daysOff\.dates)/ : type === 'c' ? /^dates(\[|$)/ : type === 'd' ? /^dates(\[|$)/ : null;
  if (dateLists) for (const c of flat) {
    if (!dateLists.test(c.path)) continue;
    const dOf = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : isObj(v) && typeof v.date === 'string' ? v.date : null;
    const dates = Array.isArray(c.new) ? c.new.filter(d => !(c.old || []).includes(d)) : [dOf(c.new)].filter(Boolean);
    const gone = Array.isArray(c.old) ? c.old.filter(d => !(c.new || []).includes(d)) : (c.new === undefined || (dOf(c.new) && dOf(c.old) && dOf(c.new) !== dOf(c.old))) ? [dOf(c.old)].filter(Boolean) : [];
    for (const d of gone) if (d >= TODAY) it.held.push(`It changes or removes ${d}, a date parents may already have been emailed.`);
    for (const d of dates) {
      if (d < TODAY) it.held.push(`${d} has already gone by.`);
      else if (d > addMonths(TODAY, CFG.dates.monthsAhead)) it.held.push(`${d} is more than ${CFG.dates.monthsAhead} months away.`);
      const q = quotesFor(c.path) || quotesFor(c.path.replace(/\[[^\]]*\]$/, ''));
      const qd = tokens(q).filter(t => t.k === 'date');
      const hit = qd.find(t => t.date.m === +d.slice(5, 7) && t.date.d === +d.slice(8, 10));
      if (hit && !hit.date.y && !/\b20\d\d\b/.test(q) && daysBetween(TODAY, d) > CFG.dates.noYearDays) it.held.push(`The page gives no year for ${d}, which is more than ${CFG.dates.noYearDays} days away.`);
      const distinct = new Set(qd.map(t => `${t.date.m}-${t.date.d}`));
      if (distinct.size > 1) it.held.push(`The quote for ${d} holds ${distinct.size} dates, so it isn't clear which one the label means.`);
    }
  }
  const noteKind = type === 'd' ? 'school-dates' : (type === 'p' || type === 'c') ? 'updates' : null;
  if (noteKind) for (const c of flat) {
    const isNote = noteKind === 'updates' ? /^updates(\[|$)/.test(c.path) : /^(dates|weekly)\[/.test(c.path);
    if (!isNote || c.new === undefined) continue;
    const texts = noteKind === 'updates' ? [isObj(c.new) ? c.new.text : lastSeg(c.path) === 'text' ? c.new : null] : [isObj(c.new) ? c.new.title : lastSeg(c.path) === 'title' ? c.new : null];
    const names = [...(a.offers || []), ...(a.clubs || []).map(x => x.name)].filter(Boolean);
    for (const t of texts.filter(Boolean)) if (!onTemplate(t, noteKind, names)) it.held.push(`The note “${t}” isn't built from an approved template.`);
    if (noteKind === 'school-dates' && isObj(c.new) && c.new.by && c.new.by !== 'school') it.held.push(`A date sent in by a ${c.new.by} has no school page to check it against.`);
  }
  // Schools.
  if (type === 's' && it.kind === 'new') {
    const n = (after['data/programs.json'] || []).filter(p => p.schools && p.schools[a.id] && p.schools[a.id].checked).length;
    if (n < CFG.schools.minPrograms) it.held.push(`It has ${plural(n, 'confirmed program')}; a new school needs ${CFG.schools.minPrograms}.`);
    const charter = /charter|mastery/i.test([a.name, ...(a.aliases || [])].join(' ')) || ALL_SCHOOLS.some(x => x.kind === 'Charter' && a.address && a.address.toLowerCase().startsWith(String(x.address).toLowerCase()));
    if (charter && !a.calendar) it.held.push('It is a charter school with no calendar of its own on the page.');
  }
  // Hidden instructions written into the data.
  for (const c of flat) { const h = typeof c.new === 'string' ? hidden(c.new) : ''; if (h) { it.held.push(`The new text for ${c.path} seems to talk to an AI or asks to skip a rule (“${h}”).`); break; } }
}

// A listing new to the site: something must vouch for it, and it must be a children's program.
async function newListing(it, { a, groups, before, isSchoolSite, isCity }) {
  const site = a.website;
  if (!isUrl(site)) { it.held.push('A new listing needs a website: without one it can’t be cross-checked.'); return; }
  const h = hostOf(site);
  if (inHosts(h, CFG.signupHosts)) { it.held.push(`Its website is a bare sign-up or payment page (${h}).`); return; }
  if (isSchoolSite(site) || isCity(site)) return;   // run by a school or the City, on its own pages
  const others = [...(before['data/programs.json'] || []), ...((before['data/camps.json'] || {}).camps || [])];
  const isNewSite = !others.some(o => [o.website, ...(o.sources || []).map(s => s.url)].some(u => isUrl(u) && (isShared(h) ? normUrl(u).startsWith(normUrl(site)) : regDomain(hostOf(u)) === regDomain(h))));
  const home = await readPage(site, 'fetch');
  if (home.ok && !new RegExp(CFG.childWords, 'i').test(home.joined)) it.held.push('Its website doesn’t read as a children’s program.');
  if (home.ok && home.lines.length < 15 && /\b(register|sign up|checkout|payment|cart|enroll)\b/i.test(home.joined)) it.held.push('Its website is a bare sign-up or payment page.');
  if (!isNewSite) return;
  const existingHosts = new Set(others.map(o => regDomain(hostOf(o.website))).filter(Boolean));
  const nm = norm(a.name || '');
  const vouched = nm.trim() && groups.some(g => (g.found || []).some(f => (isSchoolSite(f.x.source) || isCity(f.x.source) || existingHosts.has(regDomain(hostOf(f.x.source)))) && norm(f.quote).includes(nm)));
  if (vouched) return;
  if (isShared(h)) { it.held.push(`Its website is new to the site, sits on a shared host (${h}) whose age says nothing, and no school, City or known provider page names it.`); return; }
  const years = await domainYears(regDomain(h));
  const text = [home.ok ? home.joined : '', ...groups.flatMap(g => (g.found || []).map(f => f.pg.joined))].join('\n');
  const street = /\b\d{1,5}\s+(?:[NSEW]\.?\s+)?(?:[A-Z0-9][\w.'’-]*\s+){1,4}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Pike|Ln|Lane|Way|Pl|Place|Dr|Drive|Ct|Court|Pkwy|Parkway|Sq|Square|Ter|Terrace)\b\.?/.test(text) && /\b(Philadelphia|Phila\.?|PA\s*191\d\d|191\d\d)\b/.test(text);
  const phone = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(text);
  if (years === null) it.held.push(`Its website is new to the site, nothing vouches for it, and the age of ${regDomain(h)} couldn’t be told.`);
  else if (years < CFG.newListing.domainYears) it.held.push(`Its website is new to the site, nothing vouches for it (no school, City or known provider page names it), and ${regDomain(h)} is ${years < 1 / 12 ? 'less than a month' : years < 1 ? `${Math.round(years * 12)} months` : `${years.toFixed(1)} years`} old.`);
  else if (!street || !phone) it.held.push(`Its website is new to the site, nothing vouches for it, and it shows no ${!street ? 'Philadelphia street address' : 'phone number'}.`);
}

// Notes emailed to parents are built from fixed templates (scripts/gate.config.json).
function onTemplate(text, kind, names) {
  const slot = s => { const r = CFG.noteSlots[s]; if (r === '@names') return names.length ? names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : '(?!)'; return r; };
  return (CFG.noteTemplates[kind] || []).some(t => new RegExp('^(?:' + t.replace(/\{(\w+)\}/g, (_, s) => '(?:' + slot(s) + ')') + ')$', 'i').test(text.trim()));
}
// Reviews publish on their own from Phase 6, once the host supplies the account checks. Until then each one waits,
// with what the text checks found.
function reviewReasons(b, a) {
  if (!a) return ['It removes a review.'];
  const t = [a.text, a.comment, a.title].filter(Boolean).join(' ');
  const out = ['Reviews publish on their own from Phase 6, when the site supplies the account checks. Until then Josh reads each one.'];
  if (/https?:\/\/|www\./i.test(t)) out.push('It holds a link.');
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/i.test(t)) out.push('It holds contact details.');
  const acc = new RegExp(CFG.reviewWords, 'i').exec(t); if (acc) out.push(`It may make an accusation (“${acc[0]}”).`);
  return out;
}
function labelOf(key, b, a, after, before) {
  const r = a || b || {};
  const [t, ...rest] = key.split(':'); const id = rest.join(':');
  if (t === 'p' || t === 'c' || t === 's') return r.name || id;
  if (t === 'd') { const s = [...(after['data/schools.json'] || []), ...(before['data/schools.json'] || [])].find(x => x.id === id); return 'Dates at ' + (s ? s.shortName || s.name : id); }
  if (t === 'n') return 'What’s new: ' + (r.title || id);
  if (t === 'r') return 'A review';
  if (t === 'geo') return 'Map place ' + id;
  if (t === 'reading') return 'How ' + id + ' is read';
  return key;
}

// The build's notes for a set of data files, with main's code: a copy in a temporary folder, so nothing here moves.
function buildNotes(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-gate-build-'));
  try {
    for (const f of ['build.mjs', 'site.config.json', 'data', 'src', 'email', 'scripts']) if (fs.existsSync(path.join(ROOT, f))) fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
    for (const [f, v] of Object.entries(files)) if (v !== undefined && v !== null) fs.writeFileSync(path.join(dir, f), JSON.stringify(v, null, 2) + '\n');
    const r = spawnSync('node', ['build.mjs'], { cwd: dir, encoding: 'utf8', maxBuffer: 64e6, env: { ...process.env, PAS_NO_HISTORY: '1', PAS_TODAY: TODAY } });
    const out = (r.stdout || '') + '\n' + (r.stderr || '');
    if (r.status !== 0) return { ok: false, error: out.trim().split('\n').filter(Boolean).slice(-4).join(' / ').slice(0, 500) };
    return { ok: true, notes: out.split('\n').map(l => l.trim()).filter(l => /^Note:/.test(l)) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function finish({ whole, notes, items, tests, branch, nothing = false, buildCheck = true, evidence = null }) {
  const list = [...items.values()].map(i => ({ ...i, held: [...new Set(i.held)] }));
  const held = list.filter(i => i.held.length), ok = list.filter(i => !i.held.length);
  const changes = list.reduce((n, i) => n + i.changes.length, 0);
  const verdict = nothing ? 'nothing' : whole.length || held.length ? 'held' : 'publish';
  return { branch, today: TODAY, verdict, whole: [...new Set(whole)], notes, tests, buildCheck, items: list, counts: { listings: list.length, changes, publish: ok.length, held: held.length, verified: list.reduce((n, i) => n + i.checked, 0) }, evidenceRun: evidence && evidence.run };
}

// ---------------------------------------------------------------- words for people
function describe(c) { return c.path === '' ? (c.old === undefined ? 'new' : c.new === undefined ? 'removed' : 'changed') : `${c.path}: ${short(c.old)} → ${short(c.new)}`; }
export function comment(v, { mode, head, pr } = {}) {
  const pub = v.items.filter(i => !i.held.length), held = v.items.filter(i => i.held.length);
  const meta = { verdict: v.verdict, mode, head, branch: v.branch, today: v.today, changes: v.counts.changes, listings: v.counts.listings, held: held.length + (v.whole.length ? 1 : 0), publish: pub.length, whole: v.whole.length };
  const out = [`<!-- ${MARK} ${JSON.stringify(meta)} -->`];
  const head1 = v.verdict === 'nothing' ? 'No data changes to check.'
    : v.verdict === 'publish' ? `Everything checks out: ${plural(pub.length, 'listing')} (${plural(v.counts.changes, 'change')}) would publish.`
      : `${plural(pub.length, 'listing')} would publish, ${held.length ? plural(held.length, 'listing') + ' held' : 'nothing held by listing'}${v.whole.length ? ', and the pull request as a whole is held' : ''}.`;
  out.push(`### Autopilot gate: ${head1}`);
  out.push(mode === 'on' ? (v.verdict === 'publish' ? '_Autopilot is on: this merges itself and the site publishes._' : '_Autopilot is on, but something is held, so this waits for Josh._')
    : mode === 'shadow' ? '_Shadow mode: the gate only says what it would do. Nothing is merged; Josh merges by hand as before._' : '');
  if (v.whole.length) { out.push('', '**Held as a whole, and why**'); for (const w of v.whole) out.push(`- ${w}`); }
  if (held.length) {
    out.push('', '**Held, and why**');
    for (const i of held) { out.push(`- **${i.label}** (${i.kind === 'new' ? 'new' : i.kind === 'remove' ? 'removed' : plural(i.changes.length, 'change')}, \`${i.key}\`)`); for (const r of i.held.slice(0, 8)) out.push(`  - ${r}`); if (i.held.length > 8) out.push(`  - and ${i.held.length - 8} more`); }
  }
  if (pub.length) {
    out.push('', '**Would publish**');
    for (const i of pub.slice(0, 40)) out.push(`- **${i.label}**: ${i.kind === 'new' ? 'new listing' : i.changes.slice(0, 3).map(describe).join('; ')}${i.changes.length > 3 ? `; and ${i.changes.length - 3} more` : ''}`);
    if (pub.length > 40) out.push(`- and ${pub.length - 40} more`);
  }
  const checks = [`build ${v.buildCheck === false ? 'not repeated' : v.whole.some(w => /build/.test(w)) ? '✗' : '✓'}`, `tests ${v.tests === 'passed' ? '✓' : v.tests === 'failed' ? '✗' : 'not run here'}`, `${plural(v.counts.verified, 'quote')} re-read on the provider’s page`];
  out.push('', `<sub>Checks: ${checks.join(' · ')}. Commit ${head ? head.slice(0, 7) : 'working tree'}, ${v.today}. Rules: docs/listings.md, “The autopilot gate”.</sub>`);
  return out.filter(l => l !== undefined).join('\n') + '\n';
}
function printLocal(v) {
  const held = v.items.filter(i => i.held.length), pub = v.items.filter(i => !i.held.length);
  console.log(`\nThe gate, on branch ${v.branch}: ${v.verdict === 'nothing' ? 'no data changes.' : `${pub.length} would publish, ${held.length} held${v.whole.length ? ', and the whole pull request is held' : ''}.`}`);
  for (const w of v.whole) console.log(`  HELD (whole): ${w}`);
  for (const i of held) { console.log(`  HELD ${i.key} (${i.label})`); for (const r of i.held) console.log(`      ${r}`); }
  for (const i of pub) console.log(`  ok   ${i.key} (${i.label}): ${i.changes.length} change(s)`);
  if (held.length) console.log(`\nMove the held listings to a second pull request (their keys are above), and keep this one clean.`);
}

// ---------------------------------------------------------------- GitHub
async function gh(method, p, body) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(API + p, { method, headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'pas-gate', ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
      const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
      return { status: r.status, ok: r.ok, json, text };
    } catch (e) { if (i >= 3) throw e; await new Promise(r => setTimeout(r, 2000 * i)); }   // a dropped connection: try again
  }
}
const ghOk = async (method, p, body) => { const r = await gh(method, p, body); if (!r.ok) throw new Error(`GitHub ${method} ${p}: ${r.status} ${r.text.slice(0, 200)}`); return r.json; };
function eligible(pr) {
  if (!pr || !pr.head || !pr.base) return 'not a pull request';
  if (pr.head.repo && pr.head.repo.full_name !== pr.base.repo.full_name) return 'it comes from a fork';
  if (!CFG.branches.some(b => pr.head.ref.startsWith(b))) return `its branch (${pr.head.ref}) isn't a run's branch`;
  if (CFG.authors.length && !CFG.authors.includes(pr.user && pr.user.login)) return `its author (${pr.user && pr.user.login}) isn't the account the runs use`;
  if (pr.base.ref !== 'main') return 'it isn’t aimed at main';
  if (pr.state !== 'open') return 'it is closed';
  return '';
}
const mode = () => { const m = (parse(fs.readFileSync(path.join(ROOT, 'data/autopilot.json'), 'utf8')) || {}).mode; return ['off', 'shadow', 'on'].includes(m) ? m : 'off'; };
const output = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };
const filesAt = (ref, cwd) => Object.fromEntries(CFG.allow.map(f => [f, parse(gitShow(ref, f, cwd))]));

async function prStage(n, dir) {
  const m = mode();
  if (m === 'off') { console.log('Autopilot is off (data/autopilot.json): nothing to do.'); output('skip', 'true'); return; }
  let pr = await ghOk('GET', `/repos/${REPO}/pulls/${n}`);
  const why = eligible(pr);
  if (why) { console.log(`Pull request #${n} is left alone: ${why}.`); output('skip', 'true'); return; }
  for (let i = 0; i < 12 && pr.mergeable === null; i++) { await new Promise(r => setTimeout(r, 5000)); pr = await ghOk('GET', `/repos/${REPO}/pulls/${n}`); }
  const state = { pr: n, branch: pr.head.ref, head: pr.head.sha, mode: m, conflict: pr.mergeable === false };
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const f of ['build.mjs', 'site.config.json', 'data', 'src', 'email', 'scripts', 'tests']) if (fs.existsSync(path.join(ROOT, f))) fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  fs.rmSync(path.join(dir, 'tests/.scratch'), { recursive: true, force: true });
  if (!state.conflict) {
    git(['fetch', '--no-tags', '--depth=2', 'origin', `+refs/pull/${n}/merge:refs/gate/merge`]);
    const [merge, base, head] = git(['rev-list', '--parents', '-n', '1', 'refs/gate/merge']).trim().split(/\s+/);
    if (head !== pr.head.sha) throw new Error(`GitHub's test merge is for ${head}, not the pull request's head ${pr.head.sha}; run again in a minute.`);
    Object.assign(state, { merge, base, changed: git(['diff', '--name-only', base, merge]).split('\n').filter(Boolean) });
    for (const f of CFG.allow) { const t = gitShow(merge, f); if (t !== null) fs.writeFileSync(path.join(dir, f), t); }   // data only, from the merge; nothing else from the pull request
  }
  git(['init', '-q'], dir); git(['add', '-A'], dir);   // the tests list the files a repository tracks
  fs.writeFileSync(path.join(dir, '.gate-state.json'), JSON.stringify(state, null, 1));
  console.log(`Staged #${n} (${state.branch} at ${state.head.slice(0, 7)}) in ${dir}${state.conflict ? ': it conflicts with main' : ''}.`);
  output('skip', 'false'); output('head', state.head);
}

async function prJudge(n, dir, tests, post, buildCheck = true, testedHead = '') {
  const state = JSON.parse(fs.readFileSync(path.join(dir, '.gate-state.json'), 'utf8'));
  if (testedHead && testedHead !== state.head) { console.log(`The tests ran on ${testedHead.slice(0, 7)}, not ${state.head.slice(0, 7)}: counted as not run.`); tests = 'skipped'; }
  let v;
  if (state.conflict) v = finish({ whole: ['It conflicts with main, so it can’t be checked or merged as it stands. The next run brings it up to date.'], notes: [], items: new Map(), tests, branch: state.branch });
  else v = await judge({ before: filesAt(state.base), after: Object.fromEntries(CFG.allow.map(f => [f, fs.existsSync(path.join(dir, f)) ? parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null])), changed: state.changed, evidenceText: gitShow(state.merge, CFG.evidenceDir + state.branch + '.json'), branch: state.branch, tests, buildCheck, mainReading: parse(gitShow(state.base, 'data/reading.json')) });
  if (browser) await browser.close().catch(() => {});
  const body = comment(v, { mode: state.mode, head: state.head, pr: n });
  fs.writeFileSync(path.join(dir, 'verdict.json'), JSON.stringify({ ...v, head: state.head, base: state.base, mode: state.mode }, null, 1));
  fs.writeFileSync(path.join(dir, 'comment.md'), body);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, body);
  console.log(body);
  if (!post) return v;
  // One comment per pull request, replaced each time; the label for the Needs-you page.
  const comments = await ghOk('GET', `/repos/${REPO}/issues/${n}/comments?per_page=100`);
  const mine = (comments || []).filter(c => (c.body || '').includes(`<!-- ${MARK} `)).pop();
  if (mine) await ghOk('PATCH', `/repos/${REPO}/issues/comments/${mine.id}`, { body }); else await ghOk('POST', `/repos/${REPO}/issues/${n}/comments`, { body });
  if (v.verdict === 'held') await ghOk('POST', `/repos/${REPO}/issues/${n}/labels`, { labels: ['needs-josh'] });
  else { const r = await gh('DELETE', `/repos/${REPO}/issues/${n}/labels/needs-josh`); if (!r.ok && r.status !== 404) throw new Error('could not take the label off: ' + r.status); }
  // The merge: only in "on", only with nothing held and the tests passed, only the commit checked, only if main hasn't moved.
  if (state.mode === 'on' && v.verdict === 'publish' && tests === 'passed') {
    const pr = await ghOk('GET', `/repos/${REPO}/pulls/${n}`);
    const main = await ghOk('GET', `/repos/${REPO}/git/ref/heads/main`);
    if (pr.head.sha !== state.head || main.object.sha !== state.base) {
      console.log('The pull request or main moved while it was being checked: checking again.');
      await ghOk('POST', `/repos/${REPO}/actions/workflows/autopilot.yml/dispatches`, { ref: 'main', inputs: { pr: String(n) } });
      return v;
    }
    await ghOk('PUT', `/repos/${REPO}/pulls/${n}/merge`, { merge_method: 'squash', sha: state.head, commit_title: `${pr.title} (#${n})`, commit_message: 'Merged by the autopilot gate: every change matched a quote re-read on the provider’s own page.' });
    await ghOk('POST', `/repos/${REPO}/actions/workflows/publish.yml/dispatches`, { ref: 'main' });
    console.log(`Merged #${n} at ${state.head.slice(0, 7)} and started the publish.`);
  }
  return v;
}

async function local() {
  const base = opt('base') || 'origin/main';
  const mb = git(['merge-base', base, 'HEAD']).trim();
  const branch = opt('branch') || git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const changed = [...new Set([...git(['diff', '--name-only', mb]).split('\n'), ...git(['ls-files', '--others', '--exclude-standard']).split('\n')].filter(Boolean))];
  const after = Object.fromEntries(CFG.allow.map(f => [f, fs.existsSync(path.join(ROOT, f)) ? parse(fs.readFileSync(path.join(ROOT, f), 'utf8')) : null]));
  const evFile = path.join(ROOT, CFG.evidenceDir, branch + '.json');
  const before = filesAt(mb);
  const v = await judge({ before, after, changed, evidenceText: fs.existsSync(evFile) ? fs.readFileSync(evFile, 'utf8') : null, branch, buildCheck: !flag('no-build') });
  if (browser) await browser.close().catch(() => {});
  if (flag('draft')) draft(v, evFile, before, after);
  if (flag('json')) console.log(JSON.stringify(v, null, 1)); else printLocal(v);
  process.exit(v.verdict === 'held' ? 1 : 0);
}
// --draft: a record for every changed value that has none yet, for the run to fill in (source, quote, how).
function draft(v, evFile, before, after) {
  const ev = parse(fs.existsSync(evFile) ? fs.readFileSync(evFile, 'utf8') : null) || { run: path.basename(evFile, '.json'), items: [] };
  const have = new Set(ev.items.flatMap(i => (i.fields || []).map(f => `${i.listing} ${f.path}`)));
  let n = 0;
  for (const i of v.items) {
    const leaves = []; const walk = c => { const k = expand(c); if (k) k.forEach(walk); else leaves.push(c); }; i.changes.forEach(walk);
    const add = leaves.filter(c => !have.has(`${i.key} ${c.path}`)).map(c => ({ path: c.path, old: c.old ?? null, new: c.new ?? null, source: '', quote: '', read: TODAY, how: 'fetch' }));
    if (!add.length) continue;
    let it = ev.items.find(x => x.listing === i.key);
    if (!it) { it = { item: i.key.startsWith('s:') ? `school:${i.key.slice(2)}` : `monthly:${i.key.slice(2)}`, kind: i.kind === 'new' ? (i.key.startsWith('s:') ? 'new-school' : 'new-listing') : 'update', listing: i.key, outcome: 'published', fields: [] }; ev.items.push(it); }
    it.fields.push(...add); n += add.length;
  }
  fs.mkdirSync(path.dirname(evFile), { recursive: true });
  fs.writeFileSync(evFile, JSON.stringify(ev, null, 2) + '\n');
  console.log(`Added ${plural(n, 'record')} to ${path.relative(ROOT, evFile)}: fill in each one's source, quote and how.`);
}

// ---------------------------------------------------------------- replay and the shadow report
// Evidence for a change made before evidence files existed: the listing's own stored pages, read now, and the
// shortest stretch of a page (300 characters at most) that holds every new number. Words with no numbers count
// only when the value itself is on the page.
async function synthesize(items, recs, rules) {
  const records = [];
  await Promise.all([...items.values()].map(async it => {
    const r = recs[it.key]; if (!r || !r.after || !/^[pcsd]:/.test(it.key)) return;
    const urls = [...new Set([r.after.website, ...collectUrls(r.after), ...collectUrls(r.before)].filter(isUrl))].slice(0, 12);
    const leaves = []; const walk = c => { const k = expand(c); if (k) k.forEach(walk); else leaves.push(c); }; it.changes.forEach(walk);
    for (const c of leaves) {
      if (c.new === undefined) continue;
      const need = newTokens(c.old, c.new);
      for (const u of urls) {
        const pg = await readPage(u, ruleHow(u, rules)); if (!pg.ok) continue;
        let quote = null;
        const added = typeof c.old === 'string' && typeof c.new === 'string' && c.new.includes(c.old) ? c.new.replace(c.old, '').trim() : c.new;   // the words a longer value added
        if (need.length) quote = windowWith(pg.joined, need);
        else if (typeof added === 'string' && added.length && added.length <= CFG.quoteMax && !isUrl(added) && pg.normed.includes(norm(added))) quote = added;
        else if (isUrl(c.new) && (pg.links || []).some(l => normUrl(l) === normUrl(c.new))) quote = '';
        if (quote !== null) { records.push({ item: it.key, kind: 'update', outcome: 'published', listing: it.key, path: c.path, old: c.old ?? null, new: c.new ?? null, source: u, quote, read: TODAY, how: ruleHow(u, rules) }); break; }
      }
    }
  }));
  return records;
}
function collectUrls(v) { const out = []; const walk = x => { if (typeof x === 'string') { if (isUrl(x)) out.push(x); } else if (Array.isArray(x)) x.forEach(walk); else if (isObj(x)) Object.values(x).forEach(walk); }; walk(v); return out; }
function windowWith(text, need) {
  const hits = tokens(text).filter(t => need.some(n => tokenIn(n, [t])));
  let best = null;
  for (let i = 0; i < hits.length; i++) {
    for (let j = i; j < hits.length && hits[j].end - hits[i].pos <= CFG.quoteMax; j++) {
      if (need.every(n => tokenIn(n, hits.slice(i, j + 1)))) { const len = hits[j].end - hits[i].pos; if (!best || len < best.to - best.from) best = { from: hits[i].pos, to: hits[j].end }; break; }
    }
  }
  if (!best) return null;
  // Widen to the whole line where it fits, and always end on a word boundary, so the quote is found again as it is.
  const ls = text.lastIndexOf('\n', best.from) + 1; let le = text.indexOf('\n', best.to); if (le < 0) le = text.length;
  let from = ls, to = le;
  if (to - from > CFG.quoteMax) { const spare = CFG.quoteMax - (best.to - best.from); from = Math.max(ls, best.from - Math.floor(spare / 2)); to = Math.min(le, from + CFG.quoteMax); }
  while (from > ls && /\S/.test(text[from - 1])) from++;
  while (to < le && /\S/.test(text[to])) to--;
  const q = text.slice(from, to).trim();
  return q.length && q.length <= CFG.quoteMax ? q : null;
}

async function listRunPRs(state = 'all') {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const list = await ghOk('GET', `/repos/${REPO}/pulls?state=${state}&per_page=100&page=${page}`);
    out.push(...list.filter(p => CFG.branches.some(b => p.head.ref.startsWith(b))));
    if (list.length < 100) break;
  }
  return out.sort((a, b) => a.number - b.number);
}

async function replay(from) {
  const only = (opt('only') || '').split(',').filter(Boolean).map(Number);
  const prs = (await listRunPRs('closed')).filter(p => p.number >= from && (!only.length || only.includes(p.number)));
  const rows = [];
  for (const pr of prs) {
    const merged = !!pr.merged_at;
    let beforeRef, afterRef;
    try {
      if (merged) { git(['fetch', '--no-tags', '--depth=2', 'origin', pr.merge_commit_sha]); afterRef = pr.merge_commit_sha; beforeRef = git(['rev-parse', `${afterRef}^1`]).trim(); }
      else { git(['fetch', '--no-tags', '--depth=100', 'origin', pr.head.sha, pr.base.sha]); afterRef = pr.head.sha; beforeRef = git(['merge-base', pr.base.sha, pr.head.sha]).trim(); }
    } catch (e) { rows.push({ pr: pr.number, branch: pr.head.ref, josh: merged ? 'merged' : 'closed', error: 'its commits could not be fetched: ' + String(e.message).split('\n')[0] }); continue; }
    const changed = git(['diff', '--name-only', beforeRef, afterRef]).split('\n').filter(Boolean);
    const before = filesAt(beforeRef), after = filesAt(afterRef);
    const evText = gitShow(afterRef, CFG.evidenceDir + pr.head.ref + '.json');
    let built = null, v;
    if (evText === null) {
      // Build the evidence it can, then judge with it. The build and tests are not repeated: the code has moved on.
      const probe = await judge({ before, after, changed, evidenceText: JSON.stringify({ run: 'replay', items: [] }), branch: pr.head.ref, buildCheck: false });
      const items = new Map(probe.items.map(i => [i.key, i]));
      const recs = {}; for (const i of probe.items) { const f = Object.keys(FILEKEY).find(k => FILEKEY[k] === i.key.split(':')[0]); const B = recordsOf(f, before[f]), A = recordsOf(f, after[f]); recs[i.key] = { before: B.get(i.key), after: A.get(i.key) }; }
      const rules = [...readingRules(before['data/reading.json']), ...readingRules(after['data/reading.json'])];
      const records = await synthesize(items, recs, rules);
      const grouped = new Map(); for (const r of records) { if (!grouped.has(r.listing)) grouped.set(r.listing, []); grouped.get(r.listing).push(r); }
      const leavesTotal = probe.items.reduce((n, i) => { let k = 0; const walk = c => { const x = expand(c); if (x) x.forEach(walk); else if (c.new !== undefined) k++; }; i.changes.forEach(walk); return n + k; }, 0);
      built = { records: records.length, leaves: leavesTotal };
      v = await judge({ before, after, changed: [...changed, CFG.evidenceDir + pr.head.ref + '.json'], evidenceText: JSON.stringify({ run: 'replay-' + pr.number, items: [...grouped].map(([l, fs2]) => ({ item: l, kind: 'update', outcome: 'published', listing: l, fields: fs2.map(({ path: p, old, new: nw, source, quote, read, how }) => ({ path: p, old, new: nw, source, quote, read, how })) })) }), branch: pr.head.ref, buildCheck: false });
    } else v = await judge({ before, after, changed, evidenceText: evText, branch: pr.head.ref, buildCheck: false });
    const reasons = {}; for (const r of [...v.whole, ...v.items.flatMap(i => i.held)]) { const k = r.replace(/“[^”]*”|\([^)]*\)|\b\d[\d.,-]*\b|https?:\/\/\S+|[\w.-]+\.(org|com|net|gov|edu)\S*/g, '…').replace(/\s+/g, ' ').slice(0, 110); reasons[k] = (reasons[k] || 0) + 1; }
    rows.push({ pr: pr.number, branch: pr.head.ref, josh: merged ? 'merged' : 'closed', gate: v.verdict, listings: v.counts.listings, changes: v.counts.changes, publish: v.counts.publish, held: v.counts.held, whole: v.whole, built, reasons, items: v.items.filter(i => i.held.length).map(i => ({ key: i.key, held: i.held })) });
    console.log(`#${pr.number} ${pr.head.ref}: Josh ${merged ? 'merged' : 'closed'} it; the gate would have ${v.verdict === 'publish' ? 'merged it' : v.verdict === 'nothing' ? 'found nothing to publish' : 'held it'} (${v.counts.publish} of ${v.counts.listings} listings clean${built ? `; evidence built for ${built.records} of ${built.leaves} values` : ''}).`);
  }
  if (browser) await browser.close().catch(() => {});
  const md = replayMarkdown(rows, from);
  if (opt('out')) { fs.writeFileSync(opt('out'), JSON.stringify({ from, today: TODAY, rows }, null, 1)); fs.writeFileSync(opt('out').replace(/\.json$/, '') + '.md', md); }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log('\n' + md);
}
function replayMarkdown(rows, from) {
  const out = [`## Replay of the runs' pull requests from #${from}`, '', '| Pull request | Josh | The gate | Listings clean | Values with evidence |', '|---|---|---|---|---|'];
  for (const r of rows) out.push(r.error ? `| #${r.pr} ${r.branch} | ${r.josh} | ${r.error} | | |` : `| #${r.pr} ${r.branch} | ${r.josh} | ${r.gate === 'publish' ? 'would merge' : r.gate === 'nothing' ? 'nothing to check' : 'would hold'} | ${r.publish} of ${r.listings} | ${r.built ? `${r.built.records} of ${r.built.leaves} (${r.built.leaves ? Math.round(100 * r.built.records / r.built.leaves) : 0}%)` : 'evidence file'} |`);
  const bad = rows.filter(r => r.gate === 'publish' && r.josh === 'closed');
  out.push('', bad.length ? `**${plural(bad.length, 'pull request')} the gate would have merged that Josh closed: ${bad.map(r => '#' + r.pr).join(', ')}.**` : '**None that the gate would have merged and Josh closed.**');
  for (const r of rows.filter(x => !x.error && x.gate === 'held')) { out.push('', `Why #${r.pr} would be held (most common first):`); for (const [k, n] of Object.entries(r.reasons).sort((a, b) => b[1] - a[1]).slice(0, 8)) out.push(`- ${n} × ${k}`); }
  return out.join('\n') + '\n';
}

async function report() {
  const prs = await listRunPRs('all');
  const rows = [];
  for (const pr of prs) {
    const comments = await ghOk('GET', `/repos/${REPO}/issues/${pr.number}/comments?per_page=100`);
    const c = (comments || []).filter(x => (x.body || '').includes(`<!-- ${MARK} `)).pop();
    if (!c) continue;
    const meta = parse((/<!-- pas-gate (\{.*?\}) -->/.exec(c.body) || [])[1]) || {};
    rows.push({ pr: pr.number, branch: pr.head.ref, at: c.created_at.slice(0, 10), gate: meta.verdict, changes: meta.changes || 0, josh: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open' });
  }
  const decided = rows.filter(r => r.josh !== 'open');
  const judged = decided.reduce((n, r) => n + r.changes, 0);
  const wrong = decided.filter(r => r.gate === 'publish' && r.josh === 'closed');
  const first = rows.map(r => r.at).sort()[0];
  const days = first ? daysBetween(first, TODAY) : 0;
  const out = ['## Shadow report', '', `${plural(rows.length, 'run pull request')} the gate has commented on since ${first || '(none yet)'}.`, '', '| Pull request | The gate said | Josh | Changes |', '|---|---|---|---|'];
  for (const r of rows) out.push(`| #${r.pr} ${r.branch} | ${r.gate === 'publish' ? 'would merge' : r.gate === 'held' ? 'held' : r.gate || '?'} | ${r.josh} | ${r.changes} |`);
  out.push('', `**The test for switching on:** five shadow days (${days} so far), at least 30 changes judged (${judged} on decided pull requests), and none the gate would have merged that Josh rejected (${wrong.length}${wrong.length ? ': ' + wrong.map(r => '#' + r.pr).join(', ') : ''}).`);
  out.push(days >= 5 && judged >= 30 && !wrong.length ? '**Passed: autopilot can be switched on.**' : '**Not passed yet: keep merging by hand.**');
  out.push('', 'Held pull requests that Josh merged anyway are the ones to read when tuning the rules: each hold should have been worth his look.');
  let md = out.join('\n') + '\n';
  if (opt('with-replay') && fs.existsSync(opt('with-replay'))) md += '\n' + replayMarkdown(JSON.parse(fs.readFileSync(opt('with-replay'), 'utf8')).rows, JSON.parse(fs.readFileSync(opt('with-replay'), 'utf8')).from);
  if (opt('out')) fs.writeFileSync(opt('out'), md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(md);
}

export const _reset = () => { pages.clear(); ages.clear(); };
export { windowWith, onTemplate, readEvidence };

// ---------------------------------------------------------------- start
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (flag('local')) await local();
    else if (opt('pr') && opt('stage')) await prStage(+opt('pr'), path.resolve(opt('stage')));
    else if (opt('pr') && opt('judge')) { await prJudge(+opt('pr'), path.resolve(opt('judge')), opt('tests') || 'skipped', flag('post'), !flag('no-build'), opt('tested-head') || ''); }
    else if (opt('replay')) await replay(+opt('replay'));
    else if (flag('report')) await report();
    else { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 27).join('\n')); process.exit(2); }
    process.exit(0);
  } catch (e) { console.error('The gate stopped: ' + (e && e.stack || e)); process.exit(2); }
}
