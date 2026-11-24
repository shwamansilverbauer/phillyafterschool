// What the queue run has to do (scaling plan, Phase 4; docs/listings.md, "The queue run"). Reads the private queue
// from a clone of the ops repository and the answers runs have already written there, and prints the items still to
// work, oldest first, as many as one run takes (the gate's limit for a queue run). It reads two folders and changes
// nothing, so an empty queue costs the run a minute, not a session.
//
//   node scripts/queue-work.mjs <ops clone> [--max 15] [--json]
//
// An item already answered in any outcomes/*.json is left out, unless its answer was "failed" (it goes back in the
// queue); so is a manager's item ("x…", "f…") already rated in any decisions/*.json (scaling plan, Phase 6). Research
// items (suggestions, proposals, notes, emails) are limited to the gate's limit for a queue run; reviews and managers'
// items, which change no listing, to 20 of each on top. With --json it prints { written, total, left, branch, todo:
// [items as queue/open.json has them], schoolsAsked }. Without, a line per item. Exit code 0 either way; "Nothing to
// do." is the signal to stop.
// Tests: tests/cases/09-queue-work.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/gate.config.json'), 'utf8'));
const LIMIT = (CFG.limits && CFG.limits['queue-'] && CFG.limits['queue-'].listings) || 15;
const OTHER = 20;   // reviews, and managers' items, taken in one run on top of the research items

// The branch a queue run opens its pull request on: queue-YYYY-MM-DD-HHMM, Philadelphia time.
export function branchName(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(x => [x.type, x.value]));
  return `queue-${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
}

export function work(ops, max = LIMIT) {
  const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const queue = read(path.join(ops, 'queue', 'open.json'));
  const answered = new Set();
  const outDir = path.join(ops, 'outcomes');
  for (const f of fs.existsSync(outDir) ? fs.readdirSync(outDir).filter(x => x.endsWith('.json')).sort() : []) {
    const doc = read(path.join(outDir, f));
    for (const x of doc && Array.isArray(doc.items) ? doc.items : []) if (x && typeof x.item === 'string' && x.outcome !== 'failed') answered.add(x.item);
  }
  const decDir = path.join(ops, 'decisions');
  for (const f of fs.existsSync(decDir) ? fs.readdirSync(decDir).filter(x => x.endsWith('.json')).sort() : []) {
    const doc = read(path.join(decDir, f));
    for (const x of doc && Array.isArray(doc.items) ? doc.items : []) if (x && typeof x.item === 'string' && (x.decision === 'ok' || x.decision === 'hold')) answered.add(x.item);
  }
  const items = queue && Array.isArray(queue.items) ? queue.items.filter(x => x && typeof x.id === 'string') : [];
  const open = items.filter(x => !answered.has(x.id)).sort((a, b) => String(a.when || '').localeCompare(String(b.when || '')) || a.id.localeCompare(b.id));
  const sort = x => /^v/.test(x.id) ? 'review' : /^[xf]/.test(x.id) ? 'content' : 'research';
  const research = open.filter(x => sort(x) === 'research'), reviews = open.filter(x => sort(x) === 'review'), content = open.filter(x => sort(x) === 'content');
  const todo = [...research.slice(0, max), ...reviews.slice(0, OTHER), ...content.slice(0, OTHER)];
  return { written: queue && queue.written || null, total: open.length, left: open.length - todo.length, branch: branchName(), todo, schoolsAsked: queue && Array.isArray(queue.schoolsAsked) ? queue.schoolsAsked : [], missing: !queue };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const ops = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--max');
  const i = args.indexOf('--max'); const max = i >= 0 ? Math.max(1, parseInt(args[i + 1], 10) || LIMIT) : LIMIT;
  if (!ops || !fs.existsSync(ops)) { console.error('Usage: node scripts/queue-work.mjs <a clone of the ops repository> [--max 15] [--json]'); process.exit(2); }
  const w = work(ops, max);
  if (args.includes('--json')) { console.log(JSON.stringify(w, null, 1)); process.exit(0); }
  if (w.missing) console.log('There is no queue/open.json in the ops repository yet.');
  if (!w.todo.length) { console.log('Nothing to do.'); process.exit(0); }
  console.log(`${w.total} item(s) to work${w.left ? `; this run takes the oldest ${w.todo.length}, and ${w.left} wait for the next run` : ''}. Queue written ${w.written || '(unknown)'}. Branch: ${w.branch}`);
  for (const x of w.todo) console.log(`  ${x.id}  ${x.kind}  ${x.when || ''}  ${x.listing || x.program || x.website || x.subject || ''}`.slice(0, 160));
  const rv = w.todo.filter(x => /^v/.test(x.id)).length, mg = w.todo.filter(x => /^[xf]/.test(x.id)).length;
  if (rv || mg) console.log(`Of these, ${rv} review(s) (answer in outcomes/) and ${mg} manager item(s) (answer in decisions/).`);
}
