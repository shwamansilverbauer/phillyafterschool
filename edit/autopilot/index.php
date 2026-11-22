<?php
// What the autopilot merged (scaling plan, Phase 3): every run pull request that went live, newest first, by the
// autopilot or by hand, with what it changed (from its evidence file: the listing, the value before and after, the
// provider's page and the quote) and Undo. Undo takes back the whole pull request: GitHub makes the revert, the site's
// key merges it, and the site republishes. Where an email about the change may already have gone out, the entry says
// so, because an email can't be recalled. Generated into edit/autopilot/index.php by build.mjs, which fills in the
// marked lines (the config, the sign-in check, the GitHub helpers, the autopilot code) and lays out the page from the
// parts after /*HERO*/ and /*BODY*/; edit this file, not the copy in dist/. Only a site admin's account can undo.
$TO = "contact@phillyafterschool.org";
$SITE = "Philly After School";
$SITE_URL = "https://phillyafterschool.org";
$REPO = "shwamansilverbauer/phillyafterschool";
$AP = json_decode('{"branches":["queue-","new-schools-","weekly-","monthly-check-"],"authors":["shwamansilverbauer"],"allow":["data/programs.json","data/schools.json","data/camps.json","data/geo.json","data/reading.json","data/news.json","data/school-dates.json","data/reviews.json"],"evidenceDir":"evidence/"}', true);
$LABELS = json_decode('{"p:test-listing-premium":"Test Listing (Premium)","p:test-listing-free":"Test Listing (Free)","p:imagine-that-philly":"Imagine That Philly","p:nebinger-clubs":"School clubs and teams at Nebinger","p:girls-on-the-run":"Girls on the Run","p:soccer-shots-bache-martin":"Soccer Shots at Bache-Martin","p:fairmount-mountain-bike-team":"Fairmount Mountain Bike Team at Bache-Martin","p:beat-the-streets-wrestling":"Beat the Streets wrestling (middle school)","p:philadelphia-city-rowing":"Philadelphia City Rowing (middle school)","p:nebinger-arts-partners":"Arts partners and Science Olympiad at Nebinger","p:meredith-clubs":"Meredith after-school clubs","p:coppin-clubs":"School clubs and ensembles at Coppin","p:zhang-sah":"Zhang Sah","p:zhang-sah-mt-airy":"Zhang Sah (Mt. Airy)","p:jordan-family-learning-center":"Jordan Family Learning Center","p:shot-tower-rec":"Shot Tower Recreation Center","p:chew-playground":"Chew Playground","p:wharton-square-playground":"Wharton Square Playground","p:disilvestro-playground":"DiSilvestro Playground","p:francisville-rec":"Francisville Playground & Rec Center","p:clemente-playground":"Clemente Playground","p:rumph-rec":"Rumph Recreation Center","p:mount-airy-playground":"Mount Airy Playground","p:marian-anderson-rec":"Marian Anderson Recreation Center","p:capitolo-playground":"Capitolo Playground","p:markward-playground":"Markward Playground","p:philly-inmovement":"Philly InMovement: MOVE After School","p:settlement-kaleidoscope-plus":"Settlement Music School: Kaleidoscope Plus","p:philly-art-center-qv":"Philly Art Center, Queen Village","p:old-pine":"The NeighborHub","p:parent-infant-center":"Parent Infant Center After School Center","p:butchers-sew-shop":"Butcher’s Sew Shop Junior","p:mister-johns-music":"Mister John’s Music","p:music-theatre-philly":"Music Theatre Philly","p:arden-drama-school":"Arden Drama School","p:walnut-street-theatre-school":"Walnut Street Theatre School","p:coco-academy":"CoCo Academy","p:queen-and-rook":"Queen & Rook Game Cafe","p:everland-homework-club":"Homework Club at Everland","p:beehive-at-bok":"Beehive at Bok","p:dandelion-after-school":"Dandelion After School","p:code-ninjas-south-philly":"Code Ninjas (South Philly)","p:brilliant-minds":"Brilliant Minds","p:early-childhood-environment":"Early Childhood Environment","p:principal-academy":"Principal Academy","p:little-shepherds":"Little Shepherds Christian Learning Center","p:movemakers":"MoveMakers Philly","p:kids-on-12th":"Kids on 12th","p:columbus-square-rec":"Columbus Square Recreation Center","p:hawthorne-cultural-center":"Hawthorne Cultural Center","p:starr-garden-rec":"Starr Garden Recreation Center","p:palumbo-rec":"Palumbo Recreation Center","p:mighty-writers-el-futuro":"Mighty Writers El Futuro","p:free-library-leap":"Free Library LEAP","p:fleisher-art-memorial":"Fleisher Art Memorial","p:makom-community":"Makom Community","p:vare-washington-edey":"Extended Day, Extended Year at Vare-Washington","p:childs-edey":"Extended Day, Extended Year at Childs","p:vare-washington-clubs":"School clubs and teams at Vare-Washington","p:sunrise-mccall":"Sunrise of Philadelphia at McCall","p:sunrise-stanton":"Sunrise of Philadelphia at Stanton","p:mccall-clubs":"McCall clubs and teams","p:sawubona-creativity-project":"Sawubona Creativity Project","p:playarts-day-camps":"PlayArts day camps","p:philly-rock-gym-day-camps":"Philadelphia Rock Gym","p:skate-the-foundry":"Skate The Foundry","p:pafa-saturday-art":"PAFA Saturday Studio Art","p:moore-young-artists-workshop":"Moore Young Artists Workshop","p:philadelphia-museum-of-art-kids":"Philadelphia Museum of Art: Art Kids Classes","p:made-institute-sunday-sewing":"MADE Institute: Sunday Sewing","p:rock-school-for-dance":"The Rock School for Dance Education","p:koresh-school-of-dance":"Koresh School of Dance","p:school-of-philadelphia-ballet":"School of Philadelphia Ballet","p:zazz-dance":"ZAZZ","p:ics-21st-century":"21st Century Community Learning Center at ICS at Independence Charter","p:beacon-center":"Beacon Center for Children: After-School Program","p:evolve-dance":"Evolve Dance","p:martial-posture":"Martial Posture After School","p:yous-fitfulness":"Yous “Fitfulness” After-School","p:temple-music-prep-cmsp":"Temple Music Prep: Community Music Scholars","p:wissahickon-skating-club":"Wissahickon Skating Club","p:penn-ice-rink":"Penn Ice Rink","p:starfinder-saturday-soccer":"Starfinder: Saturday soccer","p:franklin-institute-pacts":"The Franklin Institute: PACTS","p:macguffin-theatre":"MacGuffin Theatre & Film Company","p:philadelphia-dance-academy":"The Philadelphia Dance Academy","p:sunrise-kirkbride":"Sunrise of Philadelphia at Kirkbride","p:kirkbride-clubs":"Kirkbride clubs and teams","p:sunrise-southwark":"Sunrise of Philadelphia at Southwark","p:southwark-clubs":"Southwark clubs and teams","p:stanton-clubs":"School clubs and teams at Stanton","p:marian-anderson-clubs":"School clubs and teams at Marian Anderson","p:childs-clubs":"School clubs and teams at Childs","p:bache-martin-clubs":"School clubs and teams at Bache-Martin","p:greenfield-clubs":"School clubs and teams at Greenfield","p:east-passyunk-rec":"East Passyunk Community Center","p:philadelphia-martial-arts-academy":"Philadelphia Martial Arts Academy","p:fitness-alive-south-philly":"Fitness Alive: swim lessons in South Philly","p:christian-street-ymca":"Christian Street YMCA","p:hudson-table-philadelphia":"Hudson Table","p:rizzo-rink":"Rizzo Rink","p:flips-4-kidz":"Flips 4 Kidz","p:equilibrium-dance-academy":"Equilibrium Dance Academy","p:blue-chip-flag-south-philadelphia":"Blue Chip Flag football, South Philadelphia","p:kumon-south-philadelphia":"Kumon Math & Reading Center of South Philadelphia","p:pennsport-school-of-dance":"Pennsport School of Dance","p:philly-pack":"Philly PACK","p:magic-gardens-family-jams":"Philadelphia’s Magic Gardens: Family Jams","p:phield-house":"Phield House","p:philadelphia-school-of-circus-arts":"Philadelphia School of Circus Arts","p:schuylkill-center":"The Schuylkill Center for Environmental Education","p:flipout-productions":"FlipOut Productions","p:elite-sports-factory":"Elite Sports Factory","p:movement-callowhill":"Movement Callowhill","p:the-philadelphia-school":"Camp TPS at The Philadelphia School","p:nlarts":"NLArts","p:philadelphia-youth-basketball":"Philadelphia Youth Basketball","p:awbury-arboretum":"Awbury Arboretum","p:skilladelphia":"Skilladelphia","p:philly-art-center-mt-airy":"Philly Art Center, Mt. Airy","p:philly-art-center-fairmount":"Philly Art Center (Fairmount)","p:uykq-after-care":"Urban Youth King & Queens (UYKQ) After-School","p:byers-after-school":"Russell Byers Charter School: After School Program","p:cpa-robert-morris":"Caring People Alliance at Robert Morris","p:morris-clubs":"School clubs at Robert Morris","p:water-tower-rec":"Water Tower Recreation Center","p:mastermindz-thomas":"Mastermindz Aftercare at Mastery Thomas","p:safehaven-thomas":"SafeHaven Aftercare at Mastery Thomas","p:bgc-emlen":"Boys & Girls Club at Emlen","p:emlen-clubs":"School clubs at Emlen","p:legacy-champions-on-the-rise":"LEGACY Champions on the Rise at Wright","p:sbnp-wright":"Shoot Basketballs NOT People: After School at Wright","p:zhang-sah-school-based":"Zhang Sah School-Based Programs at J.B. Kelly","p:iac-edmonds":"Indochinese American Council (IAC) Afterschool at Edmonds","p:ymwic-edmonds":"Young Men and Women In Charge (YMWIC) at Edmonds","p:mander-playground":"Mander Playground","p:gathers-rec":"Gathers Recreation Center","p:happy-hollow-playground":"Happy Hollow Playground","p:ela-willard":"Early Life Academy at Willard","p:wes-willard":"WES Health: WLCAS at Willard","p:uacs-lea":"UACS After-School Program at Lea","p:safe-haven-rhoads":"Safe Haven IV at Rhoads","p:rebel-tumblers-rhoads":"Rebel Arts Movement: Rebel Tumblers at Rhoads","p:ymca-juniata-park":"YMCA OST School Program at Juniata Park","p:asas-juniata-park":"After-School All-Stars at Juniata Park","p:bgc-greenberg":"Boys & Girls Club at Greenberg","p:philly-kidz-greenberg":"Philly KiDZ Initiative at Greenberg","p:pennypack-environmental-center":"Pennypack Environmental Center: Afterschool Adventures","p:gpca-fell":"GPCA Out of School Time at Fell","p:ace-locke":"Community Council ACE Program at Locke","p:ela-richmond":"Early Life Academy at Richmond","p:bgc-stephen-girard":"Boys & Girls Club at Stephen Girard","p:bgc-mifflin":"Boys & Girls Club at Mifflin","p:cpa-south-bgc":"Caring People Alliance: South Philadelphia Boys & Girls Club","p:lee-cultural-center":"Lee Cultural Center","p:cohocksink-rec":"Cohocksink Recreation Center","p:ymca-dunbar":"YMCA Out of School Time at Dunbar","p:catholic-charities-cayuga":"Catholic Charities OST at Cayuga","p:bgc-bayard-taylor":"Boys & Girls Club at Bayard Taylor","p:xiente-moffet":"Xiente After Care at Moffet","p:al-bustan-moffet":"Al-Bustan Drumming at Moffet","p:philly-kidz-anne-frank":"Philly KiDZ Initiative at Anne Frank","p:dendy-rec":"Dendy Recreation Center","p:hunting-park-rec":"Hunting Park Recreation Area","p:towey-playground":"Towey Playground","p:ymca-kelley":"YMCA Out of School Time at Kelley","p:ymca-gideon":"YMCA Out of School Time at Gideon","p:ymca-blaine":"YMCA Out of School Time at Blaine","p:ymca-hopkinson":"YMCA Out of School Time at Hopkinson","p:kelley-clubs":"School clubs and teams at Kelley","p:gideon-clubs":"School clubs and teams at Gideon","p:blaine-clubs":"School clubs and teams at Blaine","p:hopkinson-clubs":"School clubs and teams at Hopkinson","p:penn-alexander-clubs":"School clubs and teams at Penn Alexander","p:gpca-steel":"GPCA After School at Steel","p:steel-clubs":"School clubs and teams at Steel","p:ad-prima-clubs":"School clubs and teams at Ad Prima","p:pyn-conwell":"PYN AIM Afterschool at Conwell","p:lets-dance-conwell":"Philadelphia Ballet: Let’s Dance at Conwell","p:conwell-clubs":"School clubs and teams at Conwell","p:ecs-mya":"Episcopal Community Services: After School at MYA","p:mya-clubs":"School clubs and teams at MYA","p:ace-martha-washington":"Community Council ACE Program at Martha Washington","p:martha-washington-clubs":"School clubs and teams at Martha Washington","p:playarts-afterschool":"PlayArts AfterSchool","p:fishtown-rec":"Fishtown Recreation Center","p:shissler-rec":"Shissler Recreation Center","p:stem-prep":"STEM Prep: After-School STEM","p:adaire-clubs":"School clubs and teams at Adaire","p:community-academy-clubs":"School clubs and teams at Community Academy","p:change-4-a-dollar-mastery-prep":"Change 4 A Dollar at Mastery Prep","p:mastery-prep-clubs":"School clubs and teams at Mastery Prep","p:gamp-clubs":"School clubs and teams at GAMP","p:aspira-acap-esperanza":"ASPIRA Children’s Achievement Program at Esperanza at Esperanza Elementary","p:esperanza-elementary-clubs":"School clubs and teams at Esperanza Elementary","p:baywaycares-mastery-cleveland":"Baywaycares at Mastery Cleveland","p:mastery-cleveland-clubs":"School clubs and teams at Mastery Cleveland","p:asas-mcdaniel":"After-School All-Stars at McDaniel","p:brooklyn-robot-foundry-mcdaniel":"Brooklyn Robot Foundry at McDaniel","p:sunrise-blankenburg":"Sunrise of Philadelphia at Blankenburg","p:blankenburg-clubs":"School clubs and programs at Blankenburg","p:gla-southwest-clubs":"School sports at GLA Southwest","p:hackett-clubs":"School clubs and activities at Hackett","p:uacs-hamilton":"UACS After-School Program at Hamilton","p:hamilton-clubs":"School sports and teams at Hamilton","p:christy-rec":"Christy Recreation Center","p:baywaycares-mastery-harrity":"Baywaycares at Mastery Harrity","p:mastery-harrity-clubs":"School clubs and teams at Mastery Harrity","p:right-at-school-ethel-allen":"Right At School at Dr. Ethel Allen","p:ethel-allen-clubs":"School clubs and teams at Ethel Allen","p:joshuas-academy-mastery-wister":"Joshua’s Academy at Mastery Wister","p:mastery-wister-clubs":"School clubs and teams at Mastery Wister","p:girls-inc-heston":"Girls Inc. H.Y.P.E. at Heston","p:heston-clubs":"School clubs and teams at Heston","p:sunrise-mcmichael":"Sunrise of Philadelphia at McMichael","p:mcmichael-clubs":"School clubs and programs at McMichael","p:squashsmarts":"SquashSmarts","p:miles-mack-playground":"Miles Mack Playground","p:cora-northwood":"YouthCOR at Northwood","p:northwood-clubs":"School clubs and sports at Northwood","p:uacs-comegys":"UACS After-School Program at Comegys","p:comegys-clubs":"School sports at Comegys","p:baywaycares-mastery-clymer":"Baywaycares at Mastery Clymer","p:mastery-clymer-clubs":"School clubs and teams at Mastery Clymer","p:harlem-lacrosse-olney":"Harlem Lacrosse at Olney Elementary","p:cora-olney":"CORA Services before and after care at Olney at Olney Elementary","p:ziehler-playground":"Ziehler Playground","c:philly-art-center":"Philly Art Center (summer camp)","c:fleisher-art-memorial-camp":"Fleisher Art Memorial (summer camp)","c:mister-johns-music-camp":"Mister John’s Music (summer camp)","c:music-theatre-philly-camp":"Music Theatre Philly (summer camp)","c:movemakers-camp":"MoveMakers Philly (summer camp)","c:queen-and-rook-camp":"Queen & Rook Game Cafe (summer camp)","c:parks-and-rec-camps":"Philadelphia Parks & Recreation day camps (summer camp)","c:theatre-horizon-woodmere":"Theatre Horizon drama camp at Woodmere (summer camp)","c:butchers-sew-shop-camp":"Butcher’s Sew Shop Junior (summer camp)","c:clay-studio-camp":"The Clay Studio (summer camp)","c:pafa-camp":"PAFA summer art camp (summer camp)","c:moore-young-artists":"Moore College of Art & Design youth courses (summer camp)","c:school-of-rock-philadelphia":"School of Rock Philadelphia (summer camp)","c:arden-summer-camp":"Arden Drama School (summer camp)","c:camp-walnut":"Camp Walnut at Walnut Street Theatre (summer camp)","c:macguffin-camps":"MacGuffin Theatre & Film Company (summer camp)","c:flipout-camp":"FlipOut Productions (summer camp)","c:philadelphia-ballet-camps":"School of Philadelphia Ballet dance camps (summer camp)","c:wissahickon-figure-skating":"Wissahickon Skating Club figure skating camp (summer camp)","c:philadelphia-dance-academy":"The Philadelphia Dance Academy (summer camp)","c:legacy-tennis-camp":"Legacy Youth Tennis community camp (summer camp)","c:ceo-camp-phield-house":"C.E.O. Camp at Phield House (summer camp)","c:awbury-adventures":"Awbury Adventures at Awbury Arboretum (summer camp)","c:camp-schuylkill":"Camp Schuylkill at the Schuylkill Center (summer camp)","c:morris-arboretum-camp":"Nature Explorers at Morris Arboretum & Gardens (summer camp)","c:circus-arts-camp":"Philadelphia School of Circus Arts (summer camp)","c:work-to-ride-camp":"Work to Ride at Chamounix Equestrian Center (summer camp)","c:seaport-summer-camp":"Seaport Summer Camp at Independence Seaport Museum (summer camp)","c:taller-puertorriqueno-camp":"Taller Puertorriqueño (summer camp)","c:camp-tps":"Camp TPS at The Philadelphia School (summer camp)","c:ymca-day-camps":"Greater Philadelphia YMCA day camps (summer camp)","c:summer-achievers-edey":"Summer Achievers at Extended Day, Extended Year schools (summer camp)","c:allens-lane-art-camp":"Allens Lane Art Center summer art camp (summer camp)","c:nlarts-summer-camp":"NLArts summer art camp (summer camp)","c:yes-and-camp":"Yes! And… Collaborative Arts camps (summer camp)","c:zazz-summer-camp":"ZAZZ Dance & Drama (summer camp)","c:sawubona-summer-camp":"Sawubona Creativity Project (summer camp)","c:zoomdance-camp":"ZoomDance camp (summer camp)","c:dandelion-summer-camp":"The Dandelion Project summer camp (summer camp)","c:rutabaga-naturearts":"Rutabaga NatureArts summer camp (summer camp)","c:skate-the-foundry-camp":"Skate The Foundry skateboard camp (summer camp)","c:lavner-tech-camp-upenn":"Camp Tech Revolution at UPenn (Lavner) (summer camp)","c:philly-rock-gym-camps":"Philadelphia Rock Gym summer camps (summer camp)","c:coco-academy-summer-camp":"CoCo Academy (summer camp)","c:philly-pack-summer-camp":"Philly PACK (summer camp)","c:esf-camps":"ESF Camps (summer camp)","c:skateboard-academy-rizzo-rink":"The Skateboard Academy summer camp at Rizzo Rink (summer camp)","c:hawk-hill-day-camp":"Hawk Hill Day Camp at Saint Joseph’s University (Future Stars) (summer camp)","c:kids-on-12th-summer-camp":"Kids on 12th summer camp (summer camp)","c:stem-prep-summer-camp":"STEM Prep summer camp (summer camp)","c:camp-nerd-street":"Camp Nerd Street video game and esports camp (summer camp)","c:makom-community-camp":"Makom Community (summer camp)","s:nebinger":"Nebinger","d:nebinger":"Nebinger dates","s:meredith":"Meredith","d:meredith":"Meredith dates","s:coppin":"Coppin","d:coppin":"Coppin dates","s:vare-washington":"Vare-Washington","d:vare-washington":"Vare-Washington dates","s:stanton":"Stanton","d:stanton":"Stanton dates","s:mccall":"McCall","d:mccall":"McCall dates","s:kirkbride":"Kirkbride","d:kirkbride":"Kirkbride dates","s:southwark":"Southwark","d:southwark":"Southwark dates","s:columbus-charter":"Columbus Charter","d:columbus-charter":"Columbus Charter dates","s:marian-anderson":"Marian Anderson","d:marian-anderson":"Marian Anderson dates","s:lingelbach":"Lingelbach","d:lingelbach":"Lingelbach dates","s:houston":"Houston","d:houston":"Houston dates","s:childs":"Childs","d:childs":"Childs dates","s:bache-martin":"Bache-Martin","d:bache-martin":"Bache-Martin dates","s:independence-charter":"Independence Charter","d:independence-charter":"Independence Charter dates","s:greenfield":"Greenfield","d:greenfield":"Greenfield dates","s:jenks":"J.S. Jenks","d:jenks":"J.S. Jenks dates","s:byers":"Russell Byers","d:byers":"Russell Byers dates","s:cook-wissahickon":"Cook-Wissahickon","d:cook-wissahickon":"Cook-Wissahickon dates","s:morris":"Robert Morris","d:morris":"Robert Morris dates","s:henry":"C.W. Henry","d:henry":"C.W. Henry dates","s:mastery-thomas":"Mastery Thomas","d:mastery-thomas":"Mastery Thomas dates","s:emlen":"Emlen","d:emlen":"Emlen dates","s:wright":"Wright","d:wright":"Wright dates","s:jb-kelly":"J.B. Kelly","d:jb-kelly":"J.B. Kelly dates","s:edmonds":"Edmonds","d:edmonds":"Edmonds dates","s:willard":"Willard","d:willard":"Willard dates","s:lea":"Lea","d:lea":"Lea dates","s:rhoads":"Rhoads","d:rhoads":"Rhoads dates","s:juniata-park":"Juniata Park","d:juniata-park":"Juniata Park dates","s:greenberg":"Greenberg","d:greenberg":"Greenberg dates","s:fell":"Fell","d:fell":"Fell dates","s:locke":"Locke","d:locke":"Locke dates","s:richmond":"Richmond","d:richmond":"Richmond dates","s:stephen-girard":"Stephen Girard","d:stephen-girard":"Stephen Girard dates","s:mifflin":"Mifflin","d:mifflin":"Mifflin dates","s:dunbar":"Dunbar","d:dunbar":"Dunbar dates","s:cayuga":"Cayuga","d:cayuga":"Cayuga dates","s:bayard-taylor":"Bayard Taylor","d:bayard-taylor":"Bayard Taylor dates","s:moffet":"Moffet","d:moffet":"Moffet dates","s:anne-frank":"Anne Frank","d:anne-frank":"Anne Frank dates","s:kelley":"Kelley","d:kelley":"Kelley dates","s:penn-alexander":"Penn Alexander","d:penn-alexander":"Penn Alexander dates","s:gideon":"Gideon","d:gideon":"Gideon dates","s:blaine":"Blaine","d:blaine":"Blaine dates","s:hopkinson":"Hopkinson","d:hopkinson":"Hopkinson dates","s:steel":"Steel","d:steel":"Steel dates","s:ad-prima":"Ad Prima","d:ad-prima":"Ad Prima dates","s:conwell":"Conwell","d:conwell":"Conwell dates","s:mya":"MYA","d:mya":"MYA dates","s:martha-washington":"Martha Washington","d:martha-washington":"Martha Washington dates","s:adaire":"Adaire","d:adaire":"Adaire dates","s:community-academy":"Community Academy","d:community-academy":"Community Academy dates","s:mastery-prep":"Mastery Prep","d:mastery-prep":"Mastery Prep dates","s:gamp":"GAMP","d:gamp":"GAMP dates","s:esperanza-elementary":"Esperanza Elementary","d:esperanza-elementary":"Esperanza Elementary dates","s:hackett":"Hackett","d:hackett":"Hackett dates","s:mastery-cleveland":"Mastery Cleveland","d:mastery-cleveland":"Mastery Cleveland dates","s:mcdaniel":"McDaniel","d:mcdaniel":"McDaniel dates","s:blankenburg":"Blankenburg","d:blankenburg":"Blankenburg dates","s:gla-southwest":"GLA Southwest","d:gla-southwest":"GLA Southwest dates","s:hamilton":"Hamilton","d:hamilton":"Hamilton dates","s:mastery-harrity":"Mastery Harrity","d:mastery-harrity":"Mastery Harrity dates","s:ethel-allen":"Ethel Allen","d:ethel-allen":"Ethel Allen dates","s:mastery-wister":"Mastery Wister","d:mastery-wister":"Mastery Wister dates","s:heston":"Heston","d:heston":"Heston dates","s:mcmichael":"McMichael","d:mcmichael":"McMichael dates","s:northwood":"Northwood","d:northwood":"Northwood dates","s:comegys":"Comegys","d:comegys":"Comegys dates","s:mastery-clymer":"Mastery Clymer","d:mastery-clymer":"Mastery Clymer dates","s:olney":"Olney Elementary","d:olney":"Olney Elementary dates"}', true);
$EDIT_ADMINS = json_decode('["contact@phillyafterschool.org","contact@schoolsoutwhatnow.com"]', true);
header('Cache-Control: no-store, private');
header('X-Robots-Tag: noindex');
function edit_key() {
  static $k = null;
  if ($k !== null) return $k;
  $file = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-edit.key';
  $raw = @file_get_contents($file);
  if ($raw === false || strlen(trim($raw)) !== 64) {
    $raw = bin2hex(random_bytes(32));
    if (@file_put_contents($file, $raw, LOCK_EX) === false) { http_response_code(503); exit('Signing in is not available right now.'); }
    @chmod($file, 0600);
    $raw = (string) @file_get_contents($file);   // if two requests raced, both read back the same key
  }
  $k = hash_hmac('sha256', 'edit-pages', trim($raw));
  return $k;
}
// The accounts database (the same file the groups API keeps), or null when there isn't one yet. With $create, the
// two tables these pages add are made: the editors an admin lets in by their account, and the notes left on sentences.
function edit_db($create = false) {
  static $db = null, $made = false;
  if ($db === null) {
    $file = dirname($_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-data/groups.sqlite';
    if (!is_file($file)) return null;
    try {
      $db = new PDO('sqlite:' . $file);
      $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
      $db->exec('PRAGMA busy_timeout=3000');
    } catch (Exception $e) { $db = null; return null; }
  }
  if ($create && !$made) {
    $made = true;
    try {
      $db->exec("CREATE TABLE IF NOT EXISTS editors (email TEXT PRIMARY KEY, name TEXT NOT NULL, added INTEGER NOT NULL, added_by TEXT NOT NULL DEFAULT '')");
      $db->exec("CREATE TABLE IF NOT EXISTS copy_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, copy_id TEXT NOT NULL, page TEXT NOT NULL DEFAULT '', sentence TEXT NOT NULL DEFAULT '', note TEXT NOT NULL, by_name TEXT NOT NULL DEFAULT '', by_email TEXT NOT NULL DEFAULT '', for_email TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, sent INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0, done_by TEXT NOT NULL DEFAULT '', done_how TEXT NOT NULL DEFAULT '')");
    } catch (Exception $e) { /* read-only database: notes stay off */ }
  }
  return $db;
}
// The account the visitor is signed in to on the site (a code by email, or Google), as the accounts database has it:
// its address and first name, or null.
function edit_account() {
  static $acct = false;
  if ($acct !== false) return $acct;
  $acct = null;
  $sid = (isset($_COOKIE['pas_s']) && is_string($_COOKIE['pas_s'])) ? $_COOKIE['pas_s'] : '';
  if (!preg_match('/^[A-Za-z0-9_-]{40,50}$/', $sid)) return $acct;
  $db = edit_db();
  if ($db === null) return $acct;
  try {
    $st = $db->prepare('SELECT u.email, u.first, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.sid_hash = ? AND s.expires > ?');
    $st->execute(array(hash('sha256', $sid), time()));
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) return $acct;
    $email = strtolower(trim((string) $row['email']));
    if ($email === '') return $acct;
    $first = trim((string) $row['first']);
    if ($first === '') $first = trim(strtok((string) $row['name'], ' '));
    $acct = array('email' => $email, 'name' => $first);
  } catch (Exception $e) { $acct = null; }
  return $acct;
}
// An account on the site whose address is on the admins list (site.config.json) opens these pages too. It gives the
// address, or '' when the visitor isn't signed in to such an account.
function edit_admin() {
  global $EDIT_ADMINS;
  if (!is_array($EDIT_ADMINS) || !$EDIT_ADMINS) return '';
  $a = edit_account();
  return $a !== null && in_array($a['email'], $EDIT_ADMINS, true) ? $a['email'] : '';
}
// An account an admin has let in as an editor (the editors table, kept from the edit page): its name and address,
// or null. Editors open the same pages admins do; only an admin can change who edits.
function edit_editor() {
  static $who = false;
  if ($who !== false) return $who;
  $who = null;
  $a = edit_account();
  if ($a === null) return $who;
  $db = edit_db();
  if ($db === null) return $who;
  try {
    $st = $db->prepare('SELECT name, email FROM editors WHERE email = ?');
    $st->execute(array($a['email']));
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if ($row) $who = array('name' => (string) $row['name'], 'email' => (string) $row['email']);
  } catch (Exception $e) { $who = null; }   // no editors table yet
  return $who;
}
// Signed in to the site as an admin or an editor. Nothing else opens these pages.
function edit_signed_in() {
  return edit_admin() !== '' || edit_editor() !== null;
}

// ----- GitHub, through the key file next to the public folder -----
// Shared by edit/send.php (publishing copy) and edit/queue/ (sending work to the weekly run). build.mjs pastes this in
// at each file's /*GH*/ marker; $REPO ("owner/name") comes from the config pasted in before it.
function gh_token() {
  static $t = null;
  if ($t !== null) return $t;
  $raw = @file_get_contents(dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-github.key');
  $raw = is_string($raw) ? trim($raw) : '';
  $t = preg_match('/^(github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,})$/', $raw) ? $raw : '';
  return $t;
}
function gh_base() {
  if (PHP_SAPI === 'cli-server' && getenv('PAS_TEST_GITHUB')) return rtrim((string) getenv('PAS_TEST_GITHUB'), '/');   // the local test server only
  return 'https://api.github.com';
}
function gh_ready() { global $REPO; return $REPO !== '' && gh_token() !== '' && function_exists('curl_init'); }
// One call to the API. Gives array(status code, decoded answer or null).
function gh($method, $path, $body = null) {
  $ch = curl_init(gh_base() . $path);
  $headers = array('Accept: application/vnd.github+json', 'Authorization: Bearer ' . gh_token(), 'X-GitHub-Api-Version: 2022-11-28', 'User-Agent: phillyafterschool-edit');
  $opts = array(CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_TIMEOUT => 20);
  if ($body !== null) { $headers[] = 'Content-Type: application/json'; $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
  $opts[CURLOPT_HTTPHEADER] = $headers;
  curl_setopt_array($ch, $opts);
  $raw = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return array($code, is_string($raw) ? json_decode($raw, true) : null);
}
// A file as the repository holds it on a branch: array(text, sha); array('', '') when it isn't there; null on an error.
function gh_file($path, $ref) {
  global $REPO;
  list($code, $r) = gh('GET', '/repos/' . $REPO . '/contents/' . $path . '?ref=' . rawurlencode($ref));
  if ($code === 404) return array('', '');
  if ($code !== 200 || !is_array($r) || !isset($r['content'])) return null;
  return array((string) base64_decode(str_replace("\n", '', (string) $r['content'])), isset($r['sha']) ? (string) $r['sha'] : '');
}
// Writes a file on a branch as one commit. Gives array(true, short sha, commit url) or array(false, what went wrong, '').
function gh_put($path, $text, $sha, $message, $branch) {
  global $REPO;
  $body = array('message' => $message, 'content' => base64_encode($text), 'branch' => $branch);
  if ($sha !== '') $body['sha'] = $sha;
  list($code, $r) = gh('PUT', '/repos/' . $REPO . '/contents/' . $path, $body);
  if (($code === 200 || $code === 201) && is_array($r) && isset($r['commit']['sha'])) return array(true, substr((string) $r['commit']['sha'], 0, 7), isset($r['commit']['html_url']) ? (string) $r['commit']['html_url'] : '');
  if ($code === 409) return array(false, 'Someone else wrote to the repository at the same moment. Try once more.', '');
  if ($code === 401 || $code === 403) return array(false, 'The publishing key was refused by GitHub. Check the key file on the server.', '');
  return array(false, 'GitHub did not take the change (HTTP ' . $code . ').', '');
}
// Makes sure a branch exists, starting it from another when it doesn't. Gives '' when it is there, or what went wrong.
function gh_branch($branch, $from) {
  global $REPO;
  list($code, $r) = gh('GET', '/repos/' . $REPO . '/git/ref/heads/' . rawurlencode($branch));
  if ($code === 200) return '';
  if ($code !== 404) return 'GitHub could not be read (HTTP ' . $code . ').';
  list($code, $r) = gh('GET', '/repos/' . $REPO . '/git/ref/heads/' . rawurlencode($from));
  if ($code !== 200 || !is_array($r) || !isset($r['object']['sha'])) return 'The ' . $from . ' branch could not be read (HTTP ' . $code . ').';
  list($code, $r) = gh('POST', '/repos/' . $REPO . '/git/refs', array('ref' => 'refs/heads/' . $branch, 'sha' => (string) $r['object']['sha']));
  if ($code === 201 || $code === 422) return '';   // 422: made by someone else a moment ago
  if ($code === 401 || $code === 403) return 'The publishing key was refused by GitHub. Check the key file on the server.';
  return 'GitHub would not start the ' . $branch . ' branch (HTTP ' . $code . ').';
}
// A simple per-hour cap on writes from a page, so a loop in a browser can't fill the repository's history.
function gh_allowed($what, $max) {
  $file = dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/phillyafterschool-' . $what . '.json';
  $d = json_decode((string) @file_get_contents($file), true);
  $hour = gmdate('Y-m-d-H');
  if (!is_array($d) || !isset($d['hour']) || $d['hour'] !== $hour) $d = array('hour' => $hour, 'n' => 0);
  if ($d['n'] >= $max) return false;
  $d['n']++;
  @file_put_contents($file, json_encode($d), LOCK_EX);
  return true;
}

// ----- the autopilot, as the owner sees it (scaling plan, Phase 3) -----
// Shared by groups/api.php (the morning summary, in push_run) and the owner's pages edit/needs/ (the Needs-you page)
// and edit/autopilot/ (every merge, with Undo). build.mjs pastes this file in at each one's /*AUTOPILOT*/ marker;
// edit it here. Nothing here sends an email.
//
// What it knows about the research runs comes from GitHub, through the key file /edit/ publishes with: their pull
// requests (a branch starting with one of $ctx['branches'], from this repository, by one of $ctx['authors']), the
// gate's comment on each (scripts/gate.mjs leaves <!-- pas-gate {...} --> in it with its verdict; only a comment by
// the workflow's own account counts, since anyone can comment on a public repository), the evidence file each merged
// one brought (evidence/<branch>.json at its merge), and the switch, data/autopilot.json on main. A copy is kept in
// the accounts database (ap_prs, ap_changes), refreshed at most every few minutes, so the pages open fast and the
// summary can count. Approve, Decline, Undo and the switch write to GitHub with the same key.
//
// $ctx, given by the caller: db (the accounts database), gh (a function(method, path, body) that calls GitHub's API
// with the key file and gives array(status, decoded answer)), repo ("owner/name" of the public repository), branches,
// authors, allow and evidenceDir (from scripts/gate.config.json), site (the site's address).
const AP_MODES = array('off', 'shadow', 'on');
const AP_SWITCH = 'data/autopilot.json';
const AP_BOT = 'github-actions[bot]';   // who GitHub credits a merge or a comment by a workflow's own token to: the gate
const AP_SYNC_EVERY = 300;              // seconds between looks at GitHub, unless asked for now
const AP_LOOK = 60;                     // pull requests read per look, most recently changed first
const AP_DETAILS_A_SYNC = 12;           // pull requests whose comments, merger or evidence are fetched per look; the rest next time

function ap_meta(PDO $db, string $k): string {
  try { $st = $db->prepare('SELECT v FROM meta WHERE k = ?'); $st->execute(array($k)); $v = $st->fetchColumn(); return $v === false ? '' : (string) $v; } catch (Exception $e) { return ''; }
}
function ap_meta_set(PDO $db, string $k, string $v): void {
  try { $db->prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute(array($k, $v)); } catch (Exception $e) { /* a read-only database: nothing remembered */ }
}
// ap_prs: one row per run pull request. state: open, merged or closed. held: it carries the needs-josh label. gate,
// gate_head, gate_mode, gate_body, gate_at, changes, listings, publish, held_n: from the gate's comment. seen: the
// updated_at GitHub gave when the comment was last read. merged_by: the GitHub login that merged it (AP_BOT is the
// autopilot). evidence: 0 not read yet, 1 read into ap_changes, -1 none. undo_pr: the pull request that takes it back;
// undone: when that was merged. ap_changes: each changed value a merged run brought, from its evidence file (provider
// quotes only), and when the owner said it looked right.
function ap_schema(PDO $db): void {
  $db->exec("CREATE TABLE IF NOT EXISTS ap_prs (pr INTEGER PRIMARY KEY, branch TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'open', head TEXT NOT NULL DEFAULT '', node TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL DEFAULT '', closed INTEGER NOT NULL DEFAULT 0, merged INTEGER NOT NULL DEFAULT 0, merged_by TEXT NOT NULL DEFAULT '', merge_sha TEXT NOT NULL DEFAULT '', held INTEGER NOT NULL DEFAULT 0, seen TEXT NOT NULL DEFAULT '', gate TEXT NOT NULL DEFAULT '', gate_head TEXT NOT NULL DEFAULT '', gate_mode TEXT NOT NULL DEFAULT '', gate_body TEXT NOT NULL DEFAULT '', gate_at TEXT NOT NULL DEFAULT '', changes INTEGER NOT NULL DEFAULT 0, listings INTEGER NOT NULL DEFAULT 0, publish INTEGER NOT NULL DEFAULT 0, held_n INTEGER NOT NULL DEFAULT 0, evidence INTEGER NOT NULL DEFAULT 0, undo_pr INTEGER NOT NULL DEFAULT 0, undone INTEGER NOT NULL DEFAULT 0)");
  $db->exec("CREATE TABLE IF NOT EXISTS ap_changes (pr INTEGER NOT NULL, n INTEGER NOT NULL, item TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT '', listing TEXT NOT NULL DEFAULT '', path TEXT NOT NULL DEFAULT '', old TEXT NOT NULL DEFAULT '', new TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', quote TEXT NOT NULL DEFAULT '', looked INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (pr, n))");
  $db->exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
}
function ap_time($iso): int { $t = is_string($iso) && $iso !== '' ? strtotime($iso) : false; return $t === false ? 0 : (int) $t; }
function ap_cut($s, int $max): string { $s = trim((string) preg_replace('/\s+/u', ' ', (string) $s)); return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max); }
function ap_run_branch(array $ctx, string $ref): bool { foreach ($ctx['branches'] as $b) if ($b !== '' && strpos($ref, (string) $b) === 0) return true; return false; }
// Whether a pull request, as GitHub's API gives it, is one of the runs': the same test the gate applies (eligible()).
function ap_is_run(array $ctx, $p): bool {
  if (!is_array($p) || !isset($p['number'], $p['head']['ref'], $p['base']['ref'])) return false;
  if ((string) $p['base']['ref'] !== 'main' || !ap_run_branch($ctx, (string) $p['head']['ref'])) return false;
  if ((isset($p['head']['repo']['full_name']) ? (string) $p['head']['repo']['full_name'] : '') !== $ctx['repo']) return false;   // a fork is never a run
  $who = isset($p['user']['login']) ? (string) $p['user']['login'] : '';
  return !$ctx['authors'] || in_array($who, $ctx['authors'], true);
}
// The gate's own comment among a pull request's comments: the last one by the workflow's account with the gate's mark.
function ap_gate_comment($comments): ?array {
  $mine = null;
  foreach (is_array($comments) ? $comments : array() as $c) {
    if (!is_array($c) || !isset($c['body']) || (isset($c['user']['login']) ? (string) $c['user']['login'] : '') !== AP_BOT) continue;
    if (!preg_match('/<!-- pas-gate (\{.*?\}) -->/s', (string) $c['body'], $m)) continue;
    $meta = json_decode($m[1], true);
    if (!is_array($meta)) continue;
    $mine = array('meta' => $meta, 'body' => (string) $c['body'], 'at' => isset($c['updated_at']) ? (string) $c['updated_at'] : (isset($c['created_at']) ? (string) $c['created_at'] : ''));
  }
  return $mine;
}

// One look at GitHub: the runs' pull requests changed since the last look, the gate's comment on each, who merged the
// merged ones, and their evidence. At most every AP_SYNC_EVERY seconds unless $force. Gives a short state.
function ap_sync(array $ctx, bool $force = false): array {
  $db = $ctx['db'];
  if ($db === null || $ctx['repo'] === '') return array('state' => 'off');
  try { ap_schema($db); } catch (Exception $e) { return array('state' => 'failed', 'why' => 'database'); }
  if (!$force && (int) ap_meta($db, 'ap_synced') > time() - AP_SYNC_EVERY) return array('state' => 'fresh');
  ap_meta_set($db, 'ap_synced', (string) time());
  $gh = $ctx['gh'];
  list($code, $list) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls?state=all&sort=updated&direction=desc&per_page=' . AP_LOOK, null);
  if ($code !== 200 || !is_array($list)) {
    $why = $code === 401 ? 'refused' : ($code === 0 ? 'no answer' : 'github ' . $code);
    ap_meta_set($db, 'ap_why', $why);
    return array('state' => 'failed', 'why' => $why);
  }
  ap_meta_set($db, 'ap_why', '');
  $known = array();
  foreach ($db->query('SELECT pr, seen, merged_by, evidence, state FROM ap_prs')->fetchAll(PDO::FETCH_ASSOC) as $r) $known[(int) $r['pr']] = $r;
  $up = $db->prepare("INSERT INTO ap_prs (pr, branch, title, author, state, head, node, created, updated, closed, merged, merge_sha, held) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pr) DO UPDATE SET branch = excluded.branch, title = excluded.title, author = excluded.author, state = excluded.state, head = excluded.head, node = excluded.node, updated = excluded.updated, closed = excluded.closed, merged = excluded.merged, merge_sha = excluded.merge_sha, held = excluded.held");
  $res = array('state' => 'synced', 'prs' => 0, 'comments' => 0, 'mergers' => 0, 'evidence' => 0);
  $budget = AP_DETAILS_A_SYNC;
  foreach ($list as $p) {
    if (!ap_is_run($ctx, $p)) continue;
    $n = (int) $p['number'];
    $state = !empty($p['merged_at']) ? 'merged' : ((string) $p['state'] === 'closed' ? 'closed' : 'open');
    $held = 0;
    foreach (isset($p['labels']) && is_array($p['labels']) ? $p['labels'] : array() as $l) if (is_array($l) && isset($l['name']) && $l['name'] === 'needs-josh') $held = 1;
    $updated = isset($p['updated_at']) ? (string) $p['updated_at'] : '';
    $up->execute(array($n, (string) $p['head']['ref'], ap_cut(isset($p['title']) ? $p['title'] : '', 200), isset($p['user']['login']) ? (string) $p['user']['login'] : '', $state,
      isset($p['head']['sha']) ? (string) $p['head']['sha'] : '', isset($p['node_id']) ? (string) $p['node_id'] : '', ap_time(isset($p['created_at']) ? $p['created_at'] : ''), $updated,
      ap_time(isset($p['closed_at']) ? $p['closed_at'] : ''), ap_time(isset($p['merged_at']) ? $p['merged_at'] : ''), isset($p['merge_commit_sha']) ? (string) $p['merge_commit_sha'] : '', $held));
    $res['prs']++;
    $was = isset($known[$n]) ? $known[$n] : null;
    // The gate's comment, when the pull request has changed since it was last read.
    if ($budget > 0 && (!$was || (string) $was['seen'] !== $updated)) {
      $budget--;
      list($c, $comments) = $gh('GET', '/repos/' . $ctx['repo'] . '/issues/' . $n . '/comments?per_page=100', null);
      if ($c === 200) {
        $g = ap_gate_comment($comments);
        if ($g !== null) {
          $m = $g['meta'];
          $num = function ($k) use ($m) { return isset($m[$k]) && is_int($m[$k]) ? max(0, $m[$k]) : 0; };
          $db->prepare('UPDATE ap_prs SET gate = ?, gate_head = ?, gate_mode = ?, gate_body = ?, gate_at = ?, changes = ?, listings = ?, publish = ?, held_n = ? WHERE pr = ?')
            ->execute(array(isset($m['verdict']) && in_array($m['verdict'], array('publish', 'held', 'nothing'), true) ? $m['verdict'] : '', isset($m['head']) && is_string($m['head']) ? substr($m['head'], 0, 40) : '',
              isset($m['mode']) && in_array($m['mode'], AP_MODES, true) ? $m['mode'] : '', substr($g['body'], 0, 20000), $g['at'], $num('changes'), $num('listings'), $num('publish'), $num('held'), $n));
        }
        $db->prepare('UPDATE ap_prs SET seen = ? WHERE pr = ?')->execute(array($updated, $n));
        $res['comments']++;
      }
    }
    // Who merged it: the list doesn't say, the pull request itself does. Asked once.
    if ($state === 'merged' && $budget > 0 && (!$was || (string) $was['merged_by'] === '')) {
      $budget--;
      list($c, $full) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $n, null);
      if ($c === 200 && is_array($full)) {
        $by = isset($full['merged_by']['login']) ? (string) $full['merged_by']['login'] : '?';
        $db->prepare('UPDATE ap_prs SET merged_by = ? WHERE pr = ?')->execute(array($by, $n));
        $res['mergers']++;
      }
    }
    // What it changed, from its evidence file as merged. Read once.
    if ($state === 'merged' && $budget > 0 && (!$was || (int) $was['evidence'] === 0)) {
      $budget--;
      $res['evidence'] += ap_evidence($ctx, $n);
    }
  }
  return $res;
}
// A merged run's evidence file, read into ap_changes: for each changed value, where it sits, before and after, the page
// and the quote. Gives 1 when it was read (or found missing), 0 when GitHub didn't answer (tried again next look).
function ap_evidence(array $ctx, int $n): int {
  $db = $ctx['db'];
  $st = $db->prepare('SELECT branch, merge_sha FROM ap_prs WHERE pr = ?'); $st->execute(array($n)); $r = $st->fetch(PDO::FETCH_ASSOC);
  if (!$r || $r['merge_sha'] === '' || !preg_match('/^[A-Za-z0-9._-]{1,120}$/', (string) $r['branch'])) { $db->prepare('UPDATE ap_prs SET evidence = -1 WHERE pr = ?')->execute(array($n)); return 1; }
  $gh = $ctx['gh'];
  list($c, $f) = $gh('GET', '/repos/' . $ctx['repo'] . '/contents/' . $ctx['evidenceDir'] . rawurlencode((string) $r['branch']) . '.json?ref=' . rawurlencode((string) $r['merge_sha']), null);
  if ($c === 404) { $db->prepare('UPDATE ap_prs SET evidence = -1 WHERE pr = ?')->execute(array($n)); return 1; }
  if ($c !== 200 || !is_array($f) || !isset($f['content'])) return 0;
  $doc = json_decode((string) base64_decode(str_replace("\n", '', (string) $f['content'])), true);
  $db->prepare('DELETE FROM ap_changes WHERE pr = ?')->execute(array($n));
  $add = $db->prepare('INSERT INTO ap_changes (pr, n, item, kind, listing, path, old, new, source, quote) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $i = 0;
  $show = function ($v) { if ($v === null) return ''; return is_string($v) ? $v : (string) json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); };
  foreach (is_array($doc) && isset($doc['items']) && is_array($doc['items']) ? $doc['items'] : array() as $it) {
    if (!is_array($it) || !isset($it['fields']) || !is_array($it['fields'])) continue;
    foreach ($it['fields'] as $fl) {
      if (!is_array($fl) || $i >= 300) continue;
      $src = isset($fl['source']) && is_string($fl['source']) && preg_match('~^https?://~i', $fl['source']) ? ap_cut($fl['source'], 400) : '';
      $add->execute(array($n, ++$i, ap_cut(isset($it['item']) ? $it['item'] : '', 60), ap_cut(isset($it['kind']) ? $it['kind'] : '', 20), ap_cut(isset($it['listing']) ? $it['listing'] : '', 90),
        ap_cut(isset($fl['path']) ? $fl['path'] : '', 200), ap_cut($show(isset($fl['old']) ? $fl['old'] : null), 300), ap_cut($show(isset($fl['new']) ? $fl['new'] : null), 300), $src, ap_cut(isset($fl['quote']) ? $fl['quote'] : '', 300)));
    }
  }
  $db->prepare('UPDATE ap_prs SET evidence = 1 WHERE pr = ?')->execute(array($n));
  return 1;
}

// ----- the switch -----
// data/autopilot.json on main, as GitHub has it: array(mode, sha, about), mode '' when it can't be read. Remembered for
// a minute, unless $fresh.
function ap_mode(array $ctx, bool $fresh = false): array {
  $db = $ctx['db'];
  if (!$fresh && $db !== null && (int) ap_meta($db, 'ap_mode_at') > time() - 60) {
    $m = ap_meta($db, 'ap_mode');
    if (in_array($m, AP_MODES, true)) return array('mode' => $m, 'sha' => '', 'about' => '');
  }
  $gh = $ctx['gh'];
  list($c, $f) = $gh('GET', '/repos/' . $ctx['repo'] . '/contents/' . AP_SWITCH . '?ref=main', null);
  if ($c !== 200 || !is_array($f) || !isset($f['content'])) return array('mode' => '', 'sha' => '', 'about' => '', 'why' => $c === 401 ? 'refused' : 'github ' . $c);
  $d = json_decode((string) base64_decode(str_replace("\n", '', (string) $f['content'])), true);
  $m = is_array($d) && isset($d['mode']) && in_array($d['mode'], AP_MODES, true) ? (string) $d['mode'] : 'off';   // the gate reads anything else as off
  if ($db !== null) { ap_meta_set($db, 'ap_mode', $m); ap_meta_set($db, 'ap_mode_at', (string) time()); }
  return array('mode' => $m, 'sha' => isset($f['sha']) ? (string) $f['sha'] : '', 'about' => is_array($d) && isset($d['about']) && is_string($d['about']) ? $d['about'] : '');
}
// Turns the switch: one commit to data/autopilot.json on main, keeping its "about" line and its layout. Marked
// [skip ci]: nothing on the site changes, and the gate reads the file from main the next time it runs.
// Gives array(true, message) or array(false, what went wrong).
function ap_mode_set(array $ctx, string $to): array {
  if (!in_array($to, AP_MODES, true)) return array(false, 'That isn’t one of the three settings.');
  $cur = ap_mode($ctx, true);
  if ($cur['mode'] === '' || $cur['sha'] === '') return array(false, 'The switch couldn’t be read from GitHub. Check the key file on the server, then try again.');
  if ($cur['mode'] === $to) return array(true, 'The autopilot was already ' . $to . '.');
  $about = $cur['about'] !== '' ? $cur['about'] : 'The autopilot switch, read by .github/workflows/autopilot.yml from main: "off", "shadow" or "on". See docs/listings.md, "The autopilot gate".';
  $flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
  $text = "{\n  \"about\": " . json_encode($about, $flags) . ",\n  \"mode\": " . json_encode($to, $flags) . "\n}\n";
  $gh = $ctx['gh'];
  list($c, $r) = $gh('PUT', '/repos/' . $ctx['repo'] . '/contents/' . AP_SWITCH, array('message' => 'Autopilot: ' . $cur['mode'] . ' to ' . $to . ', from the Needs-you page [skip ci]', 'content' => base64_encode($text), 'sha' => $cur['sha'], 'branch' => 'main'));
  if (($c === 200 || $c === 201) && is_array($r) && isset($r['commit']['sha'])) {
    if ($ctx['db'] !== null) { ap_meta_set($ctx['db'], 'ap_mode', $to); ap_meta_set($ctx['db'], 'ap_mode_at', (string) time()); }
    $say = array('off' => 'The autopilot is off: the gate does nothing.', 'shadow' => 'The autopilot is in shadow mode: the gate comments on each run’s pull request and merges nothing.', 'on' => 'The autopilot is on: a run’s pull request with nothing held merges itself, and the site publishes.');
    return array(true, $say[$to] . ' (commit ' . substr((string) $r['commit']['sha'], 0, 7) . ')');
  }
  if ($c === 409) return array(false, 'Someone else changed the switch at the same moment. Look again and try once more.');
  if ($c === 401 || $c === 403) return array(false, 'GitHub refused the key. Check the key file on the server.');
  if ($c === 422) return array(false, 'GitHub refused the commit, most likely the rule on main: the key’s owner must be allowed to bypass it.');
  return array(false, 'GitHub didn’t take the change (HTTP ' . $c . ').');
}

// ----- Approve, Decline, Undo -----
// Approve: merges a run's pull request at the commit the owner was shown, the way the gate would (one squash commit).
// The merge is made with the site's key, not a workflow's token, so GitHub starts the publish by itself. Refused when
// the pull request touches the switch, or anything but data and its evidence: those are merged on GitHub, by hand.
function ap_approve(array $ctx, int $n, string $head): array {
  $gh = $ctx['gh'];
  list($c, $p) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $n, null);
  if ($c !== 200 || !is_array($p)) return array(false, 'GitHub couldn’t be read (HTTP ' . $c . '). Try again in a minute.');
  if (!ap_is_run($ctx, $p)) return array(false, 'Pull request #' . $n . ' isn’t one of the runs’, so it isn’t merged from here.');
  if (!empty($p['merged'])) return array(true, '#' . $n . ' was already merged.');
  if ((string) $p['state'] !== 'open') return array(false, '#' . $n . ' is closed.');
  if (!preg_match('/^[0-9a-f]{40}$/', $head) || (isset($p['head']['sha']) ? (string) $p['head']['sha'] : '') !== $head) return array(false, '#' . $n . ' has changed since this page was opened. Look at it again before approving.');
  list($c, $files) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $n . '/files?per_page=100', null);
  if ($c !== 200 || !is_array($files)) return array(false, 'GitHub couldn’t list what #' . $n . ' changes (HTTP ' . $c . ').');
  $evidence = $ctx['evidenceDir'] . (string) $p['head']['ref'] . '.json';
  foreach ($files as $f) {
    $name = is_array($f) && isset($f['filename']) ? (string) $f['filename'] : '';
    if ($name === AP_SWITCH) return array(false, '#' . $n . ' changes the autopilot switch (data/autopilot.json). A run never may, so it isn’t merged from here.');
    if ($name !== $evidence && !in_array($name, $ctx['allow'], true)) return array(false, '#' . $n . ' changes ' . $name . ', which isn’t a data file. Open it on GitHub to read it and merge it there.');
  }
  if (count($files) >= 100) return array(false, '#' . $n . ' changes too many files to check from here. Open it on GitHub.');
  if (isset($p['mergeable']) && $p['mergeable'] === false) return array(false, '#' . $n . ' conflicts with main. The next run brings it up to date.');
  list($c, $r) = $gh('PUT', '/repos/' . $ctx['repo'] . '/pulls/' . $n . '/merge', array('merge_method' => 'squash', 'sha' => $head, 'commit_title' => ap_cut(isset($p['title']) ? $p['title'] : 'Run', 180) . ' (#' . $n . ')', 'commit_message' => 'Approved from the Needs-you page.'));
  if ($c === 200 && is_array($r) && !empty($r['merged'])) {
    if ($ctx['db'] !== null) $ctx['db']->prepare("UPDATE ap_prs SET state = 'merged', merged = ?, merge_sha = ?, held = 0 WHERE pr = ?")->execute(array(time(), isset($r['sha']) ? (string) $r['sha'] : '', $n));
    return array(true, 'Merged #' . $n . '. The site publishes it in a few minutes.');
  }
  if ($c === 409) return array(false, '#' . $n . ' changed while it was being merged. Look at it again.');
  if ($c === 405) return array(false, 'GitHub won’t merge #' . $n . ' yet (it may still be checking it, or it conflicts with main). Try again in a minute.');
  if ($c === 401 || $c === 403) return array(false, 'GitHub refused the key: it needs Pull requests and Contents, read and write, on this repository.');
  return array(false, 'GitHub didn’t merge #' . $n . ' (HTTP ' . $c . ').');
}
// Decline: closes a run's pull request without merging it. Its queue items, if any, then wait for the owner as held.
function ap_decline(array $ctx, int $n): array {
  $gh = $ctx['gh'];
  list($c, $p) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $n, null);
  if ($c !== 200 || !is_array($p)) return array(false, 'GitHub couldn’t be read (HTTP ' . $c . ').');
  if (!ap_is_run($ctx, $p)) return array(false, 'Pull request #' . $n . ' isn’t one of the runs’.');
  if ((string) $p['state'] !== 'open') return array(true, '#' . $n . ' was already closed.');
  list($c, $r) = $gh('PATCH', '/repos/' . $ctx['repo'] . '/pulls/' . $n, array('state' => 'closed'));
  if ($c === 200) {
    if ($ctx['db'] !== null) $ctx['db']->prepare("UPDATE ap_prs SET state = 'closed', closed = ?, held = 0 WHERE pr = ?")->execute(array(time(), $n));
    return array(true, 'Closed #' . $n . ' without merging it. It can be reopened on GitHub.');
  }
  if ($c === 401 || $c === 403) return array(false, 'GitHub refused the key: it needs Pull requests, read and write, on this repository.');
  return array(false, 'GitHub didn’t close #' . $n . ' (HTTP ' . $c . ').');
}
// Undo: takes back everything a merged run changed. GitHub makes the revert itself (as its Revert button does), as a
// pull request, which is then merged with the site's key, so the site republishes. A revert that clashes with a later
// change is refused by GitHub, and nothing changes. Safe to press again: an undo already made is merged, not made twice.
function ap_undo(array $ctx, int $n): array {
  $db = $ctx['db'];
  if ($db === null) return array(false, 'The accounts database isn’t there.');
  $st = $db->prepare("SELECT * FROM ap_prs WHERE pr = ? AND state = 'merged'"); $st->execute(array($n)); $row = $st->fetch(PDO::FETCH_ASSOC);
  if (!$row) return array(false, 'Pull request #' . $n . ' isn’t a merged run.');
  if ((int) $row['undone'] > 0) return array(true, '#' . $n . ' is already undone.');
  $gh = $ctx['gh'];
  $revert = (int) $row['undo_pr']; $head = '';
  if ($revert > 0) {
    list($c, $p) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $revert, null);
    if ($c === 200 && is_array($p) && !empty($p['merged'])) { $db->prepare('UPDATE ap_prs SET undone = ? WHERE pr = ?')->execute(array(max(1, ap_time(isset($p['merged_at']) ? $p['merged_at'] : '')), $n)); return array(true, '#' . $n . ' is already undone, by #' . $revert . '.'); }
    if ($c === 200 && is_array($p) && (string) $p['state'] === 'open') $head = isset($p['head']['sha']) ? (string) $p['head']['sha'] : '';
    else { $revert = 0; $db->prepare('UPDATE ap_prs SET undo_pr = 0 WHERE pr = ?')->execute(array($n)); }   // closed by hand: make a new one
  }
  if ($revert === 0) {
    $node = (string) $row['node'];
    if ($node === '') { list($c, $p) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . $n, null); $node = $c === 200 && is_array($p) && isset($p['node_id']) ? (string) $p['node_id'] : ''; }
    if ($node === '') return array(false, 'GitHub couldn’t be read. Try again in a minute.');
    $q = 'mutation($id: ID!, $title: String!, $body: String!) { revertPullRequest(input: {pullRequestId: $id, title: $title, body: $body}) { revertPullRequest { number headRefOid url } } }';
    list($c, $r) = $gh('POST', '/graphql', array('query' => $q, 'variables' => array('id' => $node, 'title' => ap_cut('Undo #' . $n . ': ' . $row['title'], 200), 'body' => 'Undone from the autopilot log (/edit/autopilot/): everything #' . $n . ' changed is put back as it was.')));
    $made = $c === 200 && is_array($r) && isset($r['data']['revertPullRequest']['revertPullRequest']['number']) ? $r['data']['revertPullRequest']['revertPullRequest'] : null;
    if ($made === null) {
      $msg = is_array($r) && isset($r['errors'][0]['message']) ? (string) $r['errors'][0]['message'] : '';
      if ($c === 401 || $c === 403) return array(false, 'GitHub refused the key: it needs Pull requests and Contents, read and write, on this repository.');
      if (preg_match('/conflict|could not|couldn.t|can.t be reverted|cannot be reverted|not be reverted|reverted automatically/iu', $msg)) return array(false, 'GitHub couldn’t take #' . $n . ' back by itself: a later change touched the same lines. Open #' . $n . ' on GitHub and use its Revert button, which shows the clash.');
      return array(false, 'GitHub didn’t make the undo' . ($msg !== '' ? ' (' . ap_cut($msg, 140) . ')' : ' (HTTP ' . $c . ')') . '.');
    }
    $revert = (int) $made['number']; $head = isset($made['headRefOid']) ? (string) $made['headRefOid'] : '';
    $db->prepare('UPDATE ap_prs SET undo_pr = ? WHERE pr = ?')->execute(array($revert, $n));
  }
  // GitHub works out whether a new pull request can merge a moment after it opens: a few tries.
  $c = 0;
  for ($try = 0; $try < 4; $try++) {
    $body = array('merge_method' => 'squash', 'commit_title' => ap_cut('Undo #' . $n . ': ' . $row['title'], 180) . ' (#' . $revert . ')', 'commit_message' => 'Undone from the autopilot log.');
    if ($head !== '') $body['sha'] = $head;
    list($c, $r) = $gh('PUT', '/repos/' . $ctx['repo'] . '/pulls/' . $revert . '/merge', $body);
    if ($c === 200) break;
    if ($c !== 405) break;
    usleep(1500000);
  }
  if ($c === 200) {
    $db->prepare('UPDATE ap_prs SET undone = ? WHERE pr = ?')->execute(array(time(), $n));
    return array(true, 'Undone: #' . $revert . ' put back what #' . $n . ' changed. The site republishes in a few minutes.');
  }
  if ($c === 401 || $c === 403) return array(false, 'The undo is ready as #' . $revert . ', but GitHub refused the key to merge it. Merge it on GitHub.');
  return array(false, 'The undo is ready as #' . $revert . ', but GitHub hasn’t let it merge yet. Press Undo again in a minute, or merge it on GitHub.');
}
// An undo made but not merged yet (GitHub was slow, or it was merged on GitHub): look once more. Gives how many settled.
function ap_undo_check(array $ctx): int {
  $db = $ctx['db']; $n = 0;
  if ($db === null) return 0;
  try { $rows = $db->query("SELECT pr, undo_pr FROM ap_prs WHERE undo_pr > 0 AND undone = 0 LIMIT 5")->fetchAll(PDO::FETCH_ASSOC); } catch (Exception $e) { return 0; }
  $gh = $ctx['gh'];
  foreach ($rows as $r) {
    list($c, $p) = $gh('GET', '/repos/' . $ctx['repo'] . '/pulls/' . (int) $r['undo_pr'], null);
    if ($c === 200 && is_array($p) && !empty($p['merged'])) { $db->prepare('UPDATE ap_prs SET undone = ? WHERE pr = ?')->execute(array(max(1, ap_time(isset($p['merged_at']) ? $p['merged_at'] : '')), (int) $r['pr'])); $n++; }
  }
  return $n;
}

// ----- reading what's kept -----
// The run pull requests waiting for the owner: held by the gate, or, while the autopilot isn't on, every open one.
function ap_waiting(PDO $db, string $mode): array {
  try { return $db->query("SELECT * FROM ap_prs WHERE state = 'open'" . ($mode === 'on' ? ' AND held = 1' : '') . ' ORDER BY created DESC, pr DESC')->fetchAll(PDO::FETCH_ASSOC); } catch (Exception $e) { return array(); }
}
// Every merged run, newest first, with what it changed.
function ap_merges(PDO $db, int $limit = 40): array {
  try {
    $rows = $db->query("SELECT * FROM ap_prs WHERE state = 'merged' ORDER BY merged DESC, pr DESC LIMIT " . max(1, $limit))->fetchAll(PDO::FETCH_ASSOC);
    $ch = $db->prepare('SELECT * FROM ap_changes WHERE pr = ? ORDER BY n');
    foreach ($rows as &$r) { $ch->execute(array((int) $r['pr'])); $r['list'] = $ch->fetchAll(PDO::FETCH_ASSOC); }
    unset($r);
    return $rows;
  } catch (Exception $e) { return array(); }
}
// Ten changes the autopilot merged in the last seven days, for the owner to spot-check: a fair pick that stays the
// same all week (each change's place is a hash of the week and the change), undone runs left out.
function ap_spot(PDO $db, string $week, int $want = 10): array {
  try {
    $st = $db->prepare("SELECT c.*, p.title, p.branch, p.merged FROM ap_changes c JOIN ap_prs p ON p.pr = c.pr WHERE p.state = 'merged' AND p.merged_by = ? AND p.merged > ? AND p.undone = 0");
    $st->execute(array(AP_BOT, time() - 7 * 86400));
    $all = $st->fetchAll(PDO::FETCH_ASSOC);
  } catch (Exception $e) { return array(); }
  usort($all, function ($a, $b) use ($week) { return strcmp(hash('sha256', $week . '|' . $a['pr'] . '|' . $a['n']), hash('sha256', $week . '|' . $b['pr'] . '|' . $b['n'])); });
  return array_slice($all, 0, $want);
}
// The shadow report, the same sums scripts/gate.mjs --report makes: each run pull request the gate commented on, what
// it said beside what happened, and whether the test for switching on has been passed (five days since the first
// comment, at least 30 changes judged on decided pull requests, none the gate would have merged that was closed).
function ap_report(PDO $db, string $today): array {
  try { $rows = $db->query("SELECT pr, branch, title, gate, changes, state, gate_at, merged_by FROM ap_prs WHERE gate != '' ORDER BY pr DESC")->fetchAll(PDO::FETCH_ASSOC); } catch (Exception $e) { $rows = array(); }
  $judged = 0; $wrong = array(); $first = '';
  foreach ($rows as $r) {
    $day = substr((string) $r['gate_at'], 0, 10);
    if ($day !== '' && ($first === '' || $day < $first)) $first = $day;
    if ($r['state'] === 'open') continue;
    $judged += (int) $r['changes'];
    if ($r['gate'] === 'publish' && $r['state'] === 'closed') $wrong[] = (int) $r['pr'];
  }
  $days = $first === '' ? 0 : (int) round((strtotime($today . ' 12:00:00 UTC') - strtotime($first . ' 12:00:00 UTC')) / 86400);
  return array('rows' => $rows, 'first' => $first, 'days' => $days, 'judged' => $judged, 'wrong' => $wrong, 'passed' => $days >= 5 && $judged >= 30 && !$wrong);
}
// Whether an email about a merged run may already have gone out, since an undo can't recall one. Senders told "it's on
// the site" are known (queue_items); the date, note and new-school emails go out each morning at about 8, so a run
// that changed those and was merged before the last 8 o'clock may have been in them. Gives sentences, or none.
function ap_emailed(PDO $db, array $row): array {
  $out = array();
  try {
    $st = $db->prepare('SELECT COUNT(*) FROM queue_items WHERE pr = ? AND told > 0'); $st->execute(array((int) $row['pr']));
    $told = (int) $st->fetchColumn();
    if ($told > 0) $out[] = $told . ' ' . ($told === 1 ? 'person who sent something in was' : 'people who sent something in were') . ' emailed that it’s on the site.';
  } catch (Exception $e) { /* no queue yet */ }
  $mails = strpos((string) $row['branch'], 'new-schools-') === 0;
  foreach (isset($row['list']) && is_array($row['list']) ? $row['list'] : array() as $c) {
    if (in_array($c['kind'], array('date', 'note', 'new-school'), true) || preg_match('/^d:/', (string) $c['listing']) || preg_match('/(^|\.)(dates|updates|daysOff)(\[|\.|$)|^register\.(dates|nextTerm)/', (string) $c['path'])) $mails = true;
  }
  if ($mails && (int) $row['merged'] > 0) {
    $tz = new DateTimeZone('America/New_York');
    $eight = new DateTime('@' . (int) $row['merged']); $eight->setTimezone($tz);
    if ((int) $eight->format('G') >= 8) $eight->modify('+1 day');
    $eight->setTime(8, 0);
    if ($eight->getTimestamp() <= time()) $out[] = 'It changed dates, notes or a new school, and the morning emails and notifications went out after it was merged: parents may already have them.';
  }
  return $out;
}

// ----- what else is waiting for the owner (the accounts database) -----
// Claims, photos, words and offers, premium sign-ups and queue items held for a decision: what /edit/claims/ and
// /edit/queue/ show with buttons today. A table from a later version that isn't there yet counts as none.
function needs_held(?PDO $db): array {
  $out = array('claims' => array(), 'photos' => array(), 'extras' => array(), 'premium' => array(), 'queue' => array(), 'mail' => array());
  if ($db === null) return $out;
  $rows = function ($sql) use ($db) { try { return $db->query($sql)->fetchAll(PDO::FETCH_ASSOC); } catch (Exception $e) { return array(); } };
  $out['claims'] = $rows("SELECT c.id, c.listing, c.domain, c.created, u.email, u.first, u.last FROM claims c JOIN users u ON u.id = c.user_id WHERE c.status = 'pending' ORDER BY c.id DESC");
  $out['photos'] = $rows("SELECT p.id, p.listing, p.alt, p.created, p.kind, u.email, u.first, u.last FROM photos p JOIN claims c ON c.id = p.claim_id JOIN users u ON u.id = c.user_id WHERE p.status = 'new' AND c.status = 'ok' ORDER BY p.id DESC");
  if (!$out['photos']) $out['photos'] = $rows("SELECT p.id, p.listing, p.alt, p.created, 'photo' AS kind, u.email, u.first, u.last FROM photos p JOIN claims c ON c.id = p.claim_id JOIN users u ON u.id = c.user_id WHERE p.status = 'new' AND c.status = 'ok' ORDER BY p.id DESC");   // from before logos
  $out['extras'] = $rows("SELECT e.id, e.listing, e.kind, e.body, e.until, e.created, u.email, u.first, u.last FROM extras e JOIN claims c ON c.id = e.claim_id JOIN users u ON u.id = c.user_id WHERE e.status = 'new' AND c.status = 'ok' ORDER BY e.id DESC");
  $out['premium'] = $rows("SELECT a.claim_id, a.plan, a.created, c.listing, u.email, u.first, u.last FROM premium_asks a JOIN claims c ON c.id = a.claim_id JOIN users u ON u.id = c.user_id WHERE c.status = 'ok' AND NOT EXISTS (SELECT 1 FROM premium p WHERE p.listing = c.listing) ORDER BY a.created DESC");
  // An email a run held is shown with the mail (below), with its message and a draft, not here.
  $out['queue'] = $rows("SELECT id, kind, listing, what, pr, reason, decided FROM queue_items WHERE state = 'held' AND substr(id, 1, 1) != 'm' ORDER BY decided DESC");
  // Mail from people the hold list (or a run) kept for the owner (the mailbox, Phase 5). Sealed: the page opens it.
  $out['mail'] = $rows("SELECT id, gid, thread, via, sealed, draft, subject, domain, dkim, listings, shared, account, outreach, attachments, hold, created FROM mail_in WHERE state = 'held' ORDER BY created DESC LIMIT 60");
  return $out;
}
function needs_count(array $held, array $prs): int { $n = count($prs); foreach ($held as $list) $n += count($list); return $n; }

// The gate's comment, from its Markdown to a little safe HTML: headings, lists, bold, code, italics and the small line.
function ap_md(string $md): string {
  $e = function ($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); };
  $inline = function ($s) use ($e) {
    $s = $e($s);
    $s = (string) preg_replace('/`([^`]+)`/', '<code>$1</code>', $s);
    $s = (string) preg_replace('/\*\*([^*]+)\*\*/', '<b>$1</b>', $s);
    $s = (string) preg_replace('/(^|\s)_([^_]+)_(?=\s|$|[.,;:])/', '$1<i>$2</i>', $s);
    return str_replace(array('&lt;sub&gt;', '&lt;/sub&gt;'), array('<small>', '</small>'), $s);
  };
  $out = ''; $depth = 0;
  foreach (preg_split('/\r?\n/', $md) as $line) {
    if (preg_match('/^\s*<!--.*-->\s*$/', $line)) continue;
    if (preg_match('/^(\s*)- (.*)$/', $line, $m)) {
      $want = strlen($m[1]) >= 2 ? 2 : 1;
      while ($depth < $want) { $out .= '<ul>'; $depth++; }
      while ($depth > $want) { $out .= '</ul>'; $depth--; }
      $out .= '<li>' . $inline($m[2]) . '</li>';
      continue;
    }
    while ($depth > 0) { $out .= '</ul>'; $depth--; }
    if (trim($line) === '') continue;
    if (preg_match('/^#{1,4} (.*)$/', $line, $m)) $out .= '<p><b>' . $inline($m[1]) . '</b></p>';
    else $out .= '<p>' . $inline($line) . '</p>';
  }
  while ($depth > 0) { $out .= '</ul>'; $depth--; }
  return $out;
}

if (!edit_signed_in()) { header('Location: ../', true, 303); exit; }
$db = edit_db();
$admin = edit_admin() !== '';
$ctx = array('db' => $db, 'gh' => 'gh', 'repo' => $REPO, 'branches' => $AP['branches'], 'authors' => $AP['authors'], 'allow' => $AP['allow'], 'evidenceDir' => $AP['evidenceDir'], 'site' => $SITE_URL);
$ready = $db !== null && gh_ready();
$csrf = hash_hmac('sha256', 'autopilot-form', edit_key());
$said = isset($_GET['said']) && is_string($_GET['said']) ? substr($_GET['said'], 0, 400) : '';
$confirm = isset($_GET['confirm']) ? (int) $_GET['confirm'] : 0;
function ae($v) { return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8'); }
function awhen($t) { $d = new DateTime('@' . (int) $t); $d->setTimezone(new DateTimeZone('America/New_York')); return $d->format('M j, g:i a'); }
function alabel($key) { global $LABELS; return isset($LABELS[$key]) ? $LABELS[$key] : (string) $key; }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $ok = isset($_POST['csrf']) && is_string($_POST['csrf']) && hash_equals($csrf, $_POST['csrf']);
  $do = isset($_POST['do']) && is_string($_POST['do']) ? $_POST['do'] : '';
  $pr = isset($_POST['pr']) ? (int) $_POST['pr'] : 0;
  $msg = 'That didn’t go through. Try again.'; $jump = '';
  if ($ok && $do === 'undo' && !$admin) $msg = 'Only a site admin’s account can undo.';
  elseif ($ok && !$ready) $msg = 'GitHub can’t be reached from here: the key file is missing on the server.';
  elseif ($ok && $do === 'undo' && $pr > 0) {
    if (!gh_allowed('needs-write', 30)) $msg = 'That’s a lot of changes in one hour. Wait a little and try again.';
    else { list($done, $msg) = ap_undo($ctx, $pr); $jump = '#pr-' . $pr; }
  } elseif ($ok && $do === 'sync') {
    if (!gh_allowed('needs-sync', 20)) $msg = 'That’s a lot of looks in one hour. Wait a little.';
    else { $s = ap_sync($ctx, true); $msg = $s['state'] === 'synced' ? 'Looked at GitHub just now.' : 'GitHub couldn’t be read (' . (isset($s['why']) ? $s['why'] : $s['state']) . ').'; }
  }
  header('Location: ./?said=' . rawurlencode($msg) . $jump, true, 303);
  exit;
}

if ($ready) { ap_sync($ctx); ap_undo_check($ctx); }
$merges = $db !== null ? ap_merges($db, 40) : array();
$synced = $db !== null ? (int) ap_meta($db, 'ap_synced') : 0;
$why = $db !== null ? ap_meta($db, 'ap_why') : '';
?>
<!doctype html>
<html lang="en" data-gate="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>What the autopilot merged | Philly After School</title>
<meta name="description" content="Every merge the autopilot made, with Undo.">
<link rel="canonical" href="https://phillyafterschool.org/edit/autopilot/">
<meta name="robots" content="noindex">
<meta property="og:title" content="What the autopilot merged | Philly After School">
<meta property="og:description" content="Every merge the autopilot made, with Undo.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://phillyafterschool.org/edit/autopilot/">
<meta property="og:site_name" content="Philly After School">
<meta property="og:image" content="https://phillyafterschool.org/share.png?v=1a5458e0">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Philly After School: a row of Philadelphia rowhouses, a school and a yellow school bus">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../../favicon.svg?v=88f8afa0" type="image/svg+xml">
<link rel="icon" href="../../favicon.png?v=58f67f81" type="image/png" sizes="48x48">
<link rel="apple-touch-icon" href="../../apple-touch-icon.png?v=5456ed0b">
<link rel="manifest" href="../../manifest.json">
<meta name="color-scheme" content="only light">
<meta name="theme-color" content="#0A3566">
<link rel="preload" href="../../assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../../assets/fonts/luckiest-guy-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../../assets/site.css?v=c5cdad25">
</head>
<body>
<script>document.documentElement.className+=' js';document.documentElement.setAttribute('data-quiet','');try{if(localStorage.getItem('pas-in')==='1'){document.documentElement.className+=' signed';if(localStorage.getItem('pas-role')==='parent')document.documentElement.className+=' parent'}}catch(e){}</script>
<div class="band topstrip when-out"><div class="topbar"><div class="in">
    <span class="top-claim"><span class="top-wide">Run a program or camp?</span><span class="top-narrow">Run a program?</span> <a href="../../managers/">Claim your listing</a></span>
    <span class="top-login"><span class="top-wide">Already have an account?</span> <a href="../../account/">Log in</a></span>
  </div></div></div>
<header class="band sitebar">
  <div class="in bar">
    <a class="brand" href="../../"><img class="logo" src="../../logo.png?v=05a08149" alt="Philly After School" width="773" height="240"></a>
    <button type="button" class="menu-btn" aria-expanded="false" aria-controls="site-nav"><span class="menu-bars" aria-hidden="true"></span>Menu</button>
    <nav class="nav" id="site-nav" aria-label="Site"><details class="menu" data-top="../../all-programs/"><summary>Programs</summary><ul><li class="menu-all"><a href="../../all-programs/">All Programs</a></li><li><a href="../../programs/">After School</a></li><li><a href="../../weekends/">Weekend Activities</a></li><li><a href="../../day-camps/">Day Camps</a></li><li><a href="../../summer-camps/">Summer Camps</a></li></ul></details><details class="menu" data-top="../../schedules/"><summary>Schedule Builder</summary><ul><li class="menu-all"><a href="../../schedules/">Build a Schedule</a></li><li><a href="../../board/">After School</a></li><li><a href="../../days-off/">Days Off</a></li><li><a href="../../summer-schedule/">Summer</a></li><li><a href="../../calendar/">My Calendar</a></li></ul></details><details class="menu when-out nav-feat" data-top="../../features/"><summary>Account Features</summary><ul><li class="menu-all"><a href="../../features/">All Account Features</a></li><li><a href="../../features/calendar/">Calendar & Sharing</a></li><li><a href="../../features/parent-portal/">Parent Portal</a></li><li><a href="../../features/kids-playground/">Kids’ Playground</a></li></ul></details><a class="nav-app" href="#getapp" data-getapp>Get the app</a><a class="nav-more" href="../../suggest/">Suggestion Box</a><a class="nav-more" href="../../about/">About</a><a class="when-in nav-acct" href="../../profile/">My Profile</a><a class="nav-cta when-out" href="../../register/">Create a free account</a><a class="nav-cta when-in" href="../../account/" data-news="2026-11-21" data-pm="1">Parent Portal<span class="news-dot" hidden><span class="vh"> (something new)</span></span></a><a class="when-in nav-kc" href="../../kids-playground/"><svg class="nav-kc-bulb" viewBox="0 0 24 30" width="20" height="25" aria-hidden="true" focusable="false"><path d="M8.5 20C8.5 17 3 15 3 10C3 5 7 1.5 12 1.5S21 5 21 10C21 15 15.5 17 15.5 20Z" fill="#F3C613" stroke="#0B2140" stroke-width="1.6"/><rect x="8.3" y="20" width="7.4" height="3" rx="1.5" fill="#E6F2FF" stroke="#0B2140" stroke-width="1.3"/><rect x="8.8" y="23" width="6.4" height="3" rx="1.5" fill="#96C9FF" stroke="#0B2140" stroke-width="1.3"/><circle cx="9.3" cy="9.5" r="1.4" fill="#0B2140"/><circle cx="14.7" cy="9.5" r="1.4" fill="#0B2140"/><path d="M9.3 12.6Q12 15.4 14.7 12.6" fill="none" stroke="#0B2140" stroke-width="1.4" stroke-linecap="round"/></svg><span class="vh">Kids’ </span>Playground</a></nav>
  </div>
</header>
<div class="band pagehead">
  <div class="in hero">
    <h1>What the autopilot merged</h1>
    <p class="lede">Every run pull request that went live, newest first: what it changed, the quote from the provider’s own page, and Undo. Undo takes back the whole pull request, and the site republishes in a few minutes.</p>
  </div>
  
</div>
<main class="wrap">
<div class="prose stats needs" data-autopilot-page>
<?php if ($said !== '') { ?><p class="flag"><?php echo ae($said); ?></p><?php } ?>
  <form method="post" action="./" class="actions needs-sync"><input type="hidden" name="csrf" value="<?php echo ae($csrf); ?>">
    <span class="hint"><?php if (!$ready) { ?>GitHub can’t be read from here: the key file is missing on the server.<?php } elseif ($synced > 0) { ?>Looked at GitHub <?php echo ae(awhen($synced)); ?>.<?php if ($why !== '') { ?> <b>The last look failed (<?php echo ae($why); ?>).</b><?php } ?><?php } else { ?>Not looked at GitHub yet.<?php } ?></span>
    <?php if ($ready) { ?><button class="btn" type="submit" name="do" value="sync">Look again</button><?php } ?>
  </form>
  <p class="hint">An email that already went out can’t be recalled. Each entry says when one may have: an answer to whoever sent the item in, or the morning date, note and new-school emails.</p>
  <?php if (!$merges) { ?><p class="hint">No run pull request has been merged since this page began keeping track.</p><?php } ?>
  <?php foreach ($merges as $m) { $mails = ap_emailed($db, $m); $bot = $m['merged_by'] === AP_BOT; ?><div class="panel needs-item" id="pr-<?php echo (int) $m['pr']; ?>">
    <h3><?php echo ae($m['title']); ?></h3>
    <p class="hint">#<?php echo (int) $m['pr']; ?> · <code><?php echo ae($m['branch']); ?></code> · merged <?php echo ae(awhen($m['merged'])); ?> <?php echo $bot ? 'by the autopilot' : 'by hand'; ?> · <a href="https://github.com/<?php echo ae($REPO); ?>/pull/<?php echo (int) $m['pr']; ?>" rel="noopener" target="_blank">on GitHub</a></p>
    <?php if ((int) $m['undone'] > 0) { ?><p class="flag"><b>Undone</b> <?php echo ae(awhen($m['undone'])); ?>, by <a href="https://github.com/<?php echo ae($REPO); ?>/pull/<?php echo (int) $m['undo_pr']; ?>" rel="noopener" target="_blank">#<?php echo (int) $m['undo_pr']; ?></a>.</p><?php } elseif ((int) $m['undo_pr'] > 0) { ?><p class="flag">An undo is waiting to merge: <a href="https://github.com/<?php echo ae($REPO); ?>/pull/<?php echo (int) $m['undo_pr']; ?>" rel="noopener" target="_blank">#<?php echo (int) $m['undo_pr']; ?></a>.</p><?php } ?>
    <?php if ((int) $m['evidence'] === 1 && $m['list']) { ?>
    <ul class="ap-changes"><?php foreach (array_slice($m['list'], 0, 12) as $c) { ?><li><b><?php echo ae(alabel($c['listing'])); ?></b> · <code><?php echo ae($c['path'] === '' ? '(the whole listing)' : $c['path']); ?></code>: <?php echo ae($c['old'] === '' ? '(nothing)' : $c['old']); ?> → <b><?php echo ae($c['new'] === '' ? '(nothing)' : $c['new']); ?></b><?php if ($c['quote'] !== '') { ?><blockquote><?php echo ae($c['quote']); ?></blockquote><?php } ?><?php if ($c['source'] !== '') { ?><span class="hint">From <a href="<?php echo ae($c['source']); ?>" rel="noopener nofollow" target="_blank"><?php echo ae($c['source']); ?></a></span><?php } ?></li><?php } ?></ul>
    <?php if (count($m['list']) > 12) { ?><details><summary>And <?php echo count($m['list']) - 12; ?> more</summary><ul class="ap-changes"><?php foreach (array_slice($m['list'], 12) as $c) { ?><li><b><?php echo ae(alabel($c['listing'])); ?></b> · <code><?php echo ae($c['path']); ?></code>: <?php echo ae($c['old'] === '' ? '(nothing)' : $c['old']); ?> → <b><?php echo ae($c['new'] === '' ? '(nothing)' : $c['new']); ?></b></li><?php } ?></ul></details><?php } ?>
    <?php } elseif ((int) $m['evidence'] === -1) { ?><p class="hint">No evidence file: it came before evidence files began<?php echo (int) $m['changes'] > 0 ? ', or it had nothing a quote could vouch for. The gate counted ' . (int) $m['changes'] . ' change' . ((int) $m['changes'] === 1 ? '' : 's') . '.' : '.'; ?> Open it on GitHub to see each one.</p>
    <?php } else { ?><p class="hint">What it changed hasn’t been read from GitHub yet. It will be on the next look.</p><?php } ?>
    <?php foreach ($mails as $line) { ?><p class="hint">✉ <?php echo ae($line); ?></p><?php } ?>
    <?php if ($admin && $ready && (int) $m['undone'] === 0) { ?>
      <?php if ($confirm === (int) $m['pr']) { ?><form method="post" action="./" class="panel needs-confirm"><input type="hidden" name="csrf" value="<?php echo ae($csrf); ?>"><input type="hidden" name="pr" value="<?php echo (int) $m['pr']; ?>">
        <p><b>Undo #<?php echo (int) $m['pr']; ?>?</b> Everything it changed<?php echo (int) $m['evidence'] === 1 && $m['list'] ? ' (' . count($m['list']) . ' change' . (count($m['list']) === 1 ? '' : 's') . ')' : ''; ?> goes back to how it was before, and the site republishes in a few minutes.<?php if ($mails) { ?> Emails already sent stay sent.<?php } ?></p>
        <div class="actions"><button class="btn primary" type="submit" name="do" value="undo">Yes, undo it</button><a class="btn" href="./#pr-<?php echo (int) $m['pr']; ?>">Keep it</a></div>
      </form><?php } else { ?><p class="actions"><a class="btn" href="./?confirm=<?php echo (int) $m['pr']; ?>#pr-<?php echo (int) $m['pr']; ?>">Undo…</a></p><?php } ?>
    <?php } ?>
  </div><?php } ?>
  <p><a class="btn" href="../needs/">Needs you</a> <a class="btn" href="../">Back to editing</a></p>
</div>

</main>
<footer class="foot"><div class="in">
  <nav class="foot-cols" aria-label="Footer">
    <div class="foot-brand">
      <a class="brand" href="../../"><img class="logo" src="../../logo-text.png?v=1a5884ce" alt="Philly After School" width="479" height="184"></a>
      <p><span data-copy="2ded0fc514" data-was="After-school programs in Philadelphia, sorted by the school your child goes to.">After-school programs, day camps, &amp; summer camps in Philadelphia.</span></p>
      <p class="foot-support"><span></span> <a class="btn foot-cta" href="../../support/">Help the site keep going</a></p>
      <p class="foot-app"><button type="button" class="btn foot-app-btn" data-getapp><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7 1h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zm0 3v14h10V4zm5 15.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg><span data-copy="f353421634">Get the app</span></button></p>
      <p class="foot-social"><a href="https://www.instagram.com/phillyafterschool/" target="_blank" rel="noopener me"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg><span data-copy="15099f0ac6">@phillyafterschool on Instagram</span></a></p>
    </div>
    <div>
      <h2><a href="../../all-programs/"><span data-copy="ab14d0a7db">Programs</span></a></h2>
      <ul>
        <li><a href="../../programs/"><span data-copy="28369b872d">After School</span></a></li>
        <li><a href="../../weekends/"><span data-copy="132b22fd26">Weekend Activities</span></a></li>
        <li><a href="../../day-camps/"><span data-copy="1800517f7a">Day Camps</span></a></li>
        <li><a href="../../summer-camps/"><span data-copy="3b97ddc88a">Summer Camps</span></a></li>
        <li><a href="../../schools/"><span data-copy="808e60f599">By School</span></a></li>
        <li><a href="../../neighborhoods/"><span data-copy="61da7e6243">By Neighborhood</span></a></li>
        <li><a href="../../types/"><span data-copy="329298c36a">By Type</span></a></li>
        <li><a href="../../by-day/"><span data-copy="1f0a4b0561">By Day of Week</span></a></li>
      </ul>
    </div>
    <div>
      <h2><a href="../../schedules/"><span data-copy="fcfb82d732">Schedule Builder</span></a></h2>
      <ul>
        <li><a href="../../board/"><span data-copy="28369b872d">After School</span></a></li>
        <li><a href="../../days-off/"><span data-copy="da0e59aaf7">Days Off</span></a></li>
        <li><a href="../../summer-schedule/"><span data-copy="7c92fc5cf6">Summer</span></a></li>
        <li><a href="../../calendar/"><span data-copy="4b29c410c7">My Calendar</span></a></li>
        <li><a href="../../alerts/"><span data-copy="8d786c59dd">Reminders by Email</span></a></li>
        <li><a href="../../profile/"><span data-copy="9ba8d391c5">My Profile</span></a></li>
      </ul>
    </div>
    <div>
      <h2><a href="../../features/"><span data-copy="74117762be">Account Features</span></a></h2>
      <ul>
        <li><a href="../../features/calendar/"><span data-copy="9d4f049b4e">Calendar &amp; Sharing</span></a></li>
        <li><a href="../../features/parent-portal/"><span data-copy="7ff0f3183b">Parent Portal</span></a></li>
        <li><a href="../../features/kids-playground/"><span data-copy="9c2eae05db">Kids’ Playground</span></a></li>
        <li class="when-out"><a href="../../register/"><span data-copy="65e5b31cc6">Create a free account</span></a></li>
      </ul>
    </div>
    <div>
      <h2><a href="../../about/"><span data-copy="6b21fb791a">About</span></a></h2>
      <ul>
        <li><a href="../../about/"><span data-copy="7a5ee4290b">The Story</span></a></li>
        <li><a href="../../suggest/"><span data-copy="0d514ed933">Suggestion Box</span></a></li>
        <li><a href="../../review/"><span data-copy="b0a4e87cbc">Write a Review</span></a></li>
        <li><a href="../../managers/"><span data-copy="91fdb321c8">For Program Managers</span></a></li>
        <li><a href="../../contact/"><span data-copy="b37456c453">Contact</span></a></li>
        <li><a href="../../privacy/"><span data-copy="cf01481f62">Privacy</span></a></li>
        <li><a href="../../terms/"><span data-copy="97738411d6">Terms of Use</span></a></li>
      </ul>
    </div>
  </nav>
  <div class="foot-fine">
    <img class="foot-bulb" src="../../bulb-line.png?v=45ab668e" alt="" width="130" height="160">
    <div class="foot-fine-text">
    <p><span data-copy="b7e5078568">Listings come from each provider’s public pages and are not endorsements. Prices, hours and pickup routes change, so confirm with the provider before you enroll.</span></p>
    <p><span data-copy="ab9dba162b" data-tpl="{site} is an independent community project. It is not affiliated with the School District of Philadelphia or any provider listed." data-vars="{&quot;site&quot;:&quot;Philly After School&quot;}">Philly After School is an independent community project. It is not affiliated with the School District of Philadelphia or any provider listed.</span></p>
    <p>Created, managed, and meticulously vibe coded by <a href="https://joshsilverbauer.com" target="_blank" rel="noopener">Josh Silverbauer</a>.</p>
    <p>Written, edited, and humanized by Rachael Silverbauer.</p>
    <p>Logo and design zhuzhing by Sierra Kiarsis.</p>
    </div>
  </div>
</div></footer>
<dialog id="getapp" class="pas-dialog getapp" aria-labelledby="getapp-h"><div class="pas-dialog-in">
  <img class="getapp-ic" src="/icon-192.png?v=0b7e72d4" alt="" width="64" height="64">
  <h2 id="getapp-h"><span data-copy="ff24541c24">Get the Philly After School app</span></h2>
  <div data-plat="ios" hidden>
    <p><span data-copy="b0cc91dfdb">On an iPhone or iPad, Apple has you add it yourself. It takes three taps:</span></p>
    <ol class="getapp-steps"><li><span data-copy="661ec2f0ad">Tap Share (the square with an arrow).</span></li><li><span data-copy="b393ab9e07">Choose “Add to Home Screen”, then “Add”.</span></li><li><span data-copy="396eceecc4">Open it from your Home Screen. With an account, log in there once.</span></li></ol>
    <p class="hint"><span data-copy="dedf275c2a">Reading this inside Instagram or Facebook? Open the page in Safari first.</span> <span data-copy="f09f53c80b">On an iPhone, the Home Screen copy is also how notifications for the dates you follow reach you.</span></p>
  </div>
  <div data-plat="android" hidden>
    <ol class="getapp-steps"><li><span data-copy="ae765413ff">Open your browser’s menu (the three dots).</span></li><li><span data-copy="0c0fa4d624">Choose “Add to Home screen” or “Install app”.</span></li></ol>
    <p class="hint"><span data-copy="0df419b4be">Reading this inside Instagram or Facebook? Open the page in Chrome first.</span></p>
  </div>
  <div data-plat="mac" hidden>
    <ol class="getapp-steps"><li><span data-copy="bafb7b454a">In the menu bar at the top of the screen, choose File.</span></li><li><span data-copy="21e3bb81af">Choose “Add to Dock”, then “Add”.</span></li></ol>
    <p class="hint"><span data-copy="ea35f5e061">It opens in its own window, from the Dock. Safari on an older Mac doesn’t have this; Chrome or Edge can install it there.</span></p>
  </div>
  <div data-plat="desktop" hidden>
    <p><span data-copy="2343d9d4e0">Your browser didn’t offer to install it just now. Most often that means it’s already installed, so look for it with your apps. If not:</span></p>
    <ol class="getapp-steps"><li><span data-copy="5eed08edbd">Click the install icon at the right end of the address bar.</span></li><li><span data-copy="9fb24f48b5">Or open the browser’s menu and choose “Install Philly After School” (Chrome keeps it under “Cast, save and share”, Edge under “Apps”).</span></li></ol>
  </div>
  <p class="hint"><span data-copy="632056cf5c">It’s this same site, kept like an app: free, nothing from an app store, and it opens right to your plans.</span></p>
  <button type="button" class="btn primary" data-dialog-close><span data-copy="5b8027fa0e">Got it</span></button>
</div></dialog>
<script src="../../assets/site.js?v=7785ab44" data-edit="{&quot;js&quot;:&quot;../../assets/edit.js?v=1646bb83&quot;,&quot;send&quot;:&quot;../../edit/send.php&quot;,&quot;home&quot;:&quot;../../edit/&quot;,&quot;contact&quot;:&quot;contact@phillyafterschool.org&quot;}" data-api="../../groups/api.php"></script>

</body>
</html>
