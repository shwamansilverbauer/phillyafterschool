# Program managers, premium listings and reviews

## Your listing this month

A manager who has claimed a listing sees its numbers on `/managers/`: how many times it was opened, clicks to sign up,
clicks to its website, times it was put on a family's plan, and people who asked for its emails, for the last 30 days
(and the 30 before, once counting has run that long), with page views day by day.

- **What is kept.** One row per listing, kind and day in the `hits` table: `view`, `signup`, `site`, `plan`, `email`
  (`HIT_KINDS`). A number, and nothing about who. Rows older than 400 days are deleted.
- **How it is counted.** `hit()` in `site.js` posts the listing and the kind to `groups/api.php?action=hit`: a view when a
  program's or camp's own page is opened (once per tab, via `sessionStorage`), `signup` and `site` when a register,
  camp or website link is followed from its page or its card, `plan` when it is added to a week, a day off or a summer
  week, and `email` when someone signs up for its emails. Nothing else goes with it.
- **What is left out.** A browser driven by a script, the owner while editing, and a listing's own manager while signed
  in. More than `HITS_AN_HOUR` counts from one internet address in an hour are dropped; for that the server keeps a
  keyed hash of the address in the `throttle` table for up to two days, as it already does for sign-in attempts.
- **Who sees it.** `claim_out()` adds `stats` to each claim the signed-in account holds. `/edit/stats/` lists the 40
  most-opened listings for the owner. There is no public view.
- The preview copy counts nothing.

## Is there space

A place with more than one listing (an after-school program and a camp, say) signs in once on `/managers/`, is shown
every listing at its website address, and can claim them all with one button. Each claimed listing then has its own
update form and space question on that one page.

A manager whose claim stands can mark a listing "Spots open", "Waitlist" or "Full" on `/managers/` (or "Don't show").
It is one of three fixed words, so it goes on the listing at once, without review, with the day it was set
(`space_set`; table `space`). It stops showing after 30 days (`SPACE_DAYS`) unless set again, and when nobody holds
the claim. The public `claimed` request carries it, and pages fill their `[data-space]` slots from that: the program
page, its card on school pages, weekend cards and camp cards. This is free and stays free.

## Reviews

Reviews are approved before they appear. The form at `/review/` emails each review to `contactEmail`, with a
ready-made entry at the bottom of the email. To publish one, paste that entry into
`data/reviews.json` (inside the square brackets, entries separated by commas) and commit.
To remove a review, delete its entry. Cards show the average and the reviews for each program.

A review can be **in a child's words**: the parent types what the child said (from Kids' Playground's grown-ups' corner,
where each confirmed program has a "Review in Sam's words" link, or by switching on the form). The entry then carries
`"kid": { "grade": "2", "name": "Sam" }`, with `name` only when the parent ticked "show the first name"; without it the
review is signed "A 2nd grader at Nebinger". Kids' reviews are shown beside parents' on the program's page behind a
Parents | Kids switch (`reviewsBlock()`), never make the rating (the average and the count are parents' reviews only),
and are left out of the page's structured data. The build checks the grade and the name's shape.

### Asking for reviews

The site asks the people most likely to have something to say: parents with a program on their week. All of it is
worked out in the browser (`RV` in `site.js`, also `window.pasReview`), from the rosters on the device, and nothing
about it is sent anywhere.

- **What the device remembers** (`pas-rv` in the browser): the day it first saw each program on a roster (`s`), the
  programs reviewed from this device (`d`), the ones never to ask about (`n`), and the day it last asked (`t`).
- **When it asks.** A program is asked about once it has been on a current week for 14 days, or on an upcoming week
  for 45 (it may not have started). One program at a time, and after any answer ("Write a review" sent, "Not yet",
  "Don't ask about this one") nothing is asked for 30 days. The numbers are `WAIT` at the top of `RV`.
- **Where.** On Build your week (`#rv-nudge`, under the roster) and on My profile, under the card. The
  profile also counts programs on weeks kept in the account. Adding `?rv=now` to either address shows the question
  straight away, to look at it.
- **Quieter places.** My profile's card has a "Reviews" row with a link for each program on their weeks. A program's
  own page says "This one is on your week" above its review button, or, once a review has been sent from that
  device, that it was sent. The thank-you page after a review lists the other programs on the week.
- **Less typing.** The form starts on the school saved on the device, and for someone signed in it fills in their
  first name and email address (one request to the accounts service, `me`).
- **Program managers** get "Ask your families for a review" under a claimed program on `/managers/`: the link to
  the form with their program chosen, and a short message to paste. The wording asks them to send it to every
  family. Camps are left out, because the form reviews programs only.
- **Counting.** `pas_review_nudge` goes to the data layer with `nudge_action` (shown, open, later, never),
  `program_id` and `nudge_place` (week or profile). The profile loads no analytics, so only Build your week is
  counted.

## Premium listings

Built, and kept out of sight until there is a way to pay for one. A premium listing adds, on top of everything a
claimed listing already has: up to six photos and a logo, a section in the program's own words, an offer or event
line, a button parents use to send the program a question, fuller numbers, and a flyer. It never
changes where a listing appears in a list, and it has no say over reviews.

- **The switch.** `"groups": { "premium": ... }` in `site.config.json`: leave it out (or `false`) and nothing premium
  exists anywhere; `"preview"` and the tools work, but what a program adds shows on its listing only to the people
  who hold that listing, signed in; `true` (or `"on"`) and everyone sees it. `PAS_PREMIUM=preview|on` overrides it
  for a test build. The site runs on `"on"`.
- **The sign-up page** (`premiumPage()` in `build.mjs`, at `/premium/`) is where a manager signs a claimed listing
  up. It is built whenever premium isn't off and `"groups": { "premiumPrice": ... }` is set. While premium is
  `"preview"` it is **unlisted**: nothing links to it, it carries `noindex`, and it is left out of the sitemap. Once
  premium is `"on"` (`PM_LISTED` in `build.mjs`) it is in the sitemap, open to search engines, and pointed to from
  four places, all of them for people who run a program and none on a page a parent uses:
  - **In each claimed listing's box on the managers page** (`premiumTease()` in `groups.js`), on a tab of its own
    called "Premium", after the listing's own tabs: one dashed box that leads with the listing's own number of
    visits when there are at least 20, lists the eight things premium adds, and gives the price. The tab is always
    there and never in the way, so there is nothing to dismiss. A listing that has signed up sees where to finish;
    a premium listing has no such tab and sees its tools on the other tabs instead. Nothing pops up, and nothing is
    repeated elsewhere on the page.
  - **A panel on the managers page** (`#premium-cta`, after "What claiming gets you"): what premium adds in one
    sentence, "See what premium adds" and the price, for people who haven't claimed yet.
  - **The menu's button, for a manager.** Signed in as a program manager (the device keeps `pas-role`, and now
    `pas-premium` from `me.premium`: whether every listing the account holds is premium), `site.js` turns the
    menu's "Parent Portal" button into a yellow "Go premium" that opens `/premium/`, or "Your listings" (the managers
    page) once every listing they hold is premium, or while the premium page isn't listed. Parents see no change. A
    manager who is also a parent (`pas-parent`: kids named or plans kept) keeps Parent Portal and Kids' Playground, gets
    "Your listings"/"Go premium" as a plain link before My Profile, and on a wide screen About and the Suggestion Box
    leave the bar (`html.nav-both`; they stay in the phone menu and the footer). If a menu still wouldn't fit on one
    line, `fitNav()` closes it up a step or two (`nav-tight`, `nav-tighter`) rather than squeeze the logo.
  - **One sentence on the managers page**, in the list under "How claiming works", for people who haven't claimed.
  - **One line at the end of the monthly numbers email**, only for an account with no premium listing.
  - **The page itself** is laid out like a product page: the two prices sit in the hero, each with its own
    "Sign up yearly" / "Sign up monthly" button (`?plan=year#signup`, `?plan=month#signup`, which the picker at the
    foot starts on), then a sticky strip of links to each part with a "Sign up" button at its right (`pageNav()` with
    a `.pagenav-go`), then "What premium adds" as seven numbered cards (`.pm-gets`; the seventh, the Kids' Playground
    pin, isn't on the example listing), the example listing whose dots match
    the cards, "How it works" in three steps (`.pm-steps`), what it doesn't do, and a closing part (`#signup`) with
    the prices again beside the sign-in box. No testimonials, nothing invented.
  - **Prices** are `"premiumPrice": { "month": 19, "year": 190, "laterMonth": 29, "laterYear": 290 }`, whole dollars.
    The two "later" numbers are the regular price the founding price gives way to; leave them out and the founding
    paragraph goes. The page promises that a founding price is kept while the program stays signed up.
  - **Signing up charges nothing on the site.** The box (drawn by `groups.js`, `#premium-signup`) asks a signed-in
    manager to pick monthly or yearly for each listing whose claim stands. `premium_ask` keeps the plan with the
    claim (table `premium_asks`, one row a claim, gone with the claim or the account) and emails the owner
    ("A premium sign-up needs your yes: ..."). `/edit/claims/` shows "Signed up: yearly" beside the listing, next to
    "Make it premium". Picking the same plan again does nothing; picking the other changes it and tells the owner.
  - **Paying** is by two Stripe Payment Links the owner makes in Stripe, one monthly and one yearly, set as
    `"premiumPay": { "month": "https://buy.stripe.com/...", "year": "https://buy.stripe.com/..." }`. A link is a
    public address, not a key: no Stripe key is ever in this repo. With both set, a signed-up listing shows "Pay on
    Stripe", and the link carries `client_reference_id` (the listing's key with `:` turned into `_`, such as
    `p_coco-academy`; never a name or an email address) so the payment in Stripe can be matched to the listing.
    Nothing tells the site a payment came in: the owner sees it in Stripe and presses "Make it premium". Without the
    links the page says nothing is charged yet. The build warns if links are set while premium is still "preview".
  - **Sandbox links.** Links made in Stripe's sandbox start `https://buy.stripe.com/test_`. While those are the
    ones in the settings, the page says so: the button reads "Pay on Stripe (test)", a line says no real payment is
    taken, and the thank-you after a `cs_test_` checkout says no money moved. Swapping in the live links removes all
    of that. `PAS_PM_PAY=off` makes a test build with no links; `PAS_PM_PAY="monthly,yearly"` one with other links.
  - **Coming back from Stripe, and counting the sale.** Each Payment Link is set (in Stripe, under "After the
    payment") to send the payer to `https://phillyafterschool.org/premium/?paid=year&session_id={CHECKOUT_SESSION_ID}`
    (`paid=month` on the monthly link; Stripe fills in the id). The page thanks them, pushes a Google Analytics
    `purchase` event to the data layer (`transaction_id` is Stripe's checkout id, `value` and `items` are the plan
    and its price, `pas_test` is true for a sandbox checkout) plus `pas_premium` with step `paid`, and then takes
    `paid` and `session_id` off the address. A checkout id is counted once a browser (`pas-paid-seen`), and an
    address with no well-formed Stripe id reports nothing, so typing `?paid=year` by hand can't invent a sale.
    Pressing "Pay on Stripe" pushes `begin_checkout`. None of these carry the listing or the person. The address
    proves nothing about payment, so it never turns premium on. Nothing can be measured on Stripe's own checkout
    page; in Google Analytics, list `stripe.com` under unwanted referrals so the visit isn't credited to Stripe.
- **Test listings** (`data/test-listings.json`) are two hidden pages for the site's owner to see the manager's side
  on: `/programs/test-listing-premium/` and `/programs/test-listing-free/`. Each is an ordinary program record plus
  `claimDomain` (the email domain that may claim it; the claim stands at once) and, on the first, `"premium": true`,
  which makes it premium with no payment and no switch (`premiumAlways` in the server's settings; the review page
  shows "always: a test listing"). They are never added to the programs list, so no list, count, search, filter,
  sitemap, alert or data file has them; their pages carry `noindex` and nothing links to them. On the managers page
  a search by name doesn't find them, but signing in with an address at the claim domain offers the listing, the
  way it does for any listing at your own address. A school under `schools` only shapes how the test page reads.
  What is added to the premium one still goes through the review page before it shows.
- **Which listings are premium** is a row in the `premium` table. For now the owner sets it by hand on
  `/edit/claims/` ("Make it premium" beside each claimed listing); a payment would set the same row later. Turning
  it off hides what was added and keeps it. By the rule under "What stays free", a free program can simply be made
  premium at no charge.
- **Everything waits for a person.** Photos, the logo, the words, the offer line, the social links and the Instagram
  posts each go to `/edit/claims/` to
  be published or declined, and the manager is emailed either way. In `"preview"` those emails say that only they
  can see it for now.
- **Photos.** The `photos` table gained a `kind` (`photo` or `logo`). A premium listing keeps up to
  `PREMIUM_PHOTOS` approved photos: the newest sits at the top of the listing, the rest make the gallery. The older
  single-photo extra (`"groups": { "photos": true }`) still works on its own. `GET photo` serves one photo by `id`;
  a waiting photo only to the people who hold the listing.
- **A pin in Kids' Playground** is a row in `extras` too (`kind` `pin`, its `body` `{"n": a name of up to
  `PIN_NAME_MAX` characters, no web addresses, "c": one of ten colors, "i": a picture from `PIN_ICONS`}`). The
  manager names it, picks a color and a picture on the "Words & offer" tab, with a preview drawn by `kids-corner.js`
  (`window.pasKids.programPin()`, loaded on that page only when the box is there), and it waits on the review page
  like the words ("Kids' Playground pin"). The guardrails: a child gets it only after going to the program, it's
  never shown as something to go and get, it has no link, logo or offer, and every program counts toward all the
  other pins the same way.
- **Social links and Instagram posts** are rows in `extras` too. `social`: the program's own accounts on
  `SOCIAL_SITES` (Instagram, Facebook, TikTok, YouTube), typed as an address or a handle and kept as plain addresses
  (`social_url()`; anything on another site is refused), as `{"ig": …, "fb": …}`. `posts`: up to `POSTS_MAX` (3)
  public Instagram posts or reels the manager picks, from the link Instagram copies, kept as
  `https://www.instagram.com/p/…/` or `/reel/…/` (`post_url()`). Automatic "latest posts" would need every program to
  connect its account to a Meta app of ours that has passed Meta's app review, so the manager picks them instead. The
  review page shows each link to open and check, and the manager is asked to pick posts where no child can be named
  or recognized up close. On the listing: "Follow <program>" with a pill per account, and "From <program> on Instagram" as plain
  links plus a "Show the posts here" button; only that tap adds Instagram's own embeds and loads
  `https://www.instagram.com/embed.js`, with a line saying Instagram may set its own cookies (`pas_instagram` is
  counted when it's tapped).
- **Words and offers** are rows in `extras` (`kind` `words` or `offer`, `status` new, ok or declined). Words are
  plain text, 40 to `WORDS_MAX` characters. An offer is one line of up to `OFFER_MAX` characters with a last day,
  no more than `OFFER_DAYS` ahead, after which it stops showing by itself.
- **Questions.** `POST ask` emails the question to everyone who holds the listing, with the parent's address as the
  reply-to. Nothing is stored except a count (`ask` in `hits`, and in the daily tally). A hidden box catches
  scripts, and there are limits per internet address, per email address and per listing a day.
- **Fuller numbers** (`stats_more()`): each month for up to a year, how many accounts follow and have saved the
  listing, and which schools its visitors had saved (`hits_school`: listing, school, month, a number). The school
  goes along with a page view only when the browser has one saved, and is only kept while premium isn't off.
- **The flyer.** It is drawn in the manager's browser (`flyer()` in `groups.js`): one
  letter-size picture with a QR code to the listing. The code comes from `src/qr.js`, a small encoder written for
  this (byte mode, level M, versions 1 to 10), loaded only when a flyer is asked for. `scripts/qr-check.py` checks it
  against the Python `qrcode` library, grid for grid, and by reading the codes back; run it after any change. The
  flyer's link carries `utm_source=flyer`. (The website badge used to be here; it now comes with every claimed
  listing, see "Being found by search engines".)
- **On the listing** (`premiumSlot()` in `build.mjs`, drawn by `site.js`): the offer line near the top, "In their
  own words" with the logo and a line saying the program wrote it, "Follow <program>", "From <program> on
  Instagram", "Photos", and "Ask a question". The page asks the
  accounts service (`GET extras`) only when it needs to: in `"preview"`, only for a signed-in visitor; when on, only
  if the public list of claimed listings names it. School pages show the offer line on the program's card. Add
  `?premium=demo` to any program's or camp's address to see a made-up sample.
- **Still to do before it opens:** taking payment, a page that sells it (`/managers/` still says paid extras are
  planned for later), and a lawyer's read of the terms for paid listings.

### An advertising page (an idea, not built)

A separate page of paid placements, so programs have a way to be found by families who don't know them yet, without
any listing or search result being reordered. Everything on it would be labeled as paid ("Sponsored"), and nothing
paid would appear anywhere else. The word matters: the site says its listings are not endorsements, so a paid
placement is advertising, not an endorsement.

## What stays free

Decisions that later features have to respect:

- Parents never pay for anything on the site. The one thing that could reopen this is the cost of sending reminder
  emails growing out of hand. (Real versions of the Kids' Playground pins, made to order, are planned as something a
  parent can choose to buy for a pin their child has earned; nothing on the site depends on them, and they are never
  offered on the child's own screens.)
- A free program's listing stays free, including claiming it and keeping it up to date.
- The plan is that more parents using the site is what makes it worth a program manager's while. Paid placement
  (clearly marked advertising) is a possibility for later, only once there is a real use for it.

## The way in for program managers

The strip above the menu (signed-out visitors) carries "Run a program or camp? Claim your listing" on the left and
"Log in" on the right. The sign-up page opens with two cards, "Parent or caregiver" (this page) and
"Program manager", which goes to `/managers/`: that page is where a manager's account is made, by claiming a
listing, and where a program that isn't listed yet is sent in. (The log-in page has no cards: it is the one form,
and the closing band says a manager's account is the same account.) The footer's About column links to the managers
page, and every listing ends with the claim box (`listingTools()`).

## Emails to program managers about their listing

An account that holds a standing claim is emailed about its listing (`mgr_run()` in `src/server/groups-api.php`).
All three are sent by the morning job (`push_run`), never because of something a visitor did:

- **The month's numbers**, the first morning of each month: how many times the listing was opened in the last 30
  days (and the 30 before, once counting has run that long), clicks to sign up and to the website, times it was put
  on a plan, people who asked for its emails. Then one thing to do (`mgr_prompt()`), the first that applies: say
  whether there's space (never said, or the answer ran out), send in a sign-up date (none still to come), ask
  families for a review (none published), or propose an update. A claim less than `MGR_FRESH_DAYS` old is skipped.
- **A review was published.** The build hands the server each program's count of published reviews (`r` in the
  listings it passes, beside `u`, "has a sign-up date still to come"). When a count goes up, the listing's managers
  are told, with a link to the reviews. It says they have no say over reviews.
- **New followers**, at most once a week: how many more families started following the listing in the last seven
  days. A number, never who, and the listing's own managers aren't counted. It is skipped on the morning the
  month's numbers go.
- **A question about the listing.** The build hands the server each listing's open questions (`a`): a listing's
  `asks` (a check found the site and the listing disagreeing on something the program told us) and any `told` entry
  older than 120 days with nothing newer covering it. Each goes once, by its id, to everyone holding the listing that
  morning (`mgr_asked` in `meta` remembers), with the question in a yellow box and "Reply to this email, or open your
  listing's tools and propose a change". Nothing on the listing changes until the answer is in and checked; the
  managers page is where a change is proposed.

The first time the job runs after this was added it only records where things stand (`mgr_month`, `mgr_week` and
`mgr_rv` in the `meta` table), so nobody gets a backlog. Each email ends with "Stop the emails about your listing",
which opens `/alerts/stop/` with the account's stop code and `k=m:listing`: the page asks first, then turns off
`users.mgr_mail`. The same switch is a tick box under "Your listings" on `/managers/`. Emails about a claim, and
about things a manager sent in (changes, photos), are not affected by it. `/edit/stats/` counts each kind sent.

## Giving a listing by hand

A claim normally needs an email address at the listing's own website. For someone the owner knows runs a program
whose address isn't there (a studio that uses Gmail), `/edit/claims/` has "Give a listing to an account by hand":
the account's email address and a listing. The account has to exist already and have a name on it. The claim is
stored like any other, with `domain` set to `by hand` (the list of claimed listings says so), the person is
emailed, and from then on everything a manager can do works for it, including being made premium. Nothing on the
public site can do this: the form is behind the edit sign-in and its own token.
