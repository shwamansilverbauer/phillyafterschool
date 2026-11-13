// The account page in a browser: its tabs, sharing a kept week from the Plans tab, and the co-parent box.
import { test, ok, eq, deepEq, includes, excludes, matches, someone } from '../lib/harness.mjs';
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
  eq(await page.locator('.acct-tabs [aria-current="page"]').innerText(), 'Overview', 'the Parent Portal opens on its overview');
  ok(await page.locator('#overview').isVisible(), 'the overview shows');
  ok(!(await page.locator('#you').isVisible()), 'the details wait on their own tab');
  eq(await page.locator('.acct-tabs [data-tab-go="school"], .acct-tabs [data-tab-go="emails"]').count(), 0, 'no School & kids tab, no Emails & following tab');
  matches(await page.locator('.acct-tabs [data-tab-go="todo"]').getAttribute('class') || '', /^(?!.*tab-cta)/, 'To do isn’t yellow with nothing on it');
  for (const [hash, label, probe] of [['you', 'Account', '#you'], ['favorites', 'Favorites', '#favorites'], ['plans', 'Plans & sharing', '#plans']]) {
    await page.click(`.acct-tabs [data-tab-go="${hash}"]`);
    await page.waitForTimeout(300);
    eq(flat(await page.locator('.acct-tabs [aria-current="page"]').innerText()), label, `tab for #${hash}`);
    ok(!(await page.locator('#overview').isVisible()), `overview hidden on #${hash}`);
    ok(await page.locator(probe).first().isVisible(), `#${hash} shows its content`);
  }
  // The emails are on the Account tab now; an old link to them still opens it.
  await page.click('.acct-tabs [data-tab-go="you"]');
  ok(await page.locator('#emails').isVisible(), 'Emails and notifications on the Account tab');
  await page.goto(ctx.site.base + '/account/#emails', { waitUntil: 'networkidle' }); await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#account .acct-tabs');
  eq(flat(await page.locator('.acct-tabs [aria-current="page"]').innerText()), 'Account', '#emails opens Account');
  // An old link to School & kids goes to the profile, with the school's row open.
  await page.goto(ctx.site.base + '/account/#school', { waitUntil: 'networkidle' });
  await page.waitForURL(/profile\/#school$/);
  await page.waitForSelector('#school .pc-editor select#prof-school');
  const prof = await t.open('/profile/');
  await prof.waitForSelector('.prof-card');
  includes(flat(await prof.locator('.prof-card').innerText()), 'Pat Lee', 'the profile card names the person');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('share a kept week by email under Sharing: the form, the email, who has it, and the week’s line in Plans you’ve kept', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('share'), 'Pat', 'Lee');
  const { entry } = pickupPair();
  await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/account/#sharing');
  await page.waitForSelector('.g-share-one');
  // The four ways, in order, then the plans.
  const heads = (await page.locator('.g-sharing .g-way > h3').allInnerTexts()).map(flat);
  deepEq(heads, ['Share with a co-parent', 'Share a week by email', 'Share with a group', 'Have an invite?'], 'every way to share, together');
  ok(await page.evaluate(() => { const s = document.querySelector('.g-sharing'), p = document.getElementById('plans'); return !!(s && p && (s.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING)); }), 'Sharing comes before the plans');
  includes(flat(await page.locator('.g-share-one').innerText()), 'Sam’s week', 'one week: named, not a list');
  const aunt = someone('aunt');
  await page.fill('#share-email', aunt);
  await page.locator('.g-share-one button[type=submit]').click();
  await page.waitForSelector(`.g-sharing >> text=${aunt}`);
  includes(flat(await page.locator('.g-sharing').innerText()), 'Sam’s week · invited', 'the list says which week and that it hasn’t been opened');
  const row = page.locator('#plans li', { hasText: 'Sam’s week' }).first();
  const line = flat(await row.innerText());
  includes(line, '1 program'); includes(line, 'shared with one person', 'the week’s line says it’s shared');
  const m = await ctx.mail.waitFor(aunt, /Sam/);
  includes(m.TextBody, 'Pat Lee');
  // The server agrees.
  const prof = await pat.okay('GET', 'profile');
  eq(prof.weeks[0].shares.length, 1); eq(prof.weeks[0].shares[0].invites[0].email, aunt);
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('co-parents under Sharing: invite, the invitation asking whose plans to share, accept, linked, stop', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('cop'), 'Pat', 'Lee');
  const dana = ctx.api().as(someone('copd'), 'Dana', 'Reyes');
  const { entry } = pickupPair();
  await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } });
  await dana.okay('POST', 'week_save', { week: { name: 'Rae', now: { ...empty(), tue: [entry] }, next: empty() } });
  const open = async (sid) => { const t = await b.context(ctx.site, { sid }); await t.open('/account/#plans'); await t.page.waitForSelector('.g-coparent #cop-email, .g-coparent .g-cop-head'); await t.page.waitForTimeout(300); return t; };
  // Pat invites Dana.
  const tp = await open(pat.cookie);
  includes(flat(await tp.page.locator('.g-way', { has: tp.page.locator('.g-coparent') }).innerText()), 'Share with a co-parent');
  await tp.page.fill('#cop-email', dana.email);
  await tp.page.locator('.g-coparent button[type=submit]').click();
  await tp.page.waitForSelector('.g-coparent button:has-text("Send again")');
  let text = flat(await tp.page.locator('.g-coparent').innerText());
  includes(text, dana.email, 'the box names who was invited'); includes(text, 'Cancel');
  // Dana sees the invitation. They both have a week, so she picks whose plans the two of them share before accepting.
  const td = await open(dana.cookie);
  text = flat(await td.page.locator('.g-coparent').innerText());
  includes(text, 'Pat Lee'); matches(text, /Accept/); matches(text, /Decline/);
  includes(text, 'Whose should the two of you share');
  const picks = (await td.page.locator('.g-pick-one b').allInnerTexts()).map(flat);
  deepEq(picks, ['Use Pat’s', 'Use mine']);
  matches(flat(await td.page.locator('.g-pick-one', { hasText: 'Use mine' }).innerText()), /1 week/, 'each choice says what’s in it');
  const yes = td.page.locator('.g-coparent button', { hasText: 'Accept' });
  eq(await yes.isDisabled(), true, 'Accept waits for a choice');
  await td.page.locator('.g-pick-one', { hasText: 'Use Pat’s' }).click();
  eq(await yes.isDisabled(), false);
  await yes.click();
  await td.page.waitForSelector('.g-coparent button:has-text("Stop sharing everything")');
  text = flat(await td.page.locator('.g-coparent').innerText());
  includes(text, 'Pat Lee', 'linked with Pat');
  const weeks = (await td.page.locator('#plans .g-list > li > b').allInnerTexts()).map(flat);
  deepEq(weeks, ['Sam’s week'], 'Dana now sees Pat’s week, and hers is set aside');
  // Pat's page, reloaded, agrees.
  await tp.page.reload({ waitUntil: 'networkidle' });
  await tp.page.waitForSelector('.g-coparent button:has-text("Stop sharing everything")');
  includes(flat(await tp.page.locator('.g-coparent').innerText()), 'Dana Reyes');
  deepEq((await tp.page.locator('#plans .g-list > li > b').allInnerTexts()).map(flat), ['Sam’s week'], 'Pat sees the same');
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
  deepEq((await dana.okay('GET', 'profile')).weeks.map(w => w.name), ['Rae'], 'Dana has her own week back');
  eq(tp.errors.length + td.errors.length, 0, tp.errors.concat(td.errors).join(' | '));
  await tp.close(); await td.close();
});

test('the profile: kids added, changed and removed in their row, the school and neighborhood picked in theirs, and following stopped there', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('kids'), 'Pat', 'Lee');
  await pat.okay('POST', 'week_save', { week: { name: 'Rae', now: empty(), next: empty() } });   // a name that only a plan has
  const { program, school } = pickupPair();
  await pat.okay('POST', 'follow', { key: 'p:' + program.id, on: true });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/profile/');
  await page.waitForSelector('.prof-card #add-kid');
  const kidsRow = page.locator('#add-kid');
  includes(flat(await kidsRow.innerText()), 'from a plan', 'a name from a plan is offered');
  // Add one: the form drops down under the row.
  await kidsRow.locator('.pc-go').click();
  await page.fill('#ak-new-name', 'Sam');
  await page.selectOption('#ak-new-grade', '2');
  await page.selectOption('#ak-new-age', '7');
  await page.locator('#add-kid .pc-editor .kid-form button[type=submit]').click();
  await page.waitForSelector('#add-kid li:has-text("2nd grade, age 7")');
  eq(await page.locator('#add-kid .pc-editor').count(), 0, 'the form closes once saved');
  // Take the one from the plan.
  await page.locator('#add-kid button', { hasText: 'Add to profile' }).click();
  await page.waitForFunction(() => !/from a plan/.test(document.querySelector('#add-kid').textContent));
  // Change Sam's grade: the name stays.
  await page.locator('#add-kid li', { hasText: 'Sam' }).locator('button', { hasText: 'Change' }).click();
  ok(await page.locator('#add-kid .kid-form input[readonly]').count() === 1, 'the name can’t be changed here');
  await page.locator('#add-kid .kid-form select').first().selectOption('3');
  await page.locator('#add-kid .kid-form button[type=submit]').click();
  await page.waitForSelector('#add-kid li:has-text("3rd grade, age 7")');
  let prof = await pat.okay('GET', 'profile');
  eq(JSON.stringify(prof.kids), JSON.stringify([{ n: 'Sam', g: '3', a: '7' }, { n: 'Rae', g: '', a: '' }]));
  ok(prof.grades.includes('3'), 'the grade the lists start on follows');
  // Remove takes two taps.
  await page.locator('#add-kid li', { hasText: 'Rae' }).locator('button', { hasText: 'Remove' }).click();
  await page.locator('#add-kid li', { hasText: 'Rae' }).locator('button[data-armed]').click();
  await page.waitForSelector('#add-kid .pc-said:has-text("Rae is off your profile")');
  prof = await pat.okay('GET', 'profile');
  eq(prof.kids.length, 1); eq(prof.kids[0].n, 'Sam');
  // The school: Add opens the list under the row, and picking one keeps it.
  await page.locator('#school .pc-go').click();
  await page.selectOption('#school .pc-editor select#prof-school', school);
  await page.waitForFunction(() => /Change|Done/.test(document.querySelector('#school .pc-go').textContent) && !/None kept/.test(document.querySelector('#school dd').textContent));
  eq((await pat.okay('GET', 'profile')).school, school, 'kept on the server');
  await page.locator('#school .pc-editor button', { hasText: 'Done' }).click();
  eq(await page.locator('#school .pc-editor').count(), 0, 'Done closes it');
  // Following: Change opens the list, to stop one.
  await page.locator('#following .pc-go').click();
  await page.locator('#following .pc-editor button', { hasText: 'Stop following' }).first().click();
  await page.waitForFunction(() => /Nothing yet/.test(document.querySelector('#following').textContent));
  eq((await pat.okay('GET', 'marks')).follows.length, 0, 'stopped on the server');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('the menu signed in: My Profile, the Parent Portal button, Kids’ Playground; the overview says where to start and how far each part has got', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('portal'), 'Pat', 'Lee');
  const { entry } = pickupPair();
  await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/');
  const nav = page.locator('header.sitebar nav');
  eq(flat(await nav.locator('a.nav-acct').innerText()), 'My Profile'); matches(await nav.locator('a.nav-acct').getAttribute('href'), /profile\/$/);
  matches(flat(await nav.locator('a.nav-cta.when-in').innerText()), /^Parent Portal( \(something new\))?$/); matches(await nav.locator('a.nav-cta.when-in').getAttribute('href'), /account\/$/);
  eq(flat(await nav.locator('a.nav-kc').textContent()).toLowerCase(), 'kids’ playground', 'its full name, for screen readers'); eq(await nav.locator('a.nav-kc .vh').textContent(), 'Kids’ ', 'the button itself just says Playground'); matches(await nav.locator('a.nav-kc').getAttribute('href'), /kids-playground\/$/);
  eq(await nav.locator('a', { hasText: /^Account$/ }).count(), 0, 'no separate Account link');
  const order = await nav.evaluate(n => [...n.children].map(c => c.className).filter(c => /nav-(acct|cta|kc)/.test(c) && !/when-out/.test(c)));
  ok(order.join(' ').indexOf('nav-acct') < order.join(' ').indexOf('nav-cta') && order.join(' ').indexOf('nav-cta') < order.join(' ').indexOf('nav-kc'), 'My Profile, then Parent Portal, then Kids’ Playground: ' + order.join(' | '));
  ok(await nav.locator('a.nav-cta.when-in .news-dot').isVisible(), 'a dot for news not yet seen');
  // The Parent Portal: the overview first.
  await nav.locator('a.nav-cta.when-in').click();
  await page.waitForSelector('#overview .ov-card');
  const cards = (await page.locator('#overview .ov-card b').allInnerTexts()).map(x => flat(x).toLowerCase());   // the Kids’ Playground card is in capitals
  for (const want of ['Build your kids’ week', 'Plan your days off', 'Update your profile', 'Manage your to-do list', 'Build your year calendar', 'Have your kids play', 'Plan your summer', 'Help the site keep going']) ok(cards.includes(want.toLowerCase()), 'a card for ' + want + ': ' + cards.join(', '));
  await page.waitForFunction(() => /week kept/.test((document.querySelector('#overview .ov-week .ov-state') || {}).textContent || ''));
  includes(flat(await page.locator('#overview .ov-week .ov-state').innerText()), '1 week kept');
  includes(flat(await page.locator('#overview .ov-summer .ov-state').innerText()), 'Not started');
  matches(await page.locator('#overview .ov-kids').getAttribute('href'), /kids-playground\/$/);
  // Kids' Playground: a card like the others, with where it has got to.
  const kidsState = () => page.locator('#overview .ov-kids .ov-state').innerText().then(flat);
  await page.waitForFunction(() => /\S/.test((document.querySelector('#overview .ov-kids .ov-state') || {}).textContent || ''));
  eq(await kidsState(), 'Add your kids first');
  ok(!/kids/.test(await page.locator('#overview .ov-kids').evaluate(a => getComputedStyle(a).backgroundColor === 'rgb(15, 77, 144)' ? 'kids' : '')), 'not dark like a button');
  ok(await page.locator('#new').isVisible(), 'What’s new is on the overview');
  ok(!(await nav.locator('a.nav-cta.when-in .news-dot').isVisible()), 'seen: the dot goes');
  // Update your profile goes to the profile.
  matches(await page.locator('#overview .ov-profile').getAttribute('href'), /profile\/$/);
  // Names given, the week's program waits to be confirmed; confirmed and a bulb picked, the child is playing.
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '3' }] });
  const waitKids = re => page.waitForFunction(r => new RegExp(r).test((document.querySelector('#overview .ov-kids .ov-state') || {}).textContent || ''), re.source);
  await page.goto(page.url().replace(/#.*$/, '')); await waitKids(/to confirm|Not started/);
  const pk = (await pat.okay('GET', 'passport')).kids[0];
  eq(await kidsState(), pk.suggest.length ? (pk.suggest.length === 1 ? '1 class to confirm' : pk.suggest.length + ' classes to confirm') : 'Not started');
  await pat.okay('POST', 'passport_save', { kid: 'Sam', done: pk.suggest.map(x => ({ k: x.k, kind: x.kind, y: x.y, s: x.s || '' })), av: { b: 'globe', c: 2 } });
  await page.reload(); await waitKids(/Playing/);
  eq(await kidsState(), '✓ Playing');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('a program manager who also plans for kids keeps Parent Portal and Kids’ Playground, with their listings beside them; one who doesn’t gets the manager’s button', async (ctx) => {
  const b = await ctx.browser();
  const both = ctx.api().as(someone('mgrpar'), 'Pat', 'Lee', 'managers');
  await both.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '2' }] });
  const me = await both.okay('GET', 'me');
  eq(me.user.role, 'manager'); eq(me.user.family, true, 'kids named: a family');
  const t = await b.context(ctx.site, { sid: both.cookie });
  // A device that last heard of a manager with no family (signed in before the kids were named): the first page that
  // asks the server puts the parent's menu back there and then, not on the next page.
  const page = await t.open('/about/');
  await page.evaluate(() => { localStorage.setItem('pas-in', '1'); localStorage.setItem('pas-role', 'manager'); localStorage.removeItem('pas-parent'); });
  await page.goto(ctx.site.base + '/profile/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /^Parent Portal/.test((document.querySelector('header.sitebar nav a.nav-cta.when-in') || {}).textContent || '') && !!document.querySelector('header.sitebar nav a.nav-mgr'), null, { timeout: 8000 });
  ok(await page.locator('header.sitebar nav a.nav-kc').isVisible(), 'Kids’ Playground back on the same page');
  await page.goto(ctx.site.base + '/account/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#overview .ov-card');
  eq(await page.locator('.acct-tabs [aria-current="page"]').innerText(), 'Overview', 'a parent’s overview');
  const nav = page.locator('header.sitebar nav');
  matches(flat(await nav.locator('a.nav-cta.when-in').innerText()), /^Parent Portal/, 'the button stays');
  ok(await nav.locator('a.nav-kc').isVisible(), 'Kids’ Playground stays');
  eq(await nav.locator('a.nav-mgr').count(), 1, 'their listings get a link of their own');
  await t.close();
  // A manager with no kids and no plans: the button is about their listing, and the account opens on Details.
  const pro = ctx.api().as(someone('mgronly'), 'Dana', 'Reyes', 'managers');
  const t2 = await b.context(ctx.site, { sid: pro.cookie });
  const p2 = await t2.open('/about/');
  await p2.evaluate(() => { localStorage.setItem('pas-in', '1'); localStorage.setItem('pas-role', 'manager'); localStorage.setItem('pas-parent', '1'); });   // told wrong: it's put right
  await p2.goto(ctx.site.base + '/account/', { waitUntil: 'networkidle' });
  await p2.waitForSelector('#account .acct-tabs');
  await p2.waitForFunction(() => !document.querySelector('header.sitebar nav a.nav-mgr'), null, { timeout: 8000 });
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.waitForSelector('#account .acct-tabs');
  eq(await p2.locator('.acct-tabs [aria-current="page"]').innerText(), 'Account');
  eq(await p2.locator('.acct-tabs [data-tab-go="overview"]').count(), 0, 'no overview tab');
  matches(flat(await p2.locator('header.sitebar nav a.nav-cta.when-in').innerText()), /Your listings|Go premium/);
  ok(!(await p2.locator('header.sitebar nav a.nav-kc').isVisible()), 'no Kids’ Playground button');
  eq(t.errors.length + t2.errors.length, 0, t.errors.concat(t2.errors).join(' | '));
  await t2.close();
});
