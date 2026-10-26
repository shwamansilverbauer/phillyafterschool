// Builds the static site into dist/ from the data files. No dependencies: `node build.mjs`.
// PREVIEW=1 writes to preview/ with explicit index.html links, for viewing without a web server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { streetAddresses, addressKey } from './scripts/addresses.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PREVIEW = process.env.PREVIEW === '1';
const OUT = path.join(ROOT, PREVIEW ? 'preview' : 'dist');
const readJson = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const cfg = readJson('site.config.json');
const schools = readJson('data/schools.json');
const programs = readJson('data/programs.json');
const reviews = fs.existsSync(path.join(ROOT, 'data/reviews.json')) ? readJson('data/reviews.json') : [];
const cityList = fs.existsSync(path.join(ROOT, 'data/all-schools.json')) ? readJson('data/all-schools.json') : { schools: [] };
const daysOff = fs.existsSync(path.join(ROOT, 'data/days-off.json')) ? readJson('data/days-off.json') : null;
// Summer camps are their own list with their own file: nothing in it is tied to a school or to the after-school pages.
const campsFile = fs.existsSync(path.join(ROOT, 'data/camps.json')) ? readJson('data/camps.json') : null;
const summerCamps = campsFile?.camps || [];
// The QR code printed on the week card: a short address (/w) that .htaccess sends to the home page with campaign tags.
const cardQr = fs.existsSync(path.join(ROOT, 'data/card-qr.json')) ? readJson('data/card-qr.json') : null;

const GRADES = ['PK', 'K', '1', '2', '3', '4', '5', '6', '7', '8'];
// Ages, for weekend classes, day camps and summer camps, which go by age rather than grade: 3 to 13, then "14+".
const AGES = ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'];
const AGE_TOP = 14;
const ageStep = n => String(Math.min(AGE_TOP, Math.max(3, Math.round(n))));
// The ages a grade range covers: pre-K is 4 and 5, kindergarten 5 and 6, grade n is n+5 and n+6.
const gradesToAges = g => g === null ? null : [...new Set(g.flatMap(x => { const a = x === 'PK' ? 4 : x === 'K' ? 5 : Number(x) + 5; return [ageStep(a), ageStep(a + 1)]; }))].sort((a, b) => a - b);
const agesBetween = (lo, hi) => { const out = []; for (let a = Math.max(3, Math.floor(lo)); a <= Math.min(AGE_TOP, hi); a++) out.push(String(a)); if (hi >= AGE_TOP && !out.includes(String(AGE_TOP))) out.push(String(AGE_TOP)); return out; };
const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_NAME = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const REL = {
  onsite: { pill: 'At {s}', title: 'Runs at the school', blurb: 'No travel. Children stay in the building or on school grounds.' },
  pickup: { pill: 'Picks up from {s}', title: 'Picks up from {s}', blurb: 'Staff collect children at dismissal and walk or drive them to the program.' },
  nearby: { pill: 'Nearby, no pickup', title: 'Nearby, no pickup found', blurb: 'Close to the school, but you or your child would need to get there. Best suited to older children or as a second stop.' },
};
const HOW = ['online', 'phone', 'contact', 'school', 'none'];
// Program types: what a family is shopping for. Each has a color and a small icon, used on filters and roster cards.
// A program can have several; the first one listed in data/programs.json is the one its roster card wears.
const TYPES = [
  { id: 'aftercare', label: 'Aftercare', color: '#0F4D90', icon: 'M12 3 3 11h2.5v9h5v-6h3v6h5v-9H21z' },
  { id: 'music', label: 'Music', color: '#6B3FA0', icon: 'M9 4v10.2A3.5 3.5 0 1 0 11 17V8h7V4z' },
  { id: 'theater', label: 'Theater', color: '#A3162E', icon: 'M4 3h16v8a8 8 0 0 1-16 0zM8.5 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8.5 12a3.5 3.5 0 0 0 7 0z' },
  { id: 'art', label: 'Art & making', color: '#C2410C', icon: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.4-.7-.4-1.1 0-.9.7-1.7 1.7-1.7H17a4 4 0 0 0 4-4c0-4.5-4-8.2-9-8.2zM6.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z' },
  { id: 'movement', label: 'Sports & movement', color: '#1F7A3A', icon: 'M13 2 4 14h6l-1 8 9-12h-6z' },
  { id: 'stem', label: 'STEM', color: '#0E7C86', icon: 'M9 3h6v2h-1v4.6l5.2 8.6A1.8 1.8 0 0 1 17.7 21H6.3a1.8 1.8 0 0 1-1.5-2.8L10 9.6V5H9z' },
  { id: 'academics', label: 'Reading & homework', color: '#A16207', icon: 'M4 5a2 2 0 0 1 2-2h13v16H6.5a.5.5 0 0 0 0 1H19v2H6a2 2 0 0 1-2-2z' },
  { id: 'games', label: 'Games', color: '#B4237A', icon: 'M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm2.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z' },
  { id: 'nature', label: 'Nature & outdoors', color: '#4D6B1F', icon: 'M5 21c0-7 4-13 14-16-1 9-5 14-11 15l3-7-4 8z' },
  { id: 'daycamp', label: 'All-round day camp', color: '#0B6E99', icon: 'M12 2 2 20h20zm0 5.5 5.6 10.5H13v-4h-2v4H6.4z' },
  { id: 'clubs', label: 'School clubs', color: '#2166B8', icon: 'M5 3h2v1h11l-2.5 4L18 12H7v9H5z' },
  { id: 'rec-center', label: 'Rec centers', color: '#3F6212', icon: 'M12 2 6 10h3l-4 6h6v5h2v-5h6l-4-6h3z' },
];
const TYPE = Object.fromEntries(TYPES.map(t => [t.id, t]));
// Themed weeks on the roster page: pick a school and a theme, and the page fills Monday to Friday at random from the
// programs of those types. A "mix" theme tries for a different kind of program each day. "words" also lets in any
// program with one of those keywords (the "keywords" list in data/programs.json), whatever its type, so a theme
// with no type of its own fills up as matching programs are listed. To add a theme, add a line.
const DICE = 'M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm2.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z';
const THEMES = [
  { id: 'music', name: 'Music Prodigy', blurb: 'Music every day', types: ['music'] },
  { id: 'mathlete', name: 'Mathlete', blurb: 'STEM, chess and homework help', types: ['stem', 'games'], words: ['homework help', 'math'] },
  { id: 'davinci', name: 'The Da Vinci', blurb: 'Art, science and music', types: ['art', 'stem', 'music'], mix: true },
  { id: 'move', name: 'Move It or Lose It', blurb: 'On their feet all week', types: ['movement'] },
  { id: 'crafts', name: 'Glitter and Glue', blurb: 'Arts and crafts all week', types: ['art'] },
  { id: 'bookworm', name: 'Bookworm', blurb: 'Reading, writing and the library', types: ['academics'] },
  { id: 'fun', name: 'Just for Fun', blurb: 'Games, play and rec time', types: ['games', 'rec-center'], words: ['play', 'games'] },
  { id: 'outside', name: 'Wild Child', blurb: 'Outside whenever possible', types: [], words: ['gardening', 'garden', 'nature', 'outdoors', 'outdoor', 'running', 'hiking', 'farm', 'environment'], icon: 'M12 2 6 10h3l-4 6h6v5h2v-5h6l-4-6h3z', color: '#3F6212' },
  { id: 'sampler', name: 'Jack of All Trades', blurb: 'Something different every day', types: ['music', 'art', 'movement', 'stem', 'academics', 'games'], mix: true, icon: DICE, color: '#0F4D90' },
];
const typeIcon = (t, size = 18) => `<svg class="ticon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="${t.icon}"/></svg>`;

// ---------- site copy ----------
// Every sentence of site copy goes through T(). data/copy.json can replace any of them without touching
// this file: entries are keyed by a fingerprint of the original sentence and hold { was, now }.
// {name} tokens inside a sentence are filled in per page (the school's name, the dismissal time).
const copyEdits = fs.existsSync(path.join(ROOT, 'data/copy.json')) ? readJson('data/copy.json') : {};
const copyRegistry = new Map();
const copyId = text => createHash('sha1').update(text).digest('hex').slice(0, 10);
// An entry whose "now" is empty takes the sentence off the page: T() leaves a marker, and write() drops a list item,
// paragraph or heading that holds nothing else (so a benefit can be removed from a list in edit mode).
const REMOVED = '<!--pas-rm-->';
const isRemoved = id => typeof copyEdits[id]?.now === 'string' && copyEdits[id].now === '';
function T(original, vars) {
  const id = copyId(original);
  copyRegistry.set(id, original);
  if (isRemoved(id)) return REMOVED;
  const now = typeof copyEdits[id]?.now === 'string' ? copyEdits[id].now : original;
  const shown = vars ? now.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : now;
  // A sentence someone reworded carries the original too, so edit mode can show what it said (the editor's
  // "Show what’s changed"). Who changed it stays out of the page: edit mode asks the server for that.
  const was = now !== original ? ` data-was="${esc(original)}"` : '';
  return `<span data-copy="${id}"${was}${vars ? ` data-tpl="${esc(now)}" data-vars="${esc(JSON.stringify(vars))}"` : ''}>${esc(shown)}</span>`;
}
// The same sentence as plain text, with any approved edit applied: for places that can't hold a span, such as the
// description a link preview shows.
const copyNow = original => (typeof copyEdits[copyId(original)]?.now === 'string' ? copyEdits[copyId(original)].now : original);
// A sentence of an email the build words itself (the school-added email goes out through Klaviyo from the alerts
// feed): registered like a page sentence and listed at /edit/emails/ under the email's name, with any edit applied
// and {words} filled in from vars. An emptied sentence is ''.
const SITE_EMAILS = [];   // [{ name, sentences: [original, …] }], shown after the server's emails
function emailCopy(name, original, vars) {
  const id = copyId(original);
  copyRegistry.set(id, original);
  let e = SITE_EMAILS.find(x => x.name === name);
  if (!e) { e = { name, sentences: [] }; SITE_EMAILS.push(e); }
  if (!e.sentences.includes(original)) e.sentences.push(original);
  const now = isRemoved(id) ? '' : copyNow(original);
  return vars ? now.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : now;
}
// Drops the elements an emptied sentence left behind: a list item, paragraph or heading whose only content is the
// marker, whitespace, empty <b>/<strong>, or elements hidden from readers (a callout number). Then the markers go.
const EMPTYISH = String.raw`(?:\s|<!--pas-rm-->|<(?:b|strong|em|i)>(?:\s|<!--pas-rm-->)*</(?:b|strong|em|i)>|<i\b[^>]*aria-hidden="true"[^>]*>[^<]*</i>|<br\s*/?>)*`;
const DROP_RE = new RegExp(String.raw`<(li|p|h[1-6]|dt|dd)\b[^>]*>` + EMPTYISH + String.raw`</\1>\s*`, 'g');
function dropEmpty(html) {
  if (!html.includes(REMOVED)) return html;
  let out = html;
  for (let i = 0; i < 3; i++) { const next = out.replace(DROP_RE, m => (m.includes(REMOVED) ? '' : m)); if (next === out) break; out = next; }
  return out.replace(/<(b|strong)>\s*<!--pas-rm-->\s*<\/\1>\s*/g, '').replace(/<!--pas-rm-->/g, '');
}
// A short fingerprint of each asset, added to its URL. When the file changes, the URL changes,
// so browsers and the host's CDN fetch the new one instead of a cached copy.
const stamp = f => PREVIEW ? '' : '?v=' + createHash('sha1').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);
const CSS_V = stamp('src/site.css'), JS_V = stamp('src/site.js'), EDIT_V = stamp('src/edit.js'), GROUPS_V = stamp('src/groups.js');

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (to, depth) => {
  if (depth < 0) return '/' + to;                       // absolute, for the 404 page
  let p = '../'.repeat(depth) + to;
  if (PREVIEW && (to === '' || to.endsWith('/'))) p += 'index.html';
  return p || './';
};
const expandGrades = g => {
  if (g == null) return null;
  const [a, b] = String(g).replace('–', '-').split('-').map(x => x.trim());
  const i = GRADES.indexOf(a), j = b === undefined ? i : GRADES.indexOf(b);
  if (i < 0 || j < i) throw new Error(`Bad grades value "${g}"`);
  return GRADES.slice(i, j + 1);
};
const longDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const telHref = p => 'tel:+1' + p.replace(/\D/g, '');

// ---------- validation: fail the build on bad data, so mistakes never reach the site ----------
const errors = [];
// What's on at each school (data/school-dates.json): weekly things and single days, each approved before it goes in.
const schoolDatesFile = fs.existsSync(path.join(ROOT, 'data/school-dates.json')) ? readJson('data/school-dates.json') : { schools: {} };
const WEEKDAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri'];
for (const [id, sd] of Object.entries(schoolDatesFile.schools || {})) {
  const at = `data/school-dates.json, "${id}"`;
  if (!schools.some(x => x.id === id)) errors.push(`${at}: there is no school with that id in data/schools.json`);
  const source = (e, where) => { if (!['school', 'parent'].includes(e?.by)) errors.push(`${where}: "by" must be "school" or "parent"`); if (e?.by === 'school' && !/^https?:\/\//.test(e.url || '')) errors.push(`${where}: an entry from the school needs the "url" it came from`); if (typeof e?.title !== 'string' || !e.title.trim() || e.title.length > 80) errors.push(`${where}: "title" is needed, up to 80 characters`); if (e?.note !== undefined && (typeof e.note !== 'string' || e.note.length > 160)) errors.push(`${where}: "note" is a sentence of up to 160 characters`); };
  for (const [i, e] of (sd.weekly || []).entries()) { const w = `${at}, weekly ${i + 1}`; source(e, w); if (!WEEKDAY_IDS.includes(e?.day)) errors.push(`${w}: "day" must be one of ${WEEKDAY_IDS.join(', ')}`); for (const k of ['from', 'until']) if (e?.[k] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(e[k])) errors.push(`${w}: "${k}" must be YYYY-MM-DD`); }
  for (const [i, e] of (sd.dates || []).entries()) { const w = `${at}, dates ${i + 1}`; source(e, w); if (!/^\d{4}-\d{2}-\d{2}$/.test(e?.date || '')) errors.push(`${w}: "date" must be YYYY-MM-DD`); }
}
const isUrl = u => /^https:\/\/\S+$/.test(u || '');
// ---------- links out to programs ----------
// Every link to a program's own site carries UTM tags, so the program can see in its own analytics what this
// site sent it: the source is this site, the campaign is the school the visitor was looking at (or "directory"),
// and the content is the kind of link (register, website, camp, source, calendar). The tags are added as plain
// text, so the rest of the address is left exactly as it was. Set "outboundUtm": false in site.config.json to
// switch them off, or "noUtm": true on one program if its site breaks with extra tags. District, city and library
// addresses are never tagged.
const UTM = cfg.outboundUtm === false ? null : { source: new URL(cfg.siteUrl).host, medium: 'referral', skip: ['philasd.org', 'phila.gov', 'freelibrary.org'], ...(cfg.outboundUtm || {}) };
const outUrl = (url, { type, school = null, program = null } = {}) => {
  if (!UTM || !url || program?.noUtm || /[?&]utm_/.test(url)) return url;
  const host = (url.match(/^https?:\/\/([^/?#]+)/) || [])[1] || '';
  if (UTM.skip.some(d => host === d || host.endsWith('.' + d))) return url;   // schools, the city and the library have no use for the tags
  const cut = url.indexOf('#'), base = cut < 0 ? url : url.slice(0, cut), hash = cut < 0 ? '' : url.slice(cut);
  const tags = `utm_source=${encodeURIComponent(UTM.source)}&utm_medium=${encodeURIComponent(UTM.medium)}&utm_campaign=${encodeURIComponent(school?.id || 'directory')}&utm_content=${encodeURIComponent(type || 'link')}`;
  return base + (base.includes('?') ? (/[?&]$/.test(base) ? '' : '&') : '?') + tags + hash;
};
const bareHost = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
// A source link is tagged only when it points at the program's own site, not at a school or city page.
const ownHosts = p => new Set([p.website, p.register?.url, p.daysOff?.url, ...Object.values(p.schools || {}).map(l => l.registerUrl)].filter(Boolean).map(bareHost));
const ids = new Set();
const schoolIds = new Set(schools.map(s => s.id));
for (const p of programs) {
  const at = `program "${p.id || p.name}"`;
  if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) errors.push(`${at}: id must be lowercase letters, numbers and dashes`);
  if (ids.has(p.id)) errors.push(`${at}: duplicate id`);
  ids.add(p.id);
  for (const f of ['name', 'what', 'hours', 'cost', 'lastVerified']) if (!p[f]) errors.push(`${at}: missing ${f}`);
  if (p.lastVerified && !/^\d{4}-\d{2}-\d{2}$/.test(p.lastVerified)) errors.push(`${at}: lastVerified must be YYYY-MM-DD`);
  if (!isUrl(p.website)) errors.push(`${at}: website must be an https URL`);
  try { p._grades = expandGrades(p.grades); } catch (e) { errors.push(`${at}: ${e.message}`); }
  if (!p.register || !HOW.includes(p.register.how)) errors.push(`${at}: register.how must be one of ${HOW.join(', ')}`);
  if (!p.sources?.length) errors.push(`${at}: needs at least one source`);
  for (const s of p.sources || []) if (!isUrl(s.url)) errors.push(`${at}: source "${s.label}" needs an https URL`);
  // A listing with no school is allowed only for a place that runs day camps and nothing on a weekday afternoon.
  if (!p.schools) p.schools = {};
  if (!Object.keys(p.schools).length && !p.daysOff && !p.weekend) errors.push(`${at}: not linked to any school (only a listing with "daysOff" or "weekend" may leave "schools" empty)`);
  if (p.weekend !== undefined) {   // Saturday or Sunday classes
    const w = p.weekend;
    if (!w || typeof w.summary !== 'string' || !w.summary.trim()) errors.push(`${at}: weekend needs a summary`);
    else {
      if (!Array.isArray(w.days) || !w.days.length || w.days.some(d => !['sat', 'sun'].includes(d))) errors.push(`${at}: weekend.days must list "sat", "sun" or both`);
      if (!isUrl(w.url)) errors.push(`${at}: weekend.url must be an https URL`);
      if (!w.sources?.length || w.sources.some(x => !isUrl(x.url) || !x.label)) errors.push(`${at}: weekend needs at least one source with a label and an https URL`);
      if (w.times !== undefined && (!w.times || typeof w.times !== 'object' || Object.entries(w.times).some(([k, v]) => !(w.days || []).includes(k) || typeof v !== 'string' || !v.trim()))) errors.push(`${at}: weekend.times gives a short time range for a day in weekend.days, like { "sat": "9 am to 1 pm" }`);
      if (w.grades !== undefined) { try { w._grades = expandGrades(w.grades); } catch (e) { errors.push(`${at}: weekend.grades: ${e.message}`); } }
      if (w.check && (!isUrl(w.check.url) || !['fetch', 'browser', 'person'].includes(w.check.how) || !w.check.look)) errors.push(`${at}: weekend.check needs url, how (fetch, browser or person) and look`);
    }
  }
  for (const [sid, l] of Object.entries(p.schools || {})) {
    if (!schoolIds.has(sid)) errors.push(`${at}: unknown school "${sid}"`);
    if (!REL[l.relation]) errors.push(`${at}: relation for ${sid} must be onsite, pickup or nearby`);
    if (l.registerUrl && !isUrl(l.registerUrl)) errors.push(`${at}: registerUrl for ${sid} must be an https URL`);
    if (l.price !== undefined && !['free', 'paid', 'both'].includes(l.price)) errors.push(`${at}: price for ${sid} must be "free", "paid" or "both"`);
    for (const s of l.sources || []) if (!isUrl(s.url)) errors.push(`${at}: source "${s.label}" for ${sid} needs an https URL`);
    if (l.checked !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(l.checked)) errors.push(`${at}: checked for ${sid} must be YYYY-MM-DD`);
    if (p.register?.how === 'online' && !isUrl(l.registerUrl || p.register.url)) errors.push(`${at}: online registration needs a URL`);
  }
  if (['phone', 'school'].includes(p.register?.how) && !p.phone) errors.push(`${at}: register by phone needs a phone number`);
  // What the program itself told us, as opposed to what its site says: the fields it covers are its word, and a check
  // leaves them alone (see "Keeping it current"). A question for the program's managers ("asks") goes out by email once.
  if (p.told !== undefined) {
    if (!Array.isArray(p.told) || !p.told.length) errors.push(`${at}: told must be a list`);
    else for (const t of p.told) {
      if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t.on || '')) errors.push(`${at}: each told entry needs "on", the date (YYYY-MM-DD)`);
      if (!['program manager', 'provider', 'school'].includes(t?.by)) errors.push(`${at}: a told entry's "by" must be program manager, provider or school`);
      if (typeof t?.how !== 'string' || !t.how.trim()) errors.push(`${at}: a told entry needs "how" (an email through the suggestion form, a change proposed from the claim, …)`);
      if (!Array.isArray(t?.fields) || !t.fields.length || t.fields.some(f => typeof f !== 'string' || !f.trim())) errors.push(`${at}: a told entry needs "fields", the fields it covers`);
      if (typeof t?.says !== 'string' || !t.says.trim()) errors.push(`${at}: a told entry needs "says", what was said, in a sentence`);
    }
  }
  if (p.asks !== undefined) {
    if (!Array.isArray(p.asks)) errors.push(`${at}: asks must be a list`);
    else for (const a of p.asks) {
      if (!a || typeof a.id !== 'string' || !/^[a-z0-9-]{3,60}$/.test(a.id)) errors.push(`${at}: each ask needs an "id" of letters, digits and dashes`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a?.on || '')) errors.push(`${at}: each ask needs "on", the date it was raised (YYYY-MM-DD)`);
      if (typeof a?.question !== 'string' || !a.question.trim() || a.question.length > 600) errors.push(`${at}: each ask needs a "question" of up to 600 characters`);
    }
    if (new Set((p.asks || []).map(a => a?.id)).size !== (p.asks || []).length) errors.push(`${at}: ask ids must be different from one another`);
  }
  // The provider's pickup lists, kept as they were last read, so the next check is a comparison and not fresh research.
  if (p.pickupLists !== undefined) {
    if (!Array.isArray(p.pickupLists) || !p.pickupLists.length) errors.push(`${at}: pickupLists must be a list`);
    else for (const x of p.pickupLists) {
      if (!x || typeof x.text !== 'string' || !x.text.trim()) { errors.push(`${at}: every pickup list needs its text`); continue; }
      if (!isUrl(x.url)) errors.push(`${at}: a pickup list needs the https URL it was read from`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(x.read || '')) errors.push(`${at}: a pickup list needs "read", the date it was read (YYYY-MM-DD)`);
      if (!['browser', 'fetch', 'person'].includes(x.how)) errors.push(`${at}: a pickup list's "how" must be browser, fetch or person`);
      if (x.by !== undefined && !['provider', 'school', 'third-party'].includes(x.by)) errors.push(`${at}: a pickup list's "by" must be provider, school or third-party`);
      for (const f of ['where', 'note']) if (x[f] !== undefined && (typeof x[f] !== 'string' || !x[f].trim())) errors.push(`${at}: a pickup list's ${f} must be text`);
    }
  }
}
// Pages that can't be trusted through a plain fetch: some serve an old copy, some are JavaScript apps, some block
// automated reading. The monthly check reads this before deciding what a page "says".
const reading = fs.existsSync(path.join(ROOT, 'data/reading.json')) ? readJson('data/reading.json') : [];
if (!Array.isArray(reading)) errors.push('data/reading.json must be a list');
else for (const r of reading) {
  if (!r || typeof r.match !== 'string' || !r.match.trim() || /^https?:/.test(r.match)) errors.push('data/reading.json: every entry needs "match", a site or page address without https://');
  else if (!['browser', 'person'].includes(r.how)) errors.push(`data/reading.json: "${r.match}" how must be browser or person`);
  else if (typeof r.why !== 'string' || !r.why.trim()) errors.push(`data/reading.json: "${r.match}" needs a "why"`);
}
const howToRead = url => { const bare = String(url).replace(/^https?:\/\/(www\.)?/, ''); return (Array.isArray(reading) ? reading : []).find(r => r && typeof r.match === 'string' && bare.startsWith(r.match.replace(/^www\./, ''))) || null; };
// Is this school named in a stored pickup list? Names are matched loosely ("Vare Washington" is "Vare-Washington").
const flat = v => String(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const namesSchool = (text, s) => [s.shortName, ...(s.aliases || [])].some(a => (' ' + flat(text) + ' ').includes(' ' + flat(a) + ' '));
// What the monthly check works from: every page to read (once, however many listings lean on it), what it said last
// time, and every program-to-school link with the date it was last confirmed and what backs it.
function checkList() {
  const pages = new Map();
  const page = url => { if (!pages.has(url)) { const r = howToRead(url); pages.set(url, { url, how: r ? r.how : 'fetch', ...(r ? { why: r.why } : {}), programs: [], lists: [] }); } return pages.get(url); };
  const links = [];
  for (const p of programs) {
    const mine = new Set([p.website, p.register?.url, ...(p.sources || []).map(x => x.url), ...(p.daysOff?.sources || []).map(x => x.url), p.daysOff?.url,
      ...Object.values(p.schools).flatMap(l => [l.registerUrl, ...(l.sources || []).map(x => x.url)]), ...(p.pickupLists || []).map(x => x.url)].filter(isUrl));
    for (const u of mine) page(u).programs.push(p.id);
    for (const x of p.pickupLists || []) page(x.url).lists.push({ program: p.id, ...(x.where ? { where: x.where } : {}), text: x.text, read: x.read, how: x.how, by: x.by || 'provider' });
    for (const [sid, l] of Object.entries(p.schools)) {
      const s = schools.find(x => x.id === sid);
      const row = { program: p.id, school: sid, relation: l.relation, checked: l.checked || p.lastVerified };
      if (l.relation === 'pickup') {
        const named = (p.pickupLists || []).filter(x => namesSchool(x.text, s));
        const own = named.find(x => (x.by || 'provider') !== 'third-party') || null;
        const hit = own || named[0] || null;
        row.basis = own ? 'list' : (l.sources || []).length ? 'own-source' : hit ? 'third-party-list' : 'none';
        if (hit) row.list = { ...(hit.where ? { where: hit.where } : {}), read: hit.read, how: hit.how, by: hit.by || 'provider' };
        // The provider publishes a list, it has been read, and this school isn't on it.
        if (!own && (p.pickupLists || []).some(x => (x.by || 'provider') === 'provider')) row.notOnProviderList = true;
      }
      links.push(row);
    }
  }
  const rank = r => (r.basis === 'none' ? 0 : r.notOnProviderList ? 1 : 2);
  links.sort((a, b) => rank(a) - rank(b) || a.checked.localeCompare(b.checked) || a.program.localeCompare(b.program) || a.school.localeCompare(b.school));
  const pickup = links.filter(r => r.relation === 'pickup');
  return {
    about: 'Made by build.mjs from data/programs.json, data/schools.json and data/reading.json. README.md, "Keeping it current", says how to use it.',
    summary: { pages: pages.size, pagesNeedingABrowser: [...pages.values()].filter(x => x.how === 'browser').length, pagesNeedingAPerson: [...pages.values()].filter(x => x.how === 'person').length,
      links: links.length, pickupLinks: pickup.length, pickupOnAStoredList: pickup.filter(r => r.basis === 'list').length, pickupFromAThirdPartyList: pickup.filter(r => r.basis === 'third-party-list').length,
      pickupOnItsOwnSource: pickup.filter(r => r.basis === 'own-source').length, pickupWithNothingBehindIt: pickup.filter(r => r.basis === 'none').length, pickupNotOnTheProvidersList: pickup.filter(r => r.notOnProviderList).length,
      oldestCheck: links.map(r => r.checked).sort()[0] || '' },
    links,
    pages: [...pages.values()].sort((a, b) => b.programs.length - a.programs.length || a.url.localeCompare(b.url)),
    // Weekend classes: one row per listing with a "weekend" block, oldest check first, each with the quickest way to read it again.
    weekend: programs.filter(p => p.weekend).map(p => ({ program: p.id, term: p.weekend.term || '', checked: p.weekend.checked || p.lastVerified, ...(p.weekend.check || { url: p.weekend.url, how: 'fetch', look: '' }) }))
      .sort((a, b) => a.checked.localeCompare(b.checked) || a.program.localeCompare(b.program)),
    // What programs told us themselves: those fields are the program's word, and a check never changes them from the site.
    // "stale" means it is older than TOLD_DAYS with nothing newer covering the same fields: the morning job asks the
    // program's managers to confirm it; a listing with no manager is for the owner to ask.
    told: programs.filter(p => p.told).flatMap(p => p.told.map(t => ({ program: p.id, name: fullName(p), on: t.on, by: t.by, how: t.how, fields: t.fields, says: t.says, daysAgo: daysSince(t.on), stale: staleTold(p).includes(t) })))
      .sort((a, b) => a.on.localeCompare(b.on) || a.program.localeCompare(b.program)),
    // Open questions for programs' managers, each emailed once by the morning job to whoever holds the listing.
    asks: programs.filter(p => asksFor(p).length).map(p => ({ program: p.id, name: fullName(p), asks: asksFor(p) })),
    // Summer camps: the camps still showing an older summer come first, then the oldest checks. "todo" is the camps not read yet.
    camps: campsFile ? {
      season: campsFile.season,
      summary: { camps: summerCamps.length, showingNextSummer: summerCamps.filter(c => c.season > campsFile.season).length, needingABrowser: summerCamps.filter(c => c.check.how === 'browser').length, needingAPerson: summerCamps.filter(c => c.check.how === 'person').length, notReadYet: (campsFile.todo || []).length },
      list: summerCamps.map(c => ({ camp: c.id, name: c.name, season: c.season || null, checked: c.checked, ...c.check, ...(c.signup ? { signup: c.signup } : {}) }))
        .sort((a, b) => (a.season || 0) - (b.season || 0) || a.checked.localeCompare(b.checked) || a.camp.localeCompare(b.camp)),
      todo: campsFile.todo || [],
      dropped: campsFile.dropped || [],
    } : null,
  };
}
// A school's own clubs can be listed one by one under "clubs": each with a name and, when the school says, what it
// is, its days, time, grades, season, sign-up status, a note, and tags (program types and keywords, for the themed
// weeks). They become the listing's classes, so a roster can say which club and which day. "roster": false keeps
// one off the roster (a lunchtime club, say) while still listing it.
for (const p of programs) {
  if (p.clubs === undefined) continue;
  const at = `program "${p.id}"`;
  if (!Array.isArray(p.clubs) || !p.clubs.length) { errors.push(`${at}: clubs must be a list`); continue; }
  if (p.offers !== undefined || p.offerDays !== undefined) errors.push(`${at}: use clubs or offers, not both`);
  p._cls = {};
  for (const c of p.clubs) {
    if (!c || typeof c.name !== 'string' || !c.name.trim()) { errors.push(`${at}: every club needs a name`); continue; }
    for (const f of ['what', 'time', 'when', 'status', 'note', 'gradeNote']) if (c[f] !== undefined && (typeof c[f] !== 'string' || !c[f].trim())) errors.push(`${at}: club "${c.name}" ${f} must be text`);
    if (c.days !== undefined && !(Array.isArray(c.days) && c.days.length && c.days.every(d => WEEK.includes(d)))) errors.push(`${at}: club "${c.name}" days must list some of ${WEEK.join(', ')}`);
    if (c.tags !== undefined && (!Array.isArray(c.tags) || c.tags.some(x => typeof x !== 'string'))) errors.push(`${at}: club "${c.name}" tags must be a list of words`);
    try { c._grades = expandGrades(c.grades); } catch (e) { errors.push(`${at}: club "${c.name}": ${e.message}`); c._grades = null; }
    if (c.roster !== false) p._cls[c.name] = { g: c._grades, t: (c.tags || []).map(t => t.toLowerCase()) };
  }
  for (const c of p.clubs) for (const t of c.tags || []) if (TYPE[t] && Array.isArray(p.types) && !p.types.includes(t)) p.types.push(t);
  const onRoster = p.clubs.filter(c => c.roster !== false && typeof c.name === 'string');
  p.offers = onRoster.map(c => c.name);
  const od = Object.fromEntries(onRoster.filter(c => Array.isArray(c.days)).map(c => [c.name, c.days]));
  if (Object.keys(od).length) p.offerDays = od;
}
for (const p of programs) {
  if (p.keywords !== undefined && (!Array.isArray(p.keywords) || p.keywords.some(x => typeof x !== 'string'))) errors.push(`program "${p.id}": keywords must be a list of words`);
  // Class names travel inside roster share links, so they can't contain the characters links use as separators.
  if (p.offers !== undefined && (!Array.isArray(p.offers) || p.offers.some(x => typeof x !== 'string' || /[~,&=#]/.test(x)))) errors.push(`program "${p.id}": offers must be a list of class names without commas or the symbols ~ & = #`);
}
for (const p of programs) {
  if (!Array.isArray(p.types) || !p.types.length || p.types.some(x => !TYPE[x])) errors.push(`program "${p.id}": types must list at least one of ${TYPES.map(t => t.id).join(', ')}`);
  if (p.price !== undefined && !['free', 'paid', 'both'].includes(p.price)) errors.push(`program "${p.id}": price must be "free", "paid" or "both" (leave it out when the provider doesn't publish a price)`);
  if (p.free !== undefined) errors.push(`program "${p.id}": "free" was replaced by "price" ("free", "paid" or "both")`);
  if (p.neighborhoods !== undefined && (!Array.isArray(p.neighborhoods) || !p.neighborhoods.length || p.neighborhoods.some(x => typeof x !== 'string' || !x.trim()))) errors.push(`program "${p.id}": neighborhoods must be a list of neighborhood names`);
}
// Days of the week a program runs, and what it does when school is closed.
const isIso = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const okDays = a => Array.isArray(a) && a.length > 0 && a.every(x => WEEK.includes(x)) && new Set(a).size === a.length;
for (const p of programs) {
  const at = `program "${p.id}"`;
  if (p.days !== undefined) { if (!okDays(p.days)) errors.push(`${at}: days must list some of ${WEEK.join(', ')} (leave it out when the provider doesn't say)`); else p.days = WEEK.filter(d => p.days.includes(d)); }
  if (p.daysNote !== undefined && (typeof p.daysNote !== 'string' || !p.daysNote.trim())) errors.push(`${at}: daysNote must be a sentence`);
  if (p.offerDays !== undefined) {
    if (!p.offerDays || typeof p.offerDays !== 'object' || Array.isArray(p.offerDays)) errors.push(`${at}: offerDays must map a class name to its days`);
    else for (const [o, a] of Object.entries(p.offerDays)) {
      if (!(p.offers || []).includes(o)) errors.push(`${at}: offerDays names "${o}", which isn't in offers`);
      if (!okDays(a)) errors.push(`${at}: offerDays for "${o}" must list some of ${WEEK.join(', ')}`); else p.offerDays[o] = WEEK.filter(d => a.includes(d));
    }
  }
  if (p.rate !== undefined) {   // a published price in a form the roster can add up
    const r = p.rate, num = x => typeof x === 'number' && x >= 0, amt = x => num(x) || (Array.isArray(x) && x.length === 2 && x.every(num) && x[0] <= x[1]);
    const shapes = ['flat', 'eachDay', 'byDays'].filter(k => r?.[k] !== undefined);
    if (!r || !['day', 'week', 'month', 'term'].includes(r.per)) errors.push(`${at}: rate.per must be day, week, month or term`);
    else if (shapes.length !== 1) errors.push(`${at}: rate needs exactly one of flat, eachDay or byDays`);
    else if (shapes[0] === 'byDays' ? !(r.byDays && Object.entries(r.byDays).length && Object.entries(r.byDays).every(([k, v]) => /^[1-5]$/.test(k) && num(v))) : !amt(r[shapes[0]])) errors.push(`${at}: rate amounts must be numbers (or a [low, high] pair), and byDays keys 1 to 5`);
    else if (r.per === 'day' && shapes[0] !== 'eachDay') errors.push(`${at}: a per-day rate uses eachDay`);
  }
  if (p.daysOff !== undefined) {
    const o = p.daysOff;
    if (!o || typeof o.summary !== 'string' || !o.summary.trim()) errors.push(`${at}: daysOff needs a summary`);
    else {
      if (!isUrl(o.url)) errors.push(`${at}: daysOff.url must be an https URL`);
      if (!Array.isArray(o.dates) || o.dates.some(d => !isIso(d))) errors.push(`${at}: daysOff.dates must be a list of YYYY-MM-DD dates (an empty list when none are posted)`);
      if (!o.sources?.length || o.sources.some(x => !isUrl(x.url) || !x.label)) errors.push(`${at}: daysOff needs at least one source with a label and an https URL`);
      for (const k of ['hours', 'cost']) if (o[k] !== undefined && (typeof o[k] !== 'string' || !o[k].trim())) errors.push(`${at}: daysOff.${k} must be a short line of text when given`);
      for (const k of ['ageMin', 'ageMax']) if (o[k] !== undefined && (!Number.isInteger(o[k]) || o[k] < 2 || o[k] > 19)) errors.push(`${at}: daysOff.${k} must be a whole number of years when given`);
      if (o.ageMin && o.ageMax && o.ageMin > o.ageMax) errors.push(`${at}: daysOff.ageMin is above ageMax`);
    }
  }
}
if (daysOff) {
  if (!daysOff.schoolYear || !isUrl(daysOff.source?.url) || !isIso(daysOff.checked) || !Array.isArray(daysOff.days)) errors.push('data/days-off.json: needs schoolYear, source.url, checked and days');
  else for (const d of daysOff.days) if (!isIso(d.date) || !d.name || (d.end !== undefined && (!isIso(d.end) || d.end < d.date))) errors.push(`data/days-off.json: each day needs a date and a name, and an end on or after it (${d.date || '?'})`);
}
for (const p of programs) for (const d of p.register?.dates || []) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '') || !d.label) errors.push(`program "${p.id}": each register.dates entry needs a date (YYYY-MM-DD) and a label`);
  if (d.posted !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(d.posted)) errors.push(`program "${p.id}": "posted" on a register.dates entry is the day it was added here (YYYY-MM-DD)`);
}
// A school's "added" is the day its page went up. People who asked to be told get one email that morning or the next.
for (const s of schools) if (s.added !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(s.added)) errors.push(`school "${s.id}": added must be YYYY-MM-DD, the day its page went live`);
// "updates" are short dated notes about a program (a new price, a new class). They are emailed to the people following it.
for (const p of programs) if (p.updates !== undefined) {
  if (!Array.isArray(p.updates) || p.updates.some(u => !/^\d{4}-\d{2}-\d{2}$/.test(u?.date || '') || typeof u.text !== 'string' || !u.text.trim() || u.text.length > 300)) errors.push(`program "${p.id}": each updates entry needs a date (YYYY-MM-DD) and a text of up to 300 characters`);
}
reviews.forEach((r, i) => {
  const at = `review ${i + 1}`;
  if (!ids.has(r.programId)) errors.push(`${at}: unknown programId "${r.programId}"`);
  if (!schoolIds.has(r.school)) errors.push(`${at}: unknown school "${r.school}"`);
  if (!Number.isInteger(r.stars) || r.stars < 1 || r.stars > 5) errors.push(`${at}: stars must be a whole number from 1 to 5`);
  if (!r.name || !r.comment) errors.push(`${at}: needs a name and a comment`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) errors.push(`${at}: date must be YYYY-MM-DD`);
});
for (const [id, e] of Object.entries(copyEdits)) {
  if (!e || typeof e.now !== 'string') errors.push(`data/copy.json: entry "${id}" needs a "now" with the new wording (an empty one takes the sentence off the page)`);
}
// Accounts that open the owner's pages (/edit/, the numbers, the claims) by signing in to the site like anyone else.
const ADMINS = [...new Set((Array.isArray(cfg.admins) ? cfg.admins : []).map(a => String(a).trim().toLowerCase()))];
if (cfg.admins !== undefined && (!Array.isArray(cfg.admins) || ADMINS.some(a => !/^[^@\s"'<>\\]+@[^@\s"'<>\\]+\.[a-z]{2,}$/.test(a)))) errors.push('site.config.json: admins must be a list of email addresses');
if (cfg.editLogin && (!cfg.editLogin.user || !/^\$2[aby]\$\d\d\$[.\/A-Za-z0-9]{53}$/.test(cfg.editLogin.passwordHash || ''))) {
  errors.push('site.config.json: editLogin needs a user and a passwordHash (a bcrypt hash, never the password itself)');
}
{
  const seenCamp = new Set();
  for (const c of summerCamps) {
    const at = `camp "${c.id || c.name || '?'}"`;
    if (!/^[a-z0-9-]+$/.test(c.id || '')) errors.push(`${at}: id must be lowercase letters, digits and dashes`);
    if (seenCamp.has(c.id)) errors.push(`${at}: duplicate id`); seenCamp.add(c.id);
    for (const k of ['name', 'what']) if (!c[k]) errors.push(`${at}: missing ${k}`);
    if (!Array.isArray(c.types) || !c.types.length || c.types.some(x => !TYPE[x])) errors.push(`${at}: types must list at least one of ${TYPES.map(t => t.id).join(', ')}`);
    if (!isUrl(c.website)) errors.push(`${at}: website must be an https URL`);
    if (c.registerUrl !== undefined && !isUrl(c.registerUrl)) errors.push(`${at}: registerUrl must be an https URL`);
    if (!c.sources?.length || c.sources.some(x => !isUrl(x.url) || !x.label)) errors.push(`${at}: needs at least one source with a label and an https URL`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.checked || '')) errors.push(`${at}: checked must be YYYY-MM-DD`);
    if (c.season !== undefined && !(Number.isInteger(c.season) && c.season >= 2025 && c.season <= 2100)) errors.push(`${at}: season is the summer the details describe, like 2026 (leave it out when the listing has no dated details)`);
    for (const k of ['ageMin', 'ageMax', 'weekly']) if (c[k] !== undefined && !(typeof c[k] === 'number' && c[k] >= 0)) errors.push(`${at}: ${k} must be a number`);
    if (c.price !== undefined && !['free', 'paid'].includes(c.price)) errors.push(`${at}: price must be "free" or "paid"`);
    if (c.program !== undefined && !programs.some(p => p.id === c.program)) errors.push(`${at}: program "${c.program}" is not a listing in data/programs.json`);
    // "dates" are the camp's own sign-up dates and "updates" are short dated notes. Both are emailed to the people who asked about the camp.
    if (c.dates !== undefined && (!Array.isArray(c.dates) || c.dates.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d?.date || '') || typeof d.label !== 'string' || !d.label.trim() || d.label.length > 120))) errors.push(`${at}: each dates entry needs a date (YYYY-MM-DD) and a label of up to 120 characters`);
    if (Array.isArray(c.dates) && c.dates.some(d => d?.posted !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(d.posted))) errors.push(`${at}: "posted" on a dates entry is the day it was added here (YYYY-MM-DD)`);
    if (c.updates !== undefined && (!Array.isArray(c.updates) || c.updates.some(u => !/^\d{4}-\d{2}-\d{2}$/.test(u?.date || '') || typeof u.text !== 'string' || !u.text.trim() || u.text.length > 300))) errors.push(`${at}: each updates entry needs a date (YYYY-MM-DD) and a text of up to 300 characters`);
    if (!c.check || !isUrl(c.check.url) || !['fetch', 'browser', 'person'].includes(c.check.how) || !c.check.look) errors.push(`${at}: check needs url, how (fetch, browser or person) and look: the quickest way to read this camp again`);
    // Grades for the shared grade picker, worked out from ages: pre-K is 3 and 4, kindergarten 5, 1st grade 6, and so on.
    const lo = c.ageMin ?? null, hi = c.ageMax ?? null;
    c._grades = lo === null && hi === null ? null : GRADES.filter(g => { const a = g === 'PK' ? 4 : g === 'K' ? 5 : Number(g) + 5; return (lo === null || a >= Math.floor(lo)) && (hi === null || a <= hi); });
    if (c._grades && !c._grades.length) c._grades = null;
    c.schools = {};
  }
}
if (errors.length) {
  console.error('Data problems found. Nothing was built.\n- ' + errors.join('\n- '));
  process.exit(1);
}

// ---------- page shell ----------
const gtmHead = cfg.gtmId && !PREVIEW ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(cfg.gtmId)}');</script>` : '';
// Who is looking, in one word: "visitor" (never signed in on this device), "parent" or "manager". It is set before Tag
// Manager loads, so every visit and event can be split by it, and handed to Clarity as a custom tag. No name, no
// address, no listing: the word comes from the last sign-in on this device (see noteRole in src/groups.js).
const roleHead = cfg.gtmId && !PREVIEW ? `<script>(function(w){var r='visitor',s='no';try{var v=localStorage.getItem('pas-role');if(v==='parent'||v==='manager')r=v;if(localStorage.getItem('pas-in')==='1')s='yes'}catch(e){}w.dataLayer=w.dataLayer||[];w.dataLayer.push({pas_role:r,pas_signed_in:s});w.clarity=w.clarity||function(){(w.clarity.q=w.clarity.q||[]).push(arguments)};w.clarity('set','role',r);w.clarity('set','signed_in',s)})(window);</script>
` : '';
// Klaviyo's own site script, on the same pages as Tag Manager and never on the quiet ones (account, profile,
// groups, invitations, the calendar, to-do, stop links, the edit tools). It sets Klaviyo's cookie so a visit that
// started from one of its emails can be tied to that address, and records the pages seen. The key is the public one.
const KLAVIYO_KEY = cfg.alerts && cfg.alerts.klaviyoKey && !PREVIEW ? String(cfg.alerts.klaviyoKey) : '';
const klaviyoHead = KLAVIYO_KEY ? `<script async type="text/javascript" src="https://static.klaviyo.com/onsite/js/${esc(KLAVIYO_KEY)}/klaviyo.js?company_id=${esc(KLAVIYO_KEY)}"></script>
<script>!function(){if(!window.klaviyo){window._klOnsite=window._klOnsite||[];try{window.klaviyo=new Proxy({},{get:function(n,i){return"push"===i?function(){var n;(n=window._klOnsite).push.apply(n,arguments)}:function(){for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)o[w]=arguments[w];var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))}));return e}}})}catch(n){window.klaviyo=window.klaviyo||[],window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}}}}();</script>
` : '';
const gtmBody = cfg.gtmId && !PREVIEW ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${esc(cfg.gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : '';
const correctionHref = (subject) => cfg.contactEmail ? `mailto:${cfg.contactEmail}?subject=${encodeURIComponent(subject)}` : null;

// The block: a row of rowhouses, a school with the city flag, and a bus. Drawn from a fixed seed so it never changes between builds.
// The day-off scene: the same block on a weekday with no school. Morning light, the school shut, the bus asleep
// out front, an empty swing and a kite going up. It sits on a yellow band, so the page reads as a different day.
function dayScene() {
  let seed = 23;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const G = 122;   // where things stand on the grass
  // the block behind the park, hazy in the morning sun
  let far = '', x = -10;
  while (x < 2010) { const w = 40 + Math.floor(rnd() * 26), h = 30 + Math.floor(rnd() * 40); far += `<rect class="far" x="${x}" y="${G - h - 4}" width="${w + 1}" height="${h + 8}"/>`; x += w; }
  const tree = (tx, r) => `<rect class="trunk" x="${tx - 2.5}" y="${G - r - 14}" width="5" height="${r + 16}"/><circle class="leaf2" cx="${tx - r * 0.35}" cy="${G - r - 20}" r="${r}"/><circle class="leaf" cx="${tx + r * 0.3}" cy="${G - r - 26}" r="${r * 0.9}"/>`;
  const trees = [[120, 20], [330, 16], [520, 22], [705, 17], [1265, 21], [1430, 16], [1620, 22], [1830, 18]].map(([tx, r]) => tree(tx, r)).join('');
  // the school, shades down
  const sx = 820, sw = 130, sy = 44;
  let school = `<rect class="sc" x="${sx}" y="${sy}" width="${sw}" height="${G - sy}"/><rect class="sct" x="${sx - 2}" y="${sy - 5}" width="${sw + 4}" height="6"/><polygon class="sc" points="${sx + 35},${sy - 5} ${sx + 65},${sy - 20} ${sx + 95},${sy - 5}"/>`;
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) school += `<rect class="shade" x="${sx + 10 + c * 23.5}" y="${sy + 12 + r * 26}" width="14" height="16"/>`;
  school += `<rect class="sct" x="${sx + 54}" y="${G - 24}" width="22" height="24"/>`;
  // the bus, parked and asleep
  let bus = `<rect class="by" x="0" y="0" width="50" height="21" rx="4"/><rect class="by" x="44" y="8" width="13" height="13" rx="3"/>`;
  for (let i = 0; i < 4; i++) bus += `<rect class="bw" x="${5 + i * 10.5}" y="4" width="7.5" height="7" rx="1"/>`;
  bus += `<circle class="wh" cx="12" cy="22" r="5"/><circle class="hub" cx="12" cy="22" r="1.8"/><circle class="wh" cx="42" cy="22" r="5"/><circle class="hub" cx="42" cy="22" r="1.8"/>`;
  const zs = [[1012, G - 30, 9], [1021, G - 41, 12], [1033, G - 54, 15]].map(([zx, zy, size]) => `<text class="zz" x="${zx}" y="${zy}" font-size="${size}">z</text>`).join('');
  // a swing set, one seat moving
  const wx = 1064, top = G - 50;
  const swing = `<path class="frame" d="M${wx - 22},${G} L${wx - 14},${top} H${wx + 34} L${wx + 42},${G}"/><g class="swing" style="transform-origin:${wx + 10}px ${top}px"><path class="rope" d="M${wx + 4},${top} V${G - 14} M${wx + 16},${top} V${G - 14}"/><rect class="seat" x="${wx + 1}" y="${G - 15}" width="18" height="4" rx="2"/></g>`;
  // someone small flying a kite: the string turns about the hand that holds it
  const hx = 1152, hy = G - 22, kx = 1112, ky = 28;
  const flyer = `<circle class="kid" cx="${hx + 5}" cy="${G - 27}" r="4.5"/><path class="kid" d="M${hx + 1},${G - 21} h8 l2,21 h-12z"/><path class="arm" d="M${hx + 3},${G - 19} L${hx},${hy}"/>`;
  const kite = `<g class="kite" style="transform-origin:${hx}px ${hy}px"><path class="string" d="M${hx},${hy} L${kx},${ky + 16}"/><path class="tail" d="M${kx},${ky + 16} q-7,8 0,15 t0,15"/><polygon class="bow" points="${kx - 5},${ky + 28} ${kx + 4},${ky + 31} ${kx - 4},${ky + 35}"/><polygon class="bow" points="${kx + 5},${ky + 41} ${kx - 4},${ky + 44} ${kx + 4},${ky + 48}"/><polygon class="kt" points="${kx},${ky - 16} ${kx + 12},${ky} ${kx},${ky + 16} ${kx - 12},${ky}"/><path class="spar" d="M${kx},${ky - 16} V${ky + 16} M${kx - 12},${ky} H${kx + 12}"/></g>`;
  return `<svg class="street dayscene" viewBox="0 0 2000 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${far}<path class="grass" d="M0,${G - 6} Q500,${G - 16} 1000,${G - 4} T2000,${G - 8} V140 H0Z"/>${trees}${school}<path class="grass2" d="M0,${G + 2} Q520,${G - 4} 1000,${G} T2000,${G} V140 H0Z"/><g transform="translate(962,${G - 26})">${bus}</g>${zs}${swing}${flyer}${kite}</svg>`;
}

// Saturday on the block, for the weekend classes page: the same row houses with a studio where the school would be,
// notes drifting up from its window, balloons by the door and someone arriving by bike.
function weekendScene() {
  let seed = 37;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const G = 128;
  const house = (x, w) => {
    const h = 54 + Math.floor(rnd() * 44), y = G - h, cols = w >= 56 ? 3 : 2, rows = Math.max(1, Math.floor((h - 38) / 22));
    const gap = (w - cols * 8) / (cols + 1);
    let s = `<rect class="hs${1 + Math.floor(rnd() * 3)}" x="${x}" y="${y}" width="${w}" height="${h}"/><rect class="cn" x="${x - 1}" y="${y - 4}" width="${w + 2}" height="5"/>`;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      s += `<rect class="${rnd() < 0.18 ? 'wl' : 'wd'}" x="${(x + gap + c * (8 + gap)).toFixed(1)}" y="${y + 10 + r * 22}" width="8" height="12"/>`;
    return s + `<rect class="dr" x="${(x + w / 2 - 5).toFixed(1)}" y="${G - 18}" width="10" height="18"/>`;
  };
  const run = (from, to) => { let s = '', x = from; while (x < to) { let w = 44 + Math.floor(rnd() * 22); if (to - x - w < 40) w = to - x; s += house(x, w); x += w; } return s; };
  // the studio: a sign over the top, a striped awning, one big lit window and a door
  const sx = 868, sw = 124, sy = 56;
  let studio = `<rect class="sc" x="${sx}" y="${sy}" width="${sw}" height="${G - sy}"/><rect class="sct" x="${sx - 2}" y="${sy - 5}" width="${sw + 4}" height="6"/><rect class="sign" x="${sx + 22}" y="${sy - 21}" width="${sw - 44}" height="16" rx="3"/>`;
  for (let i = 0; i < 5; i++) studio += `<circle class="bulb" cx="${sx + 34 + i * 14}" cy="${sy - 13}" r="2.6"/>`;
  for (let i = 0; i < 8; i++) studio += `<polygon class="${i % 2 ? 'aw2' : 'aw1'}" points="${sx - 4 + i * 16.5},${sy + 22} ${sx + 12.5 + i * 16.5},${sy + 22} ${sx + 10.5 + i * 16.5},${sy + 34} ${sx - 6 + i * 16.5},${sy + 34}"/>`;
  studio += `<rect class="scw" x="${sx + 12}" y="${sy + 40}" width="58" height="22" rx="2"/><rect class="sct" x="${sx + 40}" y="${sy + 40}" width="2" height="22"/><rect class="sct" x="${sx + 86}" y="${G - 32}" width="24" height="32"/><circle class="knob" cx="${sx + 105}" cy="${G - 15}" r="1.6"/>`;
  // three notes rising from the window, one after another
  const note = (nx, ny, k) => `<g class="note n${k}"><ellipse cx="${nx}" cy="${ny}" rx="3.6" ry="2.7" transform="rotate(-20 ${nx} ${ny})"/><path d="M${nx + 3.2},${ny - 1} V${ny - 13} q5,1 5.5,6"/></g>`;
  const notes = note(sx + 26, sy + 30, 1) + note(sx + 44, sy + 26, 2) + note(sx + 60, sy + 32, 3);
  // two balloons tied by the door
  const bx = sx + sw + 9;
  const balloons = `<g class="balloons"><path class="bstr" d="M${bx},${G - 4} Q${bx - 3},${G - 24} ${bx - 4},${G - 44} M${bx},${G - 4} Q${bx + 5},${G - 22} ${bx + 7},${G - 36}"/><ellipse class="bal1" cx="${bx - 4}" cy="${G - 52}" rx="6.5" ry="8"/><ellipse class="bal2" cx="${bx + 7}" cy="${G - 44}" rx="6.5" ry="8"/></g>`;
  // someone small on a bike, riding in from the left and stopping outside
  const kx = sx - 44, wy = G - 7;
  const bike = `<g class="bike"><g transform="translate(${kx},0)"><circle class="tyre" cx="0" cy="${wy}" r="6.5"/><circle class="tyre" cx="23" cy="${wy}" r="6.5"/><path class="bfr" d="M0,${wy} L8,${wy - 11} H18 L23,${wy} M8,${wy - 11} L12,${wy} L18,${wy - 11} M18,${wy - 11} L20,${wy - 16} h4 M6,${wy - 13} h6"/><path class="rider" d="M9,${wy - 13} L12,${wy - 26} L20,${wy - 17}"/><circle class="rhead" cx="12.5" cy="${wy - 31}" r="4.4"/><path class="rhelm" d="M8,${wy - 32} a4.6,4.6 0 0 1 9.2,0z"/></g></g>`;
  return `<svg class="street wkndscene" viewBox="0 0 2000 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${run(-10, sx)}${studio}${run(sx + sw, 2010)}<rect class="st" x="0" y="${G}" width="2000" height="12"/>${notes}${balloons}${bike}</svg>`;
}

// A summer day, for the summer camps page: a turning sun, slow clouds, tents on the grass with a pennant flying,
// and two kids running through a sprinkler.
function summerScene() {
  let seed = 53;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const G = 124;
  let far = '', x = -10;
  while (x < 2010) { const w = 38 + Math.floor(rnd() * 30), h = 22 + Math.floor(rnd() * 34); far += `<rect class="far" x="${x}" y="${G - h - 8}" width="${w + 1}" height="${h + 12}"/>`; x += w; }
  const cx = 1126, cy = 34;
  let rays = '';
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; rays += `<line x1="${(cx + Math.cos(a) * 20).toFixed(1)}" y1="${(cy + Math.sin(a) * 20).toFixed(1)}" x2="${(cx + Math.cos(a) * 28).toFixed(1)}" y2="${(cy + Math.sin(a) * 28).toFixed(1)}"/>`; }
  const sun = `<g class="rays" style="transform-origin:${cx}px ${cy}px">${rays}</g><circle class="sun" cx="${cx}" cy="${cy}" r="14"/>`;
  const cloud = (px, py, k, sc) => `<g class="cloud c${k}" transform="translate(${px},${py}) scale(${sc})"><ellipse cx="0" cy="0" rx="22" ry="8"/><ellipse cx="-12" cy="-6" rx="11" ry="8"/><ellipse cx="8" cy="-8" rx="13" ry="10"/></g>`;
  const clouds = `<g class="drift d1">${cloud(880, 30, 1, 1)}${cloud(300, 26, 1, 1.2)}${cloud(1560, 34, 1, 1.1)}</g><g class="drift d2">${cloud(1010, 52, 2, .7)}${cloud(560, 48, 2, .8)}${cloud(1800, 50, 2, .75)}</g>`;
  const tree = (tx, r) => `<rect class="trunk" x="${tx - 2.5}" y="${G - r - 12}" width="5" height="${r + 14}"/><circle class="leaf2" cx="${tx - r * 0.35}" cy="${G - r - 18}" r="${r}"/><circle class="leaf" cx="${tx + r * 0.3}" cy="${G - r - 24}" r="${r * 0.9}"/>`;
  const trees = [[90, 19], [270, 15], [470, 21], [660, 16], [812, 18], [1210, 17], [1390, 21], [1590, 16], [1790, 20], [1940, 15]].map(([tx, r]) => tree(tx, r)).join('');
  const tent = (tx, w, h, k) => `<polygon class="tent${k}" points="${tx},${G} ${tx + w / 2},${G - h} ${tx + w},${G}"/><polygon class="flap" points="${tx + w / 2 - w * 0.13},${G} ${tx + w / 2},${G - h * 0.62} ${tx + w / 2 + w * 0.13},${G}"/>`;
  const tents = tent(862, 62, 44, 1) + tent(918, 46, 32, 2);
  const px = 990;
  const flag = `<line class="pole" x1="${px}" y1="${G}" x2="${px}" y2="${G - 58}"/><g class="pennant" style="transform-origin:${px}px ${G - 52}px"><polygon points="${px},${G - 58} ${px + 26},${G - 52} ${px},${G - 46}"/></g>`;
  // the sprinkler: three arcs of drops, and two kids either side of it
  const qx = 1052;
  const spray = `<rect class="spk" x="${qx - 3}" y="${G - 5}" width="6" height="5" rx="1"/><path class="drops" d="M${qx},${G - 5} q-16,-40 -34,-2"/><path class="drops" d="M${qx},${G - 5} q0,-46 0,-34"/><path class="drops" d="M${qx},${G - 5} q16,-40 34,-2"/>`;
  const kid = (ax, up) => `<circle class="kid" cx="${ax}" cy="${G - 27}" r="4.4"/><path class="kid" d="M${ax - 4},${G - 21} h8 l2,21 h-12z"/><path class="arm" d="M${ax - 3},${G - 19} l${up ? '-7,-9' : '-7,4'} M${ax + 3},${G - 19} l${up ? '7,-9' : '7,4'}"/>`;
  const kids = `<g class="hop h1">${kid(qx - 30, true)}</g><g class="hop h2">${kid(qx + 32, false)}</g>`;
  return `<svg class="street summerscene" viewBox="0 0 2000 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${clouds}${sun}${far}<path class="grass" d="M0,${G - 6} Q500,${G - 18} 1000,${G - 5} T2000,${G - 9} V140 H0Z"/>${trees}${tents}${flag}<path class="grass2" d="M0,${G + 3} Q520,${G - 3} 1000,${G + 1} T2000,${G} V140 H0Z"/>${spray}${kids}</svg>`;
}

function street(animate) {
  let seed = 11;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const G = 128; // ground line
  const house = (x, w) => {
    const h = 58 + Math.floor(rnd() * 46), y = G - h, cols = w >= 56 ? 3 : 2, rows = Math.max(1, Math.floor((h - 38) / 22));
    const gap = (w - cols * 8) / (cols + 1);
    let s = `<rect class="hs${1 + Math.floor(rnd() * 3)}" x="${x}" y="${y}" width="${w}" height="${h}"/><rect class="cn" x="${x - 1}" y="${y - 4}" width="${w + 2}" height="5"/>`;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      s += `<rect class="${rnd() < 0.3 ? 'wl' : 'wd'}" x="${(x + gap + c * (8 + gap)).toFixed(1)}" y="${y + 10 + r * 22}" width="8" height="12"/>`;
    return s + `<rect class="dr" x="${(x + w / 2 - 5).toFixed(1)}" y="${G - 18}" width="10" height="18"/>`;
  };
  const run = (from, to) => { let s = '', x = from; while (x < to) { let w = 44 + Math.floor(rnd() * 22); if (to - x - w < 40) w = to - x; s += house(x, w); x += w; } return s; };
  const sx = 820, sw = 140, sy = 30;
  let school = `<rect class="sc" x="${sx}" y="${sy}" width="${sw}" height="${G - sy}"/><rect class="sct" x="${sx - 2}" y="${sy - 5}" width="${sw + 4}" height="6"/><polygon class="sc" points="${sx + 40},${sy - 5} ${sx + 70},${sy - 22} ${sx + 100},${sy - 5}"/>`;
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) school += `<rect class="${r === 1 && c === 2 ? 'sc' : 'scw'}" x="${sx + 12 + c * 25}" y="${sy + 14 + r * 30}" width="14" height="18"/>`;
  school += `<rect class="sct" x="${sx + 58}" y="${G - 30}" width="24" height="30"/><line class="pole" x1="${sx + sw - 16}" y1="${sy - 5}" x2="${sx + sw - 16}" y2="${sy - 36}"/><rect class="fb" x="${sx + sw - 15}" y="${sy - 36}" width="6" height="11"/><rect class="fy" x="${sx + sw - 9}" y="${sy - 36}" width="6" height="11"/><rect class="fb" x="${sx + sw - 3}" y="${sy - 36}" width="6" height="11"/>`;
  let bus = `<rect class="by" x="0" y="0" width="50" height="21" rx="4"/><rect class="by" x="44" y="8" width="13" height="13" rx="3"/><rect class="stop" x="0" y="11" width="2.5" height="5"/>`;
  for (let i = 0; i < 4; i++) bus += `<rect class="bw" x="${5 + i * 10.5}" y="4" width="7.5" height="7" rx="1"/>`;
  bus += `<circle class="wh" cx="12" cy="22" r="5"/><circle class="hub" cx="12" cy="22" r="1.8"/><circle class="wh" cx="42" cy="22" r="5"/><circle class="hub" cx="42" cy="22" r="1.8"/>`;
  // the afternoon sky behind the block: a sun in the gap between two rowhouses, and a few clouds over the roofs
  const ux = 1040, uy = 43;
  let rays = '';
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; rays += `<line x1="${(ux + Math.cos(a) * 26).toFixed(1)}" y1="${(uy + Math.sin(a) * 26).toFixed(1)}" x2="${(ux + Math.cos(a) * 33).toFixed(1)}" y2="${(uy + Math.sin(a) * 33).toFixed(1)}"/>`; }
  const cloud = (px, py, k, sc) => `<g class="cloud c${k}" transform="translate(${px},${py}) scale(${sc})"><ellipse cx="0" cy="0" rx="22" ry="8"/><ellipse cx="-12" cy="-6" rx="11" ry="8"/><ellipse cx="8" cy="-8" rx="13" ry="10"/></g>`;
  const sky = `<g class="sky"><g class="sunwrap"><g class="rays" style="transform-origin:${ux}px ${uy}px">${rays}</g><circle class="sun" cx="${ux}" cy="${uy}" r="21"/></g><g class="drift d1">${cloud(1128, 20, 1, .85)}${cloud(590, 22, 1, 1)}${cloud(1700, 18, 1, .9)}</g><g class="drift d2">${cloud(1380, 26, 2, .7)}${cloud(330, 24, 2, .75)}${cloud(1900, 30, 2, .7)}</g></g>`;
  return `<svg class="street${animate ? ' go' : ''}" viewBox="0 0 2000 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${sky}${run(-10, sx)}${school}${run(sx + sw, 2010)}<rect class="st" x="0" y="${G}" width="2000" height="12"/><g class="bus"><g transform="translate(968,${G - 22})">${bus}</g></g></svg>`;
}

function layout({ title, description, pathName, depth, current, hero, body, scripts = '', fragment = false, showStreet = false, noindex = false, jsonLd = null, roomy = false, first = '', theme = '', shareImage = null, shareText = '', quiet = false, next = '' }) {
  const canonical = cfg.siteUrl + '/' + pathName;
  // Search results show roughly 60 characters of a title and 155 of a description. The site name is added
  // to a title only when it fits; a long description is cut at a word.
  const fullTitle = pathName === '' ? (PREVIEW ? cfg.siteName : `${cfg.siteName}: ${cfg.tagline}`) : `${title} | ${cfg.siteName}`.length <= 65 ? `${title} | ${cfg.siteName}` : title;
  if (description.length > 158) description = description.slice(0, 157).replace(/\s+\S*$/, '').replace(/[,;:.]$/, '') + '…';
  // The menu: four groups that open, then About and the support button. Each group is a <details>, so it works without scripts.
  const navHref = to => { const p = to.split(/[#?]/)[0]; return link(p, depth) + to.slice(p.length); };   // a link may carry ?kind= or #part
  const menus = [
    ['Programs', [['all-programs/', 'All programs'], ['programs/', 'After-school programs'], ...(programs.some(p => p.weekend) ? [['weekends/', 'Weekend classes']] : []), ...(daysOff ? [[dayCampsPath, 'Day-camp programs']] : []), ...(summerCamps.length ? [['summer-camps/', 'Summer camps']] : [])]],
    ['Search by', [['schools/', 'School'], ['neighborhoods/', 'Neighborhood'], ['types/', 'Program type'], ['by-day/', 'Day of week']]],
    ['Build a schedule', [['schedules/', 'All the planners'], ['board/', 'After-school schedule'], ...(daysOff ? [[offPath, 'Day-camp schedule']] : []), ...(summerCamps.length ? [['summer-schedule/', 'Summer schedule']] : []), ...(GROUPS && daysOff ? [['calendar/', 'My kids’ calendar']] : [])]],
    ['Suggest', [['suggest/', 'A program or a camp'], ['suggest/?kind=correction', 'An update to a listing'], ['ideas/', 'A feature'], ['schools/request/', 'A school']]],
  ];
  const nav = menus.map(([label, items]) => {
    const here = items.some(([to]) => !to.includes('#') && pathName.startsWith(to));
    return `<details class="menu${here ? ' here' : ''}"><summary>${label}</summary><ul>${items.map(([to, text]) => `<li><a href="${navHref(to)}"${to === pathName ? ' aria-current="page"' : ''}>${text}</a></li>`).join('')}</ul></details>`;
  }).join('') + `<a href="${link('about/', depth)}"${current === 'about/' ? ' aria-current="page"' : ''}>About</a>${GROUPS
    ? `${daysOff ? `<a class="when-in nav-todo" href="${link('to-do/', depth)}"${pathName === 'to-do/' ? ' aria-current="page"' : ''}>To do</a>` : ''}<a class="when-in nav-acct" href="${link('account/', depth)}"${pathName === 'account/' ? ' aria-current="page"' : ''}>Account</a><a class="nav-cta when-out" href="${link('register/', depth)}${next ? '?next=' + next : ''}">Create a free account</a><a class="nav-cta when-in" href="${link('profile/', depth)}"${NEWS.length ? ` data-news="${NEWS[0].date}"` : ''}${PM_LISTED ? ' data-pm="1"' : ''}>My profile<span class="news-dot" hidden><span class="vh"> (something new)</span></span></a>`
    : `<a class="nav-cta" href="${link('support/', depth)}"${current === 'support/' ? ' aria-current="page"' : ''}>Help the site keep going</a>`}`;
  const head = `${first}${fragment || quiet ? '' : roleHead + gtmHead + '\n' + klaviyoHead}<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">${noindex ? '\n<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(shareText || description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:image" content="${cfg.siteUrl}/${shareImage ? shareImage.file : 'share.png'}${stamp('src/static/' + (shareImage ? shareImage.file : 'share.png'))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(shareImage ? shareImage.alt : `${cfg.siteName}: a row of Philadelphia rowhouses, a school and a yellow school bus`)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${link('favicon.svg', depth)}" type="image/svg+xml">
<link rel="icon" href="${link('favicon.png', depth)}" type="image/png" sizes="48x48">
<link rel="apple-touch-icon" href="${link('apple-touch-icon.png', depth)}">${GROUPS && !PREVIEW ? `
<link rel="manifest" href="${link('manifest.json', depth)}">` : ''}
<meta name="color-scheme" content="only light">
<meta name="theme-color" content="#96C9FF">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<link rel="stylesheet" href="${link('assets/site.css', depth)}${CSS_V}">${jsonLd ? '\n<script type="application/ld+json">' + JSON.stringify(jsonLd).replace(/</g, '\\u003c') + '</script>' : ''}`;
  // Edit mode (see /edit/) loads a second script. This tells site.js where to find it and where edits are sent.
  const editCfg = { js: link('assets/edit.js', depth) + EDIT_V, send: PREVIEW ? '' : link('edit/send.php', depth), home: link('edit/', depth), contact: cfg.contactEmail || '' };
  // The strip above the menu holds "Log in" for someone who isn't signed in, and, on its other side, the way in for
  // the people who run a program: "Claim your listing". The menu's own button is "Create a free
  // account" for them and "Your account" once this browser has signed in. Which shows is decided before the page
  // paints, from a flag the account pages keep in this browser (no request is made).
  const topbar = GROUPS ? `<div class="band topstrip when-out${theme ? ' ' + theme : ''}"><div class="topbar"><div class="in">
    <span class="top-claim"><span class="top-wide">Run a program or camp?</span><span class="top-narrow">Run a program?</span> <a href="${link('managers/', depth)}">Claim your listing</a></span>
    <span class="top-login"><span class="top-wide">Already have an account?</span> <a href="${link('account/', depth)}${next ? '?next=' + next : ''}">Log in</a></span>
  </div></div></div>
` : '';
  const page = `${quiet ? '' : gtmBody}<script>document.documentElement.className+=' js';try{if(localStorage.getItem('pas-in')==='1')document.documentElement.className+=' signed'}catch(e){}</script>
${topbar}<header class="band sitebar${theme ? ' ' + theme : ''}">
  <div class="in bar">
    <a class="brand" href="${link('', depth)}"><span class="bus-mark"></span>${esc(cfg.siteName)}</a>
    <button type="button" class="menu-btn" aria-expanded="false" aria-controls="site-nav"><span class="menu-bars" aria-hidden="true"></span>Menu</button>
    <nav class="nav" id="site-nav" aria-label="Site">${nav}</nav>
  </div>
</header>
<div class="band pagehead${theme ? ' ' + theme : ''}">
  <div class="in hero">
${hero}
  </div>
  ${showStreet === 'dayoff' ? dayScene() : showStreet === 'weekend' ? weekendScene() : showStreet === 'summer' ? summerScene() : showStreet ? street(showStreet === 'go') : ''}
</div>
<main class="wrap${roomy ? ' roomy' : ''}">
${body}
</main>
<footer class="foot"><div class="in">
  <nav class="foot-cols" aria-label="Footer">
    <div class="foot-brand">
      <a class="brand" href="${link('', depth)}"><span class="bus-mark"></span>${esc(cfg.siteName)}</a>
      <p>${T(`After-school programs in Philadelphia, sorted by the school your child goes to.`)}</p>
      ${cfg.supportUrl ? `<p class="foot-support"><span>${T(`Created and run by the Silverbauers.`)}</span> <a class="btn foot-cta" href="${link('support/', depth)}">Help the site keep going</a></p>` : ''}
    </div>
    <div>
      <h2><a href="${link('schools/', depth)}">${T(`Schools`)}</a></h2>
      <ul>
        <li><a href="${link('schools/', depth)}">${T(`All schools`)}</a></li>
        <li><a href="${link('neighborhoods/', depth)}">${T(`By neighborhood`)}</a></li>
        <li><a href="${link('schools/request/', depth)}">${T(`Ask for your school`)}</a></li>
      </ul>
    </div>
    <div>
      <h2><a href="${link('all-programs/', depth)}">${T(`Programs`)}</a></h2>
      <ul>
        <li><a href="${link('all-programs/', depth)}">${T(`All programs`)}</a></li>
        <li><a href="${link('programs/', depth)}">${T(`After-school programs, A to Z`)}</a></li>
        <li><a href="${link('types/', depth)}">${T(`Programs by type`)}</a></li>
        <li><a href="${link('neighborhoods/', depth)}">${T(`Programs by neighborhood`)}</a></li>
        ${programs.some(p => p.weekend) ? `<li><a href="${link('weekends/', depth)}">${T(`Weekend classes`)}</a></li>` : ''}
        ${daysOff ? `<li><a href="${link(dayCampsPath, depth)}">${T(`Day-camp programs`)}</a></li>` : ''}
        ${summerCamps.length ? `<li><a href="${link('summer-camps/', depth)}">${T(`Summer camps`)}</a></li>` : ''}
        <li><a href="${link('suggest/', depth)}">${T(`Suggest a program`)}</a></li>
        <li><a href="${link('review/', depth)}">${T(`Write a review`)}</a></li>
      </ul>
    </div>
    <div>
      <h2><a href="${link('schedules/', depth)}">${T(`Your family`)}</a></h2>
      <ul>
        <li><a href="${link('board/', depth)}">${T(`After-school schedule`)}</a></li>
        ${daysOff ? `<li><a href="${link(offPath, depth)}">${T(`Day-camp schedule`)}</a></li>` : ''}
        ${ALERTS ? `<li><a href="${link(alertsPath, depth)}">${T(`Dates by email`)}</a></li>` : ''}
        ${GROUPS ? `<li><a href="${link('profile/', depth)}">${T(`My profile`)}</a></li>
        <li><a href="${link('account/', depth)}">${T(`Your account`)}</a></li>` : ''}
      </ul>
    </div>
    <div>
      <h2><a href="${link('about/', depth)}">${T(`About`)}</a></h2>
      <ul>
        <li><a href="${link('about/', depth)}">${T(`About this site`)}</a></li>
        <li><a href="${link('about/', depth)}#how">${T(`How listings are checked`)}</a></li>
        <li><a href="${link('about/', depth)}#corrections">${T(`Send a correction`)}</a></li>
        <li><a href="${link('contact/', depth)}">${T(`Contact us`)}</a></li>${GROUPS ? `
        <li><a href="${link('managers/', depth)}">${T(`For program managers`)}</a></li>` : ''}
        <li><a href="${link('ideas/', depth)}">${T(`Request a feature`)}</a></li>
        <li><a href="${link('privacy/', depth)}">${T(`Privacy`)}</a></li>${TERMS ? `
        <li><a href="${link('terms/', depth)}">${T(`Terms of use`)}</a></li>` : ''}
        <li><a href="${link('support/', depth)}">${T(`Help the site keep going`)}</a></li>
      </ul>
    </div>
  </nav>${GROUPS ? `
  <div class="foot-managers">
    <p><b>${T(`Run a program or camp?`)}</b> ${T(`Claim your listing, free, and keep its dates, costs and hours right yourself.`)}</p>
    <a class="btn foot-cta" href="${link('managers/', depth)}">${T(`For program managers`)}</a>
  </div>` : ''}
  <div class="foot-fine">
    <p>${T(`Listings come from each provider’s public pages and are not endorsements. Prices, hours and pickup routes change, so confirm with the provider before you enroll.`)}</p>
    <p>${T(`{site} is an independent community project. It is not affiliated with the School District of Philadelphia or any provider listed.`, { site: cfg.siteName })}</p>
    ${cfg.contactEmail ? `<p>${T(`Questions?`)} <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a> ${T(`or`)} <a href="${link('contact/', depth)}">${T(`send a message`)}</a>.</p>` : ''}
    ${cfg.builtBy ? `<p>Built by <a href="${esc(cfg.builtBy.url)}" target="_blank" rel="noopener">${esc(cfg.builtBy.name)}</a>.</p>` : ''}
    ${cfg.writtenBy ? `<p>Written by ${esc(cfg.writtenBy.name)}.</p>` : ''}
  </div>
</div></footer>
<script src="${link('assets/site.js', depth)}${JS_V}" data-edit="${esc(JSON.stringify(editCfg))}"${GROUPS && !PREVIEW ? ` data-api="${link('groups/api.php', depth)}"` : ''}></script>
${scripts}`;
  if (fragment) return head + '\n' + page;
  return `<!doctype html>
<html lang="en"${GATE ? ' data-gate="1"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${page}
</body>
</html>
`;
}

// ---------- calendar files for registration dates ----------
// Today, as the pages know it. PAS_TODAY=2026-10-12 builds the site as if it were another day: that is for the
// browser tests that are written around particular dates, and never for a build that is published.
const PINNED_DAY = /^\d{4}-\d{2}-\d{2}$/.test(process.env.PAS_TODAY || '') ? process.env.PAS_TODAY : '';
if (PINNED_DAY) console.log(`Note: building as if today were ${PINNED_DAY} (PAS_TODAY). Don't publish this copy.`);
const TODAY = PINNED_DAY || new Date().toISOString().slice(0, 10);
// ----- days of the week, and days off -----
const daysText = days => !days ? '' : days.length === 5 ? 'Monday to Friday' : listNames(days.map(d => DAY_NAME[d]));
const daysLine = p => [daysText(p.days), p.daysNote].filter(Boolean).join('. ');
const pickyDays = p => !!p.days && p.days.length < 5;   // runs on some weekdays only
const isoAdd = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const weekday = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
const dayDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
// Each closed day or break, with the weekdays inside it, from the district calendar in data/days-off.json.
const offDays = (daysOff?.days || []).map(d => {
  const dates = [];
  for (let x = d.date; x <= (d.end || d.date); x = isoAdd(x, 1)) if (weekday(x) >= 1 && weekday(x) <= 5) dates.push(x);
  return { ...d, until: d.end || d.date, dates };
}).filter(d => d.until >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
const campPrograms = programs.filter(p => p.daysOff).sort((a, b) => a.name.localeCompare(b.name));
const campsOn = (d, list = campPrograms) => list.filter(p => p.daysOff && p.daysOff.dates.some(x => d.dates.includes(x)));
const offPath = 'days-off/';          // the days-off planner ("Day-camp schedule")
const dayCampsPath = 'day-camps/';   // the reference page: who's open each day off, the days, who runs camps
if (daysOff) {
  const closed = new Set((daysOff.days || []).flatMap(d => { const out = []; for (let x = d.date; x <= (d.end || d.date); x = isoAdd(x, 1)) out.push(x); return out; }));
  for (const p of campPrograms) { const odd = p.daysOff.dates.filter(x => x >= TODAY && !closed.has(x)); if (odd.length) console.log(`Note: ${p.name} lists a camp on ${odd.join(', ')}, which isn't a district day off in data/days-off.json.`); }
}
// The next day off, for the line on the home page and each school's page. The script picks the first one still ahead.
const nextOff = (depth, list) => !offDays.length ? '' : `<p class="nextoff"><b data-next-off="${esc(JSON.stringify(offDays.slice(0, 12).map(d => ({ u: d.until, w: d.end ? `${shortDate(d.date)} to ${shortDate(d.end)}` : dayDate(d.date), n: d.name, c: campsOn(d, list).length, p: link(dayPath(d), depth) }))))}" hidden></b> <a data-next-off-day hidden>${T(`Who’s open that day`)}</a> <a href="${link(dayCampsPath, depth)}">${T(`Days off this year, and who’s open`)}</a></p>`;
// On the home page the next day off is a bar that stays along the bottom of the screen until it is closed: a question
// ("Do you know where your kids will be on Election Day?") and a way to that day's page. The words for each day off
// are made here; the script picks the first one still ahead and remembers, in this browser, which one was closed.
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][n % 10]);
const ordDate = iso => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+iso.slice(5, 7) - 1]} ${ordinal(+iso.slice(8, 10))}`;
const offSpan = d => !d.end || d.end === d.date ? ordDate(d.date) : d.end.slice(0, 7) === d.date.slice(0, 7) ? `${ordDate(d.date)} to ${ordinal(+d.end.slice(8, 10))}` : `${ordDate(d.date)} to ${ordDate(d.end)}`;
const lowerSeason = n => n.replace(/^(Winter|Spring|Summer|Fall|Staff|Report)\b/, w => w.toLowerCase());
const offAsk = d => /recess|break/i.test(d.name) ? `over ${lowerSeason(d.name)}` : /development|conference/i.test(d.name) ? `when school’s closed for ${lowerSeason(d.name)}` : `on ${d.name}`;
const nextOffBar = depth => !offDays.length ? '' : `<aside class="offbar" id="offbar" aria-label="The next day school is closed" data-offbar="${esc(JSON.stringify(offDays.slice(0, 12).map(d => ({ u: d.until, s: d.date, q: `Do you know where your kids will be ${offAsk(d)}?`, g: `Get coverage for ${offSpan(d)}`, p: link(dayPath(d), depth) }))))}" hidden>
  <div class="in offbar-in"><p><span class="offbar-q"></span> <a class="offbar-go" data-track="offbar"></a></p><button type="button" class="offbar-x" aria-label="Close this note"><span aria-hidden="true">×</span></button></div>
</aside>`;
const ymd = iso => iso.replace(/-/g, '');
const nextDay = iso => new Date(Date.parse(iso + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
const shortDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const upcomingDates = p => (p.register.dates || []).filter(d => d.date >= TODAY);
const calTitle = (p, d) => `${p.name}: ${d.label}`;
const calDetails = p => `${outUrl(p.register.url || p.website, { type: 'calendar', program: p })}\n\nFrom ${cfg.siteName}: ${cfg.siteUrl}/`;
const gcalUrl = (p, d) => 'https://calendar.google.com/calendar/render?action=TEMPLATE'
  + '&text=' + encodeURIComponent(calTitle(p, d))
  + '&dates=' + ymd(d.date) + '/' + ymd(nextDay(d.date))
  + '&details=' + encodeURIComponent(calDetails(p));
function icsFile(p, d) {
  const text = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const fold = line => line.match(/.{1,60}/gu).join('\r\n ');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//' + cfg.siteName + '//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + p.id + '-' + d.date + '@' + (cfg.calendarIdHost || cfg.siteUrl.replace(/^https?:\/\//, '')),   // the id keeps its first name when the site's address changes, so a saved entry updates instead of doubling
    'DTSTAMP:' + ymd(TODAY) + 'T120000Z',
    'DTSTART;VALUE=DATE:' + ymd(d.date),
    'DTEND;VALUE=DATE:' + ymd(nextDay(d.date)),
    'SUMMARY:' + text(calTitle(p, d)),
    'DESCRIPTION:' + text(calDetails(p)),
    'URL:' + (p.register.url || p.website),
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + text(calTitle(p, d)), 'TRIGGER:PT9H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n';
}

// ---------- reviews ----------
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const reviewsFor = id => reviews.filter(r => r.programId === id).sort((a, b) => b.date.localeCompare(a.date));
const monthYear = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const schoolShort = id => (schools.find(s => s.id === id) || {}).shortName || '';
const BOARD_DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri']];

// ---------- pieces shared by the program card and the program page ----------
const gradeText = p => { const g = p._grades; return g === null ? 'not published' : g.length === 1 ? g[0] : `${g[0]} to ${g[g.length - 1]}`; };
const gradeStrip = p => {
  const g = p._grades;
  const cells = GRADES.map(x => `<i class="cell${g === null ? ' unk' : g.includes(x) ? ' on' : ''}">${x}</i>`).join('');
  return `<div class="strip" role="img" aria-label="Grades served: ${esc(gradeText(p))}">${cells}${p.gradeNote ? `<span class="strip-note">${esc(p.gradeNote)}</span>` : ''}</div>`;
};
const phoneLink = p => p.phone ? `<a href="${telHref(p.phone)}">${esc(p.phone)}</a>` : '';
const contactHtml = p => [phoneLink(p), p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''].filter(Boolean).join('<br>');
const registerText = p => {
  const r = p.register;
  let t = esc(r.note || '');
  if (r.how === 'online') t = ['Online.', t].filter(Boolean).join(' ');
  if (r.how === 'phone') t = [`By phone or in person${p.phone ? ': ' + phoneLink(p) : ''}.`, t].filter(Boolean).join(' ');
  if (r.how === 'school') t = [t, p.phone ? `School office: ${phoneLink(p)}.` : ''].filter(Boolean).join(' ');
  return t;
};
const datesHtml = (p, depth) => upcomingDates(p).map(d => `<span class="cal" data-date="${d.date}"><b>${shortDate(d.date)}:</b> ${esc(d.label)}. ${PREVIEW ? '' : `<a href="${link('cal/' + p.id + '-' + d.date + '.ics', depth)}" data-track="calendar">Add to calendar</a> `}<a href="${esc(gcalUrl(p, d))}" target="_blank" rel="noopener" data-track="calendar">${PREVIEW ? 'Add to Google Calendar' : 'Google Calendar'}</a></span>`).join('');
const average = revs => revs.reduce((a, x) => a + x.stars, 0) / revs.length;
const reviewItems = revs => revs.map(x => `<li><span class="stars" role="img" aria-label="${x.stars} out of 5 stars">${stars(x.stars)}</span><p>${esc(x.comment)}</p><span class="by">${esc(x.name)}, ${esc(schoolShort(x.school))} parent, ${monthYear(x.date)}</span></li>`).join('');
// A source named by both the listing and one of its school entries is linked once.
const sourceLinks = (list, p = null, school = null) => { const own = p ? ownHosts(p) : null; const seen = new Set(); return list.filter(s => !seen.has(s.url) && seen.add(s.url)).map(s => `<a href="${esc(own?.has(bareHost(s.url)) ? outUrl(s.url, { type: 'source', school, program: p }) : s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(''); };
const programPath = p => `programs/${p.id}/`;
// "School clubs and teams" means nothing away from its school's page, so on its own it carries the school's name.
const fullName = p => {
  const at = schools.filter(s => p.schools[s.id]);
  return at.length === 1 && p.schools[at[0].id].relation === 'onsite' && !p.name.includes(at[0].shortName) ? `${p.name} at ${at[0].shortName}` : p.name;
};

// ---------- neighborhoods ----------
// A school's neighborhood comes from its "neighborhood" text ("Queen Village / Bella Vista" counts as both).
// A program's comes from its "neighborhoods" list; one that runs inside a school takes that school's.
const hoodSlug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Each day off has its own page (dayOffPage, further down); its address is made here because the emails link to it too.
const dayLabel = d => d.name.replace(/\brecess\b/i, 'break');   // the calendar says "recess"; parents say "break"
const daySlug = d => `${hoodSlug(dayLabel(d))}-${d.date}`;   // "election-day-2026-11-03", "winter-break-2026-12-23"
const dayPath = d => `${offPath}${daySlug(d)}/`;
const schoolHoods = s => String(s.neighborhood || '').split('/').map(x => x.trim()).filter(Boolean);
const programHoods = p => p.neighborhoods?.length ? p.neighborhoods
  : [...new Set(schools.filter(s => p.schools[s.id]?.relation === 'onsite').flatMap(schoolHoods))];
const hoods = (() => {
  const m = new Map();
  const at = n => { const k = hoodSlug(n); if (!m.has(k)) m.set(k, { id: k, name: n, schools: [], programs: [] }); return m.get(k); };
  for (const s of schools) for (const n of schoolHoods(s)) at(n).schools.push(s);
  for (const p of programs) if (Object.keys(p.schools || {}).length) for (const n of programHoods(p)) at(n).programs.push(p);
  return [...m.values()].sort((a, b) => (b.schools.length + b.programs.length) - (a.schools.length + a.programs.length) || a.name.localeCompare(b.name));
})();
const hoodPath = h => `neighborhoods/${h.id}/`;
const hoodLinks = (names, depth) => names.map(n => `<a href="${link('neighborhoods/' + hoodSlug(n) + '/', depth)}">${esc(n)}</a>`).join(', ');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Rows used on the home page, the A to Z list and the neighborhood pages.
const schoolRow = (s, depth) => {
  const t = Object.fromEntries(Object.keys(REL).map(k => [k, programs.filter(p => p.schools[s.id]?.relation === k).length]));
  return `<a class="school" href="${link(s.id + '/', depth)}" data-name="${esc((s.name + ' ' + s.shortName + ' ' + s.neighborhood).toLowerCase())}">
  <h3>${esc(s.name)}</h3>
  <span class="hood">${esc(s.neighborhood)}, grades ${esc(gradeSpan(s))}</span>
  <span class="tally">${t.onsite ? `<span class="pill onsite">${t.onsite} at school</span>` : ''}${t.pickup ? `<span class="pill pickup">${t.pickup} pick up</span>` : ''}${t.nearby ? `<span class="pill nearby">${t.nearby} nearby</span>` : ''}</span>
  <span class="bell">${s.dismissal ? `<b>${esc(clock(s))}</b><span>${T(`dismissal`)}</span>` : `<b>Ask</b><span>${T(`dismissal not posted`)}</span>`}</span>
</a>`;
};
// What the filters read on every listed program, whether it is drawn as a card or a row.
const haystack = (p, extra = []) => [p.name, p.what, ...(p.offers || []), ...(p.keywords || []), ...p.types.map(t => TYPE[t].label), ...extra].join(' ').toLowerCase().replace(/martial arts/g, 'martial-arts');   // so a search for "art" doesn't pull in martial arts
// Free, paid, both, or (when a provider doesn't publish a price) neither.
// A price can differ by school (free for one school through a partnership, paid for the rest): a school's own
// "price" and "cost" win on that school's page. On the citywide lists a program counts under every price it has anywhere.
// ---------- where things are ----------
// data/geo.json holds a latitude and longitude for each street address in the data (scripts/geocode.mjs fills it in).
// From it: how far a program is from a school, in a straight line, and the points a page hands to the map.
const GEO = fs.existsSync(path.join(ROOT, 'data/geo.json')) ? readJson('data/geo.json').places || {} : {};
const coordsOf = text => streetAddresses(text).map(a => GEO[addressKey(a)]).filter(Boolean);
{
  // Say which addresses the map and the distances can't use yet, so whoever changed one knows to run the lookup.
  const texts = [...programs.flatMap(p => [p.address, ...Object.values(p.schools || {}).map(l => l.address)]), ...summerCamps.map(c => c.address), ...schools.map(s => s.address)];
  const lost = [...new Set(texts.flatMap(t => streetAddresses(t)).filter(a => !GEO[addressKey(a)]))];
  if (lost.length) console.log(`Note: ${lost.length} address(es) have no place in data/geo.json, so they are left off the map and out of the distances: ${lost.join('; ')}. Run "node scripts/geocode.mjs".`);
}
const milesApart = (a, b) => { const rad = x => x * Math.PI / 180, h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2; return 2 * 3958.8 * Math.asin(Math.sqrt(h)); };
const SCHOOL_LL = Object.fromEntries(schools.map(s => [s.id, coordsOf(s.address)[0]]).filter(x => x[1]));
// A listing's places: its own address, plus any address it uses for one school. For one school's page, that school's place first.
const placesOf = (p, school = null) => {
  const own = coordsOf(p.address), mine = school ? coordsOf(p.schools?.[school.id]?.address) : Object.values(p.schools || {}).flatMap(l => coordsOf(l.address));
  const all = school && mine.length ? mine : [...own, ...mine];
  return all.filter((x, i) => all.findIndex(y => y[0] === x[0] && y[1] === x[1]) === i);
};
const milesFrom = (school, p) => { const from = SCHOOL_LL[school.id], to = placesOf(p, school); return from && to.length ? Math.min(...to.map(x => milesApart(from, x))) : null; };
const milesText = m => m < 0.1 ? 'under a tenth of a mile' : (Math.round(m * 10) / 10 === 1 ? '1 mile' : `${(Math.round(m * 10) / 10).toFixed(1)} miles`);
const kindsOf = price => price === 'both' ? ['free', 'paid'] : price ? [price] : [];
// "Help with cost" means the listing itself says there is need-based help: financial aid, a scholarship, tuition
// assistance, a sliding scale, pay-what-you-can or a state subsidy. A sibling or early-bird discount doesn't count,
// and neither does a sentence saying there is none. It is read from the cost, aid and note lines we wrote.
const HELP_WORDS = /financial aid|tuition assistance|scholarship|sliding[- ]scale|pay[- ]what[- ]you[- ]can|\bCCIS\b|\bELRC\b|Child Care Works|subsid(?:y|ies)\b/i;
const saysHelp = t => { const m = HELP_WORDS.exec(String(t || '')); return !!m && !/\b(no|not|without|doesn’t|don’t|isn’t)\b[^.]{0,30}$/i.test(String(t).slice(0, m.index)); };
const offersHelp = (p, school) => [p.cost, p.aid, ...(school ? [p.schools?.[school.id]?.cost] : Object.values(p.schools || {}).map(l => l.cost))].some(saysHelp);
const costKinds = (p, school) => {
  const k = school ? kindsOf(p.schools[school.id].price || p.price) : [...new Set([...kindsOf(p.price), ...Object.values(p.schools || {}).flatMap(l => kindsOf(l.price))])];
  return k.includes('free') || offersHelp(p, school) ? [...k, 'help'] : k;   // "help": free, or says it has help with cost
};
const freeOnlyFor = p => kindsOf(p.price).includes('free') ? [] : schools.filter(s => kindsOf(p.schools[s.id]?.price).includes('free')).map(s => s.shortName);
// A school's own clubs belong on that school's page. On the citywide lists (A to Z, the type pages) there would be
// one near-identical "School clubs" entry per school, so they are left off those.
const schoolRun = p => p.types.includes('clubs');
// A day-camp-only listing: it runs camps when school is closed but nothing on a weekday afternoon, so it is linked to
// no school. It gets its own page and a place on the day-camp page, and stays off every after-school list.
const campOnly = p => !Object.keys(p.schools).length;
// A school's clubs, by the kind of program each one is. Used to mention them next to the citywide lists.
const clubGrades = c => c.gradeNote || (c._grades == null ? '' : c._grades.length === 1 ? (c._grades[0] === 'K' ? 'Kindergarten' : c._grades[0] === 'PK' ? 'Pre-K' : 'Grade ' + c._grades[0]) : c._grades.length === GRADES.length - 1 && c._grades[0] === 'K' ? 'All grades' : `Grades ${c._grades[0]}–${c._grades[c._grades.length - 1]}`);
const clubsOfType = (p, typeId) => (p.clubs || []).filter(c => c.roster !== false && (c.tags || []).includes(typeId));
// "Tuesdays and Thursdays", "Tuesdays, Wednesdays and Thursdays", or "Monday to Thursday" for a run of four or five.
const clubDays = c => { const d = c.days, i = d.map(x => WEEK.indexOf(x)); const run = d.length >= 4 && i.every((v, k) => k === 0 || v === i[k - 1] + 1); const n = d.map(x => DAY_NAME[x] + 's'); return run ? `${DAY_NAME[d[0]]} to ${DAY_NAME[d[d.length - 1]]}` : n.length < 3 ? n.join(' and ') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; };
const clubBrief = c => { const bits = [clubGrades(c).replace(/^G/, 'g').replace(/^A/, 'a').replace(/^K/, 'k'), c.days ? clubDays(c) : ''].filter(Boolean); return c.name + (bits.length ? ` (${bits.join(', ')})` : ''); };
const clubsByType = p => Object.fromEntries(TYPES.map(t => [t.id, { label: t.label, clubs: clubsOfType(p, t.id).map(c => c.name) }]).filter(([, v]) => v.clubs.length));
const citywide = programs.filter(p => !schoolRun(p) && !campOnly(p));
const itemAttrs = (p, extra = [], school = null) => `data-item data-kinds="${p._kind || 'after'}" data-grades="${p._grades === null ? '*' : p._grades.join(' ')}" data-ages="${p._ages === undefined ? (gradesToAges(p._grades) || ['*']).join(' ') : p._ages === null ? '*' : p._ages.join(' ')}" data-types="${p.types.join(' ')}" data-hoods="${programHoods(p).map(hoodSlug).join(' ')}" data-cost="${costKinds(p, school).join(' ')}" data-days="${p.days ? p.days.join(' ') : '*'}" data-schools="${schools.filter(x => p.schools[x.id]).map(x => x.id).join(' ')}"${placesOf(p, school).length ? ` data-ll="${placesOf(p, school).map(x => x.join(',')).join(';')}"` : ''} data-search="${esc(haystack(p, extra))}"`;
const typeTags = (p, school = null) => p.types.map(t => `<span class="tag" style="--tc:${TYPE[t].color}">${esc(TYPE[t].label)}</span>`).join('')
  + (!costKinds(p, school).includes('free') ? '' : `<span class="tag free">${school ? (costKinds(p, school).includes('paid') ? 'Free option' : 'Free') : freeOnlyFor(p).length ? `Free for ${esc(listNames(freeOnlyFor(p)))}` : p.price === 'both' ? 'Free option' : 'Free'}</span>`);
const programRow = (p, depth) => {
  const served = schools.filter(s => p.schools[s.id]);
  return `<a class="prow" href="${link(programPath(p), depth)}" ${itemAttrs(p, [...served.map(s => s.shortName), ...programHoods(p)])}>
  <h3>${esc(p.name)}</h3>
  <span class="what">${esc(p.what)}</span>
  <span class="tally">${typeTags(p)}</span>
  <span class="tally">${servedPills(p)}<span class="hint">Grades ${esc(gradeText(p))}</span></span>
</a>`;
};

// ---------- one row for every list ----------
// The four lists (after-school, weekend classes, day camps, summer camps) show each listing the same way: its name, one
// line about it, its kind of program, and the few facts a parent sorts by. The whole row is the link to the listing's
// own page, which is where everything else lives; there is nothing else to press. `kind` says which facts: after-school
// rows carry the schools and grades, weekend rows the days, day-camp rows the days off posted (by break), summer rows
// the ages, the weeks and which summer the dates are from. `x` is the program (or camp), `shaped` what the filter bar
// should see when that differs (weekend grades, a camp's areas).
const WK_DAY = { sat: 'Saturdays', sun: 'Sundays' };
function offBreaks(p) {   // "Election Day · Winter break (3 of 5 days) · +2 more": the days off a program has posted, by break
  const got = offDays.map(d => { const left = d.dates.filter(x => x >= TODAY), on = left.filter(x => p.daysOff.dates.includes(x)); return on.length ? (on.length === left.length ? dayLabel(d) : `${dayLabel(d)} (${on.length} of ${left.length} days)`) : ''; }).filter(Boolean);
  return got;
}
// What the filter bar sees for a listing shown as one kind: the grades, days and neighborhoods that kind goes by.
// A weekend row filters by its Saturday or Sunday; day-camp and summer rows sit under no weekday.
const campAgeList = c => c.ageMin || c.ageMax ? agesBetween(c.ageMin || 3, c.ageMax || AGE_TOP) : gradesToAges(c._grades === undefined ? null : c._grades);
const shapeFor = (kind, x) => kind === 'weekend' ? { ...x, _kind: kind, ...(x.weekend._grades !== undefined ? { _grades: x.weekend._grades } : {}), _ages: gradesToAges(x.weekend._grades !== undefined ? x.weekend._grades : x._grades), days: x.weekend.days }
  : kind === 'off' ? { ...x, _kind: kind, _ages: x.daysOff && (x.daysOff.ageMin || x.daysOff.ageMax) ? agesBetween(x.daysOff.ageMin || 3, x.daysOff.ageMax || AGE_TOP) : gradesToAges(x._grades), days: ['none'] }
  : kind === 'summer' ? { ...x, _kind: kind, _ages: campAgeList(x), days: ['none'] }
  : { ...x, _kind: kind };
function listRow(kind, x, depth, shaped = null) {
  const tags = x.types.map(t => `<span class="tag" style="--tc:${TYPE[t].color}">${esc(TYPE[t].label)}</span>`).join('');
  const hoods = kind === 'summer' ? (x.neighborhoods || []) : programHoods(x);
  const hood = hoods.length ? `<span class="pill hood">${esc(listNames(hoods))}</span>` : '';
  let href, line, facts, extra = [];
  if (kind === 'after') {
    href = link(programPath(x), depth); line = x.what;
    facts = `${servedPills(x)}${hood}<span class="hint">Grades ${esc(gradeText(x))}</span>`;
    extra = [...servedBy(x).map(s => s.shortName), ...hoods];
  } else if (kind === 'weekend') {
    const w = x.weekend, weekday = Object.keys(x.schools || {}).length && x.scope !== 'weekend';
    href = link(programPath(x), depth) + '#weekend'; line = weekday && w.summary ? w.summary : x.what;
    facts = `${w.days.map(d => `<span class="pill wkday">${WK_DAY[d]}</span>`).join('')}${hood}`;
    extra = [...hoods, ...w.days.map(d => WEEKEND_DAY[d])];
  } else if (kind === 'off') {
    const breaks = offBreaks(x), shown = breaks.slice(0, 3), more = breaks.length - shown.length;
    href = link(programPath(x), depth) + '#days-off'; line = x.daysOff.summary || x.what;
    facts = `${hood}<span class="dates">${breaks.length ? esc(shown.join(' · ')) + (more ? ` <b>+${more} more</b>` : '') : T(`No dates posted yet`)}</span>`;
    extra = [...hoods, ...breaks];
  } else {
    const on = (summerPlan.camps.find(c => c.c.id === x.id) || { on: [] }).on.length;
    href = campLink(x, depth); line = x.what;
    facts = `${seasonPill(x)}${spaceSlot('c:' + x.id, depth)}${campAges(x) ? `<span>${esc(campAges(x))}</span>` : ''}${x._grades ? `<span class="hint">Grades ${esc(gradeText(x))}</span>` : ''}${campWeeksShort(x) ? `<span class="dates">${esc(campWeeksShort(x))}${on ? ` <b>${on} ${on === 1 ? 'week' : 'weeks'}</b>` : ''}</span>` : `<span class="dates">${T(`No dates posted yet`)}</span>`}${hood}`;
    extra = [x.ages || '', x.address || '', ...hoods];
  }
  return `<a class="prow row-${kind}" id="${esc(x.id)}" href="${href}" ${itemAttrs({ ...(shaped || shapeFor(kind, x)), _kind: kind }, extra)}>
  <h3>${esc(kind === 'summer' ? x.name : fullName(x))}</h3>
  <span class="what">${esc(line)}</span>
  <span class="tally">${tags}</span>
  <span class="tally facts">${facts}</span>
</a>`;
}
// The way into the planner that goes with a list, under its heading: everyone sees it.
const heroGo = (depth, href, label, more = '') => `
    <p class="hero-go"><a class="btn primary big" href="${href}">${label}</a>${more}</p>`;

// One filter bar for every page that lists programs: search, program type, free or paid, neighborhood, and (on a school
// page) how the program gets your child. The grade row sits in a strip that stays on screen while you scroll.
// Filters also read from the page address (?type=music&grade=3), which is how the home page links into them.
// "Nearest first" and the map. On a school's page the school is the place everything is measured from, so there is only
// the map; on a citywide list a parent picks their saved school or where they are. The map is not loaded, and nothing
// is asked of OpenStreetMap, until someone opens it. The preview copy has no map: it can't load one.
const nearRow = (depth, here) => !Object.keys(GEO).length ? '' : `<div class="frow nearbar" data-near${PREVIEW ? '' : ` data-leaflet="${link('assets/leaflet/', depth)}"`} data-schools="${esc(JSON.stringify(SCHOOL_LL))}"${here && SCHOOL_LL[here.id] ? ` data-here="${SCHOOL_LL[here.id].join(',')}" data-here-name="${esc(here.shortName)}"` : ''}><span class="flabel">${here ? 'Map' : 'Nearest'}</span><div class="rail" role="group" aria-label="${here ? 'Map' : 'Nearest first, and the map'}">${here ? '' : `<button type="button" class="tbtn" id="near-school" aria-pressed="false" hidden></button><button type="button" class="tbtn" id="near-me" aria-pressed="false">From where I am</button><button type="button" class="tbtn" id="near-off" hidden>Back to A to Z</button>`}${PREVIEW ? '' : `<button type="button" class="tbtn" id="map-toggle" aria-expanded="false">Show the map</button>`}</div></div>`;
const nearMap = depth => !Object.keys(GEO).length ? '' : `<p class="hint near-status" id="near-status" aria-live="polite"></p>
  <div class="mapwrap" id="near-map" hidden><div class="mapbox" id="near-mapbox" role="region" aria-label="Map of the places in this list"></div><p class="hint">${T(`Places are put on the map from their street address. The map’s pictures come from OpenStreetMap.`)} <a href="${link('privacy/', depth)}#map">${T(`What that means for your privacy.`)}</a></p></div>`;
function filterBar({ list, depth, school = null, show = {}, near = false, searchLabel, placeholder = 'Its name, or try drums, art, chess…' }) {
  const on = { q: true, type: true, grade: true, age: false, hood: true, cost: true, ...show };
  const btn = (f, v, label, n, cls = 'tbtn', extra = '') => `<button type="button" class="${cls}" id="${f}-${v}" data-f="${f}" data-v="${v}" data-label="${esc(label)}" aria-pressed="${v === 'ALL'}"${extra}>${esc(label)}${n === null ? '' : ` (${n})`}</button>`;
  const KIND_LABEL = { after: 'After school', weekend: 'Weekends', off: 'Day camps', summer: 'Summer' };
  const kindsHere = Object.keys(KIND_LABEL).map(k => [k, list.filter(p => (p._kind || 'after') === k).length]).filter(([, n]) => n);
  const kindRow = kindsHere.length > 1 ? `<div class="frow" id="by-kind"><span class="flabel">Kind</span><div class="rail" role="group" aria-label="Kind of program">${btn('kind', 'ALL', 'All kinds', null)}${kindsHere.map(([k, n]) => btn('kind', k, KIND_LABEL[k], n, 'tbtn kind-' + k)).join('')}</div></div>` : '';
  const types = TYPES.map(t => [t, list.filter(p => p.types.includes(t.id)).length]).filter(([, n]) => n);
  const typeRow = on.type && types.length > 1 ? `<div class="frow"><span class="flabel">Type</span><div class="rail" role="group" aria-label="Program type">${btn('type', 'ALL', 'All types', null)}${types.map(([t, n]) => btn('type', t.id, t.label, n, 'tbtn', ` style="--tc:${t.color}"`)).join('')}</div></div>` : '';
  const relRow = school ? `<div class="frow"><span class="flabel">Pickup</span><div class="rail" role="group" aria-label="How your child gets there">${btn('rel', 'ALL', 'Any', null)}${Object.entries(REL).map(([k, v]) => [k, v.pill.replace('{s}', school.shortName), list.filter(p => p.schools[school.id].relation === k).length]).filter(([, , n]) => n).map(([k, label, n]) => btn('rel', k, label, n)).join('')}</div></div>` : '';
  const hoodList = [...new Set(list.flatMap(programHoods))].sort();
  const hoodRow = on.hood && hoodList.length > 1 ? `<div class="frow"><span class="flabel">Area</span><div class="rail" role="group" aria-label="Neighborhood">${btn('hood', 'ALL', 'Anywhere', null)}${hoodList.map(n => btn('hood', hoodSlug(n), n, list.filter(p => programHoods(p).includes(n)).length)).join('')}</div></div>` : '';
  const costN = k => list.filter(p => costKinds(p, school).includes(k)).length, unpriced = list.filter(p => !costKinds(p, school).filter(k => k !== 'help').length).length;
  const costRow = on.cost && costN('free') && costN('paid') ? `<div class="frow"><span class="flabel">Cost</span><div class="rail" role="group" aria-label="Cost">${btn('cost', 'ALL', 'Any', null)}${btn('cost', 'free', 'Free', costN('free'))}${costN('help') > costN('free') ? btn('cost', 'help', 'Free or offers aid', costN('help')) : ''}${btn('cost', 'paid', 'Paid', costN('paid'))}${unpriced ? `<span class="hint rail-note">${unpriced} ${unpriced === 1 ? 'doesn’t' : 'don’t'} publish a price, so ${unpriced === 1 ? 'it shows' : 'they show'} only under Any.</span>` : ''}</div></div>` : '';
  // The day row appears once at least two programs in the list run on some weekdays only; until then it would filter nothing.
  const dayN = d => list.filter(p => p.days ? p.days.includes(d) : !/^s/.test(d)).length;   // no days published: a weekday program
  const weekendDays = ['sat', 'sun'].filter(d => list.some(p => p.days && p.days.includes(d)));
  const dayRow = on.day === true || (on.day !== false && list.filter(pickyDays).length > 1) ? `<div class="frow" id="by-day"><span class="flabel">Day</span><div class="rail" role="group" aria-label="Day of the week">${btn('day', 'ALL', 'Any day', null)}${[...WEEK, ...weekendDays].map(d => btn('day', d, DAY_NAME[d].slice(0, 3), dayN(d))).join('')}${list.some(p => !p.days) ? `<span class="hint rail-note">Programs that don’t publish their days show under every day.</span>` : ''}</div></div>` : '';
  const byGrade = on.age ? list.filter(p => (p._kind || 'after') === 'after') : list;   // on a mixed page the grade rail counts the after-school rows
  const gradeBtns = on.grade ? [['ALL', 'All']].concat(GRADES.map(g => [g, g])).map(([g, label]) => {
    const n = byGrade.filter(p => (!school || p.schools[school.id].relation !== 'nearby') && (g === 'ALL' || p._grades === null || p._grades.includes(g))).length;
    return `<button type="button" class="gbtn" id="grade-${g}" data-f="grade" data-v="${g}" aria-pressed="${g === 'ALL'}" aria-label="${g === 'ALL' ? 'All grades' : g === 'PK' ? 'Pre-K' : g === 'K' ? 'Kindergarten' : 'Grade ' + g}, ${n} ${school ? 'on-site or pickup programs' : 'programs'}"><span class="g">${label}</span><span class="n">${n}</span></button>`;
  }).join('') : '';
  // The age rail counts the rows that go by age: weekend classes, day camps and summer camps. Grades are for after school.
  const byAge = list.filter(p => p._kind && p._kind !== 'after');
  const ageBtns = on.age ? [['ALL', 'All']].concat(AGES.map(a => [a, a === String(AGE_TOP) ? `${AGE_TOP}+` : a])).map(([a, label]) => {
    const n = (byAge.length ? byAge : list).filter(p => a === 'ALL' || p._ages === null || p._ages === undefined || p._ages.includes(a)).length;
    return `<button type="button" class="gbtn" id="age-${a}" data-f="age" data-v="${a}" aria-pressed="${a === 'ALL'}" aria-label="${a === 'ALL' ? 'All ages' : a === String(AGE_TOP) ? `Age ${AGE_TOP} and up` : 'Age ' + a}, ${n} listings"><span class="g">${label}</span><span class="n">${n}</span></button>`;
  }).join('') : '';
  const both = on.grade && on.age;
  return `<div class="fbar needs-js-block" data-filters${school ? ` data-school="${esc(school.id)}"` : ''}>
    ${on.q ? `<div class="finder">
      <label for="prog-search">${T(searchLabel || `Looking for a particular program?`)}</label>
      <input id="prog-search" type="search" placeholder="${esc(placeholder)}" autocomplete="off">
      <p class="hint search-more" id="search-more" aria-live="polite" hidden></p>
    </div>` : ''}
    <div class="ftog">
      <button type="button" class="ftog-btn" id="filters-toggle" aria-expanded="false"><svg class="ftog-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h9M18 6h3M3 12h3M12 12h9M3 18h11M20 18h1" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="15" cy="6" r="2.6" fill="currentColor"/><circle cx="9" cy="12" r="2.6" fill="currentColor"/><circle cx="17" cy="18" r="2.6" fill="currentColor"/></svg><span>Filters</span><span class="quick-n" id="filters-n" hidden></span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <p class="ftog-hint" id="filters-hint"></p>
      <div class="ftog-chips" id="filters-chips" role="group" aria-label="Filters in use" hidden></div>
    </div>
    ${kindRow}${typeRow}${relRow}${hoodRow}${costRow}${dayRow}${near ? nearRow(depth, school) : ''}
  </div>
  ${near ? nearMap(depth) : ''}
  <section class="picker" aria-label="${both ? 'Filter by grade or age' : on.age ? 'Filter by age' : 'Filter by grade'}">
    ${on.grade ? `${both ? `<p class="pick-h">${T(`Grade, for after school`)}</p>` : ''}<div class="rail" role="group" aria-label="Grade">${gradeBtns}</div>` : ''}
    ${on.age ? `${both ? `<p class="pick-h">${T(`Age, for weekend classes and camps`)}</p>` : ''}<div class="rail" role="group" aria-label="Age">${ageBtns}</div>` : ''}
    <div class="status"><span id="count" aria-live="polite"></span><button type="button" class="clear" id="clear" hidden>Clear filters</button></div>
  </section>
  <div class="quickbar" id="quickbar" hidden>
    <div class="in">
      <div class="quick-row">
        ${on.q ? `<input id="quick-search" type="search" aria-label="${esc(T(searchLabel || `Looking for a particular program?`))}" placeholder="Search this list" autocomplete="off">` : ''}
        <button type="button" class="btn" id="quick-filters">Filters<span class="quick-n" id="quick-n" hidden></span></button>
      </div>
      <p class="quick-status"><span id="quick-count"></span> <button type="button" class="clear" id="quick-clear" hidden>Clear</button></p>
    </div>
  </div>`;
}
const noMatch = depth => `<p class="ask" id="no-match" data-nomatch data-edit-reveal="Shown when the filters find nothing:" hidden>${T(`Nothing matches that. Know a program that should be listed?`)} <a href="${link('suggest/', depth)}">${T(`Tell us about it.`)}</a></p>`;

// ---------- program card ----------
function card(p, school) {
  const l = p.schools[school.id];
  const rel = REL[l.relation];
  const g = p._grades;
  const mi = l.relation === 'onsite' ? null : milesFrom(school, p);
  const where = [l.address || p.address, l.distance || (mi !== null ? `about ${milesText(mi)} from ${school.shortName}, in a straight line` : '')].filter(Boolean).join(', ');
  const r = p.register;
  const regUrl = r.how === 'online' ? outUrl(l.registerUrl || r.url, { type: 'register', school, program: p }) : null;
  const revs = reviewsFor(p.id);
  const avg = revs.length ? average(revs) : 0;
  const reviewUrl = `${link('review/', 1)}?program=${p.id}&school=${school.id}`;
  const more = `<a href="${link(programPath(p), 1)}">Full details</a>`;
  const revHtml = revs.length
    ? `<details><summary><span class="stars" aria-hidden="true">${stars(Math.floor(avg + 0.25))}</span> <b>${avg.toFixed(1)} out of 5</b> from ${revs.length} ${revs.length === 1 ? 'review' : 'reviews'}</summary>
      <ul>${reviewItems(revs)}</ul></details>
    <a href="${reviewUrl}" data-track="review">Write a review</a>${more}`
    : `<span>No reviews yet.</span> <a href="${reviewUrl}" data-track="review">Write the first one</a>${more}`;
  const rows = [['Where', esc(where)], ['Hours', esc(p.hours)], ['Days', esc(daysLine(p))], ['Pick up by', esc(p.pickupBy || '')], ['Cost', esc(l.cost || p.cost)], ['Days off', p.daysOff ? `Runs a camp or full day when school is closed. <a href="${link(dayCampsPath, 1)}#${esc(p.id)}">Dates and details</a>` : ''], ['Register', registerText(p)], ['Next term', esc(r.nextTerm || '') + datesHtml(p, 1)], ['Contact', r.how === 'school' ? '' : contactHtml(p)]]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const flag = [p.note, l.note].filter(Boolean).join(' ');
  const fix = correctionHref(`Correction: ${p.name} (${school.shortName})`);
  return `<article class="prog" id="${esc(p.id)}" data-rel="${l.relation}"${p.offerDays ? ` data-offer-days="${esc(JSON.stringify(p.offerDays))}"` : ''} ${itemAttrs(p, [rel.pill.replace('{s}', school.shortName)], school)}>
  <div class="top"><span class="pill ${l.relation}">${esc(rel.pill.replace('{s}', school.shortName))}</span>${spaceSlot('p:' + p.id, 1)}<h3><a href="${link(programPath(p), 1)}">${esc(p.name)}</a></h3><p class="what">${esc(p.what)}</p><p class="tags">${typeTags(p, school)}</p>${p.offers?.length ? `<p class="offers"><b>${p.clubs ? 'Clubs' : 'Classes'}:</b> ${esc(p.offers.join(', '))}</p>` : ''}${p.clubs ? `<p class="club-match" data-club-match="${esc(JSON.stringify(clubsByType(p)))}" hidden></p>` : ''}</div>
  ${gradeStrip(p)}
  <dl>${rows}</dl>
  ${flag ? `<p class="flag">${esc(flag)}</p>` : ''}
  <div class="actions">${regUrl ? `<a class="btn primary" data-track="register" href="${esc(regUrl)}" target="_blank" rel="noopener">${esc(r.label || 'Register')}</a>` : ''}<a class="btn" data-track="website" href="${esc(outUrl(p.website, { type: 'website', school, program: p }))}" target="_blank" rel="noopener">Website</a><button type="button" class="btn needs-js" data-board-toggle data-clarity-mask="true" aria-expanded="false">Add to roster</button>
    <div class="days" data-clarity-mask="true" hidden><span class="kid-row" hidden></span><span class="which" role="group" aria-label="Current or upcoming roster"><button type="button" class="wb" data-board="next" aria-pressed="true">Upcoming</button><button type="button" class="wb" data-board="now" aria-pressed="false">Current</button></span><span class="hint">Which days?</span>${BOARD_DAYS.map(([k, n]) => `<button type="button" class="day${p.days && !p.days.includes(k) ? ' off" title="Not listed for ' + DAY_NAME[k] + 's' : ''}" data-day="${k}" aria-pressed="false">${n}</button>`).join('')}${p.offers?.length ? `<span class="cls-row"><span class="hint">Which class? Optional.</span>${p.offers.map(o => `<button type="button" class="cl" data-class="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join('')}</span>` : ''}<a href="${link('board/', 1)}">See the roster</a></div></div>
  <div class="rev">${revHtml}</div>
  <p class="src">Checked ${longDate(p.lastVerified)}. Sources: ${sourceLinks([...p.sources, ...(l.sources || [])], p, school)}${fix ? `<a href="${esc(fix)}">Suggest a correction</a>` : ''}</p>
</article>`;
}

// ---------- a page per program ----------
const listNames = a => a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

// ---------- dates by email ----------
// Sign-ups go from the visitor's browser straight to Klaviyo, using the public key in site.config.json.
// Once a day scripts/send-alerts.mjs reads data/alerts.json (written below) and tells Klaviyo who is due an email.
// The private key lives only in the repository's secrets. Nothing in this file or on the site ever holds it.
const ALERTS = cfg.alerts?.klaviyoKey && cfg.alerts?.listId ? cfg.alerts : null;
const alertsPath = 'alerts/';
const SEND_DAY = ALERTS?.sendDay ?? 0;   // 0 is Sunday
const SEND_DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][SEND_DAY];
const LEAD = { register: 1, dayoff: 10, ...(ALERTS?.lead || {}) };   // least notice, in days, before each kind of date
const longDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
// A date is announced on the last send day that still leaves `lead` days of notice, so there is one email a week at most.
const sendOn = (iso, lead) => { let d = isoAdd(iso, -lead); while (weekday(d) !== SEND_DAY) d = isoAdd(d, -1); return d; };
// ----- this week at a school -----
// One school week (Monday to Friday, named by its Monday): the days school is closed, the school's own dates, the
// things that happen every week, and sign-up dates at the programs that serve the school. "special" says whether
// anything in it is out of the ordinary: a week with only the every-week things is not worth an email.
const weekMonday = iso => isoAdd(iso, -((weekday(iso) + 6) % 7));
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const schoolWeek = (s, monday) => {
  const sd = schoolDatesFile.schools?.[s.id] || {}, days = [0, 1, 2, 3, 4].map(n => isoAdd(monday, n)), week = [0, 1, 2, 3, 4, 5, 6].map(n => isoAdd(monday, n));
  const closed = new Map(offDays.flatMap(d => d.dates.map(x => [x, d.name])));
  const lines = [];
  for (const d of days) {
    if (closed.has(d)) { lines.push({ d, kind: 'off', what: `No school: ${closed.get(d)}` }); continue; }
    if (daysOff?.lastDay && d > daysOff.lastDay) continue;
    if (d === daysOff?.lastDay) lines.push({ d, kind: 'last', what: 'Last day of school' });
    for (const e of sd.dates || []) if (e.date === d) lines.push({ d, kind: 'date', what: e.title.trim(), note: e.note || '', by: e.by });
    for (const e of sd.weekly || []) if (e.day === WEEKDAY_IDS[weekday(d) - 1] && (!e.from || e.from <= d) && (!e.until || e.until >= d)) lines.push({ d, kind: 'weekly', what: e.title.trim(), note: e.note || '', by: e.by });
  }
  for (const p of forSchool(s)) for (const r of p.register.dates || []) if (week.includes(r.date)) lines.push({ d: r.date, kind: 'signup', what: `Sign-ups, ${p.name}: ${r.label.trim().replace(/\.$/, '')}`, href: programPath(p) });
  const order = { off: 0, last: 1, date: 2, weekly: 3, signup: 4 };
  lines.sort((a, b) => a.d.localeCompare(b.d) || order[a.kind] - order[b.kind]);
  return { monday, lines, special: lines.some(l => l.kind !== 'weekly') };
};
const weekLabel = monday => `Week of ${new Date(monday + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}`;
// The weeks a school's page shows: this one (the coming one, from Saturday) and the next.
const thisMonday = () => weekMonday(isoAdd(TODAY, weekday(TODAY) === 6 ? 2 : weekday(TODAY) === 0 ? 1 : 0));

// ----- when did each date reach the site? -----
// A sign-up date is news, so the email about it goes out the morning after the date first appeared here. "Here" is
// read from the repository's own history: the day of the first commit on the main line whose copy of the data file
// holds that entry. Nobody has to write the day down, and a pull request merged a week after it was opened counts
// from the merge. An entry can still carry "posted": "YYYY-MM-DD" to say otherwise. Where the history can't be read
// (a shallow copy, as on the publishing job) the older timing is used: the send day before the date.
const phillyDay = when => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(when));
const firstSeen = (() => {
  if (process.env.PAS_NO_HISTORY) return null;
  try {
    const git = a => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256e6 });
    if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'false') return null;
    const seen = {};
    const files = [
      ['data/programs.json', d => (Array.isArray(d) ? d : []).flatMap(x => [...(x?.register?.dates || []).map(e => `p:${x.id}:${e?.date}`), ...(x?.updates || []).map(e => `pu:${x.id}:${e?.date}`)])],
      ['data/camps.json', d => (d?.camps || []).flatMap(x => [...(x?.dates || []).map(e => `c:${x.id}:${e?.date}`), ...(x?.updates || []).map(e => `cu:${x.id}:${e?.date}`)])],
    ];
    for (const [file, keys] of files) {
      const log = git(['log', '--first-parent', '-n', '500', '--format=%H %cI', '--', file]).trim().split('\n').filter(Boolean).reverse();   // oldest first
      for (const line of log) {
        const [sha, when] = line.split(' ');
        let data; try { data = JSON.parse(git(['show', `${sha}:${file}`])); } catch { continue; }
        for (const k of keys(data)) if (!seen[k]) seen[k] = phillyDay(when);
      }
    }
    return seen;
  } catch { return null; }
})();
// The day an entry was posted here: what it says, else what the history says, else (history readable, entry not in
// it yet: a change that hasn't been committed) today. Undefined when there is no way to know.
const postedOn = (key, d) => d.posted || (firstSeen ? firstSeen[`${key}:${d.date}`] || TODAY : undefined);
const dayAfter = iso => isoAdd(iso, 1);
// Each sign-up date makes up to three entries: the news (the morning after it was posted), a reminder the day
// before ("-eve") and one on the morning itself ("-day"). A reminder is left out when the news would already
// land on that day. Days off are not news, so they stay in the weekly round-up.
const signupItems = (base, key, d, label) => {
  const posted = postedOn(key, d);
  const told = posted ? dayAfter(posted) : sendOn(d.date, LEAD.register);
  const eve = isoAdd(d.date, -1);
  const text = label + '.';
  return [
    { ...base, id: `${base.id}-${d.date}`, kind: 'register', date: d.date, sendOn: told, when: longDay(d.date), text },
    ...(eve > told ? [{ ...base, id: `${base.id}-${d.date}-eve`, kind: 'soon', date: d.date, sendOn: eve, expires: eve, when: 'Tomorrow, ' + longDay(d.date), text }] : []),
    ...(d.date > told ? [{ ...base, id: `${base.id}-${d.date}-day`, kind: 'today', date: d.date, sendOn: d.date, when: 'Today, ' + longDay(d.date), text }] : []),
  ];
};
// A note ("updates") goes out the morning after it reached the site, and is dropped two days after that.
const noteDays = (key, u) => { const told = dayAfter(postedOn(key, u) || u.date); return { sendOn: told, expires: isoAdd(told, CATCH_UP_DAYS) }; };
const CATCH_UP_DAYS = 2;
const mailUrl = (rel, hash = '') => `${cfg.siteUrl}/${rel}?utm_source=klaviyo&utm_medium=email&utm_campaign=dates${hash}`;
// A camp's page in an email: its program's page, under Summer, when it is tied to one.
const mailLink = c => { const p = c.program && programs.find(x => x.id === c.program); return p ? mailUrl(programPath(p), '#summer') : mailUrl(campPath(c)); };
// The email to people who asked for a school, once it has a page (scripts/send-alerts.mjs composes it from the feed):
// its heading, intro and the line that says why it came, plus the item's title, text and button below. Worded here so
// they can be edited at /edit/emails/; the feed carries the current wording.
const ADDED_EMAIL = 'Your school is here (to people who asked for a school, sent through Klaviyo)';
const addedEmail = {
  heading: emailCopy(ADDED_EMAIL, 'Your school is here'),
  intro: emailCopy(ADDED_EMAIL, 'The school you were waiting for has its own page now.'),
  reason: emailCopy(ADDED_EMAIL, 'you asked to be told when this school was added'),
};
const ADDED_ITEM = { title: '{school} now has a page', text: 'You asked to be told. {programs} listed for {school} so far: the ones at the school, the ones that pick up from it and the ones close by.', button: 'See the page' };
for (const t of Object.values(ADDED_ITEM)) emailCopy(ADDED_EMAIL, t);   // listed for editing even before any school has been added
const alertItems = [
  ...programs.flatMap(p => upcomingDates(p).flatMap(d => signupItems({
    id: `reg-${p.id}`, schools: schools.filter(s => p.schools[s.id]).map(s => s.id), programs: [p.id],
    title: p.name, url: mailUrl(programPath(p)), button: 'See the listing',
  }, `p:${p.id}`, d, d.label.trim().replace(/\.$/, '')))),
  // A program's own camp days go only to the people following that program. Anyone who also gets the day-off
  // entry for the same day (it lists every camp) is not told twice: "within" names the entry that covers it.
  ...offDays.filter(d => d.date >= TODAY).flatMap(d => campsOn(d).map(p => {
    const days = p.daysOff.dates.filter(x => d.dates.includes(x));
    return {
      id: `camp-${p.id}-${d.date}`, kind: 'camp', date: d.date, sendOn: sendOn(d.date, LEAD.dayoff), schools: [], programs: [p.id], within: `off-${d.date}`,
      when: days.length === 1 ? longDay(days[0]) : `${longDay(days[0])} to ${longDay(days[days.length - 1])}`, title: `${p.name}: camp on a day off`,
      text: `School is closed (${d.name}). ${p.name} has posted a camp${days.length < d.dates.length ? ` for ${listNames(days.map(shortDate))}` : ''}.`,
      url: mailUrl(programPath(p)), button: 'See the listing',
    };
  })),
  // Notes from a program's "updates" list go out the morning after they are added, to its followers.
  ...programs.flatMap(p => (p.updates || []).map(u => ({
    id: `news-${p.id}-${u.date}`, kind: 'update', date: u.date, ...noteDays(`pu:${p.id}`, u), schools: [], programs: [p.id],
    when: 'Update', title: p.name, text: u.text.trim(), url: mailUrl(programPath(p)), button: 'See the listing',
  }))).filter(a => a.expires >= TODAY),
  ...offDays.filter(d => d.date >= TODAY).map(d => {
    const camps = campsOn(d);
    return {
      id: `off-${d.date}`, kind: 'dayoff', date: d.date, sendOn: sendOn(d.date, LEAD.dayoff), schools: ['*'], programs: [],
      when: d.end ? `${longDay(d.date)} to ${longDay(d.end)}` : longDay(d.date), title: `No school: ${d.name}`,
      text: camps.length ? `${camps.length === 1 ? 'One listed program has' : camps.length + ' listed programs have'} posted a camp: ${listNames(camps.map(p => p.name))}.` : 'No listed program has posted a camp for it yet.',
      url: mailUrl(dayPath(d)), button: camps.length ? 'See who’s open' : 'See the day',   // the day's own page, which anyone can read; the planner needs an account
    };
  }),
].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
// Entries that need the camp list and the city's school list, which are read further down this file.
//   a camp's own sign-up dates and notes  -> the people who asked about that camp
//   a school that has just been given a page -> the people who asked to be told when it was added
const lateAlertItems = () => [
  // "This week at your school": one entry a school a week, sent the Sunday before to the accounts that asked for it,
  // and only when the week has something out of the ordinary. Someone who turns it on by Tuesday still gets that week's.
  ...schools.flatMap(s => [-7, 0, 7, 14].map(n => schoolWeek(s, isoAdd(thisMonday(), n))).filter(w => w.special && isoAdd(w.monday, 2) >= TODAY).map(w => {
    const byDay = [...new Set(w.lines.map(l => l.d))].map(d => ({ when: DAY_NAMES[weekday(d)], what: w.lines.filter(l => l.d === d).map(l => l.what + (l.note ? ` (${l.note})` : '')).join('; ') }));
    return {
      id: `week-${s.id}-${w.monday}`, kind: 'week', date: isoAdd(w.monday, 4), sendOn: isoAdd(w.monday, -1), expires: isoAdd(w.monday, 2), schools: [], programs: [], weeks: [s.id],
      when: weekLabel(w.monday), title: `This week at ${s.shortName}`, text: byDay.map(x => `${x.when}: ${x.what}.`).join(' '), lines: byDay,
      first: w.lines.filter(l => l.kind !== 'weekly').slice(0, 2).map(l => `${DAY_NAMES[weekday(l.d)]}: ${l.what.replace(/^No school: /, 'no school, ')}`).join('; '),
      url: mailUrl(`${s.id}/`, '#this-week'), button: `See ${s.shortName}’s week`,
    };
  })),
  ...summerCamps.flatMap(c => (c.dates || []).filter(d => d.date >= TODAY).flatMap(d => signupItems({
    id: `campreg-${c.id}`, schools: [], programs: [], camps: [c.id], title: c.name, url: mailLink(c), button: 'See the camp',
  }, `c:${c.id}`, d, d.label.trim().replace(/\.$/, '')))),
  ...summerCamps.flatMap(c => (c.updates || []).map(u => ({
    id: `campnews-${c.id}-${u.date}`, kind: 'update', date: u.date, ...noteDays(`cu:${c.id}`, u), schools: [], programs: [], camps: [c.id],
    when: 'Update', title: c.name, text: u.text.trim(), url: mailLink(c), button: 'See the camp',
  }))).filter(a => a.expires >= TODAY),
  ...schools.filter(s => s.added).map(s => {
    const n = forSchool(s).length, v = { school: s.shortName, programs: n === 1 ? 'One program is' : n + ' programs are' };
    return {
      id: `added-${s.id}`, kind: 'added', date: s.added, sendOn: s.added, expires: isoAdd(s.added, 2), schools: [], programs: [],
      waiting: finderData.schools.filter(r => r[5] === s.id).map(r => r[0]),
      when: 'New', title: emailCopy(ADDED_EMAIL, ADDED_ITEM.title, v), text: emailCopy(ADDED_EMAIL, ADDED_ITEM.text, v),
      url: mailUrl(`${s.id}/`), button: emailCopy(ADDED_EMAIL, ADDED_ITEM.button, v),
    };
  }).filter(a => a.expires >= TODAY),
];

const alertsFeed = () => ({
  about: `Dated reminders for ${cfg.siteName}. Each one is emailed on its sendOn day to the people who follow that school, program or camp. Sign-up dates go the morning after they are posted, again the day before and on the morning itself; days off go in the weekly round-up.`,
  generated: TODAY, site: cfg.siteUrl, metric: ALERTS?.metric || 'School dates', sendDay: SEND_DAY_NAME,
  schools: schools.map(s => ({ id: s.id, name: s.shortName })),
  programs: programs.map(p => ({ id: p.id, name: fullName(p) })),
  camps: summerCamps.map(c => ({ id: c.id, name: c.name })),
  added: addedEmail,
  alerts: [...alertItems, ...lateAlertItems()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
});
// The sign-up box. With a school or a program it asks for a first name and an email; without either it also asks which school.
// A program box follows that one program: its dates, its day-off camps and its updates, and nothing else.
const alertsBox = (depth, { school = null, program = null, camp = null, place, title, lede }) => !ALERTS ? '' : `<section class="panel alerts" id="by-email">
  <h2>${title}</h2>
  <p>${lede}</p>
  <form class="alerts-form" data-alerts data-place="${place}" data-key="${esc(ALERTS.klaviyoKey)}" data-list="${esc(ALERTS.listId)}"${ALERTS.doubleOptIn ? ' data-confirm="1"' : ''}${PREVIEW ? ' data-preview="1"' : ''} data-clarity-mask="true" novalidate>
    <div class="alerts-row">
      ${camp ? `<input type="hidden" name="camp" value="${esc(camp.id)}" data-name="${esc(camp.name)}">` : program ? `<input type="hidden" name="program" value="${esc(program.id)}" data-name="${esc(fullName(program))}">` : school ? `<input type="hidden" name="school" value="${esc(school.id)}" data-name="${esc(school.shortName)}">` : `<div class="field">
        <label for="al-school-${place}">${T(`Your school`)}</label>
        <select id="al-school-${place}" name="school">
          ${[...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `<option value="${esc(s.id)}" data-name="${esc(s.shortName)}">${esc(s.shortName)}</option>`).join('')}
          <option value="all" data-name="">${T(`A school that isn’t listed yet`)}</option>
        </select>
      </div>`}
      <div class="field">
        <label for="al-name-${place}">${T(`Your first name`)}</label>
        <input id="al-name-${place}" name="first_name" type="text" maxlength="60" autocomplete="given-name" required>
      </div>
      <div class="field">
        <label for="al-email-${place}">${T(`Your email`)}</label>
        <input id="al-email-${place}" name="email" type="email" maxlength="150" autocomplete="email" inputmode="email" required>
      </div>
      <div class="hp" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">
        <label for="al-company-${place}">Leave this blank</label>
        <input id="al-company-${place}" name="company" type="text" tabindex="-1" autocomplete="off">
      </div>
      <button class="btn primary big" type="submit">${program || camp ? T(`Tell me`) : T(`Send me the dates`)}</button>
    </div>
    <p class="hint">${camp ? T(`Only about this camp, on a {day} morning. We read each camp’s site again about once a month, so the email can come a few weeks after the camp’s own announcement. If a camp fills fast, watch its site too. Every email has an unsubscribe link.`, { day: SEND_DAY_NAME }) : program ? T(`Only when this program posts something new, on a {day} morning. Every email has an unsubscribe link.`, { day: SEND_DAY_NAME }) : T(`One email on {day} morning, and only in a week with a date coming up. Every email has an unsubscribe link.`, { day: SEND_DAY_NAME })} <a href="${link('privacy/', depth)}#email">${T(`How we handle your email.`)}</a></p>
    <p class="alerts-status" data-alerts-status aria-live="polite"></p>
  </form>
  <noscript><p class="hint">${T(`Signing up needs JavaScript.`)}</p></noscript>
</section>`;
// Follow and Save. Following a program, a camp or a school means its dates come by email; saving a listing keeps it
// in the account as a favorite, with no emails. Both need an account, so the box signs someone in on the spot
// (src/site.js draws the buttons' state; src/groups.js, fetched only when needed, draws the sign-in).
const BELL = '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 22a2.500 2.500 0 0 0 2.400-2h-4.800a2.500 2.500 0 0 0 2.400 2zm7-6v-5a7 7 0 0 0-5.500-6.800v-.700a1.500 1.500 0 0 0-3 0v.700A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>';
const followBox = (depth, { key = '', name = '', place, title, lede, hint = '', fav = false, pick = false, h = 'h2', cls = '', id = 'by-email' }) => !(ALERTS && GROUPS) ? '' : `<div class="follow${cls ? ' ' + cls : ''}" id="${id}" data-follow="${esc(key)}" data-name="${esc(name)}" data-place="${place}" ${groupsAttrs(depth)} data-accounts="${link('assets/groups.js', depth)}${GROUPS_V}"${PREVIEW ? ' data-preview="1"' : ''} data-clarity-mask="true">
  <div class="follow-top">
    <span class="follow-ic" aria-hidden="true">${BELL}</span>
    <div class="follow-say"><${h}>${title}</${h}><p>${lede}</p></div>
  </div>
  ${pick ? `<div class="field follow-pick">
    <label for="follow-school-${place}">${T(`Your school`)}</label>
    <select id="follow-school-${place}" data-follow-pick>
      ${[...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `<option value="${esc(s.id)}" data-name="${esc(s.shortName)}">${esc(s.shortName)}</option>`).join('')}
      <option value="all" data-name="${esc(T(`every school on the site`))}">${T(`A school that isn’t listed yet`)}</option>
    </select>
  </div>` : ''}
  <div class="follow-acts needs-js-block">
    <button class="btn primary" type="button" data-follow-btn>${T(`Follow`)}</button>
    ${fav ? `<button class="btn" type="button" data-fav-btn aria-pressed="false">${T(`Save to favorites`)}</button>` : ''}
  </div>
  ${fav ? `<p class="follow-which"><b>${T(`Follow`)}</b> ${T(`means emails when it posts a date.`)} <b>${T(`Save to favorites`)}</b> ${T(`means no emails: it’s kept on your profile so you can find it again.`)}</p>` : ''}
  <div class="follow-signin" data-follow-signin hidden></div>
  <p class="follow-status" data-follow-status aria-live="polite"></p>
  <div class="follow-more" data-follow-more hidden></div>
  <p class="hint">${hint} ${fav ? T(`Both use a free account.`) : T(`Following uses a free account.`)}</p>
  <noscript><p class="hint">${T(`Following needs JavaScript.`)}</p></noscript>
</div>`;
// Wherever a sign-up form for dates used to sit: the follow box when accounts are on, the plain form when they aren't.
const datesBox = (depth, o) => ALERTS && GROUPS ? followBox(depth, o) : alertsBox(depth, o.old);
// Where "Stop emails about ..." in an email lands. The link carries the account's stop code and one thing it follows,
// after the #, so neither reaches a server log. The page asks before it does anything, then stops that one follow.
function stopPage() {
  const D = 2;
  const hero = `    <h1>${T(`Stop emails about one thing`)}</h1>
    <p class="lede">${T(`You only hear about what you follow. Stop one and the rest carry on.`)}</p>`;
  const body = `<div ${groupsAttrs(D)} data-stop-page style="display:contents">
  <noscript><p class="ask">${T(`This page needs JavaScript turned on. You can also sign in and stop following from your profile.`)}</p></noscript>
  <section class="panel stop-box needs-js-block" id="stop-box" aria-live="polite"><p class="hint">${T(`One moment…`)}</p></section>
  <p class="hint">${T(`To see or change everything you follow,`)} <a href="${link('account/', D)}#following">${T(`sign in to your account`)}</a>. ${T(`The Unsubscribe link at the foot of any email stops every email from us, including news about the site.`)}</p>
</div>`;
  return layout({ title: 'Stop emails about one thing', description: `Stop ${cfg.siteName} emails about one program, camp or school.`, pathName: alertsPath + 'stop/', depth: D, current: null, hero, body, noindex: true, quiet: true });
}

function alertsPage() {
  const hero = `    <h1>${T(`The dates, before they sneak up on you`)}</h1>
    <p class="lede">${T(`Sign-up openings, deadlines and days off for your school, by email. Sign-up dates come the morning after they’re posted here, and days off in a {day} round-up.`, { day: SEND_DAY_NAME })}</p>`;
  const soon = alertItems.filter(a => a.date >= TODAY).slice(0, 6);
  const body = `<div class="suggest">
  ${datesBox(1, { pick: true, place: 'page', title: T(`Which school?`), lede: T(`Pick your school and follow it. If you’re new, signing in takes a minute: an email address and a 6-digit code.`), hint: T(`Sign-up dates reach you the morning after they’re posted here, then again the day before and at about 8 that morning. Days off come in a {day} round-up.`, { day: SEND_DAY_NAME }), old: { place: 'page', title: T(`Where should they go?`), lede: T(`Pick your school, then leave your first name and an email address. That’s the whole form.`) } })}
  <aside class="next">
    <h2>${T(`What you’ll get`)}</h2>
    <ul class="rules ticks">
      <li>${T(`A heads-up when sign-ups open or a deadline is close at a program that serves your school.`)}</li>
      <li>${T(`Each district day off at least {n} days ahead, with the listed programs running a camp that day.`, { n: LEAD.dayoff })}</li>
      <li>${T(`Sign-up news can come on any morning, so you don’t find out after the spots are gone. If your school isn’t listed yet, you get the days off and every listed program’s dates.`)}</li>
      <li>${T(`Waiting on one program? Each program’s page has a “Tell me when sign-ups open” box, for emails about that program alone.`)}</li>
      ${summerCamps.length ? `<li>${T(`Waiting on a summer camp? Each camp’s page has a box to be emailed when it posts next summer or names a sign-up day.`)}</li>` : ''}
      <li>${GROUPS ? T(`It runs on a free account, so you can see and change what you follow. No questions about your children.`) : T(`No account, and no questions about your children.`)}</li>
    </ul>
    ${soon.length ? `<h2>${T(`Dates coming up`)}</h2>
    <ul class="rules soon">
      ${soon.map(a => `<li><b>${shortDate(a.date)}</b><span>${esc(a.kind === 'register' ? `${a.title}: ${a.text}` : a.title.replace(/^No school: /, 'No school, ') + '.')}</span></li>`).join('\n      ')}
    </ul>` : ''}
  </aside>
</div>`;
  return layout({ title: 'Dates by email', description: `Get after-school sign-up dates, deadlines and days off for your Philadelphia school by email from ${cfg.siteName}.`, pathName: alertsPath, depth: 1, current: null, hero, body, showStreet: 'parked' });
}
const servedBy = p => schools.filter(s => p.schools[s.id]);
// "Picks up from Nebinger and Meredith; near Coppin"
const servedSummary = p => {
  const names = k => servedBy(p).filter(s => p.schools[s.id].relation === k).map(s => s.shortName);
  const parts = [['onsite', 'runs at '], ['pickup', 'picks up from '], ['nearby', 'near ']].filter(([k]) => names(k).length).map(([k, lead]) => lead + listNames(names(k)));
  const t = parts.join('; ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
// The same summary as colored labels, for the top of a program's page and its row in a citywide list: pickup in
// yellow, on-site in green, nearby in blue. One label for each kind, naming every school, so a program that picks up
// from five schools shows one label, not five.
const servedPills = p => {
  const names = k => servedBy(p).filter(s => p.schools[s.id].relation === k).map(s => s.shortName);
  return [['onsite', 'Runs at '], ['pickup', 'Picks up from '], ['nearby', 'Near ']].filter(([k]) => names(k).length).map(([k, lead]) => `<span class="pill ${k} multi">${esc(lead + listNames(names(k)))}</span>`).join(' ');
};
const programAddress = p => {
  if (p.address) return p.address;
  const served = servedBy(p);
  return served.length === 1 && p.schools[served[0].id].relation === 'onsite' ? `${served[0].name}, ${served[0].address.split(',')[0]}` : '';
};

// The site name carries "after school" into the title when it fits. When it doesn't, the title says it itself,
// unless the program's own name already does or the result would run long.
const programTitle = p => {
  if (campOnly(p)) return p.daysOff && p.weekend ? `${fullName(p)}: day camps and weekend classes` : p.weekend ? `${fullName(p)}: weekend classes for kids` : `${fullName(p)}: day camps when school is closed`;
  const n = fullName(p), plain = `${n}: hours, cost and pickup`, said = `${n} after school: hours, cost, pickup`;
  if (`${plain} | ${cfg.siteName}`.length <= 65) return plain;
  return said.length <= 65 && !/after[- ]?school|aftercare/i.test(n) ? said : plain;
};

// A long row on a program's page shows its first two lines; a tap opens the rest. It is a <details>, so it works
// without JavaScript, and the whole text sits in the summary, so nothing is cut out of the page for search or a screen reader.
const fold = (html, tail = '') => {
  if (!html) return tail;
  if (html.replace(/<[^>]+>/g, '').length <= 105) return html + tail;
  return `<details class="fold"><summary><span class="fold-text">${html}</span><span class="fold-more" aria-hidden="true"><span class="m">${T(`More`)}</span><span class="l">${T(`Less`)}</span></span></summary></details>${tail}`;
};
// ---------- a program's page: one section for each part of the year it covers ----------
// After school, weekends, day camps and summer each get a section of the same shape: the details, then a filled
// button that puts it on the parent's plan for that part of the year and plain ones that go to the provider's own
// sign-up and website. A strip under the menu bar jumps between the sections. A summer camp tied to a program
// (camps.json "program") is that program's Summer section, and the camp's old address leads here.
const campOf = p => summerCamps.find(c => c.program === p.id) || null;
const KIND_SECTION = { after: ['after-school', 'After school'], weekend: ['weekend', 'Weekends'], off: ['days-off', 'Day camps'], summer: ['summer', 'Summer'] };
const partsOf = p => [...(campOnly(p) ? [] : ['after']), ...(p.weekend ? ['weekend'] : []), ...(p.daysOff ? ['off'] : []), ...(campOf(p) ? ['summer'] : [])];
// The hero's line of what it runs: a pill for each section, in the order of the year.
const runsStrip = kinds => `<p class="runs"><span class="runs-h">${T(`Runs`)}</span> ${kinds.map(k => `<a class="pill kind kind-${k}" href="#${KIND_SECTION[k][0]}">${esc(KIND_SECTION[k][1])}</a>`).join(' ')}</p>`;
const kindSection = (k, inner) => `<section class="section kind-section kind-${k}" id="${KIND_SECTION[k][0]}" data-jump-to="${KIND_SECTION[k][1]}">
    <h2 class="kind-h"><span class="kind-dot" aria-hidden="true"></span>${esc(KIND_SECTION[k][1])}</h2>
    ${inner}
  </section>`;
// A program's day camps: every break still to come that it has posted a camp for, each date a link that opens
// that day in the days-off planner.
const offDatesHtml = (p, depth) => {
  const items = offDays.map(d => {
    const left = d.dates.filter(x => x >= TODAY), on = left.filter(x => p.daysOff.dates.includes(x));
    if (!on.length) return '';
    return `<li><b>${esc(dayLabel(d))}</b>${on.length < left.length ? ` <span class="hint">${on.length} of ${left.length} days</span>` : ''}<span class="brk-dates">${on.map(x => `<a href="${link(offPath, depth)}#d-${x}">${esc(dayDate(x))}</a>`).join('')}</span></li>`;
  }).filter(Boolean);
  if (!items.length) return '';
  const shown = items.slice(0, 4), rest = items.slice(4);
  return `<ul class="off-breaks">${shown.join('')}</ul>${rest.length ? `<details class="off-more"><summary>${rest.length === 1 ? T(`1 more break`) : T(`{n} more breaks`, { n: rest.length })}</summary><ul class="off-breaks">${rest.join('')}</ul></details>` : ''}`;
};
function programPage(p) {
  const D = 2;
  const served = servedBy(p);
  const r = p.register;
  const revs = reviewsFor(p.id);
  const avg = revs.length ? average(revs) : 0;
  const address = programAddress(p);
  const regUrl = r.how === 'online' ? outUrl(r.url, { type: 'register', program: p }) : null;
  const siteBtn = `<a class="btn" data-track="website" href="${esc(outUrl(p.website, { type: 'website', program: p }))}" target="_blank" rel="noopener">${T(`Website`)}</a>`;
  const reviewUrl = `${link('review/', D)}?program=${p.id}${served.length === 1 ? '&school=' + served[0].id : ''}`;
  const clubsDetailed = !!p.clubs && p.clubs.some(c => c.days || c.time || c.what);   // a bare list of names stays a line of text
  const kinds = partsOf(p);
  const camp = campOnly(p), tied = campOf(p);
  const rows = [['Where', esc(address)], [p.clubs ? 'Clubs' : 'Classes', clubsDetailed ? '' : fold(esc((p.offers || []).join(', ')))], ['Hours', fold(esc(p.hours))], ['Days', esc(daysLine(p))], ['Pick up by', esc(p.pickupBy || '')], ['Cost', fold(esc(p.cost))], ['Register', fold(registerText(p))], ['Next term', fold(esc(r.nextTerm || ''), datesHtml(p, D))], ['Contact', r.how === 'school' ? '' : contactHtml(p)]]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const schoolRows = served.map(s => {
    const l = p.schools[s.id];
    const line = l.relation === 'onsite' ? `Runs at ${s.shortName}, so there’s no travel after the bell.`
      : l.relation === 'pickup' ? (s.dismissal ? `Picks up from ${s.shortName} at dismissal, which is ${s.dismissal}.` : `Picks up from ${s.shortName} at dismissal. The school doesn’t post the time.`)
      : `We couldn’t find a pickup from ${s.shortName}, so your child would need to get there.`;
    const extra = [l.address ? `${s.shortName} children go to ${l.address}.` : '', l.distance ? l.distance.charAt(0).toUpperCase() + l.distance.slice(1) + '.' : ''].filter(Boolean).join(' ');
    const links = [
      l.registerUrl && r.how === 'online' ? `<a href="${esc(outUrl(l.registerUrl, { type: 'register', school: s, program: p }))}" target="_blank" rel="noopener" data-track="register">${esc(r.label || 'Register')} (${esc(s.shortName)})</a>` : '',
      `<a class="needs-js" href="${link('board/', D)}?add=${esc(p.id)}&amp;school=${esc(s.id)}">Add it to your week</a>`,
      `<a href="${link(s.id + '/', D)}">All ${forSchool(s).length} options for ${esc(s.shortName)}</a>`,
      l.sources?.length ? `<span>Source: ${sourceLinks(l.sources, p, s)}</span>` : '',
    ].filter(Boolean).join('');
    return `<div class="serve">
      <span class="pill ${l.relation}">${esc(REL[l.relation].pill.replace('{s}', s.shortName))}</span>
      <h3>${esc(s.name)}</h3>
      <p>${esc(line)}${extra ? ' ' + esc(extra) : ''}</p>
      ${l.cost ? `<p><b>Cost:</b> ${esc(l.cost)}</p>` : ''}
      ${l.note ? `<p class="flag">${esc(l.note)}</p>` : ''}
      <p class="serve-links">${links}</p>
    </div>`;
  }).join('\n');
  const fix = correctionHref(`Correction: ${p.name}`);
  const clubsHtml = clubsDetailed ? `<section class="section">
    <h2>${T(`This year’s clubs`)}</h2>
    <p class="hint">${T(`From the school’s own list. Days, grades and openings change, so check with the club’s teacher before you count on one.`)}</p>
    <div class="clubs">
${p.clubs.map(c => `      <article class="club">
        <h3>${esc(c.name)}</h3>
        <p class="club-when">${[c.days ? `<b>${esc(clubDays(c))}</b>` : '', esc(c.time || ''), esc(clubGrades(c))].filter(Boolean).join(' <span aria-hidden="true">·</span> ')}</p>
        ${c.what ? `<p>${esc(c.what)}</p>` : ''}
        <dl>${[['Runs', c.when], ['Sign-up', c.status]].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        ${c.note ? `<p class="flag">${esc(c.note)}</p>` : ''}
      </article>`).join('\n')}
    </div>
  </section>` : '';
  const hoodHas = n => hoods.some(h => h.id === hoodSlug(n));
  // After school: the weekday details, "Add to your week", then register and website
  const afterSection = camp ? '' : kindSection('after', `${photoSlot('p:' + p.id)}
    <article class="prog solo">
      ${gradeStrip(p)}
      <dl>${rows}</dl>
      ${p.note ? `<p class="flag">${esc(p.note)}</p>` : ''}
      <div class="actions"><a class="btn primary needs-js" href="${link('board/', D)}?add=${esc(p.id)}">${T(`Add to your week`)}</a>${regUrl ? `<a class="btn" data-track="register" href="${esc(regUrl)}" target="_blank" rel="noopener">${esc(r.label || 'Register')}</a>` : ''}${siteBtn}</div>
    </article>
    <p class="hint">${T(`Prices, hours and pickup routes change during the year. Confirm with the provider before you enroll.`)}</p>`);
  // Weekends: what runs, on which day, the term and the cost; a button for each day it runs
  const w = p.weekend;
  const weekendSection = !w ? '' : kindSection('weekend', `<article class="prog solo">
      ${gradeStrip(w._grades !== undefined ? { ...p, _grades: w._grades, gradeNote: '' } : p)}
      <dl>${[['What runs', fold(esc(w.summary || ''))], ['Days', esc(w.days.map(d => WK_DAY[d] + (w.times && w.times[d] ? `, ${w.times[d]}` : '')).join('; '))], ['Term', fold(esc(w.term || ''))], ['Cost', fold(esc(w.cost || ''))], ['Where', esc(address)], ['Contact', r.how === 'school' ? '' : contactHtml(p)]].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${w.note ? `<p class="flag">${esc(w.note)}</p>` : ''}
      <div class="actions">${w.days.map(d => `<a class="btn primary needs-js" href="${link('board/', D)}?wk=${esc(p.id)}&amp;day=${d}">${T(`Add {day} to your week`, { day: WEEKEND_DAY[d] })}</a>`).join('')}<a class="btn" data-track="weekend" href="${esc(outUrl(w.url || p.website, { type: 'website', program: p }))}" target="_blank" rel="noopener">${T(`Class details and sign-up`)}</a>${w.url && w.url !== p.website ? siteBtn : ''}</div>
    </article>
    <p class="hint">${T(`Weekend terms start and fill on their own dates, so check with the provider before you count on a class.`)}</p>`);
  // Day camps: the days it has posted, break by break; each date opens that day in the days-off planner
  const o = p.daysOff;
  const offList = o ? offDatesHtml(p, D) : '';
  const firstOff = o ? o.dates.filter(x => x >= TODAY).sort()[0] : '';
  const offSection = !o ? '' : kindSection('off', `<article class="prog solo">
      <dl><dt>${T(`Camps`)}</dt><dd>${fold(esc(o.summary || ''))}</dd>${offList ? `<dt>${T(`Days posted`)}</dt><dd>${offList}</dd>` : `<dt>${T(`Days posted`)}</dt><dd>${T(`None yet for the days still to come. This page changes when it posts them.`)}</dd>`}<dt>${T(`Where`)}</dt><dd>${esc(address)}</dd></dl>
      <div class="actions"><a class="btn primary needs-js" href="${link(offPath, D)}${firstOff ? '#d-' + firstOff : ''}">${firstOff ? T(`Save it to your days off`) : T(`Plan the days off`)}</a><a class="btn" data-track="daysoff" href="${esc(outUrl(o.url || p.website, { type: 'website', program: p }))}" target="_blank" rel="noopener">${T(`Camp details and sign-up`)}</a><a class="btn" href="${link(dayCampsPath, D)}">${T(`Who else is open`)}</a></div>
    </article>
    <p class="hint">${T(`Day-camp dates come from the program’s own site and change as it posts them. Confirm before you count on a day.`)}</p>`);
  const summerSection = !tied ? '' : kindSection('summer', summerBlock(tied, D, true));
  const hero = `    <p class="where">${camp ? (p.daysOff ? `<a href="${link(dayCampsPath, D)}">${T(`Day-camp programs`)}</a>` : `<a href="${link(weekendPath, D)}">${T(`Weekend classes`)}</a>`) : `<a href="${link('programs/', D)}">${T(`After-school programs`)}</a> <span class="served">${servedPills(p)}</span>`}</p>
    <h1>${esc(fullName(p))}</h1>
    <p class="lede">${esc(p.what)}</p>
    ${runsStrip(kinds)}
    <div class="facts">
      <span>${p.types.map(t => typeCount(TYPE[t]) && !schoolRun(p) ? `<a href="${link('types/' + t + '/', D)}">${esc(TYPE[t].label)}</a>` : esc(TYPE[t].label)).join(', ')}</span>
      ${programHoods(p).length ? `<span>In <b>${programHoods(p).every(hoodHas) ? hoodLinks(programHoods(p), D) : esc(programHoods(p).join(', '))}</b></span>` : ''}
      <span>Grades <b>${esc(gradeText(p))}</b></span>
      ${p.pickupBy ? `<span>Pick up by <b>${esc(p.pickupBy)}</b></span>` : ''}
      ${revs.length ? `<span><b>${avg.toFixed(1)} out of 5</b> from ${revs.length} ${revs.length === 1 ? 'review' : 'reviews'}</span>` : ''}
      <span>Checked <b>${longDate(p.lastVerified)}</b></span>
      ${claimedMark('p:' + p.id, D)}
      ${spaceSlot('p:' + p.id, D)}
    </div>`;
  const body = `<div data-program-page="${esc(p.id)}" style="display:contents">
  ${pageNav(jumpNav())}
  <section class="section follow-first" id="follow">
    ${ALERTS && GROUPS ? followBox(D, { key: 'p:' + p.id, name: fullName(p), place: 'program', fav: true, cls: 'wide', title: T(`Follow it, or save it for later`), lede: T(`One email when {program} posts a sign-up date, a deadline or a day-off camp.`, { program: fullName(p) }), hint: T(`An email the morning after it posts a date here, then reminders the day before and at about 8 on the morning sign-ups open.`) }) : alertsBox(D, { program: p, place: 'program', title: T(`Tell me when sign-ups open`), lede: T(`One email when {program} posts a sign-up date, a deadline or a day-off camp. Just this program. For every program at your school, sign up on your school’s page.`, { program: fullName(p) }) })}
  </section>
  ${afterSection}
  ${clubsHtml}
  ${weekendSection}
  ${offSection}
  ${summerSection}
  <section class="section">
    ${listingTools('p:' + p.id, fullName(p), D, 'program')}
  </section>
  ${premiumSlot('p:' + p.id, fullName(p), D)}
  ${camp ? `<section class="section" id="schools" data-jump-to="Schools">
    <h2>${p.daysOff && p.weekend ? T(`Listed for its day camps and weekend classes`) : p.weekend ? T(`Listed for its weekend classes`) : T(`Listed for its day camps`)}</h2>
    <p>${p.scope === 'weekend' ? T(`We’ve only read up on its weekend classes so far, so it isn’t on any school’s page.`) : p.scope === 'dayoff' ? T(`We’ve only read up on its camps on days off so far, so it isn’t on any school’s page.`) : T(`We couldn’t find a weekday after-school program here, so it isn’t on any school’s page.`)} ${p.daysOff ? T(`It runs camps on days school is closed, and children from any school can go.`) + ' ' : ''}${p.weekend ? T(`It runs classes on weekends.`) : ''}</p>
    <p>${T(`Does it run something after school that we missed?`)} <a href="${link('suggest/', D)}">${T(`Tell us.`)}</a></p>
  </section>` : `<section class="section" id="schools" data-jump-to="Schools">
    <h2>${T(`Which schools it works for`)}</h2>
    <div class="serves">
${schoolRows}
    </div>
    <p>${T(`Does it serve a school that isn’t shown here?`)} <a href="${link('suggest/', D)}">${T(`Tell us.`)}</a></p>
  </section>`}
  <section class="section" id="reviews" data-jump-to="Reviews" data-rv-program="${esc(p.id)}">
    <h2>${T(`What parents say`)}</h2>
    ${revs.length ? `<p><span class="stars" aria-hidden="true">${stars(Math.floor(avg + 0.25))}</span> <b>${avg.toFixed(1)} out of 5</b> from ${revs.length} ${revs.length === 1 ? 'review' : 'reviews'}</p>
    <ul class="revlist">${reviewItems(revs)}</ul>` : `<p>${T(`No reviews yet. If your child has been, a few sentences help the next family choose.`)}</p>`}
    <p class="rv-yours" hidden></p>
    <p class="actions"><a class="btn" href="${reviewUrl}" data-track="review">${revs.length ? T(`Write a review`) : T(`Write the first review`)}</a></p>
    <p class="hint">${T(`Reviews are first-hand notes from parents and caregivers. Each one is read before it’s posted.`)}</p>
  </section>
  <p class="src">Checked ${longDate(p.lastVerified)}. Sources: ${sourceLinks(p.sources, p)}${tied ? ` Summer: ${sourceLinks(tied.sources, tied)}` : ''}${p.told ? ` ${T(`Some of this came from the program itself, on {date}.`, { date: longDate([...p.told].sort((a, b) => a.on.localeCompare(b.on)).pop().on) })}` : ''}${fix ? `<a href="${esc(fix)}">Suggest a correction</a>` : ''}</p>
</div>`;
  const url = `${cfg.siteUrl}/${programPath(p)}`;
  const thing = {
    '@type': address ? 'LocalBusiness' : 'Organization',
    '@id': url + '#program',
    name: fullName(p), description: p.what, url: p.website,
    ...(address ? { address: `${address}, Philadelphia, PA` } : {}),
    ...(p.phone ? { telephone: '+1-' + p.phone } : {}),
    areaServed: served.map(s => ({ '@type': 'School', name: s.name, address: s.address })),
    ...(revs.length ? {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(avg.toFixed(1)), reviewCount: revs.length, bestRating: 5, worstRating: 1 },
      review: revs.map(x => ({ '@type': 'Review', author: { '@type': 'Person', name: x.name }, datePublished: x.date, reviewBody: x.comment, reviewRating: { '@type': 'Rating', ratingValue: x.stars, bestRating: 5, worstRating: 1 } })),
    } : {}),
  };
  const crumbs = { '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], camp ? (p.daysOff ? ['Day-camp programs', `${cfg.siteUrl}/${dayCampsPath}`] : ['Weekend classes', `${cfg.siteUrl}/${weekendPath}`]) : ['Programs', cfg.siteUrl + '/programs/'], [fullName(p), url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) };
  const KIND_WORD = { after: 'after school', weekend: 'weekend classes', off: 'day camps when school is closed', summer: 'summer camp' };
  return layout({
    title: programTitle(p),
    description: camp ? `${fullName(p)}: ${p.what}. ${kinds.map(k => KIND_WORD[k]).join(', ')}: dates, hours, grades and how to register.` : `${fullName(p)}: ${p.what}. ${servedSummary(p)}. ${kinds.length > 1 ? 'Also ' + kinds.slice(1).map(k => KIND_WORD[k]).join(', ') + '. ' : ''}Grades, hours, cost, registration and parent reviews.`,
    pathName: programPath(p), depth: D, current: null, hero, body, ...(p.hidden ? { noindex: true } : {}),
    jsonLd: { '@context': 'https://schema.org', '@graph': [thing, crumbs] },
  });
}

// The after-school list: one section per kind of program (each listing under the first of its types), A to Z
// inside each, with a strip under the menu bar that jumps between the sections. The filters narrow the lot.
function programsPage() {
  const list = [...citywide].sort((a, b) => a.name.localeCompare(b.name));
  const { pills, sections } = typeSections('after', list, 1);
  const hero = `    <p class="where"><a href="${link('all-programs/', 1)}"><span aria-hidden="true">←</span> ${T(`Back to all programs`)}</a></p>
    <h1>${T(`After-school programs`)}</h1>
    <p class="lede">${T(`All {n} after-school programs on this site, across every school, sorted by what they are. Narrow them by type, grade or neighborhood, then open one for its hours, cost and how to register.`, { n: list.length })}</p>${heroGo(1, link('board/', 1), T(`Plan your week`))}
    ${pills}`;
  const body = `${pageNav(jumpNav())}
${filterBar({ list, depth: 1, show: { day: true }, near: true, searchLabel: `Find a program`, placeholder: 'A name, or try drums, art, chess…' })}
${noMatch(1)}
${sections}
<section class="section">
  <p>${T(`A program is listed under the first of its types; its other types are on its row. Clubs a school runs for its own students aren’t in this list. They’re on that school’s page.`)}</p>
  <p>${T(`To see only what works with your child’s school,`)} <a href="${link('schools/', 1)}">${T(`start from your school.`)}</a> ${T(`Or see what’s close to home:`)} <a href="${link('neighborhoods/', 1)}">${T(`browse by neighborhood.`)}</a></p>
</section>`;
  return layout({
    title: 'All after-school programs in Philadelphia, by type',
    description: `All ${citywide.length} after-school programs listed on ${cfg.siteName}, sorted by what they are: aftercare, music, art, sports and more, with hours, cost, pickup and reviews.`,
    pathName: 'programs/', depth: 1, current: null, hero, body,
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: fullName(p), url: `${cfg.siteUrl}/${programPath(p)}` })) },
  });
}

// ---------- program types: an index, and a page per type ----------
// A type page has every listing of that kind of thing, whatever part of the year it fills: after-school programs,
// weekend classes, day camps and summer camps, each in its own section, with a Kind filter over the lot.
const KINDS = ['after', 'weekend', 'off', 'summer'];
const KIND_NAME = { after: 'After school', weekend: 'Weekend classes', off: 'Day camps', summer: 'Summer camps' };
const KIND_LIST = () => ({ after: 'programs/', weekend: weekendPath, off: dayCampsPath, summer: campsPath });   // each kind's own list (the paths are set further down)
// Everything listed under a kind, sorted by name: the lists each kind's own page shows.
const ofKind = k => k === 'after' ? [...citywide].sort((a, b) => a.name.localeCompare(b.name)) : k === 'weekend' ? weekendPrograms : k === 'off' ? campPrograms : [...summerCamps].sort((a, b) => a.name.localeCompare(b.name));
const typeCount = t => new Set(KINDS.flatMap(k => ofKind(k).filter(p => p.types.includes(t.id)).map(p => p.id))).size;   // distinct listings, over every kind
const liveTypes = () => TYPES.filter(t => typeCount(t));
const typeChips = (depth, skip) => liveTypes().filter(t => t.id !== skip).map(t => `<a class="tchip" style="--tc:${t.color}" href="${link('types/' + t.id + '/', depth)}">${typeIcon(t)}<span>${esc(t.label)}</span><b>${typeCount(t)}</b></a>`).join('');
// The sections of a mixed list: one per kind that has anything, each with a heading, a count and its rows. The rows
// are the same ones the kind's own list uses, so a listing that fills two parts of the year is in two sections.
const kindSections = (byKind, depth, { h = 'h2', lead = {} } = {}) => KINDS.filter(k => byKind[k]?.length).map(k => `<section class="section kind-list kind-${k}" id="list-${k}" data-group data-jump-to="${KIND_NAME[k]}">
  <${h} class="kind-h"><span class="kind-dot" aria-hidden="true"></span>${esc(KIND_NAME[k])} <span class="n-wrap">(<span class="n">${byKind[k].length}</span>)</span></${h}>
  ${lead[k] ? `<p>${lead[k]}</p>` : ''}
  <div class="schools">
${byKind[k].map(x => listRow(k, x, depth)).join('\n')}
  </div>
</section>`).join('\n');
const shapedAll = byKind => KINDS.flatMap(k => (byKind[k] || []).map(x => shapeFor(k, x)));
// A list in sections by kind of program: each listing under the first of its types, A to Z inside, in the order
// of the TYPES list. The hero gets a pill per section ("Here: Aftercare (10) · Music (2) …") and the page a strip
// that jumps between them. `shape` is what the filter bar reads for a row, when it isn't the listing itself.
const typeSections = (kind, list, depth, shape = null) => {
  const byType = TYPES.map(t => [t, list.filter(x => x.types[0] === t.id)]).filter(([, l]) => l.length);
  return {
    pills: `<p class="runs"><span class="runs-h">${T(`Here`)}</span> ${byType.map(([t, l]) => `<a class="pill kind" style="--kc:${t.color}" href="#type-list-${t.id}">${esc(t.label)} (${l.length})</a>`).join(' ')}</p>`,
    sections: byType.map(([t, l]) => `<section class="section kind-list" id="type-list-${t.id}" data-group data-jump-to="${esc(t.label)}" style="--kc:${t.color}">
  <h2 class="kind-h"><span class="kind-dot" aria-hidden="true"></span>${esc(t.label)} <span class="n-wrap">(<span class="n">${l.length}</span>)</span></h2>
  <div class="schools">
${l.map(x => listRow(kind, x, depth, shape ? shape(x) : null)).join('\n')}
  </div>
</section>`).join('\n'),
  };
};
// The strip that stays under the menu bar on a long page: a page's view switch, its jump links, or both.
const pageNav = (...parts) => `<div class="pagenav">${parts.filter(Boolean).join('\n')}</div>`;
function typesPage() {
  const hero = `    <h1>${T(`Programs by what they do`)}</h1>
    <p class="lede">${T(`Pick the kind of thing you’re after. Each list has the after-school programs, weekend classes, day camps and summer camps in that group, and can be narrowed by kind, grade and neighborhood.`)}</p>`;
  const body = `<section class="section">
  <div class="chips-row big">${typeChips(1)}</div>
  <p>${T(`A program can sit in more than one group: a rec center is also aftercare, and a school’s clubs may include music and chess.`)}</p>
</section>`;
  return layout({ title: 'Programs, classes and camps by type', description: `Browse Philadelphia after-school programs, weekend classes, day camps and summer camps by type: ${listNames(liveTypes().map(t => t.label.toLowerCase()))}.`, pathName: 'types/', depth: 1, current: null, hero, body, showStreet: 'parked',
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: liveTypes().map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.label, url: `${cfg.siteUrl}/types/${t.id}/` })) } });
}
function typePage(t) {
  const D = 2;
  const byKind = Object.fromEntries(KINDS.map(k => [k, ofKind(k).filter(p => p.types.includes(t.id))]));
  const list = byKind.after;
  const n = typeCount(t), kindsHere = KINDS.filter(k => byKind[k].length);
  // One line per school that runs clubs of this kind for its own students.
  const schoolClubs = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).flatMap(s => forSchool(s).filter(p => p.clubs && p.schools[s.id].relation === 'onsite').map(p => ({ s, p, clubs: clubsOfType(p, t.id) })).filter(x => x.clubs.length));
  const hero = `    <p class="where"><a href="${link('types/', D)}">${T(`All types`)}</a></p>
    <h1>${esc(t.label)}</h1>
    <p class="lede">${T(`Everything on this site in this group, whatever part of the year it fills. Pick a kind, a grade or a neighborhood to narrow it down.`)}</p>
    <p class="runs"><span class="runs-h">${T(`Here`)}</span> ${kindsHere.map(k => `<a class="pill kind kind-${k}" href="#list-${k}">${esc(KIND_NAME[k])} (${byKind[k].length})</a>`).join(' ')}</p>`;
  const body = `${pageNav(jumpNav())}
${filterBar({ list: shapedAll(byKind), depth: D, show: { type: false, age: true } }).replace('data-filters', 'data-filters data-noun="listing" data-nouns="listings"')}
${noMatch(D)}
${kindSections(byKind, D)}
${schoolClubs.length ? `<section class="section school-clubs" data-school-clubs>
  <h2>${T(`{type} clubs at the school itself`, { type: t.label })}</h2>
  <p class="hint">${T(`Run by a school for its own students, so they aren’t in the lists above.`)}</p>
  <ul class="sc-list">
${schoolClubs.map(({ s, p, clubs }) => `    <li data-school="${esc(s.id)}"><b><a href="${link(s.id + '/', D)}">${esc(s.shortName)}</a>:</b> ${esc(clubs.map(clubBrief).join(', '))}. <a href="${link(programPath(p), D)}">${T(`All {school} clubs`, { school: s.shortName })}</a></li>`).join('\n')}
  </ul>
  <p class="sc-more needs-js-block" hidden><button type="button" class="clear">See clubs at other schools</button></p>
  <p class="hint">${T(`Don’t see your school?`)} <a href="${link('schools/', D)}">${T(`Find your school.`)}</a></p>
</section>` : `<section class="section">
  <p>${T(`Clubs a school runs for its own students aren’t in this list. They’re on that school’s page.`)} <a href="${link('schools/', D)}">${T(`Find your school.`)}</a></p>
</section>`}
<section class="section">
  <h2>${T(`Other kinds of program`)}</h2>
  <div class="chips-row">${typeChips(D, t.id)}</div>
</section>`;
  const url = `${cfg.siteUrl}/types/${t.id}/`;
  const said = kindsHere.map(k => ({ after: plural(byKind.after.length, 'after-school program', 'after-school programs'), weekend: plural(byKind.weekend.length, 'weekend class', 'weekend classes'), off: plural(byKind.off.length, 'day-camp program', 'day-camp programs'), summer: plural(byKind.summer.length, 'summer camp', 'summer camps') })[k]);
  return layout({
    title: `${t.label} for kids in Philadelphia: after school, weekends, camps`,
    description: `${t.label} in Philadelphia: ${listNames(said)}. Who picks up from which school, grades, hours, cost and dates.`,
    pathName: `types/${t.id}/`, depth: D, current: null, hero, body,
    jsonLd: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'ItemList', name: `${t.label} programs, classes and camps`, itemListElement: [...list.map(p => [fullName(p), programPath(p)]), ...byKind.weekend.filter(p => !list.includes(p)).map(p => [fullName(p), programPath(p)]), ...byKind.off.filter(p => !list.includes(p) && !byKind.weekend.includes(p)).map(p => [fullName(p), programPath(p)]), ...byKind.summer.filter(c => !c.program).map(c => [c.name, campPath(c)])].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, url: `${cfg.siteUrl}/${path}` })) },
      { '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Program types', cfg.siteUrl + '/types/'], [t.label, url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
    ] },
  });
}

// ---------- by day of the week: the after-school programs and the weekend classes, Monday to Sunday ----------
const byDayPath = 'by-day/';
function byDayPage() {
  const D = 1;
  const byKind = { after: ofKind('after'), weekend: ofKind('weekend') };
  const onDay = d => d === 'sat' || d === 'sun' ? byKind.weekend.filter(p => p.weekend.days.includes(d)).length : byKind.after.filter(p => !p.days || p.days.includes(d)).length;
  const hero = `    <h1>${T(`What runs on which day`)}</h1>
    <p class="lede">${T(`Weekday after-school programs and Saturday and Sunday classes, together. Pick a day to see what runs then, and a grade to see what your child can join.`)}</p>
    <p class="runs"><span class="runs-h">${T(`Here`)}</span> <a class="pill kind kind-after" href="#list-after">${esc(KIND_NAME.after)} (${byKind.after.length})</a> <a class="pill kind kind-weekend" href="#list-weekend">${esc(KIND_NAME.weekend)} (${byKind.weekend.length})</a></p>
    <div class="facts">
      ${[...WEEK, 'sat', 'sun'].map(d => `<span><a href="?day=${d}">${DAY_NAME[d].slice(0, 3)}</a> <b>${onDay(d)}</b></span>`).join('\n      ')}
    </div>`;
  const body = `${pageNav(jumpNav())}
${filterBar({ list: shapedAll(byKind), depth: D, show: { day: true, age: true } }).replace('data-filters', 'data-filters data-noun="listing" data-nouns="listings"')}
${noMatch(D)}
${kindSections(byKind, D, { lead: { after: T(`A program that doesn’t publish its days shows under every weekday.`), weekend: T(`Weekend classes go by where they are. Any child can sign up, whichever school they go to.`) } })}
<section class="section">
  <p>${T(`Day camps run on dates, not weekdays, and summer camps by the week:`)} <a href="${link(dayCampsPath, D)}">${T(`day-camp programs`)}</a> · <a href="${link(campsPath, D)}">${T(`summer camps`)}</a>.</p>
</section>`;
  return layout({
    title: 'Programs by day of the week, Monday to Sunday',
    description: `After-school programs and weekend classes for kids in Philadelphia by day of the week: what runs on each weekday, Saturday and Sunday, with grades, cost and how to register.`,
    pathName: byDayPath, depth: D, current: null, hero, body,
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: [...byKind.after, ...byKind.weekend.filter(p => !byKind.after.includes(p))].map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: fullName(p), url: `${cfg.siteUrl}/${programPath(p)}` })) },
  });
}

// ---------- pages ----------
const forSchool = s => programs.filter(p => p.schools[s.id]);
const tally = s => Object.fromEntries(Object.keys(REL).map(k => [k, forSchool(s).filter(p => p.schools[s.id].relation === k).length]));
const clock = s => s.dismissal ? s.dismissal.replace(/\s*[ap]m$/i, '') : '';   // a school that doesn't post its dismissal time has none here
const gradeSpan = s => { const g = expandGrades(s.grades); const nm = x => x === 'PK' ? 'Pre-K' : x === 'K' ? 'K' : x; return `${nm(g[0])} to ${nm(g[g.length - 1])}`; };

// ---------- the school finder: every district and charter school in the city ----------
// Schools with a page here are marked as covered. The rest lead to a page where a family can ask for theirs.
const streetKey = a => String(a).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const milesBetween = (a, b) => {
  const rad = x => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
};
const finderData = (() => {
  const byStreet = new Map(schools.map(s => [streetKey(s.address.split(',')[0]), s]));
  const placed = schools.map(s => ({ s, at: cityList.schools.find(x => streetKey(x.address) === streetKey(s.address.split(',')[0])) })).filter(x => x.at);
  const rows = cityList.schools.map(x => {
    const mine = byStreet.get(streetKey(x.address));
    const near = mine || !placed.length ? null : placed.map(c => [c.s.id, milesBetween(x, c.at)]).sort((a, b) => a[1] - b[1])[0];
    // [id, name, address, grades, kind, covered school id, programs listed, nearest covered school id, miles to it]
    return [x.id, mine ? mine.name : x.name, `${x.address}, ${x.zip}`, mine ? mine.grades : x.grades, x.kind, mine ? mine.id : '', mine ? forSchool(mine).length : 0, near ? near[0] : '', near ? Math.round(near[1] * 10) / 10 : 0];
  });
  for (const s of schools) if (!rows.some(r => r[5] === s.id)) rows.push([s.id, s.name, s.address.split(',').slice(0, 1).join(''), s.grades, '', s.id, forSchool(s).length, '', 0]);   // a covered school the city list doesn't have
  // programs are [id, name, type, which schools]: the home page search finds these too
  const progRows = [...programs].sort((a, b) => fullName(a).localeCompare(fullName(b))).map(p => [p.id, fullName(p), TYPE[p.types[0]].label, servedSummary(p)]);
  return { schools: rows, covered: Object.fromEntries(schools.map(s => [s.id, s.shortName])), programs: progRows };
})();
const finderBox = (depth, label, withPrograms = false) => `<div class="find" data-finder${withPrograms ? ' data-programs' : ''}${PREVIEW ? '' : ' data-school-pages'} data-root="${link('', depth) === './' ? '' : link('', depth).replace(/index\.html$/, '')}" data-index="${PREVIEW ? 'index.html' : ''}"${PREVIEW ? '' : ` data-src="${link('data/school-finder.json', depth)}"`}>
      <label for="find-school">${T(label || `Find your school`)}</label>
      <input id="find-school" type="search" role="combobox" aria-expanded="false" aria-controls="finder-list" aria-autocomplete="list" placeholder="${withPrograms ? 'Start typing a school or program name' : 'Start typing a school name'}" autocomplete="off">
      <ul id="finder-list" class="finder-list" role="listbox" aria-label="${withPrograms ? 'Schools and programs' : 'Schools'}" hidden></ul>
      <p class="hint">${T(`Every district and charter school in the city is in here. If yours isn’t covered yet, you can ask for it.`)} <noscript><a href="${link('schools/', depth)}">See the schools covered so far.</a></noscript></p>
      ${PREVIEW ? `<script type="application/json" id="finder-data">${JSON.stringify(finderData).replace(/</g, '\\u003c')}</script>` : ''}
    </div>`;

function schoolsPage() {
  const rows = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => schoolRow(s, 1)).join('\n');
  const hero = `    <h1>${T(`Find your school`)}</h1>
    <p class="lede">${T(`Pick your child’s school to see every program that runs in the building, picks up at dismissal or is close enough to walk to.`)}</p>
    ${finderBox(1)}`;
  const body = `<section class="section" id="covered">
  <h2>${T(`Covered so far`)}</h2>
  <div class="schools">
${rows}
  </div>
  <p>${T(`Schools are added one at a time, because every pickup list has to be checked. The ones parents ask for most go first.`)}</p>
</section>${SCHOOL_PAGES && uncovered.length ? `
<section class="section" id="not-yet">
  <h2>${T(`Not covered yet`)}</h2>
  <p>${T(`Each of these has a page showing what’s close to it, where you can ask for it and be told when it’s added.`)}</p>
  <ul class="plain cols">${uncovered.map(x => `<li><a href="${link(uncoveredPath(x), 1)}">${esc(x.name)}</a></li>`).join('')}</ul>
</section>` : ''}`;
  return layout({ title: 'Schools', description: `Find after-school programs by school in Philadelphia. ${listNames(schools.map(s => s.shortName))} are covered so far; ask for yours.`, pathName: 'schools/', depth: 1, current: 'schools/', hero, body, showStreet: 'parked',
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Schools', itemListElement: [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: `${cfg.siteUrl}/${x.id}/` })) } });
}

// ---------- a page for each school that isn't covered yet ----------
// Every district and charter school gets an address of its own (/schools/<id>/): what we list close to it, measured in a
// straight line, and the way to ask for it and to be told when it is added. Nothing on it claims a program picks up
// from the school, because nobody has checked. A page with fewer than three things nearby is kept out of search
// engines, so they aren't handed a row of near-empty pages. The preview copy keeps the single shared page instead.
const SCHOOL_PAGES = !PREVIEW;
// A covered school's row in the city list: its "not covered yet" page is no longer made, so that address is sent on.
const movedSchools = finderData.schools.filter(r => r[5] && r[0] !== r[5]).map(r => [r[0], r[5]]);
const uncovered = cityList.schools.filter(x => { const r = finderData.schools.find(y => y[0] === x.id); return r && !r[5]; }).sort((a, b) => a.name.localeCompare(b.name));
const uncoveredPath = x => `schools/${x.id}/`;
const nearTo = (at, list, placesFn, max) => list.map(p => [p, placesFn(p).length ? Math.min(...placesFn(p).map(b => milesApart(at, b))) : Infinity]).filter(x => x[1] <= max).sort((a, b) => a[1] - b[1]);
const milesPill = m => `<span class="pill mi-pill">${m < 0.1 ? 'Under 0.1 mi' : (Math.round(m * 10) / 10).toFixed(1) + ' mi'}</span>`;
const nearbyFor = x => {
  const at = [x.lat, x.lng];
  return {
    after: nearTo(at, programs.filter(p => Object.keys(p.schools || {}).length && !schoolRun(p)), p => placesOf(p), 1),
    weekend: nearTo(at, weekendPrograms, p => placesOf(p), 2).slice(0, 8),
    camps: nearTo(at, summerCamps, c => coordsOf(c.address), 2).slice(0, 8),
  };
};
// "Ask for this school", for a school with no page yet. Asking uses a free account (one ask per family, and the
// school's page is announced to them by email), so the panel carries the accounts attributes and the sign-in is drawn
// in place by src/groups.js when someone signed out presses the button. x is the school, or null on the shared page,
// where the script fills the name in.
function askPanel(D, x) {
  const name = x ? esc(x.name) : '';
  return `<div class="panel" id="req-panel" ${groupsAttrs(D)} data-accounts="${link('assets/groups.js', D)}${GROUPS_V}"${PREVIEW ? ' data-preview="1"' : ''} data-clarity-mask="true"${x ? '' : ' hidden'}>
    <h2 id="req-heading">${x ? T(`Want {school} added?`, { school: x.name }) : T(`Want this school added?`)}</h2>
    <p>${T(`Each school takes real checking, so the ones families ask for most go first. Asking uses a free account: each family counts once, and you get one email when the school has its page.`)}</p>
    <div class="actions needs-js-block"><button type="button" class="btn primary big" id="req-btn">${x ? `Ask for ${name}` : 'Ask for this school'}</button></div>
    <div class="follow-signin" id="req-signin" hidden></div>
    <p class="hint" id="req-status" aria-live="polite"></p>
    <p class="hint">${T(`No password: we email you a 6-digit code. Making an account adds you to our email list, for occasional news about the site; every email has an unsubscribe link.`)} <a href="${link('privacy/', D)}#email">${T(`How we handle your email.`)}</a></p>
    <noscript><p class="hint">${T(`Asking needs JavaScript.`)}</p></noscript>
    <p>${T(`Know which programs pick up from this school?`)} <a href="${link('suggest/', D)}?kind=school${x ? `&amp;newschool=${encodeURIComponent(x.name)}` : ''}">${T(`Tell us, and it gets covered faster.`)}</a></p>
  </div>`;
}
function uncoveredSchoolPage(x) {
  const D = 2, row = finderData.schools.find(y => y[0] === x.id), near = nearbyFor(x);
  const total = near.after.length + near.weekend.length + near.camps.length;
  const closest = row[7] && finderData.covered[row[7]] ? { id: row[7], name: finderData.covered[row[7]], miles: row[8] } : null;
  const kind = x.kind ? `${x.kind} school` : 'School';
  const hero = `    <p class="where"><a href="${link('schools/', D)}">${T(`All schools`)}</a></p>
    <h1>${T(`After school near {school}`, { school: x.name })}</h1>
    <p class="lede">${esc(`${x.address}, Philadelphia, PA ${x.zip}`)}${x.grades ? ` · grades ${esc(x.grades)}` : ''} · ${esc(kind)}. ${T(`We haven’t checked which programs pick up from this school yet. Here is what’s close, and how to ask for it to be covered.`)}</p>
    <div class="facts">
      <span><b>${near.after.length}</b> after-school ${near.after.length === 1 ? 'program' : 'programs'} within a mile</span>
      ${near.weekend.length + near.camps.length ? `<span><b>${near.weekend.length + near.camps.length}</b> weekend classes and camps within two</span>` : ''}
      ${closest ? `<span>Closest covered school: <a href="${link(closest.id + '/', D)}">${esc(closest.name)}</a>, ${closest.miles} ${closest.miles === 1 ? 'mile' : 'miles'}</span>` : ''}
    </div>`;
  const body = `<div data-request-page data-slug="${esc(x.id)}" data-root="${link('', D).replace(/index\.html$/, '')}" data-index="" data-src="${link('data/school-finder.json', D)}" style="display:contents">
  <section class="section">
  ${askPanel(D, x)}
  </section>
  <section class="section">
    <h2>${T(`After-school programs within a mile`)}</h2>
    ${near.after.length ? `<p>${T(`These are close to {school}, in a straight line. We don’t know yet whether any of them pick up from it, so ask the program.`, { school: x.name })}</p>
    <div class="schools">
${near.after.map(([p, m]) => `<a class="prow" href="${link(programPath(p), D)}"><h3>${esc(p.name)}</h3><span class="what">${esc(p.what)}</span><span class="tally">${typeTags(p)}</span><span class="tally">${milesPill(m)}<span class="hint">${esc(servedSummary(p))} · grades ${esc(gradeText(p))}</span></span></a>`).join('\n')}
    </div>` : `<p class="ask">${T(`Nothing we list is within a mile of {school} yet.`, { school: x.name })} <a href="${link('suggest/', D)}">${T(`Tell us about a program near it.`)}</a></p>`}
  </section>
  ${near.weekend.length ? `<section class="section">
    <h2>${T(`Weekend classes within two miles`)}</h2>
    <p>${T(`Saturday and Sunday classes take children from any school.`)}</p>
    <div class="schools">
${near.weekend.map(([p, m]) => `<a class="prow" href="${link(weekendPath, D)}#${esc(p.id)}"><h3>${esc(p.name)}</h3><span class="what">${esc(p.weekend.summary)}</span><span class="tally">${milesPill(m)}${p.weekend.days.map(d => `<span class="pill nearby">${WEEKEND_DAY[d]}</span>`).join('')}${programHoods(p).map(n => `<span class="pill hood">${esc(n)}</span>`).join('')}</span></a>`).join('\n')}
    </div>
    <p><a class="btn" href="${link(weekendPath, D)}">${T(`All weekend classes`)}</a></p>
  </section>` : ''}
  ${near.camps.length ? `<section class="section">
    <h2>${T(`Summer camps within two miles`)}</h2>
    <div class="schools">
${near.camps.map(([c, m]) => `<a class="prow" href="${campLink(c, D)}"><h3>${esc(c.name)}</h3><span class="what">${esc(c.what)}</span><span class="tally">${milesPill(m)}<span class="hint">${[campAges(c), campPrice(c)].filter(Boolean).map(esc).join(' · ')}</span></span></a>`).join('\n')}
    </div>
    <p><a class="btn" href="${link(campsPath, D)}">${T(`All summer camps`)}</a></p>
  </section>` : ''}
  <section class="section">
    <h2>${T(`In the meantime`)}</h2>
    <p>${closest && closest.miles <= 2 ? T(`The closest school with a page is {name}, about {miles} away. Programs that serve it may reach {school} too, but ask each one.`, { name: closest.name, miles: closest.miles === 1 ? '1 mile' : closest.miles + ' miles', school: x.name }) : T(`No school with a page is close by yet. You can still browse by neighborhood or look through every program.`)}</p>
    <div class="actions">${closest && closest.miles <= 2 ? `<a class="btn" href="${link(closest.id + '/', D)}">See ${esc(closest.name)}</a>` : ''}<a class="btn" href="${link('neighborhoods/', D)}">${T(`Browse by neighborhood`)}</a><a class="btn" href="${link('all-programs/', D)}">${T(`All programs`)}</a></div>
  </section>
  <section class="section" id="req-search">
    <h2>${T(`Look up another school`)}</h2>
    ${finderBox(D, `School name`)}
  </section>
</div>`;
  const url = `${cfg.siteUrl}/${uncoveredPath(x)}`;
  return layout({
    title: `After-school programs near ${x.name}`,
    description: `What’s near ${x.name} in Philadelphia: ${plural(near.after.length, 'after-school program', 'after-school programs')} within a mile, plus weekend classes and summer camps close by. Ask for the school to be covered.`,
    pathName: uncoveredPath(x), depth: D, current: null, hero, body, noindex: total < 3,
    jsonLd: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Schools', cfg.siteUrl + '/schools/'], [x.name, url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
  });
}
const uncoveredIndexed = () => uncovered.filter(x => { const n = nearbyFor(x); return n.after.length + n.weekend.length + n.camps.length >= 3; });

// The page for a school that isn't covered yet. One page serves them all: the script fills in the school from ?s=.
function schoolRequestPage() {
  const D = 2;
  const hero = `    <p class="where"><a href="${link('schools/', D)}">${T(`All schools`)}</a></p>
    <h1 id="req-title">${T(`This school isn’t covered yet`)}</h1>
    <p class="lede" id="req-meta">${T(`Search for your school to see whether it has a page.`)}</p>`;
  const body = `<div class="prose" data-request-page data-root="${link('', D).replace(/index\.html$/, '')}" data-index="${PREVIEW ? 'index.html' : ''}"${PREVIEW ? '' : ` data-src="${link('data/school-finder.json', D)}"`}>
  ${askPanel(D, null)}
  <div class="panel" id="req-near" hidden>
    <h2>${T(`In the meantime`)}</h2>
    <p id="req-near-text"></p>
    <div class="actions"><a class="btn" id="req-near-link" href="${link('schools/', D)}">See that school</a><a class="btn" href="${link('neighborhoods/', D)}">${T(`Browse by neighborhood`)}</a><a class="btn" href="${link('all-programs/', D)}">${T(`All programs`)}</a></div>
  </div>
  <p id="req-tell-wrap" hidden>${T(`Know which programs pick up from this school?`)} <a id="req-tell" href="${link('suggest/', D)}">${T(`Tell us, and it gets covered faster.`)}</a></p>
  <div id="req-search">
    <h2>${T(`Look up a school`)}</h2>
    ${finderBox(D, `School name`)}
  </div>
  <noscript><p class="ask">${T(`This page needs JavaScript. You can also ask for a school with the suggestion form.`)}</p></noscript>
</div>`;
  return layout({ title: 'Ask for a school', description: 'Ask for your school to be added.', pathName: 'schools/request/', depth: D, current: null, hero, body, noindex: true });
}

// The old "ask for this school" address. Asking now goes through the accounts service (school_ask), so each family
// counts once; a page cached from before gets a plain answer here.
function schoolRequestPhp() {
  return `<?php
// Generated by build.mjs; edit it there. Asking for a school moved to groups/api.php?action=school_ask.
header('Cache-Control: no-store');
http_response_code(410);
header('Content-Type: application/json; charset=utf-8');
echo json_encode(array('ok' => false, 'message' => 'Asking for a school now uses a free account. Reload the school’s page and press the button again.'));
`;
}

// "This week at {school}" on the school's page: this week and next, the things that happen every week, a pointer to
// the Sunday email (turned on in the account), and a way to send in a date that's missing.
function schoolWeekSection(s) {
  const sd = schoolDatesFile.schools?.[s.id] || {};
  const weeks = [schoolWeek(s, thisMonday()), schoolWeek(s, isoAdd(thisMonday(), 7))];
  const tag = l => l.by === 'parent' ? ` <span class="wk-by">${T(`from a parent`)}</span>` : l.by === 'school' ? ` <span class="wk-by">${T(`school calendar`)}</span>` : '';
  const show = (w, title) => {
    const days = [...new Set(w.lines.map(l => l.d))];
    return `<div class="wk-card">
      <h3>${title} <span class="hint">${esc(weekLabel(w.monday).replace(/^Week of /, ''))}</span></h3>
      ${days.length ? `<dl>${days.map(d => `<dt>${esc(dayDate(d))}</dt><dd>${w.lines.filter(l => l.d === d).map(l => `<span class="wk-${l.kind}">${l.href ? `<a href="${link(l.href, 1)}">${esc(l.what)}</a>` : esc(l.what)}${l.note ? ` <span class="hint">${esc(l.note)}</span>` : ''}${tag(l)}</span>`).join('')}</dd>`).join('')}</dl>` : `<p class="hint">${T(`Nothing out of the ordinary that we know of.`)}</p>`}
    </div>`;
  };
  return `<section class="section this-week" id="this-week">
    <h2>${T(`This week at {school}`, { school: s.shortName })}</h2>
    <p>${T(`Days off and sign-ups at the programs that serve it, a week at a time. A school’s own dates show here only when a parent sends one in, so go by what the school sends home.`)}</p>
    <div class="wk-cards">
      ${show(weeks[0], weekday(TODAY) === 6 || weekday(TODAY) === 0 ? T(`This coming week`) : T(`This week`))}
      ${show(weeks[1], T(`The week after`))}
    </div>
    ${GROUPS && ALERTS ? `<p class="wk-mail"><b>${T(`Want this on Sunday mornings?`)}</b> ${T(`It’s an email you turn on in your account, and it only comes in weeks with something out of the ordinary.`)} <a href="${link('account/', 1)}#emails">${T(`Turn it on`)}</a></p>` : ''}
    ${cfg.contactEmail ? `<details class="wk-add">
      <summary>${T(`Know a date that’s missing?`)}</summary>
      <form class="wk-form" method="post" action="${link('suggest/send.php', 1)}" data-clarity-mask="true">
        <input type="hidden" name="kind" value="A date at a school">
        <input type="hidden" name="school" value="${esc(s.shortName)}">
        <div class="field"><label for="wk-what-${esc(s.id)}">${T(`What is it?`)}</label><input id="wk-what-${esc(s.id)}" name="program" type="text" maxlength="80" required placeholder="Picture day" autocomplete="off"></div>
        <div class="field"><label for="wk-when-${esc(s.id)}">${T(`When?`)}</label><input id="wk-when-${esc(s.id)}" name="when" type="text" maxlength="120" required placeholder="Oct 14, or every Wednesday" autocomplete="off"></div>
        <div class="field wide"><label for="wk-details-${esc(s.id)}">${T(`Anything else? (optional)`)}</label><input id="wk-details-${esc(s.id)}" name="details" type="text" maxlength="300" placeholder="Which grades, what to bring" autocomplete="off"></div>
        <div class="field wide"><label for="wk-email-${esc(s.id)}">${T(`Your email (optional)`)}</label><input id="wk-email-${esc(s.id)}" name="email" type="email" maxlength="150" autocomplete="email"><span class="hint">${T(`Only used to ask you a question about it. Please leave out children’s names.`)}</span></div>
        <div class="hp" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden"><label>Leave this blank <input name="company" type="text" tabindex="-1" autocomplete="off"></label></div>
        <div class="wide"><button class="btn" type="submit">${T(`Send it`)}</button> <span class="hint">${T(`We read each one before it goes on the page.`)}</span></div>
      </form>
    </details>` : ''}
  </section>`;
}

function schoolPage(s) {
  const list = forSchool(s);
  const t = tally(s);
  const groups = Object.entries(REL).filter(([k]) => t[k]).map(([k, v]) => `<section class="group" data-group>
  <h2>${T(v.title, { s: s.shortName })} (<span class="n">${t[k]}</span>)</h2>
  <p>${T(v.blurb)}</p>
  <div class="list">
${list.filter(p => p.schools[s.id].relation === k).map(p => card(p, s)).join('\n')}
  </div>
</section>`).join('\n');
  const hero = `    <p class="where">After-school programs and aftercare for ${esc(s.name)}, ${esc(s.address.split(',')[0])}</p>
    <h1>${s.dismissal ? T(`It’s {time} at {school}. What now?`, { time: clock(s), school: s.shortName }) : T(`School’s out at {school}. What now?`, { school: s.shortName })}</h1>
    <p class="lede">${T(`Every after-school program we could find that runs at the school, picks children up from it, or sits within a short walk. Pick a grade to see what your child can join.`)}</p>
    <div class="mine needs-js-block" data-mine>
      <span class="mine-ic" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1z"/></svg></span>
      <div class="mine-say">
        <p class="mine-h" data-mine-h data-on="${esc(T(`{school} is your school`, { school: s.shortName }).replace(/<[^>]+>/g, ''))}">${T(`Make this your school`)}</p>
        <p class="hint">${T(`One tap. The home page, every list and your week then start here.`)}</p>
      </div>
      <button type="button" class="savebtn" data-my-school="${esc(s.id)}" data-name="${esc(s.shortName)}" aria-pressed="false">Save as my school</button>
      <p class="hint mine-note" data-my-school-note aria-live="polite"></p>
    </div>
    <div class="facts">
      ${!s.dismissal || s.dismissalNote ? `<span>Dismissal <b>${esc(s.dismissal || 'not posted by the school')}</b>${s.dismissalNote ? ` (${esc(s.dismissalNote)})` : ''}</span>` : ''}
      <span>School office <b><a href="${telHref(s.phone)}">${esc(s.phone)}</a></b></span>
      ${schoolHoods(s).length ? `<span>Neighborhood <b>${hoodLinks(schoolHoods(s), 1)}</b></span>` : ''}
      <span>Reviewed <b>${longDate(s.lastReviewed)}</b></span>
    </div>`;
  const wk0 = schoolWeek(s, thisMonday());
  const body = `<div data-school-page="${esc(s.id)}" style="display:contents">
  ${nextOff(1, list)}
  <p class="nextoff wk-jump"><a href="#this-week">${T(`This week at {school}`, { school: s.shortName })}</a>${wk0.lines.length ? ` <span class="hint">${esc(wk0.lines.length === 1 ? '1 thing on' : wk0.lines.length + ' things on')}</span>` : ''}</p>
  ${filterBar({ list, depth: 1, school: s, show: { hood: false }, near: true })}
  <div class="legend">
    <span><i class="cell on">3</i> grade served</span>
    <span><i class="cell">7</i> not served</span>
    <span><i class="cell unk">?</i> grades not published, so the program shows under every grade</span>
    <span>${T(`The number under each grade counts programs at the school or with pickup.`)}</span>
  </div>
  ${noMatch(1)}
  <div class="groups">
${groups}
  </div>
  <p class="ask roll-ask needs-js-block"><span>${T(`Can’t decide? Let a theme pick for you.`)}</span> <a class="btn" href="${link('board/', 1)}?roll=${esc(s.id)}">${T(`Roll a themed week for {school}`, { school: s.shortName })}</a></p>
  <p class="ask">${T(`Know a program that serves {school} and isn’t here?`, { school: s.shortName })} <a href="${link('suggest/', 1)}">${T(`Add it to the list.`)}</a></p>
  ${schoolWeekSection(s)}
  ${datesBox(1, { key: 's:' + s.id, name: s.shortName, place: 'school', cls: 'wide', title: T(`Get {school} dates by email`, { school: s.shortName }), lede: T(`Sign-up openings and deadlines for these programs, and a heads-up before each day off.`), hint: T(`Sign-up dates reach you the morning after they’re posted here, then again the day before and at about 8 that morning. Days off come in a {day} round-up.`, { day: SEND_DAY_NAME }), old: { school: s, place: 'school', title: T(`Get {school} dates by email`, { school: s.shortName }), lede: T(`Sign-up openings and deadlines for these programs, and a heads-up before each day off.`) } })}
  ${s.checkedNoPickup?.length ? `<section class="notes">
    <h2>${T(`Checked, and not listing {school} pickup`, { school: s.shortName })}</h2>
    <ul>${s.checkedNoPickup.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  </section>` : ''}
  ${s.alsoListed?.items?.length ? `<section class="notes">
    <h2>${esc(s.alsoListed.title)}</h2>
    <p>${esc(s.alsoListed.intro)}</p>
    <ul>${s.alsoListed.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  </section>` : ''}
  <section class="notes">
    <h2>${T(`Before you enroll`)}</h2>
    <ul>
      <li>${T(`Pickup lists change every year, and most providers need a minimum number of children from a school. Ask each one to confirm {school} pickup for the days you need.`, { school: s.shortName })}</li>
      <li>${T(`Ask what happens on early-dismissal days and district days off.`)}</li>
      <li>${T(`City rec centers post each year’s after-school listing late, so call before counting on a price or a spot. Their listings live in the`)} <a href="https://www.phila.gov/parks-rec-finder/#/locations" target="_blank" rel="noopener">${T(`Parks & Rec finder`)}</a>.</li>
      <li>${T(`Free, city-funded programs are in the city’s`)} <a href="https://www.phila.gov/ost/program-locator/#/" target="_blank" rel="noopener">${T(`After School and Summer Program Locator`)}</a>.</li>
      ${(s.notes || []).map(x => `<li>${esc(x)}</li>`).join('\n      ')}
    </ul>
  </section>
</div>`;
  return layout({
    title: `${s.shortName} after-school programs and aftercare`,
    description: `Aftercare and after-school programs for ${s.name}, Philadelphia: ${list.length} options at the school, with pickup, or nearby. Hours, cost and how to register.`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'ItemList', name: `After-school programs for ${s.name}`, itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: fullName(p), url: `${cfg.siteUrl}/${programPath(p)}` })) },
      { '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], [s.name, `${cfg.siteUrl}/${s.id}/`]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
    ] },
    pathName: s.id + '/', depth: 1, current: null, hero, body,
  });
}

function homePage() {
  const LEDE = `Find the after-school programs that work with your child’s school: what runs in the building, who picks up at dismissal, and what’s close enough to walk to.`;
  const hero = `    <h1>${T(`School’s out. Now what?`)}</h1>
    <p class="lede">${T(LEDE)}</p>
    ${finderBox(0, `Find your school or a program`, true)}`;
  const ICON = {
    school: 'M12 2 2 8v2h20V8zM4.5 11.5v6h3v-6zm6 0v6h3v-6zm6 0v6h3v-6zM2 19v3h20v-3z',
    week: 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9.5h14V19H5zm2 2.5v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2z',
    person: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z',
    claim: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.4 14.2-4-4 1.6-1.6 2.4 2.4 5.2-5.2 1.6 1.6z',
    plus: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z',
    tent: 'M12 3 1.5 20h21zm0 7 2.6 8H9.4z',
  };
  // Who each box is for: a grown-up with a child, and someone holding a clipboard.
  const WHO = {
    parent: '<circle cx="18" cy="13" r="7"/><path d="M5 42v-8a13 13 0 0 1 26 0v8z"/><g class="cut"><circle cx="35" cy="25" r="5.5"/><path d="M25.5 42v-3.500a9.500 9.500 0 0 1 19 0V42z"/></g>',
    manager: '<circle cx="17" cy="13" r="7"/><path d="M4 42v-8a13 13 0 0 1 26 0v8z"/><g class="cut"><rect x="26" y="20" width="18" height="22" rx="3"/><rect x="31.500" y="17" width="7" height="5.500" rx="1.500"/></g><path class="mark" d="m30.500 31.500 3.200 3.200 6-7"/>',
  };
  const who = k => `<span class="start-who" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false">${WHO[k]}</svg></span>`;
  const go = (href, label, hint, icon) => `<a class="start-go" href="${href}"><span class="start-ic" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="${ICON[icon]}"/></svg></span><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span></a>`;
  const more = [
    weekendPrograms.length ? [link(weekendPath, 0), T(`Weekend classes`), T(`Saturday and Sunday classes at {n} places: music, dance, art, skating, science.`, { n: weekendPrograms.length }), '#6B3FA0'] : null,
    daysOff ? [link(dayCampsPath, 0), T(`Day camps`), T(`{n} programs run camps on the days school is closed, with a planner for the year.`, { n: campPrograms.length }), '#B88A00'] : null,
    summerCamps.length ? [link(campsPath, 0), T(`Summer camps`), T(`{n} day camps in the city, with ages, hours and prices, and a schedule to plan the summer week by week.`, { n: summerCamps.length }), '#2C8444'] : null,
  ].filter(Boolean);
  const body = `${nextOffBar(0)}
<section class="section" id="start">
  <div class="starts">
    <div class="start">
      <div class="start-head">${who('parent')}<div><p class="kicker">${T(`Start here`)}</p> <h2>${T(`Parents`)}</h2></div></div>
      <p>${T(`See what works with your child’s school, then put the week together.`)}</p>
      <div class="start-list">
        ${go(link('schools/', 0), T(`Find your school`), T(`Every program that’s there, picks up or is nearby`), 'school')}
        ${go(link(schedulesPath, 0), T(`Build a schedule`), T(`The school week, days off and the summer`), 'week')}
        ${GROUPS ? `<span class="when-out" style="display:contents">${go(link('register/', 0), T(`Create a free account`), T(`Keep every plan, and get the whole year in one calendar`), 'person')}</span>` : ''}
      </div>
    </div>
    <div class="start managers">
      <div class="start-head">${who('manager')}<div><p class="kicker">${T(`Start here`)}</p> <h2>${T(`Program managers`)}</h2></div></div>
      <p>${T(`Run an after-school program, a weekend class or a camp? Make sure parents see it right.`)}</p>
      <div class="start-list">
        ${GROUPS ? go(link('managers/', 0), T(`Claim your listing`), T(`Keep its dates, costs and hours current yourself`), 'claim') : ''}
        ${go(link('suggest/', 0), T(`Add a program or camp`), T(`Not listed yet? Send its name and website`), 'plus')}
      </div>
    </div>
  </div>
</section>
<section class="section" id="browse">
  <h2>${T(`Or start somewhere else`)}</h2>
  <div class="ways">
    <div class="way">
      <h3>${T(`By program type`)}</h3>
      <p>${T(`Music, art, sports, plain old aftercare.`)}</p>
      <div class="chips-row">${typeChips(0)}</div>
    </div>
    <div class="way">
      <h3>${T(`By neighborhood`)}</h3>
      <p>${T(`What’s based near home, and who comes to pick up.`)}</p>
      <div class="chips-row">${hoods.slice(0, 6).map(h => `<a class="btn" href="${link(hoodPath(h), 0)}">${esc(h.name)}</a>`).join('')}<a class="btn quiet" href="${link('neighborhoods/', 0)}">${T(`All neighborhoods`)}</a></div>
    </div>
    <div class="way">
      <h3>${T(`By grade`)}</h3>
      <p>${T(`Everything that takes your child’s grade.`)}</p>
      <div class="grade-links">${GRADES.map(g => `<a class="gbtn" href="${link('programs/', 0)}?grade=${g}" aria-label="${g === 'PK' ? 'Pre-K' : g === 'K' ? 'Kindergarten' : 'Grade ' + g}"><span class="g">${g}</span></a>`).join('')}</div>
    </div>
  </div>
</section>
${more.length ? `<section class="section" id="more">
  <h2>${T(`More than weekday afternoons`)}</h2>
  <p>${T(`After school is where this started. The same listings now cover the rest of a family’s calendar.`)}</p>
  <div class="mores">
    ${more.map(([href, name, text, color]) => `<a class="more-card" href="${href}" style="--tc:${color}"><h3>${name}</h3><p>${text}</p><span class="more-go">${T(`Have a look`)}</span></a>`).join('\n    ')}
  </div>
  <p class="more-all"><a class="btn" href="${link('all-programs/', 0)}">${T(`See every kind of program`)}</a></p>
</section>` : ''}
${datesBox(0, { pick: true, place: 'home', cls: 'wide', title: T(`Get the dates by email`), lede: T(`Sign-up openings, deadlines and days off for your school, so none of them sneaks up on you.`), hint: T(`Sign-up dates reach you the morning after they’re posted here, then again the day before and at about 8 that morning. Days off come in a {day} round-up.`, { day: SEND_DAY_NAME }), old: { place: 'home', title: T(`Get the dates by email`), lede: T(`Sign-up openings, deadlines and days off for your school, so none of them sneaks up on you.`) } })}
<section class="section">
  <h2>${T(`How programs are sorted`)}</h2>
  <div class="kinds">
    <div><span class="pill onsite">${T(`At the school`)}</span><p>${T(`Runs in the school building or on its grounds. No travel.`)}</p></div>
    <div><span class="pill pickup">${T(`Picks up`)}</span><p>${T(`Staff collect children at dismissal and walk or drive them to the program.`)}</p></div>
    <div><span class="pill nearby">${T(`Nearby`)}</span><p>${T(`Close to the school, with no pickup we could find. A fit for older children or a second stop.`)}</p></div>
  </div>
</section>
<section class="section">
  <h2>${T(`Every listing is dated and sourced`)}</h2>
  <p>${T(`Every listing links to where the information came from and shows the day it was last checked. Nobody pays to be listed. If it saved you an evening of open tabs,`)} <a href="${link('support/', 0)}">${T(`help the site keep going.`)}</a></p>
</section>
${cfg.builtBy ? `<section class="section" id="who">
  <h2>${T(`Who built this`)}</h2>
  <p>${T(cfg.builtBy.bio)}</p>
</section>` : ''}`;
  return layout({
    title: cfg.siteName, pathName: '', depth: 0, current: null, hero, body, fragment: PREVIEW, showStreet: 'go', roomy: true,
    shareText: copyNow(LEDE),   // what a texted or posted link says under the picture: the lede, as it reads today
    description: 'After-school programs and aftercare in Philadelphia, school by school: what runs at the school, who picks up at dismissal, hours, cost and how to register.',
    jsonLd: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebSite', '@id': cfg.siteUrl + '/#website', name: cfg.siteName, url: cfg.siteUrl + '/', description: cfg.tagline, publisher: { '@id': cfg.siteUrl + '/#org' } },
      { '@type': 'Organization', '@id': cfg.siteUrl + '/#org', name: cfg.siteName, url: cfg.siteUrl + '/', logo: cfg.siteUrl + '/icon-512.png', ...(cfg.contactEmail ? { email: cfg.contactEmail } : {}), ...(cfg.builtBy ? { founder: { '@type': 'Person', name: cfg.builtBy.name, url: cfg.builtBy.url } } : {}) },
      { '@type': 'ItemList', name: 'Schools', itemListElement: [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: `${cfg.siteUrl}/${x.id}/` })) },
    ] },
  });
}

function neighborhoodsPage() {
  const cards = hoods.map(h => `<a class="prow" href="${link(hoodPath(h), 1)}">
  <h3>${esc(h.name)}</h3>
  <span class="what">${[h.schools.length ? plural(h.schools.length, 'school', 'schools') : '', plural(h.programs.length, 'program', 'programs')].filter(Boolean).join(', ')}</span>
  ${h.schools.length ? `<span class="tally">${h.schools.map(s => `<span class="pill nearby">${esc(s.shortName)}</span>`).join('')}</span>` : ''}
</a>`).join('\n');
  const hero = `    <h1>${T(`By neighborhood`)}</h1>
    <p class="lede">${T(`Start from where you live. Each neighborhood lists the schools there, the after-school programs, weekend classes, day camps and summer camps based there, and the programs that come to pick up.`)}</p>`;
  const body = `<section class="section">
  <div class="hoods">
${cards}
  </div>
  <p>${T(`A program is listed where its building is. Many pick up from schools in other neighborhoods, so your school’s page is still the fullest list.`)} <a href="${link('schools/', 1)}">${T(`Find your school.`)}</a></p>
  <p>${T(`Don’t see your neighborhood?`)} <a href="${link('suggest/', 1)}">${T(`Tell us which school or program to add.`)}</a></p>
</section>
${weekendPrograms.length ? `<section class="section" id="weekends">
  <h2>${T(`Weekend classes, by part of the city`)}</h2>
  <p>${T(`Saturday and Sunday classes aren’t tied to a school, so they’re listed by where they are.`)}</p>
  <p class="chips-row">${weekendByArea().map(([a, l]) => `<a class="btn" href="${link(weekendPath, 1)}?hood=${hoodSlug(a)}">${esc(a)} (${l.length})</a>`).join('')}<a class="btn quiet" href="${link(weekendPath, 1)}">${T(`All weekend classes`)}</a></p>
</section>` : ''}`;
  return layout({
    title: 'Programs, classes and camps by neighborhood',
    description: `After-school programs, weekend classes, camps and schools in ${listNames(hoods.map(h => h.name))}, Philadelphia: what’s based in each neighborhood and who picks up.`,
    pathName: 'neighborhoods/', depth: 1, current: null, hero, body, showStreet: 'parked',
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: hoods.map((h, i) => ({ '@type': 'ListItem', position: i + 1, name: h.name, url: `${cfg.siteUrl}/${hoodPath(h)}` })) },
  });
}

function neighborhoodPage(h) {
  const D = 2;
  const here = new Set(h.programs.map(p => p.id));
  const based = [...h.programs].filter(p => !campOnly(p)).sort((a, b) => a.name.localeCompare(b.name));
  // Programs with a building somewhere else that collect children from a school in this neighborhood.
  const comes = citywide.filter(p => !here.has(p.id) && h.schools.some(s => p.schools[s.id]?.relation === 'pickup')).sort((a, b) => a.name.localeCompare(b.name));
  const others = hoods.filter(x => x.id !== h.id);
  // Weekend classes, day camps and summer camps go by where they are, not by school: the ones in this neighborhood,
  // then (for weekend classes) the rest of this part of the city.
  const wkHere = weekendPrograms.filter(p => programHoods(p).includes(h.name));
  const wkArea = (CAMP_AREAS.find(a => a[1].includes(h.name)) || [null])[0];
  const wkNear = wkArea ? weekendPrograms.filter(p => !wkHere.includes(p) && weekendAreas(p).includes(wkArea)) : [];
  const offHere = campPrograms.filter(p => programHoods(p).includes(h.name));
  const sumHere = [...summerCamps].filter(c => (c.neighborhoods || []).includes(h.name)).sort((a, b) => a.name.localeCompare(b.name));
  const byKind = { after: [...based, ...comes], weekend: [...wkHere, ...wkNear], off: offHere, summer: sumHere };
  const kindsHere = KINDS.filter(k => byKind[k].length);
  const total = based.length + comes.length + wkHere.length + wkNear.length + offHere.length + sumHere.length;
  const hero = `    <p class="where"><a href="${link('neighborhoods/', D)}">${T(`All neighborhoods`)}</a></p>
    <h1>${T(`{name}: after school, weekends and camps`, { name: h.name })}</h1>
    <p class="lede">${T(`The schools in {name}, and everything listed here or coming to pick up: after-school programs, weekend classes, day camps and summer camps.`, { name: h.name })}</p>
    <p class="runs"><span class="runs-h">${T(`Here`)}</span> ${kindsHere.map(k => `<a class="pill kind kind-${k}" href="#list-${k}">${esc(KIND_NAME[k])} (${byKind[k].length})</a>`).join(' ')}</p>
    <div class="facts">
      ${h.schools.length ? `<span><b>${h.schools.length}</b> ${h.schools.length === 1 ? 'school' : 'schools'}</span>` : ''}
      <span><b>${based.length}</b> ${based.length === 1 ? 'program' : 'programs'} based here</span>
      ${comes.length ? `<span><b>${comes.length}</b> more that pick up</span>` : ''}
    </div>`;
  const body = `${pageNav(jumpNav())}
<section class="section" id="schools-here" data-jump-to="Schools">
  <h2>${T(`Schools in {name}`, { name: h.name })}</h2>
  ${h.schools.length ? `<div class="schools">
${h.schools.map(s => schoolRow(s, D)).join('\n')}
  </div>` : `<p class="ask">${T(`No school in {name} is on the site yet.`, { name: h.name })} <a href="${link('schools/request/', D)}">${T(`Ask for yours.`)}</a></p>`}
</section>
${total > 3 ? filterBar({ list: shapedAll(byKind), depth: D, show: { hood: false, q: false, age: true } }).replace('data-filters', 'data-filters data-noun="listing" data-nouns="listings"') : ''}
${noMatch(D)}
${kindSections({ after: based, weekend: wkHere, off: offHere, summer: sumHere }, D, { lead: {
    after: T(`Based in {name}. Each one shows the schools it serves; open it for hours, cost and how to register.`, { name: h.name }),
    weekend: T(`Saturday and Sunday classes go by where they are. Any child can sign up, whichever school they go to.`),
    off: T(`Camps on the days district schools are closed, based in {name}. Children from any school can go.`, { name: h.name }),
    summer: T(`Summer day camps with a site in {name}.`, { name: h.name }),
  } })}
${comes.length ? `<section class="section kind-list kind-after" id="list-comes" data-group data-jump-to="Pick up here">
  <h2 class="kind-h"><span class="kind-dot" aria-hidden="true"></span>${T(`Based elsewhere, but they pick up here`)} <span class="n-wrap">(<span class="n">${comes.length}</span>)</span></h2>
  <p>${T(`These programs are in another neighborhood and collect children from a school in {name}.`, { name: h.name })}</p>
  <div class="schools">
${comes.map(p => listRow('after', p, D)).join('\n')}
  </div>
</section>` : ''}
${wkNear.length ? `<section class="section kind-list kind-weekend" id="list-wknear" data-group data-jump-to="Weekends close by">
  <h2 class="kind-h"><span class="kind-dot" aria-hidden="true"></span>${T(`Weekend classes close by, in {area}`, { area: wkArea })} <span class="n-wrap">(<span class="n">${wkNear.length}</span>)</span></h2>
  <div class="schools">
${wkNear.map(p => listRow('weekend', p, D)).join('\n')}
  </div>
  <p><a class="btn" href="${link(weekendPath, D)}?hood=${hoodSlug(wkArea)}">${T(`All weekend classes in {area}`, { area: wkArea })}</a></p>
</section>` : ''}
<section class="section">
  <h2>${T(`Other neighborhoods`)}</h2>
  <p class="chips-row">${others.map(x => `<a class="btn" href="${link(hoodPath(x), D)}">${esc(x.name)}</a>`).join('')}</p>
</section>`;
  const url = `${cfg.siteUrl}/${hoodPath(h)}`;
  return layout({
    title: `${h.name}, Philadelphia: after-school programs, weekend classes and camps`,
    description: `${plural(based.length, 'after-school program', 'after-school programs')} based in ${h.name}, Philadelphia${comes.length ? `, plus ${comes.length} more that pick up from ${listNames(h.schools.map(s => s.shortName))}` : ''}${wkHere.length ? `, ${plural(wkHere.length, 'weekend class', 'weekend classes')}` : ''}${sumHere.length ? `, ${plural(sumHere.length, 'summer camp', 'summer camps')}` : ''}. Hours, cost, pickup and reviews.`,
    pathName: hoodPath(h), depth: D, current: null, hero, body,
    jsonLd: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'ItemList', name: `Programs in ${h.name}`, itemListElement: [...[...based, ...comes].map(p => [fullName(p), programPath(p)]), ...wkHere.filter(p => !based.includes(p) && !comes.includes(p)).map(p => [fullName(p), programPath(p)]), ...sumHere.filter(c => !c.program).map(c => [c.name, campPath(c)])].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, url: `${cfg.siteUrl}/${path}` })) },
      { '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Neighborhoods', cfg.siteUrl + '/neighborhoods/'], [h.name, url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
    ] },
  });
}

// ---------- terms of use ----------
// A draft until "termsLive": true is set in site.config.json. Until then it is built into the preview copy only, with a
// banner saying so, and nothing on the live site links to it.
const TERMS = cfg.termsLive === true || PREVIEW;
function termsPage() {
  const mail = cfg.contactEmail ? `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : '';
  const who = cfg.termsOperator ? esc(cfg.termsOperator) : esc(cfg.siteName);
  const hero = `    <h1>${T(`Terms of use`)}</h1>
    <p class="lede">${T(`The rules for using this site, in plain English. Using the site means you agree to them.`)}</p>`;
  const body = `<div class="prose">
  ${cfg.termsLive === true ? '' : `<p class="flag"><b>Draft for review.</b> This page is only in the preview. It is not on the live site, and it has not been checked by a lawyer.</p>`}
  <h2>${T(`What this site is`)}</h2>
  <ul>
    <li>${T(`{site} is a free directory. It gathers what after-school programs, weekend classes and camps in Philadelphia say about themselves on their own websites, and arranges it by school and neighborhood.`, { site: cfg.siteName })}</li>${cfg.termsOperator ? `
    <li>${T(`{site} is run by {who}, a Pennsylvania limited liability company. “We” and “us” in these terms mean {who}.`, { site: cfg.siteName, who })}</li>` : ''}
    <li>${T(`We don’t run any of the programs listed, and we aren’t a child care provider, a school, a booking service or an agent for any program.`)}</li>
    <li>${T(`A listing is not a recommendation. We don’t inspect programs, check licences or insurance, run background checks on staff, or verify that a program is safe or right for your child.`)}</li>
    <li>${T(`Hours, prices, dates, pickup routes and openings change, and what’s here can be out of date or wrong. Confirm everything with the program before you enroll, pay or rely on a pickup.`)}</li>
    <li>${T(`Choosing a program, and arranging how your child gets there and home, is your decision and your responsibility.`)}</li>
  </ul>
  <h2>${T(`Who can use it`)}</h2>
  <ul>
    <li>${T(`The site is for adults: parents, guardians, caregivers and the people who run programs. Accounts are for people 18 and over. Children should not make an account or send us anything.`)}</li>
    <li>${T(`If you make an account, use your own email address and your real name, and keep access to that email to yourself. You are responsible for what’s done from your account.`)}</li>
  </ul>
  <h2>${T(`Children’s information`)}</h2>
  <ul>
    <li>${T(`Looking things up works without telling us anything about a child. A plan you make while signed in is kept in your profile, and you can share a week: you decide what first name to use, and you can use a nickname or an initial.`)}</li>
    <li>${T(`Only add a child you are the parent or guardian of, or have that person’s permission to add.`)}</li>
    <li>${T(`What we store, and how to delete it, is on the privacy page.`)} <a href="${link('privacy/', 1)}">${T(`Read the privacy page.`)}</a></li>
  </ul>
  ${GROUPS ? `<h2>${T(`Sharing a week, and groups`)}</h2>
  <ul>
    <li>${T(`When you share a week or start a group, you choose who sees it. We send the invitation to the email address you give and check that the person signs in with that address. We don’t know who they are beyond that, and we don’t screen anyone.`)}</li>
    <li>${T(`Only invite people you know and would tell where your child is anyway. Anyone you invite can print or screenshot what they see.`)}</li>
    <li>${T(`What happens between you and other people you meet or connect with through the site is between you and them. That includes carpools, shared pickups, playdates, babysitting and money. We are not a party to those arrangements and are not responsible for them.`)}</li>
    <li>${T(`You can stop sharing, leave a group or delete your account at any time.`)}</li>
  </ul>` : ''}
  <h2>${T(`Reviews, suggestions and corrections`)}</h2>
  <ul>
    <li>${T(`A review should be your own first-hand experience, honest, and about the program rather than a named person. Don’t include children’s names or anyone’s private details.`)}</li>
    <li>${T(`We read reviews before they are posted, and we may shorten one, decline it or take it down. A review is the opinion of the person who wrote it, not ours.`)}</li>
    <li>${T(`By sending a review, suggestion or correction you let us publish it on the site and use it to improve the listings. You keep the rights to what you wrote.`)}</li>
  </ul>
  ${GROUPS ? `<h2>${T(`If you run a program`)}</h2>
  <ul>
    <li>${T(`Listings are free. We build them from your public website, and you can ask us to correct or remove one at any time.`)}</li>
    <li>${T(`Claim a listing only if you work for that program and are allowed to speak for it. What you send us about it must be accurate and yours to share.`)}</li>
    <li>${T(`Changes you propose are read before they go on the site. We may edit them to fit the page, decline them, or remove a claim.`)}</li>
    <li>${T(`A listing doesn’t make us your partner, agent or advertiser, and we don’t promise it will bring enrollments.`)}</li>
  </ul>` : ''}
  <h2>${T(`What’s not allowed`)}</h2>
  <ul>
    <li>${T(`Don’t use the site to harass anyone, to pretend to be someone else, or to collect information about children or families.`)}</li>
    <li>${T(`Don’t copy the listings in bulk to republish or sell them, and don’t try to break, overload or get around the site’s protections.`)}</li>
    <li>${T(`We can suspend an account or remove content that breaks these rules.`)}</li>
  </ul>
  <h2>${T(`Links and other services`)}</h2>
  <ul>
    <li>${T(`The site links to programs’ own websites and sign-up pages. Those are theirs: their terms, prices and privacy practices apply there, and anything you buy or sign is between you and them.`)}</li>
    <li>${T(`Program names and logos belong to their owners. The rest of the site, including how the listings are written and arranged, is ours. You’re welcome to link to any page and to share the cards and calendars you make.`)}</li>
  </ul>
  <h2>${T(`No guarantees, and limits on our responsibility`)}</h2>
  <ul>
    <li>${T(`The site is provided as it is, free of charge, without any promise that it is complete, accurate, available or free of errors.`)}</li>
    <li>${T(`As far as the law allows, {who} is not liable for loss or harm that comes from using the site, from relying on a listing, from a program you chose, or from your dealings with other people who use the site.`, { who })}</li>
    <li>${T(`Nothing here limits any right you have that the law doesn’t allow to be limited.`)}</li>
  </ul>
  <h2>${T(`Changes, and how to reach us`)}</h2>
  <ul>
    <li>${T(`We may change the site or these terms. When the terms change in a way that matters, the date below changes with them. If you keep using the site after that, the new terms apply.`)}</li>
    <li>${T(`These terms are governed by the laws of Pennsylvania.`)}</li>
    <li>${T(`Questions about any of this:`)} ${mail}</li>
  </ul>
  <p class="hint">${T(`Last updated {date}.`, { date: longDate(cfg.termsUpdated || TODAY) })}</p>
</div>`;
  return layout({ title: 'Terms of use', description: `The rules for using ${cfg.siteName}: what the site is and isn’t, accounts, sharing, reviews and listings.`, pathName: 'terms/', depth: 1, current: null, hero, body, showStreet: 'parked', noindex: cfg.termsLive !== true });
}

function privacyPage() {
  const mail = cfg.contactEmail ? `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : '';
  const hero = `    <h1>${T(`Privacy, in plain English`)}</h1>
    <p class="lede">${T(`This site is run by one parent. It collects as little as it can. Here is what it does collect, where it goes, and how to have it removed.`)}</p>`;
  const body = `<div class="prose">
  ${jumpNav()}
  <h2 id="short" data-jump-to="In short">${T(`The short version`)}</h2>
  <ul>
    <li>${GATE ? T(`There are no ads, and nothing you send is sold. Looking things up needs no account. The planners (the week, the days off, the summer and the calendar) need a free one, and an account is also for following a program’s dates, keeping favorites, keeping your school or a plan in a profile, and sharing a week with someone.`) : GROUPS ? T(`There are no ads, and nothing you send is sold. An account is optional: it is for following a program’s dates, keeping favorites, keeping your school or a plan in a profile, and sharing a week with someone.`) : T(`There are no accounts and no ads, and nothing you send is sold.`)}</li>
    <li>${GATE ? T(`Your rosters, including any child’s name you type, are saved in your own browser. While you are signed in, a week that has a first name and a program on it is also kept in your profile, so it is there on your other devices. You can take it out of your profile, and it then stays in your browser only. Nobody else sees a week unless you share it.`) : GROUPS ? T(`Your rosters, including any child’s name you type, are saved in your own browser. They are not sent to us unless you sign in and choose to keep one in your profile or share one.`) : T(`Your rosters, including any child’s name you type, are saved in your own browser. They are not sent to us.`)}</li>
    <li>${T(`If you send a suggestion or a review, it arrives as an email to the person who runs the site.`)}</li>
    ${ALERTS ? `<li>${GROUPS ? T(`If you follow a program, a camp or a school, the list of what you follow is kept in your account, and your email address and that list are kept by Klaviyo, the service that sends the emails.`) : T(`If you ask for dates by email, your first name, your email address and the school or program you picked are kept by Klaviyo, the service that sends the emails.`)}</li>
    <li>${GROUPS ? T(`If you ask for a school that isn’t covered yet, that uses your account: which school you asked for is kept with it, so each family counts once. Klaviyo keeps your email address, your name if you’ve given it, and which school you’re waiting for, so you can be told when it has its page.`) : T(`If you ask to be emailed when a school is added, the same three things are kept by Klaviyo: your first name, your email address and which school you’re waiting for. It also adds you to our email list for occasional news about the site.`)}</li>` : ''}
    <li>${T(`We use Google Analytics and Microsoft Clarity to see how the site is used, so we can fix what’s confusing.`)}</li>
  </ul>
  <h2 id="rosters" data-jump-to="Rosters">${T(`Rosters and children’s names`)}</h2>
  <ul>
    <li>${T(`A roster lives in the browser you made it in. Clearing your browser’s site data deletes it.`)}</li>
    <li>${(GATE ? T(`A summer schedule and a days-off plan are kept the same way: your picks, and any first name you type, are saved in your browser and, while you are signed in, in your profile. You can take either out of your profile, and it then stays in your browser only. A photo you add to a calendar picture is used once, in your browser, and is never saved or uploaded.`) : GROUPS ? T(`A summer schedule is kept the same way: the camps you picked for each week, and any first name you type, stay in your browser and are not sent to us unless you sign in and choose to keep the summer in your profile. A photo you add to a calendar picture is used once, in your browser, and is never saved or uploaded.`) : T(`A summer schedule is kept the same way: the camps you picked for each week, and any first name you type, stay in your browser and are not sent to us. A photo you add to a calendar picture is used once, in your browser, and is never saved or uploaded.`))}</li>
    <li>${T(`If you save a school as yours, that choice is kept in your own browser too. Our visit counts record that a school was saved, not who saved it.`)}</li>
    <li>${T(`A child’s name is optional, and a nickname or an initial works. A week with no name on it stays on your device. A name you do add is kept in your profile with the plan it is on, and goes with a week you share.`)}</li>${GROUPS ? `
    <li>${T(`Dates you add yourself to “My kids’ calendar”, like picture day or a form that’s due, are kept in your browser and nowhere else. They are not sent to us and are not part of your profile, so they don’t appear on your other devices.`)}</li>` : ''}
    <li>${T(`A week can no longer be shared as a link. A link showed the week to anyone who had it and could not be taken back, so links made before October 2026 have stopped opening.`)}</li>
    <li>${T(`If one of those older links is opened, the site still removes the name from the page address before any analytics loads. The roster page is set to be hidden in session recordings.`)}</li>
    <li>${T(`Making a card happens on your own device. What you do with the picture is up to you.`)}</li>
    <li>${T(`If you add a photo to a week card, the card is made in your own browser. The photo is not uploaded, not saved, and gone when you close the page.`)}</li>
  </ul>
  ${GROUPS ? `<h2 id="groups" data-jump-to="Accounts">${T(`Accounts, profiles and sharing`)}</h2>
  <p>${GATE ? T(`An account is free. The lists and listings are open to everyone; the planners need you to sign in. The plans you make while signed in (a child’s week, the days off, the summer) are kept in your profile, so they are on every device you sign in on, and you can take any of them out. An account also lets you keep your school in your profile, share a week with one person, and join a share group of a few families who know each other. Your profile, a shared week and a group are the only parts of the site that keep anything about a child on our server.`) : T(`An account is optional. It lets you keep your school and a child’s week in a profile, share a week with one person, and join a share group of a few families who know each other. These are the only parts of the site that keep anything about a child on our server, and only when you choose to use them.`)}</p>
  <ul>
    <li>${T(`An account is an email address and your first and last name. The email signs you in and tells you when someone opens a week you shared or joins a group you made. Other members never see it.`)}</li>
    <li>${T(`When an account is made, the person who runs this site gets an email with the account’s name and email address, and, for a program manager, the listing they claimed. Nothing about a child is in that email.`)}</li>
    <li>${T(`You can change the email address on your account, from your account page. We send a code to the new address to check that it’s yours. Once you type it in, you sign in with the new address, what you follow moves to it on the email list, a short note goes to the old address, and your other devices are signed out. The old address is no longer on your account, but it stays on our email list until it is unsubscribed: use the Unsubscribe link in any email, or ask us and we’ll remove it.`)}</li>${GROUPS.google ? `
    <li>${T(`You can sign in with Google instead of an emailed code. Google’s button is loaded on the pages where you sign in, so Google can see that someone opened that page. If you use it, Google tells us your name and email address. We ask for nothing else and never see your Google password.`)}</li>` : ''}
    <li>${T(`If you keep your school in your profile, we store which school. If you keep your children’s grades or ages, we store the grades and ages and nothing about which child is which. An age you give a child on the summer planner is kept with your profile’s ages the same way. For a week in your profile, we store the child’s first name, the programs on their current and upcoming weeks, and the school each program was picked under, so the week can be put back on another device. Notes you type are not stored.`)}</li>
    <li>${T(`For a summer schedule in your profile, we store each child’s first name as you typed it and the camps picked for each week, so the summer is there on your other devices. The calendar’s title and photos are not stored. A summer in your profile can’t be shared with anyone, and it is deleted when you take it out of your profile or delete your account. The summer schedule section is hidden in session recordings, and analytics is told only that a summer was kept, never what is in it.`)}</li>
    <li>${T(`For a days-off plan in your profile, we store each child’s first name as you typed it, the place picked for each day school is closed, and which of those days you ticked as signed up. The calendar’s title and photos are not stored. The plan can’t be shared with anyone, and it is deleted when you take it out of your profile or delete your account. The planner is hidden in session recordings, and analytics is never told what is in a plan.`)}</li>
    <li>${T(`“My kids’ calendar” is drawn in your browser, for you alone, from the plans on your device and the ones in your profile. Opening it stores nothing new and sends nothing about your plans. It has no link of its own, so nobody else can open it. A picture or calendar file you save is a copy on your device that we never receive. So it can tell you when a date changes, the page remembers what your last file held, on your device only. Google Analytics and Microsoft Clarity are not loaded on it.`)}</li>
    <li>${T(`Sharing a week with one person sends an invitation to the address you give. It only opens for someone signed in with that address, they can look and print but not change anything, and you can take it back at any time.`)}</li>
    <li>${T(`Making an account also adds your name and email to our email list, kept by Klaviyo, for occasional news about the site. Every email has an unsubscribe link, and unsubscribing does not affect your account.`)}</li>
    <li>${T(`The email list also notes whether an account belongs to a parent or to someone who manages a program, so each gets only the news meant for them. For a manager it notes the name of the listing they hold.`)}</li>
    <li>${T(`A new account is asked for a first and last name, and may add a school and a neighborhood. The school and neighborhood set where lists start, and they are noted on the email list so news can be about where you are. Both are optional, and you can change or clear them on your account page.`)}</li>
    <li>${T(`Once you have signed in, this device remembers one word, “parent” or “manager”. On the pages that load analytics, that word is passed along so we can count the two groups separately. Your name, your email address and anything in your profile are not.`)}</li>
    <li>${T(`There are no passwords. We email you a link and a 6-digit code; each works once and for 15 minutes. A cookie then keeps that device signed in for 30 days, and you can sign out everywhere from your account page.`)}</li>
    <li>${T(`When you add a week to a group, we store the child’s first name as you type it and the programs on their current and upcoming weeks. We do not store a last name, school, address, pickup time, note, teacher’s name, photo, price or day-off plan.`)}</li>
    <li>${T(`Nobody can find a group or ask to join one. The person who made it invites email addresses, and only someone signed in with an invited address, who also has the code from the invitation, gets in. A group isn’t listed anywhere, and its link shows nothing to anyone else.`)}</li>
    <li>${T(`If someone invites you, they give us your email address so we can send the invitation and recognise you if you join. We keep it with that group, use it for nothing else, and delete it when you are removed or the group ends. The invitation shows the name and email of the person who invited you.`)}</li>
    <li>${T(`A group’s creator sees the name and email address of each adult in it; other members don’t.`)}</li>
    <li>${T(`Someone who joins to view only, such as a caregiver, can see and print the group and cannot change it.`)}</li>
    <li>${T(`Anyone in a group can print it or take a screenshot, so keep groups to people you know and would tell where your child is anyway.`)}</li>
    <li>${T(`Accounts, profiles and groups are kept in a file on our web host, outside the public site. Google Analytics, Microsoft Clarity and Klaviyo’s script are not loaded on your account page, your profile page, on invitations or on group pages. Two pages around them do load them. The page where you create an account counts visits: its form is hidden in session recordings, and analytics is told only that a sign-up started, whether it used email or Google, and that it finished, never the address or a name. The Build your week page is hidden in session recordings too, and analytics is told only that something was kept or shared, never what or with whom.`)}</li>
${POSTMARK ? `    <li>${T(`The emails the site itself sends, such as sign-in codes, invitations and notices about a listing, are delivered by Postmark, an email delivery service. It is given the address and the message so it can deliver them, and it keeps a record of each one for a limited time so delivery problems can be traced. We have its tracking of opens and clicks turned off for these emails.`)} <a href="https://postmarkapp.com/privacy-policy" target="_blank" rel="noopener">${T(`Postmark’s privacy policy`)}</a>.</li>
` : ''}    <li>${T(`We keep a daily count of how many accounts, shared weeks and groups were made, to see whether this is used. The counts hold no names, addresses or weeks.`)}</li>
    <li>${T(`You can take a week out of your profile or out of a group, stop sharing, leave a group, or delete your account from the site at any time, and it is removed straight away. A group’s creator can remove anyone. Every shared week and group is deleted two weeks after the last day of school.`)}</li>
    <li>${T(`A safety copy of the accounts database is made each day and kept for 14 days, in case something breaks, and our web host keeps its own backups. So what you delete is gone from the site straight away, and leaves those copies as they are replaced, usually within a month.`)}</li>
    <li>${GATE ? T(`Accounts are for parents, caregivers, teachers and the people who run programs. Children should not make one. The planners are for the adult who signs in, and a child’s name on a plan is optional.`) : T(`Accounts are for parents, caregivers, teachers and the people who run programs. Children should not make one, and the site never asks a child for an email address: building a week and making a card work without an account.`)}</li>
  </ul>
  <h2 id="managers" data-jump-to="Program managers">${T(`If you manage a program and claim its listing`)}</h2>
  <ul>
    <li>${T(`Claiming uses the same account. We check one thing: that the email address you signed in with is at the listing’s own website address. We keep which listing you claimed, when, and whether the claim stands.`)}</li>
    <li>${T(`The public sees a “Claimed” mark on the listing and nothing about you. Your name and email address are seen only by the person who runs this site.`)}</li>
    <li>${T(`If you hold a listing, we email you about it: its numbers once a month, a note when a review of it is published, and a note when more families start following it. You can turn these off on the managers page or from a link in any of them.`)}</li>
    <li>${T(`What a program’s managers are told about families is numbers only: how many times a listing was opened, and how many families started following it. Never who.`)}</li>
    <li>${T(`Changes you propose are kept with your claim and emailed to the site’s inbox. They are checked and published by a person, and you are told by email when that happens.`)}</li>
${GROUPS.photos || GROUPS.premium !== 'off' ? `    <li>${T(`A photo you send for your listing is shrunk in your browser before it leaves your device, kept on our web host, and shown on the listing only after a person approves it. You can replace or remove it at any time. Send only a photo you have the right to use, with permission from the families of any children in it.`)}</li>` : ''}${GROUPS.premium !== 'off' ? `
    <li>${T(`A premium listing can also carry a logo, a section in your own words and an offer or event line. Each is kept on our web host with your claim, read by a person before it shows, and marked on the listing as coming from the program. You can change or remove any of them at any time.`)}</li>
    <li>${T(`If you sign a listing up for premium, we keep which plan you picked and the day you picked it, with your claim. It goes when the claim or the account does.`)}</li>${PM_PAY ? `
    <li>${T(`A premium listing is paid for on Stripe’s own page. Your card details go to Stripe and never reach us. Stripe tells us who paid, how much and for which listing, so we can switch it on. When Stripe sends you back here, the page tells our visitor statistics that a sale was made and for which plan, not who made it.`)}</li>` : ''}
    <li>${T(`A question a parent sends from your listing comes to the email address on your account, and to anyone else who holds the listing, with the parent’s address to reply to. We pass it along and don’t keep a copy.`)}</li>` : ''}
    <li>${T(`If you say whether there’s space, the listing shows “Spots open”, “Waitlist” or “Full” and the day you said it. It goes up at once, without anyone checking it, and comes down after 30 days unless you set it again.`)}</li>
    <li>${T(`You can give up a claim at any time, and deleting your account removes your claims and the changes you proposed.`)}</li>
    <li>${T(`The page where you claim a listing loads Google Analytics and Microsoft Clarity to count visits. The part where you sign in and manage claims is hidden in session recordings.`)}</li>
  </ul>` : ''}
  <h2 id="forms" data-jump-to="Forms and reviews">${T(`Suggestions, corrections and reviews`)}</h2>
  <ul>
    <li>${T(`What you type into a form is emailed to the site’s inbox, and a backup copy is kept on our web host in case the email goes missing.`)}</li>
    <li>${T(`Your email address is used only to reply to you or to confirm something. It is never published.`)}</li>
    <li>${T(`A review that is approved appears on the site with your first name, your child’s school and the month. Nothing else about you is shown.`)}</li>
    <li>${T(`When a program has been on your week for a few weeks, the site may ask whether you’d review it. That is worked out in your browser, from the rosters on your device. Your device remembers the day it first saw each program on a roster, when it last asked, and which programs you reviewed or said not to ask about. None of that is sent to us, and “Don’t ask about this one” ends it for that program.`)}</li>${GROUPS ? `
    <li>${T(`If you are signed in, the review form fills in your first name and email address from your account so you don’t have to type them. You can change either before you send it.`)}</li>` : ''}
    <li>${T(`Asking for a school to be covered sends only the school’s name.`)}</li>
    <li>${T(`A date you send in for a school’s page (picture day, a half day) is read by a person before it is published. What is published is the date and what it is, marked “from a parent”: never your name or email.`)}</li>
    <li>${T(`Please don’t include children’s names or other people’s personal details in what you send.`)}</li>${GROUPS && GROUPS.premium !== 'off' ? `
    <li>${T(`Some listings have an “Ask a question” button. What you type there, with your first name and email address, is emailed to the people who run that program so they can answer you. We pass it along and don’t keep a copy. We do count that a question was asked.`)}</li>` : ''}
  </ul>
  <h2 id="map" data-jump-to="The map">${T(`Distances and the map`)}</h2>
  <ul>
    <li>${T(`“From where I am” asks your browser for your location. It is used on your device to work out distances, it is not sent to us, and it is not kept.`)}</li>
    <li>${T(`The map stays off until you tap “Show the map”. Its pictures then come from OpenStreetMap’s servers, which see your internet address and which part of the city you looked at, as any website you visit does.`)} <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener">${T(`OpenStreetMap’s privacy policy`)}</a>.</li>
    <li>${T(`Distances are measured in a straight line from street addresses, so a walk is usually a little longer.`)}</li>
  </ul>
  ${ALERTS ? `<h2 id="email" data-jump-to="Emails and texts">${T(`Dates by email`)}</h2>
  <ul>
    ${GROUPS ? `<li>${T(`Following a program, a camp or a school uses a free account. Your account keeps the list of what you follow. Your browser sends two things to Klaviyo, the email service we use: your email address (with your first name, if your account has one) and what you follow. They are stored there.`)}</li>
    <li>${T(`You hear only about what you follow. Stop following from the listing’s page or from your account page and those emails stop; deleting your account stops them all.`)}</li>
    <li>${T(`A sign-up date is emailed the morning after it is posted on this site, with reminders the day before and on the morning itself. Days off come in a weekly round-up. We can only pass on a date once the program has posted it and it has reached this site.`)}</li>
    <li>${T(`Every date email has a link for each listing in it, “Stop emails about …”. It stops that one listing without signing in, including its dates that would have reached you through a school you follow, and you can undo it on the spot or from your account page.`)}</li>
    <li>${T(`That link works because it carries a random code that belongs to your account. The code is kept with your account and on your email-list profile, and it can do one thing: stop emails. It can’t open your account or show anything in it, and the page it opens never says whose it is.`)}</li>
    <li>${T(`So that a stop always holds, we keep a list of what has been stopped in a scrambled form that can’t be read back into a person or a listing without that code. The entry for a deleted account stays on that list, so its emails stay stopped.`)}</li>
    <li>${T(`“This week at your school” is an email you turn on in your account, for the school kept there. It is off until you tick it. It works like following: which school it is for is kept in your account and on your email-list profile, and you can turn it off there or from the link in any of those emails.`)}</li>
    <li>${T(`A favorite is different. It is kept in your account and nowhere else: it isn’t sent to Klaviyo, and it sends no email.`)}</li>
    <li>${T(`Notifications on your phone or computer are optional, and off until you turn them on from your account page. When you do, your browser gives us an address at its own notification service (Google’s for Chrome and Android, Apple’s for Safari and iPhones, Mozilla’s for Firefox) and two keys. We keep those with your account and use them only to send you the dates for what you follow. Each notification is sealed so that the notification service carrying it can’t read it. Turning notifications off on a device removes that device, and deleting your account removes them all.`)}</li>
    <li>${T(`If you choose notifications instead of the date emails, those emails stop while one of your devices can still get notifications, and start again by themselves if none can.`)}</li>
    <li>${T(`A phone number is optional. If you add one and tick the box agreeing to texts, we keep the number, the day you agreed and the wording you agreed to, in your account. It is for texts about what you follow and nothing else. Texts have not started yet; until they do, the number is not passed to any texting service. You can remove it on your account page at any time, and a text will always say how to stop them. Message and data rates may apply.`)}</li>
    <li>${T(`Asking to be told when a school is added still takes only a first name and an email address, with no account.`)}</li>` : `<li>${T(`The sign-up form sends three things: your first name, your email address and the school or program you chose. They go from your browser to Klaviyo, the email service we use, and are stored there.`)}</li>
    ${summerCamps.length ? `<li>${T(`On a summer camp’s page the same form sends the camp you asked about, and you hear about that camp alone.`)}</li>` : ''}`}
    <li>${T(`It never asks for a child’s name, grade or anything else about your family, and your roster is not sent with it.`)}</li>
    <li>${T(`Like most email services, Klaviyo records whether an email was opened and which links were clicked, and it may estimate a general location from your internet connection.`)}</li>
    <li>${T(`Your name and address are used for these date emails and nothing else. They are not shared with the programs listed here, and they are not sold.`)}${GROUPS ? ' ' + T(`The same goes for a phone number.`) : ''}</li>
    <li>${T(`Every email has an unsubscribe link, and using it stops the emails. To have your name and address deleted altogether, email us.`)}</li>
    <li>${T(`Klaviyo handles that data under its own terms:`)} <a href="https://www.klaviyo.com/legal/privacy-notice" target="_blank" rel="noopener">${T(`Klaviyo’s privacy notice`)}</a>.</li>
  </ul>
  ` : ''}${GROUPS ? `<h2 id="counts" data-jump-to="Counts">${T(`Counts for each listing`)}</h2>
  <ul>
    <li>${T(`We keep a count, for each listing and each day, of how many times its page was opened, how many times its sign-up and website links were followed, how many times it was put on a plan, and how many people asked for its emails.`)}</li>${GROUPS.premium !== 'off' ? `
    <li>${T(`If your browser has a school saved when you open a listing’s page, we also add one to a monthly count for that school, so the people who run the listing can see which schools’ families are looking. What is kept is which school is saved and a number: nothing about who you are.`)}</li>` : ''}
    <li>${T(`It is a number and nothing else. No cookie is set, and nothing says who you are, which child a plan was for, or what else you looked at.`)}</li>
    <li>${T(`To stop a count being run up, the server keeps a scrambled form of the internet address behind each count for up to two days. It can’t be turned back into the address and isn’t tied to what was counted.`)}</li>
    <li>${T(`The people who run a listing they have claimed can see that listing’s numbers. Nobody else can, apart from us.`)}</li>
  </ul>
  ` : ''}<h2 id="analytics" data-jump-to="Analytics">${T(`Analytics and recordings`)}</h2>
  <ul>
    <li>${T(`Google Analytics records which pages are visited and which buttons, filters and searches are used, along with general details such as device type and approximate location. That includes the words typed into the program search box.`)}</li>
    <li>${T(`Microsoft Clarity records how pages are used, including heatmaps and replays of scrolling and clicking, to help us improve the site. We have set it to hide form fields and the roster page.`)}</li>
    <li>${T(`Klaviyo, the email service, also has a small script on the public pages. It sets a cookie so that a visit that started from one of its emails can be tied to that address, and it records which pages that visit saw. It is not loaded on the pages listed above either.`)}</li>
    <li>${T(`These services use cookies and similar technologies, and Google, Microsoft and Klaviyo handle that data under their own privacy terms:`)} <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">${T(`how Google uses information from sites that use its services`)}</a>, <a href="https://www.microsoft.com/privacy/privacystatement" target="_blank" rel="noopener">${T(`the Microsoft Privacy Statement`)}</a>, <a href="https://www.klaviyo.com/legal/privacy-notice" target="_blank" rel="noopener">${T(`Klaviyo’s privacy notice`)}</a>.</li>
    <li>${T(`You can block all of them with your browser’s privacy settings or a content blocker, and the site will still work.`)}</li>
    <li>${T(`Like every website, our host keeps standard server logs, which include IP addresses.`)}</li>
  </ul>
  <h2 id="elsewhere" data-jump-to="Other sites">${T(`Links to other sites`)}</h2>
  <p>${T(`Program websites, registration pages, calendars and Stripe’s checkout pages are run by other organizations and have their own privacy practices.`)}</p>
  <p>${T(`Links to a program’s own site carry a short tag saying the visit came from {site}, and from which school’s page. The tag says nothing about you.`, { site: cfg.siteName })}</p>
  <h2 id="children" data-jump-to="Children">${T(`Children`)}</h2>
  <p>${T(`This site is written for parents and caregivers. It is not meant to be used by children, and we do not knowingly collect information from them.`)}</p>
  <h2 id="remove" data-jump-to="Removing things">${T(`Seeing or removing what you sent`)}</h2>
  <p>${T(`To have a review taken down, your email address removed from the date emails, or a suggestion and your contact details deleted, email`)} ${mail}${T(`. Say what you sent and roughly when, and it will be removed.`)}</p>
  <p class="hint">${T(`Last updated {date}. If this page changes in a way that matters, the date changes with it.`, { date: longDate(cfg.privacyUpdated || TODAY) })}</p>
</div>`;
  return layout({ title: 'Privacy', description: `What ${cfg.siteName} collects, where it goes and how to have it removed, in plain English.`, pathName: 'privacy/', depth: 1, current: null, hero, body, showStreet: 'parked' });
}

function supportPage() {
  const who = cfg.builtBy ? cfg.builtBy.name.split(' ')[0] : '';
  const give = cfg.supportUrl
    ? `<p class="actions"><a class="btn primary big" data-track="support" href="${esc(cfg.supportUrl)}" target="_blank" rel="noopener">${esc(cfg.supportLabel || 'Chip in')}</a>${cfg.supportMonthlyUrl ? `<a class="btn big" data-track="support" data-support="monthly" href="${esc(cfg.supportMonthlyUrl)}" target="_blank" rel="noopener">${esc(cfg.supportMonthlyLabel || 'Chip in monthly')}</a>` : ''}</p>
  <p class="hint">${T(`Any amount. It opens a Stripe checkout page, which takes cards, Apple Pay and Google Pay, and sends you a receipt.`)}</p>`
    : `<div class="panel"><h3>${T(`The link for chipping in is being set up`)}</h3><p>${T(`Check back soon.`)}</p></div>`;
  const hero = `    <h1>${T(`Help the site keep going`)}</h1>
    <p class="lede">${T(`{site} is free for families, and it will stay that way. It isn’t free to run. If it saved you an evening of open tabs, you can chip in toward what it costs to keep it going and growing.`, { site: cfg.siteName })}</p>`;
  const body = `<div class="prose">
  <div class="panel support-thanks" id="support-thanks" data-edit-reveal="Shown when someone comes back from paying:" hidden>
    <h3>${T(`Thank you`)}</h3>
    <p data-thanks="1">${T(`Your contribution went through, and a receipt is on its way to the email you gave. It goes straight to keeping the site running. Thank you for helping it keep going.`)}</p>
    <p data-thanks="2" hidden>${T(`Your monthly contribution is set up, and a receipt is on its way to the email you gave; one comes each month it goes through. It goes straight to keeping the site running. To change or stop it, email {email} any time. Thank you for helping it keep going.`, { email: cfg.contactEmail || '' })}</p>
  </div>
  ${give}
  <ul>
    <li>${T(`It goes toward what the site costs to run: web hosting, the service that sends sign-in codes and date reminders, and the hours spent checking listings and adding schools.`)}</li>
    ${cfg.supportUrl ? `<li>${T(`It goes through Stripe to {operator}, the small company the Silverbauers set up to run the site and pay its bills.`, { operator: cfg.termsOperator || 'the site' })}</li>` : ''}
    <li>${T(`It’s a contribution to a small family-run project, not a charitable donation, so it isn’t tax-deductible.`)}</li>
    <li>${T(`It buys nothing on the site. Listings are free for every provider, and nobody pays to be listed or to be listed higher.`)}</li>
    <li>${T(`Can’t chip in? A correction or a missing program helps just as much.`)} <a href="${link('suggest/', 1)}">${T(`Send one here.`)}</a></li>
  </ul>
</div>`;
  return layout({ title: 'Help the site keep going', description: `${cfg.siteName} is free for families but not free to run. Here is how to chip in, and where the money goes.`, pathName: 'support/', depth: 1, current: 'support/', hero, body, showStreet: 'parked' });
}

function aboutPage() {
  const mail = cfg.contactEmail ? `Email <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : 'A contact address is being set up. Check back soon';
  const hero = `    <h1>${T(`One place to see what’s possible after the last bell`)}</h1>
    <p class="lede">${T(`Finding after-school care means checking a dozen websites to learn who picks up from your school, for which grades, until when. {site} puts that on one page per school.`, { site: cfg.siteName })}</p>`;
  const body = `<div class="prose">
  <h2 id="how">${T(`How listings are checked`)}</h2>
  <ul>
    <li>${T(`Each listing comes from the provider’s own public pages, the school’s site, or city program data. The sources are linked on every card.`)}</li>
    <li>${T(`Every card shows the date it was last checked. When a detail could not be confirmed, the card says so in a yellow note.`)}</li>
    <li>${T(`A program is marked “picks up” only when a source names the school. Otherwise it is listed as nearby.`)}</li>
  </ul>
  <h2>${T(`What this site can’t promise`)}</h2>
  <ul>
    <li>${T(`A listing is not an endorsement, and nobody pays to appear here.`)}</li>
    <li>${T(`Prices, hours, openings and pickup routes change during the year. Confirm with the provider before you enroll.`)}</li>
    <li>${T(`{site} is independent. It is not affiliated with the School District of Philadelphia or any provider.`, { site: cfg.siteName })}</li>
  </ul>
  <h2 id="corrections">${T(`Corrections, new programs and new schools`)}</h2>
  <p>${T(`Parents and providers know these programs best. If something is wrong or missing, or you want your school added,`)} <a href="${link('suggest/', 1)}">${T(`use the form`)}</a>. ${mail}.</p>
  <p>${T(`It helps to include the program, the school, what changed, and a link to where it’s published.`)}</p>
  <h2 id="reviews">${T(`Reviews`)}</h2>
  <ul>
    <li>${T(`Reviews are first-hand notes from parents and caregivers. Each one is read before it’s posted and shows the reviewer’s first name and school.`)}</li>
    <li>${T(`We don’t post reviews that name children or individual staff, or reviews a program writes about itself.`)}</li>
    <li>${T(`Nobody pays to have a review posted or removed. A provider who thinks a review is wrong can use the form above or the contact address.`)}</li>
  </ul>
  ${cfg.builtBy ? `<h2 id="who">${T(`Who built this`)}</h2>
  <p>${T(cfg.builtBy.bio)}</p>` : ''}
</div>`;
  return layout({ title: 'About', description: `How ${cfg.siteName} gathers and checks after-school listings, and how to send a correction.`, pathName: 'about/', depth: 1, current: 'about/', hero, body, showStreet: 'parked' });
}

function suggestPage() {
  const opts = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `<option>${esc(s.shortName)}</option>`).join('');
  const hero = `    <h1>${T(`Know one we missed?`)}</h1>
    <p class="lede">${T(`Plenty of good programs are off the radar: a church basement, a dance studio that walks kids over, a summer camp nobody has listed. Tell us and we’ll check it and add it. You can also send an update to a listing or ask for your school.`)}</p>`;
  const chips = (name, legend, values, attrs = '') => `<fieldset class="field chips"${attrs}>
      <legend>${T(legend)}</legend>
      <div class="chip-row">${values.map((v, i) => `<label class="chip"><input type="radio" name="${name}" value="${esc(v)}"${i === 0 ? ' checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div>
    </fieldset>`;
  const body = `<div class="suggest">
  <form class="form panel" method="post" action="send.php" id="suggest-form" data-clarity-mask="true">
    ${chips('kind', 'What are you sending?', ['A program that’s missing', 'A camp that’s missing', 'An update to a listing', 'A school to add'])}
    <input type="hidden" name="listing" id="f-listing" value="">
    <div class="field" data-show="school" hidden>
      <label for="f-newschool">${T(`School name`)}</label>
      <input id="f-newschool" name="newschool" type="text" maxlength="120" autocomplete="off" disabled>
      <span class="hint">${T(`The neighborhood helps too, if you know it.`)}</span>
    </div>
    <div class="pair">
      <div class="field" data-show="program correction">
        <label for="f-school">${T(`Which school?`)}</label>
        <select id="f-school" name="school">
          ${opts}
          <option>Another school</option>
          <option>No particular school</option>
        </select>
        <span class="hint">${T(`For another school, name it in the details.`)}</span>
      </div>
      <div class="field" data-show="program camp correction">
        <label for="f-program" data-text-program="Program name" data-text-camp="Camp name" data-text-correction="Program or camp name">Program name</label>
        <input id="f-program" name="program" type="text" maxlength="150" autocomplete="off">
      </div>
    </div>
    ${chips('camptype', 'What kind of camp?', ['Summer camp', 'Camp on days school is closed', 'Both'], ' data-show="camp"')}
    <div class="field" data-show="program camp correction">
      <label for="f-website" data-text-program="Its website" data-text-camp="Its website" data-text-correction="Link that shows the right information, if you have one">Its website</label>
      <input id="f-website" name="website" type="text" maxlength="300" inputmode="url" autocomplete="off" placeholder="https://">
      <span class="hint" data-text-program="Needed. We check every listing against the program’s own website, so we can’t add one without it." data-text-camp="Needed. We check every listing against the camp’s own website, so we can’t add one without it." data-text-correction="Optional, but an update with a link gets made faster.">Needed. We check every listing against the program’s own website, so we can’t add one without it.</span>
    </div>
    ${chips('pickup', 'Does it pick up from the school?', ['Not sure', 'Yes, staff pick up', 'It runs at the school', 'No pickup'], ' data-show="program"')}
    <div class="field">
      <label for="f-details" data-text-program="Details" data-text-camp="Details" data-text-correction="What should change?" data-text-school="Anything else? (optional)">Details</label>
      <span class="hint" data-text-program="Grades, days and hours, cost, who to contact. Whatever you know." data-text-camp="Ages, weeks, hours, cost. Whatever you know." data-text-correction="What the listing says now, and what it should say." data-text-school="Programs you already know serve this school, or why it should be next.">Grades, days and hours, cost, who to contact. Whatever you know.</span>
      <textarea id="f-details" name="details" maxlength="4000" required></textarea>
    </div>
    <div class="about-you">
      <h2>${T(`About you`)}</h2>
      <p class="hint">${T(`All optional. Your email is only used to ask a follow-up question about what you sent.`)} <a href="${link('privacy/', 1)}">${T(`How we handle it.`)}</a></p>
      <div class="field">
        <label for="f-role">${T(`How do you know it?`)}</label>
        <select id="f-role" name="role">
          <option>I’m a parent or caregiver</option>
          <option>I run or work at the program</option>
          <option>I work at the school</option>
          <option>Other</option>
        </select>
      </div>
      <div class="pair">
        <div class="field">
          <label for="f-name">${T(`Your name`)}</label>
          <input id="f-name" name="name" type="text" maxlength="100" autocomplete="name">
        </div>
        <div class="field">
          <label for="f-email">${T(`Your email`)}</label>
          <input id="f-email" name="email" type="email" maxlength="150" autocomplete="email">
        </div>
      </div>
    </div>
    <div class="hp" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">
      <label for="f-company">Leave this blank</label>
      <input id="f-company" name="company" type="text" tabindex="-1" autocomplete="off">
    </div>
    <div><button class="btn primary big" type="submit">${T(`Send it`)}</button></div>
  </form>
  <aside class="next">
    <h2>${T(`What happens next`)}</h2>
    <ol>
      <li>${T(`Your note lands in a real inbox. A person reads it.`)}</li>
      <li>${T(`We check it against the program’s own information.`)}</li>
      <li>${T(`If it holds up, it goes on the site with its source and the date.`)}</li>
    </ol>
    <p class="hint">${T(`Nothing is published automatically, and nobody pays to be listed.`)}</p>${GROUPS ? `
    <h2>${T(`Run the program yourself?`)}</h2>
    <p>${T(`Claim your listing with your work email and send changes as its manager.`)} <a href="${link('managers/', 1)}">${T(`How claiming works`)}</a></p>` : ''}
  </aside>
</div>`;
  return layout({ title: 'Suggest a program or camp', description: `Tell ${cfg.siteName} about an after-school program or camp that’s missing, an update to a listing, or a school to add.`, pathName: 'suggest/', depth: 1, current: 'suggest/', hero, body, showStreet: 'parked' });
}

function ideasPage() {
  const hero = `    <h1>${T(`What should this site do next?`)}</h1>
    <p class="lede">${T(`A missing filter, something confusing, a thing you wish it did. One person builds this, and reads every one.`)}</p>`;
  const body = `<div class="suggest">
  <form class="form panel" method="post" action="${link('suggest/send.php', 1)}" id="idea-form" data-clarity-mask="true">
    <input type="hidden" name="kind" value="A feature idea">
    <div class="field">
      <label for="i-details">${T(`Your idea`)}</label>
      <span class="hint">${T(`What were you trying to do, and what would have made it easier?`)}</span>
      <textarea id="i-details" name="details" maxlength="4000" required></textarea>
    </div>
    <div class="pair">
      <div class="field">
        <label for="i-name">${T(`Your name (optional)`)}</label>
        <input id="i-name" name="name" type="text" maxlength="100" autocomplete="name">
      </div>
      <div class="field">
        <label for="i-email">${T(`Your email (optional)`)}</label>
        <input id="i-email" name="email" type="email" maxlength="150" autocomplete="email">
        <span class="hint">${T(`Only used to ask a follow-up question.`)} <a href="${link('privacy/', 1)}">${T(`How we handle it.`)}</a></span>
      </div>
    </div>
    <div class="hp" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">
      <label for="i-company">Leave this blank</label>
      <input id="i-company" name="company" type="text" tabindex="-1" autocomplete="off">
    </div>
    <div><button class="btn primary big" type="submit">${T(`Send the idea`)}</button></div>
  </form>
  <aside class="next">
    <h2>${T(`Other things you can send`)}</h2>
    <ul class="rules">
      <li><a href="${link('suggest/', 1)}">${T(`A program that’s missing, or a correction`)}</a></li>
      <li><a href="${link('schools/request/', 1)}">${T(`A school you want covered`)}</a></li>
      <li><a href="${link('review/', 1)}">${T(`A review of a program your child went to`)}</a></li>
    </ul>
  </aside>
</div>`;
  return layout({ title: 'Request a feature', description: `Tell ${cfg.siteName} what the site should do next.`, pathName: 'ideas/', depth: 1, current: null, hero, body, showStreet: 'parked' });
}
function ideasThanksPage() {
  const hero = `    <h1>${T(`Got it. Thank you.`)}</h1>
    <p class="lede">${T(`Ideas get read, and the ones that help the most families get built first.`)} <a href="${link('', 2)}">${T(`Back to the start.`)}</a></p>`;
  return layout({ title: 'Thanks for the idea', description: 'Your idea was sent.', pathName: 'ideas/thanks/', depth: 2, current: null, hero, body: '', showStreet: 'parked', noindex: true });
}

function thanksPage() {
  const hero = `    <h1>${T(`Got it. Thank you.`)}</h1>
    <p class="lede">${T(`We’ll check it against the program’s own information and add it if it holds up.`)} <a href="${link('', 2)}">${T(`Back to the schools.`)}</a></p>`;
  return layout({ title: 'Thank you', description: 'Your suggestion was sent.', pathName: 'suggest/thanks/', depth: 2, current: null, hero, body: '', showStreet: 'parked', noindex: true });
}

// The form handler. Runs on the web host (PHP), emails the suggestion to the contact address,
// and keeps a copy in a log file outside the public folder in case the email does not arrive.
function sendPhp() {
  return `<?php
// Receives the "Suggest a program" form. Generated by build.mjs; edit it there.
${mailerPhp()}
$TO = ${JSON.stringify(cfg.contactEmail)};
$SITE = ${JSON.stringify(cfg.siteName)};

function fail($msg, $code) {
  http_response_code($code);
  header('Content-Type: text/html; charset=utf-8');
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not sent</title><link rel="stylesheet" href="../assets/site.css${CSS_V}"></head><body><main class="wrap"><h1>That did not send</h1><p>' . htmlspecialchars($msg, ENT_QUOTES, 'UTF-8') . '</p><p><a href="./">Go back to the form</a></p></main></body></html>';
  exit;
}
function field($key, $max) {
  $v = (isset($_POST[$key]) && is_string($_POST[$key])) ? trim($_POST[$key]) : '';
  $v = str_replace(chr(0), '', $v);
  return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}
function one_line($v) {
  return trim(preg_replace('/[\\r\\n\\t]+/', ' ', $v));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header('Location: ./', true, 303);
  exit;
}
// A hidden field people never see. If it is filled in, a bot did it: act as if it worked.
if (field('company', 200) !== '') {
  header('Location: thanks/', true, 303);
  exit;
}

$kind = one_line(field('kind', 60));
$school = one_line(field('school', 80));
$newschool = one_line(field('newschool', 120));
$program = one_line(field('program', 150));
$website = one_line(field('website', 300));
$camptype = one_line(field('camptype', 60));
$listing = preg_match('/^[pc]:[a-z0-9-]{1,80}$/', field('listing', 90)) ? field('listing', 90) : '';
$pickup = one_line(field('pickup', 60));
$when = one_line(field('when', 120));
$role = one_line(field('role', 60));
$name = one_line(field('name', 100));
$email = one_line(field('email', 150));
$details = field('details', 4000);

if ($details === '' && $program === '' && $newschool === '') {
  fail('Please add a school name, a program name or some details so we know what to look for.', 400);
}
if (substr_count(strtolower($details), 'http') > 5) {
  fail('That has too many links for us to accept. Please trim it and try again.', 400);
}
// A new program or camp needs its own website: every listing is checked against it.
$isNew = strpos($kind, 'A program') === 0 || strpos($kind, 'A camp') === 0;
if ($isNew && !preg_match('~^(https?://)?[a-z0-9][a-z0-9.-]*\\.[a-z]{2,}([/?#]\\S*)?$~i', $website)) {
  fail('Please add the website of the program or camp. We check every listing against its own website, so we can’t add one without it.', 400);
}
if ($isNew && $program === '') {
  fail('Please add the name of the program or camp.', 400);
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  $email = '';
}

$body = "Type: $kind\\n"
  . "School: $school\\n"
  . "New school: $newschool\\n"
  . ($when !== '' ? "What: $program\\nWhen: $when\\n" : "Program: $program\\n")
  . ($listing !== '' ? "Listing: $listing\\n" : '')
  . ($camptype !== '' ? "Camp type: $camptype\\n" : '')
  . "Website: $website\\n"
  . "Picks up: $pickup\\n"
  . "Sent by: $role\\n"
  . "Name: $name\\n"
  . "Email: $email\\n\\n"
  . "Details:\\n$details\\n";

$what = $newschool !== '' ? $newschool : $program;
$subject = one_line("[$SITE] $kind" . ($what !== '' ? ": $what" : '') . ($school !== '' ? " ($school)" : ''));
$headers = array(
  'From: ' . $SITE . ' <' . $TO . '>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
);
if ($email !== '') {
  $headers[] = 'Reply-To: ' . $email;
}

$sent = pas_postmark($SITE, $TO, $TO, $subject, $body, '', isset($email) ? (string) $email : '') === 1 || @mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\\r\\n", $headers));
$log = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-suggestions.log';
$saved = @file_put_contents($log, date('c') . ($sent ? ' (emailed)' : ' (EMAIL FAILED)') . "\\n" . $body . "----\\n", FILE_APPEND | LOCK_EX);

if (!$sent && $saved === false) {
  fail('Something went wrong on our side. Please email ' . $TO . ' instead.', 500);
}
header('Location: ' . ($kind === 'A feature idea' ? '../ideas/thanks/' : 'thanks/'), true, 303);
exit;
`;
}

// ---------- contact: a page with a form, for anything that isn't a suggestion ----------
function contactPage() {
  const hero = `    <h1>${T(`Get in touch`)}</h1>
    <p class="lede">${T(`A question, a problem with the site, something for the press, or just hello. This goes to the parent who runs the site.`)}</p>`;
  const body = `<div class="suggest">
  <form class="form panel" method="post" action="send.php" id="contact-form" data-clarity-mask="true">
    <div class="pair">
      <div class="field">
        <label for="c-name">${T(`Your name`)}</label>
        <input id="c-name" name="name" type="text" maxlength="100" autocomplete="name" required>
      </div>
      <div class="field">
        <label for="c-email">${T(`Your email`)}</label>
        <input id="c-email" name="email" type="email" maxlength="150" autocomplete="email" required>
        <span class="hint">${T(`So we can write back. It’s used for nothing else.`)}</span>
      </div>
    </div>
    <div class="field">
      <label for="c-topic">${T(`What’s it about?`)}</label>
      <select id="c-topic" name="topic">
        <option>A question</option>
        <option>Something isn’t working</option>
        <option>I run a program or camp</option>
        <option>My account</option>
        <option>Press or partnerships</option>
        <option>Something else</option>
      </select>
    </div>
    <div class="field">
      <label for="c-message">${T(`Your message`)}</label>
      <textarea id="c-message" name="message" maxlength="4000" required></textarea>
    </div>
    <div class="hp" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">
      <label for="c-company">Leave this blank</label>
      <input id="c-company" name="company" type="text" tabindex="-1" autocomplete="off">
    </div>
    <div><button class="btn primary big" type="submit">${T(`Send it`)}</button></div>
  </form>
  <aside class="next">
    <h2>${T(`Other ways`)}</h2>
    <ul class="other-ways">
      ${cfg.contactEmail ? `<li>${T(`Email`)} <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a></li>` : ''}
      <li>${T(`A program or camp that’s missing, or a listing that’s wrong:`)} <a href="${link('suggest/', 1)}">${T(`use the suggestion form`)}</a>${T(`, so it reaches the right pile.`)}</li>
      <li>${T(`An idea for the site:`)} <a href="${link('ideas/', 1)}">${T(`request a feature`)}</a>.</li>
      ${GROUPS ? `<li>${T(`You run a program:`)} <a href="${link('managers/', 1)}">${T(`claim your listing`)}</a>.</li>` : ''}
    </ul>
    <p class="hint">${T(`One parent reads these, usually within a few days.`)} <a href="${link('privacy/', 1)}#forms">${T(`How we handle what you send.`)}</a></p>
  </aside>
</div>`;
  return layout({ title: 'Contact', description: `Get in touch with ${cfg.siteName}: a question, a problem with the site, or anything else.`, pathName: 'contact/', depth: 1, current: null, hero, body, showStreet: 'parked' });
}
function contactThanksPage() {
  const hero = `    <h1>${T(`Sent. Thank you.`)}</h1>
    <p class="lede">${T(`Your message is in the inbox. You’ll hear back by email, usually within a few days.`)} <a href="${link('', 2)}">${T(`Back to the schools.`)}</a></p>`;
  return layout({ title: 'Message sent', description: 'Your message was sent.', pathName: 'contact/thanks/', depth: 2, current: null, hero, body: '', showStreet: 'parked', noindex: true });
}
function contactPhp() {
  return `<?php
// Receives the contact form. Generated by build.mjs; edit it there.
${mailerPhp()}
$TO = ${JSON.stringify(cfg.contactEmail)};
$SITE = ${JSON.stringify(cfg.siteName)};

function fail($msg, $code) {
  http_response_code($code);
  header('Content-Type: text/html; charset=utf-8');
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not sent</title><link rel="stylesheet" href="../assets/site.css${CSS_V}"></head><body><main class="wrap"><h1>That did not send</h1><p>' . htmlspecialchars($msg, ENT_QUOTES, 'UTF-8') . '</p><p><a href="./">Go back and try again</a></p></main></body></html>';
  exit;
}
function field($key, $max) {
  $v = (isset($_POST[$key]) && is_string($_POST[$key])) ? trim($_POST[$key]) : '';
  $v = str_replace(chr(0), '', $v);
  return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}
function one_line($v) {
  return trim(preg_replace('/[\\r\\n\\t]+/', ' ', $v));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header('Location: ./', true, 303);
  exit;
}
// A hidden field people never see. If it is filled in, a bot did it: act as if it worked.
if (field('company', 200) !== '') {
  header('Location: thanks/', true, 303);
  exit;
}
$name = one_line(field('name', 100));
$email = one_line(field('email', 150));
$topic = one_line(field('topic', 60));
$message = field('message', 4000);
if ($message === '') fail('Please write a message.', 400);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Please add your email address, so we can write back.', 400);
if (substr_count(strtolower($message), 'http') > 4) fail('That has too many links for us to accept. Please trim it and try again.', 400);
// At most 5 messages from one address in an hour.
$file = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-contact-times.json';
$who = substr(hash('sha256', isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : ''), 0, 16);
$times = @json_decode((string) @file_get_contents($file), true);
if (!is_array($times)) $times = array();
$recent = array();
foreach ($times as $k => $list) { if (!is_array($list)) continue; $keep = array(); foreach ($list as $t) { if (is_int($t) && $t > time() - 3600) $keep[] = $t; } if ($keep) $recent[$k] = $keep; }
if (isset($recent[$who]) && count($recent[$who]) >= 5) fail('That’s a lot of messages in an hour. Please try again later, or email ' . $TO . '.', 429);
$recent[$who][] = time();
@file_put_contents($file, json_encode($recent), LOCK_EX);

$body = "Topic: $topic\\n" . "Name: $name\\n" . "Email: $email\\n\\n" . "Message:\\n$message\\n";
$subject = one_line("[$SITE] Contact: $topic" . ($name !== '' ? " ($name)" : ''));
$headers = array('From: ' . $SITE . ' <' . $TO . '>', 'Reply-To: ' . $email, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8');
$sent = pas_postmark($SITE, $TO, $TO, $subject, $body, '', isset($email) ? (string) $email : '') === 1 || @mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\\r\\n", $headers));
$log = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-suggestions.log';
$saved = @file_put_contents($log, date('c') . ($sent ? ' (emailed)' : ' (EMAIL FAILED)') . "\\n" . $body . "----\\n", FILE_APPEND | LOCK_EX);
if (!$sent && $saved === false) fail('Something went wrong on our side. Please email ' . $TO . ' instead.', 500);
header('Location: thanks/', true, 303);
exit;
`;
}

// ---------- days off: when district schools are closed, and who runs something ----------
// ---------- a page for each day, or break, that school is closed ----------
// One page per entry on the district's calendar that is still to come: who has posted a camp for it, who runs camps
// on days off but hasn't posted this one, and the way to the planner. People look these up by name and date
// ("Election Day camp"), so each gets its own address. A day nobody has posted a camp for is kept out of the index;
// once a day has passed its address is sent to the days-off page (.htaccess).
const fullDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const monthDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
function dayOffPage(d) {
  const D = 2;
  const one = d.dates.length === 1;
  const open = campsOn(d), rest = campPrograms.filter(p => !open.includes(p));
  const label = dayLabel(d), year = d.date.slice(0, 4);
  const when = d.end ? `${monthDay(d.date)} to ${monthDay(d.end)}` : fullDay(d.date);
  const i = offDays.indexOf(d), prev = offDays[i - 1], next = offDays[i + 1];
  const short = x => x.end ? `${shortDate(x.date)} – ${shortDate(x.end)}` : dayDate(x.date);
  const shaped = open.map(p => shapeFor('off', p));
  const cards = open.map((p, i) => {
    const mine = p.daysOff.dates.filter(x => d.dates.includes(x));
    const served = servedBy(p), o = p.daysOff;
    const ages = o.ageMin && o.ageMax ? `${o.ageMin}–${o.ageMax}` : o.ageMin ? `${o.ageMin} and up` : o.ageMax ? `up to ${o.ageMax}` : '';
    return `<article class="prog offprog" id="${esc(p.id)}" ${itemAttrs(shaped[i], [...programHoods(p), ...served.map(s => s.shortName)])}>
  <div class="top"><h3><a href="${link(programPath(p), D)}">${esc(fullName(p))}</a></h3><p class="tags">${p.types.map(t => `<span class="tag" style="--tc:${TYPE[t].color}">${esc(TYPE[t].label)}</span>`).join('')}</p></div>
  <dl>${o.hours ? `<dt>Hours</dt><dd>${esc(o.hours)}</dd>` : ''}
  ${o.cost ? `<dt>Cost</dt><dd>${esc(o.cost)}</dd>` : ''}
  ${ages ? `<dt>Ages</dt><dd>${esc(ages)}</dd>` : ''}
  <dt>What it runs</dt><dd>${esc(p.daysOff.summary)}</dd>
  ${one ? '' : `<dt>Days it has posted</dt><dd>${esc(mine.map(shortDate).join(', '))}${mine.length < d.dates.length ? `, ${mine.length} of the ${d.dates.length} weekdays` : ', every weekday of the break'}.</dd>`}
  ${programAddress(p) ? `<dt>Where</dt><dd>${esc(programAddress(p))}</dd>` : ''}
  ${served.length ? `<dt>On school days</dt><dd>${esc(servedSummary(p))}.</dd>` : ''}</dl>
  <div class="actions"><a class="btn primary needs-js" href="${link(offPath, D)}?add=${esc(p.id)}#d-${mine.sort()[0] || d.dates[0]}">${one ? T(`Save to your plan for {day}`, { day: shortDate(d.date) }) : T(`Save to your plan for the break`)}</a><a class="btn" data-track="camp" href="${esc(outUrl(p.daysOff.url, { type: 'camp', program: p }))}" target="_blank" rel="noopener">${T(`Sign up on the camp’s site`)}</a><a class="btn quiet" href="${link(programPath(p), D)}">${T(`Full listing`)}</a></div>
  <p class="src">Checked ${longDate(p.lastVerified)}. Sources: ${sourceLinks(p.daysOff.sources, p)}</p>
</article>`;
  }).join('\n');
  const hero = `    <p class="where"><a href="${link(dayCampsPath, D)}">${T(`Days off from school`)}</a></p>
    <h1>${one ? T(`{name}: camps for the day off`, { name: label }) : T(`{name}: camps for the break`, { name: label })}</h1>
    <p class="lede">${one ? T(`Philadelphia’s district schools are closed on {when}.`, { when }) : T(`Philadelphia’s district schools are closed from {when}.`, { when })} ${open.length ? (open.length === 1 ? T(`One program listed here has posted a camp for it.`) : T(`{n} programs listed here have posted a camp for it.`, { n: open.length })) : T(`No program listed here has posted a camp for it yet.`)}</p>
    ${one ? '' : `<div class="facts"><span><b>${d.dates.length}</b> weekdays off</span></div>`}`;
  const body = `<div style="display:contents">
${d.note ? `<p class="flag">${esc(d.note)}</p>` : ''}
<section class="section" id="open">
  <h2>${open.length ? (one ? T(`Open that day`) : T(`Open during the break`)) : T(`Nothing posted yet`)}</h2>
  ${open.length ? `<p>${T(`A program is listed here only when its own website names this date. Spots fill, so check with the program before you count on one.`)}</p>
${open.length > 2 ? filterBar({ list: shaped, depth: D, show: { grade: false, age: true, day: false, cost: false }, searchLabel: `Looking for a particular camp?`, placeholder: 'A name or a neighborhood, or try art, sports…' }).replace('data-filters', 'data-filters data-noschool data-noun="camp" data-nouns="camps"') + noMatch(D) : ''}
${cards}` : `<p>${T(`None of the programs here that run camps on days off had this date on its website when we checked. Some post their dates a few weeks ahead, so ask the ones below.`)}</p>`}
  <div class="actions"><a class="btn primary needs-js" href="${link(offPath, D)}#d-${d.dates[0]}">${one ? T(`Plan this day for each child`) : T(`Plan the break for each child`)}</a><a class="btn" href="${link(dayCampsPath, D)}#days">${T(`All days off this year`)}</a></div>
</section>
${rest.length ? `<section class="section" id="ask">
  <h2>${T(`Run camps on days off, with this one not posted`)}</h2>
  <p>${T(`These programs run camps on some days school is closed. Their sites didn’t list this date when we checked, so ask.`)}</p>
  <ul class="plain day-rest">
${rest.map(p => `    <li><a href="${link(programPath(p), D)}">${esc(fullName(p))}</a>${programHoods(p).length ? ` <span class="hint">${esc(programHoods(p).join(', '))}</span>` : ''}</li>`).join('\n')}
  </ul>
</section>` : ''}
<section class="notes">
  <h2>${T(`Before you book`)}</h2>
  <ul>
    <li>${T(`These are the School District of Philadelphia’s dates. Charter and private schools set their own calendars, so check yours.`)}</li>
    <li>${T(`Hours, prices and ages are on each program’s own page. Confirm with the program before you count on a spot.`)}</li>${ALERTS ? `
    <li>${T(`Want a heads-up before each day off?`)} <a href="${link(alertsPath, D)}">${T(`Get them by email.`)}</a></li>` : ''}
  </ul>
  <p class="day-nav">${prev ? `<a href="${link(dayPath(prev), D)}">← ${esc(short(prev))}: ${esc(dayLabel(prev))}</a>` : ''}${prev && next ? ' ' : ''}${next ? `<a href="${link(dayPath(next), D)}">${esc(short(next))}: ${esc(dayLabel(next))} →</a>` : ''}</p>
  <p class="src">Calendar: <a href="${esc(daysOff.source.url)}" target="_blank" rel="noopener">${esc(daysOff.source.label)}</a>, ${esc(daysOff.schoolYear)}, checked ${longDate(daysOff.checked)}.</p>
</section>
</div>`;
  const generic = /professional development|conferences/i.test(d.name);
  const title = d.end ? `${label} camps in Philadelphia, ${shortDate(d.date)} to ${shortDate(d.end)}` : generic ? `No school ${monthDay(d.date)}, ${year}: day camps in Philadelphia` : `${label} ${year}: day camps in Philadelphia (${shortDate(d.date)})`;
  const description = open.length
    ? `${open.length} day ${open.length === 1 ? 'camp' : 'camps'} listed for ${label}, ${when}, ${year}, when Philadelphia district schools are closed: what each runs, where it is and how to sign up.`
    : `Philadelphia district schools are closed for ${label}, ${when}, ${year}. No listed program has posted a camp for it yet; see which ones run camps on days off.`;
  const url = `${cfg.siteUrl}/${dayPath(d)}`;
  return layout({
    title, description, pathName: dayPath(d), depth: D, current: dayCampsPath, hero, body, showStreet: 'dayoff', noindex: !open.length,
    jsonLd: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'ItemList', name: `${label}: day camps`, itemListElement: open.map((p, n) => ({ '@type': 'ListItem', position: n + 1, name: fullName(p), url: `${cfg.siteUrl}/${programPath(p)}` })) },
      { '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Days off from school', `${cfg.siteUrl}/${dayCampsPath}`], [label, url]].map(([name, item], n) => ({ '@type': 'ListItem', position: n + 1, name, item })) },
    ] },
  });
}

// The days off: every weekday still to come that school is closed, who has posted a camp for each, the chart of
// both, and a card for each program that runs something. Two pages share them: the day-camps page (where = 'page'),
// which is the public, searchable one, and the planner, which keeps the chart as its "Who's open" view (where = 'plan').
function daysOffBits(D, where) {
  const noDates = campPrograms.filter(p => !p.daysOff.dates.some(x => x >= TODAY));
  const dated = campPrograms.filter(p => p.daysOff.dates.some(x => x >= TODAY));
  // every weekday still to come that school is closed, each with the break it belongs to and who has posted a camp for it
  const days = offDays.flatMap((d, bi) => d.dates.filter(x => x >= TODAY).map(x => ({ d: x, label: dayDate(x), name: d.name, b: bi, note: d.note || '', camps: campPrograms.filter(p => p.daysOff.dates.includes(x)).map(p => p.id) })));
  const head = days.map((x, i) => { const dt = utcDay(x.d); return `<th scope="col" data-w="${i}" title="${esc(x.name)}"><span>${MONTH_NAMES[dt.getUTCMonth()].slice(0, 3)}</span><b>${dt.getUTCDate()}</b><span class="vh">, ${esc(x.name)}</span></th>`; }).join('');
  const chartRows = dated.map(p => `<tr data-camp="${esc(p.id)}">
  <th scope="row"><a href="${where === 'page' ? '' : link(dayCampsPath, D)}#${esc(p.id)}">${esc(p.name)}</a><small>${esc([programHoods(p).join(', '), `${p.daysOff.dates.filter(x => x >= TODAY).length} posted`].filter(Boolean).join(' · '))}</small></th>
  ${days.map((x, i) => x.camps.includes(p.id) ? `<td class="on exact" data-w="${i}"><span class="vh">Open</span></td>` : `<td data-w="${i}"></td>`).join('')}
</tr>`).join('\n');
  const cards = campPrograms.map(p => listRow('off', p, D)).join('\n');   // one row each, like every other list
  const chartSection = `<section class="section sum-chart-section${where === 'page' ? '' : ' when-in'}" id="chart" data-jump-to="Who’s open">
  <h2>${T(`Who’s open each day off`)}</h2>
  <div class="off-chart-block" id="off-chart-block">
  <p>${T(`Each column is a day district schools are closed. A filled box means the program’s own site lists a camp that day. The chart scrolls sideways.`)} ${where === 'page' ? '' : `<span class="needs-js${GATE ? ' when-in' : ''}">${T(`Tap a box to put that day in your plan.`)}</span>`}</p>
  <p class="sum-key"><span><i class="k exact"></i>${T(`Camp posted`)}</span>${where === 'page' ? '' : `<span class="needs-js${GATE ? ' when-in' : ''}"><i class="k picked"></i>${T(`In your plan`)}</span>`}</p>
  <p class="hint" id="off-chart-note" aria-live="polite"></p>
  ${dated.length ? `<div class="sum-chart-wrap" role="region" aria-label="Who’s open each day off" tabindex="0">
    <table class="sum-chart off-chart">
      <thead><tr><th scope="col">Program</th>${head}</tr></thead>
      <tbody>
${chartRows}
      </tbody>
    </table>
  </div>` : `<p class="hint">${T(`No listed program has posted a camp date yet.`)}</p>`}
  </div>
</section>
`;
  return { noDates, dated, days, chartSection, cards };
}
const offFacts = () => `<div class="facts">
      <span>School year <b>${esc(daysOff.schoolYear)}</b></span>
      <span>Calendar checked <b>${longDate(daysOff.checked)}</b></span>
      <span><b>${offDays.reduce((n, d) => n + d.dates.filter(y => y >= TODAY).length, 0)}</b> days off to come</span>
      <span><b>${campPrograms.length}</b> programs run something</span>
    </div>`;
// /day-camps/: who's open each day off, the days themselves, and who runs camps. The page people find from search.
// The "Get a heads-up before each day off" box: the follow box for the days-off round-up (or the plain sign-up form
// before accounts). Not on the day-camps page any more; kept for wherever it goes next.
const headsUpBox = D => datesBox(D, { pick: true, place: 'days_off', cls: 'wide', title: T(`Get a heads-up before each day off`), lede: T(`An email at least {n} days ahead, with the listed programs running a camp that day.`, { n: LEAD.dayoff }), hint: T(`Sign-up dates reach you the morning after they’re posted here, then again the day before and at about 8 that morning. Days off come in a {day} round-up.`, { day: SEND_DAY_NAME }), old: { place: 'days_off', title: T(`Get a heads-up before each day off`), lede: T(`An email at least {n} days ahead, with the listed programs running a camp that day.`, { n: LEAD.dayoff }) } });
// /day-camps/: the programs that run something on days off, first, with the filters; the district's days as a second
// view of the same page. The "Who's open each day off" chart (daysOffBits().chartSection) and the heads-up box
// (headsUpBox) are built elsewhere for the planner and for wherever they go next.
function dayCampsPage() {
  const D = 1;
  const { noDates } = daysOffBits(D, 'page');
  const dc = typeSections('off', campPrograms, D);
  const hero = `    <p class="where"><a href="${link('all-programs/', D)}"><span aria-hidden="true">←</span> ${T(`Back to all programs`)}</a></p>
    <h1>${T(`School’s closed. What now?`)}</h1>
    <p class="lede">${T(`Who runs a camp or a full day when district schools are closed, by neighborhood, and every day off this year.`)}</p>${heroGo(D, link(offPath, D), T(`Plan the days off`))}
    ${offFacts()}
    ${dc.pills}`;
  const body = `<div style="display:contents">
${pageNav(`<div class="tabs view-switch page-views" id="off-page-views" role="group" aria-label="Programs or days" data-views="who">
  <button type="button" class="tab vs" data-view="who" aria-pressed="true">${T(`Programs`)}</button><button type="button" class="tab vs" data-view="days" aria-pressed="false">${T(`The days`)}</button>
</div>`, jumpNav())}
<section class="section" id="who" data-pane="who">
  <h2>${T(`Who runs something when school is closed`)}</h2>
  <p>${T(`{n} listed programs say they run camps or full days on days off. Children from any school can go, so start from your part of the city. {m} of them had no dates on their site when we checked, so ask which days they cover.`, { n: campPrograms.length, m: noDates.length })}</p>
  ${filterBar({ list: campPrograms.map(p => shapeFor('off', p)), depth: D, show: { grade: false, age: true, day: false }, searchLabel: `Looking for a particular program?`, placeholder: 'A name or a neighborhood, or try art, chess…' }).replace('data-filters', 'data-filters data-noschool')}
  ${noMatch(D)}
  ${dc.sections}
</section>
<section class="section" id="days" data-pane="days">
  <h2>${T(`Days off still to come`)}</h2>
  <p>${T(`These are the School District of Philadelphia’s dates. A program is counted only when its own site lists that date.`)}</p>
  <ul class="plain off-dates">
${offDays.map(d => { const n = campsOn(d).length; return `    <li data-until="${d.until}"><a href="${link(dayPath(d), D)}"><b>${d.end ? `${shortDate(d.date)} – ${shortDate(d.end)}` : dayDate(d.date)}</b> <span>${esc(d.name)}</span></a> <span class="pill ${n ? 'onsite' : 'nearby'}">${n ? `${n} ${n === 1 ? 'camp' : 'camps'} posted` : 'None posted yet'}</span>${d.note ? ` <span class="hint">${esc(d.note)}</span>` : ''}</li>`; }).join('\n')}
  </ul>
  <p class="src">Calendar: <a href="${esc(daysOff.source.url)}" target="_blank" rel="noopener">${esc(daysOff.source.label)}</a></p>
</section>
<section class="section" id="plan-it">
  <h2>${T(`Plan each day off`)}</h2>
  <p>${T(`Choose where each child will be on each day school is closed, as a list or on a calendar, and tick each camp off as you sign up.`)}</p>
  <p><a class="btn primary" href="${link(offPath, D)}">${T(`Plan the days off`)}</a></p>
</section>
<section class="notes"><section class="notes">
  <h2>${T(`Before you count on it`)}</h2>
  <ul>
    <li>${T(`Expect to drop your child off. Several programs say there is no school pickup on a day school is closed.`)}</li>
    <li>${T(`A camp day is usually booked and paid for on its own, separate from after-school.`)}</li>
    <li>${T(`The district’s calendar lists no early-dismissal days for students this year. If your school sends children home early, ask the program what it does.`)}</li>
    <li>${T(`Charter schools keep their own calendars, so their days off can differ from these.`)}</li>
    <li>${T(`Know a program that runs on days off and isn’t here?`)} <a href="${link('suggest/', D)}">${T(`Tell us.`)}</a></li>
  </ul>
</section>
</div>`;
  return layout({
    title: `Day camps for days off school in Philadelphia`,
    description: `The after-school programs that run a camp or full-day care when School District of Philadelphia schools are closed in ${daysOff.schoolYear}, by neighborhood and age, and every day off this year.`,
    pathName: dayCampsPath, depth: D, current: dayCampsPath, hero, body, showStreet: 'dayoff',
    shareImage: { file: 'share-days-off.png', alt: `${cfg.siteName} day-off programs: a park on a morning with no school, a kite going up and a school bus parked` },
    jsonLd: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Day-camp programs', `${cfg.siteUrl}/${dayCampsPath}`]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
  });
}
// /days-off/: the planner. Signed out, a tour of it; signed in, the plan, with the chart as one of its views.
function daysOffPage() {
  const D = 1;
  const { days, chartSection } = daysOffBits(D, 'plan');
  const hero = `    <h1>${T(`Plan the days off`)}</h1>
    <p class="lede">${T(`Choose where each child will be on every day school is closed, see who’s open on each, and tick off each camp as you sign up.`)}</p>${heroCta(D, 'daysoff')}
    ${offFacts()}`;
  const planData = {
    year: +String(daysOff.schoolYear).slice(0, 4), schoolYear: daysOff.schoolYear,
    programs: Object.fromEntries(campPrograms.map(p => [p.id, { name: p.name, url: p.daysOff.url, go: outUrl(p.daysOff.url, { type: 'camp', program: p }), href: link(programPath(p), D), color: TYPE[p.types[0]].color, hood: programHoods(p).join(', '), n: p.daysOff.dates.filter(x => x >= TODAY).length }])),
    todo: YEAR_PAGE ? link('to-do/', D) : '', site: cfg.siteUrl, qr: cardQr?.dayoff && cardQr.dayoff.text.toLowerCase().startsWith(cfg.siteUrl.toLowerCase() + '/') ? cardQr.dayoff.rows : null,
    days: days.map(({ note, ...x }) => x),
    page: `${cfg.siteUrl}/${offPath}`,
  };
  const body = `<div style="display:contents">
${jumpNav()}
<section class="section sum offsum needs-js-block${GATE ? ' gated' : ''}" id="plan" data-jump-to="Your plan" data-off-plan data-clarity-mask="true">
  <h2${gateIn}>${T(`Your days off`)}</h2>
  ${planShow('off', D)}
  <div${gateIn} style="display:contents">
  <p>${GATE ? T(`Choose where each child will be on each day school is closed. Your picks are saved on this device and in your profile, so they’re there on your other devices.`) : T(`Choose where each child will be on each day school is closed. Your picks are saved on this device and nowhere else.`)}</p>
  <div class="sum-kids"><div class="kids" id="off-kids" role="group" aria-label="Which child"></div><button type="button" class="clear" id="off-kid-add">Add a sibling</button><button type="button" class="clear" id="off-kid-drop" hidden>Remove this child</button></div>
  <div class="sum-top off-top">
    <div class="field sum-name"><label for="off-name">${T(`First name (optional)`)}</label>
      <input id="off-name" type="text" maxlength="40" autocomplete="off"><span class="hint">${GATE ? T(`Kept with the plan in your profile. A nickname or an initial is fine.`) : T(`Stays on this device.`)}</span></div>
    <div class="sum-tally"><div class="sum-strip" id="off-strip" aria-hidden="true"></div><p id="off-count" aria-live="polite"></p><p class="hint" id="off-open"></p><p class="off-todo-line" id="off-todo-line" aria-live="polite"></p></div>
  </div>
  <div class="year-view-head off-view-head">
    <h3 id="off-view-h">${T(`Day by day`)}</h3>
    <span class="vs-pick" aria-hidden="true">${T(`Pick your visual mode!`)}<svg viewBox="0 0 48 24" focusable="false"><path d="M2 4c10 0 18 4 26 12l6 6M34 14v8h-8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    <div class="tabs view-switch board-views" id="off-views" role="group" aria-label="How to show the days">
      <button type="button" class="tab vs" data-view="list" aria-pressed="true">${T(`List`)}</button><button type="button" class="tab vs" data-view="cal" aria-pressed="false">${T(`Calendar`)}</button><button type="button" class="tab vs" data-view="chart" aria-pressed="false">${T(`Grid`)}</button><button type="button" class="tab vs" data-view="card" aria-pressed="false"><span class="vs-long">${T(`Share/Save`)}</span><span class="vs-short" aria-hidden="true">${T(`Share`)}</span></button>
    </div>
  </div>
  <div class="year-cal off-month" id="off-month" hidden></div>
  <div class="off-chart-slot" id="off-chart-slot" hidden></div>
  <ol class="sum-weeks off-days" id="off-days"></ol>
  <p class="hint share-empty" id="off-share-empty" hidden>${T(`Pick a camp or a day at home first. Then this is where you share the plan, add it to your calendar, make a picture of it and keep it in your profile.`)}</p>
  <div class="actions sum-tools" id="off-tools" hidden><button type="button" class="btn primary" id="off-share-text" hidden>Share the plan</button><button type="button" class="btn" id="off-cal">Add to calendar</button><button type="button" class="btn" id="off-copy">Copy the plan as text</button><button type="button" class="btn" id="off-print-list">Print the list</button><button type="button" class="clear" id="off-clear">Clear the plan</button></div>
  <p class="hint" id="off-status" aria-live="polite"></p>
  ${GROUPS ? `<div class="sum-profile" id="off-profile" ${groupsAttrs(D)} hidden></div>` : ''}
  <div class="card-maker sumcard" id="off-card" hidden>
    <h3>${T(`Make it a calendar`)}</h3>
    <p>${T(`One picture of every day off, or a calendar for each month, to print for the fridge or send to a sitter. Every child with a day planned is on it.`)}</p>
    <div class="card-grid">
      <div class="card-fields">
        <div class="sum-pages" id="off-pages" role="group" aria-label="Which calendar"></div>
        <div class="field">
          <label for="off-title">${T(`Title`)}</label>
          <input id="off-title" type="text" maxlength="40" placeholder="Our days off" autocomplete="off">
        </div>
        <div class="field">
          <label for="off-photo">${T(`A photo (optional)`)}</label>
          <input id="off-photo" type="file" accept="image/*">
          <span class="hint">${T(`The photo never leaves this device. The calendar is made here in your browser, nothing is uploaded, and the photo isn’t saved.`)}</span>
          <button type="button" class="clear" id="off-photo-clear" hidden>Remove the photo</button>
        </div>
        <div class="actions">
          <button type="button" class="btn primary" id="off-share" hidden>Share the calendar</button>
          <button type="button" class="btn" id="off-copy-pic" hidden>Copy picture</button>
          <button type="button" class="btn" id="off-save">Save as image</button>
          <button type="button" class="btn" id="off-save-all">Save all of them</button>
          <button type="button" class="btn" id="off-print">Print</button>
        </div>
        <p class="hint" id="off-card-status" aria-live="polite"></p>
      </div>
      <div class="card-preview"><canvas id="off-canvas" width="1080" height="1350" role="img" aria-label="Preview of the days-off calendar"></canvas></div>
    </div>
  </div>
  </div>
  <script type="application/json" id="off-data">${JSON.stringify(planData).replace(/</g, '\\u003c')}</script>
</section>
${chartSection}
<section class="section" id="more">
  <p><a class="btn" href="${link(dayCampsPath, D)}">${T(`Every day off this year, and who runs camps`)}</a></p>
  <p class="hint">${T(`Dates come from each program’s own website. Check with the program before you count on a spot.`)}</p>
</section>
</div>`;
  return layout({
    title: `Plan the days off school`,
    description: `A free planner for the days School District of Philadelphia schools are closed in ${daysOff.schoolYear}: where each child will be, who’s open, and what’s left to sign up for.`,
    pathName: offPath, depth: D, current: offPath, hero, body, next: GATE ? 'daysoff' : '', showStreet: 'dayoff', scripts: GROUPS ? groupsScript(D) : '',
    shareImage: { file: 'share-days-off.png', alt: `${cfg.siteName} day-off programs: a park on a morning with no school, a kite going up and a school bus parked` },
  });
}

// ---------- share groups (accounts, class codes) ----------
// "groups" in site.config.json turns them on. While "pilot" is true nothing links to them: the pages exist at
// /account/ and /groups/, and the block on the roster page only shows in a browser that has visited one of them.
// Premium listings: "off" (nothing anywhere), "preview" (only the people who hold a premium listing see its premium
// side, so it can be set up before it is public) or "on". PAS_PREMIUM overrides the setting for a test build.
const premiumMode = v => v === true || v === 'on' ? 'on' : v === 'preview' ? 'preview' : 'off';
const GROUPS = cfg.groups && cfg.contactEmail ? { premium: premiumMode(process.env.PAS_PREMIUM || cfg.groups.premium), photos: cfg.groups.photos === true || process.env.PAS_PHOTOS === '1', pilot: cfg.groups.pilot !== false, klaviyoList: cfg.groups.klaviyoList || '', google: /^[0-9a-z-]+\.apps\.googleusercontent\.com$/.test(cfg.groups.googleClientId || '') ? cfg.groups.googleClientId : '' } : null;
// What a premium listing costs, and where it is paid for. The prices are whole dollars: "month" and "year" are what
// is charged now, "laterMonth" and "laterYear" the regular price a founding price gives way to (leave them out and
// nothing is said about a later price). "premiumPay" holds two Stripe Payment Links, made in Stripe by the owner: a
// link is a public address, not a key. Until both are there, signing up charges nothing and only tells the owner.
const PM_PRICE = (() => {
  const p = cfg.groups && cfg.groups.premiumPrice;
  if (!GROUPS || GROUPS.premium === 'off' || !p) return null;
  const whole = n => Number.isInteger(n) && n > 0 && n < 10000;
  if (!whole(p.month) || !whole(p.year) || (p.laterMonth !== undefined && !whole(p.laterMonth)) || (p.laterYear !== undefined && !whole(p.laterYear))) { console.error('\n' + 'site.config.json: groups.premiumPrice needs "month" and "year" in whole dollars ("laterMonth" and "laterYear" are optional)' + '\n'); process.exit(1); }
  return { month: p.month, year: p.year, laterMonth: p.laterMonth || 0, laterYear: p.laterYear || 0 };
})();
// The premium sign-up page is listed (linked from the managers page, in the sitemap, open to search engines) once
// premium is on for everyone. While premium is only being tried out ("preview"), it is reached by its address alone.
const PM_LISTED = !!PM_PRICE && GROUPS.premium === 'on' && !PREVIEW;
const PM_PAY = (() => {
  const env = (process.env.PAS_PM_PAY || '').split(',');   // a test build: "monthly link,yearly link"
  const p = process.env.PAS_PM_PAY === 'off' ? {} : env.length === 2 ? { month: env[0], year: env[1] } : (cfg.groups && cfg.groups.premiumPay) || {};   // "off": a test build with no links
  const ok = u => /^https:\/\/(buy|book)\.stripe\.com\/[A-Za-z0-9_\/-]{6,120}$/.test(u || '');
  if ((p.month || p.year) && !(ok(p.month) && ok(p.year))) { console.error('\n' + 'site.config.json: groups.premiumPay needs two Stripe Payment Links, "month" and "year", each starting https://buy.stripe.com/' + '\n'); process.exit(1); }
  if (ok(p.month) && ok(p.year) && GROUPS && GROUPS.premium === 'preview') console.warn('\nNote: premium is set to "preview" and has payment links: a program would be paying for extras that only it can see. Switch premium to "on" before sharing the sign-up page.');
  return ok(p.month) && ok(p.year) ? { month: p.month, year: p.year } : null;
})();
// Every planner (the week, the days off, the summer, the calendar) needs a free account. Signed out, a short ask stands
// where the planner would be; the pages themselves stay public. "plannersNeedAccount": false under "groups" in
// site.config.json opens them again. The preview has no accounts to sign in to, so nothing is closed there.
const GATE = !!GROUPS && !PREVIEW && cfg.groups.plannersNeedAccount !== false;
const gateIn = GATE ? ' class="when-in"' : '';
// ---------- what each planner looks like, for someone who hasn't signed in ----------
// A made-up family's plan, drawn here and marked "Example", shown beside the ask on each planner's own page. The
// programs and camps in it are invented on purpose: a real listing shown here would be singled out over the others.
// The dates are real (the next days off, the summer's weeks), so the example reads like this year.
const EX = { chess: '#B4237A', sport: '#1F7A3A', art: '#C2410C', care: '#0F4D90', music: '#6B3FA0', nature: '#4D6B1F', stem: '#0E7C86', home: '#4D607A' };
function planExample(kind) {
  const tag = `<span class="ex-tag">${T(`Example`)}</span>`;
  const kids = `<span class="ex-kids" aria-hidden="true"><i class="on">Sam</i><i>Rae</i></span>`;
  const chip = (text, color, small) => `<span class="ex-chip" style="--tc:${color}">${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}</span>`;
  const todo = `<span class="ex-chip todo">${T(`Not planned yet`)}</span>`;
  if (kind === 'week') {
    const days = [['Mon', [['Chess club', EX.chess, '3:15 to 4:30']]], ['Tue', [['Soccer', EX.sport, 'Picks up at dismissal']]], ['Wed', [['Art studio', EX.art, '3:30 to 5:00']]],
      ['Thu', [['Chess club', EX.chess, '3:15 to 4:30'], ['Piano lesson', EX.music, '5:15']]], ['Fri', [['Aftercare at school', EX.care, 'Until 6:00']]]];
    return `<figure class="ex ex-week" aria-label="An example of a week made with the week builder">
      <figcaption>${tag}<b>${T(`Sam’s week`)}</b>${kids}</figcaption>
      <ol class="ex-days">${days.map(([d, picks]) => `<li><b>${d}</b>${picks.map(([n, c, t]) => chip(n, c, t)).join('')}</li>`).join('')}</ol>
      <p class="ex-foot">${T(`Each child gets their own week. It adds up what the week costs, and makes one picture to text to a sitter.`)}</p>
    </figure>`;
  }
  if (kind === 'off') {
    const next = offDays.filter(d => (d.end || d.date) >= TODAY).slice(0, 4);
    const picks = [chip('Day camp at the art studio', EX.art, 'Camp posted for this day'), chip('At home or with family', EX.home), chip('Soccer day camp', EX.sport, 'Camp posted for this day'), todo];
    return `<figure class="ex ex-rows" aria-label="An example of a days-off plan">
      <figcaption>${tag}<b>${T(`Sam’s days off`)}</b>${kids}</figcaption>
      <ol class="ex-list">${next.map((d, i) => `<li><span class="ex-when"><b>${d.end ? `${shortDate(d.date)} – ${shortDate(d.end)}` : dayDate(d.date)}</b><small>${esc(dayLabel(d))}</small></span>${picks[i]}</li>`).join('')}</ol>
      <p class="ex-foot">${T(`Every day school is closed this year is on the list, as a list or on a calendar, with who has posted a camp for each.`)}</p>
    </figure>`;
  }
  if (kind === 'sum') {
    const P = summerPlan, weeks = P.weeks.slice(1, 6);
    const picks = [chip('Art camp', EX.art, 'About $320'), chip('Nature camp', EX.nature, 'About $290'), todo, chip('Soccer camp', EX.sport, 'About $275') + chip('Coding camp', EX.stem, 'Mornings'), chip('Theater camp', EX.music, 'About $340')];
    return `<figure class="ex ex-rows" aria-label="An example of a summer plan">
      <figcaption>${tag}<b>${T(`Sam’s summer`)}</b>${kids}</figcaption>
      <ol class="ex-list">${weeks.map((w, i) => `<li><span class="ex-when"><b>${esc(P.label(w))}</b></span>${picks[i]}</li>`).join('')}</ol>
      <p class="ex-foot">${T(`Every week from the last day of school to Labor Day, with the camps that run in each and what the summer adds up to.`)}</p>
    </figure>`;
  }
  // the year: one month of squares, drawn with the calendar's own styles
  const ahead = offDays.flatMap(d => d.dates).filter(x => x >= TODAY), count = {};
  ahead.forEach(x => { count[x.slice(0, 7)] = (count[x.slice(0, 7)] || 0) + 1; });
  const mk = Object.keys(count).sort().slice(0, 3).sort((a, b) => count[b] - count[a] || a.localeCompare(b))[0] || TODAY.slice(0, 7);
  const y = +mk.slice(0, 4), mo = +mk.slice(5) - 1, lead = new Date(Date.UTC(y, mo, 1, 12)).getUTCDay(), n = new Date(Date.UTC(y, mo + 1, 0, 12)).getUTCDate();
  const off = new Set(offDays.flatMap(d => d.dates).filter(x => x.slice(0, 7) === mk));
  const iso = d => `${mk}-${String(d).padStart(2, '0')}`, dow = d => new Date(Date.UTC(y, mo, d, 12)).getUTCDay();
  const school = Array.from({ length: n }, (_, i) => i + 1).filter(d => dow(d) > 0 && dow(d) < 6 && !off.has(iso(d)));
  const picture = school[Math.min(3, school.length - 1)], signup = school[Math.min(11, school.length - 1)];
  let nOff = 0;
  const marks = d => off.has(iso(d)) ? [['m-off', 'No school'], nOff++ % 3 === 2 ? ['m-kid m-todo', 'Not planned'] : ['m-kid', nOff % 2 ? 'Sam: Camp' : 'Sam: Home']]
    : [...(dow(d) === 3 && school.includes(d) ? [['m-own', 'Pretzel day']] : []), ...(d === picture ? [['m-own', 'Picture day']] : []), ...(d === signup ? [['m-reg', 'Sign-ups open']] : [])];
  let cells = Array.from({ length: lead }, () => '<td class="cal-pad"></td>');
  for (let d = 1; d <= n; d++) { const m = marks(d); cells.push(`<td${off.has(iso(d)) ? ' class="cal-off"' : ''}><div class="ex-day"><span class="cal-n">${d}</span>${m.length ? `<span class="cal-marks">${m.map(([c, t]) => `<span class="cal-m ${c}">${esc(t)}</span>`).join('')}</span>` : ''}</div></td>`); }
  while (cells.length % 7) cells.push('<td class="cal-pad"></td>');
  const rows = []; for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
  return `<figure class="ex ex-cal" aria-label="An example of a month on My kids’ calendar">
      <figcaption>${tag}<b>${MONTH_NAMES[mo]} ${y}</b>${kids}</figcaption>
      <table class="cal-grid"><thead><tr>${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<th scope="col">${d}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>
      <p class="ex-foot">${T(`Days off, camp weeks, sign-up dates and your own dates on one calendar, month by month.`)}</p>
    </figure>`;
}
// ---------- the planners, for someone who hasn't signed in: a tour of what each one does ----------
// Where a planner would be, a signed-out visitor gets a page about it, the way a product page shows a product: one
// made-up example for each way of looking at the plan (a tab apiece), what it does, three steps, and one thing to
// press, "Create a free account". There is no "Log in" button here: it is at the top of every page, and on these
// pages it comes back to the planner (the layout's `next`). Everything shown is invented and marked "Example".
const SHOW_ICON = {
  kids: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.5"/><path d="M2.5 20c.5-4 2.6-6 5.5-6s5 2 5.5 6M15.2 20c.2-2.8 1.3-4.3 2.8-4.3 1.7 0 2.9 1.5 3.3 4.3"/>',
  tick: '<rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M7.5 12.5l3 3 6-6.5"/>',
  devices: '<rect x="2.5" y="5" width="13" height="9.5" rx="1.5"/><path d="M1 18h14"/><rect x="16.5" y="8" width="6" height="11.5" rx="1.5"/>',
  picture: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5.5-5 3.5 3 3-2.5 4 4"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
  coins: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-.9-1.5-1.4-2.8-1.4-1.7 0-2.9.8-2.9 2.1 0 3 5.9 1.3 5.9 4.3 0 1.3-1.3 2.1-3 2.1-1.4 0-2.5-.6-3-1.5M12 6v1.8M12 16.3V18"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  share: '<path d="M12 15V4M8 7.5l4-4 4 4M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/>',
  chart: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  list: '<path d="M8.5 6.5H21M8.5 12H21M8.5 17.5H21"/><circle cx="4" cy="6.5" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="17.5" r="1.2"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.1"/><circle cx="15.5" cy="8.5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="8.5" cy="15.5" r="1.1"/><circle cx="15.5" cy="15.5" r="1.1"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M7.5 12h9"/>',
  out: '<path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V14M14 4h6v6M20 4l-8.5 8.5"/>',
};
const showIcon = k => `<span class="pshow-ic" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${SHOW_ICON[k]}</svg></span>`;
// The small picture beside each feature row of the tour: a simple drawing, not a screenshot, so a row reads at a
// glance. Drawn in the site's own colors; the accent is the row's --pc.
const MINI = {
  kids: `<rect x="14" y="14" width="56" height="22" rx="11" fill="var(--pc)"/><text x="42" y="30" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">Sam</text><rect x="78" y="14" width="56" height="22" rx="11" fill="#E4EBF4"/><text x="106" y="30" text-anchor="middle" font-size="13" font-weight="700" fill="#0B2140">Rae</text>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="${14 + i * 36}" y="50" width="30" height="56" rx="7" fill="#E4EBF4"/><rect x="${14 + i * 36}" y="${[62, 50, 70, 50, 58][i]}" width="30" height="${[44, 56, 36, 56, 48][i]}" rx="7" fill="${['var(--pc)', '#F3C613', 'var(--pc)', '#2C8444', '#F3C613'][i]}" opacity=".9"/>`).join('')}`,
  card: `<rect x="60" y="6" width="80" height="112" rx="12" fill="#0B2140"/><rect x="66" y="14" width="68" height="96" rx="8" fill="#fff"/><rect x="74" y="22" width="40" height="8" rx="4" fill="#0B2140"/>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="74" y="${38 + i * 14}" width="12" height="8" rx="2" fill="#9AB0CC"/><rect x="90" y="${38 + i * 14}" width="${[36, 28, 36, 22, 30][i]}" height="8" rx="4" fill="${['var(--pc)', '#F3C613', 'var(--pc)', '#2C8444', '#F3C613'][i]}"/>`).join('')}
    <path d="M24 60 h22 m-8 -8 l8 8 -8 8" fill="none" stroke="var(--pc)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  devices: `<rect x="10" y="22" width="112" height="70" rx="8" fill="#0B2140"/><rect x="16" y="28" width="100" height="58" rx="4" fill="#fff"/><rect x="0" y="92" width="132" height="8" rx="4" fill="#0B2140"/>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="${24 + i * 17}" y="${[48, 40, 54, 40, 46][i]}" width="13" height="${[30, 38, 24, 38, 32][i]}" rx="4" fill="${['var(--pc)', '#F3C613', 'var(--pc)', '#2C8444', '#F3C613'][i]}"/>`).join('')}
    <rect x="146" y="10" width="46" height="100" rx="10" fill="#0B2140"/><rect x="151" y="18" width="36" height="84" rx="6" fill="#fff"/>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="${156 + i * 5.4}" y="${[60, 52, 66, 52, 58][i]}" width="4" height="${[34, 42, 28, 42, 36][i]}" rx="2" fill="${['var(--pc)', '#F3C613', 'var(--pc)', '#2C8444', '#F3C613'][i]}"/>`).join('')}`,
  tick: `${[0, 1, 2].map(i => `<rect x="14" y="${12 + i * 36}" width="172" height="28" rx="8" fill="${i < 2 ? '#D6F3D2' : '#E4EBF4'}"/><rect x="22" y="${18 + i * 36}" width="16" height="16" rx="4" fill="${i < 2 ? '#2C8444' : '#fff'}" stroke="${i < 2 ? '#2C8444' : '#9AB0CC'}" stroke-width="2"/>${i < 2 ? `<path d="M25 ${26 + i * 36} l4 4 7 -8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}<rect x="48" y="${22 + i * 36}" width="${[70, 54, 80][i]}" height="8" rx="4" fill="${i < 2 ? '#1F5A22' : '#0B2140'}"/><rect x="${[126, 110, 136][i]}" y="${22 + i * 36}" width="40" height="8" rx="4" fill="${i < 2 ? '#8CC68A' : 'var(--pc)'}"/>`).join('')}`,
  cal: `<rect x="20" y="10" width="160" height="104" rx="10" fill="#fff" stroke="#9AB0CC" stroke-width="2"/><rect x="20" y="10" width="160" height="20" rx="10" fill="#0B2140"/><rect x="20" y="22" width="160" height="8" fill="#0B2140"/>
    ${[...Array(28)].map((_, i) => { const c = i % 7, r = Math.floor(i / 7); const on = [3, 4, 10, 17, 18, 19].includes(i); return `<rect x="${28 + c * 21}" y="${36 + r * 19}" width="17" height="15" rx="3" fill="${on ? 'var(--pc)' : '#E4EBF4'}"/>`; }).join('')}`,
  chart: `${[0, 1, 2].map(r => `<rect x="14" y="${18 + r * 32}" width="40" height="10" rx="5" fill="#0B2140"/>${[...Array(7)].map((_, c) => `<rect x="${62 + c * 18}" y="${14 + r * 32}" width="14" height="18" rx="3" fill="${[[1, 1, 1, 0, 1, 1, 1], [0, 1, 1, 0, 1, 0, 0], [1, 0, 1, 0, 1, 1, 1]][r][c] ? 'var(--pc)' : '#E4EBF4'}"/>`).join('')}`).join('')}<rect x="113" y="6" width="20" height="104" rx="5" fill="none" stroke="#F3C613" stroke-width="3"/>`,
  bell: `<rect x="14" y="30" width="172" height="60" rx="12" fill="#fff" stroke="#9AB0CC" stroke-width="2"/><rect x="26" y="42" width="40" height="36" rx="8" fill="var(--pc)"/><text x="46" y="57" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">NOV</text><text x="46" y="72" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">3</text><rect x="78" y="46" width="76" height="9" rx="4" fill="#0B2140"/><rect x="78" y="62" width="52" height="8" rx="4" fill="#9AB0CC"/><circle cx="168" cy="48" r="12" fill="#F3C613"/><path d="M164 52 h8 m-4 -10 a3 3 0 0 1 3 3 v4 h-6 v-4 a3 3 0 0 1 3 -3z" fill="none" stroke="#5C4700" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  cost: `<rect x="40" y="8" width="120" height="108" rx="8" fill="#fff" stroke="#9AB0CC" stroke-width="2"/>${[0, 1, 2].map(i => `<rect x="52" y="${22 + i * 18}" width="${[48, 36, 56][i]}" height="8" rx="4" fill="#9AB0CC"/><rect x="118" y="${22 + i * 18}" width="30" height="8" rx="4" fill="#0B2140"/>`).join('')}<rect x="52" y="78" width="96" height="2" fill="#9AB0CC"/><rect x="52" y="88" width="44" height="12" rx="4" fill="#0B2140"/><rect x="108" y="86" width="40" height="16" rx="6" fill="var(--pc)"/>`,
  lock: `<rect x="62" y="52" width="76" height="58" rx="12" fill="var(--pc)"/><path d="M78 52 v-14 a22 22 0 0 1 44 0 v14" fill="none" stroke="#0B2140" stroke-width="8" stroke-linecap="round"/><circle cx="100" cy="78" r="8" fill="#fff"/><rect x="97" y="80" width="6" height="14" rx="3" fill="#fff"/>`,
  out: `<rect x="14" y="28" width="120" height="64" rx="12" fill="#fff" stroke="#9AB0CC" stroke-width="2"/><rect x="26" y="42" width="60" height="9" rx="4" fill="#0B2140"/><rect x="26" y="60" width="44" height="8" rx="4" fill="#9AB0CC"/><rect x="100" y="52" width="24" height="24" rx="12" fill="var(--pc)"/><path d="M110 60 l6 4 -6 4" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M140 60 h30 m-10 -10 l10 10 -10 10" fill="none" stroke="var(--pc)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
};
const miniArt = k => `<span class="pshow-mini" aria-hidden="true"><svg viewBox="0 0 200 120" focusable="false">${MINI[k] || MINI.kids}</svg></span>`;
// The one thing to press, under a planner page's heading, for someone signed out.
const heroCta = (depth, next) => GATE ? `
    <p class="hero-cta when-out"><a class="btn primary big" href="${link('register/', depth)}?next=${next}" data-plan-cta="hero">${T(`Create a free account`)}</a><span>${T(`Free, with no password to remember: we email you a code, or you use Google.`)}</span></p>` : '';
// More made-up examples, for the views the short ones above don't cover.
function showExample(kind) {
  const tag = `<span class="ex-tag">${T(`Example`)}</span>`;
  const kids = `<span class="ex-kids" aria-hidden="true"><i class="on">Sam</i><i>Rae</i></span>`;
  const chip = (text, color, small, cls) => `<span class="ex-chip${cls ? ' ' + cls : ''}" style="--tc:${color}">${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}</span>`;
  const ahead = offDays.flatMap(d => d.dates.map(x => ({ d: x, name: dayLabel(d) }))).filter(x => x.d >= TODAY);
  const month = ({ mk, marks, off, label, foot }) => {
    const y = +mk.slice(0, 4), mo = +mk.slice(5) - 1, lead = new Date(Date.UTC(y, mo, 1, 12)).getUTCDay(), n = new Date(Date.UTC(y, mo + 1, 0, 12)).getUTCDate();
    const iso = d => `${mk}-${String(d).padStart(2, '0')}`;
    let cells = Array.from({ length: lead }, () => '<td class="cal-pad"></td>');
    for (let d = 1; d <= n; d++) { const m = marks(iso(d), new Date(Date.UTC(y, mo, d, 12)).getUTCDay()); cells.push(`<td${off(iso(d)) ? ' class="cal-off"' : ''}><div class="ex-day"><span class="cal-n">${d}</span>${m.length ? `<span class="cal-marks">${m.map(([c, t, ink]) => `<span class="cal-m ${c}"${ink ? ` style="--mk:${ink}"` : ''}>${esc(t)}</span>`).join('')}</span>` : ''}</div></td>`); }
    while (cells.length % 7) cells.push('<td class="cal-pad"></td>');
    const rows = []; for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
    return `<figure class="ex ex-cal" aria-label="${esc(label)}">
      <figcaption>${tag}<b>${MONTH_NAMES[mo]} ${y}</b>${kids}</figcaption>
      <table class="cal-grid"><thead><tr>${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<th scope="col">${d}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>
      <p class="ex-foot">${foot}</p>
    </figure>`;
  };
  const chart = ({ label, title, first, cols, rows, picked, foot }) => `<figure class="ex ex-chart" aria-label="${esc(label)}">
      <figcaption>${tag}<b>${title}</b>${kids}</figcaption>
      <div class="ex-chart-in"><table><thead><tr><th scope="col">${first}</th>${cols.map(([a, b]) => `<th scope="col"><span>${esc(a)}</span><b>${esc(b)}</b></th>`).join('')}</tr></thead>
      <tbody>${rows.map(([name, sub, on], r) => `<tr><th scope="row">${esc(name)}<small>${esc(sub)}</small></th>${cols.map((_, c) => { const p = picked.some(([a, b]) => a === r && b === c); return on.includes(c) ? `<td class="on${p ? ' picked' : ''}"><i></i></td>` : '<td></td>'; }).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="ex-foot">${foot}</p>
    </figure>`;
  const monDay = iso => { const d = utcDay(iso); return [MONTH_NAMES[d.getUTCMonth()].slice(0, 3), String(d.getUTCDate())]; };
  if (kind === 'off-list') {
    const next = offDays.filter(d => (d.end || d.date) >= TODAY).slice(0, 4);
    const picks = [chip('Day camp at the art studio', '#2C8444', '✓ Signed up', 'ok'), chip('At home or with family', EX.home), chip('Soccer day camp', '#B88A00', 'Still to sign up', 'need'), `<span class="ex-chip todo">${T(`Not planned yet`)}</span>`];
    return `<figure class="ex ex-rows" aria-label="An example of a days-off plan, as a list">
      <figcaption>${tag}<b>${T(`Sam’s days off`)}</b>${kids}</figcaption>
      <ol class="ex-list">${next.map((d, i) => `<li><span class="ex-when"><b>${d.end ? `${shortDate(d.date)} – ${shortDate(d.end)}` : dayDate(d.date)}</b><small>${esc(dayLabel(d))}</small></span>${picks[i]}</li>`).join('')}</ol>
      <p class="ex-foot">${T(`Every day school is closed this year is on the list, with who has posted a camp for each.`)}</p>
    </figure>`;
  }
  if (kind === 'off-cal') {
    const count = {}; ahead.forEach(x => { count[x.d.slice(0, 7)] = (count[x.d.slice(0, 7)] || 0) + 1; });
    const mk = Object.keys(count).sort().slice(0, 3).sort((a, b) => count[b] - count[a] || a.localeCompare(b))[0] || TODAY.slice(0, 7);
    const off = new Set(offDays.flatMap(d => d.dates).filter(x => x.slice(0, 7) === mk)), order = [...off].sort();
    const state = [['m-kid m-ok', '✓ Art camp', '#2C8444'], ['m-kid m-need', 'Soccer camp', '#B88A00'], ['m-kid', 'At home', '#1763B8'], ['m-kid m-todo', 'Not planned', '#1763B8']];
    return month({ mk, off: x => off.has(x), label: 'An example of a days-off plan, on a calendar', foot: T(`Green is signed up, yellow is still to sign up for, and a dashed day has no plan yet.`),
      marks: x => off.has(x) ? [['m-off', 'No school'], state[order.indexOf(x) % 4]] : [] });
  }
  if (kind === 'off-chart') {
    const cols = ahead.slice(0, 6).map(x => monDay(x.d));
    return chart({ label: 'An example of the chart of who is open on each day off', title: T(`Who’s open each day off`), first: 'Program', cols, picked: [[0, 0], [1, 2]],
      rows: [['Art studio day camp', 'Ages 5–12', [0, 1, 2, 4]], ['Soccer day camp', 'Ages 6–13', [0, 2, 3, 5]], ['Chess and games camp', 'Ages 6–12', [1, 3, 4]], ['Rec center day camp', 'Free', [0, 1, 2, 3, 4, 5]]].map(r => [r[0], r[1], r[2].filter(c => c < cols.length)]),
      foot: T(`A filled box means the program has posted a camp for that day. A dark one is in the plan.`) });
  }
  if (kind === 'sum-cal') {
    const P = summerPlan, mk = `${summerYear}-07`, names = { 1: ['Art camp', EX.art], 2: ['Nature camp', EX.nature], 4: ['Soccer camp', EX.sport], 5: ['Theater camp', EX.music], 6: ['Art camp', EX.art] }, weekOf = {};   // the same summer as the list and the chart
    P.weeks.forEach((w, i) => { for (let n = 0; n < 5; n++) { const d = utcDay(w); d.setUTCDate(d.getUTCDate() + n); weekOf[d.toISOString().slice(0, 10)] = i; } });
    return month({ mk, off: () => false, label: 'An example of a summer plan, on a calendar', foot: T(`Each camp sits on the days it runs, so an open week is easy to spot.`),
      marks: x => { if (weekOf[x] === undefined) return []; const c = names[weekOf[x]]; return c ? [['m-kid', c[0], c[1]]] : [['m-kid m-todo', 'Not planned', '#1763B8']]; } });
  }
  if (kind === 'sum-chart') {
    const P = summerPlan, cols = P.weeks.slice(0, 8).map(monDay);
    return chart({ label: 'An example of the chart of when each camp runs', title: T(`When each camp runs`), first: 'Camp', cols, picked: [[0, 1], [1, 2], [2, 4], [3, 4], [4, 5], [0, 6]],
      rows: [['Art camp', 'Ages 5–12 · $320 a week', [1, 2, 3, 4, 5, 6]], ['Nature camp', 'Ages 6–11 · $290 a week', [0, 1, 2, 3]], ['Soccer camp', 'Ages 6–13 · $275 a week', [2, 3, 4, 5, 6, 7]], ['Coding camp', 'Ages 8–14 · mornings', [3, 4, 5]], ['Theater camp', 'Ages 7–13 · $340 a week', [4, 5, 6, 7]]].map(r => [r[0], r[1], r[2].filter(c => c < cols.length)]),
      foot: T(`Each column is a week, named by its Monday. A dark box is in the plan.`) });
  }
  if (kind === 'week-cost') {
    const rows = [['Chess club', 'Monday and Thursday · $18 a class', 648], ['Soccer', 'Tuesday · $15 a week', 270], ['Art studio', 'Wednesday · $28 a class', 504], ['Piano lesson', 'Thursday · $40 a lesson', 720], ['Aftercare at school', 'Friday · $35 a day', 630]];
    return `<figure class="ex ex-cost" aria-label="An example of what a week adds up to">
      <figcaption>${tag}<b>${T(`What Sam’s week comes to`)}</b>${kids}</figcaption>
      <ul class="ex-cost-list">${rows.map(([n, s, v]) => `<li><span>${esc(n)}<small>${esc(s)}</small></span><b>$${v}</b></li>`).join('')}<li class="total"><span>${T(`Half a school year`)}<small>${T(`18 weeks of school`)}</small></span><b>About $${rows.reduce((t, r) => t + r[2], 0).toLocaleString('en-US')}</b></li></ul>
      <p class="ex-foot">${T(`An estimate from each program’s published prices. It leaves out fees, discounts and financial aid.`)}</p>
    </figure>`;
  }
  if (kind === 'week-share') {
    const days = [['Mon', 'Chess club', EX.chess], ['Tue', 'Soccer', EX.sport], ['Wed', 'Art studio', EX.art], ['Thu', 'Chess club + Piano', EX.music], ['Fri', 'Aftercare at school', EX.care]];
    return `<figure class="ex ex-share" aria-label="An example of a week made into a picture to send">
      <figcaption>${tag}<b>${T(`One picture to send`)}</b></figcaption>
      <div class="ex-share-in">
        <div class="ex-card" aria-hidden="true"><span class="ex-card-brand"><i></i>Philly After School</span><b>Sam’s week</b>${days.map(([d, n, c]) => `<span class="ex-card-row" style="--tc:${c}"><i>${d}</i>${esc(n)}</span>`).join('')}</div>
        <ul class="ex-ways"><li>${T(`Text it to a sitter or the group chat`)}</li><li>${T(`Print it for the fridge or a teacher`)}</li><li>${T(`Or share the week itself with one person, who signs in and always sees the latest`)}</li></ul>
      </div>
    </figure>`;
  }
  if (kind === 'year-list') {
    const add = n => { const d = utcDay(TODAY); d.setUTCDate(d.getUTCDate() + n); while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
    const rows = [...ahead.slice(0, 2).map((x, i) => [x.d, 'No school · ' + x.name, i ? chip('Sam: Soccer day camp', '#B88A00', 'Still to sign up', 'need') : chip('Sam: Day camp at the art studio', '#2C8444', '✓ Signed up', 'ok')]),
      [add(6), 'A date you added', chip('Picture day', '#0F4D90')], [add(13), 'Sign-ups', chip('Chess club: winter sign-ups open', '#CC3000')]].sort((a, b) => a[0].localeCompare(b[0]));
    return `<figure class="ex ex-rows" aria-label="An example of My kids’ calendar, as a list">
      <figcaption>${tag}<b>${T(`Coming up`)}</b>${kids}</figcaption>
      <ol class="ex-list">${rows.map(([d, s, c]) => `<li><span class="ex-when"><b>${dayDate(d)}</b><small>${esc(s)}</small></span>${c}</li>`).join('')}</ol>
      <p class="ex-foot">${T(`The whole year in date order, from this week to Labor Day.`)}</p>
    </figure>`;
  }
  // the to-do list
  const d = ahead.slice(0, 3).map(x => dayDate(x.d));
  return `<figure class="ex ex-todo" aria-label="An example of the to-do list of camps to sign up for">
      <figcaption>${tag}<b>${T(`Camps to sign up for`)}</b>${kids}</figcaption>
      <ul class="ex-todo-list">
        <li><span class="ex-todo-name"><b>Day camp at the art studio</b><small>for Sam · 2 days</small></span><span class="ex-box">${esc(d[0] || 'Tue, Nov 3')}</span><span class="ex-box">${esc(d[1] || 'Wed, Nov 11')}</span><span class="ex-go">${T(`Go to its sign-up page`)}</span></li>
        <li><span class="ex-todo-name"><b>Soccer day camp</b><small>for Rae · 1 day</small></span><span class="ex-box on">${esc(d[2] || 'Mon, Nov 16')}</span><span class="ex-done">${T(`Signed up`)}</span></li>
      </ul>
      <p class="ex-foot">${T(`Putting a camp on your plan doesn’t sign your child up. Each camp day waits here until you tick it.`)}</p>
    </figure>`;
}
function planShow(kind, depth) {
  if (!GATE) return '';
  const offLeft = offDays.reduce((n, d) => n + d.dates.filter(x => x >= TODAY).length, 0);
  const device = ['devices', T(`On your phone and your computer`), T(`Signed in, your plan is in your profile, so it’s there on every device.`)];
  const S = {
    week: { next: 'board', eye: T(`The week builder`), h: T(`See the whole week before it starts`),
      views: [['week', T(`The week`), planExample('week'), T(`Put a program on each afternoon, with its hours and when to pick up. Each child gets a week of their own.`)],
        ['cost', T(`Budget planning`), showExample('week-cost'), T(`The week adds itself up from each program’s published prices, so you see the half-year before you sign up for anything.`)],
        ['share', T(`Share it`), showExample('week-share'), T(`Turn the week into one picture for the group chat or the fridge, or share it with one person who signs in to see it.`)]],
      feats: [['kids', T(`A week for each child`), T(`Each child has their own week, and one for the term that’s coming.`)],
        ['card', T(`A card to text or print`), T(`One picture with each day’s programs and pickup times, made on your phone.`)], device],
      steps: [T(`Pick your school, then add a program to each afternoon.`), T(`Send it to whoever does pickup, or stick it on the fridge.`)] },
    off: { next: 'daysoff', eye: offLeft ? T(`{n} days off still to come this year`, { n: offLeft }) : T(`The day-camp planner`), h: T(`Every day school is closed, covered`),
      views: [['list', 'List', showExample('off-list'), T(`Every day off in order. Choose a camp or a day at home for each child, and tick a day once you’ve signed up.`)],
        ['cal', 'Calendar', showExample('off-cal'), T(`The same plan on a month of squares, so a break with no plan yet stands out before it sneaks up on you.`)],
        ['chart', 'Grid', showExample('off-chart'), T(`One chart of which programs have posted a camp for each day off. Tap a box and that day is in your plan.`)]],
      feats: [['tick', T(`Signed up? Tick it off`), T(`Each camp day waits on a to-do list, with a link to the camp’s sign-up page, until you tick it.`)],
        ['cal', T(`A calendar for the fridge`), T(`One picture of every day off, to print or send to a sitter.`)], device],
      steps: [T(`Choose where each child will be on each day off.`), T(`Tick off each camp as you sign up, and print the calendar.`)] },
    sum: { next: 'summer', eye: T(`{n} weeks of summer`, { n: summerCamps.length ? summerPlan.weeks.length : 0 }), h: T(`The whole summer on one page`),
      views: [['list', 'List', planExample('sum'), T(`Every week from the last day of school to Labor Day. Add a camp to each one, and the plan adds up what the summer costs.`)],
        ['cal', 'Calendar', summerCamps.length ? showExample('sum-cal') : '', T(`Month by month, with each camp on the days it runs and the open weeks easy to spot.`)],
        ['chart', 'Grid', summerCamps.length ? showExample('sum-chart') : '', T(`Which camps run which weeks, on one chart. Tap a box and that week is in your summer.`)]],
      feats: [['chart', T(`See the gaps`), T(`A week with nothing on it stands out, in June rather than the Friday before.`)],
        ['kids', T(`A summer for each child`), T(`Set an age and the camps narrow to the ones that take it.`)],
        ['cost', T(`What the summer adds up to`), T(`A running total from the weekly prices the camps post.`)]],
      steps: [T(`Add a camp to each week, for one child or for each of them.`), T(`Print the summer, or put the weeks in your phone’s calendar.`)] },
    year: { next: 'calendar', eye: 'My kids’ calendar', h: T(`The week, the days off and the summer, in one place`),
      views: [['cal', 'Calendar', planExample('year'), T(`A month at a time: days off, camp weeks, sign-up dates and the dates you add yourself.`)],
        ['list', 'List', showExample('year-list'), T(`Or the same year as a list in date order, to read from the top down.`)]],
      feats: [['bell', T(`Sign-up dates, lined up`), T(`Openings and deadlines for the programs and camps on your plans, on the days they happen.`)],
        ['cal', T(`Your own dates too`), T(`Picture day, a form that’s due: add them and they sit beside everything else.`)],
        ['lock', T(`Private`), T(`No link and no sharing. Only you can open it.`)]],
      steps: [T(`Build a week, plan the days off, plan the summer: any or all.`), T(`Open one calendar and see the whole year.`)] },
    todo: { next: 'todo', eye: 'To do', h: T(`What’s left to sign up for, in one list`),
      views: [['todo', 'To do', showExample('todo'), T(`Plan the days school is closed, and each camp day you pick lands here with a link to that camp’s own sign-up page. Tick it off once you’ve signed up.`)]],
      feats: [['tick', T(`Tick it off`), T(`A day leaves the list when you tick it, and turns green on your plan.`)],
        ['out', T(`Straight to the sign-up page`), T(`Each camp has a link to the page where it takes sign-ups.`)], device],
      steps: [T(`Plan the days off: pick a camp for each day you need one.`), T(`Sign up at each camp, and tick it off here.`)] },
  }[kind];
  const go = where => `<a class="btn big ${where === 'end' ? 'pshow-go' : 'primary'}" href="${link('register/', depth)}?next=${S.next}" data-plan-cta="${where}">${T(`Create a free account`)}</a>`;
  const views = S.views.filter(v => v[2]);
  return `<div class="pshow when-out" data-acct-ask data-pshow="${kind}">
    <div class="pshow-tour">
      <div class="pshow-head">
        <div><p class="pshow-eye">${S.eye}</p><h2>${S.h}</h2></div>
        ${views.length > 1 ? `<div class="pshow-switch"><span class="pshow-switch-label">${T(`See it as`)}</span><div class="tabs view-switch pshow-tabs" role="group" aria-label="Ways to look at it">${views.map(([id, label], i) => `<button type="button" class="tab vs" data-pv="${id}" aria-pressed="${i ? 'false' : 'true'}">${label}</button>`).join('')}</div></div>` : ''}
      </div>
      ${views.map(([id, label, fig, say], i) => { const nx = views[(i + 1) % views.length]; return `<div class="pshow-panel" data-pv="${id}">
        <div class="pshow-say"><b>${label}</b><p>${say}</p>${views.length > 1 ? `<p class="pshow-nextp"><button type="button" class="btn pshow-next" data-pv-next="${nx[0]}">${i + 1 < views.length ? 'Next: ' : 'Back to '}${nx[1]} <span aria-hidden="true">→</span></button></p>` : ''}</div>
        ${fig}
      </div>`; }).join('\n      ')}
    </div>
    <ul class="pshow-rows">
      ${S.feats.map(([ic, h, p], i) => `<li class="pshow-row${i % 2 ? ' flip' : ''}" style="--pc:${['#1763B8', '#6B3FA0', '#2C8444'][i % 3]}">${miniArt(ic)}<div><b>${h}</b><span>${p}</span></div></li>`).join('\n      ')}
    </ul>
    <ol class="pshow-steps">
      <li><b>${T(`Create a free account`)}</b></li>
      <li><b>${T(`Make your plan`)}</b></li>
      <li><b>${T(`Take it with you`)}</b></li>
    </ol>
    <div class="pshow-end">
      <div><b>${T(`It’s free for parents.`)}</b><span>${T(`No password: we email you a code, or you use Google.`)} ${T(`Started a plan on this phone or computer before? Log in at the top of the page.`)}</span></div>
      ${go('end')}
    </div>
  </div>`;
}
const groupsAttrs = depth => `data-groups data-root="${link('', depth) === './' ? '' : link('', depth).replace(/index\.html$/, '')}" data-index="${PREVIEW ? 'index.html' : ''}" data-api="${PREVIEW ? '' : link('groups/api.php', depth)}"${GROUPS.klaviyoList && ALERTS?.klaviyoKey ? ` data-kl-key="${esc(ALERTS.klaviyoKey)}" data-kl-list="${esc(GROUPS.klaviyoList)}"` : ''}${ALERTS ? ` data-dates-key="${esc(ALERTS.klaviyoKey)}" data-dates-list="${esc(ALERTS.listId)}"` : ''}${GROUPS.google && !PREVIEW ? ` data-google="${esc(GROUPS.google)}"` : ''} data-pilot="${GROUPS.pilot ? 1 : 0}"${YEAR_PAGE && !PREVIEW ? ' data-year="1"' : ''}`;
// ---------- directors: which listings can be claimed, and how ----------
// Someone who runs a program claims its listing by signing in with an email address at the listing's own website
// address. That is proof enough for a program with its own site ("match"). Where the address is shared by many
// unrelated people (the city, the school district, a university, a booking or site-builder service) the claim waits
// for the site's owner ("manual"). A school's clubs listing is always manual.
const CLAIM_SHARED = ['philasd.org', 'coursestorm.com', 'jumbula.com', 'hisawyer.com', 'bigcartel.com', 'jackrabbitclass.com', 'squarespace.com', 'wixsite.com', 'wix.com', 'weebly.com', 'godaddysites.com', 'google.com', 'facebook.com', 'instagram.com', 'eventbrite.com', 'linktr.ee', 'mindbodyonline.com', 'recdesk.com', 'freelibrary.org', 'philaymca.org', 'schoolofrock.com', 'github.io', 'business.site', 'square.site', 'carrd.co', 'webflow.io', 'myshopify.com', 'weeblysite.com', 'wordpress.com', 'blogspot.com', 'mailchimpsites.com', 'strikingly.com', 'notion.site', 'sawyer.com', 'campbrainregistration.com', 'ultracamp.com', 'activenetwork.com', 'active.com'];
const baseDomain = u => { const parts = bareHost(u).replace(/:\d+$/, '').toLowerCase().split('.').filter(Boolean); return parts.length >= 2 ? parts.slice(-2).join('.') : parts.join('.'); };
// "pa.us" or "co.uk" is not one organisation's address: a website under one of those is checked by a person too.
const claimMode = (domain, always) => !domain || always || /\.(gov|edu)$/.test(domain) || /^(co|com|org|net|gov|edu|ac|k12|pa|nj|ny|de|md)\.[a-z]{2}$/.test(domain) || CLAIM_SHARED.includes(domain) ? 'manual' : 'match';
// Test listings (data/test-listings.json): pages for the site's owner to try the manager's side on, without touching
// a real program. Each is a program record with two extras: "claimDomain", the email domain that may claim it (the
// claim then stands at once, like any other whose address matches), and "premium": true to make it premium without
// a payment. A school under "schools" makes the test page read like a real program's; the school's page ignores it. They are kept out of the programs list altogether, so no list, count, search, filter, sitemap, alert or
// data file ever sees them: each has only its own page at /programs/<id>/ (marked noindex, linked from nowhere) and
// its place among the listings that can be claimed. On the managers page a name search doesn't find them; signing
// in with an address at the claim domain offers them, as it does for any listing at your own address.
const testListings = (fs.existsSync(path.join(ROOT, 'data/test-listings.json')) && GROUPS && !PREVIEW ? readJson('data/test-listings.json') : []).map(p => {
  const at = `data/test-listings.json, "${p.id || p.name}"`;
  const stop = m => { console.error(`\n${at}: ${m}\n`); process.exit(1); };
  if (!/^[a-z0-9-]+$/.test(p.id || '') || programs.some(x => x.id === p.id)) stop('id must be lowercase letters, numbers and dashes, and not the id of a real program');
  if (!/^[a-z0-9-]+\.[a-z]{2,}$/.test(p.claimDomain || '')) stop('claimDomain must be an email domain, such as example.org');
  for (const f of ['name', 'what', 'hours', 'cost', 'lastVerified', 'register']) if (!p[f]) stop(`missing ${f}`);
  for (const [sid, l] of Object.entries(p.schools || {})) if (!schools.some(s => s.id === sid) || !['onsite', 'pickup', 'nearby'].includes(l?.relation)) stop(`schools: "${sid}" must be a school on the site, with a relation of onsite, pickup or nearby`);
  return { ...p, hidden: true, schools: p.schools || {}, _grades: expandGrades(p.grades), _cls: {} };   // a school here only shapes the test page: the school's own page never lists it
});
// What a program told us itself ("told" on the listing) is its word, not its site's, and it goes stale: after TOLD_DAYS
// the morning job asks the listing's managers, once, whether it still holds. A later told entry covering the same
// fields counts as the answer. "asks" on a listing are questions a check raised (the site says one thing, the program
// said another); each goes to the managers once too. A listing nobody has claimed gets neither email: the monthly
// check's report carries those for the site's owner.
const TOLD_DAYS = 120;
const daysSince = iso => Math.floor((new Date(TODAY + 'T12:00:00Z') - new Date(iso + 'T12:00:00Z')) / 86400000);
const staleTold = p => (p.told || []).filter(t => daysSince(t.on) >= TOLD_DAYS && !(p.told || []).some(u => u.on > t.on && t.fields.every(f => u.fields.includes(f))));
const asksFor = p => [
  ...(p.asks || []).map(a => ({ id: a.id, q: a.question })),
  ...staleTold(p).map(t => ({ id: 'told-' + t.on, q: `On ${longDate(t.on)} you told us: “${t.says}” Is that still right? If anything has changed, reply to this email or propose a change from your listing’s tools, and the listing will be updated.` })),
];
const claimListings = () => Object.fromEntries([
  ...testListings.map(p => ['p:' + p.id, { n: p.name, d: p.claimDomain, m: 'match', h: 1 }]),
  ...programs.map(p => ['p:' + p.id, { n: fullName(p), d: baseDomain(p.website), m: claimMode(baseDomain(p.website), !!p.clubs), ...(reviewsFor(p.id).length ? { r: reviewsFor(p.id).length } : {}), ...(upcomingDates(p).length ? { u: 1 } : {}), ...(asksFor(p).length ? { a: asksFor(p) } : {}) }]),   // r:published reviews, u: a sign-up date still to come (for the emails to its managers)
  ...summerCamps.map(c => ['c:' + c.id, { n: c.name + ' (summer camp)', d: baseDomain(c.website), m: claimMode(baseDomain(c.website)) }]),
]);
// Under a listing: suggest an update (anyone), and claim it (whoever runs it).
// The box at the end of a listing for the people who run it: claim it (free, with a work email), or suggest an
// update. Once the site says the listing is claimed (site.js asks), the box says so instead and keeps the update link.
const listingTools = (key, name, depth, noun) => GROUPS ? `<div class="listing-tools claim-cta" data-claim-cta="${esc(key)}">
      <div class="claim-cta-say">
        <b class="claim-cta-h when-free">${noun === 'camp' ? T(`Run this camp?`) : T(`Run this program?`)}</b><b class="claim-cta-h when-claimed">${T(`Claimed by the people who run it`)}</b>
        <p class="when-free">${T(`Claim this listing, free, with your work email: keep its dates, costs and hours right yourself, say whether there’s space, and get its numbers each month.`)}</p>
        <p class="when-claimed">${T(`Updates come from them. Spotted something off?`)} ${T(`Also run it?`)} <a href="${link('managers/', depth)}?l=${encodeURIComponent(key)}">${T(`Claim it with your work email too.`)}</a></p>
      </div>
      <p class="actions"><a class="btn primary claim-btn when-free" href="${link('managers/', depth)}?l=${encodeURIComponent(key)}">${T(`Claim this listing`)}</a><a class="btn suggest-btn" href="${link('suggest/', depth)}?kind=correction&amp;fix=${encodeURIComponent(key)}&amp;program=${encodeURIComponent(name)}">${T(`Suggest an update`)}</a></p>
    </div>` : `<p class="listing-tools"><a class="btn suggest-btn" href="${link('suggest/', depth)}?kind=correction&amp;fix=${encodeURIComponent(key)}&amp;program=${encodeURIComponent(name)}">${T(`Suggest an update`)}</a></p>`;
const photoSlot = key => GROUPS && !PREVIEW ? `${GROUPS.premium !== 'off' ? '<p class="pm-offer" data-pm-offer hidden></p>\n    ' : ''}<figure class="listing-photo" data-photo="${esc(key)}" hidden></figure>` : '';
// Where a premium listing's own page puts what the program added: its own words, more photos, a button for questions.
// Empty until site.js asks the accounts service; nothing at all while premium is off.
const premiumSlot = (key, name, depth) => GROUPS && !PREVIEW && GROUPS.premium !== 'off' ? `<div id="premium" class="pm" data-premium="${GROUPS.premium}" data-pm-key="${esc(key)}" data-pm-name="${esc(name)}" data-api="${link('groups/api.php', depth)}" hidden></div>` : '';
// "Spots open", "Waitlist" or "Full", as the listing's own manager last said it. Empty until the page asks the server.
const spaceSlot = (key, depth) => GROUPS && !PREVIEW ? `<span class="space-mark" data-space="${esc(key)}" data-api="${link('groups/api.php', depth)}" hidden></span>` : '';
const claimedMark = (key, depth) => GROUPS && !PREVIEW ? `<span class="claimed-mark" data-claimed="${esc(key)}" data-api="${link('groups/api.php', depth)}" hidden><b>${T(`Claimed`)}</b> ${T(`by the people who run it`)}</span>` : '';
// A strip of links to the parts of a long page. site.js fills it from every element with data-jump-to and an id.
const jumpNav = () => `<nav class="jump" data-jump aria-label="On this page" hidden></nav>`;
// The neighborhoods an account can say it lives in: every one the site names anywhere, plus "somewhere else".
const accountHoods = () => [...new Set([...hoods.map(h => h.name), ...CAMP_AREAS.flatMap(a => a[1])])].sort((a, b) => a.localeCompare(b)).map(n => ({ id: hoodSlug(n), name: n })).concat([{ id: 'other', name: 'Somewhere else' }]);
// What's new, for the account page: data/news.json, newest first. Each entry is { date, title, text, href?, link? }.
const NEWS = (fs.existsSync(path.join(ROOT, 'data/news.json')) ? readJson('data/news.json') : []).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n.date || '') && n.title && n.text).sort((a, b) => b.date.localeCompare(a.date));
const groupsScript = depth => `<script src="${link('assets/groups.js', depth)}${GROUPS_V}"></script>`;
function accountPage(register = false) {
  // Two addresses, one form. /register/ is the page that makes the case for an account: what you get on one side, the
  // form on the other. /account/ is where you log in and, once signed in, your profile; both of its headings are in
  // the page and the right one shows before it paints. Someone already signed in who opens /register/ is sent on.
  const hero = register ? `    <h1>${T(`Create your free account`)}</h1>
    <p class="lede">${GROUPS && daysOff ? T(`Keep every plan you build, the school week, the days off and the summer, and see them together in one private calendar for the whole year. It takes about a minute, and there’s no password to remember.`) : T(`Save your school, your kids’ grades and your week, and share a week with the people who need it. It takes about a minute, and there’s no password to remember.`)}</p>`
    : `    <h1><span class="when-out">${T(`Log in to your account`)}</span><span class="when-in">${T(`Your account`)}</span></h1>
    <p class="lede when-out">${T(`Your school, your plans and your kids’ calendar for the year, on any device. There’s no password to remember.`)} ${T(`New here?`)} <a href="${link('register/', 1)}">${T(`Create a free account`)}</a></p>
    <p class="lede when-in">${T(`This is where you change things: your name, email address and phone number, your school and grades, what you’re emailed about, what you follow, and who you share with.`)}</p>`;
  const art = `<svg viewBox="0 0 520 300" aria-hidden="true" focusable="false">
  <defs><g id="acct-week"><rect width="120" height="152" rx="11" fill="#FFFFFF" stroke="#C9DAEE" stroke-width="1.5"/><path d="M0 11a11 11 0 0 1 11-11h98a11 11 0 0 1 11 11v17H0z" fill="#0F4D90"/><text x="11" y="19" font-size="11" font-weight="800" fill="#FFFFFF" font-family="Archivo, Arial, sans-serif">Sam’s week</text><circle cx="17" cy="44" r="7.5" fill="#E3EEFA"/><text x="17" y="47.4" text-anchor="middle" font-size="8.5" font-weight="800" fill="#0B2140" font-family="Archivo, Arial, sans-serif">M</text><rect x="31" y="38" width="62" height="12" rx="6" fill="#1F7A3A"/><circle cx="17" cy="65" r="7.5" fill="#E3EEFA"/><text x="17" y="68.4" text-anchor="middle" font-size="8.5" font-weight="800" fill="#0B2140" font-family="Archivo, Arial, sans-serif">T</text><rect x="31" y="59" width="48" height="12" rx="6" fill="#B4237A"/><circle cx="17" cy="86" r="7.5" fill="#E3EEFA"/><text x="17" y="89.4" text-anchor="middle" font-size="8.5" font-weight="800" fill="#0B2140" font-family="Archivo, Arial, sans-serif">W</text><rect x="31" y="80" width="70" height="12" rx="6" fill="#0E7C86"/><circle cx="17" cy="107" r="7.5" fill="#E3EEFA"/><text x="17" y="110.4" text-anchor="middle" font-size="8.5" font-weight="800" fill="#0B2140" font-family="Archivo, Arial, sans-serif">T</text><rect x="31" y="101" width="40" height="12" rx="6" fill="#6B3FA0"/><circle cx="17" cy="128" r="7.5" fill="#E3EEFA"/><text x="17" y="131.4" text-anchor="middle" font-size="8.5" font-weight="800" fill="#0B2140" font-family="Archivo, Arial, sans-serif">F</text><rect x="31" y="122" width="56" height="12" rx="6" fill="#C2410C"/></g></defs>
  <rect x="238" y="20" width="250" height="186" rx="13" class="art-frame"/>
  <path d="M212 214h302a7 7 0 0 1-7 12H219a7 7 0 0 1-7-12z" fill="#0B2140"/>
  <use href="#acct-week" x="262" y="38"/>
  <rect x="398" y="42" width="72" height="9" rx="4.5" class="art-line"/><rect x="398" y="60" width="54" height="9" rx="4.5" class="art-line"/><rect x="398" y="78" width="66" height="9" rx="4.5" class="art-line"/>
  <rect x="394" y="110" width="82" height="26" rx="13" fill="#F3C613"/><text x="435" y="127.5" text-anchor="middle" font-size="11" font-weight="800" fill="#2A2100" font-family="Archivo, Arial, sans-serif">Nebinger</text>
  <rect x="394" y="144" width="82" height="26" rx="13" class="art-chip"/><text x="435" y="161.5" text-anchor="middle" font-size="11" font-weight="800" class="art-ink" font-family="Archivo, Arial, sans-serif">Grades K, 3</text>
  <rect x="30" y="62" width="150" height="226" rx="22" class="art-frame"/><rect x="88" y="71" width="34" height="5" rx="2.5" fill="#0B2140"/>
  <use href="#acct-week" x="45" y="92"/>
  <path d="M128 58C140 22 212 16 240 54" fill="none" stroke="#0F4D90" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>
  <circle cx="184" cy="29" r="17" fill="#F3C613"/><path d="M176 29.5l5.5 5.5 10-11" fill="none" stroke="#2A2100" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  const body = `<div ${groupsAttrs(1)} data-clarity-mask="true" style="display:contents">
  <noscript><p class="ask">${T(`Accounts need JavaScript turned on.`)}</p></noscript>
  <div class="acct-grid">
    <div class="g-page" id="account"${register ? ' data-mode="register" data-clarity-mask="true"' : ''}></div>
    <section class="acct-why when-out" aria-labelledby="acct-why-h">
      <div class="acct-art">${art}</div>
      <h2 id="acct-why-h">${T(`What an account gives you`)}</h2>
      <ul class="acct-points">
        ${GROUPS && daysOff ? `<li><b>${T(`See the whole year in one calendar.`)}</b> ${T(`“My kids’ calendar” puts the school week, every day off, the camp weeks and each sign-up date in date order. Only you can open it.`)}</li>
        <li><b>${T(`Put it on your phone.`)}</b> ${T(`One calendar file for the year that you can bring up to date, and a picture of any month for the fridge.`)}</li>` : `<li><b>${T(`Keep your week.`)}</b> ${T(`Build it on your phone tonight, find it on your laptop tomorrow.`)}</li>`}
        ${ALERTS ? `<li><b>${T(`Follow and save.`)}</b> ${T(`Follow a program, a camp or your school and its sign-up dates come by email. Save favorites to find them again.`)}</li>` : ''}
        <li><b>${T(`Share a week with one person.`)}</b> ${T(`A grandparent or a sitter signs in to see it, and you can take it back.`)}</li>${GROUPS.pilot ? '' : `
        <li><b>${T(`Share with a small group.`)}</b> ${T(`A few families you invite by email see each other’s weeks. Nobody else can find the group or ask to join.`)}</li>`}
      </ul>
      <p class="hint">${T(`It’s free. The plans you make are kept in your profile, so they’re on your phone and your computer, and you can delete the account whenever you like.`)}</p>${cfg.termsLive === true ? `
      <p class="hint">${T(`Making an account means you agree to the`)} <a href="${link('terms/', 1)}">${T(`terms of use`)}</a>.</p>` : ''}
      <p class="hint">${T(`Run a program or camp?`)} <a href="${link('managers/', 1)}">${T(`Claim your listing`)}</a>${T(`. It’s the same account.`)}</p>
    </section>
  </div>
  <section class="notes">
    <h2>${T(`What an account keeps, and who sees it`)}</h2>
    <ul>
      <li>${T(`Your profile keeps the plans you make: a child’s first name with their week, days off and summer, and your school. No last names, addresses, notes or photos.`)}</li>
      <li>${T(`A shared week opens only for the email address you sent it to, once that person has signed in. It can’t be searched for, and its link shows nothing to anyone else.`)}</li>
      <li>${T(`You can take a week back, stop sharing, or delete your account at any time. Shared weeks delete themselves when the school year ends.`)}</li>
    </ul>
    <p><a href="${link('privacy/', 1)}#groups">${T(`The full details are on the privacy page.`)}</a></p>
  </section>
  <script type="application/json" id="groups-data">${JSON.stringify({ grades: GRADES, ages: AGES, schools: [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => ({ id: s.id, name: s.shortName })), hoods: accountHoods(), news: NEWS.slice(0, 5) }).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: register ? 'Create a free account' : 'Your account', description: register ? `Create a free ${cfg.siteName} account to keep your week, days-off and summer plans, and see the whole year in one private calendar.` : `Sign in to ${cfg.siteName} to keep your school and week in a profile, or to share a week.`, pathName: register ? 'register/' : 'account/', depth: 1, current: null, hero, body, noindex: true, quiet: !register, scripts: groupsScript(1) });
}
// "My profile": a snapshot of the account on one card (nothing is changed here; that is the account page). The page is a shell; groups.js fills it
// (the same script as the account page, told which page it is on by data-view). Signed out, it shows the log-in form.
function profilePage() {
  const hero = `    <h1><span class="when-out">${T(`Log in to see your profile`)}</span><span class="when-in">${T(`My profile`)}</span></h1>
    <p class="lede when-out">${T(`Your school, what you follow, your favorites and your plans, on any device. There’s no password to remember.`)} ${T(`New here?`)} <a href="${link('register/', 1)}">${T(`Create a free account`)}</a></p>
    <p class="lede when-in">${T(`Everything in your account, on one card. To change any of it, go to your account.`)}</p>`;
  const body = `<div ${groupsAttrs(1)} data-clarity-mask="true" style="display:contents">
  <noscript><p class="ask">${T(`Your profile needs JavaScript turned on.`)}</p></noscript>
  <div class="g-page" id="account" data-view="profile"></div>
  <script type="application/json" id="groups-data">${JSON.stringify({ grades: GRADES, ages: AGES, schools: [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => ({ id: s.id, name: s.shortName })), hoods: accountHoods(), news: NEWS.slice(0, 5), programs: Object.fromEntries(programs.map(p => [p.id, p.name])) }).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: 'My profile', description: `Your ${cfg.siteName} profile: you, your kids, your school, what you follow, your favorites and your plans, on one card.`, pathName: 'profile/', depth: 1, current: null, hero, body, noindex: true, quiet: true, scripts: groupsScript(1) });
}
// A page whose address changed: send the visitor on, keeping anything after the address (?l=, ?q=).
const movedPage = (to, depth) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>This page has moved</title>
<link rel="canonical" href="${cfg.siteUrl}/${to}">
<script>location.replace(${JSON.stringify(link(to, depth))} + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0;url=${link(to, depth)}"></head>
<body><p><a href="${link(to, depth)}">This page has moved. Go to it.</a></p></body></html>
`;

// ---------- for the people who manage a program: find a listing and claim it ----------
// What claiming gets you, in the order the example listing beside it is numbered.
const CLAIM_GETS = () => CLAIM_GETS_ALL().filter(([, name, text]) => !(name === REMOVED && text === REMOVED));
const CLAIM_GETS_ALL = () => [
  ['dates', T(`Keep your dates current.`), T(`Post sign-up openings, deadlines, term dates and camp days as soon as you set them, instead of waiting for us to find them.`)],
  ['space', T(`Say whether there’s space.`), T(`Mark your listing “Spots open”, “Waitlist” or “Full”. It shows to parents straight away, with the date.`)],
  ['numbers', T(`See your numbers.`), T(`How many times your listing was opened this month, how many clicks went on to your sign-up page and website, and how many families put you on a plan.`)],
  ...(GROUPS.photos ? [['photo', T(`Add a photo.`), T(`One picture of your space or an activity at the top of your listing.`)]] : []),
  ['claimed', T(`Show parents it’s kept up.`), T(`A “Claimed” mark tells them the listing is looked after by the people who run it.`)],
];
const claimBenefits = () => `<ol class="benefits">
${CLAIM_GETS().map(([, name, text], i) => `      <li><i class="demo-n" aria-hidden="true">${i + 1}</i><b>${name}</b> ${text}</li>`).join('\n')}
    </ol>`;
// A picture of a claimed listing, built from the same parts a real one uses. The program is invented, and says so.
function claimDemo() {
  const at = Object.fromEntries(CLAIM_GETS().map(([k], i) => [k, `<i class="demo-n" aria-hidden="true">${i + 1}</i>`]));
  const bars = [3, 5, 4, 7, 6, 2, 1, 6, 8, 9, 7, 10, 4, 3, 8, 11, 9, 12, 10, 5, 4, 9, 13, 12, 14, 11, 6, 5, 12, 15];
  const spark = `<svg class="claim-spark" viewBox="0 0 300 44" preserveAspectRatio="none" focusable="false">${bars.map((v, i) => { const h = Math.max(3, Math.round(v / 15 * 40)); return `<rect x="${i * 10 + 1}" y="${44 - h}" width="8" height="${h}" rx="2"/>`; }).join('')}</svg>`;
  const photo = GROUPS.photos ? `<div class="demo-photo">${at.photo}<svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="400" height="120" fill="#F6E7C8"/><rect y="86" width="400" height="34" fill="#D9B98A"/><rect x="26" y="20" width="74" height="52" rx="4" fill="#FFFFFF" stroke="#B88A00" stroke-width="3"/><path d="M36 62l16-20 12 13 9-8 17 15z" fill="#2C8444"/><circle cx="84" cy="34" r="6" fill="#F3C613"/><rect x="120" y="14" width="56" height="66" rx="4" fill="#FFFFFF" stroke="#B4237A" stroke-width="3"/><circle cx="148" cy="42" r="15" fill="#B4237A"/><circle cx="148" cy="42" r="7" fill="#F3C613"/><rect x="214" y="60" width="150" height="10" rx="3" fill="#8A5A2B"/><rect x="226" y="70" width="8" height="34" fill="#8A5A2B"/><rect x="344" y="70" width="8" height="34" fill="#8A5A2B"/><rect x="236" y="36" width="22" height="24" rx="4" fill="#1763B8"/><rect x="266" y="42" width="18" height="18" rx="4" fill="#C2410C"/><rect x="292" y="32" width="20" height="28" rx="4" fill="#2C8444"/><path d="M322 60V30M318 30h8" stroke="#0B2140" stroke-width="3" stroke-linecap="round"/><path d="M332 60V26M328 26h8" stroke="#6B3FA0" stroke-width="3" stroke-linecap="round"/></svg></div>` : '';
  return `<figure class="claim-demo">
      <div class="demo-page" aria-hidden="true">
        <div class="demo-bar"><i></i><i></i><i></i><span>${esc(cfg.siteUrl.replace(/^https?:\/\//, ''))}/programs/your-program/</span></div>
        <div class="demo-hero">
          <p class="demo-name">${T(`Maple Street Arts Club`)}</p>
          <p class="demo-what">${T(`Painting, clay and printmaking after school, with pickup from two schools`)}</p>
          <p class="demo-chips"><span>${T(`Art`)}</span><span>${T(`Grades`)} <b>K ${T(`to`)} 5</b></span><span class="claimed-mark"><b>${T(`Claimed`)}</b> ${T(`by the people who run it`)}${at.claimed}</span><span class="space-mark open"><b>${T(`Spots open`)}</b> ${T(`as of Oct 6`)}${at.space}</span></p>
        </div>
        <div class="demo-body">
          ${photo}
          <div class="strip">${GRADES.map(g => `<i class="cell${['K', '1', '2', '3', '4', '5'].includes(String(g)) ? ' on' : ''}">${g}</i>`).join('')}</div>
          <dl>
            <dt>${T(`Hours`)}</dt><dd>${T(`Monday to Thursday, dismissal to 6 pm`)}</dd>
            <dt>${T(`Cost`)}</dt><dd>${T(`$95 a week, with a sibling discount`)}</dd>
            <dt>${T(`Dates`)}</dt><dd><b>${T(`Winter term sign-up opens November 12`)}</b>${at.dates}<br><span class="demo-link">${T(`Add to calendar`)}</span></dd>
          </dl>
          <p class="demo-actions"><span class="btn primary">${T(`Sign up`)}</span><span class="btn">${T(`Website`)}</span></p>
          <p class="demo-src">${T(`Checked October 6.`)}</p>
        </div>
      </div>
      <div class="demo-stats" aria-hidden="true">
        <p class="demo-only">${T(`Only you see this`)}${at.numbers}</p>
        <div class="claim-stats">
          <h4>${T(`Your listing, last 30 days`)}</h4>
          <div class="claim-nums">
            <div class="claim-num"><b>412</b><span>${T(`times your listing was opened`)}</span></div>
            <div class="claim-num"><b>57</b><span>${T(`clicks to sign up`)}</span></div>
            <div class="claim-num"><b>23</b><span>${T(`times it was put on a family’s plan`)}</span></div>
          </div>
          ${spark}
        </div>
      </div>
      <figcaption>${T(`An example of a claimed listing. The program and its numbers are made up.`)}</figcaption>
    </figure>`;
}
function directorsPage() {
  const L = claimListings();
  const hero = `    <h1>${T(`Run a program or camp? Claim your listing.`)}</h1>
    <p class="lede">${T(`Find your program below and claim it with your work email. Then keep its dates, costs and hours up to date yourself. It’s free, and it takes a couple of minutes.`)}</p>`;
  const body = `<div ${groupsAttrs(1)} style="display:contents">
  <noscript><p class="ask">${T(`Claiming a listing needs JavaScript turned on.`)}</p></noscript>
  <div class="g-page" id="claims" data-clarity-mask="true"${GROUPS.photos ? ' data-photos="1"' : ''}${GROUPS.premium !== 'off' ? ` data-qr="${link('assets/qr.js', 1)}${stamp('src/qr.js')}"` : ''}${PM_LISTED ? ` data-pm-from="${PM_PRICE.month}"` : ''}></div>
  <script type="application/json" id="claims-data">${JSON.stringify(Object.entries(L).map(([k, v]) => [k, v.n, v.d, v.m === 'match' ? 1 : 0, ...(v.h ? [1] : [])])).replace(/</g, '\\u003c')}</script>
  <section class="section" id="why">
    <h2>${T(`What claiming gets you`)}</h2>
    <p>${T(`Your listing is already on the site, and parents are already reading it. Claim it and it becomes yours to keep right.`)}</p>
    <div class="claim-show">
      ${claimDemo()}
      ${claimBenefits()}
    </div>
  </section>${PM_LISTED ? `
  <section class="section pm-cta" id="premium-cta">
    <div class="pm-cta-box">
      <div class="pm-cta-say">
        <h2>${T(`Want more on your listing?`)}</h2>
        <p>${T(`A premium listing adds photos and your logo, a section in your own words, an offer or event line, a button parents use to send you a question, and month-by-month numbers. The listing itself stays free; premium is the extras.`)}</p>
      </div>
      <p class="actions"><a class="btn primary" href="${link('premium/', 1)}" data-track="premium_cta_managers">${T(`See what premium adds`)}</a><span class="hint">${T(`From {price} a month. Claim your listing first; premium is added to it.`, { price: '$' + PM_PRICE.month })}</span></p>
    </div>
  </section>` : ''}
  <section class="section">
    <h2>${T(`How claiming works`)}</h2>
    <ol class="steps">
      <li><b>${T(`Find your listing.`)}</b> ${T(`Search by name above. Every program and summer camp on the site is there.`)}</li>
      <li><b>${T(`Sign in with your work email.`)}</b> ${T(`It has to be an address at your program’s own website: if the listing’s website is example.org, an address ending in @example.org. That is how we know you speak for it. If the addresses match, the claim stands straight away.`)}</li>
      <li><b>${T(`Send changes when something moves.`)}</b> ${T(`New dates, a new price, new hours. We read each one and update the listing, usually within a few days.`)}</li>
    </ol>
  </section>
  <section class="notes">
    <h2>${T(`Good to know`)}</h2>
    <ul>
      <li>${T(`A personal address (Gmail, Yahoo and so on) can’t claim a listing, even if it’s the one printed on your flyer. We have no way to tell it apart from anyone else’s.`)}</li>
      <li>${T(`“Continue with Google” works if your work email is a Google account at your program’s address. A personal Gmail account will sign you in, but it can’t claim anything.`)}</li>
      <li>${T(`Some listings sit on a website many people share: a city rec center, a school’s clubs, a program inside a university. Those claims wait for us to say yes, and we may write to ask a question first.`)}</li>
      <li>${T(`Parents see a “Claimed” mark on the listing. Your name and email address are never shown.`)}</li>
      <li>${T(`A claim doesn’t change what the listing says by itself. Changes you send are looked at by a person, then published.`)}</li>${GROUPS.photos ? `
      <li>${T(`Only send a photo you have the right to use, with permission from the families of any children in it.`)}</li>` : ''}
      <li>${T(`Listings are free and stay free. Nobody pays to be listed or to be ranked higher.`)}${PM_LISTED ? ` ${T(`Want more on yours?`)} <a href="${link('premium/', 1)}" data-track="premium_from_managers">${T(`A premium listing adds photos, your own words and offers.`)}</a>` : GROUPS.photos ? '' : ' ' + T(`Paid extras, such as a photo at the top of your listing, are planned for later.`)}</li>
      <li>${T(`Not on the site yet?`)} <a href="${link('suggest/', 1)}">${T(`Suggest your program`)}</a> ${T(`or`)} <a href="${link('suggest/', 1)}?kind=camp">${T(`your camp`)}</a>${T(`, with its website, and claim it once it’s up.`)}</li>
    </ul>
    <p><a href="${link('privacy/', 1)}#managers">${T(`What we keep about a claim is on the privacy page.`)}</a></p>
  </section>
</div>`;
  return layout({ title: 'For program managers: find and claim your listing', description: `Run an after-school program or camp in Philadelphia? Find your ${cfg.siteName} listing, claim it with your work email, and keep its dates, costs and hours up to date. Free.`, pathName: 'managers/', depth: 1, current: null, hero, body, scripts: groupsScript(1) });
}

// The page where a program signs a claimed listing up for premium (/premium/). While premium is in "preview" it is
// not linked from anywhere and is kept out of search engines and the sitemap; once premium is on (PM_LISTED) the
// managers page points to it. The words and prices are here; the box that knows who is signed in and which
// listings they hold is drawn by groups.js.
function premiumPage() {
  const D = 1, P = PM_PRICE, money = n => '$' + n;
  const free = Math.round((12 * P.month - P.year) / P.month);   // months a year's plan saves
  // In the order the picture shows them: each has a numbered dot there and in the list beside it.
  const gets = [
    ['photos', T(`Photos and your logo`), T(`Up to six photos and a logo, at the top of your listing.`)],
    ['offer', T(`An offer or event line`), T(`An open house, a trial class, early-bird pricing. It shows near the top until the date you set.`)],
    ['words', T(`A section in your own words`), T(`Say what makes your program yours, the way you’d say it to a parent on a tour.`)],
    ['ask', T(`A button for questions`), T(`Parents send a question from your listing and it lands in your inbox, with their address to reply to.`)],
    ['numbers', T(`Fuller numbers`), T(`Month by month: how often your listing was opened, how many families follow it or saved it, and which schools they come from. Numbers only, never who.`)],
    ['flyer', T(`A flyer to print`), T(`With a code that opens your listing, for the front desk or the school fair.`)],
  ];
  const at = Object.fromEntries(gets.map(([k], i) => [k, `<i class="demo-n" aria-hidden="true">${i + 1}</i>`]));
  // A picture of a premium listing, built from the parts a real one uses. The program is invented, and says so.
  const art = (inner, bg) => `<svg viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="120" height="90" fill="${bg}"/>${inner}</svg>`;
  const room = `<svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="400" height="120" fill="#F6E7C8"/><rect y="86" width="400" height="34" fill="#D9B98A"/><rect x="26" y="20" width="74" height="52" rx="4" fill="#FFFFFF" stroke="#B88A00" stroke-width="3"/><path d="M36 62l16-20 12 13 9-8 17 15z" fill="#2C8444"/><circle cx="84" cy="34" r="6" fill="#F3C613"/><rect x="120" y="14" width="56" height="66" rx="4" fill="#FFFFFF" stroke="#B4237A" stroke-width="3"/><circle cx="148" cy="42" r="15" fill="#B4237A"/><circle cx="148" cy="42" r="7" fill="#F3C613"/><rect x="214" y="60" width="150" height="10" rx="3" fill="#8A5A2B"/><rect x="226" y="70" width="8" height="34" fill="#8A5A2B"/><rect x="344" y="70" width="8" height="34" fill="#8A5A2B"/><rect x="236" y="36" width="22" height="24" rx="4" fill="#1763B8"/><rect x="266" y="42" width="18" height="18" rx="4" fill="#C2410C"/><rect x="292" y="32" width="20" height="28" rx="4" fill="#2C8444"/><path d="M322 60V30M318 30h8" stroke="#0B2140" stroke-width="3" stroke-linecap="round"/><path d="M332 60V26M328 26h8" stroke="#6B3FA0" stroke-width="3" stroke-linecap="round"/></svg>`;
  const thumbs = [
    art('<rect x="30" y="14" width="60" height="62" rx="3" fill="#FFFFFF" stroke="#0F4D90" stroke-width="3"/><circle cx="50" cy="38" r="9" fill="#F3C613"/><path d="M36 68l14-16 10 9 9-12 15 19z" fill="#1763B8"/>', '#DAEDFE'),
    art('<rect y="62" width="120" height="28" fill="#D9B98A"/><path d="M22 62c-2-16 4-26 14-26s16 10 14 26z" fill="#C2410C"/><path d="M58 62c-3-22 3-36 12-36s15 14 12 36z" fill="#2C8444"/><path d="M90 62c-1-10 2-16 8-16s9 6 8 16z" fill="#6B3FA0"/><rect x="30" y="32" width="12" height="5" rx="2" fill="#8A2C06"/><rect x="64" y="22" width="12" height="5" rx="2" fill="#1F5A22"/>', '#FFF4C2'),
    art('<rect x="18" y="18" width="38" height="52" rx="3" fill="#FFFFFF"/><path d="M26 58l8-24 8 14 6-8 4 18z" fill="#B4237A"/><rect x="64" y="18" width="38" height="52" rx="3" fill="#FFFFFF"/><circle cx="83" cy="40" r="11" fill="#2C8444"/><rect x="72" y="56" width="22" height="5" rx="2" fill="#0B2140"/>', '#D6F3D2'),
  ];
  const months = [['May', 34], ['Jun', 52], ['Jul', 41], ['Aug', 88], ['Sep', 100], ['Oct', 71]];
  const qr = '<svg viewBox="0 0 54 70" focusable="false"><rect width="54" height="70" fill="#FFFFFF"/><rect x="6" y="6" width="42" height="6" rx="2" fill="#0B2140"/><rect x="6" y="15" width="30" height="3" rx="1.5" fill="#9DB2CC"/>' + [[0, 0], [1, 0], [3, 0], [5, 0], [0, 1], [2, 1], [4, 1], [5, 1], [1, 2], [2, 2], [5, 2], [0, 3], [3, 3], [4, 3], [0, 4], [1, 4], [3, 4], [5, 4], [2, 5], [4, 5], [5, 5]].map(([x, y]) => `<rect x="${12 + x * 5}" y="${24 + y * 5}" width="5" height="5" fill="#0B2140"/>`).join('') + '<rect x="14" y="60" width="26" height="4" rx="2" fill="#F3C613"/></svg>';
  const demo = `<figure class="claim-demo pm-demo">
      <div class="demo-page" aria-hidden="true">
        <div class="demo-bar"><i></i><i></i><i></i><span>${esc(cfg.siteUrl.replace(/^https?:\/\//, ''))}/programs/your-program/</span></div>
        <div class="demo-hero">
          <p class="demo-name">${T(`Maple Street Arts Club`)}</p>
          <p class="demo-what">${T(`Painting, clay and printmaking after school, with pickup from two schools`)}</p>
          <p class="demo-chips"><span>${T(`Art`)}</span><span>${T(`Grades`)} <b>K ${T(`to`)} 5</b></span><span class="claimed-mark"><b>${T(`Claimed`)}</b> ${T(`by the people who run it`)}</span></p>
        </div>
        <div class="demo-body">
          <div class="demo-photo">${at.photos}${room}</div>
          <p class="pm-offer-line"><b>${T(`From the program`)}</b> ${T(`Open house on November 12 at 6 pm. Come see the studio and meet the teachers.`)}${at.offer}</p>
          <div class="pmd-words">
            <p class="pmd-h">${T(`In their own words`)}${at.words}</p>
            <p class="pm-by"><span class="pmd-logo">${art('<circle cx="60" cy="45" r="30" fill="#B4237A"/><path d="M44 58l10-26 6 16 6-16 10 26" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>', '#FFFFFF')}</span><span>${T(`Written by Maple Street Arts Club, not by us.`)}</span></p>
            <p class="pmd-text">${T(`We keep groups small, so every kid gets their hands in the clay. Most afternoons end with something to carry home.`)}</p>
          </div>
          <div class="pmd-thumbs">${thumbs.join('')}</div>
          <p class="demo-actions"><span class="btn primary">${T(`Sign up`)}</span><span class="btn">${T(`Ask a question`)}</span>${at.ask}</p>
        </div>
      </div>
      <div class="demo-stats" aria-hidden="true">
        <p class="demo-only">${T(`Only you see this`)}${at.numbers}</p>
        <div class="claim-stats">
          <h4>${T(`Your listing, month by month`)}</h4>
          <div class="pmd-months">${months.map(([m, h]) => `<span><i style="height:${Math.round(h * 0.54)}px"></i>${m}</span>`).join('')}</div>
          <ul class="pm-schools"><li>Elm Street School <span>38</span></li><li>Parkside Elementary <span>21</span></li><li>Riverview Charter <span>12</span></li></ul>
        </div>
        <p class="pmd-flyer">${qr}<span>${T(`A flyer with your listing’s code, ready to print`)}${at.flyer}</span></p>
      </div>
      <figcaption>${T(`An example of a premium listing. The program, its schools and its numbers are made up.`)}</figcaption>
    </figure>`;
  const card = (plan, name, price, per, note, pick) => `<div class="pm-plan${pick ? ' best' : ''}" data-plan="${plan}">
      ${pick ? `<p class="pm-flag">${T(`Best value`)}</p>` : ''}
      <h3>${name}</h3>
      <p class="pm-price"><b>${money(price)}</b> <span>${per}</span></p>
      <p class="pm-plan-note">${note}</p>
    </div>`;
  const hero = `    <h1>${T(`Premium listings`)}</h1>
    <p class="lede">${T(`Your listing on {site} is free, and it stays free. Premium adds your photos, your words and your offers to it, and shows you what families do with it.`, { site: cfg.siteName })}</p>`;
  const body = `<div ${groupsAttrs(D)} style="display:contents">
  <section class="section" id="price">
    <h2>${T(`What it costs`)}</h2>
    <div class="pm-plans">
    ${card('year', T(`Yearly`), P.year, T(`a year`), free > 1 ? T(`{n} months free, compared with paying by the month.`, { n: ['', '', 'Two', 'Three', 'Four'][free] || String(free) }) : free === 1 ? T(`One month free, compared with paying by the month.`) : T(`One payment for the year.`), free > 0)}
    ${card('month', T(`Monthly`), P.month, T(`a month`), T(`Pay as you go.`), false)}
    </div>
    ${P.laterMonth && P.laterYear ? `<p class="pm-founding">${T(`This is the founding price, for the first programs to sign up. It stays yours for as long as you stay signed up. Later, premium will cost {m} a month or {y} a year.`, { m: money(P.laterMonth), y: money(P.laterYear) })}</p>` : ''}
    <p class="actions"><a class="btn primary" href="#signup" data-track="premium_to_signup">${T(`Sign up your listing`)}</a></p>
    <p>${T(`Run a free program, a school club or a rec center?`)} <a href="${link('contact/', D)}">${T(`Write to us before you sign up.`)}</a></p>
  </section>
  <section class="section" id="what">
    <h2>${T(`What premium adds`)}</h2>
    <div class="claim-show">
      ${demo}
      <ol class="benefits">
${gets.map(([, h, p], i) => `        <li><i class="demo-n" aria-hidden="true">${i + 1}</i><b>${h}</b> ${p}</li>`).join('\n')}
      </ol>
    </div>
  </section>
  <section class="section" id="signup">
    <h2>${T(`Sign up`)}</h2>
    <noscript><p class="ask">${T(`Signing up needs JavaScript turned on.`)}</p></noscript>
    <div class="g-page" id="premium-signup" data-clarity-mask="true" data-month="${P.month}" data-year="${P.year}"${PM_PAY ? ` data-pay-month="${esc(PM_PAY.month)}" data-pay-year="${esc(PM_PAY.year)}"` : ''}></div>
  </section>
  <section class="section" id="not">
    <h2>${T(`What premium doesn’t do`)}</h2>
    <ul>
      <li>${T(`It doesn’t move you up. Listings are never ordered by who pays, and premium doesn’t change where yours appears.`)}</li>
      <li>${T(`It doesn’t replace your free listing. Claiming it, sending corrections and saying whether you have space all stay free, with or without premium.`)}</li>
      <li>${T(`It never costs families anything. Parents don’t pay for any part of this site.`)}</li>
      <li>${T(`Nothing you add goes up unread. A person looks at each photo, section and offer line before it shows on your listing.`)}</li>
      <li>${T(`It doesn’t lock you in. You can stop at any time: write to us and we’ll end it.`)}</li>
    </ul>
    <p><a href="${link('privacy/', D)}#managers">${T(`What we keep about a claim and a premium listing is on the privacy page.`)}</a></p>
  </section>
</div>`;
  return layout({ title: 'Premium listings for programs and camps', description: `Add photos, your own words, offers and fuller numbers to your ${cfg.siteName} listing.`, pathName: 'premium/', depth: D, current: null, hero, body, noindex: !PM_LISTED, scripts: groupsScript(D) });
}

// The owner's review page for claims and the changes directors propose, behind the same sign-in as the edit page.
function editClaimsPhp() {
  const hero = `    <h1>Claims and proposed changes</h1>
    <p class="lede">Who has claimed which listing, the claims waiting for your yes, and the changes program managers have asked for.</p>`;
  const e = v => `<?php echo htmlspecialchars(${v}, ENT_QUOTES, 'UTF-8'); ?>`;
  const act = (does, label, cls = 'btn') => `<button class="${cls}" type="submit" name="do" value="${does}">${label}</button>`;
  const form = (idVar, buttons) => `<form method="post" action="./" class="actions"><input type="hidden" name="csrf" value="${e('$csrf')}"><input type="hidden" name="id" value="<?php echo (int) ${idVar}; ?>">${buttons}</form>`;
  const body = `<div class="prose stats">
<?php if ($said !== '') { ?><p class="flag">${e('$said')}</p><?php } ?>
<?php if (!$have) { ?>
  <div class="panel"><p>Nobody has claimed a listing yet.</p></div>
<?php } else { ?>
  <h2>Waiting for your yes (<?php echo count($pending); ?>)</h2>
  <?php if (!$pending) { ?><p class="hint">Nothing waiting. A claim only lands here when the listing’s website is one many people share (the city, the school district, a university, a booking site).</p><?php } ?>
  <?php foreach ($pending as $c) { ?><div class="panel">
    <h3>${e('$name($c["listing"])')}</h3>
    <p>${e('$c["first"] . " " . $c["last"]')} &lt;${e('$c["email"]')}&gt; asked on ${e('$day($c["created"])')}. Their address is at <b>${e('$c["domain"]')}</b>, the same as the listing’s website, but that address is shared.</p>
    ${form('$c["id"]', act('claim_ok', 'Approve the claim', 'btn primary') + act('claim_no', 'Decline'))}
  </div><?php } ?>

  <h2>Changes program managers have proposed (<?php echo count($edits); ?> new)</h2>
  <?php if (!$edits) { ?><p class="hint">None waiting.</p><?php } else { ?><p class="hint">Nothing here has changed the site. To apply one, paste it to Claude (or edit the listing data), then mark it published so the manager is told.</p><?php } ?>
  <?php foreach ($edits as $x) { ?><div class="panel">
    <h3>${e('$name($x["listing"])')} <span class="hint">${e('$x["listing"]')}</span></h3>
    <p class="hint">From ${e('$x["first"] . " " . $x["last"]')} &lt;${e('$x["email"]')}&gt;, ${e('$day($x["created"])')}</p>
    <pre class="edit-ask">${e('$x["body"]')}<?php if ($x["link"] !== '') { ?>

Link: ${e('$x["link"]')}<?php } ?></pre>
    ${form('$x["id"]', act('edit_done', 'Mark published', 'btn primary') + act('edit_no', 'Decline'))}
  </div><?php } ?>

  <h2>Photos waiting for you (<?php echo count($photosNew); ?>)</h2>
  <?php if (!$photosNew) { ?><p class="hint">None waiting. A photo shows on a listing only after you publish it here.</p><?php } ?>
  <?php foreach ($photosNew as $x) { ?><div class="panel">
    <h3>${e('$name($x["listing"])')}<?php if (isset($x["kind"]) && $x["kind"] === 'logo') { ?> <span class="hint">Logo</span><?php } ?></h3>
    <p class="hint">From ${e('$x["first"] . " " . $x["last"]')} &lt;${e('$x["email"]')}&gt;, ${e('$day($x["created"])')}. They ticked that they have the right to use it and permission from the families of any children shown.</p>
    <p><img class="review-photo" src="./?photo=<?php echo (int) $x["id"]; ?>" alt=""></p>
    <p>Described as: <b>${e('$x["alt"]')}</b></p>
    ${form('$x["id"]', act('photo_ok', 'Publish the photo', 'btn primary') + act('photo_no', 'Decline'))}
  </div><?php } ?>
  <?php if ($photosLive) { ?><h2>Photos on the site (<?php echo count($photosLive); ?>)</h2>
  <div class="review-grid"><?php foreach ($photosLive as $x) { ?><div class="panel"><p><img class="review-photo" src="./?photo=<?php echo (int) $x["id"]; ?>" alt=""></p><p><b>${e('$name($x["listing"])')}</b><br><span class="hint">${e('$x["alt"]')}</span></p>${form('$x["id"]', act('photo_no', 'Take it down'))}</div><?php } ?></div><?php } ?>

${GROUPS.premium !== 'off' ? `  <h2>Words and offer lines waiting for you (<?php echo count($extrasNew); ?>)</h2>
  <?php if (!$extrasNew) { ?><p class="hint">None waiting. What a manager writes for a premium listing shows only after you publish it here.</p><?php } ?>
  <?php foreach ($extrasNew as $x) { ?><div class="panel">
    <h3>${e('$name($x["listing"])')} <span class="hint"><?php echo $x["kind"] === 'offer' ? 'Offer or event line' : 'In their own words'; ?></span></h3>
    <p class="hint">From ${e('$x["first"] . " " . $x["last"]')} &lt;${e('$x["email"]')}&gt;, ${e('$day($x["created"])')}<?php if ($x["kind"] === 'offer') { ?>. To show until ${e('$x["until"]')}<?php } ?></p>
    <pre class="edit-ask">${e('$x["body"]')}</pre>
    ${form('$x["id"]', act('extra_ok', 'Publish it', 'btn primary') + act('extra_no', 'Decline'))}
  </div><?php } ?>
  <?php if ($extrasLive) { ?><h2>Words and offer lines on the site (<?php echo count($extrasLive); ?>)</h2>
  <?php foreach ($extrasLive as $x) { ?><div class="panel">
    <h3>${e('$name($x["listing"])')} <span class="hint"><?php echo $x["kind"] === 'offer' ? 'Offer or event line, until ' . htmlspecialchars($x["until"], ENT_QUOTES, 'UTF-8') : 'In their own words'; ?></span></h3>
    <pre class="edit-ask">${e('$x["body"]')}</pre>
    ${form('$x["id"]', act('extra_no', 'Take it down'))}
  </div><?php } ?><?php } ?>

` : ''}  <h2>Claimed listings (<?php echo count($claims); ?>)</h2>${testListings.length ? `
  <p class="hint" id="test-listings">Your test listings, hidden from the rest of the site: ${testListings.map(p => `<a href="../../programs/${esc(p.id)}/">${esc(p.name)}</a> (claimed with an address at ${esc(p.claimDomain)}${p.premium === true ? ', always premium' : ''})`).join(' and ')}.</p>` : ''}
  <?php if (!$claims) { ?><p class="hint">None yet.</p><?php } else { ?>${GROUPS.premium !== 'off' ? `
  <p class="hint">${GROUPS.premium === 'preview' ? 'Premium is being tried out: when you make a listing premium, its manager gets the premium tools, and what they add shows on the listing only to them (after you approve it). Nobody else sees it until premium is switched on for the site.' : 'Premium is on: a premium listing’s photos, own words, offer line and question button show to everyone, after you approve what the manager sends.'}</p>` : ''}
  <div class="stat-scroll"><table class="stat-table wrap"><thead><tr><th scope="col">Listing</th><th scope="col">Who</th><th scope="col">Since</th>${GROUPS.premium !== 'off' ? '<th scope="col">Premium</th>' : ''}<th scope="col"></th></tr></thead><tbody>
  <?php foreach ($claims as $c) { ?><tr><th scope="row">${e('$name($c["listing"])')}</th><td>${e('$c["first"] . " " . $c["last"]')}<br><span class="hint">${e('$c["email"]')}<?php if (isset($c["domain"]) && $c["domain"] === 'by hand') { ?> · given by hand<?php } ?></span></td><td>${e('$day($c["created"])')}</td>${GROUPS.premium !== 'off' ? `<td><?php if (in_array($c["listing"], $ALWAYS, true)) { ?><b>Premium</b><br><span class="hint">always: a test listing</span><?php } elseif (isset($premium[$c["listing"]])) { ?><b>Premium</b><br><span class="hint">since ${e('$day($premium[$c["listing"]])')}</span>${form('$c["id"]', act('premium_off', 'Turn off'))}<?php } else { ?><?php if (isset($asks[(int) $c["id"]])) { ?><b>Signed up: <?php echo $asks[(int) $c["id"]]["plan"] === 'year' ? 'yearly' : 'monthly'; ?></b><br><span class="hint">${e('$day($asks[(int) $c["id"]]["created"])')}</span><?php } ?>${form('$c["id"]', act('premium_on', 'Make it premium'))}<?php } ?></td>` : ''}<td>${form('$c["id"]', act('claim_remove', 'Take the claim away'))}</td></tr><?php } ?>
  </tbody></table></div>
  <?php } ?>
  <h2 id="grant">Give a listing to an account by hand</h2>
  <p class="hint">For someone you know runs a program whose email address isn’t at the program’s website (a Gmail address, say). They need a free account on the site first, with their name on it. The listing then shows as claimed, and they’re emailed.</p>
  <form method="post" action="./" class="g-form grant-form"><input type="hidden" name="csrf" value="${e('$csrf')}">
    <label for="grant-email">Their account’s email address</label><input id="grant-email" type="email" name="email" required autocomplete="off" maxlength="150">
    <label for="grant-listing">The listing</label><select id="grant-listing" name="listing" required><option value="">Choose a listing</option><?php foreach ($NAMES_AZ as $k => $n) { ?><option value="${e('$k')}">${e('$n')}</option><?php } ?></select>
    <div class="actions">${act('claim_grant', 'Give them the listing', 'btn primary')}</div>
  </form>
  <?php if ($declined) { ?><h2>Declined or taken away (<?php echo count($declined); ?>)</h2>
  <ul><?php foreach ($declined as $c) { ?><li>${e('$name($c["listing"])')}: ${e('$c["first"] . " " . $c["last"]')} &lt;${e('$c["email"]')}&gt; ${form('$c["id"]', act('claim_ok', 'Let it stand after all'))}</li><?php } ?></ul><?php } ?>
<?php } ?>
  <p><a class="btn" href="../">Back to editing</a> <a class="btn" href="../?out=1">Sign out</a></p>
</div>`;
  const page = layout({ title: 'Claims and proposed changes', description: 'Claims on listings and the changes program managers have proposed.', pathName: 'edit/claims/', depth: 2, current: null, hero, body, noindex: true, quiet: true });
  const names = JSON.stringify(Object.fromEntries(Object.entries(claimListings()).map(([k, v]) => [k, v.n]))).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `<?php
// The owner's review page for listing claims. Generated by build.mjs; edit it there.
${mailerPhp()}
${editAuthPhp()}
if (!edit_signed_in()) { header('Location: ../', true, 303); exit; }
$SITE = ${JSON.stringify(cfg.siteName)};
$SITE_URL = ${JSON.stringify(cfg.siteUrl)};
$FROM = ${JSON.stringify(cfg.contactEmail)};
$NAMES = json_decode('${names}', true);
$name = function ($key) use ($NAMES) { return isset($NAMES[$key]) ? $NAMES[$key] : $key . ' (no longer on the site)'; };
$NAMES_AZ = $NAMES; asort($NAMES_AZ, SORT_NATURAL | SORT_FLAG_CASE);
$day = function ($t) { $d = new DateTime('@' . (int) $t); $d->setTimezone(new DateTimeZone('America/New_York')); return $d->format('M j, Y'); };
$csrf = hash_hmac('sha256', 'claims-form', edit_key());
$said = isset($_GET['said']) && is_string($_GET['said']) ? substr($_GET['said'], 0, 200) : '';
$file = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-data/groups.sqlite';
$have = is_file($file);
$pending = array(); $claims = array(); $declined = array(); $edits = array(); $photosNew = array(); $photosLive = array(); $extrasNew = array(); $extrasLive = array(); $premium = array(); $asks = array();
$PREMIUM = ${JSON.stringify(GROUPS.premium)};
$ALWAYS = array(${testListings.filter(p => p.premium === true).map(p => JSON.stringify('p:' + p.id)).join(', ')});   // test listings that are premium without a payment
$photoFile = function ($id) { return dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-data/photos/' . (int) $id . '.jpg'; };
if ($have) {
  try {
    $db = new PDO('sqlite:' . $file);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $db->exec('PRAGMA busy_timeout=3000');
    $db->exec('PRAGMA foreign_keys=ON');
    $db->query('SELECT 1 FROM claims LIMIT 1');
  } catch (Exception $e) { $have = false; }   // no database yet, or one from before claims existed
}
// A photo, shown to the owner only: this page is behind the sign-in, and a waiting photo has no public address.
if ($have && isset($_GET['photo'])) {
  $f = $photoFile($_GET['photo']);
  if (!ctype_digit((string) $_GET['photo']) || !is_file($f)) { http_response_code(404); exit; }
  header('Content-Type: image/jpeg'); header('X-Content-Type-Options: nosniff'); header('Content-Length: ' . filesize($f));
  readfile($f); exit;
}
// Tells a director what was decided. Plain text, from the site's own address.
function tell($to, $subject, $text) {
  global $SITE, $FROM;
  if (pas_postmark($SITE, $FROM, $to, $subject, $text . "\\n\\n" . $SITE, '', $FROM) >= 0) return;
  @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $text . "\\n\\n" . $SITE, implode("\\r\\n", array('From: ' . $SITE . ' <' . $FROM . '>', 'Reply-To: ' . $FROM, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8')));
}
if ($have && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $ok = isset($_POST['csrf']) && is_string($_POST['csrf']) && hash_equals($csrf, $_POST['csrf']);
  $do = isset($_POST['do']) && is_string($_POST['do']) ? $_POST['do'] : '';
  $id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
  $msg = 'That didn’t go through. Try again.';
  // Give a listing to an account by hand: for someone the owner knows runs it, whose address isn't at its website.
  if ($ok && $do === 'claim_grant') {
    $email = strtolower(trim(isset($_POST['email']) && is_string($_POST['email']) ? substr($_POST['email'], 0, 150) : ''));
    $key = isset($_POST['listing']) && is_string($_POST['listing']) ? $_POST['listing'] : '';
    $st = $db->prepare('SELECT id, email, first, last FROM users WHERE email = ?'); $st->execute(array($email)); $u = $st->fetch();
    if (!isset($NAMES[$key])) $msg = 'Pick a listing from the list.';
    elseif (!$u) $msg = 'No account uses that address. Ask them to create a free account on the site first, then do this again.';
    elseif ($u['first'] === '' || $u['last'] === '') $msg = 'That account has no name on it yet. Ask them to finish signing up, then do this again.';
    else {
      $st = $db->prepare('SELECT id, status FROM claims WHERE user_id = ? AND listing = ?'); $st->execute(array($u['id'], $key)); $c = $st->fetch();
      if ($c && $c['status'] === 'ok') $msg = 'They already hold that listing.';
      else {
        if ($c) $db->prepare("UPDATE claims SET status = 'ok', domain = 'by hand', decided = ? WHERE id = ?")->execute(array(time(), $c['id']));
        else $db->prepare("INSERT INTO claims (user_id, listing, status, domain, created, decided) VALUES (?, ?, 'ok', 'by hand', ?, ?)")->execute(array($u['id'], $key, time(), time()));
        try { $db->prepare('UPDATE users SET told = 2 WHERE id = ?')->execute(array($u['id'])); } catch (Exception $e) { /* a database from before that column */ }
        $n = $name($key);
        tell($u['email'], 'You now manage ' . $n . ' on ' . $SITE, 'Hi ' . $u['first'] . ",\\n\\nWe’ve given your account the listing “" . $n . '” on ' . $SITE . '. It now shows as claimed. Sign in with this email address to send changes to it, say whether there’s space and see its numbers:' . "\\n" . $SITE_URL . '/managers/');
        $msg = 'Done. ' . $u['first'] . ' ' . $u['last'] . ' now holds ' . $n . ', and they’ve been told.';
      }
    }
  }
  if ($ok && in_array($do, array('claim_ok', 'claim_no', 'claim_remove'), true)) {
    $st = $db->prepare('SELECT c.id, c.listing, c.status, u.email, u.first FROM claims c JOIN users u ON u.id = c.user_id WHERE c.id = ?'); $st->execute(array($id)); $c = $st->fetch();
    if ($c) {
      $to = $do === 'claim_ok' ? 'ok' : 'declined';
      $db->prepare('UPDATE claims SET status = ?, decided = ? WHERE id = ?')->execute(array($to, time(), $id));
      $n = $name($c['listing']);
      if ($to === 'ok') tell($c['email'], 'Your claim on ' . $n . ' is approved', 'Hi ' . $c['first'] . ",\\n\\nYour claim on “" . $n . '” at ' . $SITE . ' is approved. The listing now shows as claimed, and you can send changes to it here:' . "\\n" . $SITE_URL . '/managers/');
      else tell($c['email'], 'About your claim on ' . $n, 'Hi ' . $c['first'] . ",\\n\\nWe couldn’t confirm your claim on “" . $n . '” at ' . $SITE . ', so it has been ' . ($do === 'claim_remove' ? 'removed' : 'declined') . '. If that looks wrong, reply to this email and tell us how you’re connected to the program.');
      $msg = $to === 'ok' ? 'Approved, and they’ve been told.' : 'Done, and they’ve been told.';
    }
  } elseif ($ok && in_array($do, array('edit_done', 'edit_no'), true)) {
    $st = $db->prepare('SELECT e.id, e.listing, u.email, u.first FROM edits e JOIN claims c ON c.id = e.claim_id JOIN users u ON u.id = c.user_id WHERE e.id = ?'); $st->execute(array($id)); $x = $st->fetch();
    if ($x) {
      $db->prepare('UPDATE edits SET status = ?, decided = ? WHERE id = ?')->execute(array($do === 'edit_done' ? 'done' : 'declined', time(), $id));
      $n = $name($x['listing']);
      if ($do === 'edit_done') tell($x['email'], 'Your change to ' . $n . ' is published', 'Hi ' . $x['first'] . ",\\n\\nThe change you sent for “" . $n . '” is on the site now. Have a look, and send another if anything is off:' . "\\n" . $SITE_URL . '/managers/');
      else tell($x['email'], 'About the change you sent for ' . $n, 'Hi ' . $x['first'] . ",\\n\\nWe weren’t able to make the change you sent for “" . $n . '”, usually because we couldn’t find it on the program’s own website. Reply to this email if you’d like to talk it through.');
      $msg = $do === 'edit_done' ? 'Marked published, and they’ve been told.' : 'Declined, and they’ve been told.';
    }
  }
  if ($ok && in_array($do, array('photo_ok', 'photo_no'), true)) {
    try {
      $st = $db->prepare('SELECT p.*, u.email, u.first FROM photos p JOIN claims c ON c.id = p.claim_id JOIN users u ON u.id = c.user_id WHERE p.id = ?'); $st->execute(array($id)); $x = $st->fetch();
      if ($x) {
        $n = $name($x['listing']);
        if ($do === 'photo_ok') {
          // one photo a listing, and one logo; a premium listing keeps the photos it already has, up to six
          $kind = isset($x['kind']) ? $x['kind'] : 'photo';
          $isPrem = false; try { $pq = $db->prepare('SELECT 1 FROM premium WHERE listing = ?'); $pq->execute(array($x['listing'])); $isPrem = $PREMIUM !== 'off' && ((bool) $pq->fetchColumn() || in_array($x['listing'], $ALWAYS, true)); } catch (Exception $e) { $isPrem = false; }
          if ($isPrem && $kind === 'photo') {
            $keep = $db->prepare("SELECT id FROM photos WHERE listing = ? AND kind = 'photo' AND status = 'ok' AND id != ? ORDER BY id DESC"); $keep->execute(array($x['listing'], $id));
            foreach (array_slice($keep->fetchAll(PDO::FETCH_COLUMN), 5) as $old) { $db->prepare("UPDATE photos SET status = 'declined', decided = ? WHERE id = ?")->execute(array(time(), (int) $old)); @unlink($photoFile((int) $old)); }
          } else {
            try { $db->prepare("UPDATE photos SET status = 'declined', decided = ? WHERE listing = ? AND kind = ? AND status = 'ok' AND id != ?")->execute(array(time(), $x['listing'], $kind, $id)); }
            catch (Exception $e) { $db->prepare("UPDATE photos SET status = 'declined', decided = ? WHERE listing = ? AND status = 'ok' AND id != ?")->execute(array(time(), $x['listing'], $id)); }
          }
          $db->prepare("UPDATE photos SET status = 'ok', decided = ? WHERE id = ?")->execute(array(time(), $id));
          $seen = $isPrem && $PREMIUM === 'preview' ? ' For now only you can see it there, while premium listings are being tried out.' : '';
          tell($x['email'], 'Your ' . $kind . ' for ' . $n . ' is on the site', 'Hi ' . $x['first'] . ",\n\nThe " . $kind . " you sent for “" . $n . '” is on the listing now.' . $seen . ' You can replace or remove it here:' . "\n" . $SITE_URL . '/managers/');
          $msg = 'Published, and they’ve been told.';
        } else {
          $was = $x['status'];
          $db->prepare("UPDATE photos SET status = 'declined', decided = ? WHERE id = ?")->execute(array(time(), $id));
          @unlink($photoFile($id));
          tell($x['email'], 'About the photo you sent for ' . $n, 'Hi ' . $x['first'] . ",\n\nWe " . ($was === 'ok' ? 'have taken down' : 'weren’t able to use') . ' the photo you sent for “' . $n . '”. You’re welcome to send another: a clear picture of the space or an activity works best, with permission from the families of any children in it. Reply to this email with any questions.');
          $msg = $was === 'ok' ? 'Taken down, and they’ve been told.' : 'Declined, and they’ve been told.';
        }
      }
    } catch (Exception $e) { /* a database from before photos: nothing to do */ }
  }
  // Premium: which listings are, and what their managers wrote.
  if ($ok && $PREMIUM !== 'off' && in_array($do, array('premium_on', 'premium_off'), true)) {
    try {
      $st = $db->prepare("SELECT c.listing, u.email, u.first FROM claims c JOIN users u ON u.id = c.user_id WHERE c.id = ? AND c.status = 'ok'"); $st->execute(array($id)); $c = $st->fetch();
      if ($c) {
        $n = $name($c['listing']);
        if ($do === 'premium_on') {
          $db->prepare('INSERT OR IGNORE INTO premium (listing, since) VALUES (?, ?)')->execute(array($c['listing'], time()));
          tell($c['email'], $n . ' now has a premium listing', 'Hi ' . $c['first'] . ",\n\n“" . $n . '” on ' . $SITE . ' now has the premium tools: up to six photos and a logo, a section in your own words, an offer or event line, a button parents can use to send you a question, fuller numbers, and a flyer to print.' . ($PREMIUM === 'preview' ? ' We’re still trying these out, so for now what you add shows on your listing only to you.' : '') . ' You’ll find them under your listing here:' . "\n" . $SITE_URL . '/managers/');
          $msg = 'It’s premium now, and its manager has been told.';
        } else {
          $db->prepare('DELETE FROM premium WHERE listing = ?')->execute(array($c['listing']));
          $msg = 'Premium is off for that listing. What its manager added is kept, and hidden.';
        }
      }
    } catch (Exception $e) { $msg = 'That didn’t go through: the database isn’t ready for premium yet. Open the site once and try again.'; }
  }
  if ($ok && $PREMIUM !== 'off' && in_array($do, array('extra_ok', 'extra_no'), true)) {
    try {
      $st = $db->prepare('SELECT e.id, e.listing, e.kind, e.status, u.email, u.first FROM extras e JOIN claims c ON c.id = e.claim_id JOIN users u ON u.id = c.user_id WHERE e.id = ?'); $st->execute(array($id)); $x = $st->fetch();
      if ($x) {
        $n = $name($x['listing']); $what = $x['kind'] === 'offer' ? 'offer line' : 'section in your own words';
        if ($do === 'extra_ok') {
          $db->prepare("DELETE FROM extras WHERE listing = ? AND kind = ? AND status = 'ok' AND id != ?")->execute(array($x['listing'], $x['kind'], $id));   // the newer one takes its place
          $db->prepare("UPDATE extras SET status = 'ok', decided = ? WHERE id = ?")->execute(array(time(), $id));
          tell($x['email'], 'Your ' . $what . ' for ' . $n . ' is on the site', 'Hi ' . $x['first'] . ",\n\nThe " . $what . ' you wrote for “' . $n . '” is on the listing now.' . ($PREMIUM === 'preview' ? ' For now only you can see it there, while premium listings are being tried out.' : '') . ' You can change it or take it down here:' . "\n" . $SITE_URL . '/managers/');
          $msg = 'Published, and they’ve been told.';
        } else {
          $was = $x['status'];
          $db->prepare("UPDATE extras SET status = 'declined', decided = ? WHERE id = ?")->execute(array(time(), $id));
          tell($x['email'], 'About the ' . $what . ' for ' . $n, 'Hi ' . $x['first'] . ",\n\nWe " . ($was === 'ok' ? 'have taken down' : 'weren’t able to publish') . ' the ' . $what . ' you wrote for “' . $n . '”. It should describe the program in plain words, with no prices that differ from the listing and no claims about other programs. You’re welcome to send another, or reply to this email with any questions.');
          $msg = $was === 'ok' ? 'Taken down, and they’ve been told.' : 'Declined, and they’ve been told.';
        }
      }
    } catch (Exception $e) { /* a database from before premium: nothing to do */ }
  }
  header('Location: ./?said=' . rawurlencode($msg), true, 303);
  exit;
}
if ($have) {
  $all = $db->query('SELECT c.id, c.listing, c.status, c.domain, c.created, u.email, u.first, u.last FROM claims c JOIN users u ON u.id = c.user_id ORDER BY c.id DESC')->fetchAll();
  foreach ($all as $c) { if ($c['status'] === 'pending') $pending[] = $c; elseif ($c['status'] === 'ok') $claims[] = $c; else $declined[] = $c; }
  $edits = $db->query("SELECT e.id, e.listing, e.body, e.link, e.created, u.email, u.first, u.last FROM edits e JOIN claims c ON c.id = e.claim_id JOIN users u ON u.id = c.user_id WHERE e.status = 'new' ORDER BY e.id")->fetchAll();
  try {
    foreach ($db->query("SELECT p.*, u.email, u.first, u.last FROM photos p JOIN claims c ON c.id = p.claim_id JOIN users u ON u.id = c.user_id WHERE p.status != 'declined' AND c.status = 'ok' ORDER BY p.id") as $x) { if (!is_file($photoFile($x['id']))) continue; if ($x['status'] === 'new') $photosNew[] = $x; else $photosLive[] = $x; }
  } catch (Exception $e) { /* a database from before photos */ }
  if ($PREMIUM !== 'off') try {
    foreach ($db->query('SELECT listing, since FROM premium') as $x) $premium[$x['listing']] = (int) $x['since'];
    try { foreach ($db->query('SELECT claim_id, plan, created FROM premium_asks') as $x) $asks[(int) $x['claim_id']] = $x; } catch (Exception $e) { /* a database from before sign-ups */ }
    $today = (new DateTime('now', new DateTimeZone('America/New_York')))->format('Y-m-d');
    foreach ($db->query("SELECT e.id, e.listing, e.kind, e.body, e.until, e.status, e.created, u.email, u.first, u.last FROM extras e JOIN claims c ON c.id = e.claim_id JOIN users u ON u.id = c.user_id WHERE e.status != 'declined' AND c.status = 'ok' ORDER BY e.id") as $x) {
      if ($x['status'] === 'new') $extrasNew[] = $x; elseif ($x['kind'] !== 'offer' || $x['until'] >= $today) $extrasLive[] = $x;
    }
  } catch (Exception $e) { /* a database from before premium: it is made the next time anyone opens the site */ }
}
?>
${page}`;
}

// What the group and join pages need to know about programs: names and colors to show, classes to recognise.
const groupsInfo = () => ({
  site: cfg.siteName,
  types: Object.fromEntries(TYPES.map(t => [t.id, { color: t.color }])),
  programs: Object.fromEntries(programs.map(p => [p.id, { name: p.name, type: p.types[0], offers: p.offers || [], ...(p.weekend ? { wk: 1 } : {}) }])),
});
function joinPage() {
  const hero = `    <h1>${T(`Open your invitation`)}</h1>
    <p class="lede">${T(`Someone shared a week with you or invited you to a group. Sign in with the email address the invitation was sent to: it only opens for that address.`)}</p>`;
  const body = `<div ${groupsAttrs(1)} data-clarity-mask="true" style="display:contents">
  <noscript><p class="ask">${T(`Joining a group needs JavaScript turned on.`)}</p></noscript>
  <div class="g-page" id="join"></div>
  <section class="notes">
    <h2>${T(`What gets shared`)}</h2>
    <ul>
      <li>${T(`A child’s first name and the programs on their week. No last names, addresses, notes or photos.`)}</li>
      <li>${T(`Only the people invited by email address can see it. Its link shows nothing to anyone else.`)}</li>
      <li>${T(`If you add your own child’s week to a group, you can take it back out, leave the group or delete your account at any time.`)}</li>
    </ul>
    <p><a href="${link('privacy/', 1)}#groups">${T(`The full details are on the privacy page.`)}</a></p>
  </section>
  <script type="application/json" id="groups-data">${JSON.stringify(groupsInfo()).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: 'Open your invitation', description: `Open an invitation on ${cfg.siteName} with the email address it was sent to.`, pathName: 'join/', depth: 1, current: null, hero, body, noindex: true, quiet: true, scripts: groupsScript(1) });
}
function groupPage() {
  const info = groupsInfo();
  const hero = `    <h1 id="group-title">${T(`Your group`)}</h1>
    <p class="lede" id="group-lede">${T(`Only the people invited to this group can see it.`)}</p>`;
  const body = `<div ${groupsAttrs(1)} data-clarity-mask="true" style="display:contents">
  <noscript><p class="ask">${T(`Groups need JavaScript turned on.`)}</p></noscript>
  <div class="g-page" id="group"></div>
  <script type="application/json" id="groups-data">${JSON.stringify(info).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: 'A share group', description: `A private share group on ${cfg.siteName}.`, pathName: 'groups/', depth: 1, current: null, hero, body, noindex: true, quiet: true, scripts: groupsScript(1) });
}
// The server side: one file, copied from src/server with the few settings it needs.
function groupsApiPhp() {
  const end = daysOff?.lastDay ? new Date(new Date(daysOff.lastDay + 'T12:00:00Z').getTime() + 14 * 86400000).toISOString().slice(0, 10) : '';
  const conf = JSON.stringify({ siteName: cfg.siteName, siteUrl: cfg.siteUrl, from: cfg.contactEmail, admins: GATED ? ADMINS : [], yearEnd: end, googleClientId: GROUPS.google, grades: GRADES, ages: AGES, listings: claimListings(), camps: summerCamps.map(c => c.id), photos: GROUPS.photos, premium: GROUPS.premium, premiumPage: PM_LISTED, premiumAlways: testListings.filter(p => p.premium === true).map(p => 'p:' + p.id), hoods: Object.fromEntries(accountHoods().map(h => [h.id, h.name])), citySchools: Object.fromEntries(finderData.schools.filter(r => !r[5]).map(r => [r[0], `${r[1]} (${r[2]})`])) });
  const src = phpCopy(fs.readFileSync(path.join(ROOT, 'src/server/groups-api.php'), 'utf8'));
  if (!src.includes(`'/*CONFIG*/'`)) throw new Error('src/server/groups-api.php has lost its /*CONFIG*/ marker');
  if (!src.includes('/*MAILER*/')) throw new Error('src/server/groups-api.php has lost its /*MAILER*/ marker');
  return src.replace('/*MAILER*/', () => mailerPhp()).replace(`'/*CONFIG*/'`, () => `'` + conf.replace(/\\/g, '\\\\').replace(/'/g, `\\'`) + `'`);
}
// The wording of the emails the server sends is written in src/server/groups-api.php as __T("…"), with {words} filled
// in at send time by its t() helper. The build turns each into a PHP string with any edit from data/copy.json applied
// (an emptied sentence becomes ''), and registers it like a page sentence, so it can be edited at /edit/emails/.
// A /*EMAIL Name*/ comment before each email names it; the sentences that follow belong to it, in order.
const EMAILS = [];   // [{ name, sentences: [original, …] }] in source order
function phpCopy(src) {
  EMAILS.length = 0;
  const marks = [...src.matchAll(/\/\*EMAIL ([^*]+?)\*\//g)].map(m => ({ at: m.index, name: m[1].trim() }));
  const emailAt = pos => { let e = null; for (const m of marks) if (m.at < pos) e = m; return e; };
  const byName = new Map();
  const quote = t => `'` + String(t).replace(/\\/g, '\\\\').replace(/'/g, `\\'`) + `'`;
  let n = 0;
  const out = src.replace(/__T\("((?:[^"\\]|\\.)*)"\)/g, (m, lit, at) => {
    n++;
    const original = JSON.parse('"' + lit + '"');
    const id = copyId(original);
    copyRegistry.set(id, original);
    const mark = emailAt(at);
    if (mark) { if (!byName.has(mark.name)) { byName.set(mark.name, []); EMAILS.push({ name: mark.name, sentences: byName.get(mark.name) }); } byName.get(mark.name).push(original); }
    return quote(isRemoved(id) ? '' : (typeof copyEdits[id]?.now === 'string' ? copyEdits[id].now : original));
  });
  const left = (out.match(/__T\(/g) || []).length;
  if (left) throw new Error('src/server/groups-api.php: ' + left + ' __T( call(s) could not be read (a sentence must be one double-quoted string with no raw double quotes inside)');
  return out;
}

function boardPage() {
  const order = [...programs].sort((a, b) => a.name.localeCompare(b.name)).map(p => p.id);   // each program's card number
  const data = {
    total: programs.filter(p => !campOnly(p)).length,
    site: cfg.siteUrl, qr: cardQr && cardQr.text.toLowerCase().startsWith(cfg.siteUrl.toLowerCase() + '/') ? cardQr.rows : null,
    suggest: link('suggest/', 1),
    rels: Object.fromEntries(Object.entries(REL).map(([k, v]) => [k, v.pill])),
    types: Object.fromEntries(TYPES.map(t => [t.id, { label: t.label, color: t.color, icon: t.icon }])),
    schools: Object.fromEntries(schools.map(s => [s.id, { name: s.shortName, path: link(s.id + '/', 1) }])),
    themes: Object.fromEntries(THEMES.map(t => [t.id, { types: t.types, mix: !!t.mix, words: t.words || [] }])),
    // Programs with weekend classes, for the optional Saturday and Sunday. Some of them are not after-school listings at all.
    weekendPath: link(weekendPath, 1),
    weekend: Object.fromEntries(programs.filter(p => p.weekend).map(p => [p.id, { name: p.name, hood: programHoods(p)[0] || '', type: p.types[0], days: p.weekend.days, times: p.weekend.times || null, path: link(programPath(p), 1) }])),
    programs: Object.fromEntries(programs.filter(p => !campOnly(p)).map(p => [p.id, {
      name: p.name, hours: p.hours, pickupBy: p.pickupBy || '', offers: p.offers || [], type: p.types[0], no: order.indexOf(p.id) + 1,
      days: p.days || null, offerDays: p.offerDays || null, rate: p.rate || null, types: p.types, grades: p._grades, kw: (p.keywords || []).map(k => k.toLowerCase()), cls: p._cls || null,
      path: link(programPath(p), 1), q: [p.name, ...(p.offers || []), ...(p.keywords || []), ...p.types.map(t => TYPE[t].label)].join(' ').toLowerCase(),
      schools: Object.fromEntries(Object.entries(p.schools).map(([sid, l]) => [sid, { rel: l.relation, where: l.address || p.address || '', free: (l.price || p.price) === 'free' }])),
    }])),
  };
  const schoolLinks = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `<a class="btn" href="${link(s.id + '/', 1)}">${esc(s.shortName)}</a>`).join('');
  const hero = `    <h1>${T(`Build your week`)}</h1>
    <p class="lede">${T(`Monday might be martial arts and Thursday the rec center. Plan the term that’s coming, keep a second roster for what your child is doing now, and send either to your partner, a sitter, or the group chat. More than one child? Each gets their own.`)}</p>${heroCta(1, 'board')}`;
  const body = `${GATE ? `<section class="section when-out" id="board-ask">
  ${planShow('week', 1)}
</section>
` : ''}<div data-board-page data-clarity-mask="true" style="display:contents">
  <noscript><p class="ask">${T(`The roster needs JavaScript turned on.`)}</p></noscript>
  <div class="panel" id="board-retired" data-edit-reveal="Shown when someone opens an old link to a week:" hidden>
    <h2>${T(`That link doesn’t open a week any more`)}</h2>
    <p>${T(`Weeks used to be shared as a link that anyone could open. They aren’t now. Ask the person who sent it to share the week with your email address instead: you’ll get an invitation, and it will open once you sign in.`)}</p>
    <div class="actions"><button type="button" class="btn" id="board-retired-ok">OK</button></div>
  </div>
  <div${gateIn} style="display:contents">
  <section class="section">
    <div class="kid-bar" id="kid-bar">
      <div class="kids" id="kid-tabs" role="group" aria-label="Which child" hidden></div>
      <div class="field">
        <label for="board-name">${T(`Child’s name`)}</label>
        <input id="board-name" type="text" maxlength="40" placeholder="Sam" autocomplete="off">
        <span class="hint">${GATE ? T(`A first name, a nickname or an initial. It shows on the roster you share, and it’s how your profile tells one child’s week from another’s.`) : T(`Optional. It shows on the roster you share.`)}</span>
      </div>
      <div class="actions"><button type="button" class="btn" id="kid-add">Add another child</button><button type="button" class="clear" id="kid-remove" hidden>Remove this child</button></div>
    </div>
    <div class="tabs" id="board-tabs" role="group" aria-label="Current or upcoming roster">
      <button type="button" class="tab" data-board="next" aria-pressed="true">Upcoming</button>
      <button type="button" class="tab" data-board="now" aria-pressed="false">Current</button>
    </div>
    <div class="year-view-head board-view-head">
      <h2 id="board-title">Your upcoming week</h2>
      <div class="tabs view-switch board-views needs-js-block" id="board-views" role="group" aria-label="How to see this week" data-views="week">
        <button type="button" class="tab vs" data-view="week" aria-pressed="true"><span class="vs-long">${T(`The week`)}</span><span class="vs-short" aria-hidden="true">${T(`Week`)}</span></button><button type="button" class="tab vs" data-view="cost" aria-pressed="false"><span class="vs-long">${T(`Budget planning`)}</span><span class="vs-short" aria-hidden="true">${T(`Budget`)}</span></button><button type="button" class="tab vs" data-view="card" aria-pressed="false"><span class="vs-long">${T(`Make it a card`)}</span><span class="vs-short" aria-hidden="true">${T(`Card`)}</span></button>${GROUPS ? `<button type="button" class="tab vs" data-view="keep" aria-pressed="false"><span class="vs-long">${T(`Keep & share`)}</span><span class="vs-short" aria-hidden="true">${T(`Share`)}</span></button>` : ''}
      </div>
    </div>
    <div data-pane="week" style="display:contents">
    <div class="adder needs-js-block" id="board-adder">
      <div class="adder-find">
        <label for="add-search">${T(`Add a program`)}</label>
        <input id="add-search" type="search" role="combobox" aria-expanded="false" aria-controls="add-list" aria-autocomplete="list" placeholder="Start typing a program’s name" autocomplete="off">
        <ul id="add-list" class="finder-list" role="listbox" aria-label="Programs" hidden></ul>
      </div>
      <div class="panel add-panel" id="add-panel" hidden></div>
      <p class="hint" id="add-status" aria-live="polite"></p>
    </div>
    <details class="roller needs-js-block" id="roller">
      <summary><svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="${DICE}"/></svg><span class="roller-head"><b>${T(`Roll a themed week`)}</b><span>${T(`Pick a school and a theme, and we’ll fill Monday to Friday.`)}</span></span></summary>
      <div class="roller-body">
        <div class="pair">
          <div class="field">
            <label for="roll-school">${T(`School`)}</label>
            <select id="roll-school"><option value="">Choose a school</option>${[...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `<option value="${esc(s.id)}">${esc(s.shortName)}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label for="roll-grade">${T(`Grade`)}</label>
            <select id="roll-grade"><option value="">Any grade</option>${GRADES.map(g => `<option value="${g}">${g === 'PK' ? 'Pre-K' : g === 'K' ? 'Kindergarten' : 'Grade ' + g}</option>`).join('')}</select>
            <span class="hint">${T(`Optional. It skips programs that don’t take that grade.`)}</span>
          </div>
        </div>
        <div class="roller-themes" id="roll-themes" role="group" aria-label="Theme">
          ${THEMES.map(t => `<button type="button" class="theme" data-theme="${t.id}" style="--tc:${t.color || TYPE[t.types[0]].color}" disabled><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="${t.icon || TYPE[t.types[0]].icon}"/></svg><span><b>${T(t.name)}</b><span>${T(t.blurb)}</span><span class="theme-n" data-n></span></span></button>`).join('\n          ')}
        </div>
        <p class="roller-status" id="roll-status" aria-live="polite"></p>
        <div class="actions" id="roll-after" hidden><button type="button" class="btn" id="roll-again">Roll again</button><button type="button" class="clear" id="roll-undo">Put back what I had</button></div>
        <p class="hint">${T(`A themed week is a starting point, picked at random from what’s listed for that school. Check days, ages and open spots with each program before you plan around it.`)}</p>
      </div>
    </details>
    <div class="panel" id="board-empty" hidden>
      <p id="board-empty-text">Search for a program above and pick its days. Or open a school’s page and choose “Add to roster” on any program.</p>
      <div class="actions">${schoolLinks}</div>
    </div>
    <p class="hint" id="board-hint" hidden>${T(`Drag a card by its colored top to move it to another day, or use the day buttons on the card.`)}</p>
    <div class="week" id="week"></div>
    <div class="wkend" id="wkend" hidden></div>
    <div class="share-cta" id="share-cta" hidden>
      <canvas id="share-thumb" width="216" height="270" aria-hidden="true"></canvas>
      <div class="share-cta-text">
        <b>${T(`Looks right? Make it a picture.`)}</b>
        <span>${T(`One card of the week to text to your partner, stick on the fridge or hand to a teacher.`)}</span>
      </div>
      <button type="button" class="btn primary big" id="share-cta-btn">${T(`Share this schedule`)}</button>
    </div>
    <button type="button" class="clear" id="board-promote" hidden>The new term has started: make this the current roster</button>
    <p class="hint" id="board-status" aria-live="polite"></p>
    <div class="board-tools" id="board-tools" hidden><button type="button" class="clear" id="board-clear">Clear this roster</button></div>
    </div>
  <div data-pane="cost" style="display:contents">
  <section class="section costbox" id="board-cost" hidden>
    <h2>${T(`What this roster costs`)}</h2>
    <p class="cost-total" id="cost-total"></p>
    <p id="cost-month"></p>
    <ul class="cost-lines" id="cost-lines"></ul>
    <p class="cost-family" id="cost-family" hidden></p>
    <p class="hint">${T(`An estimate from each program’s published prices, for half a school year: 18 weeks of school, or five monthly bills. It leaves out registration fees, deposits, materials, sibling discounts, subsidies and financial aid. If you know what you’ll pay, add it to any line; it stays on this device. Confirm the price with each program before you budget on it.`)}</p>
  </section>
  </div>
  <div data-pane="card" style="display:contents">
  <section class="section card-maker" id="card-maker" hidden>
    <h2 tabindex="-1">${T(`Make it a card`)}</h2>
    <p>${T(`One picture of the week to text, print, or hand to your child’s teacher, so they know where your child goes each day and who they are.`)}</p>
    <div class="card-grid">
      <div class="card-fields">
        <div class="field">
          <label for="card-teacher">${T(`Who it’s for (optional)`)}</label>
          <input id="card-teacher" type="text" maxlength="40" placeholder="Ms. Rivera, Room 12" autocomplete="off">
        </div>
        <div class="field">
          <label for="card-note">${T(`A note (optional)`)}</label>
          <input id="card-note" type="text" maxlength="110" placeholder="Grandma picks up on Fridays." autocomplete="off">
        </div>
        <div class="field">
          <label for="card-photo">${T(`Your child’s photo (optional)`)}</label>
          <input id="card-photo" type="file" accept="image/*">
          <span class="hint">${T(`The photo never leaves this device. The card is made here in your browser, nothing is uploaded, and the photo isn’t saved.`)}</span>
          <button type="button" class="clear" id="card-photo-clear" hidden>Remove the photo</button>
        </div>
        <div class="actions">
          <button type="button" class="btn primary" id="card-share" hidden>Share the card</button>
          <button type="button" class="btn" id="card-copy-pic" hidden>Copy picture</button>
          <button type="button" class="btn" id="card-save">Save as image</button>
          <button type="button" class="btn" id="card-print">Print</button>
        </div>
        <p class="hint" id="card-status" aria-live="polite"></p>
        <p class="hint">${T(`To email it to a teacher, share or save the card, then attach it to a message from your own email.`)}</p>
        ${GROUPS ? `<div class="card-next" id="card-next" data-edit-reveal="Shown once someone has shared, saved, copied or printed a card:" hidden>
          <b>${T(`Want to keep this week too?`)}</b>
          <span>${T(`Save it to a free account so it’s on your phone and your computer, or share it with someone who signs in to see it.`)}</span>
          <a class="btn primary" href="#keep" data-go-view="keep">${T(`Save or share this week`)}</a>
        </div>` : ''}
      </div>
      <div class="card-preview"><canvas id="card-canvas" width="1080" height="1350" role="img" aria-label="Preview of the week card"></canvas></div>
    </div>
  </section>
  </div>
  ${GROUPS ? `<div data-pane="keep" style="display:contents">
  <section class="section group-share" id="group-share" ${groupsAttrs(1)} hidden></section>
  </div>` : ''}
  <section class="section rv-nudge" id="rv-nudge" data-rv-place="week" data-review="${link('review/', 1)}" aria-live="polite" hidden></section>
  </section>
  ${rvNames()}
  ${nextOff(1).replace(T(`Days off this year, and who’s open`), T(`Plan the days off too`))}
  ${ALERTS ? `<p class="hint alerts-line">${T(`Want next term’s sign-up dates before they open?`)} <a href="${link(alertsPath, 1)}">${T(`Get the dates by email.`)}</a></p>` : ''}
  </div>
  <script type="application/json" id="pas-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: 'Build your week', description: `Put together a Monday to Friday after-school roster for each child from ${cfg.siteName} listings and turn it into a card to share.`, pathName: 'board/', depth: 1, current: 'board/', hero, body, next: GATE ? 'board' : '',
    // An old shared-roster link carries a child's first name after the #. Those links are retired, but one may still be
    // opened. This runs before any analytics loads: it notes that one arrived and takes it out of the address.
    scripts: GROUPS ? groupsScript(1) : '',
    first: `<script>(function(){var h=location.hash;if(!/(^#|&)(mon|tue|wed|thu|fri)=/.test(h))return;window.__pasShared=h;try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}})();</script>\n` });
}

// The names of the programs that can be reviewed, for the pages that ask "has your family been to ...?".
const rvNames = () => `<script type="application/json" id="rv-names">${JSON.stringify(Object.fromEntries(programs.map(p => [p.id, p.name]))).replace(/</g, '\\u003c')}</script>`;
function reviewPage() {
  const progOpts = [...programs].sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  const schoolOpts = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `<option value="${esc(s.id)}">${esc(s.shortName)}</option>`).join('');
  const hero = `    <h1>${T(`How did it go?`)}</h1>
    <p class="lede">${T(`A first-hand note from one family helps the next one choose. Every review is read before it’s posted.`)}</p>`;
  const body = `<div class="suggest">
  <form class="form panel" method="post" action="send.php" id="review-form" data-clarity-mask="true"${GROUPS && !PREVIEW ? ` data-api="${link('groups/api.php', 1)}"` : ''}>
    <div class="pair">
      <div class="field">
        <label for="r-program">${T(`Which program?`)}</label>
        <select id="r-program" name="program" required>${progOpts}</select>
      </div>
      <div class="field">
        <label for="r-school">${T(`Your child’s school`)}</label>
        <select id="r-school" name="school" required>${schoolOpts}</select>
      </div>
    </div>
    <fieldset class="field chips">
      <legend>${T(`Your rating`)}</legend>
      <div class="chip-row">${[5, 4, 3, 2, 1].map((n, i) => `<label class="chip"><input type="radio" name="stars" value="${n}"${i === 0 ? ' required' : ''}><span>${n} ${n === 1 ? 'star' : 'stars'}</span></label>`).join('')}</div>
    </fieldset>
    <div class="field">
      <label for="r-comment">${T(`Your review`)}</label>
      <span class="hint">${T(`What was pickup like? Homework help? Would you sign up again?`)}</span>
      <textarea id="r-comment" name="comment" minlength="20" maxlength="1200" required></textarea>
    </div>
    <div class="pair">
      <div class="field">
        <label for="r-name">${T(`Your first name`)}</label>
        <input id="r-name" name="name" type="text" maxlength="40" autocomplete="given-name" required>
        <span class="hint">${T(`Shown with your review.`)}</span>
      </div>
      <div class="field">
        <label for="r-email">${T(`Your email`)}</label>
        <input id="r-email" name="email" type="email" maxlength="150" autocomplete="email" required>
        <span class="hint">${T(`Never shown. Only used if we need to confirm something.`)} <a href="${link('privacy/', 1)}">${T(`How we handle it.`)}</a></span>
      </div>
    </div>
    <label class="check"><input type="checkbox" name="firsthand" value="yes" required><span>${T(`This is my own experience as a parent or caregiver.`)}</span></label>
    <div class="hp" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">
      <label for="r-company">Leave this blank</label>
      <input id="r-company" name="company" type="text" tabindex="-1" autocomplete="off">
    </div>
    <div><button class="btn primary big" type="submit">${T(`Send review`)}</button></div>
  </form>
  <aside class="next">
    <h2>${T(`House rules`)}</h2>
    <ul class="rules">
      <li>${T(`First-hand only. Write about what your own family experienced.`)}</li>
      <li>${T(`Be specific and fair. Details help more than adjectives.`)}</li>
      <li>${T(`No names of children or individual staff.`)}</li>
      <li>${T(`Programs can’t review themselves.`)}</li>
    </ul>
    <p class="hint">${T(`Reviews show your first name and school, and appear after they’ve been read. Nobody pays to have a review posted or removed.`)}</p>
  </aside>
</div>`;
  return layout({ title: 'Write a review', description: `Share a first-hand review of an after-school program listed on ${cfg.siteName}.`, pathName: 'review/', depth: 1, current: null, hero, body, showStreet: 'parked' });
}

function reviewThanksPage() {
  const hero = `    <h1>${T(`Thank you. It’s in.`)}</h1>
    <p class="lede">${T(`Your review will appear once it’s been read.`)} <a href="${link('', 2)}">${T(`Back to the schools.`)}</a></p>`;
  const body = `<section class="section rv-more" id="rv-more" data-review="${link('review/', 2)}" hidden></section>
${rvNames()}`;
  return layout({ title: 'Thanks for your review', description: 'Your review was sent.', pathName: 'review/thanks/', depth: 2, current: null, hero, body, showStreet: 'parked', noindex: true });
}

// Review form handler. Emails the review with a ready-to-paste entry for data/reviews.json.
function reviewPhp() {
  const phpList = arr => 'array(' + arr.map(x => JSON.stringify(x)).join(', ') + ')';
  return `<?php
// Receives the "Write a review" form. Generated by build.mjs; edit it there.
${mailerPhp()}
$TO = ${JSON.stringify(cfg.contactEmail)};
$SITE = ${JSON.stringify(cfg.siteName)};
$PROGRAMS = ${phpList(programs.map(p => p.id))};
$SCHOOLS = ${phpList(schools.map(s => s.id))};

function fail($msg, $code) {
  http_response_code($code);
  header('Content-Type: text/html; charset=utf-8');
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not sent</title><link rel="stylesheet" href="../assets/site.css${CSS_V}"></head><body><main class="wrap"><h1>That did not send</h1><p>' . htmlspecialchars($msg, ENT_QUOTES, 'UTF-8') . '</p><p><a href="javascript:history.back()">Go back to the form</a></p></main></body></html>';
  exit;
}
function field($key, $max) {
  $v = (isset($_POST[$key]) && is_string($_POST[$key])) ? trim($_POST[$key]) : '';
  $v = str_replace(chr(0), '', $v);
  return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}
function one_line($v) {
  return trim(preg_replace('/[\\r\\n\\t]+/', ' ', $v));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header('Location: ./', true, 303);
  exit;
}
// A hidden field people never see. If it is filled in, a bot did it: act as if it worked.
if (field('company', 200) !== '') {
  header('Location: thanks/', true, 303);
  exit;
}

$program = one_line(field('program', 80));
$school = one_line(field('school', 40));
$stars = (int) field('stars', 2);
$name = one_line(field('name', 40));
$email = one_line(field('email', 150));
$comment = field('comment', 1200);

if (!in_array($program, $PROGRAMS, true) || !in_array($school, $SCHOOLS, true)) {
  fail('Please choose the program and school from the lists.', 400);
}
if ($stars < 1 || $stars > 5) {
  fail('Please choose a rating from 1 to 5 stars.', 400);
}
if (strlen($comment) < 20) {
  fail('Please write a sentence or two so other families know what to expect.', 400);
}
if ($name === '') {
  fail('Please add your first name. It is shown with your review.', 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  fail('Please add a working email address. It is never shown.', 400);
}
if (field('firsthand', 5) !== 'yes') {
  fail('Please confirm this is your own experience.', 400);
}
if (substr_count(strtolower($comment), 'http') > 1) {
  fail('Reviews cannot include links. Please remove them and try again.', 400);
}

$entry = json_encode(array(
  'programId' => $program,
  'school' => $school,
  'name' => $name,
  'stars' => $stars,
  'comment' => trim(preg_replace('/\\s+/', ' ', $comment)),
  'date' => date('Y-m-d'),
), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

$body = "New review, waiting for your approval.\\n\\n"
  . "Program: $program\\n"
  . "School: $school\\n"
  . "Stars: $stars\\n"
  . "From: $name <$email>\\n\\n"
  . "$comment\\n\\n"
  . "To publish it, add this entry to data/reviews.json (inside the square brackets, with a comma between entries):\\n\\n"
  . "$entry\\n";

$subject = one_line("[$SITE] Review: $program ($stars stars)");
$headers = array(
  'From: ' . $SITE . ' <' . $TO . '>',
  'Reply-To: ' . $email,
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
);

$sent = pas_postmark($SITE, $TO, $TO, $subject, $body, '', isset($email) ? (string) $email : '') === 1 || @mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\\r\\n", $headers));
$log = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-reviews.log';
$saved = @file_put_contents($log, date('c') . ($sent ? ' (emailed)' : ' (EMAIL FAILED)') . "\\n" . $body . "----\\n", FILE_APPEND | LOCK_EX);

if (!$sent && $saved === false) {
  fail('Something went wrong on our side. Please email ' . $TO . ' instead.', 500);
}
header('Location: thanks/', true, 303);
exit;
`;
}

// ---------- sending mail ----------
// The site's own emails (sign-in codes, invitations, notices) go out through Postmark when "mail": { "postmark": true }
// is set in site.config.json AND the key is on the server; otherwise through the host's own mail, as before. The key is
// a file next to the public folder, phillyafterschool-postmark.key, put there by hand. It is never in this repository.
const POSTMARK = !PREVIEW && (process.env.PAS_POSTMARK ? process.env.PAS_POSTMARK === '1' : !!(cfg.mail && cfg.mail.postmark === true));
const MAILER_ON = String.raw`// ----- sending mail: Postmark when its key is on the server, else the host's own mail. Generated by build.mjs. -----
function pas_mail_key() {
  static $k = null;
  if ($k !== null) return $k;
  $raw = @file_get_contents(dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-postmark.key');
  $raw = is_string($raw) ? trim($raw) : '';
  $k = preg_match('/^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/', $raw) ? $raw : '';
  return $k;
}
function pas_mail_via() { return (pas_mail_key() !== '' && function_exists('curl_init')) ? 'postmark' : 'host'; }
// A count for the day and the service's last answer. Numbers and a code only: never an address or a subject.
function pas_mail_note($how, $result) {
  $file = dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-mail.json';
  $d = json_decode((string) @file_get_contents($file), true);
  $day = gmdate('Y-m-d');
  if (!is_array($d) || !isset($d['day']) || $d['day'] !== $day) $d = array('day' => $day, 'postmark' => 0, 'host' => 0, 'failed' => 0, 'last' => (is_array($d) && isset($d['last']) && is_string($d['last'])) ? $d['last'] : '');
  if ($result === 'ok') $d[$how] = (int) (isset($d[$how]) ? $d[$how] : 0) + 1; else $d['failed'] = (int) (isset($d['failed']) ? $d['failed'] : 0) + 1;
  if ($how === 'postmark') $d['last'] = $result;
  @file_put_contents($file, json_encode($d), LOCK_EX);
}
function pas_mail_state() {
  $d = json_decode((string) @file_get_contents(dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-mail.json'), true);
  return array('via' => pas_mail_via(), 'last' => (is_array($d) && isset($d['last']) && is_string($d['last'])) ? $d['last'] : '');
}
// Gives 1: sent. 0: the service won't send to this address (it bounced before, or the person marked our mail as spam),
// so don't try another way. -1: not sent here, use the host's mail.
function pas_postmark($fromName, $from, $to, $subject, $text, $html = '', $replyTo = '') {
  $key = pas_mail_key();
  if ($key === '' || !function_exists('curl_init')) return -1;
  $base = 'https://api.postmarkapp.com/email';
  if (PHP_SAPI === 'cli-server' && getenv('PAS_TEST_POSTMARK')) $base = (string) getenv('PAS_TEST_POSTMARK');   // the local test server only
  $msg = array(
    'From' => trim(preg_replace('/[<>",;\r\n]+/', '', (string) $fromName)) . ' <' . $from . '>', 'To' => (string) $to, 'Subject' => (string) $subject, 'TextBody' => (string) $text,
    'MessageStream' => 'outbound', 'TrackOpens' => false, 'TrackLinks' => 'None',   // we don't watch who opens or clicks
    'Headers' => array(array('Name' => 'Auto-Submitted', 'Value' => 'auto-generated'), array('Name' => 'X-Auto-Response-Suppress', 'Value' => 'All')),
  );
  if ((string) $html !== '') $msg['HtmlBody'] = (string) $html;
  if ((string) $replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL) && !preg_match('/[\r\n]/', (string) $replyTo)) $msg['ReplyTo'] = (string) $replyTo;
  $json = json_encode($msg, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
  if (!is_string($json)) return -1;
  $ch = curl_init($base);
  curl_setopt_array($ch, array(CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_TIMEOUT => 8,
    CURLOPT_HTTPHEADER => array('Accept: application/json', 'Content-Type: application/json', 'X-Postmark-Server-Token: ' . $key), CURLOPT_POSTFIELDS => $json));
  $raw = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  $r = is_string($raw) ? json_decode($raw, true) : null;
  $err = (is_array($r) && isset($r['ErrorCode'])) ? (int) $r['ErrorCode'] : -1;
  if ($code === 200 && $err === 0) { pas_mail_note('postmark', 'ok'); return 1; }
  pas_mail_note('postmark', $err > 0 ? 'e' . $err : 'http' . $code);
  return $err === 406 ? 0 : -1;
}
`;
const MAILER_OFF = `// ----- sending mail: the host's own mail (Postmark is not switched on in site.config.json). Generated by build.mjs. -----
function pas_mail_via() { return 'host'; }
function pas_mail_note($how, $result) { }
function pas_mail_state() { return array('via' => 'host', 'last' => ''); }
function pas_postmark($fromName, $from, $to, $subject, $text, $html = '', $replyTo = '') { return -1; }
`;
const mailerPhp = () => (POSTMARK ? MAILER_ON : MAILER_OFF);

// ---------- edit mode: the page that turns it on, and the handler that receives the edits ----------
// With editLogin set in site.config.json, /edit/ asks for a username and password, and edits can only be
// sent while signed in. The preview has no sign-in: it cannot send anything.
const GATED = !!cfg.editLogin && !PREVIEW;
// Shared by the edit page, the numbers page and the handler. Signing in sets a signed cookie. The key that signs it is
// made on the server the first time it is needed and kept outside the public folder. It is mixed with the password
// hash, so changing the password signs everyone out. (The key must never be worked out from this repository alone:
// the repository is public, and a key anyone can compute is a cookie anyone can forge.)
function editAuthPhp() {
  return `$EDIT_USER = ${JSON.stringify(cfg.editLogin.user)};
$EDIT_HASH = '${cfg.editLogin.passwordHash}';
$EDIT_ADMINS = json_decode('${JSON.stringify(GROUPS ? ADMINS : [])}', true);
header('Cache-Control: no-store, private');
header('X-Robots-Tag: noindex');
function edit_key() {
  global $EDIT_HASH;
  static $k = null;
  if ($k !== null) return $k;
  $file = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-edit.key';
  $raw = @file_get_contents($file);
  if ($raw === false || strlen(trim($raw)) !== 64) {
    $raw = bin2hex(random_bytes(32));
    if (@file_put_contents($file, $raw, LOCK_EX) === false) { http_response_code(503); exit('Signing in is not available right now.'); }
    @chmod($file, 0600);
    $raw = (string) @file_get_contents($file);   // if two requests raced, both read back the same key
  }
  $k = hash_hmac('sha256', $EDIT_HASH . '|edit-sign-in', trim($raw));
  return $k;
}
function edit_token($exp) {
  return $exp . '.' . hash_hmac('sha256', (string) $exp, edit_key());
}
// The accounts database (the same file the groups API keeps), or null when there isn't one yet. With $create, the
// two tables these pages add are made: the editors an admin lets in by their account, and the notes left on sentences.
function edit_db($create = false) {
  static $db = null, $made = false;
  if ($db === null) {
    $file = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-data/groups.sqlite';
    if (!is_file($file)) return null;
    try {
      $db = new PDO('sqlite:' . $file);
      $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
      $db->exec('PRAGMA busy_timeout=3000');
    } catch (Exception $e) { $db = null; return null; }
  }
  if ($create && !$made) {
    $made = true;
    try {
      $db->exec("CREATE TABLE IF NOT EXISTS editors (email TEXT PRIMARY KEY, name TEXT NOT NULL, added INTEGER NOT NULL, added_by TEXT NOT NULL DEFAULT '')");
      $db->exec("CREATE TABLE IF NOT EXISTS copy_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, copy_id TEXT NOT NULL, page TEXT NOT NULL DEFAULT '', sentence TEXT NOT NULL DEFAULT '', note TEXT NOT NULL, by_name TEXT NOT NULL DEFAULT '', by_email TEXT NOT NULL DEFAULT '', for_email TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, sent INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0, done_by TEXT NOT NULL DEFAULT '', done_how TEXT NOT NULL DEFAULT '')");
    } catch (Exception $e) { /* read-only database: notes stay off */ }
  }
  return $db;
}
// The account the visitor is signed in to on the site (a code by email, or Google), as the accounts database has it:
// its address and first name, or null.
function edit_account() {
  static $acct = false;
  if ($acct !== false) return $acct;
  $acct = null;
  $sid = (isset($_COOKIE['pas_s']) && is_string($_COOKIE['pas_s'])) ? $_COOKIE['pas_s'] : '';
  if (!preg_match('/^[A-Za-z0-9_-]{40,50}$/', $sid)) return $acct;
  $db = edit_db();
  if ($db === null) return $acct;
  try {
    $st = $db->prepare('SELECT u.email, u.first, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.sid_hash = ? AND s.expires > ?');
    $st->execute(array(hash('sha256', $sid), time()));
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) return $acct;
    $email = strtolower(trim((string) $row['email']));
    if ($email === '') return $acct;
    $first = trim((string) $row['first']);
    if ($first === '') $first = trim(strtok((string) $row['name'], ' '));
    $acct = array('email' => $email, 'name' => $first);
  } catch (Exception $e) { $acct = null; }
  return $acct;
}
// An account on the site whose address is on the admins list (site.config.json) opens these pages too. It gives the
// address, or '' when the visitor isn't signed in to such an account.
function edit_admin() {
  global $EDIT_ADMINS;
  if (!is_array($EDIT_ADMINS) || !$EDIT_ADMINS) return '';
  $a = edit_account();
  return $a !== null && in_array($a['email'], $EDIT_ADMINS, true) ? $a['email'] : '';
}
// An account an admin has let in as an editor (the editors table, kept from the edit page): its name and address,
// or null. Editors open the same pages the edit password does.
function edit_editor() {
  static $who = false;
  if ($who !== false) return $who;
  $who = null;
  $a = edit_account();
  if ($a === null) return $who;
  $db = edit_db();
  if ($db === null) return $who;
  try {
    $st = $db->prepare('SELECT name, email FROM editors WHERE email = ?');
    $st->execute(array($a['email']));
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if ($row) $who = array('name' => (string) $row['name'], 'email' => (string) $row['email']);
  } catch (Exception $e) { $who = null; }   // no editors table yet
  return $who;
}
function edit_signed_in() {
  if (edit_admin() !== '') return true;
  if (edit_editor() !== null) return true;
  if (!isset($_COOKIE['pas_edit']) || !is_string($_COOKIE['pas_edit'])) return false;
  $parts = explode('.', $_COOKIE['pas_edit'], 2);
  if (count($parts) !== 2 || !ctype_digit($parts[0]) || (int) $parts[0] < time()) return false;
  return hash_equals(edit_token($parts[0]), $_COOKIE['pas_edit']);
}
`;
}

function editSignInPage() {
  const hero = `    <h1>Sign in to edit</h1>
    <p class="lede">This page is for the people who look after the site’s wording.</p>`;
  const body = `<div class="signin">
  <form class="form panel" method="post" action="./" data-edit-allow>
    <?php if ($error !== '') { ?><p class="flag" role="alert"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></p><?php } ?>
    <div class="field">
      <label for="e-user">Username</label>
      <input id="e-user" name="user" type="text" maxlength="60" autocomplete="username" autocapitalize="none" spellcheck="false" required>
    </div>
    <div class="field">
      <label for="e-pass">Password</label>
      <input id="e-pass" name="pass" type="password" maxlength="200" autocomplete="current-password" required>
    </div>
    <div><button class="btn primary big" type="submit">Sign in</button></div>
  </form>${GROUPS && ADMINS.length ? `
  <p class="hint" id="edit-admin-way">Site admins: <a href="../account/">sign in to your account</a> with your admin address, then come back to this page.</p>` : ''}
</div>`;
  return layout({ title: 'Sign in', description: 'Sign in to edit the words on this site.', pathName: 'edit/', depth: 1, current: null, hero, body, noindex: true });
}

// The gated edit page: a sign-in form until the right username and password are given, then the edit page.
function editIndexPhp() {
  return `<?php
// The edit page, behind a sign-in. Generated by build.mjs; edit it there.
${editAuthPhp()}
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
function edit_cookie($value, $exp) {
  global $https;
  setcookie('pas_edit', $value, array('expires' => $exp, 'path' => '/edit/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax'));
}
$error = '';
if (isset($_GET['out'])) {
  edit_cookie('', time() - 3600);
  header('Location: ' . (edit_admin() !== '' ? '../account/#sign-out' : './'), true, 303);   // an admin account signs out where every account does
  exit;
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  // Slow down guessing: at most 8 wrong tries from one address in 15 minutes.
  $file = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-edit-signins.json';
  $who = substr(hash('sha256', isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : ''), 0, 16);
  $tries = @json_decode((string) @file_get_contents($file), true);
  if (!is_array($tries)) $tries = array();
  $recent = array();
  foreach ($tries as $k => $times) {
    if (!is_array($times)) continue;
    $keep = array();
    foreach ($times as $t) { if (is_int($t) && $t > time() - 900) $keep[] = $t; }
    if ($keep) $recent[$k] = $keep;
  }
  $user = (isset($_POST['user']) && is_string($_POST['user'])) ? trim($_POST['user']) : '';
  $pass = (isset($_POST['pass']) && is_string($_POST['pass'])) ? $_POST['pass'] : '';
  if (isset($recent[$who]) && count($recent[$who]) >= 8) {
    $error = 'Too many tries. Wait 15 minutes and try again.';
  } elseif (strcasecmp($user, $EDIT_USER) === 0 && password_verify($pass, $EDIT_HASH)) {
    $exp = time() + 30 * 86400;
    edit_cookie(edit_token($exp), $exp);
    header('Location: ./', true, 303);
    exit;
  } else {
    sleep(1);
    $recent[$who][] = time();
    @file_put_contents($file, json_encode($recent), LOCK_EX);
    $error = 'That username or password isn’t right.';
  }
}
if (!edit_signed_in()) {
  if ($error !== '') http_response_code(401);
?>
${editSignInPage()}<?php
  exit;
}
?>
${editPage()}`;
}

// The owner's numbers page, behind the same sign-in as the edit page. Counts only: it never prints a name, an email
// address, a group's name or anything from a child's week.
function editStatsPhp() {
  const hero = `    <h1>Site numbers</h1>
    <p class="lede">Accounts, profiles, shared weeks and groups. Counts only: no names, addresses or weeks are shown here.</p>`;
  const body = `<div class="prose stats">
<?php if (!$have) { ?>
  <div class="panel"><p>Nobody has made an account yet, so there is nothing to count.</p></div>
<?php } else { ?>
  <h2>Right now</h2>
  <div class="stat-grid">
    <?php foreach ($tiles as $tile) { ?><div class="stat"><b><?php echo number_format($tile[0]); ?></b><span><?php echo htmlspecialchars($tile[1], ENT_QUOTES, 'UTF-8'); ?></span><?php if ($tile[2] !== '') { ?><small><?php echo htmlspecialchars($tile[2], ENT_QUOTES, 'UTF-8'); ?></small><?php } ?></div><?php } ?>
  </div>
  <h2>Schools kept in profiles</h2>
  <?php if (!$bySchool) { ?><p class="hint">None yet.</p><?php } else { ?>
  <table class="stat-table"><tbody><?php foreach ($bySchool as $row) { ?><tr><th scope="row"><?php echo htmlspecialchars($row[0], ENT_QUOTES, 'UTF-8'); ?></th><td><?php echo number_format($row[1]); ?></td></tr><?php } ?></tbody></table>
  <?php } ?>
  <h2>What happened, and when</h2>
  <div class="stat-scroll"><table class="stat-table">
    <thead><tr><th scope="col"></th><th scope="col">Today</th><th scope="col">Yesterday</th><th scope="col">Last 7 days</th><th scope="col">Last 30 days</th><th scope="col">Ever</th></tr></thead>
    <tbody>
    <?php foreach ($cols as $key => $label) { ?><tr><th scope="row"><?php echo htmlspecialchars($label, ENT_QUOTES, 'UTF-8'); ?></th><?php foreach (array(1, -1, 7, 30, 0) as $span) { $v = $sum($key, $span); ?><td><?php echo $v ? number_format($v) : '<span class="nil">0</span>'; ?></td><?php } ?></tr><?php } ?>
    </tbody>
  </table></div>
  <h2>Listings, last 30 days</h2>
  <?php if (!$topListings) { ?><p class="hint">Nothing counted yet. A listing appears here once its page has been opened.</p><?php } else { ?>
  <div class="stat-scroll"><table class="stat-table">
    <thead><tr><th scope="col">Listing</th><th scope="col">Opened</th><th scope="col">Clicks to sign up</th><th scope="col">Clicks to its website</th><th scope="col">Put on a plan</th><th scope="col">Asked for emails</th></tr></thead>
    <tbody>
    <?php foreach ($topListings as $row) { ?><tr><th scope="row"><?php echo htmlspecialchars($row[0], ENT_QUOTES, 'UTF-8'); ?><?php if ($row[6]) { ?> <span class="hint">(claimed)</span><?php } ?></th><?php for ($i = 1; $i <= 5; $i++) { ?><td><?php echo $row[$i] ? number_format($row[$i]) : '<span class="nil">0</span>'; ?></td><?php } ?></tr><?php } ?>
    </tbody>
  </table></div>
  <p class="hint">The 40 most-opened listings. Numbers only: nothing about who. A manager sees the same numbers for a listing they have claimed, and their own signed-in visits aren’t counted. Counting began <?php echo htmlspecialchars($hitsSince, ENT_QUOTES, 'UTF-8'); ?>.</p>
  <?php } ?>
  <p class="hint">“Ever” counts everything since accounts began, including accounts and groups that were later deleted. Sign-ins by method and profile saves have been counted since October 6, 2026. Days are Philadelphia days, and “last 7 days” includes today.</p>
<?php } ?>
  <p><a class="btn" href="../">Back to editing</a> <a class="btn" href="../?out=1">Sign out</a></p>
</div>`;
  const page = layout({ title: 'Site numbers', description: 'Counts of accounts, shared weeks and groups.', pathName: 'edit/stats/', depth: 2, current: null, hero, body, noindex: true, quiet: true });
  const names = JSON.stringify(Object.fromEntries(schools.map(s => [s.id, s.shortName]))).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `<?php
// The owner's numbers page. Generated by build.mjs; edit it there.
${editAuthPhp()}
if (!edit_signed_in()) { header('Location: ../', true, 303); exit; }
$SCHOOLS = json_decode('${names}', true);
$LISTINGS = json_decode('${JSON.stringify(Object.fromEntries(Object.entries(claimListings()).map(([k, v]) => [k, v.n]))).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', true);
$topListings = array(); $hitsSince = '';
$file = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-data/groups.sqlite';
$have = is_file($file);
$tiles = array(); $bySchool = array(); $days = array(); $ever = array();
$cols = array('account' => 'New accounts', 'account_parent' => 'New accounts: parents', 'account_manager' => 'New accounts: program managers', 'mgr_month' => 'Monthly emails to managers', 'mgr_review' => 'New-review emails to managers', 'mgr_follow' => 'New-follower emails to managers', 'mgr_ask' => 'Questions emailed to managers about their listing', 'mgr_stop' => 'Managers who turned those emails off', 'signin_email' => 'Sign-ins by email', 'signin_google' => 'Sign-ins with Google', 'week_saved' => 'Weeks kept', 'summer_saved' => 'Summers kept', 'daysoff_saved' => 'Days-off plans kept', 'school_saved' => 'Schools kept', 'grades_saved' => 'Grades kept', 'ages_saved' => 'Ages kept', 'hood_saved' => 'Neighborhoods kept', 'phone_saved' => 'Phone numbers added for texts', 'follow' => 'Follows started', 'stop_one' => 'Listings stopped from an email', 'stop_all' => 'Everything stopped from an email', 'fav' => 'Favorites saved', 'share' => 'Weeks shared with one person', 'group' => 'Groups started', 'invite' => 'Invitations', 'join' => 'Invitations accepted', 'account_deleted' => 'Accounts deleted', 'email_changed' => 'Email addresses changed', 'claim' => 'Listings claimed', 'space_set' => 'Times a manager said whether there’s space', 'claim_pending' => 'Claims sent for approval', 'claim_mismatch' => 'Claims refused: address didn’t match', 'premium_ask' => 'Premium sign-ups', 'edit_proposed' => 'Changes proposed by program managers', 'photo_sent' => 'Photos sent by program managers', 'push_on' => 'Devices that turned notifications on', 'push_sent' => 'Notifications delivered', 'extra_sent' => 'Words and offer lines sent by program managers', 'ask' => 'Questions sent to programs');
if ($have) {
  try {
    $db = new PDO('sqlite:' . $file);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA busy_timeout=3000');
  } catch (Exception $e) { $have = false; }
}
if ($have) {
  // A question the database can't answer yet (a table added in a later version) counts as zero.
  $n = function ($sql, $args = array()) use ($db) { try { $st = $db->prepare($sql); $st->execute($args); return (int) $st->fetchColumn(); } catch (Exception $e) { return 0; } };
  $t = time();
  $byGrade = array();
  try { foreach ($db->query("SELECT grades FROM users WHERE grades != ''") as $r) foreach (explode(',', $r['grades']) as $g) $byGrade[$g] = (isset($byGrade[$g]) ? $byGrade[$g] : 0) + 1; } catch (Exception $e) { /* before grades existed */ }
  $gradeLine = '';
  foreach (array(${GRADES.map(g => `'${g}'`).join(', ')}) as $g) { if (isset($byGrade[$g])) $gradeLine .= ($gradeLine === '' ? '' : ', ') . $g . ': ' . $byGrade[$g]; }
  $accounts = $n('SELECT COUNT(*) FROM users');
  $tiles[] = array($accounts, 'accounts', $n('SELECT COUNT(*) FROM users WHERE created > ?', array($t - 7 * 86400)) . ' new in 7 days, ' . $n('SELECT COUNT(*) FROM users WHERE created > ?', array($t - 30 * 86400)) . ' in 30');
  // Parents and program managers. A manager holds a claim (approved or waiting) or made the account on the managers' page.
  $isMgr = "(%s EXISTS (SELECT 1 FROM claims c WHERE c.user_id = u.id AND c.status != 'declined'))";
  $mgr = function ($since) use ($db, $isMgr) {
    foreach (array("u.origin = 'managers' OR", '') as $door) {   // the second try is for a database from before accounts noted their door
      try { $st = $db->prepare('SELECT COUNT(*) FROM users u WHERE u.created > ? AND ' . sprintf($isMgr, $door)); $st->execute(array($since)); return (int) $st->fetchColumn(); } catch (Exception $e) { /* try the next */ }
    }
    return 0;
  };
  $managers = $mgr(0);
  $tiles[] = array($accounts - $managers, 'parents with an account', ($n('SELECT COUNT(*) FROM users WHERE created > ?', array($t - 30 * 86400)) - $mgr($t - 30 * 86400)) . ' new in 30 days');
  $tiles[] = array($managers, 'program managers with an account', $mgr($t - 30 * 86400) . ' new in 30 days. ' . $n("SELECT COUNT(DISTINCT user_id) FROM claims WHERE status = 'ok'") . ' hold a claimed listing, ' . $n("SELECT COUNT(DISTINCT listing) FROM claims WHERE status = 'ok'") . ' listings claimed');
  $tiles[] = array($n('SELECT COUNT(DISTINCT user_id) FROM sessions WHERE seen > ?', array($t - 30 * 86400)), 'people signed in during the last 30 days', '');
  $tiles[] = array($n("SELECT COUNT(*) FROM users WHERE via = 'google'"), 'accounts made with Google', ($accounts - $n("SELECT COUNT(*) FROM users WHERE via = 'google'")) . ' made with an emailed code');
  $tiles[] = array($n('SELECT COUNT(*) FROM users WHERE listed = 1'), 'accounts added to the email list', $n("SELECT COUNT(*) FROM users WHERE first = ''") . ' accounts haven’t added a name yet');
  $tiles[] = array($n("SELECT COUNT(*) FROM users WHERE school != ''"), 'profiles with a school kept', '');
  $tiles[] = array($n("SELECT COUNT(*) FROM users WHERE grades != ''"), 'profiles with grades kept', $gradeLine);
  $tiles[] = array($n("SELECT COUNT(*) FROM users WHERE hood != ''"), 'profiles with a neighborhood kept', '');
  $tiles[] = array($n("SELECT COUNT(*) FROM users WHERE phone != '' AND phone_ok > 0"), 'people who agreed to texts', 'texts aren’t being sent yet');
  $tiles[] = array($n('SELECT COUNT(*) FROM follows WHERE live = 1'), 'follows', 'by ' . $n('SELECT COUNT(DISTINCT user_id) FROM follows WHERE live = 1') . ' people: ' . $n("SELECT COUNT(*) FROM follows WHERE live = 1 AND k LIKE 'p:%'") . ' programs, ' . $n("SELECT COUNT(*) FROM follows WHERE live = 1 AND k LIKE 'c:%'") . ' camps, ' . $n("SELECT COUNT(*) FROM follows WHERE live = 1 AND k LIKE 's:%'") . ' schools' . ', ' . $n("SELECT COUNT(*) FROM follows WHERE live = 1 AND k LIKE 'w:%'") . ' Sunday emails');
  $tiles[] = array($n('SELECT COUNT(*) FROM favs'), 'favorites saved', 'by ' . $n('SELECT COUNT(DISTINCT user_id) FROM favs') . ' people');
  $tiles[] = array($n('SELECT COUNT(*) FROM weeks'), 'weeks kept in profiles', 'by ' . $n('SELECT COUNT(DISTINCT user_id) FROM weeks') . ' people');
  $tiles[] = array($n('SELECT COUNT(*) FROM grp WHERE solo = 1 AND expires > ?', array($t)), 'weeks shared with one person or more', $n('SELECT COUNT(*) FROM members m JOIN grp g ON g.id = m.group_id WHERE g.solo = 1 AND m.role != ?', array('owner')) . ' people have opened one');
  $tiles[] = array($n('SELECT COUNT(*) FROM grp WHERE solo = 0 AND expires > ?', array($t)), 'groups', $n("SELECT COUNT(*) FROM (SELECT g.id FROM grp g JOIN members m ON m.group_id = g.id WHERE g.solo = 0 AND m.status = 'approved' GROUP BY g.id HAVING COUNT(*) >= 2)") . ' have two or more adults; the biggest has ' . $n("SELECT COALESCE(MAX(c), 0) FROM (SELECT COUNT(*) AS c FROM members m JOIN grp g ON g.id = m.group_id WHERE g.solo = 0 AND m.status = 'approved' GROUP BY m.group_id)"));
  $tiles[] = array($n("SELECT COUNT(DISTINCT m.user_id) FROM members m JOIN grp g ON g.id = m.group_id WHERE g.solo = 0 AND m.status = 'approved'"), 'adults in groups', $n('SELECT COUNT(*) FROM kids k JOIN members m ON m.id = k.member_id JOIN grp g ON g.id = m.group_id WHERE g.solo = 0') . ' children’s weeks in them');
  $invites = $n('SELECT COUNT(*) FROM invites');
  $joined = $n('SELECT COUNT(*) FROM invites i WHERE EXISTS (SELECT 1 FROM members m JOIN users u ON u.id = m.user_id WHERE m.group_id = i.group_id AND u.email = i.email)');
  $tiles[] = array($invites, 'invitations outstanding or accepted', $joined . ' accepted, ' . ($invites - $joined) . ' not yet');
  try {
    foreach ($db->query("SELECT school, COUNT(*) AS c FROM users WHERE school != '' GROUP BY school ORDER BY c DESC, school") as $r) $bySchool[] = array(isset($SCHOOLS[$r['school']]) ? $SCHOOLS[$r['school']] : $r['school'], (int) $r['c']);
  } catch (Exception $e) { /* before profiles existed */ }
  $tz = new DateTimeZone('America/New_York');
  try {
    $from = (new DateTime('-29 days', $tz))->format('Y-m-d');
    $per = array();
    $st = $db->prepare('SELECT listing, k, SUM(n) AS n FROM hits WHERE day >= ? GROUP BY listing, k'); $st->execute(array($from));
    foreach ($st as $r) { if (!isset($per[$r['listing']])) $per[$r['listing']] = array('view' => 0, 'signup' => 0, 'site' => 0, 'plan' => 0, 'email' => 0); if (isset($per[$r['listing']][$r['k']])) $per[$r['listing']][$r['k']] = (int) $r['n']; }
    uasort($per, function ($a, $b) { return $b['view'] <=> $a['view'] ?: array_sum($b) <=> array_sum($a); });
    $claimed = array(); foreach ($db->query("SELECT DISTINCT listing FROM claims WHERE status = 'ok'") as $r) $claimed[$r['listing']] = true;
    foreach (array_slice($per, 0, 40, true) as $key => $v) $topListings[] = array(isset($LISTINGS[$key]) ? $LISTINGS[$key] : $key, $v['view'], $v['signup'], $v['site'], $v['plan'], $v['email'], isset($claimed[$key]));
    $first = (string) $db->query('SELECT MIN(day) FROM hits')->fetchColumn();
    $hitsSince = $first === '' ? '' : (new DateTime($first, $tz))->format('F j, Y');
  } catch (Exception $e) { /* before counting began */ }
  for ($i = 0; $i < 30; $i++) { $d = new DateTime('now', $tz); $d->modify('-' . $i . ' day'); $days[$d->format('Y-m-d')] = array(); }
  try {
    foreach ($db->query('SELECT k, day, n FROM tally') as $r) {
      if (!isset($cols[$r['k']])) continue;
      $ever[$r['k']] = (isset($ever[$r['k']]) ? $ever[$r['k']] : 0) + (int) $r['n'];
      if (isset($days[$r['day']])) $days[$r['day']][$r['k']] = (int) $r['n'];
    }
  } catch (Exception $e) { /* before counting began */ }
}
// One number for the table: today (1), yesterday (-1), the last N days including today, or ever (0).
$sum = function ($key, $span) use (&$days, &$ever) {
  if ($span === 0) return isset($ever[$key]) ? $ever[$key] : 0;
  $rows = array_values($days);
  if ($span === -1) return isset($rows[1][$key]) ? $rows[1][$key] : 0;
  $t = 0;
  for ($i = 0; $i < $span && $i < count($rows); $i++) $t += isset($rows[$i][$key]) ? $rows[$i][$key] : 0;
  return $t;
};
?>
${page}`;
}

// The site's own emails, each rendered once with sample values so their sentences can be edited like a page's.
// Sentences come from __T("…") in src/server/groups-api.php (see phpCopy); {words} show the sample here and are
// filled in for real when an email is sent.
const EMAIL_SAMPLE = { site: cfg.siteName, code: '123 456', minutes: '20', name: 'Sam Rivera', from: 'Sam Rivera (sam@example.com)', first: 'Sam', email: 'you@example.com', contact: cfg.contactEmail || 'contact@example.com', times: '120 times', before: '96', address: 'you@example.com', newAddress: 'new@example.com', group: 'Tuesday crew', listing: 'Maple Street Arts Club', program: 'Maple Street Arts Club', count: '3', n: '3', question: 'Is the Thursday clinic still 3:30 to 5:30?', days: '7', numbers: 'Opened 120 times, 14 clicks to your sign-up page, on 9 plans.', todo: 'Mark whether there’s space.', more: '1', school: 'Nebinger', programs: '3 programs are' };
function editEmailsPage() {
  const hero = `    <h1>The site’s emails</h1>
    <p class="lede">Every email the site sends itself, with made-up names and numbers in place of the real ones. Turn on editing at <a href="../">the edit page</a>, then click a sentence here and type; words in curly braces are filled in when an email goes out.</p>`;
  const body = `<div class="prose" data-emails-page>
  ${[...EMAILS, ...SITE_EMAILS].length ? [...EMAILS, ...SITE_EMAILS].map(e => `<section class="panel email-sample"><h2>${esc(e.name)}</h2>
${e.sentences.map(t => `    <p>${T(t, EMAIL_SAMPLE)}</p>`).join('\n')}
  </section>`).join('\n  ') : '<p>No emails are wired up for editing yet.</p>'}
  <p class="hint">Klaviyo’s other emails (the dates digest, the welcome series) are edited in Klaviyo, not here.</p>
</div>`;
  return layout({ title: 'The site’s emails', description: 'Edit the wording of the emails the site sends.', pathName: 'edit/emails/', depth: 2, current: null, hero, body, noindex: true, quiet: true });
}
function editEmailsPhp() {
  return `<?php
// The emails page, behind the edit sign-in. Generated by build.mjs; edit it there.
${editAuthPhp()}
if (!edit_signed_in()) { header('Location: ../', true, 303); exit; }
?>
${editEmailsPage()}`;
}

function editPage() {
  const pages = [['', 'Home'], ['schools/', 'Schools'], ['schools/request/', 'A school that isn’t covered yet'], ...schools.map(s => [s.id + '/', `${s.shortName} page`]), ['types/', 'Program types'], [`types/${liveTypes()[0].id}/`, `A type page (${liveTypes()[0].label})`], ['by-day/', 'By day of the week'], ['all-programs/', 'All programs, by kind'], ['programs/', 'After-school programs, A to Z'], ['neighborhoods/', 'Neighborhoods'], [hoodPath(hoods[0]), `A neighborhood page (${hoods[0].name})`], [programPath(programs[0]), `A program page (${programs[0].name})`],
    ['board/', 'Build your week'], ['suggest/', 'Suggest a program'], ['suggest/thanks/', 'Thank-you page after a suggestion'], ['ideas/', 'Request a feature'], ['ideas/thanks/', 'Thank-you page after an idea'], ['review/', 'Write a review'], ['review/thanks/', 'Thank-you page after a review'],
    ['about/', 'About'], ['privacy/', 'Privacy'], ['support/', 'Help the site keep going'], ...(PM_PRICE && !PREVIEW ? [['premium/', PM_LISTED ? 'Premium listings' : 'Premium listings (not linked from the site yet)']] : []), ...(PREVIEW ? [] : [['404.html', 'Page not found']])];
  const hero = `    <h1>Edit the words on this site</h1>
    <p class="lede">Turn on editing, then click a sentence on any page and type. Nothing changes for visitors until you publish.</p>`;
  const body = `<div class="prose" data-edit-page>
  <div class="panel">
    <h2 id="edit-state">Editing is off</h2>
    <p id="edit-state-text">Turn it on and a bar appears at the bottom of every page.</p>
    <div class="actions"><button type="button" class="btn primary big needs-js" id="edit-start">Start editing</button><button type="button" class="btn needs-js" id="edit-stop" hidden>Stop editing</button></div>
    <noscript><p>Editing needs JavaScript turned on.</p></noscript>
  </div>${GATED ? `\n  <?php if (edit_admin() !== '') { ?><p class="hint" id="edit-admin">You’re here through your account, <?php echo htmlspecialchars(edit_admin(), ENT_QUOTES, 'UTF-8'); ?>, which is a site admin. <a href="../account/#sign-out">Sign out of your account</a> to close these pages. Anyone who can read that address’s inbox can sign in as you, so keep 2-step verification on for it.</p><?php } elseif (edit_editor() !== null) { ?><p class="hint" id="edit-editor">You’re here through your account, <?php echo htmlspecialchars(edit_editor()['email'], ENT_QUOTES, 'UTF-8'); ?>, which is on the editors list as <?php echo htmlspecialchars(edit_editor()['name'], ENT_QUOTES, 'UTF-8'); ?>. <a href="../account/#sign-out">Sign out of your account</a> to close these pages.</p><?php } else { ?><p class="hint">You’re signed in on this device for 30 days. <a href="?out=1">Sign out</a></p><?php } ?>` : ''}${GATED && GROUPS ? '\n  <p><a class="btn" href="stats/">Site numbers: accounts, shared weeks and groups</a> <a class="btn" href="claims/">Claims and proposed changes</a></p>' : ''}
  <h2>How it works</h2>
  <ol>
    <li>Click any text with a dotted outline and type. Text you’ve changed turns yellow. To take a sentence off the page, click it and choose “Remove this sentence” in the bar.</li>
    <li>Move between pages with the menu or the list below. Your edits are kept in this browser as you go, so stay on the same phone or computer until you’ve published them.</li>
    <li>Choose “Review and publish” in the bar at the bottom. You’ll see each change next to the original, can untick any to leave it out, and can undo any of them.</li>
    <li>“Show what’s changed” in the bar outlines in red every sentence that has been reworded from the site’s original wording, so you can edit around someone else’s changes. Click one and the bar says who reworded it, when, and what it said; “Put the original wording back” makes that a change of yours.</li>
    <li>“Leave a note” in the bar pins a note to the sentence you clicked, for one of the editors or for anyone. Sentences with a note are outlined in blue; click one to read it. A note is done when a change to that sentence is published, or with the Done button. “Send” emails an editor every note for them that hasn’t gone out yet.</li>
    <li>Publishing puts the ticked changes on the site within a few minutes. Every publish is kept as a version below, so a change can be taken back.</li>
  </ol>
  <section id="notes"${GATED ? '' : ' hidden'}>
    <h2>Notes on the wording</h2>
    <p id="notes-msg" class="needs-js">Reading the notes…</p>
    <ol id="notes-list" class="notes-list"></ol>
    <div id="notes-send" class="actions"></div>
    <details id="notes-done" hidden><summary>Done in the last 30 days</summary><ol class="notes-list"></ol></details>${GATED ? `
    <?php if (edit_admin() !== '') { ?><div id="editors">
      <h3>Editors</h3>
      <p>People who can open these pages by signing in to the site with their own account, and who notes can be left for.</p>
      <ul id="editors-list"></ul>
      <form id="editors-add" class="q-note"><label>Email<input type="email" name="email" required maxlength="120" autocomplete="off"></label><label>Name<input type="text" name="name" required maxlength="40" autocomplete="off"></label><div><button type="submit" class="btn">Add editor</button> <span id="editors-msg"></span></div></form>
    </div><?php } ?>` : ''}
  </section>
  <section id="pub"${GATED ? '' : ' hidden'}>
    <h2>Published versions</h2>
    <p id="pub-msg" class="needs-js">Reading the published versions…</p>
    <ol id="pub-list" class="pub-list"></ol>
    <div id="pub-removed" hidden><h3>Sentences taken off the page</h3><ul></ul></div>
  </section>
  <h2>Pages</h2>
  <ul>
    ${pages.map(([to, label]) => `<li><a href="${link(to, 1)}">${esc(label)}</a></li>`).join('\n    ')}
  </ul>
  <h2>Emails</h2>
  <p><a href="${link('edit/emails/', 1)}">The site’s own emails</a>: sign-in codes, invitations, the notes to program managers. Each is shown once with made-up names, and its sentences edit like a page’s.</p>${GATED ? `
  <h2>Listings</h2>
  <p><a href="${link('edit/queue/', 1)}">The weekly run’s queue</a>: suggestions, updates and proposed changes that need a program’s website read, sent as a batch to the scheduled research run, which answers with a pull request.</p>` : ''}
  <h2>What can’t be edited here</h2>
  <ul>
    <li>Program details: names, descriptions, hours and costs come from the listings data. Send fixes for those through <a href="${link('suggest/', 1)}">the suggestion form</a>.</li>
    <li>Menu labels, text that changes as you click (filter counts, the roster), the grey example text inside boxes, and the choices inside drop-downs.</li>
    <li>Words in curly braces, like {school}, are filled in for each page. Leave them in the sentence.</li>
  </ul>
</div>`;
  return layout({ title: 'Edit the copy', description: 'Edit the words on this site.', pathName: 'edit/', depth: 1, current: null, hero, body, noindex: true });
}

// Receives edits as JSON: emails them, or publishes data/copy.json to the repository (src/server/edit-send.php has the
// handler; the build fills in the mailer, the config and the sign-in check).
function editPhp() {
  const original = Object.fromEntries(copyRegistry);
  const overrides = Object.fromEntries(Object.entries(copyEdits).filter(([id]) => copyRegistry.has(id)));
  const nowdoc = o => "json_decode(<<<'PAS_JSON'\n" + JSON.stringify(o) + "\nPAS_JSON\n, true)";
  const src = fs.readFileSync(path.join(ROOT, 'src/server/edit-send.php'), 'utf8');
  for (const m of ['/*MAILER*/', '/*CONFIG*/', '/*AUTH*/', '/*GH*/']) if (!src.includes(m)) throw new Error('src/server/edit-send.php has lost its ' + m + ' marker');
  const config = `$TO = ${JSON.stringify(cfg.contactEmail)};
$SITE = ${JSON.stringify(cfg.siteName)};
$SITE_URL = ${JSON.stringify(cfg.siteUrl)};
$REPO = ${JSON.stringify(cfg.repo || '')};
$ORIGINAL = ${nowdoc(original)};
$OVERRIDES = ${nowdoc(overrides)};`;
  return src.replace('/*MAILER*/', () => mailerPhp()).replace('/*CONFIG*/', () => config).replace('/*AUTH*/', () => (GATED ? editAuthPhp() : '')).replace('/*GH*/', () => ghPhp());
}
const ghPhp = () => fs.readFileSync(path.join(ROOT, 'src/server/gh.php'), 'utf8');

// ---------- the weekly run's queue: what came in through the site, sent to the scheduled research run as one batch ----------
function editQueuePhp() {
  const src = fs.readFileSync(path.join(ROOT, 'src/server/edit-queue.php'), 'utf8');
  for (const m of ['/*MAILER*/', '/*CONFIG*/', '/*AUTH*/', '/*GH*/']) if (!src.includes(m)) throw new Error('src/server/edit-queue.php has lost its ' + m + ' marker');
  const names = JSON.stringify(Object.fromEntries(Object.entries(claimListings()).map(([k, v]) => [k, v.n]))).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const schoolNames = JSON.stringify(Object.fromEntries(schools.map(s => [s.id, s.name]))).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const config = `$TO = ${JSON.stringify(cfg.contactEmail)};
$SITE = ${JSON.stringify(cfg.siteName)};
$SITE_URL = ${JSON.stringify(cfg.siteUrl)};
$REPO = ${JSON.stringify(cfg.repo || '')};
$NAMES = json_decode('${names}', true);
$SCHOOL_NAMES = json_decode('${schoolNames}', true);`;
  const logic = src.replace('/*MAILER*/', () => mailerPhp()).replace('/*CONFIG*/', () => config).replace('/*AUTH*/', () => editAuthPhp()).replace('/*GH*/', () => ghPhp());
  const e = v => `<?php echo htmlspecialchars(${v}, ENT_QUOTES, 'UTF-8'); ?>`;
  const item = (x, open) => `<div class="panel q-item">
    <h3>${open ? `<label><input type="checkbox" name="ids[]" value="${e(`${x}["id"]`)}" checked> ` : ''}<?php echo htmlspecialchars(${x}["program"] !== '' ? ${x}["program"] : $KIND[${x}["kind"]], ENT_QUOTES, 'UTF-8'); ?>${open ? '</label>' : ''} <span class="hint">${e(`$KIND[${x}["kind"]]`)}<?php if (${x}["kind"] === 'proposal') { ?> · ${e(`${x}["listing"]`)}<?php } ?></span></h3>
    <p class="hint">${e(`ny(${x}["when"])`)}<?php if (isset(${x}["school"]) && ${x}["school"] !== '') { ?> · school: ${e(`${x}["school"]`)}<?php } ?><?php if (isset(${x}["pickup"]) && ${x}["pickup"] !== '') { ?> · picks up: ${e(`${x}["pickup"]`)}<?php } ?><?php if (isset(${x}["campType"]) && ${x}["campType"] !== '') { ?> · ${e(`${x}["campType"]`)}<?php } ?><?php if (isset(${x}["sentBy"]) && ${x}["sentBy"] !== '') { ?> · sent by: ${e(`${x}["sentBy"]`)}<?php } ?><?php if (isset(${x}["listing"]) && ${x}["listing"] !== '' && ${x}["kind"] !== 'proposal') { ?> · listing: ${e(`${x}["listing"]`)}<?php } ?><?php if (!$open && isset(${x}["sent"])) { ?> · sent in batch ${e(`${x}["sent"]`)}<?php if (!empty(${x}["rush"])) { ?> (rush)<?php } ?><?php } ?></p>
    <?php if (${x}["website"] !== '') { ?><p>Website: <a href="${e(`${x}["website"]`)}" rel="noopener nofollow" target="_blank">${e(`${x}["website"]`)}</a></p><?php } ?>
    <?php if (${x}["details"] !== '') { ?><pre class="edit-ask">${e(`${x}["details"]`)}</pre><?php } ?>
    ${open ? `<div class="actions"><button class="btn" type="submit" name="do" value="drop:${e(`${x}["id"]`)}">Not for the run</button></div>` : `<form method="post" action="./" class="actions"><input type="hidden" name="csrf" value="${e('$csrf')}"><input type="hidden" name="id" value="${e(`${x}["id"]`)}"><button class="btn" type="submit" name="do" value="drop">Done, take it off</button></form>`}
  </div>`;
  const hero = `    <h1>The weekly run’s queue</h1>
    <p class="lede">What came in through the site and needs a program’s website read: suggestions, updates, changes managers proposed, your own notes. Send a batch and the scheduled run checks each one against the provider’s own site and opens a pull request.</p>`;
  const body = `<div class="prose stats" data-queue-page>
<?php if ($said !== '') { ?><p class="flag">${e('$said')}</p><?php } ?>
  <h2>Waiting (<?php echo count($open); ?>)</h2>
  <?php if (!$open) { ?><p class="hint">Nothing waiting. Suggestions from the forms, updates sent from a listing’s page, and changes the people who run a listing propose all land here.</p><?php } else { ?>
  <p class="hint">Each item is shown as it will be sent: names, email addresses and phone numbers are already taken out, and only ticked items go. Untick anything that shouldn’t reach the repository, which is public.</p>
  <form method="post" action="./" id="q-send"><input type="hidden" name="csrf" value="${e('$csrf')}">
  <?php foreach ($open as $x) { ?>${item('$x', true)}<?php } ?>
    <div class="panel"><label><input type="checkbox" name="rush" value="1"> <b>Rush:</b> email me a reminder to press Run now, so this goes out within the hour instead of on the run’s next morning</label>
    <div class="actions"><button class="btn primary" type="submit" name="do" value="send">Send the ticked items to the weekly run</button></div></div>
  </form>
  <?php } ?>

  <h2>Add a note for the run</h2>
  <p class="hint">Anything you want checked that didn’t come through a form: “Is Shot Tower’s fall term still $45?”, “Look for the new Mighty Writers pickup list.” A note is an item like the others.</p>
  <form method="post" action="./" class="q-note"><input type="hidden" name="csrf" value="${e('$csrf')}">
    <label for="q-note">The note</label><textarea id="q-note" name="text" rows="3" maxlength="2000" required></textarea>
    <div class="actions"><button class="btn" type="submit" name="do" value="note">Add it to the queue</button></div>
  </form>

  <h2>Schools people asked for</h2>
  <?php if (!$schools) { ?><p class="hint">None in the last <?php echo $KEEP_DAYS; ?> days.</p><?php } else { ?>
  <p class="hint">Counted from the “ask for your school” page and the suggestion form. Adding a school is yours to do; the run only hears the demand, with every batch.</p>
  <ul><?php foreach ($schools as $s) { ?><li>${e('$s["school"]')}: <?php echo (int) $s["n"]; ?> (last ${e('ny($s["last"])')})</li><?php } ?></ul>
  <?php } ?>

  <h2>Sent to the run</h2>
  <?php if (!$batches) { ?><p class="hint">Nothing sent yet.</p><?php } else { ?>
  <p class="hint">Each batch is a commit on the repository’s <code>queue</code> branch, and the run opens a pull request named for it. “Run now” is on the scheduled task in the Claude app.</p>
  <ul><?php foreach ($batches as $b) { ?><li>${e('ny($b["when"])')}: <?php echo (int) $b["n"]; ?> item<?php echo (int) $b["n"] === 1 ? '' : 's'; ?><?php if (!empty($b["rush"])) { ?>, rush<?php } ?> · batch <code>${e('$b["id"]')}</code><?php if ($REPO !== '') { ?> · <a href="https://github.com/${e('$REPO')}/pulls?q=head%3Aweekly-${e('$b["id"]')}" rel="noopener" target="_blank">its pull request</a><?php } ?></li><?php } ?></ul>
  <?php } ?>
  <?php if ($sent) { ?><details><summary>Items already sent (<?php echo count($sent); ?>)</summary>
  <?php foreach ($sent as $x) { ?>${item('$x', false)}<?php } ?>
  </details><?php } ?>
  <p><a class="btn" href="../">Back to editing</a> <a class="btn" href="../claims/">Claims and proposed changes</a></p>
</div>`;
  const page = layout({ title: 'The weekly run’s queue', description: 'What is waiting for the weekly research run.', pathName: 'edit/queue/', depth: 2, current: null, hero, body, noindex: true, quiet: true });
  return logic + '\n' + page;
}

// ---------- summer camps: one page, built from data/camps.json ----------
// Each camp carries the summer its details describe ("season"). Until a camp posts next summer, last summer's weeks,
// hours and price stay up as a guide and the card says which summer they are.
const campsPath = 'summer-camps/';
const weekendPath = 'weekends/';
// The area filter groups a citywide list into a handful of parts of the city. A neighborhood missing here falls under
// "Elsewhere in the city"; a camp with no neighborhood (it runs all over) shows under every area.
const CAMP_AREAS = [
  ['Center City and nearby', ['Center City', 'Rittenhouse', 'Washington Square West', 'Logan Square', 'Old City', 'Penn’s Landing', 'Fitler Square', 'Callowhill', 'Fairmount', 'Society Hill']],
  ['South Philly', ['Queen Village', 'Bella Vista', 'Passyunk Square', 'East Passyunk', 'Pennsport', 'Dickinson Narrows', 'Hawthorne', 'Graduate Hospital', 'Whitman', 'Lower Moyamensing', 'Point Breeze', 'Newbold', 'Girard Estate', 'Packer Park', 'Grays Ferry', 'South Philadelphia']],
  ['Kensington, Fishtown and North', ['South Kensington', 'Kensington', 'Fishtown', 'Northern Liberties', 'Fairhill', 'Port Richmond', 'North Philadelphia']],
  ['Northwest', ['Mount Airy', 'Germantown', 'Chestnut Hill', 'Roxborough', 'Manayunk', 'East Falls']],
  ['West Philly', ['Cobbs Creek', 'West Fairmount Park', 'University City', 'West Philadelphia']],
  ['Northeast', ['Fox Chase']],
];
{
  const known = new Set(CAMP_AREAS.flatMap(a => a[1]));
  const odd = [...new Set([...summerCamps, ...programs.filter(p => p.weekend)].flatMap(x => x.neighborhoods || []).filter(n => !known.has(n)))];
  if (odd.length) console.log(`Note: ${odd.join(', ')} ${odd.length === 1 ? 'is' : 'are'} not in a part of the city (CAMP_AREAS in build.mjs), so camps and weekend classes there show under "Elsewhere in the city".`);
}
const campAreas = c => { const n = c.neighborhoods || []; if (!n.length) return CAMP_AREAS.map(a => a[0]); const out = new Set(n.map(x => (CAMP_AREAS.find(a => a[1].includes(x)) || ['Elsewhere in the city'])[0])); return [...out]; };
const seasonPill = c => c.season ? `<span class="pill season ${campsFile && c.season > campsFile.season ? 'next' : 'nearby'}">${c.season > campsFile.season ? 'Summer ' + c.season : c.season + ' details'}</span>` : `<span class="pill season none">No dates yet</span>`;
// ---------- summer schedule: which weeks each camp runs, worked out from the dates it lists ----------
// A camp's weeks come from the first date range in its "weeks" line ("June 8 to August 28, 2026 … none June 29 to
// July 3"). A camp whose weeks can't be written as one range carries a "runs" list instead ([[first day, last day], …],
// with "skips" for the Mondays of weeks off). A line with no range in it gives no weeks, and the schedule says so.
// The schedule is for the coming summer. A camp that has posted that summer shows its real weeks; one still showing
// last summer is moved 52 weeks on, onto the same week of the calendar, and marked as last summer's dates.
const summerPath = 'summer-schedule/';
const weeksPath = 'summer-camps/weeks/';   // the chart of which camp runs which week, on its own page
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const utcDay = iso => new Date(iso + 'T12:00:00Z');
const plusDays = (iso, n) => new Date(utcDay(iso).getTime() + n * 864e5).toISOString().slice(0, 10);
const mondayOf = iso => plusDays(iso, -((utcDay(iso).getUTCDay() + 6) % 7));
function campWeeks(c) {
  const year = c.season;
  if (!year) return [];
  const md = (m, d) => `${year}-${String(MONTH_NAMES.indexOf(m) + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  let runs = [], skips = [];
  if (Array.isArray(c.runs)) {
    if (c.runs.some(r => !String(r[0]).startsWith(year + '-') || !String(r[1]).startsWith(year + '-'))) { console.warn(`Note: ${c.name} has "runs" dates outside its ${year} season, so the summer schedule ignores them.`); return []; }
    runs = c.runs; skips = (c.skips || []).map(mondayOf);
  } else {
    const M = MONTH_NAMES.join('|');
    const range = () => new RegExp(`(${M}) (\\d{1,2}) to (?:(${M}) )?(\\d{1,2})(?:, (\\d{4}))?`);
    // What a line says about time off is read apart from the dates the camp runs.
    const off = [];
    const main = String(c.weeks || '').replace(/\b(?:none|no (?:regular )?camp|closed)\b([^.]*)/gi, (all, rest) => { off.push(rest); return ' '; });
    const r = range().exec(main);
    if (r && (!r[5] || +r[5] === year)) runs.push([md(r[1], r[2]), md(r[3] || r[1], r[4])]);
    for (const part of off) {
      if (/weeks? of/i.test(part)) for (const x of part.matchAll(new RegExp(`(${M}) (\\d{1,2})`, 'g'))) skips.push(mondayOf(md(x[1], x[2])));
      else { const o = range().exec(part); if (o) { const a = md(o[1], o[2]), b = md(o[3] || o[1], o[4]); for (let w = mondayOf(a); w <= b; w = plusDays(w, 7)) if ([0, 1, 2, 3, 4].filter(i => plusDays(w, i) >= a && plusDays(w, i) <= b).length >= 3) skips.push(w); } }   // a single day off doesn't cancel the week
    }
  }
  const out = new Set();
  for (const [a, b] of runs) for (let w = mondayOf(a); w <= b; w = plusDays(w, 7)) if ([0, 1, 2, 3, 4].some(i => plusDays(w, i) >= a && plusDays(w, i) <= b)) out.add(w);
  for (const s of skips) out.delete(s);
  return [...out].sort();
}
const summerYear = +TODAY.slice(0, 4) + (TODAY.slice(5) > '08-31' ? 1 : 0);
const summerPlan = (() => {
  let labor = `${summerYear}-09-01`; while (utcDay(labor).getUTCDay() !== 1) labor = plusDays(labor, 1);   // Labor Day
  const lastDay = daysOff?.lastDay?.startsWith(summerYear + '-') ? daysOff.lastDay : null;
  let w = mondayOf(lastDay || `${summerYear}-06-08`);
  if (lastDay && utcDay(lastDay).getUTCDay() >= 4) w = plusDays(w, 7);   // school runs through Thursday or Friday, so camp starts the week after
  const weeks = [];
  for (; w < labor; w = plusDays(w, 7)) weeks.push(w);
  const label = m => { const a = utcDay(m), b = utcDay(plusDays(m, 4)); const mo = d => MONTH_NAMES[d.getUTCMonth()]; return a.getUTCMonth() === b.getUTCMonth() ? `${mo(a)} ${a.getUTCDate()}–${b.getUTCDate()}` : `${mo(a)} ${a.getUTCDate()} – ${mo(b)} ${b.getUTCDate()}`; };
  const camps = [...summerCamps].sort((a, b) => a.name.localeCompare(b.name)).map(c => {
    const gap = summerYear - (c.season || 0);
    const on = gap === 0 || gap === 1 ? campWeeks(c).map(m => weeks.indexOf(plusDays(m, 364 * gap))).filter(i => i > -1) : [];
    return { c, on, exact: gap === 0 };
  });
  return { weeks, label, lastDay, camps, dated: camps.filter(x => x.on.length), undated: camps.filter(x => !x.on.length) };
})();
// ---------- my kids' calendar: the whole year from every plan, for a signed-in parent ----------
// The page is a shell. What is on it comes from the plans in the browser and, once someone signs in, the ones kept in
// their profile: the after-school week, the days off, the summer, and the sign-up dates of whatever was picked. It has
// no address of its own for any family: nothing about a child is ever in the page that is served, or in a link.
const yearPath = 'calendar/';
const YEAR_PAGE = !!(GROUPS && daysOff);
// ---------- the planners in one place: the week, the days off, the summer, and the calendar they add up to ----------
const schedulesPath = 'schedules/';
function schedulesPage() {
  const D = 1;
  const daysLeft = offDays.reduce((n, d) => n + d.dates.length, 0);
  const weeks = summerCamps.length ? summerPlan.weeks.length : 0;
  const ICON = {
    week: 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9.5h14V19H5zm2 2.5v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2z',
    tent: 'M12 3 1.5 20h21zm0 7 2.6 8H9.4z',
    sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v4h-2zm0 18h2v4h-2zM1 11h4v2H1zm18 0h4v2h-4zM4.2 5.6l1.4-1.4 2.8 2.8L7 8.4zm11.4 11.4 1.4-1.4 2.8 2.8-1.4 1.4zM4.2 18.4 7 15.6l1.4 1.4-2.8 2.8zM15.6 7l2.8-2.8 1.4 1.4L17 8.4z',
    year: 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9.5h14V19H5zm2.6 4.9 2.9 2.9 5.9-5.9-1.4-1.4-4.5 4.5-1.5-1.5z',
  };
  // A small picture of what each planner makes. Drawn, not photographed: no real child's plan is shown anywhere.
  const pill = (x, y, w, c) => `<rect x="${x}" y="${y}" width="${w}" height="11" rx="5.5" fill="${c}"/>`;
  const ART = {
    week: ['M', 'T', 'W', 'T', 'F'].map((d, i) => `<g transform="translate(${14 + i * 51} 14)"><rect width="45" height="82" rx="9" class="pa-card"/><text x="22.5" y="19" text-anchor="middle" class="pa-day">${d}</text>${pill(6, 30, 33, ['#1F7A3A', '#B4237A', '#0E7C86', '#6B3FA0', '#C2410C'][i])}<rect x="6" y="48" width="${[26, 33, 20, 30, 24][i]}" height="6" rx="3" class="pa-line"/><rect x="6" y="60" width="${[33, 18, 28, 22, 31][i]}" height="6" rx="3" class="pa-line"/></g>`).join(''),
    off: `<rect x="14" y="10" width="252" height="90" rx="10" class="pa-card"/>${[0, 1, 2, 3].map(r => [0, 1, 2, 3, 4, 5, 6].map(c => { const on = [[0, 1], [1, 3], [1, 4], [3, 0]].some(([a, b]) => a === r && b === c); return `<rect x="${26 + c * 33}" y="${20 + r * 19}" width="28" height="14" rx="4" ${on ? 'fill="#F3C613"' : 'class="pa-cell"'}/>${on ? `<rect x="${30 + c * 33}" y="${25 + r * 19}" width="20" height="4" rx="2" fill="${['#0E7C86', '#B4237A', '#B4237A', '#1F7A3A'][[[0, 1], [1, 3], [1, 4], [3, 0]].findIndex(([a, b]) => a === r && b === c)]}"/>` : ''}`; }).join('')).join('')}`,
    sum: `<rect x="14" y="10" width="252" height="90" rx="10" class="pa-card"/>${Array.from({ length: 10 }, (_, i) => `<rect x="${24 + i * 23.5}" y="20" width="19" height="6" rx="3" class="pa-line"/>`).join('')}${pill(24, 36, 66, '#2C8444')}${pill(94.5, 36, 42.5, '#C2410C')}${pill(141.5, 36, 19, '#6B3FA0')}<rect x="165" y="36" width="19" height="11" rx="5.5" class="pa-gap"/>${pill(188.5, 36, 66, '#0E7C86')}${pill(24, 58, 42.5, '#B4237A')}${pill(71, 58, 89.5, '#2C8444')}${pill(165, 58, 42.5, '#1763B8')}<rect x="212" y="58" width="19" height="11" rx="5.5" class="pa-gap"/>${pill(235.5, 58, 19, '#C2410C')}<rect x="24" y="80" width="90" height="6" rx="3" class="pa-line"/>`,
    year: [['NOV', '3', '#F3C613', 150], ['JAN', '12', '#1763B8', 120], ['JUN', '22', '#2C8444', 164]].map(([m, d, c, w], i) => `<g transform="translate(14 ${10 + i * 31})"><rect width="252" height="26" rx="8" class="pa-card"/><rect x="5" y="4" width="34" height="18" rx="5" fill="${c}"/><text x="22" y="17" text-anchor="middle" class="pa-date"${c === '#F3C613' ? ' fill="#2A2100"' : ' fill="#FFFFFF"'}>${d}</text><text x="49" y="11.5" class="pa-mon">${m}</text><rect x="49" y="15" width="${w}" height="6" rx="3" class="pa-line"/></g>`).join(''),
  };
  const art = k => `<div class="plan-art" aria-hidden="true"><svg viewBox="0 0 280 110" focusable="false">${ART[k]}</svg></div>`;
  const icon = k => `<span class="plan-ic" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="${ICON[k]}"/></svg></span>`;
  const card = ({ k, artKey, color, kicker, name, text, points, cta, id }) => `<article class="plan-card" id="${id}" style="--tc:${color}">
      ${art(artKey)}
      <div class="plan-head">${icon(k)}<div><p class="kicker">${kicker}</p><h2>${name}</h2></div></div>
      <p>${text}</p>
      <ul class="plan-points">${points.map(x => `<li>${x}</li>`).join('')}</ul>
      <p class="plan-go">${cta}</p>
    </article>`;
  const btn = (href, label, what) => `<a class="btn primary" href="${href}">${label}</a>`;
  const cards = [
    card({ k: 'week', artKey: 'week', id: 'week', color: '#1763B8', kicker: T(`Monday to Friday`), name: T(`Build your week`),
      text: T(`Put a program on each afternoon and see the whole week in one place. More than one child? Each gets their own.`),
      points: [T(`Add programs day by day, or roll a themed week to start from`), T(`See what the week comes to, from each program’s published prices`), T(`Turn it into one picture to text, print, or hand to a teacher`)],
      cta: btn(link('board/', D), T(`Build your week`), 'week') }),
    daysOff ? card({ k: 'tent', artKey: 'off', id: 'days-off', color: '#B88A00', kicker: daysLeft ? T(`{n} days off still to come`, { n: daysLeft }) : T(`Days school is closed`), name: T(`Build your day-camp plan`),
      text: T(`Every day district schools are closed this year, and the {n} programs that run a camp on them.`, { n: campPrograms.length }),
      points: [T(`See who’s open on each day off, break by break`), T(`Pick a camp, or a day at home, for each child`), T(`Save it as a calendar picture, or put the days in your phone’s calendar`)],
      cta: btn(link(offPath, D), T(`Plan the days off`), 'daysoff') }) : '',
    summerCamps.length ? card({ k: 'sun', artKey: 'sum', id: 'summer', color: '#2C8444', kicker: T(`{n} weeks of summer`, { n: weeks }), name: T(`Build your summer`),
      text: T(`The weeks between the last day of school and Labor Day, and which of {n} camps run in each one.`, { n: summerCamps.length }),
      points: [T(`See on one chart which camps run each week`), T(`Line up a camp for every week, child by child, and see what it adds up to`), T(`Make it a calendar picture, or put the weeks in your phone’s calendar`)],
      cta: btn(link(summerPath, D), T(`Plan your summer`), 'summer') }) : '',
    YEAR_PAGE ? card({ k: 'year', artKey: 'year', id: 'year', color: '#6B3FA0', kicker: T(`With a free account`), name: 'My kids’ calendar',   // the page's name, as the menu has it: its heading there has words of its own
     
      text: T(`The three plans above, added up: the school week, every day off, the camp weeks and the sign-up dates, in date order for the whole year.`),
      points: [T(`One calendar file for your phone, which you can bring up to date later`), T(`Room for your own dates: picture day, pretzel day, a form that’s due`), T(`A picture of any month to send or print`), T(`Private: it has no link, and only you can open it`)],
      cta: `<span class="when-out">${btn(link('register/', D) + '?next=calendar', T(`Create a free account`), 'year_register')}</span><span class="when-in">${btn(link(yearPath, D), T(`Open my kids’ calendar`), 'year')}</span>` }) : '',
  ].filter(Boolean);
  const hero = `    <h1>${T(`Build a schedule`)}</h1>
    <p class="lede">${GATE ? T(`Three planners, one for each part of a family’s year: the school week, the days school is closed, and the summer. All three are free: you sign in with a free account to use them.`) : T(`Three planners, one for each part of a family’s year: the school week, the days school is closed, and the summer. All three are free and work without an account.`)}</p>`;
  const body = `<section class="section" id="planners">
  <div class="plans">
    ${cards.join('\n    ')}
  </div>
</section>
<section class="notes">
  <h2>${T(`How the planners work`)}</h2>
  <ul>
    <li>${T(`Nothing to put on a plan yet?`)} <a href="${link('schools/', D)}">${T(`Find your school`)}</a> ${T(`to see what works with it, or`)} <a href="${link('programs/', D)}">${T(`look through every program`)}</a>.</li>
    ${GATE ? '' : `<li>${T(`A plan stays on the phone or computer you made it on. Nothing about your child is sent to us.`)}</li>`}${GROUPS ? `
    <li>${GATE ? T(`The planners need a free account. Signed in, each plan is kept in your profile, so it’s on every device you sign in on.`) : T(`With a free account you can keep each plan in your profile, so it’s on every device you sign in on.`)} <a class="when-out" href="${link('register/', D)}">${T(`Create a free account`)}</a></li>` : ''}
    <li>${T(`Days, hours and prices come from each program’s own website. Check with the program before you count on a spot.`)}</li>
  </ul>
</section>`;
  return layout({ title: 'Build a schedule: the week, days off and summer', description: `Free planners for Philadelphia families: build the after-school week, plan the days school is closed, and line up summer camps week by week.`, pathName: schedulesPath, depth: D, current: schedulesPath, hero, body });
}

// "To do": what a signed-in parent still has to sign up for. A shell with the days off and the listings' names in it
// and nothing about anyone; site.js fills it from the days-off plan in the profile, or the one on this device. Like
// the calendar it is kept out of search and loads no analytics or recordings.
function todoPage() {
  const D = 1;
  const data = {
    year: +String(daysOff.schoolYear).slice(0, 4), offPage: link(offPath, D), calPage: link(yearPath, D),
    offDays: offDays.flatMap(d => d.dates.filter(x => x >= TODAY).map(x => ({ d: x, name: d.name }))),
    programs: Object.fromEntries(programs.filter(p => p.daysOff).map(p => [p.id, { n: p.name, href: link(programPath(p), D), go: outUrl(p.daysOff.url, { type: 'camp', program: p }), off: p.daysOff.dates.filter(x => x >= TODAY) }])),
  };
  const hero = `    <h1><span class="when-out">${T(`A to-do list for camp sign-ups`)}</span><span class="when-in">${T(`To do`)}</span></h1>
    <p class="lede when-out">${T(`The camp days you’ve planned and haven’t signed up for yet, in one list. It’s part of a free account.`)}</p>${heroCta(D, 'todo')}
    <p class="lede when-in">${T(`What’s left to sign up for. Putting a camp on your plan doesn’t sign your child up, so every camp day you’ve planned waits here until you tick it off.`)}</p>`;
  const body = `<div ${groupsAttrs(D)} data-clarity-mask="true" style="display:contents">
  <noscript><p class="ask">${T(`The to-do list needs JavaScript turned on.`)}</p></noscript>
  <section class="section when-out" id="todo-out">
    ${GATE ? planShow('todo', D) : `<h2>${T(`A list of what’s left to sign up for`)}</h2>
    <p>${T(`Plan the days school is closed, and each camp day you pick lands on a to-do list with a link to that camp’s own sign-up page. Tick it off once you’ve signed up.`)}</p>
    <div class="actions"><a class="btn primary big" href="${link('register/', D)}?next=todo">${T(`Create a free account`)}</a></div>`}
  </section>
  <p class="hint when-in" id="todo-wait">${T(`Getting your list…`)}</p>
  <section class="section sum todo-sec needs-js-block" id="todo-page" hidden>
    <h2>${T(`Camps to sign up for`)}</h2>
    <p class="hint" id="todo-src"></p>
    <div id="todo-list"></div>
    <p class="hint" id="todo-status" aria-live="polite"></p>
    <div class="actions todo-more"><a class="btn" href="${link(offPath, D)}#plan">${T(`Plan the days off`)}</a><a class="btn" href="${link(yearPath, D)}">My kids’ calendar</a></div>
  </section>
  <section class="notes when-in">
    <h2>${T(`How this list works`)}</h2>
    <ul>
      <li>${T(`It’s made from your days-off plan: every day you’ve put a camp on, for every child. A day at home needs no sign-up, so it isn’t here.`)}</li>
      <li>${T(`A tick is your own note. We can’t see whether you registered, and the camp isn’t told anything.`)}</li>
      <li>${T(`Ticks are kept with the plan, on this device and in your profile, so they follow you to another phone or computer.`)}</li>
      <li>${T(`Change the camp on a day and its tick is cleared, because it’s a new sign-up.`)}</li>
    </ul>
  </section>
  <script type="application/json" id="todo-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: 'To do: camps to sign up for', description: `Your ${cfg.siteName} to-do list: the camp days you’ve planned and haven’t signed up for yet.`, pathName: 'to-do/', depth: D, current: null, hero, body, next: 'todo', noindex: true, quiet: true, scripts: groupsScript(D) });
}

function calendarPage() {
  const D = 1, P = summerCamps.length ? summerPlan : null;
  const shortHours = c => String(c.hours || '').split(/\. /)[0].replace(/\.$/, '');
  const data = {
    year: +String(daysOff.schoolYear).slice(0, 4), schoolYear: daysOff.schoolYear, lastDay: daysOff.lastDay || '', site: cfg.siteUrl,
    board: link('board/', D), offPage: link(offPath, D), sumPage: link(summerPath, D),
    offDays: offDays.flatMap((d, bi) => d.dates.filter(x => x >= TODAY).map(x => ({ d: x, name: d.name, b: bi }))),
    // every listing a week or a day off can name: its name, its page, the sign-up dates it has posted, and the days off it posted a camp for
    programs: Object.fromEntries(programs.map(p => [p.id, { n: p.name, href: link(programPath(p), D), dates: upcomingDates(p).map(d => ({ date: d.date, label: d.label })), ...(p.daysOff ? { off: p.daysOff.dates.filter(x => x >= TODAY), url: p.daysOff.url, go: outUrl(p.daysOff.url, { type: 'camp', program: p }) } : {}) }])),
    summer: P ? {
      year: summerYear, weeks: P.weeks.map(w => ({ d: w, label: P.label(w) })),
      camps: Object.fromEntries(P.camps.map(({ c, on, exact }) => [c.id, { n: c.name, w: on, x: exact ? 1 : 0, y: c.season || 0, h: shortHours(c), href: campLink(c, D), dates: (c.dates || []).filter(d => d.date >= TODAY).map(d => ({ date: d.date, label: d.label })) }])),
    } : null,
  };
  const hero = `    <h1>${T(`My kids’ calendar`)}</h1>
    <p class="lede">${T(`Everything you’ve planned for the school year and the summer, in one place: the after-school week, every day off, camp weeks and sign-up dates. Only you can see it.`)}</p>${heroCta(D, 'calendar')}`;
  const body = `<div ${groupsAttrs(D)} data-year-page data-clarity-mask="true" style="display:contents">
  <noscript><p class="ask">${T(`The calendar needs JavaScript turned on.`)}</p></noscript>
  <section class="section year-out" id="year-out">
    ${GATE ? planShow('year', D) : `<h2>${T(`The whole year, lined up`)}</h2>
    <p>${T(`Sign in and what you’ve planned comes together on one page, on any device.`)}</p>
    ${planExample('year')}
    <div class="actions"><a class="btn primary big" href="${link('register/', D)}?next=calendar">${T(`Create a free account`)}</a></div>`}
    <p class="hint">${GATE ? T(`The same account opens the planners:`) : T(`Planning doesn’t need an account:`)} <a href="${link('board/', D)}">${T(`build a week`)}</a>, <a href="${link(offPath, D)}#plan">${T(`plan the days off`)}</a>${P ? `, <a href="${link(summerPath, D)}">${T(`plan the summer`)}</a>` : ''}.</p>
  </section>
  <p class="hint when-in" id="year-wait">${T(`Getting your calendar…`)}</p>
  <section class="section sum year needs-js-block" id="year" hidden>
    <h2 id="year-h">${T(`The year`)}</h2>
    ${jumpNav()}
    <div class="year-step" id="year-add" data-jump-to="Add it">
      <p class="step-head"><b aria-hidden="true">1</b><span>${T(`Add it`)}</span></p>
      <p class="step-say">${T(`Your calendar fills in from your planners, and from any dates you add here yourself.`)}</p>
      <ul class="year-src" id="year-src"></ul>
    <div class="year-own" id="year-own">
    <h3>${T(`Add your own dates`)}</h3>
    <p>${T(`Picture day, pretzel day, a form that’s due, a half day: anything you need to remember, for one child or for everyone. They show up in the calendar below, in the pictures and in the file for your phone. Something that happens every week needs only the day of the week.`)}</p>
    <form class="own-form" id="own-form">
      <div class="field own-what"><label for="own-what">${T(`What`)}</label><input id="own-what" type="text" maxlength="60" list="own-ideas" placeholder="Picture day" autocomplete="off"></div>
      <datalist id="own-ideas">${['Picture day', 'Pretzel day', 'Early dismissal', 'Form due', 'Field trip', 'Library day', 'Gym day', 'Show and tell', 'Bring a snack', 'Dress-down day', 'Concert', 'Parent conference'].map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="field"><label for="own-rep">${T(`How often`)}</label><select id="own-rep"><option value="">One day</option><option value="w">Every week</option></select></div>
      <div class="field" id="own-when-field"><label for="own-when">${T(`When`)}</label><input id="own-when" type="date"></div>
      <div class="field" id="own-dow-field" hidden><label for="own-dow">${T(`Which day`)}</label><select id="own-dow">${[['mon', 'Mondays'], ['tue', 'Tuesdays'], ['wed', 'Wednesdays'], ['thu', 'Thursdays'], ['fri', 'Fridays'], ['sat', 'Saturdays'], ['sun', 'Sundays']].map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></div>
      <div class="field own-who-field"><span class="g-label" id="own-who-label">${T(`Who it’s for`)}</span><div class="own-who" id="own-who" role="group" aria-labelledby="own-who-label"></div></div>
      <div class="actions"><button type="submit" class="btn primary">Add it</button></div>
    </form>
    <details class="own-many">
      <summary>${T(`Add several at once`)}</summary>
      <p class="hint">${T(`Type or paste one on each line, starting with the date or the weekday. They go to whoever is picked under “Who it’s for”.`)}</p>
      <label class="vh" for="own-lines">${T(`Dates, one on each line`)}</label>
      <textarea id="own-lines" rows="5" placeholder="10/14 Picture day&#10;Oct 20 Photo forms due&#10;Wednesdays Pretzel day"></textarea>
      <div class="actions"><button type="button" class="btn" id="own-lines-add">Add these</button></div>
    </details>
    <p class="hint" id="own-status" aria-live="polite"></p>
    <ul class="g-list own-list" id="own-list" hidden></ul>
    <p class="hint">${T(`A weekly one repeats until the last day of school and skips the days school is closed. Your own dates are kept on this device only: they aren’t sent to us, so add them on the phone or computer you’ll look at.`)}</p>
  </div>
    </div>
    <div class="flag year-changed" id="year-changed" hidden></div>
    <div id="year-empty" hidden></div>
    <div id="year-full">
      <div class="year-step" id="year-view" data-jump-to="View it">
        <p class="step-head"><b aria-hidden="true">2</b><span>${T(`View it`)}</span></p>
        <div class="year-view-head">
          <h3 id="year-view-h">${T(`Your plan`)}</h3>
          <div class="tabs view-switch" id="year-views" role="group" aria-label="How to show the plan">
            <button type="button" class="tab vs" data-view="cal" aria-pressed="true">Calendar</button><button type="button" class="tab vs" data-view="list" aria-pressed="false">List</button>
          </div>
        </div>
        <div id="year-week"></div>
        <div class="year-cal" id="year-cal"></div>
        <div id="year-agenda" hidden></div>
      </div>
      <div class="year-step" id="year-share" data-jump-to="Share it" hidden>
        <p class="step-head"><b aria-hidden="true">3</b><span>${T(`Share it`)}</span></p>
      <div class="card-maker sumcard" id="year-card" hidden>
          <h3>${T(`Make it a picture`)}</h3>
          <p>${T(`A calendar for each month, to print for the fridge or send to family. It’s made here in your browser.`)}</p>
          <div class="card-grid">
            <div class="card-fields">
              <div class="sum-pages" id="year-pages" role="group" aria-label="Which calendar"></div>
              <div class="field">
                <label for="year-title">${T(`Title`)}</label>
                <input id="year-title" type="text" maxlength="40" placeholder="Our year" autocomplete="off">
              </div>
              <label class="g-check" id="year-pic-own-row" hidden><input type="checkbox" id="year-pic-own" checked> <span>${T(`Show the dates I added, on every month they fall in`)}</span></label>
              <div class="field">
                <label for="year-photo">${T(`A photo (optional)`)}</label>
                <input id="year-photo" type="file" accept="image/*">
                <span class="hint">${T(`The photo never leaves this device. The calendar is made here in your browser, nothing is uploaded, and the photo isn’t saved.`)}</span>
                <button type="button" class="clear" id="year-photo-clear" hidden>Remove the photo</button>
              </div>
              <div class="actions">
                <button type="button" class="btn primary" id="year-pic-share" hidden>Share the calendar</button>
                <button type="button" class="btn" id="year-pic-copy" hidden>Copy picture</button>
                <button type="button" class="btn" id="year-pic-save">Save as image</button>
                <button type="button" class="btn" id="year-pic-all">Save all of them</button>
                <button type="button" class="btn" id="year-pic-print">Print</button>
              </div>
              <p class="hint" id="year-card-status" aria-live="polite"></p>
            </div>
            <div class="card-preview"><canvas id="year-canvas" width="1080" height="1350" role="img" aria-label="Preview of the calendar"></canvas></div>
          </div>
        </div>
      </div>
      <div class="year-step" id="year-pencil" data-jump-to="Pencil it in">
        <p class="step-head"><b aria-hidden="true">4</b><span>${T(`Pencil it in`)}</span></p>
      <div class="year-file" id="year-file">
          <h3>${T(`Add it to your calendar`)}</h3>
          <p>${T(`One file with everything ticked below, for the calendar on your phone or computer. Open it and your calendar app adds the entries. It’s a copy: if a date changes later, this page will say so, and you download it again.`)}</p>
          <fieldset class="year-opts" id="year-opts">
            <legend class="vh">${T(`What goes in the file`)}</legend>
            <label><input type="checkbox" id="year-o-off" checked> ${T(`Days off, with each child’s plan`)}</label>
            <label><input type="checkbox" id="year-o-sum" checked> ${T(`Summer camp weeks`)}</label>
            <label><input type="checkbox" id="year-o-guide"> ${T(`Camps still showing last summer’s weeks, as a guide`)}</label>
            <label><input type="checkbox" id="year-o-signup" checked> ${T(`Sign-up dates`)}</label>
            <label><input type="checkbox" id="year-o-week"> ${T(`The after-school week, repeating every school week`)}</label>
            <label><input type="checkbox" id="year-o-own" checked> ${T(`Dates you added yourself`)}</label>
          </fieldset>
          <div class="actions"><button type="button" class="btn primary" id="year-dl">Download the calendar file</button><button type="button" class="btn" id="year-print">Print this page</button></div>
          <p class="hint" id="year-status" aria-live="polite"></p>
        </div>
      </div>
    </div>
  </section>
  <script type="application/json" id="year-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({
    title: 'My kids’ calendar', description: `A private calendar of everything you’ve planned on ${cfg.siteName}: the after-school week, days off, summer camps and sign-up dates.`,
    pathName: yearPath, depth: D, current: null, hero, body, next: 'calendar', noindex: true, quiet: true, scripts: groupsScript(D),
  });
}
function summerSchedulePage() {
  const D = 1, P = summerPlan, year = summerYear, base = campsFile.season;
  const guide = P.dated.filter(x => !x.exact).length;
  const price = c => c.weekly === 0 ? 'Free' : c.weekly ? `$${c.weekly} a week` : '';
  const shortHours = c => String(c.hours || '').split(/\. /)[0].replace(/\.$/, '');
  const ageLine = c => c.ageMin || c.ageMax ? `Ages ${c.ageMin ? String(c.ageMin).replace('.5', '½') : ''}${c.ageMin && c.ageMax ? '–' : ''}${c.ageMax || (c.ageMin ? ' and up' : '')}`.replace('Ages –', 'Up to age ') : '';
  const schoolNote = i => P.lastDay && mondayOf(P.lastDay) === P.weeks[i] ? `School’s last day is ${new Date(P.lastDay + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}.` : '';
  const head = P.weeks.map((w, i) => { const d = utcDay(w); return `<th scope="col" data-w="${i}"><span>${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}</span><b>${d.getUTCDate()}</b></th>`; }).join('');
  const chartRows = P.dated.map(({ c, on, exact }) => `<tr data-camp="${esc(c.id)}" data-ages="${c.ageMin || 0} ${c.ageMax || 99}">
  <th scope="row"><a href="${campLink(c, D)}">${esc(c.name)}</a><small>${[ageLine(c), price(c), exact ? `${year} dates` : `${c.season} dates`].filter(Boolean).map(esc).join(' · ')}</small></th>
  ${P.weeks.map((w, i) => on.includes(i) ? `<td class="on${exact ? ' exact' : ''}" data-w="${i}"><span class="vh">${exact ? 'Runs' : 'Ran in ' + c.season}</span></td>` : `<td data-w="${i}"></td>`).join('')}
</tr>`).join('\n');
  const data = {
    year, base, page: `${cfg.siteUrl}/${summerPath}`, campsPage: link(campsPath, D), campUrl: link(`${campsPath}CAMP-ID/`, D),
    weeks: P.weeks.map((w, i) => ({ d: w, label: P.label(w), note: schoolNote(i) })),
    camps: Object.fromEntries(P.camps.map(({ c, on, exact }) => [c.id, { n: c.name, w: on, y: c.season || 0, x: exact ? 1 : 0, p: typeof c.weekly === 'number' ? c.weekly : null, h: shortHours(c), a: [c.ageMin || 0, c.ageMax || 99], hood: (c.neighborhoods || []).join(', '), ...(c.program ? { u: campLink(c, D) } : {}) }])),   // u: a camp tied to a program is read about on the program's page
  };
  const hero = `    <h1>${T(`Plan your summer, week by week`)}</h1>
    <p class="lede">${T(`{n} weeks between the last day of school and Labor Day. See which camps run each week, and line up your own summer.`, { n: P.weeks.length })}</p>${heroCta(D, 'summer')}
    <div class="facts">
      <span>Summer <b>${year}</b></span>
      <span><b>${P.weeks.length}</b> weeks</span>
      <span><b>${P.dated.length}</b> camps with dates</span>
    </div>`;
  const body = `<div style="display:contents">
${guide ? `<section class="section when-in">
  <p class="flag camp-guide"><b>${T(`Most of these dates are from summer {year}, shown as a guide.`, { year: base })}</b> ${T(`A camp that hasn’t posted {next} yet is shown on the weeks it ran last summer, moved to the same week of the calendar. Camps usually post between December and March, and each one switches to its real dates when it does.`, { next: year })}</p>
</section>` : ''}
${jumpNav()}
<section class="section sum needs-js-block${GATE ? ' gated' : ''}" id="plan" data-jump-to="Your summer" data-summer data-clarity-mask="true">
  <h2${gateIn}>${T(`Your summer`)}</h2>
  ${planShow('sum', D)}
  <div${gateIn} style="display:contents">
  <p>${GATE ? T(`Add a camp to each week, for one child or for each of them. Your picks are saved on this device and in your profile, so they’re there on your other devices.`) : T(`Add a camp to each week, for one child or for each of them. Your picks are saved on this device and nowhere else.`)}</p>
  <div class="sum-kids"><div class="kids" id="sum-kids" role="group" aria-label="Which child"></div><button type="button" class="clear" id="sum-kid-add">Add a sibling</button><button type="button" class="clear" id="sum-kid-drop" hidden>Remove this child</button></div>
  <div class="sum-top">
    <div class="field sum-name"><label for="sum-name">${T(`First name (optional)`)}</label>
      <input id="sum-name" type="text" maxlength="40" autocomplete="off"><span class="hint">${GATE ? T(`Kept with the plan in your profile. A nickname or an initial is fine.`) : T(`Stays on this device.`)}</span></div>
    <div class="field sum-age"><label for="sum-age">${T(`Age this summer (optional)`)}</label>
      <select id="sum-age"><option value="">Any age</option>${Array.from({ length: 15 }, (_, i) => `<option value="${i + 3}">${i + 3}</option>`).join('')}</select></div>
    <div class="sum-tally"><div class="sum-strip" id="sum-strip" aria-hidden="true"></div><p id="sum-count" aria-live="polite"></p><p class="hint" id="sum-cost"></p></div>
  </div>
  <div class="year-view-head off-view-head">
    <h3 id="sum-view-h">${T(`Week by week`)}</h3>
    <span class="vs-pick" aria-hidden="true">${T(`Pick your visual mode!`)}<svg viewBox="0 0 48 24" focusable="false"><path d="M2 4c10 0 18 4 26 12l6 6M34 14v8h-8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    <div class="tabs view-switch board-views" id="sum-views" role="group" aria-label="How to show the weeks">
      <button type="button" class="tab vs" data-view="list" aria-pressed="true">${T(`List`)}</button><button type="button" class="tab vs" data-view="cal" aria-pressed="false">${T(`Calendar`)}</button><button type="button" class="tab vs" data-view="chart" aria-pressed="false">${T(`Grid`)}</button><button type="button" class="tab vs" data-view="card" aria-pressed="false"><span class="vs-long">${T(`Share/Save`)}</span><span class="vs-short" aria-hidden="true">${T(`Share`)}</span></button>
    </div>
  </div>
  <div class="year-cal off-month" id="sum-month" hidden></div>
  <div class="off-chart-slot" id="sum-chart-slot" hidden></div>
  <ol class="sum-weeks" id="sum-weeks"></ol>
  <p class="hint share-empty" id="sum-share-empty" hidden>${T(`Add a camp to a week first. Then this is where you share the summer, add it to your calendar, make a picture of it and keep it in your profile.`)}</p>
  <div class="actions sum-tools" id="sum-tools" hidden><button type="button" class="btn primary" id="sum-share" hidden>Share the plan</button><button type="button" class="btn" id="sum-cal">Add to calendar</button><button type="button" class="btn" id="sum-copy">Copy the plan as text</button><button type="button" class="btn" id="sum-print">Print the list</button><button type="button" class="clear" id="sum-clear">Clear the plan</button></div>
  <p class="hint" id="sum-status" aria-live="polite"></p>
  ${GROUPS ? `<div class="sum-profile" id="sum-profile" ${groupsAttrs(D)} hidden></div>` : ''}
  <div class="card-maker sumcard" id="sum-card" hidden>
    <h3>${T(`Make it a calendar`)}</h3>
    <p>${T(`One picture of the whole summer, or a calendar for each month, to print for the fridge or send to family. Every child with a camp picked is on it.`)}</p>
    <div class="card-grid">
      <div class="card-fields">
        <div class="sum-pages" id="sum-pages" role="group" aria-label="Which calendar"></div>
        <div class="field">
          <label for="sum-title">${T(`Title`)}</label>
          <input id="sum-title" type="text" maxlength="40" placeholder="Our summer" autocomplete="off">
        </div>
        <div class="field">
          <label for="sum-photo">${T(`A photo (optional)`)}</label>
          <input id="sum-photo" type="file" accept="image/*">
          <span class="hint">${T(`The photo never leaves this device. The calendar is made here in your browser, nothing is uploaded, and the photo isn’t saved.`)}</span>
          <button type="button" class="clear" id="sum-photo-clear" hidden>Remove the photo</button>
        </div>
        <div class="actions">
          <button type="button" class="btn primary" id="sum-pic-share" hidden>Share the calendar</button>
          <button type="button" class="btn" id="sum-pic-copy" hidden>Copy picture</button>
          <button type="button" class="btn" id="sum-pic-save">Save as image</button>
          <button type="button" class="btn" id="sum-pic-all">Save all of them</button>
          <button type="button" class="btn" id="sum-pic-print">Print</button>
        </div>
        <p class="hint" id="sum-card-status" aria-live="polite"></p>
      </div>
      <div class="card-preview"><canvas id="sum-canvas" width="1080" height="1350" role="img" aria-label="Preview of the summer calendar"></canvas></div>
    </div>
  </div>
  </div>
  <script type="application/json" id="summer-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</section>
<section class="section sum-chart-section when-in" id="chart" data-jump-to="When camps run">
  <h2>${T(`When each camp runs`)}</h2>
  <div class="off-chart-block" id="sum-chart-block">
  <p>${T(`Each column is a week, named by its Monday. A filled box means the camp listed that week. The chart scrolls sideways and down.`)} <span class="needs-js${GATE ? ' when-in' : ''}">${T(`Tap a box to add that week to your summer.`)}</span></p>
  <p class="sum-key"><span><i class="k exact"></i>${T(`{year} dates`, { year })}</span><span><i class="k"></i>${T(`{year} dates, as a guide`, { year: base })}</span><span class="needs-js${GATE ? ' when-in' : ''}"><i class="k picked"></i>${T(`In your summer`)}</span></p>
  <p class="hint" id="sum-chart-note" aria-live="polite"></p>
  <div class="sum-chart-wrap" role="region" aria-label="When each camp runs" tabindex="0">
    <table class="sum-chart">
      <thead><tr><th scope="col">Camp</th>${head}</tr></thead>
      <tbody>
${chartRows}
      </tbody>
    </table>
  </div>
  ${P.undated.length ? `<h3 class="sub">${T(`No dates listed yet`)}</h3>
  <p>${T(`These camps haven’t put dates we can chart on their sites. You can still add one to any week in the list, then check with the camp.`)}</p>
  <ul class="plain cols">${P.undated.map(({ c }) => `<li><a href="${campLink(c, D)}">${esc(c.name)}</a></li>`).join('')}</ul>` : ''}
  </div>
</section>
<section class="section" id="more">
  <p><a class="btn" href="${link(weeksPath, D)}">${T(`Which camps run each week`)}</a> <a class="btn" href="${link(campsPath, D)}">${T(`Every camp, with ages, hours and prices`)}</a></p>
  <p class="hint">${T(`Dates, prices and openings change, and many camps fill early. Confirm with the camp before you plan around a week.`)}</p>
</section>
</div>`;
  return layout({
    title: `Plan summer ${year}, week by week`,
    description: `A free planner for summer ${year} in Philadelphia: a camp for each of the ${P.weeks.length} weeks between the last day of school and Labor Day, for each child, with what it adds up to.`,
    pathName: summerPath, depth: D, current: null, hero, body, next: GATE ? 'summer' : '', showStreet: 'summer', scripts: GROUPS ? groupsScript(D) : '',
  });
}
// /summer-camps/weeks/: which camp runs which week, as a chart, for everyone. The planner keeps the same chart as
// its "Who's open" view for someone signed in.
function summerWeeksPage() {
  const D = 2, P = summerPlan, year = summerYear, base = campsFile.season;
  const guide = P.dated.filter(x => !x.exact).length;
  const price = c => c.weekly === 0 ? 'Free' : c.weekly ? `$${c.weekly} a week` : '';
  const ageLine = c => c.ageMin || c.ageMax ? `Ages ${c.ageMin ? String(c.ageMin).replace('.5', '½') : ''}${c.ageMin && c.ageMax ? '–' : ''}${c.ageMax || (c.ageMin ? ' and up' : '')}`.replace('Ages –', 'Up to age ') : '';
  const head = P.weeks.map((w, i) => { const d = utcDay(w); return `<th scope="col" data-w="${i}"><span>${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}</span><b>${d.getUTCDate()}</b></th>`; }).join('');
  const chartRows = P.dated.map(({ c, on, exact }) => `<tr data-camp="${esc(c.id)}" data-ages="${c.ageMin || 0} ${c.ageMax || 99}">
  <th scope="row"><a href="${campLink(c, D)}">${esc(c.name)}</a><small>${[ageLine(c), price(c), exact ? `${year} dates` : `${c.season} dates`].filter(Boolean).map(esc).join(' · ')}</small></th>
  ${P.weeks.map((w, i) => on.includes(i) ? `<td class="on${exact ? ' exact' : ''}" data-w="${i}"><span class="vh">${exact ? 'Runs' : 'Ran in ' + c.season}</span></td>` : `<td data-w="${i}"></td>`).join('')}
</tr>`).join('\n');
  const hero = `    <p class="where"><a href="${link(campsPath, D)}"><span aria-hidden="true">←</span> ${T(`All summer camps`)}</a></p>
    <h1>${T(`Which camps run each week of summer {year}`, { year })}</h1>
    <p class="lede">${T(`{n} weeks between the last day of school and Labor Day, and which of {m} camps has listed each one.`, { n: P.weeks.length, m: P.dated.length })}</p>
    <div class="facts">
      <span>Summer <b>${year}</b></span>
      <span><b>${P.weeks.length}</b> weeks</span>
      <span><b>${P.dated.length}</b> camps with dates</span>
    </div>`;
  const body = `<div style="display:contents">
${guide ? `<section class="section">
  <p class="flag camp-guide"><b>${T(`Most of these dates are from summer {year}, shown as a guide.`, { year: base })}</b> ${T(`A camp that hasn’t posted {next} yet is shown on the weeks it ran last summer, moved to the same week of the calendar. Camps usually post between December and March, and each one switches to its real dates when it does.`, { next: year })}</p>
</section>` : ''}
<section class="section sum-chart-section" id="chart">
  <h2>${T(`When each camp runs`)}</h2>
  <p>${T(`Each column is a week, named by its Monday. A filled box means the camp listed that week. The chart scrolls sideways and down.`)}</p>
  <p class="sum-key"><span><i class="k exact"></i>${T(`{year} dates`, { year })}</span><span><i class="k"></i>${T(`{year} dates, as a guide`, { year: base })}</span></p>
  <div class="sum-chart-wrap" role="region" aria-label="When each camp runs" tabindex="0">
    <table class="sum-chart">
      <thead><tr><th scope="col">Camp</th>${head}</tr></thead>
      <tbody>
${chartRows}
      </tbody>
    </table>
  </div>
  ${P.undated.length ? `<h3 class="sub">${T(`No dates listed yet`)}</h3>
  <p>${T(`These camps haven’t put dates we can chart on their sites. Ask each one which weeks it runs.`)}</p>
  <ul class="plain cols">${P.undated.map(({ c }) => `<li><a href="${campLink(c, D)}">${esc(c.name)}</a></li>`).join('')}</ul>` : ''}
</section>
<section class="section" id="plan-it">
  <h2>${T(`Line up your own summer`)}</h2>
  <p>${T(`Add a camp to each week, for one child or for each of them, and see what the summer adds up to.`)}</p>
  <p><a class="btn primary" href="${link(summerPath, D)}">${T(`Plan your summer`)}</a> <a class="btn" href="${link(campsPath, D)}">${T(`Every camp, with ages, hours and prices`)}</a></p>
  <p class="hint">${T(`Dates, prices and openings change, and many camps fill early. Confirm with the camp before you plan around a week.`)}</p>
</section>
</div>`;
  return layout({
    title: `Summer ${year} camp schedule for Philadelphia, week by week`,
    description: `See which of ${P.dated.length} Philadelphia day camps run each of the ${P.weeks.length} weeks of summer ${year}, between the last day of school and Labor Day, on one chart.`,
    pathName: weeksPath, depth: D, current: campsPath, hero, body, showStreet: 'summer',
    jsonLd: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Summer camps', `${cfg.siteUrl}/${campsPath}`], [`Summer ${year}, week by week`, `${cfg.siteUrl}/${weeksPath}`]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
  });
}
// ---------- a page per summer camp ----------
// The list shows a short card for each camp; everything the camp posts is on its own page, which search engines can find.
const campPath = c => `${campsPath}${c.id}/`;
// Where a camp is read about: its own page, or its program's page when it is tied to one.
const campLink = (c, depth) => { const p = c.program && programs.find(x => x.id === c.program); return p ? `${link(programPath(p), depth)}#summer` : link(campPath(c), depth); };
// A camp shaped like a program, for the calendar files and links a sign-up date gets.
const campAsListing = c => ({ id: 'camp-' + c.id, name: c.name, website: c.website, register: { url: c.registerUrl || c.website } });
const campAges = c => c.ageMin || c.ageMax ? (c.ageMin && c.ageMax ? `Ages ${String(c.ageMin).replace('.5', '½')}–${c.ageMax}` : c.ageMin ? `Ages ${String(c.ageMin).replace('.5', '½')} and up` : `Up to age ${c.ageMax}`) : '';
const campPrice = c => c.weekly === 0 || (c.weekly === undefined && c.price === 'free') ? 'Free' : c.weekly ? `$${c.weekly} a week` : '';
const campHoursShort = c => String(c.hours || '').split(/[.;] /)[0].replace(/\.$/, '');
const campWeeksShort = c => { const m = /(January|February|March|April|May|June|July|August|September) \d{1,2} to (?:(?:January|February|March|April|May|June|July|August|September) )?\d{1,2}(?:, \d{4})?/.exec(String(c.weeks || '')); return m ? m[0] : ''; };
// A camp's summer section: the weeks it runs, the details, "Add to your summer", then the camp's own sign-up and
// website, and the follow box. The same block sits on a camp's own page and, for a camp tied to a program, on the
// program's page as its Summer section.
function summerBlock(c, D, inProgram = false) {
  const year = summerYear;
  const where = [c.address, (c.neighborhoods || []).join(', ')].filter(Boolean);
  const rows = [['Ages', fold(esc(c.ages || ''))], ['Weeks', fold(esc(c.weeks || ''))], ['Hours', fold(esc(c.hours || ''))], ['Before and after', fold(esc(c.extended || ''))], ['Cost', fold(esc(c.cost || ''))], ['Help with cost', fold(esc(c.aid || ''))], ['Where', esc(where.length === 2 ? `${where[0]} (${where[1]})` : where[0] || '')], ['Signing up', fold(esc(c.signup || ''))], ['Phone', c.phone ? `<a href="tel:+1-${esc(c.phone)}">${esc(c.phone)}</a>` : '']]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`);
  const campDates = (c.dates || []).filter(d => d.date >= TODAY);
  const campCal = campAsListing(c);
  if (campDates.length) rows.splice(-1, 0, `<dt>Dates</dt><dd class="dates">${campDates.map(d => `<span class="cal" data-date="${d.date}"><b>${shortDate(d.date)}:</b> ${esc(d.label.replace(/\.$/, ''))}. ${PREVIEW ? '' : `<a href="${link('cal/' + campCal.id + '-' + d.date + '.ics', D)}" data-track="calendar">Add to calendar</a> `}<a href="${esc(gcalUrl(campCal, d))}" target="_blank" rel="noopener" data-track="calendar">${PREVIEW ? 'Add to Google Calendar' : 'Google Calendar'}</a></span>`).join('')}</dd>`);
  const plan = summerPlan.camps.find(x => x.c.id === c.id) || { on: [], exact: false };
  const old = c.season && c.season < year;
  // on a program's page the camp's own facts, which its own page keeps in the hero
  const facts = !inProgram ? '' : `<div class="facts kind-facts">
      ${c.name !== (programs.find(p => p.id === c.program) || {}).name ? `<span>${T(`Listed as`)} <b>${esc(c.name)}</b></span>` : ''}
      ${campAges(c) ? `<span><b>${esc(campAges(c))}</b></span>` : ''}
      ${campPrice(c) ? `<span><b>${esc(campPrice(c))}</b></span>` : ''}
      <span>${c.season ? (c.season >= year ? `Summer <b>${c.season}</b> details` : `<b>${c.season}</b> details, as a guide`) : 'No dates yet'}</span>
      <span>Checked <b>${longDate(c.checked)}</b></span>
      ${claimedMark('c:' + c.id, D)}
      ${spaceSlot('c:' + c.id, D)}
    </div>`;
  return `${facts}${old ? `<p class="flag camp-guide"><b>${T(`These are its summer {year} details, shown as a guide.`, { year: c.season })}</b> ${T(`It hasn’t posted summer {next} yet. This page changes when it does.`, { next: year })}${ALERTS ? ` <a href="#summer-email">${T(`Get an email when it does.`)}</a>` : ''}</p>` : ''}
    ${inProgram ? '' : photoSlot('c:' + c.id)}
    <article class="prog solo camp">
      <div class="strip camp-weeks">${plan.on.length ? `<p class="camp-weeks-h">${plan.exact ? T(`Weeks it runs in {year}`, { year }) : T(`Weeks it ran in {year}`, { year: c.season })}</p>
        <ol class="weekstrip">${summerPlan.weeks.map((w, i) => { const d = utcDay(w); return `<li class="${plan.on.includes(i) ? 'on' + (plan.exact ? ' exact' : '') : ''}"><span>${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}</span><b>${d.getUTCDate()}</b><i class="vh">${plan.on.includes(i) ? 'runs' : 'no camp'}</i></li>`; }).join('')}</ol>
        <p class="hint">${plan.exact ? T(`Each box is a week, named by its Monday.`) : T(`Each box is a week, named by its Monday in {year}: last summer’s weeks, moved to the same week of the calendar.`, { year })}</p>` : `<p class="hint">${T(`It hasn’t listed dates we can chart.`)}</p>`}</div>
      <dl>${rows.join('')}</dl>
      ${c.note ? `<p class="flag">${esc(c.note)}</p>` : ''}
      <div class="actions"><a class="btn primary needs-js" href="${link(summerPath, D)}?add=${esc(c.id)}">${T(`Add to your summer`)}</a><a class="btn" data-track="camp" href="${esc(outUrl(c.registerUrl || c.website, { type: 'camp' }))}" target="_blank" rel="noopener">${c.registerUrl ? T(`Find or book a spot`) : T(`The camp’s website`)}</a>${c.registerUrl ? `<a class="btn" data-track="website" href="${esc(outUrl(c.website, { type: 'camp' }))}" target="_blank" rel="noopener">${T(`The camp’s website`)}</a>` : ''}<a class="btn" href="${link(weeksPath, D)}">${T(`Which camps run each week`)}</a></div>
      ${ALERTS && GROUPS ? (old
        ? followBox(D, { id: 'summer-email', key: 'c:' + c.id, name: c.name, place: 'camp', fav: true, h: 'h3', title: T(`Tell me when it posts summer {year}`, { year }), lede: T(`One email when {camp} posts its {year} dates and prices, and one before sign-ups open if it names a day.`, { camp: c.name, year }), hint: T(`An email the morning after we see it, then reminders the day before and at about 8 on the morning sign-ups open. We read each camp’s site again about once a month, so the first one can come a few weeks after the camp’s own announcement. If a camp fills fast, watch its site too.`) })
        : followBox(D, { id: 'summer-email', key: 'c:' + c.id, name: c.name, place: 'camp', fav: true, h: 'h3', title: T(`Tell me when something changes`), lede: T(`One email before sign-ups open at {camp}, if it names a day, and one when its dates or prices change.`, { camp: c.name }), hint: T(`An email the morning after we see it, then reminders the day before and at about 8 on the morning sign-ups open. We read each camp’s site again about once a month, so the first one can come a few weeks after the camp’s own announcement. If a camp fills fast, watch its site too.`) })) : ''}
    </article>
    <p class="hint">${T(`Dates, prices and openings change, and many camps fill early. Confirm with the camp before you plan around a week.`)}</p>`;
}
// A camp with no school-year listing: a page of its own, the same shape as a program's, with just a Summer section.
function campPage(c) {
  const D = 2, year = summerYear;
  const areas = campAreas(c).length === CAMP_AREAS.length ? [] : campAreas(c);
  // the camps closest to this one, for someone still looking
  const here = coordsOf(c.address);
  const near = here.length ? summerCamps.filter(x => x.id !== c.id && coordsOf(x.address).length).map(x => [x, Math.min(...here.flatMap(a => coordsOf(x.address).map(b => milesApart(a, b))))]).sort((a, b) => a[1] - b[1]).slice(0, 4) : [];
  const hero = `    <p class="where"><a href="${link(campsPath, D)}">${T(`Summer camps`)}</a>${areas.length ? ` <span class="served">${areas.map(a => `<span class="pill nearby multi">${esc(a)}</span>`).join(' ')}</span>` : ''}</p>
    <h1>${esc(c.name)}</h1>
    <p class="lede">${esc(c.what)}</p>
    ${runsStrip(['summer'])}
    <div class="facts">
      <span>${c.types.map(t => esc(TYPE[t].label)).join(', ')}</span>
      ${campAges(c) ? `<span><b>${esc(campAges(c))}</b></span>` : ''}
      ${campPrice(c) ? `<span><b>${esc(campPrice(c))}</b></span>` : ''}
      <span>${c.season ? (c.season >= year ? `Summer <b>${c.season}</b> details` : `<b>${c.season}</b> details, as a guide`) : 'No dates yet'}</span>
      <span>Checked <b>${longDate(c.checked)}</b></span>
      ${claimedMark('c:' + c.id, D)}
      ${spaceSlot('c:' + c.id, D)}
    </div>`;
  const body = `<div data-camp-page="${esc(c.id)}" style="display:contents">
  ${pageNav(jumpNav())}
  ${kindSection('summer', summerBlock(c, D))}
  <section class="section">
    ${ALERTS && GROUPS ? '' : c.season && c.season < year
    ? alertsBox(D, { camp: c, place: 'camp', title: T(`Tell me when it posts summer {year}`, { year }), lede: T(`One email when {camp} posts its {year} dates and prices, and one before sign-ups open if it names a day. Just this camp.`, { camp: c.name, year }) })
    : alertsBox(D, { camp: c, place: 'camp', title: T(`Tell me when something changes`), lede: T(`One email before sign-ups open at {camp}, if it names a day, and one when its dates or prices change. Just this camp.`, { camp: c.name }) })}
    ${listingTools('c:' + c.id, c.name, D, 'camp')}
  </section>
  ${premiumSlot('c:' + c.id, c.name, D)}
  ${near.length ? `<section class="section" id="near" data-jump-to="Close by">
    <h2>${T(`Camps close to this one`)}</h2>
    <div class="schools">
${near.map(([x, m]) => `<a class="prow" href="${campLink(x, D)}"><h3>${esc(x.name)}</h3><span class="what">${esc(x.what)}</span><span class="tally"><span class="pill mi-pill">${m < 0.1 ? 'Next door' : (Math.round(m * 10) / 10).toFixed(1) + ' mi'}</span><span class="hint">${[campAges(x), campPrice(x)].filter(Boolean).map(esc).join(' · ')}</span></span></a>`).join('\n')}
    </div>
    <p><a class="btn" href="${link(campsPath, D)}">${T(`All summer camps`)}</a> <a class="btn" href="${link(summerPath, D)}">${T(`Plan your summer, week by week`)}</a></p>
  </section>` : `<section class="section"><p><a class="btn" href="${link(campsPath, D)}">${T(`All summer camps`)}</a> <a class="btn" href="${link(summerPath, D)}">${T(`Plan your summer, week by week`)}</a></p></section>`}
  <p class="src">Checked ${longDate(c.checked)}. Sources: ${sourceLinks(c.sources, c)}</p>
</div>`;
  const url = `${cfg.siteUrl}/${campPath(c)}`;
  const desc = [campAges(c), campWeeksShort(c), campHoursShort(c), campPrice(c)].filter(Boolean).join(', ');
  return layout({
    title: `${c.name}: summer camp in Philadelphia`,
    description: `${c.name}: ${c.what.replace(/\.$/, '')}. ${desc ? desc + '. ' : ''}Weeks, hours, cost and how to sign up.`,
    pathName: campPath(c), depth: D, current: null, hero, body, showStreet: 'summer',
    jsonLd: { '@context': 'https://schema.org', '@graph': [
      { '@type': c.address && coordsOf(c.address).length ? 'LocalBusiness' : 'Organization', '@id': url + '#camp', name: c.name, description: c.what, url: c.website, ...(coordsOf(c.address).length ? { address: `${streetAddresses(c.address)[0]}, Philadelphia, PA`, geo: { '@type': 'GeoCoordinates', latitude: coordsOf(c.address)[0][0], longitude: coordsOf(c.address)[0][1] } } : {}), ...(c.phone ? { telephone: '+1-' + c.phone } : {}) },
      { '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Summer camps', `${cfg.siteUrl}/${campsPath}`], [c.name, url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
    ] },
  });
}
// A camp tied to a program lives on the program's page. Its old address keeps a page that sends people on (the
// .htaccess 301 does it first, where it runs), so links in old emails and bookmarks still land.
function campMovedPage(c) {
  const prog = programs.find(p => p.id === c.program);
  const to = `${link(programPath(prog), 2)}#summer`;   // relative, so the page works wherever the site is served from
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.name)} | ${esc(cfg.siteName)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(`${cfg.siteUrl}/${programPath(prog)}#summer`)}">
<meta http-equiv="refresh" content="0; url=${esc(to)}">
<p>${esc(c.name)} is now on <a href="${esc(to)}">${esc(fullName(prog))}’s page</a>, under Summer.</p>
`;
}
function summerCampsPage() {
  const D = 1;
  const base = campsFile.season, next = base + 1;
  const list = [...summerCamps].sort((a, b) => a.name.localeCompare(b.name));
  const shapeCamp = c => ({ ...shapeFor('summer', c), neighborhoods: campAreas(c) });   // what the filter bar sees: parts of the city
  const shaped = list.map(shapeCamp);
  const ahead = list.filter(c => c.season > base).length;
  // On the list each camp is one row: what it is and the handful of facts people sort by. Its own page has the rest.
  const sc = typeSections('summer', list, D, shapeCamp);
  const todo = campsFile.todo || [];
  const hero = `    <p class="where"><a href="${link('all-programs/', D)}"><span aria-hidden="true">←</span> ${T(`Back to all programs`)}</a></p>
    <h1>${T(`Summer camps in Philadelphia`)}</h1>
    <p class="lede">${T(`Day camps inside the city, with the ages, weeks, hours and prices each camp posts on its own site.`)}</p>${heroGo(D, link(summerPath, D), T(`Plan your summer`), ` <a class="btn big" href="${link(weeksPath, D)}">${T(`Which camps run each week`)}</a>`)}
    <div class="facts">
      <span><b>${list.length}</b> camps</span>
      <span><b>${ahead}</b> already showing ${next}</span>
      <span>Checked <b>${longDate(campsFile.checked)}</b></span>
    </div>
    ${sc.pills}`;
  const body = `${pageNav(jumpNav())}
<section class="section">
  <p class="flag camp-guide"><b>${T(`Most of what’s here is from summer {year}, shown as a guide.`, { year: base })}</b> ${T(`Camps usually post next summer between December and March. Each listing changes to {year} when its camp posts dates and prices, and says so on its card.`, { year: next })}${ALERTS ? ' ' + T(`Waiting on one camp? Its page has a box to be emailed when it posts.`) : ''}</p>
</section>
${filterBar({ list: shaped, depth: D, show: { grade: false, age: true }, near: true, searchLabel: `Looking for a particular camp?`, placeholder: 'Its name, or try art, tennis, Mount Airy…' }).replace('data-filters', 'data-filters data-noun="camp" data-nouns="camps"')}
<p class="hint">${T(`Grades here are worked out from each camp’s ages, so check the ages on the camp’s page. Each camp has its own page with everything it posts.`)}</p>
${noMatch(D)}
${sc.sections}
${todo.length ? `<section class="section">
  <h2>${T(`Camps we haven’t been able to read yet`)}</h2>
  <p>${T(`These run day camps in the city too. Their details go up once we’ve read them on the camp’s own site.`)}</p>
  <ul class="plain cols">${todo.map(t => `<li>${esc(t.name)}</li>`).join('')}</ul>
</section>` : ''}
<section class="section">
  <h2 id="suggest-camp">${T(`Suggest a camp`)}</h2>
  <p>${T(`Know a city day camp that isn’t here? Send its name and its website, and we’ll read it and add it.`)}</p>
  <p><a class="btn primary" href="${link('suggest/', D)}?kind=camp">${T(`Suggest a camp`)}</a>${GROUPS ? ` <a class="btn" href="${link('managers/', D)}">${T(`I run a camp`)}</a>` : ''}</p>
  <p class="hint">${T(`Listings come from each camp’s public pages and are not endorsements. Dates, prices and openings change, so confirm with the camp before you plan around it.`)}</p>
</section>`;
  return layout({
    title: 'Summer day camps in Philadelphia: ages, weeks, hours and prices',
    description: `${list.length} summer day camps inside Philadelphia in one list: ages, weeks, hours, cost, before and after care, and when sign-ups open. Filter by type, grade and part of the city.`,
    pathName: campsPath, depth: D, current: null, hero, body, showStreet: 'summer',
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, url: `${cfg.siteUrl}/${campPath(c)}` })) },
  });
}

// ---------- weekend classes: any listing with a "weekend" block ----------
const weekendPrograms = programs.filter(p => p.weekend).sort((a, b) => a.name.localeCompare(b.name));
const WEEKEND_DAY = { sat: 'Saturday', sun: 'Sunday' };
// A weekend class has no school and no pickup, so where it is decides who it suits: the page groups and filters by
// part of the city (the same areas the summer camps use) and each card names its neighborhood.
const weekendAreas = p => campAreas({ neighborhoods: programHoods(p) });
const weekendByArea = () => [...CAMP_AREAS.map(a => a[0]), 'Elsewhere in the city'].map(a => [a, weekendPrograms.filter(p => weekendAreas(p)[0] === a)]).filter(([, l]) => l.length);
const weekendRow = (p, depth) => `<a class="prow" href="${link(weekendPath, depth)}#${esc(p.id)}">
  <h3>${esc(p.name)}</h3>
  <span class="what">${esc(p.weekend.summary)}</span>
  <span class="tally">${p.weekend.days.map(d => `<span class="pill nearby">${WEEKEND_DAY[d]}</span>`).join('')}${programHoods(p).map(n => `<span class="pill hood">${esc(n)}</span>`).join('')}<span class="hint">Grades ${esc(gradeText(p.weekend._grades !== undefined ? { ...p, _grades: p.weekend._grades } : p))}</span></span>
</a>`;
function weekendPage() {
  const D = 1;
  const shape = p => ({ ...shapeFor('weekend', p), neighborhoods: weekendAreas(p) });   // what the filter bar sees: parts of the city, not neighborhoods
  const wk = typeSections('weekend', weekendPrograms, D, shape);
  const hero = `    <p class="where"><a href="${link('all-programs/', D)}"><span aria-hidden="true">←</span> ${T(`Back to all programs`)}</a></p>
    <h1>${T(`Saturday and Sunday classes`)}</h1>
    <p class="lede">${T(`Weekend classes for kids across the city: what runs, on which day, and where. Open one for its term, times and cost.`)}</p>${heroGo(D, link('board/', D), T(`Plan your week`))}
    <div class="facts">
      <span><b>${weekendPrograms.length}</b> places with weekend classes</span>
      <span><b>${weekendPrograms.filter(p => p.weekend.days.includes('sun')).length}</b> on Sundays too</span>
      <span><b>${new Set(weekendPrograms.flatMap(programHoods)).size}</b> neighborhoods</span>
    </div>
    ${wk.pills}`;
  const body = `${pageNav(jumpNav())}
${filterBar({ list: weekendPrograms.map(shape), depth: D, show: { grade: false, age: true, cost: false, day: false }, near: true, searchLabel: `Looking for a particular class?`, placeholder: 'A name or a neighborhood, or try piano, acting…' }).replace('data-filters', 'data-filters data-noschool')}
<p class="hint">${T(`A weekend class has no school pickup, so this list goes by where the class is. Any child can sign up, whichever school they go to.`)}</p>
${noMatch(D)}
${wk.sections}
<section class="section">
  <p>${T(`This covers the programs already on this site, plus weekend-only places from a first sweep of the city. It isn’t every class in Philadelphia, and some listed programs run weekend classes that their sites don’t spell out by day, so ask.`)} ${T(`Know a weekend class that should be here?`)} <a href="${link('suggest/', D)}">${T(`Tell us.`)}</a></p>
  <p class="hint">${T(`Weekend terms start and fill on their own dates, so check with the provider before you count on a class.`)}</p>
</section>`;
  return layout({
    title: 'Weekend classes for kids in Philadelphia, by neighborhood',
    description: `Saturday and Sunday classes for kids at ${weekendPrograms.length} places in Philadelphia: music, theater, art, dance, skating, soccer and science, with the day, the neighborhood, and each one’s term, times and cost.`,
    pathName: weekendPath, depth: D, current: null, hero, body, showStreet: 'weekend',
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: weekendPrograms.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: fullName(p), url: `${cfg.siteUrl}/${programPath(p)}` })) },
  });
}

// ---------- all programs: one page that sorts everything listed by the kind of program it is ----------
// A way in, not a ranking: four blocks in the order of a family's calendar (weekday afternoons, weekends, days off,
// summer), each with a count worked out at build time and a link to its own list. No listing is named or shown ahead
// of another here.
const allPath = 'all-programs/';
function allProgramsPage() {
  const D = 1;
  const ICON = {
    bell: 'M12 2a2 2 0 0 0-2 2v.4A6 6 0 0 0 6 10v5l-2 2v1h16v-1l-2-2v-5a6 6 0 0 0-4-5.6V4a2 2 0 0 0-2-2zm-2.2 18a2.300 2.300 0 0 0 4.400 0z',
    star: 'm12 2 3.100 6.300 6.900 1-5 4.900 1.200 6.800-6.200-3.200L5.800 21 7 14.200 2 9.300l6.900-1z',
    tent: 'M12 3 1.5 20h21zm0 7 2.6 8H9.4z',
    sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v4h-2zm0 18h2v4h-2zM1 11h4v2H1zm18 0h4v2h-4zM4.2 5.6l1.4-1.4 2.8 2.800L7 8.400zm11.400 11.400 1.400-1.400 2.800 2.800-1.400 1.400zM4.200 18.400 7 15.600l1.400 1.400-2.800 2.800zM15.600 7l2.800-2.800 1.400 1.400L17 8.400z',
  };
  const icon = k => `<span class="plan-ic" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="${ICON[k]}"/></svg></span>`;
  const card = ({ k, id, color, n, noun, name, text, points, go }) => `<article class="plan-card kind-card" id="${id}" data-kind="${id}" data-n="${n}" style="--tc:${color}">
      <div class="plan-head">${icon(k)}<div><p class="kicker"><b class="kind-n">${n}</b> ${noun}</p><h2>${name}</h2></div></div>
      <p>${text}</p>
      <ul class="plan-points">${points.filter(Boolean).map(x => `<li>${x}</li>`).join('')}</ul>
      <p class="plan-go kind-go">${go.filter(Boolean).map(([href, label], i) => `<a class="btn${i ? '' : ' primary'}" href="${href}">${label}</a>`).join('')}</p>
    </article>`;
  const sat = weekendPrograms.filter(p => p.weekend.days.includes('sat')).length, sun = weekendPrograms.filter(p => p.weekend.days.includes('sun')).length;
  const daysLeft = offDays.reduce((n, d) => n + d.dates.filter(x => x >= TODAY).length, 0);
  const nextDay = offDays.flatMap(d => d.dates.filter(x => x >= TODAY).map(x => ({ x, name: d.name }))).sort((a, b) => a.x.localeCompare(b.x))[0];
  const weeks = summerCamps.length ? summerPlan.weeks.length : 0;
  const kinds = [
    { k: 'bell', id: 'after-school', color: '#1763B8', n: citywide.length, noun: T(`programs`), name: T(`After-school programs`), ld: 'programs/',
      text: T(`Weekday afternoons once the bell rings: aftercare, music, art, sports, chess and more.`),
      points: [T(`See what’s at your child’s school, what picks up from it and what’s nearby`), T(`Narrow the list by type, grade, neighborhood or day of the week`), T(`Hours, cost, pickup and how to register, from each program’s own website`)],
      go: [[link('programs/', D), T(`See all {n}, A to Z`, { n: citywide.length })], [link('schools/', D), T(`Start from your school`)], [link('board/', D), T(`Build your week`)]] },
    weekendPrograms.length ? { k: 'star', id: 'weekends', color: '#6B3FA0', n: weekendPrograms.length, noun: T(`places`), name: T(`Weekend classes`), ld: weekendPath,
      text: T(`Saturday and Sunday classes: music, dance, art, skating, science. There’s no school pickup, so any child can sign up.`),
      points: [T(`{sat} run on Saturdays, {sun} on Sundays`, { sat, sun }), T(`The term, the times and the cost of each`), T(`Sorted by part of the city, so you can start close to home`)],
      go: [[link(weekendPath, D), T(`See weekend classes`)]] } : null,
    daysOff ? { k: 'tent', id: 'day-camps', color: '#B88A00', n: campPrograms.length, noun: T(`programs`), name: T(`Day-camp programs`), ld: dayCampsPath,
      text: T(`Camps on the days district schools are closed: holidays, staff days, winter and spring break.`),
      points: [daysLeft ? T(`{n} days off still to come this school year`, { n: daysLeft }) : '', nextDay ? T(`Next one: {name}, {date}`, { name: esc(nextDay.name), date: longDate(nextDay.x) }) : '', T(`See who’s open on each day, break by break`)],
      go: [[link(dayCampsPath, D), T(`See day-camp programs`)], [link(offPath, D), T(`Plan the days off`)]] } : null,
    summerCamps.length ? { k: 'sun', id: 'summer-camps', color: '#2C8444', n: summerCamps.length, noun: T(`camps`), name: T(`Summer camps`), ld: campsPath,
      text: T(`Day camps inside the city for the {n} weeks between the last day of school and Labor Day.`, { n: weeks }),
      points: [T(`Ages, weeks, hours and prices, from each camp’s own website`), T(`One chart of which camps run in each week`), T(`Camps usually post next summer between December and March`)],
      go: [[link(campsPath, D), T(`See summer camps`)], [link(summerPath, D), T(`Plan your summer`)]] } : null,
  ].filter(Boolean);
  const hero = `    <h1>${T(`All programs`)}</h1>
    <p class="lede">${T(`Everything listed on this site, sorted by the kind of program it is. Pick the part of the year you’re filling, then narrow it down from there.`)}</p>
    <div class="facts">
      ${kinds.map(x => `<a href="#${x.id}"><span><b>${x.n}</b> ${x.id === 'after-school' ? 'after school' : x.id === 'weekends' ? 'on weekends' : x.id === 'day-camps' ? 'with day camps' : 'summer camps'}</span></a>`).join('\n      ')}
    </div>`;
  const body = `<section class="section" id="kinds">
  <div class="plans">
    ${kinds.map(card).join('\n    ')}
  </div>
  <p class="hint">${T(`A place can be in more than one group: one that runs weekday afternoons, Saturday classes and camps on days off is counted in each.`)}</p>
</section>
<section class="section" id="types">
  <h2>${T(`After-school programs, by what they do`)}</h2>
  <div class="chips-row big">${typeChips(D)}</div>
</section>
<section class="section" id="ways">
  <h2>${T(`Or narrow it another way`)}</h2>
  <div class="ways">
    <div class="way">
      <h3>${T(`By school`)}</h3>
      <p>${T(`What’s at your child’s school, what picks up from it and what’s nearby. Clubs a school runs for its own students are on that school’s page.`)}</p>
      <div class="chips-row">${schools.slice(0, 6).map(s => `<a class="btn" href="${link(s.id + '/', D)}">${esc(s.shortName)}</a>`).join('')}<a class="btn quiet" href="${link('schools/', D)}">${T(`Find your school`)}</a></div>
    </div>
    <div class="way">
      <h3>${T(`By neighborhood`)}</h3>
      <p>${T(`What’s based near home, and who comes to pick up.`)}</p>
      <div class="chips-row">${hoods.slice(0, 6).map(h => `<a class="btn" href="${link(hoodPath(h), D)}">${esc(h.name)}</a>`).join('')}<a class="btn quiet" href="${link('neighborhoods/', D)}">${T(`All neighborhoods`)}</a></div>
    </div>
    <div class="way">
      <h3>${T(`By grade`)}</h3>
      <p>${T(`Everything that takes your child’s grade.`)}</p>
      <div class="grade-links">${GRADES.map(g => `<a class="gbtn" href="${link('programs/', D)}?grade=${g}" aria-label="${g === 'PK' ? 'Pre-K' : g === 'K' ? 'Kindergarten' : 'Grade ' + g}"><span class="g">${g}</span></a>`).join('')}</div>
    </div>
  </div>
</section>
<section class="notes">
  <h2>${T(`About these lists`)}</h2>
  <ul>
    <li>${T(`Every list is free to look through, and none of them needs an account.`)}</li>
    <li>${T(`Days, hours and prices come from each program’s own website. Check with the program before you count on a spot.`)}</li>
    <li>${T(`Know one that’s missing?`)} <a href="${link('suggest/', D)}">${T(`Suggest a program`)}</a> ${T(`or`)} <a href="${link('suggest/', D)}?kind=camp">${T(`suggest a camp`)}</a>.</li>
  </ul>
</section>`;
  return layout({
    title: 'All programs: after school, weekends, day camps, summer',
    description: `Every kind of kids’ program on ${cfg.siteName}: ${citywide.length} after-school programs${weekendPrograms.length ? `, weekend classes at ${weekendPrograms.length} places` : ''}${daysOff ? `, ${campPrograms.length} with day camps` : ''}${summerCamps.length ? ` and ${summerCamps.length} summer camps` : ''}.`,
    pathName: allPath, depth: D, current: null, hero, body, showStreet: 'parked',
    jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'All programs', url: `${cfg.siteUrl}/${allPath}`, mainEntity: { '@type': 'ItemList', itemListElement: kinds.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: `${cfg.siteUrl}/${x.ld}` })) } },
  });
}

function notFoundPage() {
  const hero = `    <h1>${T(`This jawn isn’t here`)}</h1>
    <p class="lede">${T(`The link may be old, or the page moved.`)} <a href="/">${T(`Start from the list of schools.`)}</a></p>`;
  return layout({ title: 'Page not found', description: 'Page not found.', pathName: '404.html', depth: -1, current: null, hero, body: '', showStreet: 'parked', noindex: true });
}

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
const write = (rel, content) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, /\.(html|php)$/.test(rel) && typeof content === 'string' ? dropEmpty(content) : content); };
write('index.html', homePage());
for (const s of schools) write(`${s.id}/index.html`, schoolPage(s));
write('schools/index.html', schoolsPage());
write('schools/request/index.html', schoolRequestPage());
if (SCHOOL_PAGES) for (const x of uncovered) write(uncoveredPath(x) + 'index.html', uncoveredSchoolPage(x));
write('types/index.html', typesPage());
write(byDayPath + 'index.html', byDayPage());
for (const t of liveTypes()) write(`types/${t.id}/index.html`, typePage(t));
write('programs/index.html', programsPage());
for (const p of programs) write(`${programPath(p)}index.html`, programPage(p));
for (const p of testListings) write(`${programPath(p)}index.html`, programPage(p));   // hidden: its own page and nothing else
write('neighborhoods/index.html', neighborhoodsPage());
for (const h of hoods) write(`${hoodPath(h)}index.html`, neighborhoodPage(h));
write('support/index.html', supportPage());
write('privacy/index.html', privacyPage());
if (TERMS) write('terms/index.html', termsPage());
write('about/index.html', aboutPage());
write('suggest/index.html', suggestPage());
write('suggest/thanks/index.html', thanksPage());
write('ideas/index.html', ideasPage());
write('ideas/thanks/index.html', ideasThanksPage());
write('contact/index.html', contactPage());
write('contact/thanks/index.html', contactThanksPage());
write('board/index.html', boardPage());
write(schedulesPath + 'index.html', schedulesPage());
write(allPath + 'index.html', allProgramsPage());
if (daysOff) { write(offPath + 'index.html', daysOffPage()); write(dayCampsPath + 'index.html', dayCampsPage()); }
if (daysOff) for (const d of offDays) write(dayPath(d) + 'index.html', dayOffPage(d));
if (summerCamps.length) write(campsPath + 'index.html', summerCampsPage());
for (const c of summerCamps) write(campPath(c) + 'index.html', c.program ? campMovedPage(c) : campPage(c));
if (summerCamps.length) { write(summerPath + 'index.html', summerSchedulePage()); write(weeksPath + 'index.html', summerWeeksPage()); }
if (YEAR_PAGE) write(yearPath + 'index.html', calendarPage());
if (YEAR_PAGE) write('to-do/index.html', todoPage());
if (weekendPrograms.length) write(weekendPath + 'index.html', weekendPage());
if (ALERTS) write(alertsPath + 'index.html', alertsPage());
if (ALERTS && GROUPS) write(alertsPath + 'stop/index.html', stopPage());
write('review/index.html', reviewPage());
write('review/thanks/index.html', reviewThanksPage());
if (GATED) write('edit/index.php', editIndexPhp()); else write('edit/index.html', editPage());
if (GATED && GROUPS) write('edit/stats/index.php', editStatsPhp());
if (GATED && GROUPS) write('edit/claims/index.php', editClaimsPhp());
if (GATED) write('edit/queue/index.php', editQueuePhp());
const notFound = notFoundPage();   // always rendered, so its copy is known to the editor
write('assets/site.css', fs.readFileSync(path.join(ROOT, 'src/site.css')));
write('assets/site.js', fs.readFileSync(path.join(ROOT, 'src/site.js')));
write('assets/edit.js', fs.readFileSync(path.join(ROOT, 'src/edit.js')));
// Notifications without an app: a service worker at the top of the site (it shows a notification and opens a page,
// nothing else), and the short description a phone needs before the site can sit on its Home Screen, which is what
// an iPhone asks for before it will deliver them.
if (GROUPS && !PREVIEW) {
  write('sw.js', fs.readFileSync(path.join(ROOT, 'src/sw.js')));
  write('manifest.json', JSON.stringify({ name: cfg.siteName, short_name: cfg.siteName.length > 12 ? cfg.siteName.replace(/^Philly /, '') : cfg.siteName, description: 'After-school programs in Philadelphia, sorted by the school your child goes to.',
    start_url: '/?utm_source=homescreen&utm_medium=app', scope: '/', display: 'standalone', background_color: '#96C9FF', theme_color: '#96C9FF',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2) + '\n');
}
if (GROUPS && GROUPS.premium !== 'off') write('assets/qr.js', fs.readFileSync(path.join(ROOT, 'src/qr.js')));   // draws the code on a premium listing's flyer; loaded only when one is asked for
if (GROUPS) {
  write('assets/groups.js', fs.readFileSync(path.join(ROOT, 'src/groups.js')));
  write('account/index.html', accountPage());
  write('register/index.html', accountPage(true));
  write('profile/index.html', profilePage());
  write('groups/index.html', groupPage());
  write('join/index.html', joinPage());
  write('managers/index.html', directorsPage());
  if (PM_PRICE && !PREVIEW) write('premium/index.html', premiumPage());
  write('directors/index.html', movedPage('managers/', 1));   // the page's first address
  if (!PREVIEW) write('groups/api.php', groupsApiPhp());
  else phpCopy(fs.readFileSync(path.join(ROOT, 'src/server/groups-api.php'), 'utf8'));   // the preview still lists the emails
  if (GATED) write('edit/emails/index.php', editEmailsPhp()); else write('edit/emails/index.html', editEmailsPage());
}
for (const f of fs.readdirSync(path.join(ROOT, 'src/static'))) write(f, fs.readFileSync(path.join(ROOT, 'src/static', f)));
// pictures the welcome emails (email/welcome/, sent from the email list) load from the site
if (fs.existsSync(path.join(ROOT, 'email/img'))) for (const f of fs.readdirSync(path.join(ROOT, 'email/img'))) if (/\.(png|jpg)$/.test(f)) write('email/img/' + f, fs.readFileSync(path.join(ROOT, 'email/img', f)));
if (!PREVIEW) for (const f of fs.readdirSync(path.join(ROOT, 'src/vendor/leaflet'))) write('assets/leaflet/' + f, fs.readFileSync(path.join(ROOT, 'src/vendor/leaflet', f)));   // the map library, served from this site so no other one is asked for it   // icons and the share image, served from the top level
if (!PREVIEW) {
  write('404.html', notFound);
  if (cfg.contactEmail) write('suggest/send.php', sendPhp());
  if (cfg.contactEmail) write('contact/send.php', contactPhp());
  if (cfg.contactEmail) write('review/send.php', reviewPhp());
  if (cfg.contactEmail) write('schools/request/send.php', schoolRequestPhp());
  write('data/school-finder.json', JSON.stringify(finderData));
  if (cfg.contactEmail) write('edit/send.php', editPhp());   // after every page, so it knows every sentence
  for (const p of programs) for (const d of upcomingDates(p)) write(`cal/${p.id}-${d.date}.ics`, icsFile(p, d));
  for (const c of summerCamps) for (const d of (c.dates || []).filter(x => x.date >= TODAY)) write(`cal/camp-${c.id}-${d.date}.ics`, icsFile(campAsListing(c), d));
  write('data/reviews.json', JSON.stringify(reviews, null, 2));
  // Public copy of the data, so the monthly check (or anyone) can read exactly what the site shows.
  write('data/programs.json', JSON.stringify(programs.map(({ _grades, _cls, ...p }) => { if (p.weekend) { const { _grades: wg, ...w } = p.weekend; p = { ...p, weekend: w }; } return p.clubs ? { ...p, clubs: p.clubs.map(({ _grades: g, ...c }) => c) } : p; }), null, 2));
  write('data/schools.json', JSON.stringify(schools, null, 2));
  if (campsFile) write('data/camps.json', JSON.stringify({ ...campsFile, camps: summerCamps.map(({ _grades, schools: _s, ...c }) => c) }, null, 2));
  const check = checkList();
  write('data/check.json', JSON.stringify(check, null, 2));   // the monthly check's worklist
  const loose = check.links.filter(r => r.basis === 'none'), off = check.links.filter(r => r.notOnProviderList && r.basis !== 'none');
  if (loose.length) console.log(`Note: ${loose.length} pickup link(s) rest on no stored list and no source of their own: ${loose.map(r => `${r.program} → ${r.school}`).join(', ')}.`);
  if (off.length) console.log(`Note: ${off.length} pickup link(s) are not on the provider's own list as last read: ${off.map(r => `${r.program} → ${r.school}`).join(', ')}.`);
  const stale = check.told.filter(t => t.stale);
  if (stale.length) console.log(`Note: ${stale.length} thing(s) a program told us are more than ${TOLD_DAYS} days old: ${stale.map(t => `${t.program} (${t.fields.join(', ')}, ${t.on})`).join('; ')}. The morning job asks the listing's managers to confirm; a listing nobody has claimed needs the owner to ask.`);
  write('data/alerts.json', JSON.stringify(alertsFeed(), null, 2));   // read by scripts/send-alerts.mjs once a day
  // The sitemap. Each page's date is the newest date in the data it is built from (a listing's last check, a school's
  // review, the calendar's check), not the day of the build: a date that moves every night teaches a search engine
  // to ignore it. Pages whose words live in this file, with no date of their own, carry none.
  const newest = (...xs) => xs.flat(Infinity).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x || '')).sort().pop() || '';
  const progDate = p => newest(p.lastVerified, Object.values(p.schools).map(l => l.checked), p.weekend?.checked, reviewsFor(p.id).map(r => r.date));
  const listDate = list => newest(list.map(progDate));
  const schoolDate = s => newest(s.lastReviewed, s.added, listDate(forSchool(s)));
  const campsDate = newest(summerCamps.map(c => c.checked));
  const offDate = d => newest(daysOff?.checked, listDate(d ? campsOn(d) : campPrograms));
  const everything = newest(listDate(programs), schools.map(schoolDate), campsDate, daysOff?.checked, NEWS.map(n => n.date));
  const nearDate = x => { const n = nearbyFor(x); return newest(listDate([...n.after, ...n.weekend].map(y => y[0])), n.camps.map(y => y[0].checked)); };
  const urls = [['', everything], ['schools/', newest(schools.map(schoolDate))], ...schools.map(s => [s.id + '/', schoolDate(s)]),
    ['types/', listDate(programs)], ...liveTypes().map(t => [`types/${t.id}/`, listDate(programs.filter(p => p.types.includes(t.id)))]), [byDayPath, listDate(programs)],
    ['all-programs/', everything], ['programs/', listDate(citywide)], ...programs.map(p => [programPath(p), progDate(p)]),
    ['neighborhoods/', listDate(programs)], ...hoods.map(h => [hoodPath(h), newest(listDate(h.programs), h.schools.map(schoolDate))]),
    ...(daysOff ? [[dayCampsPath, offDate()], [offPath, offDate()], ...offDays.filter(d => campsOn(d).length).map(d => [dayPath(d), offDate(d)])] : []),
    ...(summerCamps.length ? [[campsPath, campsDate], [weeksPath, campsDate], [summerPath, campsDate], ...summerCamps.filter(c => !c.program).map(c => [campPath(c), c.checked])] : []),
    ...(SCHOOL_PAGES ? uncoveredIndexed().map(x => [uncoveredPath(x), nearDate(x)]) : []),
    ...(weekendPrograms.length ? [[weekendPath, listDate(weekendPrograms)]] : []),
    ['privacy/', newest(cfg.privacyUpdated)],
    ...[...(ALERTS ? [alertsPath] : []), schedulesPath, 'board/', 'suggest/', ...(GROUPS ? ['managers/'] : []), ...(PM_LISTED ? ['premium/'] : []), 'ideas/', 'review/', 'about/', 'contact/', ...(cfg.termsLive === true ? ['terms/'] : []), 'support/'].map(u => [u, ''])];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `  <url><loc>${cfg.siteUrl}/${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`);
  // IndexNow: the key file a search engine reads to check that a "these pages changed" note really came from this site.
  if (/^[a-f0-9]{32}$/.test(cfg.indexNowKey || '')) write(`${cfg.indexNowKey}.txt`, cfg.indexNowKey);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
  const bare = cfg.siteUrl.replace(/^https?:\/\//, '');
  // Other addresses that should land on this one (see "Changing the site's address" in the README).
  const formerHosts = (cfg.formerHosts || []).filter(h => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) && h !== bare && h !== 'www.' + bare);
  const goneDays = (daysOff?.days || []).filter(d => (d.end || d.date) < TODAY).map(daySlug);
  write('.htaccess', `ErrorDocument 404 /404.html\nAddType text/calendar .ics\nDirectoryIndex index.html index.php\n\n# One address for the site: www goes to the bare domain.\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteCond %{HTTP_HOST} ^www\\.${bare.replace(/\./g, '\\.')}$ [NC]\nRewriteRule ^ https://${bare}%{REQUEST_URI} [R=301,L]\n${formerHosts.length ? `# The site's other addresses all lead here, page for page (the certificate check on each is left alone).\nRewriteCond %{HTTP_HOST} ^(www\\.)?(${formerHosts.map(h => h.replace(/\./g, '\\.')).join('|')})$ [NC]\nRewriteCond %{REQUEST_URI} !^/\\.well-known/\nRewriteRule ^ https://${bare}%{REQUEST_URI} [R=301,L]\n` : ''}${cardQr ? `# The short addresses in the QR codes on the week card and the day-camp card.\nRewriteRule ^w/?$ ${cardQr.goesTo} [NC,R=302,L]\n${cardQr.dayoff ? `RewriteRule ^d/?$ ${cardQr.dayoff.goesTo} [NC,R=302,L]\n` : ''}` : ''}${movedSchools.length ? `# A school that has been added: its old "not covered yet" address goes to its page.\n${movedSchools.map(([from, to]) => `RewriteRule ^schools/${from}/?$ /${to}/ [R=301,L]\n`).join('')}` : ''}${goneDays.length ? `# A day off that has passed: its own page leads to the list of days still to come.\n${goneDays.map(x => `RewriteRule ^${offPath}${x}/?$ /${offPath} [R=301,L]\n`).join('')}` : ''}${summerCamps.some(c => c.program) ? `# A summer camp tied to a program is on the program's page, under Summer (a query string, such as an email's tags, stays ahead of the #).\n${summerCamps.filter(c => c.program).map(c => { const to = '/' + programPath(programs.find(p => p.id === c.program)); return `RewriteCond %{QUERY_STRING} ^(.+)$\nRewriteRule ^${campsPath}${c.id}/?$ ${to}?%1#summer [NE,QSD,R=301,L]\nRewriteRule ^${campsPath}${c.id}/?$ ${to}#summer [NE,R=301,L]\n`; }).join('')}` : ''}</IfModule>\n`);
}
// Edits in data/copy.json are matched to sentences by a fingerprint of the original wording.
// If the original was reworded or removed in this file, the edit no longer applies: say so, but still build.
const stale = Object.entries(copyEdits).filter(([id]) => !copyRegistry.has(id));
if (stale.length) console.warn(`\nNote: ${stale.length} edit(s) in data/copy.json no longer match any sentence on the site, so they were skipped:\n` + stale.map(([id, e]) => `- ${id}: was "${e.was || '?'}" / now "${e.now}"`).join('\n') + '\n');
const noHood = programs.filter(p => !programHoods(p).length);
if (noHood.length) console.warn(`\nNote: no neighborhood for ${noHood.map(p => p.id).join(', ')}. Add "neighborhoods" in data/programs.json so they show on a neighborhood page.\n`);
console.log(`Built ${schools.length} school page(s), ${hoods.length} neighborhood page(s), ${programs.length} program page(s) and ${copyRegistry.size} editable sentences into ${path.relative(ROOT, OUT)}/`);
