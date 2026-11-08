// Signing in and out, and the guards every request passes.
import { test, ok, eq, includes, excludes, matches, someone, codeIn, linkIn } from '../lib/harness.mjs';

test('health answers, and a POST without the page header is refused', async ({ api, site }) => {
  const c = api();
  const h = await c.okay('GET', 'health');
  ok(h.ok, 'health ok');
  const r = await fetch(`${site.base}/groups/api.php?action=login_start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  eq(r.status, 403, 'no X-PAS header');
  const r2 = await fetch(`${site.base}/groups/api.php?action=login_start`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PAS': '1', Origin: 'https://evil.example' }, body: '{}' });
  eq(r2.status, 403, 'another site as the origin');
  const r3 = await fetch(`${site.base}/groups/api.php?action=login_start`, { method: 'PUT', headers: { 'X-PAS': '1' } });
  eq(r3.status, 405, 'only GET and POST');
});

test('sign in with the emailed code: the email names the site, the code works once, and "me" knows who', async ({ api, mail }) => {
  const c = api();
  const email = someone('auth');
  const start = await c.okay('POST', 'login_start', { email, next: 'account' });
  ok(start.req, 'a request id'); eq(start.minutes, 10, 'the link and code last ten minutes');
  const m = await mail.waitFor(email, /sign-in/i);
  includes(m.Subject, 'Philly After School');
  matches(m.TextBody, /(\d{3}) (\d{3})/, 'a six-digit code, shown as two halves');
  includes(m.TextBody, '/account/#t=', 'a sign-in link'); includes(m.TextBody, 'after 10 minutes', 'the email says how long it lasts');
  ok(m.HtmlBody && m.HtmlBody.includes('Sign in'), 'an HTML version with the button');
  eq(m.TrackOpens, false, 'no open tracking'); eq(m.TrackLinks, 'None', 'no click tracking');
  const code = codeIn(m);
  const fin = await c.okay('POST', 'login_finish', { req: start.req, code });
  eq(fin.next, 'account', 'where to go next');
  ok(c.cookie.length >= 40, 'a session cookie was set');
  const me = await c.okay('GET', 'me');
  eq(me.user.email, email, 'me knows the address');
  eq(fin.user.email, email, 'and so does the sign-in answer');
  eq(fin.new, true, 'a new account');
  // The same code again is spent.
  await c.fails('POST', 'login_finish', { req: start.req, code }, 'expired', 410);
});

test('a wrong code is refused and the sign-in link works on its own', async ({ api, mail }) => {
  const c = api();
  const email = someone('auth');
  const start = await c.okay('POST', 'login_start', { email });
  const m = await mail.waitFor(email, /sign-in/i);
  const code = codeIn(m);
  const wrong = code === '000000' ? '111111' : '000000';
  const r = await c.post('login_finish', { req: start.req, code: wrong });
  eq(r.body.ok, false, 'a wrong code fails');
  // The link in the same email still signs in (a fresh client, as on another device).
  const d = api();
  await d.okay('POST', 'login_finish', { token: linkIn(m) });
  ok(d.cookie, 'the link set a session cookie');
  const me = await d.okay('GET', 'me');
  eq(me.user.email, email);
});

test('only the newest sign-in email works, and a bad address or a flood is refused', async ({ api, mail }) => {
  const c = api();
  const email = someone('auth');
  await c.fails('POST', 'login_start', { email: 'not an address' }, 'email');
  const first = await c.okay('POST', 'login_start', { email });
  const m1 = await mail.waitFor(email, /sign-in/i);
  const second = await c.okay('POST', 'login_start', { email });
  await c.fails('POST', 'login_finish', { req: first.req, code: codeIn(m1) }, 'expired', 410);
  const m2 = (await mail.to(email)).at(-1);
  await c.okay('POST', 'login_finish', { req: second.req, code: codeIn(m2) });
  // Three emails in fifteen minutes is the most one address gets.
  const d = api();
  const other = someone('flood');
  await d.okay('POST', 'login_start', { email: other });
  await d.okay('POST', 'login_start', { email: other });
  await d.okay('POST', 'login_start', { email: other });
  await d.fails('POST', 'login_start', { email: other }, 'slow', 429);
});

test('sign out here, sign out everywhere, and the cookie stops working', async ({ api }) => {
  const email = someone('auth');
  const a = api().as(email);
  const b = api().as(email);
  await a.okay('POST', 'logout');
  eq(a.cookie, '', 'the cookie was cleared');
  const me = await b.okay('GET', 'me');
  eq(me.user.email, email, 'the other device is still signed in');
  const sid = b.cookie;
  await b.okay('POST', 'logout_all');
  const c = api(); c.cookie = sid;
  const r = await c.get('me');
  eq(r.body.user, null, 'the old session is gone');
});

test('a sign-in ends after 14 days without a visit, and 90 days after it began however much it is used', async ({ api, site }) => {
  const email = someone('ages');
  const left = id => (site.sql(`SELECT expires FROM sessions WHERE id = ${id}`)[0].expires - Date.now() / 1000) / 86400;
  // Last used 13 days ago: still signed in, and the visit pushes the end out to 14 days from now.
  const a = api().as(email);
  eq(site.ageSession(a.cookie, 13, 13).changed, 1);
  eq((await a.okay('GET', 'me')).user.email, email, 'still signed in after 13 quiet days');
  const id = site.sql(`SELECT id FROM sessions WHERE user_id = ${a.id} ORDER BY id DESC LIMIT 1`)[0].id;
  ok(left(id) > 13.9 && left(id) <= 14, '14 days from this visit: ' + left(id));
  // 15 days without a visit: signed out.
  site.ageSession(a.cookie, 15, 15);
  eq((await a.get('me')).body.user, null, 'signed out after 15 quiet days');
  // Used every day, but begun 89 and a half days ago: a visit pushes the end no further than day 90.
  const b = api().as(email);
  const bid = site.sql(`SELECT id FROM sessions WHERE user_id = ${b.id} ORDER BY id DESC LIMIT 1`)[0].id;
  site.ageSession(b.cookie, 1.5, 89.5);
  eq((await b.okay('GET', 'me')).user.email, email);
  ok(left(bid) > 0.4 && left(bid) < 0.6, 'ends at day 90, not 14 days on: ' + left(bid));
  // Day 90 and a half: signed out, however recently it was used.
  site.ageSession(b.cookie, 0.5, 90.5);
  eq((await b.get('me')).body.user, null, 'signed out after 90 days');
  // A fresh sign-in (the way a person does it) starts its own 14 days.
  const c = api();
  await c.signIn(email);
  const cid = site.sql(`SELECT id, created FROM sessions WHERE user_id = ${b.id} ORDER BY id DESC LIMIT 1`)[0];
  ok(left(cid.id) > 13.9 && left(cid.id) <= 14, 'a new sign-in: 14 days');
  ok(Math.abs(cid.created - Date.now() / 1000) < 60, 'and it counts its 90 days from now');
});

test('the name on the account, and deleting the account', async ({ api }) => {
  const email = someone('auth');
  const c = api().as(email);
  let me = await c.okay('GET', 'me');
  eq(me.user.ready, false, 'no name yet, so not ready to share');
  await c.okay('POST', 'set_name', { first: 'Pat', last: 'Lee' });
  me = await c.okay('GET', 'me');
  eq(me.user.first, 'Pat'); eq(me.user.last, 'Lee'); eq(me.user.ready, true, 'a named account is ready to share');
  await c.okay('POST', 'delete_account');
  const r = await c.get('me');
  eq(r.body.user, null, 'nobody is signed in after deleting');
  // The address can sign up again, as a new account with no name.
  const d = api(); const again = await d.signIn(email);
  eq(again.new, true, 'a new account, not the old one back');
  me = await d.okay('GET', 'me');
  eq(me.user.first, '', 'the old name did not come back');
});

test('signing in with Google: a checked credential signs in with the name Google gives; others are refused', async ({ api, google }) => {
  const cfg = JSON.parse((await import('node:fs')).readFileSync(new URL('../../site.config.json', import.meta.url), 'utf8'));
  const client = cfg.groups.googleClientId;
  const jwt = (tag) => `h.${tag}${Date.now().toString(36)}.s`;
  const good = jwt('good'), gmail = `g${Date.now().toString(36)}@gmail.com`;
  google.allow(good, { aud: client, iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 600, email: gmail, email_verified: 'true', given_name: 'Dana', family_name: 'Reyes' });
  const c = api();
  const r = await c.okay('POST', 'login_google', { credential: good, next: 'account' });
  eq(r.user.email, gmail); eq(r.user.first, 'Dana'); eq(r.user.last, 'Reyes'); eq(r.user.ready, true, 'Google already knew the name');
  // Wrong audience: not for this site.
  const other = jwt('aud');
  google.allow(other, { aud: 'someone-else', iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 600, email: 'x@gmail.com', email_verified: 'true' });
  await api().fails('POST', 'login_google', { credential: other }, 'google', 401);
  // An address Google doesn't run: the email code is the way in.
  const outside = jwt('out');
  google.allow(outside, { aud: client, iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 600, email: 'someone@example.test', email_verified: 'true' });
  await api().fails('POST', 'login_google', { credential: outside }, 'google_other', 403);
  // A credential Google has never heard of.
  await api().fails('POST', 'login_google', { credential: jwt('unknown') }, 'google', 401);
});
