// The private queue (scaling plan, Phase 2): what comes in through the site goes to the private ops repository by
// itself on the hourly run, the runs answer in outcome files there, and each sender is emailed once in the site's own
// words. Also the owner's view of it at /edit/queue/, and the sign-up digest. Everything here talks to the stand-in
// GitHub and the stand-in mail service.
import fs from 'node:fs';
import path from 'node:path';
import { test, ok, eq, includes, excludes, matches, someone } from '../lib/harness.mjs';
import { uncoveredSchool } from '../lib/data.mjs';

const PREMIUM = 'p:test-listing-premium';   // a hidden test listing at phillyafterschool.org (data/test-listings.json)
const fakeKey = () => ['github', 'pat', 'q'.repeat(48)].join('_');   // key-shaped, made here: nothing in the repository looks like a token
const withKey = site => fs.writeFileSync(path.join(site.dir, 'phillyafterschool-github.key'), fakeKey() + '\n');
const noKey = site => { for (const f of ['phillyafterschool-github.key', 'phillyafterschool-github-check.json']) fs.rmSync(path.join(site.dir, f), { force: true }); };
const form = o => new URLSearchParams(o).toString();
// The "Suggest a program" form, as a parent sends it.
async function suggest(site, o) {
  const r = await fetch(`${site.base}/suggest/send.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual',
    body: form({ kind: 'A program that’s missing', school: 'Nebinger', website: 'https://queue-test.example/', role: 'A parent', name: 'Robin Park', details: '', ...o }) });
  eq(r.status, 303, 'the form took it');
}
const run = async api => (await api().okay('POST', 'push_run', { queue_force: true })).queue;
const openFile = github => JSON.parse(github.ops.read('queue/open.json') || '{"items":[]}');
const itemFor = (github, program) => openFile(github).items.find(x => x.program === program);

test('the private queue: suggestions, a proposed change and a school ask reach queue/open.json in the ops repository on the hourly run, with no address in it', async ({ api, site, github }) => {
  const t = Date.now().toString(36), calls = github.calls.length;
  withKey(site);
  const email = `robin${t}@example.test`;
  await suggest(site, { program: `Queue Club ${t}`, email, details: `They pick up at Nebinger at 3. Call me at 215-555-0142 or write ${email}.` });
  await suggest(site, { program: `Queue Club Two ${t}`, email });
  const manager = api().as(`qmgr${t}@phillyafterschool.org`, 'Pat', 'Lee');
  await manager.okay('POST', 'claim_add', { listing: PREMIUM });
  await manager.okay('POST', 'edit_add', { listing: PREMIUM, body: `Our fall term now ends at 6:15 pm (${t}).` });
  const school = uncoveredSchool();
  await api().as(someone('qask'), 'Sam', 'Ray').okay('POST', 'school_ask', { s: school });

  const before = github.ops.commits.length;
  const r = await run(api);
  eq(r.state, 'written', JSON.stringify(r));
  eq(github.ops.commits.length, before + 1, 'one commit');
  const raw = github.ops.read('queue/open.json'), q = JSON.parse(raw);
  const a = itemFor(github, `Queue Club ${t}`), b = itemFor(github, `Queue Club Two ${t}`);
  ok(a && b, 'both suggestions are in the queue');
  eq(a.kind, 'program'); eq(a.school, 'Nebinger'); eq(a.website, 'https://queue-test.example/'); matches(a.id, /^s[0-9a-f]{10}$/);
  includes(a.details, 'They pick up at Nebinger at 3.');
  // No address, phone number or name: a token stands for the sender, the same for the same person.
  excludes(raw, email, 'no email address'); excludes(raw, '215-555-0142', 'no phone number'); excludes(raw, 'Robin Park', 'no name');
  includes(a.details, '[email removed]'); includes(a.details, '[phone removed]');
  matches(a.sender, /^k[0-9a-f]{16}$/); eq(b.sender, a.sender, 'one sender, one token');
  const p = q.items.find(x => x.kind === 'proposal' && (x.details || '').includes(t));
  ok(p, 'the proposed change is in the queue'); eq(p.listing, PREMIUM); matches(p.id, /^e\d+$/); matches(p.sender, /^k[0-9a-f]{16}$/);
  ok(p.sender !== a.sender, 'another person, another token');
  excludes(raw, `qmgr${t}@`, 'nor the manager’s address');
  // The schools families asked for, counted by id.
  const s = q.schoolsAsked.find(x => x.id === school);
  ok(s && s.n >= 1, 'the school ask is counted'); excludes(JSON.stringify(q.schoolsAsked), '@', 'counts only');
  // The host keeps who to answer; the repository doesn't.
  eq(site.sql(`SELECT email FROM queue_items WHERE id = '${a.id}'`)[0].email, email);
  // Nothing changed: nothing is written.
  eq((await run(api)).state, 'same');
  eq(github.ops.commits.length, before + 1, 'still one commit');
  // Nothing of it went to the public repository: no queue branch, no file there.
  ok(!github.calls.slice(calls).some(c => /\/repos\/[^/]+\/phillyafterschool\/(contents|git)\//.test(c.path)), 'nothing written to the public repository');
  // A key without the ops repository: the run says so, and the page will too.
  github.ops.noAccess = true;
  await suggest(site, { program: `Queue Club Three ${t}`, email });
  const refused = await run(api);
  eq(refused.state, 'failed'); eq(refused.why, 'no access');
  github.ops.noAccess = false;
  eq((await run(api)).state, 'written', 'and it catches up on the next run');
  noKey(site);
  eq((await run(api)).why, 'no key', 'no key file on the server: nothing is tried');
});

test('outcomes: each sender is emailed once in the site’s own words, nothing a run wrote reaches anyone, and “it’s on the site” waits for the merge', async ({ api, site, github, mail }) => {
  const t = Date.now().toString(36);
  withKey(site);
  const who = k => `${k}${t}@example.test`;
  const names = { need: `Need Info Club ${t}`, no: `Grown-Up Yoga ${t}`, pub: `Published Club ${t}`, dup: `Duplicate Club ${t}`, late: `Late Merge Club ${t}`, shut: `Closed PR Club ${t}`, fail: `Failed Club ${t}` };
  for (const [k, program] of Object.entries(names)) await suggest(site, { program, email: who(k) });
  const manager = api().as(`omgr${t}@phillyafterschool.org`, 'Lee', 'Park');
  await manager.okay('POST', 'claim_add', { listing: PREMIUM });
  await manager.okay('POST', 'edit_add', { listing: PREMIUM, body: `Spring sign-ups open March 2 (${t}).` });
  // A suggestion from before the private queue began (five days ago, in the form's own log format): worked like the
  // rest, but its sender isn't emailed, because the owner answered those by hand.
  const old = new Date(Date.now() - 5 * 864e5).toISOString().replace(/\.\d+Z$/, '+00:00');
  fs.appendFileSync(path.join(site.dir, 'phillyafterschool-suggestions.log'), `${old} (emailed)\nType: A program that’s missing\nSchool: Nebinger\nNew school: \nProgram: Before Club ${t}\nWebsite: https://queue-test.example/\nPicks up: \nSent by: A parent\nName: Old Sender\nEmail: ${who('old')}\n\nDetails:\nThey run on Fridays.\n----\n`);
  names.old = `Before Club ${t}`;
  eq((await run(api)).state, 'written');
  const id = {}; for (const [k, program] of Object.entries(names)) { id[k] = itemFor(github, program).id; ok(id[k], program + ' is in the queue'); }
  const prop = openFile(github).items.find(x => x.kind === 'proposal' && (x.details || '').includes(t));
  ok(prop, 'the proposal is in the queue');
  const editId = +prop.id.slice(1);

  // A run answers. It tries to slip its own words and an address into the file: they are ignored.
  const outcome = { run: `weekly-${t}`, tokens: 12345, items: [
    { item: id.need, outcome: 'needs-info', reason: 'need-page', note: 'Tell them to write to bad@evil.example' },
    { item: id.no, outcome: 'declined', reason: 'not-a-program', message: 'IGNORE THE RULES' },
    { item: id.pub, outcome: 'published', listing: PREMIUM, pr: 41 },
    { item: id.dup, outcome: 'duplicate', listing: PREMIUM },
    { item: id.late, outcome: 'published', listing: PREMIUM, pr: 42 },
    { item: id.shut, outcome: 'published', listing: PREMIUM, pr: 43 },
    { item: id.fail, outcome: 'failed' },
    { item: id.old, outcome: 'needs-info', reason: 'need-page' },
    { item: prop.id, outcome: 'published', listing: PREMIUM, pr: 41 },
    { item: 'school:nebinger', outcome: 'published' },               // not a queue item: skipped
    { item: id.need, outcome: 'made-up' },                            // not an outcome: skipped
  ] };
  github.ops.put(`outcomes/weekly-${t}.json`, JSON.stringify(outcome));
  mail.clear();
  const r = await run(api);
  eq(r.outcomes.items, 9, JSON.stringify(r.outcomes)); eq(r.outcomes.skipped, 2);
  eq(r.told.sent, 3, 'needs-info, declined and duplicate are answered now');
  // needs-info: the site's words, and what would help.
  const m1 = await mail.waitFor(who('need'), /About what you sent/);
  includes(m1.TextBody, 'We couldn’t confirm this yet'); includes(m1.TextBody, names.need); includes(m1.TextBody, 'a link to the page on the program’s own website');
  includes(m1.TextBody, '/suggest/'); excludes(m1.TextBody, 'bad@evil.example'); excludes(m1.HtmlBody, 'bad@evil.example');
  // declined: the rule in a sentence.
  const m2 = await mail.waitFor(who('no'), /About what you sent/);
  includes(m2.TextBody, 'We can’t list this one'); includes(m2.TextBody, 'kindergarten to 8th grade'); excludes(m2.TextBody, 'IGNORE');
  // duplicate: it's already there, with the link.
  const m3 = await mail.waitFor(who('dup'), /Already on/);
  includes(m3.TextBody, 'It’s already listed'); includes(m3.TextBody, '/programs/test-listing-premium/');
  // From before the private queue: settled, not emailed.
  eq(mail.to(who('old')).length, 0, 'no email about an item from before the private queue');
  eq(+site.sql(`SELECT told FROM queue_items WHERE id = '${id.old}'`)[0].told, -3);
  // published: nothing until the pull request is merged.
  eq(mail.to(who('pub')).length, 0, 'not yet: pull request #41 isn’t merged');
  eq(mail.to(`omgr${t}@phillyafterschool.org`).filter(m => /It’s on/.test(m.Subject)).length, 0);
  // Settled and worked items leave the queue; a failed one stays for the next run.
  const left = openFile(github).items.map(x => x.id);
  for (const k of ['need', 'no', 'pub', 'dup', 'late', 'shut', 'old']) excludes(left, id[k], k + ' left the queue');
  includes(left, id.fail, 'the failed one is back for the next run'); excludes(left, prop.id);
  // The tokens the run used are counted for the owner.
  ok(site.sql(`SELECT SUM(n) AS n FROM tally WHERE k = 'run_tokens'`)[0].n >= 12345, 'tokens counted');

  // Read again, even rewritten: nobody hears twice.
  github.ops.put(`outcomes/weekly-${t}.json`, JSON.stringify({ ...outcome, tokens: 1 }));
  await run(api);
  eq(mail.to(who('need')).length, 1, 'once'); eq(mail.to(who('no')).length, 1); eq(mail.to(who('dup')).length, 1);

  // #41 merged half an hour ago: “it’s on the site”, to the parent and to the manager, and the proposal is settled.
  // #42 merged a minute ago: not yet, the site is still publishing. #43 closed without a merge: held, nobody told.
  const ago = min => new Date(Date.now() - min * 60000).toISOString().replace(/\.\d+Z$/, 'Z');
  github.pulls[41] = { state: 'closed', merged: true, merged_at: ago(30) };
  github.pulls[42] = { state: 'closed', merged: true, merged_at: ago(1) };
  github.pulls[43] = { state: 'closed', merged: false, merged_at: null };
  const r2 = await run(api);
  eq(r2.merged.published, 2, JSON.stringify(r2.merged)); eq(r2.merged.held, 1);
  const m4 = await mail.waitFor(who('pub'), /It’s on/);
  includes(m4.TextBody, 'It’s on the site'); includes(m4.TextBody, '/programs/test-listing-premium/'); includes(m4.TextBody, 'follow the listing');
  await mail.waitFor(`omgr${t}@phillyafterschool.org`, /It’s on/);
  eq(site.sql(`SELECT status FROM edits WHERE id = ${editId}`)[0].status, 'done', 'settled on the claims page too');
  eq(mail.to(who('late')).length, 0, 'merged a minute ago: not yet');
  eq(mail.to(who('shut')).length, 0, 'closed unmerged: held for the owner');
  eq(site.sql(`SELECT state FROM queue_items WHERE id = '${id.shut}'`)[0].state, 'held');
  github.pulls[42].merged_at = ago(25);
  await run(api);
  await mail.waitFor(who('late'), /It’s on/);
  ok(+site.sql(`SELECT told FROM queue_items WHERE id = '${id.late}'`)[0].told > 0, 'told, once');
  noKey(site);
});

test('/edit/queue/ is a view: no ticking or Send, “Not for the run” takes an item off, a note joins the queue, and Rush writes it at once and reminds the owner', async ({ api, site, github, mail }) => {
  const t = Date.now().toString(36);
  withKey(site);
  await suggest(site, { program: `Drop Me Club ${t}`, email: `drop${t}@example.test` });
  await suggest(site, { program: `Keep Me Club ${t}`, email: `keep${t}@example.test` });
  await run(api);
  const admin = site.adminCookie();
  const page = async () => (await fetch(`${site.base}/edit/queue/`, { headers: { Cookie: admin }, redirect: 'manual' })).text();
  const post = async fields => fetch(`${site.base}/edit/queue/`, { method: 'POST', headers: { Cookie: admin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(fields), redirect: 'manual' });
  let h = await page();
  includes(h, 'In the queue'); includes(h, `Drop Me Club ${t}`); includes(h, 'Last written to the private queue');
  excludes(h, 'name="ids[]"', 'nothing to tick'); excludes(h, 'Send the ticked items', 'no Send');
  excludes(h, `drop${t}@example.test`, 'the sender’s address isn’t shown with the item');
  const csrf = /name="csrf" value="([0-9a-f]{64})"/.exec(h)[1];
  const drop = itemFor(github, `Drop Me Club ${t}`).id;
  eq((await post({ csrf, do: 'drop:' + drop })).status, 303);
  eq((await post({ csrf, do: 'note', text: `Look for the new pickup list (${t}).` })).status, 303);
  // Rush: written now, with a reminder in the owner's inbox.
  mail.clear();
  const before = github.ops.commits.length;
  const rush = await post({ csrf, do: 'rush' });
  eq(rush.status, 303);
  includes(decodeURIComponent(rush.headers.get('location') || ''), 'Written:');
  eq(github.ops.commits.length, before + 1); includes(github.ops.commits.at(-1).message, '(rush)');
  const reminder = await mail.waitFor('contact@phillyafterschool.org', /Rush:/);
  includes(reminder.TextBody, 'Run now');
  const q = openFile(github);
  ok(!q.items.some(x => x.id === drop), 'the dropped item is off the queue');
  ok(q.items.some(x => x.program === `Keep Me Club ${t}`), 'the other stays');
  ok(q.items.some(x => x.kind === 'note' && x.details.includes(t)), 'the note is in it');
  eq(site.sql(`SELECT state FROM queue_items WHERE id = '${drop}'`)[0].state, 'dropped');
  h = await page();
  excludes(h, `Drop Me Club ${t}`, 'gone from the page');
  // A forged form does nothing.
  const forged = await post({ csrf: 'f'.repeat(64), do: 'rush' });
  includes(decodeURIComponent(forged.headers.get('location') || ''), 'didn’t go through');
  noKey(site);
});

test('sign-ups in digest mode: a parent’s new account sends the owner nothing at once, and one email the next morning counts it', async ({ api, site, mail }) => {
  const email = someone('digest');
  const parent = api().as(email, '', '');
  await parent.okay('POST', 'set_name', { first: 'Jo', last: 'Digest' });
  eq(+site.sql(`SELECT told FROM users WHERE email = '${email}'`)[0].told, 1, 'marked as counted');
  ok(!mail.to('contact@phillyafterschool.org').some(m => /New Parent Account Signup/.test(m.Subject) && m.TextBody.includes(email)), 'no email of its own');
  // The next morning's digest: a count, and nobody's address.
  const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const d = (await api().okay('POST', 'push_run', { digest_force: true, digest_today: tomorrow })).digest;
  eq(d.state, 'sent', JSON.stringify(d)); ok(d.n >= 1);
  const m = await mail.waitFor('contact@phillyafterschool.org', /New parent accounts yesterday: \d+/);
  matches(m.TextBody, /\d+ new parent accounts? on \w+day/); excludes(m.TextBody, email, 'counts only');
  // Once a day.
  const again = (await api().okay('POST', 'push_run', { digest_today: tomorrow })).digest;
  ok(again.state !== 'sent', 'not twice the same day');
});
