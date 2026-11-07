// Following a school, a program or a camp for its dates; saving favorites; stopping from an email without signing
// in; asking for a school the site doesn't cover.
import { test, ok, eq, deepEq, includes, excludes, person } from '../lib/harness.mjs';
import { pickupPair, twoCamps, schools, uncoveredSchool } from '../lib/data.mjs';
import crypto from 'node:crypto';

test('follow and unfollow: schools, programs, camps and the Sunday email, with the parts of a program chosen', async (ctx) => {
  const pat = person(ctx);
  const { program, school } = pickupPair();
  const { ids } = twoCamps();
  await pat.fails('POST', 'follow', { key: 'p:no-such-program', on: true }, 'key');
  await pat.fails('POST', 'follow', { key: 'x:' + program.id, on: true }, 'key');
  let r = await pat.okay('POST', 'follow', { key: 's:' + school, on: true });
  deepEq(r.follows.map(f => f.k), ['s:' + school]);
  ok(r.follows[0].n.length > 0, 'the school’s short name comes back'); eq(r.follows[0].kinds, null, 'a school is followed whole');
  r = await pat.okay('POST', 'follow', { key: 'p:' + program.id, on: true, kinds: ['off', 'after', 'nonsense'] });
  const pf = r.follows.find(f => f.k === 'p:' + program.id);
  deepEq(pf.kinds, ['after', 'off'], 'the known parts, sorted');
  r = await pat.okay('POST', 'follow', { key: 'p:' + program.id, on: true, kinds: ['after', 'weekend', 'off', 'summer'] });
  eq(r.follows.find(f => f.k === 'p:' + program.id).kinds, null, 'all four parts is the whole program');
  await pat.okay('POST', 'follow', { key: 'c:' + ids[0], on: true });
  await pat.okay('POST', 'follow', { key: 'w:' + school, on: true });
  await pat.okay('POST', 'follow', { key: 's:all', on: true });
  r = await pat.okay('GET', 'marks');
  deepEq(r.follows.map(f => f.k).sort(), ['c:' + ids[0], 'p:' + program.id, 's:' + school, 's:all', 'w:' + school].sort());
  eq(r.follows.find(f => f.k === 's:all').n, 'Every school on the site');
  ok(r.follows.find(f => f.k === 'w:' + school).n.startsWith('This week at '));
  ok(r.sync.length >= 5, 'the email list has yet to be told about each');
  r = await pat.okay('POST', 'follow', { key: 's:' + school, on: false });
  ok(!r.follows.find(f => f.k === 's:' + school), 'unfollowed');
  // The job that syncs the email list marks them told.
  r = await pat.okay('POST', 'follow_synced', { keys: r.sync });
  deepEq(r.sync, [], 'nothing left to tell');
  r = await pat.okay('POST', 'follow_clear');
  deepEq(r.follows, [], 'everything unfollowed at once');
});

test('favorites: listings only, on and off', async (ctx) => {
  const pat = person(ctx);
  const { program, school } = pickupPair();
  const { ids } = twoCamps();
  await pat.fails('POST', 'fav', { key: 's:' + school, on: true }, 'key');
  let r = await pat.okay('POST', 'fav', { key: 'p:' + program.id, on: true });
  deepEq(r.favs.map(f => f.k), ['p:' + program.id]);
  eq(r.favs[0].n, program.name);
  r = await pat.okay('POST', 'fav', { key: 'c:' + ids[0], on: true });
  eq(r.favs.length, 2);
  r = await pat.okay('POST', 'fav', { key: 'p:' + program.id, on: false });
  deepEq(r.favs.map(f => f.k), ['c:' + ids[0]]);
  deepEq((await pat.okay('GET', 'profile')).favs.map(f => f.k), ['c:' + ids[0]], 'the profile carries them');
});

test('stopping from an email: the account’s stop code, one listing or everything, undo, and the public stopped list', async (ctx) => {
  const pat = person(ctx);
  const { program, school } = pickupPair();
  await pat.okay('POST', 'follow', { key: 's:' + school, on: true });
  await pat.okay('POST', 'follow', { key: 'p:' + program.id, on: true });
  // The stop code is the account's; the tests read it from the database the way the email job's links carry it.
  const code = ctx.site.sql(`SELECT stop_code FROM users WHERE id = ${pat.id}`)[0].stop_code;
  const stopper = ctx.api();   // not signed in: the link works on its own
  await stopper.fails('POST', 'stop', { c: 'f'.repeat(32), k: 'p:' + program.id, do: 'look' }, 'gone', 404);
  let r = await stopper.okay('POST', 'stop', { c: code, k: 'p:' + program.id, do: 'look' });
  eq(r.on, true); eq(r.muted, false); eq(r.name, program.name); eq(r.left.length, 2);
  r = await stopper.okay('POST', 'stop', { c: code, k: 'p:' + program.id, do: 'stop' });
  eq(r.on, false); eq(r.muted, true); eq(r.left.length, 1, 'the school is still followed');
  // The public list carries a scrambled entry and nothing readable.
  const stopped = await ctx.api().okay('GET', 'stopped');
  const h = crypto.createHash('sha256').update(code + '|mute|p:' + program.id).digest('hex');
  includes(stopped.list, h, 'the scrambled mute is on the list');
  for (const x of stopped.list) ok(/^[a-f0-9]{64}$/.test(x), 'only hashes');
  excludes(JSON.stringify(stopped), pat.email); excludes(JSON.stringify(stopped), code);
  // Signed in, the account page offers to hear about it again.
  let marks = await pat.okay('GET', 'marks');
  ok(marks.muted && marks.muted.some(m => m.k === 'p:' + program.id), 'listed as muted on the account');
  await pat.okay('POST', 'unmute', { key: 'p:' + program.id });
  marks = await pat.okay('GET', 'marks');
  ok(!(marks.muted || []).some(m => m.k === 'p:' + program.id), 'no longer muted');
  // Undo from the email puts the follow back; "everything" stops all.
  await stopper.okay('POST', 'stop', { c: code, k: 'p:' + program.id, do: 'stop' });
  r = await stopper.okay('POST', 'stop', { c: code, k: 'p:' + program.id, do: 'undo', follow: true });
  eq(r.on, true); eq(r.left.length, 2);
  r = await stopper.okay('POST', 'stop', { c: code, k: '*', do: 'stop' });
  deepEq(r.left, []);
  includes((await ctx.api().okay('GET', 'stopped')).list, crypto.createHash('sha256').update(code + '|*').digest('hex'));
  deepEq((await pat.okay('GET', 'marks')).follows, [], 'nothing followed');
  await pat.okay('POST', 'follow', { key: 's:' + school, on: true });   // following again lifts the stop
  excludes((await ctx.api().okay('GET', 'stopped')).list, crypto.createHash('sha256').update(code + '|*').digest('hex'));
});

test('asking for a school the site doesn’t cover: counted once per account, and visible to anyone as a count', async (ctx) => {
  const pat = person(ctx);
  const id = uncoveredSchool();
  await pat.fails('POST', 'school_ask', { s: 'no-such-school-anywhere' }, 'school', 404);
  let r = await ctx.api().okay('GET', 'school_ask', 's=' + id);
  eq(r.asked, false); eq(r.count, 0);
  r = await pat.okay('POST', 'school_ask', { s: id });
  eq(r.new, true); eq(r.count, 1);
  r = await pat.okay('POST', 'school_ask', { s: id });
  eq(r.new, false); eq(r.count, 1, 'once per account');
  r = await pat.okay('GET', 'school_ask', 's=' + id);
  eq(r.asked, true);
  const other = person(ctx, 'Jo', 'Admin', 'jo');
  eq((await other.okay('POST', 'school_ask', { s: id })).count, 2);
  await pat.fails('POST', 'school_ask', { s: 'Not A Slug!' }, 'school');
  ok(schools().length > 0);
});
