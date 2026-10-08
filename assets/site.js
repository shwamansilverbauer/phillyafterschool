// Small enhancements. Every page reads fine without JavaScript; this adds the school search,
// the grade/type filter, the rosters, and a few form conveniences.
(function () {
  // The menu bar sticks to the top of the screen. Its height goes into --bar-h so the things that stick under it, and
  // links that jump down a page, leave room for it.
  (function () {
    var bar = document.querySelector('.sitebar');
    if (!bar) return;
    var last = 0;
    var measure = function () { var h = Math.round(bar.getBoundingClientRect().height); if (h && h !== last) { last = h; document.documentElement.style.setProperty('--bar-h', h + 'px'); } };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure, function () { /* system fonts */ });
  })();
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

  // ----- "Claimed": listings whose own director has claimed them. One small request, and only on pages that list any. -----
  var marks = all(document, '[data-claimed]');
  if (marks.length && window.fetch && marks[0].getAttribute('data-api')) {
    window.fetch(marks[0].getAttribute('data-api') + '?action=claimed', { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.ok || !d.claimed) return;
      marks.forEach(function (m) { if (d.claimed.indexOf(m.getAttribute('data-claimed')) > -1) m.hidden = false; });
      // A photo the director sent and the site's owner approved.
      var api = marks[0].getAttribute('data-api');
      all(document, '[data-photo]').forEach(function (slot) {
        var ph = d.photos && d.photos[slot.getAttribute('data-photo')];
        if (!ph) return;
        var img = document.createElement('img');
        img.alt = ph.alt || ''; img.decoding = 'async';   // not lazy: a picture inside a hidden box would never load, and the box shows only once it has
        img.src = api + '?action=photo&l=' + encodeURIComponent(slot.getAttribute('data-photo')) + '&v=' + ph.v;
        img.onload = function () { slot.hidden = false; };
        slot.appendChild(img);
      });
    }, function () { /* offline: no marks */ });
  }

  // ----- filter rows that scroll sideways: show that there is more, and give an arrow to press -----
  all(document, '.rail').forEach(function (rail) {
    var wrap = document.createElement('div'); wrap.className = 'rail-wrap';
    rail.parentNode.insertBefore(wrap, rail); wrap.appendChild(rail);
    var mk = function (cls, label, dir) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'rail-go ' + cls; b.hidden = true;
      b.setAttribute('aria-label', label);
      b.addEventListener('click', function () {
        var by = Math.max(120, Math.round(rail.clientWidth * 0.7)) * dir;
        var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (rail.scrollBy) rail.scrollBy({ left: by, behavior: calm ? 'auto' : 'smooth' }); else rail.scrollLeft += by;
      });
      wrap.appendChild(b);
      return b;
    };
    var name = rail.getAttribute('aria-label') || 'choices';
    var prev = mk('prev', 'Show earlier ' + name.toLowerCase() + ' choices', -1), fwd = mk('fwd', 'Show more ' + name.toLowerCase() + ' choices', 1);
    var sync = function () {
      var left = rail.scrollLeft > 4, right = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4;
      prev.hidden = !left; fwd.hidden = !right;
      wrap.className = 'rail-wrap' + (left ? ' more-left' : '') + (right ? ' more-right' : '');
    };
    rail.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    if (window.ResizeObserver) new window.ResizeObserver(sync).observe(rail);
    sync(); window.setTimeout(sync, 400);   // again once fonts have settled the widths
  });
  // "Find your school" on the home page: go to the search box and put the cursor in it.
  all(document, 'a[href="#find-school"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var box = document.getElementById('find-school'); if (!box) return;
      e.preventDefault(); window.scrollTo(0, 0); box.focus();
    });
  });

  // ----- suggest-a-program form -----
  var form = document.querySelector('#suggest-form');
  if (form) {
    // Show only the fields that fit what is being sent: a program, a camp, an update to a listing, or a school.
    var KINDS = ['program', 'camp', 'correction', 'school'];
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
      form.querySelector('#f-details').required = key === 'correction';
      form.querySelector('#f-newschool').required = key === 'school';
      // A new program or camp needs a name and its own website: every listing is checked against it.
      var isNew = key === 'program' || key === 'camp';
      form.querySelector('#f-program').required = isNew;
      form.querySelector('#f-website').required = isNew;
    };
    kindInputs.forEach(function (i) { i.addEventListener('change', sync); });
    var asked = query();   // arriving from "ask for a school" or "request a feature"
    var wanted = KINDS.indexOf(asked.kind);
    if (wanted > -1 && kindInputs[wanted]) kindInputs[wanted].checked = true;
    sync();
    if (asked.newschool) form.querySelector('#f-newschool').value = asked.newschool.slice(0, 120);
    // Arriving from "Suggest an update" on a listing: the listing is already named.
    if (asked.program) form.querySelector('#f-program').value = asked.program.slice(0, 150);
    if (/^[pc]:[a-z0-9-]{1,80}$/.test(asked.fix || '')) {
      form.querySelector('#f-listing').value = asked.fix;
      var sch = form.querySelector('#f-school');
      if (sch) sch.value = 'No particular school';
      var det = form.querySelector('#f-details'); if (det) det.focus();
    }
    form.addEventListener('submit', function () {
      var key = kindKey();
      track({ event: 'pas_suggest_submit', suggest_kind: key, school: key === 'school' ? 'new school' : form.querySelector('#f-school').value });
    });
  }

  var ideaForm = document.querySelector('#idea-form');
  if (ideaForm) ideaForm.addEventListener('submit', function () { track({ event: 'pas_suggest_submit', suggest_kind: 'idea', school: '' }); });

  // ----- dates by email: the sign-up goes from this page straight to Klaviyo, with its public key -----
  // Only a first name, the email address and the chosen school or program are sent. Nothing from a roster goes with it.
  all(document, 'form[data-alerts]').forEach(function (form) {
    var sel = form.querySelector('select[name="school"]');
    var status = form.querySelector('[data-alerts-status]');
    var row = form.querySelector('.alerts-row');
    var btn = form.querySelector('button[type="submit"]');
    var place = form.getAttribute('data-place') || '';
    var saved = mySchool();
    if (sel && saved && all(sel, 'option').some(function (o) { return o.value === saved.id; })) sel.value = saved.id;
    function say(msg, kind) { status.textContent = msg; status.className = 'alerts-status' + (kind ? ' ' + kind : ''); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.elements.email.value.trim();
      var first = form.elements.first_name.value.replace(/\s+/g, ' ').trim().slice(0, 60);
      if (form.elements.company && form.elements.company.value) return;   // only a script fills the hidden field
      if (!first) { say('Add your first name so we know what to call you.', 'bad'); form.elements.first_name.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say('That email address doesn’t look right. Check it and try again.', 'bad'); form.elements.email.focus(); return; }
      var follow = form.elements.program || null;   // a program page follows that one program instead of a school
      var field = follow || form.elements.school, school = follow ? '' : field.value;
      var name = sel ? (sel.options[sel.selectedIndex].getAttribute('data-name') || '') : (field.getAttribute('data-name') || '');
      if (form.getAttribute('data-preview')) { say('This is the preview, so nothing was sent. Sign-ups work on the live site.'); return; }
      btn.disabled = true;
      say('Sending…');
      // Following a program leaves any school already on the address alone, and adds the program to its list.
      var props = follow ? { signup_place: place } : { school: school, signup_place: place };
      if (name && !follow) props.school_name = name;
      var klaviyo = function (path, body) {
        return fetch('https://a.klaviyo.com/client/' + path + '?company_id=' + encodeURIComponent(form.getAttribute('data-key')), {
          method: 'POST', headers: { 'content-type': 'application/vnd.api+json', revision: '2026-07-15' }, body: JSON.stringify(body)
        }).then(function (r) { if (r.status < 200 || r.status > 299) throw new Error('status ' + r.status); return r; });
      };
      fetch('https://a.klaviyo.com/client/subscriptions?company_id=' + encodeURIComponent(form.getAttribute('data-key')), {
        method: 'POST',
        headers: { 'content-type': 'application/vnd.api+json', revision: '2026-07-15' },
        body: JSON.stringify({ data: { type: 'subscription',
          attributes: { custom_source: 'phillyafterschool.org ' + place, profile: { data: { type: 'profile', attributes: { email: email, first_name: first, properties: props, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } } } },
          relationships: { list: { data: { type: 'list', id: form.getAttribute('data-list') } } } } })
      }).then(function (r) {
        if (r.status < 200 || r.status > 299) throw new Error('status ' + r.status);
        if (!follow) return r;
        return klaviyo('profiles', { data: { type: 'profile', attributes: { email: email }, meta: { patch_properties: { append: { programs: follow.value } } } } });
      }).then(function () {
        row.hidden = true;
        var hint = form.querySelector('.hint'); if (hint) hint.hidden = true;
        say(form.getAttribute('data-confirm')
          ? 'Almost there. Check your inbox for a confirmation email and tap the button in it.'
          : follow ? 'Done, ' + first + '. You’ll hear when ' + name + ' posts a date. If it already has some posted, they reach you tomorrow morning.'
          : 'You’re on the list' + (name ? ' for ' + name : '') + ', ' + first + '. Dates already on the calendar reach you tomorrow morning. After that, it’s one email a week at most.', 'good');
        track({ event: 'pas_alert_signup', school: school, program_id: follow ? follow.value : '', place: place });
      }).catch(function () {
        btn.disabled = false;
        say('That didn’t go through. Please try again in a minute.', 'bad');
      });
    });
  });

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

  // Sharing a picture has to start inside the tap itself: Safari refuses a share sheet that opens a moment later, once
  // the picture has been made. So each card keeps its picture ready: stale() after every redraw, share() from the tap.
  // When the share sheet won't open at all (some in-app browsers), fail() gets to say so instead of nothing happening.
  function pictureSharer(canvas) {
    var blob = null, timer = 0;
    return {
      stale: function () {
        blob = null;
        if (!canvas || !canvas.toBlob || !navigator.share) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(function () { try { canvas.toBlob(function (b) { blob = b; }, 'image/png'); } catch (e) { blob = null; } }, 150);
      },
      share: function (name, text, ok, fail) {
        var go = function (b) {
          var sent;
          try { sent = navigator.share({ files: [new File([b], name, { type: 'image/png' })], text: text }); } catch (e) { fail(); return; }
          sent.then(ok, function (e) { if (!e || e.name !== 'AbortError') fail(); });   // AbortError: they closed the sheet themselves
        };
        if (blob) go(blob); else canvas.toBlob(function (b) { if (b) go(b); else fail(); }, 'image/png');
      }
    };
  }

  // A calendar file (.ics) made here in the browser and handed to the device, so what's in it goes nowhere else.
  // Each event is { uid, start: "2027-06-07", days: 5, title, text, url }, and lasts whole days.
  function saveCalendar(name, events) {
    var esc = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); };
    var ymd = function (iso, add) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + (add || 0)); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
    var fold = function (line) { var out = []; while (line.length > 60) { out.push(line.slice(0, 60)); line = line.slice(60); } out.push(line); return out.join('\r\n '); };
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Philly After School//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    events.forEach(function (e) {
      lines.push('BEGIN:VEVENT', 'UID:' + e.uid + '@' + location.hostname, 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + ymd(e.start), 'DTEND;VALUE=DATE:' + ymd(e.start, e.days || 1), 'SUMMARY:' + esc(e.title));
      if (e.text) lines.push('DESCRIPTION:' + esc(e.text));
      if (e.url) lines.push('URL:' + e.url);
      lines.push('TRANSP:TRANSPARENT', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    var blob = new Blob([lines.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    var a = el('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

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
  var narrow = window.matchMedia ? window.matchMedia('(max-width: 1099px)') : { matches: false };
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

  // ----- a type page's "clubs at the school itself": someone who has saved a school sees theirs, with the rest a tap away -----
  all(document, '[data-school-clubs]').forEach(function (box) {
    var mine = mySchool(), lines = all(box, 'li[data-school]'), more = box.querySelector('.sc-more');
    if (!mine || !more || lines.length < 2 || !lines.some(function (li) { return li.getAttribute('data-school') === mine.id; })) return;
    lines.forEach(function (li) { li.hidden = li.getAttribute('data-school') !== mine.id; });
    more.hidden = false;
    more.querySelector('button').addEventListener('click', function () { lines.forEach(function (li) { li.hidden = false; }); more.hidden = true; });
  });

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

  // ----- rosters: one per child, each with a current week and an upcoming one, kept in this browser -----
  var DAYS = [['mon', 'Monday', 'Mon'], ['tue', 'Tuesday', 'Tue'], ['wed', 'Wednesday', 'Wed'], ['thu', 'Thursday', 'Thu'], ['fri', 'Friday', 'Fri']];
  var MAX_KIDS = 6;
  var rosters = null;
  var storageOk = true;
  try { window.localStorage.setItem('pas-test', '1'); window.localStorage.removeItem('pas-test'); } catch (e) { storageOk = false; }
  // The weekend is kept beside the five school days, not among them: a weekend class has no school and no pickup, so
  // its picks are just "program", optionally followed by "~" and a class or a time.
  var WKDAYS = [['sat', 'Saturday', 'Sat'], ['sun', 'Sunday', 'Sun']];
  function emptyBoard() { return { days: { mon: [], tue: [], wed: [], thu: [], fri: [] }, wk: { sat: [], sun: [] } }; }
  function cleanBoard(b) {
    var out = emptyBoard();
    if (b && typeof b === 'object') {
      DAYS.forEach(function (day) {
        var a = b.days && b.days[day[0]];
        if (Array.isArray(a)) out.days[day[0]] = a.filter(function (x) { return typeof x === 'string' && /^[a-z0-9-]+\.[a-z0-9-]+(~[^~,&=#]{1,40})?$/.test(x); }).slice(0, 8);
      });
      WKDAYS.forEach(function (day) {
        var a = b.wk && b.wk[day[0]];
        if (Array.isArray(a)) out.wk[day[0]] = a.filter(function (x) { return typeof x === 'string' && /^[a-z0-9-]+(~[^~,&=#]{1,40})?$/.test(x); }).slice(0, 6);
      });
    }
    return out;
  }
  function weekendCount(b) { return b && b.wk ? b.wk.sat.length + b.wk.sun.length : 0; }
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
  // A roster added to a share group remembers it: [{ g: group id, k: the child's id there, n: the group's name, c: the first name shared }].
  function cleanLinks(a) {
    return (Array.isArray(a) ? a : []).filter(function (l) { return l && /^[A-Za-z0-9]{6,30}$/.test(l.g || '') && typeof l.k === 'number' && l.k > 0; }).slice(0, 12)
      .map(function (l) { var o = { g: l.g, k: l.k, n: String(l.n == null ? '' : l.n).slice(0, 50), c: String(l.c == null ? '' : l.c).slice(0, 20) }; if (l.s) o.s = 1; return o; });
  }
  // A roster kept in the signed-in person's profile remembers which one: { id: its id there, u: when the two last matched }.
  function cleanProf(p) { return p && typeof p.id === 'number' && p.id > 0 ? { id: p.id, u: typeof p.u === 'number' ? p.u : 0 } : null; }
  // A child's summer is { y: 2027, w: { "2027-06-07": [camp ids] }, age: "7" }: camps by the Monday of each week.
  function cleanSum(s) {
    if (!s || typeof s !== 'object' || typeof s.y !== 'number') return null;
    var w = {};
    if (s.w && typeof s.w === 'object') Object.keys(s.w).slice(0, 20).forEach(function (d) {
      var a = Array.isArray(s.w[d]) ? s.w[d].filter(function (x, i, l) { return typeof x === 'string' && /^[a-z0-9-]{1,60}$/.test(x) && l.indexOf(x) === i; }).slice(0, 6) : [];
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && a.length) w[d] = a;
    });
    return { y: s.y, w: w, age: /^\d{1,2}$/.test(String(s.age || '')) ? String(s.age) : '' };
  }
  function newKid(name) { return { name: cleanName(name), now: emptyBoard(), next: emptyBoard(), teacher: '', cardNote: '', off: {}, offNote: '', prices: {}, groups: [], sum: null }; }
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
      rosters = { kid: 0, active: raw.active === 'now' ? 'now' : 'next', wk: !!raw.wk, kids: raw.kids.slice(0, MAX_KIDS).map(function (k) {
        k = k && typeof k === 'object' ? k : {};
        return { name: cleanName(k.name), now: cleanBoard(k.now), next: cleanBoard(k.next), teacher: cleanName(k.teacher), cardNote: String(k.cardNote == null ? '' : k.cardNote).slice(0, 110), off: cleanOff(k.off), offNote: String(k.offNote == null ? '' : k.offNote).slice(0, 110), prices: cleanPrices(k.prices), groups: cleanLinks(k.groups), prof: cleanProf(k.prof), sum: cleanSum(k.sum) };
      }) };
      rosters.sumTitle = cleanName(raw.sumTitle);
      rosters.sumProf = raw.sumProf && typeof raw.sumProf.u === 'number' ? { u: raw.sumProf.u } : null;   // set while the summer is kept in a profile
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
  function saveRosters() { store('pas-rosters', JSON.stringify(rosters)); updateCount(); if (window.pasBoard && window.pasBoard.onSave) window.pasBoard.onSave(); if (window.pasSummer && window.pasSummer.onSave) window.pasSummer.onSave(); }
  function activeKid() { var r = loadRosters(); return r.kids[r.kid]; }
  function activeBoard() { var r = loadRosters(); return r.kids[r.kid][r.active]; }
  function kidLabel(k, i) { return k.name || 'Child ' + (i + 1); }
  function countPicks(b) {
    var seen = {};
    DAYS.forEach(function (day) { b.days[day[0]].forEach(function (k) { seen[entryKey(k)] = 1; }); });
    WKDAYS.forEach(function (day) { ((b.wk && b.wk[day[0]]) || []).forEach(function (k) { seen['wk:' + entryKey(k)] = 1; }); });
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
    var actions = planEl.querySelector('#off-actions'), statusEl = planEl.querySelector('#off-status');
    var HOME = 'home';
    var label = function (v) { return v === HOME ? 'At home or with family' : od.programs[v] ? od.programs[v].name : ''; };
    var planned = function (kid) { return days.filter(function (d) { return kid.off[d.d] && label(kid.off[d.d]); }); };
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
      offSharer.stale();
    };
    var offSharer = pictureSharer(canvas);
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
      // The link goes inside the text: several apps (Messenger among them) drop a separate url when a picture is attached.
      if (navigator.share && navigator.canShare && window.File) {
        var probe = null;
        try { probe = new File([new Blob(['x'], { type: 'image/png' })], 'days-off.png', { type: 'image/png' }); } catch (e) { probe = null; }
        if (probe && navigator.canShare({ files: [probe] })) {
          shareBtn.hidden = false;
          shareBtn.addEventListener('click', function () {
            var who = cleanName(activeKid().name);
            // No title: Apple's share sheet turns a title into a second preview of the picture. The link rides along as text.
            offSharer.share(((who || 'our').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'our') + '-days-off.png', (who ? possessive(who) : 'Our') + ' days off. Plan yours: ' + (od.site || '') + '/days-off/?utm_source=dayoff_card&utm_medium=share',
              function () { shareEvent('image_share'); }, function () { cardStatus.textContent = 'Sharing didn’t open here. Use Save as image, then send the picture.'; });
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

    var calBtn = planEl.querySelector('#off-cal');
    if (calBtn) calBtn.addEventListener('click', function () {
      var kid = activeKid(), mine = planned(kid);
      if (!mine.length) return;
      saveCalendar('days-off.ics', mine.map(function (d) {
        var v = kid.off[d.d];
        return { uid: 'dayoff-' + d.d + '-' + v, start: d.d, days: 1, title: (kid.name ? kid.name + ': ' : '') + label(v) + ' (no school)', text: 'No school: ' + d.name + '.', url: od.programs[v] ? od.programs[v].url : od.page };
      }));
      statusEl.textContent = 'Saved days-off.ics with ' + mine.length + (mine.length === 1 ? ' day' : ' days') + '. Open the file to add them to your calendar.';
      track({ event: 'pas_board_share', method: 'calendar', board: 'day_camp' });
    });
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
    var banner = $('#board-retired'), emptyNote = $('#board-empty'), emptyText = $('#board-empty-text');
    var title = $('#board-title'), tabs = $('#board-tabs'), promote = $('#board-promote');
    var kidBar = $('#kid-bar'), kidTabs = $('#kid-tabs'), kidAdd = $('#kid-add'), kidRemove = $('#kid-remove');
    var WHICH = { now: 'current', next: 'upcoming' };

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
    // A week used to be shareable as a link that held the whole week. Those links are retired: anyone could open one and it
    // could not be taken back. The page's first script still moves an old link out of the address (see build.mjs) so
    // analytics never sees the name in it; here it is only noticed, never shown.
    var sharedHash = window.__pasShared || '';
    try { sharedHash = sharedHash || window.sessionStorage.getItem('pas-shared') || ''; window.sessionStorage.removeItem('pas-shared'); } catch (e) { /* no session storage */ }
    var oldLink = !!decode(sharedHash || location.hash);
    if (oldLink && window.history && history.replaceState) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file preview */ } }
    var shared = null;
    var lookup = function (entry) {
      var p = entryKey(entry).split('.'), prog = data.programs[p[0]], sch = data.schools[p[1]];
      return prog && sch && prog.schools[p[1]] ? { id: p[0], prog: prog, sch: sch, link: prog.schools[p[1]], note: entryNote(entry) } : null;
    };
    var pillText = function (k) {
      return k.link.rel === 'onsite' ? 'At ' + k.sch.name : k.link.rel === 'pickup' ? k.sch.name + ' pickup' : 'Near ' + k.sch.name;
    };
    var heading = function (name, which) { return (name ? possessive(name) + ' after-school roster' : 'After-school roster') + (which === 'next' ? ' (upcoming)' : ''); };
    var say = function (msg) { status.textContent = msg; };
    // What the share-groups script (groups.js) needs from this page. It adds onSave, onKidGone and onShow.
    window.pasBoard = {
      data: data, track: track,
      rosters: loadRosters, kid: activeKid,
      shared: function () { return shared; },
      save: function () { store('pas-rosters', JSON.stringify(rosters)); },
      emptyBoard: emptyBoard, newKid: newKid, maxKids: MAX_KIDS,
      redraw: function () { render(); }   // after the share-groups script changes a roster (a week put back from a profile)
    };
    var syncRoller = null;   // set further down, by the themed-week section
    var savedNote = function () { return storageOk ? 'Saved on this device.' : 'Your browser is blocking saved data, so this roster will be gone when you close the page. Make a card to keep a copy.'; };

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
      banner.hidden = !oldLink;
      if (adder) { adder.hidden = !!shared; drawAdd(); }
      if (syncRoller) syncRoller(total);
      total += drawWeekend(b);   // from here on, "anything on this week" includes the weekend
      if (window.pasBoard && window.pasBoard.onShow) window.pasBoard.onShow();
      drawCost(b);
      tabs.hidden = !!shared;
      kidBar.hidden = !!shared;
      tools.hidden = !!shared || total === 0;
      var dragHint = $('#board-hint'); if (dragHint) dragHint.hidden = !!shared || total === 0;
      if (maker) maker.hidden = !!shared || total === 0;
      var shareCta = $('#share-cta'); if (shareCta) shareCta.hidden = !maker || !!shared || total === 0;
      emptyNote.hidden = !!shared || total > 0;
      promote.hidden = !!shared || which !== 'next' || total === 0;
      promote.textContent = 'The new term has started: make this the current roster';
      promote.removeAttribute('data-armed');
      all(tabs, '.tab').forEach(function (t) { t.setAttribute('aria-pressed', String(t.getAttribute('data-board') === which)); });
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
      if (document.activeElement !== nameInput) nameInput.value = kid.name;
      if (maker) {
        if (document.activeElement !== teacherBox) teacherBox.value = kid.teacher || '';
        if (document.activeElement !== noteBox) noteBox.value = kid.cardNote || '';
        drawCard();
      }
    };

    // ----- the weekend: an optional Saturday and Sunday under the five school days -----
    // A weekend class has no school and no pickup, so a pick is just the program, with a class or a time typed beside it.
    var wkBox = $('#wkend'), wkStatus = '';
    var wkLookup = function (entry) { var id = entryKey(entry), p = data.weekend && data.weekend[id]; return p ? { id: id, prog: p, note: entryNote(entry) } : null; };
    var drawWeekend = function (b) {
      if (!wkBox) return 0;
      var r = loadRosters(), n = weekendCount(b), any = Object.keys(data.weekend || {}).length > 0;
      wkBox.textContent = '';
      wkBox.hidden = !!shared || !any;
      if (shared || !any) return n;
      if (!r.wk && !n) {   // off until someone asks for it
        var ask = el('p', 'wk-ask');
        var on = el('button', 'btn', 'Add Saturday and Sunday'); on.type = 'button'; on.id = 'wk-on';
        on.addEventListener('click', function () { loadRosters().wk = true; saveRosters(); render(); var first = wkBox.querySelector('select'); if (first) first.focus(); });
        ask.appendChild(on);
        ask.appendChild(el('span', 'hint', 'Weekend classes can go on the same week and the same card.'));
        wkBox.appendChild(ask);
        return n;
      }
      var head = el('div', 'wk-head');
      head.appendChild(el('h3', null, 'The weekend'));
      var more = el('a', null, 'See every weekend class'); more.href = data.weekendPath; head.appendChild(more);
      wkBox.appendChild(head);
      var grid = el('div', 'wk-grid');
      WKDAYS.forEach(function (day) {
        var col = el('section', 'wkcol');
        col.setAttribute('data-wkday', day[0]);
        col.appendChild(el('h3', null, day[1]));
        var list = el('ul'), shown = 0;
        b.wk[day[0]].forEach(function (entry) {
          var k = wkLookup(entry);
          if (!k) return;
          shown++;
          var li = el('li', 'pick tc wkpick');
          var type = data.types[k.prog.type];
          if (type) {
            li.style.setProperty('--tc', type.color);
            var band = el('span', 'tc-top');
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('aria-hidden', 'true');
            var shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            shape.setAttribute('d', type.icon); shape.setAttribute('fill', 'currentColor'); shape.setAttribute('fill-rule', 'evenodd');
            svg.appendChild(shape); band.appendChild(svg);
            band.appendChild(el('span', null, type.label));
            li.appendChild(band);
          }
          var a = el('a', null, k.prog.name); a.href = k.prog.path;
          var strong = el('b'); strong.appendChild(a); li.appendChild(strong);
          var note = el('input', 'note');
          note.type = 'text'; note.maxLength = 40; note.value = k.note;
          note.placeholder = 'Class or time';
          note.setAttribute('aria-label', 'Class or time for ' + k.prog.name + ' on ' + day[1]);
          note.addEventListener('change', function () {
            var mine = activeBoard(), i = mine.wk[day[0]].indexOf(entry);
            if (i > -1) { mine.wk[day[0]][i] = makeEntry(k.id, note.value); saveRosters(); wkStatus = savedNote(); render(); }
          });
          li.appendChild(note);
          if (k.prog.times && k.prog.times[day[0]]) li.appendChild(el('span', 'hint', 'Classes run ' + k.prog.times[day[0]]));
          if (k.prog.days.indexOf(day[0]) < 0) { li.className += ' tc-off'; li.appendChild(el('span', 'tc-warn', 'Not listed for ' + day[1] + 's')); }
          var rm = el('button', 'clear', 'Remove'); rm.type = 'button';
          rm.addEventListener('click', function () {
            var mine = activeBoard(), i = mine.wk[day[0]].indexOf(entry);
            if (i > -1) mine.wk[day[0]].splice(i, 1);
            saveRosters(); wkStatus = 'Removed. ' + savedNote(); render();
          });
          li.appendChild(rm);
          list.appendChild(li);
        });
        col.appendChild(shown ? list : el('p', 'hint', 'Nothing yet.'));
        // what can be added: the programs with a class that day, minus the ones already here
        var have = b.wk[day[0]].map(entryKey);
        var open = Object.keys(data.weekend).filter(function (id) { return data.weekend[id].days.indexOf(day[0]) > -1 && have.indexOf(id) < 0; })
          .sort(function (x, y) { return data.weekend[x].name.localeCompare(data.weekend[y].name); });
        if (open.length && b.wk[day[0]].length < 6) {
          var sel = el('select', 'wk-add'); sel.setAttribute('aria-label', 'Add a ' + day[1] + ' class');
          var first = el('option', null, 'Add a ' + day[1] + ' class…'); first.value = ''; sel.appendChild(first);
          open.forEach(function (id) { var o = el('option', null, data.weekend[id].name + (data.weekend[id].hood ? ' · ' + data.weekend[id].hood : '')); o.value = id; sel.appendChild(o); });
          sel.addEventListener('change', function () { if (sel.value) addWeekend(sel.value, day[0], 'roster_weekend'); });
          col.appendChild(sel);
        }
        grid.appendChild(col);
      });
      wkBox.appendChild(grid);
      var foot = el('p', 'wk-foot');
      var say2 = el('span', 'hint'); say2.setAttribute('aria-live', 'polite'); say2.textContent = wkStatus || 'Weekend classes aren’t in the cost estimate.'; wkStatus = '';
      foot.appendChild(say2);
      if (!n) {
        var off = el('button', 'clear', 'Hide the weekend'); off.type = 'button';
        off.addEventListener('click', function () { loadRosters().wk = false; saveRosters(); render(); });
        foot.appendChild(off);
      }
      wkBox.appendChild(foot);
      return n;
    };
    var addWeekend = function (id, day, how) {
      var p = data.weekend && data.weekend[id], r = loadRosters(), b = activeBoard();
      if (!p || !b.wk[day]) return;
      r.wk = true;
      if (b.wk[day].map(entryKey).indexOf(id) < 0 && b.wk[day].length < 6) {
        b.wk[day].push(id);
        track({ event: 'pas_board_add', program_id: id, school: 'weekend', day: day, method: how, board: r.active === 'next' ? 'upcoming' : 'current', children: r.kids.length });
        wkStatus = 'Added ' + p.name + ' to ' + (day === 'sat' ? 'Saturday' : 'Sunday') + '. ' + savedNote();
      }
      saveRosters(); render();
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
      if (window.pasBoard && window.pasBoard.onKidGone) window.pasBoard.onKidGone(r.kids[r.kid]);   // take their week out of any share group too
      r.kids.splice(r.kid, 1); r.kid = Math.max(0, r.kid - 1);
      saveRosters(); say('Removed.'); render();
    });
    var cardNext = $('#card-next');
    var track_share = function (method) {
      track({ event: 'pas_board_share', method: method, board: WHICH[loadRosters().active] });
      // Someone who has just sent, saved, copied or printed a card is asked whether they want to keep the week too.
      if (cardNext && /^(image_|print$)/.test(method) && document.getElementById('group-share')) cardNext.hidden = false;
    };
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
    $('#board-retired-ok').addEventListener('click', function () { oldLink = false; banner.hidden = true; });
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
      if (asked.wk && data.weekend && data.weekend[asked.wk] && !shared) {   // from the weekend classes page: "Add Saturday to your week"
        if (window.history && history.replaceState) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* file preview */ } }
        window.setTimeout(function () { addWeekend(asked.wk, asked.day === 'sun' ? 'sun' : 'sat', 'weekend_page'); if (wkBox && wkBox.scrollIntoView) wkBox.scrollIntoView({ block: 'center' }); }, 0);
      }
      if (asked.add && data.programs[asked.add] && !shared) {
        if (window.history && history.replaceState) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* file preview */ } }
        window.setTimeout(function () { pickAdd(asked.add, asked.school || '', 'program_page'); if (adder.scrollIntoView) adder.scrollIntoView({ block: 'center' }); }, 0);
      }
    }

    // ----- a themed week: pick a school and a theme, and Monday to Friday fills at random from the matching programs -----
    var roller = $('#roller');
    if (roller && data.themes) {
      var rollSchool = $('#roll-school'), rollGrade = $('#roll-grade'), rollStatus = $('#roll-status'), rollAfter = $('#roll-after'), rollUndo = $('#roll-undo'), rollAgain = $('#roll-again');
      var themeBtns = all(roller, '[data-theme]');
      var rolled = null;      // the last roll: { kid, which, before, sig, theme }. "before" is the week as it was before the first roll.
      var rollerSeen = false;
      var themeName = function (id) { var b = roller.querySelector('[data-theme="' + id + '"] b'); return b ? b.textContent : 'Themed'; };
      var inTheme = function (theme, tags) { return tags.some(function (t) { return theme.types.indexOf(t) > -1 || (theme.words || []).indexOf(t) > -1; }); };
      // A listing made of separate clubs is judged club by club: each has its own grades and its own kind.
      var classFits = function (p, c, theme, grade) {
        var info = p.cls && p.cls[c];
        if (!info) return true;
        return (!grade || !info.g || info.g.indexOf(grade) > -1) && inTheme(theme, info.t);
      };
      var themePool = function (theme, sid, grade) {
        return Object.keys(data.programs).filter(function (id) {
          var p = data.programs[id];
          if (!p.schools[sid] || (grade && p.grades && p.grades.indexOf(grade) < 0)) return false;
          if (p.cls) return p.offers.some(function (c) { return classFits(p, c, theme, grade); });
          // A whole program is in a theme by its type, or by a keyword the theme names. (A keyword that happens to
          // spell a type, like an aftercare that mentions "games", doesn't make it a games program.)
          return p.types.some(function (x) { return theme.types.indexOf(x) > -1; }) || p.kw.some(function (w) { return (theme.words || []).indexOf(w) > -1; });
        });
      };
      // One program a day. A program or class already used this week costs points, so the week spreads out before it repeats;
      // a program that doesn’t publish its days is a last resort, one that is only nearby costs a little; the rest is chance.
      var rollWeek = function (theme, sid, grade) {
        var ids = themePool(theme, sid, grade), used = {}, usedClass = {}, usedType = {}, board = emptyBoard(), guessed = [], n = 0;
        DAYS.forEach(function (d) {
          var best = null;
          ids.forEach(function (id) {
            var p = data.programs[id];
            if (p.days && p.days.indexOf(d[0]) < 0) return;
            var classes = p.offers.length ? p.offers.filter(function (c) { var on = p.offerDays && p.offerDays[c]; return (!on || on.indexOf(d[0]) > -1) && classFits(p, c, theme, grade); }) : [''];
            classes.forEach(function (c) {
              var kind = '', kindUse = 99;
              (p.cls && p.cls[c] ? p.cls[c].t : p.types).forEach(function (t) { if (theme.types.indexOf(t) > -1 && (usedType[t] || 0) < kindUse) { kind = t; kindUse = usedType[t] || 0; } });
              if (kindUse === 99) kindUse = 0;   // in the theme by a keyword, not a type
              var score = (used[id] || 0) * 7 + (usedClass[id + '~' + c] || 0) * 100 + (theme.mix ? kindUse * 6 : 0) + (!p.days ? 30 : p.schools[sid].rel === 'nearby' ? 3 : 0) + Math.random() * 12;
              if (!best || score < best.score) best = { id: id, c: c, kind: kind, score: score };
            });
          });
          if (!best) return;
          used[best.id] = (used[best.id] || 0) + 1;
          usedClass[best.id + '~' + best.c] = 1;
          usedType[best.kind] = (usedType[best.kind] || 0) + 1;
          board.days[d[0]].push(makeEntry(best.id + '.' + sid, best.c));
          n++;
          var prog = data.programs[best.id];
          if (!prog.days && guessed.indexOf(prog.name) < 0) guessed.push(prog.name);
        });
        return { board: board, guessed: guessed, n: n };
      };
      var sameSpot = function () { var r = loadRosters(); return !!rolled && rolled.kid === r.kid && rolled.which === r.active; };
      // A week someone built by hand, or changed since the last roll, takes a second tap to replace.
      var needsOk = function () { var b = activeBoard(); return countPicks(b) > 0 && !(sameSpot() && rolled.sig === JSON.stringify(b.days)); };
      var disarm = function () { themeBtns.concat([rollAgain]).forEach(function (b) { b.removeAttribute('data-armed'); }); };
      var drawThemes = function () {
        var sid = rollSchool.value, grade = rollGrade.value;
        themeBtns.forEach(function (b) {
          var n = sid ? themePool(data.themes[b.getAttribute('data-theme')], sid, grade).length : 0;
          b.disabled = !n;
          b.querySelector('[data-n]').textContent = !sid ? '' : n ? n + (n === 1 ? ' program' : ' programs') + ' to draw from' : 'Nothing listed yet';
        });
        disarm();
      };
      var doRoll = function (id, btn, how) {
        var theme = data.themes[id], sid = rollSchool.value, r = loadRosters();
        if (!theme || shared) return;
        if (!sid || !data.schools[sid]) { rollStatus.textContent = 'Choose a school first.'; rollSchool.focus(); return; }
        if (needsOk() && !btn.getAttribute('data-armed')) {
          disarm(); btn.setAttribute('data-armed', '1');
          rollStatus.textContent = 'This replaces the week below. Tap again to go ahead.';
          return;
        }
        disarm();
        var res = rollWeek(theme, sid, rollGrade.value);
        if (!res.n) { rollStatus.textContent = 'Nothing is listed for that theme at ' + data.schools[sid].name + ' yet.'; return; }
        if (!sameSpot()) rolled = { kid: r.kid, which: r.active, before: cleanBoard(activeBoard()) };
        res.board.wk = cleanBoard(activeBoard()).wk;   // a themed week fills Monday to Friday; the weekend stays as it was
        r.kids[r.kid][r.active] = res.board;
        rolled.sig = JSON.stringify(res.board.days); rolled.theme = id;
        saveRosters(); say(''); render();
        rollUndo.textContent = countPicks(rolled.before) ? 'Put back what I had' : 'Clear it';
        rollAfter.hidden = false;
        rollStatus.textContent = themeName(id) + ' week rolled for ' + data.schools[sid].name + (res.n < 5 ? ', with ' + res.n + ' of the 5 days filled' : '') + '. '
          + (res.guessed.length ? 'The day is a guess for ' + res.guessed.join('; ') + ', which ' + (res.guessed.length > 1 ? 'don’t' : 'doesn’t') + ' publish ' + (res.guessed.length > 1 ? 'their' : 'its') + ' days. ' : '')
          + savedNote();
        track({ event: 'pas_theme_week', theme: id, school: sid, method: how });
      };
      themeBtns.forEach(function (b) { b.addEventListener('click', function () { doRoll(b.getAttribute('data-theme'), b, 'roll'); }); });
      rollAgain.addEventListener('click', function () { if (rolled) doRoll(rolled.theme, rollAgain, 'again'); });
      rollUndo.addEventListener('click', function () {
        if (!sameSpot()) return;
        var r = loadRosters(), had = countPicks(rolled.before);
        r.kids[r.kid][r.active] = rolled.before;
        track({ event: 'pas_theme_week', theme: rolled.theme, school: rollSchool.value, method: 'undo' });
        rolled = null; rollAfter.hidden = true; disarm();
        saveRosters(); render();
        rollStatus.textContent = had ? 'Your week is back the way it was.' : 'Cleared.';
      });
      rollSchool.addEventListener('change', function () { if (rollSchool.value) store('pas-school', rollSchool.value); rollStatus.textContent = ''; drawThemes(); });
      rollGrade.addEventListener('change', function () { rollStatus.textContent = ''; drawThemes(); });
      // One grade kept in the profile is the obvious starting point; with several, the parent picks.
      try { var keptGrades = JSON.parse(store('pas-my-grades') || '[]'); if (Array.isArray(keptGrades) && keptGrades.length === 1 && all(rollGrade, 'option').some(function (o) { return o.value === keptGrades[0]; })) rollGrade.value = keptGrades[0]; } catch (e) { /* nothing kept */ }
      // Start from the school in the link ("Roll a themed week for Nebinger"), the saved school, or the one looked at last.
      var rollAsk = query().roll || '', mineNow = mySchool(), lastSchool = store('pas-school');
      var startSchool = data.schools[rollAsk] ? rollAsk : mineNow && data.schools[mineNow.id] ? mineNow.id : lastSchool && data.schools[lastSchool] ? lastSchool : Object.keys(data.schools).length === 1 ? Object.keys(data.schools)[0] : '';
      if (startSchool) rollSchool.value = startSchool;
      drawThemes();
      syncRoller = function (total) {
        roller.hidden = !!shared;
        if (!rollerSeen) { rollerSeen = true; roller.open = total === 0 || !!data.schools[rollAsk]; }   // open on an empty week; a click away otherwise
        if (rolled && !sameSpot()) { rolled = null; rollAfter.hidden = true; rollStatus.textContent = ''; disarm(); }
      };
      if (data.schools[rollAsk] && !shared) {
        if (window.history && history.replaceState) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* file preview */ } }
        window.setTimeout(function () { if (roller.scrollIntoView) roller.scrollIntoView({ block: 'center' }); }, 0);
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
      // A week with something on Saturday or Sunday gets a taller card: the five days keep their size and the weekend
      // sits in one more row beneath them, split in two.
      var wkOn = weekendCount(b) > 0, EXTRA = wkOn ? 184 : 0;
      if (canvas.height !== 1350 + EXTRA) canvas.height = 1350 + EXTRA;
      var ctx = canvas.getContext('2d'), W = 1080, H = 1350 + EXTRA, FOOT = 160;
      var teacher = cleanName(kid.teacher), note = String(kid.cardNote || '').replace(/\s+/g, ' ').replace(/^ | $/g, '');
      ctx.clearRect(0, 0, W, H);
      // a daytime sky, like the top of the site, over the site's deep-blue footer
      var sky = ctx.createLinearGradient(0, 0, 0, H - FOOT); sky.addColorStop(0, '#96C9FF'); sky.addColorStop(1, '#C3E1FF');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0A3566'; ctx.fillRect(0, H - FOOT, W, FOOT);
      // brand
      ctx.fillStyle = '#F3C613'; box(ctx, 56, 58, 54, 28, 8); ctx.fill();
      ctx.fillStyle = '#0B2140'; ctx.beginPath(); ctx.arc(70, 90, 7, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(98, 90, 7, 0, 7); ctx.fill();
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
      ctx.fillStyle = '#0B2140'; ctx.fillText(fit(ctx, title, textMax), 56, 196);
      ctx.font = '400 32px ' + BODY; ctx.fillStyle = '#1F3A60';
      ctx.fillText(fit(ctx, (wkOn ? 'After school and weekends' : 'After school') + (which === 'next' ? ', next term' : '') + (teacher ? '  ·  for ' + teacher : ''), textMax), 56, 248);
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
      if (wkOn) {   // Saturday and Sunday, side by side
        var wy = bottom + gap, wh = EXTRA - gap, cw = (984 - gap) / 2;
        WKDAYS.forEach(function (day, i) {
          var x = 48 + i * (cw + gap);
          ctx.fillStyle = '#FFFFFF'; box(ctx, x, wy, cw, wh, 22); ctx.fill();
          ctx.fillStyle = '#FFEFA2'; box(ctx, x, wy, 104, wh, 22); ctx.fill(); ctx.fillRect(x + 78, wy, 26, wh);
          var picks = b.wk[day[0]].map(wkLookup).filter(Boolean);
          ctx.fillStyle = '#0B2140'; ctx.font = '800 34px ' + DISPLAY; ctx.textAlign = 'center';
          ctx.fillText(day[2].toUpperCase(), x + 52, wy + wh / 2 + (picks.length > 2 ? 0 : 12));
          if (picks.length > 2) { ctx.font = '700 19px ' + BODY; ctx.fillText('+ ' + (picks.length - 2) + ' more', x + 52, wy + wh / 2 + 30); }
          ctx.textAlign = 'left';
          var tw = cw - 104 - 46;
          if (!picks.length) { ctx.fillStyle = '#7A8DA6'; ctx.font = '400 27px ' + BODY; ctx.fillText('Nothing planned', x + 126, wy + wh / 2 + 9); return; }
          var showN = Math.min(picks.length, 2), blockH = 76, startY = wy + (wh - showN * blockH) / 2;
          picks.slice(0, showN).forEach(function (k, j) {
            var by = startY + j * blockH, type = data.types[k.prog.type] || { color: '#0F4D90' };
            ctx.fillStyle = type.color; box(ctx, x + 120, by + 8, 9, blockH - 18, 4.5); ctx.fill();
            ctx.fillStyle = '#0B2140'; ctx.font = '750 28px ' + DISPLAY; ctx.fillText(fit(ctx, k.prog.name, tw), x + 142, by + 33);
            ctx.fillStyle = '#4D607A'; ctx.font = '400 22px ' + BODY; ctx.fillText(fit(ctx, k.note || (k.prog.times && k.prog.times[day[0]]) || 'Weekend class', tw), x + 142, by + 61);
          });
        });
      }
      if (note) {
        ctx.fillStyle = '#0A3566'; box(ctx, 48, 1082 + EXTRA, 984, 92, 22); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.font = '400 30px ' + BODY; ctx.fillText(fit(ctx, 'Note: ' + note, 930), 76, 1139 + EXTRA);
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
      weekSharer.stale();
    };
    var weekSharer = pictureSharer(canvas);
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
            var who = (cleanName(activeKid().name) || 'our').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'our';
            // No title: Apple's share sheet turns a title into a second preview of the picture. The link rides along as text.
            weekSharer.share(who + '-week.png', heading(activeKid().name, loadRosters().active) + '. Make your own at ' + (data.site || '') + '/?utm_source=week_card&utm_medium=share',
              function () { track_share('image_share'); }, function () { cardStatus.textContent = 'Sharing didn’t open here. Use Save as image, then send the picture.'; });
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
      // A small copy of the card sits in the "Share this schedule" strip under the week, so people see what they would send.
      var thumb = $('#share-thumb'), paintCard = drawCard;
      drawCard = function () { paintCard(); if (thumb) { try { var th = Math.round(thumb.width * canvas.height / canvas.width); if (thumb.height !== th) thumb.height = th; var t = thumb.getContext('2d'); t.clearRect(0, 0, thumb.width, thumb.height); t.drawImage(canvas, 0, 0, thumb.width, thumb.height); } catch (e) { /* the strip works without its preview */ } } };
      var shareCtaBtn = $('#share-cta-btn');
      if (shareCtaBtn) shareCtaBtn.addEventListener('click', function () {
        var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        maker.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
        maker.classList.add('flash');
        setTimeout(function () { maker.classList.remove('flash'); }, 2200);
        var head = maker.querySelector('h2'); if (head) { try { head.focus({ preventScroll: true }); } catch (e) { /* older browsers */ } }
        track_share('cta_click');
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

  // ----- summer schedule: a camp for each week of the summer, for each child, kept with the rosters on this device -----
  var sumEl = document.querySelector('[data-summer]');
  if (sumEl) (function () {
    var sd = JSON.parse(document.getElementById('summer-data').textContent);
    var $s = function (sel) { return sumEl.querySelector(sel); };
    var weeksEl = $s('#sum-weeks'), stripEl = $s('#sum-strip'), countEl = $s('#sum-count'), costEl = $s('#sum-cost');
    var toolsEl = $s('#sum-tools'), statusEl = $s('#sum-status'), ageBox = $s('#sum-age'), nameBox = $s('#sum-name');
    var kidsRow = $s('#sum-kids'), kidAdd = $s('#sum-kid-add'), kidDrop = $s('#sum-kid-drop');
    var chart = document.querySelector('.sum-chart'), chartNote = document.getElementById('sum-chart-note');
    var ids = Object.keys(sd.camps).sort(function (a, b) { return sd.camps[a].n.localeCompare(sd.camps[b].n); });
    var r = loadRosters();
    // Each child's summer is { y: the summer, w: { "2027-06-07": [camp ids] }, age: "7" }. One made for another summer starts over.
    var sumOf = function (k) {
      if (!k.sum || k.sum.y !== sd.year) k.sum = { y: sd.year, w: {}, age: (k.sum && k.sum.age) || '' };
      return k.sum;
    };
    r.kids.forEach(function (k) {
      var s = sumOf(k), w = {};
      sd.weeks.forEach(function (wk) { var got = (s.w[wk.d] || []).filter(function (id, i, a) { return sd.camps[id] && a.indexOf(id) === i; }); if (got.length) w[wk.d] = got; });
      s.w = w;
    });
    // A plan made before children could be named was kept on its own: it becomes the first child's.
    try {
      var old = JSON.parse(store('pas-summer') || 'null');
      if (old && old.y === sd.year && old.w && typeof old.w === 'object' && !Object.keys(sumOf(r.kids[0]).w).length) {
        sd.weeks.forEach(function (wk) { var got = Array.isArray(old.w[wk.d]) ? old.w[wk.d].filter(function (id, i, a) { return typeof id === 'string' && sd.camps[id] && a.indexOf(id) === i; }).slice(0, 6) : []; if (got.length) r.kids[0].sum.w[wk.d] = got; });
        if (/^\d{1,2}$/.test(String(old.age || ''))) r.kids[0].sum.age = String(old.age);
      }
      if (old) { window.localStorage.removeItem('pas-summer'); saveRosters(); }
    } catch (e) { /* nothing to carry over */ }
    var kid = function () { return r.kids[r.kid]; };
    var plan = function () { return sumOf(kid()); };
    var say = function (t) { statusEl.textContent = t || ''; };
    var picksOf = function (k, i) { return sumOf(k).w[sd.weeks[i].d] || []; };
    var picks = function (i) { return picksOf(kid(), i); };
    var fitsAge = function (c) { var age = plan().age; if (!age) return true; var a = +age; return a >= Math.floor(c.a[0]) && a <= c.a[1]; };
    var price = function (c) { return c.p === 0 ? 'Free' : c.p ? '$' + c.p + ' a week' : ''; };
    var dates = function (c) { return !c.w.length ? 'No dates listed' : c.x ? sd.year + ' dates' : c.y + ' dates, as a guide'; };
    var coveredOf = function (k) { return sd.weeks.filter(function (w, i) { return picksOf(k, i).length; }).length; };
    var covered = function () { return coveredOf(kid()); };
    var planners = function () { return r.kids.map(function (k, i) { return { k: k, i: i, name: k.name || (r.kids.length > 1 ? 'Child ' + (i + 1) : '') }; }).filter(function (x) { return coveredOf(x.k) > 0; }); };
    var costOf = function (k) { var t = 0; sd.weeks.forEach(function (w, i) { picksOf(k, i).forEach(function (id) { t += sd.camps[id].p || 0; }); }); return t; };
    var ev = function (action, more) { var o = { event: 'pas_summer', action: action, weeks_covered: covered(), children: r.kids.length }; if (more) Object.keys(more).forEach(function (x) { o[x] = more[x]; }); track(o); };
    var openWeek = -1;
    var toggle = function (id, i, how) {
      var s = plan(), d = sd.weeks[i].d, list = s.w[d] || [], at = list.indexOf(id), c = sd.camps[id];
      if (at > -1) list.splice(at, 1);
      else {
        if (list.length >= 6) { say('That week already has six camps. Take one off first.'); return; }
        list.push(id);
      }
      if (list.length) s.w[d] = list; else delete s.w[d];
      saveRosters();
      ev(at > -1 ? 'remove' : 'add', { camp_id: id, week: i + 1, method: how });
      say(at > -1 ? c.n + ' is off ' + sd.weeks[i].label + '.' : c.n + ' is on ' + sd.weeks[i].label + '.' + (c.w.indexOf(i) < 0 ? (c.w.length ? ' It didn’t list that week, so check with the camp.' : ' It hasn’t listed dates, so check with the camp.') : !c.x ? ' That’s the week it ran in ' + c.y + '.' : ''));
      draw();
    };
    var option = function (id, i) {
      var c = sd.camps[id], b = el('button', 'sum-opt');
      b.type = 'button';
      b.appendChild(el('b', null, c.n));
      b.appendChild(el('small', null, [c.hood, c.h, price(c), dates(c)].filter(Boolean).join(' · ')));
      b.addEventListener('click', function () { openWeek = -1; toggle(id, i, 'week_list'); });
      return b;
    };
    var drawCard = function () { /* set below, once the canvas is ready */ };
    var draw = function () {
      var me = kid(), n = covered(), total = 0, unpriced = 0, booked = 0, many = r.kids.length > 1;
      // who: one chip per child once there are two, and the name and age of the one being planned
      kidsRow.textContent = ''; kidsRow.hidden = !many;
      if (many) r.kids.forEach(function (k, i) {
        var chip = el('button', 'kid', kidLabel(k, i)); chip.type = 'button'; chip.setAttribute('aria-pressed', String(i === r.kid));
        chip.addEventListener('click', function () { r.kid = i; saveRosters(); openWeek = -1; say(''); draw(); });
        kidsRow.appendChild(chip);
      });
      kidAdd.hidden = r.kids.length >= MAX_KIDS;
      var bare = !countPicks(me.now) && !countPicks(me.next) && !Object.keys(me.off || {}).length && !(me.groups || []).length && !me.prof;
      kidDrop.hidden = !many || !bare;   // a child with an after-school roster is removed on the roster page, where share groups are told
      if (document.activeElement !== nameBox) nameBox.value = me.name || '';
      ageBox.value = plan().age || '';
      weeksEl.textContent = ''; stripEl.textContent = '';
      // a sibling's weeks, to start from
      var same = sumEl.querySelector('.sum-same'); if (same) same.parentNode.removeChild(same);
      if (many && !n) {
        var others = r.kids.filter(function (k) { return k !== me && coveredOf(k) > 0; });
        if (others.length) {
          same = el('p', 'sum-same'); same.appendChild(el('span', 'hint', 'Going to the same camps? '));
          others.forEach(function (k) {
            var b = el('button', 'clear', 'Copy ' + possessive(kidLabel(k, r.kids.indexOf(k))) + ' weeks'); b.type = 'button';
            b.addEventListener('click', function () { var w = {}; Object.keys(sumOf(k).w).forEach(function (d) { w[d] = sumOf(k).w[d].slice(); }); plan().w = w; saveRosters(); ev('copy_sibling'); say('Copied. Change any week that’s different.'); draw(); });
            same.appendChild(b);
          });
          weeksEl.parentNode.insertBefore(same, weeksEl);
        }
      }
      sd.weeks.forEach(function (wk, i) {
        var mine = picks(i);
        var cell = el('i', mine.length ? 'on' : ''); stripEl.appendChild(cell);
        var li = el('li', 'sum-week' + (mine.length ? ' has' : ''));
        var when = el('div', 'sum-when'); when.appendChild(el('b', null, wk.label));
        if (wk.note) when.appendChild(el('span', 'hint', wk.note));
        li.appendChild(when);
        var box = el('div', 'sum-picks');
        mine.forEach(function (id) {
          var c = sd.camps[id], chip = el('span', 'sum-chip' + (c.w.indexOf(i) < 0 ? ' ask' : ''));
          var a = el('a', null, c.n); a.href = sd.campsPage + '#' + id; chip.appendChild(a);
          var bits = [c.h, price(c), c.w.indexOf(i) < 0 ? (c.w.length ? 'not a week it listed' : 'no dates listed') : c.x ? '' : 'ran this week in ' + c.y].filter(Boolean).join(' · ');
          if (bits) chip.appendChild(el('small', null, bits));
          var x = el('button', 'sum-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Take ' + c.n + ' off ' + wk.label);
          x.addEventListener('click', function () { toggle(id, i, 'week_list'); });
          chip.appendChild(x); box.appendChild(chip);
          booked++; if (c.p === null) unpriced++; else total += c.p;
        });
        if (!mine.length) box.appendChild(el('span', 'sum-none', 'Nothing yet'));
        li.appendChild(box);
        var add = el('button', 'btn sum-add', mine.length ? 'Add another' : 'Add a camp'); add.type = 'button';
        add.setAttribute('aria-expanded', openWeek === i ? 'true' : 'false');
        add.addEventListener('click', function () { openWeek = openWeek === i ? -1 : i; draw(); var o = weeksEl.querySelector('.sum-choose'); if (o && o.scrollIntoView) o.scrollIntoView({ block: 'nearest' }); });
        li.appendChild(add);
        if (openWeek === i) {
          var age = plan().age, ch = el('div', 'sum-choose');
          var open = ids.filter(function (id) { return mine.indexOf(id) < 0 && fitsAge(sd.camps[id]); });
          var runs = open.filter(function (id) { return sd.camps[id].w.indexOf(i) > -1; });
          var undated = open.filter(function (id) { return !sd.camps[id].w.length; });
          ch.appendChild(el('p', 'sum-choose-h', runs.length ? (runs.length === 1 ? '1 camp lists this week' : runs.length + ' camps list this week') + (age ? ' for age ' + age : '') : 'No camp' + (age ? ' for age ' + age : '') + ' lists this week yet'));
          var grid = el('div', 'sum-opts'); runs.forEach(function (id) { grid.appendChild(option(id, i)); }); ch.appendChild(grid);
          if (undated.length) {
            var more = el('details', 'sum-more'), sm = el('summary', null, undated.length + (undated.length === 1 ? ' camp that hasn’t' : ' camps that haven’t') + ' listed dates');
            more.appendChild(sm);
            var g2 = el('div', 'sum-opts'); undated.forEach(function (id) { g2.appendChild(option(id, i)); }); more.appendChild(g2);
            ch.appendChild(more);
          }
          li.appendChild(ch);
        }
        weeksEl.appendChild(li);
      });
      var whose = me.name ? possessive(me.name) + ' summer: ' : many ? possessive(kidLabel(me, r.kid)) + ' summer: ' : '';
      countEl.textContent = n ? whose + n + ' of ' + sd.weeks.length + (n === 1 ? ' weeks has a camp.' : ' weeks have a camp.') : whose + 'No weeks filled in yet. ' + sd.weeks.length + ' to go.';
      var everyone = 0; r.kids.forEach(function (k) { everyone += costOf(k); });
      costEl.textContent = booked ? (total ? 'About $' + total.toLocaleString('en-US') + ' at the weekly prices the camps posted' : booked - unpriced ? 'Free, by the prices the camps posted' : '') + (unpriced ? (total || booked - unpriced ? ', not counting ' : '') + (unpriced === 1 ? '1 camp-week' : unpriced + ' camp-weeks') + ' with no weekly price posted' : '') + '.' + (many && everyone > total ? ' All children: about $' + everyone.toLocaleString('en-US') + '.' : '') + ' Before-care, after-care and sibling prices aren’t counted.' : '';
      toolsEl.hidden = !planners().length;
      // the chart: which boxes are in this child's summer, and which camps suit their age
      if (chart) all(chart, 'tbody tr').forEach(function (tr) {
        var id = tr.getAttribute('data-camp'), c = sd.camps[id];
        tr.hidden = !!c && !fitsAge(c);
        all(tr, 'td.on').forEach(function (td) {
          var i = +td.getAttribute('data-w'), b = td.querySelector('button'), inPlan = picks(i).indexOf(id) > -1;
          if (!b) {
            b = el('button'); b.type = 'button';
            b.addEventListener('click', function () { toggle(id, i, 'chart'); });
            td.textContent = ''; td.appendChild(b);
          }
          b.setAttribute('aria-pressed', inPlan ? 'true' : 'false');
          b.setAttribute('aria-label', c.n + ', ' + sd.weeks[i].label + (inPlan ? ', in your summer' : c.x ? '' : ', ran in ' + c.y));
          td.classList.toggle('picked', inPlan);
        });
      });
      if (chartNote && !chartNote.getAttribute('data-ask')) chartNote.textContent = [many ? 'Taps add to ' + possessive(kidLabel(me, r.kid)) + ' summer.' : '', plan().age ? 'Showing camps that take age ' + plan().age + '.' : ''].filter(Boolean).join(' ');
      drawCard();
    };
    // ----- children -----
    nameBox.addEventListener('input', function () { kid().name = cleanName(nameBox.value); saveRosters(); draw(); });
    kidAdd.addEventListener('click', function () {
      if (r.kids.length >= MAX_KIDS) return;
      r.kids.push(newKid('')); r.kid = r.kids.length - 1; sumOf(kid()); saveRosters(); openWeek = -1;
      ev('sibling_add'); say('Added. Type a first name if you’d like it on the calendar.'); draw();
      if (nameBox.focus) nameBox.focus();
    });
    var dropSure = false;
    kidDrop.addEventListener('click', function () {
      if (r.kids.length < 2) return;
      if (!dropSure) { dropSure = true; kidDrop.textContent = 'Remove ' + kidLabel(kid(), r.kid) + ' and their summer? Tap again'; window.setTimeout(function () { dropSure = false; kidDrop.textContent = 'Remove this child'; }, 5000); return; }
      dropSure = false; kidDrop.textContent = 'Remove this child';
      r.kids.splice(r.kid, 1); r.kid = Math.max(0, r.kid - 1); saveRosters(); openWeek = -1; say('Removed.'); draw();
    });
    ageBox.addEventListener('change', function () { plan().age = ageBox.value; saveRosters(); openWeek = -1; draw(); ev('age'); });
    // ----- the plan as text, and as a calendar file -----
    var asText = function () {
      var who = planners(), lines = [], total = 0;
      who.forEach(function (x, n) {
        if (n) lines.push('');
        lines.push((x.name ? possessive(x.name) + ' summer ' : 'Summer ') + sd.year);
        sd.weeks.forEach(function (wk, i) {
          var mine = picksOf(x.k, i).map(function (id) { var c = sd.camps[id]; if (c.p) total += c.p; return c.n + ([c.h, price(c)].filter(Boolean).length ? ' (' + [c.h, price(c)].filter(Boolean).join(', ') + ')' : ''); });
          lines.push(wk.label + ': ' + (mine.length ? mine.join(' + ') : 'nothing yet'));
        });
      });
      if (!who.length) lines.push('Summer ' + sd.year);
      if (total) lines.push('', 'About $' + total.toLocaleString('en-US') + ' at posted weekly prices.');
      lines.push('Made at ' + sd.page);
      return lines.join('\n');
    };
    $s('#sum-copy').addEventListener('click', function () {
      var text = asText(), done = function () { say('Copied. Paste it into a text or an email.'); ev('copy'); };
      var old = function () { var ta = el('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } document.body.removeChild(ta); if (ok) done(); else say('This browser wouldn’t copy it. Try Print instead.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, old); else old();
    });
    var shareBtn = $s('#sum-share');
    if (navigator.share) {
      shareBtn.hidden = false;
      shareBtn.addEventListener('click', function () { navigator.share({ text: asText() }).then(function () { ev('share'); }, function (e) { if (!e || e.name !== 'AbortError') say('Sharing didn’t open here. Use “Copy the plan as text” instead.'); }); });
    }
    // Each camp week becomes one Monday-to-Friday entry. The file is made here, so the names in it go nowhere.
    $s('#sum-cal').addEventListener('click', function () {
      var events = [];
      planners().forEach(function (x) {
        sd.weeks.forEach(function (wk, i) {
          picksOf(x.k, i).forEach(function (id) {
            var c = sd.camps[id];
            events.push({ uid: 'summer-' + sd.year + '-' + x.i + '-' + wk.d + '-' + id, start: wk.d, days: 5, title: (x.name ? x.name + ': ' : '') + c.n,
              text: [c.h, price(c), c.hood, c.w.indexOf(i) < 0 ? 'The camp hasn’t listed this week. Check with the camp.' : c.x ? '' : 'This is the week it ran in ' + c.y + '. Check the ' + sd.year + ' dates with the camp.'].filter(Boolean).join('\n'), url: new URL(sd.campsPage + '#' + id, location.href).href });
          });
        });
      });
      if (!events.length) { say('Add a camp to a week first.'); return; }
      saveCalendar('summer-' + sd.year + '.ics', events);
      say('Saved summer-' + sd.year + '.ics with ' + events.length + (events.length === 1 ? ' camp week' : ' camp weeks') + '. Open the file to add them to your calendar.');
      ev('calendar', { events: events.length });
    });
    $s('#sum-print').addEventListener('click', function () { ev('print'); window.print(); });
    var clearBtn = $s('#sum-clear'), sure = false;
    clearBtn.addEventListener('click', function () {
      if (!sure) { sure = true; clearBtn.textContent = 'Clear every week' + (r.kids.length > 1 ? ' for ' + kidLabel(kid(), r.kid) : '') + '? Tap again'; window.setTimeout(function () { sure = false; clearBtn.textContent = 'Clear the plan'; }, 5000); return; }
      sure = false; clearBtn.textContent = 'Clear the plan';
      plan().w = {}; saveRosters(); openWeek = -1; draw(); say('Cleared.'); ev('clear');
    });

    // ----- the calendar picture: the whole summer on one card, or a card for each month, with every child on it -----
    var cardBox = $s('#sum-card'), canvas = $s('#sum-canvas'), pagesEl = $s('#sum-pages'), titleBox = $s('#sum-title');
    var photoBox = $s('#sum-photo'), photoClear = $s('#sum-photo-clear'), cardStatus = $s('#sum-card-status');
    var photo = null, page = 'all';
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DISPLAY = '"Archivo", "Arial Black", Arial, sans-serif', BODY = '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif';
    var NAVY = '#0B2140', YELLOW = '#F3C613';
    var INKS = [['#DAEDFE', '#1763B8'], ['#FFEFA2', '#B88A00'], ['#D6F3D2', '#2C8444'], ['#F0DDF7', '#6B3FA0'], ['#FFD9CC', '#CC3000'], ['#E4ECF6', '#4D607A']];
    var dayOf = function (iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + (n || 0)); return d; };
    // The months the summer touches, each with the weeks that have a weekday in it.
    var months = (function () {
      var out = [];
      sd.weeks.forEach(function (wk, i) {
        for (var n = 0; n < 5; n++) {
          var m = dayOf(wk.d, n).getUTCMonth(), at = null;
          out.forEach(function (o) { if (o.m === m) at = o; });
          if (!at) { at = { m: m, weeks: [] }; out.push(at); }
          if (at.weeks.indexOf(i) < 0) at.weeks.push(i);
        }
      });
      return out.filter(function (o) { return o.weeks.some(function (i) { return dayOf(sd.weeks[i].d).getUTCMonth() === o.m; }); });   // a month that only gets the tail of a week isn't worth a card
    })();
    var fitText = function (ctx, text, max) { if (ctx.measureText(text).width <= max) return text; while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1); return text.replace(/\s+$/, '') + '…'; };
    var rbox = function (ctx, x, y, w, h, rad) { rad = Math.min(rad, h / 2, w / 2); ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath(); };
    var shortWeek = function (i) { var a = dayOf(sd.weeks[i].d), b = dayOf(sd.weeks[i].d, 4), ma = MONTHS[a.getUTCMonth()].slice(0, 3), mb = MONTHS[b.getUTCMonth()].slice(0, 3); return ma === mb ? ma + ' ' + a.getUTCDate() + '–' + b.getUTCDate() : ma + ' ' + a.getUTCDate() + ' – ' + mb + ' ' + b.getUTCDate(); };
    var defaultTitle = function () {
      var named = planners().filter(function (x) { return x.k.name; }).map(function (x) { return x.k.name; });
      if (named.length && named.length === planners().length && named.length <= 3) return (named.length === 1 ? possessive(named[0]) : named.length === 2 ? named[0] + ' and ' + possessive(named[1]) : named[0] + ', ' + named[1] + ' and ' + possessive(named[2])) + ' summer';
      return 'Our summer';
    };
    var cardTitle = function () { return cleanName(r.sumTitle) || defaultTitle(); };
    var names = function (k, i) { return picksOf(k, i).map(function (id) { return sd.camps[id].n; }); };
    var paint = function (which) {
      var ctx = canvas.getContext('2d'), W = 1080, H = 1350, FOOT = 150, who = planners(), many = who.length > 1;
      ctx.clearRect(0, 0, W, H);
      var sky = ctx.createLinearGradient(0, 0, 0, H - FOOT); sky.addColorStop(0, '#96C9FF'); sky.addColorStop(1, '#C3E1FF');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0A3566'; ctx.fillRect(0, H - FOOT, W, FOOT);
      // brand
      ctx.fillStyle = YELLOW; rbox(ctx, 56, 58, 54, 28, 8); ctx.fill();
      ctx.fillStyle = NAVY; ctx.beginPath(); ctx.arc(70, 90, 7, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(98, 90, 7, 0, 7); ctx.fill();
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.font = '800 32px ' + DISPLAY; ctx.fillText('Philly After School', 126, 86);
      // top right: the photo, or the sun
      var cx = 928, cy = 158, rad = 100;
      if (photo) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.closePath(); ctx.clip();
        var pw = photo.naturalWidth || photo.width, ph = photo.naturalHeight || photo.height, side = Math.min(pw, ph);
        ctx.drawImage(photo, (pw - side) / 2, (ph - side) / 2, side, side, cx - rad, cy - rad, rad * 2, rad * 2);
        ctx.restore();
        ctx.lineWidth = 8; ctx.strokeStyle = YELLOW; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.stroke();
      } else {
        ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.arc(cx, cy, 50, 0, 7); ctx.fill();
        ctx.strokeStyle = YELLOW; ctx.lineWidth = 9; ctx.lineCap = 'round';
        for (var a = 0; a < 12; a++) { var t = a * Math.PI / 6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(t) * 68, cy + Math.sin(t) * 68); ctx.lineTo(cx + Math.cos(t) * 90, cy + Math.sin(t) * 90); ctx.stroke(); }
        ctx.lineCap = 'butt';
      }
      // title, and which calendar this is
      var textMax = 720, title = cardTitle(), size = 88;
      do { ctx.font = '850 ' + size + 'px ' + DISPLAY; size -= 4; } while (ctx.measureText(title).width > textMax && size > 44);
      ctx.fillStyle = NAVY; ctx.fillText(fitText(ctx, title, textMax), 56, 190);
      var sub = which === 'all' ? 'Summer ' + sd.year : MONTHS[which.m] + ' ' + sd.year;
      ctx.font = '700 34px ' + BODY; ctx.fillStyle = '#1F3A60'; ctx.fillText(sub, 56, 244);
      // who is who, once there are two
      if (many) {
        var lx = 56 + ctx.measureText(sub).width + 34;
        ctx.font = '700 26px ' + BODY;
        who.forEach(function (x, n) {
          var label = fitText(ctx, x.name, 170), w = ctx.measureText(label).width;
          if (lx + 30 + w > 56 + textMax) return;
          ctx.fillStyle = INKS[n % 6][1]; ctx.beginPath(); ctx.arc(lx + 10, 235, 10, 0, 7); ctx.fill();
          ctx.fillStyle = NAVY; ctx.fillText(label, lx + 28, 244);
          lx += 28 + w + 26;
        });
      }
      var top = 290, bottom = H - FOOT - 28, X = 48, WIDE = 984;
      if (which === 'all') {
        // one row a week: the dates on a yellow tab, then a column for each child
        var gap = 8, rowH = (bottom - top - gap * (sd.weeks.length - 1)) / sd.weeks.length, TAB = 236, colW = (WIDE - TAB - 14) / Math.max(1, who.length);
        sd.weeks.forEach(function (wk, i) {
          var y = top + i * (rowH + gap);
          ctx.fillStyle = '#FFFFFF'; rbox(ctx, X, y, WIDE, rowH, 16); ctx.fill();
          ctx.fillStyle = YELLOW; rbox(ctx, X, y, TAB, rowH, 16); ctx.fill(); ctx.fillRect(X + TAB - 20, y, 20, rowH);
          ctx.fillStyle = '#2A2100'; ctx.font = '800 ' + (rowH < 50 ? 24 : 27) + 'px ' + DISPLAY; ctx.textAlign = 'center';
          ctx.fillText(fitText(ctx, shortWeek(i), TAB - 20), X + TAB / 2, y + rowH / 2 + 10); ctx.textAlign = 'left';
          who.forEach(function (x, n) {
            var cxl = X + TAB + 14 + n * colW, mine = names(x.k, i);
            ctx.fillStyle = INKS[n % 6][1]; rbox(ctx, cxl, y + 9, 8, rowH - 18, 4); ctx.fill();
            if (!mine.length) { ctx.fillStyle = '#9DB2CC'; ctx.font = '400 24px ' + BODY; ctx.fillText('open', cxl + 20, y + rowH / 2 + 8); return; }
            ctx.fillStyle = NAVY; ctx.font = '750 ' + (who.length > 2 ? 22 : 26) + 'px ' + DISPLAY;
            ctx.fillText(fitText(ctx, mine.join(' + '), colW - 34), cxl + 20, y + rowH / 2 + 9);
          });
        });
      } else {
        // a month: Monday to Friday across, a row for each week, and a bar for each child's camp
        var rows = which.weeks, HEAD = 44, g = 8, cellW = (WIDE - g * 4) / 5, rH = Math.min(214, (bottom - top - HEAD - g * (rows.length - 1)) / rows.length);
        ctx.font = '800 24px ' + DISPLAY; ctx.fillStyle = '#1F3A60'; ctx.textAlign = 'center';
        ['MON', 'TUE', 'WED', 'THU', 'FRI'].forEach(function (d, n) { ctx.fillText(d, X + n * (cellW + g) + cellW / 2, top + 28); });
        ctx.textAlign = 'left';
        rows.forEach(function (i, rn) {
          var y = top + HEAD + rn * (rH + g);
          for (var n = 0; n < 5; n++) {
            var d = dayOf(sd.weeks[i].d, n), inMonth = d.getUTCMonth() === which.m, x = X + n * (cellW + g);
            ctx.fillStyle = inMonth ? '#FFFFFF' : 'rgba(255,255,255,.45)'; rbox(ctx, x, y, cellW, rH, 14); ctx.fill();
            ctx.fillStyle = inMonth ? NAVY : '#6F87A6'; ctx.font = '800 26px ' + DISPLAY;
            ctx.fillText(String(d.getUTCDate()), x + 14, y + 34);
            if (!inMonth || d.getUTCDate() === 1) { ctx.font = '700 18px ' + BODY; ctx.fillText(MONTHS[d.getUTCMonth()].slice(0, 3), x + 14 + (d.getUTCDate() > 9 ? 38 : 22), y + 33); }
          }
          var bars = who.map(function (x, n) { return { n: n, k: x.k, name: x.name, camps: names(x.k, i) }; }).filter(function (b) { return b.camps.length; });
          if (!bars.length) { ctx.fillStyle = '#9DB2CC'; ctx.font = '400 26px ' + BODY; ctx.textAlign = 'center'; ctx.fillText('Nothing yet', X + WIDE / 2, y + rH / 2 + 26); ctx.textAlign = 'left'; return; }
          var room = rH - 50, bh = Math.min(54, (room - 6 * (bars.length - 1)) / bars.length), fs = Math.max(15, Math.min(28, Math.floor(bh * 0.56)));
          var by0 = y + 46 + Math.max(0, (room - 8 - bars.length * bh - 6 * (bars.length - 1)) / 2);
          bars.forEach(function (b, bn) {
            var by = by0 + bn * (bh + 6), ink = INKS[b.n % 6];
            ctx.fillStyle = ink[0]; rbox(ctx, X + 10, by, WIDE - 20, bh, 12); ctx.fill();
            ctx.fillStyle = ink[1]; rbox(ctx, X + 10, by, 12, bh, 6); ctx.fill();
            ctx.fillStyle = NAVY; ctx.font = '750 ' + fs + 'px ' + DISPLAY;
            var lead = many && b.name ? b.name + ': ' : '', hours = b.camps.length === 1 ? sd.camps[picksOf(b.k, i)[0]].h : '';
            ctx.fillText(fitText(ctx, lead + b.camps.join(' + ') + (hours ? '  ·  ' + hours : ''), WIDE - 64), X + 36, by + bh / 2 + fs * 0.36);
          });
        });
      }
      // footer: where this came from
      var host = String(sd.page || '').replace(/^https?:\/\//, '').replace(/\/$/, '') || 'phillyafterschool.org/summer-schedule';
      ctx.fillStyle = YELLOW; ctx.font = '800 38px ' + DISPLAY; ctx.fillText('Plan your summer', 56, H - FOOT + 64);
      ctx.fillStyle = '#FFFFFF'; ctx.font = '700 32px ' + BODY; ctx.fillText(host, 56, H - FOOT + 110);
      ctx.fillStyle = '#CFE3FB'; ctx.font = '400 24px ' + BODY; ctx.textAlign = 'right'; ctx.fillText('Check dates with each camp', W - 56, H - FOOT + 110); ctx.textAlign = 'left';
      sumSharer.stale();
    };
    var sumSharer = pictureSharer(canvas);
    var pageList = function () { return [['all', 'Whole summer', 'all']].concat(months.map(function (o) { return [String(o.m), MONTHS[o.m], o]; })); };
    var current = function () { var hit = null; pageList().forEach(function (p) { if (p[0] === page) hit = p; }); return hit || pageList()[0]; };
    var slug = function () { return (cardTitle().toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'our-summer'); };
    var fileName = function (p) { return slug() + (p[0] === 'all' ? '' : '-' + p[1].toLowerCase()) + '.png'; };
    if (cardBox && canvas && canvas.getContext && canvas.toBlob) {
      drawCard = function () {
        var any = planners().length > 0;
        cardBox.hidden = !any;
        if (!any) return;
        titleBox.placeholder = defaultTitle();
        if (document.activeElement !== titleBox) titleBox.value = r.sumTitle || '';
        pagesEl.textContent = '';
        pageList().forEach(function (p) {
          var b = el('button', 'kid', p[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(p[0] === current()[0]));
          b.addEventListener('click', function () { page = p[0]; drawCard(); });
          pagesEl.appendChild(b);
        });
        paint(current()[2]);
      };
      var fileOf = function (p, done) { paint(p[2]); canvas.toBlob(function (blob) { done(blob, fileName(p)); }, 'image/png'); };
      var saveBlob = function (blob, name) { var a = el('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); };
      titleBox.addEventListener('input', function () { r.sumTitle = titleBox.value.slice(0, 40); saveRosters(); paint(current()[2]); });
      photoBox.addEventListener('change', function () {
        var file = photoBox.files && photoBox.files[0];
        if (!file) return;
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); photo = img; photoClear.hidden = false; cardStatus.textContent = 'Photo added. It stays on this device.'; drawCard(); };
        img.onerror = function () { URL.revokeObjectURL(url); cardStatus.textContent = 'That file couldn’t be read as a picture. Try a JPG or PNG.'; };
        img.src = url;
      });
      photoClear.addEventListener('click', function () { photo = null; photoBox.value = ''; photoClear.hidden = true; cardStatus.textContent = 'Photo removed.'; drawCard(); });
      $s('#sum-pic-save').addEventListener('click', function () {
        fileOf(current(), function (blob, name) { saveBlob(blob, name); cardStatus.textContent = 'Saved as ' + name + '.'; ev('card_save', { card: current()[0] === 'all' ? 'summer' : 'month' }); });
      });
      $s('#sum-pic-all').addEventListener('click', function () {
        var list = pageList(), n = 0;
        var next = function () {
          if (n >= list.length) { paint(current()[2]); cardStatus.textContent = 'Saved ' + list.length + ' pictures. If only one arrived, your browser asked whether to allow the rest.'; ev('card_save', { card: 'all' }); return; }
          fileOf(list[n], function (blob, name) { saveBlob(blob, name); n++; window.setTimeout(next, 350); });
        };
        next();
      });
      var picShare = $s('#sum-pic-share');
      if (navigator.share && navigator.canShare && window.File) {
        var probe = null;
        try { probe = new File([new Blob(['x'], { type: 'image/png' })], 'summer.png', { type: 'image/png' }); } catch (e) { probe = null; }
        if (probe && navigator.canShare({ files: [probe] })) {
          picShare.hidden = false;
          picShare.addEventListener('click', function () {
            sumSharer.share(fileName(current()), cardTitle() + '. Plan yours: ' + sd.page + '?utm_source=summer_card&utm_medium=share',
              function () { ev('card_share'); }, function () { cardStatus.textContent = 'Sharing didn’t open here. Use Save as image, then send the picture.'; });
          });
        }
      }
      var picCopy = $s('#sum-pic-copy');
      if (canCopyPicture) {
        picCopy.hidden = false;
        picCopy.addEventListener('click', function () { copyCanvas(canvas, 'Plan your own at ' + String(sd.page || '').replace(/^https?:\/\//, '').replace(/\/$/, ''), function (ok) { cardStatus.textContent = ok ? 'Picture copied. Paste it into a message.' : 'Copying didn’t work in this browser. Use Save as image.'; if (ok) ev('card_copy'); }); });
      }
      $s('#sum-pic-print').addEventListener('click', function () {
        document.body.classList.add('print-card');
        var after = function () { document.body.classList.remove('print-card'); window.removeEventListener('afterprint', after); };
        window.addEventListener('afterprint', after);
        ev('card_print'); window.print();
      });
      if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('850 88px Archivo'), document.fonts.load('400 30px "Atkinson Hyperlegible"')]).then(function () { if (!cardBox.hidden) drawCard(); }, function () { /* system fonts will do */ });
    } else if (cardBox) cardBox.hidden = true;

    // What the accounts script (groups.js) needs to keep the summer in a profile. It adds onSave.
    window.pasSummer = {
      year: sd.year, weeks: sd.weeks.map(function (w) { return w.d; }), camps: sd.camps, track: track, maxKids: MAX_KIDS, newKid: newKid,
      rosters: function () { return r; },
      save: function () { store('pas-rosters', JSON.stringify(r)); },
      redraw: function () { openWeek = -1; draw(); }
    };
    draw();
    if (!storageOk) say('This browser is blocking saved data, so your summer won’t be here when you come back. Copy or print it before you leave.');
    // From a camp's card: "Add to your summer" lands on that camp's row of the chart.
    var asked = query().add;
    if (asked && sd.camps[asked]) {
      var c0 = sd.camps[asked], row = chart ? chart.querySelector('tr[data-camp="' + asked + '"]') : null;
      if (row && c0.w.length) {
        if (row.hidden) { plan().age = ''; draw(); }
        row.classList.add('ask');
        if (chartNote) { chartNote.setAttribute('data-ask', '1'); chartNote.textContent = 'Tap the weeks you want for ' + c0.n + '.'; }
        window.setTimeout(function () { var wrap = document.getElementById('chart'); if (wrap && wrap.scrollIntoView) wrap.scrollIntoView(); if (row.scrollIntoView) row.scrollIntoView({ block: 'center' }); }, 0);
      } else say(c0.n + ' hasn’t listed dates we can chart. Add it to any week with “Add a camp”, under the camps that haven’t listed dates.');
    }
  })();

  // ----- filters: one engine for every page that lists programs (school, A to Z, type, neighborhood) -----
  var fbar = document.querySelector('[data-filters]');
  if (fbar) {
    var fSchool = fbar.getAttribute('data-school') || '';
    var items = all(document, '[data-item]');
    var groups = all(document, '[data-group]');
    // Someone who saved their school sees the citywide lists narrowed to it, with one tap to widen them again.
    var mineF = fSchool || fbar.hasAttribute('data-noschool') ? null : mySchool();   // weekend classes go by neighborhood, never by school
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
    // Grades a signed-in parent keeps in their profile (the account pages copy them to this browser) become one more
    // choice on the grade row: programs that take any of their children's grades.
    var myGrades = [];
    try { myGrades = (JSON.parse(store('pas-my-grades') || '[]') || []).filter(function (g) { return typeof g === 'string' && !!document.getElementById('grade-' + g) && g !== 'ALL'; }).slice(0, 10); } catch (e) { myGrades = []; }
    var gradeAll = document.getElementById('grade-ALL');
    if (myGrades.length && gradeAll) {
      var mineBtn = el('button', 'gbtn mine');
      mineBtn.type = 'button'; mineBtn.id = 'grade-MINE';
      mineBtn.setAttribute('data-f', 'grade'); mineBtn.setAttribute('data-v', 'MINE'); mineBtn.setAttribute('aria-pressed', 'false');
      mineBtn.setAttribute('aria-label', (myGrades.length === 1 ? 'My child’s grade: ' : 'My children’s grades: ') + myGrades.join(', '));
      mineBtn.appendChild(el('span', 'g', myGrades.length === 1 ? 'My kid' : 'My kids'));
      mineBtn.appendChild(el('span', 'n', myGrades.join(', ')));
      gradeAll.parentNode.insertBefore(mineBtn, gradeAll.nextSibling);
    }
    var fbtns = all(document, '[data-f]');
    var count = document.querySelector('#count'), clear = document.querySelector('#clear');
    var search = document.querySelector('#prog-search'), noMatch = document.querySelector('[data-nomatch]'), searchMore = document.querySelector('#search-more');
    var FILTERS = ['type', 'grade', 'rel', 'hood', 'cost', 'day', 'school'];
    // Once the filters have scrolled off the top, a slim bar takes their place: a search box, and a button back to them.
    var qbar = document.getElementById('quickbar'), quick = null;
    if (qbar) quick = { bar: qbar, search: document.getElementById('quick-search'), go: document.getElementById('quick-filters'), n: document.getElementById('quick-n'), count: document.getElementById('quick-count'), clear: document.getElementById('quick-clear'), status: qbar.querySelector('.quick-status') };
    var blank = function () { return { type: 'ALL', grade: 'ALL', rel: 'ALL', hood: 'ALL', cost: 'ALL', day: 'ALL', school: 'ALL' }; };
    var state = blank();
    var terms = [];
    var findBtn = function (f, v) { for (var i = 0; i < fbtns.length; i++) if (fbtns[i].getAttribute('data-f') === f && fbtns[i].getAttribute('data-v') === v) return fbtns[i]; return null; };
    // Start from the page address (how the home page links in), then from the grade picked last time.
    var q0 = query();
    FILTERS.forEach(function (f) { if (q0[f] && findBtn(f, q0[f])) state[f] = q0[f]; });
    if (mineF && !q0.school) state.school = mineF.id;   // "school=all" in the address keeps the wide view
    if (!q0.grade) { var savedGrade = store('pas-grade'); if (savedGrade && findBtn('grade', savedGrade)) state.grade = savedGrade; }
    var gradeName = function (g) { return g === 'PK' ? 'Pre-K' : g === 'K' ? 'kindergarten' : 'grade ' + g; };
    var gradeLabel = function (g) { return g !== 'MINE' ? gradeName(g) : myGrades.length === 1 ? gradeName(myGrades[0]) : myGrades.map(function (x) { return x === 'PK' ? 'Pre-K' : x; }).join(' or '); };
    var gradeFits = function (it) { return state.grade === 'MINE' ? myGrades.some(function (g) { return inList(it, 'data-grades', g); }) : inList(it, 'data-grades', state.grade); };
    var inList = function (el, attr, v) { return (' ' + (el.getAttribute(attr) || '') + ' ').indexOf(' ' + v + ' ') > -1; };
    var apply = function () {
      var total = 0, hiddenHits = 0;
      items.forEach(function (it) {
        var gs = it.getAttribute('data-grades') || '*';
        var ok = (state.grade === 'ALL' || gs === '*' || gradeFits(it))
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
        // A school's clubs listing says which of its clubs fit the kind being looked at: "Music clubs here: Choir, Rock Band".
        var cm = it.querySelector('[data-club-match]');
        if (cm) {
          var fits = null;
          if (state.type !== 'ALL') { try { fits = JSON.parse(cm.getAttribute('data-club-match'))[state.type] || null; } catch (e) { fits = null; } }
          cm.hidden = !fits;
          cm.textContent = fits ? fits.label + ' clubs here: ' + fits.clubs.join(', ') : '';
        }
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
      var noun = fbar.getAttribute('data-noun') || 'program', nouns = fbar.getAttribute('data-nouns') || 'programs';   // the summer camp page counts camps
      count.textContent = total ? total + ' ' + (total === 1 ? noun : nouns) + (filtered ? what : fSchool ? ' for all grades' : '') : 'No ' + nouns + what + '. Try fewer filters.';
      clear.hidden = !filtered;
      if (quick) {   // the slim bar says the same thing in less room
        var live = FILTERS.filter(function (f) { return state[f] !== 'ALL'; }).length;
        quick.n.textContent = live; quick.n.hidden = !live;
        quick.count.textContent = filtered ? count.textContent : '';
        quick.clear.hidden = !filtered;
        quick.status.hidden = !filtered;
        if (quick.search && document.activeElement !== quick.search) quick.search.value = search ? search.value : '';
      }
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
    if (quick) {
      var siteBar = document.querySelector('.sitebar'), filtersEnd = document.querySelector('.picker') || fbar, footer = document.querySelector('.foot');
      var under = function () { return siteBar ? Math.max(0, siteBar.getBoundingClientRect().bottom) : 0; };
      var calm = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
      var placeBar = function () {
        var top = under();
        var past = filtersEnd.getBoundingClientRect().bottom < top + 2;                       // the filters are out of sight above
        var inList = !footer || footer.getBoundingClientRect().top > top + 180;                // and the list is still on screen
        quick.bar.hidden = !(document.activeElement === quick.search || (past && inList));   // never pulled away from someone typing in it
      };
      var waiting = false;
      var onMove = function () { if (waiting) return; waiting = true; (window.requestAnimationFrame || window.setTimeout)(function () { waiting = false; placeBar(); }, 16); };
      window.addEventListener('scroll', onMove, { passive: true });
      window.addEventListener('resize', onMove);
      placeBar();
      quick.go.addEventListener('click', function () {
        var y = window.pageYOffset + fbar.getBoundingClientRect().top - under() - 14;
        if (window.scrollTo) { try { window.scrollTo({ top: y, behavior: calm() ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, y); } }
        var firstBtn = fbar.querySelector('button');
        if (firstBtn && firstBtn.focus) { try { firstBtn.focus({ preventScroll: true }); } catch (e) { /* older browsers scroll; fine */ } }
        track({ event: 'pas_filter_open', school: fSchool });
      });
      quick.clear.addEventListener('click', function () { clear.click(); });
      if (quick.search) quick.search.addEventListener('blur', function () { window.setTimeout(placeBar, 60); });
      if (quick.search && search) {
        quick.search.addEventListener('input', function () {
          search.value = quick.search.value;
          var ev; try { ev = new Event('input', { bubbles: true }); } catch (e) { ev = document.createEvent('Event'); ev.initEvent('input', true, true); }
          search.dispatchEvent(ev);
          // keep what was found under the bar, not above it or off the bottom
          var first = null;
          for (var i = 0; i < items.length; i++) if (!items[i].hidden) { first = items[i]; break; }
          if (first) {
            var r = first.getBoundingClientRect(), edge = quick.bar.getBoundingClientRect().bottom + 12;
            if (r.top < edge - 4 || r.top > window.innerHeight * 0.6) window.scrollTo(0, window.pageYOffset + r.top - edge);
          }
        });
      }
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
      var on = !(m && m.id === id);
      if (!on) { try { window.localStorage.removeItem('pas-my-school'); } catch (e) { /* nothing saved */ } }
      else { store('pas-my-school', JSON.stringify({ id: id, name: name })); track({ event: 'pas_school_save', school: id }); }
      paint();
      // Someone signed in who keeps their school in their profile: keep the two in step. Nothing is sent for anyone else.
      var tag = document.querySelector('script[data-api]'), api = tag ? tag.getAttribute('data-api') : '';
      if (api && window.fetch && store('pas-in') === '1' && store('pas-prof-school') === '1') {
        window.fetch(api + '?action=school_save', { method: 'POST', credentials: 'same-origin', headers: { 'X-PAS': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ school: on ? id : '' }) })
          .then(function (r) { if (r.ok && note && on) note.textContent = 'Saved on this device and in your profile. The home page, lists and your roster now start from ' + name + '. Tap again to undo.'; }, function () { /* offline: the device still has it */ });
      }
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
