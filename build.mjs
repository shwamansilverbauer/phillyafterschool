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
  { id: 'art', label: 'Art & making', color: '#C2410C', icon: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.4-.7-.4-1.1 0-.9.7-1.7 1.7-1.7H17a4 4 0 0 0 4-4c0-4.5-4-8.2-9-8.2zM6.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z' },
  { id: 'movement', label: 'Sports & movement', color: '#1F7A3A', icon: 'M13 2 4 14h6l-1 8 9-12h-6z' },
  { id: 'stem', label: 'STEM', color: '#0E7C86', icon: 'M9 3h6v2h-1v4.6l5.2 8.6A1.8 1.8 0 0 1 17.7 21H6.3a1.8 1.8 0 0 1-1.5-2.8L10 9.6V5H9z' },
  { id: 'academics', label: 'Reading & homework', color: '#A16207', icon: 'M4 5a2 2 0 0 1 2-2h13v16H6.5a.5.5 0 0 0 0 1H19v2H6a2 2 0 0 1-2-2z' },
  { id: 'games', label: 'Games', color: '#B4237A', icon: 'M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm2.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z' },
  { id: 'clubs', label: 'School clubs', color: '#2166B8', icon: 'M5 3h2v1h11l-2.5 4L18 12H7v9H5z' },
  { id: 'rec-center', label: 'Rec centers', color: '#3F6212', icon: 'M12 2 6 10h3l-4 6h6v5h2v-5h6l-4-6h3z' },
];
const TYPE = Object.fromEntries(TYPES.map(t => [t.id, t]));
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
const CSS_V = stamp('src/site.css'), JS_V = stamp('src/site.js'), EDIT_V = stamp('src/edit.js');

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
  if (!p.schools || !Object.keys(p.schools).length) errors.push(`${at}: not linked to any school`);
  for (const [sid, l] of Object.entries(p.schools || {})) {
    if (!schoolIds.has(sid)) errors.push(`${at}: unknown school "${sid}"`);
    if (!REL[l.relation]) errors.push(`${at}: relation for ${sid} must be onsite, pickup or nearby`);
    if (l.registerUrl && !isUrl(l.registerUrl)) errors.push(`${at}: registerUrl for ${sid} must be an https URL`);
    if (l.price !== undefined && !['free', 'paid', 'both'].includes(l.price)) errors.push(`${at}: price for ${sid} must be "free", "paid" or "both"`);
    for (const s of l.sources || []) if (!isUrl(s.url)) errors.push(`${at}: source "${s.label}" for ${sid} needs an https URL`);
    if (p.register?.how === 'online' && !isUrl(l.registerUrl || p.register.url)) errors.push(`${at}: online registration needs a URL`);
  }
  if (['phone', 'school'].includes(p.register?.how) && !p.phone) errors.push(`${at}: register by phone needs a phone number`);
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

function layout({ title, description, pathName, depth, current, hero, body, scripts = '', fragment = false, showStreet = false, noindex = false, jsonLd = null, roomy = false, first = '', theme = '', shareImage = null }) {
  const canonical = cfg.siteUrl + '/' + pathName;
  // Search results show roughly 60 characters of a title and 155 of a description. The site name is added
  // to a title only when it fits; a long description is cut at a word.
  const fullTitle = pathName === '' ? (PREVIEW ? cfg.siteName : `${cfg.siteName}: ${cfg.tagline}`) : `${title} | ${cfg.siteName}`.length <= 65 ? `${title} | ${cfg.siteName}` : title;
  if (description.length > 158) description = description.slice(0, 157).replace(/\s+\S*$/, '').replace(/[,;:.]$/, '') + '…';
  const nav = [['schools/', 'Schools'], ...(daysOff ? [[offPath, 'Day-off programs']] : []), ['board/', 'Build your week'], ['suggest/', 'Suggest a program'], ['about/', 'About'], ['support/', 'Buy me a coffee']]
    .map(([to, label]) => `<a href="${link(to, depth)}"${current === to ? ' aria-current="page"' : ''}>${label}${to === 'board/' ? '<span class="count" data-board-count hidden></span>' : ''}</a>`).join('');
  const head = `${first}${fragment ? '' : gtmHead + '\n'}<title>${esc(fullTitle)}</title>
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
  const page = `${gtmBody}<script>document.documentElement.className+=' js'</script>
<header class="band${theme ? ' ' + theme : ''}">
  <div class="in bar">
    <a class="brand" href="${link('', depth)}"><span class="bus-mark"></span>${esc(cfg.siteName)}</a>
    <nav class="nav" aria-label="Site">${nav}</nav>
  </div>
  <div class="in hero">
${hero}
  </div>
  ${showStreet === 'dayoff' ? dayScene() : showStreet ? street(showStreet === 'go') : ''}
</header>
<main class="wrap${roomy ? ' roomy' : ''}">
${body}
</main>
<footer class="foot"><div class="in">
  <nav class="foot-cols" aria-label="Footer">
    <div class="foot-brand">
      <a class="brand" href="${link('', depth)}"><span class="bus-mark"></span>${esc(cfg.siteName)}</a>
      <p>${T(`After-school programs in Philadelphia, sorted by the school your child goes to.`)}</p>
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
        ${daysOff ? `<li><a href="${link(offPath, depth)}">${T(`Day-off programs`)}</a></li>` : ''}
        <li><a href="${link('suggest/', depth)}">${T(`Suggest a program`)}</a></li>
        <li><a href="${link('review/', depth)}">${T(`Write a review`)}</a></li>
      </ul>
    </div>
    <div>
      <h2><a href="${link('board/', depth)}">${T(`Your family`)}</a></h2>
      <ul>
        <li><a href="${link('board/', depth)}">${T(`Build your week`)}</a></li>
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
<script src="${link('assets/site.js', depth)}${JS_V}" data-edit="${esc(JSON.stringify(editCfg))}"></script>
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
const calDetails = p => `${p.register.url || p.website}\n\nFrom ${cfg.siteName}: ${cfg.siteUrl}/`;
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
const sourceLinks = list => list.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('');
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
  for (const p of programs) for (const n of programHoods(p)) at(n).programs.push(p);
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
const citywide = programs.filter(p => !schoolRun(p));
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
  const dayRow = on.day !== false && list.filter(pickyDays).length > 1 ? `<div class="frow"><span class="flabel">Day</span><div class="rail" role="group" aria-label="Day of the week">${btn('day', 'ALL', 'Any day', null)}${WEEK.map(d => btn('day', d, DAY_NAME[d].slice(0, 3), dayN(d))).join('')}${list.some(p => !p.days) ? `<span class="hint rail-note">Programs that don’t publish their days show under every day.</span>` : ''}</div></div>` : '';
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
  const regUrl = r.how === 'online' ? (l.registerUrl || r.url) : null;
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
  <div class="top"><span class="pill ${l.relation}">${esc(rel.pill.replace('{s}', school.shortName))}</span><h3><a href="${link(programPath(p), 1)}">${esc(p.name)}</a></h3><p class="what">${esc(p.what)}</p><p class="tags">${typeTags(p, school)}</p>${p.offers?.length ? `<p class="offers"><b>Classes:</b> ${esc(p.offers.join(', '))}</p>` : ''}</div>
  ${gradeStrip(p)}
  <dl>${rows}</dl>
  ${flag ? `<p class="flag">${esc(flag)}</p>` : ''}
  <div class="actions">${regUrl ? `<a class="btn primary" data-track="register" href="${esc(regUrl)}" target="_blank" rel="noopener">${esc(r.label || 'Register')}</a>` : ''}<a class="btn" data-track="website" href="${esc(p.website)}" target="_blank" rel="noopener">Website</a><button type="button" class="btn needs-js" data-board-toggle data-clarity-mask="true" aria-expanded="false">Add to roster</button>
    <div class="days" data-clarity-mask="true" hidden><span class="kid-row" hidden></span><span class="which" role="group" aria-label="Current or upcoming roster"><button type="button" class="wb" data-board="next" aria-pressed="true">Upcoming</button><button type="button" class="wb" data-board="now" aria-pressed="false">Current</button></span><span class="hint">Which days?</span>${BOARD_DAYS.map(([k, n]) => `<button type="button" class="day${p.days && !p.days.includes(k) ? ' off" title="Not listed for ' + DAY_NAME[k] + 's' : ''}" data-day="${k}" aria-pressed="false">${n}</button>`).join('')}${p.offers?.length ? `<span class="cls-row"><span class="hint">Which class? Optional.</span>${p.offers.map(o => `<button type="button" class="cl" data-class="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join('')}</span>` : ''}<a href="${link('board/', 1)}">See the roster</a></div></div>
  <div class="rev">${revHtml}</div>
  <p class="src">Checked ${longDate(p.lastVerified)}. Sources: ${sourceLinks([...p.sources, ...(l.sources || [])])}${fix ? `<a href="${esc(fix)}">Suggest a correction</a>` : ''}</p>
</article>`;
}

// ---------- a page per program ----------
const listNames = a => a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
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
  const regUrl = r.how === 'online' ? r.url : null;
  const reviewUrl = `${link('review/', D)}?program=${p.id}${served.length === 1 ? '&school=' + served[0].id : ''}`;
  const rows = [['Where', esc(address)], ['Classes', esc((p.offers || []).join(', '))], ['Hours', esc(p.hours)], ['Days', esc(daysLine(p))], ['Pick up by', esc(p.pickupBy || '')], ['Cost', esc(p.cost)], ['Days off', p.daysOff ? `${esc(p.daysOff.summary)} <a href="${link(offPath, D)}#${esc(p.id)}">Dates and details</a>` : ''], ['Register', registerText(p)], ['Next term', esc(r.nextTerm || '') + datesHtml(p, D)], ['Contact', r.how === 'school' ? '' : contactHtml(p)]]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const schoolRows = served.map(s => {
    const l = p.schools[s.id];
    const line = l.relation === 'onsite' ? `Runs at ${s.shortName}, so there’s no travel after the bell.`
      : l.relation === 'pickup' ? `Picks up from ${s.shortName} at dismissal, which is ${s.dismissal}.`
      : `We couldn’t find a pickup from ${s.shortName}, so your child would need to get there.`;
    const extra = [l.address ? `${s.shortName} children go to ${l.address}.` : '', l.distance ? l.distance.charAt(0).toUpperCase() + l.distance.slice(1) + '.' : ''].filter(Boolean).join(' ');
    const links = [
      l.registerUrl && r.how === 'online' ? `<a href="${esc(l.registerUrl)}" target="_blank" rel="noopener" data-track="register">${esc(r.label || 'Register')} (${esc(s.shortName)})</a>` : '',
      `<a class="needs-js" href="${link('board/', D)}?add=${esc(p.id)}&amp;school=${esc(s.id)}">Add it to your week</a>`,
      `<a href="${link(s.id + '/', D)}">All ${forSchool(s).length} options for ${esc(s.shortName)}</a>`,
      l.sources?.length ? `<span>Source: ${sourceLinks(l.sources)}</span>` : '',
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
  const hero = `    <p class="where"><a href="${link('programs/', D)}">${T(`All programs`)}</a> / ${esc(servedSummary(p))}</p>
    <h1>${esc(fullName(p))}</h1>
    <p class="lede">${esc(p.what)}</p>
    <div class="facts">
      <span>${p.types.map(t => typeCount(TYPE[t]) && !schoolRun(p) ? `<a href="${link('types/' + t + '/', D)}">${esc(TYPE[t].label)}</a>` : esc(TYPE[t].label)).join(', ')}</span>
      ${programHoods(p).length ? `<span>In <b>${hoodLinks(programHoods(p), D)}</b></span>` : ''}
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
      <div class="actions">${regUrl ? `<a class="btn primary" data-track="register" href="${esc(regUrl)}" target="_blank" rel="noopener">${esc(r.label || 'Register')}</a>` : ''}<a class="btn" data-track="website" href="${esc(p.website)}" target="_blank" rel="noopener">Website</a><a class="btn needs-js" href="${link('board/', D)}?add=${esc(p.id)}">${T(`Add to your week`)}</a></div>
    </article>
    <p class="hint">${T(`Prices, hours and pickup routes change during the year. Confirm with the provider before you enroll.`)}</p>
  </section>
  <section class="section" id="schools">
    <h2>${T(`Which schools it works for`)}</h2>
    <div class="serves">
${schoolRows}
    </div>
    <p>${T(`Does it serve a school that isn’t shown here?`)} <a href="${link('suggest/', D)}">${T(`Tell us.`)}</a></p>
  </section>
  <section class="section" id="reviews">
    <h2>${T(`What parents say`)}</h2>
    ${revs.length ? `<p><span class="stars" aria-hidden="true">${stars(Math.floor(avg + 0.25))}</span> <b>${avg.toFixed(1)} out of 5</b> from ${revs.length} ${revs.length === 1 ? 'review' : 'reviews'}</p>
    <ul class="revlist">${reviewItems(revs)}</ul>` : `<p>${T(`No reviews yet. If your child has been, a few sentences help the next family choose.`)}</p>`}
    <p class="actions"><a class="btn" href="${reviewUrl}" data-track="review">${revs.length ? T(`Write a review`) : T(`Write the first review`)}</a></p>
    <p class="hint">${T(`Reviews are first-hand notes from parents and caregivers. Each one is read before it’s posted.`)}</p>
  </section>
  <p class="src">Checked ${longDate(p.lastVerified)}. Sources: ${sourceLinks(p.sources)}${fix ? `<a href="${esc(fix)}">Suggest a correction</a>` : ''}</p>
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
  const crumbs = { '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Programs', cfg.siteUrl + '/programs/'], [fullName(p), url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) };
  return layout({
    title: programTitle(p),
    description: `${fullName(p)}: ${p.what}. ${servedSummary(p)}. Grades, hours, cost, registration and parent reviews.`,
    pathName: programPath(p), depth: D, current: null, hero, body,
    jsonLd: { '@context': 'https://schema.org', '@graph': [thing, crumbs] },
  });
}

function programsPage() {
  const list = [...citywide].sort((a, b) => a.name.localeCompare(b.name));
  const hero = `    <h1>${T(`Every program, A to Z`)}</h1>
    <p class="lede">${T(`All {n} after-school programs on this site, across every school. Narrow them by type, grade or neighborhood, then open one for its hours, cost and how to register.`, { n: list.length })}</p>`;
  const body = `${filterBar({ list, depth: 1, searchLabel: `Find a program`, placeholder: 'A name, or try drums, art, chess…' })}
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
<section class="section">
  <p>${T(`Clubs a school runs for its own students aren’t in this list. They’re on that school’s page.`)} <a href="${link('schools/', D)}">${T(`Find your school.`)}</a></p>
</section>
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
  <p class="ask">${T(`Know a program that serves {school} and isn’t here?`, { school: s.shortName })} <a href="${link('suggest/', 1)}">${T(`Add it to the list.`)}</a></p>
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
    <li>${T(`There are no accounts and no ads, and nothing you send is sold.`)}</li>
    <li>${T(`Your rosters, including any child’s name you type, are saved in your own browser. They are not sent to us.`)}</li>
    <li>${T(`If you send a suggestion or a review, it arrives as an email to the person who runs the site.`)}</li>
    <li>${T(`We use Google Analytics and Microsoft Clarity to see how the site is used, so we can fix what’s confusing.`)}</li>
  </ul>
  <h2 id="rosters">${T(`Rosters and children’s names`)}</h2>
  <ul>
    <li>${T(`A roster lives in the browser you made it in. Clearing your browser’s site data deletes it.`)}</li>
    <li>${T(`If you save a school as yours, that choice is kept in your own browser too. Our visit counts record that a school was saved, not who saved it.`)}</li>
    <li>${T(`A child’s name is optional. If you add one, it stays on your device and appears in the link you choose to share.`)}</li>
    <li>${T(`Anyone who has a roster’s link can see that roster, so share it the way you’d share a family calendar.`)}</li>
    <li>${T(`When a shared roster is opened, the site removes the name from the page address before any analytics loads, and the roster page is set to be hidden in session recordings.`)}</li>
    <li>${T(`If you add a photo to a week card, the card is made in your own browser. The photo is not uploaded, not saved, and gone when you close the page.`)}</li>
  </ul>
  <h2 id="forms">${T(`Suggestions, corrections and reviews`)}</h2>
  <ul>
    <li>${T(`What you type into a form is emailed to the site’s inbox, and a backup copy is kept on our web host in case the email goes missing.`)}</li>
    <li>${T(`Your email address is used only to reply to you or to confirm something. It is never published.`)}</li>
    <li>${T(`A review that is approved appears on the site with your first name, your child’s school and the month. Nothing else about you is shown.`)}</li>
    <li>${T(`Asking for a school to be covered sends only the school’s name.`)}</li>
    <li>${T(`Please don’t include children’s names or other people’s personal details in what you send.`)}</li>
  </ul>
  <h2 id="analytics">${T(`Analytics and recordings`)}</h2>
  <ul>
    <li>${T(`Google Analytics records which pages are visited and which buttons, filters and searches are used, along with general details such as device type and approximate location. That includes the words typed into the program search box.`)}</li>
    <li>${T(`Microsoft Clarity records how pages are used, including heatmaps and replays of scrolling and clicking, to help us improve the site. We have set it to hide form fields and the roster page.`)}</li>
    <li>${T(`Both services use cookies and similar technologies, and Google and Microsoft handle that data under their own privacy terms:`)} <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">${T(`how Google uses information from sites that use its services`)}</a>, <a href="https://www.microsoft.com/privacy/privacystatement" target="_blank" rel="noopener">${T(`the Microsoft Privacy Statement`)}</a>.</li>
    <li>${T(`You can block both with your browser’s privacy settings or a content blocker, and the site will still work.`)}</li>
    <li>${T(`Like every website, our host keeps standard server logs, which include IP addresses.`)}</li>
  </ul>
  <h2 id="elsewhere">${T(`Links to other sites`)}</h2>
  <p>${T(`Program websites, registration pages, calendars and Venmo are run by other organizations and have their own privacy practices.`)}</p>
  <h2 id="children">${T(`Children`)}</h2>
  <p>${T(`This site is written for parents and caregivers. It is not meant to be used by children, and we do not knowingly collect information from them.`)}</p>
  <h2 id="remove">${T(`Seeing or removing what you sent`)}</h2>
  <p>${T(`To have a review taken down, or a suggestion and your contact details deleted, email`)} ${mail}${T(`. Say what you sent and roughly when, and it will be removed.`)}</p>
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
  <div class="actions"><a class="btn primary" data-track="camp" href="${esc(p.daysOff.url)}" target="_blank" rel="noopener">Camp details</a><a class="btn" href="${link(programPath(p), D)}">Full listing</a></div>
  <p class="src">Checked ${longDate(p.lastVerified)}. Sources: ${sourceLinks(p.daysOff.sources)}</p>
</article>`;
  }).join('\n');
  const hero = `    <h1>${T(`School’s closed. Now what?`)}</h1>
    <p class="lede">${T(`The days district schools are closed this year, and the listed programs that run a camp or a full day when they are.`)}</p>
    <div class="facts">
      <span>School year <b>${esc(daysOff.schoolYear)}</b></span>
      <span>Calendar checked <b>${longDate(daysOff.checked)}</b></span>
      <span><b>${campPrograms.length}</b> programs run something</span>
    </div>`;
  const body = `<div style="display:contents">
<section class="section" id="days">
  <h2>${T(`Days off still to come`)}</h2>
  <p>${T(`These are the School District of Philadelphia’s dates. Open a day to see who has posted a camp for it. A program is named only when its own site lists that date.`)}</p>
  <div class="offdays">
${dayRows}
  </div>
  <p class="src">Calendar: <a href="${esc(daysOff.source.url)}" target="_blank" rel="noopener">${esc(daysOff.source.label)}</a></p>
</section>
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
    title: `Day-off programs in Philadelphia: camps when school is closed`,
    description: `Every day School District of Philadelphia schools are closed in ${daysOff.schoolYear}, and the after-school programs that run a camp or full-day care on those days.`,
    pathName: offPath, depth: D, current: offPath, hero, body, theme: 'dayoff', showStreet: 'dayoff',
    shareImage: { file: 'share-days-off.png', alt: `${cfg.siteName} day-off programs: a park on a morning with no school, a kite going up and a school bus parked` },
    jsonLd: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [[cfg.siteName, cfg.siteUrl + '/'], ['Day-off programs', `${cfg.siteUrl}/${offPath}`]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
  });
}

function boardPage() {
  const order = [...programs].sort((a, b) => a.name.localeCompare(b.name)).map(p => p.id);   // each program's card number
  const data = {
    total: programs.length,
    site: cfg.siteUrl, qr: cardQr && cardQr.text.toLowerCase().startsWith(cfg.siteUrl.toLowerCase() + '/') ? cardQr.rows : null,
    suggest: link('suggest/', 1),
    rels: Object.fromEntries(Object.entries(REL).map(([k, v]) => [k, v.pill])),
    types: Object.fromEntries(TYPES.map(t => [t.id, { label: t.label, color: t.color, icon: t.icon }])),
    schools: Object.fromEntries(schools.map(s => [s.id, { name: s.shortName, path: link(s.id + '/', 1) }])),
    programs: Object.fromEntries(programs.map(p => [p.id, {
      name: p.name, hours: p.hours, pickupBy: p.pickupBy || '', offers: p.offers || [], type: p.types[0], no: order.indexOf(p.id) + 1,
      days: p.days || null, offerDays: p.offerDays || null, rate: p.rate || null,
      path: link(programPath(p), 1), q: [p.name, ...(p.offers || []), ...(p.keywords || []), ...p.types.map(t => TYPE[t].label)].join(' ').toLowerCase(),
      schools: Object.fromEntries(Object.entries(p.schools).map(([sid, l]) => [sid, { rel: l.relation, where: l.address || p.address || '', free: (l.price || p.price) === 'free' }])),
    }])),
  };
  const schoolLinks = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `<a class="btn" href="${link(s.id + '/', 1)}">${esc(s.shortName)}</a>`).join('');
  const hero = `    <h1>${T(`Build your week`)}</h1>
    <p class="lede">${T(`Monday might be martial arts and Thursday the rec center. Plan the term that’s coming, keep a second roster for what your child is doing now, and send either to your partner, a sitter, or the group chat. More than one child? Each gets their own.`)}</p>`;
  const body = `<div data-board-page data-clarity-mask="true" style="display:contents">
  <noscript><p class="ask">${T(`The roster needs JavaScript turned on.`)}</p></noscript>
  <div class="panel" id="board-shared" data-edit-reveal="Shown when someone opens a roster a friend shared:" hidden>
    <h2>${T(`Someone shared this week with you`)}</h2>
    <p id="board-shared-text">It isn’t saved on your device yet.</p>
    <div class="actions"><button type="button" class="btn primary" id="board-adopt">Save it to my rosters</button><button type="button" class="btn" id="board-mine">See my own rosters</button></div>
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
    <div class="panel" id="board-empty" hidden>
      <p id="board-empty-text">Search for a program above and pick its days. Or open a school’s page and choose “Add to roster” on any program.</p>
      <div class="actions">${schoolLinks}</div>
    </div>
    <p class="hint" id="board-hint" hidden>${T(`Drag a card by its colored top to move it to another day, or use the day buttons on the card.`)}</p>
    <div class="week" id="week"></div>
    <button type="button" class="clear" id="board-promote" hidden>The new term has started: make this the current roster</button>
  </section>
  <section class="section costbox" id="board-cost" hidden>
    <h2>${T(`What this roster costs`)}</h2>
    <p class="cost-total" id="cost-total"></p>
    <p id="cost-month"></p>
    <ul class="cost-lines" id="cost-lines"></ul>
    <p class="cost-family" id="cost-family" hidden></p>
    <p class="hint">${T(`An estimate from each program’s published prices, for half a school year: 18 weeks of school, or five monthly bills. It leaves out registration fees, deposits, materials, sibling discounts, subsidies and financial aid. Confirm the price with each program before you budget on it.`)}</p>
  </section>
  <section class="board-tools" id="board-tools" hidden>
    <div class="actions">
      <button type="button" class="btn primary" id="board-share" hidden>Share</button>
      <button type="button" class="btn" id="board-copy-link">Copy link</button>
      <button type="button" class="btn" id="board-copy-text">Copy as text</button>
      <a class="btn" id="board-email" href="mailto:">Email it to myself</a>
      <button type="button" class="clear" id="board-clear">Clear this roster</button>
    </div>
    <p class="hint" id="board-status" aria-live="polite"></p>
    <div class="field">
      <label for="board-link">${T(`Link to this roster`)}</label>
      <input id="board-link" type="text" readonly>
      <span class="hint">${T(`Rosters save automatically on this device. The link is the copy you can keep anywhere: anyone who opens it sees this roster, and it’s how you move one to another phone or computer.`)}</span>
    </div>
  </section>
  <section class="section card-maker" id="card-maker" hidden>
    <h2>${T(`Make it a card`)}</h2>
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
          <button type="button" class="btn" id="card-save">Save as image</button>
          <button type="button" class="btn" id="card-print">Print</button>
        </div>
        <p class="hint" id="card-status" aria-live="polite"></p>
        <p class="hint">${T(`To email it to a teacher, share or save the card, then attach it to a message from your own email.`)}</p>
      </div>
      <div class="card-preview"><canvas id="card-canvas" width="1080" height="1350" role="img" aria-label="Preview of the week card"></canvas></div>
    </div>
  </section>
  <script type="application/json" id="pas-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: 'Build your week', description: `Put together a Monday to Friday after-school roster for each child from ${cfg.siteName} listings and share it with a link.`, pathName: 'board/', depth: 1, current: 'board/', hero, body,
    // A shared roster link carries a child's first name after the #. This runs before any analytics loads:
    // it puts the shared roster aside for the page's own script and takes it out of the address.
    first: `<script>(function(){var h=location.hash;if(!/(^#|&)(mon|tue|wed|thu|fri)=/.test(h))return;window.__pasShared=h;try{sessionStorage.setItem('pas-shared',h)}catch(e){}try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}})();</script>\n` });
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
// Shared by the edit page and the handler. Signing in sets a cookie that is signed with a key derived from
// the password hash, so there is nothing to store on the server and changing the password signs everyone out.
function editAuthPhp() {
  return `$EDIT_USER = ${JSON.stringify(cfg.editLogin.user)};
$EDIT_HASH = '${cfg.editLogin.passwordHash}';
$EDIT_KEY = hash('sha256', $EDIT_HASH . '|edit-sign-in');
header('Cache-Control: no-store, private');
header('X-Robots-Tag: noindex');
function edit_token($exp) {
  global $EDIT_KEY;
  return $exp . '.' . hash_hmac('sha256', (string) $exp, $EDIT_KEY);
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
  </div>${GATED ? '\n  <p class="hint">You’re signed in on this device for 30 days. <a href="?out=1">Sign out</a></p>' : ''}
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
write('review/index.html', reviewPage());
write('review/thanks/index.html', reviewThanksPage());
if (GATED) write('edit/index.php', editIndexPhp()); else write('edit/index.html', editPage());
const notFound = notFoundPage();   // always rendered, so its copy is known to the editor
write('assets/site.css', fs.readFileSync(path.join(ROOT, 'src/site.css')));
write('assets/site.js', fs.readFileSync(path.join(ROOT, 'src/site.js')));
write('assets/edit.js', fs.readFileSync(path.join(ROOT, 'src/edit.js')));
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
  write('data/programs.json', JSON.stringify(programs.map(({ _grades, ...p }) => p), null, 2));
  write('data/schools.json', JSON.stringify(schools, null, 2));
  const latest = programs.map(p => p.lastVerified).sort().pop();
  const urls = [['', latest], ['schools/', latest], ...schools.map(s => [s.id + '/', latest]), ['types/', latest], ...liveTypes().map(t => [`types/${t.id}/`, latest]), ['programs/', latest], ...programs.map(p => [programPath(p), p.lastVerified]), ['neighborhoods/', latest], ...hoods.map(h => [hoodPath(h), latest]),
    ...[...(daysOff ? [offPath] : []), 'board/', 'suggest/', 'ideas/', 'review/', 'about/', 'privacy/', 'support/'].map(u => [u, latest])];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `  <url><loc>${cfg.siteUrl}/${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
  const bare = cfg.siteUrl.replace(/^https?:\/\//, '');
  write('.htaccess', `ErrorDocument 404 /404.html\nAddType text/calendar .ics\nDirectoryIndex index.html index.php\n\n# One address for the site: www goes to the bare domain.\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteCond %{HTTP_HOST} ^www\\.${bare.replace(/\./g, '\\.')}$ [NC]\nRewriteRule ^ https://${bare}%{REQUEST_URI} [R=301,L]\n${cardQr ? `# The short address in the week card's QR code.\nRewriteRule ^w/?$ ${cardQr.goesTo} [NC,R=302,L]\n` : ''}</IfModule>\n`);
}
// Edits in data/copy.json are matched to sentences by a fingerprint of the original wording.
// If the original was reworded or removed in this file, the edit no longer applies: say so, but still build.
const stale = Object.entries(copyEdits).filter(([id]) => !copyRegistry.has(id));
if (stale.length) console.warn(`\nNote: ${stale.length} edit(s) in data/copy.json no longer match any sentence on the site, so they were skipped:\n` + stale.map(([id, e]) => `- ${id}: was "${e.was || '?'}" / now "${e.now}"`).join('\n') + '\n');
const noHood = programs.filter(p => !programHoods(p).length);
if (noHood.length) console.warn(`\nNote: no neighborhood for ${noHood.map(p => p.id).join(', ')}. Add "neighborhoods" in data/programs.json so they show on a neighborhood page.\n`);
console.log(`Built ${schools.length} school page(s), ${hoods.length} neighborhood page(s), ${programs.length} program page(s) and ${copyRegistry.size} editable sentences into ${path.relative(ROOT, OUT)}/`);
