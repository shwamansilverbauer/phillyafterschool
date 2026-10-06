<?php
// Accounts and share groups for Philly After School. Copied into the site by build.mjs; edit it here.
//
// What this stores, and nothing more:
//   an account     - an email address and the parent's first name
//   a group        - a name, its owner, and a join code (kept encrypted)
//   a membership   - who is in which group, and whether the owner has approved them
//   a child        - a first name and the programs on their current and upcoming week (no school, address, note or photo)
// Everything lives in one small database file kept outside the public folder. Nothing here is ever written into a page:
// a group is only sent, as data, to a signed-in member the owner has approved.
//
// Signing in has no passwords. The site emails a link (and a 6-digit code for the device that asked); each works once
// and for 15 minutes. A device then stays signed in for 30 days.

declare(strict_types=1);

$CFG = json_decode('/*CONFIG*/', true);
if (!is_array($CFG)) { http_response_code(500); exit; }

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');

const LINK_MINUTES = 15;
const SESSION_DAYS = 30;
const MAX_OWNED = 10;       // groups one person can own
const MAX_JOINED = 30;      // groups one person can be in
const MAX_MEMBERS = 80;     // people in one group
const MAX_KIDS = 6;         // children one member can add to one group
const DAYS = array('mon', 'tue', 'wed', 'thu', 'fri');

function out(array $data, int $code = 200): void { http_response_code($code); echo json_encode($data); exit; }
function fail(string $error, string $message, int $code = 400): void { out(array('ok' => false, 'error' => $error, 'message' => $message), $code); }
function b64(string $bytes): string { return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '='); }
function h(string $v): string { return hash('sha256', $v); }
function now(): int { return time(); }

// ---------- where things are kept ----------
function data_dir(): string {
  $dir = dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-data';
  if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) fail('storage', 'Groups are not available right now.', 503);
  return $dir;
}
function secret(): string {
  static $s = null;
  if ($s !== null) return $s;
  $file = data_dir() . '/secret.key';
  $raw = @file_get_contents($file);
  if ($raw === false || strlen(trim($raw)) !== 64) {
    $raw = bin2hex(random_bytes(32));
    if (@file_put_contents($file, $raw, LOCK_EX) === false) fail('storage', 'Groups are not available right now.', 503);
    @chmod($file, 0600);
    $raw = (string) @file_get_contents($file);   // if two requests raced, both read back the same key
  }
  $s = hex2bin(trim($raw));
  return $s;
}
function db(): PDO {
  static $db = null;
  if ($db !== null) return $db;
  try {
    $db = new PDO('sqlite:' . data_dir() . '/groups.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $db->exec('PRAGMA journal_mode=WAL');
    $db->exec('PRAGMA foreign_keys=ON');
    $db->exec('PRAGMA busy_timeout=4000');
    $db->exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT \'\', created INTEGER NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS logins (id INTEGER PRIMARY KEY, email TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, req_hash TEXT NOT NULL UNIQUE, code_hash TEXT NOT NULL, next TEXT NOT NULL DEFAULT \'\', expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, tries INTEGER NOT NULL DEFAULT 0)');
    $db->exec('CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, sid_hash TEXT NOT NULL UNIQUE, expires INTEGER NOT NULL, seen INTEGER NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS grp (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, code_mac TEXT NOT NULL UNIQUE, code_enc TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY, group_id TEXT NOT NULL REFERENCES grp(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL, UNIQUE (group_id, user_id))');
    $db->exec('CREATE TABLE IF NOT EXISTS kids (id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE, name TEXT NOT NULL, now_json TEXT NOT NULL, next_json TEXT NOT NULL, updated INTEGER NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS throttle (k TEXT NOT NULL, t INTEGER NOT NULL)');
    $db->exec('CREATE INDEX IF NOT EXISTS throttle_k ON throttle (k, t)');
    $db->exec('CREATE INDEX IF NOT EXISTS members_user ON members (user_id)');
    $db->exec('CREATE INDEX IF NOT EXISTS kids_member ON kids (member_id)');
  } catch (Exception $e) {
    fail('storage', 'Groups are not available right now.', 503);
  }
  return $db;
}
function q(string $sql, array $args = array()): PDOStatement { $st = db()->prepare($sql); $st->execute($args); return $st; }
function row(string $sql, array $args = array()) { $r = q($sql, $args)->fetch(); return $r === false ? null : $r; }
function val(string $sql, array $args = array()) { $v = q($sql, $args)->fetchColumn(); return $v === false ? null : $v; }

// Now and then, clear out what has expired: used links, old sessions, and groups past the end of the school year.
function tidy(): void {
  if (random_int(1, 40) !== 1) return;
  $t = now();
  q('DELETE FROM logins WHERE expires < ?', array($t - 3600));
  q('DELETE FROM sessions WHERE expires < ?', array($t));
  q('DELETE FROM throttle WHERE t < ?', array($t - 2 * 86400));
  q('DELETE FROM grp WHERE expires < ?', array($t));
}

// ---------- slowing down guessing and floods ----------
function who(): string { return substr(hash_hmac('sha256', isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '', secret()), 0, 20); }
function too_many(string $key, int $max, int $seconds): bool {
  return (int) val('SELECT COUNT(*) FROM throttle WHERE k = ? AND t > ?', array($key, now() - $seconds)) >= $max;
}
function note(string $key): void { q('INSERT INTO throttle (k, t) VALUES (?, ?)', array($key, now())); }

// ---------- the request ----------
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
$action = isset($_GET['action']) && is_string($_GET['action']) ? $_GET['action'] : '';
$in = array();
if ($method === 'POST') {
  // Only this site's own pages may change anything: they send a header other sites cannot, and the address must match.
  if (!isset($_SERVER['HTTP_X_PAS']) || $_SERVER['HTTP_X_PAS'] !== '1') fail('forbidden', 'That request was not accepted.', 403);
  if (isset($_SERVER['HTTP_ORIGIN'])) {
    $origin = parse_url((string) $_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
    $port = parse_url((string) $_SERVER['HTTP_ORIGIN'], PHP_URL_PORT);
    $host = isset($_SERVER['HTTP_HOST']) ? (string) $_SERVER['HTTP_HOST'] : '';
    if (!is_string($origin) || strcasecmp($origin . ($port ? ':' . $port : ''), $host) !== 0) fail('forbidden', 'That request was not accepted.', 403);
  }
  $raw = (string) file_get_contents('php://input', false, null, 0, 60000);
  $in = json_decode($raw, true);
  if (!is_array($in)) fail('bad', 'That request was not understood.');
} elseif ($method !== 'GET') {
  fail('bad', 'That request was not understood.', 405);
}
function str(array $a, string $key, int $max): string {
  $v = isset($a[$key]) && is_string($a[$key]) ? $a[$key] : '';
  $v = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v) ?? '');
  return mb_substr($v, 0, $max, 'UTF-8');
}
// A first name: letters, spaces, hyphens and apostrophes, up to 20 characters.
function first_name(string $v): string {
  $v = preg_replace('/[^\p{L}\p{M} \'’.-]+/u', '', $v) ?? '';
  return trim(mb_substr(trim(preg_replace('/\s+/u', ' ', $v) ?? ''), 0, 20, 'UTF-8'));
}
// What an adult calls themselves: "Josh", "Josh - Jasper's dad", "Ms Rivera (teacher)". Up to 30 characters.
function adult_name(string $v): string {
  $v = preg_replace('/[^\p{L}\p{M} \'’.,()-]+/u', '', $v) ?? '';
  return trim(mb_substr(trim(preg_replace('/\s+/u', ' ', $v) ?? ''), 0, 30, 'UTF-8'));
}
function group_name(string $v): string {
  $v = preg_replace('/[<>"&]+/u', '', $v) ?? '';
  return trim(mb_substr(trim(preg_replace('/\s+/u', ' ', $v) ?? ''), 0, 50, 'UTF-8'));
}

// ---------- who is signed in ----------
function set_session_cookie(string $value, int $expires): void {
  global $https;
  setcookie('pas_s', $value, array('expires' => $expires, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax'));
}
function current_user(): ?array {
  static $done = false, $user = null;
  if ($done) return $user;
  $done = true;
  $sid = isset($_COOKIE['pas_s']) && is_string($_COOKIE['pas_s']) ? $_COOKIE['pas_s'] : '';
  if (!preg_match('/^[A-Za-z0-9_-]{40,50}$/', $sid)) return null;
  $s = row('SELECT s.id AS sid, s.expires, s.seen, u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.sid_hash = ? AND s.expires > ?', array(h($sid), now()));
  if (!$s) return null;
  if ($s['seen'] < now() - 86400) {   // once a day, push the 30 days out again
    $exp = now() + SESSION_DAYS * 86400;
    q('UPDATE sessions SET seen = ?, expires = ? WHERE id = ?', array(now(), $exp, $s['sid']));
    set_session_cookie($sid, $exp);
  }
  $user = array('id' => (int) $s['id'], 'email' => $s['email'], 'name' => $s['name'], 'sid' => (int) $s['sid']);
  return $user;
}
function need_user(): array {
  $u = current_user();
  if (!$u) fail('signin', 'Please sign in again.', 401);
  return $u;
}

// ---------- email ----------
function send_mail(string $to, string $subject, string $text, string $html): bool {
  global $CFG;
  $boundary = 'pas' . bin2hex(random_bytes(8));
  $headers = array(
    'From: ' . $CFG['siteName'] . ' <' . $CFG['from'] . '>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    'Auto-Submitted: auto-generated',
    'X-Auto-Response-Suppress: All',
  );
  $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text))
    . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html))
    . "--$boundary--\r\n";
  $subj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
  if (@mail($to, $subj, $body, implode("\r\n", $headers), '-f' . $CFG['from'])) return true;
  return (bool) @mail($to, $subj, $body, implode("\r\n", $headers));   // some hosts refuse a set sender; try without
}
function email_html(string $heading, string $lines, string $button, string $url, string $foot): string {
  global $CFG;
  $e = function ($v) { return htmlspecialchars($v, ENT_QUOTES, 'UTF-8'); };
  return '<!doctype html><html lang="en"><body style="margin:0;background:#F4F8FD;font-family:Arial,Helvetica,sans-serif;color:#0B2140">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:14px;border:1px solid #D5E2F2">'
    . '<tr><td style="background:#0F4D90;color:#FFFFFF;border-radius:14px 14px 0 0;padding:16px 24px;font-weight:bold;font-size:16px">' . $e($CFG['siteName']) . '</td></tr>'
    . '<tr><td style="padding:24px"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">' . $e($heading) . '</h1>'
    . '<div style="font-size:16px;line-height:1.5">' . $lines . '</div>'
    . ($button !== '' ? '<p style="margin:22px 0"><a href="' . $e($url) . '" style="display:inline-block;background:#F3C613;color:#2A2100;font-weight:bold;text-decoration:none;border-radius:999px;padding:13px 26px;font-size:16px">' . $e($button) . '</a></p>' : '')
    . '<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#4D607A">' . $e($foot) . '</p>'
    . '</td></tr></table></td></tr></table></body></html>';
}

// ---------- group codes: twelve characters from an alphabet with no look-alikes ----------
function new_code(): string {
  $abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  $c = '';
  for ($i = 0; $i < 12; $i++) $c .= $abc[random_int(0, strlen($abc) - 1)];
  return substr($c, 0, 4) . '-' . substr($c, 4, 4) . '-' . substr($c, 8, 4);
}
function tidy_code(string $v): string { return preg_replace('/[^A-Z0-9]/', '', strtoupper($v)) ?? ''; }
function code_mac(string $code): string { return hash_hmac('sha256', 'code:' . tidy_code($code), secret()); }
function code_seal(string $code): string {
  $iv = random_bytes(12); $tag = '';
  $ct = openssl_encrypt($code, 'aes-256-gcm', secret(), OPENSSL_RAW_DATA, $iv, $tag);
  return base64_encode($iv . $tag . $ct);
}
function code_open(string $sealed): string {
  $raw = base64_decode($sealed, true);
  if ($raw === false || strlen($raw) < 29) return '';
  $pt = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', secret(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
  return $pt === false ? '' : $pt;
}

// ---------- a child's week: program ids, and a class only when the program lists it ----------
function programs(): array {
  static $p = null;
  if ($p !== null) return $p;
  $p = array();
  $list = json_decode((string) @file_get_contents($_SERVER['DOCUMENT_ROOT'] . '/data/programs.json'), true);
  if (is_array($list)) foreach ($list as $x) {
    if (is_array($x) && isset($x['id']) && is_string($x['id'])) $p[$x['id']] = isset($x['offers']) && is_array($x['offers']) ? $x['offers'] : array();
  }
  return $p;
}
function clean_week($w): string {
  $known = programs();
  $out = array();
  foreach (DAYS as $d) {
    $out[$d] = array();
    if (!is_array($w) || !isset($w[$d]) || !is_array($w[$d])) continue;
    foreach (array_slice($w[$d], 0, 8) as $e) {
      if (!is_string($e)) continue;
      $parts = explode('~', $e, 2);
      $id = $parts[0];
      if (!isset($known[$id])) continue;                                   // only programs the site lists
      $cls = isset($parts[1]) && in_array($parts[1], $known[$id], true) ? $parts[1] : '';   // free-text notes never leave the device
      $entry = $cls === '' ? $id : $id . '~' . $cls;
      if (!in_array($entry, $out[$d], true)) $out[$d][] = $entry;
    }
  }
  return json_encode($out);
}
function kid_out(array $k, bool $mine): array {
  return array('id' => (int) $k['id'], 'name' => $k['name'], 'now' => json_decode($k['now_json'], true), 'next' => json_decode($k['next_json'], true), 'mine' => $mine);
}

function membership(string $gid, int $uid): ?array {
  return row('SELECT m.id, m.role, m.status, g.name, g.owner_id, g.expires, g.code_enc FROM members m JOIN grp g ON g.id = m.group_id WHERE m.group_id = ? AND m.user_id = ? AND g.expires > ?', array($gid, $uid, now()));
}
function need_owner(string $gid, array $u): array {
  $m = membership($gid, $u['id']);
  if (!$m || $m['role'] !== 'owner') fail('forbidden', 'Only the person who made this group can do that.', 403);
  return $m;
}
function my_groups(int $uid): array {
  $list = array();
  foreach (q('SELECT g.id, g.name, m.role, m.status, m.id AS mid FROM members m JOIN grp g ON g.id = m.group_id WHERE m.user_id = ? AND g.expires > ? ORDER BY g.name COLLATE NOCASE', array($uid, now())) as $g) {
    $item = array('id' => $g['id'], 'name' => $g['name'], 'role' => $g['role'], 'status' => $g['status'], 'kids' => array());
    foreach (q('SELECT id, name FROM kids WHERE member_id = ? ORDER BY id', array($g['mid'])) as $k) $item['kids'][] = array('id' => (int) $k['id'], 'name' => $k['name']);
    if ($g['role'] === 'owner') $item['waiting'] = (int) val('SELECT COUNT(*) FROM members WHERE group_id = ? AND status = ?', array($g['id'], 'pending'));
    $list[] = $item;
  }
  return $list;
}
function me_out(array $u): array { return array('email' => $u['email'], 'name' => $u['name']); }
function year_end(): int {
  global $CFG;
  $t = isset($CFG['yearEnd']) ? strtotime($CFG['yearEnd'] . ' 23:59:59 America/New_York') : false;
  return ($t && $t > now() + 14 * 86400) ? $t : now() + 300 * 86400;
}

tidy();

switch ($method . ' ' . $action) {

  // ----- signing in -----
  case 'POST login_start': {
    $email = strtolower(str($in, 'email', 150));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('email', 'That email address doesn’t look right.');
    $next = str($in, 'next', 80);
    if (!preg_match('~^(board|account|groups(\?g=[A-Za-z0-9]{6,24})?)$~', $next)) $next = 'account';
    if (too_many('mail:' . h($email), 3, 900) || too_many('mail:' . h($email), 8, 86400) || too_many('ip:' . who(), 10, 900) || too_many('ip:' . who(), 40, 86400)) {
      fail('slow', 'That’s a lot of sign-in emails. Use the newest one, or wait 15 minutes and try again.', 429);
    }
    note('mail:' . h($email)); note('ip:' . who());
    $token = b64(random_bytes(32));
    $req = b64(random_bytes(18));
    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    q('DELETE FROM logins WHERE email = ? AND used = 0', array($email));   // only the newest email works
    q('INSERT INTO logins (email, token_hash, req_hash, code_hash, next, expires) VALUES (?, ?, ?, ?, ?, ?)', array($email, h($token), h($req), h($req . ':' . $code), $next, now() + LINK_MINUTES * 60));
    $url = $CFG['siteUrl'] . '/account/#t=' . $token;
    $shown = substr($code, 0, 3) . ' ' . substr($code, 3);
    $text = "Sign in to " . $CFG['siteName'] . "\n\nOpen this link on the device you want to sign in on:\n$url\n\nOr type this code into the page that asked for it: $shown\n\nBoth work once and stop working after " . LINK_MINUTES . " minutes. If you didn't ask for this, ignore it: nobody can sign in without this email.\n";
    $html = email_html('Sign in to ' . $CFG['siteName'], '<p style="margin:0 0 6px">Tap the button on the device you want to sign in on.</p>', 'Sign in', $url,
      'Or type this code into the page that asked for it: ' . $shown . '. Both work once and stop working after ' . LINK_MINUTES . ' minutes. If you didn’t ask for this, ignore it: nobody can sign in without this email.');
    if (!send_mail($email, 'Your sign-in link for ' . $CFG['siteName'], $text, $html)) fail('mail', 'The sign-in email could not be sent. Please try again in a minute.', 502);
    out(array('ok' => true, 'req' => $req, 'minutes' => LINK_MINUTES));
  }

  case 'POST login_finish': {
    $token = str($in, 'token', 80);
    $req = str($in, 'req', 60);
    $code = preg_replace('/\D/', '', str($in, 'code', 12)) ?? '';
    if (too_many('try:' . who(), 30, 900)) fail('slow', 'Too many tries. Wait 15 minutes, then ask for a new sign-in email.', 429);
    $login = null;
    if ($token !== '') {
      $login = row('SELECT * FROM logins WHERE token_hash = ?', array(h($token)));
      if (!$login || $login['used'] || $login['expires'] < now()) { note('try:' . who()); fail('expired', 'That sign-in link has been used or has run out. Ask for a new one.', 410); }
    } else {
      $login = row('SELECT * FROM logins WHERE req_hash = ?', array(h($req)));
      if (!$login || $login['used'] || $login['expires'] < now()) fail('expired', 'That code has been used or has run out. Ask for a new sign-in email.', 410);
      if ((int) $login['tries'] >= 5) fail('expired', 'Too many wrong codes. Ask for a new sign-in email.', 410);
      if (!hash_equals($login['code_hash'], h($req . ':' . $code))) {
        q('UPDATE logins SET tries = tries + 1 WHERE id = ?', array($login['id']));
        note('try:' . who());
        fail('code', 'That code isn’t right. Check the newest email and try again.');
      }
    }
    q('UPDATE logins SET used = 1 WHERE id = ?', array($login['id']));
    $user = row('SELECT id, email, name FROM users WHERE email = ?', array($login['email']));
    $new = false;
    if (!$user) {
      q('INSERT INTO users (email, created) VALUES (?, ?)', array($login['email'], now()));
      $user = array('id' => (int) db()->lastInsertId(), 'email' => $login['email'], 'name' => '');
      $new = true;
    }
    $sid = b64(random_bytes(32));
    $exp = now() + SESSION_DAYS * 86400;
    q('INSERT INTO sessions (user_id, sid_hash, expires, seen) VALUES (?, ?, ?, ?)', array($user['id'], h($sid), $exp, now()));
    set_session_cookie($sid, $exp);
    out(array('ok' => true, 'next' => $login['next'], 'new' => $new, 'user' => me_out($user), 'groups' => my_groups((int) $user['id'])));
  }

  case 'GET me': {
    $u = current_user();
    if (!$u) out(array('ok' => true, 'user' => null));
    out(array('ok' => true, 'user' => me_out($u), 'groups' => my_groups($u['id'])));
  }

  case 'POST logout': {
    $u = current_user();
    if ($u) q('DELETE FROM sessions WHERE id = ?', array($u['sid']));
    set_session_cookie('', now() - 3600);
    out(array('ok' => true));
  }

  case 'POST logout_all': {
    $u = need_user();
    q('DELETE FROM sessions WHERE user_id = ?', array($u['id']));
    set_session_cookie('', now() - 3600);
    out(array('ok' => true));
  }

  case 'POST set_name': {
    $u = need_user();
    $name = adult_name(str($in, 'name', 60));
    if ($name === '') fail('name', 'Add your name, so the group knows who is asking.');
    q('UPDATE users SET name = ? WHERE id = ?', array($name, $u['id']));
    out(array('ok' => true, 'name' => $name));
  }

  // Deletes the account, every child's week it shared, and every group it made (for everyone in them).
  case 'POST delete_account': {
    $u = need_user();
    q('DELETE FROM users WHERE id = ?', array($u['id']));   // memberships, children, sessions and owned groups go with it
    set_session_cookie('', now() - 3600);
    out(array('ok' => true));
  }

  // ----- groups -----
  case 'POST group_create': {
    $u = need_user();
    $name = group_name(str($in, 'name', 80));
    if ($name === '') fail('name', 'Give the group a name, like “Room 12”.');
    if ($u['name'] === '') fail('yourname', 'Add your name first, so people joining know whose group it is.');
    if ((int) val('SELECT COUNT(*) FROM grp WHERE owner_id = ? AND expires > ?', array($u['id'], now())) >= MAX_OWNED) fail('limit', 'You’ve made ' . MAX_OWNED . ' groups, which is the most one person can have. Delete one first.');
    $gid = substr(preg_replace('/[^A-Za-z0-9]/', '', b64(random_bytes(18))) ?? '', 0, 14);
    if (strlen($gid) < 10) $gid = bin2hex(random_bytes(7));
    $code = new_code();
    db()->beginTransaction();
    q('INSERT INTO grp (id, name, owner_id, code_mac, code_enc, created, expires) VALUES (?, ?, ?, ?, ?, ?, ?)', array($gid, $name, $u['id'], code_mac($code), code_seal($code), now(), year_end()));
    q('INSERT INTO members (group_id, user_id, role, status, created) VALUES (?, ?, ?, ?, ?)', array($gid, $u['id'], 'owner', 'approved', now()));
    db()->commit();
    out(array('ok' => true, 'id' => $gid, 'name' => $name, 'code' => $code));
  }

  // Ask to join with a code. The owner still has to approve; until then nothing in the group can be seen.
  case 'POST group_join': {
    $u = need_user();
    if (too_many('join:' . $u['id'], 10, 3600)) fail('slow', 'Too many tries. Check the code with whoever gave it to you, and try again in an hour.', 429);
    note('join:' . $u['id']);
    if ($u['name'] === '') fail('yourname', 'Add your name, so the group knows who is asking.');
    $code = tidy_code(str($in, 'code', 40));
    $g = strlen($code) === 12 ? row('SELECT id, name, owner_id FROM grp WHERE code_mac = ? AND expires > ?', array(code_mac($code), now())) : null;
    if (!$g) fail('code', 'No group has that code. Check it with whoever gave it to you.', 404);
    $viewer = !empty($in['viewer']);
    $kid = isset($in['kid']) && is_array($in['kid']) ? $in['kid'] : null;
    $kidName = $kid ? first_name(str($kid, 'name', 40)) : '';
    if (!$viewer && $kidName === '') fail('kid', 'Add your child’s first name.');
    $m = row('SELECT id, role, status FROM members WHERE group_id = ? AND user_id = ?', array($g['id'], $u['id']));
    $isNew = !$m;
    if (!$m) {
      if ((int) val('SELECT COUNT(*) FROM members WHERE group_id = ?', array($g['id'])) >= MAX_MEMBERS) fail('limit', 'That group is full.');
      if ((int) val('SELECT COUNT(*) FROM members WHERE user_id = ?', array($u['id'])) >= MAX_JOINED) fail('limit', 'You’re in as many groups as one person can be. Leave one first.');
      q('INSERT INTO members (group_id, user_id, role, status, created) VALUES (?, ?, ?, ?, ?)', array($g['id'], $u['id'], $viewer ? 'viewer' : 'member', 'pending', now()));
      $m = array('id' => (int) db()->lastInsertId(), 'role' => $viewer ? 'viewer' : 'member', 'status' => 'pending');
    } elseif (!$viewer && $m['role'] === 'viewer') {
      q('UPDATE members SET role = ? WHERE id = ?', array('member', $m['id']));
    }
    $kidId = null;
    if (!$viewer) {
      if ((int) val('SELECT COUNT(*) FROM kids WHERE member_id = ?', array($m['id'])) >= MAX_KIDS) fail('limit', 'You’ve added ' . MAX_KIDS . ' children to this group, which is the most it takes.');
      q('INSERT INTO kids (member_id, name, now_json, next_json, updated) VALUES (?, ?, ?, ?, ?)', array($m['id'], $kidName, clean_week($kid['now'] ?? null), clean_week($kid['next'] ?? null), now()));
      $kidId = (int) db()->lastInsertId();
    }
    if ($isNew && !too_many('ask:' . $g['id'], 20, 86400)) {   // tell the owner, by name only
      note('ask:' . $g['id']);
      $owner = row('SELECT email FROM users WHERE id = ?', array($g['owner_id']));
      $url = $CFG['siteUrl'] . '/groups/?g=' . $g['id'];
      $who = $u['name'] . ($viewer ? ' (to view only)' : '');
      if ($owner) send_mail($owner['email'], $u['name'] . ' asked to join ' . $g['name'],
        "$who asked to join your group \"" . $g['name'] . "\" on " . $CFG['siteName'] . ".\n\nNobody sees the group until you approve them. Sign in to approve or decline:\n$url\n",
        email_html('Someone asked to join ' . $g['name'], '<p style="margin:0">' . htmlspecialchars($who, ENT_QUOTES, 'UTF-8') . ' asked to join your group. Nobody sees the group until you approve them.</p>', 'Approve or decline', $url, 'You’re getting this because you made this group on ' . $CFG['siteName'] . '.'));
    }
    out(array('ok' => true, 'id' => $g['id'], 'name' => $g['name'], 'status' => $m['status'], 'kid' => $kidId));
  }

  // Add or update one of your own children in a group you belong to.
  case 'POST kid_save': {
    $u = need_user();
    $gid = str($in, 'group', 30);
    $m = membership($gid, $u['id']);
    if (!$m) fail('forbidden', 'You’re not in that group.', 403);
    $kid = isset($in['kid']) && is_array($in['kid']) ? $in['kid'] : array();
    $name = first_name(str($kid, 'name', 40));
    if ($name === '') fail('kid', 'Add your child’s first name.');
    $kidId = isset($kid['id']) ? (int) $kid['id'] : 0;
    if ($kidId) {
      $mine = row('SELECT id FROM kids WHERE id = ? AND member_id = ?', array($kidId, $m['id']));
      if (!$mine) fail('gone', 'That child is no longer in the group.', 404);
      q('UPDATE kids SET name = ?, now_json = ?, next_json = ?, updated = ? WHERE id = ?', array($name, clean_week($kid['now'] ?? null), clean_week($kid['next'] ?? null), now(), $kidId));
    } else {
      if ((int) val('SELECT COUNT(*) FROM kids WHERE member_id = ?', array($m['id'])) >= MAX_KIDS) fail('limit', 'You’ve added ' . MAX_KIDS . ' children to this group, which is the most it takes.');
      q('INSERT INTO kids (member_id, name, now_json, next_json, updated) VALUES (?, ?, ?, ?, ?)', array($m['id'], $name, clean_week($kid['now'] ?? null), clean_week($kid['next'] ?? null), now()));
      $kidId = (int) db()->lastInsertId();
      if ($m['role'] === 'viewer') q('UPDATE members SET role = ? WHERE id = ?', array('member', $m['id']));
    }
    out(array('ok' => true, 'kid' => $kidId, 'name' => $m['name'], 'status' => $m['status']));
  }

  // The device a week was shared from sends its changes here. Anything no longer in a group comes back as gone.
  case 'POST sync': {
    $u = need_user();
    $kids = isset($in['kids']) && is_array($in['kids']) ? array_slice($in['kids'], 0, 40) : array();
    $done = array(); $gone = array();
    foreach ($kids as $kid) {
      if (!is_array($kid) || !isset($kid['id'])) continue;
      $kidId = (int) $kid['id'];
      $mine = row('SELECT k.id FROM kids k JOIN members m ON m.id = k.member_id JOIN grp g ON g.id = m.group_id WHERE k.id = ? AND m.user_id = ? AND g.expires > ?', array($kidId, $u['id'], now()));
      if (!$mine) { $gone[] = $kidId; continue; }
      q('UPDATE kids SET now_json = ?, next_json = ?, updated = ? WHERE id = ?', array(clean_week($kid['now'] ?? null), clean_week($kid['next'] ?? null), now(), $kidId));
      $done[] = $kidId;
    }
    out(array('ok' => true, 'done' => $done, 'gone' => $gone));
  }

  case 'POST kid_delete': {
    $u = need_user();
    $kidId = isset($in['kid']) ? (int) $in['kid'] : 0;
    q('DELETE FROM kids WHERE id = ? AND member_id IN (SELECT id FROM members WHERE user_id = ?)', array($kidId, $u['id']));
    out(array('ok' => true));
  }

  // What a member sees: first names and programs. The owner also sees who is in the group and who is waiting.
  case 'GET group': {
    $u = need_user();
    $gid = isset($_GET['g']) && is_string($_GET['g']) ? substr($_GET['g'], 0, 30) : '';
    $m = membership($gid, $u['id']);
    if (!$m) fail('forbidden', 'You’re not in that group, or it no longer exists.', 403);
    $base = array('ok' => true, 'id' => $gid, 'name' => $m['name'], 'role' => $m['role'], 'status' => $m['status'], 'expires' => (new DateTime('@' . (int) $m['expires']))->setTimezone(new DateTimeZone('America/New_York'))->format('Y-m-d'));
    if ($m['status'] !== 'approved') out($base);   // waiting: the name of the group and nothing else
    $kids = array();
    foreach (q('SELECT k.*, m.user_id FROM kids k JOIN members m ON m.id = k.member_id WHERE m.group_id = ? AND m.status = ? ORDER BY k.name COLLATE NOCASE, k.id', array($gid, 'approved')) as $k) {
      $kids[] = kid_out($k, (int) $k['user_id'] === $u['id']);
    }
    $base['kids'] = $kids;
    if ($m['role'] === 'owner') {
      $base['code'] = code_open($m['code_enc']);
      $base['members'] = array();
      foreach (q('SELECT m.id, m.role, m.status, u.name FROM members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.status DESC, m.created', array($gid)) as $x) {
        $names = array();
        foreach (q('SELECT name FROM kids WHERE member_id = ? ORDER BY id', array($x['id'])) as $k) $names[] = $k['name'];
        $base['members'][] = array('id' => (int) $x['id'], 'name' => $x['name'], 'role' => $x['role'], 'status' => $x['status'], 'kids' => $names);
      }
    }
    out($base);
  }

  case 'POST member_decide': {
    $u = need_user();
    $gid = str($in, 'group', 30);
    $g = need_owner($gid, $u);
    $mid = isset($in['member']) ? (int) $in['member'] : 0;
    $x = row('SELECT m.id, m.status, u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.id = ? AND m.group_id = ? AND m.role != ?', array($mid, $gid, 'owner'));
    if (!$x) fail('gone', 'That request is no longer there.', 404);
    if (!empty($in['approve'])) {
      if ($x['status'] !== 'approved') {
        q('UPDATE members SET status = ? WHERE id = ?', array('approved', $mid));
        $url = $CFG['siteUrl'] . '/groups/?g=' . $gid;
        send_mail($x['email'], 'You’re in: ' . $g['name'], "You've been approved to see \"" . $g['name'] . "\" on " . $CFG['siteName'] . ".\n\n$url\n",
          email_html('You’re in: ' . $g['name'], '<p style="margin:0">You’ve been approved. You can see the group’s weeks now.</p>', 'Open the group', $url, 'You’re getting this because you asked to join this group on ' . $CFG['siteName'] . '.'));
      }
    } else {
      q('DELETE FROM members WHERE id = ?', array($mid));   // declining or removing takes their children's weeks with it
    }
    out(array('ok' => true));
  }

  case 'POST group_leave': {
    $u = need_user();
    $gid = str($in, 'group', 30);
    $m = membership($gid, $u['id']);
    if (!$m) out(array('ok' => true));
    if ($m['role'] === 'owner') fail('owner', 'You made this group, so you can’t leave it. You can delete it instead.');
    q('DELETE FROM members WHERE id = ?', array($m['id']));
    out(array('ok' => true));
  }

  // A new code. People already in the group stay; the old code stops letting anyone new ask.
  case 'POST group_code': {
    $u = need_user();
    $gid = str($in, 'group', 30);
    need_owner($gid, $u);
    $code = new_code();
    q('UPDATE grp SET code_mac = ?, code_enc = ? WHERE id = ?', array(code_mac($code), code_seal($code), $gid));
    out(array('ok' => true, 'code' => $code));
  }

  case 'POST group_rename': {
    $u = need_user();
    $gid = str($in, 'group', 30);
    need_owner($gid, $u);
    $name = group_name(str($in, 'name', 80));
    if ($name === '') fail('name', 'Give the group a name.');
    q('UPDATE grp SET name = ? WHERE id = ?', array($name, $gid));
    out(array('ok' => true, 'name' => $name));
  }

  case 'POST group_delete': {
    $u = need_user();
    $gid = str($in, 'group', 30);
    need_owner($gid, $u);
    q('DELETE FROM grp WHERE id = ?', array($gid));
    out(array('ok' => true));
  }
}

fail('bad', 'That request was not understood.', 404);
