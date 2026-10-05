# Philly After School

A static site: a directory of schools, and one page per school listing after-school
programs with a grade filter. Everything is generated from two data files.

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
| `analytics/` | A Google Tag Manager import with GA4 and Microsoft Clarity set up for the site's events. Not published with the site. |
| `dist/` | The finished site, created by the build. Not stored in `main`; the `live` branch holds it. |

## Before launch

Fill in `site.config.json`:

- `contactEmail`: where corrections go. Until it's set, the site says a contact address is coming.
- `supportUrl`: where the Support button goes (currently a Venmo profile). If it's empty, the Support page says contributions are being set up.
- `supportLabel` and `supportHandle`: the button text on the "Buy me a coffee" page, and the handle shown under it for people who'd rather search in the app.
- `siteUrl`: the domain you treat as the main one. Redirect the other domain to it at your host.
- `builtBy`: the name, link and short bio shown in the footer, on the home page and on About.
- `gtmId`: optional, e.g. `GTM-XXXXXXX`.
- `editLogin`: optional, `{ "user": "...", "passwordHash": "..." }`. Puts a sign-in on `/edit/`. The hash is a bcrypt hash, never the
  password itself. To change the password, make a new hash with `php -r 'echo password_hash("new password", PASSWORD_BCRYPT);'`
  and replace `passwordHash`. Changing it signs everyone out.
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
2. GitHub builds the site automatically (`.github/workflows/publish.yml`) and puts the finished files on the `live` branch.
3. The web host is connected to the `live` branch and deploys it.

If the data has a problem, step 2 stops and the live site stays as it was. The "Actions" tab on GitHub shows what went wrong.

To put the site on a different host, run `node build.mjs` and upload the contents of `dist/`.

## Edit a listing

Open `data/programs.json`, change the fields, set `lastVerified` to today's date, and commit to `main`.

Fields worth knowing:

- `grades`: a range like `"K-5"` or `"PK-3"`, a single grade like `"8"`, or `null` when the provider doesn't publish grades.
- `offers`: optional list of class names a family chooses between, like `["Piano", "Guitar"]`. Shown on the card, searchable, and offered as a tag when adding the program to a roster. Names only: no days, times or prices.
- `neighborhoods`: list of the neighborhoods the program's building (or buildings) is in, like `["Bella Vista"]`. Decides which
  neighborhood pages it appears on. A program that runs inside a school can leave it out and takes the school's neighborhood.
- `keywords`: optional list of plain words parents might search for (`"drums"`, `"karate"`, `"homework"`). Never shown, only searched.
- `pickupBy`: optional. The latest time a child can be collected, like `"6:00 pm"`. Shown on the card and on rosters. Leave it out when the provider doesn't publish an end time.
- `register.how`: `online` (needs `url`), `phone`, `contact`, `school` or `none`. `register.note` is shown next to it.
- `register.nextTerm`: optional. When sign-ups open for the next term, semester or school year, in a sentence with dates. Leave it out when the provider doesn't say.
- `register.dates`: optional list of `{ "date": "YYYY-MM-DD", "label": "..." }` for registration openings and deadlines. Each upcoming one gets "Add to calendar" links on the card; past dates drop off by themselves.
- `note`: the yellow caution box. Use it for anything unconfirmed.
- `schools`: one entry per school the program serves:
  - `relation`: `onsite`, `pickup` or `nearby`. Use `pickup` only when a source names the school.
  - `note`: a caution that applies to that school only.
  - `distance`: optional, e.g. `"three blocks from Nebinger"`.
  - `registerUrl`: optional, for providers with a separate sign-up link per school.
  - `address`: optional, when a provider sends this school's children to a different location.
  - `sources`: optional, extra sources that apply to this school only (the school's own aftercare sheet, for example).

## Add a school

1. Add a record to `data/schools.json` (copy Nebinger's and change it). The `id` becomes the URL: `"meredith"` gives `/meredith/`. Optional fields: `dismissalNote` (staggered dismissal times), `checkedNoPickup` (providers checked that don't serve the school) and `alsoListed` (programs the school names that haven't been confirmed yet).
2. In `data/programs.json`, add that school's `id` under `schools` for every program that serves it. Most providers are already there; they just need the new tag.
3. Add records for programs that are new (the school's own clubs and on-site care).
4. Commit to `main`.

## Program pages

Every program gets its own page at `/programs/<id>/` (for example `/programs/zhang-sah/`), built from the
same record as its cards: the details, each school it serves, and its reviews. `/programs/` lists them all
A to Z. Both are in the sitemap, and each program page carries structured data (name, address, phone, and
the star rating once there are reviews) for search engines. Nothing extra to maintain: add or edit a
program in `data/programs.json` and its page follows.

## Neighborhood pages

`/neighborhoods/` lists every neighborhood that has a school or a program, and each one gets a page at
`/neighborhoods/<name>/` (for example `/neighborhoods/bella-vista/`) showing the schools there, the programs
based there, and programs from elsewhere that pick up from a school there. They are built from each school's
`neighborhood` text (use " / " between two names for a school on a border) and each program's `neighborhoods`
list. A new neighborhood name anywhere in the data creates its page; spell names the same way each time.

## Editing the site's wording

Headlines, intros, section text, form labels and footer text can be edited on the site itself.

1. Open `/edit/`, sign in (when `editLogin` is set), and choose "Start editing". The page isn't linked from anywhere and is
   hidden from search engines. A sign-in lasts 30 days on that device, and edits can only be sent while signed in.
   Eight wrong tries from one address lock the form for 15 minutes.
2. Click any outlined text on any page and type. Edits are kept in that browser only.
3. "Review and send" emails the changes to `contactEmail`. The email lists each change and ends with a
   complete `data/copy.json`.
4. To publish, replace the contents of `data/copy.json` with that text and commit. To reject one change,
   delete its entry first. To go back to the original wording everywhere, set the file to `{}`.

Each entry is keyed by a fingerprint of the original sentence and holds `was` (the original) and `now`.
Words in curly braces, like `{school}`, are filled in per page. If a sentence is later reworded in
`build.mjs`, its entry stops matching; the build prints a note and carries on.

Not editable this way: program and school details (they come from the data files), menu labels, and text
the scripts write as you click (filter counts, the roster).

## Reviews

Reviews are approved before they appear. The form at `/review/` emails each review to `contactEmail`, with a
ready-made entry at the bottom of the email. To publish one, paste that entry into
`data/reviews.json` (inside the square brackets, entries separated by commas) and commit.
To remove a review, delete its entry. Cards show the average and the reviews for each program.

## Rosters

`/board/` ("My child's roster" in the menu) lets a visitor collect programs by weekday with "Add to roster"
on any card. Each child has two rosters, Current and Upcoming, so a family can share what they do now and
plan the next term. A family with more than one child adds a roster per child (up to six) and picks whose
roster a program goes on. Rosters are stored in the visitor's own browser, and each share link carries one
child's week in the address, so nothing about them is stored on the server. There are no accounts.
The page address and the analytics event names still say "board" so older links and reports keep working.

## The suggestion form

`/suggest/` posts to `suggest/send.php`, which the build generates. It emails each suggestion to
`contactEmail` and also appends it to `phillyafterschool-suggestions.log` in the folder above
`public_html`, so nothing is lost if an email goes missing. It needs a host that runs PHP.
A hidden field traps most spam bots.

## Analytics
`analytics/gtm-import-ga4-clarity.json` imports into the GTM container (Admin > Import Container, "Merge"). It adds a Google tag,
one GA4 event tag per event below, and Clarity. The GA4 and Clarity IDs live in the "GA4 Measurement ID" and
"Clarity Project ID" variables.


Set `gtmId` to load Google Tag Manager on every page. The site pushes these events to the data layer:
`pas_filter` (filter_type, filter_value, school), `pas_outbound` (link_type of register or website,
program_id, school; school is empty on a program's own page), `pas_suggest_submit` (suggest_kind, school), `pas_support_click`, `pas_review_submit` (program_id,
school, stars), `pas_board_add` (program_id, school, day, board, children) and `pas_board_share` (method, board).
`pas_outbound` also fires with link_type `calendar` and `review`. `pas_search` (search_term, results,
school) fires when someone pauses typing in a school page's search box; searches with zero results
show what parents want that isn't listed.

## Keeping it current

`dist/data/programs.json` is published with the site, so a scheduled check can read exactly
what the site shows, compare each listing to its sources, and report what changed. Review
the report and merge the changes you agree with. Busy times: March to May (next year's registration opens)
and late August (rec centers post their listings).
