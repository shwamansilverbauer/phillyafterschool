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

test('quiet pages: signed in, the account and profile pages run no analytics, and the email list hears nothing about a child', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('quiet'), 'Pat', 'Lee');
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  await pat.okay('POST', 'week_save', { week: { name: 'Zelphina', now: Object.fromEntries(DAYS.map(d => [d, []])), next: Object.fromEntries(DAYS.map(d => [d, []])) } });
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Zelphina', g: '2' }, { n: 'Thaddeus', a: '9' }] });
  const t = await b.context(ctx.site, { sid: pat.cookie });
  for (const rel of ['/account/', '/profile/', '/account/#plans']) {
    const page = await t.open(rel);
    await page.waitForSelector('#account .acct-tabs');
    await page.waitForTimeout(400);   // the list subscription goes out after the page is drawn
    const called = t.outside.filter(u => /googletagmanager|google-analytics|clarity\.ms|static\.klaviyo|klaviyo\.com\/onsite/.test(u));
    eq(called.length, 0, `${rel} ran analytics: ${called.join(', ')}`);
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
