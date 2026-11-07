# Tests

Everything here runs on the machine it is started on, against a copy of the site built for one fixed day. Nothing
reaches phillyafterschool.org, the mail service, Google, Klaviyo, GitHub or anyone's inbox.

```
node tests/run.mjs               everything (about half a minute)
node tests/run.mjs api-plans     only test files whose name contains the word (any number of words)
node tests/run.mjs --list        the tests, without running them
node tests/run.mjs --keep        leave the local server up afterwards, with its address
```

Needs `node` 20 or later, `php` 8 with pdo_sqlite, openssl and curl (the same as the host), and, for the browser
tests, Playwright with Chromium: `npm i -g playwright && npx playwright install chromium`, or point `PLAYWRIGHT_DIR`
at a folder that has it. Without Playwright the browser tests are reported as skipped and the rest still run.

## What happens when they run

`tests/run.mjs` loads every file in `tests/cases/` (in name order), then:

1. copies `build.mjs`, `site.config.json`, `data/`, `src/`, `email/` and `scripts/` into `tests/.scratch/repo/`
   (ignored by git) and builds there with `PAS_TODAY` set to the fixed day, so the repository's own `dist/` is left
   alone and the pages don't change as the calendar moves. The edit page's sign-in is swapped for a username and a
   password made up for the run; the real password is never anywhere but a hash in the config.
2. starts one small HTTP server that stands in for the outside world: Postmark (what the site would email lands in
   `ctx.mail`), Google's token check (a test registers a credential and the claims it should carry), a browser's push
   service, and GitHub. The site is pointed at it with the `PAS_TEST_*` variables the server honours only under PHP's
   built-in server.
3. starts `php -S` on the built copy, with a fresh accounts database under `tests/.scratch/phillyafterschool-data/`
   and a stand-in Postmark key (the key's shape is checked; the value never leaves the machine), with no proxy.
4. runs the tests one after another, each with 90 seconds at most, and prints a line per test, a summary, the stack
   of each failure, and a full-page screenshot of whatever a failed browser test was looking at
   (`tests/.scratch/shots/`). The exit code is 1 if anything failed.

The fixed day is `TODAY` in `tests/lib/harness.mjs`: a Monday in the school year the data describes, 3pm Philadelphia
time. When `data/days-off.json` moves to a new school year, move it (one place) to a Monday in that year.

## What is covered

| file | what |
| --- | --- |
| `01-build.mjs` | the build finishes clean with no orphaned wording edits; every school, program, camp and neighborhood page exists and the sitemap lists the public ones; the wording rules (no "checked by hand", no Venmo, the support line, the maker's link only in the footer, no premium price on a parent's page); no email address in the pages but the site's own and the providers'; no secret in anything tracked or built; and the private words, below |
| `10-api-auth.mjs` | the request guards; sign-in by emailed code (works once, newest wins, three per address per quarter hour) and by link; sign out here and everywhere; the name; deleting the account; Google sign-in and its refusals |
| `11-api-plans.mjs` | a child's week, the children, the summer and the days off: only listed programs and camps are kept, never free text; the limits; and proof that no name or pick is readable on disk while the parent's address is |
| `12-api-sharing.mjs` | sharing a kept week with one person (and the copy following edits), groups end to end, sync from a device |
| `13-api-coparent.mjs` | the invitation, what accepting merges, both accounts reading and changing everything, ending it, deleting an account |
| `14-api-follow.mjs` | follows and favorites, the stop links in emails (and the public stopped list carrying only hashes), asking for a school |
| `15-api-claims.mjs` | claiming a listing with a work email, a parent's question passed to its holders, a proposed change, the manager's emails switch |
| `16-edit-gate.mjs` | `/edit/` asks for a sign-in, refuses a wrong password, and the cookie opens the editor and the queue |
| `20-web-pages.mjs` | pages load without errors; the finder; the privacy page says what the notice promises; the sign-up notice sits under the email form; signing in through the page; quiet pages run no analytics and the email list hears nothing about a child |
| `21-web-planners.mjs` | each planner, signed in: a first name and a pick keep the plan in the profile, and it comes back on another device |
| `22-web-account.mjs` | the account tabs; sharing a kept week from the Plans tab; the co-parent box from invitation to "stop sharing everything" |

Not covered yet, in rough order of value: the push payloads (opening what the site posts to the stand-in with a
device's keys, and comparing every morning in the feed with what the email job would send); the daily email job
itself (`scripts/send-alerts.mjs`) against the stand-in; the managers' pages in a browser; the week card and the
pictures; the service worker.

## Private words

`01-build.mjs` can check that a list of words appears nowhere in the repository or the built site: the family's own
names, a home address, tokens. The list itself is private, so it is not in the repository: put it in
`phillyafterschool-private.json` beside `build.mjs` (already ignored by `.gitignore`) as

```
{ "never": ["a word", "another"] }
```

Without the file the test is skipped. When it fails it names the file and the word's number in the list, never the
word.

## Writing a test

A test file is an ES module that imports `test` from `../lib/harness.mjs` and registers tests:

```js
import { test, ok, eq, deepEq, includes, excludes, matches, person, someone } from '../lib/harness.mjs';
import { pickupPair } from '../lib/data.mjs';

test('what it checks, in one line a non-developer could read', async (ctx) => {
  const pat = person(ctx, 'Pat', 'Lee');          // a named, signed-in account (made in the database, no email spent)
  const r = await pat.okay('POST', 'week_save', { week: { name: 'Sam', now: {}, next: {} } });   // must succeed
  await pat.fails('POST', 'week_save', { week: { name: '' } }, 'kid');                           // must fail with this error code
  const prof = await pat.okay('GET', 'profile');
  eq(prof.weeks.length, 1);
});
```

`ctx` carries: `site` (`base`, `read(rel)`, `exists(rel)`, `dbBytes()`, `seed(email, first, last)`, `sql(select)`,
`buildOutput`, `edit`), `api()` (a fresh client; `.as(email, first, last)` signs it in from the database, `.signIn(email)`
goes through the real emailed code), `mail` (`waitFor(to, /subject/)`, `to(addr)`, `messages`), `google.allow(credential, claims)`,
`push.posts`, `github.calls`, and `browser()` (Playwright; `const t = await b.context(site, { sid })` gives a page on
the fixed day, signed in when given a session cookie, with every outside request recorded in `t.outside` and refused,
and page errors in `t.errors`). `tests/lib/data.mjs` picks fixtures out of the data (a program with a school, a program
with classes, two camps, the upcoming days off) so tests keep working as listings come and go.

Rules of the house: a test never touches the live site or a real service; it uses invented names (Sam, Rae, Zoe, Pat
Lee, Dana Reyes, Jo Admin) and `@example.test` addresses; it never puts a real person's name, a real child's name or
a secret in the repository; and a sign-in email is spent only by the tests that test sign-in emails (the server allows
an address three per quarter hour and one machine ten, and `person()`/`as()` cost none).

## When a test fails

- Read the message: most say what was expected and what was found, with the request that failed.
- `tests/.scratch/php.log` has the server's own errors; `tests/.scratch/shots/` the browser's last view.
- `node tests/run.mjs <word> --keep` leaves the server up to poke at with curl or a browser (`pkill -x php` stops it).
- A test that fails because the data changed (a program lost its school, a camp was dropped) usually needs
  `tests/lib/data.mjs` to pick differently, not the site to change.
