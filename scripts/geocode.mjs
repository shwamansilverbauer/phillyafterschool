// Looks up where each listing is, once, and keeps the answers in data/geo.json so the build can measure distances and
// draw a map without asking anyone anything. Run it by hand after adding or changing an address:
//   node scripts/geocode.mjs
// It asks the U.S. Census Bureau's free address lookup, only for addresses that aren't in the file yet, and never
// removes one. An address the Census can't place is listed at the end; add it by hand under "places" as
// "number street": [latitude, longitude].
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { streetAddresses, addressKey } from './addresses.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const file = path.join(ROOT, 'data/geo.json');
const geo = fs.existsSync(file) ? read('data/geo.json') : { source: 'U.S. Census Bureau geocoder (Public_AR_Current)', places: {} };
const texts = [];
const programs = read('data/programs.json'); for (const p of programs.programs || programs) { texts.push(p.address); for (const l of Object.values(p.schools || {})) texts.push(l.address); }
const camps = read('data/camps.json'); for (const c of camps.camps) texts.push(c.address);
const schools = read('data/schools.json'); for (const s of schools.schools || schools) texts.push(s.address);
const want = [...new Set(texts.flatMap(streetAddresses).map(a => JSON.stringify([addressKey(a), a])))].map(x => JSON.parse(x)).filter(([k]) => !geo.places[k]);
const missed = [];
for (const [key, address] of want) {
  const url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=' + encodeURIComponent(address.replace(/[’]/g, "'") + ', Philadelphia, PA');
  try {
    const r = await fetch(url); const j = await r.json();
    const m = (j.result?.addressMatches || []).find(x => /PHILADELPHIA/i.test(x.addressComponents?.city || '')) || (j.result?.addressMatches || [])[0];
    if (!m) { missed.push(address); continue; }
    geo.places[key] = [+m.coordinates.y.toFixed(5), +m.coordinates.x.toFixed(5)];
    console.log('found', address, geo.places[key].join(', '));
  } catch (e) { missed.push(address + ' (' + e.message + ')'); }
  await new Promise(r => setTimeout(r, 250));
}
geo.checked = new Date().toISOString().slice(0, 10);
geo.places = Object.fromEntries(Object.entries(geo.places).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(file, JSON.stringify(geo, null, 1) + '\n');
console.log(`${Object.keys(geo.places).length} places in data/geo.json.` + (missed.length ? ` Not found: ${missed.join('; ')}` : ''));
