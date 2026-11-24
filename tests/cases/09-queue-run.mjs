// The queue run's own tools (scaling plan, Phase 4): scripts/queue-work.mjs, which says what is left to work in the
// private queue (and "Nothing to do." when nothing is, so an idle run ends in a minute), and the gate's --split, which
// moves held listings out of a run's work into a second pull request and keeps each file's layout. Against a folder
// standing in for the ops repository and a stand-in provider site. Nothing here reaches GitHub or a real site.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { test, ok, eq, includes, excludes, matches, ROOT } from '../lib/harness.mjs';

const run = promisify(execFile);
const TODAY = '2026-11-30';

test('the queue run’s worklist: items not yet answered, oldest first, as many as one run takes; a failed answer puts an item back; an empty queue says “Nothing to do.”', async () => {
  const { work, branchName } = await import('../../scripts/queue-work.mjs');
  const ops = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-ops-'));
  try {
    fs.mkdirSync(path.join(ops, 'queue')); fs.mkdirSync(path.join(ops, 'outcomes'));
    const items = Array.from({ length: 20 }, (_, i) => ({ id: 's' + String(i).padStart(3, '0') + 'abc', kind: i % 3 ? 'update' : 'program', when: `2026-11-${String(10 + i).padStart(2, '0')}T12:00:00+00:00`, program: `Club ${i}` }));
    fs.writeFileSync(path.join(ops, 'queue/open.json'), JSON.stringify({ written: '2026-11-30T10:00:00Z', items: [...items].reverse(), schoolsAsked: [{ school: 'Meredith', n: 3 }] }));
    fs.writeFileSync(path.join(ops, 'outcomes/queue-2026-11-29-0547.json'), JSON.stringify({ run: 'queue-2026-11-29-0547', items: [{ item: items[0].id, outcome: 'published' }, { item: items[1].id, outcome: 'failed' }, { item: items[2].id, outcome: 'needs-info', reason: 'need-page' }] }));
    const w = work(ops);
    eq(w.total, 18, 'two answered, one failed and back'); eq(w.todo.length, 15, 'one run takes the gate’s limit for a queue run'); eq(w.left, 3);
    eq(w.todo[0].id, items[1].id, 'the failed one first: it is the oldest left'); excludes(w.todo.map(x => x.id), items[0].id); excludes(w.todo.map(x => x.id), items[2].id);
    ok(w.todo.every((x, i, a) => !i || a[i - 1].when <= x.when), 'oldest first');
    eq(w.schoolsAsked[0].school, 'Meredith');
    // Reviews and managers' items (Phase 6) come on top of the research items; a manager's item rated in decisions/ is done.
    fs.writeFileSync(path.join(ops, 'queue/open.json'), JSON.stringify({ written: '2026-11-30T10:00:00Z', items: [...items, { id: 'v0a0b0c0d0e', kind: 'review', when: '2026-11-01' }, { id: 'x12', kind: 'words', when: '2026-11-02' }, { id: 'f34', kind: 'photo', when: '2026-11-03' }] }));
    fs.mkdirSync(path.join(ops, 'decisions')); fs.writeFileSync(path.join(ops, 'decisions/queue-2026-11-29-0547.json'), JSON.stringify({ run: 'queue-2026-11-29-0547', items: [{ item: 'f34', decision: 'hold', rule: 'child-face' }] }));
    const w2 = work(ops);
    eq(w2.todo.length, 17, '15 research items, and the review and the words on top'); includes(w2.todo.map(x => x.id), 'v0a0b0c0d0e'); includes(w2.todo.map(x => x.id), 'x12'); excludes(w2.todo.map(x => x.id), 'f34');
    fs.rmSync(path.join(ops, 'decisions'), { recursive: true });
    fs.writeFileSync(path.join(ops, 'queue/open.json'), JSON.stringify({ written: '2026-11-30T10:00:00Z', items: [...items].reverse(), schoolsAsked: [{ school: 'Meredith', n: 3 }] }));
    matches(w.branch, /^queue-\d{4}-\d{2}-\d{2}-\d{4}$/);
    eq(branchName(new Date('2026-11-30T10:47:00Z')), 'queue-2026-11-30-0547', 'Philadelphia time');
    // The command line: the list, and the signal to stop.
    const cli = (...a) => run('node', [path.join(ROOT, 'scripts/queue-work.mjs'), ...a], { encoding: 'utf8' });
    let r = await cli(ops, '--max', '2');
    includes(r.stdout, '18 item(s) to work; this run takes the oldest 2'); includes(r.stdout, items[1].id);
    fs.writeFileSync(path.join(ops, 'queue/open.json'), JSON.stringify({ written: '2026-11-30T11:00:00Z', items: [items[0]] }));
    r = await cli(ops); includes(r.stdout, 'Nothing to do.');
    fs.rmSync(path.join(ops, 'queue/open.json'));
    r = await cli(ops); includes(r.stdout, 'no queue/open.json'); includes(r.stdout, 'Nothing to do.');
    r = await cli(ops, '--json'); eq(JSON.parse(r.stdout).todo.length, 0);
  } finally { fs.rmSync(ops, { recursive: true, force: true }); }
});

test('the gate’s --split: the held listings go to a second pull request’s files, the working tree keeps only what would publish, each file keeps its layout, and the evidence is split with them', async () => {
  // The provider's page, as the gate would read it.
  const server = http.createServer((req, res) => {
    const host = String(req.headers['x-test-host'] || '').replace(/^www\./, ''), u = new URL(req.url, 'http://x');
    if (u.pathname === '/robots.txt') { res.writeHead(404); return res.end(); }
    if (host === 'sunnyclub.example' && u.pathname === '/after-school/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h1>Sunny Club</h1><p>After School runs from dismissal until 6:30 pm.</p>'); }
    if (host === 'rainyclub.example' && u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h1>Rainy Club</h1><p>Call us for hours.</p>'); }
    if (host === 'camp.example' && u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h1>Camp</h1><p>Nothing about prices here.</p>'); }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); server.unref();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-split-'));
  const env = { ...process.env, GATE_TEST_ORIGIN: `http://127.0.0.1:${server.address().port}`, GATE_TODAY: TODAY, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test' };
  const g = (...a) => execFileSync('git', a, { cwd: tmp, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const read = f => fs.readFileSync(path.join(tmp, f), 'utf8');
  const write = (f, text) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), text); };
  try {
    fs.cpSync(path.join(ROOT, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
    const school = { id: 'bayside', name: 'Bayside Elementary School', shortName: 'Bayside', address: '100 Test St, Philadelphia, PA 19147', website: 'https://bayside.philasd.org/', grades: 'K-5' };
    const sunny = { id: 'sunny-club', name: 'Sunny Club', types: ['aftercare'], website: 'https://sunnyclub.example/', hours: '3:00 to 6:00 pm', schools: { bayside: { relation: 'nearby' } }, sources: [{ label: 'Sunny Club', url: 'https://sunnyclub.example/after-school/' }] };
    const rainy = { id: 'rainy-club', name: 'Rainy Club', types: ['aftercare'], website: 'https://rainyclub.example/', hours: '3:00 to 5:00 pm', schools: { bayside: { relation: 'nearby' } }, sources: [{ label: 'Rainy Club', url: 'https://rainyclub.example/' }] };
    const camp = { id: 'test-camp', name: 'Test Camp', website: 'https://camp.example/', cost: '$300 a week' };
    write('data/programs.json', JSON.stringify([sunny, rainy], null, 2) + '\n');
    write('data/schools.json', JSON.stringify([school], null, 2) + '\n');
    write('data/camps.json', JSON.stringify({ season: 2026, camps: [camp] }, null, 1) + '\n');
    for (const [f, v] of [['data/geo.json', { places: {} }], ['data/reading.json', []], ['data/news.json', []], ['data/school-dates.json', { schools: {} }], ['data/reviews.json', []]]) write(f, JSON.stringify(v, null, 2) + '\n');
    g('init', '-q', '-b', 'main'); g('add', '-A'); g('commit', '-q', '-m', 'main');
    const mainText = { programs: read('data/programs.json'), camps: read('data/camps.json') };
    const branch = 'queue-2026-11-30-0547';
    g('checkout', '-q', '-b', branch);
    // Three changes: Sunny's hours (its quote is on its page: publishes), Rainy's hours and the camp's price (neither
    // quote is on the page: held).
    write('data/programs.json', JSON.stringify([{ ...sunny, hours: '3:00 to 6:30 pm' }, { ...rainy, hours: '3:00 to 6:00 pm' }], null, 2) + '\n');
    write('data/camps.json', JSON.stringify({ season: 2026, camps: [{ ...camp, cost: '$350 a week' }] }, null, 1) + '\n');
    // And a review the site can't vouch for here (the stand-in has no site to ask): held, and it goes in no pull request.
    const rv = { id: 'v' + '0a0b0c0d0e', programId: 'sunny-club', school: 'bayside', name: 'Rae', stars: 5, comment: 'Calm pickup and patient counselors, every single day.', date: TODAY };
    write('data/reviews.json', JSON.stringify([rv], null, 2) + '\n');
    const rec = (item, listing, p, old, nw, source, quote) => ({ item, kind: 'update', listing, outcome: 'published', fields: [{ path: p, old, new: nw, source, quote, read: TODAY, how: 'fetch' }] });
    write(`evidence/${branch}.json`, JSON.stringify({ run: branch, items: [
      rec('s1aaaa', 'p:sunny-club', 'hours', '3:00 to 6:00 pm', '3:00 to 6:30 pm', 'https://sunnyclub.example/after-school/', 'After School runs from dismissal until 6:30 pm.'),
      rec('s2bbbb', 'p:rainy-club', 'hours', '3:00 to 5:00 pm', '3:00 to 6:00 pm', 'https://rainyclub.example/', 'Open until 6:00 pm.'),
      rec('s3cccc', 'c:test-camp', 'cost', '$300 a week', '$350 a week', 'https://camp.example/', 'Camp is $350 a week.'),
      { item: 'e4dddd', kind: 'update', outcome: 'no-change' },
      { item: rv.id, kind: 'review', listing: 'r:' + rv.id, outcome: 'published' }] }, null, 2) + '\n');
    const held = path.join(tmp, '..', path.basename(tmp) + '-held');
    let r;
    try { r = await run('node', [path.join(tmp, 'scripts/gate.mjs'), '--local', '--base', 'main', '--no-build', '--split', held], { cwd: tmp, env, encoding: 'utf8' }); }
    catch (e) { r = e; }
    eq(r.code, 1, 'held listings: the exit code still says so');
    includes(r.stdout, 'Split: 2 held listings'); includes(r.stdout, `git switch -c ${branch}-held`);
    includes(r.stdout, `Held reviews (r:${rv.id})`);
    eq(read('data/reviews.json'), '[]\n', 'the held review is out of the working tree');
    ok(!fs.existsSync(path.join(held, 'data/reviews.json')), 'and in no pull request: its words stay private');
    // The working tree: Sunny's change only; the camp file back to main's, byte for byte.
    const clean = JSON.parse(read('data/programs.json'));
    eq(clean.find(x => x.id === 'sunny-club').hours, '3:00 to 6:30 pm'); eq(clean.find(x => x.id === 'rainy-club').hours, '3:00 to 5:00 pm');
    eq(read('data/programs.json'), JSON.stringify(clean, null, 2) + '\n', 'two-space layout kept');
    eq(read('data/camps.json'), mainText.camps, 'the camp file is main’s again, one-space layout and all');
    const ev = JSON.parse(read(`evidence/${branch}.json`));
    eq(ev.items.map(i => i.item).join(','), 's1aaaa,e4dddd', 'the clean evidence keeps what publishes and the no-change item');
    // The held folder: main's data with only the held listings' changes, and their evidence.
    const hp = JSON.parse(fs.readFileSync(path.join(held, 'data/programs.json'), 'utf8'));
    eq(hp.find(x => x.id === 'rainy-club').hours, '3:00 to 6:00 pm'); eq(hp.find(x => x.id === 'sunny-club').hours, '3:00 to 6:00 pm', 'Sunny stays as on main there');
    eq(hp.map(x => x.id).join(','), 'sunny-club,rainy-club', 'the order kept');
    const hc = fs.readFileSync(path.join(held, 'data/camps.json'), 'utf8');
    eq(JSON.parse(hc).camps[0].cost, '$350 a week'); eq(hc, JSON.stringify(JSON.parse(hc), null, 1) + '\n', 'one-space layout kept');
    const hev = JSON.parse(fs.readFileSync(path.join(held, `evidence/${branch}-held.json`), 'utf8'));
    eq(hev.items.map(i => i.item).join(','), 's2bbbb,s3cccc', 'no review in the held evidence either'); eq(hev.run, `${branch}-held`);
    // Run again on the clean tree: nothing held.
    r = await run('node', [path.join(tmp, 'scripts/gate.mjs'), '--local', '--base', 'main', '--no-build'], { cwd: tmp, env, encoding: 'utf8' });
    includes(r.stdout, '1 would publish, 0 held');
    // And the held folder laid over main is a run branch the gate holds, for Josh.
    g('stash', '-q', '-u'); g('switch', '-q', '-c', `${branch}-held`, 'main');
    fs.cpSync(held + '/.', tmp, { recursive: true });
    try { r = await run('node', [path.join(tmp, 'scripts/gate.mjs'), '--local', '--base', 'main', '--no-build'], { cwd: tmp, env, encoding: 'utf8' }); } catch (e) { r = e; }
    eq(r.code, 1); includes(r.stdout, '0 would publish, 2 held');
    fs.rmSync(held, { recursive: true, force: true });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); server.close(); }
});

test('the four scheduled runs’ prompts (docs/runs/) agree with the code: the gate, the split and the outcome file in each, the words the host reads, scripts and docs that exist, no merge and no secret', async () => {
  const api = fs.readFileSync(path.join(ROOT, 'src/server/groups-api.php'), 'utf8');
  const list = name => [...new RegExp(`const ${name} = array\\(([^)]*)\\)`).exec(api)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const fails = list('QUEUE_RUN_FAILS'), outcomes = list('QUEUE_OUTCOMES'), replies = list('QUEUE_REPLIES'), reasons = list('QUEUE_REASONS');
  ok(fails.length >= 5, 'the host’s list of steps');
  for (const f of ['queue-run', 'five-schools', 'weekly-run', 'monthly-check']) {
    const md = fs.readFileSync(path.join(ROOT, 'docs/runs', f + '.md'), 'utf8');
    const m = /````text\n([\s\S]*?)\n````/.exec(md);
    ok(m, f + ': the prompt is in one ````text box, ready to copy');
    const p = m[1];
    for (const must of ['node scripts/gate.mjs --local --draft', 'node scripts/gate.mjs --local --split /tmp/held', '-held origin/main', 'outcomes/<your branch name>.json', 'phillyafterschool-ops', 'CLAUDE.md', 'Never push to main or to live', 'Commit as "Claude <noreply@anthropic.com>"'])
      includes(p, must, `${f}: ${must}`);
    includes(p, `from this list: ${fails.join(', ')}.`, f + ': the steps a failed run may name are exactly the host’s');
    matches(p, /never merge/i, f);
    excludes(p, 'Josh merges it'); ok(!/\bRead README\.md/.test(p), f + ': no run reads the whole README'); excludes(p, 'gate only comments for now');
    // Every script it runs exists, and so does every doc it names.
    for (const [, s] of p.matchAll(/node (scripts\/[a-z-]+\.mjs)/g)) ok(fs.existsSync(path.join(ROOT, s)), `${f}: ${s} exists`);
    for (const [, d] of p.matchAll(/(docs\/[a-z-]+\.md)/g)) ok(fs.existsSync(path.join(ROOT, d)), `${f}: ${d} exists`);
    for (const [, sec] of p.matchAll(/in docs\/listings\.md: ((?:"[^"]+"(?:, | and |)(?: with )?)+)/g)) for (const [, h] of sec.matchAll(/"([^"]+)"/g))
      matches(fs.readFileSync(path.join(ROOT, 'docs/listings.md'), 'utf8'), new RegExp(`^#+ ${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `${f}: docs/listings.md has "${h}"`);
    // Nothing private: no email address but the commit one, no spreadsheet id, nothing key-shaped.
    for (const [a] of p.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) eq(a, 'noreply@anthropic.com', `${f}: no address but the commit one`);
    excludes(p, '1RR7'); ok(!/\b[A-Za-z0-9_-]{40,}\b/.test(p), f + ': nothing that looks like an id or a key');
  }
  // The queue run's answers are words the host reads, and nothing else.
  const q = /````text\n([\s\S]*?)\n````/.exec(fs.readFileSync(path.join(ROOT, 'docs/runs/queue-run.md'), 'utf8'))[1];
  const outSection = q.slice(q.indexOf('OUTCOMES (the answers to the queue)'), q.indexOf('IF YOU CAN\'T FINISH'));
  ok(outSection.length > 200, 'the outcomes section');
  for (const [, w] of outSection.matchAll(/^  - "([a-z-]+)"(?: \(emails only\))?:/gm)) includes(outcomes, w, `the queue run’s outcome "${w}" is one the host reads`);
  for (const w of outcomes) includes(q, `"${w}"`, `the queue run knows the outcome "${w}"`);
  for (const w of replies) includes(q, `"${w}"`, `the queue run knows the reply "${w}"`);
  for (const w of reasons) includes(q, `"${w}"`, `the queue run knows the reason "${w}"`);
  includes(q, 'node scripts/queue-work.mjs ../phillyafterschool-ops');
  includes(q, 'Nothing to do.');
  // Phase 6: the rules a decision about a manager's item may name are exactly the ones the host reads.
  const content = fs.readFileSync(path.join(ROOT, 'src/server/content.php'), 'utf8');
  const rules = [.../const CONTENT_RULES = array\(([\s\S]*?)\n\);/.exec(content)[1].matchAll(/^\s*'([a-z-]+)' =>/gm)].map(m => m[1]).filter(r => r !== 'words');   // "words" is the site's own, from its private list
  ok(rules.length >= 10, 'the host’s list of rules');
  includes(q, `The rule is exactly one of: ${rules.join(', ')}.`, 'the decisions’ rules are exactly the host’s');
  includes(q, 'decisions/<your branch name>.json');
});
