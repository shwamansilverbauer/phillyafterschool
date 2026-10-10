// Tells search engines that take IndexNow (Bing and the ones that share its index) which pages changed, right after
// a publish. It compares the sitemap just built with the one the live site was serving before this publish, and
// sends only the addresses that are new or whose date moved. It never fails a publish: any problem is printed and
// the job carries on. The key is not a secret: it is a file at the site's root (written by build.mjs) that lets the
// search engine check the note came from this site.
//   node scripts/indexnow.mjs before.xml dist/sitemap.xml          send
//   node scripts/indexnow.mjs before.xml dist/sitemap.xml --dry    only say what would be sent
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const [before, after] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const dry = process.argv.includes('--dry');
const read = f => { const m = new Map(); let x = ''; try { x = fs.readFileSync(f, 'utf8'); } catch { return m; } for (const u of x.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]*)<\/lastmod>)?<\/url>/g)) m.set(u[1], u[2] || ''); return m; };
export const changed = (was, now) => [...now].filter(([u, d]) => !was.has(u) || (d && was.get(u) !== d)).map(([u]) => u);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const key = cfg.indexNowKey || '';
    if (!/^[a-f0-9]{32}$/.test(key)) { console.log('No indexNowKey in site.config.json, so nothing is sent.'); process.exit(0); }
    const was = read(before), now = read(after);
    if (!now.size) { console.log('The new sitemap could not be read, so nothing is sent.'); process.exit(0); }
    if (!was.size) { console.log('There was no earlier sitemap to compare with, so nothing is sent this time.'); process.exit(0); }
    const list = changed(was, now).slice(0, 2000);
    console.log(`${list.length} of ${now.size} pages are new or changed.`);
    if (!list.length || dry) { if (dry) for (const u of list.slice(0, 20)) console.log('  ' + u); process.exit(0); }
    const host = new URL(cfg.siteUrl).host;
    const r = await fetch(process.env.INDEXNOW_API || 'https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ host, key, keyLocation: `${cfg.siteUrl}/${key}.txt`, urlList: list }) });
    console.log(`IndexNow answered ${r.status}.`);
  } catch (e) { console.log('IndexNow could not be told: ' + (e.message || e)); }
}
