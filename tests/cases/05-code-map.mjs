// The map agents read before opening the big files (scripts/code-map.mjs writes docs/code-map.md), and the index that
// replaced the long README: each line number in the map lands on the function it names, and every link in the README
// and CLAUDE.md opens a file that exists.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, ok, eq, ROOT } from '../lib/harness.mjs';

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('the code map: each function and route it lists is on the line it gives, and two runs write the same map', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-code-map-'));
  const make = name => {
    const out = path.join(dir, name);
    execFileSync('node', [path.join(ROOT, 'scripts/code-map.mjs'), '--out', out], { encoding: 'utf8' });
    return fs.readFileSync(out, 'utf8');
  };
  const map = make('a.md');
  eq(make('b.md'), map, 'the map carries no date or other change between runs');

  const files = { 'build.mjs': read('build.mjs').split('\n'), 'src/server/groups-api.php': read('src/server/groups-api.php').split('\n') };
  let checked = 0;
  for (const [file, lines] of Object.entries(files)) {
    const part = map.split(`## ${file} (`)[1].split(/\n## /)[0];
    for (const [, name, line] of part.matchAll(/`((?:GET|POST) [\w-]+|[A-Za-z_$][\w$]*)` (\d+)/g)) {
      const at = lines[Number(line) - 1] || '';
      const declares = name.includes(' ')
        ? at.includes(`case '${name}':`)
        : at.includes(`function ${name}(`) || at.includes(`function ${name} (`) || at.includes(`const ${name} = `);
      ok(declares,
        `${file} line ${line} should declare ${name}, but reads: ${at.trim().slice(0, 80)}`);
      checked++;
    }
  }
  ok(checked > 300, `the map lists the functions (only ${checked} found)`);
  ok(/\| `POST hit` \d+|`POST hit` \d+/.test(map), 'the routes are listed');
});

test('the README is a short index, and every link in it and in CLAUDE.md opens a file in the repository', () => {
  const readme = read('README.md');
  ok(readme.length < 20000, `the README stays an index (it is ${readme.length} characters)`);
  const docs = fs.readdirSync(path.join(ROOT, 'docs')).filter(f => f.endsWith('.md'));
  for (const f of docs) ok(readme.includes(`(docs/${f}`), `the README links to docs/${f}`);
  const claude = read('CLAUDE.md');
  ok(claude.split('\n').length < 200, 'CLAUDE.md is under 200 lines');
  for (const [name, text] of [['README.md', readme], ['CLAUDE.md', claude]]) {
    for (const [, target] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^https?:/.test(target)) continue;
      ok(fs.existsSync(path.join(ROOT, target)), `${name} links to ${target}, which isn't there`);
    }
  }
});
