// The test harness: a copy of the site built for one fixed day, served by PHP's own server on this machine, with
// stand-ins for the services the site talks to (the mail service, Google's sign-in check, the push services).
// Nothing here touches the live site. See tests/README.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The day the site is built for and the browser's clock is set to: a Monday in the school year the data describes.
// Move it (one place) when the data moves to a new school year, and keep it a Monday so "this week" is a school week.
export const TODAY = '2026-11-09';
export const NOW = new Date(TODAY + 'T15:00:00-05:00');   // 3pm Philadelphia time on that day

// ---------- the test registry ----------
const tests = [];
let currentFile = '';
export function setFile(f) { currentFile = f; }
export function test(name, fn, opts = {}) { tests.push({ name, fn, file: currentFile, ...opts }); }
export function allTests() { return tests; }

// ---------- tiny assertions ----------
export class Failure extends Error { constructor(msg) { super(msg); this.name = 'Failure'; } }
export const ok = (v, msg = 'expected a truthy value') => { if (!v) throw new Failure(msg); };
export const eq = (a, b, msg = '') => { if (a !== b) throw new Failure(`${msg ? msg + ': ' : ''}expected ${show(b)}, got ${show(a)}`); };
export const deepEq = (a, b, msg = '') => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Failure(`${msg ? msg + ': ' : ''}expected ${y}, got ${x}`); };
export const includes = (hay, needle, msg = '') => { if (!(typeof hay === 'string' ? hay.includes(needle) : Array.isArray(hay) && hay.includes(needle))) throw new Failure(`${msg ? msg + ': ' : ''}expected ${show(hay).slice(0, 300)} to include ${show(needle)}`); };
export const excludes = (hay, needle, msg = '') => { if (typeof hay === 'string' ? hay.includes(needle) : Array.isArray(hay) && hay.includes(needle)) throw new Failure(`${msg ? msg + ': ' : ''}expected ${show(hay).slice(0, 300)} not to include ${show(needle)}`); };
export const matches = (s, re, msg = '') => { if (!re.test(s)) throw new Failure(`${msg ? msg + ': ' : ''}expected ${show(s).slice(0, 300)} to match ${re}`); };
const show = v => typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v);

// ---------- a free port ----------
export const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

// ---------- the stand-in for the outside world ----------
// One small HTTP server plays every service the site posts to:
//   /postmark        what the site would email (Postmark's API shape); tests read it back from `mail.messages`
//   /tokeninfo       Google's check of a sign-in credential; a test registers a credential with `google.allow()`
//   /push/...        a browser's notification service; what the site posts lands in `push.posts`
//   /github/...      GitHub's API, for the edit queue (recorded only)
export async function startStandin() {
  const mail = { messages: [], clear() { this.messages.length = 0; },
    // The newest message to an address, waiting a little for it to arrive.
    async waitFor(to, re = null, ms = 4000) {
      const until = Date.now() + ms;
      for (;;) {
        const m = [...this.messages].reverse().find(x => x.To.toLowerCase() === to.toLowerCase() && (!re || re.test(x.Subject)));
        if (m) return m;
        if (Date.now() > until) throw new Failure(`no email to ${to}${re ? ' matching ' + re : ''} (${this.messages.length} sent in all)`);
        await sleep(50);
      }
    },
    to(addr) { return this.messages.filter(x => x.To.toLowerCase() === addr.toLowerCase()); },
  };
  const google = { tokens: new Map(), allow(credential, claims) { this.tokens.set(credential, claims); } };
  const push = { posts: [] };
  const github = { calls: [] };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const u = new URL(req.url, 'http://x');
      const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (u.pathname === '/postmark') {
        let m = null; try { m = JSON.parse(body); } catch (e) { /* not json */ }
        if (!m || !m.To) return json(422, { ErrorCode: 300, Message: 'bad' });
        if (/bounced@/.test(m.To)) return json(422, { ErrorCode: 406, Message: 'inactive recipient' });   // a stand-in for an address Postmark won't send to
        mail.messages.push({ ...m, at: Date.now(), token: req.headers['x-postmark-server-token'] || '' });
        return json(200, { ErrorCode: 0, Message: 'OK', To: m.To, MessageID: 'test-' + mail.messages.length });
      }
      if (u.pathname === '/tokeninfo') {
        const c = google.tokens.get(u.searchParams.get('id_token') || '');
        return c ? json(200, c) : json(400, { error: 'invalid_token' });
      }
      if (u.pathname.startsWith('/push')) { push.posts.push({ path: u.pathname, headers: req.headers, body: Buffer.from(body, 'binary'), at: Date.now() }); res.writeHead(201); return res.end(); }
      if (u.pathname.startsWith('/github')) { github.calls.push({ method: req.method, path: u.pathname, headers: req.headers, body }); return json(200, { ok: true }); }
      res.writeHead(404); res.end();
    });
  });
  const port = await freePort();
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { port, base: `http://127.0.0.1:${port}`, mail, google, push, github, stop: () => new Promise(r => server.close(r)) };
}

// ---------- the site: built for TODAY and served locally ----------
export async function startSite({ scratch, standin, log = () => {} } = {}) {
  const dir = scratch || fs.mkdtempSync(path.join(os.tmpdir(), 'pas-tests-'));
  const copy = path.join(dir, 'repo'), pub = path.join(dir, 'public'), dataDir = path.join(dir, 'phillyafterschool-data');
  fs.rmSync(copy, { recursive: true, force: true }); fs.rmSync(pub, { recursive: true, force: true }); fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(copy, { recursive: true });
  // A copy of what the build reads, so the repository's own dist/ is left alone.
  for (const f of ['build.mjs', 'site.config.json', 'data', 'src', 'email', 'scripts']) fs.cpSync(path.join(ROOT, f), path.join(copy, f), { recursive: true });
  // The edit page's sign-in, with a password made up for this run (the real one is only ever a hash in the config).
  const edit = { user: 'tester', password: 'pw-' + Math.random().toString(36).slice(2) + Date.now().toString(36) };
  const cfgFile = path.join(copy, 'site.config.json'), cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  if (cfg.editLogin) { cfg.editLogin = { user: edit.user, passwordHash: execFileSync('php', ['-r', 'echo password_hash($argv[1], PASSWORD_BCRYPT, array("cost" => 4));', '--', edit.password], { encoding: 'utf8' }).trim() }; fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2)); }
  log(`building for ${TODAY} …`);
  const out = execFileSync('node', ['build.mjs'], { cwd: copy, encoding: 'utf8', env: { ...process.env, PAS_TODAY: TODAY, PAS_NO_HISTORY: '1' }, maxBuffer: 64e6 });
  fs.renameSync(path.join(copy, 'dist'), pub);
  fs.mkdirSync(dataDir, { recursive: true });
  // A stand-in Postmark key (the shape is checked, the value never leaves this machine): with it, the site mails through the stand-in.
  fs.writeFileSync(path.join(dir, 'phillyafterschool-postmark.key'), '00000000-0000-4000-8000-000000000000\n');
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(https?_proxy|no_proxy|all_proxy)$/i.test(k)) delete env[k];   // the test server never needs the outside world
  Object.assign(env, { NO_PROXY: '*', PAS_TEST_POSTMARK: standin.base + '/postmark', PAS_TEST_TOKENINFO: standin.base + '/tokeninfo', PAS_TEST_PUSH: standin.base + '/push', PAS_TEST_GITHUB: standin.base + '/github' });
  const logFile = path.join(dir, 'php.log');
  const logFd = fs.openSync(logFile, 'a');
  const php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', pub], { cwd: dir, env, stdio: ['ignore', logFd, logFd] });
  const until = Date.now() + 15000;
  for (;;) {
    try { const r = await fetch(`${base}/groups/api.php?action=health`); if (r.ok) break; } catch (e) { /* not up yet */ }
    if (Date.now() > until) throw new Error('the PHP server did not start; see ' + logFile);
    await sleep(100);
  }
  log(`serving ${pub} at ${base}`);
  return {
    dir, copy, pub, dataDir, base, port, buildOutput: out, logFile, edit: cfg.editLogin ? edit : null,
    dbBytes() {   // everything SQLite has on disk for the accounts database, journal included
      const parts = [];
      for (const f of ['groups.sqlite', 'groups.sqlite-wal', 'groups.sqlite-journal']) { const p = path.join(dataDir, f); if (fs.existsSync(p)) parts.push(fs.readFileSync(p)); }
      return Buffer.concat(parts);
    },
    read(rel) { return fs.readFileSync(path.join(pub, rel), 'utf8'); },
    exists(rel) { return fs.existsSync(path.join(pub, rel)); },
    // An account with a session, made straight in the database: how most tests get a signed-in person without
    // spending one of the sign-in emails the server allows an address (the sign-in tests use the real flow).
    seed(email, first = '', last = '') {
      const out = execFileSync('php', [path.join(ROOT, 'tests/lib/db.php'), path.join(dataDir, 'groups.sqlite'), 'seed', email, first, last], { encoding: 'utf8' });
      return JSON.parse(out);
    },
    // One SELECT against the test database, as rows.
    sql(q) { return JSON.parse(execFileSync('php', [path.join(ROOT, 'tests/lib/db.php'), path.join(dataDir, 'groups.sqlite'), 'select', q], { encoding: 'utf8' })); },
    async stop() { php.kill('SIGTERM'); await new Promise(r => php.on('exit', r)); fs.closeSync(logFd); },
  };
}

// ---------- talking to the API the way the pages do ----------
export function client(site, standin) {
  const c = {
    cookie: '', email: '',
    headers(extra = {}) { return { 'X-PAS': '1', Origin: site.base, 'Content-Type': 'application/json', ...(c.cookie ? { Cookie: 'pas_s=' + c.cookie } : {}), ...extra }; },
    async raw(method, action, body, extra = {}) {
      const r = await fetch(`${site.base}/groups/api.php?action=${encodeURIComponent(action)}${extra.query ? '&' + extra.query : ''}`, {
        method, headers: c.headers(extra.headers || {}), body: method === 'POST' ? JSON.stringify(body || {}) : undefined, redirect: 'manual',
      });
      const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
      for (const s of sc) { const m = /^pas_s=([^;]*)/.exec(s); if (m) c.cookie = (m[1] === '' || m[1] === 'deleted') ? '' : m[1]; }
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch (e) { /* not json */ }
      return { status: r.status, body: json, text };
    },
    get: (action, query = '') => c.raw('GET', action, null, { query }),
    post: (action, body = {}) => c.raw('POST', action, body),
    // A call that must succeed: gives the body.
    async okay(method, action, body) {
      const r = method === 'GET' ? await c.get(action, body || '') : await c.post(action, body);
      if (!r.body || r.body.ok !== true) throw new Failure(`${method} ${action} failed (${r.status}): ${r.text.slice(0, 300)}`);
      return r.body;
    },
    // A call that must fail with a given error code (and status).
    async fails(method, action, body, error, status = null) {
      const r = method === 'GET' ? await c.get(action, body || '') : await c.post(action, body);
      if (!r.body || r.body.ok !== false) throw new Failure(`${method} ${action} should have failed with "${error}" but gave ${r.status}: ${r.text.slice(0, 300)}`);
      if (r.body.error !== error) throw new Failure(`${method} ${action} failed with "${r.body.error}" (${r.body.message}), expected "${error}"`);
      if (status !== null && r.status !== status) throw new Failure(`${method} ${action}: expected status ${status}, got ${r.status}`);
      return r.body;
    },
    // Sign in the way a person does: ask for the email, read the code out of it, type it in.
    async signIn(email, next = 'account') {
      const start = await c.okay('POST', 'login_start', { email, next });
      const m = await standin.mail.waitFor(email, /sign-in/i);
      const code = codeIn(m);
      const fin = await c.okay('POST', 'login_finish', { req: start.req, code });
      if (!c.cookie) throw new Failure('sign-in gave no session cookie');
      c.email = email;
      return fin;
    },
    // A signed-in account made in the database (no email spent). With a first and last name it is "ready" to share.
    as(email, first = '', last = '') { const s = site.seed(email, first, last); c.cookie = s.sid; c.email = email; c.id = s.id; return c; },
  };
  return c;
}
// A named, signed-in account for a test to use: `const pat = person(ctx, 'Pat', 'Lee')`.
export const person = (ctx, first = 'Pat', last = 'Lee', tag = 'p') => ctx.api().as(someone(tag), first, last);
export const codeIn = m => { const x = /(\d{3}) (\d{3})/.exec(m.TextBody || ''); if (!x) throw new Failure('no code in the email: ' + (m.TextBody || '').slice(0, 200)); return x[1] + x[2]; };
export const linkIn = m => { const x = /#t=([A-Za-z0-9_-]+)/.exec(m.TextBody || ''); if (!x) throw new Failure('no sign-in link in the email'); return x[1]; };

export const sleep = ms => new Promise(r => setTimeout(r, ms));
// A fresh address for a test, so tests never share accounts.
let n = 0;
export const someone = (tag = 'p') => `${tag}${Date.now().toString(36)}${(n++).toString(36)}@example.test`;
