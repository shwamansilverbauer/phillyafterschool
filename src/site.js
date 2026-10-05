// Small enhancements. Every page reads fine without JavaScript; this adds the school search,
// the grade/type filter, the rosters, and a few form conveniences.
(function () {
  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { return null; }
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function all(root, sel) { return [].slice.call(root.querySelectorAll(sel)); }

  // Events for Google Tag Manager. Harmless when GTM is not installed.
  function track(data) { (window.dataLayer = window.dataLayer || []).push(data); }

  // ----- edit mode: switched on from /edit/, it loads a second script that makes the site's copy editable -----
  var editCfg = null;
  try { editCfg = JSON.parse(document.currentScript.getAttribute('data-edit')); } catch (e) { /* no edit mode on this page */ }
  var editLoaded = false;
  function loadEditor() {
    if (editLoaded || !editCfg) return;
    editLoaded = true;
    window.PAS_EDIT = editCfg;
    var s = document.createElement('script');
    s.src = editCfg.js;
    document.body.appendChild(s);
  }
  if (store('pas-edit') === '1') loadEditor();
  var editPage = document.querySelector('[data-edit-page]');
  if (editPage) {
    var startBtn = editPage.querySelector('#edit-start'), stopBtn = editPage.querySelector('#edit-stop');
    var stateTitle = editPage.querySelector('#edit-state'), stateText = editPage.querySelector('#edit-state-text');
    var showState = function () {
      var on = store('pas-edit') === '1';
      startBtn.hidden = on; stopBtn.hidden = !on;
      stateTitle.textContent = on ? 'Editing is on' : 'Editing is off';
      stateText.textContent = on ? 'Open any page from the menu or the list below, click a sentence and type.' : 'Turn it on and a bar appears at the bottom of every page.';
    };
    startBtn.addEventListener('click', function () {
      store('pas-edit', '1');
      if (store('pas-edit') !== '1') { stateText.textContent = 'This browser is blocking saved data, so editing can’t carry from page to page. Try a regular (not private) window.'; return; }
      loadEditor(); showState();
    });
    stopBtn.addEventListener('click', function () { store('pas-edit', '0'); location.reload(); });
    var signOut = editPage.querySelector('a[href="?out=1"]');
    if (signOut) signOut.addEventListener('click', function () { store('pas-edit', '0'); });   // signing out also switches editing off
    showState();
  }

  // Clicks on register, website, calendar and review links, on school pages and program pages.
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-track]') : null;
    if (!a || a.getAttribute('data-track') === 'support') return;
    var card = a.closest('.prog[id]'), prog = a.closest('[data-program-page]'), sch = a.closest('[data-school-page]');
    track({ event: 'pas_outbound', link_type: a.getAttribute('data-track'), program_id: card ? card.id : prog ? prog.getAttribute('data-program-page') : '', school: sch ? sch.getAttribute('data-school-page') : '' });
  });

  // ----- suggest-a-program form -----
  var form = document.querySelector('#suggest-form');
  if (form) {
    // Show only the fields that fit what is being sent: a program, a correction, or a school.
    var KINDS = ['program', 'correction', 'school'];
    var kindInputs = all(form, 'input[name="kind"]');
    var kindKey = function () {
      for (var i = 0; i < kindInputs.length; i++) if (kindInputs[i].checked) return KINDS[i];
      return 'program';
    };
    var sync = function () {
      var key = kindKey();
      all(form, '[data-show]').forEach(function (box) {
        var on = box.getAttribute('data-show').split(' ').indexOf(key) > -1;
        box.hidden = !on;
        all(box, 'input, select, textarea').forEach(function (c) { c.disabled = !on; });
      });
      all(form, '[data-text-' + key + ']').forEach(function (t) {
        t.textContent = t.getAttribute('data-text-' + key);
      });
      form.querySelector('#f-details').required = key !== 'school';
      form.querySelector('#f-newschool').required = key === 'school';
    };
    kindInputs.forEach(function (i) { i.addEventListener('change', sync); });
    var asked = query();   // arriving from "ask for a school" or "request a feature"
    var wanted = KINDS.indexOf(asked.kind);
    if (wanted > -1 && kindInputs[wanted]) kindInputs[wanted].checked = true;
    sync();
    if (asked.newschool) form.querySelector('#f-newschool').value = asked.newschool.slice(0, 120);
    form.addEventListener('submit', function () {
      var key = kindKey();
      track({ event: 'pas_suggest_submit', suggest_kind: key, school: key === 'school' ? 'new school' : form.querySelector('#f-school').value });
    });
  }

  var ideaForm = document.querySelector('#idea-form');
  if (ideaForm) ideaForm.addEventListener('submit', function () { track({ event: 'pas_suggest_submit', suggest_kind: 'idea', school: '' }); });

  // ----- review form: arrive with the program and school already chosen -----
  var review = document.querySelector('#review-form');
  if (review) {
    var qs = query();
    ['program', 'school'].forEach(function (name) {
      var sel = review.querySelector('[name="' + name + '"]');
      if (qs[name] && all(sel, 'option').some(function (o) { return o.value === qs[name]; })) sel.value = qs[name];
    });
    review.addEventListener('submit', function () {
      var s = review.querySelector('input[name="stars"]:checked');
      track({ event: 'pas_review_submit', program_id: review.querySelector('[name="program"]').value, school: review.querySelector('[name="school"]').value, stars: s ? s.value : '' });
    });
  }

  // Support button
  var give = document.querySelector('a[data-track="support"]');
  if (give) give.addEventListener('click', function () { track({ event: 'pas_support_click' }); });

  // Registration dates that have passed since the site was last built are hidden.
  var d = new Date();
  var today = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  all(document, '.cal[data-date]').forEach(function (c) { if (c.getAttribute('data-date') < today) c.hidden = true; });

  // ----- find your school: every district and charter school in the city, covered or not -----
  function query() {
    var out = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (p) {
      var i = p.indexOf('=');
      if (i > 0) { try { out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { /* ignore */ } }
    });
    return out;
  }
  var finderCache = null;
  function loadFinder(box, done) {
    if (finderCache) { done(finderCache); return; }
    var inline = document.getElementById('finder-data');
    if (inline) { finderCache = JSON.parse(inline.textContent); done(finderCache); return; }
    var src = box.getAttribute('data-src');
    if (!src || !window.fetch) { done(null); return; }
    window.fetch(src).then(function (r) { return r.json(); }).then(function (d) { finderCache = d; done(d); }, function () { done(null); });
  }
  // rows are [id, name, address, grades, kind, covered school id, programs listed, nearest covered id, miles]
  function schoolHref(box, row) {
    var root = box.getAttribute('data-root') || '', index = box.getAttribute('data-index') || '';
    return row[5] ? root + row[5] + '/' + index : root + 'schools/request/' + index + '?s=' + row[0];
  }
  all(document, '[data-finder]').forEach(function (box) {
    var input = box.querySelector('input'), list = box.querySelector('.finder-list');
    var data = null, shown = [], active = -1;
    var close = function () { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    var mark = function () {
      all(list, 'li').forEach(function (li, i) { li.setAttribute('aria-selected', String(i === active)); });
      if (active > -1) input.setAttribute('aria-activedescendant', 'finder-opt-' + active); else input.removeAttribute('aria-activedescendant');
    };
    var render = function () {
      var words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      list.textContent = '';
      shown = []; active = -1;
      if (!words.length) { close(); return; }
      if (!data) { var wait = el('li', 'finder-note', 'Loading schools…'); list.appendChild(wait); list.hidden = false; return; }
      var tests = words.map(function (w) { return new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); });
      var hits = data.schools.filter(function (r) { var hay = (r[1] + ' ' + r[2]).toLowerCase(); return tests.every(function (t) { return t.test(hay); }); });
      hits.sort(function (a, b) { return (b[5] ? 1 : 0) - (a[5] ? 1 : 0) || a[1].localeCompare(b[1]); });
      shown = hits.slice(0, 8);
      shown.forEach(function (r, i) {
        var li = el('li'); li.id = 'finder-opt-' + i; li.setAttribute('role', 'option');
        var a = el('a'); a.href = schoolHref(box, r); a.tabIndex = -1;
        a.appendChild(el('b', null, r[1]));
        a.appendChild(el('span', 'finder-meta', r[2] + (r[3] ? ' · grades ' + r[3] : '') + (r[4] ? ' · ' + r[4] : '')));
        a.appendChild(el('span', 'pill ' + (r[5] ? 'onsite' : 'nearby'), r[5] ? r[6] + ' programs listed' : 'Not covered yet: ask for it'));
        a.addEventListener('click', function () { track({ event: 'pas_school_pick', school: r[5] || r[0], covered: r[5] ? 'yes' : 'no' }); });
        li.appendChild(a); list.appendChild(li);
      });
      if (hits.length > shown.length) list.appendChild(el('li', 'finder-note', (hits.length - shown.length) + ' more. Keep typing to narrow it down.'));
      if (!hits.length) {
        var none = el('li', 'finder-note');
        none.appendChild(document.createTextNode('No district or charter school matches that. '));
        var ask = el('a', null, 'Tell us about it.'); ask.href = (box.getAttribute('data-root') || '') + 'suggest/' + (box.getAttribute('data-index') || '') + '?kind=school&newschool=' + encodeURIComponent(input.value.trim());
        none.appendChild(ask); list.appendChild(none);
      }
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
    };
    var start = function () { if (!data) loadFinder(box, function (d) { data = d || { schools: [] }; if (input.value) render(); }); };
    input.addEventListener('focus', start);
    input.addEventListener('input', function () { start(); render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!shown.length) return;
        e.preventDefault();
        active = e.key === 'ArrowDown' ? (active + 1) % shown.length : (active <= 0 ? shown.length - 1 : active - 1);
        mark();
      } else if (e.key === 'Enter') {
        var pick = shown[active > -1 ? active : 0];
        if (!pick) return;
        e.preventDefault();
        track({ event: 'pas_school_pick', school: pick[5] || pick[0], covered: pick[5] ? 'yes' : 'no' });
        location.href = schoolHref(box, pick);
      } else if (e.key === 'Escape') { close(); }
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) close(); });
  });

  // ----- a school that isn't covered yet: say so, take the request, point somewhere useful -----
  var reqPage = document.querySelector('[data-request-page]');
  if (reqPage) {
    var slug = query().s || '';
    loadFinder(reqPage, function (d) {
      var row = null;
      if (d) d.schools.forEach(function (r) { if (r[0] === slug) row = r; });
      if (!row) return;   // no school chosen: the page stays as a search box
      var root = reqPage.getAttribute('data-root') || '', index = reqPage.getAttribute('data-index') || '';
      if (row[5]) { location.replace(root + row[5] + '/' + index); return; }   // it has a page after all
      var $ = function (id) { return document.getElementById(id); };
      $('req-title').textContent = row[1] + ' isn’t covered yet';
      $('req-meta').textContent = row[2] + (row[3] ? ' · grades ' + row[3] : '') + (row[4] ? ' · ' + row[4] + ' school' : '') + '. We haven’t checked which programs pick up here.';
      document.title = row[1] + ' | Philly After School';
      var btn = $('req-btn'), status = $('req-status');
      var asked = [];
      try { asked = JSON.parse(store('pas-requested') || '[]') || []; } catch (e) { asked = []; }
      var done = function (msg) { btn.disabled = true; btn.textContent = 'Asked. Thank you.'; status.textContent = msg; };
      btn.textContent = 'Ask for ' + row[1];
      $('req-panel').hidden = false;
      if (asked.indexOf(slug) > -1) done('You’ve already asked for this one. It’s counted.');
      btn.addEventListener('click', function () {
        track({ event: 'pas_school_request', school: slug });
        var finish = function () { asked.push(slug); store('pas-requested', JSON.stringify(asked.slice(-50))); done('Counted. Schools with the most requests get covered first.'); };
        var send = reqPage.getAttribute('data-send');
        if (!send || !window.fetch) { finish(); return; }
        btn.disabled = true; status.textContent = 'Sending…';
        window.fetch(send, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ s: slug, company: '' }) })
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.ok) finish(); else { btn.disabled = false; status.textContent = 'That didn’t go through. Please try again.'; } },
            function () { btn.disabled = false; status.textContent = 'That didn’t go through. Please try again.'; });
      });
      if (row[7] && row[8] <= 2 && d.covered[row[7]]) {   // close enough that the same programs may reach both
        $('req-near-text').textContent = 'The closest school with a page is ' + d.covered[row[7]] + ', about ' + row[8] + (row[8] === 1 ? ' mile' : ' miles') + ' away. Programs that serve it may be near you too, but ask each one whether it picks up from ' + row[1] + '.';
        $('req-near-link').textContent = 'See ' + d.covered[row[7]];
        $('req-near-link').href = root + row[7] + '/' + index;
      } else {
        $('req-near-text').textContent = 'No school with a page is close by yet. You can still browse by neighborhood or look through every program.';
        $('req-near-link').hidden = true;
      }
      $('req-near').hidden = false;
      $('req-tell').href = root + 'suggest/' + index + '?kind=school&newschool=' + encodeURIComponent(row[1]);
      $('req-tell-wrap').hidden = false;
    });
  }

  // ----- rosters: one per child, each with a current week and an upcoming one, kept in this browser, shared by link -----
  var DAYS = [['mon', 'Monday', 'Mon'], ['tue', 'Tuesday', 'Tue'], ['wed', 'Wednesday', 'Wed'], ['thu', 'Thursday', 'Thu'], ['fri', 'Friday', 'Fri']];
  var MAX_KIDS = 6;
  var rosters = null;
  var storageOk = true;
  try { window.localStorage.setItem('pas-test', '1'); window.localStorage.removeItem('pas-test'); } catch (e) { storageOk = false; }
  function emptyBoard() { return { days: { mon: [], tue: [], wed: [], thu: [], fri: [] } }; }
  function cleanBoard(b) {
    var out = emptyBoard();
    if (b && typeof b === 'object') {
      DAYS.forEach(function (day) {
        var a = b.days && b.days[day[0]];
        if (Array.isArray(a)) out.days[day[0]] = a.filter(function (x) { return typeof x === 'string' && /^[a-z0-9-]+\.[a-z0-9-]+(~[^~,&=#]{1,40})?$/.test(x); }).slice(0, 8);
      });
    }
    return out;
  }
  function cleanName(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/^ | $/g, '').slice(0, 40); }
  function newKid(name) { return { name: cleanName(name), now: emptyBoard(), next: emptyBoard(), teacher: '', cardNote: '' }; }
  function possessive(name) { return name + '’s'; }
  // A pick is "program.school", optionally followed by "~" and a class or short note.
  function entryKey(e) { var i = e.indexOf('~'); return i < 0 ? e : e.slice(0, i); }
  function entryNote(e) { var i = e.indexOf('~'); return i < 0 ? '' : e.slice(i + 1); }
  function cleanNote(s) { return String(s || '').replace(/[~,&=#\r\n]/g, ' ').replace(/\s+/g, ' ').replace(/^ | $/g, '').slice(0, 40); }
  function makeEntry(key, note) { note = cleanNote(note); return note ? key + '~' + note : key; }
  function findEntry(list, key) { for (var i = 0; i < list.length; i++) if (entryKey(list[i]) === key) return i; return -1; }
  function parse(key) { try { return JSON.parse(store(key) || 'null'); } catch (e) { return null; } }
  function loadRosters() {
    if (rosters) return rosters;
    var raw = parse('pas-rosters');
    if (raw && Array.isArray(raw.kids) && raw.kids.length) {
      rosters = { kid: 0, active: raw.active === 'now' ? 'now' : 'next', kids: raw.kids.slice(0, MAX_KIDS).map(function (k) {
        k = k && typeof k === 'object' ? k : {};
        return { name: cleanName(k.name), now: cleanBoard(k.now), next: cleanBoard(k.next), teacher: cleanName(k.teacher), cardNote: String(k.cardNote == null ? '' : k.cardNote).slice(0, 110) };
      }) };
      if (typeof raw.kid === 'number' && raw.kid % 1 === 0 && raw.kid >= 0 && raw.kid < rosters.kids.length) rosters.kid = raw.kid;
    } else {
      // Carry over a board saved before each child had their own roster: it becomes the first child's.
      var old = parse('pas-boards') || { active: parse('pas-board') ? 'now' : 'next', now: parse('pas-board'), next: null };   // someone new starts on the upcoming roster: planning the next term is why most people come
      var name = (old.now && old.now.name) || (old.next && old.next.name) || '';
      var kid = newKid(String(name).replace(/[’']s (week|board|roster)$/i, ''));
      kid.now = cleanBoard(old.now); kid.next = cleanBoard(old.next);
      rosters = { kid: 0, active: old.active === 'now' ? 'now' : 'next', kids: [kid] };
    }
    return rosters;
  }
  function saveRosters() { store('pas-rosters', JSON.stringify(rosters)); updateCount(); }
  function activeKid() { var r = loadRosters(); return r.kids[r.kid]; }
  function activeBoard() { var r = loadRosters(); return r.kids[r.kid][r.active]; }
  function kidLabel(k, i) { return k.name || 'Child ' + (i + 1); }
  function countPicks(b) {
    var seen = {};
    DAYS.forEach(function (day) { b.days[day[0]].forEach(function (k) { seen[entryKey(k)] = 1; }); });
    return Object.keys(seen).length;
  }
  function updateCount() {
    var n = 0;
    loadRosters().kids.forEach(function (k) { n += countPicks(k.now) + countPicks(k.next); });
    all(document, '[data-board-count]').forEach(function (c) { c.textContent = n ? String(n) : ''; c.hidden = !n; });
  }
  updateCount();

  var boardPage = document.querySelector('[data-board-page]');
  if (boardPage) {
    var data = JSON.parse(document.getElementById('pas-data').textContent);
    var $ = function (id) { return boardPage.querySelector(id); };
    var week = $('#week'), nameInput = $('#board-name'), status = $('#board-status'), tools = $('#board-tools');
    var banner = $('#board-shared'), bannerText = $('#board-shared-text'), emptyNote = $('#board-empty'), emptyText = $('#board-empty-text');
    var linkBox = $('#board-link'), title = $('#board-title'), tabs = $('#board-tabs'), promote = $('#board-promote'), emailLink = $('#board-email');
    var kidBar = $('#kid-bar'), kidTabs = $('#kid-tabs'), kidAdd = $('#kid-add'), kidRemove = $('#kid-remove'), adopt = $('#board-adopt');
    var WHICH = { now: 'current', next: 'upcoming' };

    var encode = function (name, b, which) {
      var parts = [];
      if (which === 'next') parts.push('b=next');
      if (name) parts.push('n=' + encodeURIComponent(name));
      DAYS.forEach(function (day) {
        if (b.days[day[0]].length) parts.push(day[0] + '=' + b.days[day[0]].map(function (e) { var n = entryNote(e); return entryKey(e) + (n ? '~' + encodeURIComponent(n) : ''); }).join(','));
      });
      return parts.join('&');
    };
    var decode = function (hash) {
      var b = emptyBoard(), any = false, which = 'now', name = '';
      hash.replace(/^#/, '').split('&').forEach(function (p) {
        var i = p.indexOf('=');
        if (i < 0) return;
        var k = p.slice(0, i), v = p.slice(i + 1);
        if (k === 'n') { try { name = cleanName(decodeURIComponent(v)); } catch (e) { /* ignore */ } }
        else if (k === 'b') { which = v === 'next' ? 'next' : 'now'; }
        else if (b.days[k]) {
          b.days[k] = v.split(',').map(function (e) { var n = entryNote(e); try { n = decodeURIComponent(n); } catch (err) { n = ''; } return makeEntry(entryKey(e), n); });
          any = true;
        }
      });
      return any ? { which: which, name: name, board: cleanBoard(b) } : null;
    };
    // The page's first script moved a shared roster out of the address (see build.mjs) so analytics never sees the name in it.
    var sharedHash = window.__pasShared || '';
    try { sharedHash = sharedHash || window.sessionStorage.getItem('pas-shared') || ''; } catch (e) { /* no session storage */ }
    var shared = decode(sharedHash || location.hash);
    var lookup = function (entry) {
      var p = entryKey(entry).split('.'), prog = data.programs[p[0]], sch = data.schools[p[1]];
      return prog && sch && prog.schools[p[1]] ? { id: p[0], prog: prog, sch: sch, link: prog.schools[p[1]], note: entryNote(entry) } : null;
    };
    var pillText = function (k) {
      return k.link.rel === 'onsite' ? 'At ' + k.sch.name : k.link.rel === 'pickup' ? k.sch.name + ' pickup' : 'Near ' + k.sch.name;
    };
    var shareUrl = function () { var r = loadRosters(), k = activeKid(); return location.href.split('#')[0] + '#' + encode(k.name, k[r.active], r.active); };
    var heading = function (name, which) { return (name ? possessive(name) + ' after-school roster' : 'After-school roster') + (which === 'next' ? ' (upcoming)' : ''); };
    var asText = function (name, b, which) {
      var lines = [heading(name, which) + ', from Philly After School'];
      DAYS.forEach(function (day) {
        var picks = b.days[day[0]].map(lookup).filter(Boolean).map(function (k) {
          return k.prog.name + (k.note ? ': ' + k.note : '') + (k.link.where ? ' (' + k.link.where + ')' : '') + (k.prog.pickupBy ? ', pick up by ' + k.prog.pickupBy : '');
        });
        if (picks.length) lines.push(day[2] + ': ' + picks.join('; '));
      });
      return lines.join('\n');
    };
    var say = function (msg) { status.textContent = msg; };
    var savedNote = function () { return storageOk ? 'Saved on this device.' : 'Your browser is blocking saved data, so this roster will be gone when you close the page. Keep the link.'; };
    var copy = function (text, done) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { say(done); }, function () { linkBox.focus(); linkBox.select(); say('Copy it from the box below.'); });
      } else { linkBox.focus(); linkBox.select(); say('Copy it from the box below.'); }
    };
    // Where a shared roster would be saved: the child with the same name, an untouched first roster, or a new child.
    var adoptSlot = function () {
      var r = loadRosters(), at = -1;
      if (shared.name) r.kids.forEach(function (k, i) { if (at < 0 && k.name.toLowerCase() === shared.name.toLowerCase()) at = i; });
      if (at < 0 && r.kids.length === 1 && !r.kids[0].name && !countPicks(r.kids[0].now) && !countPicks(r.kids[0].next)) at = 0;
      return at;
    };

    var render = function () {
      var r = loadRosters();
      var which = shared ? shared.which : r.active;
      var kid = shared ? null : r.kids[r.kid];
      var name = shared ? shared.name : kid.name;
      var b = shared ? shared.board : kid[which];
      var total = 0;
      week.textContent = '';
      DAYS.forEach(function (day) {
        var col = el('section', 'daycol');
        col.appendChild(el('h3', null, day[1]));
        var list = el('ul'), n = 0;
        b.days[day[0]].forEach(function (key) {
          var k = lookup(key);
          if (!k) return;
          n++; total++;
          var li = el('li', 'pick tc');
          var type = data.types[k.prog.type];
          if (type) {   // the card wears its program type: color band, icon, and its number in the set
            li.style.setProperty('--tc', type.color);
            var band = el('span', 'tc-top');
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('aria-hidden', 'true');
            var shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            shape.setAttribute('d', type.icon); shape.setAttribute('fill', 'currentColor'); shape.setAttribute('fill-rule', 'evenodd');
            svg.appendChild(shape); band.appendChild(svg);
            band.appendChild(el('span', null, type.label));
            band.appendChild(el('span', 'tc-no', 'No. ' + k.prog.no));
            li.appendChild(band);
          }
          li.appendChild(el('span', 'pill ' + k.link.rel, pillText(k)));
          var a = el('a', null, k.prog.name);
          a.href = k.sch.path + '#' + k.id;
          var strong = el('b'); strong.appendChild(a); li.appendChild(strong);
          if (shared) { if (k.note) li.appendChild(el('span', 'cls', k.note)); }
          else {
            var note = el('input', 'note');
            note.type = 'text'; note.maxLength = 40; note.value = k.note;
            note.placeholder = k.prog.offers.length ? 'Which class?' : 'Add a note';
            note.setAttribute('aria-label', 'Class or note for ' + k.prog.name + ' on ' + day[1]);
            if (k.prog.offers.length) note.setAttribute('list', 'offers-' + k.id);
            note.addEventListener('change', function () {
              var mine = activeBoard(), i = mine.days[day[0]].indexOf(key);
              if (i > -1) { mine.days[day[0]][i] = makeEntry(entryKey(key), note.value); saveRosters(); say(savedNote()); render(); }
            });
            li.appendChild(note);
          }
          if (k.prog.pickupBy) li.appendChild(el('span', 'by-time', 'Pick up by ' + k.prog.pickupBy));
          if (k.link.where) li.appendChild(el('span', 'hint', k.link.where));
          if (!k.prog.pickupBy) li.appendChild(el('span', 'hint', k.prog.hours));
          if (!shared) {
            var rm = el('button', 'clear', 'Remove');
            rm.type = 'button';
            rm.addEventListener('click', function () {
              var mine = activeBoard(), i = mine.days[day[0]].indexOf(key);
              if (i > -1) mine.days[day[0]].splice(i, 1);
              saveRosters(); say(savedNote()); render();
            });
            li.appendChild(rm);
          }
          list.appendChild(li);
        });
        col.appendChild(n ? list : el('p', 'hint', 'Nothing yet.'));
        week.appendChild(col);
      });
      banner.hidden = !shared;
      tabs.hidden = !!shared;
      kidBar.hidden = !!shared;
      tools.hidden = !!shared || total === 0;
      if (maker) maker.hidden = !!shared || total === 0;
      emptyNote.hidden = !!shared || total > 0;
      promote.hidden = !!shared || which !== 'next' || total === 0;
      promote.textContent = 'The new term has started: make this the current roster';
      promote.removeAttribute('data-armed');
      all(tabs, '.tab').forEach(function (t) { t.setAttribute('aria-pressed', String(t.getAttribute('data-board') === which)); });
      if (shared) {
        title.textContent = (name ? possessive(name) + ' roster' : 'A shared roster') + (which === 'next' ? ' (upcoming)' : '');
        bannerText.textContent = (which === 'next' ? 'This is what they have planned for the upcoming term.' : 'This is what they’re doing now.') + ' It isn’t saved on your device yet.';
        var slot = adoptSlot();
        adopt.textContent = slot > -1 && r.kids[slot].name && countPicks(r.kids[slot][which])
          ? 'Replace ' + possessive(r.kids[slot].name) + ' ' + WHICH[which] + ' roster with this'
          : 'Save it to my rosters';
        return;
      }
      // one chip per child, once there is more than one
      kidTabs.textContent = '';
      kidTabs.hidden = r.kids.length < 2;
      r.kids.forEach(function (k, i) {
        var chip = el('button', 'kid', kidLabel(k, i));
        chip.type = 'button';
        chip.setAttribute('aria-pressed', String(i === r.kid));
        chip.addEventListener('click', function () { r.kid = i; photo = null; if (photoBox) { photoBox.value = ''; photoClear.hidden = true; } saveRosters(); say(''); render(); });
        kidTabs.appendChild(chip);
      });
      kidAdd.hidden = r.kids.length >= MAX_KIDS;
      kidRemove.hidden = r.kids.length < 2;
      kidRemove.textContent = 'Remove ' + (kid.name ? possessive(kid.name) + ' rosters' : 'this child');
      kidRemove.removeAttribute('data-armed');
      title.textContent = (kid.name ? possessive(kid.name) : 'Your') + (which === 'next' ? ' upcoming week' : ' current week');
      emptyText.textContent = which === 'next'
        ? 'Open a school’s page and choose “Add to roster” on any program. Pick the days, and it shows up here.'
        : 'Nothing on the current roster yet. On any program, choose “Add to roster”, switch it to Current, and pick the days.';
      linkBox.value = shareUrl();
      emailLink.href = 'mailto:?subject=' + encodeURIComponent(heading(kid.name, which)) + '&body=' + encodeURIComponent(asText(kid.name, b, which) + '\n\n' + shareUrl());
      if (document.activeElement !== nameInput) nameInput.value = kid.name;
      if (maker) {
        if (document.activeElement !== teacherBox) teacherBox.value = kid.teacher || '';
        if (document.activeElement !== noteBox) noteBox.value = kid.cardNote || '';
        drawCard();
      }
    };

    all(tabs, '.tab').forEach(function (t) {
      t.addEventListener('click', function () { loadRosters().active = t.getAttribute('data-board'); saveRosters(); say(''); render(); });
    });
    nameInput.addEventListener('input', function () { activeKid().name = nameInput.value.replace(/\s+/g, ' ').slice(0, 40); saveRosters(); say(savedNote()); render(); });
    nameInput.addEventListener('blur', function () { var k = activeKid(); if (k.name !== cleanName(k.name)) { k.name = cleanName(k.name); saveRosters(); render(); } });
    kidAdd.addEventListener('click', function () {
      var r = loadRosters();
      if (r.kids.length >= MAX_KIDS) return;
      r.kids.push(newKid('')); r.kid = r.kids.length - 1; r.active = 'next';
      saveRosters(); say('New roster added. Give it a name, then add programs from a school’s page.'); render();
      nameInput.value = ''; nameInput.focus();
    });
    kidRemove.addEventListener('click', function () {
      if (!kidRemove.getAttribute('data-armed')) {   // two taps, because it deletes both of that child's rosters
        kidRemove.setAttribute('data-armed', '1');
        kidRemove.textContent = 'Tap again to remove both of their rosters';
        return;
      }
      var r = loadRosters();
      if (r.kids.length < 2) return;
      r.kids.splice(r.kid, 1); r.kid = Math.max(0, r.kid - 1);
      saveRosters(); say('Removed.'); render();
    });
    var track_share = function (method) { track({ event: 'pas_board_share', method: method, board: WHICH[loadRosters().active] }); };
    $('#board-copy-link').addEventListener('click', function () { copy(shareUrl(), 'Link copied. Paste it into a text or email.'); track_share('copy_link'); });
    $('#board-copy-text').addEventListener('click', function () { var r = loadRosters(), k = activeKid(); copy(asText(k.name, k[r.active], r.active) + '\n' + shareUrl(), 'Copied as text, with the link.'); track_share('copy_text'); });
    emailLink.addEventListener('click', function () { track_share('email_self'); });
    var shareBtn = $('#board-share');
    if (navigator.share) {
      shareBtn.hidden = false;
      shareBtn.addEventListener('click', function () {
        var r = loadRosters(), k = activeKid();
        navigator.share({ title: heading(k.name, r.active), text: asText(k.name, k[r.active], r.active), url: shareUrl() }).then(function () { track_share('share_sheet'); }, function () { /* closed without sharing */ });
      });
    }
    $('#board-clear').addEventListener('click', function () { var r = loadRosters(); r.kids[r.kid][r.active] = emptyBoard(); saveRosters(); say('Roster cleared.'); render(); });
    promote.addEventListener('click', function () {
      if (!promote.getAttribute('data-armed')) {   // two taps, because it replaces the current roster
        promote.setAttribute('data-armed', '1');
        promote.textContent = 'Tap again to replace the current roster with this one';
        return;
      }
      var r = loadRosters(), k = activeKid();
      k.now = k.next; k.next = emptyBoard(); r.active = 'now';
      saveRosters(); say('Done. This is now the current roster.'); render();
    });
    var leaveShared = function (keep) {
      var msg = '';
      if (keep) {
        var r = loadRosters(), at = adoptSlot();
        if (at < 0 && r.kids.length >= MAX_KIDS) { say('You already have ' + MAX_KIDS + ' rosters. Remove one first, then open the link again.'); bannerText.textContent = status.textContent; return; }
        if (at < 0) { r.kids.push(newKid(shared.name)); at = r.kids.length - 1; }
        if (!r.kids[at].name) r.kids[at].name = shared.name;
        r.kids[at][shared.which] = shared.board; r.kid = at; r.active = shared.which;
        saveRosters();
        msg = 'Saved to your rosters.';
      }
      shared = null;
      try { window.sessionStorage.removeItem('pas-shared'); } catch (e) { /* nothing stored */ }
      if (window.history && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
      render();
      say(msg);
    };
    adopt.addEventListener('click', function () { leaveShared(true); });
    $('#board-mine').addEventListener('click', function () { leaveShared(false); });
    // ----- the week card: one picture of the roster, drawn here in the browser -----
    // Nothing is uploaded. An optional photo is read straight off the device, drawn onto the card, and never stored.
    var maker = $('#card-maker'), canvas = $('#card-canvas');
    var teacherBox = $('#card-teacher'), noteBox = $('#card-note'), photoBox = $('#card-photo'), photoClear = $('#card-photo-clear'), cardStatus = $('#card-status');
    var photo = null;
    var DISPLAY = '"Archivo", "Arial Black", Arial, sans-serif', BODY = '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif';
    var fit = function (ctx, text, max) {   // shorten with an ellipsis until it fits
      if (ctx.measureText(text).width <= max) return text;
      while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1);
      return text.replace(/[\s,;:(]+$/, '') + '…';
    };
    var box = function (ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    var drawCard = function () {
      if (!canvas || !canvas.getContext || shared) return;
      var r = loadRosters(), kid = r.kids[r.kid], which = r.active, b = kid[which];
      var ctx = canvas.getContext('2d'), W = 1080, H = 1350;
      var teacher = cleanName(kid.teacher), note = String(kid.cardNote || '').replace(/\s+/g, ' ').replace(/^ | $/g, '');
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0F4D90'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0A3566'; ctx.fillRect(0, H - 70, W, 70);
      // brand
      ctx.fillStyle = '#F3C613'; box(ctx, 56, 58, 54, 28, 8); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(70, 90, 7, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(98, 90, 7, 0, 7); ctx.fill();
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.font = '800 32px ' + DISPLAY; ctx.fillText('Philly After School', 126, 86);
      // photo
      var hasPhoto = !!photo, textMax = hasPhoto ? 720 : 968;
      if (hasPhoto) {
        var cx = 916, cy = 176, rad = 104;
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.closePath(); ctx.clip();
        var pw = photo.naturalWidth || photo.width, ph = photo.naturalHeight || photo.height, side = Math.min(pw, ph);
        ctx.drawImage(photo, (pw - side) / 2, (ph - side) / 2, side, side, cx - rad, cy - rad, rad * 2, rad * 2);
        ctx.restore();
        ctx.lineWidth = 8; ctx.strokeStyle = '#F3C613'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.stroke();
      }
      // title
      var title = (kid.name ? possessive(kid.name) : 'Our') + ' week', size = 92;
      do { ctx.font = '850 ' + size + 'px ' + DISPLAY; size -= 4; } while (ctx.measureText(title).width > textMax && size > 44);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(fit(ctx, title, textMax), 56, 196);
      ctx.font = '400 32px ' + BODY; ctx.fillStyle = '#CFE3FB';
      ctx.fillText(fit(ctx, 'After school' + (which === 'next' ? ', next term' : '') + (teacher ? '  ·  for ' + teacher : ''), textMax), 56, 248);
      // the five days
      var top = 300, bottom = note ? 1158 : 1262, gap = 12, rowH = (bottom - top - gap * 4) / 5;
      DAYS.forEach(function (day, i) {
        var y = top + i * (rowH + gap);
        ctx.fillStyle = '#FFFFFF'; box(ctx, 48, y, 984, rowH, 22); ctx.fill();
        ctx.fillStyle = '#F3C613'; box(ctx, 48, y, 150, rowH, 22); ctx.fill(); ctx.fillRect(170, y, 28, rowH);
        ctx.fillStyle = '#2A2100'; ctx.font = '800 44px ' + DISPLAY; ctx.textAlign = 'center';
        var picks = b.days[day[0]].map(lookup).filter(Boolean);
        ctx.fillText(day[2].toUpperCase(), 123, y + rowH / 2 + (picks.length > 2 ? 4 : 16));
        if (picks.length > 2) { ctx.font = '700 22px ' + BODY; ctx.fillText('+ ' + (picks.length - 2) + ' more', 123, y + rowH / 2 + 40); }
        ctx.textAlign = 'left';
        if (!picks.length) { ctx.fillStyle = '#7A8DA6'; ctx.font = '400 30px ' + BODY; ctx.fillText('No program', 232, y + rowH / 2 + 10); return; }
        var showN = Math.min(picks.length, 2), blockH = 74, startY = y + (rowH - showN * blockH) / 2;
        picks.slice(0, showN).forEach(function (k, j) {
          var by = startY + j * blockH, type = data.types[k.prog.type] || { color: '#0F4D90' };
          ctx.fillStyle = type.color; box(ctx, 222, by + 6, 10, blockH - 14, 5); ctx.fill();
          ctx.fillStyle = '#0B2140'; ctx.font = '750 34px ' + DISPLAY; ctx.fillText(fit(ctx, k.prog.name, 760), 248, by + 34);
          var bits = [k.note, k.prog.pickupBy ? 'pick up by ' + k.prog.pickupBy : '', k.link.where].filter(Boolean).join('  ·  ');
          ctx.fillStyle = '#4D607A'; ctx.font = '400 25px ' + BODY; ctx.fillText(fit(ctx, bits || pillText(k), 760), 248, by + 66);
        });
      });
      if (note) {
        ctx.fillStyle = '#0A3566'; box(ctx, 48, 1172, 984, 92, 22); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.font = '400 30px ' + BODY; ctx.fillText(fit(ctx, 'Note: ' + note, 930), 76, 1229);
      }
      ctx.fillStyle = '#CFE3FB'; ctx.font = '400 26px ' + BODY; ctx.fillText('Made at phillyafterschool.org', 56, H - 27);
    };
    var cardFile = function (done) {
      var name = (cleanName(activeKid().name) || 'our').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'our';
      canvas.toBlob(function (blob) { done(blob, name + '-week.png'); }, 'image/png');
    };
    if (maker && canvas && canvas.getContext && canvas.toBlob) {
      teacherBox.addEventListener('input', function () { activeKid().teacher = teacherBox.value.slice(0, 40); saveRosters(); drawCard(); });
      noteBox.addEventListener('input', function () { activeKid().cardNote = noteBox.value.slice(0, 110); saveRosters(); drawCard(); });
      photoBox.addEventListener('change', function () {
        var file = photoBox.files && photoBox.files[0];
        if (!file) return;
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); photo = img; photoClear.hidden = false; cardStatus.textContent = 'Photo added. It stays on this device.'; drawCard(); };
        img.onerror = function () { URL.revokeObjectURL(url); cardStatus.textContent = 'That file couldn’t be read as a picture. Try a JPG or PNG.'; };
        img.src = url;
      });
      photoClear.addEventListener('click', function () { photo = null; photoBox.value = ''; photoClear.hidden = true; cardStatus.textContent = 'Photo removed.'; drawCard(); });
      $('#card-save').addEventListener('click', function () {
        cardFile(function (blob, name) {
          var a = el('a'); a.href = URL.createObjectURL(blob); a.download = name;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
          cardStatus.textContent = 'Saved as ' + name + '. Attach it to an email or a text.';
          track_share('image_save');
        });
      });
      var shareCard = $('#card-share');
      if (navigator.share && navigator.canShare && window.File) {
        var probe = null;
        try { probe = new File([new Blob(['x'], { type: 'image/png' })], 'week.png', { type: 'image/png' }); } catch (e) { probe = null; }
        if (probe && navigator.canShare({ files: [probe] })) {
          shareCard.hidden = false;
          shareCard.addEventListener('click', function () {
            cardFile(function (blob, name) {
              var file = new File([blob], name, { type: 'image/png' });
              navigator.share({ files: [file], title: heading(activeKid().name, loadRosters().active) }).then(function () { track_share('image_share'); }, function () { /* closed without sharing */ });
            });
          });
        }
      }
      $('#card-print').addEventListener('click', function () {
        document.body.classList.add('print-card');
        var after = function () { document.body.classList.remove('print-card'); window.removeEventListener('afterprint', after); };
        window.addEventListener('afterprint', after);
        track_share('print');
        window.print();
      });
      if (document.fonts && document.fonts.load) {   // draw again once the site's fonts are ready
        Promise.all([document.fonts.load('850 92px Archivo'), document.fonts.load('400 30px "Atkinson Hyperlegible"')]).then(drawCard, function () { /* fall back to system fonts */ });
      }
    }

    Object.keys(data.programs).forEach(function (id) {   // suggestions for the class field
      if (!data.programs[id].offers.length) return;
      var dl = el('datalist'); dl.id = 'offers-' + id;
      data.programs[id].offers.forEach(function (o) { var opt = el('option'); opt.value = o; dl.appendChild(opt); });
      boardPage.appendChild(dl);
    });
    render();
    if (!shared && !storageOk) say(savedNote());
  }

  // ----- filters: one engine for every page that lists programs (school, A to Z, type, neighborhood) -----
  var fbar = document.querySelector('[data-filters]');
  if (fbar) {
    var fSchool = fbar.getAttribute('data-school') || '';
    var items = all(document, '[data-item]');
    var groups = all(document, '[data-group]');
    var fbtns = all(document, '[data-f]');
    var count = document.querySelector('#count'), clear = document.querySelector('#clear');
    var search = document.querySelector('#prog-search'), noMatch = document.querySelector('[data-nomatch]');
    var state = { type: 'ALL', grade: 'ALL', rel: 'ALL', hood: 'ALL', cost: 'ALL' };
    var terms = [];
    var findBtn = function (f, v) { for (var i = 0; i < fbtns.length; i++) if (fbtns[i].getAttribute('data-f') === f && fbtns[i].getAttribute('data-v') === v) return fbtns[i]; return null; };
    // Start from the page address (how the home page links in), then from the grade picked last time.
    var q0 = query();
    ['type', 'grade', 'rel', 'hood', 'cost'].forEach(function (f) { if (q0[f] && findBtn(f, q0[f])) state[f] = q0[f]; });
    if (!q0.grade) { var savedGrade = store('pas-grade'); if (savedGrade && findBtn('grade', savedGrade)) state.grade = savedGrade; }
    var gradeLabel = function (g) { return g === 'PK' ? 'Pre-K' : g === 'K' ? 'kindergarten' : 'grade ' + g; };
    var inList = function (el, attr, v) { return (' ' + (el.getAttribute(attr) || '') + ' ').indexOf(' ' + v + ' ') > -1; };
    var apply = function () {
      var total = 0;
      items.forEach(function (it) {
        var gs = it.getAttribute('data-grades') || '*';
        var ok = (state.grade === 'ALL' || gs === '*' || inList(it, 'data-grades', state.grade))
          && (state.type === 'ALL' || inList(it, 'data-types', state.type))
          && (state.rel === 'ALL' || it.getAttribute('data-rel') === state.rel)
          && (state.hood === 'ALL' || inList(it, 'data-hoods', state.hood))
          && (state.cost === 'ALL' || inList(it, 'data-cost', state.cost));
        if (ok && terms.length) { var hay = it.getAttribute('data-search') || ''; ok = terms.every(function (w) { return w.test(hay); }); }
        it.hidden = !ok;
        if (ok) total++;
      });
      groups.forEach(function (g) {
        var n = all(g, '[data-item]').filter(function (it) { return !it.hidden; }).length;
        g.hidden = n === 0;
        var badge = g.querySelector('.n');
        if (badge) badge.textContent = n;
      });
      var bits = [];
      ['type', 'rel', 'hood', 'cost'].forEach(function (f) {
        var b = state[f] !== 'ALL' ? findBtn(f, state[f]) : null;
        if (b) bits.push(f === 'hood' ? 'in ' + b.getAttribute('data-label') : f === 'cost' ? b.getAttribute('data-label').toLowerCase() : b.getAttribute('data-label'));
      });
      if (terms.length) bits.push('matching “' + search.value.trim() + '”');
      var what = (state.grade === 'ALL' ? '' : ' for ' + gradeLabel(state.grade)) + (bits.length ? ' (' + bits.join(', ') + ')' : '');
      var filtered = state.grade !== 'ALL' || bits.length > 0;
      count.textContent = total ? total + (total === 1 ? ' program' : ' programs') + (filtered ? what : fSchool ? ' for all grades' : '') : 'No programs' + what + '. Try fewer filters.';
      clear.hidden = !filtered;
      if (noMatch) noMatch.hidden = total > 0;
      fbtns.forEach(function (b) {
        var f = b.getAttribute('data-f'), v = b.getAttribute('data-v');
        b.setAttribute('aria-pressed', String(state[f] === v));
      });
      // keep the address in step, so a filtered list can be bookmarked or sent to someone
      if (window.history && history.replaceState) {
        var parts = [];
        ['type', 'grade', 'rel', 'hood', 'cost'].forEach(function (f) { if (state[f] !== 'ALL') parts.push(f + '=' + encodeURIComponent(state[f])); });
        try { history.replaceState(null, '', location.pathname + (parts.length ? '?' + parts.join('&') : '') + location.hash); } catch (e) { /* file preview */ }
      }
      return total;
    };
    var NAMES = { type: 'program_type', rel: 'relation', hood: 'neighborhood', grade: 'grade', cost: 'cost' };
    fbtns.forEach(function (b) {
      if (b.tagName !== 'BUTTON') return;
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-f'), v = b.getAttribute('data-v');
        state[f] = v;
        if (f === 'grade') store('pas-grade', v);
        apply();
        track({ event: 'pas_filter', filter_type: NAMES[f], filter_value: v, school: fSchool });
      });
    });
    clear.addEventListener('click', function () {
      state = { type: 'ALL', grade: 'ALL', rel: 'ALL', hood: 'ALL', cost: 'ALL' };
      terms = []; if (search) search.value = '';
      store('pas-grade', 'ALL');
      apply();
    });
    if (search) {
      var searchTimer = null;
      search.addEventListener('input', function () {
        terms = search.value.toLowerCase().split(/\s+/).filter(Boolean).map(function (w) {
          return new RegExp('(^|[^a-z0-9-])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));   // match from the start of a word
        });
        var found = apply();
        clearTimeout(searchTimer);   // report the search once typing pauses, not on every key
        var term = search.value.trim().toLowerCase();
        if (term.length >= 3) searchTimer = setTimeout(function () { track({ event: 'pas_search', search_term: term, results: found, school: fSchool }); }, 1200);
      });
    }
    apply();
    var pressedGrade = document.querySelector('.gbtn[aria-pressed="true"]');
    if (pressedGrade && pressedGrade.scrollIntoView && state.grade !== 'ALL') pressedGrade.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  // ----- school page: add to roster -----
  var page = document.querySelector('[data-school-page]');
  if (!page) return;
  var school = page.getAttribute('data-school-page');

  // Add to roster: pick the days for a program, for one child, on their current or upcoming roster, with an optional class.
  var refreshers = [];
  all(page, '.prog').forEach(function (card) {
    var toggle = card.querySelector('[data-board-toggle]');
    var panel = card.querySelector('.days');
    if (!toggle || !panel) return;
    var kidRow = panel.querySelector('.kid-row');
    var key = card.id + '.' + school;
    var pending = '';   // a class chosen before any day is picked
    var currentClass = function (b) {   // null: not on the roster. false: different classes on different days.
      var found = null;
      for (var i = 0; i < DAYS.length; i++) {
        var at = findEntry(b.days[DAYS[i][0]], key);
        if (at < 0) continue;
        var n = entryNote(b.days[DAYS[i][0]][at]);
        if (found === null) found = n; else if (found !== n) return false;
      }
      return found;
    };
    var show = function () {
      var r = loadRosters(), kid = r.kids[r.kid], b = kid[r.active], on = [];
      all(panel, '.day').forEach(function (btn) {
        var has = findEntry(b.days[btn.getAttribute('data-day')], key) > -1;
        btn.setAttribute('aria-pressed', String(has));
        if (has) on.push(btn.textContent);
      });
      var cls = currentClass(b);
      var mixed = cls === false;
      if (cls === null) cls = pending;
      if (mixed) cls = '';
      all(panel, '.cl').forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-class') === cls)); });
      all(panel, '.wb').forEach(function (w) { w.setAttribute('aria-pressed', String(w.getAttribute('data-board') === r.active)); });
      if (kidRow) {   // with more than one child, choose whose roster this goes on
        kidRow.textContent = '';
        kidRow.hidden = r.kids.length < 2;
        if (r.kids.length > 1) {
          kidRow.appendChild(el('span', 'hint', 'Whose roster?'));
          r.kids.forEach(function (k, i) {
            var btn = el('button', 'kd', kidLabel(k, i));
            btn.type = 'button';
            btn.setAttribute('data-kid', String(i));
            btn.setAttribute('aria-pressed', String(i === r.kid));
            kidRow.appendChild(btn);
          });
        }
      }
      var whose = r.kids.length > 1 ? possessive(kidLabel(kid, r.kid)) : kid.name ? possessive(kid.name) : 'your';
      toggle.textContent = on.length
        ? 'On ' + whose + ' ' + (r.active === 'next' ? 'upcoming' : 'current') + ' roster: ' + on.join(', ') + (mixed ? ' (different classes)' : cls ? ' (' + cls + ')' : '')
        : r.kids.length > 1 ? 'Add to ' + whose + ' roster' : 'Add to roster';
      toggle.className = 'btn needs-js' + (on.length ? ' on' : '');
    };
    refreshers.push(show);
    toggle.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
    });
    panel.addEventListener('click', function (e) {
      var target = e.target.closest ? e.target.closest('.day, .wb, .cl, .kd') : null;
      if (!target) return;
      var r = loadRosters(), b = activeBoard();
      if (target.className.indexOf('kd') > -1) {
        r.kid = Number(target.getAttribute('data-kid')) || 0;
        pending = '';
        saveRosters();
        refreshers.forEach(function (f) { f(); });
        var again = panel.querySelector('.kd[aria-pressed="true"]');   // the row was rebuilt: keep the keyboard where it was
        if (again) again.focus();
        return;
      }
      if (target.className.indexOf('wb') > -1) {
        r.active = target.getAttribute('data-board');
        saveRosters();
        refreshers.forEach(function (f) { f(); });
        return;
      }
      if (target.className.indexOf('cl') > -1) {   // set or clear the class on every day this program is on
        var had = currentClass(b);
        var chosen = target.getAttribute('data-class');
        pending = (had === null ? pending : had || '') === chosen ? '' : chosen;
        DAYS.forEach(function (d) { var at = findEntry(b.days[d[0]], key); if (at > -1) b.days[d[0]][at] = makeEntry(key, pending); });
        saveRosters();
        show();
        return;
      }
      var day = target.getAttribute('data-day'), i = findEntry(b.days[day], key);
      if (i > -1) b.days[day].splice(i, 1);
      else {
        var cls = currentClass(b);
        b.days[day].push(makeEntry(key, cls === null ? pending : cls || ''));
        track({ event: 'pas_board_add', program_id: card.id, school: school, day: day, board: r.active === 'next' ? 'upcoming' : 'current', children: r.kids.length });
      }
      saveRosters();
      show();
    });
    show();
  });
})();
