// Draws the two link-preview pictures (1200 by 630): src/static/share.png, shown when a link to the site is texted
// or posted, and src/static/share-days-off.png for the day-off pages. Both are the site's own sky with the logo
// at the top left, a headline, one line and the page's drawing along the bottom (the home page's street, the
// day-off page's scene), taken from a build in dist/ so they stay in step with the site's colours and type.
//
//   node build.mjs && node scripts/share-pictures.js
//
// Needs Playwright with Chromium. The site itself has no dependencies, so Playwright is looked for where it is
// installed (a global install, or PLAYWRIGHT_DIR) and the pictures are only redrawn when the logo, the headline
// or the site's colours change; the files in src/static/ are the ones the build uses.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pw = (() => { for (const p of [process.env.PLAYWRIGHT_DIR, 'playwright', '/opt/npm-tools/node_modules/playwright'].filter(Boolean)) { try { return require(p); } catch (e) { /* next */ } } throw new Error('Playwright not found: set PLAYWRIGHT_DIR'); })();
const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const scene = (page, cls) => { const m = read(page).match(new RegExp(`<svg class="${cls}[\\s\\S]*?<\\/svg>`)); if (!m) throw new Error('no ' + cls + ' in ' + page); return m[0]; };
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'src/static/logo-sky.png')).toString('base64');
const fonts = read('build.mjs').match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/)[0];
const css = read('dist/assets/site.css');

const picture = (headline, line, art, artHeight) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${fonts}"><style>${css}
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  .pic{position:fixed;inset:0;display:flex;flex-direction:column;justify-content:flex-start}
  .pic-text{padding:52px 112px 0;position:relative;z-index:2}   /* room on the left, and between the logo and the headline */
  .pic-logo{display:block;height:84px;width:auto}
  .pic h1{font-size:86px;margin:30px 0 0;line-height:1.02}
  .pic p{font-size:31px;margin:16px 0 0;color:var(--hero-muted);white-space:nowrap}
  .pic .street{position:absolute;left:0;right:0;bottom:0;height:${artHeight}px;width:100%}
  .pic .street.go *{animation:none!important}
</style></head><body><div class="band pagehead pic">
  <div class="pic-text"><img class="pic-logo" src="${logo}" alt="Philly After School"><h1>${headline}</h1><p>${line}</p></div>
  ${art}
</div></body></html>`;

(async () => {
  const b = await pw.chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
  await ctx.route(u => !/^fonts\.(googleapis|gstatic)\.com$/.test(new URL(u).hostname) && !u.startsWith('data:'), r => r.abort());
  const p = await ctx.newPage();
  for (const [file, html] of [
    ['src/static/share.png', picture('School’s out.<br>What now?', 'After-school programs are supposed to keep your kids busy, not you.', scene('dist/index.html', 'street go'), 196)],
    ['src/static/share-days-off.png', picture('School’s closed.<br>What now?', 'Day-off programs in Philadelphia, day by day.', scene('dist/days-off/index.html', 'street dayscene'), 236)],
  ]) {
    await p.setContent(html, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(ROOT, file) });
    console.log('drew', file);
  }
  await b.close();
})();
