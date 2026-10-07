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
    var intro = el('p', 'hint', lede || 'No password to remember. We email you a 6-digit code, and you type it here.');
    wrap.appendChild(intro);
    var form = el('form', 'signin-row');
    var input = el('input'); input.type = 'email'; input.required = true; input.autocomplete = 'email'; input.placeholder = 'you@example.com'; input.setAttribute('aria-label', 'Your email'); input.maxLength = 150;
    var send = el('button', 'btn primary', 'Email me a code'); send.type = 'submit';
    form.appendChild(input); form.appendChild(send);
    var status = el('p', 'g-status'); status.setAttribute('aria-live', 'polite');
    // step two, shown once the email has gone
    var step2 = el('div', 'signin-code'); step2.hidden = true;
    var sentTo = el('p', 'signin-sent');
    var codeForm = el('form', 'signin-row');
    var code = el('input'); code.type = 'text'; code.inputMode = 'numeric'; code.autocomplete = 'one-time-code'; code.maxLength = 7; code.placeholder = '123 456'; code.className = 'code-input'; code.setAttribute('aria-label', '6-digit code from the email');
    var go = el('button', 'btn primary', 'Sign in'); go.type = 'submit';
    codeForm.appendChild(code); codeForm.appendChild(go);
    var help = el('p', 'hint', 'It can take a minute, and it may be in spam. The email also has a button that signs you in on whichever device you tap it on. ');
    var again = btn('clear', 'Use a different email or send it again');
    help.appendChild(again);
    step2.appendChild(sentTo); step2.appendChild(codeForm); step2.appendChild(help);
    wrap.appendChild(form); wrap.appendChild(step2); wrap.appendChild(status);
    box.appendChild(wrap);
    var req = '';
    again.addEventListener('click', function () { step2.hidden = true; form.hidden = false; intro.hidden = false; status.textContent = ''; status.className = 'g-status'; input.focus(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim())) { status.textContent = 'That email address doesn’t look right.'; status.className = 'g-status bad'; return; }
      send.disabled = true; status.className = 'g-status'; status.textContent = 'Sending…';
      call('login_start', { email: input.value.trim(), next: next }).then(function (d) {
        send.disabled = false;
        if (!d.ok) { status.textContent = d.message; status.className = 'g-status bad'; return; }
        req = d.req;
        status.textContent = ''; status.className = 'g-status';
        sentTo.textContent = '';
        sentTo.appendChild(document.createTextNode('We emailed a 6-digit code to '));
        sentTo.appendChild(el('b', null, input.value.trim()));
        sentTo.appendChild(document.createTextNode('. Type it here (it lasts ' + d.minutes + ' minutes):'));
        form.hidden = true; intro.hidden = true; step2.hidden = false; code.value = ''; code.focus();
      });
    });
    codeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      go.disabled = true;
      call('login_finish', { req: req, code: code.value }).then(function (d) {
        go.disabled = false;
        if (!d.ok) { status.textContent = d.message; status.className = 'g-status bad'; return; }
        set('pas-in', '1');
        done(d);
      });
    });
  }

  // ----- small things several pages share -----
  function sget(key) { try { return window.sessionStorage.getItem(key); } catch (e) { return null; } }
  function sset(key, value) { try { if (value == null) window.sessionStorage.removeItem(key); else window.sessionStorage.setItem(key, value); } catch (e) { /* storage blocked */ } }
  function tidyCode(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); }
  function showCode(c) { c = tidyCode(c); return c.length === 12 ? c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8) : c; }
  function firstWord(s) { return String(s || '').replace(/^\s+/, '').split(/\s+/)[0].slice(0, 20); }
  function readRosters() { try { var r = JSON.parse(window.localStorage.getItem('pas-rosters') || 'null'); return r && Array.isArray(r.kids) ? r : null; } catch (e) { return null; } }
  // What leaves the device for a child's week: program ids, and a class only when it's one the program lists. No school, address or note.
  function weekOf(b, programs) {
    var out = {};
    DAYS.forEach(function (d) {
      out[d[0]] = [];
      ((b && b.days && b.days[d[0]]) || []).forEach(function (e) {
        var i = e.indexOf('~'), id = (i < 0 ? e : e.slice(0, i)).split('.')[0], c = i < 0 ? '' : e.slice(i + 1), p = programs[id];
        if (!p) return;
        var v = c && (p.offers || []).indexOf(c) > -1 ? id + '~' + c : id;
        if (out[d[0]].indexOf(v) < 0) out[d[0]].push(v);
      });
    });
    return out;
  }
  function weekCount(b) { var n = 0; DAYS.forEach(function (d) { n += ((b && b.days && b.days[d[0]]) || []).length; }); return n; }
  // Inviting people: the owner types email addresses, each gets an invitation, and only those addresses can join.
  function inviteForm(gid, done) {
    var f = el('form', 'g-form g-invite');
    var field = el('div', 'field');
    var l = el('label', null, 'Email addresses to invite'); l.htmlFor = 'inv-' + gid;
    var ta = el('textarea', 'g-invite-text'); ta.id = 'inv-' + gid; ta.rows = 3; ta.placeholder = 'bea@example.com, sam@example.com'; ta.setAttribute('autocapitalize', 'off'); ta.spellcheck = false;
    field.appendChild(l); field.appendChild(ta);
    field.appendChild(el('span', 'hint', 'Separate them with commas, spaces or new lines. Each person gets an email with a link and the code, and only these addresses can join. Invite people you know: everyone in a group sees each child’s first name and programs.'));
    var s = el('p', 'g-status'); s.setAttribute('aria-live', 'polite');
    var b = el('button', 'btn primary', 'Send invitations'); b.type = 'submit';
    var acts = el('div', 'actions'); acts.appendChild(b);
    f.appendChild(field); f.appendChild(s); f.appendChild(acts);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!ta.value.replace(/\s+/g, '')) { s.textContent = 'Add at least one email address.'; s.className = 'g-status bad'; return; }
      b.disabled = true; s.className = 'g-status'; s.textContent = 'Sending…';
      call('invite_add', { group: gid, emails: ta.value }).then(function (r) {
        b.disabled = false;
        if (!r.ok) { s.textContent = r.message; s.className = 'g-status bad'; return; }
        var bits = [];
        if (r.sent) bits.push(r.sent === 1 ? '1 invitation sent.' : r.sent + ' invitations sent.');
        if (r.held) bits.push(r.held + (r.held === 1 ? ' address is' : ' addresses are') + ' on the list, but the email couldn’t go out just now (there’s a daily limit). Use “Send again” later.');
        if (r.bad && r.bad.length) bits.push('Not email addresses, so skipped: ' + r.bad.join(', ') + '.');
        if (r.full) bits.push('The group’s invite list is full.');
        if (!bits.length) bits.push('Those addresses are already in the group.');
        s.textContent = bits.join(' '); s.className = 'g-status ' + (r.sent ? 'good' : 'bad');
        if (r.sent || r.held) ta.value = '';
        if (done) done(r);
      });
    });
    return f;
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
      if (next === 'join') { location.href = page('join/'); return true; }
      if (next === 'board') { location.href = page('board/') + '?group=1'; return true; }
      var m = /^groups\?g=([A-Za-z0-9]+)$/.exec(next || '');
      if (m) { location.href = page('groups/') + '?g=' + m[1]; return true; }
      return false;
    };
    var drawSignedOut = function (msg) {
      account.textContent = '';
      if (msg) { var p = el('p', 'g-status bad', msg); account.appendChild(p); }
      var have = el('div', 'panel g-callout');
      have.appendChild(el('h2', null, 'Were you invited to a group?'));
      have.appendChild(el('p', null, 'Tap the link in your invitation email. Or start here: it walks you through the code, signing in with the address you were invited at, and picking your child’s week.'));
      var hj = el('a', 'btn primary', 'Join a group I was invited to'); hj.href = page('join/'); have.appendChild(hj);
      account.appendChild(have);
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
        ff.appendChild(el('p', 'hint', 'People you invite to a group see your name on the invitation, and a group’s creator sees it when you join. Other members don’t see it. ' + LIST_NOTE));
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
      who.appendChild(el('p', 'hint', 'People you invite to a group see your name on the invitation, and a group’s creator sees it when you join. Other members don’t see it.'));
      nameForm.addEventListener('submit', function (e) {
        e.preventDefault();
        saveNames(me, nf0.first.value, nf0.last.value).then(function (r) { nameNote.textContent = r.ok ? 'Saved.' : r.message; if (r.ok) { nf0.first.value = r.first; nf0.last.value = r.last; } });
      });
      account.appendChild(who);
      // your groups
      var mine = el('section', 'panel');
      mine.appendChild(el('h2', null, 'Your groups'));
      var noneYet = el('p', 'hint', 'You’re not in any groups yet. Start one below, or join one you’ve been invited to.');
      if (!groups.length) mine.appendChild(noneYet);
      var list = el('ul', 'g-list');
      groups.forEach(function (g) {
        var li = el('li');
        var a = el('a', null, g.name); a.href = page('groups/') + '?g=' + g.id; li.appendChild(a);
        var what = g.status !== 'approved' ? 'Waiting for the group’s creator' : g.role === 'owner' ? 'You made this group' : g.role === 'viewer' ? 'Viewing only' : 'Member';
        if (g.kids && g.kids.length) what += ' · ' + g.kids.map(function (k) { return k.name; }).join(', ');
        li.appendChild(el('span', 'hint', what));
        if (g.waiting) li.appendChild(el('span', 'pill pickup', g.waiting + ' waiting for you'));
        list.appendChild(li);
      });
      mine.appendChild(list);
      account.appendChild(mine);
      // join a group: the code goes here
      var join = el('section', 'panel g-callout');
      join.appendChild(el('h2', null, 'Join a group you were invited to'));
      join.appendChild(el('p', null, 'Type the code from your invitation email. It only works for the address you were invited at, which should be the one you’re signed in with. Next you pick which child’s week to share.'));
      var jf = el('form', 'g-row');
      var jl = el('label', null, 'Group code'); jl.htmlFor = 'join-code';
      var ji = el('input'); ji.id = 'join-code'; ji.type = 'text'; ji.maxLength = 20; ji.autocomplete = 'off'; ji.placeholder = 'ABCD-EFGH-JKMN'; ji.className = 'code-input'; ji.setAttribute('autocapitalize', 'characters');
      var jb = el('button', 'btn primary', 'Next'); jb.type = 'submit';
      var jn = el('span', 'hint'); jn.setAttribute('aria-live', 'polite');
      jf.appendChild(jl); jf.appendChild(ji); jf.appendChild(jb); jf.appendChild(jn);
      jf.addEventListener('submit', function (e) {
        e.preventDefault();
        if (tidyCode(ji.value).length !== 12) { jn.textContent = 'A code is 12 letters and numbers, like ABCD-EFGH-JKMN.'; return; }
        sset('pas-join', tidyCode(ji.value)); location.href = page('join/');
      });
      join.appendChild(jf);
      account.appendChild(join);
      // make a group
      var make = el('section', 'panel');
      make.appendChild(el('h2', null, 'Start a group and invite people'));
      make.appendChild(el('p', null, 'For a few families you know: a carpool, close friends, the kids who do everything together. You invite people by email address, and only the addresses you invite can get in.'));
      var makeForm = el('form', 'g-row');
      var gl = el('label', null, 'Group name'); gl.htmlFor = 'new-group';
      var gi = el('input'); gi.id = 'new-group'; gi.type = 'text'; gi.maxLength = 50; gi.placeholder = 'Tuesday carpool';
      var gb = el('button', 'btn primary', 'Start the group'); gb.type = 'submit';
      makeForm.appendChild(gl); makeForm.appendChild(gi); makeForm.appendChild(gb);
      var made = el('div', 'g-made'); made.setAttribute('aria-live', 'polite');
      make.appendChild(makeForm); make.appendChild(made);
      makeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        Promise.resolve({ ok: true }).then(function () {
          call('group_create', { name: gi.value }).then(function (c) {
            made.textContent = '';
            if (!c.ok) { made.appendChild(el('p', 'g-status bad', c.message)); return; }
            var madeSay = el('p', 'g-status good', '“' + c.name + '” is ready. Two things to do next:');
            made.appendChild(madeSay);
            made.appendChild(el('h3', null, '1. Add your own child’s week'));
            var acts = el('div', 'actions');
            var add = el('a', 'btn primary', 'Add your child’s week'); add.href = page('join/') + '?g=' + c.id;
            var open = el('a', 'btn', 'Open the group'); open.href = page('groups/') + '?g=' + c.id;
            acts.appendChild(add); acts.appendChild(open); made.appendChild(acts);
            made.appendChild(el('h3', null, '2. Invite the others'));
            made.appendChild(inviteForm(c.id));
            var later = el('p', 'hint', 'You can invite more people, send an invitation again or remove someone from '); var gl2 = el('a', null, 'the group’s page'); gl2.href = open.href; later.appendChild(gl2); later.appendChild(document.createTextNode('.'));
            made.appendChild(later);
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
        if (!d.ok) {
          groupBox.textContent = '';
          var p = el('div', 'panel'); p.appendChild(el('p', null, d.message));
          p.appendChild(el('p', null, 'Groups are invitation only. If you were invited, use the link in your invitation email and sign in with the address it was sent to.'));
          var pa = el('div', 'actions');
          var j = el('a', 'btn primary', 'Join a group I was invited to'); j.href = page('join/'); pa.appendChild(j);
          var a = el('a', 'btn', 'Your groups'); a.href = page('account/'); pa.appendChild(a);
          p.appendChild(pa); groupBox.appendChild(p); return;
        }
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
      lede.textContent = kids.length ? kids.length + (kids.length === 1 ? ' child' : ' children') + '. First names and programs only, seen by the people this group’s creator invited.' : 'Nobody has added a week yet.';
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
            li.appendChild(el('span', 'hint', m.role === 'viewer' ? 'wants to view only' : 'wants to add ' + (m.kids.join(', ') || 'a child')));
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
        var na = el('a', 'btn primary', 'Add a week'); na.href = page('join/') + '?g=' + gid; none.appendChild(na);
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
      if (d.role !== 'viewer') { var add = el('a', 'btn', mine.length ? 'Add another child’s week' : 'Add your child’s week'); add.href = page('join/') + '?g=' + gid; ya.appendChild(add); }
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
        own.appendChild(el('h3', null, 'Invite people'));
        own.appendChild(inviteForm(gid, function () { load(); }));
        var members = (d.members || []).filter(function (m) { return m.status === 'approved'; });
        var waitingList = (d.invites || []).filter(function (i) { return !i.joined; });
        own.appendChild(el('h3', null, 'Who’s in (' + members.length + ')' + (waitingList.length ? ', and ' + waitingList.length + ' invited' : '')));
        var ol = el('ul', 'g-list');
        members.forEach(function (m) {
          var li = el('li'); li.appendChild(el('b', null, m.name || 'Someone'));
          li.appendChild(el('span', 'hint', (m.role === 'owner' ? 'you' : m.email || '') + (m.role === 'owner' ? '' : ' · ' + (m.role === 'viewer' ? 'viewing only' : (m.kids.join(', ') || 'no week added yet')))));
          if (m.role !== 'owner') {
            var rm = btn('clear', 'Remove');
            twoTap(rm, 'Tap again to remove them and their weeks', function () { call('member_decide', { group: gid, member: m.id, approve: false }).then(load); });
            li.appendChild(rm);
          }
          ol.appendChild(li);
        });
        waitingList.forEach(function (i) {
          var li = el('li'); li.appendChild(el('b', null, i.email));
          li.appendChild(el('span', 'hint', 'invited, hasn’t joined yet'));
          var acts = el('span', 'actions');
          var again = btn('clear', 'Send again');
          again.addEventListener('click', function () { again.disabled = true; call('invite_add', { group: gid, emails: i.email }).then(function (r) { again.disabled = false; say(r.ok ? (r.sent ? 'Invitation sent again to ' + i.email + '.' : 'That one has had as many emails as it can today. Try again tomorrow.') : r.message, r.ok && r.sent ? 'good' : 'bad'); }); });
          var un = btn('clear', 'Remove');
          twoTap(un, 'Tap again to take back the invitation', function () { call('invite_remove', { group: gid, email: i.email }).then(load); });
          acts.appendChild(again); acts.appendChild(un); li.appendChild(acts);
          ol.appendChild(li);
        });
        own.appendChild(ol);
        var codeLine = el('p', 'hint', 'The group’s code, which is in every invitation: '); codeLine.appendChild(el('span', 'g-code small', showCode(d.code || ''))); own.appendChild(codeLine);
        own.appendChild(el('p', 'hint', 'The code alone gets nobody in: it only works from an address you invited.'));
        var fresh = btn('clear', 'Make a new code');
        twoTap(fresh, 'Tap again: invitations already sent stop working', function () { call('group_code', { group: gid }).then(function (r) { if (r.ok) { say('New code made. People already in stay in. Use “Send again” for anyone who hasn’t joined yet.', 'good'); d.code = r.code; codeLine.lastChild.textContent = showCode(r.code); } }); });
        own.appendChild(fresh);
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
  // Joining, step by step: the code, signing in, your name, whose week, done
  // =====================================================================================================
  var joinBox = document.getElementById('join');
  if (joinBox) {
    set('pas-groups', '1');
    var jinfo = JSON.parse(document.getElementById('groups-data').textContent);
    var jq = query();
    var target = { code: '', gid: (jq.g || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 30), name: '', member: false };
    // An invitation link carries the code after the #. Take it out of the address and keep it for this tab only.
    var fromLink = tidyCode(location.hash);
    if (fromLink.length === 12) { sset('pas-join', fromLink); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; } }
    if (!target.gid) target.code = tidyCode(sget('pas-join'));
    var jme = null, jgroups = [];
    var STEPS = ['Code', 'Sign in', 'Your name', 'Who’s joining', 'Done'];
    var frame = function (n, heading) {
      joinBox.textContent = '';
      var ol = el('ol', 'g-steps');
      STEPS.forEach(function (s, i) { var li = el('li', i + 1 < n ? 'done' : i + 1 === n ? 'now' : '', s); if (i + 1 === n) li.setAttribute('aria-current', 'step'); ol.appendChild(li); });
      joinBox.appendChild(ol);
      var panel = el('section', 'panel');
      panel.appendChild(el('h2', null, heading));
      joinBox.appendChild(panel);
      return panel;
    };
    var route = function () {
      if (!target.gid && target.code.length !== 12) return stepCode();
      if (!jme) return stepSignIn();
      if (!jme.ready) return stepName();
      if (target.gid) {
        var g = jgroups.filter(function (x) { return x.id === target.gid; })[0];
        if (!g) return stepCode('You’re not in that group yet. Enter its code to join.', true);
        target.name = g.name; target.member = true;
        return stepWho();
      }
      if (!target.name) {
        frame(4, 'Checking the code…');
        return call('group_peek', { code: target.code }).then(function (d) {
          if (d.http === 401) { jme = null; return route(); }
          if (!d.ok && d.error === 'notinvited') return stepNotInvited(d.message);
          if (!d.ok) { target.code = ''; sset('pas-join', null); return stepCode(d.message); }
          target.name = d.name; target.gid2 = d.id; target.member = !!d.member;
          stepWho();
        });
      }
      stepWho();
    };
    var stepCode = function (msg, dropGid) {
      if (dropGid) target.gid = '';
      var panel = frame(1, 'Enter the group’s code');
      panel.appendChild(el('p', null, 'It’s the 12 letters and numbers in your invitation email. Tapping the link in that email fills this in for you.'));
      if (msg) panel.appendChild(el('p', 'g-status bad', msg));
      var f = el('form', 'g-row');
      var l = el('label', null, 'Group code'); l.htmlFor = 'jc';
      var i = el('input'); i.id = 'jc'; i.type = 'text'; i.maxLength = 20; i.autocomplete = 'off'; i.placeholder = 'ABCD-EFGH-JKMN'; i.className = 'code-input'; i.setAttribute('autocapitalize', 'characters');
      var b = el('button', 'btn primary', 'Next'); b.type = 'submit';
      var note = el('span', 'hint'); note.setAttribute('aria-live', 'polite');
      f.appendChild(l); f.appendChild(i); f.appendChild(b); f.appendChild(note);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var c = tidyCode(i.value);
        if (c.length !== 12) { note.textContent = 'A code is 12 letters and numbers, like ABCD-EFGH-JKMN.'; return; }
        target.code = c; target.name = ''; sset('pas-join', c); route();
      });
      panel.appendChild(f);
      var alt = el('p', 'hint', 'Not invited to one? '); var mk = el('a', null, 'Start your own group'); mk.href = page('account/'); alt.appendChild(mk); alt.appendChild(document.createTextNode(' and invite people to it.'));
      panel.appendChild(alt);
      i.focus();
    };
    // The code is right, but the group hasn't invited the address that is signed in.
    var stepNotInvited = function (msg) {
      var panel = frame(2, 'This address isn’t on the invite list');
      panel.appendChild(el('p', null, msg));
      var acts = el('div', 'actions');
      var other = btn('btn primary', 'Sign in with a different address');
      other.addEventListener('click', function () { call('logout', {}).then(function () { set('pas-in', null); jme = null; route(); }); });
      var back = btn('btn', 'Use a different code');
      back.addEventListener('click', function () { target.code = ''; target.name = ''; sset('pas-join', null); stepCode(); });
      acts.appendChild(other); acts.appendChild(back); panel.appendChild(acts);
    };
    var stepSignIn = function () {
      var panel = frame(2, 'Sign in, or make an account');
      var box = el('div'); panel.appendChild(box);
      signInBox(box, 'join', function (d) { jme = d.user; jgroups = d.groups || []; route(); }, 'Use the email address your invitation was sent to: the group only lets that address in. No password: we email you a 6-digit code, and you type it here. New here? This makes your account.');
      var dup = box.querySelector('h3'); if (dup) dup.parentNode.removeChild(dup);   // the step already has its heading
    };
    var stepName = function () {
      var panel = frame(3, 'Your name');
      var f = el('form', 'g-form'), n = nameFields('jn-', jme);
      f.appendChild(n.box);
      f.appendChild(el('p', 'hint', 'The group’s creator sees your name when you join, so they know who came in. Other members don’t see it. ' + LIST_NOTE));
      var s = el('p', 'g-status'); s.setAttribute('aria-live', 'polite'); f.appendChild(s);
      var b = el('button', 'btn primary', 'Next'); b.type = 'submit'; var a = el('div', 'actions'); a.appendChild(b); f.appendChild(a);
      f.addEventListener('submit', function (e) {
        e.preventDefault(); b.disabled = true;
        saveNames(jme, n.first.value, n.last.value).then(function (r) { b.disabled = false; if (!r.ok) { s.textContent = r.message; s.className = 'g-status bad'; return; } route(); });
      });
      panel.appendChild(f); n.first.focus();
    };
    var stepWho = function () {
      var gid = target.gid || target.gid2 || '';
      var panel = frame(4, 'Joining “' + target.name + '”');
      var r = readRosters(), kids = [];
      if (r) r.kids.forEach(function (k, i) {
        var n = weekCount(k.now) + weekCount(k.next);
        var linked = (Array.isArray(k.groups) ? k.groups : []).some(function (l) { return l.g === gid; });
        if (n || k.name) kids.push({ i: i, k: k, n: n, linked: linked });
      });
      var usable = kids.filter(function (x) { return x.n && !x.linked; });
      panel.appendChild(el('p', null, usable.length ? 'Whose week do you want the group to see?' : 'There’s no week saved on this device yet. Build your child’s week first, then come back: your place here is kept.'));
      var f = el('form', 'g-form'), opts = el('div', 'g-opts'), radios = [];
      var want = parseInt(sget('pas-join-kid') || '', 10);
      var opt = function (value, title, sub, disabled) {
        var lab = el('label', 'g-opt' + (disabled ? ' off' : '')), rd = el('input'); rd.type = 'radio'; rd.name = 'who'; rd.value = value; rd.disabled = !!disabled;
        var txt = el('span'); txt.appendChild(el('b', null, title)); if (sub) txt.appendChild(el('span', null, sub));
        lab.appendChild(rd); lab.appendChild(txt); opts.appendChild(lab); radios.push(rd);
        return rd;
      };
      kids.forEach(function (x) {
        opt('k' + x.i, x.k.name || 'Child ' + (x.i + 1), x.linked ? 'Already in this group' : x.n ? x.n + (x.n === 1 ? ' program' : ' programs') + ' on their current and upcoming weeks' : 'No programs on their week yet', x.linked || !x.n);
      });
      opt('build', usable.length ? 'A child whose week isn’t built yet' : 'Build my child’s week first', 'Takes you to Build your week. Come back here when it’s ready.');
      if (!target.member) opt('view', 'Nobody. I only want to see the group', 'For a caregiver or another adult. You’ll be able to see and print it, and not change it.');
      var pick = radios.filter(function (rd) { return rd.value === 'k' + want && !rd.disabled; })[0] || radios.filter(function (rd) { return !rd.disabled; })[0];
      if (pick) pick.checked = true;
      f.appendChild(opts);
      var nameField = el('div', 'field');
      var nl = el('label', null, 'Child’s first name, as the group will see it'); nl.htmlFor = 'jk';
      var ni = el('input'); ni.id = 'jk'; ni.type = 'text'; ni.maxLength = 20; ni.autocomplete = 'off';
      nameField.appendChild(nl); nameField.appendChild(ni); nameField.appendChild(el('span', 'hint', 'First name only.'));
      f.appendChild(nameField);
      var consent = el('p', 'hint', 'This shares that first name and the programs on the child’s current and upcoming weeks with the people in this group. Addresses, notes, the teacher’s name and photos are not shared. It keeps itself up to date from this device, and you can stop any time.');
      f.appendChild(consent);
      var s = el('p', 'g-status'); s.setAttribute('aria-live', 'polite'); f.appendChild(s);
      var go = el('button', 'btn primary', ''); go.type = 'submit';
      var acts = el('div', 'actions'); acts.appendChild(go);
      if (!target.gid) { var back = btn('btn', 'Use a different code'); back.addEventListener('click', function () { target.code = ''; target.name = ''; sset('pas-join', null); stepCode(); }); acts.appendChild(back); }
      f.appendChild(acts);
      var chosen = function () { var v = ''; radios.forEach(function (rd) { if (rd.checked) v = rd.value; }); return v; };
      var sync = function () {
        var v = chosen(), isKid = v.charAt(0) === 'k';
        nameField.hidden = !isKid; consent.hidden = !isKid;
        if (isKid) { var kid = r.kids[+v.slice(1)]; ni.value = firstWord(kid.name); }
        go.textContent = v === 'build' ? 'Go to Build your week' : target.member ? 'Add to the group' : 'Join the group';
      };
      radios.forEach(function (rd) { rd.addEventListener('change', sync); });
      sync();
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = chosen();
        if (v === 'build') { sset('pas-join-return', '1'); location.href = page('board/'); return; }
        var body, action;
        if (v === 'view') { action = 'group_join'; body = { code: target.code, viewer: true }; }
        else {
          var idx = +v.slice(1), kid = r.kids[idx];
          if (!ni.value.replace(/\s+/g, '')) { s.textContent = 'Add your child’s first name.'; s.className = 'g-status bad'; ni.focus(); return; }
          var child = { name: ni.value, now: weekOf(kid.now, jinfo.programs), next: weekOf(kid.next, jinfo.programs) };
          if (target.gid) { action = 'kid_save'; body = { group: target.gid, kid: child }; } else { action = 'group_join'; body = { code: target.code, kid: child }; }
        }
        go.disabled = true; s.className = 'g-status'; s.textContent = 'Sending…';
        call(action, body).then(function (d) {
          go.disabled = false;
          if (d.http === 401) { jme = null; return route(); }
          if (!d.ok && d.error === 'notinvited') return stepNotInvited(d.message);
          if (!d.ok) { s.textContent = d.message; s.className = 'g-status bad'; return; }
          var id = target.gid || d.id;
          if (v !== 'view' && d.kid) {   // remember, on this device, that this roster is shared, so changes carry over
            try {
              var fresh = readRosters();
              if (fresh && fresh.kids[+v.slice(1)]) {
                var k = fresh.kids[+v.slice(1)];
                k.groups = (Array.isArray(k.groups) ? k.groups : []).concat([{ g: id, k: d.kid, n: d.name || target.name, c: firstWord(ni.value) || ni.value.slice(0, 20) }]);
                window.localStorage.setItem('pas-rosters', JSON.stringify(fresh));
              }
            } catch (e2) { /* storage blocked: the week is in the group, it just won't update itself */ }
          }
          sset('pas-join', null); sset('pas-join-kid', null); sset('pas-join-return', null);
          stepDone(id, d.status === 'approved', v === 'view');
        });
      });
      panel.appendChild(f);
    };
    var stepDone = function (id, inAlready, viewOnly) {
      var panel = frame(5, inAlready ? (viewOnly ? 'You’re in “' + target.name + '”' : 'Added to “' + target.name + '”') : 'Request sent');
      if (inAlready) panel.appendChild(el('p', null, viewOnly ? 'You can see and print the group now.' : 'The week is in the group now, and it will keep itself up to date when you change it on this device.'));
      else {
        panel.appendChild(el('p', null, 'The person who made “' + target.name + '” has been emailed. When they approve you, you’ll get an email and the group will open for you.'));
        panel.appendChild(el('p', 'hint', viewOnly ? 'Until then the group shows you nothing.' : 'Until then the group shows you nothing, and nobody in it sees your child’s week.'));
      }
      var acts = el('div', 'actions');
      var open = el('a', 'btn primary', inAlready ? 'Open the group' : 'See your request'); open.href = page('groups/') + '?g=' + id; acts.appendChild(open);
      var wk = el('a', 'btn', 'Back to Build your week'); wk.href = page('board/'); acts.appendChild(wk);
      var ac = el('a', 'btn', 'Your account'); ac.href = page('account/'); acts.appendChild(ac);
      panel.appendChild(acts);
    };
    call('me').then(function (d) {
      if (d.ok && d.user) { set('pas-in', '1'); jme = d.user; jgroups = d.groups || []; listOnce(jme); }
      route();
    });
  }

  // =====================================================================================================
  // On Build your week: what this child's week is shared with, the way in to joining, and keeping it up to date
  // =====================================================================================================
  var share = document.getElementById('group-share');
  var board = window.pasBoard;   // set by site.js on the roster page
  if (share && board) {
    var asked = query();
    var pilot = share.getAttribute('data-pilot') === '1';
    if (pilot && get('pas-groups') !== '1' && !asked.group) return;   // unlisted while it's a pilot
    if (asked.group) set('pas-groups', '1');
    var me = null, myGroups = [], notice = '';
    var toWeek = function (b) { return weekOf(b, board.data.programs); };
    var links = function (kid) { return Array.isArray(kid.groups) ? kid.groups : []; };

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
    board.onSave = function () { if (timer) window.clearTimeout(timer); timer = window.setTimeout(syncNow, 1500); drawTop(); };
    board.onKidGone = function (kid) { links(kid).forEach(function (l) { call('kid_delete', { kid: l.k }); }); };
    // The roster page redraws on every keystroke; this block only needs to when the child or the view changes.
    var shownFor = '';
    board.onShow = function () { var key = board.rosters().kid + '|' + !!board.shared(); if (key !== shownFor) { shownFor = key; draw(); } };

    // Someone sent here from the join page to build a week sees the way back at the top, where they are working.
    var topNote = el('div', 'panel g-callout g-top'); topNote.hidden = true;
    var anchor = document.getElementById('board-adder');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(topNote, anchor);
    var drawTop = function () {
      var midway = tidyCode(sget('pas-join')).length === 12 && !board.shared();
      topNote.hidden = !midway; topNote.textContent = '';
      if (!midway) return;
      var kid = board.kid(), n = weekCount(kid.now) + weekCount(kid.next);
      topNote.appendChild(el('p', null, n ? 'You’re part-way through joining a group. When this week looks right, carry on.' : 'You’re part-way through joining a group. Add your child’s programs below, then carry on.'));
      var cont = btn('btn primary', 'Continue joining'); cont.disabled = !n;
      cont.addEventListener('click', toJoin());
      topNote.appendChild(cont);
    };
    var toJoin = function (extra) { return function () { sset('pas-join-kid', String(board.rosters().kid)); location.href = page('join/') + (extra || ''); }; };
    var draw = function () {
      drawTop();
      share.textContent = '';
      share.hidden = !!board.shared();
      if (board.shared()) return;
      var kid = board.kid(), mine = links(kid), who = kid.name ? firstWord(kid.name) + '’s week' : 'this week';
      share.appendChild(el('h2', null, 'Share with a group'));
      if (notice) share.appendChild(el('p', 'g-status bad', notice));
      var midway = tidyCode(sget('pas-join')).length === 12;
      if (midway) {   // came here from the join page to build the week first
        var back = el('div', 'panel g-callout');
        back.appendChild(el('p', null, 'You’re part-way through joining a group. When ' + who + ' looks right, pick up where you left off.'));
        var cont = btn('btn primary', 'Continue joining with ' + who);
        cont.addEventListener('click', toJoin());
        back.appendChild(cont); share.appendChild(back);
      }
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
        share.appendChild(el('p', null, 'A few families you know, seeing each other’s weeks. A group is invitation only, and shows first names and programs to the people in it.'));
      }
      var row = el('div', 'actions');
      if (!midway) {
        var code = btn('btn primary', 'I was invited to a group');
        code.addEventListener('click', toJoin());
        row.appendChild(code);
      }
      var taken = mine.map(function (l) { return l.g; });
      myGroups.filter(function (g) { return taken.indexOf(g.id) < 0; }).slice(0, 4).forEach(function (g) {
        var b = btn('btn', 'Add ' + who + ' to ' + g.name);
        b.addEventListener('click', toJoin('?g=' + g.id));
        row.appendChild(b);
      });
      var acct = el('a', 'btn', signedInHint() ? 'Your groups' : 'Start a group'); acct.href = page('account/'); row.appendChild(acct);
      share.appendChild(row);
      if (!mine.length && !midway) {
        var how = el('ol', 'g-how');
        ['Someone invites your email address to their group, or you start your own and invite people.', 'Tap the link in the invitation and sign in with that address.', 'Pick this week to share. Only the people in the group see it.'].forEach(function (s) { how.appendChild(el('li', null, s)); });
        share.appendChild(how);
      }
    };
    var refresh = function () {
      call('me').then(function (d) {
        if (d.ok && d.user) { set('pas-in', '1'); me = d.user; myGroups = d.groups || []; listOnce(me); } else { me = null; myGroups = []; if (d.ok) set('pas-in', null); }
        // pick up new names for groups that were renamed
        var changed = false;
        board.rosters().kids.forEach(function (k) { links(k).forEach(function (l) { myGroups.forEach(function (g) { if (g.id === l.g && g.name !== l.n) { l.n = g.name; changed = true; } }); }); });
        if (changed) board.save();
        draw();
      });
    };
    if (asked.group) {
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* file preview */ }
      window.setTimeout(function () { if (share.scrollIntoView) share.scrollIntoView({ block: 'center' }); }, 60);
    }
    shownFor = board.rosters().kid + '|' + !!board.shared();
    draw();
    if (signedInHint()) { refresh(); window.setTimeout(syncNow, 800); }
  }
})();
