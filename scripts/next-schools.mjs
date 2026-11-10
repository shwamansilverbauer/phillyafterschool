// Which schools to add next. Every district and charter school in data/all-schools.json that has no page yet and
// teaches some of K to 5th grade, in this order:
//   1. data/school-queue.json, in its own order: the schools Josh has put first (most often, ones parents asked for);
//   2. schools a stored pickup list already names (a program on the site picks up there, so the page starts with
//      something), the most lists first;
//   3. the rest, nearest first to a school that already has a page, so the covered part of the city grows outward.
//
//   node scripts/next-schools.mjs            the next ten
//   node scripts/next-schools.mjs 25         the next 25
//   node scripts/next-schools.mjs --json     the same, as JSON
//
// A school is "covered" when a page in data/schools.json has its street address. The names a pickup list is checked
// for are rough (the school's own name, and its last word before "School", such as "Jenks"), so a match is a lead to
// read, not a link: the list's own words are printed beside it. Nothing here writes to the data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const all = read('data/all-schools.json').schools, pages = read('data/schools.json'), programs = read('data/programs.json');
const queue = fs.existsSync(path.join(ROOT, 'data/school-queue.json')) ? read('data/school-queue.json').schools || [] : [];
const want = Math.max(1, parseInt(process.argv.find(a => /^\d+$/.test(a)) || '10', 10)), asJson = process.argv.includes('--json');

const street = a => String(a || '').split(',')[0].toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const coveredStreets = new Set(pages.map(s => street(s.address)));
const covered = all.filter(x => coveredStreets.has(street(x.address)));
const firstGrade = g => { const m = /^(PK|K|\d+)/.exec(String(g || '')); return !m ? 99 : m[1] === 'PK' || m[1] === 'K' ? 0 : +m[1]; };
const elementary = x => firstGrade(x.grades) <= 5;
const miles = (a, b) => Math.hypot((a.lat - b.lat) * 69, (a.lng - b.lng) * 53);

// The names a provider might use for a school: its name without "School", and its last distinctive word (a surname,
// most often: "Jenks"). A word that is also in a covered school's name ("Washington" is in Vare-Washington, "Anderson"
// in Marian Anderson) or is a common word in school names says nothing, so it isn't used alone.
const COMMON = /^(Philadelphia|Academy|Elementary|Middle|Charter|Community|Mastery|KIPP|Global|International|Arts|Science|Sciences|Leadership|Institute|Center|Campus|North|South|East|West|Northeast|Northwest|Southwest|Prep|Preparatory|Saint|Learning|Achievement|Performing|Universal|Independence|Folk|Cultural|Treasures|Early|Lower|Upper|Girard|Franklin|Lincoln|Washington|Penn|Francis|Mary|Peter|John|James)$/;
const coveredWords = new Set(pages.flatMap(s => [s.name, s.shortName, ...(s.aliases || [])].join(' ').split(/[^A-Za-z]+/)).filter(Boolean));
const names = x => {
  const bare = x.name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\bSchool\b/g, '').replace(/\s+/g, ' ').trim();
  const words = bare.split(/[^A-Za-z.]+/).filter(w => /^[A-Z][a-z]{3,}$/.test(w) && !COMMON.test(w) && !coveredWords.has(w));
  return [...new Set([bare, words[words.length - 1]].filter(Boolean))];
};
const lists = programs.flatMap(p => (p.pickupLists || []).map(l => ({ program: p.id, text: l.text })));
const namedIn = x => {
  const ns = names(x);
  return lists.filter(l => ns.some(n => new RegExp(`(^|[^A-Za-z-])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z-]|$)`).test(l.text)));
};

const open = all.filter(x => !coveredStreets.has(street(x.address)) && elementary(x));
const queued = queue.map(q => ({ q, x: all.find(s => s.id === q.id) })).filter(({ x }) => x && open.includes(x));
const rest = open.filter(x => !queued.some(({ x: y }) => y === x)).map(x => {
  const near = covered.length && x.lat ? covered.reduce((b, c) => (miles(x, c) < miles(x, b) ? c : b)) : null;
  return { x, named: namedIn(x), near, d: near ? miles(x, near) : 99 };
});
rest.sort((a, b) => (b.named.length > 0) - (a.named.length > 0) || b.named.length - a.named.length || a.d - b.d);

const out = [
  ...queued.map(({ q, x }) => ({ id: x.id, name: x.name, kind: x.kind, grades: x.grades, address: `${x.address}, ${x.zip}`, why: 'queued: ' + (q.why || 'Josh put it first') })),
  ...rest.map(({ x, named, near, d }) => ({ id: x.id, name: x.name, kind: x.kind, grades: x.grades, address: `${x.address}, ${x.zip}`,
    why: named.length ? `named in ${named.length} stored pickup list${named.length === 1 ? '' : 's'}: ${named.map(l => `${l.program} ("${l.text.slice(0, 90)}${l.text.length > 90 ? '…' : ''}")`).join('; ')}` : near ? `${d.toFixed(2)} mi from ${near.name}, which has a page` : 'no map point' })),
].slice(0, want);

if (asJson) console.log(JSON.stringify({ covered: covered.length, uncovered: open.length, next: out }, null, 1));
else {
  console.log(`${covered.length} schools have pages; ${open.length} schools with some of K to 5th grade don't. Next ${out.length}:\n`);
  out.forEach((s, i) => console.log(`${i + 1}. ${s.name} (${s.kind}, ${s.grades}), ${s.address}\n   ${s.why}\n   city id: ${s.id}`));
}
