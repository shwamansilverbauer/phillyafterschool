// Which schools the daily run adds next (scripts/next-schools.mjs): only schools without a page, only ones that teach
// some of K to 5th grade, each once, the queue first, then (with --asks) the schools families asked for.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, ok, eq, ROOT } from '../lib/harness.mjs';

test('the next schools to add: none that has a page, none without K to 5th grade, none twice, the queue first', () => {
  const run = n => JSON.parse(execFileSync('node', [path.join(ROOT, 'scripts/next-schools.mjs'), String(n), '--json'], { encoding: 'utf8' }));
  const r = run(12);
  const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/all-schools.json'), 'utf8')).schools;
  const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/schools.json'), 'utf8'));
  const street = a => String(a).split(',')[0].toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const have = new Set(pages.map(s => street(s.address)));
  eq(r.covered, pages.length, 'every page is matched to a school on the city list');
  eq(r.next.length, Math.min(12, r.uncovered));
  eq(new Set(r.next.map(s => s.id)).size, r.next.length, 'each school once');
  for (const s of r.next) {
    const x = all.find(y => y.id === s.id);
    ok(x, s.id + ' is on the city list');
    ok(!have.has(street(x.address)), s.name + ' has no page yet');
    ok(/^(PK|K|[1-5])\b|^(PK|K|[1-5])-/.test(x.grades), s.name + ' teaches some of K to 5th: ' + x.grades);
  }
  const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/school-queue.json'), 'utf8')).schools;
  const queued = queue.map(q => q.id).filter(id => r.next.some(s => s.id === id));
  eq(r.next.slice(0, queued.length).map(s => s.id).join(' '), queued.join(' '), 'queued schools come first, in order');
});

test('with --asks (queue/open.json from the ops repository), the schools families asked for come next, most asked first; one with a page or unknown is left out', () => {
  const run = (...args) => JSON.parse(execFileSync('node', [path.join(ROOT, 'scripts/next-schools.mjs'), ...args, '--json'], { encoding: 'utf8' }));
  const plain = run('40');
  const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/school-queue.json'), 'utf8')).schools.map(q => q.id);
  const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/schools.json'), 'utf8'));
  const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/all-schools.json'), 'utf8')).schools;
  // Two schools far down the plain order, one asked for by id and one only by the city's own name.
  const pick = plain.next.filter(s => !queue.includes(s.id)).slice(-2);
  ok(pick.length === 2, 'two schools to ask for');
  const byName = all.find(x => x.id === pick[0].id).name;
  const covered = all.find(x => pages.some(p => String(p.address).toLowerCase().startsWith(String(x.address).toLowerCase())));
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pas-asks-')), 'open.json');
  fs.writeFileSync(file, JSON.stringify({ items: [], schoolsAsked: [
    { school: byName, n: 2, last: '2026-11-18' },
    { id: pick[1].id, school: pick[1].name, n: 5, last: '2026-11-19' },
    ...(covered ? [{ id: covered.id, school: covered.name, n: 9, last: '2026-11-20' }] : []),
    { school: 'No Such School Anywhere', n: 7 },
  ] }));
  try {
    const r = run('40', '--asks', file);
    const after = r.next.filter(s => !queue.includes(s.id)).slice(0, 2);
    eq(after.map(s => s.id).join(' '), `${pick[1].id} ${pick[0].id}`, 'asked-for schools right after the queue, most asked first');
    eq(after[0].why, 'asked for by 5 families, last on 2026-11-19');
    if (covered) ok(!r.next.some(s => s.id === covered.id), 'a school with a page is never next');
    eq(new Set(r.next.map(s => s.id)).size, r.next.length, 'each school once');
    eq(run('3', '--asks', file).next.length, 3, 'the count still works beside --asks');
  } finally { fs.rmSync(path.dirname(file), { recursive: true, force: true }); }
});
