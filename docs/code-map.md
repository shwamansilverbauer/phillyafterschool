# Code map

Written by `scripts/code-map.mjs`. The publishing job rewrites it on `main` after every merge, so it matches `main`.
Don't edit it or commit it from a branch: that copy would conflict. For a branch's own line numbers, run
`node scripts/code-map.mjs --out /tmp/code-map.md`.

Use it to open only the lines you need: find the function here, then read from its line.

## build.mjs (7069 lines)

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
| 4016–5037 | for the people who manage a program | `CLAIM_GETS` 4018, `CLAIM_GETS_ALL` 4019, `claimDemo` 4027, `directorsPage` 4067, `premiumPage` 4148, `editClaimsPhp` 4275, `tell` 4398, `groupsInfo` 4540, `joinPage` 4545, `groupPage` 4564, `groupsApiPhp` 4576, `queuePhp` 4588, `phpCopy` 4598, `boardPage` 4619, `rvNames` 4832, `reviewPage` 4833, `reviewThanksPage` 4909, `reviewPhp` 4918, `fail` 4929, `field` 4935, `one_line` 4940 |
| 5038–5115 | sending mail | `pas_mail_key` 5044, `pas_mail_via` 5052, `pas_mail_note` 5054, `pas_mail_state` 5067, `pas_mail_week` 5072, `pas_postmark` 5080, `pas_mail_via` 5108, `pas_mail_note` 5109, `pas_mail_state` 5110, `pas_mail_week` 5111, `pas_postmark` 5112, `mailerPhp` 5114 |
| 5116–5487 | edit mode | `editAuthPhp` 5125, `edit_key` 5129, `edit_db` 5145, `edit_account` 5167, `edit_admin` 5190, `edit_editor` 5198, `edit_signed_in` 5215, `editSignInPage` 5221, `editIndexPhp` 5235, `editStatsPhp` 5257, `editEmailsPage` 5391, `editEmailsPhp` 5402, `editPage` 5411, `editPhp` 5472, `ghPhp` 5486 |
| 5488–5560 | the research runs' queue | `editQueuePhp` 5489 |
| 5561–5587 | the autopilot as the owner sees it (scaling plan, Phase 3) | `autopilotPhp` 5567, `editAutopilotPage` 5568, `editNeedsPhp` 5585, `editAutopilotPhp` 5586 |
| 5588–5609 | summer camps | `campAreas` 5608, `seasonPill` 5609 |
| 5610–5663 | summer schedule | `utcDay` 5619, `plusDays` 5620, `mondayOf` 5621, `campWeeks` 5622, `summerPlan` 5649 |
| 5664–5669 | my kids' calendar | — |
| 5670–6086 | Kids' Playground | `mapHood` 5692, `HOOD_AREA` 5752, `mapArea` 5764, `mapAreas` 5765, `surpriseHoods` 5782, `kidsStar` 5819, `kidsDot` 5820, `kidsIcon` 5911, `bingoCard` 5920, `actHits` 5977, `kidsData` 5991, `kidsDataV` 6024, `kidsShowcase` 6029, `kidsHow` 6057, `kidsPage` 6068 |
| 6087–6205 | Account Features | `FEATS` 6091, `featArt` 6094, `featPage` 6126 |
| 6206–6618 | the planners in one place | `schedulesPage` 6208, `todoPage` 6276, `calendarPage` 6315, `summerSchedulePage` 6447, `summerWeeksPage` 6567 |
| 6619–6776 | a page per summer camp | `campPath` 6621, `campLink` 6623, `campAsListing` 6625, `campAges` 6626, `campPrice` 6627, `campHoursShort` 6628, `campWeeksShort` 6629, `summerBlock` 6633, `campPage` 6666, `campMovedPage` 6723, `summerCampsPage` 6737 |
| 6777–6812 | weekend classes | `weekendAreas` 6782, `weekendByArea` 6783, `weekendRow` 6784, `weekendPage` 6789 |
| 6813–6902 | all programs | `allProgramsPage` 6818, `notFoundPage` 6896 |
| 6903–7069 | write | `write` 6905 |

## src/server/groups-api.php (3840 lines)

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
| 1874–1935 | a new account | `owner_note_mode` 1881, `signup_note` 1888, `signup_named` 1900, `signup_catchup` 1907, `signup_digest` 1916 |
| 1936–2128 | the private queue (scaling plan, Phase 2) | `ops_repo` 1952, `queue_ctx` 1953, `queue_run` 1962, `queue_outcomes` 1977, `queue_apply` 2007, `queue_settle_proposal` 2031, `queue_merges` 2038, `queue_tell` 2062, `queue_reply` 2075 |
| 2129–2433 | the morning summary, and the pushes that can't wait (scaling plan, Phase 3) | `ap_ctx` 2137, `ap_github_ready` 2144, `summary_on` 2145, `owner_push` 2152, `publish_watch` 2165, `sum_plural` 2188, `sum_when` 2189, `owner_summary` 2191, `sign_in` 2318, `http_get` 2347, `google_email` 2360, `edit_key_state` 2385, `edit_key_out` 2420, `year_end` 2425 |
| 2434–3840 | the routes: one `case` per request (listed under Routes) | — |

### Routes

| Group | Routes (line) |
|---|---|
| one more for a listing | `POST hit` 2439 |
| is everything working? | `GET health` 2456 |
| signing in | `POST login_start` 2466, `POST login_finish` 2495, `POST login_google` 2519, `POST email_start` 2530, `POST email_finish` 2557, `GET me` 2592, `GET school_ask` 2600, `POST school_ask` 2606, `POST logout` 2614, `POST logout_all` 2621, `POST set_name` 2629, `POST basics` 2640, `POST phone_save` 2661, `POST hood_save` 2669 |
| following and favorites | `GET marks` 2679, `POST follow` 2686 |
| stopping from an email, with no sign-in | `GET stopped` 2700, `POST stop` 2712, `POST unmute` 2743, `POST follow_synced` 2752, `POST follow_clear` 2765, `POST fav` 2771, `POST listed` 2784 |
| co-parents | `POST coparent_invite` 2793, `POST coparent_resend` 2807, `POST coparent_cancel` 2816, `POST coparent_accept` 2822, `POST coparent_end` 2868, `POST delete_account` 2881 |
| directors | `GET claimed` 2894, `GET photo` 2911, `GET extras` 2935 |
| notifications | `GET push_key` 2944, `POST push_on` 2951, `POST push_off` 2969, `POST push_mode` 2979, `POST push_test` 2988, `POST push_run` 3000, `POST ask` 3041, `POST extra_save` 3078, `POST extra_drop` 3152, `POST photo_add` 3161, `POST photo_drop` 3206, `GET claims` 3220, `POST mgr_mail` 3226, `POST claim_add` 3236, `POST claim_drop` 3268, `POST premium_ask` 3278, `POST space_set` 3303, `POST edit_add` 3319 |
| a profile | `GET profile` 3340 |
| the passport | `GET passport` 3346, `POST passport_save` 3350, `POST passport_reset` 3377, `POST school_save` 3396, `POST grades_save` 3406, `POST ages_save` 3419, `POST kids_save` 3433, `POST week_save` 3460, `POST week_delete` 3479, `POST summer_save` 3494, `POST summer_delete` 3504, `POST daysoff_save` 3511, `POST daysoff_delete` 3521, `POST share_one` 3529 |
| groups | `POST group_create` 3574, `POST group_peek` 3592, `POST group_join` 3605, `POST invite_add` 3651, `POST invite_remove` 3674, `POST kid_save` 3685, `POST sync` 3715, `POST kid_delete` 3743, `GET group` 3751, `POST member_decide` 3777, `POST group_leave` 3800, `POST group_code` 3811, `POST group_rename` 3820, `POST group_delete` 3830 |
