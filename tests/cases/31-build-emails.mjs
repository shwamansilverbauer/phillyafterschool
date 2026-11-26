// The emails as the live settings build them: /edit/emails/ lists what the site sends and leaves out what is switched
// off (mailbox replies while people's mail stays in the inbox, outreach while it's off, the answer copies), and the
// claims page's emails are listed there too, with an edit made on /edit/emails/ reaching the claims page. Built from a
// copy of the repository, so the real data is left alone.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { test, ok, eq, includes, excludes, ROOT, TODAY } from '../lib/harness.mjs';

const copyId = text => crypto.createHash('sha1').update(text).digest('hex').slice(0, 10);

function buildWith(change) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-emails-'));
  for (const f of ['build.mjs', 'site.config.json', 'data', 'src', 'email', 'scripts']) fs.cpSync(path.join(ROOT, f), path.join(work, f), { recursive: true });
  change(work);
  const r = spawnSync('node', ['build.mjs'], { cwd: work, encoding: 'utf8', env: { ...process.env, PAS_TODAY: TODAY, PAS_NO_HISTORY: '1' }, maxBuffer: 64e6 });
  return { work, ok: r.status === 0, out: (r.stdout || '') + (r.stderr || ''), read: p => fs.readFileSync(path.join(work, 'dist', p), 'utf8') };
}
const headings = html => [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map(m => m[1]);

test('the live email settings: mail people write stays in the inbox, outreach and answer copies are off, and /edit/emails/ lists only what goes out, the claims page’s emails included', async () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
  eq(live.mail.people, 'inbox'); eq(live.mail.outreach, 'off'); eq(live.ownerNotes.answerCopies, 'off');
  const declined = 'Thanks so much for claiming “{name}” on {site}! Unfortunately, we weren’t able to confirm that you run it, so the claim has been declined for now.';
  const b = buildWith(work => {
    const file = path.join(work, 'data/copy.json');
    const copy = JSON.parse(fs.readFileSync(file, 'utf8'));
    copy[copyId(declined)] = { was: declined, now: 'Sorry, {first}: we couldn’t confirm that you run “{name}”, so we declined the claim for now.', on: TODAY };
    fs.writeFileSync(file, JSON.stringify(copy, null, 2) + '\n');
  });
  ok(b.ok, b.out.slice(-2000));
  const editor = b.read('edit/emails/index.php');
  const names = headings(editor);
  for (const n of ['Your claim is approved (sent from the claims page)', 'About your claim, when you decline it or take it away (sent from the claims page)', 'A premium listing (sent when you make one premium on the claims page)', 'Code to claim a listing, sent to the address the listing’s website publishes'])
    ok(names.includes(n), 'listed: ' + n);
  for (const off of [/^Mailbox/, /^Outreach:/, /^A copy of an answer/, /^Something a manager added/, /^The last line of every answer/]) ok(!names.some(n => off.test(n)), 'not listed: ' + off);
  excludes(editor, 'It’s the only email about it', 'no small print under the answers');
  excludes(editor, 'while premium listings are being tried out');
  // The claims page: the reasons to pick from, the edited sentence, and no email about photos or words.
  const claims = b.read('edit/claims/index.php');
  includes(claims, '<option value="no-reach">We couldn’t reach the program</option>'); includes(claims, '<option value="other">Other: type it</option>');
  includes(claims, 'we couldn’t confirm that you run “{name}”, so we declined the claim for now.'); excludes(claims, declined);
  excludes(claims, 'is on the listing now'); excludes(claims, 'We’re still trying these out');
  // The host knows the switches.
  const api = b.read('groups/api.php');
  includes(api, '"peopleMail":"inbox"'); includes(api, '"outreach":"off"');
  includes(b.read('edit/queue/index.php'), '$PEOPLE_MAIL = "inbox";');
  fs.rmSync(b.work, { recursive: true, force: true });
});
