# Code map

Written by `scripts/code-map.mjs`. The publishing job rewrites it on `main` after every merge, so it matches `main`.
Don't edit it or commit it from a branch: that copy would conflict. For a branch's own line numbers, run
`node scripts/code-map.mjs --out /tmp/code-map.md`.

Use it to open only the lines you need: find the function here, then read from its line.

## build.mjs (7165 lines)

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
| 4100–5126 | for the people who manage a program | `CLAIM_GETS` 4102, `CLAIM_GETS_ALL` 4103, `claimDemo` 4111, `directorsPage` 4151, `premiumPage` 4232, `editClaimsPhp` 4359, `tell` 4482, `groupsInfo` 4624, `joinPage` 4629, `groupPage` 4648, `groupsApiPhp` 4660, `queuePhp` 4673, `mailPhp` 4676, `phpCopy` 4686, `boardPage` 4707, `rvNames` 4920, `reviewPage` 4921, `reviewThanksPage` 4997, `reviewPhp` 5006, `fail` 5017, `field` 5023, `one_line` 5028 |
| 5127–5209 | sending mail | `pas_mail_key` 5133, `pas_mail_via` 5141, `pas_mail_note` 5143, `pas_mail_state` 5156, `pas_mail_week` 5161, `pas_mail_kind` 5169, `pas_postmark` 5172, `pas_mail_via` 5201, `pas_mail_note` 5202, `pas_mail_state` 5203, `pas_mail_week` 5204, `pas_mail_kind` 5205, `pas_postmark` 5206, `mailerPhp` 5208 |
| 5210–5583 | edit mode | `editAuthPhp` 5219, `edit_key` 5223, `edit_db` 5239, `edit_account` 5261, `edit_admin` 5284, `edit_editor` 5292, `edit_signed_in` 5309, `editSignInPage` 5315, `editIndexPhp` 5329, `editStatsPhp` 5351, `editEmailsPage` 5487, `editEmailsPhp` 5498, `editPage` 5507, `editPhp` 5568, `ghPhp` 5582 |
| 5584–5656 | the research runs' queue | `editQueuePhp` 5585 |
| 5657–5683 | the autopilot as the owner sees it (scaling plan, Phase 3) | `autopilotPhp` 5663, `editAutopilotPage` 5664, `editNeedsPhp` 5681, `editAutopilotPhp` 5682 |
| 5684–5705 | summer camps | `campAreas` 5704, `seasonPill` 5705 |
| 5706–5759 | summer schedule | `utcDay` 5715, `plusDays` 5716, `mondayOf` 5717, `campWeeks` 5718, `summerPlan` 5745 |
| 5760–5765 | my kids' calendar | — |
| 5766–6182 | Kids' Playground | `mapHood` 5788, `HOOD_AREA` 5848, `mapArea` 5860, `mapAreas` 5861, `surpriseHoods` 5878, `kidsStar` 5915, `kidsDot` 5916, `kidsIcon` 6007, `bingoCard` 6016, `actHits` 6073, `kidsData` 6087, `kidsDataV` 6120, `kidsShowcase` 6125, `kidsHow` 6153, `kidsPage` 6164 |
| 6183–6301 | Account Features | `FEATS` 6187, `featArt` 6190, `featPage` 6222 |
| 6302–6714 | the planners in one place | `schedulesPage` 6304, `todoPage` 6372, `calendarPage` 6411, `summerSchedulePage` 6543, `summerWeeksPage` 6663 |
| 6715–6872 | a page per summer camp | `campPath` 6717, `campLink` 6719, `campAsListing` 6721, `campAges` 6722, `campPrice` 6723, `campHoursShort` 6724, `campWeeksShort` 6725, `summerBlock` 6729, `campPage` 6762, `campMovedPage` 6819, `summerCampsPage` 6833 |
| 6873–6908 | weekend classes | `weekendAreas` 6878, `weekendByArea` 6879, `weekendRow` 6880, `weekendPage` 6885 |
| 6909–6998 | all programs | `allProgramsPage` 6914, `notFoundPage` 6992 |
| 6999–7165 | write | `write` 7001 |

## src/server/groups-api.php (4213 lines)

The accounts API. `build.mjs` writes it into the site as `groups/api.php`, with its settings filled in. Functions
first, then the 85 routes, which live in one `switch` on the method and action.

| Lines | Section | Functions (line) |
|---|---|---|
| 1–81 | (top of the file) | `out` 76, `fail` 77, `b64` 78, `h` 79, `now` 80 |
| 82–278 | where things are kept | `data_dir` 83, `secret` 88, `db` 102, `seal_existing` 231, `q` 247, `row` 248, `val` 249, `bump` 251, `tidy` 256 |
| 279–321 | a copy of the database, once a day | `today_ny` 285, `backup_dir` 286, `last_backup` 287, `backup` 292 |
| 322–450 | a copy off the host, once a day | `offsite_repo` 334, `offsite_token` 335, `offsite_gh` 340, `offsite_key` 353, `offsite_seal` 354, `offsite_open` 359, `offsite_counts` 367, `offsite_state` 377, `offsite_photos_left` 383, `offsite_fail` 391, `offsite_run` 392 |
| 451–457 | slowing down guessing and floods | `who` 452, `too_many` 453, `note` 456 |
| 458–497 | the request | `str` 478, `first_name` 484, `person_name` 489, `group_name` 493 |
| 498–527 | who is signed in | `set_session_cookie` 499, `session_ends` 503, `current_user` 506, `need_user` 522 |
| 528–585 | email | `send_mail` 532, `t` 560, `paras` 567, `email_html` 572 |
| 586–606 | group codes | `new_code` 587, `tidy_code` 593, `code_mac` 594, `code_seal` 595, `code_open` 600 |
| 607–632 | what is kept about a child is encrypted in the file | `seal_key` 615, `seal` 616, `unseal` 623, `by_name` 631 |
| 633–661 | a child's week | `programs` 634, `schools` 647, `school_names` 648, `hoods` 657 |
| 662–685 | a phone number for texts | `phone_clean` 666, `phone_show` 671, `phone_set` 675 |
| 686–939 | following and favorites | `mark_name` 690, `stop_code` 701, `stop_hash` 706, `stop_mark` 707, `muted` 713, `follow_kinds` 716, `only_mark` 723, `follow_on` 727, `follow_off` 741, `follow_off_all` 747, `fav_on` 751, `marks_out` 759, `clean_week` 774, `week_from_full` 794, `week_kid` 808, `week_count` 813, `week_follow` 815, `week_shares` 823, `clean_week_full` 834, `week_out` 859, `grade_list` 862, `kids_list` 864, `clean_summer` 874, `summer_out` 894, `clean_daysoff` 906, `daysoff_out` 929 |
| 940–1222 | the passport | `school_year` 962, `passport_key` 967, `passport_clean` 968, `passport_kid` 1026, `passport_row` 1032, `passport_data` 1038, `passport_suggest` 1044, `passport_out` 1098, `program_pins` 1110, `passport_favs` 1124, `profile_out` 1130, `kid_out` 1136, `membership` 1140, `invited` 1146, `not_invited` 1149, `invite_out` 1152, `send_invite` 1159, `invite_one` 1192, `need_owner` 1204, `my_groups` 1209, `ready` 1221 |
| 1223–1316 | co-parents | `home_id` 1232, `household` 1233, `in_list` 1239, `home_user` 1240, `named` 1245, `coparent_out` 1247, `send_coparent_invite` 1266, `me_out` 1284, `has_family` 1298, `is_admin` 1306, `role_of` 1313 |
| 1317–1350 | directors | `listings` 1321, `base_domain` 1326, `email_domain` 1331, `stats_of` 1336 |
| 1351–1537 | notifications on a phone or computer (web push) | `meta_get` 1356, `meta_set` 1357, `b64u_dec` 1358, `ec_point` 1362, `vapid` 1366, `push_endpoint_ok` 1386, `push_state` 1396, `push_send` 1402, `push_to_user` 1444, `push_feed` 1455, `push_due` 1463, `push_note` 1496, `push_run` 1510 |
| 1538–1676 | premium listings | `premium_mode` 1542, `is_premium` 1547, `holds` 1553, `premium_shows` 1557, `photos_public` 1562, `photos_of` 1567, `social_url` 1576, `post_url` 1591, `extra_live` 1596, `extras_out` 1603, `stats_more` 1616, `premium_out` 1634, `claim_out` 1648, `space_of` 1663, `photo_live` 1668, `photo_file` 1671, `my_claims` 1672 |
| 1677–1710 | asking for a school that isn't covered yet | `school_ask_on` 1681, `tell_owner` 1706 |
| 1711–1884 | emails to the people who run a listing | `listing_url` 1718, `listing_plain` 1719, `mgr_holders` 1721, `mgr_send` 1731, `mgr_prompt` 1744, `mgr_plural` 1757, `mgr_numbers` 1759, `mgr_run` 1772 |
| 1885–1946 | a new account | `owner_note_mode` 1892, `signup_note` 1899, `signup_named` 1911, `signup_catchup` 1918, `signup_digest` 1927 |
| 1947–2163 | the private queue (scaling plan, Phase 2) | `ops_repo` 1969, `queue_ctx` 1970, `queue_run` 1979, `queue_outcomes` 1994, `queue_apply` 2027, `queue_settle_proposal` 2058, `queue_merges` 2065, `queue_tell` 2089, `queue_reply` 2104, `queue_reply_parts` 2111 |
| 2164–2417 | the mailbox (scaling plan, Phase 5) | `mail_key` 2178, `mail_shared_key` 2180, `mail_auth` 2189, `mail_id_str` 2197, `mail_text_in` 2199, `mail_first_name` 2205, `mail_store` 2208, `mail_draft` 2262, `mail_after_outcome` 2279, `mail_answer` 2290, `mail_answer_text` 2299, `mail_beat` 2343, `mail_state` 2359, `outreach_copy` 2373 |
| 2418–2754 | the morning summary, and the pushes that can't wait (scaling plan, Phase 3) | `ap_ctx` 2426, `ap_github_ready` 2433, `summary_on` 2434, `owner_push` 2441, `publish_watch` 2454, `sum_plural` 2477, `sum_when` 2478, `owner_summary` 2480, `sign_in` 2639, `http_get` 2668, `google_email` 2681, `edit_key_state` 2706, `edit_key_out` 2741, `year_end` 2746 |
| 2755–4213 | the routes: one `case` per request (listed under Routes) | — |

### Routes

| Group | Routes (line) |
|---|---|
| one more for a listing | `POST hit` 2760 |
| is everything working? | `GET health` 2777 |
| signing in | `POST login_start` 2787, `POST login_finish` 2816, `POST login_google` 2840, `POST email_start` 2851, `POST email_finish` 2878, `GET me` 2913, `GET school_ask` 2921, `POST school_ask` 2927, `POST logout` 2935, `POST logout_all` 2942, `POST set_name` 2950, `POST basics` 2961, `POST phone_save` 2982, `POST hood_save` 2990 |
| following and favorites | `GET marks` 3000, `POST follow` 3007 |
| stopping from an email, with no sign-in | `GET stopped` 3021, `POST stop` 3033, `POST unmute` 3064, `POST follow_synced` 3073, `POST follow_clear` 3086, `POST fav` 3092, `POST listed` 3105 |
| co-parents | `POST coparent_invite` 3114, `POST coparent_resend` 3128, `POST coparent_cancel` 3137, `POST coparent_accept` 3143, `POST coparent_end` 3189, `POST delete_account` 3202 |
| directors | `GET claimed` 3215, `GET photo` 3232, `GET extras` 3256 |
| notifications | `GET push_key` 3265, `POST push_on` 3272, `POST push_off` 3290, `POST push_mode` 3300, `POST push_test` 3309, `POST push_run` 3321 |
| the mailbox script (scaling plan, Phase 5) | `POST mail_in` 3363, `POST mail_out` 3370, `POST mail_sent` 3390, `POST outreach_copy` 3407, `POST ask` 3414, `POST extra_save` 3451, `POST extra_drop` 3525, `POST photo_add` 3534, `POST photo_drop` 3579, `GET claims` 3593, `POST mgr_mail` 3599, `POST claim_add` 3609, `POST claim_drop` 3641, `POST premium_ask` 3651, `POST space_set` 3676, `POST edit_add` 3692 |
| a profile | `GET profile` 3713 |
| the passport | `GET passport` 3719, `POST passport_save` 3723, `POST passport_reset` 3750, `POST school_save` 3769, `POST grades_save` 3779, `POST ages_save` 3792, `POST kids_save` 3806, `POST week_save` 3833, `POST week_delete` 3852, `POST summer_save` 3867, `POST summer_delete` 3877, `POST daysoff_save` 3884, `POST daysoff_delete` 3894, `POST share_one` 3902 |
| groups | `POST group_create` 3947, `POST group_peek` 3965, `POST group_join` 3978, `POST invite_add` 4024, `POST invite_remove` 4047, `POST kid_save` 4058, `POST sync` 4088, `POST kid_delete` 4116, `GET group` 4124, `POST member_decide` 4150, `POST group_leave` 4173, `POST group_code` 4184, `POST group_rename` 4193, `POST group_delete` 4203 |
