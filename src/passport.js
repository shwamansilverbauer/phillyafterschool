// The Passport: a page of each child's own, inside a parent's account. Stamps for the kinds of program they have been
// to, the neighborhoods, the milestones and the seasons; a map of every place; a bracket that ranks their favorites.
// What counts is what a parent has confirmed (the "passport" endpoint in groups/api.php): the page suggests from the
// household's plans, the parent says yes or no behind the grown-ups' hold-to-open button.
//
// Kid mode: while a child is holding the phone the site's header, menu and footer are hidden, nothing on the page is
// typed, and no link leaves the site. Nothing on this page is counted, recorded or sent anywhere but the household's
// own account. Badges are drawn here (simple shapes) so artwork can replace them later without changing anything else.
(function () {
  'use strict';
  var root = document.getElementById('passport');
  if (!root || !window.fetch) return;
  var D = JSON.parse(document.getElementById('passport-data').textContent);
  var API = root.getAttribute('data-api') || '';
  var app = document.getElementById('pp-app'), outBox = document.getElementById('pp-out'), waitEl = document.getElementById('pp-wait');
  var html = document.documentElement;

  // ----- small helpers -----
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  var btn = function (cls, text, go) { var b = el('button', cls, text); b.type = 'button'; if (go) b.addEventListener('click', go); return b; };
  var svgIcon = function (path, color) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', path); if (color) p.setAttribute('fill', color); s.appendChild(p); return s;
  };
  var possessive = function (n) { return /s$/i.test(n) ? n + '’' : n + '’s'; };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
  var signedIn = function () { try { return localStorage.getItem('pas-in') === '1'; } catch (e) { return false; } };
  var call = function (action, body) {
    var o = { credentials: 'same-origin', headers: { 'X-PAS': '1' } };
    if (body) { o.method = 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return window.fetch(API + '?action=' + action, o).then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: 'offline', message: 'Couldn’t reach the site just now. Check the connection and try again.' }; });
  };
  var listing = function (k) { return D.listings[k] || null; };
  var nameOf = function (k) { var l = listing(k); return l ? l.n : k.replace(/^[pc]:/, ''); };
  var yearLabel = function (e) { return e.kind === 'summer' ? 'Summer ' + e.y : e.y + '–' + String(e.y + 1).slice(2); };
  var hoodSlug = function (n) { return String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  // Where a confirmed class was: the listing's one site, the site the parent picked when it has several, or the
  // school's neighborhood for a program inside a school. A listing with several sites and no pick places nothing.
  var siteOf = function (e) {
    var l = listing(e.k); if (!l) return null;
    var i;
    if (e.h) for (i = 0; i < l.sites.length; i++) if (l.sites[i].h === e.h) return l.sites[i];
    if (l.sites.length === 1) return l.sites[0];
    var s = e.s && D.schools[e.s], sh = s && s.h && s.h.length ? s.h : [];
    if (sh.length) {   // picked under a school: the site in that school's neighborhood, or the school's neighborhood itself
      for (i = 0; i < l.sites.length; i++) if (sh.indexOf(l.sites[i].h) > -1) return l.sites[i];
      if (!l.sites.length) return { h: sh[0], ll: null };
    }
    return null;
  };
  var hoodsOf = function (e) { var st = siteOf(e); return st ? [st.h] : []; };
  var needsSite = function (e) { var l = listing(e.k); return !!l && l.sites.length > 1 && !siteOf(e); };

  // ----- what the stamps say -----
  // Each badge: { id, group, label, how, color, icon }. Neighborhood badges are made from the neighborhoods seen.
  var earned = function (done) {
    var got = {}, hoods = {}, types = {}, kinds = {}, listings = {};
    done.forEach(function (e) {
      var l = listing(e.k); if (!l) return;
      listings[e.k] = true; kinds[e.kind] = true;
      (l.t || []).forEach(function (t) { types[t] = true; });
      hoodsOf(e).forEach(function (h) { hoods[h] = true; });
    });
    var n = Object.keys(listings).length, nh = Object.keys(hoods).length;
    D.badges.forEach(function (b) {
      if (b.group === 'type') got[b.id] = !!types[b.id.slice(5)];
      else if (b.group === 'season') got[b.id] = !!kinds[b.id.slice(7)];
      else if (b.group === 'milestone') got[b.id] = b.hoods ? nh >= b.hoods : n >= b.n;
    });
    return { got: got, hoods: Object.keys(hoods), n: n, nh: nh };
  };

  // ----- state -----
  var S = { data: null, kid: -1, view: 'pick', bracket: null, saving: false, said: '' };
  var kid = function () { return S.data && S.kid > -1 ? S.data.kids[S.kid] : null; };
  var setKidMode = function (on) { if (on) html.classList.add('pp-kid'); else html.classList.remove('pp-kid'); };
  var go = function (view, push) {
    S.view = view;
    if (push !== false) { try { history.pushState({ pp: view, kid: S.kid }, '', location.pathname + (view === 'pick' ? '' : '#' + view)); } catch (e) { /* no history */ } }
    draw();
    window.scrollTo(0, 0);
  };
  window.addEventListener('popstate', function (ev) {
    var st = ev.state && ev.state.pp ? ev.state : { pp: 'pick', kid: -1 };
    if (st.pp !== 'pick' && (S.kid < 0 || !kid())) st = { pp: 'pick' };
    S.view = st.pp; draw();
  });

  // Save this child's lists, then redraw from the server's answer (which also brings fresh suggestions).
  var save = function (changes, then) {
    var k = kid(); if (!k || S.saving) return;
    S.saving = true;
    var body = { kid: k.name, done: changes.done || k.done, skip: changes.skip || k.skip, fav: changes.fav || k.fav };
    call('passport_save', body).then(function (d) {
      S.saving = false;
      if (!d.ok) { S.said = d.message || 'That didn’t save. Try again.'; draw(); return; }
      ['done', 'skip', 'fav', 'suggest', 'updated'].forEach(function (f) { k[f] = d.kid[f]; });
      S.said = '';
      if (then) then(); else draw();
    });
  };

  // ----- the picker: whose passport? -----
  var drawPick = function () {
    setKidMode(true);
    var box = el('section', 'pp-pick');
    box.appendChild(el('h1', 'pp-h', 'Whose passport?'));
    if (!S.data.kids.length) {
      setKidMode(false);
      var none = el('div', 'panel pp-none');
      none.appendChild(el('h2', null, 'No names yet'));
      none.appendChild(el('p', null, 'The passport is one page per child. Add your kids’ first names on your account page (a nickname or an initial works), and each gets a passport here.'));
      var a = el('a', 'btn primary', 'Add their names'); a.href = D.links.kids; none.appendChild(a);
      box.appendChild(none);
      app.appendChild(box); return;
    }
    var row = el('div', 'pp-kids');
    S.data.kids.forEach(function (k, i) {
      var b = btn('pp-kidbtn', '', function () { S.kid = i; S.bracket = null; go('kid'); });
      b.appendChild(el('span', 'pp-kidini', k.name.charAt(0).toUpperCase()));
      b.appendChild(el('b', null, k.name));
      var e = earned(k.done);
      b.appendChild(el('small', null, e.n ? plural(countGot(e), 'stamp', 'stamps') : 'No stamps yet'));
      row.appendChild(b);
    });
    box.appendChild(row);
    box.appendChild(grownupRow());
    app.appendChild(box);
  };
  var countGot = function (e) { var n = 0; Object.keys(e.got).forEach(function (id) { if (e.got[id]) n++; }); return n + e.nh; };

  // The hold-to-open button for grown-ups: a press that lasts a second, so a tap does nothing.
  var grownupRow = function () {
    var row = el('div', 'pp-grown');
    var b = el('button', 'pp-hold'); b.type = 'button'; b.setAttribute('aria-label', 'Grown-ups: press and hold to open the settings');
    b.appendChild(el('span', 'pp-hold-bar')); b.appendChild(el('span', 'pp-hold-text', 'Grown-ups: press and hold'));
    var timer = null, started = 0;
    var start = function (ev) { if (ev.type === 'pointerdown' && ev.button !== 0) return; ev.preventDefault(); started = Date.now(); b.classList.add('holding'); timer = setTimeout(function () { b.classList.remove('holding'); go('grownup'); }, 1100); };
    var stop = function () { if (timer) { clearTimeout(timer); timer = null; } b.classList.remove('holding'); };
    if (window.PointerEvent) { b.addEventListener('pointerdown', start); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop); }
    else { b.addEventListener('mousedown', start); b.addEventListener('mouseup', stop); b.addEventListener('mouseleave', stop); b.addEventListener('touchstart', start, { passive: false }); b.addEventListener('touchend', stop); }
    b.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (!timer) start(ev); } });
    b.addEventListener('keyup', stop);
    b.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    row.appendChild(b);
    return row;
  };

  // ----- the child's page -----
  var drawKid = function () {
    var k = kid(); if (!k) { go('pick', false); return; }
    setKidMode(true);
    var e = earned(k.done);
    var page = el('section', 'pp-page');
    var head = el('div', 'pp-head');
    var back = btn('pp-back', '← Everyone', function () { go('pick'); }); head.appendChild(back);
    head.appendChild(el('h1', 'pp-h', possessive(k.name) + ' passport'));
    head.appendChild(el('p', 'pp-count', e.n ? plural(e.n, 'class or camp', 'classes and camps') + ' · ' + plural(countGot(e), 'stamp', 'stamps') + (e.nh ? ' · ' + plural(e.nh, 'neighborhood', 'neighborhoods') : '') : 'No stamps yet. A grown-up can add what you’ve been to.'));
    page.appendChild(head);

    // Stamps: earned first and bright, the rest waiting with how to get them.
    var st = el('div', 'pp-sec'); st.appendChild(el('h2', 'pp-h2', 'Stamps'));
    var grid = el('div', 'pp-stamps');
    var all = D.badges.map(function (b) { return { b: b, on: !!e.got[b.id] }; });
    e.hoods.forEach(function (h) { all.push({ b: { id: 'hood:' + hoodSlug(h), group: 'hood', label: h, how: 'A class in ' + h, color: '#1763B8', icon: D.pin }, on: true }); });
    all.sort(function (a, b) { return (b.on ? 1 : 0) - (a.on ? 1 : 0); });
    all.forEach(function (x) {
      var s = el('div', 'stamp' + (x.on ? ' on' : ' off')); s.setAttribute('role', 'img'); s.setAttribute('aria-label', x.b.label + (x.on ? ', earned' : ', not yet: ' + x.b.how));
      var disc = el('span', 'stamp-disc'); disc.style.background = x.on ? x.b.color : ''; disc.appendChild(svgIcon(x.b.icon, '#fff'));
      if (x.b.n && x.b.group === 'milestone' && !x.b.hoods) disc.appendChild(el('i', 'stamp-n', String(x.b.n)));
      s.appendChild(disc); s.appendChild(el('b', null, x.b.label)); s.appendChild(el('small', null, x.on ? '' : x.b.how));
      grid.appendChild(s);
    });
    st.appendChild(grid); page.appendChild(st);

    // The map: every place, pins only, names only.
    var places = [], seenPlace = {};
    k.done.forEach(function (x) { var st = siteOf(x); if (st && st.ll && !seenPlace[x.k + st.h]) { seenPlace[x.k + st.h] = true; places.push({ ll: st.ll, n: nameOf(x.k) }); } });
    var mp = el('div', 'pp-sec'); mp.appendChild(el('h2', 'pp-h2', 'Your map'));
    if (places.length) {
      var mapBox = el('div', 'pp-map'); mapBox.id = 'pp-map'; mp.appendChild(mapBox);
      mp.appendChild(el('p', 'pp-hint', plural(places.length, 'place', 'places') + ' you’ve been to. Only you and your grown-ups see this map.'));
      setTimeout(function () { drawMap(mapBox, places); }, 0);
    } else mp.appendChild(el('p', 'pp-hint', 'Your places show up here once you have a stamp.'));
    page.appendChild(mp);

    // Favorites and the bracket.
    var fv = el('div', 'pp-sec'); fv.appendChild(el('h2', 'pp-h2', 'Favorites'));
    var picks = distinct(k.done);
    if (k.fav.length) {
      var ol = el('ol', 'pp-fav');
      k.fav.forEach(function (key, i) { var li = el('li'); li.appendChild(el('span', 'pp-medal', i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1))); li.appendChild(el('b', null, nameOf(key))); ol.appendChild(li); });
      fv.appendChild(ol);
    }
    if (picks.length >= 2) fv.appendChild(btn('btn primary pp-big', k.fav.length ? 'Play the bracket again' : 'Play the bracket: pick your favorite', function () { startBracket(picks); }));
    else fv.appendChild(el('p', 'pp-hint', 'Once you have two or more stamps, you can play the bracket to pick your favorite.'));
    page.appendChild(fv);

    // What you've done, by year.
    if (k.done.length) {
      var dn = el('div', 'pp-sec'); dn.appendChild(el('h2', 'pp-h2', 'Where you’ve been'));
      var byYear = {};
      k.done.forEach(function (x) { var y = yearLabel(x); (byYear[y] = byYear[y] || []).push(x); });
      Object.keys(byYear).sort().reverse().forEach(function (y) {
        var g = el('div', 'pp-year'); g.appendChild(el('h3', null, y));
        var ul = el('ul', 'pp-done');
        byYear[y].forEach(function (x) { var li = el('li'); li.appendChild(el('b', null, nameOf(x.k))); li.appendChild(el('span', null, (D.kinds[x.kind] || x.kind) + (x.h ? ' · ' + x.h : ''))); ul.appendChild(li); });
        g.appendChild(ul); dn.appendChild(g);
      });
      page.appendChild(dn);
    }
    page.appendChild(grownupRow());
    app.appendChild(page);
  };
  var distinct = function (done) { var seen = {}, out = []; done.forEach(function (x) { if (!seen[x.k] && listing(x.k)) { seen[x.k] = true; out.push(x.k); } }); return out; };

  // The map library is loaded from this site the first time a map is drawn.
  var leafletReady = null;
  var loadLeaflet = function () {
    if (leafletReady) return leafletReady;
    leafletReady = new Promise(function (res) {
      if (window.L) { res(true); return; }
      var css = el('link'); css.rel = 'stylesheet'; css.href = D.leaflet + 'leaflet.css'; document.head.appendChild(css);
      var s = el('script'); s.src = D.leaflet + 'leaflet.js'; s.onload = function () { res(true); }; s.onerror = function () { res(false); }; document.head.appendChild(s);
    });
    return leafletReady;
  };
  var drawMap = function (box, places) {
    loadLeaflet().then(function (ok) {
      if (!ok || !box.isConnected) { box.textContent = 'The map couldn’t load.'; return; }
      var L = window.L, map = L.map(box, { scrollWheelZoom: false, tap: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
      var bounds = [];
      places.forEach(function (p) { L.circleMarker(p.ll, { radius: 11, color: '#0B2140', weight: 2, fillColor: '#F3C613', fillOpacity: 1 }).addTo(map).bindPopup(el('b', null, p.n)); bounds.push(p.ll); });
      if (bounds.length === 1) map.setView(bounds[0], 15); else map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      // in kid mode, the map's credit stays as text: no link leaves the page while a child is holding the phone
      box.addEventListener('click', function (ev) { var a = ev.target.closest ? ev.target.closest('a') : null; if (a && html.classList.contains('pp-kid')) { ev.preventDefault(); } }, true);
    });
  };

  // ----- the bracket: two at a time until one is left; the order they fell in is the ranking -----
  var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  var startBracket = function (keys) {
    S.bracket = { round: shuffle(keys), next: [], out: [], i: 0 };
    go('bracket');
  };
  var drawBracket = function () {
    var k = kid(), b = S.bracket; if (!k || !b) { go('kid', false); return; }
    setKidMode(true);
    var page = el('section', 'pp-page pp-bracket');
    var head = el('div', 'pp-head');
    head.appendChild(btn('pp-back', '← Stop', function () { S.bracket = null; go('kid'); }));
    head.appendChild(el('h1', 'pp-h', 'Which one wins?'));
    var left = b.round.length - b.i + b.next.length;
    head.appendChild(el('p', 'pp-count', left <= 2 ? 'The final!' : left + ' in the running'));
    page.appendChild(head);
    if (b.i + 1 >= b.round.length) {   // one left over this round, or the round is done
      if (b.i < b.round.length) b.next.push(b.round[b.i]);
      if (b.next.length === 1) {   // a champion
        var fav = [b.next[0]].concat(b.out.slice().reverse());
        S.bracket = null;
        save({ fav: fav }, function () { go('kid', false); });
        page.appendChild(el('p', 'pp-count', 'And the winner is… ' + nameOf(b.next[0]) + '!'));
        app.appendChild(page); return;
      }
      b.round = shuffle(b.next); b.next = []; b.i = 0;
    }
    var pair = [b.round[b.i], b.round[b.i + 1]];
    var vs = el('div', 'pp-vs');
    pair.forEach(function (key, idx) {
      var card = btn('pp-card', '', function () {
        var loser = pair[1 - idx];
        b.next.push(key); b.out.push(loser); b.i += 2;
        draw();
      });
      var l = listing(key);
      var disc = el('span', 'pp-card-disc'); var t = l && l.t && l.t.length ? D.typeMap[l.t[0]] : null;
      disc.style.background = t ? t.color : '#1763B8'; disc.appendChild(svgIcon(t ? t.icon : D.pin, '#fff'));
      card.appendChild(disc); card.appendChild(el('b', null, nameOf(key)));
      if (l && l.t && l.t.length && t) card.appendChild(el('small', null, t.label));
      vs.appendChild(card);
      if (idx === 0) vs.appendChild(el('span', 'pp-or', 'or'));
    });
    page.appendChild(vs);
    app.appendChild(page);
  };

  // ----- the grown-ups' side: confirm, add, take off, share, print -----
  var drawGrownup = function () {
    setKidMode(false);
    var k = kid();
    var page = el('section', 'pp-grownup');
    var head = el('div', 'pp-ghead');
    head.appendChild(el('h2', null, k ? possessive(k.name) + ' passport: grown-ups' : 'Passports: grown-ups'));
    var acts = el('div', 'actions');
    acts.appendChild(btn('btn primary', k ? 'Back to ' + possessive(k.name) + ' passport' : 'Back to the passports', function () { go(k ? 'kid' : 'pick'); }));
    if (S.data.kids.length > 1 || !k) acts.appendChild(btn('btn', 'Pick a child', function () { go('pick'); }));
    var acct = el('a', 'btn', 'My account'); acct.href = D.links.account; acts.appendChild(acct);
    head.appendChild(acts);
    head.appendChild(el('p', 'hint', 'Only what you confirm here counts. Stamps, the map and the bracket are worked out from it; nothing about your child is sent anywhere or counted by anything.'));
    page.appendChild(head);
    if (S.said) page.appendChild(el('p', 'g-status bad', S.said));
    if (!k) { page.appendChild(el('p', null, 'Pick a child to see their suggestions.')); app.appendChild(page); return; }

    // Suggestions from the plans.
    var sg = el('div', 'panel'); sg.appendChild(el('h3', null, 'From your plans'));
    if (k.suggest.length) {
      sg.appendChild(el('p', 'hint', 'These are on ' + possessive(k.name) + ' kept week, summer or days off. Did ' + k.name + ' go?'));
      var ul = el('ul', 'pp-suggest');
      k.suggest.forEach(function (sgt) {
        var li = el('li');
        var what = el('div', 'pp-sg-what'); what.appendChild(el('b', null, nameOf(sgt.k))); what.appendChild(el('span', null, (D.kinds[sgt.kind] || sgt.kind) + ', ' + yearLabel(sgt)));
        li.appendChild(what);
        var yes = btn('btn primary', 'Yes, add it', function () { save({ done: k.done.concat([sgt]) }); });
        var no = btn('btn', 'No', function () { save({ skip: k.skip.concat([sgt.k + '|' + sgt.kind + '|' + sgt.y]) }); });
        var row = el('div', 'pp-sg-acts'); row.appendChild(yes); row.appendChild(no); li.appendChild(row);
        ul.appendChild(li);
      });
      sg.appendChild(ul);
    } else sg.appendChild(el('p', 'hint', 'Nothing waiting. A program on ' + possessive(k.name) + ' kept week, a camp whose week has started, or a day-off camp whose day has passed shows up here to confirm.'));
    page.appendChild(sg);

    // Add one by hand.
    var ad = el('div', 'panel'); ad.appendChild(el('h3', null, 'Add one the plans missed'));
    var form = el('form', 'pp-add');
    var f1 = el('div', 'field'); var lab = el('label', null, 'Program or camp'); lab.htmlFor = 'pp-add-q'; f1.appendChild(lab);
    var q = el('input'); q.id = 'pp-add-q'; q.type = 'search'; q.autocomplete = 'off'; q.placeholder = 'Start typing a name'; q.setAttribute('role', 'combobox'); q.setAttribute('aria-expanded', 'false'); f1.appendChild(q);
    var hits = el('ul', 'finder-list pp-hits'); hits.hidden = true; hits.setAttribute('role', 'listbox'); f1.appendChild(hits);
    form.appendChild(f1);
    var picked = null, pickedLine = el('p', 'pp-picked'); pickedLine.hidden = true; form.appendChild(pickedLine);
    var f2 = el('div', 'pair');
    var kindSel = el('select'); kindSel.id = 'pp-add-kind'; Object.keys(D.kinds).forEach(function (kd) { var o = el('option', null, D.kinds[kd]); o.value = kd; kindSel.appendChild(o); });
    var yearSel = el('select'); yearSel.id = 'pp-add-year';
    var kf = el('div', 'field'), kl = el('label', null, 'What kind'); kl.htmlFor = kindSel.id; kf.appendChild(kl); kf.appendChild(kindSel);
    var yf = el('div', 'field'), yl = el('label', null, 'When'); yl.htmlFor = yearSel.id; yf.appendChild(yl); yf.appendChild(yearSel);
    f2.appendChild(kf); f2.appendChild(yf); form.appendChild(f2);
    var fillYears = function () {
      yearSel.textContent = '';
      var summer = kindSel.value === 'summer';
      for (var y = D.year + (summer ? 0 : 0); y >= D.year - 4; y--) { var o = el('option', null, summer ? 'Summer ' + y : y + '–' + String(y + 1).slice(2)); o.value = String(y); yearSel.appendChild(o); }
    };
    fillYears(); kindSel.addEventListener('change', fillYears);
    var addBtn = el('button', 'btn primary', 'Add to the passport'); addBtn.type = 'submit'; addBtn.disabled = true;
    var fa = el('div', 'actions'); fa.appendChild(addBtn); form.appendChild(fa);
    var render = function () {
      var words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
      hits.textContent = '';
      if (!words.length) { hits.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
      var found = Object.keys(D.listings).filter(function (key) { var n = D.listings[key].n.toLowerCase(); return words.every(function (w) { return n.indexOf(w) > -1; }); }).slice(0, 8);
      found.forEach(function (key) {
        var li = el('li'); li.setAttribute('role', 'option');
        var b = btn('', D.listings[key].n + (key.charAt(0) === 'c' ? ' (summer camp)' : ''), function () { picked = key; pickedLine.textContent = 'Adding: ' + D.listings[key].n; pickedLine.hidden = false; if (key.charAt(0) === 'c') { kindSel.value = 'summer'; fillYears(); } q.value = ''; hits.hidden = true; addBtn.disabled = false; });
        li.appendChild(b); hits.appendChild(li);
      });
      if (!found.length) hits.appendChild(el('li', 'finder-note', 'Nothing by that name on the site yet.'));
      hits.hidden = false; q.setAttribute('aria-expanded', 'true');
    };
    q.addEventListener('input', render);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); if (!picked) return;
      var e = { k: picked, kind: kindSel.value, y: parseInt(yearSel.value, 10), s: '' };
      var dup = k.done.some(function (x) { return x.k === e.k && x.kind === e.kind && x.y === e.y; });
      if (dup) { S.said = 'That one is already on the passport for that year.'; draw(); return; }
      save({ done: k.done.concat([e]) });
    });
    ad.appendChild(form); page.appendChild(ad);

    // What's on it, with a way to take one off, and a review in the child's words.
    var dl = el('div', 'panel'); dl.appendChild(el('h3', null, 'On the passport'));
    if (k.done.length) {
      var list = el('ul', 'pp-donelist');
      k.done.slice().sort(function (a, b) { return b.y - a.y; }).forEach(function (x) {
        var li = el('li');
        var what = el('div', 'pp-sg-what'); what.appendChild(el('b', null, nameOf(x.k))); what.appendChild(el('span', null, (D.kinds[x.kind] || x.kind) + ', ' + yearLabel(x) + (x.s && D.schools[x.s] ? ', from ' + D.schools[x.s].n : '') + (x.h ? ', ' + x.h : '')));
        if (needsSite(x)) {   // several sites: which one, for the neighborhood stamp and the map
          var ask = el('div', 'pp-sites'); ask.appendChild(el('span', 'hint', 'Which location? '));
          listing(x.k).sites.forEach(function (st) { ask.appendChild(btn('chip-btn', st.h, function () { x.h = st.h; save({ done: k.done }); })); });
          what.appendChild(ask);
        }
        li.appendChild(what);
        var row = el('div', 'pp-sg-acts');
        if (x.k.charAt(0) === 'p' && D.links.review) {
          var rv = el('a', 'btn', 'Review in ' + possessive(k.name) + ' words');
          rv.href = D.links.review + '?program=' + encodeURIComponent(x.k.slice(2)) + (x.s ? '&school=' + encodeURIComponent(x.s) : '') + '&kid=' + encodeURIComponent(k.name) + (k.grade ? '&grade=' + encodeURIComponent(k.grade) : '');
          row.appendChild(rv);
        }
        row.appendChild(btn('btn', 'Take off', function () { save({ done: k.done.filter(function (y) { return y !== x; }) }); }));
        li.appendChild(row); list.appendChild(li);
      });
      dl.appendChild(list);
    } else dl.appendChild(el('p', 'hint', 'Nothing yet.'));
    page.appendChild(dl);

    // A picture to share (no name, no pins), and print.
    var sh = el('div', 'panel'); sh.appendChild(el('h3', null, 'Share the stamps'));
    sh.appendChild(el('p', 'hint', 'A picture of the stamps and the neighborhoods, with no name and no map, for the group chat or the fridge. It’s made here on this device; nothing is uploaded.'));
    var prev = el('canvas', 'pp-canvas'); prev.width = 1080; prev.height = 1350; prev.setAttribute('role', 'img'); prev.setAttribute('aria-label', 'A picture of the stamps');
    drawShare(prev, k);
    var pv = el('div', 'card-preview'); pv.appendChild(prev); sh.appendChild(pv);
    var sa = el('div', 'actions');
    if (navigator.share && navigator.canShare) sa.appendChild(btn('btn primary', 'Share the picture', function () { prev.toBlob(function (blob) { var f = new File([blob], 'passport.png', { type: 'image/png' }); if (navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: 'Our passport' }).catch(function () { /* closed */ }); }, 'image/png'); }));
    sa.appendChild(btn('btn', 'Save as image', function () { prev.toBlob(function (blob) { var a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'passport.png'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); }));
    sa.appendChild(btn('btn', 'Print the passport', function () { go('kid', false); setTimeout(function () { window.print(); }, 300); }));
    sh.appendChild(sa); page.appendChild(sh);
    app.appendChild(page);
  };

  // The picture: the site's name, the stamps earned, the neighborhoods. No child's name, no places on a map.
  var drawShare = function (c, k) {
    var ctx = c.getContext('2d'), W = c.width, H = c.height, e = earned(k.done);
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#DAEDFE'); g.addColorStop(1, '#F5F8FC'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0B2140'; ctx.textAlign = 'center';
    ctx.font = '400 92px "Luckiest Guy", "Arial Black", Impact, sans-serif'; ctx.fillText('MY PASSPORT', W / 2, 150);
    ctx.font = '800 36px Figtree, Arial, sans-serif'; ctx.fillStyle = '#4D607A'; ctx.fillText(D.site, W / 2, 205);
    ctx.font = '800 44px Figtree, Arial, sans-serif'; ctx.fillStyle = '#0B2140';
    ctx.fillText(plural(e.n, 'class or camp', 'classes and camps') + ' · ' + plural(countGot(e), 'stamp', 'stamps'), W / 2, 275);
    var on = D.badges.filter(function (b) { return e.got[b.id]; }).map(function (b) { return { label: b.label, color: b.color, icon: b.icon }; });
    e.hoods.forEach(function (h) { on.push({ label: h, color: '#1763B8', icon: D.pin }); });
    var cols = 4, size = 200, pad = 30, x0 = (W - cols * size - (cols - 1) * pad) / 2, y0 = 330;
    on.slice(0, 16).forEach(function (b, i) {
      var x = x0 + (i % cols) * (size + pad), y = y0 + Math.floor(i / cols) * (size + 60);
      ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2 - 10, 78, 0, Math.PI * 2); ctx.fillStyle = b.color; ctx.fill();
      ctx.save(); ctx.translate(x + size / 2 - 48, y + size / 2 - 58); ctx.scale(4, 4); ctx.fillStyle = '#fff'; try { ctx.fill(new Path2D(b.icon)); } catch (err) { /* no Path2D */ } ctx.restore();
      ctx.fillStyle = '#0B2140'; ctx.font = '800 26px Figtree, Arial, sans-serif'; ctx.fillText(b.label.length > 18 ? b.label.slice(0, 17) + '…' : b.label, x + size / 2, y + size / 2 + 105);
    });
    if (on.length > 16) { ctx.font = '700 28px Figtree, Arial, sans-serif'; ctx.fillStyle = '#4D607A'; ctx.fillText('and ' + (on.length - 16) + ' more', W / 2, H - 120); }
    if (!on.length) { ctx.font = '700 34px Figtree, Arial, sans-serif'; ctx.fillStyle = '#4D607A'; ctx.fillText('The first stamp is the first class.', W / 2, 520); }
    ctx.font = '700 28px Figtree, Arial, sans-serif'; ctx.fillStyle = '#4D607A'; ctx.fillText(D.url, W / 2, H - 60);
  };

  // ----- drawing -----
  var draw = function () {
    app.textContent = '';
    if (S.view === 'kid') drawKid();
    else if (S.view === 'bracket') drawBracket();
    else if (S.view === 'grownup') drawGrownup();
    else drawPick();
  };

  // ----- start -----
  if (!signedIn()) { setKidMode(false); return; }   // the page's own signed-out panel stays
  outBox.hidden = true;
  call('me').then(function (d) {
    if (!d.ok || !d.user) { try { localStorage.removeItem('pas-in'); } catch (e) { /* storage */ } html.classList.remove('signed'); outBox.hidden = false; if (waitEl) waitEl.hidden = true; return; }
    return call('passport').then(function (p) {
      if (waitEl) waitEl.hidden = true;
      if (!p.ok) { outBox.hidden = false; outBox.insertBefore(el('p', 'g-status bad', p.message || 'Couldn’t open the passport just now. Reload to try again.'), outBox.firstChild); return; }
      S.data = p; app.hidden = false;
      var h = (location.hash || '').slice(1);
      if (p.kids.length === 1) S.kid = 0;   // one child: straight to their page
      S.view = (h === 'grownup') ? 'grownup' : S.kid > -1 && (h === 'kid' || p.kids.length === 1) ? 'kid' : 'pick';
      try { history.replaceState({ pp: S.view, kid: S.kid }, '', location.pathname + (S.view === 'pick' ? '' : '#' + S.view)); } catch (e) { /* no history */ }
      draw();
    });
  });
})();
