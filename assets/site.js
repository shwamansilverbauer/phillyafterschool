// Small enhancements. Every page reads fine without JavaScript; this adds the school search,
// the grade/type filter, the weekly board, and a few form conveniences.
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
    sync();
    form.addEventListener('submit', function () {
      var key = kindKey();
      track({ event: 'pas_suggest_submit', suggest_kind: key, school: key === 'school' ? 'new school' : form.querySelector('#f-school').value });
    });
  }

  // ----- review form: arrive with the program and school already chosen -----
  var review = document.querySelector('#review-form');
  if (review) {
    var qs = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (p) {
      var i = p.indexOf('=');
      if (i > 0) { try { qs[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); } catch (e) { /* ignore */ } }
    });
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

  // ----- home page: find your school -----
  var find = document.querySelector('#find-school');
  if (find) {
    var rows = all(document, '.school');
    var none = document.querySelector('#no-school');
    find.addEventListener('input', function () {
      var q = find.value.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (r) {
        var ok = !q || r.getAttribute('data-name').indexOf(q) > -1;
        r.hidden = !ok;
        if (ok) shown++;
      });
      none.hidden = shown > 0;
    });
  }

  // ----- weekly boards: a current one and an upcoming one, kept in this browser, shared by link -----
  var DAYS = [['mon', 'Monday', 'Mon'], ['tue', 'Tuesday', 'Tue'], ['wed', 'Wednesday', 'Wed'], ['thu', 'Thursday', 'Thu'], ['fri', 'Friday', 'Fri']];
  var boards = null;
  var storageOk = true;
  try { window.localStorage.setItem('pas-test', '1'); window.localStorage.removeItem('pas-test'); } catch (e) { storageOk = false; }
  function emptyBoard() { return { name: '', days: { mon: [], tue: [], wed: [], thu: [], fri: [] } }; }
  function cleanBoard(b) {
    var out = emptyBoard();
    if (b && typeof b === 'object') {
      if (typeof b.name === 'string') out.name = b.name.slice(0, 40);
      DAYS.forEach(function (day) {
        var a = b.days && b.days[day[0]];
        if (Array.isArray(a)) out.days[day[0]] = a.filter(function (x) { return typeof x === 'string' && /^[a-z0-9-]+\.[a-z0-9-]+(~[^~,&=#]{1,40})?$/.test(x); }).slice(0, 8);
      });
    }
    return out;
  }
  // A pick is "program.school", optionally followed by "~" and a class or short note.
  function entryKey(e) { var i = e.indexOf('~'); return i < 0 ? e : e.slice(0, i); }
  function entryNote(e) { var i = e.indexOf('~'); return i < 0 ? '' : e.slice(i + 1); }
  function cleanNote(s) { return String(s || '').replace(/[~,&=#\r\n]/g, ' ').replace(/\s+/g, ' ').replace(/^ | $/g, '').slice(0, 40); }
  function makeEntry(key, note) { note = cleanNote(note); return note ? key + '~' + note : key; }
  function findEntry(list, key) { for (var i = 0; i < list.length; i++) if (entryKey(list[i]) === key) return i; return -1; }
  function parse(key) { try { return JSON.parse(store(key) || 'null'); } catch (e) { return null; } }
  function loadBoards() {
    if (boards) return boards;
    var raw = parse('pas-boards');
    if (!raw) raw = { active: 'now', now: parse('pas-board'), next: null };  // carry over a board made before there were two
    boards = { active: raw.active === 'next' ? 'next' : 'now', now: cleanBoard(raw.now), next: cleanBoard(raw.next) };
    return boards;
  }
  function saveBoards() { store('pas-boards', JSON.stringify(boards)); updateCount(); }
  function activeBoard() { var bs = loadBoards(); return bs[bs.active]; }
  function countPicks(b) {
    var seen = {};
    DAYS.forEach(function (day) { b.days[day[0]].forEach(function (k) { seen[entryKey(k)] = 1; }); });
    return Object.keys(seen).length;
  }
  function updateCount() {
    var bs = loadBoards(), n = countPicks(bs.now) + countPicks(bs.next);
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
    var WHICH = { now: 'current', next: 'upcoming' };

    var encode = function (b, which) {
      var parts = [];
      if (which === 'next') parts.push('b=next');
      if (b.name) parts.push('n=' + encodeURIComponent(b.name));
      DAYS.forEach(function (day) {
        if (b.days[day[0]].length) parts.push(day[0] + '=' + b.days[day[0]].map(function (e) { var n = entryNote(e); return entryKey(e) + (n ? '~' + encodeURIComponent(n) : ''); }).join(','));
      });
      return parts.join('&');
    };
    var decode = function (hash) {
      var b = emptyBoard(), any = false, which = 'now';
      hash.replace(/^#/, '').split('&').forEach(function (p) {
        var i = p.indexOf('=');
        if (i < 0) return;
        var k = p.slice(0, i), v = p.slice(i + 1);
        if (k === 'n') { try { b.name = decodeURIComponent(v); } catch (e) { /* ignore */ } }
        else if (k === 'b') { which = v === 'next' ? 'next' : 'now'; }
        else if (b.days[k]) {
          b.days[k] = v.split(',').map(function (e) { var n = entryNote(e); try { n = decodeURIComponent(n); } catch (err) { n = ''; } return makeEntry(entryKey(e), n); });
          any = true;
        }
      });
      return any ? { which: which, board: cleanBoard(b) } : null;
    };
    var shared = decode(location.hash);
    var lookup = function (entry) {
      var p = entryKey(entry).split('.'), prog = data.programs[p[0]], sch = data.schools[p[1]];
      return prog && sch && prog.schools[p[1]] ? { id: p[0], prog: prog, sch: sch, link: prog.schools[p[1]], note: entryNote(entry) } : null;
    };
    var pillText = function (k) {
      return k.link.rel === 'onsite' ? 'At ' + k.sch.name : k.link.rel === 'pickup' ? k.sch.name + ' pickup' : 'Near ' + k.sch.name;
    };
    var shareUrl = function () { var bs = loadBoards(); return location.href.split('#')[0] + '#' + encode(bs[bs.active], bs.active); };
    var heading = function (b, which) { return (b.name || 'After-school week') + (which === 'next' ? ' (upcoming)' : ''); };
    var asText = function (b, which) {
      var lines = [heading(b, which) + ', from Philly After School'];
      DAYS.forEach(function (day) {
        var picks = b.days[day[0]].map(lookup).filter(Boolean).map(function (k) {
          return k.prog.name + (k.note ? ': ' + k.note : '') + (k.link.where ? ' (' + k.link.where + ')' : '') + (k.prog.pickupBy ? ', pick up by ' + k.prog.pickupBy : '');
        });
        if (picks.length) lines.push(day[2] + ': ' + picks.join('; '));
      });
      return lines.join('\n');
    };
    var say = function (msg) { status.textContent = msg; };
    var savedNote = function () { return storageOk ? 'Saved on this device.' : 'Your browser is blocking saved data, so this board will be gone when you close the page. Keep the link.'; };
    var copy = function (text, done) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { say(done); }, function () { linkBox.focus(); linkBox.select(); say('Copy it from the box below.'); });
      } else { linkBox.focus(); linkBox.select(); say('Copy it from the box below.'); }
    };

    var render = function () {
      var bs = loadBoards();
      var which = shared ? shared.which : bs.active;
      var b = shared ? shared.board : bs[which];
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
          var li = el('li', 'pick');
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
              if (i > -1) { mine.days[day[0]][i] = makeEntry(entryKey(key), note.value); saveBoards(); say(savedNote()); render(); }
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
              saveBoards(); say(savedNote()); render();
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
      tools.hidden = !!shared || total === 0;
      emptyNote.hidden = !!shared || total > 0;
      promote.hidden = !!shared || which !== 'next' || total === 0;
      promote.textContent = 'The new term has started: make this my current board';
      promote.removeAttribute('data-armed');
      all(tabs, '.tab').forEach(function (t) { t.setAttribute('aria-pressed', String(t.getAttribute('data-board') === which)); });
      if (shared) {
        title.textContent = (b.name || 'A shared week') + (which === 'next' ? ' (upcoming)' : '');
        bannerText.textContent = which === 'next' ? 'This is what they have planned for the upcoming term. It isn’t saved on your device yet.' : 'This is what they’re doing now. It isn’t saved on your device yet.';
      } else {
        title.textContent = b.name || (which === 'next' ? 'Your upcoming week' : 'Your current week');
        emptyText.textContent = which === 'next'
          ? 'Nothing planned for the upcoming term yet. On any program, choose “Add to board”, switch it to Upcoming, and pick the days.'
          : 'Open a school’s page and choose “Add to board” on any program. Pick the days, and it shows up here.';
        linkBox.value = shareUrl();
        emailLink.href = 'mailto:?subject=' + encodeURIComponent(heading(b, which)) + '&body=' + encodeURIComponent(asText(b, which) + '\n\n' + shareUrl());
        if (document.activeElement !== nameInput) nameInput.value = b.name;
      }
    };

    all(tabs, '.tab').forEach(function (t) {
      t.addEventListener('click', function () { loadBoards().active = t.getAttribute('data-board'); saveBoards(); say(''); render(); });
    });
    nameInput.addEventListener('input', function () { activeBoard().name = nameInput.value.slice(0, 40); saveBoards(); say(savedNote()); render(); });
    $('#board-copy-link').addEventListener('click', function () { copy(shareUrl(), 'Link copied. Paste it into a text or email.'); track({ event: 'pas_board_share', method: 'copy_link', board: WHICH[loadBoards().active] }); });
    $('#board-copy-text').addEventListener('click', function () { var bs = loadBoards(); copy(asText(bs[bs.active], bs.active) + '\n' + shareUrl(), 'Copied as text, with the link.'); track({ event: 'pas_board_share', method: 'copy_text', board: WHICH[bs.active] }); });
    emailLink.addEventListener('click', function () { track({ event: 'pas_board_share', method: 'email_self', board: WHICH[loadBoards().active] }); });
    var shareBtn = $('#board-share');
    if (navigator.share) {
      shareBtn.hidden = false;
      shareBtn.addEventListener('click', function () {
        var bs = loadBoards(), b = bs[bs.active];
        navigator.share({ title: heading(b, bs.active), text: asText(b, bs.active), url: shareUrl() }).then(function () { track({ event: 'pas_board_share', method: 'share_sheet', board: WHICH[bs.active] }); }, function () { /* closed without sharing */ });
      });
    }
    $('#board-clear').addEventListener('click', function () { var bs = loadBoards(); bs[bs.active] = emptyBoard(); saveBoards(); say('Board cleared.'); render(); });
    promote.addEventListener('click', function () {
      if (!promote.getAttribute('data-armed')) {   // two taps, because it replaces the current board
        promote.setAttribute('data-armed', '1');
        promote.textContent = 'Tap again to replace your current board with this one';
        return;
      }
      var bs = loadBoards();
      bs.now = bs.next; bs.next = emptyBoard(); bs.active = 'now';
      saveBoards(); say('Done. This is now your current board.'); render();
    });
    var leaveShared = function (keep) {
      if (keep) { var bs = loadBoards(); bs[shared.which] = shared.board; bs.active = shared.which; saveBoards(); }
      shared = null;
      if (window.history && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
      render();
    };
    $('#board-adopt').addEventListener('click', function () { leaveShared(true); say('Saved as your board.'); });
    $('#board-mine').addEventListener('click', function () { leaveShared(false); });
    Object.keys(data.programs).forEach(function (id) {   // suggestions for the class field
      if (!data.programs[id].offers.length) return;
      var dl = el('datalist'); dl.id = 'offers-' + id;
      data.programs[id].offers.forEach(function (o) { var opt = el('option'); opt.value = o; dl.appendChild(opt); });
      boardPage.appendChild(dl);
    });
    render();
    if (!shared && !storageOk) say(savedNote());
  }

  // ----- school page: grade and type filter, add-to-board -----
  var page = document.querySelector('[data-school-page]');
  if (!page) return;
  var school = page.getAttribute('data-school-page');
  var grade = 'ALL', rel = 'ALL';
  page.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-track]') : null;
    if (!a) return;
    var card = a.closest('.prog');
    track({ event: 'pas_outbound', link_type: a.getAttribute('data-track'), program_id: card ? card.id : '', school: school });
  });
  var groups = all(page, '.group');
  var gbtns = all(page, '.gbtn');
  var tbtns = all(page, '.tbtn');
  var count = page.querySelector('#count');
  var clear = page.querySelector('#clear');
  var search = page.querySelector('#prog-search');
  var noMatch = page.querySelector('#no-match');
  var terms = [];

  var saved = store('pas-grade');
  if (saved && gbtns.some(function (b) { return b.getAttribute('data-g') === saved; })) grade = saved;

  function gradeLabel(g) {
    if (g === 'ALL') return 'all grades';
    if (g === 'PK') return 'Pre-K';
    if (g === 'K') return 'kindergarten';
    return 'grade ' + g;
  }

  function apply() {
    var total = 0;
    groups.forEach(function (sec) {
      var n = 0;
      all(sec, '.prog').forEach(function (card) {
        var gs = card.getAttribute('data-grades');
        var okGrade = grade === 'ALL' || gs === '*' || gs.split(' ').indexOf(grade) > -1;
        var okRel = rel === 'ALL' || card.getAttribute('data-rel') === rel;
        var hay = card.getAttribute('data-search') || '';
        var okText = terms.every(function (w) { return w.test(hay); });
        card.hidden = !(okGrade && okRel && okText);
        if (okGrade && okRel && okText) n++;
      });
      sec.hidden = n === 0;
      sec.querySelector('.n').textContent = n;
      total += n;
    });
    var q = terms.length ? ' matching “' + search.value.trim() + '”' : '';
    count.textContent = total
      ? total + (total === 1 ? ' program' : ' programs') + ' for ' + gradeLabel(grade) + q
      : 'Nothing for ' + gradeLabel(grade) + q + '. Try a different search or filter.';
    clear.hidden = grade === 'ALL' && rel === 'ALL' && !terms.length;
    noMatch.hidden = total > 0 || !terms.length;
    return total;
    gbtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-g') === grade)); });
    tbtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-t') === rel)); });
  }

  gbtns.forEach(function (b) {
    b.addEventListener('click', function () { grade = b.getAttribute('data-g'); store('pas-grade', grade); apply(); track({ event: 'pas_filter', filter_type: 'grade', filter_value: grade, school: school }); });
  });
  tbtns.forEach(function (b) {
    b.addEventListener('click', function () { rel = b.getAttribute('data-t'); apply(); track({ event: 'pas_filter', filter_type: 'type', filter_value: rel, school: school }); });
  });
  clear.addEventListener('click', function () { grade = 'ALL'; rel = 'ALL'; terms = []; search.value = ''; store('pas-grade', 'ALL'); apply(); });
  var searchTimer = null;
  search.addEventListener('input', function () {
    terms = search.value.toLowerCase().split(/\s+/).filter(Boolean).map(function (w) {
      return new RegExp('(^|[^a-z0-9-])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));   // match from the start of a word
    });
    var found = apply();
    clearTimeout(searchTimer);   // report the search once typing pauses, not on every key
    var term = search.value.trim().toLowerCase();
    if (term.length >= 3) searchTimer = setTimeout(function () { track({ event: 'pas_search', search_term: term, results: found, school: school }); }, 1200);
  });
  apply();
  var pressed = page.querySelector('.gbtn[aria-pressed="true"]');
  if (pressed && pressed.scrollIntoView && grade !== 'ALL') pressed.scrollIntoView({ block: 'nearest', inline: 'center' });

  // Add to board: pick the days for a program, on the current or the upcoming board, with an optional class.
  var refreshers = [];
  all(page, '.prog').forEach(function (card) {
    var toggle = card.querySelector('[data-board-toggle]');
    var panel = card.querySelector('.days');
    if (!toggle || !panel) return;
    var key = card.id + '.' + school;
    var pending = '';   // a class chosen before any day is picked
    var currentClass = function (b) {   // null: not on the board. false: different classes on different days.
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
      var bs = loadBoards(), b = bs[bs.active], on = [];
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
      all(panel, '.wb').forEach(function (w) { w.setAttribute('aria-pressed', String(w.getAttribute('data-board') === bs.active)); });
      toggle.textContent = on.length ? 'On your ' + (bs.active === 'next' ? 'upcoming' : 'current') + ' board: ' + on.join(', ') + (mixed ? ' (different classes)' : cls ? ' (' + cls + ')' : '') : 'Add to board';
      toggle.className = 'btn needs-js' + (on.length ? ' on' : '');
    };
    refreshers.push(show);
    toggle.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
    });
    panel.addEventListener('click', function (e) {
      var target = e.target.closest ? e.target.closest('.day, .wb, .cl') : null;
      if (!target) return;
      var bs = loadBoards(), b = bs[bs.active];
      if (target.className.indexOf('wb') > -1) {
        bs.active = target.getAttribute('data-board');
        saveBoards();
        refreshers.forEach(function (f) { f(); });
        return;
      }
      if (target.className.indexOf('cl') > -1) {   // set or clear the class on every day this program is on
        var had = currentClass(b);
        var chosen = target.getAttribute('data-class');
        pending = (had === null ? pending : had || '') === chosen ? '' : chosen;
        DAYS.forEach(function (d) { var at = findEntry(b.days[d[0]], key); if (at > -1) b.days[d[0]][at] = makeEntry(key, pending); });
        saveBoards();
        show();
        return;
      }
      var day = target.getAttribute('data-day'), i = findEntry(b.days[day], key);
      if (i > -1) b.days[day].splice(i, 1);
      else {
        var cls = currentClass(b);
        b.days[day].push(makeEntry(key, cls === null ? pending : cls || ''));
        track({ event: 'pas_board_add', program_id: card.id, school: school, day: day, board: bs.active === 'next' ? 'upcoming' : 'current' });
      }
      saveBoards();
      show();
    });
    show();
  });
})();
