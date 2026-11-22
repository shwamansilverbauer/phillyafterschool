// ----- the autopilot, as the owner sees it (scaling plan, Phase 3) -----
// Shared by groups/api.php (the morning summary, in push_run) and the owner's pages edit/needs/ (the Needs-you page)
// and edit/autopilot/ (every merge, with Undo). build.mjs pastes this file in at each one's /*AUTOPILOT*/ marker;
// edit it here. Nothing here sends an email.
//
// What it knows about the research runs comes from GitHub, through the key file /edit/ publishes with: their pull
// requests (a branch starting with one of $ctx['branches'], from this repository, by one of $ctx['authors']), the
// gate's comment on each (scripts/gate.mjs leaves <!-- pas-gate {...} --> in it with its verdict; only a comment by
// the workflow's own account counts, since anyone can comment on a public repository), the evidence file each merged
// one brought (evidence/<branch>.json at its merge), and the switch, data/autopilot.json on main. A copy is kept in
// the accounts database (ap_prs, ap_changes), refreshed at most every few minutes, so the pages open fast and the
// summary can count. Approve, Decline, Undo and the switch write to GitHub with the same key.
//
// $ctx, given by the caller: db (the accounts database), gh (a function(method, path, body) that calls GitHub's API
// with the key file and gives array(status, decoded answer)), repo ("owner/name" of the public repository), branches,
// authors, allow and evidenceDir (from scripts/gate.config.json), site (the site's address).
const AP_MODES = array('off', 'shadow', 'on');
const AP_SWITCH = 'data/autopilot.json';
const AP_BOT = 'github-actions[bot]';   // who GitHub credits a merge or a comment by a workflow's own token to: the gate
const AP_SYNC_EVERY = 300;              // seconds between looks at GitHub, unless asked for now
const AP_LOOK = 60;                     // pull requests read per look, most recently changed first
const AP_DETAILS_A_SYNC = 12;           // pull requests whose comments, merger or evidence are fetched per look; the rest next time

function ap_meta(PDO $db, string $k): string {
  try { $st = $db->prepare('SELECT v FROM meta WHERE k = ?'); $st->execute(array($k)); $v = $st->fetchColumn(); return $v === false ? '' : (string) $v; } catch (Exception $e) { return ''; }
}
function ap_meta_set(PDO $db, string $k, string $v): void {
  try { $db->prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute(array($k, $v)); } catch (Exception $e) { /* a read-only database: nothing remembered */ }
}
// ap_prs: one row per run pull request. state: open, merged or closed. held: it carries the needs-josh label. gate,
// gate_head, gate_mode, gate_body, gate_at, changes, listings, publish, held_n: from the gate's comment. seen: the
// updated_at GitHub gave when the comment was last read. merged_by: the GitHub login that merged it (AP_BOT is the
// autopilot). evidence: 0 not read yet, 1 read into ap_changes, -1 none. undo_pr: the pull request that takes it back;
// undone: when that was merged. ap_changes: each changed value a merged run brought, from its evidence file (provider
// quotes only), and when the owner said it looked right.
function ap_schema(PDO $db): void {
  $db->exec("CREATE TABLE IF NOT EXISTS ap_prs (pr INTEGER PRIMARY KEY, branch TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'open', head TEXT NOT NULL DEFAULT '', node TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL DEFAULT '', closed INTEGER NOT NULL DEFAULT 0, merged INTEGER NOT NULL DEFAULT 0, merged_by TEXT NOT NULL DEFAULT '', merge_sha TEXT NOT NULL DEFAULT '', held INTEGER NOT NULL DEFAULT 0, seen TEXT NOT NULL DEFAULT '', gate TEXT NOT NULL DEFAULT '', gate_head TEXT NOT NULL DEFAULT '', gate_mode TEXT NOT NULL DEFAULT '', gate_body TEXT NOT NULL DEFAULT '', gate_at TEXT NOT NULL DEFAULT '', changes INTEGER NOT NULL DEFAULT 0, listings INTEGER NOT NULL DEFAULT 0, publish INTEGER NOT NULL DEFAULT 0, held_n INTEGER NOT NULL DEFAULT 0, evidence INTEGER NOT NULL DEFAULT 0, undo_pr INTEGER NOT NULL DEFAULT 0, undone INTEGER NOT NULL DEFAULT 0)");
  $db->exec("CREATE TABLE IF NOT EXISTS ap_changes (pr INTEGER NOT NULL, n INTEGER NOT NULL, item TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT '', listing TEXT NOT NULL DEFAULT '', path TEXT NOT NULL DEFAULT '', old TEXT NOT NULL DEFAULT '', new TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', quote TEXT NOT NULL DEFAULT '', looked INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (pr, n))");
  $db->exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
}
function ap_time($iso): int { $t = is_string($iso) && $iso !== '' ? strtotime($iso) : false; return $t === false ? 0 : (int) $t; }
function ap_cut($s, int $max): string { $s = trim((string) preg_replace('/\s+/u', ' ', (string) $s)); return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max); }
function ap_run_branch(array $ctx, string $ref): bool { foreach ($ctx['branches'] as $b) if ($b !== '' && strpos($ref, (string) $b) === 0) return true; return false; }
// Whether a pull request, as GitHub's API gives it, is one of the runs': the same test the gate applies (eligible()).
function ap_is_run(array $ctx, $p): bool {
  if (!is_array($p) || !isset($p['number'], $p['head']['ref'], $p['base']['ref'])) return false;
  if ((string) $p['base']['ref'] !== 'main' || !ap_run_branch($ctx, (string) $p['head']['ref'])) return false;
  if ((isset($p['head']['repo']['full_name']) ? (string) $p['head']['repo']['full_name'] : '') !== $ctx['repo']) return false;   // a fork is never a run
  $who = isset($p['user']['login']) ? (string) $p['user']['login'] : '';
  return !$ctx['authors'] || in_array($who, $ctx['authors'], true);
}
// The gate's own comment among a pull request's comments: the last one by the workflow's account with the gate's mark.
function ap_gate_comment($comments): ?array {
  $mine = null;
  foreach (is_array($comments) ? $comments : array() as $c) {
    if (!is_array($c) || !isset($c['body']) || (isset($c['user']['login']) ? (string) $c['user']['login'] : '') !== AP_BOT) continue;
    if (!preg_match('/<!-- pas-gate (\{.*?\}) -->/s', (string) $c['body'], $m)) continue;
    $meta = json_decode($m[1], true);
    if (!is_array($meta)) continue;
    $mine = array('meta' => $meta, 'body' => (string) $c['body'], 'at' => isset($c['updated_at']) ? (string) $c['updated_at'] : (isset($c['created_at']) ? (string) $c['created_at'] : ''));
  }
  return $mine;
}

// One look at GitHub: the runs' pull requests changed since the last look, the gate's comment on each, who merged the
// merged ones, and their evidence. At most every AP_SYNC_EVERY seconds unless $force. Gives a short state.
function ap_sync(array $ctx, bool $force = false): array {
  $db = $ctx['db'];
  if ($db === null || $ctx['repo'] === '') return array('state' => 'off');
  try { ap_schema($db); } catch (Exception $e) { return array('state' => 'failed', 'why' => 'database'); }
  if (!$force && (int) ap_meta($db, 'ap_synced') > time() - AP_SYNC_EVERY) return array('state' => 'fresh');
  ap_meta_set($db, 'ap_synced', (string) time());
  $gh = $ctx['gh'];
  list($code, $list) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls?state=all&sort=updated&direction=desc&per_page=' . AP_LOOK, null);
  if ($code !== 200 || !is_array($list)) {
    $why = $code === 401 ? 'refused' : ($code === 0 ? 'no answer' : 'github ' . $code);
    ap_meta_set($db, 'ap_why', $why);
    return array('state' => 'failed', 'why' => $why);
  }
  ap_meta_set($db, 'ap_why', '');
  $known = array();
  foreach ($db->query('SELECT pr, seen, merged_by, evidence, state FROM ap_prs')->fetchAll(PDO::FETCH_ASSOC) as $r) $known[(int) $r['pr']] = $r;
  $up = $db->prepare("INSERT INTO ap_prs (pr, branch, title, author, state, head, node, created, updated, closed, merged, merge_sha, held) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pr) DO UPDATE SET branch = excluded.branch, title = excluded.title, author = excluded.author, state = excluded.state, head = excluded.head, node = excluded.node, updated = excluded.updated, closed = excluded.closed, merged = excluded.merged, merge_sha = excluded.merge_sha, held = excluded.held");
  $res = array('state' => 'synced', 'prs' => 0, 'comments' => 0, 'mergers' => 0, 'evidence' => 0);
  $budget = AP_DETAILS_A_SYNC;
  foreach ($list as $p) {
    if (!ap_is_run($ctx, $p)) continue;
    $n = (int) $p['number'];
    $state = !empty($p['merged_at']) ? 'merged' : ((string) $p['state'] === 'closed' ? 'closed' : 'open');
    $held = 0;
    foreach (isset($p['labels']) && is_array($p['labels']) ? $p['labels'] : array() as $l) if (is_array($l) && isset($l['name']) && $l['name'] === 'needs-josh') $held = 1;
    $updated = isset($p['updated_at']) ? (string) $p['updated_at'] : '';
    $up->execute(array($n, (string) $p['head']['ref'], ap_cut(isset($p['title']) ? $p['title'] : '', 200), isset($p['user']['login']) ? (string) $p['user']['login'] : '', $state,
      isset($p['head']['sha']) ? (string) $p['head']['sha'] : '', isset($p['node_id']) ? (string) $p['node_id'] : '', ap_time(isset($p['created_at']) ? $p['created_at'] : ''), $updated,
      ap_time(isset($p['closed_at']) ? $p['closed_at'] : ''), ap_time(isset($p['merged_at']) ? $p['merged_at'] : ''), isset($p['merge_commit_sha']) ? (string) $p['merge_commit_sha'] : '', $held));
    $res['prs']++;
    $was = isset($known[$n]) ? $known[$n] : null;
    // The gate's comment, when the pull request has changed since it was last read.
    if ($budget > 0 && (!$was || (string) $was['seen'] !== $updated)) {
      $budget--;
      list($c, $comments) = $gh('GET', '/repos/' . $ctx['repo'] . '/issues/' . $n . '/comments?per_page=100', null);
      if ($c === 200) {
        $g = ap_gate_comment($comments);
        if ($g !== null) {
          $m = $g['meta'];
          $num = function ($k) use ($m) { return isset($m[$k]) && is_int($m[$k]) ? max(0, $m[$k]) : 0; };
          $db->prepare('UPDATE ap_prs SET gate = ?, gate_head = ?, gate_mode = ?, gate_body = ?, gate_at = ?, changes = ?, listings = ?, publish = ?, held_n = ? WHERE pr = ?')
            ->execute(array(isset($m['verdict']) && in_array($m['verdict'], array('publish', 'held', 'nothing'), true) ? $m['verdict'] : '', isset($m['head']) && is_string($m['head']) ? substr($m['head'], 0, 40) : '',
              isset($m['mode']) && in_array($m['mode'], AP_MODES, true) ? $m['mode'] : '', substr($g['body'], 0, 20000), $g['at'], $num('changes'), $num('listings'), $num('publish'), $num('held'), $n));
        }
        $db->prepare('UPDATE ap_prs SET seen = ? WHERE pr = ?')->execute(array($updated, $n));
        $res['comments']++;
      }
    }
    // Who merged it: the list doesn't say, the pull request itself does. Asked once.
    if ($state === 'merged' && $budget > 0 && (!$was || (string) $was['merged_by'] === '')) {
      $budget--;
      list($c, $full) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $n, null);
      if ($c === 200 && is_array($full)) {
        $by = isset($full['merged_by']['login']) ? (string) $full['merged_by']['login'] : '?';
        $db->prepare('UPDATE ap_prs SET merged_by = ? WHERE pr = ?')->execute(array($by, $n));
        $res['mergers']++;
      }
    }
    // What it changed, from its evidence file as merged. Read once.
    if ($state === 'merged' && $budget > 0 && (!$was || (int) $was['evidence'] === 0)) {
      $budget--;
      $res['evidence'] += ap_evidence($ctx, $n);
    }
  }
  return $res;
}
// A merged run's evidence file, read into ap_changes: for each changed value, where it sits, before and after, the page
// and the quote. Gives 1 when it was read (or found missing), 0 when GitHub didn't answer (tried again next look).
function ap_evidence(array $ctx, int $n): int {
  $db = $ctx['db'];
  $st = $db->prepare('SELECT branch, merge_sha FROM ap_prs WHERE pr = ?'); $st->execute(array($n)); $r = $st->fetch(PDO::FETCH_ASSOC);
  if (!$r || $r['merge_sha'] === '' || !preg_match('/^[A-Za-z0-9._-]{1,120}$/', (string) $r['branch'])) { $db->prepare('UPDATE ap_prs SET evidence = -1 WHERE pr = ?')->execute(array($n)); return 1; }
  $gh = $ctx['gh'];
  list($c, $f) = $gh('GET', '/repos/' . $ctx['repo'] . '/contents/' . $ctx['evidenceDir'] . rawurlencode((string) $r['branch']) . '.json?ref=' . rawurlencode((string) $r['merge_sha']), null);
  if ($c === 404) { $db->prepare('UPDATE ap_prs SET evidence = -1 WHERE pr = ?')->execute(array($n)); return 1; }
  if ($c !== 200 || !is_array($f) || !isset($f['content'])) return 0;
  $doc = json_decode((string) base64_decode(str_replace("\n", '', (string) $f['content'])), true);
  $db->prepare('DELETE FROM ap_changes WHERE pr = ?')->execute(array($n));
  $add = $db->prepare('INSERT INTO ap_changes (pr, n, item, kind, listing, path, old, new, source, quote) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $i = 0;
  $show = function ($v) { if ($v === null) return ''; return is_string($v) ? $v : (string) json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); };
  foreach (is_array($doc) && isset($doc['items']) && is_array($doc['items']) ? $doc['items'] : array() as $it) {
    if (!is_array($it) || !isset($it['fields']) || !is_array($it['fields'])) continue;
    foreach ($it['fields'] as $fl) {
      if (!is_array($fl) || $i >= 300) continue;
      $src = isset($fl['source']) && is_string($fl['source']) && preg_match('~^https?://~i', $fl['source']) ? ap_cut($fl['source'], 400) : '';
      $add->execute(array($n, ++$i, ap_cut(isset($it['item']) ? $it['item'] : '', 60), ap_cut(isset($it['kind']) ? $it['kind'] : '', 20), ap_cut(isset($it['listing']) ? $it['listing'] : '', 90),
        ap_cut(isset($fl['path']) ? $fl['path'] : '', 200), ap_cut($show(isset($fl['old']) ? $fl['old'] : null), 300), ap_cut($show(isset($fl['new']) ? $fl['new'] : null), 300), $src, ap_cut(isset($fl['quote']) ? $fl['quote'] : '', 300)));
    }
  }
  $db->prepare('UPDATE ap_prs SET evidence = 1 WHERE pr = ?')->execute(array($n));
  return 1;
}

// ----- the switch -----
// data/autopilot.json on main, as GitHub has it: array(mode, sha, about), mode '' when it can't be read. Remembered for
// a minute, unless $fresh.
function ap_mode(array $ctx, bool $fresh = false): array {
  $db = $ctx['db'];
  if (!$fresh && $db !== null && (int) ap_meta($db, 'ap_mode_at') > time() - 60) {
    $m = ap_meta($db, 'ap_mode');
    if (in_array($m, AP_MODES, true)) return array('mode' => $m, 'sha' => '', 'about' => '');
  }
  $gh = $ctx['gh'];
  list($c, $f) = $gh('GET', '/repos/' . $ctx['repo'] . '/contents/' . AP_SWITCH . '?ref=main', null);
  if ($c !== 200 || !is_array($f) || !isset($f['content'])) return array('mode' => '', 'sha' => '', 'about' => '', 'why' => $c === 401 ? 'refused' : 'github ' . $c);
  $d = json_decode((string) base64_decode(str_replace("\n", '', (string) $f['content'])), true);
  $m = is_array($d) && isset($d['mode']) && in_array($d['mode'], AP_MODES, true) ? (string) $d['mode'] : 'off';   // the gate reads anything else as off
  if ($db !== null) { ap_meta_set($db, 'ap_mode', $m); ap_meta_set($db, 'ap_mode_at', (string) time()); }
  return array('mode' => $m, 'sha' => isset($f['sha']) ? (string) $f['sha'] : '', 'about' => is_array($d) && isset($d['about']) && is_string($d['about']) ? $d['about'] : '');
}
// Turns the switch: one commit to data/autopilot.json on main, keeping its "about" line and its layout. Marked
// [skip ci]: nothing on the site changes, and the gate reads the file from main the next time it runs.
// Gives array(true, message) or array(false, what went wrong).
function ap_mode_set(array $ctx, string $to): array {
  if (!in_array($to, AP_MODES, true)) return array(false, 'That isn’t one of the three settings.');
  $cur = ap_mode($ctx, true);
  if ($cur['mode'] === '' || $cur['sha'] === '') return array(false, 'The switch couldn’t be read from GitHub. Check the key file on the server, then try again.');
  if ($cur['mode'] === $to) return array(true, 'The autopilot was already ' . $to . '.');
  $about = $cur['about'] !== '' ? $cur['about'] : 'The autopilot switch, read by .github/workflows/autopilot.yml from main: "off", "shadow" or "on". See docs/listings.md, "The autopilot gate".';
  $flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
  $text = "{\n  \"about\": " . json_encode($about, $flags) . ",\n  \"mode\": " . json_encode($to, $flags) . "\n}\n";
  $gh = $ctx['gh'];
  list($c, $r) = $gh('PUT', '/repos/' . $ctx['repo'] . '/contents/' . AP_SWITCH, array('message' => 'Autopilot: ' . $cur['mode'] . ' to ' . $to . ', from the Needs-you page [skip ci]', 'content' => base64_encode($text), 'sha' => $cur['sha'], 'branch' => 'main'));
  if (($c === 200 || $c === 201) && is_array($r) && isset($r['commit']['sha'])) {
    if ($ctx['db'] !== null) { ap_meta_set($ctx['db'], 'ap_mode', $to); ap_meta_set($ctx['db'], 'ap_mode_at', (string) time()); }
    $say = array('off' => 'The autopilot is off: the gate does nothing.', 'shadow' => 'The autopilot is in shadow mode: the gate comments on each run’s pull request and merges nothing.', 'on' => 'The autopilot is on: a run’s pull request with nothing held merges itself, and the site publishes.');
    return array(true, $say[$to] . ' (commit ' . substr((string) $r['commit']['sha'], 0, 7) . ')');
  }
  if ($c === 409) return array(false, 'Someone else changed the switch at the same moment. Look again and try once more.');
  if ($c === 401 || $c === 403) return array(false, 'GitHub refused the key. Check the key file on the server.');
  if ($c === 422) return array(false, 'GitHub refused the commit, most likely the rule on main: the key’s owner must be allowed to bypass it.');
  return array(false, 'GitHub didn’t take the change (HTTP ' . $c . ').');
}

// ----- Approve, Decline, Undo -----
// Approve: merges a run's pull request at the commit the owner was shown, the way the gate would (one squash commit).
// The merge is made with the site's key, not a workflow's token, so GitHub starts the publish by itself. Refused when
// the pull request touches the switch, or anything but data and its evidence: those are merged on GitHub, by hand.
function ap_approve(array $ctx, int $n, string $head): array {
  $gh = $ctx['gh'];
  list($c, $p) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $n, null);
  if ($c !== 200 || !is_array($p)) return array(false, 'GitHub couldn’t be read (HTTP ' . $c . '). Try again in a minute.');
  if (!ap_is_run($ctx, $p)) return array(false, 'Pull request #' . $n . ' isn’t one of the runs’, so it isn’t merged from here.');
  if (!empty($p['merged'])) return array(true, '#' . $n . ' was already merged.');
  if ((string) $p['state'] !== 'open') return array(false, '#' . $n . ' is closed.');
  if (!preg_match('/^[0-9a-f]{40}$/', $head) || (isset($p['head']['sha']) ? (string) $p['head']['sha'] : '') !== $head) return array(false, '#' . $n . ' has changed since this page was opened. Look at it again before approving.');
  list($c, $files) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $n . '/files?per_page=100', null);
  if ($c !== 200 || !is_array($files)) return array(false, 'GitHub couldn’t list what #' . $n . ' changes (HTTP ' . $c . ').');
  $evidence = $ctx['evidenceDir'] . (string) $p['head']['ref'] . '.json';
  foreach ($files as $f) {
    $name = is_array($f) && isset($f['filename']) ? (string) $f['filename'] : '';
    if ($name === AP_SWITCH) return array(false, '#' . $n . ' changes the autopilot switch (data/autopilot.json). A run never may, so it isn’t merged from here.');
    if ($name !== $evidence && !in_array($name, $ctx['allow'], true)) return array(false, '#' . $n . ' changes ' . $name . ', which isn’t a data file. Open it on GitHub to read it and merge it there.');
  }
  if (count($files) >= 100) return array(false, '#' . $n . ' changes too many files to check from here. Open it on GitHub.');
  if (isset($p['mergeable']) && $p['mergeable'] === false) return array(false, '#' . $n . ' conflicts with main. The next run brings it up to date.');
  list($c, $r) = $gh('PUT', '/repos/' . $ctx['repo'] . '/pulls/' . $n . '/merge', array('merge_method' => 'squash', 'sha' => $head, 'commit_title' => ap_cut(isset($p['title']) ? $p['title'] : 'Run', 180) . ' (#' . $n . ')', 'commit_message' => 'Approved from the Needs-you page.'));
  if ($c === 200 && is_array($r) && !empty($r['merged'])) {
    if ($ctx['db'] !== null) $ctx['db']->prepare("UPDATE ap_prs SET state = 'merged', merged = ?, merge_sha = ?, held = 0 WHERE pr = ?")->execute(array(time(), isset($r['sha']) ? (string) $r['sha'] : '', $n));
    return array(true, 'Merged #' . $n . '. The site publishes it in a few minutes.');
  }
  if ($c === 409) return array(false, '#' . $n . ' changed while it was being merged. Look at it again.');
  if ($c === 405) return array(false, 'GitHub won’t merge #' . $n . ' yet (it may still be checking it, or it conflicts with main). Try again in a minute.');
  if ($c === 401 || $c === 403) return array(false, 'GitHub refused the key: it needs Pull requests and Contents, read and write, on this repository.');
  return array(false, 'GitHub didn’t merge #' . $n . ' (HTTP ' . $c . ').');
}
// Decline: closes a run's pull request without merging it. Its queue items, if any, then wait for the owner as held.
function ap_decline(array $ctx, int $n): array {
  $gh = $ctx['gh'];
  list($c, $p) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $n, null);
  if ($c !== 200 || !is_array($p)) return array(false, 'GitHub couldn’t be read (HTTP ' . $c . ').');
  if (!ap_is_run($ctx, $p)) return array(false, 'Pull request #' . $n . ' isn’t one of the runs’.');
  if ((string) $p['state'] !== 'open') return array(true, '#' . $n . ' was already closed.');
  list($c, $r) = $gh('PATCH', '/repos/' . $ctx['repo'] . '/pulls/' . $n, array('state' => 'closed'));
  if ($c === 200) {
    if ($ctx['db'] !== null) $ctx['db']->prepare("UPDATE ap_prs SET state = 'closed', closed = ?, held = 0 WHERE pr = ?")->execute(array(time(), $n));
    return array(true, 'Closed #' . $n . ' without merging it. It can be reopened on GitHub.');
  }
  if ($c === 401 || $c === 403) return array(false, 'GitHub refused the key: it needs Pull requests, read and write, on this repository.');
  return array(false, 'GitHub didn’t close #' . $n . ' (HTTP ' . $c . ').');
}
// Undo: takes back everything a merged run changed. GitHub makes the revert itself (as its Revert button does), as a
// pull request, which is then merged with the site's key, so the site republishes. A revert that clashes with a later
// change is refused by GitHub, and nothing changes. Safe to press again: an undo already made is merged, not made twice.
function ap_undo(array $ctx, int $n): array {
  $db = $ctx['db'];
  if ($db === null) return array(false, 'The accounts database isn’t there.');
  $st = $db->prepare("SELECT * FROM ap_prs WHERE pr = ? AND state = 'merged'"); $st->execute(array($n)); $row = $st->fetch(PDO::FETCH_ASSOC);
  if (!$row) return array(false, 'Pull request #' . $n . ' isn’t a merged run.');
  if ((int) $row['undone'] > 0) return array(true, '#' . $n . ' is already undone.');
  $gh = $ctx['gh'];
  $revert = (int) $row['undo_pr']; $head = '';
  if ($revert > 0) {
    list($c, $p) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $revert, null);
    if ($c === 200 && is_array($p) && !empty($p['merged'])) { $db->prepare('UPDATE ap_prs SET undone = ? WHERE pr = ?')->execute(array(max(1, ap_time(isset($p['merged_at']) ? $p['merged_at'] : '')), $n)); return array(true, '#' . $n . ' is already undone, by #' . $revert . '.'); }
    if ($c === 200 && is_array($p) && (string) $p['state'] === 'open') $head = isset($p['head']['sha']) ? (string) $p['head']['sha'] : '';
    else { $revert = 0; $db->prepare('UPDATE ap_prs SET undo_pr = 0 WHERE pr = ?')->execute(array($n)); }   // closed by hand: make a new one
  }
  if ($revert === 0) {
    $node = (string) $row['node'];
    if ($node === '') { list($c, $p) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $n, null); $node = $c === 200 && is_array($p) && isset($p['node_id']) ? (string) $p['node_id'] : ''; }
    if ($node === '') return array(false, 'GitHub couldn’t be read. Try again in a minute.');
    $q = 'mutation($id: ID!, $title: String!, $body: String!) { revertPullRequest(input: {pullRequestId: $id, title: $title, body: $body}) { revertPullRequest { number headRefOid url } } }';
    list($c, $r) = $gh('POST', '/graphql', array('query' => $q, 'variables' => array('id' => $node, 'title' => ap_cut('Undo #' . $n . ': ' . $row['title'], 200), 'body' => 'Undone from the autopilot log (/edit/autopilot/): everything #' . $n . ' changed is put back as it was.')));
    $made = $c === 200 && is_array($r) && isset($r['data']['revertPullRequest']['revertPullRequest']['number']) ? $r['data']['revertPullRequest']['revertPullRequest'] : null;
    if ($made === null) {
      $msg = is_array($r) && isset($r['errors'][0]['message']) ? (string) $r['errors'][0]['message'] : '';
      if ($c === 401 || $c === 403) return array(false, 'GitHub refused the key: it needs Pull requests and Contents, read and write, on this repository.');
      if (preg_match('/conflict|could not|couldn.t|can.t be reverted|cannot be reverted|not be reverted|reverted automatically/iu', $msg)) return array(false, 'GitHub couldn’t take #' . $n . ' back by itself: a later change touched the same lines. Open #' . $n . ' on GitHub and use its Revert button, which shows the clash.');
      return array(false, 'GitHub didn’t make the undo' . ($msg !== '' ? ' (' . ap_cut($msg, 140) . ')' : ' (HTTP ' . $c . ')') . '.');
    }
    $revert = (int) $made['number']; $head = isset($made['headRefOid']) ? (string) $made['headRefOid'] : '';
    $db->prepare('UPDATE ap_prs SET undo_pr = ? WHERE pr = ?')->execute(array($revert, $n));
  }
  // GitHub works out whether a new pull request can merge a moment after it opens: a few tries.
  $c = 0;
  for ($try = 0; $try < 4; $try++) {
    $body = array('merge_method' => 'squash', 'commit_title' => ap_cut('Undo #' . $n . ': ' . $row['title'], 180) . ' (#' . $revert . ')', 'commit_message' => 'Undone from the autopilot log.');
    if ($head !== '') $body['sha'] = $head;
    list($c, $r) = $gh('PUT', '/repos/' . $ctx['repo'] . '/pulls/' . $revert . '/merge', $body);
    if ($c === 200) break;
    if ($c !== 405) break;
    usleep(1500000);
  }
  if ($c === 200) {
    $db->prepare('UPDATE ap_prs SET undone = ? WHERE pr = ?')->execute(array(time(), $n));
    return array(true, 'Undone: #' . $revert . ' put back what #' . $n . ' changed. The site republishes in a few minutes.');
  }
  if ($c === 401 || $c === 403) return array(false, 'The undo is ready as #' . $revert . ', but GitHub refused the key to merge it. Merge it on GitHub.');
  return array(false, 'The undo is ready as #' . $revert . ', but GitHub hasn’t let it merge yet. Press Undo again in a minute, or merge it on GitHub.');
}
// An undo made but not merged yet (GitHub was slow, or it was merged on GitHub): look once more. Gives how many settled.
function ap_undo_check(array $ctx): int {
  $db = $ctx['db']; $n = 0;
  if ($db === null) return 0;
  try { $rows = $db->query("SELECT pr, undo_pr FROM ap_prs WHERE undo_pr > 0 AND undone = 0 LIMIT 5")->fetchAll(PDO::FETCH_ASSOC); } catch (Exception $e) { return 0; }
  $gh = $ctx['gh'];
  foreach ($rows as $r) {
    list($c, $p) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . (int) $r['undo_pr'], null);
    if ($c === 200 && is_array($p) && !empty($p['merged'])) { $db->prepare('UPDATE ap_prs SET undone = ? WHERE pr = ?')->execute(array(max(1, ap_time(isset($p['merged_at']) ? $p['merged_at'] : '')), (int) $r['pr'])); $n++; }
  }
  return $n;
}

// ----- reading what's kept -----
// The run pull requests waiting for the owner: held by the gate, or, while the autopilot isn't on, every open one.
function ap_waiting(PDO $db, string $mode): array {
  try { return $db->query("SELECT * FROM ap_prs WHERE state = 'open'" . ($mode === 'on' ? ' AND held = 1' : '') . ' ORDER BY created DESC, pr DESC')->fetchAll(PDO::FETCH_ASSOC); } catch (Exception $e) { return array(); }
}
// Every merged run, newest first, with what it changed.
function ap_merges(PDO $db, int $limit = 40): array {
  try {
    $rows = $db->query("SELECT * FROM ap_prs WHERE state = 'merged' ORDER BY merged DESC, pr DESC LIMIT " . max(1, $limit))->fetchAll(PDO::FETCH_ASSOC);
    $ch = $db->prepare('SELECT * FROM ap_changes WHERE pr = ? ORDER BY n');
    foreach ($rows as &$r) { $ch->execute(array((int) $r['pr'])); $r['list'] = $ch->fetchAll(PDO::FETCH_ASSOC); }
    unset($r);
    return $rows;
  } catch (Exception $e) { return array(); }
}
// Ten changes the autopilot merged in the last seven days, for the owner to spot-check: a fair pick that stays the
// same all week (each change's place is a hash of the week and the change), undone runs left out.
function ap_spot(PDO $db, string $week, int $want = 10): array {
  try {
    $st = $db->prepare("SELECT c.*, p.title, p.branch, p.merged FROM ap_changes c JOIN ap_prs p ON p.pr = c.pr WHERE p.state = 'merged' AND p.merged_by = ? AND p.merged > ? AND p.undone = 0");
    $st->execute(array(AP_BOT, time() - 7 * 86400));
    $all = $st->fetchAll(PDO::FETCH_ASSOC);
  } catch (Exception $e) { return array(); }
  usort($all, function ($a, $b) use ($week) { return strcmp(hash('sha256', $week . '|' . $a['pr'] . '|' . $a['n']), hash('sha256', $week . '|' . $b['pr'] . '|' . $b['n'])); });
  return array_slice($all, 0, $want);
}
// The shadow report, the same sums scripts/gate.mjs --report makes: each run pull request the gate commented on, what
// it said beside what happened, and whether the test for switching on has been passed (five days since the first
// comment, at least 30 changes judged on decided pull requests, none the gate would have merged that was closed).
function ap_report(PDO $db, string $today): array {
  try { $rows = $db->query("SELECT pr, branch, title, gate, changes, state, gate_at, merged_by FROM ap_prs WHERE gate != '' ORDER BY pr DESC")->fetchAll(PDO::FETCH_ASSOC); } catch (Exception $e) { $rows = array(); }
  $judged = 0; $wrong = array(); $first = '';
  foreach ($rows as $r) {
    $day = substr((string) $r['gate_at'], 0, 10);
    if ($day !== '' && ($first === '' || $day < $first)) $first = $day;
    if ($r['state'] === 'open') continue;
    $judged += (int) $r['changes'];
    if ($r['gate'] === 'publish' && $r['state'] === 'closed') $wrong[] = (int) $r['pr'];
  }
  $days = $first === '' ? 0 : (int) round((strtotime($today . ' 12:00:00 UTC') - strtotime($first . ' 12:00:00 UTC')) / 86400);
  return array('rows' => $rows, 'first' => $first, 'days' => $days, 'judged' => $judged, 'wrong' => $wrong, 'passed' => $days >= 5 && $judged >= 30 && !$wrong);
}
// Whether an email about a merged run may already have gone out, since an undo can't recall one. Senders told "it's on
// the site" are known (queue_items); the date, note and new-school emails go out each morning at about 8, so a run
// that changed those and was merged before the last 8 o'clock may have been in them. Gives sentences, or none.
function ap_emailed(PDO $db, array $row): array {
  $out = array();
  try {
    $st = $db->prepare('SELECT COUNT(*) FROM queue_items WHERE pr = ? AND told > 0'); $st->execute(array((int) $row['pr']));
    $told = (int) $st->fetchColumn();
    if ($told > 0) $out[] = $told . ' ' . ($told === 1 ? 'person who sent something in was' : 'people who sent something in were') . ' emailed that it’s on the site.';
  } catch (Exception $e) { /* no queue yet */ }
  $mails = strpos((string) $row['branch'], 'new-schools-') === 0;
  foreach (isset($row['list']) && is_array($row['list']) ? $row['list'] : array() as $c) {
    if (in_array($c['kind'], array('date', 'note', 'new-school'), true) || preg_match('/^d:/', (string) $c['listing']) || preg_match('/(^|\.)(dates|updates|daysOff)(\[|\.|$)|^register\.(dates|nextTerm)/', (string) $c['path'])) $mails = true;
  }
  if ($mails && (int) $row['merged'] > 0) {
    $tz = new DateTimeZone('America/New_York');
    $eight = new DateTime('@' . (int) $row['merged']); $eight->setTimezone($tz);
    if ((int) $eight->format('G') >= 8) $eight->modify('+1 day');
    $eight->setTime(8, 0);
    if ($eight->getTimestamp() <= time()) $out[] = 'It changed dates, notes or a new school, and the morning emails and notifications went out after it was merged: parents may already have them.';
  }
  return $out;
}

// ----- what else is waiting for the owner (the accounts database) -----
// Claims, photos, words and offers, premium sign-ups and queue items held for a decision: what /edit/claims/ and
// /edit/queue/ show with buttons today. A table from a later version that isn't there yet counts as none.
function needs_held(?PDO $db): array {
  $out = array('claims' => array(), 'photos' => array(), 'extras' => array(), 'premium' => array(), 'queue' => array(), 'mail' => array());
  if ($db === null) return $out;
  $rows = function ($sql) use ($db) { try { return $db->query($sql)->fetchAll(PDO::FETCH_ASSOC); } catch (Exception $e) { return array(); } };
  $out['claims'] = $rows("SELECT c.id, c.listing, c.domain, c.created, u.email, u.first, u.last FROM claims c JOIN users u ON u.id = c.user_id WHERE c.status = 'pending' ORDER BY c.id DESC");
  $out['photos'] = $rows("SELECT p.id, p.listing, p.alt, p.created, p.kind, u.email, u.first, u.last FROM photos p JOIN claims c ON c.id = p.claim_id JOIN users u ON u.id = c.user_id WHERE p.status = 'new' AND c.status = 'ok' ORDER BY p.id DESC");
  if (!$out['photos']) $out['photos'] = $rows("SELECT p.id, p.listing, p.alt, p.created, 'photo' AS kind, u.email, u.first, u.last FROM photos p JOIN claims c ON c.id = p.claim_id JOIN users u ON u.id = c.user_id WHERE p.status = 'new' AND c.status = 'ok' ORDER BY p.id DESC");   // from before logos
  $out['extras'] = $rows("SELECT e.id, e.listing, e.kind, e.body, e.until, e.created, u.email, u.first, u.last FROM extras e JOIN claims c ON c.id = e.claim_id JOIN users u ON u.id = c.user_id WHERE e.status = 'new' AND c.status = 'ok' ORDER BY e.id DESC");
  $out['premium'] = $rows("SELECT a.claim_id, a.plan, a.created, c.listing, u.email, u.first, u.last FROM premium_asks a JOIN claims c ON c.id = a.claim_id JOIN users u ON u.id = c.user_id WHERE c.status = 'ok' AND NOT EXISTS (SELECT 1 FROM premium p WHERE p.listing = c.listing) ORDER BY a.created DESC");
  // An email a run held is shown with the mail (below), with its message and a draft, not here.
  $out['queue'] = $rows("SELECT id, kind, listing, what, pr, reason, decided FROM queue_items WHERE state = 'held' AND substr(id, 1, 1) != 'm' ORDER BY decided DESC");
  // Mail from people the hold list (or a run) kept for the owner (the mailbox, Phase 5). Sealed: the page opens it.
  $out['mail'] = $rows("SELECT id, gid, thread, via, sealed, draft, subject, domain, dkim, listings, shared, account, outreach, attachments, hold, created FROM mail_in WHERE state = 'held' ORDER BY created DESC LIMIT 60");
  return $out;
}
function needs_count(array $held, array $prs): int { $n = count($prs); foreach ($held as $list) $n += count($list); return $n; }

// The gate's comment, from its Markdown to a little safe HTML: headings, lists, bold, code, italics and the small line.
function ap_md(string $md): string {
  $e = function ($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); };
  $inline = function ($s) use ($e) {
    $s = $e($s);
    $s = (string) preg_replace('/`([^`]+)`/', '<code>$1</code>', $s);
    $s = (string) preg_replace('/\*\*([^*]+)\*\*/', '<b>$1</b>', $s);
    $s = (string) preg_replace('/(^|\s)_([^_]+)_(?=\s|$|[.,;:])/', '$1<i>$2</i>', $s);
    return str_replace(array('&lt;sub&gt;', '&lt;/sub&gt;'), array('<small>', '</small>'), $s);
  };
  $out = ''; $depth = 0;
  foreach (preg_split('/\r?\n/', $md) as $line) {
    if (preg_match('/^\s*<!--.*-->\s*$/', $line)) continue;
    if (preg_match('/^(\s*)- (.*)$/', $line, $m)) {
      $want = strlen($m[1]) >= 2 ? 2 : 1;
      while ($depth < $want) { $out .= '<ul>'; $depth++; }
      while ($depth > $want) { $out .= '</ul>'; $depth--; }
      $out .= '<li>' . $inline($m[2]) . '</li>';
      continue;
    }
    while ($depth > 0) { $out .= '</ul>'; $depth--; }
    if (trim($line) === '') continue;
    if (preg_match('/^#{1,4} (.*)$/', $line, $m)) $out .= '<p><b>' . $inline($m[1]) . '</b></p>';
    else $out .= '<p>' . $inline($line) . '</p>';
  }
  while ($depth > 0) { $out .= '</ul>'; $depth--; }
  return $out;
}
