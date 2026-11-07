// The people who run a listing: claiming it with a work email, a parent's question passed along, a proposed change.
// Uses the hidden test listings, so no real program is touched.
import { test, ok, eq, deepEq, includes, excludes, person } from '../lib/harness.mjs';
import { programs } from '../lib/data.mjs';

const PREMIUM = 'p:test-listing-premium';   // claimDomain phillyafterschool.org, premium without a payment (data/test-listings.json)

test('claiming a listing: a named account whose email is at the listing’s own domain, and nobody else', async (ctx) => {
  const t = Date.now().toString(36);
  const manager = ctx.api().as(`mgr${t}@phillyafterschool.org`, 'Pat', 'Lee');
  await ctx.api().as(`nn4${t}@phillyafterschool.org`).fails('POST', 'claim_add', { listing: PREMIUM }, 'name');
  await person(ctx, 'Sly', 'Fox', 'str').fails('POST', 'claim_add', { listing: PREMIUM }, 'domain');
  await manager.fails('POST', 'claim_add', { listing: 'p:no-such-listing' }, 'listing', 404);
  const r = await manager.okay('POST', 'claim_add', { listing: PREMIUM });
  eq(r.status, 'ok', 'the domains match, so the claim stands at once');
  eq(r.claims.length, 1); eq(r.claims[0].listing, PREMIUM); eq(r.claims[0].status, 'ok');
  // The owner is told (a first claim rides along with the new-account note), by the manager's name and address.
  const told = await ctx.mail.waitFor('contact@phillyafterschool.org', /Signup: Pat Lee/);
  includes(told.TextBody, manager.email); includes(told.TextBody, 'Listing:'); includes(told.TextBody, 'the claim stands without you');
  // Asking again changes nothing; the public list of claimed listings shows it; "me" counts it.
  eq((await manager.okay('POST', 'claim_add', { listing: PREMIUM })).claims.length, 1);
  includes((await ctx.api().okay('GET', 'claimed')).claimed, PREMIUM);
  const me = (await manager.okay('GET', 'me')).user;
  eq(me.claims, 1); ok(me.role, 'a role for the menu');
  eq((await manager.okay('GET', 'claims')).claims.length, 1);
  // A real program's domain: an address at a provider's domain can claim that provider's listing.
  const p = programs().find(x => /^https:\/\/(www\.)?[a-z0-9-]+\.(org|com)\/?$/.test(x.website || ''));
  ok(p, 'a program with a plain .org or .com website');
  const dom = p.website.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
  const theirs = ctx.api().as(`hello${t}@${dom}`, 'Dana', 'Reyes');
  const r2 = await theirs.okay('POST', 'claim_add', { listing: 'p:' + p.id });
  ok(r2.status === 'ok' || r2.status === 'pending', 'stands or waits, depending on how shared the domain is');
  await theirs.fails('POST', 'claim_add', { listing: PREMIUM }, 'domain', 403);
  // Dropping a claim.
  const d = await manager.okay('POST', 'claim_drop', { listing: PREMIUM });
  deepEq(d.claims, []);
  excludes((await ctx.api().okay('GET', 'claimed')).claimed, PREMIUM);
});

test('a parent’s question goes to the people who hold the listing, with no copy kept and no sign-in needed', async (ctx) => {
  const t = Date.now().toString(36);
  excludes((await ctx.api().okay('GET', 'claimed')).claimed, PREMIUM, 'the test listing starts unclaimed');
  const manager = ctx.api().as(`mgr${t}@phillyafterschool.org`, 'Pat', 'Lee');
  await manager.okay('POST', 'claim_add', { listing: PREMIUM });
  const parent = ctx.api();   // signed out
  await parent.fails('POST', 'ask', { listing: PREMIUM, name: 'Dana', email: 'dana@example.test', text: 'Short' }, 'text');
  await parent.fails('POST', 'ask', { listing: PREMIUM, name: '', email: 'dana@example.test', text: 'Is there space on Tuesdays for a second grader?' }, 'name');
  await parent.fails('POST', 'ask', { listing: PREMIUM, name: 'Dana', email: 'nope', text: 'Is there space on Tuesdays for a second grader?' }, 'email');
  // The hidden box a script would fill: swallowed quietly.
  eq((await parent.okay('POST', 'ask', { listing: PREMIUM, name: 'Bot', email: 'bot@example.test', text: 'Buy things from my website please', company: 'x' })).ok, true);
  eq(ctx.mail.to(manager.email).length, 0, 'the bot’s message went nowhere');
  const r = await parent.okay('POST', 'ask', { listing: PREMIUM, name: 'Dana', email: 'dana@example.test', text: 'Is there space on Tuesdays for a second grader?' });
  ok(r.ok);
  const m = await ctx.mail.waitFor(manager.email, /question/i);
  includes(m.TextBody, 'Dana asked'); includes(m.TextBody, 'Is there space on Tuesdays'); eq(m.ReplyTo, 'dana@example.test', 'replying answers the parent');
  includes(m.TextBody, 'did not keep a copy');
  // Not a premium listing, or one nobody holds: no questions.
  await parent.fails('POST', 'ask', { listing: 'p:test-listing-free', name: 'Dana', email: 'dana@example.test', text: 'Is there space on Tuesdays for a second grader?' }, 'off', 403);
  await manager.okay('POST', 'claim_drop', { listing: PREMIUM });
  await parent.fails('POST', 'ask', { listing: PREMIUM, name: 'Dana', email: 'dana2@example.test', text: 'Is there space on Tuesdays for a second grader?' }, 'off', 403);
});

test('a proposed change from a listing’s manager reaches the owner; the manager’s own emails can be switched off', async (ctx) => {
  const t = Date.now().toString(36);
  const manager = ctx.api().as(`mgr${t}@phillyafterschool.org`, 'Pat', 'Lee');
  await manager.fails('POST', 'edit_add', { listing: PREMIUM, body: 'Our hours changed to 3 to 6.' }, 'claim', 403);
  await manager.okay('POST', 'claim_add', { listing: PREMIUM });
  await manager.fails('POST', 'edit_add', { listing: PREMIUM, body: 'Short' }, 'body');
  await manager.fails('POST', 'edit_add', { listing: PREMIUM, body: 'Our hours changed to 3 to 6 this year.', link: 'ftp://x' }, 'link');
  const r = await manager.okay('POST', 'edit_add', { listing: PREMIUM, body: 'Our hours changed to 3 to 6 this year.', link: 'https://phillyafterschool.org/' });
  ok(r.claims.length === 1);
  const m = await ctx.mail.waitFor('contact@phillyafterschool.org', /Proposed change/);
  includes(m.TextBody, 'Our hours changed to 3 to 6'); includes(m.TextBody, 'Pat Lee');
  const edits = ctx.site.sql(`SELECT listing, body, link FROM edits`);
  ok(edits.some(e => e.listing === PREMIUM && e.body.startsWith('Our hours')), 'kept for the weekly queue');
  // The monthly numbers and such can be turned off and on from the account.
  eq((await manager.okay('POST', 'mgr_mail', { on: false })).mail, false);
  eq(ctx.site.sql(`SELECT mgr_mail FROM users WHERE id = ${manager.id}`)[0].mgr_mail, 0);
  eq((await manager.okay('POST', 'mgr_mail', { on: true })).mail, true);
  eq((await manager.okay('GET', 'claims')).mail, true);
});
