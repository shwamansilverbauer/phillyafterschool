// The account page in a browser: its tabs, sharing a kept week from the Plans tab, and the co-parent box.
import { test, ok, eq, includes, excludes, matches, someone } from '../lib/harness.mjs';
import { pickupPair } from '../lib/data.mjs';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const empty = () => Object.fromEntries(DAYS.map(d => [d, []]));
const flat = s => s.replace(/\s+/g, ' ').trim();

test('the account tabs: each hash opens its tab, and the tab bar says which', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('tabs'), 'Pat', 'Lee');
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/account/');
  await page.waitForSelector('#account .acct-tabs');
  eq(await page.locator('.acct-tabs [aria-current="page"]').innerText(), 'Details');
  ok(await page.locator('#you').isVisible(), 'the details panel shows');
  for (const [hash, label, probe] of [['school', 'School & kids', '#school'], ['emails', 'Emails & following', '#emails'], ['plans', 'Plans & sharing', '#plans']]) {
    await page.click(`.acct-tabs [data-tab-go="${hash}"]`);
    await page.waitForTimeout(300);
    eq(flat(await page.locator('.acct-tabs [aria-current="page"]').innerText()), label, `tab for #${hash}`);
    ok(!(await page.locator('#you').isVisible()), `details panel hidden on #${hash}`);
    ok(await page.locator(probe).first().isVisible(), `#${hash} shows its content`);
  }
  const prof = await t.open('/profile/');
  await prof.waitForSelector('.prof-card');
  includes(flat(await prof.locator('.prof-card').innerText()), 'Pat Lee', 'the profile card names the person');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('share a kept week from the Plans tab: the panel, the email, and who has it', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('share'), 'Pat', 'Lee');
  const { entry } = pickupPair();
  await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/account/#plans');
  await page.waitForSelector('text=Sam’s week');
  const row = page.locator('li', { hasText: 'Sam’s week' }).first();
  includes(flat(await row.innerText()), '1 program');
  await row.locator('button', { hasText: 'Share' }).first().click();
  const email = row.locator('input[type=email]');
  await email.waitFor();
  const aunt = someone('aunt');
  await email.fill(aunt);
  await row.locator('button[type=submit]', { hasText: 'Share' }).click();
  await page.waitForSelector(`text=${aunt}`);
  const after = flat(await row.innerText());
  includes(after, aunt, 'the row lists who has the week');
  const m = await ctx.mail.waitFor(aunt, /Sam/);
  includes(m.TextBody, 'Pat Lee');
  // The server agrees.
  const prof = await pat.okay('GET', 'profile');
  eq(prof.weeks[0].shares.length, 1); eq(prof.weeks[0].shares[0].invites[0].email, aunt);
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('co-parents on the Plans tab: invite, the invitation with its merge warning, accept, linked, stop', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('cop'), 'Pat', 'Lee');
  const dana = ctx.api().as(someone('copd'), 'Dana', 'Reyes');
  const { entry } = pickupPair();
  await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } });
  await dana.okay('POST', 'week_save', { week: { name: 'Rae', now: { ...empty(), tue: [entry] }, next: empty() } });
  const open = async (sid) => { const t = await b.context(ctx.site, { sid }); await t.open('/account/#plans'); await t.page.waitForSelector('.g-coparent h3'); await t.page.waitForTimeout(300); return t; };
  // Pat invites Dana.
  const tp = await open(pat.cookie);
  includes(flat(await tp.page.locator('.g-coparent').innerText()), 'Share everything with a co-parent');
  await tp.page.fill('#cop-email', dana.email);
  await tp.page.locator('.g-coparent button[type=submit]').click();
  await tp.page.waitForSelector('.g-coparent button:has-text("Send again")');
  let text = flat(await tp.page.locator('.g-coparent').innerText());
  includes(text, dana.email, 'the box names who was invited'); includes(text, 'Cancel');
  // Dana sees the invitation, with what accepting does to her own week.
  const td = await open(dana.cookie);
  text = flat(await td.page.locator('.g-coparent').innerText());
  includes(text, 'Pat Lee'); matches(text, /Accept/); matches(text, /Decline/);
  matches(text, /1 week/i, 'the merge warning counts her week');
  await td.page.locator('.g-coparent button', { hasText: 'Accept' }).click();
  await td.page.waitForSelector('.g-coparent button:has-text("Stop sharing everything")');
  text = flat(await td.page.locator('.g-coparent').innerText());
  includes(text, 'Pat Lee', 'linked with Pat');
  const weeks = (await td.page.locator('.g-list > li > b').allInnerTexts()).map(flat);
  ok(weeks.some(w => /Sam/.test(w)) && weeks.some(w => /Rae/.test(w)), 'Dana sees both weeks: ' + weeks.join(', '));
  // Pat's page, reloaded, agrees.
  await tp.page.reload({ waitUntil: 'networkidle' });
  await tp.page.waitForSelector('.g-coparent button:has-text("Stop sharing everything")');
  includes(flat(await tp.page.locator('.g-coparent').innerText()), 'Dana Reyes');
  eq((await tp.page.locator('.g-list > li > b').allInnerTexts()).length, 2, 'Pat sees both weeks');
  // Stopping takes two taps: the first arms the button and says what the second does.
  const stop = tp.page.locator('.g-coparent button', { hasText: 'Stop sharing everything' });
  await stop.click();
  await tp.page.waitForTimeout(200);
  const armed = tp.page.locator('.g-coparent button[data-armed]');
  eq(await armed.count(), 1, 'the button is armed');
  includes(flat(await armed.innerText()), 'Tap again', 'the second tap is asked for, with what it does');
  await armed.click();
  await tp.page.waitForSelector('#cop-email');
  eq((await pat.okay('GET', 'me')).user.coparent, null, 'ended on the server');
  eq((await dana.okay('GET', 'profile')).weeks.length, 0, 'Dana’s week stayed with the home account');
  eq(tp.errors.length + td.errors.length, 0, tp.errors.concat(td.errors).join(' | '));
  await tp.close(); await td.close();
});
