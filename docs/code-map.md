# Code map

Written by `scripts/code-map.mjs`. The publishing job rewrites it on `main` after every merge, so it matches `main`.
Don't edit it or commit it from a branch: that copy would conflict. For a branch's own line numbers, run
`node scripts/code-map.mjs --out /tmp/code-map.md`.

Use it to open only the lines you need: find the function here, then read from its line.

## build.mjs (7271 lines)

Run as `node build.mjs`. Reads `data/` and `src/`, writes the finished site to `dist/`.

| Lines | Section | Functions (line) |
|---|---|---|
| 1–82 | (top of the file) | `readJson` 13, `ageStep` 30, `gradesToAges` 32, `agesBetween` 33, `notPosted` 47, `typeIcon` 81 |
| 83–141 | site copy | `copyId` 89, `isRemoved` 93, `T` 94, `copyNow` 107, `emailCopy` 112, `dropEmpty` 125, `stamp` 133, `sharePagePath` 137, `sharePageStamp` 139 |
| 142–163 | helpers | `esc` 143, `link` 144, `expandGrades` 150, `longDate` 157, `checkedOn` 160, `checkedLine` 161, `telHref` 162 |
| 164–176 | validation | `isUrl` 176 |
| 177–487 | links out to programs | `outUrl` 185, `bareHost` 193, `ownHosts` 195, `howToRead` 281, `flat` 283, `namesSchool` 284, `checkList` 287, `isIso` 379, `okDays` 380 |
| 488–817 | page shell | `correctionHref` 503, `dayScene` 508, `weekendScene` 539, `summerScene` 572, `street` 598, `getAppDialog` 637, `layout` 661 |
| 818–823 | calendar files for registration dates | — |
| 824–896 | ↳ days of the week, and days off | `daysText` 825, `daysLine` 826, `pickyDays` 827, `isoAdd` 828, `weekday` 829, `dayDate` 830, `closedDays` 832, `schoolOff` 840, `schoolLastDay` 841, `campsOn` 844, `nextOff` 853, `ordinal` 860, `ordDate` 861, `offSpan` 862, `lowerSeason` 863, `offAsk` 864, `nextOffBar` 865, `ymd` 868, `nextDay` 869, `shortDate` 870, `upcomingDates` 871, `calTitle` 872, `calDetails` 873, `gcalUrl` 874, `icsFile` 878 |
| 897–908 | reviews | `stars` 898, `allReviewsFor` 899, `reviewsFor` 900, `kidReviewsFor` 901, `gradeWord` 902, `kidBy` 904, `monthYear` 905, `schoolShort` 906 |
| 909–945 | pieces shared by the program card and the program page | `gradeText` 910, `gradeStrip` 911, `phoneLink` 916, `contactHtml` 917, `registerText` 918, `datesHtml` 926, `average` 927, `reviewItems` 928, `reviewsBlock` 930, `sourceLinks` 938, `programPath` 939, `fullName` 941 |
| 946–982 | neighborhoods | `hoodSlug` 949, `dayLabel` 951, `daySlug` 952, `dayPath` 953, `schoolHoods` 954, `programHoods` 955, `hoods` 957, `hoodPath` 964, `hoodLinks` 965, `plural` 966, `schoolRow` 969, `haystack` 979 |
| 983–1100 | where things are | `coordsOf` 989, `milesApart` 996, `placesOf` 999, `NEAR_HOODS` 1009, `milesFrom` 1053, `milesText` 1054, `kindsOf` 1055, `saysHelp` 1060, `offersHelp` 1061, `costKinds` 1062, `freeOnlyFor` 1066, `schoolRun` 1069, `campOnly` 1074, `clubGrades` 1076, `clubsOfType` 1077, `clubDays` 1079, `clubBrief` 1080, `clubsByType` 1081, `itemAttrs` 1083, `typeTags` 1084, `mini` 1087, `servedLines` 1089, `programRow` 1093 |
| 1101–1268 | one row for every list | `offBreaks` 1109, `campAgeList` 1115, `shapeFor` 1116, `listRow` 1120, `heroGo` 1153, `planLine` 1156, `nearRow` 1167, `nearMap` 1168, `sortedSchools` 1177, `focusOn` 1178, `schoolSelect` 1179, `focusCard` 1180, `filterBar` 1205, `bulb` 1266, `noMatch` 1267 |
| 1269–1302 | program card | `card` 1270 |
| 1303–1305 | a page per program | `listNames` 1304 |
| 1306–1317 | dates by email | `longDay` 1315, `sendOn` 1317 |
| 1318–1343 | ↳ this week at a school | `weekMonday` 1322, `schoolWeek` 1324, `weekLabel` 1340, `thisMonday` 1342 |
| 1344–1631 | ↳ when did each date reach the site? | `phillyDay` 1350, `firstSeen` 1351, `postedOn` 1374, `dayAfter` 1375, `signupItems` 1379, `noteDays` 1391, `mailUrl` 1393, `mailLink` 1395, `leadPart` 1409, `lateAlertItems` 1455, `alertsFeed` 1485, `alertsBox` 1496, `followBox` 1532, `datesBox` 1556, `stopPage` 1559, `alertsPage` 1571, `servedBy` 1595, `servedSummary` 1597, `servedPills` 1606, `programAddress` 1610, `programTitle` 1618, `fold` 1627 |
| 1632–1857 | a program's page | `campOf` 1637, `partsOf` 1639, `runsStrip` 1641, `kindSection` 1642, `offDatesHtml` 1648, `spotItem` 1672, `spotlight` 1673, `programPage` 1681, `programsPage` 1837 |
| 1858–1946 | program types | `KIND_LIST` 1863, `ofKind` 1865, `typeCount` 1866, `liveTypes` 1867, `typeChips` 1868, `kindSections` 1871, `shapedAll` 1878, `typeSections` 1882, `pageNav` 1895, `typesPage` 1896, `typePage` 1906 |
| 1947–1972 | by day of the week | `byDayPage` 1949 |
| 1973–1981 | pages | `forSchool` 1974, `schoolChecked` 1977, `tally` 1978, `clock` 1979, `gradeSpan` 1980 |
| 1982–2032 | the school finder | `streetKey` 1984, `milesBetween` 1985, `finderData` 1990, `finderBox` 2004, `schoolsPage` 2012 |
| 2033–2495 | a page for each school that isn't covered yet | `uncoveredPath` 2042, `nearTo` 2043, `milesPill` 2044, `nearbyFor` 2045, `askPanel` 2057, `uncoveredSchoolPage` 2070, `uncoveredIndexed` 2127, `schoolRequestPage` 2130, `schoolRequestPhp` 2154, `schoolWeekSection` 2166, `schoolPage` 2202, `placeData` 2295, `placeInput` 2296, `offOption` 2299, `heroSearch` 2300, `homePage` 2325, `neighborhoodsPage` 2398, `neighborhoodPage` 2426 |
| 2496–3101 | terms of use | `termsPage` 2500, `privacyPage` 2596, `supportPage` 2754, `aboutPage` 2780, `suggestPage` 2853, `ideasPage` 2941, `ideasThanksPage` 2980, `thanksPage` 2986, `sendPhp` 2994, `fail` 3001, `field` 3007, `one_line` 3012 |
| 3102–3219 | contact | `contactPage` 3103, `contactThanksPage` 3153, `contactPhp` 3158, `fail` 3165, `field` 3171, `one_line` 3176 |
| 3220 | days off | — |
| 3221–3477 | a page for each day, or break, that school is closed | `fullDay` 3226, `monthDay` 3227, `dayOffPage` 3228, `daysOffBits` 3304, `offFacts` 3334, `headsUpBox` 3341, `dayCampsPage` 3345, `daysOffPage` 3386 |
| 3478–3511 | share groups (accounts, class codes) | `premiumMode` 3483, `PM_PRICE` 3489, `PM_PAY` 3499 |
| 3512–3570 | what each planner looks like, for someone who hasn't signed in | `planExample` 3517 |
| 3571–3785 | the planners, for someone who hasn't signed in | `showIcon` 3592, `miniArt` 3614, `heroCta` 3616, `showExample` 3619, `planShow` 3718, `groupsAttrs` 3785 |
| 3786–3864 | directors | `baseDomain` 3792, `claimMode` 3794, `daysSince` 3817, `staleTold` 3818, `asksFor` 3819, `claimListings` 3823, `listingFields` 3830, `notPostedWords` 3839, `listingTools` 3840, `photoSlot` 3849, `premiumSlot` 3852, `spaceSlot` 3854, `claimedMark` 3855, `jumpNav` 3857, `accountHoods` 3859, `groupsScript` 3864 |
| 3865–4119 | small drawings for the account and managers pages, in the site's colors | `artWeek` 3869, `artChip` 3871, `artBox` 3872, `artKid` 3874, `artYearRibbon` 3877, `artPencil` 3887, `artListingKept` 3889, `artStar` 3925, `artBulb` 3926, `artPin` 3927, `artCloudQ` 3928, `artRow` 3930, `accountArt` 3933, `accountPage` 4015, `profilePage` 4100, `movedPage` 4112 |
| 4120–5229 | for the people who manage a program | `CLAIM_GETS` 4122, `CLAIM_GETS_ALL` 4123, `claimDemo` 4131, `directorsPage` 4171, `premiumPage` 4252, `editClaimsPhp` 4379, `tell` 4502, `groupsInfo` 4644, `joinPage` 4649, `groupPage` 4668, `groupsApiPhp` 4680, `queuePhp` 4694, `mailPhp` 4697, `contentPhp` 4700, `MODERATION` 4703, `phpCopy` 4718, `boardPage` 4739, `rvNames` 4952, `reviewPage` 4953, `reviewPolicyPage` 5040, `reviewThanksPage` 5086, `reviewNoScriptPhp` 5098, `reviewPhp` 5108, `fail` 5120, `field` 5126, `one_line` 5131 |
| 5230–5312 | sending mail | `pas_mail_key` 5236, `pas_mail_via` 5244, `pas_mail_note` 5246, `pas_mail_state` 5259, `pas_mail_week` 5264, `pas_mail_kind` 5272, `pas_postmark` 5275, `pas_mail_via` 5304, `pas_mail_note` 5305, `pas_mail_state` 5306, `pas_mail_week` 5307, `pas_mail_kind` 5308, `pas_postmark` 5309, `mailerPhp` 5311 |
| 5313–5686 | edit mode | `editAuthPhp` 5322, `edit_key` 5326, `edit_db` 5342, `edit_account` 5364, `edit_admin` 5387, `edit_editor` 5395, `edit_signed_in` 5412, `editSignInPage` 5418, `editIndexPhp` 5432, `editStatsPhp` 5454, `editEmailsPage` 5590, `editEmailsPhp` 5601, `editPage` 5610, `editPhp` 5671, `ghPhp` 5685 |
| 5687–5760 | the research runs' queue | `editQueuePhp` 5688 |
| 5761–5788 | the autopilot as the owner sees it (scaling plan, Phase 3) | `autopilotPhp` 5767, `editAutopilotPage` 5768, `editNeedsPhp` 5786, `editAutopilotPhp` 5787 |
| 5789–5810 | summer camps | `campAreas` 5809, `seasonPill` 5810 |
| 5811–5864 | summer schedule | `utcDay` 5820, `plusDays` 5821, `mondayOf` 5822, `campWeeks` 5823, `summerPlan` 5850 |
| 5865–5870 | my kids' calendar | — |
| 5871–6287 | Kids' Playground | `mapHood` 5893, `HOOD_AREA` 5953, `mapArea` 5965, `mapAreas` 5966, `surpriseHoods` 5983, `kidsStar` 6020, `kidsDot` 6021, `kidsIcon` 6112, `bingoCard` 6121, `actHits` 6178, `kidsData` 6192, `kidsDataV` 6225, `kidsShowcase` 6230, `kidsHow` 6258, `kidsPage` 6269 |
| 6288–6406 | Account Features | `FEATS` 6292, `featArt` 6295, `featPage` 6327 |
| 6407–6819 | the planners in one place | `schedulesPage` 6409, `todoPage` 6477, `calendarPage` 6516, `summerSchedulePage` 6648, `summerWeeksPage` 6768 |
| 6820–6977 | a page per summer camp | `campPath` 6822, `campLink` 6824, `campAsListing` 6826, `campAges` 6827, `campPrice` 6828, `campHoursShort` 6829, `campWeeksShort` 6830, `summerBlock` 6834, `campPage` 6867, `campMovedPage` 6924, `summerCampsPage` 6938 |
| 6978–7013 | weekend classes | `weekendAreas` 6983, `weekendByArea` 6984, `weekendRow` 6985, `weekendPage` 6990 |
| 7014–7103 | all programs | `allProgramsPage` 7019, `notFoundPage` 7097 |
| 7104–7271 | write | `write` 7106 |

## src/server/groups-api.php (4873 lines)

The accounts API. `build.mjs` writes it into the site as `groups/api.php`, with its settings filled in. Functions
first, then the 92 routes, which live in one `switch` on the method and action.

| Lines | Section | Functions (line) |
|---|---|---|
| 1–81 | (top of the file) | `out` 76, `fail` 77, `b64` 78, `h` 79, `now` 80 |
| 82–291 | where things are kept | `data_dir` 83, `secret` 88, `db` 102, `seal_existing` 244, `q` 260, `row` 261, `val` 262, `bump` 264, `tidy` 269 |
| 292–334 | a copy of the database, once a day | `today_ny` 298, `backup_dir` 299, `last_backup` 300, `backup` 305 |
| 335–463 | a copy off the host, once a day | `offsite_repo` 347, `offsite_token` 348, `offsite_gh` 353, `offsite_key` 366, `offsite_seal` 367, `offsite_open` 372, `offsite_counts` 380, `offsite_state` 390, `offsite_photos_left` 396, `offsite_fail` 404, `offsite_run` 405 |
| 464–470 | slowing down guessing and floods | `who` 465, `too_many` 466, `note` 469 |
| 471–510 | the request | `str` 491, `first_name` 497, `person_name` 502, `group_name` 506 |
| 511–540 | who is signed in | `set_session_cookie` 512, `session_ends` 516, `current_user` 519, `need_user` 535 |
| 541–598 | email | `send_mail` 545, `t` 573, `paras` 580, `email_html` 585 |
| 599–619 | group codes | `new_code` 600, `tidy_code` 606, `code_mac` 607, `code_seal` 608, `code_open` 613 |
| 620–645 | what is kept about a child is encrypted in the file | `seal_key` 628, `seal` 629, `unseal` 636, `by_name` 644 |
| 646–674 | a child's week | `programs` 647, `schools` 660, `school_names` 661, `hoods` 670 |
| 675–698 | a phone number for texts | `phone_clean` 679, `phone_show` 684, `phone_set` 688 |
| 699–952 | following and favorites | `mark_name` 703, `stop_code` 714, `stop_hash` 719, `stop_mark` 720, `muted` 726, `follow_kinds` 729, `only_mark` 736, `follow_on` 740, `follow_off` 754, `follow_off_all` 760, `fav_on` 764, `marks_out` 772, `clean_week` 787, `week_from_full` 807, `week_kid` 821, `week_count` 826, `week_follow` 828, `week_shares` 836, `clean_week_full` 847, `week_out` 872, `grade_list` 875, `kids_list` 877, `clean_summer` 887, `summer_out` 907, `clean_daysoff` 919, `daysoff_out` 942 |
| 953–1235 | the passport | `school_year` 975, `passport_key` 980, `passport_clean` 981, `passport_kid` 1039, `passport_row` 1045, `passport_data` 1051, `passport_suggest` 1057, `passport_out` 1111, `program_pins` 1123, `passport_favs` 1137, `profile_out` 1143, `kid_out` 1149, `membership` 1153, `invited` 1159, `not_invited` 1162, `invite_out` 1165, `send_invite` 1172, `invite_one` 1205, `need_owner` 1217, `my_groups` 1222, `ready` 1234 |
| 1236–1329 | co-parents | `home_id` 1245, `household` 1246, `in_list` 1252, `home_user` 1253, `named` 1258, `coparent_out` 1260, `send_coparent_invite` 1279, `me_out` 1297, `has_family` 1311, `is_admin` 1319, `role_of` 1326 |
| 1330–1363 | directors | `listings` 1334, `base_domain` 1339, `email_domain` 1344, `stats_of` 1349 |
| 1364–1550 | notifications on a phone or computer (web push) | `meta_get` 1369, `meta_set` 1370, `b64u_dec` 1371, `ec_point` 1375, `vapid` 1379, `push_endpoint_ok` 1399, `push_state` 1409, `push_send` 1415, `push_to_user` 1457, `push_feed` 1468, `push_due` 1476, `push_note` 1509, `push_run` 1523 |
| 1551–1692 | premium listings | `premium_mode` 1555, `is_premium` 1560, `holds` 1566, `premium_shows` 1570, `photos_public` 1575, `photos_of` 1580, `social_url` 1589, `post_url` 1604, `extra_live` 1609, `extras_out` 1616, `stats_more` 1629, `premium_out` 1647, `claim_out` 1661, `space_of` 1684, `photo_live` 1689, `photo_file` 1692 |
| 1693–1821 | a manager's own fields | `manager_fields_mode` 1705, `claim_by_domain` 1707, `lf_time` 1712, `lf_day_names` 1717, `told_sum` 1725, `lf_apply` 1741, `repo_json` 1775, `lf_publish` 1781, `my_claims` 1817 |
| 1822–1855 | asking for a school that isn't covered yet | `school_ask_on` 1826, `tell_owner` 1851 |
| 1856–2029 | emails to the people who run a listing | `listing_url` 1863, `listing_plain` 1864, `mgr_holders` 1866, `mgr_send` 1876, `mgr_prompt` 1889, `mgr_plural` 1902, `mgr_numbers` 1904, `mgr_run` 1917 |
| 2030–2091 | a new account | `owner_note_mode` 2037, `signup_note` 2044, `signup_named` 2056, `signup_catchup` 2063, `signup_digest` 2072 |
| 2092–2408 | the private queue (scaling plan, Phase 2) | `ops_repo` 2118, `queue_ctx` 2119, `queue_run` 2128, `queue_outcomes` 2144, `queue_apply` 2177, `review_after_outcome` 2219, `queue_settle_proposal` 2225, `queue_merges` 2232, `queue_tell` 2258, `queue_reply` 2275, `answer_copies_on` 2288, `answer_copy` 2289, `queue_missing_words` 2308, `queue_reply_parts` 2317 |
| 2409–2662 | the mailbox (scaling plan, Phase 5) | `mail_key` 2423, `mail_shared_key` 2425, `mail_auth` 2434, `mail_id_str` 2442, `mail_text_in` 2444, `mail_first_name` 2450, `mail_store` 2453, `mail_draft` 2507, `mail_after_outcome` 2524, `mail_answer` 2535, `mail_answer_text` 2544, `mail_beat` 2588, `mail_state` 2604, `outreach_copy` 2618 |
| 2663–2789 | reviews and what managers add (scaling plan, Phase 6) | `mod_cfg` 2669, `mod_private` 2670, `review_fresh_mode` 2673, `listing_names` 2678, `content_mode` 2681, `claim_code_on` 2688, `mask_email` 2694, `content_decisions` 2699, `content_apply` 2729, `content_publish` 2755 |
| 2790–3126 | the morning summary, and the pushes that can't wait (scaling plan, Phase 3) | `ap_ctx` 2798, `ap_github_ready` 2805, `summary_on` 2806, `owner_push` 2813, `publish_watch` 2826, `sum_plural` 2849, `sum_when` 2850, `owner_summary` 2852, `sign_in` 3011, `http_get` 3040, `google_email` 3053, `edit_key_state` 3078, `edit_key_out` 3113, `year_end` 3118 |
| 3127–4873 | the routes: one `case` per request (listed under Routes) | — |

### Routes

| Group | Routes (line) |
|---|---|
| one more for a listing | `POST hit` 3132 |
| is everything working? | `GET health` 3149 |
| signing in | `POST login_start` 3159, `POST login_finish` 3188, `POST login_google` 3212, `POST email_start` 3223, `POST email_finish` 3250, `GET me` 3285, `GET school_ask` 3293, `POST school_ask` 3299, `POST logout` 3307, `POST logout_all` 3314, `POST set_name` 3322, `POST basics` 3333, `POST phone_save` 3354, `POST hood_save` 3362 |
| following and favorites | `GET marks` 3372, `POST follow` 3379 |
| stopping from an email, with no sign-in | `GET stopped` 3393, `POST stop` 3405, `POST unmute` 3436, `POST follow_synced` 3445, `POST follow_clear` 3458, `POST fav` 3464, `POST listed` 3477 |
| co-parents | `POST coparent_invite` 3486, `POST coparent_resend` 3500, `POST coparent_cancel` 3509, `POST coparent_accept` 3515, `POST coparent_end` 3561, `POST delete_account` 3574 |
| directors | `GET claimed` 3587, `GET photo` 3604, `GET extras` 3628 |
| notifications | `GET push_key` 3637, `POST push_on` 3644, `POST push_off` 3662, `POST push_mode` 3672, `POST push_test` 3681, `POST push_run` 3693 |
| reviews (scaling plan, Phase 6) | `POST review_add` 3738, `GET review_check` 3784, `GET told_check` 3800, `GET photo_look` 3815 |
| claims by code (Phase 6, call 2; off until "claimByCode" | `POST claim_code_start` 3836, `POST claim_code_finish` 3882 |
| the mailbox script (scaling plan, Phase 5) | `POST mail_in` 3922, `POST mail_out` 3929, `POST mail_sent` 3949, `POST outreach_copy` 3966, `POST ask` 3973, `POST extra_save` 4010, `POST extra_drop` 4092, `POST photo_add` 4101, `POST photo_drop` 4148, `GET claims` 4162, `POST mgr_mail` 4168, `POST claim_add` 4178, `POST claim_drop` 4230, `POST premium_ask` 4240, `POST space_set` 4265, `POST edit_add` 4281 |
| a manager sets its own days, hours, cost, grades and pickup schools (see "a… | `POST listing_fields` 4302 |
| a profile | `GET profile` 4373 |
| the passport | `GET passport` 4379, `POST passport_save` 4383, `POST passport_reset` 4410, `POST school_save` 4429, `POST grades_save` 4439, `POST ages_save` 4452, `POST kids_save` 4466, `POST week_save` 4493, `POST week_delete` 4512, `POST summer_save` 4527, `POST summer_delete` 4537, `POST daysoff_save` 4544, `POST daysoff_delete` 4554, `POST share_one` 4562 |
| groups | `POST group_create` 4607, `POST group_peek` 4625, `POST group_join` 4638, `POST invite_add` 4684, `POST invite_remove` 4707, `POST kid_save` 4718, `POST sync` 4748, `POST kid_delete` 4776, `GET group` 4784, `POST member_decide` 4810, `POST group_leave` 4833, `POST group_code` 4844, `POST group_rename` 4853, `POST group_delete` 4863 |
