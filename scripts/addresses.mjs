// Pulls the street addresses out of a listing's "address" text, so a place can be put on a map and measured from.
// "761 S 8th St and 904 S 9th St" gives two; "Bok, 1901 S 9th St" gives one; "At about 30 district schools" gives none.
// A range like "700–702 N 3rd St" counts as its first number. Used by build.mjs and by scripts/geocode.mjs.
const KNOWN = {   // places written without a street number
  '12th and Wharton Sts': '1200 Wharton St',
  'Woodmere Art Museum': '9201 Germantown Ave',
  'One Awbury Rd': '1 Awbury Rd',
};
const STREET = /(\d+)(?:\s*[–-]\s*\d+)?\s+((?:[NSEW]\.? )?(?:[A-Z0-9][A-Za-z0-9’'.]*\s)+?(?:St|Ave|Blvd|Rd|Ln|Pkwy|Dr|Way|Pl|Ct|Ter|Pike)\b)/g;
export const addressKey = a => a.toLowerCase().replace(/[’']/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim();
export function streetAddresses(text) {
  let t = String(text || '');
  for (const [name, at] of Object.entries(KNOWN)) if (t.includes(name)) t = t.replace(name, at);
  const out = [];
  for (const m of t.matchAll(STREET)) { const a = `${m[1]} ${m[2].trim()}`; if (!out.some(x => addressKey(x) === addressKey(a))) out.push(a); }
  return out;
}
