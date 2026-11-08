// Kid's Corner: a page of each child's own, inside a parent's account (kidsPage() in build.mjs). For ages about 5 to 10,
// in the site's colours: shiny pins that level up from bronze to silver to gold, a level that climbs, a cartoon map of
// Philadelphia whose clouds clear over the neighborhoods the child has been to, and a showdown where each program's
// lightbulb takes on another in a race, a glow-off or a dance-off and the child taps the winner (which ranks their
// favorites for the planners). Each child's bulb starts plain and gets more to wear as they level up.
// Each child picks a lightbulb of their own to be, and Eddie Bulboa, the bulb in the logo, shows them around and
// hosts the showdowns. What counts is what a parent has confirmed (the "passport" endpoint in groups/api.php): the page suggests
// from the household's plans, and the parent says yes or no behind the grown-ups' hold-to-open button, or on the
// account page's Kid's Corner tab (window.pasKids below draws that tab).
//
// Kid mode: while a child is holding the phone the site's header, menu and footer are hidden, nothing on the page is
// typed, and no link leaves the site. Nothing on this page is counted, recorded or sent anywhere but the household's
// own account. Every picture (bulbs, pins, the map and its landmarks) is drawn here as SVG, apart from Eddie, who is
// the logo's own art, and every sound is made here with the Web Audio API: nothing is fetched from anywhere but this
// site. Sounds play only after a tap, and the mute button is remembered on the device.
(function () {
  'use strict';
  if (!window.fetch || !window.Promise) return;
  var root = document.getElementById('kc');   // Kid's Corner itself; without it, this is the account page's tab (window.pasKids)
  var D = root ? JSON.parse(document.getElementById('kc-data').textContent) : null;
  var API = root ? root.getAttribute('data-api') || '' : '';
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
      zap: function (t) { tone(1400, t, 0.18, 'sawtooth', 0.06, 300); noise(t, 0.12, 0.12, 3000, 800); },
      go: function (t) { tone(880, t, 0.12, 'square', 0.07); tone(880, t + 0.2, 0.12, 'square', 0.07); tone(1320, t + 0.4, 0.45, 'square', 0.08); },
      glow: function (t) { tone(260, t, 1.3, 'sine', 0.14, 1300); tone(390, t + 0.1, 1.2, 'triangle', 0.06, 1950); },
      dance: function (t) { for (var i = 0; i < 8; i++) { if (i % 2 === 0) tone(130, t + i * 0.16, 0.14, 'sine', 0.3, 45); noise(t + i * 0.16 + 0.08, 0.05, 0.12, 6000, 9000); } [523, 659, 784, 659].forEach(function (f, i) { tone(f, t + i * 0.32, 0.25, 'triangle', 0.06); }); },
      clap: function (t) { [0, 0.18, 0.36, 0.5].forEach(function (d) { noise(t + d, 0.09, 0.32, 1800, 1200); }); },
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

  // ----- lightbulbs: a family for each kind of program, every program a little different -----
  // Drawn in the logo's colours: navy outlines, a sky-blue screw base, Bell Yellow light. Eddie Bulboa, the bulb in the
  // logo, is the logo art itself (bulb.png); every other bulb is drawn here.
  var INK = '#0B2140';
  var hsl = function (h, s, l) { return 'hsl(' + ((((Math.round(h)) % 360) + 360) % 360) + ',' + Math.round(s) + '%,' + Math.round(l) + '%)'; };
  var hexHsl = function (hex) {
    var n = parseInt(String(hex).slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) { var d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; }
    return [h, s * 100, l * 100];
  };
  // Each bulb's glass: where a hat sits ("top"), where the eyes sit ("eye") and how wide the glass is there ("w").
  // Every glass meets the same screw base at y 66.
  var BULB = {
    classic: { d: 'M38 66C38 56 22 50 22 34C22 16 35 6 50 6C65 6 78 16 78 34C78 50 62 56 62 66Z', top: 9, eye: 30, w: 26 },
    globe: { d: 'M40 66C40 60 16 56 16 34C16 14 32 2 50 2C68 2 84 14 84 34C84 56 60 60 60 66Z', top: 5, eye: 30, w: 31 },
    edison: { d: 'M38 66C34 56 28 46 28 30C28 12 38 2 50 2C62 2 72 12 72 30C72 46 66 56 62 66Z', top: 5, eye: 28, w: 21 },
    candle: { d: 'M40 66C40 52 30 44 32 28C34 16 44 8 50 -4C56 8 66 16 68 28C70 44 60 52 60 66Z', top: 9, eye: 32, w: 18 },
    flood: { d: 'M38 66L24 36C21 29 23 13 50 12C77 13 79 29 76 36L62 66Z', top: 13, eye: 31, w: 24 },
    tube: { d: 'M38 66C34 62 30 58 30 50V16C30 4 70 4 70 16V50C70 58 66 62 62 66Z', top: 7, eye: 26, w: 20 },
    twisty: { d: 'M38 66C30 66 28 58 34 56C24 56 24 46 34 44C24 44 24 34 34 32C26 30 28 20 38 20C42 10 58 10 62 20C72 20 74 30 66 32C76 34 76 44 66 44C76 46 76 56 66 56C72 58 70 66 62 66Z', coil: 'M33 32H67M31 44H69M33 56H67', top: 14, eye: 30, w: 17 },
    holiday: { d: 'M40 66C34 56 20 46 22 30C24 14 40 2 50 -6C60 2 76 14 78 30C80 46 66 56 60 66Z', top: 7, eye: 32, w: 26 },
    mushroom: { d: 'M40 66C40 58 32 56 26 50C12 44 10 28 22 18C32 8 68 8 78 18C90 28 88 44 74 50C68 56 60 58 60 66Z', top: 11, eye: 30, w: 30 },
    heart: { d: 'M38 66C38 58 14 46 14 26C14 12 26 4 36 4C43 4 48 8 50 14C52 8 57 4 64 4C74 4 86 12 86 26C86 46 62 58 62 66Z', top: 9, eye: 32, w: 28 }
  };
  var BULB_IDS = ['classic', 'globe', 'edison', 'candle', 'flood', 'tube', 'twisty', 'holiday', 'mushroom', 'heart'];
  var BEFORE = ['blob', 'tall', 'box', 'pear', 'ghost', 'spiky', 'bean', 'squid', 'egg', 'fuzzy'];   // the monsters the bulbs replaced, in the same order
  // The colours a child picks from: Bell Yellow first, then the sky and Franklin blues, then the rest.
  var KID_COLORS = ['#FFD43B', '#96C9FF', '#4D94E0', '#7ED07A', '#FF8A65', '#FFB347', '#FF9EC7', '#B9A3FF', '#7FE0C8', '#EEF3F9'];
  // What a child's bulb can wear, one thing in each place, each unlocked at a level: a child starts plain and picks
  // from more as they level up. (groups-api.php keeps the same ids, KC_WEAR.)
  var WEAR = [
    { id: 'shades', slot: 'face', name: 'Sunglasses', lvl: 2 }, { id: 'bow', slot: 'neck', name: 'Bow tie', lvl: 2 },
    { id: 'cap', slot: 'hat', name: 'Cap', lvl: 3 }, { id: 'scarf', slot: 'neck', name: 'Scarf', lvl: 3 },
    { id: 'cape', slot: 'back', name: 'Cape', lvl: 4 }, { id: 'stars', slot: 'face', name: 'Star glasses', lvl: 4 },
    { id: 'crown', slot: 'hat', name: 'Crown', lvl: 5 }, { id: 'sparkle', slot: 'glow', name: 'Sparkles', lvl: 5 },
    { id: 'medal', slot: 'neck', name: 'Gold medal', lvl: 6 }, { id: 'wings', slot: 'back', name: 'Wings', lvl: 7 },
    { id: 'tophat', slot: 'hat', name: 'Top hat', lvl: 8 }, { id: 'rainbow', slot: 'glow', name: 'Rainbow', lvl: 8 },
    { id: 'jetpack', slot: 'back', name: 'Jetpack', lvl: 9 }, { id: 'goldbase', slot: 'base', name: 'Gold base', lvl: 10 },
    { id: 'halo', slot: 'hat', name: 'Halo', lvl: 11 }, { id: 'galaxy', slot: 'glow', name: 'Galaxy glow', lvl: 12 }
  ];
  var WEAR_BY = {}; WEAR.forEach(function (x) { WEAR_BY[x.id] = x; });
  // The families: a bulb, something to wear, what they show off as their special move, and what Eddie calls it.
  var SPECIES = {
    aftercare: { shape: 'flood', acc: 'backpack', atk: 'plane', move: 'Paper planes!' },
    music: { shape: 'globe', acc: 'headphones', atk: 'note', move: 'Music blast!' },
    theater: { shape: 'edison', acc: 'tophat', atk: 'star', move: 'Star power!' },
    art: { shape: 'mushroom', acc: 'beret', atk: 'splat', move: 'Paint splat!' },
    movement: { shape: 'tube', acc: 'headband', atk: 'swirl', move: 'Whirlwind!' },
    stem: { shape: 'twisty', acc: 'goggles', atk: 'bolt', move: 'Lightning!' },
    academics: { shape: 'classic', acc: 'gradcap', atk: 'letter', move: 'Word power!' },
    games: { shape: 'classic', acc: 'propeller', atk: 'die', move: 'Dice roll!' },
    nature: { shape: 'heart', acc: 'sprout', atk: 'leaf', move: 'Leaf storm!' },
    daycamp: { shape: 'candle', acc: 'ranger', atk: 'flame', move: 'Campfire!' },
    clubs: { shape: 'holiday', acc: 'partyhat', atk: 'confetti', move: 'Party popper!' },
    'rec-center': { shape: 'globe', acc: 'ballcap', atk: 'ball', move: 'Slam dunk!' },
    _: { shape: 'classic', acc: '', atk: 'star', move: 'Star power!' }
  };
  var speciesOf = function (key) { var l = listing(key), t = l && l.t && l.t.length ? l.t[0] : ''; return SPECIES[t] ? t : '_'; };
  // A program's bulb: its family's shape and gear, glass tinted with its kind's colour, the face varied by its id.
  var bulbFor = function (key) {
    var t = speciesOf(key), sp = SPECIES[t], r = rng(hash(key)), base = t !== '_' && D.types[t] ? hexHsl(D.types[t].color) : [48, 90, 55];
    var h = base[0] + (r() * 16 - 8), L = 66 + Math.round(r() * 10);
    return { shape: sp.shape, glass: hsl(h, 80, L), dark: hsl(h, 60, L - 36), glow: hsl(h, 95, 72), eyes: r() < 0.3 ? 1 : 2, mouth: Math.floor(r() * 4), spots: r() < 0.35, blush: r() < 0.4, shades: r() < 0.12, acc: sp.acc, atk: sp.atk, move: sp.move };
  };
  // A child's own bulb: the shape and colour they picked, and what they chose to wear.
  var kidBulb = function (av) {
    var b = av && av.b; if (BEFORE.indexOf(b) > -1) b = BULB_IDS[BEFORE.indexOf(b)]; if (!BULB[b]) b = 'classic';
    var c = av && KID_COLORS[av.c] ? av.c : 0, x = hexHsl(KID_COLORS[c]);
    return { shape: b, glass: KID_COLORS[c], dark: hsl(x[0], Math.min(x[1], 55), Math.max(x[2] - 42, 20)), glow: c === 9 ? '#FFE066' : KID_COLORS[c], eyes: 2, mouth: 0, spots: false, blush: true, acc: '', wear: av && av.w ? av.w : {}, atk: 'star', move: 'Star power!' };
  };
  var uid = 0;
  // Draws a bulb. A lit bulb glows; add the class "off" and it goes dark, its eyes closed (asleep).
  var drawBulb = function (m, cls) {
    var b = BULB[m.shape] || BULB.classic, id = 'kcb' + (++uid), T = b.top, ey = b.eye, w = b.w;
    var s = sv('svg', { viewBox: '0 -22 100 124', 'class': 'kc-bulb' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', focusable: 'false' });
    var defs = sv('defs', null, s);
    var rg = sv('radialGradient', { id: id + 'g' }, defs);
    [[0, 0.8], [0.45, 0.4], [1, 0]].forEach(function (x) { sv('stop', { offset: x[0], 'stop-color': m.glow, 'stop-opacity': x[1] }, rg); });
    sv('path', { d: b.d }, sv('clipPath', { id: id + 'c' }, defs));
    var g = sv('g', { 'class': 'kc-bulb-g' }, s);
    var ink = function (o, width) { o.stroke = INK; o['stroke-width'] = width || 3; o['stroke-linejoin'] = 'round'; o['stroke-linecap'] = 'round'; return o; };
    var ink0 = function (o) { return ink(o, 2.5); };
    sv('circle', { 'class': 'kc-glow', cx: 50, cy: ey + 4, r: 54, fill: 'url(#' + id + 'g)' }, g);
    var wr = m.wear || {};
    if (wr.glow === 'galaxy') { sv('circle', { 'class': 'kc-glow', cx: 50, cy: ey + 8, r: 50, fill: '#1B2366', opacity: 0.9 }, g); [[14, 8], [84, 2], [92, 40], [8, 50], [30, -8], [70, -12], [88, 74], [12, 82], [50, -16]].forEach(function (q, i) { sv(i % 3 ? 'circle' : 'path', i % 3 ? { cx: q[0], cy: q[1], r: 1.8, fill: '#fff' } : { 'class': 'kc-twinkle', d: TWINKLE, transform: 'translate(' + q[0] + ' ' + q[1] + ') scale(.6)', fill: '#fff' }, g); }); }
    if (wr.glow === 'rainbow') [['#CC3000', 47], ['#F3C613', 42], ['#3FA34D', 37], ['#2176D2', 32]].forEach(function (c) { sv('path', { d: 'M' + (50 - c[1]) + ' ' + (ey + 16) + 'A' + c[1] + ' ' + c[1] + ' 0 0 1 ' + (50 + c[1]) + ' ' + (ey + 16), fill: 'none', stroke: c[0], 'stroke-width': 5, 'stroke-linecap': 'round' }, g); });
    if (wr.back === 'cape') { sv('path', ink0({ d: 'M34 58C22 74 15 90 17 100H83C85 90 78 74 66 58Z', fill: '#CC3000' }), g); sv('path', { d: 'M29 72C25 84 23 93 23 100M71 72C75 84 77 93 77 100', fill: 'none', stroke: '#8A1F00', 'stroke-width': 2 }, g); }
    if (wr.back === 'wings') [-1, 1].forEach(function (sd) { var wg = sv('g', sd > 0 ? { transform: 'translate(100 0) scale(-1 1)' } : null, g), x0 = 50 - w - 2, y0 = ey + 10; [[x0 - 9, y0 - 9, 15, 5, -32], [x0 - 12, y0 + 2, 16, 5.5, -10], [x0 - 9, y0 + 12, 13, 5, 14]].forEach(function (f) { sv('ellipse', { cx: f[0], cy: f[1], rx: f[2], ry: f[3], fill: '#fff', stroke: INK, 'stroke-width': 2, transform: 'rotate(' + f[4] + ' ' + f[0] + ' ' + f[1] + ')' }, wg); }); });
    if (wr.back === 'jetpack') [-1, 1].forEach(function (sd) { var x = 50 + sd * (w + 3) - 6; sv('path', { 'class': 'kc-flame', d: 'M' + (x + 1.5) + ' ' + (ey + 34) + 'Q' + (x + 6) + ' ' + (ey + 56) + ' ' + (x + 10.5) + ' ' + (ey + 34) + 'Z', fill: '#FF922B', stroke: INK, 'stroke-width': 1.5 }, g); sv('rect', { x: x, y: ey + 4, width: 12, height: 32, rx: 6, fill: '#ADB5BD', stroke: INK, 'stroke-width': 2.2 }, g); sv('rect', { x: x + 2, y: ey + 9, width: 8, height: 4, rx: 2, fill: '#CC3000' }, g); });
    // arms behind the glass, hands down
    var ay = ey + 18, sx = Math.min(w, 26) - 2;
    [-1, 1].forEach(function (sd) {
      var x0 = 50 + sd * sx;
      sv('path', { d: 'M' + x0 + ' ' + ay + 'Q' + (x0 + sd * 12) + ' ' + (ay + 4) + ' ' + (x0 + sd * 14) + ' ' + (ay + 15), fill: 'none', stroke: INK, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, g);
      sv('circle', ink({ cx: x0 + sd * 14, cy: ay + 16, r: 4.5, fill: '#fff' }, 2.5), g);
    });
    // legs and feet under the base
    sv('path', { d: 'M45 89L43 96M55 89L57 96', fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    sv('ellipse', { cx: 40.5, cy: 97.5, rx: 5.5, ry: 3, fill: INK }, g); sv('ellipse', { cx: 59.5, cy: 97.5, rx: 5.5, ry: 3, fill: INK }, g);
    // the glass, lit and unlit
    sv('path', { 'class': 'kc-lit', d: b.d, fill: m.glass }, g);
    sv('path', { 'class': 'kc-unlit', d: b.d, fill: '#C3CCD8' }, g);
    var inner = sv('g', { 'clip-path': 'url(#' + id + 'c)' }, g);
    if (b.coil) sv('path', { d: b.coil, fill: 'none', stroke: m.dark, 'stroke-width': 1.8, opacity: 0.35 }, inner);
    else if (ey + 30 < 62) { sv('path', { d: 'M45 67V59M55 67V59', fill: 'none', stroke: m.dark, 'stroke-width': 1.5, opacity: 0.6 }, inner); sv('path', { d: 'M45 59q1.25 -3.2 2.5 0t2.5 0t2.5 0t2.5 0', fill: 'none', stroke: m.dark, 'stroke-width': 1.6, opacity: 0.7 }, inner); }
    sv('ellipse', { cx: 50 - w * 0.55, cy: ey - 9, rx: 4.5, ry: 9, fill: '#fff', opacity: 0.6, transform: 'rotate(28 ' + (50 - w * 0.55) + ' ' + (ey - 9) + ')' }, inner);
    if (m.spots) [[50 - w * 0.62, ey + 10], [50 - w * 0.48, ey + 13], [50 + w * 0.56, ey + 11]].forEach(function (p) { sv('circle', { cx: p[0], cy: p[1], r: 1.4, fill: m.dark, opacity: 0.6 }, inner); });
    if (m.acc === 'headband') { sv('rect', { x: 0, y: ey - 17, width: 100, height: 7, fill: '#fff' }, inner); sv('rect', { x: 0, y: ey - 14.8, width: 100, height: 2.6, fill: '#2176D2' }, inner); }
    if (m.acc === 'goggles') sv('rect', { x: 0, y: T + 6, width: 100, height: 5, fill: INK }, inner);
    if (m.acc === 'backpack') { sv('rect', { x: 50 - w * 0.62 - 3, y: ey + 8, width: 6, height: 60, fill: '#F3C613' }, inner); sv('rect', { x: 50 + w * 0.62 - 3, y: ey + 8, width: 6, height: 60, fill: '#F3C613' }, inner); }
    sv('path', ink({ d: b.d, fill: 'none' }), g);
    // the screw base, in the logo's sky blues
    var bf = wr.base === 'goldbase' ? ['#FFF3B0', '#F3C613', '#E0B400'] : ['#E6F2FF', '#C3E1FF', '#96C9FF'];
    sv('rect', ink({ x: 37, y: 64, width: 26, height: 7, rx: 3.5, fill: bf[0] }, 2.5), g);
    sv('rect', ink({ x: 38, y: 70, width: 24, height: 7, rx: 3.5, fill: bf[1] }, 2.5), g);
    sv('rect', ink({ x: 39, y: 76, width: 22, height: 7, rx: 3.5, fill: bf[2] }, 2.5), g);
    sv('path', { d: 'M43 82.5H57L54 89H46Z', fill: INK }, g);
    // eyes (a group that blinks), and the closed eyes of a bulb that's off
    var ex = m.eyes === 1 ? [[50, ey, Math.min(11, w * 0.45)]] : [[50 - w * 0.42, ey, Math.min(8.5, w * 0.36)], [50 + w * 0.42, ey, Math.min(8.5, w * 0.36)]];
    if (wr.face === 'stars') ex.forEach(function (e) { var d = '', R = e[2] + 6.5; for (var k = 0; k < 10; k++) { var an = -Math.PI / 2 + Math.PI * k / 5, rr = k % 2 ? R * 0.55 : R; d += (k ? 'L' : 'M') + (e[0] + rr * Math.cos(an)).toFixed(1) + ' ' + (e[1] + rr * Math.sin(an)).toFixed(1); } sv('path', { d: d + 'Z', fill: '#FF9EC7', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g); });
    var eg = sv('g', { 'class': 'kc-eyes' }, g), xg = sv('g', { 'class': 'kc-xeyes' }, g);
    ex.forEach(function (e) {
      sv('circle', { cx: e[0], cy: e[1], r: e[2], fill: '#fff', stroke: INK, 'stroke-width': 2.5 }, eg);
      sv('circle', { cx: e[0] + e[2] * 0.2, cy: e[1] + e[2] * 0.12, r: e[2] * 0.52, fill: INK }, eg);
      sv('circle', { cx: e[0], cy: e[1] - e[2] * 0.25, r: e[2] * 0.2, fill: '#fff' }, eg);
      var q = e[2] * 0.7; sv('path', { d: 'M' + (e[0] - q) + ' ' + e[1] + 'Q' + e[0] + ' ' + (e[1] + q) + ' ' + (e[0] + q) + ' ' + e[1], fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }, xg);
    });
    if (m.shades || wr.face === 'shades') { ex.forEach(function (e) { sv('rect', { x: e[0] - e[2] - 2, y: e[1] - e[2] * 0.75, width: 2 * e[2] + 4, height: e[2] * 1.5, rx: 3, fill: INK }, eg); sv('path', { d: 'M' + (e[0] - e[2] + 1) + ' ' + (e[1] - e[2] * 0.3) + 'l3 -2', stroke: '#fff', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, eg); }); if (ex.length > 1) sv('path', { d: 'M' + (ex[0][0] + ex[0][2]) + ' ' + ex[0][1] + 'H' + (ex[1][0] - ex[1][2]), stroke: INK, 'stroke-width': 2.5 }, eg); }
    if (m.acc === 'gradcap') {   // glasses go with the cap
      ex.forEach(function (e) { sv('circle', { cx: e[0], cy: e[1], r: e[2] + 3, fill: 'none', stroke: INK, 'stroke-width': 2.2 }, g); });
      if (ex.length > 1) sv('path', { d: 'M' + (ex[0][0] + ex[0][2] + 3) + ' ' + ex[0][1] + 'L' + (ex[1][0] - ex[1][2] - 3) + ' ' + ex[1][1], stroke: INK, 'stroke-width': 2.2 }, g);
    }
    // mouth and cheeks
    var my = ey + (m.eyes === 1 ? 16 : 13), mw = Math.min(11, w * 0.5);
    if (m.mouth === 0) { sv('path', ink({ d: 'M' + (50 - mw) + ' ' + my + 'Q50 ' + (my + 14) + ' ' + (50 + mw) + ' ' + my + 'Z', fill: INK }, 2), g); sv('path', { d: 'M' + (50 - mw * 0.55) + ' ' + (my + 6) + 'Q50 ' + (my + 3) + ' ' + (50 + mw * 0.55) + ' ' + (my + 6) + 'Q50 ' + (my + 10) + ' ' + (50 - mw * 0.55) + ' ' + (my + 6) + 'Z', fill: '#FF7A8A' }, g); }
    if (m.mouth === 1) { sv('ellipse', ink({ cx: 50, cy: my + 4, rx: 5.5, ry: 6.5, fill: INK }, 2), g); sv('ellipse', { cx: 50, cy: my + 7.5, rx: 3.5, ry: 2.2, fill: '#FF7A8A' }, g); }
    if (m.mouth === 2) { sv('path', ink({ d: 'M' + (50 - mw) + ' ' + my + 'H' + (50 + mw) + 'Q' + (50 + mw - 3) + ' ' + (my + 11) + ' 50 ' + (my + 11) + 'Q' + (50 - mw + 3) + ' ' + (my + 11) + ' ' + (50 - mw) + ' ' + my + 'Z', fill: INK }, 2), g); sv('rect', { x: 50 - mw + 3, y: my + 0.5, width: 2 * mw - 6, height: 3.2, fill: '#fff' }, g); }
    if (m.mouth === 3) sv('path', { d: 'M' + (50 - mw * 0.6) + ' ' + (my + 1) + 'Q50 ' + (my + 9) + ' ' + (50 + mw * 0.6) + ' ' + (my + 1), fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    if (m.blush) { sv('ellipse', { cx: 50 - w * 0.68, cy: my - 2, rx: 4, ry: 2.4, fill: '#FF7A8A', opacity: 0.55 }, g); sv('ellipse', { cx: 50 + w * 0.68, cy: my - 2, rx: 4, ry: 2.4, fill: '#FF7A8A', opacity: 0.55 }, g); }
    if (wr.neck === 'bow') { sv('path', ink0({ d: 'M50 63L39 57V69ZM50 63L61 57V69Z', fill: '#2176D2' }), g); sv('circle', ink0({ cx: 50, cy: 63, r: 3, fill: '#0F4D90' }), g); }
    if (wr.neck === 'scarf') { sv('path', ink0({ d: 'M56 63L59 82L66 80L62 62Z', fill: '#CC3000' }), g); sv('rect', ink0({ x: 34, y: 58.5, width: 32, height: 8, rx: 4, fill: '#CC3000' }), g); sv('path', { d: 'M41 59V66M48 59V66M55 59V66', stroke: '#fff', 'stroke-width': 1.6 }, g); }
    if (wr.neck === 'medal') { sv('path', { d: 'M41 59L50 73L59 59', fill: 'none', stroke: '#2176D2', 'stroke-width': 4.5, 'stroke-linejoin': 'round' }, g); sv('circle', ink0({ cx: 50, cy: 78, r: 7.5, fill: '#F3C613' }), g); sv('path', { d: STAR, transform: 'translate(50 78) scale(.75)', fill: '#fff' }, g); }
    // what they wear: a family's gear, or what a child picked to put on their head
    var a = m.acc || ({ cap: 'ballcap', crown: 'crown', tophat: 'tophat' })[wr.hat] || '';
    if (a === 'headphones') {
      var hd = 'M' + (50 - w - 3) + ' ' + ey + 'C' + (50 - w - 3) + ' ' + (T - 16) + ' ' + (50 + w + 3) + ' ' + (T - 16) + ' ' + (50 + w + 3) + ' ' + ey;
      sv('path', { d: hd, fill: 'none', stroke: INK, 'stroke-width': 8, 'stroke-linecap': 'round' }, g); sv('path', { d: hd, fill: 'none', stroke: '#2176D2', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
      sv('rect', ink({ x: 50 - w - 9, y: ey - 9, width: 12, height: 19, rx: 5, fill: '#2176D2' }, 2.5), g); sv('rect', ink({ x: 50 + w - 3, y: ey - 9, width: 12, height: 19, rx: 5, fill: '#2176D2' }, 2.5), g);
    }
    if (a === 'tophat') { var th = sv('g', { transform: 'rotate(-10 50 ' + T + ')' }, g); sv('rect', { x: 30, y: T - 5, width: 40, height: 6, rx: 3, fill: INK }, th); sv('rect', { x: 37, y: T - 28, width: 26, height: 24, rx: 2, fill: INK }, th); sv('rect', { x: 37, y: T - 10, width: 26, height: 5, fill: '#CC3000' }, th); }
    if (a === 'beret') { sv('ellipse', ink({ cx: 56, cy: T + 1, rx: 20, ry: 7.5, fill: '#CC3000' }, 2.5), g); sv('circle', ink({ cx: 58, cy: T - 7, r: 3, fill: '#CC3000' }, 2), g); }
    if (a === 'goggles') [-1, 1].forEach(function (sd) { sv('circle', ink({ cx: 50 + sd * w * 0.45, cy: T + 9, r: 7, fill: '#C3E1FF' }, 3), g); sv('path', { d: 'M' + (50 + sd * w * 0.45 - 3.5) + ' ' + (T + 6.5) + 'l3 -2', stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g); });
    if (a === 'gradcap') { sv('rect', { x: 40, y: T - 3, width: 20, height: 7, fill: INK }, g); sv('path', { d: 'M28 ' + (T - 3) + 'L50 ' + (T - 12) + 'L72 ' + (T - 3) + 'L50 ' + (T + 6) + 'Z', fill: INK }, g); sv('path', { d: 'M50 ' + (T - 3) + 'L68 ' + (T + 2) + 'L68 ' + (T + 12), fill: 'none', stroke: '#F3C613', 'stroke-width': 2 }, g); sv('circle', { cx: 68, cy: T + 13, r: 2.6, fill: '#F3C613' }, g); }
    if (a === 'propeller') {
      sv('path', ink({ d: 'M35 ' + (T + 7) + 'A15 13 0 0 1 65 ' + (T + 7) + 'Z', fill: '#F3C613' }, 2.5), g);
      sv('path', { d: 'M50 ' + (T - 5) + 'V' + (T + 7), stroke: '#2176D2', 'stroke-width': 4 }, g);
      sv('rect', { x: 49, y: T - 13, width: 2, height: 8, fill: INK }, g);
      var pr = sv('g', { 'class': 'kc-prop', style: 'transform-origin:50px ' + (T - 13) + 'px' }, g);
      sv('ellipse', ink({ cx: 42, cy: T - 13, rx: 8, ry: 3, fill: '#CC3000' }, 1.8), pr); sv('ellipse', ink({ cx: 58, cy: T - 13, rx: 8, ry: 3, fill: '#2176D2' }, 1.8), pr);
    }
    if (a === 'sprout') {
      sv('path', { d: 'M50 ' + (T + 3) + 'Q48 ' + (T - 5) + ' 50 ' + (T - 11), fill: 'none', stroke: '#2B8A3E', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      var lf = 'M50 ' + (T - 10) + 'C42 ' + (T - 21) + ' 32 ' + (T - 15) + ' 34 ' + (T - 7) + 'C40 ' + (T - 4) + ' 46 ' + (T - 6) + ' 50 ' + (T - 10) + 'Z';
      sv('path', ink({ d: lf, fill: '#51CF66' }, 2), g); sv('path', ink({ d: lf, fill: '#51CF66', transform: 'translate(100 0) scale(-1 1)' }, 2), g);
    }
    if (a === 'ranger') { sv('path', ink({ d: 'M37 ' + (T + 4) + 'Q38 ' + (T - 15) + ' 50 ' + (T - 13) + 'Q62 ' + (T - 15) + ' 63 ' + (T + 4) + 'Z', fill: '#C9A06A' }, 2.5), g); sv('ellipse', ink({ cx: 50, cy: T + 4, rx: 27, ry: 5, fill: '#C9A06A' }, 2.5), g); sv('path', { d: 'M38 ' + (T - 1) + 'H62', stroke: '#7B4F2A', 'stroke-width': 3 }, g); }
    if (a === 'partyhat') { sv('path', ink({ d: 'M38 ' + (T + 7) + 'L50 ' + (T - 24) + 'L62 ' + (T + 7) + 'Z', fill: '#2176D2' }, 2.5), g); sv('path', { d: 'M42 ' + (T - 3) + 'L56 ' + (T - 8) + 'M40 ' + (T + 4) + 'L59 ' + (T - 2), stroke: '#F3C613', 'stroke-width': 3 }, g); sv('circle', ink({ cx: 50, cy: T - 25, r: 4.5, fill: '#F3C613' }, 2), g); }
    if (a === 'ballcap') { sv('path', ink({ d: 'M62 ' + (T + 6) + 'Q82 ' + (T + 3) + ' 83 ' + (T + 10) + 'Q72 ' + (T + 12) + ' 62 ' + (T + 10) + 'Z', fill: '#0F4D90' }, 2.5), g); sv('path', ink({ d: 'M33 ' + (T + 9) + 'A17 15 0 0 1 67 ' + (T + 9) + 'Z', fill: '#2176D2' }, 2.5), g); sv('circle', { cx: 50, cy: T - 6, r: 2.5, fill: INK }, g); }
    if (a === 'backpack') sv('rect', ink({ x: 44, y: ey + 24, width: 12, height: 8, rx: 2, fill: '#F3C613' }, 2), g);
    if (a === 'crown') { sv('path', ink({ d: 'M36 ' + (T + 4) + 'L35 ' + (T - 12) + 'L43 ' + (T - 4) + 'L50 ' + (T - 16) + 'L57 ' + (T - 4) + 'L65 ' + (T - 12) + 'L64 ' + (T + 4) + 'Z', fill: '#F3C613' }, 2.5), g); sv('circle', { cx: 50, cy: T - 3, r: 2.6, fill: '#CC3000' }, g); sv('circle', { cx: 42, cy: T, r: 2, fill: '#2176D2' }, g); sv('circle', { cx: 58, cy: T, r: 2, fill: '#2176D2' }, g); }
    if (wr.hat === 'halo') { sv('ellipse', { cx: 50, cy: T - 12, rx: 17, ry: 4.8, fill: 'none', stroke: '#E0B400', 'stroke-width': 6 }, g); sv('ellipse', { cx: 50, cy: T - 12, rx: 17, ry: 4.8, fill: 'none', stroke: '#FFF3B0', 'stroke-width': 2.5 }, g); }
    if (wr.glow === 'sparkle') [[6, 8, 0], [94, 2, 0.6], [97, 58, 1.2], [3, 64, 1.8], [50, T - 26, 0.9]].forEach(function (q) { sv('path', { 'class': 'kc-twinkle', d: TWINKLE, transform: 'translate(' + q[0] + ' ' + q[1] + ')', fill: '#FFF3B0', stroke: '#E0B400', 'stroke-width': 1.2, style: 'animation-delay:' + q[2] + 's' }, g); });
    return s;
  };
  // A bulb nobody has picked yet: dark, with a question mark.
  var unlitBulb = function () {
    var m = kidBulb({ b: 'classic', c: 9 }); m.acc = ''; m.mouth = -1; m.blush = false;
    var s = drawBulb(m, 'off kc-unpicked');
    var q = sv('text', { x: 50, y: 42, 'text-anchor': 'middle', 'font-size': 30, 'font-family': 'Luckiest Guy, Arial Black, sans-serif', fill: INK }, s); q.textContent = '?';
    return s;
  };
  // Eddie Bulboa, the bulb in the logo, with something to say. He faces left, so what he says sits to his left.
  var eddie = function (text, cls) {
    var box = el('div', 'kc-eddie' + (cls ? ' ' + cls : ''));
    var img = el('img', 'kc-eddie-img'); img.src = D.eddie; img.alt = 'Eddie Bulboa'; img.width = 327; img.height = 400; box.appendChild(img);
    var say = el('p', 'kc-eddie-say', text || ''); say.hidden = !text; box.appendChild(say);
    box.say = function (t) { say.textContent = t; say.hidden = !t; anim(say, [{ transform: 'scale(.8)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' }); };
    return box;
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
    repeat: [(function () { var d = ''; for (var i = 0; i < 6; i++) { var a = Math.PI * 2 * i / 6 - Math.PI / 2; d += (i ? 'L' : 'M') + (50 + 47 * Math.cos(a)).toFixed(1) + ' ' + (50 + 47 * Math.sin(a)).toFixed(1); } return d + 'Z'; })(),
      (function () { var d = ''; for (var i = 0; i < 6; i++) { var a = Math.PI * 2 * i / 6 - Math.PI / 2; d += (i ? 'L' : 'M') + (50 + 36 * Math.cos(a)).toFixed(1) + ' ' + (50 + 36 * Math.sin(a)).toFixed(1); } return d + 'Z'; })(), 50],
    explore: [(function () { var d = ''; for (var i = 0; i < 16; i++) { var r = i % 2 ? 38 : 47, a = Math.PI * 2 * i / 16 - Math.PI / 2; d += (i ? 'L' : 'M') + (50 + r * Math.cos(a)).toFixed(1) + ' ' + (50 + r * Math.sin(a)).toFixed(1); } return d + 'Z'; })(), 'M50 20A30 30 0 1 1 49.99 20Z', 50]
  };
  // A pin gets grander as it levels up. Bronze: the pin and one star. Silver: a laurel wreath, a blue banner, a gem and
  // two stars. Gold: a turning sunburst, wings, a gold laurel, a crown, a red banner with three stars, and sparkles.
  var STAR = 'M0 -6l1.8 3.8 4.2.5-3.1 2.8.8 4.1L0 3.1l-3.7 2.1.8-4.1-3.1-2.8 4.2-.5z';
  var TWINKLE = 'M0 -7L1.6 -1.6L7 0L1.6 1.6L0 7L-1.6 1.6L-7 0L-1.6 -1.6Z';
  var laurel = function (s, leaf, stem) {
    [-1, 1].forEach(function (sd) {
      var g = sv('g', sd > 0 ? { transform: 'translate(100 0) scale(-1 1)' } : null, s), r0 = Math.PI / 180, R = 58;
      sv('path', { d: 'M' + (50 + R * Math.cos(100 * r0)).toFixed(1) + ' ' + (50 + R * Math.sin(100 * r0)).toFixed(1) + 'A' + R + ' ' + R + ' 0 0 1 ' + (50 + R * Math.cos(214 * r0)).toFixed(1) + ' ' + (50 + R * Math.sin(214 * r0)).toFixed(1), fill: 'none', stroke: stem, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, g);
      for (var a = 106, i = 0; a <= 214; a += 12, i++) {
        var side = i % 2 ? 1 : -1, rr = R + side * 4.5, x = 50 + rr * Math.cos(a * r0), y = 50 + rr * Math.sin(a * r0);
        sv('ellipse', { cx: x.toFixed(1), cy: y.toFixed(1), rx: 7.5, ry: 3.6, fill: leaf, stroke: INK, 'stroke-width': 1.4, transform: 'rotate(' + (a + 90 + side * 32) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')' }, g);
      }
    });
  };
  var drawPin = function (p, tier) {
    var id = 'kcp' + (++uid), sh = PIN_SHAPE[p.group] || PIN_SHAPE.type, cy = sh[2];
    var s = sv('svg', { viewBox: '-30 -24 160 144', 'class': 'kc-pin t' + tier, 'aria-hidden': 'true', focusable: 'false' });
    var defs = sv('defs', null, s);
    if (tier) {
      var lg = sv('linearGradient', { id: id + 'm', x1: 0, y1: 0, x2: 1, y2: 1 }, defs), st = METAL[tier];
      [[0, st[0]], [0.3, st[1]], [0.5, st[2]], [0.72, st[1]], [1, st[3]]].forEach(function (x) { sv('stop', { offset: x[0], 'stop-color': x[1] }, lg); });
      sv('path', { d: sh[0] }, sv('clipPath', { id: id + 'c' }, defs));
    }
    if (tier === 3) {   // behind it all: a sunburst, and wings
      var rg = sv('radialGradient', { id: id + 'r' }, defs);
      [[0, '#FFF6C7'], [0.6, '#FFD84D'], [1, '#F3C613']].forEach(function (x) { sv('stop', { offset: x[0], 'stop-color': x[1] }, rg); });
      var pts = ''; for (var k = 0; k < 36; k++) { var ang = Math.PI * 2 * k / 36, r = k % 2 ? 58 : 74; pts += (k ? 'L' : 'M') + (50 + r * Math.cos(ang)).toFixed(1) + ' ' + (50 + r * Math.sin(ang)).toFixed(1); }
      sv('path', { 'class': 'kc-pinrays', d: pts + 'Z', fill: 'url(#' + id + 'r)', stroke: '#E0B400', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, s);
      [-1, 1].forEach(function (sd) {
        var wg = sv('g', sd > 0 ? { transform: 'translate(100 0) scale(-1 1)' } : null, s);
        [[-12, 30, 20, 6.5, -30], [-17, 44, 22, 7, -12], [-15, 58, 20, 6.5, 6], [-8, 70, 15, 5.5, 24]].forEach(function (f) { sv('ellipse', { cx: f[0], cy: f[1], rx: f[2], ry: f[3], fill: '#FFF3B0', stroke: INK, 'stroke-width': 2, transform: 'rotate(' + f[4] + ' ' + f[0] + ' ' + f[1] + ')' }, wg); });
      });
    }
    if (tier >= 2) laurel(s, tier === 3 ? '#FFD84D' : '#D6DEEA', tier === 3 ? '#B8860B' : '#8E9AB0');
    if (tier === 3) { sv('path', { d: 'M34 80L24 112L36 105L42 114L50 84Z', fill: '#CC3000', stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, s); sv('path', { d: 'M66 80L76 112L64 105L58 114L50 84Z', fill: '#CC3000', stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, s); }
    // the pin
    sv('path', { d: sh[0], fill: tier ? 'url(#' + id + 'm)' : '#C3CBD8', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }, s);
    sv('path', { d: sh[1], fill: tier ? p.color : '#E2E7EF', stroke: 'rgba(0,0,0,.28)', 'stroke-width': 2 }, s);
    var ic = sv('g', { transform: 'translate(' + (50 - 19.2) + ' ' + (cy - 19.2) + ') scale(1.6)' }, s);
    sv('path', { d: p.icon, fill: tier ? '#fff' : '#A9B3C4' }, ic);
    if (!tier) return s;
    sv('ellipse', { cx: 37, cy: cy - 16, rx: 16, ry: 8, fill: '#fff', opacity: 0.22, transform: 'rotate(-32 37 ' + (cy - 16) + ')' }, s);
    var sg = sv('g', { 'clip-path': 'url(#' + id + 'c)' }, s);
    sv('rect', { 'class': 'kc-shine', x: -40, y: -20, width: 18, height: 150, fill: '#fff', opacity: 0.55 }, sv('g', { transform: 'rotate(22 50 50)' }, sg));
    if (tier >= 2) {   // a banner across the foot, its ends folded behind
      var band = tier === 3 ? '#CC3000' : '#2176D2', fold = tier === 3 ? '#8A1F00' : '#0F4D90';
      sv('path', { d: 'M0 88H16V104H0L6 96Z', fill: fold, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, s);
      sv('path', { d: 'M100 88H84V104H100L94 96Z', fill: fold, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, s);
      sv('rect', { x: 12, y: 85, width: 76, height: 16, rx: 2, fill: band, stroke: INK, 'stroke-width': 2.2 }, s);
      sv('circle', { cx: 50, cy: 4, r: 5.5, fill: tier === 3 ? '#CC3000' : '#96C9FF', stroke: INK, 'stroke-width': 2 }, s);   // a gem in the rim
    }
    var sy = tier >= 2 ? 93 : (p.group === 'season' ? 90 : 89);
    for (var i = 0; i < tier; i++) sv('path', { d: STAR, transform: 'translate(' + (50 + (i - (tier - 1) / 2) * 14) + ' ' + sy + ')', fill: tier >= 2 ? '#F3C613' : '#FFF', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, s);
    if (tier === 3) {   // a crown on top, and sparkles around
      sv('path', { d: 'M34 4L32 -14L42 -5L50 -19L58 -5L68 -14L66 4Z', fill: 'url(#' + id + 'm)', stroke: INK, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, s);
      sv('circle', { cx: 50, cy: -6, r: 2.8, fill: '#2176D2' }, s); sv('circle', { cx: 40, cy: -2, r: 2.2, fill: '#CC3000' }, s); sv('circle', { cx: 60, cy: -2, r: 2.2, fill: '#CC3000' }, s);
      [[-18, -6, 0], [118, 2, 0.5], [-22, 92, 1], [120, 84, 1.5]].forEach(function (t) { sv('path', { 'class': 'kc-twinkle', d: TWINKLE, transform: 'translate(' + t[0] + ' ' + t[1] + ')', fill: '#fff', stroke: '#E0B400', 'stroke-width': 1.2, style: 'animation-delay:' + t[2] + 's' }, s); });
    }
    return s;
  };

  // ----- what a child has earned, worked out from what a parent confirmed -----
  var LEVELS = [0, 15, 40, 75, 120, 175, 240, 315, 400, 495, 600, 715, 840, 975, 1120];
  var TITLES = ['Rookie', 'Rookie', 'Explorer', 'Explorer', 'Adventurer', 'Adventurer', 'Trailblazer', 'Trailblazer', 'Champion', 'Champion', 'Legend'];
  var need = function (n) { return n - 1 < LEVELS.length ? LEVELS[n - 1] : LEVELS[LEVELS.length - 1] + (n - LEVELS.length) * 150; };   // points to reach level n
  var levelOf = function (xp) { var n = 1; while (xp >= need(n + 1)) n++; return { n: n, title: TITLES[Math.min(n - 1, TITLES.length - 1)], from: need(n), to: need(n + 1) }; };
  var stats = function (k) {
    var types = {}, kinds = {}, hoods = {}, places = [], keys = [], seenKey = {}, n = 0, times = {}, weeks = 0, near = {}, inHood = {};
    k.done.forEach(function (e) {
      var l = listing(e.k); if (!l) return;
      var x = Math.max(1, e.n || 1);   // days a week, terms, weeks of the same camp: each time after the first is a repeat
      n++; kinds[e.kind] = (kinds[e.kind] || 0) + 1; times[e.k] = (times[e.k] || 0) + x; if (e.kind === 'summer') weeks += x;
      (l.t || []).forEach(function (t) { types[t] = (types[t] || 0) + 1; });
      if (!seenKey[e.k]) { seenKey[e.k] = true; keys.push(e.k); }
      var st = siteOf(e);
      if (st) { var hid = st.m || 'n:' + st.h; hoods[hid] = true; places.push({ k: e.k, st: st }); if (st.a) (near[st.a] = near[st.a] || {})[e.k] = true; if (st.m) (inHood[st.m] = inHood[st.m] || {})[e.k] = true; }
    });
    // the map's secret spots: each area's open one by one, a class nearby for each
    var spots = {}, found = 0, hidden = 0;
    (D.areas || []).forEach(function (a) { var c = Object.keys(near[a.id] || {}).length, open = Math.min(c, a.items.length); spots[a.id] = { c: c, open: open }; found += open; hidden += a.items.length; });
    // the neighborhoods' surprises: the first with a class there, the second with another
    var sur = {}, surFound = 0;
    Object.keys(D.surprises || {}).forEach(function (h) { var c = Object.keys(inHood[h] || {}).length; if (c) { sur[h] = { c: c, open: Math.min(c, D.surprises[h].s.length) }; surFound += sur[h].open; } });
    var nh = Object.keys(hoods).length, pins = {}, tiers = 0, repeats = 0;
    keys.forEach(function (key) { repeats += times[key] - 1; });
    D.pins.forEach(function (p) {
      var c = p.group === 'type' ? types[p.id.slice(5)] || 0 : p.id === 'season:summer' ? weeks : p.group === 'season' ? kinds[p.id.slice(7)] || 0 : p.group === 'repeat' ? repeats : nh, tier = 0;
      p.tiers.forEach(function (t, i) { if (c >= t) tier = i + 1; });
      pins[p.id] = { c: c, tier: tier, next: tier < 3 ? p.tiers[tier] : 0 };
      tiers += tier;
    });
    var xp = n * 10 + repeats * 5 + nh * 5 + tiers * 5;   // going back counts toward the level too
    return { n: n, nh: nh, hoods: hoods, places: places, keys: keys, times: times, repeats: repeats, spots: spots, found: found, hidden: hidden, sur: sur, surFound: surFound, pins: pins, tiers: tiers, xp: xp, level: levelOf(xp) };
  };

  // ----- state -----
  var S = { data: null, kid: -1, view: 'pick', tab: 'pins', bracket: null, saving: false, said: '', fresh: null, tour: null };
  var kid = function () { return S.data && S.kid > -1 ? S.data.kids[S.kid] : null; };
  var setKidMode = function (on) { html.classList.toggle('kc-kid', !!on); };
  var go = function (view, tab, push) {
    S.view = view; if (tab) S.tab = tab;
    var h = view === 'pick' ? '' : view === 'kid' ? '#' + S.tab : '#' + view;
    if (push !== false) { try { history.pushState({ kc: view, tab: S.tab, kid: S.kid }, '', location.pathname + h); } catch (e) { /* no history */ } }
    draw();
    window.scrollTo(0, 0);
  };
  if (root) window.addEventListener('popstate', function (ev) {
    var st = ev.state && ev.state.kc ? ev.state : { kc: 'pick' };
    if (st.kc !== 'pick' && st.kc !== 'grownup' && !kid()) st = { kc: 'pick' };
    if (st.kc === 'fight' && !S.bracket) st = { kc: 'kid', tab: 'battle' };
    if (st.kc === 'tour' && !S.tour) st = { kc: 'kid', tab: 'pins' };
    S.view = st.kc; if (st.tab) S.tab = st.tab; draw();
  });

  // Save this child's lists, then keep the server's answer (which also brings fresh suggestions).
  // A suggestion from the plans, and the answer to it. One already confirmed comes back when the plans count it more
  // times ("up": what it was): yes sets the new count, no isn't asked again for that count.
  var sgKey = function (e) { return e.k + '|' + e.kind + '|' + e.y; };
  var timesWord = function (kind, n) { return kind === 'summer' ? plural(n, 'week', 'weeks') : kind === 'off' ? plural(n, 'day', 'days') : n === 1 ? 'once a week' : n + ' days a week'; };
  var sgLine = function (sgt) { return (D.kinds[sgt.kind] || sgt.kind) + ', ' + yearLabel(sgt) + (sgt.up ? ' · now ' + timesWord(sgt.kind, sgt.n) + ' (was ' + timesWord(sgt.kind, sgt.up) + ')' : sgt.n ? ' · ' + timesWord(sgt.kind, sgt.n) : ''); };
  var sgAnswer = function (k, sgt, yes) {
    if (sgt.up) return yes ? { done: k.done.map(function (x) { if (sgKey(x) !== sgKey(sgt)) return x; var y = {}; Object.keys(x).forEach(function (f) { y[f] = x[f]; }); y.n = sgt.n; return y; }) } : { skip: k.skip.concat([sgKey(sgt) + '|' + sgt.n]) };
    var e = { k: sgt.k, kind: sgt.kind, y: sgt.y, s: sgt.s || '' }; if (sgt.n) e.n = sgt.n;
    return yes ? { done: k.done.concat([e]) } : { skip: k.skip.concat([sgKey(sgt)]) };
  };
  // Start over: Kid's Corner from the beginning for one child (for a grown-up who tried it out first). Their bulb, what
  // they've been shown, Eddie's welcome and their favorites go; the classes stay unless the box is ticked. Two taps.
  var startOver = function (k, then) {
    var box = el('div', 'kc-reset');
    box.appendChild(el('p', 'hint', 'Like new for ' + k.name + ': Eddie’s welcome, picking a bulb, and unwrapping every pin, secret spot and surprise again. The showdown favorites go too. This can’t be undone.'));
    var cb = null;
    if (k.done.length) {
      var lab = el('label', 'g-check'); cb = el('input'); cb.type = 'checkbox'; cb.id = 'kc-reset-' + (++uid);
      lab.appendChild(cb); lab.appendChild(el('span', null, 'Also take off the ' + plural(k.done.length, 'class or camp', 'classes and camps') + ' you confirmed'));
      box.appendChild(lab);
    }
    var row = el('div', 'actions'), msg = el('p', 'g-status'); msg.hidden = true;
    var armed = false, first = 'Start over for ' + k.name;
    var b = btn('btn primary kc-reset-go', first, function () {
      if (!armed) { armed = true; b.textContent = 'Tap again to start over'; window.setTimeout(function () { armed = false; b.textContent = first; }, 6000); return; }
      b.disabled = true;
      call('passport_reset', { kid: k.name, classes: !!(cb && cb.checked) }).then(function (d) {
        if (!d.ok) { b.disabled = false; armed = false; b.textContent = first; msg.className = 'g-status bad'; msg.textContent = d.message || 'That didn’t work. Try again.'; msg.hidden = false; return; }
        ['done', 'skip', 'fav', 'suggest', 'updated', 'av', 'seen', 'lvl'].forEach(function (f) { k[f] = d.kid[f]; });
        if (!k.seen || Array.isArray(k.seen)) k.seen = {};
        then();
      });
    });
    row.appendChild(b); box.appendChild(row); box.appendChild(msg);
    return box;
  };
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
    var colors = ['#F3C613', '#96C9FF', '#2176D2', '#FFFFFF', '#5CB85C', '#CC3000'];
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
    box.appendChild(eddie('Hi! I’m Eddie Bulboa. Tap your name!', 'kc-host'));
    var row = el('div', 'kc-kids');
    S.data.kids.forEach(function (k, i) {
      var st = stats(k);
      var b = btn('kc-kidbtn', '', function () { Sound.play('pop'); S.kid = i; S.bracket = null; S.tour = null; go('kid', 'pins'); });   // the page itself starts Eddie's welcome or the bulb picking, if due
      var face = el('span', 'kc-kidface');
      face.appendChild(k.av ? drawBulb(kidBulb(k.av), 'bob') : unlitBulb());
      b.appendChild(face);
      b.appendChild(el('b', null, k.name));
      b.appendChild(el('small', null, k.av ? st.level.title + ' · Level ' + st.level.n : 'Tap to light up your bulb!'));
      row.appendChild(b);
    });
    box.appendChild(row);
    box.appendChild(grownupRow());
    app.appendChild(box);
  };

  // ----- picking a bulb: a shape, a colour and what to wear, no typing -----
  var unlockedAt = function (lvl) { return WEAR.filter(function (x) { return x.lvl <= lvl; }); };
  var drawAvatar = function () {
    var k = kid(); if (!k) { go('pick', null, false); return; }
    setKidMode(true);
    var lvl = stats(k).level.n;
    var start = k.av ? kidBulb(k.av) : null, cur = start ? { b: start.shape, c: KID_COLORS.indexOf(start.glass), w: {} } : { b: 'classic', c: 0, w: {} };
    if (cur.c < 0) cur.c = 0;
    if (k.av && k.av.w) Object.keys(k.av.w).forEach(function (sl) { var it = WEAR_BY[k.av.w[sl]]; if (it && it.lvl <= lvl) cur.w[sl] = it.id; });
    var page = el('section', 'kc-avatar');
    var top = el('div', 'kc-picktop'); top.appendChild(el('h1', 'kc-h', k.av ? 'My bulb' : 'Pick your bulb!')); top.appendChild(muteBtn()); page.appendChild(top);
    var host = eddie(k.av ? 'Change it up! Level up to unlock more stuff to wear.' : 'Pick a bulb and a color. That’s you!', 'kc-host'); page.appendChild(host);
    var stage = el('div', 'kc-avstage'); page.appendChild(stage);
    var paintStage = function () { stage.textContent = ''; var m = drawBulb(kidBulb(cur), 'bob big'); stage.appendChild(m); bounce(m); };
    var head = function (t) { var h = el('div', 'kc-sechead'); h.appendChild(el('h2', 'kc-h2', t)); return h; };
    var bodies = el('div', 'kc-bodies'); bodies.setAttribute('role', 'group'); bodies.setAttribute('aria-label', 'Bulbs');
    var colors = el('div', 'kc-colors'); colors.setAttribute('role', 'group'); colors.setAttribute('aria-label', 'Colors');
    var wardrobe = el('div', 'kc-wardrobe'); wardrobe.setAttribute('role', 'group'); wardrobe.setAttribute('aria-label', 'Things to wear');
    var paintChoices = function () {
      bodies.textContent = ''; colors.textContent = ''; wardrobe.textContent = '';
      BULB_IDS.forEach(function (b, i) {
        var c = btn('kc-bodybtn' + (cur.b === b ? ' on' : ''), '', function () { cur.b = b; Sound.play('zap'); paintChoices(); paintStage(); });
        c.setAttribute('aria-label', 'Bulb ' + (i + 1)); c.setAttribute('aria-pressed', cur.b === b ? 'true' : 'false');
        c.appendChild(drawBulb(kidBulb({ b: b, c: cur.c }))); bodies.appendChild(c);
      });
      KID_COLORS.forEach(function (hex, i) {
        var c = btn('kc-swatch' + (cur.c === i ? ' on' : ''), '', function () { cur.c = i; Sound.play('tap'); paintChoices(); paintStage(); });
        c.style.background = hex; c.setAttribute('aria-label', 'Color ' + (i + 1)); c.setAttribute('aria-pressed', cur.c === i ? 'true' : 'false');
        colors.appendChild(c);
      });
      WEAR.forEach(function (it) {
        var open = it.lvl <= lvl, on = cur.w[it.slot] === it.id;
        var c = btn('kc-wearbtn' + (on ? ' on' : '') + (open ? '' : ' locked'), '', function () {
          if (!open) { Sound.play('tap'); host.say('Reach level ' + it.lvl + ' to wear the ' + it.name.toLowerCase() + '!'); return; }
          if (on) delete cur.w[it.slot]; else cur.w[it.slot] = it.id;
          Sound.play(on ? 'tap' : 'sparkle'); paintChoices(); paintStage();
        });
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
        c.setAttribute('aria-label', it.name + (open ? (on ? ', wearing' : '') : ', unlocks at level ' + it.lvl));
        var wearOne = {}; wearOne[it.slot] = it.id;
        c.appendChild(drawBulb(kidBulb({ b: cur.b, c: cur.c, w: wearOne }), open ? '' : 'off kc-unpicked'));
        c.appendChild(el('b', null, it.name));
        if (!open) c.appendChild(el('span', 'kc-lock', 'Level ' + it.lvl));
        wardrobe.appendChild(c);
      });
    };
    page.appendChild(head('Shape')); page.appendChild(bodies);
    page.appendChild(head('Color')); page.appendChild(colors);
    var wh = head('Dress up'); wh.appendChild(el('span', 'kc-tally', unlockedAt(lvl).length + ' / ' + WEAR.length)); page.appendChild(wh); page.appendChild(wardrobe);
    var acts = el('div', 'kc-avacts');
    acts.appendChild(btn('kc-big go', 'That’s me!', function () {
      Sound.play('sparkle'); confetti(40);
      var av = { b: cur.b, c: cur.c }; if (Object.keys(cur.w).length) av.w = cur.w;
      save({ av: av }, function () { if (S.tour) go('tour'); else go('kid', S.tab || 'pins'); });   // in Eddie's welcome: on to the next part
    }));
    if (k.av) acts.appendChild(btn('kc-big ghost', 'Never mind', function () { if (S.tour) go('tour'); else go('kid'); }));
    page.appendChild(acts);
    app.appendChild(page);
    paintChoices(); paintStage();
  };

  // ----- the child's page: a header with their bulb and level, three tabs -----
  var drawKid = function () {
    var k = kid(); if (!k) { go('pick', null, false); return; }
    if (!k.seen.intro) { S.tour = S.tour || { step: 0 }; S.view = 'tour'; drawTour(); return; }   // the first time: Eddie shows them round
    if (!k.av) { S.view = 'avatar'; drawAvatar(); return; }
    setKidMode(true);
    var st = stats(k);
    var page = el('section', 'kc-page kc-tab-' + S.tab);
    var top = el('header', 'kc-top');
    if (S.data.kids.length > 1) { var back = btn('kc-back', '', function () { Sound.play('tap'); go('pick'); }); back.setAttribute('aria-label', 'Who’s playing?'); back.appendChild(icon('M15.4 4.6 8 12l7.4 7.4-1.8 1.8L4.4 12l9.2-9.2z')); top.appendChild(back); }
    var me = btn('kc-me', '', function () { Sound.play('boing'); go('avatar'); }); me.setAttribute('aria-label', 'My bulb: change it and dress it up'); me.appendChild(drawBulb(kidBulb(k.av), 'bob')); top.appendChild(me);
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
    [['pins', 'Pins', 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z'], ['map', 'Map', 'M15 4 9 2 3 4v18l6-2 6 2 6-2V2zm0 15.8-6-2V4.2l6 2z'], ['battle', 'Showdown', 'M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v3H8v-3h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3zm-1 4v1a2 2 0 0 0 2 2V7zm11 0v3a2 2 0 0 0 2-2V7z']].forEach(function (t) {
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

  // What the child has been shown: every pin at its level, every spot found, and whether Eddie has welcomed them.
  var shownNow = function (k, st) {
    var seen = {}; D.pins.forEach(function (p) { if (st.pins[p.id].tier) seen[p.id] = st.pins[p.id].tier; });
    (D.areas || []).forEach(function (a) { if (st.spots[a.id].open) seen['map:' + a.id] = st.spots[a.id].open; });
    Object.keys(st.sur).forEach(function (h) { seen['hood:' + h] = st.sur[h].open; });
    if (k.seen.intro) seen.intro = 1;
    return seen;
  };

  // ----- Eddie's welcome: the first time a child opens their page -----
  // Six short steps, one big button each: hello; their own bulb (the bulb picker, then back here); the pins they have
  // already (shown here instead of the usual unwrapping); the map and its secret spots; picking a favorite; off you go.
  // "Skip" is there for a grown-up. A grown-up can play it again from the grown-ups' corner.
  var TOUR_STEPS = 6;
  var drawTour = function () {
    var k = kid(); if (!k) { go('pick', null, false); return; }
    if (!S.tour) S.tour = { step: 0 };
    setKidMode(true);
    var st = stats(k), step = Math.min(S.tour.step, TOUR_STEPS - 1);
    var page = el('section', 'kc-tour kc-tour' + step);
    var top = el('div', 'kc-picktop');
    var dots = el('div', 'kc-dots'); dots.setAttribute('aria-label', 'Part ' + (step + 1) + ' of ' + TOUR_STEPS);
    for (var i = 0; i < TOUR_STEPS; i++) dots.appendChild(el('i', i === step ? 'on' : i < step ? 'done' : ''));
    top.appendChild(dots); top.appendChild(muteBtn()); page.appendChild(top);
    var next = function () { Sound.play('pop'); S.tour.step = step + 1; go('tour'); };
    var finish = function () {   // all of it shown: nothing to unwrap afterwards
      Sound.play('fanfare'); confetti(80);
      k.seen.intro = 1; var seen = shownNow(k, st); S.tour = null;
      save({ seen: seen, lvl: st.level.n }, function () { go('kid', 'pins'); });
    };
    var skip = function () {   // straight to the page; what's new still gets unwrapped there
      Sound.play('tap');
      var seen = {}; Object.keys(k.seen).forEach(function (f) { seen[f] = k.seen[f]; }); seen.intro = 1; k.seen.intro = 1; S.tour = null;
      save({ seen: seen }, function () { go('kid', 'pins'); });
    };
    var card = el('div', 'kc-tourcard');   // one card in the middle of the screen, on a phone or a laptop
    var say = function (t) { var e = eddie(t, 'kc-host kc-tour-host'); card.appendChild(e); return e; };
    var show = el('div', 'kc-tourshow');
    var acts = el('div', 'kc-avacts');
    var nameUp = k.name;
    if (step === 0) {
      say('Hi, ' + nameUp + '! I’m Eddie Bulboa. Welcome to YOUR Kid’s Corner!');
      var big = el('img', 'kc-tour-big'); big.src = D.eddie; big.alt = ''; big.width = 327; big.height = 400; show.appendChild(big);
      acts.appendChild(btn('kc-big go', 'Hi, Eddie!', next));
    } else if (step === 1) {
      if (!k.av) {
        say('First, let’s make your very own bulb. That’s you in here!');
        [{ b: 'globe', c: 1 }, { b: 'heart', c: 6 }, { b: 'candle', c: 3 }].forEach(function (x, j) { var m = drawBulb(kidBulb(x), 'bob'); m.style.animationDelay = (j * 0.3) + 's'; show.appendChild(m); });
        acts.appendChild(btn('kc-big go', 'Make my bulb!', function () { Sound.play('pop'); S.tour.step = 2; go('avatar'); }));
      } else {
        say('Here’s your bulb! Tap it at the top any time to change it, and dress it up as you level up.');
        var mine = drawBulb(kidBulb(k.av), 'bob big'); show.appendChild(mine);
        acts.appendChild(btn('kc-big go', 'Next', next));
        acts.appendChild(btn('kc-big ghost', 'Change it', function () { Sound.play('tap'); S.tour.step = 2; go('avatar'); }));
      }
    } else if (step === 2) {
      var got = D.pins.filter(function (p) { return st.pins[p.id].tier; }).sort(function (a, b) { return st.pins[b.id].tier - st.pins[a.id].tier; });
      say(got.length ? 'Look! You already have ' + plural(got.length, 'pin', 'pins') + '!' : 'Every class you go to gets you a pin. Your grown-up adds them!');
      var grid = el('div', 'kc-pins kc-mini');
      (got.length ? got.slice(0, 9) : D.pins.slice(0, 3)).forEach(function (p, j) {
        var x = st.pins[p.id], c = el('div', 'kc-pincard t' + x.tier); var pv = drawPin(p, x.tier); c.appendChild(pv); c.appendChild(el('b', null, p.label)); grid.appendChild(c);
        anim(pv, [{ transform: 'scale(0)' }, { transform: 'scale(1.2)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 500, delay: Math.min(j * 110, 900), easing: 'ease-out', fill: 'backwards' });
      });
      show.appendChild(grid);
      if (got.length > 9) show.appendChild(el('p', 'kc-say small', 'and ' + (got.length - 9) + ' more!'));
      show.appendChild(el('p', 'kc-tour-lvl', st.level.title + ' · Level ' + st.level.n));
      show.appendChild(el('p', 'kc-say small', 'Pins go bronze, silver, then gold. Go back to a class you love for a Repeater Reward!'));
      acts.appendChild(btn('kc-big go', got.length ? 'Cool!' : 'Got it!', next));
      if (got.length) Sound.play('sparkle');
    } else if (step === 3) {
      say('This is your map of Philly. Every class clears the clouds and finds a surprise, and classes nearby find secret spots!');
      var row = el('div', 'kc-spotrow');
      [['art-museum', 'Found!'], ['?', 'Secret!']].forEach(function (x) { var c = el('div', 'kc-spot1'); c.appendChild(spotArt(x[0])); c.appendChild(el('b', null, x[1])); row.appendChild(c); });
      show.appendChild(row);
      show.appendChild(el('p', 'kc-tour-lvl', plural(st.nh, 'place', 'places') + ' explored' + (st.hidden ? ' · ' + st.found + ' / ' + st.hidden + ' secret spots' : '') + (st.surFound ? ' · ' + plural(st.surFound, 'surprise', 'surprises') : '')));
      acts.appendChild(btn('kc-big go', 'Next', next));
    } else if (step === 4) {
      say('Which class did you have the most fun at? I show you two at a time. You tap the one you liked more!');
      var vs = el('div', 'kc-tourvs');
      var two = st.keys.length >= 2 ? [bulbFor(st.keys[0]), bulbFor(st.keys[1])] : [kidBulb({ b: 'edison', c: 4 }), kidBulb({ b: 'flood', c: 8 })];
      vs.appendChild(drawBulb(two[0], 'bob')); vs.appendChild(el('span', 'kc-vs', 'VS')); vs.appendChild(drawBulb(two[1], 'bob'));
      show.appendChild(vs);
      if (st.keys.length >= 2) show.appendChild(el('p', 'kc-say small', nameOf(st.keys[0]) + ' or ' + nameOf(st.keys[1]) + '?'));
      acts.appendChild(btn('kc-big go', 'Next', next));
    } else {
      say('Every new class gets you more pins, more map and more stuff for your bulb. Ready, ' + nameUp + '?');
      var duo = el('div', 'kc-tourvs');
      if (k.av) duo.appendChild(drawBulb(kidBulb(k.av), 'bob big'));
      show.appendChild(duo);
      acts.appendChild(btn('kc-big go', 'Let’s go!', finish));
    }
    card.appendChild(show);
    if (step < TOUR_STEPS - 1) acts.appendChild(btn('kc-skip', 'Skip', skip));
    card.appendChild(acts);
    page.appendChild(card);
    app.appendChild(page);
    if (step === 0) anim(page.querySelector('.kc-tour-big'), [{ transform: 'translateY(40%) scale(.5) rotate(-10deg)', opacity: 0 }, { transform: 'translateY(-6%) scale(1.06) rotate(4deg)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 700, easing: 'ease-out' });
  };

  // ----- the Pins tab -----
  var unitWord = function (p, n) { return n === 1 ? p.one : p.many; };
  var drawPinsTab = function (body, k, st) {
    var got = 0; D.pins.forEach(function (p) { if (st.pins[p.id].tier) got++; });
    var head = el('div', 'kc-sechead'); head.appendChild(el('h2', 'kc-h2', 'My pins')); head.appendChild(el('span', 'kc-tally', got + ' / ' + D.pins.length)); body.appendChild(head);
    body.appendChild(eddie(!st.n ? 'Your first class gets your first pin! A grown-up adds it.' : got === D.pins.length ? 'You have every pin! Now make them all gold!' : pick(['Tap a pin to see how to level it up!', 'Gold is the top. Can you get one?', 'Every class gets you closer to the next level!']), 'kc-host'));
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
      if (p.group === 'repeat') card.appendChild(el('p', 'kc-say', x.c ? 'You went back to classes you love ' + plural(x.c, 'time', 'times') + '!' : 'Go back to a class you love to get this pin!'));
      else card.appendChild(el('p', 'kc-say', x.c ? 'You’ve been to ' + plural(x.c, p.one, p.many) + '!' : 'Go to a ' + p.one + ' to get this pin!'));
      if (x.c && x.tier < 3) card.appendChild(el('p', 'kc-say small', (x.next - x.c) + ' more ' + unitWord(p, x.next - x.c) + ' for ' + TIER[x.tier + 1].toUpperCase() + '!'));
      card.appendChild(btn('kc-big go', 'Cool!', function () { Sound.play('tap'); close(); }));
    });
  };

  // What's new: pins whose level went up since the child last saw them, and a new level.
  var newsFor = function (k, st) {
    var seen = k.seen || {}, out = { pins: [], spots: [], level: 0 };
    D.pins.forEach(function (p) { var t = st.pins[p.id].tier; if (t > (seen[p.id] || 0)) out.pins.push({ p: p, tier: t }); });
    (D.areas || []).forEach(function (a) { for (var i = seen['map:' + a.id] || 0; i < st.spots[a.id].open; i++) out.spots.push({ a: a, it: a.items[i] }); });
    out.sur = [];
    Object.keys(st.sur).forEach(function (h) { var x = D.surprises[h]; for (var i = seen['hood:' + h] || 0; i < st.sur[h].open; i++) out.sur.push({ a: { name: x.n }, it: { id: x.s[i], n: SURPRISE_NAME[x.s[i]] } }); });
    if (st.level.n > (k.lvl || 1)) out.level = st.level.n;
    return out;
  };
  var celebrating = false;
  var celebrate = function (k, st, news) {
    if (celebrating || S.view !== 'kid') return;
    celebrating = true;
    var done = function () {
      var seen = shownNow(k, st);
      save({ seen: seen, lvl: st.level.n }, function () { celebrating = false; if (S.tryOn) { S.tryOn = false; go('avatar'); } else if (S.toMap) { S.toMap = false; go('kid', 'map'); } else draw(); });
    };
    // A present to tap open: sounds can only start after a tap.
    overlay(function (card, close) {
      card.classList.add('kc-gift');
      card.appendChild(el('h2', 'kc-h', news.pins.length || news.spots.length || news.sur.length ? 'Something new!' : 'Level up!'));
      var g = btn('kc-giftbtn', '', function () { close(); });
      g.setAttribute('aria-label', 'Tap to open');
      g.appendChild(giftArt()); g.appendChild(el('span', 'kc-say', 'Tap to open!'));
      card.appendChild(g);
    }, 'gift').then(function () {
      var chain = Promise.resolve();
      if (news.pins.length && news.pins.length <= 3) news.pins.forEach(function (x) { chain = chain.then(function () { return revealPin(x.p, x.tier, st); }); });
      else if (news.pins.length) chain = chain.then(function () { return revealMany(news.pins); });
      if (news.spots.length) chain = chain.then(function () { return revealSpots(news.spots); });
      if (news.sur.length) chain = chain.then(function () { return revealSpots(news.sur, true); });
      if (news.level) chain = chain.then(function () { return levelUp(k, st); });
      chain.then(done);
    });
  };
  var giftArt = function () {
    var s = sv('svg', { viewBox: '0 0 100 100', 'class': 'kc-giftart', 'aria-hidden': 'true' });
    sv('rect', { x: 14, y: 42, width: 72, height: 50, rx: 6, fill: '#2176D2', stroke: INK, 'stroke-width': 3.5 }, s);
    sv('rect', { x: 8, y: 30, width: 84, height: 18, rx: 5, fill: '#4D94E0', stroke: INK, 'stroke-width': 3.5 }, s);
    sv('rect', { x: 43, y: 30, width: 14, height: 62, fill: '#F3C613', stroke: INK, 'stroke-width': 3 }, s);
    sv('path', { d: 'M50 30C40 12 22 14 28 26C32 32 44 30 50 30ZM50 30C60 12 78 14 72 26C68 32 56 30 50 30Z', fill: '#F3C613', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }, s);
    return s;
  };
  var rays = function () { var r = el('div', 'kc-rays'); r.setAttribute('aria-hidden', 'true'); return r; };
  var revealPin = function (p, tier, st) {
    return overlay(function (card, close) {
      card.classList.add('kc-reveal');
      card.appendChild(rays());
      var again = p.group === 'repeat';   // going back to a class gets a reward of its own
      card.appendChild(el('p', 'kc-burst', again ? 'REPEATER REWARD!' : tier === 1 ? 'NEW PIN!' : TIER[tier].toUpperCase() + '!'));
      var pv = drawPin(p, tier); card.appendChild(pv);
      card.appendChild(el('h2', 'kc-h', again ? (tier === 1 ? 'You went back!' : TIER[tier] + ' Repeater!') : p.label));
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
  // Secret spots found on the map: each drawn big, with its name (and, for one, what's fun about it).
  var spotArt = function (id) { var s = sv('svg', { viewBox: '-24 -32 48 54', 'class': 'kc-spotart', 'aria-hidden': 'true' }); sv('ellipse', { cx: 0, cy: 16, rx: 16, ry: 4, fill: 'rgba(11,33,64,.18)' }, s); (LANDMARK[id] || SURPRISE[id] || drawSecret)(sv('g', null, s)); return s; };
  var revealSpots = function (list, surprise) {
    return overlay(function (card, close) {
      card.classList.add('kc-reveal', 'kc-spotreveal');
      card.appendChild(rays());
      card.appendChild(el('p', 'kc-burst', surprise ? (list.length === 1 ? 'SURPRISE!' : list.length + ' SURPRISES!') : list.length === 1 ? 'SECRET SPOT!' : list.length + ' SECRET SPOTS!'));
      var row = el('div', 'kc-spotrow' + (list.length > 2 ? ' many' : ''));
      list.slice(0, 6).forEach(function (x, i) {
        var c = el('div', 'kc-spot1'); var art = spotArt(x.it.id); c.appendChild(art); c.appendChild(el('b', null, x.it.n)); row.appendChild(c);
        anim(art, [{ transform: 'scale(0) rotate(-30deg)' }, { transform: 'scale(1.2) rotate(6deg)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 600, delay: Math.min(i * 140, 700), easing: 'ease-out', fill: 'backwards' });
      });
      card.appendChild(row);
      card.appendChild(el('p', 'kc-say', list.length === 1 ? ((surprise ? SURPRISE_SAY : LANDMARK_SAY)[list[0].it.id] || '') + ' You found it in ' + list[0].a.name + '!' : surprise ? 'Hiding in the neighborhoods where your classes are!' : 'You found them by going to classes nearby!'));
      card.appendChild(btn('kc-big go', 'See my map!', function () { Sound.play('tap'); S.toMap = true; close(); }));
      card.appendChild(btn('kc-big ghost', 'Yay!', function () { Sound.play('tap'); close(); }));
      Sound.play('sparkle'); confetti(50);
    }, 'reveal');
  };
  var levelUp = function (k, st) {
    return overlay(function (card, close) {
      card.classList.add('kc-reveal', 'kc-levelup');
      card.appendChild(rays());
      card.appendChild(el('p', 'kc-burst', 'LEVEL UP!'));
      var m = drawBulb(kidBulb(k.av), 'bob big beam'); card.appendChild(m);
      card.appendChild(el('p', 'kc-levelnum', String(st.level.n)));
      card.appendChild(el('h2', 'kc-h', st.level.title + ' · Level ' + st.level.n));
      var fresh = WEAR.filter(function (x) { return x.lvl > (k.lvl || 1) && x.lvl <= st.level.n; });
      if (fresh.length) {   // new things to wear, on the child's own bulb
        card.classList.add('kc-hasnew');
        card.appendChild(el('p', 'kc-say', 'New stuff to wear!'));
        var row = el('div', 'kc-newwear');
        fresh.slice(-4).forEach(function (it) { var one = {}; one[it.slot] = it.id; var c = el('div', 'kc-newitem'); c.appendChild(drawBulb(kidBulb({ b: k.av.b, c: k.av.c, w: one }))); c.appendChild(el('b', null, it.name)); row.appendChild(c); });
        card.appendChild(row);
        card.appendChild(btn('kc-big go', 'Try it on!', function () { Sound.play('tap'); S.tryOn = true; close(); }));
        card.appendChild(btn('kc-big ghost', 'Later', function () { Sound.play('tap'); close(); }));
      } else card.appendChild(btn('kc-big go', 'Woo-hoo!', function () { Sound.play('tap'); close(); }));
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
  var HOOD_COLORS = ['#F3C613', '#96C9FF', '#7DB8F5', '#FFE066', '#B6E3B0', '#C3E1FF', '#FFD98A', '#8FD694'];   // lit up in the site's yellows, blues and greens
  var LANDMARK_SAY = {
    'city-hall': 'William Penn stands on top!', love: 'The big LOVE sign!', 'liberty-bell': 'It has a famous crack.', 'art-museum': 'Run up all 72 steps!',
    zoo: 'America’s first zoo!', boathouses: 'They light up at night.', franklin: 'Walk through a giant heart!', bridge: 'It goes to New Jersey!',
    stadiums: 'Where the Phillies, Eagles, Sixers and Flyers play.', cheesesteak: 'Wit or witout?', wissahickon: 'Trails, a creek and big rocks.', airport: 'Planes zoom over the river.',
    elfreth: 'One of America’s oldest streets!', 'italian-market': 'Fruit, cheese and pasta, all outside!', 'covered-bridge': 'A wooden bridge with a roof!',
    heinz: 'Herons, turtles and a giant marsh!', pennypack: 'Woods, ducks and a long creek trail.'
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
    elfreth: function (g) {   // little brick row houses
      [[-17, '#B5523B'], [-6, '#C96B4F'], [5, '#9C4A35']].forEach(function (h) {
        var x = h[0];
        sv('rect', { x: x, y: -10, width: 11, height: 24, fill: h[1], stroke: INK, 'stroke-width': 1.8 }, g);
        sv('path', { d: 'M' + (x - 1) + ' -10H' + (x + 12) + 'L' + (x + 9) + ' -15H' + (x + 2) + 'Z', fill: '#5C3A2E', stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, g);
        [[2, -6], [6.5, -6], [2, 1], [6.5, 1]].forEach(function (w) { sv('rect', { x: x + w[0], y: w[1], width: 2.5, height: 3.5, fill: '#FFF3BF' }, g); });
        sv('rect', { x: x + 3.5, y: 7, width: 4, height: 7, fill: '#1C3F6E' }, g);
      });
      sv('path', { d: 'M-19 14H19', stroke: INK, 'stroke-width': 2 }, g);
    },
    'italian-market': function (g) {   // a fruit stand under a striped awning
      sv('rect', { x: -16, y: -2, width: 32, height: 15, fill: '#C08A5B', stroke: INK, 'stroke-width': 2 }, g);
      sv('path', { d: 'M-16 -9V-2M16 -9V-2', stroke: INK, 'stroke-width': 2 }, g);
      [[-11, '#FF922B'], [-5, '#E03131'], [1, '#94D82D'], [7, '#FFD43B'], [12, '#FF922B']].forEach(function (f) { sv('circle', { cx: f[0], cy: -4, r: 3.2, fill: f[1], stroke: INK, 'stroke-width': 1.2 }, g); });
      for (var i = 0; i < 4; i++) { var x = -18 + i * 9; sv('path', { d: 'M' + x + ' -16H' + (x + 9) + 'V-10Q' + (x + 4.5) + ' -6 ' + x + ' -10Z', fill: i % 2 ? '#fff' : '#E03131', stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, g); }
    },
    'covered-bridge': function (g) {   // a red wooden bridge with a roof, over a creek
      sv('path', { d: 'M-21 13Q-11 9 0 13T21 13', fill: 'none', stroke: '#4DABF7', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      sv('rect', { x: -18, y: -6, width: 36, height: 15, fill: '#C92A2A', stroke: INK, 'stroke-width': 2 }, g);
      [-14, -10, 10, 14].forEach(function (x) { sv('path', { d: 'M' + x + ' -5V8', stroke: '#A61E1E', 'stroke-width': 1.2 }, g); });
      sv('path', { d: 'M-21 -6L-14 -14H14L21 -6Z', fill: '#5C3A2E', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
      sv('path', { d: 'M-6 9V1Q0 -5 6 1V9Z', fill: '#2B1A12', stroke: INK, 'stroke-width': 1.5 }, g);
    },
    heinz: function (g) {   // a heron in the reeds
      sv('path', { d: 'M-16 14V2M-12 14V-3M13 14V0M17 14V5', stroke: '#2F9E44', 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
      sv('path', { d: 'M-1 14L0 4M4 14L3 4', stroke: INK, 'stroke-width': 1.5 }, g);
      sv('path', { d: 'M-9 2C-9 -5 4 -7 9 -2C11 1 6 5 -2 5Z', fill: '#91A7FF', stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, g);
      sv('path', { d: 'M6 -3C2 -8 9 -12 5 -17', fill: 'none', stroke: INK, 'stroke-width': 4.6, 'stroke-linecap': 'round' }, g);
      sv('path', { d: 'M6 -3C2 -8 9 -12 5 -17', fill: 'none', stroke: '#91A7FF', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, g);
      sv('circle', { cx: 5, cy: -18, r: 3.3, fill: '#91A7FF', stroke: INK, 'stroke-width': 1.6 }, g);
      sv('path', { d: 'M7.6 -18.6L15.5 -17.2L7.6 -16.4Z', fill: '#FFD43B', stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, g);
      sv('circle', { cx: 5.6, cy: -18.7, r: 0.9, fill: INK }, g);
    },
    pennypack: function (g) {   // a duck on the creek, a tree behind
      sv('path', { d: 'M-15 0L-8 -18L-1 0Z', fill: '#37B24D', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
      sv('ellipse', { cx: 0, cy: 10, rx: 19, ry: 5, fill: '#74C0FC', stroke: INK, 'stroke-width': 1.8 }, g);
      sv('path', { d: 'M-12 6C-12 -2 0 -2 4 2C8 0 12 1 12 4C12 9 -10 10 -12 6Z', fill: '#A47148', stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, g);
      sv('circle', { cx: 7, cy: -5, r: 4.5, fill: '#2B8A3E', stroke: INK, 'stroke-width': 1.6 }, g);
      sv('path', { d: 'M11 -5.6L16.5 -4.4L11 -3Z', fill: '#FFD43B', stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, g);
      sv('circle', { cx: 8, cy: -6.2, r: 0.9, fill: '#fff' }, g);
    },
    airport: function (g) { sv('path', { d: 'M-2 -16C0 -18 2 -16 2 -12V-4L16 4V8L2 3V11L6 14V17L0 15L-6 17V14L-2 11V3L-16 8V4L-2 -4V-12C-2 -14 -2 -15 -2 -16Z', fill: '#fff', stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round', transform: 'rotate(-35)' }, g); }
  };
  // ----- the neighborhoods' surprises: little Philly things, one or two in each neighborhood with classes -----
  var SURPRISE_NAME = { pretzel: 'A soft pretzel', waterice: 'Water ice', hoagie: 'A hoagie', trolley: 'A trolley', stoop: 'A rowhouse stoop', mural: 'A mural', hoop: 'A basketball hoop', kite: 'A kite', duck: 'A duck', cat: 'A stoop cat', bike: 'A bike', tree: 'An apple tree', flowers: 'Window flowers', boombox: 'A boombox', hydrant: 'An open hydrant', pigeon: 'A pigeon' };
  var SURPRISE_SAY = { pretzel: 'Twisty, salty and very Philly.', waterice: 'Cold and sweet on a hot day.', hoagie: 'A Philly classic.', trolley: 'Ding ding!', stoop: 'The best seat on the block.', mural: 'Philly has thousands of murals!', hoop: 'Shoot your shot!', kite: 'Up, up and away!', duck: 'Quack!', cat: 'Every block has one.', bike: 'Ring ring!', tree: 'Shade and a snack.', flowers: 'A little garden on the sill.', boombox: 'Turn it up!', hydrant: 'A summer splash on the block.', pigeon: 'Coo! A city regular.' };
  var line2 = function (g, d, w, color) { sv('path', { d: d, fill: 'none', stroke: INK, 'stroke-width': w + 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g); sv('path', { d: d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g); };
  var SURPRISE = {
    pretzel: function (g) {
      line2(g, 'M-13 9C-22 0 -15 -15 -5 -10C0 -7 0 -1 0 3C0 -1 0 -7 5 -10C15 -15 22 0 13 9M-13 9L7 -5M13 9L-7 -5', 5.5, '#A0632B');
      [[-12, -4], [-6, -9], [6, -9], [12, -4], [0, 1], [-9, 5], [9, 5]].forEach(function (p) { sv('circle', { cx: p[0], cy: p[1], r: 1, fill: '#fff' }, g); });
    },
    waterice: function (g) {
      sv('path', { d: 'M-11 0C-11 -15 11 -15 11 0Z', fill: '#FF6B6B', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
      sv('path', { d: 'M-4 -9C-2 -11 1 -11 3 -9', fill: 'none', stroke: '#fff', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
      sv('path', { d: 'M-11 0H11L8 15H-8Z', fill: '#fff', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
      sv('path', { d: 'M-9 6H9', stroke: '#4DABF7', 'stroke-width': 2.4 }, g);
      sv('path', { d: 'M5 -6L12 -18', stroke: INK, 'stroke-width': 3.6, 'stroke-linecap': 'round' }, g); sv('path', { d: 'M5 -6L12 -18', stroke: '#FFD43B', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, g);
    },
    hoagie: function (g) {
      sv('path', { d: 'M-19 4C-19 12 19 12 19 4Z', fill: '#E8B567', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
      sv('path', { d: 'M-18 3Q-14 -1 -10 3T-2 3T6 3T14 3T19 3', fill: 'none', stroke: '#40C057', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      [-11, -2, 7].forEach(function (x) { sv('ellipse', { cx: x, cy: 1, rx: 4, ry: 2, fill: '#FA5252', stroke: INK, 'stroke-width': 1 }, g); });
      sv('path', { d: 'M-19 -1C-19 -13 19 -13 19 -1Z', fill: '#E8B567', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
      [-10, -3, 4, 11].forEach(function (x) { sv('path', { d: 'M' + x + ' -8l2 -2', stroke: '#B07A35', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, g); });
    },
    trolley: function (g) {
      sv('path', { d: 'M-22 -27H22', stroke: INK, 'stroke-width': 1.2 }, g);
      sv('path', { d: 'M3 -13L11 -27', stroke: INK, 'stroke-width': 1.8 }, g);
      sv('rect', { x: -19, y: -13, width: 38, height: 22, rx: 5, fill: '#2F9E44', stroke: INK, 'stroke-width': 2 }, g);
      sv('rect', { x: -19, y: 2, width: 38, height: 4, fill: '#FFD43B' }, g);
      [-15, -6, 3].forEach(function (x) { sv('rect', { x: x, y: -9, width: 7, height: 7, rx: 1.5, fill: '#D0EBFF', stroke: INK, 'stroke-width': 1.2 }, g); });
      sv('rect', { x: 12, y: -9, width: 4, height: 15, fill: '#D0EBFF', stroke: INK, 'stroke-width': 1.2 }, g);
      [-10, 10].forEach(function (x) { sv('circle', { cx: x, cy: 11, r: 3.5, fill: '#495057', stroke: INK, 'stroke-width': 1.5 }, g); });
    },
    stoop: function (g) {
      sv('rect', { x: -14, y: -24, width: 28, height: 34, fill: '#B5523B', stroke: INK, 'stroke-width': 2 }, g);
      sv('path', { d: 'M-16 -24H16', stroke: INK, 'stroke-width': 3 }, g);
      [[-11, -19], [3, -19]].forEach(function (w) { sv('rect', { x: w[0], y: w[1], width: 8, height: 8, fill: '#FFF3BF', stroke: INK, 'stroke-width': 1.2 }, g); });
      sv('rect', { x: -10, y: -6, width: 7, height: 6, fill: '#FFF3BF', stroke: INK, 'stroke-width': 1.2 }, g);
      sv('rect', { x: 2, y: -7, width: 8, height: 17, fill: '#1C3F6E', stroke: INK, 'stroke-width': 1.5 }, g);
      sv('rect', { x: -2, y: 10, width: 16, height: 3, fill: '#CED4DA', stroke: INK, 'stroke-width': 1.2 }, g);
      sv('rect', { x: -4, y: 13, width: 20, height: 3, fill: '#CED4DA', stroke: INK, 'stroke-width': 1.2 }, g);
    },
    mural: function (g) {
      sv('rect', { x: -19, y: -20, width: 38, height: 32, rx: 2, fill: '#F1E3C4', stroke: INK, 'stroke-width': 2 }, g);
      sv('circle', { cx: -9, cy: -10, r: 5, fill: '#FFD43B' }, g);
      sv('path', { d: 'M-19 4Q-12 -4 -4 4T12 4T19 2V12H-19Z', fill: '#4DABF7' }, g);
      sv('path', { d: 'M8 -12C8 -16 13 -16 13 -12C13 -16 18 -16 18 -12C18 -8 13 -5 13 -4C13 -5 8 -8 8 -12Z', fill: '#FA5252' }, g);
      sv('rect', { x: -19, y: -20, width: 38, height: 32, rx: 2, fill: 'none', stroke: INK, 'stroke-width': 2 }, g);
    },
    hoop: function (g) {
      line2(g, 'M12 14V-14', 2.5, '#868E96');
      sv('rect', { x: -6, y: -26, width: 22, height: 15, rx: 2, fill: '#fff', stroke: INK, 'stroke-width': 2 }, g);
      sv('rect', { x: 1, y: -21, width: 8, height: 6, fill: 'none', stroke: '#FA5252', 'stroke-width': 1.5 }, g);
      sv('path', { d: 'M-1 -10L1 -3H9L11 -10M3 -10L4 -3M7 -10L6 -3', fill: 'none', stroke: INK, 'stroke-width': 1 }, g);
      sv('ellipse', { cx: 5, cy: -10, rx: 6.5, ry: 1.8, fill: 'none', stroke: '#FD7E14', 'stroke-width': 2 }, g);
      sv('circle', { cx: -10, cy: 6, r: 7, fill: '#FD7E14', stroke: INK, 'stroke-width': 1.8 }, g);
      sv('path', { d: 'M-17 6H-3M-10 -1V13M-15 1Q-10 6 -15 11M-5 1Q-10 6 -5 11', fill: 'none', stroke: INK, 'stroke-width': 1 }, g);
    },
    kite: function (g) {
      sv('path', { d: 'M2 -27L14 -12L2 3L-10 -12Z', fill: '#FFD43B', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
      sv('path', { d: 'M2 -27V3M-10 -12H14', stroke: INK, 'stroke-width': 1.2 }, g);
      sv('path', { d: 'M2 -27L-10 -12L2 -12Z', fill: '#FA5252', opacity: '.85' }, g);
      sv('path', { d: 'M2 3C-2 8 6 10 1 15', fill: 'none', stroke: INK, 'stroke-width': 1.4 }, g);
      [[0, 7], [3, 12]].forEach(function (b) { sv('path', { d: 'M' + (b[0] - 3) + ' ' + (b[1] - 2) + 'L' + (b[0] + 3) + ' ' + (b[1] + 2) + 'M' + (b[0] - 3) + ' ' + (b[1] + 2) + 'L' + (b[0] + 3) + ' ' + (b[1] - 2), stroke: '#4DABF7', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g); });
    },
    duck: function (g) {
      g = sv('g', { transform: 'translate(0 -2) scale(1.3)' }, g);
      sv('ellipse', { cx: 0, cy: 10, rx: 16, ry: 4.5, fill: '#74C0FC', stroke: INK, 'stroke-width': 1.6 }, g);
      sv('path', { d: 'M-12 6C-13 -1 -2 -2 3 2C6 0 10 1 10 5C10 10 -9 11 -12 6Z', fill: '#A47148', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
      sv('path', { d: 'M-6 3C-3 5 1 5 3 3', fill: 'none', stroke: '#7A4F2A', 'stroke-width': 1.2, 'stroke-linecap': 'round' }, g);
      sv('path', { d: 'M3 2C3 -2 4 -4 5 -5', fill: 'none', stroke: '#2B8A3E', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
      sv('circle', { cx: 6, cy: -7, r: 4.5, fill: '#2B8A3E', stroke: INK, 'stroke-width': 1.5 }, g);
      sv('path', { d: 'M10 -7.6L15 -6.4L10 -5Z', fill: '#FFD43B', stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, g);
      sv('circle', { cx: 7, cy: -8.2, r: 0.9, fill: '#fff' }, g);
    },
    cat: function (g) {
      line2(g, 'M7 12C16 12 18 3 13 -1', 2.5, '#FF922B');
      sv('path', { d: 'M-8 14C-12 2 -8 -4 0 -4C8 -4 12 2 8 14Z', fill: '#FF922B', stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, g);
      sv('path', { d: 'M-7 -14L-6 -22L-1 -17ZM7 -14L6 -22L1 -17Z', fill: '#FF922B', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
      sv('circle', { cx: 0, cy: -10, r: 7.5, fill: '#FF922B', stroke: INK, 'stroke-width': 1.8 }, g);
      [-3, 3].forEach(function (x) { sv('circle', { cx: x, cy: -11, r: 1.1, fill: INK }, g); });
      sv('path', { d: 'M-1.5 -7.5L0 -6.5L1.5 -7.5', fill: 'none', stroke: INK, 'stroke-width': 1, 'stroke-linecap': 'round' }, g);
      sv('path', { d: 'M-3 4V13M3 4V13', stroke: '#E8590C', 'stroke-width': 1.2 }, g);
    },
    bike: function (g) {
      [-11, 11].forEach(function (x) { sv('circle', { cx: x, cy: 7, r: 7, fill: 'none', stroke: INK, 'stroke-width': 2.4 }, g); sv('circle', { cx: x, cy: 7, r: 1.2, fill: INK }, g); });
      line2(g, 'M-11 7L-3 -5H8L11 7M-3 -5L0 7L8 -5', 2, '#CC3000');
      line2(g, 'M-6 -9H0M8 -5L6 -11H11', 2, '#495057');
    },
    tree: function (g) {
      sv('rect', { x: -3, y: -1, width: 6, height: 15, fill: '#8D5524', stroke: INK, 'stroke-width': 1.6 }, g);
      sv('circle', { cx: 0, cy: -10, r: 14, fill: '#40C057', stroke: INK, 'stroke-width': 2 }, g);
      [[-6, -14], [6, -12], [-2, -5], [8, -4], [-9, -6], [1, -19]].forEach(function (a) { sv('circle', { cx: a[0], cy: a[1], r: 2.2, fill: '#FA5252', stroke: INK, 'stroke-width': 0.8 }, g); });
    },
    flowers: function (g) {
      sv('path', { d: 'M-6 3V-8M0 3V-13M6 3V-7', stroke: '#2F9E44', 'stroke-width': 2 }, g);
      [[-6, -9, '#F783AC'], [0, -14, '#B197FC'], [6, -8, '#FFD43B']].forEach(function (f) {
        for (var i = 0; i < 5; i++) { var a = i * Math.PI * 2 / 5; sv('circle', { cx: f[0] + 3.2 * Math.cos(a), cy: f[1] + 3.2 * Math.sin(a), r: 2.4, fill: f[2], stroke: INK, 'stroke-width': 0.8 }, g); }
        sv('circle', { cx: f[0], cy: f[1], r: 1.6, fill: '#FFF3BF' }, g);
      });
      sv('path', { d: 'M-15 2H15L13 14H-13Z', fill: '#E8590C', stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, g);
      sv('path', { d: 'M-16 2H16', stroke: INK, 'stroke-width': 2.5 }, g);
    },
    boombox: function (g) {
      sv('path', { d: 'M-10 -9V-14H10V-9', fill: 'none', stroke: INK, 'stroke-width': 2.2 }, g);
      sv('rect', { x: -19, y: -9, width: 38, height: 21, rx: 4, fill: '#495057', stroke: INK, 'stroke-width': 2 }, g);
      [-10, 10].forEach(function (x) { sv('circle', { cx: x, cy: 2, r: 6, fill: '#CED4DA', stroke: INK, 'stroke-width': 1.4 }, g); sv('circle', { cx: x, cy: 2, r: 2.2, fill: INK }, g); });
      sv('rect', { x: -4, y: -5, width: 8, height: 4, rx: 1, fill: '#FFD43B' }, g);
      [[14, -22], [-15, -19]].forEach(function (n) { sv('ellipse', { cx: n[0], cy: n[1] + 5, rx: 2.4, ry: 1.8, fill: INK }, g); sv('path', { d: 'M' + (n[0] + 2.2) + ' ' + (n[1] + 5) + 'V' + (n[1] - 2) + 'l3 1.5', fill: 'none', stroke: INK, 'stroke-width': 1.4 }, g); });
    },
    hydrant: function (g) {
      sv('path', { d: 'M8 -3C15 -8 19 0 21 10', fill: 'none', stroke: '#4DABF7', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      [[17, -6], [21, 2], [14, 3]].forEach(function (d) { sv('circle', { cx: d[0], cy: d[1], r: 1.4, fill: '#74C0FC' }, g); });
      sv('path', { d: 'M-7 14V-6C-7 -13 7 -13 7 -6V14Z', fill: '#E03131', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
      sv('rect', { x: -11, y: -3, width: 5, height: 5, rx: 1, fill: '#E03131', stroke: INK, 'stroke-width': 1.5 }, g);
      sv('rect', { x: 6, y: -5, width: 4, height: 5, rx: 1, fill: '#E03131', stroke: INK, 'stroke-width': 1.5 }, g);
      sv('rect', { x: -9, y: 12, width: 18, height: 3, fill: '#C92A2A', stroke: INK, 'stroke-width': 1.4 }, g);
      sv('circle', { cx: 0, cy: -13, r: 2, fill: '#C92A2A', stroke: INK, 'stroke-width': 1.2 }, g);
    },
    pigeon: function (g) {
      sv('path', { d: 'M-2 12L-3 15M3 12L4 15', stroke: '#F06595', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
      sv('path', { d: 'M-16 4C-10 0 -6 -6 2 -6C10 -6 12 2 9 8C6 12 -4 12 -16 4Z', fill: '#ADB5BD', stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, g);
      sv('path', { d: 'M-6 2C-2 6 4 6 6 3', fill: 'none', stroke: '#868E96', 'stroke-width': 1.4 }, g);
      sv('path', { d: 'M3 -6C3 -11 5 -15 9 -15C13 -15 14 -11 12 -7', fill: '#748FFC', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
      sv('path', { d: 'M3 -6C6 -5 10 -6 12 -7', fill: 'none', stroke: '#51CF66', 'stroke-width': 2 }, g);
      sv('path', { d: 'M13 -13L17 -12L13 -11Z', fill: '#495057', stroke: INK, 'stroke-width': 1 }, g);
      sv('circle', { cx: 10, cy: -12, r: 1.2, fill: '#FF922B', stroke: INK, 'stroke-width': 0.6 }, g);
    }
  };
  var drawSecret = function (g) {   // a spot still to find: a cloud with a question mark
    sv('path', { d: 'M-16 10C-23 10 -23 0 -15 -1C-15 -10 -4 -13 0 -7C3 -15 15 -14 15 -5C22 -5 23 10 15 10Z', fill: '#fff', stroke: INK, 'stroke-width': 2 }, g);
    var t = sv('text', { x: 0, y: 8, 'text-anchor': 'middle', 'font-size': 16, 'font-family': 'Luckiest Guy, Arial Black, sans-serif', fill: '#1763B8' }, g); t.textContent = '?';
  };
  var drawMapTab = function (body, k, st) {
    var head = el('div', 'kc-sechead'); head.appendChild(el('h2', 'kc-h2', 'My Philly')); head.appendChild(el('span', 'kc-tally', plural(st.nh, 'place', 'places'))); body.appendChild(head);
    if (st.hidden) { var tl = el('p', 'kc-spottally'); tl.appendChild(el('b', null, st.found + ' / ' + st.hidden)); tl.appendChild(document.createTextNode(' secret spots found')); if (st.surFound) { tl.appendChild(document.createTextNode(' · ')); tl.appendChild(el('b', null, String(st.surFound))); tl.appendChild(document.createTextNode(st.surFound === 1 ? ' surprise' : ' surprises')); } body.appendChild(tl); }
    body.appendChild(eddie(!st.nh ? 'It’s all cloudy! Every class you go to clears the clouds where it is, and finds a surprise.' : st.found < st.hidden ? 'Every class lights up a new part of Philly, with a surprise in it. Classes near a ? find a secret spot!' : 'You found every secret spot! Tap a place!', 'kc-host'));
    var box = el('div', 'kc-mapbox'); box.appendChild(el('p', 'kc-say', 'Drawing the map…')); body.appendChild(box);
    loadMap().then(function (M) {
      if (!box.isConnected) return;
      box.textContent = '';
      if (!M) { box.appendChild(el('p', 'kc-say', 'The map couldn’t load. Try again later!')); return; }
      drawPhilly(box, M, k, st);
      if (M.attribution) box.parentNode.insertBefore(el('p', 'kc-credit', M.attribution), box.parentNode.querySelector('.kc-grown'));   // the neighborhoods' license asks for the credit; text, not a link
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
    M.hoods.forEach(function (h) { sv('path', { d: h.d, fill: 'none', stroke: open[h.id] ? INK : 'rgba(11,33,64,.16)', 'stroke-width': open[h.id] ? 2.5 : 1.2, 'stroke-linejoin': 'round' }, lines); });
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
    // each neighborhood's surprises, once a class there clears its clouds: what's found, and a ? for the one still hiding
    var surAt = {}, SUR_AT = [[-9, 7], [9, -5]];
    Object.keys(st.sur).forEach(function (h) {
      var x = D.surprises[h];
      x.s.forEach(function (kind, i) {
        var found = i < st.sur[h].open, s = sv('svg', { viewBox: '-22 -30 44 50', 'class': found ? 'kc-sur' : 'kc-sur kc-surq', 'data-sur': h + '|' + i });
        sv('ellipse', { cx: 0, cy: 16, rx: 14, ry: 3.5, fill: 'rgba(11,33,64,.18)' }, s);
        (found ? SURPRISE[kind] : drawSecret)(sv('g', null, s));
        sv('rect', { x: -22, y: -30, width: 44, height: 50, fill: 'transparent' }, s);
        surAt[h + '|' + i] = { h: h, i: i, found: found, kind: kind };
        place(s, x.c[0] + SUR_AT[i][0], x.c[1] + SUR_AT[i][1], 0.72, 0.6);
      });
    });
    var spotAt = {};
    (D.areas || []).forEach(function (a) {
      a.items.forEach(function (lm, i) {
        var found = i < st.spots[a.id].open;
        var s = sv('svg', { viewBox: '-22 -30 44 50', 'class': found ? 'kc-lm' : 'kc-lm kc-secret', 'data-lm': lm.id });
        sv('ellipse', { cx: 0, cy: 16, rx: 16, ry: 4, fill: 'rgba(11,33,64,.18)' }, s);
        (found && LANDMARK[lm.id] ? LANDMARK[lm.id] : drawSecret)(sv('g', null, s));
        sv('rect', { x: -22, y: -30, width: 44, height: 50, fill: 'transparent' }, s);
        spotAt[lm.id] = { a: a, i: i, found: found, it: lm };
        place(s, lm.x, lm.y, 0.8, 0.6);
      });
    });
    // Eddie Bulboa waits at the top of the Art Museum steps.
    var am = M.landmarks.filter(function (l) { return l.id === 'art-museum'; })[0];
    if (am && D.eddie) {
      var ed = sv('image', { href: D.eddie, 'class': 'kc-eddie-map', preserveAspectRatio: 'xMidYMax meet' });
      try { ed.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', D.eddie); } catch (e) { /* href is enough */ }
      place(ed, am.x + 24, am.y + 4, 1.1, 1); things[things.length - 1].mon = true;
    }
    // Each program's bulb where it is; the child's own bulb at the last one. (Ones that stand too close step apart below.)
    var spots = {}, last = null;
    st.places.forEach(function (pl) {
      var key = pl.k + '|' + (pl.st.h || '');
      if (spots[key]) return;
      var at = pl.st.ll ? xy(pl.st.ll) : pl.st.m && byId[pl.st.m] ? byId[pl.st.m].c.slice() : null;
      if (!at) return;
      spots[key] = true;
      var s = drawBulb(bulbFor(pl.k), 'onmap'); s.setAttribute('data-k', pl.k);
      place(s, at[0], at[1], 1, 1); things[things.length - 1].mon = true;
      last = at;
    });
    var home = last || (function () { var ch = M.landmarks.filter(function (l) { return l.id === 'city-hall'; })[0]; return ch ? [ch.x + 30, ch.y + 20] : [W / 2, H / 2]; })();
    var you = sv('svg', { viewBox: '0 -54 100 156', 'class': 'kc-you' });
    var flag = sv('g', null, you); sv('path', { d: 'M50 -50V-18', stroke: INK, 'stroke-width': 3 }, flag); sv('path', { d: 'M50 -50H84L76 -41L84 -32H50Z', fill: '#F3C613', stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, flag);
    var yt = sv('text', { x: 66, y: -35, 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'Luckiest Guy, Arial Black, sans-serif', fill: INK }, flag); yt.textContent = 'YOU';
    var mine = drawBulb(kidBulb(k.av)); mine.setAttribute('x', 0); mine.setAttribute('y', -22); mine.setAttribute('width', 100); mine.setAttribute('height', 124); you.appendChild(mine);
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
      for (var it = 0; it < 12; it++) {   // bulbs that stand too close step apart, a little at a time
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
      var lm = t.closest('[data-lm]'), mon = t.closest('[data-k]'), hood = t.closest('[data-hood]'), me = t.closest('.kc-you'), ed = t.closest('.kc-eddie-map'), su = t.closest('[data-sur]');
      if (me) { Sound.play('boing'); bounce(me); say(ev.clientX, ev.clientY, 'That’s you!', possessive(k.name) + ' bulb'); return; }
      if (ed) { Sound.play('boing'); say(ev.clientX, ev.clientY, 'Eddie Bulboa', 'Race me up the Art Museum steps!'); return; }
      if (mon) { Sound.play('zap'); bounce(mon); var mk = mon.getAttribute('data-k'); say(ev.clientX, ev.clientY, nameOf(mk), ''); return; }
      if (su) {
        var sx = surAt[su.getAttribute('data-sur')], hn = D.surprises[sx.h].n;
        if (sx.found) { Sound.play('pop'); bounce(su); say(ev.clientX, ev.clientY, SURPRISE_NAME[sx.kind] + '!', 'Found in ' + hn + '. ' + (SURPRISE_SAY[sx.kind] || '')); return; }
        Sound.play('whoosh'); say(ev.clientX, ev.clientY, 'Another surprise!', 'Go to one more class in ' + hn + ' to find it!');
        return;
      }
      if (lm) {
        var sp = spotAt[lm.getAttribute('data-lm')];
        if (!sp) return;
        if (sp.found) { Sound.play('pop'); bounce(lm); say(ev.clientX, ev.clientY, sp.it.n, LANDMARK_SAY[sp.it.id] || ''); return; }
        var need = sp.i + 1 - st.spots[sp.a.id].c;
        Sound.play('whoosh'); say(ev.clientX, ev.clientY, 'A secret spot!', 'Go to ' + (need === 1 ? '1 more class' : need + ' more classes') + ' near here to find out what it is!');
        return;
      }
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
      box.parentNode.insertBefore(ul, box.parentNode.querySelector('.kc-grown'));
    }
  };

  // ----- the Showdown tab: the bulbs collected, the favorites, and the showdown -----
  // Two bulbs at a time, in one of three contests that take turns: a race up the Art Museum steps, a glow-off and a
  // dance-off. The child taps who wins; the winner pulls out its special move, the other comes second and cheers, and
  // Eddie hosts. Nobody gets hurt: it's a contest, not a fight. The order they drop out of the running in is
  // the child's ranking of favorites.
  var drawBattleTab = function (body, k, st) {
    var keys = st.keys;
    if (k.fav.length) {
      var head = el('div', 'kc-sechead'); head.appendChild(el('h2', 'kc-h2', 'My champions')); body.appendChild(head);
      var pod = el('div', 'kc-podium');
      [1, 0, 2].forEach(function (i) {
        var key = k.fav[i]; if (!key || !listing(key)) return;
        var c = el('div', 'kc-step s' + (i + 1));
        c.appendChild(drawBulb(bulbFor(key), i === 0 ? 'bob' : ''));
        c.appendChild(el('span', 'kc-medal', String(i + 1)));
        c.appendChild(el('b', null, nameOf(key)));
        pod.appendChild(c);
      });
      body.appendChild(pod);
    }
    var bh = el('div', 'kc-sechead'); bh.appendChild(el('h2', 'kc-h2', 'Which was more fun?')); body.appendChild(bh);
    if (keys.length >= 2) {
      body.appendChild(eddie('I’ll show you two of your classes. Tap the one you had more fun at, and it wins! The last one left is your favorite.', 'kc-host'));
      body.appendChild(btn('kc-big go fight', k.fav.length ? 'Play again!' : 'Find my favorite!', function () { Sound.play('go'); startBracket(keys); }));
    } else body.appendChild(eddie(keys.length ? 'You have 1 bulb. One more class, and you can pick your favorite!' : 'Every class lights up a new bulb. Get two, and you can pick your favorite!', 'kc-host'));
    var ch = el('div', 'kc-sechead'); ch.appendChild(el('h2', 'kc-h2', 'My bulbs')); ch.appendChild(el('span', 'kc-tally', String(keys.length))); body.appendChild(ch);
    var grid = el('div', 'kc-zoo');
    keys.forEach(function (key) {
      var c = btn('kc-bulbcard', '', function () { Sound.play('zap'); var s = c.querySelector('svg'); s.classList.remove('flash'); void s.getBoundingClientRect(); s.classList.add('flash'); bounce(s); });
      c.appendChild(drawBulb(bulbFor(key))); c.appendChild(el('b', null, nameOf(key)));
      if (st.times[key] > 1) { var tb = el('span', 'kc-timesbadge', '×' + st.times[key]); tb.setAttribute('aria-label', st.times[key] + ' times'); c.appendChild(tb); }
      var t = listing(key).t; if (t && t[0] && D.types[t[0]]) c.appendChild(el('small', null, D.types[t[0]].label));
      grid.appendChild(c);
    });
    if (!keys.length) { var c = el('div', 'kc-bulbcard empty'); c.appendChild(unlitBulb()); c.appendChild(el('b', null, '???')); grid.appendChild(c); }
    body.appendChild(grid);
  };
  var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  var startBracket = function (keys) { S.bracket = { round: shuffle(keys), next: [], out: [], i: 0, n: 1, m: Math.floor(Math.random() * 3) }; go('fight'); };
  var CHEERS = ['Go go go!', 'You can do it!', 'Woo-hoo!', 'Awesome!', 'Whoa!', 'Yeah!'];
  var EVENTS = [
    { id: 'race', title: 'Race up the steps!', ask: 'Tap it, and it wins the race!', count: ['On your marks…', 'Get set…', 'GO!'], second: 'Good race!' },
    { id: 'glow', title: 'Glow-off!', ask: 'Tap it, and it glows brightest!', count: ['Lights…', 'Get ready…', 'GLOW!'], second: 'So bright!' },
    { id: 'dance', title: 'Dance-off!', ask: 'Tap it, and it wins the dance-off!', count: ['Ready?', '5, 6, 7, 8…', 'DANCE!'], second: 'Great moves!' }
  ];
  var museumArt = function () {
    var s = sv('svg', { viewBox: '0 0 120 46', 'class': 'kc-museum', 'aria-hidden': 'true' });
    sv('path', { d: 'M8 16L60 2L112 16Z', fill: '#F1E3C4', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, s);
    sv('rect', { x: 10, y: 16, width: 100, height: 4, fill: '#E9DDC2', stroke: INK, 'stroke-width': 1.5 }, s);
    for (var i = 0; i < 8; i++) sv('rect', { x: 15 + i * 12.4, y: 20, width: 5, height: 20, fill: '#fff', stroke: INK, 'stroke-width': 1.3 }, s);
    sv('rect', { x: 6, y: 40, width: 108, height: 5, fill: '#E9DDC2', stroke: INK, 'stroke-width': 1.5 }, s);
    return s;
  };
  var discoArt = function () {
    var s = sv('svg', { viewBox: '-20 -26 40 46', 'class': 'kc-disco', 'aria-hidden': 'true' });
    sv('path', { d: 'M0 -26V-16', stroke: '#fff', 'stroke-width': 1.5 }, s);
    sv('circle', { r: 16, fill: '#C3E1FF', stroke: INK, 'stroke-width': 2 }, s);
    var g = sv('g', { 'class': 'kc-disco-face' }, s);
    for (var y = -12; y <= 12; y += 6) for (var x = -14; x <= 14; x += 6) if (x * x + y * y < 200) sv('rect', { x: x - 2.4, y: y - 2.4, width: 4.8, height: 4.8, fill: (x + y) % 12 ? '#fff' : '#96C9FF', opacity: 0.9 }, g);
    return s;
  };
  var drawFight = function () {
    var k = kid(), b = S.bracket; if (!k || !b) { go('kid', 'battle', false); return; }
    setKidMode(true);
    if (b.i + 1 >= b.round.length) {   // one left over this round, or the round is done
      if (b.i < b.round.length) b.next.push(b.round[b.i]);
      if (b.next.length === 1) { champion(k, b); return; }
      b.round = shuffle(b.next); b.next = []; b.i = 0; b.n++;
    }
    var ev = EVENTS[b.m % EVENTS.length];
    var left = b.round.length - b.i + b.next.length;
    var page = el('section', 'kc-fight');
    var top = el('div', 'kc-fighttop');
    var stop = btn('kc-back', '', function () { Sound.play('tap'); S.bracket = null; go('kid', 'battle'); }); stop.setAttribute('aria-label', 'Stop the showdown');
    stop.appendChild(icon('M18.3 5.7 16.9 4.3 12 9.2 7.1 4.3 5.7 5.7 10.6 12l-4.9 4.9 1.4 1.4L12 13.4l4.9 4.9 1.4-1.4-4.9-4.9z')); top.appendChild(stop);
    top.appendChild(el('p', 'kc-round', left <= 2 ? 'THE FINAL!' : 'Round ' + b.n + ' · ' + left + ' left'));
    top.appendChild(muteBtn());
    page.appendChild(top);
    page.appendChild(el('h1', 'kc-h kc-ask', 'Which did you have more fun at?'));   // what the child is choosing; the contest is only how the winner celebrates
    page.appendChild(el('p', 'kc-evname', ev.title));
    // the stage for this contest, Eddie hosting, and two bulbs
    var ring = el('div', 'kc-arena kc-show kc-ev-' + ev.id), fx = el('div', 'kc-fx');
    if (ev.id === 'race') { var steps = el('span', 'kc-steps'); steps.setAttribute('aria-hidden', 'true'); ring.appendChild(steps); ring.appendChild(museumArt()); }
    if (ev.id === 'glow') { ['l', 'r'].forEach(function (sd) { var sp = el('span', 'kc-spot ' + sd); sp.setAttribute('aria-hidden', 'true'); ring.appendChild(sp); }); }
    if (ev.id === 'dance') { var floor = el('span', 'kc-floor'); floor.setAttribute('aria-hidden', 'true'); ring.appendChild(floor); ring.appendChild(discoArt()); }
    var ref = eddie(ev.ask, 'kc-ref'); ring.appendChild(ref);
    var pair = [b.round[b.i], b.round[b.i + 1]], cards = [];
    pair.forEach(function (key, idx) {
      var c = btn('kc-fighter ' + (idx ? 'right' : 'left'), '', function () { choose(idx); });
      var svg = drawBulb(bulbFor(key), 'bob'), wrap = el('span', 'kc-fwrap'), flip = el('span', 'kc-flip'); flip.appendChild(svg); wrap.appendChild(flip); c.appendChild(wrap);
      if (ev.id === 'glow') { var meter = el('span', 'kc-meter'); meter.appendChild(el('i')); c.appendChild(meter); }
      c.appendChild(el('b', null, nameOf(key)));
      c.setAttribute('aria-label', 'I had more fun at ' + nameOf(key));
      cards.push(c); ring.appendChild(c);
      if (!idx) ring.appendChild(el('span', 'kc-vs', 'VS'));
    });
    ring.appendChild(fx);
    page.appendChild(ring);
    var cheer = el('div', 'kc-cheer'); var me = drawBulb(kidBulb(k.av), 'bob'); cheer.appendChild(me); var said = el('span', 'kc-cheerbubble', pick(CHEERS)); cheer.appendChild(said); page.appendChild(cheer);
    app.appendChild(page);
    anim(ring.querySelector('.kc-vs'), [{ transform: 'scale(3) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1) rotate(-8deg)', opacity: 1 }], { duration: 400, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    var busy = false;
    var choose = function (idx) {
      if (busy) return; busy = true;
      cards.forEach(function (c) { c.disabled = true; });
      var win = cards[idx], lose = cards[1 - idx], wm = win.querySelector('.kc-fwrap'), lm = lose.querySelector('.kc-fwrap'), winBulb = win.querySelector('.kc-bulb');
      var mon = bulbFor(pair[idx]);
      win.classList.add('winner'); ring.classList.add('going');
      said.textContent = pick(CHEERS); bounce(me);
      var countdown = function () {
        var p = Promise.resolve();
        ev.count.forEach(function (line, i) { p = p.then(function () { ref.say(line); Sound.play(i === ev.count.length - 1 ? 'go' : 'tap'); return wait(i === ev.count.length - 1 ? 250 : 480); }); });
        return p;
      };
      var shotAt = function (from, to, kind, ms) {
        var s = drawShot(kind); fx.appendChild(s);
        return anim(s, [{ transform: 'translate(' + from[0] + 'px,' + from[1] + 'px) scale(.4)', opacity: 1 }, { transform: 'translate(' + to[0] + 'px,' + to[1] + 'px) rotate(360deg) scale(1.2)', opacity: 0 }], { duration: ms || 600, easing: 'ease-out', fill: 'forwards' }).then(function () { s.remove(); });
      };
      var centerOf = function (node) { var fr = fx.getBoundingClientRect(), r = node.getBoundingClientRect(); return [r.left - fr.left + r.width / 2, r.top - fr.top + r.height / 2]; };
      var contest;
      if (ev.id === 'race') contest = function () {   // both climb; the winner faster, its special move as a speed boost
        var rr = ring.getBoundingClientRect(), climb = Math.max(70, wm.getBoundingClientRect().top - rr.top - 64);
        var hops = function (ms) { var fr = []; for (var i = 0; i <= 8; i++) { var f = i / 8; fr.push({ transform: 'translateY(' + (-climb * f - (i % 2 && i < 8 ? 10 : 0)).toFixed(1) + 'px) scale(' + (1 - 0.32 * f).toFixed(2) + ')', offset: f }); } return fr; };
        Sound.play('whoosh'); ref.say(mon.move);
        var trail = []; [150, 450, 750].forEach(function (t) { trail.push(wait(t).then(function () { var c = centerOf(wm); return shotAt([c[0], c[1] + 20], [c[0] + (Math.random() * 40 - 20), c[1] + 90], mon.atk, 650); })); });
        var a1 = anim(wm, hops(1300), { duration: 1300, easing: 'linear', fill: 'forwards' }).then(function () { Sound.play('boing'); win.appendChild(el('span', 'kc-wins', 'WINS!')); confetti(30); });
        var a2 = anim(lm, hops(1900), { duration: 1900, easing: 'linear', fill: 'forwards' });
        return Promise.all([a1, a2].concat(trail));
      };
      if (ev.id === 'glow') contest = function () {   // both light up; the winner's meter fills, and it puts on a light show
        Sound.play('glow');
        var wf = win.querySelector('.kc-meter i'), lf = lose.querySelector('.kc-meter i');
        var a1 = anim(wf, [{ width: '0%' }, { width: '100%' }], { duration: 1400, easing: 'ease-out', fill: 'forwards' });
        var a2 = anim(lf, [{ width: '0%' }, { width: '72%' }], { duration: 1400, easing: 'ease-out', fill: 'forwards' });
        if (CALM) { wf.style.width = '100%'; lf.style.width = '72%'; }
        ring.classList.add(idx ? 'spot-r' : 'spot-l');
        return Promise.all([a1, a2]).then(function () {
          ref.say(mon.move); winBulb.classList.add('beam'); Sound.play('sparkle');
          var c = centerOf(wm), shows = [];
          for (var i = 0; i < 8; i++) { var ang = Math.PI * 2 * i / 8; shows.push(shotAt(c, [c[0] + Math.cos(ang) * 90, c[1] + Math.sin(ang) * 70], mon.atk, 800)); }
          win.appendChild(el('span', 'kc-wins', 'MAX GLOW!'));
          return Promise.all(shows.concat([anim(wm, [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1.1)' }], { duration: 700, easing: 'ease-out', fill: 'forwards' })]));
        });
      };
      if (ev.id === 'dance') contest = function () {   // the other dances first; then the winner, bigger, with its special move swirling round
        Sound.play('dance');
        var shimmy = [{ transform: 'rotate(0) translateY(0)' }, { transform: 'rotate(-12deg) translateY(-8%)' }, { transform: 'rotate(12deg) translateY(0)' }, { transform: 'rotate(-12deg) translateY(-8%)' }, { transform: 'rotate(0) translateY(0)' }];
        return anim(lm, shimmy, { duration: 900, easing: 'ease-in-out' }).then(function () {
          ref.say(mon.move);
          var c = centerOf(wm), swirl = [];
          for (var i = 0; i < 6; i++) (function (i) { swirl.push(wait(i * 120).then(function () { var ang = Math.PI * 2 * i / 6; return shotAt([c[0] + Math.cos(ang) * 30, c[1] + Math.sin(ang) * 30], [c[0] + Math.cos(ang + 2) * 80, c[1] + Math.sin(ang + 2) * 60], mon.atk, 700); })); })(i);
          var spin = anim(wm, [{ transform: 'rotate(0) translateY(0) scale(1)' }, { transform: 'rotate(180deg) translateY(-18%) scale(1.1)', offset: 0.4 }, { transform: 'rotate(360deg) translateY(0) scale(1.1)', offset: 0.7 }, { transform: 'rotate(360deg) translateY(-10%) scale(1.15)', offset: 0.85 }, { transform: 'rotate(360deg) translateY(0) scale(1.1)' }], { duration: 1200, easing: 'ease-in-out', fill: 'forwards' });
          ring.classList.add(idx ? 'spot-r' : 'spot-l');
          return Promise.all(swirl.concat([spin])).then(function () { Sound.play('cheer'); win.appendChild(el('span', 'kc-wins', 'WINS!')); });
        });
      };
      wait(250).then(countdown).then(contest)
        .then(function () {   // the other comes second, and cheers
          lose.classList.add('second');
          var good = el('span', 'kc-second', ev.second); lose.appendChild(good);
          anim(lose.querySelector('.kc-bulb'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-10%)' }, { transform: 'translateY(0)' }], { duration: 380, iterations: 2 });
          Sound.play('clap'); ref.say('Winner: ' + nameOf(pair[idx]) + '!');
          return wait(1300);
        })
        .then(function () {
          if (S.bracket !== b || S.view !== 'fight') return;
          b.next.push(pair[idx]); b.out.push(pair[1 - idx]); b.i += 2; b.m++;
          draw();
        });
    };
  };
  var champion = function (k, b) {
    var winner = b.next[0], fav = [winner].concat(b.out.slice().reverse());
    S.bracket = null;
    var page = el('section', 'kc-fight kc-champ');
    page.appendChild(rays());
    page.appendChild(el('p', 'kc-burst', 'CHAMPION!'));
    page.appendChild(eddie('And the champ is…', 'kc-host'));
    var big = drawBulb(bulbFor(winner), 'bob big beam'); page.appendChild(big);
    page.appendChild(trophyArt());
    page.appendChild(el('h1', 'kc-h', nameOf(winner)));
    page.appendChild(el('p', 'kc-say', 'Your favorite! Your grown-ups will see it first when they plan.'));
    var acts = el('div', 'kc-avacts');
    acts.appendChild(btn('kc-big go', 'Yay!', function () { Sound.play('tap'); go('kid', 'battle'); }));
    page.appendChild(acts);
    var cheer = el('div', 'kc-cheer'); var me = drawBulb(kidBulb(k.av), 'bob'); cheer.appendChild(me); cheer.appendChild(el('span', 'kc-cheerbubble', 'We did it!')); page.appendChild(cheer);
    app.appendChild(page);
    Sound.play('fanfare'); setTimeout(function () { Sound.play('cheer'); }, 500); confetti(100);
    anim(big, [{ transform: 'translateY(40%) scale(.4)' }, { transform: 'translateY(-10%) scale(1.15)', offset: 0.7 }, { transform: 'translateY(0) scale(1)' }], { duration: 700, easing: 'ease-out' });
    save({ fav: fav }, function () { /* kept; the page stays on the champion */ });
  };
  var trophyArt = function () {
    var s = sv('svg', { viewBox: '0 0 100 100', 'class': 'kc-trophy', 'aria-hidden': 'true' });
    sv('path', { d: 'M28 10H72V36C72 50 62 60 50 60C38 60 28 50 28 36Z', fill: '#F3C613', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, s);
    sv('path', { d: 'M28 16H14V24C14 34 22 40 30 40M72 16H86V24C86 34 78 40 70 40', fill: 'none', stroke: INK, 'stroke-width': 4 }, s);
    sv('rect', { x: 44, y: 60, width: 12, height: 16, fill: '#E0B400', stroke: INK, 'stroke-width': 3 }, s);
    sv('rect', { x: 30, y: 76, width: 40, height: 12, rx: 3, fill: '#0F4D90', stroke: INK, 'stroke-width': 3 }, s);
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
    if (k) acts.appendChild(btn('btn', 'Play Eddie’s welcome again', function () { S.tour = { step: 0 }; go('tour'); }));
    head.appendChild(acts);
    head.appendChild(el('p', 'hint', 'Only what you confirm here counts. Pins, levels, the map and the bulbs are worked out from it; nothing about your child is sent anywhere or counted by anything.'));
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
        var what = el('div', 'kc-sg-what'); what.appendChild(el('b', null, nameOf(sgt.k))); what.appendChild(el('span', null, sgLine(sgt)));
        li.appendChild(what);
        var row = el('div', 'kc-sg-acts');
        row.appendChild(btn('btn primary', sgt.up ? 'Yes, update it' : 'Yes, add it', function () { save(sgAnswer(k, sgt, true)); }));
        row.appendChild(btn('btn', 'No', function () { save(sgAnswer(k, sgt, false)); }));
        li.appendChild(row); ul.appendChild(li);
      });
      sg.appendChild(ul);
    } else sg.appendChild(el('p', 'hint', 'Nothing waiting. A program on ' + possessive(k.name) + ' kept week, a camp whose week has started, or a day-off camp whose day has passed shows up here to confirm.'));
    page.appendChild(sg);

    // Add one by hand.
    var ad = el('div', 'panel'); ad.appendChild(el('h3', null, 'Add one the plans missed'));
    var form = el('form', 'kc-add');
    var f1 = el('div', 'field'); var lab = el('label', null, 'Program or camp'); lab.htmlFor = 'kc-add-q'; f1.appendChild(lab);
    var q = el('input'); q.id = 'kc-add-q'; q.type = 'text'; q.autocomplete = 'off'; q.placeholder = 'Start typing a name'; q.setAttribute('role', 'combobox'); q.setAttribute('aria-expanded', 'false'); f1.appendChild(q);
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
      dl.appendChild(el('p', 'hint', 'Times: count each day a week it meets, each term, or each week of the same camp. Going back earns ' + k.name + ' the Repeater Reward, and counts toward the next level.'));
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
        var tn = Math.max(1, x.n || 1), tm = el('div', 'kc-times'); tm.setAttribute('role', 'group'); tm.setAttribute('aria-label', 'Times at ' + nameOf(x.k));
        var setTimes = function (v) { if (v > 1) x.n = v; else delete x.n; save({ done: k.done }); };
        var less = btn('btn kc-step', '−', function () { setTimes(tn - 1); }); less.setAttribute('aria-label', 'One time fewer'); less.disabled = tn <= 1;
        var more = btn('btn kc-step', '+', function () { setTimes(tn + 1); }); more.setAttribute('aria-label', 'One time more'); more.disabled = tn >= 20;
        tm.appendChild(el('span', 'hint', 'Times')); tm.appendChild(less); tm.appendChild(el('b', 'kc-times-n', String(tn))); tm.appendChild(more);
        row.appendChild(tm);
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

    // From the beginning: for when a grown-up tried it out first.
    var rs = el('div', 'panel'); rs.appendChild(el('h3', null, 'Start ' + possessive(k.name) + ' Kid’s Corner over'));
    rs.appendChild(startOver(k, function () { S.tour = null; S.bracket = null; S.said = ''; go('kid', 'pins'); }));
    page.appendChild(rs);

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

  // The picture: the site's name, the child's bulb as it is now (what it wears too), the level and the pins earned.
  // No name, no map.
  var svgImage = function (node, size) {
    return new Promise(function (res) {
      var c = node.cloneNode(true); c.setAttribute('xmlns', NS);
      // On its own the picture has none of the page's styles, so what they would hide goes first: a lit bulb's unlit
      // glass and closed eyes (or, for a bulb that's off, its light). What's left is the bulb as the child sees it.
      var off = /\boff\b/.test(c.getAttribute('class') || '');
      Array.prototype.forEach.call(c.querySelectorAll(off ? '.kc-lit, .kc-glow, .kc-eyes' : '.kc-unlit, .kc-xeyes'), function (n) { n.parentNode.removeChild(n); });
      // On the page wings, glows and a gold pin's sunburst may reach past the drawing's box; a picture would cut them
      // off, so it is framed on everything drawn, and keeps its shape.
      var vb = (c.getAttribute('viewBox') || '0 0 100 100').split(' ').map(Number), box = { x: vb[0], y: vb[1], width: vb[2], height: vb[3] };
      var hold = el('div'); hold.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + size + 'px;visibility:hidden';
      document.body.appendChild(hold); hold.appendChild(c);
      try {
        var bb = c.getBBox();
        if (bb.width > 0 && bb.height > 0) {
          var x0 = Math.min(vb[0], bb.x - 2), y0 = Math.min(vb[1], bb.y - 2), x1 = Math.max(vb[0] + vb[2], bb.x + bb.width + 2), y1 = Math.max(vb[1] + vb[3], bb.y + bb.height + 2);
          box = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
        }
      } catch (e) { /* the drawing's own box, then */ }
      hold.remove();
      c.setAttribute('viewBox', [box.x, box.y, box.width, box.height].map(function (n) { return n.toFixed(1); }).join(' '));
      var k = size / Math.max(box.width, box.height);
      c.setAttribute('width', Math.round(box.width * k)); c.setAttribute('height', Math.round(box.height * k));
      var img = new Image(); img.onload = function () { res(img); }; img.onerror = function () { res(null); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
    });
  };
  var drawShare = function (c, k) {
    var ctx = c.getContext('2d'), W = c.width, H = c.height, st = stats(k);
    var on = D.pins.filter(function (p) { return st.pins[p.id].tier; }).sort(function (a, b) { return st.pins[b.id].tier - st.pins[a.id].tier; });
    var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('80px "Luckiest Guy"'), document.fonts.load('800 30px Figtree')]).catch(function () { /* fallback fonts */ }) : Promise.resolve();
    var imgs = [k.av ? svgImage(drawBulb(kidBulb(k.av)), 300) : Promise.resolve(null)].concat(on.slice(0, 12).map(function (p) { return svgImage(drawPin(p, st.pins[p.id].tier), 220); }));
    return fonts.then(function () { return Promise.all(imgs); }).then(function (got) {
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0A3566'); g.addColorStop(1, '#1763B8'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; for (var i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((i * 263) % W, (i * 397) % H, 6 + (i % 5) * 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      ctx.font = '400 104px "Luckiest Guy", "Arial Black", Impact, sans-serif'; ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.strokeText('MY PINS', W / 2, 140); ctx.fillStyle = '#F3C613'; ctx.fillText('MY PINS', W / 2, 140);
      var fit = function (im, x, y, w, h) { var s = Math.min(w / im.width, h / im.height), dw = im.width * s, dh = im.height * s; ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); };   // in the box, its own shape
      if (got[0]) fit(got[0], W / 2 - 140, 150, 280, 285);
      ctx.font = '400 52px "Luckiest Guy", "Arial Black", Impact, sans-serif'; ctx.lineWidth = 10; ctx.strokeText(st.level.title + ' · Level ' + st.level.n, W / 2, got[0] ? 478 : 230); ctx.fillStyle = '#fff'; ctx.fillText(st.level.title + ' · Level ' + st.level.n, W / 2, got[0] ? 478 : 230);
      var cols = 4, size = 200, gapX = 30, x0 = (W - cols * size - (cols - 1) * gapX) / 2, y0 = got[0] ? 510 : 280;
      on.slice(0, 12).forEach(function (p, i) {
        var x = x0 + (i % cols) * (size + gapX), y = y0 + Math.floor(i / cols) * (size + 50);
        if (got[i + 1]) fit(got[i + 1], x, y - 6, size, size + 6);
        var lab = p.label.length > 24 ? p.label.slice(0, 23) + '…' : p.label, fz = 25;   // a long name in smaller type, so names don't run into each other
        ctx.font = '800 ' + fz + 'px Figtree, Arial, sans-serif'; while (fz > 17 && ctx.measureText(lab).width > size + gapX - 8) { fz--; ctx.font = '800 ' + fz + 'px Figtree, Arial, sans-serif'; }
        ctx.fillStyle = '#fff'; ctx.fillText(lab, x + size / 2, y + size + 8);
      });
      if (!on.length) { ctx.font = '700 40px Figtree, Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('The first pin is the first class!', W / 2, 760); }
      if (on.length > 12) { ctx.font = '700 30px Figtree, Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('and ' + (on.length - 12) + ' more', W / 2, H - 92); }
      ctx.font = '700 30px Figtree, Arial, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText(D.site + ' · ' + D.url, W / 2, H - 42);
    });
  };

  // ----- drawing -----
  var draw = function () {
    app.textContent = '';
    document.querySelectorAll('.kc-over').forEach(function (o) { if (!o.classList.contains('reveal') && !o.classList.contains('gift')) o.remove(); });
    if (S.view === 'kid') drawKid();
    else if (S.view === 'fight') drawFight();
    else if (S.view === 'avatar') drawAvatar();
    else if (S.view === 'tour') drawTour();
    else if (S.view === 'grownup') drawGrownup();
    else drawPick();
  };

  // ----- for the account page's Kid's Corner tab: each child's page at a glance, and the classes waiting to confirm -----
  // groups.js loads this script and its data only when that tab is opened, then calls window.pasKids.summary().
  var summaryBox = null;
  var paintSummary = function (box, p) {
    box.textContent = '';
    box.appendChild(el('p', 'hint', 'What each child has on Kid’s Corner, and the classes waiting for you to say yes or no. Only you, and a co-parent you’ve linked, see this.'));
    if (!p.kids.length) {
      var none = el('p', null, 'Add your kids’ first names on School & kids, and each gets a page in Kid’s Corner.');
      box.appendChild(none);
      var go2 = el('a', 'btn primary', 'Add their names'); go2.href = D.links.kids; box.appendChild(go2);
      return;
    }
    var openOn = function (k, hash) { return function () { try { sessionStorage.setItem('kc-open', k.name); } catch (e) { /* storage blocked: the picker asks */ } location.href = D.links.corner + (hash || ''); }; };
    p.kids.forEach(function (k) {
      if (!k.seen || Array.isArray(k.seen)) k.seen = {};
      var st = stats(k), got = 0; D.pins.forEach(function (x) { if (st.pins[x.id].tier) got++; });
      var card = el('div', 'kc-sum');
      var head = el('div', 'kc-sum-head');
      var face = el('span', 'kc-sum-face'); face.appendChild(k.av ? drawBulb(kidBulb(k.av)) : unlitBulb()); head.appendChild(face);
      var who = el('div', 'kc-sum-who');
      who.appendChild(el('h3', null, k.name));
      who.appendChild(el('span', 'kc-sum-lvl', k.av ? st.level.title + ' · Level ' + st.level.n : 'Hasn’t picked a bulb yet'));
      var bar = el('div', 'kc-sum-xp'); var f = el('i'); f.style.width = Math.max(3, Math.round(100 * (st.xp - st.level.from) / (st.level.to - st.level.from))) + '%'; bar.appendChild(f); who.appendChild(bar);
      head.appendChild(who); card.appendChild(head);
      var facts = el('ul', 'kc-sum-facts');
      [[got + ' of ' + D.pins.length, 'pins'], [String(st.nh), st.nh === 1 ? 'neighborhood' : 'neighborhoods'], [String(st.n), st.n === 1 ? 'class or camp' : 'classes and camps']].forEach(function (x) { var li = el('li'); li.appendChild(el('b', null, x[0])); li.appendChild(document.createTextNode(' ')); li.appendChild(el('span', null, x[1])); facts.appendChild(li); });
      card.appendChild(facts);
      var on = D.pins.filter(function (x) { return st.pins[x.id].tier; }).sort(function (a, b) { return st.pins[b.id].tier - st.pins[a.id].tier; });
      if (on.length) { var strip = el('div', 'kc-sum-pins'); on.slice(0, 10).forEach(function (x) { var pv = drawPin(x, st.pins[x.id].tier); pv.setAttribute('aria-hidden', 'false'); pv.setAttribute('role', 'img'); pv.setAttribute('aria-label', x.label + ', ' + TIER[st.pins[x.id].tier]); strip.appendChild(pv); }); if (on.length > 10) strip.appendChild(el('span', 'hint', '+' + (on.length - 10))); card.appendChild(strip); }
      if (k.fav.length && listing(k.fav[0])) card.appendChild(el('p', 'kc-sum-fav', 'Favorite: ' + nameOf(k.fav[0]) + (k.fav[1] && listing(k.fav[1]) ? ', then ' + nameOf(k.fav[1]) : '')));
      if (k.suggest.length) {
        var wait = el('div', 'kc-sum-wait');
        wait.appendChild(el('h4', null, 'Did ' + k.name + ' go?'));
        var ul = el('ul', 'kc-suggest');
        k.suggest.forEach(function (sgt) {
          var li = el('li');
          var what = el('div', 'kc-sg-what'); what.appendChild(el('b', null, nameOf(sgt.k))); what.appendChild(el('span', null, sgLine(sgt))); li.appendChild(what);
          var row = el('div', 'kc-sg-acts');
          var answer = function (changes) { return function () { row.querySelectorAll('button').forEach(function (x) { x.disabled = true; }); call('passport_save', { kid: k.name, done: changes.done || k.done, skip: changes.skip || k.skip, fav: k.fav }).then(function (d) { if (!d.ok) { row.appendChild(el('span', 'g-status bad', d.message || 'That didn’t save. Try again.')); row.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); return; } ['done', 'skip', 'fav', 'suggest', 'av', 'seen', 'lvl'].forEach(function (fl) { if (d.kid[fl] !== undefined) k[fl] = d.kid[fl]; }); paintSummary(box, p); }); }; };
          row.appendChild(btn('btn primary', sgt.up ? 'Yes, update it' : 'Yes, add it', answer(sgAnswer(k, sgt, true))));
          row.appendChild(btn('btn', 'No', answer(sgAnswer(k, sgt, false))));
          li.appendChild(row); ul.appendChild(li);
        });
        wait.appendChild(ul); card.appendChild(wait);
      }
      var acts = el('div', 'actions');
      acts.appendChild(btn('btn primary', 'Open ' + possessive(k.name) + ' Kid’s Corner', openOn(k)));
      acts.appendChild(btn('btn', 'Add or take off classes', openOn(k, '#grownup')));
      var again = btn('btn', 'Start over', function () {
        again.disabled = true;
        card.appendChild(startOver(k, function () { paintSummary(box, p); var c = [].filter.call(box.querySelectorAll('.kc-sum'), function (x) { return x.querySelector('h3') && x.querySelector('h3').textContent === k.name; })[0]; if (c) c.appendChild(el('p', 'g-status good', k.name + ' starts from the beginning next time: Eddie’s welcome first.')); }));
      });
      acts.appendChild(again);
      card.appendChild(acts);
      box.appendChild(card);
    });
  };
  window.pasKids = {
    summary: function (box, opts) {
      summaryBox = box;
      if (opts && opts.api) API = opts.api;
      box.textContent = ''; box.appendChild(el('p', 'hint', 'Opening Kid’s Corner…'));
      var data = D ? Promise.resolve(D) : window.fetch(opts.data, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('data'); return r.json(); }).then(function (d) { D = d; return d; });
      return Promise.all([data, call('passport')]).then(function (x) {
        if (summaryBox !== box) return;
        if (!x[1] || !x[1].ok) { box.textContent = ''; box.appendChild(el('p', 'g-status bad', (x[1] && x[1].message) || 'Couldn’t open Kid’s Corner just now. Try again in a moment.')); return; }
        paintSummary(box, x[1]);
      }).catch(function () { box.textContent = ''; box.appendChild(el('p', 'g-status bad', 'Couldn’t open Kid’s Corner just now. Try again in a moment.')); });
    }
  };

  // ----- start -----
  if (!root) return;   // not Kid's Corner itself: the account page's tab uses window.pasKids, above
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
      var want = null; try { want = sessionStorage.getItem('kc-open'); sessionStorage.removeItem('kc-open'); } catch (e) { /* storage blocked */ }
      if (want) p.kids.forEach(function (k, i) { if (k.name === want) S.kid = i; });   // opened for one child from the account page
      if (/^(pins|map|battle)$/.test(h)) S.tab = h;
      S.view = h === 'grownup' ? 'grownup' : S.kid > -1 ? 'kid' : 'pick';
      try { history.replaceState({ kc: S.view, tab: S.tab, kid: S.kid }, '', location.pathname + (S.view === 'pick' ? '' : S.view === 'kid' ? '#' + S.tab : '#' + S.view)); } catch (e) { /* no history */ }
      draw();
    });
  });
})();
