// The wording editor at /edit/: behind a username and password, with only a hash of the password anywhere.
import { test, ok, eq, includes, excludes, Failure } from '../lib/harness.mjs';

const form = o => new URLSearchParams(o).toString();

test('the edit page asks for a sign-in, refuses a wrong password, and lets the right one in', async ({ site }) => {
  if (!site.edit) throw Object.assign(new Failure('editLogin is not set in site.config.json'), { skip: true });
  const gate = await fetch(`${site.base}/edit/`);
  eq(gate.status, 200);
  const h = await gate.text();
  includes(h, '<title>Sign in |', 'the sign-in form shows'); includes(h, 'name="pass"'); includes(h, 'noindex', 'kept out of search engines');
  excludes(h, site.edit.password);
  const wrong = await fetch(`${site.base}/edit/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ user: site.edit.user, pass: 'not-it' }), redirect: 'manual' });
  eq(wrong.status, 401, 'a wrong password is refused');
  includes(await wrong.text(), 'isn’t right');
  const right = await fetch(`${site.base}/edit/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ user: site.edit.user.toUpperCase(), pass: site.edit.password }), redirect: 'manual' });
  eq(right.status, 303, 'signed in: sent back to the editor');
  const cookie = (right.headers.getSetCookie ? right.headers.getSetCookie() : []).find(c => c.startsWith('pas_edit='));
  ok(cookie, 'a signed cookie'); ok(/httponly/i.test(cookie), 'HttpOnly'); ok(/path=\/edit\//i.test(cookie), 'scoped to /edit/');
  const token = cookie.split(';')[0];
  const editor = await fetch(`${site.base}/edit/`, { headers: { Cookie: token } });
  const eh = await editor.text();
  includes(eh, '<title>Edit the copy |', 'the editor shows, not the gate'); excludes(eh, 'name="pass"');
  // The queue page and the sender want the same cookie.
  const q = await fetch(`${site.base}/edit/queue/`, { redirect: 'manual' });
  eq(q.status, 303, 'the queue sends a stranger back to sign in');
  const qin = await fetch(`${site.base}/edit/queue/`, { headers: { Cookie: token }, redirect: 'manual' });
  eq(qin.status, 200, 'the queue opens when signed in');
  const send = await fetch(`${site.base}/edit/send.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  ok(send.status >= 400, `nothing can be sent without signing in (got ${send.status})`);
});

test('a suggestion needs a name and an email: the forms ask for them, and the sender refuses one without', async ({ site, open }) => {
  const send = o => fetch(`${site.base}/suggest/send.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(o), redirect: 'manual' });
  const missing = { kind: 'A program that’s missing', school: 'Nebinger', program: 'Test Program', website: 'https://example.org/', details: 'Picks up at 3.', role: 'I’m a parent or caregiver' };
  const noName = await send({ ...missing, email: 'pat@example.org' });
  eq(noName.status, 400, 'no name: refused'); includes(await noName.text(), 'Please add your name');
  const noEmail = await send({ ...missing, name: 'Pat' });
  eq(noEmail.status, 400, 'no email: refused'); includes(await noEmail.text(), 'Please add your email');
  const badEmail = await send({ ...missing, name: 'Pat', email: 'not an email' });
  eq(badEmail.status, 400, 'an email that isn’t one: refused');
  const fine = await send({ ...missing, name: 'Pat', email: 'pat@example.org' });
  eq(fine.status, 303, 'with both, it goes through');
  // The three forms that send here mark both as required.
  const page = await (await fetch(`${site.base}/suggest/`)).text();
  ok(/id="f-name"[^>]*required/.test(page) && /id="f-email"[^>]*required/.test(page), 'the suggestion form');
  const idea = await (await fetch(`${site.base}/ideas/`)).text();
  ok(/id="i-name"[^>]*required/.test(idea) && /id="i-email"[^>]*required/.test(idea), 'the feature-idea form');
  const school = await (await fetch(`${site.base}/nebinger/`)).text();
  ok(/id="wk-name-nebinger"[^>]*required/.test(school) && /id="wk-email-nebinger"[^>]*required/.test(school), 'a school’s missing-date form');
});
