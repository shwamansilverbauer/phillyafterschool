<?php
// The Needs-you page (scaling plan, Phase 3): everything waiting for the owner, on one page built for a phone. Run pull
// requests the gate held (and, while the autopilot isn't on, every open one) with Approve, Decline and Open on GitHub;
// claims, photos, words and offers and premium sign-ups, with the buttons /edit/claims/ has; items a run held, with
// /edit/queue/'s; mail from people the hold list kept (Phase 5), opened, with a draft reply to edit and Send; the
// shadow report while the autopilot is in shadow; ten of the week's autopilot changes to spot-check; and the switch.
// Generated into edit/needs/index.php by build.mjs, which fills in the marked lines (the config, the sign-in check, the
// GitHub helpers, the autopilot code, the mailbox's code) and lays out the page from the parts after /*HERO*/ and
// /*BODY*/; edit this file, not the copy in dist/.
//
// Approve, Decline and the switch write to GitHub with the key file /edit/ publishes with, and only a site admin's
// account can press them (an editor sees the page). Only an admin's account sees the mail and its buttons: Send puts the
// reply in mail_out, and the mailbox script sends it from the site's address within ten minutes. The buttons for
// claims, photos, words, premium and queue items post to those pages' own handlers, which send their emails as before
// and come back here.
/*CONFIG*/
/*AUTH*/
/*GH*/
/*AUTOPILOT*/
/*MAIL*/
if (!edit_signed_in()) { header('Location: ../', true, 303); exit; }
$db = edit_db();
$admin = edit_admin() !== '';
$ctx = array('db' => $db, 'gh' => 'gh', 'repo' => $REPO, 'branches' => $AP['branches'], 'authors' => $AP['authors'], 'allow' => $AP['allow'], 'evidenceDir' => $AP['evidenceDir'], 'site' => $SITE_URL);
$ready = $db !== null && gh_ready();
$NY = new DateTimeZone('America/New_York');
$today = (new DateTime('now', $NY))->format('Y-m-d');
$csrf = hash_hmac('sha256', 'needs-form', edit_key());
$claimsCsrf = hash_hmac('sha256', 'claims-form', edit_key());   // the buttons that post to /edit/claims/
$queueCsrf = hash_hmac('sha256', 'queue-form', edit_key());     // and to /edit/queue/
$mailKey = mail_seal_key(mail_host_secret(dirname((string) $_SERVER['DOCUMENT_ROOT'])));   // opens the held mail
$said = isset($_GET['said']) && is_string($_GET['said']) ? substr($_GET['said'], 0, 400) : '';
function ne($v) { return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8'); }
function nday($t) { $d = new DateTime('@' . (int) $t); $d->setTimezone(new DateTimeZone('America/New_York')); return $d->format('M j'); }
function nwhen($t) { $d = new DateTime('@' . (int) $t); $d->setTimezone(new DateTimeZone('America/New_York')); return $d->format('M j, g:i a'); }
function nlabel($key) { global $LABELS; return isset($LABELS[$key]) ? $LABELS[$key] : (string) $key; }
function nextra($x) {
  $v = json_decode((string) $x['body'], true);
  if ($x['kind'] === 'social' && is_array($v)) { $n = array('ig' => 'Instagram', 'fb' => 'Facebook', 'tt' => 'TikTok', 'yt' => 'YouTube'); $o = array(); foreach ($v as $k => $u) $o[] = (isset($n[$k]) ? $n[$k] : $k) . ': ' . $u; return implode("\n", $o); }
  if ($x['kind'] === 'posts' && is_array($v)) return implode("\n", $v);
  if ($x['kind'] === 'pin' && is_array($v)) return 'Name: ' . (isset($v['n']) ? $v['n'] : '') . "\nPicture: " . (isset($v['i']) ? $v['i'] : '');
  return (string) $x['body'];
}
$ACCOUNT = array('admin' => 'a site admin’s account', 'manager' => 'a program manager’s account', 'parent' => 'a parent’s account', 'none' => 'no account on the site');
$KIND = array('words' => 'In their own words', 'offer' => 'Offer or event line', 'pin' => 'Kids’ Playground pin', 'social' => 'Social links', 'posts' => 'Instagram posts');
$QKIND = array('program' => 'A program that’s missing', 'camp' => 'A camp that’s missing', 'update' => 'An update to a listing', 'proposal' => 'Proposed by the people who run it', 'note' => 'Your note');

// ----- the buttons -----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $ok = isset($_POST['csrf']) && is_string($_POST['csrf']) && hash_equals($csrf, $_POST['csrf']);
  $do = isset($_POST['do']) && is_string($_POST['do']) ? $_POST['do'] : '';
  $pr = isset($_POST['pr']) ? (int) $_POST['pr'] : 0;
  $msg = 'That didn’t go through. Try again.';
  $jump = '';
  $mid = isset($_POST['mail']) ? (int) $_POST['mail'] : 0;
  if ($ok && in_array($do, array('mail_send', 'mail_done', 'mail_queue'), true)) {
    $jump = '#mail';
    $row = null;
    if ($db !== null && $mid > 0) { try { $st = $db->prepare("SELECT id, state FROM mail_in WHERE id = ?"); $st->execute(array($mid)); $row = $st->fetch(PDO::FETCH_ASSOC); } catch (Exception $e) { $row = null; } }
    if (!$admin) $msg = 'Only a site admin’s account can answer mail.';
    elseif (!$row) $msg = 'That email isn’t here any more.';
    elseif ($row['state'] !== 'held') $msg = 'That email was already settled.';
    else {
      try {
        if ($do === 'mail_send') {
          $text = isset($_POST['text']) && is_string($_POST['text']) ? trim(str_replace("\r", '', substr($_POST['text'], 0, 20000))) : '';
          if ($text === '') $msg = 'Write the reply first: it was empty.';
          elseif (!mail_reply_add($db, $mailKey, $mid, $text, 'owner')) $msg = 'The reply couldn’t be queued: the message can’t be opened on this server.';
          else { mail_set_state($db, $mid, 'answered'); mail_settle_item($db, $mid, 'answered', time()); $msg = 'Your reply is on its way. The mailbox script sends it within ten minutes, from the site’s address, in the email’s own thread.'; }
        } elseif ($do === 'mail_done') { mail_set_state($db, $mid, 'closed'); mail_settle_item($db, $mid, 'held', -5); $msg = 'Done: no reply goes out.'; }
        else {
          mail_set_state($db, $mid, 'queued', '');
          $db->prepare("UPDATE queue_items SET state = 'open', outcome = '', told = 0 WHERE id = ? AND state IN ('held', 'waiting')")->execute(array('m' . $mid));
          $msg = 'It goes to the research runs with the next write of the queue, within the hour.';
        }
      } catch (Exception $e) { $msg = 'That couldn’t be saved.'; }
    }
  } elseif ($ok && in_array($do, array('approve', 'decline', 'switch'), true) && !$admin) $msg = 'Only a site admin’s account can do that. You can see everything here, and decide on claims, photos and words.';
  elseif ($ok && !$ready && in_array($do, array('approve', 'decline', 'switch', 'sync'), true)) $msg = 'GitHub can’t be reached from here: the key file is missing on the server.';
  elseif ($ok && in_array($do, array('approve', 'decline', 'switch'), true) && !gh_allowed('needs-write', 30)) $msg = 'That’s a lot of changes in one hour. Wait a little and try again.';
  elseif ($ok && $do === 'approve' && $pr > 0) { list($done, $msg) = ap_approve($ctx, $pr, isset($_POST['head']) && is_string($_POST['head']) ? $_POST['head'] : ''); if (!$done) $jump = '#pr-' . $pr; }
  elseif ($ok && $do === 'decline' && $pr > 0) list($done, $msg) = ap_decline($ctx, $pr);
  elseif ($ok && $do === 'switch') {
    $to = isset($_POST['to']) && is_string($_POST['to']) ? $_POST['to'] : '';
    $passed = $db !== null && ap_report($db, $today)['passed'];
    if ($to === 'on' && !$passed && empty($_POST['anyway'])) { $msg = 'The shadow test hasn’t been passed yet. To switch on anyway, tick the box beside the button.'; $jump = '#switch'; }
    else list($done, $msg) = ap_mode_set($ctx, $to);
  } elseif ($ok && $do === 'looked' && $db !== null) {
    $n = isset($_POST['n']) ? (int) $_POST['n'] : 0;
    try { $db->prepare('UPDATE ap_changes SET looked = ? WHERE pr = ? AND n = ?')->execute(array(time(), $pr, $n)); $msg = 'Noted: it looks right.'; } catch (Exception $e) { $msg = 'That couldn’t be noted.'; }
    $jump = '#spot';
  } elseif ($ok && $do === 'sync') {
    if (!gh_allowed('needs-sync', 20)) $msg = 'That’s a lot of looks in one hour. Wait a little.';
    else { $s = ap_sync($ctx, true); ap_mode($ctx, true); $msg = $s['state'] === 'synced' ? 'Looked at GitHub just now.' : 'GitHub couldn’t be read (' . (isset($s['why']) ? $s['why'] : $s['state']) . ').'; }
  }
  header('Location: ./?said=' . rawurlencode($msg) . $jump, true, 303);
  exit;
}

// ----- what the page shows -----
$sync = $ready ? ap_sync($ctx) : array('state' => 'off');
$modeInfo = $ready ? ap_mode($ctx) : array('mode' => '');
$mode = $modeInfo['mode'];
$prs = $db !== null ? ap_waiting($db, $mode) : array();
$held = needs_held($db);
$total = needs_count($held, $prs);
$report = $db !== null ? ap_report($db, $today) : array('rows' => array(), 'first' => '', 'days' => 0, 'judged' => 0, 'wrong' => array(), 'passed' => false);
$spot = $db !== null ? ap_spot($db, (new DateTime('now', $NY))->format('o-\WW')) : array();
$synced = $db !== null ? (int) ap_meta($db, 'ap_synced') : 0;
$why = $db !== null ? ap_meta($db, 'ap_why') : '';
$pub = $db !== null ? json_decode(ap_meta($db, 'publish_last'), true) : null;   // the last finished publish, from the hourly look (groups/api.php, publish_watch)
// Why a pull request is here, in a sentence.
function pr_reason($p, $mode) {
  if ($p['gate'] === '') return 'The gate hasn’t checked it yet. It does within a few minutes of the pull request opening or changing.';
  $stale = $p['gate_head'] !== '' && $p['gate_head'] !== $p['head'] ? ' (It checked an earlier commit; it checks again when the pull request changes.)' : '';
  if ($p['gate'] === 'held') return 'The gate held it: ' . (int) $p['held_n'] . ' held, ' . (int) $p['publish'] . ' listing' . ((int) $p['publish'] === 1 ? '' : 's') . ' would publish. Its comment says why.' . $stale;
  if ($p['gate'] === 'nothing') return 'The gate found no data changes to check.' . $stale;
  return 'The gate would publish all of it (' . (int) $p['changes'] . ' change' . ((int) $p['changes'] === 1 ? '' : 's') . '). ' . ($mode === 'on' ? 'It is merging it.' : 'While the autopilot isn’t on, it waits for your merge.') . $stale;
}
?>
/*HERO*/
    <h1>Needs you</h1>
    <p class="lede">Everything waiting for your say, in one place: run pull requests, claims, photos and words from program managers, premium sign-ups, mail people wrote, and anything a run held. Newest first, each with the reason it’s here.</p>
/*BODY*/
<div class="prose stats needs" data-needs-page>
<?php if ($said !== '') { ?><p class="flag"><?php echo ne($said); ?></p><?php } ?>
  <?php if (is_array($pub) && isset($pub['conclusion']) && $pub['conclusion'] === 'failure') { ?><p class="flag"><b>The last publish failed</b><?php if (!empty($pub['sha'])) { ?> (commit <code><?php echo ne($pub['sha']); ?></code>)<?php } ?>: the build or a test stopped it, and the live site didn’t change.<?php if (!empty($pub['url'])) { ?> <a href="<?php echo ne($pub['url']); ?>" rel="noopener" target="_blank">See why on GitHub</a>.<?php } ?></p><?php } ?>
  <p class="needs-count"><b><?php echo $total === 0 ? 'Nothing is waiting for you.' : ($total === 1 ? 'One thing is waiting for you.' : number_format($total) . ' things are waiting for you.'); ?></b></p>
  <form method="post" action="./" class="actions needs-sync"><input type="hidden" name="csrf" value="<?php echo ne($csrf); ?>">
    <span class="hint"><?php if (!$ready) { ?>GitHub can’t be read from here: the key file is missing on the server, so pull requests and the switch don’t show.<?php } elseif ($synced > 0) { ?>Looked at GitHub <?php echo ne(nwhen($synced)); ?>.<?php if ($why !== '') { ?> <b>The last look failed (<?php echo ne($why); ?>).</b><?php if ($why === 'refused') { ?> The key file’s token was refused: check it on the server.<?php } ?><?php } ?><?php } else { ?>Not looked at GitHub yet.<?php } ?></span>
    <?php if ($ready) { ?><button class="btn" type="submit" name="do" value="sync">Look again</button><?php } ?>
  </form>

  <section id="switch" class="panel needs-switch">
    <h2>The autopilot is <?php echo $mode === '' ? 'unknown' : ne($mode); ?></h2>
    <p><?php if ($mode === 'on') { ?>A run’s pull request with nothing held merges itself and the site publishes. Only held ones come here.<?php } elseif ($mode === 'shadow') { ?>The gate comments on each run’s pull request and merges nothing. Every open one waits here for your merge.<?php } elseif ($mode === 'off') { ?>The gate does nothing. Every open run pull request waits here for your merge.<?php } else { ?>The switch (<code>data/autopilot.json</code> on main) couldn’t be read from GitHub.<?php } ?></p>
    <?php if ($admin && $mode !== '') { ?><form method="post" action="./" class="actions"><input type="hidden" name="csrf" value="<?php echo ne($csrf); ?>"><input type="hidden" name="do" value="switch">
      <?php foreach (array('on' => 'Switch on', 'shadow' => 'Shadow mode', 'off' => 'Switch off') as $to => $label) { if ($to === $mode) continue; ?><button class="btn<?php echo $to === 'on' ? ' primary' : ''; ?>" type="submit" name="to" value="<?php echo ne($to); ?>"><?php echo ne($label); ?></button><?php } ?>
      <?php if ($mode !== 'on' && !$report['passed']) { ?><label class="needs-anyway"><input type="checkbox" name="anyway" value="1"> Switch on even though the shadow test hasn’t been passed</label><?php } ?>
    </form>
    <p class="hint">One commit to <code>data/autopilot.json</code> on main. The gate reads it the next time it runs, and a run’s pull request can never change it.</p><?php } ?>
  </section>

  <h2>Pull requests from the runs (<?php echo count($prs); ?>)</h2>
  <?php if (!$prs) { ?><p class="hint"><?php echo $mode === 'on' ? 'None held. The rest merged themselves; see what the autopilot merged.' : 'No run pull request is open.'; ?></p><?php } ?>
  <?php foreach ($prs as $p) { ?><div class="panel needs-item" id="pr-<?php echo (int) $p['pr']; ?>">
    <h3><?php echo ne($p['title']); ?></h3>
    <p class="hint">#<?php echo (int) $p['pr']; ?> · <code><?php echo ne($p['branch']); ?></code> · opened <?php echo ne(nday($p['created'])); ?><?php if ((int) $p['held']) { ?> · <b>needs-josh</b><?php } ?></p>
    <p><?php echo ne(pr_reason($p, $mode)); ?></p>
    <?php if ($p['gate_body'] !== '') { ?><details class="needs-gate"><summary>The gate’s comment</summary><div><?php echo ap_md($p['gate_body']); ?></div></details><?php } ?>
    <form method="post" action="./" class="actions"><input type="hidden" name="csrf" value="<?php echo ne($csrf); ?>"><input type="hidden" name="pr" value="<?php echo (int) $p['pr']; ?>"><input type="hidden" name="head" value="<?php echo ne($p['head']); ?>">
      <?php if ($admin && $ready) { ?><button class="btn primary" type="submit" name="do" value="approve">Approve</button><button class="btn" type="submit" name="do" value="decline">Decline</button><?php } ?>
      <a class="btn" href="https://github.com/<?php echo ne($REPO); ?>/pull/<?php echo (int) $p['pr']; ?>" rel="noopener" target="_blank">Open on GitHub</a>
    </form>
  </div><?php } ?>
  <?php if ($prs && $admin && $ready) { ?><p class="hint">Approve merges the commit shown here, as one commit, and the site publishes it in a few minutes. Decline closes it without merging; it can be reopened on GitHub. A pull request that changes anything but listing data is merged on GitHub, not here.</p><?php } ?>

  <?php if ($held['claims']) { ?><h2>Claims waiting for your yes (<?php echo count($held['claims']); ?>)</h2>
  <?php foreach ($held['claims'] as $c) { ?><div class="panel needs-item">
    <h3><?php echo ne(nlabel($c['listing'])); ?></h3>
    <p class="hint"><?php echo ne(trim($c['first'] . ' ' . $c['last'])); ?> &lt;<?php echo ne($c['email']); ?>&gt; · <?php echo ne(nday($c['created'])); ?></p>
    <p>Their address is at <b><?php echo ne($c['domain']); ?></b>, the listing’s website, but many people share that website, so the claim needs your yes.</p>
    <form method="post" action="../claims/" class="actions"><input type="hidden" name="csrf" value="<?php echo ne($claimsCsrf); ?>"><input type="hidden" name="back" value="needs"><input type="hidden" name="id" value="<?php echo (int) $c['id']; ?>"><button class="btn primary" type="submit" name="do" value="claim_ok">Approve the claim</button><button class="btn" type="submit" name="do" value="claim_no">Decline</button></form>
  </div><?php } ?><?php } ?>

  <?php if ($held['photos']) { ?><h2>Photos waiting (<?php echo count($held['photos']); ?>)</h2>
  <?php foreach ($held['photos'] as $x) { ?><div class="panel needs-item">
    <h3><?php echo ne(nlabel($x['listing'])); ?><?php if ($x['kind'] === 'logo') { ?> <span class="hint">Logo</span><?php } ?></h3>
    <p class="hint">From <?php echo ne(trim($x['first'] . ' ' . $x['last'])); ?> · <?php echo ne(nday($x['created'])); ?></p>
    <p>A photo shows on a listing only after you publish it. They ticked that they may use it and have the families’ permission for any children in it.</p>
    <p><img class="review-photo" src="../claims/?photo=<?php echo (int) $x['id']; ?>" alt=""></p>
    <p>Described as: <b><?php echo ne($x['alt']); ?></b></p>
    <form method="post" action="../claims/" class="actions"><input type="hidden" name="csrf" value="<?php echo ne($claimsCsrf); ?>"><input type="hidden" name="back" value="needs"><input type="hidden" name="id" value="<?php echo (int) $x['id']; ?>"><button class="btn primary" type="submit" name="do" value="photo_ok">Publish the photo</button><button class="btn" type="submit" name="do" value="photo_no">Decline</button></form>
  </div><?php } ?><?php } ?>

  <?php if ($held['extras']) { ?><h2>Words, offers, pins and links waiting (<?php echo count($held['extras']); ?>)</h2>
  <?php foreach ($held['extras'] as $x) { ?><div class="panel needs-item">
    <h3><?php echo ne(nlabel($x['listing'])); ?> <span class="hint"><?php echo ne(isset($KIND[$x['kind']]) ? $KIND[$x['kind']] : $x['kind']); ?></span></h3>
    <p class="hint">From <?php echo ne(trim($x['first'] . ' ' . $x['last'])); ?> · <?php echo ne(nday($x['created'])); ?><?php if ($x['kind'] === 'offer' && $x['until'] !== '') { ?> · to show until <?php echo ne($x['until']); ?><?php } ?></p>
    <p>What a manager writes for a premium listing shows only after you publish it.</p>
    <pre class="edit-ask"><?php echo ne(nextra($x)); ?></pre>
    <form method="post" action="../claims/" class="actions"><input type="hidden" name="csrf" value="<?php echo ne($claimsCsrf); ?>"><input type="hidden" name="back" value="needs"><input type="hidden" name="id" value="<?php echo (int) $x['id']; ?>"><button class="btn primary" type="submit" name="do" value="extra_ok">Publish it</button><button class="btn" type="submit" name="do" value="extra_no">Decline</button></form>
  </div><?php } ?><?php } ?>

  <?php if ($held['premium']) { ?><h2>Premium sign-ups (<?php echo count($held['premium']); ?>)</h2>
  <?php foreach ($held['premium'] as $x) { ?><div class="panel needs-item">
    <h3><?php echo ne(nlabel($x['listing'])); ?></h3>
    <p class="hint"><?php echo ne(trim($x['first'] . ' ' . $x['last'])); ?> &lt;<?php echo ne($x['email']); ?>&gt; · <?php echo $x['plan'] === 'year' ? 'yearly' : 'monthly'; ?> · <?php echo ne(nday($x['created'])); ?></p>
    <p>They went to Stripe’s page to pay. Check the payment in Stripe, then make the listing premium: its manager is emailed.</p>
    <form method="post" action="../claims/" class="actions"><input type="hidden" name="csrf" value="<?php echo ne($claimsCsrf); ?>"><input type="hidden" name="back" value="needs"><input type="hidden" name="id" value="<?php echo (int) $x['claim_id']; ?>"><button class="btn primary" type="submit" name="do" value="premium_on">Make it premium</button></form>
  </div><?php } ?><?php } ?>

  <?php if ($held['queue']) { ?><h2>Held by a run (<?php echo count($held['queue']); ?>)</h2>
  <?php foreach ($held['queue'] as $x) { ?><div class="panel needs-item">
    <h3><?php echo ne($x['what'] !== '' ? $x['what'] : (isset($QKIND[$x['kind']]) ? $QKIND[$x['kind']] : $x['kind'])); ?></h3>
    <p class="hint"><?php echo ne(isset($QKIND[$x['kind']]) ? $QKIND[$x['kind']] : $x['kind']); ?><?php if ($x['listing'] !== '') { ?> · <?php echo ne(nlabel($x['listing'])); ?><?php } ?><?php if ((int) $x['decided'] > 0) { ?> · <?php echo ne(nday($x['decided'])); ?><?php } ?> · <code><?php echo ne($x['id']); ?></code></p>
    <p><?php echo $x['reason'] === 'pr-closed' ? 'Its pull request was closed without a merge, so nothing went live and its sender hasn’t been told.' : 'A run held it for your decision. Nothing goes to its sender until it’s settled.'; ?></p>
    <form method="post" action="../queue/" class="actions"><input type="hidden" name="csrf" value="<?php echo ne($queueCsrf); ?>"><input type="hidden" name="back" value="needs"><button class="btn" type="submit" name="do" value="drop:<?php echo ne($x['id']); ?>">Not for the run</button><a class="btn" href="../queue/">See it in the queue</a><?php if ((int) $x['pr'] > 0) { ?><a class="btn" href="https://github.com/<?php echo ne($REPO); ?>/pull/<?php echo (int) $x['pr']; ?>" rel="noopener" target="_blank">#<?php echo (int) $x['pr']; ?></a><?php } ?></form>
  </div><?php } ?><?php } ?>

  <?php if ($held['mail']) { ?><section id="mail"><h2>Mail for you (<?php echo count($held['mail']); ?>)</h2>
  <?php if (!$admin) { ?><p class="hint"><?php echo count($held['mail']) === 1 ? 'One email from a person waits' : count($held['mail']) . ' emails from people wait'; ?> for a site admin’s account. Mail is shown only to admins.</p><?php } else { ?>
  <p class="hint">Emails people wrote to the site that the hold list kept for you. Nothing has been sent to them. Send queues your reply: the mailbox script sends it from the site’s address, in the email’s own thread, within ten minutes.</p>
  <?php foreach ($held['mail'] as $x) { $m = mail_message($mailKey, $x['sealed']); $draft = mail_open($mailKey, $x['draft']); $names = array(); foreach ($x['listings'] === '' ? array() : explode(',', (string) $x['listings']) as $k) $names[] = nlabel($k); ?><div class="panel needs-item" id="mail-<?php echo (int) $x['id']; ?>">
    <h3><?php echo ne(isset($m['subject']) && $m['subject'] !== '' ? $m['subject'] : '(no subject)'); ?></h3>
    <p class="hint"><?php if ($m) { ?><?php echo ne(isset($m['from_name']) ? $m['from_name'] : ''); ?> &lt;<?php echo ne(mail_reply_to($m, (string) $x['via'])); ?>&gt;<?php } else { ?>The message can’t be opened on this server.<?php } ?><?php if ($x['via'] === 'form') { ?> · through the contact form<?php } ?> · <?php echo ne(nwhen($x['created'])); ?></p>
    <p><b><?php echo ne(isset(MAIL_HOLDS[$x['hold']]) ? MAIL_HOLDS[$x['hold']] : 'Held for you.'); ?></b></p>
    <p class="hint">From <?php echo ne($x['domain']); ?><?php if ($x['via'] === 'mail') { ?> (<?php echo (int) $x['dkim'] ? 'its signature checks out' : 'not signed by that domain'; ?>)<?php } ?><?php if ($names) { ?>, the website of <?php echo ne(implode(', ', $names)); ?><?php } elseif ((int) $x['shared']) { ?>, a domain many organizations share<?php } ?> · <?php echo ne(isset($ACCOUNT[$x['account']]) ? $ACCOUNT[$x['account']] : $x['account']); ?><?php if ($x['outreach'] !== '') { ?> · a reply to our outreach<?php } ?><?php if ((int) $x['attachments']) { ?> · <?php echo (int) $x['attachments']; ?> attachment<?php echo (int) $x['attachments'] === 1 ? '' : 's'; ?> (in the mailbox)<?php } ?></p>
    <?php if ($m && isset($m['text'])) { ?><details class="needs-gate" open><summary>The message</summary><pre class="edit-ask"><?php echo ne($m['text']); ?></pre></details><?php } ?>
    <form method="post" action="./" class="needs-reply"><input type="hidden" name="csrf" value="<?php echo ne($csrf); ?>"><input type="hidden" name="mail" value="<?php echo (int) $x['id']; ?>">
      <label for="reply-<?php echo (int) $x['id']; ?>">Your reply</label>
      <textarea id="reply-<?php echo (int) $x['id']; ?>" name="text" rows="9"><?php echo ne($draft); ?></textarea>
      <p class="actions"><button class="btn primary" type="submit" name="do" value="mail_send">Send</button><button class="btn" type="submit" name="do" value="mail_done">Done, no reply</button><?php if ($x['hold'] !== 'instructions') { ?><button class="btn" type="submit" name="do" value="mail_queue">Give it to the runs</button><?php } ?></p>
    </form>
  </div><?php } ?><?php } ?>
  </section><?php } ?>

  <p class="hint">Reviews still reach you by email, and stay in the inbox. They move here when the review form stores them (Phase 6).</p>

  <?php if ($mode === 'shadow') { ?><section id="shadow">
  <h2>The shadow report</h2>
  <p><?php echo count($report['rows']); ?> run pull request<?php echo count($report['rows']) === 1 ? '' : 's'; ?> the gate has commented on<?php if ($report['first'] !== '') { ?> since <?php echo ne($report['first']); ?><?php } ?>.</p>
  <p><b>The test for switching on:</b> five shadow days (<?php echo (int) $report['days']; ?> so far), at least 30 changes judged (<?php echo (int) $report['judged']; ?> on decided pull requests), and none the gate would have merged that you closed (<?php echo count($report['wrong']); ?><?php if ($report['wrong']) { ?>: #<?php echo ne(implode(', #', $report['wrong'])); ?><?php } ?>).</p>
  <p<?php echo $report['passed'] ? '' : ' class="flag"'; ?>><b><?php echo $report['passed'] ? 'Passed: the autopilot can be switched on.' : 'Not passed yet: keep merging by hand.'; ?></b></p>
  <?php if ($report['rows']) { ?><div class="stat-scroll"><table class="stat-table wrap"><thead><tr><th scope="col">Pull request</th><th scope="col">The gate said</th><th scope="col">What happened</th><th scope="col">Changes</th></tr></thead><tbody>
  <?php foreach (array_slice($report['rows'], 0, 30) as $r) { ?><tr><th scope="row">#<?php echo (int) $r['pr']; ?> <span class="hint"><?php echo ne($r['branch']); ?></span></th><td><?php echo $r['gate'] === 'publish' ? 'would merge' : ($r['gate'] === 'held' ? 'held' : ne($r['gate'])); ?></td><td><?php echo $r['state'] === 'merged' ? ($r['merged_by'] === AP_BOT ? 'merged by the autopilot' : 'merged') : ($r['state'] === 'closed' ? 'closed' : 'open'); ?></td><td><?php echo (int) $r['changes']; ?></td></tr><?php } ?>
  </tbody></table></div><?php } ?>
  <p class="hint">Held pull requests you merged anyway are the ones to read when tuning the rules: each hold should have been worth your look.</p>
  </section><?php } ?>

  <section id="spot">
  <h2>Spot-check: ten of this week’s autopilot changes</h2>
  <?php if (!$spot) { ?><p class="hint">The autopilot hasn’t merged anything in the last seven days<?php echo $mode === 'on' ? '.' : ': it isn’t on.'; ?></p><?php } else { ?>
  <p class="hint">Picked at random from what the autopilot merged in the last seven days, the same ten all week. Undo takes back the whole pull request a change came in.</p>
  <?php foreach ($spot as $c) { ?><div class="panel needs-item">
    <h3><?php echo ne(nlabel($c['listing'])); ?> <span class="hint">#<?php echo (int) $c['pr']; ?>, <?php echo ne(nday($c['merged'])); ?></span></h3>
    <p><code><?php echo ne($c['path'] === '' ? '(the whole listing)' : $c['path']); ?></code>: <?php echo ne($c['old'] === '' ? '(nothing)' : $c['old']); ?> → <b><?php echo ne($c['new'] === '' ? '(nothing)' : $c['new']); ?></b></p>
    <?php if ($c['quote'] !== '') { ?><blockquote><?php echo ne($c['quote']); ?></blockquote><?php } ?>
    <?php if ($c['source'] !== '') { ?><p class="hint">From <a href="<?php echo ne($c['source']); ?>" rel="noopener nofollow" target="_blank"><?php echo ne($c['source']); ?></a></p><?php } ?>
    <form method="post" action="./" class="actions"><input type="hidden" name="csrf" value="<?php echo ne($csrf); ?>"><input type="hidden" name="pr" value="<?php echo (int) $c['pr']; ?>"><input type="hidden" name="n" value="<?php echo (int) $c['n']; ?>">
      <?php if ((int) $c['looked'] > 0) { ?><span class="hint">✓ You said it looks right.</span><?php } else { ?><button class="btn primary" type="submit" name="do" value="looked">Looks right</button><?php } ?>
      <?php if ($admin && $ready) { ?><a class="btn" href="../autopilot/?confirm=<?php echo (int) $c['pr']; ?>#pr-<?php echo (int) $c['pr']; ?>">Undo…</a><?php } ?>
    </form>
  </div><?php } ?><?php } ?>
  </section>

  <p><a class="btn" href="../autopilot/">What the autopilot merged</a> <a class="btn" href="../claims/">Claims and proposed changes</a> <a class="btn" href="../queue/">The queue</a> <a class="btn" href="../">Back to editing</a></p>
</div>
