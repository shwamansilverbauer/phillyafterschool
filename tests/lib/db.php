<?php
// The tests' way into the test server's own database: seed an account with a session, or run one SELECT.
// Only ever pointed at the copy under tests/.scratch (the harness passes the path); never at a real database.
//   php tests/lib/db.php <groups.sqlite> seed <email> [first] [last] [origin]   -> {"id":..,"sid":".."}  (origin "managers": a program manager's account)
//   php tests/lib/db.php <groups.sqlite> select <sql>                   -> rows as JSON
$file = $argv[1] ?? '';
$mode = $argv[2] ?? '';
if ($file === '' || !is_file($file)) { fwrite(STDERR, "no database at $file\n"); exit(2); }
$db = new PDO('sqlite:' . $file);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$db->exec('PRAGMA busy_timeout=4000');
$b64 = function ($bytes) { return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '='); };
if ($mode === 'seed') {
  $email = strtolower($argv[3] ?? '');
  $first = $argv[4] ?? ''; $last = $argv[5] ?? ''; $origin = ($argv[6] ?? '') === 'managers' ? 'managers' : 'parents';
  $row = $db->prepare('SELECT id FROM users WHERE email = ?'); $row->execute(array($email)); $id = $row->fetchColumn();
  if (!$id) {
    $db->prepare('INSERT INTO users (email, created, via, origin, first, last, name) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute(array($email, time(), 'email', $origin, $first, $last, trim($first . ' ' . $last)));
    $id = $db->lastInsertId();
  }
  $sid = $b64(random_bytes(32));
  $db->prepare('INSERT INTO sessions (user_id, sid_hash, expires, seen) VALUES (?, ?, ?, ?)')->execute(array($id, hash('sha256', $sid), time() + 30 * 86400, time()));
  echo json_encode(array('id' => (int) $id, 'sid' => $sid));
  exit;
}
if ($mode === 'select') {
  $sql = $argv[3] ?? '';
  if (!preg_match('/^\s*select\b/i', $sql)) { fwrite(STDERR, "select only\n"); exit(2); }
  echo json_encode($db->query($sql)->fetchAll());
  exit;
}
fwrite(STDERR, "mode: seed or select\n");
exit(2);
