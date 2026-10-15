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
| `scripts/send-alerts.mjs` | The daily job behind the date emails. Run by `.github/workflows/alerts.yml`. |
| `email/` | The date email's template, as it was uploaded to Klaviyo. Kept here for reference; Klaviyo holds the live copy. |
| `analytics/` | A Google Tag Manager import with GA4 and Microsoft Clarity set up for the site's events. Not published with the site. |
| `dist/` | The finished site, created by the build. Not stored in `main`; the `live` branch holds it. |

## Before launch

Fill in `site.config.json`:

- `contactEmail`: where corrections go. Until it's set, the site says a contact address is coming.
- `supportUrl` and `supportMonthlyUrl`: the two Stripe Payment Links on the Support page (pay what you want once; a monthly amount), with `supportLabel` and `supportMonthlyLabel` as the button text. Only the public `buy.stripe.com` addresses go here, never a key. If `supportUrl` is empty, the Support page says contributions are being set up. Coming back from Stripe: each link's "after payment" redirect is `https://phillyafterschool.org/support/?thanks=1&session_id={CHECKOUT_SESSION_ID}` (the one-time link) or `?thanks=2&…` (the monthly link); the page shows the matching thank-you (`#support-thanks`), counts the checkout once (`pas_support_thanks` with `plan` once or month, the same `pas-paid-seen` list the premium page uses) and takes the query off the address.
- `siteUrl`: the domain you treat as the main one. Redirect the other domain to it at your host.
- `builtBy`: the name, link and short bio shown in the footer, on the home page and on About.
- `writtenBy`: optional. A name for a "Written by" line under "Built by" in the footer. It carries no link.
- `gtmId`: optional, e.g. `GTM-XXXXXXX`.
- `admins`: optional, a list of email addresses whose accounts open `/edit/` and its pages (see "Site admins").
- `editLogin`: optional, `{ "user": "...", "passwordHash": "..." }`. Puts a sign-in on `/edit/`. The hash is a bcrypt hash, never the
  password itself. To change the password, make a new hash with `php -r 'echo password_hash("new password", PASSWORD_BCRYPT);'`
  and replace `passwordHash`. Changing it signs everyone out.
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
2. GitHub builds the site automatically (`.github/workflows/publish.yml`) and puts the finished files on the `live` branch.
3. The web host is connected to the `live` branch and deploys it.

If the data has a problem, step 2 stops and the live site stays as it was. The "Actions" tab on GitHub shows what went wrong.

To put the site on a different host, run `node build.mjs` and upload the contents of `dist/`.

## Building for another day (tests only)

`PAS_TODAY=2026-10-12 node build.mjs` builds the site as if today were that day, and says so as it runs. It exists
for the browser tests that are written around particular dates (which day off is next, what "this week" holds): they
run against a copy built for one fixed day, with the browser's clock set to the same day, so they don't start
failing when the calendar moves on. Never publish a copy built this way; the publishing job doesn't set it.

## Rebuilt every night

`.github/workflows/publish.yml` also runs once a night. Nothing in the data changes, but the pages do: a day off that
has gone by comes off the day-camp page, and the summer schedule moves to the next summer on September 1. Pages hide
past days in the browser as well, so nothing stale shows in between. If the built site is unchanged, nothing is
published.

## Backups, and knowing when something breaks

**Backups.** Everything that makes the pages is in this repository, so GitHub is the backup for the site itself. The one
thing that is not is the accounts database (`phillyafterschool-data/groups.sqlite`, next to the public folder on the
host): accounts, share groups, claims, saved weeks and summers. Two things cover it:

- The first request of each day makes a clean copy at `phillyafterschool-data/backups/groups-YYYY-MM-DD.sqlite` and
  the last 14 are kept (`BACKUP_DAYS` in `src/server/groups-api.php`). A copy made this way is whole even while the
  site is in use, which a plain file copy of a database in use may not be.
- Hostinger backs the whole site up daily, which carries those copies off the server. Check once, in Hostinger under
  Files > Backups > Restore and download, that the `phillyafterschool-data` folder is inside the backup.

To go back to a copy: in Hostinger's file manager, replace `groups.sqlite` with the copy you want (renamed), and delete
`groups.sqlite-wal` and `groups.sqlite-shm` if they are there. Anything done after that copy was made is lost, and anyone who signed in after it
signs in again. Listing photos sent by program managers are files in `phillyafterschool-data/photos`, covered by the host's
backup.

**The hourly check.** `.github/workflows/monitor.yml` runs `scripts/site-check.mjs` every hour. It only reads. It checks
that the sitemap and a spread of pages open, that the site was rebuilt in the last two days, that the accounts service
answers and can write (`groups/api.php?action=health`, which says nothing about anyone), that a database copy was made
in the last two days, that the three forms answer, that the https certificate has more than 10 days left, and that the
two daily jobs (the build, and the date emails) last ran, and last passed, inside 36 hours.

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

## Schools that aren't covered yet

Every school in `data/all-schools.json` that isn't covered has a page of its own at `/schools/ID/`
(`uncoveredSchoolPage()`): the after-school programs within a mile, and the weekend classes and summer camps within
two, measured in a straight line from the school's coordinates, plus the nearest covered school. It never says a
program picks up from the school, because nobody has checked. A page with fewer than three things nearby is marked
`noindex` and left out of the sitemap, so search engines aren't handed near-empty pages; the rest are indexed. The
schools page links to all of them. `/schools/request/?s=ID`, the old address, forwards to the school's page, and with
no school chosen it is still the search box. The preview copy has no school pages and keeps the one shared page.

On a school's page, "Ask for this school" counts a vote. Under it, "Email me when it's added" takes a first name and an email
address and sends them straight to Klaviyo with the browser key, onto the same list as the dates emails, with
`signup_place: school_request`, `waiting_school_name` (the latest school asked for) and the school's id appended to
`waiting_schools`. Nothing sends the "it's here" email yet: when a school goes live, build a Klaviyo segment where
`waiting_schools` contains its id and write to it.

## Terms of use

`termsPage()` in `build.mjs` writes `/terms/`, linked from the footer and from the account page, because
`"termsLive": true` is set in `site.config.json`. Set it to `false` and the page goes back to being a draft that is
built into the preview copy only. `termsOperator` names who runs the site, in a line under "What this site is" and in the liability line (the site's name if
unset), and `termsUpdated` sets the date shown: change it when the terms change in a way that matters.

## Where things are: distances and the map

- `data/geo.json` holds a latitude and longitude for every street address in the data. `node scripts/geocode.mjs`
  fills it in from the U.S. Census Bureau's free address lookup; run it by hand after adding or changing an address.
  It only asks about addresses it doesn't have, and lists any it couldn't place so they can be added by hand
  (`byHand` names the ones that were). `scripts/addresses.mjs` is the one place that pulls street addresses out of an
  `address` line; add a place with no street number to its `KNOWN` list.
- On a school's page, a program that isn't in the building and has no hand-written `distance` gets "about 0.3 miles
  from Nebinger, in a straight line", measured from the address it uses for that school.
- Each listing in a filtered list carries its points (`data-ll`). The filter bar's "Nearest" row (`near: true` on
  `filterBar`) sorts a citywide list by distance from the parent's saved school or from where they are, and labels
  each listing with the miles. The location is used in the browser only. On a school's page the row is just the map.
- "Show the map" loads Leaflet from `assets/leaflet/` (copied from `src/vendor/leaflet`, so no other site is asked
  for the library) and map pictures from OpenStreetMap, and only then. The map follows the filters. The preview copy
  has no map. Events: `pas_near` with `from` (school, me, off) and `pas_map_open`; never a location.

## Your listing this month

A manager who has claimed a listing sees its numbers on `/managers/`: how many times it was opened, clicks to sign up,
clicks to its website, times it was put on a family's plan, and people who asked for its emails, for the last 30 days
(and the 30 before, once counting has run that long), with page views day by day.

- **What is kept.** One row per listing, kind and day in the `hits` table: `view`, `signup`, `site`, `plan`, `email`
  (`HIT_KINDS`). A number, and nothing about who. Rows older than 400 days are deleted.
- **How it is counted.** `hit()` in `site.js` posts the listing and the kind to `groups/api.php?action=hit`: a view when a
  program's or camp's own page is opened (once per tab, via `sessionStorage`), `signup` and `site` when a register,
  camp or website link is followed from its page or its card, `plan` when it is added to a week, a day off or a summer
  week, and `email` when someone signs up for its emails. Nothing else goes with it.
- **What is left out.** A browser driven by a script, the owner while editing, and a listing's own manager while signed
  in. More than `HITS_AN_HOUR` counts from one internet address in an hour are dropped; for that the server keeps a
  keyed hash of the address in the `throttle` table for up to two days, as it already does for sign-in attempts.
- **Who sees it.** `claim_out()` adds `stats` to each claim the signed-in account holds. `/edit/stats/` lists the 40
  most-opened listings for the owner. There is no public view.
- The preview copy counts nothing.

## Is there space

A place with more than one listing (an after-school program and a camp, say) signs in once on `/managers/`, is shown
every listing at its website address, and can claim them all with one button. Each claimed listing then has its own
update form and space question on that one page.

A manager whose claim stands can mark a listing "Spots open", "Waitlist" or "Full" on `/managers/` (or "Don't show").
It is one of three fixed words, so it goes on the listing at once, without review, with the day it was set
(`space_set`; table `space`). It stops showing after 30 days (`SPACE_DAYS`) unless set again, and when nobody holds
the claim. The public `claimed` request carries it, and pages fill their `[data-space]` slots from that: the program
page, its card on school pages, weekend cards and camp cards. This is free and stays free.

## Summer camps

Summer camps are their own list, in `data/camps.json`. `/summer-camps/` lists them as rows (name, a line, the
weeks, ages, grades, neighborhood), and a camp with no `program` has its own page at `/summer-camps/ID/`
(`campPage()`; a camp tied to a program is that program's Summer section, see "Program pages") with
everything it posts, the weeks it runs, the camps closest to it, and the tools to suggest an update or claim it. Nothing in the file is tied
to a school or to the after-school pages. The file has:

- `season`: the summer most listings describe (`2026`). A camp whose own `season` is later shows a yellow
  "Summer 2027" pill; the rest say "2026 details".
- `camps`: one entry per camp. `id`, `name`, `what`, `types` (the same list as programs, plus `nature` and
  `daycamp`), `ages` (as the camp states them), `ageMin` and `ageMax` (years; the grade picker is worked out from
  them: pre-K is 3 and 4, kindergarten 5, 1st grade 6), `season`, `weeks`, `hours`, `extended` (before and after
  care), `cost`, `weekly` (the lowest regular full-day week, a number), `price` (`free` or `paid`), `aid` (when it or
  `cost` names financial aid, a scholarship, tuition assistance, a sliding scale, pay-what-you-can or a subsidy,
  the listing counts under the "Free or offers aid" filter; discounts don't count),
  `address`, `neighborhoods` (grouped into parts of the city by `CAMP_AREAS` in `build.mjs`; leave it empty for a
  camp that runs all over), `phone`, `website`, `registerUrl`, `signup` (what the camp says about when sign-ups
  open), `dates` (specific sign-up dates, each `{ "date", "label" }`: shown with "Add to calendar" and emailed to
  the camp's followers), `updates` (short dated notes emailed to its followers; see "Dates by email"), `note` (the
  yellow caution), `program` (the id of the same provider's school-year listing), `sources`, `checked`.
  A camp's `id` is its address (`/summer-camps/ID/`) and what followers and saved summers point at: never change one.
- `check`, on every camp: the quickest way to read it again. `url` (the one page to open), `how` (`fetch`,
  `browser` or `person`), `look` (where on the page the weeks and price sit) and `notes` (what tripped us up).
- `todo`: camps known to run in the city that haven't been read yet, with why. `dropped`: camps looked at and left
  out, with why.

Only what a camp's own site says goes in. To update a camp: open `check.url` the way `check.how` says, change the
fields, set `season` to the summer the page now describes, set `checked` to today, and fix `check` if the page moved.
The build writes the whole worklist into `data/check.json` under `camps`, oldest summer first.

**The summer schedule** (`/summer-schedule/`, the planner) and **the weeks chart** (`/summer-camps/weeks/`, "When
each camp runs", for everyone; `summerWeeksPage()`) are built from the same file. They lay out the coming summer as weeks,
Monday to Friday, from the week of the district's last day (`lastDay` in `data/days-off.json`) to the week before
Labor Day, and works out which of those weeks each camp runs:

- The weeks come from the first date range in the camp's `weeks` line, so write it as "June 8 to August 28, 2026".
  Weeks off are read from the same line when it says "none June 29 to July 3", "no camp June 29 to July 3" or
  "none the week of June 29". A single day off ("no camp July 3") doesn't cancel the week.
- A camp whose weeks aren't one range (four separate weeks, say) carries `runs`: a list of
  `["first day", "last day"]` pairs, with optional `skips` (any day in a week it doesn't run). `runs` replaces what
  the `weeks` line would give. If its dates aren't in the camp's `season` year the build says so and ignores them,
  so update `runs` whenever `season` changes.
- A camp whose `season` is the coming summer shows its real weeks (green). A camp still on last summer is moved 52
  weeks on, to the same week of the calendar, and marked as last summer's dates (blue). Anything older, or a line
  with no date range, has no weeks and sits under "No dates listed yet"; a parent can still add it to a week.
- The page has a chart of every camp by week, which works without JavaScript, and "Your summer", where a parent adds
  camps to weeks from each week's list or by tapping the chart. Each camp card on `/summer-camps/` has "Add to your
  summer" (`summer-schedule/?add=ID`).
- **Children.** A summer belongs to a child, and the children are the same ones as in the week builder and the
  day-camp plan (`pas-rosters` in the browser). Each child carries `sum`: `{ y: 2027, w: { "2027-06-07": [camp ids] },
  age: "7" }`. "Add a sibling" adds a child; a first name is optional and typed on the page. A child with an
  after-school roster can only be removed on the week builder, where share groups are told. A summer stays in the
  browser unless its owner keeps it in their profile (next point). It is never part of a share group.
- **Kept in a profile, by itself.** Signed in, the summer keeps itself in the parent's profile with nothing to press
  (`#sum-profile`, drawn by `groups.js`, which the page loads; see "Plans keep themselves" below). The server holds
  one summer per account (table `summers`): the year, and for each child a first name and camp ids by week. Ages, the
  calendar's title and photos never leave the device. While it is kept (`sumProf` in `pas-rosters`), changes are sent
  a moment after they're made (`summer_save`); a newer copy in the profile replaces the one on the device at the next
  visit. `summer_delete` ("Take it out of my profile") takes it out; deleting the account deletes it. No action
  shares a summer or reads someone else's.
  Signing in from the box goes to `/account/?next=summer` (or `/register/`) and comes back.
- **Add to calendar** saves `summer-2027.ics`, made in the browser: one Monday-to-Friday entry per camp week, titled
  with the child's name and the camp. The day-camp plan has the same button (`days-off.ics`, one entry per planned
  day). `saveCalendar()` in `site.js` writes both.
- **Make it a calendar** is the planner's fourth view, there once any child has a week planned (the button stays
  hidden until then, and it is never the view the page opens on). It draws the plan as a picture, like the week
  card: the whole summer on one card (a row a week, a column a child), or a card for each month (Monday to Friday, a
  bar for each child's camp). While it shows, the weeks, the tools row and the profile box are out of the way
  (`.card-view` on the planner) so the picture comes straight under the strip. The days-off planner has the same
  view. The title defaults to
  the children's names ("Sam and Rae's summer") and can be typed over (`sumTitle`, kept in the browser). A photo can
  go in the corner; it is drawn in the browser and never saved or uploaded. The pictures can be saved one at a time
  or all at once, shared, copied or printed.
- **Sharing a picture** (this card, the week card and the day-camp card) goes through `pictureSharer()` in `site.js`.
  Safari only opens a share sheet from inside the tap, so each card keeps its picture ready after every redraw and
  hands it over at once. If the sheet can't open (some in-app browsers), the card says so and points to "Save as
  image".
- The one analytics event is `pas_summer` with an `action` (add, remove, age, sibling_add, copy_sibling, copy, share,
  calendar, card_save, card_share, card_copy, card_print, print, clear, profile_keep, profile_put, profile_stop), the camp id, the week number and how many
  children there are. Names, titles and photos are never in it, and the whole section is masked in recordings.
- The schedule switches to the next summer on September 1.

## My kids' calendar

`/calendar/` (`calendarPage()`) is the whole year in one place, for a signed-in parent only. The page that is served is
a shell with the listings' names and dates in it and nothing about anyone; it is kept out of search, and loads no
analytics or recordings.

- **Who sees what.** Signed out, the page explains what it is and offers to log in or create an account
  (`?next=calendar` brings them back). Signed in, `groups.js` asks the server who this is and for the profile, and hands
  the profile to `window.pasYear.show()` in `site.js`, which draws everything in the browser. Nothing about a plan is
  sent from this page. There is no link to a family's calendar and no way to share it from the site.
- **Where the plans come from.** Each kind of plan comes from the profile when it is kept there, otherwise from this
  device: the days-off plan and the summer as a whole, the after-school week child by child. Children are matched by
  first name. The top of the page says which is which and links to the planner to change it or keep it. The individual
  planners ask for an account too (see "The planners need an account").
- **What is on it.** "Every school week" (each child's current roster, or the upcoming one when the current is empty),
  then month by month: every day school is closed with each child's plan (or a link to plan it), camp weeks, the
  last day of school, and every upcoming sign-up date (`register.dates`, and a camp's `dates`) of a program or camp a
  child is down for. A camp still on last summer's weeks is marked as a guide.
- **The calendar file** (`school-year-2026-27.ics`) holds what is ticked: days off, camp weeks, guide weeks (off by
  default), sign-up dates, and the after-school week as entries that repeat every school week and skip the days off
  (off by default). Each entry has a fixed id, so opening a newer copy updates the old entries in most calendar apps.
- **When a date changes.** A file is a copy. At each download the page keeps, in the browser (`pas-year-file`), what
  the file held; on later visits it lists what is new, moved, changed or gone since, with "Download it again".
- **Your own dates.** "Add your own dates" at the top takes picture day, pretzel day, a form that's due: what it is,
  how often (one day, which asks for a date, or every week, which asks only for a day of the week), and who it's for (everyone, or any of the children; a child
  can be named on the spot). "Add several at once" reads a typed or pasted list, one per line, each starting with a
  date (`10/14`, `Oct 14`, `2026-10-14`) or a weekday (`Wednesdays`, `every Monday`); lines it can't read stay in
  the box. They are kept with the rosters in the browser (`own` in `pas-rosters`: `{ id, t, d, r, w }`), never sent
  to the server and not part of a profile, so they are on that device only. A single day shows in the month list
  and the month picture; a weekly one joins that child's "Every school week" card, repeats in the calendar file
  to the last day of school, skipping days off, and is drawn on every school day it falls on in the month pictures. "Dates you added yourself" in the file's options turns them off.
  A date of your own is enough for the calendar to appear, with no other plan.
- **Pictures.** "School weeks" on one card, and a calendar for each month with something on it: days off in yellow
  with a bar for each child, camp weeks as bars across the row, a flag on a sign-up date, and a teal flag for each
  date of your own (two to a day, then "+ 2 more"). "Show the dates I added" beside the pictures turns the teal
  flags off; the choice is kept on the device (`pas-year-pic-own`). Title (`yearTitle`) and
  photo work as on the other cards, and stay on the device.

## Weekend classes

A listing in `data/programs.json` with a `weekend` block shows on `/weekends/` and gets a "Weekends" row on its own
page: `{ "summary": "...", "days": ["sat"], "term": "Fall 2026: ...", "cost": "...", "note": "...", "url": "https://…",
"sources": [...], "check": { "url", "how", "look", "notes" }, "checked": "YYYY-MM-DD" }`. A place that only runs on
weekends (or only weekends and day camps) leaves `schools` as `{}`, like a day-camp-only listing.

Weekend classes go by where they are, not by school. `/weekends/` is one A to Z list of rows (name, a line, the
days, the neighborhood; `listRow('weekend', …)`), filtered by age, type and part of the city (the `CAMP_AREAS` list
the summer camps use, worked out from each listing's `neighborhoods`), and a parent's saved school never narrows
it. Each neighborhood page has a "Weekend classes" section: the places in that neighborhood, then a section of the
rest of that part of the city. A neighborhood that isn't in `CAMP_AREAS` falls under "Elsewhere in the city", so
add new ones there.

Optional `"times": { "sat": "9:30 am to 12:30 pm", "sun": "..." }` gives the short time shown in the week builder
and on the card when a parent has typed nothing of their own.

A place found in a sweep for weekend classes, where nothing else about it has been read, carries
`"scope": "weekend"`. Its page then says only its weekend classes have been read, instead of saying it has no
weekday program. Take the field off once its weekday classes have been checked against the schools.

**Weekends in Build your week.** The board has an "Add Saturday and Sunday" button under the weekdays. Weekend picks
are kept beside the weekdays, not in them (`board.wk = { sat: [], sun: [] }`, each entry a program id, or
`id~what the parent typed`), so pickup, the cost estimate and the week roller never see them. A weekend pick has no
school and no pickup label. The Weekends section of a program's page has an "Add Saturday to your week" button
(`board/?wk=ID&day=sat`; one per day it runs). The card is one image for the whole week: with weekend picks it grows by one row,
Saturday and Sunday side by side under Friday; without them it is the same card as before. In a profile or a
shared week the weekend travels as two more days, `sat` and `sun`, holding program ids only: the server drops
what a parent typed, and any program that has no class on that day. Weeks saved before this open unchanged.

## Edit a listing

Open `data/programs.json`, change the fields, set `lastVerified` to today's date, and commit to `main`.

Fields worth knowing:

- `grades`: a range like `"K-5"` or `"PK-3"`, a single grade like `"8"`, or `null` when the provider doesn't publish grades.
- `types`: required. One or more of `aftercare`, `music`, `theater`, `art`, `movement`, `stem`, `academics`, `games`, `nature`, `daycamp`, `clubs`, `rec-center`.
  Drives the type filter and the type pages. The first one listed is the color and icon the program wears on a roster card.
- `price`: `"free"`, `"paid"` or `"both"` (some of it is free, some paid). Drives the Free / Paid filter. Leave it out when the
  provider doesn't publish a price; the program then shows only under "Any".
- A program whose `types` include `clubs` is treated as a school's own clubs: it appears on that school's page (and its
  neighborhood's) but not on the A to Z list or the type pages, where there would be one near-identical entry per school.
- `offers`: optional list of class names a family chooses between, like `["Piano", "Guitar"]`. Shown on the card, searchable, and offered as a tag when adding the program to a roster. Names only: no days, times or prices.
- `neighborhoods`: list of the neighborhoods the program's building (or buildings) is in, like `["Bella Vista"]`. Decides which
  neighborhood pages it appears on. A program that runs inside a school can leave it out and takes the school's neighborhood.
- `keywords`: optional list of plain words parents might search for (`"drums"`, `"karate"`, `"homework"`). Never shown, only searched.
- `rate`: optional. The published price in a form the roster can add up. `per` is `"day"`, `"week"`, `"month"` or `"term"`, with exactly one of: `flat` (one price whatever the days, like `{ "per": "month", "flat": 100 }`), `eachDay` (a price for each weekday attended, like `{ "per": "day", "eachDay": 40 }` or `{ "per": "term", "eachDay": [741, 912] }` for a range), or `byDays` (a price for each number of days a week, like `{ "per": "week", "byDays": { "1": 40, "2": 70 } }`). Optional extras: `monthCap` (a monthly rate that caps a daily one), `fullWeekOff` (a discount for five days, as `0.1`), `atLeast: true` (the provider publishes only a starting price) and `extra` (a sentence on what the figure leaves out). Only from prices the provider publishes; leave it out otherwise and the roster says the program isn't counted.
- `days`: optional list of the weekdays the program runs, from `"mon"`, `"tue"`, `"wed"`, `"thu"`, `"fri"`. Shown on the card as "Monday to Friday" or the named days. Leave it out when the provider doesn't say; the program then shows under every day.
- `daysNote`: optional sentence shown after the days, like `"Choose 1 to 5 days a week."`
- `offerDays`: optional, for class-based programs: which class meets on which days, like `{ "Choir": ["tue", "thu"] }`. Each name must be in `offers`. A roster warns when a class is put on a day it doesn't meet.
- `daysOff`: optional. What the program runs when district schools are closed: `{ "summary": "...", "url": "https://…", "dates": ["2026-11-03"], "sources": [{ "label": "…", "url": "https://…" }] }`. `dates` holds only the dates the provider itself posts (an empty list when it posts none). Puts the program on the "Days off from school" page.
- `pickupBy`: optional. The latest time a child can be collected, like `"6:00 pm"`. Shown on the card and on rosters. Leave it out when the provider doesn't publish an end time.
- `register.how`: `online` (needs `url`), `phone`, `contact`, `school` or `none`. `register.note` is shown next to it.
- `register.nextTerm`: optional. When sign-ups open for the next term, semester or school year, in a sentence with dates. Leave it out when the provider doesn't say.
- `register.dates`: optional list of `{ "date": "YYYY-MM-DD", "label": "..." }` for registration openings and deadlines. Each upcoming one gets "Add to calendar" links on the card; past dates drop off by themselves.
- `note`: the yellow caution box. Use it for anything unconfirmed.
- `schools`: one entry per school the program serves. Leave it as `{}` only for a listing with `daysOff` or `weekend` that runs nothing on a weekday afternoon (a theater with Saturday classes and holiday camps, say). That listing gets its own page and a card on the day-camp page, and stays off every school page, the A to Z list, the type and neighborhood pages and the roster.
  Otherwise:
  - `relation`: `onsite`, `pickup` or `nearby`. Use `pickup` only when a source names the school.
  - `note`: a caution that applies to that school only.
  - `distance`: optional, e.g. `"three blocks from Nebinger"`.
  - `registerUrl`: optional, for providers with a separate sign-up link per school.
  - `price` and `cost`: optional, when the price is different for this school (free through a partnership, say). They replace the
    program's own `price` and `cost` on this school's page, and the program page shows the school's `cost` under that school.
  - `address`: optional, when a provider sends this school's children to a different location.
  - `sources`: optional, extra sources that apply to this school only (the school's own aftercare sheet, for example).
  - `checked`: the day this program-to-school link was last confirmed against a source (`YYYY-MM-DD`). `lastVerified` stays
    the day the listing's own details (hours, price, registration) were last checked.
- `pickupLists`: the provider's pickup lists as they were last read, one entry per list the provider publishes. See
  "Keeping it current".

## Add a school

1. Add a record to `data/schools.json` (copy Nebinger's and change it). The `id` becomes the URL: `"meredith"` gives `/meredith/`. Leave `dismissal` out when the school doesn't post one (the page then says so and tells families to ask); `dismissalNote` still shows. `aliases` lists the other names providers use for the school ("Jackson" for Coppin, "Vare Washington" without the hyphen), so the build can tell whether a provider's pickup list names it. Optional fields: `dismissalNote` (staggered dismissal times), `checkedNoPickup` (providers checked that don't serve the school) and `alsoListed` (programs the school names that haven't been confirmed yet).
2. In `data/programs.json`, add that school's `id` under `schools` for every program that serves it. Most providers are already there; they just need the new tag.
3. Add records for programs that are new (the school's own clubs and on-site care).
4. Give the school record `"added": "YYYY-MM-DD"` with the day it goes live. Parents who asked on the school's old
   "not covered yet" page to be told get one email that morning. Its old address (`/schools/<city id>/`) is
   sent on to the new page by a line the build writes into `.htaccess`.
5. Commit to `main`.

## Program pages

Every program gets its own page at `/programs/<id>/` (for example `/programs/zhang-sah/`), built from the
same record as its cards. `/programs/` lists them all, in a section per kind of program (each under the first of
its `types`, A to Z inside; `typeSections()` in `build.mjs`, which the weekend, day-camp and summer lists use too),
with the hero naming each section as a colored pill and a strip under the menu bar (`pageNav(jumpNav())`) that
jumps between the sections and stays under the slim search bar as the page scrolls; the type, neighborhood and
by-day pages have the same strip over their kind sections.

**What stays under the menu bar.** Anything that switches between views of a page is sticky, so it is the page's
navigation wherever you are on it: `.pagenav` holds a list page's jump links and, on the day-camps page, the
Programs · The days switch above them (the jump links are the visible view's, refreshed on a switch); a planner's
heading row with its view switch (`.year-view-head`: the week builder's The week · Budget planning · Make it a
card · Keep & share, the summer and days-off planners' List · Month · Who's open · Make it a calendar, the
calendar's views) sticks the same way.
The slim search bar on a list pushes the strip down by its own height while it shows. Both are in the sitemap, and each program page
carries structured data (name, address, phone, and the star rating once there are reviews) for search engines.
Nothing extra to maintain: add or edit a program in `data/programs.json` and its page follows.

**One section for each part of the year.** A program's page has a section for everything it runs, in the order
of a family's calendar: After school (the weekday details, the grade strip, the schools it serves), Weekends
(what runs, on which day, the term and the cost, from `weekend`), Day camps (the summary and the days it has
posted, break by break, from `daysOff`) and Summer (the summer camp tied to it, see below). Each section has the
same shape: the details in a card, then a filled button that puts it on the parent's plan for that part of the
year ("Add to your week" → the week builder; "Add Saturday to your week" → the week builder's weekend;
"Add it to your days off" → the days-off planner, opened on the first day it has posted; "Add to your summer"
→ the summer planner) and plain buttons for the provider's own sign-up and website. The hero says what it runs
as a row of colored pills (`runsStrip()`, one color per kind, the same colors as the All programs page) and the
sticky strip under the menu bar (`jumpNav()`) jumps between the sections, Schools and Reviews. The sections are
`kindSection()` in `programPage()`; the "Tell me when sign-ups open" box, "Suggest an update" and the claim link
sit under the sections.

**A summer camp tied to a program is that program's Summer section.** A camp in `data/camps.json` with a
`program` (the program's id) has no page of its own any more: its details, week strip, "Add to your summer"
button and its own follow box ("Tell me when it posts summer 2027", key `c:<camp>`) are the program page's
`#summer` section, built by `summerBlock()`, which `campPage()` also uses for camps with no program. Everywhere
a camp is linked (the camps list, the weeks chart, the summer planner, the calendar, the emails) `campLink()`
points a tied camp at `/programs/<id>/#summer`. The camp's old address, `/summer-camps/<camp>/`, keeps a small
page that sends people on (`campMovedPage()`: a meta refresh, a canonical link to the program page, and
`noindex`), and `.htaccess` sends it there with a 301 first wherever Apache runs. Tied camps are left out of the
sitemap. Untie a camp (remove `program`) and it gets its page back.

**One row for every list.** The A to Z list, the weekend list, the day-camp list and the summer camps list are
rows of the same shape, `listRow(kind, …)`: the name, a line about it, its categories, then the facts that
matter for that part of the year (the schools and grades after school; Saturdays or Sundays for a weekend class;
the breaks a day-camp program has posted, "Winter break (3 of 5 days) · +2 more"; the weeks, ages and grades for
a summer camp). Nothing on a row is a button: the row is the way to the listing's page, and every list opens
with the way into its planner (`heroGo()`). The old cards with buttons on them are gone from the lists.

## Finding programs: filters, types and the school finder

The home page opens with two "Start here" boxes, one for parents (find your school, build a schedule, create an
account) and one for program managers (claim a listing, add a program, add a camp), then a "More than weekday
afternoons" section that points at weekend classes, day camps and summer camps. Each box has a picture of who it is for (a grown-up with a child, a person with a clipboard), drawn in `WHO` in `homePage()`.

The top of a program's page says which schools it works for as colored labels (`servedPills()`): yellow for pickup, green for on-site, blue for nearby, the same colors as on the cards.

On a program's own page, a row of "The details" longer than about a hundred characters shows its first two lines with a "More" link (`fold()` in `build.mjs`). It is a `<details>` element holding the whole text, so it opens without JavaScript and nothing is left out of the page.

**The filters start shut.** They run to six rows plus the grade row, which is a lot to meet before the list, so
`filterBar()` writes one dark "Filters" button (`#filters-toggle`) under the search box and `site.js` keeps the rows
and the grade row hidden until it is pressed (the class `open` on `.fbar` and `.picker`; without JavaScript there are
no filters at all, as before). Beside the button a line says what is inside, built from the rows that page has
("Narrow this list by grade, type, pickup or cost. Or see it on a map."), and a yellow number counts the filters in
use. While it is shut, each filter in use is a chip beside the button (`.fchip`) that takes that filter off when
pressed: a remembered grade, a saved school and a filter in the page's address all narrow the list on arrival, and
the chips are what stops that from happening out of sight. The count line and "Clear filters" always show. Opening
it is remembered for the visit (`sessionStorage`, `pas-filters-open`), a link to one row (`#by-day`) opens it, and so
does the slim bar's "Filters" button.

The filters and the grade row scroll away with the page. Once they are out of sight, a slim bar is fixed under
the menu bar (`#quickbar`, written by `filterBar()`): a search box that filters the list as you type and keeps
the main search box in step, a "Filters" button that goes back up to the filters and shows how many are on, and
a line saying what is showing with a Clear link. It goes away again at the footer.

A filter row that is wider than the screen scrolls sideways. `site.js` wraps each `.rail` so it gets a fade at
the edge that has more and a round arrow button that moves it along; both disappear when there is nothing further
that way.

Every page that lists programs (a school, a neighborhood, a type, the A to Z list) has the same filter bar:
search, program type, free or paid, neighborhood and grade. Filters also live in the page address
(`/programs/?type=music&grade=3`), which is how the home page links into them.

**Search by, across every kind.** A type page (`/types/<type>/`), a neighborhood page and the by-day page carry
everything on the site that fits, whatever part of the year it fills: after-school programs, weekend classes,
day camps and summer camps, each kind in its own section (`kindSections()`: a heading with a count, the same
rows as that kind's own list) under one filter bar. The bar gets a **Kind** row (All kinds · After school ·
Weekends · Day camps · Summer; `data-kinds` on each row, `kind` in the filter state and the address,
`?kind=weekend`) and the **Day** row runs to Saturday and Sunday once a list has weekend rows. A weekend row
filters by the days its class meets; a program that doesn't publish its days shows under every weekday and under
no weekend day; day-camp and summer rows sit under no day at all (`shapeFor()` in `build.mjs` is what the filter
bar sees for each kind). A listing that fills two parts of the year is in two sections, once each, and the count
says "listings" rather than "programs". `/types/` and the type counts are built from every listing's `types`, so a
type that only a summer camp or a weekend class has still gets a page. The type names, colors and icons are the
`TYPES` list at the top of `build.mjs`.

`/by-day/` ("What runs on which day") is the menu's "Search by: Day of week": the after-school programs and the
weekend classes together, with the day row Monday to Sunday and a count for each day in the hero. Day camps run
on dates and summer camps by the week, so it points at their lists instead.

The search box on the home page looks through `data/all-schools.json`: every district and charter school in
Philadelphia with any grade from K to 8, taken from the City's "Schools" open dataset. Schools with a record in
`data/schools.json` (matched by street address) open their page. The rest open `/schools/request/`, where a
parent can ask for the school with one tap. Each request is emailed to `contactEmail` with a running count and
logged in `phillyafterschool-school-requests.log` above `public_html`. Refresh `data/all-schools.json` when the
City updates its list (about once a year).

## Neighborhood pages

`/neighborhoods/` lists every neighborhood that has a school or a program, and each one gets a page at
`/neighborhoods/<name>/` (for example `/neighborhoods/bella-vista/`) showing the schools there, then every kind
of listing in sections with a Kind filter: the after-school programs based there, the weekend classes there (and
a section of the ones close by, in that part of the city), the day-camp programs based there, the summer camps
with a site there, and programs from elsewhere that pick up from a school there. They are built from each school's
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

### Asking for reviews

The site asks the people most likely to have something to say: parents with a program on their week. All of it is
worked out in the browser (`RV` in `site.js`, also `window.pasReview`), from the rosters on the device, and nothing
about it is sent anywhere.

- **What the device remembers** (`pas-rv` in the browser): the day it first saw each program on a roster (`s`), the
  programs reviewed from this device (`d`), the ones never to ask about (`n`), and the day it last asked (`t`).
- **When it asks.** A program is asked about once it has been on a current week for 14 days, or on an upcoming week
  for 45 (it may not have started). One program at a time, and after any answer ("Write a review" sent, "Not yet",
  "Don't ask about this one") nothing is asked for 30 days. The numbers are `WAIT` at the top of `RV`.
- **Where.** On Build your week (`#rv-nudge`, under the roster) and on My profile, under the card. The
  profile also counts programs on weeks kept in the account. Adding `?rv=now` to either address shows the question
  straight away, to look at it.
- **Quieter places.** My profile's card has a "Reviews" row with a link for each program on their weeks. A program's
  own page says "This one is on your week" above its review button, or, once a review has been sent from that
  device, that it was sent. The thank-you page after a review lists the other programs on the week.
- **Less typing.** The form starts on the school saved on the device, and for someone signed in it fills in their
  first name and email address (one request to the accounts service, `me`).
- **Program managers** get "Ask your families for a review" under a claimed program on `/managers/`: the link to
  the form with their program chosen, and a short message to paste. The wording asks them to send it to every
  family. Camps are left out, because the form reviews programs only.
- **Counting.** `pas_review_nudge` goes to the data layer with `nudge_action` (shown, open, later, never),
  `program_id` and `nudge_place` (week or profile). The profile loads no analytics, so only Build your week is
  counted.

## Notifications without an app

A parent can get the same dates as the emails as a notification on a phone or computer (web push). Nothing is
installed from an app store, there is no account with anyone to set up, and no secret to keep: the server makes its
own key.

- **Turning it on.** Account page, "Emails and notifications", "Turn on notifications on this device" (`#push`, in
  `groups.js`). The browser asks for permission, the page registers the service worker (`src/sw.js`, served as
  `/sw.js`), asks the browser for an address at its notification service using the site's public key
  (`GET push_key`), and gives the address and its two keys to the server (`push_on`, table `push_subs`). "Send me a
  test" sends one (`push_test`). One account can have `PUSH_SUBS` devices.
- **iPhones.** Safari only delivers notifications to a site that has been added to the Home Screen, which is what
  `manifest.json` is for (`display: standalone`). On an iPhone in Safari the page shows the four steps
  instead of the button. The Home Screen copy keeps its own sign-in, so the parent logs in there once.
- **What is sent.** `push_run()` in the server reads the same feed the emails are worked out from
  (`data/alerts.json`, written by the build) and, for each account with a device, works out what is due today from
  what it follows (`push_due()`, the same rules as `dueFor()` in `scripts/send-alerts.mjs`: schools, programs, camps,
  the Sunday week, and nothing about a listing stopped from an email). One notification a morning: the first date
  named, the rest counted. Each date is told to each account once (`push_sent`). There is no catching up on a
  missed morning and no "welcome" notification.
- **When.** Only between `PUSH_WINDOW` (7:50 to 11:50, Philadelphia). The job that sends the emails asks the site
  to do it (`POST push_run`) at each hourly run. Anyone can ask, because asking only makes the server do what it
  would do anyway; it answers with two counts. A dry run of the job asks for counts only.
- **How a message is protected.** Each one is sealed for the device with the keys its browser gave (RFC 8291,
  `aes128gcm`), so the notification service carrying it can't read it, and signed with the server's key (VAPID,
  ES256) so the service knows who is sending. The key is made on first use and kept in the `meta` table, so the
  daily copy of the database has it. `push_send()` does this with PHP's own openssl functions.
- **Where it will send.** Only to Google's, Apple's, Mozilla's and Microsoft's notification services
  (`push_endpoint_ok()`): the server never posts to an address just because a browser supplied it.
- **Devices that go away.** A service that answers 404 or 410 means the device is gone, and it is forgotten. A
  service that is down leaves the date untold, so the next run tries again.
- **Instead of the emails.** A tick box under the device controls. The email job has to know, without the site
  ever telling it who: the public list at `GET stopped` gains one more scrambled entry per such account
  (`sha256(stop code | nomail)`), only while the account still has a device, and `emailOff()` in the job leaves
  those addresses out. When the last device goes, the entry goes and the emails start again by themselves.
- **The service worker** shows a notification and opens a page when one is tapped, and nothing else: it keeps no
  copy of the site and doesn't touch page requests. A notification can only open an address on this site.
- **Testing.** The tests play the notification service themselves: a stand-in on the test machine that receives
  what the site posts, opens it with a device's keys and checks the signature, and a comparison over every morning
  in the feed between what the site would tell a phone and what the email job would send. `PAS_TEST_PUSH` (set
  only on the test machine) lets the stand-in's address through and lets a test choose the day.
- **Not checked from here:** a real phone. Whether the host's PHP can make the key is answered by opening
  `groups/api.php?action=push_key`.

## Premium listings

Built, and kept out of sight until there is a way to pay for one. A premium listing adds, on top of everything a
claimed listing already has: up to six photos and a logo, a section in the program's own words, an offer or event
line, a button parents use to send the program a question, fuller numbers, and a flyer. It never
changes where a listing appears in a list, and it has no say over reviews.

- **The switch.** `"groups": { "premium": ... }` in `site.config.json`: leave it out (or `false`) and nothing premium
  exists anywhere; `"preview"` and the tools work, but what a program adds shows on its listing only to the people
  who hold that listing, signed in; `true` (or `"on"`) and everyone sees it. `PAS_PREMIUM=preview|on` overrides it
  for a test build. The site runs on `"on"`.
- **The sign-up page** (`premiumPage()` in `build.mjs`, at `/premium/`) is where a manager signs a claimed listing
  up. It is built whenever premium isn't off and `"groups": { "premiumPrice": ... }` is set. While premium is
  `"preview"` it is **unlisted**: nothing links to it, it carries `noindex`, and it is left out of the sitemap. Once
  premium is `"on"` (`PM_LISTED` in `build.mjs`) it is in the sitemap, open to search engines, and pointed to from
  three places, all of them for people who run a program and none on a page a parent uses:
  - **In each claimed listing's box on the managers page** (`premiumTease()` in `groups.js`), on a tab of its own
    called "Premium", after the listing's own tabs: one dashed box that leads with the listing's own number of
    visits when there are at least 20, lists the six things premium adds, and gives the price. The tab is always
    there and never in the way, so there is nothing to dismiss. A listing that has signed up sees where to finish;
    a premium listing has no such tab and sees its tools on the other tabs instead. Nothing pops up, and nothing is
    repeated elsewhere on the page.
  - **One sentence on the managers page**, in the list under "How claiming works", for people who haven't claimed.
  - **One line at the end of the monthly numbers email**, only for an account with no premium listing.
  - **Prices** are `"premiumPrice": { "month": 19, "year": 190, "laterMonth": 29, "laterYear": 290 }`, whole dollars.
    The two "later" numbers are the regular price the founding price gives way to; leave them out and the founding
    paragraph goes. The page promises that a founding price is kept while the program stays signed up.
  - **Signing up charges nothing on the site.** The box (drawn by `groups.js`, `#premium-signup`) asks a signed-in
    manager to pick monthly or yearly for each listing whose claim stands. `premium_ask` keeps the plan with the
    claim (table `premium_asks`, one row a claim, gone with the claim or the account) and emails the owner
    ("A premium sign-up needs your yes: ..."). `/edit/claims/` shows "Signed up: yearly" beside the listing, next to
    "Make it premium". Picking the same plan again does nothing; picking the other changes it and tells the owner.
  - **Paying** is by two Stripe Payment Links the owner makes in Stripe, one monthly and one yearly, set as
    `"premiumPay": { "month": "https://buy.stripe.com/...", "year": "https://buy.stripe.com/..." }`. A link is a
    public address, not a key: no Stripe key is ever in this repo. With both set, a signed-up listing shows "Pay on
    Stripe", and the link carries `client_reference_id` (the listing's key with `:` turned into `_`, such as
    `p_coco-academy`; never a name or an email address) so the payment in Stripe can be matched to the listing.
    Nothing tells the site a payment came in: the owner sees it in Stripe and presses "Make it premium". Without the
    links the page says nothing is charged yet. The build warns if links are set while premium is still "preview".
  - **Sandbox links.** Links made in Stripe's sandbox start `https://buy.stripe.com/test_`. While those are the
    ones in the settings, the page says so: the button reads "Pay on Stripe (test)", a line says no real payment is
    taken, and the thank-you after a `cs_test_` checkout says no money moved. Swapping in the live links removes all
    of that. `PAS_PM_PAY=off` makes a test build with no links; `PAS_PM_PAY="monthly,yearly"` one with other links.
  - **Coming back from Stripe, and counting the sale.** Each Payment Link is set (in Stripe, under "After the
    payment") to send the payer to `https://phillyafterschool.org/premium/?paid=year&session_id={CHECKOUT_SESSION_ID}`
    (`paid=month` on the monthly link; Stripe fills in the id). The page thanks them, pushes a Google Analytics
    `purchase` event to the data layer (`transaction_id` is Stripe's checkout id, `value` and `items` are the plan
    and its price, `pas_test` is true for a sandbox checkout) plus `pas_premium` with step `paid`, and then takes
    `paid` and `session_id` off the address. A checkout id is counted once a browser (`pas-paid-seen`), and an
    address with no well-formed Stripe id reports nothing, so typing `?paid=year` by hand can't invent a sale.
    Pressing "Pay on Stripe" pushes `begin_checkout`. None of these carry the listing or the person. The address
    proves nothing about payment, so it never turns premium on. Nothing can be measured on Stripe's own checkout
    page; in Google Analytics, list `stripe.com` under unwanted referrals so the visit isn't credited to Stripe.
- **Test listings** (`data/test-listings.json`) are two hidden pages for the site's owner to see the manager's side
  on: `/programs/test-listing-premium/` and `/programs/test-listing-free/`. Each is an ordinary program record plus
  `claimDomain` (the email domain that may claim it; the claim stands at once) and, on the first, `"premium": true`,
  which makes it premium with no payment and no switch (`premiumAlways` in the server's settings; the review page
  shows "always: a test listing"). They are never added to the programs list, so no list, count, search, filter,
  sitemap, alert or data file has them; their pages carry `noindex` and nothing links to them. On the managers page
  a search by name doesn't find them, but signing in with an address at the claim domain offers the listing, the
  way it does for any listing at your own address. A school under `schools` only shapes how the test page reads.
  What is added to the premium one still goes through the review page before it shows.
- **Which listings are premium** is a row in the `premium` table. For now the owner sets it by hand on
  `/edit/claims/` ("Make it premium" beside each claimed listing); a payment would set the same row later. Turning
  it off hides what was added and keeps it. By the rule under "What stays free", a free program can simply be made
  premium at no charge.
- **Everything waits for a person.** Photos, the logo, the words and the offer line each go to `/edit/claims/` to
  be published or declined, and the manager is emailed either way. In `"preview"` those emails say that only they
  can see it for now.
- **Photos.** The `photos` table gained a `kind` (`photo` or `logo`). A premium listing keeps up to
  `PREMIUM_PHOTOS` approved photos: the newest sits at the top of the listing, the rest make the gallery. The older
  single-photo extra (`"groups": { "photos": true }`) still works on its own. `GET photo` serves one photo by `id`;
  a waiting photo only to the people who hold the listing.
- **Words and offers** are rows in `extras` (`kind` `words` or `offer`, `status` new, ok or declined). Words are
  plain text, 40 to `WORDS_MAX` characters. An offer is one line of up to `OFFER_MAX` characters with a last day,
  no more than `OFFER_DAYS` ahead, after which it stops showing by itself.
- **Questions.** `POST ask` emails the question to everyone who holds the listing, with the parent's address as the
  reply-to. Nothing is stored except a count (`ask` in `hits`, and in the daily tally). A hidden box catches
  scripts, and there are limits per internet address, per email address and per listing a day.
- **Fuller numbers** (`stats_more()`): each month for up to a year, how many accounts follow and have saved the
  listing, and which schools its visitors had saved (`hits_school`: listing, school, month, a number). The school
  goes along with a page view only when the browser has one saved, and is only kept while premium isn't off.
- **The flyer.** It is drawn in the manager's browser (`flyer()` in `groups.js`): one
  letter-size picture with a QR code to the listing. The code comes from `src/qr.js`, a small encoder written for
  this (byte mode, level M, versions 1 to 10), loaded only when a flyer is asked for. `scripts/qr-check.py` checks it
  against the Python `qrcode` library, grid for grid, and by reading the codes back; run it after any change. The
  flyer's link carries `utm_source=flyer`. (The website badge used to be here; it now comes with every claimed
  listing, see "Being found by search engines".)
- **On the listing** (`premiumSlot()` in `build.mjs`, drawn by `site.js`): the offer line near the top, "In their
  own words" with the logo and a line saying the program wrote it, "Photos", and "Ask a question". The page asks the
  accounts service (`GET extras`) only when it needs to: in `"preview"`, only for a signed-in visitor; when on, only
  if the public list of claimed listings names it. School pages show the offer line on the program's card. Add
  `?premium=demo` to any program's or camp's address to see a made-up sample.
- **Still to do before it opens:** taking payment, a page that sells it (`/managers/` still says paid extras are
  planned for later), and a lawyer's read of the terms for paid listings.

### An advertising page (an idea, not built)

A separate page of paid placements, so programs have a way to be found by families who don't know them yet, without
any listing or search result being reordered. Everything on it would be labeled as paid ("Sponsored"), and nothing
paid would appear anywhere else. The word matters: the site says its listings are not endorsements, so a paid
placement is advertising, not an endorsement.

## What stays free

Decisions that later features have to respect:

- Parents never pay for anything. The one thing that could reopen this is the cost of sending reminder emails
  growing out of hand.
- A free program's listing stays free, including claiming it and keeping it up to date.
- The plan is that more parents using the site is what makes it worth a program manager's while. Paid placement
  (clearly marked advertising) is a possibility for later, only once there is a real use for it.

## The menu

The header has four groups that open (Programs, Search by, Build a schedule, Suggest; the first item under
Programs is `/all-programs/`, the page that sorts every listing by kind, and the first under
Build a schedule is `/schedules/`, the page that introduces all the planners), then About and the
"Help the site keep going" button, which goes to the support page. The groups are defined in `layout()` in
`build.mjs` as a list of labels and links. Each is a `<details>` element, so it opens without scripts; the
script only closes the others. From 1100px wide the logo sits on the left and the menu on the right, on one
line; below that a Menu button opens a panel where each group is a big row that opens on a tap (only the
group the current page is in starts open), then About and the button, so a phone sees five lines rather than
every link at once. "Day of week" goes to `/by-day/`.

## Signed up, or still to: ticks on the days-off plan and the to-do list

Putting a camp on a day off is a plan, not a registration, so each camp day in a plan carries a tick box.

- **The tick is the parent's own mark.** The site can't know whether anyone registered. It is kept with the plan: on
  the device as `offOk` beside `off` in each child of `pas-rosters` (`{ "2026-11-03": 1 }`, cleaned by `cleanOk()`
  so only a day with a program on it can hold one), and, when the plan is kept in a profile, as `ok` (a sorted list of
  days) beside `d` in each child of the `daysoffs` row. `clean_daysoff()` drops a tick for a day that is at home, not
  in the plan, or repeated. Changing or removing a day's pick removes its tick.
- **On the days-off planner** (`site.js`, the `[data-off-plan]` block): each camp day in the list has a "Signed up?"
  box (`#ok-DATE`); the chip is yellow until it is ticked and green after, and a day at home is blue with no box. In
  the Month view a signed-up day is green with a check mark and one still to sign up for is pale yellow with an
  outline; the day's spoken label says "signed up" or "still to sign up", so colour is never the only signal.
- **The planner doesn't hold the list itself.** A line in its tally (`#off-todo-line`) says how many camp days are
  still to sign up for and links to the To do page. (For a day the days-off page had the list as a section of its
  own; it went once the menu had "To do".)
- **The To do page** (`/to-do/`, `todoPage()`) is the list by itself, and the menu has a "To do" link to it for
  anyone signed in (`a.nav-todo`, beside "Account"). Like the calendar it is a shell with nothing about anyone in it,
  kept out of search, with no analytics or recordings; `groups.js` hands the profile to `window.pasTodo.show()`. It
  reads the days-off plan from the profile when one is kept there and from the device otherwise, counts the days with
  no plan, and signing in from it (`?next=todo`) comes back to it.
- **My kids' calendar** has no list of its own (the To do page is in the menu, and a second copy only cluttered the
  calendar), but shows the check marks on its calendar and list. The To do page draws the list with `signupTodo()`
  and saves a tick with `tickSignup()`: wherever the days-off plan lives, onto the device or to the profile through
  `daysoff_save`.
- **Analytics** hears `pas_dayoff` with action `signed_up` or `signed_up_undo`, how (`day_list`, `todo`, `todo_all`)
  and how many days: never the child, the camp or the date. The copied text and the calendar file say "signed up" or
  "still to sign up" for each camp day.
- The summer planner doesn't have ticks yet.

### Plans keep themselves

The planners need an account (`plannersNeedAccount`), and a plan made by someone signed in is kept in their profile
without asking: there is no "Keep it in my profile" button to find. Signed out, the planner's place is taken by the
tour of the planner with one button, "Create a free account" (`planShow()`), so that is the first thing a visitor sees.

- **Summer and days off** (`keepPlan()` in `groups.js`): once the profile has loaded, a plan on this device and none
  in the profile is sent (`auto()`); one in the profile and none here is put on this device. The box under the plan
  says "This summer is kept in your profile" with a "Take it out of my profile" link.
- **The week** (`autoKeep()` and `keepWeek()` in the Build your week part of `groups.js`): each child's week is its
  own row in the profile, told apart by first name, so a week is sent once it has a first name and a program. A week
  the profile has and this device doesn't is put on this device. Removing a child on the page deletes their week
  from the profile too (`onKidGone`), or it would come straight back.
- **What is still the parent's choice.** (1) The profile and this device both hold a plan that were never tied
  together (a plan made on this device before the planners needed an account, say): neither is sent or replaced
  until they pick, and replacing takes a second tap. For weeks that means a child here with the same first name as a
  week in the profile. (2) A plan they took out of the profile stays out: the device remembers (`sumProfOff`,
  `offProfOff` on `pas-rosters`, `profOff` on a child) and shows "only on this device" with a button to keep it
  again. A plan removed from the profile on another device, or on the profile page, is marked the same way on the
  devices that still have a copy, so they don't put it back.
- **What the pages say.** The privacy page, the terms' "Children's information", the sign-up page and each planner's
  intro say plans are kept in the profile while signed in. If this is ever made a choice again, those are the places
  to change (`privacyUpdated` and `termsUpdated` in `site.config.json` are the dates shown).
- Tests: `auto.js` (weeks), `sumprof.js` (summer, both choices), `todo.js` (days off), `g6.js`, `wk2.js`.

### Who's open, as the planner's third view

The chart of which program has posted a camp for each day off ("Who's open each day off") is the days-off planner's
third view, beside List and Calendar (`#off-views`, `data-view="chart"`, remembered in `pas-off-view`). The planner
page carries the chart in a `.when-in` section (`#chart`) that `site.js` moves (`#off-chart-block`) into the planner
(`#off-chart-slot`) and hides; signed out, the chart isn't on the planner page at all, and it is not on the
day-camps page any more either; `daysOffBits().chartSection` still builds it for wherever it goes next. A box is
`td.on::before` until the planner puts a button in it (`.sum-chart td.on:has(button)::before` hides the drawing). The summer chart works the same way
(`#sum-chart-block`, `#sum-chart-slot`, and `/summer-camps/weeks/` for everyone). `daysOffBits()` in `build.mjs`
builds the days-off chart for both pages (`where` = `'page'` or `'plan'`).

The summer schedule works the same way (`#sum-views`, remembered in `pas-sum-view`): List, Month, Who's open and
Make it a calendar. Month is a month at a time (`#sum-month`), with each child's camp on all five weekdays of its week or "Not
planned"; a tap on any day picks that week, whose row sits under the month so choosing works as it does in the list.
A month that only gets the tail of a week (the first days of September) has no page of its own. Who's open is the
"When each camp runs" chart (`#sum-chart-block`), moved into `#sum-chart-slot` for someone signed in, so there is
nothing to scroll down for. A link in from a camp (`?add=ID`) opens that view without changing the one that is kept.
"Print the list" prints the weeks (or days) whichever view is showing.

### The next day off, on the home page

The home page's note about the next day off is a bar along the bottom of the screen (`nextOffBar()`, `#offbar`):
"Do you know where your kids will be on Election Day?" and a button, "Get coverage for Nov 3rd", to that day's page.
The words are made in the build for the next twelve days off: "on" a holiday, "over" a recess or break, "when
school's closed for" conferences or staff development, with the date or the span of dates. The script shows the
first one still ahead and leaves room for the bar under the page. The X closes it and remembers which day off was
closed (`pas-offbar` in this browser), so it comes back for the next one. School pages and the week builder keep
the older line in the page (`nextOff()`).

## Days of the week, days off, and a saved school

**Days.** A program's `days` show on its card and page. On a roster, a card placed on a day the listing doesn't
show gets a yellow note ("Not listed for Thursdays. Runs Tue, Wed.") instead of being blocked, because class
schedules change and the data can be behind. The add-to-roster day buttons for those days are drawn dashed.
A "Day" filter row appears on a listing page by itself once at least two programs in that list run on some
weekdays only; with fewer it would filter nothing, so it stays hidden.

**Days off.** Two pages. `/day-camps/` ("Day-camp programs" in the menu and footer; `dayCampsPage()`) is the public
one. It leads with the programs that run something on days off, with the filters (age, type, area and cost; never
the saved school or "nearest to a school", since a child from any school can go and the neighborhood is what
matters), and the district's days are a second view of the same page: a Programs · The days switch under the hero
(`[data-views]` and `[data-pane]` in `site.js`; `#days` in a link opens the page on the days). The "Who's open each
day off" chart and the "Get a heads-up before each day off" box are not on it any more; both are still built
(`daysOffBits().chartSection`, which the planner uses as its third view, and `headsUpBox()`) for wherever they go
next. `/days-off/` ("Day-camp schedule"; `daysOffPage()`) is the planner alone: the tour when signed out, the plan
when signed in, with a button to the day-camps page under it. The day pages (`/days-off/<day>/`) and the program pages link to `/day-camps/`; everything
that means "plan" links to `/days-off/`. They list the days School District of Philadelphia students are off, from
`data/days-off.json` (`schoolYear`, `source`, `checked`, `lastDay`, and `days`: each with a `date`, a `name`,
and an `end` for a break). It shows which programs' `daysOff.dates` include each date, the district's list of days,
and every program with `daysOff`. Past days drop off at build time and are hidden by the page between
builds. The home page and each school page show a "Next day off" line. The build prints a note when a provider
date isn't a district day off (a typo on their side, or a day only they close for). Replace the file's days
each summer when the district publishes the new calendar.

**A themed week.** On the roster page, "Roll a themed week" fills Monday to Friday at random for a chosen school
and theme (Music Prodigy, Mathlete, The Da Vinci, Move It or Lose It, Glitter and Glue, Bookworm, Just for
Fun, Wild Child, Jack of All Trades). The themes are the
`THEMES` list near the top of `build.mjs`: each has a name, a one-line blurb and the program types it draws
from, and `mix: true` makes it try for a different type each day. `words` also lets in any program with one
of those `keywords`, whatever its type: Wild Child has no type of its own and is filled entirely that way
(gardening, nature, outdoors, running and so on), so it shows "Nothing listed yet" for a school until a
program with one of those keywords is listed. To add a theme, add a line. A roll places one
program a day, only on days the program lists, only in classes offered that day, and only for the grade chosen
(the grade is optional and is never saved or sent). It spreads across programs and classes before it repeats,
and treats a program that doesn't publish its days as a last resort, saying so when it uses one. Replacing a
week someone built by hand takes two taps, and "Put back what I had" restores it until the page is reloaded.
Each school page links in with `board/?roll=<school id>`. A roll fires `pas_theme_week` (theme, school, method
of `roll`, `again` or `undo`).

**Your days off.** The same page is laid out like the summer schedule and shares its code and its look:

- "Your days off" (`[data-off-plan]`) has a row for every weekday still to come that school is closed. For each, a
  family chooses one place for each child: a program that posted a camp for that date, another listed program (marked
  "ask", because it hasn't posted the date), or at home. On a break, one tap repeats a pick on the other days of the
  break the program posted. Picks are saved with the rosters in the browser, per child (`off` on each child:
  `{ "2026-11-03": "program-id" }`, or `"home"`). Siblings, first names and "copy Sam's days" work as on the summer page.
- "Who's open each day off" is a chart of every program against every day, filled where the program's own site lists
  the date. It reads without JavaScript; with it, a tap puts that day in the plan (tap again to take it off).
- The plan leaves the page as a calendar file for every child (`days-off.ics`), as text, as a printed list, or as
  pictures: every day off on one card, or a calendar for each month with the days off in yellow and a bar for each
  child. The title can be typed over (`offTitle`); a photo is drawn in the browser and never saved or uploaded. The
  card keeps its QR code, `/d`, which `.htaccess` sends to the page tagged `utm_source=dayoff_card`.
- **Kept in a profile, by itself.** Signed in, the plan keeps itself (`#off-profile`), one per account
  (table `daysoffs`): the school year, and for each child a first name and the pick for each day. `keepPlan()` in
  `groups.js` runs this box and the summer one from the same code; the server actions are `daysoff_save` and
  `daysoff_delete`, and `profile` returns it as `daysoff`. It is never shared and no other action reads it.
- An email's "See who's open" button links to `days-off/#d-2026-11-03`, which opens that day's choices. A day-off
  page's "Add it to your plan for Nov 3" links to `days-off/?add=<program>#d-2026-11-03`: signed in, the planner
  puts that program on that day for the child in view at once (method `day_page`), tidies the address so a reload
  doesn't repeat it, and the day's row then offers the rest of the break as usual; signed out, the ask keeps the
  request (`pas-want`) and the add happens when they come back from the sign-up.
- Each pick fires `pas_dayoff_pick` (program_id, day, method). Other actions fire `pas_dayoff` with an `action`
  (copy_sibling, fill_break, sibling_add, copy, share, print, clear, profile_keep, profile_put, profile_stop); saving,
  sharing or printing a picture and saving the calendar file fire `pas_board_share` with board `day_camp`.

The page uses the same blue band as the rest of the site, with its own drawing, `dayScene()` in `build.mjs`: the
school shut, the bus asleep, a swing and a kite going up. Its share picture is `src/static/share-days-off.png`; any
page can name its own with `shareImage` in `layout()`.

**Colours.** Every colour is a named value at the top of `src/site.css`. The band at the top of each page is a
daytime sky (`--hero` fading to `--hero-low`) with navy type (`--hero-ink`, `--hero-muted`); the header button
is `--cta`; the footer keeps the deep blue (`--foot`). Navy on the sky measures 9:1 or better, above the old
white-on-deep-blue. There is no dark mode: the site looks the same whatever the device is set to
(`color-scheme: only light` in the CSS and a matching `<meta>` in every page), because the calendars, the plan
colours and the pictures are drawn for a light page. The week card (`drawCard` in `src/site.js`) and the link-preview picture
(`src/static/share.png`, 1200 by 630) use the same sky and footer, so change them together.

**What a shared link shows.** A link to the site that is texted or posted shows the picture, a title and a line of
text. The picture's headline and its one line are part of the picture, so when the home page's headline changes the
picture has to be drawn again. The line of text under it (`og:description`) on the home page is the home page's
lede as it reads today, copy edits included (`shareText` in `layout()`, filled by `copyNow()`); every other page
uses its search description. The description search engines read is separate and is not changed by copy edits.

**Ages, not grades, for classes and camps.** After-school programs go by grade (the grade rail in `.picker`). Weekend
classes, day camps and summer camps go by age instead: an age rail (3 to 13, then 14+; `AGES` in `build.mjs`) in the
same strip, with a count apiece. Each row carries both `data-grades` and `data-ages` (a camp's from its `ageMin` and
`ageMax`, a class's or a day-camp program's from its grades: pre-K is 4 and 5, K is 5 and 6, grade n is n+5 and n+6;
`gradesToAges()` and `shapeFor()`), and `site.js` judges an after-school row by the grade picked and any other row by
the age picked, so a mixed page (a type, a neighborhood, by day) shows both rails, each labeled. The age picked is
remembered (`pas-age`) and sits in the address (`?age=7`) like the grade.

**Ages in the profile.** The account page's "School and kids" panel asks for the children's ages under their grades
(the same kind of row: tap each age; only the ages are kept, not which child). They are saved with the account
(`ages` on `users`, `ages_save`), copied to the device by the account pages (`pas-my-ages`, `adoptAges()` in
`groups.js`), and become a "My kid(s)" button on the age rail that the lists start on, the way grades do. An age a
parent gives a child on the summer planner is added to the profile's ages when the summer is kept (`after` in the
summer `keepPlan` config; `ages_save` with `add`), so there is one place the site knows a child's age.

**A saved school.** A school page has "Save as my school", and it is the most noticeable thing in the hero: a
wide panel under the lede (`.mine` in `schoolPage()`, with a bookmark, "Make Nebinger your school", a line on
what it does and a filled button), ahead of the facts, because so much of the site starts from it. Saved, the
panel turns yellow and says "Nebinger is your school" with "✓ Saved as your school" and "Tap again to undo"; on
another school's page the button offers the switch ("Make Meredith your school"). The choice is kept in the
visitor's browser (`pas-my-school`), with no account. After that the home page shows a shortcut to the school,
the citywide lists (A to Z, types, neighborhoods) open narrowed to programs that work for it with an "Any
school" button beside it, and the roster's "Add a program" assumes it.

**What a roster costs.** The roster page adds up a child's roster from each program's `rate` and the number of
days it is on: "About $1,720 to $2,230 for a semester", a monthly figure, and a line per program showing the
price it used. A semester is half a school year: 18 weeks of school for daily and weekly prices, five bills
for monthly ones, and one term for term prices. Free programs (and a school link marked free) count as $0,
programs with no `rate` are listed as not counted, and with more than one child a family total is shown.
It is an estimate, and says so: fees, deposits, discounts and aid are left out.
A parent can type what they pay on any line (per week, per month or for the semester), which fills in programs
that publish no price and replaces a listed one. Those figures stay in the browser and are never sent anywhere.

**The week card's QR code.** `data/card-qr.json` holds the pattern for the code printed on the week card. It
(and, under `dayoff`, the one on the day-camp card) encodes the short address `/w`, which `.htaccess` sends to the home page with `utm_source=week_card` and
`utm_medium=qr`. "Share the card" sends the picture with a line of text and a link tagged `utm_medium=share`,
and no title: Apple's share sheet appeared to turn a title into a second copy of the picture. "Copy picture"
puts one PNG on the clipboard with the line "Make your own at phillyafterschool.org" (in Safari as a second
item, so both paste; in Chrome as rich text under the picture, which mail and documents keep). Copying from inside Apple's own share sheet pastes the
picture twice, which the site can't change; the button is the way around it. If the site's
address ever changes, regenerate the file (Python: `pip install qrcode`, encode `HTTPS://<DOMAIN>/W` at error
level M with no border, and save each row as a string of 1s and 0s).

## Rosters

`/board/` ("Build your week" in the menu) lets a signed-in parent collect programs by weekday with "Add to roster"
on any card. Each child has two rosters, Current and Upcoming, so a family can share what they do now and
plan the next term. A family with more than one child adds a roster per child (up to six) and picks whose
roster a program goes on. "Remove this child" asks first, in place (`askSure()` in `site.js`): the link gives way
to "Remove Rae and both of their rosters?" with a real "Yes, remove" button and "Keep", and the question stays
through a redraw until one is pressed. (It used to turn the link's text into "Tap again…", which a parent on a
phone read as a notice and walked away from.) The days-off and summer planners ask the same way, and a child
removed anywhere has their profile week deleted too. Rosters are stored in the visitor's own browser. Nothing about them reaches the
server unless a signed-in parent keeps a week in their profile or shares it (see "Accounts, profiles and
sharing"). A week can no longer be shared as a link.
Each pick is drawn as a card in its program type's color. The page is four views of the same week, switched
beside its heading (`#board-views`, the same `[data-views]` / `[data-pane]` switch the day-camps page uses, with
`#cost`, `#card` or `#keep` in the address opening on that view): **The week** (the adder, the themed-week roller
and the grid), **Budget planning** ("What this roster costs"), **Make it a card**, which draws the week as one
picture (for a text, a printout or a teacher), with an optional photo that is read on the device and never
uploaded, and **Keep & share** (the `#group-share` box: keep the week in a profile, share it with one person or a
group). A view's tab shows only once its section has something to show (no budget or card before a program is on
the week; Keep & share once the account is known), "Share this schedule" under the grid opens the card view, and
the "Save or share this week" link after a card goes out opens Keep & share (`data-go-view`). The heading row with
the tabs stays under the menu bar in every view (the panes sit inside the same section as the row). On a phone the
tabs read Week · Budget · Card · Share.
The page address and the analytics event names still say "board" so older links and reports keep working.

Finding one program by name works in three places. The roster page has an "Add a program" search: pick a
program, say which school (assumed when the program serves one school, when that child's rosters already use
a school, or from the school page looked at last), then tap the days. The home page search finds programs as
well as schools. Every listing page's search box matches names, and when a filter is hiding a match it says
so and offers to show it. A program's own page has "Add to your week", which opens the roster page with that
program ready (`/board/?add=<program id>&school=<school id>`).

## The suggestion form

`/ideas/` (feature requests) posts to the same handler and arrives with the type "A feature idea".

`/suggest/` posts to `suggest/send.php`, which the build generates. It emails each suggestion to
`contactEmail` and also appends it to `phillyafterschool-suggestions.log` in the folder above
`public_html`, so nothing is lost if an email goes missing. It needs a host that runs PHP.
A hidden field traps most spam bots.

The form sends four kinds of thing: a program that's missing, a camp that's missing (`?kind=camp`, with a
summer-camp or days-off choice), an update to a listing (`?kind=correction`), and a school to add. A new program
or camp must come with its own website, in the browser and again in `send.php`: a listing is only ever published
from what its own site says, so one without a site can't be checked. Every program page and every summer camp
card has a "Suggest an update" button that opens the form on that listing (`?kind=correction&fix=p:<id>` or
`c:<id>`), and the email carries a `Listing:` line. The summer camps page has a "Suggest a camp" section.

## The contact page

`/contact/` is a plain form (name, email, topic, message) that posts to `contact/send.php`. Like the suggestion
form it emails `contactEmail`, sets Reply-To to the sender, appends a copy to
`phillyafterschool-suggestions.log`, and has a hidden field for bots; it also takes at most five messages an hour
from one address. The footer shows `contactEmail` and links to the page.

## Dates by email

Parents can ask for their school's dates by email: on each school page, the home page, the day-camp page and `/alerts/`.
The pieces:

- **The sign-up form** posts from the visitor's browser straight to Klaviyo with the public key in `site.config.json`
  (`alerts.klaviyoKey`) and adds the address to the list in `alerts.listId`. It sends a first name, the email address, the school's id
  (`school`, or `all` for a school that isn't listed), the school's name and the page it was on. Nothing else. A sign-up with
  an address already on the list updates its school. Set `alerts.doubleOptIn` to `true` if the Klaviyo list is switched
  to double opt-in, so the form tells people to check their inbox. Each sign-up fires `pas_alert_signup` (school, place).
- **Following one program.** Every program page has its own box, "Tell me when sign-ups open". It adds the address to the same list but sends no
  school. Instead a second request adds the program's id to a `programs` list on the person's Klaviyo profile
  (appended, so following a second program keeps the first, and a school chosen earlier stays). Followers get that
  program's sign-up dates, its day-off camps and its `updates`, and nothing else. `pas_alert_signup` carries the
  `program_id`.
- **Following one summer camp.** Every camp's page has the same box ("Tell me when it posts summer 2027" while the camp
  still shows last summer, "Tell me when something changes" after). It sends no school; the camp's id is appended to a
  `camps` list on the person's Klaviyo profile, and `signup_place` is `camp`. Followers get that camp's `dates` and
  `updates` and nothing else: in `data/camps.json` a camp can carry
  `"dates": [{ "date": "2027-01-15", "label": "Summer 2027 registration opens at 10am" }]` (shown on its page with
  "Add to calendar", and emailed as a program's sign-up date is: see "When each email goes" below) and
  `"updates": [{ "date": "2026-12-08", "text": "Summer 2027 is posted: nine weeks from June 21, $395 a week." }]`
  (emailed the morning after its date, exactly like a program's updates). The monthly check writes both when a camp posts its new summer, so the email trails the camp's own
  announcement by up to a few weeks, and the box says so. `pas_alert_signup` carries the `camp_id`.
- **Waiting for a school.** The form on a not-yet-covered school's page appends that school's id from the city list to
  `waiting_schools` on the profile. When the school is added, give its record in `data/schools.json` an
  `"added": "YYYY-MM-DD"` with the day it goes live. Everyone waiting for it gets one email that morning (or either of
  the next two), and nothing else: someone who only asked about a school, a program or a camp is never sent every
  school's dates. An `added` more than two days old sends nothing, so set it on the day you publish.
- **The feed.** The build writes `data/alerts.json`: every upcoming `register.dates` entry and every district day off, each
  with `sendOn`, the day it is announced. So adding a date to a program's `register.dates` is all it takes to get it
  emailed.
- **When each email goes.** A sign-up date is news, and spots go fast, so it does not wait for the weekend. Each
  date makes up to three entries in the feed: the news (kind `register`), sent the morning after the date was
  posted here; a reminder the day before (kind `soon`, id ending `-eve`, "Tomorrow: ..."); and one on the morning
  itself (kind `today`, id ending `-day`, "Today: ..."). A reminder is left out when the news would land on that
  same day, one email never carries two entries for the same date, and a "tomorrow" reminder that missed its
  morning is not sent late. Someone who starts following in between gets the date in their welcome email and
  then the reminders.
- **"Posted" is read from the repository's history.** The build looks at every commit on the main line that
  touched `data/programs.json` or `data/camps.json` and notes the day each date (and each note in `updates`)
  first appeared (`firstSeen` in `build.mjs`), in Philadelphia time. So a date from the monthly check is announced
  the morning after its pull request is merged, however long the pull request sat, and nobody writes the day
  down. An entry can still say `"posted": "YYYY-MM-DD"` to override it. Changing a date's day makes it a new date,
  announced again; changing only its label does not. This needs the whole history, so `alerts.yml` checks out
  with `fetch-depth: 0`. A shallow copy (the publishing job) can't tell, and falls back to the older timing, the
  last send day (`alerts.sendDay`, 0 for Sunday) at least `alerts.lead.register` days ahead; that only affects
  the `sendOn` shown in the published `data/alerts.json`, which nothing reads. `PAS_NO_HISTORY=1` forces the
  fallback.
- **Days off** are not news, so they stay in the weekly round-up: the last send day that still leaves
  `alerts.lead.dayoff` days (10).
- **How fast.** The email can only be as fast as the data: a date reaches followers the morning after it is
  merged, so a date a program posts between monthly checks waits for the next check, or for the program's manager
  to send it in.
- **Other entries.** The feed also has an entry for each program's own day-off camp (sent
  only to that program's followers, and skipped for anyone whose school email already lists the camp) and for each
  item in a program's optional `updates` list: `"updates": [{ "date": "2026-11-04", "text": "Fridays are full for the winter session." }]`.
  An update goes out the morning after it reaches the main line (read from the history, as above), to the
  program's followers only, and is dropped two days after that. Its `date` is a label: it doesn't decide when
  the note is sent.
- **The daily job.** `.github/workflows/alerts.yml` is started every hour, because GitHub runs scheduled jobs late,
  sometimes by hours. Only a run that lands between 7:50 and 11:50 in the morning, Philadelphia time, does anything
  (the first is due at 7:55, so emails go out at about 8, later when GitHub is running behind):
  it builds the site and runs `scripts/send-alerts.mjs`. A run started by hand sends at any hour.
  It reads the list from Klaviyo and records one "School dates" event for each person who is due an email. Someone who
  just joined gets one "welcome" email the next morning with every date already announced; after that they get each
  later one on its own day. A missed morning is made up on either of the next two, and Klaviyo ignores a repeat of an event it already
  has, so nobody gets the same email twice. The job never prints an email address, because its log is public.
- **The flow.** In Klaviyo, the flow "School dates email" is triggered by that event and sends the template in `email/`.
  It only fires for events that carry the right `token`, and only for people on the list.
  The flow keeps its own copy of the template, so changing the email takes two steps: update the standalone
  template "School dates" in Klaviyo from `email/` (with the postal address put back in place of
  `[[POSTAL_ADDRESS]]`), then set the flow's email to use that template again, which makes it take a fresh copy.
  Editing the standalone template alone changes nothing that is sent.

The job needs two repository secrets (Settings > Secrets and variables > Actions) and does nothing without them:
`KLAVIYO_API_KEY`, a private Klaviyo key with Events: full, Profiles: read and Lists: read; and `ALERTS_TOKEN`, the word
the flow's trigger checks. The token matters because Klaviyo's public key can also record events: without it, anyone
could trigger the email with their own wording. To change the token, change it in both places.

To see what would go out, run the workflow by hand (Actions > Send date emails > Run workflow) with "Only count what
would be sent" ticked, and optionally a date to pretend it is. Locally, with `KLAVIYO_API_KEY` set in your shell: `node build.mjs && node scripts/send-alerts.mjs --dry-run --today 2026-11-01`.

## A school's clubs, listed one by one

A school-run listing can carry `clubs`: a list where each club has a `name` and, when the school publishes them,
`what`, `days`, `time`, `grades` (a range like `3-5`; `gradeNote` replaces how it's shown), `when` (its season),
`status` (how sign-up stands), a `note`, and `tags`. The listing's own page shows a card per club. The clubs
become the listing's classes, so a roster can say "Nature Club" on Wednesday and warn about the wrong day, and a
themed week judges each club by its own grades and tags (tags are program types such as `music`, or keywords
such as `nature`). `"roster": false` lists a club without offering it on the roster, for one that meets at
lunch. Clubs never become listings of their own. Instead each type page ends with a
"clubs at the school itself" strip, one line per school naming the clubs tagged with that type (someone who has
saved a school sees only theirs until they ask for the rest), and on a school's page, filtering by a type adds
"Music clubs here: Choir, Rock Band" to the clubs card. A clubs listing automatically carries every type its
clubs are tagged with. Use `clubs` or `offers`, not both. Teacher names, emails and room numbers are left out on purpose: the
listing links to the school's own sheet for those.

## Accounts, profiles and sharing

Looking things up needs no account; the planners need one (see "The planners need an account"). An account
also lets a parent keep their school and a child's week in a profile (so they are there on
another device), share a week with one person, and, while it is a pilot, join a share group of a few families.
These are the only parts of the site that store anything about a child on the server.

- **Turning it on.** `"groups": { ... }` in `site.config.json`. Remove `groups` to take accounts out of the build.
  With it on, the menu's yellow button is "Create a free account" (or "Your account" once that browser has signed
  in), a strip above the menu offers "Log in" to anyone signed out, and the support ask ("Help the site keep
  going") moves to the footer and the account page. Which version shows is decided from a flag in the browser, with
  no request: elements carry the class `when-out` or `when-in`.
- **Creating an account and logging in.** Two addresses share one form. `/register/` is the landing page for
  creating an account: what an account gives you (with a drawing of a week on a phone and a laptop) beside the
  form. `/account/` is where you log in and, signed in, where you change what is in the account; someone already signed in who opens
  `/register/` is sent there. `?next=board` on either sends them back to Build your week afterwards. The old
  address `/account/?new=1` forwards to `/register/`. `/register/` loads analytics (see Privacy below); `/account/` does not.
- **Build your week.** The card comes first. Once someone shares, saves, copies or prints a card, a box asks
  whether they want to keep the week too, and opens the Keep & share view: "Save this week, or share it" for
  someone signed out (Create a free account, Log in), "Keep and share this week" for someone signed in.
- **Signing in.** Google's button first, then a 6-digit code by email (no password). Set `"googleClientId"` under
  `groups` to the OAuth client ID from Google Cloud (a public value; there is no secret) to offer Google. The
  button is Google's own, so its script loads on every page that shows the sign-in form; it is left out inside
  the Facebook and Instagram apps, where Google refuses to sign in, and the form works without it if the script
  can't be fetched. The server asks Google whether the token is real, then checks it was issued to this site and
  that the address is one Google runs (Gmail or a Workspace domain); anything else is sent to the email code. A
  new account needs a first and last name before it can do anything; Google supplies them.
- **Profile.** Signed in, a week on Build your week keeps itself once it has a first name and a program (see
  "Plans keep themselves" below). The profile stores the child's first name and, for the
  current and upcoming weeks, each pick as `program.school` (plus a class the program lists). Free-text notes,
  the teacher's name, the card note, prices and day-off plans stay on the device. The roster remembers the
  profile week it belongs to (`prof: { id, u }`); changes go up by themselves, and a device that finds a newer
  copy in the profile takes it, keeping its own notes for the same program. A kept week the device doesn't have is rebuilt there by itself. A kept school is also that device's saved school, and saving a different school
  on a school's page updates the profile (only for someone signed in who keeps one there).
- **Grades.** On the account page a parent taps the grades their children are in. Only the grades are stored
  (`users.grades`, for example `K,3`), not which child is in which. The account pages copy them to the browser
  (`pas-my-grades`), and every list with a grade row then gets a "My kids" choice next to "All" that shows
  programs taking any of those grades; it becomes the starting grade when grades are first kept or changed.
  With exactly one grade kept, the themed-week roller starts on it.
- **Share with one person.** The parent types one email address. That makes a private list for that child's
  week (a group marked `solo`), invites the address, and emails "{Name} shared {Child}'s week with you". The
  recipient must sign in with that address, goes straight in, and can look and print but not change anything.
  More addresses can be added to the same list; each can be removed, and "Stop sharing with everyone" deletes
  it. What is shared is the same as in a group: first name and program ids, never the school, address or notes.
- **Week links are retired.** A week used to be shareable as a link that held the whole week after the `#`.
  Anyone could open one and it could not be taken back, so the buttons are gone and an old link now shows a
  notice instead of a week. "Copy as text", "Email it to myself" and the share-sheet button went with them (on the day-off planner too): a
  week leaves the page as a card (a picture made on the device) or through an account, and no other way.
- **Small share groups.** Open to everyone since October 2026 (`"pilot": false`): "Start a group" on the
  account page and "Share with a small group" on Build your week show to anyone signed in. Setting
  `"pilot": true` hides them again, except in a browser that has been let in (`/account/?groups=1`, opening a
  group invitation, or already being in a group). Groups are invitation only: the creator types addresses, each gets a link to `/join/#CODE`
  and the code, and joining needs both an invited address and the code. There is no asking to join; the
  creator is emailed when someone comes in and can remove anyone, which also removes their invitation.
- **Program managers: claiming a listing.** The site calls the people who run a program "program managers". Parents
  and managers use the same account; a manager is simply an account that holds a claim. The page first lived at
  `/directors/`, which now forwards (`movedPage()` in `build.mjs`). `/managers/` explains it and holds the tool. A claim needs an account whose email
  address is at the listing's own website address (`example.org` and `mail.example.org` count as the same place).
  The build works out each listing's address and hands the list to the server (`claimListings()` in `build.mjs`):
  programs are `p:<id>`, summer camps `c:<id>`. Where the address is shared by many unrelated people the claim is
  `manual` and waits for the owner: any `.gov` or `.edu`, the names in `CLAIM_SHARED` (the school district,
  booking and site-builder services, the library, the YMCA), and every school-clubs listing. Add a name to
  `CLAIM_SHARED` when a listing's website turns out to be shared. A personal address (Gmail and the like) can never
  claim anything, because no listing's website is there.
  A claimed listing shows a "Claimed" mark, fetched from `groups/api.php?action=claimed` (listing keys only, never
  who). A manager can propose changes to a listing they hold; nothing changes on the site. Each claim and each
  proposed change is emailed to the contact address and listed on `/edit/claims/` (behind the edit sign-in), where
  the owner approves or declines a waiting claim, takes a claim away, and marks a proposed change published or
  declined; the manager is emailed each time. To apply a change, edit the listing data as usual (or paste it to
  Claude), then mark it published. One account can hold 12 claims and one listing 5 claimants.
  `/managers/` opens on a search of every listing, which works signed out; picking one asks for a sign-in at that
  listing's address. The home page's "Program managers" box links there, `?q=` prefills the search, and a
  listing's "Claim this listing" link lands there with the listing picked (`?l=`). "Continue with Google" works for
  a Google Workspace address at the program's own website; a personal Gmail signs in but can claim nothing, and the
  page says so.
  An update is sent in boxes (dates, cost, days and hours, anything else) and reaches the owner as labelled lines.
  **Photos are switched off.** They are meant as a paid extra, and there is no paid tier yet, so
  `"groups": { "photos": false }` (the default) hides the photo form, drops the photo from the list of benefits
  and makes the server refuse uploads. Set it to `true` to turn the whole thing on; `PAS_PHOTOS=1 node build.mjs`
  does the same for a test build. How it works when on: a manager can send one photo per listing, with a line describing it and a tick that they have the
  right to use it. The browser shrinks it to a JPEG (1600 pixels on the long side) before it leaves the device; the
  server checks it is a JPEG, redraws it, and keeps it in `phillyafterschool-data/photos/`, outside the public
  folder. Nothing shows until the owner publishes it on `/edit/claims/`, where a photo can also be declined or
  taken down. A published photo is served by `groups/api.php?action=photo&l=<key>&v=<id>`, and listing pages put
  it into a `data-photo` slot from the same `claimed` request that brings the marks. A manager can replace or
  remove theirs; giving up the claim or deleting the account removes it.
  `/managers/` loads analytics with the tool masked in recordings; its events are `pas_claim` with a `step`
  (`picked`, `claimed`, `waiting`, `address_mismatch`, `refused`, `change_sent`, `photo_sent`) and `pas_signup`
  with `role: manager` when someone signs in there. The "What claiming gets you" section shows an example
  listing (`claimDemo()` in `build.mjs`): an invented program, drawn from the same parts a real listing uses, with
  numbers that match the list beside it (`CLAIM_GETS`). Change a benefit there and the picture's numbers follow. There are no student accounts, on purpose:
  the site never asks a child for an email address. The planners are for the adult who signs in.
- **Where.** `src/server/groups-api.php` is the whole server side; the build copies it to `groups/api.php` with
  its settings (site name, address, sender, the date shared weeks expire, the Google client ID). It keeps one
  SQLite file and a key in a folder named `phillyafterschool-data`, next to (not inside) the public folder on
  the host. Deleting that folder in the host's file manager wipes every account, profile and group. It is not
  in git and not backed up by this repository.
- **Limits and expiry.** Sign-in links and codes last 15 minutes and work once; five wrong codes kill a code;
  three sign-in emails per address per 15 minutes. A device stays signed in 30 days. Up to 60 invited addresses
  per group, 60 invitation emails a day per person and 3 a day per address. A profile holds 6 weeks. Every
  shared week and group is deleted two weeks after `lastDay` in `data/days-off.json`; profiles stay.
- **The email list.** `"klaviyoList"` under `groups` names a Klaviyo list ("Account holders"). When an account
  first has a name, the browser subscribes that email, first name and last name to it with the public key,
  sets the profile property `has_account`, and tells the server so it isn't done twice. An ad blocker can stop
  the call; it is tried again at each sign-in until it works. Nothing about children is sent. Leave
  `klaviyoList` out to turn this off.
- **Emails it sends.** The sign-in email, invitations, and "{Name} joined" to whoever shared or made the group.
  They go out with PHP `mail()` from the contact address.
- **The numbers page.** `/edit/stats/`, behind the same sign-in as `/edit/`, shows counts: accounts, how they
  signed in, schools and weeks kept, weeks shared, groups, invitations, and a table by day. It prints no name,
  address, group name or week. The daily counts come from a `tally` table that holds a word, a date and a
  number.
- **The edit sign-in's key.** The cookie that says "signed in to /edit/" is signed with a key the server makes
  on first use and keeps in `phillyafterschool-edit.key` next to the public folder. It must never be derived
  only from values in this repository, which is public.
- **Privacy.** The account, invitation, group and numbers pages load no Google Tag Manager or Clarity
  (`quiet: true` in `layout`), are `noindex`, and are left out of the sitemap. Build your week does load them:
  it is masked in session recordings, and the only event is `pas_group_share` with a `method` (`profile`,
  `profile_school`, `one_person`, `code`, `my_group`), never a name, address or id. The sign-up page,
  `/register/`, also loads them so visits can be counted (`quiet: !register`): its form is masked in session
  recordings (`data-clarity-mask`), and it sends `pas_signup` with a `step` (`code_sent`, `signed_in`) and a
  `method` (`email`, `google`), never the address. A new person finishes on `/account/`, which is quiet, and
  sign-in links in emails land on `/account/` too, so no token ever reaches a page with analytics. The privacy page's
  "Accounts, profiles and sharing" section describes all of this; keep the two in step.

## Links out to programs

Every link to a program's own site (Register, Website, Camp details, a source on the program's own domain, and the
address inside a calendar entry) carries UTM tags: `utm_source=phillyafterschool.org`, `utm_medium=referral`,
`utm_campaign` set to the school whose page the link is on (or `directory` when there is none), and `utm_content`
set to the kind of link (`register`, `website`, `camp`, `source`, `calendar`). A program that looks at its own
analytics can then see what this site sent it, and from which school's families. The tags are added to the end of
the address as text, so the rest of it is untouched. School district, city and library addresses are never tagged.
Add `"noUtm": true` to a program if its site misbehaves with the tags, or set `"outboundUtm": false` in
`site.config.json` to turn them all off. The data files stay clean: `data/programs.json` holds the plain addresses.
This site's own count of those clicks is the `pas_outbound` event.

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

## Follow and favorites

Dates by email now run on accounts. A **follow** means the listing's or school's dates are emailed; a **favorite**
keeps a listing in the account and emails nothing. `followBox()` in `build.mjs` draws the box: inside the details
card on a program's or camp's page, and as a wide box on a school page, the home page, the days-off page and
`/alerts/` (those last three with a school picker). Without accounts (`groups` unset) the old sign-up form,
`alertsBox()`, is used instead.

- **Signed out.** Tapping Follow or Save fetches `assets/groups.js` (listing pages don't carry it otherwise) and
  shows its sign-in form in the box. The sign-in is started with `next` set to `f:<key>` or `v:<key>`, and the
  server does the follow or the save itself when the sign-in finishes (`sign_in()`), so it also works when
  someone taps the button in the email on another device: they land back on the listing, already following.
- **A new account** is then asked, in the box, for a first and last name and (both optional) a school and a
  neighborhood (`POST basics`). The account page's "Finish your account" step asks the same. The neighborhood list
  is every neighborhood the site names (`accountHoods()`), plus "Somewhere else".
- **A phone number for texts** is optional, there and under "Texts" on the account page. It is kept only with the
  box ticked (never pre-ticked) beside wording that says what the texts are, that they haven't started, that rates
  may apply and that STOP ends them. The server keeps the number (US numbers, stored as `+1...`), when the yes was
  given (`phone_ok`) and which wording it was given to (`phone_terms`, from `PHONE_TERMS` in `groups-api.php`: change
  that constant whenever the wording changes). `POST phone_save` sets or clears it; "Remove my number" clears it.
  The number is not sent to Klaviyo or to analytics, and **no texts are sent yet**: before any are, SMS has to be
  set up in Klaviyo (a sending number and its registration), the consent wording and Terms read by a lawyer, and a
  step added that passes consenting numbers across. `/edit/stats/` counts how many people have agreed.
- **Where it is kept.** Tables `follows` and `favs` in the accounts database, keyed `p:<program>`, `c:<camp>` or
  `s:<school>` (`s:all` is every school). `GET marks` paints the buttons; `POST follow` and `POST fav` change them.
- **The emails** are still sent from Klaviyo by `scripts/send-alerts.mjs`, which reads each address's `programs`,
  `camps` and `schools` properties there. The browser tells Klaviyo (public key, as the old form did): a follow
  subscribes the address to the dates list with `follows_from_account: true` and appends to the right property; an
  unfollow unappends. Each `follows` row has a `synced` flag, and a turned-off follow stays as a row until the
  browser confirms Klaviyo has dropped it, so a change made just before a connection died is finished next time.
  An address marked `follows_from_account` hears about exactly what it follows, even when that is nothing.
- **The account page** lists "Places you follow" and "Favorites" (`.g-marks`), each with a way to stop, and a
  favorite program has "Add to your week". Deleting the account unfollows everything first.
- **Counts.** `follow`, `fav` and `hood_saved` in the tally; tiles on `/edit/stats/`. The analytics event for a
  follow is still `pas_alert_signup`; a favorite is `pas_favorite` (action, listing, place).

**Stopping one listing from an email.** Every date email ends with "Stop emails about X" for each listing in it and
each school that brought it, and "See everything you follow".

- The link is `/alerts/stop/#c=<stop code>&k=<key>` (`stopPage()`; the script is in `site.js`). The code and key
  are after the `#`, so they never reach a server log, and the page takes them out of the address at once. It
  asks before doing anything (mail scanners open links), then `POST stop` turns that one off, with Undo and a
  two-tap "Stop every date email instead". No sign-in, and the page never says whose account it is.
- **The stop code** is a random word per account (`users.stop_code`). The browser puts it on the Klaviyo profile
  as `stop_code` when it tells Klaviyo about a follow; `send-alerts.mjs` reads it there and builds the links
  (`stops` and `manage` on the event; the template in `email/` loops over them). An address with no account has
  no code, so its emails keep the old wording.
- **The stopped list.** The server keeps a table, `stops`, of hashes: `sha256(code|key)` when a follow is turned
  off anywhere, `sha256(code|mute|key)` when a listing is stopped from an email, and `sha256(code|*)` when
  everything is stopped or the account is deleted. `GET stopped` publishes the hashes, which mean nothing without
  the code. Before working out who is due what, the send job fetches that list and drops what it finds
  (`withoutStopped()`), so a stop holds even if Klaviyo was never told, which it can't be from a browser that
  isn't signed in. If the list can't be fetched the job fails without sending, and the next hourly run tries
  again. The owner's own browser still tells Klaviyo (`unappend`) the next time they visit signed in.
- **Muted.** Stopping from an email mutes the listing: nothing about it is sent to that person, even when it
  serves a school they follow. Unfollowing on the site only drops the direct follow. The account page lists muted
  listings under "Stopped from an email" with "Allow emails again" (`POST unmute`); following the listing again
  also clears it.
- Tally keys `stop_one` and `stop_all` count the stops.

The box says when the emails come and no longer links to the privacy page; that link is on the account pages and in
the footer.

The form for a school that isn't covered yet ("tell me when it's added") is unchanged: a first name and an email,
no account.

## This week at your school

The things a family has to remember that aren't on the district calendar: picture day, pretzel day, a half day.

- **The data** is `data/school-dates.json`, keyed by school id: `weekly` entries
  (`{ "day": "wed", "title": "Pretzel day", "by": "parent" }`, optional `note`, `from`, `until`) repeat every school
  week on that weekday; `dates` entries (`{ "date": "2026-10-14", "title": "Picture day", "note": "K to 2", "by":
  "parent" }`) are single days. `by` is `"parent"` (sent in and approved) or `"school"` (from the school's own
  site, with the `url`). Nothing goes in that hasn't been approved, and the monthly check doesn't touch the file.
  The file is keyed by a place's id rather than tied to the district list, so a daycare or preschool can be added
  later as another kind of place.
- **On the school's page**, `schoolWeekSection()` shows "This week at {school}" (`#this-week`): this week and the
  next, day by day, from `schoolWeek()`: district days off, the last day of school, the school's dates, the weekly
  things (skipped on a day off) and sign-up dates at the programs that serve the school. From Saturday it shows the
  coming week. The nightly rebuild keeps it current.
- **Kept small on purpose.** Only what runs itself is promised: district days off and sign-up dates. A school's
  own dates appear when a parent sends one in and it is approved; nobody keeps a school's calendar by hand. Reading
  schools' Google calendars automatically was looked at and dropped: Google marks those feeds off-limits to
  automated readers.
- **Sending one in.** "Know a date that's missing?" under the section posts to `suggest/send.php` as "A date at a
  school" with what and when. It arrives in the site's inbox like any suggestion. To publish it, add it to
  `data/school-dates.json`.
- **The Sunday email** is opt-in, from the account page only: a tick box under the school kept in the profile.
  It is a follow with the key `w:<school>` ("This week at Nebinger"), so everything a follow has applies: it is
  listed under "Places you follow", told to Klaviyo as the `weeks` property, stopped from a link in the email,
  and honored through the stopped list. Changing the school in the profile moves it; clearing the school turns it
  off. The feed has one `week` entry per school per week, sent the Sunday before (`sendOn`) and only when the
  week has something other than the every-week things (`special`). Someone who turns it on by Tuesday still gets
  that week's. The entry carries `lines` (day by day), which the email template lists, and `text` as a fallback.

## Tabs on the profile, the account and the listings page

None of the three signed-in pages is a long scroll. The code is in `groups.js`.

- **One strip across all three** (`acctStrip()`, `nav.jump.acct-tabs`): Profile · Details · School & kids ·
  Emails & following · Plans & sharing, and Listings for an account that holds a listing. A tab whose part is on the
  page in view switches in place; the others are links to the page that has them (`/profile/`, `/account/#school`,
  `/managers/`), so the three pages read as one place. It stays under the menu bar, and scrolls sideways on a phone
  with the open tab brought into view (`window.pasRail()` in `site.js`, shared with the jump links).
- **On the account page** each panel is put on a tab with `put(panel, 'account', tab)`, and `TAB_OF` says which tab
  every linkable part is on, so `/account/#following`, `#favorites`, `#sign-out` and the rest open the right tab
  and scroll to the part. Choosing a tab puts it in the address (`#school`, `#emails`, `#plans`; Details is the
  plain address), so a reload or the Back button keeps it. "Signed in as …" and "Sign out" sit above every tab.
  A manager's account has the Listings tab in place of the "Run a program or camp?" box, and an old link to
  `/account/#listings` goes to the managers page.
- **On the managers page**, someone who already holds a listing gets a page about the listing: the heading becomes
  "Your listing", the strip is across the top, and each listing's box has its own small set of tabs (`tabset()`,
  a real `tablist` with arrow keys): Overview (the numbers, "Is there space", and a premium listing's fuller
  numbers), Update (the form and what has been sent), Spread the word (the review link, the badge, a premium
  listing's flyer), then either Photos & logo and Words & offer for a premium listing or the Premium tab for one
  that isn't. The open tab is kept while the box redraws (`tabOf`). "Claim another listing" and "How claiming works"
  are two buttons under the box that open the search and the sections about claiming; the search opens by itself
  when another listing has a website at the same address. Someone signed in with nothing claimed sees the page as
  before. Opening a tab is counted as a `pas_claim` step (`tab_update` and so on), with nothing about the listing.
- **On the profile**, "What's new" shows the two newest items and a button for the rest.
- **Every part at once.** `sessionStorage` `pas-tabs` = `all` shows every tab's parts on one page. The browser tests
  that were written before the tabs start that way; `tabs.js` tests the tabs themselves.

## My profile and the account page

Once someone is signed in there are two pages, drawn by the same code in `groups.js` (`drawProfile()`), which is told
which page it is on by `data-view` on `#account`. Every panel is built either way and `put(panel, page)` shows it on
its own page.

- **`/profile/` ("My profile", `profilePage()`) is a snapshot.** One card (`#card`, `paintCard()`): name, email
  address and whether the account is a parent's or a program manager's, then a row each for Kids (how many, and
  their first names), Grades, School, Neighborhood, Following, Favorites, Schedules (weeks, summer and days-off plans
  kept in the account), Calendars (My kids' calendar, and how many dates of their own are on this device), Emails
  and texts, and, when there are any, Sharing and Listings. Nothing on it can be typed into: each row has a link to
  the part of the account page where it is changed, and the card's button is "Edit my account". "What's new" sits
  under the card.
- **Where the kids' names come from.** No list of children is kept. The card collects first names from the plans
  kept in the account (weeks, summer, days off) and from the rosters on this device. Grades are stored without
  saying which child is in which, so the card shows them as their own row.
- **`/account/` is where everything is changed.** Your details (name, email address, mobile number), School and
  kids (school, grades, neighborhood), Emails (the Sunday email), Places you follow and Favorites, Kept plans,
  Sharing and groups, invitations, listings, the support ask, signing out and deleting. Signed out, it is still
  where people log in.
- **Getting there.** Signed in, the menu has "Account" beside the "My profile" button; in the phone menu the two are
  the first things listed. The footer has both as well.
- **Changing the email address.** "Change my email address" under Your details asks for the new address
  (`email_start`), which is sent a 6-digit code, and then for the code (`email_finish`). Until the code is typed
  nothing changes. Then the account's address is replaced, every other device is signed out, a note goes to the old
  address (without naming the new one), and every follow is marked as not yet told to the email list, so the
  browser tells Klaviyo about them under the new address and takes them off the old one (`MK.moved()` in
  `site.js`). The code can't be used to sign in. An address that already has an account is refused, but only after
  the code has shown the address belongs to the person asking. An account that holds a claimed listing can't change
  its address here, because the claim rests on it. The old address stays a subscriber in Klaviyo with nothing
  followed; remove it there by hand if someone asks.
- **Where a sign-in lands.** Signing in on `/account/` or `/register/` with nowhere else to go lands on the
  profile, after the "Finish your account" step for a new account. Arriving already signed in, each page stays
  put. `next=profile` is accepted like the other destinations.
- **Links to parts.** A link to a part that lives on the other page is sent across: `/profile/#following` (which
  earlier emails used) goes to `/account/#following`, `/profile/#emails` to `/account/#emails`. The lists are
  `PARTS` and `MOVED` at the top of the account code. Date emails now link to `/account/#following`.
- Neither page loads analytics or recordings, and both are kept out of search.

## The way in for program managers

The strip above the menu (signed-out visitors) carries "Run a program or camp? Claim your listing" on the left and
"Log in" on the right. The account and register pages open with two cards, "Parent or caregiver" (this page) and
"Program manager", which goes to `/managers/`: that page is where a manager's account is made, by claiming a
listing, and where a program that isn't listed yet is sent in.

## Emails to program managers about their listing

An account that holds a standing claim is emailed about its listing (`mgr_run()` in `src/server/groups-api.php`).
All three are sent by the morning job (`push_run`), never because of something a visitor did:

- **The month's numbers**, the first morning of each month: how many times the listing was opened in the last 30
  days (and the 30 before, once counting has run that long), clicks to sign up and to the website, times it was put
  on a plan, people who asked for its emails. Then one thing to do (`mgr_prompt()`), the first that applies: say
  whether there's space (never said, or the answer ran out), send in a sign-up date (none still to come), ask
  families for a review (none published), or propose an update. A claim less than `MGR_FRESH_DAYS` old is skipped.
- **A review was published.** The build hands the server each program's count of published reviews (`r` in the
  listings it passes, beside `u`, "has a sign-up date still to come"). When a count goes up, the listing's managers
  are told, with a link to the reviews. It says they have no say over reviews.
- **New followers**, at most once a week: how many more families started following the listing in the last seven
  days. A number, never who, and the listing's own managers aren't counted. It is skipped on the morning the
  month's numbers go.

The first time the job runs after this was added it only records where things stand (`mgr_month`, `mgr_week` and
`mgr_rv` in the `meta` table), so nobody gets a backlog. Each email ends with "Stop the emails about your listing",
which opens `/alerts/stop/` with the account's stop code and `k=m:listing`: the page asks first, then turns off
`users.mgr_mail`. The same switch is a tick box under "Your listings" on `/managers/`. Emails about a claim, and
about things a manager sent in (changes, photos), are not affected by it. `/edit/stats/` counts each kind sent.

## An email to you for each new account

Each new account sends one email to the site's contact address (`tell_owner()` and `signup_note()` in
`src/server/groups-api.php`):

- **New Parent Account Signup**: the email address and name. It goes when the account first has a name: at once
  with Google, after the name step with an emailed code.
- **New Program Manager Signup**: the email address, name and the listing's name. It goes with the account's first
  claim, in place of the plain "Listing claimed" email, and says whether the claim stands or waits for your yes
  (then the subject ends "(claim needs your yes)"). A parent who later claims a listing gets this one as well.
- An account that stops before the name step, or a manager who never claims, is picked up by the morning job
  (`signup_catchup()`, run from `push_run`) once it is an hour old: the email then says "Name: not added yet" or
  "Listing: none claimed yet".

`users.told` records which email went (0 none, 1 parent, 2 manager), so each is sent once. Accounts that existed
before this was added were marked as told. The emails hold nothing about a child, and the privacy page says they
are sent.

## Giving a listing by hand

A claim normally needs an email address at the listing's own website. For someone the owner knows runs a program
whose address isn't there (a studio that uses Gmail), `/edit/claims/` has "Give a listing to an account by hand":
the account's email address and a listing. The account has to exist already and have a name on it. The claim is
stored like any other, with `domain` set to `by hand` (the list of claimed listings says so), the person is
emailed, and from then on everything a manager can do works for it, including being made premium. Nothing on the
public site can do this: the form is behind the edit sign-in and its own token.

## Links down a long page

A long page gets a strip of links that stays under the menu bar. Put `${jumpNav()}` where the strip should sit and
give each part an `id` and a `data-jump-to="Short label"`; `window.pasJump()` in `site.js` fills the strip, leaving
out parts that are hidden or empty, and pages that fill themselves in later call it again. When the strip is wider
than the screen it scrolls sideways, with an arrow and a fade at whichever end has more (the same cue as the
filter rows). It is on My kids' calendar, the days-off page, the summer schedule and the privacy
page. (The account page used to have one; it has tabs now.) With fewer than two parts showing, the strip stays hidden.

## What's new

`data/news.json` is a short list, newest first: `{ "date", "title", "text", "href", "link" }`. The account page
shows the latest five under "What's new", and "Your account" in the header carries a dot until the newest one has
been seen on that device (`pas-news` in `localStorage`). Add an entry when something ships that an account holder
would want to know about.

## Parents and program managers, told apart

Every account is one or the other. A **manager** holds a claim (approved or waiting) or made the account on
`/managers/` (`users.origin`); everyone else is a **parent**. `role_of()` in `src/server/groups-api.php` decides,
and `me` returns it as `role`. Four places use it:

- **The numbers page** (`/edit/stats/`): tiles for parents and for program managers with an account, and rows
  for new accounts of each kind per day (`account_parent`, `account_manager`). This is the exact count.
- **Tag Manager, GA4.** Before Tag Manager loads, every page that loads it pushes `pas_role` (`visitor`,
  `parent` or `manager`) and `pas_signed_in` (`yes` or `no`) to the data layer (`roleHead` in `build.mjs`). The
  word comes from `localStorage` (`pas-role`), written by `noteRole()` in `src/groups.js` after a sign-in on this
  device. The import file sends them with every page view and event as `visitor_role` and `signed_in`; register
  both in GA4 (Admin > Custom definitions) as event-scoped dimensions. `pas_signup` carries `role` (which page:
  `parent` for `/register/`, `manager` for `/managers/`) and `account` (`new` or `returning`).
- **Clarity.** The same script sets two custom tags, `role` and `signed_in`, so recordings and heatmaps filter by
  them (Filters > Custom tags). Nothing to set up.
- **Klaviyo.** An account goes onto the accounts list with `has_account: true` and `role`, and its profile also
  carries `home_school` and `neighborhood` when the account has them. A manager's profile
  also gets `claimed_listings` (the names of the listings they hold), updated from `/managers/`. Segment on
  `role equals manager` or `role equals parent`. People who only asked for dates by email have no `role`: they
  are on the dates list with `school`, `programs` or `camps`.

It is a word for counting: no name, address or listing goes to analytics with it. The privacy page says so.

## All programs, by kind

`/all-programs/` (`allProgramsPage()` in `build.mjs`) is the first item of the Programs menu and where the footer's
"Programs" heading leads. It has one block for each kind of listing, in the order of a family's calendar:
after-school programs (`/programs/`), weekend classes (`/weekends/`), day-camp programs (`/day-camps/`) and summer
camps (`/summer-camps/`). Each block shows a count worked out at build time (the same number its own list shows),
a few facts (Saturdays and Sundays, days off still to come and the next one, weeks of summer) and buttons to the
list and its planner. Below the blocks are the after-school types, and schools, neighborhoods and grades.

It is a way in, not a ranking: no listing is named on it, so nothing is put ahead of anything else. A block is
left out when its kind has nothing listed. Each of the four lists has an "All programs" link above its heading
that leads back here, and `/programs/` is now called "After-school programs, A to Z" wherever it is linked, so
the two aren't confused.

## The planners need an account

Every planner (the week on `/board/`, the days-off planner on `/days-off/`, `/summer-schedule/` and `/calendar/`)
needs a signed-in account. The pages stay public and in search: signed out, a tour of the planner stands where the
planner would be (see "The tour" below), and the lists are there for everyone on their own pages (`/day-camps/`,
`/summer-camps/weeks/`).

- **The switch.** `GATE` in `build.mjs`: on when accounts are on, off in the preview (which has no accounts to sign
  in to). `"plannersNeedAccount": false` under `groups` in `site.config.json` opens the planners again. When it is
  on, `<html>` carries `data-gate="1"`, the planner's markup is wrapped in `.when-in` and the tour (`planShow()`) is
  `.when-out`: the same two classes the menu uses, driven by the `signed` class on `<html>`.
- **The tour** (`planShow(kind, depth)` in `build.mjs`, styled as `.pshow`): the signed-out planner pages read like
  a product page. Under the page's heading is the one thing to press, "Create a free account" (`heroCta()`), which
  comes back to that planner. Then: a heading and a strip of tabs, one for each way of looking at the plan (List,
  Month, Who's open on the days-off and summer pages; The week, Budget planning, Share it on the week; Calendar,
  List on My kids' calendar), each showing a made-up example; three things the planner does, each a picture-and-text row (a small
  drawing, `miniArt()`, on alternating sides, a headline and one line, in the kinds' colors); the three steps as one
  line (1 Create a free account → 2 Make your plan → 3 Take it with you); and a dark band with the button again.
  Three rows and one line each, rather than six cards with sentences, so the page can be taken in at a glance. The strip is labelled "See it as" and each example ends with a "Next: …"
  button, so the tabs read as something to press (`.view-switch` draws every choice as a button, in the planners
  too). The reference content that used to sit under the planners (the charts, the days, the listings) is on
  `/day-camps/` and `/summer-camps/weeks/`, so a planner page signed out is the tour and nothing else. The To do page has a short one with a single example. There is no "Log in"
  button in it: that is at the top of every page, and on these pages it and the menu's button carry `?next=` (the
  layout's `next`), so logging in comes back to the planner. `site.js` swaps the examples (`[data-pshow]`); without
  it they all show, one under the other. Analytics hears `pas_plan_tour` (planner, view) and `pas_plan_cta` (place,
  next), nothing about the visitor.
- **The examples** (`planExample()` and `showExample()`): each is marked "Example" and nothing in it can be pressed.
  The dates are real and rebuilt nightly (the next days off, the summer's weeks); the programs and camps are
  invented ("Chess club", "Art camp") on purpose, because a real listing shown there would be singled out over the
  others. The three summer examples show the same made-up summer, so they agree with each other. To change what a
  tour says, edit the `S` table in `planShow()`: every line there must be something the planner really does.
- **In the scripts** (`site.js`): `mayPlan()` says whether this visitor may plan. Signed out, "Add to roster" on a
  school page opens a small ask instead of the days; the boxes in the two charts are not buttons; nothing is added
  on arrival from "Add Saturday to your week".
- **Coming back.** A link that meant to add something (`board/?add=`, `?wk=`, `?roll=`, a day named by an email as
  `days-off/#d-2026-11-03`, or "Add to roster" on a school page) is kept for that tab in `sessionStorage`
  (`pas-want`) and picked up when the visitor lands back on the planner signed in. Someone who made the account in
  order to start a week lands at the top of the builder; someone who already has a week lands on "keep and share".
- **What it does not change.** A plan still lives in the browser (`pas-rosters`) unless its owner keeps it in their
  profile or shares it, so signing in to plan sends nothing about a child. A plan made on a device before this
  is still there once its owner signs in. This is a front door, not a lock: the check is in the browser.

## The plan as a calendar

- **My kids' calendar** is laid out in four numbered steps: 1 Add it (where the plans come from, and "Add your own
  dates"), 2 View it, 3 Share it (the pictures), 4 Pencil it in (the calendar file). "View it" shows the plan as a
  **calendar** (the default) or a **list**, with the choice kept on the device (`pas-year-view`). The calendar is
  one month at a time: a day off is yellow with where each child will be or "Not planned", a camp week runs Monday
  to Friday, sign-up dates and your own dates sit on their days, and a weekly date of your own is on every school
  day it falls on. A tap on a day lists it underneath with the same links as the list. Printing prints the list.
- **The days-off planner** opens as a list, with a Calendar switch beside it (`pas-off-view`). In the calendar the
  picked day's row sits under the month, so choosing works as it does in the list.
- **The summer schedule** has the same switch (`pas-sum-view`); there the pick is a whole week.
- Both use `calMonthView()` in `site.js`. On a phone the labels in the squares become coloured bars.

## The dragon

When a change fills the last open day of a part of a plan, a dragon flies across the screen with "You did it! … You
are on fireeee!" (`cheer()` in `site.js`, drawn in SVG, moved by CSS):

- the last day off of a month ("November is planned."), or of the whole year ("You planned the whole year.");
- a camp on the last open week of the summer ("You planned the whole summer.");
- something on all five school days of a week ("You planned the whole week."), on the builder or from "Add to
  roster" on a school page.

It comes once for each of those on a visit, takes no taps, leaves by itself after about seven seconds or on Escape,
and the planner's status line says the same words for a screen reader. For someone whose device asks for less
motion it stands still at the foot of the screen with a Close button. Opening a page, or a plan put back from a
profile, brings no dragon. Analytics gets `pas_cheer` with which kind, and nothing else.

## The planners in one place

`/schedules/` (`schedulesPage()` in `build.mjs`) is where "Build a schedule" on the home page and the first item
of the menu lead: one block each for the week (`/board/`), days off (`/days-off/#plan`), the summer
(`/summer-schedule/`) and My kids' calendar (`/calendar/`, or the sign-up page for someone signed out). The
counts on it (days off still to come, weeks of summer, camps) are worked out at build time. The small pictures
are drawn in the build; none shows a real plan.

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

## Site admins

`admins` in `site.config.json` is a list of email addresses. An account on the site with one of those addresses is a
site admin: while it is signed in (by the emailed code or by Google, like any account), `/edit/`, `/edit/stats/` and
`/edit/claims/` open with no second password, and the menu at the top of every page gains an **Admin** group with
the three links (Site numbers, Claims and changes, Edit the site's wording). The account and profile pages say
nothing about admin: those are the person's own. The username and password in `editLogin` keep working by themselves.

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

## Being found by search engines

Four things, all built by `build.mjs` unless it says otherwise.

- **A page for each day off still ahead** (`dayOffPage()`), at `/days-off/<name>-<date>/`, such as
  `/days-off/election-day-2026-11-03/`. It lists the camps whose own sites name that day (each card: "Add it to
  your plan for Nov 3" first, then "Full listing", then the camp's own page, so the way onward stays on the site),
  then the programs that run days-off camps but haven't posted this one, and links to the day before and after. The title is what a
  parent would type ("Election Day 2026: day camps in Philadelphia"). A day with no camp posted yet is built but
  marked `noindex` and left out of the sitemap, so search engines aren't handed an empty page; it joins the
  sitemap by itself the first night a camp is posted for it. The days list on `/days-off/` and the next-day-off
  strip link to these pages. Once a day has passed its page is no longer built, and `.htaccess` sends its old
  address to `/days-off/` for good.
- **Dates in the sitemap that mean something.** Each address's `lastmod` is the newest real date behind that page:
  when a listing was last checked, a link last confirmed, a review published, a school added, a camp checked. A
  list page takes the newest date among what it lists. Pages that are only words (about, terms and the like)
  carry no date, and the privacy page carries `privacyUpdated` from `site.config.json`. Nothing is stamped "today"
  just because the site was rebuilt, since search engines stop trusting dates that always say today.
- **IndexNow** (`scripts/indexnow.mjs`, run as the last step of the publish job). Before publishing, the job saves
  the sitemap the live site is serving; after, the script compares it with the new one and sends Bing (and the
  search engines that share IndexNow) only the addresses that are new or whose date moved. `indexNowKey` in
  `site.config.json` is not a secret: the build writes it to a file of the same name at the site's root, which is
  how the search engine checks the note came from this site. If the key is taken out, nothing is sent. The step
  can't fail a publish. To see what would be sent without sending: `node scripts/indexnow.mjs old.xml
  dist/sitemap.xml --dry`. Google doesn't take IndexNow; it reads the sitemap.
- **A badge for every claimed listing** (the managers page, in `groups.js`). Any manager with a confirmed claim
  gets a small picture (`src/static/badge.svg`) and a line of HTML to paste into their own website, or a plain
  text link if their site can't take a picture. It links straight to their listing with nothing added to the
  address, so each one is a clean link to this site from a local program's own site. It is free and has nothing
  to do with premium.

## Analytics
`analytics/gtm-import-ga4-clarity.json` imports into the GTM container (Admin > Import Container, "Merge", overwrite
conflicting). It adds a Google tag, one GA4 event tag per event below, and Clarity. The GA4 and Clarity IDs live in the
"GA4 Measurement ID" and "Clarity Project ID" variables. Every event's parameters are `DLV - <name>` data layer
variables, so a new parameter means a new variable and a row on that event's tag. Clarity gets every `pas_` event by
name through one trigger (`CE - any pas_ event`), so a new event needs nothing on the Clarity side.

Set `gtmId` to load Google Tag Manager on every page. Every page view and event carries `visitor_role` and `signed_in`
(see "Parents and program managers, told apart"). The site pushes these events to the data layer:

- **Finding things.** `pas_filter` (filter_type, filter_value, school): filter_type is `kind`, `program_type`, `grade`,
  `age`, `relation`, `neighborhood`, `cost`, `day` or `school`. `pas_filter_open` (school, from). `pas_search`
  (search_term, results, school) fires when someone pauses typing in a school page's search box; searches with zero
  results show what parents want that isn't listed. `pas_near` (from) and `pas_map_open`. `pas_school_pick` (school,
  covered) when someone picks a school in the finder, `pas_school_request` (school) when they ask for one that isn't
  covered, `pas_school_save` (school) when they save a school as theirs, `pas_school_notify` (school).
  `pas_program_pick` (program_id, method): method is `home_search`, `roster_search`, or `program_page`.
- **Moving around a page.** `pas_page_view` (view) fires when someone switches a page's view by hand: the roster's
  `week`, `cost`, `card` and `keep`, or the day-camps page's `who` and `days`. It doesn't fire for the view a page opens
  on. (The planners' List, Month, Who's open and Make it a calendar switches report through `pas_summer` and
  `pas_dayoff` instead, as `action: view_list`, `view_cal`, `view_chart` or `view_card`.) `pas_menu_group` (group, open)
  is a section of the phone menu opened or closed. `pas_offbar` (action, day) is the next-day-off bar closed.
- **Leaving the site.** `pas_outbound` (link_type, program_id, school): link_type is `register`, `website`, `calendar`,
  `review` or `camp`; school is empty on a program's own page. `pas_support_click` (plan: once or month, which of the
  Support page's two buttons), and `pas_support_thanks` (plan) once per checkout when someone comes back from paying a contribution on Stripe
  (`/support/?thanks=1&session_id={CHECKOUT_SESSION_ID}` on the Payment Link; `pas_test` marks a test-mode checkout
  and the tag skips it). The amount never reaches the page or analytics.
- **Planning.** `pas_board_add` (program_id, school, day, method, board, children) and `pas_board_share` (method,
  board): methods include `image_save`, `image_share` and `print`; `cta_click` is the "Share this schedule" button
  under the week, which leads to the card, a click rather than a share. `pas_theme_week` (theme, school, method).
  `pas_dayoff_pick` (program_id, day, method), `pas_dayoff` (action, days_planned, children), `pas_summer` (action,
  weeks_covered, children), `pas_todo` (action, days: a camp day ticked as signed up on the To do page),
  `pas_group_share` (method), `pas_cheer` (what: a milestone celebrated once).
- **Accounts and asking.** `pas_signup` (step, method, role, account), `pas_plan_tour` (planner, view: a signed-out
  visitor flipping through a planner's tour), `pas_plan_cta` (place, next), `pas_account_ask` (place), `pas_favorite`
  (action, listing, place), `pas_alert_signup` (school, program_id, camp_id, place): the address is never sent to
  analytics. `pas_ask` (program_id, listing_kind): a question sent through a listing, never the question or who asked.
- **Reviews.** `pas_review_nudge` (nudge_action, program_id, nudge_place) and `pas_review_submit` (program_id, school,
  stars). `pas_suggest_submit` (suggest_kind, school).
- **Managers only.** `pas_claim` (step), `pas_premium` (step, plan), and the sale as GA4 ecommerce: `begin_checkout`
  and `purchase` with an `ecommerce` object; a Stripe test-mode checkout is marked `pas_test: true` and the tags skip it.
- `pas_role` (pas_role, pas_signed_in) is a state push, not a GA4 event: it updates the two variables above the first
  time a device learns which kind of account signed in.

Nothing pushed names a child, a parent, a camp someone's child is going to, or a listing where the rules say not to
(see "Privacy"). Listing counts are numbers only.

## Keeping it current

A check of the listings is a comparison, not fresh research. Three things in the data make that possible, and the
build turns them into one worklist, `dist/data/check.json`, published with the site next to `programs.json`.

- **Pickup lists as last read.** A program's `pickupLists` holds each list of schools its provider publishes:
  `{ "where": "Queen Village, 530 Bainbridge St", "text": "Meredith, Jackson, CCS, Nebinger, …", "url": "https://…",
  "read": "2026-10-06", "how": "browser" }`. `text` is the list in the page's own words. `how` is how it was read
  that day: `browser`, `fetch`, or `person` (someone pasted it). `by` is `provider` unless a school (`school`) or
  someone else (`third-party`, such as a magazine's roundup) published it. `where` says which location or section
  when a provider has more than one list. `note` is for anything odd about the reading.
- **A date on every link.** `schools.<id>.checked` is the day that program-to-school link was last confirmed.
- **Pages that can't be trusted through a plain fetch.** `data/reading.json` lists sites or pages that need a real
  browser (`"how": "browser"`: a JavaScript app, or a site that has served an old copy) or a person (`"how":
  "person"`: it blocks automated reading), each with a `why`. `match` is the start of the address without
  `https://`. This exists because it has happened: on October 6, 2026 a plain fetch of Beehive's page returned its
  2023–24 pickup list while a browser showed the 2026–27 one.

`check.json` has three parts:

- `links`: every program-to-school link with its `checked` date. Pickup links also say what backs them (`basis`):
  `list` (the school is named in a stored list from the provider or the school), `own-source` (the link has its own
  source, such as the school's aftercare sheet), `third-party-list` (only someone else's roundup names it), or
  `none`. `notOnProviderList` marks a link whose provider publishes a list that doesn't name the school. The order is
  what needs attention first: `none`, then `notOnProviderList`, then the oldest `checked`. The build prints a note
  for the first two.
- `pages`: every page to read, once each however many listings lean on it, with how to read it, which programs
  depend on it, and what its pickup list said last time.
- `summary`: the counts.

How a check uses it:

1. Read each page in `pages` once. For a page marked `browser` or `person`, a plain fetch is not evidence: report
   what it returned and leave the data alone unless a browser or a person read it.
2. Where a page has stored `lists`, compare. Same schools: set the list's `read`, and `checked` on the links it
   names, to today. Different: update `text`, and treat every school added or dropped as a decision for the site's
   owner. A school that has gone from a list is flagged, never silently removed.
3. A provider that publishes a pickup list and has none stored gets one.
4. If a page that used to read fine returns something implausible (an earlier school year, a much shorter list than
   the stored one), add it to `data/reading.json` rather than trusting it.
5. Set `lastVerified` only on listings whose own details were re-read, and `checked` only on links confirmed.

Review the report and merge the changes you agree with. Busy times: March to May (next year's registration opens)
and late August (rec centers post their listings).
