# Backups, monitoring and sending email

## Backups, and knowing when something breaks

**Backups.** Everything that makes the pages is in this repository, so GitHub is the backup for the site itself. The one
thing that is not is the accounts database (`phillyafterschool-data/groups.sqlite`, next to the public folder on the
host): accounts, share groups, claims, saved weeks and summers. Two things cover it:

- The first request of each day makes a clean copy at `phillyafterschool-data/backups/groups-YYYY-MM-DD.sqlite` and
  the last 14 are kept (`BACKUP_DAYS` in `src/server/groups-api.php`). A copy made this way is whole even while the
  site is in use, which a plain file copy of a database in use may not be.
- Hostinger backs the whole site up daily, which carries those copies off the server. Check once, in Hostinger under
  Files > Backups > Restore and download, that the `phillyafterschool-data` folder is inside the backup.
- **A copy off the host, every day** (`offsite_run()` in `src/server/groups-api.php`, from the hourly `push_run`):
  the day's copy goes to the private repository `backupRepo` in `site.config.json`
  (`shwamansilverbauer/phillyafterschool-backups`), so losing the Hostinger account loses neither the site (this
  repository) nor its accounts. Before it leaves it is gzipped and encrypted (AES-256-GCM, key derived from
  `secret.key`, file starts `PASB1`), so the repository holds nothing readable on its own. One commit a day:
  `groups.sqlite.enc`, `backup.json` (the day, size, checksum, and how many rows each table has; no one's details),
  and listing photos not sent before, as `photos/<id>.jpg.enc` (six a run, the rest the next hour). Every past day
  stays in the repository's history. It goes through the key file /edit/ publishes with
  (`phillyafterschool-github.key`), which must have the backup repository in its access list (Contents: Read and
  write), and the repository must have a first commit ("Add a README file" when making it). The same key also
  writes the research runs' private queue to the ops repository (`opsRepo`), which needs the same access; see "The
  private queue" in `docs/listings.md`.
- **The restore drill, every day.** Right after sending, the server fetches the copy back from GitHub, opens it with
  the key, checks it is byte for byte the copy it sent, writes it out and opens it as a database (integrity check, the
  same row count in every table). Only then does the day count as backed up. The health answer says how that went
  (`offsite`: the last checked day, how many days ago, why the last try failed, photos still to go), and the hourly
  check fails when no checked copy has gone off the host for two days. A failed hour is tried again the next hour.
  The test suite does the whole round trip against a stand-in GitHub, then restores with the script below.
  To run it now rather than wait for the hour: Actions > Send date emails > Run workflow, tick "Only the site's
  hourly jobs" (no emails go out). It is still once a day: a run after the day's copy has gone does nothing more.

**Keep a copy of `secret.key` off the host** (a secure note in a password manager): the offsite copies, and a child's
details inside any copy, open only with it. Never put it in a repository or a message.

**Restoring from the offsite copy** (Hostinger gone, or a copy older than the 14 kept on the host):

1. From the backup repository, download `groups.sqlite.enc` and `backup.json` (or, for an earlier day, the file from
   that day's commit in its history).
2. `node scripts/restore-backup.mjs groups.sqlite.enc secret.key groups.sqlite`, with your saved copy of `secret.key`.
   It checks the copy against `backup.json` and writes the database. A folder of `photos/*.enc` opens the same way:
   `node scripts/restore-backup.mjs photos secret.key photos-restored`.
3. On the host, put `groups.sqlite` and the same `secret.key` in `phillyafterschool-data/` (and the photos in
   `phillyafterschool-data/photos/`), deleting any `groups.sqlite-wal` and `groups.sqlite-shm`. Publish the site as
   usual from this repository.

To go back to a copy: in Hostinger's file manager, replace `groups.sqlite` with the copy you want (renamed), and delete
`groups.sqlite-wal` and `groups.sqlite-shm` if they are there. Anything done after that copy was made is lost, and anyone who signed in after it
signs in again. Listing photos sent by program managers are files in `phillyafterschool-data/photos`, covered by the host's
backup.

**What is kept about a child is encrypted in the database** (since November 6, 2026): a child's first name and plans (a
week in a profile, a week in a group, the summer, the days off, the children on a profile) and a group's name (a shared
week is named after the child), each column AES-256-GCM with a key derived from `phillyafterschool-data/secret.key`
(`seal()` / `unseal()` and the `SEALED` list in `src/server/groups-api.php`; values start with `e1.`). Rows from
before were converted once, the first time the database was opened after the change (`seal_existing()`, flag `sealed`
in `meta`). Two things follow: a restored copy of `groups.sqlite` can only be read next to the same `secret.key`, so
keep that file with any copy you take off the host (Hostinger's backup has both); and backup copies made before the
change stay readable until they rotate out, 14 days. What the site looks up or sorts by is not encrypted: an email
address, an adult's name, a school, grades and ages, follows and favorites, claims.

**The hourly check.** `.github/workflows/monitor.yml` runs `scripts/site-check.mjs` every hour. It only reads. It checks
that the sitemap and a spread of pages open, that the site was rebuilt in the last two days, that the accounts service
answers and can write (`groups/api.php?action=health`, which says nothing about anyone), that a database copy was made
in the last two days, that the three forms answer, that the https certificate has more than 10 days left, and that the
two daily jobs (the build, and the date emails) last ran, and last passed, inside 36 hours. It also checks the key
`/edit/` publishes with: the health answer says whether GitHub still takes the token in `phillyafterschool-github.key`
and how many days it has left (`edit_key_state()`, asking GitHub at most every six hours; the key is never shown), and
the check fails two weeks before it runs out, with how to renew it. And it checks the home page still carries the
security headers below.

**Security headers.** The `.htaccess` the build writes sets, on every response: `Strict-Transport-Security` (HTTPS
only, for a year, for this host alone: the email service's link domain is a subdomain, so no `includeSubDomains`, and
the site is not on the browsers' preload list), `X-Frame-Options: SAMEORIGIN` (no other site can show these pages in a
frame, which protects the account and Kids' Playground pages from click tricks), `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` (other sites see the bare domain, never the page), and a
`Permissions-Policy` that turns off what the site never uses (camera, microphone, payments, USB, serial, Bluetooth)
and keeps location for this site alone ("Nearest" asks for it). Font files are cached for a year. If the site ever
has to be shown inside a frame elsewhere, or moves off HTTPS, those lines are where to start; HSTS in particular is
remembered by browsers for a year once seen.

When a check fails it opens an issue titled "Site check: something needs a look", assigned to the repository's owner,
which GitHub emails. The issue says what failed and what to do. While something keeps failing the same issue is
updated, with no new email each hour, and it closes itself when everything passes. Each address is tried three times
before it counts as a failure. If the web host turns GitHub's servers away (a 403 or 429 on the home page, which its
bot protection does now and then while the site is up for everyone else), the check waits and asks again for about
two minutes, and if it is still refused says so once, with "open the site on your phone" as the thing to do, instead
of listing every page as broken. Run it yourself any time: Actions > Check the site > Run workflow, or locally
`node scripts/site-check.mjs`.

Two limits. GitHub's scheduler is often hours late and sometimes skips a run, so this is a daily safety net more
than a minute-by-minute alarm; for that, point a free uptime service at the home page and at
`https://phillyafterschool.org/groups/api.php?action=health` (it should contain `"ok":true`). And GitHub pauses
scheduled jobs in a repository that has had no changes for 60 days; merging the monthly check keeps that from
happening, and the check itself says so if a daily job stops.

## Sending email

The site's own emails (sign-in codes, invitations, notices to managers and to you, and what the forms send to the
inbox) go out one of two ways. News and the "a school was added" emails are Klaviyo's and are not part of this.

- **The host's own mail** (PHP `mail()`), which is how it starts. Hostinger stops this at 100 emails in any 24 hours
  and 10 a minute, on every plan, and the messages are not signed for the domain.
- **Postmark**, once two things are true: `"mail": { "postmark": true }` is in `site.config.json`, and the key is on
  the server. Both are needed, so a key alone changes nothing and the privacy page only names Postmark once it is
  switched on.

To switch it on:

1. In Postmark, make the account and a server, and verify the sending domain (it gives two DNS records to add at
   Hostinger: a DKIM record and a Return-Path CNAME). The sender is `contactEmail`.
2. On the host, next to the public folder (the same place as `phillyafterschool-edit.key`), make a file named
   `phillyafterschool-postmark.key` holding only the server's "Server API token". **Never put the token in this
   repository, in an issue or in a chat.** The file's name is in `.gitignore`.
3. Set `"mail": { "postmark": true }`, change `privacyUpdated`, and publish.
4. Open `groups/api.php?action=health`: `"mail":{"via":"postmark"}` means the key was found. After the first email,
   `"last":"ok"` means Postmark took it.

How it behaves (`mailerPhp()` in `build.mjs`, used by `groups-api.php` and by each form's handler):

- Each email is offered to Postmark first. If Postmark can't be reached, or refuses for a reason on our side (an
  account not yet approved, a wrong token, an unverified sender), the email goes by the host's mail instead, so a
  problem there never locks anyone out. If Postmark says the address itself is switched off (it bounced before, or
  the person marked our mail as spam), the email is not sent another way.
- Open and click tracking are off for every message.
- `phillyafterschool-mail.json`, next to the public folder, holds the day's counts (by Postmark, by the host,
  failed) and Postmark's last answer. Numbers and a code only: no address, no subject.
- The hourly check reads the health answer and opens its issue if Postmark is switched on but the key is missing,
  or if Postmark refused the last email.
- To go back to the host's mail, delete the key file or set `postmark` to `false`.
