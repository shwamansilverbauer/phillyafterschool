// Sharing a child's week: with one person from the account page, and in a group. Only invited addresses get in,
// copies follow the kept week, and removing the week ends the shares.
import { test, ok, eq, deepEq, includes, excludes, person } from '../lib/harness.mjs';
import { pickupPair, classPair } from '../lib/data.mjs';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const empty = () => Object.fromEntries(DAYS.map(d => [d, []]));
const codeFrom = m => { const x = /If it asks for a code:\s*([A-Z0-9 -]{12,20})/i.exec(m.TextBody || '') || /\/join\/#([A-Za-z0-9-]{12,20})/.exec(m.TextBody || ''); if (!x) throw new Error('no code in the invitation: ' + (m.TextBody || '').slice(0, 300)); return x[1].trim(); };

test('share a kept week with one person from the account page: the email, who has it, and the copy follows the week', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee');
  const { entry, program, school } = pickupPair();
  const w = (await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } })).week;
  const dana = person(ctx, 'Dana', 'Reyes', 'dana');
  // Sharing needs a name on the account, an address that is not one's own, and a week with something in it.
  const nameless = ctx.api().as(ctx.standin.mail ? `nn${Date.now()}@example.test` : 'x@example.test');
  await nameless.fails('POST', 'share_one', { email: dana.email, week: 1 }, 'yourname');
  await pat.fails('POST', 'share_one', { email: pat.email, week: w.id }, 'email');
  const blank = (await pat.okay('POST', 'week_save', { week: { name: 'Rae', now: empty(), next: empty() } })).week;
  await pat.fails('POST', 'share_one', { email: dana.email, week: blank.id }, 'empty');
  const r = await pat.okay('POST', 'share_one', { email: dana.email, week: w.id });
  eq(r.made, true, 'a new shared week'); eq(r.sent, true, 'the invitation went out'); eq(r.name, 'Sam’s week');
  const m = await ctx.mail.waitFor(dana.email, /Sam/);
  includes(m.TextBody, 'Pat Lee', 'who shared it'); includes(m.TextBody, '/join/#', 'the link');
  excludes(m.TextBody, program.id, 'the email carries no plan details');
  // The profile lists who has it.
  let prof = await pat.okay('GET', 'profile');
  const kept = prof.weeks.find(x => x.id === w.id);
  eq(kept.shares.length, 1); eq(kept.shares[0].solo, true); eq(kept.shares[0].id, r.id);
  deepEq(kept.shares[0].invites.map(i => i.email), [dana.email]);
  // A second person on the same shared week reuses it.
  const jo = person(ctx, 'Jo', 'Admin', 'jo');
  const r2 = await pat.okay('POST', 'share_one', { email: jo.email, week: w.id });
  eq(r2.made, false, 'the same shared week'); eq(r2.id, r.id);
  // Dana joins with the code from the email, as a viewer, and sees Sam's week with the school stripped.
  const code = codeFrom(m);
  const peek = await dana.okay('POST', 'group_peek', { code });
  eq(peek.solo, true); eq(peek.name, 'Sam’s week'); eq(peek.member, false);
  const j = await dana.okay('POST', 'group_join', { code });
  eq(j.status, 'approved'); eq(j.solo, true); eq(j.kid, null, 'a viewer adds no child');
  let g = await dana.okay('GET', 'group', 'g=' + r.id);
  eq(g.role, 'viewer'); eq(g.kids.length, 1); eq(g.kids[0].name, 'Sam'); eq(g.kids[0].mine, false);
  deepEq(g.kids[0].now.mon, [program.id], 'the group copy names the program, not the school');
  ok(!('code' in g) && !('members' in g), 'a viewer sees no code and no member list');
  // Dana can't change it.
  await dana.fails('POST', 'kid_save', { group: r.id, kid: { id: g.kids[0].id, name: 'Sam', now: empty(), next: empty() } }, 'forbidden', 403);
  // Pat changes the kept week: the copy follows.
  const { program: cp, school: cs, cls } = classPair();
  await pat.okay('POST', 'week_save', { week: { id: w.id, name: 'Sammy', now: { ...empty(), tue: [`${cp.id}.${cs}~${cls}`] }, next: empty() } });
  g = await dana.okay('GET', 'group', 'g=' + r.id);
  eq(g.name, 'Sammy’s week', 'the shared week is renamed with the child');
  eq(g.kids[0].name, 'Sammy'); deepEq(g.kids[0].now.mon, []); deepEq(g.kids[0].now.tue, [`${cp.id}~${cls}`]);
  // Someone who was not invited can't get in with the code.
  const stranger = person(ctx, 'Sly', 'Fox', 'str');
  await stranger.fails('POST', 'group_peek', { code }, 'notinvited');
  // Removing the week ends the share.
  await pat.okay('POST', 'week_delete', { week: w.id });
  const gone = await dana.get('group', 'g=' + r.id);
  eq(gone.status, 403, 'the shared week is gone for Dana');
  prof = await pat.okay('GET', 'profile');
  ok(!prof.weeks.find(x => x.id === w.id), 'and out of the profile');
  void school;
});

test('a group: made by a named account, joined only from invited addresses, each family adds its children', async (ctx) => {
  const owner = person(ctx, 'Pat', 'Lee');
  const { entry, program } = pickupPair();
  await ctx.api().as(`nn2${Date.now()}@example.test`).fails('POST', 'group_create', { name: 'Room 12' }, 'yourname');
  await owner.fails('POST', 'group_create', { name: '' }, 'name');
  const g = await owner.okay('POST', 'group_create', { name: 'Room <12> & co' });
  eq(g.name, 'Room 12 co', 'angle brackets and ampersands dropped');
  ok(/^[A-Z0-9-]{12,20}$/i.test(g.code), 'a join code');
  const dana = person(ctx, 'Dana', 'Reyes', 'dana');
  const jo = person(ctx, 'Jo', 'Admin', 'jo');
  // Invite two addresses at once, plus some junk.
  const inv = await owner.okay('POST', 'invite_add', { group: g.id, emails: `${dana.email}, ${jo.email}; not-an-address` });
  eq(inv.sent, 2); deepEq(inv.bad, ['not-an-address']); eq(inv.invites.length, 2);
  const m = await ctx.mail.waitFor(dana.email, /Room/);
  eq(codeFrom(m), g.code, 'the invitation carries the code');
  // Dana joins with a child; Jo looks on as a viewer; a stranger is refused.
  // A child added straight to a group names programs without a school (the device's group format); the school form is for kept weeks.
  const dj = await dana.okay('POST', 'group_join', { code: g.code, kid: { name: 'Rae', now: { ...empty(), mon: [program.id, entry, 'a typed note'] }, next: empty() } });
  eq(dj.status, 'approved'); ok(dj.kid > 0); eq(dj.solo, false);
  const jj = await jo.okay('POST', 'group_join', { code: g.code, viewer: true });
  eq(jj.kid, null);
  const stranger = person(ctx, 'Sly', 'Fox', 'str');
  await stranger.fails('POST', 'group_join', { code: g.code, viewer: true }, 'notinvited');
  await owner.fails('POST', 'group_join', { code: 'NOPE-NOPE-NOPE', viewer: true }, 'code', 404);
  // The owner's email about who joined names the adult, never the child.
  const joined = await ctx.mail.waitFor(owner.email, /Dana Reyes joined/);
  excludes(joined.TextBody, 'Rae', 'the child is not named');
  const viewing = await ctx.mail.waitFor(owner.email, /Jo Admin \(viewing only\) joined/);
  ok(viewing, 'a viewer is announced as viewing only');
  // What each role sees.
  const asOwner = await owner.okay('GET', 'group', 'g=' + g.id);
  eq(asOwner.role, 'owner'); eq(asOwner.code, g.code); eq(asOwner.members.length, 3); eq(asOwner.kids.length, 1);
  deepEq(asOwner.members.find(x => x.email === dana.email).kids, ['Rae']);
  const asJo = await jo.okay('GET', 'group', 'g=' + g.id);
  eq(asJo.role, 'viewer'); eq(asJo.kids[0].name, 'Rae'); deepEq(asJo.kids[0].now.mon, [program.id], 'the program stays; the school-form entry and the note are dropped'); ok(!('members' in asJo));
  // Dana adds a second child and edits the first; six is the most.
  const k2 = await dana.okay('POST', 'kid_save', { group: g.id, kid: { name: 'Zoe', now: empty(), next: empty() } });
  ok(k2.kid > 0);
  await dana.okay('POST', 'kid_save', { group: g.id, kid: { id: dj.kid, name: 'Rae', now: { ...empty(), fri: [program.id] }, next: empty() } });
  const after = await owner.okay('GET', 'group', 'g=' + g.id);
  eq(after.kids.length, 2); deepEq(after.kids.find(k => k.name === 'Rae').now.fri, [program.id]);
  for (const n of ['Ana', 'Ben', 'Cal', 'Dee']) await dana.okay('POST', 'kid_save', { group: g.id, kid: { name: n, now: empty(), next: empty() } });
  await dana.fails('POST', 'kid_save', { group: g.id, kid: { name: 'Eli', now: empty(), next: empty() } }, 'limit');
  // Jo can't edit Dana's child; "me" lists the group for everyone in it.
  await jo.fails('POST', 'kid_save', { group: g.id, kid: { id: dj.kid, name: 'Rae', now: empty(), next: empty() } }, 'gone', 404);
  const mine = (await dana.okay('GET', 'me')).groups;
  eq(mine.length, 1); eq(mine[0].id, g.id); eq(mine[0].kids.length, 6);
  // Rename, a new code (the old one stops working), remove an invitation, remove a member, leave, delete.
  eq((await owner.okay('POST', 'group_rename', { group: g.id, name: 'Room 12' })).name, 'Room 12');
  await dana.fails('POST', 'group_rename', { group: g.id, name: 'Mine now' }, 'forbidden', 403);
  const fresh = (await owner.okay('POST', 'group_code', { group: g.id })).code;
  ok(fresh !== g.code);
  await stranger.fails('POST', 'group_peek', { code: g.code }, 'code', 404);
  const rem = await owner.okay('POST', 'invite_remove', { group: g.id, email: jo.email });
  eq(rem.invites.length, 1);
  eq((await jo.get('group', 'g=' + g.id)).status, 403, 'taking back the invitation takes Jo out too');
  const danaMember = asOwner.members.find(x => x.email === dana.email);
  await owner.okay('POST', 'member_decide', { group: g.id, member: danaMember.id, approve: false });
  eq((await dana.get('group', 'g=' + g.id)).status, 403, 'Dana is out');
  eq((await owner.okay('GET', 'group', 'g=' + g.id)).kids.length, 0, 'and her children went with her');
  await dana.fails('POST', 'group_peek', { code: fresh }, 'notinvited');   // her invitation went too
  // Invited again, she can come back; a member can leave, the owner cannot.
  await owner.okay('POST', 'invite_add', { group: g.id, emails: dana.email });
  await dana.okay('POST', 'group_join', { code: fresh, viewer: true });
  await owner.fails('POST', 'group_leave', { group: g.id }, 'owner');
  await dana.okay('POST', 'group_leave', { group: g.id });
  eq((await dana.get('group', 'g=' + g.id)).status, 403);
  await dana.fails('POST', 'group_delete', { group: g.id }, 'forbidden', 403);
  await owner.okay('POST', 'group_delete', { group: g.id });
  eq((await owner.get('group', 'g=' + g.id)).status, 403, 'gone');
});

test('a week added to a group from the profile follows later saves, and sync from the device updates copies', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee');
  const { entry, program } = pickupPair();
  const g = await pat.okay('POST', 'group_create', { name: 'Carpool' });
  const w = (await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } })).week;
  const k = await pat.okay('POST', 'kid_save', { group: g.id, week: w.id });
  ok(k.kid > 0);
  await pat.fails('POST', 'kid_save', { group: g.id, week: w.id }, 'dup');
  const prof = await pat.okay('GET', 'profile');
  const shares = prof.weeks.find(x => x.id === w.id).shares;
  eq(shares.length, 1); eq(shares[0].id, g.id); eq(shares[0].solo, false); eq(shares[0].kid, k.kid);
  // The device syncs a change to the kept week: the group copy follows.
  const s = await pat.okay('POST', 'sync', { weeks: [{ id: w.id, name: 'Sam', now: { ...empty(), thu: [entry] }, next: empty() }], kids: [] });
  eq(s.weeks.length, 1); eq(s.weeks[0].id, w.id);
  const grp = await pat.okay('GET', 'group', 'g=' + g.id);
  deepEq(grp.kids[0].now.mon, []); deepEq(grp.kids[0].now.thu, [program.id]);
  // A kid or a week that is no longer there comes back as gone.
  const s2 = await pat.okay('POST', 'sync', { weeks: [{ id: 999999, name: 'X', now: empty(), next: empty() }], kids: [{ id: 999999, now: empty(), next: empty() }] });
  deepEq(s2.weeksGone, [999999]); deepEq(s2.gone, [999999]);
  // Deleting the kept week takes the group copy with it.
  await pat.okay('POST', 'week_delete', { week: w.id });
  eq((await pat.okay('GET', 'group', 'g=' + g.id)).kids.length, 0);
});
