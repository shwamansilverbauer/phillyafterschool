/**
 * Philly After School: the mailbox script (scaling plan, Phase 5). It lives in the repository as mail/Code.gs and runs
 * inside the contact@ Google account, pasted into script.google.com. Nothing outside Google and the site reads the
 * mailbox.
 *
 * Every 10 minutes (a time trigger on run()):
 *   1. sortInbox: the site's own notices (the X-PAS-Kind header the site's mailer adds, or the subject on older mail)
 *      get a PAS/Site label and leave the inbox, apart from the few that ask something of the owner and, while
 *      KEEP_IN_INBOX is on (the default), the ones that show what people sent and what went back: suggestions, feature
 *      ideas, copies of the answers and the morning summary. Mail from GitHub, Stripe, Postmark, Klaviyo, UptimeRobot,
 *      Hostinger and Google gets a PAS/Service label and leaves too, apart from four kinds kept in the inbox with a
 *      star. Anything with a List-Unsubscribe header goes to PAS/Newsletters. Bounces and automatic replies are
 *      labeled and archived. What is left, mail a person wrote, is posted to the site (groups/api.php?action=mail_in)
 *      and labeled PAS/People/Queued, or PAS/People/Needs Josh when the site holds it; while KEEP_IN_INBOX is on it
 *      stays in the inbox either way, and comes back to the inbox when the site's answer goes. Mail older than the day
 *      setup() first ran is never posted: it stays where it is.
 *   2. sendOutreach: when switched on, the next outreach emails from the site's address, inside the daily cap.
 *   3. sendReplies: asks the site for replies waiting to go (action=mail_out, which is also the heartbeat), sends each
 *      from the site's address as a reply in its own thread, changes the labels the site asks for, and says what went
 *      (action=mail_sent).
 *   4. push_run: the site's hourly jobs, so they no longer wait on GitHub's scheduler.
 *
 * Setup, signed in as the contact@ account (docs/emails.md, "The mailbox script", has every step):
 *   1. script.google.com > New project. Name it "Philly After School mailbox". Paste this whole file over Code.gs. Save.
 *   2. Run makeSecret once. Copy the line it logs into a file named phillyafterschool-mailin.key next to the public
 *      folder on the host (where phillyafterschool-postmark.key is). Never put it in the repository or a message.
 *   3. Run setup once and approve the permissions. It makes the labels and the 10-minute trigger, and checks that the
 *      site takes the secret and that the site's address is one this account can send from.
 *
 * Script properties (Project Settings > Script properties). makeSecret and setup write the first two:
 *   MAIL_SECRET          the shared secret (also in phillyafterschool-mailin.key on the host)
 *   STARTED              when setup first ran (mail older than this is never posted)
 *   OUTREACH_ON          "yes" to send outreach; anything else, or nothing, sends none
 *   OUTREACH_SHEET_ID    the id of the outreach sheet (from its address: /spreadsheets/d/<id>/edit)
 *   OUTREACH_TABS        which tabs, and the sequence for each: "Programs=claim" (add "Schools=school",
 *                        "Camps=sponsor" when those tabs exist), comma-separated
 *   POSTAL_ADDRESS       the mailing address at the foot of every outreach email (a PO box, never a home)
 *   OUTREACH_SIGNATURE   the name the outreach emails are signed with (defaults to the site's name)
 *   OUTREACH_CAP         the daily cap now (starts at 30, raised by 10 a week while replies stay healthy, never
 *                        above 150); OUTREACH_PAUSED is set to "yes" when too many bounce or opt out
 *   KEEP_IN_INBOX        "no" files people's mail, suggestions, ideas, answer copies and the morning summary out of
 *                        the inbox (under their labels) as the script first did; anything else, or nothing, keeps
 *                        them in the inbox so the owner sees what came in and what went back
 *   SITE_URL             only to point the script at another copy of the site (the tests do)
 */

var PAS = {
  version: '2026-12-3',
  site: 'https://phillyafterschool.org',
  address: 'contact@phillyafterschool.org',   // the site's address: notices come from it, replies leave from it
  name: 'Philly After School',
  threadsPerRun: 60,          // inbox threads looked at per run, newest first
  unfiledPerRun: 30,          // and, while mail stays in the inbox, threads with none of our labels yet, further down
  postsPerRun: 25,            // emails posted to the site per run; the rest wait ten minutes
  textMax: 8000,              // characters of an email's text sent, after the quoted history is trimmed
  outreachPerRun: 4,          // outreach emails per run, so a day's cap is spread over the morning
  outreachStart: 30, outreachStep: 10, outreachMax: 150,
  outreachHours: [9, 16],     // weekdays, New York time
  timeZone: 'America/New_York',
  // X-PAS-Kind: the notices that stay in the inbox (each asks the owner to do something no other page shows yet).
  // "contact" is the contact form: a person's message, posted to the site like any other.
  keepInInbox: ['review', 'school-date', 'rush', 'copy-email'],
  // And, while KEEP_IN_INBOX is on (the default), the notices that show what people sent and what went back to them:
  // a suggestion, a feature idea, the copy of an answer the site emailed, and the morning summary. They keep their
  // labels either way; mail a person wrote stays in the inbox too.
  showInInbox: ['suggestion', 'idea', 'answer', 'summary'],
  noticeLabels: { signup: 'Sign-ups', suggestion: 'Suggestions', review: 'Reviews', claim: 'Claims', 'needs-yes': 'Needs a yes',
    'manager-content': 'Manager content', 'school-ask': 'School asks', 'school-date': 'School dates', idea: 'Ideas', copy: 'Copy',
    'copy-email': 'Copy', rush: 'Queue', summary: 'Summary', answer: 'Answers' },
  // Older mail, from before the header: the site's subjects, after "[Philly After School] ".
  subjects: [
    [/^New (Parent Account|Program Manager) Signup\b|^New parent accounts yesterday\b/, 'signup'],
    [/^School request:/, 'school-ask'], [/^Listing claimed:/, 'claim'],
    [/^(A claim|A premium sign-up) needs your yes:/, 'needs-yes'],
    [/^(Words|An offer line|Social links|Instagram posts|A Kids’ Playground pin|A photo|A logo) to approve:|^Proposed change:/, 'manager-content'],
    [/^Review:/, 'review'], [/^Contact:/, 'contact'], [/^A date at a school\b/, 'school-date'], [/^A feature idea\b/, 'idea'],
    [/^A school to add\b/, 'school-ask'], [/^(A program that’s missing|A camp that’s missing|An update to a listing)\b/, 'suggestion'],
    [/^Copy published\b/, 'copy'], [/^Copy edits\b/, 'copy-email'], [/^Rush:/, 'rush'], [/^Answer sent:/, 'answer'],
  ],
  // The services, by the base domain of the sender, and which of their emails stay in the inbox with a star.
  services: {
    'github.com': { label: 'GitHub', star: /Site check:/ },
    'stripe.com': { label: 'Stripe', star: /fail|declin|dispute|chargeback|past due|unpaid|action required/i },
    'postmarkapp.com': { label: 'Postmark', star: /bounce|spam complaint|suppress|inactive|reject|refus|paused|suspend|blocked|delivery (issue|problem)/i },
    'klaviyo.com': { label: 'Klaviyo', star: null },
    'uptimerobot.com': { label: 'UptimeRobot', star: /\bdown\b/i },
    'hostinger.com': { label: 'Hostinger', star: null },
    'google.com': { label: 'Google', star: null },
  },
  peopleLabels: ['PAS/People/Queued', 'PAS/People/Needs Josh', 'PAS/People/Answered', 'PAS/People/Done', 'PAS/Spam'],
};

// ===================================================================================================================
// The job
// ===================================================================================================================

/** Every 10 minutes. Each step runs even if an earlier one failed; what failed goes to the site with the heartbeat. */
function run() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;   // the last run is still going
  var report = { errors: [], outreach: null };
  try {
    step_(report, 'sorting the inbox', function () { sortInbox(report); });
    step_(report, 'outreach', function () { sendOutreach(report); });
    step_(report, 'replies', function () { sendReplies(report); });
    step_(report, 'push_run', function () { api_('push_run', {}, false); });
  } finally {
    lock.releaseLock();
  }
}
function step_(report, what, fn) {
  try { fn(); } catch (e) { report.errors.push(what + ': ' + String(e && e.message || e).slice(0, 140)); }
}

// ----- 1. the inbox -----
function sortInbox(report) {
  var box = mailbox_();
  var threads = GmailApp.search('in:inbox', 0, PAS.threadsPerRun);
  // With mail kept in the inbox, the newest 60 can all be threads already filed. Unfiled ones further down (an email
  // the site couldn't take while it was down, say) have no label of ours yet: look for those too.
  if (box.ctx.show) {
    var have = {};
    threads.forEach(function (x) { have[x.getId()] = true; });
    GmailApp.search('in:inbox has:nouserlabels', 0, PAS.unfiledPerRun).forEach(function (x) { if (!have[x.getId()]) threads.push(x); });
  }
  var posted = 0;
  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t], msgs = thread.getMessages();
    var labels = {}, keep = false, archive = false, star = [], fresh = false;
    for (var i = 0; i < msgs.length; i++) {
      var msg = msgs[i], id = msg.getId();
      if (box.seen.has(id)) continue;
      if (!msg.isInInbox()) { box.seen.add(id); continue; }   // the replies and outreach this account sent, in the same thread
      var m = readMessage_(msg);
      var c = classify(m, box.ctx);
      if (c.action === 'person') {
        if (posted >= PAS.postsPerRun) { keep = true; continue; }   // the next run takes it
        var out = handlePerson_(m, c, box, report);
        if (out === null) { keep = true; continue; }                // not posted: tried again next run
        posted++;
        if (out.label) labels[out.label] = true;
        if (out.inbox) keep = true; else archive = true;
      } else if (c.action === 'bounce') {
        noteBounce_(m, box);
        labels[c.label] = true; archive = true;
      } else if (c.action === 'old' || c.action === 'own') {
        keep = true;                                                // left as it is
      } else {
        if (c.label) labels[c.label] = true;
        if (c.star) star.push(msg);
        if (c.inbox) keep = true; else archive = true;
      }
      box.seen.add(id);
      fresh = true;
    }
    if (!fresh) continue;
    for (var name in labels) thread.addLabel(label_(name));
    for (var s = 0; s < star.length; s++) star[s].star();
    if (archive && !keep) thread.moveToArchive();
  }
  box.seen.save();
  if (box.outreach) box.outreach.flush();
}

// An email a person wrote: an opt-out from outreach is noted and filed; anything else is posted to the site. Gives
// { label, inbox } for the thread, or null when it couldn't be posted (it stays in the inbox, unseen, for next time).
function handlePerson_(m, c, box, report) {
  var text = trimQuoted(m.text).slice(0, PAS.textMax);
  var from = c.via === 'form' ? (m.replyTo || '') : m.fromAddress;
  var hit = box.outreachFor(m.thread, from);
  if (hit && isOptOut(text)) {
    hit.mark('Opted out');
    box.outreachCount('optout');
    return { label: 'PAS/Outreach/Opted out', inbox: false };
  }
  var payload = { message: {
    id: m.id, thread: m.thread, via: c.via, fromName: c.via === 'form' ? formField(m.text, 'Name') : m.fromName, from: m.fromAddress,
    replyTo: m.replyTo || '', subject: m.subject, date: Math.floor(m.date / 1000), text: text, attachments: m.attachments,
    auth: { spf: m.auth.spf, dmarc: m.auth.dmarc, dkim: m.auth.dkim }, outreach: hit ? hit.sequence : '' } };
  var r;
  try { r = api_('mail_in', payload, true); } catch (e) {
    // The site refused this one email for good (no usable sender, say): leave it in the inbox for a person, marked.
    if (e.code === 400) return { label: 'PAS/Suspicious', inbox: true };
    report.errors.push('posting an email: ' + String(e.message || e).slice(0, 120));
    return null;
  }
  if (hit) { hit.mark('Replied'); box.outreachCount('replied'); }
  return { label: r.label || 'PAS/People/Queued', inbox: r.state === 'held' || box.ctx.show };
}

// ----- 3. replies, labels and the heartbeat -----
function sendReplies(report) {
  var alias = canSendAsSite_();
  var beat = { version: PAS.version, alias: alias, errors: report.errors.slice(0, 6), outreach: report.outreach || outreachSummary_() };
  var r = api_('mail_out', { beat: beat }, true);
  var done = { sent: [], failed: [], labeled: [] };
  var sentIds = ring_('sent', 400);
  var from = fromOption_(), own = ownAddresses_(), show = keepInInbox_();
  (r.replies || []).forEach(function (x) {
    if (sentIds.has(String(x.id))) { done.sent.push(x.id); return; }   // it went last time; the site never heard
    try {
      var msg = null;
      try { msg = GmailApp.getMessageById(x.message); } catch (e) { msg = null; }
      if (!msg) { done.failed.push({ id: x.id, why: 'gone' }); return; }
      var opts = { name: PAS.name };
      if (from) opts.from = from;
      // A reply in the thread, unless the message came from our own address (the contact form, whose sender is in
      // Reply-To) or its reply would go somewhere else: then a new email to the address the site gave.
      var sender = parseAddress(msg.getFrom()).address, target = parseAddress(msg.getReplyTo() || '').address || sender;
      if (own.indexOf(sender) < 0 && target === String(x.to).toLowerCase()) msg.reply(x.text, opts);
      else GmailApp.sendEmail(x.to, x.subject, x.text, opts);
      sentIds.add(String(x.id));
      done.sent.push(x.id);
    } catch (e) {
      done.failed.push({ id: x.id, why: 'send failed' });
      report.errors.push('a reply: ' + String(e.message || e).slice(0, 120));
    }
  });
  sentIds.save();
  (r.labels || []).forEach(function (x) {
    try {
      var thread = null;
      try { thread = GmailApp.getThreadById(x.thread); } catch (e) { thread = null; }
      if (!thread) { done.labeled.push({ id: x.id, label: x.label }); return; }   // gone: nothing to label
      thread.getLabels().forEach(function (l) { if (PAS.peopleLabels.indexOf(l.getName()) >= 0 && l.getName() !== x.label) thread.removeLabel(l); });
      thread.addLabel(label_(x.label));
      var where = labelPlace(x.label, !!x.inbox, show);
      if (where === 'inbox') thread.moveToInbox(); else if (where === 'archive') thread.moveToArchive();
      done.labeled.push({ id: x.id, label: x.label });
    } catch (e) { report.errors.push('a label: ' + String(e.message || e).slice(0, 120)); }
  });
  if (done.sent.length || done.failed.length || done.labeled.length) api_('mail_sent', done, true);
}

// ----- 2. outreach -----
/** The next outreach emails, inside the daily cap: weekdays 9 to 4, New York time, a few a run. */
function sendOutreach(report) {
  var p = props_(), now = new Date();
  var state = outreachState_();
  report.outreach = outreachSummary_();
  if (p.getProperty('OUTREACH_ON') !== 'yes') return;
  var why = outreachBlocked_(p, state, now);
  if (why) { report.outreach.waiting = why; return; }
  var room = Math.min(PAS.outreachPerRun, state.cap - state.today);
  if (room <= 0) return;
  var copy = api_('outreach_copy', {}, true);
  if (copy.off) { report.outreach.waiting = 'switched off on the site'; return; }   // "mail": { "outreach": "on" } in site.config.json turns it back on
  var book = SpreadsheetApp.openById(p.getProperty('OUTREACH_SHEET_ID'));
  var tabs = parseTabs(p.getProperty('OUTREACH_TABS') || 'Programs=claim');
  var fill = { signature: p.getProperty('OUTREACH_SIGNATURE') || PAS.name, postal: p.getProperty('POSTAL_ADDRESS') || '' };
  var today = ymd_(now), from = fromOption_();
  for (var t = 0; t < tabs.length && room > 0; t++) {
    var seq = copy.sequences && copy.sequences[tabs[t].sequence];
    var sheet = book.getSheetByName(tabs[t].tab);
    if (!seq || !seq.length || !sheet) { report.errors.push('outreach: no tab "' + tabs[t].tab + '" or no sequence "' + tabs[t].sequence + '"'); continue; }
    var grid = sheet.getDataRange().getValues();
    var cols = columns(grid[0]);
    if (cols.email < 0 || cols.name < 0) { report.errors.push('outreach: the tab "' + tabs[t].tab + '" has no Email or name column'); continue; }
    ensureColumns_(sheet, grid[0], cols);
    for (var r = 1; r < grid.length && room > 0; r++) {
      var next = nextOutreach(grid[r], cols, seq, today, copy.claimed || [], fill);
      if (!next.send) continue;
      var opts = { name: PAS.name };
      if (from) opts.from = from;
      var sent = GmailApp.createDraft(next.to, next.subject, next.body, opts).send();
      var row = r + 1;
      sheet.getRange(row, cols.emailed + 1).setValue(appendList(grid[r][cols.emailed], today, ', '));
      sheet.getRange(row, cols.step + 1).setValue(next.step + ' of ' + next.total + ' · ' + today);
      sheet.getRange(row, cols.thread + 1).setValue(appendList(grid[r][cols.thread], sent.getThread().getId(), ' '));
      outreachDay_(today, 'sent', 1);
      state.today++; room--;
    }
  }
  report.outreach = outreachSummary_();
}
function outreachBlocked_(p, state, now) {
  if (!p.getProperty('OUTREACH_SHEET_ID')) return 'no sheet';
  if (!(p.getProperty('POSTAL_ADDRESS') || '').trim()) return 'no postal address';
  if (state.paused) return 'paused';
  if (!canSendAsSite_()) return 'the site’s address is not under "Send mail as"';
  var hour = Number(Utilities.formatDate(now, PAS.timeZone, 'H')), day = Number(Utilities.formatDate(now, PAS.timeZone, 'u'));   // u: 1 Monday … 7 Sunday
  if (day > 5 || hour < PAS.outreachHours[0] || hour >= PAS.outreachHours[1]) return 'outside sending hours';
  return '';
}
// The cap and the day's count, raised (or paused) once a week by how the last seven days went.
function outreachState_() {
  var p = props_(), now = Date.now(), days = outreachDays_();
  var cap = Number(p.getProperty('OUTREACH_CAP')) || PAS.outreachStart;
  var set = Number(p.getProperty('OUTREACH_CAP_SET')) || 0;
  if (!set) { p.setProperty('OUTREACH_CAP_SET', String(now)); set = now; }
  var health = outreachHealth(days, ymd_(new Date()));
  if (health === 'bad' && p.getProperty('OUTREACH_PAUSED') !== 'yes') p.setProperty('OUTREACH_PAUSED', 'yes');
  if (now - set >= 7 * 86400000) {
    if (health === 'ok') cap = nextCap(cap);
    p.setProperty('OUTREACH_CAP', String(cap));
    p.setProperty('OUTREACH_CAP_SET', String(now));
  }
  var today = days[ymd_(new Date())];
  return { cap: cap, today: today ? today.sent || 0 : 0, paused: p.getProperty('OUTREACH_PAUSED') === 'yes' };
}
function outreachSummary_() {
  var p = props_(), days = outreachDays_(), today = days[ymd_(new Date())];
  return { on: p.getProperty('OUTREACH_ON') === 'yes', paused: p.getProperty('OUTREACH_PAUSED') === 'yes', cap: Number(p.getProperty('OUTREACH_CAP')) || PAS.outreachStart, today: today ? today.sent || 0 : 0, days: days };
}
function outreachDays_() { try { return JSON.parse(props_().getProperty('OUTREACH_DAYS') || '{}') || {}; } catch (e) { return {}; } }
function outreachDay_(day, what, n) {
  var days = outreachDays_();
  days[day] = days[day] || { sent: 0, bounced: 0, optout: 0, replied: 0 };
  days[day][what] = (days[day][what] || 0) + n;
  var keys = Object.keys(days).sort();
  while (keys.length > 14) delete days[keys.shift()];
  props_().setProperty('OUTREACH_DAYS', JSON.stringify(days));
}
// The columns the script writes, added at the end of the heading row when a tab doesn't have them yet.
function ensureColumns_(sheet, header, cols) {
  [['emailed', 'Emailed on'], ['notes', 'Reply / notes'], ['step', 'Outreach step'], ['thread', 'Outreach thread']].forEach(function (c) {
    if (cols[c[0]] >= 0) return;
    var at = header.length;
    sheet.getRange(1, at + 1).setValue(c[1]);
    header.push(c[1]);
    cols[c[0]] = at;
  });
}

// ===================================================================================================================
// Once, by hand
// ===================================================================================================================

/** Makes the shared secret, keeps it in the script's properties and logs it once, to copy into the host's key file. */
function makeSecret() {
  var s = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  props_().setProperty('MAIL_SECRET', s);
  Logger.log('Put this one line in a file named phillyafterschool-mailin.key, next to the public folder on the host. Do not paste it anywhere else.\n' + s);
}

/** The labels, the 10-minute trigger, and a check that the site takes the secret. Safe to run again. */
function setup() {
  var p = props_();
  if (!p.getProperty('MAIL_SECRET')) throw new Error('Run makeSecret first, and put the secret in phillyafterschool-mailin.key on the host.');
  if (!p.getProperty('STARTED')) p.setProperty('STARTED', String(Date.now()));
  var names = ['PAS/Site', 'PAS/Service', 'PAS/People', 'PAS/Newsletters', 'PAS/Bounces', 'PAS/Auto-replies', 'PAS/Suspicious', 'PAS/Outreach/Opted out'].concat(PAS.peopleLabels);
  Object.keys(PAS.noticeLabels).forEach(function (k) { names.push('PAS/Site/' + PAS.noticeLabels[k]); });
  Object.keys(PAS.services).forEach(function (k) { names.push('PAS/Service/' + PAS.services[k].label); });
  names.forEach(function (n) { label_(n); });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'run') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('run').timeBased().everyMinutes(10).create();
  var alias = canSendAsSite_();
  api_('mail_sent', {}, true);   // a signed request that changes nothing: proves the site has the same secret
  Logger.log('The site took the secret. The trigger runs every 10 minutes. ' +
    (alias ? 'Replies will leave from ' + PAS.address + '.' : 'Replies CAN’T leave from ' + PAS.address + ' yet: add it in Gmail > Settings > Accounts > "Send mail as", then run setup again.'));
}

/** Files older notices, services' mail and newsletters already in the inbox, a page at a time. Never touches mail a
 *  person wrote. Run it by hand as often as it takes; each run says how many threads it filed. */
function fileOldMail() {
  var box = mailbox_(), filed = 0;
  var threads = GmailApp.search('in:inbox', 0, 100);
  threads.forEach(function (thread) {
    var msgs = thread.getMessages(), c = classify(readMessage_(msgs[msgs.length - 1]), box.ctx);
    if (['notice', 'service', 'bulk', 'bounce', 'auto'].indexOf(c.action) < 0 || c.inbox) return;
    if (c.label) thread.addLabel(label_(c.label));
    thread.moveToArchive();
    filed++;
  });
  Logger.log('Filed ' + filed + ' of the newest ' + threads.length + ' threads in the inbox.');
}

/** Stops outreach now (the same as setting OUTREACH_ON to anything but "yes"). */
function stopOutreach() { props_().setProperty('OUTREACH_ON', 'no'); Logger.log('Outreach is off.'); }

// ===================================================================================================================
// Pure functions: no Google services, so the tests run them under Node (tests/cases/07-mail-script.mjs)
// ===================================================================================================================

/** How to file one email. m: { fromAddress, fromName, replyTo, subject, date (ms), headers (lower-case name => [values]),
 *  auth (parseAuth) }. ctx: { own: [addresses], siteDomain, started (ms), show (KEEP_IN_INBOX on) }. Gives { action, label,
 *  inbox, star, via, kind }:
 *  action is notice, service, bounce, auto, bulk, person, own (ours, left alone), old (before setup, left alone) or
 *  suspicious (claims to be ours and isn't: labeled, left in the inbox). */
function classify(m, ctx) {
  var from = String(m.fromAddress || '').toLowerCase(), dom = baseDomain(domainOf(from));
  var h = m.headers || {}, subject = String(m.subject || '');
  var auth = m.auth || { dkim: [] };
  if (ctx.own.indexOf(from) >= 0) {
    var kind = String(first(h['x-pas-kind']) || '').trim().toLowerCase();
    if (!kind) kind = subjectKind(subject);
    if (!kind) return { action: 'own', label: '', inbox: true };
    if (!passesFor(auth, ctx.siteDomain)) return { action: 'suspicious', label: 'PAS/Suspicious', inbox: true, kind: kind };
    if (kind === 'contact') return { action: 'person', via: 'form', kind: kind };
    var name = PAS.noticeLabels[kind];
    if (!name) return { action: 'own', label: '', inbox: true };
    return { action: 'notice', kind: kind, label: 'PAS/Site/' + name, inbox: PAS.keepInInbox.indexOf(kind) >= 0 || (!!ctx.show && PAS.showInInbox.indexOf(kind) >= 0) };
  }
  if (/^(mailer-daemon|postmaster)@/.test(from) || /report-type="?delivery-status/i.test(first(h['content-type']) || '') ||
      /^(Delivery Status Notification|Undeliver(able|ed)|Mail delivery failed|Returned mail|Delivery has failed|Failure Notice)\b/i.test(subject)) {
    return { action: 'bounce', label: 'PAS/Bounces', inbox: false };
  }
  var svc = PAS.services[dom];
  if (svc && passesFor(auth, dom)) {
    var star = !!(svc.star && svc.star.test(subject));
    return { action: 'service', label: 'PAS/Service/' + svc.label, inbox: star, star: star };
  }
  var auto = String(first(h['auto-submitted']) || '').trim().toLowerCase();
  if ((auto && auto !== 'no') || h['x-autoreply'] || h['x-autorespond'] || /^auto[_-]?reply$/i.test(String(first(h['precedence']) || '').trim()) ||
      /^(Automatic reply|Auto[- ]?reply|Autoreply|Out of (the )?office)\b/i.test(subject)) {
    return { action: 'auto', label: 'PAS/Auto-replies', inbox: false };
  }
  if (h['list-unsubscribe']) return { action: 'bulk', label: 'PAS/Newsletters', inbox: false };
  if (ctx.started && m.date && m.date < ctx.started) return { action: 'old', label: '', inbox: true };
  return { action: 'person', via: 'mail' };
}
/** Where a thread goes when the site changes its label: 'inbox', 'archive', or '' (left where it is). Held mail comes
 *  to the inbox. While mail stays in the inbox (show), an answered thread comes back to it, so the answer that went is
 *  seen next to what the person wrote; spam leaves; the rest stay where the owner left them. Without show, everything
 *  but held mail leaves. */
function labelPlace(label, held, show) {
  if (held) return 'inbox';
  if (!show || label === 'PAS/Spam') return 'archive';
  return label === 'PAS/People/Answered' ? 'inbox' : '';
}
/** The notice kind of an older email from the site, by its subject ('' when it isn't one of the site's). */
function subjectKind(subject) {
  var s = String(subject || '').replace(/^\[[^\]]+\]\s*/, '');
  for (var i = 0; i < PAS.subjects.length; i++) if (PAS.subjects[i][0].test(s)) return PAS.subjects[i][1];
  return '';
}
/** The header block of a raw message: lower-case name => [values], folded lines unfolded. */
function parseHeaders(raw) {
  var text = String(raw || '').replace(/\r\n/g, '\n');
  var end = text.indexOf('\n\n');
  var block = end >= 0 ? text.slice(0, end) : text;
  var out = {}, name = null;
  block.split('\n').forEach(function (line) {
    if (/^[ \t]/.test(line) && name) { var list = out[name]; list[list.length - 1] += ' ' + line.trim(); return; }
    var i = line.indexOf(':');
    if (i <= 0) { name = null; return; }
    name = line.slice(0, i).trim().toLowerCase();
    (out[name] = out[name] || []).push(line.slice(i + 1).trim());
  });
  return out;
}
/** SPF, DKIM and DMARC from the topmost Authentication-Results header Google added (authserv-id mx.google.com): a
 *  sender can put look-alike headers lower down, never above Google's. Gives { spf, spfDomain, dkim: [{ d, r }], dmarc }. */
function parseAuth(values) {
  var out = { spf: '', spfDomain: '', dkim: [], dmarc: '' };
  var list = values || [], pick = null;
  for (var i = 0; i < list.length; i++) if (/^\s*mx\.google\.com\s*;/i.test(list[i])) { pick = list[i]; break; }
  if (pick === null) return out;
  pick.split(';').slice(1).forEach(function (part) {
    var p = part.trim(), m = /^(spf|dkim|dmarc)=([a-z]+)/i.exec(p);
    if (!m) return;
    var what = m[1].toLowerCase(), result = m[2].toLowerCase();
    if (what === 'dkim') { var d = /header\.(?:i=@?[^@\s;]*@|i=@|d=)([A-Za-z0-9.-]+)/.exec(p) || /header\.d=([A-Za-z0-9.-]+)/.exec(p); out.dkim.push({ d: d ? d[1].toLowerCase() : '', r: result }); }
    else if (what === 'spf') { out.spf = result; var s = /smtp\.mailfrom=(?:[^@\s;]*@)?([A-Za-z0-9.-]+)/.exec(p); out.spfDomain = s ? s[1].toLowerCase() : ''; }
    else out.dmarc = result;
  });
  return out;
}
/** Whether the email is really from this domain: DKIM passed for it, or SPF passed for it. */
function passesFor(auth, domain) {
  var want = baseDomain(domain);
  if (!want) return false;
  for (var i = 0; i < (auth.dkim || []).length; i++) if (auth.dkim[i].r === 'pass' && baseDomain(auth.dkim[i].d) === want) return true;
  return auth.spf === 'pass' && baseDomain(auth.spfDomain) === want;
}
/** "Dana Reyes <dana@example.org>" => { name, address }. */
function parseAddress(s) {
  var t = String(s || '').trim(), m = /^(.*?)\s*<([^>]+)>\s*$/.exec(t);
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim(), address: m[2].trim().toLowerCase() };
  return { name: '', address: t.toLowerCase() };
}
function domainOf(address) { var i = String(address || '').lastIndexOf('@'); return i < 0 ? '' : String(address).slice(i + 1).toLowerCase(); }
/** "mail.example.org" and "example.org" are the same place: the last two parts, as the site compares them. */
function baseDomain(host) { var parts = String(host || '').toLowerCase().replace(/^\.+|\.+$/g, '').split('.').filter(Boolean); return parts.length >= 2 ? parts.slice(-2).join('.') : parts.join('.'); }
function first(list) { return list && list.length ? list[0] : ''; }
/** An email's own words, without the history it quotes: stops at "On … wrote:", Outlook's line, "Original Message",
 *  or a quoted From/Sent block, and drops lines that start with ">". */
function trimQuoted(text) {
  var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n'), out = [];
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i], two = l + ' ' + (lines[i + 1] || '');
    if (/^\s*On .{4,250}wrote:\s*$/.test(l) || (/^\s*On \S/.test(l) && /wrote:\s*$/.test(lines[i + 1] || '') && two.length < 320)) break;
    if (/^\s*-{2,}\s*(Original|Forwarded) Message\s*-{2,}/i.test(l) || /^\s*_{10,}\s*$/.test(l)) break;
    if (/^\s*From:\s.+/.test(l) && /^\s*(Sent|Date):\s/.test(lines[i + 1] || '')) break;
    if (/^\s*>/.test(l)) continue;
    out.push(l);
  }
  return out.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** A short reply asking not to be written to again. */
function isOptOut(text) {
  var t = String(text || '').trim();
  if (!t || t.length > 400) return false;
  if (/^(stop|unsubscribe|remove|remove me|no thanks|not interested)[.!]*$/i.test(t.split('\n')[0].trim())) return true;
  return /\b(unsubscribe|remove (me|us)( from)?|stop (emailing|sending|contacting|writing)|take (me|us) off|opt(ing)? out|do not (email|contact|write to) (me|us)|don’t (email|contact|write to) (me|us)|don't (email|contact|write to) (me|us))\b/i.test(t);
}
/** A "Name: …" line from the contact form's email. */
function formField(text, name) { var m = new RegExp('^' + name + ':[ \\t]*(.*)$', 'm').exec(String(text || '')); return m ? m[1].trim() : ''; }
/** "Programs=claim, Schools=school" => [{ tab, sequence }]. */
function parseTabs(s) {
  return String(s || '').split(',').map(function (x) { var p = x.split('='); return { tab: (p[0] || '').trim(), sequence: (p[1] || '').trim() }; }).filter(function (x) { return x.tab && x.sequence; });
}
/** Where each column is, by its heading, -1 when missing. */
function columns(header) {
  var h = (header || []).map(function (x) { return String(x || '').trim().toLowerCase(); });
  var find = function (names) { for (var i = 0; i < names.length; i++) { var at = h.indexOf(names[i]); if (at >= 0) return at; } return -1; };
  return { name: find(['provider', 'program', 'school', 'camp', 'organization', 'name']), email: find(['email']), canClaim: find(['can they claim with this email?']),
    foundOn: find(['email found on']), website: find(['website']), link: find(['links to the listings', 'link to the listing', 'link to the page', 'page', 'link']),
    claimed: find(['already claimed']), emailed: find(['emailed on']), notes: find(['reply / notes', 'notes']), step: find(['outreach step']), thread: find(['outreach thread']) };
}
/** The next email for one row, or why none: { send: true, to, subject, body, step, total } or { send: false, why }.
 *  A row is written to only if its organization published the address (an "Email found on" page), nobody has claimed
 *  its listing, no reply, opt-out or bounce is noted, and nobody emailed it by hand ("Emailed on" filled with no step). */
function nextOutreach(row, cols, seq, today, claimed, fill) {
  var get = function (k) { return cols[k] >= 0 ? String(row[cols[k]] == null ? '' : row[cols[k]]).trim() : ''; };
  var to = get('email').toLowerCase();
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i.test(to)) return { send: false, why: 'no address' };
  if (!/^https?:\/\//i.test(get('foundOn'))) return { send: false, why: 'not published by the organization' };
  if (/^yes/i.test(get('claimed'))) return { send: false, why: 'claimed' };
  var links = get('link').split(/[\s,]+/).filter(function (x) { return /^https?:\/\//i.test(x); });
  for (var i = 0; i < links.length; i++) for (var j = 0; j < claimed.length; j++) if (links[i].replace(/\/+$/, '') === String(claimed[j]).replace(/\/+$/, '')) return { send: false, why: 'claimed' };
  if (/\b(Opted out|Bounced|Replied)\b/.test(get('notes'))) return { send: false, why: 'stopped' };
  var st = /^(\d+) of (\d+)(?:\s*·\s*(\d{4}-\d{2}-\d{2}))?/.exec(get('step'));
  if (get('emailed') && !st) return { send: false, why: 'emailed by hand' };
  var n = st ? Number(st[1]) : 0;
  if (n >= seq.length) return { send: false, why: 'done' };
  var next = seq[n];
  if (n > 0 && (!st[3] || daysBetween(st[3], today) < (next.after || 0))) return { send: false, why: 'not yet' };
  var site = /^https?:\/\/([^\/?#]+)/i.exec(get('website'));
  var vals = { org: get('name'), link: links[0] || '', domain: site ? site[1].replace(/^www\./i, '').toLowerCase() : '', signature: fill.signature || '', postal: fill.postal || '' };
  var body = /^not\b/i.test(get('canClaim')) && next.bodyReply ? next.bodyReply : next.body;
  var subject = fillIn(next.subject, vals), text = fillIn(body, vals);
  var left = /\{[a-z]+\}/i.exec(subject + '\n' + text);
  if (left) return { send: false, why: 'nothing for ' + left[0] };
  return { send: true, to: to, subject: subject, body: text, step: n + 1, total: seq.length };
}
function fillIn(s, vals) { return String(s || '').replace(/\{([a-z]+)\}/gi, function (all, k) { return vals[k] ? String(vals[k]) : all; }); }
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
function appendList(old, add, sep) { var o = String(old == null ? '' : old).trim(); return o ? o + sep + add : add; }
/** "ok" (raise the cap), "hold" (keep it) or "bad" (pause), from the last seven days: bounces and opt-outs over sent. */
function outreachHealth(days, today) {
  var sent = 0, bounced = 0, optout = 0;
  Object.keys(days || {}).forEach(function (d) { if (daysBetween(d, today) >= 0 && daysBetween(d, today) < 7) { sent += days[d].sent || 0; bounced += days[d].bounced || 0; optout += days[d].optout || 0; } });
  if (sent < 20) return 'hold';
  if (bounced / sent >= 0.08 || optout / sent >= 0.05) return 'bad';
  if (bounced / sent < 0.03 && optout / sent < 0.02) return 'ok';
  return 'hold';
}
function nextCap(cap) { return Math.min(PAS.outreachMax, (Number(cap) || PAS.outreachStart) + PAS.outreachStep); }
/** The signature header for a request to the site: HMAC-SHA256 over "<t>.<nonce>.<action>.<body>". */
function signature(action, body, nowSec, nonce, secret) {
  var bytes = Utilities.computeHmacSha256Signature(nowSec + '.' + nonce + '.' + action + '.' + body, secret, Utilities.Charset.UTF_8);
  return 't=' + nowSec + ',n=' + nonce + ',s=' + bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// ===================================================================================================================
// Google's services
// ===================================================================================================================

function props_() { return PropertiesService.getScriptProperties(); }
/** Whether people's mail, suggestions, ideas, answer copies and the summary stay in the inbox: yes unless KEEP_IN_INBOX
 *  says "no". */
function keepInInbox_() { return String(props_().getProperty('KEEP_IN_INBOX') || '').trim().toLowerCase() !== 'no'; }
function siteUrl_() { return (props_().getProperty('SITE_URL') || PAS.site).replace(/\/+$/, ''); }
function ymd_(d) { return Utilities.formatDate(d, PAS.timeZone, 'yyyy-MM-dd'); }
/** A request to the site's API. Signed with the shared secret, except push_run, which anyone may ask for. */
function api_(action, obj, signed) {
  var body = JSON.stringify(obj || {});
  var headers = { 'X-PAS': '1' };
  if (signed) {
    var secret = props_().getProperty('MAIL_SECRET');
    if (!secret) throw new Error('no MAIL_SECRET: run makeSecret and setup');
    headers['X-PAS-Sign'] = signature(action, body, Math.floor(Date.now() / 1000), Utilities.getUuid().replace(/-/g, ''), secret);
  }
  var r = UrlFetchApp.fetch(siteUrl_() + '/groups/api.php?action=' + action, { method: 'post', contentType: 'application/json', payload: body, headers: headers, muteHttpExceptions: true, followRedirects: false });
  var code = r.getResponseCode(), json = null;
  try { json = JSON.parse(r.getContentText()); } catch (e) { json = null; }
  if (code !== 200 || !json || json.ok !== true) { var err = new Error(action + ' answered ' + code + (json && json.error ? ' (' + json.error + ')' : '')); err.code = code; throw err; }
  return json;
}
/** Whether replies can leave from the site's address: it is this account's own, or one of its "Send mail as" addresses. */
function canSendAsSite_() {
  var me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (me === PAS.address) return true;
  return GmailApp.getAliases().map(function (a) { return String(a).toLowerCase(); }).indexOf(PAS.address) >= 0;
}
function fromOption_() { return String(Session.getEffectiveUser().getEmail() || '').toLowerCase() === PAS.address ? '' : PAS.address; }
/** The site's address, this account's own, and its "Send mail as" addresses. */
function ownAddresses_() { return [PAS.address, String(Session.getEffectiveUser().getEmail() || '').toLowerCase()].concat(GmailApp.getAliases().map(function (a) { return String(a).toLowerCase(); })); }
var labelCache_ = {};
function label_(name) { return labelCache_[name] || (labelCache_[name] = GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name)); }
/** One email, as classify wants it, read from the raw message (the only way to see which Authentication-Results
 *  header Google added). */
function readMessage_(msg) {
  var headers = parseHeaders(msg.getRawContent());
  var from = parseAddress(msg.getFrom());
  var reply = parseAddress(msg.getReplyTo() || '');
  return { id: msg.getId(), thread: msg.getThread().getId(), fromAddress: from.address, fromName: from.name, replyTo: reply.address, subject: msg.getSubject() || '',
    date: msg.getDate().getTime(), headers: headers, auth: parseAuth(headers['authentication-results']), text: msg.getPlainBody() || '',
    attachments: msg.getAttachments({ includeInlineImages: false }).map(function (a) { return a.getName(); }).slice(0, 20) };
}
/** A set of ids kept in the script's properties, newest last, in chunks under the 9 KB a property holds. */
function ring_(key, max) {
  var p = props_(), list = [];
  for (var i = 0; i < 12; i++) { var v = p.getProperty(key + i); if (v) list = list.concat(v.split(',')); }
  var set = {}; list.forEach(function (x) { set[x] = true; });
  return {
    has: function (id) { return set[id] === true; },
    add: function (id) { if (!set[id]) { set[id] = true; list.push(id); } },
    save: function () {
      list = list.slice(-max);
      for (var c = 0; c < 12; c++) { var part = list.slice(c * 350, (c + 1) * 350); if (part.length) p.setProperty(key + c, part.join(',')); else p.deleteProperty(key + c); }
    },
  };
}
/** What a run needs: which mail it has already seen, the site's own addresses, and the outreach rows (read once, only
 *  when an email or a bounce might belong to one). */
function mailbox_() {
  var p = props_();
  var box = { seen: ring_('seen', 4000), ctx: { own: ownAddresses_(), siteDomain: domainOf(PAS.address), started: Number(p.getProperty('STARTED')) || Date.now(), show: keepInInbox_() }, outreach: null };
  box.outreachFor = function (thread, from) { if (!box.outreach) box.outreach = outreachIndex_(); return box.outreach.find(thread, from); };
  box.outreachCount = function (what) { outreachDay_(ymd_(new Date()), what, 1); };
  return box;
}
/** The outreach rows, by their thread ids and addresses, from the tabs in OUTREACH_TABS. A match can note a reply, an
 *  opt-out or a bounce in "Reply / notes", which stops its sequence. */
function outreachIndex_() {
  var p = props_(), id = p.getProperty('OUTREACH_SHEET_ID'), byThread = {}, byAddress = {}, writes = [];
  var none = { find: function () { return null; }, flush: function () {} };
  if (!id) return none;
  var book;
  try { book = SpreadsheetApp.openById(id); } catch (e) { return none; }
  parseTabs(p.getProperty('OUTREACH_TABS') || 'Programs=claim').forEach(function (tab) {
    var sheet = book.getSheetByName(tab.tab);
    if (!sheet) return;
    var grid = sheet.getDataRange().getValues(), cols = columns(grid[0]);
    if (cols.email < 0 || cols.notes < 0) return;
    for (var r = 1; r < grid.length; r++) {
      var hit = { sequence: tab.sequence, sheet: sheet, row: r + 1, col: cols.notes + 1, notes: String(grid[r][cols.notes] || '') };
      hit.mark = function (word) { var me = this; if (new RegExp('\\b' + word + '\\b').test(me.notes)) return; me.notes = appendList(me.notes, word + ' ' + ymd_(new Date()), '; '); writes.push(me); };
      if (cols.thread >= 0) String(grid[r][cols.thread] || '').split(/\s+/).filter(Boolean).forEach(function (t) { byThread[t] = hit; });
      var a = String(grid[r][cols.email] || '').trim().toLowerCase();
      if (a) byAddress[a] = hit;
    }
  });
  return {
    find: function (thread, from) { return byThread[thread] || byAddress[String(from || '').toLowerCase()] || null; },
    flush: function () { writes.forEach(function (h) { h.sheet.getRange(h.row, h.col).setValue(h.notes); }); writes = []; },
  };
}
/** A bounce: the address that failed, matched to an outreach row, stops that row's sequence. */
function noteBounce_(m, box) {
  var failed = String(first(m.headers['x-failed-recipients']) || '').split(',')[0].trim().toLowerCase();
  if (!failed) { var found = String(m.text || '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []; failed = (found.filter(function (a) { return !/^(mailer-daemon|postmaster)@/i.test(a) && box.ctx.own.indexOf(a.toLowerCase()) < 0; })[0] || '').toLowerCase(); }
  if (!failed) return;
  var hit = box.outreachFor('', failed);
  if (hit) { hit.mark('Bounced'); box.outreachCount('bounced'); }
}
