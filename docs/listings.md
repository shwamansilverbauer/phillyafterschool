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
1. Add a record to `data/schools.json` (copy Nebinger's and change it). A charter school usually keeps its own calendar: add it as `calendar` (see "A school with its own calendar"). The `id` becomes the URL: `"meredith"` gives `/meredith/`. Leave `dismissal` out when the school doesn't post one (the page then says so and tells families to ask); `dismissalNote` still shows. `aliases` lists the other names providers use for the school ("Jackson" for Coppin, "Vare Washington" without the hyphen), so the build can tell whether a provider's pickup list names it. Optional fields: `dismissalNote` (staggered dismissal times), `checkedNoPickup` (providers checked that don't serve the school) and `alsoListed` (leads from a Home & School page, a directory or a roundup that couldn't be confirmed on the provider's own site, the school's own site or the City's listing). A program the school's own site names never goes in `alsoListed`: it gets a listing, with the school's page as its source (see `martial-posture`), even when the provider has no site of its own.
2. In `data/programs.json`, add that school's `id` under `schools` for every program that serves it. Most providers are already there; they just need the new tag.
3. Add records for programs that are new (the school's own clubs and on-site care).
4. Give the school record `"added": "YYYY-MM-DD"` with the day it goes live. Parents who asked on the school's old
   "not covered yet" page to be told get one email that morning. Its old address (`/schools/<city id>/`) is
   sent on to the new page by a line the build writes into `.htaccess`.
5. Commit to `main`.

### Five schools a day

A scheduled task ("Philly After School: five new schools a day", every night) adds five schools a day by these same
steps and proposes them as one pull request, which the autopilot gate checks (see "The autopilot gate"): with the
switch on, a clean one is merged at the next hourly merge, and what the gate holds (a What's new entry always) goes to
a second pull request for Josh. It never pushes to `main` or `live`. Its prompt is in
[`docs/runs/five-schools.md`](runs/five-schools.md).

- **Which schools.** `node scripts/next-schools.mjs [n]` lists the schools without a page that teach some of K to
  5th grade, in order: first `data/school-queue.json` (Josh's own order: add `{ "id": <its id in
  data/all-schools.json>, "why": "parents asked" }`), then, with `--asks <file>` (`queue/open.json` from the private
  ops repository, see "The private queue"), the schools families asked for, most asked first, then schools a stored
  pickup list already names (the match is rough and prints the list's own words, so it's a lead to read), then the nearest to a school
  that has a page, so coverage grows outward. A school the run can't do well (no site to read, a charter whose
  calendar it can't read, fewer than two programs that run there or pick up there) is skipped and named in the pull
  request, and the next one is taken.
- **One pull request at a time.** If yesterday's is still open and not held, the run brings it up to date with
  `main` and adds the day's five to it, so merging never conflicts. If it is held (`needs-josh`), the run brings it up
  to date, leaves it for Josh and starts the day's own branch. Every school in the open pull request carries today's
  date as `added`.
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

### The scheduled runs

Four scheduled tasks in the owner's Claude app do the research (scaling plan, Phase 4). None of them pushes to `main` or
to `live`, and none merges: each ends in a pull request with an evidence file, which the autopilot gate checks (see
"The autopilot gate"). With the switch `on`, a clean one is merged at the next hourly merge and the site publishes;
anything the gate holds waits for Josh on the Needs-you page. Each run checks itself first (`node scripts/gate.mjs
--local`) and moves what the gate would hold into a second pull request, `<branch>-held`, so one held listing never
holds up the rest (`--split`, see "What the gate checks"). Each writes `outcomes/<run>.json` to the private ops
repository when it finishes, with `"failed"` and the step it stopped at when it couldn't (see "The private queue").

Each task's full prompt, its schedule, its model and the connectors it keeps are in `docs/runs/`. The Claude app holds
the live copy: a change to a prompt is made in the file by pull request, then pasted into the task.

| Task | When | What it does | Connectors it keeps | Prompt |
|---|---|---|---|---|
| The queue run | 5:41 am and 12:41 pm | Works `queue/open.json`: suggestions, proposed changes, notes and mail. Ends within a minute when the queue is empty | GitHub (Claude Code Remote) | [`queue-run.md`](runs/queue-run.md) |
| Five schools a day | 3:23 am | Adds five schools, in the order parents asked | GitHub, Google Sheets | [`five-schools.md`](runs/five-schools.md) |
| The weekly run | Mondays, 6:59 am | The link sweep and the What's new drafts | GitHub | [`weekly-run.md`](runs/weekly-run.md) |
| The monthly check | The 1st, 8:53 am, after the free pre-read | Re-reads every listing, weekend block and summer camp, and the district calendar, starting from the pre-read | GitHub | [`monthly-check.md`](runs/monthly-check.md) |

Each task needs both repositories, `shwamansilverbauer/phillyafterschool` and `shwamansilverbauer/phillyafterschool-ops`,
in its settings in the Claude app: the queue and the outcome files live in the ops repository, and a run can't add a
repository its task doesn't list. A run reads strangers' text (suggestions, emails, web pages), so it holds nothing
it could be talked into misusing: GitHub only, and Google Sheets for the schools run's claim-outreach sheet, which it
only appends to and never emails from.

- **The queue run** works the private queue (see "The private queue" below). `node scripts/queue-work.mjs <ops clone>`
  lists the items not yet answered in any outcome file (an item answered `failed` counts as not answered), oldest
  first, at most 15 (the gate's limit for a queue run; the rest wait for the next run), and prints "Nothing to do."
  when there are none, which ends the run. It checks each item against the provider's own site under the monthly
  check's rules, answers emails with the site's fixed replies, and opens a pull request named
  `queue-<date>-<time>` (Philadelphia time). "Run now" on the task runs it any day; Rush on `/edit/queue/` reminds
  the owner to. While the switch is `shadow`, it also tries a smaller model on its first pass (sorting the items) and
  reports in its pull request how often the two agreed, for the owner to decide whether the smaller model can take it.
- **Five schools a day** (above).
- **The weekly run** sweeps the links (below) and drafts What's new entries from what shipped. Its queue work moved
  to the queue run.
- **The monthly check** (the first of the month) re-reads every listing, weekend block and summer camp against the
  provider's own site, using the worklist above, and the district calendar. It usually changes more values than one
  autopilot merge may carry (40, `limits` in `scripts/gate.config.json`), so its pull request is held as a whole for
  Josh until that limit is raised.

**Cost.** The running budget assumed in the scaling plan holds only if the queue run is cheap when idle (it reads two
small folders and stops) and no run reads the big files whole (`CLAUDE.md` and the prompts point each run at the
sections it needs). If usage climbs, the first cut is the queue run's 12:41 pass. The tokens each run reports in its
outcome file add up in the morning summary's cost line.

`scripts/linkcheck.mjs` sweeps every outside address in the data files (programs, camps, schools, the district
calendar): status code and final address only, six at a time, honoring `robots.txt` (a page closed to `*`,
ClaudeBot, Claude-Web, anthropic-ai or GPTBot is reported as not checked, never fetched). `--list` only prints the
addresses and where each is used. It writes `linkcheck.json` (ignored by git) and prints what didn't answer 200 and
what moved.

### The private queue

Everything that comes in through the site and needs a program's website read goes to the research runs through one
private queue, with no ticking or sending by hand. It lives in the private ops repository (`opsRepo` in
`site.config.json`, `shwamansilverbauer/phillyafterschool-ops`), never in this public one, and nothing a person typed
reaches the public repository. (Until November 2026 the owner ticked items on `/edit/queue/` and sent them as
`data/queue.json` on a public `queue` branch. That branch is retired.)

- **What goes in.** Suggestions of programs and camps and updates to listings from the suggestion form (read from
  the log the form keeps next to the public folder, the last 90 days), changes the people who run a listing proposed
  (status `new` in the accounts database), the owner's notes from `/edit/queue/`, and mail people wrote to the site's
  address that the hold list didn't keep for the owner (handed over by the mailbox script; see "The mailbox script" in
  `docs/emails.md`). Feature ideas and dates for a school are not research and don't go in. Since Phase 6, also
  reviews that passed the site's checks, and what the people who run a premium listing wrote (its words, offer line
  and Kids' Playground pin) and the photos and logos they sent, until a run has rated them (see "Reviews" and
  "Premium listings" in `docs/program-managers.md`; the shared code is `src/server/content.php`).
- **How it gets there.** The hourly `push_run` call (`.github/workflows/alerts.yml` makes it every hour, and
  `scripts/send-alerts.mjs` in the morning) writes `queue/open.json` to the ops repository through the same key file
  `/edit/` publishes with (`phillyafterschool-github.key`, whose token needs that repository: Contents, read and
  write). One commit, made only when the queue has changed, at most once in 50 minutes. The shared code is
  `src/server/queue.php`, pasted into `groups/api.php` and `/edit/queue/` by the build.
- **What the file holds.** `items`, each with its stable `id` (`s…` a suggestion, `e…` a proposed change, `n…` a
  note, `m…` an email), `kind` (`program`, `camp`, `update`, `proposal`, `note`, `mail`), `when`, and as given
  `program`, `website`, `listing`, `school`, `pickup`, `campType`, `sentBy` and `details`. An email carries its
  scrubbed `subject` and `details` (addresses, phone numbers and the sender's own name taken out), `attachments` (a
  count), `inThread` (an earlier email's id in the same thread), and `from`, what the host worked out in place of the
  address: `domain`, `dkim` (whether DKIM passed for that domain), `listings` (the listings whose website shares it),
  `sharedDomain` (a domain many organizations share), `account` (`parent`, `manager`, `admin` or `none`), `via`
  (`email` or `contact form`) and `answersOutreach` (the sequence, when it answers an outreach email); and `schoolsAsked`, the count of families asking
  for each school without a page (one per account from the "ask for your school" button, plus the form's "A school
  to add"), most asked first, with the school's `id` where it is known. Email addresses and phone numbers are taken
  out of the free text. A proposal made within a day of a claim by code carries `"claim": "by code, under a day"`.
  A review (`v…`, kind `review`) carries `entry`, the exact entry `data/reviews.json` will hold, with its `listing`
  and `program`. A manager's words, offer or pin (`x<id>`, kind `words`, `offer` or `pin`) carries `text` (a pin's
  name), and an offer its `until`; a photo or logo (`f<id>`, kind `photo` or `logo`) carries `alt`, `consent` (the
  manager ticked that everyone shown, or their parent, agreed) and `look`, a link signed with the host's key that opens
  the waiting photo for 24 to 30 hours (`photo_look` in the API; the link changes every six hours, so a waiting photo
  rewrites the queue at most four times a day). These are words and pictures people sent: not scrubbed, since they
  are what would be published, and never a source for a listing.
  In place of any address an item carries `sender`, a token (`k` and 16 hex digits, a keyed
  hash of the address): the same person always has the same token, so a run can see three items from one sender,
  and only the host can match it to an address, through the `queue_items` table in the accounts database.
- **Answers come back.** Each run writes `outcomes/<run>.json` to the ops repository:
  `{ "run": "queue-2026-11-30-0541", "pr": 23, "tokens": 180000, "items": [{ "item": "s1a2b3c4d5", "outcome":
  "published", "listing": "p:example", "pr": 23 }] }`. The runs that don't work the queue write one too, with no
  items, for their tokens and so that a failure shows. A run that couldn't finish adds `"failed"`: the step it stopped
  at, one of `setup`, `queue`, `build`, `tests`, `gate`, `push`, `pull-request`, `outcomes`, `time` or `other`
  (`QUEUE_RUN_FAILS`); the morning summary names the run and the step in the site's own words, and anything else the
  file says is ignored. `outcome` is one of `published`, `held`, `declined`,
  `duplicate`, `needs-info`, `no-change` or `failed`; `reason`, for `needs-info` and `declined`, one of `need-page`,
  `need-website`, `need-school`, `not-a-program`, `outside`, `no-own-site` or `closed`; `pr` on an item overrides
  the file's, and only a `published` item takes the file's (a `held` item waits on a pull request only when it names
  one itself); `tokens` is how many model tokens the run used, if it knows. An email (`m…`) can also be `answered`,
  with `reply` one of `how-to-claim`, `delete-account`, `stop-emails` or `add-school`, or `spam` (settled with no
  reply); and `published` with `"reply": "thanks-updated"` for a program's own word (DKIM passed for a listing's own
  domain, about that listing), recorded as a `told` entry. A review (`v…`) can only be `published` (with the pull
  request it is in), `held` (with no pull request: it waits on the Needs-you page and its words stay on the host),
  `declined` or `failed`. Nothing else in the file is read: any words a run writes there are ignored, and an item
  that isn't in the queue (`school:…`, `monthly:…`) is skipped.
- **A manager's items are answered in their own file,** `decisions/<run>.json` in the ops repository:
  `{ "run": "queue-2026-11-30-0541", "items": [{ "item": "x12", "decision": "ok" }, { "item": "f34", "decision":
  "hold", "rule": "child-face" }] }`. `decision` is `ok` or `hold`; `rule`, for a hold, is one of `link`, `contact`,
  `licensing`, `claim`, `other-program`, `child-named`, `child-face`, `readable-name`, `unsuitable`, `not-logo`,
  `no-consent`, `no-look`, `instructions`, `words` or `other` (`CONTENT_RULES` in `src/server/content.php`). `push_run`
  reads each new file once (`content_decisions()`), and a row is rated once. `hold` keeps the row for the owner with
  the rule as its reason. `ok` publishes only while the autopilot is on, and only when the site's own checks agree (the
  text rules for words, offers and pins; the consent tick for a photo), and the manager is emailed; otherwise the row
  waits for the owner with the run's word beside it. Rows a run passed while the autopilot wasn't on publish, ten of
  each kind an hour, once it is.
- **What happens to an item.** `push_run` reads each new or changed outcome file once. A review follows the same
  path: a merged pull request puts it on the site and thanks its reviewer once ("Thanks for your review", with the
  link); declined, held and failed ones email nobody (`told` -6). `declined`, `duplicate`,
  `needs-info` and `no-change` settle the item at once. `published`, and `held` with a pull request, wait for that
  pull request: about 20 minutes after it is merged (time for the site to publish) the item is published; a pull
  request closed without a merge leaves it held. `held` with no pull request waits for the owner. `failed` puts the
  item back in the queue for the next run. A settled or worked item leaves `queue/open.json`. A manager's proposed
  change that a run settles is marked published or declined on `/edit/claims/` too.
- **The sender hears once.** When an item is settled, its sender gets one email in the site's own words (editable
  at `/edit/emails/`, see "The emails" in `docs/emails.md`): published ("It's on the site", the listing's link, and
  an invitation to save their school or follow the listing), duplicate and no-change ("It's already listed", with
  the link), needs-info ("We couldn't confirm this yet", and what would help, by `reason`), declined ("We can't list
  this one", with the rule in a sentence, by `reason`). Held and failed send nothing. The run picks the outcome and
  the reason; the host writes the words, so no sentence a run wrote is ever emailed to anyone. An email's answer
  goes from the site's address as a reply in its own thread, sent by the mailbox script, not by the site's mailer: the
  same words, or the fixed reply the run chose ("Thanks, it's updated" waits for the merge like "It's on the site").
  An email a run holds goes to the Needs-you page with its message and a draft. At most 30 answers go
  in one run, a failed send is tried on the next two, and `queue_items.told` records when each went.
  `"queueReplies": false` in `site.config.json` stops the answers (items still settle). What came in before the
  private queue began (the day it first ran, `queue_since` in the accounts database's `meta`) is worked like the
  rest, but its sender isn't emailed, since the owner answered those by hand; an item already sent to a weekly batch
  the old way counts as done.
- **`/edit/queue/`** (behind the edit sign-in) is a view of all this: what is in the queue as the runs see it, what
  is waiting for a merge, what is held, what settled recently and whether its sender was told, the schools asked for
  (with the addresses of the families who asked from an account, for writing to them when the school goes up; those
  stay on the page), and when the queue was last written. "Not for the run" takes an item off for good (its sender
  isn't emailed). A note added there is an item like the others. **Rush** writes the queue at once and emails the
  owner a reminder to press "Run now" on the queue run.
- **Which schools next.** `node scripts/next-schools.mjs --asks <queue/open.json>` puts the schools families asked
  for right after `data/school-queue.json`, most asked first (see "Five schools a day").

## The autopilot gate

The research runs (the queue run, five schools a day, the weekly run and the monthly check) end in a pull
request. The gate decides whether one can publish without Josh reading it. It keeps the site's one publishing rule,
that only a provider's own page or word is published, and replaces Josh's review with a check a script can repeat: every
changed value must come with a quote, and the gate re-reads that quote on the page it came from. Anything it can't
confirm, or anything on the hold list below, waits for Josh.

**Where it stands.** `data/autopilot.json` on `main` holds the switch: `off` (the gate does nothing), `shadow` (it
comments on each run's pull request and merges nothing; Josh merges by hand) or `on` (a run's pull request with nothing
held and the tests passed is merged at the next hourly merge, and the site publishes). It starts in `shadow`. A run's pull request can never
change the switch: the file isn't on the gate's allowlist, so touching it holds the pull request. The owner turns it from the Needs-you page (below).

### The evidence file

Every run that changes data writes one file, `evidence/<branch>.json`, committed on the pull request's own branch (the
build ignores the folder). It holds one record per item worked, an item with no data change included, so its sender
can be answered:

```
{
  "run": "queue-2026-11-30-0610",
  "items": [
    {
      "item": "s1a2b3c4d5",
      "kind": "update",
      "listing": "p:example-program",
      "outcome": "published",
      "fields": [
        { "path": "hours", "old": "3:00 to 6:00 pm", "new": "3:00 to 6:30 pm",
          "source": "https://provider.example/after-school/",
          "quote": "After School runs from dismissal until 6:30 pm.", "read": "2026-11-30", "how": "fetch" }
      ]
    }
  ]
}
```

- `item` is the queue item's id. Work that didn't come from the queue uses `school:<id>`, `monthly:<listing>` or
  `link:<listing>`.
- `kind` is one of `update`, `new-listing`, `new-school`, `link`, `date`, `note`, `told`, `review`, `news`.
- `outcome` is one of `published`, `held`, `declined`, `duplicate`, `needs-info`, `no-change`.
- A review gets one record of kind `review` with no fields: `{ "item": "v1a2b3c4d5", "kind": "review", "listing":
  "r:v1a2b3c4d5", "outcome": "published" }`. Its words are the reviewer's, never a quote, so nothing else goes in.
- `listing` names the record: `p:<program id>`, `s:<school id>`, `c:<camp id>`, or `d:<school id>` for a school's
  entries in `data/school-dates.json`.
- `path` is where the value sits in that record, written the way the gate writes it: keys joined by dots
  (`register.nextTerm`, `schools.meredith.relation`), and an element of a list of objects by its key in brackets
  (`register.dates[2027-01-15]`, `sources[https://provider.example/camp]`, `updates[2026-11-04]`, `clubs[Chess]`).
  The key is the element's `id`, `date`, `url`, `name`, `day`, `on` or `match`, whichever every element has; a repeated
  key gets `#2`. A list of plain values (`types`, `daysOff.dates`) is one value. `""` is the whole record, for a new
  listing written in one go. A record for a part covers everything inside it, so `schools.meredith` covers its
  `relation` and `note`.
- `old` and `new` are the values before and after, `null` for nothing. They must match the data exactly, bookkeeping
  dates aside.
- `quote` is copied from the page, 300 characters at most, and contains the numbers, times, prices and dates that are
  new in `new`. Several records for the same path count together, when one stretch of a page doesn't hold them all. A
  new link needs no quote; the page it is on is the source.
- `source` is on the listing's own website, already one of the listing's addresses, on a school's own site, or on the
  City's own pages, as the rules have always allowed.
- `how` follows `data/reading.json`: `fetch`, `browser` or `person`. The gate reads the page the stricter of the two ways.
- Bookkeeping fields need no record: `lastVerified`, `checked`, `read`, `looked`, `lastReviewed`, a school's `added`,
  `seen` in `data/reading.json`, a camp's `check` notes, and the places `scripts/geocode.mjs` writes to
  `data/geo.json`. An `updates` note's own `date` is a label and needs no quote.
- Nothing a parent or manager wrote goes in the file. A suggestion is a reason to look and never a source. The one
  exception is a manager's proposal recorded as a `told` entry, in the program's own words.

`node scripts/gate.mjs --local --draft` writes a record for every changed value that has none yet, with the path, old
and new values filled in, for the run to add the source, quote and how.

### What the gate checks

`.github/workflows/autopilot.yml` runs on every pull request whose branch starts with `queue-`, `new-schools-`,
`weekly-` or `monthly-check-`, from this repository (never a fork) and from the account the runs use. Anything else is
left alone. It runs the workflow file and the gate as they are on `main`: GitHub's test merge of the pull request is
fetched as git objects and only the allowlisted data files are copied out of it, next to `main`'s code. Nothing else
from the pull request is run. Then `scripts/gate.mjs`:

1. **Paths.** Only these files may change: `data/programs.json`, `schools.json`, `camps.json`, `geo.json`,
   `reading.json`, `news.json`, `school-dates.json`, `reviews.json`, and the one evidence file. No `id` changes, and no
   program, school, camp, review, `told` or `asks` entry is removed.
2. **Coverage.** Every changed value has a record with the same path, old value and new value.
3. **Source.** Each record's source is allowed, as above.
4. **Re-read.** The gate fetches the source (in a browser where `data/reading.json` says so, honoring robots.txt as the
   pre-read does), finds the quote on the page with spaces and punctuation ignored, then finds the new numbers,
   times, prices and dates inside the quote. A page only a person can read, a PDF, or a Google Drive file can't be
   re-read, so its change waits. New links must open, or be linked from the page read, or be where the old link now
   leads. A new email address must be on the page.
5. **The hold list,** below.
   **Reviews** (Phase 6) are checked their own way. A new entry in `data/reviews.json` must carry the site's own id
   (`r:<id>` is its key), the fields an entry has and no others, a program and a school the site lists, 1 to 5 stars,
   and a "review" record in the evidence. The text rules ("moderation" and "reviewWords" in
   `scripts/gate.config.json`: a link, contact details, an accusation, strong language, a name, words to an AI) are
   the site's own. Then the gate asks the site (`groups/api.php?action=review_check&id=…&sum=…`, the sum of the
   entry's values, `reviewSum()`) whether this is the entry the reviewer sent and whether it still passes the site's
   checks; the answer is yes or no, never why or who, and a held review's reason is on the Needs-you page, not in the
   comment. A review the site can't be asked about waits. A run never changes or removes a published review. With
   `--split`, a held review goes into no pull request at all: the run answers it `held`, and its words stay on the host.
6. **Size.** No more than `limits` in `scripts/gate.config.json` for that kind of run.
7. **Build and tests.** A second job builds and tests `main`'s code with the pull request's data, with a read-only
   token. A note from the build that the change caused, or a failed test, holds it.

It then posts one comment in plain words (what would publish, what is held, and why; replaced, never repeated, when the
pull request changes) and adds the label `needs-josh` when anything is held. Its comment carries the commit it checked
and whether the tests passed. In `on`, with nothing held and the tests passed, it adds the label `autopilot-ready` (and
takes it off when that stops being true). It merges nothing itself: the hourly merge does (below).

**One held item mustn't block forty good ones.** A run checks itself before opening its pull request:
`node scripts/gate.mjs --local` compares the working tree with `main` and prints, listing by listing, what would
publish and what is held and why (exit code 1 when anything is held). `--split <dir>` then moves the held listings out:
the working tree keeps only what would publish, and `<dir>` gets main's data with only the held listings' records (the
same keys the gate uses: `p:`, `s:`, `c:`, `d:`, `n:`, `r:`, `geo:`, `reading:`) and their evidence, as
`evidence/<branch>-held.json`. Each file is written back in its own layout (two-space or one-space JSON); a file
laid out any other way (`data/school-dates.json`), or a pull request held as a whole, is left for the run to split by
hand. The run opens the clean pull request from its branch and a second one, `<branch>-held`, from `main` with `<dir>`
laid over it; the gate holds that one for Josh. If the gate still holds something in the clean one, it holds the whole
pull request and names the listing to split out.

### Publishing in batches

Every merge to `main` starts a full build and test, so the autopilot merges once an hour, not once per pull request
(`scripts/merger.mjs`, run by `.github/workflows/autopilot.yml` on the hour's schedule, at about 17 minutes past; or by
hand: Actions > Autopilot gate > Run workflow, with "merge" set to `yes`). Only with the switch `on`:

1. **What is ready** (a read-only job): every open pull request labeled `autopilot-ready` and not `needs-josh`, oldest
   first, ten at most, whose gate comment, by the workflow's own account, names the commit it is at now and says its
   tests passed. GitHub's test merge of each with today's `main` is laid on `main` in turn, in a scratch worktree; one
   that clashes with another in the batch waits for the next hour, on top of them. Each test merge must change only the
   gate's allowlisted data and the run's evidence file, or it is held. `main`'s code and the combined data are then
   built and tested together, once. Nothing from a pull request is run.
2. **The merge** (a job with a write token): if the build and tests passed and `main` hasn't moved since, each pull
   request in the batch is squash-merged at the commit the gate checked (one that moved, or lost its label, is left
   for the next hour), and `publish.yml` is started once. If they failed, nothing is merged: each pull request in the
   batch is labeled `needs-josh`, and the gate's comment says it was held at the hourly merge and why, so it shows on
   the Needs-you page.
3. **Tidying:** a pull request whose head moved since the gate looked loses `autopilot-ready` (the gate looks again
   when it changes); one that no longer merges into `main` cleanly goes back to the gate, which holds it for the next
   run to bring up to date; and up to five open run pull requests last judged while the switch was `shadow` or `off`
   are sent to the gate again, so the ones opened before the switch was turned on can be ready by the next hour.

The judge job no longer needs write access to the repository's contents; only the merge job has it. With the switch
at `shadow` or `off` the hourly merge does nothing. Tests: `tests/cases/08-autopilot-merge.mjs`.

### What waits for Josh

The working definition of "suspicious". Anything that matches a row is held, with the row's reason in the comment.
Everything else publishes. The rows marked *later* need the private queue, the mailbox or the accounts database, and
arrive with those phases.

| Area | Held when |
|---|---|
| Any change | It touches a file off the allowlist, changes an `id`, or removes a program, school, camp, review, `told` or `asks` entry |
| Any change | A changed value has no evidence, the quote isn't on the page, or the quote lacks the new value's numbers |
| Any change | The source isn't the provider's own site, a school's own site or the City's listing, or the page can only be read by a person (or is a PDF) |
| Any change | The build prints a note the change caused, or a test fails |
| Any change | The run went over its size limit: 15 listings in a queue or weekly run, 6 schools in a schools run, 40 values in a monthly check |
| New listing | Its website is new to the data and nothing vouches for it (no school site, City listing or existing provider's page quoted names it), and the domain is under two years old or the site shows no Philadelphia street address or phone |
| New listing | The site is a bare payment or sign-up page, or doesn't read as a children's program |
| Pickup and on-site links | No quote names the school, a school has dropped off a provider's pickup list, or a school link is removed |
| Closing | A program or camp reads as closed. A run never removes one |
| What a program told us | A field the program told us would change to what its site says (it becomes a question to its managers instead), a `told` entry is added (the gate can't see the message until Phase 2), or an `asks` question is added (until the gate can tell claimed listings apart) |
| Prices and hours | A price moves by more than 40 percent, flips between free and paid, or a closing time moves by more than an hour |
| Dates emailed to parents | The date is past or more than 12 months out, the quote gives no year and the date is more than 120 days away, the quote holds two dates for one label, or the change moves or removes a date that may already have been emailed (`register.dates`, `daysOff.dates`, a camp's `dates`, a school's `dates`) |
| Notes emailed to parents | An `updates` note or a school's date title isn't built from an approved template (`noteTemplates` in `scripts/gate.config.json`), or a school date was sent in by a parent |
| Schools | A new school has fewer than two confirmed programs, or it's a charter with no calendar of its own |
| Email addresses | A new address is at a free-mail domain (Gmail and the like), which can be a person's own |
| Hidden instructions | A quote, a new value or a page read addresses an AI, or asks to skip a rule |
| What's new | Always, for now: it's the site's own words, with no provider page to check |
| Reviews | It names a person, makes an accusation (safety, harm, discrimination, a crime, licensing), holds contact details or a link, uses strong language, or addresses an AI; or the site says it isn't the entry the reviewer sent or its own checks hold it. A run never changes or removes a published review |
| Reviews | The account is at the listing's own email domain or another program's, has already reviewed that listing, or is under a day old with no saved school or plan. Checked by the site when the review comes in (`review_holds()` in `src/server/content.php`); such a review never reaches the queue. `"reviewNewAccount": "wait"` makes the last one a day's wait instead |
| Manager words, offers and pins | A link or contact detail, a licensing or accreditation claim, a guarantee or a "best" claim, another program named, or a child named. The run rates it; the site checks the text again before it applies an "ok" |
| Photos | A child's face up close, a readable name (a jersey, a name tag, a sign-in sheet), or anything unsuitable; a logo that isn't plainly a logo; a photo whose manager didn't tick that everyone shown agreed; or one the run couldn't open |
| Claims | A shared or free-mail address with no code proof, two accounts from different domains claiming one listing, or a proposal to change the website, phone or email within a day of a claim by code (the queue run holds that one) |
| `data/reading.json`, `data/geo.json` | A page's reading is loosened or removed; a map place already there moves, or a new one isn't in Philadelphia |
| Mail from people | Text that addresses an AI or asks to skip a rule, legal words (lawyer, subpoena, takedown), a safety complaint, a request for someone's data, a refund or payment dispute, a school district or City address, the press, or a sponsor or partner inquiry (the last, legal and safety also push to Josh's phone at once). Checked by the host when the email comes in, before any run sees it (`mail_hold_reason()` in `src/server/mail.php`) |
| The sender | More than three items from one sender in a day, an item that runs down another program, or an update to one program sent from another program's email domain: the queue run answers these `held` (its prompt, `docs/runs/queue-run.md`), so they wait for Josh with no pull request |
| Payments | *Later* (Phase 7) |

**Where the numbers live.** The data thresholds and the templates are starting values in `scripts/gate.config.json`.
Sender and spam thresholds will live in a private file on the host, because the repository is public.

**Tuning.** After a month, review the holds. A rule that held ten items which Josh approved every time gets loosened.
A merged change that Josh undid becomes a new test fixture in `tests/cases/06-gate.mjs` and, where it fits, a new row.

### Shadow mode, the replay and the report

Phase 1 ends with the switch at `shadow`, and Josh keeps merging by hand for five days. The switch to `on` needs at least
30 changes judged, and none that the gate would have merged and Josh rejected.

- **The shadow report.** `node scripts/gate.mjs --report` (or Actions > Autopilot gate > Run workflow, with "report"
  set to `yes`) lists each run's pull request with what the gate said beside what Josh did, and says whether the test
  for switching on has been passed.
- **The replay.** `node scripts/gate.mjs --replay 10` runs the checks on run pull requests that were already decided,
  from #10 on. Ones from before evidence files have none, so the replay builds what it can: for each changed value it
  reads the listing's own stored pages (its sources, pickup lists and links) and looks for the shortest stretch, 300
  characters at most, that holds every new number, or for the words a value added. It reports the share it could
  verify. The build and tests aren't repeated, since the code has moved on.

### The Needs-you page, the log, Undo and the switch

Everything waiting for the owner is on one page built for a phone, `/edit/needs/`, behind the same sign-in as `/edit/`
(`src/server/edit-needs.php`, with the shared code in `src/server/autopilot.php`). It replaces reading the inbox for
these. Approve, Decline, Undo and the switch write to GitHub with the key file `/edit/` publishes with
(`phillyafterschool-github.key`), whose token needs **Contents** and **Pull requests**, read and write, on this
repository; only a site admin's account sees those buttons (an editor sees the page and can decide claims, photos and
words as on `/edit/claims/`). Without the key file the page says so and shows what the accounts database holds.

- **Run pull requests.** Open ones the gate held (the label `needs-josh`), and, while the switch is `shadow` or `off`,
  every open one, so they can be merged from a phone. Each shows the gate's reason in a sentence and its comment.
  Only a comment by the workflow's own account (`github-actions[bot]`) with the gate's mark counts: anyone can comment
  on a public repository, and a look-alike is ignored. **Approve** squash-merges the exact commit shown (refused if
  the pull request moved since), with the key rather than a workflow's token, so GitHub starts `publish.yml` by
  itself. It refuses a pull request that changes `data/autopilot.json`, or anything but the allowlisted data and its
  evidence file: those are read and merged on GitHub. **Decline** closes it unmerged; its queue items then show as
  held. **Open on GitHub** is the pull request.
- **Held items from the accounts database:** claims waiting for a yes (with how each came about: a code that ran out
  untyped, a code typed while someone at another address holds the listing, or a request to check), photos, words,
  offers, pins and links, premium sign-ups not yet premium, and queue items a run held. A manager's item shows what a
  run said about it ("A run would publish this", or the rule that held it); while the autopilot is on only the held
  ones are here, since the rest publish when a run passes them. A claim whose code is still good isn't here yet.
  Their buttons post to `/edit/claims/` and `/edit/queue/`, which send their emails as before and come back to this
  page (`back=needs`).
- **Reviews** the site's checks, a run or a closed pull request held (Phase 6): the review, its stars, program and
  school, the account that wrote it, and the reason. **Publish** (a site admin's account, with the key file) adds its
  entry to `data/reviews.json` on main as one commit, so the site rebuilds, and its reviewer is thanked on the next
  hourly run; **Decline** keeps it off the site and emails nobody.
- **Mail for you,** shown to a site admin's account only: each email the hold list or a run kept, opened, with who
  sent it, why it's here, what the host worked out (its domain, whether its signature checks out, which listing's
  website it shares, the account's role, whether it answers outreach), and a draft to edit. **Send** queues the reply,
  which the mailbox script sends from the site's address in the email's own thread within ten minutes. **Done, no
  reply** settles it. **Give it to the runs** puts it in the private queue (not for one marked suspicious).
- **The shadow report,** while the switch is `shadow`: the same sums as `node scripts/gate.mjs --report`, from the
  gate's comments, and whether the test for switching on is passed.
- **The spot-check:** ten of the changes the autopilot merged in the last seven days, picked at random and the same
  ten all week (a hash of the week and the change), each with **Looks right** (noted in `ap_changes.looked`) and
  **Undo…**.
- **The switch:** the mode, with a button for each of the other two. A button makes one commit to
  `data/autopilot.json` on main (its `about` line kept, `[skip ci]` in the message, since nothing on the site changes).
  Switching on before the shadow test is passed needs a box ticked. The gate reads the file from main and holds any
  run's pull request that touches it.
- **A failed publish** shows at the top, with the link to the run on GitHub.

**The log,** `/edit/autopilot/` (`src/server/edit-autopilot.php`): every run pull request merged, newest first, by the
autopilot or by hand, with what it changed from its evidence file at the merge (the listing, the value before and
after, the quote and the page) and **Undo…**, which asks once more. Undo has GitHub make the revert itself (the GraphQL
`revertPullRequest`, the same as the Revert button on a pull request) and merges that with the key, so the site
republishes in a few minutes. A revert that clashes with a later change is refused by GitHub and nothing changes: use
the Revert button on GitHub, which shows the clash. An entry says when an email about the change may already have
gone out, because an email can't be recalled: senders told "it's on the site" (from `queue_items`), and, for dates,
notes and new schools, a morning send at 8 since the merge.

**Where it's kept.** The pages look at GitHub at most every five minutes ("Look again" asks now): the runs' pull
requests changed since the last look, the gate's comment on each, who merged it, and each merged one's evidence file,
into `ap_prs` and `ap_changes` in the accounts database. Only provider quotes are in them, as in the evidence files.
The morning summary (`docs/emails.md`, "The morning summary") reads the same tables.
