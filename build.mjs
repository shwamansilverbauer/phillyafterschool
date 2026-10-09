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
const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_NAME = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };
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
function T(original, vars) {
  const id = copyId(original);
  copyRegistry.set(id, original);
  const now = typeof copyEdits[id]?.now === 'string' ? copyEdits[id].now : original;
  const shown = vars ? now.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : now;
  return `<span data-copy="${id}"${vars ? ` data-tpl="${esc(now)}" data-vars="${esc(JSON.stringify(vars))}"` : ''}>${esc(shown)}</span>`;
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
  if (!e || typeof e.now !== 'string' || !e.now.trim()) errors.push(`data/copy.json: entry "${id}" needs a "now" with the new wording`);
}
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

function layout({ title, description, pathName, depth, current, hero, body, scripts = '', fragment = false, showStreet = false, noindex = false, jsonLd = null, roomy = false, first = '', theme = '', shareImage = null, quiet = false }) {
  const canonical = cfg.siteUrl + '/' + pathName;
  // Search results show roughly 60 characters of a title and 155 of a description. The site name is added
  // to a title only when it fits; a long description is cut at a word.
  const fullTitle = pathName === '' ? (PREVIEW ? cfg.siteName : `${cfg.siteName}: ${cfg.tagline}`) : `${title} | ${cfg.siteName}`.length <= 65 ? `${title} | ${cfg.siteName}` : title;
  if (description.length > 158) description = description.slice(0, 157).replace(/\s+\S*$/, '').replace(/[,;:.]$/, '') + '…';
  // The menu: four groups that open, then About and the support button. Each group is a <details>, so it works without scripts.
  const navHref = to => { const p = to.split(/[#?]/)[0]; return link(p, depth) + to.slice(p.length); };   // a link may carry ?kind= or #part
  const menus = [
    ['Programs', [['programs/', 'After-school programs'], ...(programs.some(p => p.weekend) ? [['weekends/', 'Weekend classes']] : []), ...(daysOff ? [[offPath, 'Day-camp programs']] : []), ...(summerCamps.length ? [['summer-camps/', 'Summer camps']] : [])]],
    ['Search by', [['schools/', 'School'], ['neighborhoods/', 'Neighborhood'], ['types/', 'Program type'], ['programs/#by-day', 'Day of week']]],
    ['Build a schedule', [['schedules/', 'All the planners'], ['board/', 'After-school schedule'], ...(daysOff ? [[offPath + '#plan', 'Day-camp schedule']] : []), ...(summerCamps.length ? [['summer-schedule/', 'Summer schedule']] : []), ...(GROUPS && daysOff ? [['calendar/', 'My kids’ calendar']] : [])]],
    ['Suggest', [['suggest/', 'A program'], ['suggest/?kind=camp', 'A camp'], ['suggest/?kind=correction', 'An update to a listing'], ['ideas/', 'A feature'], ['schools/request/', 'A school']]],
  ];
  const nav = menus.map(([label, items]) => {
    const here = items.some(([to]) => !to.includes('#') && pathName.startsWith(to));
    return `<details class="menu${here ? ' here' : ''}"><summary>${label}${label === 'Build a schedule' ? '<span class="count" data-board-count hidden></span>' : ''}</summary><ul>${items.map(([to, text]) => `<li><a href="${navHref(to)}"${to === pathName ? ' aria-current="page"' : ''}>${text}</a></li>`).join('')}</ul></details>`;
  }).join('') + `<a href="${link('about/', depth)}"${current === 'about/' ? ' aria-current="page"' : ''}>About</a>${GROUPS
    ? `<a class="nav-cta when-out" href="${link('register/', depth)}">Create a free account</a><a class="nav-cta when-in" href="${link('profile/', depth)}"${NEWS.length ? ` data-news="${NEWS[0].date}"` : ''}>My profile<span class="news-dot" hidden><span class="vh"> (something new)</span></span></a>`
    : `<a class="nav-cta" href="${link('support/', depth)}"${current === 'support/' ? ' aria-current="page"' : ''}>Help the site keep going</a>`}`;
  const head = `${first}${fragment || quiet ? '' : roleHead + gtmHead + '\n'}<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">${noindex ? '\n<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
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
<link rel="apple-touch-icon" href="${link('apple-touch-icon.png', depth)}">
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
    <span class="top-login"><span class="top-wide">Already have an account?</span> <a href="${link('account/', depth)}">Log in</a></span>
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
      ${cfg.supportUrl ? `<p class="foot-support"><span>${T(`Free, and run by one parent.`)}</span> <a class="btn foot-cta" href="${link('support/', depth)}">Help the site keep going</a></p>` : ''}
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
      <h2><a href="${link('programs/', depth)}">${T(`Programs`)}</a></h2>
      <ul>
        <li><a href="${link('programs/', depth)}">${T(`All programs, A to Z`)}</a></li>
        <li><a href="${link('types/', depth)}">${T(`Programs by type`)}</a></li>
        <li><a href="${link('neighborhoods/', depth)}">${T(`Programs by neighborhood`)}</a></li>
        ${programs.some(p => p.weekend) ? `<li><a href="${link('weekends/', depth)}">${T(`Weekend classes`)}</a></li>` : ''}
        ${daysOff ? `<li><a href="${link(offPath, depth)}">${T(`Day-camp programs`)}</a></li>` : ''}
        ${summerCamps.length ? `<li><a href="${link('summer-camps/', depth)}">${T(`Summer camps`)}</a></li>` : ''}
        <li><a href="${link('suggest/', depth)}">${T(`Suggest a program`)}</a></li>
        <li><a href="${link('review/', depth)}">${T(`Write a review`)}</a></li>
      </ul>
    </div>
    <div>
      <h2><a href="${link('schedules/', depth)}">${T(`Your family`)}</a></h2>
      <ul>
        <li><a href="${link('board/', depth)}">${T(`After-school schedule`)}</a></li>
        ${daysOff ? `<li><a href="${link(offPath, depth)}#plan">${T(`Day-camp schedule`)}</a></li>` : ''}
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
        <li><a href="${link('support/', depth)}">${T(`Buy me a coffee`)}</a></li>
      </ul>
    </div>
  </nav>
  <div class="foot-fine">
    <p>${T(`Listings come from each provider’s public pages and are not endorsements. Prices, hours and pickup routes change, so confirm with the provider before you enroll.`)}</p>
    <p>${T(`{site} is an independent community project. It is not affiliated with the School District of Philadelphia or any provider listed.`, { site: cfg.siteName })}</p>
    ${cfg.contactEmail ? `<p>${T(`Questions?`)} <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a> ${T(`or`)} <a href="${link('contact/', depth)}">${T(`send a message`)}</a>.</p>` : ''}
    ${cfg.builtBy ? `<p>Built by <a href="${esc(cfg.builtBy.url)}" target="_blank" rel="noopener">${esc(cfg.builtBy.name)}</a>.</p>` : ''}
  </div>
</div></footer>
<script src="${link('assets/site.js', depth)}${JS_V}" data-edit="${esc(JSON.stringify(editCfg))}"${GROUPS && !PREVIEW ? ` data-api="${link('groups/api.php', depth)}"` : ''}></script>
${scripts}`;
  if (fragment) return head + '\n' + page;
  return `<!doctype html>
<html lang="en">
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
const TODAY = new Date().toISOString().slice(0, 10);
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
const offPath = 'days-off/';
if (daysOff) {
  const closed = new Set((daysOff.days || []).flatMap(d => { const out = []; for (let x = d.date; x <= (d.end || d.date); x = isoAdd(x, 1)) out.push(x); return out; }));
  for (const p of campPrograms) { const odd = p.daysOff.dates.filter(x => x >= TODAY && !closed.has(x)); if (odd.length) console.log(`Note: ${p.name} lists a camp on ${odd.join(', ')}, which isn't a district day off in data/days-off.json.`); }
}
// The next day off, for the line on the home page and each school's page. The script picks the first one still ahead.
const nextOff = (depth, list) => !offDays.length ? '' : `<p class="nextoff"><b data-next-off="${esc(JSON.stringify(offDays.slice(0, 12).map(d => ({ u: d.until, w: d.end ? `${shortDate(d.date)} to ${shortDate(d.end)}` : dayDate(d.date), n: d.name, c: campsOn(d, list).length }))))}" hidden></b> <a href="${link(offPath, depth)}">${T(`Days off this year, and who’s open`)}</a></p>`;
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
const sourceLinks = (list, p = null, school = null) => { const own = p ? ownHosts(p) : null; return list.map(s => `<a href="${esc(own?.has(bareHost(s.url)) ? outUrl(s.url, { type: 'source', school, program: p }) : s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(''); };
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
  <span class="bell"><b>${esc(clock(s))}</b><span>${T(`dismissal`)}</span></span>
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
const itemAttrs = (p, extra = [], school = null) => `data-item data-grades="${p._grades === null ? '*' : p._grades.join(' ')}" data-types="${p.types.join(' ')}" data-hoods="${programHoods(p).map(hoodSlug).join(' ')}" data-cost="${costKinds(p, school).join(' ')}" data-days="${p.days ? p.days.join(' ') : '*'}" data-schools="${schools.filter(x => p.schools[x.id]).map(x => x.id).join(' ')}"${placesOf(p, school).length ? ` data-ll="${placesOf(p, school).map(x => x.join(',')).join(';')}"` : ''} data-search="${esc(haystack(p, extra))}"`;
const typeTags = (p, school = null) => p.types.map(t => `<span class="tag" style="--tc:${TYPE[t].color}">${esc(TYPE[t].label)}</span>`).join('')
  + (!costKinds(p, school).includes('free') ? '' : `<span class="tag free">${school ? (costKinds(p, school).includes('paid') ? 'Free option' : 'Free') : freeOnlyFor(p).length ? `Free for ${esc(listNames(freeOnlyFor(p)))}` : p.price === 'both' ? 'Free option' : 'Free'}</span>`);
const programRow = (p, depth) => {
  const served = schools.filter(s => p.schools[s.id]);
  return `<a class="prow" href="${link(programPath(p), depth)}" ${itemAttrs(p, [...served.map(s => s.shortName), ...programHoods(p)])}>
  <h3>${esc(p.name)}</h3>
  <span class="what">${esc(p.what)}</span>
  <span class="tally">${typeTags(p)}</span>
  <span class="tally">${served.map(s => `<span class="pill ${p.schools[s.id].relation}">${esc(REL[p.schools[s.id].relation].pill.replace('{s}', s.shortName))}</span>`).join('')}<span class="hint">Grades ${esc(gradeText(p))}</span></span>
</a>`;
};

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
  const on = { q: true, type: true, grade: true, hood: true, cost: true, ...show };
  const btn = (f, v, label, n, cls = 'tbtn', extra = '') => `<button type="button" class="${cls}" id="${f}-${v}" data-f="${f}" data-v="${v}" data-label="${esc(label)}" aria-pressed="${v === 'ALL'}"${extra}>${esc(label)}${n === null ? '' : ` (${n})`}</button>`;
  const types = TYPES.map(t => [t, list.filter(p => p.types.includes(t.id)).length]).filter(([, n]) => n);
  const typeRow = on.type && types.length > 1 ? `<div class="frow"><span class="flabel">Type</span><div class="rail" role="group" aria-label="Program type">${btn('type', 'ALL', 'All types', null)}${types.map(([t, n]) => btn('type', t.id, t.label, n, 'tbtn', ` style="--tc:${t.color}"`)).join('')}</div></div>` : '';
  const relRow = school ? `<div class="frow"><span class="flabel">Pickup</span><div class="rail" role="group" aria-label="How your child gets there">${btn('rel', 'ALL', 'Any', null)}${Object.entries(REL).map(([k, v]) => [k, v.pill.replace('{s}', school.shortName), list.filter(p => p.schools[school.id].relation === k).length]).filter(([, , n]) => n).map(([k, label, n]) => btn('rel', k, label, n)).join('')}</div></div>` : '';
  const hoodList = [...new Set(list.flatMap(programHoods))].sort();
  const hoodRow = on.hood && hoodList.length > 1 ? `<div class="frow"><span class="flabel">Area</span><div class="rail" role="group" aria-label="Neighborhood">${btn('hood', 'ALL', 'Anywhere', null)}${hoodList.map(n => btn('hood', hoodSlug(n), n, list.filter(p => programHoods(p).includes(n)).length)).join('')}</div></div>` : '';
  const costN = k => list.filter(p => costKinds(p, school).includes(k)).length, unpriced = list.filter(p => !costKinds(p, school).filter(k => k !== 'help').length).length;
  const costRow = on.cost && costN('free') && costN('paid') ? `<div class="frow"><span class="flabel">Cost</span><div class="rail" role="group" aria-label="Cost">${btn('cost', 'ALL', 'Any', null)}${btn('cost', 'free', 'Free', costN('free'))}${costN('help') > costN('free') ? btn('cost', 'help', 'Free or offers aid', costN('help')) : ''}${btn('cost', 'paid', 'Paid', costN('paid'))}${unpriced ? `<span class="hint rail-note">${unpriced} ${unpriced === 1 ? 'doesn’t' : 'don’t'} publish a price, so ${unpriced === 1 ? 'it shows' : 'they show'} only under Any.</span>` : ''}</div></div>` : '';
  // The day row appears once at least two programs in the list run on some weekdays only; until then it would filter nothing.
  const dayN = d => list.filter(p => !p.days || p.days.includes(d)).length;
  const dayRow = on.day === true || (on.day !== false && list.filter(pickyDays).length > 1) ? `<div class="frow" id="by-day"><span class="flabel">Day</span><div class="rail" role="group" aria-label="Day of the week">${btn('day', 'ALL', 'Any day', null)}${WEEK.map(d => btn('day', d, DAY_NAME[d].slice(0, 3), dayN(d))).join('')}${list.some(p => !p.days) ? `<span class="hint rail-note">Programs that don’t publish their days show under every day.</span>` : ''}</div></div>` : '';
  const gradeBtns = on.grade ? [['ALL', 'All']].concat(GRADES.map(g => [g, g])).map(([g, label]) => {
    const n = list.filter(p => (!school || p.schools[school.id].relation !== 'nearby') && (g === 'ALL' || p._grades === null || p._grades.includes(g))).length;
    return `<button type="button" class="gbtn" id="grade-${g}" data-f="grade" data-v="${g}" aria-pressed="${g === 'ALL'}" aria-label="${g === 'ALL' ? 'All grades' : g === 'PK' ? 'Pre-K' : g === 'K' ? 'Kindergarten' : 'Grade ' + g}, ${n} ${school ? 'on-site or pickup programs' : 'programs'}"><span class="g">${label}</span><span class="n">${n}</span></button>`;
  }).join('') : '';
  return `<div class="fbar needs-js-block" data-filters${school ? ` data-school="${esc(school.id)}"` : ''}>
    ${on.q ? `<div class="finder">
      <label for="prog-search">${T(searchLabel || `Looking for a particular program?`)}</label>
      <input id="prog-search" type="search" placeholder="${esc(placeholder)}" autocomplete="off">
      <p class="hint search-more" id="search-more" aria-live="polite" hidden></p>
    </div>` : ''}
    ${typeRow}${relRow}${hoodRow}${costRow}${dayRow}${near ? nearRow(depth, school) : ''}
  </div>
  ${near ? nearMap(depth) : ''}
  <section class="picker" aria-label="Filter by grade">
    ${on.grade ? `<div class="rail" role="group" aria-label="Grade">${gradeBtns}</div>` : ''}
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
  const rows = [['Where', esc(where)], ['Hours', esc(p.hours)], ['Days', esc(daysLine(p))], ['Pick up by', esc(p.pickupBy || '')], ['Cost', esc(l.cost || p.cost)], ['Days off', p.daysOff ? `Runs a camp or full day when school is closed. <a href="${link(offPath, 1)}#${esc(p.id)}">Dates and details</a>` : ''], ['Register', registerText(p)], ['Next term', esc(r.nextTerm || '') + datesHtml(p, 1)], ['Contact', r.how === 'school' ? '' : contactHtml(p)]]
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
      url: mailUrl(offPath, `#d-${d.date}`), button: camps.length ? 'See who’s open' : 'See the day',
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
    id: `campreg-${c.id}`, schools: [], programs: [], camps: [c.id], title: c.name, url: mailUrl(campPath(c)), button: 'See the camp',
  }, `c:${c.id}`, d, d.label.trim().replace(/\.$/, '')))),
  ...summerCamps.flatMap(c => (c.updates || []).map(u => ({
    id: `campnews-${c.id}-${u.date}`, kind: 'update', date: u.date, ...noteDays(`cu:${c.id}`, u), schools: [], programs: [], camps: [c.id],
    when: 'Update', title: c.name, text: u.text.trim(), url: mailUrl(campPath(c)), button: 'See the camp',
  }))).filter(a => a.expires >= TODAY),
  ...schools.filter(s => s.added).map(s => {
    const n = forSchool(s).length;
    return {
      id: `added-${s.id}`, kind: 'added', date: s.added, sendOn: s.added, expires: isoAdd(s.added, 2), schools: [], programs: [],
      waiting: finderData.schools.filter(r => r[5] === s.id).map(r => r[0]),
      when: 'New', title: `${s.shortName} now has a page`, text: `You asked to be told. ${n === 1 ? 'One program is' : n + ' programs are'} listed for ${s.shortName} so far: the ones at the school, the ones that pick up from it and the ones close by.`,
      url: mailUrl(`${s.id}/`), button: 'See the page',
    };
  }).filter(a => a.expires >= TODAY),
];
const alertsFeed = () => ({
  about: `Dated reminders for ${cfg.siteName}. Each one is emailed on its sendOn day to the people who follow that school, program or camp. Sign-up dates go the morning after they are posted, again the day before and on the morning itself; days off go in the weekly round-up.`,
  generated: TODAY, site: cfg.siteUrl, metric: ALERTS?.metric || 'School dates', sendDay: SEND_DAY_NAME,
  schools: schools.map(s => ({ id: s.id, name: s.shortName })),
  programs: programs.map(p => ({ id: p.id, name: fullName(p) })),
  camps: summerCamps.map(c => ({ id: c.id, name: c.name })),
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
const followBox = (depth, { key = '', name = '', place, title, lede, hint = '', fav = false, pick = false, h = 'h2', cls = '' }) => !(ALERTS && GROUPS) ? '' : `<div class="follow${cls ? ' ' + cls : ''}" id="by-email" data-follow="${esc(key)}" data-name="${esc(name)}" data-place="${place}" ${groupsAttrs(depth)} data-accounts="${link('assets/groups.js', depth)}${GROUPS_V}"${PREVIEW ? ' data-preview="1"' : ''} data-clarity-mask="true">
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
  <div class="follow-signin" data-follow-signin hidden></div>
  <p class="follow-status" data-follow-status aria-live="polite"></p>
  <div class="follow-more" data-follow-more hidden></div>
  <p class="hint">${hint} ${T(`Following uses a free account.`)}${fav ? ' ' + T(`A favorite sends no email: it’s kept in your account so you can find it again.`) : ''}</p>
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
  <p class="hint">${T(`To see or change everything you follow,`)} <a href="${link('profile/', D)}#following">${T(`sign in to your profile`)}</a>. ${T(`The Unsubscribe link at the foot of any email stops every email from us, including news about the site.`)}</p>
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
// The same summary as colored labels, for the top of a program's page: pickup in yellow, on-site in green, nearby in blue.
const servedPills = p => {
  const names = k => servedBy(p).filter(s => p.schools[s.id].relation === k).map(s => s.shortName);
  return [['onsite', 'Runs at '], ['pickup', 'Picks up from '], ['nearby', 'Near ']].filter(([k]) => names(k).length).map(([k, lead]) => `<span class="pill ${k} wrap">${esc(lead + listNames(names(k)))}</span>`).join(' ');
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
function programPage(p) {
  const D = 2;
  const served = servedBy(p);
  const r = p.register;
  const revs = reviewsFor(p.id);
  const avg = revs.length ? average(revs) : 0;
  const address = programAddress(p);
  const regUrl = r.how === 'online' ? outUrl(r.url, { type: 'register', program: p }) : null;
  const reviewUrl = `${link('review/', D)}?program=${p.id}${served.length === 1 ? '&school=' + served[0].id : ''}`;
  const clubsDetailed = !!p.clubs && p.clubs.some(c => c.days || c.time || c.what);   // a bare list of names stays a line of text
  const rows = [['Where', esc(address)], [p.clubs ? 'Clubs' : 'Classes', clubsDetailed ? '' : fold(esc((p.offers || []).join(', ')))], ['Hours', fold(esc(p.hours))], ['Days', esc(daysLine(p))], ['Pick up by', esc(p.pickupBy || '')], ['Cost', fold(esc(p.cost))], ['Days off', p.daysOff ? fold(esc(p.daysOff.summary), ` <a href="${link(offPath, D)}#${esc(p.id)}">Dates and details</a>`) : ''], ['Weekends', p.weekend ? fold(esc(p.weekend.summary), ` <a href="${link(weekendPath, D)}#${esc(p.id)}">Term and cost</a>`) : ''], ['Register', fold(registerText(p))], ['Next term', fold(esc(r.nextTerm || ''), datesHtml(p, D))], ['Contact', r.how === 'school' ? '' : contactHtml(p)]]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const schoolRows = served.map(s => {
    const l = p.schools[s.id];
    const line = l.relation === 'onsite' ? `Runs at ${s.shortName}, so there’s no travel after the bell.`
      : l.relation === 'pickup' ? `Picks up from ${s.shortName} at dismissal, which is ${s.dismissal}.`
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
  const camp = campOnly(p);
  const hoodHas = n => hoods.some(h => h.id === hoodSlug(n));
  const hero = `    <p class="where">${camp ? (p.daysOff ? `<a href="${link(offPath, D)}">${T(`Day-camp programs`)}</a>` : `<a href="${link(weekendPath, D)}">${T(`Weekend classes`)}</a>`) + ' / ' + (p.daysOff && p.weekend ? T(`Day camps and weekend classes`) : p.weekend ? T(`Weekends only`) : T(`Day camps only`)) : `<a href="${link('programs/', D)}">${T(`All programs`)}</a> <span class="served">${servedPills(p)}</span>`}</p>
    <h1>${esc(fullName(p))}</h1>
    <p class="lede">${esc(p.what)}</p>
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
  <section class="section">
    <h2>${T(`The details`)}</h2>
    ${photoSlot('p:' + p.id)}
    <article class="prog solo">
      ${gradeStrip(p)}
      <dl>${rows}</dl>
      ${p.note ? `<p class="flag">${esc(p.note)}</p>` : ''}
      <div class="actions">${regUrl ? `<a class="btn primary" data-track="register" href="${esc(regUrl)}" target="_blank" rel="noopener">${esc(r.label || 'Register')}</a>` : ''}<a class="btn" data-track="website" href="${esc(outUrl(p.website, { type: 'website', program: p }))}" target="_blank" rel="noopener">Website</a>${camp ? (p.daysOff ? `<a class="btn" href="${link(offPath, D)}#${esc(p.id)}">${T(`See its camp days`)}</a>` : '') + (p.weekend ? `<a class="btn" href="${link(weekendPath, D)}#${esc(p.id)}">${T(`See its weekend classes`)}</a>` : '') : `<a class="btn needs-js" href="${link('board/', D)}?add=${esc(p.id)}">${T(`Add to your week`)}</a>`}</div>
      ${ALERTS && GROUPS ? followBox(D, { key: 'p:' + p.id, name: fullName(p), place: 'program', fav: true, h: 'h3', title: T(`Tell me when sign-ups open`), lede: T(`One email when {program} posts a sign-up date, a deadline or a day-off camp.`, { program: fullName(p) }), hint: T(`An email the morning after it posts a date here, then reminders the day before and at about 8 on the morning sign-ups open.`) }) : ''}
    </article>
    <p class="hint">${T(`Prices, hours and pickup routes change during the year. Confirm with the provider before you enroll.`)}</p>
    ${listingTools('p:' + p.id, fullName(p), D, 'program')}
  </section>
  ${clubsHtml}
  ${ALERTS && GROUPS ? '' : alertsBox(D, { program: p, place: 'program', title: T(`Tell me when sign-ups open`), lede: T(`One email when {program} posts a sign-up date, a deadline or a day-off camp. Just this program. For every program at your school, sign up on your school’s page.`, { program: fullName(p) }) })}
  ${camp ? `<section class="section" id="schools">
    <h2>${p.daysOff && p.weekend ? T(`Listed for its day camps and weekend classes`) : p.weekend ? T(`Listed for its weekend classes`) : T(`Listed for its day camps`)}</h2>
    <p>${p.scope === 'weekend' ? T(`We’ve only read up on its weekend classes so far, so it isn’t on any school’s page.`) : T(`We couldn’t find a weekday after-school program here, so it isn’t on any school’s page.`)} ${p.daysOff ? T(`It runs camps on days school is closed, and children from any school can go.`) + ` <a href="${link(offPath, D)}#${esc(p.id)}">${T(`See its camp days.`)}</a> ` : ''}${p.weekend ? T(`It runs classes on weekends.`) + ` <a href="${link(weekendPath, D)}#${esc(p.id)}">${T(`See its weekend classes.`)}</a>` : ''}</p>
    <p>${T(`Does it run something after school that we missed?`)} <a href="${link('suggest/', D)}">${T(`Tell us.`)}</a></p>
  </section>` : `<section class="section" id="schools">
    <h2>${T(`Which schools it works for`)}</h2>
    <div class="serves">
${schoolRows}
    </div>
    <p>${T(`Does it serve a school that isn’t shown here?`)} <a href="${link('suggest/', D)}">${T(`Tell us.`)}</a></p>
  </section>`}
  <section class="section" id="reviews">
    <h2>${T(`What parents say`)}</h2>
    ${revs.length ? `<p><span class="stars" aria-hidden="true">${stars(Math.floor(avg + 0.25))}</span> <b>${avg.toFixed(1)} out of 5</b> from ${revs.length} ${revs.length === 1 ? 'review' : 'reviews'}</p>
    <ul class="revlist">${reviewItems(revs)}</ul>` : `<p>${T(`No reviews yet. If your child has been, a few sentences help the next family choose.`)}</p>`}
    <p class="actions"><a class="btn" href="${reviewUrl}" data-track="review">${revs.length ? T(`Write a review`) : T(`Write the first review`)}</a></p>
    <p class="hint">${T(`Reviews are first-hand notes from parents and caregivers. Each one is read before it’s posted.`)}</p>
  </section>
  <p class="src">Checked ${longDate(p.lastVerified)}. Sources: ${sourceLinks(p.sources, p)}${fix ? `<a href="${esc(fix)}">Suggest a correction</a>` : ''}</p>
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
  const crumbs = { '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], camp ? (p.daysOff ? ['Day-camp programs', `${cfg.siteUrl}/${offPath}`] : ['Weekend classes', `${cfg.siteUrl}/${weekendPath}`]) : ['Programs', cfg.siteUrl + '/programs/'], [fullName(p), url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) };
  return layout({
    title: programTitle(p),
    description: camp ? `${fullName(p)}: ${p.what}. ${p.daysOff ? 'Day camps on days Philadelphia schools are closed' : 'Weekend classes for kids'}: dates, hours, grades and how to register.` : `${fullName(p)}: ${p.what}. ${servedSummary(p)}. Grades, hours, cost, registration and parent reviews.`,
    pathName: programPath(p), depth: D, current: null, hero, body,
    jsonLd: { '@context': 'https://schema.org', '@graph': [thing, crumbs] },
  });
}

function programsPage() {
  const list = [...citywide].sort((a, b) => a.name.localeCompare(b.name));
  const hero = `    <h1>${T(`Every program, A to Z`)}</h1>
    <p class="lede">${T(`All {n} after-school programs on this site, across every school. Narrow them by type, grade or neighborhood, then open one for its hours, cost and how to register.`, { n: list.length })}</p>`;
  const body = `${filterBar({ list, depth: 1, show: { day: true }, near: true, searchLabel: `Find a program`, placeholder: 'A name, or try drums, art, chess…' })}
${noMatch(1)}
<section class="section" data-group>
  <div class="schools">
${list.map(p => programRow(p, 1)).join('\n')}
  </div>
</section>
<section class="section">
  <p>${T(`Clubs a school runs for its own students aren’t in this list. They’re on that school’s page.`)}</p>
  <p>${T(`To see only what works with your child’s school,`)} <a href="${link('schools/', 1)}">${T(`start from your school.`)}</a> ${T(`Or see what’s close to home:`)} <a href="${link('neighborhoods/', 1)}">${T(`browse by neighborhood.`)}</a></p>
</section>`;
  return layout({
    title: 'All after-school programs, A to Z',
    description: `All ${citywide.length} after-school programs listed on ${cfg.siteName}: filter by type, grade and neighborhood, with hours, cost, pickup and reviews.`,
    pathName: 'programs/', depth: 1, current: null, hero, body,
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: fullName(p), url: `${cfg.siteUrl}/${programPath(p)}` })) },
  });
}

// ---------- program types: an index, and a page per type ----------
const typeCount = t => citywide.filter(p => p.types.includes(t.id)).length;
const liveTypes = () => TYPES.filter(t => typeCount(t));
const typeChips = (depth, skip) => liveTypes().filter(t => t.id !== skip).map(t => `<a class="tchip" style="--tc:${t.color}" href="${link('types/' + t.id + '/', depth)}">${typeIcon(t)}<span>${esc(t.label)}</span><b>${typeCount(t)}</b></a>`).join('');
function typesPage() {
  const hero = `    <h1>${T(`After school, by what they do`)}</h1>
    <p class="lede">${T(`Pick the kind of program you’re after. Each list can be narrowed by grade and neighborhood.`)}</p>`;
  const body = `<section class="section">
  <div class="chips-row big">${typeChips(1)}</div>
  <p>${T(`A program can sit in more than one group: a rec center is also aftercare, and a school’s clubs may include music and chess.`)}</p>
</section>`;
  return layout({ title: 'After-school programs by type', description: `Browse Philadelphia after-school programs by type: ${listNames(liveTypes().map(t => t.label.toLowerCase()))}.`, pathName: 'types/', depth: 1, current: null, hero, body, showStreet: 'parked',
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: liveTypes().map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.label, url: `${cfg.siteUrl}/types/${t.id}/` })) } });
}
function typePage(t) {
  const D = 2;
  const list = citywide.filter(p => p.types.includes(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  // One line per school that runs clubs of this kind for its own students.
  const schoolClubs = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).flatMap(s => forSchool(s).filter(p => p.clubs && p.schools[s.id].relation === 'onsite').map(p => ({ s, p, clubs: clubsOfType(p, t.id) })).filter(x => x.clubs.length));
  const hero = `    <p class="where"><a href="${link('types/', D)}">${T(`All types`)}</a></p>
    <h1>${T(`{type}: after-school programs`, { type: t.label })}</h1>
    <p class="lede">${T(`Every program on this site in this group, with the schools each one serves. Pick a grade to narrow it down.`)}</p>`;
  const body = `${filterBar({ list, depth: D, show: { type: false } })}
${noMatch(D)}
<section class="section" data-group>
  <div class="schools">
${list.map(p => programRow(p, D)).join('\n')}
  </div>
</section>
${schoolClubs.length ? `<section class="section school-clubs" data-school-clubs>
  <h2>${T(`{type} clubs at the school itself`, { type: t.label })}</h2>
  <p class="hint">${T(`Run by a school for its own students, so they aren’t in the list above.`)}</p>
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
  return layout({
    title: `${t.label} after-school programs in Philadelphia`,
    description: `${plural(list.length, 'after-school program', 'after-school programs')} in Philadelphia for ${t.label.toLowerCase()}: who picks up from which school, grades, hours and cost.`,
    pathName: `types/${t.id}/`, depth: D, current: null, hero, body,
    jsonLd: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'ItemList', name: `${t.label} after-school programs`, itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: fullName(p), url: `${cfg.siteUrl}/${programPath(p)}` })) },
      { '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Program types', cfg.siteUrl + '/types/'], [t.label, url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
    ] },
  });
}

// ---------- pages ----------
const forSchool = s => programs.filter(p => p.schools[s.id]);
const tally = s => Object.fromEntries(Object.keys(REL).map(k => [k, forSchool(s).filter(p => p.schools[s.id].relation === k).length]));
const clock = s => s.dismissal.replace(/\s*[ap]m$/i, '');
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
  const body = `<div data-request-page data-slug="${esc(x.id)}" data-send="${link('schools/request/', D)}send.php" data-root="${link('', D).replace(/index\.html$/, '')}" data-index="" data-src="${link('data/school-finder.json', D)}" style="display:contents">
  <section class="section">
  <div class="panel" id="req-panel">
    <h2>${T(`Want {school} added?`, { school: x.name })}</h2>
    <p>${T(`Each school takes real checking, so the ones parents ask for most go first. One tap adds your vote.`)}</p>
    <div class="actions needs-js-block"><button type="button" class="btn primary big" id="req-btn">Ask for ${esc(x.name)}</button></div>
    <p class="hint" id="req-status" aria-live="polite"></p>
    ${ALERTS ? `<form class="alerts-form req-notify needs-js-block" id="req-notify" data-key="${esc(ALERTS.klaviyoKey)}" data-list="${esc(ALERTS.listId)}"${ALERTS.doubleOptIn ? ' data-confirm="1"' : ''} data-clarity-mask="true" novalidate>
      <h3 id="req-notify-title">Get an email when ${esc(x.name)} is added</h3>
      <div class="alerts-row">
        <div class="field">
          <label for="req-name">${T(`Your first name`)}</label>
          <input id="req-name" name="first_name" type="text" maxlength="60" autocomplete="given-name" required>
        </div>
        <div class="field">
          <label for="req-email">${T(`Your email`)}</label>
          <input id="req-email" name="email" type="email" maxlength="150" autocomplete="email" inputmode="email" required>
        </div>
        <div class="hp" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">
          <label for="req-company">Leave this blank</label>
          <input id="req-company" name="company" type="text" tabindex="-1" autocomplete="off">
        </div>
        <button class="btn primary big" type="submit">${T(`Email me when it’s added`)}</button>
      </div>
      <p class="hint">${T(`One email when this school gets its page. It also adds you to our email list, for occasional news about the site. Every email has an unsubscribe link.`)} <a href="${link('privacy/', D)}#email">${T(`How we handle your email.`)}</a></p>
      <p class="alerts-status" id="req-notify-status" aria-live="polite"></p>
    </form>` : ''}
    <p>${T(`Know which programs pick up from this school?`)} <a href="${link('suggest/', D)}?kind=school&amp;newschool=${encodeURIComponent(x.name)}">${T(`Tell us, and it gets covered faster.`)}</a></p>
  </div>
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
${near.camps.map(([c, m]) => `<a class="prow" href="${link(campPath(c), D)}"><h3>${esc(c.name)}</h3><span class="what">${esc(c.what)}</span><span class="tally">${milesPill(m)}<span class="hint">${[campAges(c), campPrice(c)].filter(Boolean).map(esc).join(' · ')}</span></span></a>`).join('\n')}
    </div>
    <p><a class="btn" href="${link(campsPath, D)}">${T(`All summer camps`)}</a></p>
  </section>` : ''}
  <section class="section">
    <h2>${T(`In the meantime`)}</h2>
    <p>${closest && closest.miles <= 2 ? T(`The closest school with a page is {name}, about {miles} away. Programs that serve it may reach {school} too, but ask each one.`, { name: closest.name, miles: closest.miles === 1 ? '1 mile' : closest.miles + ' miles', school: x.name }) : T(`No school with a page is close by yet. You can still browse by neighborhood or look through every program.`)}</p>
    <div class="actions">${closest && closest.miles <= 2 ? `<a class="btn" href="${link(closest.id + '/', D)}">See ${esc(closest.name)}</a>` : ''}<a class="btn" href="${link('neighborhoods/', D)}">${T(`Browse by neighborhood`)}</a><a class="btn" href="${link('programs/', D)}">${T(`All programs`)}</a></div>
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
  const body = `<div class="prose" data-request-page data-send="${PREVIEW ? '' : 'send.php'}" data-root="${link('', D).replace(/index\.html$/, '')}" data-index="${PREVIEW ? 'index.html' : ''}"${PREVIEW ? '' : ` data-src="${link('data/school-finder.json', D)}"`}>
  <div class="panel" id="req-panel" hidden>
    <h2>${T(`Want it added?`)}</h2>
    <p>${T(`Each school takes real checking, so the ones parents ask for most go first. One tap adds your vote.`)}</p>
    <div class="actions"><button type="button" class="btn primary big" id="req-btn">Ask for this school</button></div>
    <p class="hint" id="req-status" aria-live="polite"></p>
    ${ALERTS ? `<form class="alerts-form req-notify" id="req-notify" data-key="${esc(ALERTS.klaviyoKey)}" data-list="${esc(ALERTS.listId)}"${ALERTS.doubleOptIn ? ' data-confirm="1"' : ''}${PREVIEW ? ' data-preview="1"' : ''} data-clarity-mask="true" novalidate>
      <h3 id="req-notify-title">${T(`Get an email when it’s added`)}</h3>
      <div class="alerts-row">
        <div class="field">
          <label for="req-name">${T(`Your first name`)}</label>
          <input id="req-name" name="first_name" type="text" maxlength="60" autocomplete="given-name" required>
        </div>
        <div class="field">
          <label for="req-email">${T(`Your email`)}</label>
          <input id="req-email" name="email" type="email" maxlength="150" autocomplete="email" inputmode="email" required>
        </div>
        <div class="hp" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">
          <label for="req-company">Leave this blank</label>
          <input id="req-company" name="company" type="text" tabindex="-1" autocomplete="off">
        </div>
        <button class="btn primary big" type="submit">${T(`Email me when it’s added`)}</button>
      </div>
      <p class="hint">${T(`One email when this school gets its page. It also adds you to our email list, for occasional news about the site. Every email has an unsubscribe link.`)} <a href="${link('privacy/', D)}#email">${T(`How we handle your email.`)}</a></p>
      <p class="alerts-status" id="req-notify-status" aria-live="polite"></p>
    </form>` : ''}
  </div>
  <div class="panel" id="req-near" hidden>
    <h2>${T(`In the meantime`)}</h2>
    <p id="req-near-text"></p>
    <div class="actions"><a class="btn" id="req-near-link" href="${link('schools/', D)}">See that school</a><a class="btn" href="${link('neighborhoods/', D)}">${T(`Browse by neighborhood`)}</a><a class="btn" href="${link('programs/', D)}">${T(`All programs`)}</a></div>
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

// Receives "ask for this school". Emails the request and keeps a log, so demand can be counted.
function schoolRequestPhp() {
  const names = Object.fromEntries(finderData.schools.filter(r => !r[5]).map(r => [r[0], `${r[1]} (${r[2]})`]));
  return `<?php
// Receives a request for a school that isn't covered yet. Generated by build.mjs; edit it there.
$TO = ${JSON.stringify(cfg.contactEmail)};
$SITE = ${JSON.stringify(cfg.siteName)};
$SCHOOLS = json_decode(<<<'PAS_JSON'
${JSON.stringify(names)}
PAS_JSON
, true);
header('Cache-Control: no-store');
function out($ok, $msg, $code) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(array('ok' => $ok, 'message' => $msg));
  exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  out(false, 'Use the button on the site.', 405);
}
$in = json_decode(file_get_contents('php://input'), true);
$id = (is_array($in) && isset($in['s']) && is_string($in['s'])) ? $in['s'] : '';
if (is_array($in) && isset($in['company']) && $in['company'] !== '') {
  out(true, 'Thanks.', 200);
}
if (!isset($SCHOOLS[$id])) {
  out(false, 'We could not find that school.', 400);
}
// At most 12 requests an hour from one address, so nobody can flood the inbox.
$dir = dirname($_SERVER['DOCUMENT_ROOT']);
$file = $dir . '/phillyafterschool-request-limits.json';
$who = substr(hash('sha256', isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : ''), 0, 16);
$seen = @json_decode((string) @file_get_contents($file), true);
if (!is_array($seen)) $seen = array();
$recent = array();
foreach ($seen as $k => $times) {
  if (!is_array($times)) continue;
  $keep = array();
  foreach ($times as $t) { if (is_int($t) && $t > time() - 3600) $keep[] = $t; }
  if ($keep) $recent[$k] = $keep;
}
if (isset($recent[$who]) && count($recent[$who]) >= 12) {
  out(true, 'Thanks.', 200);
}
$recent[$who][] = time();
@file_put_contents($file, json_encode($recent), LOCK_EX);

$name = $SCHOOLS[$id];
$log = $dir . '/phillyafterschool-school-requests.log';
$saved = @file_put_contents($log, date('c') . "\\t" . $id . "\\t" . $name . "\\n", FILE_APPEND | LOCK_EX);
$count = 0;
$lines = @file($log);
if (is_array($lines)) { foreach ($lines as $line) { $parts = explode("\\t", $line); if (isset($parts[1]) && $parts[1] === $id) $count++; } }
$body = "A parent asked for this school to be added:\\n\\n$name\\n\\nRequests for it so far: " . max(1, $count) . "\\n";
$headers = array('From: ' . $SITE . ' <' . $TO . '>', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8');
$sent = @mail($TO, '=?UTF-8?B?' . base64_encode("[$SITE] School request: $name") . '?=', $body, implode("\\r\\n", $headers));
if (!$sent && $saved === false) {
  out(false, 'That did not go through. Please try again later.', 500);
}
out(true, 'Thanks.', 200);
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
    ${GROUPS && ALERTS ? `<p class="wk-mail"><b>${T(`Want this on Sunday mornings?`)}</b> ${T(`It’s an email you turn on in your profile, and it only comes in weeks with something out of the ordinary.`)} <a href="${link('profile/', 1)}#emails">${T(`Turn it on`)}</a></p>` : ''}
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
    <h1>${T(`It’s {time} at {school}. Now what?`, { time: clock(s), school: s.shortName })}</h1>
    <p class="lede">${T(`Every after-school program we could find that runs at the school, picks children up from {school}, or sits within a short walk. Pick a grade to see what your child can join.`, { school: s.shortName })}</p>
    <div class="facts">
      <span>Dismissal <b>${esc(s.dismissal)}</b>${s.dismissalNote ? ` (${esc(s.dismissalNote)})` : ''}</span>
      <span>School office <b><a href="${telHref(s.phone)}">${esc(s.phone)}</a></b></span>
      ${schoolHoods(s).length ? `<span>Neighborhood <b>${hoodLinks(schoolHoods(s), 1)}</b></span>` : ''}
      <span>Reviewed <b>${longDate(s.lastReviewed)}</b></span>
    </div>
    <p class="mine-row needs-js-block"><button type="button" class="savebtn" data-my-school="${esc(s.id)}" data-name="${esc(s.shortName)}" aria-pressed="false">Save as my school</button><span class="hint" data-my-school-note aria-live="polite"></span></p>`;
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
  const covered = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName));
  const hero = `    <h1>${T(`School’s out. Now what?`)}</h1>
    <p class="lede">${T(`Find the after-school programs that work with your child’s school: what runs in the building, who picks up at dismissal, and what’s close enough to walk to.`)}</p>
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
    daysOff ? [link(offPath, 0), T(`Day camps`), T(`{n} programs run camps on the days school is closed, with a planner for the year.`, { n: campPrograms.length }), '#B88A00'] : null,
    summerCamps.length ? [link(campsPath, 0), T(`Summer camps`), T(`{n} day camps in the city, with ages, hours and prices, and a schedule to plan the summer week by week.`, { n: summerCamps.length }), '#2C8444'] : null,
  ].filter(Boolean);
  const body = `${nextOff(0)}
<section class="section" id="start">
  <div class="starts">
    <div class="start">
      <div class="start-head">${who('parent')}<div><p class="kicker">${T(`Start here`)}</p> <h2>${T(`Parents`)}</h2></div></div>
      <p>${T(`See what works with your child’s school, then put the week together.`)}</p>
      <div class="start-list">
        ${go(link('schools/', 0), T(`Find your school`), T(`Every program that’s there, picks up or is nearby`), 'school')}
        ${go(link(schedulesPath, 0), T(`Build a schedule`), T(`The school week, days off and the summer`), 'week')}
        ${GROUPS ? `<span class="when-out" style="display:contents">${go(link('register/', 0), T(`Create a free account`), T(`Keep every plan, and get the whole year in one calendar`), 'person')}</span><span class="when-in" style="display:contents">${go(link('account/', 0), T(`Your account`), T(`Your plans, your kids’ calendar and who you share with`), 'person')}</span>` : ''}
      </div>
    </div>
    <div class="start managers">
      <div class="start-head">${who('manager')}<div><p class="kicker">${T(`Start here`)}</p> <h2>${T(`Program managers`)}</h2></div></div>
      <p>${T(`Run an after-school program, a weekend class or a camp? Make sure parents see it right.`)}</p>
      <div class="start-list">
        ${GROUPS ? go(link('managers/', 0), T(`Claim your listing`), T(`Keep its dates, costs and hours current yourself`), 'claim') : ''}
        ${go(link('suggest/', 0), T(`Add a program`), T(`Not listed yet? Send its name and website`), 'plus')}
        ${go(link('suggest/', 0) + '?kind=camp', T(`Add a camp`), T(`Summer camps and camps on days off`), 'tent')}
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
</section>` : ''}
<section class="section" id="schools">
  <h2>${T(`Schools covered so far`)}</h2>
  <div class="chips-row">${covered.slice(0, 12).map(s => `<a class="btn" href="${link(s.id + '/', 0)}">${esc(s.shortName)}</a>`).join('')}<a class="btn quiet" href="${link('schools/', 0)}">${covered.length > 12 ? `All ${covered.length} schools` : T(`All schools`)}</a></div>
  <p>${T(`Schools are added one at a time, because every pickup list has to be checked. Search for yours above and ask for it: the ones parents ask for most go first.`)}</p>
</section>
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
  <p>${T(`Every listing links to where the information came from and shows the day it was last checked. Nobody pays to be listed. If it saved you an evening of open tabs,`)} <a href="${link('support/', 0)}">${T(`buy me a coffee.`)}</a></p>
</section>
${cfg.builtBy ? `<section class="section" id="who">
  <h2>${T(`Who built this`)}</h2>
  <p>${T(cfg.builtBy.bio)}</p>
</section>` : ''}`;
  return layout({
    title: cfg.siteName, pathName: '', depth: 0, current: null, hero, body, fragment: PREVIEW, showStreet: 'go', roomy: true,
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
  const hero = `    <h1>${T(`After school, by neighborhood`)}</h1>
    <p class="lede">${T(`Start from where you live. Each neighborhood lists the schools there and the programs based there, plus the ones that come to pick up.`)}</p>`;
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
    title: 'After-school programs by neighborhood',
    description: `After-school programs and schools in ${listNames(hoods.map(h => h.name))}, Philadelphia: what’s based in each neighborhood and who picks up.`,
    pathName: 'neighborhoods/', depth: 1, current: null, hero, body, showStreet: 'parked',
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: hoods.map((h, i) => ({ '@type': 'ListItem', position: i + 1, name: h.name, url: `${cfg.siteUrl}/${hoodPath(h)}` })) },
  });
}

function neighborhoodPage(h) {
  const D = 2;
  const here = new Set(h.programs.map(p => p.id));
  const based = [...h.programs].sort((a, b) => a.name.localeCompare(b.name));
  // Programs with a building somewhere else that collect children from a school in this neighborhood.
  const comes = programs.filter(p => !here.has(p.id) && h.schools.some(s => p.schools[s.id]?.relation === 'pickup')).sort((a, b) => a.name.localeCompare(b.name));
  const others = hoods.filter(x => x.id !== h.id);
  // Weekend classes go by where they are, not by school: the ones in this neighborhood first, then the rest of this part of the city.
  const wkHere = weekendPrograms.filter(p => programHoods(p).includes(h.name));
  const wkArea = (CAMP_AREAS.find(a => a[1].includes(h.name)) || [null])[0];
  const wkNear = wkArea ? weekendPrograms.filter(p => !wkHere.includes(p) && weekendAreas(p).includes(wkArea)) : [];
  const hero = `    <p class="where"><a href="${link('neighborhoods/', D)}">${T(`All neighborhoods`)}</a></p>
    <h1>${T(`After school in {name}`, { name: h.name })}</h1>
    <p class="lede">${T(`The schools in {name}, the after-school programs based there, and the ones that come to pick up.`, { name: h.name })}</p>
    <div class="facts">
      ${h.schools.length ? `<span><b>${h.schools.length}</b> ${h.schools.length === 1 ? 'school' : 'schools'}</span>` : ''}
      <span><b>${based.length}</b> ${based.length === 1 ? 'program' : 'programs'} based here</span>
      ${comes.length ? `<span><b>${comes.length}</b> more that pick up</span>` : ''}
      ${wkHere.length ? `<span><b>${wkHere.length}</b> with weekend classes</span>` : ''}
    </div>`;
  const body = `<section class="section">
  <h2>${T(`Schools in {name}`, { name: h.name })}</h2>
  ${h.schools.length ? `<div class="schools">
${h.schools.map(s => schoolRow(s, D)).join('\n')}
  </div>` : `<p class="ask">${T(`No school in {name} is on the site yet.`, { name: h.name })} <a href="${link('schools/request/', D)}">${T(`Ask for yours.`)}</a></p>`}
</section>
${based.length + comes.length > 3 ? filterBar({ list: [...based, ...comes], depth: D, show: { hood: false, q: false } }) : ''}
${noMatch(D)}
<section class="section" data-group>
  <h2>${T(`Programs based in {name}`, { name: h.name })}</h2>
  <p>${T(`Each one shows the schools it serves. Open it for hours, cost and how to register.`)}</p>
  <div class="schools">
${based.map(p => programRow(p, D)).join('\n')}
  </div>
</section>
${comes.length ? `<section class="section" data-group>
  <h2>${T(`Based elsewhere, but they pick up here`)}</h2>
  <p>${T(`These programs are in another neighborhood and collect children from a school in {name}.`, { name: h.name })}</p>
  <div class="schools">
${comes.map(p => programRow(p, D)).join('\n')}
  </div>
</section>` : ''}
${wkHere.length + wkNear.length ? `<section class="section" id="weekends">
  <h2>${wkHere.length ? T(`Weekend classes in {name}`, { name: h.name }) : T(`Weekend classes near {name}`, { name: h.name })}</h2>
  <p>${T(`Saturday and Sunday classes go by where they are. Any child can sign up, whichever school they go to.`)}</p>
  ${wkHere.length ? `<div class="schools">
${wkHere.map(p => weekendRow(p, D)).join('\n')}
  </div>` : ''}
  ${wkNear.length ? `${wkHere.length ? `<h3 class="sub">${T(`Close by, in {area}`, { area: wkArea })}</h3>` : ''}
  <div class="schools">
${wkNear.map(p => weekendRow(p, D)).join('\n')}
  </div>` : ''}
  <p><a class="btn" href="${link(weekendPath, D)}${wkArea ? '?hood=' + hoodSlug(wkArea) : ''}">${wkArea ? T(`All weekend classes in {area}`, { area: wkArea }) : T(`All weekend classes`)}</a></p>
</section>` : ''}
<section class="section">
  <h2>${T(`Other neighborhoods`)}</h2>
  <p class="chips-row">${others.map(x => `<a class="btn" href="${link(hoodPath(x), D)}">${esc(x.name)}</a>`).join('')}</p>
</section>`;
  const url = `${cfg.siteUrl}/${hoodPath(h)}`;
  return layout({
    title: `After-school programs in ${h.name}, Philadelphia`,
    description: `${plural(based.length, 'after-school program', 'after-school programs')} based in ${h.name}, Philadelphia${comes.length ? `, plus ${comes.length} more that pick up from ${listNames(h.schools.map(s => s.shortName))}` : ''}. Hours, cost, pickup and reviews.`,
    pathName: hoodPath(h), depth: D, current: null, hero, body,
    jsonLd: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'ItemList', name: `After-school programs in ${h.name}`, itemListElement: [...based, ...comes].map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: fullName(p), url: `${cfg.siteUrl}/${programPath(p)}` })) },
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
    <li>${T(`The site works without telling us anything about a child. If you choose to keep a week or a summer in your profile, or share a week, you decide what first name to use, and you can use a nickname or an initial.`)}</li>
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
    <li>${GROUPS ? T(`There are no ads, and nothing you send is sold. An account is optional: it is for following a program’s dates, keeping favorites, keeping your school or a plan in a profile, and sharing a week with someone.`) : T(`There are no accounts and no ads, and nothing you send is sold.`)}</li>
    <li>${GROUPS ? T(`Your rosters, including any child’s name you type, are saved in your own browser. They are not sent to us unless you sign in and choose to keep one in your profile or share one.`) : T(`Your rosters, including any child’s name you type, are saved in your own browser. They are not sent to us.`)}</li>
    <li>${T(`If you send a suggestion or a review, it arrives as an email to the person who runs the site.`)}</li>
    ${ALERTS ? `<li>${GROUPS ? T(`If you follow a program, a camp or a school, the list of what you follow is kept in your account, and your email address and that list are kept by Klaviyo, the service that sends the emails.`) : T(`If you ask for dates by email, your first name, your email address and the school or program you picked are kept by Klaviyo, the service that sends the emails.`)}</li>
    <li>${T(`If you ask to be emailed when a school is added, the same three things are kept by Klaviyo: your first name, your email address and which school you’re waiting for. It also adds you to our email list for occasional news about the site.`)}</li>` : ''}
    <li>${T(`We use Google Analytics and Microsoft Clarity to see how the site is used, so we can fix what’s confusing.`)}</li>
  </ul>
  <h2 id="rosters" data-jump-to="Rosters">${T(`Rosters and children’s names`)}</h2>
  <ul>
    <li>${T(`A roster lives in the browser you made it in. Clearing your browser’s site data deletes it.`)}</li>
    <li>${(GROUPS ? T(`A summer schedule is kept the same way: the camps you picked for each week, and any first name you type, stay in your browser and are not sent to us unless you sign in and choose to keep the summer in your profile. A photo you add to a calendar picture is used once, in your browser, and is never saved or uploaded.`) : T(`A summer schedule is kept the same way: the camps you picked for each week, and any first name you type, stay in your browser and are not sent to us. A photo you add to a calendar picture is used once, in your browser, and is never saved or uploaded.`))}</li>
    <li>${T(`If you save a school as yours, that choice is kept in your own browser too. Our visit counts record that a school was saved, not who saved it.`)}</li>
    <li>${T(`A child’s name is optional. If you add one, it stays on your device unless you keep or share that week through an account.`)}</li>${GROUPS ? `
    <li>${T(`Dates you add yourself to “My kids’ calendar”, like picture day or a form that’s due, are kept in your browser and nowhere else. They are not sent to us and are not part of your profile, so they don’t appear on your other devices.`)}</li>` : ''}
    <li>${T(`A week can no longer be shared as a link. A link showed the week to anyone who had it and could not be taken back, so links made before October 2026 have stopped opening.`)}</li>
    <li>${T(`If one of those older links is opened, the site still removes the name from the page address before any analytics loads. The roster page is set to be hidden in session recordings.`)}</li>
    <li>${T(`Making a card happens on your own device. What you do with the picture is up to you.`)}</li>
    <li>${T(`If you add a photo to a week card, the card is made in your own browser. The photo is not uploaded, not saved, and gone when you close the page.`)}</li>
  </ul>
  ${GROUPS ? `<h2 id="groups" data-jump-to="Accounts">${T(`Accounts, profiles and sharing`)}</h2>
  <p>${T(`An account is optional. It lets you keep your school and a child’s week in a profile, share a week with one person, and join a share group of a few families who know each other. These are the only parts of the site that keep anything about a child on our server, and only when you choose to use them.`)}</p>
  <ul>
    <li>${T(`An account is an email address and your first and last name. The email signs you in and tells you when someone opens a week you shared or joins a group you made. Other members never see it.`)}</li>${GROUPS.google ? `
    <li>${T(`You can sign in with Google instead of an emailed code. Google’s button is loaded on the pages where you sign in, so Google can see that someone opened that page. If you use it, Google tells us your name and email address. We ask for nothing else and never see your Google password.`)}</li>` : ''}
    <li>${T(`If you keep your school in your profile, we store which school. If you keep your children’s grades, we store the grades and nothing about which child is in which. If you keep a week in your profile, we store the child’s first name, the programs on their current and upcoming weeks, and the school each program was picked under, so the week can be put back on another device. Notes you type are not stored.`)}</li>
    <li>${T(`If you keep a summer schedule in your profile, we store each child’s first name as you typed it and the camps picked for each week, so the summer is there on your other devices. Ages, the calendar’s title and photos are not stored. A summer in your profile can’t be shared with anyone, and it is deleted when you take it out of your profile or delete your account. The summer schedule section is hidden in session recordings, and analytics is told only that a summer was kept, never what is in it.`)}</li>
    <li>${T(`If you keep a days-off plan in your profile, we store each child’s first name as you typed it and the place picked for each day school is closed. The calendar’s title and photos are not stored. The plan can’t be shared with anyone, and it is deleted when you take it out of your profile or delete your account. The planner is hidden in session recordings, and analytics is never told what is in a plan you keep.`)}</li>
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
    <li>${T(`Accounts, profiles and groups are kept in a file on our web host, outside the public site. Google Analytics and Microsoft Clarity are not loaded on your account page, your profile page, on invitations or on group pages. Two pages around them do load them. The page where you create an account counts visits: its form is hidden in session recordings, and analytics is told only that a sign-up started, whether it used email or Google, and that it finished, never the address or a name. The Build your week page is hidden in session recordings too, and analytics is told only that something was kept or shared, never what or with whom.`)}</li>
    <li>${T(`We keep a daily count of how many accounts, shared weeks and groups were made, to see whether this is used. The counts hold no names, addresses or weeks.`)}</li>
    <li>${T(`You can take a week out of your profile or out of a group, stop sharing, leave a group, or delete your account from the site at any time, and it is removed straight away. A group’s creator can remove anyone. Every shared week and group is deleted two weeks after the last day of school.`)}</li>
    <li>${T(`A safety copy of the accounts database is made each day and kept for 14 days, in case something breaks, and our web host keeps its own backups. So what you delete is gone from the site straight away, and leaves those copies as they are replaced, usually within a month.`)}</li>
    <li>${T(`Accounts are for parents, caregivers, teachers and the people who run programs. Children should not make one, and the site never asks a child for an email address: building a week and making a card work without an account.`)}</li>
  </ul>
  <h2 id="managers" data-jump-to="Program managers">${T(`If you manage a program and claim its listing`)}</h2>
  <ul>
    <li>${T(`Claiming uses the same account. We check one thing: that the email address you signed in with is at the listing’s own website address. We keep which listing you claimed, when, and whether the claim stands.`)}</li>
    <li>${T(`The public sees a “Claimed” mark on the listing and nothing about you. Your name and email address are seen only by the person who runs this site.`)}</li>
    <li>${T(`Changes you propose are kept with your claim and emailed to the site’s inbox. They are checked and published by a person, and you are told by email when that happens.`)}</li>
${GROUPS.photos ? `    <li>${T(`A photo you send for your listing is shrunk in your browser before it leaves your device, kept on our web host, and shown on the listing only after a person approves it. You can replace or remove it at any time. Send only a photo you have the right to use, with permission from the families of any children in it.`)}</li>` : ''}
    <li>${T(`If you say whether there’s space, the listing shows “Spots open”, “Waitlist” or “Full” and the day you said it. It goes up at once, without anyone checking it, and comes down after 30 days unless you set it again.`)}</li>
    <li>${T(`You can give up a claim at any time, and deleting your account removes your claims and the changes you proposed.`)}</li>
    <li>${T(`The page where you claim a listing loads Google Analytics and Microsoft Clarity to count visits. The part where you sign in and manage claims is hidden in session recordings.`)}</li>
  </ul>` : ''}
  <h2 id="forms" data-jump-to="Forms and reviews">${T(`Suggestions, corrections and reviews`)}</h2>
  <ul>
    <li>${T(`What you type into a form is emailed to the site’s inbox, and a backup copy is kept on our web host in case the email goes missing.`)}</li>
    <li>${T(`Your email address is used only to reply to you or to confirm something. It is never published.`)}</li>
    <li>${T(`A review that is approved appears on the site with your first name, your child’s school and the month. Nothing else about you is shown.`)}</li>
    <li>${T(`Asking for a school to be covered sends only the school’s name.`)}</li>
    <li>${T(`A date you send in for a school’s page (picture day, a half day) is read by a person before it is published. What is published is the date and what it is, marked “from a parent”: never your name or email.`)}</li>
    <li>${T(`Please don’t include children’s names or other people’s personal details in what you send.`)}</li>
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
    <li>${T(`You hear only about what you follow. Stop following from the listing’s page or from your profile page and those emails stop; deleting your account stops them all.`)}</li>
    <li>${T(`A sign-up date is emailed the morning after it is posted on this site, with reminders the day before and on the morning itself. Days off come in a weekly round-up. We can only pass on a date once the program has posted it and it has reached this site.`)}</li>
    <li>${T(`Every date email has a link for each listing in it, “Stop emails about …”. It stops that one listing without signing in, including its dates that would have reached you through a school you follow, and you can undo it on the spot or from your account page.`)}</li>
    <li>${T(`That link works because it carries a random code that belongs to your account. The code is kept with your account and on your email-list profile, and it can do one thing: stop emails. It can’t open your account or show anything in it, and the page it opens never says whose it is.`)}</li>
    <li>${T(`So that a stop always holds, we keep a list of what has been stopped in a scrambled form that can’t be read back into a person or a listing without that code. The entry for a deleted account stays on that list, so its emails stay stopped.`)}</li>
    <li>${T(`“This week at your school” is an email you turn on in your profile, for the school kept there. It is off until you tick it. It works like following: which school it is for is kept in your account and on your email-list profile, and you can turn it off there or from the link in any of those emails.`)}</li>
    <li>${T(`A favorite is different. It is kept in your account and nowhere else: it isn’t sent to Klaviyo, and it sends no email.`)}</li>
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
    <li>${T(`We keep a count, for each listing and each day, of how many times its page was opened, how many times its sign-up and website links were followed, how many times it was put on a plan, and how many people asked for its emails.`)}</li>
    <li>${T(`It is a number and nothing else. No cookie is set, and nothing says who you are, which child a plan was for, or what else you looked at.`)}</li>
    <li>${T(`To stop a count being run up, the server keeps a scrambled form of the internet address behind each count for up to two days. It can’t be turned back into the address and isn’t tied to what was counted.`)}</li>
    <li>${T(`The people who run a listing they have claimed can see that listing’s numbers. Nobody else can, apart from us.`)}</li>
  </ul>
  ` : ''}<h2 id="analytics" data-jump-to="Analytics">${T(`Analytics and recordings`)}</h2>
  <ul>
    <li>${T(`Google Analytics records which pages are visited and which buttons, filters and searches are used, along with general details such as device type and approximate location. That includes the words typed into the program search box.`)}</li>
    <li>${T(`Microsoft Clarity records how pages are used, including heatmaps and replays of scrolling and clicking, to help us improve the site. We have set it to hide form fields and the roster page.`)}</li>
    <li>${T(`Both services use cookies and similar technologies, and Google and Microsoft handle that data under their own privacy terms:`)} <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">${T(`how Google uses information from sites that use its services`)}</a>, <a href="https://www.microsoft.com/privacy/privacystatement" target="_blank" rel="noopener">${T(`the Microsoft Privacy Statement`)}</a>.</li>
    <li>${T(`You can block both with your browser’s privacy settings or a content blocker, and the site will still work.`)}</li>
    <li>${T(`Like every website, our host keeps standard server logs, which include IP addresses.`)}</li>
  </ul>
  <h2 id="elsewhere" data-jump-to="Other sites">${T(`Links to other sites`)}</h2>
  <p>${T(`Program websites, registration pages, calendars and Venmo are run by other organizations and have their own privacy practices.`)}</p>
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
    ? `<p class="actions"><a class="btn primary big" data-track="support" href="${esc(cfg.supportUrl)}" target="_blank" rel="noopener">${esc(cfg.supportLabel || 'Buy me a coffee')}</a></p>
  ${cfg.supportHandle ? `<p class="hint">Or search for <b>${esc(cfg.supportHandle)}</b> in the Venmo app.</p>` : ''}`
    : `<div class="panel"><h3>${T(`The coffee link is being set up`)}</h3><p>${T(`Check back soon.`)}</p></div>`;
  const hero = `    <h1>${T(`Buy me a coffee`)}</h1>
    <p class="lede">${T(`I’m {name}. I built this because sorting out after-school care for my own kid was chaos. If it saved you an evening of open tabs, a coffee is a nice way to say so.`, { name: who })}</p>`;
  const body = `<div class="prose">
  ${give}
  <ul>
    <li>${T(`It goes to me, the person who built and updates this, for the hours spent checking listings and adding schools.`)}</li>
    <li>${T(`It’s a thank-you, not a charitable donation, so it isn’t tax-deductible.`)}</li>
    <li>${T(`It buys nothing on the site. Listings are free for every provider, and nobody pays to be listed or to be listed higher.`)}</li>
    <li>${T(`Not a coffee person? A correction or a missing program helps just as much.`)} <a href="${link('suggest/', 1)}">${T(`Send one here.`)}</a></li>
  </ul>
</div>`;
  return layout({ title: 'Buy me a coffee', description: `Say thanks to the person who built and maintains ${cfg.siteName}.`, pathName: 'support/', depth: 1, current: 'support/', hero, body, showStreet: 'parked' });
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

$sent = @mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\\r\\n", $headers));
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
$sent = @mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\\r\\n", $headers));
$log = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-suggestions.log';
$saved = @file_put_contents($log, date('c') . ($sent ? ' (emailed)' : ' (EMAIL FAILED)') . "\\n" . $body . "----\\n", FILE_APPEND | LOCK_EX);
if (!$sent && $saved === false) fail('Something went wrong on our side. Please email ' . $TO . ' instead.', 500);
header('Location: thanks/', true, 303);
exit;
`;
}

// ---------- days off: when district schools are closed, and who runs something ----------
function daysOffPage() {
  const D = 1;
  const noDates = campPrograms.filter(p => !p.daysOff.dates.some(x => x >= TODAY));
  const dated = campPrograms.filter(p => p.daysOff.dates.some(x => x >= TODAY));
  // every weekday still to come that school is closed, each with the break it belongs to and who has posted a camp for it
  const days = offDays.flatMap((d, bi) => d.dates.filter(x => x >= TODAY).map(x => ({ d: x, label: dayDate(x), name: d.name, b: bi, note: d.note || '', camps: campPrograms.filter(p => p.daysOff.dates.includes(x)).map(p => p.id) })));
  const head = days.map((x, i) => { const dt = utcDay(x.d); return `<th scope="col" data-w="${i}" title="${esc(x.name)}"><span>${MONTH_NAMES[dt.getUTCMonth()].slice(0, 3)}</span><b>${dt.getUTCDate()}</b><span class="vh">, ${esc(x.name)}</span></th>`; }).join('');
  const chartRows = dated.map(p => `<tr data-camp="${esc(p.id)}">
  <th scope="row"><a href="#${esc(p.id)}">${esc(p.name)}</a><small>${esc([programHoods(p).join(', '), `${p.daysOff.dates.filter(x => x >= TODAY).length} posted`].filter(Boolean).join(' · '))}</small></th>
  ${days.map((x, i) => x.camps.includes(p.id) ? `<td class="on exact" data-w="${i}"><span class="vh">Open</span></td>` : `<td data-w="${i}"></td>`).join('')}
</tr>`).join('\n');
  const cards = campPrograms.map(p => {
    const dates = p.daysOff.dates.filter(x => x >= TODAY);
    const served = servedBy(p);
    return `<article class="prog offprog" id="${esc(p.id)}">
  <div class="top"><h3><a href="${link(programPath(p), D)}">${esc(fullName(p))}</a></h3><p class="tags">${p.types.map(t => `<span class="tag" style="--tc:${TYPE[t].color}">${esc(TYPE[t].label)}</span>`).join('')}</p></div>
  <dl><dt>What it runs</dt><dd>${esc(p.daysOff.summary)}</dd>
  <dt>Dates posted</dt><dd${dates.length ? ` data-day-list="${esc(JSON.stringify(dates.map(x => [x, shortDate(x)])))}"` : ''}>${dates.length ? esc(dates.map(shortDate).join(', ')) + '.' : 'None on its site when we checked. Ask which days it covers.'}</dd>
  ${programAddress(p) ? `<dt>Where</dt><dd>${esc(programAddress(p))}</dd>` : ''}
  ${served.length ? `<dt>On school days</dt><dd>${esc(servedSummary(p))}.</dd>` : ''}</dl>
  <div class="actions"><a class="btn primary" data-track="camp" href="${esc(outUrl(p.daysOff.url, { type: 'camp', program: p }))}" target="_blank" rel="noopener">Camp details</a><a class="btn" href="${link(programPath(p), D)}">Full listing</a></div>
  <p class="src">Checked ${longDate(p.lastVerified)}. Sources: ${sourceLinks(p.daysOff.sources, p)}</p>
</article>`;
  }).join('\n');
  const hero = `    <h1>${T(`School’s closed. Now what?`)}</h1>
    <p class="lede">${T(`Every day district schools are closed this year, who runs a camp on each, and a plan you can build for each child.`)}</p>
    <div class="facts">
      <span>School year <b>${esc(daysOff.schoolYear)}</b></span>
      <span>Calendar checked <b>${longDate(daysOff.checked)}</b></span>
      <span><b>${offDays.reduce((n, d) => n + d.dates.filter(y => y >= TODAY).length, 0)}</b> days off to come</span>
      <span><b>${campPrograms.length}</b> programs run something</span>
    </div>`;
  const planData = {
    year: +String(daysOff.schoolYear).slice(0, 4), schoolYear: daysOff.schoolYear,
    programs: Object.fromEntries(campPrograms.map(p => [p.id, { name: p.name, url: p.daysOff.url, href: link(programPath(p), D), color: TYPE[p.types[0]].color, hood: programHoods(p).join(', '), n: p.daysOff.dates.filter(x => x >= TODAY).length }])),
    site: cfg.siteUrl, qr: cardQr?.dayoff && cardQr.dayoff.text.toLowerCase().startsWith(cfg.siteUrl.toLowerCase() + '/') ? cardQr.dayoff.rows : null,
    days: days.map(({ note, ...x }) => x),
    page: `${cfg.siteUrl}/${offPath}`,
  };
  const body = `<div style="display:contents">
${jumpNav()}
<section class="section sum offsum needs-js-block" id="plan" data-jump-to="Your plan" data-off-plan data-clarity-mask="true">
  <h2>${T(`Your days off`)}</h2>
  <p>${T(`Choose where each child will be on each day school is closed. Your picks are saved on this device and nowhere else.`)}</p>
  <div class="sum-kids"><div class="kids" id="off-kids" role="group" aria-label="Which child"></div><button type="button" class="clear" id="off-kid-add">Add a sibling</button><button type="button" class="clear" id="off-kid-drop" hidden>Remove this child</button></div>
  <div class="sum-top off-top">
    <div class="field sum-name"><label for="off-name">${T(`First name (optional)`)}</label>
      <input id="off-name" type="text" maxlength="40" autocomplete="off"><span class="hint">${T(`Stays on this device.`)}</span></div>
    <div class="sum-tally"><div class="sum-strip" id="off-strip" aria-hidden="true"></div><p id="off-count" aria-live="polite"></p><p class="hint" id="off-open"></p></div>
  </div>
  <ol class="sum-weeks off-days" id="off-days"></ol>
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
  <script type="application/json" id="off-data">${JSON.stringify(planData).replace(/</g, '\\u003c')}</script>
</section>
<section class="section sum-chart-section" id="chart" data-jump-to="Who’s open">
  <h2>${T(`Who’s open each day off`)}</h2>
  <p>${T(`Each column is a day district schools are closed. A filled box means the program’s own site lists a camp that day. The chart scrolls sideways.`)} <span class="needs-js">${T(`Tap a box to put that day in your plan.`)}</span></p>
  <p class="sum-key"><span><i class="k exact"></i>${T(`Camp posted`)}</span><span class="needs-js"><i class="k picked"></i>${T(`In your plan`)}</span></p>
  <p class="hint" id="off-chart-note" aria-live="polite"></p>
  ${dated.length ? `<div class="sum-chart-wrap" role="region" aria-label="Who’s open each day off" tabindex="0">
    <table class="sum-chart off-chart">
      <thead><tr><th scope="col">Program</th>${head}</tr></thead>
      <tbody>
${chartRows}
      </tbody>
    </table>
  </div>` : `<p class="hint">${T(`No listed program has posted a camp date yet.`)}</p>`}
  ${noDates.length ? `<h3 class="sub">${T(`No dates posted yet`)}</h3>
  <p>${T(`These programs say they run on days off but had no dates on their sites when we checked. You can still put one on any day above, then ask whether it’s open.`)}</p>
  <ul class="plain cols">${noDates.map(p => `<li><a href="#${esc(p.id)}">${esc(p.name)}</a></li>`).join('')}</ul>` : ''}
</section>
<section class="section" id="days" data-jump-to="The days">
  <h2>${T(`Days off still to come`)}</h2>
  <p>${T(`These are the School District of Philadelphia’s dates. A program is counted only when its own site lists that date.`)}</p>
  <ul class="plain off-dates">
${offDays.map(d => { const n = campsOn(d).length; return `    <li data-until="${d.until}"><b>${d.end ? `${shortDate(d.date)} – ${shortDate(d.end)}` : dayDate(d.date)}</b> <span>${esc(d.name)}</span> <span class="pill ${n ? 'onsite' : 'nearby'}">${n ? `${n} ${n === 1 ? 'camp' : 'camps'} posted` : 'None posted yet'}</span>${d.note ? ` <span class="hint">${esc(d.note)}</span>` : ''}</li>`; }).join('\n')}
  </ul>
  <p class="src">Calendar: <a href="${esc(daysOff.source.url)}" target="_blank" rel="noopener">${esc(daysOff.source.label)}</a></p>
</section>
${datesBox(D, { pick: true, place: 'days_off', cls: 'wide', title: T(`Get a heads-up before each day off`), lede: T(`An email at least {n} days ahead, with the listed programs running a camp that day.`, { n: LEAD.dayoff }), hint: T(`Sign-up dates reach you the morning after they’re posted here, then again the day before and at about 8 that morning. Days off come in a {day} round-up.`, { day: SEND_DAY_NAME }), old: { place: 'days_off', title: T(`Get a heads-up before each day off`), lede: T(`An email at least {n} days ahead, with the listed programs running a camp that day.`, { n: LEAD.dayoff }) } })}
<section class="section" id="who" data-jump-to="Who runs camps">
  <h2>${T(`Who runs something when school is closed`)}</h2>
  <p>${T(`{n} listed programs say they run camps or full days on days off. {m} of them had no dates on their site when we checked, so ask which days they cover.`, { n: campPrograms.length, m: noDates.length })}</p>
  <div class="list">
${cards}
  </div>
</section>
<section class="notes">
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
    description: `Every day School District of Philadelphia schools are closed in ${daysOff.schoolYear}, and the after-school programs that run a camp or full-day care on those days.`,
    pathName: offPath, depth: D, current: offPath, hero, body, showStreet: 'dayoff', scripts: GROUPS ? groupsScript(D) : '',
    shareImage: { file: 'share-days-off.png', alt: `${cfg.siteName} day-off programs: a park on a morning with no school, a kite going up and a school bus parked` },
    jsonLd: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Day-camp programs', `${cfg.siteUrl}/${offPath}`]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
  });
}

// ---------- share groups (accounts, class codes) ----------
// "groups" in site.config.json turns them on. While "pilot" is true nothing links to them: the pages exist at
// /account/ and /groups/, and the block on the roster page only shows in a browser that has visited one of them.
const GROUPS = cfg.groups && cfg.contactEmail ? { photos: cfg.groups.photos === true || process.env.PAS_PHOTOS === '1', pilot: cfg.groups.pilot !== false, klaviyoList: cfg.groups.klaviyoList || '', google: /^[0-9a-z-]+\.apps\.googleusercontent\.com$/.test(cfg.groups.googleClientId || '') ? cfg.groups.googleClientId : '' } : null;
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
const claimListings = () => Object.fromEntries([
  ...programs.map(p => ['p:' + p.id, { n: fullName(p), d: baseDomain(p.website), m: claimMode(baseDomain(p.website), !!p.clubs) }]),
  ...summerCamps.map(c => ['c:' + c.id, { n: c.name + ' (summer camp)', d: baseDomain(c.website), m: claimMode(baseDomain(c.website)) }]),
]);
// Under a listing: suggest an update (anyone), and claim it (whoever runs it).
const listingTools = (key, name, depth, noun) => `<p class="listing-tools"><a class="btn" href="${link('suggest/', depth)}?kind=correction&amp;fix=${encodeURIComponent(key)}&amp;program=${encodeURIComponent(name)}">${T(`Suggest an update`)}</a>${GROUPS ? ` <span class="hint">${noun === 'camp' ? T(`Run this camp?`) : T(`Run this program?`)} <a href="${link('managers/', depth)}?l=${encodeURIComponent(key)}">${T(`Claim this listing`)}</a></span>` : ''}</p>`;
const photoSlot = key => GROUPS && !PREVIEW ? `<figure class="listing-photo" data-photo="${esc(key)}" hidden></figure>` : '';
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
    <p class="lede when-in">${T(`Sharing, invitations, your listings and signing out. What you’ve saved and what you follow are on your profile.`)}</p>`;
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
        <li><b>${T(`Put it on your phone.`)}</b> ${T(`One calendar file for the year that you can bring up to date, and a picture of any month for the fridge.`)}</li>
        <li><b>${T(`Keep every plan.`)}</b> ${T(`The week, the days off and the summer: build them on your phone tonight, find them on your laptop tomorrow.`)}</li>` : `<li><b>${T(`Keep your week.`)}</b> ${T(`Build it on your phone tonight, find it on your laptop tomorrow.`)}</li>`}
        ${ALERTS ? `<li><b>${T(`Follow and save.`)}</b> ${T(`Follow a program, a camp or your school and its sign-up dates come by email. Save favorites to find them again.`)}</li>` : ''}
        <li><b>${T(`Save your school and grades.`)}</b> ${T(`Every list starts from your school and opens on the programs that take your kids.`)}</li>
        <li><b>${T(`Share a week with one person.`)}</b> ${T(`A grandparent or a sitter signs in to see it, and you can take it back.`)}</li>${GROUPS.pilot ? '' : `
        <li><b>${T(`Share with a small group.`)}</b> ${T(`A few families you invite by email see each other’s weeks. Nobody else can find the group or ask to join.`)}</li>`}
      </ul>
      <p class="hint">${T(`It’s free. Nothing goes into your profile unless you put it there, and you can delete the account whenever you like.`)}</p>${cfg.termsLive === true ? `
      <p class="hint">${T(`Making an account means you agree to the`)} <a href="${link('terms/', 1)}">${T(`terms of use`)}</a>.</p>` : ''}
      <p class="hint">${T(`Run a program or camp?`)} <a href="${link('managers/', 1)}">${T(`Claim your listing`)}</a>${T(`. It’s the same account.`)}</p>
    </section>
  </div>
  <section class="notes">
    <h2>${T(`What an account keeps, and who sees it`)}</h2>
    <ul>
      <li>${T(`Nothing goes into your profile unless you put it there: a school, or a child’s first name and the programs on their week. No last names, addresses, notes or photos.`)}</li>
      <li>${T(`A shared week opens only for the email address you sent it to, once that person has signed in. It can’t be searched for, and its link shows nothing to anyone else.`)}</li>
      <li>${T(`You can take a week back, stop sharing, or delete your account at any time. Shared weeks delete themselves when the school year ends.`)}</li>
    </ul>
    <p><a href="${link('privacy/', 1)}#groups">${T(`The full details are on the privacy page.`)}</a></p>
  </section>
  <script type="application/json" id="groups-data">${JSON.stringify({ grades: GRADES, schools: [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => ({ id: s.id, name: s.shortName })), hoods: accountHoods(), news: NEWS.slice(0, 5) }).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: register ? 'Create a free account' : 'Your account', description: register ? `Create a free ${cfg.siteName} account to keep your week, days-off and summer plans, and see the whole year in one private calendar.` : `Sign in to ${cfg.siteName} to keep your school and week in a profile, or to share a week.`, pathName: register ? 'register/' : 'account/', depth: 1, current: null, hero, body, noindex: true, quiet: !register, scripts: groupsScript(1) });
}
// "My profile": what a signed-in person has saved and what they hear about. The page is a shell; groups.js fills it
// (the same script as the account page, told which page it is on by data-view). Signed out, it shows the log-in form.
function profilePage() {
  const hero = `    <h1><span class="when-out">${T(`Log in to see your profile`)}</span><span class="when-in">${T(`My profile`)}</span></h1>
    <p class="lede when-out">${T(`Your school, what you follow, your favorites and your plans, on any device. There’s no password to remember.`)} ${T(`New here?`)} <a href="${link('register/', 1)}">${T(`Create a free account`)}</a></p>
    <p class="lede when-in">${T(`What you’ve told us, what you follow and what you’ve saved, in one place. Change any of it here.`)}</p>`;
  const body = `<div ${groupsAttrs(1)} data-clarity-mask="true" style="display:contents">
  <noscript><p class="ask">${T(`Your profile needs JavaScript turned on.`)}</p></noscript>
  <div class="g-page" id="account" data-view="profile"></div>
  <script type="application/json" id="groups-data">${JSON.stringify({ grades: GRADES, schools: [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => ({ id: s.id, name: s.shortName })), hoods: accountHoods(), news: NEWS.slice(0, 5) }).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: 'My profile', description: `Your ${cfg.siteName} profile: your school, what you follow, your favorites and your plans.`, pathName: 'profile/', depth: 1, current: null, hero, body, noindex: true, quiet: true, scripts: groupsScript(1) });
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
const CLAIM_GETS = () => [
  ['dates', T(`Keep your dates current.`), T(`Post sign-up openings, deadlines, term dates and camp days as soon as you set them, instead of waiting for us to find them.`)],
  ['space', T(`Say whether there’s space.`), T(`Mark your listing “Spots open”, “Waitlist” or “Full”. It shows to parents straight away, with the date.`)],
  ['numbers', T(`See your numbers.`), T(`How many times your listing was opened this month, how many clicks went on to your sign-up page and website, and how many families put you on a plan.`)],
  ['costs', T(`Fix your costs and hours.`), T(`When a price or a pickup time changes, send it once and the listing follows.`)],
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
            <dt>${T(`Hours`)}</dt><dd>${T(`Monday to Thursday, dismissal to 6 pm`)}${at.costs}</dd>
            <dt>${T(`Cost`)}</dt><dd>${T(`$95 a week, with a sibling discount`)}</dd>
            <dt>${T(`Dates`)}</dt><dd><b>${T(`Winter term sign-up opens November 12`)}</b>${at.dates}<br><span class="demo-link">${T(`Add to calendar`)}</span></dd>
          </dl>
          <p class="demo-actions"><span class="btn primary">${T(`Sign up`)}</span><span class="btn">${T(`Website`)}</span></p>
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
  <div class="g-page" id="claims" data-clarity-mask="true"${GROUPS.photos ? ' data-photos="1"' : ''}></div>
  <script type="application/json" id="claims-data">${JSON.stringify(Object.entries(L).map(([k, v]) => [k, v.n, v.d, v.m === 'match' ? 1 : 0])).replace(/</g, '\\u003c')}</script>
  <section class="section" id="why">
    <h2>${T(`What claiming gets you`)}</h2>
    <p>${T(`Your listing is already on the site, and parents are already reading it. Claim it and it becomes yours to keep right.`)}</p>
    <div class="claim-show">
      ${claimDemo()}
      ${claimBenefits()}
    </div>
  </section>
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
      <li>${T(`Listings are free and stay free. Nobody pays to be listed or to be ranked higher.`)}${GROUPS.photos ? '' : ' ' + T(`Paid extras, such as a photo at the top of your listing, are planned for later.`)}</li>
      <li>${T(`Not on the site yet?`)} <a href="${link('suggest/', 1)}">${T(`Suggest your program`)}</a> ${T(`or`)} <a href="${link('suggest/', 1)}?kind=camp">${T(`your camp`)}</a>${T(`, with its website, and claim it once it’s up.`)}</li>
    </ul>
    <p><a href="${link('privacy/', 1)}#managers">${T(`What we keep about a claim is on the privacy page.`)}</a></p>
  </section>
</div>`;
  return layout({ title: 'For program managers: find and claim your listing', description: `Run an after-school program or camp in Philadelphia? Find your ${cfg.siteName} listing, claim it with your work email, and keep its dates, costs and hours up to date. Free.`, pathName: 'managers/', depth: 1, current: null, hero, body, scripts: groupsScript(1) });
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
    <h3>${e('$name($x["listing"])')}</h3>
    <p class="hint">From ${e('$x["first"] . " " . $x["last"]')} &lt;${e('$x["email"]')}&gt;, ${e('$day($x["created"])')}. They ticked that they have the right to use it and permission from the families of any children shown.</p>
    <p><img class="review-photo" src="./?photo=<?php echo (int) $x["id"]; ?>" alt=""></p>
    <p>Described as: <b>${e('$x["alt"]')}</b></p>
    ${form('$x["id"]', act('photo_ok', 'Publish the photo', 'btn primary') + act('photo_no', 'Decline'))}
  </div><?php } ?>
  <?php if ($photosLive) { ?><h2>Photos on the site (<?php echo count($photosLive); ?>)</h2>
  <div class="review-grid"><?php foreach ($photosLive as $x) { ?><div class="panel"><p><img class="review-photo" src="./?photo=<?php echo (int) $x["id"]; ?>" alt=""></p><p><b>${e('$name($x["listing"])')}</b><br><span class="hint">${e('$x["alt"]')}</span></p>${form('$x["id"]', act('photo_no', 'Take it down'))}</div><?php } ?></div><?php } ?>

  <h2>Claimed listings (<?php echo count($claims); ?>)</h2>
  <?php if (!$claims) { ?><p class="hint">None yet.</p><?php } else { ?>
  <div class="stat-scroll"><table class="stat-table"><thead><tr><th scope="col">Listing</th><th scope="col">Who</th><th scope="col">Since</th><th scope="col"></th></tr></thead><tbody>
  <?php foreach ($claims as $c) { ?><tr><th scope="row">${e('$name($c["listing"])')}</th><td>${e('$c["first"] . " " . $c["last"]')}<br><span class="hint">${e('$c["email"]')}</span></td><td>${e('$day($c["created"])')}</td><td>${form('$c["id"]', act('claim_remove', 'Take the claim away'))}</td></tr><?php } ?>
  </tbody></table></div>
  <?php } ?>
  <?php if ($declined) { ?><h2>Declined or taken away (<?php echo count($declined); ?>)</h2>
  <ul><?php foreach ($declined as $c) { ?><li>${e('$name($c["listing"])')}: ${e('$c["first"] . " " . $c["last"]')} &lt;${e('$c["email"]')}&gt; ${form('$c["id"]', act('claim_ok', 'Let it stand after all'))}</li><?php } ?></ul><?php } ?>
<?php } ?>
  <p><a class="btn" href="../">Back to editing</a> <a class="btn" href="../?out=1">Sign out</a></p>
</div>`;
  const page = layout({ title: 'Claims and proposed changes', description: 'Claims on listings and the changes program managers have proposed.', pathName: 'edit/claims/', depth: 2, current: null, hero, body, noindex: true, quiet: true });
  const names = JSON.stringify(Object.fromEntries(Object.entries(claimListings()).map(([k, v]) => [k, v.n]))).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `<?php
// The owner's review page for listing claims. Generated by build.mjs; edit it there.
${editAuthPhp()}
if (!edit_signed_in()) { header('Location: ../', true, 303); exit; }
$SITE = ${JSON.stringify(cfg.siteName)};
$SITE_URL = ${JSON.stringify(cfg.siteUrl)};
$FROM = ${JSON.stringify(cfg.contactEmail)};
$NAMES = json_decode('${names}', true);
$name = function ($key) use ($NAMES) { return isset($NAMES[$key]) ? $NAMES[$key] : $key . ' (no longer on the site)'; };
$day = function ($t) { $d = new DateTime('@' . (int) $t); $d->setTimezone(new DateTimeZone('America/New_York')); return $d->format('M j, Y'); };
$csrf = hash_hmac('sha256', 'claims-form', edit_key());
$said = isset($_GET['said']) && is_string($_GET['said']) ? substr($_GET['said'], 0, 200) : '';
$file = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-data/groups.sqlite';
$have = is_file($file);
$pending = array(); $claims = array(); $declined = array(); $edits = array(); $photosNew = array(); $photosLive = array();
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
  @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $text . "\\n\\n" . $SITE, implode("\\r\\n", array('From: ' . $SITE . ' <' . $FROM . '>', 'Reply-To: ' . $FROM, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8')));
}
if ($have && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $ok = isset($_POST['csrf']) && is_string($_POST['csrf']) && hash_equals($csrf, $_POST['csrf']);
  $do = isset($_POST['do']) && is_string($_POST['do']) ? $_POST['do'] : '';
  $id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
  $msg = 'That didn’t go through. Try again.';
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
      $st = $db->prepare('SELECT p.id, p.listing, p.status, u.email, u.first FROM photos p JOIN claims c ON c.id = p.claim_id JOIN users u ON u.id = c.user_id WHERE p.id = ?'); $st->execute(array($id)); $x = $st->fetch();
      if ($x) {
        $n = $name($x['listing']);
        if ($do === 'photo_ok') {
          $db->prepare("UPDATE photos SET status = 'declined', decided = ? WHERE listing = ? AND status = 'ok' AND id != ?")->execute(array(time(), $x['listing'], $id));   // one photo a listing
          $db->prepare("UPDATE photos SET status = 'ok', decided = ? WHERE id = ?")->execute(array(time(), $id));
          tell($x['email'], 'Your photo for ' . $n . ' is on the site', 'Hi ' . $x['first'] . ",\n\nThe photo you sent for “" . $n . '” is on the listing now. You can replace or remove it here:' . "\n" . $SITE_URL . '/managers/');
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
  header('Location: ./?said=' . rawurlencode($msg), true, 303);
  exit;
}
if ($have) {
  $all = $db->query('SELECT c.id, c.listing, c.status, c.domain, c.created, u.email, u.first, u.last FROM claims c JOIN users u ON u.id = c.user_id ORDER BY c.id DESC')->fetchAll();
  foreach ($all as $c) { if ($c['status'] === 'pending') $pending[] = $c; elseif ($c['status'] === 'ok') $claims[] = $c; else $declined[] = $c; }
  $edits = $db->query("SELECT e.id, e.listing, e.body, e.link, e.created, u.email, u.first, u.last FROM edits e JOIN claims c ON c.id = e.claim_id JOIN users u ON u.id = c.user_id WHERE e.status = 'new' ORDER BY e.id")->fetchAll();
  try {
    foreach ($db->query("SELECT p.id, p.listing, p.alt, p.status, p.created, u.email, u.first, u.last FROM photos p JOIN claims c ON c.id = p.claim_id JOIN users u ON u.id = c.user_id WHERE p.status != 'declined' AND c.status = 'ok' ORDER BY p.id") as $x) { if (!is_file($photoFile($x['id']))) continue; if ($x['status'] === 'new') $photosNew[] = $x; else $photosLive[] = $x; }
  } catch (Exception $e) { /* a database from before photos */ }
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
  const conf = JSON.stringify({ siteName: cfg.siteName, siteUrl: cfg.siteUrl, from: cfg.contactEmail, yearEnd: end, googleClientId: GROUPS.google, grades: GRADES, listings: claimListings(), camps: summerCamps.map(c => c.id), photos: GROUPS.photos, hoods: Object.fromEntries(accountHoods().map(h => [h.id, h.name])) });
  const src = fs.readFileSync(path.join(ROOT, 'src/server/groups-api.php'), 'utf8');
  if (!src.includes(`'/*CONFIG*/'`)) throw new Error('src/server/groups-api.php has lost its /*CONFIG*/ marker');
  return src.replace(`'/*CONFIG*/'`, () => `'` + conf.replace(/\\/g, '\\\\').replace(/'/g, `\\'`) + `'`);
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
    <p class="lede">${T(`Monday might be martial arts and Thursday the rec center. Plan the term that’s coming, keep a second roster for what your child is doing now, and send either to your partner, a sitter, or the group chat. More than one child? Each gets their own.`)}</p>`;
  const body = `<div data-board-page data-clarity-mask="true" style="display:contents">
  <noscript><p class="ask">${T(`The roster needs JavaScript turned on.`)}</p></noscript>
  <div class="panel" id="board-retired" data-edit-reveal="Shown when someone opens an old link to a week:" hidden>
    <h2>${T(`That link doesn’t open a week any more`)}</h2>
    <p>${T(`Weeks used to be shared as a link that anyone could open. They aren’t now. Ask the person who sent it to share the week with your email address instead: you’ll get an invitation, and it will open once you sign in.`)}</p>
    <div class="actions"><button type="button" class="btn" id="board-retired-ok">OK</button></div>
  </div>
  <section class="section">
    <div class="kid-bar" id="kid-bar">
      <div class="kids" id="kid-tabs" role="group" aria-label="Which child" hidden></div>
      <div class="field">
        <label for="board-name">${T(`Child’s name`)}</label>
        <input id="board-name" type="text" maxlength="40" placeholder="Sam" autocomplete="off">
        <span class="hint">${T(`Optional. It shows on the roster you share.`)}</span>
      </div>
      <div class="actions"><button type="button" class="btn" id="kid-add">Add another child</button><button type="button" class="clear" id="kid-remove" hidden>Remove this child</button></div>
    </div>
    <div class="tabs" id="board-tabs" role="group" aria-label="Current or upcoming roster">
      <button type="button" class="tab" data-board="next" aria-pressed="true">Upcoming</button>
      <button type="button" class="tab" data-board="now" aria-pressed="false">Current</button>
    </div>
    <h2 id="board-title">Your upcoming week</h2>
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
  </section>
  <section class="section costbox" id="board-cost" hidden>
    <h2>${T(`What this roster costs`)}</h2>
    <p class="cost-total" id="cost-total"></p>
    <p id="cost-month"></p>
    <ul class="cost-lines" id="cost-lines"></ul>
    <p class="cost-family" id="cost-family" hidden></p>
    <p class="hint">${T(`An estimate from each program’s published prices, for half a school year: 18 weeks of school, or five monthly bills. It leaves out registration fees, deposits, materials, sibling discounts, subsidies and financial aid. If you know what you’ll pay, add it to any line; it stays on this device. Confirm the price with each program before you budget on it.`)}</p>
  </section>
  ${nextOff(1).replace(T(`Days off this year, and who’s open`), T(`Plan the days off too`))}
  ${ALERTS ? `<p class="hint alerts-line">${T(`Want next term’s sign-up dates before they open?`)} <a href="${link(alertsPath, 1)}">${T(`Get the dates by email.`)}</a></p>` : ''}
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
          <a class="btn primary" href="#group-share">${T(`Save or share this week`)}</a>
        </div>` : ''}
      </div>
      <div class="card-preview"><canvas id="card-canvas" width="1080" height="1350" role="img" aria-label="Preview of the week card"></canvas></div>
    </div>
  </section>
  ${GROUPS ? `<section class="section group-share" id="group-share" ${groupsAttrs(1)} hidden></section>` : ''}
  <script type="application/json" id="pas-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: 'Build your week', description: `Put together a Monday to Friday after-school roster for each child from ${cfg.siteName} listings and turn it into a card to share.`, pathName: 'board/', depth: 1, current: 'board/', hero, body,
    // An old shared-roster link carries a child's first name after the #. Those links are retired, but one may still be
    // opened. This runs before any analytics loads: it notes that one arrived and takes it out of the address.
    scripts: GROUPS ? groupsScript(1) : '',
    first: `<script>(function(){var h=location.hash;if(!/(^#|&)(mon|tue|wed|thu|fri)=/.test(h))return;window.__pasShared=h;try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}})();</script>\n` });
}

function reviewPage() {
  const progOpts = [...programs].sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  const schoolOpts = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `<option value="${esc(s.id)}">${esc(s.shortName)}</option>`).join('');
  const hero = `    <h1>${T(`How did it go?`)}</h1>
    <p class="lede">${T(`A first-hand note from one family helps the next one choose. Every review is read before it’s posted.`)}</p>`;
  const body = `<div class="suggest">
  <form class="form panel" method="post" action="send.php" id="review-form" data-clarity-mask="true">
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
  return layout({ title: 'Thanks for your review', description: 'Your review was sent.', pathName: 'review/thanks/', depth: 2, current: null, hero, body: '', showStreet: 'parked', noindex: true });
}

// Review form handler. Emails the review with a ready-to-paste entry for data/reviews.json.
function reviewPhp() {
  const phpList = arr => 'array(' + arr.map(x => JSON.stringify(x)).join(', ') + ')';
  return `<?php
// Receives the "Write a review" form. Generated by build.mjs; edit it there.
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

$sent = @mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\\r\\n", $headers));
$log = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-reviews.log';
$saved = @file_put_contents($log, date('c') . ($sent ? ' (emailed)' : ' (EMAIL FAILED)') . "\\n" . $body . "----\\n", FILE_APPEND | LOCK_EX);

if (!$sent && $saved === false) {
  fail('Something went wrong on our side. Please email ' . $TO . ' instead.', 500);
}
header('Location: thanks/', true, 303);
exit;
`;
}

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
function edit_signed_in() {
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
  </form>
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
  header('Location: ./', true, 303);
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
$cols = array('account' => 'New accounts', 'account_parent' => 'New accounts: parents', 'account_manager' => 'New accounts: program managers', 'signin_email' => 'Sign-ins by email', 'signin_google' => 'Sign-ins with Google', 'week_saved' => 'Weeks kept', 'summer_saved' => 'Summers kept', 'daysoff_saved' => 'Days-off plans kept', 'school_saved' => 'Schools kept', 'grades_saved' => 'Grades kept', 'hood_saved' => 'Neighborhoods kept', 'phone_saved' => 'Phone numbers added for texts', 'follow' => 'Follows started', 'stop_one' => 'Listings stopped from an email', 'stop_all' => 'Everything stopped from an email', 'fav' => 'Favorites saved', 'share' => 'Weeks shared with one person', 'group' => 'Groups started', 'invite' => 'Invitations', 'join' => 'Invitations accepted', 'account_deleted' => 'Accounts deleted', 'claim' => 'Listings claimed', 'space_set' => 'Times a manager said whether there’s space', 'claim_pending' => 'Claims sent for approval', 'claim_mismatch' => 'Claims refused: address didn’t match', 'edit_proposed' => 'Changes proposed by program managers', 'photo_sent' => 'Photos sent by program managers');
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

function editPage() {
  const pages = [['', 'Home'], ['schools/', 'Schools'], ['schools/request/', 'A school that isn’t covered yet'], ...schools.map(s => [s.id + '/', `${s.shortName} page`]), ['types/', 'Program types'], [`types/${liveTypes()[0].id}/`, `A type page (${liveTypes()[0].label})`], ['programs/', 'All programs, A to Z'], ['neighborhoods/', 'Neighborhoods'], [hoodPath(hoods[0]), `A neighborhood page (${hoods[0].name})`], [programPath(programs[0]), `A program page (${programs[0].name})`],
    ['board/', 'Build your week'], ['suggest/', 'Suggest a program'], ['suggest/thanks/', 'Thank-you page after a suggestion'], ['ideas/', 'Request a feature'], ['ideas/thanks/', 'Thank-you page after an idea'], ['review/', 'Write a review'], ['review/thanks/', 'Thank-you page after a review'],
    ['about/', 'About'], ['privacy/', 'Privacy'], ['support/', 'Buy me a coffee'], ...(PREVIEW ? [] : [['404.html', 'Page not found']])];
  const hero = `    <h1>Edit the words on this site</h1>
    <p class="lede">Turn on editing, then click a sentence on any page and type. Nothing changes for visitors until your edits are sent and approved.</p>`;
  const body = `<div class="prose" data-edit-page>
  <div class="panel">
    <h2 id="edit-state">Editing is off</h2>
    <p id="edit-state-text">Turn it on and a bar appears at the bottom of every page.</p>
    <div class="actions"><button type="button" class="btn primary big needs-js" id="edit-start">Start editing</button><button type="button" class="btn needs-js" id="edit-stop" hidden>Stop editing</button></div>
    <noscript><p>Editing needs JavaScript turned on.</p></noscript>
  </div>${GATED ? '\n  <p class="hint">You’re signed in on this device for 30 days. <a href="?out=1">Sign out</a></p>' : ''}${GATED && GROUPS ? '\n  <p><a class="btn" href="stats/">Site numbers: accounts, shared weeks and groups</a> <a class="btn" href="claims/">Claims and proposed changes</a></p>' : ''}
  <h2>How it works</h2>
  <ol>
    <li>Click any text with a dotted outline and type. Text you’ve changed turns yellow.</li>
    <li>Move between pages with the menu or the list below. Your edits are kept in this browser as you go, so stay on the same phone or computer until you’ve sent them.</li>
    <li>Choose “Review and send” in the bar at the bottom. You’ll see each change next to the original and can undo any of them.</li>
    <li>Sending emails the changes to be approved. They appear on the site once they’re published.</li>
  </ol>
  <h2>Pages</h2>
  <ul>
    ${pages.map(([to, label]) => `<li><a href="${link(to, 1)}">${esc(label)}</a></li>`).join('\n    ')}
  </ul>
  <h2>What can’t be edited here</h2>
  <ul>
    <li>Program details: names, descriptions, hours and costs come from the listings data. Send fixes for those through <a href="${link('suggest/', 1)}">the suggestion form</a>.</li>
    <li>Menu labels, text that changes as you click (filter counts, the roster), the grey example text inside boxes, and the choices inside drop-downs.</li>
    <li>Words in curly braces, like {school}, are filled in for each page. Leave them in the sentence.</li>
  </ul>
</div>`;
  return layout({ title: 'Edit the copy', description: 'Edit the words on this site.', pathName: 'edit/', depth: 1, current: null, hero, body, noindex: true });
}

// Receives edits as JSON, emails a readable list plus a complete data/copy.json to paste in.
// Nothing is published from here: the site only changes when copy.json is committed.
function editPhp() {
  const original = Object.fromEntries(copyRegistry);
  const overrides = Object.fromEntries(Object.entries(copyEdits).filter(([id]) => copyRegistry.has(id)));
  const nowdoc = o => "json_decode(<<<'PAS_JSON'\n" + JSON.stringify(o) + "\nPAS_JSON\n, true)";
  return `<?php
// Receives copy edits made in edit mode. Generated by build.mjs; edit it there.
$TO = ${JSON.stringify(cfg.contactEmail)};
$SITE = ${JSON.stringify(cfg.siteName)};
$REPO = ${JSON.stringify(cfg.repo || '')};
$ORIGINAL = ${nowdoc(original)};
$OVERRIDES = ${nowdoc(overrides)};
${GATED ? editAuthPhp() : ''}
function out($ok, $msg, $code) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(array('ok' => $ok, 'message' => $msg));
  exit;
}
function tidy($v, $max) {
  if (!is_string($v)) return '';
  $v = strip_tags(str_replace(chr(0), '', $v));
  $v = trim(preg_replace('/\\s+/u', ' ', $v));
  return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  out(false, 'Use the editor on the site.', 405);
}
${GATED ? `if (!edit_signed_in()) {
  out(false, 'You are signed out.', 401);
}
` : ''}$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in) || !isset($in['edits']) || !is_array($in['edits'])) {
  out(false, 'There was nothing to send.', 400);
}
// A hidden field people never fill in. If it has a value, a bot did it: act as if it worked.
if (isset($in['company']) && $in['company'] !== '') {
  out(true, 'Sent.', 200);
}

$name = tidy(isset($in['name']) ? $in['name'] : '', 60);
$note = tidy(isset($in['note']) ? $in['note'] : '', 1000);
$merged = is_array($OVERRIDES) ? $OVERRIDES : array();
$lines = array();
$n = 0;
foreach (array_slice($in['edits'], 0, 300) as $e) {
  if (!is_array($e) || !isset($e['id']) || !is_string($e['id']) || !isset($ORIGINAL[$e['id']])) continue;
  $id = $e['id'];
  $now = tidy(isset($e['now']) ? $e['now'] : '', 800);
  $shown = isset($merged[$id]['now']) ? $merged[$id]['now'] : $ORIGINAL[$id];
  if ($now === '' || $now === $shown) continue;
  $page = tidy(isset($e['page']) ? $e['page'] : '', 120);
  $n++;
  $line = "$n." . ($page !== '' ? " On $page" : '') . "\\n   Was: $shown\\n   Now: $now\\n";
  if (preg_match_all('/\\{\\w+\\}/', $ORIGINAL[$id], $m)) {
    foreach (array_unique($m[0]) as $token) {
      if (strpos($now, $token) === false) $line .= "   CHECK: the original has $token, which is filled in for each page. The new wording leaves it out.\\n";
    }
  }
  $lines[] = $line;
  if ($now === $ORIGINAL[$id]) unset($merged[$id]);
  else $merged[$id] = array('was' => $ORIGINAL[$id], 'now' => $now);
}
if ($n === 0) {
  out(false, 'Those changes are already on the site, or this page is out of date. Refresh the page and check.', 400);
}

$json = count($merged) ? json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '{}';
$body = "Copy edits" . ($name !== '' ? " from $name" : '') . ": $n " . ($n === 1 ? 'change' : 'changes') . ".\\n\\n"
  . ($note !== '' ? "Note: $note\\n\\n" : '')
  . implode("\\n", $lines)
  . "\\nTo publish all of them, replace everything in data/copy.json with the text between the two lines below, then commit.\\n"
  . ($REPO !== '' ? "https://github.com/$REPO/edit/main/data/copy.json\\n" : '')
  . "It already includes edits approved earlier. To leave one out, delete its entry before you paste.\\n\\n"
  . "-----8<----- copy.json starts on the next line\\n"
  . $json . "\\n"
  . "-----8<----- copy.json ended on the line above\\n";

$subject = "[$SITE] Copy edits" . ($name !== '' ? " from $name" : '') . " ($n)";
$headers = array(
  'From: ' . $SITE . ' <' . $TO . '>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
);
$sent = @mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', chunk_split(base64_encode($body)), implode("\\r\\n", $headers));
$log = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-copy-edits.log';
@file_put_contents($log, date('c') . ($sent ? ' (emailed)' : ' (EMAIL FAILED)') . "\\n" . $body . "----\\n", FILE_APPEND | LOCK_EX);

if (!$sent) {
  out(false, 'The email did not go out.', 500);
}
out(true, 'Sent.', 200);
`;
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
  ['South Philly', ['Queen Village', 'Bella Vista', 'Passyunk Square', 'East Passyunk', 'Pennsport', 'Dickinson Narrows', 'Hawthorne', 'Graduate Hospital', 'South Philadelphia']],
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
      cta: btn(link(offPath, D) + '#plan', T(`Plan the days off`), 'daysoff') }) : '',
    summerCamps.length ? card({ k: 'sun', artKey: 'sum', id: 'summer', color: '#2C8444', kicker: T(`{n} weeks of summer`, { n: weeks }), name: T(`Build your summer`),
      text: T(`The weeks between the last day of school and Labor Day, and which of {n} camps run in each one.`, { n: summerCamps.length }),
      points: [T(`See on one chart which camps run each week`), T(`Line up a camp for every week, child by child, and see what it adds up to`), T(`Make it a calendar picture, or put the weeks in your phone’s calendar`)],
      cta: btn(link(summerPath, D), T(`Plan your summer`), 'summer') }) : '',
    YEAR_PAGE ? card({ k: 'year', artKey: 'year', id: 'year', color: '#6B3FA0', kicker: T(`With a free account`), name: T(`My kids’ calendar`),
      text: T(`The three plans above, added up: the school week, every day off, the camp weeks and the sign-up dates, in date order for the whole year.`),
      points: [T(`One calendar file for your phone, which you can bring up to date later`), T(`Room for your own dates: picture day, pretzel day, a form that’s due`), T(`A picture of any month to send or print`), T(`Private: it has no link, and only you can open it`)],
      cta: `<span class="when-out">${btn(link('register/', D) + '?next=calendar', T(`Create a free account`), 'year_register')}</span><span class="when-in">${btn(link(yearPath, D), T(`Open my kids’ calendar`), 'year')}</span>` }) : '',
  ].filter(Boolean);
  const hero = `    <h1>${T(`Build a schedule`)}</h1>
    <p class="lede">${T(`Three planners, one for each part of a family’s year: the school week, the days school is closed, and the summer. All three are free and work without an account.`)}</p>`;
  const body = `<section class="section" id="planners">
  <div class="plans">
    ${cards.join('\n    ')}
  </div>
</section>
<section class="notes">
  <h2>${T(`How the planners work`)}</h2>
  <ul>
    <li>${T(`Nothing to put on a plan yet?`)} <a href="${link('schools/', D)}">${T(`Find your school`)}</a> ${T(`to see what works with it, or`)} <a href="${link('programs/', D)}">${T(`look through every program`)}</a>.</li>
    <li>${T(`A plan stays on the phone or computer you made it on. Nothing about your child is sent to us.`)}</li>${GROUPS ? `
    <li>${T(`With a free account you can keep each plan in your profile, so it’s on every device you sign in on.`)} <a class="when-out" href="${link('register/', D)}">${T(`Create a free account`)}</a></li>` : ''}
    <li>${T(`Days, hours and prices come from each program’s own website. Check with the program before you count on a spot.`)}</li>
  </ul>
</section>`;
  return layout({ title: 'Build a schedule: the week, days off and summer', description: `Free planners for Philadelphia families: build the after-school week, plan the days school is closed, and line up summer camps week by week.`, pathName: schedulesPath, depth: D, current: schedulesPath, hero, body });
}

function calendarPage() {
  const D = 1, P = summerCamps.length ? summerPlan : null;
  const shortHours = c => String(c.hours || '').split(/\. /)[0].replace(/\.$/, '');
  const data = {
    year: +String(daysOff.schoolYear).slice(0, 4), schoolYear: daysOff.schoolYear, lastDay: daysOff.lastDay || '', site: cfg.siteUrl,
    board: link('board/', D), offPage: link(offPath, D), sumPage: link(summerPath, D),
    offDays: offDays.flatMap((d, bi) => d.dates.filter(x => x >= TODAY).map(x => ({ d: x, name: d.name, b: bi }))),
    // every listing a week or a day off can name: its name, its page, the sign-up dates it has posted, and the days off it posted a camp for
    programs: Object.fromEntries(programs.map(p => [p.id, { n: p.name, href: link(programPath(p), D), dates: upcomingDates(p).map(d => ({ date: d.date, label: d.label })), ...(p.daysOff ? { off: p.daysOff.dates.filter(x => x >= TODAY), url: p.daysOff.url } : {}) }])),
    summer: P ? {
      year: summerYear, weeks: P.weeks.map(w => ({ d: w, label: P.label(w) })),
      camps: Object.fromEntries(P.camps.map(({ c, on, exact }) => [c.id, { n: c.name, w: on, x: exact ? 1 : 0, y: c.season || 0, h: shortHours(c), href: link(campPath(c), D), dates: (c.dates || []).filter(d => d.date >= TODAY).map(d => ({ date: d.date, label: d.label })) }])),
    } : null,
  };
  const hero = `    <h1>${T(`My kids’ calendar`)}</h1>
    <p class="lede">${T(`Everything you’ve planned for the school year and the summer, in one place: the after-school week, every day off, camp weeks and sign-up dates. Only you can see it.`)}</p>`;
  const body = `<div ${groupsAttrs(D)} data-year-page data-clarity-mask="true" style="display:contents">
  <noscript><p class="ask">${T(`The calendar needs JavaScript turned on.`)}</p></noscript>
  <section class="section year-out" id="year-out">
    <h2>${T(`The whole year, lined up`)}</h2>
    <p>${T(`Sign in and what you’ve planned comes together on one page, on any device.`)}</p>
    <ul class="rules ticks">
      <li>${T(`Every day school is closed, with where each child will be.`)}</li>
      <li>${T(`The summer, week by week.`)}</li>
      <li>${T(`Sign-up openings and deadlines for the programs and camps you chose.`)}</li>
      <li>${T(`Your own dates: picture day, pretzel day, a form that’s due.`)}</li>
      <li>${T(`A calendar picture for each month, and a file that puts it all in your phone’s calendar.`)}</li>
    </ul>
    <div class="actions"><a class="btn primary big" href="${link('register/', D)}?next=calendar">${T(`Create a free account`)}</a><a class="btn big" href="${link('account/', D)}?next=calendar">${T(`Log in`)}</a></div>
    <p class="hint">${T(`It’s private. There is no link to your calendar and no way to share it from here: a picture or a file you save is yours to send.`)}</p>
    <p class="hint">${T(`Planning doesn’t need an account:`)} <a href="${link('board/', D)}">${T(`build a week`)}</a>, <a href="${link(offPath, D)}#plan">${T(`plan the days off`)}</a>${P ? `, <a href="${link(summerPath, D)}">${T(`plan the summer`)}</a>` : ''}.</p>
  </section>
  <p class="hint when-in" id="year-wait">${T(`Getting your calendar…`)}</p>
  <section class="section sum year needs-js-block" id="year" hidden>
    <h2 id="year-h">${T(`The year`)}</h2>
    ${jumpNav()}
    <ul class="year-src" id="year-src"></ul>
    <div class="year-own" id="year-own" data-jump-to="Your own dates">
      <h3>${T(`Add your own dates`)}</h3>
      <p>${T(`Picture day, pretzel day, a form that’s due, a half day: anything you need to remember, for one child or for everyone. They show up in the calendar below, in the pictures and in the file for your phone.`)}</p>
      <form class="own-form" id="own-form">
        <div class="field own-what"><label for="own-what">${T(`What`)}</label><input id="own-what" type="text" maxlength="60" list="own-ideas" placeholder="Picture day" autocomplete="off"></div>
        <datalist id="own-ideas">${['Picture day', 'Pretzel day', 'Early dismissal', 'Form due', 'Field trip', 'Library day', 'Gym day', 'Show and tell', 'Bring a snack', 'Dress-down day', 'Concert', 'Parent conference'].map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <div class="field"><label for="own-when">${T(`When`)}</label><input id="own-when" type="date"></div>
        <div class="field"><label for="own-rep">${T(`How often`)}</label><select id="own-rep"><option value="">Just that day</option><option value="w">Every week on that day</option></select></div>
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
    <div class="flag year-changed" id="year-changed" hidden></div>
    <div id="year-empty" hidden></div>
    <div id="year-full">
      <div class="year-file" id="year-file" data-jump-to="Phone calendar">
        <h3>${T(`Put it in your phone’s calendar`)}</h3>
        <p>${T(`One file with everything ticked below. Open it and your calendar app adds the entries. It’s a copy: if a date changes later, this page will say so, and you download it again.`)}</p>
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
      <div id="year-week" data-jump-to="School week"></div>
      <div id="year-agenda" data-jump-to="Month by month"></div>
      <div class="card-maker sumcard" id="year-card" data-jump-to="Pictures" hidden>
        <h3>${T(`Make it a picture`)}</h3>
        <p>${T(`A calendar for each month, to print for the fridge or send to family. It’s made here in your browser.`)}</p>
        <div class="card-grid">
          <div class="card-fields">
            <div class="sum-pages" id="year-pages" role="group" aria-label="Which calendar"></div>
            <div class="field">
              <label for="year-title">${T(`Title`)}</label>
              <input id="year-title" type="text" maxlength="40" placeholder="Our year" autocomplete="off">
            </div>
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
  </section>
  <script type="application/json" id="year-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({
    title: 'My kids’ calendar', description: `A private calendar of everything you’ve planned on ${cfg.siteName}: the after-school week, days off, summer camps and sign-up dates.`,
    pathName: yearPath, depth: D, current: null, hero, body, noindex: true, quiet: true, scripts: groupsScript(D),
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
  <th scope="row"><a href="${link(campPath(c), D)}">${esc(c.name)}</a><small>${[ageLine(c), price(c), exact ? `${year} dates` : `${c.season} dates`].filter(Boolean).map(esc).join(' · ')}</small></th>
  ${P.weeks.map((w, i) => on.includes(i) ? `<td class="on${exact ? ' exact' : ''}" data-w="${i}"><span class="vh">${exact ? 'Runs' : 'Ran in ' + c.season}</span></td>` : `<td data-w="${i}"></td>`).join('')}
</tr>`).join('\n');
  const data = {
    year, base, page: `${cfg.siteUrl}/${summerPath}`, campsPage: link(campsPath, D), campUrl: link(`${campsPath}CAMP-ID/`, D),
    weeks: P.weeks.map((w, i) => ({ d: w, label: P.label(w), note: schoolNote(i) })),
    camps: Object.fromEntries(P.camps.map(({ c, on, exact }) => [c.id, { n: c.name, w: on, y: c.season || 0, x: exact ? 1 : 0, p: typeof c.weekly === 'number' ? c.weekly : null, h: shortHours(c), a: [c.ageMin || 0, c.ageMax || 99], hood: (c.neighborhoods || []).join(', ') }])),
  };
  const hero = `    <h1>${T(`Plan your summer, week by week`)}</h1>
    <p class="lede">${T(`{n} weeks between the last day of school and Labor Day. See which camps run each week, and line up your own summer.`, { n: P.weeks.length })}</p>
    <div class="facts">
      <span>Summer <b>${year}</b></span>
      <span><b>${P.weeks.length}</b> weeks</span>
      <span><b>${P.dated.length}</b> camps with dates</span>
    </div>`;
  const body = `<div style="display:contents">
${guide ? `<section class="section">
  <p class="flag camp-guide"><b>${T(`Most of these dates are from summer {year}, shown as a guide.`, { year: base })}</b> ${T(`A camp that hasn’t posted {next} yet is shown on the weeks it ran last summer, moved to the same week of the calendar. Camps usually post between December and March, and each one switches to its real dates when it does.`, { next: year })}</p>
</section>` : ''}
${jumpNav()}
<section class="section sum needs-js-block" id="plan" data-jump-to="Your summer" data-summer data-clarity-mask="true">
  <h2>${T(`Your summer`)}</h2>
  <p>${T(`Add a camp to each week, for one child or for each of them. Your picks are saved on this device and nowhere else.`)}</p>
  <div class="sum-kids"><div class="kids" id="sum-kids" role="group" aria-label="Which child"></div><button type="button" class="clear" id="sum-kid-add">Add a sibling</button><button type="button" class="clear" id="sum-kid-drop" hidden>Remove this child</button></div>
  <div class="sum-top">
    <div class="field sum-name"><label for="sum-name">${T(`First name (optional)`)}</label>
      <input id="sum-name" type="text" maxlength="40" autocomplete="off"><span class="hint">${T(`Stays on this device.`)}</span></div>
    <div class="field sum-age"><label for="sum-age">${T(`Age this summer (optional)`)}</label>
      <select id="sum-age"><option value="">Any age</option>${Array.from({ length: 15 }, (_, i) => `<option value="${i + 3}">${i + 3}</option>`).join('')}</select></div>
    <div class="sum-tally"><div class="sum-strip" id="sum-strip" aria-hidden="true"></div><p id="sum-count" aria-live="polite"></p><p class="hint" id="sum-cost"></p></div>
  </div>
  <ol class="sum-weeks" id="sum-weeks"></ol>
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
  <script type="application/json" id="summer-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</section>
<section class="section sum-chart-section" id="chart" data-jump-to="When camps run">
  <h2>${T(`When each camp runs`)}</h2>
  <p>${T(`Each column is a week, named by its Monday. A filled box means the camp listed that week. The chart scrolls sideways and down.`)} <span class="needs-js">${T(`Tap a box to add that week to your summer.`)}</span></p>
  <p class="sum-key"><span><i class="k exact"></i>${T(`{year} dates`, { year })}</span><span><i class="k"></i>${T(`{year} dates, as a guide`, { year: base })}</span><span class="needs-js"><i class="k picked"></i>${T(`In your summer`)}</span></p>
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
  <p>${T(`These camps haven’t put dates we can chart on their sites. You can still add one to any week above, then check with the camp.`)}</p>
  <ul class="plain cols">${P.undated.map(({ c }) => `<li><a href="${link(campPath(c), D)}">${esc(c.name)}</a></li>`).join('')}</ul>` : ''}
</section>
<section class="section">
  <p><a class="btn" href="${link(campsPath, D)}">${T(`Every camp, with ages, hours and prices`)}</a></p>
  <p class="hint">${T(`Dates, prices and openings change, and many camps fill early. Confirm with the camp before you plan around a week.`)}</p>
</section>
</div>`;
  return layout({
    title: `Summer ${year} camp schedule for Philadelphia, week by week`,
    description: `Plan summer ${year} in Philadelphia week by week: see which of ${P.dated.length} city day camps run each of the ${P.weeks.length} weeks between the last day of school and Labor Day.`,
    pathName: summerPath, depth: D, current: null, hero, body, showStreet: 'summer', scripts: GROUPS ? groupsScript(D) : '',
  });
}
// ---------- a page per summer camp ----------
// The list shows a short card for each camp; everything the camp posts is on its own page, which search engines can find.
const campPath = c => `${campsPath}${c.id}/`;
// A camp shaped like a program, for the calendar files and links a sign-up date gets.
const campAsListing = c => ({ id: 'camp-' + c.id, name: c.name, website: c.website, register: { url: c.registerUrl || c.website } });
const campAges = c => c.ageMin || c.ageMax ? (c.ageMin && c.ageMax ? `Ages ${String(c.ageMin).replace('.5', '½')}–${c.ageMax}` : c.ageMin ? `Ages ${String(c.ageMin).replace('.5', '½')} and up` : `Up to age ${c.ageMax}`) : '';
const campPrice = c => c.weekly === 0 || (c.weekly === undefined && c.price === 'free') ? 'Free' : c.weekly ? `$${c.weekly} a week` : '';
const campHoursShort = c => String(c.hours || '').split(/[.;] /)[0].replace(/\.$/, '');
const campWeeksShort = c => { const m = /(January|February|March|April|May|June|July|August|September) \d{1,2} to (?:(?:January|February|March|April|May|June|July|August|September) )?\d{1,2}(?:, \d{4})?/.exec(String(c.weeks || '')); return m ? m[0] : ''; };
function campPage(c) {
  const D = 2, year = summerYear;
  const where = [c.address, (c.neighborhoods || []).join(', ')].filter(Boolean);
  const rows = [['Ages', fold(esc(c.ages || ''))], ['Weeks', fold(esc(c.weeks || ''))], ['Hours', fold(esc(c.hours || ''))], ['Before and after', fold(esc(c.extended || ''))], ['Cost', fold(esc(c.cost || ''))], ['Help with cost', fold(esc(c.aid || ''))], ['Where', esc(where.length === 2 ? `${where[0]} (${where[1]})` : where[0] || '')], ['Signing up', fold(esc(c.signup || ''))], ['Phone', c.phone ? `<a href="tel:+1-${esc(c.phone)}">${esc(c.phone)}</a>` : '']]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`);
  const prog = c.program ? programs.find(p => p.id === c.program) : null;
  const campDates = (c.dates || []).filter(d => d.date >= TODAY);
  const campCal = campAsListing(c);
  if (campDates.length) rows.splice(-1, 0, `<dt>Dates</dt><dd class="dates">${campDates.map(d => `<span class="cal" data-date="${d.date}"><b>${shortDate(d.date)}:</b> ${esc(d.label.replace(/\.$/, ''))}. ${PREVIEW ? '' : `<a href="${link('cal/' + campCal.id + '-' + d.date + '.ics', D)}" data-track="calendar">Add to calendar</a> `}<a href="${esc(gcalUrl(campCal, d))}" target="_blank" rel="noopener" data-track="calendar">${PREVIEW ? 'Add to Google Calendar' : 'Google Calendar'}</a></span>`).join('')}</dd>`);
  const plan = summerPlan.camps.find(x => x.c.id === c.id) || { on: [], exact: false };
  const areas = campAreas(c).length === CAMP_AREAS.length ? [] : campAreas(c);
  // the camps closest to this one, for someone still looking
  const here = coordsOf(c.address);
  const near = here.length ? summerCamps.filter(x => x.id !== c.id && coordsOf(x.address).length).map(x => [x, Math.min(...here.flatMap(a => coordsOf(x.address).map(b => milesApart(a, b))))]).sort((a, b) => a[1] - b[1]).slice(0, 4) : [];
  const hero = `    <p class="where"><a href="${link(campsPath, D)}">${T(`Summer camps`)}</a>${areas.length ? ` <span class="served">${areas.map(a => `<span class="pill nearby wrap">${esc(a)}</span>`).join(' ')}</span>` : ''}</p>
    <h1>${esc(c.name)}</h1>
    <p class="lede">${esc(c.what)}</p>
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
  ${c.season && c.season < year ? `<section class="section"><p class="flag camp-guide"><b>${T(`These are its summer {year} details, shown as a guide.`, { year: c.season })}</b> ${T(`It hasn’t posted summer {next} yet. This page changes when it does.`, { next: year })}${ALERTS ? ` <a href="#by-email">${T(`Get an email when it does.`)}</a>` : ''}</p></section>` : ''}
  <section class="section">
    <h2>${T(`The details`)}</h2>
    ${photoSlot('c:' + c.id)}
    <article class="prog solo camp">
      <div class="strip camp-weeks">${plan.on.length ? `<p class="camp-weeks-h">${plan.exact ? T(`Weeks it runs in {year}`, { year }) : T(`Weeks it ran in {year}`, { year: c.season })}</p>
        <ol class="weekstrip">${summerPlan.weeks.map((w, i) => { const d = utcDay(w); return `<li class="${plan.on.includes(i) ? 'on' + (plan.exact ? ' exact' : '') : ''}"><span>${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}</span><b>${d.getUTCDate()}</b><i class="vh">${plan.on.includes(i) ? 'runs' : 'no camp'}</i></li>`; }).join('')}</ol>
        <p class="hint">${plan.exact ? T(`Each box is a week, named by its Monday.`) : T(`Each box is a week, named by its Monday in {year}: last summer’s weeks, moved to the same week of the calendar.`, { year })}</p>` : `<p class="hint">${T(`It hasn’t listed dates we can chart.`)}</p>`}</div>
      <dl>${rows.join('')}</dl>
      ${c.note ? `<p class="flag">${esc(c.note)}</p>` : ''}
      <div class="actions"><a class="btn primary" data-track="camp" href="${esc(outUrl(c.registerUrl || c.website, { type: 'camp' }))}" target="_blank" rel="noopener">${c.registerUrl ? T(`Find or book a spot`) : T(`The camp’s website`)}</a>${c.registerUrl ? `<a class="btn" data-track="website" href="${esc(outUrl(c.website, { type: 'camp' }))}" target="_blank" rel="noopener">${T(`The camp’s website`)}</a>` : ''}<a class="btn needs-js" href="${link(summerPath, D)}?add=${esc(c.id)}">${T(`Add to your summer`)}</a>${prog ? `<a class="btn" href="${link(programPath(prog), D)}">${T(`Its school-year listing`)}</a>` : ''}</div>
      ${ALERTS && GROUPS ? (c.season && c.season < year
        ? followBox(D, { key: 'c:' + c.id, name: c.name, place: 'camp', fav: true, h: 'h3', title: T(`Tell me when it posts summer {year}`, { year }), lede: T(`One email when {camp} posts its {year} dates and prices, and one before sign-ups open if it names a day.`, { camp: c.name, year }), hint: T(`An email the morning after we see it, then reminders the day before and at about 8 on the morning sign-ups open. We read each camp’s site again about once a month, so the first one can come a few weeks after the camp’s own announcement. If a camp fills fast, watch its site too.`) })
        : followBox(D, { key: 'c:' + c.id, name: c.name, place: 'camp', fav: true, h: 'h3', title: T(`Tell me when something changes`), lede: T(`One email before sign-ups open at {camp}, if it names a day, and one when its dates or prices change.`, { camp: c.name }), hint: T(`An email the morning after we see it, then reminders the day before and at about 8 on the morning sign-ups open. We read each camp’s site again about once a month, so the first one can come a few weeks after the camp’s own announcement. If a camp fills fast, watch its site too.`) })) : ''}
    </article>
    <p class="hint">${T(`Dates, prices and openings change, and many camps fill early. Confirm with the camp before you plan around a week.`)}</p>
    ${listingTools('c:' + c.id, c.name, D, 'camp')}
  </section>
  ${ALERTS && GROUPS ? '' : c.season && c.season < year
    ? alertsBox(D, { camp: c, place: 'camp', title: T(`Tell me when it posts summer {year}`, { year }), lede: T(`One email when {camp} posts its {year} dates and prices, and one before sign-ups open if it names a day. Just this camp.`, { camp: c.name, year }) })
    : alertsBox(D, { camp: c, place: 'camp', title: T(`Tell me when something changes`), lede: T(`One email before sign-ups open at {camp}, if it names a day, and one when its dates or prices change. Just this camp.`, { camp: c.name }) })}
  ${near.length ? `<section class="section">
    <h2>${T(`Camps close to this one`)}</h2>
    <div class="schools">
${near.map(([x, m]) => `<a class="prow" href="${link(campPath(x), D)}"><h3>${esc(x.name)}</h3><span class="what">${esc(x.what)}</span><span class="tally"><span class="pill mi-pill">${m < 0.1 ? 'Next door' : (Math.round(m * 10) / 10).toFixed(1) + ' mi'}</span><span class="hint">${[campAges(x), campPrice(x)].filter(Boolean).map(esc).join(' · ')}</span></span></a>`).join('\n')}
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
function summerCampsPage() {
  const D = 1;
  const base = campsFile.season, next = base + 1;
  const list = [...summerCamps].sort((a, b) => a.name.localeCompare(b.name));
  const shaped = list.map(c => ({ ...c, neighborhoods: campAreas(c) }));   // what the filter bar sees
  const ahead = list.filter(c => c.season > base).length;
  // On the list each camp is a short card: what it is, the handful of facts people sort by, and the way to its own page.
  const cards = list.map((c, i) => {
    const facts = [campAges(c), campWeeksShort(c), campHoursShort(c), campPrice(c), (c.neighborhoods || []).join(', ')].filter(Boolean);
    return `<article class="campcard offprog" id="${esc(c.id)}" ${itemAttrs(shaped[i], [c.ages || '', c.address || '', ...(c.neighborhoods || [])])}>
  <div class="top"><h3><a href="${link(campPath(c), D)}">${esc(c.name)}</a></h3><p class="what">${esc(c.what)}</p><p class="tags">${c.types.map(t => `<span class="tag" style="--tc:${TYPE[t].color}">${esc(TYPE[t].label)}</span>`).join('')}</p></div>
  <p class="camp-facts">${seasonPill(c)} ${spaceSlot('c:' + c.id, D)}${facts.map(f => `<span>${esc(f)}</span>`).join('')}</p>
  <div class="actions"><a class="btn primary" href="${link(campPath(c), D)}">${T(`Full details`)}</a><a class="btn needs-js" href="${link(summerPath, D)}?add=${esc(c.id)}">Add to your summer</a></div>
</article>`;
  }).join('\n');
  const todo = campsFile.todo || [];
  const hero = `    <h1>${T(`Summer camps in Philadelphia`)}</h1>
    <p class="lede">${T(`Day camps inside the city, with the ages, weeks, hours and prices each camp posts on its own site.`)}</p>
    <div class="facts">
      <span><b>${list.length}</b> camps</span>
      <span><b>${ahead}</b> already showing ${next}</span>
      <span>Checked <b>${longDate(campsFile.checked)}</b></span>
    </div>`;
  const body = `<section class="section">
  <p class="flag camp-guide"><b>${T(`Most of what’s here is from summer {year}, shown as a guide.`, { year: base })}</b> ${T(`Camps usually post next summer between December and March. Each listing changes to {year} when its camp posts dates and prices, and says so on its card.`, { year: next })}${ALERTS ? ' ' + T(`Waiting on one camp? Its page has a box to be emailed when it posts.`) : ''}</p>
  <p><a class="btn primary" href="${link(summerPath, D)}">${T(`Plan your summer, week by week`)}</a></p>
</section>
${filterBar({ list: shaped, depth: D, near: true, searchLabel: `Looking for a particular camp?`, placeholder: 'Its name, or try art, tennis, Mount Airy…' }).replace('data-filters', 'data-filters data-noun="camp" data-nouns="camps"')}
<p class="hint">${T(`Grades here are worked out from each camp’s ages, so check the ages on the camp’s page. Each camp has its own page with everything it posts.`)}</p>
${noMatch(D)}
<section class="section" data-group>
  <div class="list camplist">
${cards}
  </div>
</section>
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
  const shape = p => ({ ...p, ...(p.weekend._grades !== undefined ? { _grades: p.weekend._grades } : {}), neighborhoods: weekendAreas(p) });   // what the filter bar sees
  const card = p => {
    const w = p.weekend, hoodsHere = programHoods(p);
    const rows = [['What runs', w.summary], ['Term', w.term], ['Cost', w.cost], ['Where', programAddress(p) + (hoodsHere.length && !/\(/.test(programAddress(p)) ? ` (${hoodsHere.join(', ')})` : '')]]
      .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    const wp = shape(p);   // the weekend classes can take other grades than the weekday program
    return `<article class="prog offprog" id="${esc(p.id)}" ${itemAttrs(wp, [...hoodsHere, ...w.days.map(d => WEEKEND_DAY[d])])} data-wk="${w.days.join(' ')}">
  <div class="top"><h3><a href="${link(programPath(p), D)}">${esc(fullName(p))}</a></h3><p class="tags">${p.types.map(t => `<span class="tag" style="--tc:${TYPE[t].color}">${esc(TYPE[t].label)}</span>`).join('')}</p><p>${hoodsHere.map(n => `<span class="pill hood">${esc(n)}</span>`).join(' ')} ${w.days.map(d => `<span class="pill nearby">${WEEKEND_DAY[d]}</span>`).join(' ')} ${spaceSlot('p:' + p.id, D)} <span class="hint">Grades ${esc(gradeText(wp))}</span></p></div>
  <dl>${rows}</dl>
  ${w.note ? `<p class="flag">${esc(w.note)}</p>` : ''}
  <div class="actions"><a class="btn primary" data-track="weekend" href="${esc(outUrl(w.url, { type: 'weekend', program: p }))}" target="_blank" rel="noopener">Class details</a><a class="btn" href="${link(programPath(p), D)}">Full listing</a>${w.days.map(d => `<a class="btn needs-js" href="${link('board/', D)}?wk=${esc(p.id)}&amp;day=${d}">Add ${WEEKEND_DAY[d]} to your week</a>`).join('')}</div>
  <p class="src">Checked ${longDate(w.checked || p.lastVerified)}. Sources: ${sourceLinks(w.sources, p)}</p>
</article>`;
  };
  const areas = weekendByArea();
  const hero = `    <h1>${T(`Saturday and Sunday classes`)}</h1>
    <p class="lede">${T(`Weekend classes for kids, by part of the city: what runs, which term, and what it costs.`)}</p>
    <div class="facts">
      <span><b>${weekendPrograms.length}</b> places with weekend classes</span>
      <span><b>${weekendPrograms.filter(p => p.weekend.days.includes('sun')).length}</b> on Sundays too</span>
      <span><b>${new Set(weekendPrograms.flatMap(programHoods)).size}</b> neighborhoods</span>
    </div>`;
  const body = `${filterBar({ list: weekendPrograms.map(shape), depth: D, show: { cost: false, day: false }, near: true, searchLabel: `Looking for a particular class?`, placeholder: 'A name or a neighborhood, or try piano, acting…' }).replace('data-filters', 'data-filters data-noschool data-noun="place" data-nouns="places"')}
<p class="hint">${T(`A weekend class has no school pickup, so this list goes by where the class is. Any child can sign up, whichever school they go to.`)}</p>
${noMatch(D)}
${areas.map(([a, list]) => `<section class="section" data-group>
  <h2>${esc(a)}</h2>
  <div class="list">
${list.map(card).join('\n')}
  </div>
</section>`).join('\n')}
<section class="section">
  <p>${T(`This covers the programs already on this site, plus weekend-only places from a first sweep of the city. It isn’t every class in Philadelphia, and some listed programs run weekend classes that their sites don’t spell out by day, so ask.`)} ${T(`Know a weekend class that should be here?`)} <a href="${link('suggest/', D)}">${T(`Tell us.`)}</a></p>
  <p class="hint">${T(`Weekend terms start and fill on their own dates, so check with the provider before you count on a class.`)}</p>
</section>`;
  const ordered = areas.flatMap(([, l]) => l);
  return layout({
    title: 'Weekend classes for kids in Philadelphia, by neighborhood',
    description: `Saturday and Sunday classes for kids at ${weekendPrograms.length} places in Philadelphia, by part of the city: music, theater, art, dance, skating, soccer and science, with terms, times and cost.`,
    pathName: weekendPath, depth: D, current: null, hero, body, showStreet: 'weekend',
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: ordered.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: fullName(p), url: `${cfg.siteUrl}/${programPath(p)}` })) },
  });
}

function notFoundPage() {
  const hero = `    <h1>${T(`This jawn isn’t here`)}</h1>
    <p class="lede">${T(`The link may be old, or the page moved.`)} <a href="/">${T(`Start from the list of schools.`)}</a></p>`;
  return layout({ title: 'Page not found', description: 'Page not found.', pathName: '404.html', depth: -1, current: null, hero, body: '', showStreet: 'parked', noindex: true });
}

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
const write = (rel, content) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
write('index.html', homePage());
for (const s of schools) write(`${s.id}/index.html`, schoolPage(s));
write('schools/index.html', schoolsPage());
write('schools/request/index.html', schoolRequestPage());
if (SCHOOL_PAGES) for (const x of uncovered) write(uncoveredPath(x) + 'index.html', uncoveredSchoolPage(x));
write('types/index.html', typesPage());
for (const t of liveTypes()) write(`types/${t.id}/index.html`, typePage(t));
write('programs/index.html', programsPage());
for (const p of programs) write(`${programPath(p)}index.html`, programPage(p));
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
if (daysOff) write(offPath + 'index.html', daysOffPage());
if (summerCamps.length) write(campsPath + 'index.html', summerCampsPage());
for (const c of summerCamps) write(campPath(c) + 'index.html', campPage(c));
if (summerCamps.length) write(summerPath + 'index.html', summerSchedulePage());
if (YEAR_PAGE) write(yearPath + 'index.html', calendarPage());
if (weekendPrograms.length) write(weekendPath + 'index.html', weekendPage());
if (ALERTS) write(alertsPath + 'index.html', alertsPage());
if (ALERTS && GROUPS) write(alertsPath + 'stop/index.html', stopPage());
write('review/index.html', reviewPage());
write('review/thanks/index.html', reviewThanksPage());
if (GATED) write('edit/index.php', editIndexPhp()); else write('edit/index.html', editPage());
if (GATED && GROUPS) write('edit/stats/index.php', editStatsPhp());
if (GATED && GROUPS) write('edit/claims/index.php', editClaimsPhp());
const notFound = notFoundPage();   // always rendered, so its copy is known to the editor
write('assets/site.css', fs.readFileSync(path.join(ROOT, 'src/site.css')));
write('assets/site.js', fs.readFileSync(path.join(ROOT, 'src/site.js')));
write('assets/edit.js', fs.readFileSync(path.join(ROOT, 'src/edit.js')));
if (GROUPS) {
  write('assets/groups.js', fs.readFileSync(path.join(ROOT, 'src/groups.js')));
  write('account/index.html', accountPage());
  write('register/index.html', accountPage(true));
  write('profile/index.html', profilePage());
  write('groups/index.html', groupPage());
  write('join/index.html', joinPage());
  write('managers/index.html', directorsPage());
  write('directors/index.html', movedPage('managers/', 1));   // the page's first address
  if (!PREVIEW) write('groups/api.php', groupsApiPhp());
}
for (const f of fs.readdirSync(path.join(ROOT, 'src/static'))) write(f, fs.readFileSync(path.join(ROOT, 'src/static', f)));
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
  write('data/alerts.json', JSON.stringify(alertsFeed(), null, 2));   // read by scripts/send-alerts.mjs once a day
  const latest = programs.map(p => p.lastVerified).sort().pop();
  const urls = [['', latest], ['schools/', latest], ...schools.map(s => [s.id + '/', latest]), ['types/', latest], ...liveTypes().map(t => [`types/${t.id}/`, latest]), ['programs/', latest], ...programs.map(p => [programPath(p), p.lastVerified]), ['neighborhoods/', latest], ...hoods.map(h => [hoodPath(h), latest]),
    ...[...(daysOff ? [offPath] : []), ...(summerCamps.length ? [campsPath, summerPath, ...summerCamps.map(campPath)] : []), ...(SCHOOL_PAGES ? uncoveredIndexed().map(uncoveredPath) : []), ...(weekendPrograms.length ? [weekendPath] : []), ...(ALERTS ? [alertsPath] : []), schedulesPath, 'board/', 'suggest/', ...(GROUPS ? ['managers/'] : []), 'ideas/', 'review/', 'about/', 'contact/', 'privacy/', ...(cfg.termsLive === true ? ['terms/'] : []), 'support/'].map(u => [u, latest])];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `  <url><loc>${cfg.siteUrl}/${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
  const bare = cfg.siteUrl.replace(/^https?:\/\//, '');
  // Other addresses that should land on this one (see "Changing the site's address" in the README).
  const formerHosts = (cfg.formerHosts || []).filter(h => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) && h !== bare && h !== 'www.' + bare);
  write('.htaccess', `ErrorDocument 404 /404.html\nAddType text/calendar .ics\nDirectoryIndex index.html index.php\n\n# One address for the site: www goes to the bare domain.\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteCond %{HTTP_HOST} ^www\\.${bare.replace(/\./g, '\\.')}$ [NC]\nRewriteRule ^ https://${bare}%{REQUEST_URI} [R=301,L]\n${formerHosts.length ? `# The site's other addresses all lead here, page for page (the certificate check on each is left alone).\nRewriteCond %{HTTP_HOST} ^(www\\.)?(${formerHosts.map(h => h.replace(/\./g, '\\.')).join('|')})$ [NC]\nRewriteCond %{REQUEST_URI} !^/\\.well-known/\nRewriteRule ^ https://${bare}%{REQUEST_URI} [R=301,L]\n` : ''}${cardQr ? `# The short addresses in the QR codes on the week card and the day-camp card.\nRewriteRule ^w/?$ ${cardQr.goesTo} [NC,R=302,L]\n${cardQr.dayoff ? `RewriteRule ^d/?$ ${cardQr.dayoff.goesTo} [NC,R=302,L]\n` : ''}` : ''}${movedSchools.length ? `# A school that has been added: its old "not covered yet" address goes to its page.\n${movedSchools.map(([from, to]) => `RewriteRule ^schools/${from}/?$ /${to}/ [R=301,L]\n`).join('')}` : ''}</IfModule>\n`);
}
// Edits in data/copy.json are matched to sentences by a fingerprint of the original wording.
// If the original was reworded or removed in this file, the edit no longer applies: say so, but still build.
const stale = Object.entries(copyEdits).filter(([id]) => !copyRegistry.has(id));
if (stale.length) console.warn(`\nNote: ${stale.length} edit(s) in data/copy.json no longer match any sentence on the site, so they were skipped:\n` + stale.map(([id, e]) => `- ${id}: was "${e.was || '?'}" / now "${e.now}"`).join('\n') + '\n');
const noHood = programs.filter(p => !programHoods(p).length);
if (noHood.length) console.warn(`\nNote: no neighborhood for ${noHood.map(p => p.id).join(', ')}. Add "neighborhoods" in data/programs.json so they show on a neighborhood page.\n`);
console.log(`Built ${schools.length} school page(s), ${hoods.length} neighborhood page(s), ${programs.length} program page(s) and ${copyRegistry.size} editable sentences into ${path.relative(ROOT, OUT)}/`);
