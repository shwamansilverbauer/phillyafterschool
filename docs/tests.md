# Tests

## Tests

```
node tests/run.mjs            everything (about half a minute)
node tests/run.mjs api        only the files whose name contains "api"
node tests/run.mjs --list     the list of tests
```

The tests live in `tests/` and run entirely on the machine they are started on: a copy of the site is built for one
fixed day (`TODAY` in `tests/lib/harness.mjs`, a Monday in the school year the data describes) and served by PHP's
own server, with small stand-ins for the services the site talks to (the mail service, Google's sign-in check, the
push services). Nothing reaches phillyafterschool.org, the real mail service or anyone's inbox. They need `node`,
`php` (with pdo_sqlite, openssl and curl) and, for the browser tests, Playwright (`PLAYWRIGHT_DIR` if it isn't
installed globally); without Playwright the browser tests are reported as skipped and the rest run. What is
covered, how a test is written and what to do when one fails is in `tests/README.md`.

Every pull request into `main` runs them too (`.github/workflows/test.yml`), so a proposal from the monthly or weekly
check shows a green tick or a red cross before it is merged; screenshots of a failed browser test are kept on the run
for a week. The publishing job runs them as well, after the build and before anything goes to the `live` branch, so a change that
breaks one of the site's own rules (a child's name readable on disk, a price for parents, an analytics call on a
quiet page, the support line missing) fails a test, not a reader. Run them yourself before pushing a change to
`build.mjs`, `src/` or the data, and the job is only a second opinion.

## Building for another day (tests only)

`PAS_TODAY=2026-10-12 node build.mjs` builds the site as if today were that day, and says so as it runs. It exists
for the browser tests that are written around particular dates (which day off is next, what "this week" holds): they
run against a copy built for one fixed day, with the browser's clock set to the same day, so they don't start
failing when the calendar moves on. Never publish a copy built this way; the publishing job doesn't set it.
