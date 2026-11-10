// robots.txt, read once per site, for the scripts that read provider pages (linkcheck.mjs, precheck.mjs). A path that
// robots.txt closes to *, ClaudeBot, Claude-Web, anthropic-ai or GPTBot is not requested.
export const UA_BASE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const AGENTS = ['*', 'claudebot', 'claude-web', 'anthropic-ai', 'gptbot'];
const robotsCache = new Map();
export async function robots(origin, UA) {
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
export function disallowed(rules, p) {
  let best = null;   // the most specific rule for any agent group that covers us
  for (const r of rules) {
    if (!r.agents.some(a => AGENTS.includes(a)) || !r.path) continue;
    const pat = '^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    if (new RegExp(pat).test(p) && (!best || r.path.length > best.path.length)) best = r;
  }
  return best ? !best.allow : false;
}
