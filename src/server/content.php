// ----- reviews, and what program managers add, without the owner in the loop (scaling plan, Phase 6) -----
// Shared by groups/api.php (the review form's requests, the queue's review and content items, the runs' decisions, the
// gate's question about a review), edit/needs/ (held reviews, with Approve and Decline) and edit/queue/ (which writes the
// same queue). build.mjs pastes this file in at each one's /*CONTENT*/ marker; edit it here. It needs src/server/mail.php
// (its sealing) pasted in before it. Nothing here sends an email.
//
// Reviews. The form at /review/ stores a review in the reviews table (it no longer emails a ready-made entry). The
// reviewer confirms their email address with the emailed code the site already uses, which makes an account; one
// review per account per listing. The site checks each review when it comes in (review_holds): the text against the
// rules in scripts/gate.config.json ("moderation") and the words in the private file on the host, and the account
// (the program's own email domain, another program's, a review already sent, an account under a day old with nothing
// saved). One that passes goes to the private queue with the exact entry data/reviews.json will carry; the queue run
// reads it against the same rules and puts it in its pull request; the gate checks it again and asks this host
// (review_check) whether the entry is the one the reviewer sent and still clean. One that doesn't pass waits for the
// owner on the Needs-you page, and never leaves the host.
//
// Words, offers and pins (rows in extras) and photos and logos (rows in photos) go to the private queue as items of
// their own ("x<id>" and "f<id>"), each photo with a signed link the run can open for 24 hours. The run rates each and
// writes decisions/<run>.json to the ops repository; the API applies them (content_decisions).
const REVIEW_ID = '/^v[0-9a-f]{10}$/';
// Why a review waits for the owner, in a sentence. The codes are what the reviews table keeps in "hold".
const REVIEW_HOLDS = array(
  'link' => 'It has a link in it.',
  'contact' => 'It has contact details in it: an email address or a phone number.',
  'accusation' => 'It may make an accusation (safety, harm, discrimination, a crime or licensing).',
  'profanity' => 'It uses strong language.',
  'person' => 'It may name a person: a member of staff, or a child.',
  'instructions' => 'It addresses an AI or asks to skip a rule. Marked suspicious: nothing in it was followed.',
  'words' => 'It uses a word on the site’s private list.',
  'own-domain' => 'The reviewer’s account is at the program’s own email domain.',
  'other-program' => 'The reviewer’s account is at another program’s email domain.',
  'again' => 'This account has already reviewed this program.',
  'new-account' => 'The account is under a day old, with no saved school or plan.',
  'run' => 'A research run held it for your decision.',
  'pr-closed' => 'Its pull request was closed without a merge.',
);
// Why something a manager added waits: the rules a run (or this host) may name in a decision. Fixed words only.
const CONTENT_RULES = array(
  'link' => 'It has a link or a web address in it.',
  'contact' => 'It has contact details in it.',
  'licensing' => 'It claims a license or an accreditation, which the site can’t check.',
  'claim' => 'It makes a guarantee or a “best” claim.',
  'other-program' => 'It names another program.',
  'child-named' => 'It names a child.',
  'child-face' => 'A child’s face is shown up close.',
  'readable-name' => 'A name can be read in it (a jersey, a name tag, a sign-in sheet).',
  'unsuitable' => 'It isn’t suitable for the site.',
  'not-logo' => 'It doesn’t look like a logo.',
  'no-consent' => 'The manager didn’t tick that everyone shown (or their parent) agreed to it being public.',
  'no-look' => 'The run couldn’t open the photo, so it holds.',
  'instructions' => 'It addresses an AI or asks to skip a rule. Marked suspicious: nothing in it was followed.',
  'words' => 'It uses a word on the site’s private list.',
  'other' => 'The run held it for your decision.',
);
const CONTENT_KINDS = array('words', 'offer', 'pin');   // what a run rates among the extras; social links and Instagram posts publish on their own checks
const CONTENT_A_RUN = 40;                              // items of each sort (reviews, extras, photos) put in the queue at once
const PHOTO_LOOK_WINDOW = 21600;                       // a photo's link changes every six hours and works for 24 to 30

function content_schema(PDO $db): void {
  // One review per account per listing. kid: the child's grade and first name, sealed like the mail (a child's details
  // are never kept in clear). status: new (in the queue or in a run's pull request), held (waits for the owner, "hold"
  // says why), published, declined.
  $db->exec("CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, listing TEXT NOT NULL, school TEXT NOT NULL, stars INTEGER NOT NULL, comment TEXT NOT NULL, name TEXT NOT NULL, kid TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', hold TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, decided INTEGER NOT NULL DEFAULT 0, pr INTEGER NOT NULL DEFAULT 0, UNIQUE (user_id, listing))");
  $db->exec('CREATE INDEX IF NOT EXISTS reviews_status ON reviews (status, created)');
  // A run's word on a manager's words, offer, pin, photo or logo: when it rated it, ok or hold, and the rule (hold).
  // A photo also keeps whether the manager ticked that everyone shown, or their parent, agreed to it being public.
  foreach (array('extras', 'photos') as $t) {
    $cols = array(); foreach ($db->query('PRAGMA table_info(' . $t . ')')->fetchAll(PDO::FETCH_ASSOC) as $c) $cols[] = $c['name'];
    if (!$cols) continue;
    foreach (array('rated' => 'INTEGER NOT NULL DEFAULT 0', 'say' => "TEXT NOT NULL DEFAULT ''", 'hold' => "TEXT NOT NULL DEFAULT ''") as $col => $type) if (!in_array($col, $cols, true)) $db->exec('ALTER TABLE ' . $t . ' ADD COLUMN ' . $col . ' ' . $type);
    if ($t === 'photos' && !in_array('consent', $cols, true)) $db->exec('ALTER TABLE photos ADD COLUMN consent INTEGER NOT NULL DEFAULT 0');
  }
}

// ---------- the text rules ----------
function content_cut(string $s, int $max): string { return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max); }
function content_re(string $pattern, bool $caseless = true): string { return '~' . str_replace('~', '\~', $pattern) . '~' . ($caseless ? 'iu' : 'u'); }
// The private words, from phillyafterschool-moderation.json next to the public folder: { "review": [...], "content": [...] }.
function content_private(string $root): array {
  static $c = array();
  if (isset($c[$root])) return $c[$root];
  $d = json_decode((string) @file_get_contents($root . '/phillyafterschool-moderation.json'), true);
  $out = array('review' => array(), 'content' => array());
  foreach (array('review', 'content') as $k) if (is_array($d) && isset($d[$k]) && is_array($d[$k])) foreach ($d[$k] as $w) if (is_string($w) && trim($w) !== '') $out[$k][] = mb_strtolower(trim($w), 'UTF-8');
  return $c[$root] = $out;
}
// The hidden-instruction patterns (the same list the gate and the mailbox use, in short).
function content_instructions(string $t): bool {
  return (bool) preg_match('~\b((ignore|disregard|forget) (all |any |the )?(previous|prior|above|earlier|your|other) (instructions|rules|prompts?)|you are (now )?an? (ai|assistant|language model|chatbot)|system prompt|(dear|hey|hi|attention|note to|message to) (ai|assistant|claude|chatgpt|gpt|gemini|the ai|llms?|ai agents?)\b|(skip|bypass|override) (the |this |any |all )?(rules?|checks?|gate|review|moderation)|(do not|don.t) (tell|mention|show|flag|report) (this|anyone|josh|the owner)|new instructions?:)~iu', $t);
}
// What in a text a rule catches. $kind: review or content. $mod: "moderation" from scripts/gate.config.json. Gives codes.
function content_text_holds(string $text, array $mod, array $private, string $kind): array {
  $out = array();
  $has = function ($k, $caseless = true) use ($mod, $text) { return isset($mod[$k]) && is_string($mod[$k]) && @preg_match(content_re($mod[$k], $caseless), $text) === 1; };
  if (content_instructions($text)) $out[] = 'instructions';
  if ($has('link')) $out[] = 'link';
  if ($has('contact')) $out[] = 'contact';
  $names = false;
  foreach (isset($mod['personNames']) && is_array($mod['personNames']) ? $mod['personNames'] : array() as $p) if (is_string($p) && @preg_match(content_re($p, false), $text) === 1) $names = true;
  if ($kind === 'review') {
    if (isset($mod['accusation']) && is_string($mod['accusation']) && @preg_match(content_re($mod['accusation']), $text) === 1) $out[] = 'accusation';
    if ($has('profanity')) $out[] = 'profanity';
    if ($names) $out[] = 'person';
  } else {
    if ($has('licensing')) $out[] = 'licensing';
    if ($has('claims')) $out[] = 'claim';
    if ($has('profanity')) $out[] = 'unsuitable';
    if ($names) $out[] = 'child-named';
  }
  $low = mb_strtolower($text, 'UTF-8');
  foreach ($private[$kind === 'review' ? 'review' : 'content'] as $w) if (preg_match('~(?<![\p{L}\p{N}])' . preg_quote($w, '~') . '(?![\p{L}\p{N}])~u', $low)) { $out[] = 'words'; break; }
  return array_values(array_unique($out));
}
// Another program's name in what a manager wrote: any other listing's name of two words or more (eight characters at
// least), as a whole phrase. $names: listing key => name.
function content_other_program(string $text, string $own, array $names): bool {
  $low = ' ' . mb_strtolower((string) preg_replace('/[^\p{L}\p{N}]+/u', ' ', $text), 'UTF-8') . ' ';
  $ownName = isset($names[$own]) ? mb_strtolower((string) $names[$own], 'UTF-8') : '';
  foreach ($names as $k => $n) {
    if ($k === $own) continue;
    $n = trim(mb_strtolower((string) preg_replace('/\s*\(summer camp\)$/', '', (string) preg_replace('/[^\p{L}\p{N}()]+/u', ' ', (string) $n)), 'UTF-8'));
    if (mb_strlen($n, 'UTF-8') < 8 || strpos($n, ' ') === false || ($ownName !== '' && strpos($ownName, $n) !== false)) continue;
    if (strpos($low, ' ' . $n . ' ') !== false) return true;
  }
  return false;
}
// The host's own check of a manager's words, offer or pin, before anything a run said is applied. Gives rule codes.
function content_holds(string $kind, string $body, string $listing, array $names, array $mod, array $private): array {
  $text = $body;
  if ($kind === 'pin') { $p = json_decode($body, true); $text = is_array($p) && isset($p['n']) ? (string) $p['n'] : ''; }
  $out = content_text_holds($text, $mod, $private, 'content');
  if (content_other_program($text, $listing, $names)) $out[] = 'other-program';
  return array_values(array_unique($out));
}

// ---------- reviews ----------
function content_seal_key(string $secret): string { return $secret === '' ? '' : hash_hmac('sha256', 'pas-review-v1', $secret, true); }
function content_domain(string $email): string {
  $at = strrpos($email, '@'); $host = $at === false ? '' : strtolower(trim(substr($email, $at + 1), ". \t"));
  $parts = array_values(array_filter(explode('.', $host), 'strlen'));
  return count($parts) >= 2 ? implode('.', array_slice($parts, -2)) : $host;
}
function content_day(int $t): string { $d = new DateTime('@' . $t); $d->setTimezone(new DateTimeZone('America/New_York')); return $d->format('Y-m-d'); }
// The entry data/reviews.json carries for a review, exactly: the run copies it, the gate compares it (review_sum).
function review_entry(array $r, string $key): array {
  $e = array('id' => (string) $r['id'], 'programId' => (string) preg_replace('/^p:/', '', (string) $r['listing']), 'school' => (string) $r['school'], 'name' => (string) $r['name'], 'stars' => (int) $r['stars'], 'comment' => (string) $r['comment'], 'date' => content_day((int) $r['created']));
  $kid = $r['kid'] !== '' ? json_decode(mail_open($key, $r['kid']), true) : null;
  if (is_array($kid) && isset($kid['grade']) && is_string($kid['grade'])) { $e['kid'] = array('grade' => $kid['grade']); if (isset($kid['name']) && is_string($kid['name']) && $kid['name'] !== '') $e['kid']['name'] = $kid['name']; }
  return $e;
}
// What the gate sends to say which entry it is looking at: one line per value, so no JSON spelling can differ.
function review_sum(array $e): string {
  $kid = isset($e['kid']) && is_array($e['kid']) ? $e['kid'] : array();
  return hash('sha256', implode("\n", array((string) ($e['id'] ?? ''), (string) ($e['programId'] ?? ''), (string) ($e['school'] ?? ''), (string) ($e['name'] ?? ''), (string) (int) ($e['stars'] ?? 0), (string) ($e['comment'] ?? ''), (string) ($e['date'] ?? ''), (string) ($kid['grade'] ?? ''), (string) ($kid['name'] ?? ''))));
}
// Is the account fresh: under a day old, with no saved school and no plan kept?
function review_fresh(PDO $db, int $uid, int $now): bool {
  $st = $db->prepare('SELECT created, school FROM users WHERE id = ?'); $st->execute(array($uid)); $u = $st->fetch(PDO::FETCH_ASSOC);
  if (!$u) return true;
  if ((int) $u['created'] < $now - 86400 || (string) $u['school'] !== '') return false;
  foreach (array('weeks', 'summers', 'daysoffs') as $t) { try { $q = $db->prepare('SELECT 1 FROM ' . $t . ' WHERE user_id = ? LIMIT 1'); $q->execute(array($uid)); if ($q->fetchColumn()) return false; } catch (Exception $e) { /* a table from later */ } }
  return true;
}
// The account rules for a review. $listings: key => array('d' => its website's domain, 'm' => match or manual).
// $fresh: 'hold' (an account under a day old with nothing saved waits for the owner) or 'wait' (it waits a day and goes
// on). Gives codes.
function review_account_holds(PDO $db, array $r, array $listings, string $fresh, int $now): array {
  $out = array();
  $st = $db->prepare('SELECT email FROM users WHERE id = ?'); $st->execute(array((int) $r['user_id'])); $email = (string) $st->fetchColumn();
  $dom = content_domain($email);
  $own = isset($listings[$r['listing']]['d']) ? (string) $listings[$r['listing']]['d'] : '';
  if ($dom !== '' && $own !== '' && $dom === $own) $out[] = 'own-domain';
  elseif ($dom !== '') foreach ($listings as $k => $l) if ($k !== $r['listing'] && isset($l['d'], $l['m']) && $l['m'] === 'match' && (string) $l['d'] === $dom) { $out[] = 'other-program'; break; }
  $st = $db->prepare("SELECT COUNT(*) FROM reviews WHERE user_id = ? AND listing = ? AND id != ? AND status != 'declined'"); $st->execute(array((int) $r['user_id'], (string) $r['listing'], (string) $r['id']));
  if ((int) $st->fetchColumn() > 0) $out[] = 'again';
  if ($fresh === 'hold' && review_fresh($db, (int) $r['user_id'], $now)) $out[] = 'new-account';
  return $out;
}
// Every rule at once, for one review as stored.
function review_holds(PDO $db, array $r, array $listings, array $mod, array $private, string $fresh, int $now): array {
  return array_values(array_unique(array_merge(content_text_holds((string) $r['comment'], $mod, $private, 'review'), review_account_holds($db, $r, $listings, $fresh, $now))));
}
function review_hold_text(string $codes): string {
  $out = array(); foreach (array_filter(explode(',', $codes)) as $c) $out[] = isset(REVIEW_HOLDS[$c]) ? REVIEW_HOLDS[$c] : $c;
  return $out ? implode(' ', $out) : 'Held for you.';
}

// ---------- the queue's review and content items ----------
// Reviews that passed the site's checks, for queue/open.json: each with the exact entry, the listing and its name, and
// the reviewer's address (private: for the thank-you only, never written to the ops repository). With $fresh 'wait', a
// review from an account under a day old with nothing saved waits until the account is a day old.
function queue_reviews(?PDO $db, string $secret, array $names, string $fresh, int $now): array {
  $out = array();
  if ($db === null || $secret === '') return $out;
  $key = content_seal_key($secret);
  try {
    $st = $db->prepare("SELECT r.*, u.email FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.status = 'new' ORDER BY r.created LIMIT " . CONTENT_A_RUN);
    $st->execute();
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
      if ($fresh === 'wait' && review_fresh($db, (int) $r['user_id'], $now)) continue;
      $out[] = array('id' => (string) $r['id'], 'kind' => 'review', 'when' => gmdate('Y-m-d', (int) $r['created']), 'listing' => (string) $r['listing'],
        'program' => isset($names[$r['listing']]) ? (string) $names[$r['listing']] : (string) $r['listing'], 'email' => (string) $r['email'],
        'extra' => array('entry' => review_entry($r, $key)));
    }
  } catch (Exception $e) { /* no reviews table yet */ }
  return $out;
}
// The signed link to one waiting photo: the run opens it to look, and it stops working after 24 to 30 hours.
function photo_look_exp(int $now): int { return (intdiv($now, PHOTO_LOOK_WINDOW) + 5) * PHOTO_LOOK_WINDOW; }
function photo_look_sig(string $secret, int $id, int $exp): string { return hash_hmac('sha256', 'photo-look|' . $id . '|' . $exp, $secret); }
function photo_look_url(string $site, string $secret, int $id, int $now): string {
  $exp = photo_look_exp($now);
  return rtrim($site, '/') . '/groups/api.php?action=photo_look&id=' . $id . '&e=' . $exp . '&s=' . photo_look_sig($secret, $id, $exp);
}
// What managers added that a run hasn't rated yet: words, offers and pins, and photos and logos. Not registered as
// queue items (nobody is emailed about the run's answer; the API tells the manager when one is published).
function queue_content(?PDO $db, string $secret, string $site, array $names, int $now): array {
  $out = array();
  if ($db === null) return $out;
  $name = function ($k) use ($names) { return isset($names[$k]) ? (string) $names[$k] : (string) $k; };
  try {
    $st = $db->prepare("SELECT e.id, e.listing, e.kind, e.body, e.until, e.created FROM extras e JOIN claims c ON c.id = e.claim_id WHERE e.status = 'new' AND e.rated = 0 AND c.status = 'ok' AND e.kind IN ('words', 'offer', 'pin') ORDER BY e.id LIMIT " . CONTENT_A_RUN);
    $st->execute();
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $x) {
      $text = (string) $x['body'];
      if ($x['kind'] === 'pin') { $p = json_decode($text, true); $text = is_array($p) && isset($p['n']) ? (string) $p['n'] : ''; }
      $item = array('id' => 'x' . (int) $x['id'], 'kind' => (string) $x['kind'], 'when' => gmdate('Y-m-d', (int) $x['created']), 'listing' => (string) $x['listing'], 'program' => $name($x['listing']), 'text' => $text);
      if ($x['kind'] === 'offer' && $x['until'] !== '') $item['until'] = (string) $x['until'];
      $out[] = $item;
    }
  } catch (Exception $e) { /* a database from before premium */ }
  if ($secret === '') return $out;
  try {
    $st = $db->prepare("SELECT p.id, p.listing, p.kind, p.alt, p.consent, p.created FROM photos p JOIN claims c ON c.id = p.claim_id WHERE p.status = 'new' AND p.rated = 0 AND c.status = 'ok' ORDER BY p.id LIMIT " . CONTENT_A_RUN);
    $st->execute();
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $p) {
      $out[] = array('id' => 'f' . (int) $p['id'], 'kind' => (string) $p['kind'] === 'logo' ? 'logo' : 'photo', 'when' => gmdate('Y-m-d', (int) $p['created']), 'listing' => (string) $p['listing'], 'program' => $name($p['listing']),
        'alt' => (string) $p['alt'], 'consent' => (int) $p['consent'] === 1, 'look' => photo_look_url($site, $secret, (int) $p['id'], $now));
    }
  } catch (Exception $e) { /* a database from before Phase 6 */ }
  return $out;
}

// ---------- for the owner's pages ----------
// Reviews waiting for the owner, newest first, with the child's details opened.
function needs_reviews(?PDO $db, string $secret): array {
  if ($db === null) return array();
  $key = content_seal_key($secret);
  try {
    $rows = $db->query("SELECT r.*, u.email, u.first, u.last FROM reviews r LEFT JOIN users u ON u.id = r.user_id WHERE r.status = 'held' ORDER BY r.created DESC LIMIT 60")->fetchAll(PDO::FETCH_ASSOC);
  } catch (Exception $e) { return array(); }
  foreach ($rows as &$r) $r['entry'] = review_entry($r, $key);
  unset($r);
  return $rows;
}
// What a run (or the host) said about a manager's item, in a sentence for the Needs-you page. '' when nothing was said.
function content_say_text(array $x, string $mode): string {
  $hold = isset($x['hold']) ? (string) $x['hold'] : ''; $say = isset($x['say']) ? (string) $x['say'] : '';
  if ($hold !== '') return isset(CONTENT_RULES[$hold]) ? CONTENT_RULES[$hold] : 'Held for you.';
  if ($say === 'ok') return $mode === 'on' ? 'A run passed it; it publishes with the next hourly run.' : 'A run would publish this (the autopilot isn’t on, so it waits for you).';
  return '';
}
// Adds a review's entry to data/reviews.json's text (two-space JSON, as the build writes it), unless it is already there.
// Gives the new text, or '' when the entry is already in it or the file can't be read.
function review_file_add(string $text, array $entry): string {
  $list = trim($text) === '' ? array() : json_decode($text, true);
  if (!is_array($list)) return '';
  foreach ($list as $x) if (is_array($x) && isset($x['id']) && $x['id'] === $entry['id']) return '';
  $list[] = $entry;
  $json = (string) json_encode(array_values($list), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_LINE_TERMINATORS);
  $json = (string) preg_replace_callback('/^( +)/m', function ($m) { return str_repeat(' ', intdiv(strlen($m[1]), 2)); }, $json);
  return $json . "\n";
}
