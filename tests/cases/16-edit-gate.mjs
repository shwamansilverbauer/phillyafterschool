// The wording editor at /edit/ and the owner's pages: open only to a site admin's or an editor's account.
import { test, ok, eq, includes, excludes } from '../lib/harness.mjs';

const form = o => new URLSearchParams(o).toString();

test('the edit pages open only for a site admin’s or an editor’s account: no password, and a stranger can send nothing', async ({ site }) => {
  const t = Date.now().toString(36);
  const send = (cookie, body) => fetch(`${site.base}/edit/send.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  const page = async (rel, cookie) => fetch(`${site.base}/${rel}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: 'manual' });

  // A stranger: a page that points to the account sign-in, and no password form anywhere.
  const gate = await page('edit/');
  eq(gate.status, 200);
  const h = await gate.text();
  includes(h, '<title>Sign in |', 'the sign-in page shows'); includes(h, 'href="../account/"', 'it points to the account sign-in');
  includes(h, 'noindex', 'kept out of search engines'); excludes(h, 'name="pass"', 'no password form');
  // The old username-and-password sign-in is gone: posting one, or bringing its old cookie, opens nothing.
  const post = await fetch(`${site.base}/edit/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ user: 'tester', pass: 'anything' }), redirect: 'manual' });
  ok(!(post.headers.getSetCookie ? post.headers.getSetCookie() : []).some(c => c.startsWith('pas_edit=')), 'no edit cookie is handed out');
  includes(await post.text(), '<title>Sign in |', 'still the sign-in page');
  includes(await (await page('edit/', `pas_edit=${Math.floor(Date.now() / 1000) + 86400}.${'a'.repeat(64)}`)).text(), '<title>Sign in |', 'an old password cookie opens nothing');
  eq((await page('edit/queue/')).status, 303, 'the queue sends a stranger back to sign in');
  ok((await send('', {})).status >= 400, 'a stranger can send nothing');

  // A parent's account is an account, but not an admin's or an editor's.
  const parent = 'pas_s=' + site.seed(`edit-parent-${t}@example.org`, 'Pat').sid;
  includes(await (await page('edit/', parent)).text(), '<title>Sign in |', 'a parent’s account is not let in');
  eq((await page('edit/queue/', parent)).status, 303, 'nor into the queue');
  ok((await send(parent, {})).status >= 400, 'nor can it send');

  // A site admin's account opens every owner page, and can let someone in as an editor.
  const admin = site.adminCookie();
  const eh = await (await page('edit/', admin)).text();
  includes(eh, '<title>Edit the copy |', 'the editor shows for an admin'); includes(eh, 'id="edit-admin"', 'and says which account let them in');
  for (const rel of ['edit/queue/', 'edit/stats/', 'edit/claims/']) eq((await page(rel, admin)).status, 200, `${rel} opens for an admin`);
  const editorEmail = `edit-editor-${t}@example.org`;
  const added = await send(admin, { action: 'editor_add', email: editorEmail, name: 'Robin' });
  eq(added.status, 200, 'an admin adds an editor');

  // The editor's account then opens the edit pages, but can't change who edits.
  const editor = 'pas_s=' + site.seed(editorEmail, 'Robin').sid;
  const edh = await (await page('edit/', editor)).text();
  includes(edh, '<title>Edit the copy |', 'the editor shows for an editor'); includes(edh, 'id="edit-editor"');
  eq((await page('edit/queue/', editor)).status, 200, 'the queue opens for an editor');
  eq((await send(editor, { action: 'editor_add', email: `x-${t}@example.org`, name: 'X' })).status, 403, 'only an admin changes who edits');
  // Taken off the list, the editor is out again.
  eq((await send(admin, { action: 'editor_drop', email: editorEmail })).status, 200);
  includes(await (await page('edit/', editor)).text(), '<title>Sign in |', 'a dropped editor is out');

  // Signing out from the edit page goes where every account signs out.
  const out = await page('edit/?out=1', admin);
  eq(out.status, 303); ok(/account\/#sign-out$/.test(out.headers.get('location') || ''), `sent to sign out (got ${out.headers.get('location')})`);
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
