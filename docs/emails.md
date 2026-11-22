# Editing the wording, and emails to parents

## Editing the site's wording

Headlines, intros, section text, form labels and footer text can be edited on the site itself, and published from
there.

1. Sign in to your account on the site with a site admin's or an editor's address, open `/edit/`, and choose "Start
   editing". The page isn't linked from anywhere and is hidden from search engines. An account's sign-in lasts until
   the device goes 14 days without a visit (90 days at most), and edits can only be published or sent while signed in.
2. Click any outlined text on any page and type. To take a sentence off the page, click it and choose "Remove this
   sentence" in the bar; it shows struck through until it is published. Edits are kept in that browser only.
3. "Review and publish" lists each change beside the original, with a tick per change. "Publish" writes the ticked
   changes to `data/copy.json` in the repository on GitHub as one commit named for the count and the person, and the
   publish Action builds and deploys as for any push, so the site changes within a few minutes. The build stops on a
   bad file, so nothing broken reaches the site. A record of each publish is also emailed to `contactEmail`.
   "Send by email instead" is the older path: the email lists the changes and ends with a complete `data/copy.json`
   to paste in and commit.
4. `/edit/` lists the published versions (the commits that touched `data/copy.json`), newest first, each with
   "Restore this version". A restore is a new commit with that version's file, so nothing is ever lost, and the
   sentences currently taken off the page are listed there with "Put it back".
5. "Show what's changed" in the bar outlines in red every sentence reworded from the site's original wording (the
   page carries the original as `data-was`; `?action=changes` on `edit/send.php` says who reworded it and when, which
   a publish records in `data/copy.json` as `by` and `on`). Clicking one shows what it said; "Put the original wording
   back" makes that a change of the current editor's, and publishing it drops the entry. The toggle is remembered
   per browser, so one person can edit with it on and another without.
6. Notes for each other. "Leave a note" in the bar pins a note to the clicked sentence, for one of the editors or
   for anyone; sentences with an open note are outlined in blue, clicking one shows the note, and "Done with this
   note" closes it. Publishing a change to a sentence closes its notes too (`done_how = published`). "Email N notes to
   <name>" (in the bar and on `/edit/`) sends that editor every note for them not emailed yet, in one email with a
   link per note (`<page>#note=<id>`): opening such a link while signed in to the site as that editor turns editing
   on and lands on the sentence. Notes live in the accounts database (`copy_notes`), never in the repository, and
   are only readable behind the edit sign-in; at most 10 note emails an hour.
7. Editors. A site admin (an account on `admins`) can let someone in by the address they sign in to the site with,
   on `/edit/` under "Editors" (the `editors` table; at most 10). That account then opens every page behind the edit
   sign-in, is named as "for" in notes, and gets the note emails. Removing them closes the pages
   to that account again. Admins alone add or remove editors and delete notes; an editor marks notes done.

Publishing needs one thing on the host: a file named `phillyafterschool-github.key` next to the public folder (the
same place as `phillyafterschool-postmark.key`) holding a fine-grained GitHub token for this one repository with
*Contents: read and write* (and the metadata read that comes with it) and nothing else. **Never put the token in this
repository, in an issue or in a chat.** The file's name is in `.gitignore`. Without it, the edit page says publishing
isn't set up and the email path still works. The handler is `src/server/edit-send.php` (built into `edit/send.php`);
it merges the changes over the file as GitHub holds it at that moment, not over the build's copy, so two publishes in
a row before a deploy don't lose each other, and it allows thirty publishes an hour.

Each entry in `data/copy.json` is keyed by a fingerprint of the original sentence and holds `was` (the original) and
`now`. An empty `now` takes the sentence off the page, and a list item, paragraph or heading left with nothing else
in it goes too, links whose words were all removed included (a benefit on the register or managers page, say; the
example listing's callout numbers follow).
Words in curly braces, like `{school}`, are filled in per page. If a sentence is later reworded in
`build.mjs`, its entry stops matching; the build prints a note and carries on.

### The emails

The emails the site sends itself (sign-in link and code, the invitations to a group, "someone joined", the monthly
numbers and the other notes to the people who run a listing, a parent's question passed on, and the answers to
whoever sent a suggestion or a proposed change once a research run has settled it: "It's on the site", "It's
already listed", "We couldn't confirm this yet" and "We can't list this one", see "The private queue" in
`docs/listings.md`) are edited the same way. So are the words the mailbox script sends from the site's address (see
"The mailbox script" below): the fixed replies to mail ("Thanks, it's updated", how to claim a listing, delete an
account, stop the emails or ask for a school, and the last lines of every reply), the starting draft for a held email,
and the three outreach sequences (the claim invite, "your school's page is live", the camp sponsor invite) with the
foot every outreach email carries.
`/edit/emails/` is linked from the edit page and needs the same sign-in; it shows every email once, with made-up
names and numbers in place of the real ones, and each sentence edits like any other. Words in curly braces, such as
`{site}`, `{code}`, `{listing}` or `{first}`, are filled in when an email goes out, so they stay in the sentence. A
removed sentence is left out of the email, and a gap it would leave in the plain-text version is closed.

In `src/server/groups-api.php` each such sentence is written as `__T("…")` (one double-quoted string, no raw double
quotes inside; typographic ones are fine) and passed through `t()`, which fills the braces; a `/*EMAIL Name*/` comment
before an email names it on the page, and the same name used twice joins the sentences under one heading. The build
(`phpCopy()` in `build.mjs`) replaces each `__T("…")` with the published wording, or `''` for a removed sentence, and
stops if any is left unread. The unit words in the monthly numbers ("3 clicks", "2 more families") are not editable;
the sentences around them are. The emails to the site's own address are not on the page.

One email the site words but doesn't send itself is there too: "Your school is here", the one to people who asked
for a school once it has a page. Its heading, intro and reason line, and the item's title, text and button, go
through `emailCopy()` in `build.mjs` (the sentences are listed under `SITE_EMAILS`, after the server's). The item's
wording is filled in per school and lands in `data/alerts.json` as the alert; the heading, intro and reason travel
in the feed as `added`, and `scripts/send-alerts.mjs` uses them as they are (its own words stand in for a feed that
predates this).

Not editable this way: program and school details (they come from the data files), menu labels, and text
the scripts write as you click (filter counts, the roster).

## Notifications without an app

**Put it on your home screen.** The site is already an app a phone can keep (`manifest.json`, `display:
standalone`, opened at `/?utm_source=homescreen&utm_medium=app`, so analytics can count home-screen visits). Right
after something worth coming back to (following a school, program or camp; saving a favorite or a school; putting
something on a week, a day off or the summer: `homeWorth()` in `site.js`, which reads the same events analytics
gets), a phone that isn't already running the home-screen copy gets a card along the bottom (`homeNudge()`, `.homecard`).
Android: "Add it" opens the browser's own install prompt when it has offered one (`beforeinstallprompt`), otherwise
the two menu steps. iPhone and iPad: the three Share steps, and that the home-screen copy keeps its own sign-in, since
it's also the only way notifications reach an iPhone. Never on a computer or a quiet page (`data-quiet` on `<html>`).
It waits two and a half seconds, shows once a visit and at most three times, two weeks apart, and never again after
"No thanks", "Got it" or an install (`pas-home` on the device). The close button only puts it off.

**"Get the app", always there.** A button in the menu on a phone or tablet (`.nav-app`; not in the menu bar on a
computer), in the footer, and as a card in the Parent Portal's overview (`app` in `OV`, `groups.js`). Where the browser
has offered its own install prompt (`beforeinstallprompt`: Chrome, Edge and Samsung Internet, on Android and on
computers) it opens that; where a browser has the newer `navigator.install()` it uses that; otherwise it opens the
`#getapp` window (`getAppDialog()` in `build.mjs`) at the steps for the device: an iPhone or iPad (Apple doesn't let a
site start the install), an Android browser that didn't offer a prompt, Safari on a Mac (File → Add to Dock), or a
computer whose browser didn't offer one (usually because it's already installed). The buttons stay hidden until
`site.js` adds `html.app-ok`: not when the site is running as the installed app, not in Firefox on a computer (it
can't install a site), and not in a preview build (no manifest). The manifest's `id` is the address it has always
opened at, so copies already installed stay the same app. Analytics hears `pas_home_screen` with `after: button`
(`add` for a prompt, `steps` for the window).

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
  to do it (`POST push_run`) at each hourly run. Outside the morning the same workflow still calls `push_run` every
  hour (a single `curl` step, "The site's hourly jobs"), for the work below that isn't tied to the morning: the
  owner's notes about new accounts and the copy off the host. Anyone can ask, because asking only makes the server do
  what it would do anyway; it answers with counts and states, never who. A dry run of the job asks for counts only.
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
- **Testing.** `PAS_TEST_PUSH` (set only on the test machine; `tests/lib/harness.mjs` sets it) lets a stand-in
  notification service's address through and lets a test choose the day. The stand-in receives what the site
  posts; a test of the push payloads themselves (opening one with a device's keys, and comparing every morning in
  the feed with what the email job would send) is still to be written, see `tests/README.md`.
- **Not checked from here:** a real phone. Whether the host's PHP can make the key is answered by opening
  `groups/api.php?action=push_key`.

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
  next, day by day, from `schoolWeek()`: district days off (or the school's own, from its `calendar`), the last day of school, the school's dates, the weekly
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

## An email to you for each new account

Each new account sends one email to the site's contact address (`tell_owner()` and `signup_note()` in
`src/server/groups-api.php`), except a parent's in digest mode:

- **The sign-up digest** (`"ownerNotes": { "parentSignup": "digest" }` in `site.config.json`, which is set): a
  parent's new account sends nothing at once. With the morning summary on (below, and it is), the summary carries the
  counts and the digest sends nothing. With it off, on the first hourly run after 7 in the morning
  (`signup_digest()`, from `push_run`), one email, "New parent accounts yesterday: N", says how many parent accounts
  were made the day before and in the last seven days. Counts only, no addresses; none on a day with no new parent
  account. `/edit/stats/` keeps the numbers day by day. Take the setting out (or set `"each"`) for an email per
  account again. Program managers' sign-ups keep their own email either way, since each one is a lead.
- **New Parent Account Signup** (without the digest): the email address and name. It goes when the account first
  has a name: at once with Google, after the name step with an emailed code.
- **New Program Manager Signup**: the email address, name and the listing's name. It goes with the account's first
  claim, in place of the plain "Listing claimed" email, and says whether the claim stands or waits for your yes
  (then the subject ends "(claim needs your yes)"). A parent who later claims a listing gets this one as well.
- An account that stops before the name step, or a manager who never claims, is picked up by the hourly job
  (`signup_catchup()`, run from `push_run` on every call, which the hourly workflow now makes every hour) once it is an hour old: the
  email then says "Name: not added yet" or "Listing: none claimed yet". (It used to wait for a run inside the
  morning window, and GitHub's hourly schedule often skips several hours, so a few days of these could arrive at
  once.) The job's log says how many went, never who.

`users.told` records which email went (0 none, 1 parent, 2 manager), so each is sent once. Accounts that existed
before this was added were marked as told. The emails hold nothing about a child, and the privacy page says they
are sent.

## The morning summary

One email to the site's contact address and one notification on the site admins' own devices, each morning, from
the first `push_run` at or after 7:30 (`owner_summary()` in `src/server/groups-api.php`). The mailbox script (below)
calls `push_run` every ten minutes, so that is about 7:30-7:40; without it, the hourly workflow's 7:55 run. `"ownerNotes": { "summary": "on" }`
in `site.config.json` turns it on (it is); `"off"` stops it, and the sign-up digest above comes back. It is editable at
`/edit/emails/` as "The morning summary". What it says, counts and links only, never a parent's address:

- **Published yesterday:** each run pull request merged, by the autopilot or by hand, with what it changed by kind
  (from its evidence file), the answers emailed to senders, managers' photos and words published, and anything undone.
- **Waiting for you:** how many things the Needs-you page holds, by kind (held mail included), with its link, and the
  autopilot's mode.
- **Mail:** emails from people that came in yesterday and how many were held, replies that went from the site's
  address, replies that couldn't be sent this week, and the outreach sender's day (sent against the cap) and week
  (sent, replies, opt-outs, bounces), or that it is paused.
- **New accounts:** parents and program managers yesterday, parents in the last seven days, and the listings claimed.
- **Schools asked for:** the top five, as the private queue counts them.
- **Health:** each run's last pull request, the last answer to the queue, the mailbox script's last check-in (and,
  when it says so, that it can't send from the site's address or what went wrong in its last run), the hourly site
  check (an open "Site check:" issue means failing), the last publish, and the copy of the database off the host.
- **Cost this week:** run pull requests, answers to the queue, the model tokens the runs reported in their outcome
  files, the emails sent through Postmark (the mailer counts them day by day in `phillyafterschool-mail.json`), and
  the emails the mailbox sent (replies and outreach, inside the Google account's own sending limits).
  Klaviyo's profile count isn't readable from the site, which holds no Klaviyo key, so the summary says to look there.

The notification says how many things wait and opens `/edit/needs/`. Notifications go to every device on which an
account at an address in `admins` turned them on (the account page, "Emails and notifications", "Turn on
notifications on this device"), signed in as that address.

**A failed publish is pushed at once.** `push_run` also looks at the last finished `publish.yml` run on main (at most
every nine minutes, `publish_watch()`); a failed one sends one notification, "The site didn't publish", which opens
the Needs-you page, where the link to the run is. Each failure is told once. An email from a person with legal words,
a safety complaint or a sponsor or partner inquiry is pushed the same way the moment it comes in (`owner_push()`, from
`mail_store()`), and a closure alert (Phase 8) will be too.

## The mailbox script

A Google Apps Script inside the contact@ Google account (`mail/Code.gs`, pasted into script.google.com, the way
`analytics/ga4_admin.gs` is) files the site's own notices out of the inbox and hands mail a person wrote to the site.
Nothing outside Google and the site reads the mailbox. Its site side is "the mailbox" in `src/server/groups-api.php`,
with the shared code in `src/server/mail.php`.

**Every ten minutes** (a time trigger on `run()`), each step running even if an earlier one failed:

1. **Sorting the inbox** (the newest 60 threads in it).
   - *Site notices.* The site's mailer adds a header, `X-PAS-Kind`, to every email it sends to its own address:
     `signup`, `suggestion`, `review`, `claim`, `needs-yes`, `manager-content`, `school-ask`, `summary`, and `copy`
     (a publish from `/edit/`); `school-date`, `idea`, `rush` and `copy-email` for the few the forms and the edit
     pages send; `contact` for the contact form. The script labels each `PAS/Site/<kind>` and archives it, except
     `review`, `school-date`, `rush` and `copy-email`, which stay in the inbox with their label because each asks the
     owner to do something no page shows yet (reviews move to the Needs-you page with Phase 6). Older mail, from before
     the header, is matched by its subject. A notice is trusted only when Google's own Authentication-Results header
     says it passed DKIM or SPF for the site's domain; one that claims to be the site's and isn't is labeled
     `PAS/Suspicious` and left in the inbox. The contact form's email is a person's message: it is posted like any
     other, answered at its Reply-To address.
   - *Service mail.* GitHub, Stripe, Postmark, Klaviyo, UptimeRobot, Hostinger and Google (each only when signed by
     its own domain) get a `PAS/Service/<name>` label and are archived. Four kinds stay in the inbox with a star: the
     site check's issue ("Site check:"), a failed payment or a dispute from Stripe, a refusal from Postmark (a bounce,
     a spam complaint, a paused server), and a downtime alert from UptimeRobot.
   - *Bulk mail.* Anything with a `List-Unsubscribe` header is labeled `PAS/Newsletters` and archived. Bounces go to
     `PAS/Bounces` and automatic replies (out of office) to `PAS/Auto-replies`, archived; a bounce of an outreach
     email stops that row's sequence.
   - *Mail a person wrote.* Everything left is posted to the site, one signed request per email
     (`groups/api.php?action=mail_in`), and labeled `PAS/People/Queued` and archived, or `PAS/People/Needs Josh` and
     kept in the inbox when the site holds it. Mail older than the day `setup` first ran is never posted: it stays
     where it is, so nobody gets an answer to a months-old email. A message the site refuses for good is labeled
     `PAS/Suspicious` and left for a person.
2. **Outreach** (below), when it is switched on.
3. **Replies out.** The script asks the site for replies waiting to go (`action=mail_out`), sends each from
   contact@phillyafterschool.org as a reply in its own thread (a contact-form message gets a new email to its
   Reply-To address), changes the thread labels the site asks for (`PAS/People/Answered`, `PAS/People/Done`,
   `PAS/Spam`, or back to Needs Josh), and says what went (`action=mail_sent`). A reply handed out and never confirmed
   is handed out again after 20 minutes, three times at most, and the script remembers the last 400 it sent, so a
   lost confirmation never sends one twice. While the site's address isn't one the account can send from, the site
   hands out nothing.
4. **The site's hourly jobs.** It calls `push_run`, so the private queue, the morning summary, the copy off the host
   and the rest no longer wait on GitHub's scheduler, which often runs late.

**The heartbeat.** `mail_out` is also the script's check-in: its version, whether it can send from the site's address,
which steps went wrong in its last run (a short phrase each, addresses taken out), and the outreach counts. The health
answer shows `mailbox` (`on` once the key file is on the host, `last`, `ageMinutes`, `alias`, `problems`), the hourly
site check fails after two silent hours (or when replies can't leave from the site's address), and the morning summary
says when it last checked in.

**What is posted for a person's email,** and nothing else: the Gmail message and thread ids, the sender's name and
address (and the Reply-To), the subject, the date, the plain text (the first 8,000 characters, with quoted history
trimmed), attachment names, and the SPF, DKIM and DMARC results from the topmost `Authentication-Results` header,
the one Google adds (a sender can add look-alikes lower down, never above it).

**On the site** (`mail_store()`):

- Each request is signed: `X-PAS-Sign: t=<unix time>,n=<one-time value>,s=<HMAC-SHA256 over "<t>.<n>.<action>.<body>">`
  with the secret in `phillyafterschool-mailin.key` next to the public folder and in the script's properties. The
  site refuses anything unsigned, signed with another secret, more than five minutes old or new, or repeated (each
  one-time value is kept for a quarter hour), and shuts an address out for the hour after 30 refusals. Without the
  key file the mailbox answers "off".
- The message is stored sealed (AES-256-GCM, a key of its own derived from `secret.key`, the way a child's details are
  sealed), with a scrubbed copy sealed beside it: email addresses, phone numbers and the words of the sender's own name
  taken out. In clear, only what the host worked out: the sender's domain, whether DKIM passed for it, which listing's
  website shares that domain (a domain many organizations share, like a city's, is only flagged), whether the address
  belongs to an account and its role, whether the thread answers an outreach email, and the sender's token (as in the
  private queue). A settled message's text is dropped after 180 days; the row stays for the counts.
- The hold list (`mail_hold_reason()` in `src/server/mail.php`): text that addresses an AI or asks to skip a rule
  (marked suspicious), legal words, a safety complaint, a request for someone's data, a refund or payment dispute, a
  school district or City address, the press, and a sponsor, partner or advertising inquiry. A held email goes to the
  Needs-you page with a starting draft (editable at `/edit/emails/`); legal, safety and sponsor ones also go to the
  owner's phone at once. Everything else goes to the private queue as an `m…` item (see "The private queue" in
  `docs/listings.md`), where a run answers it.
- Replies are fixed templates filled in by the host, or the owner's own words from the Needs-you page. No sentence a
  run writes is ever sent.

**The outreach sender** (`sendOutreach()`, the same script). It reads the tabs named in `OUTREACH_TABS` of the sheet in
`OUTREACH_SHEET_ID`, starting with "Programs" in the claim-outreach sheet (`Programs=claim`), and sends each row its
next email from contact@ as plain text. The wording comes from the site (`action=outreach_copy`, editable at
`/edit/emails/`): the claim invite (day 0, and day 10; a row whose "Can they claim with this email?" starts with "Not"
gets the version that says to reply), "your school's page is live" (day 0 and day 7) and the camp sponsor invite (three
emails a week apart). The quarterly email with a listing's numbers waits for the numbers export (Phase 9).

- Only weekdays from 9 to 4, New York time, four a run. Caps: 30 a day to start, raised by 10 a week while bounces stay
  under 3% and opt-outs under 2% (with at least 20 sent that week), never above 150; 8% bounced or 5% opted out pauses
  it (`OUTREACH_PAUSED`), which the morning summary says until the owner clears it.
- Every email carries the opt-out line ("reply “stop”") and the postal address (`POSTAL_ADDRESS`, never a home); with
  no postal address nothing is sent. A short "stop" (or "unsubscribe", "remove us"…) in reply notes "Opted out" in
  "Reply / notes" and is never posted to the site; a bounce notes "Bounced"; any other reply is posted (marked as an
  answer to outreach) and notes "Replied". Any of the three stops the row's sequence.
- A row is written to only when its organization published the address ("Email found on" holds the page), its
  listing isn't claimed (the sheet's "Already claimed", or the site's own list of claimed listings), and nobody emailed
  it by hand ("Emailed on" filled with no step from the script). The script fills in "Emailed on", and keeps its own
  two columns, "Outreach step" ("1 of 2 · 2026-12-07") and "Outreach thread", which it adds at the end of the heading
  row the first time.

**Script properties** (Project Settings > Script properties): `MAIL_SECRET` (made by `makeSecret`), `STARTED` (set by
`setup`), and for outreach `OUTREACH_ON` (`yes`), `OUTREACH_SHEET_ID`, `OUTREACH_TABS`, `POSTAL_ADDRESS`,
`OUTREACH_SIGNATURE` (the name it signs with; the site's name if empty). `OUTREACH_CAP`, `OUTREACH_PAUSED` and the
counts are the script's own. `SITE_URL` points it at another copy of the site (the tests do).

**Setting it up,** signed in as the contact@ account:

1. Open script.google.com, New project, name it "Philly After School mailbox", paste `mail/Code.gs` over `Code.gs`, and
   save.
2. Run `makeSecret`. Copy the line it logs into a file named `phillyafterschool-mailin.key` next to the public folder
   on the host (beside `phillyafterschool-postmark.key`). **Never put it in this repository, in an issue or in a
   chat.** The file's name is covered by `.gitignore`.
3. Run `setup` and approve the permissions. It makes the labels and the 10-minute trigger, checks that the site takes
   the secret, and says whether replies can leave from contact@phillyafterschool.org. If not: Gmail > Settings >
   Accounts > "Send mail as", add the address, confirm it, and run `setup` again.
4. Optional, once: run `fileOldMail` (as often as it takes) to file the older notices, service mail and newsletters
   already in the inbox. It never touches mail a person wrote.
5. For outreach: share the sheet with the contact@ account (edit), set the outreach properties, and set `OUTREACH_ON`
   to `yes` once the wording has had its pass.

**Turning it off.** `stopOutreach` (or `OUTREACH_ON` anything but `yes`) stops outreach. Deleting the trigger (Triggers
in the script's left bar) stops the script; the inbox is then as it was. Deleting `phillyafterschool-mailin.key` from
the host makes the site refuse the script (the hourly check stops looking at it, and the site's jobs go back to GitHub's
schedule).

**Limits.** A Workspace account gets 100,000 URL fetches and 1,500 email recipients a day from Apps Script, far above
this use; a run takes seconds, inside the six hours of trigger time a day.
