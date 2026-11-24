# Tests

Everything here runs on the machine it is started on, against a copy of the site built for one fixed day. Nothing
reaches phillyafterschool.org, the mail service, Google, Klaviyo, GitHub or anyone's inbox.

```
node tests/run.mjs               everything (about half a minute)
node tests/run.mjs api-plans     only test files whose name contains the word (any number of words)
node tests/run.mjs --list        the tests, without running them
node tests/run.mjs --keep        leave the local server up afterwards, with its address
```

They also run on every pull request into `main` (`.github/workflows/test.yml`) and in the publishing job before
anything goes live; a failed browser test's screenshots are kept on the run for a week.

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
   service, and GitHub (the private backup and ops repositories, and this repository's pull requests, files, merges,
   the GraphQL revert, workflow runs and issues: `github.repo`). The site is pointed at it with the `PAS_TEST_*` variables the server honours only under PHP's
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
| `07-mail-script.mjs` | the mailbox script's own rules (`mail/Code.gs`), run under Node with `tests/lib/gas.mjs` standing in for Google: thirty made-up emails (`tests/lib/mail-fixtures.mjs`) filed as the rules say, headers and Google's Authentication-Results (a look-alike ignored), trimming quoted history, opt-outs, the signature the site checks, which outreach row gets which email, and the cap |
| `06-gate.mjs` | the autopilot gate: fixture pull requests (a clean update, a quote not on the page, a number missing from the quote, a file off the allowlist, a removed listing, a new listing on a week-old domain, a date with no year, a note off its template, and more) against a stand-in for the providers' sites and the domain registry; reviews (the site's own entry and still clean, one changed on the way, one the site's checks hold without saying why, a link or a name, a removed or edited one, no record); then the workflow's own commands on a git copy of the site against a stand-in GitHub: shadow mode comments and merges nothing, on labels a clean, tested pull request `autopilot-ready` (and merges nothing itself), the replay and the shadow report |
| `08-autopilot-merge.mjs` | the hourly merge (`scripts/merger.mjs`) on a small git repository against a stand-in GitHub: two ready pull requests laid on main together and merged at the commits the gate checked, with one publish; one that clashes waits; one that moved, or has only a look-alike comment, loses its label; one off the allowlist is held; a failed batch merges nothing and is held with the reason in the gate's comment; main moving stops the merge; a pull request judged in shadow mode goes back to the gate; shadow mode does nothing |
| `09-queue-run.mjs` | the queue run's tools: `scripts/queue-work.mjs` (unanswered items oldest first, the run's limit, a failed answer back in the queue, "Nothing to do."), and the gate's `--split` (held listings out to a second pull request's files, each file's layout kept, the evidence split, the clean tree passing and the held one held, a held review in neither); reviews and managers' items in the worklist and decisions/ answering them; the queue run's prompt agreeing with the host's outcomes, replies, reasons and decision rules |
| `10-api-auth.mjs` | the request guards; sign-in by emailed code (works once, newest wins, three per address per quarter hour) and by link; sign out here and everywhere; the name; deleting the account; Google sign-in and its refusals |
| `11-api-plans.mjs` | a child's week, the children, the summer and the days off: only listed programs and camps are kept, never free text; the limits; and proof that no name or pick is readable on disk while the parent's address is |
| `12-api-sharing.mjs` | sharing a kept week with one person (and the copy following edits), groups end to end, sync from a device |
| `13-api-coparent.mjs` | the invitation, what accepting merges, both accounts reading and changing everything, ending it, deleting an account |
| `14-api-follow.mjs` | follows and favorites, the stop links in emails (and the public stopped list carrying only hashes), asking for a school |
| `15-api-claims.mjs` | claiming a listing with a work email, a parent's question passed to its holders, a proposed change, the manager's emails switch |
| `17-api-passport.mjs` | the Passport: suggestions from the plans, confirming and ranking, sealed on disk, co-parents sharing it |
| `18-api-health.mjs` | the health answer's report on the key `/edit/` publishes with: working, days left, refused, replaced, never shown; the note for each new account; the copy off the host and its restore drill |
| `19-api-queue.mjs` | the private queue: suggestions, a proposed change and a school ask written to a stand-in ops repository with no address in it, only when changed; outcome files answering each sender once in the site's words (a run's own words ignored), "it's on the site" only after the merge; `/edit/queue/` as a view, "Not for the run", a note, Rush (reminding the owner of the queue run); the sign-up digest (with the morning summary off) |
| `24-api-needs.mjs` | the Needs-you page, the autopilot log and the morning summary against a stand-in GitHub: a held run pull request shows with the gate's reason (a look-alike comment ignored), Approve merges the commit shown and refuses one that touches the switch, Decline closes; the switch is one commit keeping its `about` line, and on needs the shadow test or a tick; the log's changes and quotes, the warning that an email may have gone, Undo through GitHub's revert, a clash refused; the spot-check; a claim decided from the page; the summary's email and push, once a day, the digest giving way; a run that couldn't finish named in the summary with its step, in the site's words; a failed publish pushed once; the sign-in and no key file |
| `25-api-mail.mjs` | the mailbox's site side and the script against it: only signed requests (unsigned, wrong, stale and repeated refused), mail sealed on disk and scrubbed in the queue with the host's facts, the hold list and its pushes, held mail on the Needs-you page with a draft and Send, replies handed out and confirmed, the runs' fixed answers sent in their thread (never by the site's mailer), `X-PAS-Kind` on the site's notices, the script filing a stand-in inbox, replying and checking in, the summary's mail lines, and the outreach sender |
| `26-api-reviews.mjs` | Phase 6: a review sent by a signed-in account, one per program, the child's details sealed, nothing emailed, and the no-JavaScript answer; the site's holds (a link, an accusation, a name, strong words, the program's own address, a brand-new account, held or waiting a day), none reaching the queue; a clean review's exact entry in the queue, the gate's question answered, the thank-you once after the merge, and declined, held and closed ones emailing nobody; Publish and Decline on the Needs-you page (one commit to `data/reviews.json`); managers' words, offers and pins rated in decisions/, published only with the autopilot on and the site's checks agreeing; a photo's consent tick and its signed link; claims by code, a clash and a request to check |
| `27-web-review.mjs` | the review form in a browser: the emailed code makes the account and sends the review, a wrong code refused, the thanks page, nothing sent to another site |
| `28-web-claim-code.mjs` | claims by code on the managers page in a browser: the code offered for an address that doesn't match, sent to the listing's published address, typed in, the listing claimed |
| `16-edit-gate.mjs` | `/edit/` asks for a sign-in, refuses a wrong password, and the cookie opens the editor and the queue |
| `20-web-pages.mjs` | pages load without errors; the finder; the privacy page says what the notice promises; the sign-up notice sits under the email form; signing in through the page; quiet pages (account, profile, Passport, calendar, to-do) ask no other site for anything, fonts included, and the email list hears nothing about a child |
| `21-web-planners.mjs` | each planner, signed in: a first name and a pick keep the plan in the profile, and it comes back on another device |
| `23-web-passport.mjs` | the Passport in a browser: the picker, kid mode, the press-and-hold, confirming, stamps, the bracket, favorites in the planners |
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
with classes, two camps, the upcoming days off) so tests keep working as listings come and go. `tests/lib/gas.mjs`
runs `mail/Code.gs` under Node against a stand-in Gmail, script properties and a spreadsheet; its `UrlFetchApp` reaches
only the local test site (through curl, since Apps Script's fetch is synchronous).

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
