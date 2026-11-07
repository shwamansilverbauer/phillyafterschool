// Co-parents: two accounts, one set of plans. The invitation, what accepting merges, both reading and changing
// everything, ending it, and what deleting an account does to the other.
import { test, ok, eq, deepEq, includes, excludes, person } from '../lib/harness.mjs';
import { pickupPair, twoCamps, upcomingDaysOff, schoolYearStart } from '../lib/data.mjs';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const empty = () => Object.fromEntries(DAYS.map(d => [d, []]));

test('inviting a co-parent: named accounts only, one per account, the email, resend and cancel', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee');
  const dana = person(ctx, 'Dana', 'Reyes', 'dana');
  await ctx.api().as(`nn3${Date.now()}@example.test`).fails('POST', 'coparent_invite', { email: dana.email }, 'yourname');
  await pat.fails('POST', 'coparent_invite', { email: pat.email }, 'self');
  await pat.fails('POST', 'coparent_invite', { email: 'nope' }, 'email');
  eq((await pat.okay('GET', 'me')).user.coparent, null, 'nothing yet');
  const r = await pat.okay('POST', 'coparent_invite', { email: dana.email });
  eq(r.sent, true); eq(r.coparent.role, 'owner'); eq(r.coparent.invited, dana.email);
  const m = await ctx.mail.waitFor(dana.email, /Pat Lee/);
  includes(m.TextBody, '/account/#plans', 'the link lands on the Plans tab');
  await pat.fails('POST', 'coparent_invite', { email: 'other@example.test' }, 'one', 400);
  // The invitee sees it, with what accepting would do to their own plans.
  const { entry } = pickupPair();
  await dana.okay('POST', 'week_save', { week: { name: 'Rae', now: { ...empty(), mon: [entry] }, next: empty() } });
  const me = (await dana.okay('GET', 'me')).user.coparent;
  eq(me.role, 'invited'); eq(me.from.name, 'Pat Lee'); eq(me.from.email, pat.email);
  eq(me.mine.weeks, 1); eq(me.mine.summer, false); eq(me.theirs.summer, false);
  // Resend, then the owner cancels: nothing left on either side.
  eq((await pat.okay('POST', 'coparent_resend')).sent, true);
  eq(ctx.mail.to(dana.email).filter(x => /Pat Lee/.test(x.Subject)).length, 2, 'two invitation emails');
  await pat.okay('POST', 'coparent_cancel');
  eq((await pat.okay('GET', 'me')).user.coparent, null);
  eq((await dana.okay('GET', 'me')).user.coparent, null);
  // The invitee can decline (cancel from their side) too.
  await pat.okay('POST', 'coparent_invite', { email: dana.email });
  await dana.okay('POST', 'coparent_cancel');
  eq((await pat.okay('GET', 'me')).user.coparent, null, 'declined: the owner has nothing out');
  await pat.fails('POST', 'coparent_resend', {}, 'none', 404);
});

test('accepting merges into one household: weeks move, children merge, the inviter’s summer and days off win', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee');
  const dana = person(ctx, 'Dana', 'Reyes', 'dana');
  const { entry, program } = pickupPair();
  const { season, ids } = twoCamps();
  const y = schoolYearStart(); const day = upcomingDaysOff()[0];
  // Pat: one week, two children, a summer. Dana: one week, two children (one shared), a summer and a days-off plan.
  const pw = (await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } })).week;
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '2' }, { n: 'Rae', g: 'K' }] });
  await pat.okay('POST', 'summer_save', { summer: { y: season, kids: [{ name: 'Sam', w: { [`${season}-07-06`]: [ids[0]] } }] } });
  const dw = (await dana.okay('POST', 'week_save', { week: { name: 'Rae', now: { ...empty(), tue: [entry] }, next: empty() } })).week;
  await dana.okay('POST', 'kids_save', { kids: [{ n: 'rae', g: '1' }, { n: 'Zoe', a: '9' }] });
  await dana.okay('POST', 'summer_save', { summer: { y: season, kids: [{ name: 'Zoe', w: { [`${season}-07-06`]: [ids[1]] } }] } });
  await dana.okay('POST', 'daysoff_save', { daysoff: { y, kids: [{ name: 'Zoe', d: { [day]: program.id } }] } });
  await pat.okay('POST', 'coparent_invite', { email: dana.email });
  const inv = (await dana.okay('GET', 'me')).user.coparent;
  eq(inv.mine.weeks, 1); eq(inv.mine.kids, 2); eq(inv.mine.summer, true); eq(inv.mine.daysoff, true); eq(inv.theirs.summer, true); eq(inv.theirs.daysoff, false);
  // Only the invited address can accept.
  await person(ctx, 'Sly', 'Fox', 'str').fails('POST', 'coparent_accept', {}, 'none', 404);
  const acc = await dana.okay('POST', 'coparent_accept');
  eq(acc.coparent.role, 'partner'); eq(acc.coparent.with.name, 'Pat Lee');
  const own = (await pat.okay('GET', 'me')).user.coparent;
  eq(own.role, 'owner'); eq(own.with.name, 'Dana Reyes'); eq(own.with.email, dana.email);
  // Both see the same household.
  const pp = await pat.okay('GET', 'profile'), dp = await dana.okay('GET', 'profile');
  deepEq(pp.weeks.map(w => w.id).sort(), [pw.id, dw.id].sort(), 'both weeks under one roof');
  deepEq(dp.weeks.map(w => w.id).sort(), [pw.id, dw.id].sort());
  deepEq(pp.kids.map(k => k.n), ['Sam', 'Rae', 'Zoe'], 'children merged, the duplicate first name once');
  deepEq(dp.kids, pp.kids);
  eq(pp.summer.kids[0].name, 'Sam', 'the inviter’s summer stays'); eq(dp.summer.kids[0].name, 'Sam');
  eq(pp.daysoff.kids[0].name, 'Zoe', 'Dana’s days-off plan came across, since Pat had none'); eq(dp.daysoff.kids[0].d[day], program.id);
  eq((await pat.okay('GET', 'me')).user.weeks, 2); eq((await dana.okay('GET', 'me')).user.weeks, 2, '"me" counts the household’s weeks for both');
  // Either can change anything: Dana edits Pat's week and the children; Pat deletes Dana's week.
  await dana.okay('POST', 'week_save', { week: { id: pw.id, name: 'Sammy', now: { ...empty(), fri: [entry] }, next: empty() } });
  eq((await pat.okay('GET', 'profile')).weeks.find(w => w.id === pw.id).name, 'Sammy');
  await dana.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '3' }] });
  deepEq((await pat.okay('GET', 'profile')).kids.map(k => k.n), ['Sam']);
  await pat.okay('POST', 'week_delete', { week: dw.id });
  eq((await dana.okay('GET', 'profile')).weeks.length, 1);
  await dana.okay('POST', 'summer_delete');
  eq((await pat.okay('GET', 'profile')).summer, null);
  // Grades and ages filters stay each account's own.
  deepEq((await dana.okay('GET', 'me')).user.grades, ['1', '3'], 'Dana’s own filter: her old grade plus the one she just saved');
  deepEq((await pat.okay('GET', 'me')).user.grades, ['K', '2'], 'Pat’s filter untouched by Dana’s save');
  // Neither can start another while linked.
  await pat.fails('POST', 'coparent_invite', { email: 'x@example.test' }, 'one');
  await dana.fails('POST', 'coparent_invite', { email: 'x@example.test' }, 'linked');
  // Ending it, from the partner's side: the plans stay with the inviter.
  const end = await dana.okay('POST', 'coparent_end');
  eq(end.coparent, null);
  eq((await pat.okay('GET', 'me')).user.coparent, null);
  eq((await pat.okay('GET', 'profile')).weeks.length, 1, 'Pat keeps the household’s week');
  eq((await dana.okay('GET', 'profile')).weeks.length, 0, 'Dana starts again with nothing');
  deepEq((await dana.okay('GET', 'profile')).kids, []);
  await dana.fails('POST', 'coparent_end', {}, 'none', 404);
});

test('deleting an account: the co-parent goes back to plans of their own, and an invitation out dies with it', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee');
  const dana = person(ctx, 'Dana', 'Reyes', 'dana');
  const { entry } = pickupPair();
  await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } });
  await pat.okay('POST', 'coparent_invite', { email: dana.email });
  await dana.okay('POST', 'coparent_accept');
  eq((await dana.okay('GET', 'profile')).weeks.length, 1);
  await pat.okay('POST', 'delete_account');
  eq((await dana.okay('GET', 'me')).user.coparent, null, 'no longer linked');
  eq((await dana.okay('GET', 'profile')).weeks.length, 0, 'the household’s plans went with the account that held them');
  await dana.okay('POST', 'week_save', { week: { name: 'Rae', now: empty(), next: empty() } });   // and Dana can make her own again
  // An invitation to an address that then deletes its account leaves nothing behind.
  const jo = person(ctx, 'Jo', 'Admin', 'jo');
  const kim = person(ctx, 'Kim', 'Park', 'kim');
  await jo.okay('POST', 'coparent_invite', { email: kim.email });
  await kim.okay('POST', 'delete_account');
  eq((await jo.okay('GET', 'me')).user.coparent, null, 'the invitation was cleared');
  // The owner's account going away while an invitation is out: the invitee sees nothing.
  const lee = person(ctx, 'Lee', 'Chen', 'lee');
  const max = person(ctx, 'Max', 'Hill', 'max');
  await lee.okay('POST', 'coparent_invite', { email: max.email });
  await lee.okay('POST', 'delete_account');
  eq((await max.okay('GET', 'me')).user.coparent, null);
  await max.fails('POST', 'coparent_accept', {}, 'none', 404);
});
