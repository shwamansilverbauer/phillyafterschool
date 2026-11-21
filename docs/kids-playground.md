# Kids' Playground

## Kids' Playground

`/kids-playground/` (`kidsPage()` in `build.mjs`, `src/kids-corner.js`) is a page of each child's own, inside a parent's
account, made for ages about 5 to 10 as a cartoon arcade in the site's own colours (the deep Philly blue, sky blue and
Bell Yellow): shiny pins that level up, a level that climbs, a cartoon map of Philadelphia that clears as they explore
it, a bulb of their own that dresses up as they level up, and lightbulb showdowns that rank their favorites. Eddie Bulboa,
the bulb in the logo (`bulb.png`, the logo's own art), shows kids around, says what to do next, and hosts the showdowns. It is the only
part of the site meant to be handed to a child, so it is built the other way round from the rest. (It was called the
Passport at first, then Kid's Corner: `/passport/` and `/kids-corner/` redirect here, as `/features/kids-corner/` does
to `/features/kids-playground/`; `?next=passport` still works, and the server's endpoint and table keep the Passport
name. The code keeps the Kid's Corner one: `src/kids-corner.js`, `assets/kids-corner.json`, the `kc-` classes, the
`kc-open` and `kc-mute` keys on the device, and `tests/cases/23-web-kids-corner.mjs`.)

- **"For kids", on the open site.** `kidsShowcase()` is a band in Kids' Playground's own look, said to the child: four
  tiles (pins, a lightbulb to dress up, the map with surprises and secret spots, picking a favorite), Eddie, and
  "Grown-ups: make a free account" (`register/?next=kids`), followed by "How it works" for the grown-up (`kidsHow()`).
  Both are on Kids' Playground's Account Features page (`/features/kids-playground/`, see "Account Features") and on Kids'
  Playground itself for someone signed out. The site is for parents and doesn't push it: someone signed out finds it
  under Account Features in the menu, and the Kids' Playground button is only there once a parent is signed in. Nothing
  on the home page or the planners points to it. Its drawings are made in the build (`artBulb()`, `artPin()`); no real child's page is shown anywhere.
- **On a laptop** the Pins / Bingo / Map / Showdown tabs sit under the child's header and stick with it, instead of the
  phone's bar at the bottom; Eddie's welcome is one centred, framed card.

- **Kid mode.** From the picker ("Who's playing?") on, `html.kc-kid` hides the site's header, menu, hero and footer,
  and nothing on the page is a link or asks for typing. The grown-ups' corner opens from a press-and-hold button
  (`.kc-hold`, 1.1 seconds; a tap does nothing). With one child on the account the page opens on their page; the
  address keeps the tab (`#pins`, `#map`, `#battle` for the Showdown tab).
- **Eddie's welcome.** The first time a child opens their page (`seen.intro` not set), Eddie shows them round in six
  steps, one big button each (`drawTour()`): hello; making their bulb (the bulb picker, then back to the welcome);
  the pins they already have and their level (shown here, so they aren't unwrapped again afterwards); the map and its
  secret spots; picking a favorite; and off they go. "Skip" goes straight to the page (what's new is unwrapped there
  as usual). The grown-ups' corner can play it again.
- **Starting over.** For a grown-up who tried it out first: "Start over" on the child's card in the Parent Portal's
  Kids' Playground tab, or in the grown-ups' corner, takes two taps (`startOver()`, `POST passport_reset { kid,
  classes? }`). The bulb, what was shown (Eddie's welcome too), the level celebrated and the showdown favorites go;
  the confirmed classes stay unless "Also take off the classes" is ticked, and then the child's row goes.
- **Each child's bulb.** On first visit a child lights up a bulb of their own: one of ten shapes and ten colours, picked
  by tapping (`BULB`, `KID_COLORS`; Bell Yellow first). It stands in the header (tap it to change), on the picker, on
  the map and in the cheering corner of every showdown. It starts plain; as the child's level climbs it unlocks things
  to wear (`WEAR`: 16 items in six places, hat, face, neck, back, glow and base, from shades at level 2 to a galaxy
  glow at 12, and four more won at bingo: a party hat, balloons, confetti and the champ ribbon, see "Bingo"), and the
  child picks one per place under "Dress up". A level-up shows what it unlocked, with "Try it on!". Locked items show
  their level (or the bingo that wins them); the server keeps only items it knows (`KC_WEAR`). (Monsters picked before the bulbs became the bulb in the same
  place in the list, on the server and on the page.)
- **What counts.** Only what a parent has confirmed. The server suggests from the household's plans
  (`passport_suggest()`: every program on a child's kept week, each camp whose week has started, each day-off program
  whose day has passed, once per listing per year, with how many times the plans have it: days a week, weeks of the
  same camp, days off) and the parent says yes or no in the grown-ups' corner, or adds one the plans missed. One
  already confirmed comes back ("now 3 days a week, was once") when the plans count it more; no to that count isn't
  asked again (`skip` gets `k|kind|y|n`). The grown-ups' corner has a − / + for the times on each one too. A listing with several sites (Philly Art Center, say) lands on the map only once the parent says
  which site.
- **Pins.** `KIDS_PINS` in `build.mjs`, 41 of them, each with five levels: bronze, silver, gold, emerald and diamond
  (the counts are each pin's `tiers`). On the Pins tab they come in sections, one per `group`, each its own shape:
  - **Classes** (a circle): one per program type (names in `KIDS_PIN`), at 1, 3, 5, 8 and 12.
  - **Secret Philly pins** (a keystone): eleven that show as a "?" with only a riddle ("Somewhere old, a famous bell has a
    crack in it… and it wants some music!") until found, and are revealed with a burst of their own ("SECRET PHILLY
    PIN!"). Eight are a mix of a kind of class and a part of the map (`mix:type:area`; the pairs are the fewer of the
    two, so one music class in Old City is a pair by itself), at 1, 2, 3, 5 and 8: Liberty Bell Ringer (music and
    Old City), Ben Franklin's Kite (science and Old City), Billy Penn's Hat (theater and Center City), Cheesesteak Champ
    (games and South Philly), Boathouse Rower (sports and the Art Museum), Wissahickon Wanderer (nature and the
    Northwest), Heron Spotter (nature and the Southwest), Pennypack Pathfinder (sports and the Northeast). Bulboa
    Knockout (Eddie with his boxing gloves up) counts rounds: a sports class, a class in South Philly and one around the
    Art Museum (`mix:movement:south:parkway`); its map colors both parts. The other two are Broad Street
    Crosser (a class on each side of Broad: `BROAD` in `kids-corner.js`) and Jawn Collector (different
    programs). Once found, the close-up says how many ("You have 2 music + Old City pairs!"), names the classes that
    counted for each half (for Broad Street, which side each was on) and gives the plain rule for leveling up ("To level
    up: Do a music class AND a class in Old City or Society Hill. Each pair counts!", `rule`); the place pins add a small map with
    that part of Philly colored in and the famous thing circled.
  - **All year** (a shield): after school, weekends, days off, summer (weeks of camp), and Year-Rounder (each kind in
    each school year).
  - **Explorer** (a star): Neighborhood Hopper (2, 4, 6, 9, 12), City Sampler (parts of the map), Secret Spotter and
    Surprise Sleuth (what the map has turned up).
  - **Combos** (a rounded square): Mix Master (kinds tried), Triple Threat (music, theater and dance or sports), Lab &
    Easel (science and art), Brains & Bounce (reading and sports).
  - **Super fan** (a hexagon): the Repeater Reward (each time after the first at the same listing: 1, 5, 10, 15, 25;
    shown with a burst of its own, "REPEATER REWARD!", and each bulb in the collection wears its "×3"),
    Comeback Kid (the same listing in another school year), Tag Team (a class a brother or sister also went to; only
    in a household with two or more children), Showdown Judge (classes ranked), Home Base and Pickup Pro (a class that
    runs in, or picks up from, the school it was confirmed under: the listings' `r` in the Playground's data).
  The newer pins have a `how` that `stats()` counts, a `get` (how to earn the first level, said to the child) and
  `one`/`many`.
  - **Program pins** (a rosette): a premium listing's own pin (see "Premium listings"), counted by the times a child
    went there, at 1, 2, 3, 5 and 8. They come with the household's Kids' Playground (`ppins` in `GET passport`: only
    for programs a child there has gone to, only once the owner has published the pin, and only while premium is "on"
    or for the owner's test listing). The Pins tab shows a program pin only once it's earned, never as a goal or a
    "?", and it isn't counted in "12 / 40 pins". It carries no link or offer. The account page's Kids' Playground tab
    tells parents what program pins are.
- **Bingo** (the Bingo tab, `drawBingoTab()`): a 5×5 card for each school year and another for each summer, the same
  card for every child, with Eddie's free square in the middle. The school year's card runs until the last day of
  school (`lastDay` in `data/days-off.json`), then the summer's (`boardNow()`); the cards are `KIDS_BINGO` in
  `build.mjs` (each square's label, what Eddie says when it's tapped, and its icon). Eighteen squares are classes a
  parent confirmed for that school year or that summer (the first class, after school, a weekend class, a day-off
  camp, three days a week, a sports, arts, "brainy" or games class, a neighborhood new to the child, two
  neighborhoods, a secret spot, a surprise, both sides of Broad Street, a class at or from their school; the summer's
  card counts weeks of camp, camps and kinds of camp instead), worked out in `bingo()` from `stats()` over that
  season's classes. Six are things done on the page that season, kept as they happen: a showdown, a new look for the
  bulb, a new pin, a pin going up a level, a new level, a secret Philly pin. The easy diagonal (the first class, after
  school or a second camp, the free square, a new pin, a new look) comes early; the whole card takes a busy year (free
  programs, rec centers and libraries count like any other). Five in a row is a bingo: new squares are daubed one by one when the tab is opened (a dot on the tab
  says there are some), then "BINGO!". The first three bingos ever win a party hat, balloons and confetti for the
  bulb. Each card also has a pin of its own ("Bingo 2026–27", a ticket shape) that goes bronze at its first bingo,
  then silver, gold and emerald (2, 3, 6) and diamond for the whole card (all twelve rows), which also wins the champ
  ribbon and turns the top of the tab into a certificate ("Sam filled the whole 2026–27 bingo card! — Eddie Bulboa")
  that the grown-ups' corner prints ("Print the Bingo Champ certificate"; before that, "Print the bingo card"). The
  card pins show under "Bingo pins" on the Pins tab once they have a bingo, and aren't counted in "12 / 41 pins".
  What's kept, in `seen`, is four numbers a card, so the server checks them (`passport_clean()`): `bingo:y2026` the
  squares already shown daubed (a bit each, in reading order), `bingo:y2026:m` the things done on the page
  (`BINGO_MARK`, six bits), `bingo:y2026:l` the bingos celebrated (the card's pin keeps the best, like a level) and
  `bingo:y2026:f` the whole card. Summer cards are `bingo:s2027`.
  Drawn as SVG in `drawPin()`, grander at each level: bronze is the badge and a star; silver adds a
  laurel, a blue banner, a gem and more stars; gold adds a turning sunburst, wings, a gold laurel, a crown, red
  ribbons and twinkling sparkles; emerald turns it green, with a bigger wing and more sparkles (`GRAND`,
  `METAL`); diamond is icy blue with a diamond on the crown. Five stars on the banner at the top. On a phone the tab
  fits three pins a row. The server keeps which level of each pin a child has been shown (`seen`, 1 to 5).
- **Levels.** Paced on purpose: points are 10 a class or camp, 3 a repeat, 3 a neighborhood and 1 a pin level
  (`stats()`); `LEVELS` and `TITLES` turn them into "Explorer · Level 4" with a bar to the next. A first class is level 2,
  a busy first year (eight classes and camps, some going more than once) level 4, 40 classes about level 8, and Legend
  (level 11) about 70. A level once reached is kept (`lvl`, the last one celebrated): if the points ever count for less,
  the child stays at it and the bar fills toward the next from where the points are.
- **Celebrations.** Pins whose level went up since the child last looked, secret spots and surprises found on the
  map, and a new level, wait behind a present to tap open (sounds can only start after a tap), then pop in one by one
  (or all together past three), then the spots, then the surprises ("SURPRISE! … You found it in Fairmount!"), then
  the level up. What was shown is saved (`seen`, with `map:<area>` for the spots and `hood:<neighborhood>` for the
  surprises; `lvl`; the server keeps up to 120 keys) so it is celebrated once.
- **The map** is drawn on the page from `data/philly-map.json` (served as `assets/philly-map.json`): the city's 159
  neighborhoods, its outline, the Delaware along its edge, the Schuylkill, and a dozen landmarks, all in map units.
  `scripts/philly-map.py` makes it from OpenDataPhilly's "Philadelphia Neighborhoods" (Robert Cheetham, CC BY 4.0)
  and Natural Earth's rivers (public domain), with the Schuylkill past Center City redrawn by hand; run it again only
  if a source changes. Neighborhoods are under clouds until the child has been to a class there; each program's
  bulb stands where it is, the child's own at the latest place. The build places every listing's site on a map
  neighborhood (`mapHood()`: by its point, else by name, through `MAP_ALIAS`) and notes any name it can't place.
  Drag, pinch or the buttons zoom; a tap says what is there, and Eddie waits at the top of the Art Museum steps. The
  neighborhoods explored are named under the map, and a tap on one glides the map in on it, lights up its outline and
  says what's there (`showHood()`; a jump instead of a glide for someone who asked for less motion). No map service, no
  tiles: nothing is fetched from anywhere else.
- **Secret spots.** `MAP_AREAS` in `build.mjs` cuts the city into areas (the Parkway, Center City, Old City, South
  Philly, the Northwest, the Southwest, the Northeast), each with one to three famous things: the map's landmarks, and
  a few more placed by latitude and longitude (`MAP_EXTRA`: Elfreth's Alley, the Italian Market, the covered bridge,
  the wildlife refuge, Pennypack Park). Each starts as a "?" cloud and is found in order as the child goes to classes
  nearby: the first with one listing in the area, the next with two, the last with three. Each area is the
  neighborhoods Philadelphians would call it, listed by name in `AREA_HOODS`: Old City and Society Hill; Center City
  (Vine to South between the rivers, less those two and Logan Square); the Art Museum and the Parkway (Fairmount,
  Spring Garden, Logan Square, East Park); South Philly (everything below South Street east of the Schuylkill, Queen
  Village and Graduate Hospital included); Southwest, Northwest (Germantown, Mount Airy, Chestnut Hill, Roxborough,
  Manayunk, East Falls) and Northeast Philly. West Philly, North Philly and the River Wards are in no area for now. A
  listing site counts for the area of the neighborhood the program itself names (what parents see on its page), or,
  when that isn't one on the map, of the neighborhood its address falls in (`mapArea()`, as `a` on the site). `LANDMARK` and
  `LANDMARK_SAY` in `kids-corner.js` draw each one and say something about it; a tap on a "?" says how many more
  classes nearby it needs. (No Rocky statue: it's the film's character.)
- **Surprises in every neighborhood.** Each map neighborhood that has a listing or a school in it (51 of them) has one
  or two little Philly things hiding in it: a soft pretzel, water ice, a hoagie, a trolley, a rowhouse stoop, a mural,
  a basketball hoop, a kite, a duck, a stoop cat, a bike, an apple tree, window flowers, a boombox, an open hydrant or
  a pigeon (`SURPRISE_KINDS` and `surpriseHoods()` in `build.mjs`, as `surprises` in `kids-corner.json`: a
  neighborhood's name, its middle, and its one or two kinds, picked by a hash of its id so they don't change from
  build to build; two where it has two or more places). The first class in a neighborhood finds its first surprise,
  a second listing there finds the second. They stand beside the neighborhood's middle once found; a second one
  still hiding is a bobbing "?" (`.kc-surq`) that says to go to one more class there. A tap says what it is and
  where it was found (`SURPRISE`, `SURPRISE_NAME` and `SURPRISE_SAY` in `kids-corner.js`). The tally under the map's
  heading counts them beside the secret spots.
- **Bulbs and the showdown.** Each program type is a family of bulbs (`SPECIES`: a bulb shape, something to wear,
  a special move), its glass tinted with the type's colour, and each program a member of it, varied by its id (eyes,
  mouth, freckles, shades). `drawBulb()` draws them; a lit bulb glows, and the class `off` puts its light out. The
  showdown pairs the child's distinct listings until one is left, each pair in one of eleven Philly contests that take
  turns from a random one (`EVENTS`, ordered so the food ones don't come back to back; `?contest=steak` on the page
  starts with a given one): a race up the Art Museum steps; a cheesesteak eating contest (the rolls go in bites; "Wiz…
  Wit… EAT!"); a Ben Franklin kite fly-off (the winner's kite goes highest, lightning finds the key on its string and
  it sparks); a Liberty Bell ring-off (meters fill, then the bell swings, its crack lights up and it rings); a water ice
  slurp-off (the winner empties its cup, the other gets a brain freeze: a shiver and snowflakes); a Boathouse Row
  regatta (lit-up boathouses at night, both shells row up the river to the far bank, the winner first); a Mummers
  strut-off (a feathered parasol on Broad Street); a hoagie build-off (the layers drop on, and only the winner's gets
  the top of the roll); a pothole dodge (the road rolls under each bike, and the winner hops every pothole while the
  other hits the last); a soft pretzel stack-off (pretzels pile up in a pyramid in front of each); and a mural
  paint-off (paint flies at a wall under each, and the winner's gets all five parts). Each winner gets its own sign
  ("CLEAN PLATE!", "HIGHEST!", "LOUDEST!", "SLURPED!", "FIRST!", "BEST STRUT!", "BEST HOAGIE!", "SMOOTH RIDE!",
  "BEST STACK!", "MASTERPIECE!"); in the regatta the signs go where the boats were, since the bulbs row up to where
  they would sit. The question is
  always the same and plain, "Which did you have more fun at?", with the contest as a label under it: the child taps
  the one they had more fun at, Eddie counts them in, the winner pulls out its special move (notes, paint, lightning, dice…), and the other
  comes second and cheers ("Good race!"). Nobody gets hit and no light goes out: it was boxing at first, changed so
  parents needn't mind. The order they dropped out in is saved as `fav`. With reduced motion set, the moves and
  confetti are skipped.
- **Sound** is made on the page with the Web Audio API (`Sound`): nothing plays until the first tap, and the mute
  button is remembered on the device (`kc-mute`).
- **The data.** `passports` in the accounts database, one row per child per household (by first name, the way weeks
  match), encrypted like the plans: `{ done: [{ k: "p:<program>" | "c:<camp>", kind: after | weekend | off | summer,
  y: <year>, s: <school or "">, h?: <site's neighborhood>, n?: <times, 2 to 20> }], skip: [suggestion keys the parent waved away],
  fav: [listings, best first], av?: { b: <body>, c: <colour 0-9>, w?: { <place>: <item> } }, seen?: { <pin>: <level> }, lvl?: <level>,
  plan?: [{ d: mon…sun, o: [2 to 6 kinds of class], r?: [the same, best first, once played] }] }`.
  `GET passport` gives every child on the kids list with all of that and the suggestions, and `school` (the account's,
  or the household's); `POST passport_save { kid, done, skip, fav, av?, seen?, lvl?, plan? }` replaces one child's
  lists, and keeps `av`, `seen`, `lvl` and `plan` when they are left out. Co-parents share them (on accepting, the other account's rows are copied to the home account, same first names
  merge; the other account keeps its own for if the link ends).
  Deleting the account deletes them. Pins and levels are never stored, only which were already celebrated.
- **Plan my week** (since November 16, 2026). For a child who won't choose: on the account page's Kids' Playground
  tab or in the grown-ups' corner (`planBox()`), a parent picks a day and two to six kinds of class from
  `KIDS_ACTS` in build.mjs (soccer, karate, drums, sewing and so on, 27 of them; the server takes only those ids).
  Each kind is drawn as a classic bulb dressed for it (`GEAR` in kids-corner.js: a karate gi and black belt, a soccer
  ball, a drum, a sewing tape measure), with its own special move (`move`, `shot`). The child's page calls them to
  help ("Help plan Monday!", and a dot on the Showdown tab); the Showdown tab shows the choices, and "Pick Monday!"
  plays them off two at a time in the usual contests, asking "What do you want to do on Mondays?" (`startPlan()`,
  `planChamp()`). The order they drop out in is saved as the day's `r`, and the next day waits. Back with the parent,
  each played day shows the order and the classes that fit the winner (`planFits()`): at or near the account's school
  on that weekday (in the school first, then picking up from it, then near it, on that day when the listing gives its
  days, for the child's grade when both say), or a weekend class that day; a school's clubs count one by one. When
  nothing fits the winner, the next in line's. Each has "Add to a week", which opens the week builder on that program
  at that day (`board/?add=&school=&day=`, the day marked `.asked` and focused). Which listings are each kind is worked out by the build
  (`actHits()`: the words in a listing's name, "what" and keywords, or a club's name, plus club tags and listing
  kinds) and travels in `assets/kids-corner.json` as `acts`, with each listing's days (`d`), weekend days (`w`),
  grades (`g`) and nearby schools (`nb`). Starting a child over clears the plan. Nothing about it is counted on Kids' Playground or the account page; the week
  builder counts a program picked from it like any other (`pas_program_pick` with method `plan_my_week`, no child).
- **Favorites.** `GET profile` carries `favorites: [{ name, fav }]`, and the accounts script hands them to each
  planner (`favorites()` on `window.pasBoard`, `pasSummer` and `pasDaysOff`): Build your week shows the child's
  favorite programs as chips under the search, and the summer and days-off choosers list a favorite camp or program
  first, marked "★ Sam's favorite". Matching is by the child's first name, the way plans match.
- **Share and print.** The grown-ups' corner makes a picture (`drawShare()`, a canvas) of the pins, the level and the
  child's bulb, with no name and no map, and is never a link; the page itself has no link to share.
- **On the account page.** A Kids' Playground tab (between Account and Favorites) shows each child at a glance: their
  bulb, level, pins, neighborhoods, classes, the whole showdown ranking best first (`rankList()`, also a Favorites
  panel in the grown-ups' corner), and the suggestions waiting for a yes or no, answered right
  there. "Add a class or camp" opens, in the card, the same search of the site's programs and camps (with what kind
  and when) as the grown-ups' corner's "Add one the plans missed" (`addForm()`), for one no plan had; a listing with
  several places asks which in the grown-ups' corner. Buttons open the child's own page (straight to them, past the picker: `sessionStorage` "kc-open", on the
  device only) or the grown-ups' corner ("Playground Portal": confirming classes, favorites, sharing, starting over). It loads `kids-corner.js` and `assets/kids-corner.json` (the same data the
  page has inline) only when the tab is opened, through `window.pasKids.summary()`; the account page's
  `data-kids` and `data-kids-data` say where they are.
- **Kid reviews.** Each confirmed program in the grown-ups' corner links to the review form with the child's name and
  grade filled in (see Reviews).
- **Quiet.** No analytics, no recordings, nothing to Klaviyo, out of search (`quiet: true, noindex: true`), and no
  `track()` anywhere in `kids-corner.js`. `tests/cases/17-api-passport.mjs` and `23-web-kids-corner.mjs` cover it.
