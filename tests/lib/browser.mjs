// Playwright, found wherever it is installed (PLAYWRIGHT_DIR, a global install, or the usual place on the build
// machine). The browser tests need it; the API and build tests run without it.
import { createRequire } from 'node:module';
import { NOW, Failure } from './harness.mjs';
const require = createRequire(import.meta.url);

export function playwright() {
  for (const p of [process.env.PLAYWRIGHT_DIR, 'playwright', '/opt/npm-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Failure('Playwright not found: npm i -g playwright && npx playwright install chromium, or set PLAYWRIGHT_DIR');
}

// Hosts a page may try to reach that are not the test site: analytics, Google sign-in, fonts, maps.
// Every such request is recorded and refused, so a test can say "this page called nobody".
const OUTSIDE = /^https?:\/\/(?!127\.0\.0\.1)/;

export async function launch() {
  const pw = playwright();
  const opts = {};
  if (process.env.PAS_CHROMIUM) opts.executablePath = process.env.PAS_CHROMIUM;
  const browser = await pw.chromium.launch(opts);
  const live = new Set();   // contexts still open, for a screenshot when a test fails
  return {
    browser, live,
    // A fresh browser profile, on the fixed day, signed in when given a session cookie.
    async context(site, { sid = '', width = 1100, height = 900, mobile = false } = {}) {
      const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width, height }, deviceScaleFactor: 1, timezoneId: 'America/New_York', locale: 'en-US', isMobile: mobile, hasTouch: mobile });
      const outside = [];
      // Each outside request is kept with what it carried (the body, for a POST), then refused.
      await ctx.route(u => OUTSIDE.test(u.href), route => { const r = route.request(); outside.push(Object.assign(new String(r.url()), { url: r.url(), method: r.method(), body: r.postData() || '' })); route.abort(); });
      // Signed in: the session cookie, and the mark the pages keep on the device to know someone is signed in.
      if (sid) { await ctx.addCookies([{ name: 'pas_s', value: sid, domain: '127.0.0.1', path: '/' }]); await ctx.addInitScript(() => { try { if (!localStorage.getItem('pas-in')) localStorage.setItem('pas-in', '1'); } catch (e) { /* storage blocked */ } }); }
      const errors = [];
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(String(e && e.message || e)));
      page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });   // refused outside requests log as failed loads: not errors of the page's own
      await page.clock.setFixedTime(NOW);
      const open = async (rel, wait = 'networkidle') => { await page.goto(site.base + rel, { waitUntil: wait }); return page; };
      const t = { ctx, page, outside, errors, open,
        text: async sel => (await page.locator(sel).innerText()).replace(/\s+/g, ' ').trim(),
        close: () => { live.delete(t); return ctx.close(); } };
      live.add(t);
      return t;
    },
    close: () => browser.close(),
  };
}
