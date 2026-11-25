# Code map

Written by `scripts/code-map.mjs`. The publishing job rewrites it on `main` after every merge, so it matches `main`.
Don't edit it or commit it from a branch: that copy would conflict. For a branch's own line numbers, run
`node scripts/code-map.mjs --out /tmp/code-map.md`.

Use it to open only the lines you need: find the function here, then read from its line.

## build.mjs (7251 lines)

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
| 4100–5209 | for the people who manage a program | `CLAIM_GETS` 4102, `CLAIM_GETS_ALL` 4103, `claimDemo` 4111, `directorsPage` 4151, `premiumPage` 4232, `editClaimsPhp` 4359, `tell` 4482, `groupsInfo` 4624, `joinPage` 4629, `groupPage` 4648, `groupsApiPhp` 4660, `queuePhp` 4674, `mailPhp` 4677, `contentPhp` 4680, `MODERATION` 4683, `phpCopy` 4698, `boardPage` 4719, `rvNames` 4932, `reviewPage` 4933, `reviewPolicyPage` 5020, `reviewThanksPage` 5066, `reviewNoScriptPhp` 5078, `reviewPhp` 5088, `fail` 5100, `field` 5106, `one_line` 5111 |
| 5210–5292 | sending mail | `pas_mail_key` 5216, `pas_mail_via` 5224, `pas_mail_note` 5226, `pas_mail_state` 5239, `pas_mail_week` 5244, `pas_mail_kind` 5252, `pas_postmark` 5255, `pas_mail_via` 5284, `pas_mail_note` 5285, `pas_mail_state` 5286, `pas_mail_week` 5287, `pas_mail_kind` 5288, `pas_postmark` 5289, `mailerPhp` 5291 |
| 5293–5666 | edit mode | `editAuthPhp` 5302, `edit_key` 5306, `edit_db` 5322, `edit_account` 5344, `edit_admin` 5367, `edit_editor` 5375, `edit_signed_in` 5392, `editSignInPage` 5398, `editIndexPhp` 5412, `editStatsPhp` 5434, `editEmailsPage` 5570, `editEmailsPhp` 5581, `editPage` 5590, `editPhp` 5651, `ghPhp` 5665 |
| 5667–5740 | the research runs' queue | `editQueuePhp` 5668 |
| 5741–5768 | the autopilot as the owner sees it (scaling plan, Phase 3) | `autopilotPhp` 5747, `editAutopilotPage` 5748, `editNeedsPhp` 5766, `editAutopilotPhp` 5767 |
| 5769–5790 | summer camps | `campAreas` 5789, `seasonPill` 5790 |
| 5791–5844 | summer schedule | `utcDay` 5800, `plusDays` 5801, `mondayOf` 5802, `campWeeks` 5803, `summerPlan` 5830 |
| 5845–5850 | my kids' calendar | — |
| 5851–6267 | Kids' Playground | `mapHood` 5873, `HOOD_AREA` 5933, `mapArea` 5945, `mapAreas` 5946, `surpriseHoods` 5963, `kidsStar` 6000, `kidsDot` 6001, `kidsIcon` 6092, `bingoCard` 6101, `actHits` 6158, `kidsData` 6172, `kidsDataV` 6205, `kidsShowcase` 6210, `kidsHow` 6238, `kidsPage` 6249 |
| 6268–6386 | Account Features | `FEATS` 6272, `featArt` 6275, `featPage` 6307 |
| 6387–6799 | the planners in one place | `schedulesPage` 6389, `todoPage` 6457, `calendarPage` 6496, `summerSchedulePage` 6628, `summerWeeksPage` 6748 |
| 6800–6957 | a page per summer camp | `campPath` 6802, `campLink` 6804, `campAsListing` 6806, `campAges` 6807, `campPrice` 6808, `campHoursShort` 6809, `campWeeksShort` 6810, `summerBlock` 6814, `campPage` 6847, `campMovedPage` 6904, `summerCampsPage` 6918 |
| 6958–6993 | weekend classes | `weekendAreas` 6963, `weekendByArea` 6964, `weekendRow` 6965, `weekendPage` 6970 |
| 6994–7083 | all programs | `allProgramsPage` 6999, `notFoundPage` 7077 |
| 7084–7251 | write | `write` 7086 |

## src/server/groups-api.php (4602 lines)

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
| 1953–2224 | the private queue (scaling plan, Phase 2) | `ops_repo` 1975, `queue_ctx` 1976, `queue_run` 1985, `queue_outcomes` 2001, `queue_apply` 2034, `review_after_outcome` 2073, `queue_settle_proposal` 2079, `queue_merges` 2086, `queue_tell` 2112, `queue_reply` 2129, `answer_copies_on` 2142, `answer_copy` 2143, `queue_reply_parts` 2161 |
| 2225–2478 | the mailbox (scaling plan, Phase 5) | `mail_key` 2239, `mail_shared_key` 2241, `mail_auth` 2250, `mail_id_str` 2258, `mail_text_in` 2260, `mail_first_name` 2266, `mail_store` 2269, `mail_draft` 2323, `mail_after_outcome` 2340, `mail_answer` 2351, `mail_answer_text` 2360, `mail_beat` 2404, `mail_state` 2420, `outreach_copy` 2434 |
| 2479–2605 | reviews and what managers add (scaling plan, Phase 6) | `mod_cfg` 2485, `mod_private` 2486, `review_fresh_mode` 2489, `listing_names` 2494, `content_mode` 2497, `claim_code_on` 2504, `mask_email` 2510, `content_decisions` 2515, `content_apply` 2545, `content_publish` 2571 |
| 2606–2942 | the morning summary, and the pushes that can't wait (scaling plan, Phase 3) | `ap_ctx` 2614, `ap_github_ready` 2621, `summary_on` 2622, `owner_push` 2629, `publish_watch` 2642, `sum_plural` 2665, `sum_when` 2666, `owner_summary` 2668, `sign_in` 2827, `http_get` 2856, `google_email` 2869, `edit_key_state` 2894, `edit_key_out` 2929, `year_end` 2934 |
| 2943–4602 | the routes: one `case` per request (listed under Routes) | — |

### Routes

| Group | Routes (line) |
|---|---|
| one more for a listing | `POST hit` 2948 |
| is everything working? | `GET health` 2965 |
| signing in | `POST login_start` 2975, `POST login_finish` 3004, `POST login_google` 3028, `POST email_start` 3039, `POST email_finish` 3066, `GET me` 3101, `GET school_ask` 3109, `POST school_ask` 3115, `POST logout` 3123, `POST logout_all` 3130, `POST set_name` 3138, `POST basics` 3149, `POST phone_save` 3170, `POST hood_save` 3178 |
| following and favorites | `GET marks` 3188, `POST follow` 3195 |
| stopping from an email, with no sign-in | `GET stopped` 3209, `POST stop` 3221, `POST unmute` 3252, `POST follow_synced` 3261, `POST follow_clear` 3274, `POST fav` 3280, `POST listed` 3293 |
| co-parents | `POST coparent_invite` 3302, `POST coparent_resend` 3316, `POST coparent_cancel` 3325, `POST coparent_accept` 3331, `POST coparent_end` 3377, `POST delete_account` 3390 |
| directors | `GET claimed` 3403, `GET photo` 3420, `GET extras` 3444 |
| notifications | `GET push_key` 3453, `POST push_on` 3460, `POST push_off` 3478, `POST push_mode` 3488, `POST push_test` 3497, `POST push_run` 3509 |
| reviews (scaling plan, Phase 6) | `POST review_add` 3554, `GET review_check` 3600, `GET photo_look` 3615 |
| claims by code (Phase 6, call 2; off until "claimByCode" | `POST claim_code_start` 3636, `POST claim_code_finish` 3682 |
| the mailbox script (scaling plan, Phase 5) | `POST mail_in` 3722, `POST mail_out` 3729, `POST mail_sent` 3749, `POST outreach_copy` 3766, `POST ask` 3773, `POST extra_save` 3810, `POST extra_drop` 3892, `POST photo_add` 3901, `POST photo_drop` 3948, `GET claims` 3962, `POST mgr_mail` 3968, `POST claim_add` 3978, `POST claim_drop` 4030, `POST premium_ask` 4040, `POST space_set` 4065, `POST edit_add` 4081 |
| a profile | `GET profile` 4102 |
| the passport | `GET passport` 4108, `POST passport_save` 4112, `POST passport_reset` 4139, `POST school_save` 4158, `POST grades_save` 4168, `POST ages_save` 4181, `POST kids_save` 4195, `POST week_save` 4222, `POST week_delete` 4241, `POST summer_save` 4256, `POST summer_delete` 4266, `POST daysoff_save` 4273, `POST daysoff_delete` 4283, `POST share_one` 4291 |
| groups | `POST group_create` 4336, `POST group_peek` 4354, `POST group_join` 4367, `POST invite_add` 4413, `POST invite_remove` 4436, `POST kid_save` 4447, `POST sync` 4477, `POST kid_delete` 4505, `GET group` 4513, `POST member_decide` 4539, `POST group_leave` 4562, `POST group_code` 4573, `POST group_rename` 4582, `POST group_delete` 4592 |
