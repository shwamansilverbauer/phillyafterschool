<?php
// The research runs' queue, as the owner sees it behind the edit sign-in: what came in through the site that needs a
// program's website read and judged (suggestions of programs and camps, updates to listings, changes managers have
// proposed, the owner's own notes), and where each item stands. Generated into edit/queue/index.php by build.mjs,
// which fills in the marked lines (the mailer, the config, the sign-in check, the GitHub helpers, the shared queue
// code, and the mailbox's, which opens an email's scrubbed copy for the queue) and adds the page itself; edit this
// file, not the copy in dist/.
//
// Nothing is ticked or sent from here any more. The site writes the queue to the private ops repository by itself
// every hour (push_run in groups/api.php, with the code in src/server/queue.php), and the runs answer each item there.
// This page shows it, takes an item off ("Not for the run"), adds a note, and Rush writes the queue at once and emails
// the owner a reminder to press Run now. Nothing a person typed goes to the public repository.
/*MAILER*/
/*CONFIG*/
/*AUTH*/
/*GH*/
/*QUEUE*/
/*MAIL*/
if (!edit_signed_in()) { header('Location: ../', true, 303); exit; }
$ROOT = dirname((string) $_SERVER['DOCUMENT_ROOT']);
$STATE_FILE = $ROOT . '/phillyafterschool-queue.json';

$state = queue_state($ROOT);
function queue_save() {
  global $STATE_FILE, $state;
  @file_put_contents($STATE_FILE, json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
}
function ny($iso) { try { $d = is_numeric($iso) ? new DateTime('@' . (int) $iso) : new DateTime((string) $iso); $d->setTimezone(new DateTimeZone('America/New_York')); return $d->format('M j, Y'); } catch (Exception $e) { return substr((string) $iso, 0, 10); } }
// The Rush reminder ("press Run now"): X-PAS-Kind "rush", which the mailbox script leaves in the inbox, since it asks
// the owner to do something.
function record_email($subject, $body) {
  global $TO, $SITE;
  $headers = array('From: ' . $SITE . ' <' . $TO . '>', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', 'X-PAS-Kind: rush');
  return pas_postmark($SITE, $TO, $TO, $subject, $body, '', '', 'rush') === 1 || @mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', chunk_split(base64_encode($body)), implode("\r\n", $headers));
}
// The host's own key (made by groups/api.php), for the sender tokens; '' before the API has made it.
function host_secret() {
  global $ROOT;
  $raw = trim((string) @file_get_contents($ROOT . '/phillyafterschool-data/secret.key'));
  return strlen($raw) === 64 && ctype_xdigit($raw) ? (string) hex2bin($raw) : '';
}
function queue_page_ctx() {
  global $ROOT, $NAMES, $CITY, $OPS, $SITE_URL;
  return array('root' => $ROOT, 'db' => edit_db(), 'names' => $NAMES, 'city' => $CITY, 'secret' => host_secret(), 'gh' => 'gh', 'ops' => $OPS, 'site' => $SITE_URL);
}
// Who asked for each school from an account, for this page only, so the owner can write to them when the school goes
// up. Read from the log next to the public folder; never written to the queue.
function queue_askers() {
  global $ROOT, $CITY;
  $who = array();
  $lines = @file($ROOT . '/phillyafterschool-school-requests.log');
  if (is_array($lines)) foreach ($lines as $line) {
    $p = explode("\t", rtrim($line, "\n"));
    if (count($p) < 4 || $p[3] === '') continue;
    $who[$p[1]][] = queue_one($p[3], 150);
  }
  foreach ($who as $k => $v) $who[$k] = array_values(array_unique($v));
  return $who;
}

$csrf = hash_hmac('sha256', 'queue-form', edit_key());
$said = isset($_GET['said']) && is_string($_GET['said']) ? substr($_GET['said'], 0, 400) : '';
$KIND = array('program' => 'A program that’s missing', 'camp' => 'A camp that’s missing', 'update' => 'An update to a listing', 'proposal' => 'Proposed by the people who run it', 'note' => 'Your note', 'mail' => 'An email someone wrote');
$OUTCOME = array('published' => 'Published', 'held' => 'Held for you', 'declined' => 'Declined', 'duplicate' => 'Already listed', 'needs-info' => 'Needs more information', 'no-change' => 'Already right on the site', 'failed' => 'The run couldn’t finish it', 'earlier' => 'Sent to the weekly run before the private queue');

// ----- the buttons -----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $ok = isset($_POST['csrf']) && is_string($_POST['csrf']) && hash_equals($csrf, $_POST['csrf']);
  $do = isset($_POST['do']) && is_string($_POST['do']) ? $_POST['do'] : '';
  $msg = 'That didn’t go through. Try again.';
  if ($ok && $do === 'note') {
    $text = isset($_POST['text']) && is_string($_POST['text']) ? trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', ' ', substr($_POST['text'], 0, 2000)) ?? '') : '';
    if ($text === '') $msg = 'Write the note first.';
    else { $state['notes'][] = array('id' => 'n' . substr(sha1($text . microtime(true)), 0, 10), 'when' => date('c'), 'text' => $text); queue_save(); $msg = 'Noted. It goes into the queue within the hour, or now with Rush.'; }
  } elseif ($ok && strpos($do, 'drop:') === 0) {
    $id = substr($do, 5);
    if (preg_match(QUEUE_ID, $id)) {
      $state['items'][$id] = array('dropped' => true, 'when' => date('c')); queue_save();
      $db = edit_db();
      if ($db !== null) { try { queue_schema($db); $db->prepare("UPDATE queue_items SET state = 'dropped', decided = ? WHERE id = ? AND state IN ('open', 'held')")->execute(array(time(), $id)); } catch (Exception $e) { /* the state file is enough */ } }
      $msg = 'Taken off the queue. Its sender isn’t emailed.';
    }
  } elseif ($ok && $do === 'rush') {
    if ($OPS === '') $msg = 'The private queue isn’t set up: opsRepo is missing from the site config.';
    elseif (!gh_ready()) $msg = 'The queue can’t be written: the GitHub key file is missing on the server.';
    elseif (!gh_allowed('queue-rush', 10)) $msg = 'That’s a lot of rushes in one hour. Wait a little and try again.';
    else {
      $w = queue_write(queue_page_ctx(), true);
      if ($w['state'] !== 'written') {
        $why = isset($w['why']) ? $w['why'] : $w['state'];
        $msg = $why === 'no access' ? 'GitHub refused the ops repository: the key file’s token needs access to ' . $OPS . ' (Contents: read and write).' : ($why === 'refused' ? 'The GitHub key was refused. Check the key file on the server.' : 'The queue couldn’t be written (' . $why . '). Try again in a minute.');
      } else {
        $n = (int) $w['items'];
        record_email('[' . $SITE . '] Rush: ' . $n . ' item' . ($n === 1 ? '' : 's') . ' in the queue',
          "The queue is written. Press Run now on the scheduled task “Philly After School queue run” in your Claude app, and it opens a pull request within the hour.\n\n" . $SITE_URL . '/edit/queue/');
        $msg = 'Written: ' . $n . ' item' . ($n === 1 ? '' : 's') . ' in the private queue (commit ' . $w['commit'] . '). Now press Run now on “Philly After School queue run” in the Claude app; a reminder is in your inbox.';
      }
    }
  }
  // "Not for the run" pressed on the Needs-you page (edit/needs/) goes back there with the message.
  header('Location: ' . (isset($_POST['back']) && $_POST['back'] === 'needs' ? '../needs/' : './') . '?said=' . rawurlencode($msg), true, 303);
  exit;
}

// ----- what the page shows -----
$ctx = queue_page_ctx();
$c = queue_collect($ctx);
$byState = array('open' => array(), 'waiting' => array(), 'held' => array(), 'closed' => array());
foreach ($c['all'] as $x) if (isset($byState[$x['row']['state']])) $byState[$x['row']['state']][] = $x;
usort($byState['closed'], function ($a, $b) { return (int) $b['row']['decided'] - (int) $a['row']['decided']; });
$closed = array_slice($byState['closed'], 0, 30);
$schools = $c['asks'];
$askers = queue_askers();
$db = $ctx['db'];
$last = array('written' => $db ? queue_meta($db, 'queue_written') : '', 'commit' => $db ? queue_meta($db, 'queue_commit') : '', 'n' => $db ? queue_meta($db, 'queue_n') : '', 'why' => $db ? queue_meta($db, 'queue_why') : '');
// Where a worked item stands, in a few words: what the run said, and for one that waits, on what.
function state_line($x) {
  global $OUTCOME;
  $r = $x['row'];
  if ($r['state'] === 'held') return $r['reason'] === 'pr-closed' ? 'Held: its pull request was closed without a merge' : 'Held for you';
  if ($r['state'] === 'waiting') return ($r['outcome'] === 'held' ? 'Held in a pull request' : 'Published') . ' once the pull request is merged';
  $o = isset($OUTCOME[$r['outcome']]) ? $OUTCOME[$r['outcome']] : (string) $r['outcome'];
  return $o . ($r['reason'] !== '' ? ' (' . $r['reason'] . ')' : '');
}
function told_line($r) {
  if (!isset($r['email']) || $r['email'] === '') return '';   // the owner's own note, or nobody to answer
  $t = (int) $r['told'];
  if ($t > 0) return 'sender emailed ' . ny($t);
  if ($t === -1) return 'the email to the sender failed three times';
  if ($t === -2) return 'not emailed: replies are off';
  if ($t === -3) return 'not emailed: it came in before the private queue began';
  return $r['outcome'] === 'held' || $r['outcome'] === 'failed' ? '' : 'sender not emailed yet';
}
?>
