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
- `supportUrl`: where the Support button goes (currently a Venmo profile). If it's empty, the Support page says contributions are being set up.
- `supportLabel` and `supportHandle`: the button text on the "Buy me a coffee" page, and the handle shown under it for people who'd rather search in the app.
- `siteUrl`: the domain you treat as the main one. Redirect the other domain to it at your host.
- `builtBy`: the name, link and short bio shown in the footer, on the home page and on About.
- `gtmId`: optional, e.g. `GTM-XXXXXXX`.
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
before it counts as a failure. Run it yourself any time: Actions > Check the site > Run workflow, or locally
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

Summer camps are their own list, in `data/camps.json`. `/summer-camps/` lists them as short cards (ages, dates,
hours, weekly price, neighborhood), and each camp has its own page at `/summer-camps/ID/` (`campPage()`) with
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

**The summer schedule** (`/summer-schedule/`) is built from the same file. It lays out the coming summer as weeks,
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
- **Kept in a profile.** Signed in, a parent can press "Keep this summer in my profile" (`#sum-profile`, drawn by
  `groups.js`, which the page loads). The server then holds one summer per account (table `summers`): the year, and
  for each child a first name and camp ids by week. Ages, the calendar's title and photos never leave the device.
  While it is kept (`sumProf` in `pas-rosters`), changes are sent a moment after they're made (`summer_save`); a
  newer copy in the profile replaces the one on the device at the next visit. Another device is told what the profile
  holds and can put it there, or replace it with its own, each on a second tap when something would be lost.
  `summer_delete` takes it out; deleting the account deletes it. No action shares a summer or reads someone else's.
  Signing in from the box goes to `/account/?next=summer` (or `/register/`) and comes back.
- **Add to calendar** saves `summer-2027.ics`, made in the browser: one Monday-to-Friday entry per camp week, titled
  with the child's name and the camp. The day-camp plan has the same button (`days-off.ics`, one entry per planned
  day). `saveCalendar()` in `site.js` writes both.
- **Make it a calendar** draws the plan as a picture, like the week card: the whole summer on one card (a row a week,
  a column a child), or a card for each month (Monday to Friday, a bar for each child's camp). The title defaults to
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
  planners stay free and work without an account; only this combined view asks for one.
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
  the day, just that day or every week on that weekday, and who it's for (everyone, or any of the children; a child
  can be named on the spot). "Add several at once" reads a typed or pasted list, one per line, each starting with a
  date (`10/14`, `Oct 14`, `2026-10-14`) or a weekday (`Wednesdays`, `every Monday`); lines it can't read stay in
  the box. They are kept with the rosters in the browser (`own` in `pas-rosters`: `{ id, t, d, r, w }`), never sent
  to the server and not part of a profile, so they are on that device only. A single day shows in the month list
  and the month picture; a weekly one joins that child's "Every school week" card and repeats in the calendar file
  to the last day of school, skipping days off. "Dates you added yourself" in the file's options turns them off.
  A date of your own is enough for the calendar to appear, with no other plan.
- **Pictures.** "School weeks" on one card, and a calendar for each month with something on it: days off in yellow
  with a bar for each child, camp weeks as bars across the row, and a flag on a sign-up date. Title (`yearTitle`) and
  photo work as on the other cards, and stay on the device.

## Weekend classes

A listing in `data/programs.json` with a `weekend` block shows on `/weekends/` and gets a "Weekends" row on its own
page: `{ "summary": "...", "days": ["sat"], "term": "Fall 2026: ...", "cost": "...", "note": "...", "url": "https://…",
"sources": [...], "check": { "url", "how", "look", "notes" }, "checked": "YYYY-MM-DD" }`. A place that only runs on
weekends (or only weekends and day camps) leaves `schools` as `{}`, like a day-camp-only listing.

Weekend classes go by where they are, not by school. `/weekends/` groups and filters them by part of the city (the
`CAMP_AREAS` list the summer camps use, worked out from each listing's `neighborhoods`), each card names its
neighborhood, and a parent's saved school never narrows the list. Each neighborhood page has a "Weekend classes in"
section: the places in that neighborhood, then the rest of that part of the city. A neighborhood that isn't in
`CAMP_AREAS` falls under "Elsewhere in the city", so add new ones there.

Optional `"times": { "sat": "9:30 am to 12:30 pm", "sun": "..." }` gives the short time shown in the week builder
and on the card when a parent has typed nothing of their own.

A place found in a sweep for weekend classes, where nothing else about it has been read, carries
`"scope": "weekend"`. Its page then says only its weekend classes have been read, instead of saying it has no
weekday program. Take the field off once its weekday classes have been checked against the schools.

**Weekends in Build your week.** The board has an "Add Saturday and Sunday" button under the weekdays. Weekend picks
are kept beside the weekdays, not in them (`board.wk = { sat: [], sun: [] }`, each entry a program id, or
`id~what the parent typed`), so pickup, the cost estimate and the week roller never see them. A weekend pick has no
school and no pickup label. Each class card on `/weekends/` has an "Add Saturday to your week" button
(`board/?wk=ID&day=sat`). The card is one image for the whole week: with weekend picks it grows by one row,
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

1. Add a record to `data/schools.json` (copy Nebinger's and change it). The `id` becomes the URL: `"meredith"` gives `/meredith/`. `aliases` lists the other names providers use for the school ("Jackson" for Coppin, "Vare Washington" without the hyphen), so the build can tell whether a provider's pickup list names it. Optional fields: `dismissalNote` (staggered dismissal times), `checkedNoPickup` (providers checked that don't serve the school) and `alsoListed` (programs the school names that haven't been confirmed yet).
2. In `data/programs.json`, add that school's `id` under `schools` for every program that serves it. Most providers are already there; they just need the new tag.
3. Add records for programs that are new (the school's own clubs and on-site care).
4. Give the school record `"added": "YYYY-MM-DD"` with the day it goes live. Parents who asked on the school's old
   "not covered yet" page to be told get one email that morning. Its old address (`/schools/<city id>/`) is
   sent on to the new page by a line the build writes into `.htaccess`.
5. Commit to `main`.

## Program pages

Every program gets its own page at `/programs/<id>/` (for example `/programs/zhang-sah/`), built from the
same record as its cards: the details, each school it serves, and its reviews. `/programs/` lists them all
A to Z. Both are in the sitemap, and each program page carries structured data (name, address, phone, and
the star rating once there are reviews) for search engines. Nothing extra to maintain: add or edit a
program in `data/programs.json` and its page follows.

## Finding programs: filters, types and the school finder

The home page opens with two "Start here" boxes, one for parents (find your school, build a schedule, create an
account) and one for program managers (claim a listing, add a program, add a camp), then a "More than weekday
afternoons" section that points at weekend classes, day camps and summer camps. Each box has a picture of who it is for (a grown-up with a child, a person with a clipboard), drawn in `WHO` in `homePage()`.

The top of a program's page says which schools it works for as colored labels (`servedPills()`): yellow for pickup, green for on-site, blue for nearby, the same colors as on the cards.

On a program's own page, a row of "The details" longer than about a hundred characters shows its first two lines with a "More" link (`fold()` in `build.mjs`). It is a `<details>` element holding the whole text, so it opens without JavaScript and nothing is left out of the page.

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

`/types/` and `/types/<type>/` are built from each program's `types`. The type names, colors and icons are the
`TYPES` list at the top of `build.mjs`.

The search box on the home page looks through `data/all-schools.json`: every district and charter school in
Philadelphia with any grade from K to 8, taken from the City's "Schools" open dataset. Schools with a record in
`data/schools.json` (matched by street address) open their page. The rest open `/schools/request/`, where a
parent can ask for the school with one tap. Each request is emailed to `contactEmail` with a running count and
logged in `phillyafterschool-school-requests.log` above `public_html`. Refresh `data/all-schools.json` when the
City updates its list (about once a year).

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

## The menu

The header has four groups that open (Programs, Search by, Build a schedule, Suggest; the first item under
Build a schedule is `/schedules/`, the page that introduces all the planners), then About and the
"Help the site keep going" button, which goes to the support page. The groups are defined in `layout()` in
`build.mjs` as a list of labels and links. Each is a `<details>` element, so it opens without scripts; the
script only closes the others. From 1100px wide the logo sits on the left and the menu on the right, on one
line; below that a Menu button opens every group in a single panel. "Day of week" lands on the A to Z page at its Day filter, which always shows there.

## Days of the week, days off, and a saved school

**Days.** A program's `days` show on its card and page. On a roster, a card placed on a day the listing doesn't
show gets a yellow note ("Not listed for Thursdays. Runs Tue, Wed.") instead of being blocked, because class
schedules change and the data can be behind. The add-to-roster day buttons for those days are drawn dashed.
A "Day" filter row appears on a listing page by itself once at least two programs in that list run on some
weekdays only; with fewer it would filter nothing, so it stays hidden.

**Days off.** `/days-off/` ("Day-camp programs" in the menu and footer) lists the days School District of Philadelphia students are off, from
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
- **Kept in a profile.** Signed in, "Keep this plan in my profile" (`#off-profile`) stores one plan per account
  (table `daysoffs`): the school year, and for each child a first name and the pick for each day. `keepPlan()` in
  `groups.js` runs this box and the summer one from the same code; the server actions are `daysoff_save` and
  `daysoff_delete`, and `profile` returns it as `daysoff`. It is never shared and no other action reads it.
- An email's "See who's open" button links to `days-off/#d-2026-11-03`, which opens that day's choices.
- Each pick fires `pas_dayoff_pick` (program_id, day, method). Other actions fire `pas_dayoff` with an `action`
  (copy_sibling, fill_break, sibling_add, copy, share, print, clear, profile_keep, profile_put, profile_stop); saving,
  sharing or printing a picture and saving the calendar file fire `pas_board_share` with board `day_camp`.

The page uses the same blue band as the rest of the site, with its own drawing, `dayScene()` in `build.mjs`: the
school shut, the bus asleep, a swing and a kite going up. Its share picture is `src/static/share-days-off.png`; any
page can name its own with `shareImage` in `layout()`.

**Colours.** Every colour is a named value at the top of `src/site.css`. The band at the top of each page is a
daytime sky (`--hero` fading to `--hero-low`) with navy type (`--hero-ink`, `--hero-muted`); the header button
is `--cta`; the footer keeps the deep blue (`--foot`). Navy on the sky measures 9:1 or better, above the old
white-on-deep-blue. Dark mode has its own set just below, where the band is deep blue and the sun in the home
scene is switched off (`--sun`). The week card (`drawCard` in `src/site.js`) and the link-preview picture
(`src/static/share.png`, 1200 by 630) use the same sky and footer, so change them together.

**A saved school.** A school page has "Save as my school". The choice is kept in the visitor's browser
(`pas-my-school`), with no account. After that the home page shows a shortcut to the school, the citywide
lists (A to Z, types, neighborhoods) open narrowed to programs that work for it with an "Any school" button
beside it, and the roster's "Add a program" assumes it.

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

`/board/` ("Build your week" in the menu) lets a visitor collect programs by weekday with "Add to roster"
on any card. Each child has two rosters, Current and Upcoming, so a family can share what they do now and
plan the next term. A family with more than one child adds a roster per child (up to six) and picks whose
roster a program goes on. Rosters are stored in the visitor's own browser. Nothing about them reaches the
server unless a signed-in parent keeps a week in their profile or shares it (see "Accounts, profiles and
sharing"). A week can no longer be shared as a link.
Each pick is drawn as a card in its program type's color. "Make it a card" draws the week as one picture
(for a text, a printout or a teacher), with an optional photo that is read on the device and never uploaded.
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

An account is optional. It lets a parent keep their school and a child's week in a profile (so they are there on
another device), share a week with one person, and, while it is a pilot, join a share group of a few families.
These are the only parts of the site that store anything about a child on the server.

- **Turning it on.** `"groups": { ... }` in `site.config.json`. Remove `groups` to take accounts out of the build.
  With it on, the menu's yellow button is "Create a free account" (or "Your account" once that browser has signed
  in), a strip above the menu offers "Log in" to anyone signed out, and the support ask ("Help the site keep
  going") moves to the footer and the account page. Which version shows is decided from a flag in the browser, with
  no request: elements carry the class `when-out` or `when-in`.
- **Creating an account and logging in.** Two addresses share one form. `/register/` is the landing page for
  creating an account: what an account gives you (with a drawing of a week on a phone and a laptop) beside the
  form. `/account/` is where you log in and, signed in, your profile; someone already signed in who opens
  `/register/` is sent there. `?next=board` on either sends them back to Build your week afterwards. The old
  address `/account/?new=1` forwards to `/register/`. `/register/` loads analytics (see Privacy below); `/account/` does not.
- **Build your week.** The card comes first. Once someone shares, saves, copies or prints a card, a box asks
  whether they want to keep the week too, and points at the block under the card maker: "Save this week, or share
  it" for someone signed out (Create a free account, Log in), "Keep and share this week" for someone signed in.
- **Signing in.** Google's button first, then a 6-digit code by email (no password). Set `"googleClientId"` under
  `groups` to the OAuth client ID from Google Cloud (a public value; there is no secret) to offer Google. The
  button is Google's own, so its script loads on every page that shows the sign-in form; it is left out inside
  the Facebook and Instagram apps, where Google refuses to sign in, and the form works without it if the script
  can't be fetched. The server asks Google whether the token is real, then checks it was issued to this site and
  that the address is one Google runs (Gmail or a Workspace domain); anything else is sent to the email code. A
  new account needs a first and last name before it can do anything; Google supplies them.
- **Profile.** "Keep this week in my profile" on Build your week stores the child's first name and, for the
  current and upcoming weeks, each pick as `program.school` (plus a class the program lists). Free-text notes,
  the teacher's name, the card note, prices and day-off plans stay on the device. The roster remembers the
  profile week it belongs to (`prof: { id, u }`); changes go up by themselves, and a device that finds a newer
  copy in the profile takes it, keeping its own notes for the same program. "Put it on this device" rebuilds a
  kept week on a new device. A kept school is also that device's saved school, and saving a different school
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
  the site never asks a child for an email address, and the week builder and card work without an account.
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

## My profile and the account page

Once someone is signed in there are two pages, drawn by the same code in `groups.js` (`drawProfile()`), which is told
which page it is on by `data-view` on `#account`. Every panel is built either way and `put(panel, page)` shows it on
its own page.

- **`/profile/` ("My profile", `profilePage()`)** is what a person has saved and what they hear about: About you
  (name, school, grades, neighborhood), Emails and texts (the Sunday email and a phone number), What's new, Places
  you follow, Favorites, and Your plans (weeks, summer, days off, My kids' calendar). News nobody has seen sits
  near the top; once seen it moves to the foot of the page. Someone who manages a listing gets a "Your listings"
  panel here too. The header button for a signed-in visitor is "My profile".
- **`/account/`** is the account itself: who is signed in, sharing and groups, invitations, listings, the support
  ask, signing out and deleting. Signed out, it is still where people log in.
- **Where a sign-in lands.** Signing in on `/account/` or `/register/` with nowhere else to go lands on the
  profile, after the "Finish your account" step for a new account. Arriving already signed in, each page stays
  put. `next=profile` is accepted like the other destinations.
- **Old links keep working.** A link to a part that lives on the other page is sent across: `/account/#following`
  goes to `/profile/#following`, and `/account/#profile` (the old Sunday-email link) to `/profile/#emails`. The
  lists are `PARTS` and `MOVED` at the top of the account code.
- Neither page loads analytics or recordings, and both are kept out of search.

## The way in for program managers

The strip above the menu (signed-out visitors) carries "Run a program or camp? Claim your listing" on the left and
"Log in" on the right. The account and register pages open with two cards, "Parent or caregiver" (this page) and
"Program manager", which goes to `/managers/`: that page is where a manager's account is made, by claiming a
listing, and where a program that isn't listed yet is sent in.

## Links down a long page

A long page gets a strip of links that stays under the menu bar. Put `${jumpNav()}` where the strip should sit and
give each part an `id` and a `data-jump-to="Short label"`; `window.pasJump()` in `site.js` fills the strip, leaving
out parts that are hidden or empty, and pages that fill themselves in later call it again. When the strip is wider
than the screen it scrolls sideways, with an arrow and a fade at whichever end has more (the same cue as the
filter rows). It is on the account page
(built in `groups.js`, where `part(box, id, label)` marks each panel, and a link such as `/account/#favorites` lands
on its part once the page has drawn), My kids' calendar, the days-off page, the summer schedule and the privacy
page. With fewer than two parts showing, the strip stays hidden.

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

## The planners in one place

`/schedules/` (`schedulesPage()` in `build.mjs`) is where "Build a schedule" on the home page and the first item
of the menu lead: one block each for the week (`/board/`), days off (`/days-off/#plan`), the summer
(`/summer-schedule/`) and My kids' calendar (`/calendar/`, or the sign-up page for someone signed out). The
counts on it (days off still to come, weeks of summer, camps) are worked out at build time. The small pictures
are drawn in the build; none shows a real plan.

## Analytics
`analytics/gtm-import-ga4-clarity.json` imports into the GTM container (Admin > Import Container, "Merge"). It adds a Google tag,
one GA4 event tag per event below, and Clarity. The GA4 and Clarity IDs live in the "GA4 Measurement ID" and
"Clarity Project ID" variables.


Set `gtmId` to load Google Tag Manager on every page. The site pushes these events to the data layer:
`pas_filter` (filter_type, filter_value, school), `pas_outbound` (link_type of register or website,
program_id, school; school is empty on a program's own page), `pas_suggest_submit` (suggest_kind, school), `pas_support_click`, `pas_review_submit` (program_id,
school, stars), `pas_board_add` (program_id, school, day, board, children) and `pas_board_share` (method, board).
`pas_school_pick` (school, covered) fires when someone picks a school in the finder, and `pas_school_request` (school)
when they ask for one that isn't covered. `pas_program_pick` (program_id, method) fires when someone picks a program
by name: method is `home_search`, `roster_search`, or `program_page` (the "Add to your week" button). `pas_school_save` (school)
fires when someone saves a school as theirs. `pas_alert_signup` (school, program_id, place) fires when someone signs up for dates by email or follows a program; the address is never sent to analytics. `pas_filter` reports filter_type as `grade`, `program_type`, `relation`,
`neighborhood`, `cost`, `day` or `school`. `pas_board_share` methods include `image_save`, `image_share` and `print`. The method `cta_click` is the "Share this schedule" button under the week, which leads down to the card; it is a click, not a share.
`pas_theme_week` (theme, school, method) fires when someone rolls a themed week on the roster page.
`pas_outbound` also fires with link_type `calendar`, `review` and `camp` (a day-off camp link). `pas_search` (search_term, results,
school) fires when someone pauses typing in a school page's search box; searches with zero results
show what parents want that isn't listed.
`pas_signup` (step, method, role, account), `pas_claim` (step), `pas_dayoff` (action, days_planned, children),
`pas_summer` (action, weeks_covered, children), `pas_near` (from), `pas_map_open`, `pas_filter_open` (school) and
`pas_school_notify` (school) each have a tag in the import file too. Every page view and event also carries
`visitor_role` and `signed_in` (see "Parents and program managers, told apart").

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
