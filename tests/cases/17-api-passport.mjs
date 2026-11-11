// Kids' Playground's data (the "passport" endpoint, its first name): what a parent confirms each child has been to,
// suggested from the household's plans, and the child's own lightbulb, pins shown and level.
import { test, ok, eq, deepEq, includes, excludes, person } from '../lib/harness.mjs';
import { pickupPair, weekendProgram, twoCamps, upcomingDaysOff, daysOff, schoolYearStart, config } from '../lib/data.mjs';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const empty = () => Object.fromEntries(DAYS.map(d => [d, []]));
const pastDayOff = () => { const past = daysOff().days.filter(d => d.date < '2026-11-09').map(d => d.date); return past[past.length - 1]; };   // the fixed day is 2026-11-09

test('a passport per child: suggestions come from the kept week, past camp weeks and past days off, and nothing else', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee');
  const { entry, program, school } = pickupPair();
  const { program: wp, day: wd } = weekendProgram();
  const { season, ids } = twoCamps();
  const y = schoolYearStart();
  const past = pastDayOff(), future = upcomingDaysOff()[0];
  ok(past, 'a day off before the fixed day');
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '2' }, { n: 'Rae', g: 'K' }] });
  // Sam: a current week with a weekday program and a weekend class; the next week does not count.
  await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry], [wd]: [wp.id] }, next: { ...empty(), tue: [entry] } } });
  // Rae: a summer with one week that has passed and one that has not; days off, one past and one to come.
  await pat.okay('POST', 'summer_save', { summer: { y: season, kids: [{ name: 'Rae', w: { [`${season}-07-06`]: [ids[0]], [`${season + 5}-07-06`]: [ids[1]] } }] } });
  await pat.okay('POST', 'daysoff_save', { daysoff: { y, kids: [{ name: 'Rae', d: { [past]: program.id, [future]: program.id } }] } });
  const p = await pat.okay('GET', 'passport');
  eq(p.year, y, 'the school year the site is in');
  eq(p.kids.length, 2); eq(p.kids[0].name, 'Sam'); eq(p.kids[0].grade, '2');
  deepEq(p.kids[0].done, []); deepEq(p.kids[0].fav, []);
  deepEq(p.kids[0].suggest, [{ k: 'p:' + program.id, kind: 'after', y, s: school }, { k: 'p:' + wp.id, kind: 'weekend', y, s: '' }], 'Sam: this week’s program and the weekend class');
  const rae = p.kids[1];
  const summerY = season <= 2026 ? season : season;   // the summer's own year
  deepEq(rae.suggest, [{ k: 'c:' + ids[0], kind: 'summer', y: summerY, s: '' }, { k: 'p:' + program.id, kind: 'off', y, s: '' }], 'Rae: the camp week that passed, the day off that passed');
});

test('going back: a class counts as often as the plans have it, and comes back to confirm when they have it more', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee', 'rep');
  const { entry, program, school } = pickupPair();
  const { season, ids } = twoCamps();
  const y = schoolYearStart();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '2' }, { n: 'Rae', g: 'K' }] });
  // Three days a week on the kept week: suggested as three times.
  await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry], wed: [entry], fri: [entry] }, next: empty() } });
  let p = await pat.okay('GET', 'passport');
  deepEq(p.kids[0].suggest, [{ k: 'p:' + program.id, kind: 'after', y, s: school, n: 3 }], 'three days a week');
  // Confirmed before as once: it comes back as "now 3, was 1"; no keeps it from asking again for 3.
  const once = { k: 'p:' + program.id, kind: 'after', y, s: school };
  let r = await pat.okay('POST', 'passport_save', { kid: 'Sam', done: [once] });
  deepEq(r.kid.suggest, [{ k: 'p:' + program.id, kind: 'after', y, s: school, n: 3, up: 1 }], 'more times than confirmed');
  r = await pat.okay('POST', 'passport_save', { kid: 'Sam', done: [once], skip: ['p:' + program.id + '|after|' + y + '|3'] });
  deepEq(r.kid.suggest, [], 'not that many times: not asked again');
  r = await pat.okay('POST', 'passport_save', { kid: 'Sam', done: [{ ...once, n: 3 }], skip: [] });
  deepEq(r.kid.done, [{ ...once, n: 3 }]); deepEq(r.kid.suggest, [], 'three, as the plans say');
  // Two weeks of the same camp that have started: two times.
  await pat.okay('POST', 'summer_save', { summer: { y: season, kids: [{ name: 'Rae', w: { [`${season}-07-06`]: [ids[0]], [`${season}-07-13`]: [ids[0]], [`${season + 5}-07-20`]: [ids[0]] } }] } });
  p = await pat.okay('GET', 'passport');
  deepEq(p.kids[1].suggest, [{ k: 'c:' + ids[0], kind: 'summer', y: season, s: '', n: 2 }], 'two camp weeks so far');
  // What a save keeps: 2 to 20 times, 1 left out, the rest dropped; the Repeater pin, the map's spots and a neighborhood's surprises as seen.
  r = await pat.okay('POST', 'passport_save', { kid: 'Rae', done: [{ k: 'c:' + ids[0], kind: 'summer', y: season, n: 1 }, { k: 'c:' + ids[1], kind: 'summer', y: season, n: 99 }, { k: 'p:' + program.id, kind: 'off', y, n: 'lots' }], seen: { repeat: 2, 'map:south': 3, 'map:<b>': 1, 'hood:point-breeze': 2, 'hood:<i>': 1, 'hood:fishtown': 4 } });
  deepEq(r.kid.done.map(e => e.n), [undefined, 20, undefined]);
  deepEq(r.kid.seen, { repeat: 2, 'map:south': 3, 'hood:point-breeze': 2 }, 'a neighborhood’s surprises seen, 1 or 2 of them');
});

test('starting a child over: the bulb, what was shown, Eddie’s welcome and the favorites go; the classes stay unless asked', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee', 'reset');
  const { program, school } = pickupPair();
  const { program: wp } = weekendProgram();
  const y = schoolYearStart();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam' }] });
  const done = [{ k: 'p:' + program.id, kind: 'after', y, s: school }, { k: 'p:' + wp.id, kind: 'weekend', y, s: '' }];
  await pat.okay('POST', 'passport_save', { kid: 'Sam', done, skip: ['p:' + program.id + '|off|' + y], fav: [done[1].k, done[0].k], av: { b: 'globe', c: 3, w: { hat: 'cap' } }, seen: { intro: 1, 'season:after': 1 }, lvl: 3 });
  let r = await pat.okay('POST', 'passport_reset', { kid: 'sam' });
  eq(r.kid.name, 'Sam'); deepEq(r.kid.done, done, 'the classes stay'); deepEq(r.kid.skip, ['p:' + program.id + '|off|' + y]);
  eq(r.kid.av, null); deepEq(r.kid.seen, {}); eq(r.kid.lvl, 0); deepEq(r.kid.fav, [], 'favorites picked again');
  r = await pat.okay('POST', 'passport_reset', { kid: 'Sam', classes: true });
  deepEq(r.kid.done, []); deepEq(r.kid.skip, []);
  eq(ctx.site.sql(`SELECT COUNT(*) AS n FROM passports WHERE user_id = ${pat.id}`)[0].n, 0, 'nothing left to keep');
  await pat.fails('POST', 'passport_reset', { kid: 'Zed' }, 'kid', 404);
  eq((await pat.okay('POST', 'passport_reset', { kid: 'Sam' })).kid.av, null, 'starting over with nothing there is fine');
});

test('confirming, waving away and ranking: saved per child, sealed on disk, gone when the account goes', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee', 'pp');
  const { entry, program, school } = pickupPair();
  const y = schoolYearStart();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Zelphina', g: '3' }] });
  await pat.okay('POST', 'week_save', { week: { name: 'Zelphina', now: { ...empty(), mon: [entry] }, next: empty() } });
  await pat.fails('POST', 'passport_save', { kid: 'Nobody', done: [] }, 'kid', 404);
  await pat.fails('POST', 'passport_save', { kid: '', done: [] }, 'kid');
  // Confirm the suggestion, add one by hand, wave one away, and rank; junk is dropped.
  const r = await pat.okay('POST', 'passport_save', { kid: 'zelphina', done: [{ k: 'p:' + program.id, kind: 'after', y, s: school }, { k: 'p:' + program.id, kind: 'after', y, s: school }, { k: 'p:no-such', kind: 'after', y }, { k: 'p:' + program.id, kind: 'party', y }, { k: 'p:' + program.id, kind: 'off', y: 1999 }, { k: 'p:' + program.id, kind: 'off', y: y - 1, s: 'nowhere' }], skip: ['c:x|summer|2026', 'bad key'], fav: ['p:' + program.id, 'p:' + program.id, 'p:nope'] });
  eq(r.kid.name, 'Zelphina', 'the name as the kids list spells it');
  deepEq(r.kid.done, [{ k: 'p:' + program.id, kind: 'after', y, s: school }, { k: 'p:' + program.id, kind: 'off', y: y - 1, s: '' }]);
  deepEq(r.kid.skip, ['c:x|summer|2026']); deepEq(r.kid.fav, ['p:' + program.id]);
  deepEq(r.kid.suggest, [], 'the confirmed program is no longer suggested');
  // Sealed on disk: the child's name and the listing ids are not readable.
  const bytes = ctx.site.dbBytes().toString('latin1');
  excludes(bytes, 'Zelphina'); excludes(bytes, '"k":"p:' + program.id);
  const rows = ctx.site.sql(`SELECT name, json FROM passports WHERE user_id = ${pat.id}`);
  eq(rows.length, 1); ok(rows[0].name.startsWith('e1.') && rows[0].json.startsWith('e1.'));
  // The planners get the favorites through the profile.
  const prof = await pat.okay('GET', 'profile');
  deepEq(prof.favorites, [{ name: 'Zelphina', fav: ['p:' + program.id] }]);
  // Emptying it removes the row; deleting the account removes everything.
  await pat.okay('POST', 'passport_save', { kid: 'Zelphina', done: [], skip: [], fav: [] });
  eq(ctx.site.sql(`SELECT COUNT(*) AS n FROM passports WHERE user_id = ${pat.id}`)[0].n, 0);
  await pat.okay('POST', 'passport_save', { kid: 'Zelphina', done: [{ k: 'p:' + program.id, kind: 'after', y, s: school }] });
  await pat.okay('POST', 'delete_account');
  eq(ctx.site.sql(`SELECT COUNT(*) AS n FROM passports`)[0].n >= 0, true);
  eq(ctx.site.sql(`SELECT COUNT(*) AS n FROM passports WHERE user_id = ${pat.id}`)[0].n, 0, 'gone with the account');
});

test('co-parents share the passports: a partner’s passports move to the household, same names merge', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee', 'cp');
  const dana = person(ctx, 'Dana', 'Reyes', 'cd');
  const { program, school } = pickupPair();
  const { ids } = twoCamps();
  const y = schoolYearStart();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam' }] });
  await pat.okay('POST', 'passport_save', { kid: 'Sam', done: [{ k: 'p:' + program.id, kind: 'after', y, s: school }], fav: ['p:' + program.id] });
  await dana.okay('POST', 'kids_save', { kids: [{ n: 'sam' }, { n: 'Zoe' }] });
  await dana.okay('POST', 'passport_save', { kid: 'Sam', done: [{ k: 'c:' + ids[0], kind: 'summer', y }], fav: ['c:' + ids[0]] });
  await dana.okay('POST', 'passport_save', { kid: 'Zoe', done: [{ k: 'c:' + ids[1], kind: 'summer', y }] });
  await pat.okay('POST', 'coparent_invite', { email: dana.email });
  await dana.okay('POST', 'coparent_accept');
  const p = await dana.okay('GET', 'passport');
  deepEq(p.kids.map(k => k.name), ['Sam', 'Zoe']);
  deepEq(p.kids[0].done.map(d => d.k), ['p:' + program.id, 'c:' + ids[0]], 'Sam’s two passports became one');
  deepEq(p.kids[0].fav, ['p:' + program.id, 'c:' + ids[0]]);
  deepEq(p.kids[1].done.map(d => d.k), ['c:' + ids[1]]);
  deepEq((await pat.okay('GET', 'passport')).kids.map(k => k.name), ['Sam', 'Zoe'], 'Pat sees the same');
  // Either can change it.
  await dana.okay('POST', 'passport_save', { kid: 'Zoe', done: [], fav: [] });
  eq((await pat.okay('GET', 'passport')).kids[1].done.length, 0);
  void config;
});

test('Kids’ Playground keeps each child’s lightbulb, the pins already shown and the level celebrated, and nothing it doesn’t know', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee', 'kc');
  const { program, school } = pickupPair();
  const y = schoolYearStart();
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam' }, { n: 'Rae' }] });
  // A bulb alone keeps the row (a child can pick one before any class). A monster from before the bulbs becomes the
  // bulb in its place.
  let r = await pat.okay('POST', 'passport_save', { kid: 'Rae', done: [], av: { b: 'squid', c: 3 } });
  deepEq(r.kid.av, { b: 'holiday', c: 3 }); deepEq(r.kid.seen, {}); eq(r.kid.lvl, 0);
  eq(ctx.site.sql(`SELECT COUNT(*) AS n FROM passports WHERE user_id = ${pat.id}`)[0].n, 1);
  // Made-up bodies, colors, pins and levels are dropped.
  r = await pat.okay('POST', 'passport_save', { kid: 'Sam', done: [{ k: 'p:' + program.id, kind: 'after', y, s: school }], av: { b: 'dragon', c: 4 }, seen: { 'type:music': 2, 'explore': 1, 'hack<script>': 3, 'season:after': 9 }, lvl: 500 });
  eq(r.kid.av, null, 'not a bulb the page draws'); deepEq(r.kid.seen, { 'type:music': 2, explore: 1 }); eq(r.kid.lvl, 0);
  const done = [{ k: 'p:' + program.id, kind: 'after', y, s: school }];
  r = await pat.okay('POST', 'passport_save', { kid: 'Sam', done, av: { b: 'mushroom', c: 12 } });
  eq(r.kid.av, null, 'not a color the page has');
  // A save that leaves them out keeps them: the grown-ups' corner saves only the lists.
  await pat.okay('POST', 'passport_save', { kid: 'Sam', done, av: { b: 'mushroom', c: 9 }, seen: { 'type:music': 1 }, lvl: 3 });
  r = await pat.okay('POST', 'passport_save', { kid: 'Sam', done, skip: [], fav: [] });
  deepEq(r.kid.av, { b: 'mushroom', c: 9 }); deepEq(r.kid.seen, { 'type:music': 1 }); eq(r.kid.lvl, 3);
  // What the bulb wears: one thing per place, only things the page has.
  r = await pat.okay('POST', 'passport_save', { kid: 'Sam', av: { b: 'mushroom', c: 9, w: { hat: 'crown', face: 'lasers', back: 'wings', neck: 5, tail: 'bow' } } });
  deepEq(r.kid.av, { b: 'mushroom', c: 9, w: { hat: 'crown', back: 'wings' } });
  r = await pat.okay('POST', 'passport_save', { kid: 'Sam', done, skip: [], fav: [] });
  deepEq(r.kid.av.w, { hat: 'crown', back: 'wings' }, 'kept when left out');
  r = await pat.okay('POST', 'passport_save', { kid: 'Sam', av: { b: 'mushroom', c: 9, w: {} } });
  deepEq(r.kid.av, { b: 'mushroom', c: 9 }, 'taking it all off');
  r = await pat.okay('POST', 'passport_save', { kid: 'Sam', av: { b: 'mushroom', c: 9, w: { hat: 'crown' } } });
  const p = await pat.okay('GET', 'passport');
  deepEq(p.kids.map(k => [k.name, k.av && k.av.b, k.lvl]), [['Sam', 'mushroom', 3], ['Rae', 'holiday', 0]]);
  deepEq(p.kids[0].av.w, { hat: 'crown' });
  // Sealed like the rest: the bulb isn't readable in the database.
  const rows = ctx.site.sql(`SELECT json FROM passports WHERE user_id = ${pat.id}`);
  ok(rows.every(x => !/mushroom|holiday|type:music|crown/.test(x.json)), 'stored sealed');
});
