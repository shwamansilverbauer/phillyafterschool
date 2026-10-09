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
//   node scripts/send-alerts.mjs --any-time                   send even outside the morning window
//
// It needs two secrets from the environment and does nothing without them:
//   KLAVIYO_API_KEY   a private Klaviyo key (Events: full, Profiles: read, Lists: read)
//   ALERTS_TOKEN      a shared word the Klaviyo flow checks, so only this script can trigger its emails
// Email addresses are never printed: the log of this job is public.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

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
const WINDOW = ['07:50', '11:50'];   // Philadelphia time. The job is started every hour because GitHub runs scheduled jobs late, sometimes by hours; only a run that lands in the morning sends.

const isoAdd = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const localDay = when => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(when);
const shortDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

// ----- what is each person due? (no network; exported so it can be tested) -----
// Everyone gets each date once. Dates already announced when someone joins come in one "welcome" email the
// morning after they join; later dates come in that week's email.
// A person can have a school (its dates and every day off; "all" means every school), follow programs (that
// program's dates, camps and updates only), follow summer camps (that camp's sign-up dates and notes only), be
// waiting for a school to be added (one email when it is), or any mix of these.
export function dueFor(person, feed, today) {
  const follows = person.programs || [], camps = person.camps || [], waiting = person.waiting || [];
  // The schools someone hears about: the one a sign-up form set, and any an account follows. "all" is every school.
  const mine = [person.school, ...(person.schools || [])].filter(Boolean);
  const bySchool = a => mine.length > 0 && (mine.includes('all') ? a.schools.length > 0 : a.schools.includes('*') || a.schools.some(s => mine.includes(s)));
  const byProgram = a => (a.programs || []).some(id => follows.includes(id));
  const byCamp = a => (a.camps || []).some(id => camps.includes(id));
  const byWaiting = a => (a.waiting || []).some(id => waiting.includes(id));
  const byWeek = a => (a.weeks || []).some(id => (person.weeks || []).includes(id));   // "This week at your school", for those who turned it on
  // A listing someone stopped from an email is muted: nothing about it reaches them, even by way of a school they follow.
  const muted = person.muted || [];
  const isMuted = a => (a.programs || []).some(id => muted.includes('p:' + id)) || (a.camps || []).some(id => muted.includes('c:' + id));
  const wanted = feed.alerts.filter(a => (a.expires || a.date) >= today && !isMuted(a) && (bySchool(a) || byProgram(a) || byCamp(a) || byWaiting(a) || byWeek(a)));
  const got = new Set(wanted.map(a => a.id));
  const ahead = wanted.filter(a => !(a.within && got.has(a.within)));   // a day-off entry already names the camp
  // A sign-up date has up to three entries: the news, a reminder the day before ("-eve") and one on the day ("-day").
  // One email never carries two of them: the earliest kind that is due stands for the date.
  const stage = a => a.kind === 'soon' ? 1 : a.kind === 'today' ? 2 : 0, baseOf = a => a.id.replace(/-(eve|day)$/, '');
  const once = items => items.filter(a => !items.some(b => b !== a && baseOf(b) === baseOf(a) && stage(b) < stage(a)));
  const welcomeDay = isoAdd(person.joined, 1);
  const out = [];
  if (today >= welcomeDay && today <= isoAdd(welcomeDay, CATCH_UP)) {
    const items = once(ahead.filter(a => a.sendOn <= welcomeDay));
    if (items.length) out.push({ kind: 'welcome', id: 'welcome', items });
  }
  for (let n = CATCH_UP; n >= 0; n--) {
    const day = isoAdd(today, -n);
    if (day <= welcomeDay) continue;
    const items = once(ahead.filter(a => a.sendOn === day));
    if (items.length) out.push({ kind: 'weekly', id: 'weekly-' + day, items });
  }
  return out;
}

export function eventFor(person, due, feed) {
  const mine = [...new Set([person.school, ...(person.schools || [])].filter(Boolean))];
  const everySchool = mine.includes('all');
  const known = mine.map(id => feed.schools.find(s => s.id === id)).filter(Boolean);
  const school = !everySchool && known.length === 1 ? known[0] : null;   // one school: the email is about that school
  const schoolNames = known.length > 1 ? `${known.slice(0, -1).map(s => s.name).join(', ')} and ${known[known.length - 1].name}` : '';
  const followed = [
    ...(person.programs || []).map(id => (feed.programs || []).find(p => p.id === id)?.name),
    ...(person.camps || []).map(id => (feed.camps || []).find(c => c.id === id)?.name),
  ].filter(Boolean);
  const onlyAdded = due.items.every(a => a.kind === 'added');
  const onlyWeek = due.items.every(a => a.kind === 'week');
  const weekNames = (person.weeks || []).map(id => feed.schools.find(x => x.id === id)?.name).filter(Boolean);
  const names = followed.length > 3 ? `${followed.slice(0, 2).join(', ')} and ${followed.length - 2} more` : followed.length > 1 ? `${followed.slice(0, -1).join(', ')} and ${followed[followed.length - 1]}` : followed[0];
  const whose = school ? ` for ${school.name} families` : everySchool ? '' : schoolNames ? ` for ${schoolNames}` : followed.length === 1 ? ` at ${followed[0]}` : followed.length ? ' at the programs you asked about' : '';
  const reason = onlyAdded ? 'you asked to be told when this school was added'
    : onlyWeek && weekNames.length ? `you turned on “This week at ${weekNames.join(' and ')}” in your profile`
    : [school ? `you asked for ${school.name} dates` : everySchool ? 'you asked for dates for every school' : schoolNames ? `you asked for ${schoolNames} dates` : '', followed.length ? `you asked to hear about ${names}` : '', weekNames.length && due.items.some(a => a.kind === 'week') ? `you turned on “This week at ${weekNames.join(' and ')}”` : ''].filter(Boolean).join(' and ') || 'you asked for dates';
  const first = due.items[0];
  const lead = first.kind === 'week' ? first.title + (first.first ? ': ' + first.first : '') : first.kind === 'added' ? first.title : first.kind === 'soon' ? `Tomorrow: ${first.title}` : first.kind === 'today' ? `Today: ${first.title}` : first.kind === 'dayoff' ? `No school ${shortDay(first.date)} (${first.title.replace(/^No school: /, '')})` : first.kind === 'update' ? `${first.title}: an update` : first.kind === 'camp' ? `${first.title.replace(/: camp on a day off$/, '')} camp, ${shortDay(first.date)}` : `${shortDay(first.date)}: ${first.title}`;
  const more = due.items.length - 1;
  const subject = due.kind === 'welcome'
    ? `You’re on the list. Here’s what’s coming up${school ? ' for ' + school.name : followed.length === 1 && !mine.length ? ' at ' + followed[0] : ''}`
    : lead + (more ? `, plus ${more} more date${more > 1 ? 's' : ''}` : '');
  const line = a => a.kind === 'week' ? a.text : a.kind === 'dayoff' || a.kind === 'camp' ? a.title : `${a.title}: ${a.text.replace(/\.$/, '')}`;
  // One link for each listing in this email, and for each school followed that put something in it: it stops that
  // one, and nothing else. Only an address whose follows are kept by an account has a code for the links.
  const stops = [];
  if (person.stopCode) {
    const add = (key, name) => { if (name && stops.length < 8 && !stops.some(x => x.key === key)) stops.push({ key, name, url: `${feed.site}/alerts/stop/#c=${person.stopCode}&k=${key}` }); };
    for (const a of due.items) {
      for (const id of a.programs || []) add('p:' + id, (feed.programs || []).find(p => p.id === id)?.name);
      for (const id of a.camps || []) add('c:' + id, (feed.camps || []).find(c => c.id === id)?.name);
      for (const id of mine) if (id === 'all' ? a.schools.length : a.schools.includes('*') || a.schools.includes(id)) add('s:' + id, id === 'all' ? 'every school' : feed.schools.find(x => x.id === id)?.name);
      for (const id of a.weeks || []) if ((person.weeks || []).includes(id)) add('w:' + id, feed.schools.find(x => x.id === id) ? `“This week at ${feed.schools.find(x => x.id === id).name}”` : '');
    }
  }
  return {
    token: TOKEN,
    kind: due.kind,
    subject,
    preview: due.kind === 'welcome' ? `${due.items.length} date${due.items.length > 1 ? 's' : ''} already on the calendar.` : due.items.map(line).join(' · ').slice(0, 160),
    heading: onlyAdded ? 'Your school is here' : onlyWeek ? (due.items.length === 1 ? first.title : 'This week at your schools') : due.kind === 'welcome' ? 'You’re on the list' : due.items.every(a => a.kind === 'today') ? 'Today' : due.items.every(a => a.kind === 'soon') ? 'Tomorrow' : due.items.every(a => a.kind === 'soon' || a.kind === 'today') ? 'Today and tomorrow' : due.items.every(a => a.kind === 'register' || a.kind === 'update') ? 'Just posted' : 'Dates coming up',
    intro: onlyAdded ? 'The school you were waiting for has its own page now.'
      : onlyWeek ? 'Here’s the week ahead: days off, the school’s own dates and sign-ups at the programs that serve it.'
      : due.kind === 'welcome'
      ? `Here is what’s already on the calendar${whose}. After this you’ll hear from us the morning after a sign-up date is posted, then the day before and the morning of, and on ${feed.sendDay} mornings ahead of a day off.`
      : due.items.every(a => a.kind === 'today') ? `It’s today${whose}.` : due.items.every(a => a.kind === 'soon') ? `A reminder: this is tomorrow${whose}.` : due.items.every(a => a.kind === 'soon' || a.kind === 'today') ? `Reminders${whose}.` : due.items.every(a => a.kind === 'register' || a.kind === 'update') ? `Just posted${whose}.${due.items.every(a => a.kind === 'register' && isoAdd(a.sendOn, 1) < a.date) ? ' We’ll remind you the day before and that morning.' : ''}` : `Here’s what’s coming up${whose}.`,
    reason,
    school: school ? school.id : everySchool ? 'all' : '',
    programs: person.programs || [],
    camps: person.camps || [],
    school_name: school ? school.name : '',
    school_url: school ? `${feed.site}/${school.id}/?utm_source=klaviyo&utm_medium=email&utm_campaign=dates` : `${feed.site}/?utm_source=klaviyo&utm_medium=email&utm_campaign=dates`,
    dates: due.items.map(a => ({ when: a.when, title: a.title, text: a.text, lines: a.lines || [], url: a.url, button: a.button, kind: a.kind })),
    stops: stops.map(({ name, url }) => ({ name, url })),
    manage: `${feed.site}/profile/#following`,
  };
}

// ----- what people have stopped -----
// The site keeps the last word on what someone has stopped following: a tap on "Stop emails about ..." in an email
// lands there, with no sign-in, and Klaviyo may not have been told. The site publishes a list of scrambled entries
// (a hash of the person's own stop code and the listing), which means nothing to anyone without the code. The code
// is on the person's Klaviyo profile, so this script can tell which of their follows to leave out.
const stopHash = (code, key) => createHash('sha256').update(code + '|' + key).digest('hex');
// Three kinds of entry: "<key>" (that follow was turned off), "mute|<key>" (stopped from an email: nothing about
// that listing, even by way of a school) and "*" (everything).
export function withoutStopped(person, stopped, feed) {
  if (!person.stopCode || !stopped || !stopped.size) return person;
  const has = key => stopped.has(stopHash(person.stopCode, key));
  if (has('*')) return { ...person, school: '', schools: [], programs: [], camps: [], weeks: [], muted: [] };
  const off = key => has(key) || has('mute|' + key);
  return { ...person,
    school: person.school && off('s:' + person.school) ? '' : person.school,
    schools: (person.schools || []).filter(id => !off('s:' + id)),
    programs: (person.programs || []).filter(id => !off('p:' + id)),
    camps: (person.camps || []).filter(id => !off('c:' + id)),
    weeks: (person.weeks || []).filter(id => !off('w:' + id)),
    muted: [...(feed?.programs || []).map(x => 'p:' + x.id), ...(feed?.camps || []).map(x => 'c:' + x.id)].filter(key => has('mute|' + key)) };
}
async function stoppedList(site) {
  const url = (process.env.PAS_SITE_API || site + '/groups/api.php') + '?action=stopped';
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'X-PAS': '1', accept: 'application/json' } });
      if (!r.ok) throw new Error('the site answered ' + r.status);
      const d = await r.json();
      if (!d || d.ok !== true || !Array.isArray(d.list)) throw new Error('the answer was not a list');
      return new Set(d.list.filter(h => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h)));
    } catch (err) {
      if (attempt >= 3) throw new Error(`Couldn’t read the list of stopped follows from the site (${err.message}). Nothing was sent, so nobody is emailed about something they stopped; the next run tries again.`);
      await new Promise(done => setTimeout(done, attempt * 3000));
    }
  }
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
      const ids = key => [].concat(a.properties?.[key] || []).map(x => String(x).toLowerCase()).filter(x => /^[a-z0-9-]+$/.test(x));
      const programs = ids('programs'), camps = ids('camps'), waiting = ids('waiting_schools'), followedSchools = ids('schools'), weeks = ids('weeks');
      // An address whose follows are kept by an account hears about exactly what the account follows, even when that is
      // nothing: it is never treated as "added some other way".
      const managed = a.properties?.follows_from_account === true;
      const stopCode = /^[a-f0-9]{32}$/.test(String(a.properties?.stop_code || '')) ? String(a.properties.stop_code) : '';
      // Someone who only asked about a program, a camp or a school that isn't covered yet hears about that and nothing
      // else. An address with none of these was added some other way: send it everything.
      const narrow = programs.length || camps.length || waiting.length || followedSchools.length || weeks.length || managed;
      people.push({ id: p.id, email: a.email, school: /^[a-z0-9-]+$/.test(school) ? school : narrow ? '' : 'all', schools: followedSchools, programs, camps, waiting, weeks, stopCode, joined: localDay(new Date(a.joined_group_at || Date.now())) });
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
  console.log(`Secrets found: KLAVIYO_API_KEY ${KEY ? 'yes' : 'NO'}, ALERTS_TOKEN ${TOKEN ? 'yes' : 'NO'}.`);   // never the values
  if (!KEY) return console.log('There is no KLAVIYO_API_KEY secret, so nothing was sent.');
  if (!TOKEN && !DRY) return console.log('There is no ALERTS_TOKEN secret, so nothing was sent.');
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  if (!DRY && !flag('--any-time') && (clock < WINDOW[0] || clock >= WINDOW[1])) return console.log(`It is ${clock} in Philadelphia. Emails only go out between ${WINDOW[0]} and ${WINDOW[1]}, so nothing was sent.`);

  const listed = await subscribers(cfg.alerts.listId);
  const stopped = cfg.groups ? await stoppedList(feed.site) : new Set();
  const people = listed.map(p => withoutStopped(p, stopped, feed));
  const fewer = people.filter((p, i) => (p.muted || []).length || p.programs.length + p.camps.length + p.schools.length + (p.school ? 1 : 0) < listed[i].programs.length + listed[i].camps.length + listed[i].schools.length + (listed[i].school ? 1 : 0)).length;
  console.log(`${stopped.size} stopped follow(s) on the site’s list; ${fewer} subscriber(s) have something left out because of it.`);
  const bySchool = {};
  for (const p of people) bySchool[p.school || 'no school'] = (bySchool[p.school || 'no school'] || 0) + 1;
  console.log(`${people.length} subscriber(s): ${Object.entries(bySchool).map(([k, n]) => `${k} ${n}`).join(', ') || 'none yet'}. ${people.filter(p => p.programs.length).length} follow at least one program, ${people.filter(p => p.camps.length).length} at least one camp, ${people.filter(p => p.waiting.length).length} are waiting for a school.`);

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
