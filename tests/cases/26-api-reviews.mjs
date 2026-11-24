// Reviews, managers' words and photos, and claims by code, without the owner in the loop (scaling plan, Phase 6):
// the review form's request, the site's own checks, the private queue's review and content items, the runs' answers
// (outcomes for reviews, decisions for managers' items), the gate's question about a review, the Needs-you page's
// Publish and Decline, the signed photo link, and the code sent to a listing's published address. Everything here
// talks to the stand-in GitHub and the stand-in mail service; nothing reaches GitHub, an inbox or a real site.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, ok, eq, includes, excludes, matches, someone, codeIn } from '../lib/harness.mjs';
import { programs, schools } from '../lib/data.mjs';

const PREMIUM = 'p:test-listing-premium';   // a hidden test listing at phillyafterschool.org (data/test-listings.json)
const fakeKey = () => ['github', 'pat', 'r'.repeat(48)].join('_');   // key-shaped, made here: nothing in the repository looks like a token
const withKey = site => fs.writeFileSync(path.join(site.dir, 'phillyafterschool-github.key'), fakeKey() + '\n');
const SWITCH = { about: 'The autopilot switch. Only the owner changes it.', mode: 'shadow' };
// The switch on main, as the site reads it; the site remembers it a minute, so a test makes it look again.
const setSwitch = (site, github, mode) => { github.repo.put('data/autopilot.json', JSON.stringify({ ...SWITCH, mode }, null, 2) + '\n'); site.unmeta('ap_mode_at'); };
const form = o => new URLSearchParams(o).toString();
const domainOf = u => new URL(u).hostname.replace(/^www\./, '').split('.').slice(-2).join('.');
const hourly = async (api, extra = {}) => (await api().okay('POST', 'push_run', { queue_force: true, ...extra })).queue;
const openFile = github => JSON.parse(github.ops.read('queue/open.json') || '{"items":[]}');
const item = (github, id) => openFile(github).items.find(x => x.id === id);
// The sum the gate sends for an entry: one line per value (scripts/gate.mjs reviewSum, src/server/content.php review_sum).
const sum = e => crypto.createHash('sha256').update([e.id, e.programId, e.school, e.name, String(e.stars), e.comment, e.date, e.kid ? e.kid.grade : '', e.kid && e.kid.name ? e.kid.name : ''].map(x => x === undefined ? '' : String(x)).join('\n')).digest('hex');
const program = () => programs().find(p => p.website && !p.clubs);
const review = (o = {}) => ({ program: program().id, school: schools()[0].id, stars: 4, comment: 'Pickup was easy and the homework help is real. My kid asks to stay late every Thursday.', name: 'Rae', firsthand: true, ...o });
// A reviewer whose account isn't brand new in the rules' eyes: it has a school saved.
async function reviewer(ctx, tag = 'rv', school = true) {
  const c = ctx.api().as(someone(tag), 'Rae', 'Lee');
  if (school) await c.okay('POST', 'school_save', { school: schools()[0].id });
  return c;
}
// One manager on the premium test listing for these tests: a listing takes five claimants at most, and other test
// files claim it too.
let premiumManager = null;
async function manager(ctx) {
  if (premiumManager) return premiumManager;
  premiumManager = ctx.api().as(someone('rvmgr').replace('@example.test', '@phillyafterschool.org'), 'Dana', 'Reyes');
  const r = await premiumManager.post('claim_add', { listing: PREMIUM });
  if (r.body && r.body.error === 'limit') {   // full: be one of the accounts that already holds it
    const holder = ctx.site.sql(`SELECT u.email FROM claims c JOIN users u ON u.id = c.user_id WHERE c.listing = '${PREMIUM}' AND c.status = 'ok' ORDER BY c.id LIMIT 1`)[0];
    premiumManager = ctx.api().as(holder.email);
  } else if (!r.body || !r.body.ok) throw new Error('claim_add: ' + r.text.slice(0, 200));
  return premiumManager;
}
const reviewOf = (site, c) => site.sql(`SELECT * FROM reviews WHERE user_id = ${c.id}`)[0];
function pages(site) {
  const cookie = site.adminCookie();
  const get = async rel => (await fetch(`${site.base}/edit/${rel}`, { headers: { Cookie: cookie }, redirect: 'manual' })).text();
  const post = async (rel, fields) => { const r = await fetch(`${site.base}/edit/${rel}`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(fields), redirect: 'manual' }); return decodeURIComponent((r.headers.get('location') || '').replace(/^.*?said=/, '').replace(/#.*$/, '')); };
  const csrf = h => /name="csrf" value="([0-9a-f]{64})"/.exec(h)[1];
  return { get, post, csrf };
}
// A photo the site will take: a JPEG of 480 by 360 with some noise in it, drawn by PHP's own image library.
const jpeg = () => execFileSync('php', ['-r', '$i = imagecreatetruecolor(480, 360); for ($n = 0; $n < 6000; $n++) imagesetpixel($i, random_int(0, 479), random_int(0, 359), random_int(0, 0xffffff)); ob_start(); imagejpeg($i, null, 85); echo base64_encode(ob_get_clean());'], { encoding: 'utf8' });

test('a review: sent from the page by a signed-in account, checked as it comes in, the child’s details sealed on disk, nothing emailed; without JavaScript the form says so', async (ctx) => {
  const { site, mail } = ctx;
  await ctx.api().fails('POST', 'review_add', review(), 'signin', 401);
  const rae = await reviewer(ctx);
  await rae.fails('POST', 'review_add', review({ kid: true, kidname: 'Sammy' }), 'kidgrade');
  await rae.fails('POST', 'review_add', review({ comment: 'Lovely, see http://a.example and http://b.example for the details.' }), 'links');
  await rae.fails('POST', 'review_add', review({ program: 'no-such-program' }), 'program');
  await rae.fails('POST', 'review_add', review({ firsthand: false }), 'firsthand');
  await rae.fails('POST', 'review_add', review({ comment: 'Too short.' }), 'comment');
  mail.clear();
  await rae.okay('POST', 'review_add', review({ kid: true, kidname: 'Sammy', kidgrade: '2', kidshow: true }));
  const r = reviewOf(site, rae);
  matches(r.id, /^v[0-9a-f]{10}$/); eq(r.status, 'new', r.hold); eq(r.listing, 'p:' + program().id);
  ok(!site.dbBytes().includes(Buffer.from('Sammy')), 'the child’s name is sealed on disk');
  eq(mail.messages.length, 0, 'nothing is emailed: not the owner, not the reviewer');
  // Sent again while undecided, it replaces the first: one review per account per program.
  await rae.okay('POST', 'review_add', review({ comment: review().comment + ' Second thoughts: still great.' }));
  eq(site.sql(`SELECT COUNT(*) AS n FROM reviews WHERE user_id = ${rae.id}`)[0].n, 1);
  includes(reviewOf(site, rae).comment, 'Second thoughts');
  // The form without JavaScript: told to turn it on, and nothing is emailed.
  const nojs = await fetch(`${site.base}/review/send.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ program: program().id, school: schools()[0].id, stars: '5', comment: review().comment, name: 'Pat', email: 'pat@example.test', firsthand: 'yes' }), redirect: 'manual' });
  eq(nojs.status, 400); includes(await nojs.text(), 'JavaScript');
  eq(mail.messages.length, 0);
  // The page: the code step is there, and the policy page is a draft nobody is pointed to.
  const page = site.read('review/index.html');
  includes(page, 'id="rv-code"'); includes(page, 'data-thanks='); excludes(page, 'review-policy/');
  const policy = site.read('review-policy/index.html');
  includes(policy, 'Draft for review'); includes(policy, 'noindex'); excludes(site.read('sitemap.xml'), 'review-policy');
});

test('the site holds a review that has a link, an accusation, a name or strong words, one from the program’s own address, and one from a brand-new account; held ones never reach the queue', async (ctx) => {
  const { site, api, github } = ctx;
  withKey(site);
  const send = async (c, o) => { await c.okay('POST', 'review_add', review(o)); return reviewOf(site, c); };
  const t = Date.now().toString(36);
  const held = {
    link: await send(await reviewer(ctx, 'rvl'), { comment: `Great staff ${t}. More about it at www.example-club.com if you want.` }),
    accusation: await send(await reviewer(ctx, 'rva'), { comment: `The playground felt unsafe and nobody was watching the kids ${t}.` }),
    person: await send(await reviewer(ctx, 'rvp'), { comment: `Ms. Rivera was so kind to us every single afternoon ${t}.` }),
    profanity: await send(await reviewer(ctx, 'rvx'), { comment: `The snack was crap but the art projects were wonderful ${t}.` }),
  };
  for (const [code, r] of Object.entries(held)) { eq(r.status, 'held', code); includes(r.hold.split(','), code); }
  const own = ctx.api().as(`rvown${t}@${domainOf(program().website)}`, 'Rae', 'Lee');
  await own.okay('POST', 'school_save', { school: schools()[0].id });
  const o = await send(own, { comment: `Truly the best program in the city, we love it here ${t}.` });
  eq(o.status, 'held'); includes(o.hold, 'own-domain');
  // A brand-new account with nothing saved: held for the owner by default ("hold") ...
  const fresh = await reviewer(ctx, 'rvf', false);
  eq((await send(fresh, { comment: `Fresh account review ${t}, a good place for our family.` })).hold, 'new-account');
  // ... or, with "wait", it waits a day out of the queue instead, and goes in once the account has a school saved.
  const later = await reviewer(ctx, 'rvw', false);
  await later.okay('POST', 'review_add', { ...review({ comment: `Waiting account review ${t}, homework help is great.` }), test_fresh: 'wait' });
  const w = reviewOf(site, later);
  eq(w.status, 'new');
  await hourly(api, { test_fresh: 'wait' });
  ok(!item(github, w.id), 'a brand-new account’s review waits');
  await later.okay('POST', 'school_save', { school: schools()[0].id });
  await hourly(api, { test_fresh: 'wait' });
  ok(item(github, w.id), 'and goes to the queue once the account has a school saved');
  // Nothing held left the host.
  const raw = github.ops.read('queue/open.json');
  for (const r of [...Object.values(held), o]) excludes(raw, r.id, 'a held review never reaches the queue');
  // On the Needs-you page, each with its reason in a sentence.
  const h = await pages(site).get('needs/');
  includes(h, 'Reviews waiting'); includes(h, 'It may make an accusation'); includes(h, 'The reviewer’s account is at the program’s own email domain.');
  includes(h, `Ms. Rivera was so kind to us every single afternoon ${t}.`);
});

test('a clean review goes to the private queue with its exact entry, the gate can ask the site about it, and the reviewer is thanked once it is on the site; held, declined and closed ones aren’t', async (ctx) => {
  const { site, api, github, mail } = ctx;
  withKey(site);
  const t = Date.now().toString(36);
  const rae = await reviewer(ctx, 'rvq');
  await rae.okay('POST', 'review_add', review({ comment: `Clean review ${t}: pickup was smooth and the coaches are patient.`, kid: true, kidgrade: '3', kidname: 'Zoe', kidshow: false }));
  const r = reviewOf(site, rae);
  eq(r.status, 'new', r.hold);
  await hourly(api);
  const it = item(github, r.id);
  ok(it, 'in queue/open.json'); eq(it.kind, 'review'); eq(it.listing, 'p:' + program().id);
  const e = it.entry;
  eq(e.id, r.id); eq(e.programId, program().id); eq(e.stars, 4); eq(e.name, 'Rae'); matches(e.date, /^\d{4}-\d{2}-\d{2}$/);
  eq(JSON.stringify(e.kid), '{"grade":"3"}', 'the child’s grade, and no name when it isn’t to be shown');
  excludes(github.ops.read('queue/open.json'), rae.email, 'no address in the queue');
  matches(it.sender, /^k[0-9a-f]{16}$/);
  // The gate's question: yes for the entry as sent, no for one changed on the way, and nothing for an id it never gave.
  const ask = async (id, s) => (await ctx.api().okay('GET', 'review_check', `id=${id}&sum=${s}`));
  let a = await ask(e.id, sum(e)); eq(a.known, true); eq(a.match, true); eq(a.clean, true);
  a = await ask(e.id, sum({ ...e, comment: e.comment + ' Also five stars.' })); eq(a.match, false); eq(a.clean, false);
  a = await ask('v0000000000', sum(e)); eq(a.known, false);
  // The run puts it in its pull request: it waits for the merge, and can no longer be sent again.
  github.ops.put(`outcomes/queue-${t}-0541.json`, JSON.stringify({ run: `queue-${t}-0541`, pr: 8801, items: [{ item: r.id, outcome: 'published', listing: 'p:' + program().id }] }));
  await hourly(api);
  eq(site.sql(`SELECT state FROM queue_items WHERE id = '${r.id}'`)[0].state, 'waiting');
  eq(reviewOf(site, rae).pr, 8801);
  await rae.fails('POST', 'review_add', review(), 'again', 409);
  // Merged half an hour ago: on the site, and one thank-you with the link to the reviews.
  github.pulls[8801] = { state: 'closed', merged: true, merged_at: new Date(Date.now() - 1800e3).toISOString() };
  mail.clear();
  await hourly(api);
  eq(reviewOf(site, rae).status, 'published');
  const m = await mail.waitFor(rae.email, /Your review of/);
  includes(m.TextBody, `/programs/${program().id}/#reviews`); excludes(m.TextBody, 'Zoe');
  await hourly(api);
  eq(mail.to(rae.email).length, 1, 'thanked once');
  // Declined: settled, and nobody is emailed. Held with no pull request: on the Needs-you page. A closed pull request: held too.
  const [d, h, c] = [await reviewer(ctx, 'rvd'), await reviewer(ctx, 'rvh'), await reviewer(ctx, 'rvc')];
  for (const [x, n] of [[d, 'declined'], [h, 'held'], [c, 'closed']]) await x.okay('POST', 'review_add', review({ comment: `A review to be ${n} ${t}, with enough words in it.` }));
  await hourly(api);
  const [rd, rh, rc] = [reviewOf(site, d), reviewOf(site, h), reviewOf(site, c)];
  github.ops.put(`outcomes/queue-${t}-1241.json`, JSON.stringify({ run: `queue-${t}-1241`, items: [{ item: rd.id, outcome: 'declined' }, { item: rh.id, outcome: 'held' }, { item: rc.id, outcome: 'published', pr: 8802 }] }));
  github.pulls[8802] = { state: 'closed', merged: false };
  mail.clear();
  await hourly(api); await hourly(api);
  eq(reviewOf(site, d).status, 'declined'); eq(reviewOf(site, h).status, 'held'); eq(reviewOf(site, h).hold, 'run');
  eq(reviewOf(site, c).status, 'held'); eq(reviewOf(site, c).hold, 'pr-closed');
  for (const x of [d, h, c]) eq(mail.to(x.email).length, 0, 'no email for a review that isn’t on the site');
  const page = await pages(site).get('needs/');
  includes(page, 'A research run held it for your decision.'); includes(page, 'Its pull request was closed without a merge.');
});

test('Needs you: Publish puts a held review on data/reviews.json on main with one commit, and its reviewer is thanked; Decline keeps it off and emails nobody', async (ctx) => {
  const { site, api, github, mail } = ctx;
  withKey(site);
  const t = Date.now().toString(36);
  github.repo.put('data/reviews.json', '[]\n');
  const [a, b] = [await reviewer(ctx, 'rvn'), await reviewer(ctx, 'rvm')];
  await a.okay('POST', 'review_add', review({ comment: `Coach Dan made my son feel at home from the first day ${t}.` }));
  await b.okay('POST', 'review_add', review({ comment: `Nobody watched them and it felt unsafe at pickup ${t}.` }));
  const [ra, rb] = [reviewOf(site, a), reviewOf(site, b)];
  eq(ra.status, 'held'); eq(rb.status, 'held');
  const { get, post, csrf } = pages(site);
  const h = await get('needs/');
  includes(h, `Coach Dan made my son feel at home from the first day ${t}.`); includes(h, 'It may name a person');
  const said = await post('needs/', { csrf: csrf(h), do: 'review_ok', review: ra.id });
  includes(said, 'Published');
  const commit = github.repo.commits.filter(c => c.path === 'data/reviews.json').at(-1);
  ok(commit && commit.branch === 'main', 'one commit to main'); includes(commit.message, 'approved on the Needs-you page');
  const file = JSON.parse(github.repo.read('data/reviews.json'));
  const entry = file.find(x => x.id === ra.id);
  ok(entry, 'the entry is in the file'); includes(entry.comment, 'Coach Dan'); eq(entry.name, 'Rae');
  ok(github.repo.read('data/reviews.json').startsWith('[\n  {'), 'two-space JSON, as the build writes it');
  eq(reviewOf(site, a).status, 'published');
  includes(await post('needs/', { csrf: csrf(await get('needs/')), do: 'review_ok', review: ra.id }), 'already decided');
  mail.clear();
  await hourly(api);
  await mail.waitFor(a.email, /Your review of/);
  includes(await post('needs/', { csrf: csrf(await get('needs/')), do: 'review_no', review: rb.id }), 'Declined');
  eq(reviewOf(site, b).status, 'declined');
  await hourly(api);
  eq(mail.to(b.email).length, 0);
  excludes(github.repo.read('data/reviews.json'), rb.id);
});

test('a manager’s words, offer and pin go to the queue for a run to rate; its “ok” publishes only with the autopilot on and the site’s own checks agreeing, and the manager is told', async (ctx) => {
  const { site, api, github, mail } = ctx;
  withKey(site); setSwitch(site, github, 'shadow');
  const t = Date.now().toString(36);
  const mgr = await manager(ctx);
  const save = async (kind, body, until) => { await mgr.okay('POST', 'extra_save', { listing: PREMIUM, kind, body, ...(until ? { until } : {}) }); return site.sql(`SELECT * FROM extras WHERE listing = '${PREMIUM}' AND kind = '${kind}' ORDER BY id DESC LIMIT 1`)[0]; };
  const words = await save('words', `We run art every afternoon in our studio, with a snack at three and time outside when it is dry ${t}.`);
  await hourly(api);
  const it = item(github, 'x' + words.id);
  ok(it, 'in the queue'); eq(it.kind, 'words'); includes(it.text, `time outside when it is dry ${t}`);
  // The run passes it in shadow mode: it stays with the owner, with the run's word beside it.
  github.ops.put(`decisions/queue-${t}-0541.json`, JSON.stringify({ run: `queue-${t}-0541`, items: [{ item: 'x' + words.id, decision: 'ok' }] }));
  mail.clear();
  await hourly(api);
  let row = site.sql(`SELECT status, say, hold, rated FROM extras WHERE id = ${words.id}`)[0];
  eq(row.status, 'new'); eq(row.say, 'ok'); ok(row.rated > 0);
  includes(await pages(site).get('needs/'), 'A run would publish this');
  ok(!item(github, 'x' + words.id), 'rated: out of the queue');
  // The autopilot on: it publishes, and its manager is told in the site's own words.
  setSwitch(site, github, 'on');
  await hourly(api);
  eq(site.sql(`SELECT status FROM extras WHERE id = ${words.id}`)[0].status, 'ok');
  const m = await mail.waitFor(mgr.email, /is on/);
  includes(m.Subject, 'section in your own words'); includes(m.TextBody, 'passed the site’s checks');
  // A run's "ok" doesn't outrank the site's own checks: a web address in the words holds it, with the reason.
  const linky = await save('offer', `Open house at our studio, details at www.example-studio.com ${t}`, new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10));
  const pin = await save('pin', JSON.stringify({ n: 'Art Star', c: 2, i: 'art' }));
  await hourly(api);
  github.ops.put(`decisions/queue-${t}-1241.json`, JSON.stringify({ run: `queue-${t}-1241`, items: [{ item: 'x' + linky.id, decision: 'ok' }, { item: 'x' + pin.id, decision: 'hold', rule: 'claim' }, { item: 'x999999', decision: 'ok' }, { item: 'x' + words.id, decision: 'hold' }] }));
  await hourly(api);
  row = site.sql(`SELECT status, hold FROM extras WHERE id = ${linky.id}`)[0]; eq(row.status, 'new'); eq(row.hold, 'link');
  row = site.sql(`SELECT status, hold FROM extras WHERE id = ${pin.id}`)[0]; eq(row.status, 'new'); eq(row.hold, 'claim');
  eq(site.sql(`SELECT status FROM extras WHERE id = ${words.id}`)[0].status, 'ok', 'a row already decided isn’t rated again');
  const h = await pages(site).get('needs/');
  includes(h, 'It has a link or a web address in it.'); includes(h, 'It makes a guarantee or a “best” claim.');
  // Social links publish at once while the autopilot is on (they pass their own address checks).
  const s = await mgr.okay('POST', 'extra_save', { listing: PREMIUM, kind: 'social', body: JSON.stringify({ ig: 'testlistingart' }) });
  eq(s.live, true); eq(site.sql(`SELECT status FROM extras WHERE listing = '${PREMIUM}' AND kind = 'social' ORDER BY id DESC LIMIT 1`)[0].status, 'ok');
  setSwitch(site, github, 'shadow');
});

test('a photo needs the tick that everyone shown agreed; the queue carries a signed link the run can open for a day, and a run’s “ok” publishes it with the autopilot on', async (ctx) => {
  const { site, api, github, mail } = ctx;
  withKey(site); setSwitch(site, github, 'shadow');
  const t = Date.now().toString(36);
  const mgr = await manager(ctx);
  const data = jpeg();
  await mgr.fails('POST', 'photo_add', { listing: PREMIUM, alt: `Kids painting a mural ${t}`, permission: true, data }, 'consent');
  await mgr.okay('POST', 'photo_add', { listing: PREMIUM, alt: `Kids painting a mural ${t}`, permission: true, consent: true, data });
  await mgr.okay('POST', 'photo_add', { listing: PREMIUM, kind: 'logo', alt: `The studio logo ${t}`, permission: true, data });   // a logo needs no such tick
  const photo = site.sql(`SELECT * FROM photos WHERE alt = 'Kids painting a mural ${t}'`)[0];
  eq(photo.consent, 1);
  await hourly(api);
  const it = item(github, 'f' + photo.id);
  ok(it, 'in the queue'); eq(it.kind, 'photo'); eq(it.consent, true);
  matches(it.look, /^https:\/\/phillyafterschool\.org\/groups\/api\.php\?action=photo_look&id=\d+&e=\d+&s=[0-9a-f]{64}$/);
  const look = it.look.replace('https://phillyafterschool.org', site.base);
  const exp = +new URL(look).searchParams.get('e'); ok(exp - Date.now() / 1000 >= 24 * 3600 - 60, 'good for at least a day');
  let r = await fetch(look); const bytes = Buffer.from(await r.arrayBuffer());
  eq(r.status, 200); eq(r.headers.get('content-type'), 'image/jpeg'); includes(r.headers.get('cache-control') || '', 'no-store'); eq(bytes[0], 0xff, 'a JPEG'); eq(bytes[1], 0xd8);
  r = await fetch(look.replace(/s=[0-9a-f]{4}/, 's=0000')); await r.arrayBuffer(); eq(r.status, 403, 'a link with the wrong signature opens nothing');
  r = await fetch(look.replace(/e=\d+/, 'e=' + (exp + 21600))); await r.arrayBuffer(); eq(r.status, 403, 'nor one whose time was changed');
  setSwitch(site, github, 'on');
  github.ops.put(`decisions/queue-${t}-0541.json`, JSON.stringify({ run: `queue-${t}-0541`, items: [{ item: 'f' + photo.id, decision: 'ok' }] }));
  mail.clear();
  await hourly(api);
  eq(site.sql(`SELECT status FROM photos WHERE id = ${photo.id}`)[0].status, 'ok');
  await mail.waitFor(mgr.email, /photo/);
  setSwitch(site, github, 'shadow');
});

test('claims by code: off until it’s switched on; then a code goes to the listing’s published address, typing it makes the claim stand, a clash or a request to check waits for the owner', async (ctx) => {
  const { site, mail } = ctx;
  const t = Date.now().toString(36);
  const ON = { test_claim_code: true };
  const held = new Set(site.sql(`SELECT listing FROM claims WHERE status != 'declined'`).map(r => r.listing));   // other tests may hold some
  const p = programs().find(x => x.email && x.website && !x.clubs && !held.has('p:' + x.id));
  ok(p, 'a program whose website publishes an email address');
  const key = 'p:' + p.id;
  const pat = ctx.api().as(`pat${t}@example.test`, 'Pat', 'Lee');
  await pat.fails('POST', 'claim_add', { listing: key }, 'domain');   // off: as before
  await pat.fails('POST', 'claim_code_start', { listing: key }, 'off');
  const offer = await pat.fails('POST', 'claim_add', { listing: key, ...ON }, 'domain');
  eq(offer.ask, true); matches(offer.code, /^.{1,2}…@/); includes(offer.message, offer.code);
  mail.clear();
  const start = await pat.okay('POST', 'claim_code_start', { listing: key, ...ON });
  eq(start.to, offer.code);
  const m = await mail.waitFor(p.email, /asked to manage/);
  includes(m.TextBody, 'Pat Lee'); includes(m.TextBody, pat.email);
  let c = site.sql(`SELECT status, via FROM claims WHERE user_id = ${pat.id} AND listing = '${key}'`)[0];
  eq(c.status, 'pending'); eq(c.via, 'code-sent');
  excludes(await pages(site).get('needs/'), `${pat.email}`, 'a code still good: not the owner’s to decide yet');
  await pat.fails('POST', 'claim_code_finish', { req: start.req, code: '000000', ...ON }, 'code');
  const fin = await pat.okay('POST', 'claim_code_finish', { req: start.req, code: codeIn(m), ...ON });
  eq(fin.status, 'ok');
  c = site.sql(`SELECT status, via, domain FROM claims WHERE user_id = ${pat.id} AND listing = '${key}'`)[0];
  eq(c.status, 'ok'); eq(c.via, 'code'); eq(c.domain, 'by code');
  await pat.fails('POST', 'claim_code_finish', { req: start.req, code: codeIn(m), ...ON }, 'expired');
  // A change proposed within a day of a claim by code says so in the queue, for the run to hold one to the website, phone or email.
  withKey(site);
  await pat.okay('POST', 'edit_add', { listing: key, body: `Please change the phone number to our new one ${t}.` });
  await hourly(ctx.api);
  const prop = openFile(ctx.github).items.find(x => x.kind === 'proposal' && (x.details || '').includes(t));
  ok(prop, 'the proposal is in the queue'); eq(prop.claim, 'by code, under a day');
  // Someone at another address with the code too: the owner says which stands.
  const sam = ctx.api().as(`sam${t}@example.org`, 'Sam', 'Ray');
  mail.clear();
  const s2 = await sam.okay('POST', 'claim_code_start', { listing: key, ...ON });
  const m2 = await mail.waitFor(p.email, /asked to manage/);
  eq((await sam.okay('POST', 'claim_code_finish', { req: s2.req, code: codeIn(m2), ...ON })).status, 'pending');
  includes(await pages(site).get('needs/'), 'someone at another address already holds the listing');
  // Asking a person to check instead.
  const other = programs().find(x => x.id !== p.id && x.website && !x.clubs && !held.has('p:' + x.id));
  const zoe = ctx.api().as(`zoe${t}@example.test`, 'Zoe', 'Park');
  const asked = await zoe.okay('POST', 'claim_add', { listing: 'p:' + other.id, ask: true, ...ON });
  eq(asked.status, 'pending');
  eq(site.sql(`SELECT via FROM claims WHERE user_id = ${zoe.id}`)[0].via, 'asked');
  includes(await pages(site).get('needs/'), 'they asked a person to check');
});
