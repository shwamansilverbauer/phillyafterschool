// ----- the mailbox (scaling plan, Phase 5): mail people write to the site's address, handed over by the script -----
// Shared by groups/api.php (the mailbox script's signed requests, the private queue's mail items, the morning summary)
// and edit/needs/ (the owner's mail, with a draft to edit and Send). build.mjs pastes this file in at each one's
// /*MAIL*/ marker; edit it here.
//
// The mailbox script (mail/Code.gs, inside the contact@ Google account) posts each email a person wrote. The site
// keeps the message sealed (AES-256-GCM with a key of its own, derived from the host's secret.key, the way a child's
// details are sealed), never in clear, and its scrubbed copy (email addresses, phone numbers and the sender's own name
// taken out) sealed beside it. The private queue gets that copy, opened, and what the host worked out about the sender
// (columns in clear: the domain, DKIM, the matching listings, the account's role), never the address. Replies wait in
// mail_out until the script asks for them, and go from the site's address as a reply in their own thread.
const MAIL_TAG = 'm1.';
const MAIL_TEXT_MAX = 8000;         // characters of a message's plain text kept (the script trims quoted history first)
const MAIL_SCRUB_MAX = 4000;        // characters of the scrubbed copy the queue gets
const MAIL_KEEP_DAYS = 180;         // after this, a settled message's sealed text is dropped; the row (counts only) stays
const MAIL_STATES = array('queued', 'held', 'answered', 'closed', 'spam');
// The Gmail label each state asks the script to put on the thread (the script takes the other PAS/People labels off).
const MAIL_LABELS = array('queued' => 'PAS/People/Queued', 'held' => 'PAS/People/Needs Josh', 'answered' => 'PAS/People/Answered', 'closed' => 'PAS/People/Done', 'spam' => 'PAS/Spam');
// Why an email waits for the owner, in a sentence (the hold list in docs/listings.md, "What waits for Josh").
const MAIL_HOLDS = array(
  'instructions' => 'It addresses an AI, or asks to skip a rule. Marked suspicious: nothing in it was followed.',
  'legal' => 'Legal words: a lawyer, a subpoena, a takedown or the like.',
  'safety' => 'A safety complaint about a program or a child.',
  'data' => 'A request for someone’s data.',
  'payment' => 'A refund or a payment dispute.',
  'official' => 'From a school district or City address.',
  'press' => 'From the press, or about a story.',
  'sponsor' => 'A sponsor, partner or advertising inquiry.',
  'run' => 'A research run held it for your decision.',
  'owner' => 'You sent it back to yourself from the queue.',
);
const MAIL_PUSH_HOLDS = array('sponsor', 'legal', 'safety');   // these also go to the owner's phone at once

function mail_schema(PDO $db): void {
  $db->exec("CREATE TABLE IF NOT EXISTS mail_in (id INTEGER PRIMARY KEY, gid TEXT NOT NULL UNIQUE, thread TEXT NOT NULL, via TEXT NOT NULL DEFAULT 'mail', sealed TEXT NOT NULL, draft TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '', scrubbed TEXT NOT NULL DEFAULT '', domain TEXT NOT NULL DEFAULT '', dkim INTEGER NOT NULL DEFAULT 0, spf TEXT NOT NULL DEFAULT '', dmarc TEXT NOT NULL DEFAULT '', listings TEXT NOT NULL DEFAULT '', shared INTEGER NOT NULL DEFAULT 0, account TEXT NOT NULL DEFAULT 'none', outreach TEXT NOT NULL DEFAULT '', sender TEXT NOT NULL DEFAULT '', attachments INTEGER NOT NULL DEFAULT 0, hold TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'queued', label_want TEXT NOT NULL DEFAULT '', label_done TEXT NOT NULL DEFAULT '', received INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, decided INTEGER NOT NULL DEFAULT 0)");
  $db->exec('CREATE INDEX IF NOT EXISTS mail_in_state ON mail_in (state, created)');
  $db->exec('CREATE INDEX IF NOT EXISTS mail_in_thread ON mail_in (thread)');
  // A reply waiting to go: the script asks for these (handed: when it last did) and says which went (sent).
  $db->exec("CREATE TABLE IF NOT EXISTS mail_out (id INTEGER PRIMARY KEY, mail_id INTEGER NOT NULL DEFAULT 0, thread TEXT NOT NULL, gid TEXT NOT NULL, sealed TEXT NOT NULL, kind TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'waiting', created INTEGER NOT NULL, handed INTEGER NOT NULL DEFAULT 0, tries INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0, why TEXT NOT NULL DEFAULT '')");
  $db->exec('CREATE INDEX IF NOT EXISTS mail_out_state ON mail_out (state, created)');
  // Each signed request's one-time value, so a copied request can't be sent again.
  $db->exec('CREATE TABLE IF NOT EXISTS mail_nonce (n TEXT PRIMARY KEY, t INTEGER NOT NULL)');
}

// The key that seals mail: derived from the host's secret (the bytes of secret.key), never the secret itself.
function mail_seal_key(string $secret): string { return $secret === '' ? '' : hash_hmac('sha256', 'pas-mail-v1', $secret, true); }
function mail_b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function mail_b64u_dec(string $s): string { $r = base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); return $r === false ? '' : $r; }
function mail_seal(string $key, string $v): string {
  if ($v === '' || $key === '') return '';
  $iv = random_bytes(12); $tag = '';
  $ct = openssl_encrypt($v, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, 'pas-mail');
  return $ct === false ? '' : MAIL_TAG . mail_b64u($iv . $tag . $ct);
}
function mail_open(string $key, $v): string {
  $v = (string) $v;
  if ($v === '' || $key === '' || strncmp($v, MAIL_TAG, strlen(MAIL_TAG)) !== 0) return '';
  $raw = mail_b64u_dec(substr($v, strlen(MAIL_TAG)));
  if (strlen($raw) < 29) return '';
  $pt = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16), 'pas-mail');
  return $pt === false ? '' : $pt;
}
// A sealed message, opened: from_name, from (the address), reply_to, subject, text, attachments, date. Or array().
function mail_message(string $key, $sealed): array { $m = json_decode(mail_open($key, $sealed), true); return is_array($m) ? $m : array(); }
// Where a reply goes: the Reply-To address for the contact form (which the site sends from its own address), else the sender.
function mail_reply_to(array $m, string $via): string {
  $r = isset($m['reply_to']) ? (string) $m['reply_to'] : ''; $f = isset($m['from']) ? (string) $m['from'] : '';
  return ($via === 'form' || $f === '') && filter_var($r, FILTER_VALIDATE_EMAIL) ? $r : $f;
}

function mail_cut(string $s, int $max): string { return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max); }
// The copy the queue gets: addresses and phone numbers out (as for every queue item), and the words of the sender's own
// name, so the research runs read what was asked and not who asked it.
function mail_scrub(string $text, string $name, int $max = MAIL_SCRUB_MAX): string {
  $s = (string) preg_replace('/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/', '[email removed]', $text);
  $s = (string) preg_replace('/(?<!\d)(\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)/', '[phone removed]', $s);
  foreach (preg_split('/[^\p{L}\p{M}\'’-]+/u', $name) ?: array() as $w) {
    if (mb_strlen($w, 'UTF-8') < 2) continue;
    $s = (string) preg_replace('/(?<![\p{L}\p{M}])' . preg_quote($w, '/') . '(?![\p{L}\p{M}])/iu', '[name removed]', $s);
  }
  $s = (string) preg_replace("/[ \t]+\n/", "\n", $s);
  $s = (string) preg_replace("/\n{3,}/", "\n\n", trim($s));
  return mail_cut($s, $max);
}
// The hold list for mail from people. '' when nothing on it matches. Broad on purpose: a needless hold costs the owner a
// look, a missed one could send a template to a lawyer. Checked on the subject and the text together, lower-cased.
function mail_hold_reason(string $subject, string $text, string $domain): string {
  $t = mb_strtolower($subject . "\n" . $text, 'UTF-8');
  $rules = array(
    'instructions' => '/\b(ignore (all |any )?(the |your )?(previous|prior|above|earlier) (instructions|rules|prompts?)|disregard (all |the |your )?(previous |prior )?(rules|instructions)|you are (now )?an? (ai|assistant|language model|chatbot)|as an ai\b|system prompt|(dear|hey|hi) (ai|assistant|claude|chatgpt|bot)\b|\b(claude|chatgpt|gpt-?\d|llm|ai agent|ai model|language model)\s*[,:]|do not (tell|inform|show) (josh|the owner|a human|anyone)|skip (the |your )?(rules|checks|review|gate))/u',
    'legal' => '/\b(lawyers?|attorneys?|subpoena|take ?down|cease and desist|dmca|lawsuit|legal action|libel|defamat\w*|slander|sue (you|the site)|counsel for)\b/u',
    'safety' => '/\b(unsafe|not safe|abus(e|ed|ive)|injur\w*|assault\w*|harass\w*|neglect\w*|police|bully\w*|molest\w*|inappropriate(ly)? (touch\w*|behavior|contact)|safety (concern|issue|complaint|problem)|dangerous|left alone|lost child|missing child|child protective|dhs report)\b/u',
    'data' => '/\b(my data|personal data|personal information|delete (all )?(of )?(my|our) (data|information|details)|gdpr|ccpa|coppa|data (request|access|deletion)|what (data|information) (do )?you (have|hold|keep|store)|right to (be forgotten|erasure|access))\b/u',
    'payment' => '/\b(refunds?|refunded|chargeback|charged (me )?twice|double[- ]charged|(payment|billing) (dispute|issue|problem|error)|disput(e|ed|ing) (the|a|my) (charge|payment)|overcharg\w*|cancel (my|the|our) (subscription|plan|premium|payment))\b/u',
    'press' => '/\b(reporter|journalist|newsroom|press (inquiry|request)|media (inquiry|request)|for (a|an|my) (story|article|segment|piece)|on deadline|writing (a|an) (story|article)|interview (you|request))\b/u',
    'sponsor' => '/\b(sponsor(ship|ships|ing|ed post|ed placement)?|partnership (opportunity|inquiry|proposal)|partner with (you|your (site|team|organization))|advertis(e|ing) (on|with) (your|the) site|media kit|rate card|paid placement)\b/u',
  );
  foreach (array('instructions', 'legal', 'safety', 'data', 'payment') as $why) if (preg_match($rules[$why], $t)) return $why;
  if ($domain !== '' && preg_match('/(^|\.)(philasd\.org|phila\.gov|pa\.gov|k12\.pa\.us)$|\.gov$/', $domain)) return 'official';
  foreach (array('press', 'sponsor') as $why) if (preg_match($rules[$why], $t)) return $why;
  return '';
}

// Signed requests from the script: X-PAS-Sign: t=<unix time>,n=<one-time value>,s=<hex HMAC-SHA256 over
// "<t>.<n>.<action>.<raw body>" with the shared secret>. Gives '' when it holds, or why not: unsigned, signature,
// stale (more than five minutes either way), repeated (that one-time value was used).
function mail_check_sign(string $key, string $header, string $action, string $raw, int $now, callable $seen): string {
  if (!preg_match('/^t=(\d{9,11}),n=([A-Za-z0-9_-]{16,64}),s=([0-9a-f]{64})$/', trim($header), $m)) return 'unsigned';
  if (!hash_equals(hash_hmac('sha256', $m[1] . '.' . $m[2] . '.' . $action . '.' . $raw, $key), $m[3])) return 'signature';
  if (abs($now - (int) $m[1]) > 300) return 'stale';
  if (!$seen($m[2], (int) $m[1])) return 'repeated';
  return '';
}

// Queues one reply to go from the site's address, as a reply in the message's own thread. $text is the whole plain-text
// body. Gives the reply's id, or 0.
function mail_reply_add(PDO $db, string $key, int $mailId, string $text, string $kind): int {
  $st = $db->prepare('SELECT * FROM mail_in WHERE id = ?'); $st->execute(array($mailId));
  $row = $st->fetch(PDO::FETCH_ASSOC);
  if (!$row) return 0;
  $m = mail_message($key, $row['sealed']);
  $to = mail_reply_to($m, (string) $row['via']);
  $text = trim(str_replace("\r", '', $text));
  if (!filter_var($to, FILTER_VALIDATE_EMAIL) || $text === '') return 0;
  $subject = isset($m['subject']) ? trim((string) $m['subject']) : '';
  $subject = $subject === '' ? 'Your message' : (preg_match('/^re:/i', $subject) ? $subject : 'Re: ' . $subject);
  $db->prepare('INSERT INTO mail_out (mail_id, thread, gid, sealed, kind, state, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
    ->execute(array($mailId, (string) $row['thread'], (string) $row['gid'], mail_seal($key, (string) json_encode(array('to' => $to, 'subject' => mail_cut($subject, 250), 'text' => mail_cut($text, 20000)))), $kind, 'waiting', time()));
  return (int) $db->lastInsertId();
}
// Moves an email to a state, and asks the script for the matching label.
function mail_set_state(PDO $db, int $mailId, string $state, ?string $hold = null): void {
  if (!in_array($state, MAIL_STATES, true)) return;
  if ($hold === null) $db->prepare('UPDATE mail_in SET state = ?, label_want = ?, decided = ? WHERE id = ?')->execute(array($state, MAIL_LABELS[$state], time(), $mailId));
  else $db->prepare('UPDATE mail_in SET state = ?, hold = ?, label_want = ?, decided = ? WHERE id = ?')->execute(array($state, $hold, MAIL_LABELS[$state], time(), $mailId));
}
// The email's item in the private queue, settled alongside it (when it has one): told is when its answer went, or a
// code below 0 (-5: settled by the owner with no reply).
function mail_settle_item(PDO $db, int $mailId, string $outcome, int $told): void {
  try { $db->prepare("UPDATE queue_items SET state = 'closed', outcome = ?, decided = ?, told = ? WHERE id = ?")->execute(array($outcome, time(), $told, 'm' . $mailId)); } catch (Exception $e) { /* no queue yet */ }
}
// What waits for the owner: held mail, newest first.
function mail_held_rows(?PDO $db): array {
  if ($db === null) return array();
  try { return $db->query("SELECT * FROM mail_in WHERE state = 'held' ORDER BY created DESC LIMIT 60")->fetchAll(PDO::FETCH_ASSOC); } catch (Exception $e) { return array(); }
}
// The host's secret, read from the file next to the accounts database: for the pages that aren't the API.
function mail_host_secret(string $root): string {
  $raw = trim((string) @file_get_contents($root . '/phillyafterschool-data/secret.key'));
  return strlen($raw) === 64 && ctype_xdigit($raw) ? (string) hex2bin($raw) : '';
}
