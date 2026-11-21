# Code map

Written by `scripts/code-map.mjs`. The publishing job rewrites it on `main` after every merge, so it matches `main`.
Don't edit it or commit it from a branch: that copy would conflict. For a branch's own line numbers, run
`node scripts/code-map.mjs --out /tmp/code-map.md`.

Use it to open only the lines you need: find the function here, then read from its line.

## build.mjs (7007 lines)

Run as `node build.mjs`. Reads `data/` and `src/`, writes the finished site to `dist/`.

| Lines | Section | Functions (line) |
|---|---|---|
| 1–76 | (top of the file) | `readJson` 13, `ageStep` 30, `gradesToAges` 32, `agesBetween` 33, `typeIcon` 75 |
| 77–135 | site copy | `copyId` 83, `isRemoved` 87, `T` 88, `copyNow` 101, `emailCopy` 106, `dropEmpty` 119, `stamp` 127, `sharePagePath` 131, `sharePageStamp` 133 |
| 136–157 | helpers | `esc` 137, `link` 138, `expandGrades` 144, `longDate` 151, `checkedOn` 154, `checkedLine` 155, `telHref` 156 |
| 158–170 | validation | `isUrl` 170 |
| 171–479 | links out to programs | `outUrl` 179, `bareHost` 187, `ownHosts` 189, `howToRead` 273, `flat` 275, `namesSchool` 276, `checkList` 279, `isIso` 371, `okDays` 372 |
| 480–809 | page shell | `correctionHref` 495, `dayScene` 500, `weekendScene` 531, `summerScene` 564, `street` 590, `getAppDialog` 629, `layout` 653 |
| 810–815 | calendar files for registration dates | — |
| 816–888 | ↳ days of the week, and days off | `daysText` 817, `daysLine` 818, `pickyDays` 819, `isoAdd` 820, `weekday` 821, `dayDate` 822, `closedDays` 824, `schoolOff` 832, `schoolLastDay` 833, `campsOn` 836, `nextOff` 845, `ordinal` 852, `ordDate` 853, `offSpan` 854, `lowerSeason` 855, `offAsk` 856, `nextOffBar` 857, `ymd` 860, `nextDay` 861, `shortDate` 862, `upcomingDates` 863, `calTitle` 864, `calDetails` 865, `gcalUrl` 866, `icsFile` 870 |
| 889–900 | reviews | `stars` 890, `allReviewsFor` 891, `reviewsFor` 892, `kidReviewsFor` 893, `gradeWord` 894, `kidBy` 896, `monthYear` 897, `schoolShort` 898 |
| 901–937 | pieces shared by the program card and the program page | `gradeText` 902, `gradeStrip` 903, `phoneLink` 908, `contactHtml` 909, `registerText` 910, `datesHtml` 918, `average` 919, `reviewItems` 920, `reviewsBlock` 922, `sourceLinks` 930, `programPath` 931, `fullName` 933 |
| 938–974 | neighborhoods | `hoodSlug` 941, `dayLabel` 943, `daySlug` 944, `dayPath` 945, `schoolHoods` 946, `programHoods` 947, `hoods` 949, `hoodPath` 956, `hoodLinks` 957, `plural` 958, `schoolRow` 961, `haystack` 971 |
| 975–1041 | where things are | `coordsOf` 981, `milesApart` 988, `placesOf` 991, `milesFrom` 996, `milesText` 997, `kindsOf` 998, `saysHelp` 1003, `offersHelp` 1004, `costKinds` 1005, `freeOnlyFor` 1009, `schoolRun` 1012, `campOnly` 1015, `clubGrades` 1017, `clubsOfType` 1018, `clubDays` 1020, `clubBrief` 1021, `clubsByType` 1022, `itemAttrs` 1024, `typeTags` 1025, `mini` 1028, `servedLines` 1030, `programRow` 1034 |
| 1042–1209 | one row for every list | `offBreaks` 1050, `campAgeList` 1056, `shapeFor` 1057, `listRow` 1061, `heroGo` 1094, `planLine` 1097, `nearRow` 1108, `nearMap` 1109, `sortedSchools` 1118, `focusOn` 1119, `schoolSelect` 1120, `focusCard` 1121, `filterBar` 1146, `bulb` 1207, `noMatch` 1208 |
| 1210–1243 | program card | `card` 1211 |
| 1244–1246 | a page per program | `listNames` 1245 |
| 1247–1258 | dates by email | `longDay` 1256, `sendOn` 1258 |
| 1259–1284 | ↳ this week at a school | `weekMonday` 1263, `schoolWeek` 1265, `weekLabel` 1281, `thisMonday` 1283 |
| 1285–1572 | ↳ when did each date reach the site? | `phillyDay` 1291, `firstSeen` 1292, `postedOn` 1315, `dayAfter` 1316, `signupItems` 1320, `noteDays` 1332, `mailUrl` 1334, `mailLink` 1336, `leadPart` 1350, `lateAlertItems` 1396, `alertsFeed` 1426, `alertsBox` 1437, `followBox` 1473, `datesBox` 1497, `stopPage` 1500, `alertsPage` 1512, `servedBy` 1536, `servedSummary` 1538, `servedPills` 1547, `programAddress` 1551, `programTitle` 1559, `fold` 1568 |
| 1573–1798 | a program's page | `campOf` 1578, `partsOf` 1580, `runsStrip` 1582, `kindSection` 1583, `offDatesHtml` 1589, `spotItem` 1613, `spotlight` 1614, `programPage` 1622, `programsPage` 1778 |
| 1799–1887 | program types | `KIND_LIST` 1804, `ofKind` 1806, `typeCount` 1807, `liveTypes` 1808, `typeChips` 1809, `kindSections` 1812, `shapedAll` 1819, `typeSections` 1823, `pageNav` 1836, `typesPage` 1837, `typePage` 1847 |
| 1888–1913 | by day of the week | `byDayPage` 1890 |
| 1914–1922 | pages | `forSchool` 1915, `schoolChecked` 1918, `tally` 1919, `clock` 1920, `gradeSpan` 1921 |
| 1923–1973 | the school finder | `streetKey` 1925, `milesBetween` 1926, `finderData` 1931, `finderBox` 1945, `schoolsPage` 1953 |
| 1974–2406 | a page for each school that isn't covered yet | `uncoveredPath` 1983, `nearTo` 1984, `milesPill` 1985, `nearbyFor` 1986, `askPanel` 1998, `uncoveredSchoolPage` 2011, `uncoveredIndexed` 2068, `schoolRequestPage` 2071, `schoolRequestPhp` 2095, `schoolWeekSection` 2107, `schoolPage` 2143, `homePage` 2223, `neighborhoodsPage` 2309, `neighborhoodPage` 2337 |
| 2407–3008 | terms of use | `termsPage` 2411, `privacyPage` 2507, `supportPage` 2665, `aboutPage` 2691, `suggestPage` 2764, `ideasPage` 2852, `ideasThanksPage` 2891, `thanksPage` 2897, `sendPhp` 2905, `fail` 2912, `field` 2918, `one_line` 2923 |
| 3009–3125 | contact | `contactPage` 3010, `contactThanksPage` 3060, `contactPhp` 3065, `fail` 3072, `field` 3078, `one_line` 3083 |
| 3126 | days off | — |
| 3127–3383 | a page for each day, or break, that school is closed | `fullDay` 3132, `monthDay` 3133, `dayOffPage` 3134, `daysOffBits` 3210, `offFacts` 3240, `headsUpBox` 3247, `dayCampsPage` 3251, `daysOffPage` 3292 |
| 3384–3417 | share groups (accounts, class codes) | `premiumMode` 3389, `PM_PRICE` 3395, `PM_PAY` 3405 |
| 3418–3476 | what each planner looks like, for someone who hasn't signed in | `planExample` 3423 |
| 3477–3691 | the planners, for someone who hasn't signed in | `showIcon` 3498, `miniArt` 3520, `heroCta` 3522, `showExample` 3525, `planShow` 3624, `groupsAttrs` 3691 |
| 3692–3760 | directors | `baseDomain` 3698, `claimMode` 3700, `daysSince` 3723, `staleTold` 3724, `asksFor` 3725, `claimListings` 3729, `listingTools` 3737, `photoSlot` 3745, `premiumSlot` 3748, `spaceSlot` 3750, `claimedMark` 3751, `jumpNav` 3753, `accountHoods` 3755, `groupsScript` 3760 |
| 3761–4015 | small drawings for the account and managers pages, in the site's colors | `artWeek` 3765, `artChip` 3767, `artBox` 3768, `artKid` 3770, `artYearRibbon` 3773, `artPencil` 3783, `artListingKept` 3785, `artStar` 3821, `artBulb` 3822, `artPin` 3823, `artCloudQ` 3824, `artRow` 3826, `accountArt` 3829, `accountPage` 3911, `profilePage` 3996, `movedPage` 4008 |
| 4016–5027 | for the people who manage a program | `CLAIM_GETS` 4018, `CLAIM_GETS_ALL` 4019, `claimDemo` 4027, `directorsPage` 4067, `premiumPage` 4148, `editClaimsPhp` 4275, `tell` 4398, `groupsInfo` 4539, `joinPage` 4544, `groupPage` 4563, `groupsApiPhp` 4575, `phpCopy` 4588, `boardPage` 4609, `rvNames` 4822, `reviewPage` 4823, `reviewThanksPage` 4899, `reviewPhp` 4908, `fail` 4919, `field` 4925, `one_line` 4930 |
| 5028–5093 | sending mail | `pas_mail_key` 5034, `pas_mail_via` 5042, `pas_mail_note` 5044, `pas_mail_state` 5053, `pas_postmark` 5059, `pas_mail_via` 5087, `pas_mail_note` 5088, `pas_mail_state` 5089, `pas_postmark` 5090, `mailerPhp` 5092 |
| 5094–5465 | edit mode | `editAuthPhp` 5103, `edit_key` 5107, `edit_db` 5123, `edit_account` 5145, `edit_admin` 5168, `edit_editor` 5176, `edit_signed_in` 5193, `editSignInPage` 5199, `editIndexPhp` 5213, `editStatsPhp` 5235, `editEmailsPage` 5369, `editEmailsPhp` 5380, `editPage` 5389, `editPhp` 5450, `ghPhp` 5464 |
| 5466–5527 | the weekly run's queue | `editQueuePhp` 5467 |
| 5528–5549 | summer camps | `campAreas` 5548, `seasonPill` 5549 |
| 5550–5603 | summer schedule | `utcDay` 5559, `plusDays` 5560, `mondayOf` 5561, `campWeeks` 5562, `summerPlan` 5589 |
| 5604–5609 | my kids' calendar | — |
| 5610–6026 | Kids' Playground | `mapHood` 5632, `HOOD_AREA` 5692, `mapArea` 5704, `mapAreas` 5705, `surpriseHoods` 5722, `kidsStar` 5759, `kidsDot` 5760, `kidsIcon` 5851, `bingoCard` 5860, `actHits` 5917, `kidsData` 5931, `kidsDataV` 5964, `kidsShowcase` 5969, `kidsHow` 5997, `kidsPage` 6008 |
| 6027–6145 | Account Features | `FEATS` 6031, `featArt` 6034, `featPage` 6066 |
| 6146–6558 | the planners in one place | `schedulesPage` 6148, `todoPage` 6216, `calendarPage` 6255, `summerSchedulePage` 6387, `summerWeeksPage` 6507 |
| 6559–6716 | a page per summer camp | `campPath` 6561, `campLink` 6563, `campAsListing` 6565, `campAges` 6566, `campPrice` 6567, `campHoursShort` 6568, `campWeeksShort` 6569, `summerBlock` 6573, `campPage` 6606, `campMovedPage` 6663, `summerCampsPage` 6677 |
| 6717–6752 | weekend classes | `weekendAreas` 6722, `weekendByArea` 6723, `weekendRow` 6724, `weekendPage` 6729 |
| 6753–6842 | all programs | `allProgramsPage` 6758, `notFoundPage` 6836 |
| 6843–7007 | write | `write` 6845 |

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
