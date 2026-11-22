# Code map

Written by `scripts/code-map.mjs`. The publishing job rewrites it on `main` after every merge, so it matches `main`.
Don't edit it or commit it from a branch: that copy would conflict. For a branch's own line numbers, run
`node scripts/code-map.mjs --out /tmp/code-map.md`.

Use it to open only the lines you need: find the function here, then read from its line.

## build.mjs (7025 lines)

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
| 4016–5034 | for the people who manage a program | `CLAIM_GETS` 4018, `CLAIM_GETS_ALL` 4019, `claimDemo` 4027, `directorsPage` 4067, `premiumPage` 4148, `editClaimsPhp` 4275, `tell` 4398, `groupsInfo` 4539, `joinPage` 4544, `groupPage` 4563, `groupsApiPhp` 4575, `queuePhp` 4586, `phpCopy` 4595, `boardPage` 4616, `rvNames` 4829, `reviewPage` 4830, `reviewThanksPage` 4906, `reviewPhp` 4915, `fail` 4926, `field` 4932, `one_line` 4937 |
| 5035–5100 | sending mail | `pas_mail_key` 5041, `pas_mail_via` 5049, `pas_mail_note` 5051, `pas_mail_state` 5060, `pas_postmark` 5066, `pas_mail_via` 5094, `pas_mail_note` 5095, `pas_mail_state` 5096, `pas_postmark` 5097, `mailerPhp` 5099 |
| 5101–5472 | edit mode | `editAuthPhp` 5110, `edit_key` 5114, `edit_db` 5130, `edit_account` 5152, `edit_admin` 5175, `edit_editor` 5183, `edit_signed_in` 5200, `editSignInPage` 5206, `editIndexPhp` 5220, `editStatsPhp` 5242, `editEmailsPage` 5376, `editEmailsPhp` 5387, `editPage` 5396, `editPhp` 5457, `ghPhp` 5471 |
| 5473–5545 | the research runs' queue | `editQueuePhp` 5474 |
| 5546–5567 | summer camps | `campAreas` 5566, `seasonPill` 5567 |
| 5568–5621 | summer schedule | `utcDay` 5577, `plusDays` 5578, `mondayOf` 5579, `campWeeks` 5580, `summerPlan` 5607 |
| 5622–5627 | my kids' calendar | — |
| 5628–6044 | Kids' Playground | `mapHood` 5650, `HOOD_AREA` 5710, `mapArea` 5722, `mapAreas` 5723, `surpriseHoods` 5740, `kidsStar` 5777, `kidsDot` 5778, `kidsIcon` 5869, `bingoCard` 5878, `actHits` 5935, `kidsData` 5949, `kidsDataV` 5982, `kidsShowcase` 5987, `kidsHow` 6015, `kidsPage` 6026 |
| 6045–6163 | Account Features | `FEATS` 6049, `featArt` 6052, `featPage` 6084 |
| 6164–6576 | the planners in one place | `schedulesPage` 6166, `todoPage` 6234, `calendarPage` 6273, `summerSchedulePage` 6405, `summerWeeksPage` 6525 |
| 6577–6734 | a page per summer camp | `campPath` 6579, `campLink` 6581, `campAsListing` 6583, `campAges` 6584, `campPrice` 6585, `campHoursShort` 6586, `campWeeksShort` 6587, `summerBlock` 6591, `campPage` 6624, `campMovedPage` 6681, `summerCampsPage` 6695 |
| 6735–6770 | weekend classes | `weekendAreas` 6740, `weekendByArea` 6741, `weekendRow` 6742, `weekendPage` 6747 |
| 6771–6860 | all programs | `allProgramsPage` 6776, `notFoundPage` 6854 |
| 6861–7025 | write | `write` 6863 |

## src/server/groups-api.php (3644 lines)

The accounts API. `build.mjs` writes it into the site as `groups/api.php`, with its settings filled in. Functions
first, then the 81 routes, which live in one `switch` on the method and action.

| Lines | Section | Functions (line) |
|---|---|---|
| 1–81 | (top of the file) | `out` 76, `fail` 77, `b64` 78, `h` 79, `now` 80 |
| 82–272 | where things are kept | `data_dir` 83, `secret` 88, `db` 102, `seal_existing` 230, `q` 246, `row` 247, `val` 248, `bump` 250, `tidy` 255 |
| 273–315 | a copy of the database, once a day | `today_ny` 279, `backup_dir` 280, `last_backup` 281, `backup` 286 |
| 316–444 | a copy off the host, once a day | `offsite_repo` 328, `offsite_token` 329, `offsite_gh` 334, `offsite_key` 347, `offsite_seal` 348, `offsite_open` 353, `offsite_counts` 361, `offsite_state` 371, `offsite_photos_left` 377, `offsite_fail` 385, `offsite_run` 386 |
| 445–451 | slowing down guessing and floods | `who` 446, `too_many` 447, `note` 450 |
| 452–491 | the request | `str` 472, `first_name` 478, `person_name` 483, `group_name` 487 |
| 492–521 | who is signed in | `set_session_cookie` 493, `session_ends` 497, `current_user` 500, `need_user` 516 |
| 522–575 | email | `send_mail` 524, `t` 550, `paras` 557, `email_html` 562 |
| 576–596 | group codes | `new_code` 577, `tidy_code` 583, `code_mac` 584, `code_seal` 585, `code_open` 590 |
| 597–622 | what is kept about a child is encrypted in the file | `seal_key` 605, `seal` 606, `unseal` 613, `by_name` 621 |
| 623–651 | a child's week | `programs` 624, `schools` 637, `school_names` 638, `hoods` 647 |
| 652–675 | a phone number for texts | `phone_clean` 656, `phone_show` 661, `phone_set` 665 |
| 676–929 | following and favorites | `mark_name` 680, `stop_code` 691, `stop_hash` 696, `stop_mark` 697, `muted` 703, `follow_kinds` 706, `only_mark` 713, `follow_on` 717, `follow_off` 731, `follow_off_all` 737, `fav_on` 741, `marks_out` 749, `clean_week` 764, `week_from_full` 784, `week_kid` 798, `week_count` 803, `week_follow` 805, `week_shares` 813, `clean_week_full` 824, `week_out` 849, `grade_list` 852, `kids_list` 854, `clean_summer` 864, `summer_out` 884, `clean_daysoff` 896, `daysoff_out` 919 |
| 930–1212 | the passport | `school_year` 952, `passport_key` 957, `passport_clean` 958, `passport_kid` 1016, `passport_row` 1022, `passport_data` 1028, `passport_suggest` 1034, `passport_out` 1088, `program_pins` 1100, `passport_favs` 1114, `profile_out` 1120, `kid_out` 1126, `membership` 1130, `invited` 1136, `not_invited` 1139, `invite_out` 1142, `send_invite` 1149, `invite_one` 1182, `need_owner` 1194, `my_groups` 1199, `ready` 1211 |
| 1213–1306 | co-parents | `home_id` 1222, `household` 1223, `in_list` 1229, `home_user` 1230, `named` 1235, `coparent_out` 1237, `send_coparent_invite` 1256, `me_out` 1274, `has_family` 1288, `is_admin` 1296, `role_of` 1303 |
| 1307–1340 | directors | `listings` 1311, `base_domain` 1316, `email_domain` 1321, `stats_of` 1326 |
| 1341–1527 | notifications on a phone or computer (web push) | `meta_get` 1346, `meta_set` 1347, `b64u_dec` 1348, `ec_point` 1352, `vapid` 1356, `push_endpoint_ok` 1376, `push_state` 1386, `push_send` 1392, `push_to_user` 1434, `push_feed` 1445, `push_due` 1453, `push_note` 1486, `push_run` 1500 |
| 1528–1666 | premium listings | `premium_mode` 1532, `is_premium` 1537, `holds` 1543, `premium_shows` 1547, `photos_public` 1552, `photos_of` 1557, `social_url` 1566, `post_url` 1581, `extra_live` 1586, `extras_out` 1593, `stats_more` 1606, `premium_out` 1624, `claim_out` 1638, `space_of` 1653, `photo_live` 1658, `photo_file` 1661, `my_claims` 1662 |
| 1667–1699 | asking for a school that isn't covered yet | `school_ask_on` 1671, `tell_owner` 1695 |
| 1700–1873 | emails to the people who run a listing | `listing_url` 1707, `listing_plain` 1708, `mgr_holders` 1710, `mgr_send` 1720, `mgr_prompt` 1733, `mgr_plural` 1746, `mgr_numbers` 1748, `mgr_run` 1761 |
| 1874–1933 | a new account | `owner_note_mode` 1881, `signup_note` 1888, `signup_named` 1900, `signup_catchup` 1907, `signup_digest` 1915 |
| 1934–2243 | the private queue (scaling plan, Phase 2) | `ops_repo` 1950, `queue_ctx` 1951, `queue_run` 1960, `queue_outcomes` 1975, `queue_apply` 2005, `queue_settle_proposal` 2029, `queue_merges` 2036, `queue_tell` 2060, `queue_reply` 2073, `sign_in` 2128, `http_get` 2157, `google_email` 2170, `edit_key_state` 2195, `edit_key_out` 2230, `year_end` 2235 |
| 2244–3644 | the routes: one `case` per request (listed under Routes) | — |

### Routes

| Group | Routes (line) |
|---|---|
| one more for a listing | `POST hit` 2249 |
| is everything working? | `GET health` 2266 |
| signing in | `POST login_start` 2276, `POST login_finish` 2305, `POST login_google` 2329, `POST email_start` 2340, `POST email_finish` 2367, `GET me` 2402, `GET school_ask` 2410, `POST school_ask` 2416, `POST logout` 2424, `POST logout_all` 2431, `POST set_name` 2439, `POST basics` 2450, `POST phone_save` 2471, `POST hood_save` 2479 |
| following and favorites | `GET marks` 2489, `POST follow` 2496 |
| stopping from an email, with no sign-in | `GET stopped` 2510, `POST stop` 2522, `POST unmute` 2553, `POST follow_synced` 2562, `POST follow_clear` 2575, `POST fav` 2581, `POST listed` 2594 |
| co-parents | `POST coparent_invite` 2603, `POST coparent_resend` 2617, `POST coparent_cancel` 2626, `POST coparent_accept` 2632, `POST coparent_end` 2678, `POST delete_account` 2691 |
| directors | `GET claimed` 2704, `GET photo` 2721, `GET extras` 2745 |
| notifications | `GET push_key` 2754, `POST push_on` 2761, `POST push_off` 2779, `POST push_mode` 2789, `POST push_test` 2798, `POST push_run` 2810, `POST ask` 2845, `POST extra_save` 2882, `POST extra_drop` 2956, `POST photo_add` 2965, `POST photo_drop` 3010, `GET claims` 3024, `POST mgr_mail` 3030, `POST claim_add` 3040, `POST claim_drop` 3072, `POST premium_ask` 3082, `POST space_set` 3107, `POST edit_add` 3123 |
| a profile | `GET profile` 3144 |
| the passport | `GET passport` 3150, `POST passport_save` 3154, `POST passport_reset` 3181, `POST school_save` 3200, `POST grades_save` 3210, `POST ages_save` 3223, `POST kids_save` 3237, `POST week_save` 3264, `POST week_delete` 3283, `POST summer_save` 3298, `POST summer_delete` 3308, `POST daysoff_save` 3315, `POST daysoff_delete` 3325, `POST share_one` 3333 |
| groups | `POST group_create` 3378, `POST group_peek` 3396, `POST group_join` 3409, `POST invite_add` 3455, `POST invite_remove` 3478, `POST kid_save` 3489, `POST sync` 3519, `POST kid_delete` 3547, `GET group` 3555, `POST member_decide` 3581, `POST group_leave` 3604, `POST group_code` 3615, `POST group_rename` 3624, `POST group_delete` 3634 |
