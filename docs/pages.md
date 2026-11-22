# The public pages

## Schools that aren't covered yet

Every school in `data/all-schools.json` that isn't covered has a page of its own at `/schools/ID/`
(`uncoveredSchoolPage()`): the after-school programs within a mile, and the weekend classes and summer camps within
two, measured in a straight line from the school's coordinates, plus the nearest covered school. It never says a
program picks up from the school, because nobody has checked. A page with fewer than three things nearby is marked
`noindex` and left out of the sitemap, so search engines aren't handed near-empty pages; the rest are indexed. The
schools page links to all of them. `/schools/request/?s=ID`, the old address, forwards to the school's page, and with
no school chosen it is still the search box. The preview copy has no school pages and keeps the one shared page.

On a school's page, "Ask for this school" needs a free account, so each family counts once however many times the
button is pressed and scripts can't inflate a count. Signed in, the button asks straight away (`POST
groups/api.php?action=school_ask`, one row per account and school in `school_asks`); signed out, it opens the site's
sign-in in place (`src/groups.js`, fetched on demand), and signing in with `next = a:<school-id>` counts the ask as part
of signing in, the way a Follow button's `f:` does. A new ask is logged to `phillyafterschool-school-requests.log`
(which `/edit/queue/` counts), emailed to the owner with the number of families so far, and the browser tells
Klaviyo with the account's address: `signup_place: school_request`, `waiting_school_name`, and the school's id appended
to `waiting_schools`. When the school is added with `"added": "YYYY-MM-DD"` in `data/schools.json`, the morning job
emails everyone waiting for it, once ("you asked to be told when this school was added"). The old address,
`schools/request/send.php`, answers 410. `GET …?action=school_ask&s=<id>` says whether this account asked and how many
have; the page shows the count.

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

## Program pages

Every program gets its own page at `/programs/<id>/` (for example `/programs/zhang-sah/`), built from the
same record as its cards. `/programs/` lists them all, in a section per kind of program (each under the first of
its `types`, A to Z inside; `typeSections()` in `build.mjs`, which the weekend, day-camp and summer lists use too),
with no strip of section links over them: the Type row of the filters holds the same categories (the type,
weekend, day-camp and summer lists are the same; the neighborhood and by-day pages keep a strip, `pageNav(jumpNav())`,
over their kind sections).

**What stays under the menu bar.** Anything that switches between views of a page is sticky, so it is the page's
navigation wherever you are on it: `.pagenav` holds a list page's jump links and, on the day-camps page, the
Programs · The days switch above them (the jump links are the visible view's, refreshed on a switch); a planner's
heading row with its view switch (`.year-view-head`: the week builder's The week · Budget planning · Make it a
card · Keep & share, the summer and days-off planners' List · Calendar · Grid · Share/Save with their "Pick your
visual mode!" tag (`.vs-pick`), the calendar's views) sticks the same way.
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
→ the summer planner) and plain buttons for the provider's own sign-up and website. The hero is only the name,
the line and what it runs, as a row of colored pills (`runsStrip()`, one color per kind, the same colors as the
All programs page). Everything else general sits right under it as one block, the **spotlight** (`#snapshot`,
`spotlight()`, "Program spotlight — The basics, at a glance."): a card with a yellow left edge (`.spot`) holding
a grid of callouts (`spotItem()`, `.spot-item`), each an icon in a sky square (`SPOT_ICON`), a small uppercase
label and the value — the type, where it is (address, neighborhood under it), the schools it serves with a
colored dot for the kind of tie, grades, pick-up time, reviews, spots, the Claimed mark and the date checked.
Spots and Claimed (`.spot-live`) stay hidden until `site.js` fills them, so the grid never shows an empty
callout. A camp of its own (`campPage()`) has the same shape: a bare hero, a "Camp spotlight" (type, where,
ages, price, dates, checked), then its Follow box. The sticky strip under the menu bar (`jumpNav()`) jumps
between the spotlight, the sections, Schools and Reviews. The sections are `kindSection()` in
`programPage()`; the follow box ("Follow it, or save it for later", `#follow`, `.follow-first`) sits under the
spotlight, since following and favorites are what a parent does most on the page (the Summer section no longer
has a box of its own; "summer" is one of the parts the page's box can follow, see "Follow and favorites"); the
claim box (`listingTools()`: "Run this program?", a "Claim this listing" button and "Suggest an update") sits
under the sections, and once `site.js` learns the listing is claimed (`?action=claimed`) it says "Claimed by the
people who run it" and keeps the update link (`.claim-cta.is-claimed`).

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
rows of the same shape, `listRow(kind, …)`: the name and a line about it on the left, and on the right a stack
of small labeled cards (`mini()`: Type, Schools, Area, Grades, Days, Dates…) with the facts that matter for that
part of the year (the schools and grades after school; Saturdays or Sundays for a weekend class; the breaks a
day-camp program has posted, "Winter break (3 of 5 days) · +2 more"; the weeks, ages and grades for a summer
camp). The cards are quiet on purpose, plain words with a colored dot for the kind of school tie
(`servedLines()`), so the name is what the eye lands on; on a phone they stack under the line. The distance
label, when someone sorts by distance, is a "From you" card. Nothing on a row is a button: the row is the way
to the listing's page, and every list opens with the way into its planner (`heroGo()`).

## Finding programs: filters, types and the school finder

The home page says each thing once: the hero (headline, one line, then the search, below), then two "Start here" boxes, one for parents
(build a schedule, then create an account signed out or the to-do list signed in, so the box always has two rows)
and one for program managers (claim a listing, add a program or camp; a parent who is signed in doesn't see it:
the inline script adds `html.parent` when the device holds `pas-in` and `pas-role` = parent, and the Parents box
takes the row with its two rows side by side), then "What's your kid into?" (the type chips), then "Get reminders" (one line and a button to `/alerts/`, signed out
only), then "the story" (`#story`: a few lines on who made the site and why, with "Read the story" to `/about/` and
"Help us make it better" to `/suggest/`). The explainers (how programs are sorted, every listing is dated and sourced, who built this) are on the
About page, which reads like a blog: six rows (`aboutPage()`), each a heading and its words on one side and a
drawing on the other, sides alternating (why it exists, what it is for, how programs are sorted, dated and
sourced, how to help, reviews), with the ids `#how`, `#what`, `#sorted`, `#sources`, `#corrections`, `#reviews`.
The first row's picture is the two who made it: their photo (`src/static/about-us.jpg`, served at `/about-us.jpg`,
1000px wide). To change it, replace that file with another 4:3 photo. Each box has a picture of who it is for (a grown-up with a child, a person with a clipboard), drawn in
`WHO` in `homePage()`.

**The home page search** (`heroSearch()` in `build.mjs`, the `[data-hero-search]` block in `site.js`) is four tabs
above one box, so the first thing a parent sees is that the site covers the whole year, not only after school:
After-School, Days Off, Summer Camps, Weekends (a tab is left out while its list is empty). After-School is the
school-or-program finder (with its "no match: tell us about it" line as the one way to ask for a school, and without
the "Your school" shortcut the finder shows elsewhere: `data-no-mine`). The other three ask where you live, a ZIP code
or a neighborhood (below), and open that kind's list (`/summer-camps/`, `/weekends/`) with the closest first, through
the same question each list starts with. Days Off also asks which day off: the days still ahead, the next one picked
(it opens that day's page), and "All days off (plan the whole year)" first in the list (it opens `/day-camps/`). Under
each box, "Or browse every…" opens the list as it is. Sending the box empty opens the list in its own order and
forgets the place. The tab someone last picked is the one that opens next time (`pas-hero-tab`): a few lines of
script right under the tabs set it before the page is drawn, so it doesn't flicker. Without scripts the tabs are
links to the four lists and only the finder shows. The tabs are a proper tab list for screen readers, and the arrow
keys move between them. On a phone they sit two by two. Analytics gets `pas_hero_tab` (hero_tab) when a tab is picked
by hand and `pas_hero_search` (hero_tab; place: zip, neighborhood or none; day_off: next, later or all) when the
search sends someone to a list; never which ZIP code or neighborhood. The words are on `/edit/` like any other
sentence.

**A ZIP code or a neighborhood.** The box (`placeInput()` in `build.mjs`, `placePicker()` in `site.js`) takes five
digits as a ZIP code (`data/zips.json`) or offers neighborhoods that match what's typed, up to six, from `NEAR_HOODS`
in `build.mjs`: every neighborhood on OpenDataPhilly's map (`data/philly-map.json`, the shapes Kids' Playground's map
uses; the middle of each shape, turned back into a latitude and longitude), plus the wider names the listings use
that the map doesn't have (Center City, South Philadelphia, Germantown: the middle of the map's neighborhoods each
covers, listed in `AREAS`), plus what people call them (`SAY`: South Philly, Fishtown, Mt Airy, NoLibs). Any other
neighborhood a listing names is placed at the middle of its own listings. Distances from a neighborhood are measured
from its middle. Add a name people use to `SAY`; add a wide area to `AREAS`.

The top of a program's page says which schools it works for as colored labels (`servedPills()`): yellow for pickup, green for on-site, blue for nearby, the same colors as on the cards.

On a program's own page, a row of "The details" longer than about a hundred characters shows its first two lines with a "More" link (`fold()` in `build.mjs`). It is a `<details>` element holding the whole text, so it opens without JavaScript and nothing is left out of the page.

**Each list starts with one question** (`focusCard()` in `build.mjs`, the `[data-focus]` block in `site.js`): the
filter that makes that list the most use to one family, asked in a yellow card above the search box. The after-school
list (`/programs/`) asks for the child's school, because pickup decides what works. Every other list (day camps, each
day off's page, weekend classes, summer camps) asks where you live, as a ZIP code or a neighborhood (the same box as
the home page search; with "Use where I am", and "From <your school>" when one is saved), and puts the closest first without hiding anything: any child can go to those, so
the rest stay on the list further down. In a list under headings, each heading's places are closest first and the
heading with the closest place comes first. One ZIP code serves every list. Answered, the card shrinks to one line
("Showing what works for Meredith", "Closest first, from ZIP code 19147", "Closest first, from Fishtown – Lower
Kensington") with Change and a way back to the whole list
(Every school, Back to A to Z), which brings the question back. The answer drives the filters that were already there
(the School row, "Nearest first"), so the chips, the count and the address all agree with it. It is kept on the
device: the school is the same "my school" a school's page saves (`keepSchool()`, which also keeps it in the profile
for someone signed in who keeps their school there); the place is `pas-my-near` (`zip:19147` or `hood:<slug>`, the
newest answer, from the home page or any list), and a ZIP code also goes in `pas-my-zip`, where it was kept before
neighborhoods. A ZIP code is looked up in `data/zips.json`, the middle of each ZIP code area in and around Philadelphia from the Census Bureau's
2024 Gazetteer file. Neither leaves the browser. A neighborhood question (`focusCard('hood')`: pick a neighborhood, which narrows the list to
it, kept in `pas-my-hoods` with the profile's neighborhood joining it through `adoptHood()` in `groups.js`) is still
built and wired for a list that wants one; no list uses it now. The week builder asks for the school the same way, above its
search (`#board-focus`): programs that work for it come first in the search, and browsing starts there. Analytics
gets `pas_focus` (focus: school, neighborhood; how: pick, wide, planner) and never which school, neighborhood or ZIP;
`pas_near` says `zip` when a ZIP code set the order. The card's words are on `/edit/` like any other sentence.
`tests/cases/20-web-pages.mjs` answers each kind.

**The filters start shut.** They run to six rows plus the grade row, which is a lot to meet before the list, so
`filterBar()` writes the search box first, full width, and under it one dark "Filters" button (`#filters-toggle`)
with its line (`.fbar-top`), and `site.js` keeps the rows
and the grade row hidden until it is pressed (the class `open` on `.fbar` and `.picker`; without JavaScript there are
no filters at all, as before). Beside the button a line says what is inside, built from the rows that page has
("Narrow this list by grade, type, pickup or cost. Or see it on a map."), and a yellow number counts the filters in
use. While it is shut, each filter in use is a chip beside the button (`.fchip`) that takes that filter off when
pressed: a remembered grade, a saved school and a filter in the page's address all narrow the list on arrival, and
the chips are what stops that from happening out of sight. The count line and "Clear filters" always show. Opening
it is remembered for the visit (`sessionStorage`, `pas-filters-open`), a link to one row (`#by-day`) opens it, and so
does the slim bar's "Filters" button.

The filters and the grade row scroll away with the page. Once they are out of sight, a slim bar is fixed under
the menu bar (`#quickbar`, written by `filterBar()`): a "Filters" button on the left, where the main one is, that
goes back up to the filters and shows how many are on, then a search box that filters the list as you type and
keeps the main search box in step, and a line saying what is showing with a Clear link. It goes away again at the
footer. While someone is typing in it the bar stays whatever they scroll, until they scroll back up past the
filters: then it goes rather than sit stuck over the page (what they typed is in the main box already, and the
cursor moves there if that box is on screen).

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

`/by-day/` ("What runs on which day") is the footer's "Programs by day of week": the after-school programs and the
weekend classes together, with the day row Monday to Sunday and a count for each day in the hero. Day camps run
on dates and summer camps by the week, so it points at their lists instead.

The search box on the home page looks through `data/all-schools.json`: every district and charter school in
Philadelphia with any grade from K to 8, taken from the City's "Schools" open dataset. Where the City lists two
campuses under one name (Ad Prima, Esperanza Academy, Wissahickon), the street is added to the name in
parentheses so the two can be told apart, and the Hancock middle campus is "John Hancock Demonstration School
(LaBrum Campus)"; keep those when the list is refreshed. Schools with a record in
`data/schools.json` (matched by street address) open their page. The rest open `/schools/request/`, where a
parent can ask for the school with one tap (it uses their free account, so each family counts once). Each new
request is emailed to `contactEmail` with the asker's email address and everyone waiting for that school so far,
and logged in `phillyafterschool-school-requests.log` above `public_html` (date, id, name, email), so the owner
can write to those families by hand when the school goes up; the queue page lists them per school as mailto
links. The addresses stay in that log, the owner's inbox and the queue page: the private queue the research runs
read carries counts only (`schoolsAsked` in `queue/open.json`, see "The private queue" in `docs/listings.md`). Refresh `data/all-schools.json` when the
City updates its list (about once a year).

## Neighborhood pages

`/neighborhoods/` lists every neighborhood that has a school or a program, and each one gets a page at
`/neighborhoods/<name>/` (for example `/neighborhoods/bella-vista/`) showing the schools there, then every kind
of listing in sections with a Kind filter: the after-school programs based there, the weekend classes there (and
a section of the ones close by, in that part of the city), the day-camp programs based there, the summer camps
with a site there, and programs from elsewhere that pick up from a school there. They are built from each school's
`neighborhood` text (use " / " between two names for a school on a border) and each program's `neighborhoods`
list. A new neighborhood name anywhere in the data creates its page; spell names the same way each time.

## The menu

The header has two groups that open (Programs, whose first item is `/all-programs/`, the page that sorts every
listing by kind, and Schedule Builder, whose first is `/schedules/`, the page that introduces all the planners),
then, for someone signed out, Account Features (see below), then Suggestion Box and About as plain links, and the
account button (the "Help the site keep going" button before accounts).
The groups are defined in `layout()` in `build.mjs` as a list of labels, a top link and items. Each is a
`<details>` element, so it opens without scripts. On a wide screen with a mouse (`hover: hover`, from 1100px) the
script opens a group on hover or keyboard focus and makes its label the link to the top page (`data-top`), so the
"All programs" / "Build a schedule" row is hidden there (`.menu-all`); on a phone, or anything without hover, a tap
opens the group and that row is its first. The items are After-school, Weekend Activities, Day Camps and Summer
Camps under Programs; After-school, Days off, Summer and Our Calendar under Schedule Builder. The school,
neighborhood, type and day-of-week pages live in the footer. The header is the footer's navy (`.sitebar`, #0A3566,
with the strip above it in royal blue, #0F4D90) with white type, the yellow for what is current or pressed, and the logo
(`src/static/logo.png`, the PHILLY / AFTER SCHOOL bulb, served as `/logo.png`) on the left; from 1100px wide the menu sits on the right on the same line; below that a Menu button
opens a white panel where each group is a big row that opens on a tap (only the group the current page is in starts
open), then Suggestion Box, About and the button, so a phone sees five lines rather than every link at once.

The footer (`.foot`) is the sitemap, kept short: the wordmark (`src/static/logo-text.png`, the logo without the
bulb; the pictures the planners make carry the same wordmark on a navy tab at their top left, `drawMark()` in
`site.js`), one line and the "Help the site keep going" button, then
four columns: Programs (the four kinds, then By School, By Neighborhood, By Type, By Day of Week), Schedule Builder
(the three planners, My Calendar, Reminders by Email, My Profile), Account Features (Calendar & Sharing, Parent
Portal, Kids' Playground, and "Create a free account" for someone signed out) and About (The Story, Suggestion Box,
Write a Review, For Program Managers, Contact, Privacy, Terms of Use), then the fine print with the two credit lines
("Created, managed, and meticulously vibe coded by …" and "Written, edited, and humanized by …"). Menu and footer
items are in title case, and "After School" is two words when it names the thing (it is hyphenated only as an
adjective: after-school programs).

### Account Features

A group of its own in the menu, for someone signed out (`featMenu` in `layout()`, `when-out nav-feat`; signed in,
the Parent Portal and Kids' Playground buttons take its place): a page for each thing a free account does, made by
`featPage()` in `build.mjs` (`FEATS()` lists them):

- `/features/` ("What a free account does"): a card for each of the three, which is where the group's label goes on a
  wide screen.
- `/features/calendar/` (Calendar & Sharing): building the week, the days off and the summer; the whole year in one
  calendar and on your phone; planning with a co-parent, sharing a week with one person, and sharing with a small group.
- `/features/parent-portal/` (Parent Portal): the overview, your school and your kids (first names, grades, ages), the
  to-do list of sign-ups, following and favorites, and that the kids' info is encrypted and the family's alone.
- `/features/kids-playground/` (Kids' Playground): the "For kids" band and "How it works", the same as Kids' Playground shows
  someone signed out. It runs no analytics (`quiet`), since it says nothing on Kids' Playground is counted.

Each page uses the register page's rows and pictures (`accountArt()`, shared with `accountPage()`, plus a profile card,
a to-do list, the days off and summer, and a lock drawn in `featArt()`), with "Free for every family" and the
account button at the foot (for someone signed in, a button to the matching part of their account) and cards to the
other two. They are in the sitemap and open to search engines. Sentences shared with the register page are the same
editable sentences, so an edit to one shows on both.

## The suggestion form

`/ideas/` (feature requests) posts to the same handler and arrives with the type "A feature idea".

`/suggest/` posts to `suggest/send.php`, which the build generates. It emails each suggestion to
`contactEmail` and also appends it to `phillyafterschool-suggestions.log` in the folder above
`public_html`, so nothing is lost if an email goes missing. It needs a host that runs PHP. The hourly job reads that
log into the private queue for the research runs, and the sender is emailed once when their suggestion is settled
(see "The private queue" in `docs/listings.md`).
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
from one address. The footer's About column links to the page.

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

## Links down a long page

A long page gets a strip of links that stays under the menu bar. Put `${jumpNav()}` where the strip should sit and
give each part an `id` and a `data-jump-to="Short label"`; `window.pasJump()` in `site.js` fills the strip, leaving
out parts that are hidden or empty, and pages that fill themselves in later call it again. When the strip is wider
than the screen it scrolls sideways, with an arrow and a fade at whichever end has more (the same cue as the
filter rows). It is on My kids' calendar, the days-off page, the summer schedule and the privacy
page. (The account page used to have one; it has tabs now.) With fewer than two parts showing, the strip stays hidden.

## What's new

`data/news.json` is a short list, newest first: `{ "date", "title", "text", "href", "link" }`. The Parent Portal's
overview (the account page's first tab) and the profile show the latest under "What's new", and "Parent Portal" in the
header carries a dot until the newest one has been seen on that device (`pas-news` in `localStorage`). **Add an entry
in the same change as anything that ships that a parent would want to know about** (a new school, a new planner or
feature, a change to how things work); listing and copy fixes don't need one. The build prints a Note once the newest
entry is more than two weeks old, as a reminder.

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
