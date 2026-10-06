// Accounts and share groups: signing in by email, the profile page, a group's page, and "add this week to a group"
// on the roster page. Loaded only on those three pages. Talks to groups/api.php; see src/server/groups-api.php.
(function () {
  'use strict';
  var host = document.querySelector('[data-groups]');
  if (!host || !window.fetch || !window.Promise) return;
  var ROOT = host.getAttribute('data-root') || '';          // path back to the top of the site
  var INDEX = host.getAttribute('data-index') || '';        // "index.html" in the preview copy
  var API = host.getAttribute('data-api');                  // empty in the preview copy: nothing to talk to
  var KL_KEY = host.getAttribute('data-kl-key') || '', KL_LIST = host.getAttribute('data-kl-list') || '';   // the email list accounts are added to
  var LIST_NOTE = KL_LIST ? 'Making an account adds your name and email to our email list, for occasional news about the site. Every email has an unsubscribe link.' : '';
  var DAYS = [['mon', 'Monday', 'Mon'], ['tue', 'Tuesday', 'Tue'], ['wed', 'Wednesday', 'Wed'], ['thu', 'Thursday', 'Thu'], ['fri', 'Friday', 'Fri']];

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(cls, text) { var b = el('button', cls, text); b.type = 'button'; return b; }
  function get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function set(key, value) { try { if (value == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch (e) { /* storage blocked */ } }
  function page(path) { return ROOT + path + INDEX; }
  function signedInHint() { return get('pas-in') === '1'; }
  function query() {
    var out = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (p) { var i = p.indexOf('='); if (i > 0) { try { out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); } catch (e) { /* ignore */ } } });
    return out;
  }
  // Destructive buttons take two taps.
  function twoTap(b, armedText, go) {
    var first = b.textContent;
    b.addEventListener('click', function () {
      if (!b.getAttribute('data-armed')) { b.setAttribute('data-armed', '1'); b.textContent = armedText; window.setTimeout(function () { b.removeAttribute('data-armed'); b.textContent = first; }, 6000); return; }
      b.removeAttribute('data-armed'); b.textContent = first; go();
    });
  }

  function call(action, body, extra) {
    if (!API) return Promise.resolve({ ok: false, http: 0, message: 'Groups don’t work in this preview copy of the site.' });
    var opts = { credentials: 'same-origin', headers: { 'X-PAS': '1' } };
    if (body) { opts.method = 'POST'; opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return window.fetch(API + '?action=' + action + (extra || ''), opts).then(function (r) {
      return r.json().then(function (d) {
        d.http = r.status;
        if (r.status === 401) set('pas-in', null);
        return d;
      }, function () { return { ok: false, http: r.status, message: 'Something went wrong on our side. Please try again.' }; });
    }, function () { return { ok: false, http: 0, message: 'Couldn’t reach the site. Check your connection and try again.' }; });
  }

  // ----- signing in: an email with a link (for this device) and a 6-digit code (for the page that asked) -----
  function signInBox(box, next, done, lede) {
    box.textContent = '';
    var wrap = el('div', 'signin');
    wrap.appendChild(el('h3', null, 'Sign in with your email'));
    wrap.appendChild(el('p', 'hint', lede || 'No password. We email you a link and a 6-digit code; either one signs you in.'));
    var form = el('form', 'signin-row');
    var input = el('input'); input.type = 'email'; input.required = true; input.autocomplete = 'email'; input.placeholder = 'you@example.com'; input.setAttribute('aria-label', 'Your email'); input.maxLength = 150;
    var send = el('button', 'btn primary', 'Email me a sign-in link'); send.type = 'submit';
    form.appendChild(input); form.appendChild(send);
    var status = el('p', 'g-status'); status.setAttribute('aria-live', 'polite');
    var codeForm = el('form', 'signin-row'); codeForm.hidden = true;
    var code = el('input'); code.type = 'text'; code.inputMode = 'numeric'; code.autocomplete = 'one-time-code'; code.maxLength = 7; code.placeholder = '123 456'; code.setAttribute('aria-label', '6-digit code from the email');
    var go = el('button', 'btn primary', 'Sign in'); go.type = 'submit';
    codeForm.appendChild(code); codeForm.appendChild(go);
    wrap.appendChild(form); wrap.appendChild(status); wrap.appendChild(codeForm);
    box.appendChild(wrap);
    var req = '';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim())) { status.textContent = 'That email address doesn’t look right.'; status.className = 'g-status bad'; return; }
      send.disabled = true; status.className = 'g-status'; status.textContent = 'Sending…';
      call('login_start', { email: input.value.trim(), next: next }).then(function (d) {
        send.disabled = false;
        if (!d.ok) { status.textContent = d.message; status.className = 'g-status bad'; return; }
        req = d.req;
        status.className = 'g-status good';
        status.textContent = 'Check your email. Tap the link on this device, or type the 6-digit code here. Both last ' + d.minutes + ' minutes.';
        send.textContent = 'Send a new email';
        codeForm.hidden = false; code.focus();
      });
    });
    codeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      go.disabled = true;
      call('login_finish', { req: req, code: code.value }).then(function (d) {
        go.disabled = false;
        if (!d.ok) { status.textContent = d.message; status.className = 'g-status bad'; if (d.error === 'expired') { codeForm.hidden = true; } return; }
        set('pas-in', '1');
        done(d);
      });
    });
  }

  // ----- every account has a first and last name; a new one is added to the email list, once -----
  function nameFields(prefix, me) {
    var wrap = el('div', 'pair');
    var mk = function (id, label, value, auto, max) {
      var f = el('div', 'field'), l = el('label', null, label), i = el('input');
      l.htmlFor = prefix + id; i.id = prefix + id; i.type = 'text'; i.required = true; i.maxLength = max; i.value = value || ''; i.autocomplete = auto;
      f.appendChild(l); f.appendChild(i); wrap.appendChild(f);
      return i;
    };
    var first = mk('first', 'Your first name', me.first, 'given-name', 30), last = mk('last', 'Your last name', me.last, 'family-name', 40);
    return { box: wrap, first: first, last: last };
  }
  function listOnce(me) {
    if (!me || me.listed || me.listing || !me.ready || !KL_KEY || !KL_LIST || !API) return;
    me.listing = true;   // one try per page, however many times this is called
    window.fetch('https://a.klaviyo.com/client/subscriptions?company_id=' + encodeURIComponent(KL_KEY), {
      method: 'POST',
      headers: { 'content-type': 'application/vnd.api+json', revision: '2026-07-15' },
      body: JSON.stringify({ data: { type: 'subscription',
        attributes: { custom_source: 'phillyafterschool.org account', profile: { data: { type: 'profile', attributes: { email: me.email, first_name: me.first, last_name: me.last, properties: { has_account: true }, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } } } },
        relationships: { list: { data: { type: 'list', id: KL_LIST } } } } })
    }).then(function (r) { if (r.status >= 200 && r.status < 300) { me.listed = true; call('listed', {}); } }, function () { /* blocked or offline: it is tried again at the next sign-in */ });
  }
  function saveNames(me, first, last) {
    return call('set_name', { first: first, last: last }).then(function (r) {
      if (r.ok) { me.first = r.first; me.last = r.last; me.ready = true; listOnce(me); }
      return r;
    });
  }

  // =====================================================================================================
  // The profile page: sign in, your first name, your groups, make a group, sign out, delete the account
  // =====================================================================================================
  var account = document.getElementById('account');
  if (account) {
    set('pas-groups', '1');   // while groups are a pilot, visiting this page is what switches them on in this browser
    var goNext = function (next) {
      if (next === 'board') { location.href = page('board/') + '?group=1'; return true; }
      var m = /^groups\?g=([A-Za-z0-9]+)$/.exec(next || '');
      if (m) { location.href = page('groups/') + '?g=' + m[1]; return true; }
      return false;
    };
    var drawSignedOut = function (msg) {
      account.textContent = '';
      if (msg) { var p = el('p', 'g-status bad', msg); account.appendChild(p); }
      var box = el('div', 'panel'); account.appendChild(box);
      signInBox(box, 'account', function (d) { drawProfile(d); });
    };
    var drawProfile = function (d) {
      account.textContent = '';
      var me = d.user, groups = d.groups || [];
      if (!me.ready) {   // a new account: first and last name, then the rest
        var fin = el('section', 'panel');
        fin.appendChild(el('h2', null, 'Finish your account'));
        var fl = el('p', null, 'Signed in as '); fl.appendChild(el('b', null, me.email)); fin.appendChild(fl);
        var ff = el('form', 'g-form'), fn = nameFields('new-', me);
        ff.appendChild(fn.box);
        ff.appendChild(el('p', 'hint', 'A group’s creator sees your name when you ask to join, so they know who you are. Other members don’t see it. ' + LIST_NOTE));
        var fs = el('p', 'g-status'); fs.setAttribute('aria-live', 'polite'); ff.appendChild(fs);
        var fa = el('div', 'actions'), fb = el('button', 'btn primary', 'Finish'); fb.type = 'submit';
        var fo = btn('btn', 'Sign out'); fo.addEventListener('click', function () { call('logout', {}).then(function () { set('pas-in', null); drawSignedOut(); }); });
        fa.appendChild(fb); fa.appendChild(fo); ff.appendChild(fa);
        ff.addEventListener('submit', function (e) {
          e.preventDefault(); fb.disabled = true;
          saveNames(me, fn.first.value, fn.last.value).then(function (r) { fb.disabled = false; if (!r.ok) { fs.textContent = r.message; fs.className = 'g-status bad'; return; } drawProfile(d); });
        });
        fin.appendChild(ff); account.appendChild(fin);
        fn.first.focus();
        return;
      }
      listOnce(me);
      // who you are
      var who = el('section', 'panel');
      who.appendChild(el('h2', null, 'Your account'));
      var line = el('p', null, 'Signed in as '); line.appendChild(el('b', null, me.email)); who.appendChild(line);
      var nameForm = el('form', 'g-form'), nf0 = nameFields('acct-', me);
      var nameSave = el('button', 'btn', 'Save'); nameSave.type = 'submit';
      var nameNote = el('span', 'hint'); nameNote.setAttribute('aria-live', 'polite');
      var nameActs = el('div', 'actions'); nameActs.appendChild(nameSave); nameActs.appendChild(nameNote);
      nameForm.appendChild(nf0.box); nameForm.appendChild(nameActs);
      who.appendChild(nameForm);
      who.appendChild(el('p', 'hint', 'A group’s creator sees your name when you ask to join, so they know who you are. Other members don’t see it.'));
      nameForm.addEventListener('submit', function (e) {
        e.preventDefault();
        saveNames(me, nf0.first.value, nf0.last.value).then(function (r) { nameNote.textContent = r.ok ? 'Saved.' : r.message; if (r.ok) { nf0.first.value = r.first; nf0.last.value = r.last; } });
      });
      account.appendChild(who);
      // your groups
      var mine = el('section', 'panel');
      mine.appendChild(el('h2', null, 'Your groups'));
      var noneYet = el('p', 'hint', 'You’re not in any groups yet. Make one below, or join one from Build your week with a code someone gave you.');
      if (!groups.length) mine.appendChild(noneYet);
      var list = el('ul', 'g-list');
      groups.forEach(function (g) {
        var li = el('li');
        var a = el('a', null, g.name); a.href = page('groups/') + '?g=' + g.id; li.appendChild(a);
        var what = g.status !== 'approved' ? 'Waiting for the creator to approve you' : g.role === 'owner' ? 'You made this group' : g.role === 'viewer' ? 'Viewing only' : 'Member';
        if (g.kids && g.kids.length) what += ' · ' + g.kids.map(function (k) { return k.name; }).join(', ');
        li.appendChild(el('span', 'hint', what));
        if (g.waiting) li.appendChild(el('span', 'pill pickup', g.waiting + ' waiting for you'));
        list.appendChild(li);
      });
      mine.appendChild(list);
      account.appendChild(mine);
      // make a group
      var make = el('section', 'panel');
      make.appendChild(el('h2', null, 'Make a group'));
      make.appendChild(el('p', null, 'For a class, a carpool or a few friends. You get a code to hand out, and you approve each person before they can see anything.'));
      var makeForm = el('form', 'g-row');
      var gl = el('label', null, 'Group name'); gl.htmlFor = 'new-group';
      var gi = el('input'); gi.id = 'new-group'; gi.type = 'text'; gi.maxLength = 50; gi.placeholder = 'Room 12';
      var gb = el('button', 'btn primary', 'Make the group'); gb.type = 'submit';
      makeForm.appendChild(gl); makeForm.appendChild(gi); makeForm.appendChild(gb);
      var made = el('div', 'g-made'); made.setAttribute('aria-live', 'polite');
      make.appendChild(makeForm); make.appendChild(made);
      makeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        Promise.resolve({ ok: true }).then(function () {
          call('group_create', { name: gi.value }).then(function (c) {
            made.textContent = '';
            if (!c.ok) { made.appendChild(el('p', 'g-status bad', c.message)); return; }
            made.appendChild(el('p', 'g-status good', '“' + c.name + '” is ready. Give this code to the parents and teacher you want in it:'));
            made.appendChild(el('p', 'g-code', c.code));
            var acts = el('div', 'actions');
            var add = el('a', 'btn primary', 'Add your child’s week'); add.href = page('board/') + '?group=' + c.id;
            var open = el('a', 'btn', 'Open the group'); open.href = page('groups/') + '?g=' + c.id;
            acts.appendChild(add); acts.appendChild(open); made.appendChild(acts);
            gi.value = '';
            if (noneYet.parentNode) noneYet.parentNode.removeChild(noneYet);
            var li = el('li'); var a = el('a', null, c.name); a.href = open.href; li.appendChild(a); li.appendChild(el('span', 'hint', 'You made this group')); list.appendChild(li);
          });
        });
      });
      account.appendChild(make);
      // leaving
      var out = el('section', 'panel');
      out.appendChild(el('h2', null, 'Signing out'));
      var acts = el('div', 'actions');
      var so = btn('btn', 'Sign out'), sa = btn('btn', 'Sign out on every device'), del = btn('clear', 'Delete my account');
      acts.appendChild(so); acts.appendChild(sa); acts.appendChild(del);
      out.appendChild(acts);
      out.appendChild(el('p', 'hint', 'Deleting your account removes your email, every week you shared with a group, and every group you made (for everyone in it). Rosters saved on this device stay.'));
      so.addEventListener('click', function () { call('logout', {}).then(function () { set('pas-in', null); drawSignedOut(); }); });
      sa.addEventListener('click', function () { call('logout_all', {}).then(function () { set('pas-in', null); drawSignedOut(); }); });
      twoTap(del, 'Tap again to delete everything', function () { call('delete_account', {}).then(function (r) { if (r.ok) { set('pas-in', null); unlinkAll(); drawSignedOut('Your account and everything you shared are deleted.'); } }); });
      account.appendChild(out);
    };
    // Arriving from the email: the token is after the #, so it never reaches a server log. Use it once and take it out of the address.
    var tok = /(?:^#|&)t=([A-Za-z0-9_-]{20,80})/.exec(location.hash);
    if (tok) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
      account.appendChild(el('p', 'g-status', 'Signing you in…'));
      call('login_finish', { token: tok[1] }).then(function (d) {
        if (!d.ok) { drawSignedOut(d.message); return; }
        set('pas-in', '1');
        if (!goNext(d.next)) drawProfile(d);
      });
    } else {
      call('me').then(function (d) {
        if (d.ok && d.user) { set('pas-in', '1'); drawProfile(d); } else { if (d.ok) set('pas-in', null); drawSignedOut(API ? (d.ok ? '' : d.message) : d.message); }
      });
    }
  }

  // Forget, on this device, which rosters were shared (after deleting the account, or when a group says a week is gone).
  function unlinkAll() {
    try {
      var r = JSON.parse(window.localStorage.getItem('pas-rosters') || 'null');
      if (r && Array.isArray(r.kids)) { r.kids.forEach(function (k) { delete k.groups; }); window.localStorage.setItem('pas-rosters', JSON.stringify(r)); }
    } catch (e) { /* nothing saved */ }
  }

  // =====================================================================================================
  // A group's page: first names and programs, by day and by child. Only an approved, signed-in member gets the data.
  // =====================================================================================================
  var groupBox = document.getElementById('group');
  if (groupBox) {
    set('pas-groups', '1');
    var info = JSON.parse(document.getElementById('groups-data').textContent);
    var gid = (query().g || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 30);
    var title = document.getElementById('group-title'), lede = document.getElementById('group-lede');
    var which = 'now';
    var say = function (msg, kind) { var p = document.getElementById('group-say'); if (!p) return; p.textContent = msg || ''; p.className = 'g-status' + (kind ? ' ' + kind : ''); };
    var progName = function (entry) {
      var i = entry.indexOf('~'), id = i < 0 ? entry : entry.slice(0, i), p = info.programs[id];
      return { id: id, name: p ? p.name : 'A program no longer listed', cls: i < 0 ? '' : entry.slice(i + 1), color: p && info.types[p.type] ? info.types[p.type].color : '#0F4D90' };
    };
    var load = function () {
      if (!gid) { location.replace(page('account/')); return; }
      call('group', null, '&g=' + gid).then(function (d) {
        if (d.http === 401) {
          groupBox.textContent = '';
          var box = el('div', 'panel'); groupBox.appendChild(box);
          signInBox(box, 'groups?g=' + gid, function () { load(); }, 'This group is only for its members. Sign in with the email you joined with. No password: we email you a link and a 6-digit code.');
          return;
        }
        if (!d.ok) { groupBox.textContent = ''; var p = el('div', 'panel'); p.appendChild(el('p', null, d.message)); var a = el('a', 'btn', 'Your groups'); a.href = page('account/'); p.appendChild(a); groupBox.appendChild(p); return; }
        set('pas-in', '1');
        draw(d);
      });
    };
    var draw = function (d) {
      groupBox.textContent = '';
      title.textContent = d.name;
      document.title = d.name + ' | ' + info.site;
      if (d.status !== 'approved') {
        lede.textContent = 'You’ve asked to join.';
        var w = el('div', 'panel');
        w.appendChild(el('h2', null, 'Waiting for approval'));
        w.appendChild(el('p', null, 'The person who made this group has been emailed. You’ll get an email when they let you in, and nothing in the group shows until then.'));
        var wa = el('div', 'actions'); var leave0 = btn('clear', 'Take back my request');
        twoTap(leave0, 'Tap again to take it back', function () { call('group_leave', { group: gid }).then(function () { location.href = page('account/'); }); });
        wa.appendChild(leave0); w.appendChild(wa); groupBox.appendChild(w);
        return;
      }
      var kids = d.kids || [];
      // Open on whichever has more in it: early in a term that is usually the upcoming one.
      var count = function (w) { var n = 0; kids.forEach(function (k) { DAYS.forEach(function (dd) { n += (k[w][dd[0]] || []).length; }); }); return n; };
      if (!draw.picked) { which = count('next') > count('now') ? 'next' : 'now'; }
      lede.textContent = kids.length ? kids.length + (kids.length === 1 ? ' child' : ' children') + '. First names and programs only, seen by the people this group’s creator has approved.' : 'Nobody has added a week yet.';
      var status = el('p', 'g-status'); status.id = 'group-say'; status.setAttribute('aria-live', 'polite'); groupBox.appendChild(status);

      // the owner's to-do: people waiting
      if (d.role === 'owner') {
        var waiting = (d.members || []).filter(function (m) { return m.status !== 'approved'; });
        if (waiting.length) {
          var wp = el('section', 'panel g-waiting');
          wp.appendChild(el('h2', null, waiting.length === 1 ? 'One person is waiting' : waiting.length + ' people are waiting'));
          wp.appendChild(el('p', 'hint', 'Approve only people you know belong here. Until you do, they see nothing.'));
          var wl = el('ul', 'g-list');
          waiting.forEach(function (m) {
            var li = el('li');
            li.appendChild(el('b', null, m.name || 'Someone'));
            li.appendChild(el('span', 'hint', m.role === 'viewer' ? 'wants to view only (a teacher or caregiver)' : 'wants to add ' + (m.kids.join(', ') || 'a child')));
            var ok = btn('btn primary', 'Approve'), no = btn('btn', 'Decline');
            ok.addEventListener('click', function () { call('member_decide', { group: gid, member: m.id, approve: true }).then(load); });
            no.addEventListener('click', function () { call('member_decide', { group: gid, member: m.id, approve: false }).then(load); });
            var a = el('span', 'actions'); a.appendChild(ok); a.appendChild(no); li.appendChild(a);
            wl.appendChild(li);
          });
          wp.appendChild(wl); groupBox.appendChild(wp);
        }
      }

      // current or upcoming
      var tabs = el('div', 'tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Current or upcoming');
      [['now', 'Current'], ['next', 'Upcoming']].forEach(function (t) {
        var b = btn('tab', t[1]); b.setAttribute('aria-pressed', String(which === t[0]));
        b.addEventListener('click', function () { which = t[0]; draw.picked = true; draw(d); });
        tabs.appendChild(b);
      });
      var view = el('section', 'section');
      view.appendChild(tabs);

      if (!kids.length) {
        var none = el('div', 'panel');
        none.appendChild(el('p', null, 'No weeks here yet. Add your child’s from Build your week, and hand the code to the others.'));
        var na = el('a', 'btn primary', 'Add a week'); na.href = page('board/') + '?group=' + gid; none.appendChild(na);
        view.appendChild(none);
      } else {
        // by day: each program, and who is there
        view.appendChild(el('h2', null, 'By day'));
        var grid = el('div', 'week g-week');
        DAYS.forEach(function (day) {
          var col = el('section', 'daycol');
          col.appendChild(el('h3', null, day[1]));
          var by = {}, order = [], off = [];
          kids.forEach(function (k) {
            var list = (k[which][day[0]] || []);
            if (!list.length) { off.push(k.name); return; }
            list.forEach(function (e) {
              var p = progName(e), key = p.id;
              if (!by[key]) { by[key] = { p: p, names: [] }; order.push(key); }
              by[key].names.push(k.name + (p.cls ? ' (' + p.cls + ')' : ''));
            });
          });
          order.sort(function (a, b) { return by[b].names.length - by[a].names.length || by[a].p.name.localeCompare(by[b].p.name); });
          order.forEach(function (key) {
            var card = el('div', 'g-prog'); card.style.setProperty('--tc', by[key].p.color);
            card.appendChild(el('b', null, by[key].p.name));
            card.appendChild(el('span', null, by[key].names.join(', ')));
            col.appendChild(card);
          });
          if (off.length) { var o = el('p', 'hint g-off'); o.appendChild(el('b', null, 'Nothing listed: ')); o.appendChild(document.createTextNode(off.join(', '))); col.appendChild(o); }
          grid.appendChild(col);
        });
        view.appendChild(grid);
        // by child: the sheet a teacher can print
        var head = el('div', 'g-head');
        head.appendChild(el('h2', null, 'By child'));
        var print = btn('btn', 'Print this sheet');
        print.addEventListener('click', function () { document.body.classList.add('print-group'); window.print(); });
        head.appendChild(print);
        view.appendChild(head);
        var scroll = el('div', 'g-scroll'), table = el('table', 'g-table');
        var cap = el('caption', null, d.name + ': ' + (which === 'next' ? 'upcoming' : 'current') + ' after-school programs'); table.appendChild(cap);
        var thead = el('thead'), hr = el('tr'); hr.appendChild(el('th', null, 'Child'));
        DAYS.forEach(function (day) { var th = el('th', null, day[1]); th.scope = 'col'; hr.appendChild(th); });
        thead.appendChild(hr); table.appendChild(thead);
        var tb = el('tbody');
        kids.forEach(function (k) {
          var tr = el('tr'); var th = el('th', null, k.name); th.scope = 'row'; tr.appendChild(th);
          DAYS.forEach(function (day) {
            var td = el('td');
            (k[which][day[0]] || []).forEach(function (e) { var p = progName(e); td.appendChild(el('span', null, p.name + (p.cls ? ': ' + p.cls : ''))); });
            tr.appendChild(td);
          });
          tb.appendChild(tr);
        });
        table.appendChild(tb); scroll.appendChild(table); view.appendChild(scroll);
      }
      groupBox.appendChild(view);

      // your own children here
      var mine = kids.filter(function (k) { return k.mine; });
      var you = el('section', 'panel');
      you.appendChild(el('h2', null, d.role === 'viewer' ? 'You’re viewing only' : 'Your part of this group'));
      if (d.role === 'viewer') you.appendChild(el('p', 'hint', 'You can see and print the group. You can’t change it.'));
      if (mine.length) {
        var ml = el('ul', 'g-list');
        mine.forEach(function (k) {
          var li = el('li'); li.appendChild(el('b', null, k.name));
          li.appendChild(el('span', 'hint', 'Updates itself from the device you shared it from.'));
          var rm = btn('clear', 'Remove from this group');
          twoTap(rm, 'Tap again to remove', function () { call('kid_delete', { kid: k.id }).then(function () { forget(k.id); load(); }); });
          li.appendChild(rm); ml.appendChild(li);
        });
        you.appendChild(ml);
      }
      var ya = el('div', 'actions');
      if (d.role !== 'viewer') { var add = el('a', 'btn', mine.length ? 'Add another child’s week' : 'Add your child’s week'); add.href = page('board/') + '?group=' + gid; ya.appendChild(add); }
      var acct = el('a', 'btn', 'Your account'); acct.href = page('account/'); ya.appendChild(acct);
      if (d.role !== 'owner') {
        var leave = btn('clear', 'Leave this group');
        twoTap(leave, 'Tap again to leave and remove your weeks', function () { call('group_leave', { group: gid }).then(function () { mine.forEach(function (k) { forget(k.id); }); location.href = page('account/'); }); });
        ya.appendChild(leave);
      }
      you.appendChild(ya);
      you.appendChild(el('p', 'hint', 'This group and everything in it is deleted on ' + longDate(d.expires) + ', after the school year ends.'));
      groupBox.appendChild(you);

      // the owner's controls
      if (d.role === 'owner') {
        var own = el('section', 'panel');
        own.appendChild(el('h2', null, 'Running the group'));
        own.appendChild(el('p', null, 'The code to hand out. Anyone who uses it still waits for you to approve them.'));
        var codeRow = el('div', 'g-row');
        var codeEl = el('span', 'g-code', d.code || '');
        var copy = btn('btn', 'Copy the code'), fresh = btn('clear', 'Make a new code');
        copy.addEventListener('click', function () { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(codeEl.textContent).then(function () { say('Code copied.', 'good'); }); });
        twoTap(fresh, 'Tap again: the old code stops working', function () { call('group_code', { group: gid }).then(function (r) { if (r.ok) { codeEl.textContent = r.code; d.code = r.code; say('New code made. People already in the group stay in.', 'good'); } }); });
        codeRow.appendChild(codeEl); codeRow.appendChild(copy); codeRow.appendChild(fresh);
        own.appendChild(codeRow);
        var members = (d.members || []).filter(function (m) { return m.status === 'approved'; });
        own.appendChild(el('h3', null, 'Who’s in (' + members.length + ')'));
        var ol = el('ul', 'g-list');
        members.forEach(function (m) {
          var li = el('li'); li.appendChild(el('b', null, m.name || 'Someone'));
          li.appendChild(el('span', 'hint', m.role === 'owner' ? 'you' : m.role === 'viewer' ? 'viewing only' : (m.kids.join(', ') || 'no week added yet')));
          if (m.role !== 'owner') {
            var rm = btn('clear', 'Remove');
            twoTap(rm, 'Tap again to remove them and their weeks', function () { call('member_decide', { group: gid, member: m.id, approve: false }).then(load); });
            li.appendChild(rm);
          }
          ol.appendChild(li);
        });
        own.appendChild(ol);
        var rn = el('form', 'g-row');
        var rl = el('label', null, 'Group name'); rl.htmlFor = 'g-rename';
        var ri = el('input'); ri.id = 'g-rename'; ri.type = 'text'; ri.maxLength = 50; ri.value = d.name;
        var rb = el('button', 'btn', 'Rename'); rb.type = 'submit';
        rn.appendChild(rl); rn.appendChild(ri); rn.appendChild(rb);
        rn.addEventListener('submit', function (e) { e.preventDefault(); call('group_rename', { group: gid, name: ri.value }).then(function (r) { if (r.ok) load(); else say(r.message, 'bad'); }); });
        own.appendChild(rn);
        var del = btn('clear', 'Delete this group');
        twoTap(del, 'Tap again to delete it for everyone', function () { call('group_delete', { group: gid }).then(function () { location.href = page('account/'); }); });
        own.appendChild(del);
        groupBox.appendChild(own);
      }
    };
    window.addEventListener('afterprint', function () { document.body.classList.remove('print-group'); });
    load();
  }
  function longDate(iso) { var p = String(iso || '').split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(d) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  // Drop this device's note that a roster is shared, once that share is gone.
  function forget(kidId) {
    try {
      var r = JSON.parse(window.localStorage.getItem('pas-rosters') || 'null');
      if (r && Array.isArray(r.kids)) {
        r.kids.forEach(function (k) { if (Array.isArray(k.groups)) k.groups = k.groups.filter(function (l) { return l.k !== kidId; }); });
        window.localStorage.setItem('pas-rosters', JSON.stringify(r));
      }
    } catch (e) { /* nothing saved */ }
  }

  // =====================================================================================================
  // On Build your week: add this child's week to a group, and keep it up to date afterwards
  // =====================================================================================================
  var share = document.getElementById('group-share');
  var board = window.pasBoard;   // set by site.js on the roster page
  if (share && board) {
    var asked = query();
    var pilot = share.getAttribute('data-pilot') === '1';
    if (pilot && get('pas-groups') !== '1' && !asked.group) return;   // unlisted while it's a pilot
    if (asked.group) set('pas-groups', '1');
    var me = null, myGroups = [], open = false, pickedGroup = '', notice = '';
    var entryId = function (e) { var i = e.indexOf('~'); return (i < 0 ? e : e.slice(0, i)).split('.')[0]; };
    var entryCls = function (e) { var i = e.indexOf('~'); return i < 0 ? '' : e.slice(i + 1); };
    // What leaves the device: program ids, and a class only when it's one the program lists. No school, address or note.
    var toWeek = function (b) {
      var out = {};
      DAYS.forEach(function (d) {
        out[d[0]] = [];
        (b.days[d[0]] || []).forEach(function (e) {
          var id = entryId(e), p = board.data.programs[id], c = entryCls(e);
          if (!p) return;
          var v = c && p.offers.indexOf(c) > -1 ? id + '~' + c : id;
          if (out[d[0]].indexOf(v) < 0) out[d[0]].push(v);
        });
      });
      return out;
    };
    var links = function (kid) { return Array.isArray(kid.groups) ? kid.groups : []; };
    var firstWord = function (s) { return String(s || '').replace(/^\s+/, '').split(/\s+/)[0].slice(0, 20); };

    // ----- keeping shared weeks current -----
    var timer = null, lastSent = '';
    var syncNow = function () {
      timer = null;
      if (!signedInHint()) return;
      var kids = [];
      board.rosters().kids.forEach(function (k) { links(k).forEach(function (l) { kids.push({ id: l.k, now: toWeek(k.now), next: toWeek(k.next) }); }); });
      if (!kids.length) return;
      var body = JSON.stringify(kids);
      if (body === lastSent) return;
      call('sync', { kids: kids }).then(function (d) {
        if (d.http === 401) { notice = 'Sign in again to keep your groups up to date.'; me = null; draw(); return; }
        if (!d.ok) return;
        lastSent = body;
        if (d.gone && d.gone.length) {
          board.rosters().kids.forEach(function (k) { if (Array.isArray(k.groups)) k.groups = k.groups.filter(function (l) { return d.gone.indexOf(l.k) < 0; }); });
          board.save();
          notice = 'A group no longer has one of these weeks, so it has stopped sharing.';
          draw();
        }
      });
    };
    board.onSave = function () { if (timer) window.clearTimeout(timer); timer = window.setTimeout(syncNow, 1500); };
    board.onKidGone = function (kid) { links(kid).forEach(function (l) { call('kid_delete', { kid: l.k }); }); };
    // The roster page redraws on every keystroke; this block only needs to when the child or the view changes.
    var shownFor = '';
    board.onShow = function () { var key = board.rosters().kid + '|' + !!board.shared(); if (key !== shownFor) { shownFor = key; open = false; draw(); } };

    var draw = function () {
      share.textContent = '';
      share.hidden = !!board.shared();
      if (board.shared()) return;
      var kid = board.kid(), mine = links(kid);
      share.appendChild(el('h2', null, 'Share with a class or group'));
      if (notice) share.appendChild(el('p', 'g-status bad', notice));
      if (mine.length) {
        var ul = el('ul', 'g-list');
        mine.forEach(function (l) {
          var li = el('li');
          var a = el('a', null, l.n); a.href = page('groups/') + '?g=' + l.g; li.appendChild(a);
          li.appendChild(el('span', 'hint', 'Shared as “' + l.c + '”. Changes you make here show up there by themselves.'));
          var stop = btn('clear', 'Stop sharing');
          twoTap(stop, 'Tap again to take it out of the group', function () {
            call('kid_delete', { kid: l.k }).then(function (d) {
              if (!d.ok && d.http !== 401) { notice = d.message; draw(); return; }
              kid.groups = links(kid).filter(function (x) { return x.k !== l.k; }); board.save(); notice = ''; draw();
            });
          });
          li.appendChild(stop); ul.appendChild(li);
        });
        share.appendChild(ul);
      } else {
        share.appendChild(el('p', null, 'See who else from the class is doing what. A group shows first names and programs only, to people its creator has approved.'));
      }
      if (!open) {
        var start = btn('btn' + (mine.length ? '' : ' primary'), mine.length ? 'Add this week to another group' : 'Add this week to a group or class');
        start.addEventListener('click', function () { open = true; draw(); });
        var row = el('div', 'actions'); row.appendChild(start);
        var acct = el('a', 'btn', signedInHint() ? 'Your groups' : 'Make a group'); acct.href = page('account/'); row.appendChild(acct);
        share.appendChild(row);
        return;
      }
      var panel = el('div', 'panel add-panel'); share.appendChild(panel);
      if (!me) {
        if (signedInHint()) { panel.appendChild(el('p', 'g-status', 'Checking…')); refresh(); return; }
        signInBox(panel, 'board', function (d) { me = d.user; myGroups = d.groups || []; draw(); }, 'Groups need a sign-in, so only approved people can see them. No password: we email you a link and a 6-digit code.');
        return;
      }
      var form = el('form', 'g-form');
      var taken = mine.map(function (l) { return l.g; });
      var avail = myGroups.filter(function (g) { return taken.indexOf(g.id) < 0 && g.role !== 'viewer'; });
      var codeInput = null, radios = [];
      if (avail.length) {
        var fs = el('fieldset', 'field chips'); fs.appendChild(el('legend', null, 'Which group?'));
        var chips = el('div', 'chip-row');
        avail.concat([{ id: '', name: 'Another group: I have a code' }]).forEach(function (g, i) {
          var lab = el('label', 'chip'), r = el('input'); r.type = 'radio'; r.name = 'grp'; r.value = g.id;
          r.checked = pickedGroup ? g.id === pickedGroup : i === 0;
          lab.appendChild(r); lab.appendChild(el('span', null, g.name)); chips.appendChild(lab); radios.push(r);
          r.addEventListener('change', function () { codeField.hidden = r.value !== ''; });
        });
        fs.appendChild(chips); form.appendChild(fs);
      }
      var codeField = el('div', 'field');
      var cl = el('label', null, 'Group code'); cl.htmlFor = 'gs-code';
      codeInput = el('input'); codeInput.id = 'gs-code'; codeInput.type = 'text'; codeInput.maxLength = 20; codeInput.autocomplete = 'off'; codeInput.placeholder = 'ABCD-EFGH-JKMN'; codeInput.setAttribute('autocapitalize', 'characters');
      codeField.appendChild(cl); codeField.appendChild(codeInput);
      codeField.appendChild(el('span', 'hint', 'From whoever made the group.'));
      codeField.hidden = avail.length > 0 && !(radios.length && radios[radios.length - 1].checked);
      form.appendChild(codeField);
      var kf = el('div', 'field');
      var kl = el('label', null, 'Child’s first name'); kl.htmlFor = 'gs-kid';
      var ki = el('input'); ki.id = 'gs-kid'; ki.type = 'text'; ki.maxLength = 20; ki.value = firstWord(kid.name); ki.autocomplete = 'off';
      kf.appendChild(kl); kf.appendChild(ki); kf.appendChild(el('span', 'hint', 'First name only. It’s what the group sees.'));
      form.appendChild(kf);
      var ni = null;
      if (!me.ready) {
        ni = nameFields('gs-', me);
        form.appendChild(ni.box);
        form.appendChild(el('p', 'hint', 'Only the group’s creator sees your name, next to your child’s, so they know who’s asking. ' + LIST_NOTE));
      }
      form.appendChild(el('p', 'hint', 'This shares the first name above and the programs on this child’s current and upcoming weeks with the group’s approved members. Addresses, notes, the teacher’s name and photos are not shared. It keeps itself up to date, and you can stop any time.'));
      var status = el('p', 'g-status'); status.setAttribute('aria-live', 'polite'); form.appendChild(status);
      var acts = el('div', 'actions');
      var go = el('button', 'btn primary', 'Add to the group'); go.type = 'submit';
      var cancel = btn('btn', 'Cancel');
      cancel.addEventListener('click', function () { open = false; draw(); });
      acts.appendChild(go); acts.appendChild(cancel); form.appendChild(acts);
      panel.appendChild(form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var chosen = ''; radios.forEach(function (r) { if (r.checked) chosen = r.value; });
        var child = { name: ki.value, now: toWeek(kid.now), next: toWeek(kid.next) };
        if (!ki.value.replace(/\s+/g, '')) { status.textContent = 'Add your child’s first name.'; status.className = 'g-status bad'; ki.focus(); return; }
        go.disabled = true; status.className = 'g-status'; status.textContent = 'Adding…';
        var named = ni ? saveNames(me, ni.first.value, ni.last.value) : Promise.resolve({ ok: true });
        named.then(function (r) {
          if (!r.ok) { go.disabled = false; status.textContent = r.message; status.className = 'g-status bad'; return; }
          var req = chosen ? call('kid_save', { group: chosen, kid: child }) : call('group_join', { code: codeInput.value, kid: child });
          req.then(function (d) {
            go.disabled = false;
            if (d.http === 401) { me = null; draw(); return; }
            if (!d.ok) { status.textContent = d.message; status.className = 'g-status bad'; return; }
            var gidNew = chosen || d.id;
            kid.groups = links(kid).concat([{ g: gidNew, k: d.kid, n: d.name, c: firstWord(ki.value) || ki.value.slice(0, 20) }]);
            board.save();
            board.track({ event: 'pas_group_share', method: chosen ? 'my_group' : 'code' });
            open = false; pickedGroup = '';
            notice = '';
            refresh(d.status === 'approved' ? 'Added to ' + d.name + '.' : 'Request sent. ' + d.name + '’s creator has been emailed, and you’ll get an email when they approve you.');
          });
        });
      });
    };
    var refresh = function (msg) {
      call('me').then(function (d) {
        if (d.ok && d.user) { set('pas-in', '1'); me = d.user; myGroups = d.groups || []; listOnce(me); } else { me = null; myGroups = []; if (d.ok) set('pas-in', null); }
        // pick up new names for groups that were renamed
        var changed = false;
        board.rosters().kids.forEach(function (k) { links(k).forEach(function (l) { myGroups.forEach(function (g) { if (g.id === l.g && g.name !== l.n) { l.n = g.name; changed = true; } }); }); });
        if (changed) board.save();
        draw();
        if (msg) { var p = el('p', 'g-status good', msg); share.insertBefore(p, share.children[1] || null); }
      });
    };
    if (asked.group) {
      open = true;
      if (asked.group !== '1') pickedGroup = String(asked.group).replace(/[^A-Za-z0-9]/g, '');
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* file preview */ }
      window.setTimeout(function () { if (share.scrollIntoView) share.scrollIntoView({ block: 'center' }); }, 60);
    }
    shownFor = board.rosters().kid + '|' + !!board.shared();
    draw();
    if (signedInHint()) { refresh(); window.setTimeout(syncNow, 800); }
  }
})();
