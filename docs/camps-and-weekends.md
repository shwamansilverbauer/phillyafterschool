# Summer camps and weekend classes

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
- **Share/Save** is the planner's fourth view (`data-view="card"`; it is never the view the page opens on, and
  before anything is planned it only says what it is for, `#sum-share-empty`). It holds the tools row (share the
  plan, add to calendar, copy, print, clear), the profile box, and **Make it a calendar**: the plan drawn as a
  picture, like the week card: the whole summer on one card (a row a week, a column a child), or a card for each
  month (Monday to Friday, a bar for each child's camp). The tools row shows on this view only; the weeks are out of
  the way (`.card-view` on the planner). The days-off planner has the same
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
weekday program. Take the field off once its weekday classes have been checked against the schools. The same
goes for a place found for its day-off camps alone: `"scope": "dayoff"` makes the page say only its camps on
days off have been read.

**Weekends in Build your week.** The board has an "Add Saturday and Sunday" button under the weekdays. Weekend picks
are kept beside the weekdays, not in them (`board.wk = { sat: [], sun: [] }`, each entry a program id, or
`id~what the parent typed`), so pickup, the cost estimate and the week roller never see them. A weekend pick has no
school and no pickup label. The Weekends section of a program's page has an "Add Saturday to your week" button
(`board/?wk=ID&day=sat`; one per day it runs). The card is one image for the whole week: with weekend picks it grows by one row,
Saturday and Sunday side by side under Friday; without them it is the same card as before. In a profile or a
shared week the weekend travels as two more days, `sat` and `sun`, holding program ids only: the server drops
what a parent typed, and any program that has no class on that day. Weeks saved before this open unchanged.
