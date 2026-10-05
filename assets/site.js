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

  // ----- all programs, A to Z: find one by name or by what it teaches -----
  var findProg = document.querySelector('#find-program');
  if (findProg) {
    var prows = all(document, '.prow');
    var noProg = document.querySelector('#no-program');
    findProg.addEventListener('input', function () {
      var words = findProg.value.toLowerCase().split(/\s+/).filter(Boolean).map(function (w) {
        return new RegExp('(^|[^a-z0-9-])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      });
      var shown = 0;
      prows.forEach(function (r) {
        var hay = r.getAttribute('data-search') || '';
        var ok = words.every(function (w) { return w.test(hay); });
        r.hidden = !ok;
        if (ok) shown++;
      });
      noProg.hidden = shown > 0;
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
  function newKid(name) { return { name: cleanName(name), now: emptyBoard(), next: emptyBoard() }; }
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
      rosters = { kid: 0, active: raw.active === 'next' ? 'next' : 'now', kids: raw.kids.slice(0, MAX_KIDS).map(function (k) {
        k = k && typeof k === 'object' ? k : {};
        return { name: cleanName(k.name), now: cleanBoard(k.now), next: cleanBoard(k.next) };
      }) };
      if (typeof raw.kid === 'number' && raw.kid % 1 === 0 && raw.kid >= 0 && raw.kid < rosters.kids.length) rosters.kid = raw.kid;
    } else {
      // Carry over a board saved before each child had their own roster: it becomes the first child's.
      var old = parse('pas-boards') || { active: 'now', now: parse('pas-board'), next: null };
      var name = (old.now && old.now.name) || (old.next && old.next.name) || '';
      var kid = newKid(String(name).replace(/[’']s (week|board|roster)$/i, ''));
      kid.now = cleanBoard(old.now); kid.next = cleanBoard(old.next);
      rosters = { kid: 0, active: old.active === 'next' ? 'next' : 'now', kids: [kid] };
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
        chip.addEventListener('click', function () { r.kid = i; saveRosters(); say(''); render(); });
        kidTabs.appendChild(chip);
      });
      kidAdd.hidden = r.kids.length >= MAX_KIDS;
      kidRemove.hidden = r.kids.length < 2;
      kidRemove.textContent = 'Remove ' + (kid.name ? possessive(kid.name) + ' rosters' : 'this child');
      kidRemove.removeAttribute('data-armed');
      title.textContent = (kid.name ? possessive(kid.name) : 'Your') + (which === 'next' ? ' upcoming week' : ' current week');
      emptyText.textContent = which === 'next'
        ? 'Nothing planned for the upcoming term yet. On any program, choose “Add to roster”, switch it to Upcoming, and pick the days.'
        : 'Open a school’s page and choose “Add to roster” on any program. Pick the days, and it shows up here.';
      linkBox.value = shareUrl();
      emailLink.href = 'mailto:?subject=' + encodeURIComponent(heading(kid.name, which)) + '&body=' + encodeURIComponent(asText(kid.name, b, which) + '\n\n' + shareUrl());
      if (document.activeElement !== nameInput) nameInput.value = kid.name;
    };

    all(tabs, '.tab').forEach(function (t) {
      t.addEventListener('click', function () { loadRosters().active = t.getAttribute('data-board'); saveRosters(); say(''); render(); });
    });
    nameInput.addEventListener('input', function () { activeKid().name = nameInput.value.replace(/\s+/g, ' ').slice(0, 40); saveRosters(); say(savedNote()); render(); });
    nameInput.addEventListener('blur', function () { var k = activeKid(); if (k.name !== cleanName(k.name)) { k.name = cleanName(k.name); saveRosters(); render(); } });
    kidAdd.addEventListener('click', function () {
      var r = loadRosters();
      if (r.kids.length >= MAX_KIDS) return;
      r.kids.push(newKid('')); r.kid = r.kids.length - 1; r.active = 'now';
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
    Object.keys(data.programs).forEach(function (id) {   // suggestions for the class field
      if (!data.programs[id].offers.length) return;
      var dl = el('datalist'); dl.id = 'offers-' + id;
      data.programs[id].offers.forEach(function (o) { var opt = el('option'); opt.value = o; dl.appendChild(opt); });
      boardPage.appendChild(dl);
    });
    render();
    if (!shared && !storageOk) say(savedNote());
  }

  // ----- school page: grade and type filter, search, add to roster -----
  var page = document.querySelector('[data-school-page]');
  if (!page) return;
  var school = page.getAttribute('data-school-page');
  var grade = 'ALL', rel = 'ALL';
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
    gbtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-g') === grade)); });
    tbtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-t') === rel)); });
    return total;
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
