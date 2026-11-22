# Search engines and analytics

## Parents and program managers, told apart

Every account is one or the other. A **manager** holds a claim (approved or waiting) or made the account on
`/managers/` (`users.origin`); everyone else is a **parent**. `role_of()` in `src/server/groups-api.php` decides,
and `me` returns it as `role`. Four places use it:

- **The numbers page** (`/edit/stats/`): tiles for parents and for program managers with an account, and rows
  for new accounts of each kind per day (`account_parent`, `account_manager`). This is the exact count.
- **Tag Manager, GA4.** Before Tag Manager loads, every page that loads it pushes `pas_role` (`visitor`,
  `parent` or `manager`) and `pas_signed_in` (`yes` or `no`) to the data layer (`roleHead` in `build.mjs`). The
  word comes from `localStorage` (`pas-role`), written by `noteRole()` in `src/groups.js` after a sign-in on this
  device. The import file sends them with every page view and event as `visitor_role` and `signed_in`; register
  both in GA4 (Admin > Custom definitions) as event-scoped dimensions. `pas_signup` carries `role` (which page:
  `parent` for `/register/`, `manager` for `/managers/`) and `account` (`new` or `returning`).
- **Clarity.** The same script sets two custom tags, `role` and `signed_in`, so recordings and heatmaps filter by
  them (Filters > Custom tags). Nothing to set up.
- **Klaviyo.** An account goes onto the accounts list with `has_account: true` and `role`, and its profile also
  carries `home_school` and `neighborhood` when the account has them. A manager's profile
  also gets `claimed_listings` (the names of the listings they hold), updated from `/managers/`. Segment on
  `role equals manager` or `role equals parent`. People who only asked for dates by email have no `role`: they
  are on the dates list with `school`, `programs` or `camps`.

It is a word for counting: no name, address or listing goes to analytics with it. The privacy page says so.

## Being found by search engines

Four things, all built by `build.mjs` unless it says otherwise.

- **A page for each day off still ahead** (`dayOffPage()`), at `/days-off/<name>-<date>/`, such as
  `/days-off/election-day-2026-11-03/`. Its heading names the day once and the lede gives the date, with the
  calendar's check date in the fine print at the end. It lists the camps whose own sites name that day (each card:
  hours, cost and ages as rows when the camp posts them, then the summary; "Save to your plan for Nov 3" first,
  then "Sign up on the camp's site", then "Full listing"), with the same search box and age, type and area filters
  as the list pages once more than two camps are posted (`filterBar()` + `itemAttrs()` on each card), then the
  programs that run days-off camps but haven't posted this one, and links to the day before and after. The title is what a
  parent would type ("Election Day 2026: day camps in Philadelphia"). A day with no camp posted yet is built but
  marked `noindex` and left out of the sitemap, so search engines aren't handed an empty page; it joins the
  sitemap by itself the first night a camp is posted for it. The days list on `/days-off/` and the next-day-off
  strip link to these pages. Once a day has passed its page is no longer built, and `.htaccess` sends its old
  address to `/days-off/` for good.
- **Dates in the sitemap that mean something.** Each address's `lastmod` is the newest real date behind that page:
  when a listing was last checked, a link last confirmed, a review published, a school added, a camp checked. A
  list page takes the newest date among what it lists. Pages that are only words (about, terms and the like)
  carry no date, and the privacy page carries `privacyUpdated` from `site.config.json`. Nothing is stamped "today"
  just because the site was rebuilt, since search engines stop trusting dates that always say today.
- **IndexNow** (`scripts/indexnow.mjs`, run as the last step of the publish job). Before publishing, the job saves
  the sitemap the live site is serving; after, the script compares it with the new one and sends Bing (and the
  search engines that share IndexNow) only the addresses that are new or whose date moved. `indexNowKey` in
  `site.config.json` is not a secret: the build writes it to a file of the same name at the site's root, which is
  how the search engine checks the note came from this site. If the key is taken out, nothing is sent. The step
  can't fail a publish. To see what would be sent without sending: `node scripts/indexnow.mjs old.xml
  dist/sitemap.xml --dry`. Google doesn't take IndexNow; it reads the sitemap.
- **A badge for every claimed listing** (the managers page, in `groups.js`). Any manager with a confirmed claim
  gets a small picture (`src/static/badge.svg`) and a line of HTML to paste into their own website, or a plain
  text link if their site can't take a picture. It links straight to their listing with nothing added to the
  address, so each one is a clean link to this site from a local program's own site. It is free and has nothing
  to do with premium.

## Analytics
`analytics/gtm-import-ga4-clarity.json` imports into the GTM container (Admin > Import Container, "Merge", overwrite
conflicting). It adds a Google tag, one GA4 event tag per event below, and Clarity. The GA4 and Clarity IDs live in the
"GA4 Measurement ID" and "Clarity Project ID" variables. Every event's parameters are `DLV - <name>` data layer
variables, so a new parameter means a new variable and a row on that event's tag. Clarity gets every `pas_` event by
name through one trigger (`CE - any pas_ event`), so a new event needs nothing on the Clarity side.

The GA4 property's own setup lives in a Google Sheet, "Philly After School GA4 Admin", with `analytics/ga4_admin.gs`
bound to it as an Apps Script (Extensions > Apps Script, plus the Google Analytics Admin API service, v1alpha). Its
tabs are the custom dimensions (one per parameter below), custom metrics, key events, "create event" rules
(`account_created`, `manager_account_created`, `listing_claimed`, `register_click`), property and stream settings
(retention, Google signals, enhanced measurement, data redaction), annotations and audiences. "Check GA4" reports
what differs; "Apply" makes GA4 match the sheet. It only ever adds dimensions, metrics, annotations and audiences;
key events and rules marked N are removed. A new parameter is a row on the Dimensions tab and an Apply. GA4 registers a
parameter name as a dimension or a metric, never both, so the Metrics tab's rows stay off while their parameters are
dimensions; a metric needs its own parameter name from Tag Manager.

Klaviyo's own site script (`static.klaviyo.com/onsite/js/<public key>/klaviyo.js`, keyed by `alerts.klaviyoKey`) loads on
exactly the pages Tag Manager does and never on the quiet ones, so a visit from a Klaviyo email is tied to its profile
and "Active on Site" works; the privacy page says so. It sends no events of its own.

Set `gtmId` to load Google Tag Manager on every page. Every page view and event carries `visitor_role` and `signed_in`
(see "Parents and program managers, told apart"). The site pushes these events to the data layer:

- **Finding things.** `pas_filter` (filter_type, filter_value, school): filter_type is `kind`, `program_type`, `grade`,
  `age`, `relation`, `neighborhood`, `cost`, `day` or `school`. `pas_filter_open` (school, from). `pas_search`
  (search_term, results, school) fires when someone pauses typing in a school page's search box; searches with zero
  results show what parents want that isn't listed. `pas_near` (from: school, me, zip, hood or off) and `pas_map_open`.
  `pas_hero_tab` (hero_tab: after, off, summer or weekend) when someone picks a tab of the home page search by hand, and
  `pas_hero_search` (hero_tab; place: zip, neighborhood or none; day_off: next, later or all, on the Days Off tab) when
  that search sends them to a list. Never which ZIP code or neighborhood. `pas_school_pick` (school,
  covered) when someone picks a school in the finder, `pas_school_request` (school) when they ask for one that isn't
  covered, `pas_school_save` (school) when they save a school as theirs, `pas_school_notify` (school).
  `pas_program_pick` (program_id, method): method is `home_search`, `roster_search`, `program_page`, or `plan_my_week` (from Kids' Playground's "Plan my week" classes, with the day picked).
- **Moving around a page.** `pas_page_view` (view) fires when someone switches a page's view by hand: the roster's
  `week`, `cost`, `card` and `keep`, or the day-camps page's `who` and `days`. It doesn't fire for the view a page opens
  on. (The planners' List, Month, Who's open and Make it a calendar switches report through `pas_summer` and
  `pas_dayoff` instead, as `action: view_list`, `view_cal`, `view_chart` or `view_card`.) `pas_menu_group` (group, open)
  is a section of the phone menu opened or closed. `pas_offbar` (action, day) is the next-day-off bar closed.
  `pas_home_screen` (action: shown, add, steps, dismiss, later or installed; platform: ios, android, mac or desktop; after: the event that
  brought the card) is the "Put it on your home screen" card.
- **Leaving the site.** `pas_outbound` (link_type, program_id, school): link_type is `register`, `website`, `calendar`,
  `review` or `camp`; school is empty on a program's own page. `pas_support_click` (plan: once or month, which of the
  Support page's two buttons), and `pas_support_thanks` (plan) once per checkout when someone comes back from paying a contribution on Stripe
  (`/support/?thanks=1&session_id={CHECKOUT_SESSION_ID}` on the Payment Link; `pas_test` marks a test-mode checkout
  and the tag skips it). The amount never reaches the page or analytics.
- **Planning.** `pas_board_add` (program_id, school, day, method, board, children) and `pas_board_share` (method,
  board): methods include `image_save`, `image_share` and `print`; `cta_click` is the "Share this schedule" button
  under the week, which leads to the card, a click rather than a share. `pas_theme_week` (theme, school, method).
  `pas_dayoff_pick` (program_id, day, method), `pas_dayoff` (action, days_planned, children), `pas_summer` (action,
  weeks_covered, children), `pas_todo` (action, days: a camp day ticked as signed up on the To do page),
  `pas_group_share` (method), `pas_cheer` (what: a milestone celebrated once).
- **Accounts and asking.** `pas_signup` (step, method, role, account), `pas_plan_tour` (planner, view: a signed-out
  visitor flipping through a planner's tour), `pas_plan_cta` (place, next), `pas_account_ask` (place), `pas_favorite`
  (action, listing, place), `pas_alert_signup` (school, program_id, camp_id, place): the address is never sent to
  analytics. `pas_ask` (program_id, listing_kind): a question sent through a listing, never the question or who asked.
- **Reviews.** `pas_review_nudge` (nudge_action, program_id, nudge_place) and `pas_review_submit` (program_id, school,
  stars). `pas_suggest_submit` (suggest_kind, school).
- **Managers only.** `pas_claim` (step), `pas_premium` (step, plan), and the sale as GA4 ecommerce: `begin_checkout`
  and `purchase` with an `ecommerce` object; a Stripe test-mode checkout is marked `pas_test: true` and the tags skip it.
- `pas_role` (pas_role, pas_signed_in) is a state push, not a GA4 event: it updates the two variables above the first
  time a device learns which kind of account signed in.

Nothing pushed names a child, a parent, a camp someone's child is going to, or a listing where the rules say not to
(see "Privacy"). Listing counts are numbers only.
