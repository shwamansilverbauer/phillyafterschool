<?php
// The weekly run's queue: what has come in through the site that needs a program's website read and judged
// (suggestions of programs and camps, updates to listings, changes managers have proposed, notes from the owner),
// shown behind the edit sign-in, and sent to the weekly research run as one batch. Generated into edit/queue/index.php
// by build.mjs, which fills in the marked lines (the mailer, the config, the sign-in check, the GitHub helpers) and
// adds the page itself; edit this file, not the copy in dist/.
//
// Sending writes data/queue.json on the repository's "queue" branch (never main, so nothing deploys), as one commit.
// The scheduled weekly run reads that file, checks each item against the provider's own site and opens a pull
// request named weekly-<batch>. Nothing a person typed goes to the repository unseen: the page shows each item as it
// will be sent, with names, addresses and phone numbers already taken out, and only ticked items go.
/*MAILER*/
/*CONFIG*/
/*AUTH*/
/*GH*/
if (!edit_signed_in()) { header('Location: ../', true, 303); exit; }
$ROOT = dirname((string) $_SERVER['DOCUMENT_ROOT']);
$STATE_FILE = $ROOT . '/phillyafterschool-queue.json';
$RESEARCH = array('A program that’s missing', 'A camp that’s missing', 'An update to a listing');
$KEEP_DAYS = 90;   // how far back the logs are read

$state = json_decode((string) @file_get_contents($STATE_FILE), true);
if (!is_array($state)) $state = array();
foreach (array('notes', 'items', 'batches') as $k) if (!isset($state[$k]) || !is_array($state[$k])) $state[$k] = array();
function queue_save() {
  global $STATE_FILE, $state;
  @file_put_contents($STATE_FILE, json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
}
function ny($iso) { try { $d = new DateTime($iso); $d->setTimezone(new DateTimeZone('America/New_York')); return $d->format('M j, Y'); } catch (Exception $e) { return substr((string) $iso, 0, 10); } }
function recent($iso) { global $KEEP_DAYS; $t = strtotime((string) $iso); return $t !== false && $t > time() - $KEEP_DAYS * 86400; }
// Names, email addresses and phone numbers out of text that goes to the repository.
function scrub($s) {
  $s = (string) $s;
  $s = preg_replace('/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/', '[email removed]', $s);
  $s = preg_replace('/(?<!\d)(\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)/', '[phone removed]', $s);
  return trim($s);
}
function record_email($subject, $body) {
  global $TO, $SITE;
  $headers = array('From: ' . $SITE . ' <' . $TO . '>', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64');
  return pas_postmark($SITE, $TO, $TO, $subject, $body) === 1 || @mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', chunk_split(base64_encode($body)), implode("\r\n", $headers));
}
function one($s, $max = 300) { return function_exists('mb_substr') ? mb_substr(trim(preg_replace('/\s+/u', ' ', (string) $s)), 0, $max, 'UTF-8') : substr(trim((string) $s), 0, $max); }

// ----- 1. suggestions sent through the forms, from the log the forms keep -----
function queue_suggestions() {
  global $ROOT, $RESEARCH;
  $out = array(); $schools = array();
  $raw = @file_get_contents($ROOT . '/phillyafterschool-suggestions.log');
  if (!is_string($raw) || $raw === '') return array($out, $schools);
  foreach (explode("----\n", $raw) as $block) {
    $block = trim($block);
    if ($block === '') continue;
    $lines = explode("\n", $block);
    $head = array_shift($lines);
    if (!preg_match('/^(\d{4}-\d\d-\d\dT[^ ]+)/', $head, $m)) continue;
    $when = $m[1];
    if (!recent($when)) continue;
    $f = array(); $details = ''; $inDetails = false;
    foreach ($lines as $line) {
      if ($inDetails) { $details .= $line . "\n"; continue; }
      if ($line === 'Details:' || $line === 'Message:') { $inDetails = true; continue; }
      if (preg_match('/^([A-Za-z ]+): ?(.*)$/', $line, $mm)) $f[$mm[1]] = $mm[2];
    }
    $kind = isset($f['Type']) ? $f['Type'] : '';
    if ($kind === 'A school to add' && isset($f['New school']) && $f['New school'] !== '') { $schools[] = array('school' => one($f['New school'], 120), 'when' => $when); continue; }
    if (!in_array($kind, $RESEARCH, true)) continue;
    $item = array(
      'id' => 's' . substr(sha1($block), 0, 10),
      'kind' => $kind === 'An update to a listing' ? 'update' : ($kind === 'A camp that’s missing' ? 'camp' : 'program'),
      'when' => substr($when, 0, 10),
      'school' => one(isset($f['School']) ? $f['School'] : '', 120),
      'program' => one(isset($f['Program']) ? $f['Program'] : (isset($f['What']) ? $f['What'] : ''), 150),
      'website' => one(isset($f['Website']) ? $f['Website'] : '', 300),
      'listing' => isset($f['Listing']) && preg_match('/^[pc]:[a-z0-9-]{1,80}$/', $f['Listing']) ? $f['Listing'] : '',
      'pickup' => one(isset($f['Picks up']) ? $f['Picks up'] : '', 60),
      'campType' => one(isset($f['Camp type']) ? $f['Camp type'] : '', 60),
      'sentBy' => one(isset($f['Sent by']) ? $f['Sent by'] : '', 60),
      'details' => scrub(preg_replace('/\n{3,}/', "\n\n", trim($details))),
    );
    if ($item['program'] === '' && $item['details'] === '' && $item['website'] === '') continue;
    $out[] = $item;
  }
  return array($out, $schools);
}

// ----- 2. changes the people who run a listing have proposed, waiting in the accounts database -----
function queue_proposals() {
  global $ROOT, $NAMES;
  $out = array();
  $file = $ROOT . '/phillyafterschool-data/groups.sqlite';
  if (!is_file($file)) return $out;
  try {
    $db = new PDO('sqlite:' . $file);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $db->exec('PRAGMA busy_timeout=3000');
    foreach ($db->query("SELECT id, listing, body, link, created FROM edits WHERE status = 'new' ORDER BY id") as $e) {
      $out[] = array(
        'id' => 'e' . (int) $e['id'],
        'kind' => 'proposal',
        'when' => gmdate('Y-m-d', (int) $e['created']),
        'listing' => (string) $e['listing'],
        'program' => isset($NAMES[$e['listing']]) ? $NAMES[$e['listing']] : (string) $e['listing'],
        'website' => one((string) $e['link'], 300),
        'details' => scrub((string) $e['body']),
      );
    }
  } catch (Exception $x) { /* no database yet, or one from before proposals existed */ }
  return $out;
}

// ----- 3. schools people asked for, counted (Josh adds schools; the run only hears the demand) -----
function queue_schools($fromSuggestions) {
  global $ROOT, $SCHOOL_NAMES;
  $n = array(); $last = array();
  $lines = @file($ROOT . '/phillyafterschool-school-requests.log');
  if (is_array($lines)) foreach ($lines as $line) {
    $p = explode("\t", rtrim($line, "\n"));
    if (count($p) < 3 || !recent($p[0])) continue;
    $name = one(isset($SCHOOL_NAMES[$p[1]]) ? $SCHOOL_NAMES[$p[1]] : $p[2], 120);
    $n[$name] = (isset($n[$name]) ? $n[$name] : 0) + 1; $last[$name] = max(isset($last[$name]) ? $last[$name] : '', substr($p[0], 0, 10));
  }
  foreach ($fromSuggestions as $s) { $n[$s['school']] = (isset($n[$s['school']]) ? $n[$s['school']] : 0) + 1; $last[$s['school']] = max(isset($last[$s['school']]) ? $last[$s['school']] : '', substr($s['when'], 0, 10)); }
  $out = array();
  foreach ($n as $name => $count) $out[] = array('school' => $name, 'n' => $count, 'last' => $last[$name]);
  usort($out, function ($a, $b) { return $b['n'] - $a['n'] ?: strcmp($a['school'], $b['school']); });
  return $out;
}

list($suggestions, $schoolAsks) = queue_suggestions();
$proposals = queue_proposals();
$notes = array();
foreach ($state['notes'] as $x) if (is_array($x) && isset($x['id'], $x['text']) && recent(isset($x['when']) ? $x['when'] : '')) $notes[] = array('id' => (string) $x['id'], 'kind' => 'note', 'when' => substr((string) $x['when'], 0, 10), 'details' => scrub((string) $x['text']));
$all = array_merge($notes, $proposals, $suggestions);
foreach ($all as &$x) foreach (array('program', 'website', 'details', 'school', 'listing', 'pickup', 'campType', 'sentBy') as $k) if (!isset($x[$k])) $x[$k] = '';
unset($x);
usort($all, function ($a, $b) { return strcmp($b['when'], $a['when']); });
$schools = queue_schools($schoolAsks);

// what the page knows about each item: sent in which batch, or dropped
$open = array(); $sent = array();
foreach ($all as $x) {
  $st = isset($state['items'][$x['id']]) && is_array($state['items'][$x['id']]) ? $state['items'][$x['id']] : array();
  if (!empty($st['dropped'])) continue;
  if (!empty($st['sent'])) { $x['sent'] = (string) $st['sent']; $x['rush'] = !empty($st['rush']); $sent[] = $x; } else $open[] = $x;
}
$batches = array_slice(array_reverse($state['batches']), 0, 20);
$csrf = hash_hmac('sha256', 'queue-form', edit_key());
$said = isset($_GET['said']) && is_string($_GET['said']) ? substr($_GET['said'], 0, 300) : '';
$KIND = array('program' => 'A program that’s missing', 'camp' => 'A camp that’s missing', 'update' => 'An update to a listing', 'proposal' => 'Proposed by the people who run it', 'note' => 'Your note');

// ----- the buttons -----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $ok = isset($_POST['csrf']) && is_string($_POST['csrf']) && hash_equals($csrf, $_POST['csrf']);
  $do = isset($_POST['do']) && is_string($_POST['do']) ? $_POST['do'] : '';
  $msg = 'That didn’t go through. Try again.';
  if ($ok && $do === 'note') {
    $text = isset($_POST['text']) && is_string($_POST['text']) ? trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', ' ', substr($_POST['text'], 0, 2000)) ?? '') : '';
    if ($text === '') $msg = 'Write the note first.';
    else { $state['notes'][] = array('id' => 'n' . substr(sha1($text . microtime(true)), 0, 10), 'when' => date('c'), 'text' => $text); queue_save(); $msg = 'Noted. It goes with the next send.'; }
  } elseif ($ok && ($do === 'drop' || strpos($do, 'drop:') === 0)) {
    $id = $do === 'drop' ? (isset($_POST['id']) && is_string($_POST['id']) ? $_POST['id'] : '') : substr($do, 5);
    if (!preg_match('/^[sen][a-z0-9]{1,12}$/', $id)) $id = '';
    if ($id !== '') { $state['items'][$id] = array('dropped' => true, 'when' => date('c')); queue_save(); $msg = 'Taken off the list.'; }
  } elseif ($ok && $do === 'send') {
    $ids = isset($_POST['ids']) && is_array($_POST['ids']) ? array_values(array_filter($_POST['ids'], function ($v) { return is_string($v) && preg_match('/^[sen][a-z0-9]{1,12}$/', $v); })) : array();
    $rush = !empty($_POST['rush']);
    $pick = array(); foreach ($open as $x) if (in_array($x['id'], $ids, true)) $pick[] = $x;
    if (!$pick) $msg = 'Tick at least one item to send.';
    elseif (!gh_ready()) $msg = 'Sending isn’t set up: the publishing key file is missing on the server, or the repository isn’t named in the site config.';
    elseif (!gh_allowed('queue-sends', 20)) $msg = 'That’s a lot of sends in one hour. Wait a little and try again.';
    else {
      $batch = (new DateTime('now', new DateTimeZone('America/New_York')))->format('Y-m-d-Hi');
      $items = array();
      foreach ($pick as $x) $items[] = $x;
      $payload = array('batch' => $batch, 'sent' => date('c'), 'rush' => $rush, 'site' => $SITE_URL, 'items' => $items, 'schoolsAsked' => $schools);
      $text = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
      $err = gh_branch('queue', 'main');
      $cur = $err === '' ? gh_file('data/queue.json', 'queue') : null;
      if ($err === '' && $cur === null) $err = 'GitHub could not be read. Try again in a minute.';
      if ($err === '') {
        list($done, $sha, $url) = gh_put('data/queue.json', $text, $cur[1], 'Queue: ' . count($items) . ' item' . (count($items) === 1 ? '' : 's') . ' for the weekly run' . ($rush ? ' (rush)' : '') . ' [' . $batch . ']', 'queue');
        if (!$done) $err = $sha;
      }
      if ($err !== '') $msg = $err;
      else {
        foreach ($pick as $x) $state['items'][$x['id']] = array('sent' => $batch, 'rush' => $rush, 'when' => date('c'));
        $state['batches'][] = array('id' => $batch, 'when' => date('c'), 'n' => count($items), 'rush' => $rush, 'commit' => $sha, 'by' => function_exists('edit_admin') && edit_admin() !== '' ? edit_admin() : 'edit sign-in');
        if (count($state['batches']) > 50) $state['batches'] = array_slice($state['batches'], -50);
        queue_save();
        $msg = 'Sent ' . count($items) . ' item' . (count($items) === 1 ? '' : 's') . ' to the weekly run' . ($rush ? '. Now press Run now on “Philly After School weekly run” in the Claude app, and a pull request follows within the hour.' : '. The run picks them up on its next morning, or sooner if you press Run now.');
        if ($rush) {
          $lines = array();
          foreach ($items as $x) $lines[] = '- ' . $KIND[$x['kind']] . ': ' . ($x['program'] !== '' ? $x['program'] : substr($x['details'], 0, 80)) . (isset($x['school']) && $x['school'] !== '' ? ' (' . $x['school'] . ')' : '');
          record_email('[' . $SITE . '] Rush: ' . count($items) . ' item' . (count($items) === 1 ? '' : 's') . ' waiting for the weekly run',
            "Press Run now on the scheduled task “Philly After School weekly run” in your Claude app, and it opens a pull request within the hour.\n\nSent as batch " . $batch . ":\n" . implode("\n", $lines) . "\n\n" . $SITE_URL . '/edit/queue/');
        }
      }
    }
  }
  header('Location: ./?said=' . rawurlencode($msg), true, 303);
  exit;
}
?>
