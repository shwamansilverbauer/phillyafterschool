// The people who run a listing: claiming it with a work email, a parent's question passed along, a proposed change.
// Uses the hidden test listings, so no real program is touched.
import { test, ok, eq, deepEq, includes, excludes, person } from '../lib/harness.mjs';
import { programs } from '../lib/data.mjs';

const PREMIUM = 'p:test-listing-premium';   // claimDomain phillyafterschool.org, premium without a payment (data/test-listings.json)

test('claiming a listing: a named account whose email is at the listing’s own domain, and nobody else', async (ctx) => {
  const t = Date.now().toString(36);
  const manager = ctx.api().as(`mgr${t}@phillyafterschool.org`, 'Pat', 'Lee');
  await ctx.api().as(`nn4${t}@phillyafterschool.org`).fails('POST', 'claim_add', { listing: PREMIUM }, 'name');
  await person(ctx, 'Sly', 'Fox', 'str').fails('POST', 'claim_add', { listing: PREMIUM }, 'domain');
  await manager.fails('POST', 'claim_add', { listing: 'p:no-such-listing' }, 'listing', 404);
  const r = await manager.okay('POST', 'claim_add', { listing: PREMIUM });
  eq(r.status, 'ok', 'the domains match, so the claim stands at once');
  eq(r.claims.length, 1); eq(r.claims[0].listing, PREMIUM); eq(r.claims[0].status, 'ok');
  // The owner is told (a first claim rides along with the new-account note), by the manager's name and address.
  const told = await ctx.mail.waitFor('contact@phillyafterschool.org', /Signup: Pat Lee/);
  includes(told.TextBody, manager.email); includes(told.TextBody, 'Listing:'); includes(told.TextBody, 'the claim stands without you');
  // Asking again changes nothing; the public list of claimed listings shows it; "me" counts it.
  eq((await manager.okay('POST', 'claim_add', { listing: PREMIUM })).claims.length, 1);
  includes((await ctx.api().okay('GET', 'claimed')).claimed, PREMIUM);
  const me = (await manager.okay('GET', 'me')).user;
  eq(me.claims, 1); ok(me.role, 'a role for the menu');
  eq((await manager.okay('GET', 'claims')).claims.length, 1);
  // A real program's domain: an address at a provider's domain can claim that provider's listing.
  const p = programs().find(x => /^https:\/\/(www\.)?[a-z0-9-]+\.(org|com)\/?$/.test(x.website || ''));
  ok(p, 'a program with a plain .org or .com website');
  const dom = p.website.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
  const theirs = ctx.api().as(`hello${t}@${dom}`, 'Dana', 'Reyes');
  const r2 = await theirs.okay('POST', 'claim_add', { listing: 'p:' + p.id });
  ok(r2.status === 'ok' || r2.status === 'pending', 'stands or waits, depending on how shared the domain is');
  await theirs.fails('POST', 'claim_add', { listing: PREMIUM }, 'domain', 403);
  // Dropping a claim.
  const d = await manager.okay('POST', 'claim_drop', { listing: PREMIUM });
  deepEq(d.claims, []);
  excludes((await ctx.api().okay('GET', 'claimed')).claimed, PREMIUM);
});

test('a parent’s question goes to the people who hold the listing, with no copy kept and no sign-in needed', async (ctx) => {
  const t = Date.now().toString(36);
  excludes((await ctx.api().okay('GET', 'claimed')).claimed, PREMIUM, 'the test listing starts unclaimed');
  const manager = ctx.api().as(`mgr${t}@phillyafterschool.org`, 'Pat', 'Lee');
  await manager.okay('POST', 'claim_add', { listing: PREMIUM });
  const parent = ctx.api();   // signed out
  await parent.fails('POST', 'ask', { listing: PREMIUM, name: 'Dana', email: 'dana@example.test', text: 'Short' }, 'text');
  await parent.fails('POST', 'ask', { listing: PREMIUM, name: '', email: 'dana@example.test', text: 'Is there space on Tuesdays for a second grader?' }, 'name');
  await parent.fails('POST', 'ask', { listing: PREMIUM, name: 'Dana', email: 'nope', text: 'Is there space on Tuesdays for a second grader?' }, 'email');
  // The hidden box a script would fill: swallowed quietly.
  eq((await parent.okay('POST', 'ask', { listing: PREMIUM, name: 'Bot', email: 'bot@example.test', text: 'Buy things from my website please', company: 'x' })).ok, true);
  eq(ctx.mail.to(manager.email).length, 0, 'the bot’s message went nowhere');
  const r = await parent.okay('POST', 'ask', { listing: PREMIUM, name: 'Dana', email: 'dana@example.test', text: 'Is there space on Tuesdays for a second grader?' });
  ok(r.ok);
  const m = await ctx.mail.waitFor(manager.email, /question/i);
  includes(m.TextBody, 'Dana asked'); includes(m.TextBody, 'Is there space on Tuesdays'); eq(m.ReplyTo, 'dana@example.test', 'replying answers the parent');
  includes(m.TextBody, 'did not keep a copy');
  // Not a premium listing, or one nobody holds: no questions.
  await parent.fails('POST', 'ask', { listing: 'p:test-listing-free', name: 'Dana', email: 'dana@example.test', text: 'Is there space on Tuesdays for a second grader?' }, 'off', 403);
  await manager.okay('POST', 'claim_drop', { listing: PREMIUM });
  await parent.fails('POST', 'ask', { listing: PREMIUM, name: 'Dana', email: 'dana2@example.test', text: 'Is there space on Tuesdays for a second grader?' }, 'off', 403);
});

test('a proposed change from a listing’s manager reaches the owner; the manager’s own emails can be switched off', async (ctx) => {
  const t = Date.now().toString(36);
  const manager = ctx.api().as(`mgr${t}@phillyafterschool.org`, 'Pat', 'Lee');
  await manager.fails('POST', 'edit_add', { listing: PREMIUM, body: 'Our hours changed to 3 to 6.' }, 'claim', 403);
  await manager.okay('POST', 'claim_add', { listing: PREMIUM });
  await manager.fails('POST', 'edit_add', { listing: PREMIUM, body: 'Short' }, 'body');
  await manager.fails('POST', 'edit_add', { listing: PREMIUM, body: 'Our hours changed to 3 to 6 this year.', link: 'ftp://x' }, 'link');
  const r = await manager.okay('POST', 'edit_add', { listing: PREMIUM, body: 'Our hours changed to 3 to 6 this year.', link: 'https://phillyafterschool.org/' });
  ok(r.claims.length === 1);
  const m = await ctx.mail.waitFor('contact@phillyafterschool.org', /Proposed change/);
  includes(m.TextBody, 'Our hours changed to 3 to 6'); includes(m.TextBody, 'Pat Lee');
  const edits = ctx.site.sql(`SELECT listing, body, link FROM edits`);
  ok(edits.some(e => e.listing === PREMIUM && e.body.startsWith('Our hours')), 'kept for the weekly queue');
  // The monthly numbers and such can be turned off and on from the account.
  eq((await manager.okay('POST', 'mgr_mail', { on: false })).mail, false);
  eq(ctx.site.sql(`SELECT mgr_mail FROM users WHERE id = ${manager.id}`)[0].mgr_mail, 0);
  eq((await manager.okay('POST', 'mgr_mail', { on: true })).mail, true);
  eq((await manager.okay('GET', 'claims')).mail, true);
});

test('a review in a kid’s words: the form’s handler emails the owner a ready-made entry with the grade, and the name only when shown', async ({ site, mail }) => {
  const form = o => new URLSearchParams(o).toString();
  const post = o => fetch(`${site.base}/review/send.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(o), redirect: 'manual' });
  const { programs, schools } = await import('../lib/data.mjs');
  const p = programs()[0].id, s = schools()[0].id;
  const base = { program: p, school: s, stars: '5', comment: 'Chess club on Tuesdays is the best part of my week, and the snack is pretzels.', name: 'Pat', email: 'pat@example.test', firsthand: 'yes' };
  // A kid's review needs the grade.
  const noGrade = await post({ ...base, kid: 'yes', kidname: 'Sam' });
  eq(noGrade.status, 400); includes(await noGrade.text(), 'grade');
  // With the name shown.
  mail.clear();
  const r1 = await post({ ...base, kid: 'yes', kidname: 'Sam', kidgrade: '2', kidshow: 'yes' });
  eq(r1.status, 303, 'sent: on to the thanks page');
  const m1 = await mail.waitFor('contact@phillyafterschool.org', /Review/);
  includes(m1.TextBody, "IN A KID'S WORDS"); includes(m1.TextBody, '"kid": {'); includes(m1.TextBody, '"grade": "2"'); includes(m1.TextBody, '"name": "Sam"');
  // Without the name shown: the grade only.
  const r2 = await post({ ...base, email: 'pat2@example.test', kid: 'yes', kidname: 'Sam', kidgrade: 'K' });
  eq(r2.status, 303);
  const m2 = (await mail.to('contact@phillyafterschool.org')).at(-1);
  includes(m2.TextBody, '"grade": "K"'); excludes(m2.TextBody, '"name": "Sam"');
  // A parent's review carries no "kid" at all.
  const r3 = await post({ ...base, email: 'pat3@example.test' });
  eq(r3.status, 303);
  const m3 = (await mail.to('contact@phillyafterschool.org')).at(-1);
  excludes(m3.TextBody, '"kid"'); includes(m3.TextBody, 'New review, waiting');
});

test('a premium listing’s social links and Instagram posts: sent by its manager, checked by the owner, then on its page, with Instagram loaded only on a tap', async (ctx) => {
  if (!ctx.site.edit) return;
  const t = Date.now().toString(36);
  const manager = ctx.api().as(`soc${t}@phillyafterschool.org`, 'Pat', 'Lee');
  await manager.okay('POST', 'claim_add', { listing: PREMIUM });
  const soc = o => JSON.stringify(o);
  await manager.fails('POST', 'extra_save', { listing: PREMIUM, kind: 'social', body: soc({}) }, 'short');
  await manager.fails('POST', 'extra_save', { listing: PREMIUM, kind: 'social', body: soc({ ig: 'https://evil.example/makom' }) }, 'ig');
  await manager.fails('POST', 'extra_save', { listing: PREMIUM, kind: 'social', body: soc({ yt: 'https://youtu.be/abc' }) }, 'yt');
  const r = await manager.okay('POST', 'extra_save', { listing: PREMIUM, kind: 'social', body: soc({ ig: '@test.program', fb: 'https://m.facebook.com/TestProgram/?ref=x', tt: '' }) });
  deepEq(JSON.parse(r.claims.find(c => c.listing === PREMIUM).premium.texts.social.new), { ig: 'https://www.instagram.com/test.program/', fb: 'https://www.facebook.com/TestProgram' }, 'waiting, as plain addresses');
  const told = await ctx.mail.waitFor('contact@phillyafterschool.org', /Social links to approve/);
  includes(told.TextBody, 'Instagram: https://www.instagram.com/test.program/');
  await manager.fails('POST', 'extra_save', { listing: PREMIUM, kind: 'posts', body: soc(['https://www.instagram.com/test.program/']) }, 'post');
  await manager.fails('POST', 'extra_save', { listing: PREMIUM, kind: 'posts', body: soc(['https://www.instagram.com/p/AAAAA1/', 'https://www.instagram.com/p/AAAAA2/', 'https://www.instagram.com/p/AAAAA3/', 'https://www.instagram.com/reel/AAAAA4/']) }, 'long');
  await manager.okay('POST', 'extra_save', { listing: PREMIUM, kind: 'posts', body: soc(['https://www.instagram.com/p/AAAAA1/?utm_source=ig_web_copy_link', 'instagram.com/test.program/reel/AAAAA2', 'https://www.instagram.com/p/AAAAA1/']) });
  await ctx.mail.waitFor('contact@phillyafterschool.org', /Instagram posts to approve/);
  // Nothing shows while they wait.
  const before = await manager.okay('GET', 'extras', 'l=' + encodeURIComponent(PREMIUM));
  eq(before.social, null); deepEq(before.posts, []);
  // The owner checks the links and publishes both on the review page.
  const form = o => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  const login = await fetch(`${ctx.site.base}/edit/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ user: ctx.site.edit.user, pass: ctx.site.edit.password }), redirect: 'manual' });
  const cookie = login.headers.getSetCookie().find(c => c.startsWith('pas_edit=')).split(';')[0];
  const page = await (await fetch(`${ctx.site.base}/edit/claims/`, { headers: { Cookie: cookie } })).text();
  includes(page, 'Social links'); includes(page, 'Instagram posts (parents tap to load them)');
  includes(page, 'href="https://www.instagram.com/reel/AAAAA2/"', 'each link opens for a look');
  const csrf = /name="csrf" value="([^"]+)"/.exec(page)[1];
  for (const what of ['Facebook: https://www.facebook.com/TestProgram', 'https://www.instagram.com/p/AAAAA1/\nhttps://www.instagram.com/reel/AAAAA2/']) {
    const at = page.indexOf(what.replace(/\n/g, '\n')); ok(at > -1, 'on the review page: ' + what);
    const id = /name="id" value="(\d+)"/.exec(page.slice(at))[1];
    await fetch(`${ctx.site.base}/edit/claims/`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ csrf, id, do: 'extra_ok' }), redirect: 'manual' });
  }
  await ctx.mail.waitFor(manager.email, /Your social links for .* are on the site/);
  const after = await manager.okay('GET', 'extras', 'l=' + encodeURIComponent(PREMIUM));
  deepEq(after.social, { ig: 'https://www.instagram.com/test.program/', fb: 'https://www.facebook.com/TestProgram' });
  deepEq(after.posts, ['https://www.instagram.com/p/AAAAA1/', 'https://www.instagram.com/reel/AAAAA2/']);
  // On the listing's own page: "Follow", plain links to the posts, and Instagram asked for nothing until the tap.
  const b = await ctx.browser();
  const tab = await b.context(ctx.site, { sid: manager.cookie });
  const pg = await tab.open('/programs/' + PREMIUM.slice(2) + '/');
  await pg.waitForSelector('#social .pm-soc');
  eq(await pg.locator('#social a.pm-soc').count(), 2, 'Instagram and Facebook');
  eq(await pg.locator('#social a.pm-soc.ig').getAttribute('href'), 'https://www.instagram.com/test.program/');
  eq(await pg.locator('#instagram .pm-ig-links a').count(), 2, 'the posts as plain links first');
  ok(!tab.outside.some(u => /instagram\.com/.test(u)), 'nothing asked of Instagram yet: ' + tab.outside.join(', '));
  await pg.locator('#instagram .btn').click();
  await pg.waitForSelector('#instagram blockquote.instagram-media');
  eq(await pg.locator('#instagram blockquote.instagram-media').count(), 2, 'Instagram’s own embeds, once asked for');
  await tab.close();
  await manager.okay('POST', 'extra_drop', { listing: PREMIUM, kind: 'social' });
  await manager.okay('POST', 'extra_drop', { listing: PREMIUM, kind: 'posts' });
  eq((await manager.okay('GET', 'extras', 'l=' + encodeURIComponent(PREMIUM))).social, null, 'gone once taken down');
  await manager.okay('POST', 'claim_drop', { listing: PREMIUM });
});

test('a premium listing’s pin in Kids’ Playground: sent by its manager, checked by the owner, then only for a family whose child went there', async (ctx) => {
  if (!ctx.site.edit) return;
  const t = Date.now().toString(36);
  const manager = ctx.api().as(`pin${t}@phillyafterschool.org`, 'Pat', 'Lee');
  await manager.okay('POST', 'claim_add', { listing: PREMIUM });
  const pin = (n, c, i) => JSON.stringify({ n, c, i });
  await manager.fails('POST', 'extra_save', { listing: PREMIUM, kind: 'pin', body: pin('', 2, 'star') }, 'short');
  await manager.fails('POST', 'extra_save', { listing: PREMIUM, kind: 'pin', body: pin('Way Too Long A Name For A Little Pin', 2, 'star') }, 'long');
  await manager.fails('POST', 'extra_save', { listing: PREMIUM, kind: 'pin', body: pin('Dance Star', 12, 'star') }, 'color');
  await manager.fails('POST', 'extra_save', { listing: PREMIUM, kind: 'pin', body: pin('Dance Star', 2, 'logo') }, 'icon');
  await manager.fails('POST', 'extra_save', { listing: PREMIUM, kind: 'pin', body: pin('Go to www.example.com', 2, 'star') }, 'name');
  const r = await manager.okay('POST', 'extra_save', { listing: PREMIUM, kind: 'pin', body: pin('Dance  Star', 3, 'movement') });
  const mine = r.claims.find(c => c.listing === PREMIUM);
  deepEq(JSON.parse(mine.premium.texts.pin.new), { n: 'Dance Star', c: 3, i: 'movement' }, 'waiting, tidied');
  const told = await ctx.mail.waitFor('contact@phillyafterschool.org', /Kids’ Playground pin to approve/);
  includes(told.TextBody, 'Name: Dance Star'); includes(told.TextBody, 'only after going to the program');
  // A family whose child went there: nothing yet, while it waits.
  const pat = ctx.api().as(`fam${t}@example.test`, 'Ann', 'Fox');
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '2' }] });
  const y = (await pat.okay('GET', 'passport')).year;
  await pat.okay('POST', 'passport_save', { kid: 'Sam', done: [{ k: PREMIUM, kind: 'after', y, s: '' }] });
  deepEq((await pat.okay('GET', 'passport')).ppins, [], 'not before the owner says yes');
  // The owner publishes it on the review page.
  const form = o => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  const login = await fetch(`${ctx.site.base}/edit/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ user: ctx.site.edit.user, pass: ctx.site.edit.password }), redirect: 'manual' });
  const cookie = login.headers.getSetCookie().find(c => c.startsWith('pas_edit=')).split(';')[0];
  const page = await (await fetch(`${ctx.site.base}/edit/claims/`, { headers: { Cookie: cookie } })).text();
  includes(page, 'Kids’ Playground pin (kids see it only after going there)'); includes(page, 'Name: Dance Star'); includes(page, 'Color: green');
  const csrf = /name="csrf" value="([^"]+)"/.exec(page)[1];
  const id = new RegExp('Name: Dance Star[\\s\\S]*?name="id" value="(\\d+)"').exec(page)[1];
  await fetch(`${ctx.site.base}/edit/claims/`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ csrf, id, do: 'extra_ok' }), redirect: 'manual' });
  await ctx.mail.waitFor(manager.email, /Kids’ Playground pin for/);
  // Now the family whose child went there gets it; a family whose child didn't doesn't.
  deepEq((await pat.okay('GET', 'passport')).ppins, [{ k: PREMIUM, n: 'Dance Star', c: 3, i: 'movement' }]);
  const other = ctx.api().as(`fam2${t}@example.test`, 'Bo', 'Fox');
  await other.okay('POST', 'kids_save', { kids: [{ n: 'Rae', g: '1' }] });
  deepEq((await other.okay('GET', 'passport')).ppins, [], 'never offered as a goal to a child who hasn’t gone');
  // Its level is kept as seen like any pin; the manager can take it down.
  const s = await pat.okay('POST', 'passport_save', { kid: 'Sam', done: [{ k: PREMIUM, kind: 'after', y, s: '' }], seen: { ['prog:' + PREMIUM]: 1 } });
  eq(s.kid.seen['prog:' + PREMIUM], 1);
  await manager.okay('POST', 'extra_drop', { listing: PREMIUM, kind: 'pin' });
  deepEq((await pat.okay('GET', 'passport')).ppins, [], 'gone once taken down');
  await manager.okay('POST', 'claim_drop', { listing: PREMIUM });
});
