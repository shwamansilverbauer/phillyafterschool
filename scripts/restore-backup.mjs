// Opens a copy the server sent off the host (to the private backup repository) with secret.key.
//
//   node scripts/restore-backup.mjs <groups.sqlite.enc> <secret.key> [out.sqlite]
//   node scripts/restore-backup.mjs <photos folder of .enc files> <secret.key> [out folder]
//
// What the server sends (offsite_seal() in src/server/groups-api.php): "PASB1", a 12-byte IV, a 16-byte tag, then
// AES-256-GCM (additional data "pas-offsite") of the gzipped file, with the key HMAC-SHA256(secret.key, "pas-offsite-v1").
// secret.key is the 64-character line in phillyafterschool-data/secret.key on the host; keep a copy somewhere safe
// off the host, because without it no copy can be opened. Nothing here sends anything anywhere.
//
// A database copy is checked against backup.json when that file sits next to it (same size and checksum), and the
// restored database is then ready to go back as phillyafterschool-data/groups.sqlite, beside the same secret.key.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export function openCopy(enc, secretHex) {
  if (!/^[0-9a-f]{64}$/i.test(secretHex)) throw new Error('secret.key should be one line of 64 hex characters');
  if (enc.length < 33 || enc.subarray(0, 5).toString() !== 'PASB1') throw new Error('not a copy made by the site (it should start with PASB1)');
  const key = crypto.createHmac('sha256', Buffer.from(secretHex, 'hex')).update('pas-offsite-v1').digest();
  const d = crypto.createDecipheriv('aes-256-gcm', key, enc.subarray(5, 17));
  d.setAAD(Buffer.from('pas-offsite'));
  d.setAuthTag(enc.subarray(17, 33));
  let z;
  try { z = Buffer.concat([d.update(enc.subarray(33)), d.final()]); }
  catch (e) { throw new Error('this secret.key does not open this copy (a different key, or a damaged file)'); }
  return zlib.gunzipSync(z);
}

function main() {
  const [src, keyFile, outArg] = process.argv.slice(2);
  if (!src || !keyFile) {
    console.log('Usage: node scripts/restore-backup.mjs <groups.sqlite.enc | folder of .enc files> <secret.key> [out]');
    process.exit(2);
  }
  const secretHex = fs.readFileSync(keyFile, 'utf8').trim();
  if (fs.statSync(src).isDirectory()) {
    const out = outArg || src.replace(/\/$/, '') + '-restored';
    fs.mkdirSync(out, { recursive: true });
    let n = 0;
    for (const f of fs.readdirSync(src).filter(f => f.endsWith('.enc'))) { fs.writeFileSync(path.join(out, f.slice(0, -4)), openCopy(fs.readFileSync(path.join(src, f)), secretHex)); n++; }
    console.log(`Opened ${n} file(s) into ${out}`);
    return;
  }
  const plain = openCopy(fs.readFileSync(src), secretHex);
  const sum = crypto.createHash('sha256').update(plain).digest('hex');
  const manifest = path.join(path.dirname(src), 'backup.json');
  if (fs.existsSync(manifest) && path.basename(src) === 'groups.sqlite.enc') {
    const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    if (m.sha256 !== sum || m.bytes !== plain.length) throw new Error(`this copy does not match backup.json (made ${m.day}): the two files are from different days`);
    console.log(`Matches backup.json: the copy of ${m.day}, ${plain.length} bytes, ${Object.entries(m.rows || {}).map(([t, n]) => `${t} ${n}`).join(', ')}`);
  }
  const out = outArg || src.replace(/\.enc$/, '') + (src.endsWith('.enc') ? '' : '.restored');
  fs.writeFileSync(out, plain);
  console.log(`Wrote ${out} (${plain.length} bytes, sha256 ${sum}). It goes back as phillyafterschool-data/groups.sqlite, next to the same secret.key.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { main(); } catch (e) { console.error('Could not restore: ' + e.message); process.exit(1); }
}
