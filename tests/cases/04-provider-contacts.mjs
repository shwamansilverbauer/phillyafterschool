// The providers behind the listings, for the claim-outreach sheet (scripts/provider-contacts.mjs), read without
// touching any site: every listing is in exactly one row, and a provider already in the sheet isn't offered again.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, ok, eq, ROOT } from '../lib/harness.mjs';

test('provider contacts: one row a provider, every listing once, and none already in the sheet offered again', () => {
  const run = (...a) => JSON.parse(execFileSync('node', [path.join(ROOT, 'scripts/provider-contacts.mjs'), '--offline', ...a], { encoding: 'utf8', maxBuffer: 64e6 }));
  const rows = run();
  const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/programs.json'), 'utf8')).filter(p => !/-clubs$/.test(p.id) && !/^test-/.test(p.id));
  const C = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/camps.json'), 'utf8')).camps;
  const links = rows.flatMap(r => r.links.split('\n'));
  eq(links.length, P.length + C.length, 'every program and camp, once');
  eq(new Set(links).size, links.length, 'no listing twice');
  for (const r of rows) ok(r.provider && r.type && 'email' in r && 'canClaim' in r, 'a full row: ' + JSON.stringify(r).slice(0, 120));
  ok(!rows.some(r => /@/.test(r.email) && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(r.email)), 'emails look like emails');
  // The sheet's Website and Links columns as --known: nothing is new.
  const known = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'contacts-')), 'known.txt');
  fs.writeFileSync(known, rows.flatMap(r => [r.website, ...r.links.split('\n')]).filter(Boolean).join('\n'));
  eq(run('--known', known).length, 0, 'a provider already in the sheet is not offered again');
  // Leave one provider out of it: only that one comes back.
  const one = rows.find(r => r.type === 'Provider' && r.website);
  fs.writeFileSync(known, rows.filter(r => r !== one).flatMap(r => [r.website, ...r.links.split('\n')]).filter(Boolean).join('\n'));
  eq(run('--known', known).map(r => r.provider).join(' | '), one.provider, 'only the one missing from the sheet');
});
