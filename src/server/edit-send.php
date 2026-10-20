<?php
// Receives copy edits made in edit mode. Generated into edit/send.php by build.mjs, which fills in the four marked
// lines below (the mailer, the config, the sign-in check, the GitHub helpers from gh.php); edit this file, not the copy in dist/.
//
//   POST {edits, name, note}                      emails the changes with a complete data/copy.json (the old way)
//   POST {action: "publish", edits, name}         writes data/copy.json to the repository on GitHub; the publish
//                                                 Action then builds and deploys it, so the site changes within minutes
//   GET  ?action=versions                         the last published versions, and the sentences taken off the page
//   POST {action: "restore", sha}                 puts a published version back, as a new commit
//
// Publishing needs a token in a file next to the public folder, phillyafterschool-github.key: a fine-grained GitHub
// token that can read and write this one repository's contents and nothing else. It is put there by hand and is
// never in this repository. Without it, publishing says so and the email path still works.
/*MAILER*/
/*CONFIG*/
/*AUTH*/
function out($ok, $msg, $code, $extra = array()) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(array_merge(array('ok' => $ok, 'message' => $msg), $extra), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function tidy($v, $max) {
  if (!is_string($v)) return '';
  $v = strip_tags(str_replace(chr(0), '', $v));
  $v = trim(preg_replace('/\s+/u', ' ', $v));
  return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}
function signed_in_here() { return function_exists('edit_signed_in') ? edit_signed_in() : true; }

/*GH*/
// The copy file as the repository holds it now: its entries and the sha a write must quote.
function gh_copy_file($ref) {
  $f = gh_file('data/copy.json', $ref);
  if ($f === null) return null;
  $entries = $f[0] === '' ? array() : json_decode($f[0], true);
  if (!is_array($entries)) $entries = array();
  return array($entries, $f[1]);
}
function copy_json($entries) {
  if (!count($entries)) return "{}\n";
  $json = json_encode($entries, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  // the repository keeps two-space indents
  return preg_replace_callback('/^(?: {4})+/m', function ($m) { return str_repeat('  ', (int) (strlen($m[0]) / 4)); }, $json) . "\n";
}
function gh_write_copy($entries, $sha, $message) {
  return gh_put('data/copy.json', copy_json($entries), $sha, $message, 'main');
}
// At most 30 publishes an hour, so a loop in a browser can’t fill the repository’s history.
function publish_allowed() { return gh_allowed('publish', 30); }
function note($line) {
  $log = dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-copy-edits.log';
  @file_put_contents($log, date('c') . ' ' . $line . "\n", FILE_APPEND | LOCK_EX);
}
function record_email($subject, $body) {
  global $TO, $SITE;
  $headers = array('From: ' . $SITE . ' <' . $TO . '>', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64');
  return pas_postmark($SITE, $TO, $TO, $subject, $body) === 1 || @mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', chunk_split(base64_encode($body)), implode("\r\n", $headers));
}

// ----- which request -----
$action = '';
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $action = isset($_GET['action']) && is_string($_GET['action']) ? $_GET['action'] : '';
  if ($action !== 'versions') out(false, 'Use the editor on the site.', 405);
  $in = array();
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $in = json_decode(file_get_contents('php://input'), true);
  if (!is_array($in)) out(false, 'There was nothing to send.', 400);
  $action = isset($in['action']) && is_string($in['action']) ? $in['action'] : 'send';
} else {
  out(false, 'Use the editor on the site.', 405);
}
if (!signed_in_here()) out(false, 'You are signed out.', 401);

// ----- versions: what has been published, and what is off the page -----
if ($action === 'versions') {
  $removed = array();
  foreach ((is_array($OVERRIDES) ? $OVERRIDES : array()) as $id => $e) {
    if (is_array($e) && isset($e['now']) && $e['now'] === '' && isset($ORIGINAL[$id])) $removed[] = array('id' => $id, 'was' => $ORIGINAL[$id]);
  }
  if (!gh_ready()) out(true, '', 200, array('ready' => false, 'versions' => array(), 'removed' => $removed));
  list($code, $r) = gh('GET', '/repos/' . $REPO . '/commits?path=data/copy.json&sha=main&per_page=15');
  if ($code !== 200 || !is_array($r)) out(true, 'GitHub did not answer (HTTP ' . $code . ').', 200, array('ready' => true, 'versions' => array(), 'removed' => $removed));
  $versions = array();
  foreach ($r as $c) {
    if (!is_array($c) || !isset($c['sha'])) continue;
    $msg = isset($c['commit']['message']) ? (string) $c['commit']['message'] : '';
    $versions[] = array('sha' => substr((string) $c['sha'], 0, 7), 'full' => (string) $c['sha'], 'date' => isset($c['commit']['committer']['date']) ? (string) $c['commit']['committer']['date'] : '', 'title' => trim(strtok($msg, "\n")));
  }
  out(true, '', 200, array('ready' => true, 'versions' => $versions, 'removed' => $removed, 'repo' => $REPO));
}

// ----- restore: a published version back on top, as a new commit -----
if ($action === 'restore') {
  if (!gh_ready()) out(false, 'Publishing is not set up on the server yet.', 503);
  $sha = isset($in['sha']) && is_string($in['sha']) ? $in['sha'] : '';
  if (!preg_match('/^[0-9a-f]{7,40}$/', $sha)) out(false, 'Which version?', 400);
  if (!publish_allowed()) out(false, 'That is enough publishing for one hour. Try again later.', 429);
  $old = gh_copy_file($sha);
  if ($old === null) out(false, 'That version could not be read from GitHub.', 502);
  $cur = gh_copy_file('main');
  if ($cur === null) out(false, 'The current file could not be read from GitHub.', 502);
  if (copy_json($old[0]) === copy_json($cur[0])) out(false, 'That version is the one on the site already.', 400);
  $name = tidy(isset($in['name']) ? $in['name'] : '', 60);
  list($ok, $what, $url) = gh_write_copy($old[0], $cur[1], 'Copy: the version from ' . substr($sha, 0, 7) . ' put back' . ($name !== '' ? ' by ' . $name : '') . ', ' . gmdate('j M Y'));
  if (!$ok) out(false, $what, 502);
  note('restored ' . substr($sha, 0, 7) . ' as ' . $what);
  out(true, 'Restored. The site updates in a few minutes.', 200, array('commit' => $what, 'url' => $url));
}

// ----- send and publish share the merge: the changes on top of what is already there -----
if (!isset($in['edits']) || !is_array($in['edits'])) out(false, 'There was nothing to send.', 400);
// A hidden field people never fill in. If it has a value, a bot did it: act as if it worked.
if (isset($in['company']) && $in['company'] !== '') out(true, 'Sent.', 200);
$name = tidy(isset($in['name']) ? $in['name'] : '', 60);
$note = tidy(isset($in['note']) ? $in['note'] : '', 1000);

$publishing = $action === 'publish';
if ($publishing && !gh_ready()) out(false, 'Publishing from here is not set up yet: the key file is missing on the server. The changes can still be sent by email.', 503, array('ready' => false));
$sha = '';
if ($publishing) {
  $cur = gh_copy_file('main');
  if ($cur === null) out(false, 'The current file could not be read from GitHub.', 502);
  $merged = $cur[0]; $sha = $cur[1];
} else {
  $merged = is_array($OVERRIDES) ? $OVERRIDES : array();
}
$lines = array();
$n = 0;
foreach (array_slice($in['edits'], 0, 300) as $e) {
  if (!is_array($e) || !isset($e['id']) || !is_string($e['id']) || !isset($ORIGINAL[$e['id']])) continue;
  $id = $e['id'];
  $remove = isset($e['remove']) && $e['remove'] === true;
  $now = $remove ? '' : tidy(isset($e['now']) ? $e['now'] : '', 800);
  $shown = isset($merged[$id]['now']) ? $merged[$id]['now'] : $ORIGINAL[$id];
  if (!$remove && ($now === '' || $now === $shown)) continue;
  if ($remove && $shown === '') continue;
  $page = tidy(isset($e['page']) ? $e['page'] : '', 120);
  $n++;
  $line = "$n." . ($page !== '' ? " On $page" : '') . "\n   Was: " . ($shown === '' ? '(off the page)' : $shown) . "\n   Now: " . ($remove ? '(taken off the page)' : $now) . "\n";
  if (!$remove && preg_match_all('/\{\w+\}/', $ORIGINAL[$id], $m)) {
    foreach (array_unique($m[0]) as $token) {
      if (strpos($now, $token) === false) $line .= "   CHECK: the original has $token, which is filled in for each page. The new wording leaves it out.\n";
    }
  }
  $lines[] = $line;
  if (!$remove && $now === $ORIGINAL[$id]) unset($merged[$id]);
  else $merged[$id] = array('was' => $ORIGINAL[$id], 'now' => $now);
}
if ($n === 0) out(false, 'Those changes are already on the site, or this page is out of date. Refresh the page and check.', 400);
$count = "$n " . ($n === 1 ? 'change' : 'changes');

if ($publishing) {
  if (!publish_allowed()) out(false, 'That is enough publishing for one hour. Try again later.', 429);
  $message = "Copy: $count" . ($name !== '' ? " by $name" : '') . ', ' . gmdate('j M Y') . "\n\n" . implode("\n", array_slice($lines, 0, 40));
  list($ok, $what, $url) = gh_write_copy($merged, $sha, $message);
  if (!$ok) { note('publish failed: ' . $what); out(false, $what, 502); }
  note("published $count as $what" . ($name !== '' ? " by $name" : ''));
  record_email("[$SITE] Copy published" . ($name !== '' ? " by $name" : '') . " ($n)", "Published to the site as commit $what" . ($url !== '' ? "\n$url" : '') . "\n\n" . implode("\n", $lines));
  out(true, "Published $count. The site updates in a few minutes.", 200, array('commit' => $what, 'url' => $url, 'n' => $n));
}

// the email path, as before: a readable list and a complete data/copy.json to paste in
$json = count($merged) ? rtrim(copy_json($merged)) : '{}';
$body = "Copy edits" . ($name !== '' ? " from $name" : '') . ": $count.\n\n"
  . ($note !== '' ? "Note: $note\n\n" : '')
  . implode("\n", $lines)
  . "\nTo publish all of them, replace everything in data/copy.json with the text between the two lines below, then commit.\n"
  . ($REPO !== '' ? "https://github.com/$REPO/edit/main/data/copy.json\n" : '')
  . "It already includes edits approved earlier. To leave one out, delete its entry before you paste. An entry whose \"now\" is empty takes that sentence off the page.\n\n"
  . "-----8<----- copy.json starts on the next line\n"
  . $json . "\n"
  . "-----8<----- copy.json ended on the line above\n";
$sent = record_email("[$SITE] Copy edits" . ($name !== '' ? " from $name" : '') . " ($n)", $body);
$log = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-copy-edits.log';
@file_put_contents($log, date('c') . ($sent ? ' (emailed)' : ' (EMAIL FAILED)') . "\n" . $body . "----\n", FILE_APPEND | LOCK_EX);
if (!$sent) out(false, 'The email did not go out.', 500);
out(true, 'Sent.', 200);
