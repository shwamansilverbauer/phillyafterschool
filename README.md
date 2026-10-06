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

## Edit a listing

Open `data/programs.json`, change the fields, set `lastVerified` to today's date, and commit to `main`.

Fields worth knowing:

- `grades`: a range like `"K-5"` or `"PK-3"`, a single grade like `"8"`, or `null` when the provider doesn't publish grades.
- `types`: required. One or more of `aftercare`, `music`, `art`, `movement`, `stem`, `academics`, `games`, `clubs`, `rec-center`.
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
- `schools`: one entry per school the program serves:
  - `relation`: `onsite`, `pickup` or `nearby`. Use `pickup` only when a source names the school.
  - `note`: a caution that applies to that school only.
  - `distance`: optional, e.g. `"three blocks from Nebinger"`.
  - `registerUrl`: optional, for providers with a separate sign-up link per school.
  - `price` and `cost`: optional, when the price is different for this school (free through a partnership, say). They replace the
    program's own `price` and `cost` on this school's page, and the program page shows the school's `cost` under that school.
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

## Finding programs: filters, types and the school finder

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
and theme (Music Prodigy, Mathlete, The Da Vinci, Move It or Lose It, Jack of All Trades). The themes are the
`THEMES` list near the top of `build.mjs`: each has a name, a one-line blurb and the program types it draws
from, and `mix: true` makes it try for a different type each day. To add a theme, add a line. A roll places one
program a day, only on days the program lists, only in classes offered that day, and only for the grade chosen
(the grade is optional and is never saved or sent). It spreads across programs and classes before it repeats,
and treats a program that doesn't publish its days as a last resort, saying so when it uses one. Replacing a
week someone built by hand takes two taps, and "Put back what I had" restores it until the page is reloaded.
Each school page links in with `board/?roll=<school id>`. A roll fires `pas_theme_week` (theme, school, method
of `roll`, `again` or `undo`).

**A day-off plan.** On the same page, "Build your day-off plan" lets a family choose, for each day off, where a
child will be: one of the camps posted for that date, another listed program (flagged as not posted for that
date), or at home. Picks are saved with the rosters in the browser, per child, and gathered in a list that can
be copied or emailed. "Make it a card" draws the schedule as a picture in the day-off colors, with an optional
note and photo (the photo never leaves the device) and its own QR code: `/d`, which `.htaccess` sends to the
day-camp page tagged `utm_source=dayoff_card`. Each pick fires `pas_dayoff_pick` (program_id, day); saving, sharing
or printing the card fires `pas_board_share` with board `day_camp`.

The day-off page has its own look: a yellow band with navy type (`.band.dayoff` in the stylesheet) and its
own drawing, `dayScene()` in `build.mjs`: the school shut, the bus asleep, a swing and a kite going up. Its
share picture is `src/static/share-days-off.png`; any page can name its own with `shareImage` in `layout()`.

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
that publish no price and replaces a listed one. Those figures stay in the browser and never go into a share link.

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
roster a program goes on. Rosters are stored in the visitor's own browser, and each share link carries one
child's week in the address, so nothing about them is stored on the server. There are no accounts.
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

## Accounts and share groups (pilot)

A share group lets a class, a carpool or a few friends see each other's after-school weeks. It is the only part
of the site with accounts and the only part that stores anything about a child on the server.

- **Turning it on.** `"groups": { "pilot": true }` in `site.config.json`. While `pilot` is true nothing links to
  it: the pages are `/account/` and `/groups/`, and the "Share with a class or group" block on the roster page
  only shows in a browser that has visited one of them. Remove `groups` to take the whole thing out of the build.
- **How it works for a parent.** Sign in on `/account/` (an emailed link and a 6-digit code, no password), make a
  group there and get a code. On Build your week, "Add this week to a group or class" asks for the code and the
  child's first name. The group's creator approves each person; until then they see nothing. A teacher joins
  the same way as "view only". A shared week updates itself from the device it was shared from.
- **What is stored.** An account is an email and a first and last name (both required before making or joining
  a group; only a group's creator sees them). A child in a group is a first name and the
  program ids (and a class, only when the program lists it) on the current and upcoming weeks. Nothing else:
  the server drops free-text notes, schools and anything it doesn't recognise. Group codes are kept encrypted.
- **Where.** `src/server/groups-api.php` is the whole server side; the build copies it to `groups/api.php` with
  four settings (site name, address, sender, the date groups expire). It keeps one SQLite file and a key in a
  folder named `phillyafterschool-data`, next to (not inside) the public folder on the host. Deleting that
  folder in the host's file manager wipes every account and group. It is not in git and not backed up by this
  repository.
- **Limits and expiry.** Links and codes last 15 minutes and work once; five wrong codes kill a code; three
  sign-in emails per address per 15 minutes. A device stays signed in 30 days. Every group is deleted two weeks
  after `lastDay` in `data/days-off.json`.
- **The email list.** `"klaviyoList"` under `groups` names a Klaviyo list ("Account holders"). When an account's
  name is saved for the first time, the browser subscribes that email, first name and last name to it with the
  public key (the same call the dates form uses), sets the profile property `has_account`, and tells the server
  so it isn't done twice. An ad blocker can stop the call; it is tried again at each sign-in until it works.
  Nothing about children or groups is sent. Leave `klaviyoList` out to turn this off.
- **Emails it sends.** The sign-in email, "someone asked to join" to a group's creator (the adult's first name
  only), and "you're in" to the person approved. They go out with PHP `mail()` from the contact address.
- **Privacy.** The account and group pages load no Google Tag Manager or Clarity (`quiet: true` in `layout`),
  are `noindex`, and are left out of the sitemap. `src/groups.js` runs only on those two pages and the roster
  page. The privacy page's "Accounts and share groups" section describes all of this; keep the two in step.
- **Analytics.** Adding a week to a group fires `pas_group_share` (method `code` or `my_group`) on the roster
  page. No names, emails or group ids are ever sent.

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

`dist/data/programs.json` is published with the site, so a scheduled check can read exactly
what the site shows, compare each listing to its sources, and report what changed. Review
the report and merge the changes you agree with. Busy times: March to May (next year's registration opens)
and late August (rec centers post their listings).
