// Which schools the daily run adds next (scripts/next-schools.mjs): only schools without a page, only ones that teach
// some of K to 5th grade, each once, the queue first.
import fs from 'node:fs';
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
