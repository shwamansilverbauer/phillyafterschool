// Writes docs/code-map.md: the sections and main functions of build.mjs and src/server/groups-api.php, with their
// line numbers, and the API's routes. An agent opens the map, then reads only the lines it needs, instead of a
// 700 KB file. The publishing job runs this and commits the map when the line numbers move (CLAUDE.md, docs/setup.md).
//
//   node scripts/code-map.mjs           rewrite docs/code-map.md
//   node scripts/code-map.mjs --check   say whether it is current (exit 1 if not); writes nothing
//
// Plain Node, no packages. The output carries no date, so it only changes when the code does.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outAt = process.argv.indexOf('--out');   // --out <file>: write there instead (the tests use it)
const OUT = outAt > 0 ? path.resolve(process.argv[outAt + 1]) : path.join(ROOT, 'docs', 'code-map.md');

// "// ---------- site copy ----------" opens a section; "// ----- this week at a school -----" a part of one.
const BANNER = /^(\s*)\/\/ (-{3,}) (.+?)(?: -{3,})?\s*$/;

function readLines(rel) {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();   // the newline that ends the file starts no line
  return lines;
}

// Sections of a file, each with the functions declared at the top level inside it.
function sections(lines, isFunction, extra = null) {
  const out = [{ title: '(top of the file)', level: 0, start: 1, fns: [] }];
  lines.forEach((line, i) => {
    if (extra && extra.test.test(line)) { out.push({ title: extra.title, level: 0, start: i + 1, fns: [] }); return; }
    const b = line.match(BANNER);
    if (b && b[1] === '') {
      out.push({ title: clip(b[3]), level: b[2].length >= 8 ? 0 : 1, start: i + 1, fns: [] });
      return;
    }
    const name = isFunction(line);
    if (name) out[out.length - 1].fns.push([name, i + 1]);
  });
  out.forEach((s, k) => { s.end = k + 1 < out.length ? out[k + 1].start - 1 : lines.length; });
  return out.filter(s => s.fns.length || s.level === 0 || s.end > s.start);
}

// The first clause of a comment, short enough for a table cell.
function clip(text) {
  let t = text.replace(/\s*-{3,}\s*$/, '').trim();
  const cut = t.search(/[:.](\s|$)|\?/);
  if (cut > 0) t = t.slice(0, t[cut] === '?' ? cut + 1 : cut);
  if (t.length > 80) t = t.slice(0, 77).replace(/\s+\S*$/, '') + '…';
  return t.replace(/\|/g, '\\|');
}

const cell = fns => fns.map(([n, l]) => `\`${n}\` ${l}`).join(', ');
const range = s => (s.end > s.start ? `${s.start}–${s.end}` : `${s.start}`);

function sectionTable(secs) {
  const rows = ['| Lines | Section | Functions (line) |', '|---|---|---|'];
  for (const s of secs) rows.push(`| ${range(s)} | ${s.level ? '↳ ' : ''}${s.title} | ${cell(s.fns) || '—'} |`);
  return rows.join('\n');
}

// ---------- build.mjs ----------
const build = readLines('build.mjs');
const buildSecs = sections(build, line => {
  let m = line.match(/^(?:export )?(?:async )?function\*? ([A-Za-z_$][\w$]*)\s*\(/);
  if (m) return m[1];
  m = line.match(/^(?:export )?const ([A-Za-z_$][\w$]*) = (?:async )?(?:\([^)]*\)|[A-Za-z_$][\w$]*) =>/);
  return m ? m[1] : null;
});

// ---------- src/server/groups-api.php ----------
const api = readLines('src/server/groups-api.php');
const SWITCH = /^switch \(\$method \. ' ' \. \$action\)/;
const apiSecs = sections(api, line => {
  const m = line.match(/^function ([A-Za-z_][\w]*)\s*\(/);
  return m ? m[1] : null;
}, { test: SWITCH, title: 'the routes: one `case` per request (listed under Routes)' });
// The routes: one "case 'POST name':" each, grouped by the "// ----- … -----" comment above them.
const routes = [];
let group = '(ungrouped)';
let inSwitch = false;
api.forEach((line, i) => {
  if (SWITCH.test(line)) inSwitch = true;
  if (!inSwitch) return;
  const g = line.match(/^ {2}\/\/ -{3,} (.+)$/);
  if (g) { group = clip(g[1]); return; }
  const r = line.match(/^ {2}case '(GET|POST) ([\w-]+)':/);
  if (r) {
    const last = routes[routes.length - 1];
    if (last && last.group === group) last.items.push([`${r[1]} ${r[2]}`, i + 1]);
    else routes.push({ group, items: [[`${r[1]} ${r[2]}`, i + 1]] });
  }
});
const routeCount = routes.reduce((n, g) => n + g.items.length, 0);

const md = `# Code map

Written by \`scripts/code-map.mjs\`. Don't edit it by hand: run \`node scripts/code-map.mjs\` after changing
\`build.mjs\` or \`src/server/groups-api.php\`, and the publishing job rewrites it on \`main\` when the line numbers move.

Use it to open only the lines you need: find the function here, then read from its line.

## build.mjs (${build.length} lines)

Run as \`node build.mjs\`. Reads \`data/\` and \`src/\`, writes the finished site to \`dist/\`.

${sectionTable(buildSecs)}

## src/server/groups-api.php (${api.length} lines)

The accounts API. \`build.mjs\` writes it into the site as \`groups/api.php\`, with its settings filled in. Functions
first, then the ${routeCount} routes, which live in one \`switch\` on the method and action.

${sectionTable(apiSecs)}

### Routes

| Group | Routes (line) |
|---|---|
${routes.map(g => `| ${g.group} | ${cell(g.items)} |`).join('\n')}
`;

if (process.argv.includes('--check')) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (now === md) { console.log(`${path.relative(ROOT, OUT)} is current.`); process.exit(0); }
  console.log('docs/code-map.md is out of date. Run: node scripts/code-map.mjs');
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
fs.writeFileSync(OUT, md);
const fnCount = s => s.reduce((n, x) => n + x.fns.length, 0);
console.log(`${before === md ? 'Unchanged' : 'Wrote'} ${path.relative(ROOT, OUT)}: build.mjs ${buildSecs.length} sections, ${fnCount(buildSecs)} functions; ` +
  `groups-api.php ${apiSecs.length} sections, ${fnCount(apiSecs)} functions, ${routeCount} routes.`);
