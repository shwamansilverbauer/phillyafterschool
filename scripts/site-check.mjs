#!/usr/bin/env node
// Is the live site up, and are its moving parts still moving? Run every hour by .github/workflows/monitor.yml,
// which opens an issue (and so emails the owner) when a check fails and closes it when everything passes again.
//
//   node scripts/site-check.mjs                         check the live site
//   node scripts/site-check.mjs --site http://localhost:8791 --local    check a copy on this machine (skips the
//                                                       checks that only make sense for the real one)
//   node scripts/site-check.mjs --report report.md      also write the findings to a file
//   node scripts/site-check.mjs --quick                 ask each address once instead of three times
//
// It only reads: pages, the sitemap, two small data files, the accounts service's "health" answer and the public
// record of this repository's scheduled jobs. It never signs in, never sends a form and never prints an address.
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = name => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : null; };
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE = (value('--site') || cfg.siteUrl).replace(/\/$/, '');
const LOCAL = args.includes('--local');
const REPO = process.env.GITHUB_REPOSITORY || 'shwamansilverbauer/phillyafterschool';
const TOKEN = process.env.GITHUB_TOKEN || '';
const STALE_DAYS = 2;        // the site is rebuilt every night; older than this and the rebuild has stopped
const BACKUP_DAYS = 2;       // the accounts database is copied every day
const JOB_HOURS = 36;        // each daily job should have finished a run inside this
const CERT_DAYS = 10;        // warn this long before the padlock certificate runs out

const sleep = ms => new Promise(done => setTimeout(done, ms));
const daysSince = iso => Math.floor((Date.now() - Date.parse(iso + 'T00:00:00Z')) / 864e5);
async function get(url, { tries = args.includes('--quick') ? 1 : 3, headers = {} } = {}) {
  let last = null;
  for (let n = 1; n <= tries; n++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'phillyafterschool-site-check', ...headers }, redirect: 'manual', signal: AbortSignal.timeout(20000) });
      const text = await r.text();
      if (r.status < 500) return { status: r.status, text };
      last = `answered ${r.status}`;
    } catch (e) { last = e.name === 'TimeoutError' ? 'took more than 20 seconds' : 'did not answer'; }
    if (n < tries) await sleep(15000);   // a blip is not an outage: ask again before calling it
  }
  return { status: 0, text: '', why: last };
}

const results = [];
const pass = (name, detail = '') => results.push({ ok: true, name, detail });
const fail = (name, detail, fix = '') => results.push({ ok: false, name, detail, fix });

// ----- the pages -----
async function pages() {
  const fixed = ['', 'schools/', 'programs/', 'days-off/', 'summer-camps/', 'summer-schedule/', 'weekends/', 'alerts/', 'account/', 'calendar/'];
  const map = await get(`${SITE}/sitemap.xml`);
  const locs = [...map.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(cfg.siteUrl, SITE));
  if (map.status !== 200 || locs.length < 100) fail('Sitemap', map.status !== 200 ? `sitemap.xml ${map.why || 'answered ' + map.status}` : `sitemap.xml lists only ${locs.length} pages`, 'Run the "Build and publish" job again from the Actions tab.');
  else pass('Sitemap', `${locs.length} pages listed`);
  const step = Math.max(1, Math.floor(locs.length / 10));
  const sample = locs.filter((_, i) => i % step === Math.floor(step / 2)).slice(0, 10);   // a spread: schools, programs, camps
  const urls = [...new Set([...fixed.map(p => `${SITE}/${p}`), ...sample])];
  const bad = [];
  for (const url of urls) {
    const r = await get(url);
    if (r.status !== 200) bad.push(`${url.replace(SITE, '') || '/'} ${r.why || 'answered ' + r.status}`);
    else if (!r.text.includes('</html>') || !r.text.includes(cfg.siteName)) bad.push(`${url.replace(SITE, '') || '/'} came back incomplete`);
  }
  if (bad.length) fail('Pages', bad.join('; '), 'If every page is failing, the web host is down: check Hostinger. If a few are, run "Build and publish" again.');
  else pass('Pages', `${urls.length} pages opened`);
}

// ----- was it rebuilt last night? -----
async function fresh() {
  const r = await get(`${SITE}/data/alerts.json`);
  let made = '';
  try { made = JSON.parse(r.text).generated || ''; } catch { /* handled below */ }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(made)) return fail('Nightly rebuild', `data/alerts.json ${r.why || (r.status === 200 ? 'could not be read' : 'answered ' + r.status)}`, 'Run "Build and publish" from the Actions tab.');
  const age = daysSince(made);
  if (age > STALE_DAYS) fail('Nightly rebuild', `the site was last built ${age} days ago (${made})`, 'Passed days off and old dates are still showing. Run "Build and publish" from the Actions tab; if it fails, read its log.');
  else pass('Nightly rebuild', `last built ${made}`);
}

// ----- accounts: the database answers, and it was copied -----
async function accounts() {
  if (!cfg.groups) return;
  const r = await get(`${SITE}/groups/api.php?action=health`);
  let h = null;
  try { h = JSON.parse(r.text); } catch { /* handled below */ }
  if (!h || h.ok !== true) return fail('Accounts', `the accounts service ${r.why || 'answered ' + r.status}${h && h.message ? ': ' + h.message : ''}`, 'Signing in, share groups, claims and saved summers are not working. Check the site’s files and PHP in Hostinger.');
  pass('Accounts', 'the database answers and can be written to');
  if (h.backupAgeDays < 0 || h.backupAgeDays > BACKUP_DAYS) fail('Database copies', h.backup ? `the newest copy is from ${h.backup}` : 'no copy has been made', 'The daily copy in phillyafterschool-data/backups has stopped. Check that folder can be written to and the disk is not full.');
  else pass('Database copies', `newest ${h.backup}, ${h.backupsKept} kept`);
}

// ----- the forms answer (nothing is sent) -----
async function forms() {
  const bad = [];
  for (const p of ['suggest/send.php', 'contact/send.php', 'review/send.php']) {
    const r = await get(`${SITE}/${p}`);
    if (r.status === 0 || r.status === 404 || r.status >= 500) bad.push(`${p} ${r.why || 'answered ' + r.status}`);
  }
  if (bad.length) fail('Forms', bad.join('; '), 'The suggestion, contact or review form is not answering. Run "Build and publish" again, then check PHP in Hostinger.');
  else pass('Forms', 'suggestion, contact and review forms answer');
}

// ----- the padlock certificate -----
function certificate() {
  if (LOCAL || !SITE.startsWith('https://')) return Promise.resolve();
  const host = new URL(SITE).host;
  return new Promise(done => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 15000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      const left = Math.floor((Date.parse(cert.valid_to) - Date.now()) / 864e5);
      if (!Number.isFinite(left)) pass('Certificate', 'could not be read this time');
      else if (left < CERT_DAYS) fail('Certificate', `the https certificate runs out in ${left} day${left === 1 ? '' : 's'}`, 'Hostinger renews it by itself. If it has not, open SSL in Hostinger and reinstall it.');
      else pass('Certificate', `good for ${left} more days`);
      done();
    });
    socket.on('error', () => { pass('Certificate', 'could not be read this time'); done(); });
    socket.on('timeout', () => { socket.destroy(); pass('Certificate', 'could not be read this time'); done(); });
  });
}

// ----- the scheduled jobs: the build that publishes the site, and the one that sends the date emails -----
async function jobs() {
  if (LOCAL) return;
  const what = { 'publish.yml': ['Build and publish', 'The site is not being rebuilt or published.'], 'alerts.yml': ['Send date emails', 'Date emails are not going out.'] };
  for (const [file, [label, meaning]] of Object.entries(what)) {
    const r = await get(`https://api.github.com/repos/${REPO}/actions/workflows/${file}/runs?per_page=1&status=completed`, { headers: { accept: 'application/vnd.github+json', ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) } });
    let run = null;
    try { run = JSON.parse(r.text).workflow_runs[0]; } catch { /* handled below */ }
    if (!run) { pass(label, 'its record could not be read this time'); continue; }   // GitHub's own hiccup is not the site's
    const hours = Math.floor((Date.now() - Date.parse(run.updated_at)) / 36e5);
    if (run.conclusion !== 'success') fail(label, `its last run ${run.conclusion === 'failure' ? 'failed' : 'ended as "' + run.conclusion + '"'}`, `${meaning} Read the log: ${run.html_url}`);
    else if (hours > JOB_HOURS) fail(label, `it has not run for ${hours} hours`, `${meaning} GitHub pauses scheduled jobs in a repository with no changes for 60 days: open the Actions tab and turn the job back on.`);
    else pass(label, `last ran ${hours} hour${hours === 1 ? '' : 's'} ago`);
  }
}

await pages();
await fresh();
await accounts();
await forms();
await certificate();
await jobs();

const failed = results.filter(r => !r.ok);
const when = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
const report = [
  failed.length ? `**${failed.length} thing${failed.length === 1 ? ' needs' : 's need'} a look** on ${SITE.replace(/^https?:\/\//, '')}, checked ${when} Philadelphia time.` : `Everything passed on ${SITE.replace(/^https?:\/\//, '')}, checked ${when} Philadelphia time.`,
  '',
  ...failed.flatMap(r => [`### ${r.name}`, `${r.detail}.`, r.fix ? `What to do: ${r.fix}` : '', '']),
  failed.length && results.some(r => r.ok) ? '### Working' : '',
  ...results.filter(r => r.ok).map(r => `- ${r.name}: ${r.detail}`),
  '',
  failed.length ? 'This issue is updated every hour while something is failing, and closes by itself when every check passes.' : '',
].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n');
console.log(report);
if (value('--report')) fs.writeFileSync(value('--report'), report + '\n');
process.exit(failed.length ? 1 : 0);
