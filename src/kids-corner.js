// Kid's Corner: a page of each child's own, inside a parent's account (kidsPage() in build.mjs). For ages about 5 to 10:
// shiny pins that level up from bronze to silver to gold, a level that climbs, a cartoon map of Philadelphia whose
// clouds clear over the neighborhoods the child has been to, and a battle where each program's monster takes on
// another and the child taps the winner (which ranks their favorites for the planners). Each child picks a monster of
// their own to be. What counts is what a parent has confirmed (the "passport" endpoint in groups/api.php): the page
// suggests from the household's plans, and the parent says yes or no behind the grown-ups' hold-to-open button.
//
// Kid mode: while a child is holding the phone the site's header, menu and footer are hidden, nothing on the page is
// typed, and no link leaves the site. Nothing on this page is counted, recorded or sent anywhere but the household's
// own account. Every picture (monsters, pins, the map and its landmarks) is drawn here as SVG, and every sound is made
// here with the Web Audio API: nothing is fetched from anywhere but this site. Sounds play only after a tap, and the
// mute button is remembered on the device.
(function () {
  'use strict';
  var root = document.getElementById('kc');
  if (!root || !window.fetch || !window.Promise) return;
  var D = JSON.parse(document.getElementById('kc-data').textContent);
  var API = root.getAttribute('data-api') || '';
  var app = document.getElementById('kc-app'), outBox = document.getElementById('kc-out'), waitEl = document.getElementById('kc-wait');
  var html = document.documentElement;
  var CALM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ----- small helpers -----
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  var btn = function (cls, text, go) { var b = el('button', cls, text); b.type = 'button'; if (go) b.addEventListener('click', go); return b; };
  var NS = 'http://www.w3.org/2000/svg';
  var sv = function (tag, at, parent) { var e = document.createElementNS(NS, tag); if (at) for (var k in at) if (Object.prototype.hasOwnProperty.call(at, k) && at[k] !== undefined && at[k] !== null) e.setAttribute(k, at[k]); if (parent) parent.appendChild(e); return e; };
  var icon = function (path, color, cls) { var s = sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', 'class': cls }); sv('path', { d: path, fill: color || 'currentColor' }, s); return s; };
  var possessive = function (n) { return /s$/i.test(n) ? n + '’' : n + '’s'; };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };
  var signedIn = function () { return store.get('pas-in') === '1'; };
  var call = function (action, body) {
    var o = { credentials: 'same-origin', headers: { 'X-PAS': '1' } };
    if (body) { o.method = 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return window.fetch(API + '?action=' + action, o).then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: 'offline', message: 'Couldn’t reach the site just now. Check the connection and try again.' }; });
  };
  var imul = Math.imul || function (a, b) { return (a * (b & 0xffff) + ((a * (b >>> 16)) << 16)) | 0; };
  var hash = function (str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = imul(h, 16777619); } return h >>> 0; };
  var rng = function (seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = imul(t ^ (t >>> 15), t | 1); t ^= t + imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  var pick = function (list) { return list[Math.floor(Math.random() * list.length)]; };
  var wait = function (ms) { return new Promise(function (res) { setTimeout(res, CALM ? Math.min(ms, 120) : ms); }); };
  var anim = function (node, frames, opts) {
    if (!node || !node.animate || CALM) return Promise.resolve();
    var a; try { a = node.animate(frames, opts); } catch (e) { return Promise.resolve(); }
    return new Promise(function (res) { a.onfinish = res; a.oncancel = res; });
  };
  var listing = function (k) { return D.listings[k] || null; };
  var nameOf = function (k) { var l = listing(k); return l ? l.n : k.replace(/^[pc]:/, ''); };
  var yearLabel = function (e) { return e.kind === 'summer' ? 'Summer ' + e.y : e.y + '–' + String(e.y + 1).slice(2); };

  // Where a confirmed class was: the listing's one site, the site the parent picked when it has several, or the
  // school for a program inside a school. A listing with several sites and no pick places nothing.
  var siteOf = function (e) {
    var l = listing(e.k); if (!l) return null;
    var i;
    if (e.h) for (i = 0; i < l.sites.length; i++) if (l.sites[i].h === e.h) return l.sites[i];
    if (l.sites.length === 1) return l.sites[0];
    var s = e.s && D.schools[e.s], sh = s && s.h && s.h.length ? s.h : [];
    if (sh.length) {
      for (i = 0; i < l.sites.length; i++) if (sh.indexOf(l.sites[i].h) > -1) return l.sites[i];
      if (!l.sites.length) return { h: sh[0], ll: s.ll || null, m: s.m || null };
    }
    return null;
  };
  var needsSite = function (e) { var l = listing(e.k); return !!l && l.sites.length > 1 && !siteOf(e); };

  // ----- sounds, made here: nothing plays until the first tap, and the mute button is remembered -----
  var Sound = (function () {
    var ctx = null, muted = store.get('kc-mute') === '1', tried = false;
    var unlock = function () {
      if (tried) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
      tried = true;
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { ctx = new AC(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { ctx = null; }
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    var tone = function (f, t, dur, type, vol, to) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.05);
    };
    var noise = function (t, dur, vol, from, to) {
      var n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      var s = ctx.createBufferSource(); s.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(from || 1000, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
      var g = ctx.createGain(); g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(t); s.stop(t + dur);
    };
    var SFX = {
      tap: function (t) { tone(660, t, 0.07, 'triangle', 0.1, 990); },
      pop: function (t) { tone(280, t, 0.14, 'sine', 0.28, 920); },
      sparkle: function (t) { [1319, 1568, 1976, 2637, 3136].forEach(function (f, i) { tone(f, t + i * 0.065, 0.3, 'triangle', 0.07); }); },
      roar: function (t) { tone(150, t, 0.55, 'sawtooth', 0.1, 60); noise(t, 0.5, 0.18, 500, 140); },
      pow: function (t) { noise(t, 0.22, 0.45, 2000, 300); tone(170, t, 0.18, 'square', 0.13, 45); },
      whoosh: function (t) { noise(t, 0.3, 0.16, 350, 2600); },
      boing: function (t) { tone(200, t, 0.32, 'sine', 0.22, 700); },
      ko: function (t) { tone(700, t, 0.7, 'triangle', 0.13, 70); },
      fanfare: function (t) { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.12, i === 3 ? 0.7 : 0.15, 'square', 0.08); }); [1047, 1319].forEach(function (f) { tone(f, t + 0.36, 0.7, 'triangle', 0.06); }); },
      levelup: function (t) { [392, 523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone(f, t + i * 0.085, 0.32, 'triangle', 0.11); }); },
      cheer: function (t) { noise(t, 0.9, 0.08, 1400, 2600); tone(880, t, 0.2, 'triangle', 0.06, 1320); }
    };
    return {
      play: function (name) { if (muted || !ctx || !SFX[name]) return; try { if (ctx.state === 'suspended') ctx.resume(); SFX[name](ctx.currentTime + 0.02); } catch (e) { /* no sound here */ } },
      muted: function () { return muted; },
      toggle: function () { muted = !muted; store.set('kc-mute', muted ? '1' : '0'); return muted; }
    };
  })();

  // ----- monsters: one family for each kind of program, every program a little different -----
  var INK = '#26134A';
  var hsl = function (h, s, l) { return 'hsl(' + ((((Math.round(h)) % 360) + 360) % 360) + ',' + s + '%,' + l + '%)'; };
  // Each body: its outline, how high its top is ("top"), where the eyes sit ("eye") and how wide it is there ("w").
  var BODY = {
    blob: { d: 'M14 72C10 42 28 24 50 24C72 24 90 42 86 72C84 88 70 95 50 95C30 95 16 88 14 72Z', top: 24, eye: 50, w: 32 },
    tall: { d: 'M27 42C27 14 73 14 73 42L75 84C75 92 66 95 50 95C34 95 25 92 25 84Z', top: 17, eye: 42, w: 21 },
    box: { d: 'M19 36Q19 25 30 25H70Q81 25 81 36L83 84Q83 95 72 95H28Q17 95 17 84Z', top: 25, eye: 47, w: 29 },
    pear: { d: 'M50 22C63 22 67 34 68 45C84 54 88 74 82 85C77 93 65 95 50 95C35 95 23 93 18 85C12 74 16 54 32 45C33 34 37 22 50 22Z', top: 22, eye: 52, w: 25, armY: 72 },
    ghost: { d: 'M20 52C20 29 33 18 50 18C67 18 80 29 80 52V93L71 86L61 94L50 86L39 94L29 86L20 93Z', top: 18, eye: 46, w: 27, feet: false },
    spiky: { d: 'M16 66C16 44 31 30 50 30C69 30 84 44 84 66C84 85 70 95 50 95C30 95 16 85 16 66Z', spikes: 'M24 44L24 24L36 34L42 16L50 30L58 16L64 34L76 24L76 44Z', top: 24, eye: 56, w: 30 },
    bean: { d: 'M31 31C41 16 67 19 72 37C75 48 69 55 73 66C79 85 67 95 50 95C30 95 18 85 22 67C25 54 22 42 31 31Z', top: 21, eye: 44, w: 21 },
    squid: { d: 'M18 57C18 33 32 20 50 20C68 20 82 33 82 57C82 67 78 73 72 75H28C22 73 18 67 18 57Z', legs: 'M28 72C26 82 20 86 22 92C26 96 31 88 35 80C37 88 38 96 44 95C47 90 45 84 45 74H55C55 84 53 90 56 95C62 96 63 88 65 80C69 88 74 96 78 92C80 86 74 82 72 72Z', top: 20, eye: 46, w: 28, feet: false, armY: 56 },
    egg: { d: 'M50 18C68 18 82 46 82 68C82 85 68 95 50 95C32 95 18 85 18 68C18 46 32 18 50 18Z', top: 18, eye: 52, w: 27 },
    fuzzy: { d: 'M50 23L56 19L60 25L67 22L69 29L76 29L76 36L83 39L80 45L86 50L81 55L86 61L80 65L84 72L77 75L79 82L71 83L70 90L63 88L59 94L52 90L46 95L41 89L34 92L32 85L24 86L24 79L17 76L21 70L14 65L20 60L14 54L20 49L16 42L23 39L22 32L30 31L31 24L38 26L42 20Z', top: 21, eye: 50, w: 28 }
  };
  var BODY_IDS = ['blob', 'tall', 'box', 'pear', 'ghost', 'spiky', 'bean', 'squid', 'egg', 'fuzzy'];
  var COLORS = [355, 22, 46, 95, 140, 175, 205, 250, 285, 320];   // the colors a child picks from
  // The families: a body, a color, something to wear, and what they throw when they win.
  var SPECIES = {
    aftercare: { body: 'box', hue: 210, acc: 'backpack', atk: 'plane' },
    music: { body: 'blob', hue: 275, acc: 'headphones', atk: 'note' },
    theater: { body: 'tall', hue: 345, acc: 'tophat', atk: 'star' },
    art: { body: 'pear', hue: 24, acc: 'beret', atk: 'splat' },
    movement: { body: 'bean', hue: 130, acc: 'headband', atk: 'swirl' },
    stem: { body: 'squid', hue: 178, acc: 'goggles', atk: 'bolt' },
    academics: { body: 'egg', hue: 45, acc: 'gradcap', atk: 'letter' },
    games: { body: 'spiky', hue: 315, acc: 'propeller', atk: 'die' },
    nature: { body: 'fuzzy', hue: 95, acc: 'sprout', atk: 'leaf' },
    daycamp: { body: 'ghost', hue: 232, acc: 'ranger', atk: 'flame' },
    clubs: { body: 'blob', hue: 195, acc: 'partyhat', atk: 'confetti' },
    'rec-center': { body: 'tall', hue: 12, acc: 'ballcap', atk: 'ball' },
    _: { body: 'blob', hue: 262, acc: '', atk: 'star' }
  };
  var speciesOf = function (key) { var l = listing(key), t = l && l.t && l.t.length ? l.t[0] : ''; return SPECIES[t] ? t : '_'; };
  var monsterFor = function (key) {
    var sp = SPECIES[speciesOf(key)], r = rng(hash(key));
    return { body: sp.body, hue: sp.hue + (r() * 44 - 22), sat: 68 + Math.round(r() * 22), light: sp.body === 'ghost' ? 74 : 54 + Math.round(r() * 12), eyes: 1 + Math.floor(r() * 3), horns: Math.floor(r() * 5), mouth: Math.floor(r() * 4), spots: r() < 0.5, blush: r() < 0.35, acc: sp.acc, atk: sp.atk };
  };
  var kidMonster = function (av) {
    var b = av && BODY[av.b] ? av.b : 'blob', c = av && COLORS[av.c] !== undefined ? av.c : 6;
    return { body: b, hue: COLORS[c], sat: 82, light: b === 'ghost' ? 72 : 60, eyes: 2, horns: b === 'spiky' || b === 'fuzzy' ? 0 : 1, mouth: 0, spots: false, blush: true, acc: 'crown', atk: 'star' };
  };
  var uid = 0;
  var drawMonster = function (m, cls) {
    var b = BODY[m.body] || BODY.blob, id = 'kcm' + (++uid), T = b.top, ey = b.eye, w = b.w;
    var main = hsl(m.hue, m.sat, m.light), dark = hsl(m.hue, m.sat, m.light - 17), light = hsl(m.hue, m.sat, Math.min(m.light + 24, 94));
    var s = sv('svg', { viewBox: '0 -12 100 112', 'class': 'kc-mon' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', focusable: 'false' });
    var cp = sv('clipPath', { id: id }, sv('defs', null, s)); sv('path', { d: b.d }, cp);
    var g = sv('g', { 'class': 'kc-mon-g' }, s);
    var ink = function (o, width) { o.stroke = INK; o['stroke-width'] = width || 3; o['stroke-linejoin'] = 'round'; o['stroke-linecap'] = 'round'; return o; };
    var ay = b.armY || 66;
    sv('ellipse', ink({ cx: 16, cy: ay, rx: 6, ry: 10, fill: main, transform: 'rotate(28 16 ' + ay + ')' }), g);
    sv('ellipse', ink({ cx: 84, cy: ay, rx: 6, ry: 10, fill: main, transform: 'rotate(-28 84 ' + ay + ')' }), g);
    // horns sit behind the head
    var hx = Math.min(16, w * 0.62), cream = '#FFF1C9';
    if (m.horns === 1) { sv('path', ink({ d: 'M' + (50 - hx - 6) + ' ' + (T + 9) + 'L' + (50 - hx - 9) + ' ' + (T - 12) + 'L' + (50 - hx + 6) + ' ' + (T + 5) + 'Z', fill: cream }), g); sv('path', ink({ d: 'M' + (50 + hx + 6) + ' ' + (T + 9) + 'L' + (50 + hx + 9) + ' ' + (T - 12) + 'L' + (50 + hx - 6) + ' ' + (T + 5) + 'Z', fill: cream }), g); }
    if (m.horns === 2) {
      [-1, 1].forEach(function (sd) {
        var x = 50 + sd * hx, d = 'M' + x + ' ' + (T + 6) + 'C' + (x + sd * 12) + ' ' + (T + 4) + ' ' + (x + sd * 16) + ' ' + (T - 9) + ' ' + (x + sd * 8) + ' ' + (T - 12) + 'C' + (x + sd * 2) + ' ' + (T - 14) + ' ' + (x) + ' ' + (T - 7) + ' ' + (x + sd * 5) + ' ' + (T - 6);
        sv('path', { d: d, fill: 'none', stroke: INK, 'stroke-width': 10, 'stroke-linecap': 'round' }, g);
        sv('path', { d: d, fill: 'none', stroke: cream, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
      });
    }
    if (m.horns === 3) {
      [-1, 1].forEach(function (sd) {
        var x = 50 + sd * (hx - 4);
        sv('path', { d: 'M' + x + ' ' + (T + 6) + 'L' + (x + sd * 8) + ' ' + (T - 14), stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
        sv('circle', ink({ cx: x + sd * 8, cy: T - 16, r: 5, fill: hsl(m.hue + 180, 85, 62) }, 2.5), g);
      });
    }
    if (m.horns === 4) { sv('path', ink({ d: 'M44 ' + (T + 6) + 'L50 ' + (T - 20) + 'L56 ' + (T + 6) + 'Z', fill: '#FFE066' }), g); sv('path', { d: 'M46 ' + (T - 2) + 'L54 ' + (T - 5) + 'M47.5 ' + (T - 9) + 'L52.5 ' + (T - 11), stroke: INK, 'stroke-width': 1.6 }, g); }
    if (b.spikes) sv('path', ink({ d: b.spikes, fill: dark }), g);
    if (b.legs) sv('path', ink({ d: b.legs, fill: dark }), g);
    sv('path', { d: b.d, fill: main }, g);
    var inner = sv('g', { 'clip-path': 'url(#' + id + ')' }, g);
    sv('ellipse', { cx: 50, cy: 86, rx: 26, ry: 17, fill: light, opacity: 0.6 }, inner);
    if (m.spots) [[28, 64, 4.5], [72, 60, 3.5], [66, 82, 3], [33, 84, 3.2], [58, ey - 14, 2.6]].forEach(function (p) { sv('circle', { cx: p[0], cy: p[1], r: p[2], fill: dark, opacity: 0.55 }, inner); });
    if (m.acc === 'headband') { sv('rect', { x: 0, y: ey - 19, width: 100, height: 8, fill: '#fff' }, inner); sv('rect', { x: 0, y: ey - 16.5, width: 100, height: 3, fill: '#E8590C' }, inner); }
    if (m.acc === 'goggles') sv('rect', { x: 0, y: T + 7, width: 100, height: 6, fill: INK }, inner);
    if (m.acc === 'backpack') { sv('rect', { x: 50 - w * 0.62 - 3, y: ey + 8, width: 7, height: 60, fill: '#FFD43B' }, inner); sv('rect', { x: 50 + w * 0.62 - 4, y: ey + 8, width: 7, height: 60, fill: '#FFD43B' }, inner); }
    sv('path', ink({ d: b.d, fill: 'none' }), g);
    if (b.feet !== false) { sv('ellipse', ink({ cx: 36, cy: 95, rx: 9, ry: 5, fill: dark }, 2.5), g); sv('ellipse', ink({ cx: 64, cy: 95, rx: 9, ry: 5, fill: dark }, 2.5), g); }
    // eyes, in a group that blinks
    var sc = Math.min(1, w / 27), ex;
    if (m.eyes === 1) ex = [[50, ey, 12 * sc + 1]];
    else if (m.eyes === 2) ex = [[50 - w * 0.42, ey, 9.5 * sc], [50 + w * 0.42, ey, 9.5 * sc]];
    else ex = [[50 - w * 0.6, ey + 2, 7.2 * sc], [50, ey - 5, 8.4 * sc], [50 + w * 0.6, ey + 2, 7.2 * sc]];
    var eg = sv('g', { 'class': 'kc-eyes' }, g);
    ex.forEach(function (e) {
      sv('circle', { cx: e[0], cy: e[1], r: e[2], fill: '#fff', stroke: INK, 'stroke-width': 2.5 }, eg);
      sv('circle', { 'class': 'kc-pupil', cx: e[0] + e[2] * 0.22, cy: e[1] + e[2] * 0.12, r: e[2] * 0.5, fill: INK }, eg);
      sv('circle', { cx: e[0] + e[2] * 0.02, cy: e[1] - e[2] * 0.25, r: e[2] * 0.2, fill: '#fff' }, eg);
    });
    if (m.acc === 'gradcap') {   // glasses go with the cap
      ex.forEach(function (e) { sv('circle', { cx: e[0], cy: e[1], r: e[2] + 3, fill: 'none', stroke: INK, 'stroke-width': 2.4 }, g); });
      for (var i = 0; i + 1 < ex.length; i++) sv('path', { d: 'M' + (ex[i][0] + ex[i][2] + 3) + ' ' + ex[i][1] + 'L' + (ex[i + 1][0] - ex[i + 1][2] - 3) + ' ' + ex[i + 1][1], stroke: INK, 'stroke-width': 2.4 }, g);
    }
    // mouth
    var my = ey + (m.eyes === 1 ? 21 : 17), mw = Math.min(14, w * 0.55);
    if (m.mouth === 0) { sv('path', ink({ d: 'M' + (50 - mw) + ' ' + my + 'Q50 ' + (my + 16) + ' ' + (50 + mw) + ' ' + my + 'Z', fill: INK }, 2), g); sv('path', { d: 'M' + (50 - mw + 4) + ' ' + (my + 0.5) + 'L' + (50 - mw + 7) + ' ' + (my + 6) + 'L' + (50 - mw + 10) + ' ' + (my + 1.5) + 'ZM' + (50 + mw - 4) + ' ' + (my + 0.5) + 'L' + (50 + mw - 7) + ' ' + (my + 6) + 'L' + (50 + mw - 10) + ' ' + (my + 1.5) + 'Z', fill: '#fff' }, g); }
    if (m.mouth === 1) { sv('ellipse', ink({ cx: 50, cy: my + 5, rx: 7, ry: 8.5, fill: INK }, 2), g); sv('ellipse', { cx: 50, cy: my + 9.5, rx: 4.5, ry: 3, fill: '#FF6B8B' }, g); }
    if (m.mouth === 2) { sv('path', ink({ d: 'M' + (50 - mw) + ' ' + my + 'H' + (50 + mw) + 'Q' + (50 + mw - 3) + ' ' + (my + 12) + ' 50 ' + (my + 12) + 'Q' + (50 - mw + 3) + ' ' + (my + 12) + ' ' + (50 - mw) + ' ' + my + 'Z', fill: INK }, 2), g); sv('rect', { x: 50 - mw + 3, y: my + 0.5, width: 2 * mw - 6, height: 3.5, fill: '#fff' }, g); }
    if (m.mouth === 3) { sv('path', { d: 'M' + (50 - mw * 0.6) + ' ' + (my + 1) + 'Q50 ' + (my + 9) + ' ' + (50 + mw * 0.6) + ' ' + (my + 1), fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }, g); sv('rect', { x: 52, y: my + 4, width: 4, height: 4, fill: '#fff', stroke: INK, 'stroke-width': 1.2 }, g); }
    if (m.blush) { sv('ellipse', { cx: 50 - w * 0.7, cy: my - 2, rx: 4.5, ry: 2.6, fill: '#FF6B8B', opacity: 0.5 }, g); sv('ellipse', { cx: 50 + w * 0.7, cy: my - 2, rx: 4.5, ry: 2.6, fill: '#FF6B8B', opacity: 0.5 }, g); }
    // what they wear
    var a = m.acc;
    if (a === 'headphones') {
      var hd = 'M' + (50 - w - 3) + ' ' + ey + 'C' + (50 - w - 3) + ' ' + (T - 16) + ' ' + (50 + w + 3) + ' ' + (T - 16) + ' ' + (50 + w + 3) + ' ' + ey;
      sv('path', { d: hd, fill: 'none', stroke: INK, 'stroke-width': 8, 'stroke-linecap': 'round' }, g); sv('path', { d: hd, fill: 'none', stroke: '#FF4D6D', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
      sv('rect', ink({ x: 50 - w - 9, y: ey - 9, width: 12, height: 19, rx: 5, fill: '#FF4D6D' }, 2.5), g); sv('rect', ink({ x: 50 + w - 3, y: ey - 9, width: 12, height: 19, rx: 5, fill: '#FF4D6D' }, 2.5), g);
    }
    if (a === 'tophat') { var th = sv('g', { transform: 'rotate(-10 50 ' + T + ')' }, g); sv('rect', { x: 30, y: T - 5, width: 40, height: 6, rx: 3, fill: INK }, th); sv('rect', { x: 37, y: T - 28, width: 26, height: 24, rx: 2, fill: INK }, th); sv('rect', { x: 37, y: T - 10, width: 26, height: 5, fill: '#E03131' }, th); }
    if (a === 'beret') { sv('ellipse', ink({ cx: 56, cy: T + 1, rx: 20, ry: 7.5, fill: '#E03131' }, 2.5), g); sv('circle', ink({ cx: 58, cy: T - 7, r: 3, fill: '#E03131' }, 2), g); }
    if (a === 'goggles') [-1, 1].forEach(function (sd) { sv('circle', ink({ cx: 50 + sd * w * 0.42, cy: T + 10, r: 8, fill: '#A5ECFF' }, 3), g); sv('path', { d: 'M' + (50 + sd * w * 0.42 - 4) + ' ' + (T + 7) + 'l3 -2', stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g); });
    if (a === 'gradcap') { sv('rect', { x: 40, y: T - 3, width: 20, height: 7, fill: INK }, g); sv('path', { d: 'M28 ' + (T - 3) + 'L50 ' + (T - 12) + 'L72 ' + (T - 3) + 'L50 ' + (T + 6) + 'Z', fill: INK }, g); sv('path', { d: 'M50 ' + (T - 3) + 'L68 ' + (T + 2) + 'L68 ' + (T + 12), fill: 'none', stroke: '#FFD43B', 'stroke-width': 2 }, g); sv('circle', { cx: 68, cy: T + 13, r: 2.6, fill: '#FFD43B' }, g); }
    if (a === 'propeller') {
      sv('path', ink({ d: 'M35 ' + (T + 7) + 'A15 13 0 0 1 65 ' + (T + 7) + 'Z', fill: '#FFD43B' }, 2.5), g);
      sv('path', { d: 'M50 ' + (T - 5) + 'V' + (T + 7), stroke: '#4DABF7', 'stroke-width': 4 }, g);
      sv('rect', { x: 49, y: T - 13, width: 2, height: 8, fill: INK }, g);
      var pr = sv('g', { 'class': 'kc-prop', style: 'transform-origin:50px ' + (T - 13) + 'px' }, g);
      sv('ellipse', ink({ cx: 42, cy: T - 13, rx: 8, ry: 3, fill: '#FF4D6D' }, 1.8), pr); sv('ellipse', ink({ cx: 58, cy: T - 13, rx: 8, ry: 3, fill: '#4DABF7' }, 1.8), pr);
    }
    if (a === 'sprout') {
      sv('path', { d: 'M50 ' + (T + 3) + 'Q48 ' + (T - 5) + ' 50 ' + (T - 11), fill: 'none', stroke: '#2B8A3E', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      var lf = 'M50 ' + (T - 10) + 'C42 ' + (T - 21) + ' 32 ' + (T - 15) + ' 34 ' + (T - 7) + 'C40 ' + (T - 4) + ' 46 ' + (T - 6) + ' 50 ' + (T - 10) + 'Z';
      sv('path', ink({ d: lf, fill: '#51CF66' }, 2), g); sv('path', ink({ d: lf, fill: '#51CF66', transform: 'translate(100 0) scale(-1 1)' }, 2), g);
    }
    if (a === 'ranger') { sv('path', ink({ d: 'M37 ' + (T + 4) + 'Q38 ' + (T - 15) + ' 50 ' + (T - 13) + 'Q62 ' + (T - 15) + ' 63 ' + (T + 4) + 'Z', fill: '#C9A06A' }, 2.5), g); sv('ellipse', ink({ cx: 50, cy: T + 4, rx: 27, ry: 5, fill: '#C9A06A' }, 2.5), g); sv('path', { d: 'M38 ' + (T - 1) + 'H62', stroke: '#7B4F2A', 'stroke-width': 3 }, g); }
    if (a === 'partyhat') { sv('path', ink({ d: 'M38 ' + (T + 7) + 'L50 ' + (T - 24) + 'L62 ' + (T + 7) + 'Z', fill: '#FF6FB5' }, 2.5), g); sv('path', { d: 'M42 ' + (T - 3) + 'L56 ' + (T - 8) + 'M40 ' + (T + 4) + 'L59 ' + (T - 2), stroke: '#FFD43B', 'stroke-width': 3 }, g); sv('circle', ink({ cx: 50, cy: T - 25, r: 4.5, fill: '#FFD43B' }, 2), g); }
    if (a === 'ballcap') { sv('path', ink({ d: 'M' + (50 + 12) + ' ' + (T + 6) + 'Q' + (50 + 32) + ' ' + (T + 3) + ' ' + (50 + 33) + ' ' + (T + 10) + 'Q' + (50 + 22) + ' ' + (T + 12) + ' ' + (50 + 12) + ' ' + (T + 10) + 'Z', fill: '#B8001F' }, 2.5), g); sv('path', ink({ d: 'M33 ' + (T + 9) + 'A17 15 0 0 1 67 ' + (T + 9) + 'Z', fill: '#E03131' }, 2.5), g); sv('circle', { cx: 50, cy: T - 6, r: 2.5, fill: INK }, g); }
    if (a === 'backpack') sv('rect', ink({ x: 44, y: ey + 22, width: 12, height: 8, rx: 2, fill: '#FFD43B' }, 2), g);
    if (a === 'crown') { sv('path', ink({ d: 'M36 ' + (T + 4) + 'L35 ' + (T - 12) + 'L43 ' + (T - 4) + 'L50 ' + (T - 16) + 'L57 ' + (T - 4) + 'L65 ' + (T - 12) + 'L64 ' + (T + 4) + 'Z', fill: '#FFD43B' }, 2.5), g); sv('circle', { cx: 50, cy: T - 3, r: 2.6, fill: '#E03131' }, g); sv('circle', { cx: 42, cy: T, r: 2, fill: '#4DABF7' }, g); sv('circle', { cx: 58, cy: T, r: 2, fill: '#4DABF7' }, g); }
    return s;
  };

  // What each family throws, drawn around 0,0 in a box 28 across.
  var SHOT = {
    note: function (g) { sv('path', { d: 'M-2 -11v13.6A4.6 4.6 0 1 0 1 7V-4h8v-7z', fill: '#9775FA', stroke: INK, 'stroke-width': 1.6 }, g); },
    star: function (g) { sv('path', { d: 'M0 -12l3.5 7.5 8.3.9-6.2 5.6 1.7 8.2L0 6.1l-7.3 4.1 1.7-8.2-6.2-5.6 8.3-.9z', fill: '#FFD43B', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g); },
    splat: function (g) { sv('path', { d: 'M0 -10C4 -12 5 -6 9 -7C12 -4 8 0 11 3C11 8 5 6 3 10C-1 12 -3 7 -7 9C-11 7 -8 2 -11 -1C-12 -6 -6 -5 -5 -9C-3 -12 -2 -9 0 -10Z', fill: pick(['#FF4D6D', '#4DABF7', '#FFD43B', '#69DB7C', '#B197FC']), stroke: INK, 'stroke-width': 1.5 }, g); },
    swirl: function (g) { sv('path', { d: 'M0 0C3 -2 5 1 3 4C0 8 -6 5 -6 0C-6 -7 3 -10 8 -5C12 -1 11 6 8 9', fill: 'none', stroke: '#20C997', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, g); },
    bolt: function (g) { sv('path', { d: 'M3 -13 -8 2h7l-3 11 12-16H1z', fill: '#FFE066', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g); },
    letter: function (g) { var t = sv('text', { x: 0, y: 8, 'text-anchor': 'middle', 'font-size': 22, 'font-family': 'Luckiest Guy, Arial Black, sans-serif', fill: pick(['#F59F00', '#4DABF7', '#FF4D6D']), stroke: INK, 'stroke-width': 1.2 }, g); t.textContent = pick(['A', 'B', 'C', '1', '2', '3']); },
    die: function (g) { sv('rect', { x: -9, y: -9, width: 18, height: 18, rx: 4, fill: '#fff', stroke: INK, 'stroke-width': 2 }, g); [[-4, -4], [0, 0], [4, 4]].forEach(function (p) { sv('circle', { cx: p[0], cy: p[1], r: 1.8, fill: INK }, g); }); },
    leaf: function (g) { sv('path', { d: 'M0 -11C9 -6 9 5 0 11C-9 5 -9 -6 0 -11Z', fill: '#51CF66', stroke: INK, 'stroke-width': 1.6 }, g); sv('path', { d: 'M0 -8V9', stroke: INK, 'stroke-width': 1.2 }, g); },
    flame: function (g) { sv('path', { d: 'M0 -12C6 -4 9 2 6 7C4 11 -4 11 -6 7C-9 2 -4 -3 0 -12Z', fill: '#FF922B', stroke: INK, 'stroke-width': 1.6 }, g); sv('path', { d: 'M0 -2C3 2 4 5 2 7C1 9 -2 9 -3 7C-4 4 -2 1 0 -2Z', fill: '#FFE066' }, g); },
    confetti: function (g) { ['#FF4D6D', '#FFD43B', '#4DABF7', '#69DB7C', '#B197FC'].forEach(function (c, i) { sv('rect', { x: -10 + i * 4, y: -8 + (i % 2) * 9, width: 4, height: 7, fill: c, transform: 'rotate(' + (i * 37) + ' ' + (-8 + i * 4) + ' ' + (-4 + (i % 2) * 9) + ')' }, g); }); },
    ball: function (g) { sv('circle', { r: 9.5, fill: '#FF8C1A', stroke: INK, 'stroke-width': 1.8 }, g); sv('path', { d: 'M-9.5 0H9.5M0 -9.5V9.5M-6.5 -7C-3 -3 -3 3 -6.5 7M6.5 -7C3 -3 3 3 6.5 7', fill: 'none', stroke: INK, 'stroke-width': 1.2 }, g); },
    plane: function (g) { sv('path', { d: 'M-12 2L12 -9L4 11L1 3Z', fill: '#fff', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g); sv('path', { d: 'M1 3L12 -9', stroke: INK, 'stroke-width': 1.2 }, g); }
  };
  var drawShot = function (kind) { var s = sv('svg', { viewBox: '-14 -14 28 28', 'class': 'kc-shot', 'aria-hidden': 'true' }); (SHOT[kind] || SHOT.star)(sv('g', null, s)); return s; };

  // ----- pins: shiny, in three levels -----
  var TIER = ['', 'Bronze', 'Silver', 'Gold'];
  var METAL = [null, ['#7A4A1E', '#D99A5B', '#FFD2A1', '#A86A33'], ['#68778F', '#CFD8E6', '#FFFFFF', '#93A0B6'], ['#946200', '#FFC930', '#FFF3B0', '#D19B00']];
  var PIN_SHAPE = {
    type: ['M50 4A46 46 0 1 1 49.99 4Z', 'M50 15A35 35 0 1 1 49.99 15Z', 50],
    season: ['M50 3L89 16V48C89 73 72 89 50 97C28 89 11 73 11 48V16Z', 'M50 14L79 24V48C79 66 67 79 50 86C33 79 21 66 21 48V24Z', 48],
    explore: [(function () { var d = ''; for (var i = 0; i < 16; i++) { var r = i % 2 ? 38 : 47, a = Math.PI * 2 * i / 16 - Math.PI / 2; d += (i ? 'L' : 'M') + (50 + r * Math.cos(a)).toFixed(1) + ' ' + (50 + r * Math.sin(a)).toFixed(1); } return d + 'Z'; })(), 'M50 20A30 30 0 1 1 49.99 20Z', 50]
  };
  var drawPin = function (p, tier) {
    var id = 'kcp' + (++uid), sh = PIN_SHAPE[p.group] || PIN_SHAPE.type, cy = sh[2];
    var s = sv('svg', { viewBox: '0 0 100 112', 'class': 'kc-pin t' + tier, 'aria-hidden': 'true', focusable: 'false' });
    var defs = sv('defs', null, s);
    if (tier) {
      var lg = sv('linearGradient', { id: id + 'm', x1: 0, y1: 0, x2: 1, y2: 1 }, defs), st = METAL[tier];
      [[0, st[0]], [0.3, st[1]], [0.5, st[2]], [0.72, st[1]], [1, st[3]]].forEach(function (x) { sv('stop', { offset: x[0], 'stop-color': x[1] }, lg); });
      sv('path', { d: sh[0] }, sv('clipPath', { id: id + 'c' }, defs));
    }
    if (tier === 3) { sv('path', { d: 'M34 80L24 108L36 101L42 110L50 84Z', fill: '#E03131', stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, s); sv('path', { d: 'M66 80L76 108L64 101L58 110L50 84Z', fill: '#E03131', stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, s); }
    sv('path', { d: sh[0], fill: tier ? 'url(#' + id + 'm)' : '#C3CBD8', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }, s);
    sv('path', { d: sh[1], fill: tier ? p.color : '#E2E7EF', stroke: 'rgba(0,0,0,.28)', 'stroke-width': 2 }, s);
    var ic = sv('g', { transform: 'translate(' + (50 - 19.2) + ' ' + (cy - 19.2) + ') scale(1.6)' }, s);
    sv('path', { d: p.icon, fill: tier ? '#fff' : '#A9B3C4' }, ic);
    if (tier) {
      sv('ellipse', { cx: 37, cy: cy - 16, rx: 16, ry: 8, fill: '#fff', opacity: 0.22, transform: 'rotate(-32 37 ' + (cy - 16) + ')' }, s);
      var sg = sv('g', { 'clip-path': 'url(#' + id + 'c)' }, s);
      sv('rect', { 'class': 'kc-shine', x: -40, y: -20, width: 18, height: 150, fill: '#fff', opacity: 0.55 }, sv('g', { transform: 'rotate(22 50 50)' }, sg));
      for (var i = 0; i < tier; i++) sv('path', { d: 'M0 -6l1.8 3.8 4.2.5-3.1 2.8.8 4.1L0 3.1l-3.7 2.1.8-4.1-3.1-2.8 4.2-.5z', transform: 'translate(' + (50 + (i - (tier - 1) / 2) * 13) + ' ' + (p.group === 'season' ? 90 : 89) + ')', fill: '#FFF', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, s);
    }
    return s;
  };

  // ----- what a child has earned, worked out from what a parent confirmed -----
  var LEVELS = [0, 15, 40, 75, 120, 175, 240, 315, 400, 495, 600, 715, 840, 975, 1120];
  var TITLES = ['Rookie', 'Rookie', 'Explorer', 'Explorer', 'Adventurer', 'Adventurer', 'Trailblazer', 'Trailblazer', 'Champion', 'Champion', 'Legend'];
  var need = function (n) { return n - 1 < LEVELS.length ? LEVELS[n - 1] : LEVELS[LEVELS.length - 1] + (n - LEVELS.length) * 150; };   // points to reach level n
  var levelOf = function (xp) { var n = 1; while (xp >= need(n + 1)) n++; return { n: n, title: TITLES[Math.min(n - 1, TITLES.length - 1)], from: need(n), to: need(n + 1) }; };
  var stats = function (k) {
    var types = {}, kinds = {}, hoods = {}, places = [], keys = [], seenKey = {}, n = 0;
    k.done.forEach(function (e) {
      var l = listing(e.k); if (!l) return;
      n++; kinds[e.kind] = (kinds[e.kind] || 0) + 1;
      (l.t || []).forEach(function (t) { types[t] = (types[t] || 0) + 1; });
      if (!seenKey[e.k]) { seenKey[e.k] = true; keys.push(e.k); }
      var st = siteOf(e);
      if (st) { var hid = st.m || 'n:' + st.h; hoods[hid] = true; places.push({ k: e.k, st: st }); }
    });
    var nh = Object.keys(hoods).length, pins = {}, tiers = 0;
    D.pins.forEach(function (p) {
      var c = p.group === 'type' ? types[p.id.slice(5)] || 0 : p.group === 'season' ? kinds[p.id.slice(7)] || 0 : nh, tier = 0;
      p.tiers.forEach(function (t, i) { if (c >= t) tier = i + 1; });
      pins[p.id] = { c: c, tier: tier, next: tier < 3 ? p.tiers[tier] : 0 };
      tiers += tier;
    });
    var xp = n * 10 + nh * 5 + tiers * 5;
    return { n: n, nh: nh, hoods: hoods, places: places, keys: keys, pins: pins, tiers: tiers, xp: xp, level: levelOf(xp) };
  };

  // ----- state -----
  var S = { data: null, kid: -1, view: 'pick', tab: 'pins', bracket: null, saving: false, said: '', fresh: null };
  var kid = function () { return S.data && S.kid > -1 ? S.data.kids[S.kid] : null; };
  var setKidMode = function (on) { html.classList.toggle('kc-kid', !!on); };
  var go = function (view, tab, push) {
    S.view = view; if (tab) S.tab = tab;
    var h = view === 'pick' ? '' : view === 'kid' ? '#' + S.tab : '#' + view;
    if (push !== false) { try { history.pushState({ kc: view, tab: S.tab, kid: S.kid }, '', location.pathname + h); } catch (e) { /* no history */ } }
    draw();
    window.scrollTo(0, 0);
  };
  window.addEventListener('popstate', function (ev) {
    var st = ev.state && ev.state.kc ? ev.state : { kc: 'pick' };
    if (st.kc !== 'pick' && st.kc !== 'grownup' && !kid()) st = { kc: 'pick' };
    if (st.kc === 'fight' && !S.bracket) st = { kc: 'kid', tab: 'battle' };
    S.view = st.kc; if (st.tab) S.tab = st.tab; draw();
  });

  // Save this child's lists, then keep the server's answer (which also brings fresh suggestions).
  var save = function (changes, then) {
    var k = kid(); if (!k || S.saving) return;
    S.saving = true;
    var body = { kid: k.name, done: changes.done || k.done, skip: changes.skip || k.skip, fav: changes.fav || k.fav };
    ['av', 'seen', 'lvl'].forEach(function (f) { if (changes[f] !== undefined) body[f] = changes[f]; });
    call('passport_save', body).then(function (d) {
      S.saving = false;
      if (!d.ok) { S.said = d.message || 'That didn’t save. Try again.'; draw(); return; }
      ['done', 'skip', 'fav', 'suggest', 'updated', 'av', 'seen', 'lvl'].forEach(function (f) { if (d.kid[f] !== undefined) k[f] = d.kid[f]; });
      S.said = '';
      if (then) then(); else draw();
    });
  };

  // ----- pieces every kid screen shares -----
  var muteBtn = function () {
    var b = btn('kc-mute', '', function () { var m = Sound.toggle(); paint(); if (!m) Sound.play('pop'); });
    var paint = function () {
      var m = Sound.muted(); b.textContent = '';
      b.appendChild(icon(m ? 'M4 9v6h4l5 4V5L8 9zm12.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z' : 'M4 9v6h4l5 4V5L8 9zm11.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM13 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z'));
      b.setAttribute('aria-label', m ? 'Sound is off. Tap to turn it on' : 'Sound is on. Tap to turn it off');
      b.setAttribute('aria-pressed', m ? 'true' : 'false');
    };
    paint(); return b;
  };
  var grownupRow = function () {
    var row = el('div', 'kc-grown');
    var b = el('button', 'kc-hold'); b.type = 'button'; b.setAttribute('aria-label', 'Grown-ups: press and hold to open the settings');
    b.appendChild(el('span', 'kc-hold-bar')); b.appendChild(el('span', 'kc-hold-text', 'Grown-ups: press and hold'));
    var timer = null;
    var start = function (ev) { if (ev.type === 'pointerdown' && ev.button !== 0) return; ev.preventDefault(); b.classList.add('holding'); timer = setTimeout(function () { b.classList.remove('holding'); timer = null; go('grownup'); }, 1100); };
    var stop = function () { if (timer) { clearTimeout(timer); timer = null; } b.classList.remove('holding'); };
    if (window.PointerEvent) { b.addEventListener('pointerdown', start); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop); }
    else { b.addEventListener('mousedown', start); b.addEventListener('mouseup', stop); b.addEventListener('mouseleave', stop); b.addEventListener('touchstart', start, { passive: false }); b.addEventListener('touchend', stop); }
    b.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (!timer) start(ev); } });
    b.addEventListener('keyup', stop);
    b.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    row.appendChild(b);
    return row;
  };
  // A box over the page: a celebration, a pin up close. Closes on its button; resolves when it does.
  var overlay = function (build, cls) {
    return new Promise(function (res) {
      var ov = el('div', 'kc-over' + (cls ? ' ' + cls : '')); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      var card = el('div', 'kc-over-card'); ov.appendChild(card);
      var close = function () { ov.classList.add('out'); setTimeout(function () { ov.remove(); res(); }, CALM ? 0 : 180); };
      document.body.appendChild(ov);   // in the page first, so what build() animates is on screen
      build(card, close);
      var f = card.querySelector('button'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }
    });
  };
  var confetti = function (n) {
    if (CALM) return;
    var box = el('div', 'kc-confetti'); document.body.appendChild(box);
    var colors = ['#FF4D6D', '#FFD43B', '#4DABF7', '#69DB7C', '#B197FC', '#FF922B'];
    for (var i = 0; i < (n || 70); i++) {
      var c = el('i'); c.style.left = (Math.random() * 100) + 'vw'; c.style.background = pick(colors); c.style.width = (6 + Math.random() * 8) + 'px'; c.style.height = (8 + Math.random() * 10) + 'px';
      box.appendChild(c);
      anim(c, [{ transform: 'translate(0,-10vh) rotate(0)' }, { transform: 'translate(' + (Math.random() * 30 - 15) + 'vw,110vh) rotate(' + (360 + Math.random() * 720) + 'deg)' }], { duration: 1800 + Math.random() * 1600, delay: Math.random() * 400, easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'forwards' });
    }
    setTimeout(function () { box.remove(); }, 4200);
  };
  var bounce = function (node) { return anim(node, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-14%) scale(1.06,.94)' }, { transform: 'translateY(0) scale(.96,1.04)' }, { transform: 'translateY(0) scale(1)' }], { duration: 480, easing: 'ease-out' }); };

  // ----- the picker: who's playing? -----
  var drawPick = function () {
    setKidMode(true);
    var box = el('section', 'kc-pick');
    var top = el('div', 'kc-picktop'); top.appendChild(el('h1', 'kc-h', 'Who’s playing?')); top.appendChild(muteBtn()); box.appendChild(top);
    if (!S.data.kids.length) {
      setKidMode(false);
      var none = el('div', 'panel kc-none');
      none.appendChild(el('h2', null, 'No names yet'));
      none.appendChild(el('p', null, 'Kid’s Corner has a page for each child. Add your kids’ first names on your account page (a nickname or an initial works), and each gets a page here.'));
      var a = el('a', 'btn primary', 'Add their names'); a.href = D.links.kids; none.appendChild(a);
      box.appendChild(none); app.appendChild(box); return;
    }
    var row = el('div', 'kc-kids');
    S.data.kids.forEach(function (k, i) {
      var st = stats(k);
      var b = btn('kc-kidbtn', '', function () { Sound.play('pop'); S.kid = i; S.bracket = null; go(k.av ? 'kid' : 'avatar', 'pins'); });
      var face = el('span', 'kc-kidface');
      if (k.av) face.appendChild(drawMonster(kidMonster(k.av), 'bob')); else face.appendChild(eggArt());
      b.appendChild(face);
      b.appendChild(el('b', null, k.name));
      b.appendChild(el('small', null, k.av ? st.level.title + ' · Level ' + st.level.n : 'Tap to hatch your monster!'));
      row.appendChild(b);
    });
    box.appendChild(row);
    box.appendChild(grownupRow());
    app.appendChild(box);
  };
  var eggArt = function () {
    var s = sv('svg', { viewBox: '0 0 100 112', 'class': 'kc-mon kc-egg', 'aria-hidden': 'true' });
    sv('path', { d: 'M50 10C70 10 86 44 86 70C86 92 70 104 50 104C30 104 14 92 14 70C14 44 30 10 50 10Z', fill: '#FFF4D6', stroke: INK, 'stroke-width': 3.5 }, s);
    [[34, 50, 6, '#FF8FAB'], [62, 38, 5, '#74C0FC'], [66, 72, 7, '#8CE99A'], [38, 82, 5, '#FFD43B']].forEach(function (c) { sv('circle', { cx: c[0], cy: c[1], r: c[2], fill: c[3] }, s); });
    var q = sv('text', { x: 50, y: 78, 'text-anchor': 'middle', 'font-size': 34, 'font-family': 'Luckiest Guy, Arial Black, sans-serif', fill: INK }, s); q.textContent = '?';
    return s;
  };

  // ----- picking a monster: a body and a color, no typing -----
  var drawAvatar = function () {
    var k = kid(); if (!k) { go('pick', null, false); return; }
    setKidMode(true);
    var cur = k.av ? { b: k.av.b, c: k.av.c } : { b: 'blob', c: Math.floor(Math.random() * COLORS.length) };
    var page = el('section', 'kc-avatar');
    var top = el('div', 'kc-picktop'); top.appendChild(el('h1', 'kc-h', k.av ? 'Change your monster' : 'Pick your monster!')); top.appendChild(muteBtn()); page.appendChild(top);
    var stage = el('div', 'kc-avstage'); page.appendChild(stage);
    var paintStage = function () { stage.textContent = ''; var m = drawMonster(kidMonster(cur), 'bob big'); stage.appendChild(m); bounce(m); };
    var bodies = el('div', 'kc-bodies'); bodies.setAttribute('role', 'group'); bodies.setAttribute('aria-label', 'Monsters');
    var colors = el('div', 'kc-colors'); colors.setAttribute('role', 'group'); colors.setAttribute('aria-label', 'Colors');
    var paintChoices = function () {
      bodies.textContent = ''; colors.textContent = '';
      BODY_IDS.forEach(function (b, i) {
        var c = btn('kc-bodybtn' + (cur.b === b ? ' on' : ''), '', function () { cur.b = b; Sound.play('pop'); paintChoices(); paintStage(); });
        c.setAttribute('aria-label', 'Monster ' + (i + 1)); c.setAttribute('aria-pressed', cur.b === b ? 'true' : 'false');
        c.appendChild(drawMonster(kidMonster({ b: b, c: cur.c }))); bodies.appendChild(c);
      });
      COLORS.forEach(function (h, i) {
        var c = btn('kc-swatch' + (cur.c === i ? ' on' : ''), '', function () { cur.c = i; Sound.play('tap'); paintChoices(); paintStage(); });
        c.style.background = hsl(h, 82, 60); c.setAttribute('aria-label', 'Color ' + (i + 1)); c.setAttribute('aria-pressed', cur.c === i ? 'true' : 'false');
        colors.appendChild(c);
      });
    };
    page.appendChild(bodies); page.appendChild(colors);
    var acts = el('div', 'kc-avacts');
    acts.appendChild(btn('kc-big go', 'That’s me!', function () {
      Sound.play('sparkle'); confetti(40);
      save({ av: { b: cur.b, c: cur.c } }, function () { go('kid', S.tab || 'pins'); });
    }));
    if (k.av) acts.appendChild(btn('kc-big ghost', 'Never mind', function () { go('kid'); }));
    page.appendChild(acts);
    app.appendChild(page);
    paintChoices(); paintStage();
  };

  // ----- the child's page: a header with their monster and level, three tabs -----
  var drawKid = function () {
    var k = kid(); if (!k) { go('pick', null, false); return; }
    if (!k.av) { S.view = 'avatar'; drawAvatar(); return; }
    setKidMode(true);
    var st = stats(k);
    var page = el('section', 'kc-page kc-tab-' + S.tab);
    var top = el('header', 'kc-top');
    if (S.data.kids.length > 1) { var back = btn('kc-back', '', function () { Sound.play('tap'); go('pick'); }); back.setAttribute('aria-label', 'Who’s playing?'); back.appendChild(icon('M15.4 4.6 8 12l7.4 7.4-1.8 1.8L4.4 12l9.2-9.2z')); top.appendChild(back); }
    var me = btn('kc-me', '', function () { Sound.play('boing'); go('avatar'); }); me.setAttribute('aria-label', 'Change my monster'); me.appendChild(drawMonster(kidMonster(k.av), 'bob')); top.appendChild(me);
    var who = el('div', 'kc-who');
    who.appendChild(el('b', 'kc-name', k.name));
    who.appendChild(el('span', 'kc-lvl', st.level.title + ' · Level ' + st.level.n));
    var bar = el('div', 'kc-xp'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', 'To the next level'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100');
    var pct = Math.round(100 * (st.xp - st.level.from) / (st.level.to - st.level.from)); bar.setAttribute('aria-valuenow', String(pct));
    var fill = el('i'); fill.style.width = Math.max(4, pct) + '%'; bar.appendChild(fill); who.appendChild(bar);
    top.appendChild(who);
    top.appendChild(muteBtn());
    page.appendChild(top);
    var body = el('div', 'kc-body'); page.appendChild(body);
    if (S.tab === 'map') drawMapTab(body, k, st);
    else if (S.tab === 'battle') drawBattleTab(body, k, st);
    else drawPinsTab(body, k, st);
    body.appendChild(grownupRow());
    var tabs = el('nav', 'kc-tabs'); tabs.setAttribute('aria-label', 'Kid’s Corner');
    [['pins', 'Pins', 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z'], ['map', 'Map', 'M15 4 9 2 3 4v18l6-2 6 2 6-2V2zm0 15.8-6-2V4.2l6 2z'], ['battle', 'Battle', 'M6.9 3 3 3l.1 3.9 7.5 7.5-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.6 2.6 2.1-2.1-2.6-2.6 2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1 2.1-2.1zM21 3h-3.9l-5 5 2.1 2.1L21 4z']].forEach(function (t) {
      var b = btn('kc-tabbtn' + (S.tab === t[0] ? ' on' : ''), '', function () { if (S.tab === t[0]) return; Sound.play('tap'); go('kid', t[0]); });
      if (S.tab === t[0]) b.setAttribute('aria-current', 'page');
      b.appendChild(icon(t[2])); b.appendChild(el('span', null, t[1])); tabs.appendChild(b);
    });
    page.appendChild(tabs);
    app.appendChild(page);
    // Anything new since the last visit: pins that went up a level, then a new level.
    var news = newsFor(k, st);
    if (news.pins.length || news.level) setTimeout(function () { celebrate(k, st, news); }, 250);
  };

  // ----- the Pins tab -----
  var unitWord = function (p, n) { return n === 1 ? p.one : p.many; };
  var drawPinsTab = function (body, k, st) {
    var got = 0; D.pins.forEach(function (p) { if (st.pins[p.id].tier) got++; });
    var head = el('div', 'kc-sechead'); head.appendChild(el('h2', 'kc-h2', 'My pins')); head.appendChild(el('span', 'kc-tally', got + ' / ' + D.pins.length)); body.appendChild(head);
    if (!st.n) body.appendChild(el('p', 'kc-say', 'Your first class earns your first pin! A grown-up adds it.'));
    var grid = el('div', 'kc-pins');
    var list = D.pins.slice().sort(function (a, b) { return st.pins[b.id].tier - st.pins[a.id].tier; });
    list.forEach(function (p) {
      var x = st.pins[p.id];
      var c = btn('kc-pincard t' + x.tier, '', function () { Sound.play(x.tier ? 'sparkle' : 'tap'); pinUpClose(p, x); });
      c.setAttribute('aria-label', p.label + ': ' + (x.tier ? TIER[x.tier] : 'not yet'));
      c.appendChild(drawPin(p, x.tier));
      c.appendChild(el('b', null, p.label));
      if (x.tier === 3) c.appendChild(el('span', 'kc-tier gold', 'Gold!'));
      else {
        var lo = x.tier ? p.tiers[x.tier - 1] : 0, hi = p.tiers[x.tier];
        var pb = el('span', 'kc-pinbar'); var f = el('i'); f.style.width = Math.round(100 * (x.c - lo) / (hi - lo)) + '%'; pb.appendChild(f); c.appendChild(pb);
        c.appendChild(el('span', 'kc-tier' + (x.tier ? ' ' + TIER[x.tier].toLowerCase() : ''), x.tier ? TIER[x.tier] : x.c + ' / ' + hi));
      }
      grid.appendChild(c);
    });
    body.appendChild(grid);
  };
  var pinUpClose = function (p, x) {
    overlay(function (card, close) {
      card.classList.add('kc-pinbig');
      var pv = drawPin(p, x.tier); card.appendChild(pv); bounce(pv);
      card.appendChild(el('h2', 'kc-h', p.label));
      if (x.tier) card.appendChild(el('p', 'kc-tier big ' + TIER[x.tier].toLowerCase(), TIER[x.tier] + (x.tier === 3 ? '! The top!' : '')));
      card.appendChild(el('p', 'kc-say', x.c ? 'You’ve been to ' + plural(x.c, p.one, p.many) + (p.group === 'explore' ? '!' : '!') : 'Go to a ' + p.one + ' to get this pin!'));
      if (x.c && x.tier < 3) card.appendChild(el('p', 'kc-say small', (x.next - x.c) + ' more ' + unitWord(p, x.next - x.c) + ' for ' + TIER[x.tier + 1].toUpperCase() + '!'));
      card.appendChild(btn('kc-big go', 'Cool!', function () { Sound.play('tap'); close(); }));
    });
  };

  // What's new: pins whose level went up since the child last saw them, and a new level.
  var newsFor = function (k, st) {
    var seen = k.seen || {}, out = { pins: [], level: 0 };
    D.pins.forEach(function (p) { var t = st.pins[p.id].tier; if (t > (seen[p.id] || 0)) out.pins.push({ p: p, tier: t }); });
    if (st.level.n > (k.lvl || 1)) out.level = st.level.n;
    return out;
  };
  var celebrating = false;
  var celebrate = function (k, st, news) {
    if (celebrating || S.view !== 'kid') return;
    celebrating = true;
    var done = function () {
      var seen = {}; D.pins.forEach(function (p) { if (st.pins[p.id].tier) seen[p.id] = st.pins[p.id].tier; });
      save({ seen: seen, lvl: st.level.n }, function () { celebrating = false; draw(); });
    };
    // A present to tap open: sounds can only start after a tap.
    overlay(function (card, close) {
      card.classList.add('kc-gift');
      card.appendChild(el('h2', 'kc-h', news.pins.length ? 'Something new!' : 'Level up!'));
      var g = btn('kc-giftbtn', '', function () { close(); });
      g.setAttribute('aria-label', 'Tap to open');
      g.appendChild(giftArt()); g.appendChild(el('span', 'kc-say', 'Tap to open!'));
      card.appendChild(g);
    }, 'gift').then(function () {
      var chain = Promise.resolve();
      if (news.pins.length && news.pins.length <= 3) news.pins.forEach(function (x) { chain = chain.then(function () { return revealPin(x.p, x.tier, st); }); });
      else if (news.pins.length) chain = chain.then(function () { return revealMany(news.pins); });
      if (news.level) chain = chain.then(function () { return levelUp(k, st); });
      chain.then(done);
    });
  };
  var giftArt = function () {
    var s = sv('svg', { viewBox: '0 0 100 100', 'class': 'kc-giftart', 'aria-hidden': 'true' });
    sv('rect', { x: 14, y: 42, width: 72, height: 50, rx: 6, fill: '#FF4D6D', stroke: INK, 'stroke-width': 3.5 }, s);
    sv('rect', { x: 8, y: 30, width: 84, height: 18, rx: 5, fill: '#FF6B8B', stroke: INK, 'stroke-width': 3.5 }, s);
    sv('rect', { x: 43, y: 30, width: 14, height: 62, fill: '#FFD43B', stroke: INK, 'stroke-width': 3 }, s);
    sv('path', { d: 'M50 30C40 12 22 14 28 26C32 32 44 30 50 30ZM50 30C60 12 78 14 72 26C68 32 56 30 50 30Z', fill: '#FFD43B', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }, s);
    return s;
  };
  var rays = function () { var r = el('div', 'kc-rays'); r.setAttribute('aria-hidden', 'true'); return r; };
  var revealPin = function (p, tier, st) {
    return overlay(function (card, close) {
      card.classList.add('kc-reveal');
      card.appendChild(rays());
      card.appendChild(el('p', 'kc-burst', tier === 1 ? 'NEW PIN!' : TIER[tier].toUpperCase() + '!'));
      var pv = drawPin(p, tier); card.appendChild(pv);
      card.appendChild(el('h2', 'kc-h', p.label));
      var x = st.pins[p.id];
      card.appendChild(el('p', 'kc-say', tier === 3 ? 'Gold! That’s the top!' : (x.next - x.c) + ' more ' + unitWord(p, x.next - x.c) + ' for ' + TIER[tier + 1] + '!'));
      card.appendChild(btn('kc-big go', 'Yay!', function () { Sound.play('tap'); close(); }));
      Sound.play('sparkle');
      anim(pv, [{ transform: 'scale(0) rotate(-200deg)' }, { transform: 'scale(1.25) rotate(10deg)', offset: 0.7 }, { transform: 'scale(1) rotate(0)' }], { duration: 750, easing: 'cubic-bezier(.2,.8,.3,1.2)' });
      confetti(30);
    }, 'reveal');
  };
  var revealMany = function (list) {
    return overlay(function (card, close) {
      card.classList.add('kc-reveal');
      card.appendChild(rays());
      card.appendChild(el('p', 'kc-burst', plural(list.length, 'new pin', 'new pins') + '!'));
      var grid = el('div', 'kc-pins kc-mini');
      list.forEach(function (x, i) { var c = el('div', 'kc-pincard t' + x.tier); var pv = drawPin(x.p, x.tier); c.appendChild(pv); c.appendChild(el('b', null, x.p.label)); grid.appendChild(c); anim(pv, [{ transform: 'scale(0)' }, { transform: 'scale(1.2)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 500, delay: Math.min(i * 90, 700), easing: 'ease-out', fill: 'backwards' }); });
      card.appendChild(grid);
      card.appendChild(btn('kc-big go', 'Yay!', function () { Sound.play('tap'); close(); }));
      Sound.play('sparkle'); confetti(60);
    }, 'reveal');
  };
  var levelUp = function (k, st) {
    return overlay(function (card, close) {
      card.classList.add('kc-reveal', 'kc-levelup');
      card.appendChild(rays());
      card.appendChild(el('p', 'kc-burst', 'LEVEL UP!'));
      var m = drawMonster(kidMonster(k.av), 'bob big'); card.appendChild(m);
      card.appendChild(el('p', 'kc-levelnum', String(st.level.n)));
      card.appendChild(el('h2', 'kc-h', st.level.title + ' · Level ' + st.level.n));
      card.appendChild(btn('kc-big go', 'Woo-hoo!', function () { Sound.play('tap'); close(); }));
      Sound.play('levelup'); confetti(90);
      anim(m, [{ transform: 'translateY(0)' }, { transform: 'translateY(-30%)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-15%)' }, { transform: 'translateY(0)' }], { duration: 900, easing: 'ease-out' });
    }, 'reveal');
  };

  // ----- the Map tab: Philadelphia, cloudy until explored -----
  var mapLoad = null;
  var loadMap = function () {
    if (!mapLoad) mapLoad = D.map ? window.fetch(D.map, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('map'); return r.json(); }).catch(function () { mapLoad = null; return null; }) : Promise.resolve(null);
    return mapLoad;
  };
  var HOOD_COLORS = ['#FF8FAB', '#FFD43B', '#69DB7C', '#74C0FC', '#B197FC', '#FFA94D', '#63E6BE', '#F783AC'];
  var LANDMARK_SAY = {
    'city-hall': 'William Penn stands on top!', love: 'The big LOVE sign!', 'liberty-bell': 'It has a famous crack.', 'art-museum': 'Run up all 72 steps!',
    zoo: 'America’s first zoo!', boathouses: 'They light up at night.', franklin: 'Walk through a giant heart!', bridge: 'It goes to New Jersey!',
    stadiums: 'Where the Phillies, Eagles, Sixers and Flyers play.', cheesesteak: 'Wit or witout?', wissahickon: 'Trails, a creek and a covered bridge.', airport: 'Planes zoom over the river.'
  };
  var LANDMARK = {
    'city-hall': function (g) { sv('rect', { x: -15, y: 2, width: 30, height: 14, fill: '#F1E3C4', stroke: INK, 'stroke-width': 2 }, g); sv('rect', { x: -6, y: -14, width: 12, height: 18, fill: '#F1E3C4', stroke: INK, 'stroke-width': 2 }, g); sv('path', { d: 'M-6 -14Q0 -24 6 -14Z', fill: '#8FC9A8', stroke: INK, 'stroke-width': 2 }, g); sv('path', { d: 'M0 -21V-27', stroke: INK, 'stroke-width': 2 }, g); sv('circle', { cx: 0, cy: -28, r: 2, fill: INK }, g); sv('circle', { cx: 0, cy: -5, r: 3, fill: '#fff', stroke: INK, 'stroke-width': 1.3 }, g); [-11, -5, 5, 11].forEach(function (x) { sv('rect', { x: x - 1.5, y: 6, width: 3, height: 5, fill: '#4DABF7' }, g); }); },
    love: function (g) { sv('rect', { x: -15, y: -15, width: 30, height: 30, rx: 4, fill: '#fff', stroke: INK, 'stroke-width': 2 }, g); var t1 = sv('text', { x: 0, y: -1, 'text-anchor': 'middle', 'font-size': 14, 'font-family': 'Luckiest Guy, Arial Black, sans-serif', fill: '#E03131' }, g); t1.textContent = 'LO'; var t2 = sv('text', { x: 0, y: 13, 'text-anchor': 'middle', 'font-size': 14, 'font-family': 'Luckiest Guy, Arial Black, sans-serif', fill: '#E03131' }, g); t2.textContent = 'VE'; },
    'liberty-bell': function (g) { sv('rect', { x: -14, y: -18, width: 28, height: 6, rx: 2, fill: '#7B4F2A', stroke: INK, 'stroke-width': 2 }, g); sv('path', { d: 'M-12 12C-12 -1 -9 -12 0 -12C9 -12 12 -1 12 12Z', fill: '#C4913F', stroke: INK, 'stroke-width': 2 }, g); sv('rect', { x: -15, y: 10, width: 30, height: 5, rx: 2, fill: '#A87A30', stroke: INK, 'stroke-width': 2 }, g); sv('path', { d: 'M2 -6L-1 0L2 4L0 11', fill: 'none', stroke: INK, 'stroke-width': 1.6 }, g); },
    'art-museum': function (g) { sv('path', { d: 'M-18 -6L0 -17L18 -6Z', fill: '#F1E3C4', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g); [-13, -5, 3, 11].forEach(function (x) { sv('rect', { x: x - 1, y: -6, width: 4, height: 13, fill: '#fff', stroke: INK, 'stroke-width': 1.4 }, g); }); [0, 1, 2].forEach(function (i) { sv('rect', { x: -18 - i * 3, y: 7 + i * 3.5, width: 36 + i * 6, height: 3.5, fill: '#E9DDC2', stroke: INK, 'stroke-width': 1.2 }, g); }); },
    zoo: function (g) { sv('path', { d: 'M-4 16V-8L-10 -14Q-6 -20 2 -16L6 -12L2 -9V16Z', fill: '#FFC94D', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g); [[-1, -2], [0, 6], [-1, 12]].forEach(function (p) { sv('circle', { cx: p[0], cy: p[1], r: 1.8, fill: '#B5651D' }, g); }); sv('circle', { cx: -3, cy: -14, r: 1.4, fill: INK }, g); sv('path', { d: 'M-2 -19L-3 -23M2 -18L3 -22', stroke: INK, 'stroke-width': 1.6 }, g); },
    boathouses: function (g) { [-12, 0, 12].forEach(function (x, i) { sv('path', { d: 'M' + (x - 6) + ' 8V-2L' + x + ' -9L' + (x + 6) + ' -2V8Z', fill: ['#F1E3C4', '#FFE8CC', '#E7F5FF'][i], stroke: '#FFD43B', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g); }); },
    franklin: function (g) { sv('path', { d: 'M0 14C-18 2 -16 -14 -7 -14C-3 -14 -1 -11 0 -9C1 -11 3 -14 7 -14C16 -14 18 2 0 14Z', fill: '#FF4D6D', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g); sv('path', { d: 'M-8 -8Q-11 -4 -9 0', fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round' }, g); },
    bridge: function (g) { sv('path', { d: 'M-20 4H20', stroke: '#1C7ED6', 'stroke-width': 4 }, g); sv('path', { d: 'M-20 -2Q-11 6 -8 -12Q0 4 8 -12Q11 6 20 -2', fill: 'none', stroke: '#1C7ED6', 'stroke-width': 1.8 }, g); [-8, 8].forEach(function (x) { sv('rect', { x: x - 2, y: -14, width: 4, height: 20, fill: '#4DABF7', stroke: INK, 'stroke-width': 1.4 }, g); }); },
    stadiums: function (g) { sv('ellipse', { cx: 0, cy: 0, rx: 19, ry: 13, fill: '#ADB5BD', stroke: INK, 'stroke-width': 2 }, g); sv('ellipse', { cx: 0, cy: 0, rx: 13, ry: 8, fill: '#51CF66', stroke: '#fff', 'stroke-width': 1.5 }, g); sv('path', { d: 'M0 -8V8', stroke: '#fff', 'stroke-width': 1.5 }, g); },
    cheesesteak: function (g) { sv('path', { d: 'M-18 2C-18 -6 18 -6 18 2C18 8 -18 8 -18 2Z', fill: '#E8B864', stroke: INK, 'stroke-width': 2 }, g); sv('path', { d: 'M-15 -2L-11 -6L-7 -2L-3 -6L1 -2L5 -6L9 -2L13 -6L16 -2', fill: '#FFD43B', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, g); sv('path', { d: 'M-17 -3C-17 -12 17 -12 17 -3Z', fill: '#F2C97D', stroke: INK, 'stroke-width': 2 }, g); },
    wissahickon: function (g) { [[-8, 2, '#2F9E44'], [6, -2, '#37B24D']].forEach(function (t) { sv('rect', { x: t[0] - 1.5, y: t[1] + 8, width: 3, height: 6, fill: '#7B4F2A' }, g); sv('path', { d: 'M' + t[0] + ' ' + (t[1] - 14) + 'L' + (t[0] + 9) + ' ' + (t[1] + 9) + 'H' + (t[0] - 9) + 'Z', fill: t[2], stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g); }); },
    airport: function (g) { sv('path', { d: 'M-2 -16C0 -18 2 -16 2 -12V-4L16 4V8L2 3V11L6 14V17L0 15L-6 17V14L-2 11V3L-16 8V4L-2 -4V-12C-2 -14 -2 -15 -2 -16Z', fill: '#fff', stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round', transform: 'rotate(-35)' }, g); }
  };
  var drawMapTab = function (body, k, st) {
    var head = el('div', 'kc-sechead'); head.appendChild(el('h2', 'kc-h2', 'My Philly')); head.appendChild(el('span', 'kc-tally', plural(st.nh, 'place', 'places'))); body.appendChild(head);
    var box = el('div', 'kc-mapbox'); box.appendChild(el('p', 'kc-say', 'Drawing the map…')); body.appendChild(box);
    body.appendChild(el('p', 'kc-say small', st.nh ? 'Every class clears the clouds somewhere new. Tap a place!' : 'It’s all cloudy! Every class you go to clears the clouds where it is.'));
    loadMap().then(function (M) {
      if (!box.isConnected) return;
      box.textContent = '';
      if (!M) { box.appendChild(el('p', 'kc-say', 'The map couldn’t load. Try again later!')); return; }
      drawPhilly(box, M, k, st);
    });
  };
  var drawPhilly = function (box, M, k, st) {
    var W = M.size[0], H = M.size[1], P = M.proj, byId = {};
    M.hoods.forEach(function (h, i) { h.i = i; byId[h.id] = h; });
    var xy = function (ll) { return [(ll[1] - P.lon0) * P.cos * P.k + P.pad, (P.lat1 - ll[0]) * P.k + P.pad]; };
    var mid = 'kcmap' + (++uid);
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'kc-map', role: 'img', 'aria-label': 'A map of Philadelphia. ' + (st.nh ? plural(st.nh, 'place', 'places') + ' explored.' : 'All cloudy so far.') });
    var defs = sv('defs', null, svg);
    var pat = sv('pattern', { id: mid + 'p', width: 140, height: 90, patternUnits: 'userSpaceOnUse' }, defs);
    sv('rect', { width: 140, height: 90, fill: '#E9EFF8' }, pat);
    [[30, 30], [100, 70]].forEach(function (c) { var cg = sv('g', { transform: 'translate(' + c[0] + ' ' + c[1] + ')' }, pat); sv('path', { d: 'M-24 8C-30 8 -30 -2 -23 -2C-22 -10 -11 -12 -7 -6C-3 -14 10 -13 11 -4C18 -6 22 2 17 8Z', fill: '#fff', stroke: '#C9D4E5', 'stroke-width': 2 }, cg); });
    sv('path', { d: M.outline }, sv('clipPath', { id: mid + 'c' }, defs));
    var mask = sv('mask', { id: mid + 'm', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
    sv('rect', { width: W, height: H, fill: '#fff' }, mask);
    var open = {}; Object.keys(st.hoods).forEach(function (id) { if (byId[id]) open[id] = true; });
    Object.keys(open).forEach(function (id) { sv('path', { d: byId[id].d, fill: '#000', stroke: '#000', 'stroke-width': 1 }, mask); });
    // land and water
    sv('rect', { width: W, height: H, fill: '#DCEBC5' }, svg);
    sv('path', { d: M.outline, fill: '#FFF4DA', stroke: 'none' }, svg);
    var hg = sv('g', { 'class': 'kc-hoods' }, svg);
    M.hoods.forEach(function (h) { var p = sv('path', { d: h.d, fill: open[h.id] ? HOOD_COLORS[hash(h.id) % HOOD_COLORS.length] : '#FFF4DA', stroke: '#fff', 'stroke-width': 1.5, 'data-hood': h.id }, hg); if (open[h.id]) p.setAttribute('class', 'open'); });
    sv('rect', { width: W, height: H, fill: 'url(#' + mid + 'p)', 'clip-path': 'url(#' + mid + 'c)', mask: 'url(#' + mid + 'm)', 'class': 'kc-fog', 'pointer-events': 'none' }, svg);
    var lines = sv('g', { 'pointer-events': 'none' }, svg);
    M.hoods.forEach(function (h) { sv('path', { d: h.d, fill: 'none', stroke: open[h.id] ? INK : 'rgba(38,19,74,.16)', 'stroke-width': open[h.id] ? 2.5 : 1.2, 'stroke-linejoin': 'round' }, lines); });
    sv('path', { d: M.outline, fill: 'none', stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round', 'pointer-events': 'none' }, svg);
    var water = sv('g', { 'pointer-events': 'none' }, svg);
    sv('path', { d: M.delaware, fill: 'none', stroke: INK, 'stroke-width': 30, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, water);
    sv('path', { d: M.delaware, fill: 'none', stroke: '#4DABF7', 'stroke-width': 25, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, water);
    sv('path', { d: M.delaware, fill: 'none', stroke: '#A5D8FF', 'stroke-width': 3, 'stroke-dasharray': '14 22', 'stroke-linecap': 'round', 'class': 'kc-waves' }, water);
    sv('path', { d: M.schuylkill, fill: 'none', stroke: INK, 'stroke-width': 13, 'stroke-linecap': 'round' }, water);
    sv('path', { d: M.schuylkill, fill: 'none', stroke: '#4DABF7', 'stroke-width': 9, 'stroke-linecap': 'round' }, water);
    sv('path', { d: M.schuylkill, fill: 'none', stroke: '#A5D8FF', 'stroke-width': 2, 'stroke-dasharray': '8 14', 'stroke-linecap': 'round', 'class': 'kc-waves' }, water);
    var label = function (x, y, text, size, color, rot) { var t = sv('text', { x: x, y: y, 'text-anchor': 'middle', 'font-size': size, 'font-family': 'Luckiest Guy, Arial Black, sans-serif', fill: color, stroke: '#fff', 'stroke-width': size / 5, 'paint-order': 'stroke', transform: rot ? 'rotate(' + rot + ' ' + x + ' ' + y + ')' : null, 'pointer-events': 'none' }, svg); t.textContent = text; return t; };
    label(200, 100, 'PHILADELPHIA', 46, INK);
    label(760, 1010, 'NEW JERSEY', 26, '#7C8C68');
    label(735, 640, 'DELAWARE RIVER', 20, '#1C7ED6', -38);
    label(212, 960, 'SCHUYLKILL', 15, '#1C7ED6', -86);
    var compass = sv('g', { transform: 'translate(985 1085)', 'pointer-events': 'none' }, svg);
    sv('circle', { r: 26, fill: '#fff', stroke: INK, 'stroke-width': 3 }, compass); sv('path', { d: 'M0 -20L6 0L0 -4L-6 0Z', fill: '#E03131', stroke: INK, 'stroke-width': 1.5 }, compass); sv('path', { d: 'M0 20L6 0L0 4L-6 0Z', fill: '#fff', stroke: INK, 'stroke-width': 1.5 }, compass);
    var nt = sv('text', { x: 0, y: -30, 'text-anchor': 'middle', 'font-size': 16, 'font-family': 'Luckiest Guy, Arial Black, sans-serif', fill: INK }, compass); nt.textContent = 'N';
    // Things standing on the map are sized for the zoom, so they stay tappable.
    var things = [];
    var place = function (node, x, y, base, lift) { things.push({ n: node, x: x, y: y, base: base, lift: lift === undefined ? 1 : lift }); svg.appendChild(node); };
    M.landmarks.forEach(function (lm) {
      if (!LANDMARK[lm.id]) return;
      var s = sv('svg', { viewBox: '-22 -30 44 50', 'class': 'kc-lm', 'data-lm': lm.id });
      sv('ellipse', { cx: 0, cy: 16, rx: 16, ry: 4, fill: 'rgba(38,19,74,.18)' }, s);
      LANDMARK[lm.id](sv('g', null, s));
      sv('rect', { x: -22, y: -30, width: 44, height: 50, fill: 'transparent' }, s);
      place(s, lm.x, lm.y, 0.8, 0.6);
    });
    // Each program's monster where it is, a little apart when two share a spot; the child's own monster at the last one.
    var spots = {}, last = null;
    st.places.forEach(function (pl) {
      var key = pl.k + '|' + (pl.st.h || '');
      if (spots[key]) return;
      var at = pl.st.ll ? xy(pl.st.ll) : pl.st.m && byId[pl.st.m] ? byId[pl.st.m].c.slice() : null;
      if (!at) return;
      spots[key] = true;
      var s = drawMonster(monsterFor(pl.k), 'onmap'); s.setAttribute('data-k', pl.k);
      place(s, at[0], at[1], 1, 1); things[things.length - 1].mon = true;
      last = at;
    });
    var home = last || (function () { var ch = M.landmarks.filter(function (l) { return l.id === 'city-hall'; })[0]; return ch ? [ch.x + 30, ch.y + 20] : [W / 2, H / 2]; })();
    var you = sv('svg', { viewBox: '0 -40 100 140', 'class': 'kc-you' });
    var flag = sv('g', null, you); sv('path', { d: 'M50 -36V0', stroke: INK, 'stroke-width': 3 }, flag); sv('path', { d: 'M50 -36H84L76 -27L84 -18H50Z', fill: '#FFD43B', stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, flag);
    var yt = sv('text', { x: 66, y: -21, 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'Luckiest Guy, Arial Black, sans-serif', fill: INK }, flag); yt.textContent = 'YOU';
    var mine = drawMonster(kidMonster(k.av)); mine.setAttribute('x', 0); mine.setAttribute('y', -12); mine.setAttribute('width', 100); mine.setAttribute('height', 112); you.appendChild(mine);
    place(you, home[0] + 16, home[1], 1.35, 1); things[things.length - 1].you = true;
    // zoom and drag, by changing what part of the map is in view
    var vb = { x: 0, y: 0, w: W, h: H };
    var fit = function () {
      var ids = Object.keys(open);
      if (!ids.length) { vb = { x: 0, y: 0, w: W, h: H }; return; }
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      ids.forEach(function (id) { var n = byId[id].d.match(/-?\d+(\.\d+)?/g); for (var i = 0; i + 1 < n.length; i += 2) { var x = +n[i], y = +n[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } });
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = Math.max(360, (x1 - x0) * 1.5), h = Math.max(w * H / W, (y1 - y0) * 1.5);
      w = h * W / H; vb = { x: cx - w / 2, y: cy - h / 2, w: w, h: h }; clamp();
    };
    var clamp = function () {
      vb.w = Math.max(160, Math.min(W, vb.w)); vb.h = vb.w * H / W;
      vb.x = Math.max(0, Math.min(W - vb.w, vb.x)); vb.y = Math.max(0, Math.min(H - vb.h, vb.y));
    };
    var apply = function () {
      svg.setAttribute('viewBox', vb.x.toFixed(1) + ' ' + vb.y.toFixed(1) + ' ' + vb.w.toFixed(1) + ' ' + vb.h.toFixed(1));
      var size = Math.max(16, Math.min(70, vb.w * 0.075));
      things.forEach(function (t) { t.dx = t.x; t.dy = t.y; });
      var mons = things.filter(function (t) { return t.mon || t.you; }), gap = size * 0.72;
      for (var it = 0; it < 12; it++) {   // monsters that stand too close step apart, a little at a time
        var shifted = false;
        for (var a = 0; a < mons.length; a++) for (var b2 = a + 1; b2 < mons.length; b2++) {
          var p = mons[a], q = mons[b2], ddx = q.dx - p.dx, ddy = q.dy - p.dy, d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d >= gap) continue;
          if (d < 0.01) { ddx = 1; ddy = 0.3; d = 1.04; }
          var push = (gap - d) / 2 / d; p.dx -= ddx * push; p.dy -= ddy * push; q.dx += ddx * push; q.dy += ddy * push; shifted = true;
        }
        if (!shifted) break;
      }
      things.forEach(function (t) { var s = size * t.base; t.n.setAttribute('width', s); t.n.setAttribute('height', s * 1.12); t.n.setAttribute('x', t.dx - s / 2); t.n.setAttribute('y', t.dy - s * 1.12 * (t.lift === 1 ? 0.92 : 0.6)); });
    };
    var zoom = function (f, cx, cy) {
      if (cx === undefined) { cx = vb.x + vb.w / 2; cy = vb.y + vb.h / 2; }
      var nw = Math.max(160, Math.min(W, vb.w * f)), r = nw / vb.w;
      vb.x = cx - (cx - vb.x) * r; vb.y = cy - (cy - vb.y) * r; vb.w = nw; vb.h = nw * H / W; clamp(); apply();
    };
    fit(); apply();
    box.appendChild(svg);
    var ctl = el('div', 'kc-mapctl');
    var zb = function (label, txt, f) { var b = btn('kc-zoom', txt, function () { Sound.play('tap'); f(); }); b.setAttribute('aria-label', label); return b; };
    ctl.appendChild(zb('Zoom in', '+', function () { zoom(0.66); }));
    ctl.appendChild(zb('Zoom out', '−', function () { zoom(1.5); }));
    ctl.appendChild(zb('Whole city', '⤢', function () { vb = { x: 0, y: 0, w: W, h: H }; apply(); }));
    box.appendChild(ctl);
    var bubble = el('div', 'kc-bubble'); bubble.hidden = true; box.appendChild(bubble);
    var say = function (cx, cy, title, line, more) {
      bubble.textContent = ''; bubble.appendChild(el('b', null, title)); if (line) bubble.appendChild(el('span', null, line));
      if (more) more.forEach(function (n) { bubble.appendChild(el('span', 'kc-bubble-li', n)); });
      var r = box.getBoundingClientRect(); bubble.hidden = false;
      var bx = Math.max(8, Math.min(r.width - bubble.offsetWidth - 8, cx - r.left - bubble.offsetWidth / 2)), by = Math.max(8, cy - r.top - bubble.offsetHeight - 16);
      bubble.style.left = bx + 'px'; bubble.style.top = by + 'px';
      anim(bubble, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 180, easing: 'ease-out' });
    };
    var tapAt = function (ev) {
      var t = document.elementFromPoint(ev.clientX, ev.clientY) || ev.target;   // the drag holds the pointer, so ask what is under it
      if (!t.closest) return;
      var lm = t.closest('[data-lm]'), mon = t.closest('[data-k]'), hood = t.closest('[data-hood]'), me = t.closest('.kc-you');
      if (me) { Sound.play('boing'); bounce(me); say(ev.clientX, ev.clientY, 'That’s you!', k.name + ' the monster'); return; }
      if (mon) { Sound.play('roar'); bounce(mon); var mk = mon.getAttribute('data-k'); say(ev.clientX, ev.clientY, nameOf(mk), ''); return; }
      if (lm) { Sound.play('pop'); var id = lm.getAttribute('data-lm'), L = M.landmarks.filter(function (x) { return x.id === id; })[0]; say(ev.clientX, ev.clientY, L ? L.name : '', LANDMARK_SAY[id] || ''); return; }
      if (hood) {
        var h = byId[hood.getAttribute('data-hood')];
        if (open[h.id]) { Sound.play('sparkle'); var here = []; st.places.forEach(function (pl) { if (pl.st.m === h.id && here.indexOf(nameOf(pl.k)) < 0) here.push(nameOf(pl.k)); }); say(ev.clientX, ev.clientY, h.name, 'You explored here!', here); }
        else { Sound.play('whoosh'); say(ev.clientX, ev.clientY, h.name, 'Still cloudy! A class here clears the clouds.'); }
        return;
      }
      bubble.hidden = true;
    };
    // drag to move, pinch or buttons to zoom; a touch that doesn't move is a tap
    var pts = {}, moved = false, startD = 0, startW = 0, last1 = null, downAt = null;
    var toMap = function (cx, cy) { var r = svg.getBoundingClientRect(); return [vb.x + (cx - r.left) / r.width * vb.w, vb.y + (cy - r.top) / r.height * vb.h]; };
    svg.addEventListener('pointerdown', function (ev) {
      pts[ev.pointerId] = [ev.clientX, ev.clientY];
      var ks = Object.keys(pts);
      if (ks.length === 1) { moved = false; last1 = downAt = [ev.clientX, ev.clientY]; }
      if (ks.length === 2) { var a = pts[ks[0]], b = pts[ks[1]]; startD = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; startW = vb.w; moved = true; }
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* older browsers */ }
    });
    svg.addEventListener('pointermove', function (ev) {
      if (!pts[ev.pointerId]) return;
      pts[ev.pointerId] = [ev.clientX, ev.clientY];
      var ks = Object.keys(pts), r = svg.getBoundingClientRect();
      if (ks.length === 2 && startD) { var a = pts[ks[0]], b = pts[ks[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; var c = toMap((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); zoom(Math.max(160, Math.min(W, startW * startD / d)) / vb.w, c[0], c[1]); bubble.hidden = true; return; }
      if (!moved && Math.abs(ev.clientX - downAt[0]) + Math.abs(ev.clientY - downAt[1]) < 8) return;
      moved = true;
      vb.x -= (ev.clientX - last1[0]) / r.width * vb.w; vb.y -= (ev.clientY - last1[1]) / r.height * vb.h; clamp(); apply(); bubble.hidden = true;
      last1 = [ev.clientX, ev.clientY];
    });
    var up = function (ev) {
      var was = !!pts[ev.pointerId]; delete pts[ev.pointerId];
      var ks = Object.keys(pts); if (ks.length < 2) startD = 0; if (ks.length === 1) last1 = pts[ks[0]];
      if (was && !moved && !ks.length && ev.type === 'pointerup') tapAt(ev);
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', function (ev) { ev.preventDefault(); var c = toMap(ev.clientX, ev.clientY); zoom(ev.deltaY > 0 ? 1.2 : 0.83, c[0], c[1]); }, { passive: false });
    // the places explored, in words too
    if (st.nh) {
      var names = []; Object.keys(open).forEach(function (id) { names.push(byId[id].name); });
      var ul = el('ul', 'kc-placelist'); names.sort().forEach(function (n) { ul.appendChild(el('li', null, n)); });
      box.parentNode.insertBefore(ul, box.nextSibling.nextSibling);
    }
  };

  // ----- the Battle tab: the monsters collected, the favorites, and the battle -----
  var drawBattleTab = function (body, k, st) {
    var keys = st.keys;
    if (k.fav.length) {
      var head = el('div', 'kc-sechead'); head.appendChild(el('h2', 'kc-h2', 'My champions')); body.appendChild(head);
      var pod = el('div', 'kc-podium');
      [1, 0, 2].forEach(function (i) {
        var key = k.fav[i]; if (!key || !listing(key)) return;
        var c = el('div', 'kc-step s' + (i + 1));
        var m = drawMonster(monsterFor(key), i === 0 ? 'bob' : ''); c.appendChild(m);
        c.appendChild(el('span', 'kc-medal', String(i + 1)));
        c.appendChild(el('b', null, nameOf(key)));
        pod.appendChild(c);
      });
      body.appendChild(pod);
    }
    var bh = el('div', 'kc-sechead'); bh.appendChild(el('h2', 'kc-h2', 'Monster battle')); body.appendChild(bh);
    if (keys.length >= 2) {
      body.appendChild(el('p', 'kc-say', 'Two monsters fight. You tap the winner! The last one standing is your favorite.'));
      body.appendChild(btn('kc-big go fight', k.fav.length ? 'Battle again!' : 'Start the battle!', function () { Sound.play('roar'); startBracket(keys); }));
    } else body.appendChild(el('p', 'kc-say', keys.length ? 'You have 1 monster. Get one more to battle!' : 'Every class brings a monster. Get two to battle!'));
    var ch = el('div', 'kc-sechead'); ch.appendChild(el('h2', 'kc-h2', 'My monsters')); ch.appendChild(el('span', 'kc-tally', String(keys.length))); body.appendChild(ch);
    var grid = el('div', 'kc-zoo');
    keys.forEach(function (key) {
      var c = btn('kc-moncard', '', function () { Sound.play('roar'); bounce(c.querySelector('svg')); });
      c.appendChild(drawMonster(monsterFor(key))); c.appendChild(el('b', null, nameOf(key)));
      var t = listing(key).t; if (t && t[0] && D.types[t[0]]) c.appendChild(el('small', null, D.types[t[0]].label));
      grid.appendChild(c);
    });
    if (!keys.length) { var c = el('div', 'kc-moncard empty'); c.appendChild(eggArt()); c.appendChild(el('b', null, '???')); grid.appendChild(c); }
    body.appendChild(grid);
  };
  var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  var startBracket = function (keys) { S.bracket = { round: shuffle(keys), next: [], out: [], i: 0, n: 1 }; go('fight'); };
  var CHEERS = ['Go go go!', 'You can do it!', 'Woo-hoo!', 'Awesome!', 'Whoa!', 'Yeah!'];
  var BURSTS = ['POW!', 'BAM!', 'ZAP!', 'BOOM!', 'WHAM!', 'KAPOW!'];
  var drawFight = function () {
    var k = kid(), b = S.bracket; if (!k || !b) { go('kid', 'battle', false); return; }
    setKidMode(true);
    if (b.i + 1 >= b.round.length) {   // one left over this round, or the round is done
      if (b.i < b.round.length) b.next.push(b.round[b.i]);
      if (b.next.length === 1) { champion(k, b); return; }
      b.round = shuffle(b.next); b.next = []; b.i = 0; b.n++;
    }
    var left = b.round.length - b.i + b.next.length;
    var page = el('section', 'kc-fight');
    var top = el('div', 'kc-fighttop');
    top.appendChild(btn('kc-back', '', function () { Sound.play('tap'); S.bracket = null; go('kid', 'battle'); })).setAttribute('aria-label', 'Stop the battle');
    top.lastChild.appendChild(icon('M18.3 5.7 16.9 4.3 12 9.2 7.1 4.3 5.7 5.7 10.6 12l-4.9 4.9 1.4 1.4L12 13.4l4.9 4.9 1.4-1.4-4.9-4.9z'));
    top.appendChild(el('p', 'kc-round', left <= 2 ? 'THE FINAL!' : 'Round ' + b.n + ' · ' + left + ' left'));
    top.appendChild(muteBtn());
    page.appendChild(top);
    page.appendChild(el('h1', 'kc-h kc-ask', 'Who wins?'));
    var arena = el('div', 'kc-arena'), fx = el('div', 'kc-fx');
    var pair = [b.round[b.i], b.round[b.i + 1]], cards = [];
    pair.forEach(function (key, idx) {
      var c = btn('kc-fighter ' + (idx ? 'right' : 'left'), '', function () { choose(idx); });
      var m = drawMonster(monsterFor(key), 'bob'), wrap = el('span', 'kc-fwrap'), flip = el('span', 'kc-flip'); flip.appendChild(m); wrap.appendChild(flip); c.appendChild(wrap);
      c.appendChild(el('b', null, nameOf(key)));
      c.setAttribute('aria-label', nameOf(key) + ' wins');
      cards.push(c); arena.appendChild(c);
      if (!idx) { var vs = el('span', 'kc-vs', 'VS'); arena.appendChild(vs); }
    });
    arena.appendChild(fx);
    page.appendChild(arena);
    page.appendChild(el('p', 'kc-say', 'Tap your favorite!'));
    var cheer = el('div', 'kc-cheer'); var me = drawMonster(kidMonster(k.av), 'bob'); cheer.appendChild(me); var said = el('span', 'kc-cheerbubble', pick(CHEERS)); cheer.appendChild(said); page.appendChild(cheer);
    app.appendChild(page);
    anim(arena.querySelector('.kc-vs'), [{ transform: 'scale(3) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1) rotate(-8deg)', opacity: 1 }], { duration: 400, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    var busy = false;
    var choose = function (idx) {
      if (busy) return; busy = true;
      cards.forEach(function (c) { c.disabled = true; });
      var win = cards[idx], lose = cards[1 - idx], wm = win.querySelector('.kc-fwrap'), lm = lose.querySelector('.kc-fwrap');
      var mon = monsterFor(pair[idx]);
      win.classList.add('winner'); arena.classList.add('fighting');
      Sound.play('roar'); said.textContent = pick(CHEERS); bounce(me);
      var fr = fx.getBoundingClientRect(), a = wm.getBoundingClientRect(), z = lm.getBoundingClientRect();
      var from = [a.left - fr.left + a.width / 2, a.top - fr.top + a.height / 2], to = [z.left - fr.left + z.width / 2, z.top - fr.top + z.height / 2];
      anim(wm, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-16%) scale(1.12)' }, { transform: 'translateY(0) scale(1)' }], { duration: 380, easing: 'ease-out' })
        .then(function () {
          var shots = [];
          for (var i = 0; i < 5; i++) (function (i) {
            shots.push(wait(i * 150).then(function () {
              var s = drawShot(mon.atk); fx.appendChild(s);
              var lift = 50 + Math.random() * 60, mx = (from[0] + to[0]) / 2, my = Math.min(from[1], to[1]) - lift;
              Sound.play('whoosh');
              return anim(s, [{ transform: 'translate(' + from[0] + 'px,' + from[1] + 'px) rotate(0) scale(.5)' }, { transform: 'translate(' + mx + 'px,' + my + 'px) rotate(200deg) scale(1.3)', offset: 0.5 }, { transform: 'translate(' + (to[0] + Math.random() * 30 - 15) + 'px,' + (to[1] + Math.random() * 30 - 15) + 'px) rotate(400deg) scale(1)' }], { duration: 480, easing: 'ease-in', fill: 'forwards' }).then(function () {
                s.remove(); Sound.play('pow'); hit(fx, to, lm);
              });
            }));
          })(i);
          return Promise.all(shots);
        })
        .then(function () {
          Sound.play('ko'); lose.classList.add('ko');
          var stars = el('span', 'kc-dizzy', '★ ★ ★'); lose.appendChild(stars);
          return anim(lm, [{ transform: 'rotate(0) translateY(0)', opacity: 1 }, { transform: 'rotate(-20deg) translateY(4%)', offset: 0.3 }, { transform: 'rotate(85deg) translateY(18%)', opacity: 0.55 }], { duration: 650, easing: 'ease-in', fill: 'forwards' });
        })
        .then(function () {
          Sound.play('boing'); win.appendChild(el('span', 'kc-wins', 'WINS!'));
          return anim(wm, [{ transform: 'translateY(0)' }, { transform: 'translateY(-22%)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-10%)' }, { transform: 'translateY(0)' }], { duration: 700, easing: 'ease-out' });
        })
        .then(function () { return wait(500); })
        .then(function () {
          if (S.bracket !== b || S.view !== 'fight') return;
          b.next.push(pair[idx]); b.out.push(pair[1 - idx]); b.i += 2;
          draw();
        });
    };
  };
  var hit = function (fx, at, target) {
    var bang = el('span', 'kc-pow', pick(BURSTS)); bang.style.left = at[0] + 'px'; bang.style.top = at[1] + 'px'; fx.appendChild(bang);
    anim(bang, [{ transform: 'translate(-50%,-50%) scale(0) rotate(-15deg)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.25) rotate(5deg)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 0 }], { duration: 520, easing: 'ease-out', fill: 'forwards' }).then(function () { bang.remove(); });
    anim(target, [{ transform: 'translateX(0)' }, { transform: 'translateX(-8%) rotate(-6deg)' }, { transform: 'translateX(7%) rotate(5deg)' }, { transform: 'translateX(0)' }], { duration: 260 });
  };
  var champion = function (k, b) {
    var winner = b.next[0], fav = [winner].concat(b.out.slice().reverse());
    S.bracket = null;
    var page = el('section', 'kc-fight kc-champ');
    page.appendChild(rays());
    page.appendChild(el('p', 'kc-burst', 'CHAMPION!'));
    var m = drawMonster(monsterFor(winner), 'bob big'); page.appendChild(m);
    page.appendChild(trophyArt());
    page.appendChild(el('h1', 'kc-h', nameOf(winner)));
    page.appendChild(el('p', 'kc-say', 'Your favorite! Your grown-ups will see it first when they plan.'));
    var acts = el('div', 'kc-avacts');
    acts.appendChild(btn('kc-big go', 'Yay!', function () { Sound.play('tap'); go('kid', 'battle'); }));
    page.appendChild(acts);
    var cheer = el('div', 'kc-cheer'); var me = drawMonster(kidMonster(k.av), 'bob'); cheer.appendChild(me); cheer.appendChild(el('span', 'kc-cheerbubble', 'We did it!')); page.appendChild(cheer);
    app.appendChild(page);
    Sound.play('fanfare'); setTimeout(function () { Sound.play('cheer'); }, 500); confetti(100);
    anim(m, [{ transform: 'translateY(40%) scale(.4)' }, { transform: 'translateY(-10%) scale(1.15)', offset: 0.7 }, { transform: 'translateY(0) scale(1)' }], { duration: 700, easing: 'ease-out' });
    save({ fav: fav }, function () { /* kept; the page stays on the champion */ });
  };
  var trophyArt = function () {
    var s = sv('svg', { viewBox: '0 0 100 100', 'class': 'kc-trophy', 'aria-hidden': 'true' });
    sv('path', { d: 'M28 10H72V36C72 50 62 60 50 60C38 60 28 50 28 36Z', fill: '#FFD43B', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, s);
    sv('path', { d: 'M28 16H14V24C14 34 22 40 30 40M72 16H86V24C86 34 78 40 70 40', fill: 'none', stroke: INK, 'stroke-width': 4 }, s);
    sv('rect', { x: 44, y: 60, width: 12, height: 16, fill: '#FAB005', stroke: INK, 'stroke-width': 3 }, s);
    sv('rect', { x: 30, y: 76, width: 40, height: 12, rx: 3, fill: '#7B4F2A', stroke: INK, 'stroke-width': 3 }, s);
    sv('path', { d: 'M38 18V34', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.7 }, s);
    return s;
  };

  // ----- the grown-ups' side: confirm, add, take off, share, print -----
  var drawGrownup = function () {
    setKidMode(false);
    var k = kid();
    var page = el('section', 'kc-grownup');
    var head = el('div', 'kc-ghead');
    head.appendChild(el('h2', null, k ? possessive(k.name) + ' Kid’s Corner: grown-ups' : 'Kid’s Corner: grown-ups'));
    var acts = el('div', 'actions');
    acts.appendChild(btn('btn primary', k ? 'Back to ' + possessive(k.name) + ' page' : 'Back to Kid’s Corner', function () { go(k ? 'kid' : 'pick'); }));
    if (S.data.kids.length > 1 || !k) acts.appendChild(btn('btn', 'Pick a child', function () { go('pick'); }));
    var acct = el('a', 'btn', 'My account'); acct.href = D.links.account; acts.appendChild(acct);
    head.appendChild(acts);
    head.appendChild(el('p', 'hint', 'Only what you confirm here counts. Pins, levels, the map and the monsters are worked out from it; nothing about your child is sent anywhere or counted by anything.'));
    page.appendChild(head);
    if (S.said) page.appendChild(el('p', 'g-status bad', S.said));
    if (!k) { page.appendChild(el('p', null, 'Pick a child to see their suggestions.')); app.appendChild(page); return; }

    // Suggestions from the plans.
    var sg = el('div', 'panel'); sg.appendChild(el('h3', null, 'From your plans'));
    if (k.suggest.length) {
      sg.appendChild(el('p', 'hint', 'These are on ' + possessive(k.name) + ' kept week, summer or days off. Did ' + k.name + ' go?'));
      var ul = el('ul', 'kc-suggest');
      k.suggest.forEach(function (sgt) {
        var li = el('li');
        var what = el('div', 'kc-sg-what'); what.appendChild(el('b', null, nameOf(sgt.k))); what.appendChild(el('span', null, (D.kinds[sgt.kind] || sgt.kind) + ', ' + yearLabel(sgt)));
        li.appendChild(what);
        var row = el('div', 'kc-sg-acts');
        row.appendChild(btn('btn primary', 'Yes, add it', function () { save({ done: k.done.concat([sgt]) }); }));
        row.appendChild(btn('btn', 'No', function () { save({ skip: k.skip.concat([sgt.k + '|' + sgt.kind + '|' + sgt.y]) }); }));
        li.appendChild(row); ul.appendChild(li);
      });
      sg.appendChild(ul);
    } else sg.appendChild(el('p', 'hint', 'Nothing waiting. A program on ' + possessive(k.name) + ' kept week, a camp whose week has started, or a day-off camp whose day has passed shows up here to confirm.'));
    page.appendChild(sg);

    // Add one by hand.
    var ad = el('div', 'panel'); ad.appendChild(el('h3', null, 'Add one the plans missed'));
    var form = el('form', 'kc-add');
    var f1 = el('div', 'field'); var lab = el('label', null, 'Program or camp'); lab.htmlFor = 'kc-add-q'; f1.appendChild(lab);
    var q = el('input'); q.id = 'kc-add-q'; q.type = 'search'; q.autocomplete = 'off'; q.placeholder = 'Start typing a name'; q.setAttribute('role', 'combobox'); q.setAttribute('aria-expanded', 'false'); f1.appendChild(q);
    var hits = el('ul', 'finder-list kc-hits'); hits.hidden = true; hits.setAttribute('role', 'listbox'); f1.appendChild(hits);
    form.appendChild(f1);
    var picked = null, pickedLine = el('p', 'kc-picked'); pickedLine.hidden = true; form.appendChild(pickedLine);
    var f2 = el('div', 'pair');
    var kindSel = el('select'); kindSel.id = 'kc-add-kind'; Object.keys(D.kinds).forEach(function (kd) { var o = el('option', null, D.kinds[kd]); o.value = kd; kindSel.appendChild(o); });
    var yearSel = el('select'); yearSel.id = 'kc-add-year';
    var kf = el('div', 'field'), kl = el('label', null, 'What kind'); kl.htmlFor = kindSel.id; kf.appendChild(kl); kf.appendChild(kindSel);
    var yf = el('div', 'field'), yl = el('label', null, 'When'); yl.htmlFor = yearSel.id; yf.appendChild(yl); yf.appendChild(yearSel);
    f2.appendChild(kf); f2.appendChild(yf); form.appendChild(f2);
    var fillYears = function () {
      yearSel.textContent = '';
      var summer = kindSel.value === 'summer';
      for (var y = D.year; y >= D.year - 4; y--) { var o = el('option', null, summer ? 'Summer ' + y : y + '–' + String(y + 1).slice(2)); o.value = String(y); yearSel.appendChild(o); }
    };
    fillYears(); kindSel.addEventListener('change', fillYears);
    var addBtn = el('button', 'btn primary', 'Add it'); addBtn.type = 'submit'; addBtn.disabled = true;
    var fa = el('div', 'actions'); fa.appendChild(addBtn); form.appendChild(fa);
    q.addEventListener('input', function () {
      var words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
      hits.textContent = '';
      if (!words.length) { hits.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
      var found = Object.keys(D.listings).filter(function (key) { var n = D.listings[key].n.toLowerCase(); return words.every(function (w) { return n.indexOf(w) > -1; }); }).slice(0, 8);
      found.forEach(function (key) {
        var li = el('li'); li.setAttribute('role', 'option');
        li.appendChild(btn('', D.listings[key].n + (key.charAt(0) === 'c' ? ' (summer camp)' : ''), function () { picked = key; pickedLine.textContent = 'Adding: ' + D.listings[key].n; pickedLine.hidden = false; if (key.charAt(0) === 'c') { kindSel.value = 'summer'; fillYears(); } q.value = ''; hits.hidden = true; addBtn.disabled = false; }));
        hits.appendChild(li);
      });
      if (!found.length) hits.appendChild(el('li', 'finder-note', 'Nothing by that name on the site yet.'));
      hits.hidden = false; q.setAttribute('aria-expanded', 'true');
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); if (!picked) return;
      var e = { k: picked, kind: kindSel.value, y: parseInt(yearSel.value, 10), s: '' };
      if (k.done.some(function (x) { return x.k === e.k && x.kind === e.kind && x.y === e.y; })) { S.said = 'That one is already there for that year.'; draw(); return; }
      save({ done: k.done.concat([e]) });
    });
    ad.appendChild(form); page.appendChild(ad);

    // What's on it, with a way to take one off, and a review in the child's words.
    var dl = el('div', 'panel'); dl.appendChild(el('h3', null, 'Where ' + k.name + ' has been'));
    if (k.done.length) {
      var list = el('ul', 'kc-donelist');
      k.done.slice().sort(function (a, b) { return b.y - a.y; }).forEach(function (x) {
        var li = el('li');
        var what = el('div', 'kc-sg-what'); what.appendChild(el('b', null, nameOf(x.k))); what.appendChild(el('span', null, (D.kinds[x.kind] || x.kind) + ', ' + yearLabel(x) + (x.s && D.schools[x.s] ? ', from ' + D.schools[x.s].n : '') + (x.h ? ', ' + x.h : '')));
        if (needsSite(x)) {   // several sites: which one, for the map
          var ask = el('div', 'kc-sites'); ask.appendChild(el('span', 'hint', 'Which location? '));
          listing(x.k).sites.forEach(function (st) { ask.appendChild(btn('chip-btn', st.h, function () { x.h = st.h; save({ done: k.done }); })); });
          what.appendChild(ask);
        }
        li.appendChild(what);
        var row = el('div', 'kc-sg-acts');
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

    // A picture to share (no name, no map), and print.
    var sh = el('div', 'panel'); sh.appendChild(el('h3', null, 'Share the pins'));
    sh.appendChild(el('p', 'hint', 'A picture of the pins and the level, with no name and no map, for the group chat or the fridge. It’s made here on this device; nothing is uploaded.'));
    var prev = el('canvas', 'kc-canvas'); prev.width = 1080; prev.height = 1350; prev.setAttribute('role', 'img'); prev.setAttribute('aria-label', 'A picture of the pins');
    var ready = drawShare(prev, k);
    var pv = el('div', 'card-preview'); pv.appendChild(prev); sh.appendChild(pv);
    var sa = el('div', 'actions');
    var blob = function (then) { ready.then(function () { prev.toBlob(then, 'image/png'); }); };
    if (navigator.share && navigator.canShare) sa.appendChild(btn('btn primary', 'Share the picture', function () { blob(function (b) { var f = new File([b], 'pins.png', { type: 'image/png' }); if (navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: 'My pins' }).catch(function () { /* closed */ }); }); }));
    sa.appendChild(btn('btn', 'Save as image', function () { blob(function (b) { var a = el('a'); a.href = URL.createObjectURL(b); a.download = 'pins.png'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }); }));
    sa.appendChild(btn('btn', 'Print the pins', function () { go('kid', 'pins', false); setTimeout(function () { window.print(); }, 400); }));
    sh.appendChild(sa); page.appendChild(sh);
    app.appendChild(page);
  };

  // The picture: the site's name, the child's monster, the level and the pins earned. No name, no map.
  var svgImage = function (node, size) {
    return new Promise(function (res) {
      var c = node.cloneNode(true); c.setAttribute('width', size); c.setAttribute('height', size); c.setAttribute('xmlns', NS);
      var img = new Image(); img.onload = function () { res(img); }; img.onerror = function () { res(null); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
    });
  };
  var drawShare = function (c, k) {
    var ctx = c.getContext('2d'), W = c.width, H = c.height, st = stats(k);
    var on = D.pins.filter(function (p) { return st.pins[p.id].tier; }).sort(function (a, b) { return st.pins[b.id].tier - st.pins[a.id].tier; });
    var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('80px "Luckiest Guy"'), document.fonts.load('800 30px Figtree')]).catch(function () { /* fallback fonts */ }) : Promise.resolve();
    var imgs = [k.av ? svgImage(drawMonster(kidMonster(k.av)), 260) : Promise.resolve(null)].concat(on.slice(0, 12).map(function (p) { return svgImage(drawPin(p, st.pins[p.id].tier), 200); }));
    return fonts.then(function () { return Promise.all(imgs); }).then(function (got) {
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6C4BD8'); g.addColorStop(1, '#2F9BE8'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; for (var i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((i * 263) % W, (i * 397) % H, 6 + (i % 5) * 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      ctx.font = '400 104px "Luckiest Guy", "Arial Black", Impact, sans-serif'; ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.strokeText('MY PINS', W / 2, 140); ctx.fillStyle = '#FFD43B'; ctx.fillText('MY PINS', W / 2, 140);
      if (got[0]) ctx.drawImage(got[0], W / 2 - 130, 160, 260, 290);
      ctx.font = '400 52px "Luckiest Guy", "Arial Black", Impact, sans-serif'; ctx.lineWidth = 10; ctx.strokeText(st.level.title + ' · Level ' + st.level.n, W / 2, got[0] ? 500 : 230); ctx.fillStyle = '#fff'; ctx.fillText(st.level.title + ' · Level ' + st.level.n, W / 2, got[0] ? 500 : 230);
      var cols = 4, size = 200, gapX = 30, x0 = (W - cols * size - (cols - 1) * gapX) / 2, y0 = got[0] ? 540 : 280;
      on.slice(0, 12).forEach(function (p, i) {
        var x = x0 + (i % cols) * (size + gapX), y = y0 + Math.floor(i / cols) * (size + 50);
        if (got[i + 1]) ctx.drawImage(got[i + 1], x + 20, y, size - 40, (size - 40) * 1.12);
        ctx.font = '800 25px Figtree, Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(p.label.length > 20 ? p.label.slice(0, 19) + '…' : p.label, x + size / 2, y + size + 8);
      });
      if (!on.length) { ctx.font = '700 40px Figtree, Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('The first pin is the first class!', W / 2, 760); }
      if (on.length > 12) { ctx.font = '700 30px Figtree, Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('and ' + (on.length - 12) + ' more', W / 2, H - 110); }
      ctx.font = '700 30px Figtree, Arial, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText(D.site + ' · ' + D.url, W / 2, H - 50);
    });
  };

  // ----- drawing -----
  var draw = function () {
    app.textContent = '';
    document.querySelectorAll('.kc-over').forEach(function (o) { if (!o.classList.contains('reveal') && !o.classList.contains('gift')) o.remove(); });
    if (S.view === 'kid') drawKid();
    else if (S.view === 'fight') drawFight();
    else if (S.view === 'avatar') drawAvatar();
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
      if (!p.ok) { outBox.hidden = false; outBox.insertBefore(el('p', 'g-status bad', p.message || 'Couldn’t open Kid’s Corner just now. Reload to try again.'), outBox.firstChild); return; }
      p.kids.forEach(function (k) { if (!k.seen || Array.isArray(k.seen)) k.seen = {}; });
      S.data = p; app.hidden = false;
      var h = (location.hash || '').slice(1);
      if (p.kids.length === 1) S.kid = 0;   // one child: straight to their page
      if (/^(pins|map|battle)$/.test(h)) S.tab = h;
      S.view = h === 'grownup' ? 'grownup' : S.kid > -1 ? 'kid' : 'pick';
      try { history.replaceState({ kc: S.view, tab: S.tab, kid: S.kid }, '', location.pathname + (S.view === 'pick' ? '' : S.view === 'kid' ? '#' + S.tab : '#' + S.view)); } catch (e) { /* no history */ }
      draw();
    });
  });
})();
