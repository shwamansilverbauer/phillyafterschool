// Accounts: signing in (an emailed code, or Google), the profile page, keeping a school and a week in a profile,
// sharing a week with one person, share groups, and the block on the roster page that ties them together.
// Loaded only on the account, join, group and roster pages. Talks to groups/api.php; see src/server/groups-api.php.
(function () {
  'use strict';
  var host = document.querySelector('[data-groups]');
  if (!host || !window.fetch || !window.Promise) return;
  var ROOT = host.getAttribute('data-root') || '';          // path back to the top of the site
  var INDEX = host.getAttribute('data-index') || '';        // "index.html" in the preview copy
  var API = host.getAttribute('data-api');                  // empty in the preview copy: nothing to talk to
  var KL_KEY = host.getAttribute('data-kl-key') || '', KL_LIST = host.getAttribute('data-kl-list') || '';   // the email list accounts are added to
  var GOOGLE = host.getAttribute('data-google') || '';      // Google's public client id for "sign in with Google"; empty turns it off
  var LIST_NOTE = KL_LIST ? 'Making an account adds your name and email to our email list, for occasional news about the site. Every email has an unsubscribe link.' : '';
  var DAYS = [['mon', 'Monday', 'Mon'], ['tue', 'Tuesday', 'Tue'], ['wed', 'Wednesday', 'Wed'], ['thu', 'Thursday', 'Thu'], ['fri', 'Friday', 'Fri']];

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(cls, text) { var b = el('button', cls, text); b.type = 'button'; return b; }
  function get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function set(key, value) {
    try { if (value == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch (e) { /* storage blocked */ }
    if (key === 'pas-in') {   // the strip at the top of the page: "Log in / Register" or "Your account"
      var h = document.documentElement;
      h.className = h.className.replace(/(^|\s)signed(?!\S)/g, '') + (value === '1' ? ' signed' : '');
    }
  }
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
    // Google first, for people who would rather not wait for an email: one tap on its own button. The button is
    // Google's, so its script loads with this form. It isn't offered inside apps (Facebook, Instagram) whose built-in
    // browsers Google refuses to sign in from, and it quietly goes away if the script can't be fetched.
    var alt = null;
    if (GOOGLE && API && !/FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|Line\//i.test(navigator.userAgent || '')) {
      alt = el('div', 'signin-alt'); alt.hidden = true;
      var gslot = el('div', 'g-google');
      alt.appendChild(gslot);
      alt.appendChild(el('span', 'signin-or', 'or use your email'));
      wrap.appendChild(alt);
      googleUse = function (resp) {   // whichever sign-in form is on the page gets the answer
        status.className = 'g-status'; status.textContent = 'Signing you in…';
        call('login_google', { credential: (resp && resp.credential) || '', next: next }).then(function (d) {
          if (!d.ok) { status.textContent = d.message; status.className = 'g-status bad'; return; }
          status.textContent = '';
          set('pas-in', '1');
          done(d);
        });
      };
      loadGoogle(function (ok) {
        if (!ok || !alt.parentNode) return;
        if (!googleReady) { googleReady = true; window.google.accounts.id.initialize({ client_id: GOOGLE, ux_mode: 'popup', auto_select: false, callback: function (resp) { if (googleUse) googleUse(resp); } }); }
        alt.hidden = false;
        window.google.accounts.id.renderButton(gslot, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', logo_alignment: 'left', width: Math.max(220, Math.min(380, wrap.clientWidth || 320)) });
      });
    }
    wrap.appendChild(form); wrap.appendChild(step2);
    wrap.appendChild(status);
    box.appendChild(wrap);
    var req = '';
    again.addEventListener('click', function () { step2.hidden = true; form.hidden = false; intro.hidden = false; if (alt) alt.hidden = false; status.textContent = ''; status.className = 'g-status'; input.focus(); });
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
        form.hidden = true; intro.hidden = true; if (alt) alt.hidden = true; step2.hidden = false; code.value = ''; code.focus();
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

  var googleWait = null, googleReady = false, googleUse = null;
  function loadGoogle(cb) {
    if (window.google && window.google.accounts && window.google.accounts.id) return cb(true);
    if (googleWait) { googleWait.push(cb); return; }
    googleWait = [cb];
    var finish = function (ok) { var q = googleWait; googleWait = null; q.forEach(function (f) { f(ok && !!(window.google && window.google.accounts && window.google.accounts.id)); }); };
    var sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
    sc.onload = function () { finish(true); }; sc.onerror = function () { finish(false); };
    document.head.appendChild(sc);
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
  // What goes to someone's own profile: the same, plus the school each program was picked under, which is what lets the
  // week be put back on another device. Still no free-text notes.
  function weekFull(b, programs) {
    var out = {};
    DAYS.forEach(function (d) {
      out[d[0]] = [];
      ((b && b.days && b.days[d[0]]) || []).forEach(function (e) {
        var i = e.indexOf('~'), key = i < 0 ? e : e.slice(0, i), c = i < 0 ? '' : e.slice(i + 1), p = programs[key.split('.')[0]];
        if (!p) return;
        var v = c && (p.offers || []).indexOf(c) > -1 ? key + '~' + c : key;
        if (out[d[0]].indexOf(v) < 0) out[d[0]].push(v);
      });
    });
    return out;
  }
  function deviceSchool() { try { var m = JSON.parse(get('pas-my-school') || 'null'); return m && typeof m.id === 'string' ? m : null; } catch (e) { return null; } }
  // The school kept in a profile is the one this device starts from, too.
  function adoptSchool(id, name) {
    set('pas-prof-school', id ? '1' : null);
    if (!id || !name) return;
    var cur = deviceSchool();
    if (!cur || cur.id !== id) set('pas-my-school', JSON.stringify({ id: id, name: name }));
  }
  // The grades kept in a profile are copied to this browser, where the lists read them (no request from those pages).
  // Keeping grades for the first time, or changing them, makes "My kids" the grade the lists start on.
  function adoptGrades(list) {
    list = Array.isArray(list) ? list.filter(function (g) { return typeof g === 'string'; }) : [];
    var was = get('pas-my-grades') || '[]', now = JSON.stringify(list);
    if (list.length) { set('pas-my-grades', now); if (was !== now) set('pas-grade', 'MINE'); }
    else { set('pas-my-grades', null); if (get('pas-grade') === 'MINE') set('pas-grade', 'ALL'); }
  }
  function gradeWord(g) { return g === 'PK' ? 'Pre-K' : g; }
  function shortDate(t) { var d = new Date(t * 1000); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
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
    var aq = query();
    var registering = account.getAttribute('data-mode') === 'register';   // the page at /register/
    // The old address for creating an account was /account/?new=1. It still works: it goes to the real page.
    if (aq.new && !registering && !signedInHint()) { location.replace(page('register/') + (aq.next === 'board' ? '?next=board' : '')); return; }
    if (aq.groups) set('pas-groups', '1');   // while groups are a pilot, this is the way in for someone who wasn't invited to one
    var ainfo = {}; try { ainfo = JSON.parse(document.getElementById('groups-data').textContent); } catch (e) { /* older page */ }
    var groupsOn = host.getAttribute('data-pilot') !== '1' || get('pas-groups') === '1';
    var wantNext = aq.next === 'board' ? 'board' : 'account';
    var goNext = function (next) {
      if (next === 'join') { location.href = page('join/'); return true; }
      if (next === 'board') { location.href = page('board/') + '?back=1'; return true; }
      var m = /^groups\?g=([A-Za-z0-9]+)$/.exec(next || '');
      if (m) { location.href = page('groups/') + '?g=' + m[1]; return true; }
      return false;
    };
    var drawSignedOut = function (msg) {
      account.textContent = '';
      if (msg) { var p = el('p', 'g-status bad', msg); account.appendChild(p); }
      var box = el('div', 'panel'); account.appendChild(box);
      signInBox(box, wantNext, function (d) { if (wantNext === 'board' && d.user.ready) goNext('board'); else drawProfile(d); }, 'One step for both: if you’re new, this makes your account. No password. With email, we send a 6-digit code and you type it here.');
      var sh = box.querySelector('h3');
      if (sh) sh.textContent = registering ? 'Create your account' : 'Log in, or create an account';
      var have = el('div', 'panel g-callout');
      have.appendChild(el('h2', null, 'Did someone send you an invitation?'));
      have.appendChild(el('p', null, 'Tap the link in the email. Or start here: it walks you through the code and signing in with the address the invitation was sent to.'));
      var hj = el('a', 'btn', 'Open my invitation'); hj.href = page('join/'); have.appendChild(hj);
      account.appendChild(have);
    };
    var drawProfile = function (d) {
      if (registering) { location.replace(page('account/') + (wantNext === 'board' ? '?next=board' : '')); return; }   // signed in: the profile lives at /account/
      account.textContent = '';
      var me = d.user, groups = d.groups || [];
      if (!me.ready) {   // a new account: first and last name, then the rest
        var fin = el('section', 'panel');
        fin.appendChild(el('h2', null, 'Finish your account'));
        var fl = el('p', null, 'Signed in as '); fl.appendChild(el('b', null, me.email)); fin.appendChild(fl);
        var ff = el('form', 'g-form'), fn = nameFields('new-', me);
        ff.appendChild(fn.box);
        ff.appendChild(el('p', 'hint', 'Anyone you share a week with or invite to a group sees your name on the invitation, and a group’s creator sees it when you join. ' + LIST_NOTE));
        var fs = el('p', 'g-status'); fs.setAttribute('aria-live', 'polite'); ff.appendChild(fs);
        var fa = el('div', 'actions'), fb = el('button', 'btn primary', 'Finish'); fb.type = 'submit';
        var fo = btn('btn', 'Sign out'); fo.addEventListener('click', function () { call('logout', {}).then(function () { set('pas-in', null); drawSignedOut(); }); });
        fa.appendChild(fb); fa.appendChild(fo); ff.appendChild(fa);
        ff.addEventListener('submit', function (e) {
          e.preventDefault(); fb.disabled = true;
          saveNames(me, fn.first.value, fn.last.value).then(function (r) { fb.disabled = false; if (!r.ok) { fs.textContent = r.message; fs.className = 'g-status bad'; return; } if (wantNext === 'board') { goNext('board'); return; } drawProfile(d); });
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
      who.appendChild(el('p', 'hint', 'Anyone you share a week with or invite to a group sees your name on the invitation, and a group’s creator sees it when you join.'));
      nameForm.addEventListener('submit', function (e) {
        e.preventDefault();
        saveNames(me, nf0.first.value, nf0.last.value).then(function (r) { nameNote.textContent = r.ok ? 'Saved.' : r.message; if (r.ok) { nf0.first.value = r.first; nf0.last.value = r.last; } });
      });
      account.appendChild(who);
      // what is kept in the profile: a school, and any weeks
      var prof = el('section', 'panel');
      prof.appendChild(el('h2', null, 'Kept in your profile'));
      prof.appendChild(el('p', null, 'Your school, your children’s grades and your child’s week can live in your profile, so they’re there when you sign in on another phone or computer. Nothing goes in unless you put it there.'));
      var schoolRow = el('form', 'g-row');
      var sl = el('label', null, 'Your school'); sl.htmlFor = 'prof-school';
      var ss = el('select'); ss.id = 'prof-school';
      var o0 = el('option', null, 'No school kept'); o0.value = ''; ss.appendChild(o0);
      (ainfo.schools || []).forEach(function (sc) { var o = el('option', null, sc.name); o.value = sc.id; ss.appendChild(o); });
      var sn = el('span', 'hint'); sn.setAttribute('aria-live', 'polite');
      schoolRow.appendChild(sl); schoolRow.appendChild(ss); schoolRow.appendChild(sn);
      prof.appendChild(schoolRow);
      var schoolName = function (id) { var f = (ainfo.schools || []).filter(function (x) { return x.id === id; })[0]; return f ? f.name : ''; };
      var devNote = el('p', 'hint'); prof.appendChild(devNote);
      var paintSchool = function (kept) {
        ss.value = kept || '';
        devNote.textContent = '';
        var dev = deviceSchool();
        if (!kept && dev && schoolName(dev.id)) {
          devNote.appendChild(document.createTextNode('This device has ' + dev.name + ' saved as your school. '));
          var keep = btn('clear', 'Keep it in my profile');
          keep.addEventListener('click', function () { ss.value = dev.id; saveSchool(); });
          devNote.appendChild(keep);
        } else if (kept) devNote.textContent = 'The home page, lists and your roster start from this school on any device you sign in on. Saving a different school on a school’s page changes it here too.';
      };
      var saveSchool = function () {
        sn.textContent = 'Saving…';
        call('school_save', { school: ss.value }).then(function (r) {
          sn.textContent = r.ok ? (r.school ? 'Kept.' : 'Taken out of your profile. This device still remembers it until you change it on the school’s page.') : r.message;
          if (r.ok) { adoptSchool(r.school, schoolName(r.school)); paintSchool(r.school); }
        });
      };
      ss.addEventListener('change', saveSchool);
      schoolRow.addEventListener('submit', function (e) { e.preventDefault(); });
      var gradeRow = el('div', 'g-grades');
      var gl0 = el('span', 'g-label', 'Your children’s grades'); gl0.id = 'prof-grades-label'; gradeRow.appendChild(gl0);
      var gradeRail = el('div', 'g-grade-rail'); gradeRail.setAttribute('role', 'group'); gradeRail.setAttribute('aria-labelledby', 'prof-grades-label');
      var gradeNote = el('span', 'hint'); gradeNote.setAttribute('aria-live', 'polite');
      var keptGrades = [], gradeBtns = [];
      (ainfo.grades || []).forEach(function (g) {
        var b = btn('gbtn', ''); b.appendChild(el('span', 'g', g)); b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', g === 'PK' ? 'Pre-K' : g === 'K' ? 'Kindergarten' : 'Grade ' + g);
        b.addEventListener('click', function () {
          var want = keptGrades.indexOf(g) > -1 ? keptGrades.filter(function (x) { return x !== g; }) : keptGrades.concat([g]);
          gradeNote.textContent = 'Saving…';
          call('grades_save', { grades: want }).then(function (r) {
            if (!r.ok) { gradeNote.textContent = r.message; return; }
            adoptGrades(r.grades); paintGrades(r.grades);
            gradeNote.textContent = r.grades.length ? 'Kept. Lists of programs now start on “My kid' + (r.grades.length === 1 ? '' : 's') + '”: programs that take ' + r.grades.map(gradeWord).join(' or ') + '.' : 'No grades kept.';
          });
        });
        gradeBtns.push([g, b]); gradeRail.appendChild(b);
      });
      var paintGrades = function (list) { keptGrades = list || []; gradeBtns.forEach(function (x) { x[1].setAttribute('aria-pressed', String(keptGrades.indexOf(x[0]) > -1)); }); };
      gradeRow.appendChild(gradeRail); gradeRow.appendChild(gradeNote);
      gradeRow.appendChild(el('span', 'hint', 'Tap each grade you have a child in. We keep the grades only, not which child is in which.'));
      if ((ainfo.grades || []).length) prof.appendChild(gradeRow);
      var weeksHead = el('h3', null, 'Weeks'); prof.appendChild(weeksHead);
      var weeksBox = el('div'); prof.appendChild(weeksBox);
      var toBoard = el('p', 'hint', 'To keep a week here, or put one on this device, open '); var tb = el('a', null, 'Build your week'); tb.href = page('board/') + '?back=1'; toBoard.appendChild(tb); toBoard.appendChild(document.createTextNode(' and look for “Keep and share this week”.'));
      prof.appendChild(toBoard);
      var paintWeeks = function (weeks) {
        weeksBox.textContent = '';
        if (!weeks.length) { weeksBox.appendChild(el('p', 'hint', 'No weeks kept yet.')); return; }
        var ul = el('ul', 'g-list');
        weeks.forEach(function (w) {
          var li = el('li');
          li.appendChild(el('b', null, w.name + '’s week'));
          var n = weekCount({ days: w.now }) + weekCount({ days: w.next });
          li.appendChild(el('span', 'hint', n + (n === 1 ? ' program' : ' programs') + ' · last changed ' + shortDate(w.updated)));
          var rm = btn('clear', 'Remove from my profile');
          twoTap(rm, 'Tap again to remove it', function () { call('week_delete', { week: w.id }).then(function () { unkeep(w.id); loadProfile(); }); });
          li.appendChild(rm); ul.appendChild(li);
        });
        weeksBox.appendChild(ul);
      };
      var loadProfile = function () {
        call('profile').then(function (p) {
          if (!p.ok) return;
          adoptSchool(p.school, schoolName(p.school)); adoptGrades(p.grades);
          paintSchool(p.school); paintGrades(p.grades || []); paintWeeks(p.weeks || []);
        });
      };
      paintSchool(me.school || ''); paintGrades(me.grades || []); loadProfile();
      account.appendChild(prof);
      // sharing: weeks shared with one person, and groups
      var mine = el('section', 'panel');
      mine.appendChild(el('h2', null, groupsOn ? 'Sharing and groups' : 'Sharing'));
      var noneYet = el('p', 'hint', groupsOn ? 'You’re not sharing a week with anyone yet, and you’re not in any groups.' : 'You’re not sharing a week with anyone yet. You can share one with one person, like a grandparent or sitter, from Build your week.');
      if (!groups.length) mine.appendChild(noneYet);
      var list = el('ul', 'g-list');
      groups.forEach(function (g) {
        var li = el('li');
        var a = el('a', null, g.name); a.href = page('groups/') + '?g=' + g.id; li.appendChild(a);
        var what = g.status !== 'approved' ? 'Waiting for the group’s creator' : g.solo ? (g.role === 'owner' ? 'A week you’re sharing, with the people you chose' : 'Shared with you') : g.role === 'owner' ? 'You made this group' : g.role === 'viewer' ? 'Viewing only' : 'Member';
        if (g.kids && g.kids.length) what += ' · ' + g.kids.map(function (k) { return k.name; }).join(', ');
        li.appendChild(el('span', 'hint', what));
        if (g.waiting) li.appendChild(el('span', 'pill pickup', g.waiting + ' waiting for you'));
        list.appendChild(li);
      });
      mine.appendChild(list);
      account.appendChild(mine);
      if (groups.some(function (g) { return !g.solo; })) groupsOn = true;
      // an invitation: the code goes here
      var join = el('section', 'panel g-callout');
      join.appendChild(el('h2', null, 'Have an invitation?'));
      join.appendChild(el('p', null, 'Type the code from the invitation email. It only works for the address it was sent to, which should be the one you’re signed in with.'));
      var jf = el('form', 'g-row');
      var jl = el('label', null, 'Invitation code'); jl.htmlFor = 'join-code';
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
      // make a group (while groups are a pilot, only for people who have been let in to it)
      var make = el('section', 'panel'); make.hidden = !groupsOn;
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
      // the site's one ask
      var help = el('section', 'panel g-support');
      help.appendChild(el('h2', null, 'Help the site keep going'));
      help.appendChild(el('p', null, 'Philly After School is free and run by one parent. If it saved you an evening of searching, you can chip in toward what it costs to run.'));
      var ha = el('a', 'btn', 'Buy me a coffee'); ha.href = page('support/'); help.appendChild(ha);
      account.appendChild(help);
      // leaving
      var out = el('section', 'panel');
      out.appendChild(el('h2', null, 'Signing out'));
      var acts = el('div', 'actions');
      var so = btn('btn', 'Sign out'), sa = btn('btn', 'Sign out on every device'), del = btn('clear', 'Delete my account');
      acts.appendChild(so); acts.appendChild(sa); acts.appendChild(del);
      out.appendChild(acts);
      out.appendChild(el('p', 'hint', 'Deleting your account removes your email, the school, grades and weeks kept in your profile, every week you shared, and every group you made (for everyone in it). Rosters saved on this device stay.'));
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

  // Forget, on this device, which rosters were shared or kept in a profile (after deleting the account).
  function unlinkAll() {
    try {
      var r = JSON.parse(window.localStorage.getItem('pas-rosters') || 'null');
      if (r && Array.isArray(r.kids)) { r.kids.forEach(function (k) { delete k.groups; delete k.prof; }); window.localStorage.setItem('pas-rosters', JSON.stringify(r)); }
    } catch (e) { /* nothing saved */ }
    set('pas-prof-school', null);
    adoptGrades([]);
  }
  // A week taken out of the profile: this device's copy stays, it just stops being sent.
  function unkeep(weekId) {
    try {
      var r = JSON.parse(window.localStorage.getItem('pas-rosters') || 'null');
      if (r && Array.isArray(r.kids)) { r.kids.forEach(function (k) { if (k.prof && k.prof.id === weekId) delete k.prof; }); window.localStorage.setItem('pas-rosters', JSON.stringify(r)); }
    } catch (e) { /* nothing saved */ }
  }

  // =====================================================================================================
  // A group's page: first names and programs, by day and by child. Only an approved, signed-in member gets the data.
  // =====================================================================================================
  var groupBox = document.getElementById('group');
  if (groupBox) {
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
          signInBox(box, 'groups?g=' + gid, function () { load(); }, 'This page is only for the people it was shared with. Sign in with the email address your invitation was sent to. No password: we email you a 6-digit code.');
          return;
        }
        if (!d.ok) {
          groupBox.textContent = '';
          var p = el('div', 'panel'); p.appendChild(el('p', null, d.message));
          p.appendChild(el('p', null, 'This is invitation only. If you were invited, use the link in your invitation email and sign in with the address it was sent to.'));
          var pa = el('div', 'actions');
          var j = el('a', 'btn primary', 'Open my invitation'); j.href = page('join/'); pa.appendChild(j);
          var a = el('a', 'btn', 'Your account'); a.href = page('account/'); pa.appendChild(a);
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
      if (!d.solo) set('pas-groups', '1');   // someone in a real group has groups switched on in this browser
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
      lede.textContent = d.solo ? 'A first name and programs only. It opens for the people it was shared with and nobody else.'
        : kids.length ? kids.length + (kids.length === 1 ? ' child' : ' children') + '. First names and programs only, seen by the people this group’s creator invited.' : 'Nobody has added a week yet.';
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
      you.appendChild(el('h2', null, d.solo ? (d.role === 'owner' ? 'Your child’s week' : 'Shared with you') : d.role === 'viewer' ? 'You’re viewing only' : 'Your part of this group'));
      if (d.role === 'viewer') you.appendChild(el('p', 'hint', d.solo ? 'You can see and print this week. You can’t change it, and it keeps itself up to date.' : 'You can see and print the group. You can’t change it.'));
      if (mine.length) {
        var ml = el('ul', 'g-list');
        mine.forEach(function (k) {
          var li = el('li'); li.appendChild(el('b', null, k.name));
          li.appendChild(el('span', 'hint', 'Updates itself from the device you shared it from.'));
          var rm = btn('clear', d.solo ? 'Stop sharing this week' : 'Remove from this group');
          twoTap(rm, 'Tap again to remove', function () {
            if (d.solo && d.role === 'owner') call('group_delete', { group: gid }).then(function () { forget(k.id); location.href = page('account/'); });   // nothing left to share
            else call('kid_delete', { kid: k.id }).then(function () { forget(k.id); load(); });
          });
          li.appendChild(rm); ml.appendChild(li);
        });
        you.appendChild(ml);
      }
      var ya = el('div', 'actions');
      if (d.role !== 'viewer' && !d.solo) { var add = el('a', 'btn', mine.length ? 'Add another child’s week' : 'Add your child’s week'); add.href = page('join/') + '?g=' + gid; ya.appendChild(add); }
      var acct = el('a', 'btn', 'Your account'); acct.href = page('account/'); ya.appendChild(acct);
      if (d.role !== 'owner') {
        var leave = btn('clear', d.solo ? 'Stop seeing this week' : 'Leave this group');
        twoTap(leave, d.solo ? 'Tap again to stop seeing it' : 'Tap again to leave and remove your weeks', function () { call('group_leave', { group: gid }).then(function () { mine.forEach(function (k) { forget(k.id); }); location.href = page('account/'); }); });
        ya.appendChild(leave);
      }
      you.appendChild(ya);
      you.appendChild(el('p', 'hint', (d.solo ? 'This stops being shared, and our copy is deleted, on ' : 'This group and everything in it is deleted on ') + longDate(d.expires) + ', after the school year ends.'));
      groupBox.appendChild(you);

      // the owner's controls
      if (d.role === 'owner') {
        var own = el('section', 'panel');
        own.appendChild(el('h2', null, d.solo ? 'Who can see this' : 'Running the group'));
        own.appendChild(el('h3', null, d.solo ? 'Share with someone else' : 'Invite people'));
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
      (target.solo ? ['Code', 'Sign in', 'Your name', 'Done'] : STEPS).forEach(function (s, i) { var li = el('li', i + 1 < n ? 'done' : i + 1 === n ? 'now' : '', s); if (i + 1 === n) li.setAttribute('aria-current', 'step'); ol.appendChild(li); });
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
        set('pas-groups', '1');
        return stepWho();
      }
      if (!target.name) {
        frame(4, 'Checking the code…');
        return call('group_peek', { code: target.code }).then(function (d) {
          if (d.http === 401) { jme = null; return route(); }
          if (!d.ok && d.error === 'notinvited') return stepNotInvited(d.message);
          if (!d.ok) { target.code = ''; sset('pas-join', null); return stepCode(d.message); }
          target.name = d.name; target.gid2 = d.id; target.member = !!d.member; target.solo = !!d.solo;
          if (!target.solo) { set('pas-groups', '1'); return stepWho(); }   // invited to a real group: groups are on in this browser from here
          if (target.member) return stepDone(d.id, true, true);
          call('group_join', { code: target.code, viewer: true }).then(function (j) {   // nothing to choose: they were sent a week to look at
            if (j.http === 401) { jme = null; target.solo = false; target.name = ''; return route(); }
            if (!j.ok && j.error === 'notinvited') { target.solo = false; return stepNotInvited(j.message); }
            if (!j.ok) { target.solo = false; target.code = ''; target.name = ''; sset('pas-join', null); return stepCode(j.message); }
            sset('pas-join', null);
            stepDone(j.id, true, true);
          });
        });
      }
      stepWho();
    };
    var stepCode = function (msg, dropGid) {
      if (dropGid) target.gid = '';
      var panel = frame(1, 'Enter the code from your invitation');
      panel.appendChild(el('p', null, 'It’s the 12 letters and numbers in your invitation email. Tapping the link in that email fills this in for you.'));
      if (msg) panel.appendChild(el('p', 'g-status bad', msg));
      var f = el('form', 'g-row');
      var l = el('label', null, 'Invitation code'); l.htmlFor = 'jc';
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
      var alt = el('p', 'hint', 'No invitation? '); var mk = el('a', null, 'Go to your account'); mk.href = page('account/'); alt.appendChild(mk); alt.appendChild(document.createTextNode('.'));
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
      var panel = frame(target.solo ? 4 : 5, target.solo ? '“' + target.name + '” is open for you' : inAlready ? (viewOnly ? 'You’re in “' + target.name + '”' : 'Added to “' + target.name + '”') : 'Request sent');
      if (target.solo) panel.appendChild(el('p', null, 'You can see it any time you’re signed in with this address, and it keeps itself up to date.'));
      else if (inAlready) panel.appendChild(el('p', null, viewOnly ? 'You can see and print the group now.' : 'The week is in the group now, and it will keep itself up to date when you change it on this device.'));
      else {
        panel.appendChild(el('p', null, 'The person who made “' + target.name + '” has been emailed. When they approve you, you’ll get an email and the group will open for you.'));
        panel.appendChild(el('p', 'hint', viewOnly ? 'Until then the group shows you nothing.' : 'Until then the group shows you nothing, and nobody in it sees your child’s week.'));
      }
      var acts = el('div', 'actions');
      var open = el('a', 'btn primary', target.solo ? 'See the week' : inAlready ? 'Open the group' : 'See your request'); open.href = page('groups/') + '?g=' + id; acts.appendChild(open);
      if (!target.solo) { var wk = el('a', 'btn', 'Back to Build your week'); wk.href = page('board/'); acts.appendChild(wk); }
      var ac = el('a', 'btn', 'Your account'); ac.href = page('account/'); acts.appendChild(ac);
      panel.appendChild(acts);
    };
    call('me').then(function (d) {
      if (d.ok && d.user) { set('pas-in', '1'); jme = d.user; jgroups = d.groups || []; listOnce(jme); }
      route();
    });
  }

  // =====================================================================================================
  // On Build your week: keeping this child's week in a profile, sharing it with one person, and groups
  // =====================================================================================================
  var share = document.getElementById('group-share');
  var board = window.pasBoard;   // set by site.js on the roster page
  if (share && board) {
    var asked = query();
    if (asked.group) set('pas-groups', '1');
    var pilot = share.getAttribute('data-pilot') === '1';
    var groupsOn = function () { return !pilot || get('pas-groups') === '1'; };   // groups for several families stay unlisted while they're a pilot
    var me = null, myGroups = [], notice = '', profile = null, people = {}, checked = false;
    var P = board.data.programs;
    var toWeek = function (b) { return weekOf(b, P); };
    var toFull = function (b) { return weekFull(b, P); };
    var links = function (kid) { return Array.isArray(kid.groups) ? kid.groups : []; };
    var schoolName = function (id) { var x = board.data.schools && board.data.schools[id]; return x ? x.name : ''; };

    // ----- keeping shared and kept weeks current -----
    var timer = null, lastSent = '';
    var syncNow = function () {
      timer = null;
      if (!signedInHint()) return;
      var kids = [], weeks = [];
      board.rosters().kids.forEach(function (k) {
        links(k).forEach(function (l) { kids.push({ id: l.k, now: toWeek(k.now), next: toWeek(k.next) }); });
        if (k.prof) weeks.push({ id: k.prof.id, name: firstWord(k.name), now: toFull(k.now), next: toFull(k.next) });
      });
      if (!kids.length && !weeks.length) return;
      var body = JSON.stringify([kids, weeks]);
      if (body === lastSent) return;
      call('sync', { kids: kids, weeks: weeks }).then(function (d) {
        if (d.http === 401) { notice = 'Sign in again to keep your profile and shared weeks up to date.'; me = null; draw(); return; }
        if (!d.ok) return;
        lastSent = body;
        var touched = false, redraw = false;
        (d.weeks || []).forEach(function (w) { board.rosters().kids.forEach(function (k) { if (k.prof && k.prof.id === w.id) { k.prof.u = w.updated; touched = true; } }); });
        if (d.weeksGone && d.weeksGone.length) {
          board.rosters().kids.forEach(function (k) { if (k.prof && d.weeksGone.indexOf(k.prof.id) > -1) { k.prof = null; touched = true; redraw = true; } });
        }
        if (d.gone && d.gone.length) {
          board.rosters().kids.forEach(function (k) { if (Array.isArray(k.groups)) k.groups = k.groups.filter(function (l) { return d.gone.indexOf(l.k) < 0; }); });
          touched = true; redraw = true;
          notice = 'One of these weeks is no longer shared, so it has stopped updating there.';
        }
        if (touched) board.save();
        if (redraw) draw();
      });
    };
    board.onSave = function () { if (timer) window.clearTimeout(timer); timer = window.setTimeout(syncNow, 1500); drawTop(); };
    // Removing a child from this device stops sharing their week. A copy kept in the profile stays there.
    board.onKidGone = function (kid) { links(kid).forEach(function (l) { if (l.s) call('group_delete', { group: l.g }); else call('kid_delete', { kid: l.k }); }); };
    // The roster page redraws on every keystroke; this block only needs to when the child, their name or the view changes.
    var shownFor = '';
    var shownKey = function () { var k = board.kid(); return board.rosters().kid + '|' + firstWord(k.name) + '|' + (weekCount(k.now) + weekCount(k.next) > 0); };
    board.onShow = function () { var key = shownKey(); if (key !== shownFor) { shownFor = key; draw(); } };

    // A week from the profile, put onto a roster on this device. Notes typed on this device for the same program stay.
    var applyWeek = function (k, w) {
      ['now', 'next'].forEach(function (which) {
        var old = k[which] || board.emptyBoard(), fresh = board.emptyBoard();
        DAYS.forEach(function (d) {
          ((w[which] && w[which][d[0]]) || []).forEach(function (e) {
            if (typeof e !== 'string') return;
            var key = e.split('~')[0], parts = key.split('.'), p = P[parts[0]];
            if (!p || !p.schools || !p.schools[parts[1]]) return;   // a program or school the site no longer lists
            var had = (old.days[d[0]] || []).filter(function (x) { return x.split('~')[0] === key; })[0];
            fresh.days[d[0]].push(e.indexOf('~') > -1 ? e : (had || e));
          });
        });
        k[which] = fresh;
      });
      if (!k.name && w.name) k.name = w.name;
      k.prof = { id: w.id, u: w.updated };
    };
    // What the profile holds, compared with this device: a newer copy there replaces the one here.
    var reconcile = function (p) {
      profile = p;
      adoptSchool(p.school, schoolName(p.school)); adoptGrades(p.grades);
      var changed = false;
      board.rosters().kids.forEach(function (k) {
        if (!k.prof) return;
        var w = (p.weeks || []).filter(function (x) { return x.id === k.prof.id; })[0];
        if (!w) { k.prof = null; changed = true; return; }
        if (w.updated > k.prof.u) { applyWeek(k, w); changed = true; }
      });
      if (changed) { board.save(); board.redraw(); }
    };
    var elsewhere = function () {   // weeks in the profile that no roster on this device is tied to
      var here = board.rosters().kids.filter(function (k) { return k.prof; }).map(function (k) { return k.prof.id; });
      return ((profile && profile.weeks) || []).filter(function (w) { return here.indexOf(w.id) < 0; });
    };

    // Someone sent here from the join page to build a week sees the way back at the top, where they are working.
    var topNote = el('div', 'panel g-callout g-top'); topNote.hidden = true;
    var anchor = document.getElementById('board-adder');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(topNote, anchor);
    var drawTop = function () {
      var midway = tidyCode(sget('pas-join')).length === 12;
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
      share.hidden = false;
      var kid = board.kid(), name = firstWord(kid.name), who = name ? name + '’s week' : 'this week';
      var picks = weekCount(kid.now) + weekCount(kid.next);
      var solo = links(kid).filter(function (l) { return l.s; })[0] || null;
      var inGroups = links(kid).filter(function (l) { return !l.s; });
      share.appendChild(el('h2', null, signedInHint() && me ? 'Keep and share this week' : 'Save this week, or share it'));
      if (notice) share.appendChild(el('p', 'g-status bad', notice));

      if (!signedInHint() || !me) {
        if (signedInHint() && !me && !checked) { share.appendChild(el('p', 'hint', 'Checking your account…')); return; }
        share.appendChild(el('p', null, 'A free account keeps ' + who + ' in your profile, so it’s on your phone and your computer, and lets you share it with one person, like a grandparent or a sitter, who signs in to see it.'));
        var row0 = el('div', 'actions');
        var si = el('a', 'btn primary', 'Create a free account'); si.href = page('register/') + '?next=board'; row0.appendChild(si);
        var li0 = el('a', 'btn', 'Log in'); li0.href = page('account/') + '?next=board'; row0.appendChild(li0);
        if (groupsOn()) { var inv0 = btn('btn', 'I was invited to a group'); inv0.addEventListener('click', toJoin()); row0.appendChild(inv0); }
        share.appendChild(row0);
        return;
      }
      if (!me.ready) {
        share.appendChild(el('p', null, 'Add your first and last name to your account first.'));
        var fin = el('a', 'btn primary', 'Finish your account'); fin.href = page('account/') + '?next=board'; share.appendChild(fin);
        return;
      }

      // ----- 1. the profile -----
      var keep = el('div', 'g-part');
      keep.appendChild(el('h3', null, 'In your profile'));
      if (kid.prof) {
        keep.appendChild(el('p', null, (name || 'This week') + (name ? '’s week' : '') + ' is kept in your profile. Changes you make here save themselves, and it’s there when you sign in on another device.'));
        var drop = btn('clear', 'Take it out of my profile');
        twoTap(drop, 'Tap again: it stays on this device only', function () {
          var id = kid.prof.id;
          call('week_delete', { week: id }).then(function (d) {
            if (!d.ok && d.http !== 401) { notice = d.message; draw(); return; }
            kid.prof = null; board.save(); if (profile) profile.weeks = (profile.weeks || []).filter(function (w) { return w.id !== id; }); notice = ''; draw();
          });
        });
        keep.appendChild(drop);
      } else {
        keep.appendChild(el('p', null, 'Keep ' + who + ' in your profile and it’s there when you sign in on another phone or computer. Notes you typed stay on this device.'));
        var kb = btn('btn primary', 'Keep ' + who + ' in my profile');
        var ks = el('span', 'hint'); ks.setAttribute('aria-live', 'polite');
        kb.addEventListener('click', function () {
          if (!name) { ks.textContent = 'Add your child’s first name at the top of the page first, so you can tell weeks apart.'; return; }
          kb.disabled = true;
          call('week_save', { week: { name: name, now: toFull(kid.now), next: toFull(kid.next) } }).then(function (d) {
            kb.disabled = false;
            if (!d.ok) { ks.textContent = d.message; return; }
            kid.prof = { id: d.week.id, u: d.week.updated }; board.save();
            if (profile) profile.weeks = (profile.weeks || []).concat([d.week]);
            board.track({ event: 'pas_group_share', method: 'profile' });
            draw();
          });
        });
        var ka = el('div', 'actions'); ka.appendChild(kb); ka.appendChild(ks); keep.appendChild(ka);
      }
      var others = elsewhere();
      if (others.length) {
        var ol = el('ul', 'g-list');
        others.forEach(function (w) {
          var li = el('li');
          li.appendChild(el('b', null, w.name + '’s week'));
          li.appendChild(el('span', 'hint', 'In your profile, not on this device. Last changed ' + shortDate(w.updated) + '.'));
          var put = btn('clear', 'Put it on this device');
          put.addEventListener('click', function () {
            var r = board.rosters(), at = -1;
            r.kids.forEach(function (k, i) { if (at < 0 && !k.prof && !k.name && !weekCount(k.now) && !weekCount(k.next)) at = i; });   // an untouched roster first
            if (at < 0) {
              if (r.kids.length >= board.maxKids) { notice = 'This device already has ' + board.maxKids + ' rosters. Remove one first.'; draw(); return; }
              r.kids.push(board.newKid(w.name)); at = r.kids.length - 1;
            }
            applyWeek(r.kids[at], w); r.kid = at;
            board.save(); notice = ''; board.redraw(); draw();
          });
          li.appendChild(put); ol.appendChild(li);
        });
        keep.appendChild(ol);
      }
      var mySchool = deviceSchool();
      if (mySchool && profile && !profile.school && schoolName(mySchool.id)) {
        var sp = el('p', 'hint', mySchool.name + ' is saved as your school on this device. ');
        var sk = btn('clear', 'Keep it in my profile too');
        sk.addEventListener('click', function () { call('school_save', { school: mySchool.id }).then(function (d) { if (d.ok) { profile.school = d.school; adoptSchool(d.school, schoolName(d.school)); board.track({ event: 'pas_group_share', method: 'profile_school' }); draw(); } }); });
        sp.appendChild(sk); keep.appendChild(sp);
      } else if (profile && profile.school && schoolName(profile.school)) {
        keep.appendChild(el('p', 'hint', schoolName(profile.school) + ' is kept in your profile as your school.'));
      }
      var gp = el('p', 'hint', profile && profile.grades && profile.grades.length ? 'Your children’s grades in your profile: ' + profile.grades.map(gradeWord).join(', ') + '. ' : 'Keep your children’s grades in your profile and lists of programs start on them. ');
      var ga = el('a', null, profile && profile.grades && profile.grades.length ? 'Change' : 'Add grades'); ga.href = page('account/'); gp.appendChild(ga);
      keep.appendChild(gp);
      share.appendChild(keep);

      // ----- 2. one person -----
      var one = el('div', 'g-part');
      one.appendChild(el('h3', null, 'Share with one person'));
      one.appendChild(el('p', null, 'For a grandparent, a sitter or your co-parent. They get an email, sign in with that address, and see ' + (name || 'your child') + '’s first name and programs. It keeps itself up to date, and you can take it back.'));
      if (solo) {
        var list = el('ul', 'g-list');
        var known = people[solo.g];
        if (!known) {
          list.appendChild(el('li', 'hint', 'Checking who has it…'));
          call('group', null, '&g=' + solo.g).then(function (d) {
            if (d.ok) { people[solo.g] = d.invites || []; }
            else if (d.http === 403 || d.http === 404) { kid.groups = links(kid).filter(function (x) { return x.g !== solo.g; }); board.save(); }
            else return;
            draw();
          });
        } else if (!known.length) list.appendChild(el('li', 'hint', 'Nobody yet.'));
        else known.forEach(function (i) {
          var li = el('li');
          li.appendChild(el('b', null, i.email));
          li.appendChild(el('span', 'hint', i.joined ? 'Has opened it' : 'Invited, hasn’t opened it yet'));
          var acts = el('span', 'g-acts');
          if (!i.joined) {
            var again = btn('clear', 'Send again');
            again.addEventListener('click', function () { again.disabled = true; call('share_one', { group: solo.g, email: i.email }).then(function (d) { again.textContent = d.ok && d.sent ? 'Sent' : 'Not sent just now'; }); });
            acts.appendChild(again);
          }
          var un = btn('clear', 'Remove');
          twoTap(un, 'Tap again: they stop seeing it', function () { call('invite_remove', { group: solo.g, email: i.email }).then(function (d) { if (d.ok) { people[solo.g] = d.invites || []; draw(); } }); });
          acts.appendChild(un); li.appendChild(acts); list.appendChild(li);
        });
        one.appendChild(list);
      }
      var of = el('form', 'g-row');
      var olab = el('label', null, solo ? 'Share with someone else' : 'Their email address'); olab.htmlFor = 'one-email';
      var oi = el('input'); oi.id = 'one-email'; oi.type = 'email'; oi.maxLength = 150; oi.placeholder = 'grandma@example.com'; oi.autocomplete = 'off'; oi.setAttribute('autocapitalize', 'off');
      var ob = el('button', 'btn primary', 'Share ' + who); ob.type = 'submit';
      var os = el('span', 'hint'); os.setAttribute('aria-live', 'polite');
      of.appendChild(olab); of.appendChild(oi); of.appendChild(ob); of.appendChild(os);
      of.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!name) { os.textContent = 'Add your child’s first name at the top of the page first.'; return; }
        if (!picks) { os.textContent = 'Add at least one program to the week first.'; return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(oi.value.trim())) { os.textContent = 'That email address doesn’t look right.'; return; }
        ob.disabled = true; os.textContent = 'Sending…';
        var body = solo ? { group: solo.g, email: oi.value.trim().toLowerCase() } : { email: oi.value.trim().toLowerCase(), kid: { name: name, now: toWeek(kid.now), next: toWeek(kid.next) } };
        call('share_one', body).then(function (d) {
          ob.disabled = false;
          if (!d.ok) { os.textContent = d.message; return; }
          if (d.made && d.kid) { kid.groups = links(kid).concat([{ g: d.id, k: d.kid, n: d.name, c: name, s: 1 }]); board.save(); }
          people[d.id] = d.invites || [];
          board.track({ event: 'pas_group_share', method: 'one_person' });
          notice = '';
          draw();
          var said = document.getElementById('one-said'); if (said) said.textContent = d.sent ? 'Invitation sent to ' + body.email + '.' : body.email + ' is on the list, but the email couldn’t go out just now. Use “Send again” later.';
        });
      });
      one.appendChild(of);
      var said = el('p', 'g-status good'); said.id = 'one-said'; said.setAttribute('aria-live', 'polite'); one.appendChild(said);
      if (solo) {
        var foot = el('p', 'hint');
        var see = el('a', null, 'See what they see'); see.href = page('groups/') + '?g=' + solo.g; foot.appendChild(see);
        foot.appendChild(document.createTextNode(' · '));
        var stopAll = btn('clear', 'Stop sharing with everyone');
        twoTap(stopAll, 'Tap again to stop', function () {
          call('group_delete', { group: solo.g }).then(function (d) {
            if (!d.ok && d.http !== 401 && d.http !== 403) { notice = d.message; draw(); return; }
            kid.groups = links(kid).filter(function (x) { return x.g !== solo.g; }); delete people[solo.g]; board.save(); notice = ''; draw();
          });
        });
        foot.appendChild(stopAll); one.appendChild(foot);
      }
      share.appendChild(one);

      // ----- 3. groups (unlisted while they're a pilot) -----
      if (!groupsOn() && !inGroups.length) return;
      var grp = el('div', 'g-part');
      grp.appendChild(el('h3', null, 'Share with a group'));
      var midway = tidyCode(sget('pas-join')).length === 12;
      if (midway) {   // came here from the join page to build the week first
        var back = el('div', 'panel g-callout');
        back.appendChild(el('p', null, 'You’re part-way through joining a group. When ' + who + ' looks right, pick up where you left off.'));
        var cont = btn('btn primary', 'Continue joining with ' + who);
        cont.addEventListener('click', toJoin());
        back.appendChild(cont); grp.appendChild(back);
      }
      if (inGroups.length) {
        var ul = el('ul', 'g-list');
        inGroups.forEach(function (l) {
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
        grp.appendChild(ul);
      } else {
        grp.appendChild(el('p', null, 'A few families you know, seeing each other’s weeks. A group is invitation only, and shows first names and programs to the people in it.'));
      }
      var row = el('div', 'actions');
      if (!midway) {
        var code = btn('btn', 'I was invited to a group');
        code.addEventListener('click', toJoin());
        row.appendChild(code);
      }
      var taken = inGroups.map(function (l) { return l.g; });
      myGroups.filter(function (g) { return !g.solo && taken.indexOf(g.id) < 0; }).slice(0, 4).forEach(function (g) {
        var b = btn('btn', 'Add ' + who + ' to ' + g.name);
        b.addEventListener('click', toJoin('?g=' + g.id));
        row.appendChild(b);
      });
      var acct = el('a', 'btn', 'Start a group'); acct.href = page('account/'); row.appendChild(acct);
      grp.appendChild(row);
      share.appendChild(grp);
    };
    var refresh = function () {
      call('me').then(function (d) {
        checked = true;
        if (d.ok && d.user) { set('pas-in', '1'); me = d.user; myGroups = d.groups || []; listOnce(me); } else { me = null; myGroups = []; if (d.ok) set('pas-in', null); else notice = d.message; }
        // pick up new names for groups that were renamed
        var changed = false;
        board.rosters().kids.forEach(function (k) { links(k).forEach(function (l) { myGroups.forEach(function (g) { if (g.id === l.g && g.name !== l.n) { l.n = g.name; changed = true; } }); }); });
        if (changed) board.save();
        if (!me) { draw(); return; }
        call('profile').then(function (p) {
          if (p.ok) reconcile({ school: p.school || '', grades: p.grades || [], weeks: p.weeks || [] });
          draw();
          syncNow();
        });
      });
    };
    if (asked.group || asked.back) {
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* file preview */ }
      window.setTimeout(function () { if (share.scrollIntoView) share.scrollIntoView({ block: 'start' }); }, 80);
    }
    shownFor = shownKey();
    draw();
    if (signedInHint()) refresh();
  }
})();
