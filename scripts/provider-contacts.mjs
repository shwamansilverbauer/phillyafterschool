// The providers behind the listings, with a contact email from each one's own website, for the outreach sheet Josh
// keeps in his Google Drive (inviting providers to claim their listings). Nothing it finds is written to the
// repository: the emails go to the sheet only.
//
//   node scripts/provider-contacts.mjs                       every provider, as JSON rows in the sheet's columns
//   node scripts/provider-contacts.mjs --known known.txt     only providers whose website isn't in known.txt (one
//                                                            website address a line: the sheet's Website column)
//   node scripts/provider-contacts.mjs --offline             group the listings without reading any site
//   node scripts/provider-contacts.mjs --browser             also read, in Playwright's Chromium, the sites a plain
//                                                            fetch found no email on
//
// One row per provider: listings that share a website host are one provider, since one sign-in at that address
// claims them all. Listings on a shared host (the City, the school district, the library, booking services) are a
// row each. The email: the listing's own "email" if it has one, else the best address on the provider's site (its
// home page, then its contact and about pages): one at the site's own domain, a general one (info@, hello@, camp@…)
// before a named person's, never press, HR, rentals or no-reply. "Can they claim" follows the claim rule: the
// address must be at the listing's website (README, "Program managers: claiming a listing"). robots.txt is honored,
// and a page data/reading.json says a person has to read is never requested.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { robots, disallowed, UA_BASE } from './robots.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const arg = k => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const OFFLINE = process.argv.includes('--offline'), BROWSER = process.argv.includes('--browser');
const UA = UA_BASE + ' PhillyAfterSchoolLinkCheck/1.0', SITE = 'https://phillyafterschool.org/';
const programs = read('data/programs.json'), camps = read('data/camps.json').camps, reading = read('data/reading.json');

const hostOf = u => { try { return new URL(u).host.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const regOf = h => String(h || '').toLowerCase().split('.').slice(-2).join('.');
// --known: the sheet's Website and "Links to the listings" columns, one address a line (a cell with several links
// can be pasted as it is). A provider is known by its website's host, or, on a shared host, by its listing's link.
const knownLines = (arg('--known') ? fs.readFileSync(arg('--known'), 'utf8').split(/\r?\n/) : []).map(s => s.trim()).filter(Boolean);
const knownLinks = new Set(knownLines.filter(s => s.startsWith(SITE)));
const knownHosts = new Set(knownLines.filter(s => !s.startsWith(SITE)).map(hostOf).filter(Boolean));
const SHARED = /(^|\.)(philasd\.org|phila\.gov|freelibrary\.org|hisawyer\.com|coursestorm\.com|google\.com|facebook\.com|instagram\.com|philaymca\.org)$/;
const kinds = p => [Object.keys(p.schools || {}).length && !['weekend', 'dayoff'].includes(p.scope) ? 'After school' : '', p.weekend ? 'Weekends' : '', p.daysOff ? 'Day camps' : ''].filter(Boolean);

// ----- the providers -----
const groups = new Map();
const add = (host, item) => { const key = SHARED.test(host) || !host ? `${host}#${item.k}` : host; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); };
for (const p of programs) {
  if (/-clubs$/.test(p.id) || /^test-/.test(p.id)) continue;   // a school's own clubs, and the test listings
  add(hostOf(p.website), { k: 'p:' + p.id, name: p.name, url: `${SITE}programs/${p.id}/`, web: p.website, email: p.email || '', phone: p.phone || '', kinds: kinds(p), schools: Object.values(p.schools || {}).filter(l => l.relation !== 'nearby').length, rec: (p.types || []).includes('rec-center') });
}
for (const c of camps) {
  const prog = c.program && programs.find(p => p.id === c.program);
  add(hostOf(prog ? prog.website : c.website), { k: 'c:' + c.id, name: c.name, url: prog ? `${SITE}programs/${prog.id}/#summer` : `${SITE}summer-camps/${c.id}/`, web: c.website, email: '', phone: c.phone || '', kinds: ['Summer camp'], schools: 0 });
}
const providers = [...groups.entries()].map(([key, items]) => ({ key, host: key.split('#')[0], items, website: (items.find(i => i.web) || {}).web || '' }))
  .filter(p => !(!/#/.test(p.key) && knownHosts.has(p.host)) && !p.items.some(i => knownLinks.has(i.url)));

// ----- an email from each provider's own site -----
const person = u => reading.some(r => r.how === 'person' && u.replace(/^https?:\/\/(www\.)?/, '').startsWith(r.match.replace(/^www\./, '')));
const JUNK = /(example\.|sentry|wixpress|\.(png|jpe?g|gif|webp|svg)$|@2x|godaddy|domain\.com|email\.com|yourdomain|schema\.org|mysite\.com|jackrabbittech|runcloud)/i;
const ROLE_BAD = /^(noreply|no-reply|donotreply|press|pressroom|pr|hr|jobs|careers|marketing|media|rentals?|birthdays?|spacerentals[a-z]*|tuitionassistance|business|billing|accounts|support|customersupport|portal|webmaster|privacy|example)@/;
const GOOD = ['info', 'hello', 'contact', 'office', 'admin', 'school', 'camp', 'camps', 'afterschool', 'education', 'programs', 'enroll', 'registration', 'familyprograms', 'lessons', 'inquire', 'inquiries'];
const emailsIn = text => [...new Set([...String(text).replace(/&#0?64;|&#x40;|\[at\]|\(at\)/gi, '@').replace(/%40/g, '@').matchAll(/(?:mailto:)?([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)]
  .map(m => m[1].toLowerCase().replace(/[.,;:]+$/, '')).filter(e => !JUNK.test(e)))];
const score = (e, host) => {
  const [local, dom] = e.split('@');
  const first = d => regOf(d).split('.')[0];
  let s = regOf(dom) === regOf(host) ? 10 : first(dom) === first(host) ? 5 : /@(gmail|yahoo|hotmail|outlook|aol|icloud|me|comcast|verizon)\./.test(e) ? 3 : -6;
  const g = GOOD.indexOf(local); if (g > -1) s += 8 - g * 0.1;
  if (ROLE_BAD.test(e)) s -= 30;
  return s;
};
const fetchText = async u => {
  if (person(u)) return { skip: 'a person reads this site' };
  const url = new URL(u);
  if (disallowed(await robots(url.origin, UA), url.pathname)) return { skip: 'robots.txt' };
  const r = await fetch(u, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
  if (r.status !== 200) return { skip: 'HTTP ' + r.status };
  const html = await r.text();
  const links = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map(m => { try { return new URL(m[1], r.url).href; } catch { return ''; } }).filter(h => h.startsWith(url.origin) && /contact|about|connect|reach/i.test(h));
  return { html, links };
};
let browser = null;
const renderText = async u => {
  if (person(u)) return { skip: 'a person reads this site' };
  const url = new URL(u);
  if (disallowed(await robots(url.origin, UA), url.pathname)) return { skip: 'robots.txt' };
  if (!browser) {   // Playwright installed with the project, or (as in a cloud session) where only require() finds it
    let pw; try { pw = await import('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
    browser = await (pw.chromium || pw.default.chromium).launch();
  }
  const ctx = await browser.newContext({ userAgent: UA }), page = await ctx.newPage();
  try {
    const r = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2500);
    if (!r || r.status() !== 200) return { skip: 'HTTP ' + (r ? r.status() : 'error') };
    const mail = await page.$$eval('a[href^="mailto:"]', as => as.map(a => a.getAttribute('href')));
    return { html: mail.join(' ') + ' ' + await page.evaluate(() => document.body ? document.body.innerText : ''), links: [] };
  } finally { await ctx.close(); }
};
const lookFor = async (p, how) => {
  const site = p.website; if (!site) return { emails: [], on: '', note: 'no website of its own' };
  const origin = new URL(site).origin, tried = new Set();
  let note = '', on = '';
  const host = hostOf(site), all = [];
  const done = () => all.some(e => regOf(e.split('@')[1]) === regOf(host) && !ROLE_BAD.test(e));   // one at the site's own domain: enough
  const queue = [site, origin + '/contact', origin + '/contact-us', origin + '/about'];
  for (let i = 0; i < queue.length && tried.size < 6 && !done(); i++) {
    const u = queue[i]; if (tried.has(u)) continue; tried.add(u);
    try {
      const got = await how(u);
      if (got.skip) { if (i === 0) note = got.skip; continue; }
      const found = emailsIn(got.html).filter(e => !all.includes(e));
      if (found.length) { all.push(...found); if (!on || found.some(e => regOf(e.split('@')[1]) === regOf(host))) on = u; }
      if (i === 0) queue.splice(1, 0, ...got.links.slice(0, 3));
    } catch (e) { if (i === 0) note = String((e.cause && e.cause.code) || e.name); }
  }
  return all.length ? { emails: all, on, note: '' } : { emails: [], on: '', note: note || 'no email on its site' };
};

const claimedKeys = await (async () => { if (OFFLINE) return new Set(); try { const r = await fetch(SITE + 'groups/api.php?action=claimed', { headers: { 'X-PAS': '1' }, signal: AbortSignal.timeout(15000) }); return new Set((await r.json()).claimed || []); } catch { return new Set(); } })();
const rows = [];
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (next < providers.length) {
  const p = providers[next++];
  const city = /phila\.gov|freelibrary\.org/.test(p.host);
  const stored = [...new Set(p.items.map(i => i.email.toLowerCase()).filter(Boolean))];
  let look = { emails: [], on: '', note: '' };
  if (!OFFLINE && !stored.length && !city && p.website && !/philasd\.org/.test(p.host)) {
    look = await lookFor(p, fetchText);
    // the browser only for a site that answered but showed no address (one built in JavaScript): never for one that
    // refused a plain fetch (403, a bot check), which is a site asking not to be read this way
    if (!look.emails.length && BROWSER && look.note === 'no email on its site') { const b = await lookFor(p, renderText).catch(e => { console.error('browser: ' + e.message); return null; }); if (b && b.emails.length) look = b; }
  }
  const host = hostOf(p.website) || p.host;
  const all = [...new Set([...stored, ...look.emails])].filter(e => !ROLE_BAD.test(e) && score(e, host) > -5).sort((a, b) => (stored.includes(b) - stored.includes(a)) || score(b, host) - score(a, host));
  const best = all[0] || '';
  const shared = /\.(gov|edu)$/.test(host) || SHARED.test(host);
  const claimedN = p.items.filter(i => claimedKeys.has(i.k)).length;
  rows.push({
    provider: p.items.map(i => i.name).sort((a, b) => a.length - b.length)[0],
    email: best,
    canClaim: !best ? '' : regOf(best.split('@')[1]) === regOf(host) ? (shared ? 'Yes, once you approve it' : 'Yes') : 'Not with this address: set it up by hand',
    others: all.slice(1, 4).join(', '),
    from: !best ? (look.note || (city ? 'a City program' : '')) : stored.includes(best) ? 'Our listing (from their site)' : look.on,
    phone: [...new Set(p.items.map(i => i.phone).filter(Boolean))].join(', '),
    website: p.website,
    listings: p.items.map(i => i.name).join('\n'),
    links: p.items.map(i => i.url).join('\n'),
    what: [...new Set(p.items.flatMap(i => i.kinds))].join(', '),
    schools: p.items.reduce((n, i) => n + i.schools, 0),
    claimed: claimedN ? (claimedN === p.items.length ? 'Yes' : `${claimedN} of ${p.items.length}`) : 'No',
    type: city ? (p.items.some(i => i.rec) ? 'City rec center' : 'City program') : /philasd\.org/.test(p.host) ? 'No website of its own' : 'Provider',
  });
} }));
if (browser) await browser.close();
rows.sort((a, b) => a.type.localeCompare(b.type) || b.schools - a.schools || a.provider.localeCompare(b.provider));
console.log(JSON.stringify(rows, null, 1));
process.exit(0);
