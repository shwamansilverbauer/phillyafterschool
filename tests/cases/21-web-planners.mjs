// The three planners in a browser, signed in: a plan with a first name and a pick keeps itself in the profile,
// and comes back on another device.
import { test, ok, eq, includes, someone, sleep, Failure } from '../lib/harness.mjs';
import { pickupPair } from '../lib/data.mjs';

const flat = s => s.replace(/\s+/g, ' ').trim();
// Wait for the profile to hold what the page should have saved.
async function until(api, pick, what, ms = 8000) {
  const end = Date.now() + ms; let last = null;
  while (Date.now() < end) { last = await api.okay('GET', 'profile'); const v = pick(last); if (v) return v; await sleep(250); }
  throw new Failure(`${what} never reached the profile: ${JSON.stringify(last).slice(0, 400)}`);
}

test('Build your week: a first name and a program on a day keep the week in the profile, and it comes back elsewhere', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('board'), 'Pat', 'Lee');
  const { program, school } = pickupPair();
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/board/');
  await page.waitForSelector('#board-name');
  // Someone new starts on the upcoming week; this test plans the current one.
  includes(flat(await page.locator('#board-title').innerText()).toLowerCase(), 'upcoming week');
  await page.locator('#board-tabs [data-board="now"]').click();
  includes(flat(await page.locator('#board-title').innerText()).toLowerCase(), 'current week');
  await page.fill('#board-name', 'Sam');
  await page.dispatchEvent('#board-name', 'change');
  await page.fill('#add-search', program.name.slice(0, 12));
  await page.waitForSelector('#add-list li[role="option"] button');
  await page.locator('#add-list li[role="option"] button').first().click();
  await page.waitForSelector('#add-panel:not([hidden])');
  const which = page.locator(`#add-panel [data-school="${school}"]`);
  if (await which.count()) await which.click();
  await page.locator('#add-panel [data-day="mon"]').click();
  await page.locator('#add-panel [data-add-done]').click();
  const week = await until(pat, p => p.weeks.find(w => w.name === 'Sam' && (w.now.mon || []).some(e => e.startsWith(program.id + '.'))), 'Sam’s Monday');
  eq(week.now.mon.length, 1);
  includes(flat(await page.locator('#week').innerText()), program.name, 'the grid shows the program');
  // Another device: the week comes down from the profile.
  const t2 = await b.context(ctx.site, { sid: pat.cookie });
  const p2 = await t2.open('/board/');
  await p2.waitForSelector('#week');
  await p2.waitForFunction(() => (document.querySelector('#board-name') || {}).value === 'Sam', null, { timeout: 8000 });
  await p2.locator('#board-tabs [data-board="now"]').click();   // a new device opens on the upcoming week
  await p2.waitForFunction(name => (document.querySelector('#week') || {}).innerText.includes(name), program.name, { timeout: 8000 });
  eq(t.errors.length + t2.errors.length, 0, t.errors.concat(t2.errors).join(' | '));
  await t.close(); await t2.close();
});

test('Plan summer: a camp picked for a week is kept in the profile for that child', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('summer'), 'Pat', 'Lee');
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/summer-schedule/');
  await page.waitForSelector('#sum-name');
  await page.fill('#sum-name', 'Rae');
  await page.dispatchEvent('#sum-name', 'change');
  await page.locator('#sum-weeks .sum-add').first().click();
  await page.waitForSelector('#sum-weeks .sum-choose');
  const listed = page.locator('#sum-weeks .sum-choose .sum-opts:not(.own-opts) .sum-opt').first();
  if (!(await listed.count())) throw new Failure('no listed camp to pick for the first week');
  const campName = flat(await listed.innerText());
  await listed.click();
  const summer = await until(pat, p => p.summer && p.summer.kids.find(k => k.name === 'Rae' && Object.values(k.w).some(v => v.length)), 'Rae’s summer');
  const picks = Object.values(summer.w).flat();
  eq(picks.length, 1, 'one camp picked');
  ok(!['home', 'away', 'other'].includes(picks[0]), 'a listed camp: ' + picks[0]);
  includes(flat(await page.locator('#sum-weeks').innerText()), campName.split(' ')[0], 'the week shows the camp');
  // A week at home is kept as "home", with nothing written in leaving the device.
  await page.locator('#sum-weeks .sum-add').nth(1).click();
  await page.waitForSelector('#sum-weeks .sum-choose');
  await page.locator('#sum-weeks .sum-choose .own-opts .sum-opt', { hasText: /home/i }).first().click();
  await until(pat, p => p.summer && p.summer.kids[0] && Object.values(p.summer.kids[0].w).flat().includes('home'), 'the week at home');
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});

test('Plan the days off: a program picked for a closed day is kept in the profile, and "signed up" is a tick', async (ctx) => {
  const b = await ctx.browser();
  const pat = ctx.api().as(someone('off'), 'Pat', 'Lee');
  const t = await b.context(ctx.site, { sid: pat.cookie });
  const page = await t.open('/days-off/');
  await page.waitForSelector('#off-name');
  await page.fill('#off-name', 'Zoe');
  await page.dispatchEvent('#off-name', 'change');
  await page.locator('#off-days .sum-add').first().click();
  await page.waitForSelector('#off-days .sum-choose');
  const listed = page.locator('#off-days .sum-choose .sum-opts:not(.own-opts) .sum-opt').first();
  let picked = '';
  if (await listed.count()) { picked = flat(await listed.innerText()); await listed.click(); }
  else { await page.locator('#off-days .sum-choose .own-opts .sum-opt', { hasText: /home/i }).first().click(); picked = 'home'; }
  const plan = await until(pat, p => p.daysoff && p.daysoff.kids.find(k => k.name === 'Zoe' && Object.keys(k.d).length), 'Zoe’s day off');
  const [day, what] = Object.entries(plan.d)[0];
  ok(/^\d{4}-\d{2}-\d{2}$/.test(day), 'a date');
  if (picked === 'home') eq(what, 'home'); else ok(what !== 'home', 'a program: ' + what);
  eq(t.errors.length, 0, t.errors.join(' | '));
  await t.close();
});
