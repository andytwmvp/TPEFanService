
(function() {
  "use strict";
  var $ = function(id) {
    return document.getElementById(id);
  };
  if (!window.THREE) {
    $("fail").style.display = "grid";
    return;
  }
  function parseGif(b) {
    var p = 6, W = b[p] | b[p + 1] << 8, H = b[p + 2] | b[p + 3] << 8, fl = b[p + 4];
    p += 7;
    var gct = null, frames = [], gce = { delay: 100, tr: -1, disp: 0 };
    if (fl & 128) {
      var n = 3 << (fl & 7) + 1;
      gct = b.subarray(p, p + n);
      p += n;
    }
    function blocks() {
      var start = p, len = 0, s;
      while ((s = b[p]) > 0) {
        len += s;
        p += s + 1;
      }
      p++;
      var out = new Uint8Array(len), q = start, o = 0;
      while ((s = b[q]) > 0) {
        out.set(b.subarray(q + 1, q + 1 + s), o);
        o += s;
        q += s + 1;
      }
      return out;
    }
    while (p < b.length) {
      var c = b[p++];
      if (c === 59) break;
      if (c === 33) {
        var lab = b[p++];
        if (lab === 249) {
          var f = b[p + 1], d = (b[p + 2] | b[p + 3] << 8) * 10;
          gce = { delay: d < 20 ? 100 : d, tr: f & 1 ? b[p + 4] : -1, disp: f >> 2 & 7 };
          p += 6;
        } else blocks();
      } else if (c === 44) {
        var fr = { x: b[p] | b[p + 1] << 8, y: b[p + 2] | b[p + 3] << 8, w: b[p + 4] | b[p + 5] << 8, h: b[p + 6] | b[p + 7] << 8 };
        var lf = b[p + 8];
        p += 9;
        fr.pal = gct;
        fr.interlace = !!(lf & 64);
        if (lf & 128) {
          var m = 3 << (lf & 7) + 1;
          fr.pal = b.subarray(p, p + m);
          p += m;
        }
        fr.min = b[p++];
        fr.data = blocks();
        fr.delay = gce.delay;
        fr.tr = gce.tr;
        fr.disp = gce.disp;
        frames.push(fr);
        gce = { delay: 100, tr: -1, disp: 0 };
      } else break;
    }
    return { w: W, h: H, frames };
  }
  var LZ = { prefix: new Uint16Array(4096), suffix: new Uint8Array(4096), stack: new Uint8Array(4097) };
  function lzw(min, data, count, out) {
    var clear = 1 << min, eoi = clear + 1, size = min + 1, mask = (1 << size) - 1, avail = clear + 2, old = -1;
    var datum = 0, bits = 0, pos = 0, op = 0, top = 0, first = 0, code, inCode, i;
    var prefix = LZ.prefix, suffix = LZ.suffix, stack = LZ.stack;
    for (i = 0; i < clear; i++) {
      prefix[i] = 0;
      suffix[i] = i;
    }
    while (op < count) {
      if (top === 0) {
        if (bits < size) {
          if (pos >= data.length) break;
          datum |= data[pos++] << bits;
          bits += 8;
          continue;
        }
        code = datum & mask;
        datum >>= size;
        bits -= size;
        if (code > avail || code === eoi) break;
        if (code === clear) {
          size = min + 1;
          mask = (1 << size) - 1;
          avail = clear + 2;
          old = -1;
          continue;
        }
        if (old === -1) {
          stack[top++] = suffix[code];
          old = code;
          first = code;
          continue;
        }
        inCode = code;
        if (code === avail) {
          stack[top++] = first;
          code = old;
        }
        while (code > clear) {
          stack[top++] = suffix[code];
          code = prefix[code];
        }
        first = suffix[code];
        stack[top++] = first;
        if (avail < 4096) {
          prefix[avail] = old;
          suffix[avail] = first;
          avail++;
          if ((avail & mask) === 0 && avail < 4096) {
            size++;
            mask += avail;
          }
        }
        old = inCode;
      }
      out[op++] = stack[--top];
    }
    return op;
  }
  function drawGifFrame(gif2, fr, rgba, idxBuf) {
    var n = fr.w * fr.h, got = lzw(fr.min, fr.data, n, idxBuf), pal = fr.pal, tr = fr.tr, W = gif2.w, r, c, src, row, o, v;
    var rows = null;
    if (fr.interlace) {
      rows = [];
      [[0, 8], [4, 8], [2, 4], [1, 2]].forEach(function(s) {
        for (var y = s[0]; y < fr.h; y += s[1]) rows.push(y);
      });
    }
    for (r = 0; r < fr.h; r++) {
      row = rows ? rows[r] : r;
      src = r * fr.w;
      if (src >= got) break;
      o = ((fr.y + row) * W + fr.x) * 4;
      for (c = 0; c < fr.w; c++, o += 4) {
        v = idxBuf[src + c];
        if (v === tr) continue;
        rgba[o] = pal[v * 3];
        rgba[o + 1] = pal[v * 3 + 1];
        rgba[o + 2] = pal[v * 3 + 2];
        rgba[o + 3] = 255;
      }
    }
  }
  var SEAT_P = 0.49;
  function colX(c) {
    return (c - 10.5) * SEAT_P;
  }
  var STAGE_W = 2 * -colX(2.5), STAGE_D = 7.6, BACK_H = 4.6, SEAT_H = 0.45;
  var ROOM_W = 16, ROOM_D = 23, ROOM_Z = 3.2, ROOM_H = 6.9;
  var ROW_Z0 = 0.9, ROW_PITCH = 0.9;
  var PILLAR_W = 0.9, PILLAR_D = 0.9, PILLARS = [{ x: colX(5.5), z: ROW_Z0 + 0.4 - PILLAR_D / 2 }, { x: colX(15.5), z: ROW_Z0 + 0.4 - PILLAR_D / 2 }];
  var FRONT = [
    ["A", [colX(7), 8, SEAT_P]],
    ["B", [colX(7), 8, SEAT_P]],
    ["C", [colX(6), 10, SEAT_P]],
    ["D", [colX(6), 10, SEAT_P]],
    ["E", [colX(6), 10, SEAT_P]],
    ["F", [colX(6), 10, SEAT_P]],
    ["G", [colX(6), 10, SEAT_P]],
    ["H", [colX(6), 10, SEAT_P]],
    ["I", [colX(5.5), 11, SEAT_P]],
    ["J", [colX(2.5), 17, SEAT_P]],
    ["K", [colX(2), 18, SEAT_P]],
    ["L", [colX(1), 9, SEAT_P], [colX(12), 9, SEAT_P]],
    ["M", [colX(0), 10, SEAT_P], [colX(12), 10, SEAT_P]]
  ];
  var SIDE_X1 = STAGE_W / 2 + 0.45, SIDE_Z1 = 4 * SEAT_P - 1.5;
  var STAGE_Z0 = SIDE_Z1 - 4 * SEAT_P, STAGE_LEN = STAGE_D + STAGE_Z0;
  var ROW_E = [0, 0.17, 0.35, 0.55, 0.73, 0.93, 1.15, 1.34, 1.55, 1.85, 2.12, 2.35, 2.6], BOOTH_E = 2.95, SIDE_E = [0.2, 0.4];
  var SIDES = [
    ["N", -SIDE_X1, SIDE_Z1 - SEAT_P, 11, SEAT_P, -Math.PI / 2, 0],
    ["O", -SIDE_X1 - ROW_PITCH, SIDE_Z1, 13, SEAT_P, -Math.PI / 2, 1],
    ["P", SIDE_X1, SIDE_Z1 - SEAT_P, 11, SEAT_P, Math.PI / 2, 0],
    ["Q", SIDE_X1 + ROW_PITCH, SIDE_Z1, 13, SEAT_P, Math.PI / 2, 1]
  ];
  var SIDE_NAME = { N: "左側", O: "左側", P: "右側", Q: "右側" };
  var ROW_ORDER = "ABCDEFGHIJKLMNOPQ";
  var GIF_PERSON = 0.735, GIF_FOOT = 0.018;
  function newSeed() {
    return 1 + Math.floor(Math.random() * 2e9);
  }
  var S = {
    my: 0,
    h: 170,
    fov: 40,
    avg: 160,
    spread: 6,
    rate: 100,
    pen: true,
    seed: newSeed(),
    mode: "gif",
    nPerf: 1,
    perfH: 160,
    dance: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    gifPH: 168,
    gifX: 0,
    gifZ: 2,
    gifB: 100,
    gifPlay: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    house: 40,
    houseOn: false,
    envOn: false,
    penGlow: true,
    stageOn: true,
    stageCol: "blue",
    stage: 60,
    beam: 0,
    colorAnim: true,
    backSat: 0.9,
    stageH: 0,
    riseLow: 0.23,
    rearBase: 1.8,
    riseRear: 0.25,
    hiUp: 0.12,
    sideUp: 0.3,
    pick: "me",
    edit: -1,
    overview: false,
    cam: null,
    team: 0,
    lightPct: 60,
    fanPct: 40,
    props: true,
    yaw: 0,
    pitch: 0,
    oAz: 0.5,
    oEl: 0.6,
    oR: 17
  };
  function rnd(seed) {
    var t = seed + 1831565813 | 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  var seats = [];
  function frontElev(r) {
    return ROW_E[Math.max(0, Math.min(ROW_E.length - 1, r))];
  }
  function seatY(s) {
    return s.side ? SIDE_E[s.st] : frontElev(s.st);
  }
