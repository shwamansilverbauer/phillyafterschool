// ----- GitHub, through the key file next to the public folder -----
// Shared by edit/send.php (publishing copy) and edit/queue/ (sending work to the weekly run). build.mjs pastes this in
// at each file's /*GH*/ marker; $REPO ("owner/name") comes from the config pasted in before it.
function gh_token() {
  static $t = null;
  if ($t !== null) return $t;
  $raw = @file_get_contents(dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-github.key');
  $raw = is_string($raw) ? trim($raw) : '';
  $t = preg_match('/^(github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,})$/', $raw) ? $raw : '';
  return $t;
}
function gh_base() {
  if (PHP_SAPI === 'cli-server' && getenv('PAS_TEST_GITHUB')) return rtrim((string) getenv('PAS_TEST_GITHUB'), '/');   // the local test server only
  return 'https://api.github.com';
}
function gh_ready() { global $REPO; return $REPO !== '' && gh_token() !== '' && function_exists('curl_init'); }
// One call to the API. Gives array(status code, decoded answer or null).
function gh($method, $path, $body = null) {
  $ch = curl_init(gh_base() . $path);
  $headers = array('Accept: application/vnd.github+json', 'Authorization: Bearer ' . gh_token(), 'X-GitHub-Api-Version: 2022-11-28', 'User-Agent: phillyafterschool-edit');
  $opts = array(CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_TIMEOUT => 20);
  if ($body !== null) { $headers[] = 'Content-Type: application/json'; $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
  $opts[CURLOPT_HTTPHEADER] = $headers;
  curl_setopt_array($ch, $opts);
  $raw = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return array($code, is_string($raw) ? json_decode($raw, true) : null);
}
// A file as the repository holds it on a branch: array(text, sha); array('', '') when it isn't there; null on an error.
function gh_file($path, $ref) {
  global $REPO;
  list($code, $r) = gh('GET', '/repos/' . $REPO . '/contents/' . $path . '?ref=' . rawurlencode($ref));
  if ($code === 404) return array('', '');
  if ($code !== 200 || !is_array($r) || !isset($r['content'])) return null;
  return array((string) base64_decode(str_replace("\n", '', (string) $r['content'])), isset($r['sha']) ? (string) $r['sha'] : '');
}
// Writes a file on a branch as one commit. Gives array(true, short sha, commit url) or array(false, what went wrong, '').
function gh_put($path, $text, $sha, $message, $branch) {
  global $REPO;
  $body = array('message' => $message, 'content' => base64_encode($text), 'branch' => $branch);
  if ($sha !== '') $body['sha'] = $sha;
  list($code, $r) = gh('PUT', '/repos/' . $REPO . '/contents/' . $path, $body);
  if (($code === 200 || $code === 201) && is_array($r) && isset($r['commit']['sha'])) return array(true, substr((string) $r['commit']['sha'], 0, 7), isset($r['commit']['html_url']) ? (string) $r['commit']['html_url'] : '');
  if ($code === 409) return array(false, 'Someone else wrote to the repository at the same moment. Try once more.', '');
  if ($code === 401 || $code === 403) return array(false, 'The publishing key was refused by GitHub. Check the key file on the server.', '');
  return array(false, 'GitHub did not take the change (HTTP ' . $code . ').', '');
}
// Makes sure a branch exists, starting it from another when it doesn't. Gives '' when it is there, or what went wrong.
function gh_branch($branch, $from) {
  global $REPO;
  list($code, $r) = gh('GET', '/repos/' . $REPO . '/git/ref/heads/' . rawurlencode($branch));
  if ($code === 200) return '';
  if ($code !== 404) return 'GitHub could not be read (HTTP ' . $code . ').';
  list($code, $r) = gh('GET', '/repos/' . $REPO . '/git/ref/heads/' . rawurlencode($from));
  if ($code !== 200 || !is_array($r) || !isset($r['object']['sha'])) return 'The ' . $from . ' branch could not be read (HTTP ' . $code . ').';
  list($code, $r) = gh('POST', '/repos/' . $REPO . '/git/refs', array('ref' => 'refs/heads/' . $branch, 'sha' => (string) $r['object']['sha']));
  if ($code === 201 || $code === 422) return '';   // 422: made by someone else a moment ago
  if ($code === 401 || $code === 403) return 'The publishing key was refused by GitHub. Check the key file on the server.';
  return 'GitHub would not start the ' . $branch . ' branch (HTTP ' . $code . ').';
}
// A simple per-hour cap on writes from a page, so a loop in a browser can't fill the repository's history.
function gh_allowed($what, $max) {
  $file = dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-' . $what . '.json';
  $d = json_decode((string) @file_get_contents($file), true);
  $hour = gmdate('Y-m-d-H');
  if (!is_array($d) || !isset($d['hour']) || $d['hour'] !== $hour) $d = array('hour' => $hour, 'n' => 0);
  if ($d['n'] >= $max) return false;
  $d['n']++;
  @file_put_contents($file, json_encode($d), LOCK_EX);
  return true;
}
