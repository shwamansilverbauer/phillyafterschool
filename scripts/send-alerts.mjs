#!/usr/bin/env node
// Once a day, tell Klaviyo which subscribers are due a "dates" email.
//
// The site builds data/alerts.json: every upcoming sign-up date and day off, each with the day it should be
// announced (its sendOn). This script reads that file and the people on the Klaviyo list, works out who is due
// what today, and records one "School dates" event per person. A flow in Klaviyo turns each event into an email.
//
//   node build.mjs && node scripts/send-alerts.mjs            send what is due
//   node scripts/send-alerts.mjs --dry-run                    count what would be sent, send nothing
//   node scripts/send-alerts.mjs --today 2026-11-01           pretend it is another day (use with --dry-run)
//
// It needs two secrets from the environment and does nothing without them:
//   KLAVIYO_API_KEY   a private Klaviyo key (Events: full, Profiles: read, Lists: read)
//   ALERTS_TOKEN      a shared word the Klaviyo flow checks, so only this script can trigger its emails
// Email addresses are never printed: the log of this job is public.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = name => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : null; };
const DRY = flag('--dry-run');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const KEY = process.env.KLAVIYO_API_KEY || '';
const TOKEN = process.env.ALERTS_TOKEN || '';
const API = (process.env.KLAVIYO_API || 'https://a.klaviyo.com').replace(/\/$/, '');
const REVISION = '2026-07-15';
const ZONE = 'America/New_York';
const CATCH_UP = 2;   // a missed morning is made up on either of the next two

const isoAdd = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const localDay = when => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(when);
const shortDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

// ----- what is each person due? (no network; exported so it can be tested) -----
// Everyone gets each date once. Dates already announced when someone joins come in one "welcome" email the
// morning after they join; later dates come in that week's email.
// A person can have a school (its dates and every day off; "all" means every school), follow programs (that
// program's dates, camps and updates only), or both.
export function dueFor(person, feed, today) {
  const follows = person.programs || [];
  const bySchool = a => !!person.school && (person.school === 'all' ? a.schools.length > 0 : a.schools.includes('*') || a.schools.includes(person.school));
  const byProgram = a => (a.programs || []).some(id => follows.includes(id));
  const wanted = feed.alerts.filter(a => (a.expires || a.date) >= today && (bySchool(a) || byProgram(a)));
  const got = new Set(wanted.map(a => a.id));
  const ahead = wanted.filter(a => !(a.within && got.has(a.within)));   // a day-off entry already names the camp
  const welcomeDay = isoAdd(person.joined, 1);
  const out = [];
  if (today >= welcomeDay && today <= isoAdd(welcomeDay, CATCH_UP)) {
    const items = ahead.filter(a => a.sendOn <= welcomeDay);
    if (items.length) out.push({ kind: 'welcome', id: 'welcome', items });
  }
  for (let n = CATCH_UP; n >= 0; n--) {
    const day = isoAdd(today, -n);
    if (day <= welcomeDay) continue;
    const items = ahead.filter(a => a.sendOn === day);
    if (items.length) out.push({ kind: 'weekly', id: 'weekly-' + day, items });
  }
  return out;
}

export function eventFor(person, due, feed) {
  const school = feed.schools.find(s => s.id === person.school);
  const followed = (person.programs || []).map(id => (feed.programs || []).find(p => p.id === id)?.name).filter(Boolean);
  const names = followed.length > 3 ? `${followed.slice(0, 2).join(', ')} and ${followed.length - 2} more programs` : followed.length > 1 ? `${followed.slice(0, -1).join(', ')} and ${followed[followed.length - 1]}` : followed[0];
  const whose = school ? ` for ${school.name} families` : person.school === 'all' ? '' : followed.length === 1 ? ` at ${followed[0]}` : followed.length ? ' at the programs you follow' : '';
  const reason = [school ? `you asked for ${school.name} dates` : person.school === 'all' ? 'you asked for dates for every school' : '', followed.length ? `you follow ${names}` : ''].filter(Boolean).join(' and ') || 'you asked for dates';
  const first = due.items[0];
  const lead = first.kind === 'dayoff' ? `No school ${shortDay(first.date)} (${first.title.replace(/^No school: /, '')})` : first.kind === 'update' ? `${first.title}: an update` : first.kind === 'camp' ? `${first.title.replace(/: camp on a day off$/, '')} camp, ${shortDay(first.date)}` : `${shortDay(first.date)}: ${first.title}`;
  const more = due.items.length - 1;
  const subject = due.kind === 'welcome'
    ? `You’re on the list. Here’s what’s coming up${school ? ' for ' + school.name : followed.length === 1 && person.school !== 'all' ? ' at ' + followed[0] : ''}`
    : lead + (more ? `, plus ${more} more date${more > 1 ? 's' : ''}` : '');
  const line = a => a.kind === 'dayoff' || a.kind === 'camp' ? a.title : `${a.title}: ${a.text.replace(/\.$/, '')}`;
  return {
    token: TOKEN,
    kind: due.kind,
    subject,
    preview: due.kind === 'welcome' ? `${due.items.length} date${due.items.length > 1 ? 's' : ''} already on the calendar.` : due.items.map(line).join(' · ').slice(0, 160),
    heading: due.kind === 'welcome' ? 'You’re on the list' : 'Dates coming up',
    intro: due.kind === 'welcome'
      ? `Here is what’s already on the calendar${whose}. After this you’ll hear from us on ${feed.sendDay} mornings, and only when there’s something new.`
      : `Here’s what’s coming up${whose}.`,
    reason,
    school: person.school || '',
    programs: person.programs || [],
    school_name: school ? school.name : '',
    school_url: school ? `${feed.site}/${school.id}/?utm_source=klaviyo&utm_medium=email&utm_campaign=dates` : `${feed.site}/?utm_source=klaviyo&utm_medium=email&utm_campaign=dates`,
    dates: due.items.map(a => ({ when: a.when, title: a.title, text: a.text, url: a.url, button: a.button, kind: a.kind })),
  };
}

// ----- Klaviyo -----
async function call(method, url, body) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { method, headers: { Authorization: `Klaviyo-API-Key ${KEY}`, revision: REVISION, accept: 'application/vnd.api+json', ...(body ? { 'content-type': 'application/vnd.api+json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if ((r.status === 429 || r.status >= 500) && attempt < 5) { await new Promise(done => setTimeout(done, (Number(r.headers.get('retry-after')) || attempt * 2) * 1000)); continue; }
    if (!r.ok) {
      const text = await r.text();
      let why = ''; try { why = JSON.parse(text).errors.map(e => e.detail).join(' | '); } catch { why = text.slice(0, 200); }
      throw new Error(`Klaviyo answered ${r.status} to ${method} ${new URL(url).pathname}: ${why}`);
    }
    return r.status === 204 || r.status === 202 ? null : r.json();
  }
}

async function subscribers(listId) {
  const people = [];
  let url = `${API}/api/lists/${encodeURIComponent(listId)}/profiles?page[size]=100&fields[profile]=email,properties,joined_group_at`;
  while (url) {
    const page = await call('GET', url);
    for (const p of page.data || []) {
      const a = p.attributes || {};
      if (!a.email) continue;
      const school = String(a.properties?.school || '').toLowerCase();
      const programs = [].concat(a.properties?.programs || []).map(x => String(x).toLowerCase()).filter(x => /^[a-z0-9-]+$/.test(x));
      // No school and no programs means the address was added some other way: send it everything.
      people.push({ id: p.id, email: a.email, school: /^[a-z0-9-]+$/.test(school) ? school : programs.length ? '' : 'all', programs, joined: localDay(new Date(a.joined_group_at || Date.now())) });
    }
    url = page.links?.next || null;
    if (url && API !== 'https://a.klaviyo.com') url = url.replace('https://a.klaviyo.com', API);
  }
  return people;
}

async function main() {
  const feedFile = path.resolve(ROOT, value('--feed') || 'dist/data/alerts.json');
  if (!cfg.alerts?.listId) return console.log('No list is set in site.config.json (alerts.listId). Nothing to do.');
  if (!fs.existsSync(feedFile)) throw new Error(`There is no ${path.relative(ROOT, feedFile)}. Run "node build.mjs" first.`);
  const feed = JSON.parse(fs.readFileSync(feedFile, 'utf8'));
  const today = value('--today') || localDay(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('--today needs a date like 2026-11-01');
  console.log(`Today is ${today} in Philadelphia. The feed has ${feed.alerts.length} dates; emails go out on ${feed.sendDay}s.`);
  if (!KEY) return console.log('There is no KLAVIYO_API_KEY secret, so nothing was sent.');
  if (!TOKEN && !DRY) return console.log('There is no ALERTS_TOKEN secret, so nothing was sent.');

  const people = await subscribers(cfg.alerts.listId);
  const bySchool = {};
  for (const p of people) bySchool[p.school || 'programs only'] = (bySchool[p.school || 'programs only'] || 0) + 1;
  console.log(`${people.length} subscriber(s): ${Object.entries(bySchool).map(([k, n]) => `${k} ${n}`).join(', ') || 'none yet'}. ${people.filter(p => p.programs.length).length} follow at least one program.`);

  let sent = 0;
  const tally = {};
  for (const person of people) {
    for (const due of dueFor(person, feed, today)) {
      tally[due.id] = (tally[due.id] || 0) + 1;
      if (DRY) continue;
      await call('POST', `${API}/api/events`, { data: { type: 'event', attributes: {
        properties: eventFor(person, due, feed),
        metric: { data: { type: 'metric', attributes: { name: feed.metric } } },
        profile: { data: { type: 'profile', attributes: { email: person.email } } },
        unique_id: due.id,   // Klaviyo keeps the first event with this id per person, so a second run can't send twice
      } } });
      sent++;
    }
  }
  const lines = Object.entries(tally).map(([id, n]) => `${id}: ${n}`).join(', ');
  console.log(DRY ? `Dry run. Would record: ${lines || 'nothing today'}.` : `Recorded ${sent} event(s)${lines ? ` (${lines})` : ''}. Repeats of an email already sent are ignored by Klaviyo.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(String(err.message || err).replace(/[^\s@]+@[^\s@]+/g, '[address]')); process.exit(1); });
}
