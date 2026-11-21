# Code map

Written by `scripts/code-map.mjs`. Don't edit it by hand: run `node scripts/code-map.mjs` after changing
`build.mjs` or `src/server/groups-api.php`, and the publishing job rewrites it on `main` when the line numbers move.

Use it to open only the lines you need: find the function here, then read from its line.

## build.mjs (7056 lines)

Run as `node build.mjs`. Reads `data/` and `src/`, writes the finished site to `dist/`.

| Lines | Section | Functions (line) |
|---|---|---|
| 1–76 | (top of the file) | `readJson` 13, `ageStep` 30, `gradesToAges` 32, `agesBetween` 33, `typeIcon` 75 |
| 77–135 | site copy | `copyId` 83, `isRemoved` 87, `T` 88, `copyNow` 101, `emailCopy` 106, `dropEmpty` 119, `stamp` 127, `sharePagePath` 131, `sharePageStamp` 133 |
| 136–157 | helpers | `esc` 137, `link` 138, `expandGrades` 144, `longDate` 151, `checkedOn` 154, `checkedLine` 155, `telHref` 156 |
| 158–170 | validation | `isUrl` 170 |
| 171–477 | links out to programs | `outUrl` 179, `bareHost` 187, `ownHosts` 189, `howToRead` 273, `flat` 275, `namesSchool` 276, `checkList` 279, `isIso` 371, `okDays` 372 |
| 478–807 | page shell | `correctionHref` 493, `dayScene` 498, `weekendScene` 529, `summerScene` 562, `street` 588, `getAppDialog` 627, `layout` 651 |
| 808–813 | calendar files for registration dates | — |
| 814–886 | ↳ days of the week, and days off | `daysText` 815, `daysLine` 816, `pickyDays` 817, `isoAdd` 818, `weekday` 819, `dayDate` 820, `closedDays` 822, `schoolOff` 830, `schoolLastDay` 831, `campsOn` 834, `nextOff` 843, `ordinal` 850, `ordDate` 851, `offSpan` 852, `lowerSeason` 853, `offAsk` 854, `nextOffBar` 855, `ymd` 858, `nextDay` 859, `shortDate` 860, `upcomingDates` 861, `calTitle` 862, `calDetails` 863, `gcalUrl` 864, `icsFile` 868 |
| 887–898 | reviews | `stars` 888, `allReviewsFor` 889, `reviewsFor` 890, `kidReviewsFor` 891, `gradeWord` 892, `kidBy` 894, `monthYear` 895, `schoolShort` 896 |
| 899–935 | pieces shared by the program card and the program page | `gradeText` 900, `gradeStrip` 901, `phoneLink` 906, `contactHtml` 907, `registerText` 908, `datesHtml` 916, `average` 917, `reviewItems` 918, `reviewsBlock` 920, `sourceLinks` 928, `programPath` 929, `fullName` 931 |
| 936–972 | neighborhoods | `hoodSlug` 939, `dayLabel` 941, `daySlug` 942, `dayPath` 943, `schoolHoods` 944, `programHoods` 945, `hoods` 947, `hoodPath` 954, `hoodLinks` 955, `plural` 956, `schoolRow` 959, `haystack` 969 |
| 973–1039 | where things are | `coordsOf` 979, `milesApart` 986, `placesOf` 989, `milesFrom` 994, `milesText` 995, `kindsOf` 996, `saysHelp` 1001, `offersHelp` 1002, `costKinds` 1003, `freeOnlyFor` 1007, `schoolRun` 1010, `campOnly` 1013, `clubGrades` 1015, `clubsOfType` 1016, `clubDays` 1018, `clubBrief` 1019, `clubsByType` 1020, `itemAttrs` 1022, `typeTags` 1023, `mini` 1026, `servedLines` 1028, `programRow` 1032 |
| 1040–1207 | one row for every list | `offBreaks` 1048, `campAgeList` 1054, `shapeFor` 1055, `listRow` 1059, `heroGo` 1092, `planLine` 1095, `nearRow` 1106, `nearMap` 1107, `sortedSchools` 1116, `focusOn` 1117, `schoolSelect` 1118, `focusCard` 1119, `filterBar` 1144, `bulb` 1205, `noMatch` 1206 |
| 1208–1241 | program card | `card` 1209 |
| 1242–1244 | a page per program | `listNames` 1243 |
| 1245–1256 | dates by email | `longDay` 1254, `sendOn` 1256 |
| 1257–1282 | ↳ this week at a school | `weekMonday` 1261, `schoolWeek` 1263, `weekLabel` 1279, `thisMonday` 1281 |
| 1283–1570 | ↳ when did each date reach the site? | `phillyDay` 1289, `firstSeen` 1290, `postedOn` 1313, `dayAfter` 1314, `signupItems` 1318, `noteDays` 1330, `mailUrl` 1332, `mailLink` 1334, `leadPart` 1348, `lateAlertItems` 1394, `alertsFeed` 1424, `alertsBox` 1435, `followBox` 1471, `datesBox` 1495, `stopPage` 1498, `alertsPage` 1510, `servedBy` 1534, `servedSummary` 1536, `servedPills` 1545, `programAddress` 1549, `programTitle` 1557, `fold` 1566 |
| 1571–1796 | a program's page | `campOf` 1576, `partsOf` 1578, `runsStrip` 1580, `kindSection` 1581, `offDatesHtml` 1587, `spotItem` 1611, `spotlight` 1612, `programPage` 1620, `programsPage` 1776 |
| 1797–1885 | program types | `KIND_LIST` 1802, `ofKind` 1804, `typeCount` 1805, `liveTypes` 1806, `typeChips` 1807, `kindSections` 1810, `shapedAll` 1817, `typeSections` 1821, `pageNav` 1834, `typesPage` 1835, `typePage` 1845 |
| 1886–1911 | by day of the week | `byDayPage` 1888 |
| 1912–1920 | pages | `forSchool` 1913, `schoolChecked` 1916, `tally` 1917, `clock` 1918, `gradeSpan` 1919 |
| 1921–1971 | the school finder | `streetKey` 1923, `milesBetween` 1924, `finderData` 1929, `finderBox` 1943, `schoolsPage` 1951 |
| 1972–2404 | a page for each school that isn't covered yet | `uncoveredPath` 1981, `nearTo` 1982, `milesPill` 1983, `nearbyFor` 1984, `askPanel` 1996, `uncoveredSchoolPage` 2009, `uncoveredIndexed` 2066, `schoolRequestPage` 2069, `schoolRequestPhp` 2093, `schoolWeekSection` 2105, `schoolPage` 2141, `homePage` 2221, `neighborhoodsPage` 2307, `neighborhoodPage` 2335 |
| 2405–3006 | terms of use | `termsPage` 2409, `privacyPage` 2505, `supportPage` 2663, `aboutPage` 2689, `suggestPage` 2762, `ideasPage` 2850, `ideasThanksPage` 2889, `thanksPage` 2895, `sendPhp` 2903, `fail` 2910, `field` 2916, `one_line` 2921 |
| 3007–3123 | contact | `contactPage` 3008, `contactThanksPage` 3058, `contactPhp` 3063, `fail` 3070, `field` 3076, `one_line` 3081 |
| 3124 | days off | — |
| 3125–3381 | a page for each day, or break, that school is closed | `fullDay` 3130, `monthDay` 3131, `dayOffPage` 3132, `daysOffBits` 3208, `offFacts` 3238, `headsUpBox` 3245, `dayCampsPage` 3249, `daysOffPage` 3290 |
| 3382–3415 | share groups (accounts, class codes) | `premiumMode` 3387, `PM_PRICE` 3393, `PM_PAY` 3403 |
| 3416–3474 | what each planner looks like, for someone who hasn't signed in | `planExample` 3421 |
| 3475–3689 | the planners, for someone who hasn't signed in | `showIcon` 3496, `miniArt` 3518, `heroCta` 3520, `showExample` 3523, `planShow` 3622, `groupsAttrs` 3689 |
| 3690–3758 | directors | `baseDomain` 3696, `claimMode` 3698, `daysSince` 3721, `staleTold` 3722, `asksFor` 3723, `claimListings` 3727, `listingTools` 3735, `photoSlot` 3743, `premiumSlot` 3746, `spaceSlot` 3748, `claimedMark` 3749, `jumpNav` 3751, `accountHoods` 3753, `groupsScript` 3758 |
| 3759–4013 | small drawings for the account and managers pages, in the site's colors | `artWeek` 3763, `artChip` 3765, `artBox` 3766, `artKid` 3768, `artYearRibbon` 3771, `artPencil` 3781, `artListingKept` 3783, `artStar` 3819, `artBulb` 3820, `artPin` 3821, `artCloudQ` 3822, `artRow` 3824, `accountArt` 3827, `accountPage` 3909, `profilePage` 3994, `movedPage` 4006 |
| 4014–5025 | for the people who manage a program | `CLAIM_GETS` 4016, `CLAIM_GETS_ALL` 4017, `claimDemo` 4025, `directorsPage` 4065, `premiumPage` 4146, `editClaimsPhp` 4273, `tell` 4396, `groupsInfo` 4537, `joinPage` 4542, `groupPage` 4561, `groupsApiPhp` 4573, `phpCopy` 4586, `boardPage` 4607, `rvNames` 4820, `reviewPage` 4821, `reviewThanksPage` 4897, `reviewPhp` 4906, `fail` 4917, `field` 4923, `one_line` 4928 |
| 5026–5091 | sending mail | `pas_mail_key` 5032, `pas_mail_via` 5040, `pas_mail_note` 5042, `pas_mail_state` 5051, `pas_postmark` 5057, `pas_mail_via` 5085, `pas_mail_note` 5086, `pas_mail_state` 5087, `pas_postmark` 5088, `mailerPhp` 5090 |
| 5092–5514 | edit mode | `editAuthPhp` 5100, `edit_key` 5106, `edit_token` 5121, `edit_db` 5126, `edit_account` 5148, `edit_admin` 5171, `edit_editor` 5179, `edit_signed_in` 5195, `editSignInPage` 5206, `editIndexPhp` 5228, `edit_cookie` 5233, `editStatsPhp` 5284, `editEmailsPage` 5418, `editEmailsPhp` 5429, `editPage` 5438, `editPhp` 5499, `ghPhp` 5513 |
| 5515–5576 | the weekly run's queue | `editQueuePhp` 5516 |
| 5577–5598 | summer camps | `campAreas` 5597, `seasonPill` 5598 |
| 5599–5652 | summer schedule | `utcDay` 5608, `plusDays` 5609, `mondayOf` 5610, `campWeeks` 5611, `summerPlan` 5638 |
| 5653–5658 | my kids' calendar | — |
| 5659–6075 | Kids' Playground | `mapHood` 5681, `HOOD_AREA` 5741, `mapArea` 5753, `mapAreas` 5754, `surpriseHoods` 5771, `kidsStar` 5808, `kidsDot` 5809, `kidsIcon` 5900, `bingoCard` 5909, `actHits` 5966, `kidsData` 5980, `kidsDataV` 6013, `kidsShowcase` 6018, `kidsHow` 6046, `kidsPage` 6057 |
| 6076–6194 | Account Features | `FEATS` 6080, `featArt` 6083, `featPage` 6115 |
| 6195–6607 | the planners in one place | `schedulesPage` 6197, `todoPage` 6265, `calendarPage` 6304, `summerSchedulePage` 6436, `summerWeeksPage` 6556 |
| 6608–6765 | a page per summer camp | `campPath` 6610, `campLink` 6612, `campAsListing` 6614, `campAges` 6615, `campPrice` 6616, `campHoursShort` 6617, `campWeeksShort` 6618, `summerBlock` 6622, `campPage` 6655, `campMovedPage` 6712, `summerCampsPage` 6726 |
| 6766–6801 | weekend classes | `weekendAreas` 6771, `weekendByArea` 6772, `weekendRow` 6773, `weekendPage` 6778 |
| 6802–6891 | all programs | `allProgramsPage` 6807, `notFoundPage` 6885 |
| 6892–7056 | write | `write` 6894 |

## src/server/groups-api.php (3410 lines)

The accounts API. `build.mjs` writes it into the site as `groups/api.php`, with its settings filled in. Functions
first, then the 81 routes, which live in one `switch` on the method and action.

| Lines | Section | Functions (line) |
|---|---|---|
| 1–81 | (top of the file) | `out` 76, `fail` 77, `b64` 78, `h` 79, `now` 80 |
| 82–271 | where things are kept | `data_dir` 83, `secret` 88, `db` 102, `seal_existing` 229, `q` 245, `row` 246, `val` 247, `bump` 249, `tidy` 254 |
| 272–314 | a copy of the database, once a day | `today_ny` 278, `backup_dir` 279, `last_backup` 280, `backup` 285 |
| 315–443 | a copy off the host, once a day | `offsite_repo` 327, `offsite_token` 328, `offsite_gh` 333, `offsite_key` 346, `offsite_seal` 347, `offsite_open` 352, `offsite_counts` 360, `offsite_state` 370, `offsite_photos_left` 376, `offsite_fail` 384, `offsite_run` 385 |
| 444–450 | slowing down guessing and floods | `who` 445, `too_many` 446, `note` 449 |
| 451–490 | the request | `str` 471, `first_name` 477, `person_name` 482, `group_name` 486 |
| 491–520 | who is signed in | `set_session_cookie` 492, `session_ends` 496, `current_user` 499, `need_user` 515 |
| 521–574 | email | `send_mail` 523, `t` 549, `paras` 556, `email_html` 561 |
| 575–595 | group codes | `new_code` 576, `tidy_code` 582, `code_mac` 583, `code_seal` 584, `code_open` 589 |
| 596–621 | what is kept about a child is encrypted in the file | `seal_key` 604, `seal` 605, `unseal` 612, `by_name` 620 |
| 622–650 | a child's week | `programs` 623, `schools` 636, `school_names` 637, `hoods` 646 |
| 651–674 | a phone number for texts | `phone_clean` 655, `phone_show` 660, `phone_set` 664 |
| 675–928 | following and favorites | `mark_name` 679, `stop_code` 690, `stop_hash` 695, `stop_mark` 696, `muted` 702, `follow_kinds` 705, `only_mark` 712, `follow_on` 716, `follow_off` 730, `follow_off_all` 736, `fav_on` 740, `marks_out` 748, `clean_week` 763, `week_from_full` 783, `week_kid` 797, `week_count` 802, `week_follow` 804, `week_shares` 812, `clean_week_full` 823, `week_out` 848, `grade_list` 851, `kids_list` 853, `clean_summer` 863, `summer_out` 883, `clean_daysoff` 895, `daysoff_out` 918 |
| 929–1211 | the passport | `school_year` 951, `passport_key` 956, `passport_clean` 957, `passport_kid` 1015, `passport_row` 1021, `passport_data` 1027, `passport_suggest` 1033, `passport_out` 1087, `program_pins` 1099, `passport_favs` 1113, `profile_out` 1119, `kid_out` 1125, `membership` 1129, `invited` 1135, `not_invited` 1138, `invite_out` 1141, `send_invite` 1148, `invite_one` 1181, `need_owner` 1193, `my_groups` 1198, `ready` 1210 |
| 1212–1305 | co-parents | `home_id` 1221, `household` 1222, `in_list` 1228, `home_user` 1229, `named` 1234, `coparent_out` 1236, `send_coparent_invite` 1255, `me_out` 1273, `has_family` 1287, `is_admin` 1295, `role_of` 1302 |
| 1306–1339 | directors | `listings` 1310, `base_domain` 1315, `email_domain` 1320, `stats_of` 1325 |
| 1340–1526 | notifications on a phone or computer (web push) | `meta_get` 1345, `meta_set` 1346, `b64u_dec` 1347, `ec_point` 1351, `vapid` 1355, `push_endpoint_ok` 1375, `push_state` 1385, `push_send` 1391, `push_to_user` 1433, `push_feed` 1444, `push_due` 1452, `push_note` 1485, `push_run` 1499 |
| 1527–1665 | premium listings | `premium_mode` 1531, `is_premium` 1536, `holds` 1542, `premium_shows` 1546, `photos_public` 1551, `photos_of` 1556, `social_url` 1565, `post_url` 1580, `extra_live` 1585, `extras_out` 1592, `stats_more` 1605, `premium_out` 1623, `claim_out` 1637, `space_of` 1652, `photo_live` 1657, `photo_file` 1660, `my_claims` 1661 |
| 1666–1698 | asking for a school that isn't covered yet | `school_ask_on` 1670, `tell_owner` 1694 |
| 1699–1872 | emails to the people who run a listing | `listing_url` 1706, `listing_plain` 1707, `mgr_holders` 1709, `mgr_send` 1719, `mgr_prompt` 1732, `mgr_plural` 1745, `mgr_numbers` 1747, `mgr_run` 1760 |
| 1873–2015 | a new account | `signup_note` 1878, `signup_named` 1888, `signup_catchup` 1894, `sign_in` 1900, `http_get` 1929, `google_email` 1942, `edit_key_state` 1967, `edit_key_out` 2002, `year_end` 2007 |
| 2016–3410 | the routes: one `case` per request (listed under Routes) | — |

### Routes

| Group | Routes (line) |
|---|---|
| one more for a listing | `POST hit` 2021 |
| is everything working? | `GET health` 2038 |
| signing in | `POST login_start` 2048, `POST login_finish` 2077, `POST login_google` 2101, `POST email_start` 2112, `POST email_finish` 2139, `GET me` 2174, `GET school_ask` 2182, `POST school_ask` 2188, `POST logout` 2196, `POST logout_all` 2203, `POST set_name` 2211, `POST basics` 2222, `POST phone_save` 2243, `POST hood_save` 2251 |
| following and favorites | `GET marks` 2261, `POST follow` 2268 |
| stopping from an email, with no sign-in | `GET stopped` 2282, `POST stop` 2294, `POST unmute` 2325, `POST follow_synced` 2334, `POST follow_clear` 2347, `POST fav` 2353, `POST listed` 2366 |
| co-parents | `POST coparent_invite` 2375, `POST coparent_resend` 2389, `POST coparent_cancel` 2398, `POST coparent_accept` 2404, `POST coparent_end` 2450, `POST delete_account` 2463 |
| directors | `GET claimed` 2476, `GET photo` 2493, `GET extras` 2517 |
| notifications | `GET push_key` 2526, `POST push_on` 2533, `POST push_off` 2551, `POST push_mode` 2561, `POST push_test` 2570, `POST push_run` 2582, `POST ask` 2611, `POST extra_save` 2648, `POST extra_drop` 2722, `POST photo_add` 2731, `POST photo_drop` 2776, `GET claims` 2790, `POST mgr_mail` 2796, `POST claim_add` 2806, `POST claim_drop` 2838, `POST premium_ask` 2848, `POST space_set` 2873, `POST edit_add` 2889 |
| a profile | `GET profile` 2910 |
| the passport | `GET passport` 2916, `POST passport_save` 2920, `POST passport_reset` 2947, `POST school_save` 2966, `POST grades_save` 2976, `POST ages_save` 2989, `POST kids_save` 3003, `POST week_save` 3030, `POST week_delete` 3049, `POST summer_save` 3064, `POST summer_delete` 3074, `POST daysoff_save` 3081, `POST daysoff_delete` 3091, `POST share_one` 3099 |
| groups | `POST group_create` 3144, `POST group_peek` 3162, `POST group_join` 3175, `POST invite_add` 3221, `POST invite_remove` 3244, `POST kid_save` 3255, `POST sync` 3285, `POST kid_delete` 3313, `GET group` 3321, `POST member_decide` 3347, `POST group_leave` 3370, `POST group_code` 3381, `POST group_rename` 3390, `POST group_delete` 3400 |
