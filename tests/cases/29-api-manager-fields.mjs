// A program manager sets its listing's days, hours, price, grades and pickup schools itself (listing_fields): from a
// claim made with an address at the program's own website, the site writes the change on a branch of its own and opens
// a pull request the autopilot gate can confirm (told_check); otherwise the edit goes to the private queue. Uses the
// hidden free test listing (claimDomain joshsilverbauer.com) and the stand-in GitHub, so no real program or repository
// is touched.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { test, ok, eq, includes, excludes, ROOT } from '../lib/harness.mjs';

const FREE = 'p:test-listing-free';
const fakeKey = () => ['github', 'pat', 'm'.repeat(48)].join('_');   // key-shaped, made here: nothing in the repository looks like a token
const withKey = site => fs.writeFileSync(path.join(site.dir, 'phillyafterschool-github.key'), fakeKey() + '\n');
const noKey = site => { for (const f of ['phillyafterschool-github.key', 'phillyafterschool-github-check.json']) fs.rmSync(path.join(site.dir, f), { force: true }); };
const testListing = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data/test-listings.json'), 'utf8')).find(p => 'p:' + p.id === FREE);

test('a manager’s own fields: from a claim at the program’s own domain they go in a pull request the gate can confirm, with a told entry and the evidence, and “Your update is live” follows the merge', async ({ api, site, github, mail }) => {
  const t = Date.now().toString(36);
  withKey(site);
  // main's programs file as the stand-in repository holds it, with the test listing in it
  const rec = { ...testListing(), hours: 'Not posted yet; ask the program', cost: 'Not posted yet', notPosted: ['hours', 'cost'] };
  github.repo.put('data/programs.json', JSON.stringify([rec], null, 2) + '\n');
  const email = `fields${t}@joshsilverbauer.com`;
  const manager = api().as(email, 'Robin', 'Vale');
  eq((await manager.okay('POST', 'claim_add', { listing: FREE })).status, 'ok');
  const mine = (await manager.okay('GET', 'claims')).claims.find(c => c.listing === FREE);
  ok(mine.fields && mine.fields.live, 'the managers page is told these go on by themselves');
  ok(mine.fields.schools && mine.fields.schools.southwark, 'and gets the schools to pick from');
  // Nothing changed: refused. A link in the price: refused.
  await manager.fails('POST', 'listing_fields', { listing: FREE, days: mine.fields.now.days }, 'same');
  await manager.fails('POST', 'listing_fields', { listing: FREE, cost: '$75 a week, see www.example.com' }, 'cost');
  await manager.fails('POST', 'listing_fields', { listing: FREE, from: 'dismissal', to: 'late' }, 'to');
  const r = await manager.okay('POST', 'listing_fields', { listing: FREE, days: ['mon', 'tue', 'wed', 'thu', 'fri'], from: 'dismissal', to: '18:30', cost: '$75 a week', pickup: ['southwark'] });
  ok(r.live, 'it went in a pull request');
  const edit = site.sql(`SELECT id, status, pr, sum, kind FROM edits WHERE listing = '${FREE}' AND kind = 'fields' ORDER BY id DESC LIMIT 1`)[0];
  eq(edit.status, 'pr'); ok(+edit.pr > 0);
  const branch = `manager-edit-test-listing-free-${edit.id}`;
  // The branch has the change, a told entry in the manager's words, and what it covers out of notPosted.
  const progs = JSON.parse(github.repo.read('data/programs.json', branch));
  const p = progs.find(x => x.id === 'test-listing-free');
  eq(p.hours, 'Dismissal to 6:30 pm'); eq(p.pickupBy, '6:30 pm'); eq(p.cost, '$75 a week'); eq(p.days.join(','), 'mon,tue,wed,thu,fri');
  eq(p.schools.southwark.relation, 'pickup');
  eq(p.notPosted, undefined, 'hours and cost are posted now');
  const told = p.told[p.told.length - 1];
  eq(told.by, 'program manager'); eq(told.how, 'from its listing tools');
  includes(told.says, 'Cost: $75 a week.'); includes(told.fields.join(' '), 'schools.southwark.relation');
  eq(github.repo.read('data/programs.json', branch), JSON.stringify(progs, null, 2) + '\n', 'written the way the repository keeps it');
  // The evidence names the edit, and the gate's sum of its records is the one the site holds.
  const ev = JSON.parse(github.repo.read(`evidence/${branch}.json`, branch));
  const item = ev.items[0];
  eq(item.kind, 'told'); eq(item.edit, +edit.id); eq(item.listing, FREE);
  const g = await import('../../scripts/gate.mjs');
  const sum = crypto.createHash('sha256').update(g.toldLines(+edit.id, FREE, item.fields)).digest('hex');
  eq(sum, edit.sum, 'the site and the gate word the values the same way');
  // The pull request: on that branch, with nobody's name or address in it.
  const pr = github.pulls[edit.pr];
  eq(pr.head.ref, branch); includes(pr.title, 'Program manager’s update');
  excludes(pr.body, email); excludes(pr.body, 'Robin');
  // told_check: yes for this edit and these values; no for other values or another listing.
  let c = await api().okay('GET', 'told_check', `id=${edit.id}&listing=${encodeURIComponent(FREE)}&sum=${sum}`);
  eq([c.known, c.match, c.verified].join(), 'true,true,true');
  c = await api().okay('GET', 'told_check', `id=${edit.id}&listing=${encodeURIComponent(FREE)}&sum=${'0'.repeat(64)}`);
  eq(c.match, false);
  c = await api().okay('GET', 'told_check', `id=${edit.id}&listing=${encodeURIComponent('p:test-listing-premium')}&sum=${sum}`);
  eq(c.known, false);
  // It waits for its pull request like a queue item, and the manager hears once it's merged and published.
  eq(site.sql(`SELECT state FROM queue_items WHERE id = 'e${edit.id}'`)[0].state, 'waiting');
  github.pulls[edit.pr] = { ...pr, state: 'closed', merged: true, merged_at: new Date(Date.now() - 3600e3).toISOString() };
  mail.clear();
  await api().okay('POST', 'push_run', { queue_force: true });
  const m = await mail.waitFor(email, /Your update is on/);
  includes(m.TextBody, 'Your update is live'); includes(m.TextBody, 'marked as coming from the program itself');
  excludes(m.TextBody, 'We checked it against the program’s own website', 'not the words for a suggestion');
  eq(site.sql(`SELECT status FROM edits WHERE id = ${edit.id}`)[0].status, 'done');
  noKey(site);
});

test('a manager’s own fields go to the private queue instead when the price has words a person should read first, or the site can’t open a pull request', async ({ api, site, github }) => {
  const t = Date.now().toString(36);
  withKey(site);
  github.repo.put('data/programs.json', JSON.stringify([testListing()], null, 2) + '\n');
  const manager = api().as(`fieldsq${t}@joshsilverbauer.com`, 'Sam', 'Reed');
  await manager.okay('POST', 'claim_add', { listing: FREE });
  // A "best" claim in the price: a person reads it first.
  let r = await manager.okay('POST', 'listing_fields', { listing: FREE, cost: `The best deal in the city, $70 a week (${t})` });
  eq(r.live, false);
  let e = site.sql(`SELECT status, pr FROM edits WHERE listing = '${FREE}' AND kind = 'fields' ORDER BY id DESC LIMIT 1`)[0];
  eq(e.status, 'new'); eq(+e.pr, 0);
  // No key on the host: no pull request, so the queue takes it.
  noKey(site);
  r = await manager.okay('POST', 'listing_fields', { listing: FREE, gradeFrom: 'K', gradeTo: '3' });
  eq(r.live, false);
  e = site.sql(`SELECT status, body FROM edits WHERE listing = '${FREE}' AND kind = 'fields' ORDER BY id DESC LIMIT 1`)[0];
  eq(e.status, 'new'); includes(e.body, 'Grades: K to 3.');
});
