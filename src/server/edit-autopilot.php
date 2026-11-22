<?php
// What the autopilot merged (scaling plan, Phase 3): every run pull request that went live, newest first, by the
// autopilot or by hand, with what it changed (from its evidence file: the listing, the value before and after, the
// provider's page and the quote) and Undo. Undo takes back the whole pull request: GitHub makes the revert, the site's
// key merges it, and the site republishes. Where an email about the change may already have gone out, the entry says
// so, because an email can't be recalled. Generated into edit/autopilot/index.php by build.mjs, which fills in the
// marked lines (the config, the sign-in check, the GitHub helpers, the autopilot code) and lays out the page from the
// parts after /*HERO*/ and /*BODY*/; edit this file, not the copy in dist/. Only a site admin's account can undo.
/*CONFIG*/
/*AUTH*/
/*GH*/
/*AUTOPILOT*/
if (!edit_signed_in()) { header('Location: ../', true, 303); exit; }
$db = edit_db();
$admin = edit_admin() !== '';
$ctx = array('db' => $db, 'gh' => 'gh', 'repo' => $REPO, 'branches' => $AP['branches'], 'authors' => $AP['authors'], 'allow' => $AP['allow'], 'evidenceDir' => $AP['evidenceDir'], 'site' => $SITE_URL);
$ready = $db !== null && gh_ready();
$csrf = hash_hmac('sha256', 'autopilot-form', edit_key());
$said = isset($_GET['said']) && is_string($_GET['said']) ? substr($_GET['said'], 0, 400) : '';
$confirm = isset($_GET['confirm']) ? (int) $_GET['confirm'] : 0;
function ae($v) { return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8'); }
function awhen($t) { $d = new DateTime('@' . (int) $t); $d->setTimezone(new DateTimeZone('America/New_York')); return $d->format('M j, g:i a'); }
function alabel($key) { global $LABELS; return isset($LABELS[$key]) ? $LABELS[$key] : (string) $key; }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $ok = isset($_POST['csrf']) && is_string($_POST['csrf']) && hash_equals($csrf, $_POST['csrf']);
  $do = isset($_POST['do']) && is_string($_POST['do']) ? $_POST['do'] : '';
  $pr = isset($_POST['pr']) ? (int) $_POST['pr'] : 0;
  $msg = 'That didn’t go through. Try again.'; $jump = '';
  if ($ok && $do === 'undo' && !$admin) $msg = 'Only a site admin’s account can undo.';
  elseif ($ok && !$ready) $msg = 'GitHub can’t be reached from here: the key file is missing on the server.';
  elseif ($ok && $do === 'undo' && $pr > 0) {
    if (!gh_allowed('needs-write', 30)) $msg = 'That’s a lot of changes in one hour. Wait a little and try again.';
    else { list($done, $msg) = ap_undo($ctx, $pr); $jump = '#pr-' . $pr; }
  } elseif ($ok && $do === 'sync') {
    if (!gh_allowed('needs-sync', 20)) $msg = 'That’s a lot of looks in one hour. Wait a little.';
    else { $s = ap_sync($ctx, true); $msg = $s['state'] === 'synced' ? 'Looked at GitHub just now.' : 'GitHub couldn’t be read (' . (isset($s['why']) ? $s['why'] : $s['state']) . ').'; }
  }
  header('Location: ./?said=' . rawurlencode($msg) . $jump, true, 303);
  exit;
}

if ($ready) { ap_sync($ctx); ap_undo_check($ctx); }
$merges = $db !== null ? ap_merges($db, 40) : array();
$synced = $db !== null ? (int) ap_meta($db, 'ap_synced') : 0;
$why = $db !== null ? ap_meta($db, 'ap_why') : '';
?>
/*HERO*/
    <h1>What the autopilot merged</h1>
    <p class="lede">Every run pull request that went live, newest first: what it changed, the quote from the provider’s own page, and Undo. Undo takes back the whole pull request, and the site republishes in a few minutes.</p>
/*BODY*/
<div class="prose stats needs" data-autopilot-page>
<?php if ($said !== '') { ?><p class="flag"><?php echo ae($said); ?></p><?php } ?>
  <form method="post" action="./" class="actions needs-sync"><input type="hidden" name="csrf" value="<?php echo ae($csrf); ?>">
    <span class="hint"><?php if (!$ready) { ?>GitHub can’t be read from here: the key file is missing on the server.<?php } elseif ($synced > 0) { ?>Looked at GitHub <?php echo ae(awhen($synced)); ?>.<?php if ($why !== '') { ?> <b>The last look failed (<?php echo ae($why); ?>).</b><?php } ?><?php } else { ?>Not looked at GitHub yet.<?php } ?></span>
    <?php if ($ready) { ?><button class="btn" type="submit" name="do" value="sync">Look again</button><?php } ?>
  </form>
  <p class="hint">An email that already went out can’t be recalled. Each entry says when one may have: an answer to whoever sent the item in, or the morning date, note and new-school emails.</p>
  <?php if (!$merges) { ?><p class="hint">No run pull request has been merged since this page began keeping track.</p><?php } ?>
  <?php foreach ($merges as $m) { $mails = ap_emailed($db, $m); $bot = $m['merged_by'] === AP_BOT; ?><div class="panel needs-item" id="pr-<?php echo (int) $m['pr']; ?>">
    <h3><?php echo ae($m['title']); ?></h3>
    <p class="hint">#<?php echo (int) $m['pr']; ?> · <code><?php echo ae($m['branch']); ?></code> · merged <?php echo ae(awhen($m['merged'])); ?> <?php echo $bot ? 'by the autopilot' : 'by hand'; ?> · <a href="https://github.com/<?php echo ae($REPO); ?>/pull/<?php echo (int) $m['pr']; ?>" rel="noopener" target="_blank">on GitHub</a></p>
    <?php if ((int) $m['undone'] > 0) { ?><p class="flag"><b>Undone</b> <?php echo ae(awhen($m['undone'])); ?>, by <a href="https://github.com/<?php echo ae($REPO); ?>/pull/<?php echo (int) $m['undo_pr']; ?>" rel="noopener" target="_blank">#<?php echo (int) $m['undo_pr']; ?></a>.</p><?php } elseif ((int) $m['undo_pr'] > 0) { ?><p class="flag">An undo is waiting to merge: <a href="https://github.com/<?php echo ae($REPO); ?>/pull/<?php echo (int) $m['undo_pr']; ?>" rel="noopener" target="_blank">#<?php echo (int) $m['undo_pr']; ?></a>.</p><?php } ?>
    <?php if ((int) $m['evidence'] === 1 && $m['list']) { ?>
    <ul class="ap-changes"><?php foreach (array_slice($m['list'], 0, 12) as $c) { ?><li><b><?php echo ae(alabel($c['listing'])); ?></b> · <code><?php echo ae($c['path'] === '' ? '(the whole listing)' : $c['path']); ?></code>: <?php echo ae($c['old'] === '' ? '(nothing)' : $c['old']); ?> → <b><?php echo ae($c['new'] === '' ? '(nothing)' : $c['new']); ?></b><?php if ($c['quote'] !== '') { ?><blockquote><?php echo ae($c['quote']); ?></blockquote><?php } ?><?php if ($c['source'] !== '') { ?><span class="hint">From <a href="<?php echo ae($c['source']); ?>" rel="noopener nofollow" target="_blank"><?php echo ae($c['source']); ?></a></span><?php } ?></li><?php } ?></ul>
    <?php if (count($m['list']) > 12) { ?><details><summary>And <?php echo count($m['list']) - 12; ?> more</summary><ul class="ap-changes"><?php foreach (array_slice($m['list'], 12) as $c) { ?><li><b><?php echo ae(alabel($c['listing'])); ?></b> · <code><?php echo ae($c['path']); ?></code>: <?php echo ae($c['old'] === '' ? '(nothing)' : $c['old']); ?> → <b><?php echo ae($c['new'] === '' ? '(nothing)' : $c['new']); ?></b></li><?php } ?></ul></details><?php } ?>
    <?php } elseif ((int) $m['evidence'] === -1) { ?><p class="hint">No evidence file: it came before evidence files began<?php echo (int) $m['changes'] > 0 ? ', or it had nothing a quote could vouch for. The gate counted ' . (int) $m['changes'] . ' change' . ((int) $m['changes'] === 1 ? '' : 's') . '.' : '.'; ?> Open it on GitHub to see each one.</p>
    <?php } else { ?><p class="hint">What it changed hasn’t been read from GitHub yet. It will be on the next look.</p><?php } ?>
    <?php foreach ($mails as $line) { ?><p class="hint">✉ <?php echo ae($line); ?></p><?php } ?>
    <?php if ($admin && $ready && (int) $m['undone'] === 0) { ?>
      <?php if ($confirm === (int) $m['pr']) { ?><form method="post" action="./" class="panel needs-confirm"><input type="hidden" name="csrf" value="<?php echo ae($csrf); ?>"><input type="hidden" name="pr" value="<?php echo (int) $m['pr']; ?>">
        <p><b>Undo #<?php echo (int) $m['pr']; ?>?</b> Everything it changed<?php echo (int) $m['evidence'] === 1 && $m['list'] ? ' (' . count($m['list']) . ' change' . (count($m['list']) === 1 ? '' : 's') . ')' : ''; ?> goes back to how it was before, and the site republishes in a few minutes.<?php if ($mails) { ?> Emails already sent stay sent.<?php } ?></p>
        <div class="actions"><button class="btn primary" type="submit" name="do" value="undo">Yes, undo it</button><a class="btn" href="./#pr-<?php echo (int) $m['pr']; ?>">Keep it</a></div>
      </form><?php } else { ?><p class="actions"><a class="btn" href="./?confirm=<?php echo (int) $m['pr']; ?>#pr-<?php echo (int) $m['pr']; ?>">Undo…</a></p><?php } ?>
    <?php } ?>
  </div><?php } ?>
  <p><a class="btn" href="../needs/">Needs you</a> <a class="btn" href="../">Back to editing</a></p>
</div>
