// The review form in a browser (scaling plan, Phase 6): someone not signed in writes a review, is asked for the 6-digit
// code the site emails, types it in, and lands on the thanks page with the review stored for the queue. The sign-in
// requests themselves are answered here, by the browser's own routing (the real ones are tested in 10-api-auth.mjs and
// 20-web-pages.mjs, and the server allows this machine only ten sign-in emails a quarter hour): the answer to the code
// carries a real session made in the database, so the review is stored by the real server.
import { test, ok, eq, includes, matches, someone } from '../lib/harness.mjs';
import { programs, schools } from '../lib/data.mjs';

test('writing a review: not signed in, the page asks for the emailed code, then sends the review, which waits for the queue; nothing about it goes anywhere else', async (ctx) => {
  const b = await ctx.browser();
  const t = await b.context(ctx.site);
  const p = programs().find(x => x.website && !x.clubs), s = schools()[0];
  const email = someone('webrv'), words = `Pickup is calm and the counselors know every kid by name ${Date.now().toString(36)}.`;
  const account = ctx.site.seed(email, '', '');   // what the right code would have made
  const asked = [];
  await t.page.route(u => /action=login_(start|finish)/.test(u.href), route => {
    const r = route.request(), body = JSON.parse(r.postData() || '{}');
    asked.push({ url: r.url(), body });
    if (/login_start/.test(r.url())) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, req: 'req-from-test', minutes: 10 }) });
    if (String(body.code).replace(/\D/g, '') !== '123456') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'code', message: 'That code isn’t right. Check the newest email and try again.' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': `pas_s=${account.sid}; Path=/; HttpOnly; SameSite=Lax` }, body: JSON.stringify({ ok: true, next: 'review', new: true, user: { email } }) });
  });
  const page = await t.open(`/review/?program=${p.id}&school=${s.id}`);
  await page.check('input[name="stars"][value="5"]', { force: true });
  await page.fill('#r-comment', words);
  await page.fill('#r-name', 'Rae');
  await page.fill('#r-email', email);
  await page.check('input[name="firsthand"]', { force: true });
  await page.click('#rv-send');
  await page.waitForSelector('#rv-code:not([hidden])');
  eq(asked[0].body.email, email); eq(asked[0].body.next, 'review', 'a link in the email comes back to the review');
  includes(await t.text('#rv-code-to'), email);
  eq(await t.text('#rv-send'), 'Confirm and send');
  ok(await page.evaluate(() => !!localStorage.getItem('pas-rv-draft')), 'the review is kept on the device while the code is on its way');
  await page.fill('#r-code', '000000');
  await page.click('#rv-send');
  await page.waitForSelector('#rv-status.bad');
  await page.fill('#r-code', '123 456');
  await page.click('#rv-send');
  await page.waitForURL(/\/review\/thanks\//, { timeout: 10000 });
  includes(await t.text('body'), 'once it’s been checked');
  const r = ctx.site.sql(`SELECT * FROM reviews WHERE user_id = ${account.id}`)[0];
  ok(r, 'the review is stored'); eq(r.listing, 'p:' + p.id); eq(r.school, s.id); eq(r.stars, 5); eq(r.comment, words); eq(r.name, 'Rae');
  matches(r.status, /^(new|held)$/);
  ok(await page.evaluate(() => !localStorage.getItem('pas-rv-draft')), 'and the copy on the device is gone');
  ok(!t.outside.some(x => x.body && x.body.includes('counselors')), 'the words went to no other site');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});
