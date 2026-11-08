// Kid's Corner in a browser: the picker, a child picking their lightbulb, kid mode (no site around it, no link off it),
// the grown-ups' corner behind a press-and-hold, a confirmed class turning into pins and a level (celebrated once),
// the map of Philadelphia drawn from this site alone, the boxing match ranking favorites with Eddie Bulboa
// refereeing, the mute button, the account page's Kid's Corner tab, and that nothing is counted or sent anywhere.
import { test, ok, eq, includes, matches, someone } from '../lib/harness.mjs';
import { pickupPair, weekendProgram } from '../lib/data.mjs';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const empty = () => Object.fromEntries(DAYS.map(d => [d, []]));
const flat = s => s.replace(/\s+/g, ' ').trim();
const hold = async (page, selector, ms = 1400) => { const b = page.locator(selector); await b.scrollIntoViewIfNeeded(); const box = await b.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); };
const kidMode = page => page.evaluate(() => document.documentElement.classList.contains('kc-kid'));
// Tap through whatever celebration is showing (the present, new pins, a level), and say what was shown.
const celebrate = async (page) => {
  const seen = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(350);
    const over = page.locator('.kc-over:not(.out)');
    if (!(await over.count())) break;
    seen.push(flat(await over.first().innerText()));
    const go = over.first().locator('.kc-giftbtn, .kc-big');
    await go.first().click();
  }
  return seen;
};
const counted = t => t.outside.filter(u => /googletagmanager|google-analytics|clarity|klaviyo/.test(u));

test('signed out, Kid’s Corner explains itself and offers the account; signed in with no names, it asks for them', async (ctx) => {
  const b = await ctx.browser();
  const t = await b.context(ctx.site);
  const page = await t.open('/kids-corner/');
  ok(await page.locator('#kc-out').isVisible(), 'the signed-out panel');
  includes(flat(await page.locator('#kc-out').innerText()), 'What counts is what you confirm');
  ok(await page.locator('#kc-out a[href*="next=kids"]').count() >= 2, 'create and log in both come back here');
  eq(counted(t).length, 0, 'quiet even when signed out');
  await t.close();
  const pat = ctx.api().as(someone('kcw'), 'Pat', 'Lee');
  const t2 = await b.context(ctx.site, { sid: pat.cookie });
  const p2 = await t2.open('/kids-corner/');
  await p2.waitForSelector('.kc-none');
  includes(flat(await p2.locator('.kc-none').innerText()), 'Add your kids’ first names');
  matches(await p2.locator('.kc-none a').getAttribute('href'), /account\/#school$/);
  // The site's menu has the way in.
  eq(await p2.locator('header.sitebar a.nav-kc').count(), 1);
  eq(t2.errors.length, 0, t2.errors.join(' | '));
  await t2.close();
});

test('a child picks their lightbulb, the site disappears around the page, a hold opens the grown-ups’ corner, and a confirmed class is celebrated once', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('kck'), 'Pat', 'Lee');
  const { entry, program, school } = pickupPair();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '2' }, { n: 'Rae', g: 'K' }] });
  await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } });
  const t = await b.context(ctx.site, { sid: pat.cookie, mobile: true });
  const page = await t.open('/kids-corner/');
  await page.waitForSelector('.kc-kidbtn');
  eq(await page.locator('.kc-kidbtn').count(), 2, 'one button per child');
  ok(await kidMode(page), 'kid mode from the picker on');
  ok(!(await page.locator('header.sitebar').isVisible()), 'the site header is hidden');
  ok(!(await page.locator('footer.foot').isVisible()), 'the footer is hidden');
  eq(await page.locator('.kc-kidbtn .kc-unpicked').count(), 2, 'no bulb picked yet: an unlit one');
  includes(flat(await page.locator('.kc-pick .kc-eddie').innerText()), 'Eddie Bulboa', 'Eddie says hello');
  eq(await page.locator('.kc-pick .kc-eddie img[alt="Eddie Bulboa"]').count(), 1);
  // Picking a bulb: a shape and a color, nothing typed.
  await page.locator('.kc-kidbtn', { hasText: 'Sam' }).click();
  await page.waitForSelector('.kc-bodies');
  eq(await page.locator('.kc-avatar input, .kc-avatar textarea').count(), 0, 'nothing to type');
  eq(await page.locator('.kc-bodybtn').count(), 10); eq(await page.locator('.kc-swatch').count(), 10);
  await page.locator('.kc-bodybtn').nth(7).click();
  await page.locator('.kc-swatch').nth(2).click();
  eq(await page.locator('.kc-bodybtn').nth(7).getAttribute('aria-pressed'), 'true');
  await page.locator('.kc-avacts .kc-big.go').click();
  await page.waitForSelector('.kc-top');
  const p0 = await pat.okay('GET', 'passport');
  eq(JSON.stringify(p0.kids[0].av), JSON.stringify({ b: 'holiday', c: 2 }), 'the bulb is kept on the account');
  includes(flat(await page.locator('.kc-top').innerText()), 'Sam');
  includes(flat(await page.locator('.kc-lvl').innerText()), 'Rookie · Level 1');
  eq(await page.locator('.kc-page a[href]').count(), 0, 'no link on the child’s page');
  eq(await page.locator('.kc-pincard.t0').count(), await page.locator('.kc-pincard').count(), 'every pin still to earn');
  ok(await page.locator('.kc-pincard').count() >= 15, 'a pin for each kind of program, each season and the neighborhoods');
  // A tap on the grown-ups' button does nothing; a hold opens the corner.
  await page.locator('.kc-hold').click();
  await page.waitForTimeout(300);
  eq(await page.locator('.kc-grownup').count(), 0, 'a tap is not enough');
  await hold(page, '.kc-hold');
  await page.waitForSelector('.kc-grownup');
  ok(!(await kidMode(page)), 'kid mode off for the grown-up');
  ok(await page.locator('header.sitebar').isVisible(), 'the site is back');
  const sg = page.locator('.kc-suggest li', { hasText: program.name });
  eq(await sg.count(), 1, 'the week’s program is suggested');
  await sg.locator('button', { hasText: 'Yes' }).click();
  await page.waitForSelector('.kc-donelist li');
  includes(flat(await page.locator('.kc-donelist').innerText()), program.name);
  eq(await page.locator('.kc-suggest li').count(), 0, 'no longer suggested');
  // Back to the child: a present to open, the new pins, a new level.
  await page.locator('.kc-ghead button', { hasText: 'Back to Sam’s page' }).click();
  await page.waitForSelector('.kc-gift');
  const shown = await celebrate(page);
  ok(shown.some(s => /Tap to open/.test(s)), 'the present first: ' + shown.join(' / '));
  ok(shown.some(s => /NEW PIN/.test(s)), 'a new pin');
  ok(shown.some(s => /afternoon adventurer/i.test(s)), 'the after-school pin');   // headings are in capitals
  ok(shown.some(s => /LEVEL UP/.test(s)), 'a new level');
  await page.waitForFunction(() => !document.querySelector('.kc-over'));
  ok(await page.locator('.kc-pincard.t1').count() >= 2, 'bronze pins on the page');
  includes(flat(await page.locator('.kc-lvl').innerText()), 'Level 2');
  // The server keeps what was celebrated, so it isn't celebrated again.
  const p1 = await pat.okay('GET', 'passport');
  eq(p1.kids[0].done.length, 1); eq(p1.kids[0].done[0].k, 'p:' + program.id); eq(p1.kids[0].done[0].s, school);
  eq(p1.kids[0].seen['season:after'], 1); eq(p1.kids[0].lvl, 2);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.kc-kidbtn');
  await page.locator('.kc-kidbtn', { hasText: 'Sam' }).click();
  await page.waitForSelector('.kc-top');
  await page.waitForTimeout(800);
  eq(await page.locator('.kc-over').count(), 0, 'nothing to celebrate the second time');
  eq(counted(t).length, 0, 'nothing counted: ' + counted(t).join(', '));
  eq(t.outside.length, 0, 'nothing asked of another site: ' + t.outside.join(', '));
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('the map of Philadelphia: drawn from this site, clear where the child has been, a bulb for each place, Eddie at the Art Museum, a tap says where', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('kcm'), 'Pat', 'Lee');
  const { program, school } = pickupPair();
  const { program: wp } = weekendProgram();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Zoe', g: '4' }] });
  const y = (await pat.okay('GET', 'passport')).year;
  await pat.okay('POST', 'passport_save', { kid: 'Zoe', done: [{ k: 'p:' + program.id, kind: 'after', y, s: school }, { k: 'p:' + wp.id, kind: 'weekend', y, s: '' }], av: { b: 'globe', c: 6 }, seen: { 'season:after': 1, 'season:weekend': 1 }, lvl: 9 });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/kids-corner/#map');
  await page.waitForSelector('.kc-map');   // one child: straight to her page, on the tab in the address
  await page.evaluate(() => document.querySelectorAll('.kc-over').forEach(o => o.remove()));   // any pin not seen yet
  const open = await page.locator('.kc-map .kc-hoods path.open').count();
  ok(open >= 1, 'at least one neighborhood cleared');
  eq(await page.locator('.kc-placelist li').count(), open, 'the cleared ones named under the map');
  ok(await page.locator('.kc-map svg[data-k]').count() >= 1, 'a program’s bulb on the map');
  eq(await page.locator('.kc-map .kc-you').count(), 1, 'the child’s own bulb');
  eq(await page.locator('.kc-map .kc-eddie-map').count(), 1, 'Eddie on the Art Museum steps');
  ok(await page.locator('.kc-map [data-lm]').count() >= 8, 'the landmarks');
  // A tap on a cleared neighborhood says which it is (zoomed onto it, with what stands on it moved off).
  const hood = page.locator('.kc-map .kc-hoods path.open').first();
  const id = await page.evaluate(() => document.querySelector('.kc-map .kc-hoods path.open').getAttribute('data-hood'));
  await page.evaluate(() => { const p = document.querySelector('.kc-map .kc-hoods path.open'); const svg = p.ownerSVGElement; const bb = p.getBBox(); svg.setAttribute('viewBox', `${bb.x - 5} ${bb.y - 5} ${Math.max(bb.width, bb.height) + 10} ${Math.max(bb.width, bb.height) + 10}`); document.querySelectorAll('.kc-map [data-k], .kc-map .kc-you, .kc-map [data-lm]').forEach(n => n.remove()); });
  const box = await hood.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector('.kc-bubble:not([hidden])');
  includes(flat(await page.locator('.kc-bubble').innerText()), 'You explored here', 'the bubble for ' + id);
  includes(flat(await page.locator('.kc-credit').innerText()), 'Robert Cheetham', 'the neighborhoods are credited');
  // The map's shapes come from this site: no map service, no tiles.
  eq(t.outside.length, 0, 'nothing asked of another site: ' + t.outside.join(', '));
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('the boxing match ranks favorites, which the profile then carries for the planners; the mute button is remembered', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('kcb'), 'Pat', 'Lee');
  const { program, school } = pickupPair();
  const { program: wp } = weekendProgram();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Zoe', g: '4' }] });
  const y = (await pat.okay('GET', 'passport')).year;
  await pat.okay('POST', 'passport_save', { kid: 'Zoe', done: [{ k: 'p:' + program.id, kind: 'after', y, s: school }, { k: 'p:' + wp.id, kind: 'weekend', y, s: '' }], av: { b: 'candle', c: 1 }, seen: { 'season:after': 1, 'season:weekend': 1 }, lvl: 9 });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  await t.page.emulateMedia({ reducedMotion: 'reduce' });   // the fight acted out quickly
  const page = await t.open('/kids-corner/#battle');
  await page.waitForSelector('.kc-zoo');
  await page.evaluate(() => document.querySelectorAll('.kc-over').forEach(o => o.remove()));
  eq(await page.locator('.kc-bulbcard').count(), 2, 'a bulb for each program');
  // Sound: on until muted, and muted stays muted.
  eq(await page.locator('.kc-top .kc-mute').getAttribute('aria-pressed'), 'false');
  await page.locator('.kc-top .kc-mute').click();
  eq(await page.locator('.kc-top .kc-mute').getAttribute('aria-pressed'), 'true');
  await page.locator('.kc-big.fight').click();
  await page.waitForSelector('.kc-arena .kc-fighter');
  eq(await page.locator('.kc-arena .kc-fighter').count(), 2);
  eq(await page.locator('.kc-ring .kc-ref img[alt="Eddie Bulboa"]').count(), 1, 'Eddie referees');
  eq(await page.locator('.kc-ring .kc-fighter .kc-bulb').count(), 2, 'two bulbs in the ring');
  await page.locator('.kc-arena .kc-fighter', { hasText: wp.name }).click();
  await page.waitForSelector('.kc-champ', { timeout: 15000 });
  includes(flat(await page.locator('.kc-champ').innerText()).toLowerCase(), wp.name.toLowerCase(), 'the winner is the champion');
  await page.waitForTimeout(600);   // the ranking saves
  const prof = await pat.okay('GET', 'profile');
  eq(prof.favorites.length, 1); eq(prof.favorites[0].name, 'Zoe'); eq(prof.favorites[0].fav[0], 'p:' + wp.id); eq(prof.favorites[0].fav[1], 'p:' + program.id);
  await page.locator('.kc-champ .kc-big').click();
  await page.waitForSelector('.kc-podium');
  includes(flat(await page.locator('.kc-step.s1').innerText()), wp.name, 'first on the podium');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.kc-top .kc-mute');
  eq(await page.locator('.kc-top .kc-mute').getAttribute('aria-pressed'), 'true', 'still muted after a reload');
  eq(t.outside.length, 0, 'nothing asked of another site: ' + t.outside.join(', '));
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('favorites from Kid’s Corner are offered first in the planners: the week builder, the days off, the summer', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('kcf'), 'Pat', 'Lee');
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

test('the account page’s Kid’s Corner tab: each child at a glance, a class confirmed there, and a way into their page', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('kca'), 'Pat', 'Lee');
  const { entry, program } = pickupPair();
  const { program: wp } = weekendProgram();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '2' }, { n: 'Rae', g: 'K' }] });
  await pat.okay('POST', 'week_save', { week: { name: 'Rae', now: { ...empty(), mon: [entry] }, next: empty() } });
  const y = (await pat.okay('GET', 'passport')).year;
  await pat.okay('POST', 'passport_save', { kid: 'Sam', done: [{ k: 'p:' + wp.id, kind: 'weekend', y, s: '' }], av: { b: 'heart', c: 1 }, seen: { 'season:weekend': 1 }, lvl: 2 });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/account/');
  await page.waitForSelector('#account .acct-tabs');
  eq(await page.locator('script[src*="kids-corner.js"]').count(), 0, 'not loaded until the tab is opened');
  await page.click('.acct-tabs [data-tab-go="kids"]');
  await page.waitForSelector('#kids .kc-sum');
  eq(await page.locator('#kids .kc-sum').count(), 2, 'a card per child');
  const sam = flat(await page.locator('#kids .kc-sum', { hasText: 'Sam' }).innerText());
  includes(sam, 'Level'); includes(sam, 'pins'); includes(sam, '1 class or camp');
  eq(await page.locator('#kids .kc-sum', { hasText: 'Sam' }).locator('.kc-bulb').count(), 1, 'Sam’s bulb');
  includes(flat(await page.locator('#kids .kc-sum', { hasText: 'Rae' }).innerText()), 'Hasn’t picked a bulb yet');
  // Rae's kept week suggests a class: a yes here counts.
  const rae = page.locator('#kids .kc-sum', { hasText: 'Rae' });
  includes(flat(await rae.locator('.kc-sum-wait').innerText()), program.name);
  await rae.locator('.kc-sum-wait button', { hasText: 'Yes' }).click();
  await page.waitForFunction(() => { const c = [...document.querySelectorAll('#kids .kc-sum')].find(x => /Rae/.test(x.textContent)); return c && !c.querySelector('.kc-sum-wait'); });
  const pp = await pat.okay('GET', 'passport');
  eq(pp.kids.find(k => k.name === 'Rae').done[0].k, 'p:' + program.id, 'saved for Rae');
  // Into Sam's own page, past the picker.
  await page.locator('#kids .kc-sum', { hasText: 'Sam' }).locator('button', { hasText: 'Open Sam’s Kid’s Corner' }).click();
  await page.waitForURL(/kids-corner/);
  await page.waitForSelector('.kc-top');
  includes(flat(await page.locator('.kc-top .kc-name').innerText()), 'Sam');
  eq(t.outside.filter(u => !/^https:\/\/a\.klaviyo\.com\/client\//.test(u)).length, 0, 'nothing asked of another site');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});
