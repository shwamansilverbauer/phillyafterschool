// Edit mode. Loaded after someone turns editing on at /edit/ (and on /edit/ itself, for the published versions).
// Every sentence the build marked with data-copy becomes editable in place. Edits are kept in this browser, shown
// in a review panel, and then published to the site's repository (or sent by email). A sentence can also be taken
// off the page. Nothing here changes the site for anyone else until it is published.
(function () {
  var cfg = window.PAS_EDIT || {};
  var KEY = 'pas-copy-edits';
  function all(root, sel) { return [].slice.call(root.querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function set(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* edits last for this page only */ } }
  function clean(t) { return String(t).replace(/[ \s]+/g, ' ').replace(/^ | $/g, ''); }
  function tokens(t) { return t.match(/\{\w+\}/g) || []; }
  function plural(n) { return n + (n === 1 ? ' change' : ' changes'); }
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function post(body) {
    return window.fetch(cfg.send, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j && j.ok, message: (j && j.message) || '', status: r.status, data: j || {} }; }); });
  }

  // id -> { was, now, page, sent, remove }
  var edits = {};
  try { edits = JSON.parse(get(KEY) || '{}') || {}; } catch (e) { edits = {}; }
  function save() { set(KEY, JSON.stringify(edits)); }

  var editing = get('pas-edit') === '1';
  var editPage = document.querySelector('[data-edit-page]');

  // ----- the published versions, on the edit page -----
  if (editPage && cfg.send && window.fetch) {
    var box = editPage.querySelector('#pub');
    if (box) {
      var pubList = box.querySelector('#pub-list'), pubMsg = box.querySelector('#pub-msg'), rmList = box.querySelector('#pub-removed');
      var tell = function (t) { pubMsg.textContent = t; };
      window.fetch(cfg.send + '?action=versions', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) { tell(j && j.message ? j.message : 'The versions could not be read.'); return; }
        if (!j.ready) { tell('Publishing from here isn’t set up yet: the key file is missing on the server. Changes can still be sent by email from the review panel.'); }
        else if (!j.versions.length) { tell(j.message || 'Nothing has been published from here yet.'); }
        else {
          tell('');
          j.versions.forEach(function (v, i) {
            var li = el('li');
            li.appendChild(el('b', null, when(v.date)));
            li.appendChild(document.createTextNode(' ' + (v.title || v.sha) + (i === 0 ? ' (on the site now)' : '')));
            if (i > 0) {
              var b = el('button', 'pas-link', 'Restore this version'); b.type = 'button';
              b.addEventListener('click', function () {
                if (!b.getAttribute('data-armed')) { b.setAttribute('data-armed', '1'); b.textContent = 'Tap again to restore the site’s wording as it was at ' + when(v.date); return; }
                b.disabled = true; tell('Restoring…');
                post({ action: 'restore', sha: v.full, name: get('pas-edit-name') || '' }).then(function (res) { tell(res.message || (res.ok ? 'Restored.' : 'That didn’t work.')); if (!res.ok) { b.disabled = false; b.removeAttribute('data-armed'); b.textContent = 'Restore this version'; } })
                  .catch(function () { tell('That didn’t work.'); b.disabled = false; });
              });
              li.appendChild(document.createTextNode(' ')); li.appendChild(b);
            }
            pubList.appendChild(li);
          });
        }
        if (j.removed && j.removed.length && rmList) {
          rmList.hidden = false;
          var ul = rmList.querySelector('ul');
          j.removed.forEach(function (r) {
            var li = el('li'), back = el('button', 'pas-link', 'Put it back'); back.type = 'button';
            li.appendChild(el('span', 'pas-was', r.was)); li.appendChild(document.createTextNode(' '));
            back.addEventListener('click', function () {
              edits[r.id] = { was: '(off the page)', now: r.was, page: 'the edit page' }; save();
              back.disabled = true; back.textContent = 'Added to your changes: turn on editing and publish to put it back.';
            });
            li.appendChild(back); ul.appendChild(li);
          });
        }
      }).catch(function () { tell('The versions could not be read.'); });
    }
  }
  if (!editing) return;

  var nodes = all(document, '[data-copy]');
  var built = {};   // what the published site says: the sentence, or its template when it has {words} filled in per page
  nodes.forEach(function (n) { built[n.getAttribute('data-copy')] = n.hasAttribute('data-tpl') ? n.getAttribute('data-tpl') : clean(n.textContent); });
  // An edit the site has caught up with is finished: drop it.
  Object.keys(edits).forEach(function (id) {
    if (!edits[id] || typeof edits[id].now !== 'string') delete edits[id];
    else if (built[id] !== undefined && edits[id].now === built[id]) delete edits[id];
  });
  save();

  var where = location.pathname === '/' ? 'the home page' : location.pathname;
  function fill(n, tpl) {
    var v = {};
    try { v = JSON.parse(n.getAttribute('data-vars') || '{}'); } catch (e) { /* show the template as written */ }
    return tpl.replace(/\{(\w+)\}/g, function (m, k) { return k in v ? v[k] : m; });
  }
  function paint(n, raw) {
    var id = n.getAttribute('data-copy'), e = edits[id], text = e && !e.remove ? e.now : built[id];
    n.textContent = n.hasAttribute('data-tpl') && !raw ? fill(n, text) : text;
    n.classList.toggle('pas-changed', !!e && !e.remove);
    n.classList.toggle('pas-removed', !!e && !!e.remove);
  }

  // ----- styles -----
  var css = el('style');
  css.textContent = [
    'body.pas-editing{padding-bottom:96px}',
    '.pas-editing .offbar{bottom:96px}',   // the next-day-off bar sits above the editing bar instead of on it
    '.pas-editing [data-copy][contenteditable]{outline:1.5px dashed color-mix(in srgb,currentColor 55%,transparent);outline-offset:3px;border-radius:3px;cursor:text}',
    '.pas-editing [data-copy][contenteditable]:hover{background:color-mix(in srgb,#F3C613 30%,transparent)}',
    '.pas-editing [data-copy][contenteditable]:focus{outline:3px solid #F3C613;background:color-mix(in srgb,#F3C613 22%,transparent)}',
    '.pas-editing [data-copy].pas-changed,.pas-editing [data-copy].pas-changed:hover,.pas-editing [data-copy].pas-changed:focus{background:#F3C613;color:#2A2100}',
    '.pas-editing [data-copy].pas-removed,.pas-editing [data-copy].pas-removed:hover,.pas-editing [data-copy].pas-removed:focus{background:#FBE0E0;color:#6B1F1F;text-decoration:line-through}',
    '.pas-editing .pas-revealed[hidden]{display:block!important}',
    '.pas-editing .panel.pas-revealed[hidden]{display:flex!important}',
    '.pas-editing .pas-revealed::before{content:attr(data-edit-reveal);display:block;font-size:.85rem;font-weight:700;margin-bottom:6px}',
    '.pas-editing .pas-revealed .actions{pointer-events:none;opacity:.5}',
    '.pas-bar{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#0B2140;color:#FFFFFF;border-top:4px solid #F3C613;padding:12px 20px calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;justify-content:space-between;font-family:var(--body);font-size:1rem;line-height:1.4}',
    '.pas-bar-actions{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center}',
    '.pas-btn{font:inherit;font-weight:700;border-radius:999px;padding:9px 18px;border:2px solid #F3C613;background:#F3C613;color:#2A2100;cursor:pointer}',
    '.pas-btn.quiet{background:transparent;border-color:var(--line);color:var(--ink)}',
    '.pas-bar .pas-btn.quiet{border-color:#FFFFFF;color:#FFFFFF}',
    '.pas-btn:disabled{opacity:.5;cursor:default}',
    '.pas-link{font:inherit;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer}',
    '.pas-veil{position:fixed;inset:0;z-index:60;background:rgba(7,21,39,.62);display:flex;align-items:flex-start;justify-content:center;padding:4vh 16px;overflow:auto}',
    '.pas-panel{background:var(--surface);color:var(--ink);border-radius:16px;padding:clamp(18px,4vw,28px);max-width:680px;width:100%;display:flex;flex-direction:column;gap:16px;font-family:var(--body)}',
    '.pas-panel h2{font-size:1.5rem}',
    '.pas-panel label{display:flex;flex-direction:column;gap:6px;font-weight:700}',
    '.pas-panel label.pas-pick{flex-direction:row;align-items:flex-start;gap:10px;font-weight:400}',
    '.pas-panel input[type=text],.pas-panel textarea{font:inherit;font-weight:400;width:100%;padding:12px 14px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg);color:var(--ink)}',
    '.pas-panel textarea{min-height:90px;resize:vertical}',
    '.pas-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px}',
    '.pas-list li{border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;align-items:flex-start;overflow-wrap:anywhere}',
    '.pas-list li.pas-out{opacity:.55}',
    '.pas-where{font-size:.85rem;color:var(--muted)}',
    '.pas-was{color:var(--muted);text-decoration:line-through}',
    '.pas-now{font-weight:700}',
    '.pas-gone{font-weight:700;color:#6B1F1F}',
    '.pas-warn{background:var(--warn);color:var(--warn-ink);border-radius:8px;padding:6px 10px;font-size:.93rem}',
    '.pas-row{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}',
    '.pas-msg{font-weight:700}',
    '.pas-muted{color:var(--muted);font-size:.93rem}',
  ].join('\n');
  document.head.appendChild(css);
  document.body.classList.add('pas-editing');

  // ----- make the copy editable -----
  // Text inside a button can't be typed into reliably, so in edit mode those buttons become plain look-alikes.
  all(document, 'button').forEach(function (b) {
    if (!b.querySelector('[data-copy]')) return;
    var s = el('span', b.className);
    while (b.firstChild) s.appendChild(b.firstChild);
    b.parentNode.replaceChild(s, b);
  });
  // Messages that normally appear only in some situations (an empty search, a shared board) are shown so they can be edited.
  all(document, '[data-edit-reveal]').forEach(function (n) { n.classList.add('pas-revealed'); });
  nodes.forEach(function (n) {
    n.setAttribute('contenteditable', 'plaintext-only');
    if (n.contentEditable !== 'plaintext-only') n.setAttribute('contenteditable', 'true');
    n.setAttribute('spellcheck', 'true');
    var a = n.closest('a');
    if (a) a.setAttribute('draggable', 'false');
    paint(n);
  });
  function target(e) { return e.target && e.target.closest ? e.target.closest('[data-copy][contenteditable]') : null; }

  // ----- the bar at the bottom of every page -----
  var bar = el('div', 'pas-bar');
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Copy editing');
  var status = el('span');
  status.setAttribute('aria-live', 'polite');
  var actions = el('span', 'pas-bar-actions');
  var reviewBtn = el('button', 'pas-btn', cfg.send ? 'Review and publish' : 'Review');
  reviewBtn.type = 'button';
  var removeBtn = el('button', 'pas-btn quiet', 'Remove this sentence');
  removeBtn.type = 'button'; removeBtn.hidden = true; removeBtn.id = 'pas-remove';
  var pagesLink = el('a', 'pas-link', 'All pages');
  pagesLink.href = cfg.home || '#';
  var stopBtn = el('button', 'pas-link', 'Stop editing');
  stopBtn.type = 'button';
  actions.appendChild(removeBtn); actions.appendChild(reviewBtn); actions.appendChild(pagesLink); actions.appendChild(stopBtn);
  bar.appendChild(status); bar.appendChild(actions);
  document.body.appendChild(bar);

  var hint = '';
  var current = null;   // the sentence last clicked, which "Remove this sentence" acts on
  function published() {
    var p = null;
    try { p = JSON.parse(get('pas-published') || 'null'); } catch (e) { p = null; }
    if (!p || Date.now() - p.at > 10 * 60 * 1000) return '';
    return 'Published ' + plural(p.n) + ' at ' + when(new Date(p.at).toISOString()) + '. The site updates in a few minutes. ';
  }
  function refresh() {
    var ids = Object.keys(edits), unsent = ids.filter(function (id) { return !edits[id].sent; }).length;
    status.textContent = hint || published() + (!ids.length ? 'Editing is on. Click any outlined text and type.'
      : unsent ? plural(unsent) + ' not published yet.'
      : plural(ids.length) + ' sent by email, waiting to be published.');
    reviewBtn.disabled = !ids.length;
    if (current) {
      var id = current.getAttribute('data-copy'), gone = edits[id] && edits[id].remove;
      removeBtn.hidden = false;
      removeBtn.textContent = gone ? 'Put this sentence back' : 'Remove this sentence';
    } else removeBtn.hidden = true;
  }
  refresh();
  stopBtn.addEventListener('click', function () { set('pas-edit', '0'); location.reload(); });
  removeBtn.addEventListener('click', function () {
    if (!current) return;
    var id = current.getAttribute('data-copy');
    if (edits[id] && edits[id].remove) delete edits[id];
    else edits[id] = { was: built[id], now: '', remove: true, page: where };
    save();
    nodes.forEach(function (o) { if (o.getAttribute('data-copy') === id) paint(o); });
    hint = edits[id] ? 'Marked to be taken off the page. It goes when you publish.' : '';
    refresh();
  });

  // ----- typing -----
  document.addEventListener('focusin', function (e) {
    var n = target(e);
    if (!n) return;
    current = n;
    if (n.hasAttribute('data-tpl')) { paint(n, true); hint = 'Words in {curly braces} are filled in for each page. Leave them in the sentence.'; }
    refresh();
  });
  document.addEventListener('input', function (e) {
    var n = target(e);
    if (!n) return;
    var id = n.getAttribute('data-copy'), text = clean(n.textContent);
    if (!text || text === built[id]) delete edits[id];
    else edits[id] = { was: built[id], now: text, page: where };
    save();
    n.classList.toggle('pas-changed', !!edits[id]);
    n.classList.remove('pas-removed');
    nodes.forEach(function (o) { if (o !== n && o.getAttribute('data-copy') === id) paint(o); });
    refresh();
  });
  document.addEventListener('focusout', function (e) {
    var n = target(e);
    if (!n) return;
    paint(n);   // tidy the spacing, put back text that was emptied, fill in the per-page words again
    hint = '';
    refresh();
  });
  document.addEventListener('keydown', function (e) {
    var n = target(e);
    if (n && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); n.blur(); }
  });
  document.addEventListener('paste', function (e) {
    var n = target(e);
    if (!n) return;
    e.preventDefault();
    var text = clean((e.clipboardData || window.clipboardData).getData('text'));
    if (text) document.execCommand('insertText', false, text);
  });
  document.addEventListener('drop', function (e) { if (target(e)) e.preventDefault(); });
  // Clicking editable words inside a link or a label puts the cursor there instead of following the link.
  document.addEventListener('click', function (e) {
    var n = target(e);
    if (n && n.closest('a, label, summary')) e.preventDefault();
  }, true);
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-edit-allow')) return;   // the sign-in form
    e.preventDefault();
    hint = 'Forms are switched off while you’re editing.';
    refresh();
  }, true);

  // ----- review, publish or send -----
  var veil = null;
  function asText(name, note) {
    var lines = ['Copy edits' + (name ? ' from ' + name : '') + ': ' + plural(Object.keys(edits).length) + '.', ''];
    if (note) lines.push('Note: ' + note, '');
    Object.keys(edits).forEach(function (id, i) {
      lines.push((i + 1) + '. On ' + edits[id].page, '   Was: ' + edits[id].was, '   Now: ' + (edits[id].remove ? '(taken off the page)' : edits[id].now), '   (id ' + id + ')', '');
    });
    return lines.join('\n');
  }
  function closeReview() {
    if (!veil) return;
    document.body.removeChild(veil);
    veil = null;
    reviewBtn.focus();
  }
  function openReview() {
    veil = el('div', 'pas-veil');
    var panel = el('div', 'pas-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'pas-title');
    panel.tabIndex = -1;
    var title = el('h2', null, 'Your changes');
    title.id = 'pas-title';
    var list = el('ol', 'pas-list');
    var picked = {};   // id -> included in this publish
    var nameBox = el('input'); nameBox.type = 'text'; nameBox.maxLength = 60; nameBox.value = get('pas-edit-name') || ''; nameBox.autocomplete = 'given-name';
    var nameLabel = el('label', null, 'Your name'); nameLabel.appendChild(nameBox);
    var noteBox = el('textarea'); noteBox.maxLength = 1000;
    var noteLabel = el('label', null, 'Anything to add? (optional, for the email)'); noteLabel.appendChild(noteBox);
    var trap = el('input'); trap.type = 'text'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.setAttribute('aria-hidden', 'true');
    trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px';
    var publish = el('button', 'pas-btn'); publish.type = 'button'; publish.id = 'pas-publish';
    var send = el('button', 'pas-btn quiet'); send.type = 'button'; send.id = 'pas-send';
    var back = el('button', 'pas-link', 'Keep editing'); back.type = 'button';
    var wipe = el('button', 'pas-link', 'Undo everything'); wipe.type = 'button';
    var row = el('div', 'pas-row'); row.appendChild(publish); row.appendChild(send); row.appendChild(back); row.appendChild(wipe);
    var msg = el('p', 'pas-msg'); msg.setAttribute('aria-live', 'polite');
    var fallback = el('div', 'pas-row'); fallback.hidden = true;
    var raw = el('textarea'); raw.readOnly = true; raw.setAttribute('aria-label', 'Your changes as text'); raw.style.minHeight = '160px';
    var copyBtn = el('button', 'pas-btn quiet', 'Copy the changes'); copyBtn.type = 'button';
    var mail = el('a', 'pas-link', cfg.contact ? 'Email them to ' + cfg.contact : '');
    fallback.appendChild(raw); fallback.appendChild(copyBtn); if (cfg.contact) fallback.appendChild(mail);

    var chosen = function () { return Object.keys(edits).filter(function (id) { return picked[id] !== false; }); };
    var draw = function () {
      var ids = Object.keys(edits);
      list.textContent = '';
      ids.forEach(function (id) {
        var e = edits[id], li = el('li');
        if (picked[id] === false) li.classList.add('pas-out');
        var pick = el('label', 'pas-pick'), cb = el('input'); cb.type = 'checkbox'; cb.checked = picked[id] !== false; cb.className = 'pas-cb';
        cb.addEventListener('change', function () { picked[id] = cb.checked; li.classList.toggle('pas-out', !cb.checked); count(); });
        pick.appendChild(cb); pick.appendChild(el('span', 'pas-where', 'On ' + e.page + (e.sent ? ' · sent by email, waiting to be published' : '')));
        li.appendChild(pick);
        li.appendChild(el('span', 'pas-was', e.was));
        li.appendChild(e.remove ? el('span', 'pas-gone', 'Taken off the page') : el('span', 'pas-now', e.now));
        if (!e.remove) tokens(e.was).forEach(function (t) {
          if (e.now.indexOf(t) < 0) li.appendChild(el('span', 'pas-warn', 'The original has ' + t + ', which becomes the right word on each page. Without it, this sentence reads the same everywhere.'));
        });
        var undo = el('button', 'pas-link', 'Undo this change'); undo.type = 'button';
        undo.addEventListener('click', function () {
          delete edits[id]; save();
          nodes.forEach(function (o) { if (o.getAttribute('data-copy') === id) paint(o); });
          draw(); refresh();
        });
        li.appendChild(undo);
        list.appendChild(li);
      });
      count();
      wipe.hidden = !ids.length;
      wipe.textContent = 'Undo everything';
      wipe.removeAttribute('data-armed');
      if (!ids.length) list.appendChild(el('li', null, 'No changes yet. Close this and click any outlined text to edit it.'));
    };
    var count = function () {
      var n = chosen().length;
      publish.textContent = n ? 'Publish ' + plural(n) : 'Nothing picked';
      publish.disabled = !n || !cfg.send;
      send.textContent = n ? 'Send by email instead' : 'Nothing to send';
      send.disabled = !n;
    };
    var showFallback = function (why) {
      msg.textContent = why + ' Copy the changes below and send them yourself.';
      raw.value = asText(clean(nameBox.value), clean(noteBox.value));
      var body = raw.value.length < 1500 ? '&body=' + encodeURIComponent(raw.value) : '';
      if (cfg.contact) mail.href = 'mailto:' + cfg.contact + '?subject=' + encodeURIComponent('Copy edits') + body;
      fallback.hidden = false;
    };
    var signedOut = function (verb) {
      draw();
      msg.textContent = 'You’re signed out, so nothing was ' + verb + '. Your changes are still saved here. ';
      var again = el('a', null, 'Sign in again');
      again.href = cfg.home || '#';
      msg.appendChild(again);
      msg.appendChild(document.createTextNode(', then come back.'));
    };
    var payload = function (ids) {
      return ids.map(function (id) { return edits[id].remove ? { id: id, remove: true, page: edits[id].page } : { id: id, now: edits[id].now, page: edits[id].page }; });
    };
    publish.addEventListener('click', function () {
      var ids = chosen(), name = clean(nameBox.value);
      if (!ids.length) return;
      set('pas-edit-name', name);
      fallback.hidden = true;
      if (!cfg.send || !window.fetch) { showFallback('Publishing isn’t available here.'); return; }
      publish.disabled = true; send.disabled = true;
      msg.textContent = 'Publishing…';
      post({ action: 'publish', name: name, company: trap.value, edits: payload(ids) }).then(function (res) {
        if (res.status === 401) { signedOut('published'); return; }
        if (!res.ok) {
          draw();
          if (res.data && res.data.ready === false) showFallback(res.message);
          else msg.textContent = res.message || 'That didn’t publish.';
          return;
        }
        ids.forEach(function (id) { delete edits[id]; });
        save();
        set('pas-published', JSON.stringify({ at: Date.now(), n: ids.length }));
        draw(); refresh();
        msg.textContent = res.message || 'Published.';
        if (res.data && res.data.url) { msg.appendChild(document.createTextNode(' ')); var a = el('a', null, 'See the commit'); a.href = res.data.url; a.target = '_blank'; a.rel = 'noopener'; msg.appendChild(a); }
      }).catch(function () { draw(); msg.textContent = 'That didn’t publish. Check your connection and try again.'; });
    });
    send.addEventListener('click', function () {
      var ids = chosen(), name = clean(nameBox.value), note = clean(noteBox.value);
      if (!ids.length) return;
      set('pas-edit-name', name);
      fallback.hidden = true;
      if (!cfg.send || !window.fetch) { showFallback('Sending isn’t available here.'); return; }
      send.disabled = true; publish.disabled = true;
      msg.textContent = 'Sending…';
      post({ action: 'send', name: name, note: note, company: trap.value, edits: payload(ids) }).then(function (res) {
        if (res.status === 401) { signedOut('sent'); return; }
        if (!res.ok) { draw(); showFallback(res.message || 'That didn’t send.'); return; }
        ids.forEach(function (id) { if (edits[id]) edits[id].sent = true; });
        save(); draw(); refresh();
        msg.textContent = 'Sent. Your changes appear on the site once they’re approved and published.';
      }).catch(function () { draw(); showFallback('That didn’t send.'); });
    });
    back.addEventListener('click', closeReview);
    wipe.addEventListener('click', function () {
      if (!wipe.getAttribute('data-armed')) { wipe.setAttribute('data-armed', '1'); wipe.textContent = 'Tap again to undo every change'; return; }
      edits = {}; save();
      nodes.forEach(function (o) { paint(o); });
      draw(); refresh();
    });
    copyBtn.addEventListener('click', function () {
      var done = function () { msg.textContent = 'Copied. Paste it into an email or a text.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(raw.value).then(done, function () { raw.focus(); raw.select(); });
      else { raw.focus(); raw.select(); }
    });
    veil.addEventListener('click', function (e) { if (e.target === veil) closeReview(); });

    panel.appendChild(title);
    panel.appendChild(el('p', 'pas-muted', 'Untick a change to leave it out. Publishing puts the ticked changes on the site within a few minutes; every publish is kept as a version you can go back to from the edit page.'));
    panel.appendChild(list); panel.appendChild(nameLabel); panel.appendChild(noteLabel); panel.appendChild(trap);
    panel.appendChild(row); panel.appendChild(msg); panel.appendChild(fallback);
    veil.appendChild(panel);
    document.body.appendChild(veil);
    draw();
    panel.focus();
  }
  reviewBtn.addEventListener('click', function () { if (!veil) openReview(); });
  document.addEventListener('keydown', function (e) { if (veil && e.key === 'Escape') closeReview(); });
})();
