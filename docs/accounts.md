# Accounts, profiles and sharing

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
- **Creating an account and logging in.** Two addresses share one form. `/register/` is the sign-up page: the
  two kinds of account (parent here, program manager on the managers page) and the form sit in the first screen,
  beside the heading (`.acct-hero-form` in the hero), and what an account gives you follows below as rows of
  pictures in three groups, "Plan the whole year" (the calendar, the phone and the fridge, the Parent Portal, a
  co-parent), "Never miss a thing" and "Something for your kids" (Kids' Playground and favorites first; `.acct-row`, one
  drawing each), with a
  closing "Create a free account" band that scrolls back to the form. Under the heading on `/register/` sit a few
  lines on what a free account gets you (`.acct-gets`) and the example "Sam's week" (`planExample('week')`, the five
  days across, made small; one row per day where its column is narrower than 430px; on a phone both come after the
  form), and `/account/`'s log-in has the same example week beside its heading, both hidden once someone is signed in.
  On `/register/` on a computer the heading side takes two thirds and the form one third (the account-type tiles
  stacked), the sign-in card has no intro line ("One step for both..." stays on `/account/` only; `signInBox()` takes
  `false` for no line), its button says "Create Free Account" (it emails the 6-digit code all the same; on
  `/account/` it says "Email me a code"), and "Already have an account? Log in" (`#acct-login`) moves from the hero to
  just under the card.
  At the foot of the sign-in card one line of fine print, "Want to know how we use your and your kids' data
  responsibly? Click here!", opens a small window (`#acct-data`, a `<dialog>`; any button with `data-dialog` opens
  one, and Esc, its "Got it" or a tap outside closes it) with how we use your info and your kids' info and a link to
  "Who can see what". `/account/` is where you log in: while
  nobody is signed in the form moves up beside the heading (`seat()` in `groups.js`) with a "New here?" link to
  `/register/`, and the same rows follow; signed in, the form moves back down and the page is where you change what
  is in the account. Someone already signed in who opens `/register/` is sent on. An invitation to a group or a
  shared week is a side path, not part of signing up: under the form there is one quiet line, "Did someone send you
  an invitation? Open it here" (to `/join/`), and the profile card has an "Invitations" row with the same way in. `?next=board` on either sends them back to Build your week afterwards. The old
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
- **Kids.** The profile card's Kids row lists the children kept on the profile (`users.kids`, JSON: first name,
  grade and age, up to 8, `kids_save` with the whole list each time) and, after them, names that come only from
  plans, each with "Add to profile". "Add a kid" opens a small form on the row (first name, grade, age; the grade
  and age are optional and join the grades and ages below). Adding one also starts a roster for them on the
  device (`seedKids()` in `groups.js`: a roster nobody has named yet takes the name, otherwise a new one), and the
  planners do the same from the profile at each sign-in, so a child added on one device is on every planner on
  the next. Removing a kid from the list leaves their plans alone. A grade or age given with a kid is the one
  place the profile ties a grade or age to a name; the grade and age rows below stay as they were.
- **Grades.** On the account page a parent taps the grades their children are in. Only the grades are stored
  (`users.grades`, for example `K,3`), not which child is in which (unless a kid is added with a grade, above). The account pages copy them to the browser
  (`pas-my-grades`), and every list with a grade row then gets a "My kids" choice next to "All" that shows
  programs taking any of those grades; it becomes the starting grade when grades are first kept or changed.
  With exactly one grade kept, the themed-week roller starts on it.
- **Share with one person.** The parent types one email address. That makes a private list for that child's
  week (a group marked `solo`), invites the address, and emails "{Name} shared {Child}'s week with you". The
  recipient must sign in with that address, goes straight in, and can look and print but not change anything.
  More addresses can be added to the same list; each can be removed, and "Stop sharing with everyone" deletes
  it. What is shared is the same as in a group: first name and program ids, never the school, address or notes.
- **Sharing from the account page** (since November 7, 2026; one Sharing section since November 12). The Plans &
  sharing tab opens with every way to share, together (`.g-sharing`, `#sharing`), then "Plans you've kept"
  (`#plans`): "Share with a co-parent" (everything, both ways), "Share a week by email" (one week with one person,
  view-only: a week picker and an address, `share_one` with `week`, then each address with "Send again" and "Stop
  sharing", then "Shared with you"), "Share with a group" (the groups, which week is in each with "Take it out", adding
  a week with `kid_save` and `week`, and "Start a group"), and "Have an invite?" (the join code). Each kept week's row
  just says who has it ("shared with one person · in a group") and keeps "Remove from my profile". A copy made this
  way carries the week's id (`kids.week_id`), so `week_save` and the device's `sync` bring every copy up to date
  (`week_follow`, which also renames the shared week after the child) and removing the week from the profile ends
  its shared weeks and takes its copies out of groups (`week_delete`). Build your week passes `week` too when the
  roster is kept in the profile, so new shares made there show on the account page; older ones don't, and still work
  from the device as before. The profile's "program.school" entries become the group's "program" ones (`week_from_full`).
- **Co-parents: two accounts, one set of plans** (since November 7, 2026; whose plans, since November 12). Under
  Sharing an account names one other adult by email (`coparent_invite`; the email is "{Name} wants to share all plans
  with you"). The invited account sees the invitation there once signed in with that address, with what each side
  holds (`me.coparent.mine` and `.theirs`: weeks, kids, summer, days off). When both have plans it must choose whose
  the two share ("Use Pat's" / "Use mine"; Accept waits for the choice); otherwise the side with plans is used. It
  accepts (`coparent_accept { keep: 'theirs' | 'mine' }`) or declines (`coparent_cancel`). The chosen account becomes
  the home account: it owns the `coparent` row (with `keep: 'mine'` the invitation is turned around), the other's
  `users.home` points at it, and every plan action reads and writes through `home_id()` / `household()` (weeks,
  summer, days off, the kids list; shares and group copies made from a week follow it for both). The other account's
  plans aren't moved or deleted: unused while linked, and its own again if the link ends. What comes across: the kids
  lists put together on the home account, a summer or days-off plan only the other has (copied), and Kids'
  Playground pages (copied, same first names merged). Grades and ages stay each account's own filters, as do follows,
  emails, groups and listings. Either side ends it (`coparent_end`): the shared plans stay with the home account and
  the other goes back to its own. Deleting the home account unlinks the other, which goes back to its own plans. One
  row per home account in `coparent`; `coparent_out()` is the state the account page draws from (`me.coparent`).
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
  declined; the manager is emailed each time. A proposed change also goes to the research runs through the private
  queue (see "The private queue" in `docs/listings.md`); when a run settles it, it is marked there and the manager
  gets that answer instead. To apply a change, edit the listing data as usual (or paste it to
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
  with `role: manager` when someone signs in there. The page is laid out like the sign-up page: the heading, a
  drawing and the "Find your listing" search share the first screen (`.acct-hero-form`); "What claiming gets you"
  follows as rows of drawings in two groups, "Keep it right" and "See it working", one drawing a benefit
  (`ART_CLAIM` in `build.mjs`, in the order of `CLAIM_GETS`) and each numbered; then "See it on a listing", an
  example listing (`claimDemo()`): an invented program, drawn from the same parts a real listing uses, with numbers
  that match the rows above it. Change a benefit there and the picture's numbers follow. Signed in with a claim,
  the search moves down the page (`seatClaims()` in `groups.js`) and the listing's own tools take its place; the
  explanatory sections fold away as before. A closing band leads back to the search. There are no student accounts, on purpose:
  the site never asks a child for an email address. The planners are for the adult who signs in.
- **Where.** `src/server/groups-api.php` is the whole server side; the build copies it to `groups/api.php` with
  its settings (site name, address, sender, the date shared weeks expire, the Google client ID). It keeps one
  SQLite file and a key in a folder named `phillyafterschool-data`, next to (not inside) the public folder on
  the host. Deleting that folder in the host's file manager wipes every account, profile and group. It is not
  in git and not backed up by this repository.
- **Limits and expiry.** Sign-in links and codes last 10 minutes and work once; five wrong codes kill a code;
  three sign-in emails per address per 15 minutes. A device stays signed in until it goes 14 days without a visit
  (`SESSION_DAYS`), and 90 days at most from signing in (`SESSION_MAX_DAYS`). Up to 60 invited addresses
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

## Follow and favorites

Dates by email now run on accounts. A **follow** means the listing's or school's dates are emailed; a **favorite**
keeps a listing in the account and emails nothing. `followBox()` in `build.mjs` draws the box: under the spotlight
on a program's page and on a camp's page, with a line under the two buttons saying which is
which ("Follow means emails when it posts a date. Save to favorites means no emails…", `.follow-which`), and as a
wide box on a school page, the home page, the days-off page and `/alerts/` (those last three with a school picker). Without accounts (`groups` unset) the old sign-up form,
`alertsBox()`, is used instead.

- **Which parts.** A program with more than one part (after school, day camps, weekend classes, a summer camp)
  asks which of them to follow: pressing Follow while signed in opens a short list of ticked boxes in the box
  (`.follow-kinds`; the parts come from `partsOf()` as `data-follow-kinds`), and the follow is kept with those
  parts (`follows.kinds`, a sorted list; empty for everything, which is also what signing in from the button
  gives). "Summer camp" is the camp's own listing (`data-camp`), so ticking it follows `c:<camp>` alongside and
  unticking it, or stopping the program, stops that too. The button then reads "Following: day camps, summer
  camp" and the account page's list says "day camps, summer camp only". The mail job learns the parts the same
  way it learns stops: the site keeps one scrambled entry per narrowed follow in the stops list
  (`only|p:<id>|off,summer`, hashed with the account's stop code), each entry in `data/alerts.json` carries the
  part it is about (`part`: a program's sign-up dates and notes belong to its main part, a camp day to the days
  off) and `withoutStopped()` in `scripts/send-alerts.mjs` tries each way of choosing some of the program's parts
  to read the entry back (`person.only`), which `dueFor()` then honors. A listing with one part asks nothing.
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
- **Where they're changed.** What you follow is the profile's Following row: "Change" opens the list under it,
  each with "Stop following". Favorites are the account page's Favorites tab (`.g-marks`), each with "Remove", and
  a favorite program has "Add to your week"; under them, each kid's favorites from Kids' Playground (the
  showdowns' ranking, best first, from `favorites` in the `profile` call; `paintKidFavs()`). Listings stopped from
  an email ("Stopped from an email", `#muted`) are with the emails, on the Account tab. Deleting the account
  unfollows everything first.
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

## Tabs on the profile, the account and the listings page

None of the three signed-in pages is a long scroll. The code is in `groups.js`.

- **One strip across all four** (`acctStrip()`, `nav.jump.acct-tabs`): Overview · To do · Profile · Account ·
  Kids' Playground · Favorites · Plans & sharing, and Listings for an account that holds a listing. To do wears the
  call-to-action color (`a.tab-cta`) only while camp days wait on it, with their count, once the profile is read
  (`nav.pasTodo(n)`, from `todoLeft()`); otherwise it looks like the other tabs. It is a link to `/to-do/`, which
  draws the same strip above its list. A tab whose part is on the page in view switches in place; the others are
  links to the page that has them (`/profile/`, `/managers/`), so the pages read as one place. It stays under the menu bar, and scrolls sideways on a phone
  with the open tab brought into view (`window.pasRail()` in `site.js`, shared with the jump links).
- **On the account page** each panel is put on a tab with `put(panel, 'account', tab)`, and `TAB_OF` says which tab
  every linkable part is on, so `/account/#emails` (the Account tab), `#favorites`, `#sign-out` and the rest open
  the right tab and scroll to the part. A part that lives on the profile now (`#school`, `#following`, `#add-kid`,
  `#grades`, `#ages`, `#hood`: `PARTS.profile`) sends the link there, and the profile opens that row. Choosing a
  tab puts it in the address (`#favorites`, `#plans`; the first tab is the plain address), so a reload or the Back
  button keeps it. "Signed in as …" and "Sign out" sit above every tab.
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
- **Every part at once.** `sessionStorage` `pas-tabs` = `all` shows every tab's parts on one page, for a test or a
  look at everything at once; `tests/cases/22-web-account.mjs` tests the tabs themselves.

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
- **`/account/` is the Parent Portal, and where everything is changed.** It opens on an **Overview** (`#overview`,
  `paintOverview()`): a card for each place to start (Build your kids' week, Plan your days off, Update your profile,
  Manage your to-do list, Build your year calendar, Have your kids play, Plan your summer, Help the site keep going),
  each with how far it has got from the plans kept in the account, then "What's new". Kids' Playground's card looks like
  the others; its line says "Add your kids first", "2 classes to confirm", "Not started" (no child has picked a bulb
  or met Eddie yet) or "Playing", from the same `passport` call the page makes; Update your profile goes to the
  profile. The other tabs: Account (`#you`: name, email address, mobile number, then "Emails and notifications": the
  Sunday email, notifications on this device and listings stopped from an email; then signing out and deleting),
  Kids' Playground, Favorites, and Plans & sharing. A program manager's account has no overview and opens on
  Account. Signed out, it is where people log in, with the same example week ("Sam's week") beside the heading as
  the sign-up page.
- **The profile is where the kids, the school and the rest are changed** (`paintCard()`). Each of those rows opens
  under itself, like the kids' form: Kids ("Add a kid", and each kid's Change and Remove; Remove takes two taps),
  Grades and Ages (the buttons to tap on or off), School and Neighborhood (a list; picking one keeps it, and the
  Sunday email moves with the school), Following ("Stop following" for each). "Done" closes a row. `cardOpen` says
  which row is open, so it stays open when the card is drawn again after a save. The pieces are made once in
  `groups.js` and moved into the open row.
- **Getting there.** Signed in, the menu has "My Profile" as a plain link, then the yellow "Parent Portal" button (to
  the overview), then the Kids' Playground button with a little bulb, which just says "Playground" ("Kids' " is there
  for screen readers only). In the phone menu, Parent Portal (the big yellow button) and My Profile come first, and
  Kids' Playground has the foot of the menu as a section of its own: a dashed line above it and a big button in its
  own colors, with its full name. The footer's Schedule Builder column has "My Profile" as well.
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
