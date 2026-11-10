// Draws the site's link-preview pictures (1200 by 630, the size the apps show when a link is texted or posted), and
// posts for social media, from a build in dist/ so they stay in step with the site's words, colours and type. Each
// is the site's own sky with the logo at the top left, a headline, a line under it and a page's drawing along the
// bottom.
//
//   node build.mjs && node scripts/share-pictures.js          the two site-wide pictures: src/static/share.png and
//                                                              src/static/share-days-off.png, which the build uses
//   node scripts/share-pictures.js --pages                    one for each page the build gave its own picture
//                                                              (shareImage: { page: true }): dist/share/<path>.png
//   node scripts/share-pictures.js --post <page> [out folder] posts for a page, e.g. days-off/veterans-day-2026-11-11:
//                                                              a 1080 by 1350 one for a feed and a 1080 by 1920 story,
//                                                              with the outlined Eddie (eddie.png) in his sunglasses
//
// A page's picture and post say what the page itself says: its headline and its first line, as Rachael and the
// /edit/ pages have them, read from the built page. The publish workflow draws the pages' pictures after the tests,
// so they follow every change; if one cannot be drawn, the site-wide picture stands in for it, so no link ever
// shows a broken preview.
//
// Needs Playwright with Chromium. The site itself has no dependencies, so Playwright is looked for where it is
// installed (beside the site, a global install, or PLAYWRIGHT_DIR). Nothing is fetched from the network: the fonts,
// the logo and Eddie come from dist/.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const playwright = () => { for (const p of [process.env.PLAYWRIGHT_DIR, path.join(ROOT, 'node_modules/playwright'), 'playwright', '/opt/npm-tools/node_modules/playwright'].filter(Boolean)) { try { return require(p); } catch (e) { /* next */ } } throw new Error('Playwright not found: set PLAYWRIGHT_DIR'); };
const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = s => s.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const text = h => unesc(h.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const scene = (html, cls) => { const m = html.match(new RegExp(`<svg class="street${cls ? ' ' + cls : ''}[\\s\\S]*?<\\/svg>`)); return m ? m[0] : null; };
const HOME = fs.existsSync(path.join(DIST, 'index.html')) ? fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') : '';
const ART = { go: 196, dayscene: 236, summerscene: 236, wkndscene: 236 };

// What a built page says: its headline, the line under it (the whole first paragraph if it fits in two lines on the
// picture, else its first sentence), and its drawing (a page without one gets the home page's street).
function pageWords(rel) {
  const html = fs.readFileSync(path.join(DIST, rel, 'index.html'), 'utf8');
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
  if (!h1) throw new Error('no headline on ' + rel);
  const after = html.slice(html.indexOf(h1) + h1.length);
  const p = (after.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
  let art = scene(html), kind = art && (art.match(/class="street (\w+)/) || [])[1];
  if (!art) { art = scene(HOME, 'go'); kind = 'go'; }
  return { headline: text(h1), line: text(p), art, height: ART[kind] || 236 };
}

// One picture. w by h; the headline is made smaller until the words clear the drawing, and the line drops to its first
// sentence when the whole of it would take more than two lines (or goes, if the headline still won't fit).
const picture = ({ headline, line, art, height }, w, h, opts = {}) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="site.css"><style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
  .pic{position:fixed;inset:0}
  .pic-text{position:absolute;left:${opts.pad || 96}px;right:${opts.pad || 96}px;top:${opts.top || 46}px;z-index:2}
  .pic-logo{display:block;height:${opts.logo || 72}px;width:auto}
  .pic h1{font-size:${opts.size || 80}px;margin:${opts.gap || 22}px 0 0;line-height:1.02;text-wrap:balance}
  .pic p{font-size:${opts.lineSize || 29}px;margin:14px 0 0;color:var(--hero-muted);line-height:1.3;text-wrap:pretty}
  .pic .street{position:absolute;left:0;right:0;bottom:0;height:${height * (opts.artScale || 1)}px;width:100%}
  .pic .street *{animation:none!important}
  .pic-url{position:absolute;left:${opts.pad || 96}px;bottom:${height * (opts.artScale || 1) + 30}px;z-index:2;font-family:var(--title);font-size:${opts.urlSize || 40}px;letter-spacing:.02em;color:var(--ink);background:#FFD43B;border:4px solid var(--ink);border-radius:999px;padding:12px 28px 6px;box-shadow:0 6px 0 var(--ink)}
  .pic-eddie{position:absolute;right:${opts.pad || 96}px;bottom:${height * (opts.artScale || 1) + 10}px;width:${opts.eddie || 0}px;z-index:2}
  .pic-eddie img,.pic-eddie svg{display:block;width:100%;height:auto}
  .pic-eddie svg{position:absolute;inset:0}
</style></head><body><div class="band pagehead pic">
  <div class="pic-text"><img class="pic-logo" src="../logo-sky.png" alt=""><h1>${esc(headline)}</h1>${line ? `<p>${esc(line)}</p>` : ''}</div>
  ${opts.url ? `<div class="pic-url">${esc(opts.url)}</div>` : ''}
  ${opts.eddie ? `<div class="pic-eddie"><img src="../eddie.png" alt="">${SHADES}</div>` : ''}
  ${art}
</div><script>
  window.fit = (bottom, size, min, full, first, most) => {
    const box = document.querySelector('.pic-text'), h1 = box.querySelector('h1'), p = box.querySelector('p');
    const lines = () => p ? Math.round(p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight)) : 0;
    if (p && lines() > most && first) p.textContent = first;
    const fits = () => box.getBoundingClientRect().bottom <= bottom;
    while (!fits() && size > min) { size -= 2; h1.style.fontSize = size + 'px'; }
    if (!fits() && p) p.remove();
    return { size, line: p && p.isConnected ? p.textContent : '', fits: fits() };
  };
</script></body></html>`;

// Eddie on a post is the original one from the logo, with the dark outline that stands out on the sky
// (src/static/eddie.png, 438 by 526, cut from the brand's light-background lockup). His sunglasses are the drawing the
// site puts on him when a plan is finished (cheer() in site.js), made for bulb.png's frame (327 by 400), so they are
// moved onto this Eddie's eye: about 1.23 times as big, and over and down a little.
const SHADES = (() => {
  const m = read('src/site.js').match(/var SHADES = ('[\s\S]*?');\n/); if (!m) return '';
  const svg = Function('return ' + m[1])().replace(/class="cheer-shades-on"/, '');
  return svg.replace('viewBox="0 0 327 400"', 'viewBox="0 0 438 526"').replace(/(<svg[^>]*>)([\s\S]*)(<\/svg>)/, '$1<g transform="translate(7 35) scale(1.227)">$2</g>$3');
})();

const firstSentence = s => { const m = s.match(/^.*?[.!?](?=\s|$)/); return m ? m[0] : s; };

async function draw(ctx, words, file, w, h, opts) {
  const tmp = path.join(DIST, 'assets', '.share-picture.html');
  fs.writeFileSync(tmp, picture(words, w, h, opts));
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: h });
  try {
    await p.goto('file://' + tmp);
    await p.evaluate(() => document.fonts.ready);
    const art = (opts.artScale || 1) * words.height;
    const room = opts.eddie ? h - art - 50 - opts.eddie * 1.2 : h - art - 6;   // the words stay clear of the drawing (and of Eddie, on a post)
    const got = await p.evaluate(([b, s, m, full, first, most]) => window.fit(b, s, m, full, first, most), [room, opts.size || 80, opts.min || 50, words.line, firstSentence(words.line), opts.lines || 2]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await p.screenshot({ path: file });
    return got;
  } finally { await p.close(); fs.rmSync(tmp, { force: true }); }
}

// The pages that point at a picture of their own and have none: the site-wide picture stands in, so a link never shows
// a broken preview, even when Playwright or Chromium can't run at all.
function standIns() {
  let n = 0;
  const walk = dir => { for (const e of fs.readdirSync(path.join(DIST, dir), { withFileTypes: true })) {
    if (e.isDirectory()) { walk(path.join(dir, e.name)); continue; }
    if (e.name !== 'index.html') continue;
    const m = fs.readFileSync(path.join(DIST, dir, e.name), 'utf8').match(/<meta property="og:image" content="[^"]*?\/(share\/[^"?]+\.png)/);
    if (!m || fs.existsSync(path.join(DIST, m[1]))) continue;
    fs.mkdirSync(path.join(DIST, 'share'), { recursive: true });
    fs.copyFileSync(path.join(DIST, dir.startsWith('days-off') ? 'share-days-off.png' : 'share.png'), path.join(DIST, m[1])); n++;
  } };
  walk('');
  if (n) console.log(`${n} page(s) got the site-wide picture instead of their own.`);
}

(async () => {
  const mode = process.argv[2] || '';
  const b = await playwright().chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
  await ctx.route(u => !String(u).startsWith('file:') && !String(u).startsWith('data:'), r => r.abort());   // nothing from the network
  try {
    if (mode === '--pages') {
      // Every built page whose preview is its own picture.
      const pages = [];
      const walk = dir => { for (const e of fs.readdirSync(path.join(DIST, dir), { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(dir, e.name)); else if (e.name === 'index.html') pages.push(dir); } };
      walk('');
      let drawn = 0, stood = 0;
      for (const rel of pages) {
        const html = fs.readFileSync(path.join(DIST, rel, 'index.html'), 'utf8');
        const m = html.match(/<meta property="og:image" content="[^"]*?\/(share\/[^"?]+\.png)/);
        if (!m) continue;
        const file = path.join(DIST, m[1]);
        try { const got = await draw(ctx, pageWords(rel), file, 1200, 630, { size: 100, min: 56, logo: 80, lineSize: 32, gap: 24, top: 44 }); drawn++; if (!got.fits) console.log('  (tight) ' + m[1]); }
        catch (e) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.copyFileSync(path.join(DIST, rel.startsWith('days-off') ? 'share-days-off.png' : 'share.png'), file); stood++; console.log('could not draw ' + m[1] + ' (' + e.message + '); the site-wide picture stands in'); }
      }
      console.log(`Drew ${drawn} page pictures${stood ? `; ${stood} stood in with the site-wide one` : ''}.`);
    } else if (mode === '--post') {
      const rel = (process.argv[3] || '').replace(/^\/+|\/+$/g, '');
      const out = process.argv[4] || path.join(ROOT, 'tests/.scratch/posts');
      const words = pageWords(rel), name = rel.replace(/\//g, '-');
      const url = 'phillyafterschool.org';
      for (const [w, h, tag, o] of [[1080, 1350, 'feed', { size: 140, min: 70, logo: 100, top: 70, pad: 80, gap: 34, lineSize: 44, lines: 3, eddie: 320, url, urlSize: 44, artScale: 1.3 }], [1080, 1920, 'story', { size: 150, min: 76, logo: 116, top: 230, pad: 80, gap: 40, lineSize: 50, lines: 4, eddie: 420, url, urlSize: 48, artScale: 1.7 }]]) {
        const file = path.join(out, `${name}-${tag}.png`);
        await draw(ctx, words, file, w, h, o);
        console.log('drew', file);
      }
    } else {
      // The two site-wide pictures, in the words they have always had.
      const home = pageWords(''), off = pageWords('days-off');
      for (const [file, words] of [
        ['src/static/share.png', { ...home, headline: 'School’s out. What now?', line: 'After-school programs are supposed to keep your kids busy, not you.' }],
        ['src/static/share-days-off.png', { ...off, headline: 'School’s closed. What now?', line: 'Day-off programs in Philadelphia, day by day.' }],
      ]) { await draw(ctx, words, path.join(ROOT, file), 1200, 630, { size: 86, logo: 84, gap: 30, lineSize: 31, top: 52, pad: 112 }); console.log('drew', file); }
    }
  } finally { await b.close(); }
})().catch(e => {
  console.error(e.message);
  if (process.argv[2] === '--pages') { standIns(); return; }   // the publish goes ahead, with the site-wide picture
  process.exit(1);
}).then(() => { if (process.argv[2] === '--pages') standIns(); });
