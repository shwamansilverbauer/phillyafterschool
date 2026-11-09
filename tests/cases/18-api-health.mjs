// The health answer the hourly check reads: the database, the copies, the mail, and the key /edit/ publishes with.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, ok, eq, matches, excludes, someone } from '../lib/harness.mjs';
import { openCopy } from '../../scripts/restore-backup.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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

test('the note to the owner about a new account goes out on any hourly run, not only in the morning', async ({ api, mail }) => {
  const email = someone('late');
  api().as(email, '', '');   // an account whose address was proven, no name given yet (seeded: no sign-in email spent)
  // Every run sends those due, twenty at a time (the other tests' accounts are waiting too); run until none are left.
  let sent = 0;
  for (let i = 0; i < 20; i++) { const r = await api().okay('POST', 'push_run', { told_age: -5 }); ok(typeof r.told === 'number', JSON.stringify(r)); if (!r.told) break; sent += r.told; }
  ok(sent >= 1, 'notes sent');
  const note = mail.to('contact@phillyafterschool.org').find(m => /New Parent Account Signup/.test(m.Subject) && m.TextBody.includes(email));
  ok(note, 'the owner hears about it');
  ok(note.TextBody.includes('Name: not added yet'));
  eq((await api().okay('POST', 'push_run', { told_age: -5 })).told || 0, 0, 'once');
});

test('the copy off the host: encrypted, sent once a day, then fetched back and opened (the restore drill)', async ({ api, site, github }) => {
  const keyFile = path.join(site.dir, 'phillyafterschool-github.key'), bk = github.backup;
  const run = async (force = true) => (await api().okay('POST', 'push_run', force ? { offsite_force: true } : {})).offsite;
  const email = someone('offsite');
  api().as(email, 'Dana', 'Reyes');
  // No key file on the server: it says so, and the health answer carries it.
  try { fs.unlinkSync(keyFile); } catch (e) { /* none */ }
  let r = await run();
  eq(r.state, 'failed'); eq(r.why, 'no key');
  let h = await api().okay('GET', 'health');
  eq(h.offsite.on, true); eq(h.offsite.ok, false); eq(h.offsite.why, 'no key');
  // A key that hasn't been given the backup repository.
  fs.writeFileSync(keyFile, fakeKey() + '\n');
  bk.noAccess = true;
  eq((await run()).why, 'no access');
  bk.noAccess = false;
  // A listing photo waits to go too.
  const photo = JSON.parse(execFileSync('php', [path.join(ROOT, 'tests/lib/db.php'), path.join(site.dataDir, 'groups.sqlite'), 'photo'], { encoding: 'utf8' })).id;
  const jpg = crypto.randomBytes(5000);
  fs.mkdirSync(path.join(site.dataDir, 'photos'), { recursive: true });
  fs.writeFileSync(path.join(site.dataDir, 'photos', photo + '.jpg'), jpg);
  const before = bk.log().length;
  r = await run();
  eq(r.state, 'sent', JSON.stringify(r)); ok(r.photos >= 1, 'the photo went with it');
  eq(bk.log().length, before + 1, 'one commit');
  matches(bk.log()[0], /^Copy of \d{4}-\d{2}-\d{2}/);
  // What the repository holds can't be read without secret.key.
  const enc = bk.file('groups.sqlite.enc'), manifest = JSON.parse(bk.file('backup.json').toString());
  eq(enc.subarray(0, 5).toString(), 'PASB1');
  excludes(enc.toString('latin1'), 'SQLite format', 'not a readable database');
  excludes(bk.file('backup.json').toString(), email, 'the manifest has counts, no one’s details');
  ok(manifest.rows.users >= 1, 'row counts recorded');
  // The restore, as it would be done anywhere: the script opens the copy with secret.key, checks it against backup.json,
  // and the database it writes is whole and has everyone in it.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-restore-'));
  fs.writeFileSync(path.join(tmp, 'groups.sqlite.enc'), enc); fs.writeFileSync(path.join(tmp, 'backup.json'), bk.file('backup.json'));
  const said = execFileSync('node', [path.join(ROOT, 'scripts/restore-backup.mjs'), path.join(tmp, 'groups.sqlite.enc'), path.join(site.dataDir, 'secret.key'), path.join(tmp, 'groups.sqlite')], { encoding: 'utf8' });
  matches(said, /Matches backup\.json/);
  const restored = q => JSON.parse(execFileSync('php', [path.join(ROOT, 'tests/lib/db.php'), path.join(tmp, 'groups.sqlite'), 'select', q], { encoding: 'utf8' }));
  ok(restored("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'")[0].n > 10, 'every table is there');
  eq(restored('SELECT COUNT(*) AS n FROM users')[0].n, manifest.rows.users);
  eq(restored(`SELECT first FROM users WHERE email = '${email}'`)[0].first, 'Dana', 'the account is in it');
  // The photo comes back byte for byte; a different key opens nothing.
  const secretHex = fs.readFileSync(path.join(site.dataDir, 'secret.key'), 'utf8').trim();
  ok(openCopy(bk.file('photos/' + photo + '.jpg.enc'), secretHex).equals(jpg), 'the photo, as it was');
  let refused = false;
  try { openCopy(enc, crypto.randomBytes(32).toString('hex')); } catch (e) { refused = /does not open/.test(e.message); }
  ok(refused, 'another key can’t open it');
  fs.rmSync(tmp, { recursive: true, force: true });
  // The health answer: verified today, nothing left, and the key never shown.
  h = await api().okay('GET', 'health');
  eq(h.offsite.ok, true); eq(h.offsite.ageDays, 0); eq(h.offsite.photosLeft, 0); eq(h.offsite.why, '');
  excludes(JSON.stringify(h), 'x'.repeat(20));
  // Once a day: the next hourly run sends nothing more.
  eq((await run(false)).state, 'done');
  eq(bk.log().length, before + 1, 'still one commit today');
  fs.unlinkSync(keyFile);
  try { fs.unlinkSync(path.join(site.dir, 'phillyafterschool-github-check.json')); } catch (e) { /* none */ }
});
