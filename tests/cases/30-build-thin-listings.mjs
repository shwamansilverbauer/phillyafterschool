// A thin listing (notPosted): a program that went up on the minimum, before it posted its days, hours, price or pickup
// schools. Built from a copy of the data with two made-up thin listings added, so the real data is left alone.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test, ok, eq, includes, excludes, ROOT, TODAY } from '../lib/harness.mjs';

function buildWith(change) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-thin-'));
  for (const f of ['build.mjs', 'site.config.json', 'data', 'src', 'email', 'scripts']) fs.cpSync(path.join(ROOT, f), path.join(work, f), { recursive: true });
  const file = path.join(work, 'data/programs.json');
  const programs = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(programs);
  fs.writeFileSync(file, JSON.stringify(programs, null, 2) + '\n');
  const r = spawnSync('node', ['build.mjs'], { cwd: work, encoding: 'utf8', env: { ...process.env, PAS_TODAY: TODAY, PAS_NO_HISTORY: '1' }, maxBuffer: 64e6 });
  return { work, ok: r.status === 0, out: (r.stdout || '') + (r.stderr || ''), read: p => fs.readFileSync(path.join(work, 'dist', p), 'utf8') };
}
const thin = (id, o = {}) => ({
  id, name: 'Thin Test ' + id, what: 'After-school sports and crafts for school-age kids', types: ['aftercare'], address: '1 Thin Test Street, Philadelphia, PA 19144',
  grades: null, hours: 'Not posted yet; ask the program', cost: 'Not posted yet', website: 'https://thin-test.example/', notPosted: ['days', 'hours', 'cost', 'grades', 'pickup'],
  register: { how: 'online', url: 'https://thin-test.example/register' }, sources: [{ label: 'Thin Test', url: 'https://thin-test.example/after-school' }], lastVerified: TODAY, schools: {}, neighborhoods: ['Germantown'], ...o });

test('a thin listing builds: “Not posted yet” on its card and page, its claim box says what isn’t posted, it stays on its neighborhood page with no school, and the planner labels its days', async () => {
  const b = buildWith(ps => { ps.push(thin('thin-test-a')); ps.push(thin('thin-test-b', { schools: { nebinger: { relation: 'nearby', note: 'Doesn’t say it picks up.' } }, neighborhoods: undefined })); });
  ok(b.ok, b.out.slice(-2000));
  const page = b.read('programs/thin-test-a/index.html');
  includes(page, 'Not posted yet, ask the program');
  includes(page, 'Its days, hours, prices, grades and pickup schools aren’t posted yet. Claim it to add them yourself.');
  excludes(page, 'Not posted yet; ask the program', 'the page says it its own way, not the placeholder');
  // With no school it is still an after-school listing: on its neighborhood page, not treated as a day-camp listing.
  includes(b.read('neighborhoods/germantown/index.html'), 'thin-test-a');
  // Near a school: its card on the school page says what isn't posted.
  const school = b.read('nebinger/index.html');
  const card = school.slice(school.indexOf('id="thin-test-b"'), school.indexOf('</article>', school.indexOf('id="thin-test-b"')));
  includes(card, 'Not posted yet, ask the program');
  // Build your week knows its days aren't posted.
  includes(b.read('board/index.html'), '"np":["days","hours","cost","grades","pickup"]');
  fs.rmSync(b.work, { recursive: true, force: true });
});

test('the build refuses a notPosted with a word it doesn’t know, and a listing with no school that isn’t thin, a day camp or weekend classes', async () => {
  let b = buildWith(ps => ps.push(thin('thin-test-c', { notPosted: ['hours', 'phone'] })));
  ok(!b.ok); includes(b.out, 'notPosted lists what the provider hasn\'t posted yet');
  fs.rmSync(b.work, { recursive: true, force: true });
  b = buildWith(ps => ps.push(thin('thin-test-d', { notPosted: undefined })));
  ok(!b.ok); includes(b.out, 'not linked to any school');
  fs.rmSync(b.work, { recursive: true, force: true });
  b = buildWith(ps => ps.push(thin('thin-test-e', { neighborhoods: undefined })));
  ok(!b.ok); includes(b.out, 'a listing with no school needs "neighborhoods"');
  fs.rmSync(b.work, { recursive: true, force: true });
});
