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

  // Copy a canvas to the clipboard as one PNG, with a line saying where to make one.
  // Safari can hold the picture and the line as two things, so both paste into a message. Chrome holds one thing:
  // there the line rides along as rich text, which mail and documents paste under the picture, and a chat app
  // that takes only the picture still gets the picture.
  function copyCanvas(canvas, line, done) {
    var CI = window.ClipboardItem;
    var blobLater = new Promise(function (resolve, reject) { canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('no picture')); }, 'image/png'); });
    var together = function () {
      var site = line.replace(/^.* at /, ''), html = '<img src="' + canvas.toDataURL('image/png') + '" alt=""><p>' + line.replace(site, '<a href="https://' + site + '">' + site + '</a>') + '</p>';
      return blobLater.then(function (b) { return navigator.clipboard.write([new CI({ 'image/png': b, 'text/html': new Blob([html], { type: 'text/html' }) })]); })
        .catch(function () { return blobLater.then(function (b) { return navigator.clipboard.write([new CI({ 'image/png': b })]); }); });
    };
    var write;
    try { write = navigator.clipboard.write([new CI({ 'image/png': blobLater }), new CI({ 'text/plain': Promise.resolve(new Blob([line], { type: 'text/plain' })) })]).catch(together); }
    catch (e) { write = together(); }
    write.then(function () { done(true); }, function () { done(false); });
  }
  var canCopyPicture = !!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);

  // ----- "my school": saved on this device, no account. The home page, lists and roster start from it. -----
  function mySchool() {
    try { var m = JSON.parse(store('pas-my-school') || 'null'); return m && /^[a-z0-9-]+$/.test(m.id || '') && typeof m.name === 'string' ? { id: m.id, name: m.name.slice(0, 60) } : null; } catch (e) { return null; }
  }
  // ----- the days a program runs: null when it doesn't say, otherwise whether that day is one of them -----
  var DAY_FULL = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };
  function daysFor(days, offerDays, cls) { return (cls && offerDays && offerDays[cls]) || days || null; }
  function sayDays(list) {
    var n = list.map(function (d) { return DAY_FULL[d]; });
    return n.length < 3 ? n.join(' and ') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  }
  // "Not listed for Thursdays. It runs Tuesday and Wednesday." for the days in `picked` that the listing doesn't show.
  function dayWarning(days, offerDays, cls, picked, brief) {
    var runs = daysFor(days, offerDays, cls);
    if (!runs) return '';
    var off = picked.filter(function (d) { return runs.indexOf(d) < 0; });
    if (!off.length) return '';
    if (brief) return 'Not listed for ' + DAY_FULL[off[0]] + 's. Runs ' + runs.map(function (d) { return DAY_FULL[d].slice(0, 3); }).join(', ') + '.';
    return 'Not listed for ' + off.map(function (d) { return DAY_FULL[d] + 's'; }).join(' or ') + '. ' + (cls && offerDays && offerDays[cls] ? cls : 'It') + ' runs ' + sayDays(runs) + ', so check with the program.';
  }

  // Days off that have passed since the site was last built are hidden, and the "next day off" line is filled in.
  (function () {
    var now = new Date(), today = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
    var firstOff = null;
    all(document, '[data-until]').forEach(function (d) { if (d.getAttribute('data-until') < today) d.hidden = true; else if (!firstOff) firstOff = d; });
    if (firstOff && firstOff.tagName === 'DETAILS' && !/^#d-/.test(location.hash)) firstOff.open = true;
    var asked = /^#d-/.test(location.hash) ? document.getElementById(location.hash.slice(1)) : null;
    if (asked && asked.tagName === 'DETAILS') asked.open = true;
    all(document, '[data-next-off]').forEach(function (b) {
      var list; try { list = JSON.parse(b.getAttribute('data-next-off')); } catch (e) { return; }
      var next = null;
      list.forEach(function (d) { if (!next && d.u >= today) next = d; });
      if (!next) return;
      b.textContent = 'Next day off: ' + next.w + ' (' + next.n + ').' + (next.c ? ' ' + next.c + (next.c === 1 ? ' listed program has' : ' listed programs have') + ' a camp posted.' : '');
      b.hidden = false;
    });
  })();

  // ----- the menu. Wide screens: the logo on the left, groups on the right, one open at a time.
  // Narrow screens: a Menu button that opens every group in one panel. A tap elsewhere or Escape closes either. -----
  var menus = all(document, 'details.menu');
  var menuBtn = document.querySelector('.menu-btn'), siteNav = document.querySelector('#site-nav');
  var narrow = window.matchMedia ? window.matchMedia('(max-width: 1059px)') : { matches: false };
  var panelOpen = function () { return !!siteNav && siteNav.className.indexOf('open') > -1; };
  var setPanel = function (open) {
    if (!siteNav || !menuBtn) return;
    siteNav.className = 'nav' + (open ? ' open' : '');
    menuBtn.setAttribute('aria-expanded', String(open));
    menus.forEach(function (m) { m.open = open; });
  };
  if (menuBtn) menuBtn.addEventListener('click', function () { setPanel(!panelOpen()); });
  if (narrow.addEventListener) narrow.addEventListener('change', function () { setPanel(false); });
  menus.forEach(function (m) {
    m.addEventListener('toggle', function () { if (m.open && !panelOpen()) menus.forEach(function (o) { if (o !== m) o.open = false; }); });
    var sm = m.querySelector('summary');
    if (sm) sm.addEventListener('click', function (e) { if (panelOpen()) e.preventDefault(); });   // in the panel the groups stay open
  });
  document.addEventListener('click', function (e) {
    if (panelOpen()) { if (!siteNav.contains(e.target) && !menuBtn.contains(e.target)) setPanel(false); return; }
    menus.forEach(function (m) { if (m.open && !m.contains(e.target)) m.open = false; });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (panelOpen()) { setPanel(false); menuBtn.focus(); return; }
    menus.forEach(function (m) { if (m.open) { m.open = false; var sm = m.querySelector('summary'); if (sm) sm.focus(); } });
  });

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
    var withPrograms = box.hasAttribute('data-programs');
    var saved = mySchool();
    if (saved && !document.querySelector('[data-request-page]')) {   // a shortcut to the school saved on this device
      var mine = el('p', 'mine');
      mine.appendChild(el('span', null, 'Your school'));
      var go = el('a', 'btn', saved.name);
      go.href = (box.getAttribute('data-root') || '') + saved.id + '/' + (box.getAttribute('data-index') || '');
      go.addEventListener('click', function () { track({ event: 'pas_school_pick', school: saved.id, covered: 'yes' }); });
      mine.appendChild(go);
      box.insertBefore(mine, box.firstChild);
    }
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
      if (!data) { var wait = el('li', 'finder-note', 'Loading…'); list.appendChild(wait); list.hidden = false; return; }
      var tests = words.map(function (w) { return new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); });
      var match = function (hay) { hay = hay.toLowerCase(); return tests.every(function (t) { return t.test(hay); }); };
      var root = box.getAttribute('data-root') || '', index = box.getAttribute('data-index') || '';
      var schoolHits = data.schools.filter(function (r) { return match(r[1] + ' ' + r[2]); });
      schoolHits.sort(function (a, b) { return (b[5] ? 1 : 0) - (a[5] ? 1 : 0) || a[1].localeCompare(b[1]); });
      // programs are [id, name, type, which schools]; matched on the name alone, so a school search stays a school search
      var progHits = withPrograms ? (data.programs || []).filter(function (r) { return match(r[1]); }) : [];
      var keepSchools = progHits.length ? Math.max(8 - progHits.length, Math.min(schoolHits.length, 5)) : 8;
      var hits = schoolHits.concat(progHits);
      shown = schoolHits.slice(0, keepSchools).map(function (r) {
        return { href: schoolHref(box, r), name: r[1], meta: r[2] + (r[3] ? ' · grades ' + r[3] : '') + (r[4] ? ' · ' + r[4] : ''), pill: r[5] ? 'onsite' : 'nearby', pillText: r[5] ? r[6] + ' programs listed' : 'Not covered yet: ask for it',
          event: { event: 'pas_school_pick', school: r[5] || r[0], covered: r[5] ? 'yes' : 'no' } };
      });
      shown = shown.concat(progHits.slice(0, 8 - shown.length).map(function (r) {
        return { href: root + 'programs/' + r[0] + '/' + index, name: r[1], meta: r[2] + (r[3] ? ' · ' + r[3] : ''), pill: 'pickup', pillText: 'Program', event: { event: 'pas_program_pick', program_id: r[0], method: 'home_search' } };
      }));
      shown.forEach(function (r, i) {
        var li = el('li'); li.id = 'finder-opt-' + i; li.setAttribute('role', 'option');
        var a = el('a'); a.href = r.href; a.tabIndex = -1;
        a.appendChild(el('b', null, r.name));
        a.appendChild(el('span', 'finder-meta', r.meta));
        a.appendChild(el('span', 'pill ' + r.pill, r.pillText));
        a.addEventListener('click', function () { track(r.event); });
        li.appendChild(a); list.appendChild(li);
      });
      if (hits.length > shown.length) list.appendChild(el('li', 'finder-note', (hits.length - shown.length) + ' more. Keep typing to narrow it down.'));
      if (!hits.length) {
        var none = el('li', 'finder-note');
        none.appendChild(document.createTextNode(withPrograms ? 'No school or program matches that. ' : 'No district or charter school matches that. '));
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
        track(pick.event);
        location.href = pick.href;
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
  // A day-off plan is { "2026-10-09": "program-id" } ("home" for a day at home); own prices are { "program.school": { a: 120, per: "month" } }.
  function cleanOff(o) {
    var out = {};
    if (o && typeof o === 'object') Object.keys(o).slice(0, 120).forEach(function (d) { if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof o[d] === 'string' && /^[a-z0-9-]{1,60}$/.test(o[d])) out[d] = o[d]; });
    return out;
  }
  function cleanPrices(o) {
    var out = {};
    if (o && typeof o === 'object') Object.keys(o).slice(0, 60).forEach(function (k) {
      var v = o[k];
      if (/^[a-z0-9-]+\.[a-z0-9-]+$/.test(k) && v && typeof v.a === 'number' && v.a >= 0 && v.a <= 100000 && /^(week|month|term)$/.test(v.per)) out[k] = { a: v.a, per: v.per };
    });
    return out;
  }
  function newKid(name) { return { name: cleanName(name), now: emptyBoard(), next: emptyBoard(), teacher: '', cardNote: '', off: {}, offNote: '', prices: {} }; }
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
        return { name: cleanName(k.name), now: cleanBoard(k.now), next: cleanBoard(k.next), teacher: cleanName(k.teacher), cardNote: String(k.cardNote == null ? '' : k.cardNote).slice(0, 110), off: cleanOff(k.off), offNote: String(k.offNote == null ? '' : k.offNote).slice(0, 110), prices: cleanPrices(k.prices) };
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


  // ----- day-off plan: for each day school is closed, where this child will be. Kept with the rosters, on this device. -----
  var planEl = document.querySelector('[data-off-plan]');
  if (planEl) (function () {
    var od = JSON.parse(document.getElementById('off-data').textContent);
    var now0 = new Date(), today0 = now0.getFullYear() + '-' + ('0' + (now0.getMonth() + 1)).slice(-2) + '-' + ('0' + now0.getDate()).slice(-2);
    var days = od.days.filter(function (d) { return d.d >= today0; });
    var kidsRow = planEl.querySelector('#off-kids'), countEl = planEl.querySelector('#off-count'), listEl = planEl.querySelector('#off-list');
    var actions = planEl.querySelector('#off-actions'), statusEl = planEl.querySelector('#off-status'), emailEl = planEl.querySelector('#off-email');
    var HOME = 'home';
    var label = function (v) { return v === HOME ? 'At home or with family' : od.programs[v] ? od.programs[v].name : ''; };
    var planned = function (kid) { return days.filter(function (d) { return kid.off[d.d] && label(kid.off[d.d]); }); };
    var asText = function (kid) {
      var lines = [(kid.name ? possessive(kid.name) : 'Our') + ' day-off plan'];
      planned(kid).forEach(function (d) { lines.push(d.label + ' (' + d.name + '): ' + label(kid.off[d.d])); });
      return lines.join('\n') + '\n\nPlanned at ' + od.page;
    };
    // ----- the day-camp card: the plan as one picture, in the day-off colors -----
    var cardBox = planEl.querySelector('#off-card'), canvas = planEl.querySelector('#off-canvas'), noteBox = planEl.querySelector('#off-note');
    var photoBox = planEl.querySelector('#off-photo'), photoClear = planEl.querySelector('#off-photo-clear'), cardStatus = planEl.querySelector('#off-card-status');
    var photo = null;
    var DISPLAY = '"Archivo", "Arial Black", Arial, sans-serif', BODY = '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif';
    var fit = function (ctx, text, max) { if (ctx.measureText(text).width <= max) return text; while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1); return text.replace(/\s+$/, '') + '…'; };
    var box = function (ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    var NAVY = '#0B2140', YELLOW = '#F3C613';
    var drawOffCard = function () {
      if (!canvas || !canvas.getContext) return;
      var kid = activeKid(), mine = planned(kid), ctx = canvas.getContext('2d'), W = 1080, H = 1350, FOOT = 160;
      var note = String(kid.offNote || '').replace(/\s+/g, ' ').replace(/^ | $/g, '');
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = YELLOW; ctx.fillRect(0, 0, W, H);
      // brand
      ctx.fillStyle = '#0F4D90'; box(ctx, 56, 58, 54, 28, 8); ctx.fill();
      ctx.fillStyle = NAVY; ctx.beginPath(); ctx.arc(70, 90, 7, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(98, 90, 7, 0, 7); ctx.fill();
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.font = '800 32px ' + DISPLAY; ctx.fillText('Philly After School', 126, 86);
      // top right: the child's photo, or a kite
      var textMax = 720;
      if (photo) {
        var cx = 916, cy = 176, rad = 104;
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.closePath(); ctx.clip();
        var pw = photo.naturalWidth || photo.width, ph = photo.naturalHeight || photo.height, side = Math.min(pw, ph);
        ctx.drawImage(photo, (pw - side) / 2, (ph - side) / 2, side, side, cx - rad, cy - rad, rad * 2, rad * 2);
        ctx.restore();
        ctx.lineWidth = 8; ctx.strokeStyle = NAVY; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.stroke();
      } else {
        var kx = 930, ky = 140;
        ctx.strokeStyle = '#0A3566'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(kx, ky + 66); ctx.bezierCurveTo(kx - 34, ky + 100, kx + 30, ky + 120, kx - 6, ky + 150); ctx.stroke();
        ctx.fillStyle = '#1763B8';
        [[kx - 12, ky + 96, 1], [kx + 8, ky + 126, -1]].forEach(function (b) { ctx.beginPath(); ctx.moveTo(b[0] - 12 * b[2], b[1] - 8); ctx.lineTo(b[0] + 12 * b[2], b[1]); ctx.lineTo(b[0] - 10 * b[2], b[1] + 9); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = '#CC3000'; ctx.beginPath(); ctx.moveTo(kx, ky - 66); ctx.lineTo(kx + 50, ky); ctx.lineTo(kx, ky + 66); ctx.lineTo(kx - 50, ky); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#FFF6D6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(kx, ky - 66); ctx.lineTo(kx, ky + 66); ctx.moveTo(kx - 50, ky); ctx.lineTo(kx + 50, ky); ctx.stroke();
      }
      // title
      var title = (kid.name ? possessive(kid.name) : 'Our') + ' days off', size = 92;
      do { ctx.font = '850 ' + size + 'px ' + DISPLAY; size -= 4; } while (ctx.measureText(title).width > textMax && size > 44);
      ctx.fillStyle = NAVY; ctx.fillText(fit(ctx, title, textMax), 56, 196);
      ctx.font = '400 32px ' + BODY; ctx.fillStyle = '#263A57'; ctx.fillText('No school? Here’s the plan.', 56, 248);
      // the days: up to seven, then a line for the rest
      var top = 300, bottom = note ? 1068 : 1172, gap = 12, max = 7;
      var shown = mine.length > max ? mine.slice(0, max - 1) : mine, extra = mine.length - shown.length;
      var slots = shown.length + (extra ? 1 : 0), rowH = Math.min(slots < 4 ? 140 : 124, (bottom - top - gap * (slots - 1)) / Math.max(slots, 1));
      shown.forEach(function (d, i) {
        var y = top + i * (rowH + gap), v = kid.off[d.d], prog = od.programs[v];
        ctx.fillStyle = '#FFFFFF'; box(ctx, 48, y, 984, rowH, 22); ctx.fill();
        ctx.fillStyle = NAVY; box(ctx, 48, y, 196, rowH, 22); ctx.fill(); ctx.fillRect(216, y, 28, rowH);
        var parts = d.label.split(', ');
        ctx.textAlign = 'center';
        ctx.fillStyle = YELLOW; ctx.font = '700 24px ' + BODY; ctx.fillText(parts[0], 146, y + rowH / 2 - 16);
        ctx.fillStyle = '#FFFFFF'; ctx.font = '800 40px ' + DISPLAY; ctx.fillText(parts[1] || '', 146, y + rowH / 2 + 28);
        ctx.textAlign = 'left';
        ctx.fillStyle = prog ? prog.color : '#7A8DA6'; box(ctx, 268, y + rowH / 2 - 30, 10, 60, 5); ctx.fill();
        ctx.fillStyle = NAVY; ctx.font = '750 34px ' + DISPLAY; ctx.fillText(fit(ctx, label(v), 710), 294, y + rowH / 2 - 2);
        ctx.fillStyle = '#4D607A'; ctx.font = '400 25px ' + BODY; ctx.fillText(fit(ctx, d.name, 710), 294, y + rowH / 2 + 32);
      });
      if (extra) {
        var ey = top + shown.length * (rowH + gap);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; box(ctx, 48, ey, 984, rowH, 22); ctx.fill();
        ctx.fillStyle = NAVY; ctx.font = '700 32px ' + BODY; ctx.textAlign = 'center'; ctx.fillText('and ' + extra + ' more ' + (extra === 1 ? 'day' : 'days') + ' planned', W / 2, ey + rowH / 2 + 11); ctx.textAlign = 'left';
      }
      // with room to spare, the park fills it: grass, trees, the school shut and the bus asleep
      var used = top + slots * (rowH + gap), free = bottom - used;
      if (free > 190) {
        var g = bottom + (note ? 0 : 18);
        ctx.fillStyle = '#E2B300'; [[60, 150, 120], [200, 110, 150], [370, 170, 110], [700, 130, 160], [880, 160, 130]].forEach(function (b) { ctx.fillRect(b[0], g - b[1], b[2], b[1]); });
        ctx.fillStyle = '#3E9E57'; ctx.beginPath(); ctx.moveTo(0, g - 44); ctx.quadraticCurveTo(W / 2, g - 76, W, g - 40); ctx.lineTo(W, g + 20); ctx.lineTo(0, g + 20); ctx.closePath(); ctx.fill();
        [[150, 40], [930, 46]].forEach(function (t) { ctx.fillStyle = '#0A3566'; ctx.fillRect(t[0] - 5, g - 110, 10, 66); ctx.fillStyle = '#1F6B36'; ctx.beginPath(); ctx.arc(t[0] - 12, g - 124, t[1], 0, 7); ctx.fill(); ctx.fillStyle = '#2C8444'; ctx.beginPath(); ctx.arc(t[0] + 14, g - 136, t[1] * 0.85, 0, 7); ctx.fill(); });
        ctx.fillStyle = '#FFF6D6'; ctx.fillRect(400, g - 166, 230, 118); ctx.fillStyle = '#0A3566'; ctx.fillRect(396, g - 174, 238, 10); ctx.fillRect(498, g - 92, 36, 44);
        ctx.fillStyle = '#C7D6E8'; for (var c = 0; c < 5; c++) { ctx.fillRect(418 + c * 42, g - 150, 24, 26); }
        ctx.fillStyle = YELLOW; ctx.strokeStyle = NAVY; ctx.lineWidth = 3; box(ctx, 660, g - 86, 96, 40, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = NAVY; for (var w2 = 0; w2 < 4; w2++) ctx.fillRect(670 + w2 * 20, g - 78, 14, 13);
        ctx.beginPath(); ctx.arc(682, g - 44, 9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(736, g - 44, 9, 0, 7); ctx.fill();
        ctx.font = '800 22px ' + DISPLAY; ctx.fillText('z', 764, g - 96); ctx.font = '800 28px ' + DISPLAY; ctx.fillText('z', 782, g - 118); ctx.font = '800 34px ' + DISPLAY; ctx.fillText('z', 804, g - 144);
        ctx.fillStyle = '#2C8444'; ctx.fillRect(0, g - 30, W, 60);
      }
      if (note) {
        ctx.fillStyle = '#0A3566'; box(ctx, 48, 1082, 984, 92, 22); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.font = '400 30px ' + BODY; ctx.fillText(fit(ctx, 'Note: ' + note, 930), 76, 1139);
      }
      // footer: where it came from
      ctx.fillStyle = NAVY; ctx.fillRect(0, H - FOOT, W, FOOT);
      var host = String(od.site || '').replace(/^https?:\/\//, '') || 'phillyafterschool.org';
      ctx.fillStyle = YELLOW; ctx.font = '800 40px ' + DISPLAY; ctx.fillText('Plan your days off', 56, H - FOOT + 70);
      ctx.fillStyle = '#FFFFFF'; ctx.font = '700 36px ' + BODY; ctx.fillText(host, 56, H - FOOT + 118);
      if (od.qr && od.qr.length) {
        var n = od.qr.length, quiet = 3, boxSize = 138, cell = boxSize / (n + quiet * 2), qx = W - 56 - boxSize, qy = H - FOOT + 11;
        ctx.fillStyle = '#FFFFFF'; box(ctx, qx, qy, boxSize, boxSize, 10); ctx.fill();
        ctx.fillStyle = NAVY;
        for (var ry = 0; ry < n; ry++) for (var rx = 0; rx < n; rx++) if (od.qr[ry].charAt(rx) === '1') ctx.fillRect(qx + (rx + quiet) * cell, qy + (ry + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
        ctx.fillStyle = '#CFE3FB'; ctx.font = '400 24px ' + BODY; ctx.textAlign = 'right'; ctx.fillText('Scan to plan yours', qx - 20, H - FOOT + 118); ctx.textAlign = 'left';
      }
    };
    var shareEvent = function (method) { track({ event: 'pas_board_share', method: method, board: 'day_camp' }); };
    var cardFile = function (done) {
      var name = (cleanName(activeKid().name) || 'our').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'our';
      canvas.toBlob(function (blob) { done(blob, name + '-days-off.png'); }, 'image/png');
    };
    if (cardBox && canvas && canvas.getContext && canvas.toBlob) {
      noteBox.addEventListener('input', function () { activeKid().offNote = noteBox.value.slice(0, 110); saveRosters(); drawOffCard(); });
      photoBox.addEventListener('change', function () {
        var file = photoBox.files && photoBox.files[0];
        if (!file) return;
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); photo = img; photoClear.hidden = false; cardStatus.textContent = 'Photo added. It stays on this device.'; drawOffCard(); };
        img.onerror = function () { URL.revokeObjectURL(url); cardStatus.textContent = 'That file couldn’t be read as a picture. Try a JPG or PNG.'; };
        img.src = url;
      });
      photoClear.addEventListener('click', function () { photo = null; photoBox.value = ''; photoClear.hidden = true; cardStatus.textContent = 'Photo removed.'; drawOffCard(); });
      planEl.querySelector('#off-save').addEventListener('click', function () {
        cardFile(function (blob, name) {
          var a = el('a'); a.href = URL.createObjectURL(blob); a.download = name;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
          cardStatus.textContent = 'Saved as ' + name + '. Attach it to a text or an email.';
          shareEvent('image_save');
        });
      });
      var shareBtn = planEl.querySelector('#off-share');
      if (navigator.share && navigator.canShare && window.File) {
        var probe = null;
        try { probe = new File([new Blob(['x'], { type: 'image/png' })], 'days-off.png', { type: 'image/png' }); } catch (e) { probe = null; }
        if (probe && navigator.canShare({ files: [probe] })) {
          shareBtn.hidden = false;
          shareBtn.addEventListener('click', function () {
            cardFile(function (blob, name) {
              // No title: Apple's share sheet turns a title into a second preview of the picture. The link rides along as text.
              navigator.share({ files: [new File([blob], name, { type: 'image/png' })], text: (activeKid().name ? possessive(activeKid().name) : 'Our') + ' days off. Plan yours:', url: (od.site || '') + '/days-off/?utm_source=dayoff_card&utm_medium=share' }).then(function () { shareEvent('image_share'); }, function () { /* closed without sharing */ });
            });
          });
        }
      }
      var copyPic = planEl.querySelector('#off-copy-pic');
      if (copyPic && canCopyPicture) {
        copyPic.hidden = false;
        copyPic.addEventListener('click', function () { copyCanvas(canvas, 'Plan your own at ' + String(od.site || '').replace(/^https?:\/\//, '') + '/days-off', function (ok) { cardStatus.textContent = ok ? 'Picture copied. Paste it into a message.' : 'Copying didn’t work in this browser. Use Save as image.'; if (ok) shareEvent('image_copy'); }); });
      }
      planEl.querySelector('#off-print').addEventListener('click', function () {
        document.body.classList.add('print-card');
        var after = function () { document.body.classList.remove('print-card'); window.removeEventListener('afterprint', after); };
        window.addEventListener('afterprint', after);
        shareEvent('print');
        window.print();
      });
      if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('850 92px Archivo'), document.fonts.load('400 30px "Atkinson Hyperlegible"')]).then(function () { if (!cardBox.hidden) drawOffCard(); }, function () { /* system fonts will do */ });
    } else cardBox = null;

    var draw = function () {
      var r = loadRosters(), kid = r.kids[r.kid], whose = kid.name ? possessive(kid.name) : r.kids.length > 1 ? possessive(kidLabel(kid, r.kid)) : 'Your child’s';
      kidsRow.textContent = ''; kidsRow.hidden = r.kids.length < 2;
      if (r.kids.length > 1) r.kids.forEach(function (k, i) {
        var chip = el('button', 'kid', kidLabel(k, i)); chip.type = 'button'; chip.setAttribute('aria-pressed', String(i === r.kid));
        chip.addEventListener('click', function () { r.kid = i; saveRosters(); statusEl.textContent = ''; draw(); });
        kidsRow.appendChild(chip);
      });
      var mine = planned(kid);
      countEl.textContent = mine.length ? whose + ' plan: ' + mine.length + ' of ' + days.length + ' days off covered.' : 'Nothing planned yet. ' + days.length + ' days off are still to come this year.';
      listEl.textContent = ''; listEl.hidden = !mine.length; actions.hidden = !mine.length;
      if (cardBox) { cardBox.hidden = !mine.length; if (mine.length) { if (document.activeElement !== noteBox) noteBox.value = kid.offNote || ''; drawOffCard(); } }
      mine.forEach(function (d) {
        var v = kid.off[d.d], li = el('li');
        li.style.setProperty('--tc', od.programs[v] ? od.programs[v].color : '#7A8DA6');
        var stub = el('span', 'off-date');   // the date, like a ticket stub
        stub.appendChild(el('span', null, d.label.split(',')[0]));
        stub.appendChild(el('b', null, d.label.split(', ')[1] || d.label));
        li.appendChild(stub);
        li.appendChild(el('span', 'hint', d.name));
        if (od.programs[v]) { var a = el('a', null, od.programs[v].name); a.href = '#' + v; li.appendChild(a); } else li.appendChild(el('span', null, label(v)));
        if (od.programs[v] && d.camps.indexOf(v) < 0) li.appendChild(el('span', 'tc-warn', 'It hasn’t posted this date. Ask if it’s open.'));
        var rm = el('button', 'clear', 'Remove'); rm.type = 'button';
        rm.addEventListener('click', function () { delete kid.off[d.d]; saveRosters(); draw(); });
        li.appendChild(rm);
        listEl.appendChild(li);
      });
      emailEl.href = 'mailto:?subject=' + encodeURIComponent((kid.name ? possessive(kid.name) : 'Our') + ' day-off plan') + '&body=' + encodeURIComponent(asText(kid));
      // the pick row under each date
      all(document, '.offpick[data-off-day]').forEach(function (row) {
        var date = row.getAttribute('data-off-day'), d = null;
        days.forEach(function (x) { if (x.d === date) d = x; });
        row.textContent = '';
        if (!d) { row.hidden = true; return; }
        row.hidden = false;
        var v = kid.off[date] || '';
        row.appendChild(el('span', 'hint', (row.parentNode.querySelectorAll('.offpick').length > 1 ? d.label + ': ' : '') + whose.replace(/^Your child’s$/, 'Your') + ' plan'));
        var set = function (val) {
          if (val) { kid.off[date] = val; track({ event: 'pas_dayoff_pick', program_id: val, day: date }); } else delete kid.off[date];
          saveRosters(); statusEl.textContent = val ? 'Saved on this device.' : ''; draw();
        };
        d.camps.forEach(function (id) {
          var b = el('button', 'day', od.programs[id].name); b.type = 'button'; b.setAttribute('aria-pressed', String(v === id));
          b.addEventListener('click', function () { set(v === id ? '' : id); });
          row.appendChild(b);
        });
        var sel = el('select'); sel.setAttribute('aria-label', 'Another plan for ' + d.label);
        var first = el('option', null, d.camps.length ? 'Somewhere else…' : 'Choose…'); first.value = ''; sel.appendChild(first);
        var home = el('option', null, 'At home or with family'); home.value = HOME; home.selected = v === HOME; sel.appendChild(home);
        var grp = document.createElement('optgroup'); grp.label = 'Programs that haven’t posted this date';
        Object.keys(od.programs).forEach(function (id) { if (d.camps.indexOf(id) > -1) return; var o = el('option', null, od.programs[id].name); o.value = id; o.selected = v === id; grp.appendChild(o); });
        if (grp.children.length) sel.appendChild(grp);
        sel.addEventListener('change', function () { set(sel.value); });
        row.appendChild(sel);
        // show the pick on the closed row too
        var det = row.closest ? row.closest('details') : null, sum = det ? det.querySelector('summary') : null;
        if (sum) {
          var tag = sum.querySelector('.offmine'); if (!tag) { tag = el('span', 'offmine'); sum.appendChild(tag); }
          var picks = all(det, '.offpick[data-off-day]').map(function (x) { return kid.off[x.getAttribute('data-off-day')]; }).filter(function (x) { return x && label(x); });
          var names = picks.map(label).filter(function (n, i, a) { return a.indexOf(n) === i; });
          tag.textContent = names.length ? 'Planned: ' + names.join(', ') : ''; tag.hidden = !names.length;
        }
      });
    };
    planEl.querySelector('#off-copy').addEventListener('click', function () {
      var text = asText(activeKid());
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { statusEl.textContent = 'Copied.'; }, function () { statusEl.textContent = 'Copying didn’t work here. Use Email it to myself.'; });
      else statusEl.textContent = 'Copying didn’t work here. Use Email it to myself.';
    });
    var clearBtn = planEl.querySelector('#off-clear');
    clearBtn.addEventListener('click', function () {
      if (clearBtn.getAttribute('data-armed')) { activeKid().off = {}; saveRosters(); clearBtn.removeAttribute('data-armed'); clearBtn.textContent = 'Clear this plan'; statusEl.textContent = 'Plan cleared.'; draw(); }
      else { clearBtn.setAttribute('data-armed', '1'); clearBtn.textContent = 'Tap again to clear every day'; }
    });
    draw();
  })();

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
        col.setAttribute('data-day', day[0]);
        col.appendChild(el('h3', null, day[1]));
        var list = el('ul'), n = 0;
        b.days[day[0]].forEach(function (key) {
          var k = lookup(key);
          if (!k) return;
          n++; total++;
          var li = el('li', 'pick tc');
          li.setAttribute('data-day', day[0]); li.setAttribute('data-entry', key);
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
            if (!shared) band.title = 'Drag to another day';
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
          var offDay = dayWarning(k.prog.days, k.prog.offerDays, k.note, [day[0]], true);
          if (offDay) { li.className += ' tc-off'; li.appendChild(el('span', 'tc-warn', offDay)); }
          if (k.prog.pickupBy) li.appendChild(el('span', 'by-time', 'Pick up by ' + k.prog.pickupBy));
          if (k.link.where) li.appendChild(el('span', 'hint', k.link.where));
          if (!k.prog.pickupBy) li.appendChild(el('span', 'hint', k.prog.hours));
          if (!shared) {
            var mv = el('span', 'tc-move');
            mv.appendChild(el('span', 'hint', 'Move to'));
            DAYS.forEach(function (d2) {
              var mb = el('button', 'mv', d2[2].charAt(0) + (d2[0] === 'tue' || d2[0] === 'thu' ? d2[2].charAt(1) : ''));
              mb.type = 'button';
              mb.setAttribute('aria-label', 'Move ' + k.prog.name + ' to ' + d2[1]);
              if (d2[0] === day[0]) { mb.disabled = true; mb.setAttribute('aria-label', k.prog.name + ' is on ' + d2[1]); }
              mb.addEventListener('click', function () { moveEntry(day[0], key, d2[0], null); });
              mv.appendChild(mb);
            });
            li.appendChild(mv);
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
      if (adder) { adder.hidden = !!shared; drawAdd(); }
      drawCost(b);
      tabs.hidden = !!shared;
      kidBar.hidden = !!shared;
      tools.hidden = !!shared || total === 0;
      var dragHint = $('#board-hint'); if (dragHint) dragHint.hidden = !!shared || total === 0;
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
        ? 'Search for a program above and pick its days. Or open a school’s page and choose “Add to roster” on any program.'
        : 'Nothing on the current roster yet. Search for a program above and pick its days.';
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
      saveRosters(); say('New roster added. Give it a name, then search for programs to add.'); render();
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
    // ----- what the roster costs: an estimate for half a school year, from the prices programs publish -----
    var WEEKS = 18, BILLS = 5;   // a semester: 18 weeks of school, or five monthly bills
    var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
    var span = function (lo, hi) { return money(lo) + (Math.round(hi) > Math.round(lo) ? ' to ' + money(hi) : ''); };
    var exact = function (n) { return n % 1 ? '$' + n.toFixed(2) : money(n); };   // a published price, cents and all
    var priced = function (lo, hi) { return exact(lo) + (hi > lo ? ' to ' + exact(hi) : ''); };
    var tidy = function (n) { return n >= 200 ? Math.round(n / 10) * 10 : Math.round(n); };
    // The cost of one program for n days a week: { lo, hi } for the semester, with a few words on how it's priced.
    var PER_WORD = { week: 'a week', month: 'a month', term: 'for the semester' };
    var costOf = function (prog, link, n, own) {
      if (own) { var mine = own.a * (own.per === 'week' ? WEEKS : own.per === 'month' ? BILLS : 1); return { lo: mine, hi: mine, how: 'Your price: ' + exact(own.a) + ' ' + PER_WORD[own.per], own: true }; }
      if (link.free) return { lo: 0, hi: 0, how: 'Free' };
      var r = prog.rate;
      if (!r) return null;
      var lo, hi, how, unit = r.per === 'day' ? 'a day' : r.per === 'week' ? 'a week' : r.per === 'month' ? 'a month' : 'for the term';
      var pair = function (x) { return Array.isArray(x) ? x : [x, x]; };
      if (r.flat !== undefined) { lo = pair(r.flat)[0]; hi = pair(r.flat)[1]; how = (r.atLeast ? 'from ' : '') + priced(lo, hi) + ' ' + unit; }
      else if (r.eachDay !== undefined) {
        lo = pair(r.eachDay)[0] * n; hi = pair(r.eachDay)[1] * n;
        how = priced(pair(r.eachDay)[0], pair(r.eachDay)[1]) + (r.per === 'day' ? ' a day' : ' per weekday ' + unit);
        if (r.fullWeekOff && n === 5) { lo *= 1 - r.fullWeekOff; hi *= 1 - r.fullWeekOff; how += ', less ' + Math.round(r.fullWeekOff * 100) + '% for a full week'; }
      } else {   // a price for each number of days a week; between two published tiers, the range they bound
        var tiers = Object.keys(r.byDays).map(Number).sort(function (a, b) { return a - b; });
        if (r.byDays[n] !== undefined) { lo = hi = r.byDays[n]; }
        else {
          var below = tiers.filter(function (t) { return t < n; }).pop(), above = tiers.filter(function (t) { return t > n; })[0];
          lo = r.byDays[below !== undefined ? below : above]; hi = r.byDays[above !== undefined ? above : below];
        }
        how = priced(lo, hi) + ' ' + unit + ' for ' + n + (n === 1 ? ' day' : ' days');
      }
      var times = r.per === 'day' ? WEEKS : r.per === 'week' ? WEEKS : r.per === 'month' ? BILLS : 1;
      lo *= times; hi *= times;
      if (r.monthCap) { lo = Math.min(lo, r.monthCap * BILLS); hi = Math.min(hi, r.monthCap * BILLS); if (hi === r.monthCap * BILLS) how += ', capped at ' + money(r.monthCap) + ' a month'; }
      return { lo: lo, hi: hi, how: how, more: !!r.atLeast, extra: r.extra || '' };
    };
    var costEdit = '';   // the line whose price is being typed
    var boardCost = function (b, prices) {
      var seen = {}, order = [];
      DAYS.forEach(function (day) { b.days[day[0]].forEach(function (e) { var key = entryKey(e); if (!seen[key]) { seen[key] = 0; order.push(key); } seen[key]++; }); });
      var out = { lo: 0, hi: 0, more: false, lines: [], missing: 0, counted: 0 };
      order.forEach(function (key) {
        var k = lookup(key);
        if (!k) return;
        var n = seen[key], c = costOf(k.prog, k.link, n, prices && prices[key]);
        if (!c) { out.missing++; out.lines.push({ key: key, name: k.prog.name, n: n, none: true }); return; }
        out.lo += c.lo; out.hi += c.hi; out.more = out.more || !!c.more; out.counted++;
        out.lines.push({ key: key, name: k.prog.name, n: n, c: c });
      });
      return out;
    };
    var totalText = function (t) { return (t.more ? 'At least ' : 'About ') + (tidy(t.hi) > tidy(t.lo) && !t.more ? money(tidy(t.lo)) + ' to ' + money(tidy(t.hi)) : money(tidy(t.lo))); };
    var drawCost = function (b) {
      var boxEl = $('#board-cost');
      if (!boxEl) return;
      var mineKid = shared ? null : activeKid();
      var t = boardCost(b, mineKid && mineKid.prices), lines = $('#cost-lines'), family = $('#cost-family');
      boxEl.hidden = !!shared || !t.lines.length;
      if (boxEl.hidden) return;
      $('#cost-total').textContent = !t.counted ? 'No published prices to add up yet' : t.hi === 0 && !t.more ? (t.missing ? '$0 counted so far' : 'Free for a semester') : totalText(t) + ' for a semester';
      $('#cost-month').textContent = t.counted && t.hi > 0 ? 'That’s ' + totalText({ lo: t.lo / BILLS, hi: t.hi / BILLS, more: t.more }).replace(/^A/, 'a') + ' a month.' + (t.missing ? ' ' + t.missing + (t.missing === 1 ? ' program isn’t' : ' programs aren’t') + ' counted, because ' + (t.missing === 1 ? 'it doesn’t' : 'they don’t') + ' publish a price.' : '')
        : t.missing ? (t.counted ? 'The rest is free, but ' + t.missing + (t.missing === 1 ? ' program doesn’t' : ' programs don’t') + ' publish a price, so ask.' : 'None of these programs publish a price we can add up. Ask each one.') : '';
      lines.textContent = '';
      t.lines.forEach(function (l) {
        var li = el('li');
        li.appendChild(el('b', null, l.name));
        li.appendChild(el('span', 'cost-days', l.n + (l.n === 1 ? ' day a week' : ' days a week')));
        if (l.none) li.appendChild(el('span', 'cost-none', 'Price not published. Not counted until you add what you pay.'));
        else {
          li.appendChild(el('span', 'cost-how', l.c.how));
          li.appendChild(el('span', 'cost-sum', l.c.hi === 0 ? '$0' : (l.c.more ? 'at least ' : '') + span(l.c.lo, l.c.hi)));
          if (l.c.extra) li.appendChild(el('span', 'hint', l.c.extra));
        }
        // what this family actually pays, typed in: for a program with no published price, or a different deal
        var own = el('span', 'cost-own');
        if (costEdit === l.key) {
          var cur = mineKid.prices[l.key] || { a: '', per: 'month' };
          var amt = el('input'); amt.type = 'number'; amt.min = '0'; amt.step = '0.01'; amt.inputMode = 'decimal'; amt.value = cur.a; amt.placeholder = '0'; amt.setAttribute('aria-label', 'What you pay for ' + l.name + ', in dollars');
          var per = el('select'); per.setAttribute('aria-label', 'How often');
          [['week', 'a week'], ['month', 'a month'], ['term', 'for the semester']].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; op.selected = cur.per === o[0]; per.appendChild(op); });
          var save = el('button', 'btn', 'Save'); save.type = 'button';
          var commit = function () {
            var v = parseFloat(amt.value);
            if (isNaN(v) || v < 0) { amt.focus(); return; }
            mineKid.prices[l.key] = { a: Math.min(v, 100000), per: per.value };
            costEdit = ''; saveRosters(); drawCost(b);
          };
          save.addEventListener('click', commit);
          amt.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
          var dollar = el('span', 'hint', '$');
          own.appendChild(el('span', 'hint', 'I pay')); own.appendChild(dollar); own.appendChild(amt); own.appendChild(per); own.appendChild(save);
          var cancel = el('button', 'clear', 'Cancel'); cancel.type = 'button';
          cancel.addEventListener('click', function () { costEdit = ''; drawCost(b); });
          own.appendChild(cancel);
          window.setTimeout(function () { amt.focus(); }, 0);
        } else {
          var isOwn = !!(mineKid.prices && mineKid.prices[l.key]);
          var open = el('button', 'clear', isOwn ? 'Change' : l.none ? 'Add what you pay' : 'I pay something else'); open.type = 'button';
          open.addEventListener('click', function () { costEdit = l.key; drawCost(b); });
          own.appendChild(open);
          if (isOwn) {
            var listed = lookup(l.key), undo = el('button', 'clear', listed && costOf(listed.prog, listed.link, l.n, null) ? 'Use the listed price' : 'Remove my price'); undo.type = 'button';
            undo.addEventListener('click', function () { delete mineKid.prices[l.key]; saveRosters(); drawCost(b); });
            own.appendChild(undo);
          }
        }
        li.appendChild(own);
        lines.appendChild(li);
      });
      // every child together, once there is more than one roster with something on it
      var r = loadRosters(), all2 = { lo: 0, hi: 0, more: false }, withPicks = 0;
      r.kids.forEach(function (kd) { var c = boardCost(kd[r.active], kd.prices); if (c.lines.length) withPicks++; all2.lo += c.lo; all2.hi += c.hi; all2.more = all2.more || c.more; });
      family.hidden = withPicks < 2;
      if (withPicks > 1) family.textContent = 'All ' + withPicks + ' children’s ' + WHICH[r.active] + ' rosters: ' + totalText(all2).replace(/^A/, 'a') + ' for a semester.';
    };

    // ----- add a program without leaving the page: search by name, say which school, pick the days -----
    var adder = $('#board-adder'), addInput = $('#add-search'), addList = $('#add-list'), addPanel = $('#add-panel'), addStatus = $('#add-status');
    var adding = null;   // the program being added: { id, school }
    var addShown = [], addActive = -1;
    var schoolsOf = function (prog) { return Object.keys(prog.schools).filter(function (id) { return data.schools[id]; }); };
    // Which school to assume: the only one, the one already on this child's rosters, or the one looked at last.
    var guessSchool = function (prog) {
      var ids = schoolsOf(prog);
      if (ids.length === 1) return ids[0];
      var kid = activeKid(), tally = {}, best = '', n = 0;
      [kid.now, kid.next].forEach(function (b) { DAYS.forEach(function (d) { b.days[d[0]].forEach(function (e) { var sid = entryKey(e).split('.')[1]; tally[sid] = (tally[sid] || 0) + 1; }); }); });
      ids.forEach(function (id) { if ((tally[id] || 0) > n) { best = id; n = tally[id]; } });
      if (best) return best;
      var mine = mySchool(), last = store('pas-school');
      return mine && ids.indexOf(mine.id) > -1 ? mine.id : last && ids.indexOf(last) > -1 ? last : '';
    };
    var drawAdd = function () {
      addPanel.textContent = '';
      addPanel.hidden = !adding || !!shared;
      if (!adding || shared) return;
      var prog = data.programs[adding.id], b = activeBoard(), ids = schoolsOf(prog);
      var head = el('div', 'add-head');
      head.appendChild(el('h3', null, prog.name));
      var more = el('a', null, 'Full details'); more.href = prog.path; head.appendChild(more);
      addPanel.appendChild(head);
      if (ids.length > 1) {
        var row = el('div', 'add-row');
        row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Which school');
        row.appendChild(el('span', 'hint', 'Which school?'));
        ids.forEach(function (id) {
          var bt = el('button', 'kd', data.schools[id].name);
          bt.type = 'button'; bt.setAttribute('data-school', id); bt.setAttribute('aria-pressed', String(id === adding.school));
          row.appendChild(bt);
        });
        addPanel.appendChild(row);
      }
      if (adding.school) {
        var l = prog.schools[adding.school], how = el('p', 'add-how');
        how.appendChild(el('span', 'pill ' + l.rel, (data.rels[l.rel] || '').replace('{s}', data.schools[adding.school].name)));
        if (l.where) how.appendChild(el('span', null, l.where));
        addPanel.appendChild(how);
      }
      var days = el('div', 'add-row'), key = adding.id + '.' + adding.school, picked = [], pickedNote = '';
      days.setAttribute('role', 'group'); days.setAttribute('aria-label', 'Which days');
      days.appendChild(el('span', 'hint', adding.school ? 'Which days?' : 'Choose the school first, then the days.'));
      DAYS.forEach(function (d) {
        var bt = el('button', 'day', d[2]);
        bt.type = 'button'; bt.setAttribute('data-day', d[0]); bt.setAttribute('aria-label', d[1]);
        bt.disabled = !adding.school;
        var isOn = !!adding.school && findEntry(b.days[d[0]], key) > -1;
        bt.setAttribute('aria-pressed', String(isOn));
        if (prog.days && prog.days.indexOf(d[0]) < 0) { bt.className += ' off'; bt.title = 'Not listed for ' + d[1] + 's'; }
        if (isOn) { picked.push(d[0]); var at0 = findEntry(b.days[d[0]], key); if (!pickedNote) pickedNote = entryNote(b.days[d[0]][at0]); }
        days.appendChild(bt);
      });
      addPanel.appendChild(days);
      var addWarn = dayWarning(prog.days, prog.offerDays, pickedNote, picked);
      if (addWarn) addPanel.appendChild(el('p', 'day-warn', addWarn));
      var foot = el('div', 'actions'), done = el('button', 'btn', 'Done');
      done.type = 'button'; done.setAttribute('data-add-done', '');
      foot.appendChild(done);
      addPanel.appendChild(foot);
    };
    var closeAdd = function () { addList.hidden = true; addInput.setAttribute('aria-expanded', 'false'); addInput.removeAttribute('aria-activedescendant'); addActive = -1; };
    var pickAdd = function (id, schoolId, how) {
      var prog = data.programs[id];
      if (!prog) return;
      adding = { id: id, school: schoolId && prog.schools[schoolId] && data.schools[schoolId] ? schoolId : guessSchool(prog) };
      addInput.value = ''; closeAdd(); addStatus.textContent = '';
      drawAdd();
      track({ event: 'pas_program_pick', program_id: id, method: how });
      var first = addPanel.querySelector(adding.school ? '.day' : '.kd');
      if (first) first.focus();
    };
    var renderAdd = function () {
      var words = addInput.value.toLowerCase().split(/\s+/).filter(Boolean);
      addList.textContent = ''; addShown = []; addActive = -1;
      if (!words.length) { closeAdd(); return; }
      var tests = words.map(function (w) { return new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); });
      var every = function (hay) { return tests.every(function (t) { return t.test(hay); }); };
      var hits = Object.keys(data.programs).filter(function (id) { return every(data.programs[id].q); });
      var rank = function (id) { return every(data.programs[id].name.toLowerCase()) ? 0 : 1; };   // a match in the name comes first
      hits.sort(function (a, b) { return rank(a) - rank(b) || data.programs[a].name.localeCompare(data.programs[b].name); });
      addShown = hits.slice(0, 8);
      var b = activeBoard();
      addShown.forEach(function (id, i) {
        var prog = data.programs[id], names = schoolsOf(prog).map(function (sid) { return data.schools[sid].name; });
        var li = el('li'); li.id = 'add-opt-' + i; li.setAttribute('role', 'option');
        var bt = el('button'); bt.type = 'button'; bt.tabIndex = -1;
        bt.appendChild(el('b', null, prog.name));
        bt.appendChild(el('span', 'finder-meta', (data.types[prog.type] ? data.types[prog.type].label + ' · ' : '') + names.slice(0, 3).join(', ') + (names.length > 3 ? ' and ' + (names.length - 3) + ' more' : '')));
        var on = DAYS.filter(function (d) { return b.days[d[0]].some(function (e) { return entryKey(e).split('.')[0] === id; }); }).map(function (d) { return d[2]; });
        if (on.length) bt.appendChild(el('span', 'pill onsite', 'On this week: ' + on.join(', ')));
        bt.addEventListener('click', function () { pickAdd(id, '', 'roster_search'); });
        li.appendChild(bt); addList.appendChild(li);
      });
      if (hits.length > addShown.length) addList.appendChild(el('li', 'finder-note', (hits.length - addShown.length) + ' more. Keep typing to narrow it down.'));
      if (!hits.length) {
        var none = el('li', 'finder-note');
        none.appendChild(document.createTextNode('No program by that name is listed yet. '));
        var ask = el('a', null, 'Tell us about it.'); ask.href = data.suggest;
        none.appendChild(ask); addList.appendChild(none);
      }
      addList.hidden = false; addInput.setAttribute('aria-expanded', 'true');
    };
    if (adder) {
      addInput.addEventListener('input', renderAdd);
      addInput.addEventListener('focus', function () { if (addInput.value) renderAdd(); });
      addInput.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          if (!addShown.length) return;
          e.preventDefault();
          addActive = e.key === 'ArrowDown' ? (addActive + 1) % addShown.length : (addActive <= 0 ? addShown.length - 1 : addActive - 1);
          all(addList, 'li[role="option"]').forEach(function (li, i) { li.setAttribute('aria-selected', String(i === addActive)); });
          addInput.setAttribute('aria-activedescendant', 'add-opt-' + addActive);
        } else if (e.key === 'Enter') {
          var pick = addShown[addActive > -1 ? addActive : 0];
          if (!pick) return;
          e.preventDefault();
          pickAdd(pick, '', 'roster_search');
        } else if (e.key === 'Escape') { closeAdd(); }
      });
      document.addEventListener('click', function (e) { if (!adder.contains(e.target)) closeAdd(); });
      addPanel.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('[data-school], [data-day], [data-add-done]') : null;
        if (!t || !adding) return;
        if (t.hasAttribute('data-add-done')) { adding = null; addStatus.textContent = ''; drawAdd(); addInput.focus(); return; }
        if (t.hasAttribute('data-school')) {
          adding.school = t.getAttribute('data-school');
          store('pas-school', adding.school);
          drawAdd();
          var again = addPanel.querySelector('.kd[aria-pressed="true"]');
          if (again) again.focus();
          return;
        }
        var day = t.getAttribute('data-day'), r = loadRosters(), b = activeBoard(), key = adding.id + '.' + adding.school, prog = data.programs[adding.id];
        var dayName = DAYS.filter(function (d) { return d[0] === day; })[0][1];
        var i = findEntry(b.days[day], key), msg;
        if (i > -1) { b.days[day].splice(i, 1); msg = 'Took ' + prog.name + ' off ' + dayName + '. '; }
        else {
          if (b.days[day].length >= 8) { addStatus.textContent = dayName + ' is full.'; return; }
          var note = '';   // keep the class already chosen for this program on another day
          DAYS.forEach(function (d) { var at = findEntry(b.days[d[0]], key); if (at > -1 && !note) note = entryNote(b.days[d[0]][at]); });
          b.days[day].push(makeEntry(key, note));
          track({ event: 'pas_board_add', program_id: adding.id, school: adding.school, day: day, board: r.active === 'next' ? 'upcoming' : 'current', children: r.kids.length });
          msg = 'Added ' + prog.name + ' to ' + dayName + '. ';
        }
        saveRosters();
        render();
        addStatus.textContent = msg + savedNote();
        var same = addPanel.querySelector('[data-day="' + day + '"]');
        if (same) same.focus();
      });
      // Arriving from a program's page ("Add to your week"): open that program here, ready for its days.
      var asked = query();
      if (asked.add && data.programs[asked.add] && !shared) {
        if (window.history && history.replaceState) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* file preview */ } }
        window.setTimeout(function () { pickAdd(asked.add, asked.school || '', 'program_page'); if (adder.scrollIntoView) adder.scrollIntoView({ block: 'center' }); }, 0);
      }
    }

    // ----- moving cards: drag one by its colored top to another day, or use the day buttons on the card -----
    var moveEntry = function (from, entry, to, at) {
      var b = activeBoard(), i = b.days[from].indexOf(entry);
      if (i < 0) return;
      var k = lookup(entry), label = k ? k.prog.name : 'That';
      var toName = DAYS.filter(function (d) { return d[0] === to; })[0][1];
      if (from !== to && findEntry(b.days[to], entryKey(entry)) > -1) { say(label + ' is already on ' + toName + '.'); return; }
      if (from !== to && b.days[to].length >= 8) { say(toName + ' is full.'); return; }
      b.days[from].splice(i, 1);
      if (at == null || at > b.days[to].length) at = b.days[to].length;
      b.days[to].splice(at, 0, entry);
      saveRosters();
      var heads = k ? dayWarning(k.prog.days, k.prog.offerDays, k.note, [to]) : '';
      say(from === to ? savedNote() : 'Moved ' + label + ' to ' + toName + '. ' + (heads ? 'Heads up: ' + heads.charAt(0).toLowerCase() + heads.slice(1) + ' ' : '') + savedNote());
      render();
    };
    var drag = null;
    var endDrag = function () {
      if (!drag) return;
      if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
      if (drag.li) drag.li.classList.remove('dragging');
      all(week, '.daycol.drop').forEach(function (c) { c.classList.remove('drop'); });
      document.body.classList.remove('is-dragging');
      drag = null;
    };
    var columnAt = function (x, y) {
      var under = document.elementFromPoint(x, y);
      return under && under.closest ? under.closest('.daycol') : null;
    };
    week.addEventListener('pointerdown', function (e) {
      var handle = e.target.closest ? e.target.closest('.tc-top') : null;
      if (!handle || shared || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var li = handle.closest('li.pick');
      drag = { li: li, day: li.getAttribute('data-day'), entry: li.getAttribute('data-entry'), x: e.clientX, y: e.clientY, started: false, ghost: null, handle: handle };
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    });
    week.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (!drag.started) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 8) return;
        drag.started = true;
        var box = drag.li.getBoundingClientRect();
        drag.dx = e.clientX - box.left; drag.dy = e.clientY - box.top;
        drag.ghost = drag.li.cloneNode(true);
        drag.ghost.className += ' ghost';
        drag.ghost.style.width = box.width + 'px';
        document.body.appendChild(drag.ghost);
        drag.li.classList.add('dragging');
        document.body.classList.add('is-dragging');
      }
      e.preventDefault();
      drag.ghost.style.left = (e.clientX - drag.dx) + 'px';
      drag.ghost.style.top = (e.clientY - drag.dy) + 'px';
      var col = columnAt(e.clientX, e.clientY);
      all(week, '.daycol.drop').forEach(function (c) { if (c !== col) c.classList.remove('drop'); });
      if (col) col.classList.add('drop');
      // on a phone the days are stacked: scroll when the card is held near the top or bottom of the screen
      if (e.clientY < 70) window.scrollBy(0, -14); else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
    });
    week.addEventListener('pointerup', function (e) {
      if (!drag) return;
      var d = drag, col = d.started ? columnAt(e.clientX, e.clientY) : null;
      var at = null;
      if (col) {   // drop above the first card whose middle is below the pointer
        at = 0;
        all(col, 'li.pick').forEach(function (other) {
          if (other === d.li) return;
          var r = other.getBoundingClientRect();
          if (e.clientY > r.top + r.height / 2) at++;
        });
      }
      endDrag();
      if (col) moveEntry(d.day, d.entry, col.getAttribute('data-day'), at);
    });
    week.addEventListener('pointercancel', endDrag);

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
      var ctx = canvas.getContext('2d'), W = 1080, H = 1350, FOOT = 160;
      var teacher = cleanName(kid.teacher), note = String(kid.cardNote || '').replace(/\s+/g, ' ').replace(/^ | $/g, '');
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0F4D90'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0A3566'; ctx.fillRect(0, H - FOOT, W, FOOT);
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
      var top = 300, bottom = note ? 1068 : 1172, gap = 12, rowH = (bottom - top - gap * 4) / 5;
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
        var showN = Math.min(picks.length, 2), blockH = Math.min(74, Math.floor(rowH / 2) - 1), startY = y + (rowH - showN * blockH) / 2;
        picks.slice(0, showN).forEach(function (k, j) {
          var by = startY + j * blockH, type = data.types[k.prog.type] || { color: '#0F4D90' };
          ctx.fillStyle = type.color; box(ctx, 222, by + 6, 10, blockH - 14, 5); ctx.fill();
          ctx.fillStyle = '#0B2140'; ctx.font = '750 34px ' + DISPLAY; ctx.fillText(fit(ctx, k.prog.name, 760), 248, by + (blockH < 74 ? 31 : 34));
          var bits = [k.note, k.prog.pickupBy ? 'pick up by ' + k.prog.pickupBy : '', k.link.where].filter(Boolean).join('  ·  ');
          ctx.fillStyle = '#4D607A'; ctx.font = '400 25px ' + BODY; ctx.fillText(fit(ctx, bits || pillText(k), 760), 248, by + (blockH < 74 ? 61 : 66));
        });
      });
      if (note) {
        ctx.fillStyle = '#0A3566'; box(ctx, 48, 1082, 984, 92, 22); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.font = '400 30px ' + BODY; ctx.fillText(fit(ctx, 'Note: ' + note, 930), 76, 1139);
      }
      // footer: where this came from, so a shared or printed card leads back to the site
      var host = String(data.site || '').replace(/^https?:\/\//, '') || 'phillyafterschool.org';
      ctx.fillStyle = '#F3C613'; ctx.font = '800 40px ' + DISPLAY; ctx.fillText('Build your own week', 56, H - FOOT + 70);
      ctx.fillStyle = '#FFFFFF'; ctx.font = '700 36px ' + BODY; ctx.fillText(host, 56, H - FOOT + 118);
      if (data.qr && data.qr.length) {   // a QR code to the site, drawn from the pattern the build provides
        var n = data.qr.length, quiet = 2, boxSize = 130, cell = boxSize / (n + quiet * 2), qx = W - 56 - boxSize, qy = H - FOOT + 15;
        ctx.fillStyle = '#FFFFFF'; box(ctx, qx, qy, boxSize, boxSize, 10); ctx.fill();
        ctx.fillStyle = '#0B2140';
        for (var ry = 0; ry < n; ry++) for (var rx = 0; rx < n; rx++) if (data.qr[ry].charAt(rx) === '1') ctx.fillRect(qx + (rx + quiet) * cell, qy + (ry + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
        ctx.fillStyle = '#CFE3FB'; ctx.font = '400 24px ' + BODY; ctx.textAlign = 'right'; ctx.fillText('Scan to plan yours', qx - 20, H - FOOT + 118); ctx.textAlign = 'left';
      }
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
              // No title: Apple's share sheet turns a title into a second preview of the picture. The link rides along as text.
              navigator.share({ files: [file], text: heading(activeKid().name, loadRosters().active) + '. Make your own at', url: (data.site || '') + '/?utm_source=week_card&utm_medium=share' }).then(function () { track_share('image_share'); }, function () { /* closed without sharing */ });
            });
          });
        }
      }
      var copyCard = $('#card-copy-pic');
      if (copyCard && canCopyPicture) {
        copyCard.hidden = false;
        copyCard.addEventListener('click', function () { copyCanvas(canvas, 'Make your own at ' + String(data.site || '').replace(/^https?:\/\//, ''), function (ok) { cardStatus.textContent = ok ? 'Picture copied. Paste it into a message.' : 'Copying didn’t work in this browser. Use Save as image.'; if (ok) track_share('image_copy'); }); });
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
    // Someone who saved their school sees the citywide lists narrowed to it, with one tap to widen them again.
    var mineF = fSchool ? null : mySchool();
    if (mineF && !items.some(function (it) { return (' ' + (it.getAttribute('data-schools') || '') + ' ').indexOf(' ' + mineF.id + ' ') > -1; })) mineF = null;
    if (mineF) {
      var srow = el('div', 'frow'), srail = el('div', 'rail');
      srow.appendChild(el('span', 'flabel', 'School'));
      srail.setAttribute('role', 'group'); srail.setAttribute('aria-label', 'School');
      [[mineF.id, 'Works for ' + mineF.name, mineF.name], ['ALL', 'Any school', 'Any school']].forEach(function (o) {
        var sb = el('button', 'tbtn', o[1]);
        sb.type = 'button'; sb.id = 'school-' + o[0]; sb.setAttribute('data-f', 'school'); sb.setAttribute('data-v', o[0]); sb.setAttribute('data-label', o[2]); sb.setAttribute('aria-pressed', 'false');
        srail.appendChild(sb);
      });
      srow.appendChild(srail);
      var firstRow = fbar.querySelector('.frow');
      if (firstRow) fbar.insertBefore(srow, firstRow); else fbar.appendChild(srow);
    }
    var fbtns = all(document, '[data-f]');
    var count = document.querySelector('#count'), clear = document.querySelector('#clear');
    var search = document.querySelector('#prog-search'), noMatch = document.querySelector('[data-nomatch]'), searchMore = document.querySelector('#search-more');
    var FILTERS = ['type', 'grade', 'rel', 'hood', 'cost', 'day', 'school'];
    var blank = function () { return { type: 'ALL', grade: 'ALL', rel: 'ALL', hood: 'ALL', cost: 'ALL', day: 'ALL', school: 'ALL' }; };
    var state = blank();
    var terms = [];
    var findBtn = function (f, v) { for (var i = 0; i < fbtns.length; i++) if (fbtns[i].getAttribute('data-f') === f && fbtns[i].getAttribute('data-v') === v) return fbtns[i]; return null; };
    // Start from the page address (how the home page links in), then from the grade picked last time.
    var q0 = query();
    FILTERS.forEach(function (f) { if (q0[f] && findBtn(f, q0[f])) state[f] = q0[f]; });
    if (mineF && !q0.school) state.school = mineF.id;   // "school=all" in the address keeps the wide view
    if (!q0.grade) { var savedGrade = store('pas-grade'); if (savedGrade && findBtn('grade', savedGrade)) state.grade = savedGrade; }
    var gradeLabel = function (g) { return g === 'PK' ? 'Pre-K' : g === 'K' ? 'kindergarten' : 'grade ' + g; };
    var inList = function (el, attr, v) { return (' ' + (el.getAttribute(attr) || '') + ' ').indexOf(' ' + v + ' ') > -1; };
    var apply = function () {
      var total = 0, hiddenHits = 0;
      items.forEach(function (it) {
        var gs = it.getAttribute('data-grades') || '*';
        var ok = (state.grade === 'ALL' || gs === '*' || inList(it, 'data-grades', state.grade))
          && (state.type === 'ALL' || inList(it, 'data-types', state.type))
          && (state.rel === 'ALL' || it.getAttribute('data-rel') === state.rel)
          && (state.hood === 'ALL' || inList(it, 'data-hoods', state.hood))
          && (state.cost === 'ALL' || inList(it, 'data-cost', state.cost))
          && (state.day === 'ALL' || (it.getAttribute('data-days') || '*') === '*' || inList(it, 'data-days', state.day))
          && (state.school === 'ALL' || inList(it, 'data-schools', state.school));
        if (terms.length) {
          var hay = it.getAttribute('data-search') || '', hit = terms.every(function (w) { return w.test(hay); });
          if (hit && !ok) hiddenHits++;   // it matches the search, and a filter is hiding it
          ok = ok && hit;
        }
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
      ['school', 'type', 'rel', 'hood', 'cost', 'day'].forEach(function (f) {
        var b = state[f] !== 'ALL' ? findBtn(f, state[f]) : null;
        if (b) bits.push(f === 'hood' ? 'in ' + b.getAttribute('data-label') : f === 'cost' ? b.getAttribute('data-label').toLowerCase() : f === 'day' ? 'on ' + DAY_FULL[state.day] + 's' : f === 'school' ? 'works for ' + b.getAttribute('data-label') : b.getAttribute('data-label'));
      });
      if (terms.length) bits.push('matching “' + search.value.trim() + '”');
      var what = (state.grade === 'ALL' ? '' : ' for ' + gradeLabel(state.grade)) + (bits.length ? ' (' + bits.join(', ') + ')' : '');
      var filtered = state.grade !== 'ALL' || bits.length > 0;
      count.textContent = total ? total + (total === 1 ? ' program' : ' programs') + (filtered ? what : fSchool ? ' for all grades' : '') : 'No programs' + what + '. Try fewer filters.';
      clear.hidden = !filtered;
      if (noMatch) noMatch.hidden = total > 0 || hiddenHits > 0;
      if (searchMore) {
        searchMore.textContent = '';
        searchMore.hidden = !hiddenHits;
        if (hiddenHits) {
          searchMore.appendChild(document.createTextNode((total ? hiddenHits + ' more ' + (hiddenHits === 1 ? 'matches' : 'match') : hiddenHits + (hiddenHits === 1 ? ' program matches' : ' programs match')) + ' “' + search.value.trim() + '” outside your filters. '));
          var showAll = el('button', 'clear', hiddenHits === 1 ? 'Show it' : 'Show them');
          showAll.type = 'button';
          showAll.addEventListener('click', function () { state = blank(); apply(); search.focus(); });
          searchMore.appendChild(showAll);
        }
      }
      fbtns.forEach(function (b) {
        var f = b.getAttribute('data-f'), v = b.getAttribute('data-v');
        b.setAttribute('aria-pressed', String(state[f] === v));
      });
      // keep the address in step, so a filtered list can be bookmarked or sent to someone
      if (window.history && history.replaceState) {
        var parts = [];
        FILTERS.forEach(function (f) { if (state[f] !== 'ALL') parts.push(f + '=' + encodeURIComponent(state[f])); });
        if (mineF && state.school === 'ALL') parts.push('school=all');
        try { history.replaceState(null, '', location.pathname + (parts.length ? '?' + parts.join('&') : '') + location.hash); } catch (e) { /* file preview */ }
      }
      return total;
    };
    var NAMES = { type: 'program_type', rel: 'relation', hood: 'neighborhood', grade: 'grade', cost: 'cost', day: 'day', school: 'school' };
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
      state = blank();
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
  store('pas-school', school);
  all(document, '[data-my-school]').forEach(function (btn) {
    var id = btn.getAttribute('data-my-school'), name = btn.getAttribute('data-name'), note = document.querySelector('[data-my-school-note]');
    var paint = function () {
      var m = mySchool(), on = !!m && m.id === id;
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? 'Saved as your school' : m ? 'Make ' + name + ' your school' : 'Save as my school';
      if (note) note.textContent = on ? 'Saved on this device. The home page, lists and your roster now start from ' + name + '. Tap again to undo.' : '';
    };
    btn.addEventListener('click', function () {
      var m = mySchool();
      if (m && m.id === id) { try { window.localStorage.removeItem('pas-my-school'); } catch (e) { /* nothing saved */ } }
      else { store('pas-my-school', JSON.stringify({ id: id, name: name })); track({ event: 'pas_school_save', school: id }); }
      paint();
    });
    paint();
  });

  // Add to roster: pick the days for a program, for one child, on their current or upcoming roster, with an optional class.
  var refreshers = [];
  all(page, '.prog').forEach(function (card) {
    var toggle = card.querySelector('[data-board-toggle]');
    var panel = card.querySelector('.days');
    if (!toggle || !panel) return;
    var kidRow = panel.querySelector('.kid-row');
    var key = card.id + '.' + school;
    var cardDays = card.getAttribute('data-days'), cardOfferDays = null;
    cardDays = cardDays && cardDays !== '*' ? cardDays.split(' ') : null;
    try { cardOfferDays = JSON.parse(card.getAttribute('data-offer-days') || 'null'); } catch (e) { cardOfferDays = null; }
    var warnLine = el('span', 'day-warn');
    warnLine.hidden = true;
    panel.appendChild(warnLine);
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
      var r = loadRosters(), kid = r.kids[r.kid], b = kid[r.active], on = [], onDays = [];
      all(panel, '.day').forEach(function (btn) {
        var has = findEntry(b.days[btn.getAttribute('data-day')], key) > -1;
        btn.setAttribute('aria-pressed', String(has));
        if (has) { on.push(btn.textContent); onDays.push(btn.getAttribute('data-day')); }
      });
      var cls = currentClass(b);
      var mixed = cls === false;
      if (cls === null) cls = pending;
      if (mixed) cls = '';
      var warn = dayWarning(cardDays, cardOfferDays, cls, onDays);   // a day picked that the listing doesn't show
      warnLine.textContent = warn; warnLine.hidden = !warn;
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
