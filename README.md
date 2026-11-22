# Philly After School

A static site: a directory of schools, and one page per school listing after-school
programs with a grade filter. Everything is generated from two data files.

The how-to for the site lives in `docs/`, one file per topic. `CLAUDE.md` is the short version for
agents: the commands, the standing rules and which file to open for a task.

## Topics

| File | What it covers |
|---|---|
| [`docs/setup.md`](docs/setup.md) | **Setup, building and publishing.** What is in the repository, the settings file, the build, and how a change reaches the live site. |
| [`docs/tests.md`](docs/tests.md) | **Tests.** Running the tests, and building the site for a fixed day. |
| [`docs/operations.md`](docs/operations.md) | **Backups, monitoring and sending email.** The accounts database backups, the restore drill, monitoring, and how the site sends email. |
| [`docs/listings.md`](docs/listings.md) | **Schools and listings: adding, editing, keeping current.** Adding a school, editing a listing, the scheduled research runs, the monthly check, the autopilot gate and the Needs-you page. |
| [`docs/pages.md`](docs/pages.md) | **The public pages.** Program, school and neighborhood pages, finding programs, the menu, the map and the small pages. |
| [`docs/camps-and-weekends.md`](docs/camps-and-weekends.md) | **Summer camps and weekend classes.** The summer camp pages and plan, and the weekend classes list. |
| [`docs/planners.md`](docs/planners.md) | **The planners.** Build your week, the days-off and summer plans, the calendar, rosters, and why planners need an account. |
| [`docs/accounts.md`](docs/accounts.md) | **Accounts, profiles and sharing.** Sign-in, accounts, co-parents, share groups, claiming a listing, follows and favorites, the profile and account pages. |
| [`docs/kids-playground.md`](docs/kids-playground.md) | **Kids' Playground.** The kids' section: lightbulbs, pins, the map, the showdown, bingo and Plan my week. |
| [`docs/program-managers.md`](docs/program-managers.md) | **Program managers, premium listings and reviews.** What managers can do, premium listings, the monthly numbers, space, granting a claim by hand, and reviews. |
| [`docs/emails.md`](docs/emails.md) | **Editing the wording, and emails to parents.** The /edit/ wording and email editor, date emails, push notifications, this week at your school, the owner notes, the morning summary, and the mailbox script with the outreach sender. |
| [`docs/search-and-analytics.md`](docs/search-and-analytics.md) | **Search engines and analytics.** Being found by search engines, analytics, and telling parents and managers apart in it. |

## Every section, and where it is

The docs refer to each other by section name ("see \"Site admins\""). This list finds the file.

- [`docs/setup.md`](docs/setup.md)
  - [What's here](docs/setup.md#whats-here)
  - [Before launch](docs/setup.md#before-launch)
  - [Build](docs/setup.md#build)
  - [How changes reach the site](docs/setup.md#how-changes-reach-the-site)
  - [Rebuilt every night](docs/setup.md#rebuilt-every-night)
  - [Changing the site's address](docs/setup.md#changing-the-sites-address)
  - [Site admins](docs/setup.md#site-admins)
- [`docs/tests.md`](docs/tests.md)
  - [Tests](docs/tests.md#tests)
  - [Building for another day (tests only)](docs/tests.md#building-for-another-day-tests-only)
- [`docs/operations.md`](docs/operations.md)
  - [Backups, and knowing when something breaks](docs/operations.md#backups-and-knowing-when-something-breaks)
  - [Sending email](docs/operations.md#sending-email)
- [`docs/listings.md`](docs/listings.md)
  - [Edit a listing](docs/listings.md#edit-a-listing)
  - [Add a school](docs/listings.md#add-a-school)
  - [A school's clubs, listed one by one](docs/listings.md#a-schools-clubs-listed-one-by-one)
  - [Keeping it current](docs/listings.md#keeping-it-current)
  - [The autopilot gate](docs/listings.md#the-autopilot-gate)
  - [The Needs-you page, the log, Undo and the switch](docs/listings.md#the-needs-you-page-the-log-undo-and-the-switch)
- [`docs/pages.md`](docs/pages.md)
  - [Schools that aren't covered yet](docs/pages.md#schools-that-arent-covered-yet)
  - [Terms of use](docs/pages.md#terms-of-use)
  - [Where things are: distances and the map](docs/pages.md#where-things-are-distances-and-the-map)
  - [Program pages](docs/pages.md#program-pages)
  - [Finding programs: filters, types and the school finder](docs/pages.md#finding-programs-filters-types-and-the-school-finder)
  - [Neighborhood pages](docs/pages.md#neighborhood-pages)
  - [The menu](docs/pages.md#the-menu)
  - [The suggestion form](docs/pages.md#the-suggestion-form)
  - [The contact page](docs/pages.md#the-contact-page)
  - [Links out to programs](docs/pages.md#links-out-to-programs)
  - [Links down a long page](docs/pages.md#links-down-a-long-page)
  - [What's new](docs/pages.md#whats-new)
  - [All programs, by kind](docs/pages.md#all-programs-by-kind)
- [`docs/camps-and-weekends.md`](docs/camps-and-weekends.md)
  - [Summer camps](docs/camps-and-weekends.md#summer-camps)
  - [Weekend classes](docs/camps-and-weekends.md#weekend-classes)
- [`docs/planners.md`](docs/planners.md)
  - [My kids' calendar](docs/planners.md#my-kids-calendar)
  - [Signed up, or still to: ticks on the days-off plan and the to-do list](docs/planners.md#signed-up-or-still-to-ticks-on-the-days-off-plan-and-the-to-do-list)
  - [Days of the week, days off, and a saved school](docs/planners.md#days-of-the-week-days-off-and-a-saved-school)
  - [Rosters](docs/planners.md#rosters)
  - [The planners need an account](docs/planners.md#the-planners-need-an-account)
  - [The plan as a calendar](docs/planners.md#the-plan-as-a-calendar)
  - [Eddie in his sunglasses](docs/planners.md#eddie-in-his-sunglasses)
  - [The planners in one place](docs/planners.md#the-planners-in-one-place)
- [`docs/accounts.md`](docs/accounts.md)
  - [Accounts, profiles and sharing](docs/accounts.md#accounts-profiles-and-sharing)
  - [Follow and favorites](docs/accounts.md#follow-and-favorites)
  - [Tabs on the profile, the account and the listings page](docs/accounts.md#tabs-on-the-profile-the-account-and-the-listings-page)
  - [My profile and the account page](docs/accounts.md#my-profile-and-the-account-page)
- [`docs/kids-playground.md`](docs/kids-playground.md)
  - [Kids' Playground](docs/kids-playground.md#kids-playground)
- [`docs/program-managers.md`](docs/program-managers.md)
  - [Your listing this month](docs/program-managers.md#your-listing-this-month)
  - [Is there space](docs/program-managers.md#is-there-space)
  - [Reviews](docs/program-managers.md#reviews)
  - [Premium listings](docs/program-managers.md#premium-listings)
  - [What stays free](docs/program-managers.md#what-stays-free)
  - [The way in for program managers](docs/program-managers.md#the-way-in-for-program-managers)
  - [Emails to program managers about their listing](docs/program-managers.md#emails-to-program-managers-about-their-listing)
  - [Giving a listing by hand](docs/program-managers.md#giving-a-listing-by-hand)
- [`docs/emails.md`](docs/emails.md)
  - [Editing the site's wording](docs/emails.md#editing-the-sites-wording)
  - [Notifications without an app](docs/emails.md#notifications-without-an-app)
  - [Dates by email](docs/emails.md#dates-by-email)
  - [This week at your school](docs/emails.md#this-week-at-your-school)
  - [An email to you for each new account](docs/emails.md#an-email-to-you-for-each-new-account)
  - [The morning summary](docs/emails.md#the-morning-summary)
  - [The mailbox script](docs/emails.md#the-mailbox-script)
- [`docs/search-and-analytics.md`](docs/search-and-analytics.md)
  - [Parents and program managers, told apart](docs/search-and-analytics.md#parents-and-program-managers-told-apart)
  - [Being found by search engines](docs/search-and-analytics.md#being-found-by-search-engines)
  - [Analytics](docs/search-and-analytics.md#analytics)

A map of the main functions in `build.mjs` and `src/server/groups-api.php`, with line numbers, is in
[`docs/code-map.md`](docs/code-map.md). The publishing job rewrites it.
