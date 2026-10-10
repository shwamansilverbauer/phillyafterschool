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
  // A week can also carry weekend classes. On a device they sit beside the five days (board.wk); once they leave it
  // they travel as two more days, "sat" and "sun", holding program ids (and a class the program lists), nothing else.
  var WKDAYS = [['sat', 'Saturday', 'Sat'], ['sun', 'Sunday', 'Sun']];
  function weekendOut(b, out, offersOf) {
    WKDAYS.forEach(function (d) {
      out[d[0]] = [];
      ((b && b.wk && b.wk[d[0]]) || []).forEach(function (e) {
        if (typeof e !== 'string') return;
        var i = e.indexOf('~'), id = i < 0 ? e : e.slice(0, i), c = i < 0 ? '' : e.slice(i + 1), offers = offersOf(id);
        if (!offers) return;
        var v = c && offers.indexOf(c) > -1 ? id + '~' + c : id;
        if (out[d[0]].indexOf(v) < 0) out[d[0]].push(v);
      });
    });
    return out;
  }
  // The days a shared week shows: Monday to Friday, plus Saturday and Sunday when any child has something there.
  function daysShown(kids, which) {
    return DAYS.concat(WKDAYS.filter(function (d) { return kids.some(function (k) { return ((k[which] && k[which][d[0]]) || []).length > 0; }); }));
  }

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
        if (d.user && d.user.role) noteRole(d.user);
        return d;
      }, function () { return { ok: false, http: r.status, message: 'Something went wrong on our side. Please try again.' }; });
    }, function () { return { ok: false, http: 0, message: 'Couldn’t reach the site. Check your connection and try again.' }; });
  }

  // ----- signing in: an email with a link (for this device) and a 6-digit code (for the page that asked) -----
  // The sign-up page (/register/) is the one account page that loads analytics. It is told that a sign-up started and
  // how (email or Google), and that it finished: never the address, the name or anything typed.
  // The managers' page loads it too, and says so: "role" is which of the two doors the sign-up came through.
  function signupStep(step, method, d) {
    var role = document.querySelector('#account[data-mode="register"]') ? 'parent' : document.getElementById('claims') ? 'manager' : '';
    if (!role) return;
    var ev = { event: 'pas_signup', step: step, method: method, role: role };
    if (d) ev.account = d['new'] ? 'new' : 'returning';
    (window.dataLayer = window.dataLayer || []).push(ev);
  }

  // Parent or program manager? The server says which, and this device keeps the one word, so the pages that count
  // visits can tell the two groups apart. The email list is told as well, once the account is on it: the word, and
  // for a manager the names of the listings they hold. Nothing else about the person goes with it.
  function noteRole(u, listings) {
    if (!u || !/^(parent|manager)$/.test(u.role || '')) return;
    if (get('pas-role') !== u.role) {
      set('pas-role', u.role);
      if (window.dataLayer) window.dataLayer.push({ event: 'pas_role', pas_role: u.role, pas_signed_in: 'yes' });
      if (typeof window.clarity === 'function') window.clarity('set', 'role', u.role);
    }
    if (!KL_KEY || !u.email || !u.listed) return;
    var mark = 0, i;
    for (i = 0; i < u.email.length; i++) mark = (mark * 31 + u.email.charCodeAt(i)) % 9973;   // tells two accounts on one device apart without keeping the address
    var was = {}; try { was = JSON.parse(get('pas-kl-role') || '{}') || {}; } catch (e) { was = {}; }
    var names = listings ? listings.join(' | ') : null;
    var place = (u.school || '') + '/' + (u.hood || '');   // where they are: which school they kept, and their neighborhood
    if (was.m === mark && was.r === u.role && (was.p || '/') === place && (names === null || was.l === names)) return;
    var asking = mark + '|' + u.role + '|' + place + '|' + names;
    if (noteRole.asking === asking) return;   // already on its way from this page
    noteRole.asking = asking;
    var props = { role: u.role, home_school: u.school || '', neighborhood: u.hood || '' };
    if (names !== null) props.claimed_listings = listings;
    window.fetch('https://a.klaviyo.com/client/profiles?company_id=' + encodeURIComponent(KL_KEY), {
      method: 'POST',
      headers: { 'content-type': 'application/vnd.api+json', revision: '2026-07-15' },
      body: JSON.stringify({ data: { type: 'profile', attributes: { email: u.email, properties: props } } })
    }).then(function (r) {
      if (r.status >= 200 && r.status < 300) set('pas-kl-role', JSON.stringify({ m: mark, r: u.role, p: place, l: names === null ? (was.m === mark ? was.l : undefined) : names }));
    }, function () { /* blocked or offline: tried again another time */ });
  }
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
          signupStep('signed_in', 'google', d);
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
        signupStep('code_sent', 'email');
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
        signupStep('signed_in', 'email', d);
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
  var weekendOf = null;   // on Build your week: the programs with weekend classes, which may not be after-school listings at all
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
    return weekendOut(b, out, function (id) { var p = programs[id]; return p && (p.wk || (weekendOf && weekendOf[id])) ? (p.offers || []) : weekendOf && weekendOf[id] ? [] : null; });
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
    return weekendOut(b, out, function (id) { var p = programs[id]; return p && (p.wk || (weekendOf && weekendOf[id])) ? (p.offers || []) : weekendOf && weekendOf[id] ? [] : null; });
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
  function weekCount(b) {
    var n = 0;
    DAYS.forEach(function (d) { n += ((b && b.days && b.days[d[0]]) || []).length; });
    WKDAYS.forEach(function (d) { n += ((b && b.wk && b.wk[d[0]]) || []).length + ((b && b.days && b.days[d[0]]) || []).length; });   // on a device (wk) or as it came back from the server (days)
    return n;
  }
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
        attributes: { custom_source: 'phillyafterschool.org account', profile: { data: { type: 'profile', attributes: { email: me.email, first_name: me.first, last_name: me.last, properties: { has_account: true, role: me.role === 'manager' ? 'manager' : 'parent' }, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } } } },
        relationships: { list: { data: { type: 'list', id: KL_LIST } } } } })
    }).then(function (r) { if (r.status >= 200 && r.status < 300) { me.listed = true; call('listed', {}); if (window.pasClaimNames) noteRole(me, window.pasClaimNames()); } }, function () { /* blocked or offline: it is tried again at the next sign-in */ });
  }
  // A mobile number for texts is optional, and is only kept with a yes to this exact wording (the server notes which).
  var TEXTS_YES = 'Yes, text me when something I follow posts a sign-up date. Texts haven’t started yet; when they do, expect a few a month at most. Message and data rates may apply. Reply STOP to end them at any time.';
  function phoneFields(prefix, value) {
    var wrap = el('div', 'g-phone');
    var f = el('div', 'field'), l = el('label', null, 'Mobile number for texts (optional)'), i = el('input');
    l.htmlFor = prefix + 'phone'; i.id = prefix + 'phone'; i.type = 'tel'; i.autocomplete = 'tel-national'; i.inputMode = 'tel'; i.maxLength = 20; i.placeholder = '215-555-0123'; i.value = value || '';
    f.appendChild(l); f.appendChild(i); wrap.appendChild(f);
    var yes = el('label', 'g-check'), box = el('input'); box.type = 'checkbox'; box.id = prefix + 'texts'; box.checked = !!value;
    yes.appendChild(box); yes.appendChild(el('span', null, TEXTS_YES));
    wrap.appendChild(yes);
    return { box: wrap, phone: i, yes: box };
  }
  // Listing pages fetch this script only when someone taps Follow or Save while signed out (see src/site.js).
  window.pasAccount = { signIn: signInBox, added: listOnce };
  function saveNames(me, first, last) {
    return call('set_name', { first: first, last: last }).then(function (r) {
      if (r.ok) { me.first = r.first; me.last = r.last; me.ready = true; listOnce(me); }
      return r;
    });
  }

  // The page a followed or saved thing lives on.
  function markHref(k) {
    var id = k.slice(2);
    return k.charAt(0) === 'p' ? page('programs/' + id + '/') : k.charAt(0) === 'c' ? page('summer-camps/' + id + '/') : k.charAt(0) === 'w' ? page(id + '/') + '#this-week' : id === 'all' ? page('alerts/') : page(id + '/');
  }

  // =====================================================================================================
  // The profile page: sign in, your first name, your groups, make a group, sign out, delete the account
  // =====================================================================================================
  var hasYearPage = !!document.querySelector('[data-groups][data-year="1"]');   // the year calendar exists on this copy of the site
  var account = document.getElementById('account');
  if (account) {
    var aq = query();
    var registering = account.getAttribute('data-mode') === 'register';   // the page at /register/
    // One script draws two pages once someone is signed in. /profile/ is a snapshot: one card with who they are, their
    // kids, school, what they follow, their favorites, schedules and calendars, and nothing on it can be changed there.
    // /account/ is where everything is changed: name, email address, phone, school and grades, emails, follows, kept
    // plans, sharing, signing out. A link to a part that lives on the other page (/profile/#following) is sent there.
    var view = account.getAttribute('data-view') === 'profile' ? 'profile' : 'account';
    var PARTS = { profile: ['card', 'new'], account: ['you', 'email', 'texts', 'school', 'emails', 'push', 'following', 'favorites', 'plans', 'sharing', 'listings', 'sign-out'] };
    var MOVED = { profile: 'you' };   // names a part has had
    var fresh = false;   // someone signed in on this visit, rather than arriving signed in
    // a link followed while the page is already open (the address changes, the page doesn't load again)
    window.addEventListener('hashchange', function () {
      var h = /^#[a-z-]{2,20}$/.test(location.hash) ? location.hash.slice(1) : ''; if (MOVED[h]) h = MOVED[h];
      var other = view === 'profile' ? 'account' : 'profile';
      if (h && signedInHint() && PARTS[view].indexOf(h) < 0 && PARTS[other].indexOf(h) > -1) location.replace(page(other + '/') + '#' + h);
    });
    // The old address for creating an account was /account/?new=1. It still works: it goes to the real page.
    if (aq.new && !registering && !signedInHint()) { location.replace(page('register/') + (/^(board|summer|daysoff|calendar)$/.test(aq.next || '') ? '?next=' + aq.next : '')); return; }
    if (aq.groups) set('pas-groups', '1');   // while groups are a pilot, this is the way in for someone who wasn't invited to one
    var ainfo = {}; try { ainfo = JSON.parse(document.getElementById('groups-data').textContent); } catch (e) { /* older page */ }
    var groupsOn = host.getAttribute('data-pilot') !== '1' || get('pas-groups') === '1';
    var wantNext = /^(board|summer|daysoff|calendar|profile)$/.test(aq.next || '') ? aq.next : view === 'profile' ? 'profile' : 'account';
    var goNext = function (next) {
      if (next === 'join') { location.href = page('join/'); return true; }
      if (next === 'board') { location.href = page('board/') + '?back=1'; return true; }
      if (next === 'summer') { location.href = page('summer-schedule/') + '#plan'; return true; }
      if (next === 'daysoff') { location.href = page('days-off/') + '#plan'; return true; }
      if (next === 'calendar') { location.href = page('calendar/'); return true; }
      if (next === 'profile') { if (view === 'profile') return false; location.href = page('profile/'); return true; }
      if (next === 'managers' || next === 'directors') { location.href = page('managers/'); return true; }
      var fm = /^[fv]:(p|c|s):([a-z0-9-]+)$/.exec(next || '');   // signed in from a Follow or Save button: back to that page
      if (fm) { location.href = markHref(fm[1] + ':' + fm[2]) + '#by-email'; return true; }
      var m = /^groups\?g=([A-Za-z0-9]+)$/.exec(next || '');
      if (m) { location.href = page('groups/') + '?g=' + m[1]; return true; }
      return false;
    };
    var drawSignedOut = function (msg) {
      account.textContent = '';
      if (msg) { var p = el('p', 'g-status bad', msg); account.appendChild(p); }
      // two kinds of account start here: a parent's, on this page, and a program manager's, on the page where listings are claimed
      var who = el('div', 'acct-who'); who.setAttribute('role', 'group'); who.setAttribute('aria-label', 'Who is the account for?');
      var mine = el('div', 'acct-who-on'); mine.setAttribute('aria-current', 'true');
      mine.appendChild(el('b', null, 'Parent or caregiver')); mine.appendChild(el('span', null, registering ? 'Create your account below' : 'Log in or create an account below'));
      var theirs = el('a', 'acct-who-go'); theirs.href = page('managers/');
      theirs.appendChild(el('b', null, 'Program manager')); theirs.appendChild(el('span', null, 'Claim your listing, or add your program'));
      who.appendChild(mine); who.appendChild(theirs); account.appendChild(who);
      var box = el('div', 'panel'); account.appendChild(box);
      signInBox(box, wantNext, function (d) { fresh = true; if (wantNext !== 'account' && d.user.ready && goNext(wantNext)) return; drawProfile(d); }, 'One step for both: if you’re new, this makes your account. No password. With email, we send a 6-digit code and you type it here.');
      var sh = box.querySelector('h3');
      if (sh) sh.textContent = registering ? 'Create your account' : 'Log in, or create an account';
      var have = el('div', 'panel g-callout');
      have.appendChild(el('h2', null, 'Did someone send you an invitation?'));
      have.appendChild(el('p', null, 'Tap the link in the email. Or start here: it walks you through the code and signing in with the address the invitation was sent to.'));
      var hj = el('a', 'btn', 'Open my invitation'); hj.href = page('join/'); have.appendChild(hj);
      account.appendChild(have);
    };
    var drawProfile = function (d) {
      if (registering) { location.replace(wantNext === 'account' ? page('profile/') : page('account/') + '?next=' + wantNext); return; }   // signed in: on to the profile, or to where they were headed
      var me = d.user, groups = d.groups || [];
      // someone who has just signed in on the account page lands on their profile: that is where their things are
      if (fresh && view === 'account' && me.ready && wantNext === 'account') { location.replace(page('profile/')); return; }
      // a link to a part that lives on the other page
      var hashPart = /^#[a-z-]{2,20}$/.test(location.hash) ? location.hash.slice(1) : '';
      if (MOVED[hashPart]) hashPart = MOVED[hashPart];
      if (hashPart && me.ready && PARTS[view].indexOf(hashPart) < 0) {
        var other = view === 'profile' ? 'account' : 'profile';
        if (PARTS[other].indexOf(hashPart) > -1) { location.replace(page(other + '/') + '#' + hashPart); return; }
      }
      account.textContent = '';
      if (!me.ready) {   // a new account: first and last name, then the rest
        var fin = el('section', 'panel');
        fin.appendChild(el('h2', null, 'Finish your account'));
        var fl = el('p', null, 'Signed in as '); fl.appendChild(el('b', null, me.email)); fin.appendChild(fl);
        var ff = el('form', 'g-form'), fn = nameFields('new-', me);
        ff.appendChild(fn.box);
        var pickOf = function (id, label, none, items, value) {
          var w = el('div', 'field'), l = el('label', null, label), sl = el('select');
          l.htmlFor = id; sl.id = id;
          var o0 = el('option', null, none); o0.value = ''; sl.appendChild(o0);
          (items || []).forEach(function (x) { var o = el('option', null, x.name); o.value = x.id; sl.appendChild(o); });
          sl.value = value || '';
          w.appendChild(l); w.appendChild(sl); ff.appendChild(w);
          return sl;
        };
        var devSchool = deviceSchool();
        var newSchool = pickOf('new-school', 'Your school (optional)', 'Not listed, or rather not say', ainfo.schools, me.school || (devSchool ? devSchool.id : ''));
        var newHood = pickOf('new-hood', 'Your neighborhood (optional)', 'Rather not say', ainfo.hoods, me.hood || '');
        ff.appendChild(el('p', 'hint', 'Your school and neighborhood set where lists start, and which news reaches you.'));
        var newPhone = phoneFields('new-', '');
        ff.appendChild(newPhone.box);
        ff.appendChild(el('p', 'hint', 'Anyone you share a week with or invite to a group sees your name on the invitation, and a group’s creator sees it when you join. ' + LIST_NOTE));
        var fs = el('p', 'g-status'); fs.setAttribute('aria-live', 'polite'); ff.appendChild(fs);
        var fa = el('div', 'actions'), fb = el('button', 'btn primary', 'Finish'); fb.type = 'submit';
        var fo = btn('btn', 'Sign out'); fo.addEventListener('click', function () { call('logout', {}).then(function () { set('pas-in', null); drawSignedOut(); }); });
        fa.appendChild(fb); fa.appendChild(fo); ff.appendChild(fa);
        ff.addEventListener('submit', function (e) {
          e.preventDefault(); fb.disabled = true;
          call('basics', { first: fn.first.value, last: fn.last.value, school: newSchool.value, hood: newHood.value, phone: newPhone.phone.value, texts: newPhone.yes.checked }).then(function (r) {
            fb.disabled = false;
            if (!r.ok) { fs.textContent = r.message; fs.className = 'g-status bad'; return; }
            Object.keys(r.user).forEach(function (k) { me[k] = r.user[k]; });
            if (me.school) adoptSchool(me.school, (ainfo.schools || []).filter(function (x) { return x.id === me.school; }).map(function (x) { return x.name; })[0] || '');
            listOnce(me);
            if (wantNext !== 'account' && goNext(wantNext)) return;
            drawProfile(d);
          });
        });
        fin.appendChild(ff); account.appendChild(fin);
        fn.first.focus();
        return;
      }
      listOnce(me);
      // a strip of links to each part of the page: there is a lot on it
      var jump = el('nav', 'jump'); jump.setAttribute('data-jump', ''); jump.setAttribute('aria-label', 'On this page'); jump.hidden = true;
      if (view === 'account') account.appendChild(jump);   // the account page is long; the profile is one card
      var part = function (box, id, label) { box.id = id; box.setAttribute('data-jump-to', label); return box; };
      var put = function (panel, where) { if (where === view) account.appendChild(panel); };   // each panel is built either way and shown on its own page
      // the account page starts with who is signed in, and the way back to the snapshot
      var who = el('section', 'panel acct-top');
      who.appendChild(el('h2', null, 'Your account'));
      var line = el('p', null, 'Signed in as '), whoMail = el('b', null, me.email); line.appendChild(whoMail); line.appendChild(document.createTextNode('. This is where you change what’s in your account. Your profile shows it all on one card.')); who.appendChild(line);
      var toProf = el('a', 'btn', 'See my profile'); toProf.href = page('profile/'); var tpw = el('div', 'actions'); tpw.appendChild(toProf); who.appendChild(tpw);
      put(who, 'account');
      // your details: name, email address, mobile number
      var you = part(el('section', 'panel'), 'you', 'Your details');
      you.appendChild(el('h2', null, 'Your details'));
      var nameForm = el('form', 'g-form'), nf0 = nameFields('acct-', me);
      var nameSave = el('button', 'btn', 'Save'); nameSave.type = 'submit';
      var nameNote = el('span', 'hint'); nameNote.setAttribute('aria-live', 'polite');
      var nameActs = el('div', 'actions'); nameActs.appendChild(nameSave); nameActs.appendChild(nameNote);
      nameForm.appendChild(nf0.box); nameForm.appendChild(nameActs);
      you.appendChild(nameForm);
      you.appendChild(el('p', 'hint', 'Anyone you share a week with or invite to a group sees your name on the invitation, and a group’s creator sees it when you join.'));
      nameForm.addEventListener('submit', function (e) {
        e.preventDefault();
        saveNames(me, nf0.first.value, nf0.last.value).then(function (r) { nameNote.textContent = r.ok ? 'Saved.' : r.message; if (r.ok) { nf0.first.value = r.first; nf0.last.value = r.last; } });
      });
      // the address they sign in with: a code sent to the new one proves it is theirs
      var emHead = el('h3', null, 'Email address'); emHead.id = 'email'; you.appendChild(emHead);
      var emLine = el('p', null, 'You sign in with '), emNow = el('b', null, me.email); emLine.appendChild(emNow); emLine.appendChild(document.createTextNode(', and your date emails go there.')); you.appendChild(emLine);
      if (me.claims) you.appendChild(el('p', 'hint', 'This account manages a listing, and the listing was claimed with this address, so it can’t be changed here. Write to us and we’ll move it for you.'));
      else {
        var emOpen = btn('btn', 'Change my email address'), emOpenRow = el('div', 'actions'); emOpenRow.appendChild(emOpen); you.appendChild(emOpenRow);
        var emForm = el('form', 'g-form'); emForm.hidden = true; emForm.noValidate = true;
        var emF = el('div', 'field'), emL = el('label', null, 'New email address'), emIn = el('input');
        emL.htmlFor = 'acct-email'; emIn.id = 'acct-email'; emIn.type = 'email'; emIn.maxLength = 150; emIn.autocomplete = 'email'; emIn.setAttribute('autocapitalize', 'none');
        emF.appendChild(emL); emF.appendChild(emIn); emForm.appendChild(emF);
        var emC = el('div', 'field'), emCL = el('label', null, 'The 6-digit code we sent to it'), emCode = el('input'); emC.hidden = true;
        emCL.htmlFor = 'acct-email-code'; emCode.id = 'acct-email-code'; emCode.type = 'text'; emCode.inputMode = 'numeric'; emCode.maxLength = 7; emCode.autocomplete = 'one-time-code'; emCode.className = 'code-input';
        emC.appendChild(emCL); emC.appendChild(emCode); emForm.appendChild(emC);
        var emGo = el('button', 'btn primary', 'Send a code to it'); emGo.type = 'submit';
        var emStop = btn('clear', 'Never mind');
        var emNote = el('span', 'hint'); emNote.setAttribute('aria-live', 'polite');
        var emActs = el('div', 'actions'); emActs.appendChild(emGo); emActs.appendChild(emStop); emActs.appendChild(emNote); emForm.appendChild(emActs);
        emForm.appendChild(el('p', 'hint', 'We send a code to the new address to make sure it’s yours. Once you type it here, you sign in with the new address, what you follow moves to it, and a note goes to the old one. Other devices are signed out.'));
        you.appendChild(emForm);
        var emDone = el('p', 'g-status good'); emDone.setAttribute('aria-live', 'polite'); emDone.hidden = true; you.appendChild(emDone);
        var emReq = '';
        var emReset = function () { emReq = ''; emIn.value = ''; emCode.value = ''; emIn.readOnly = false; emC.hidden = true; emGo.textContent = 'Send a code to it'; emNote.textContent = ''; emForm.hidden = true; emOpenRow.hidden = false; };
        emOpen.addEventListener('click', function () { emForm.hidden = false; emOpenRow.hidden = true; emDone.hidden = true; emIn.focus(); });
        emStop.addEventListener('click', emReset);
        emForm.addEventListener('submit', function (e) {
          e.preventDefault(); emGo.disabled = true; emNote.textContent = emReq ? 'Checking…' : 'Sending…';
          if (!emReq) {
            call('email_start', { email: emIn.value }).then(function (r) {
              emGo.disabled = false;
              if (!r.ok) { emNote.textContent = r.message; return; }
              emReq = r.req; emIn.readOnly = true; emC.hidden = false; emGo.textContent = 'Use this address';
              emNote.textContent = 'Sent. It can take a minute, and it works for ' + r.minutes + ' minutes.'; emCode.focus();
            });
            return;
          }
          call('email_finish', { req: emReq, code: emCode.value }).then(function (r) {
            emGo.disabled = false;
            if (!r.ok) { emNote.textContent = r.message; if (r.error === 'expired' || r.error === 'taken') { emReq = ''; emIn.readOnly = false; emC.hidden = true; emCode.value = ''; emGo.textContent = 'Send a code to it'; } return; }
            var old = me.email;
            Object.keys(r.user).forEach(function (k) { me[k] = r.user[k]; });
            emNow.textContent = me.email; whoMail.textContent = me.email;
            set('pas-kl-role', null); listOnce(me);   // the email list hears about the new address
            if (MK && MK.moved) MK.moved(old).then(function () { if (typeof drawMarks === 'function') drawMarks(); });
            emReset();
            emDone.textContent = 'Done. You now sign in with ' + me.email + ', and that’s where your emails go. A note went to the old address.'; emDone.hidden = false;
          });
        });
      }
      // a mobile number for texts
      var phoneForm = el('form', 'g-form'), pf = phoneFields('acct-', me.phone || '');
      var phoneSave = el('button', 'btn', 'Save'); phoneSave.type = 'submit';
      var phoneDrop = btn('clear', 'Remove my number'); phoneDrop.hidden = !me.phone;
      var phoneNote = el('span', 'hint'); phoneNote.setAttribute('aria-live', 'polite');
      var phoneActs = el('div', 'actions'); phoneActs.appendChild(phoneSave); phoneActs.appendChild(phoneDrop); phoneActs.appendChild(phoneNote);
      phoneForm.id = 'texts';
      phoneForm.appendChild(el('h3', null, 'Mobile number')); phoneForm.appendChild(pf.box); phoneForm.appendChild(phoneActs);
      var savePhone = function (number, yes) {
        phoneNote.textContent = 'Saving…';
        call('phone_save', { phone: number, texts: yes }).then(function (r) {
          if (!r.ok) { phoneNote.textContent = r.message; return; }
          me.phone = r.phone; pf.phone.value = r.phone; pf.yes.checked = !!r.phone; phoneDrop.hidden = !r.phone;
          phoneNote.textContent = r.phone ? 'Saved. We’ll only use it for the texts described above.' : 'Your number is gone from your account.';
        });
      };
      phoneForm.addEventListener('submit', function (e) { e.preventDefault(); savePhone(pf.phone.value, pf.yes.checked); });
      phoneDrop.addEventListener('click', function () { savePhone('', false); });
      you.appendChild(phoneForm);
      put(you, 'account');
      // your school, your children's grades and your neighborhood
      var sch = part(el('section', 'panel'), 'school', 'School and kids');
      sch.appendChild(el('h2', null, 'Your school and kids'));
      put(sch, 'account');
      // the Sunday email (its tick box goes in further down, once the school is known)
      var mail = part(el('section', 'panel'), 'emails', 'Emails and notifications');
      mail.appendChild(el('h2', null, 'Emails and notifications'));
      mail.appendChild(el('p', null, 'Sign-up dates come by email for whatever you follow, below. The Sunday email and notifications on your phone are extra, and both are off until you turn them on.'));
      put(mail, 'account');
      // what's new on the site, for someone who has been before
      var NEWS = ainfo.news || [];
      if (NEWS.length) {
        var seenNews = get('pas-news') || '';
        var newsBox = part(el('section', 'panel g-news'), 'new', 'What’s new');
        newsBox.appendChild(el('h2', null, 'What’s new'));
        var nul = el('ul', 'g-list');
        NEWS.slice(0, 5).forEach(function (n) {
          var li = el('li', n.date > seenNews ? 'fresh' : '');
          var when = ''; try { when = new Date(n.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); } catch (e) { when = n.date; }
          var top = el('p', 'news-top'); top.appendChild(el('b', null, n.title)); top.appendChild(el('span', 'hint', ' ' + when)); li.appendChild(top);
          var body = el('p', null, n.text + ' ');
          if (n.href) { var na = el('a', null, n.link || 'Have a look'); na.href = page(n.href.split('#')[0]) + (n.href.indexOf('#') > -1 ? '#' + n.href.split('#')[1] : ''); body.appendChild(na); }
          li.appendChild(body); nul.appendChild(li);
        });
        newsBox.appendChild(nul);
        if (view === 'profile') {
          set('pas-news', NEWS[0].date);   // seen: the dot on "My profile" goes
          var dot = document.querySelector('.nav-cta .news-dot'); if (dot) dot.hidden = true;
        }
      }
      // what you follow (its dates come by email) and your favorites (kept here, nothing emailed)
      var MK = window.pasMarks;
      if (MK) {
        var fol = part(el('section', 'panel g-marks'), 'following', 'Following');
        fol.appendChild(el('h2', null, 'Places you follow'));
        fol.appendChild(el('p', null, 'When one of these posts a sign-up date or a deadline, you get an email the next morning, then reminders the day before and at about 8 that morning. Every email has a link to stop that one listing. Days off come in a Sunday round-up. Follow a program, a camp or a school from its own page.'));
        var folBox = el('div'); fol.appendChild(folBox);
        var mutedBox = el('div'); fol.appendChild(mutedBox);
        fol.appendChild(part(el('h3', null, 'Favorites'), 'favorites', 'Favorites'));
        fol.appendChild(el('p', 'hint', 'Saved so you can find them again. A favorite sends no email.'));
        var favBox = el('div'); fol.appendChild(favBox);
        var marksNote = el('p', 'g-status'); marksNote.setAttribute('aria-live', 'polite'); fol.appendChild(marksNote);
        var kindWord = { p: 'Program', c: 'Summer camp', s: 'School', w: 'Sunday email' };
        var drawMarks = function () {
          var named = MK.state.named || { follows: [], favs: [], muted: [] };
          var fill = function (box, items, empty, removeLabel, remove, addToWeek) {
            box.textContent = '';
            if (!items.length) { box.appendChild(el('p', 'hint', empty)); return; }
            var ul = el('ul', 'g-list');
            items.forEach(function (x) {
              var li = el('li'), a = el('a', null, x.n); a.href = markHref(x.k);
              var b0 = el('b'); b0.appendChild(a); li.appendChild(b0);
              li.appendChild(el('span', 'hint', kindWord[x.k.charAt(0)] || ''));
              if (addToWeek && x.k.charAt(0) === 'p') { var aw = el('a', 'g-add', 'Add to your week'); aw.href = page('board/') + '?add=' + encodeURIComponent(x.k.slice(2)); li.appendChild(aw); }
              var rm = btn('clear', removeLabel);
              rm.addEventListener('click', function () { rm.disabled = true; remove(x).then(function (r) { if (r && r.ok === false) { marksNote.textContent = r.message; rm.disabled = false; return; } marksNote.textContent = ''; drawMarks(); }); });
              li.appendChild(rm); ul.appendChild(li);
            });
            box.appendChild(ul);
          };
          fill(folBox, named.follows, 'You aren’t following anything yet.', 'Stop following', function (x) { return MK.follow(x.k, false).then(function (r) { paintWeek(); return r; }); });
          // listings stopped from an email: nothing about them is sent, even by way of a school that is followed
          mutedBox.textContent = '';
          if ((named.muted || []).length) {
            mutedBox.appendChild(el('h3', null, 'Stopped from an email'));
            mutedBox.appendChild(el('p', 'hint', 'You asked not to hear about these, so their dates are left out even when they serve a school you follow.'));
            var mb = el('div'); mutedBox.appendChild(mb);
            fill(mb, named.muted, '', 'Allow emails again', function (x) { return MK.unmute(x.k); });
          }
          fill(favBox, named.favs, 'No favorites yet. Tap “Save to favorites” on a program’s or camp’s page.', 'Remove', function (x) { return MK.fav(x.k, false); }, true);
        };
        MK.load().then(function () { drawMarks(); paintWeek(); paintCard(); });
        put(fol, 'account');
      }
      // the plans kept in the account get a panel of their own
      sch.appendChild(el('p', 'hint', 'Kept in your profile, so every list starts in the right place on any device you sign in on. Nothing goes in unless you put it there.'));
      var prof = part(el('section', 'panel'), 'plans', 'Kept plans');
      prof.appendChild(el('h2', null, 'Plans you’ve kept'));
      prof.appendChild(el('p', null, 'A week, a summer and a days-off plan can live in your profile, so they’re there when you sign in on another phone or computer.'));
      var schoolRow = el('form', 'g-row');
      var sl = el('label', null, 'Your school'); sl.htmlFor = 'prof-school';
      var ss = el('select'); ss.id = 'prof-school';
      var o0 = el('option', null, 'No school kept'); o0.value = ''; ss.appendChild(o0);
      (ainfo.schools || []).forEach(function (sc) { var o = el('option', null, sc.name); o.value = sc.id; ss.appendChild(o); });
      var sn = el('span', 'hint'); sn.setAttribute('aria-live', 'polite');
      schoolRow.appendChild(sl); schoolRow.appendChild(ss); schoolRow.appendChild(sn);
      sch.appendChild(schoolRow);
      var schoolName = function (id) { var f = (ainfo.schools || []).filter(function (x) { return x.id === id; })[0]; return f ? f.name : ''; };
      // "This week at your school": a Sunday email about the week ahead, off until it is ticked here
      var wkRow = el('label', 'g-check g-week'), wk = el('input'), wkText = el('span'), wkNote = el('p', 'hint');
      wk.type = 'checkbox'; wk.id = 'prof-week'; wkNote.setAttribute('aria-live', 'polite');
      wkRow.appendChild(wk); wkRow.appendChild(wkText);
      var weekKey = function () { return me.school ? 'w:' + me.school : ''; };
      var weekOn = function () { return !!MK && !!weekKey() && MK.state.follows.indexOf(weekKey()) > -1; };
      var paintWeek = function () {
        var name = schoolName(me.school || '');
        wkRow.hidden = !MK;
        wk.disabled = !name; wk.checked = weekOn();
        wkText.textContent = name ? 'Email me “This week at ' + name + '” on Sunday mornings: days off, the school’s own dates and sign-ups for the week ahead. It only comes in weeks with something out of the ordinary.' : 'Email me “This week at your school” on Sunday mornings. Keep your school above to turn this on.';
      };
      wk.addEventListener('change', function () {
        var k = weekKey(), want = wk.checked; if (!k || !MK) return;
        wk.disabled = true; wkNote.textContent = 'Saving…';
        MK.follow(k, want).then(function (r) {
          wk.disabled = false;
          wkNote.textContent = r && r.ok === false ? r.message : want ? 'On. The first one comes the next Sunday with something to say. Every one has a link to turn it off.' : 'Off.';
          paintWeek(); if (typeof drawMarks === 'function') drawMarks();
        });
      });
      var devNote = el('p', 'hint'); sch.appendChild(devNote);
      mail.appendChild(wkRow); mail.appendChild(wkNote);
      // ----- notifications on this phone or computer: the same dates as the emails, with no app to install -----
      var pushBox = el('div', 'g-push'); pushBox.id = 'push';
      pushBox.appendChild(el('h3', null, 'Notifications on this device'));
      pushBox.appendChild(el('p', 'hint', 'The same sign-up dates as the emails, as a notification on this phone or computer: the morning after a date is posted, the day before, and that morning. There’s no app to install, and it’s free.'));
      var pushBody = el('div', 'g-push-body'), pushNote = el('p', 'hint'); pushNote.setAttribute('aria-live', 'polite');
      pushBox.appendChild(pushBody); pushBox.appendChild(pushNote);
      mail.appendChild(pushBox);
      var swUrl = page('sw.js');
      var canPush = !!API && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      var isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
      var toBytes = function (b64u) { var t = String(b64u).replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var raw = window.atob(t), out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; };
      var thisSub = function () { return navigator.serviceWorker.getRegistration(swUrl).then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; }); };
      var pushSay = function (t) { pushNote.textContent = t || ''; };
      var took = function (r) { if (r && r.push) me.push = r.push; };
      var drawPush = function () {
        pushBody.textContent = '';
        var P = me.push || { devices: 0, only: false };
        var row = function () { var d = el('div', 'actions'); pushBody.appendChild(d); return d; };
        // "instead of the emails", once any device has them
        var modeRow = function () {
          if (!P.devices) return;
          var lab = el('label', 'g-check g-push-only'), box = el('input'); box.type = 'checkbox'; box.id = 'push-only'; box.checked = !!P.only;
          lab.appendChild(box); lab.appendChild(el('span', null, 'Send me notifications instead of the date emails.'));
          pushBody.appendChild(lab);
          pushBody.appendChild(el('p', 'hint', 'With this ticked, sign-up dates and days off come as notifications only. If notifications stop reaching your devices, the emails start again by themselves.'));
          box.addEventListener('change', function () {
            box.disabled = true; pushSay('Saving…');
            call('push_mode', { only: box.checked }).then(function (r) { box.disabled = false; if (!r.ok) { box.checked = !box.checked; pushSay(r.message); return; } took(r); pushSay(r.push.only ? 'Done. Date emails stop from tomorrow morning; notifications carry them.' : 'Done. You’ll get the emails as well.'); });
          });
        };
        var others = function (here) {
          var n = P.devices - (here ? 1 : 0);
          if (n < 1) return;
          var p = el('p', 'hint', (here ? 'Also on ' : 'On ') + n + (here ? ' other' : '') + (n === 1 ? ' device' : ' devices') + ' signed in to this account. ');
          var all = btn('clear', 'Turn them off everywhere');
          twoTap(all, 'Tap again to turn them all off', function () {
            (canPush ? thisSub().then(function (sub) { return sub ? sub.unsubscribe() : null; }).then(null, function () { return null; }) : Promise.resolve()).then(function () { return call('push_off', { all: true }); }).then(function (r) { took(r); pushSay(r.ok ? 'Notifications are off on every device.' : r.message); drawPush(); });
          });
          p.appendChild(all); pushBody.appendChild(p);
        };
        if (!canPush) {
          if (isIos && !standalone) {
            pushBody.appendChild(el('p', null, 'On an iPhone or iPad, notifications work once Philly After School is on your Home Screen:'));
            var ol = el('ol', 'g-push-steps');
            ['In Safari, tap the Share button (the square with an arrow).', 'Choose “Add to Home Screen”, then “Add”.', 'Open Philly After School from your Home Screen and log in there.', 'Come back to Account, and turn notifications on here.'].forEach(function (t) { ol.appendChild(el('li', null, t)); });
            pushBody.appendChild(ol);
          } else pushBody.appendChild(el('p', 'hint', API ? 'This browser can’t show notifications from a website. The emails still work, or try this page in Chrome, Edge, Firefox or Safari.' : 'Notifications don’t work in this preview copy of the site.'));
          others(false); modeRow(); return;
        }
        if (window.Notification.permission === 'denied') {
          pushBody.appendChild(el('p', 'g-status bad', 'Notifications from this site are blocked in this browser’s settings. Allow them there, then come back to this page.'));
          others(false); modeRow(); return;
        }
        thisSub().then(null, function () { return null; }).then(function (sub) {
          pushBody.textContent = '';
          var acts = row();
          if (sub) {
            pushBody.insertBefore(el('p', 'g-status good g-push-on', 'On for this device.'), acts);
            var test = btn('btn', 'Send me a test'), off = btn('btn', 'Turn off on this device');
            test.addEventListener('click', function () { test.disabled = true; pushSay('Sending…'); call('push_test', {}).then(function (r) { test.disabled = false; took(r); pushSay(r.ok ? 'Sent. It should arrive in a few seconds.' : r.message); }); });
            off.addEventListener('click', function () {
              off.disabled = true; var ep = sub.endpoint;
              sub.unsubscribe().then(null, function () { return false; }).then(function () { return call('push_off', { endpoint: ep }); }).then(function (r) { took(r); pushSay(r.ok ? 'Off for this device.' : r.message); drawPush(); });
            });
            acts.appendChild(test); acts.appendChild(off);
            // this device has them but the account doesn't know (a new sign-in on the same browser): tell it
            if (!P.devices) { var j0 = sub.toJSON(); call('push_on', { endpoint: sub.endpoint, p256dh: j0.keys.p256dh, auth: j0.keys.auth }).then(function (r) { if (r.ok) { took(r); drawPush(); } }); }
          } else {
            var on = btn('btn primary', 'Turn on notifications on this device');
            on.addEventListener('click', function () {
              on.disabled = true; pushSay('Your browser will ask if that’s OK.');
              var fail = function (why) { on.disabled = false; pushSay(why || 'That didn’t work on this device. The emails still do.'); };
              var answered = false;
              var asked = function (perm) {
                if (answered) return; answered = true;   // some browsers both call back and return a promise
                if (perm !== 'granted') { fail(perm === 'denied' ? 'Notifications are blocked for this site. You can allow them in your browser’s settings.' : 'No problem. Nothing was turned on.'); if (perm === 'denied') drawPush(); return; }
                pushSay('Turning them on…');
                call('push_key').then(function (k) {
                  if (!k.ok) { fail(k.message); return; }
                  var key = toBytes(k.key);
                  var subscribe = function (reg) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); };
                  return navigator.serviceWorker.register(swUrl).then(function () { return navigator.serviceWorker.ready; }).then(function (reg) {
                    // an address made for another site's key (an old copy of this one): let it go and ask again
                    return subscribe(reg).then(null, function () { return reg.pushManager.getSubscription().then(function (old) { return old ? old.unsubscribe() : null; }).then(function () { return subscribe(reg); }); });
                  }).then(function (sub2) {
                    var j = sub2.toJSON();
                    return call('push_on', { endpoint: sub2.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }).then(function (r) {
                      if (!r.ok) { sub2.unsubscribe().then(null, function () { return null; }); fail(r.message); return; }
                      took(r); pushSay('On. Tap “Send me a test” to see one arrive.'); drawPush();
                    });
                  });
                }).then(null, function () { fail(); });
              };
              try { var p0 = window.Notification.requestPermission(asked); if (p0 && p0.then) p0.then(asked, function () { fail(); }); } catch (e) { fail(); }
            });
            acts.appendChild(on);
          }
          others(!!sub); modeRow();
        });
      };
      drawPush();
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
        var hadWeek = weekOn(), oldKey = weekKey();
        call('school_save', { school: ss.value }).then(function (r) {
          sn.textContent = r.ok ? (r.school ? 'Kept.' : 'Taken out of your profile. This device still remembers it until you change it on the school’s page.') : r.message;
          if (r.ok) {
            me.school = r.school; noteRole(me); adoptSchool(r.school, schoolName(r.school)); paintSchool(r.school);
            // the Sunday email follows the school: off for the old one, on for the new
            if (hadWeek && oldKey !== weekKey()) MK.follow(oldKey, false).then(function () { return weekKey() ? MK.follow(weekKey(), true) : null; }).then(function () { paintWeek(); if (typeof drawMarks === 'function') drawMarks(); wkNote.textContent = weekKey() ? 'The Sunday email moved to ' + schoolName(me.school) + '.' : 'The Sunday email is off, because no school is kept.'; });
            else paintWeek();
          }
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
      if ((ainfo.grades || []).length) sch.appendChild(gradeRow);
      if ((ainfo.hoods || []).length) {
        var hoodRow = el('form', 'g-row');
        var hl = el('label', null, 'Your neighborhood'); hl.htmlFor = 'prof-hood';
        var hs = el('select'); hs.id = 'prof-hood';
        var h0 = el('option', null, 'None kept'); h0.value = ''; hs.appendChild(h0);
        ainfo.hoods.forEach(function (x) { var o = el('option', null, x.name); o.value = x.id; hs.appendChild(o); });
        hs.value = me.hood || '';
        var hn = el('span', 'hint'); hn.setAttribute('aria-live', 'polite');
        hs.addEventListener('change', function () { hn.textContent = 'Saving…'; call('hood_save', { hood: hs.value }).then(function (r) { hn.textContent = r.ok ? (r.hood ? 'Kept.' : 'Taken out of your profile.') : r.message; if (r.ok) { me.hood = r.hood; noteRole(me); } }); });
        hoodRow.addEventListener('submit', function (e) { e.preventDefault(); });
        hoodRow.appendChild(hl); hoodRow.appendChild(hs); hoodRow.appendChild(hn);
        sch.appendChild(hoodRow);
      }
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
      // the summer schedule, when one is kept: who is on it and how many weeks each has
      prof.appendChild(el('h3', null, 'Summer'));
      var summerBox = el('div'); prof.appendChild(summerBox);
      var paintSummer = function (sm) {
        summerBox.textContent = '';
        var open = el('a', null, 'the summer schedule'); open.href = page('summer-schedule/') + '#plan';
        if (!sm) { var none = el('p', 'hint', 'No summer kept yet. To keep one here, open '); none.appendChild(open); none.appendChild(document.createTextNode(' and look for “Keep it in your profile”.')); summerBox.appendChild(none); return; }
        var ul = el('ul', 'g-list'), li = el('li');
        li.appendChild(el('b', null, 'Summer ' + sm.y));
        li.appendChild(el('span', 'hint', summerLine(sm) + ' · last changed ' + shortDate(sm.updated)));
        var rm = btn('clear', 'Remove from my profile');
        twoTap(rm, 'Tap again to remove it', function () { call('summer_delete', {}).then(function () { unkeepSummer(); loadProfile(); }); });
        li.appendChild(rm); ul.appendChild(li); summerBox.appendChild(ul);
        var more = el('p', 'hint', 'To change it, or put it on this device, open '); more.appendChild(open); more.appendChild(document.createTextNode('.')); summerBox.appendChild(more);
      };
      // the days-off plan, when one is kept
      if (hasYearPage) { var yr = el('p', 'year-link'); var ya = el('a', 'btn', 'My kids’ calendar'); ya.href = page('calendar/'); yr.appendChild(ya); yr.appendChild(el('span', 'hint', ' Everything you’ve planned for the year, in one place.')); prof.appendChild(yr); }
      prof.appendChild(el('h3', null, 'Days off'));
      var offBox2 = el('div'); prof.appendChild(offBox2);
      var paintDaysOff = function (dp) {
        offBox2.textContent = '';
        var open = el('a', null, 'the days-off page'); open.href = page('days-off/') + '#plan';
        if (!dp) { var none = el('p', 'hint', 'No days-off plan kept yet. To keep one here, open '); none.appendChild(open); none.appendChild(document.createTextNode(' and look for “Keep it in your profile”.')); offBox2.appendChild(none); return; }
        var ul = el('ul', 'g-list'), li = el('li');
        li.appendChild(el('b', null, 'School year ' + dp.y + '–' + String(dp.y + 1).slice(2)));
        li.appendChild(el('span', 'hint', daysOffLine(dp) + ' · last changed ' + shortDate(dp.updated)));
        var rm = btn('clear', 'Remove from my profile');
        twoTap(rm, 'Tap again to remove it', function () { call('daysoff_delete', {}).then(function () { unkeepPlan('offProf'); loadProfile(); }); });
        li.appendChild(rm); ul.appendChild(li); offBox2.appendChild(ul);
        var more = el('p', 'hint', 'To change it, or put it on this device, open '); more.appendChild(open); more.appendChild(document.createTextNode('.')); offBox2.appendChild(more);
      };
      // ----- the profile page: one card with everything on it, and nothing to fill in -----
      var card = el('section', 'panel prof-card'); card.id = 'card';
      var rvCard = el('section', 'panel rv-nudge'); rvCard.id = 'rv-nudge'; rvCard.hidden = true; rvCard.setAttribute('aria-live', 'polite');   // "has your family been to ...?", when it is time to ask
      var lastP = null, rvAsked = false;
      var gradeName = function (g) { return g === 'PK' ? 'Pre-K' : g === 'K' ? 'K' : g + (g === '1' ? 'st' : g === '2' ? 'nd' : g === '3' ? 'rd' : 'th'); };
      var listWords = function (a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
      var kidNames = function (p) {   // first names, from the plans kept in the account and the ones on this device
        var out = [];
        var add = function (n) { n = firstWord(n); if (n && !out.some(function (x) { return x.toLowerCase() === n.toLowerCase(); })) out.push(n); };
        (p.weeks || []).forEach(function (w) { add(w.name); });
        ((p.summer && p.summer.kids) || []).forEach(function (k) { add(k.name); });
        ((p.daysoff && p.daysoff.kids) || []).forEach(function (k) { add(k.name); });
        var r = readRosters(); if (r) r.kids.forEach(function (k) { add(k.name); });
        return out;
      };
      var paintCard = function () {
        if (view !== 'profile') return;
        var p = lastP || { grades: me.grades || [], weeks: [] }, named = (MK && MK.state.named) || { follows: [], favs: [], muted: [] };
        card.textContent = '';
        var head = el('div', 'pc-head'), mark = el('span', 'pc-mark', ((me.first || '').charAt(0) + (me.last || '').charAt(0)).toUpperCase() || '?'); mark.setAttribute('aria-hidden', 'true');
        var hw = el('div', 'pc-who'); hw.appendChild(el('h2', null, [me.first, me.last].filter(Boolean).join(' ') || 'Your profile'));
        hw.appendChild(el('p', 'pc-mail', me.email));
        hw.appendChild(el('span', 'pill', me.role === 'manager' ? 'Program manager' : 'Parent or caregiver'));
        var edit = el('a', 'btn primary pc-edit', 'Edit my account'); edit.href = page('account/');
        head.appendChild(mark); head.appendChild(hw); head.appendChild(edit); card.appendChild(head);
        var rows = el('dl', 'pc-rows'); card.appendChild(rows);
        var row = function (label, fill, go, href) {
          var r = el('div', 'pc-row'), dd = el('dd');
          fill(dd); r.appendChild(el('dt', null, label)); r.appendChild(dd);
          if (go) { var a = el('a', 'pc-go', go); a.href = href; a.setAttribute('aria-label', go + ': ' + label.toLowerCase()); r.appendChild(a); }
          rows.appendChild(r);
        };
        var say = function (text, quiet) { return function (dd) { dd.appendChild(el('span', quiet ? 'hint' : null, text)); }; };
        var chips = function (items, empty) {
          return function (dd) {
            if (!items.length) { dd.appendChild(el('span', 'hint', empty)); return; }
            dd.appendChild(el('b', 'pc-n', String(items.length)));
            var box = el('span', 'pc-chips');
            items.slice(0, 12).forEach(function (x) { var a = el('a', 'pc-chip', x.n); a.href = markHref(x.k); box.appendChild(a); });
            if (items.length > 12) box.appendChild(el('span', 'hint', 'and ' + (items.length - 12) + ' more'));
            dd.appendChild(box);
          };
        };
        // kids: how many, and their first names
        var kids = kidNames(p), grades = p.grades || [];
        row('Kids', kids.length ? function (dd) { dd.appendChild(el('b', 'pc-n', String(kids.length))); dd.appendChild(el('span', null, listWords(kids))); } : say('No names yet. A child’s first name comes from the plans you make.', true), kids.length ? '' : 'Make a plan', page('schedules/'));
        row('Grades', grades.length ? say(listWords(grades.map(gradeName))) : say('None kept', true), grades.length ? 'Change' : 'Add', page('account/') + '#school');
        var sName = schoolName(me.school || '');
        row('School', sName ? function (dd) { var a = el('a', null, sName); a.href = page(me.school + '/'); dd.appendChild(a); } : say('None kept', true), sName ? 'Change' : 'Add', page('account/') + '#school');
        var hName = ((ainfo.hoods || []).filter(function (x) { return x.id === me.hood; })[0] || {}).name || '';
        if ((ainfo.hoods || []).length) row('Neighborhood', hName ? say(hName) : say('None kept', true), hName ? 'Change' : 'Add', page('account/') + '#school');
        // what they follow (the Sunday email is counted with the emails, below) and their favorites
        var follows = named.follows.filter(function (x) { return x.k.charAt(0) !== 'w'; });
        row('Following', chips(follows, 'Nothing yet. Follow a program, a camp or a school from its page to get its sign-up dates by email.'), follows.length ? 'Change' : '', page('account/') + '#following');
        row('Favorites', chips(named.favs, 'None yet. Tap “Save to favorites” on a program’s or camp’s page.'), named.favs.length ? 'Change' : '', page('account/') + '#favorites');
        // schedules made, kept in the account
        var made = [];
        (p.weeks || []).forEach(function (w) { var n = weekCount({ days: w.now }) + weekCount({ days: w.next }); made.push([(w.name ? w.name + '’s week' : 'A week'), n + (n === 1 ? ' program' : ' programs'), page('board/') + '?back=1']); });
        if (p.summer) made.push(['Summer ' + p.summer.y, summerLine(p.summer), page('summer-schedule/') + '#plan']);
        if (p.daysoff) made.push(['Days off, ' + p.daysoff.y + '–' + String(p.daysoff.y + 1).slice(2), daysOffLine(p.daysoff), page('days-off/') + '#plan']);
        row('Schedules', made.length ? function (dd) {
          var ul = el('ul', 'pc-list');
          made.forEach(function (m) { var li = el('li'), a = el('a', null, m[0]); a.href = m[2]; li.appendChild(a); li.appendChild(el('span', 'hint', m[1])); ul.appendChild(li); });
          dd.appendChild(ul);
        } : say('None kept yet. Build a week, a summer or a days-off plan, then keep it in your account.', true), made.length ? 'Manage' : 'Make one', made.length ? page('account/') + '#plans' : page('schedules/'));
        // calendars: the year in one place, and the dates they added on this device
        if (hasYearPage) {
          var ownN = 0; try { ownN = ((readRosters() || {}).own || []).length; } catch (e) { ownN = 0; }
          row('Calendars', function (dd) {
            var a = el('a', null, 'My kids’ calendar'); a.href = page('calendar/'); dd.appendChild(a);
            dd.appendChild(el('span', 'hint', ownN ? ownN + (ownN === 1 ? ' date' : ' dates') + ' of your own on this device' : 'No dates of your own on this device yet'));
          }, 'Open', page('calendar/'));
        }
        // emails and texts
        var bits = [follows.length ? 'Sign-up dates for the ' + (follows.length === 1 ? 'one thing' : follows.length + ' things') + ' you follow' : 'No date emails yet'];
        bits.push(weekOn() ? 'Sunday email on, for ' + sName : 'Sunday email off');
        if (me.push && me.push.devices) bits.push('Notifications on ' + (me.push.devices === 1 ? 'one device' : me.push.devices + ' devices') + (me.push.only ? ', instead of the date emails' : ''));
        bits.push(me.phone ? 'Texts to the number ending ' + String(me.phone).replace(/\D/g, '').slice(-4) : 'No number for texts');
        row('Emails and texts', function (dd) { var ul = el('ul', 'pc-list'); bits.forEach(function (b) { ul.appendChild(el('li', null, b)); }); dd.appendChild(ul); }, 'Change', page('account/') + '#emails');
        if (groups.length) {
          var solo = groups.filter(function (g) { return g.solo; }).length, grp = groups.length - solo, sb = [];
          if (solo) sb.push(solo === 1 ? 'One week shared' : solo + ' weeks shared');
          if (grp) sb.push(grp === 1 ? 'one group' : grp + ' groups');
          row('Sharing', say(sb.join(', ').replace(/^o/, 'O')), 'Open', page('account/') + '#sharing');
        }
        if (me.claims) row('Listings', say(me.claims === 1 ? 'One listing claimed' : me.claims + ' listings claimed'), 'Manage', page('managers/'));
        // reviews: the programs on their weeks (here or kept in the account) that they could tell other parents about
        var RVW = window.pasReview, progNames = ainfo.programs || {};
        if (RVW) {
          var onWeeks = [];
          (p.weeks || []).forEach(function (w) {
            ['now', 'next'].forEach(function (b) {
              var bd = w[b] || {};
              Object.keys(bd).forEach(function (d) { (Array.isArray(bd[d]) ? bd[d] : []).forEach(function (e) { var k = String(e).split('~')[0].split('.'); onWeeks.push({ id: k[0], school: k[1] || '', now: b === 'now' }); }); });
            });
          });
          var could = RVW.list(onWeeks).filter(function (i) { return !i.done && !i.never && progNames[i.id]; });
          if (could.length) row('Reviews', function (dd) {
            dd.appendChild(el('span', 'hint pc-wide', 'Has your family been to ' + (could.length === 1 ? 'this one' : 'any of these') + '? A short review helps the next family choose.'));
            var box = el('span', 'pc-chips');
            could.slice(0, 8).forEach(function (i) { var a = el('a', 'pc-chip', progNames[i.id]); a.href = RVW.href(page('review/'), i); box.appendChild(a); });
            dd.appendChild(box);
          });
          if (lastP && !rvAsked) { rvAsked = true; RVW.mount(rvCard, progNames, 'profile', page('review/'), onWeeks); }
        }
        card.appendChild(el('p', 'hint pc-foot', 'What your account holds, with the names and dates saved on this device. Nobody else sees this page.'));
      };
      var loadProfile = function () {
        call('profile').then(function (p) {
          if (!p.ok) return;
          adoptSchool(p.school, schoolName(p.school)); adoptGrades(p.grades);
          paintSchool(p.school); paintGrades(p.grades || []); paintWeeks(p.weeks || []); paintSummer(p.summer || null); paintDaysOff(p.daysoff || null);
          lastP = p; paintCard();
        });
      };
      paintSchool(me.school || ''); paintGrades(me.grades || []); paintWeek(); loadProfile();
      put(prof, 'account');
      // the profile page: the card, then what's new on the site
      paintCard(); put(card, 'profile'); put(rvCard, 'profile');
      if (NEWS.length) put(newsBox, 'profile');
      // sharing: weeks shared with one person, and groups
      var mine = part(el('section', 'panel'), 'sharing', 'Sharing');
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
      put(mine, 'account');
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
      put(join, 'account');
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
      put(make, 'account');
      // the site's one ask
      var help = el('section', 'panel g-support');
      var dir = part(el('section', 'panel'), 'listings', me.claims ? 'Your listings' : 'For programs');
      dir.appendChild(el('h2', null, me.claims ? 'Your listings' : 'Run a program or camp?'));
      dir.appendChild(el('p', null, me.claims ? 'This account has claimed ' + (me.claims === 1 ? 'a listing' : me.claims + ' listings') + '. Send changes or give one up from the program managers page.' : 'This same account can claim your program’s listing, if your email address is at its website. Then you can send changes as its manager.'));
      var dl = el('a', 'btn', me.claims ? 'Manage your listings' : 'Claim your listing'); dl.href = page('managers/'); dir.appendChild(dl);
      put(dir, 'account');
      help.appendChild(el('h2', null, 'Help the site keep going'));
      help.appendChild(el('p', null, 'Philly After School is free and run by one parent. If it saved you an evening of searching, you can chip in toward what it costs to run.'));
      var ha = el('a', 'btn', 'Buy me a coffee'); ha.href = page('support/'); help.appendChild(ha);
      put(help, 'account');
      // leaving
      var out = part(el('section', 'panel'), 'sign-out', 'Sign out');
      out.appendChild(el('h2', null, 'Signing out'));
      var acts = el('div', 'actions');
      var so = btn('btn', 'Sign out'), sa = btn('btn', 'Sign out on every device'), del = btn('clear', 'Delete my account');
      acts.appendChild(so); acts.appendChild(sa); acts.appendChild(del);
      out.appendChild(acts);
      out.appendChild(el('p', 'hint', 'Deleting your account removes your email, the school, grades and weeks kept in your profile, what you follow and your favorites, every week you shared, and every group you made (for everyone in it). Rosters saved on this device stay.'));
      so.addEventListener('click', function () { call('logout', {}).then(function () { set('pas-in', null); drawSignedOut(); }); });
      sa.addEventListener('click', function () { call('logout_all', {}).then(function () { set('pas-in', null); drawSignedOut(); }); });
      twoTap(del, 'Tap again to delete everything', function () { (window.pasMarks ? window.pasMarks.clear().then(null, function () { /* the unsubscribe link still works */ }) : Promise.resolve()).then(function () { return call('delete_account', {}); }).then(function (r) { if (r.ok) { set('pas-in', null); set('pas-role', null); set('pas-kl-role', null); unlinkAll(); drawSignedOut('Your account and everything you shared are deleted.'); } }); });
      put(out, 'account');
      if (window.pasJump) window.pasJump();
      // arriving on a link to one part of the page: the page was empty when the browser looked for it, so go there now
      var want = hashPart ? document.getElementById(hashPart) : null;
      if (want && want.scrollIntoView) want.scrollIntoView();
    };
    // Arriving from the email: the token is after the #, so it never reaches a server log. Use it once and take it out of the address.
    var tok = /(?:^#|&)t=([A-Za-z0-9_-]{20,80})/.exec(location.hash);
    if (tok) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
      account.appendChild(el('p', 'g-status', 'Signing you in…'));
      call('login_finish', { token: tok[1] }).then(function (d) {
        if (!d.ok) { drawSignedOut(d.message); return; }
        set('pas-in', '1'); fresh = true;
        if (!goNext(d.next)) drawProfile(d);
      });
    } else {
      call('me').then(function (d) {
        if (d.ok && d.user) { set('pas-in', '1'); drawProfile(d); } else { if (d.ok) set('pas-in', null); drawSignedOut(API ? (d.ok ? '' : d.message) : d.message); }
      });
    }
  }

  // ----- the directors page: find a listing, claim it with an email address at its website, then keep it up to date -----
  var claimsBox = document.getElementById('claims');
  if (claimsBox) {
    var LIST = [];
    try { LIST = JSON.parse(document.getElementById('claims-data').textContent) || []; } catch (e) { LIST = []; }
    var byKey = {};
    LIST.forEach(function (l) { byKey[l[0]] = { key: l[0], name: l[1], domain: l[2], match: l[3] === 1 }; });
    var cq = query();
    var wanted = byKey[cq.l] ? cq.l : (byKey[sget('pas-claim')] ? sget('pas-claim') : '');   // the listing someone has said they want
    if (byKey[cq.l]) sset('pas-claim', cq.l);   // kept through signing in
    var findText = (cq.q || '').replace(/\+/g, ' ').slice(0, 80);
    var cMe = null, cDomain = '', cClaims = [], cMail = true, cState = 'checking';   // checking | out | name | in
    var said = '', saidBad = false;
    var PERSONAL = /^(gmail|googlemail|yahoo|hotmail|outlook|live|msn|aol|icloud|me|comcast|verizon|proton|protonmail)\.(com|net|me)$/;
    var when = function (t) { try { return new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) { return ''; } };
    var STATUS = { ok: 'Claimed', pending: 'Waiting for our yes', declined: 'Not approved' };
    var EDIT = { 'new': 'Waiting to be read', done: 'Published', declined: 'Not made' };
    var pushStep = function (step) { (window.dataLayer = window.dataLayer || []).push({ event: 'pas_claim', step: step }); };
    var field = function (form, id, label, tag, attrs) {
      var l = el('label', null, label); l.htmlFor = id;
      var i = el(tag || 'input'); i.id = id;
      Object.keys(attrs || {}).forEach(function (k) { i[k] = attrs[k]; });
      form.appendChild(l); form.appendChild(i);
      return i;
    };

    // Shrinks a chosen picture in the browser and hands back a JPEG, so the original file (and whatever is tucked
    // inside it, such as where it was taken) never leaves the device.
    var shrink = function (file, done, logo) {
      var url = (window.URL || window.webkitURL).createObjectURL(file), img = new Image();
      img.onload = function () {
        var tryAt = function (side, quality) {
          var k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
          var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
          var cx = c.getContext('2d'); cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, c.width, c.height);   // white behind a see-through logo
          cx.drawImage(img, 0, 0, c.width, c.height);
          return { data: c.toDataURL('image/jpeg', quality), w: c.width, h: c.height };
        };
        var out = tryAt(logo ? 800 : 1600, logo ? 0.92 : 0.86);
        if (out.data.length > 1900000) out = tryAt(1280, 0.8);
        (window.URL || window.webkitURL).revokeObjectURL(url);
        if (logo && (out.w < 160 || out.h < 160)) { done(null, 'That logo is too small. Use one at least 160 pixels across.'); return; }
        if (!logo && (out.w < 400 || out.h < 300)) { done(null, 'That photo is too small. Use one at least 400 pixels wide.'); return; }
        if (out.data.length > 2100000) { done(null, 'That photo is too big to send. Try a different one.'); return; }
        done(out);
      };
      img.onerror = function () { (window.URL || window.webkitURL).revokeObjectURL(url); done(null, 'That file couldn’t be read as a photo. Try a JPEG or PNG.'); };
      img.src = url;
    };

    var reload = function () {
      return call('claims').then(function (d) {
        if (!d.ok) { if (d.http === 401) { cMe = null; cState = 'out'; said = 'Please sign in again.'; saidBad = true; } else { said = d.message; saidBad = true; } return; }
        cDomain = d.domain; cClaims = d.claims || []; cMail = d.mail !== false;
        tellRole();
      });
    };
    // The names of the listings this account holds, for the email list: "manager of X" is what makes a useful note there.
    var claimNames = function () { return cClaims.filter(function (c) { return c.status === 'ok' && !c.gone; }).map(function (c) { return c.name; }).slice(0, 20); };
    window.pasClaimNames = claimNames;
    var tellRole = function () {
      if (!cMe) return;
      if (cClaims.some(function (c) { return c.status !== 'declined'; })) cMe.role = 'manager';
      noteRole(cMe, claimNames());
    };
    var signedIn = function (user) {
      cMe = user; cState = user.ready ? 'in' : 'name';
      listOnce(cMe);   // making an account adds it to the email list, whichever page it was made on
      if (cState === 'in') return reload().then(render);
      render();
    };

    // one listing the account holds: its status, a change to send, a photo
    var claimItem = function (c) {
      var item = el('div', 'claim');
      item.appendChild(el('h3', null, c.name));
      item.appendChild(el('p', 'claim-status ' + c.status, STATUS[c.status] || c.status));
      if (c.status === 'pending') item.appendChild(el('p', 'hint', 'This listing’s website is one many people share, so a person checks the claim. You’ll get an email either way.'));
      if (c.status === 'declined') item.appendChild(el('p', 'hint', 'We couldn’t confirm this one. Reply to the email we sent if that looks wrong.'));
      if (c.gone) item.appendChild(el('p', 'hint', 'This listing has been taken off the site.'));
      if (c.status === 'ok' && !c.gone) {
        var view = el('a', 'btn', 'See the listing');
        view.href = c.listing.charAt(0) === 'p' ? page('programs/' + c.listing.slice(2) + '/') : page('summer-camps/' + c.listing.slice(2) + '/');
        // your listing this month: how often it was opened, followed, planned and asked about. Numbers, never people.
        if (c.stats) {
          var st = c.stats, stBox = el('div', 'claim-stats'), day0 = function (iso) { var d = new Date(iso + 'T12:00:00Z'); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
          var young = !st.since || st.since > st.from;   // counting began inside the last 30 days
          stBox.appendChild(el('h4', null, young ? 'Your listing so far' : 'Your listing, last 30 days'));
          var tiles = el('div', 'claim-nums');
          [['view', 'time your listing was opened', 'times your listing was opened'], ['signup', 'click to sign up', 'clicks to sign up'], ['site', 'click to your website', 'clicks to your website'], ['plan', 'time it was put on a family’s plan', 'times it was put on a family’s plan'], ['email', 'person asked for its emails', 'people asked for its emails']].forEach(function (t) {
            var tile = el('div', 'claim-num');
            tile.appendChild(el('b', null, String(st.now[t[0]] || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')));
            tile.appendChild(el('span', null, st.now[t[0]] === 1 ? t[1] : t[2]));
            if (st.full) tile.appendChild(el('small', null, (st.prev[t[0]] || 0) + ' in the 30 days before'));
            tiles.appendChild(tile);
          });
          stBox.appendChild(tiles);
          var max = Math.max.apply(null, st.views.concat(1)), ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
          svg.setAttribute('viewBox', '0 0 300 44'); svg.setAttribute('class', 'claim-spark'); svg.setAttribute('role', 'img'); svg.setAttribute('preserveAspectRatio', 'none');
          svg.setAttribute('aria-label', 'Times the listing was opened, day by day for 30 days. Busiest day: ' + max + '.');
          st.views.forEach(function (v, i) { var r = document.createElementNS(ns, 'rect'), h = v ? Math.max(3, Math.round(v / max * 40)) : 1; r.setAttribute('x', String(i * 10 + 1)); r.setAttribute('y', String(44 - h)); r.setAttribute('width', '8'); r.setAttribute('height', String(h)); r.setAttribute('rx', '2'); if (!v) r.setAttribute('class', 'nil'); svg.appendChild(r); });
          stBox.appendChild(svg);
          stBox.appendChild(el('p', 'hint', 'Opened, day by day, ' + day0(st.from) + ' to today.' + (st.since ? ' Counting began ' + day0(st.since) + '.' : ' Counting has just begun.') + ' These are numbers only: nothing about who visited. Your own visits while you’re signed in aren’t counted.'));
          item.appendChild(stBox);
        }
        // is there space: one of three words, on the listing straight away, and off again after a month
        var spBox = el('div', 'claim-space');
        spBox.appendChild(el('h4', null, 'Is there space right now?'));
        var spNow = c.space ? c.space.s : '';
        var spRow = el('div', 'actions'), spSay = el('p', 'hint');
        spSay.textContent = c.space ? 'Showing on your listing since ' + shortDate(c.space.t) + '. It comes down after 30 days unless you set it again.' : 'Parents see this on your listing straight away. It comes down after 30 days unless you set it again, so it never goes stale.';
        [['open', 'Spots open'], ['waitlist', 'Waitlist'], ['full', 'Full'], ['', 'Don’t show']].forEach(function (o) {
          var b = btn('kid', o[1]); b.setAttribute('aria-pressed', String(spNow === o[0]));
          b.addEventListener('click', function () {
            call('space_set', { listing: c.listing, state: o[0] }).then(function (r) {
              if (!r.ok) { spSay.textContent = r.message || 'That didn’t save. Try again.'; return; }
              pushStep('space_' + (o[0] || 'cleared')); cClaims = r.claims || cClaims; said = ''; render();
            });
          });
          spRow.appendChild(b);
        });
        spBox.appendChild(spRow); spBox.appendChild(spSay);
        item.appendChild(spBox);
        // asking their own families for a review: a link that opens the form with the program already chosen
        if (c.listing.charAt(0) === 'p') {
          var askBox = el('div', 'claim-ask');
          askBox.appendChild(el('h4', null, 'Ask your families for a review'));
          askBox.appendChild(el('p', 'hint', 'Reviews are what parents read first. This link opens the review form with ' + c.name + ' already chosen. Send it to every family, not only the ones you expect to be happy. Each review is read before it’s posted, and a program can’t review itself.'));
          var askUrl = ''; try { askUrl = new URL(page('review/') + '?program=' + encodeURIComponent(c.listing.slice(2)), location.href).href; } catch (e) { askUrl = ''; }
          var askIn = el('input'); askIn.type = 'text'; askIn.readOnly = true; askIn.value = askUrl; askIn.setAttribute('aria-label', 'Review link for ' + c.name); askIn.addEventListener('focus', function () { askIn.select(); });
          var askMsg = 'We’re listed on Philly After School, a free site Philadelphia parents use to find after-school programs. If your child comes to ' + c.name + ', a short review helps other families find us. It takes about two minutes: ' + askUrl;
          var askSay = el('span', 'hint'); askSay.setAttribute('aria-live', 'polite');
          var copyIt = function (text, done) {
            var ok = function () { askSay.textContent = done; }, no = function () { askIn.focus(); askIn.select(); askSay.textContent = 'Couldn’t copy here. The link is selected: copy it from the box.'; };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, no); else no();
          };
          var askActs = el('div', 'actions'), askLink = btn('btn', 'Copy the link'), askText = btn('btn', 'Copy a message to send');
          askLink.addEventListener('click', function () { copyIt(askUrl, 'Link copied.'); });
          askText.addEventListener('click', function () { copyIt(askMsg, 'Message copied. Paste it into an email or a text to your families.'); });
          askActs.appendChild(askLink); askActs.appendChild(askText); askActs.appendChild(askSay);
          askBox.appendChild(askIn); askBox.appendChild(askActs);
          if (askUrl) item.appendChild(askBox);
          // a badge for their own website: it links to the listing, so families on their site find its dates and reviews here
          var bPage = '', bSrc = '';
          try { bPage = new URL(view.href, location.href).href.split('#')[0].split('?')[0]; bSrc = new URL(page('badge.svg'), location.href).href; } catch (e) { bPage = ''; }
          if (bPage && bSrc) {
            var bBox = el('div', 'claim-ask claim-badge');
            bBox.appendChild(el('h4', null, 'Put a badge on your website'));
            bBox.appendChild(el('p', 'hint', 'It links to your listing here, so families already on your site can find your dates, your reviews and whether you have space. It’s free with every claimed listing.'));
            var bRow = el('div', 'pm-badge'), bImg = el('img'); bImg.src = bSrc; bImg.alt = 'Find us on Philly After School'; bImg.width = 240; bImg.height = 72; bRow.appendChild(bImg);
            var snippet = '<a href="' + bPage + '"><img src="' + bSrc + '" alt="' + c.name.replace(/[<>"&]/g, '') + ' on Philly After School" width="240" height="72"></a>';
            var plain = '<a href="' + bPage + '">' + c.name.replace(/[<>&]/g, '') + ' on Philly After School</a>';
            var code = el('textarea', 'pm-code'); code.readOnly = true; code.rows = 4; code.value = snippet; code.setAttribute('aria-label', 'Code for the badge'); code.addEventListener('focus', function () { code.select(); });
            var bAct = el('div', 'actions'), bCopy = btn('btn', 'Copy the badge code'), bText = btn('btn', 'Copy a plain link instead'), bSay = el('span', 'hint'); bSay.setAttribute('aria-live', 'polite');
            var bPut = function (text, done) {
              var no = function () { code.value = text; code.focus(); code.select(); bSay.textContent = 'Couldn’t copy here. The code is selected: copy it from the box.'; };
              if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { bSay.textContent = done; }, no); else no();
            };
            bCopy.addEventListener('click', function () { code.value = snippet; bPut(snippet, 'Copied. Paste it into your website where you want the badge.'); });
            bText.addEventListener('click', function () { code.value = plain; bPut(plain, 'Copied. Paste it into your website: it shows as a line of text that links to your listing.'); });
            bAct.appendChild(bCopy); bAct.appendChild(bText); bAct.appendChild(bSay);
            bBox.appendChild(bRow); bBox.appendChild(code); bBox.appendChild(bAct);
            item.appendChild(bBox);
          }
        }
        // a change: dates, cost, hours, anything else
        var form = el('form', 'g-form claim-edit');
        form.appendChild(el('h4', null, 'Send an update'));
        form.appendChild(el('p', 'hint', 'Fill in only what has changed.'));
        var fd = field(form, 'cd-' + c.listing, 'Dates', 'textarea', { rows: 2, maxLength: 700, placeholder: 'Sign-ups open November 3. Winter term runs January 5 to March 20.' });
        var fc = field(form, 'cc-' + c.listing, 'Cost', 'input', { type: 'text', maxLength: 300, placeholder: '$420 a month for five days' });
        var fh = field(form, 'ch-' + c.listing, 'Days and hours', 'input', { type: 'text', maxLength: 300, placeholder: 'Monday to Friday, dismissal to 6:30 pm' });
        var fo = field(form, 'ce-' + c.listing, 'Anything else', 'textarea', { rows: 3, maxLength: 1500, placeholder: 'Grades, pickup schools, how to register, what the listing gets wrong.' });
        var li = field(form, 'cl-' + c.listing, 'A page on your website that shows it (optional)', 'input', { type: 'url', maxLength: 300, placeholder: 'https://' });
        form.appendChild(el('p', 'hint', 'A person reads this and updates the listing, usually within a few days. You’ll get an email when it’s published.'));
        var fs2 = el('p', 'g-status'); fs2.setAttribute('aria-live', 'polite'); form.appendChild(fs2);
        var sb = el('button', 'btn primary', 'Send the update'); sb.type = 'submit';
        var fa2 = el('div', 'actions'); fa2.appendChild(sb); fa2.appendChild(view); form.appendChild(fa2);
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var parts = [['Dates', fd.value], ['Cost', fc.value], ['Days and hours', fh.value], ['Other', fo.value]].filter(function (x) { return x[1].replace(/\s+/g, '') !== ''; });
          if (!parts.length) { fs2.textContent = 'Fill in at least one box.'; fs2.className = 'g-status bad'; return; }
          sb.disabled = true;
          call('edit_add', { listing: c.listing, body: parts.map(function (x) { return x[0] + ': ' + x[1].replace(/^\s+|\s+$/g, ''); }).join('\n'), link: li.value.trim() }).then(function (r) {
            sb.disabled = false;
            if (!r.ok) { fs2.textContent = r.message; fs2.className = 'g-status bad'; return; }
            said = 'Sent. We’ll email you when the update to ' + c.name + ' is published.'; saidBad = false;
            pushStep('change_sent');
            cClaims = r.claims || []; render();
          });
        });
        item.appendChild(form);
        if (c.edits && c.edits.length) {
          var ul = el('ul', 'g-list claim-edits');
          c.edits.forEach(function (x) {
            var li2 = el('li');
            li2.appendChild(el('span', 'claim-status ' + (x.status === 'done' ? 'ok' : x.status === 'declined' ? 'declined' : 'pending'), (EDIT[x.status] || x.status) + (when(x.created) ? ' · sent ' + when(x.created) : '')));
            li2.appendChild(el('span', 'claim-body', x.body.length > 260 ? x.body.slice(0, 260) + '…' : x.body));
            ul.appendChild(li2);
          });
          item.appendChild(ul);
        }
        // a premium listing has its own tools: photos, a logo, its own words, an offer line, fuller numbers, and a flyer
        if (c.premium) { premiumTools(item, c, view.href); return dropBtn(item, c); }
        // the photo: a paid extra, so the form is there only when photos are switched on
        if (claimsBox.getAttribute('data-photos') !== '1') return dropBtn(item, c);
        var pf = el('form', 'g-form claim-photo');
        pf.appendChild(el('h4', null, 'Your photo'));
        if (c.photoLive) {
          var live = el('img', 'claim-photo-now'); live.alt = ''; live.src = API + '?action=photo&l=' + encodeURIComponent(c.listing) + '&v=' + c.photoLive; pf.appendChild(live);
          pf.appendChild(el('p', 'claim-status ok', 'On your listing'));
        }
        if (c.photo && c.photo.status === 'new') pf.appendChild(el('p', 'claim-status pending', c.photoLive ? 'A newer photo is waiting to be approved' : 'Your photo is waiting to be approved'));
        pf.appendChild(el('p', 'hint', 'One picture of your space or an activity, shown at the top of your listing once a person has approved it. It is shrunk on your device before it’s sent.'));
        var pick = field(pf, 'cp-' + c.listing, c.photoLive || c.photo ? 'Choose a different photo' : 'Choose a photo', 'input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/*' });
        var prev = el('img', 'claim-photo-now'); prev.alt = ''; prev.hidden = true; pf.appendChild(prev);
        var alt = field(pf, 'ca-' + c.listing, 'Describe it in a few words', 'input', { type: 'text', maxLength: 160, placeholder: 'Children building a robot at a workbench' });
        var okRow = el('label', 'check');
        var ok = el('input'); ok.type = 'checkbox'; okRow.appendChild(ok);
        okRow.appendChild(document.createTextNode(' I have the right to use this photo, and permission from the families of any children in it.'));
        pf.appendChild(okRow);
        var ps = el('p', 'g-status'); ps.setAttribute('aria-live', 'polite'); pf.appendChild(ps);
        var pa = el('div', 'actions');
        var pb = el('button', 'btn primary', 'Send the photo'); pb.type = 'submit'; pa.appendChild(pb);
        if (c.photoLive || c.photo) {
          var rm = btn('btn', 'Remove my photo');
          twoTap(rm, 'Tap again to remove it', function () { call('photo_drop', { listing: c.listing }).then(function (r) { if (r.ok) { cClaims = r.claims || []; said = 'Your photo is off ' + c.name + '.'; saidBad = false; } else { said = r.message; saidBad = true; } render(); }); });
          pa.appendChild(rm);
        }
        pf.appendChild(pa);
        var ready = null;
        pick.addEventListener('change', function () {
          ready = null; prev.hidden = true; ps.textContent = ''; ps.className = 'g-status';
          if (!pick.files || !pick.files[0]) return;
          ps.textContent = 'Getting the photo ready…';
          shrink(pick.files[0], function (out, err) {
            if (!out) { ps.textContent = err; ps.className = 'g-status bad'; return; }
            ready = out; prev.src = out.data; prev.hidden = false; ps.textContent = '';
          });
        });
        pf.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!ready) { ps.textContent = 'Choose a photo first.'; ps.className = 'g-status bad'; return; }
          if (alt.value.replace(/\s+/g, ' ').replace(/^ | $/g, '').length < 8) { ps.textContent = 'Describe the photo in a few words, for people who can’t see it.'; ps.className = 'g-status bad'; return; }
          if (!ok.checked) { ps.textContent = 'Tick the box to say you have the right to use this photo.'; ps.className = 'g-status bad'; return; }
          pb.disabled = true; ps.className = 'g-status'; ps.textContent = 'Sending…';
          call('photo_add', { listing: c.listing, alt: alt.value, permission: true, data: ready.data.slice(ready.data.indexOf(',') + 1) }).then(function (r) {
            pb.disabled = false;
            if (!r.ok) { ps.textContent = r.message; ps.className = 'g-status bad'; return; }
            said = 'Photo sent. It goes on ' + c.name + ' once a person has looked at it, and we’ll email you.'; saidBad = false;
            pushStep('photo_sent');
            cClaims = r.claims || []; render();
          });
        });
        item.appendChild(pf);
      }
      return dropBtn(item, c);
    };
    // ----- a premium listing's tools -----
    var premiumTools = function (item, c, listingUrl) {
      var P = c.premium, box = el('div', 'claim-premium'), key = c.listing, slug = key.replace(/[^a-z0-9]+/g, '-');
      var head = el('h4', 'pm-title', 'Premium listing'); box.appendChild(head);
      box.appendChild(el('p', 'hint', P.mode === 'preview'
        ? 'These are being tried out. Until premium listings open to everyone, what you add shows on your listing only to you, while you’re signed in. A person looks at each thing before it shows.'
        : 'What you add here shows on your listing once a person has looked at it.'));
      var after = function (okText) { return function (r) { if (!r.ok) { said = r.message; saidBad = true; } else { said = okText; saidBad = false; cClaims = r.claims || cClaims; } render(); }; };
      var sub = function (title, hint) { var d = el('div', 'pm-part'); d.appendChild(el('h5', null, title)); if (hint) d.appendChild(el('p', 'hint', hint)); box.appendChild(d); return d; };
      var src = function (id) { return API + '?action=photo&l=' + encodeURIComponent(key) + '&id=' + id; };
      // --- photos and the logo: the same form, twice
      var pictures = function (kind, part, list, room) {
        var isLogo = kind === 'logo';
        if (list.length) {
          var grid = el('div', 'pm-photos');
          list.forEach(function (ph) {
            var fig = el('figure', 'pm-photo' + (isLogo ? ' logo' : '')), im = el('img'); im.alt = ph.alt; im.src = src(ph.id);
            fig.appendChild(im);
            fig.appendChild(el('span', 'claim-status ' + (ph.status === 'ok' ? 'ok' : 'pending'), ph.status === 'ok' ? 'On your listing' : 'Waiting to be approved'));
            var rm = btn('clear', 'Remove'); rm.setAttribute('aria-label', 'Remove this ' + kind + ': ' + ph.alt);
            twoTap(rm, 'Tap again to remove it', function () { call('photo_drop', { listing: key, id: ph.id }).then(after('That ' + kind + ' is off ' + c.name + '.')); });
            fig.appendChild(rm); grid.appendChild(fig);
          });
          part.appendChild(grid);
        }
        if (!room) { part.appendChild(el('p', 'hint', 'That’s all ' + P.max + '. Remove one to add another.')); return; }
        var f = el('form', 'g-form claim-photo pm-form'), id = (isLogo ? 'pl-' : 'pp-') + slug;
        var pick = field(f, id, isLogo ? (list.length ? 'Choose a different logo' : 'Choose your logo') : (list.length ? 'Add another photo' : 'Choose a photo'), 'input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/*' });
        var prev = el('img', 'claim-photo-now'); prev.alt = ''; prev.hidden = true; f.appendChild(prev);
        var alt = field(f, id + '-alt', 'Describe it in a few words', 'input', { type: 'text', maxLength: 160, placeholder: isLogo ? 'The ' + c.name + ' logo' : 'Children building a robot at a workbench' });
        var okRow = el('label', 'check'), ok = el('input'); ok.type = 'checkbox'; okRow.appendChild(ok);
        okRow.appendChild(document.createTextNode(isLogo ? ' This is our logo, and I have the right to use it.' : ' I have the right to use this photo, and permission from the families of any children in it.'));
        f.appendChild(okRow);
        var st = el('p', 'g-status'); st.setAttribute('aria-live', 'polite'); f.appendChild(st);
        var acts = el('div', 'actions'), go = el('button', 'btn primary', isLogo ? 'Send the logo' : 'Send the photo'); go.type = 'submit'; acts.appendChild(go); f.appendChild(acts);
        var ready = null;
        pick.addEventListener('change', function () {
          ready = null; prev.hidden = true; st.textContent = ''; st.className = 'g-status';
          if (!pick.files || !pick.files[0]) return;
          st.textContent = 'Getting it ready…';
          shrink(pick.files[0], function (out, err) { if (!out) { st.textContent = err; st.className = 'g-status bad'; return; } ready = out; prev.src = out.data; prev.hidden = false; st.textContent = ''; }, isLogo);
        });
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!ready) { st.textContent = 'Choose a ' + kind + ' first.'; st.className = 'g-status bad'; return; }
          if (alt.value.replace(/\s+/g, ' ').replace(/^ | $/g, '').length < 8) { st.textContent = 'Describe it in a few words, for people who can’t see it.'; st.className = 'g-status bad'; return; }
          if (!ok.checked) { st.textContent = 'Tick the box to say you have the right to use it.'; st.className = 'g-status bad'; return; }
          go.disabled = true; st.className = 'g-status'; st.textContent = 'Sending…';
          call('photo_add', { listing: key, kind: kind, alt: alt.value, permission: true, data: ready.data.slice(ready.data.indexOf(',') + 1) }).then(function (r) {
            go.disabled = false;
            if (!r.ok) { st.textContent = r.message; st.className = 'g-status bad'; return; }
            pushStep(kind + '_sent');
            after((isLogo ? 'Logo' : 'Photo') + ' sent. It goes on ' + c.name + ' once a person has looked at it, and we’ll email you.')(r);
          });
        });
        part.appendChild(f);
      };
      var shots = P.photos.filter(function (x) { return x.kind === 'photo'; }), logos = P.photos.filter(function (x) { return x.kind === 'logo'; });
      pictures('photo', sub('Photos (' + shots.length + ' of ' + P.max + ')', 'Your space, an activity, the room at pickup. The newest one sits at the top of your listing and the rest make a gallery. Each is shrunk on your device before it’s sent.'), shots, shots.length < P.max);
      pictures('logo', sub('Your logo', 'Shown beside what you write about your program.'), logos.slice(0, 2), true);
      // --- in their own words, and the offer line: text that waits for a look
      var texts = function (kind, part, t, make) {
        if (t.live) part.appendChild(el('p', 'claim-status ok', 'On your listing' + (kind === 'offer' && t.liveUntil ? ' until ' + when2(t.liveUntil) : '')));
        if (t['new']) part.appendChild(el('p', 'claim-status pending', t.live ? 'A newer version is waiting to be approved' : 'Waiting to be approved'));
        if (t.declined && !t['new']) part.appendChild(el('p', 'claim-status declined', 'The last one you sent wasn’t published. We emailed you about it.'));
        var f = el('form', 'g-form pm-form'), inputs = make(f, t);
        var st = el('p', 'g-status'); st.setAttribute('aria-live', 'polite'); f.appendChild(st);
        var acts = el('div', 'actions'), go = el('button', 'btn primary', t.live || t['new'] ? 'Send the new version' : 'Send it for a look'); go.type = 'submit'; acts.appendChild(go);
        if (t.live || t['new']) { var rm = btn('btn', 'Take it off my listing'); twoTap(rm, 'Tap again to take it off', function () { call('extra_drop', { listing: key, kind: kind }).then(after(kind === 'offer' ? 'The offer line is off ' + c.name + '.' : 'Your words are off ' + c.name + '.')); }); acts.appendChild(rm); }
        f.appendChild(acts);
        f.addEventListener('submit', function (e) {
          e.preventDefault(); go.disabled = true; st.className = 'g-status'; st.textContent = 'Sending…';
          call('extra_save', { listing: key, kind: kind, body: inputs.body.value, until: inputs.until ? inputs.until.value : '' }).then(function (r) {
            go.disabled = false;
            if (!r.ok) { st.textContent = r.message; st.className = 'g-status bad'; return; }
            pushStep(kind + '_sent');
            after('Sent. It shows on ' + c.name + ' once a person has looked at it, and we’ll email you.')(r);
          });
        });
        part.appendChild(f);
      };
      var when2 = function (iso) { var d = new Date(iso + 'T12:00:00Z'); return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
      texts('words', sub('In your own words', 'What a day looks like, who runs it, what makes it yours. It appears on your listing marked as written by you. Plain text, up to 900 characters.'), P.texts.words, function (f, t) {
        var ta = field(f, 'pw-' + slug, 'About ' + c.name, 'textarea', { rows: 7, maxLength: 900, placeholder: 'We’ve run after-school at the corner of 4th and Pine since 2009. Afternoons start with a snack and homework help, then…' });
        ta.value = t['new'] || t.live || '';
        var left = el('span', 'hint'); var count = function () { left.textContent = (900 - ta.value.length) + ' characters left'; }; ta.addEventListener('input', count); count(); f.appendChild(left);
        return { body: ta };
      });
      texts('offer', sub('An offer or event line', 'One line near the top of your listing: an open house, a trial class, a sibling discount, financial aid. It comes down by itself after the last day you pick.'), P.texts.offer, function (f, t) {
        var inp = field(f, 'po-' + slug, 'The line', 'input', { type: 'text', maxLength: 140, placeholder: 'Open house on November 12 at 6 pm. Come see the space.' });
        inp.value = t['new'] || t.live || '';
        var until = field(f, 'pu-' + slug, 'Show it until', 'input', { type: 'date' });
        var d0 = new Date(), iso = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
        until.min = iso(d0); until.max = iso(new Date(d0.getTime() + 90 * 86400000)); until.value = t.newUntil || (t.liveUntil >= iso(d0) ? t.liveUntil : '') || '';
        return { body: inp, until: until };
      });
      // --- questions
      sub('Questions from parents', 'Your listing has an “Ask a question” button. A parent’s question comes by email to ' + (cMe ? cMe.email : 'you') + (P.mode === 'preview' ? ' (for now only you can see the button)' : '') + ', and to anyone else who holds this listing. Reply to that email to answer them. We pass it along and don’t keep a copy.');
      // --- fuller numbers
      var M = P.more, nums = sub('More numbers', 'Month by month for as long as we’ve counted, up to a year. Numbers only: nothing about who.');
      var tiles = el('div', 'claim-nums');
      [[M.follows, 'person follows it for sign-up emails', 'people follow it for sign-up emails'], [M.favs, 'family saved it as a favorite', 'families saved it as a favorite']].forEach(function (t) {
        var tile = el('div', 'claim-num'); tile.appendChild(el('b', null, String(t[0]))); tile.appendChild(el('span', null, t[0] === 1 ? t[1] : t[2])); tiles.appendChild(tile);
      });
      nums.appendChild(tiles);
      if (M.months.length) {
        var wrap = el('div', 'stat-scroll'), tb = el('table', 'stat-table pm-months'), thead = el('thead'), hr = el('tr'), body = el('tbody');
        [['Month'], ['Opened'], ['Sign-up clicks'], ['Website clicks'], ['Put on a plan'], ['Asked for emails'], ['Questions']].forEach(function (h, i) { var th = el('th', null, h[0]); th.scope = 'col'; hr.appendChild(th); });
        thead.appendChild(hr); tb.appendChild(thead);
        M.months.slice().reverse().forEach(function (m) {
          var tr = el('tr'), th = el('th', null, new Date(m.m + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })); th.scope = 'row'; tr.appendChild(th);
          ['view', 'signup', 'site', 'plan', 'email', 'ask'].forEach(function (k) { tr.appendChild(el('td', null, String(m[k] || 0))); });
          body.appendChild(tr);
        });
        tb.appendChild(body); wrap.appendChild(tb); nums.appendChild(wrap);
      } else nums.appendChild(el('p', 'hint', 'Nothing counted yet.'));
      if (M.schools.length) {
        nums.appendChild(el('p', 'pm-label', 'Schools saved by the people who opened your listing, last three months'));
        var ul = el('ul', 'pm-schools');
        M.schools.forEach(function (x) { var li = el('li'); li.appendChild(el('b', null, x.name)); li.appendChild(el('span', null, ' ' + x.n + (x.n === 1 ? ' visit' : ' visits'))); ul.appendChild(li); });
        nums.appendChild(ul);
        nums.appendChild(el('p', 'hint', 'Only visits from a browser that has a school saved are counted here, so this is a share of the whole.'));
      }
      // --- a flyer with a code to scan (the badge for their website comes with every claimed listing)
      var kit = sub('A flyer', 'A page to print or post that sends families to your listing.');
      var pageUrl = ''; try { pageUrl = new URL(listingUrl, location.href).href.split('#')[0].split('?')[0]; } catch (e) { pageUrl = ''; }
      var flyAct = el('div', 'actions'), flyBtn = btn('btn', 'Make the flyer'), flySay = el('span', 'hint'); flySay.setAttribute('aria-live', 'polite');
      var flyBox = el('div', 'pm-flyer'); flyBox.hidden = true;
      flyAct.appendChild(flyBtn); flyAct.appendChild(flySay); kit.appendChild(flyAct); kit.appendChild(flyBox);
      flyBtn.addEventListener('click', function () {
        flySay.textContent = 'Drawing it…';
        var draw = function () {
          var rows = window.pasQR ? window.pasQR(pageUrl + '?utm_source=flyer&utm_medium=qr') : null;
          if (!rows) { flySay.textContent = 'The flyer couldn’t be drawn here.'; return; }
          var cv = flyer(c.name, pageUrl, rows);
          flyBox.textContent = ''; cv.className = 'pm-flyer-pic'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'A flyer for ' + c.name + ' with a code to scan');
          flyBox.appendChild(cv);
          var acts = el('div', 'actions'), save = btn('btn primary', 'Save the flyer');
          save.addEventListener('click', function () {
            cv.toBlob(function (blob) { var a = el('a'); a.href = URL.createObjectURL(blob); a.download = slug.replace(/^[pc]-/, '') + '-flyer.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); flySay.textContent = 'Saved. It prints on one letter-size page.'; }, 'image/png');
          });
          acts.appendChild(save); flyBox.appendChild(acts);
          flyBox.hidden = false; flySay.textContent = 'Scanning the code opens your listing.';
        };
        if (window.pasQR) { draw(); return; }
        var sc = document.createElement('script'); sc.src = claimsBox.getAttribute('data-qr') || ''; sc.onload = draw; sc.onerror = function () { flySay.textContent = 'The flyer couldn’t be loaded. Check your connection and try again.'; };
        document.head.appendChild(sc);
      });
      item.appendChild(box);
    };
    // The flyer: one letter-size page with the program's name and a code that opens its listing.
    var flyer = function (name, url, rows) {
      var W = 1275, H = 1650, cv = document.createElement('canvas'), x = cv.getContext('2d');
      cv.width = W; cv.height = H;
      var DISPLAY = '"Archivo","Arial Black","Helvetica Neue",Arial,sans-serif', BODY = '"Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif', NAVY = '#0B2140', YELLOW = '#F3C613';
      var fit = function (text, font, size, max, min) { do { x.font = font.replace('SIZE', size); size -= 4; } while (x.measureText(text).width > max && size > min); return x.font; };
      var wrap = function (text, max) { var words = text.split(' '), lines = [], line = ''; words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (x.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line); return lines; };
      x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
      var sky = x.createLinearGradient(0, 0, 0, 250); sky.addColorStop(0, '#96C9FF'); sky.addColorStop(1, '#C3E1FF');
      x.fillStyle = sky; x.fillRect(0, 0, W, 250);
      // the bus and the site's name
      x.fillStyle = YELLOW; x.beginPath(); if (x.roundRect) x.roundRect(90, 92, 84, 44, 12); else x.rect(90, 92, 84, 44); x.fill();
      x.fillStyle = NAVY; x.beginPath(); x.arc(112, 142, 11, 0, 7); x.fill(); x.beginPath(); x.arc(154, 142, 11, 0, 7); x.fill();
      x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.font = '800 52px ' + DISPLAY; x.fillText('Philly After School', 200, 138);
      x.font = '400 30px ' + BODY; x.fillStyle = '#1F3A60'; x.fillText('After-school programs in Philadelphia, by the school your child goes to', 92, 205);
      // the ask
      x.textAlign = 'center'; x.fillStyle = '#1F3A60'; x.font = '700 44px ' + BODY; x.fillText('Find us on Philly After School', W / 2, 345);
      x.fillStyle = NAVY; fit(name, '850 SIZEpx ' + DISPLAY, 104, W - 180, 52);
      var nameLines = wrap(name, W - 180).slice(0, 2), ny = 450;
      nameLines.forEach(function (l, i) { x.fillText(l, W / 2, ny + i * 100); });
      var top = ny + (nameLines.length - 1) * 100 + 60;
      // the code, on white with room around it
      var n = rows.length, side = Math.min(700, H - top - 430), cell = Math.floor(side / (n + 8)), size = cell * n, qx = Math.round((W - size) / 2), qy = top + cell * 4;
      x.fillStyle = '#FFFFFF'; x.fillRect(qx - cell * 4, qy - cell * 4, size + cell * 8, size + cell * 8);
      x.strokeStyle = YELLOW; x.lineWidth = 10; x.strokeRect(qx - cell * 4, qy - cell * 4, size + cell * 8, size + cell * 8);
      x.fillStyle = '#000000';
      for (var r = 0; r < n; r++) for (var c2 = 0; c2 < n; c2++) if (rows[r].charAt(c2) === '1') x.fillRect(qx + c2 * cell, qy + r * cell, cell, cell);
      var under = qy + size + cell * 4 + 78;
      x.fillStyle = NAVY; x.font = '800 46px ' + DISPLAY; x.fillText('Point your phone’s camera here', W / 2, under);
      x.fillStyle = '#1F3A60'; x.font = '400 34px ' + BODY;
      wrap('See our hours, cost and pickup, when sign-ups open, and what other parents say.', W - 260).forEach(function (l, i) { x.fillText(l, W / 2, under + 60 + i * 46); });
      // the address, for anyone typing it
      x.fillStyle = '#0A3566'; x.fillRect(0, H - 150, W, 150);
      x.fillStyle = '#FFFFFF'; fit(url.replace(/^https?:\/\//, ''), '700 SIZEpx ' + BODY, 38, W - 160, 22); x.fillText(url.replace(/^https?:\/\//, ''), W / 2, H - 82);
      x.fillStyle = '#CFE3FB'; x.font = '400 26px ' + BODY; x.fillText('Free for families', W / 2, H - 38);
      return cv;
    };
    var dropBtn = function (item, c) {
      if (c.status !== 'declined') {
        var drop = btn('clear', 'Give up this claim');
        twoTap(drop, 'Tap again to give it up', function () {
          call('claim_drop', { listing: c.listing }).then(function (r) { if (!r.ok) { said = r.message; saidBad = true; } else { said = 'You no longer hold ' + c.name + '.'; saidBad = false; cClaims = r.claims || []; } render(); });
        });
        item.appendChild(drop);
      }
      return item;
    };

    var render = function (keepFocus) {
      claimsBox.textContent = '';
      var held = {};
      cClaims.forEach(function (c) { held[c.listing] = c; });
      if (said) { var sp = el('p', 'g-status ' + (saidBad ? 'bad' : 'good'), said); sp.setAttribute('role', 'status'); claimsBox.appendChild(sp); }

      if (cState === 'name') {   // a new account: a name first, so we know who is claiming
        var fin = el('section', 'panel');
        fin.appendChild(el('h2', null, 'First, your name'));
        var fl = el('p', null, 'Signed in as '); fl.appendChild(el('b', null, cMe.email)); fin.appendChild(fl);
        var ff = el('form', 'g-form'), fn = nameFields('dir-', cMe);
        ff.appendChild(fn.box);
        ff.appendChild(el('p', 'hint', 'Only the person who runs this site sees your name. It is never shown on a listing. ' + LIST_NOTE));
        var fs = el('p', 'g-status'); fs.setAttribute('aria-live', 'polite'); ff.appendChild(fs);
        var fb = el('button', 'btn primary', 'Continue'); fb.type = 'submit'; ff.appendChild(fb);
        ff.addEventListener('submit', function (e) {
          e.preventDefault(); fb.disabled = true;
          saveNames(cMe, fn.first.value, fn.last.value).then(function (r) { fb.disabled = false; if (!r.ok) { fs.textContent = r.message; fs.className = 'g-status bad'; return; } signedIn(cMe); });
        });
        fin.appendChild(ff); claimsBox.appendChild(fin); fn.first.focus();
        return;
      }

      if (cState === 'in') {
        var who = el('section', 'panel');
        var wp = el('p', null, 'Signed in as '); wp.appendChild(el('b', null, cMe.email)); wp.appendChild(document.createTextNode('. '));
        if (PERSONAL.test(cDomain)) wp.appendChild(document.createTextNode('That’s a personal address, so it can’t claim a listing. Sign out and sign in with your work email: the one at your program’s website address.'));
        else { wp.appendChild(document.createTextNode('You can claim listings whose website is at ')); wp.appendChild(el('b', null, cDomain || 'your address')); wp.appendChild(document.createTextNode('.')); }
        who.appendChild(wp);
        var wa = el('div', 'actions');
        var acct = el('a', 'btn', 'Your account'); acct.href = page('account/'); wa.appendChild(acct);
        var so = btn('btn', 'Sign out'); so.addEventListener('click', function () { call('logout', {}).then(function () { set('pas-in', null); cMe = null; cClaims = []; cDomain = ''; cState = 'out'; said = ''; render(); }); }); wa.appendChild(so);
        who.appendChild(wa); claimsBox.appendChild(who);
        if (cClaims.length) {
          var mine = el('section', 'panel');
          mine.appendChild(el('h2', null, cClaims.length === 1 ? 'Your listing' : 'Your listings'));
          cClaims.forEach(function (c) { mine.appendChild(claimItem(c)); });
          if (cClaims.some(function (c) { return c.status === 'ok' && !c.gone; })) {
            // the emails about their own listing: on unless they say otherwise
            var mailRow = el('p', 'claim-mail'), mailLab = el('label', 'g-check'), mailBox = document.createElement('input'), mailNote = el('span', 'hint');
            mailBox.type = 'checkbox'; mailBox.id = 'claim-mail'; mailBox.checked = cMail; mailNote.setAttribute('aria-live', 'polite');
            mailLab.appendChild(mailBox); mailLab.appendChild(document.createTextNode(' Email me about my listing: its numbers once a month, new reviews, and new followers'));
            mailBox.addEventListener('change', function () {
              var want = mailBox.checked; mailBox.disabled = true;
              call('mgr_mail', { on: want }).then(function (r) {
                mailBox.disabled = false;
                if (!r.ok) { mailBox.checked = !want; mailNote.textContent = ' ' + (r.message || 'That didn’t save. Try again.'); return; }
                cMail = want; mailNote.textContent = want ? ' On.' : ' Off. Emails about your claim and what you send in still come.';
              });
            });
            mailRow.appendChild(mailLab); mailRow.appendChild(mailNote); mine.appendChild(mailRow);
          }
          claimsBox.appendChild(mine);
        }
      }

      // signing in, once someone has picked the listing they want
      if (cState === 'out' && wanted && byKey[wanted]) {
        var sbox = el('div', 'panel'); sbox.id = 'claim-signin'; claimsBox.appendChild(sbox);
        signInBox(sbox, 'managers', function (d) { signedIn(d.user); },
          'To claim ' + byKey[wanted].name + ', sign in with an email address at ' + (byKey[wanted].domain || 'its website') + '. No password. We send a 6-digit code and you type it here.');
        var sh = sbox.querySelector('h3'); if (sh) sh.textContent = 'Sign in to claim ' + byKey[wanted].name;
      }

      // find a listing
      var add = el('section', 'panel'); add.id = 'claim-search';
      add.appendChild(el('h2', null, cState === 'in' && cClaims.length ? 'Claim another listing' : 'Find your listing'));
      var sl = el('label', null, 'Search by name'); sl.htmlFor = 'claim-find';
      var si = el('input'); si.id = 'claim-find'; si.type = 'search'; si.autocomplete = 'off'; si.placeholder = 'Start typing your program’s name'; si.value = findText;
      var results = el('ul', 'g-list claim-results');
      var note = el('p', 'hint');
      add.appendChild(sl); add.appendChild(si); add.appendChild(results); add.appendChild(note);
      var claim = function (l, b, st) {
        b.disabled = true; st.className = 'g-status'; st.textContent = 'Checking…';
        call('claim_add', { listing: l.key }).then(function (r) {
          b.disabled = false;
          pushStep(r.ok ? (r.status === 'ok' ? 'claimed' : 'waiting') : (r.error === 'domain' ? 'address_mismatch' : 'refused'));
          if (!r.ok) { st.textContent = r.message; st.className = 'g-status bad'; return; }
          sset('pas-claim', null); wanted = ''; findText = '';
          said = r.status === 'ok' ? 'It’s yours: ' + l.name + ' now shows as claimed. Send an update whenever something changes.' : 'Asked. ' + l.name + ' is on a website many people share, so a person checks the claim. You’ll get an email either way.';
          saidBad = false; cClaims = r.claims || []; tellRole();
          render();
          window.scrollTo(0, Math.max(0, claimsBox.getBoundingClientRect().top + window.pageYOffset - 90));
        });
      };
      var show = function () {
        var text = si.value.trim().toLowerCase();
        findText = si.value;
        results.textContent = '';
        var pool = LIST.map(function (l) { return byKey[l[0]]; }).filter(function (l) { return !held[l.key]; });
        var hits = text.length < 2 ? (wanted && byKey[wanted] && !held[wanted] ? [byKey[wanted]] : (cState === 'in' && cDomain ? pool.filter(function (l) { return l.domain === cDomain; }) : []))
          : pool.filter(function (l) { return l.name.toLowerCase().indexOf(text) > -1; });
        hits.slice(0, 8).forEach(function (l) {
          var li3 = el('li');
          li3.appendChild(el('b', null, l.name));
          var st = el('p', 'g-status'); st.setAttribute('aria-live', 'polite');
          if (cState === 'in') {
            var same = !!cDomain && l.domain === cDomain;
            li3.appendChild(el('span', 'hint', l.domain ? 'Website at ' + l.domain + (same ? (l.match ? '. Your address matches.' : '. Your address matches, and a person checks this one.') : '. You’re signed in at ' + cDomain + ', which doesn’t match.') : 'No website we can check.'));
            if (same) { var b = btn('btn primary', 'Claim this listing'); b.addEventListener('click', function () { claim(l, b, st); }); li3.appendChild(b); }
            else li3.appendChild(el('span', 'hint', 'To claim it, sign out and sign in with an address at ' + (l.domain || 'its website') + '.'));
          } else {
            li3.appendChild(el('span', 'hint', l.domain ? 'Website at ' + l.domain + '. You’ll need an email address there to claim it.' : 'No website we can check.'));
            if (wanted === l.key) li3.appendChild(el('span', 'claim-status', 'Sign in above to claim it'));
            else {
              var pickIt = btn('btn primary', 'Claim this listing');
              pickIt.addEventListener('click', function () {
                wanted = l.key; sset('pas-claim', l.key); pushStep('picked');
                render();
                var box = document.getElementById('claim-signin');
                if (box) { window.scrollTo(0, Math.max(0, box.getBoundingClientRect().top + window.pageYOffset - 90)); var em = box.querySelector('input[type=email]'); if (em) em.focus(); }
              });
              li3.appendChild(pickIt);
            }
          }
          li3.appendChild(st);
          results.appendChild(li3);
        });
        // A place with several listings (an after-school program and a camp, say) can take them all in one go.
        var mine = cState === 'in' && cDomain && text.length < 2 ? pool.filter(function (l) { return l.domain === cDomain; }) : [];
        if (mine.length > 1) {
          var allLi = el('li', 'claim-all');
          allLi.appendChild(el('b', null, mine.length + ' listings have a website at ' + cDomain));
          var allSt = el('p', 'g-status'); allSt.setAttribute('aria-live', 'polite');
          var allBtn = btn('btn primary', 'Claim all ' + mine.length);
          allBtn.addEventListener('click', function () {
            allBtn.disabled = true; allSt.className = 'g-status'; allSt.textContent = 'Checking…';
            var got = 0, waiting = 0, bad = '', last = null;
            var next = function (i) {
              if (i >= mine.length) {
                if (last) { cClaims = last; tellRole(); }
                sset('pas-claim', null); wanted = ''; findText = '';
                said = (got ? got + (got === 1 ? ' listing is yours' : ' listings are yours') + ' and now show as claimed. ' : '') + (waiting ? waiting + (waiting === 1 ? ' is' : ' are') + ' on a website many people share, so a person checks ' + (waiting === 1 ? 'that claim' : 'those claims') + '. ' : '') + (bad ? bad : '');
                saidBad = !got && !waiting; pushStep(got ? 'claimed_all' : waiting ? 'waiting' : 'refused');
                render(); window.scrollTo(0, Math.max(0, claimsBox.getBoundingClientRect().top + window.pageYOffset - 90));
                return;
              }
              call('claim_add', { listing: mine[i].key }).then(function (r) {
                if (r.ok) { if (r.status === 'ok') got++; else waiting++; last = r.claims || last; } else bad = r.message || 'One of them couldn’t be claimed.';
                next(i + 1);
              });
            };
            next(0);
          });
          allLi.appendChild(allBtn); allLi.appendChild(allSt);
          results.insertBefore(allLi, results.firstChild);
        }
        note.textContent = text.length < 2
          ? (hits.length ? '' : (cState === 'in' ? 'No listing has a website at ' + (cDomain || 'your address') + '. Search by name to check, or suggest your program below.' : 'Every program and summer camp on the site is here: ' + LIST.length + ' listings.'))
          : (hits.length ? (hits.length > 8 ? 'Showing the first 8. Keep typing to narrow it.' : '') : 'Nothing by that name is listed yet.');
      };
      si.addEventListener('input', show);
      show();
      var miss = el('p', 'hint', 'Not on the site yet? ');
      var sg = el('a', null, 'Suggest your program or camp'); sg.href = page('suggest/'); miss.appendChild(sg); miss.appendChild(document.createTextNode(', with its website, and claim it once it’s up.'));
      add.appendChild(miss);
      if (cState === 'out' && !wanted) {
        var have = el('p', 'hint', 'Already claimed yours? ');
        var hl = btn('linklike', 'Sign in');
        hl.addEventListener('click', function () {
          var box = el('div', 'panel'); box.id = 'claim-signin'; claimsBox.insertBefore(box, add);
          signInBox(box, 'managers', function (d) { signedIn(d.user); }, 'Sign in with your work email. No password. We send a 6-digit code and you type it here.');
          var h = box.querySelector('h3'); if (h) h.textContent = 'Sign in';
          have.hidden = true;
        });
        have.appendChild(hl); add.appendChild(have);
      }
      claimsBox.appendChild(add);
      if (keepFocus) { var again = document.getElementById('claim-find'); if (again) again.focus(); }
    };

    if (!API) { cState = 'out'; render(); claimsBox.appendChild(el('p', 'g-status', 'Claiming doesn’t work in this preview copy of the site.')); }
    else if (!signedInHint()) { cState = 'out'; render(); }   // nothing to wait for: the search is there at once
    else {
      cState = 'out'; render();
      call('me').then(function (d) {
        if (d.ok && d.user) { set('pas-in', '1'); signedIn(d.user); } else { if (d.ok) set('pas-in', null); }
      });
    }
  }

  // Forget, on this device, which rosters were shared or kept in a profile (after deleting the account).
  function unlinkAll() {
    try {
      var r = JSON.parse(window.localStorage.getItem('pas-rosters') || 'null');
      if (r && Array.isArray(r.kids)) { r.kids.forEach(function (k) { delete k.groups; delete k.prof; }); delete r.sumProf; delete r.offProf; window.localStorage.setItem('pas-rosters', JSON.stringify(r)); }
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
      var count = function (w) { var n = 0; kids.forEach(function (k) { DAYS.concat(WKDAYS).forEach(function (dd) { n += (k[w][dd[0]] || []).length; }); }); return n; };
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
        var grid = el('div', 'week g-week'), showDays = daysShown(kids, which);
        if (showDays.length > 5) grid.className += ' g-week7';
        showDays.forEach(function (day) {
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
        showDays.forEach(function (day) { var th = el('th', null, day[1]); th.scope = 'col'; hr.appendChild(th); });
        thead.appendChild(hr); table.appendChild(thead);
        var tb = el('tbody');
        kids.forEach(function (k) {
          var tr = el('tr'); var th = el('th', null, k.name); th.scope = 'row'; tr.appendChild(th);
          showDays.forEach(function (day) {
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

  // A summer or a days-off plan taken out of the profile: this device's copy stays, it just stops being sent.
  function unkeepPlan(flag) {
    try {
      var r = JSON.parse(window.localStorage.getItem('pas-rosters') || 'null');
      if (r && r[flag]) { delete r[flag]; window.localStorage.setItem('pas-rosters', JSON.stringify(r)); }
    } catch (e) { /* nothing saved */ }
  }
  function unkeepSummer() { unkeepPlan('sumProf'); }
  // "Sam: 5 weeks, Rae: 3 weeks" for a summer kept in a profile.
  function summerLine(sm) {
    var bits = (sm.kids || []).map(function (k, i) { var n = Object.keys(k.w || {}).length; return (k.name || 'Child ' + (i + 1)) + ': ' + n + (n === 1 ? ' week' : ' weeks'); });
    return bits.join(', ') || 'Nothing on it yet';
  }
  // "Sam: 6 days, Rae: 2 days" for a days-off plan kept in a profile.
  function daysOffLine(p) {
    var bits = (p.kids || []).map(function (k, i) { var n = Object.keys(k.d || {}).length; return (k.name || 'Child ' + (i + 1)) + ': ' + n + (n === 1 ? ' day' : ' days'); });
    return bits.join(', ') || 'Nothing on it yet';
  }

  // =====================================================================================================
  // On the summer schedule and the days-off page: keeping the plan in a profile. It is the account holder's own copy,
  // for their other devices. Nothing here shares it with anyone. What leaves the device: each child's first name and
  // their picks (camps by week, or a place for each day off).
  // =====================================================================================================
  // The profile's copy, put onto this device: children are matched by first name, then a child with no name yet, then
  // added. `put` writes one child's picks; `clear` empties a child the profile's copy doesn't have.
  function matchKids(plan, copy, put, clear) {
    var r = plan.rosters(), used = [];
    (copy.kids || []).forEach(function (sk, i) {
      var name = String(sk.name || ''), at = -1;
      if (name) r.kids.forEach(function (k, j) { if (at < 0 && used.indexOf(j) < 0 && firstWord(k.name).toLowerCase() === name.toLowerCase()) at = j; });
      if (at < 0 && !name && i < r.kids.length && used.indexOf(i) < 0) at = i;
      if (at < 0) r.kids.forEach(function (k, j) { if (at < 0 && used.indexOf(j) < 0 && !k.name) at = j; });   // a child nobody has named yet: their plan is being replaced anyway
      if (at < 0) { if (r.kids.length >= plan.maxKids) return; r.kids.push(plan.newKid(name)); at = r.kids.length - 1; }
      used.push(at);
      put(r.kids[at], sk);
      if (!r.kids[at].name && name) r.kids[at].name = name;
    });
    r.kids.forEach(function (k, j) { if (used.indexOf(j) < 0) clear(k); });   // the profile's copy is the whole plan
  }
  // K: box (where the panel is drawn), plan (what site.js exposes), field (the profile's name for it: its actions are
  // field_save and field_delete), flag (set on this device while it is kept), next (where signing in comes back to),
  // event (the analytics event), n (the words for it), has(), body(), apply(copy), line(copy), empty and gets (two hints).
  function keepPlan(K) {
    var box = K.box, plan = K.plan, n = K.n;
    var me = null, kept = null, loaded = false, note = '', bad = false, timer = null, sent = '';
    var ros = function () { return plan.rosters(); };
    var tell = function (action) { var o = { event: K.event, action: action }; plan.track(o); };
    var push = function (then) {
      var body = K.body(), text = JSON.stringify(body), data = {}; data[K.field] = body;
      call(K.field + '_save', data).then(function (d) {
        if (d.http === 401) { me = null; note = 'Sign in again to keep ' + n.your + ' up to date in your profile.'; bad = true; draw(); return; }
        if (!d.ok) { note = d.message || 'That didn’t save. Try again.'; bad = true; draw(); return; }
        sent = text; kept = d[K.field]; ros()[K.flag] = { u: kept.updated }; plan.save();
        if (then) then();
      });
    };
    var apply = function (copy) { K.apply(copy); ros()[K.flag] = { u: copy.updated }; sent = JSON.stringify(K.body()); plan.save(); plan.redraw(); };
    var draw = function () {
      box.textContent = ''; box.hidden = false;
      box.appendChild(el('h3', null, 'Keep it in your profile'));
      if (note) box.appendChild(el('p', 'g-status' + (bad ? ' bad' : ''), note));
      if (!me) {
        box.appendChild(el('p', null, 'With a free account, ' + n.it + ' is there on your phone and your computer. It stays yours: there’s no sharing it from here.'));
        var oa = el('div', 'actions');
        var li = el('a', 'btn', 'Log in'); li.href = page('account/') + '?next=' + K.next; oa.appendChild(li);
        var ca = el('a', 'btn', 'Create a free account'); ca.href = page('register/') + '?next=' + K.next; oa.appendChild(ca);
        box.appendChild(oa);
        if (K.more) { var yp = el('p', 'hint', 'An account also lines up your week, your days off and your summer in one private calendar: '); var yl = el('a', null, 'My kids’ calendar'); yl.href = page('calendar/'); yp.appendChild(yl); yp.appendChild(document.createTextNode('.')); box.appendChild(yp); }
        return;
      }
      if (!loaded) { box.appendChild(el('p', 'hint', 'Checking your profile…')); return; }
      var linked = !!ros()[K.flag], there = kept && kept.y === plan.year ? kept : null;
      var acts = el('div', 'actions');
      if (linked) {
        box.appendChild(el('p', null, n.It + ' is kept in your profile. Changes you make here are saved there, and show up on your other devices.'));
        var stop = btn('clear', 'Take it out of my profile');
        twoTap(stop, 'Tap again to take it out', function () { call(K.field + '_delete', {}).then(function (d) { if (!d.ok) return; kept = null; ros()[K.flag] = null; plan.save(); note = 'Taken out of your profile. It’s still on this device.'; bad = false; tell('profile_stop'); draw(); }); });
        acts.appendChild(stop);
      } else if (there) {
        box.appendChild(el('p', null, 'Your profile already has ' + n.a + ': ' + K.line(there) + '.'));
        var put = btn('btn primary', 'Put it on this device');
        var doPut = function () { apply(there); note = 'Done. This is ' + n.the + ' from your profile.'; bad = false; tell('profile_put'); draw(); };
        if (K.has()) twoTap(put, 'It replaces ' + n.the + ' on this device. Tap again', doPut); else put.addEventListener('click', doPut);
        acts.appendChild(put);
        if (K.has()) {
          var mine = btn('btn', 'Keep this device’s ' + n.word + ' instead');
          twoTap(mine, 'It replaces the one in your profile. Tap again', function () { push(function () { note = 'Kept. Your profile now has ' + n.it + '.'; bad = false; tell('profile_keep'); draw(); }); });
          acts.appendChild(mine);
        }
      } else if (K.has()) {
        box.appendChild(el('p', null, 'Keep ' + n.it + ' with your account, so it’s there on your other devices. It stays yours: there’s no sharing it from here.'));
        var keep = btn('btn primary', 'Keep ' + n.it + ' in my profile');
        keep.addEventListener('click', function () { keep.disabled = true; push(function () { note = 'Kept. Changes you make here are saved to your profile.'; bad = false; tell('profile_keep'); draw(); }); });
        acts.appendChild(keep);
      } else {
        box.appendChild(el('p', 'hint', K.empty));
      }
      if (acts.childNodes.length) box.appendChild(acts);
      box.appendChild(el('p', 'hint', K.gets));
      if (linked && K.more) box.appendChild(K.more());
    };
    // Every change on the page lands here. A kept plan is sent a moment later; otherwise the box just keeps up.
    var was = '';
    plan.onSave = function () {
      var key = (me ? 1 : 0) + '|' + (ros()[K.flag] ? 1 : 0) + '|' + (K.has() ? 1 : 0);
      if (key !== was) { was = key; if (note && !bad) note = ''; draw(); }
      if (!me || !ros()[K.flag]) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () { timer = null; if (ros()[K.flag] && JSON.stringify(K.body()) !== sent) push(); }, 1500);
    };
    draw();
    if (signedInHint()) call('me').then(function (d) {
      if (!d.ok || !d.user) { if (d.ok) set('pas-in', null); return; }
      set('pas-in', '1'); me = d.user; draw();
      call('profile').then(function (p) {
        loaded = true;
        if (!p.ok) { note = 'Couldn’t reach your profile just now.'; bad = true; draw(); return; }
        kept = p[K.field] || null;
        var link = ros()[K.flag];
        if (link && !kept) { ros()[K.flag] = null; plan.save(); }                                  // taken out of the profile somewhere else
        else if (link && kept.y === plan.year && kept.updated > link.u) apply(kept);             // changed on another device since
        else if (link) { sent = ''; if (JSON.stringify(K.body()) !== JSON.stringify({ y: kept.y, kids: kept.kids })) push(); }   // changed here while signed out or offline
        was = ''; plan.onSave();
      });
    });
  }
  // Where the whole year is: a line under a kept plan.
  function yearLink() {
    var p = el('p', 'hint', 'See everything you’ve planned for the year in one place: ');
    var a = el('a', null, 'My kids’ calendar'); a.href = page('calendar/'); p.appendChild(a); p.appendChild(document.createTextNode('.'));
    return p;
  }

  var hasYear = hasYearPage;
  var sumBox = document.getElementById('sum-profile');
  var summer = window.pasSummer;   // set by site.js on the summer schedule
  if (sumBox && summer && API) keepPlan({
    box: sumBox, plan: summer, field: 'summer', flag: 'sumProf', next: 'summer', event: 'pas_summer', more: hasYear ? yearLink : null,
    n: { it: 'this summer', It: 'This summer', a: 'a summer', the: 'the summer', your: 'your summer', word: 'summer' },
    has: function () { return summer.rosters().kids.some(function (k) { return k.sum && k.sum.y === summer.year && Object.keys(k.sum.w || {}).length > 0; }); },
    body: function () { return { y: summer.year, kids: summer.rosters().kids.map(function (k) { return { name: firstWord(k.name), w: (k.sum && k.sum.y === summer.year && k.sum.w) || {} }; }) }; },
    apply: function (sm) {
      matchKids(summer, sm, function (k, sk) {
        var w = {};
        summer.weeks.forEach(function (d) { var ids = ((sk.w && sk.w[d]) || []).filter(function (id) { return typeof id === 'string' && summer.camps[id]; }).slice(0, 6); if (ids.length) w[d] = ids; });
        k.sum = { y: summer.year, w: w, age: (k.sum && k.sum.age) || '' };
      }, function (k) { if (k.sum && k.sum.y === summer.year) k.sum.w = {}; });
    },
    line: summerLine,
    empty: 'Add a camp to a week, and you can keep the summer in your profile.',
    gets: 'Your profile gets each child’s first name and their camps by week. Ages, the calendar’s title and photos stay on this device.'
  });

  var offBox = document.getElementById('off-profile');
  var daysOff = window.pasDaysOff;   // set by site.js on the days-off page
  if (offBox && daysOff && API) {
    var offPicks = function (k) { var d = {}; daysOff.days.forEach(function (day) { var v = k.off && k.off[day]; if (v === 'home' || (v && daysOff.programs[v])) d[day] = v; }); return d; };
    keepPlan({
      box: offBox, plan: daysOff, field: 'daysoff', flag: 'offProf', next: 'daysoff', event: 'pas_dayoff', more: hasYear ? yearLink : null,
      n: { it: 'this plan', It: 'This plan', a: 'a days-off plan', the: 'the plan', your: 'your days off', word: 'plan' },
      has: function () { return daysOff.rosters().kids.some(function (k) { return Object.keys(offPicks(k)).length > 0; }); },
      body: function () { return { y: daysOff.year, kids: daysOff.rosters().kids.map(function (k) { return { name: firstWord(k.name), d: offPicks(k) }; }) }; },
      apply: function (copy) {
        // Only the days still to come are replaced: a day that has gone by keeps whatever this device had.
        var wipe = function (k) { daysOff.days.forEach(function (day) { if (k.off) delete k.off[day]; }); };
        matchKids(daysOff, copy, function (k, sk) {
          if (!k.off) k.off = {};
          wipe(k);
          daysOff.days.forEach(function (day) { var v = sk.d && sk.d[day]; if (v === 'home' || (typeof v === 'string' && daysOff.programs[v])) k.off[day] = v; });
        }, wipe);
      },
      line: daysOffLine,
      empty: 'Choose a plan for a day, and you can keep your days off in your profile.',
      gets: 'Your profile gets each child’s first name and where they’ll be on each day off. The calendar’s title and photos stay on this device.'
    });
  }

  // =====================================================================================================
  // My kids' calendar: the page is only filled in for someone who is signed in. It gets what their profile holds and
  // hands it to site.js, which draws the year from that and from the plans on this device. Nothing is sent from here.
  // =====================================================================================================
  var yearBox = document.getElementById('year');
  if (yearBox && window.pasYear && API) {
    var yOut = document.getElementById('year-out'), yWait = document.getElementById('year-wait');
    var yearOut = function () { set('pas-in', null); document.documentElement.classList.remove('signed'); yOut.hidden = false; yearBox.hidden = true; if (yWait) yWait.hidden = true; };
    if (signedInHint()) {
      yOut.hidden = true;
      call('me').then(function (d) {
        if (!d.ok || !d.user) { yearOut(); return; }
        set('pas-in', '1');
        call('profile').then(function (p) {
          if (yWait) yWait.hidden = true;
          yearBox.hidden = false;
          window.pasYear.show(p.ok ? p : null);
          if (!p.ok) { var warn = el('p', 'g-status bad', 'Couldn’t reach your profile just now, so this shows only what’s on this device. Reload to try again.'); yearBox.insertBefore(warn, yearBox.firstChild.nextSibling); }
        });
      });
    }
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
    weekendOf = board.data.weekend || null;
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
        WKDAYS.forEach(function (d) {
          ((w[which] && w[which][d[0]]) || []).forEach(function (e) {
            if (typeof e !== 'string' || !fresh.wk) return;
            var id = e.split('~')[0];
            if (!weekendOf || !weekendOf[id]) return;   // no longer runs on weekends
            var had = ((old.wk && old.wk[d[0]]) || []).filter(function (x) { return x.split('~')[0] === id; })[0];
            fresh.wk[d[0]].push(e.indexOf('~') > -1 ? e : (had || e));
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
        share.appendChild(el('p', null, 'A free account keeps ' + who + ' in your profile, so it’s on your phone and your computer, and lets you share it with one person, like a grandparent or a sitter, who signs in to see it.' + (groupsOn() ? ' You can also share it with a small group of families you invite.' : '')));
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
      var ga = el('a', null, profile && profile.grades && profile.grades.length ? 'Change' : 'Add grades'); ga.href = page('profile/') + '#you'; gp.appendChild(ga);
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
      grp.appendChild(el('h3', null, 'Share with a small group'));
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
