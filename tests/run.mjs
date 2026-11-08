// Runs the tests. Everything happens on this machine against a copy of the site built for one fixed day;
// nothing reaches phillyafterschool.org or any outside service.
//
//   node tests/run.mjs               everything
//   node tests/run.mjs api           only test files whose name contains "api" (any number of filters)
//   node tests/run.mjs --keep        leave the local server up afterwards and print its address
//   node tests/run.mjs --list        list the tests without running them
//
// The browser tests need Playwright (see tests/lib/browser.mjs); without it they are reported as skipped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allTests, setFile, startStandin, startSite, client, Failure } from './lib/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const keep = args.includes('--keep'), list = args.includes('--list');
const filters = args.filter(a => !a.startsWith('--'));
const files = fs.readdirSync(path.join(here, 'cases')).filter(f => f.endsWith('.mjs')).sort().filter(f => !filters.length || filters.some(x => f.includes(x)));
if (!files.length) { console.error('no test files match', filters); process.exit(2); }
for (const f of files) { setFile(f); await import(path.join(here, 'cases', f)); }
const tests = allTests();
if (list) { for (const t of tests) console.log(`${t.file}: ${t.name}`); process.exit(0); }

const scratch = process.env.PAS_TEST_DIR || path.join(here, '.scratch');
fs.mkdirSync(scratch, { recursive: true });
const log = m => console.log('  · ' + m);
const standin = await startStandin();
const site = await startSite({ scratch, standin, log });
let browser = null;
const ctx = {
  site, standin, mail: standin.mail, google: standin.google, push: standin.push, github: standin.github,
  api: () => client(site, standin),
  async browser() {
    if (browser === null) { const { launch } = await import('./lib/browser.mjs'); try { browser = await launch(); } catch (e) { browser = e; } }
    if (browser instanceof Error) throw Object.assign(new Failure(browser.message), { skip: true });
    return browser;
  },
  scratch, shots: path.join(scratch, 'shots'),
};
fs.mkdirSync(ctx.shots, { recursive: true });

let passed = 0, failed = 0, skipped = 0;
const failures = [];
const TIMEOUT = 90000;
for (const t of tests) {
  const t0 = Date.now();
  let timer;
  try {
    await Promise.race([t.fn(ctx), new Promise((_, rej) => { timer = setTimeout(() => rej(new Failure(`took longer than ${TIMEOUT / 1000}s`)), TIMEOUT); })]);
    passed++;
    console.log(`✓ ${t.name} (${Date.now() - t0} ms)`);
  } catch (e) {
    if (e && e.skip) { skipped++; console.log(`– ${t.name}: skipped, ${e.message}`); }
    else {
      failed++;
      const where = e instanceof Failure ? '' : ` [${e && e.name}]`;
      console.log(`✗ ${t.name}${where}: ${e && e.message}`);
      failures.push({ t, e });
      if (browser && !(browser instanceof Error)) {   // what the browser was looking at when it failed
        let n = 0;
        for (const c of [...browser.live]) { try { const f = path.join(ctx.shots, `${t.file.replace(/\.mjs$/, '')}-${failed}-${++n}.png`); await c.page.screenshot({ path: f, fullPage: true }); console.log(`  screenshot: ${f} (${c.page.url()})`); } catch (err) { /* page gone */ } await c.close().catch(() => {}); }
      }
    }
  } finally { clearTimeout(timer); }
}
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped, ${tests.length} in all`);
for (const { t, e } of failures) { console.log(`\n--- ${t.file}: ${t.name}\n${e && e.stack ? e.stack.split('\n').slice(0, 8).join('\n') : e}`); }
if (failed) console.log(`\nServer log: ${site.logFile}\nScreenshots, if any: ${ctx.shots}`);
if (browser && !(browser instanceof Error)) await browser.close();
if (keep) { console.log(`\nLeft running: ${site.base} (data in ${site.dataDir}); stop it with: pkill -x php`); await standin.stop(); process.exit(failed ? 1 : 0); }
await site.stop();
await standin.stop();
process.exit(failed ? 1 : 0);
