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

## Schools that aren't covered yet

`/schools/request/?s=ID` is the page for a school the site knows about (from `data/all-schools.json`) but hasn't
covered. "Ask for this school" counts a vote. Under it, "Email me when it's added" takes a first name and an email
address and sends them straight to Klaviyo with the browser key, onto the same list as the dates emails, with
`signup_place: school_request`, `waiting_school_name` (the latest school asked for) and the school's id appended to
`waiting_schools`. Nothing sends the "it's here" email yet: when a school goes live, build a Klaviyo segment where
`waiting_schools` contains its id and write to it.

## Terms of use

`termsPage()` in `build.mjs` is a draft. It is built into the preview copy only, with a banner saying so, until
`"termsLive": true` is set in `site.config.json`; then it is written to `/terms/`, linked from the footer and added
to the sitemap. `termsOperator` names who runs the site in the liability line (the site's name if unset), and
`termsUpdated` sets the date shown.

## Summer camps

Summer camps are their own list, in `data/camps.json`, and their own page, `/summer-camps/`. Nothing in the file is tied
to a school or to the after-school pages. The file has:

- `season`: the summer most listings describe (`2026`). A camp whose own `season` is later shows a yellow
  "Summer 2027" pill; the rest say "2026 details".
- `camps`: one entry per camp. `id`, `name`, `what`, `types` (the same list as programs, plus `nature` and
  `daycamp`), `ages` (as the camp states them), `ageMin` and `ageMax` (years; the grade picker is worked out from
  them: pre-K is 3 and 4, kindergarten 5, 1st grade 6), `season`, `weeks`, `hours`, `extended` (before and after
  care), `cost`, `weekly` (the lowest regular full-day week, a number), `price` (`free` or `paid`), `aid`,
  `address`, `neighborhoods` (grouped into parts of the city by `CAMP_AREAS` in `build.mjs`; leave it empty for a
  camp that runs all over), `phone`, `website`, `registerUrl`, `signup` (what the camp says about when sign-ups
  open), `note` (the yellow caution), `program` (the id of the same provider's school-year listing), `sources`,
  `checked`.
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
4. Commit to `main`.

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

The header has four groups that open (Programs, Search by, Build a schedule, Suggest), then About and the
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
and an `end` for a break). Under each day it names the programs whose `daysOff.dates` include that date, and
below that every program with `daysOff`. Past days drop off at build time and are hidden by the page between
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

**A day-off plan.** On the same page, "Build your day-off plan" lets a family choose, for each day off, where a
child will be: one of the camps posted for that date, another listed program (flagged as not posted for that
date), or at home. Picks are saved with the rosters in the browser, per child, and gathered in a list. There is
no copy or email button: the plan leaves the page as a card. "Make it a card" draws the schedule as a picture in the day-off colors, with an optional
note and photo (the photo never leaves the device) and its own QR code: `/d`, which `.htaccess` sends to the
day-camp page tagged `utm_source=dayoff_card`. Each pick fires `pas_dayoff_pick` (program_id, day); saving, sharing
or printing the card fires `pas_board_share` with board `day_camp`.

The day-off page has its own look: a yellow band with navy type (`.band.dayoff` in the stylesheet) and its
own drawing, `dayScene()` in `build.mjs`: the school shut, the bus asleep, a swing and a kite going up. Its
share picture is `src/static/share-days-off.png`; any page can name its own with `shareImage` in `layout()`.

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
- **The feed.** The build writes `data/alerts.json`: every upcoming `register.dates` entry and every district day off, each
  with `sendOn`, the day it is announced. That is the last send day (`alerts.sendDay`, 0 for Sunday) that still leaves
  the notice in `alerts.lead` (1 day for a sign-up date, 10 for a day off). So adding a date to a program's
  `register.dates` is all it takes to get it emailed. The feed also has an entry for each program's own day-off camp (sent
  only to that program's followers, and skipped for anyone whose school email already lists the camp) and for each
  item in a program's optional `updates` list: `"updates": [{ "date": "2026-11-04", "text": "Fridays are full for the winter session." }]`.
  An update goes out on the first send day on or after its date, to the program's followers only, and is dropped two
  days after that. So an update merged later than its send day is never sent: give it a date a few days ahead, or
  change the date when you merge. The monthly check dates its notes a week out for that reason.
- **The daily job.** `.github/workflows/alerts.yml` runs every morning, builds the site and runs `scripts/send-alerts.mjs`.
  It reads the list from Klaviyo and records one "School dates" event for each person who is due an email. Someone who
  just joined gets one "welcome" email the next morning with every date already announced; after that they get the
  weekly one. A missed morning is made up on either of the next two, and Klaviyo ignores a repeat of an event it already
  has, so nobody gets the same email twice. The job never prints an email address, because its log is public.
- **The flow.** In Klaviyo, the flow "School dates email" is triggered by that event and sends the template in `email/`.
  It only fires for events that carry the right `token`, and only for people on the list.

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
  `/managers/` loads analytics with the tool masked in recordings; the only event is `pas_claim` with a `step`
  (`picked`, `claimed`, `waiting`, `address_mismatch`, `refused`, `change_sent`, `photo_sent`). There are no student accounts, on purpose:
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
