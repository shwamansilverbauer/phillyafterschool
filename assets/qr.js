// A QR code for a web address, as rows of 0s and 1s. Byte mode, error correction level M, versions 1 to 10 (up to
// 213 characters), which is plenty for a listing's address. Written for the flyer a program prints: the managers'
// page loads this file only when a flyer is asked for. No dependencies.
(function (root) {
  'use strict';
  // level M, by version: data codewords in all, error-correction codewords per block, and the blocks ([count, data codewords each])
  var VERS = [null,
    { ec: 10, blocks: [[1, 16]] }, { ec: 16, blocks: [[1, 28]] }, { ec: 26, blocks: [[1, 44]] }, { ec: 18, blocks: [[2, 32]] },
    { ec: 24, blocks: [[2, 43]] }, { ec: 16, blocks: [[4, 27]] }, { ec: 18, blocks: [[4, 31]] }, { ec: 22, blocks: [[2, 38], [2, 39]] },
    { ec: 22, blocks: [[3, 36], [2, 37]] }, { ec: 26, blocks: [[4, 43], [1, 44]] }];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  // arithmetic in GF(256), for the Reed-Solomon error correction
  var EXP = [], LOG = [];
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function ecBytes(data, n) {
    var gen = [1], i, j;
    for (i = 0; i < n; i++) { var next = []; for (j = 0; j <= gen.length; j++) next[j] = (j < gen.length ? mul(gen[j], EXP[i]) : 0) ^ (j > 0 ? gen[j - 1] : 0); gen = next; }
    // gen holds the generator's coefficients, lowest power first; the remainder of data * x^n divided by it
    var rem = []; for (i = 0; i < n; i++) rem[i] = 0;
    for (i = 0; i < data.length; i++) {
      var f = data[i] ^ rem[0];
      rem.shift(); rem.push(0);
      for (j = 0; j < n; j++) rem[j] ^= mul(gen[n - 1 - j], f);
    }
    return rem;
  }
  function utf8(text) {
    var out = [], s = unescape(encodeURIComponent(String(text)));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }
  function bch(value, bits, poly, polyBits) {   // the check bits that follow a format or version number
    var v = value << (polyBits - 1);
    for (var i = bits + polyBits - 2; i >= polyBits - 1; i--) if (v & (1 << i)) v ^= poly << (i - (polyBits - 1));
    return (value << (polyBits - 1)) | v;
  }
  var MASKS = [
    function (r, c) { return (r + c) % 2 === 0; }, function (r) { return r % 2 === 0; }, function (r, c) { return c % 3 === 0; }, function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; }, function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
    function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; }, function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }];
  function penalty(m) {
    var n = m.length, score = 0, r, c, i;
    var runs = function (get) {   // rule 1: five or more the same in a line; rule 3: a finder-like pattern
      for (var a = 0; a < n; a++) {
        var run = 1;
        for (var b = 1; b < n; b++) { if (get(a, b) === get(a, b - 1)) { run++; } else { if (run >= 5) score += run - 2; run = 1; } }
        if (run >= 5) score += run - 2;
        for (b = 0; b + 10 < n; b++) {
          var bits = 0; for (i = 0; i < 11; i++) bits = (bits << 1) | get(a, b + i);
          if (bits === 0x5D0 || bits === 0x05D) score += 40;
        }
      }
    };
    runs(function (a, b) { return m[a][b]; }); runs(function (a, b) { return m[b][a]; });
    for (r = 0; r + 1 < n; r++) for (c = 0; c + 1 < n; c++) { var v = m[r][c]; if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3; }   // rule 2: 2x2 blocks
    var dark = 0; for (r = 0; r < n; r++) for (c = 0; c < n; c++) dark += m[r][c];
    score += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;   // rule 4: how far from half dark
    return score;
  }
  // forceMask is for checking this against another encoder; leave it out and the best of the eight is chosen
  function pasQR(text, forceMask) {
    var bytes = utf8(text), ver = 0, v, total;
    for (v = 1; v <= 10; v++) {
      total = 0; VERS[v].blocks.forEach(function (b) { total += b[0] * b[1]; });
      if (bytes.length + (v < 10 ? 2 : 3) <= total) { ver = v; break; }   // 4 bits of mode + 8 or 16 of length, rounded up with the data
    }
    if (!ver) return null;
    // the bit stream: mode, length, the bytes, a terminator, then padding to fill every data codeword
    var bits = [], put = function (val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    for (var t = 0; t < 4 && bits.length < total * 8; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var data = [], i, j;
    for (i = 0; i < bits.length; i += 8) { var byte = 0; for (j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]; data.push(byte); }
    for (i = 0; data.length < total; i++) data.push(i % 2 ? 0x11 : 0xEC);
    // split into blocks, add each block's error correction, then interleave
    var blocks = [], at = 0;
    VERS[ver].blocks.forEach(function (b) { for (var k = 0; k < b[0]; k++) { var d = data.slice(at, at + b[1]); at += b[1]; blocks.push({ d: d, e: ecBytes(d, VERS[ver].ec) }); } });
    var stream = [], longest = 0; blocks.forEach(function (b) { longest = Math.max(longest, b.d.length); });
    for (i = 0; i < longest; i++) blocks.forEach(function (b) { if (i < b.d.length) stream.push(b.d[i]); });
    for (i = 0; i < VERS[ver].ec; i++) blocks.forEach(function (b) { stream.push(b.e[i]); });
    // the grid: finder patterns, timing, alignment, and the places kept for format and version
    var n = 17 + 4 * ver, m = [], fixed = [], r, c;
    for (r = 0; r < n; r++) { m[r] = []; fixed[r] = []; for (c = 0; c < n; c++) { m[r][c] = 0; fixed[r][c] = false; } }
    var set = function (rr, cc, val) { if (rr < 0 || cc < 0 || rr >= n || cc >= n) return; m[rr][cc] = val ? 1 : 0; fixed[rr][cc] = true; };
    var finder = function (r0, c0) { for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) { var inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6; set(r0 + dr, c0 + dc, inside && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4))); } };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var al = ALIGN[ver];
    al.forEach(function (ar) { al.forEach(function (ac) {
      if ((ar === 6 && ac === 6) || (ar === 6 && ac === n - 7) || (ar === n - 7 && ac === 6)) return;   // where a finder pattern already is
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) set(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }); });
    set(n - 8, 8, 1);   // the one module that is always dark
    for (i = 0; i < 9; i++) { if (!fixed[8][i]) set(8, i, 0); if (!fixed[i][8]) set(i, 8, 0); }
    for (i = 0; i < 8; i++) { if (!fixed[8][n - 1 - i]) set(8, n - 1 - i, 0); if (!fixed[n - 1 - i][8]) set(n - 1 - i, 8, 0); }
    if (ver >= 7) {
      var vbits = bch(ver, 6, 0x1F25, 13);
      for (i = 0; i < 18; i++) { var bit = (vbits >> i) & 1; set(Math.floor(i / 3), n - 11 + (i % 3), bit); set(n - 11 + (i % 3), Math.floor(i / 3), bit); }
    }
    // the data, in the zigzag from the bottom right, two columns at a time
    var sbits = []; stream.forEach(function (b) { for (var k = 7; k >= 0; k--) sbits.push((b >> k) & 1); });
    var k = 0, up = true;
    for (c = n - 1; c > 0; c -= 2) {
      if (c === 6) c--;   // the timing column is skipped
      for (var step = 0; step < n; step++) {
        r = up ? n - 1 - step : step;
        for (j = 0; j < 2; j++) { var cc = c - j; if (!fixed[r][cc]) { m[r][cc] = k < sbits.length ? sbits[k] : 0; k++; } }
      }
      up = !up;
    }
    // try each mask, write the format beside it, and keep the one that scores best
    var draw = function (mask) {
      var g = m.map(function (row) { return row.slice(); });
      for (var rr = 0; rr < n; rr++) for (var c2 = 0; c2 < n; c2++) if (!fixed[rr][c2] && MASKS[mask](rr, c2)) g[rr][c2] ^= 1;
      var f = bch(mask, 5, 0x537, 11) ^ 0x5412;   // level M is 00, then the mask's three bits
      var bitAt = function (x) { return (f >> x) & 1; };
      for (var x = 0; x <= 5; x++) g[8][x] = bitAt(14 - x);
      g[8][7] = bitAt(8); g[8][8] = bitAt(7); g[7][8] = bitAt(6);
      for (x = 9; x <= 14; x++) g[14 - x][8] = bitAt(14 - x);
      for (x = 0; x <= 6; x++) g[n - 1 - x][8] = bitAt(14 - x);
      for (x = 7; x <= 14; x++) g[8][n - 15 + x] = bitAt(14 - x);
      return g;
    };
    var best = null, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      if (forceMask != null && mask !== forceMask) continue;
      var g = draw(mask), sc = penalty(g);
      if (sc < bestScore) { bestScore = sc; best = g; }
    }
    return best.map(function (row) { return row.join(''); });
  }
  root.pasQR = pasQR;
  if (typeof module !== 'undefined' && module.exports) module.exports = pasQR;
})(typeof window !== 'undefined' ? window : this);
