// Kids' Playground in a browser: the picker, a child picking their lightbulb, kid mode (no site around it, no link off it),
// the grown-ups' corner behind a press-and-hold, a confirmed class turning into pins and a level (celebrated once),
// the level-up unlocking things for the child's bulb to wear, the map of Philadelphia drawn from this site alone, the
// showdowns (eleven Philly contests, from the Art Museum steps and a cheesesteak to a Boathouse Row regatta and a pothole dodge) ranking favorites with Eddie Bulboa hosting, the mute button, the account page's Kids' Playground tab, and that nothing is counted or sent anywhere.
import { test, ok, eq, deepEq, includes, matches, someone } from '../lib/harness.mjs';
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

test('signed out, Kids’ Playground explains itself and offers the account; signed in with no names, it asks for them', async (ctx) => {
  const b = await ctx.browser();
  const t = await b.context(ctx.site);
  const page = await t.open('/kids-playground/');
  ok(await page.locator('#kc-out').isVisible(), 'the signed-out panel');
  includes(flat(await page.locator('#kc-out').innerText()), 'What counts is what you confirm');
  ok(await page.locator('#kc-out a[href*="next=kids"]').count() >= 2, 'create and log in both come back here');
  eq(counted(t).length, 0, 'quiet even when signed out');
  includes(flat(await page.locator('#kc-out #for-kids').innerText()), 'A PLAYGROUND JUST FOR YOU', 'what a kid gets, said to the kid');
  eq(await page.locator('#for-kids .kids-tile').count(), 4);
  ok(await page.locator('#for-kids a[href*="register/?next=kids"]').isVisible(), 'Grown-ups: make a free account');
  // Signed out, the one way there is the Account Features menu; the button waits for a signed-in parent, and nothing else points to it.
  const home = await t.open('/');
  eq(await home.locator('#for-kids').count(), 0, 'not on the home page');
  ok(!(await home.locator('header.sitebar a.nav-kc').isVisible()), 'no Kids’ Playground button signed out');
  eq(await home.locator('header.sitebar details.menu[data-top$="features/"] a[href$="features/kids-playground/"]').count(), 1, 'under Account Features');
  eq(await home.locator('header.sitebar a[href$="/kids-playground/"]:not([href*="features/"]):visible').count(), 0, 'no way into Kids’ Playground itself');
  eq(await home.locator('#start a[href$="kids-playground/"]').count(), 0, 'not in the Parents box');
  const plans = await t.open('/schedules/');
  eq(await plans.locator('main a[href$="kids-playground/"]').count(), 0, 'not on the Schedule Builder');
  await t.close();
  const pat = ctx.api().as(someone('kcw'), 'Pat', 'Lee');
  const t2 = await b.context(ctx.site, { sid: pat.cookie });
  const p2 = await t2.open('/kids-playground/');
  await p2.waitForSelector('.kc-none');
  includes(flat(await p2.locator('.kc-none').innerText()), 'Add your kids’ first names');
  matches(await p2.locator('.kc-none a').getAttribute('href'), /account\/#school$/);
  // The site's menu has the way in: a button beside Parent Portal.
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
  const page = await t.open('/kids-playground/');
  await page.waitForSelector('.kc-kidbtn');
  eq(await page.locator('.kc-kidbtn').count(), 2, 'one button per child');
  ok(await kidMode(page), 'kid mode from the picker on');
  ok(!(await page.locator('header.sitebar').isVisible()), 'the site header is hidden');
  ok(!(await page.locator('footer.foot').isVisible()), 'the footer is hidden');
  eq(await page.locator('.kc-kidbtn .kc-unpicked').count(), 2, 'no bulb picked yet: an unlit one');
  includes(flat(await page.locator('.kc-pick .kc-eddie').innerText()), 'Eddie Bulboa', 'Eddie says hello');
  eq(await page.locator('.kc-pick .kc-eddie img[alt="Eddie Bulboa"]').count(), 1);
  // The first time: Eddie's welcome, one big button a step, with the bulb picked partway through.
  await page.locator('.kc-kidbtn', { hasText: 'Sam' }).click();
  await page.waitForSelector('.kc-tour');
  includes(flat(await page.locator('.kc-tour .kc-eddie-say').innerText()), 'Hi, Sam! I’m Eddie Bulboa');
  eq(await page.locator('.kc-dots i').count(), 6, 'six steps');
  eq(await page.locator('.kc-tour a[href]').count(), 0, 'no link in the welcome');
  await page.locator('.kc-tour .kc-big.go').click();
  includes(flat(await page.locator('.kc-tour .kc-eddie-say').innerText()), 'make your very own bulb');
  await page.locator('.kc-tour .kc-big.go').click();
  // Picking a bulb: a shape and a color, nothing typed.
  await page.waitForSelector('.kc-bodies');
  eq(await page.locator('.kc-avatar input, .kc-avatar textarea').count(), 0, 'nothing to type');
  eq(await page.locator('.kc-bodybtn').count(), 10); eq(await page.locator('.kc-swatch').count(), 10);
  await page.locator('.kc-bodybtn').nth(7).click();
  await page.locator('.kc-swatch').nth(2).click();
  eq(await page.locator('.kc-bodybtn').nth(7).getAttribute('aria-pressed'), 'true');
  await page.locator('.kc-avacts .kc-big.go').click();
  // Back in the welcome: no pins yet, the map, picking a favorite, then off to the page.
  await page.waitForFunction(() => /gets you a pin/.test((document.querySelector('.kc-tour .kc-eddie-say') || {}).textContent || ''));
  const p0 = await pat.okay('GET', 'passport');
  eq(JSON.stringify(p0.kids[0].av), JSON.stringify({ b: 'holiday', c: 2 }), 'the bulb is kept on the account');
  for (const said of [/map of Philly/, /most fun at/, /Ready, Sam\?/]) { await page.locator('.kc-tour .kc-big.go').click(); await page.waitForFunction(re => new RegExp(re).test((document.querySelector('.kc-tour .kc-eddie-say') || {}).textContent || ''), said.source); }
  await page.locator('.kc-tour .kc-big.go', { hasText: 'Let’s go' }).click();
  await page.waitForSelector('.kc-top');
  eq((await pat.okay('GET', 'passport')).kids[0].seen.intro, 1, 'welcomed once');
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
  eq(await page.locator('.kc-ghead button', { hasText: 'Play Eddie’s welcome again' }).count(), 1, 'the welcome can be played again');
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
  ok(shown.some(s => /new pins?!/i.test(s)), 'new pins: ' + shown.join(' / '));
  const secretShown = shown.some(s => /SECRET PHILLY PIN!/.test(s) && /You found a secret pin/.test(s));   // only if this one class makes a pair
  ok(shown.some(s => /SURPRISE!/.test(s) && /You found it in/.test(s)), 'a surprise in the neighborhood: ' + shown.join(' / '));
  ok(shown.some(s => /afternoon adventurer/i.test(s)), 'the after-school pin');   // headings are in capitals
  ok(shown.some(s => /LEVEL UP/.test(s)), 'a new level');
  ok(shown.some(s => /New stuff to wear/i.test(s) && /Sunglasses/i.test(s) && /Bow tie/i.test(s) && !/Scarf/i.test(s)), 'a first class is level 2 (paced: no further), which unlocks sunglasses and a bow tie: ' + shown.join(' / '));
  await page.waitForFunction(() => !document.querySelector('.kc-over'));
  // "Try it on!" opens the bulb's wardrobe: what level 2 unlocked, the rest locked with the level that opens it.
  await page.waitForSelector('.kc-avatar .kc-wardrobe');
  eq(await page.locator('.kc-wearbtn').count(), 16, 'everything there is to wear');
  eq(await page.locator('.kc-wearbtn:not(.locked)').count(), 2, 'two unlocked at level 2');
  const cape = page.locator('.kc-wearbtn', { has: page.locator('b', { hasText: /^cape$/i }) });   // not the cap
  includes(flat(await cape.locator('.kc-lock').innerText()).toLowerCase(), 'level 4');
  await cape.click();
  includes(flat(await page.locator('.kc-avatar .kc-host .kc-eddie-say').innerText()), 'Reach level 4', 'Eddie says when it unlocks');
  eq(await cape.getAttribute('aria-pressed'), 'false', 'a locked thing can’t be worn');
  const shades = page.locator('.kc-wearbtn', { has: page.locator('b', { hasText: /^sunglasses$/i }) });
  await shades.click();
  eq(await shades.getAttribute('aria-pressed'), 'true');
  await page.locator('.kc-avatar .kc-big.go').click();
  await page.waitForSelector('.kc-pincard');
  ok(await page.locator('.kc-pincard.t1').count() >= 2, 'bronze pins on the page');
  includes(flat(await page.locator('.kc-lvl').innerText()), 'Level 2');
  // The secret Philly pins: any found (one class is a pair only if it is, say, music around Old City), the rest a ? with a riddle.
  const foundN = +(flat(await page.locator('.kc-pinsec.secret').innerText()).match(/(\d+) of 10 found/i) || [, -1])[1];
  ok(foundN >= 0 && foundN <= 2, 'the secret Philly pins counted: ' + foundN);
  eq(secretShown, foundN > 0, 'a secret pin found is revealed on its own');
  eq(await page.locator('.kc-pincard.secret').count(), 10 - foundN, 'the rest are still secrets');
  await page.locator('.kc-pincard.secret').first().click();
  matches(flat(await page.locator('.kc-over .kc-pinbig').innerText()), /Secret Philly pin.*Keep exploring/i, 'a secret pin shows only its riddle');
  eq(await page.locator('.kc-over .kc-rule, .kc-over .kc-minimap').count(), 0, 'no rule and no map until it’s found');
  await page.locator('.kc-over .kc-big').click();
  await page.waitForFunction(() => !document.querySelector('.kc-over'));
  // The server keeps what was celebrated, so it isn't celebrated again.
  const p1 = await pat.okay('GET', 'passport');
  eq(p1.kids[0].done.length, 1); eq(p1.kids[0].done[0].k, 'p:' + program.id); eq(p1.kids[0].done[0].s, school);
  eq(p1.kids[0].seen['season:after'], 1); eq(p1.kids[0].lvl, 2);
  ok(Object.keys(p1.kids[0].seen).some(id => /^pin:/.test(id)), 'the server keeps the new pins as seen too: ' + Object.keys(p1.kids[0].seen).join(', '));
  eq(Object.keys(p1.kids[0].seen).some(id => /^philly:/.test(id)), foundN > 0, 'and a secret pin found'); eq(JSON.stringify(p1.kids[0].av.w), '{"face":"shades"}', 'the bulb wears its sunglasses');
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

test('a secret Philly pin: a riddle until found, then revealed on its own, saying how to level up, what counted and where', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('kcp'), 'Pat', 'Lee');
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '3' }] });
  const y = (await pat.okay('GET', 'passport')).year;
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const look = await t.open('/');
  // a music class with one site, around Old City: Liberty Bell Ringer's pair by itself
  const k = await look.evaluate(() => fetch('/assets/kids-corner.json').then(r => r.json()).then(d => Object.keys(d.listings).find(k => { const l = d.listings[k]; return (l.t || []).includes('music') && l.sites.length === 1 && l.sites[0].a === 'oldcity'; })));
  ok(k, 'a music class around Old City in the data');
  await pat.okay('POST', 'passport_save', { kid: 'Sam', done: [{ k, kind: 'after', y, s: '' }], av: { b: 'globe', c: 6 }, seen: { intro: 1 }, lvl: 1 });
  const page = await t.open('/kids-playground/#pins');
  await page.waitForSelector('.kc-over, .kc-gift');
  const shown = await celebrate(page);
  ok(shown.some(s => /SECRET PHILLY PIN!/.test(s) && /LIBERTY BELL RINGER/i.test(s) && /You found a secret pin/.test(s)), 'revealed on its own: ' + shown.join(' / '));
  await page.waitForFunction(() => !document.querySelector('.kc-over'));
  if (await page.locator('.kc-avatar').count()) await page.locator('.kc-avatar .kc-big.go').click();
  await page.waitForSelector('.kc-pincard');
  await page.locator('.kc-pincard', { hasText: 'Liberty Bell Ringer' }).click();
  await page.waitForSelector('.kc-over .kc-mini');
  const close = flat(await page.locator('.kc-over .kc-pinbig').innerText());
  includes(close, 'You have 1 music + Old City pair!');
  matches(close, /Music: .+\. Around Old City: .+\./, 'what counted for each half');
  includes(close, 'To level up: Do a music class AND a class around Old City.');
  includes(close, 'The colored part of Philly is Old City. The circle is the Liberty Bell!');
  eq(await page.locator('.kc-over details').count(), 0, 'no list of neighborhoods');
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
  await pat.okay('POST', 'passport_save', { kid: 'Zoe', done: [{ k: 'p:' + program.id, kind: 'after', y, s: school }, { k: 'p:' + wp.id, kind: 'weekend', y, s: '' }], av: { b: 'globe', c: 6 }, seen: { intro: 1, 'season:after': 1, 'season:weekend': 1 }, lvl: 9 });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/kids-playground/#map');
  await page.waitForSelector('.kc-map');   // one child: straight to her page, on the tab in the address
  await page.evaluate(() => document.querySelectorAll('.kc-over').forEach(o => o.remove()));   // any pin not seen yet
  includes(flat(await page.locator('.kc-lvl').innerText()), 'Level 9', 'a level once reached is kept, though two classes are fewer points now');
  const open = await page.locator('.kc-map .kc-hoods path.open').count();
  ok(open >= 1, 'at least one neighborhood cleared');
  eq(await page.locator('.kc-placelist li').count(), open, 'the cleared ones named under the map');
  ok(await page.locator('.kc-map svg[data-k]').count() >= 1, 'a program’s bulb on the map');
  eq(await page.locator('.kc-map .kc-you').count(), 1, 'the child’s own bulb');
  eq(await page.locator('.kc-map .kc-eddie-map').count(), 1, 'Eddie on the Art Museum steps');
  // Each neighborhood with a class has a surprise or two: what she found drawn on it, a second one a ? until another class there.
  const sur = await page.locator('.kc-map [data-sur]:not(.kc-surq)').count();
  ok(sur >= 1, 'a surprise where she has been');
  // The secret spots: every area's famous things, a ? until classes nearby find them.
  const spots = await page.evaluate(() => document.querySelectorAll('.kc-map [data-lm]').length);
  eq(spots, 17, 'every secret spot is on the map');
  const found = await page.locator('.kc-map [data-lm]:not(.kc-secret)').count();
  ok(found >= 1 && found < spots, 'some found, some still a ?: ' + found);
  matches(flat(await page.locator('.kc-spottally').innerText()), new RegExp('^' + found + ' / 17 secret spots found · ' + sur + ' surprises?$'));
  // A tap on a ? says how to find it (everything else taken off the map, so the tap lands on it).
  await page.evaluate(() => { const keep = document.querySelector('.kc-map .kc-secret'); document.querySelectorAll('.kc-map [data-k], .kc-map .kc-you, .kc-map .kc-eddie-map, .kc-map [data-lm], .kc-map [data-sur]').forEach(n => { if (n !== keep) n.remove(); }); });
  const q = await page.locator('.kc-map .kc-secret').boundingBox();
  await page.mouse.click(q.x + q.width / 2, q.y + q.height / 2);
  await page.waitForSelector('.kc-bubble:not([hidden])');
  matches(flat(await page.locator('.kc-bubble').innerText()), /A secret spot!.*Go to \d+ more class(es)? near here/);
  // A tap on a surprise says what it is and where it was found.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.kc-map');
  await page.evaluate(() => { document.querySelectorAll('.kc-over').forEach(o => o.remove()); const keep = document.querySelector('.kc-map [data-sur]:not(.kc-surq)'); document.querySelectorAll('.kc-map [data-k], .kc-map .kc-you, .kc-map .kc-eddie-map, .kc-map [data-lm], .kc-map [data-sur]').forEach(n => { if (n !== keep) n.remove(); }); });
  const sb = await page.locator('.kc-map [data-sur]').boundingBox();
  await page.mouse.click(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.waitForSelector('.kc-bubble:not([hidden])');
  matches(flat(await page.locator('.kc-bubble').innerText()), /!.*Found in [A-Z]/);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.kc-map');
  await page.evaluate(() => document.querySelectorAll('.kc-over').forEach(o => o.remove()));
  // A tap on a cleared neighborhood says which it is (zoomed onto it, with what stands on it moved off).
  const hood = page.locator('.kc-map .kc-hoods path.open').first();
  const id = await page.evaluate(() => document.querySelector('.kc-map .kc-hoods path.open').getAttribute('data-hood'));
  await page.evaluate(() => { const p = document.querySelector('.kc-map .kc-hoods path.open'); const svg = p.ownerSVGElement; const bb = p.getBBox(); svg.setAttribute('viewBox', `${bb.x - 5} ${bb.y - 5} ${Math.max(bb.width, bb.height) + 10} ${Math.max(bb.width, bb.height) + 10}`); document.querySelectorAll('.kc-map [data-k], .kc-map .kc-you, .kc-map [data-lm], .kc-map [data-sur]').forEach(n => n.remove()); });
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

test('going back to a class: a ×2 on its bulb, the Repeater Reward pin, and the times in the grown-ups’ corner', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('kcr'), 'Pat', 'Lee');
  const { program, school } = pickupPair();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Ana', g: '3' }] });
  const y = (await pat.okay('GET', 'passport')).year;
  await pat.okay('POST', 'passport_save', { kid: 'Ana', done: [{ k: 'p:' + program.id, kind: 'after', y, s: school, n: 2 }], av: { b: 'globe', c: 2 }, seen: { intro: 1 }, lvl: 1 });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  const page = await t.open('/kids-playground/');
  await page.waitForSelector('.kc-gift');
  const shown = await celebrate(page);
  ok(shown.some(s => /Repeater Reward/i.test(s)), 'the Repeater Reward among the new pins: ' + shown.join(' / '));
  await page.waitForFunction(() => !document.querySelector('.kc-over'));
  if (await page.locator('.kc-avatar').count()) await page.locator('.kc-avatar .kc-big.ghost').click();   // "Try it on!" was tapped: back to the page
  await page.waitForSelector('.kc-pincard');
  ok(await page.locator('.kc-pincard.t1', { hasText: 'Repeater Reward' }).count() === 1, 'a bronze Repeater Reward');
  await page.locator('.kc-tabbtn', { hasText: 'Showdown' }).click();
  await page.waitForSelector('.kc-zoo');
  eq(flat(await page.locator('.kc-bulbcard .kc-timesbadge').innerText()), '×2', 'twice, on its bulb');
  // The grown-ups' corner: one more time, then back to once (left out when it's once).
  await hold(page, '.kc-hold');
  await page.waitForSelector('.kc-grownup .kc-times');
  includes(flat(await page.locator('.kc-grownup').innerText()), 'No showdown yet', 'the Favorites panel says how a ranking starts');
  eq(flat(await page.locator('.kc-times-n').innerText()), '2');
  await page.locator('.kc-times button[aria-label="One time more"]').click();
  await page.waitForFunction(() => (document.querySelector('.kc-times-n') || {}).textContent === '3');
  eq((await pat.okay('GET', 'passport')).kids[0].done[0].n, 3, 'saved as three times');
  await page.locator('.kc-times button[aria-label="One time fewer"]').click();
  await page.waitForFunction(() => (document.querySelector('.kc-times-n') || {}).textContent === '2');
  await page.locator('.kc-times button[aria-label="One time fewer"]').click();
  await page.waitForFunction(() => (document.querySelector('.kc-times-n') || {}).textContent === '1');
  eq((await pat.okay('GET', 'passport')).kids[0].done[0].n, undefined, 'once: no count kept');
  ok(await page.locator('.kc-times button[aria-label="One time fewer"]').isDisabled(), 'no fewer than once');
  // Start over, from the grown-ups' corner: two taps, then Eddie's welcome again; the class stays.
  const again = page.locator('.kc-reset-go');
  await again.click();
  eq(flat(await again.innerText()), 'Tap again to start over');
  await again.click();
  await page.waitForSelector('.kc-tour');
  includes(flat(await page.locator('.kc-tour .kc-eddie-say').innerText()), 'Hi, Ana!');
  const fresh = (await pat.okay('GET', 'passport')).kids[0];
  eq(fresh.av, null); eq(fresh.seen.intro, undefined); eq(fresh.done.length, 1, 'the class stays');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('the showdown ranks favorites with no one hurt, which the profile then carries for the planners; the mute button is remembered', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('kcb'), 'Pat', 'Lee');
  const { program, school } = pickupPair();
  const { program: wp } = weekendProgram();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Zoe', g: '4' }] });
  const y = (await pat.okay('GET', 'passport')).year;
  await pat.okay('POST', 'passport_save', { kid: 'Zoe', done: [{ k: 'p:' + program.id, kind: 'after', y, s: school }, { k: 'p:' + wp.id, kind: 'weekend', y, s: '' }], av: { b: 'candle', c: 1 }, seen: { intro: 1, 'season:after': 1, 'season:weekend': 1 }, lvl: 9 });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  await t.page.emulateMedia({ reducedMotion: 'reduce' });   // the contest acted out quickly
  const page = await t.open('/kids-playground/#battle');
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
  eq(await page.locator('.kc-show .kc-ref img[alt="Eddie Bulboa"]').count(), 1, 'Eddie hosts');
  eq(await page.locator('.kc-show .kc-fighter .kc-bulb').count(), 2, 'two bulbs on the stage');
  matches(await page.locator('.kc-show').getAttribute('class'), /\bkc-ev-(race|steak|kite|bell|waterice|row|strut|hoagie|pothole|pretzel|mural)\b/, 'one of the Philly contests');
  matches(flat(await page.locator('.kc-fight .kc-ask').innerText()), /which did you have more fun at\?/i, 'the question is plain');
  matches(flat(await page.locator('.kc-fight .kc-evname').innerText()), /art museum steps|cheesesteak|kite fly-off|liberty bell|water ice|boathouse row|mummers|hoagie|pothole|soft pretzel|mural/i);
  // Watch the contest (with reduced motion it passes quickly): the other comes second and cheers; no light goes out.
  await page.evaluate(() => {
    window.__kc = { second: '', said: '', off: 0 };
    new MutationObserver(() => {
      const s = document.querySelector('.kc-show .kc-fighter.second');
      if (s && !window.__kc.second) { window.__kc.second = s.innerText; window.__kc.said = (s.querySelector('.kc-second') || {}).textContent || ''; }
      window.__kc.off += document.querySelectorAll('.kc-show .kc-bulb.off').length;
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  await page.locator('.kc-arena .kc-fighter', { hasText: wp.name }).click();
  await page.waitForSelector('.kc-champ', { timeout: 15000 });
  const watched = await page.evaluate(() => window.__kc);
  includes(flat(watched.second).toLowerCase(), program.name.toLowerCase(), 'the other comes second');
  matches(watched.said, /Good race!|So full!|Nice flight!|Nice ring!|Brain freeze!|Strong rowing!|Great strut!|Yum!|Bumpy ride!|Tasty stack!|So colorful!/, 'and is cheered');
  eq(watched.off, 0, 'nobody knocked out');
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
  // Each contest, by name: its stage and props, played through to a champion with the winner's sign.
  const PROPS = { race: ['.kc-museum', 1], steak: ['.kc-steak', 2], kite: ['.kc-kite', 2], bell: ['.kc-bell', 1], waterice: ['.kc-wice', 2], row: ['.kc-boat', 2], strut: ['.kc-parasol', 1], hoagie: ['.kc-hoagie', 2], pothole: ['.kc-bike', 2], pretzel: ['.kc-stack', 2], mural: ['.kc-wall', 2] };
  const SIGN = { race: 'WINS!', steak: 'CLEAN PLATE!', kite: 'HIGHEST!', bell: 'LOUDEST!', waterice: 'SLURPED!', row: 'FIRST!', strut: 'BEST STRUT!', hoagie: 'BEST HOAGIE!', pothole: 'SMOOTH RIDE!', pretzel: 'BEST STACK!', mural: 'MASTERPIECE!' };
  for (const id of Object.keys(PROPS)) {
    await page.goto(new URL('/kids-playground/?contest=' + id + '#battle', page.url()).href);
    await page.waitForSelector('.kc-zoo');
    await page.evaluate(() => document.querySelectorAll('.kc-over').forEach(o => o.remove()));
    await page.locator('.kc-big.fight').click();
    await page.waitForSelector('.kc-show.kc-ev-' + id);
    eq(await page.locator('.kc-show ' + PROPS[id][0]).count(), PROPS[id][1], id + ': its props');
    await page.evaluate(() => { window.__sign = ''; new MutationObserver(() => { const w = document.querySelector('.kc-show .kc-wins'); if (w && !window.__sign) window.__sign = w.textContent; }).observe(document.body, { subtree: true, childList: true }); });
    await page.locator('.kc-arena .kc-fighter').first().click();
    await page.waitForSelector('.kc-champ', { timeout: 15000 });
    eq(await page.evaluate(() => window.__sign), SIGN[id], id + ': the winner’s sign');
  }
  eq(t.outside.length, 0, 'nothing asked of another site: ' + t.outside.join(', '));
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('favorites from Kids’ Playground are offered first in the planners: the week builder, the days off, the summer', async (ctx) => {
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

test('the account page’s Kids’ Playground tab: each child at a glance, a class confirmed there, and a way into their page', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('kca'), 'Pat', 'Lee');
  const { entry, program } = pickupPair();
  const { program: wp } = weekendProgram();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '2' }, { n: 'Rae', g: 'K' }] });
  await pat.okay('POST', 'week_save', { week: { name: 'Rae', now: { ...empty(), mon: [entry] }, next: empty() } });
  const y = (await pat.okay('GET', 'passport')).year;
  await pat.okay('POST', 'passport_save', { kid: 'Sam', done: [{ k: 'p:' + wp.id, kind: 'weekend', y, s: '' }], fav: ['p:' + program.id, 'p:' + wp.id], av: { b: 'heart', c: 1 }, seen: { intro: 1, 'season:weekend': 1 }, lvl: 2 });
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
  // Sam's whole showdown ranking, best first.
  deepEq((await page.locator('#kids .kc-sum', { hasText: 'Sam' }).locator('.kc-rank-list li').allInnerTexts()).map(flat), [program.name, wp.name], 'the whole ranking, in order');
  eq(await page.locator('#kids .kc-sum', { hasText: 'Rae' }).locator('.kc-rank').count(), 0, 'nothing for a child with no showdown yet');
  // Rae's kept week suggests a class: a yes here counts.
  const rae = page.locator('#kids .kc-sum', { hasText: 'Rae' });
  includes(flat(await rae.locator('.kc-sum-wait').innerText()), program.name);
  await rae.locator('.kc-sum-wait button', { hasText: 'Yes' }).click();
  await page.waitForFunction(() => { const c = [...document.querySelectorAll('#kids .kc-sum')].find(x => /Rae/.test(x.textContent)); return c && !c.querySelector('.kc-sum-wait'); });
  const pp = await pat.okay('GET', 'passport');
  eq(pp.kids.find(k => k.name === 'Rae').done[0].k, 'p:' + program.id, 'saved for Rae');
  // Start over, from the Parent Portal: the box opens in Sam's card; the class stays unless the box is ticked.
  const samCard = () => page.locator('#kids .kc-sum', { hasText: 'Sam' });
  await samCard().locator('button', { hasText: 'Start over' }).first().click();
  await samCard().locator('.kc-reset').waitFor();
  includes(flat(await samCard().locator('.kc-reset').innerText()), 'Also take off the 1 class or camp you confirmed');
  await samCard().locator('.kc-reset .kc-reset-go').click();
  await samCard().locator('.kc-reset .kc-reset-go').click();
  await page.waitForSelector('#kids .g-status.good');
  includes(flat(await samCard().innerText()), 'Hasn’t picked a bulb yet');
  includes(flat(await page.locator('#kids .g-status.good').innerText()), 'Sam starts from the beginning');
  const ps = (await pat.okay('GET', 'passport')).kids.find(k => k.name === 'Sam');
  eq(ps.av, null); eq(ps.done.length, 1, 'unticked: the class stays');
  await pat.okay('POST', 'passport_save', { kid: 'Sam', done: ps.done, av: { b: 'heart', c: 1 }, seen: { intro: 1, 'season:weekend': 1 }, lvl: 2 });   // as it was, for what follows
  // Into Sam's own page, past the picker.
  await page.locator('#kids .kc-sum', { hasText: 'Sam' }).locator('button', { hasText: 'Open Sam’s Kids’ Playground' }).click();
  await page.waitForURL(/kids-playground/);
  await page.waitForSelector('.kc-top');
  includes(flat(await page.locator('.kc-top .kc-name').innerText()), 'Sam');
  eq(t.outside.filter(u => !/^https:\/\/a\.klaviyo\.com\/client\//.test(u)).length, 0, 'nothing asked of another site');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});
