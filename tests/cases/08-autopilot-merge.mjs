// The hourly merge (scripts/merger.mjs, scaling plan Phase 4), run as the workflow runs it, on a small git repository
// with run pull requests in every state it has to handle, against a stand-in GitHub. Nothing here reaches GitHub.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { test, ok, eq, includes, excludes, ROOT } from '../lib/harness.mjs';

const run = promisify(execFile);
const BOT = 'github-actions[bot]';
const RUNS = 'shwamansilverbauer';

// ---------- the stand-in GitHub ----------
const gh = { calls: [], pulls: new Map(), comments: new Map(), labels: new Map(), main: '' };
let server = null, origin = '', nextId = 1;
async function standin() {
  if (server) return;
  server = http.createServer((req, res) => {
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => {
      const u = new URL(req.url, 'http://x'), p = u.pathname, data = body ? JSON.parse(body) : null;
      gh.calls.push({ method: req.method, path: p, body: data });
      const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      const withLabels = pr => ({ ...pr, labels: [...(gh.labels.get(pr.number) || [])].map(name => ({ name })) });
      let m;
      if (req.method === 'GET' && p === '/repos/o/r/pulls') return json(200, [...gh.pulls.values()].filter(x => u.searchParams.get('state') === 'all' || x.state === u.searchParams.get('state')).map(withLabels));
      if (req.method === 'GET' && (m = /^\/repos\/o\/r\/pulls\/(\d+)$/.exec(p))) return json(200, withLabels(gh.pulls.get(+m[1])));
      if (req.method === 'PUT' && (m = /^\/repos\/o\/r\/pulls\/(\d+)\/merge$/.exec(p))) { const pr = gh.pulls.get(+m[1]); if (pr.head.sha !== data.sha) return json(409, { message: 'Head branch was modified' }); pr.state = 'closed'; pr.merged = true; return json(200, { merged: true }); }
      if ((m = /^\/repos\/o\/r\/issues\/(\d+)\/comments$/.exec(p))) {
        const list = gh.comments.get(+m[1]) || [];
        if (req.method === 'GET') return json(200, list);
        const c = { id: nextId++, user: { login: BOT }, body: data.body }; list.push(c); gh.comments.set(+m[1], list); return json(201, c);
      }
      if (req.method === 'PATCH' && (m = /^\/repos\/o\/r\/issues\/comments\/(\d+)$/.exec(p))) { for (const list of gh.comments.values()) for (const c of list) if (c.id === +m[1]) c.body = data.body; return json(200, { id: +m[1] }); }
      if (req.method === 'POST' && (m = /^\/repos\/o\/r\/issues\/(\d+)\/labels$/.exec(p))) { const s = gh.labels.get(+m[1]) || new Set(); for (const l of data.labels) s.add(l); gh.labels.set(+m[1], s); return json(200, [...s].map(name => ({ name }))); }
      if (req.method === 'DELETE' && (m = /^\/repos\/o\/r\/issues\/(\d+)\/labels\/(.+)$/.exec(p))) { const s = gh.labels.get(+m[1]); const name = decodeURIComponent(m[2]); if (!s || !s.has(name)) return json(404, { message: 'Label does not exist' }); s.delete(name); return json(200, []); }
      if (req.method === 'GET' && p === '/repos/o/r/git/ref/heads/main') return json(200, { object: { sha: gh.main } });
      if (req.method === 'POST' && /\/dispatches$/.test(p)) { res.writeHead(204); return res.end(); }
      return json(404, { message: 'Not Found' });
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  server.unref();
  origin = `http://127.0.0.1:${server.address().port}`;
}
const meta = (head, over = {}) => ({ verdict: 'publish', mode: 'on', head, tests: 'passed', branch: 'x', changes: 1, listings: 1, held: 0, publish: 1, whole: 0, ...over });
const gateBody = m => `<!-- pas-gate ${JSON.stringify(m)} -->\n### Autopilot gate: Everything checks out: 1 listing (1 change) would publish.\n_Autopilot is on: this merges itself at the next hourly merge, built and tested together with any other run that is ready, and the site publishes once._\n\n**Would publish**\n- **A**: hours\n`;
const calls = (method, re) => gh.calls.filter(c => c.method === method && re.test(c.path));

test('the hourly merge: everything ready is laid on main together and merged at the commits the gate checked, with one publish; a clash waits, a moved or look-alike one loses its label, a file off the allowlist is held, a shadow-mode verdict is checked again', async () => {
  await standin();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-merge-test-'));
  const work = path.join(tmp, 'work'), bare = path.join(tmp, 'origin.git'), mainco = path.join(tmp, 'main'), stage = path.join(tmp, 'stage');
  const env = { ...process.env, GATE_API: origin, GATE_REPO: 'o/r', GITHUB_TOKEN: 'test-token', GITHUB_OUTPUT: path.join(tmp, 'out.txt'), GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test' };
  const g = (...a) => execFileSync('git', a, { cwd: work, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const writeJson = (f, o) => { fs.mkdirSync(path.dirname(path.join(work, f)), { recursive: true }); fs.writeFileSync(path.join(work, f), JSON.stringify(o, null, 2) + '\n'); };
  const merger = (...a) => run('node', [path.join(mainco, 'scripts/merger.mjs'), ...a], { cwd: mainco, env: { ...env, BATCH: env.BATCH || '' }, encoding: 'utf8', maxBuffer: 64e6 });
  const outputs = () => Object.fromEntries(fs.readFileSync(env.GITHUB_OUTPUT, 'utf8').trim().split('\n').map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  try {
    // main: two listings, the gate's config, the switch on.
    fs.mkdirSync(work);
    fs.cpSync(path.join(ROOT, 'scripts'), path.join(work, 'scripts'), { recursive: true });
    writeJson('data/programs.json', [{ id: 'alpha', name: 'Alpha', hours: '3:00 to 6:00 pm' }, { id: 'beta', name: 'Beta', hours: '3:00 to 5:00 pm' }]);
    writeJson('data/autopilot.json', { mode: 'on' });
    execFileSync('git', ['init', '-q', '--bare', bare]);
    g('init', '-q', '-b', 'main'); g('add', '-A'); g('commit', '-q', '-m', 'main'); g('remote', 'add', 'origin', 'file://' + bare); g('push', '-q', 'origin', 'main');
    gh.main = g('rev-parse', 'HEAD');
    // Run pull requests: each a branch, with GitHub's test merge on main pushed as refs/pull/<n>/merge.
    const pr = (n, branch, change, { ready = true, comment = 'gate', commentMeta = {}, moved = false, labels = [] } = {}) => {
      g('checkout', '-q', '-b', branch, 'main');
      change();
      writeJson(`evidence/${branch}.json`, { run: branch, items: [] });
      g('add', '-A'); g('commit', '-q', '-m', branch); g('push', '-q', 'origin', branch);
      const head = g('rev-parse', 'HEAD');
      g('checkout', '-q', '--detach', 'main'); g('merge', '-q', '--no-ff', '--no-edit', branch); g('push', '-q', 'origin', `HEAD:refs/pull/${n}/merge`); g('push', '-q', 'origin', `${head}:refs/pull/${n}/head`); g('checkout', '-q', 'main');
      gh.pulls.set(n, { number: n, state: 'open', title: `Run ${n}`, mergeable: true, user: { login: RUNS }, head: { ref: branch, sha: moved ? 'f'.repeat(40) : head, repo: { full_name: 'o/r' } }, base: { ref: 'main', repo: { full_name: 'o/r' } } });
      gh.labels.set(n, new Set([...(ready ? ['autopilot-ready'] : []), ...labels]));
      if (comment) gh.comments.set(n, [{ id: nextId++, user: { login: comment === 'stranger' ? 'someone-else' : BOT }, body: gateBody(meta(head, commentMeta)) }]);
      return head;
    };
    const hours = (id, h) => () => { const f = path.join(work, 'data/programs.json'); const d = JSON.parse(fs.readFileSync(f, 'utf8')); d.find(x => x.id === id).hours = h; fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); };
    const h1 = pr(1, 'queue-2026-11-30-0547', hours('alpha', '3:00 to 6:30 pm'));
    const h2 = pr(2, 'weekly-2026-11-30-0659', hours('beta', '3:00 to 5:30 pm'));
    pr(3, 'queue-2026-11-30-1247', hours('alpha', '3:00 to 7:00 pm'));                                     // clashes with #1
    pr(4, 'queue-2026-11-30-1300', () => fs.writeFileSync(path.join(work, 'scripts/gate.config.json'), '{}\n'));   // off the allowlist
    pr(5, 'queue-2026-11-30-1310', hours('beta', '4:00 to 5:00 pm'), { moved: true });                       // moved since the gate looked
    pr(6, 'queue-2026-11-30-1320', hours('beta', '4:00 to 6:00 pm'), { comment: 'stranger' });              // only a look-alike comment
    pr(7, 'new-schools-2026-11-30', hours('beta', '3:00 to 5:15 pm'), { ready: false, commentMeta: { mode: 'shadow' } });   // judged in shadow
    execFileSync('git', ['clone', '-q', '--depth', '1', '--branch', 'main', 'file://' + bare, mainco]);

    // The stage: #1 and #2 together, on main; the rest sorted out.
    let r = await merger('--stage', stage);
    let out = outputs(); const batch = JSON.parse(out.batch);
    eq(out.mode, 'on'); eq(out.skip, 'false', r.stdout);
    eq(batch.prs.map(p => p.n).join(','), '1,2', r.stdout); eq(batch.prs[0].head, h1); eq(batch.prs[1].head, h2); eq(batch.base, gh.main);
    const staged = JSON.parse(fs.readFileSync(path.join(stage, 'data/programs.json'), 'utf8'));
    eq(staged.find(x => x.id === 'alpha').hours, '3:00 to 6:30 pm', 'the stage has #1’s data'); eq(staged.find(x => x.id === 'beta').hours, '3:00 to 5:30 pm', 'and #2’s, together');
    ok(fs.existsSync(path.join(stage, 'scripts/merger.mjs')) && !fs.existsSync(path.join(stage, 'evidence')), 'main’s code and the data, nothing else');
    const why = n => (batch.dropped.find(d => d.n === n) || {});
    eq(why(3).act, 'wait'); includes(why(3).why, 'clashes with #1');
    eq(why(4).act, 'hold'); includes(why(4).why, 'scripts/gate.config.json');
    eq(why(5).act, 'unlabel'); includes(why(5).why, 'moved');
    eq(why(6).act, 'unlabel', 'a look-alike comment from someone else counts for nothing');
    ok(!batch.dropped.some(d => d.n === 7), 'not ready, so not in the batch');
    eq(execFileSync('git', ['status', '--porcelain'], { cwd: mainco, encoding: 'utf8' }).trim(), '', 'main’s own checkout is left as it was');
    eq(JSON.parse(fs.readFileSync(path.join(mainco, 'data/programs.json'), 'utf8')).find(x => x.id === 'alpha').hours, '3:00 to 6:00 pm');

    // The tests failed: nothing merges, the batch is held for Josh with the reason in the gate's comment.
    gh.calls.length = 0;
    env.BATCH = out.batch;
    await merger('--merge', '--tests', 'failed');
    eq(calls('PUT', /\/merge$/).length, 0, 'a failed batch merges nothing');
    ok(gh.labels.get(1).has('needs-josh') && gh.labels.get(2).has('needs-josh'), 'both held'); ok(!gh.labels.get(1).has('autopilot-ready'));
    includes(gh.comments.get(1)[0].body, 'Held at the hourly merge, for Josh'); includes(gh.comments.get(1)[0].body, '"verdict":"held"'); includes(gh.comments.get(2)[0].body, 'Built together with #1, #2');
    ok(gh.labels.get(4).has('needs-josh'), 'the one off the allowlist is held'); includes(gh.comments.get(4)[0].body, 'which only Josh merges');
    ok(!gh.labels.get(5).has('autopilot-ready') && !gh.labels.get(6).has('autopilot-ready'), 'moved and look-alike lose the label');
    ok(gh.labels.get(3).has('autopilot-ready'), 'the clash keeps its label for next hour');
    const re = calls('POST', /autopilot\.yml\/dispatches$/).map(c => c.body.inputs.pr);
    ok(re.includes('7'), 'the one judged in shadow mode goes back to the gate: ' + re.join(','));
    ok(!re.includes('1') && !re.includes('2'), 'held ones wait for Josh, not the gate');

    // The tests passed: both merge, at the commits checked, and one publish starts.
    for (const n of [1, 2]) { gh.labels.set(n, new Set(['autopilot-ready'])); gh.comments.set(n, [{ id: nextId++, user: { login: BOT }, body: gateBody(meta(gh.pulls.get(n).head.sha)) }]); }
    gh.calls.length = 0;
    r = await merger('--merge', '--tests', 'passed');
    const merges = calls('PUT', /\/merge$/);
    eq(merges.map(c => c.path).join(' '), '/repos/o/r/pulls/1/merge /repos/o/r/pulls/2/merge', r.stdout);
    eq(merges[0].body.sha, h1, 'the exact commit checked'); eq(merges[1].body.sha, h2); eq(merges[0].body.merge_method, 'squash');
    includes(merges[0].body.commit_message, 'built and tested together');
    eq(calls('POST', /publish\.yml\/dispatches$/).length, 1, 'one publish for the batch');

    // main moved while the batch was tested: nothing merges this hour.
    for (const n of [1, 2]) { gh.pulls.get(n).state = 'open'; gh.labels.set(n, new Set(['autopilot-ready'])); }
    gh.main = 'a'.repeat(40); gh.calls.length = 0;
    r = await merger('--merge', '--tests', 'passed');
    eq(calls('PUT', /\/merge$/).length, 0); includes(r.stdout, 'main moved');
    gh.main = batch.base;

    // A pull request that moved between the stage and the merge is left for next hour; the others still merge.
    gh.pulls.get(1).head.sha = 'e'.repeat(40); gh.calls.length = 0;
    await merger('--merge', '--tests', 'passed');
    eq(calls('PUT', /\/merge$/).map(c => c.path).join(' '), '/repos/o/r/pulls/2/merge');
    gh.pulls.get(1).head.sha = h1;

    // Shadow: the hourly merge does nothing at all.
    fs.writeFileSync(path.join(mainco, 'data/autopilot.json'), JSON.stringify({ mode: 'shadow' }));
    fs.writeFileSync(env.GITHUB_OUTPUT, ''); gh.calls.length = 0;
    r = await merger('--stage', stage);
    out = outputs(); eq(out.mode, 'shadow'); eq(out.skip, 'true'); includes(r.stdout, 'does nothing');
    env.BATCH = out.batch;
    await merger('--merge', '--tests', 'skipped');
    ok(!gh.calls.some(c => c.method !== 'GET'), 'nothing written to GitHub in shadow mode');
    excludes(JSON.stringify(gh.calls.map(c => c.path)), '/merge"');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
