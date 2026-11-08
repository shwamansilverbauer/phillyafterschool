// The health answer the hourly check reads: the database, the copies, the mail, and the key /edit/ publishes with.
import fs from 'node:fs';
import path from 'node:path';
import { test, ok, eq, excludes } from '../lib/harness.mjs';

// A key-shaped value made here, so nothing in the repository looks like a real token.
const fakeKey = () => ['github', 'pat', 'x'.repeat(48)].join('_');

test('health: the publishing key is reported as working, with the days it has left, and never shown', async ({ api, site, github }) => {
  const keyFile = path.join(site.dir, 'phillyafterschool-github.key'), cache = path.join(site.dir, 'phillyafterschool-github-check.json');
  const fresh = () => { try { fs.unlinkSync(cache); } catch (e) { /* none yet */ } };
  const h0 = await api().okay('GET', 'health');
  ok(!('editKey' in h0), 'no key file: nothing said about one');
  fs.writeFileSync(keyFile, fakeKey() + '\n'); fresh();
  // Runs out in ten days.
  github.refuse = false; github.expires = new Date(Date.now() + 10.5 * 864e5).toISOString().replace('T', ' ').replace(/\..*/, ' UTC');
  let h = await api().okay('GET', 'health');
  eq(h.editKey.ok, true); eq(h.editKey.daysLeft, 10, 'ten days left');
  excludes(JSON.stringify(h), 'x'.repeat(20), 'the key itself is never in the answer');
  // The answer is remembered: GitHub isn't asked again on the next health check.
  const asked = github.calls.length;
  await api().okay('GET', 'health');
  eq(github.calls.length, asked, 'remembered for six hours');
  // A key with no end date.
  fresh(); github.expires = '';
  h = await api().okay('GET', 'health');
  eq(h.editKey.ok, true); eq(h.editKey.daysLeft, null);
  // GitHub refuses it (expired or taken back).
  fresh(); github.refuse = true;
  h = await api().okay('GET', 'health');
  eq(h.editKey.ok, false); eq(h.editKey.why, 'refused');
  // A new key in the file is checked at once, without waiting out the six hours.
  github.refuse = false; github.expires = new Date(Date.now() + 200.5 * 864e5).toISOString().replace('T', ' ').replace(/\..*/, ' UTC');
  fs.writeFileSync(keyFile, fakeKey().replace(/x+$/, 'y'.repeat(48)) + '\n');
  h = await api().okay('GET', 'health');
  eq(h.editKey.ok, true); eq(h.editKey.daysLeft, 200);
  // Not a key at all.
  fs.writeFileSync(keyFile, 'hello\n');
  h = await api().okay('GET', 'health');
  eq(h.editKey.ok, false); eq(h.editKey.why, 'not a key');
  fs.unlinkSync(keyFile); fresh();
});
