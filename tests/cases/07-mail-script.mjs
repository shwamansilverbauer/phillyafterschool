// The mailbox script's own rules (mail/Code.gs, scaling plan Phase 5), run under Node with a stand-in for Google's
// services: how thirty made-up emails are filed, reading headers and Google's Authentication-Results, trimming quoted
// history, opt-outs, the signature the site checks, and the outreach sender's choices. Nothing here reaches Google.
import crypto from 'node:crypto';
import { test, ok, eq, deepEq, includes, excludes, matches } from '../lib/harness.mjs';
import { google, rawMessage, googleAuth, SITE_ADDRESS } from '../lib/gas.mjs';
import { MAIL_FIXTURES, DAY } from '../lib/mail-fixtures.mjs';

const pure = () => google({ site: null }).script;

test('the mailbox script files thirty made-up emails as the rules say: notices, services (four kinds starred), newsletters, bounces, automatic replies, people, and what it leaves alone', async () => {
  const s = pure();
  const started = Date.now() - 1000;
  const ctx = { own: [SITE_ADDRESS, 'mailbox@schoolsoutwhatnow.example'], siteDomain: 'phillyafterschool.org', started };
  eq(MAIL_FIXTURES.length, 30, 'thirty emails');
  for (const [e, want] of MAIL_FIXTURES) {
    const headers = s.parseHeaders(rawMessage({ from: e.from, subject: e.subject, headers: { ...(e.replyTo ? { 'Reply-To': e.replyTo } : {}), ...(e.headers || {}) }, auth: e.auth || '', text: e.text || '' }));
    const from = s.parseAddress(e.from);
    const m = { fromAddress: from.address, fromName: from.name, replyTo: e.replyTo || '', subject: e.subject, date: e.old ? started - DAY : Date.now(), headers, auth: s.parseAuth(headers['authentication-results']) };
    const got = s.classify(m, ctx);
    const what = `"${e.subject}"`;
    eq(got.action, want.action, what);
    if ('label' in want) eq(got.label, want.label, what + ' label');
    if ('inbox' in want) eq(!!got.inbox, want.inbox, what + ' stays in the inbox');
    eq(!!got.star, !!want.star, what + ' starred');
    if ('via' in want) eq(got.via, want.via, what + ' via');
  }
});

test('headers are read whole (folded lines too), and only the Authentication-Results Google put on top counts: a look-alike lower down is ignored', async () => {
  const s = pure();
  const raw = ['Authentication-Results: mx.google.com;', '       dkim=pass header.i=@sunny.example.test header.s=s1;', '       spf=pass (google.com: domain of a@sunny.example.test designates 192.0.2.1) smtp.mailfrom=a@sunny.example.test;', '       dmarc=pass header.from=sunny.example.test',
    'Authentication-Results: fake.example; dkim=pass header.i=@github.com', 'From: Pat <pat@sunny.example.test>', 'Subject: Hello', '', 'Body: not a header'].join('\r\n');
  const h = s.parseHeaders(raw);
  eq(h['authentication-results'].length, 2);
  eq(h.subject[0], 'Hello');
  ok(!h.body, 'the body is not read as headers');
  const a = s.parseAuth(h['authentication-results']);
  deepEq(JSON.parse(JSON.stringify(a)), { spf: 'pass', spfDomain: 'sunny.example.test', dkim: [{ d: 'sunny.example.test', r: 'pass' }], dmarc: 'pass' });
  ok(s.passesFor(a, 'mail.sunny.example.test'), 'a subdomain is the same place');
  ok(!s.passesFor(a, 'github.com'), 'the look-alike header proves nothing');
  // With no header from Google at all, nothing passes.
  ok(!s.passesFor(s.parseAuth(['spoof.example; dkim=pass header.i=@phillyafterschool.org']), 'phillyafterschool.org'));
});

test('quoted history is trimmed (Gmail, Outlook, "Original Message", lines starting with >), and short "stop" replies are opt-outs', async () => {
  const s = pure();
  eq(s.trimQuoted('Thanks, the new hours are 3 to 6.\n\nOn Mon, Dec 7, 2026 at 9:00 AM Philly After School <contact@phillyafterschool.org> wrote:\n> Hello Sunny Club team,\n> old text'), 'Thanks, the new hours are 3 to 6.');
  eq(s.trimQuoted('Yes please.\nOn Mon, Dec 7, 2026 at 9:00 AM Philly After School\n<contact@phillyafterschool.org> wrote:\n> quoted'), 'Yes please.');
  eq(s.trimQuoted('Sounds good.\n\n________________________________\nFrom: Philly After School\nSent: Monday\nold'), 'Sounds good.');
  eq(s.trimQuoted('Fine.\n-----Original Message-----\nFrom: x'), 'Fine.');
  eq(s.trimQuoted('> you asked\nMy answer\n> more\nAnd more'), 'My answer\nAnd more');
  for (const t of ['STOP', 'Stop.', 'unsubscribe', 'Please remove us from your list, thanks.', 'Do not email us again.', 'Not interested']) ok(s.isOptOut(t), `"${t}" opts out`);
  for (const t of ['Can you stop by our open house?', 'We picked up from Fell until we had to stop last year. ' + 'x'.repeat(400), 'Yes, how do we claim it?']) ok(!s.isOptOut(t), `"${t.slice(0, 40)}" is not an opt-out`);
  eq(s.formField('Topic: A question\nName: Zoe Park\nEmail: zoe@example.test', 'Name'), 'Zoe Park');
});

test('the signature the script sends is the HMAC-SHA256 the site checks: over the time, the one-time value, the action and the body', async () => {
  const s = pure();
  const secret = 'f'.repeat(48), body = JSON.stringify({ message: { subject: 'Hours — 3 to 6:30' } });
  const h = s.signature('mail_in', body, 1700000000, 'abcdef0123456789abcdef', secret);
  const want = crypto.createHmac('sha256', secret).update('1700000000.abcdef0123456789abcdef.mail_in.' + body, 'utf8').digest('hex');
  eq(h, `t=1700000000,n=abcdef0123456789abcdef,s=${want}`);
  matches(h, /^t=\d{10},n=[A-Za-z0-9_-]{16,64},s=[0-9a-f]{64}$/, 'the shape the site reads');
});

test('outreach picks the next email for a row only when it may: published address, not claimed, no reply, opt-out or bounce noted, not emailed by hand, and the days between steps have passed', async () => {
  const s = pure();
  const head = ['Provider', 'Email', 'Can they claim with this email?', 'Other emails on their site', 'Email found on', 'Phone', 'Website', 'Listings on Philly After School', 'Links to the listings', 'What it runs', 'Schools it picks up from or runs at', 'Already claimed', 'Type', 'Emailed on', 'Reply / notes', 'Added to this sheet', 'Outreach step', 'Outreach thread'];
  const cols = s.columns(head);
  eq(cols.email, 1); eq(cols.foundOn, 4); eq(cols.link, 8); eq(cols.claimed, 11); eq(cols.emailed, 13); eq(cols.notes, 14); eq(cols.step, 16);
  const seq = [{ after: 0, subject: 'Your listing on Philly After School: {org}', body: 'Hello {org} team, {link} {domain}\n{signature}\n{postal}', bodyReply: 'Reply to claim {org}. {link}\n{signature}\n{postal}' }, { after: 10, subject: 'Follow-up: {org}', body: 'Again {org} {link}\n{signature}\n{postal}' }];
  const fill = { signature: 'Philly After School', postal: 'PO Box 1, Philadelphia' };
  const row = over => { const r = head.map(() => ''); Object.assign(r, { 0: 'Sunny Club', 1: 'hello@sunny.example.test', 2: 'Yes', 4: 'https://sunny.example.test/contact', 6: 'https://www.sunny.example.test/', 8: 'https://phillyafterschool.org/programs/sunny-club/', 11: 'No' }, over); return r; };
  const n1 = s.nextOutreach(row({}), cols, seq, '2026-12-07', [], fill);
  ok(n1.send, JSON.stringify(n1)); eq(n1.step, 1); eq(n1.total, 2); eq(n1.to, 'hello@sunny.example.test');
  eq(n1.subject, 'Your listing on Philly After School: Sunny Club');
  includes(n1.body, 'https://phillyafterschool.org/programs/sunny-club/'); includes(n1.body, 'sunny.example.test'); includes(n1.body, 'PO Box 1, Philadelphia');
  includes(s.nextOutreach(row({ 2: 'Not with this address' }), cols, seq, '2026-12-07', [], fill).body, 'Reply to claim Sunny Club', 'the address isn’t at their website: the reply version');
  const why = (over, today = '2026-12-07', claimed = [], f = fill) => s.nextOutreach(row(over), cols, seq, today, claimed, f).why;
  eq(why({ 4: '' }), 'not published by the organization');
  eq(why({ 1: 'not an address' }), 'no address');
  eq(why({ 11: 'Yes' }), 'claimed');
  eq(why({}, '2026-12-07', ['https://phillyafterschool.org/programs/sunny-club']), 'claimed', 'claimed since the sheet was made');
  eq(why({ 14: 'New with the 2026-11-11 pull request; Opted out 2026-12-08' }), 'stopped');
  eq(why({ 14: 'Bounced 2026-12-08' }), 'stopped');
  eq(why({ 13: '2026-11-20' }), 'emailed by hand');
  eq(why({ 13: '2026-12-01', 16: '1 of 2 · 2026-12-01' }, '2026-12-07'), 'not yet', 'six days after the first: the follow-up waits for ten');
  const n2 = s.nextOutreach(row({ 13: '2026-12-01', 16: '1 of 2 · 2026-12-01' }), cols, seq, '2026-12-11', [], fill);
  ok(n2.send); eq(n2.step, 2); eq(n2.subject, 'Follow-up: Sunny Club');
  eq(why({ 13: '2026-12-01, 2026-12-11', 16: '2 of 2 · 2026-12-11' }, '2027-01-30'), 'done');
  eq(why({}, '2026-12-07', [], { signature: 'Philly After School', postal: '' }), 'nothing for {postal}', 'never without the postal address');
  deepEq(JSON.parse(JSON.stringify(s.parseTabs('Programs=claim, Schools=school,Broken'))), [{ tab: 'Programs', sequence: 'claim' }, { tab: 'Schools', sequence: 'school' }]);
});

test('the outreach cap starts at 30, rises by 10 a week only while bounces and opt-outs stay low, never passes 150, and too many pauses it', async () => {
  const s = pure();
  const week = (sent, bounced, optout) => { const d = {}; for (let i = 0; i < 7; i++) d[`2026-12-0${i + 1}`] = { sent: Math.floor(sent / 7) + (i < sent % 7 ? 1 : 0), bounced: i === 0 ? bounced : 0, optout: i === 1 ? optout : 0, replied: 0 }; return d; };
  eq(s.outreachHealth(week(150, 1, 1), '2026-12-07'), 'ok');
  eq(s.outreachHealth(week(150, 7, 1), '2026-12-07'), 'hold', 'between: keep the cap');
  eq(s.outreachHealth(week(150, 15, 0), '2026-12-07'), 'bad', '10% bounced: pause');
  eq(s.outreachHealth(week(150, 0, 9), '2026-12-07'), 'bad', '6% asked not to hear again: pause');
  eq(s.outreachHealth(week(12, 0, 0), '2026-12-07'), 'hold', 'too few to judge');
  eq(s.outreachHealth(week(150, 1, 1), '2026-12-20'), 'hold', 'last week’s numbers don’t count');
  eq(s.nextCap(30), 40); eq(s.nextCap(145), 150); eq(s.nextCap(150), 150);
});
