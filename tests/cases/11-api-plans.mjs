// Plans kept with the account: a child's week, the summer, the days off, the children themselves. Only listed
// programs and camps are kept, free text never is, and nothing about a child is readable on disk.
import { test, ok, eq, deepEq, includes, excludes, person } from '../lib/harness.mjs';
import { pickupPair, classPair, weekendProgram, twoCamps, upcomingDaysOff, schoolYearStart, monday } from '../lib/data.mjs';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const empty = () => Object.fromEntries(DAYS.map(d => [d, []]));

test('a child’s week: listed programs are kept, anything else is dropped, and the week shows in the profile', async (ctx) => {
  const pat = person(ctx);
  const { entry, program, school } = pickupPair();
  const { program: cp, school: cs, cls } = classPair();
  const { program: wp, day: wd } = weekendProgram();
  const now = { ...empty(), mon: [entry, 'no-such-program.nowhere', 'a note the parent typed'], tue: [`${cp.id}.${cs}~${cls}`, `${cp.id}.${cs}~Not a class`], [wd]: [wp.id, entry] };
  const r = await pat.okay('POST', 'week_save', { week: { name: '  Sam 😀 Jr 2 ', now, next: empty() } });
  const w = r.week;
  eq(w.name, 'Sam Jr', 'a first name: letters, trimmed, no emoji or digits');
  deepEq(w.now.mon, [entry], 'the listed program stays, the unknown one and the note go');
  deepEq(w.now.tue, [`${cp.id}.${cs}~${cls}`, `${cp.id}.${cs}`], 'a real class stays named, a made-up one is dropped to the program');
  deepEq(w.now[wd], [wp.id], 'on a weekend only a program with classes that day, with no school');
  ok(w.id > 0, 'an id');
  const prof = await pat.okay('GET', 'profile');
  eq(prof.weeks.length, 1); eq(prof.weeks[0].id, w.id); eq(prof.weeks[0].name, 'Sam Jr');
  deepEq(prof.weeks[0].shares, [], 'not shared with anyone yet');
  // Update in place, keeping the id.
  const r2 = await pat.okay('POST', 'week_save', { week: { id: w.id, name: 'Sam', now: { ...empty(), wed: [entry] }, next: empty() } });
  eq(r2.week.id, w.id); eq(r2.week.name, 'Sam'); deepEq(r2.week.now.mon, []); deepEq(r2.week.now.wed, [entry]);
  eq((await pat.okay('GET', 'profile')).weeks.length, 1, 'still one week');
  // A week without a name is refused; a week of someone else's can't be touched.
  await pat.fails('POST', 'week_save', { week: { name: '', now: empty(), next: empty() } }, 'kid');
  const other = person(ctx, 'Jo', 'Admin');
  await other.fails('POST', 'week_save', { week: { id: w.id, name: 'Sam', now: empty(), next: empty() } }, 'gone', 404);
  await other.okay('POST', 'week_delete', { week: w.id });   // silently nothing
  eq((await pat.okay('GET', 'profile')).weeks.length, 1, 'someone else deleting it changes nothing');
  await pat.okay('POST', 'week_delete', { week: w.id });
  eq((await pat.okay('GET', 'profile')).weeks.length, 0, 'gone');
  void program; void school;
});

test('a profile holds six weeks at most', async (ctx) => {
  const pat = person(ctx);
  for (let i = 0; i < 6; i++) await pat.okay('POST', 'week_save', { week: { name: 'Kid' + i, now: empty(), next: empty() } });
  await pat.fails('POST', 'week_save', { week: { name: 'Kid7', now: empty(), next: empty() } }, 'limit');
  eq((await pat.okay('GET', 'me')).user.weeks, 6, '"me" counts them');
});

test('the children on the profile: first names, a grade and an age from the lists, no duplicates', async (ctx) => {
  const pat = person(ctx);
  const r = await pat.okay('POST', 'kids_save', { kids: [{ n: 'Rae', g: '2', a: '7' }, { n: 'rae', g: '3' }, { n: 'Zoe', g: 'college', a: '99' }, { n: '', g: '1' }, { n: 'Ana-Lu', g: 'K', a: '5' }] });
  deepEq(r.kids, [{ n: 'Rae', g: '2', a: '7' }, { n: 'Zoe', g: '', a: '' }, { n: 'Ana-Lu', g: 'K', a: '5' }]);
  deepEq(r.grades, ['K', '2'], 'the grade filter follows the children, in grade order');
  deepEq(r.ages, ['5', '7']);
  const prof = await pat.okay('GET', 'profile');
  deepEq(prof.kids, r.kids); deepEq(prof.grades, ['K', '2']);
  const nine = 'Ana Ben Cal Dee Eli Fay Gus Hal Ivy'.split(' ').map(n => ({ n }));
  eq((await pat.okay('POST', 'kids_save', { kids: nine })).kids.length, 8, 'eight at most');
  deepEq((await pat.okay('POST', 'kids_save', { kids: [] })).kids, [], 'cleared');
});

test('the summer: camps the site lists, by week, for each child; other camps and other years are dropped', async (ctx) => {
  const pat = person(ctx);
  const { season, ids } = twoCamps();
  const w1 = `${season}-06-22`, w2 = `${season}-06-29`;
  const r = await pat.okay('POST', 'summer_save', { summer: { y: season, kids: [{ name: 'Sam', w: { [w1]: [ids[0], 'not-a-camp', 'home'], [w2]: [ids[1]], [`${season + 1}-06-22`]: [ids[0]], 'junk': [ids[0]] } }] } });
  eq(r.summer.y, season); eq(r.summer.kids.length, 1); eq(r.summer.kids[0].name, 'Sam');
  deepEq(r.summer.kids[0].w, { [w1]: [ids[0], 'home'], [w2]: [ids[1]] });
  const prof = await pat.okay('GET', 'profile');
  deepEq(prof.summer.kids[0].w, { [w1]: [ids[0], 'home'] , [w2]: [ids[1]] });
  await pat.fails('POST', 'summer_save', { summer: { y: 1999, kids: [{ name: 'Sam', w: {} }] } }, 'summer');
  await pat.fails('POST', 'summer_save', { summer: { y: season, kids: [] } }, 'summer', 400);
  await pat.okay('POST', 'summer_delete');
  eq((await pat.okay('GET', 'profile')).summer, null, 'gone');
});

test('the days off: one listed program or "home" per closed day, and the days ticked as signed up', async (ctx) => {
  const pat = person(ctx);
  const { program } = pickupPair();
  const y = schoolYearStart();
  const days = upcomingDaysOff();
  ok(days.length >= 2, 'the data has upcoming days off');
  const r = await pat.okay('POST', 'daysoff_save', { daysoff: { y, kids: [{ name: 'Rae', d: { [days[0]]: program.id, [days[1]]: 'home', '2031-01-01': program.id, [days[0].replace(/^\d{4}/, String(y - 3))]: 'home' }, ok: [days[0], days[1], days[0]] }] } });
  eq(r.daysoff.y, y); eq(r.daysoff.kids[0].name, 'Rae');
  deepEq(r.daysoff.kids[0].d, { [days[0]]: program.id, [days[1]]: 'home' });
  deepEq(r.daysoff.kids[0].ok, [days[0]], 'only a day with a program can be ticked, and once');
  deepEq((await pat.okay('GET', 'profile')).daysoff.kids[0].d, { [days[0]]: program.id, [days[1]]: 'home' });
  await pat.okay('POST', 'daysoff_delete');
  eq((await pat.okay('GET', 'profile')).daysoff, null);
});

test('nothing about a child is readable on disk: names and plans are encrypted, the parent’s address is not', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee', 'seal');
  const { entry, program } = pickupPair();
  const { season, ids } = twoCamps();
  const y = schoolYearStart();
  const day = upcomingDaysOff()[0];
  await pat.okay('POST', 'week_save', { week: { name: 'Zelphina', now: { ...empty(), mon: [entry] }, next: empty() } });
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Zelphina', g: '2' }, { n: 'Thaddeus', a: '9' }] });
  await pat.okay('POST', 'summer_save', { summer: { y: season, kids: [{ name: 'Thaddeus', w: { [`${season}-07-06`]: [ids[0]] } }] } });
  await pat.okay('POST', 'daysoff_save', { daysoff: { y, kids: [{ name: 'Zelphina', d: { [day]: program.id } }] } });
  const bytes = ctx.site.dbBytes().toString('latin1');
  excludes(bytes, 'Zelphina', 'the child’s name is not on disk in the clear');
  excludes(bytes, 'Thaddeus');
  excludes(bytes, '"' + entry + '"', 'the week’s picks are not on disk in the clear');
  excludes(bytes, '"' + ids[0] + '"', 'the camp picks are not on disk in the clear');
  excludes(bytes, '"' + day + '":"' + program.id, 'the days-off picks are not on disk in the clear');
  includes(bytes, pat.email, 'the parent’s address is readable, as the privacy page says');
  // Written with the "e1." prefix the server uses for sealed values.
  const rows = ctx.site.sql(`SELECT name, now_json FROM weeks WHERE user_id = ${pat.id}`);
  eq(rows.length, 1); ok(rows[0].name.startsWith('e1.'), 'sealed name'); ok(rows[0].now_json.startsWith('e1.'), 'sealed week');
  const kids = ctx.site.sql(`SELECT kids FROM users WHERE id = ${pat.id}`)[0].kids;
  ok(kids.startsWith('e1.'), 'sealed children list');
  // And it all reads back.
  const prof = await pat.okay('GET', 'profile');
  eq(prof.weeks[0].name, 'Zelphina'); eq(prof.kids[1].n, 'Thaddeus'); eq(prof.summer.kids[0].name, 'Thaddeus'); eq(prof.daysoff.kids[0].d[day], program.id);
});

test('school, grades and neighborhood on the account are the account’s own, with only known values kept', async (ctx) => {
  const pat = person(ctx);
  const { school } = pickupPair();
  const r = await pat.okay('POST', 'school_save', { school });
  eq(r.school, school);
  eq((await pat.okay('GET', 'me')).user.school, school, 'kept on the account');
  await pat.fails('POST', 'school_save', { school: 'no-such-school' }, 'school');
  eq((await pat.okay('POST', 'school_save', { school: '' })).school, '', 'cleared');
  const g = await pat.okay('POST', 'grades_save', { grades: ['3', 'K', 'college'] });
  deepEq(g.grades, ['K', '3']);
  const a = await pat.okay('POST', 'ages_save', { ages: ['7', '70'] });
  deepEq(a.ages, ['7']);
  void monday;
});
