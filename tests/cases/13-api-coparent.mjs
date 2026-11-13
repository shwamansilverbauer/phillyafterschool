// Co-parents: two accounts, one set of plans. The invitation, whose plans the invitee keeps on accepting, what comes
// across, both reading and changing everything, ending it, and what deleting an account does to the other.
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

test('accepting with the inviter’s plans: one household on Pat’s calendar, children merged, Dana’s own plans set aside and back when it ends', async (ctx) => {
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
  // The invitation counts both sides, so the page can ask whose plans to keep.
  const inv = (await dana.okay('GET', 'me')).user.coparent;
  eq(inv.mine.weeks, 1); eq(inv.mine.kids, 2); eq(inv.mine.summer, true); eq(inv.mine.daysoff, true);
  eq(inv.theirs.weeks, 1); eq(inv.theirs.kids, 2); eq(inv.theirs.summer, true); eq(inv.theirs.daysoff, false);
  // Only the invited address can accept.
  await person(ctx, 'Sly', 'Fox', 'str').fails('POST', 'coparent_accept', { keep: 'theirs' }, 'none', 404);
  const acc = await dana.okay('POST', 'coparent_accept', { keep: 'theirs' });
  eq(acc.kept, 'theirs'); eq(acc.coparent.role, 'partner'); eq(acc.coparent.with.name, 'Pat Lee');
  const own = (await pat.okay('GET', 'me')).user.coparent;
  eq(own.role, 'owner'); eq(own.with.name, 'Dana Reyes'); eq(own.with.email, dana.email);
  // Both see Pat's calendar: Pat's week only, the children put together, Pat's summer, and Dana's days off (Pat had none).
  const pp = await pat.okay('GET', 'profile'), dp = await dana.okay('GET', 'profile');
  deepEq(pp.weeks.map(w => w.id), [pw.id], 'Pat’s week, not Dana’s');
  deepEq(dp.weeks.map(w => w.id), [pw.id]);
  deepEq(pp.kids.map(k => k.n), ['Sam', 'Rae', 'Zoe'], 'children merged, the duplicate first name once');
  deepEq(dp.kids, pp.kids);
  eq(pp.summer.kids[0].name, 'Sam', 'the inviter’s summer stays'); eq(dp.summer.kids[0].name, 'Sam');
  eq(pp.daysoff.kids[0].name, 'Zoe', 'Dana’s days-off plan was copied over, since Pat had none'); eq(dp.daysoff.kids[0].d[day], program.id);
  eq((await pat.okay('GET', 'me')).user.weeks, 1); eq((await dana.okay('GET', 'me')).user.weeks, 1, '"me" counts the household’s weeks for both');
  // Either can change anything: Dana edits Pat's week, adds one and changes the children; Pat deletes the one Dana added.
  await dana.okay('POST', 'week_save', { week: { id: pw.id, name: 'Sammy', now: { ...empty(), fri: [entry] }, next: empty() } });
  eq((await pat.okay('GET', 'profile')).weeks.find(w => w.id === pw.id).name, 'Sammy');
  const nw = (await dana.okay('POST', 'week_save', { week: { name: 'Zoe', now: empty(), next: empty() } })).week;
  ok((await pat.okay('GET', 'profile')).weeks.some(w => w.id === nw.id), 'a week Dana adds lands on the shared calendar');
  await dana.fails('POST', 'week_save', { week: { id: dw.id, name: 'Nope', now: empty(), next: empty() } }, 'gone', 404);
  await dana.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '3' }] });
  deepEq((await pat.okay('GET', 'profile')).kids.map(k => k.n), ['Sam']);
  await pat.okay('POST', 'week_delete', { week: nw.id });
  eq((await dana.okay('GET', 'profile')).weeks.length, 1);
  await dana.okay('POST', 'summer_delete');
  eq((await pat.okay('GET', 'profile')).summer, null);
  // Grades and ages filters stay each account's own.
  deepEq((await dana.okay('GET', 'me')).user.grades, ['1', '3'], 'Dana’s own filter: her old grade plus the one she just saved');
  deepEq((await pat.okay('GET', 'me')).user.grades, ['K', '2'], 'Pat’s filter untouched by Dana’s save');
  // Neither can start another while linked.
  await pat.fails('POST', 'coparent_invite', { email: 'x@example.test' }, 'one');
  await dana.fails('POST', 'coparent_invite', { email: 'x@example.test' }, 'linked');
  // Ending it, from Dana's side: the shared plans stay with Pat, and Dana's own come back as she left them.
  const end = await dana.okay('POST', 'coparent_end');
  eq(end.coparent, null);
  eq((await pat.okay('GET', 'me')).user.coparent, null);
  deepEq((await pat.okay('GET', 'profile')).weeks.map(w => w.name), ['Sammy'], 'Pat keeps the household’s week');
  const back = await dana.okay('GET', 'profile');
  deepEq(back.weeks.map(w => [w.id, w.name]), [[dw.id, 'Rae']], 'Dana’s own week, untouched');
  deepEq(back.kids.map(k => k.n), ['rae', 'Zoe'], 'and her own children’s list');
  eq(back.summer.kids[0].name, 'Zoe', 'and her own summer');
  await dana.fails('POST', 'coparent_end', {}, 'none', 404);
});

test('accepting with your own plans: the invitee’s calendar becomes the household’s, and the inviter’s comes back when it ends', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee');
  const dana = person(ctx, 'Dana', 'Reyes', 'dana');
  const { entry } = pickupPair();
  const pw = (await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: { ...empty(), mon: [entry] }, next: empty() } })).week;
  await pat.okay('POST', 'kids_save', { kids: [{ n: 'Sam', g: '2' }] });
  const dw = (await dana.okay('POST', 'week_save', { week: { name: 'Rae', now: { ...empty(), tue: [entry] }, next: empty() } })).week;
  await dana.okay('POST', 'kids_save', { kids: [{ n: 'Rae', g: 'K' }] });
  await pat.okay('POST', 'coparent_invite', { email: dana.email });
  const acc = await dana.okay('POST', 'coparent_accept', { keep: 'mine' });
  eq(acc.kept, 'mine'); eq(acc.coparent.role, 'owner', 'Dana now holds the household'); eq(acc.coparent.with.name, 'Pat Lee');
  const pc = (await pat.okay('GET', 'me')).user.coparent;
  eq(pc.role, 'partner'); eq(pc.with.name, 'Dana Reyes');
  const pp = await pat.okay('GET', 'profile'), dp = await dana.okay('GET', 'profile');
  deepEq(pp.weeks.map(w => w.id), [dw.id], 'Pat sees Dana’s week, not his own');
  deepEq(dp.weeks.map(w => w.id), [dw.id]);
  deepEq(pp.kids.map(k => k.n), ['Rae', 'Sam'], 'Pat’s children added to Dana’s list');
  // Pat can change the household's week; his own is out of reach while linked.
  await pat.okay('POST', 'week_save', { week: { id: dw.id, name: 'Rae B', now: empty(), next: empty() } });
  eq((await dana.okay('GET', 'profile')).weeks[0].name, 'Rae B');
  await pat.fails('POST', 'week_save', { week: { id: pw.id, name: 'Nope', now: empty(), next: empty() } }, 'gone', 404);
  // Pat's old invitation is gone, so neither can start another; then Pat ends it and has his week back.
  await pat.fails('POST', 'coparent_invite', { email: 'x@example.test' }, 'linked');
  await dana.fails('POST', 'coparent_invite', { email: 'x@example.test' }, 'one');
  await pat.okay('POST', 'coparent_end');
  eq((await dana.okay('GET', 'me')).user.coparent, null);
  deepEq((await pat.okay('GET', 'profile')).weeks.map(w => [w.id, w.name]), [[pw.id, 'Sam']], 'Pat’s own week is back');
  deepEq((await pat.okay('GET', 'profile')).kids.map(k => k.n), ['Sam']);
  deepEq((await dana.okay('GET', 'profile')).weeks.map(w => w.name), ['Rae B'], 'Dana keeps the household’s week');
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
