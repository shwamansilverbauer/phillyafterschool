// The pages in a browser: they load clean, the sign-up notice sits where it should, quiet pages call nobody,
// and signing in through the page works end to end.
import { test, ok, eq, includes, excludes, matches, someone, codeIn } from '../lib/harness.mjs';
import { schools, programs } from '../lib/data.mjs';

const ANALYTICS = /googletagmanager|google-analytics|clarity\.ms|klaviyo/;

test('the home page loads without errors, the school finder finds a school, and analytics loads only there', async (ctx) => {
  const b = await ctx.browser();
  const t = await b.context(ctx.site);
  const page = await t.open('/');
  eq(t.errors.length, 0, 'no page errors: ' + t.errors.join(' | '));
  ok(t.outside.some(u => ANALYTICS.test(u)), 'the home page asked for the tag manager (a public page)');
  const s = schools()[0];
  await page.fill('#find-school', s.shortName.slice(0, 6));
  await page.waitForSelector('.finder-list li, .finder-list a', { timeout: 5000 });
  const hits = await page.locator('.finder-list').innerText();
  includes(hits, s.shortName, 'the finder lists the school');
  await t.close();
});

test('a school page, a program page, the camps and the weekend list load without errors', async (ctx) => {
  const b = await ctx.browser();
  const t = await b.context(ctx.site);
  const s = schools()[0], p = programs().find(x => Object.keys(x.schools || {}).includes(s.id)) || programs()[0];
  for (const rel of [`/${s.id}/`, `/programs/${p.id}/`, '/summer-camps/', '/weekends/', '/days-off/', '/privacy/']) {
    const page = await t.open(rel);
    eq(t.errors.length, 0, `${rel}: ${t.errors.join(' | ')}`);
    const h1 = await page.locator('h1').first().innerText();
    ok(h1.trim().length > 0, `${rel} has a heading`);
  }
  const school = await t.open(`/${s.id}/`);
  const cards = await school.locator('[data-search]').count();
  ok(cards > 0, 'the school page lists programs');
  await t.close();
});

test('the privacy page says what the account notice promises: encryption, no public page, co-parents', async (ctx) => {
  const b = await ctx.browser();
  const t = await b.context(ctx.site);
  const page = await t.open('/privacy/');
  const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  matches(text, /encrypted/i, 'encryption at rest');
  matches(text, /co-parent/i, 'co-parents');
  matches(text, /nothing is sold|never sold|not sold|don.t sell/i, 'nothing sold');
  await t.close();
});

test('the sign-up page: the notice about your info and your kids’ info sits at the foot of the sign-in card', async (ctx) => {
  const b = await ctx.browser();
  const t = await b.context(ctx.site);
  const page = await t.open('/register/');
  await page.waitForSelector('#acct-notice:not([hidden])');
  const notice = page.locator('#acct-notice');
  const text = (await notice.innerText()).replace(/\s+/g, ' ');
  includes(text, 'How we use your info:'); includes(text, 'How we use your kids’ info:'); includes(text, 'we don’t');
  includes(text, 'encrypted'); includes(text, 'no public link and no public page'); includes(text, 'Who can see what');
  // It is inside the sign-in card, after the email form.
  const placed = await page.evaluate(() => {
    const n = document.getElementById('acct-notice'), card = n.closest('.signin'), form = card && card.querySelector('form.signin-row');
    return { inCard: !!card, afterForm: !!form && !!(form.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING), link: n.querySelector('a') && n.querySelector('a').getAttribute('href') };
  });
  ok(placed.inCard, 'inside the sign-in card'); ok(placed.afterForm, 'under the email form');
  matches(placed.link || '', /privacy\/#groups$/, 'the link goes to "Who can see what"');
  // Under Google's button, what Google passes on (its slot is there even when Google's script can't load).
  const g = await page.evaluate(() => { const n = document.getElementById('acct-google'); return n && n.previousElementSibling && n.previousElementSibling.className; });
  eq(g, 'g-google', 'the Google hint sits right under the Google button');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('signing in through the page: the code from the email lands a new account on "Finish your account"', async (ctx) => {
  const b = await ctx.browser();
  const t = await b.context(ctx.site);
  const page = await t.open('/register/');
  const email = someone('web');
  await page.fill('.signin input[type=email]', email);
  await page.click('.signin button:has-text("Email me a code")');
  const m = await ctx.mail.waitFor(email, /sign-in/i);
  await page.waitForSelector('.signin-code:not([hidden]) input.code-input');
  await page.fill('.signin-code input.code-input', codeIn(m));
  await page.click('.signin-code button:has-text("Sign in")');
  await page.waitForURL(/\/profile\//, { timeout: 10000 });
  await page.waitForSelector('text=Finish your account');
  const text = (await page.locator('#account').innerText()).replace(/\s+/g, ' ');
  includes(text, email, 'signed in as the address');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('Account Features: a menu of its own for someone signed out, a page for each feature, About a plain link again', async (ctx) => {
  const b = await ctx.browser();
  const flat = x => x.replace(/\s+/g, ' ').trim();
  const t = await b.context(ctx.site);
  const home = await t.open('/');
  const menu = home.locator('header.sitebar details.nav-feat');
  eq(flat(await menu.locator('summary').innerText()), 'Account Features');
  const items = await menu.locator('a').evaluateAll(as => as.map(a => a.textContent.trim() + ' ' + a.getAttribute('href')));
  eq(items.join(' | '), 'All Account Features features/ | Calendar & Sharing features/calendar/ | Parent Portal features/parent-portal/ | Kids’ Playground features/kids-playground/');
  eq(await home.locator('header.sitebar details.menu[data-top$="about/"]').count(), 0, 'About is not a menu');
  eq(await home.locator('header.sitebar nav > a.nav-more[href$="about/"]').count(), 1, 'About is a link');
  includes(flat(await home.locator('footer .foot-cols').innerText()), 'ACCOUNT FEATURES');
  // The page that leads to all three, and each feature's own page with cards to the other two.
  const index = await t.open('/features/');
  eq(await index.locator('.feat > .feat-cards .feat-card').count(), 3);
  for (const [f, h1] of [['calendar', 'Calendar & sharing'], ['parent-portal', 'Parent Portal'], ['kids-playground', 'Kids’ Playground']]) {
    const page = await t.open(`/features/${f}/`);
    eq(flat(await page.locator('h1').innerText()).toLowerCase(), h1.toLowerCase(), f);
    eq(await page.locator('.feat-more .feat-card').count(), 2, f + ' leads to the other two');
    ok(await page.locator('a.btn[href*="register/"]').first().isVisible(), f + ' offers the account');
    eq(await page.locator('header.sitebar details.nav-feat.here').count(), 1, f + ': the menu shows where you are');
  }
  // Kids' Playground's page says nothing there is counted, so it runs no analytics either.
  const before = t.outside.length;
  const kc = await t.open('/features/kids-playground/');
  eq(t.outside.slice(before).filter(u => ANALYTICS.test(u)).length, 0, 'no analytics on the Kids’ Playground page');
  includes(flat(await kc.locator('#for-kids').innerText()), 'A CORNER JUST FOR YOU');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
  // Signed in, the Parent Portal and Kids' Playground buttons take its place.
  const pat = ctx.api().as(someone('feat'), 'Pat', 'Lee');
  const t2 = await b.context(ctx.site, { sid: pat.cookie });
  const p2 = await t2.open('/');
  ok(!(await p2.locator('header.sitebar details.nav-feat').isVisible()), 'no Account Features menu signed in');
  eq(t2.errors.length, 0, t2.errors.join(' | '));
  await t2.close();
});

test('each list starts with its question (the school, or a ZIP code that puts the closest first), and the week builder with the school', async (ctx) => {
  const b = await ctx.browser();
  const t = await b.context(ctx.site, { width: 390, height: 844, mobile: true });
  // After school: which school. Answered, it's one line, the list is narrowed, and it's "my school" from then on.
  let page = await t.open('/programs/');
  ok(await page.locator('.focus .focus-ask').isVisible(), 'the after-school list asks for the school');
  const everything = await page.locator('#count').innerText();
  const sid = await page.locator('#focus-pick option').nth(1).getAttribute('value');
  await page.selectOption('#focus-pick', sid);
  ok(await page.locator('.focus .focus-on').isVisible(), 'answered, the question is one line');
  matches(await page.locator('#count').innerText(), /works for /, 'and the list shows what works for that school');
  includes(await page.evaluate(() => localStorage.getItem('pas-my-school') || ''), `"id":"${sid}"`, 'kept as this device’s school');
  await page.reload();
  ok(await page.locator('.focus .focus-on').isVisible(), 'still answered after a reload');
  await page.locator('.focus-wide').click();
  ok(await page.locator('.focus .focus-ask').isVisible(), '"Every school" asks again');
  eq(await page.locator('#count').innerText(), everything, 'with the whole list back');
  // Day camps, a day off, weekend classes and summer camps: a ZIP code puts the closest first and hides nothing; one
  // ZIP code serves every list, and it stays in the browser.
  // Closest first inside each section (a list under headings keeps its headings, the one with the nearest place first).
  const closestFirst = async (what) => {
    const runs = await page.evaluate(() => {
      const by = new Map();
      for (const it of document.querySelectorAll('[data-item]:not([hidden])')) { const p = it.querySelector('.mi-pill'); if (!p) continue; if (!by.has(it.parentNode)) by.set(it.parentNode, []); by.get(it.parentNode).push(/Under/.test(p.textContent) ? 0 : parseFloat(p.textContent)); }
      return [...by.values()];
    });
    ok(runs.flat().length > 2, what + ': distances shown');
    for (const mi of runs) ok(mi.every((m, i) => i === 0 || m >= mi[i - 1]), what + ', closest first: ' + mi.join(', '));
    const firsts = runs.map(r => r[0]);
    ok(firsts.every((m, i) => i === 0 || m >= firsts[i - 1]), what + ', the section with the closest place first: ' + firsts.join(', '));
  };
  page = await t.open('/day-camps/');
  ok(await page.locator('.focus .focus-ask').isVisible(), 'the day-camp list asks for a ZIP code');
  const allCamps = await page.locator('#count').innerText();
  await page.fill('#focus-zip', '00000'); await page.locator('.focus form button[type=submit]').click();
  matches(await page.locator('.focus-say').innerText(), /isn’t one this site knows/, 'a ZIP code it doesn’t know is said plainly');
  await page.fill('#focus-zip', '19147'); await page.locator('.focus form button[type=submit]').click();
  includes(await page.locator('.focus-name').innerText(), '19147', 'answered with the ZIP code');
  eq(await page.locator('#count').innerText(), allCamps, 'nothing is filtered out, only put in order');
  await closestFirst('day camps');
  for (const u of ['/weekends/', '/summer-camps/']) {
    page = await t.open(u);
    ok(await page.locator('.focus .focus-on').isVisible(), u + ' already knows the ZIP code');
    includes(await page.locator('.focus-name').innerText(), '19147');
    await closestFirst(u);
  }
  ok(!t.outside.some(u => /19147/.test(u)), 'the ZIP code went nowhere');
  eq(t.errors.length, 0, 'no page errors: ' + t.errors.join(' | '));
  await t.close();
  // The week builder, signed in, with no school saved: it asks, then says where it starts from.
  const pat = ctx.api().as(someone('focus'), 'Pat', 'Lee');
  const t2 = await b.context(ctx.site, { sid: pat.cookie, width: 390, height: 844, mobile: true });
  page = await t2.open('/board/');
  await page.waitForSelector('#board-focus .focus-ask', { state: 'visible' });
  await page.selectOption('#board-focus-pick', schools()[0].id);
  ok(await page.locator('#board-focus .focus-on').isVisible(), 'the week builder starts from the school picked');
  includes(await page.locator('#board-focus .focus-name').innerText(), schools()[0].shortName);
  eq(await page.locator('#explore-school').inputValue(), schools()[0].id, 'and browsing starts there too');
  await t2.close();
});

test('a phone gets one “Put it on your home screen” card after something worth coming back to, never again after No thanks, and a computer never does', async (ctx) => {
  const b = await ctx.browser();
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const flat = s => s.replace(/\s+/g, ' ').trim();
  const sid = schools()[0].id;
  const t = await b.context(ctx.site, { mobile: true, userAgent: IPHONE });
  let page = await t.open('/' + sid + '/');
  await page.waitForTimeout(500);
  eq(await page.locator('#homecard').count(), 0, 'nothing before anything is done');
  await page.locator('[data-my-school]').first().click();   // saving the school is worth coming back to
  await page.waitForSelector('#homecard', { timeout: 8000 });
  const text = flat(await page.locator('#homecard').innerText());
  includes(text, 'Put Philly After School on your home screen'); includes(text, 'Add to Home Screen'); includes(text, 'notifications');
  await page.locator('#homecard .homecard-no').click();
  eq(await page.locator('#homecard').count(), 0, 'No thanks closes it');
  includes(await page.evaluate(() => localStorage.getItem('pas-home') || ''), '"off":1', 'and it is remembered');
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-my-school]').first().click(); await page.locator('[data-my-school]').first().click();
  await page.waitForTimeout(3500);
  eq(await page.locator('#homecard').count(), 0, 'never again after No thanks');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
  // A computer: nothing, however much is saved.
  const t2 = await b.context(ctx.site);
  page = await t2.open('/' + sid + '/');
  await page.locator('[data-my-school]').first().click();
  await page.waitForTimeout(3500);
  eq(await page.locator('#homecard').count(), 0, 'no card on a computer');
  await t2.close();
});

test('quiet pages: signed in, the account and profile pages run no analytics, and the email list hears nothing about a child', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('quiet'), 'Pat', 'Lee');
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  await pat.okay('POST', 'week_save', { week: { name: 'Zelphina', now: Object.fromEntries(DAYS.map(d => [d, []])), next: Object.fromEntries(DAYS.map(d => [d, []])) } });
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Zelphina', g: '2' }, { n: 'Thaddeus', a: '9' }] });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  for (const rel of ['/account/', '/profile/', '/account/#plans', '/kids-playground/', '/calendar/', '/to-do/']) {
    const page = await t.open(rel);
    if (rel.startsWith('/kids-playground')) await page.waitForSelector('#kc-app:not([hidden])');
    else if (rel.startsWith('/calendar') || rel.startsWith('/to-do')) await page.waitForFunction(() => { const w = document.querySelector('#year-wait, #todo-wait'); return !w || w.hidden; }, null, { timeout: 10000 });
    else await page.waitForSelector('#account .acct-tabs');
    await page.waitForTimeout(400);   // the list subscription goes out after the page is drawn
    const called = t.outside.filter(u => /googletagmanager|google-analytics|clarity\.ms|static\.klaviyo|klaviyo\.com\/onsite/.test(u));
    eq(called.length, 0, `${rel} ran analytics: ${called.join(', ')}`);
    // Nothing else leaves the page either (no fonts from Google, no outside scripts): only the adult's email-list
    // sign-up, which the account page sends once.
    const elsewhere = t.outside.filter(u => !/^https:\/\/a\.klaviyo\.com\/client\//.test(u));
    eq(elsewhere.length, 0, `${rel} asked another site for something: ${elsewhere.join(', ')}`);
    // The email list is told about the adult (that is what "news about the site" is), never about a child.
    for (const r of t.outside.filter(u => /a\.klaviyo\.com/.test(u))) {
      includes(r.body, pat.email, 'the list hears the adult’s address');
      excludes(r.body, 'Zelphina', 'nothing about a child'); excludes(r.body, 'Thaddeus');
    }
    const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src).filter(Boolean));
    ok(!scripts.some(s => ANALYTICS.test(s)), `${rel} has an analytics script tag`);
    ok(!(await page.evaluate(() => Array.isArray(window.dataLayer) && window.dataLayer.length > 0)), `${rel} wrote to the data layer`);
  }
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});
