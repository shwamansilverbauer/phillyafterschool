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

const GRADES = ['PK', 'K', '1', '2', '3', '4', '5', '6', '7', '8'];
const REL = {
  onsite: { pill: 'At {s}', title: 'Runs at the school', blurb: 'No travel. Children stay in the building or on school grounds.' },
  pickup: { pill: 'Picks up from {s}', title: 'Picks up from {s}', blurb: 'Staff collect children at dismissal and walk or drive them to the program.' },
  nearby: { pill: 'Nearby, no pickup', title: 'Nearby, no pickup found', blurb: 'Close to the school, but you or your child would need to get there. Best suited to older children or as a second stop.' },
};
const HOW = ['online', 'phone', 'contact', 'school', 'none'];
// A short fingerprint of each asset, added to its URL. When the file changes, the URL changes,
// so browsers and the host's CDN fetch the new one instead of a cached copy.
const stamp = f => PREVIEW ? '' : '?v=' + createHash('sha1').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);
const CSS_V = stamp('src/site.css'), JS_V = stamp('src/site.js');

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
    for (const s of l.sources || []) if (!isUrl(s.url)) errors.push(`${at}: source "${s.label}" for ${sid} needs an https URL`);
    if (p.register?.how === 'online' && !isUrl(l.registerUrl || p.register.url)) errors.push(`${at}: online registration needs a URL`);
  }
  if (['phone', 'school'].includes(p.register?.how) && !p.phone) errors.push(`${at}: register by phone needs a phone number`);
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
if (errors.length) {
  console.error('Data problems found. Nothing was built.\n- ' + errors.join('\n- '));
  process.exit(1);
}

// ---------- page shell ----------
const gtmHead = cfg.gtmId && !PREVIEW ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(cfg.gtmId)}');</script>` : '';
const gtmBody = cfg.gtmId && !PREVIEW ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${esc(cfg.gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : '';
const correctionHref = (subject) => cfg.contactEmail ? `mailto:${cfg.contactEmail}?subject=${encodeURIComponent(subject)}` : null;

// The block: a row of rowhouses, a school with the city flag, and a bus. Drawn from a fixed seed so it never changes between builds.
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

function layout({ title, description, pathName, depth, current, hero, body, scripts = '', fragment = false, showStreet = false }) {
  const canonical = cfg.siteUrl + '/' + pathName;
  const fullTitle = pathName === '' ? (PREVIEW ? cfg.siteName : `${cfg.siteName}: ${cfg.tagline}`) : `${title} | ${cfg.siteName}`;
  const nav = [['', 'Schools'], ['board/', 'My board'], ['suggest/', 'Suggest a program'], ['about/', 'About'], ['support/', 'Buy me a coffee']]
    .map(([to, label]) => `<a href="${link(to, depth)}"${current === to ? ' aria-current="page"' : ''}>${label}${to === 'board/' ? '<span class="count" data-board-count hidden></span>' : ''}</a>`).join('');
  const fix = correctionHref('Correction for Philly After School');
  const head = `${fragment ? '' : gtmHead + '\n'}<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta name="theme-color" content="#0F4D90">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<link rel="stylesheet" href="${link('assets/site.css', depth)}${CSS_V}">`;
  const page = `${gtmBody}<script>document.documentElement.className+=' js'</script>
<header class="band">
  <div class="in bar">
    <a class="brand" href="${link('', depth)}"><span class="bus-mark"></span>${esc(cfg.siteName)}</a>
    <nav class="nav" aria-label="Site">${nav}</nav>
  </div>
  <div class="in hero">
${hero}
  </div>
  ${showStreet ? street(showStreet === 'go') : ''}
</header>
<main class="wrap">
${body}
</main>
<footer class="foot"><div class="in">
  <p>Listings come from each provider’s public pages and are not endorsements. Prices, hours and pickup routes change, so confirm with the provider before you enroll.</p>
  <p>${esc(cfg.siteName)} is an independent community project. It is not affiliated with the School District of Philadelphia or any provider listed.</p>
  <p>Know a program that’s missing, or see something out of date? <a href="${link('suggest/', depth)}">Tell us</a>. <a href="${link('about/', depth)}">About this site</a>. <a href="${link('support/', depth)}">Buy me a coffee</a>.</p>
  ${cfg.builtBy ? `<p>Built by <a href="${esc(cfg.builtBy.url)}" target="_blank" rel="noopener">${esc(cfg.builtBy.name)}</a>.</p>` : ''}
</div></footer>
<script src="${link('assets/site.js', depth)}${JS_V}"></script>
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

// ---------- program card ----------
function card(p, school) {
  const l = p.schools[school.id];
  const rel = REL[l.relation];
  const g = p._grades;
  const cells = GRADES.map(x => `<i class="cell${g === null ? ' unk' : g.includes(x) ? ' on' : ''}">${x}</i>`).join('');
  const gradeText = g === null ? 'not published' : g.length === 1 ? g[0] : `${g[0]} to ${g[g.length - 1]}`;
  const where = [l.address || p.address, l.distance].filter(Boolean).join(', ');
  const sources = [...p.sources, ...(l.sources || [])];
  const r = p.register;
  const regUrl = r.how === 'online' ? (l.registerUrl || r.url) : null;
  const phoneLink = p.phone ? `<a href="${telHref(p.phone)}">${esc(p.phone)}</a>` : '';
  const emailLink = p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : '';
  const contact = [phoneLink, emailLink].filter(Boolean).join('<br>');
  let regText = esc(r.note || '');
  if (r.how === 'online') regText = ['Online.', regText].filter(Boolean).join(' ');
  if (r.how === 'phone') regText = [`By phone or in person${p.phone ? ': ' + phoneLink : ''}.`, regText].filter(Boolean).join(' ');
  if (r.how === 'school') regText = [regText, p.phone ? `School office: ${phoneLink}.` : ''].filter(Boolean).join(' ');
  const dateHtml = upcomingDates(p).map(d => `<span class="cal" data-date="${d.date}"><b>${shortDate(d.date)}:</b> ${esc(d.label)}. ${PREVIEW ? '' : `<a href="${link('cal/' + p.id + '-' + d.date + '.ics', 1)}" data-track="calendar">Add to calendar</a> `}<a href="${esc(gcalUrl(p, d))}" target="_blank" rel="noopener" data-track="calendar">${PREVIEW ? 'Add to Google Calendar' : 'Google Calendar'}</a></span>`).join('');
  const revs = reviewsFor(p.id);
  const avg = revs.length ? revs.reduce((a, x) => a + x.stars, 0) / revs.length : 0;
  const reviewUrl = `${link('review/', 1)}?program=${p.id}&school=${school.id}`;
  const revHtml = revs.length
    ? `<details><summary><span class="stars" aria-hidden="true">${stars(Math.floor(avg + 0.25))}</span> <b>${avg.toFixed(1)} out of 5</b> from ${revs.length} ${revs.length === 1 ? 'review' : 'reviews'}</summary>
      <ul>${revs.map(x => `<li><span class="stars" role="img" aria-label="${x.stars} out of 5 stars">${stars(x.stars)}</span><p>${esc(x.comment)}</p><span class="by">${esc(x.name)}, ${esc(schoolShort(x.school))} parent, ${monthYear(x.date)}</span></li>`).join('')}</ul></details>
    <a href="${reviewUrl}" data-track="review">Write a review</a>`
    : `<span>No reviews yet.</span> <a href="${reviewUrl}" data-track="review">Write the first one</a>`;
  const rows = [['Where', esc(where)], ['Hours', esc(p.hours)], ['Pick up by', esc(p.pickupBy || '')], ['Cost', esc(p.cost)], ['Register', regText], ['Next term', esc(r.nextTerm || '') + dateHtml], ['Contact', r.how === 'school' ? '' : contact]]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const flag = [p.note, l.note].filter(Boolean).join(' ');
  const fix = correctionHref(`Correction: ${p.name} (${school.shortName})`);
  return `<article class="prog" id="${esc(p.id)}" data-rel="${l.relation}" data-grades="${g === null ? '*' : g.join(' ')}">
  <div class="top"><span class="pill ${l.relation}">${esc(rel.pill.replace('{s}', school.shortName))}</span><h3>${esc(p.name)}</h3><p class="what">${esc(p.what)}</p></div>
  <div class="strip" role="img" aria-label="Grades served: ${esc(gradeText)}">${cells}${p.gradeNote ? `<span class="strip-note">${esc(p.gradeNote)}</span>` : ''}</div>
  <dl>${rows}</dl>
  ${flag ? `<p class="flag">${esc(flag)}</p>` : ''}
  <div class="actions">${regUrl ? `<a class="btn primary" data-track="register" href="${esc(regUrl)}" target="_blank" rel="noopener">${esc(r.label || 'Register')}</a>` : ''}<a class="btn" data-track="website" href="${esc(p.website)}" target="_blank" rel="noopener">Website</a><button type="button" class="btn needs-js" data-board-toggle aria-expanded="false">Add to board</button>
    <div class="days" hidden><span class="which" role="group" aria-label="Which board"><button type="button" class="wb" data-board="now" aria-pressed="true">Current</button><button type="button" class="wb" data-board="next" aria-pressed="false">Upcoming</button></span><span class="hint">Which days?</span>${BOARD_DAYS.map(([k, n]) => `<button type="button" class="day" data-day="${k}" aria-pressed="false">${n}</button>`).join('')}<a href="${link('board/', 1)}">See your board</a></div></div>
  <div class="rev">${revHtml}</div>
  <p class="src">Checked ${longDate(p.lastVerified)}. Sources: ${sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}${fix ? `<a href="${esc(fix)}">Suggest a correction</a>` : ''}</p>
</article>`;
}

// ---------- pages ----------
const forSchool = s => programs.filter(p => p.schools[s.id]);
const tally = s => Object.fromEntries(Object.keys(REL).map(k => [k, forSchool(s).filter(p => p.schools[s.id].relation === k).length]));
const clock = s => s.dismissal.replace(/\s*[ap]m$/i, '');
const gradeSpan = s => { const g = expandGrades(s.grades); const nm = x => x === 'PK' ? 'Pre-K' : x === 'K' ? 'K' : x; return `${nm(g[0])} to ${nm(g[g.length - 1])}`; };

function schoolPage(s) {
  const list = forSchool(s);
  const t = tally(s);
  const gradeBtns = [['ALL', 'All']].concat(GRADES.map(g => [g, g])).map(([g, label]) => {
    const n = list.filter(p => p.schools[s.id].relation !== 'nearby' && (g === 'ALL' || (p._grades && p._grades.includes(g)))).length;
    return `<button type="button" class="gbtn" id="grade-${g}" data-g="${g}" aria-pressed="${g === 'ALL'}" aria-label="${g === 'ALL' ? 'All grades' : g === 'PK' ? 'Pre-K' : g === 'K' ? 'Kindergarten' : 'Grade ' + g}, ${n} on-site or pickup programs"><span class="g">${label}</span><span class="n">${n}</span></button>`;
  }).join('');
  const typeBtns = [['ALL', 'All types', list.length]].concat(Object.entries(REL).map(([k, v]) => [k, v.pill.replace('{s}', s.shortName), t[k]]))
    .map(([k, label, n]) => `<button type="button" class="tbtn" id="type-${k}" data-t="${k}" aria-pressed="${k === 'ALL'}">${esc(label)} (${n})</button>`).join('');
  const groups = Object.entries(REL).filter(([k]) => t[k]).map(([k, v]) => `<section class="group">
  <h2>${esc(v.title.replace('{s}', s.shortName))} (<span class="n">${t[k]}</span>)</h2>
  <p>${v.blurb}</p>
  <div class="list">
${list.filter(p => p.schools[s.id].relation === k).map(p => card(p, s)).join('\n')}
  </div>
</section>`).join('\n');
  const hero = `    <p class="where">${esc(s.name)}, ${esc(s.address.split(',')[0])}</p>
    <h1>It’s ${esc(clock(s))} at ${esc(s.shortName)}. Now what?</h1>
    <p class="lede">Every after-school program we could find that runs at the school, picks children up from ${esc(s.shortName)}, or sits within a short walk. Pick a grade to see what your child can join.</p>
    <div class="facts">
      <span>Dismissal <b>${esc(s.dismissal)}</b>${s.dismissalNote ? ` (${esc(s.dismissalNote)})` : ''}</span>
      <span>School office <b><a href="${telHref(s.phone)}">${esc(s.phone)}</a></b></span>
      <span>Reviewed <b>${longDate(s.lastReviewed)}</b></span>
    </div>`;
  const body = `<div data-school-page="${esc(s.id)}" style="display:contents">
  <section class="picker" aria-label="Filter programs">
    <div class="rail" role="group" aria-label="Grade">${gradeBtns}</div>
    <div class="rail" role="group" aria-label="Type">${typeBtns}</div>
    <div class="status"><span id="count" aria-live="polite"></span><button type="button" class="clear" id="clear" hidden>Clear filters</button></div>
  </section>
  <div class="legend">
    <span><i class="cell on">3</i> grade served</span>
    <span><i class="cell">7</i> not served</span>
    <span><i class="cell unk">?</i> grades not published, so the program shows under every grade</span>
    <span>The number under each grade counts programs at the school or with pickup.</span>
  </div>
  <div class="groups">
${groups}
  </div>
  <p class="ask">Know a program that serves ${esc(s.shortName)} and isn’t here? <a href="${link('suggest/', 1)}">Add it to the list.</a></p>
  ${s.checkedNoPickup?.length ? `<section class="notes">
    <h2>Checked, and not listing ${esc(s.shortName)} pickup</h2>
    <ul>${s.checkedNoPickup.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  </section>` : ''}
  ${s.alsoListed?.items?.length ? `<section class="notes">
    <h2>${esc(s.alsoListed.title)}</h2>
    <p>${esc(s.alsoListed.intro)}</p>
    <ul>${s.alsoListed.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  </section>` : ''}
  <section class="notes">
    <h2>Before you enroll</h2>
    <ul>
      <li>Pickup lists change every year, and most providers need a minimum number of children from a school. Ask each one to confirm ${esc(s.shortName)} pickup for the days you need.</li>
      <li>Ask what happens on early-dismissal days and district days off.</li>
      <li>City rec centers post each year’s after-school listing late, so call before counting on a price or a spot. Their listings live in the <a href="https://www.phila.gov/parks-rec-finder/#/locations" target="_blank" rel="noopener">Parks &amp; Rec finder</a>.</li>
      <li>Free, city-funded programs are in the city’s <a href="https://www.phila.gov/ost/program-locator/#/" target="_blank" rel="noopener">After School and Summer Program Locator</a>.</li>
      ${(s.notes || []).map(x => `<li>${esc(x)}</li>`).join('\n      ')}
    </ul>
  </section>
</div>`;
  return layout({
    title: `After-school programs for ${s.shortName} families`,
    description: `${list.length} after-school options for ${s.name} in Philadelphia: programs at the school, programs that pick up from ${s.shortName}, and ones nearby. Filter by grade, with hours, cost and where to register.`,
    pathName: s.id + '/', depth: 1, current: null, hero, body,
  });
}

function homePage() {
  const rows = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => {
    const t = tally(s);
    return `<a class="school" href="${link(s.id + '/', 0)}" data-name="${esc((s.name + ' ' + s.shortName + ' ' + s.neighborhood).toLowerCase())}">
  <h3>${esc(s.name)}</h3>
  <span class="hood">${esc(s.neighborhood)}, grades ${esc(gradeSpan(s))}</span>
  <span class="tally">${t.onsite ? `<span class="pill onsite">${t.onsite} at school</span>` : ''}${t.pickup ? `<span class="pill pickup">${t.pickup} pick up</span>` : ''}${t.nearby ? `<span class="pill nearby">${t.nearby} nearby</span>` : ''}</span>
  <span class="bell"><b>${esc(clock(s))}</b><span>dismissal</span></span>
</a>`;
  }).join('\n');
  const hero = `    <h1>School’s out. Now what?</h1>
    <p class="lede">Find the after-school programs that work with your child’s school: what runs in the building, who picks up at dismissal, and what’s close enough to walk to.</p>
    <div class="find">
      <label for="find-school">Find your school</label>
      <input id="find-school" type="search" placeholder="Start typing a school name" autocomplete="off">
    </div>`;
  const body = `<section class="section">
  <h2>Schools</h2>
  <div class="schools">
${rows}
    <p class="ask" id="no-school" hidden>That school isn’t here yet. <a href="${link('suggest/', 0)}">Ask for it to be added.</a></p>
  </div>
  <p>More schools in Queen Village, Bella Vista and South Philadelphia are on the way. <a href="${link('suggest/', 0)}">Ask for yours next.</a></p>
</section>
<section class="section">
  <h2>How programs are sorted</h2>
  <div class="kinds">
    <div><span class="pill onsite">At the school</span><p>Runs in the school building or on its grounds. No travel.</p></div>
    <div><span class="pill pickup">Picks up</span><p>Staff collect children at dismissal and walk or drive them to the program.</p></div>
    <div><span class="pill nearby">Nearby</span><p>Close to the school, with no pickup we could find. A fit for older children or a second stop.</p></div>
  </div>
</section>
<section class="section">
  <h2>Checked by hand, dated, and sourced</h2>
  <p>Every listing links to where the information came from and shows the day it was last checked. Nobody pays to be listed. If it saved you an evening of open tabs, <a href="${link('support/', 0)}">buy me a coffee.</a></p>
</section>
${cfg.builtBy ? `<section class="section" id="who">
  <h2>Who built this</h2>
  <p>${esc(cfg.builtBy.bio)}</p>
</section>` : ''}`;
  return layout({
    title: cfg.siteName, pathName: '', depth: 0, current: '', hero, body, fragment: PREVIEW, showStreet: 'go',
    description: 'A school-by-school directory of after-school programs in Philadelphia: what runs at the school, who picks up at dismissal, hours, cost and where to register.',
  });
}

function supportPage() {
  const who = cfg.builtBy ? cfg.builtBy.name.split(' ')[0] : '';
  const give = cfg.supportUrl
    ? `<p class="actions"><a class="btn primary big" data-track="support" href="${esc(cfg.supportUrl)}" target="_blank" rel="noopener">${esc(cfg.supportLabel || 'Buy me a coffee')}</a></p>
  ${cfg.supportHandle ? `<p class="hint">Or search for <b>${esc(cfg.supportHandle)}</b> in the Venmo app.</p>` : ''}`
    : `<div class="panel"><h3>The coffee link is being set up</h3><p>Check back soon.</p></div>`;
  const hero = `    <h1>Buy me a coffee</h1>
    <p class="lede">${who ? `I’m ${esc(who)}. ` : ''}I built this because sorting out after-school care for my own kid was chaos. If it saved you an evening of open tabs, a coffee is a nice way to say so.</p>`;
  const body = `<div class="prose">
  ${give}
  <ul>
    <li>It goes to me, the person who built and updates this, for the hours spent checking listings and adding schools.</li>
    <li>It’s a thank-you, not a charitable donation, so it isn’t tax-deductible.</li>
    <li>It buys nothing on the site. Listings are free for every provider, and nobody pays to be listed or to be listed higher.</li>
    <li>Not a coffee person? A correction or a missing program helps just as much. <a href="${link('suggest/', 1)}">Send one here.</a></li>
  </ul>
</div>`;
  return layout({ title: 'Buy me a coffee', description: `Say thanks to the person who built and maintains ${cfg.siteName}.`, pathName: 'support/', depth: 1, current: 'support/', hero, body, showStreet: 'parked' });
}

function aboutPage() {
  const mail = cfg.contactEmail ? `Email <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : 'A contact address is being set up. Check back soon';
  const hero = `    <h1>One place to see what’s possible after the last bell</h1>
    <p class="lede">Finding after-school care means checking a dozen websites to learn who picks up from your school, for which grades, until when. ${esc(cfg.siteName)} puts that on one page per school.</p>`;
  const body = `<div class="prose">
  <h2>How listings are checked</h2>
  <ul>
    <li>Each listing comes from the provider’s own public pages, the school’s site, or city program data. The sources are linked on every card.</li>
    <li>Every card shows the date it was last checked. When a detail could not be confirmed, the card says so in a yellow note.</li>
    <li>A program is marked “picks up” only when a source names the school. Otherwise it is listed as nearby.</li>
  </ul>
  <h2>What this site can’t promise</h2>
  <ul>
    <li>A listing is not an endorsement, and nobody pays to appear here.</li>
    <li>Prices, hours, openings and pickup routes change during the year. Confirm with the provider before you enroll.</li>
    <li>${esc(cfg.siteName)} is independent. It is not affiliated with the School District of Philadelphia or any provider.</li>
  </ul>
  <h2 id="corrections">Corrections, new programs and new schools</h2>
  <p>Parents and providers know these programs best. If something is wrong or missing, or you want your school added, <a href="${link('suggest/', 1)}">use the form</a>. ${mail}.</p>
  <p>It helps to include the program, the school, what changed, and a link to where it’s published.</p>
  <h2 id="reviews">Reviews</h2>
  <ul>
    <li>Reviews are first-hand notes from parents and caregivers. Each one is read before it’s posted and shows the reviewer’s first name and school.</li>
    <li>We don’t post reviews that name children or individual staff, or reviews a program writes about itself.</li>
    <li>Nobody pays to have a review posted or removed. A provider who thinks a review is wrong can use the form above or the contact address.</li>
  </ul>
  ${cfg.builtBy ? `<h2 id="who">Who built this</h2>
  <p>${esc(cfg.builtBy.bio)}</p>` : ''}
</div>`;
  return layout({ title: 'About', description: `How ${cfg.siteName} gathers and checks after-school listings, and how to send a correction.`, pathName: 'about/', depth: 1, current: 'about/', hero, body, showStreet: 'parked' });
}

function suggestPage() {
  const opts = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `<option>${esc(s.shortName)}</option>`).join('');
  const hero = `    <h1>Know one we missed?</h1>
    <p class="lede">Plenty of good programs are off the radar: a church basement, a dance studio that walks kids over, a neighbor who runs a homework club. Tell us and we’ll check it and add it. You can also fix a listing or ask for your school.</p>`;
  const chips = (name, legend, values, attrs = '') => `<fieldset class="field chips"${attrs}>
      <legend>${legend}</legend>
      <div class="chip-row">${values.map((v, i) => `<label class="chip"><input type="radio" name="${name}" value="${esc(v)}"${i === 0 ? ' checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div>
    </fieldset>`;
  const body = `<div class="suggest">
  <form class="form panel" method="post" action="send.php" id="suggest-form">
    ${chips('kind', 'What are you sending?', ['A program that’s missing', 'A correction to a listing', 'A school to add'])}
    <div class="field" data-show="school" hidden>
      <label for="f-newschool">School name</label>
      <input id="f-newschool" name="newschool" type="text" maxlength="120" autocomplete="off" disabled>
      <span class="hint">The neighborhood helps too, if you know it.</span>
    </div>
    <div class="pair" data-show="program correction">
      <div class="field">
        <label for="f-school">Which school?</label>
        <select id="f-school" name="school">
          ${opts}
          <option>Another school</option>
        </select>
        <span class="hint">For another school, name it in the details.</span>
      </div>
      <div class="field">
        <label for="f-program">Program name</label>
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
      <h2>About you</h2>
      <p class="hint">All optional. Your email is only used to ask a follow-up question about what you sent.</p>
      <div class="field">
        <label for="f-role">How do you know it?</label>
        <select id="f-role" name="role">
          <option>I’m a parent or caregiver</option>
          <option>I run or work at the program</option>
          <option>I work at the school</option>
          <option>Other</option>
        </select>
      </div>
      <div class="pair">
        <div class="field">
          <label for="f-name">Your name</label>
          <input id="f-name" name="name" type="text" maxlength="100" autocomplete="name">
        </div>
        <div class="field">
          <label for="f-email">Your email</label>
          <input id="f-email" name="email" type="email" maxlength="150" autocomplete="email">
        </div>
      </div>
    </div>
    <div class="hp" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">
      <label for="f-company">Leave this blank</label>
      <input id="f-company" name="company" type="text" tabindex="-1" autocomplete="off">
    </div>
    <div><button class="btn primary big" type="submit">Send it</button></div>
  </form>
  <aside class="next">
    <h2>What happens next</h2>
    <ol>
      <li>Your note lands in a real inbox. A person reads it.</li>
      <li>We check it against the program’s own information.</li>
      <li>If it holds up, it goes on the school’s page with its source and the date.</li>
    </ol>
    <p class="hint">Nothing is published automatically, and nobody pays to be listed.</p>
  </aside>
</div>`;
  return layout({ title: 'Suggest a program', description: `Tell ${cfg.siteName} about an after-school program that’s missing, a correction, or a school to add.`, pathName: 'suggest/', depth: 1, current: 'suggest/', hero, body, showStreet: 'parked' });
}

function thanksPage() {
  const hero = `    <h1>Got it. Thank you.</h1>
    <p class="lede">We’ll check it against the program’s own information and add it if it holds up. <a href="${link('', 2)}">Back to the schools.</a></p>`;
  return layout({ title: 'Thank you', description: 'Your suggestion was sent.', pathName: 'suggest/thanks/', depth: 2, current: null, hero, body: '', showStreet: 'parked' });
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
header('Location: thanks/', true, 303);
exit;
`;
}

function boardPage() {
  const data = {
    schools: Object.fromEntries(schools.map(s => [s.id, { name: s.shortName, path: link(s.id + '/', 1) }])),
    programs: Object.fromEntries(programs.map(p => [p.id, {
      name: p.name, hours: p.hours, pickupBy: p.pickupBy || '',
      schools: Object.fromEntries(Object.entries(p.schools).map(([sid, l]) => [sid, { rel: l.relation, where: l.address || p.address || '' }])),
    }])),
  };
  const schoolLinks = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `<a class="btn" href="${link(s.id + '/', 1)}">${esc(s.shortName)}</a>`).join('');
  const hero = `    <h1>Build your week</h1>
    <p class="lede">Monday might be martial arts and Thursday the rec center. Keep one board for what you’re doing now and one for what’s coming, then send either to your partner, a sitter, or the group chat.</p>`;
  const body = `<div data-board-page style="display:contents">
  <noscript><p class="ask">The board needs JavaScript turned on.</p></noscript>
  <div class="panel" id="board-shared" hidden>
    <h2>Someone shared this week with you</h2>
    <p id="board-shared-text">It isn’t saved on your device yet.</p>
    <div class="actions"><button type="button" class="btn primary" id="board-adopt">Make it my board</button><button type="button" class="btn" id="board-mine">See my own boards</button></div>
  </div>
  <section class="section">
    <div class="tabs" id="board-tabs" role="group" aria-label="Which board">
      <button type="button" class="tab" data-board="now" aria-pressed="true">Current</button>
      <button type="button" class="tab" data-board="next" aria-pressed="false">Upcoming</button>
    </div>
    <h2 id="board-title">Your current week</h2>
    <div class="panel" id="board-empty" hidden>
      <p id="board-empty-text">Open a school’s page and choose “Add to board” on any program. Pick the days, and it shows up here.</p>
      <div class="actions">${schoolLinks}</div>
    </div>
    <div class="week" id="week"></div>
    <button type="button" class="clear" id="board-promote" hidden>The new term has started: make this my current board</button>
  </section>
  <section class="board-tools" id="board-tools" hidden>
    <div class="field">
      <label for="board-name">Name this week</label>
      <input id="board-name" type="text" maxlength="40" placeholder="Sam’s week" autocomplete="off">
    </div>
    <div class="actions">
      <button type="button" class="btn primary" id="board-share" hidden>Share</button>
      <button type="button" class="btn" id="board-copy-link">Copy link</button>
      <button type="button" class="btn" id="board-copy-text">Copy as text</button>
      <a class="btn" id="board-email" href="mailto:">Email it to myself</a>
      <button type="button" class="clear" id="board-clear">Clear this board</button>
    </div>
    <p class="hint" id="board-status" aria-live="polite"></p>
    <div class="field">
      <label for="board-link">Link to this week</label>
      <input id="board-link" type="text" readonly>
      <span class="hint">Your boards save automatically on this device. The link is the copy you can keep anywhere: anyone who opens it sees this week, and it’s how you move a board to another phone or computer.</span>
    </div>
  </section>
  <script type="application/json" id="pas-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</div>`;
  return layout({ title: 'Build your week', description: `Put together a Monday to Friday after-school plan from ${cfg.siteName} listings and share it with a link.`, pathName: 'board/', depth: 1, current: 'board/', hero, body });
}

function reviewPage() {
  const progOpts = [...programs].sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  const schoolOpts = [...schools].sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `<option value="${esc(s.id)}">${esc(s.shortName)}</option>`).join('');
  const hero = `    <h1>How did it go?</h1>
    <p class="lede">A first-hand note from one family helps the next one choose. Every review is read before it’s posted.</p>`;
  const body = `<div class="suggest">
  <form class="form panel" method="post" action="send.php" id="review-form">
    <div class="pair">
      <div class="field">
        <label for="r-program">Which program?</label>
        <select id="r-program" name="program" required>${progOpts}</select>
      </div>
      <div class="field">
        <label for="r-school">Your child’s school</label>
        <select id="r-school" name="school" required>${schoolOpts}</select>
      </div>
    </div>
    <fieldset class="field chips">
      <legend>Your rating</legend>
      <div class="chip-row">${[5, 4, 3, 2, 1].map((n, i) => `<label class="chip"><input type="radio" name="stars" value="${n}"${i === 0 ? ' required' : ''}><span>${n} ${n === 1 ? 'star' : 'stars'}</span></label>`).join('')}</div>
    </fieldset>
    <div class="field">
      <label for="r-comment">Your review</label>
      <span class="hint">What was pickup like? Homework help? Would you sign up again?</span>
      <textarea id="r-comment" name="comment" minlength="20" maxlength="1200" required></textarea>
    </div>
    <div class="pair">
      <div class="field">
        <label for="r-name">Your first name</label>
        <input id="r-name" name="name" type="text" maxlength="40" autocomplete="given-name" required>
        <span class="hint">Shown with your review.</span>
      </div>
      <div class="field">
        <label for="r-email">Your email</label>
        <input id="r-email" name="email" type="email" maxlength="150" autocomplete="email" required>
        <span class="hint">Never shown. Only used if we need to confirm something.</span>
      </div>
    </div>
    <label class="check"><input type="checkbox" name="firsthand" value="yes" required><span>This is my own experience as a parent or caregiver.</span></label>
    <div class="hp" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">
      <label for="r-company">Leave this blank</label>
      <input id="r-company" name="company" type="text" tabindex="-1" autocomplete="off">
    </div>
    <div><button class="btn primary big" type="submit">Send review</button></div>
  </form>
  <aside class="next">
    <h2>House rules</h2>
    <ul class="rules">
      <li>First-hand only. Write about what your own family experienced.</li>
      <li>Be specific and fair. Details help more than adjectives.</li>
      <li>No names of children or individual staff.</li>
      <li>Programs can’t review themselves.</li>
    </ul>
    <p class="hint">Reviews show your first name and school, and appear after they’ve been read. Nobody pays to have a review posted or removed.</p>
  </aside>
</div>`;
  return layout({ title: 'Write a review', description: `Share a first-hand review of an after-school program listed on ${cfg.siteName}.`, pathName: 'review/', depth: 1, current: null, hero, body, showStreet: 'parked' });
}

function reviewThanksPage() {
  const hero = `    <h1>Thank you. It’s in.</h1>
    <p class="lede">Your review will appear once it’s been read. <a href="${link('', 2)}">Back to the schools.</a></p>`;
  return layout({ title: 'Thank you', description: 'Your review was sent.', pathName: 'review/thanks/', depth: 2, current: null, hero, body: '', showStreet: 'parked' });
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

function notFoundPage() {
  const hero = `    <h1>This jawn isn’t here</h1>
    <p class="lede">The link may be old, or the page moved. <a href="/">Start from the list of schools.</a></p>`;
  return layout({ title: 'Page not found', description: 'Page not found.', pathName: '404.html', depth: -1, current: null, hero, body: '', showStreet: 'parked' });
}

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
const write = (rel, content) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
write('index.html', homePage());
for (const s of schools) write(`${s.id}/index.html`, schoolPage(s));
write('support/index.html', supportPage());
write('about/index.html', aboutPage());
write('suggest/index.html', suggestPage());
write('suggest/thanks/index.html', thanksPage());
write('board/index.html', boardPage());
write('review/index.html', reviewPage());
write('review/thanks/index.html', reviewThanksPage());
write('assets/site.css', fs.readFileSync(path.join(ROOT, 'src/site.css')));
write('assets/site.js', fs.readFileSync(path.join(ROOT, 'src/site.js')));
if (!PREVIEW) {
  write('404.html', notFoundPage());
  if (cfg.contactEmail) write('suggest/send.php', sendPhp());
  if (cfg.contactEmail) write('review/send.php', reviewPhp());
  for (const p of programs) for (const d of upcomingDates(p)) write(`cal/${p.id}-${d.date}.ics`, icsFile(p, d));
  write('data/reviews.json', JSON.stringify(reviews, null, 2));
  // Public copy of the data, so the monthly check (or anyone) can read exactly what the site shows.
  write('data/programs.json', JSON.stringify(programs.map(({ _grades, ...p }) => p), null, 2));
  write('data/schools.json', JSON.stringify(schools, null, 2));
  const latest = programs.map(p => p.lastVerified).sort().pop();
  const urls = ['', ...schools.map(s => s.id + '/'), 'board/', 'suggest/', 'review/', 'about/', 'support/'];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${cfg.siteUrl}/${u}</loc><lastmod>${latest}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
  write('.htaccess', 'ErrorDocument 404 /404.html\nAddType text/calendar .ics\n');
}
console.log(`Built ${schools.length} school page(s) and ${programs.length} programs into ${path.relative(ROOT, OUT)}/`);
