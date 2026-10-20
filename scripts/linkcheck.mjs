// Dead-link sweep over every outside address in the data files: the status code and the final address of each,
// nothing else kept. For the weekly run, and for anyone who wants to know which provider pages have moved.
//
//   node scripts/linkcheck.mjs [out.json]      the sweep
//   node scripts/linkcheck.mjs --list           only lists the addresses it would check, and where each is used
//
// Honors robots.txt: a path that robots.txt closes to *, ClaudeBot, Claude-Web, anthropic-ai or GPTBot is not
// requested and is reported as "not checked". The site's own addresses are left out. Six requests at a time, with a
// 25-second limit each, so the whole sweep takes a few minutes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIST = process.argv.includes('--list');
const OUT = process.argv.find(a => a.endsWith('.json')) || path.join(ROOT, 'linkcheck.json');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const own = new URL(cfg.siteUrl).hostname.replace(/^www\./, '');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 PhillyAfterSchoolLinkCheck/1.0';
const AGENTS = ['*', 'claudebot', 'claude-web', 'anthropic-ai', 'gptbot'];

// ----- every address in the data, with where it lives -----
const where = new Map();   // url -> [labels]
function walk(v, label) {
  if (typeof v === 'string') {
    if (!/^https?:\/\/\S+$/i.test(v)) return;
    let u; try { u = new URL(v); } catch { return; }
    if (u.hostname.replace(/^www\./, '') === own) return;
    const key = v.trim();
    if (!where.has(key)) where.set(key, []);
    if (!where.get(key).includes(label)) where.get(key).push(label);
  } else if (Array.isArray(v)) v.forEach(x => walk(x, label));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, label + '.' + k);
}
const data = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const list = d => Array.isArray(d) ? d : Array.isArray(d.programs) ? d.programs : Array.isArray(d.schools) ? d.schools : Array.isArray(d.camps) ? d.camps : [];
for (const p of list(data('programs.json'))) walk(p, 'program ' + p.id);
const camps = data('camps.json');
for (const c of camps.camps || []) walk(c, 'camp ' + c.id);
for (const c of camps.todo || []) walk(c, 'camp to read ' + (c.id || c.name || ''));
for (const s of list(data('schools.json'))) walk(s, 'school ' + s.id);
walk(data('days-off.json'), 'days-off');
const links = [...where.entries()].map(([u, w]) => ({ u, w }));
if (LIST) { for (const l of links) console.log(l.u, '|', l.w.join(', ')); console.log(links.length + ' addresses'); process.exit(0); }

// ----- robots.txt, once per site -----
const robotsCache = new Map();
async function robots(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const rules = [];
  try {
    const r = await fetch(origin + '/robots.txt', { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (r.ok && /text/.test(r.headers.get('content-type') || 'text')) {
      const text = await r.text();
      let agents = [], groupOpen = false;
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
        const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line); if (!m) continue;
        const k = m[1].toLowerCase(), v = m[2].trim();
        if (k === 'user-agent') { if (!groupOpen) agents = []; agents.push(v.toLowerCase()); groupOpen = true; continue; }
        groupOpen = false;
        if (k === 'disallow' || k === 'allow') rules.push({ agents, allow: k === 'allow', path: v });
      }
    }
  } catch { /* no robots.txt reachable: treat as open */ }
  robotsCache.set(origin, rules);
  return rules;
}
function disallowed(rules, p) {
  let best = null;   // the most specific rule for any agent group that covers us
  for (const r of rules) {
    if (!r.agents.some(a => AGENTS.includes(a)) || !r.path) continue;
    const pat = '^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    if (new RegExp(pat).test(p) && (!best || r.path.length > best.path.length)) best = r;
  }
  return best ? !best.allow : false;
}

async function check(u) {
  const url = new URL(u);
  const rules = await robots(url.origin);
  if (disallowed(rules, url.pathname + url.search)) return { u, status: 'not checked', note: 'robots.txt asks automated readers to stay out' };
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const final = r.url && r.url !== u ? r.url : '';
    return { u, status: r.status, final };
  } catch (e) {
    return { u, status: 'error', note: String((e.cause && e.cause.code) || e.name || e.message).slice(0, 80) };
  }
}

const out = [];
let i = 0;
async function worker() { while (i < links.length) { const l = links[i++]; const r = await check(l.u); r.w = l.w; out.push(r); } }
await Promise.all(Array.from({ length: 6 }, worker));
out.sort((a, b) => a.u.localeCompare(b.u));
fs.writeFileSync(OUT, JSON.stringify({ checked: new Date().toISOString(), links: out }, null, 1) + '\n');
const same = (a, b) => a.replace(/\/$/, '').replace(/^http:/, 'https:') === b.replace(/\/$/, '').replace(/^http:/, 'https:');
const bad = out.filter(r => r.status !== 200 && r.status !== 'not checked');
const skipped = out.filter(r => r.status === 'not checked');
const moved = out.filter(r => r.status === 200 && r.final && !same(r.final, r.u));
console.log(`${out.length} addresses checked; ${bad.length} not answering 200; ${moved.length} moved; ${skipped.length} closed to automated readers. Written to ${OUT}`);
for (const r of bad) console.log('  ' + String(r.status).padEnd(8), r.u, r.final ? '-> ' + r.final : '', r.note || '', '|', r.w.join(', '));
if (moved.length) console.log('Moved:');
for (const r of moved) console.log('  ' + r.u, '->', r.final, '|', r.w.join(', '));
