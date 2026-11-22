# Setup, building and publishing

## What's here

| Path | What it is |
|---|---|
| `data/programs.json` | One record per program. Each program lists the schools it serves. |
| `data/schools.json` | One record per school. Adding a record adds a page. |
| `data/reviews.json` | Approved reviews. |
| `data/copy.json` | Edits to the site's wording, made in edit mode. Starts empty. |
| `site.config.json` | Site name, domain, contact email, support link, optional GTM ID. |
| `build.mjs` | Builds the site into `dist/`. Needs Node 18+, no installs. |
| `src/` | The stylesheet, the script for search, filtering and boards, and the edit-mode script. |
| `src/static/` | The site icon, the touch icon, the logo and the image shown when a link is shared. Copied to the top level as they are. |
| `scripts/send-alerts.mjs` | The daily job behind the date emails. Run by `.github/workflows/alerts.yml`. |
| `email/` | The date email's template, as it was uploaded to Klaviyo. Kept here for reference; Klaviyo holds the live copy. |
| `analytics/` | A Google Tag Manager import with GA4 and Microsoft Clarity set up for the site's events. Not published with the site. |
| `mail/Code.gs` | The mailbox script, pasted into script.google.com inside the contact@ Google account (see "The mailbox script" in `docs/emails.md`). Not published with the site. |
| `dist/` | The finished site, created by the build. Not stored in `main`; the `live` branch holds it. |

## Before launch

Fill in `site.config.json`:

- `contactEmail`: where corrections go. Until it's set, the site says a contact address is coming.
- `supportUrl` and `supportMonthlyUrl`: the two Stripe Payment Links on the Support page (pay what you want once; a monthly amount), with `supportLabel` and `supportMonthlyLabel` as the button text. Only the public `buy.stripe.com` addresses go here, never a key. If `supportUrl` is empty, the Support page says contributions are being set up. Coming back from Stripe: each link's "after payment" redirect is `https://phillyafterschool.org/support/?thanks=1&session_id={CHECKOUT_SESSION_ID}` (the one-time link) or `?thanks=2&…` (the monthly link); the page shows the matching thank-you (`#support-thanks`), counts the checkout once (`pas_support_thanks` with `plan` once or month, the same `pas-paid-seen` list the premium page uses) and takes the query off the address.
- `siteUrl`: the domain you treat as the main one. Redirect the other domain to it at your host.
- `builtBy`: the name, link and short bio shown in the footer, on the home page and on About.
- `writtenBy`: optional. A name for the "Written, edited, and humanized by" line under the "Created, managed, and
  meticulously vibe coded by" line in the footer. It carries no link.
- `designBy`: optional. A name for the "Logo and design zhuzhing by" line under those two. No link.
- `instagram`: optional. The site's Instagram page (an https URL). It goes in the footer's brand column as
  "@phillyafterschool on Instagram" with a small camera glyph, opening in a new tab, and into the home page's
  Organization schema as `sameAs`.
- `gtmId`: optional, e.g. `GTM-XXXXXXX`.
- `admins`: a list of email addresses whose accounts open `/edit/` and its pages (see "Site admins"). The build needs at
  least one, with accounts on (`groups` and `contactEmail`): without them `/edit/` would have no sign-in.
- `editLogin` is retired (Nov 2026). It was a shared username and password for `/edit/`; the build now refuses it.
- `privacyUpdated`: the date shown at the bottom of `/privacy/`. Change it when that page changes in a way that matters.
- `repo`: optional, `owner/name` on GitHub. Used only to put a link to `data/copy.json` in copy-edit emails.

## Build

```
node build.mjs
```

The build stops with a plain-English list if the data has a problem (a missing field,
a bad link, a program tied to a school that doesn't exist), so mistakes don't reach the site.

To look at the site without a server: `PREVIEW=1 node build.mjs`, then open `preview/index.html`.

## How changes reach the site

1. A change is merged into the `main` branch (edit a file on GitHub, or approve a proposed change).
2. GitHub builds the site automatically (`.github/workflows/publish.yml`), runs the tests (below) against a local copy, and puts the finished files on the `live` branch.
3. The web host is connected to the `live` branch and deploys it.

If the data has a problem, or a test fails, step 2 stops and the live site stays as it was. The "Actions" tab on GitHub shows what went wrong.

A research run's pull request also gets a comment from the autopilot gate (`.github/workflows/autopilot.yml`; see
"The autopilot gate"). While `data/autopilot.json` says `shadow`, the gate only comments and Josh merges by hand; once it
says `on`, a run's pull request with nothing held merges itself and the gate starts step 2.

To put the site on a different host, run `node build.mjs` and upload the contents of `dist/`.

## Rebuilt every night

`.github/workflows/publish.yml` also runs once a night. Nothing in the data changes, but the pages do: a day off that
has gone by comes off the day-camp page, and the summer schedule moves to the next summer on September 1. Pages hide
past days in the browser as well, so nothing stale shows in between. If the built site is unchanged, nothing is
published.

## Changing the site's address

The site lives at phillyafterschool.org and is staying there: a move to phillyafterschool.com was prepared in
October 2026 and then decided against, so the .com simply forwards to the .org. This section is here in case
the address ever does change. Almost everything takes its address
from `siteUrl` in `site.config.json`: links, the sitemap, `robots.txt`, canonical tags, emails the site sends,
share text, the tags on links out. Two settings sit beside it:

- `formerHosts`: other addresses that answer for the site. `.htaccess` sends each one (with or without www) to
  the same page on `siteUrl`, with a 301. That rule only runs for a domain attached to the same site folder in
  Hostinger (as a parked domain, with its own certificate). Today phillyafterschool.com is forwarded by a redirect
  set in Hostinger instead, which lands on the home page whatever the link was. The hourly check watches that it
  still arrives.
- `calendarIdHost`: the name inside every calendar entry's id (`CAL_ID_HOST` in `src/site.js` is the same
  value). It stays `phillyafterschool.org` for good, so a calendar file saved again after the move updates the
  entries a parent already has instead of doubling them.

A switch, once the new domain opens the site over https and is listed as an allowed origin on the Google
sign-in client:

1. In `site.config.json`, set `siteUrl` to the new address and `formerHosts` to the old one.
2. `python3 scripts/card-qr.py` to redraw the QR codes on the cards for the new address.
3. Change the address in `email/` and in the two live Klaviyo templates, and the three `custom_source` labels
   in `src/site.js` and `src/groups.js`.
4. Build, run the tests, push. Then check an old deep link lands on the same page at the new address.

What a move costs: people sign in again (the sign-in cookie belongs to the old address), and a plan kept only on
a device stays behind with the old address. Plans kept in a profile come back at the next sign-in. The accounts
database does not move: both addresses are served from the same folder.

## Site admins

`admins` in `site.config.json` is a list of email addresses. An account on the site with one of those addresses is a
site admin: while it is signed in (by the emailed code or by Google, like any account), `/edit/`, `/edit/stats/` and
`/edit/claims/` open, and the menu at the top of every page gains an **Admin** group with
the three links (Site numbers, Claims and changes, Edit the site's wording). The account and profile pages say
nothing about admin: those are the person's own. An admin's account and an editor's account (see "Editing the site's
wording") are the only ways into these pages: there is no shared password.

- The pages do the checking, not the browser: `edit_admin()` in `editAuthPhp()` (`build.mjs`) looks the session
  cookie up in the accounts database and compares the account's address with the list. The menu only shows the
  door: `groups/api.php` tells that account, and nobody else, `admin: true`; `groups.js` notes it in the browser
  (`pas-admin`, cleared on signing out) and `site.js` builds the Admin group from that note (`adminNav()`). The
  group is built in the browser and never written into a page, so no other visitor's page carries those
  addresses. A stale note shows the group and opens nothing.
- `/edit/claims/` also links to the hidden test listings.
- To add or remove an admin, change the list and publish. Removing an address closes the pages for it at once.
  Signing out of the account closes them on that device; "Sign out on every device" closes them everywhere.
- An admin account is only as safe as its inbox, since a sign-in code sent there is all it takes. Keep 2-step
  verification on for those mailboxes. A code allows five wrong tries, and tries are capped per visitor.
- Admin accounts are ordinary accounts in every other way, so they are counted in the site numbers like any other.
- The preview has no sign-in and no admin way in.
