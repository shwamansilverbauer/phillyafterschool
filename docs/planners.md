# The planners

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
  own; it went once the menu had "To do"; the menu link went in turn when the list became part of the profile.)
- **The To do page** (`/to-do/`, `todoPage()`) is the list by itself. The ways to it: a "To do" row on the profile
  card (`todoLeft()` in `groups.js` counts the camp days from today on that are a program and not ticked), and, for
  anyone signed in, the second row of the home page's Parents box. Like the calendar it is a shell with nothing about anyone in it,
  kept out of search, with no analytics or recordings; `groups.js` hands the profile to `window.pasTodo.show()`. It
  reads the days-off plan from the profile when one is kept there and from the device otherwise, counts the days with
  no plan, and signing in from it (`?next=todo`) comes back to it.
- **My kids' calendar** has no list of its own (the To do page is a row of the profile, and a second copy only cluttered the
  calendar), but shows the check marks on its calendar and list. The To do page draws the list with `signupTodo()`
  and saves a tick with `tickSignup()`: wherever the days-off plan lives, onto the device or to the profile through
  `daysoff_save`.
- **Analytics** hears `pas_dayoff` with action `signed_up` or `signed_up_undo`, how (`day_list`, `todo`, `todo_all`)
  and how many days: never the child, the camp or the date. The copied text and the calendar file say "signed up" or
  "still to sign up" for each camp day.
- The summer planner doesn't have ticks yet.

### Plans keep themselves

The planners need an account (`plannersNeedAccount`), and a plan made by someone signed in is kept in their profile
without asking: there is no "Keep it in my profile" button to find, and no box saying it was kept. Signed out, the planner's place is taken by the
tour of the planner with one button, "Create a free account" (`planShow()`), so that is the first thing a visitor sees.

- **Summer and days off** (`keepPlan()` in `groups.js`): once the profile has loaded, a plan on this device and none
  in the profile is sent (`auto()`); one in the profile and none here is put on this device. Nothing on the page
  says so: the "In your profile" box (`#sum-profile`, `#off-profile`) stays hidden unless there is something to
  decide or retry (below). Taking a plan out of the profile is done on the account page's Plans tab.
- **The week** (`autoKeep()` and `keepWeek()` in the Build your week part of `groups.js`): each child's week is its
  own row in the profile, told apart by first name, so a week is sent once it has a first name and a program. A week
  the profile has and this device doesn't is put on this device. Removing a child on the page deletes their week
  from the profile too (`onKidGone`), or it would come straight back.
- **What is still the parent's choice.** The profile and this device both hold a plan that were never tied
  together (a plan made on this device before the planners needed an account, say): neither is sent or replaced
  until they pick, and replacing takes a second tap. For weeks that means a child here with the same first name as a
  week in the profile. Only then does the "In your profile" box show (and after a save that didn't work, with "Try
  again"); the week builder's version sits in its sharing panel and also lists a week the profile has that this
  device doesn't, with "Put it on this device". A plan taken out of the profile (`sumProfOff`, `offProfOff` on
  `pas-rosters`, `profOff` on a child) no longer stays out: a device that still has it keeps it again the next time
  the planner is opened, because plans save themselves. To drop one for good, clear it on the device too.
- **What the pages say.** The privacy page, the terms' "Children's information", the sign-up page and each planner's
  intro say plans are kept in the profile while signed in. If this is ever made a choice again, those are the places
  to change (`privacyUpdated` and `termsUpdated` in `site.config.json` are the dates shown).
- Tests: `tests/cases/21-web-planners.mjs` (each planner keeps itself in the profile and comes back on another device) and `tests/cases/11-api-plans.mjs` (what the server keeps, and that none of it is readable on disk).

### Who's open, as the planner's third view ("Grid")

The chart of which program has posted a camp for each day off ("Who's open each day off") is the days-off planner's
third view, Grid, beside List and Calendar (`#off-views`, `data-view="chart"`, remembered in `pas-off-view`). The planner
page carries the chart in a `.when-in` section (`#chart`) that `site.js` moves (`#off-chart-block`) into the planner
(`#off-chart-slot`) and hides; signed out, the chart isn't on the planner page at all, and it is not on the
day-camps page any more either; `daysOffBits().chartSection` still builds it for wherever it goes next. A box is
`td.on::before` until the planner puts a button in it (`.sum-chart td.on:has(button)::before` hides the drawing). The summer chart works the same way
(`#sum-chart-block`, `#sum-chart-slot`, and `/summer-camps/weeks/` for everyone). `daysOffBits()` in `build.mjs`
builds the days-off chart for both pages (`where` = `'page'` or `'plan'`).

The summer schedule works the same way (`#sum-views`, remembered in `pas-sum-view`): List, Calendar, Grid and
Share/Save. Calendar is a month at a time (`#sum-month`), with each child's camp on all five weekdays of its week or "Not
planned"; a tap on any day picks that week, whose row sits under the month so choosing works as it does in the list.
A month that only gets the tail of a week (the first days of September) has no page of its own. Grid is the
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
the older line in the page (`nextOff()`). Both skip a day off that is already planned on this device — every child
on the device has a pick for every date of the break in the days-off planner (`offPlanned()` in `site.js`) — and
move on to the next one still unplanned; when that one is more than 60 days away they say nothing, since a day off
two months out is not yet a question.

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

**A school with its own calendar.** A charter school's days off can differ from the district's (ICS is open on
Veterans Day and closes for its own report card days). Give its record in `data/schools.json` a `calendar`:
`{ "source": { "label", "url" }, "checked", "lastDay", "days": [{ "date", "name", "end"? }] }`, from the school's own
calendar. Then its page's "Next day off" line, its "This week at" section and email (`schoolOff()`,
`schoolLastDay()`) and its day-off emails go by it: each of its days becomes an `off-<school>-<date>` entry for the
people who follow that school, and the district's day-off entries carry `notSchools` so someone who follows only
such schools isn't told about district days (`groups-api.php` honors it). The planners and the day-camps page still go
by the district's days. Replace the days each year with the district's.

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
  "ask", because it hasn't posted the date), or a plan of their own. On a break, one tap repeats a pick on the other days of the
  break the program posted. Picks are saved with the rosters in the browser, per child (`off` on each child:
  `{ "2026-11-03": "program-id" }`, or `"home"`, `"away"` or `"other"`). Siblings, first names and "copy Sam's days" work as on the summer page.
- **Not a camp day?** The chooser opens with that row, above the camps, so nobody hunts for it: "At home or with
  family", "Away or out of town", and a write-in ("Nana's", "the shore", a camp that isn't listed here) with "Use
  that". The three are `home`, `away` and `other` in the plan and go to the profile like a program id
  (`clean_daysoff()` and `clean_summer()` take them); what was written in is kept on the device only, by date
  (`offWhat` on the child, `sumWhat` for summer weeks, 40 characters, `cleanWhat()`), and shows wherever the pick
  does on that device: the row, the calendar, the pictures, the calendar file, the text, the to-do count (an own
  day is never "to sign up for") and My kids' calendar (when the child is on this device too). Another device
  shows the plain label ("Another plan"). The summer planner's weeks offer the same row, and an own week
  counts as planned but never as booked or priced.
- **The child's own programs.** A day off that falls on a weekday the child already goes somewhere, when that
  somewhere runs camps on days off, is the obvious pick, so the planner says so instead of waiting to be asked
  (`ownFor()`, `fillable()`): the roster is the current session's, or the upcoming one when the current is empty
  (the rule My kids' calendar uses), matched by the weekday of the date. Where it posted a camp for that date, the
  day's row offers it in one tap ("Use Mister John's Music, Sam's Tuesday program", `.sum-mine-pick`, method
  `own_week`), the chooser opens with it under "Sam's Tuesday program" (`.sum-mine`, with the camp's hours and
  cost from `daysOff.hours`/`cost`, and "hasn't posted this date, ask" when it hasn't), and a banner above the
  list (`.sum-sugg`) counts the days it could fill and fills them in one tap (`own_fill`, with "Put them back",
  `own_fill_undo`). Nothing is filled by itself, each filled day is still "to sign up", and a camp whose posted
  ages don't take the child's age is left out of the one-tap fill but still shown with its ages. On Build your
  week, the "Next day off" line names the child's own program when it has a camp posted for that day
  (`personalOff()`, from `offAhead` in the page's data) and counts the others.
- **Kids.** The pills for switching between children (and "Add a sibling") stay in view; the first name and age
  fold away under a "Name and age" line (`details.kids-edit`, the same on the summer planner and, as "Child's
  name", on Build your week), opening by itself for a child who has no name yet. The tally of what is planned and
  what is left (`.sum-tally.main-tally`) is the first thing in the main section, under the view switch.
- **Age.** "Age (optional)" beside the first name (`#off-age`, the same select as the summer planner's) narrows
  the chooser to the camps that take that age, with the others under "N camps posted for this day don't list
  age 7" and the grid's rows hidden the same way; each camp's span comes from `daysOff.ageMin`/`ageMax`, else
  its grades as ages (`a` in `off-data`; none means any age). The age is the child's (`age` on the child), shared
  with the summer planner, and stays on the device.
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

The four kind pages (`/programs/`, `/weekends/`, `/day-camps/`, `/summer-camps/`) keep their hero to the title, the
line and the drawing: no back link, button, facts or pill row, since the filters and the jump strip sit right under
it. The way to the planner (and, for summer, the weeks chart) is a line at the foot of the list (`planLine()`,
`.plan-line`), so nothing pulls a reader off the page before they have looked. The after-school page's drawing is the street with `showStreet: 'out'` (`street('out')`): school's out, five
kids come through the door one at a time, hop along the sidewalk to the bus door and climb in, and the bus leaves;
it plays once, and not at all for someone who asked for reduced motion. The overview pages (`/all-programs/`,
`/schedules/`) are cards with an icon, a kicker, a heading, a line and a button (All programs: one each, to the
kind's own list); no bullet lists and no program
counts (the days-off card keeps "N days off still to come", and the summer card its weeks). Counts of programs
stay off the home page's tiles and type chips too; a filter bar's counts and a list section's "(N)" are the live
numbers of what is on the page, and stay.

**Type.** Three faces, all from Google Fonts (one `<link>` in `layout()`), following the brand's type key. Signposts —
headings that name the page or a region of it (`h1`, `h2`: the page headline, "Parents", "When do you need
coverage?") — are **Luckiest Guy**, the logo's face, heavy painted capitals (`--title`; the text is set in capitals by
CSS, so a heading keeps its own casing in the HTML and in search results; its own lowercase is an odd unicase, so
the transform is not optional). Titles — names of things inside a region and short statements (`h3`, the coverage
cards, tiles, feature cards, step labels, "It's free for parents.") — are **Figtree ExtraBold** in sentence case
(`--display`, weight 800; the week card and the planners' pictures draw in it too). An h2 that names a thing or makes a
statement rather than signposting a region (a planner's card on `/schedules/`, the Follow box, the review nudge,
the premium ask, a person's name on their profile card) is a title too, so it is Figtree in sentence case.
Everything else, the line over a page title (`.hero .where`, a breadcrumb or a school's one-line description)
included, is the body face, **Atkinson Hyperlegible** (`--body`). The brand picked Luckiest Guy for the logo too,
so the site and the logo share a face; the logo's hand-lettered "AFTER SCHOOL" stays in the logo. The two
site-wide link-preview pictures (`src/static/share.png`, `share-days-off.png`) are the site's sky with the logo for
light backgrounds (`src/static/logo-sky.png`, PHILLY in the brand blue), a headline, one line and the page's drawing
along the bottom; `scripts/share-pictures.js` draws them from a build with Playwright, so they are redrawn
whenever the logo, a headline or the site's colours change.

Each day-off, school, summer-camp and weekend page has a preview picture of its own (`shareImage: { page: true }` in
its `layout()` call), so a link texted to a class group chat shows that page: "It's 3:39 at Nebinger. What now?",
or "Veterans Day: camps for the day off" with the date and how many programs posted a camp. The words are the
page's own headline and the line under it, read from the built page, so Rachael's wording and anything edited on
`/edit/` is what the picture says (the line drops to its first sentence when the whole of it won't fit in two lines).
A school page has the home page's street under it; the others have their own drawing. The publish workflow draws
them after the tests (`node scripts/share-pictures.js --pages`, into `dist/share/<path>.png`), so they follow every
change, and the page names its picture with a stamp of its headline, its line and the script (`sharePageStamp`), so
an app that kept an old preview fetches the new one. If a picture can't be drawn, the site-wide one is copied in
its place and the publish goes on. `tests/cases/01-build.mjs` checks that each of those pages names its own.

The same script makes posts for social media from any page: `node scripts/share-pictures.js --post
days-off/veterans-day-2026-11-11 <folder>` draws a 1080 by 1350 one for a feed and a 1080 by 1920 story, in the
page's own words (the whole line, up to three or four lines), with Eddie in his sunglasses and the site's address. That Eddie is the original one from the logo, with the dark
outline (`src/static/eddie.png`, cut from the brand's light-background lockup, the one `logo-sky.png` comes from),
because the plain yellow bulb fades into the sky; the sunglasses are fitted to his eye in the script.

The three faces are served from this site, not from Google: `src/fonts/` holds the WOFF2 files (Latin and Latin
Extended, the weights the site uses: Luckiest Guy 400, Figtree 700 and 800, Atkinson Hyperlegible 400 and 700, from
the `@fontsource` packages) with their SIL Open Font License texts, the build copies them to `assets/fonts/`, and the
`@font-face` rules are at the top of `src/site.css`. Every page preloads the body face and Luckiest Guy. So no page,
the quiet ones included, asks another site for its fonts; `tests/cases/01-build.mjs` fails if one ever does. To add a
weight, take its file from `@fontsource/<family>` (`npm pack`) and add a rule with the same `unicode-range`.

**Colours.** Every colour is a named value at the top of `src/site.css`. The band at the top of each page is a
daytime sky (`--hero` fading to `--hero-low`) with navy type (`--hero-ink`, `--hero-muted`); the header button
is `--cta`; the footer keeps the deep blue (`--foot`). Navy on the sky measures 9:1 or better, above the old
white-on-deep-blue. There is no dark mode: the site looks the same whatever the device is set to
(`color-scheme: only light` in the CSS and a matching `<meta>` in every page), because the calendars, the plan
colours and the pictures are drawn for a light page. The week card (`drawCard` in `src/site.js`) and the link-preview picture
(`src/static/share.png`, 1200 by 630) use the same sky and footer, so change them together. Both link-preview
pictures (`share.png` and `share-days-off.png`) are drawn by `scripts/share-pictures.js` (see "Type" below).
The logo files come from the brand's own set (2000px transparent PNGs, kept out of the repo): `src/static/logo.png`
is the full lockup (the header), `logo-text.png` the wordmark alone (the footer; the bulb masked out of the lockup),
`logo-sky.png` the lockup with PHILLY in the brand blue (for light backgrounds: the share pictures), and the
favicon and app icons (`src/static/favicon.svg`, `favicon.png`, `favicon.ico`, `apple-touch-icon.png`,
`icon-192.png`, `icon-512.png`) are the solid bulb on a navy rounded square; to change them, replace the files.
The brand's bulb marks live in `src/static/bulb.png` (the yellow bulb) and `bulb-line.png` (the outline one,
yellow line and light-blue brain): `bulb(depth, cls)` in `build.mjs` draws the yellow one on the "Nothing matches
that" note under a filtered list (`.ask-bulb`) and at the top of the 404 page's hero (`.hero-bulb`); the outline one
signs the footer's fine print (`.foot-bulb`, next to "Built by"). The kit's palette is the site's own five colours
(`--link`, `--yellow`, `--hero`, `--ink`, `--bg`), so nothing in the CSS had to change for it.

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
on any card, or from the page itself: a big search box ("Add a program": a name, or a word like music, chess, a
neighborhood or a school, all of which are in each program's `q`) and **Browse** beside it (`#explore`), for
anyone who doesn't know what to type: every after-school program, narrowed by type chips, the school it's at or
picks up from, its neighborhood and "Free only", each row with "Add" (which opens the same day picker as a search
hit, `pickAdd(id, school, 'explore')`) and "Details". Twelve rows at a time, "Show more" for the rest; the school a
parent already chose is the starting filter. Each narrowing fires `pas_explore` with what was narrowed, never a
name. "Roll a week" is the adder's second tab (`#fill-tabs`, `data-fill-pane`): the same spot, the other way
to fill a week, so the two aren't mistaken for one thing; a school's page's "Roll a themed week" link lands on
that tab, and a program picked from anywhere lands on Add a program. The Monday-to-Friday cards sit right under. Each child has two rosters, Current and Upcoming, so a family can share what they do now and
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
`#cost`, `#card` or `#keep` in the address opening on that view): **The week** (the adder with its Add a program
and Roll a week tabs, then the grid), **Budget planning** ("What this roster costs"), **Make it a card**, which draws the week as one
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
  Calendar, Grid on the days-off and summer pages; The week, Budget planning, Share it on the week; Calendar,
  List on My kids' calendar), each showing a made-up example (My kids' calendar is the plain one, `plain: true`: a
  "Sample calendar" heading with no kicker, the example full width with no side copy and no "Example" pill, and
  "This is a sample. Yours will be populated with your kids, your schedule, and the plans you make." under it; its
  hero has two buttons, "Get started" and "Log in", and a signed-out lede of its own); three things the planner does, each a picture-and-text row (a small
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

- **My kids' calendar** is tabs, like the planners (`#year-views`, panes `[data-year-pane]`): **Calendar** (the
  default) and **List** show the plan, **Add dates** holds where the plans come from and "Add your own dates", and
  **Share/Save** the pictures and the calendar file. The Calendar/List choice is kept on the device
  (`pas-year-view`); `?tab=own` or `#share` opens a tab; with nothing planned the page opens on Add dates. The calendar is
  one month at a time: a day off is yellow with where each child will be or "Not planned", a camp week runs Monday
  to Friday, sign-up dates and your own dates sit on their days, and a weekly date of your own is on every school
  day it falls on. A tap on a day lists it underneath with the same links as the list. Printing prints the list.
- **The days-off planner** opens as a list, with a Calendar switch beside it (`pas-off-view`). In the calendar the
  picked day's row sits under the month, so choosing works as it does in the list.
- **The summer schedule** has the same switch (`pas-sum-view`); there the pick is a whole week.
- Both use `calMonthView()` in `site.js`. On a phone the labels in the squares become coloured bars.

## Eddie in his sunglasses

When a change fills the last open day of a part of a plan, Eddie Bulboa (the bulb in the logo, `bulb.png`) slides
across the screen with "You did it! … Too cool for school!": he comes in from the right (he faces left, so what he
says sits to his left), his sunglasses drop on and glint while he waits in the middle long enough to read, and he
leaves to the left (`cheer()` in `site.js`; the shades are drawn in SVG over the picture, and CSS moves them). It
replaced a dragon, once Eddie was the mascot. It comes for:

- the last day off of a month ("November is planned."), or of the whole year ("You planned the whole year.");
- a camp on the last open week of the summer ("You planned the whole summer.");
- something on all five school days of a week ("You planned the whole week."), on the builder or from "Add to
  roster" on a school page.

It comes once for each of those on a visit, takes no taps, leaves by itself after about seven seconds or on Escape,
and the planner's status line says the same words for a screen reader. For someone whose device asks for less
motion he stands still at the foot of the screen, shades on, with a Close button. Opening a page, or a plan put back
from a profile, brings no Eddie. Analytics gets `pas_cheer` with which kind, and nothing else.

## The planners in one place

`/schedules/` (`schedulesPage()` in `build.mjs`) is where "Build a schedule" on the home page and the first item
of the menu lead: one block each for the week (`/board/`), days off (`/days-off/#plan`), the summer
(`/summer-schedule/`) and My kids' calendar (`/calendar/`, or the sign-up page for someone signed out). The
counts on it (days off still to come, weeks of summer, camps) are worked out at build time. The small pictures
are drawn in the build; none shows a real plan.
