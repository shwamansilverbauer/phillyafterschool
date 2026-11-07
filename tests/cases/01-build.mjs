// The build and what it must never contain: secrets, private names, wording the site has rules about.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, ok, eq, includes, excludes, matches, ROOT, Failure } from '../lib/harness.mjs';
import { programs, schools, camps, config } from '../lib/data.mjs';

const TEXT = /\.(mjs|js|json|md|php|html|css|txt|yml|yaml|svg|xml|gs|py|sh)$/;
const tracked = () => execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => f && TEXT.test(f));
const walk = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (TEXT.test(e.name)) out.push(p); } return out; };
const pages = site => walk(site.pub).filter(f => f.endsWith('.html'));

test('the build finishes clean: no data errors, no orphaned wording edits, and the worklist is well formed', async ({ site }) => {
  matches(site.buildOutput, /Built \d+ school page\(s\)/, 'the build reported what it made');
  const orphans = site.buildOutput.split('\n').filter(l => /^- [0-9a-f]{10}: /.test(l));
  eq(orphans.length, 0, 'an edit in data/copy.json no longer matches a sentence:\n' + orphans.join('\n'));
  const check = JSON.parse(site.read('data/check.json'));
  for (const k of ['pages', 'links', 'weekend', 'camps', 'told', 'asks', 'summary']) ok(k in check, `check.json has "${k}"`);
  for (const f of ['programs.json', 'schools.json', 'camps.json', 'alerts.json', 'school-finder.json']) JSON.parse(site.read('data/' + f));
});

test('every school, program, camp and neighborhood has its page, and the sitemap lists the public ones', async ({ site }) => {
  const sitemap = site.read('sitemap.xml');
  for (const s of schools()) { ok(site.exists(`${s.id}/index.html`), `school page ${s.id}`); includes(sitemap, `/${s.id}/`, `sitemap has ${s.id}`); }
  for (const p of programs()) { ok(site.exists(`programs/${p.id}/index.html`), `program page ${p.id}`); includes(sitemap, `/programs/${p.id}/`, `sitemap has ${p.id}`); }
  for (const c of camps().camps) {
    if (c.program) { includes(site.read(`programs/${c.program}/index.html`), 'id="summer"', `camp ${c.id} shows as ${c.program}'s Summer section`); continue; }
    ok(site.exists(`summer-camps/${c.id}/index.html`), `camp page ${c.id}`);
  }
  // A neighborhood page exists for every neighborhood with a school or a weekday program in it (weekend-only and
  // camp-only listings are reached by type and from the camps list, not by neighborhood).
  const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const hoods = new Set([...schools().flatMap(s => String(s.neighborhood || '').split('/').map(x => x.trim()).filter(Boolean)), ...programs().filter(p => Object.keys(p.schools || {}).length).flatMap(p => p.neighborhoods || [])].map(slug));
  for (const h of hoods) ok(site.exists(`neighborhoods/${h}/index.html`), `neighborhood page ${h}`);
  for (const must of ['index.html', 'privacy/index.html', 'terms/index.html', 'register/index.html', 'account/index.html', 'summer-camps/index.html', 'weekends/index.html', 'days-off/index.html', 'robots.txt', 'manifest.json', 'sw.js', 'groups/api.php', '404.html']) ok(site.exists(must), must);
  // The hidden test listings: pages for the owner, kept out of the sitemap and search engines.
  excludes(sitemap, 'test-listing');
  for (const id of ['test-listing-premium', 'test-listing-free']) { const h = site.read(`programs/${id}/index.html`); includes(h, 'noindex', `${id} is noindex`); }
  excludes(site.read('data/programs.json'), 'test-listing', 'the public program data never carries the test listings');
});

test('wording rules: no claim that listings are checked by hand, no Venmo, the support line, and the maker’s link only in the footer', async ({ site }) => {
  const html = pages(site);
  let support = 0;
  for (const f of html) {
    const h = fs.readFileSync(f, 'utf8');
    const rel = path.relative(site.pub, f);
    ok(!/(checked|verified|reviewed|confirmed|vetted) by hand/i.test(h), `${rel} claims something is checked by hand`);
    ok(!/venmo/i.test(h), `${rel} mentions Venmo`);
    if (h.includes('Help the site keep going')) support++;
    const links = h.match(/href="https:\/\/joshsilverbauer\.com[^"]*"/g) || [];
    ok(links.length <= 1, `${rel} links joshsilverbauer.com ${links.length} times`);
    if (links.length) { const foot = h.slice(h.lastIndexOf('<footer')); ok(foot.includes(links[0]), `${rel}: the joshsilverbauer.com link is outside the footer`); }
  }
  ok(support > html.length * 0.8, `the support line is on ${support} of ${html.length} pages`);
  // What a premium listing costs is for the people who run programs: it is never on a page a parent uses.
  const cfg = config();
  const price = cfg.groups && cfg.groups.premiumPrice;
  if (price) for (const rel of ['index.html', `${schools()[0].id}/index.html`, `programs/${programs()[0].id}/index.html`, 'summer-camps/index.html', 'weekends/index.html', 'days-off/index.html']) {
    const h = site.read(rel);
    ok(!new RegExp(`\\$${price.month}\\b[^<]{0,30}(a|per|/)\\s*month`).test(h) && !new RegExp(`\\$${price.year}\\b[^<]{0,30}(a|per|/)\\s*year`).test(h), `${rel} shows the premium price`);
  }
});

test('public data carries no editor, no sender and no secret: emails in the built pages are the site’s own', async ({ site }) => {
  const cfg = config();
  const mine = new Set([cfg.contactEmail.toLowerCase()]);
  // Every address the data publishes (a provider's own address, a coach a school's page names) is the provider's word and may show.
  const published = new Set((fs.readFileSync(path.join(ROOT, 'data/programs.json'), 'utf8') + fs.readFileSync(path.join(ROOT, 'data/camps.json'), 'utf8') + fs.readFileSync(path.join(ROOT, 'data/schools.json'), 'utf8')).match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi).map(e => e.toLowerCase()));
  const providers = published;
  for (const f of pages(site)) {
    const h = fs.readFileSync(f, 'utf8');
    const rel = path.relative(site.pub, f);
    for (const e of h.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []) {
      const x = e.toLowerCase();
      if (mine.has(x) || providers.has(x) || /@(example|yourschool|yourdomain)\./.test(x) || /^(info|hello|you|name|parent|someone|email)@/.test(x) && /\.(example|test|org|com)$/.test(x) && !/joshsilverbauer|gmail/.test(x)) continue;
      throw new Failure(`${rel} carries an email address that is not the site’s or a provider’s: ${e}`);
    }
    for (const a of cfg.admins || []) ok(!h.includes(a) || a === cfg.contactEmail, `${rel} names an admin address`);
  }
});

// (The patterns are spelled with [_] so a grep for the real prefixes never matches this file.)
const SECRET = [
  [/sk[_](live|test)[_][A-Za-z0-9]{8,}/, 'a Stripe secret key'], [/whsec[_][A-Za-z0-9]{8,}/, 'a Stripe webhook secret'], [/rk[_]live[_][A-Za-z0-9]{8,}/, 'a Stripe restricted key'],
  [/github_pat_[A-Za-z0-9_]{20,}/, 'a GitHub token'], [/ghp_[A-Za-z0-9]{30,}/, 'a GitHub token'], [/pk_[a-f0-9]{30,}/, 'a Klaviyo private key'],
  [/xox[abp]-[A-Za-z0-9-]{10,}/, 'a Slack token'], [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'], [/AKIA[0-9A-Z]{16}/, 'an AWS key'],
];

test('nothing tracked in the repository or built into the site carries a secret', async ({ site }) => {
  const files = [...tracked().map(f => path.join(ROOT, f)), ...walk(site.pub)];
  for (const f of files) {
    if (/\/vendor\/|\/assets\/leaflet\//.test(f)) continue;
    const t = fs.readFileSync(f, 'utf8');
    for (const [re, what] of SECRET) ok(!re.test(t), `${path.relative(ROOT, f)} looks like it carries ${what}`);
  }
  // Keys and tokens live in files the repository ignores.
  const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  for (const pat of ['phillyafterschool-*.key', 'phillyafterschool-*.json', 'phillyafterschool-data/', 'tests/.scratch/']) includes(ignore, pat, '.gitignore');
  ok(!tracked().some(f => /\.key$/.test(f) || /^phillyafterschool-/.test(f)), 'no key file is tracked');
  // The edit page keeps only a password hash.
  const cfg = config();
  if (cfg.editLogin) matches(cfg.editLogin.passwordHash || '', /^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/, 'editLogin holds a bcrypt hash');
});

// Words that must never appear in the repository or the built site: the family's own names, private addresses,
// tokens. The list itself is private, so it lives outside version control, in phillyafterschool-private.json next to
// build.mjs (ignored by .gitignore): { "never": ["word", "another"] }. Without the file this test is skipped.
test('private words (from phillyafterschool-private.json) appear nowhere in the repository or the built site', async ({ site }) => {
  const file = path.join(ROOT, 'phillyafterschool-private.json');
  if (!fs.existsSync(file)) throw Object.assign(new Failure('no phillyafterschool-private.json beside build.mjs (see tests/README.md)'), { skip: true });
  const words = JSON.parse(fs.readFileSync(file, 'utf8')).never || [];
  ok(words.length > 0, 'the file lists words');
  const files = [...tracked().map(f => path.join(ROOT, f)), ...walk(site.pub)];
  const hits = [];
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8').toLowerCase();
    for (const w of words) if (t.includes(w.toLowerCase())) hits.push(`${path.relative(ROOT, f)}: word #${words.indexOf(w) + 1}`);
  }
  eq(hits.length, 0, 'private words found (numbered, not quoted):\n' + hits.join('\n'));
});
