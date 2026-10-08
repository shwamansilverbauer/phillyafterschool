<?php
// Accounts and share groups for Philly After School. Copied into the site by build.mjs; edit it here.
//
// What this stores, and nothing more:
//   an account     - an email address and the adult's first and last name
//   a group        - a name, its owner, and a join code (kept encrypted)
//   an invitation  - an email address a group's owner has invited; only invited addresses can join
//   a membership   - who is in which group
//   a child        - a first name and the programs on their current and upcoming week (no school, address, note or photo)
//   a profile      - only if the person asks: the school they saved, the grades their children are in (just the
//                    grades), and a child's week (first name, programs, and the school each program is listed
//                    under, so it can be put back on another device)
//   a tally        - how many accounts, groups and so on were made each day. Numbers only, for the site's owner.
//   a claim        - for someone who runs a program: which listing their account has claimed, and whether it stands.
//                    A claim needs an account whose email address is at the listing's own website address.
//   a proposed edit - what a claimed listing's director asked to have changed. The site's owner reads and applies it.
//   a listing photo - one picture a director sent for a listing they claimed, with a line describing it. It is kept
//                    outside the public folder and shown on the listing only after the site's owner approves it.
// Everything lives in one small database file kept outside the public folder. Nothing here is ever written into a page:
// a group is only sent, as data, to a signed-in member the owner has approved.
//
// Nobody finds or asks their way into a group. Its owner invites email addresses; an invited person signs in with that
// address (which proves it is theirs) and gives the code from the invitation. Both are needed.
//
// Signing in has no passwords. The site emails a link (and a 6-digit code for the device that asked); each works once
// and for 15 minutes. Or Google vouches for the address. A device then stays signed in for 30 days.

declare(strict_types=1);

$CFG = json_decode('{"siteName":"Philly After School","siteUrl":"https://phillyafterschool.org","from":"contact@phillyafterschool.org","yearEnd":"2027-06-23","googleClientId":"420915102949-7gfu5o00gn6oionaijid2jak6om38rda.apps.googleusercontent.com","grades":["PK","K","1","2","3","4","5","6","7","8"],"listings":{"p:imagine-that-philly":{"n":"Imagine That Philly","d":"imaginethatphilly.org","m":"match"},"p:nebinger-clubs":{"n":"School clubs and teams at Nebinger","d":"philasd.org","m":"manual"},"p:girls-on-the-run":{"n":"Girls on the Run","d":"gotrphiladelphia.org","m":"match"},"p:nebinger-arts-partners":{"n":"Arts partners and Science Olympiad at Nebinger","d":"nebingerpta.org","m":"match"},"p:meredith-clubs":{"n":"Meredith after-school clubs","d":"meredithmatters.org","m":"manual"},"p:coppin-clubs":{"n":"School clubs and ensembles at Coppin","d":"philasd.org","m":"manual"},"p:zhang-sah":{"n":"Zhang Sah","d":"zhangsah.org","m":"match"},"p:shot-tower-rec":{"n":"Shot Tower Recreation Center","d":"phila.gov","m":"manual"},"p:philly-inmovement":{"n":"Philly InMovement: MOVE After School","d":"phillyinmovement.com","m":"match"},"p:settlement-kaleidoscope-plus":{"n":"Settlement Music School: Kaleidoscope Plus","d":"settlementmusic.org","m":"match"},"p:philly-art-center-qv":{"n":"Philly Art Center, Queen Village","d":"phillyartcenter.com","m":"match"},"p:old-pine":{"n":"Old Pine Community Center","d":"oldpinecommunitycenter.org","m":"match"},"p:butchers-sew-shop":{"n":"Butcher’s Sew Shop Junior","d":"butcherssewshop.com","m":"match"},"p:mister-johns-music":{"n":"Mister John’s Music","d":"misterjohnsmusic.com","m":"match"},"p:music-theatre-philly":{"n":"Music Theatre Philly","d":"musictheatrephilly.com","m":"match"},"p:arden-drama-school":{"n":"Arden Drama School","d":"ardentheatre.org","m":"match"},"p:walnut-street-theatre-school":{"n":"Walnut Street Theatre School","d":"coursestorm.com","m":"manual"},"p:coco-academy":{"n":"CoCo Academy","d":"cocoacademyphl.com","m":"match"},"p:queen-and-rook":{"n":"Queen & Rook Game Cafe","d":"queenandrookcafe.com","m":"match"},"p:beehive-at-bok":{"n":"Beehive at Bok","d":"beehiveatbok.com","m":"match"},"p:dandelion-after-school":{"n":"Dandelion After School","d":"thedandelionproject.us","m":"match"},"p:movemakers":{"n":"MoveMakers Philly","d":"movemakersphilly.com","m":"match"},"p:kids-on-12th":{"n":"Kids on 12th","d":"ko12.org","m":"match"},"p:columbus-square-rec":{"n":"Columbus Square Recreation Center","d":"phila.gov","m":"manual"},"p:hawthorne-cultural-center":{"n":"Hawthorne Cultural Center","d":"phila.gov","m":"manual"},"p:starr-garden-rec":{"n":"Starr Garden Recreation Center","d":"phila.gov","m":"manual"},"p:palumbo-rec":{"n":"Palumbo Recreation Center","d":"phila.gov","m":"manual"},"p:mighty-writers-el-futuro":{"n":"Mighty Writers El Futuro","d":"mightywriters.org","m":"match"},"p:free-library-leap":{"n":"Free Library LEAP","d":"freelibrary.org","m":"manual"},"p:fleisher-art-memorial":{"n":"Fleisher Art Memorial","d":"fleisher.org","m":"match"},"p:makom-community":{"n":"Makom Community","d":"makomcommunity.org","m":"match"},"p:vare-washington-edey":{"n":"Extended Day, Extended Year at Vare-Washington","d":"phila.gov","m":"manual"},"p:vare-washington-clubs":{"n":"School clubs and teams at Vare-Washington","d":"philasd.org","m":"manual"},"p:sunrise-mccall":{"n":"Sunrise of Philadelphia at McCall","d":"sunriseofphila.org","m":"match"},"p:mccall-clubs":{"n":"McCall clubs and teams","d":"philasd.org","m":"manual"},"p:sawubona-creativity-project":{"n":"Sawubona Creativity Project","d":"sawubonacreativityproject.org","m":"match"},"p:playarts-day-camps":{"n":"PlayArts day camps","d":"playartsphilly.com","m":"match"},"p:philly-rock-gym-day-camps":{"n":"Philadelphia Rock Gym","d":"philarockgym.com","m":"match"},"p:skate-the-foundry":{"n":"Skate The Foundry","d":"skatethefoundry.com","m":"match"},"p:pafa-saturday-art":{"n":"PAFA Saturday Studio Art","d":"pafa.org","m":"match"},"p:moore-young-artists-workshop":{"n":"Moore Young Artists Workshop","d":"moore.edu","m":"manual"},"p:philadelphia-museum-of-art-kids":{"n":"Philadelphia Museum of Art: Art Kids Classes","d":"philamuseum.org","m":"match"},"p:made-institute-sunday-sewing":{"n":"MADE Institute: Sunday Sewing","d":"made-institute.com","m":"match"},"p:rock-school-for-dance":{"n":"The Rock School for Dance Education","d":"therockschool.org","m":"match"},"p:koresh-school-of-dance":{"n":"Koresh School of Dance","d":"koreshdance.org","m":"match"},"p:school-of-philadelphia-ballet":{"n":"School of Philadelphia Ballet","d":"philadelphiaballet.org","m":"match"},"p:zazz-dance":{"n":"ZAZZ","d":"zazzphilly.com","m":"match"},"p:temple-music-prep-cmsp":{"n":"Temple Music Prep: Community Music Scholars","d":"temple.edu","m":"manual"},"p:wissahickon-skating-club":{"n":"Wissahickon Skating Club","d":"wissskating.com","m":"match"},"p:penn-ice-rink":{"n":"Penn Ice Rink","d":"upenn.edu","m":"manual"},"p:starfinder-saturday-soccer":{"n":"Starfinder: Saturday soccer","d":"starfinderfoundation.org","m":"match"},"p:franklin-institute-pacts":{"n":"The Franklin Institute: PACTS","d":"fi.edu","m":"manual"},"p:macguffin-theatre":{"n":"MacGuffin Theatre & Film Company","d":"macguffintf.com","m":"match"},"c:philly-art-center":{"n":"Philly Art Center (summer camp)","d":"phillyartcenter.com","m":"match"},"c:fleisher-art-memorial-camp":{"n":"Fleisher Art Memorial (summer camp)","d":"fleisher.org","m":"match"},"c:mister-johns-music-camp":{"n":"Mister John’s Music (summer camp)","d":"misterjohnsmusic.com","m":"match"},"c:music-theatre-philly-camp":{"n":"Music Theatre Philly (summer camp)","d":"musictheatrephilly.com","m":"match"},"c:movemakers-camp":{"n":"MoveMakers Philly (summer camp)","d":"movemakersphilly.com","m":"match"},"c:queen-and-rook-camp":{"n":"Queen & Rook Game Cafe (summer camp)","d":"queenrookkeep.com","m":"match"},"c:parks-and-rec-camps":{"n":"Philadelphia Parks & Recreation day camps (summer camp)","d":"phila.gov","m":"manual"},"c:theatre-horizon-woodmere":{"n":"Theatre Horizon drama camp at Woodmere (summer camp)","d":"theatrehorizon.org","m":"match"},"c:butchers-sew-shop-camp":{"n":"Butcher’s Sew Shop Junior (summer camp)","d":"jumbula.com","m":"manual"},"c:clay-studio-camp":{"n":"The Clay Studio (summer camp)","d":"theclaystudio.org","m":"match"},"c:pafa-camp":{"n":"PAFA summer art camp (summer camp)","d":"pafa.org","m":"match"},"c:moore-young-artists":{"n":"Moore College of Art & Design youth courses (summer camp)","d":"moore.edu","m":"manual"},"c:school-of-rock-philadelphia":{"n":"School of Rock Philadelphia (summer camp)","d":"schoolofrock.com","m":"manual"},"c:arden-summer-camp":{"n":"Arden Drama School (summer camp)","d":"ardentheatre.org","m":"match"},"c:camp-walnut":{"n":"Camp Walnut at Walnut Street Theatre (summer camp)","d":"coursestorm.com","m":"manual"},"c:macguffin-camps":{"n":"MacGuffin Theatre & Film Company (summer camp)","d":"macguffintf.com","m":"match"},"c:flipout-camp":{"n":"FlipOut Productions (summer camp)","d":"flipoutproductions.com","m":"match"},"c:philadelphia-ballet-camps":{"n":"School of Philadelphia Ballet dance camps (summer camp)","d":"philadelphiaballet.org","m":"match"},"c:wissahickon-figure-skating":{"n":"Wissahickon Skating Club figure skating camp (summer camp)","d":"wissskating.com","m":"match"},"c:philadelphia-dance-academy":{"n":"The Philadelphia Dance Academy (summer camp)","d":"philadelphiadanceacademy.com","m":"match"},"c:legacy-tennis-camp":{"n":"Legacy Youth Tennis community camp (summer camp)","d":"legacyyte.org","m":"match"},"c:ceo-camp-phield-house":{"n":"C.E.O. Camp at Phield House (summer camp)","d":"phieldhouse.com","m":"match"},"c:awbury-adventures":{"n":"Awbury Adventures at Awbury Arboretum (summer camp)","d":"awbury.org","m":"match"},"c:camp-schuylkill":{"n":"Camp Schuylkill at the Schuylkill Center (summer camp)","d":"schuylkillcenter.org","m":"match"},"c:morris-arboretum-camp":{"n":"Nature Explorers at Morris Arboretum & Gardens (summer camp)","d":"morrisarboretum.org","m":"match"},"c:circus-arts-camp":{"n":"Philadelphia School of Circus Arts (summer camp)","d":"phillycircus.com","m":"match"},"c:work-to-ride-camp":{"n":"Work to Ride at Chamounix Equestrian Center (summer camp)","d":"worktoride.net","m":"match"},"c:seaport-summer-camp":{"n":"Seaport Summer Camp at Independence Seaport Museum (summer camp)","d":"phillyseaport.org","m":"match"},"c:taller-puertorriqueno-camp":{"n":"Taller Puertorriqueño (summer camp)","d":"tallerpr.org","m":"match"},"c:camp-tps":{"n":"Camp TPS at The Philadelphia School (summer camp)","d":"tpschool.org","m":"match"},"c:ymca-day-camps":{"n":"Greater Philadelphia YMCA day camps (summer camp)","d":"philaymca.org","m":"manual"},"c:summer-achievers-edey":{"n":"Summer Achievers at Extended Day, Extended Year schools (summer camp)","d":"phila.gov","m":"manual"},"c:allens-lane-art-camp":{"n":"Allens Lane Art Center summer art camp (summer camp)","d":"allenslane.org","m":"match"},"c:nlarts-summer-camp":{"n":"NLArts summer art camp (summer camp)","d":"nlarts.org","m":"match"},"c:yes-and-camp":{"n":"Yes! And… Collaborative Arts camps (summer camp)","d":"yesandcamp.org","m":"match"},"c:zazz-summer-camp":{"n":"ZAZZ Dance & Drama (summer camp)","d":"zazzphilly.com","m":"match"},"c:sawubona-summer-camp":{"n":"Sawubona Creativity Project (summer camp)","d":"sawubonacreativityproject.org","m":"match"},"c:zoomdance-camp":{"n":"ZoomDance camp (summer camp)","d":"zoomdance.com","m":"match"},"c:dandelion-summer-camp":{"n":"The Dandelion Project summer camp (summer camp)","d":"thedandelionproject.us","m":"match"},"c:rutabaga-naturearts":{"n":"Rutabaga NatureArts summer camp (summer camp)","d":"rutabagatoylibrary.com","m":"match"},"c:skate-the-foundry-camp":{"n":"Skate The Foundry skateboard camp (summer camp)","d":"skatethefoundry.com","m":"match"},"c:lavner-tech-camp-upenn":{"n":"Camp Tech Revolution at UPenn (Lavner) (summer camp)","d":"lavnercampsandprograms.com","m":"match"},"c:philly-rock-gym-camps":{"n":"Philadelphia Rock Gym summer camps (summer camp)","d":"philarockgym.com","m":"match"},"c:coco-academy-summer-camp":{"n":"CoCo Academy (summer camp)","d":"cocoacademyphl.com","m":"match"}},"camps":["philly-art-center","fleisher-art-memorial-camp","mister-johns-music-camp","music-theatre-philly-camp","movemakers-camp","queen-and-rook-camp","parks-and-rec-camps","theatre-horizon-woodmere","butchers-sew-shop-camp","clay-studio-camp","pafa-camp","moore-young-artists","school-of-rock-philadelphia","arden-summer-camp","camp-walnut","macguffin-camps","flipout-camp","philadelphia-ballet-camps","wissahickon-figure-skating","philadelphia-dance-academy","legacy-tennis-camp","ceo-camp-phield-house","awbury-adventures","camp-schuylkill","morris-arboretum-camp","circus-arts-camp","work-to-ride-camp","seaport-summer-camp","taller-puertorriqueno-camp","camp-tps","ymca-day-camps","summer-achievers-edey","allens-lane-art-camp","nlarts-summer-camp","yes-and-camp","zazz-summer-camp","sawubona-summer-camp","zoomdance-camp","dandelion-summer-camp","rutabaga-naturearts","skate-the-foundry-camp","lavner-tech-camp-upenn","philly-rock-gym-camps","coco-academy-summer-camp"],"photos":false}', true);
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
const MAX_INVITES = 60;     // addresses one group can have invited
const MAX_SOLO = 12;        // "share this week with one person" lists one account can have (one per child)
const MAX_WEEKS = 6;        // children's weeks one profile can hold
const MAX_CLAIMS = 12;      // listings one account can claim
const MAX_CLAIMANTS = 5;    // accounts that can hold a claim on one listing
const SPACE_DAYS = 30;      // how long "spots open", "waitlist" or "full" stays up before the manager has to say it again
const BACKUP_DAYS = 14;      // how many daily copies of the database are kept
const PHOTO_BYTES = 1600000; // the biggest listing photo accepted, after the browser has shrunk it
const DAYS = array('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
const WEEKEND = array('sat', 'sun');   // weekend picks are a program with weekend classes: no school, no pickup

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
    $db->exec('CREATE TABLE IF NOT EXISTS invites (id INTEGER PRIMARY KEY, group_id TEXT NOT NULL REFERENCES grp(id) ON DELETE CASCADE, email TEXT NOT NULL, created INTEGER NOT NULL, UNIQUE (group_id, email))');
    $db->exec('CREATE TABLE IF NOT EXISTS throttle (k TEXT NOT NULL, t INTEGER NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS weeks (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, now_json TEXT NOT NULL, next_json TEXT NOT NULL, updated INTEGER NOT NULL)');
    $hadTally = (bool) $db->query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tally'")->fetchColumn();
    $db->exec('CREATE TABLE IF NOT EXISTS tally (k TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (k, day))');
    // Added after the first version: first and last name, and whether the account has been added to the email list.
    $cols = array();
    foreach ($db->query('PRAGMA table_info(users)') as $c) $cols[] = $c['name'];
    foreach (array('first' => "TEXT NOT NULL DEFAULT ''", 'last' => "TEXT NOT NULL DEFAULT ''", 'listed' => 'INTEGER NOT NULL DEFAULT 0', 'school' => "TEXT NOT NULL DEFAULT ''", 'via' => "TEXT NOT NULL DEFAULT 'email'", 'grades' => "TEXT NOT NULL DEFAULT ''") as $col => $type) {
      if (!in_array($col, $cols, true)) $db->exec('ALTER TABLE users ADD COLUMN ' . $col . ' ' . $type);
    }
    // A group made by "share this week with one person" is marked, so joining it skips the question about whose week to add.
    $gcols = array();
    foreach ($db->query('PRAGMA table_info(grp)') as $c) $gcols[] = $c['name'];
    if (!in_array('solo', $gcols, true)) $db->exec('ALTER TABLE grp ADD COLUMN solo INTEGER NOT NULL DEFAULT 0');
    $db->exec('CREATE INDEX IF NOT EXISTS weeks_user ON weeks (user_id)');
    // "Is there space?": what a listing's own manager last said. One row per listing; it stops showing after SPACE_DAYS.
    $db->exec("CREATE TABLE IF NOT EXISTS space (listing TEXT PRIMARY KEY, state TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, updated INTEGER NOT NULL)");
    // A summer schedule kept in a profile: one per account. Each child's first name and their camps by week, nothing else.
    $db->exec('CREATE TABLE IF NOT EXISTS summers (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, year INTEGER NOT NULL, json TEXT NOT NULL, updated INTEGER NOT NULL)');
    // A days-off plan kept in a profile: one per account. Each child's first name and where they'll be on each day school is closed.
    $db->exec('CREATE TABLE IF NOT EXISTS daysoffs (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, year INTEGER NOT NULL, json TEXT NOT NULL, updated INTEGER NOT NULL)');
    // Directors: a claim on a listing ("p:<program id>" or "c:<camp id>") and the changes a director has proposed for it.
    $db->exec("CREATE TABLE IF NOT EXISTS claims (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, listing TEXT NOT NULL, status TEXT NOT NULL, domain TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, decided INTEGER NOT NULL DEFAULT 0, UNIQUE (user_id, listing))");
    $db->exec("CREATE TABLE IF NOT EXISTS edits (id INTEGER PRIMARY KEY, claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE, listing TEXT NOT NULL, body TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', created INTEGER NOT NULL, decided INTEGER NOT NULL DEFAULT 0)");
    $db->exec('CREATE INDEX IF NOT EXISTS claims_listing ON claims (listing, status)');
    $db->exec("CREATE TABLE IF NOT EXISTS photos (id INTEGER PRIMARY KEY, claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE, listing TEXT NOT NULL, alt TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created INTEGER NOT NULL, decided INTEGER NOT NULL DEFAULT 0)");
    $db->exec('CREATE INDEX IF NOT EXISTS photos_listing ON photos (listing, status)');
    if (!$hadTally) {   // start the daily counts from what is already here
      $day = "strftime('%Y-%m-%d', created, 'unixepoch', '-4 hours')";
      $db->exec("INSERT OR IGNORE INTO tally (k, day, n) SELECT 'account', $day, COUNT(*) FROM users GROUP BY 2");
      $db->exec("INSERT OR IGNORE INTO tally (k, day, n) SELECT 'group', $day, COUNT(*) FROM grp GROUP BY 2");
      $db->exec("INSERT OR IGNORE INTO tally (k, day, n) SELECT 'invite', $day, COUNT(*) FROM invites GROUP BY 2");
      $db->exec("INSERT OR IGNORE INTO tally (k, day, n) SELECT 'join', $day, COUNT(*) FROM members WHERE role != 'owner' GROUP BY 2");
    }
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
// One more of something today, for the owner's numbers page. No names, no addresses: a word, a date and a count.
function bump(string $k): void {
  try { q('INSERT INTO tally (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k, day) DO UPDATE SET n = n + 1', array($k, (new DateTime('now', new DateTimeZone('America/New_York')))->format('Y-m-d'))); } catch (Exception $e) { /* counting never gets in the way */ }
}

// Now and then, clear out what has expired: used links, old sessions, and groups past the end of the school year.
function tidy(): void {
  if (random_int(1, 40) !== 1) return;
  $t = now();
  q('DELETE FROM logins WHERE expires < ?', array($t - 3600));
  q('DELETE FROM sessions WHERE expires < ?', array($t));
  q('DELETE FROM throttle WHERE t < ?', array($t - 2 * 86400));
  q('DELETE FROM grp WHERE expires < ?', array($t));
  // Photo files whose record has gone (a deleted account, a replaced or declined photo).
  $dir = data_dir() . '/photos';
  if (is_dir($dir)) foreach ((array) @scandir($dir) as $f) {
    if (preg_match('/^(\d+)\.jpg$/', (string) $f, $m) && !val("SELECT 1 FROM photos WHERE id = ? AND status != 'declined'", array((int) $m[1]))) @unlink($dir . '/' . $f);
  }
}

// ---------- a copy of the database, once a day ----------
// The first request of each day writes a clean copy of the database into backups/, next to it and outside the public
// folder, and the oldest copies beyond BACKUP_DAYS are removed. A copy made this way is whole even while the site is
// being used, which a plain file copy of a database in use may not be. The host's own nightly backup then carries
// these copies off the server. To go back to one: replace groups.sqlite with it (and delete groups.sqlite-wal and
// groups.sqlite-shm if they are there).
function today_ny(): string { return (new DateTime('now', new DateTimeZone('America/New_York')))->format('Y-m-d'); }
function backup_dir(): string { return data_dir() . '/backups'; }
function last_backup(): string {
  $days = array();
  foreach ((array) @scandir(backup_dir()) as $f) if (preg_match('/^groups-(\d{4}-\d{2}-\d{2})\.sqlite$/', (string) $f, $m)) $days[] = $m[1];
  return $days ? max($days) : '';
}
function backup(): void {
  $dir = backup_dir();
  $file = $dir . '/groups-' . today_ny() . '.sqlite';
  if (is_file($file)) return;
  try {
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return;
    $part = $dir . '/part-' . bin2hex(random_bytes(6)) . '.tmp';
    try {
      db()->exec('VACUUM INTO ' . db()->quote($part));
    } catch (Exception $e) {
      // An older SQLite has no VACUUM INTO: fold the log into the file, then copy it while nothing else can write.
      @unlink($part);
      db()->exec('PRAGMA wal_checkpoint(TRUNCATE)');
      db()->exec('BEGIN IMMEDIATE');
      $copied = @copy(data_dir() . '/groups.sqlite', $part);
      db()->exec('COMMIT');
      if (!$copied) { @unlink($part); return; }
    }
    @chmod($part, 0600);
    if (is_file($file) || !@rename($part, $file)) @unlink($part);   // another request got there first
    $old = array();
    foreach ((array) @scandir($dir) as $f) {
      if (preg_match('/^groups-\d{4}-\d{2}-\d{2}\.sqlite$/', (string) $f)) $old[] = (string) $f;
      elseif (preg_match('/^part-[0-9a-f]+\.tmp$/', (string) $f) && (int) @filemtime($dir . '/' . $f) < now() - 3600) @unlink($dir . '/' . $f);
    }
    rsort($old);
    foreach (array_slice($old, BACKUP_DAYS) as $f) @unlink($dir . '/' . $f);
  } catch (Exception $e) { /* a copy that fails never gets in the way of the site; the health check reports its age */ }
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
  $raw = (string) file_get_contents('php://input', false, null, 0, $action === 'photo_add' ? 2400000 : 60000);
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
// An adult's first or last name: letters, spaces, hyphens, apostrophes and periods.
function person_name(string $v, int $max): string {
  $v = preg_replace('/[^\p{L}\p{M} \'’.-]+/u', '', $v) ?? '';
  return trim(mb_substr(trim(preg_replace('/\s+/u', ' ', $v) ?? ''), 0, $max, 'UTF-8'));
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
  $s = row('SELECT s.id AS sid, s.expires, s.seen, u.id, u.email, u.name, u.first, u.last, u.listed, u.school, u.grades FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.sid_hash = ? AND s.expires > ?', array(h($sid), now()));
  if (!$s) return null;
  if ($s['seen'] < now() - 86400) {   // once a day, push the 30 days out again
    $exp = now() + SESSION_DAYS * 86400;
    q('UPDATE sessions SET seen = ?, expires = ? WHERE id = ?', array(now(), $exp, $s['sid']));
    set_session_cookie($sid, $exp);
  }
  $user = array('id' => (int) $s['id'], 'email' => $s['email'], 'name' => $s['name'], 'first' => $s['first'], 'last' => $s['last'], 'listed' => (int) $s['listed'], 'school' => (string) $s['school'], 'grades' => (string) $s['grades'], 'sid' => (int) $s['sid']);
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
    . '<tr><td style="background:#96C9FF;color:#0B2140;border-radius:14px 14px 0 0;padding:16px 24px;font-weight:bold;font-size:16px"><span style="display:inline-block;width:24px;height:13px;background:#F3C613;border-radius:4px 6px 3px 3px;vertical-align:middle;margin-right:9px"></span>' . $e($CFG['siteName']) . '</td></tr>'
    . '<tr><td style="padding:24px"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">' . $e($heading) . '</h1>'
    . '<div style="font-size:16px;line-height:1.5">' . $lines . '</div>'
    . ($button !== '' ? '<p style="margin:22px 0"><a href="' . $e($url) . '" style="display:inline-block;background:#0B2140;color:#FFFFFF;font-weight:bold;text-decoration:none;border-radius:999px;padding:13px 26px;font-size:16px">' . $e($button) . '</a></p>' : '')
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
    if (is_array($x) && isset($x['id']) && is_string($x['id'])) $p[$x['id']] = array(
      'offers' => isset($x['offers']) && is_array($x['offers']) ? $x['offers'] : array(),
      'schools' => isset($x['schools']) && is_array($x['schools']) ? array_map('strval', array_keys($x['schools'])) : array(),
      'weekend' => (isset($x['weekend']) && is_array($x['weekend']) && isset($x['weekend']['days']) && is_array($x['weekend']['days'])) ? $x['weekend']['days'] : array());
  }
  return $p;
}
function schools(): array {
  static $s = null;
  if ($s !== null) return $s;
  $s = array();
  $list = json_decode((string) @file_get_contents($_SERVER['DOCUMENT_ROOT'] . '/data/schools.json'), true);
  if (is_array($list)) foreach ($list as $x) { if (is_array($x) && isset($x['id']) && is_string($x['id'])) $s[] = $x['id']; }
  return $s;
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
      if (in_array($d, WEEKEND, true) && !in_array($d, $known[$id]['weekend'], true)) continue; // and on a weekend, only ones with classes that day
      $cls = isset($parts[1]) && in_array($parts[1], $known[$id]['offers'], true) ? $parts[1] : '';   // free-text notes never leave the device
      $entry = $cls === '' ? $id : $id . '~' . $cls;
      if (!in_array($entry, $out[$d], true)) $out[$d][] = $entry;
    }
  }
  return json_encode($out);
}
// A week saved to someone's own profile also keeps which school each program was picked under ("program.school"),
// because that is what puts it back on another device. Still no free-text notes.
function clean_week_full($w): string {
  $known = programs();
  $out = array();
  foreach (DAYS as $d) {
    $out[$d] = array();
    if (!is_array($w) || !isset($w[$d]) || !is_array($w[$d])) continue;
    foreach (array_slice($w[$d], 0, 8) as $e) {
      if (!is_string($e)) continue;
      $parts = explode('~', $e, 2);
      if (in_array($d, WEEKEND, true)) {   // a weekend pick has no school: just the program, if it runs on weekends
        if (!isset($known[$parts[0]]) || !in_array($d, $known[$parts[0]]['weekend'], true)) continue;
        $wcls = isset($parts[1]) && in_array($parts[1], $known[$parts[0]]['offers'], true) ? $parts[1] : '';
        $wentry = $parts[0] . ($wcls === '' ? '' : '~' . $wcls);
        if (count($out[$d]) < 6 && !in_array($wentry, $out[$d], true)) $out[$d][] = $wentry;
        continue;
      }
      $key = explode('.', $parts[0], 2);
      if (count($key) !== 2 || !isset($known[$key[0]]) || !in_array($key[1], $known[$key[0]]['schools'], true)) continue;
      $cls = isset($parts[1]) && in_array($parts[1], $known[$key[0]]['offers'], true) ? $parts[1] : '';
      $entry = $parts[0] . ($cls === '' ? '' : '~' . $cls);
      if (!in_array($entry, $out[$d], true)) $out[$d][] = $entry;
    }
  }
  return json_encode($out);
}
function week_out(array $w): array {
  return array('id' => (int) $w['id'], 'name' => $w['name'], 'now' => json_decode($w['now_json'], true), 'next' => json_decode($w['next_json'], true), 'updated' => (int) $w['updated']);
}
function grade_list(string $kept): array { return $kept === '' ? array() : explode(',', $kept); }
// A summer for the profile: the year, and for each child a first name and the camps picked for each week (the week's
// Monday). Only camps the site lists, only dates in that year. No ages, no titles, no photos: those stay on the device.
function clean_summer($s): ?array {
  global $CFG;
  if (!is_array($s)) return null;
  $year = isset($s['y']) && is_int($s['y']) ? $s['y'] : 0;
  if ($year < 2024 || $year > 2100) return null;
  $known = isset($CFG['camps']) && is_array($CFG['camps']) ? $CFG['camps'] : array();
  $kids = array();
  foreach (isset($s['kids']) && is_array($s['kids']) ? array_slice($s['kids'], 0, MAX_KIDS) : array() as $k) {
    if (!is_array($k)) continue;
    $w = array();
    foreach (isset($k['w']) && is_array($k['w']) ? array_slice($k['w'], 0, 20, true) : array() as $d => $ids) {
      if (!is_string($d) || !preg_match('/^' . $year . '-\d{2}-\d{2}$/', $d) || !is_array($ids)) continue;
      $keep = array();
      foreach (array_slice($ids, 0, 6) as $id) { if (is_string($id) && in_array($id, $known, true) && !in_array($id, $keep, true)) $keep[] = $id; }
      if ($keep) $w[$d] = $keep;
    }
    $kids[] = array('name' => first_name(str($k, 'name', 40)), 'w' => (object) $w);
  }
  return $kids ? array($year, json_encode(array('kids' => $kids))) : null;
}
function summer_out(int $uid): ?array {
  $s = row('SELECT year, json, updated FROM summers WHERE user_id = ?', array($uid));
  if (!$s) return null;
  $d = json_decode($s['json'], true);
  $kids = array();
  foreach (is_array($d) && isset($d['kids']) && is_array($d['kids']) ? $d['kids'] : array() as $k) {
    $kids[] = array('name' => isset($k['name']) ? (string) $k['name'] : '', 'w' => (object) (isset($k['w']) && is_array($k['w']) ? $k['w'] : array()));   // an empty set of weeks stays an object, not a list
  }
  return array('y' => (int) $s['year'], 'kids' => $kids, 'updated' => (int) $s['updated']);
}
// A days-off plan for the profile: the school year (the year it starts), and for each child a first name and, for each
// day school is closed, one listed program or "home". Notes, titles and photos stay on the device.
function clean_daysoff($s): ?array {
  if (!is_array($s)) return null;
  $year = isset($s['y']) && is_int($s['y']) ? $s['y'] : 0;
  if ($year < 2024 || $year > 2100) return null;
  $known = programs();
  $kids = array();
  foreach (isset($s['kids']) && is_array($s['kids']) ? array_slice($s['kids'], 0, MAX_KIDS) : array() as $k) {
    if (!is_array($k)) continue;
    $d = array();
    foreach (isset($k['d']) && is_array($k['d']) ? array_slice($k['d'], 0, 120, true) : array() as $day => $id) {
      if (!is_string($day) || !preg_match('/^(' . $year . '|' . ($year + 1) . ')-\d{2}-\d{2}$/', $day) || !is_string($id)) continue;
      if ($id === 'home' || isset($known[$id])) $d[$day] = $id;
    }
    $kids[] = array('name' => first_name(str($k, 'name', 40)), 'd' => (object) $d);
  }
  return $kids ? array($year, json_encode(array('kids' => $kids))) : null;
}
function daysoff_out(int $uid): ?array {
  $s = row('SELECT year, json, updated FROM daysoffs WHERE user_id = ?', array($uid));
  if (!$s) return null;
  $d = json_decode($s['json'], true);
  $kids = array();
  foreach (is_array($d) && isset($d['kids']) && is_array($d['kids']) ? $d['kids'] : array() as $k) {
    $kids[] = array('name' => isset($k['name']) ? (string) $k['name'] : '', 'd' => (object) (isset($k['d']) && is_array($k['d']) ? $k['d'] : array()));   // an empty plan stays an object, not a list
  }
  return array('y' => (int) $s['year'], 'kids' => $kids, 'updated' => (int) $s['updated']);
}
function profile_out(array $u): array {
  $weeks = array();
  foreach (q('SELECT * FROM weeks WHERE user_id = ? ORDER BY id', array($u['id'])) as $w) $weeks[] = week_out($w);
  return array('school' => $u['school'], 'grades' => grade_list(isset($u['grades']) ? (string) $u['grades'] : ''), 'weeks' => $weeks, 'summer' => summer_out((int) $u['id']), 'daysoff' => daysoff_out((int) $u['id']));
}
function kid_out(array $k, bool $mine): array {
  return array('id' => (int) $k['id'], 'name' => $k['name'], 'now' => json_decode($k['now_json'], true), 'next' => json_decode($k['next_json'], true), 'mine' => $mine);
}

function membership(string $gid, int $uid): ?array {
  return row('SELECT m.id, m.role, m.status, g.name, g.owner_id, g.expires, g.code_enc, g.solo FROM members m JOIN grp g ON g.id = m.group_id WHERE m.group_id = ? AND m.user_id = ? AND g.expires > ?', array($gid, $uid, now()));
}
// A group can only be joined from an email address its owner invited. Signing in proves the address.
function invited(string $gid, string $email): bool {
  return (bool) row('SELECT 1 AS x FROM invites WHERE group_id = ? AND email = ?', array($gid, strtolower($email)));
}
function not_invited(array $u): void {
  fail('notinvited', 'That code is for a group that hasn’t invited ' . $u['email'] . '. Sign in with the address your invitation was sent to, or ask the person who invited you to add this one.', 403);
}
function invite_out(string $gid): array {
  $list = array();
  foreach (q('SELECT i.email, (SELECT COUNT(*) FROM members m JOIN users u ON u.id = m.user_id WHERE m.group_id = i.group_id AND u.email = i.email) AS joined FROM invites i WHERE i.group_id = ? ORDER BY i.created, i.id', array($gid)) as $i) {
    $list[] = array('email' => $i['email'], 'joined' => (bool) $i['joined']);
  }
  return $list;
}
function send_invite(array $u, array $g, string $gname, string $to): bool {
  global $CFG;
  $code = code_open($g['code_enc']);
  $url = $CFG['siteUrl'] . '/join/#' . $code;
  $from = $u['name'] . ' (' . $u['email'] . ')';
  $e = function ($v) { return htmlspecialchars($v, ENT_QUOTES, 'UTF-8'); };
  if (!empty($g['solo'])) {   // one week, shared with this person: they only look
    $text = "$from shared \"$gname\" with you on " . $CFG['siteName'] . ": the after-school programs their child goes to each day.\n\n"
      . "To see it, open this link and sign in with this email address ($to):\n$url\n\nIf it asks for a code: $code\n\n"
      . "It only opens for this address, and it shows a first name and programs. If you don't know " . $u['name'] . ", ignore this email.\n";
    $html = email_html($u['name'] . ' shared “' . $gname . '” with you',
      '<p style="margin:0 0 10px">' . $e($from) . ' shared the after-school programs their child goes to each day.</p>'
      . '<p style="margin:0">Sign in with this email address (' . $e($to) . '). If it asks for a code: <b style="font-family:monospace;font-size:18px">' . $e($code) . '</b></p>',
      'See the week', $url,
      'It only opens for this address, and it shows a first name and programs. If you don’t know ' . $u['name'] . ', ignore this email.');
    return send_mail($to, $u['name'] . ' shared “' . $gname . '” with you on ' . $CFG['siteName'], $text, $html);
  }
  $text = "$from invited you to the group \"$gname\" on " . $CFG['siteName'] . ", to share your children's after-school weeks with each other.\n\n"
    . "To join, open this link and sign in with this email address ($to):\n$url\n\nIf it asks for a code: $code\n\n"
    . "Only invited addresses can join, and a group shows first names and programs only. If you don't know " . $u['name'] . ", ignore this email: nothing happens unless you join.\n";
  $html = email_html($u['name'] . ' invited you to “' . $gname . '”',
    '<p style="margin:0 0 10px">' . $e($from) . ' invited you to a private group, to share your children’s after-school weeks with each other.</p>'
    . '<p style="margin:0">Sign in with this email address (' . $e($to) . '). If it asks for a code: <b style="font-family:monospace;font-size:18px">' . $e($code) . '</b></p>',
    'Join the group', $url,
    'Only invited addresses can join, and a group shows first names and programs only. If you don’t know ' . $u['name'] . ', ignore this email: nothing happens unless you join.');
  return send_mail($to, $u['name'] . ' invited you to “' . $gname . '” on ' . $CFG['siteName'], $text, $html);
}
// Put one address on a group's list and email it. Returns 'sent', 'held' (on the list, email not sent), 'full' or 'self'.
function invite_one(array $u, array $g, string $gid, string $e): string {
  if ($e === $u['email']) return 'self';   // the owner is already in
  if (!invited($gid, $e)) {
    if ((int) val('SELECT COUNT(*) FROM invites WHERE group_id = ?', array($gid)) >= MAX_INVITES) return 'full';
    q('INSERT INTO invites (group_id, email, created) VALUES (?, ?, ?)', array($gid, $e, now()));
    bump('invite');
  }
  // Limits on the emails themselves: per owner per day, and per address per day, so nobody's inbox is flooded.
  if (too_many('inv:' . $u['id'], 60, 86400) || too_many('invto:' . h($e), 3, 86400)) return 'held';
  note('inv:' . $u['id']); note('invto:' . h($e));
  return send_invite($u, $g, $g['name'], $e) ? 'sent' : 'held';
}
function need_owner(string $gid, array $u): array {
  $m = membership($gid, $u['id']);
  if (!$m || $m['role'] !== 'owner') fail('forbidden', 'Only the person who made this group can do that.', 403);
  return $m;
}
function my_groups(int $uid): array {
  $list = array();
  foreach (q('SELECT g.id, g.name, g.solo, m.role, m.status, m.id AS mid FROM members m JOIN grp g ON g.id = m.group_id WHERE m.user_id = ? AND g.expires > ? ORDER BY g.name COLLATE NOCASE', array($uid, now())) as $g) {
    $item = array('id' => $g['id'], 'name' => $g['name'], 'role' => $g['role'], 'status' => $g['status'], 'solo' => (bool) $g['solo'], 'kids' => array());
    foreach (q('SELECT id, name FROM kids WHERE member_id = ? ORDER BY id', array($g['mid'])) as $k) $item['kids'][] = array('id' => (int) $k['id'], 'name' => $k['name']);
    if ($g['role'] === 'owner') $item['waiting'] = (int) val('SELECT COUNT(*) FROM members WHERE group_id = ? AND status = ?', array($g['id'], 'pending'));
    $list[] = $item;
  }
  return $list;
}
// "ready" means the account has the first and last name every account needs before it can make or join a group.
function ready(array $u): bool { return $u['first'] !== '' && $u['last'] !== ''; }
function me_out(array $u): array {
  return array('email' => $u['email'], 'first' => $u['first'], 'last' => $u['last'], 'ready' => ready($u), 'listed' => (bool) $u['listed'],
    'school' => isset($u['school']) ? (string) $u['school'] : '', 'grades' => grade_list(isset($u['grades']) ? (string) $u['grades'] : ''), 'weeks' => isset($u['id']) ? (int) val('SELECT COUNT(*) FROM weeks WHERE user_id = ?', array($u['id'])) : 0,
    'claims' => isset($u['id']) ? (int) val("SELECT COUNT(*) FROM claims WHERE user_id = ? AND status != 'declined'", array($u['id'])) : 0);
}

// ---------- directors: claiming a listing ----------
// The build hands over every listing that can be claimed: its name, the address of its own website, and whether an
// email at that address is proof enough ("match") or the site's owner has to say yes ("manual": a city, school
// district, university or booking site, where many unrelated people share the address).
function listings(): array {
  global $CFG;
  return isset($CFG['listings']) && is_array($CFG['listings']) ? $CFG['listings'] : array();
}
// "mail.example.org" and "example.org" are the same place: compare the last two parts of each.
function base_domain(string $host): string {
  $host = strtolower(trim($host, ". \t"));
  $parts = array_values(array_filter(explode('.', $host), 'strlen'));
  return count($parts) >= 2 ? implode('.', array_slice($parts, -2)) : $host;
}
function email_domain(string $email): string {
  $at = strrpos($email, '@');
  return $at === false ? '' : base_domain(substr($email, $at + 1));
}
function claim_out(array $c): array {
  $l = listings();
  $edits = array();
  foreach (q('SELECT id, body, link, status, created FROM edits WHERE claim_id = ? ORDER BY id DESC LIMIT 20', array($c['id'])) as $e) {
    $edits[] = array('id' => (int) $e['id'], 'body' => $e['body'], 'link' => $e['link'], 'status' => $e['status'], 'created' => (int) $e['created']);
  }
  $ph = row("SELECT id, status, alt FROM photos WHERE claim_id = ? AND status != 'declined' ORDER BY id DESC LIMIT 1", array($c['id']));
  $live = photo_live($c['listing']);
  return array('listing' => $c['listing'], 'name' => isset($l[$c['listing']]) ? $l[$c['listing']]['n'] : 'A listing no longer on the site', 'status' => $c['status'], 'gone' => !isset($l[$c['listing']]), 'edits' => $edits,
    'photo' => $ph ? array('status' => $ph['status'], 'alt' => $ph['alt']) : null, 'photoLive' => $live ? (int) $live['id'] : 0, 'space' => space_of($c['listing']));
}
// What a listing's manager last said about space, while it is fresh and someone still holds the claim.
function space_of(string $key): ?array {
  $s = row("SELECT s.state, s.updated FROM space s WHERE s.listing = ? AND s.updated > ? AND EXISTS (SELECT 1 FROM claims c WHERE c.listing = s.listing AND c.status = 'ok')", array($key, now() - SPACE_DAYS * 86400));
  return $s ? array('s' => $s['state'], 't' => (int) $s['updated']) : null;
}
// The photo a listing shows: the newest approved one whose claim still stands.
function photo_live(string $key): ?array {
  return row("SELECT p.id, p.alt FROM photos p JOIN claims c ON c.id = p.claim_id WHERE p.listing = ? AND p.status = 'ok' AND c.status = 'ok' ORDER BY p.id DESC LIMIT 1", array($key));
}
function photo_file(int $id): string { return data_dir() . '/photos/' . $id . '.jpg'; }
function my_claims(int $uid): array {
  $out = array();
  foreach (q("SELECT id, listing, status FROM claims WHERE user_id = ? ORDER BY id", array($uid)) as $c) $out[] = claim_out($c);
  return $out;
}
function tell_owner(string $subject, string $text): void {
  global $CFG;
  if (empty($CFG['from'])) return;
  send_mail($CFG['from'], '[' . $CFG['siteName'] . '] ' . $subject, $text, email_html($subject, '<p style="margin:0;white-space:pre-line">' . htmlspecialchars($text, ENT_QUOTES, 'UTF-8') . '</p>', 'Open the review page', $CFG['siteUrl'] . '/edit/claims/', 'You get this because you run ' . $CFG['siteName'] . '.'));
}
// Signs this browser in as the account with this address, making the account if it is new.
function sign_in(string $email, string $via, string $next, string $first = '', string $last = ''): void {
  $user = row('SELECT id, email, name, first, last, listed, school, grades FROM users WHERE email = ?', array($email));
  $new = false;
  if (!$user) {
    q('INSERT INTO users (email, created, via) VALUES (?, ?, ?)', array($email, now(), $via));
    $user = array('id' => (int) db()->lastInsertId(), 'email' => $email, 'name' => '', 'first' => '', 'last' => '', 'listed' => 0, 'school' => '', 'grades' => '');
    $new = true;
    bump('account');
  }
  if ($user['first'] === '' && $user['last'] === '' && $first !== '' && $last !== '') {   // Google already knows their name
    q('UPDATE users SET first = ?, last = ?, name = ? WHERE id = ?', array($first, $last, $first . ' ' . $last, $user['id']));
    $user['first'] = $first; $user['last'] = $last; $user['name'] = $first . ' ' . $last;
  }
  $sid = b64(random_bytes(32));
  $exp = now() + SESSION_DAYS * 86400;
  q('INSERT INTO sessions (user_id, sid_hash, expires, seen) VALUES (?, ?, ?, ?)', array($user['id'], h($sid), $exp, now()));
  set_session_cookie($sid, $exp);
  bump('signin_' . $via);
  $user['id'] = (int) $user['id'];
  out(array('ok' => true, 'next' => $next, 'new' => $new, 'user' => me_out($user), 'groups' => my_groups($user['id'])));
}
function http_get(string $url): string {
  if (function_exists('curl_init')) {
    $c = curl_init($url);
    curl_setopt_array($c, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_FOLLOWLOCATION => false));
    $r = curl_exec($c);
    curl_close($c);
    return is_string($r) ? $r : '';
  }
  $r = @file_get_contents($url, false, stream_context_create(array('http' => array('timeout' => 8, 'ignore_errors' => true))));
  return is_string($r) ? $r : '';
}
// Google signs a short statement saying which address just signed in, for this site only. We ask Google whether the
// statement is real, then check it was made for us, is still fresh, and is about an address Google is the authority on.
function google_email(string $jwt): array {
  global $CFG;
  $client = isset($CFG['googleClientId']) ? (string) $CFG['googleClientId'] : '';
  if ($client === '') fail('google', 'Signing in with Google isn’t set up.', 404);
  if (strlen($jwt) > 4096 || !preg_match('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/', $jwt)) fail('google', 'Google didn’t confirm that sign-in. Try again, or use the email code instead.', 401);
  $base = 'https://oauth2.googleapis.com/tokeninfo';
  if (PHP_SAPI === 'cli-server' && getenv('PAS_TEST_TOKENINFO')) $base = (string) getenv('PAS_TEST_TOKENINFO');   // the local test server only
  $raw = http_get($base . '?id_token=' . rawurlencode($jwt));
  if ($raw === '') fail('google_down', 'We couldn’t reach Google to check that sign-in. Use the email code instead.', 502);
  $c = json_decode($raw, true);
  $ok = is_array($c) && isset($c['aud'], $c['iss'], $c['exp'], $c['email']) && hash_equals($client, (string) $c['aud'])
    && in_array($c['iss'], array('accounts.google.com', 'https://accounts.google.com'), true) && (int) $c['exp'] > now()
    && isset($c['email_verified']) && ($c['email_verified'] === true || $c['email_verified'] === 'true');
  if (!$ok) fail('google', 'Google didn’t confirm that sign-in. Try again, or use the email code instead.', 401);
  $email = strtolower((string) $c['email']);
  if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) fail('google', 'Google didn’t confirm that sign-in. Try again, or use the email code instead.', 401);
  // Google is only the authority on addresses it runs: Gmail, and an organisation's Google Workspace.
  $own = preg_match('/@(gmail|googlemail)\.com$/', $email) || (isset($c['hd']) && is_string($c['hd']) && $c['hd'] !== '');
  if (!$own) fail('google_other', 'That Google account uses an address Google doesn’t run (' . $email . '). Sign in with the email code instead, so we can check the address is yours.', 403);
  return array('email' => $email, 'first' => person_name(isset($c['given_name']) && is_string($c['given_name']) ? $c['given_name'] : '', 30), 'last' => person_name(isset($c['family_name']) && is_string($c['family_name']) ? $c['family_name'] : '', 40));
}
function year_end(): int {
  global $CFG;
  $t = isset($CFG['yearEnd']) ? strtotime($CFG['yearEnd'] . ' 23:59:59 America/New_York') : false;
  return ($t && $t > now() + 14 * 86400) ? $t : now() + 300 * 86400;
}

tidy();
backup();

switch ($method . ' ' . $action) {

  // ----- is everything working? Read by the site check that runs every hour. Nothing about anyone is in the answer. -----
  case 'GET health': {
    $ok = true;
    try { $n = (int) val('SELECT COUNT(*) FROM sqlite_master'); $ok = $n > 0; q('INSERT INTO throttle (k, t) VALUES (?, ?)', array('health', now())); q('DELETE FROM throttle WHERE k = ?', array('health')); }
    catch (Exception $e) { $ok = false; }
    $last = last_backup();
    $age = $last === '' ? -1 : (int) round((strtotime(today_ny()) - strtotime($last)) / 86400);
    out(array('ok' => $ok, 'database' => $ok, 'day' => today_ny(), 'backup' => $last, 'backupAgeDays' => $age, 'backupsKept' => count(glob(backup_dir() . '/groups-*.sqlite') ?: array())), $ok ? 200 : 503);
  }

  // ----- signing in -----
  case 'POST login_start': {
    $email = strtolower(str($in, 'email', 150));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('email', 'That email address doesn’t look right.');
    $next = str($in, 'next', 80);
    if (!preg_match('~^(board|account|join|summer|daysoff|calendar|managers|directors|groups(\?g=[A-Za-z0-9]{6,24})?)$~', $next)) $next = 'account';
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
    sign_in($login['email'], 'email', $login['next']);
  }

  // Signing in with Google instead of the emailed code.
  case 'POST login_google': {
    if (too_many('try:' . who(), 30, 900)) fail('slow', 'Too many tries. Wait 15 minutes and try again.', 429);
    note('try:' . who());
    $next = str($in, 'next', 80);
    if (!preg_match('~^(board|account|join|summer|daysoff|calendar|managers|directors|groups(\?g=[A-Za-z0-9]{6,24})?)$~', $next)) $next = 'account';
    $g = google_email(str($in, 'credential', 4200));
    sign_in($g['email'], 'google', $next, $g['first'], $g['last']);
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

  // Every account needs a first and last name: it is how a group's creator knows who is asking to join.
  case 'POST set_name': {
    $u = need_user();
    $first = person_name(str($in, 'first', 60), 30);
    $last = person_name(str($in, 'last', 60), 40);
    if ($first === '' || $last === '') fail('name', 'Add your first and last name.');
    q('UPDATE users SET first = ?, last = ?, name = ? WHERE id = ?', array($first, $last, $first . ' ' . $last, $u['id']));
    out(array('ok' => true, 'first' => $first, 'last' => $last));
  }

  // The browser says it has added this account to the email list, so it is not asked to again.
  case 'POST listed': {
    $u = need_user();
    q('UPDATE users SET listed = 1 WHERE id = ?', array($u['id']));
    out(array('ok' => true));
  }

  // Deletes the account, every child's week it shared, and every group it made (for everyone in them).
  case 'POST delete_account': {
    $u = need_user();
    q('DELETE FROM users WHERE id = ?', array($u['id']));   // memberships, children, saved weeks, sessions and owned groups go with it
    bump('account_deleted');
    set_session_cookie('', now() - 3600);
    out(array('ok' => true));
  }

  // ----- directors -----
  // Which listings carry a "claimed by the program" mark. Public, and only the listing keys: never who claimed them.
  case 'GET claimed': {
    $keys = array(); $photos = array();
    foreach (q("SELECT DISTINCT listing FROM claims WHERE status = 'ok'") as $r) $keys[] = $r['listing'];
    foreach ($keys as $k) { $ph = photo_live($k); if ($ph && is_file(photo_file((int) $ph['id']))) $photos[$k] = array('v' => (int) $ph['id'], 'alt' => $ph['alt']); }
    $space = array();
    foreach ($keys as $k) { $sp = space_of($k); if ($sp) $space[$k] = $sp; }
    out(array('ok' => true, 'claimed' => $keys, 'photos' => (object) $photos, 'space' => (object) $space));
  }

  // The approved photo for a listing. Public: it is what the listing page shows.
  case 'GET photo': {
    $ph = photo_live(isset($_GET['l']) && is_string($_GET['l']) ? substr($_GET['l'], 0, 90) : '');
    $file = $ph ? photo_file((int) $ph['id']) : '';
    if (!$ph || !is_file($file)) { http_response_code(404); exit; }
    header('Content-Type: image/jpeg');
    header('Cache-Control: public, max-age=604800');   // the page asks for it by version, so a new photo has a new address
    header('Content-Length: ' . filesize($file));
    header_remove('X-Robots-Tag');
    readfile($file);
    exit;
  }

  // A director sends one photo for a listing they hold. It waits for the owner; nothing shows until it is approved.
  case 'POST photo_add': {
    $u = need_user();
    if (empty($CFG['photos'])) fail('off', 'Photos on listings aren’t available yet.', 403);   // a paid extra, switched on in site.config.json
    $key = str($in, 'listing', 90);
    $c = row("SELECT id FROM claims WHERE user_id = ? AND listing = ? AND status = 'ok'", array($u['id'], $key));
    if (!$c) fail('claim', 'You can add a photo once your claim on this listing stands.', 403);
    if (empty($in['permission'])) fail('permission', 'Tick the box to say you have the right to use this photo.');
    $alt = str($in, 'alt', 160);
    if (mb_strlen($alt, 'UTF-8') < 8) fail('alt', 'Describe the photo in a few words, for people who can’t see it.');
    if (too_many('photo:' . $u['id'], 6, 86400)) fail('slow', 'That’s a lot of photos for one day. Try again tomorrow.', 429);
    $b64 = isset($in['data']) && is_string($in['data']) ? $in['data'] : '';
    $bin = strlen($b64) > 20 ? base64_decode($b64, true) : false;
    if ($bin === false || strlen($bin) < 2000) fail('photo', 'That photo didn’t come through. Try choosing it again.');
    if (strlen($bin) > PHOTO_BYTES) fail('photo', 'That photo is too big. Try a smaller one.');
    $info = @getimagesizefromstring($bin);
    if (!$info || $info[2] !== IMAGETYPE_JPEG || $info[0] < 400 || $info[1] < 300 || $info[0] > 2400 || $info[1] > 2400) fail('photo', 'That doesn’t look like a photo we can use. Try a different one, at least 400 pixels wide.');
    if (function_exists('imagecreatefromstring')) {   // draw it again, so nothing rides along inside the file
      $img = @imagecreatefromstring($bin);
      if (!$img) fail('photo', 'That photo couldn’t be read. Try a different one.');
      ob_start(); imagejpeg($img, null, 86); $bin = (string) ob_get_clean(); imagedestroy($img);
    }
    note('photo:' . $u['id']);
    $dir = data_dir() . '/photos';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) fail('storage', 'Photos are not available right now.', 503);
    foreach (q("SELECT id FROM photos WHERE claim_id = ? AND status = 'new'", array($c['id'])) as $old) @unlink(photo_file((int) $old['id']));   // a newer photo replaces one still waiting
    q("DELETE FROM photos WHERE claim_id = ? AND status = 'new'", array($c['id']));
    q('INSERT INTO photos (claim_id, listing, alt, created) VALUES (?, ?, ?, ?)', array($c['id'], $key, $alt, now()));
    $id = (int) db()->lastInsertId();
    if (@file_put_contents(photo_file($id), $bin, LOCK_EX) === false) { q('DELETE FROM photos WHERE id = ?', array($id)); fail('storage', 'The photo could not be saved. Please try again.', 503); }
    @chmod(photo_file($id), 0600);
    bump('photo_sent');
    $l = listings();
    $name = isset($l[$key]) ? $l[$key]['n'] : $key;
    tell_owner('A photo to approve: ' . $name, $u['first'] . ' ' . $u['last'] . ' <' . $u['email'] . '>, who has claimed “' . $name . '”, sent a photo for it.' . "\n\nThey describe it as: " . $alt . "\n\nThey ticked that they have the right to use it and permission from the families of any children shown. It is not on the site. Look at it and publish or decline it on the review page.");
    out(array('ok' => true, 'claims' => my_claims($u['id'])));
  }

  // The director takes their photo off the listing (a waiting one, or the one that is showing).
  case 'POST photo_drop': {
    $u = need_user();
    $c = row("SELECT id FROM claims WHERE user_id = ? AND listing = ?", array($u['id'], str($in, 'listing', 90)));
    if ($c) {
      foreach (q('SELECT id FROM photos WHERE claim_id = ?', array($c['id'])) as $old) @unlink(photo_file((int) $old['id']));
      q('DELETE FROM photos WHERE claim_id = ?', array($c['id']));
    }
    out(array('ok' => true, 'claims' => my_claims($u['id'])));
  }

  case 'GET claims': {
    $u = need_user();
    out(array('ok' => true, 'domain' => email_domain($u['email']), 'claims' => my_claims($u['id'])));
  }

  // Claim a listing. The account's email address has to be at the listing's own website address. Where that address is
  // shared by many unrelated people, the claim waits for the site's owner.
  case 'POST claim_add': {
    $u = need_user();
    if (!ready($u)) fail('name', 'Add your first and last name to your account first.');
    $key = str($in, 'listing', 90);
    $l = listings();
    if (!isset($l[$key])) fail('listing', 'That listing isn’t on the site any more.', 404);
    $want = (string) $l[$key]['d'];
    $have = email_domain($u['email']);
    if ($want === '' || $have === '' || !hash_equals($want, $have)) {
      bump('claim_mismatch');
      fail('domain', 'This listing’s website is at ' . ($want === '' ? 'an address we can’t check' : $want) . ', and you’re signed in with an address at ' . $have . '. To claim it, sign in with an email address at ' . ($want === '' ? 'its website' : $want) . '.', 403);
    }
    $mine = row('SELECT id, status FROM claims WHERE user_id = ? AND listing = ?', array($u['id'], $key));
    if ($mine && $mine['status'] !== 'declined') out(array('ok' => true, 'status' => $mine['status'], 'claims' => my_claims($u['id'])));
    if ($mine) fail('declined', 'This claim was turned down. Write to us if that looks wrong.', 403);
    if (too_many('claim:' . $u['id'], 8, 86400)) fail('slow', 'That’s a lot of claims for one day. Try again tomorrow.', 429);
    if ((int) val("SELECT COUNT(*) FROM claims WHERE user_id = ? AND status != 'declined'", array($u['id'])) >= MAX_CLAIMS) fail('limit', 'One account can claim up to ' . MAX_CLAIMS . ' listings. Write to us if you run more.');
    if ((int) val("SELECT COUNT(*) FROM claims WHERE listing = ? AND status != 'declined'", array($key)) >= MAX_CLAIMANTS) fail('limit', 'This listing already has ' . MAX_CLAIMANTS . ' people on it. Ask a colleague to give up theirs, or write to us.');
    note('claim:' . $u['id']);
    $status = $l[$key]['m'] === 'match' ? 'ok' : 'pending';
    q('INSERT INTO claims (user_id, listing, status, domain, created, decided) VALUES (?, ?, ?, ?, ?, ?)', array($u['id'], $key, $status, $have, now(), $status === 'ok' ? now() : 0));
    bump($status === 'ok' ? 'claim' : 'claim_pending');
    $who = $u['first'] . ' ' . $u['last'] . ' <' . $u['email'] . '>';
    if ($status === 'ok') tell_owner('Listing claimed: ' . $l[$key]['n'], $who . ' claimed “' . $l[$key]['n'] . '”.' . "\n\nTheir email address is at " . $have . ', the same address as the listing’s website, so the claim stands without you. You can take it away on the review page.');
    else tell_owner('A claim needs your yes: ' . $l[$key]['n'], $who . ' asked to claim “' . $l[$key]['n'] . '”.' . "\n\nTheir email address is at " . $have . ', which matches the listing’s website, but that address is shared by many people (a city, school district, university or booking site), so it waits for you. Approve or decline it on the review page.');
    out(array('ok' => true, 'status' => $status, 'claims' => my_claims($u['id'])));
  }

  case 'POST claim_drop': {
    $u = need_user();
    q("DELETE FROM claims WHERE user_id = ? AND listing = ? AND status != 'declined'", array($u['id'], str($in, 'listing', 90)));   // a declined claim stays, so it can't simply be asked for again
    out(array('ok' => true, 'claims' => my_claims($u['id'])));
  }

  // "Is there space?" A manager whose claim stands says open, waitlist or full, or takes the answer down. One of
  // three fixed words, so it goes on the listing at once, with the day it was said. It comes down by itself after
  // SPACE_DAYS, because an old "spots open" is worse than none.
  case 'POST space_set': {
    $u = need_user();
    $key = str($in, 'listing', 90);
    $c = row("SELECT id FROM claims WHERE user_id = ? AND listing = ? AND status = 'ok'", array($u['id'], $key));
    if (!$c) fail('claim', 'You can set this once your claim on this listing stands.', 403);
    $state = str($in, 'state', 12);
    if ($state === '') q('DELETE FROM space WHERE listing = ?', array($key));
    else {
      if (!in_array($state, array('open', 'waitlist', 'full'), true)) fail('state', 'Pick open, waitlist or full.');
      q('INSERT INTO space (listing, state, user_id, updated) VALUES (?, ?, ?, ?) ON CONFLICT(listing) DO UPDATE SET state = excluded.state, user_id = excluded.user_id, updated = excluded.updated', array($key, $state, $u['id'], now()));
      bump('space_set');
    }
    out(array('ok' => true, 'claims' => my_claims($u['id'])));
  }

  // A director proposes a change to a listing they have claimed. Nothing on the site changes: the owner reads it.
  case 'POST edit_add': {
    $u = need_user();
    $key = str($in, 'listing', 90);
    $c = row("SELECT id FROM claims WHERE user_id = ? AND listing = ? AND status = 'ok'", array($u['id'], $key));
    if (!$c) fail('claim', 'You can propose changes once your claim on this listing stands.', 403);
    $body = trim(mb_substr(isset($in['body']) && is_string($in['body']) ? str_replace(chr(0), '', $in['body']) : '', 0, 3000, 'UTF-8'));
    $link = str($in, 'link', 300);
    if ($link !== '' && !preg_match('~^https?://[^\s<>"]+$~i', $link)) fail('link', 'That link doesn’t look right. It should start with https://');
    if (mb_strlen($body, 'UTF-8') < 10) fail('body', 'Say what should change, in a sentence or two.');
    if (substr_count(strtolower($body), 'http') > 5) fail('body', 'That has too many links. Put the one page that shows the change in the link box.');
    if (too_many('edit:' . $u['id'], 6, 86400)) fail('slow', 'That’s a lot of changes for one day. Put the rest in one note tomorrow.', 429);
    note('edit:' . $u['id']);
    q('INSERT INTO edits (claim_id, listing, body, link, created) VALUES (?, ?, ?, ?, ?)', array($c['id'], $key, $body, $link, now()));
    bump('edit_proposed');
    $l = listings();
    $name = isset($l[$key]) ? $l[$key]['n'] : $key;
    tell_owner('Proposed change: ' . $name, $u['first'] . ' ' . $u['last'] . ' <' . $u['email'] . '>, who has claimed “' . $name . '” (' . $key . '), proposes:' . "\n\n" . $body . ($link !== '' ? "\n\nLink: " . $link : '') . "\n\nNothing on the site has changed. Mark it published or declined on the review page.");
    out(array('ok' => true, 'claims' => my_claims($u['id'])));
  }

  // ----- a profile: the school and the weeks someone chose to keep with their account -----
  case 'GET profile': {
    $u = need_user();
    out(array('ok' => true) + profile_out($u));
  }

  case 'POST school_save': {
    $u = need_user();
    $school = str($in, 'school', 60);
    if ($school !== '' && !in_array($school, schools(), true)) fail('school', 'That school isn’t one the site covers yet.');
    if ($school !== '' && $u['school'] === '') bump('school_saved');
    q('UPDATE users SET school = ? WHERE id = ?', array($school, $u['id']));
    out(array('ok' => true, 'school' => $school));
  }

  // Which grades their children are in, so lists can start there. Only the grades: not which child, and no names.
  case 'POST grades_save': {
    $u = need_user();
    $all = isset($CFG['grades']) && is_array($CFG['grades']) ? $CFG['grades'] : array();
    $asked = isset($in['grades']) && is_array($in['grades']) ? $in['grades'] : array();
    $keep = array();
    foreach ($all as $g) { if (in_array($g, $asked, true)) $keep[] = $g; }   // the site's own order, and nothing it doesn't list
    if ($keep && $u['grades'] === '') bump('grades_saved');
    q('UPDATE users SET grades = ? WHERE id = ?', array(implode(',', $keep), $u['id']));
    out(array('ok' => true, 'grades' => $keep));
  }

  // Keep one child's week with the account, or update one that is already there.
  case 'POST week_save': {
    $u = need_user();
    $w = isset($in['week']) && is_array($in['week']) ? $in['week'] : array();
    $name = first_name(str($w, 'name', 40));
    if ($name === '') fail('kid', 'Add your child’s first name first, so you can tell the weeks apart.');
    $id = isset($w['id']) ? (int) $w['id'] : 0;
    if ($id) {
      if (!row('SELECT id FROM weeks WHERE id = ? AND user_id = ?', array($id, $u['id']))) fail('gone', 'That week is no longer in your profile.', 404);
      q('UPDATE weeks SET name = ?, now_json = ?, next_json = ?, updated = ? WHERE id = ?', array($name, clean_week_full($w['now'] ?? null), clean_week_full($w['next'] ?? null), now(), $id));
    } else {
      if ((int) val('SELECT COUNT(*) FROM weeks WHERE user_id = ?', array($u['id'])) >= MAX_WEEKS) fail('limit', 'Your profile holds ' . MAX_WEEKS . ' weeks, which is the most it takes. Remove one first.');
      q('INSERT INTO weeks (user_id, name, now_json, next_json, updated) VALUES (?, ?, ?, ?, ?)', array($u['id'], $name, clean_week_full($w['now'] ?? null), clean_week_full($w['next'] ?? null), now()));
      $id = (int) db()->lastInsertId();
      bump('week_saved');
    }
    out(array('ok' => true, 'week' => week_out(row('SELECT * FROM weeks WHERE id = ?', array($id)))));
  }

  case 'POST week_delete': {
    $u = need_user();
    q('DELETE FROM weeks WHERE id = ? AND user_id = ?', array(isset($in['week']) ? (int) $in['week'] : 0, $u['id']));
    out(array('ok' => true));
  }

  // Keep the summer schedule with the account, or replace the one that's there. It is the account holder's alone:
  // nothing here can be shared, and no other action reads it.
  case 'POST summer_save': {
    $u = need_user();
    $s = clean_summer($in['summer'] ?? null);
    if (!$s) fail('summer', 'That summer couldn’t be read. Reload the page and try again.');
    $had = (bool) row('SELECT user_id FROM summers WHERE user_id = ?', array($u['id']));
    q('INSERT INTO summers (user_id, year, json, updated) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET year = excluded.year, json = excluded.json, updated = excluded.updated', array($u['id'], $s[0], $s[1], now()));
    if (!$had) bump('summer_saved');
    out(array('ok' => true, 'summer' => summer_out((int) $u['id'])));
  }

  case 'POST summer_delete': {
    $u = need_user();
    q('DELETE FROM summers WHERE user_id = ?', array($u['id']));
    out(array('ok' => true));
  }

  // The same for a days-off plan: the account holder's alone, never shared, read by no other action.
  case 'POST daysoff_save': {
    $u = need_user();
    $s = clean_daysoff($in['daysoff'] ?? null);
    if (!$s) fail('daysoff', 'That plan couldn’t be read. Reload the page and try again.');
    $had = (bool) row('SELECT user_id FROM daysoffs WHERE user_id = ?', array($u['id']));
    q('INSERT INTO daysoffs (user_id, year, json, updated) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET year = excluded.year, json = excluded.json, updated = excluded.updated', array($u['id'], $s[0], $s[1], now()));
    if (!$had) bump('daysoff_saved');
    out(array('ok' => true, 'daysoff' => daysoff_out((int) $u['id'])));
  }

  case 'POST daysoff_delete': {
    $u = need_user();
    q('DELETE FROM daysoffs WHERE user_id = ?', array($u['id']));
    out(array('ok' => true));
  }

  // Share one child's week with one person: a private list of its own, which that person can only look at.
  // The first address makes the list; later ones are added to it.
  case 'POST share_one': {
    $u = need_user();
    if (!ready($u)) fail('yourname', 'Add your first and last name on your account page first, so the person you share with knows who it’s from.');
    $email = strtolower(str($in, 'email', 150));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('email', 'That email address doesn’t look right.');
    if ($email === $u['email']) fail('email', 'That’s your own address. To see this week on another device, save it to your profile instead.');
    $gid = str($in, 'group', 30);
    $kidId = null; $made = false;
    if ($gid !== '') {
      $g = need_owner($gid, $u);
      if (empty($g['solo'])) fail('bad', 'That request was not understood.');
    } else {
      $kid = isset($in['kid']) && is_array($in['kid']) ? $in['kid'] : array();
      $kidName = first_name(str($kid, 'name', 40));
      if ($kidName === '') fail('kid', 'Add your child’s first name first.');
      if ((int) val('SELECT COUNT(*) FROM grp WHERE owner_id = ? AND solo = 1 AND expires > ?', array($u['id'], now())) >= MAX_SOLO) fail('limit', 'You’re sharing as many weeks as one account can. Stop sharing one first.');
      $gid = substr(preg_replace('/[^A-Za-z0-9]/', '', b64(random_bytes(18))) ?? '', 0, 14);
      if (strlen($gid) < 10) $gid = bin2hex(random_bytes(7));
      $code = new_code();
      $gname = group_name($kidName . '’s week');
      db()->beginTransaction();
      q('INSERT INTO grp (id, name, owner_id, code_mac, code_enc, created, expires, solo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)', array($gid, $gname, $u['id'], code_mac($code), code_seal($code), now(), year_end()));
      q('INSERT INTO members (group_id, user_id, role, status, created) VALUES (?, ?, ?, ?, ?)', array($gid, $u['id'], 'owner', 'approved', now()));
      q('INSERT INTO kids (member_id, name, now_json, next_json, updated) VALUES (?, ?, ?, ?, ?)', array((int) db()->lastInsertId(), $kidName, clean_week($kid['now'] ?? null), clean_week($kid['next'] ?? null), now()));
      $kidId = (int) db()->lastInsertId();
      db()->commit();
      bump('share');
      $made = true;
      $g = need_owner($gid, $u);
    }
    $r = invite_one($u, $g, $gid, $email);
    if ($r === 'full') fail('limit', 'That week is already shared with as many people as it takes.');
    out(array('ok' => true, 'id' => $gid, 'name' => $g['name'], 'kid' => $kidId, 'made' => $made, 'sent' => $r === 'sent', 'invites' => invite_out($gid)));
  }

  // ----- groups -----
  case 'POST group_create': {
    $u = need_user();
    $name = group_name(str($in, 'name', 80));
    if ($name === '') fail('name', 'Give the group a name, like “Room 12”.');
    if (!ready($u)) fail('yourname', 'Add your first and last name first, so people joining know whose group it is.');
    if ((int) val('SELECT COUNT(*) FROM grp WHERE owner_id = ? AND solo = 0 AND expires > ?', array($u['id'], now())) >= MAX_OWNED) fail('limit', 'You’ve made ' . MAX_OWNED . ' groups, which is the most one person can have. Delete one first.');
    $gid = substr(preg_replace('/[^A-Za-z0-9]/', '', b64(random_bytes(18))) ?? '', 0, 14);
    if (strlen($gid) < 10) $gid = bin2hex(random_bytes(7));
    $code = new_code();
    db()->beginTransaction();
    q('INSERT INTO grp (id, name, owner_id, code_mac, code_enc, created, expires) VALUES (?, ?, ?, ?, ?, ?, ?)', array($gid, $name, $u['id'], code_mac($code), code_seal($code), now(), year_end()));
    q('INSERT INTO members (group_id, user_id, role, status, created) VALUES (?, ?, ?, ?, ?)', array($gid, $u['id'], 'owner', 'approved', now()));
    db()->commit();
    bump('group');
    out(array('ok' => true, 'id' => $gid, 'name' => $name, 'code' => $code));
  }

  // Is this code right, and which group is it? Asked once someone is signed in, before they pick whose week to share.
  case 'POST group_peek': {
    $u = need_user();
    if (too_many('join:' . $u['id'], 10, 3600)) fail('slow', 'Too many tries. Check the code in your invitation, and try again in an hour.', 429);
    $code = tidy_code(str($in, 'code', 40));
    $g = strlen($code) === 12 ? row('SELECT id, name, solo FROM grp WHERE code_mac = ? AND expires > ?', array(code_mac($code), now())) : null;
    if (!$g) { note('join:' . $u['id']); fail('code', 'No group has that code. Check it against your invitation email.', 404); }
    $m = row('SELECT status FROM members WHERE group_id = ? AND user_id = ?', array($g['id'], $u['id']));
    if (!$m && !invited($g['id'], $u['email'])) { note('join:' . $u['id']); not_invited($u); }
    out(array('ok' => true, 'id' => $g['id'], 'name' => $g['name'], 'solo' => (bool) $g['solo'], 'member' => (bool) $m, 'status' => $m ? $m['status'] : ''));
  }

  // Join a group: the code from the invitation, from an address the owner invited. Both, or nothing.
  case 'POST group_join': {
    $u = need_user();
    if (too_many('join:' . $u['id'], 10, 3600)) fail('slow', 'Too many tries. Check the code in your invitation, and try again in an hour.', 429);
    if (!ready($u)) fail('yourname', 'Add your first and last name, so the group knows who you are.');
    note('join:' . $u['id']);
    $code = tidy_code(str($in, 'code', 40));
    $g = strlen($code) === 12 ? row('SELECT id, name, owner_id, solo FROM grp WHERE code_mac = ? AND expires > ?', array(code_mac($code), now())) : null;
    if (!$g) fail('code', 'No group has that code. Check it against your invitation email.', 404);
    $viewer = !empty($in['viewer']) || !empty($g['solo']);   // a week shared with one person is only looked at
    $kid = isset($in['kid']) && is_array($in['kid']) ? $in['kid'] : null;
    $kidName = $kid ? first_name(str($kid, 'name', 40)) : '';
    if (!$viewer && $kidName === '') fail('kid', 'Add your child’s first name.');
    $m = row('SELECT id, role, status FROM members WHERE group_id = ? AND user_id = ?', array($g['id'], $u['id']));
    $isNew = !$m;
    if (!$m) {
      if (!invited($g['id'], $u['email'])) not_invited($u);
      if ((int) val('SELECT COUNT(*) FROM members WHERE group_id = ?', array($g['id'])) >= MAX_MEMBERS) fail('limit', 'That group is full.');
      if ((int) val('SELECT COUNT(*) FROM members WHERE user_id = ?', array($u['id'])) >= MAX_JOINED) fail('limit', 'You’re in as many groups as one person can be. Leave one first.');
      // The owner chose this address, so there is no second approval step.
      q('INSERT INTO members (group_id, user_id, role, status, created) VALUES (?, ?, ?, ?, ?)', array($g['id'], $u['id'], $viewer ? 'viewer' : 'member', 'approved', now()));
      $m = array('id' => (int) db()->lastInsertId(), 'role' => $viewer ? 'viewer' : 'member', 'status' => 'approved');
      bump('join');
    } elseif (!$viewer && $m['role'] === 'viewer') {
      q('UPDATE members SET role = ? WHERE id = ?', array('member', $m['id']));
    }
    $kidId = null;
    if (!$viewer) {
      if ((int) val('SELECT COUNT(*) FROM kids WHERE member_id = ?', array($m['id'])) >= MAX_KIDS) fail('limit', 'You’ve added ' . MAX_KIDS . ' children to this group, which is the most it takes.');
      q('INSERT INTO kids (member_id, name, now_json, next_json, updated) VALUES (?, ?, ?, ?, ?)', array($m['id'], $kidName, clean_week($kid['now'] ?? null), clean_week($kid['next'] ?? null), now()));
      $kidId = (int) db()->lastInsertId();
    }
    if ($isNew && !too_many('ask:' . $g['id'], 20, 86400)) {   // tell the owner who came in, by the adult's name only
      note('ask:' . $g['id']);
      $owner = row('SELECT email FROM users WHERE id = ?', array($g['owner_id']));
      $url = $CFG['siteUrl'] . '/groups/?g=' . $g['id'];
      $who = $u['name'] . ($viewer ? ' (viewing only)' : '');
      if ($owner) send_mail($owner['email'], $u['name'] . ' joined ' . $g['name'],
        "$who joined your group \"" . $g['name'] . "\" on " . $CFG['siteName'] . ", from the address you invited (" . $u['email'] . ").\n\nIf that isn't who you expected, remove them here:\n$url\n",
        email_html($u['name'] . ' joined ' . $g['name'], '<p style="margin:0">' . htmlspecialchars($who, ENT_QUOTES, 'UTF-8') . ' joined your group from the address you invited (' . htmlspecialchars($u['email'], ENT_QUOTES, 'UTF-8') . '). If that isn’t who you expected, you can remove them.</p>', 'Open the group', $url, 'You’re getting this because you made this group on ' . $CFG['siteName'] . '.'));
    }
    out(array('ok' => true, 'id' => $g['id'], 'name' => $g['name'], 'status' => $m['status'], 'kid' => $kidId, 'solo' => (bool) $g['solo']));
  }

  // Invite people by email address. Each gets the link and the code; only these addresses can join.
  case 'POST invite_add': {
    $u = need_user();
    $gid = str($in, 'group', 30);
    $g = need_owner($gid, $u);
    if (!ready($u)) fail('yourname', 'Add your first and last name first, so the people you invite know who it’s from.');
    $raw = isset($in['emails']) ? $in['emails'] : '';
    if (is_array($raw)) $raw = implode(' ', array_filter($raw, 'is_string'));
    $parts = preg_split('/[\s,;<>]+/', strtolower(mb_substr((string) $raw, 0, 6000, 'UTF-8')), -1, PREG_SPLIT_NO_EMPTY) ?: array();
    $good = array(); $bad = array();
    foreach (array_slice(array_values(array_unique($parts)), 0, 40) as $e) {
      if (strlen($e) <= 150 && filter_var($e, FILTER_VALIDATE_EMAIL)) $good[] = $e; else $bad[] = mb_substr($e, 0, 60, 'UTF-8');
    }
    if (!$good) fail('email', $bad ? 'Those don’t look like email addresses.' : 'Add at least one email address.');
    $sent = 0; $held = 0; $full = false;
    foreach ($good as $e) {
      $r = invite_one($u, $g, $gid, $e);
      if ($r === 'full') { $full = true; break; }
      if ($r === 'sent') $sent++; elseif ($r === 'held') $held++;
    }
    out(array('ok' => true, 'sent' => $sent, 'held' => $held, 'full' => $full, 'bad' => $bad, 'invites' => invite_out($gid)));
  }

  // Take an address off the list. If that person already joined, they and their children's weeks leave the group too.
  case 'POST invite_remove': {
    $u = need_user();
    $gid = str($in, 'group', 30);
    need_owner($gid, $u);
    $email = strtolower(str($in, 'email', 150));
    q('DELETE FROM invites WHERE group_id = ? AND email = ?', array($gid, $email));
    q('DELETE FROM members WHERE group_id = ? AND role != ? AND user_id IN (SELECT id FROM users WHERE email = ?)', array($gid, 'owner', $email));
    out(array('ok' => true, 'invites' => invite_out($gid)));
  }

  // Add or update one of your own children in a group you belong to.
  case 'POST kid_save': {
    $u = need_user();
    $gid = str($in, 'group', 30);
    $m = membership($gid, $u['id']);
    if (!$m) fail('forbidden', 'You’re not in that group.', 403);
    if (!empty($m['solo']) && $m['role'] !== 'owner') fail('forbidden', 'This week was shared with you to look at. Only the person who shared it can change it.', 403);
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
    // Weeks kept in the profile: the same device sends those along too.
    $saved = array(); $lost = array();
    foreach (isset($in['weeks']) && is_array($in['weeks']) ? array_slice($in['weeks'], 0, MAX_WEEKS) : array() as $w) {
      if (!is_array($w) || !isset($w['id'])) continue;
      $wid = (int) $w['id'];
      if (!row('SELECT id FROM weeks WHERE id = ? AND user_id = ?', array($wid, $u['id']))) { $lost[] = $wid; continue; }
      $name = first_name(str($w, 'name', 40));
      $t = now();
      if ($name !== '') q('UPDATE weeks SET name = ? WHERE id = ?', array($name, $wid));
      q('UPDATE weeks SET now_json = ?, next_json = ?, updated = ? WHERE id = ?', array(clean_week_full($w['now'] ?? null), clean_week_full($w['next'] ?? null), $t, $wid));
      $saved[] = array('id' => $wid, 'updated' => $t);
    }
    out(array('ok' => true, 'done' => $done, 'gone' => $gone, 'weeks' => $saved, 'weeksGone' => $lost));
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
    $base = array('ok' => true, 'id' => $gid, 'name' => $m['name'], 'role' => $m['role'], 'status' => $m['status'], 'solo' => !empty($m['solo']), 'expires' => (new DateTime('@' . (int) $m['expires']))->setTimezone(new DateTimeZone('America/New_York'))->format('Y-m-d'));
    if ($m['status'] !== 'approved') out($base);   // waiting: the name of the group and nothing else
    $kids = array();
    foreach (q('SELECT k.*, m.user_id FROM kids k JOIN members m ON m.id = k.member_id WHERE m.group_id = ? AND m.status = ? ORDER BY k.name COLLATE NOCASE, k.id', array($gid, 'approved')) as $k) {
      $kids[] = kid_out($k, (int) $k['user_id'] === $u['id']);
    }
    $base['kids'] = $kids;
    if ($m['role'] === 'owner') {
      $base['code'] = code_open($m['code_enc']);
      $base['members'] = array();
      foreach (q('SELECT m.id, m.role, m.status, u.name, u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.status DESC, m.created', array($gid)) as $x) {
        $names = array();
        foreach (q('SELECT name FROM kids WHERE member_id = ? ORDER BY id', array($x['id'])) as $k) $names[] = $k['name'];
        $base['members'][] = array('id' => (int) $x['id'], 'name' => $x['name'], 'email' => $x['email'], 'role' => $x['role'], 'status' => $x['status'], 'kids' => $names);
      }
      $base['invites'] = invite_out($gid);
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
      q('DELETE FROM invites WHERE group_id = ? AND email = ?', array($gid, strtolower($x['email'])));   // and their invitation, so they can't walk back in
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
    bump('group_deleted');
    out(array('ok' => true));
  }
}

fail('bad', 'That request was not understood.', 404);
