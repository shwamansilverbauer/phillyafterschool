# Code map

Written by `scripts/code-map.mjs`. The publishing job rewrites it on `main` after every merge, so it matches `main`.
Don't edit it or commit it from a branch: that copy would conflict. For a branch's own line numbers, run
`node scripts/code-map.mjs --out /tmp/code-map.md`.

Use it to open only the lines you need: find the function here, then read from its line.

## build.mjs (7250 lines)

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
| 975–1090 | where things are | `coordsOf` 981, `milesApart` 988, `placesOf` 991, `NEAR_HOODS` 1001, `milesFrom` 1045, `milesText` 1046, `kindsOf` 1047, `saysHelp` 1052, `offersHelp` 1053, `costKinds` 1054, `freeOnlyFor` 1058, `schoolRun` 1061, `campOnly` 1064, `clubGrades` 1066, `clubsOfType` 1067, `clubDays` 1069, `clubBrief` 1070, `clubsByType` 1071, `itemAttrs` 1073, `typeTags` 1074, `mini` 1077, `servedLines` 1079, `programRow` 1083 |
| 1091–1258 | one row for every list | `offBreaks` 1099, `campAgeList` 1105, `shapeFor` 1106, `listRow` 1110, `heroGo` 1143, `planLine` 1146, `nearRow` 1157, `nearMap` 1158, `sortedSchools` 1167, `focusOn` 1168, `schoolSelect` 1169, `focusCard` 1170, `filterBar` 1195, `bulb` 1256, `noMatch` 1257 |
| 1259–1292 | program card | `card` 1260 |
| 1293–1295 | a page per program | `listNames` 1294 |
| 1296–1307 | dates by email | `longDay` 1305, `sendOn` 1307 |
| 1308–1333 | ↳ this week at a school | `weekMonday` 1312, `schoolWeek` 1314, `weekLabel` 1330, `thisMonday` 1332 |
| 1334–1621 | ↳ when did each date reach the site? | `phillyDay` 1340, `firstSeen` 1341, `postedOn` 1364, `dayAfter` 1365, `signupItems` 1369, `noteDays` 1381, `mailUrl` 1383, `mailLink` 1385, `leadPart` 1399, `lateAlertItems` 1445, `alertsFeed` 1475, `alertsBox` 1486, `followBox` 1522, `datesBox` 1546, `stopPage` 1549, `alertsPage` 1561, `servedBy` 1585, `servedSummary` 1587, `servedPills` 1596, `programAddress` 1600, `programTitle` 1608, `fold` 1617 |
| 1622–1847 | a program's page | `campOf` 1627, `partsOf` 1629, `runsStrip` 1631, `kindSection` 1632, `offDatesHtml` 1638, `spotItem` 1662, `spotlight` 1663, `programPage` 1671, `programsPage` 1827 |
| 1848–1936 | program types | `KIND_LIST` 1853, `ofKind` 1855, `typeCount` 1856, `liveTypes` 1857, `typeChips` 1858, `kindSections` 1861, `shapedAll` 1868, `typeSections` 1872, `pageNav` 1885, `typesPage` 1886, `typePage` 1896 |
| 1937–1962 | by day of the week | `byDayPage` 1939 |
| 1963–1971 | pages | `forSchool` 1964, `schoolChecked` 1967, `tally` 1968, `clock` 1969, `gradeSpan` 1970 |
| 1972–2022 | the school finder | `streetKey` 1974, `milesBetween` 1975, `finderData` 1980, `finderBox` 1994, `schoolsPage` 2002 |
| 2023–2485 | a page for each school that isn't covered yet | `uncoveredPath` 2032, `nearTo` 2033, `milesPill` 2034, `nearbyFor` 2035, `askPanel` 2047, `uncoveredSchoolPage` 2060, `uncoveredIndexed` 2117, `schoolRequestPage` 2120, `schoolRequestPhp` 2144, `schoolWeekSection` 2156, `schoolPage` 2192, `placeData` 2285, `placeInput` 2286, `offOption` 2289, `heroSearch` 2290, `homePage` 2315, `neighborhoodsPage` 2388, `neighborhoodPage` 2416 |
| 2486–3091 | terms of use | `termsPage` 2490, `privacyPage` 2586, `supportPage` 2744, `aboutPage` 2770, `suggestPage` 2843, `ideasPage` 2931, `ideasThanksPage` 2970, `thanksPage` 2976, `sendPhp` 2984, `fail` 2991, `field` 2997, `one_line` 3002 |
| 3092–3209 | contact | `contactPage` 3093, `contactThanksPage` 3143, `contactPhp` 3148, `fail` 3155, `field` 3161, `one_line` 3166 |
| 3210 | days off | — |
| 3211–3467 | a page for each day, or break, that school is closed | `fullDay` 3216, `monthDay` 3217, `dayOffPage` 3218, `daysOffBits` 3294, `offFacts` 3324, `headsUpBox` 3331, `dayCampsPage` 3335, `daysOffPage` 3376 |
| 3468–3501 | share groups (accounts, class codes) | `premiumMode` 3473, `PM_PRICE` 3479, `PM_PAY` 3489 |
| 3502–3560 | what each planner looks like, for someone who hasn't signed in | `planExample` 3507 |
| 3561–3775 | the planners, for someone who hasn't signed in | `showIcon` 3582, `miniArt` 3604, `heroCta` 3606, `showExample` 3609, `planShow` 3708, `groupsAttrs` 3775 |
| 3776–3844 | directors | `baseDomain` 3782, `claimMode` 3784, `daysSince` 3807, `staleTold` 3808, `asksFor` 3809, `claimListings` 3813, `listingTools` 3821, `photoSlot` 3829, `premiumSlot` 3832, `spaceSlot` 3834, `claimedMark` 3835, `jumpNav` 3837, `accountHoods` 3839, `groupsScript` 3844 |
| 3845–4099 | small drawings for the account and managers pages, in the site's colors | `artWeek` 3849, `artChip` 3851, `artBox` 3852, `artKid` 3854, `artYearRibbon` 3857, `artPencil` 3867, `artListingKept` 3869, `artStar` 3905, `artBulb` 3906, `artPin` 3907, `artCloudQ` 3908, `artRow` 3910, `accountArt` 3913, `accountPage` 3995, `profilePage` 4080, `movedPage` 4092 |
| 4100–5208 | for the people who manage a program | `CLAIM_GETS` 4102, `CLAIM_GETS_ALL` 4103, `claimDemo` 4111, `directorsPage` 4151, `premiumPage` 4232, `editClaimsPhp` 4359, `tell` 4482, `groupsInfo` 4624, `joinPage` 4629, `groupPage` 4648, `groupsApiPhp` 4660, `queuePhp` 4674, `mailPhp` 4677, `contentPhp` 4680, `MODERATION` 4683, `phpCopy` 4697, `boardPage` 4718, `rvNames` 4931, `reviewPage` 4932, `reviewPolicyPage` 5019, `reviewThanksPage` 5065, `reviewNoScriptPhp` 5077, `reviewPhp` 5087, `fail` 5099, `field` 5105, `one_line` 5110 |
| 5209–5291 | sending mail | `pas_mail_key` 5215, `pas_mail_via` 5223, `pas_mail_note` 5225, `pas_mail_state` 5238, `pas_mail_week` 5243, `pas_mail_kind` 5251, `pas_postmark` 5254, `pas_mail_via` 5283, `pas_mail_note` 5284, `pas_mail_state` 5285, `pas_mail_week` 5286, `pas_mail_kind` 5287, `pas_postmark` 5288, `mailerPhp` 5290 |
| 5292–5665 | edit mode | `editAuthPhp` 5301, `edit_key` 5305, `edit_db` 5321, `edit_account` 5343, `edit_admin` 5366, `edit_editor` 5374, `edit_signed_in` 5391, `editSignInPage` 5397, `editIndexPhp` 5411, `editStatsPhp` 5433, `editEmailsPage` 5569, `editEmailsPhp` 5580, `editPage` 5589, `editPhp` 5650, `ghPhp` 5664 |
| 5666–5739 | the research runs' queue | `editQueuePhp` 5667 |
| 5740–5767 | the autopilot as the owner sees it (scaling plan, Phase 3) | `autopilotPhp` 5746, `editAutopilotPage` 5747, `editNeedsPhp` 5765, `editAutopilotPhp` 5766 |
| 5768–5789 | summer camps | `campAreas` 5788, `seasonPill` 5789 |
| 5790–5843 | summer schedule | `utcDay` 5799, `plusDays` 5800, `mondayOf` 5801, `campWeeks` 5802, `summerPlan` 5829 |
| 5844–5849 | my kids' calendar | — |
| 5850–6266 | Kids' Playground | `mapHood` 5872, `HOOD_AREA` 5932, `mapArea` 5944, `mapAreas` 5945, `surpriseHoods` 5962, `kidsStar` 5999, `kidsDot` 6000, `kidsIcon` 6091, `bingoCard` 6100, `actHits` 6157, `kidsData` 6171, `kidsDataV` 6204, `kidsShowcase` 6209, `kidsHow` 6237, `kidsPage` 6248 |
| 6267–6385 | Account Features | `FEATS` 6271, `featArt` 6274, `featPage` 6306 |
| 6386–6798 | the planners in one place | `schedulesPage` 6388, `todoPage` 6456, `calendarPage` 6495, `summerSchedulePage` 6627, `summerWeeksPage` 6747 |
| 6799–6956 | a page per summer camp | `campPath` 6801, `campLink` 6803, `campAsListing` 6805, `campAges` 6806, `campPrice` 6807, `campHoursShort` 6808, `campWeeksShort` 6809, `summerBlock` 6813, `campPage` 6846, `campMovedPage` 6903, `summerCampsPage` 6917 |
| 6957–6992 | weekend classes | `weekendAreas` 6962, `weekendByArea` 6963, `weekendRow` 6964, `weekendPage` 6969 |
| 6993–7082 | all programs | `allProgramsPage` 6998, `notFoundPage` 7076 |
| 7083–7250 | write | `write` 7085 |

## src/server/groups-api.php (4576 lines)

The accounts API. `build.mjs` writes it into the site as `groups/api.php`, with its settings filled in. Functions
first, then the 90 routes, which live in one `switch` on the method and action.

| Lines | Section | Functions (line) |
|---|---|---|
| 1–81 | (top of the file) | `out` 76, `fail` 77, `b64` 78, `h` 79, `now` 80 |
| 82–284 | where things are kept | `data_dir` 83, `secret` 88, `db` 102, `seal_existing` 237, `q` 253, `row` 254, `val` 255, `bump` 257, `tidy` 262 |
| 285–327 | a copy of the database, once a day | `today_ny` 291, `backup_dir` 292, `last_backup` 293, `backup` 298 |
| 328–456 | a copy off the host, once a day | `offsite_repo` 340, `offsite_token` 341, `offsite_gh` 346, `offsite_key` 359, `offsite_seal` 360, `offsite_open` 365, `offsite_counts` 373, `offsite_state` 383, `offsite_photos_left` 389, `offsite_fail` 397, `offsite_run` 398 |
| 457–463 | slowing down guessing and floods | `who` 458, `too_many` 459, `note` 462 |
| 464–503 | the request | `str` 484, `first_name` 490, `person_name` 495, `group_name` 499 |
| 504–533 | who is signed in | `set_session_cookie` 505, `session_ends` 509, `current_user` 512, `need_user` 528 |
| 534–591 | email | `send_mail` 538, `t` 566, `paras` 573, `email_html` 578 |
| 592–612 | group codes | `new_code` 593, `tidy_code` 599, `code_mac` 600, `code_seal` 601, `code_open` 606 |
| 613–638 | what is kept about a child is encrypted in the file | `seal_key` 621, `seal` 622, `unseal` 629, `by_name` 637 |
| 639–667 | a child's week | `programs` 640, `schools` 653, `school_names` 654, `hoods` 663 |
| 668–691 | a phone number for texts | `phone_clean` 672, `phone_show` 677, `phone_set` 681 |
| 692–945 | following and favorites | `mark_name` 696, `stop_code` 707, `stop_hash` 712, `stop_mark` 713, `muted` 719, `follow_kinds` 722, `only_mark` 729, `follow_on` 733, `follow_off` 747, `follow_off_all` 753, `fav_on` 757, `marks_out` 765, `clean_week` 780, `week_from_full` 800, `week_kid` 814, `week_count` 819, `week_follow` 821, `week_shares` 829, `clean_week_full` 840, `week_out` 865, `grade_list` 868, `kids_list` 870, `clean_summer` 880, `summer_out` 900, `clean_daysoff` 912, `daysoff_out` 935 |
| 946–1228 | the passport | `school_year` 968, `passport_key` 973, `passport_clean` 974, `passport_kid` 1032, `passport_row` 1038, `passport_data` 1044, `passport_suggest` 1050, `passport_out` 1104, `program_pins` 1116, `passport_favs` 1130, `profile_out` 1136, `kid_out` 1142, `membership` 1146, `invited` 1152, `not_invited` 1155, `invite_out` 1158, `send_invite` 1165, `invite_one` 1198, `need_owner` 1210, `my_groups` 1215, `ready` 1227 |
| 1229–1322 | co-parents | `home_id` 1238, `household` 1239, `in_list` 1245, `home_user` 1246, `named` 1251, `coparent_out` 1253, `send_coparent_invite` 1272, `me_out` 1290, `has_family` 1304, `is_admin` 1312, `role_of` 1319 |
| 1323–1356 | directors | `listings` 1327, `base_domain` 1332, `email_domain` 1337, `stats_of` 1342 |
| 1357–1543 | notifications on a phone or computer (web push) | `meta_get` 1362, `meta_set` 1363, `b64u_dec` 1364, `ec_point` 1368, `vapid` 1372, `push_endpoint_ok` 1392, `push_state` 1402, `push_send` 1408, `push_to_user` 1450, `push_feed` 1461, `push_due` 1469, `push_note` 1502, `push_run` 1516 |
| 1544–1682 | premium listings | `premium_mode` 1548, `is_premium` 1553, `holds` 1559, `premium_shows` 1563, `photos_public` 1568, `photos_of` 1573, `social_url` 1582, `post_url` 1597, `extra_live` 1602, `extras_out` 1609, `stats_more` 1622, `premium_out` 1640, `claim_out` 1654, `space_of` 1669, `photo_live` 1674, `photo_file` 1677, `my_claims` 1678 |
| 1683–1716 | asking for a school that isn't covered yet | `school_ask_on` 1687, `tell_owner` 1712 |
| 1717–1890 | emails to the people who run a listing | `listing_url` 1724, `listing_plain` 1725, `mgr_holders` 1727, `mgr_send` 1737, `mgr_prompt` 1750, `mgr_plural` 1763, `mgr_numbers` 1765, `mgr_run` 1778 |
| 1891–1952 | a new account | `owner_note_mode` 1898, `signup_note` 1905, `signup_named` 1917, `signup_catchup` 1924, `signup_digest` 1933 |
| 1953–2198 | the private queue (scaling plan, Phase 2) | `ops_repo` 1975, `queue_ctx` 1976, `queue_run` 1985, `queue_outcomes` 2001, `queue_apply` 2034, `review_after_outcome` 2073, `queue_settle_proposal` 2079, `queue_merges` 2086, `queue_tell` 2112, `queue_reply` 2129, `queue_reply_parts` 2136 |
| 2199–2452 | the mailbox (scaling plan, Phase 5) | `mail_key` 2213, `mail_shared_key` 2215, `mail_auth` 2224, `mail_id_str` 2232, `mail_text_in` 2234, `mail_first_name` 2240, `mail_store` 2243, `mail_draft` 2297, `mail_after_outcome` 2314, `mail_answer` 2325, `mail_answer_text` 2334, `mail_beat` 2378, `mail_state` 2394, `outreach_copy` 2408 |
| 2453–2579 | reviews and what managers add (scaling plan, Phase 6) | `mod_cfg` 2459, `mod_private` 2460, `review_fresh_mode` 2463, `listing_names` 2468, `content_mode` 2471, `claim_code_on` 2478, `mask_email` 2484, `content_decisions` 2489, `content_apply` 2519, `content_publish` 2545 |
| 2580–2916 | the morning summary, and the pushes that can't wait (scaling plan, Phase 3) | `ap_ctx` 2588, `ap_github_ready` 2595, `summary_on` 2596, `owner_push` 2603, `publish_watch` 2616, `sum_plural` 2639, `sum_when` 2640, `owner_summary` 2642, `sign_in` 2801, `http_get` 2830, `google_email` 2843, `edit_key_state` 2868, `edit_key_out` 2903, `year_end` 2908 |
| 2917–4576 | the routes: one `case` per request (listed under Routes) | — |

### Routes

| Group | Routes (line) |
|---|---|
| one more for a listing | `POST hit` 2922 |
| is everything working? | `GET health` 2939 |
| signing in | `POST login_start` 2949, `POST login_finish` 2978, `POST login_google` 3002, `POST email_start` 3013, `POST email_finish` 3040, `GET me` 3075, `GET school_ask` 3083, `POST school_ask` 3089, `POST logout` 3097, `POST logout_all` 3104, `POST set_name` 3112, `POST basics` 3123, `POST phone_save` 3144, `POST hood_save` 3152 |
| following and favorites | `GET marks` 3162, `POST follow` 3169 |
| stopping from an email, with no sign-in | `GET stopped` 3183, `POST stop` 3195, `POST unmute` 3226, `POST follow_synced` 3235, `POST follow_clear` 3248, `POST fav` 3254, `POST listed` 3267 |
| co-parents | `POST coparent_invite` 3276, `POST coparent_resend` 3290, `POST coparent_cancel` 3299, `POST coparent_accept` 3305, `POST coparent_end` 3351, `POST delete_account` 3364 |
| directors | `GET claimed` 3377, `GET photo` 3394, `GET extras` 3418 |
| notifications | `GET push_key` 3427, `POST push_on` 3434, `POST push_off` 3452, `POST push_mode` 3462, `POST push_test` 3471, `POST push_run` 3483 |
| reviews (scaling plan, Phase 6) | `POST review_add` 3528, `GET review_check` 3574, `GET photo_look` 3589 |
| claims by code (Phase 6, call 2; off until "claimByCode" | `POST claim_code_start` 3610, `POST claim_code_finish` 3656 |
| the mailbox script (scaling plan, Phase 5) | `POST mail_in` 3696, `POST mail_out` 3703, `POST mail_sent` 3723, `POST outreach_copy` 3740, `POST ask` 3747, `POST extra_save` 3784, `POST extra_drop` 3866, `POST photo_add` 3875, `POST photo_drop` 3922, `GET claims` 3936, `POST mgr_mail` 3942, `POST claim_add` 3952, `POST claim_drop` 4004, `POST premium_ask` 4014, `POST space_set` 4039, `POST edit_add` 4055 |
| a profile | `GET profile` 4076 |
| the passport | `GET passport` 4082, `POST passport_save` 4086, `POST passport_reset` 4113, `POST school_save` 4132, `POST grades_save` 4142, `POST ages_save` 4155, `POST kids_save` 4169, `POST week_save` 4196, `POST week_delete` 4215, `POST summer_save` 4230, `POST summer_delete` 4240, `POST daysoff_save` 4247, `POST daysoff_delete` 4257, `POST share_one` 4265 |
| groups | `POST group_create` 4310, `POST group_peek` 4328, `POST group_join` 4341, `POST invite_add` 4387, `POST invite_remove` 4410, `POST kid_save` 4421, `POST sync` 4451, `POST kid_delete` 4479, `GET group` 4487, `POST member_decide` 4513, `POST group_leave` 4536, `POST group_code` 4547, `POST group_rename` 4556, `POST group_delete` 4566 |
