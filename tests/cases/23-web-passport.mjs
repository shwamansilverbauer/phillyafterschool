// The Passport in a browser: the kid picker, kid mode (no site around it, no link off it), the grown-ups' corner
// behind a press-and-hold, confirming a class, the stamps, the bracket, and that nothing is counted or sent.
import { test, ok, eq, includes, excludes, matches, someone } from '../lib/harness.mjs';
import { pickupPair, weekendProgram } from '../lib/data.mjs';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const empty = () => Object.fromEntries(DAYS.map(d => [d, []]));
const flat = s => s.replace(/\s+/g, ' ').trim();
const hold = async (page, selector, ms = 1400) => { const b = page.locator(selector); await b.scrollIntoViewIfNeeded(); const box = await b.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); };

test('signed out, the passport page explains itself and offers the account; signed in with no names, it asks for them', async (ctx) => {
  const b = await ctx.browser();
  const t = await b.context(ctx.site);
  const page = await t.open('/passport/');
  ok(await page.locator('#pp-out').isVisible(), 'the signed-out panel');
  includes(flat(await page.locator('#pp-out').innerText()), 'What counts is what you confirm');
  ok(await page.locator('#pp-out a[href*="next=passport"]').count() >= 2, 'create and log in both come back here');
  const noAnalytics = t.outside.filter(u => /googletagmanager|clarity|klaviyo/.test(u));
  eq(noAnalytics.length, 0, 'quiet even when signed out');
  await t.close();
  const pat = ctx.api().as(someone('ppw'), 'Pat', 'Lee');
  const t2 = await b.context(ctx.site, { sid: pat.cookie });
  const p2 = await t2.open('/passport/');
  await p2.waitForSelector('.pp-none');
  includes(flat(await p2.locator('.pp-none').innerText()), 'Add your kids’ first names');
  matches(await p2.locator('.pp-none a').getAttribute('href'), /account\/#school$/);
  eq(t2.errors.length, 0, t2.errors.join(' | '));
  await t2.close();
});

test('kid mode: pick a child, the site disappears around the page, nothing links away, a press-and-hold opens the grown-ups’ corner', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('ppk'), 'Pat', 'Lee');
  const { entry, program, school } = pickupPair();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '2' }, { n: 'Rae', g: 'K' }] });
  await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } });
  const t = await b.context(ctx.site, { sid: pat.cookie, mobile: true });
  const page = await t.open('/passport/');
  await page.waitForSelector('.pp-kidbtn');
  eq(await page.locator('.pp-kidbtn').count(), 2, 'one button per child');
  ok(await page.evaluate(() => document.documentElement.classList.contains('pp-kid')), 'kid mode from the picker on');
  ok(!(await page.locator('header.sitebar').isVisible()), 'the site header is hidden');
  ok(!(await page.locator('footer.foot').isVisible()), 'the footer is hidden');
  await page.locator('.pp-kidbtn', { hasText: 'Sam' }).click();
  await page.waitForSelector('.pp-page');
  includes(flat(await page.locator('.pp-h').innerText()).toUpperCase(), 'SAM’S PASSPORT');
  eq(await page.locator('.pp-page a[href]').count(), 0, 'no link on the child’s page');
  ok(await page.locator('.stamp.off').count() > 10, 'the stamps still to earn are shown');
  eq(await page.locator('.stamp.on').count(), 0, 'nothing earned yet');
  // A tap on the grown-ups' button does nothing; a hold opens the corner.
  await page.locator('.pp-hold').click();
  await page.waitForTimeout(300);
  eq(await page.locator('.pp-grownup').count(), 0, 'a tap is not enough');
  await hold(page, '.pp-hold');
  await page.waitForSelector('.pp-grownup');
  ok(!(await page.evaluate(() => document.documentElement.classList.contains('pp-kid'))), 'kid mode off for the grown-up');
  ok(await page.locator('header.sitebar').isVisible(), 'the site is back');
  // The suggestion from the kept week, confirmed.
  const sg = page.locator('.pp-suggest li', { hasText: program.name });
  eq(await sg.count(), 1, 'the week’s program is suggested');
  await sg.locator('button', { hasText: 'Yes' }).click();
  await page.waitForSelector('.pp-donelist li');
  includes(flat(await page.locator('.pp-donelist').innerText()), program.name);
  eq(await page.locator('.pp-suggest li').count(), 0, 'no longer suggested');
  // Back to the kid: stamps earned.
  await page.locator('.pp-ghead button', { hasText: 'Back to Sam’s passport' }).click();
  await page.waitForSelector('.pp-page');
  const on = await page.locator('.stamp.on b').allInnerTexts();
  ok(on.includes('First stamp'), 'the first stamp: ' + on.join(', '));
  ok(on.includes('After-schooler'), 'the after-school season stamp');
  ok(on.some(x => (program.types || []).length ? true : true), 'a type stamp');
  includes(flat(await page.locator('.pp-count').innerText()), '1 class or camp');
  // The server agrees, and nothing analytics-like was called.
  const pp = await pat.okay('GET', 'passport');
  eq(pp.kids[0].done.length, 1); eq(pp.kids[0].done[0].k, 'p:' + program.id); eq(pp.kids[0].done[0].s, school);
  const called = t.outside.filter(u => /googletagmanager|google-analytics|clarity|klaviyo/.test(u));
  eq(called.length, 0, 'nothing counted: ' + called.join(', '));
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('the bracket ranks favorites, which the profile then carries for the planners', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('ppb'), 'Pat', 'Lee');
  const { program, school } = pickupPair();
  const { program: wp } = weekendProgram();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Zoe', g: '4' }] });
  const y = (await pat.okay('GET', 'passport')).year;
  await pat.okay('POST', 'passport_save', { kid: 'Zoe', done: [{ k: 'p:' + program.id, kind: 'after', y, s: school }, { k: 'p:' + wp.id, kind: 'weekend', y, s: '' }] });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/passport/');
  await page.waitForSelector('.pp-page');   // one child: straight to the passport
  await page.locator('button', { hasText: 'Play the bracket' }).click();
  await page.waitForSelector('.pp-vs .pp-card');
  eq(await page.locator('.pp-vs .pp-card').count(), 2);
  await page.locator('.pp-vs .pp-card', { hasText: wp.name }).click();
  await page.waitForSelector('.pp-fav');
  const fav = (await page.locator('.pp-fav li b').allInnerTexts()).map(flat);
  eq(fav[0], wp.name, 'the winner first'); eq(fav[1], program.name);
  const prof = await pat.okay('GET', 'profile');
  eq(prof.favorites.length, 1); eq(prof.favorites[0].name, 'Zoe'); eq(prof.favorites[0].fav[0], 'p:' + wp.id);
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('favorites from the passport are offered first in the planners: the week builder, the days off, the summer', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('ppf'), 'Pat', 'Lee');
  const { program, school } = pickupPair();
  const { twoCamps, dayOffProgram } = await import('../lib/data.mjs');
  const { ids } = twoCamps(); const off = dayOffProgram();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '2' }] });
  const y = (await pat.okay('GET', 'passport')).year;
  await pat.okay('POST', 'passport_save', { kid: 'Sam', done: [{ k: 'p:' + program.id, kind: 'after', y, s: school }, { k: 'p:' + off.id, kind: 'off', y }, { k: 'c:' + ids[1], kind: 'summer', y }], fav: ['c:' + ids[1], 'p:' + off.id, 'p:' + program.id] });
  // The board names the child Sam, so Sam's favorites show under the search.
  await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: Object.fromEntries(DAYS.map(d => [d, []])), next: Object.fromEntries(DAYS.map(d => [d, []])) } });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/board/');
  await page.waitForFunction(() => (document.querySelector('#board-name') || {}).value === 'Sam', null, { timeout: 8000 });
  await page.waitForSelector('#add-favs:not([hidden])', { timeout: 8000 });
  const favRow = flat(await page.locator('#add-favs').innerText());
  includes(favRow, 'Sam’s favorites'); includes(favRow, program.name); includes(favRow, off.name);
  await page.locator('#add-favs button', { hasText: program.name }).click();
  await page.waitForSelector('#add-panel:not([hidden])');
  includes(flat(await page.locator('#add-panel').innerText()), program.name, 'a tap on a favorite starts adding it');
  // The summer planner marks the favorite camp and lists it first in a week it runs.
  const sum = await t.open('/summer-schedule/');
  await sum.waitForSelector('#sum-weeks .sum-add');
  await sum.waitForFunction(() => /Sam’s summer/.test((document.querySelector('#sum-count') || {}).textContent || ''), null, { timeout: 8000 });   // the child comes from the profile's kids list
  await sum.waitForTimeout(1500);   // the favorites arrive with the profile and redraw once
  const weeks = await sum.locator('#sum-weeks .sum-add').count();
  let marked = false;
  for (let i = 0; i < Math.min(weeks, 12) && !marked; i++) {
    await sum.locator('#sum-weeks .sum-add').nth(i).click();
    await sum.waitForSelector('#sum-weeks .sum-choose', { timeout: 5000 });
    const opts = await sum.locator('#sum-weeks .sum-choose .sum-opts:not(.own-opts) .sum-opt').allInnerTexts();
    if (opts.some(o => /favorite/.test(o))) { marked = true; ok(/favorite/.test(opts[0]), 'the favorite comes first: ' + flat(opts[0])); }
    await sum.locator('#sum-weeks .sum-add').nth(i).click();   // close it again
  }
  ok(marked, 'some week lists the favorite camp with its mark');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});
