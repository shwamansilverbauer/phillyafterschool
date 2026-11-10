// The free pre-read before the monthly check (scripts/precheck.mjs): run three times over a little site of its own,
// it says which pages are the same as when their listings were last confirmed, which changed and how, and it never
// requests a page robots.txt closes or one a person has to read.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test, ok, eq, deepEq, includes, ROOT } from '../lib/harness.mjs';

test('the pre-read: same, changed (with the lines), compared with the version on the day last confirmed, robots.txt and people respected, and a stalled page given up on', async () => {
  const pages = {
    '/robots.txt': 'User-agent: *\nDisallow: /closed\n',
    '/camp': '<html><head><title>x</title><script>var t = Date.now()</script></head><body><nav><a href="/">Home</a></nav><h1>Summer camp</h1><p>June 8 to August 28, 2027</p><p>$395 a week</p>' + Array.from({ length: 14 }, (_, i) => `<p>Week ${i + 1}</p>`).join('') + '<footer>© 2026 Camp</footer></body></html>',
    '/aftercare': '<html><body><h2>Pickup schools</h2><ul><li>Meredith</li><li>Nebinger</li></ul><p>3 to 6 pm</p>' + Array.from({ length: 14 }, (_, i) => `<p>Activity ${i + 1}</p>`).join('') + '</body></html>',
    '/app': '<html><body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript><p>Loading…</p></body></html>',
    '/closed': '<p>should never be read</p>',
    '/person': '<p>should never be read</p>',
  };
  const asked = [];
  const server = http.createServer((req, res) => {
    asked.push(req.url);
    const body = pages[req.url];
    if (req.url === '/slow') { res.writeHead(200, { 'content-type': 'text/html' }); res.write('<p>the start of a page that never ends'); return; }
    if (body === undefined) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': req.url === '/robots.txt' ? 'text/plain' : 'text/html; charset=utf-8' }); res.end(body);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'precheck-'));
  // Run it as its own process, and not synchronously: this process is the web server it reads.
  const run = async (today, confirmed) => {
    const check = { pages: [
      { url: base + '/aftercare', how: 'fetch', programs: ['p1'], lists: [{ program: 'p1', text: 'Meredith, Nebinger', read: confirmed }] },
      { url: base + '/closed', how: 'fetch', programs: ['p1'], lists: [] },
      { url: base + '/person', how: 'person', programs: ['p1'], lists: [] },
      { url: base + '/gone', how: 'fetch', programs: ['p1'], lists: [] },
      { url: base + '/slow', how: 'fetch', programs: ['p1'], lists: [] },
      { url: base + '/app', how: 'fetch', programs: ['p1'], lists: [] },
    ], camps: { list: [{ camp: 'c1', url: base + '/camp', how: 'fetch', checked: confirmed }] }, weekend: [] };
    fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify(check));
    fs.writeFileSync(path.join(dir, 'programs.json'), JSON.stringify([{ id: 'p1', lastVerified: confirmed }]));
    const { stdout: out } = await promisify(execFile)('node', [path.join(ROOT, 'scripts/precheck.mjs'), dir], { env: { ...process.env, PRECHECK_PAGE_MS: '1500', PRECHECK_TODAY: today, PRECHECK_CHECK: path.join(dir, 'check.json'), PRECHECK_PROGRAMS: path.join(dir, 'programs.json') }, encoding: 'utf8' });
    return { out, report: JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')) };
  };
  try {
    // First reading: everything is new; the closed page and the person's page are never requested.
    let { report } = await run('2026-11-01', '2026-11-01');
    deepEq(report.new.map(r => r.url.replace(base, '')).sort(), ['/aftercare', '/camp']);
    eq(report.closed.length, 1, 'robots.txt closes /closed'); eq(report.person.length, 1, 'a person reads /person');
    const failed = Object.fromEntries(report.failed.map(f => [f.url.replace(base, ''), f]));
    eq(report.failed.length, 2, 'a 404 and a stalled page'); eq(failed['/gone'].status, 404);
    includes(failed['/slow'].note || '', 'no answer within 1.5 seconds', 'a page that never finishes is given up on, and the run still ends');
    ok(!asked.includes('/closed') && !asked.includes('/person'), 'neither was requested: ' + asked.join(' '));
    deepEq(report.thin.map(r => r.url.replace(base, '')), ['/app'], 'a page with almost no text (a JavaScript app) is never called the same');
    const kept = JSON.parse(fs.readFileSync(path.join(dir, 'pages.json'), 'utf8')).pages[base + '/camp'].versions[0].lines;
    ok(!kept.some(l => /Date\.now|©/.test(l)), 'scripts and the copyright line are not part of the text: ' + kept.join(' | '));
    includes(kept, '$395 a week');

    // A month later the camp has posted a new price, the copyright year turned over, and the aftercare page is the same.
    pages['/camp'] = pages['/camp'].replace('$395', '$410').replace('© 2026', '© 2027');
    ({ report } = await run('2026-12-01', '2026-11-01'));
    deepEq(report.same.map(r => r.url.replace(base, '')), ['/aftercare'], 'the same as on the day it was confirmed');
    eq(report.changed.length, 1, 'one page changed');
    deepEq(report.changed[0].added, ['$410 a week']); deepEq(report.changed[0].removed, ['$395 a week']);
    eq(report.changed[0].against, '2026-11-01', 'compared with the version from the day it was last confirmed');
    includes(report.changed[0].for, 'camp c1', 'and says which listing rests on it');

    // That check was never merged, so the camp still says it was confirmed on November 1: January still reports the
    // change, against November's version, not December's.
    ({ report } = await run('2027-01-01', '2026-11-01'));
    eq(report.changed.length, 1, 'still reported'); eq(report.changed[0].against, '2026-11-01');
    // Once it is confirmed (December's check merged), the same text is "same" again.
    ({ report } = await run('2027-02-01', '2026-12-01'));
    deepEq(report.same.map(r => r.url.replace(base, '')).sort(), ['/aftercare', '/camp']);
    // Listings confirmed before the oldest version kept: the aftercare page is unchanged since then, and says since
    // when; the camp is compared with the oldest version kept, so its change between November and December still shows.
    ({ report } = await run('2027-03-01', '2026-10-01'));
    deepEq(report.sameSince.map(r => [r.url.replace(base, ''), r.since]), [['/aftercare', '2026-11-01']]);
    eq(report.changed.length, 1); eq(report.changed[0].against, '2026-11-01'); eq(report.changed[0].olderThanKept, true);
  } finally { server.closeAllConnections(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
