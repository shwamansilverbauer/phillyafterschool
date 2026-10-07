// Builds the static site into dist/ from the data files. No dependencies: `node build.mjs`.
// PREVIEW=1 writes to preview/ with explicit index.html links, for viewing without a web server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

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
}
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
  return `<svg class="street${animate ? ' go' : ''}" viewBox="0 0 2000 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${run(-10, sx)}${school}${run(sx + sw, 2010)}<rect class="st" x="0" y="${G}" width="2000" height="12"/><g class="bus"><g transform="translate(968,${G - 22})">${bus}</g></g></svg>`;
}

function layout({ title, description, pathName, depth, current, hero, body, scripts = '', fragment = false, showStreet = false, noindex = false, jsonLd = null, roomy = false, first = '', theme = '', shareImage = null, quiet = false }) {
  const canonical = cfg.siteUrl + '/' + pathName;
  // Search results show roughly 60 characters of a title and 155 of a description. The site name is added
  // to a title only when it fits; a long description is cut at a word.
  const fullTitle = pathName === '' ? (PREVIEW ? cfg.siteName : `${cfg.siteName}: ${cfg.tagline}`) : `${title} | ${cfg.siteName}`.length <= 65 ? `${title} | ${cfg.siteName}` : title;
  if (description.length > 158) description = description.slice(0, 157).replace(/\s+\S*$/, '').replace(/[,;:.]$/, '') + '…';
  // The menu: four groups that open, then About and the support button. Each group is a <details>, so it works without scripts.
  const navHref = to => { const [p, hash] = to.split('#'); return link(p, depth) + (hash ? '#' + hash : ''); };
  const menus = [
    ['Programs', [['programs/', 'After-school programs'], ...(programs.some(p => p.weekend) ? [['weekends/', 'Weekend classes']] : []), ...(daysOff ? [[offPath, 'Day-camp programs']] : []), ...(summerCamps.length ? [['summer-camps/', 'Summer camps']] : [])]],
    ['Search by', [['schools/', 'School'], ['neighborhoods/', 'Neighborhood'], ['types/', 'Program type'], ['programs/#by-day', 'Day of week']]],
    ['Build a schedule', [['board/', 'After-school schedule'], ...(daysOff ? [[offPath + '#plan', 'Day-camp schedule']] : [])]],
    ['Suggest', [['suggest/', 'A program'], ['ideas/', 'A feature'], ['schools/request/', 'A school']]],
  ];
  const nav = menus.map(([label, items]) => {
    const here = items.some(([to]) => !to.includes('#') && pathName.startsWith(to));
    return `<details class="menu${here ? ' here' : ''}"><summary>${label}${label === 'Build a schedule' ? '<span class="count" data-board-count hidden></span>' : ''}</summary><ul>${items.map(([to, text]) => `<li><a href="${navHref(to)}"${to === pathName ? ' aria-current="page"' : ''}>${text}</a></li>`).join('')}</ul></details>`;
  }).join('') + `<a href="${link('about/', depth)}"${current === 'about/' ? ' aria-current="page"' : ''}>About</a>${GROUPS
    ? `<a class="nav-cta when-out" href="${link('register/', depth)}">Create a free account</a><a class="nav-cta when-in" href="${link('account/', depth)}">Your account</a>`
    : `<a class="nav-cta" href="${link('support/', depth)}"${current === 'support/' ? ' aria-current="page"' : ''}>Help the site keep going</a>`}`;
  const head = `${first}${fragment || quiet ? '' : gtmHead + '\n'}<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">${noindex ? '\n<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:image" content="${cfg.siteUrl}/${shareImage ? shareImage.file : 'share.png'}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(shareImage ? shareImage.alt : `${cfg.siteName}: a row of Philadelphia rowhouses, a school and a yellow school bus`)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${link('favicon.svg', depth)}" type="image/svg+xml">
<link rel="icon" href="${link('favicon.png', depth)}" type="image/png" sizes="48x48">
<link rel="apple-touch-icon" href="${link('apple-touch-icon.png', depth)}">
<meta name="theme-color" content="#0F4D90">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<link rel="stylesheet" href="${link('assets/site.css', depth)}${CSS_V}">${jsonLd ? '\n<script type="application/ld+json">' + JSON.stringify(jsonLd).replace(/</g, '\\u003c') + '</script>' : ''}`;
  // Edit mode (see /edit/) loads a second script. This tells site.js where to find it and where edits are sent.
  const editCfg = { js: link('assets/edit.js', depth) + EDIT_V, send: PREVIEW ? '' : link('edit/send.php', depth), home: link('edit/', depth), contact: cfg.contactEmail || '' };
  // The strip above the menu holds "Log in" for someone who isn't signed in. The menu's own button is "Create a free
  // account" for them and "Your account" once this browser has signed in. Which shows is decided before the page
  // paints, from a flag the account pages keep in this browser (no request is made).
  const topbar = GROUPS ? `<div class="band topstrip when-out${theme ? ' ' + theme : ''}"><div class="topbar"><div class="in">
    <span>Already have an account?</span><a href="${link('account/', depth)}">Log in</a>
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
  ${showStreet === 'dayoff' ? dayScene() : showStreet ? street(showStreet === 'go') : ''}
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
      <h2><a href="${link('board/', depth)}">${T(`Your family`)}</a></h2>
      <ul>
        <li><a href="${link('board/', depth)}">${T(`After-school schedule`)}</a></li>
        ${daysOff ? `<li><a href="${link(offPath, depth)}#plan">${T(`Day-camp schedule`)}</a></li>` : ''}
        ${ALERTS ? `<li><a href="${link(alertsPath, depth)}">${T(`Dates by email`)}</a></li>` : ''}
        ${GROUPS ? `<li><a href="${link('account/', depth)}">${T(`Your account`)}</a></li>` : ''}
      </ul>
    </div>
    <div>
      <h2><a href="${link('about/', depth)}">${T(`About`)}</a></h2>
      <ul>
        <li><a href="${link('about/', depth)}">${T(`About this site`)}</a></li>
        <li><a href="${link('about/', depth)}#how">${T(`How listings are checked`)}</a></li>
        <li><a href="${link('about/', depth)}#corrections">${T(`Send a correction`)}</a></li>
        <li><a href="${link('ideas/', depth)}">${T(`Request a feature`)}</a></li>
        <li><a href="${link('privacy/', depth)}">${T(`Privacy`)}</a></li>
        <li><a href="${link('support/', depth)}">${T(`Buy me a coffee`)}</a></li>
      </ul>
    </div>
  </nav>
  <div class="foot-fine">
    <p>${T(`Listings come from each provider’s public pages and are not endorsements. Prices, hours and pickup routes change, so confirm with the provider before you enroll.`)}</p>
    <p>${T(`{site} is an independent community project. It is not affiliated with the School District of Philadelphia or any provider listed.`, { site: cfg.siteName })}</p>
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
    'UID:' + p.id + '-' + d.date + '@' + cfg.siteUrl.replace(/^https?:\/\//, ''),
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
const kindsOf = price => price === 'both' ? ['free', 'paid'] : price ? [price] : [];
const costKinds = (p, school) => school ? kindsOf(p.schools[school.id].price || p.price)
  : [...new Set([...kindsOf(p.price), ...Object.values(p.schools).flatMap(l => kindsOf(l.price))])];
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
const itemAttrs = (p, extra = [], school = null) => `data-item data-grades="${p._grades === null ? '*' : p._grades.join(' ')}" data-types="${p.types.join(' ')}" data-hoods="${programHoods(p).map(hoodSlug).join(' ')}" data-cost="${costKinds(p, school).join(' ')}" data-days="${p.days ? p.days.join(' ') : '*'}" data-schools="${schools.filter(x => p.schools[x.id]).map(x => x.id).join(' ')}" data-search="${esc(haystack(p, extra))}"`;
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
function filterBar({ list, depth, school = null, show = {}, searchLabel, placeholder = 'Its name, or try drums, art, chess…' }) {
  const on = { q: true, type: true, grade: true, hood: true, cost: true, ...show };
  const btn = (f, v, label, n, cls = 'tbtn', extra = '') => `<button type="button" class="${cls}" id="${f}-${v}" data-f="${f}" data-v="${v}" data-label="${esc(label)}" aria-pressed="${v === 'ALL'}"${extra}>${esc(label)}${n === null ? '' : ` (${n})`}</button>`;
  const types = TYPES.map(t => [t, list.filter(p => p.types.includes(t.id)).length]).filter(([, n]) => n);
  const typeRow = on.type && types.length > 1 ? `<div class="frow"><span class="flabel">Type</span><div class="rail" role="group" aria-label="Program type">${btn('type', 'ALL', 'All types', null)}${types.map(([t, n]) => btn('type', t.id, t.label, n, 'tbtn', ` style="--tc:${t.color}"`)).join('')}</div></div>` : '';
  const relRow = school ? `<div class="frow"><span class="flabel">Pickup</span><div class="rail" role="group" aria-label="How your child gets there">${btn('rel', 'ALL', 'Any', null)}${Object.entries(REL).map(([k, v]) => [k, v.pill.replace('{s}', school.shortName), list.filter(p => p.schools[school.id].relation === k).length]).filter(([, , n]) => n).map(([k, label, n]) => btn('rel', k, label, n)).join('')}</div></div>` : '';
  const hoodList = [...new Set(list.flatMap(programHoods))].sort();
  const hoodRow = on.hood && hoodList.length > 1 ? `<div class="frow"><span class="flabel">Area</span><div class="rail" role="group" aria-label="Neighborhood">${btn('hood', 'ALL', 'Anywhere', null)}${hoodList.map(n => btn('hood', hoodSlug(n), n, list.filter(p => programHoods(p).includes(n)).length)).join('')}</div></div>` : '';
  const costN = k => list.filter(p => costKinds(p, school).includes(k)).length, unpriced = list.filter(p => !costKinds(p, school).length).length;
  const costRow = on.cost && costN('free') && costN('paid') ? `<div class="frow"><span class="flabel">Cost</span><div class="rail" role="group" aria-label="Cost">${btn('cost', 'ALL', 'Any', null)}${btn('cost', 'free', 'Free', costN('free'))}${btn('cost', 'paid', 'Paid', costN('paid'))}${unpriced ? `<span class="hint rail-note">${unpriced} ${unpriced === 1 ? 'doesn’t' : 'don’t'} publish a price, so ${unpriced === 1 ? 'it shows' : 'they show'} only under Any.</span>` : ''}</div></div>` : '';
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
    ${typeRow}${relRow}${hoodRow}${costRow}${dayRow}
  </div>
  <section class="picker" aria-label="Filter by grade">
    ${on.grade ? `<div class="rail" role="group" aria-label="Grade">${gradeBtns}</div>` : ''}
    <div class="status"><span id="count" aria-live="polite"></span><button type="button" class="clear" id="clear" hidden>Clear filters</button></div>
  </section>`;
}
const noMatch = depth => `<p class="ask" id="no-match" data-nomatch data-edit-reveal="Shown when the filters find nothing:" hidden>${T(`Nothing matches that. Know a program that should be listed?`)} <a href="${link('suggest/', depth)}">${T(`Tell us about it.`)}</a></p>`;

// ---------- program card ----------
function card(p, school) {
  const l = p.schools[school.id];
  const rel = REL[l.relation];
  const g = p._grades;
  const where = [l.address || p.address, l.distance].filter(Boolean).join(', ');
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
  <div class="top"><span class="pill ${l.relation}">${esc(rel.pill.replace('{s}', school.shortName))}</span><h3><a href="${link(programPath(p), 1)}">${esc(p.name)}</a></h3><p class="what">${esc(p.what)}</p><p class="tags">${typeTags(p, school)}</p>${p.offers?.length ? `<p class="offers"><b>${p.clubs ? 'Clubs' : 'Classes'}:</b> ${esc(p.offers.join(', '))}</p>` : ''}${p.clubs ? `<p class="club-match" data-club-match="${esc(JSON.stringify(clubsByType(p)))}" hidden></p>` : ''}</div>
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
const nextSend = iso => { let d = iso; while (weekday(d) !== SEND_DAY) d = isoAdd(d, 1); return d; };   // the first send day on or after a date
const mailUrl = (rel, hash = '') => `${cfg.siteUrl}/${rel}?utm_source=klaviyo&utm_medium=email&utm_campaign=dates${hash}`;
const alertItems = [
  ...programs.flatMap(p => upcomingDates(p).map(d => ({
    id: `reg-${p.id}-${d.date}`, kind: 'register', date: d.date, sendOn: sendOn(d.date, LEAD.register),
    schools: schools.filter(s => p.schools[s.id]).map(s => s.id), programs: [p.id],
    when: longDay(d.date), title: p.name, text: d.label + '.', url: mailUrl(programPath(p)), button: 'See the listing',
  }))),
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
  // Notes from a program's "updates" list go out on the first send day after they are added, to its followers.
  ...programs.flatMap(p => (p.updates || []).map(u => ({
    id: `news-${p.id}-${u.date}`, kind: 'update', date: u.date, sendOn: nextSend(u.date), expires: isoAdd(nextSend(u.date), 2), schools: [], programs: [p.id],
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
const alertsFeed = () => ({
  about: `Dated reminders for ${cfg.siteName}. Each one is emailed on its sendOn day to people who asked for their school's dates.`,
  generated: TODAY, site: cfg.siteUrl, metric: ALERTS?.metric || 'School dates', sendDay: SEND_DAY_NAME,
  schools: schools.map(s => ({ id: s.id, name: s.shortName })),
  programs: programs.map(p => ({ id: p.id, name: fullName(p) })),
  alerts: alertItems,
});
// The sign-up box. With a school or a program it asks for a first name and an email; without either it also asks which school.
// A program box follows that one program: its dates, its day-off camps and its updates, and nothing else.
const alertsBox = (depth, { school = null, program = null, place, title, lede }) => !ALERTS ? '' : `<section class="panel alerts" id="by-email">
  <h2>${title}</h2>
  <p>${lede}</p>
  <form class="alerts-form" data-alerts data-place="${place}" data-key="${esc(ALERTS.klaviyoKey)}" data-list="${esc(ALERTS.listId)}"${ALERTS.doubleOptIn ? ' data-confirm="1"' : ''}${PREVIEW ? ' data-preview="1"' : ''} data-clarity-mask="true" novalidate>
    <div class="alerts-row">
      ${program ? `<input type="hidden" name="program" value="${esc(program.id)}" data-name="${esc(fullName(program))}">` : school ? `<input type="hidden" name="school" value="${esc(school.id)}" data-name="${esc(school.shortName)}">` : `<div class="field">
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
      <button class="btn primary big" type="submit">${program ? T(`Tell me`) : T(`Send me the dates`)}</button>
    </div>
    <p class="hint">${program ? T(`Only when this program posts something new, on a {day} morning. Every email has an unsubscribe link.`, { day: SEND_DAY_NAME }) : T(`One email on {day} morning, and only in a week with a date coming up. Every email has an unsubscribe link.`, { day: SEND_DAY_NAME })} <a href="${link('privacy/', depth)}#email">${T(`How we handle your email.`)}</a></p>
    <p class="alerts-status" data-alerts-status aria-live="polite"></p>
  </form>
  <noscript><p class="hint">${T(`Signing up needs JavaScript.`)}</p></noscript>
</section>`;
function alertsPage() {
  const hero = `    <h1>${T(`The dates, before they sneak up on you`)}</h1>
    <p class="lede">${T(`Sign-up openings, deadlines and days off for your school, by email. One short email on {day} morning, and nothing in a week with no dates.`, { day: SEND_DAY_NAME })}</p>`;
  const soon = alertItems.filter(a => a.date >= TODAY).slice(0, 6);
  const body = `<div class="suggest">
  ${alertsBox(1, { place: 'page', title: T(`Where should they go?`), lede: T(`Pick your school, then leave your first name and an email address. That’s the whole form.`) })}
  <aside class="next">
    <h2>${T(`What you’ll get`)}</h2>
    <ul class="rules ticks">
      <li>${T(`A heads-up when sign-ups open or a deadline is close at a program that serves your school.`)}</li>
      <li>${T(`Each district day off at least {n} days ahead, with the listed programs running a camp that day.`, { n: LEAD.dayoff })}</li>
      <li>${T(`One email a week at most. If your school isn’t listed yet, you get the days off and every listed program’s dates.`)}</li>
      <li>${T(`Waiting on one program? Each program’s page has a “Tell me when sign-ups open” box, for emails about that program alone.`)}</li>
      <li>${T(`No account, and no questions about your children.`)}</li>
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
  const rows = [['Where', esc(address)], [p.clubs ? 'Clubs' : 'Classes', clubsDetailed ? '' : esc((p.offers || []).join(', '))], ['Hours', esc(p.hours)], ['Days', esc(daysLine(p))], ['Pick up by', esc(p.pickupBy || '')], ['Cost', esc(p.cost)], ['Days off', p.daysOff ? `${esc(p.daysOff.summary)} <a href="${link(offPath, D)}#${esc(p.id)}">Dates and details</a>` : ''], ['Weekends', p.weekend ? `${esc(p.weekend.summary)} <a href="${link(weekendPath, D)}#${esc(p.id)}">Term and cost</a>` : ''], ['Register', registerText(p)], ['Next term', esc(r.nextTerm || '') + datesHtml(p, D)], ['Contact', r.how === 'school' ? '' : contactHtml(p)]]
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
  const hero = `    <p class="where">${camp ? (p.daysOff ? `<a href="${link(offPath, D)}">${T(`Day-camp programs`)}</a>` : `<a href="${link(weekendPath, D)}">${T(`Weekend classes`)}</a>`) + ' / ' + (p.daysOff && p.weekend ? T(`Day camps and weekend classes`) : p.weekend ? T(`Weekends only`) : T(`Day camps only`)) : `<a href="${link('programs/', D)}">${T(`All programs`)}</a> / ${esc(servedSummary(p))}`}</p>
    <h1>${esc(fullName(p))}</h1>
    <p class="lede">${esc(p.what)}</p>
    <div class="facts">
      <span>${p.types.map(t => typeCount(TYPE[t]) && !schoolRun(p) ? `<a href="${link('types/' + t + '/', D)}">${esc(TYPE[t].label)}</a>` : esc(TYPE[t].label)).join(', ')}</span>
      ${programHoods(p).length ? `<span>In <b>${programHoods(p).every(hoodHas) ? hoodLinks(programHoods(p), D) : esc(programHoods(p).join(', '))}</b></span>` : ''}
      <span>Grades <b>${esc(gradeText(p))}</b></span>
      ${p.pickupBy ? `<span>Pick up by <b>${esc(p.pickupBy)}</b></span>` : ''}
      ${revs.length ? `<span><b>${avg.toFixed(1)} out of 5</b> from ${revs.length} ${revs.length === 1 ? 'review' : 'reviews'}</span>` : ''}
      <span>Checked <b>${longDate(p.lastVerified)}</b></span>
    </div>`;
  const body = `<div data-program-page="${esc(p.id)}" style="display:contents">
  <section class="section">
    <h2>${T(`The details`)}</h2>
    <article class="prog solo">
      ${gradeStrip(p)}
      <dl>${rows}</dl>
      ${p.note ? `<p class="flag">${esc(p.note)}</p>` : ''}
      <div class="actions">${regUrl ? `<a class="btn primary" data-track="register" href="${esc(regUrl)}" target="_blank" rel="noopener">${esc(r.label || 'Register')}</a>` : ''}<a class="btn" data-track="website" href="${esc(outUrl(p.website, { type: 'website', program: p }))}" target="_blank" rel="noopener">Website</a>${camp ? (p.daysOff ? `<a class="btn" href="${link(offPath, D)}#${esc(p.id)}">${T(`See its camp days`)}</a>` : '') + (p.weekend ? `<a class="btn" href="${link(weekendPath, D)}#${esc(p.id)}">${T(`See its weekend classes`)}</a>` : '') : `<a class="btn needs-js" href="${link('board/', D)}?add=${esc(p.id)}">${T(`Add to your week`)}</a>`}</div>
    </article>
    <p class="hint">${T(`Prices, hours and pickup routes change during the year. Confirm with the provider before you enroll.`)}</p>
  </section>
  ${clubsHtml}
  ${alertsBox(D, { program: p, place: 'program', title: T(`Tell me when sign-ups open`), lede: T(`One email when {program} posts a sign-up date, a deadline or a day-off camp. Just this program. For every program at your school, sign up on your school’s page.`, { program: fullName(p) }) })}
  ${camp ? `<section class="section" id="schools">
    <h2>${p.daysOff && p.weekend ? T(`Listed for its day camps and weekend classes`) : p.weekend ? T(`Listed for its weekend classes`) : T(`Listed for its day camps`)}</h2>
    <p>${T(`We couldn’t find a weekday after-school program here, so it isn’t on any school’s page.`)} ${p.daysOff ? T(`It runs camps on days school is closed, and children from any school can go.`) + ` <a href="${link(offPath, D)}#${esc(p.id)}">${T(`See its camp days.`)}</a> ` : ''}${p.weekend ? T(`It runs classes on weekends.`) + ` <a href="${link(weekendPath, D)}#${esc(p.id)}">${T(`See its weekend classes.`)}</a>` : ''}</p>
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
  const body = `${filterBar({ list, depth: 1, show: { day: true }, searchLabel: `Find a program`, placeholder: 'A name, or try drums, art, chess…' })}
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
const finderBox = (depth, label, withPrograms = false) => `<div class="find" data-finder${withPrograms ? ' data-programs' : ''} data-root="${link('', depth) === './' ? '' : link('', depth).replace(/index\.html$/, '')}" data-index="${PREVIEW ? 'index.html' : ''}"${PREVIEW ? '' : ` data-src="${link('data/school-finder.json', depth)}"`}>
      <label for="find-school">${T(label || `Find your school`)}</label>
      <input id="find-school" type="search" role="combobox" aria-expanded="false" aria-controls="finder-list" aria-autocomplete="list" placeholder="${withPrograms ? 'Start typing a school or program name' : 'Start typing a school name'}" autocomplete="off">
      <ul id="finder-list" class="finder-list" role="listbox" aria-label="${withPrograms ? 'Schools and programs' : 'Schools'}" hidden></ul>
      <p class="hint">${T(`Every district and charter school in the city is in here. If yours isn’t covered yet, you can ask for it.`)} <noscript><a href="${link('schools/', depth)}">See the schools covered so far.</a></noscript></p>
      ${PREVIEW ? `<script type="application/json" id="finder-data">${JSON.stringify(finderData).replace(/</g, '\\u003c')}</script>` : ''}
    </div>`;

function schoolsPage() {
  const rows = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => schoolRow(s, 1)).join('\n');
  const hero = `    <h1>${T(`Schools`)}</h1>
    <p class="lede">${T(`Search for any district or charter school in Philadelphia. The ones below already have a page; the rest you can ask for.`)}</p>
    ${finderBox(1)}`;
  const body = `<section class="section" id="covered">
  <h2>${T(`Covered so far`)}</h2>
  <div class="schools">
${rows}
  </div>
  <p>${T(`Schools are added one at a time, because every pickup list has to be checked. The ones parents ask for most go first.`)}</p>
</section>`;
  return layout({ title: 'Schools', description: `Find after-school programs by school in Philadelphia. ${listNames(schools.map(s => s.shortName))} are covered so far; ask for yours.`, pathName: 'schools/', depth: 1, current: 'schools/', hero, body, showStreet: 'parked',
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Schools', itemListElement: [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: `${cfg.siteUrl}/${x.id}/` })) } });
}

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
  const body = `<div data-school-page="${esc(s.id)}" style="display:contents">
  ${nextOff(1, list)}
  ${filterBar({ list, depth: 1, school: s, show: { hood: false } })}
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
  ${alertsBox(1, { school: s, place: 'school', title: T(`Get {school} dates by email`, { school: s.shortName }), lede: T(`Sign-up openings and deadlines for these programs, and a heads-up before each day off.`) })}
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
  const body = `${nextOff(0)}
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
<section class="section" id="schools">
  <h2>${T(`Schools covered so far`)}</h2>
  <div class="chips-row">${covered.slice(0, 12).map(s => `<a class="btn" href="${link(s.id + '/', 0)}">${esc(s.shortName)}</a>`).join('')}<a class="btn quiet" href="${link('schools/', 0)}">${covered.length > 12 ? `All ${covered.length} schools` : T(`All schools`)}</a></div>
  <p>${T(`Schools are added one at a time, because every pickup list has to be checked. Search for yours above and ask for it: the ones parents ask for most go first.`)}</p>
</section>
${alertsBox(0, { place: 'home', title: T(`Get the dates by email`), lede: T(`Sign-up openings, deadlines and days off for your school, so none of them sneaks up on you.`) })}
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
</section>`;
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
  const hero = `    <p class="where"><a href="${link('neighborhoods/', D)}">${T(`All neighborhoods`)}</a></p>
    <h1>${T(`After school in {name}`, { name: h.name })}</h1>
    <p class="lede">${T(`The schools in {name}, the after-school programs based there, and the ones that come to pick up.`, { name: h.name })}</p>
    <div class="facts">
      ${h.schools.length ? `<span><b>${h.schools.length}</b> ${h.schools.length === 1 ? 'school' : 'schools'}</span>` : ''}
      <span><b>${based.length}</b> ${based.length === 1 ? 'program' : 'programs'} based here</span>
      ${comes.length ? `<span><b>${comes.length}</b> more that pick up</span>` : ''}
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

function privacyPage() {
  const mail = cfg.contactEmail ? `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : '';
  const hero = `    <h1>${T(`Privacy, in plain English`)}</h1>
    <p class="lede">${T(`This site is run by one parent. It collects as little as it can. Here is what it does collect, where it goes, and how to have it removed.`)}</p>`;
  const body = `<div class="prose">
  <h2>${T(`The short version`)}</h2>
  <ul>
    <li>${GROUPS ? T(`There are no ads, and nothing you send is sold. An account is optional: it is for keeping your school or a week in a profile, and for sharing a week with someone.`) : T(`There are no accounts and no ads, and nothing you send is sold.`)}</li>
    <li>${GROUPS ? T(`Your rosters, including any child’s name you type, are saved in your own browser. They are not sent to us unless you sign in and choose to keep one in your profile or share one.`) : T(`Your rosters, including any child’s name you type, are saved in your own browser. They are not sent to us.`)}</li>
    <li>${T(`If you send a suggestion or a review, it arrives as an email to the person who runs the site.`)}</li>
    ${ALERTS ? `<li>${T(`If you ask for dates by email, your first name, your email address and the school or program you picked are kept by Klaviyo, the service that sends the emails.`)}</li>` : ''}
    <li>${T(`We use Google Analytics and Microsoft Clarity to see how the site is used, so we can fix what’s confusing.`)}</li>
  </ul>
  <h2 id="rosters">${T(`Rosters and children’s names`)}</h2>
  <ul>
    <li>${T(`A roster lives in the browser you made it in. Clearing your browser’s site data deletes it.`)}</li>
    <li>${T(`If you save a school as yours, that choice is kept in your own browser too. Our visit counts record that a school was saved, not who saved it.`)}</li>
    <li>${T(`A child’s name is optional. If you add one, it stays on your device unless you keep or share that week through an account.`)}</li>
    <li>${T(`A week can no longer be shared as a link. A link showed the week to anyone who had it and could not be taken back, so links made before October 2026 have stopped opening.`)}</li>
    <li>${T(`If one of those older links is opened, the site still removes the name from the page address before any analytics loads. The roster page is set to be hidden in session recordings.`)}</li>
    <li>${T(`Making a card happens on your own device. What you do with the picture is up to you.`)}</li>
    <li>${T(`If you add a photo to a week card, the card is made in your own browser. The photo is not uploaded, not saved, and gone when you close the page.`)}</li>
  </ul>
  ${GROUPS ? `<h2 id="groups">${T(`Accounts, profiles and sharing`)}</h2>
  <p>${T(`An account is optional. It lets you keep your school and a child’s week in a profile, share a week with one person, and join a share group of a few families who know each other. These are the only parts of the site that keep anything about a child on our server, and only when you choose to use them.`)}</p>
  <ul>
    <li>${T(`An account is an email address and your first and last name. The email signs you in and tells you when someone opens a week you shared or joins a group you made. Other members never see it.`)}</li>${GROUPS.google ? `
    <li>${T(`You can sign in with Google instead of an emailed code. Google’s button is loaded on the pages where you sign in, so Google can see that someone opened that page. If you use it, Google tells us your name and email address. We ask for nothing else and never see your Google password.`)}</li>` : ''}
    <li>${T(`If you keep your school in your profile, we store which school. If you keep your children’s grades, we store the grades and nothing about which child is in which. If you keep a week in your profile, we store the child’s first name, the programs on their current and upcoming weeks, and the school each program was picked under, so the week can be put back on another device. Notes you type are not stored.`)}</li>
    <li>${T(`Sharing a week with one person sends an invitation to the address you give. It only opens for someone signed in with that address, they can look and print but not change anything, and you can take it back at any time.`)}</li>
    <li>${T(`Making an account also adds your name and email to our email list, kept by Klaviyo, for occasional news about the site. Every email has an unsubscribe link, and unsubscribing does not affect your account.`)}</li>
    <li>${T(`There are no passwords. We email you a link and a 6-digit code; each works once and for 15 minutes. A cookie then keeps that device signed in for 30 days, and you can sign out everywhere from your account page.`)}</li>
    <li>${T(`When you add a week to a group, we store the child’s first name as you type it and the programs on their current and upcoming weeks. We do not store a last name, school, address, pickup time, note, teacher’s name, photo, price or day-off plan.`)}</li>
    <li>${T(`Nobody can find a group or ask to join one. The person who made it invites email addresses, and only someone signed in with an invited address, who also has the code from the invitation, gets in. A group isn’t listed anywhere, and its link shows nothing to anyone else.`)}</li>
    <li>${T(`If someone invites you, they give us your email address so we can send the invitation and recognise you if you join. We keep it with that group, use it for nothing else, and delete it when you are removed or the group ends. The invitation shows the name and email of the person who invited you.`)}</li>
    <li>${T(`A group’s creator sees the name and email address of each adult in it; other members don’t.`)}</li>
    <li>${T(`Someone who joins to view only, such as a caregiver, can see and print the group and cannot change it.`)}</li>
    <li>${T(`Anyone in a group can print it or take a screenshot, so keep groups to people you know and would tell where your child is anyway.`)}</li>
    <li>${T(`Accounts, profiles and groups are kept in a file on our web host, outside the public site. Google Analytics and Microsoft Clarity are not loaded on the account, invitation and group pages. The Build your week page does load them: it is hidden in session recordings, and analytics is told only that something was kept or shared, never what or with whom.`)}</li>
    <li>${T(`We keep a daily count of how many accounts, shared weeks and groups were made, to see whether this is used. The counts hold no names, addresses or weeks.`)}</li>
    <li>${T(`You can take a week out of your profile or out of a group, stop sharing, leave a group, or delete your account from the site at any time, and it is removed straight away. A group’s creator can remove anyone. Every shared week and group is deleted two weeks after the last day of school.`)}</li>
    <li>${T(`Accounts are for parents, caregivers and teachers. Children should not make one.`)}</li>
  </ul>` : ''}
  <h2 id="forms">${T(`Suggestions, corrections and reviews`)}</h2>
  <ul>
    <li>${T(`What you type into a form is emailed to the site’s inbox, and a backup copy is kept on our web host in case the email goes missing.`)}</li>
    <li>${T(`Your email address is used only to reply to you or to confirm something. It is never published.`)}</li>
    <li>${T(`A review that is approved appears on the site with your first name, your child’s school and the month. Nothing else about you is shown.`)}</li>
    <li>${T(`Asking for a school to be covered sends only the school’s name.`)}</li>
    <li>${T(`Please don’t include children’s names or other people’s personal details in what you send.`)}</li>
  </ul>
  ${ALERTS ? `<h2 id="email">${T(`Dates by email`)}</h2>
  <ul>
    <li>${T(`The sign-up form sends three things: your first name, your email address and the school or program you chose. They go from your browser to Klaviyo, the email service we use, and are stored there.`)}</li>
    <li>${T(`It never asks for a child’s name, grade or anything else about your family, and your roster is not sent with it.`)}</li>
    <li>${T(`Klaviyo also notes which page you signed up on. Like most email services, it records whether an email was opened and which links were clicked, and it may estimate a general location from your internet connection.`)}</li>
    <li>${T(`Your name and address are used for these date emails and nothing else. They are not shared with the programs listed here, and they are not sold.`)}</li>
    <li>${T(`Every email has an unsubscribe link, and using it stops the emails. To have your name and address deleted altogether, email us.`)}</li>
    <li>${T(`Klaviyo handles that data under its own terms:`)} <a href="https://www.klaviyo.com/legal/privacy-notice" target="_blank" rel="noopener">${T(`Klaviyo’s privacy notice`)}</a>.</li>
  </ul>
  ` : ''}<h2 id="analytics">${T(`Analytics and recordings`)}</h2>
  <ul>
    <li>${T(`Google Analytics records which pages are visited and which buttons, filters and searches are used, along with general details such as device type and approximate location. That includes the words typed into the program search box.`)}</li>
    <li>${T(`Microsoft Clarity records how pages are used, including heatmaps and replays of scrolling and clicking, to help us improve the site. We have set it to hide form fields and the roster page.`)}</li>
    <li>${T(`Both services use cookies and similar technologies, and Google and Microsoft handle that data under their own privacy terms:`)} <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">${T(`how Google uses information from sites that use its services`)}</a>, <a href="https://www.microsoft.com/privacy/privacystatement" target="_blank" rel="noopener">${T(`the Microsoft Privacy Statement`)}</a>.</li>
    <li>${T(`You can block both with your browser’s privacy settings or a content blocker, and the site will still work.`)}</li>
    <li>${T(`Like every website, our host keeps standard server logs, which include IP addresses.`)}</li>
  </ul>
  <h2 id="elsewhere">${T(`Links to other sites`)}</h2>
  <p>${T(`Program websites, registration pages, calendars and Venmo are run by other organizations and have their own privacy practices.`)}</p>
  <p>${T(`Links to a program’s own site carry a short tag saying the visit came from {site}, and from which school’s page. The tag says nothing about you.`, { site: cfg.siteName })}</p>
  <h2 id="children">${T(`Children`)}</h2>
  <p>${T(`This site is written for parents and caregivers. It is not meant to be used by children, and we do not knowingly collect information from them.`)}</p>
  <h2 id="remove">${T(`Seeing or removing what you sent`)}</h2>
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
    <p class="lede">${T(`Plenty of good programs are off the radar: a church basement, a dance studio that walks kids over, a neighbor who runs a homework club. Tell us and we’ll check it and add it. You can also fix a listing or ask for your school.`)}</p>`;
  const chips = (name, legend, values, attrs = '') => `<fieldset class="field chips"${attrs}>
      <legend>${T(legend)}</legend>
      <div class="chip-row">${values.map((v, i) => `<label class="chip"><input type="radio" name="${name}" value="${esc(v)}"${i === 0 ? ' checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div>
    </fieldset>`;
  const body = `<div class="suggest">
  <form class="form panel" method="post" action="send.php" id="suggest-form" data-clarity-mask="true">
    ${chips('kind', 'What are you sending?', ['A program that’s missing', 'A correction to a listing', 'A school to add'])}
    <div class="field" data-show="school" hidden>
      <label for="f-newschool">${T(`School name`)}</label>
      <input id="f-newschool" name="newschool" type="text" maxlength="120" autocomplete="off" disabled>
      <span class="hint">${T(`The neighborhood helps too, if you know it.`)}</span>
    </div>
    <div class="pair" data-show="program correction">
      <div class="field">
        <label for="f-school">${T(`Which school?`)}</label>
        <select id="f-school" name="school">
          ${opts}
          <option>Another school</option>
        </select>
        <span class="hint">${T(`For another school, name it in the details.`)}</span>
      </div>
      <div class="field">
        <label for="f-program">${T(`Program name`)}</label>
        <input id="f-program" name="program" type="text" maxlength="150" autocomplete="off">
      </div>
    </div>
    <div class="field" data-show="program correction">
      <label for="f-website" data-text-program="Website or link, if there is one" data-text-correction="Link that shows the right information, if you have one">Website or link, if there is one</label>
      <input id="f-website" name="website" type="text" maxlength="300" inputmode="url" autocomplete="off" placeholder="https://">
    </div>
    ${chips('pickup', 'Does it pick up from the school?', ['Not sure', 'Yes, staff pick up', 'It runs at the school', 'No pickup'], ' data-show="program"')}
    <div class="field">
      <label for="f-details" data-text-program="Details" data-text-correction="What needs fixing?" data-text-school="Anything else? (optional)">Details</label>
      <span class="hint" data-text-program="Grades, days and hours, cost, who to contact. Whatever you know." data-text-correction="What the listing says now, and what it should say." data-text-school="Programs you already know serve this school, or why it should be next.">Grades, days and hours, cost, who to contact. Whatever you know.</span>
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
      <li>${T(`If it holds up, it goes on the school’s page with its source and the date.`)}</li>
    </ol>
    <p class="hint">${T(`Nothing is published automatically, and nobody pays to be listed.`)}</p>
  </aside>
</div>`;
  return layout({ title: 'Suggest a program', description: `Tell ${cfg.siteName} about an after-school program that’s missing, a correction, or a school to add.`, pathName: 'suggest/', depth: 1, current: 'suggest/', hero, body, showStreet: 'parked' });
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
$pickup = one_line(field('pickup', 60));
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
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  $email = '';
}

$body = "Type: $kind\\n"
  . "School: $school\\n"
  . "New school: $newschool\\n"
  . "Program: $program\\n"
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

// ---------- days off: when district schools are closed, and who runs something ----------
function daysOffPage() {
  const D = 1;
  const upcoming = d => p => p.daysOff.dates.filter(x => d.dates.includes(x));
  const noDates = campPrograms.filter(p => !p.daysOff.dates.some(x => x >= TODAY));
  const dayRows = offDays.map(d => {
    const camps = campsOn(d);
    const many = d.dates.length > 1;
    return `<details class="offday" id="d-${d.date}" data-until="${d.until}">
  <summary><b>${d.end ? `${shortDate(d.date)} – ${shortDate(d.end)}` : dayDate(d.date)}</b><span>${esc(d.name)}</span><span class="pill ${camps.length ? 'onsite' : 'nearby'}">${camps.length ? `${camps.length} ${camps.length === 1 ? 'camp' : 'camps'} posted` : 'None posted yet'}</span></summary>
  <div class="offwho">
    ${camps.length ? `<p class="chips-row">${camps.map(p => `<a class="btn" href="#${esc(p.id)}">${esc(p.name)}${many && upcoming(d)(p).length < d.dates.length ? ` <span class="hint">(${upcoming(d)(p).map(shortDate).join(', ')})</span>` : ''}</a>`).join('')}</p>` : `<p class="hint">No listed program has posted a camp for ${many ? 'this break' : 'this day'} yet. The programs below that haven’t posted dates may still cover it.</p>`}
    ${d.note ? `<p class="hint">${esc(d.note)}</p>` : ''}
    ${d.dates.filter(x => x >= TODAY).map(x => `<div class="offpick" data-off-day="${x}" data-clarity-mask="true" hidden></div>`).join('')}
  </div>
</details>`;
  }).join('\n');
  const cards = campPrograms.map(p => {
    const dates = p.daysOff.dates.filter(x => x >= TODAY);
    const served = servedBy(p);
    return `<article class="prog offprog" id="${esc(p.id)}">
  <div class="top"><h3><a href="${link(programPath(p), D)}">${esc(fullName(p))}</a></h3><p class="tags">${p.types.map(t => `<span class="tag" style="--tc:${TYPE[t].color}">${esc(TYPE[t].label)}</span>`).join('')}</p></div>
  <dl><dt>What it runs</dt><dd>${esc(p.daysOff.summary)}</dd>
  <dt>Dates posted</dt><dd>${dates.length ? esc(dates.map(shortDate).join(', ')) + '.' : 'None on its site when we checked. Ask which days it covers.'}</dd>
  ${programAddress(p) ? `<dt>Where</dt><dd>${esc(programAddress(p))}</dd>` : ''}
  ${served.length ? `<dt>On school days</dt><dd>${esc(servedSummary(p))}.</dd>` : ''}</dl>
  <div class="actions"><a class="btn primary" data-track="camp" href="${esc(outUrl(p.daysOff.url, { type: 'camp', program: p }))}" target="_blank" rel="noopener">Camp details</a><a class="btn" href="${link(programPath(p), D)}">Full listing</a></div>
  <p class="src">Checked ${longDate(p.lastVerified)}. Sources: ${sourceLinks(p.daysOff.sources, p)}</p>
</article>`;
  }).join('\n');
  const hero = `    <h1>${T(`School’s closed. Now what?`)}</h1>
    <p class="lede">${T(`Day camps for the days district schools are closed this year, and a schedule you can build from them.`)}</p>
    <div class="facts">
      <span>School year <b>${esc(daysOff.schoolYear)}</b></span>
      <span>Calendar checked <b>${longDate(daysOff.checked)}</b></span>
      <span><b>${campPrograms.length}</b> programs run something</span>
    </div>`;
  const planData = {
    programs: Object.fromEntries(campPrograms.map(p => [p.id, { name: p.name, url: p.daysOff.url, color: TYPE[p.types[0]].color }])),
    site: cfg.siteUrl, qr: cardQr?.dayoff && cardQr.dayoff.text.toLowerCase().startsWith(cfg.siteUrl.toLowerCase() + '/') ? cardQr.dayoff.rows : null,
    days: offDays.flatMap(d => d.dates.filter(x => x >= TODAY).map(x => ({ d: x, label: dayDate(x), name: d.name, camps: campPrograms.filter(p => p.daysOff.dates.includes(x)).map(p => p.id) }))),
    page: `${cfg.siteUrl}/${offPath}`,
  };
  const body = `<div style="display:contents">
<section class="section offplan needs-js-block" id="plan" data-off-plan data-clarity-mask="true">
  <h2>${T(`Build your day-camp schedule`)}</h2>
  <p>${T(`Open a day below and choose where your child will be. Your picks are saved on this device and gathered here.`)}</p>
  <div class="kids" id="off-kids" role="group" aria-label="Which child" hidden></div>
  <p class="off-count" id="off-count"></p>
  <ol class="off-list" id="off-list"></ol>
  <div class="actions" id="off-actions" hidden><button type="button" class="clear" id="off-clear">Clear this plan</button></div>
  <p class="hint" id="off-status" aria-live="polite"></p>
  <div class="card-maker offcard" id="off-card" hidden>
    <h3>${T(`Make it a card`)}</h3>
    <p>${T(`One picture of the days off to text to a sitter, a grandparent or the group chat.`)}</p>
    <div class="card-grid">
      <div class="card-fields">
        <div class="field">
          <label for="off-note">${T(`A note (optional)`)}</label>
          <input id="off-note" type="text" maxlength="110" placeholder="Grandpa does drop-off on camp days." autocomplete="off">
        </div>
        <div class="field">
          <label for="off-photo">${T(`Your child’s photo (optional)`)}</label>
          <input id="off-photo" type="file" accept="image/*">
          <span class="hint">${T(`The photo never leaves this device. The card is made here in your browser, nothing is uploaded, and the photo isn’t saved.`)}</span>
          <button type="button" class="clear" id="off-photo-clear" hidden>Remove the photo</button>
        </div>
        <div class="actions">
          <button type="button" class="btn primary" id="off-share" hidden>Share the card</button>
          <button type="button" class="btn" id="off-copy-pic" hidden>Copy picture</button>
          <button type="button" class="btn" id="off-save">Save as image</button>
          <button type="button" class="btn" id="off-print">Print</button>
        </div>
        <p class="hint" id="off-card-status" aria-live="polite"></p>
      </div>
      <div class="card-preview"><canvas id="off-canvas" width="1080" height="1350" role="img" aria-label="Preview of the day-camp schedule card"></canvas></div>
    </div>
  </div>
  <script type="application/json" id="off-data">${JSON.stringify(planData).replace(/</g, '\\u003c')}</script>
</section>
<section class="section" id="days">
  <h2>${T(`Days off still to come`)}</h2>
  <p>${T(`These are the School District of Philadelphia’s dates. Open a day to see who has posted a camp for it. A program is named only when its own site lists that date.`)}</p>
  <div class="offdays">
${dayRows}
  </div>
  <p class="src">Calendar: <a href="${esc(daysOff.source.url)}" target="_blank" rel="noopener">${esc(daysOff.source.label)}</a></p>
</section>
${alertsBox(D, { place: 'days_off', title: T(`Get a heads-up before each day off`), lede: T(`An email at least {n} days ahead, with the listed programs running a camp that day.`, { n: LEAD.dayoff }) })}
<section class="section" id="who">
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
    pathName: offPath, depth: D, current: offPath, hero, body, theme: 'dayoff', showStreet: 'dayoff',
    shareImage: { file: 'share-days-off.png', alt: `${cfg.siteName} day-off programs: a park on a morning with no school, a kite going up and a school bus parked` },
    jsonLd: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Day-camp programs', `${cfg.siteUrl}/${offPath}`]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
  });
}

// ---------- share groups (accounts, class codes) ----------
// "groups" in site.config.json turns them on. While "pilot" is true nothing links to them: the pages exist at
// /account/ and /groups/, and the block on the roster page only shows in a browser that has visited one of them.
const GROUPS = cfg.groups && cfg.contactEmail ? { pilot: cfg.groups.pilot !== false, klaviyoList: cfg.groups.klaviyoList || '', google: /^[0-9a-z-]+\.apps\.googleusercontent\.com$/.test(cfg.groups.googleClientId || '') ? cfg.groups.googleClientId : '' } : null;
const groupsAttrs = depth => `data-groups data-root="${link('', depth) === './' ? '' : link('', depth).replace(/index\.html$/, '')}" data-index="${PREVIEW ? 'index.html' : ''}" data-api="${PREVIEW ? '' : link('groups/api.php', depth)}"${GROUPS.klaviyoList && ALERTS?.klaviyoKey ? ` data-kl-key="${esc(ALERTS.klaviyoKey)}" data-kl-list="${esc(GROUPS.klaviyoList)}"` : ''}${GROUPS.google && !PREVIEW ? ` data-google="${esc(GROUPS.google)}"` : ''} data-pilot="${GROUPS.pilot ? 1 : 0}"`;
const groupsScript = depth => `<script src="${link('assets/groups.js', depth)}${GROUPS_V}"></script>`;
function accountPage(register = false) {
  // Two addresses, one form. /register/ is the page that makes the case for an account: what you get on one side, the
  // form on the other. /account/ is where you log in and, once signed in, your profile; both of its headings are in
  // the page and the right one shows before it paints. Someone already signed in who opens /register/ is sent on.
  const hero = register ? `    <h1>${T(`Create your free account`)}</h1>
    <p class="lede">${T(`Save your school, your kids’ grades and your week, and share a week with the people who need it. It takes about a minute, and there’s no password to remember.`)}</p>`
    : `    <h1><span class="when-out">${T(`Log in to your account`)}</span><span class="when-in">${T(`Your account`)}</span></h1>
    <p class="lede when-out">${T(`Your school, your kids’ grades and your week, on any device. There’s no password to remember.`)} ${T(`New here?`)} <a href="${link('register/', 1)}">${T(`Create a free account`)}</a></p>
    <p class="lede when-in">${T(`Keep your school and your child’s week in a profile, so they’re on every device you sign in on, and share a week with one person. Everything else on the site works without an account.`)}</p>`;
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
    <div class="g-page" id="account"${register ? ' data-mode="register"' : ''}></div>
    <section class="acct-why when-out" aria-labelledby="acct-why-h">
      <div class="acct-art">${art}</div>
      <h2 id="acct-why-h">${T(`What an account gives you`)}</h2>
      <ul class="acct-points">
        <li><b>${T(`Save your school.`)}</b> ${T(`Every list starts from it, on any device you sign in on.`)}</li>
        <li><b>${T(`Save your kids’ grades.`)}</b> ${T(`Lists open on the programs that take them.`)}</li>
        <li><b>${T(`Keep your week.`)}</b> ${T(`Build it on your phone tonight, find it on your laptop tomorrow.`)}</li>
        <li><b>${T(`Share a week with one person.`)}</b> ${T(`A grandparent or a sitter signs in to see it, and you can take it back.`)}</li>
      </ul>
      <p class="hint">${T(`It’s free. Nothing goes into your profile unless you put it there, and you can delete the account whenever you like.`)}</p>
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
  <script type="application/json" id="groups-data">${JSON.stringify({ grades: GRADES, schools: [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => ({ id: s.id, name: s.shortName })) }).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: register ? 'Create a free account' : 'Your account', description: register ? `Create a free ${cfg.siteName} account to save your school, your kids’ grades and your week, and to share a week.` : `Sign in to ${cfg.siteName} to keep your school and week in a profile, or to share a week.`, pathName: register ? 'register/' : 'account/', depth: 1, current: null, hero, body, noindex: true, quiet: true, scripts: groupsScript(1) });
}
// What the group and join pages need to know about programs: names and colors to show, classes to recognise.
const groupsInfo = () => ({
  site: cfg.siteName,
  types: Object.fromEntries(TYPES.map(t => [t.id, { color: t.color }])),
  programs: Object.fromEntries(programs.map(p => [p.id, { name: p.name, type: p.types[0], offers: p.offers || [] }])),
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
  const conf = JSON.stringify({ siteName: cfg.siteName, siteUrl: cfg.siteUrl, from: cfg.contactEmail, yearEnd: end, googleClientId: GROUPS.google, grades: GRADES });
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
$file = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-data/groups.sqlite';
$have = is_file($file);
$tiles = array(); $bySchool = array(); $days = array(); $ever = array();
$cols = array('account' => 'New accounts', 'signin_email' => 'Sign-ins by email', 'signin_google' => 'Sign-ins with Google', 'week_saved' => 'Weeks kept', 'school_saved' => 'Schools kept', 'grades_saved' => 'Grades kept', 'share' => 'Weeks shared with one person', 'group' => 'Groups started', 'invite' => 'Invitations', 'join' => 'Invitations accepted', 'account_deleted' => 'Accounts deleted');
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
  $tiles[] = array($n('SELECT COUNT(DISTINCT user_id) FROM sessions WHERE seen > ?', array($t - 30 * 86400)), 'people signed in during the last 30 days', '');
  $tiles[] = array($n("SELECT COUNT(*) FROM users WHERE via = 'google'"), 'accounts made with Google', ($accounts - $n("SELECT COUNT(*) FROM users WHERE via = 'google'")) . ' made with an emailed code');
  $tiles[] = array($n('SELECT COUNT(*) FROM users WHERE listed = 1'), 'accounts added to the email list', $n("SELECT COUNT(*) FROM users WHERE first = ''") . ' accounts haven’t added a name yet');
  $tiles[] = array($n("SELECT COUNT(*) FROM users WHERE school != ''"), 'profiles with a school kept', '');
  $tiles[] = array($n("SELECT COUNT(*) FROM users WHERE grades != ''"), 'profiles with grades kept', $gradeLine);
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
  </div>${GATED ? '\n  <p class="hint">You’re signed in on this device for 30 days. <a href="?out=1">Sign out</a></p>' : ''}${GATED && GROUPS ? '\n  <p><a class="btn" href="stats/">Site numbers: accounts, shared weeks and groups</a></p>' : ''}
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
  ['Kensington, Fishtown and North', ['South Kensington', 'Kensington', 'Fishtown', 'Northern Liberties', 'Fairhill', 'Port Richmond']],
  ['Northwest', ['Mount Airy', 'Germantown', 'Chestnut Hill', 'Roxborough', 'Manayunk', 'East Falls']],
  ['West Philly', ['Cobbs Creek', 'West Fairmount Park', 'University City', 'West Philadelphia']],
  ['Northeast', ['Fox Chase']],
];
const campAreas = c => { const n = c.neighborhoods || []; if (!n.length) return CAMP_AREAS.map(a => a[0]); const out = new Set(n.map(x => (CAMP_AREAS.find(a => a[1].includes(x)) || ['Elsewhere in the city'])[0])); return [...out]; };
const seasonPill = c => c.season ? `<span class="pill season ${campsFile && c.season > campsFile.season ? 'next' : 'nearby'}">${c.season > campsFile.season ? 'Summer ' + c.season : c.season + ' details'}</span>` : `<span class="pill season none">No dates yet</span>`;
function summerCampsPage() {
  const D = 1;
  const base = campsFile.season, next = base + 1;
  const list = [...summerCamps].sort((a, b) => a.name.localeCompare(b.name));
  const shaped = list.map(c => ({ ...c, neighborhoods: campAreas(c) }));   // what the filter bar sees
  const ahead = list.filter(c => c.season > base).length;
  const cards = list.map((c, i) => {
    const where = [c.address, (c.neighborhoods || []).join(', ')].filter(Boolean);
    const rows = [['Ages', c.ages], ['Weeks', c.weeks], ['Hours', c.hours], ['Before and after', c.extended], ['Cost', c.cost], ['Help with cost', c.aid], ['Where', where.length === 2 ? `${where[0]} (${where[1]})` : where[0]], ['Signing up', c.signup], ['Phone', c.phone]]
      .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${k === 'Phone' ? `<a href="tel:+1-${esc(v)}">${esc(v)}</a>` : esc(v)}</dd>`).join('');
    const prog = c.program ? programs.find(p => p.id === c.program) : null;
    return `<article class="prog offprog camp" id="${esc(c.id)}" ${itemAttrs(shaped[i], [c.ages || '', c.address || '', ...(c.neighborhoods || [])])}>
  <div class="top"><h3>${esc(c.name)}</h3><p class="what">${esc(c.what)}</p><p class="tags">${c.types.map(t => `<span class="tag" style="--tc:${TYPE[t].color}">${esc(TYPE[t].label)}</span>`).join('')}</p><p>${seasonPill(c)}</p></div>
  <dl>${rows}</dl>
  ${c.note ? `<p class="flag">${esc(c.note)}</p>` : ''}
  <div class="actions"><a class="btn primary" data-track="camp" href="${esc(outUrl(c.registerUrl || c.website, { type: 'camp' }))}" target="_blank" rel="noopener">${c.registerUrl ? 'Find or book a spot' : 'Camp details'}</a>${c.registerUrl ? `<a class="btn" data-track="website" href="${esc(outUrl(c.website, { type: 'camp' }))}" target="_blank" rel="noopener">Camp details</a>` : ''}${prog ? `<a class="btn" href="${link(programPath(prog), D)}">Its school-year listing</a>` : ''}</div>
  <p class="src">Checked ${longDate(c.checked)}. Sources: ${sourceLinks(c.sources, c)}</p>
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
  <p class="flag camp-guide"><b>${T(`Most of what’s here is from summer {year}, shown as a guide.`, { year: base })}</b> ${T(`Camps usually post next summer between December and March. Each listing changes to {year} when its camp posts dates and prices, and says so on its card.`, { year: next })}</p>
</section>
${filterBar({ list: shaped, depth: D, searchLabel: `Looking for a particular camp?`, placeholder: 'Its name, or try art, tennis, Mount Airy…' }).replace('data-filters', 'data-filters data-noun="camp" data-nouns="camps"')}
<p class="hint">${T(`Grades here are worked out from each camp’s ages, so check the age line on the card.`)}</p>
${noMatch(D)}
<section class="section" data-group>
  <div class="list">
${cards}
  </div>
</section>
${todo.length ? `<section class="section">
  <h2>${T(`Camps we haven’t been able to read yet`)}</h2>
  <p>${T(`These run day camps in the city too. Their details go up once we’ve read them on the camp’s own site.`)}</p>
  <ul class="plain cols">${todo.map(t => `<li>${esc(t.name)}</li>`).join('')}</ul>
</section>` : ''}
<section class="section">
  <p>${T(`Know a city day camp that isn’t here, or see something out of date?`)} <a href="${link('suggest/', D)}">${T(`Tell us.`)}</a></p>
  <p class="hint">${T(`Listings come from each camp’s public pages and are not endorsements. Dates, prices and openings change, so confirm with the camp before you plan around it.`)}</p>
</section>`;
  return layout({
    title: 'Summer day camps in Philadelphia: ages, weeks, hours and prices',
    description: `${list.length} summer day camps inside Philadelphia in one list: ages, weeks, hours, cost, before and after care, and when sign-ups open. Filter by type, grade and part of the city.`,
    pathName: campsPath, depth: D, current: null, hero, body,
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, url: `${cfg.siteUrl}/${campsPath}#${c.id}` })) },
  });
}

// ---------- weekend classes: any listing with a "weekend" block ----------
const weekendPrograms = programs.filter(p => p.weekend).sort((a, b) => a.name.localeCompare(b.name));
const WEEKEND_DAY = { sat: 'Saturday', sun: 'Sunday' };
function weekendPage() {
  const D = 1;
  const cards = weekendPrograms.map(p => {
    const w = p.weekend, served = servedBy(p);
    const rows = [['What runs', w.summary], ['Term', w.term], ['Cost', w.cost], ['Where', programAddress(p)], ['On school days', served.length ? servedSummary(p) + '.' : '']]
      .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    const wp = w._grades !== undefined ? { ...p, _grades: w._grades } : p;   // the weekend classes can take other grades than the weekday program
    return `<article class="prog offprog" id="${esc(p.id)}" ${itemAttrs(wp, [...programHoods(p), ...w.days.map(d => WEEKEND_DAY[d])])} data-wk="${w.days.join(' ')}">
  <div class="top"><h3><a href="${link(programPath(p), D)}">${esc(fullName(p))}</a></h3><p class="tags">${p.types.map(t => `<span class="tag" style="--tc:${TYPE[t].color}">${esc(TYPE[t].label)}</span>`).join('')}</p><p>${w.days.map(d => `<span class="pill nearby">${WEEKEND_DAY[d]}</span>`).join(' ')} <span class="hint">Grades ${esc(gradeText(wp))}</span></p></div>
  <dl>${rows}</dl>
  ${w.note ? `<p class="flag">${esc(w.note)}</p>` : ''}
  <div class="actions"><a class="btn primary" data-track="weekend" href="${esc(outUrl(w.url, { type: 'weekend', program: p }))}" target="_blank" rel="noopener">Class details</a><a class="btn" href="${link(programPath(p), D)}">Full listing</a></div>
  <p class="src">Checked ${longDate(w.checked || p.lastVerified)}. Sources: ${sourceLinks(w.sources, p)}</p>
</article>`;
  }).join('\n');
  const hero = `    <h1>${T(`Saturday and Sunday classes`)}</h1>
    <p class="lede">${T(`Weekend classes for kids from the programs on this site: what runs, which term, and what it costs.`)}</p>
    <div class="facts">
      <span><b>${weekendPrograms.length}</b> programs with weekend classes</span>
      <span><b>${weekendPrograms.filter(p => p.weekend.days.includes('sun')).length}</b> on Sundays too</span>
    </div>`;
  const body = `${filterBar({ list: weekendPrograms.map(p => (p.weekend._grades !== undefined ? { ...p, _grades: p.weekend._grades } : p)), depth: D, show: { cost: false, day: false, hood: false }, searchLabel: `Looking for a particular class?`, placeholder: 'A name, or try piano, acting, gymnastics…' })}
${noMatch(D)}
<section class="section" data-group>
  <div class="list">
${cards}
  </div>
</section>
<section class="section">
  <p>${T(`We started with the programs already on this site. Other listed programs may run weekend classes that their sites don’t spell out by day, so ask.`)} ${T(`Know a weekend class that should be here?`)} <a href="${link('suggest/', D)}">${T(`Tell us.`)}</a></p>
  <p class="hint">${T(`Weekend terms start and fill on their own dates, so check with the provider before you count on a class.`)}</p>
</section>`;
  return layout({
    title: 'Weekend classes for kids in Philadelphia',
    description: `Saturday and Sunday classes for kids from ${weekendPrograms.length} Philadelphia programs: music, theater, art, dance and gymnastics, with terms, times and cost.`,
    pathName: weekendPath, depth: D, current: null, hero, body,
    jsonLd: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: weekendPrograms.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: fullName(p), url: `${cfg.siteUrl}/${programPath(p)}` })) },
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
write('types/index.html', typesPage());
for (const t of liveTypes()) write(`types/${t.id}/index.html`, typePage(t));
write('programs/index.html', programsPage());
for (const p of programs) write(`${programPath(p)}index.html`, programPage(p));
write('neighborhoods/index.html', neighborhoodsPage());
for (const h of hoods) write(`${hoodPath(h)}index.html`, neighborhoodPage(h));
write('support/index.html', supportPage());
write('privacy/index.html', privacyPage());
write('about/index.html', aboutPage());
write('suggest/index.html', suggestPage());
write('suggest/thanks/index.html', thanksPage());
write('ideas/index.html', ideasPage());
write('ideas/thanks/index.html', ideasThanksPage());
write('board/index.html', boardPage());
if (daysOff) write(offPath + 'index.html', daysOffPage());
if (summerCamps.length) write(campsPath + 'index.html', summerCampsPage());
if (weekendPrograms.length) write(weekendPath + 'index.html', weekendPage());
if (ALERTS) write(alertsPath + 'index.html', alertsPage());
write('review/index.html', reviewPage());
write('review/thanks/index.html', reviewThanksPage());
if (GATED) write('edit/index.php', editIndexPhp()); else write('edit/index.html', editPage());
if (GATED && GROUPS) write('edit/stats/index.php', editStatsPhp());
const notFound = notFoundPage();   // always rendered, so its copy is known to the editor
write('assets/site.css', fs.readFileSync(path.join(ROOT, 'src/site.css')));
write('assets/site.js', fs.readFileSync(path.join(ROOT, 'src/site.js')));
write('assets/edit.js', fs.readFileSync(path.join(ROOT, 'src/edit.js')));
if (GROUPS) {
  write('assets/groups.js', fs.readFileSync(path.join(ROOT, 'src/groups.js')));
  write('account/index.html', accountPage());
  write('register/index.html', accountPage(true));
  write('groups/index.html', groupPage());
  write('join/index.html', joinPage());
  if (!PREVIEW) write('groups/api.php', groupsApiPhp());
}
for (const f of fs.readdirSync(path.join(ROOT, 'src/static'))) write(f, fs.readFileSync(path.join(ROOT, 'src/static', f)));   // icons and the share image, served from the top level
if (!PREVIEW) {
  write('404.html', notFound);
  if (cfg.contactEmail) write('suggest/send.php', sendPhp());
  if (cfg.contactEmail) write('review/send.php', reviewPhp());
  if (cfg.contactEmail) write('schools/request/send.php', schoolRequestPhp());
  write('data/school-finder.json', JSON.stringify(finderData));
  if (cfg.contactEmail) write('edit/send.php', editPhp());   // after every page, so it knows every sentence
  for (const p of programs) for (const d of upcomingDates(p)) write(`cal/${p.id}-${d.date}.ics`, icsFile(p, d));
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
    ...[...(daysOff ? [offPath] : []), ...(summerCamps.length ? [campsPath] : []), ...(weekendPrograms.length ? [weekendPath] : []), ...(ALERTS ? [alertsPath] : []), 'board/', 'suggest/', 'ideas/', 'review/', 'about/', 'privacy/', 'support/'].map(u => [u, latest])];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `  <url><loc>${cfg.siteUrl}/${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
  const bare = cfg.siteUrl.replace(/^https?:\/\//, '');
  write('.htaccess', `ErrorDocument 404 /404.html\nAddType text/calendar .ics\nDirectoryIndex index.html index.php\n\n# One address for the site: www goes to the bare domain.\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteCond %{HTTP_HOST} ^www\\.${bare.replace(/\./g, '\\.')}$ [NC]\nRewriteRule ^ https://${bare}%{REQUEST_URI} [R=301,L]\n${cardQr ? `# The short addresses in the QR codes on the week card and the day-camp card.\nRewriteRule ^w/?$ ${cardQr.goesTo} [NC,R=302,L]\n${cardQr.dayoff ? `RewriteRule ^d/?$ ${cardQr.dayoff.goesTo} [NC,R=302,L]\n` : ''}` : ''}</IfModule>\n`);
}
// Edits in data/copy.json are matched to sentences by a fingerprint of the original wording.
// If the original was reworded or removed in this file, the edit no longer applies: say so, but still build.
const stale = Object.entries(copyEdits).filter(([id]) => !copyRegistry.has(id));
if (stale.length) console.warn(`\nNote: ${stale.length} edit(s) in data/copy.json no longer match any sentence on the site, so they were skipped:\n` + stale.map(([id, e]) => `- ${id}: was "${e.was || '?'}" / now "${e.now}"`).join('\n') + '\n');
const noHood = programs.filter(p => !programHoods(p).length);
if (noHood.length) console.warn(`\nNote: no neighborhood for ${noHood.map(p => p.id).join(', ')}. Add "neighborhoods" in data/programs.json so they show on a neighborhood page.\n`);
console.log(`Built ${schools.length} school page(s), ${hoods.length} neighborhood page(s), ${programs.length} program page(s) and ${copyRegistry.size} editable sentences into ${path.relative(ROOT, OUT)}/`);
