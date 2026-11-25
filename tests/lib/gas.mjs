// A stand-in for the Google services the mailbox script (mail/Code.gs) uses, so the script itself runs under Node: a
// small Gmail (threads, messages, labels, the inbox, stars, replies), script properties, a spreadsheet, and
// UrlFetchApp, which reaches only the local test site. Nothing here touches Google or a real mailbox.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { ROOT } from './harness.mjs';

export const SITE_ADDRESS = 'contact@phillyafterschool.org';

// Google's own Authentication-Results line for a message from this domain (pass, or what each check said).
export function googleAuth(domain, { dkim = 'pass', spf = 'pass', dmarc = 'pass', dkimDomain = domain } = {}) {
  return `mx.google.com; dkim=${dkim} header.i=@${dkimDomain} header.s=s1 header.b=AbCdEf; spf=${spf} (google.com: domain of bounce@${domain} designates 192.0.2.1 as permitted sender) smtp.mailfrom=bounce@${domain}; dmarc=${dmarc} (p=NONE sp=NONE dis=NONE) header.from=${domain}`;
}
// A raw message: the header block (Authentication-Results first, as Google adds it), a blank line, the text.
export function rawMessage({ from, to = SITE_ADDRESS, subject = '', headers = {}, auth = '', text = '' }) {
  const lines = [];
  if (auth) lines.push('Authentication-Results: ' + auth);
  lines.push('From: ' + from, 'To: ' + to, 'Subject: ' + subject, 'Date: ' + new Date().toUTCString(), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8');
  for (const [k, v] of Object.entries(headers)) for (const x of [].concat(v)) lines.push(k + ': ' + x);
  return lines.join('\r\n') + '\r\n\r\n' + text;
}

let seq = 0;
const gid = () => (Date.now().toString(16) + (seq++).toString(16).padStart(4, '0')).slice(-16);

// The script's whole world. me: the account's own address; alias: whether the site's address is a "Send mail as" one.
export function google({ site, me = 'mailbox@schoolsoutwhatnow.example', alias = true, props = {}, now = null } = {}) {
  const threads = new Map(), messages = new Map(), labels = new Map();
  const sent = [], fetches = [], logs = [];
  const properties = new Map(Object.entries(props));
  const clock = { hour: now ? now.hour : null, weekday: now ? now.weekday : null };
  const labelObj = name => { if (!labels.has(name)) labels.set(name, { getName: () => name }); return labels.get(name); };
  const ownAddress = () => me;
  function threadObj(t) {
    return {
      getId: () => t.id,
      getMessages: () => t.messages.map(id => msgObj(messages.get(id))),
      getLabels: () => [...t.labels].map(labelObj),
      addLabel: l => { t.labels.add(l.getName()); },
      removeLabel: l => { t.labels.delete(l.getName()); },
      moveToArchive: () => { for (const id of t.messages) messages.get(id).inbox = false; },
      moveToInbox: () => { const last = messages.get(t.messages.at(-1)); if (last) last.inbox = true; },
    };
  }
  function msgObj(m) {
    return {
      getId: () => m.id, getThread: () => threadObj(threads.get(m.thread)), getFrom: () => m.from, getReplyTo: () => m.replyTo || '',
      getSubject: () => m.subject, getDate: () => new Date(m.date), getRawContent: () => m.raw, getPlainBody: () => m.text,
      getAttachments: () => (m.attachments || []).map(n => ({ getName: () => n })), isInInbox: () => !!m.inbox, isInTrash: () => false,
      star: () => { m.starred = true; },
      reply: (text, opts = {}) => {
        const to = (m.replyTo || '').trim() || parseAddr(m.from);
        sent.push({ kind: 'reply', thread: m.thread, to, subject: 'Re: ' + m.subject, text, opts });
        add({ thread: m.thread, from: `${opts.name || ''} <${opts.from || me}>`, subject: 'Re: ' + m.subject, text, inbox: false });
      },
    };
  }
  const parseAddr = s => { const x = /<([^>]+)>/.exec(s); return (x ? x[1] : s).trim().toLowerCase(); };
  // One message into the mailbox: in a new thread unless one is given. Gives the message's record.
  function add({ thread = null, from, replyTo = '', subject = '', headers = {}, auth = '', text = '', date = Date.now(), inbox = true, attachments = [] }) {
    const id = gid();
    const tid = thread || id;
    if (!threads.has(tid)) threads.set(tid, { id: tid, messages: [], labels: new Set() });
    const raw = rawMessage({ from, subject, headers: replyTo ? { 'Reply-To': replyTo, ...headers } : headers, auth, text });
    const m = { id, thread: tid, from, replyTo, subject, date, raw, text, inbox, attachments, starred: false };
    messages.set(id, m);
    threads.get(tid).messages.push(id);
    return m;
  }
  const GmailApp = {
    search: (q, start = 0, max = 100) => {
      if (q !== 'in:inbox' && q !== 'in:inbox has:nouserlabels') throw new Error('the stand-in only knows in:inbox, with or without has:nouserlabels');
      return [...threads.values()].filter(t => t.messages.some(id => messages.get(id).inbox) && (q === 'in:inbox' || t.labels.size === 0))
        .sort((a, b) => messages.get(b.messages.at(-1)).date - messages.get(a.messages.at(-1)).date).slice(start, start + max).map(threadObj);
    },
    getMessageById: id => (messages.has(id) ? msgObj(messages.get(id)) : null),
    getThreadById: id => (threads.has(id) ? threadObj(threads.get(id)) : null),
    getAliases: () => (alias ? [SITE_ADDRESS] : []),
    getUserLabelByName: name => (labels.has(name) ? labels.get(name) : null),
    createLabel: name => labelObj(name),
    sendEmail: (to, subject, text, opts = {}) => { sent.push({ kind: 'new', to, subject, text, opts }); add({ from: `${opts.name || ''} <${opts.from || me}>`, subject, text, inbox: false }); },
    createDraft: (to, subject, text, opts = {}) => ({ send: () => { sent.push({ kind: 'outreach', to, subject, text, opts }); const m = add({ from: `${opts.name || ''} <${opts.from || me}>`, subject, text, inbox: false }); return msgObj(m); } }),
  };
  // A request to the site, synchronously (Apps Script's UrlFetchApp is), through curl, to the local server only.
  const UrlFetchApp = {
    fetch: (url, opts = {}) => {
      if (!url.startsWith(site.base)) throw new Error('the stand-in fetches only the local test site, not ' + url);
      const args = ['-s', '--noproxy', '*', '-o', '-', '-w', '\n%{http_code}', '-X', (opts.method || 'get').toUpperCase(), '-H', 'Content-Type: ' + (opts.contentType || 'application/json')];
      for (const [k, v] of Object.entries(opts.headers || {})) args.push('-H', `${k}: ${v}`);
      args.push('--data-binary', '@-', url);
      const out = execFileSync('curl', args, { input: opts.payload || '', encoding: 'utf8' });
      const at = out.lastIndexOf('\n');
      const code = Number(out.slice(at + 1)), text = out.slice(0, at);
      fetches.push({ url, action: new URL(url).searchParams.get('action'), headers: opts.headers || {}, body: opts.payload || '', code, text });
      return { getResponseCode: () => code, getContentText: () => text };
    },
  };
  const Utilities = {
    Charset: { UTF_8: 'UTF-8' },
    computeHmacSha256Signature: (value, key) => [...crypto.createHmac('sha256', Buffer.from(key, 'utf8')).update(Buffer.from(value, 'utf8')).digest()].map(b => (b > 127 ? b - 256 : b)),
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, fmt) => {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(d).map(p => [p.type, p.value]));
      if (fmt === 'yyyy-MM-dd') return `${parts.year}-${parts.month}-${parts.day}`;
      if (fmt === 'H') return String(clock.hour ?? Number(parts.hour));
      if (fmt === 'u') return String(clock.weekday ?? ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 })[parts.weekday]);
      throw new Error('the stand-in has no format ' + fmt);
    },
  };
  const sheets = new Map();
  const SpreadsheetApp = {
    openById: id => {
      if (!sheets.has(id)) throw new Error('no such spreadsheet');
      const book = sheets.get(id);
      return { getSheetByName: name => {
        const grid = book[name];
        if (!grid) return null;
        return { getDataRange: () => ({ getValues: () => grid.map(r => [...r]) }), getRange: (r, c) => ({ setValue: v => { while (grid.length < r) grid.push([]); while (grid[r - 1].length < c) grid[r - 1].push(''); grid[r - 1][c - 1] = v; } }) };
      } };
    },
  };
  const triggers = [];
  const ctx = {
    GmailApp, UrlFetchApp, Utilities, SpreadsheetApp,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (properties.has(k) ? properties.get(k) : null), setProperty: (k, v) => { properties.set(k, String(v)); }, deleteProperty: k => { properties.delete(k); } }) },
    Session: { getEffectiveUser: () => ({ getEmail: ownAddress }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => { triggers.splice(triggers.indexOf(t), 1); },
      newTrigger: fn => ({ timeBased: () => ({ everyMinutes: n => ({ create: () => { const t = { fn, n, getHandlerFunction: () => fn }; triggers.push(t); return t; } }) }) }) },
    Logger: { log: s => logs.push(String(s)) },
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'mail/Code.gs'), 'utf8'), ctx, { filename: 'mail/Code.gs' });
  return { script: ctx, add, threads, messages, labelsOf: tid => [...threads.get(tid).labels], inInbox: tid => threads.get(tid).messages.some(id => messages.get(id).inbox),
    sent, fetches, logs, properties, triggers, sheets, clock };
}
