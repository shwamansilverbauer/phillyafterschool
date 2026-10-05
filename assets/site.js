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

  // ----- the weekly board: kept in this browser, shared by link -----
  var DAYS = [['mon', 'Monday', 'Mon'], ['tue', 'Tuesday', 'Tue'], ['wed', 'Wednesday', 'Wed'], ['thu', 'Thursday', 'Thu'], ['fri', 'Friday', 'Fri']];
  var current = null;
  function emptyBoard() { return { name: '', days: { mon: [], tue: [], wed: [], thu: [], fri: [] } }; }
  function cleanBoard(b) {
    var out = emptyBoard();
    if (b && typeof b === 'object') {
      if (typeof b.name === 'string') out.name = b.name.slice(0, 40);
      DAYS.forEach(function (day) {
        var a = b.days && b.days[day[0]];
        if (Array.isArray(a)) out.days[day[0]] = a.filter(function (x) { return typeof x === 'string' && /^[a-z0-9-]+\.[a-z0-9-]+$/.test(x); }).slice(0, 8);
      });
    }
    return out;
  }
  function loadBoard() {
    if (current) return current;
    var b = null;
    try { b = JSON.parse(store('pas-board') || 'null'); } catch (e) { b = null; }
    current = cleanBoard(b);
    return current;
  }
  function saveBoard(b) { current = b; store('pas-board', JSON.stringify(b)); updateCount(); }
  function updateCount() {
    var seen = {}, b = loadBoard();
    DAYS.forEach(function (day) { b.days[day[0]].forEach(function (k) { seen[k] = 1; }); });
    var n = Object.keys(seen).length;
    all(document, '[data-board-count]').forEach(function (c) { c.textContent = n ? String(n) : ''; c.hidden = !n; });
  }
  updateCount();

  var boardPage = document.querySelector('[data-board-page]');
  if (boardPage) {
    var data = JSON.parse(document.getElementById('pas-data').textContent);
    var week = boardPage.querySelector('#week');
    var nameInput = boardPage.querySelector('#board-name');
    var status = boardPage.querySelector('#board-status');
    var tools = boardPage.querySelector('#board-tools');
    var banner = boardPage.querySelector('#board-shared');
    var emptyNote = boardPage.querySelector('#board-empty');
    var linkBox = boardPage.querySelector('#board-link');
    var title = boardPage.querySelector('#board-title');

    var encode = function (b) {
      var parts = [];
      if (b.name) parts.push('n=' + encodeURIComponent(b.name));
      DAYS.forEach(function (day) { if (b.days[day[0]].length) parts.push(day[0] + '=' + b.days[day[0]].join(',')); });
      return parts.join('&');
    };
    var decode = function (hash) {
      var b = emptyBoard(), any = false;
      hash.replace(/^#/, '').split('&').forEach(function (p) {
        var i = p.indexOf('=');
        if (i < 0) return;
        var k = p.slice(0, i), v = p.slice(i + 1);
        if (k === 'n') { try { b.name = decodeURIComponent(v); } catch (e) { /* ignore */ } }
        else if (b.days[k]) { b.days[k] = v.split(','); any = true; }
      });
      return any ? cleanBoard(b) : null;
    };
    var shared = decode(location.hash);
    var lookup = function (key) {
      var p = key.split('.'), prog = data.programs[p[0]], sch = data.schools[p[1]];
      return prog && sch && prog.schools[p[1]] ? { id: p[0], prog: prog, sch: sch, link: prog.schools[p[1]] } : null;
    };
    var pillText = function (k) {
      return k.link.rel === 'onsite' ? 'At ' + k.sch.name : k.link.rel === 'pickup' ? k.sch.name + ' pickup' : 'Near ' + k.sch.name;
    };
    var shareUrl = function () { return location.href.split('#')[0] + '#' + encode(loadBoard()); };
    var asText = function (b) {
      var lines = [(b.name || 'After-school week') + ' (Philly After School)'];
      DAYS.forEach(function (day) {
        var picks = b.days[day[0]].map(lookup).filter(Boolean).map(function (k) { return k.prog.name + (k.link.where ? ' (' + k.link.where + ')' : ''); });
        if (picks.length) lines.push(day[2] + ': ' + picks.join('; '));
      });
      return lines.join('\n');
    };
    var say = function (msg) { status.textContent = msg; };
    var copy = function (text, done) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { say(done); }, function () { linkBox.focus(); linkBox.select(); say('Copy it from the box below.'); });
      } else { linkBox.focus(); linkBox.select(); say('Copy it from the box below.'); }
    };

    var render = function () {
      var b = shared || loadBoard();
      var total = 0;
      week.textContent = '';
      DAYS.forEach(function (day) {
        var col = el('section', 'daycol');
        col.appendChild(el('h2', null, day[1]));
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
          if (k.link.where) li.appendChild(el('span', 'hint', k.link.where));
          li.appendChild(el('span', 'hint', k.prog.hours));
          if (!shared) {
            var rm = el('button', 'clear', 'Remove');
            rm.type = 'button';
            rm.addEventListener('click', function () {
              var mine = loadBoard(), i = mine.days[day[0]].indexOf(key);
              if (i > -1) mine.days[day[0]].splice(i, 1);
              saveBoard(mine); say(''); render();
            });
            li.appendChild(rm);
          }
          list.appendChild(li);
        });
        col.appendChild(n ? list : el('p', 'hint', 'Nothing yet.'));
        week.appendChild(col);
      });
      banner.hidden = !shared;
      tools.hidden = !!shared || total === 0;
      emptyNote.hidden = !!shared || total > 0;
      title.textContent = shared ? (b.name || 'A shared week') : (b.name || 'Your week');
      if (!shared) { linkBox.value = shareUrl(); if (document.activeElement !== nameInput) nameInput.value = b.name; }
    };

    nameInput.addEventListener('input', function () { var b = loadBoard(); b.name = nameInput.value.slice(0, 40); saveBoard(b); render(); });
    boardPage.querySelector('#board-copy-link').addEventListener('click', function () { copy(shareUrl(), 'Link copied. Paste it into a text or email.'); track({ event: 'pas_board_share', method: 'copy_link' }); });
    boardPage.querySelector('#board-copy-text').addEventListener('click', function () { copy(asText(loadBoard()) + '\n' + shareUrl(), 'Copied as text, with the link.'); track({ event: 'pas_board_share', method: 'copy_text' }); });
    var shareBtn = boardPage.querySelector('#board-share');
    if (navigator.share) {
      shareBtn.hidden = false;
      shareBtn.addEventListener('click', function () {
        var b = loadBoard();
        navigator.share({ title: b.name || 'After-school week', text: asText(b), url: shareUrl() }).then(function () { track({ event: 'pas_board_share', method: 'share_sheet' }); }, function () { /* closed without sharing */ });
      });
    }
    boardPage.querySelector('#board-clear').addEventListener('click', function () { saveBoard(emptyBoard()); say('Board cleared.'); render(); });
    var leaveShared = function (keep) {
      if (keep) saveBoard(shared);
      shared = null;
      if (window.history && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
      render();
    };
    boardPage.querySelector('#board-adopt').addEventListener('click', function () { leaveShared(true); say('Saved as your board.'); });
    boardPage.querySelector('#board-mine').addEventListener('click', function () { leaveShared(false); });
    render();
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
        card.hidden = !(okGrade && okRel);
        if (okGrade && okRel) n++;
      });
      sec.hidden = n === 0;
      sec.querySelector('.n').textContent = n;
      total += n;
    });
    count.textContent = total
      ? total + (total === 1 ? ' program' : ' programs') + ' for ' + gradeLabel(grade)
      : 'Nothing for ' + gradeLabel(grade) + ' with this filter. Try another type.';
    clear.hidden = grade === 'ALL' && rel === 'ALL';
    gbtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-g') === grade)); });
    tbtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-t') === rel)); });
  }

  gbtns.forEach(function (b) {
    b.addEventListener('click', function () { grade = b.getAttribute('data-g'); store('pas-grade', grade); apply(); track({ event: 'pas_filter', filter_type: 'grade', filter_value: grade, school: school }); });
  });
  tbtns.forEach(function (b) {
    b.addEventListener('click', function () { rel = b.getAttribute('data-t'); apply(); track({ event: 'pas_filter', filter_type: 'type', filter_value: rel, school: school }); });
  });
  clear.addEventListener('click', function () { grade = 'ALL'; rel = 'ALL'; store('pas-grade', 'ALL'); apply(); });
  apply();
  var pressed = page.querySelector('.gbtn[aria-pressed="true"]');
  if (pressed && pressed.scrollIntoView && grade !== 'ALL') pressed.scrollIntoView({ block: 'nearest', inline: 'center' });

  // Add to board: pick the days for a program.
  all(page, '.prog').forEach(function (card) {
    var toggle = card.querySelector('[data-board-toggle]');
    var panel = card.querySelector('.days');
    if (!toggle || !panel) return;
    var key = card.id + '.' + school;
    var show = function () {
      var b = loadBoard(), on = [];
      all(panel, '.day').forEach(function (btn) {
        var has = b.days[btn.getAttribute('data-day')].indexOf(key) > -1;
        btn.setAttribute('aria-pressed', String(has));
        if (has) on.push(btn.textContent);
      });
      toggle.textContent = on.length ? 'On your board: ' + on.join(', ') : 'Add to board';
      toggle.className = 'btn needs-js' + (on.length ? ' on' : '');
    };
    toggle.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
    });
    panel.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.day') : null;
      if (!btn) return;
      var day = btn.getAttribute('data-day'), b = loadBoard(), i = b.days[day].indexOf(key);
      if (i > -1) b.days[day].splice(i, 1);
      else { b.days[day].push(key); track({ event: 'pas_board_add', program_id: card.id, school: school, day: day }); }
      saveBoard(b);
      show();
    });
    show();
  });
})();
