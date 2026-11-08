// Things the tests pick out of the site's own data, so they keep working as listings come and go.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, TODAY, Failure } from './harness.mjs';

const json = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
export const programs = () => json('programs.json');
export const schools = () => json('schools.json');
export const camps = () => json('camps.json');
export const daysOff = () => json('days-off.json');
// A school on the citywide list that has no page yet: what "Ask for this school" is for.
export function uncoveredSchool() {
  const have = new Set(schools().map(s => s.id));
  const all = json('all-schools.json').schools;
  const s = all.find(x => !have.has(x.id) && !/^(nebinger|meredith|coppin)$/.test(x.id));
  if (!s) throw new Failure('every school on the city list is covered');
  return s.id;
}
export const config = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

// A program that picks up from (or runs at) a school, with the school: the ordinary weekday entry "program.school".
export function pickupPair(prefer = 'nebinger') {
  const list = programs();
  const p = list.find(x => x.schools && x.schools[prefer] && x.schools[prefer].relation !== 'nearby') || list.find(x => x.schools && Object.values(x.schools).some(s => s.relation !== 'nearby'));
  if (!p) throw new Failure('no program with a school in data/programs.json');
  const school = p.schools[prefer] ? prefer : Object.keys(p.schools).find(s => p.schools[s].relation !== 'nearby');
  return { program: p, school, entry: `${p.id}.${school}` };
}
// A program with named classes, and one of its classes.
export function classPair() {
  const p = programs().find(x => Array.isArray(x.offers) && x.offers.length && x.schools && Object.keys(x.schools).length);
  if (!p) throw new Failure('no program with classes and a school');
  return { program: p, school: Object.keys(p.schools)[0], cls: p.offers[0] };
}
// A program with Saturday or Sunday classes.
export function weekendProgram() {
  const p = programs().find(x => x.weekend && Array.isArray(x.weekend.days) && x.weekend.days.length);
  if (!p) throw new Failure('no program with weekend classes');
  return { program: p, day: p.weekend.days[0] };
}
// A program that runs day-off camps.
export function dayOffProgram() {
  const p = programs().find(x => x.daysOff && Array.isArray(x.daysOff.dates) && x.daysOff.dates.length);
  if (!p) throw new Failure('no program with day-off camps');
  return p;
}
// Two listed camps, and the summer the camp list describes.
export function twoCamps() { const c = camps(); return { season: c.season, ids: c.camps.slice(0, 2).map(x => x.id) }; }
// District days off on or after the fixed day.
export const upcomingDaysOff = () => daysOff().days.filter(d => d.date >= TODAY).map(d => d.date);
export const schoolYearStart = () => parseInt(daysOff().schoolYear.slice(0, 4), 10);
// The Monday of the fixed day's week and the next, as YYYY-MM-DD.
export const monday = (offsetWeeks = 0) => { const d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + offsetWeeks * 7); return d.toISOString().slice(0, 10); };
