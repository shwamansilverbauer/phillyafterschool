// Claims by code on the managers page, in a browser (scaling plan, Phase 6). The setting starts off, so this test turns
// it on for the page (the mark the build would add) and for its requests (the test-only switch the API reads), then
// claims a listing with the code sent to the address its website publishes. Against the stand-in mail.
import { test, ok, eq, includes, someone, codeIn } from '../lib/harness.mjs';
import { programs } from '../lib/data.mjs';

test('claiming with a code on the managers page: an address that doesn’t match is offered the code, typing it makes the listing yours', async (ctx) => {
  const b = await ctx.browser();
  const held = new Set(ctx.site.sql(`SELECT listing FROM claims WHERE status != 'declined'`).map(r => r.listing));
  const p = programs().find(x => x.email && x.website && !x.clubs && !held.has('p:' + x.id));
  ok(p, 'a program whose website publishes an address, that nobody holds');
  const account = ctx.site.seed(someone('webcc'), 'Pat', 'Lee', 'managers');
  const t = await b.context(ctx.site, { sid: account.sid });
  await t.ctx.addInitScript(() => { new MutationObserver((_, o) => { const c = document.getElementById('claims'); if (c) { c.setAttribute('data-claim-code', '1'); o.disconnect(); } }).observe(document, { childList: true, subtree: true }); });
  await t.page.route(u => /action=(claim_add|claim_code_start|claim_code_finish)/.test(u.href), route => {
    const r = route.request();
    route.continue({ postData: JSON.stringify({ ...JSON.parse(r.postData() || '{}'), test_claim_code: true }) });
  });
  const page = await t.open(`/managers/?l=p:${p.id}`);
  await page.fill('#claim-find', p.name.slice(0, 12));
  const row = page.locator('.claim-results li', { hasText: p.name }).first();
  await row.locator('button:has-text("Claim this listing")').click();
  const send = row.locator('button:has-text("Send a code to")');
  await send.waitFor();
  includes(await send.innerText(), '…@');
  ok(await row.locator('button:has-text("Ask a person to check")').count(), 'or a person checks it');
  ctx.mail.clear();
  await send.click();
  const m = await ctx.mail.waitFor(p.email, /asked to manage/);
  await row.locator('input[autocomplete="one-time-code"]').fill(codeIn(m));
  await row.locator('button:has-text("Claim it")').click();
  await page.waitForSelector('text=It’s yours');
  const c = ctx.site.sql(`SELECT status, via FROM claims WHERE user_id = ${account.id} AND listing = 'p:${p.id}'`)[0];
  eq(c.status, 'ok'); eq(c.via, 'code');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});
