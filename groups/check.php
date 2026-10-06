<?php
// Temporary: reports what this hosting supports, as yes/no only. Removed after one look.
header('Content-Type: application/json'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
$dir = dirname($_SERVER['DOCUMENT_ROOT']) . '/pas-check-' . bin2hex(random_bytes(4));
$out = array('php' => PHP_VERSION, 'pdo_sqlite' => extension_loaded('pdo_sqlite'), 'sqlite3' => extension_loaded('sqlite3'), 'sodium' => extension_loaded('sodium'), 'openssl' => extension_loaded('openssl'), 'mbstring' => extension_loaded('mbstring'), 'mail' => function_exists('mail'), 'outside_writable' => false, 'sqlite_works' => false, 'sqlite_version' => '', 'wal' => '', 'https' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https'), 'docroot_is_public_html' => basename($_SERVER['DOCUMENT_ROOT']) === 'public_html');
if (@mkdir($dir, 0700)) {
  $out['outside_writable'] = true;
  try {
    $db = new PDO('sqlite:' . $dir . '/t.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $out['wal'] = $db->query('PRAGMA journal_mode=WAL')->fetchColumn();
    $db->exec('CREATE TABLE t (a INTEGER PRIMARY KEY, b TEXT)');
    $db->exec("INSERT INTO t (b) VALUES ('x')");
    $out['sqlite_works'] = $db->query('SELECT COUNT(*) FROM t')->fetchColumn() == 1;
    $out['sqlite_version'] = $db->query('SELECT sqlite_version()')->fetchColumn();
    $db = null;
  } catch (Exception $e) { $out['error'] = get_class($e); }
  foreach ((array) @scandir($dir) as $f) { if ($f !== '.' && $f !== '..') @unlink($dir . '/' . $f); }
  @rmdir($dir);
}
echo json_encode($out);
