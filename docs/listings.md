# Schools and listings: adding, editing, keeping current

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
- `daysOff`: optional. What the program runs when district schools are closed: `{ "summary": "...", "url": "https://…", "dates": ["2026-11-03"], "sources": [{ "label": "…", "url": "https://…" }] }`. `dates` holds only the dates the provider itself posts (an empty list when it posts none). Puts the program on the "Days off from school" page. Optional, each only when the provider's page states it: `hours` ("9 am to 3 pm; aftercare to 6 pm"), `cost` ("$90 a day"), `ageMin` and `ageMax` (whole years). A day's page shows hours, cost and ages as rows of their own above the summary, and its age filter goes by `ageMin`/`ageMax` when they are there (the program's grades otherwise).
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
- `looked`: optional, a day after `lastVerified` when the listing's sources were read but didn't confirm its details
  (the City's finder showing no program this year, say); the `note` says what was found. Pages then say "Checked
  {looked}. Details last confirmed {lastVerified}." Once `lastVerified` catches up it is ignored, and can be dropped.
  A school page's "Checked" date is the later of the school's `lastReviewed` and the newest `checked` among its links.
- `pickupLists`: the provider's pickup lists as they were last read, one entry per list the provider publishes. See
  "Keeping it current".
- `told`: what the program itself told us, as opposed to what its site says. A list of
  `{ "on": "YYYY-MM-DD", "by": "program manager" | "provider" | "school", "how": "an email through the suggestion form", "fields": ["hours", "register.nextTerm"], "says": "…in a sentence" }`.
  The fields named are the program's word: a check never changes them back to what the site says, and when the site
  disagrees it raises the difference instead (see "Keeping it current"). The program's page says "Some of this came
  from the program itself, on <date>". After 120 days (`TOLD_DAYS`) an entry is stale: the morning job asks the
  listing's managers, once, whether it still holds, and a newer `told` entry covering the same fields is the answer.
  Add an entry whenever a fact is written in from a message rather than a page; never delete one, add a newer one.
- `asks`: open questions for the program's managers, each `{ "id": "a-short-id", "on": "YYYY-MM-DD", "question": "…" }`
  (up to 600 characters). The monthly check writes one when a provider's site and the listing disagree on a field
  the program told us; the morning job emails it once to whoever holds the listing (see "Emails to program managers").
  Remove an ask once it is settled. A listing nobody has claimed gets no email: those are for the owner, in the check's report.

## Add a school

0. **Sweep the neighborhood first** (standing rule since November 7, 2026, after Childs and Bache-Martin went up with
   one pickup each): `node scripts/sweep.mjs <id or street address>` prints every listed program within a mile and
   its relation to the school, every pickup list on the site that names the school (aliases included), and Parks &
   Rec's after-school programs within a mile from the City's own program data (phl.carto.com, the data behind the
   Parks & Rec finder: facility, ages, fee, registration status and the year the entry was made). Then the reads it
   can't do: the City's OST program locator in a browser (phila.gov/ost/program-locator; each entry has its own
   `?resource=ost_NNN` link to cite), the school's own site and after-school page, each provider's own page for
   anything found there or in a third-party roundup (phillyfamily.com keeps one), and the families who asked for
   the school and the school office ("who picks up here, and who runs on site?"). Only a provider's own page or
   word, the school's own page (shown as the school's word) or the City's own listing goes on the site.
1. Add a record to `data/schools.json` (copy Nebinger's and change it). A charter school usually keeps its own calendar: add it as `calendar` (see "A school with its own calendar"). The `id` becomes the URL: `"meredith"` gives `/meredith/`. Leave `dismissal` out when the school doesn't post one (the page then says so and tells families to ask); `dismissalNote` still shows. `aliases` lists the other names providers use for the school ("Jackson" for Coppin, "Vare Washington" without the hyphen), so the build can tell whether a provider's pickup list names it. Optional fields: `dismissalNote` (staggered dismissal times), `checkedNoPickup` (providers checked that don't serve the school) and `alsoListed` (programs the school names that haven't been confirmed yet).
2. In `data/programs.json`, add that school's `id` under `schools` for every program that serves it. Most providers are already there; they just need the new tag.
3. Add records for programs that are new (the school's own clubs and on-site care).
4. Give the school record `"added": "YYYY-MM-DD"` with the day it goes live. Parents who asked on the school's old
   "not covered yet" page to be told get one email that morning. Its old address (`/schools/<city id>/`) is
   sent on to the new page by a line the build writes into `.htaccess`.
5. Commit to `main`.

### Five schools a day

A scheduled task ("Philly After School: five new schools a day", every morning) adds five schools a day by these same
steps and proposes them as one pull request for Josh to merge. It never pushes to `main` or `live`.

- **Which schools.** `node scripts/next-schools.mjs [n]` lists the schools without a page that teach some of K to
  5th grade, in order: first `data/school-queue.json` (Josh's own order, most often schools parents asked for: add
  `{ "id": <its id in data/all-schools.json>, "why": "parents asked" }`), then schools a stored pickup list already
  names (the match is rough and prints the list's own words, so it's a lead to read), then the nearest to a school
  that has a page, so coverage grows outward. A school the run can't do well (no site to read, a charter whose
  calendar it can't read, fewer than two programs that run there or pick up there) is skipped and named in the pull
  request, and the next one is taken.
- **One pull request at a time.** If yesterday's is still open, the run brings it up to date with `main` and adds
  the day's five to it, so merging never conflicts. Every school in the open pull request carries today's date as
  `added`.
- **Merge within two days.** `added` is what emails the parents waiting for a school, on that morning or one of
  the two after it (the email job's catch-up), so a pull request merged later still publishes the pages but those
  emails are missed.
- **The claim-outreach sheet.** Josh keeps a Google Sheet of every provider with a contact email, to invite them to
  claim their listings. Each run also adds the providers it brought in: `node scripts/provider-contacts.mjs --known
  <file> --browser` takes the sheet's Website and "Links to the listings" columns, and returns a row (in the sheet's
  columns) for each provider not in it yet, with the best address on the provider's own site (`--offline` groups
  the listings without reading any site; `tests/cases/04-provider-contacts.mjs` runs it that way). The addresses go
  to the sheet only, never into the repository or a pull request. The browser is only for a site that answered but
  showed no address; a site that refuses a plain fetch is left alone.

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

### The free pre-read

Most of the pages the monthly check opens say the same thing they said last month, and reading them costs the check
time and money. So on the 1st, a few hours before it, a GitHub workflow (`.github/workflows/precheck.yml`, which also
runs by hand from the Actions tab) reads them for free: `scripts/precheck.mjs` takes every page in `check.json`
(`pages`, `camps`, `weekend`), reads it the way `data/reading.json` says (a plain fetch, or a headless Chromium for the
"browser" pages; a "person" page is never requested), honors robots.txt (the rules are shared with
`scripts/linkcheck.mjs` in `scripts/robots.mjs`), and keeps the page's visible text: scripts, styles and menus'
markup out, one line per line, a repeated line once, and copyright lines left out, since the year turning over isn't a
change. Each page keeps up to four versions (newest first, with the first and last day each was seen) in `pages.json`
on the `precheck` branch, one commit replaced each time, with `report.json` beside it.

The report compares each page with the version it had on the day its listings were last confirmed (a program's
`lastVerified`, a pickup list's `read`, a camp's or weekend block's `checked`, the oldest of them when listings share a
page), not with last month's reading, so a change still shows if last month's check was never merged. It sorts the
pages into `same`, `sameSince` (no version that old is kept yet; unchanged since the oldest kept), `changed` (with the
lines `added` and `removed`, order ignored, sixty of each at most), `new`, `thin` (under 15 lines of text: a
JavaScript app's shell, a sign-in page or a bare form, where "the same" would mean nothing, so the check reads it as
before), `failed`, `closed` (robots.txt) and `person`, each naming the listings that rest on the page.

The monthly check starts from `report.json` (its prompt's START FROM THE PRE-READ): it doesn't open `same` pages, nor
`sameSince` ones whose "since" is within two weeks of the date they were confirmed; it reads a `changed` page's lines
first and opens the page only when they touch something a listing holds; it reads everything else as before, plus a
spot check of ten skipped pages. With no report from the last two days it reads everything. No page gets more than a minute (`PRECHECK_PAGE_MS`),
however it stalls, and after 25 minutes (`PRECHECK_MINUTES`) the run starts no new pages: what's left goes under
`failed` as not read this time and keeps its versions, so the job always ends and saves what it read. The log counts
pages as it goes. `tests/cases/02-precheck.mjs` runs it five times over a small site of its own, with a page that
never finishes.

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
5. Set `lastVerified` only on listings whose own details were re-read, and `checked` only on links confirmed. When a
   listing's own page was read (in a browser where `data/reading.json` says so) but didn't confirm its details, set
   `looked` to today and say in `note` what it showed, so the listing doesn't look unchecked.
6. **What the program told us wins over its site.** `check.json` has `told`: every field a program gave us itself
   (by email, or as a change proposed from its claim), with the date. A check does not change those fields from the
   site. When the site says something different, it adds an `asks` entry on the listing with the two versions as a
   question ("Your website says the clinics are at Old Pine Community Center; on October 19 you told us The
   Neighborhub. Which should the listing say?") and lists it under "Needs your decision". The morning job emails
   the question once to the listing's managers; their answer comes back as a reply or a proposed change. A `told`
   entry marked `stale` (older than 120 days) gets the same treatment automatically; an unclaimed listing's stale
   entries are for the owner to chase.

Review the report and merge the changes you agree with. Busy times: March to May (next year's registration opens)
and late August (rec centers post their listings).

### Two scheduled runs

Two scheduled tasks in the owner's Claude app do the research. Neither one pushes to `main` or to `live`, and neither
touches `data/reviews.json`, `data/copy.json`, `data/news.json`, `data/school-dates.json`, `data/all-schools.json`,
`data/card-qr.json`, `scripts/`, `email/`, `.github/`, `src/`, `build.mjs` or the settings that run the emails,
accounts and terms. Each ends in a pull request for the owner to merge.

- **The monthly check** (the first of the month) re-reads every listing, weekend block and summer camp against the
  provider's own site, using the worklist above, and the district calendar.
- **The weekly run** works a queue instead: what came in through the site that needs a program's website read and
  judged. `/edit/queue/` (behind the edit sign-in) lists it: suggestions of programs and camps and updates to
  listings from the suggestion form (read from the log the form keeps next to the public folder), changes the
  people who run a listing have proposed (status `new` in the accounts database), and notes the owner types on
  the page. Feature ideas, contact messages and dates for a school are not research and don't appear. Each item is
  shown as it will be sent, with email addresses and phone numbers already taken out; the sender's name is never
  included. Ticking the items and choosing "Send" writes `data/queue.json` as one commit on the repository's
  `queue` branch (through the same key file publishing uses, never on `main`, so nothing deploys), with the batch's
  id, the items, and a count of the schools people have asked for (from the "ask for your school" page and the
  form). The weekly run reads that file, checks each item against the provider's own site under the monthly
  check's rules, runs `node scripts/linkcheck.mjs` for dead and moved links, and opens a pull request named
  `weekly-<batch>`; a batch that already has its branch is not worked twice. **Rush:** ticking it emails the owner
  a one-line reminder to press "Run now" on the task in the Claude app, so the pull request follows within the hour
  instead of on the run's next morning. The page keeps what was sent (in `phillyafterschool-queue.json` next to the
  public folder) and links each batch to its pull request; "Done, take it off" and "Not for the run" hide items.
  The monthly check leaves queued items to the weekly run. The repository is public, so the owner unticks anything
  that shouldn't be in it before sending.

`scripts/linkcheck.mjs` sweeps every outside address in the data files (programs, camps, schools, the district
calendar): status code and final address only, six at a time, honoring `robots.txt` (a page closed to `*`,
ClaudeBot, Claude-Web, anthropic-ai or GPTBot is reported as not checked, never fetched). `--list` only prints the
addresses and where each is used. It writes `linkcheck.json` (ignored by git) and prints what didn't answer 200 and
what moved.
