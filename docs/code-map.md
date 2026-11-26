# Code map

Written by `scripts/code-map.mjs`. The publishing job rewrites it on `main` after every merge, so it matches `main`.
Don't edit it or commit it from a branch: that copy would conflict. For a branch's own line numbers, run
`node scripts/code-map.mjs --out /tmp/code-map.md`.

Use it to open only the lines you need: find the function here, then read from its line.

## build.mjs (7331 lines)

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
| 4120–5288 | for the people who manage a program | `CLAIM_GETS` 4122, `CLAIM_GETS_ALL` 4123, `claimDemo` 4131, `directorsPage` 4171, `premiumPage` 4252, `claimWhyOptions` 4396, `claimWords` 4397, `editClaimsPhp` 4416, `tell` 4543, `groupsInfo` 4697, `joinPage` 4702, `groupPage` 4721, `groupsApiPhp` 4733, `queuePhp` 4747, `mailPhp` 4750, `contentPhp` 4753, `MODERATION` 4756, `emailHidden` 4771, `phpCopy` 4777, `boardPage` 4798, `rvNames` 5011, `reviewPage` 5012, `reviewPolicyPage` 5099, `reviewThanksPage` 5145, `reviewNoScriptPhp` 5157, `reviewPhp` 5167, `fail` 5179, `field` 5185, `one_line` 5190 |
| 5289–5371 | sending mail | `pas_mail_key` 5295, `pas_mail_via` 5303, `pas_mail_note` 5305, `pas_mail_state` 5318, `pas_mail_week` 5323, `pas_mail_kind` 5331, `pas_postmark` 5334, `pas_mail_via` 5363, `pas_mail_note` 5364, `pas_mail_state` 5365, `pas_mail_week` 5366, `pas_mail_kind` 5367, `pas_postmark` 5368, `mailerPhp` 5370 |
| 5372–5745 | edit mode | `editAuthPhp` 5381, `edit_key` 5385, `edit_db` 5401, `edit_account` 5423, `edit_admin` 5446, `edit_editor` 5454, `edit_signed_in` 5471, `editSignInPage` 5477, `editIndexPhp` 5491, `editStatsPhp` 5513, `editEmailsPage` 5649, `editEmailsPhp` 5660, `editPage` 5669, `editPhp` 5730, `ghPhp` 5744 |
| 5746–5820 | the research runs' queue | `editQueuePhp` 5747 |
| 5821–5848 | the autopilot as the owner sees it (scaling plan, Phase 3) | `autopilotPhp` 5827, `editAutopilotPage` 5828, `editNeedsPhp` 5846, `editAutopilotPhp` 5847 |
| 5849–5870 | summer camps | `campAreas` 5869, `seasonPill` 5870 |
| 5871–5924 | summer schedule | `utcDay` 5880, `plusDays` 5881, `mondayOf` 5882, `campWeeks` 5883, `summerPlan` 5910 |
| 5925–5930 | my kids' calendar | — |
| 5931–6347 | Kids' Playground | `mapHood` 5953, `HOOD_AREA` 6013, `mapArea` 6025, `mapAreas` 6026, `surpriseHoods` 6043, `kidsStar` 6080, `kidsDot` 6081, `kidsIcon` 6172, `bingoCard` 6181, `actHits` 6238, `kidsData` 6252, `kidsDataV` 6285, `kidsShowcase` 6290, `kidsHow` 6318, `kidsPage` 6329 |
| 6348–6466 | Account Features | `FEATS` 6352, `featArt` 6355, `featPage` 6387 |
| 6467–6879 | the planners in one place | `schedulesPage` 6469, `todoPage` 6537, `calendarPage` 6576, `summerSchedulePage` 6708, `summerWeeksPage` 6828 |
| 6880–7037 | a page per summer camp | `campPath` 6882, `campLink` 6884, `campAsListing` 6886, `campAges` 6887, `campPrice` 6888, `campHoursShort` 6889, `campWeeksShort` 6890, `summerBlock` 6894, `campPage` 6927, `campMovedPage` 6984, `summerCampsPage` 6998 |
| 7038–7073 | weekend classes | `weekendAreas` 7043, `weekendByArea` 7044, `weekendRow` 7045, `weekendPage` 7050 |
| 7074–7163 | all programs | `allProgramsPage` 7079, `notFoundPage` 7157 |
| 7164–7331 | write | `write` 7166 |

## src/server/groups-api.php (4880 lines)

The accounts API. `build.mjs` writes it into the site as `groups/api.php`, with its settings filled in. Functions
first, then the 92 routes, which live in one `switch` on the method and action.

| Lines | Section | Functions (line) |
|---|---|---|
| 1–82 | (top of the file) | `out` 77, `fail` 78, `b64` 79, `h` 80, `now` 81 |
| 83–292 | where things are kept | `data_dir` 84, `secret` 89, `db` 103, `seal_existing` 245, `q` 261, `row` 262, `val` 263, `bump` 265, `tidy` 270 |
| 293–335 | a copy of the database, once a day | `today_ny` 299, `backup_dir` 300, `last_backup` 301, `backup` 306 |
| 336–464 | a copy off the host, once a day | `offsite_repo` 348, `offsite_token` 349, `offsite_gh` 354, `offsite_key` 367, `offsite_seal` 368, `offsite_open` 373, `offsite_counts` 381, `offsite_state` 391, `offsite_photos_left` 397, `offsite_fail` 405, `offsite_run` 406 |
| 465–471 | slowing down guessing and floods | `who` 466, `too_many` 467, `note` 470 |
| 472–511 | the request | `str` 492, `first_name` 498, `person_name` 503, `group_name` 507 |
| 512–541 | who is signed in | `set_session_cookie` 513, `session_ends` 517, `current_user` 520, `need_user` 536 |
| 542–599 | email | `send_mail` 546, `t` 574, `paras` 581, `email_html` 586 |
| 600–620 | group codes | `new_code` 601, `tidy_code` 607, `code_mac` 608, `code_seal` 609, `code_open` 614 |
| 621–646 | what is kept about a child is encrypted in the file | `seal_key` 629, `seal` 630, `unseal` 637, `by_name` 645 |
| 647–675 | a child's week | `programs` 648, `schools` 661, `school_names` 662, `hoods` 671 |
| 676–699 | a phone number for texts | `phone_clean` 680, `phone_show` 685, `phone_set` 689 |
| 700–953 | following and favorites | `mark_name` 704, `stop_code` 715, `stop_hash` 720, `stop_mark` 721, `muted` 727, `follow_kinds` 730, `only_mark` 737, `follow_on` 741, `follow_off` 755, `follow_off_all` 761, `fav_on` 765, `marks_out` 773, `clean_week` 788, `week_from_full` 808, `week_kid` 822, `week_count` 827, `week_follow` 829, `week_shares` 837, `clean_week_full` 848, `week_out` 873, `grade_list` 876, `kids_list` 878, `clean_summer` 888, `summer_out` 908, `clean_daysoff` 920, `daysoff_out` 943 |
| 954–1236 | the passport | `school_year` 976, `passport_key` 981, `passport_clean` 982, `passport_kid` 1040, `passport_row` 1046, `passport_data` 1052, `passport_suggest` 1058, `passport_out` 1112, `program_pins` 1124, `passport_favs` 1138, `profile_out` 1144, `kid_out` 1150, `membership` 1154, `invited` 1160, `not_invited` 1163, `invite_out` 1166, `send_invite` 1173, `invite_one` 1206, `need_owner` 1218, `my_groups` 1223, `ready` 1235 |
| 1237–1330 | co-parents | `home_id` 1246, `household` 1247, `in_list` 1253, `home_user` 1254, `named` 1259, `coparent_out` 1261, `send_coparent_invite` 1280, `me_out` 1298, `has_family` 1312, `is_admin` 1320, `role_of` 1327 |
| 1331–1364 | directors | `listings` 1335, `base_domain` 1340, `email_domain` 1345, `stats_of` 1350 |
| 1365–1551 | notifications on a phone or computer (web push) | `meta_get` 1370, `meta_set` 1371, `b64u_dec` 1372, `ec_point` 1376, `vapid` 1380, `push_endpoint_ok` 1400, `push_state` 1410, `push_send` 1416, `push_to_user` 1458, `push_feed` 1469, `push_due` 1477, `push_note` 1510, `push_run` 1524 |
| 1552–1693 | premium listings | `premium_mode` 1556, `is_premium` 1561, `holds` 1567, `premium_shows` 1571, `photos_public` 1576, `photos_of` 1581, `social_url` 1590, `post_url` 1605, `extra_live` 1610, `extras_out` 1617, `stats_more` 1630, `premium_out` 1648, `claim_out` 1662, `space_of` 1685, `photo_live` 1690, `photo_file` 1693 |
| 1694–1822 | a manager's own fields | `manager_fields_mode` 1706, `claim_by_domain` 1708, `lf_time` 1713, `lf_day_names` 1718, `told_sum` 1726, `lf_apply` 1742, `repo_json` 1776, `lf_publish` 1782, `my_claims` 1818 |
| 1823–1856 | asking for a school that isn't covered yet | `school_ask_on` 1827, `tell_owner` 1852 |
| 1857–2029 | emails to the people who run a listing | `listing_url` 1864, `listing_plain` 1865, `mgr_holders` 1867, `mgr_send` 1877, `mgr_prompt` 1890, `mgr_plural` 1903, `mgr_numbers` 1905, `mgr_run` 1918 |
| 2030–2091 | a new account | `owner_note_mode` 2037, `signup_note` 2044, `signup_named` 2056, `signup_catchup` 2063, `signup_digest` 2072 |
| 2092–2409 | the private queue (scaling plan, Phase 2) | `ops_repo` 2118, `queue_ctx` 2119, `queue_run` 2128, `queue_outcomes` 2144, `queue_apply` 2177, `review_after_outcome` 2219, `queue_settle_proposal` 2225, `queue_merges` 2232, `queue_tell` 2258, `queue_reply` 2277, `answer_copies_on` 2290, `answer_copy` 2291, `queue_missing_words` 2310, `queue_reply_parts` 2319 |
| 2410–2678 | the mailbox (scaling plan, Phase 5) | `people_mail` 2424, `outreach_mode` 2431, `mail_key` 2439, `mail_shared_key` 2441, `mail_auth` 2450, `mail_id_str` 2458, `mail_text_in` 2460, `mail_first_name` 2466, `mail_store` 2469, `mail_draft` 2523, `mail_after_outcome` 2540, `mail_answer` 2551, `mail_answer_text` 2560, `mail_beat` 2604, `mail_state` 2620, `outreach_copy` 2634 |
| 2679–2790 | reviews and what managers add (scaling plan, Phase 6) | `mod_cfg` 2685, `mod_private` 2686, `review_fresh_mode` 2689, `listing_names` 2694, `content_mode` 2697, `claim_code_on` 2704, `mask_email` 2710, `content_decisions` 2715, `content_apply` 2745, `content_publish` 2770 |
| 2791–3129 | the morning summary, and the pushes that can't wait (scaling plan, Phase 3) | `ap_ctx` 2799, `ap_github_ready` 2806, `summary_on` 2807, `owner_push` 2814, `publish_watch` 2827, `sum_plural` 2850, `sum_when` 2851, `owner_summary` 2853, `sign_in` 3014, `http_get` 3043, `google_email` 3056, `edit_key_state` 3081, `edit_key_out` 3116, `year_end` 3121 |
| 3130–4880 | the routes: one `case` per request (listed under Routes) | — |

### Routes

| Group | Routes (line) |
|---|---|
| one more for a listing | `POST hit` 3135 |
| is everything working? | `GET health` 3152 |
| signing in | `POST login_start` 3162, `POST login_finish` 3191, `POST login_google` 3215, `POST email_start` 3226, `POST email_finish` 3253, `GET me` 3288, `GET school_ask` 3296, `POST school_ask` 3302, `POST logout` 3310, `POST logout_all` 3317, `POST set_name` 3325, `POST basics` 3336, `POST phone_save` 3357, `POST hood_save` 3365 |
| following and favorites | `GET marks` 3375, `POST follow` 3382 |
| stopping from an email, with no sign-in | `GET stopped` 3396, `POST stop` 3408, `POST unmute` 3439, `POST follow_synced` 3448, `POST follow_clear` 3461, `POST fav` 3467, `POST listed` 3480 |
| co-parents | `POST coparent_invite` 3489, `POST coparent_resend` 3503, `POST coparent_cancel` 3512, `POST coparent_accept` 3518, `POST coparent_end` 3564, `POST delete_account` 3577 |
| directors | `GET claimed` 3590, `GET photo` 3607, `GET extras` 3631 |
| notifications | `GET push_key` 3640, `POST push_on` 3647, `POST push_off` 3665, `POST push_mode` 3675, `POST push_test` 3684, `POST push_run` 3696 |
| reviews (scaling plan, Phase 6) | `POST review_add` 3741, `GET review_check` 3787, `GET told_check` 3803, `GET photo_look` 3818 |
| claims by code (Phase 6, call 2; off until "claimByCode" | `POST claim_code_start` 3839, `POST claim_code_finish` 3885 |
| the mailbox script (scaling plan, Phase 5) | `POST mail_in` 3925, `POST mail_out` 3935, `POST mail_sent` 3955, `POST outreach_copy` 3972, `POST ask` 3980, `POST extra_save` 4017, `POST extra_drop` 4099, `POST photo_add` 4108, `POST photo_drop` 4155, `GET claims` 4169, `POST mgr_mail` 4175, `POST claim_add` 4185, `POST claim_drop` 4237, `POST premium_ask` 4247, `POST space_set` 4272, `POST edit_add` 4288 |
| a manager sets its own days, hours, cost, grades and pickup schools (see "a… | `POST listing_fields` 4309 |
| a profile | `GET profile` 4380 |
| the passport | `GET passport` 4386, `POST passport_save` 4390, `POST passport_reset` 4417, `POST school_save` 4436, `POST grades_save` 4446, `POST ages_save` 4459, `POST kids_save` 4473, `POST week_save` 4500, `POST week_delete` 4519, `POST summer_save` 4534, `POST summer_delete` 4544, `POST daysoff_save` 4551, `POST daysoff_delete` 4561, `POST share_one` 4569 |
| groups | `POST group_create` 4614, `POST group_peek` 4632, `POST group_join` 4645, `POST invite_add` 4691, `POST invite_remove` 4714, `POST kid_save` 4725, `POST sync` 4755, `POST kid_delete` 4783, `GET group` 4791, `POST member_decide` 4817, `POST group_leave` 4840, `POST group_code` 4851, `POST group_rename` 4860, `POST group_delete` 4870 |
