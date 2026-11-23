// The hourly merger (scaling plan, Phase 4; docs/listings.md, "Publishing in batches"). With the autopilot on, the gate
// (scripts/gate.mjs) labels a run's pull request autopilot-ready when nothing in it is held and its tests passed. Once
// an hour, .github/workflows/autopilot.yml runs this in two jobs, so the site builds and publishes once for everything
// that is ready, instead of once per pull request:
//
//   node scripts/merger.mjs --stage <dir>
//       Read-only. Takes the ready pull requests, oldest first (ten at most), whose gate comment, by the workflow's own
//       account, names the commit each one is at now. Lays GitHub's test merge of each on top of main, one after the
//       other, in a scratch worktree: one that clashes with another waits for the next hour. Copies main's code and
//       the combined data (the gate's allowlisted files only) into <dir> for the build and the tests, and writes the
//       batch to <dir>/batch.json and to the job's "batch" output.
//   node scripts/merger.mjs --merge --batch '<json>' --tests passed|failed
//       With a write token. Tests passed: if main is still where the batch found it, squash-merges each pull request
//       at the commit the gate checked (one whose head moved, or that lost its label, is skipped) and starts one
//       publish. Tests failed: merges nothing and holds the batch for Josh (needs-josh, and the gate's comment says
//       why). Then the clean-up: a pull request whose head moved loses its ready label, one whose test merge no longer
//       applies to main is sent back to the gate, and up to five open run pull requests last judged while the switch
//       was shadow or off are sent to the gate again, so they can be ready by the next hour.
//
// Nothing from a pull request is run: as in the gate, only the allowlisted data files are read out of it, as git
// objects, next to main's code. data/autopilot.json on main must say "on", or this does nothing.
// Tests: tests/cases/08-autopilot-merge.mjs, against a stand-in GitHub (GATE_API, GATE_REPO).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gh, ghOk, eligible, CFG, READY, REPO } from './gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOT = process.env.GATE_BOT || 'github-actions[bot]';   // who GitHub credits the gate's comment to
const MAX = 10;        // pull requests in one hour's batch; the rest go next hour
const RECHECK = 5;     // open run pull requests sent back to the gate in one hour, at most
const HOLD = 'needs-josh';

const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : undefined; };
const git = (a, cwd = ROOT) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 512e6, stdio: ['ignore', 'pipe', 'pipe'] });
const output = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };
const mode = () => { try { const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/autopilot.json'), 'utf8')).mode; return ['off', 'shadow', 'on'].includes(m) ? m : 'off'; } catch { return 'off'; } };
const labelsOf = pr => (pr.labels || []).map(l => typeof l === 'string' ? l : l.name);
const IDENT = ['-c', 'user.name=Autopilot merger', '-c', 'user.email=noreply@github.com'];   // the scratch merges only; never pushed

// The gate's own comment on a pull request: the last one by the workflow's account with the gate's mark. Anyone can
// comment on a public repository, so a look-alike from anyone else is ignored.
export async function gateComment(n) {
  const list = await ghOk('GET', `/repos/${REPO}/issues/${n}/comments?per_page=100`);
  let found = null;
  for (const c of list || []) {
    if (!c || (c.user && c.user.login) !== BOT) continue;
    const m = /<!-- pas-gate (\{.*?\}) -->/s.exec(c.body || '');
    if (!m) continue;
    try { found = { id: c.id, body: c.body, meta: JSON.parse(m[1]) }; } catch { /* not the gate's */ }
  }
  return found;
}

// ---------------------------------------------------------------- the read-only half: which, and the combined data
async function stage(dir) {
  const m = mode();
  const batch = { mode: m, base: '', prs: [], dropped: [] };
  const done = () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'batch.json'), JSON.stringify(batch, null, 1));
    output('mode', m); output('skip', batch.prs.length ? 'false' : 'true'); output('batch', JSON.stringify(batch));
    console.log(batch.prs.length ? `This hour's batch: ${batch.prs.map(p => '#' + p.n).join(', ')}, on main at ${batch.base.slice(0, 7)}.` : 'Nothing is ready to merge this hour.');
    for (const d of batch.dropped) console.log(`  #${d.n}: ${d.why}`);
  };
  if (m !== 'on') { console.log(`The autopilot is ${m} (data/autopilot.json): the hourly merge does nothing.`); return done(); }
  batch.base = git(['rev-parse', 'HEAD']).trim();
  const open = [];
  for (let page = 1; page <= 3; page++) {
    const list = await ghOk('GET', `/repos/${REPO}/pulls?state=open&per_page=100&page=${page}`);
    open.push(...(list || [])); if (!list || list.length < 100) break;
  }
  const ready = open.filter(p => labelsOf(p).includes(READY) && !labelsOf(p).includes(HOLD)).sort((a, b) => a.number - b.number);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-merge-'));
  const trial = path.join(tmp, 'trial');
  git(['worktree', 'add', '-q', '--detach', trial, batch.base]);
  try {
    for (const listed of ready) {
      const n = listed.number;
      if (batch.prs.length >= MAX) { batch.dropped.push({ n, act: 'wait', why: `the batch is full (${MAX}); it goes next hour` }); continue; }
      let pr = await ghOk('GET', `/repos/${REPO}/pulls/${n}`);
      const why = eligible(pr);
      if (why) { batch.dropped.push({ n, act: 'unlabel', why }); continue; }
      const g = await gateComment(n);
      if (!g || g.meta.mode !== 'on' || g.meta.verdict !== 'publish' || g.meta.tests !== 'passed') { batch.dropped.push({ n, act: 'unlabel', why: 'the gate’s last word on it isn’t a clean, tested verdict with the autopilot on' }); continue; }
      if (g.meta.head !== pr.head.sha) { batch.dropped.push({ n, act: 'unlabel', why: `it moved to ${pr.head.sha.slice(0, 7)} after the gate checked ${String(g.meta.head).slice(0, 7)}; the gate checks it again` }); continue; }
      for (let i = 0; i < 6 && pr.mergeable === null; i++) { await new Promise(r => setTimeout(r, 5000)); pr = await ghOk('GET', `/repos/${REPO}/pulls/${n}`); }
      if (pr.mergeable === false) { batch.dropped.push({ n, act: 'regate', why: 'it no longer merges cleanly into main; the gate looks again' }); continue; }
      let merge, base, head;
      try {
        git(['fetch', '-q', '--no-tags', '--depth=2', 'origin', `+refs/pull/${n}/merge:refs/batch/${n}`]);
        [merge, base, head] = git(['rev-list', '--parents', '-n', '1', `refs/batch/${n}`]).trim().split(/\s+/);
      } catch (e) { batch.dropped.push({ n, act: 'wait', why: 'GitHub’s test merge couldn’t be fetched; next hour' }); continue; }
      if (head !== pr.head.sha || base !== batch.base) { batch.dropped.push({ n, act: 'wait', why: 'GitHub hasn’t remade its test merge on today’s main yet; next hour' }); continue; }
      // The gate allowed only its data files and this run's evidence file. Checked again here, on the merge itself.
      const allowed = new Set([...CFG.allow, CFG.evidenceDir + pr.head.ref + '.json']);
      const off = git(['diff', '--name-only', base, merge]).split('\n').filter(Boolean).filter(f => !allowed.has(f));
      if (off.length) { batch.dropped.push({ n, act: 'hold', why: `it changes ${off.slice(0, 3).join(', ')}, which only Josh merges` }); continue; }
      try { git([...IDENT, 'merge', '-q', '--no-ff', '--no-edit', `refs/batch/${n}`], trial); }
      catch { try { git(['merge', '--abort'], trial); } catch { /* nothing to abort */ } batch.dropped.push({ n, act: 'wait', why: `it clashes with ${batch.prs.map(p => '#' + p.n).join(', ')} in this batch; it goes next hour, on top of them` }); continue; }
      batch.prs.push({ n, head: pr.head.sha, branch: pr.head.ref, title: String(pr.title || '').slice(0, 200) });
    }
    // main's code, with the batch's data: the same stage the gate builds and tests in.
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    if (batch.prs.length) {
      for (const f of ['build.mjs', 'site.config.json', 'data', 'src', 'email', 'scripts', 'tests']) if (fs.existsSync(path.join(ROOT, f))) fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
      fs.rmSync(path.join(dir, 'tests/.scratch'), { recursive: true, force: true });
      for (const f of CFG.allow) { const from = path.join(trial, f); if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dir, f)); }
      git(['init', '-q'], dir); git(['add', '-A'], dir);   // the tests list the files a repository tracks
    }
  } finally {
    try { git(['worktree', 'remove', '--force', trial]); } catch { /* gone already */ }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  done();
}

// ---------------------------------------------------------------- the write half: merge, or hold, then tidy
// The gate's comment rewritten to say it is held, and why: the Needs-you page and the morning summary read it.
async function holdFor(n, why) {
  await ghOk('POST', `/repos/${REPO}/issues/${n}/labels`, { labels: [HOLD] });
  await unlabel(n);
  const g = await gateComment(n);
  const note = `**Held at the hourly merge, for Josh:** ${why}`;
  if (!g) { await ghOk('POST', `/repos/${REPO}/issues/${n}/comments`, { body: note }); return; }
  const meta = { ...g.meta, verdict: 'held', held: (g.meta.held || 0) + 1, whole: (g.meta.whole || 0) + 1, heldAt: 'merge' };
  let body = g.body.replace(/<!-- pas-gate \{.*?\} -->/s, `<!-- pas-gate ${JSON.stringify(meta)} -->`)
    .replace(/^### Autopilot gate: .*$/m, '### Autopilot gate: held at the hourly merge.')
    .replace(/^_Autopilot is on: [^\n]*_$/m, '_Autopilot is on, but this waits for Josh._');
  body = body.includes(note) ? body : body.replace(/(_Autopilot is on, but this waits for Josh\._)/, `$1\n\n${note}`);
  if (!body.includes(note)) body += `\n${note}\n`;
  await ghOk('PATCH', `/repos/${REPO}/issues/comments/${g.id}`, { body });
}
async function unlabel(n) {
  const r = await gh('DELETE', `/repos/${REPO}/issues/${n}/labels/${READY}`);
  if (!r.ok && r.status !== 404) throw new Error(`could not take the ready label off #${n}: ${r.status}`);
}
const toGate = n => ghOk('POST', `/repos/${REPO}/actions/workflows/autopilot.yml/dispatches`, { ref: 'main', inputs: { pr: String(n) } });

async function merge(batch, tests) {
  if (mode() !== 'on') { console.log('The autopilot isn’t on: nothing is merged.'); return; }
  const merged = [];
  if (batch.prs.length && tests !== 'passed') {
    const others = batch.prs.length > 1 ? ` Built together with ${batch.prs.map(p => '#' + p.n).join(', ')}.` : '';
    for (const p of batch.prs) await holdFor(p.n, `on today’s main the build or a test failed with this data.${others} Each passed the gate on its own, so the cause is how they combine with main or with each other. The test log is on the hourly merge’s run in Actions.`);
    console.log(`The build or the tests failed: ${batch.prs.map(p => '#' + p.n).join(', ')} held for Josh.`);
  } else if (batch.prs.length) {
    const main = await ghOk('GET', `/repos/${REPO}/git/ref/heads/main`);
    if (main.object.sha !== batch.base) console.log(`main moved (to ${main.object.sha.slice(0, 7)}) while the batch was tested: it is tried again next hour.`);
    else {
      const names = batch.prs.map(p => '#' + p.n).join(', ');
      for (const p of batch.prs) {
        const pr = await ghOk('GET', `/repos/${REPO}/pulls/${p.n}`);
        const labels = labelsOf(pr);
        if (pr.state !== 'open' || pr.head.sha !== p.head || !labels.includes(READY) || labels.includes(HOLD) || eligible(pr)) { console.log(`#${p.n} changed while the batch was tested: left for next hour.`); continue; }
        const r = await gh('PUT', `/repos/${REPO}/pulls/${p.n}/merge`, { merge_method: 'squash', sha: p.head, commit_title: `${pr.title} (#${p.n})`, commit_message: `Merged by the autopilot's hourly merge: every change matched a quote re-read on the provider's own page, and the batch (${names}) was built and tested together on main.` });
        if (!r.ok) { console.log(`#${p.n} couldn't be merged (GitHub said ${r.status}): it and the rest of the batch wait for next hour.`); break; }
        merged.push(p.n);
      }
      if (merged.length) {
        await ghOk('POST', `/repos/${REPO}/actions/workflows/publish.yml/dispatches`, { ref: 'main' });
        console.log(`Merged ${merged.map(n => '#' + n).join(', ')} and started one publish.`);
      }
    }
  }
  for (const d of batch.dropped) {
    if (d.act === 'unlabel') await unlabel(d.n);
    else if (d.act === 'regate') { await unlabel(d.n); await toGate(d.n); }
    else if (d.act === 'hold') await holdFor(d.n, d.why);
  }
  await recheck();
  return merged;
}
// Open run pull requests the gate last judged while the switch was shadow or off (or never judged): checked again, a
// few an hour, so the ones opened before the switch was turned on can be ready too. Held ones wait for Josh.
async function recheck() {
  const list = await ghOk('GET', `/repos/${REPO}/pulls?state=open&per_page=100`);
  let n = 0;
  for (const pr of (list || []).sort((a, b) => a.number - b.number)) {
    if (n >= RECHECK) break;
    if (eligible(pr) || labelsOf(pr).includes(HOLD) || labelsOf(pr).includes(READY)) continue;
    const g = await gateComment(pr.number);
    if (g && g.meta.mode === 'on') continue;
    await toGate(pr.number); n++;
    console.log(`#${pr.number} was last judged with the autopilot ${g ? g.meta.mode : 'not yet on'}: sent to the gate again.`);
  }
}

// ---------------------------------------------------------------- start
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (opt('stage')) await stage(path.resolve(opt('stage')));
    else if (flag('merge')) {
      let batch; try { batch = JSON.parse(opt('batch') || process.env.BATCH || ''); } catch { batch = null; }
      if (!batch || !Array.isArray(batch.prs) || !Array.isArray(batch.dropped)) throw new Error('no batch to merge: pass the stage job’s "batch" output with --batch');
      await merge(batch, opt('tests') || 'skipped');
    } else { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 22).join('\n')); process.exit(2); }
    process.exit(0);
  } catch (e) { console.error('The hourly merge stopped: ' + (e && e.stack || e)); process.exit(2); }
}
