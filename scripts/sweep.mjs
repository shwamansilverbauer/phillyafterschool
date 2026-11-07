// The provider sweep for a school: what to read before its page goes up, and again whenever a neighborhood is new.
//
//   node scripts/sweep.mjs <school id>          a school in data/schools.json
//   node scripts/sweep.mjs "2201 Brown St"      or any street address, before the school is added
//
// It prints, from the site's own data and the City's open program data (nothing else is reachable without a browser):
//   1. every listed program within a mile, with its relation to this school if it has one, and whether its own
//      pickup list names the school (so a pickup can be linked straight away);
//   2. every pickup list on the site that names a school by this school's names (aliases included);
//   3. Parks & Rec's after-school programs within a mile, from the City's program data (phl.carto.com, the data
//      behind the Parks & Rec finder): facility, address, ages, fee, registration status and the year the entry was
//      made, which is how stale it may be;
//   4. the City's OST program locator, which has to be read in a browser (phila.gov/ost/program-locator), and the
//      providers' own pages for anything found: a sweep ends with those reads, not with this list.
// Nothing here is written to the data: a listing comes from reading the provider's own page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addressKey, streetAddresses } from './addresses.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const schools = read('data/schools.json'), programs = read('data/programs.json'), geo = read('data/geo.json').places;

const want = process.argv[2];
if (!want) { console.error('Which school? An id from data/schools.json, or a street address.'); process.exit(1); }
const school = schools.find(s => s.id === want) || null;
const address = school ? school.address : want;
const key = t => { const a = streetAddresses(t)[0]; return addressKey(a || t); };   // "2201 Brown St, Philadelphia, PA 19130" -> "2201 brown st"
const here = geo[key(address)];
if (!here) { console.error(`No coordinates for "${address}" yet: add it to a school or program and run node scripts/geocode.mjs first.`); process.exit(1); }
const names = school ? [school.name, school.shortName, ...(school.aliases || [])].filter(Boolean) : [want];
const miles = (a, b) => Math.hypot((a[0] - b[0]) * 69, (a[1] - b[1]) * 53);
const dir = (a, b) => { const dy = b[0] - a[0], dx = (b[1] - a[1]) * 0.77; const ang = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360; return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(ang / 45) % 8]; };
const at = (d) => d < 0.15 ? 'a couple of blocks' : d < 0.3 ? 'about a quarter mile' : d < 0.45 ? 'about a third of a mile' : d < 0.6 ? 'about half a mile' : d < 0.8 ? 'about two-thirds of a mile' : 'about a mile';
const mentions = text => names.some(n => n.length > 3 && new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text || ''));

console.log(`\nSweep for ${school ? school.name : want} (${address})\n`);
console.log('1. Listed programs within a mile');
const near = [];
for (const p of programs) {
  const k = key(p.address || ''); if (!k || !geo[k]) continue;
  const d = miles(here, geo[k]); if (d > 1) continue;
  const rel = school && p.schools && p.schools[school.id] ? p.schools[school.id].relation : '';
  const named = (p.pickupLists || []).some(l => mentions(l.text));
  near.push({ d, line: `   ${d.toFixed(2)} mi  ${p.id}${p.scope ? ' [' + p.scope + ']' : ''}  ${rel ? '(' + rel + ')' : '(not linked)'}${named ? '  <- its own pickup list names this school' : ''}  ${at(d)} ${dir(here, geo[k])}` });
}
near.sort((a, b) => a.d - b.d).forEach(x => console.log(x.line));
if (!near.length) console.log('   none');

console.log('\n2. Pickup lists on the site that name this school');
let any = false;
for (const p of programs) for (const l of p.pickupLists || []) if (mentions(l.text)) { any = true; console.log(`   ${p.id}: "${l.text.slice(0, 120)}${l.text.length > 120 ? '…' : ''}" (read ${l.read})`); }
if (!any) console.log('   none');

console.log('\n3. Parks & Rec after-school programs within a mile (the City\'s own program data)');
const sql = q => fetch('https://phl.carto.com/api/v2/sql?format=json&q=' + encodeURIComponent(q)).then(r => r.json()).then(j => { if (j.error) throw new Error(j.error.join('; ')); return j.rows; });
try {
  const fac = new Map();
  for (const f of await sql('select id, public_name, address, contact_phone from ppr_facilities')) { let a = {}; try { a = JSON.parse(f.address || '{}'); } catch (e) { /* no address */ } if (a.latitude && a.longitude) fac.set(f.id, { name: f.public_name, full: a.full, phone: f.contact_phone, ll: [a.latitude, a.longitude] }); }
  const rows = await sql("select id, program_name, program_description, facility, age_low, age_high, fee, fee_frequency, registration_status, date_time_entered from ppr_programs where program_is_active and program_is_public and (program_name ilike '%after%school%' or program_name ilike '%afterschool%' or program_name_full ilike '%after school%')");
  const out = [];
  for (const r of rows) {
    let ids = []; try { ids = JSON.parse(r.facility || '[]'); } catch (e) { /* none */ }
    const f = fac.get(ids[0]); if (!f) continue;
    const d = miles(here, f.ll); if (d > 1) continue;
    const desc = (r.program_description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    out.push({ d, line: `   ${d.toFixed(2)} mi  ${f.name} (${f.full}; ${f.phone || 'no phone'})  "${r.program_name}"  ages ${r.age_low}–${r.age_high}  $${r.fee} ${(r.fee_frequency || '').replace(/[\[\]"]/g, '')}  ${(r.registration_status || '').replace(/[\[\]"]/g, '')}  entered ${(r.date_time_entered || '').slice(0, 4)}${desc && !/^Looking to give your child/.test(desc) ? '\n           ' + desc.slice(0, 160) : ''}` });
  }
  out.sort((a, b) => a.d - b.d).forEach(x => console.log(x.line));
  if (!out.length) console.log('   none within a mile');
} catch (e) { console.log('   (the City\'s data could not be read: ' + e.message + ')'); }

console.log(`\n4. Still to read by hand
   - the City's OST program locator (https://www.phila.gov/ost/program-locator/#/), in a browser: search the ZIP and expand what's at or near the school
   - the school's own site, for a bell schedule and any after-school page or partners list
   - each provider's own page, for anything found above or in a third-party roundup (phillyfamily.com keeps one): only a provider's own page or word goes on the site
   - the families who asked for the school, and the school office: "who picks up here, and who runs on site?"\n`);
