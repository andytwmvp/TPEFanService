
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
  function buildSeats() {
    seats = [];
    function add(row, num, x, z, rot, st, w, blank, side2) {
      var s = { i: seats.length, row, num, rot, st, w, blank: !!blank, side: !!side2, cOcc: null, cH: null };
      s.pos = new THREE.Vector3(x, seatY(s), z);
      seats.push(s);
    }
    FRONT.forEach(function(def, r) {
      var num = 1;
      for (var g = 1; g < def.length; g++) for (var k = 0; k < def[g][1]; k++, num++) {
        add(def[0], num, def[g][0] + k * def[g][2], ROW_Z0 + r * ROW_PITCH, 0, r, def[g][2], def[0] === "A" && (num === 4 || num === 5));
      }
    });
    SIDES.forEach(function(d) {
      for (var k = 0; k < d[3]; k++) add(d[0], k + 1, d[1], d[2] - k * d[4], d[5], d[6], d[4], false, true);
    });
  }
  function seatLabel(s) {
    return s.row + "排 " + s.num + "號" + (SIDE_NAME[s.row] ? "（舞台" + SIDE_NAME[s.row] + "）" : "");
  }
  function seatOcc(s) {
    if (s.i === S.my && !S.cam) return false;
    if (s.cOcc !== null) return s.cOcc;
    if (s.blank) return false;
    return rnd(S.seed * 977 + s.i * 13 + 1) * 100 < S.rate;
  }
  function seatHeight(s) {
    if (s.cH !== null) return s.cH;
    var a = rnd(S.seed * 131 + s.i * 7 + 2), b = rnd(S.seed * 173 + s.i * 11 + 3);
    return Math.round(S.avg + (a + b - 1) * S.spread * 1.6);
  }
  function findSeat(row, num) {
    for (var i = 0; i < seats.length; i++) if (seats[i].row === row && seats[i].num === num) return i;
    return -1;
  }
  var canvas = $("gl");
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {
    $("fail").textContent = "這個瀏覽器無法啟用 WebGL，沒辦法顯示 3D 視野。";
    $("fail").style.display = "grid";
    return;
  }
  var COARSE0 = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, COARSE0 ? 1.5 : 2));
  canvas.addEventListener("webglcontextlost", function(e) {
    e.preventDefault();
    $("fail").textContent = "3D 畫面被瀏覽器暫停了（常見於手機切到背景太久）。請重新整理頁面。";
    $("fail").style.display = "grid";
  });
  canvas.addEventListener("webglcontextrestored", function() {
    $("fail").style.display = "none";
  });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(131587);
  scene.fog = new THREE.FogExp2(460298, 0.014);
  var camera = new THREE.PerspectiveCamera(55, 1.6, 0.05, 80);
  camera.rotation.order = "YXZ";
  function phong(color, shininess) {
    return new THREE.MeshPhongMaterial({ color, shininess: shininess || 4, specular: 1118481 });
  }
  function mesh(geo, mat, x, y, z, parent) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    (parent || scene).add(m);
    return m;
  }
  mesh(new THREE.BoxGeometry(ROOM_W, ROOM_H, ROOM_D), new THREE.MeshPhongMaterial({ color: 1380890, side: THREE.BackSide, shininess: 2, specular: 328965 }), 0, ROOM_H / 2, ROOM_Z);
  var floor = mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), phong(1907234, 8), 0, 2e-3, ROOM_Z);
  floor.rotation.x = -Math.PI / 2;
  var stageMesh = mesh(new THREE.BoxGeometry(STAGE_W, 1, STAGE_LEN), phong(3881536, 6), 0, 0.3, STAGE_Z0 - STAGE_LEN / 2);
  var stageSkirt = mesh(new THREE.BoxGeometry(STAGE_W + 0.02, 1, 0.02), phong(328966), 0, 0.3, STAGE_Z0 + 0.012);
  mesh(new THREE.BoxGeometry(STAGE_W, BACK_H, 0.1), phong(592139), 0, BACK_H / 2, -STAGE_D - 0.05);
  var pillarMat = phong(1778232, 3), stripeMat = phong(14250540, 6);
  stripeMat.emissive = new THREE.Color(2757124);
  var houseBack = new THREE.SpotLight(14081279, 0, 0, 0.55, 0.7, 1);
  houseBack.position.set(0, ROOM_H - 0.3, ROOM_Z + ROOM_D / 2 - 0.5);
  houseBack.target.position.set(0, 1.6, -1.5);
  scene.add(houseBack);
  scene.add(houseBack.target);
  PILLARS.forEach(function(p) {
    mesh(new THREE.BoxGeometry(PILLAR_W, ROOM_H, PILLAR_D), pillarMat, p.x, ROOM_H / 2, p.z).userData.ribbonBlocksTarget = true;
    for (var k = 0; k < 8; k++) mesh(new THREE.BoxGeometry(PILLAR_W + 0.012, 0.04, PILLAR_D + 0.012), stripeMat, p.x, 1.87 + k * 0.095, p.z);
  });
  [-1, 1].forEach(function(s) {
    var zA = SIDE_Z1 + 0.5, zB = -STAGE_D + 1.05, L = zA - zB, x = s * (STAGE_W / 2 + 0.03 - 0.4);
    var rh = SIDE_E[0] + SEAT_H + 0.12 + 0.05;
    mesh(new THREE.BoxGeometry(0.08, rh, L), phong(723726, 8), x, rh / 2, (zA + zB) / 2).userData.ribbonBarrier=true;
  });
  var trussMat = phong(789518, 30);
  var GRID_Y = 4.96;
  [-1, 1].forEach(function(s) {
    var e12 = mesh(new THREE.BoxGeometry(0.38, 0.6, 0.36), phong(657932, 20), s * (2.45 + 0.55), GRID_Y - 0.6, 0.85 + 0.6);
    e12.rotation.set(-0.18, 0, 0);
    var s6 = mesh(new THREE.BoxGeometry(0.2, 0.3, 0.18), phong(921104, 20), s * 3.55, GRID_Y - 0.45, 0.85 - 7.1);
    s6.rotation.set(-0.25, s * -0.35, 0);
  });
  var platforms = new THREE.Group();
  scene.add(platforms);
  var platMat = phong(1512476, 4);
  function buildPlatforms() {
    while (platforms.children.length) {
      var c = platforms.children.pop();
      c.geometry.dispose();
    }
    for (var r = 1; r < FRONT.length; r++) {
      var e = frontElev(r);
      if (e <= 5e-3) continue;
      var d = FRONT[r], last = d[d.length - 1], x0 = d[1][0] - 0.45, x1 = last[0] + (last[1] - 1) * last[2] + 0.45;
      if (r >= 8) {
        x0 = Math.min(x0, -5.5);
        x1 = Math.max(x1, 5.5);
      }
      mesh(new THREE.BoxGeometry(x1 - x0, e, ROW_PITCH), platMat, (x0 + x1) / 2, e / 2, ROW_Z0 + r * ROW_PITCH - 0.12, platforms);
    }
    SIDES.forEach(function(d2) {
      var e2 = SIDE_E[d2[6]];
      if (e2 <= 5e-3) return;
      var zA = d2[2] + 0.4, zB = d2[2] - (d2[3] - 1) * d2[4] - 0.4;
      mesh(new THREE.BoxGeometry(0.8, e2, zA - zB), platMat, d2[1] + (d2[1] < 0 ? 0.08 : -0.08), e2 / 2, (zA + zB) / 2, platforms);
    });
  }
  var boothLamp = null, boothLight = null;
  (function() {
    var z0 = ROW_Z0 + 12 * ROW_PITCH + ROW_PITCH / 2 - 0.12, z1 = ROOM_Z + ROOM_D / 2, zc2 = (z0 + z1) / 2;
    mesh(new THREE.BoxGeometry(11, BOOTH_E, z1 - z0), platMat, 0, BOOTH_E / 2, zc2);
    var RAIL_H = 1;
    mesh(new THREE.BoxGeometry(11, 0.04, 0.04), phong(1710622, 30), 0, BOOTH_E + RAIL_H, z0 + 0.05);
    [-4.5, -1.5, 1.5, 4.5].forEach(function(x) {
      mesh(new THREE.BoxGeometry(0.04, RAIL_H, 0.04), phong(1710622, 30), x, BOOTH_E + RAIL_H / 2, z0 + 0.05);
    });
    var drape = canvasTex(64, function(x, n) {
      for (var q = 0; q < n; q++) {
        var v = 10 + 8 * Math.sin(q / n * Math.PI * 6) + 3 * Math.sin(q * 1.7);
        x.fillStyle = "rgb(" + (v | 0) + "," + (v | 0) + "," + (v + 2 | 0) + ")";
        x.fillRect(q, 0, 1, n);
      }
    });
    drape.wrapS = THREE.RepeatWrapping;
    drape.repeat.set(22, 1);
    mesh(new THREE.BoxGeometry(11, RAIL_H - 0.03, 0.015), new THREE.MeshPhongMaterial({ color: 1579036, map: drape, shininess: 2 }), 0, BOOTH_E + (RAIL_H - 0.03) / 2, z0 + 0.075);
    var deskMat = phong(1052692, 20), dz = z0 + 0.75, DESKS = [-3.9, -1.3, 1.3, 3.9];
    DESKS.forEach(function(x, di) {
      mesh(new THREE.BoxGeometry(2.2, 0.75, 0.75), deskMat, x, BOOTH_E + 0.375, dz);
      var top = mesh(new THREE.BoxGeometry(2, 0.06, 0.55), phong(2105384, 40), x, BOOTH_E + 0.79, dz - 0.02);
      top.rotation.x = 0.25;
      for (var j = 0; j < 14; j++) {
        var c = [3997562, 16728160, 4235519, 16760896][(j + di) % 4];
        mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), new THREE.MeshBasicMaterial({ color: c, fog: false }), x - 0.85 + j * 0.13, BOOTH_E + 0.835, dz - 0.07);
      }
      var scr = mesh(new THREE.BoxGeometry(0.55, 0.34, 0.03), new THREE.MeshBasicMaterial({ color: 1845828 }), x, BOOTH_E + 1.1, dz - 0.3);
      scr.rotation.x = -0.1;
    });
    boothLamp = new THREE.MeshBasicMaterial({ color: 16769704, fog: false, toneMapped: false });
    [-2.6, 0, 2.6].forEach(function(x) {
      mesh(new THREE.BoxGeometry(1, 0.04, 0.12), boothLamp, x, BOOTH_E + 2.5, dz + 0.1);
    });
    boothLight = new THREE.PointLight(16763256, 0, 7.5, 1.6);
    boothLight.position.set(0, BOOTH_E + 2.3, dz + 0.1);
    scene.add(boothLight);
    var SPOTS = [[-4.4, 0.13], [-3.5, 0.1], [-1, 0.12], [1.7, 0.1], [4.2, 0.13]];
    var openIdx = [0, 1, 2, 3, 4].sort(function() {
      return Math.random() - 0.5;
    }).slice(0, 3);
    var foods = "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".split("|").map(function(b) {
      var tx = new THREE.TextureLoader().load("data:image/jpeg;base64," + b);
      tx.encoding = THREE.sRGBEncoding;
      return tx;
    });
    var wood = canvasTex(128, function(x, n) {
      x.fillStyle = "#d9a46c";
      x.fillRect(0, 0, n, n);
      for (var q = 0; q < 46; q++) {
        x.fillStyle = "rgba(" + (150 + q * 37 % 40) + "," + (95 + q * 13 % 30) + ",55," + (0.25 + q % 5 * 0.08) + ")";
        x.fillRect(0, (q * 2.8 + q % 3) % n, n, 1 + q % 2);
      }
    });
    wood.encoding = THREE.sRGBEncoding;
    var woodMat = new THREE.MeshPhongMaterial({ map: wood, shininess: 18 }), woodDark = new THREE.MeshPhongMaterial({ color: 9067060, shininess: 10 });
    var ovalGeo = new THREE.CylinderGeometry(1, 1, 1, 32), discGeo = new THREE.CircleGeometry(1, 32);
    var BW = 0.105, BD = 0.075, BH = 0.05;
    SPOTS.forEach(function(sp, q) {
      var g = new THREE.Group(), isOpen = openIdx.indexOf(q) >= 0;
      g.position.set(sp[0], BOOTH_E + 0.79 + 0.03 - 0.247 * sp[1] + 0.025, dz - 0.02 + sp[1]);
      g.rotation.set(0.25, (Math.random() - 0.5) * 0.6, 0);
      var box = new THREE.Mesh(ovalGeo, woodMat);
      box.scale.set(BW, BH, BD);
      g.add(box);
      var band = new THREE.Mesh(ovalGeo, woodDark);
      band.scale.set(BW + 1e-3, 8e-3, BD + 1e-3);
      band.position.y = -BH / 2 + 6e-3;
      g.add(band);
      if (isOpen) {
        var food = new THREE.Mesh(discGeo, new THREE.MeshLambertMaterial({ map: foods[Math.floor(Math.random() * foods.length)] }));
        food.rotation.x = -Math.PI / 2;
        food.scale.set(BW * 0.97, BD * 0.97, 1);
        food.position.y = BH / 2 + 1e-3;
        g.add(food);
        var lid = new THREE.Mesh(ovalGeo, woodMat);
        lid.scale.set(BW + 4e-3, 0.014, BD + 4e-3);
        lid.position.set(0.24, -BH / 2 + 7e-3, 0.02);
        lid.rotation.y = 0.4;
        g.add(lid);
      } else {
        var cap = new THREE.Mesh(ovalGeo, woodMat);
        cap.scale.set(BW + 4e-3, 0.016, BD + 4e-3);
        cap.position.y = BH / 2 + 6e-3;
        g.add(cap);
      }
      scene.add(g);
    });
  })();
  (function() {
    var stairMat = phong(2763312, 6), noseMat = phong(9079440, 20), railMat = phong(1118484, 30);
    var top = ROW_E[8], n = 10, rise = top / n, run = 0.28, w = 1.1;
    var zEnd = ROW_Z0 + 8 * ROW_PITCH - ROW_PITCH / 2 - 0.12, zStart = zEnd - n * run;
    [-1, 1].forEach(function(s) {
      var x = s * 4.9;
      for (var k = 0; k < n; k++) {
        var h = (k + 1) * rise, z = zStart + k * run;
        mesh(new THREE.BoxGeometry(w, h, run), stairMat, x, h / 2, z + run / 2);
        mesh(new THREE.BoxGeometry(w, 0.012, 0.03), noseMat, x, h + 6e-3, z + 0.015);
      }
      [-1, 1].forEach(function(q) {
        var rx = x + q * (w / 2 + 0.02), len = Math.hypot(n * run, top), ang = Math.atan2(top, n * run);
        var r = mesh(new THREE.BoxGeometry(0.04, 0.04, len), railMat, rx, top / 2 + 0.9, zStart + n * run / 2);
        r.rotation.x = -ang;
        for (var k2 = 0; k2 <= n; k2 += 3) mesh(new THREE.BoxGeometry(0.03, 0.9, 0.03), railMat, rx, k2 * rise + 0.45, zStart + k2 * run + 0.1);
      });
      var sx = s * 3.38, sz = zStart + 0.45, standMat = phong(10132128, 40);
      mesh(new THREE.CylinderGeometry(0.02, 0.025, 2.1, 8), standMat, sx, 1.05, sz);
      [0, 2.09, 4.19].forEach(function(a) {
        var fx = sx + Math.sin(a) * 0.38, fz = sz + Math.cos(a) * 0.38, dir = new THREE.Vector3(sx - fx, 0.6, sz - fz), L = dir.length();
        var leg = mesh(new THREE.CylinderGeometry(0.012, 0.012, L, 6), standMat, (sx + fx) / 2, 0.3, (sz + fz) / 2);
        leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      });
      mesh(new THREE.BoxGeometry(0.42, 0.65, 0.38), phong(1710620, 10), sx, 2.1 + 0.33, sz);
      mesh(new THREE.BoxGeometry(0.45, 0.7, 0.5), phong(1317908, 10), sx, 0.38, sz - 0.75);
    });
  })();
  var amb = new THREE.AmbientLight(9081781, 0.05);
  scene.add(amb);
  var hemi = new THREE.HemisphereLight(16773596, 2762274, 0);
  scene.add(hemi);
  var bounce = new THREE.PointLight(16767172, 0.3, 24, 1);
  scene.add(bounce);
  var frontSpots = [], backSpots = [], floorLights = [];
  var lensGeo = new THREE.SphereGeometry(0.085, 10, 8), canGeo = new THREE.BoxGeometry(0.22, 0.26, 0.22);
  function makeSpot(x, y, z, tx, tz, color, angle) {
    var l = new THREE.SpotLight(color, 1, 40, angle, 0.65, 1);
    l.position.set(x, y, z);
    scene.add(l);
    scene.add(l.target);
    l.userData.tx = tx;
    l.userData.tz = tz;
    l.userData.lens = mesh(lensGeo, new THREE.MeshBasicMaterial({ color, fog: false }), x, y - 0.02, z);
    var can = mesh(canGeo, trussMat, x, y + 0.14, z);
    if (IDOL_PAGE) {
      l.userData.lens.visible = false;
      can.visible = false;
    }
    return l;
  }
  [-1.6, 1.6].forEach(function(x) {
    frontSpots.push(makeSpot(x, GRID_Y - 0.3, 0.85 + 1.78, x * 0.4, STAGE_Z0 - 1.2, 16773340, 0.5));
  });
  var DOWN = new THREE.Vector3(0, -1, 0), tmpV = new THREE.Vector3();
  function aimLights() {
    frontSpots.concat(backSpots).forEach(function(l) {
      l.target.position.set(l.userData.tx, S.stageH + 0.9, l.userData.tz);
      l.target.updateMatrixWorld();
      if (l.userData.beam) {
        tmpV.copy(l.target.position).sub(l.position).normalize();
        l.userData.beam.quaternion.setFromUnitVectors(DOWN, tmpV);
      }
    });
    bounce.position.set(0, S.stageH + 1.4, STAGE_Z0 - 0.6);
    floorLights.forEach(function(l) {
      l.position.set(l.userData.x, S.stageH + 0.3, -STAGE_D + 0.6);
      l.userData.lens.position.set(l.userData.x, S.stageH + 0.25, -STAGE_D + 0.6);
    });
  }
  var tmpC = new THREE.Color();
  var STAGE_COL = { white: 16774376, warm: 16763274, pink: 16744376, blue: 9406207 };
  function updateLights(t) {
    var dark = !!S.blackout;
    var house = S.houseOn && !dark ? S.house / 100 : 0, st = S.stageOn && !dark ? S.stage / 100 : 0, sc = STAGE_COL[S.stageCol];
    var env = S.envOn && !dark ? 1 : 0;
    var glowOn = S.penGlow && !dark;
    zoneLights.forEach(function(l) {
      l.visible = glowOn;
    });
    glowPts.visible = S.props && glowOn;
    var sk = dark ? 657930 : S.penGlow ? 16777215 : 5592405;
    if (stickMat.color.getHex() !== sk) {
      stickMat.color.setHex(sk);
      if (rstickMat) rstickMat.color.setHex(sk);
    }
    if (dark !== updateLights.wasDark) {
      updateLights.wasDark = dark;
      Object.keys(fanTex).forEach(function(k) {
        fanTex[k].front.emissiveIntensity = dark ? 0 : 0.16;
        fanTex[k].back.emissiveIntensity = dark ? 0 : 0.25;
      });
    }
    amb.intensity = env * (0.01 + house * 0.55);
    hemi.intensity = env * house * 0.9;
    if (S.overview && !dark) {
      amb.intensity += 0.18;
      hemi.intensity += 0.35;
    }
    houseBack.intensity = dark ? 0 : 0.22;
    if (boothLight) {
      boothLight.intensity = dark ? 0 : 0.9;
      boothLamp.color.setHex(dark ? 0 : 16769704);
    }
    stripeMat.emissive.setHex(dark ? 0 : 2757124);
    bounce.intensity = 0.3 * st;
    bounce.color.setHex(sc);
    frontSpots.forEach(function(l) {
      l.intensity = 1.7 * st;
      l.color.setHex(sc);
      l.userData.lens.material.color.setHex(sc).multiplyScalar(Math.min(1, st + 0.05));
    });
    backSpots.forEach(function(l, i) {
      var hue = l.userData.hue + (S.colorAnim ? 0.07 * Math.sin(t * 0.3 + i * 1.3) : 0);
      tmpC.setHSL(hue - Math.floor(hue), S.backSat, 0.56);
      var pulse = S.colorAnim ? 0.85 + 0.15 * Math.sin(t * 2.2 + i * 1.7) : 1;
      l.color.copy(tmpC);
      l.intensity = 0.55 * st * pulse;
      l.userData.lens.material.color.copy(tmpC).multiplyScalar(Math.min(1, st + 0.05));
      l.userData.beam.material.color.copy(tmpC);
      l.userData.beam.material.opacity = 0.16 * (S.beam / 100) * Math.min(1.2, st) * pulse;
      l.userData.beam.visible = S.beam > 0 && st > 0;
    });
    floorLights.forEach(function(l) {
      l.intensity = 0.45 * st * (S.backSat > 0.6 ? 1 : 0.35);
      l.userData.lens.material.color.setRGB(0.85, 0.66, 1).multiplyScalar(Math.min(1, st));
    });
    scene.fog.density = 9e-3 + 0.012 * (S.beam / 100);
  }
  var TEAMS = [
    { id: "TIII", name: "Team TIII", color: "#3ca9cb", members: [
      { n: "張少瞳", nick: "ひとみ", c: ["#ffc2cc"], cn: "淡粉色" },
      { n: "林于馨", nick: "れいち", c: ["rainbow", "#ffc0cb"], cn: "彩色＋粉紅色" },
      { n: "伊品", nick: "品品", c: ["#02f78e"], cn: "薄荷綠" },
      { n: "蘇姮羽", nick: "小羽", c: ["#0000ff"], cn: "藍色" },
      { n: "陳昭霓", nick: "棗泥", c: ["#cfa6e0"], cn: "淺紫色" },
      { n: "陳以凌", nick: "娜娜", c: ["#ffc8dc", "#d9c2ff"], cn: "淺粉＋淺紫" },
      { n: "唐靜", nick: "shizuko", c: ["#ffff00"], cn: "鵝黃色" },
      { n: "陳嘉儀", nick: "+1", c: ["#b0d0de", "#008000"], cn: "青色＋綠色" },
      { n: "劉子菲", nick: "菲菲", c: ["#b9ceac", "#0000ff"], cn: "淺綠＋藍色" },
      { n: "胡詠晴", nick: "くるみ", c: ["#002fa7", "#ffffff"], cn: "克萊因藍＋純白" },
      { n: "楊家宜", nick: "樂樂", c: ["#ff007f", "#a9eede"], cn: "桃紅＋淺綠" },
      { n: "郁子蕾", nick: "蕾蕾", c: ["#ffffff"], cn: "白色" },
      { n: "呂昕恩", nick: "沅沅", c: ["#d9c2ff", "#fff3a0"], cn: "淺紫＋淺黃" }
    ] },
    { id: "P", name: "Team P", color: "#dc483a", members: [
      { n: "林易沄", nick: "EKI", c: ["#ecb1ac", "#ff2020"], cn: "玫瑰金＋紅色" },
      { n: "孟庭筠", nick: "墨魚", c: ["#b8e2ff", "#ffbcd0"], cn: "淺藍＋淺粉" },
      { n: "蔡亞恩", nick: "そば", c: ["#33ffff", "#ffffff"], cn: "水藍＋白色" },
      { n: "黃奕霖", nick: "10", c: ["#f1dd95"], cn: "奶油黃" },
      { n: "陳穎臻", nick: "臻臻", c: ["#ffc0cb", "#ffff00"], cn: "粉紅色＋黃色" },
      { n: "黃昱燕", nick: "燕子", c: ["#9b4dff", "#ffffff"], cn: "紫色＋白色" },
      { n: "陳泰琌", nick: "Taeka", c: ["#d7f9c4"], cn: "青蘋果色" },
      { n: "蔡喬茵", nick: "Miyu", c: ["#a1afc9", "#ffffff"], cn: "灰藍＋白色" },
      { n: "陳巧儀", nick: "ice", c: ["#ccfffd"], cn: "淺藍色" },
      { n: "楊亞芸", nick: "yy", c: ["#ff1a1a", "#90ee90", "#87ceeb"], cn: "鮮紅＋淺綠＋天空藍" },
      { n: "林昀希", nick: "希希", c: ["#ff146e"], cn: "桃粉色" },
      { n: "許淳媛", nick: "糰子", c: ["#002fa7"], cn: "克萊因藍" },
      { n: "張鈊喬", nick: "ゆめな", c: ["#ffb9a3"], cn: "蜜桃奶油" },
      { n: "劉曣甯", nick: "甯甯", c: ["#00b2a9", "#7ed6e8"], cn: "#00B2A9＋#7ED6E8" }
    ] }
  ];
  var IM = {}, MAXN = 240;
  function inst(name, geo, mat, count) {
    var m = new THREE.InstancedMesh(geo, mat, count);
    m.frustumCulled = false;
    scene.add(m);
    IM[name] = m;
    return m;
  }
  var cyl8 = new THREE.CylinderGeometry(1, 1, 1, 8), unitBox = new THREE.BoxGeometry(1, 1, 1), sph = new THREE.SphereGeometry(1, 12, 9);
  inst("pad", unitBox, phong(723725, 12), MAXN);
  inst("back", unitBox, phong(723725, 12), MAXN);
  function latheN(pts, seg) {
    var g = new THREE.LatheGeometry(pts.map(function(q) {
      return new THREE.Vector2(q[0], q[1]);
    }), seg);
    g.computeVertexNormals();
    return g;
  }
  var torsoGeo = latheN([[1e-3, 0], [0.6, 0], [0.58, 0.14], [0.55, 0.32], [0.62, 0.52], [0.7, 0.7], [0.75, 0.82], [0.66, 0.93], [0.36, 1], [1e-3, 1]], 18);
  var headGeo = latheN([[1e-3, -1], [0.36, -0.96], [0.6, -0.8], [0.8, -0.52], [0.92, -0.16], [1, 0.2], [0.96, 0.52], [0.78, 0.82], [0.42, 0.98], [1e-3, 1]], 18);
  function mergeGeos(list) {
    var pos = [], nor = [];
    list.forEach(function(g) {
      g = g.index ? g.toNonIndexed() : g;
      g.computeVertexNormals();
      pos.push.apply(pos, g.attributes.position.array);
      nor.push.apply(nor, g.attributes.normal.array);
    });
    var m = new THREE.BufferGeometry();
    m.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    m.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    return m;
  }
  var hairCap = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, 1.22);
  hairCap.rotateX(0.28);
  var hairBack = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI, 0.7, 1.55);
  var hairGeo = mergeGeos([hairCap, hairBack]);
  var fringeGeo = new THREE.SphereGeometry(1.04, 16, 6, Math.PI * 1.14, Math.PI * 0.72, 0.55, 0.72);
  var longGeo = new THREE.CylinderGeometry(1, 0.8, 1, 14, 1, true, Math.PI * 1.55, Math.PI * 0.9);
  var limbGeo = new THREE.CylinderGeometry(1, 0.86, 1, 10);
  var thighGeo = new THREE.CylinderGeometry(1, 0.86, 1, 10);
  thighGeo.rotateX(Math.PI / 2);
  var handGeo = new THREE.SphereGeometry(1, 10, 8), footGeo = new THREE.SphereGeometry(1, 10, 8);
  inst("torso", torsoGeo, phong(16777215), MAXN);
  inst("arm", limbGeo, phong(16777215), MAXN * 2);
  inst("fore", limbGeo, phong(16777215), MAXN * 2);
  inst("hand", handGeo, phong(16777215), MAXN * 2);
  inst("head", headGeo, phong(16777215, 6), MAXN);
  var faceDot = new THREE.SphereGeometry(1, 8, 6);
  inst("eye", faceDot, phong(1511695, 40), MAXN * 2);
  inst("nose", faceDot, phong(13208696, 4), MAXN);
  var smileGeo = new THREE.TorusGeometry(1, 0.3, 5, 12, Math.PI);
  smileGeo.rotateZ(Math.PI);
  inst("mouth", smileGeo, phong(9321284, 10), MAXN);
  inst("hair", hairGeo, new THREE.MeshPhongMaterial({ color: 16777215, shininess: 26, specular: 2236962, side: THREE.DoubleSide }), MAXN);
  inst("fringe", fringeGeo, new THREE.MeshPhongMaterial({ color: 16777215, shininess: 26, specular: 2236962, side: THREE.DoubleSide }), MAXN);
  inst("long", longGeo, new THREE.MeshPhongMaterial({ color: 16777215, shininess: 22, side: THREE.DoubleSide }), MAXN);
  inst("skin", cyl8, phong(16777215), MAXN);
  inst("thigh", thighGeo, phong(16777215), MAXN * 2);
  inst("shin", limbGeo, phong(16777215), MAXN * 2);
  inst("foot", footGeo, phong(1579036, 14), MAXN * 2);
  var stickMat = new THREE.MeshBasicMaterial({ color: 13421772, fog: false, toneMapped: false });
  inst("stick", cyl8, stickMat, MAXN * 3);
  var rstickMat;
  var RAINBOW = ["#ff4040", "#ff9a2e", "#fff23a", "#4dff6a", "#3ab8ff", "#b26bff"];
  (function() {
    var pos = [], col = [], c = new THREE.Color(), n = RAINBOW.length;
    RAINBOW.forEach(function(hex2, k) {
      var g = new THREE.CylinderGeometry(1, 1, 1 / n, 8, 1).toNonIndexed();
      g.translate(0, -0.5 + (k + 0.5) / n, 0);
      var p = g.attributes.position;
      c.set(hex2);
      for (var v = 0; v < p.count; v++) {
        pos.push(p.getX(v), p.getY(v), p.getZ(v));
        col.push(c.r, c.g, c.b);
      }
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    rstickMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 13421772, fog: false, toneMapped: false });
    inst("rstick", geo, rstickMat, MAXN);
  })();
  var SHIRTS = [2830138, 3811882, 4210746, 1977139, 4862784, 5591114, 1842206, 3359795, 5909818, 6974064];
  var PANTS = [1381916, 1909296, 2499103, 1052690];
  var SKINS = [14263164, 14856332, 13211247, 15252377];
  var HAIRS = [657416, 1182986, 1708560, 789520, 3810328, 5913126, 8017462, 2759214];
  function pickC(arr, r) {
    return arr[Math.floor(r * arr.length) % arr.length];
  }
  function colorAudience() {
    var c = new THREE.Color();
    seats.forEach(function(s, i) {
      var q = S.seed * 53 + i * 17;
      c.setHex(pickC(SHIRTS, rnd(q + 1)));
      IM.torso.setColorAt(i, c);
      IM.arm.setColorAt(i * 2, c);
      IM.arm.setColorAt(i * 2 + 1, c);
      c.setHex(pickC(SKINS, rnd(q + 2)));
      IM.head.setColorAt(i, c);
      IM.skin.setColorAt(i, c);
      IM.hand.setColorAt(i * 2, c);
      IM.hand.setColorAt(i * 2 + 1, c);
      var shortSleeve = rnd(q + 6) < 0.6;
      if (!shortSleeve) c.setHex(pickC(SHIRTS, rnd(q + 1)));
      IM.fore.setColorAt(i * 2, c);
      IM.fore.setColorAt(i * 2 + 1, c);
      c.setHex(pickC(HAIRS, rnd(q + 3)));
      IM.hair.setColorAt(i, c);
      IM.fringe.setColorAt(i, c);
      IM.long.setColorAt(i, c);
      s.look = {
        shirt: pickC(SHIRTS, rnd(q + 1)),
        skin: pickC(SKINS, rnd(q + 2)),
        hair: pickC(HAIRS, rnd(q + 3)),
        long: rnd(S.seed * 59 + i * 11 + 7) < 0.3,
        pony: rnd(q + 10) < 0.35,
        glasses: rnd(q + 8) < 0.25,
        mask: rnd(q + 9) < 0.15,
        cap: rnd(q + 11) < 0.1,
        capColor: pickC([2830138, 9051950, 15790320, 1985418], rnd(q + 12))
      };
      if (s.look.long) s.look.cap = false;
      c.setHex(pickC(PANTS, rnd(q + 4)));
      IM.thigh.setColorAt(i * 2, c);
      IM.thigh.setColorAt(i * 2 + 1, c);
      IM.shin.setColorAt(i * 2, c);
      IM.shin.setColorAt(i * 2 + 1, c);
    });
    c.setHex(16777215);
    for (var k = 0; k < MAXN * 3; k++) IM.stick.setColorAt(k, c);
    Object.keys(IM).forEach(function(k2) {
      if (IM[k2].instanceColor) IM[k2].instanceColor.needsUpdate = true;
    });
  }
  function assignFans() {
    var team = TEAMS[S.team], n = team.members.length, pool = [], i, j, t;
    seats.forEach(function(s) {
      s.light = false;
      s.fan = false;
      s.towel = false;
      s.fanBlue = false;
      s.oshi = -1;
      s.cols = [];
      if (!seatOcc(s)) return;
      s.light = S.allProps || rnd(S.seed * 71 + s.i * 7 + 11) * 100 < S.lightPct;
      s.fan = rnd(S.seed * 83 + s.i * 5 + 13) * 100 < S.fanPct;
      if (s.light || s.fan) pool.push(s);
    });
    for (i = pool.length - 1; i > 0; i--) {
      j = Math.floor(rnd(S.seed * 97 + i * 3) * (i + 1));
      t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    var order = team.members.map(function(m, k) {
      return k;
    });
    for (i = n - 1; i > 0; i--) {
      j = Math.floor(rnd(S.seed * 101 + i * 5) * (i + 1));
      t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    pool.forEach(function(s, k) {
      s.oshi = order[k % n];
      var c = team.members[s.oshi].c.slice();
      s.cols = c;
      s.fanVar = Math.floor(rnd(S.seed * 113 + s.i * 7 + 5) * FAN_VARIANTS);
      s.fanBlue = rnd(S.seed * 151 + s.i * 11 + 3) < 0.25;
    });
    var inGame = typeof G2 !== "undefined" && G2 && G2.extra, myK = inGame ? G2.member : -1;
    var cand = seats.filter(function(s) {
      return seatOcc(s) && !s.fan;
    });
    for (i = cand.length - 1; i > 0; i--) {
      j = Math.floor(rnd(S.seed * 167 + i * 7) * (i + 1));
      t = cand[i];
      cand[i] = cand[j];
      cand[j] = t;
    }
    var others = order.filter(function(k) {
      return k !== myK;
    });
    cand.slice(0, 6).forEach(function(s, q) {
      s.towel = true;
      s.light = false;
      s.cols = [];
      s.oshi = inGame && q < 2 ? myK : others[(q + Math.floor(rnd(S.seed * 173) * others.length)) % others.length];
    });
    if (inGame) {
      var extra = cand.slice(6).filter(function(s) {
        return s.oshi !== myK;
      });
      extra.sort(function(a, b) {
        return (a.oshi >= 0) - (b.oshi >= 0);
      });
      extra.slice(0, 2).forEach(function(s) {
        s.fan = true;
        s.oshi = myK;
        var c = team.members[myK].c.slice();
        s.cols = s.light ? c : [];
        s.fanVar = Math.floor(rnd(S.seed * 179 + s.i * 3) * FAN_VARIANTS);
        s.fanBlue = rnd(S.seed * 181 + s.i * 5) < 0.25;
      });
    }
    if (typeof G2 !== "undefined" && G2 && G2.conv) Object.keys(G2.conv).forEach(function(key) {
      var s = seats[+key];
      if (!s || !seatOcc(s)) return;
      s.oshi = G2.conv[key];
      s.fan = true;
      s.towel = false;
      if (G2.rb && G2.rb.i === s.i) s.light = true;
      var c = team.members[s.oshi].c.slice();
      s.cols = s.light ? c : [];
      s.fanVar = Math.floor(rnd(S.seed * 131 + s.i * 3 + 9) * FAN_VARIANTS);
    });
    if (typeof G2 !== "undefined" && G2 && G2.swapI >= 0) {
      var sw = seats[G2.swapI];
      if (sw && seatOcc(sw)) {
        sw.oshi = G2.member;
        sw.cols = sw.light ? team.members[G2.member].c.slice() : [];
        sw.fanBlue = false;
      }
    }
  }
  var fanTex = {};
  window.__propRefresh = function() {
    var any = false;
    Object.keys(fanTex).forEach(function(key) {
      if (fanTex[key].pending) {
        disposeFanTex(key);
        any = true;
      }
    });
    if (any && typeof seats !== "undefined" && seats.length) updateAudience();
  };
  function luminance(hex2) {
    var c = new THREE.Color(hex2);
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  }
  var FAN_VARIANTS = 72;
  var PHRASES = ["♥ 看我 ♥", "指我", "飛吻", "比愛心", "眨眼", "揮揮手", "最喜歡", "看這裡！"];
  var FCX = 128, FCY = 140, FR = 100;
  function rainbowFill(x) {
    var g = x.createLinearGradient(FCX - FR, FCY - FR, FCX + FR, FCY + FR);
    RAINBOW.forEach(function(cc, q) {
      g.addColorStop(q / 6, cc);
      g.addColorStop((q + 1) / 6 - 1e-3, cc);
    });
    return g;
  }
  function heartPath(x, cx, cy, s) {
    x.beginPath();
    x.moveTo(cx, cy + s * 0.9);
    x.bezierCurveTo(cx - s * 1.3, cy + s * 0.1, cx - s * 0.9, cy - s * 0.9, cx, cy - s * 0.35);
    x.bezierCurveTo(cx + s * 0.9, cy - s * 0.9, cx + s * 1.3, cy + s * 0.1, cx, cy + s * 0.9);
  }
  function starPath(x, cx, cy, r) {
    x.beginPath();
    for (var k = 0; k < 10; k++) {
      var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath();
  }
  function fanShape(x, d, fill, edgeCol) {
    if (d.ears) {
      x.fillStyle = edgeCol;
      [-1, 1].forEach(function(s) {
        x.beginPath();
        x.moveTo(FCX + s * 34, FCY - 86);
        x.lineTo(FCX + s * 84, FCY - 128);
        x.lineTo(FCX + s * 92, FCY - 50);
        x.closePath();
        x.fill();
      });
      x.fillStyle = "rgba(255,170,200,.9)";
      [-1, 1].forEach(function(s) {
        x.beginPath();
        x.moveTo(FCX + s * 48, FCY - 84);
        x.lineTo(FCX + s * 80, FCY - 112);
        x.lineTo(FCX + s * 84, FCY - 62);
        x.closePath();
        x.fill();
      });
    }
    if (d.border === 1) {
      x.fillStyle = "#ffffff";
      for (var k = 0; k < 28; k++) {
        var a = k / 28 * Math.PI * 2;
        x.beginPath();
        x.arc(FCX + Math.cos(a) * (FR + 2), FCY + Math.sin(a) * (FR + 2), 10, 0, Math.PI * 2);
        x.fill();
      }
      x.fillStyle = "rgba(0,0,0,.14)";
      for (k = 0; k < 28; k++) {
        a = (k + 0.5) / 28 * Math.PI * 2;
        x.beginPath();
        x.arc(FCX + Math.cos(a) * (FR + 4), FCY + Math.sin(a) * (FR + 4), 2.2, 0, Math.PI * 2);
        x.fill();
      }
    }
    x.fillStyle = fill;
    x.beginPath();
    x.arc(FCX, FCY, FR, 0, Math.PI * 2);
    x.fill();
  }
  function fanDesign(v) {
    return {
      bg: v % 4,
      border: Math.floor(v / 4) % 3,
      deco: Math.floor(v / 12) % 6,
      phrase: PHRASES[(v * 5 + Math.floor(v / 9)) % PHRASES.length],
      ears: Math.floor(v / 12) % 6 === 2
    };
  }
  function blueBase(x, w, h, img, fallback) {
    if (img.complete && img.naturalWidth) {
      x.drawImage(img, 0, 0, w, h);
      return false;
    }
    x.fillStyle = fallback;
    x.fillRect(0, 0, w, h);
    return true;
  }
  function propEntry(key, cv, bv, extra) {
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    var btex = new THREE.CanvasTexture(bv);
    btex.encoding = THREE.sRGBEncoding;
    fanTex[key] = {
      canvas: cv,
      pending: !!extra,
      front: new THREE.MeshLambertMaterial({ map: tex, emissive: 16777215, emissiveMap: tex, emissiveIntensity: 0.16, alphaTest: 0.5, side: THREE.FrontSide }),
      back: new THREE.MeshLambertMaterial({ map: btex, emissive: 16777215, emissiveMap: btex, emissiveIntensity: 0.25, alphaTest: 0.5 })
    };
    return fanTex[key];
  }
  function blueFanMaterials(team, k) {
    var key = team.id + k + "_B";
    if (fanTex[key]) return fanTex[key];
    var m = team.members[k];
    var cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    var x = cv.getContext("2d");
    var pend = !(uchiwaImg.complete && uchiwaImg.naturalWidth);
    if (pend) {
      x.fillStyle = "#28408c";
      x.beginPath();
      x.arc(FCX, FCY, FR, 0, Math.PI * 2);
      x.fill();
    } else x.drawImage(uchiwaImg, 0, 0, 256, 256);
    drawNick(x, m.n, FCX, 142, 150, 66, "#ffffff", "#16245c", 7);
    var bv = document.createElement("canvas");
    bv.width = bv.height = 256;
    var y = bv.getContext("2d");
    if (pend) {
      y.fillStyle = "#28408c";
      y.beginPath();
      y.arc(FCX, FCY, FR, 0, Math.PI * 2);
      y.fill();
    } else y.drawImage(uchiwaImg, 0, 0, 256, 256);
    return propEntry(key, cv, bv, pend);
  }
  function towelMaterials(team, k) {
    var key = team.id + k + "_T";
    if (fanTex[key]) return fanTex[key];
    var m = team.members[k];
    var cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 202;
    var x = cv.getContext("2d");
    var pend = blueBase(x, 512, 202, towelImg, "#28408c");
    drawNick(x, m.n, 256, 104, 300, 104, "#ffffff", "#16245c", 10);
    var bv = document.createElement("canvas");
    bv.width = 512;
    bv.height = 202;
    var y = bv.getContext("2d");
    y.save();
    y.translate(512, 0);
    y.scale(-1, 1);
    blueBase(y, 512, 202, towelImg, "#28408c");
    y.restore();
    y.fillStyle = "rgba(20,30,70,.35)";
    y.fillRect(0, 0, 512, 202);
    return propEntry(key, cv, bv, pend);
  }
  function disposeFanTex(key) {
    var e = fanTex[key];
    if (!e) return;
    e.front.map.dispose();
    e.back.map.dispose();
    e.front.dispose();
    e.back.dispose();
    delete fanTex[key];
  }
  function fanMaterials(team, k, v) {
    if (v === "B") return blueFanMaterials(team, k);
    v = v || 0;
    var key = team.id + k + "_" + v;
    if (fanTex[key]) return fanTex[key];
    var m = team.members[k], d = fanDesign(v), rb = m.c[0] === "rainbow";
    var c0 = rb ? m.c[1] : m.c[0], c1 = m.c[1] && m.c[1] !== "rainbow" ? m.c[1] : "#ffffff";
    if (luminance(c0) > 0.9 && luminance(c1) > 0.9) c1 = "#c9c2d0";
    var cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    var x = cv.getContext("2d");
    var fill, txt, edge;
    if (d.bg === 0) {
      fill = rb ? rainbowFill(x) : c0;
    } else if (d.bg === 1) {
      fill = "#ffffff";
    } else if (d.bg === 2) {
      fill = x.createRadialGradient(FCX, FCY - 30, 10, FCX, FCY, FR);
      fill.addColorStop(0, "#ffffff");
      fill.addColorStop(1, rb ? "#ff9ad0" : c0);
    } else {
      fill = "#141018";
    }
    fanShape(x, d, fill, d.bg === 3 ? rb ? "#ff9ad0" : c0 : c1);
    if (d.bg === 0) {
      var lum = rb ? 0.7 : luminance(c0);
      txt = lum > 0.55 ? "#1a1020" : "#ffffff";
      edge = lum > 0.55 ? "#ffffff" : "#1a1020";
    } else if (d.bg === 1) {
      txt = luminance(c0) < 0.72 ? c0 : "#1a1020";
      edge = luminance(c0) < 0.72 ? "#ffffff" : c1;
      if (rb) {
        txt = "#ff4f93";
        edge = "#ffffff";
      }
    } else if (d.bg === 2) {
      txt = "#1a1020";
      edge = "#ffffff";
    } else {
      txt = rb ? "#fff36b" : c0;
      edge = "#ffffff";
      if (luminance(txt) < 0.25) {
        txt = "#ffffff";
        edge = c0;
      }
    }
    if (d.border === 0) {
      x.lineWidth = 12;
      x.strokeStyle = d.bg === 0 ? c1 : rb ? "#ff9ad0" : c0;
      x.beginPath();
      x.arc(FCX, FCY, FR - 6, 0, Math.PI * 2);
      x.stroke();
    } else if (d.border === 2) {
      x.lineWidth = 5;
      x.strokeStyle = d.bg === 3 ? "#ffffff" : c1;
      x.beginPath();
      x.arc(FCX, FCY, FR - 5, 0, Math.PI * 2);
      x.stroke();
      x.fillStyle = d.bg === 3 ? rb ? "#fff36b" : c0 : "#ffffff";
      for (var q = 0; q < 24; q++) {
        var a = q / 24 * Math.PI * 2;
        x.beginPath();
        x.arc(FCX + Math.cos(a) * (FR - 15), FCY + Math.sin(a) * (FR - 15), 3.4, 0, Math.PI * 2);
        x.fill();
      }
    }
    var nickY = FCY - 10, nickSize = 110, nickW = 168, phraseY = FCY + 70;
    if (d.deco === 1) {
      x.fillStyle = d.bg === 0 ? "#ffffff" : "#ff5c9a";
      [[FCX - 70, FCY - 52, 13], [FCX + 72, FCY - 46, 10], [FCX - 64, FCY + 52, 9], [FCX + 66, FCY + 56, 12]].forEach(function(h) {
        heartPath(x, h[0], h[1], h[2]);
        x.fill();
      });
    } else if (d.deco === 4) {
      x.fillStyle = d.bg === 3 ? "#fff36b" : "#ffe36b";
      [[FCX - 72, FCY - 40, 12], [FCX + 70, FCY - 54, 9], [FCX + 74, FCY + 40, 11], [FCX - 70, FCY + 58, 8]].forEach(function(h) {
        starPath(x, h[0], h[1], h[2]);
        x.fill();
      });
    } else if (d.deco === 5) {
      x.fillStyle = d.bg === 0 ? c1 : rb ? "#ff9ad0" : c0;
      [-1, 1].forEach(function(s) {
        x.beginPath();
        x.moveTo(FCX, FCY - FR + 4);
        x.lineTo(FCX + s * 40, FCY - FR - 22);
        x.lineTo(FCX + s * 44, FCY - FR + 24);
        x.closePath();
        x.fill();
      });
      x.beginPath();
      x.arc(FCX, FCY - FR + 4, 10, 0, Math.PI * 2);
      x.fill();
      nickY = FCY - 2;
    } else if (d.deco === 3) {
      var px = FCX, py = FCY - 46;
      x.fillStyle = "#3a2418";
      x.beginPath();
      x.arc(px, py - 2, 30, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#ffe0cc";
      x.beginPath();
      x.ellipse(px, py + 6, 22, 21, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#3a2418";
      x.beginPath();
      x.ellipse(px, py - 12, 24, 12, 0, Math.PI, 0);
      x.fill();
      x.fillStyle = "#2a1410";
      x.beginPath();
      x.ellipse(px - 8, py + 6, 3.2, 4.5, 0, 0, Math.PI * 2);
      x.ellipse(px + 8, py + 6, 3.2, 4.5, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "rgba(255,120,150,.6)";
      x.beginPath();
      x.ellipse(px - 14, py + 14, 4, 2.4, 0, 0, Math.PI * 2);
      x.ellipse(px + 14, py + 14, 4, 2.4, 0, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = "#c0405a";
      x.lineWidth = 2;
      x.beginPath();
      x.arc(px, py + 13, 4, 0.2, Math.PI - 0.2);
      x.stroke();
      x.fillStyle = rb ? "#ff9ad0" : luminance(c0) > 0.9 ? c1 : c0;
      [-1, 1].forEach(function(s) {
        x.beginPath();
        x.moveTo(px + 20, py - 22);
        x.lineTo(px + 20 + s * 13, py - 32);
        x.lineTo(px + 20 + s * 13, py - 12);
        x.closePath();
        x.fill();
      });
      nickY = FCY + 22;
      nickSize = 70;
      nickW = 170;
      phraseY = FCY + 74;
    }
    drawNick(x, m.nick, FCX, nickY, nickW, nickSize, txt, edge, 9);
    x.font = "800 24px " + FONT_STACK;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.lineWidth = 5;
    x.strokeStyle = edge;
    x.strokeText(d.phrase, FCX, phraseY);
    x.fillStyle = txt;
    x.fillText(d.phrase, FCX, phraseY);
    var bv = document.createElement("canvas");
    bv.width = bv.height = 256;
    var y = bv.getContext("2d");
    fanShape(y, { ears: d.ears, border: d.border }, rb ? rainbowFill(y) : c0, c1);
    y.fillStyle = "rgba(255,255,255,.55)";
    heartPath(y, FCX, FCY, 26);
    y.fill();
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    var btex = new THREE.CanvasTexture(bv);
    btex.encoding = THREE.sRGBEncoding;
    fanTex[key] = {
      canvas: cv,
      front: new THREE.MeshLambertMaterial({ map: tex, emissive: 16777215, emissiveMap: tex, emissiveIntensity: 0.16, alphaTest: 0.5 }),
      back: new THREE.MeshLambertMaterial({ map: btex, emissive: 16777215, emissiveMap: btex, emissiveIntensity: 0.25, alphaTest: 0.5 })
    };
    return fanTex[key];
  }
  function pruneFanTex(team) {
    var used = {};
    seats.forEach(function(s) {
      if (s.fan && s.oshi >= 0) used[team.id + s.oshi + "_" + (s.fanBlue ? "B" : s.fanVar || 0)] = true;
      if (s.towel && s.oshi >= 0) used[team.id + s.oshi + "_T"] = true;
    });
    Object.keys(fanTex).forEach(function(key) {
      if (!used[key]) disposeFanTex(key);
    });
  }
  function drawNick(x, text, cx, cy, maxW, size, fill, edge, lw) {
    x.font = "900 " + size + "px " + FONT_STACK;
    x.textAlign = "center";
    x.textBaseline = "alphabetic";
    var mt = x.measureText(text), w = mt.width || size;
    if (w < maxW * 0.8) {
      size = Math.floor(Math.min(size * 1.3, size * maxW * 0.85 / w));
      x.font = "900 " + size + "px " + FONT_STACK;
      mt = x.measureText(text);
      w = mt.width || size;
    }
    var sx = Math.min(1, maxW / w);
    if (sx < 0.62) {
      size = Math.floor(size * sx / 0.62);
      sx = 0.62;
      x.font = "900 " + size + "px " + FONT_STACK;
      mt = x.measureText(text);
    }
    var asc = mt.actualBoundingBoxAscent || size * 0.72, desc = mt.actualBoundingBoxDescent || 0;
    x.save();
    x.translate(cx, cy + (asc - desc) / 2);
    x.scale(sx, 1);
    x.lineJoin = "round";
    x.lineWidth = lw / sx;
    x.strokeStyle = edge;
    x.strokeText(text, 0, 0);
    x.fillStyle = fill;
    x.fillText(text, 0, 0);
    x.restore();
  }
  function fitFont(x, text, maxW, maxH) {
    x.font = "900 100px " + FONT_STACK;
    var w = x.measureText(text).width || 100;
    return Math.max(10, Math.floor(Math.min(maxH, 100 * maxW / w)));
  }
  var FONT_STACK = '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", "Hiragino Sans", "Yu Gothic", sans-serif';
  var fanDisk = new THREE.PlaneGeometry(0.32, 0.32), fanHandle = new THREE.CylinderGeometry(9e-3, 9e-3, 0.16, 6);
  var handleMat = phong(15658734, 10), uchiwa = [];
  function getUchiwa(i) {
    if (uchiwa[i]) return uchiwa[i];
    var g = new THREE.Group();
    g.matrixAutoUpdate = false;
    var h = new THREE.Mesh(fanHandle, handleMat);
    h.position.y = 0.08;
    g.add(h);
    var f = new THREE.Mesh(fanDisk);
    f.position.set(0, 0.285, -3e-3);
    f.rotation.y = Math.PI;
    g.add(f);
    var b = new THREE.Mesh(fanDisk);
    b.position.set(0, 0.285, 3e-3);
    g.add(b);
    g.userData.front = f;
    g.userData.back = b;
    scene.add(g);
    uchiwa[i] = g;
    return g;
  }
  var towelGeo = new THREE.PlaneGeometry(0.58, 0.23), towels = [], towelG = [], arms = [];
  var armV = new THREE.Vector3(), armE = new THREE.Euler(), cornerV = new THREE.Vector3();
  function getTowel(i) {
    if (towelG[i]) return towelG[i];
    var g = new THREE.Group();
    g.matrixAutoUpdate = false;
    var f = new THREE.Mesh(towelGeo);
    f.rotation.y = Math.PI;
    f.position.z = -3e-3;
    g.add(f);
    var b = new THREE.Mesh(towelGeo);
    b.position.z = 3e-3;
    g.add(b);
    g.userData.front = f;
    g.userData.back = b;
    scene.add(g);
    towelG[i] = g;
    return g;
  }
  var mSeat = new THREE.Matrix4(), mLoc = new THREE.Matrix4(), mOut = new THREE.Matrix4(), mBody = new THREE.Matrix4(), mNeck = new THREE.Matrix4(), mBase = new THREE.Matrix4();
  var ZAX = new THREE.Vector3(0, 0, 1), qSeg = new THREE.Quaternion(), sgA = new THREE.Vector3(), sgB = new THREE.Vector3(), sgD = new THREE.Vector3(), sgM = new THREE.Vector3(), sgS = new THREE.Vector3();
  function segPut(im, idx, a, b, r, axis) {
    sgD.copy(b).sub(a);
    var len = sgD.length() || 1e-4;
    sgD.multiplyScalar(1 / len);
    qSeg.setFromUnitVectors(axis, sgD);
    sgM.copy(a).add(b).multiplyScalar(0.5);
    if (axis === ZAX) sgS.set(r, r, len);
    else sgS.set(r, len, r);
    mLoc.compose(sgM, qSeg, sgS);
    mOut.multiplyMatrices(mBase, mLoc);
    im.setMatrixAt(idx, mOut);
  }
  function lerp3(a, b, f) {
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  var qTmp = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1), YAX = new THREE.Vector3(0, 1, 0);
  function putLean(im, idx, show, lx, ly, lz, sx, sy, sz, lean) {
    if (!show) {
      mLoc.makeScale(0, 0, 0);
      im.setMatrixAt(idx, mLoc);
      return;
    }
    mB.makeRotationX(-lean);
    mLoc.makeScale(sx, sy, sz);
    mLoc.premultiply(mB).setPosition(lx, ly, lz);
    mOut.multiplyMatrices(mSeat, mLoc);
    im.setMatrixAt(idx, mOut);
  }
  function put(im, idx, show, lx, ly, lz, sx, sy, sz) {
    if (!show) {
      mLoc.makeScale(0, 0, 0);
      im.setMatrixAt(idx, mLoc);
      return;
    }
    mLoc.makeScale(sx, sy, sz).setPosition(lx, ly, lz);
    mOut.multiplyMatrices(mSeat, mLoc);
    im.setMatrixAt(idx, mOut);
  }
  var sticks = [], fans = [], vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3();
  var eul = new THREE.Euler(), mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), tmpCol = new THREE.Color();
  var hslTmp = { h: 0, s: 0, l: 0 };
  function vivid(col, hex2) {
    col.set(hex2);
    col.getHSL(hslTmp);
    if (hslTmp.s < 0.06) return col;
    var s = Math.min(1, hslTmp.s * 1.3 + 0.2), l = hslTmp.l > 0.6 ? 0.6 + (hslTmp.l - 0.6) * 0.35 : hslTmp.l;
    return col.setHSL(hslTmp.h, s, l);
  }
  var QUP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  function forearm(idx, k, ex, ey, ez, hx, hy, hz) {
    vA.set(ex, ey, ez);
    vB.set(hx, hy, hz);
    vC.copy(vB).sub(vA);
    var fl = vC.length();
    qTmp.setFromUnitVectors(YAX, vC.normalize());
    vC.copy(vA).add(vB).multiplyScalar(0.5);
    vD.set(0.036 * k, fl, 0.036 * k);
    mLoc.compose(vC, qTmp, vD);
    mOut.multiplyMatrices(mSeat, mLoc);
    IM.fore.setMatrixAt(idx, mOut);
    put(IM.hand, idx, true, hx, hy, hz, 0.042 * k, 0.052 * k, 0.03 * k);
  }
  function buildSeat(i, n, team) {
    if (i >= n) {
      mLoc.makeScale(0, 0, 0);
      ["pad", "back", "torso", "head", "hair", "fringe", "long", "skin", "rstick", "nose", "mouth"].forEach(function(k2) {
        IM[k2].setMatrixAt(i, mLoc);
      });
      IM.eye.setMatrixAt(i * 2, mLoc);
      IM.eye.setMatrixAt(i * 2 + 1, mLoc);
      ["arm", "fore", "hand", "thigh", "shin", "foot"].forEach(function(k2) {
        IM[k2].setMatrixAt(i * 2, mLoc);
        IM[k2].setMatrixAt(i * 2 + 1, mLoc);
      });
      for (var q3 = 0; q3 < 3; q3++) IM.stick.setMatrixAt(i * 3 + q3, mLoc);
      return;
    }
    var s = seats[i], cw = 0.42;
    qTmp.setFromAxisAngle(YAX, s.rot);
    mSeat.compose(s.pos, qTmp, ONE);
    if (!s.m) s.m = new THREE.Matrix4();
    s.m.copy(mSeat);
    put(IM.pad, i, true, 0, SEAT_H - 0.03, 0, cw, 0.06, 0.42);
    put(IM.back, i, true, 0, SEAT_H + 0.22, 0.225, cw, 0.4, 0.04);
    var faceDx = -s.pos.x, faceDz = STAGE_Z0 - 1.25 - s.pos.z, faceD = Math.atan2(-faceDx, -faceDz) - s.rot;
    while (faceD > Math.PI) faceD -= 2 * Math.PI;
    while (faceD < -Math.PI) faceD += 2 * Math.PI;
    faceD = Math.max(-0.75, Math.min(0.75, faceD));
    var bodyYaw = faceD * 0.35, headYaw = faceD - bodyYaw;
    qTmp.setFromAxisAngle(YAX, s.rot + bodyYaw);
    mSeat.compose(s.pos, qTmp, ONE);
    s.m.copy(mSeat);
    var occ = seatOcc(s), H = seatHeight(s) / 100, k = H / 1.7;
    var pz = s.pose || null, sf = pz ? pz.stand || 0 : 0, bw = pz ? pz.bow || 0 : 0, standing = sf > 0, LIFT = 0.2 * k * sf;
    mBase.copy(mSeat);
    if (standing) {
      mNeck.makeTranslation(0, LIFT, -0.2 * sf);
      mSeat.multiply(mNeck);
      s.m.copy(mSeat);
    }
    var top = SEAT_H + 0.53 * H, sh = top - 0.28 * k;
    s.headLocal = top - 0.115 * k;
    var lean = (0.14 + 0.12 * rnd(S.seed * 71 + i * 17 + 2)) * (1 - sf) + 0.32 * sf + 0.4 * bw, tH = sh - SEAT_H;
    var dzS = -Math.sin(lean) * tH, dyS = -(1 - Math.cos(lean)) * tH, dzH = dzS - 0.025 * k, dyH = dyS - 0.012 * k;
    var hc = top - 0.115 * k + dyH, hz = 0.03 + dzH, longHair = rnd(S.seed * 59 + i * 11 + 7) < 0.3;
    s.headLocal = hc;
    s.headZ = hz + 0.01;
    putLean(IM.torso, i, occ, 0, SEAT_H, 0.05, 0.28 * k, sh + 0.05 * k - SEAT_H, 0.17 * k, lean);
    if (typeof G2 !== "undefined" && G2 && G2.shirtI === i) {
      var tsy = sh + 0.05 * k - SEAT_H, tsz = 0.17 * k;
      s.shirtM = (s.shirtM || new THREE.Matrix4()).copy(mSeat);
      mNeck.makeRotationX(-lean).setPosition(0, SEAT_H, 0.05);
      s.shirtM.multiply(mNeck);
      mNeck.makeTranslation(0, 0.6 * tsy, -0.68 * tsz - 8e-3);
      s.shirtM.multiply(mNeck);
      mNeck.makeRotationY(Math.PI);
      s.shirtM.multiply(mNeck);
      s.shirtK = k;
    }
    mBody.copy(mSeat);
    mNeck.makeTranslation(0, hc, hz);
    mSeat.multiply(mNeck);
    mNeck.makeRotationY(headYaw);
    mSeat.multiply(mNeck);
    if (bw) {
      mNeck.makeRotationX(-0.6 * bw);
      mSeat.multiply(mNeck);
    }
    mNeck.makeTranslation(0, -hc, -hz);
    mSeat.multiply(mNeck);
    put(IM.head, i, occ, 0, hc, hz, 0.076 * k, 0.115 * k, 0.092 * k);
    if (typeof G2 !== "undefined" && G2 && G2.glassI === i) {
      s.headM = (s.headM || new THREE.Matrix4()).copy(mSeat);
      s.gk = k;
      s.ghc = hc;
      s.ghz = hz;
    }
    put(IM.eye, i * 2, occ, -0.027 * k, hc + 8e-3 * k, hz - 0.081 * k, 85e-4 * k, 0.012 * k, 6e-3 * k);
    put(IM.eye, i * 2 + 1, occ, 0.027 * k, hc + 8e-3 * k, hz - 0.081 * k, 85e-4 * k, 0.012 * k, 6e-3 * k);
    put(IM.nose, i, occ, 0, hc - 0.022 * k, hz - 0.093 * k, 7e-3 * k, 0.011 * k, 8e-3 * k);
    put(IM.mouth, i, occ, 0, hc - 0.044 * k, hz - 0.084 * k, 0.019 * k, 0.013 * k, 5e-3 * k);
    put(IM.hair, i, occ, 0, hc + 6e-3 * k, hz + 2e-3, 0.087 * k, 0.128 * k, 0.105 * k);
    put(IM.fringe, i, occ && rnd(S.seed * 61 + i * 13 + 3) < 0.7, 0, hc + 6e-3 * k, hz + 2e-3, 0.087 * k, 0.128 * k, 0.105 * k);
    put(IM.long, i, occ && longHair, 0, hc - 0.12 * k, hz + 0.04, 0.092 * k, 0.22 * k, 0.07 * k);
    mSeat.copy(mBody);
    put(IM.skin, i, occ, 0, sh + 0.05 * k + dyS, 0.04 + dzS * 1.05, 0.05 * k, 0.12 * k, 0.05 * k);
    put(IM.arm, i * 2, occ, -0.2 * k, sh - 0.15 * k + dyS, 0.06 + dzS, 0.044 * k, 0.3 * k, 0.044 * k);
    put(IM.arm, i * 2 + 1, occ, 0.2 * k, sh - 0.15 * k + dyS, 0.06 + dzS, 0.044 * k, 0.3 * k, 0.044 * k);
    put(IM.hand, i * 2, false);
    put(IM.hand, i * 2 + 1, false);
    put(IM.stick, i * 3, false);
    put(IM.stick, i * 3 + 1, false);
    put(IM.stick, i * 3 + 2, false);
    put(IM.rstick, i, false);
    var showProps = occ && S.props, hasL = showProps && s.light, hasF = showProps && s.fan, hasT = showProps && s.towel;
    var cols = hasL ? s.cols : [], two = cols.length > 1;
    var gR = 0.3 + 0.2 * rnd(S.seed * 131 + i * 3 + 1), gF = 0.3 + 0.2 * rnd(S.seed * 137 + i * 5 + 2);
    var jit = (rnd(S.seed * 139 + i * 7 + 3) - 0.5) * 0.05 * k, fanDrop = 0.03 + 0.07 * rnd(S.seed * 149 + i * 11 + 4);
    var svDrop = 0.07, lift = 0.05 * Math.max(0, Math.min(1, s.pos.y / ROW_E[ROW_E.length - 1]));
    var Rh = [0.2 * gR * k + jit + 0.04, sh - 0.03 * k + dyS - svDrop + lift, -0.2 + 0.6 * dzS], Lh = [-0.2 * gR * k + jit - 0.04, sh - 0.03 * k + dyS - svDrop + lift, -0.2 + 0.6 * dzS], Fh = [-0.2 * gF * k + jit * 0.6, sh - 0.12 * k + dyS - fanDrop - svDrop * 12 / 7 + lift, -0.24 + 0.6 * dzS];
    if (showProps && s.fan && s.light) {
      Fh[0] = Math.max(Fh[0], -0.13);
      Rh[0] = Math.max(Rh[0], Fh[0] + 0.24);
    }
    var chestZ = 0.05 - 0.085 * k + dzS * 0.85, faceZ = hz - 0.095 * k;
    Fh[2] = Math.min(chestZ + (Fh[2] - chestZ) * 0.25, faceZ - 0.03);
    if (bw) {
      Rh = lerp3(Rh, [0.1 * k, SEAT_H + 0.2 * k, -0.24 * k], 0.85 * bw);
      Lh = lerp3(Lh, [-0.1 * k, SEAT_H + 0.2 * k, -0.24 * k], 0.85 * bw);
      Fh = lerp3(Fh, [-0.08 * k, SEAT_H + 0.22 * k, -0.26 * k], 0.85 * bw);
    }
    var ph = rnd(S.seed * 31 + i * 3 + 4) * 6.283, raisedR = false, raisedL = false;
    if (hasL) {
      forearm(i * 2 + 1, k, 0.2 * k, sh - 0.3 * k + dyS, 0.06 + dzS, Rh[0], Rh[1], Rh[2]);
      raisedR = true;
      var nc = cols.length, armR = { i, idx: i * 2 + 1, k, e: [0.2 * k, sh - 0.3 * k + dyS, 0.06 + dzS], sh: [0.2 * k, sh + dyS, 0.06 + dzS], side: 1, h: Rh, ph, kind: "pen", hp: Rh.slice(), phi: 0, psi: 0 };
      arms.push(armR);
      if (two) {
        cols.forEach(function(cc, q) {
          sticks.push({ i, slot: q, arm: armR, splay: (q - (nc - 1) / 2) * (nc > 2 ? 0.15 : 0.3), ph, col: cc });
        });
      } else sticks.push({ i, slot: 0, arm: armR, splay: 0, ph, col: cols[0] });
    }
    if (hasF) {
      forearm(i * 2, k, -0.2 * k, sh - 0.3 * k + dyS, 0.06 + dzS, Fh[0], Fh[1], Fh[2]);
      raisedL = true;
      var u = getUchiwa(i), mats = fanMaterials(team, s.oshi, s.fanBlue ? "B" : s.fanVar);
      u.userData.front.material = mats.front;
      u.userData.back.material = mats.back;
      u.visible = true;
      var armF = { i, idx: i * 2, k, e: [-0.2 * k, sh - 0.3 * k + dyS, 0.06 + dzS], sh: [-0.2 * k, sh + dyS, 0.06 + dzS], side: -1, h: Fh, ph: ph + 0.7, kind: "fan", hp: Fh.slice(), phi: 0, psi: 0 };
      arms.push(armF);
      fans.push({ i, arm: armF, ph: ph + 0.7, u });
    }
    if (hasT) {
      var ty = sh - 0.03 * k + 0.05 + dyS + lift, tg = getTowel(i), tm = towelMaterials(team, s.oshi);
      tg.userData.front.material = tm.front;
      tg.userData.back.material = tm.back;
      tg.visible = true;
      forearm(i * 2, k, -0.2 * k, sh - 0.3 * k + dyS, 0.06 + dzS, -0.26, ty + 0.1, -0.27 + 0.6 * dzS);
      raisedL = true;
      forearm(i * 2 + 1, k, 0.2 * k, sh - 0.3 * k + dyS, 0.06 + dzS, 0.26, ty + 0.1, -0.27 + 0.6 * dzS);
      raisedR = true;
      towels.push({ i, y: ty, tz: -0.28 + 0.6 * dzS, ph, g: tg, k, eL: [-0.2 * k, sh - 0.3 * k + dyS, 0.06 + dzS], eR: [0.2 * k, sh - 0.3 * k + dyS, 0.06 + dzS] });
    }
    if (!raisedR) {
      if (occ) forearm(i * 2 + 1, k, 0.2 * k, sh - 0.3 * k + dyS, 0.06 + dzS, 0.12 * k, SEAT_H + 0.15 * k, -0.24 * k);
      else put(IM.fore, i * 2 + 1, false);
    }
    if (!raisedL) {
      if (occ) forearm(i * 2, k, -0.2 * k, sh - 0.3 * k + dyS, 0.06 + dzS, -0.12 * k, SEAT_H + 0.15 * k, -0.24 * k);
      else put(IM.fore, i * 2, false);
    }
    sticks.forEach(function(q) {
      if (q.i !== i || q.col === "rainbow") return;
      vivid(tmpCol, q.col);
      IM.stick.setColorAt(i * 3 + q.slot, tmpCol);
    });
    if (standing && occ) {
      var LF = 0.2 * k;
      [-1, 1].forEach(function(sg, q) {
        var x = sg * (0.09 + 0.03 * sf) * k;
        sgA.set(sg * 0.09 * k, SEAT_H + 0.07 * k + LF * sf, 0.05 * k - 0.2 * sf);
        sgB.set(x, (SEAT_H + 0.07 * k) * (1 - sf) + 0.5 * k * sf, -0.39 * k * (1 - sf) - 0.5 * sf);
        segPut(IM.thigh, i * 2 + q, sgA, sgB, 0.07 * k, ZAX);
        vC.set(x, 0.06, -0.38 * k * (1 - sf) - 0.42 * sf);
        segPut(IM.shin, i * 2 + q, sgB, vC, 0.05 * k, YAX);
        mLoc.makeScale(0.05 * k, 0.04, 0.12 * k).setPosition(x, 0.035, -0.45 * k * (1 - sf) - 0.5 * sf);
        mOut.multiplyMatrices(mBase, mLoc);
        IM.foot.setMatrixAt(i * 2 + q, mOut);
      });
    } else {
      put(IM.thigh, i * 2, occ, -0.09 * k, SEAT_H + 0.07 * k, -0.17 * k, 0.07 * k, 0.07 * k, 0.44 * k);
      put(IM.thigh, i * 2 + 1, occ, 0.09 * k, SEAT_H + 0.07 * k, -0.17 * k, 0.07 * k, 0.07 * k, 0.44 * k);
      put(IM.shin, i * 2, occ, -0.09 * k, 0.24, -0.38 * k, 0.05 * k, 0.46, 0.05 * k);
      put(IM.shin, i * 2 + 1, occ, 0.09 * k, 0.24, -0.38 * k, 0.05 * k, 0.46, 0.05 * k);
      put(IM.foot, i * 2, occ, -0.09 * k, 0.035, -0.45 * k, 0.05 * k, 0.04, 0.12 * k);
      put(IM.foot, i * 2 + 1, occ, 0.09 * k, 0.035, -0.45 * k, 0.05 * k, 0.04, 0.12 * k);
    }
  }
  function rebuildSeat(j) {
    var team = TEAMS[S.team], keep = function(q) {
      return q.i !== j;
    };
    [sticks, fans, towels, arms].forEach(function(arr) {
      var w = arr.filter(keep);
      arr.length = 0;
      Array.prototype.push.apply(arr, w);
    });
    if (uchiwa[j]) uchiwa[j].visible = false;
    if (towelG[j]) towelG[j].visible = false;
    mLoc.makeScale(0, 0, 0);
    for (var q3 = 0; q3 < 3; q3++) IM.stick.setMatrixAt(j * 3 + q3, mLoc);
    buildSeat(j, seats.length, team);
    Object.keys(IM).forEach(function(key) {
      IM[key].instanceMatrix.needsUpdate = true;
    });
    if (IM.stick.instanceColor) IM.stick.instanceColor.needsUpdate = true;
    wavePens(lastT);
  }
  function updateAudience() {
    var n = seats.length, i, team = TEAMS[S.team];
    assignFans();
    sticks.length = 0;
    fans.length = 0;
    towels.length = 0;
    arms.length = 0;
    uchiwa.forEach(function(u) {
      if (u) u.visible = false;
    });
    towelG.forEach(function(u) {
      if (u) u.visible = false;
    });
    for (i = 0; i < MAXN; i++) buildSeat(i, n, team);
    Object.keys(IM).forEach(function(key) {
      IM[key].instanceMatrix.needsUpdate = true;
    });
    if (IM.stick.instanceColor) IM.stick.instanceColor.needsUpdate = true;
    pruneFanTex(team);
    updateZoneLights();
    wavePens(lastT);
    if (typeof onAudienceChanged === "function") onAudienceChanged();
  }
  var glowTex = (function() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,.75)");
    g.addColorStop(0.6, "rgba(255,255,255,.16)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  var GLOW_PER = 3, glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAXN * 3 * GLOW_PER * 3), 3));
  glowGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAXN * 3 * GLOW_PER * 3), 3));
  glowGeo.setDrawRange(0, 0);
  var glowPts = new THREE.Points(glowGeo, new THREE.PointsMaterial({
    size: 0.32,
    map: glowTex,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    fog: false,
    toneMapped: false
  }));
  glowPts.frustumCulled = false;
  glowPts.renderOrder = 4;
  scene.add(glowPts);
  var ZONES = 16, zoneLights = [];
  for (var zi = 0; zi < ZONES; zi++) {
    var zl = new THREE.PointLight(16777215, 0, 1.35, 1.7);
    scene.add(zl);
    zoneLights.push(zl);
  }
  function zoneOf(s) {
    if (s.side) return 12 + (s.pos.x < 0 ? 0 : 2) + (s.pos.z > SIDE_Z1 - 3 ? 0 : 1);
    var c = s.pos.x < -1.6 ? 0 : s.pos.x > 1.6 ? 2 : 1;
    var band = s.st <= 2 ? 0 : s.st <= 5 ? 1 : s.st <= 8 ? 2 : 3;
    return band * 3 + c;
  }
  var zc = new THREE.Color(), zp = new THREE.Vector3();
  function updateZoneLights() {
    var acc = [], z;
    for (z = 0; z < ZONES; z++) acc.push({ r: 0, g: 0, b: 0, n: 0, x: 0, y: 0, zz: 0 });
    sticks.forEach(function(q) {
      var s = seats[q.i], a = acc[zoneOf(s)];
      if (q.col === "rainbow") zc.setRGB(1, 0.85, 0.75);
      else vivid(zc, q.col);
      zp.set(q.arm.h[0], q.arm.h[1] + 0.15, q.arm.h[2]).applyMatrix4(s.m);
      a.r += zc.r;
      a.g += zc.g;
      a.b += zc.b;
      a.n++;
      a.x += zp.x;
      a.y += zp.y;
      a.zz += zp.z;
    });
    zoneLights.forEach(function(l, k) {
      var a = acc[k];
      if (!a.n || !S.props || !S.penGlow) {
        l.intensity = 0;
        return;
      }
      l.color.setRGB(a.r / a.n, a.g / a.n, a.b / a.n);
      l.position.set(a.x / a.n, a.y / a.n + 0.15, a.zz / a.n);
      l.intensity = 2.2 * Math.min(1, 0.45 + a.n / 8);
    });
  }
  var gpos = glowGeo.attributes.position, gcol = glowGeo.attributes.color, gv = new THREE.Vector3();
  var lastT = 0;
  var anyCrazy = false, czS = new THREE.Vector3(), czE = new THREE.Vector3(), czH = new THREE.Vector3(), czU = new THREE.Vector3(), czF = new THREE.Vector3();
  function crazyArm(r, s, b) {
    anyCrazy = true;
    var k = r.k, sd = r.side, w = s.pose ? s.pose.stand || 0 : 0, PI = Math.PI;
    var L1 = 0.29 * k, L2 = 0.27 * k, bc = b * 1.6 + r.ph;
    var th = 0.5 + 0.3 * Math.sin(PI * bc), up = (2.1 + 0.3 * Math.sin(PI * bc * 0.5)) * w;
    czS.set(r.sh[0], r.sh[1], r.sh[2]);
    czU.set(sd * Math.sin(th) * Math.sin(up), -Math.cos(up), -0.35 * Math.sin(up)).normalize();
    czE.copy(czS).addScaledVector(czU, L1);
    var fa = (0.5 + 0.4 * Math.sin(PI * bc * 2 + 0.6)) * w, up2 = up + fa;
    czF.set(sd * Math.sin(th + 0.25 * Math.sin(PI * bc * 2)) * Math.sin(up2), -Math.cos(up2), -0.3 * Math.sin(up2)).normalize();
    czH.copy(czE).addScaledVector(czF, L2);
    var ex = r.e[0] + (czE.x - r.e[0]) * w, ey = r.e[1] + (czE.y - r.e[1]) * w, ez = r.e[2] + (czE.z - r.e[2]) * w;
    var hx = r.hp[0] + (czH.x - r.hp[0]) * w, hy = r.hp[1] + (czH.y - r.hp[1]) * w, hz = r.hp[2] + (czH.z - r.hp[2]) * w;
    r.hp[0] = hx;
    r.hp[1] = hy;
    r.hp[2] = hz;
    vA.set(ex, ey, ez);
    vC.copy(vA).sub(czS);
    var l1 = vC.length() || 1e-4;
    qTmp.setFromUnitVectors(YAX, vC.multiplyScalar(1 / l1));
    vB.copy(czS).add(vA).multiplyScalar(0.5);
    vD.set(0.044 * k, l1, 0.044 * k);
    mLoc.compose(vB, qTmp, vD);
    mOut.multiplyMatrices(mSeat, mLoc);
    IM.arm.setMatrixAt(r.idx, mOut);
    forearm(r.idx, k, ex, ey, ez, hx, hy, hz);
    czF.set(hx - ex, hy - ey, hz - ez).normalize();
    r.ez = -Math.asin(Math.max(-1, Math.min(1, czF.x)));
    r.ex = Math.atan2(czF.z, czF.y);
    r.ex = r.ex * w + -0.22 * (1 - w);
    r.ez = r.ez * w;
  }
  function wavePens(t) {
    if(RIBBON&&(RIBBON.active||RIBBON.phase==="result"))t=(RIBBON.waveStart||0)+(RIBBON.fxTime||0);
    lastT = t;
    var b = t * 132 / 60, anyRainbow = false, np = 0, PI = Math.PI;
    anyCrazy = false;
    arms.forEach(function(r) {
      if(RIBBON&&RIBBON.crowd&&RIBBON.crowd.has(r.i))return;
      var s = seats[r.i], a = s.amp || 1;
      if (r.kind === "pen") {
        r.side = Math.max(0, Math.min(1, (a - 1.1) / 0.4));
        r.psi = 0.24 * a * Math.sin(PI * b / 2 + r.ph);
        r.phi = 0.24 * r.side * Math.sin(PI * b / 2 + r.ph + 1.2);
      } else {
        r.phi = 0.056 * a * Math.sin(PI * b * 0.2 + r.ph);
        r.psi = 0.02 * a * Math.sin(PI * b * 0.4 + r.ph);
      }
      if (s.fan && s.light && !s.crazy) {
        if (r.kind === "pen") r.phi = Math.max(-0.05, Math.min(r.phi, 0.05));
        else r.phi = Math.max(r.phi, -0.02);
      }
      armV.set(r.h[0] - r.e[0], r.h[1] - r.e[1], r.h[2] - r.e[2]).applyEuler(armE.set(r.psi, 0, r.phi));
      r.hp[0] = r.e[0] + armV.x;
      r.hp[1] = r.e[1] + armV.y + (a > 1.2 ? 0.035 * Math.abs(Math.sin(PI * b)) : 0);
      r.hp[2] = r.e[2] + armV.z;
      mSeat.copy(s.m);
      if (s.crazy) {
        crazyArm(r, s, b);
        return;
      }
      forearm(r.idx, r.k, r.e[0], r.e[1], r.e[2], r.hp[0], r.hp[1], r.hp[2]);
    });
    if (anyCrazy) IM.arm.instanceMatrix.needsUpdate = true;
    sticks.forEach(function(q) {
      if(RIBBON&&RIBBON.crowd&&RIBBON.crowd.has(q.i))return;
      var r = q.arm, a = seats[q.i].amp || 1, lag = Math.sin(PI * b / 2 + q.ph - 0.8), lagS = Math.sin(PI * b / 2 + q.ph + 0.4);
      var tz = q.splay + 1.2 * r.phi + 0.15 * (r.side || 0) * lagS + 0.26 * Math.sin(PI * b / 2 + q.ph + 1.6);
      if (seats[q.i].crazy) {
        eul.set(r.ex, 0, r.ez + q.splay * 0.6);
      } else if (seats[q.i].fan) tz = Math.max(-0.3, Math.min(tz, 0.08));
      if (!seats[q.i].crazy) eul.set(-0.22 + 1.3 * r.psi + 0.14 * a * lag, 0, tz);
      mA.makeRotationFromEuler(eul).setPosition(r.hp[0], r.hp[1], r.hp[2]);
      mB.makeScale(0.016, 0.24, 0.016).setPosition(0, 0.12, 0);
      mOut.multiplyMatrices(seats[q.i].m, mA).multiply(mB);
      if (q.col === "rainbow") {
        IM.rstick.setMatrixAt(q.i, mOut);
        anyRainbow = true;
      } else IM.stick.setMatrixAt(q.i * 3 + q.slot, mOut);
      for (var g = 0; g < GLOW_PER; g++) {
        var t01 = (g + 0.5) / GLOW_PER;
        gv.set(0, -0.5 + t01, 0).applyMatrix4(mOut);
        gpos.setXYZ(np, gv.x, gv.y, gv.z);
        if (q.col === "rainbow") zc.set(RAINBOW[Math.min(5, Math.floor(t01 * 6))]);
        else vivid(zc, q.col);
        gcol.setXYZ(np, zc.r * 0.34, zc.g * 0.34, zc.b * 0.34);
        np++;
      }
    });
    glowGeo.setDrawRange(0, np);
    gpos.needsUpdate = true;
    gcol.needsUpdate = true;
    glowPts.visible = S.props && S.penGlow;
    IM.stick.instanceMatrix.needsUpdate = true;
    if (anyRainbow) IM.rstick.instanceMatrix.needsUpdate = true;
    towels.forEach(function(q) {
      if(RIBBON&&RIBBON.crowd&&RIBBON.crowd.has(q.i))return;
      var s = seats[q.i], a = s.amp || 1;
      var bob = a > 1.2 ? 0.04 * Math.abs(Math.sin(PI * b)) : 0.015 * Math.sin(PI * b + q.ph);
      eul.set(-0.06 - 0.06 * a * Math.sin(PI * b + q.ph - 1), 0, 0.06 * a * Math.sin(PI * b / 2 + q.ph));
      mA.makeRotationFromEuler(eul).setPosition(0, q.y + bob, q.tz);
      q.g.matrix.multiplyMatrices(s.m, mA);
      q.g.matrixWorldNeedsUpdate = true;
      mSeat.copy(s.m);
      cornerV.set(-0.27, 0.1, 0).applyMatrix4(mA);
      forearm(q.i * 2, q.k, q.eL[0], q.eL[1], q.eL[2], cornerV.x, cornerV.y, cornerV.z);
      cornerV.set(0.27, 0.1, 0).applyMatrix4(mA);
      forearm(q.i * 2 + 1, q.k, q.eR[0], q.eR[1], q.eR[2], cornerV.x, cornerV.y, cornerV.z);
    });
    fans.forEach(function(q) {
      var r = q.arm, a = seats[q.i].amp || 1;
      var fz = 1.2 * r.phi + 0.12 * a * Math.sin(PI * b * 0.2 + q.ph - 0.8);
      if (seats[q.i].light) fz = Math.max(fz, -0.03);
      eul.set(-0.12 + 0.04 * a * Math.sin(PI * b * 0.4 + q.ph - 0.6), 0, fz);
      if (seats[q.i].crazy) eul.set(r.ex, 0, r.ez);
      mA.makeRotationFromEuler(eul).setPosition(r.hp[0], r.hp[1], r.hp[2]);
      q.u.matrix.multiplyMatrices(seats[q.i].m, mA);
      q.u.matrixWorldNeedsUpdate = true;
    });
    if (arms.length || towels.length) {
      IM.fore.instanceMatrix.needsUpdate = true;
      IM.hand.instanceMatrix.needsUpdate = true;
      if(RIBBON.world&&(RIBBON.active||RIBBON.phase==="result"))RIBBON.world.syncArms();
    }
  }
  function headWorld(s, out) {
    out.set(0,s.headLocal||1.2,s.headZ!==void 0?s.headZ:0.04).applyMatrix4(s.m);var body=RIBBON&&RIBBON.crowd&&RIBBON.crowd.bodyTransform(s.i);return body?out.applyMatrix4(body):out;
  }
  var meMat = new THREE.MeshBasicMaterial({ color: 15905372, fog: false });
  var me = new THREE.Group();
  scene.add(me);
  me.visible = false;
  var meTorso = mesh(new THREE.CylinderGeometry(0.2, 0.17, 1, 10), meMat, 0, 0, 0, me);
  var meHead = mesh(new THREE.SphereGeometry(0.11, 12, 9), meMat, 0, 0, 0, me);
  function updateMe() {
    var s = seats[S.my], H = S.h / 100, top = SEAT_H + 0.53 * H, sh = top - 0.28 * H / 1.7;
    me.position.copy(s.pos);
    me.rotation.y = s.rot;
    meTorso.scale.set(1, sh - SEAT_H, 0.6);
    meTorso.position.set(0, (SEAT_H + sh) / 2, 0.05);
    meHead.position.set(0, top - 0.11, 0.04);
  }
  var gradTex = new THREE.DataTexture(new Uint8Array([105, 175, 235, 255]), 4, 1, THREE.LuminanceFormat);
  gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter;
  gradTex.generateMipmaps = false;
  gradTex.needsUpdate = true;
  function toon(c, dbl) {
    return new THREE.MeshToonMaterial({ color: c, gradientMap: gradTex, side: dbl ? THREE.DoubleSide : THREE.FrontSide });
  }
  var olMat = new THREE.MeshBasicMaterial({ color: 2364444, side: THREE.BackSide });
  olMat.onBeforeCompile = function(sh) {
    sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n	transformed += normalize( normal ) * 0.007;");
  };
  function part(geo, mat, x, y, z, parent, plain) {
    var m = mesh(geo, mat, x, y, z, parent);
    if (!plain) m.add(new THREE.Mesh(geo, olMat));
    return m;
  }
  function outward(g) {
    var p = g.attributes.position, n = g.attributes.normal, best = 0, bi = 0, i;
    for (i = 0; i < p.count; i++) {
      var r = p.getX(i) * p.getX(i) + p.getZ(i) * p.getZ(i);
      if (r > best) {
        best = r;
        bi = i;
      }
    }
    if (n.getX(bi) * p.getX(bi) + n.getZ(bi) * p.getZ(bi) < 0) {
      var ix = g.index.array, t;
      for (i = 0; i < ix.length; i += 3) {
        t = ix[i + 1];
        ix[i + 1] = ix[i + 2];
        ix[i + 2] = t;
      }
      g.index.needsUpdate = true;
      g.computeVertexNormals();
    }
    return g;
  }
  function lathe(pts, seg, ps, pl) {
    var g = new THREE.LatheGeometry(pts.map(function(q) {
      return new THREE.Vector2(q[0], q[1]);
    }), seg || 20, ps || 0, pl === void 0 ? Math.PI * 2 : pl);
    g.computeVertexNormals();
    return outward(g);
  }
  function wavy(g, n, amp, yTop, span) {
    var p = g.attributes.position, i;
    for (i = 0; i < p.count; i++) {
      var x = p.getX(i), z = p.getZ(i), t = Math.min(1, Math.max(0, (yTop - p.getY(i)) / span));
      var k = 1 + amp * t * Math.cos(n * Math.atan2(x, z));
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
    g.computeVertexNormals();
    return outward(g);
  }
  function strand(pts, radFn, ts, rs) {
    var curve = new THREE.CatmullRomCurve3(pts.map(function(q) {
      return new THREE.Vector3(q[0], q[1], q[2]);
    }));
    var g = new THREE.TubeGeometry(curve, ts, 1, rs, false), p = g.attributes.position, c = new THREE.Vector3(), i, j, k, r;
    for (i = 0; i <= ts; i++) {
      curve.getPointAt(i / ts, c);
      r = radFn(i / ts);
      for (j = 0; j <= rs; j++) {
        k = i * (rs + 1) + j;
        p.setXYZ(k, c.x + (p.getX(k) - c.x) * r, c.y + (p.getY(k) - c.y) * r, c.z + (p.getZ(k) - c.z) * r);
      }
    }
    g.computeVertexNormals();
    return g;
  }
  function tailR(t) {
    return (0.03 + 0.032 * Math.min(1, t / 0.3)) * (1 - Math.pow(t, 2.5)) + 4e-3;
  }
  function lockR(t) {
    return 0.022 * (1 - t * 0.85);
  }
  var SKIN = 16769228;
  var G = {
    head: lathe([[1e-3, -0.13], [0.04, -0.118], [0.078, -0.09], [0.1, -0.06], [0.114, -0.03], [0.121, 0], [0.122, 0.03], [0.116, 0.06], [0.098, 0.09], [0.06, 0.115], [1e-3, 0.13]], 32),
    hairBob: lathe([[1e-3, 0.152], [0.07, 0.14], [0.12, 0.097], [0.142, 0.03], [0.145, -0.05], [0.137, -0.13], [0.117, -0.2], [0.085, -0.24]], 22, -1.95, 3.9),
    hairLong: lathe([[1e-3, 0.152], [0.07, 0.14], [0.12, 0.097], [0.142, 0.03], [0.145, -0.08], [0.14, -0.22], [0.128, -0.36], [0.105, -0.47], [0.06, -0.53]], 22, -1.95, 3.9),
    cap: new THREE.SphereGeometry(0.147, 24, 12, 0, Math.PI * 2, 0, 1.62),
    fringe: new THREE.ConeGeometry(0.026, 0.085, 6),
    lock: strand([[0, 0, 0], [4e-3, -0.07, -6e-3], [-6e-3, -0.14, -0.012], [-0.012, -0.19, -0.01]], lockR, 10, 6),
    ahoge: strand([[0, 0, 0], [0.012, 0.05, -8e-3], [0.05, 0.065, -0.015], [0.075, 0.045, -0.018]], function(t) {
      return 9e-3 * (1 - t * 0.9);
    }, 10, 5),
    twin: strand([[0, 0, 0], [0.07, -0.07, 0.02], [0.1, -0.2, 0.03], [0.08, -0.36, 0.012], [0.12, -0.5, -0.01]], tailR, 22, 9),
    pony: strand([[0, 0, 0], [0, 0.035, 0.085], [0, -0.1, 0.165], [0.02, -0.3, 0.155], [0, -0.5, 0.115]], tailR, 22, 9),
    torso: lathe([[0.1, 0.93], [0.093, 0.985], [0.118, 1.08], [0.132, 1.15], [0.128, 1.2], [0.085, 1.245], [0.045, 1.262]], 22),
    neck: new THREE.CylinderGeometry(0.036, 0.04, 0.09, 12),
    choker: new THREE.TorusGeometry(0.04, 7e-3, 6, 18),
    collar: lathe([[0.06, 1.262], [0.12, 1.235], [0.172, 1.2]], 22),
    skirt: wavy(lathe([[0.098, 0.985], [0.128, 0.94], [0.163, 0.84], [0.192, 0.73], [0.2, 0.69]], 54), 12, 0.03, 0.985, 0.3),
    under: wavy(lathe([[0.096, 0.975], [0.122, 0.93], [0.155, 0.83], [0.183, 0.72], [0.188, 0.705]], 54), 12, 0.02, 0.985, 0.3),
    trim: wavy(lathe([[0.187, 0.752], [0.197, 0.722]], 54), 12, 0.03, 0.985, 0.3),
    band: new THREE.CylinderGeometry(0.101, 0.101, 0.04, 20),
    leg: lathe([[0.028, -0.72], [0.033, -0.62], [0.046, -0.5], [0.04, -0.38], [0.05, -0.2], [0.058, -0.02], [0.05, 0.06]], 14),
    sock: lathe([[0.031, -0.725], [0.036, -0.62], [0.049, -0.5], [0.043, -0.38], [0.051, -0.25]], 14),
    sockBand: new THREE.TorusGeometry(0.051, 6e-3, 6, 16),
    shoe: new THREE.SphereGeometry(1, 12, 8),
    puff: new THREE.SphereGeometry(0.066, 14, 10),
    uarm: lathe([[0.026, -0.24], [0.03, -0.1], [0.034, 0.01]], 10),
    farm: lathe([[0.021, -0.21], [0.027, 5e-3]], 10),
    cuff: lathe([[0.047, -0.205], [0.027, -0.14]], 14),
    hand: new THREE.SphereGeometry(1, 10, 8),
    wing: new THREE.ConeGeometry(0.55, 1, 10),
    knot: new THREE.SphereGeometry(0.28, 10, 8),
    ribbon: new THREE.BoxGeometry(0.04, 0.3, 6e-3),
    star: new THREE.OctahedronGeometry(0.022)
  };
  var skinMat = toon(SKIN), whiteMat = toon(16775925), whiteDbl = toon(16775925, true);
  var LOOKS = [
    { hair: 16752576, dress: 16742571, acc: 16773754, iris: ["#8a2a5e", "#ff86bd"] },
    { hair: 16243082, dress: 6468863, acc: 16777215, iris: ["#1f5fa8", "#7fd0ff"] },
    { hair: 9423093, dress: 12033279, acc: 16773754, iris: ["#4b3aa0", "#b9a6ff"] },
    { hair: 9067068, dress: 16757575, acc: 16736109, iris: ["#8a4a12", "#ffc766"] },
    { hair: 12165872, dress: 5756592, acc: 16748480, iris: ["#1f7a63", "#8ff0d0"] },
    { hair: 3420238, dress: 16739179, acc: 16771496, iris: ["#8a1f2e", "#ff8f8f"] }
  ];
  function makeFace(iris, browColor) {
    var c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    var x = c.getContext("2d"), KX = 1358, KY = 1707;
    function X(m) {
      return 512 + m * KX;
    }
    function Y(m) {
      return 256 - m * KY;
    }
    function ell(cx, cy, rx, ry) {
      x.beginPath();
      x.ellipse(X(cx), Y(cy), rx * KX, ry * KY, 0, 0, Math.PI * 2);
    }
    x.fillStyle = "#ffe0cc";
    x.fillRect(0, 0, 1024, 512);
    [-1, 1].forEach(function(s) {
      var cx = s * 0.047, cy = -0.014, g;
      g = x.createRadialGradient(X(s * 0.07), Y(-0.052), 0, X(s * 0.07), Y(-0.052), 0.03 * KX);
      g.addColorStop(0, "rgba(255,110,135,.6)");
      g.addColorStop(1, "rgba(255,110,135,0)");
      x.fillStyle = g;
      x.fillRect(X(s * 0.07) - 60, Y(-0.052) - 60, 120, 120);
      g = x.createLinearGradient(0, Y(cy + 0.027), 0, Y(cy - 0.027));
      g.addColorStop(0, "#d9d3e6");
      g.addColorStop(0.45, "#ffffff");
      ell(cx, cy, 0.0205, 0.027);
      x.fillStyle = g;
      x.fill();
      x.save();
      ell(cx, cy, 0.0205, 0.027);
      x.clip();
      g = x.createLinearGradient(0, Y(cy + 0.022), 0, Y(cy - 0.026));
      g.addColorStop(0, iris[0]);
      g.addColorStop(0.55, iris[1]);
      g.addColorStop(1, "#ffffff");
      ell(cx, cy - 2e-3, 0.0168, 0.0238);
      x.fillStyle = g;
      x.fill();
      x.lineWidth = 3;
      x.strokeStyle = iris[0];
      x.stroke();
      ell(cx, cy + 1e-3, 72e-4, 0.0115);
      x.fillStyle = "rgba(25,10,35,.8)";
      x.fill();
      x.fillStyle = "rgba(20,8,30,.28)";
      x.fillRect(X(cx) - 40, Y(cy + 0.03), 80, 0.02 * KY);
      x.restore();
      x.fillStyle = "#fff";
      ell(cx - 75e-4, cy + 0.0105, 52e-4, 52e-4 * KX / KY);
      x.fill();
      ell(cx + 6e-3, cy - 0.012, 26e-4, 26e-4 * KX / KY);
      x.fill();
      x.strokeStyle = "#3a1c26";
      x.lineCap = "round";
      x.lineWidth = 9;
      x.beginPath();
      x.moveTo(X(cx - 0.0235), Y(cy + 0.011));
      x.quadraticCurveTo(X(cx), Y(cy + 0.04), X(cx + 0.0235), Y(cy + 0.011));
      x.stroke();
      x.lineWidth = 6;
      x.beginPath();
      x.moveTo(X(cx + s * 0.0225), Y(cy + 0.013));
      x.lineTo(X(cx + s * 0.031), Y(cy + 0.021));
      x.stroke();
      x.lineWidth = 2.5;
      x.globalAlpha = 0.55;
      x.beginPath();
      x.moveTo(X(cx - 0.014), Y(cy - 0.024));
      x.quadraticCurveTo(X(cx), Y(cy - 0.03), X(cx + 0.014), Y(cy - 0.024));
      x.stroke();
      x.globalAlpha = 1;
      x.strokeStyle = browColor;
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(X(cx - 0.018), Y(cy + 0.046));
      x.quadraticCurveTo(X(cx), Y(cy + 0.054), X(cx + 0.018), Y(cy + 0.047));
      x.stroke();
    });
    x.strokeStyle = "rgba(190,110,100,.7)";
    x.lineWidth = 2.5;
    x.beginPath();
    x.moveTo(X(1e-3), Y(-0.043));
    x.lineTo(X(4e-3), Y(-0.048));
    x.stroke();
    x.fillStyle = "#c53f5c";
    x.beginPath();
    x.moveTo(X(-0.0135), Y(-0.068));
    x.quadraticCurveTo(X(0), Y(-0.064), X(0.0135), Y(-0.068));
    x.quadraticCurveTo(X(0), Y(-0.094), X(-0.0135), Y(-0.068));
    x.fill();
    x.fillStyle = "#ff9aa8";
    ell(0, -0.08, 6e-3, 4e-3);
    x.fill();
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  function makeBow(mat, size, parent, x, y, z) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(size);
    parent.add(g);
    var a = mesh(G.wing, mat, -0.5, 0, 0, g);
    a.rotation.z = -Math.PI / 2;
    a.scale.z = 0.45;
    var b = mesh(G.wing, mat, 0.5, 0, 0, g);
    b.rotation.z = Math.PI / 2;
    b.scale.z = 0.45;
    mesh(G.knot, mat, 0, 0, 0, g);
    return g;
  }
  var perfGroup = new THREE.Group();
  scene.add(perfGroup);
  var IDOL_PAGE = document.body.classList.contains("page-idol");
  var IDOL_FOV = 42, GAME_FOV = 46;
  var performers = [];
  function makePerformer(i) {
    var L = LOOKS[i % LOOKS.length], dress = toon(L.dress), dressDbl = toon(L.dress, true), accent = toon(L.acc), accDbl = toon(L.acc, true);
    var hair = toon(L.hair), hairDbl = toon(L.hair, true), browCss = "#" + new THREE.Color(L.hair).multiplyScalar(0.55).getHexString();
    var g = new THREE.Group(), p = { g, i, tails: [], ribbons: [] }, m;
    [-1, 1].forEach(function(s) {
      var hip = new THREE.Group();
      hip.position.set(s * 0.07, 0.78, 0);
      g.add(hip);
      part(G.leg, skinMat, 0, 0, 0, hip);
      part(G.sock, whiteMat, 0, 0, 0, hip, true);
      m = mesh(G.sockBand, accent, 0, -0.25, 0, hip);
      m.rotation.x = Math.PI / 2;
      m = part(G.shoe, dress, 0, -0.752, -0.035, hip);
      m.scale.set(0.045, 0.036, 0.095);
      p[s < 0 ? "legL" : "legR"] = hip;
      var sh = new THREE.Group();
      sh.position.set(s * 0.165, 1.2, 0);
      g.add(sh);
      m = part(G.puff, whiteMat, 0, 0, 0, sh);
      m.scale.y = 0.85;
      part(G.uarm, skinMat, 0, 0, 0, sh);
      var el = new THREE.Group();
      el.position.set(0, -0.24, 0);
      sh.add(el);
      part(G.farm, skinMat, 0, 0, 0, el);
      part(G.cuff, whiteDbl, 0, 0, 0, el);
      m = part(G.hand, skinMat, 0, -0.245, 0, el);
      m.scale.set(0.027, 0.04, 0.02);
      makeBow(accent, 0.06, el, 0, -0.14, -0.03);
      p[s < 0 ? "armL" : "armR"] = sh;
      p[s < 0 ? "elL" : "elR"] = el;
      var rb = new THREE.Group();
      rb.position.set(s * 0.045, 0.97, 0.085);
      rb.rotation.z = s * 0.12;
      g.add(rb);
      mesh(G.ribbon, accDbl, 0, -0.16, 0, rb);
      rb.userData.base = s * 0.12;
      p.ribbons.push(rb);
    });
    part(G.under, whiteDbl, 0, 0, 0, g);
    part(G.skirt, dressDbl, 0, 0, 0, g);
    mesh(G.trim, accDbl, 0, 0, 0, g);
    m = part(G.torso, dress, 0, 0, 0, g);
    m.scale.z = 0.68;
    m = mesh(G.band, accent, 0, 0.985, 0, g);
    m.scale.z = 0.7;
    m = part(G.collar, whiteDbl, 0, 0, 0, g);
    m.scale.z = 0.72;
    makeBow(accent, 0.12, g, 0, 1.165, -0.098);
    makeBow(accent, 0.24, g, 0, 0.99, 0.095);
    mesh(G.neck, skinMat, 0, 1.275, 0, g);
    m = mesh(G.choker, accent, 0, 1.275, 0, g);
    m.rotation.x = Math.PI / 2;
    var head = new THREE.Group();
    head.position.set(0, 1.4, 0);
    g.add(head);
    p.head = head;
    m = part(G.head, new THREE.MeshToonMaterial({ map: makeFace(L.iris, browCss), gradientMap: gradTex }), 0, 0, 0, head);
    m.scale.z = 0.95;
    var style = i % 3;
    part(style === 1 ? G.hairLong : G.hairBob, hairDbl, 0, 0, 4e-3, head);
    m = part(G.cap, hair, 0, 0, 4e-3, head);
    m.rotation.x = 0.42;
    [-0.78, -0.52, -0.26, 0, 0.26, 0.52, 0.78].forEach(function(a, k) {
      m = part(G.fringe, hair, Math.sin(a) * 0.128, 0.036 - k % 2 * 8e-3, -Math.cos(a) * 0.128, head);
      m.rotation.set(0, -a, Math.PI);
      m.scale.set(1.15, 1 + k % 3 * 0.12, 0.45);
    });
    [-1, 1].forEach(function(s) {
      m = part(G.lock, hair, s * 0.121, 0.03, -0.05, head);
      m.scale.x = s;
    });
    part(G.ahoge, hair, 0, 0.145, 0, head, true);
    if (style === 0) {
      [-1, 1].forEach(function(s) {
        var tp2 = new THREE.Group();
        tp2.position.set(s * 0.122, 0.075, 0.04);
        head.add(tp2);
        m = part(G.twin, hair, 0, 0, 0, tp2);
        m.scale.x = s;
        makeBow(accent, 0.085, tp2, 0, 5e-3, -0.012);
        tp2.userData.base = 0;
        tp2.userData.axis = "z";
        p.tails.push(tp2);
      });
    } else if (style === 1) {
      makeBow(accent, 0.2, head, 0, 0.1, 0.13);
      m = mesh(G.star, accent, 0.1, 0.07, -0.09, head);
    } else {
      var tp = new THREE.Group();
      tp.position.set(0, 0.1, 0.105);
      head.add(tp);
      part(G.pony, hair, 0, 0, 0, tp);
      makeBow(accent, 0.13, tp, 0, 0.03, 0.06);
      tp.userData.base = 0;
      tp.userData.axis = "x";
      p.tails.push(tp);
      m = mesh(G.star, accent, -0.1, 0.07, -0.09, head);
    }
    return p;
  }
  var FORMATION = [[0, 0], [-1.65, -1.3], [-0.55, -1.3], [0.55, -1.3], [1.65, -1.3], [-1.4, -2.6], [0, -2.6], [1.4, -2.6]];
  function buildPerformers() {
    performers.forEach(function(p2) {
      perfGroup.remove(p2.g);
    });
    performers = [];
    if (IDOL_PAGE) {
      FORMATION.forEach(function(f, i2) {
        var p2 = makePerformer(i2);
        p2.bx = f[0];
        p2.bz = STAGE_Z0 - 1.25 + f[1];
        perfGroup.add(p2.g);
        performers.push(p2);
      });
      placePerformers(0);
      return;
    }
    var n = S.nPerf, rows = n <= 4 ? 1 : n <= 10 ? 2 : 3, per = Math.ceil(n / rows), i;
    for (i = 0; i < n; i++) {
      var r = Math.floor(i / per), inRow = Math.min(per, n - r * per), k = i - r * per;
      var p = makePerformer(i), span = Math.min(5.2, (inRow - 1) * 1.15);
      p.bx = inRow > 1 ? -span / 2 + span * k / (inRow - 1) : 0;
      if (r % 2 === 1) p.bx += 0.5;
      p.bz = -((n === 1 ? 2 : 1.1) + r * 1.45);
      perfGroup.add(p.g);
      performers.push(p);
    }
    placePerformers(0);
  }
  var ribbonHoldRotations=null;
  function ribbonHoldPose(p,blend) {
    if(!ribbonHoldRotations)ribbonHoldRotations=[-1,1].map(function(lean){return [-1,1].map(function(side){
      // Close overhead grips lean toward the other holder; preserve both bone lengths.
      var shoulder=new THREE.Vector3(side*.165,1.2,0),hand=new THREE.Vector3(side*.04+lean*.1,1.62,-.08),axis=hand.clone().sub(shoulder),distance=axis.length();axis.normalize();
      var along=(.24*.24-.245*.245+distance*distance)/(2*distance),bend=side===lean?new THREE.Vector3(0,0,-1):new THREE.Vector3(side,0,0);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
      var elbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,.24*.24-along*along)));
      var down=new THREE.Vector3(0,-1,0),upper=new THREE.Quaternion().setFromUnitVectors(down,elbow.clone().sub(shoulder).normalize()),fore=new THREE.Quaternion().setFromUnitVectors(down,hand.sub(elbow).normalize());
      return [upper,upper.clone().invert().multiply(fore)];
    });});
    var from=RIBBON.resultFrom&&RIBBON.resultFrom[p.i],pose=ribbonHoldRotations[p.i===2?0:1];
    [p.armL,p.armR].forEach(function(arm,i){var elbow=i?p.elR:p.elL,target=pose[i];arm.quaternion.slerpQuaternions(from&&from.arms?from.arms[i]:new THREE.Quaternion(),target[0],blend);elbow.quaternion.slerpQuaternions(from&&from.elbows?from.elbows[i]:new THREE.Quaternion(),target[1],blend);});
  }
  function placePerformers(t) {
    if (!perfGroup.visible) return;
    if (IDOL_PAGE && performers[0]) {
      performers[0].g.visible = !(S.cam && S.cam.idol && !S.overview);
      var ribbonShow = RIBBON && (RIBBON.active || RIBBON.phase === "result");
      var solo = !ribbonShow && typeof MODE !== "undefined" && MODE === "game";
      if (ribbonShow) performers.forEach(function(p,i){p.g.visible = !RIBBON.active || i !== RIBBON.slot;});
      if (!ribbonShow) for (var pi = 1; pi < performers.length; pi++) performers[pi].g.visible = !solo;
    }
    var b = t * 132 / 60, sc = S.perfH / 157, dance = S.dance;
    performers.forEach(function(p) {
      var ph = p.i * 0.9, g = p.g;
      g.scale.setScalar(sc);
      if (!dance || RIBBON && (RIBBON.active || RIBBON.phase === "result")) {
        if(RIBBON && RIBBON.active && RIBBON.stations)g.position.copy(RIBBON.stations[p.i].position);
        else if(RIBBON && RIBBON.phase==="result")g.position.set(p.i<6?(p.i===2?-.25*S.perfH/160:p.i===3?.25*S.perfH/160:RIBBON.stations[p.i].position.x):(p.i-9.5)*.7,S.stageH,STAGE_Z0-.8-(p.i<6?0:1.25));
        else g.position.set(p.bx, S.stageH, p.bz);
        g.rotation.y = Math.PI;
        if(RIBBON && RIBBON.active) {
          var heading=p.i===RIBBON.slot && RIBBON.thrower ? RIBBON.thrower.heading||0 : (RIBBON.heldHeadings||{})[p.i]||RIBBON.stations[p.i].heading;
          g.rotation.y+=heading;
          var standing=p.i===RIBBON.slot?RIBBON.thrower:(RIBBON.heldThrowers||{})[p.i];
          if(standing)g.position.copy(standing.position);
        }
        p.armL.rotation.set(0, 0, -0.12);
        p.armR.rotation.set(0, 0, 0.12);
        p.elL.rotation.set(0, 0, 0);
        p.elR.rotation.set(0, 0, 0);
        p.legL.rotation.set(0, 0, 0);
        p.legR.rotation.set(0, 0, 0);
        p.head.rotation.z = 0;
        if(RIBBON && RIBBON.active && RIBBON.settled.some(function(f){return f.owner===p.i;})) {p.armL.rotation.set(.233,0,0);p.elL.rotation.x=1.393;}
        if(RIBBON && RIBBON.active && p.i===RIBBON.slot) {p.armR.rotation.set(1.9,0,-.4);p.elR.rotation.x=.6;p.armL.rotation.set(.233,0,0);p.elL.rotation.x=1.393;}
        if(RIBBON && RIBBON.phase === "result") {
          var lift=Math.min(1,(RIBBON.resultAge||0)/1.1);
          g.position.z-=p.i<6&&p.i!==2&&p.i!==3?.35:0;
          g.rotation.y=Math.PI+(p.i<3?1:-1)*(p.i===2||p.i===3?.42:.15);
          if(p.i===2 || p.i===3)ribbonHoldPose(p,lift*lift*(3-2*lift));
          else {p.armL.rotation.z=-.9;p.armR.rotation.z=.9;p.elL.rotation.x=p.elR.rotation.x=.7+.12*Math.sin((RIBBON.resultAge||0)*15);}
          var from=RIBBON.resultFrom&&RIBBON.resultFrom[p.i],blend=lift*lift*(3-2*lift);
          if(from){g.position.lerpVectors(from.position,g.position,blend);g.rotation.y=from.yaw+wrapAng(g.rotation.y-from.yaw)*blend;}
        }
        return;
      }
      var raise = 0.5 + 0.5 * Math.sin(b * Math.PI / 8 + ph * 0.25), beat = Math.sin(b * Math.PI);
      var bx = function(bb) {
        return 0.22 * Math.sin(bb * Math.PI / 2 + ph * 0.15);
      };
      var bodyX = bx(b), nb = Math.floor(b), fb = b - nb, ease = fb * fb * (3 - 2 * fb);
      var dip = 0.03 * (1 - Math.abs(Math.sin(fb * Math.PI)));
      g.position.set(p.bx + bodyX, S.stageH + 0.035 * Math.sin(fb * Math.PI) - dip * 0.5, p.bz + 0.04 * Math.sin(b * Math.PI / 4 + ph));
      g.rotation.y = Math.PI + 0.12 * Math.sin(b * Math.PI / 4 + ph * 0.3);
      [p.legL, p.legR].forEach(function(leg, j) {
        var off = -leg.position.x * sc, foot, lift = 0;
        if ((nb % 2 + 2) % 2 === j) {
          foot = bx(nb - 1) + (bx(nb + 1) - bx(nb - 1)) * ease + off;
          lift = Math.sin(fb * Math.PI);
        } else foot = bx(nb) + off;
        var dxl = -(foot - (bodyX + off)) / sc;
        leg.rotation.z = Math.asin(Math.max(-0.6, Math.min(0.6, dxl / 0.76)));
        leg.rotation.x = -0.32 * lift;
      });
      var az = 0.3 + 2.25 * raise;
      p.armL.rotation.set((1 - raise) * 0.7 * beat, 0, -(az + 0.22 * beat));
      p.armR.rotation.set(-(1 - raise) * 0.7 * beat, 0, az - 0.22 * beat);
      p.elL.rotation.set(0.5 * (1 - raise) + 0.2, 0, 0.35 * raise * beat);
      p.elR.rotation.set(0.5 * (1 - raise) + 0.2, 0, -0.35 * raise * beat);
      p.head.rotation.z = 0.13 * Math.sin(b * Math.PI / 2 + ph);
      p.tails.forEach(function(tp, k) {
        tp.rotation[tp.userData.axis] = 0.16 * Math.sin(b * Math.PI + k * 0.6);
      });
      p.ribbons.forEach(function(rb, k) {
        rb.rotation.z = rb.userData.base + 0.12 * Math.sin(b * Math.PI + k);
        rb.rotation.x = 0.25 + 0.15 * Math.sin(b * Math.PI / 2 + k);
      });
    });
  }
  var gif = null, gifCanvas = document.createElement("canvas"), gifCtx = null, gifImg = null, gifIdx = null;
  var gifAt = -1, gifNext = 0, gifTex = null, gifAspect = 216 / 346;
  var gifMat = new THREE.MeshBasicMaterial({ color: 1709856, fog: false, toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  var gifPlane = mesh(new THREE.PlaneGeometry(1, 1), gifMat, 0, 1.6, -2);
  gifPlane.renderOrder = 2;
  (function() {
    var c = document.createElement("canvas");
    c.width = 128;
    c.height = 256;
    var x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, "#000");
    g.addColorStop(0.14, "#fff");
    g.addColorStop(0.86, "#fff");
    g.addColorStop(1, "#000");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 256);
    x.globalCompositeOperation = "multiply";
    g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#000");
    g.addColorStop(0.1, "#fff");
    g.addColorStop(0.985, "#fff");
    g.addColorStop(1, "#888");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 256);
    var t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    gifMat.alphaMap = t;
  })();
  function gifStep() {
    var n = gif.frames.length;
    gifAt = (gifAt + 1) % n;
    if (gifAt === 0) gifImg.data.fill(0);
    var fr = gif.frames[gifAt];
    drawGifFrame(gif, fr, gifImg.data, gifIdx);
    gifCtx.putImageData(gifImg, 0, 0);
    gifTex.needsUpdate = true;
    return fr.delay;
  }
  function initGif() {
    try {
      var bin = atob(GIF_B64), bytes = new Uint8Array(bin.length), i;
      for (i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      gif = parseGif(bytes);
      if (!gif.frames.length) throw new Error("no frames");
      gifCanvas.width = gif.w;
      gifCanvas.height = gif.h;
      gifAspect = gif.w / gif.h;
      gifCtx = gifCanvas.getContext("2d");
      gifImg = gifCtx.createImageData(gif.w, gif.h);
      gifIdx = new Uint8Array(gif.w * gif.h);
      gifTex = new THREE.CanvasTexture(gifCanvas);
      gifTex.encoding = THREE.sRGBEncoding;
      gifTex.minFilter = THREE.LinearFilter;
      gifTex.magFilter = THREE.LinearFilter;
      gifTex.generateMipmaps = false;
      gifMat.map = gifTex;
      gifMat.needsUpdate = true;
      gifStep();
    } catch (e) {
      gif = null;
      $("gifNote").textContent = "內嵌的直拍 GIF 讀取失敗，請改用「人形模型」。";
    }
  }
  function placeGif() {
    var h = S.gifPH / 100 / GIF_PERSON, w = h * gifAspect, b = S.gifB / 100;
    gifPlane.visible = S.mode === "gif";
    gifPlane.scale.set(w, h, 1);
    gifPlane.position.set(S.gifX, S.stageH - GIF_FOOT * h + h / 2, -S.gifZ);
    if (gif) gifMat.color.setRGB(b, b, b);
  }
  function tickGif(now) {
    if (!gif || S.mode !== "gif" || !S.gifPlay) {
      gifNext = 0;
      return;
    }
    if (!gifNext) gifNext = now;
    if (now >= gifNext) {
      var d = gifStep();
      gifNext = Math.max(gifNext + d, now - 200);
    }
  }
  function applyStage() {
    var h = Math.max(S.stageH, 6e-3);
    stageMesh.scale.y = h;
    stageMesh.position.y = h / 2;
    stageSkirt.visible = S.stageH > 0.02;
    stageSkirt.scale.y = h;
    stageSkirt.position.y = h / 2;
    aimLights();
    placeGif();
  }
  var eye = new THREE.Vector3(), lookT = new THREE.Vector3();
  function stageGameView() {
    return IDOL && S.cam && S.cam.idol && typeof MODE !== "undefined" && MODE === "game";
  }
  function eyePos(out) {
    if (RIBBON && RIBBON.phase === "result") return out.set(0, S.stageH + 1.5, STAGE_Z0 + 4.4);
    if (RIBBON && RIBBON.active && RIBBON.thrower) return out.copy(RIBBON.thrower.eye);
    if (S.cam && S.cam.idol) return out.set(0, S.stageH + (stageGameView() ? S.perfH / 100 * .935 : 1.48), STAGE_Z0 - 1.25);
    if (S.cam) return out.set(0, S.cam.back ? frontElev(12) + 1.3 : S.stageH + 0.95, S.cam.back ? 10.5 : ROW_Z0);
    var s = seats[S.my];
    out.set(0, SEAT_H + 0.463 * S.h / 100, 0.04).applyAxisAngle(YAX, s.rot).add(s.pos);
    return out;
  }
  function lookCenter(out) {
    if (stageGameView()) return out.set(0, 1.2 + frontElev(4), ROW_Z0 + 4 * ROW_PITCH);
    if (S.cam && S.cam.idol) return out.set(0, 1.5, 7);
    return out.set(0, S.stageH + 1.2, -STAGE_D * 0.35);
  }
  function resetLook() {
    eyePos(eye);
    camera.position.copy(eye);
    lookCenter(lookT);
    camera.lookAt(lookT);
    S.yaw = camera.rotation.y;
    S.pitch = camera.rotation.x;
  }
  function fovFactor() {
    if (RIBBON && (RIBBON.active || RIBBON.phase==="result")) {
      var ribbonBase=Math.max(56,Math.min(86,2*Math.atan(Math.tan(34*Math.PI/180)/Math.max(.1,camera.aspect))*180/Math.PI));
      return (RIBBON.active&&RIBBON.thrower&&RIBBON.thrower.zone!=="front"?70:ribbonBase)/IDOL_FOV;
    }
    if (stageGameView()) {
      // Keep a modest horizontal field in portrait without an extreme wide lens.
      // A fixed multiplier preserves the fan game's existing zoom ratio.
      var portraitFov = 2 * Math.atan(Math.tan(30 * Math.PI / 360) / Math.max(.35, camera.aspect)) * 180 / Math.PI;
      return Math.min(62, Math.max(GAME_FOV, portraitFov)) / IDOL_FOV;
    }
    return camera.aspect < 0.9 ? IDOL ? 0.95 : 1.15 : 1;
  }
  function ribbonStageView(aspect) {
    var position=new THREE.Vector3(0,SEAT_H+.463*S.h/100,ROW_Z0),target=new THREE.Vector3(0,S.stageH+1.18,STAGE_Z0-1.1);
    var framing=new THREE.PerspectiveCamera(50,aspect,.05,80);framing.position.copy(position);framing.lookAt(target);
    // Keep a moderate horizontal lens on desktop; portrait focuses on the central cast.
    var fov=aspect<.9?58:2*Math.atan(Math.tan(39*Math.PI/180)/aspect)*180/Math.PI;
    return {position:position,quaternion:framing.quaternion.clone(),fov:fov,aspect:aspect};
  }
  function ribbonRenderFrame() {renderer.render(scene,camera);}
  function updateCamera() {
    if(RIBBON && RIBBON.phase==="result") {
      camera.aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);
      var view=RIBBON.resultView;
      if(!view || view.aspect!==camera.aspect)view=RIBBON.resultView=ribbonStageView(camera.aspect);
      var t=Math.min(1,(RIBBON.resultAge||0)/1.1);t=t*t*(3-2*t);
      camera.position.lerpVectors(RIBBON.resultStartPosition||view.position,view.position,t);
      camera.quaternion.slerpQuaternions(RIBBON.resultStartQuaternion||view.quaternion,view.quaternion,t);
      camera.fov=(RIBBON.resultStartFov||view.fov)*(1-t)+view.fov*t;camera.updateProjectionMatrix();return;
    }
    if (S.overview) {
      var ce = Math.cos(S.oEl);
      lookT.set(0, 1.2, 2.5);
      camera.position.set(lookT.x + S.oR * Math.sin(S.oAz) * ce, lookT.y + S.oR * Math.sin(S.oEl), lookT.z + S.oR * Math.cos(S.oAz) * ce);
      camera.fov = 50;
      camera.lookAt(lookT);
    } else {
      eyePos(eye);
      camera.position.copy(eye);
      camera.rotation.set(S.pitch, S.yaw, 0);
      camera.fov = S.fov * fovFactor();
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }
  function updateHud() {
    var s = seats[S.my];
    eyePos(eye);
    var d = Math.hypot(eye.x, eye.z - (STAGE_Z0 - STAGE_D) / 2), dy = eye.y - S.stageH;
    var name = S.cam ? S.cam.label : seatLabel(s);
    $("hudSeat").textContent = S.overview ? "場館鳥瞰" : name;
    $("hudInfo").textContent = S.cam && S.cam.idol && !S.overview ? "站在舞台前段中央，看向觀眾席" : (S.overview ? name + "・" : "") + "距舞台中央 " + d.toFixed(1) + " m・眼睛" + (dy >= 0 ? "高於" : "低於") + "舞台面 " + Math.abs(dy * 100).toFixed(0) + " cm";
    $("btnReset").textContent = S.cam && S.cam.idol ? "看向觀眾席中央" : "看向舞台中央";
    $("btnReset").hidden = !!(S.overview && IDOL);
    if(RIBBON && RIBBON.phase==="result"){$("hudSeat").textContent="A 排正中央・廣角合照";$("hudInfo").textContent="坐席視線觀看舞台，彩帶與成員正在集合";}
    $("hudHint").textContent = RIBBON && RIBBON.active ? "彩帶挑戰：瞄準金色標記，快速向上滑動投出" : S.overview ? IDOL ? "拖曳旋轉場館，滾輪或雙指縮放" : "拖曳旋轉場館，滾輪拉近拉遠；金色人形是你的位置" : S.cam && S.cam.idol ? "拖曳畫面轉頭看觀眾席；遊戲中點一下粉絲就算找到" : IDOL ? "拖曳畫面轉頭看看四周" : "拖曳畫面轉頭看別處，方向鍵微調";
    $("btnOverview").textContent = S.overview ? "回到座位視野" : "場館鳥瞰";
  }
  var map = $("map"), mctx = map.getContext("2d");
  var MAP = { x0: -5.9, z0: -6.5, w: 11.8, h: 18.4 };
  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  var COL = { accent: css("--accent"), plum: css("--plum"), seat: css("--seat"), muted: css("--muted") };
  var FONT = css("--font-body");
  function drawMap() {
    var W = map.width, k = W / MAP.w, ctx = mctx;
    if (map.height !== Math.round(MAP.h * k)) map.height = Math.round(MAP.h * k);
    function X(x) {
      return (x - MAP.x0) * k;
    }
    function Z(z) {
      return (z - MAP.z0) * k;
    }
    ctx.clearRect(0, 0, W, map.height);
    ctx.fillStyle = "#2c2433";
    ctx.fillRect(X(-STAGE_W / 2), Z(-STAGE_D), STAGE_W * k, STAGE_LEN * k);
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(X(-STAGE_W / 2), Z(-STAGE_D) - 0.12 * k, STAGE_W * k, 0.12 * k);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COL.muted;
    ctx.font = "500 " + Math.round(0.6 * k) + "px " + FONT;
    ctx.fillText("舞台", X(0), Z(STAGE_Z0 - STAGE_LEN / 2));
    ctx.font = Math.round(0.34 * k) + "px " + FONT;
    PILLARS.forEach(function(p) {
      ctx.fillStyle = "#4a4550";
      ctx.fillRect(X(p.x - PILLAR_W / 2), Z(p.z - PILLAR_D / 2), PILLAR_W * k, PILLAR_D * k);
      ctx.fillStyle = "#d8d2dc";
      ctx.fillText("柱", X(p.x), Z(p.z));
    });
    ctx.fillStyle = COL.muted;
    ctx.font = Math.round(0.36 * k) + "px " + FONT;
    FRONT.forEach(function(def, r) {
      ctx.fillText(def[0], X(def[1][0] - (r === 0 ? 1.35 : 0.5)), Z(ROW_Z0 + r * ROW_PITCH));
    });
    SIDES.forEach(function(d) {
      ctx.fillText(d[0], X(d[1]), Z(d[2] + 0.5));
    });
    if (!S.overview) {
      var a = Math.atan2(-Math.cos(S.yaw), -Math.sin(S.yaw)), half = Math.atan(Math.tan(S.fov * fovFactor() * Math.PI / 360) * camera.aspect);
      var m = { pos: eyePos(eye) }, g = ctx.createRadialGradient(X(m.pos.x), Z(m.pos.z), 0, X(m.pos.x), Z(m.pos.z), 8 * k);
      g.addColorStop(0, "rgba(242,178,92,.34)");
      g.addColorStop(1, "rgba(242,178,92,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(X(m.pos.x), Z(m.pos.z));
      ctx.arc(X(m.pos.x), Z(m.pos.z), 8 * k, a - half, a + half);
      ctx.closePath();
      ctx.fill();
    }
    seats.forEach(function(s) {
      var sz = 0.36 * k;
      ctx.save();
      ctx.translate(X(s.pos.x), Z(s.pos.z));
      if (s.i === S.my && !S.cam) {
        ctx.fillStyle = COL.accent;
        ctx.fillRect(-sz / 2 - 1, -sz / 2 - 1, sz + 2, sz + 2);
      } else if (seatOcc(s)) {
        ctx.fillStyle = COL.seat;
        ctx.globalAlpha = s.cH !== null || s.cOcc !== null ? 1 : 0.8;
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
      } else {
        ctx.strokeStyle = COL.seat;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-sz / 2 + 1, -sz / 2 + 1, sz - 2, sz - 2);
      }
      ctx.globalAlpha = 1;
      if (G2.result && !G2.on && G2.fans.indexOf(s) >= 0) {
        ctx.strokeStyle = s.found ? "#5fd38d" : "#ff5c6c";
        ctx.lineWidth = 3;
        ctx.strokeRect(-sz / 2 - 2, -sz / 2 - 2, sz + 4, sz + 4);
      }
      if (s.i === S.edit) {
        ctx.strokeStyle = COL.plum;
        ctx.lineWidth = 3.5;
        ctx.strokeRect(-sz / 2 - 3, -sz / 2 - 3, sz + 6, sz + 6);
      }
      ctx.restore();
    });
  }
  map.addEventListener("click", function(e) {
    if (IDOL && (typeof MODE === "undefined" || MODE !== "seat")) return;
    var p = elLocal(map, e.clientX, e.clientY), k = map.clientWidth / MAP.w;
    var x = p.x / k + MAP.x0, z = p.y / k + MAP.z0, best = -1, bd = 0.4;
    seats.forEach(function(s) {
      var d = Math.hypot(s.pos.x - x, s.pos.z - z);
      if (d < bd) {
        bd = d;
        best = s.i;
      }
    });
    if (best < 0) return;
    if (IDOL) {
      setMySeat(best, true);
      S.fov = 40;
      resetLook();
      fillSeatView();
      updateHud();
      return;
    }
    if (S.pick === "me") setMySeat(best, true);
    else setEdit(best);
  });
  function fillSelects() {
    var s = seats[S.my], row = $("selRow"), num = $("selNum"), nums = [];
    row.innerHTML = ROW_ORDER.split("").map(function(r) {
      return '<option value="' + r + '">' + r + " 排" + (SIDE_NAME[r] ? "（舞台" + SIDE_NAME[r] + "）" : "") + "</option>";
    }).join("");
    row.value = s.row;
    seats.forEach(function(q) {
      if (q.row === s.row) nums.push(q.num);
    });
    num.innerHTML = nums.map(function(n) {
      return '<option value="' + n + '">' + n + " 號</option>";
    }).join("");
    num.value = String(s.num);
  }
  function setMySeat(i, relook) {
    if (S.cam) {
      S.cam = null;
      S.fov = 40;
    }
    S.my = i;
    if (S.edit === i) setEdit(-1);
    updateAudience();
    updateMe();
    fillSelects();
    if (relook) resetLook();
    updateHud();
    drawMap();
  }
  function onSelect() {
    var row = $("selRow").value, i = findSeat(row, parseInt($("selNum").value, 10));
    if (i < 0) i = findSeat(row, 1);
    setMySeat(i, true);
  }
  $("selRow").addEventListener("change", onSelect);
  $("selNum").addEventListener("change", onSelect);
  function setEdit(i) {
    S.edit = i;
    var ed = $("editor");
    if (i < 0) {
      ed.hidden = true;
      drawMap();
      return;
    }
    var s = seats[i];
    ed.hidden = false;
    $("edWho").textContent = seatLabel(s) + " 的觀眾";
    $("edOcc").disabled = false;
    $("edOcc").checked = seatOcc(s);
    $("edH").value = seatHeight(s);
    $("edHOut").textContent = seatHeight(s) + " cm";
    $("edH").disabled = !seatOcc(s);
    drawMap();
  }
  $("edOcc").addEventListener("change", function(e) {
    if (S.edit < 0) return;
    seats[S.edit].cOcc = e.target.checked;
    updateAudience();
    setEdit(S.edit);
  });
  $("edH").addEventListener("input", function(e) {
    if (S.edit < 0) return;
    seats[S.edit].cH = +e.target.value;
    $("edHOut").textContent = e.target.value + " cm";
    updateAudience();
    drawMap();
  });
  $("edClear").addEventListener("click", function() {
    if (S.edit < 0) return;
    seats[S.edit].cH = null;
    seats[S.edit].cOcc = null;
    updateAudience();
    setEdit(S.edit);
  });
  $("btnFront").addEventListener("click", function() {
    var m = seats[S.my], fx = -Math.sin(m.rot), fz = -Math.cos(m.rot), best = -1, bd = 0.6;
    seats.forEach(function(s) {
      if (s.i === S.my) return;
      var d = Math.hypot(s.pos.x - (m.pos.x + fx * ROW_PITCH), s.pos.z - (m.pos.z + fz * ROW_PITCH));
      if (d < bd) {
        bd = d;
        best = s.i;
      }
    });
    if (best < 0) {
      S.edit = -1;
      $("editor").hidden = false;
      $("edWho").textContent = seatLabel(m) + " 的正前方沒有座位";
      $("edOcc").checked = false;
      $("edOcc").disabled = true;
      $("edH").disabled = true;
      $("edHOut").textContent = "";
      drawMap();
      return;
    }
    $("pickEdit").checked = true;
    S.pick = "edit";
    setEdit(best);
  });
  document.querySelectorAll("input[name=pick]").forEach(function(r) {
    r.addEventListener("change", function() {
      S.pick = r.value;
      if (S.pick === "me") setEdit(-1);
    });
  });
  function bind(id, fmt, apply) {
    var el = $(id), out = $(id + "Out");
    function run() {
      var v = +el.value;
      if (out) out.textContent = fmt(v);
      apply(v);
    }
    el.addEventListener("input", run);
    if (out) out.textContent = fmt(+el.value);
  }
  var cm = function(v) {
    return v + " cm";
  }, pct = function(v) {
    return v + "%";
  }, mtr = function(v) {
    return v.toFixed(1) + " m";
  };
  var side = function(v) {
    return Math.abs(v) < 0.05 ? "置中" : (v < 0 ? "左 " : "右 ") + Math.abs(v).toFixed(1) + " m";
  };
  bind("myH", cm, function(v) {
    S.h = v;
    updateMe();
    updateHud();
  });
  bind("avgH", cm, function(v) {
    S.avg = v;
    updateAudience();
  });
  bind("spread", function(v) {
    return "±" + v + " cm";
  }, function(v) {
    S.spread = v;
    updateAudience();
  });
  bind("rate", pct, function(v) {
    S.rate = v;
    updateAudience();
    renderMemberTable();
    drawMap();
  });
  bind("nPerf", function(v) {
    return v + " 人";
  }, function(v) {
    S.nPerf = v;
    buildPerformers();
  });
  bind("perfH", cm, function(v) {
    S.perfH = v;
  });
  bind("gifPH", cm, function(v) {
    S.gifPH = v;
    placeGif();
  });
  bind("gifX", side, function(v) {
    S.gifX = v;
    placeGif();
  });
  bind("gifZ", mtr, function(v) {
    S.gifZ = v;
    placeGif();
  });
  bind("gifB", pct, function(v) {
    S.gifB = v;
    placeGif();
  });
  bind("house", pct, function(v) {
    S.house = v;
  });
  $("houseOn").addEventListener("change", function(e) {
    S.houseOn = e.target.checked;
  });
  $("envOn").addEventListener("change", function(e) {
    S.envOn = e.target.checked;
  });
  $("penGlow").addEventListener("change", function(e) {
    S.penGlow = e.target.checked;
    stickMat.color.setHex(S.penGlow ? 16777215 : 5592405);
    if (rstickMat) rstickMat.color.setHex(S.penGlow ? 16777215 : 5592405);
    updateZoneLights();
    glowPts.visible = S.props && S.penGlow;
  });
  bind("stageL", pct, function(v) {
    S.stage = v;
  });
  $("stageOn").addEventListener("change", function(e) {
    S.stageOn = e.target.checked;
  });
  document.querySelectorAll("input[name=stageCol]").forEach(function(r) {
    r.addEventListener("change", function() {
      S.stageCol = r.value;
    });
  });
  bind("beam", pct, function(v) {
    S.beam = v;
  });
  function regrade() {
    seats.forEach(function(s) {
      s.pos.y = seatY(s);
    });
    buildPlatforms();
    updateAudience();
    updateMe();
    updateHud();
  }
  bind("riseLow", cm, function(v) {
    S.riseLow = v / 100;
    regrade();
  });
  bind("rearBase", cm, function(v) {
    S.rearBase = v / 100;
    regrade();
  });
  bind("riseRear", cm, function(v) {
    S.riseRear = v / 100;
    regrade();
  });
  bind("stageH", cm, function(v) {
    S.stageH = v / 100;
    applyStage();
    updateHud();
  });
  bind("sideUp", cm, function(v) {
    S.sideUp = v / 100;
    regrade();
  });
  $("pen").addEventListener("change", function(e) {
    S.props = e.target.checked;
    updateAudience();
  });
  bind("lightPct", pct, function(v) {
    S.lightPct = v;
    updateAudience();
    renderMemberTable();
  });
  bind("fanPct", pct, function(v) {
    S.fanPct = v;
    updateAudience();
    renderMemberTable();
  });
  document.querySelectorAll("input[name=team]").forEach(function(r) {
    r.addEventListener("change", function() {
      setTeam(+r.value);
      $("gTeam").value = r.value;
      $("gTeam").syncFancy();
      fillMemberSelect();
    });
  });
  $("dance").checked = S.dance;
  $("dance").addEventListener("change", function(e) {
    S.dance = e.target.checked;
  });
  $("gifPlay").checked = S.gifPlay;
  $("gifPlay").addEventListener("change", function(e) {
    S.gifPlay = e.target.checked;
  });
  $("colorAnim").addEventListener("change", function(e) {
    S.colorAnim = e.target.checked;
  });
  $("btnShuffle").addEventListener("click", function() {
    S.seed = newSeed();
    colorAudience();
    updateAudience();
    renderMemberTable();
    if (S.edit >= 0) setEdit(S.edit);
    else drawMap();
  });
  function applyMode() {
    perfGroup.visible = S.mode === "model";
    $("modelCtl").hidden = S.mode !== "model";
    $("gifCtl").hidden = S.mode !== "gif";
    placeGif();
  }
  document.querySelectorAll("input[name=stageMode]").forEach(function(r) {
    r.addEventListener("change", function() {
      S.mode = r.value;
      applyMode();
    });
  });
  function setSlider(id, v) {
    var el = $(id);
    el.value = v;
    el.dispatchEvent(new Event("input"));
  }
  document.querySelectorAll("input[name=lp]").forEach(function(r) {
    r.addEventListener("change", function() {
      var p = { show: [false, 80], mc: [false, 110], house: [true, 35] }[r.value];
      $("houseOn").checked = S.houseOn = p[0];
      if (p[0]) setSlider("house", 85);
      setSlider("stageL", p[1]);
    });
  });
  $("btnReset").addEventListener("click", function() {
    if (RIBBON.active) { ribbonFaceTarget(); return; }
    clearFanZoom();
    if (!S.cam) S.fov = 40;
    else if (S.cam.idol) S.fov = IDOL_FOV;
    if (S.overview) {
      S.overview = false;
      me.visible = false;
    }
    resetLook();
    updateCamera();
    updateHud();
    drawMap();
  });
  $("btnOverview").addEventListener("click", function() {
    S.overview = !S.overview;
    me.visible = S.overview;
    updateHud();
    drawMap();
  });
  function setCam(back) {
    if (back === "idol") {
      S.cam = { idol: true, label: "偶像視角（舞台上）" };
      S.fov = IDOL_FOV;
    } else {
      S.cam = { back, label: back ? "最後排中央攝影機" : "第一排中央攝影機" };
      S.fov = back ? 19 : 47;
    }
    S.overview = false;
    me.visible = false;
    updateAudience();
    resetLook();
    updateHud();
    drawMap();
  }
  $("camFront").addEventListener("click", function() {
    setCam(false);
  });
  $("camBack").addEventListener("click", function() {
    setCam(true);
  });
  var moodTex = {};
  function moodMaterial(ch) {
    if (!moodTex[ch]) {
      var c = document.createElement("canvas");
      c.width = c.height = 128;
      var x = c.getContext("2d");
      x.fillStyle = "rgba(255,255,255,.85)";
      x.beginPath();
      x.arc(64, 60, 50, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.moveTo(52, 104);
      x.lineTo(64, 124);
      x.lineTo(76, 104);
      x.fill();
      x.font = '64px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(ch, 64, 62);
      var t = new THREE.CanvasTexture(c);
      moodTex[ch] = new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false, toneMapped: false, transparent: true, opacity: 0.55 });
    }
    return moodTex[ch];
  }
  var moodGroup = new THREE.Group();
  scene.add(moodGroup);
  function showMood(s, ch) {
    if(RIBBON&&(RIBBON.active||RIBBON.phase==="result")&&RIBBON.angrySeats&&RIBBON.angrySeats.has(s.i))return;
    if (s.mood) moodGroup.remove(s.mood);
    var sp = new THREE.Sprite(moodMaterial(ch));
    sp.renderOrder = 10;
    sp.scale.set(0.34, 0.34, 1);
    sp.userData.seat = s;
    sp.userData.born = performance.now();sp.userData.expression=ch;
    if(RIBBON&&(RIBBON.active||RIBBON.phase==="result")){sp.userData.ribbonReaction=true;sp.userData.ribbonBorn=RIBBON.fxTime||0;}
    moodGroup.add(sp);
    s.mood = sp;
  }
  function clearMoods() {
    while (moodGroup.children.length) moodGroup.remove(moodGroup.children[0]);
    seats.forEach(function(s) {
      s.mood = null;
    });
  }
  var hw = new THREE.Vector3();
  function placeMoods(now) {
    moodGroup.children.forEach(function(sp) {
      var s=sp.userData.seat,clock=sp.userData.ribbonReaction?(RIBBON.fxTime||0)*1000:now,age=sp.userData.ribbonReaction?(RIBBON.fxTime||0)-sp.userData.ribbonBorn:(now-sp.userData.born)/1e3;
      headWorld(s, hw);
      sp.position.set(hw.x, hw.y + 0.34 + 0.06 * Math.sin(clock / 230), hw.z);
      var pop = Math.min(1, age * 4);
      sp.scale.set(0.34 * pop, 0.34 * pop, 1);
    });
  }
  function canvasTex(size, draw) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d"), size);
    return new THREE.CanvasTexture(c);
  }
  var ringTex = canvasTex(128, function(x, n) {
    var g = x.createRadialGradient(n / 2, n / 2, n * 0.28, n / 2, n / 2, n / 2);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.55, "rgba(255,255,255,.95)");
    g.addColorStop(0.7, "rgba(255,255,255,.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, n, n);
  });
  var starTex = canvasTex(64, function(x, n) {
    var g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.beginPath();
    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4, r = k % 2 ? 7 : 31;
      x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    x.closePath();
    x.fill();
  });
  var heartTex = canvasTex(128, function(x, n) {
    x.shadowColor = "#ff4f93";
    x.shadowBlur = 22;
    x.fillStyle = "#ff6fa8";
    x.beginPath();
    x.moveTo(64, 104);
    x.bezierCurveTo(14, 70, 18, 22, 50, 26);
    x.bezierCurveTo(58, 27, 62, 34, 64, 40);
    x.bezierCurveTo(66, 34, 70, 27, 78, 26);
    x.bezierCurveTo(110, 22, 114, 70, 64, 104);
    x.fill();
    x.shadowBlur = 0;
    x.fillStyle = "rgba(255,255,255,.7)";
    x.beginPath();
    x.ellipse(46, 44, 9, 6, -0.6, 0, Math.PI * 2);
    x.fill();
  });
  var fxGroup = new THREE.Group();
  scene.add(fxGroup);
  var fxList = [];
  function fxSprite(tex, color) {
    var m = new THREE.SpriteMaterial({
      map: tex,
      color,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false
    });
    var sp = new THREE.Sprite(m);
    sp.renderOrder = 12;
    fxGroup.add(sp);
    return sp;
  }
  function burst(s) {
    headWorld(s, hw);
    var c = hw.clone();
    c.y += 0.05;
    [0, 160, 320].forEach(function(d, k2) {
      fxList.push({ kind: "ring", sp: fxSprite(ringTex, k2 === 1 ? 16765803 : 16744383), c, born: performance.now() + d, life: 900 });
    });
    for (var k = 0; k < 12; k++) {
      var a = k / 12 * Math.PI * 2, v = new THREE.Vector3(Math.cos(a), 0.6 + Math.random() * 0.8, Math.sin(a) * 0.6).multiplyScalar(0.9 + Math.random() * 0.5);
      fxList.push({ kind: "star", sp: fxSprite(starTex, k % 2 ? 16774048 : 16777215), c, v, born: performance.now(), life: 1e3 + Math.random() * 300 });
    }
  }
  var fwd = new THREE.Vector3();
  function flyHeart(s, done) {
    camera.getWorldDirection(fwd);
    var from = camera.position.clone().addScaledVector(fwd, 0.45);
    from.y -= 0.12;
    headWorld(s, hw);
    var to = hw.clone();
    to.y += 0.1;
    fxList.push({ kind: "heart", sp: fxSprite(heartTex, 16777215), from, to, born: performance.now(), life: 650, done });
  }
  var qTex = canvasTex(128, function(x, n) {
    x.font = "900 104px " + FONT_STACK;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.lineJoin = "round";
    x.lineWidth = 14;
    x.strokeStyle = "#2a1840";
    x.strokeText("?", 64, 68);
    x.fillStyle = "#ffe36b";
    x.fillText("?", 64, 68);
  });
  function missMark(s) {
    var m = new THREE.SpriteMaterial({ map: qTex, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    var sp = new THREE.Sprite(m);
    sp.renderOrder = 12;
    fxGroup.add(sp);
    headWorld(s, hw);
    fxList.push({ kind: "q", sp, c: hw.clone(), born: performance.now(), life: 950 });
  }
  function updateFx(now) {
    for (var i = fxList.length - 1; i >= 0; i--) {
      var f = fxList[i], t = (now - f.born) / f.life;
      if (t < 0) {
        f.sp.visible = false;
        continue;
      }
      f.sp.visible = true;
      if (t >= 1) {
        fxGroup.remove(f.sp);
        f.sp.material.dispose();
        fxList.splice(i, 1);
        if (f.done) f.done();
        continue;
      }
      if (f.kind === "ring") {
        var r = 0.25 + 1.5 * (1 - Math.pow(1 - t, 3));
        f.sp.position.copy(f.c);
        f.sp.scale.set(r, r, 1);
        f.sp.material.opacity = 1 - t;
      } else if (f.kind === "star") {
        var e = 1 - Math.pow(1 - t, 2);
        f.sp.position.set(f.c.x + f.v.x * e, f.c.y + f.v.y * e - 0.6 * t * t, f.c.z + f.v.z * e);
        var sz = 0.16 * (1 - t) + 0.04;
        f.sp.scale.set(sz, sz, 1);
        f.sp.material.opacity = 1 - t;
      } else if (f.kind === "q") {
        var pop = t < 0.18 ? t / 0.18 : 1, wob = Math.sin(t * 18) * 0.06 * (1 - t);
        f.sp.position.set(f.c.x, f.c.y + 0.3 + 0.18 * t, f.c.z);
        var qs = 0.3 * (0.6 + 0.4 * pop);
        f.sp.scale.set(qs, qs, 1);
        f.sp.material.rotation = wob;
        f.sp.material.opacity = t < 0.7 ? 1 : (1 - t) / 0.3;
      } else if (f.kind === "say") {
        headWorld(f.seat, hw);
        var dd = hw.distanceTo(camera.position), sh = 0.045 * dd * Math.tan(camera.fov * Math.PI / 360) / Math.tan(21 * Math.PI / 180);
        var pp = t < 0.1 ? t / 0.1 : 1;
        sh *= 0.7 + 0.3 * pp;
        if (f.grow) sh *= 0.8 + 0.8 * smooth01(t / 0.55);
        f.sp.position.set(hw.x, hw.y + 0.3 + sh * 0.6 + 0.04 * Math.sin(t * 10), hw.z);
        f.sp.scale.set(sh * f.asp, sh, 1);
        f.sp.material.opacity = t < 0.85 ? 1 : (1 - t) / 0.15;
      } else if (f.kind === "drop") {
        var tt = (now - f.born) / 1e3;
        f.sp.position.set(f.p.x + f.v.x * tt, f.p.y + f.v.y * tt - 2.4 * tt * tt, f.p.z + f.v.z * tt);
        f.sp.scale.set(0.07, 0.07, 1);
        f.sp.material.opacity = 1 - t;
      } else if (f.kind === "hole") {
        var hsz = 0.95 * Math.sin(Math.min(1, t * 1.15) * Math.PI);
        f.sp.position.copy(f.c);
        f.sp.scale.set(Math.max(0.01, hsz), Math.max(0.01, hsz), 1);
        f.sp.material.rotation = -t * 14;
      } else if (f.kind === "suck") {
        var u = t, a1 = (1 - u) * (1 - u), a2 = 2 * (1 - u) * u, a3 = u * u;
        f.sp.position.set(a1 * f.from.x + a2 * f.via.x + a3 * f.to.x, a1 * f.from.y + a2 * f.via.y + a3 * f.to.y, a1 * f.from.z + a2 * f.via.z + a3 * f.to.z);
        var ss = 0.34 * (u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45 * 0.92);
        f.sp.scale.set(ss, ss, 1);
        f.sp.material.rotation = u > 0.55 ? (u - 0.55) * 30 : 0;
        f.sp.material.opacity = u < 0.92 ? 1 : (1 - u) / 0.08;
      } else if (f.kind === "heart") {
        var e2 = t * t * (3 - 2 * t);
        f.sp.position.lerpVectors(f.from, f.to, e2);
        f.sp.position.y += Math.sin(t * Math.PI) * 0.6;
        var hs = 0.12 + 0.28 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2);
        f.sp.scale.set(hs, hs, 1);
        f.sp.material.opacity = t < 0.85 ? 1 : (1 - t) / 0.15;
      }
    }
  }
  function blowKiss() {
    var k = $("kiss");
    k.classList.remove("play");
    void k.offsetWidth;
    k.classList.add("play");
  }
  var AC = null, master = null, sfxGain = null, bgmGain = null, bgmEl = $("bgm"), muted = false;
  function initAudio() {
    if (AC) {
      if (AC.state !== "running") {
        var pr = AC.resume();
        if (pr && pr.catch) pr.catch(function() {
        });
      }
      if (bgmEl.src && bgmEl.paused && !document.hidden) bgmEl.play().catch(function() {
      });
      return;
    }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 1;
      master.connect(AC.destination);
      sfxGain = AC.createGain();
      sfxGain.gain.value = 0.5;
      sfxGain.connect(master);
      if (IDOL && BGM_B64.length > 100) {
        var bin = atob(BGM_B64), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        bgmEl.src = URL.createObjectURL(new Blob([bytes], { type: "audio/mp4" }));
        bgmEl.loop = true;
        var src = AC.createMediaElementSource(bgmEl);
        bgmGain = AC.createGain();
        bgmGain.gain.value = 0;
        src.connect(bgmGain);
        bgmGain.connect(master);
        bgmEl.play().catch(function() {
        });
      }
    } catch (e) {
      AC = null;
    }
  }
  function unlockAudio() {
    initAudio();
    if (!AC) return;
    if (AC.state !== "running") {
      var pr = AC.resume();
      if (pr && pr.catch) pr.catch(function() {
      });
    }
    if (!unlockAudio.done) {
      try {
        var b = AC.createBuffer(1, 1, 22050), s = AC.createBufferSource();
        s.buffer = b;
        s.connect(AC.destination);
        s.start(0);
        unlockAudio.done = true;
      } catch (e) {
      }
    }
    if (bgmEl.src && bgmEl.paused && !document.hidden) bgmEl.play().catch(function() {
    });
  }
  ["pointerdown", "touchend", "click", "keydown"].forEach(function(ev) {
    document.addEventListener(ev, unlockAudio, true);
  });
  document.addEventListener("visibilitychange", function() {
    var now = performance.now();
    if (document.hidden) {
      if (RIBBON.active || RIBBON.phase === "result") { RIBBON.pausedAt = now; ribbonCancelGesture();ribbonSetPower(0); }
      if (G2.phase === "play" || G2.phase === "countdown") G2.pausedAt = now;
    } else if (RIBBON.pausedAt) {
      var ribbonPause = now - RIBBON.pausedAt;
      RIBBON.pausedAt = 0;
      if (RIBBON.phase === "countdown") RIBBON.cdStart += ribbonPause;
      if (RIBBON.nextAt) RIBBON.nextAt += ribbonPause;
      if (RIBBON.flight && RIBBON.flight.removeAt) RIBBON.flight.removeAt += ribbonPause;
      RIBBON.lastFrame = now;if(RIBBON.crowd)RIBBON.crowd.last=now;
    } else if (G2.pausedAt) {
      var dt = now - G2.pausedAt;
      G2.pausedAt = 0;
      if (G2.end) G2.end += dt;
      if (G2.cdStart) G2.cdStart += dt;
      [G2.rb, G2.sw, G2.shout].forEach(function(o) {
        if (!o) return;
        ["t0", "until", "next", "sweatAt"].forEach(function(k) {
          if (o[k]) o[k] += dt;
        });
      });
      toast("遊戲已暫停，歡迎回來，繼續找粉絲吧！");
    }
  });
  document.addEventListener("visibilitychange", function() {
    if (!AC) return;
    if (document.hidden) {
      AC.suspend();
      if (!bgmEl.paused) bgmEl.pause();
    } else {
      var pr = AC.resume();
      if (pr && pr.catch) pr.catch(function() {
      });
      if (bgmEl.src) bgmEl.play().catch(function() {
      });
    }
  });
  var BGM_LEVEL = { idle: 0.22, countdown: 0.3, play: 0.6, result: 0.32 };
  function tickAudio() {
    if (!bgmGain) return;
    var target = muted ? 0 : BGM_LEVEL[G2.phase] || 0.22, g = bgmGain.gain;
    g.value += (target - g.value) * (target > g.value ? 0.12 : 0.05);
  }
  function tone(freq, dur, type, vol, when, slideTo) {
    if (!AC || muted) return;
    var t02 = AC.currentTime + (when || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t02);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t02 + dur);
    g.gain.setValueAtTime(1e-4, t02);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t02 + 0.012);
    g.gain.exponentialRampToValueAtTime(1e-4, t02 + dur);
    o.connect(g);
    g.connect(sfxGain);
    o.start(t02);
    o.stop(t02 + dur + 0.05);
  }
  var SFX = {
    count: function() {
      tone(660, 0.18, "square", 0.18);
    },
    go: function() {
      [523, 659, 784, 1047].forEach(function(f, k) {
        tone(f, 0.5, "triangle", 0.22, k * 0.02);
      });
      tone(2093, 0.4, "sine", 0.08, 0.05);
    },
    kiss: function() {
      tone(900, 0.09, "sine", 0.25, 0, 2400);
      tone(1800, 0.06, "sine", 0.12, 0.08, 3e3);
    },
    found: function() {
      [1047, 1319, 1568, 2093].forEach(function(f, k) {
        tone(f, 0.28, "triangle", 0.2, k * 0.06);
      });
      tone(3136, 0.5, "sine", 0.06, 0.24);
    },
    miss: function() {
      tone(240, 0.12, "square", 0.08, 0, 180);
    },
    tick: function() {
      tone(1320, 0.07, "square", 0.1);
    },
    win: function() {
      [523, 659, 784, 1047, 1319].forEach(function(f, k) {
        tone(f, 0.45, "triangle", 0.2, k * 0.11);
      });
      tone(1568, 0.9, "triangle", 0.18, 0.6);
    },
    end: function() {
      [784, 659, 523].forEach(function(f, k) {
        tone(f, 0.4, "triangle", 0.16, k * 0.16);
      });
    }
  };
  $("btnSound").addEventListener("click", function() {
    muted = !muted;
    initAudio();
    this.textContent = muted ? "🔇 聲音關" : "🔊 聲音開";
    this.setAttribute("aria-pressed", String(!muted));
  });
  var IDOL = document.body.classList.contains("page-idol");
  function isTarget(s) {
    return s.oshi === G2.member && (s.fan || s.towel || s.light && !G2.easy) && seatOcc(s);
  }
  function tally() {
    var t = { fan: { n: 0, f: 0 }, light: { n: 0, f: 0 } };
    G2.fans.forEach(function(s) {
      var g = s.fan ? t.fan : t.light;
      g.n++;
      if (s.found) g.f++;
    });
    return t;
  }
  var G2 = { conv: {}, egg: null, converted: 0, on: false, phase: "idle", team: 0, member: 0, dur: 50, end: 0, fans: [], found: 0, result: false, cdStart: 0, lastCd: 0, lastTick: 0, allAt: 0 };
  var gHud = $("gameHud"), gTime = $("gTimeLeft"), gCount = $("gCount"), gToast = $("gToast"), gRes = $("gameResult");
  function fillGameSelects() {
    $("gTeam").innerHTML = TEAMS.map(function(t, k) {
      return '<option value="' + k + '">' + t.name + "</option>";
    }).join("");
    $("gTeam").value = String(S.team);
    fillMemberSelect();
  }
  function fillMemberSelect() {
    var t = TEAMS[+$("gTeam").value];
    $("gMember").innerHTML = t.members.map(function(m, k) {
      return '<option value="' + k + '">' + esc(m.n) + "（" + esc(m.nick) + "）</option>";
    }).join("");
    if (typeof updateMemberCard === "function") setTimeout(updateMemberCard, 0);
  }
  $("gTeam").addEventListener("change", fillMemberSelect);
  function updateMemberCard() {
    var t = TEAMS[+$("gTeam").value], m = t && t.members[+$("gMember").value], el = $("gCard");
    if (!m) {
      el.innerHTML = "";
      return;
    }
    var mine = m.c.map(function(c) {
      return String(c).toLowerCase();
    }), same = [];
    var key = mine.slice().sort().join("|");
    t.members.forEach(function(o) {
      if (o === m) return;
      if (o.c.map(function(c) {
        return String(c).toLowerCase();
      }).sort().join("|") === key) same.push(o.n + "（" + o.nick + "）");
    });
    el.innerHTML = "手燈：" + colorWords(m) + "<br>扇子：「" + esc(m.nick) + "」或「" + esc(m.n) + "」・毛巾：「" + esc(m.n) + "」" + (same.length ? '<br><span class="same">⚠ 手燈與 ' + esc(same.join("、")) + " 同色</span>" : "");
  }
  $("gTeam").addEventListener("change", updateMemberCard);
  $("gMember").addEventListener("change", updateMemberCard);
  function setTeam(k) {
    S.team = k;
    document.querySelectorAll("input[name=team]").forEach(function(r) {
      r.checked = +r.value === k;
    });
    updateAudience();
    renderMemberTable();
    drawMap();
  }
  function toast(msg) {
    gToast.textContent = msg;
    gToast.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function() {
      gToast.hidden = true;
    }, 1600);
  }
  var SHOUT_LINES = ["{nick}太可愛！", "{nick}髮型好看！", "{nick}！！！"];
  var SHOUT_SPECIAL = {
    "林于馨": ["REICHI卡哇伊~"],
    "伊品": ["品~~品~~！"],
    "胡詠晴": ["噢晴晴！"],
    "呂昕恩": ["噢沅沅！"],
    "林易沄": ["汪汪汪汪汪！"],
    "蔡亞恩": ["SOBA醬↓↑ ！！"],
    "陳穎臻": ["臻天才！"],
    "黃昱燕": ["氣質！！！！"],
    "陳泰琌": ["泰朗尼電波逼哩哩"],
    "陳巧儀": ["愛死你惹"],
    "許淳媛": ["糰子是我der"]
  };
  var ACHS = {
    a: { win: "最愛遵守規則的粉絲", fail: "不守規矩沒糖吃" },
    b: { win: "聽到遠方的呼喊", fail: "山頂好像有什麼" },
    c: { win: "人人有飯撒", fail: "座位旁留著空" },
    d: { win: "抓住增推的機會", fail: "DD真不好釣.." }
  };
  var BH_LINES = ["看我的手塚區！", "全世界的飯撒都是我的", "唔、差不多了嗎？"];
  var SW_TIME = 2500, SW_HOLD = 1500;
  var GAME_VER = "1.00";
  document.querySelectorAll(".verbtn").forEach(function(b) {
    b.addEventListener("click", function() {
      GAME_VER = b.dataset.ver;
      document.querySelectorAll(".verbtn").forEach(function(o) {
        o.setAttribute("aria-pressed", String(o === b));
      });
    });
  });
  function near3(a, b) {
    if (!a || !b || a.side !== b.side) return false;
    var dx = Math.abs(a.pos.x - b.pos.x), dz = Math.abs(a.pos.z - b.pos.z);
    return a.side ? dz < SEAT_P * 1.5 && dx < 1 : dx < SEAT_P * 1.5 && dz < ROW_PITCH * 1.5;
  }
  function pickOne(arr) {
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
  }
  function smooth01(x) {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
  }
  function inView(s, mx, my) {
    headWorld(s, ndc);
    ndc.project(camera);
    return ndc.z < 1 && Math.abs(ndc.x) < (mx || 0.7) && Math.abs(ndc.y) < (my || 0.75);
  }
  function resetSpecials() {
    var dirty = G2.standI >= 0 || G2.swapI >= 0 || G2.shirtI >= 0 || seats.some(function(s) {
      return s.pose;
    });
    seats.forEach(function(s) {
      s.pose = null;
      s.crazy = false;
    });
    G2.rb = null;
    G2.shout = null;
    G2.bh = null;
    G2.sw = null;
    G2.glassI = -1;
    G2.standI = -1;
    G2.swapI = -1;
    G2.shirtI = -1;
    G2.keep = {};
    G2.ach = {};
    endCalm();
    clearAngry();
    hideNotice();
    if (dirty) updateAudience();
  }
  function isEdgeSeat(s) {
    var nums = seats.filter(function(q) {
      return q.row === s.row && q.side === s.side && Math.sign(q.pos.x) === Math.sign(s.pos.x || 1);
    }).map(function(q) {
      return +q.num;
    });
    if (!s.side) nums = seats.filter(function(q) {
      return q.row === s.row && !q.side;
    }).map(function(q) {
      return +q.num;
    });
    return +s.num === Math.min.apply(null, nums) || +s.num === Math.max.apply(null, nums);
  }
  function pickSpecials() {
    var picked = [], used = {}, free = function(s) {
      return !picked.some(function(p) {
        return p === s || near3(p, s);
      });
    };
    var mark = function(s) {
      used[s.i] = 1;
      picked.push(s);
    };
    var inFront = function(s, lo, hi) {
      return !s.side && s.st >= lo && s.st <= hi;
    };
    var b = pickOne(seats.filter(function(s) {
      return seatOcc(s) && !isTarget(s) && (s.side ? "NOPQ".indexOf(s.row) >= 0 : s.st <= 2) && !isEdgeSeat(s) && G2.fans.some(function(q) {
        return near3(s, q);
      });
    }));
    if (b) {
      G2.bh = { i: b.i, left: 3, used: 0, glowUntil: 0 };
      G2.glassI = b.i;
      mark(b);
      rebuildSeat(b.i);
    }
    var r = pickOne(seats.filter(function(s) {
      return seatOcc(s) && !isTarget(s) && free(s) && (s.side ? s.row === "N" || s.row === "O" : inFront(s, 2, 4));
    }));
    if (r) {
      G2.rb = { i: r.i, state: "wait", t0: 0, until: 0 };
      mark(r);
    }
    var sh = pickOne(G2.fans.filter(function(s) {
      return inFront(s, 10, 12) && free(s);
    }));
    if (sh) {
      G2.shout = { i: sh.i, next: 0, count: 0 };
      mark(sh);
    }
    var w = pickOne(seats.filter(function(s) {
      return seatOcc(s) && !isTarget(s) && free(s) && (s.light || s.fan || s.towel) && (s.side ? "NOPQ".indexOf(s.row) >= 0 : s.st <= 2);
    }));
    if (w) G2.sw = { i: w.i, state: "wait", t0: 0, swapped: false, sweatAt: 0 };
  }
  function refreshFans() {
    G2.fans = seats.filter(function(s) {
      return isTarget(s) || G2.keep && G2.keep[s.i];
    });
    G2.found = G2.fans.filter(function(q) {
      return q.found;
    }).length;
    updateGameHud(performance.now());
  }
  function tickSpecials(now) {
    if (!G2.v101) return;
    var playT = now - (G2.end - G2.dur * 1e3);
    var r = G2.rb;
    if (r) {
      var rs = seats[r.i];
      if (r.state === "wait" && playT > 4e3 && inView(rs, 0.6, 0.6)) startStand(now);
      if (r.state === "stand") {
        (G2.angry || []).forEach(function(q) {
          if (q.angryAt && now >= q.angryAt) {
            q.angryAt = 0;
            showMood(q, q.angryFace);
          }
        });
        var f = smooth01((now - r.t0) / 700);
        if (!rs.pose || rs.pose.stand !== f) {
          rs.pose = { stand: f };
          rebuildSeat(r.i);
        }
        if (now >= r.until) {
          r.state = "sit";
          clearAngry();
          endCalm();
        } else if (!$("calm").hidden) $("calmLeft").textContent = "待冷靜還有 " + Math.max(0, (r.until - now) / 1e3).toFixed(1) + " 秒";
      } else if (r.state === "sit") {
        var f2 = 1 - smooth01((now - r.until) / 800);
        rs.pose = f2 > 0 ? { stand: f2 } : null;
        rebuildSeat(r.i);
        if (f2 <= 0) {
          r.state = "done";
          G2.standI = -1;
          rs.crazy = false;
          rebuildSeat(r.i);
        }
      }
    }
    var sh = G2.shout;
    if (sh && !sh.count && !seats[sh.i].found && playT >= 5e3 && inView(seats[sh.i], 0.85, 0.85)) {
      shoutLine(seats[sh.i]);
      sh.count = 1;
    }
    var w = G2.sw;
    if (w) {
      var ws = seats[w.i];
      if (w.state === "wait" && playT > 6e3 && inView(ws, 0.6, 0.6)) {
        w.state = "toMine";
        w.t0 = now;
        w.swapped = false;
        sayText(ws, "嗚哇快換扇子！", "#2a6fdb", "#7fb8ff");
      }
      if (w.state === "toMine" || w.state === "toBack") {
        var u = (now - w.t0) / SW_TIME;
        if (now >= w.sweatAt) {
          sweat(ws);
          w.sweatAt = now + 220;
        }
        if (u >= 0.5 && !w.swapped) {
          w.swapped = true;
          if (w.state === "toMine") {
            G2.swapI = w.i;
            ws.found = false;
            G2.keep[w.i] = 1;
          } else G2.swapI = -1;
          assignFans();
          rebuildSeat(w.i);
          updateZoneLights();
          refreshFans();
        }
        ws.pose = u < 1 ? { bow: Math.sin(Math.min(1, u) * Math.PI) } : null;
        rebuildSeat(w.i);
        if (u >= 1) {
          if (w.state === "toMine") {
            w.state = "mine";
            w.t0 = now;
          } else w.state = "done";
        }
      } else if (w.state === "mine" && now - w.t0 >= SW_HOLD) {
        w.state = "toBack";
        w.t0 = now;
        w.swapped = false;
        sayText(ws, "走心了走心了", "#555", "#aaa");
        gainAch("d", "他走心了……", true);
      }
    }
  }
  function settleSpecials() {
    endCalm();
    clearAngry();
    hideNotice();
    if (G2.v101 && G2.ach) {
      var A = G2.ach;
      if (G2.rb && G2.rb.violated && !A.a) A.a = "fail";
      if (G2.shout && G2.shout.count && !A.b) A.b = "fail";
      if (G2.bh && G2.bh.used && !A.c) A.c = "fail";
      if (G2.sw && (G2.sw.state === "mine" || G2.sw.state === "toBack" || G2.sw.state === "done") && !A.d) A.d = "fail";
    }
    G2.shout = null;
    [G2.rb, G2.sw].forEach(function(o) {
      if (!o) return;
      var s = seats[o.i];
      s.crazy = false;
      if (s.pose) {
        s.pose = null;
        rebuildSeat(o.i);
      }
      if (o.state !== "wait" && o.state !== "won") o.state = "done";
    });
    G2.standI = -1;
  }
  function startStand(now) {
    var r = G2.rb, s = seats[r.i];
    r.state = "stand";
    r.t0 = now;
    r.until = now + 6e3;
    G2.conv[r.i] = G2.member;
    G2.standI = r.i;
    G2.shirtI = r.i;
    s.found = false;
    s.pose = { stand: 0 };
    s.crazy = true;
    assignFans();
    rebuildSeat(r.i);
    updateZoneLights();
    refreshFans();
    s.amp = 1.6;
    G2.angry = [];
    var fx0 = -Math.sin(s.rot), fz0 = -Math.cos(s.rot);
    seats.forEach(function(q, k) {
      if (q === s || !seatOcc(q) || !near3(s, q)) return;
      if ((q.pos.x - s.pos.x) * fx0 + (q.pos.z - s.pos.z) * fz0 > 0.12) return;
      showMood(q, "❗");
      q.angryAt = now + 700 + Math.random() * 500;
      q.angryFace = ["😠", "😤", "💢"][k % 3];
      G2.angry.push(q);
    });
    toast("有粉絲站起來大力揮舞你的應援物！周圍的人好像不太高興……");
  }
  function clearAngry() {
    (G2.angry || []).forEach(function(q) {
      q.angryAt = 0;
      if (q.mood) {
        moodGroup.remove(q.mood);
        q.mood = null;
      }
    });
    G2.angry = [];
  }
  function startCalm() {
    var r = G2.rb;
    if (!r) return;
    $("calmLeft").textContent = "待冷靜還有 " + Math.max(0, (r.until - performance.now()) / 1e3).toFixed(1) + " 秒";
    $("calm").hidden = false;
  }
  function endCalm() {
    $("calm").hidden = true;
  }
  var noticeTimer = 0;
  function showNotice(main, sub, fail) {
    $("noticeMain").textContent = main;
    $("noticeSub").textContent = sub || "";
    $("noticeSub").hidden = !sub;
    $("notice").classList.toggle("fail", !!fail);
    $("notice").hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(hideNotice, 2600);
  }
  function hideNotice() {
    $("notice").hidden = true;
  }
  function gainAch(key, main, fail) {
    if (!G2.ach || G2.ach[key]) {
      if (main) showNotice(main);
      return;
    }
    G2.ach[key] = fail ? "fail" : "win";
    if (fail) SFX.miss();
    else SFX.found();
    showNotice(main || (fail ? "失敗了……" : "成就達成！"), fail ? "💔 #" + ACHS[key].fail : "🏆 #" + ACHS[key].win, fail);
  }
  function specialPre(s) {
    var r = G2.rb, b = G2.bh, w = G2.sw, sh = G2.shout, post = {};
    if (r && r.state === "stand" && s.i === r.i) {
      r.violated = true;
      G2.combo = 0;
      startCalm();
      SFX.miss();
      missMark(s);
      return "stop";
    }
    if (w && s.i === w.i && (w.state === "toMine" || w.state === "toBack")) return "stop";
    if (b && b.left > 0 && s.i !== b.i && near3(seats[b.i], s)) {
      absorbHeart(s);
      return "stop";
    }
    if (s.found) return null;
    if (r && s.i === r.i && (r.state === "sit" || r.state === "done")) post.a = 1;
    if (sh && s.i === sh.i && sh.count > 0) post.b = 1;
    if (b && b.left === 0 && b.used && isTarget(s) && near3(seats[b.i], s)) post.c = 1;
    if (w && s.i === w.i && w.state === "mine") post.d = 1;
    return post;
  }
  function specialPost(s, post) {
    if (!s.found) return;
    if (post.d) {
      var w = G2.sw;
      w.state = "won";
      G2.keep[w.i] = 1;
      sayText(s, "增推！", "#c2185b", "#ff6fa8");
      gainAch("d", "抓住了！他增推你了");
    }
    if (post.a) {
      if (G2.rb.violated) gainAch("a", "剛剛不該飯撒他的……", true);
      else gainAch("a", "請做個好實實粉絲");
    }
    if (post.b) gainAch("b", "聽到了！");
    if (post.c) {
      sayText(seats[G2.bh.i], "唉呀術式融斷了...", "#5b1a9e", "#b06cff");
      gainAch("c", "終於把飯撒送到了！");
    }
  }
  function sayText(s, text, ink, edge, grow) {
    if (!s) return;
    var c = document.createElement("canvas"), x = c.getContext("2d"), fs = 64;
    x.font = "900 " + fs + "px " + FONT_STACK;
    var tw = Math.ceil(x.measureText(text).width), W = tw + 80, Hh = 132;
    c.width = W;
    c.height = Hh + 26;
    x.fillStyle = "#fff";
    x.strokeStyle = edge || "#ff6fa8";
    x.lineWidth = 8;
    x.beginPath();
    x.moveTo(30, 6);
    x.lineTo(W - 30, 6);
    x.quadraticCurveTo(W - 6, 6, W - 6, 30);
    x.lineTo(W - 6, Hh - 24);
    x.quadraticCurveTo(W - 6, Hh, W - 30, Hh);
    x.lineTo(W / 2 + 18, Hh);
    x.lineTo(W / 2, Hh + 22);
    x.lineTo(W / 2 - 18, Hh);
    x.lineTo(30, Hh);
    x.quadraticCurveTo(6, Hh, 6, Hh - 24);
    x.lineTo(6, 30);
    x.quadraticCurveTo(6, 6, 30, 6);
    x.closePath();
    x.fill();
    x.stroke();
    x.font = "900 " + fs + "px " + FONT_STACK;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = ink || "#c2185b";
    x.fillText(text, W / 2, Hh / 2 + 4);
    var mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    var sp = new THREE.Sprite(mat);
    sp.renderOrder = 13;
    fxGroup.add(sp);
    fxList.push({ kind: "say", sp, seat: s, asp: c.width / c.height, born: performance.now(), life: grow ? 3200 : 2400, grow });
  }
  function shoutLine(s) {
    var m = TEAMS[S.team].members[G2.member];
    sayText(s, pickOne(SHOUT_SPECIAL[m.n] || SHOUT_LINES).replace("{nick}", m.nick), null, null, true);
  }
  var sweatTex = canvasTex(32, function(x) {
    x.fillStyle = "#bfe6ff";
    x.beginPath();
    x.moveTo(16, 2);
    x.quadraticCurveTo(28, 18, 22, 26);
    x.quadraticCurveTo(16, 31, 10, 26);
    x.quadraticCurveTo(4, 18, 16, 2);
    x.fill();
    x.fillStyle = "rgba(255,255,255,.85)";
    x.beginPath();
    x.arc(13, 19, 3, 0, 6.3);
    x.fill();
  });
  function sweat(s) {
    headWorld(s, hw);
    for (var q = 0; q < 2; q++) {
      var sg = Math.random() < 0.5 ? -1 : 1;
      fxList.push({ kind: "drop", sp: fxSprite(sweatTex, 16777215), p: hw.clone().add(new THREE.Vector3(sg * 0.08, 0.1, 0)), v: new THREE.Vector3(sg * (0.4 + Math.random() * 0.4), 0.7 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3), born: performance.now(), life: 650 });
    }
  }
  var shirt = null;
  function placeShirt() {
    var i = G2 ? G2.shirtI : -1, s = i >= 0 ? seats[i] : null;
    var on = !!(s && s.shirtM && seatOcc(s) && (G2.on || G2.phase === "result"));
    if (!shirt) {
      if (!on) return;
      var c = document.createElement("canvas");
      c.width = 512;
      c.height = 128;
      var mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false, toneMapped: false });
      var ms = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), mat);
      ms.matrixAutoUpdate = false;
      ms.renderOrder = 3;
      scene.add(ms);
      shirt = { m: ms, c, txt: "", t: new THREE.Matrix4() };
    }
    shirt.m.visible = on;
    if (!on) return;
    var nick = TEAMS[S.team].members[G2.member].nick;
    if (shirt.txt !== nick) {
      var x = shirt.c.getContext("2d");
      x.clearRect(0, 0, 512, 128);
      var fs = 96;
      x.font = "900 " + fs + "px " + FONT_STACK;
      while (x.measureText(nick).width > 480 && fs > 30) {
        fs -= 6;
        x.font = "900 " + fs + "px " + FONT_STACK;
      }
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.lineWidth = 10;
      x.strokeStyle = "rgba(0,0,0,.55)";
      x.strokeText(nick, 256, 66);
      x.fillStyle = "#fff6e0";
      x.fillText(nick, 256, 66);
      shirt.m.material.map.needsUpdate = true;
      shirt.txt = nick;
    }
    var k = s.shirtK || 1;
    shirt.m.matrix.copy(s.shirtM).multiply(shirt.t.makeScale(0.26 * k, 0.26 * k, 1));
    shirt.m.matrixWorldNeedsUpdate = true;
  }
  var holeTex = canvasTex(128, function(x, n) {
    var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.32, "rgba(6,0,14,1)");
    g.addColorStop(0.46, "rgba(120,40,220,.95)");
    g.addColorStop(0.6, "rgba(255,110,220,.55)");
    g.addColorStop(1, "rgba(120,40,220,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, n, n);
    x.strokeStyle = "rgba(220,170,255,.75)";
    x.lineWidth = 3;
    for (var a = 0; a < 4; a++) {
      x.beginPath();
      for (var u = 0; u <= 1.001; u += 0.05) {
        var ang = a * Math.PI / 2 + u * 4.2, rr = 22 + u * 38;
        x.lineTo(64 + Math.cos(ang) * rr, 64 + Math.sin(ang) * rr);
      }
      x.stroke();
    }
  });
  function absorbHeart(s) {
    var bh = G2.bh, b = seats[bh.i], now = performance.now();
    bh.left--;
    bh.used++;
    bh.glowUntil = now + 1700;
    camera.getWorldDirection(fwd);
    var from = camera.position.clone().addScaledVector(fwd, 0.45);
    from.y -= 0.12;
    headWorld(s, hw);
    var via = hw.clone();
    via.y += 0.35;
    headWorld(b, hw);
    var to = hw.clone();
    to.y += 0.05;
    var hm = new THREE.SpriteMaterial({ map: holeTex, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    var hs = new THREE.Sprite(hm);
    hs.renderOrder = 11;
    fxGroup.add(hs);
    fxList.push({ kind: "hole", sp: hs, c: to, born: now, life: 1600 });
    fxList.push({ kind: "suck", sp: fxSprite(heartTex, 16777215), from, via, to, born: now, life: 1150 });
    blowKiss();
    SFX.kiss();
    setTimeout(function() {
      SFX.miss();
    }, 900);
    sayText(b, BH_LINES[Math.min(bh.used, BH_LINES.length) - 1], "#5b1a9e", "#b06cff");
    showNotice("飯撒被黑洞吸走了！", bh.left ? "黑洞能力剩餘 " + bh.left + " 次" : "黑洞能力消失了");
  }
  var glasses = null;
  function makeGlasses() {
    var g = new THREE.Group();
    g.matrixAutoUpdate = false;
    var fm = new THREE.MeshPhongMaterial({ color: 1118484, shininess: 60, emissive: 0 });
    var lm = new THREE.MeshBasicMaterial({ color: 10475775, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false });
    [-1, 1].forEach(function(sg) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 55e-4, 6, 20), fm);
      ring.position.set(sg * 0.03, 0, 0);
      g.add(ring);
      var lens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 18), lm);
      lens.position.set(sg * 0.03, 0, -1e-3);
      lens.rotation.y = Math.PI;
      g.add(lens);
      var arm = new THREE.Mesh(new THREE.BoxGeometry(5e-3, 6e-3, 0.09), fm);
      arm.position.set(sg * 0.056, 4e-3, 0.045);
      g.add(arm);
    });
    var br = new THREE.Mesh(new THREE.BoxGeometry(0.014, 5e-3, 5e-3), fm);
    br.position.set(0, 8e-3, 0);
    g.add(br);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 12185855, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    halo.scale.set(0.3, 0.16, 1);
    halo.position.set(0, 0, -0.02);
    g.add(halo);
    scene.add(g);
    glasses = { g, fm, lm, halo, t: new THREE.Matrix4() };
  }
  function placeGlasses(now) {
    var bh = G2 && G2.bh, s = bh && seats[bh.i];
    var on = !!(s && s.headM && seatOcc(s) && (G2.on || G2.phase === "countdown" || G2.phase === "result"));
    if (!glasses) {
      if (!on) return;
      makeGlasses();
    }
    glasses.g.visible = on;
    if (!on) return;
    var k = s.gk;
    glasses.g.matrix.copy(s.headM).multiply(glasses.t.makeTranslation(0, s.ghc + 8e-3 * k, s.ghz - 0.09 * k)).multiply(glasses.t.makeScale(k, k, k));
    glasses.g.matrixWorldNeedsUpdate = true;
    var gl = bh.glowUntil > now ? Math.min(1, (bh.glowUntil - now) / 400) * (0.75 + 0.25 * Math.sin(now / 45)) : 0;
    glasses.fm.emissive.setRGB(0.5 * gl, 0.85 * gl, 1 * gl);
    glasses.lm.color.setRGB(0.62 + 0.38 * gl, 0.85 + 0.15 * gl, 1);
    glasses.lm.opacity = 0.28 + 0.6 * gl;
    glasses.halo.material.opacity = gl;
  }
  var ribbonRecords;
  try {ribbonRecords=RibbonRecords.create(window.localStorage);}
  catch(error) {ribbonRecords=RibbonRecords.create({getItem:function(){return null;},setItem:function(){throw error;}});}
  var RIBBON = {
    active: false, phase: "idle", attempts: 0, hits: 0, perfect: 0, misses: 0,
    combo: 0, bestCombo: 0, score: 0, results: [], targets: [], used: new Set(),
    target: null, flight: null, settled: [], window: null, gesture: null, nextAt: 0, cdStart: 0, lastCd: 0,
    lastFrame: 0, pausedAt: 0, finishReason: "", color: "#f2b25c", power: 0
  };
  var ribbonMark = $("ribbonTargetMark"), ribbonPreview = $("ribbonPreview");
  var ribbonCtx = ribbonPreview.getContext("2d"), ribbonWorld = new THREE.Vector3();
  var ribbonProject = new THREE.Vector3(), ribbonHead = new THREE.Vector3();
  var RIBBON_MAX = 200, RIBBON_SEGMENT = 0.12, RIBBON_DT = 1 / 120;
  var RIBBON_PHYSICS = { g: 9.8, air: 1.2, tapeLen: 30, rollMass: 0.025, rollCdA: 0.0013, pullForce: 0.02, liftA: 0.005, dragN: 11, dragT: 0.4, flutter: 0.45, inherit: 0.08, rollR: 0.03, vMin: 2, vMax: 9.4, elev0: 6, elev1: 32, yawGain: 0.25, yawDead: 2, tiltGain: 1.2, wildFrom: 50, reachR: 0.36, reachUp: 0.45, perfect: 0.3 };
  var RIBBON_ROUNDS=[{name:"第一輪",hits:5},{name:"挑戰輪",hits:7},{name:"決勝輪",hits:null}],RIBBON_ROUND_SIZE=10;
  function ribbonPrepareThrower() {
    var slot = RIBBON.order[RIBBON.attempts % RIBBON.order.length];
    RIBBON.slot = slot;
    G2.member = RIBBON.roster[slot];
    RIBBON.targets = seats.filter(isTarget);
    placePerformers(0);
    var performer = performers[slot], x = performer ? performer.g.position.x : 0, z = performer ? performer.g.position.z : STAGE_Z0 - .8;
    var h = S.perfH / 100;
    if(performer) performer.g.updateMatrixWorld(true);
    RIBBON.thrower = RIBBON.throwers ? RIBBON.throwers[slot] : {
      slot:slot,position:new THREE.Vector3(x,S.stageH,z),baseForAim:true,heading:0,
      eye:new THREE.Vector3(x,S.stageH+h*.935,z+.1),
      release:performer ? performer.elR.localToWorld(new THREE.Vector3(0,-.245,0)) : new THREE.Vector3(x,S.stageH+h*.97,z+.45),
      hold:performer ? performer.elL.localToWorld(new THREE.Vector3(0,-.245,0)) : new THREE.Vector3(x+.16,S.stageH+h*.62,z+.3)
    };
    var member = ribbonCastMember(G2.team,G2.member);
    ribbonLockInterception();RIBBON.color=ribbonThrowColor(member,RIBBON.attempts);
    placePerformers(0);if(RIBBON.world&&RIBBON.world.setActors)RIBBON.world.setActors(performers);
  }
  function ribbonAimThrower(thrower,target) {
    if(!thrower.baseForAim)return thrower;
    headWorld(target,ribbonHead);
    var heading=Math.atan2(ribbonHead.x-thrower.position.x,ribbonHead.z-thrower.position.z);
    function turned(point){return point.clone().sub(thrower.position).applyAxisAngle(YAX,heading).add(thrower.position);}
    return {slot:thrower.slot,position:thrower.position,zone:thrower.zone||"front",station:thrower.station||"front",heading:heading,baseForAim:false,eye:turned(thrower.eye),release:turned(thrower.release),hold:turned(thrower.hold)};
  }
  function ribbonFrontPositions() {
    var aRow=seats.filter(function(s){return !s.side&&s.row==="A";}),edge=Math.min(STAGE_W/2-.5,Math.max.apply(null,aRow.map(function(s){return Math.abs(s.pos.x);}))),intervals=[[-edge,edge]],clearance=PILLAR_W/2+Math.max(.25,.24*S.perfH/157);
    PILLARS.forEach(function(p){
      var next=[];intervals.forEach(function(range){
        if(p.x+clearance<=range[0] || p.x-clearance>=range[1]){next.push(range);return;}
        if(range[0]<p.x-clearance)next.push([range[0],p.x-clearance]);
        if(range[1]>p.x+clearance)next.push([p.x+clearance,range[1]]);
      });intervals=next;
    });
    var length=intervals.reduce(function(sum,range){return sum+range[1]-range[0];},0);
    return Array.from({length:6},function(_,i){
      var remaining=i*length/5;
      for(var k=0;k<intervals.length;k++){var range=intervals[k],size=range[1]-range[0];if(remaining<=size||k===intervals.length-1)return range[0]+remaining;remaining-=size;}
    });
  }
  function ribbonTargetZone(target) {return target.side?(target.pos.x<0?"left":"right"):"front";}
  function ribbonMakeStations() {
    var stations=ribbonFrontPositions().map(function(x,i){return {zone:"front",station:"front:"+i,position:new THREE.Vector3(x,S.stageH,STAGE_Z0-.8),heading:0};});
    var rear=SIDES.reduce(function(z,row){return Math.min(z,row[2]-(row[3]-1)*row[4]);},Infinity)+.17;
    ["left","right"].forEach(function(zone){for(var i=0;i<4;i++)stations.push({zone:zone,station:zone+":"+i,
      position:new THREE.Vector3((zone==="left"?-1:1)*(STAGE_W/2-2.08),S.stageH,STAGE_Z0-1.65+i*(rear-(STAGE_Z0-1.65))/3),heading:zone==="left"?-Math.PI/2:Math.PI/2});});
    return stations;
  }
  function ribbonStationsFor(slot,target) {return ribbonTargetZone(target)===RIBBON.stations[slot].zone?[RIBBON.throwers[slot]]:[];}
  function ribbonCastMember(team,member) {return TEAMS[team].members[member]||{n:"虛擬站位",nick:"舞台演出",c:["#f2b25c"]};}
  function ribbonCastColor(member) {return (member.c||[]).find(function(color){return /^#[0-9a-f]{6}$/i.test(color);})||"#f2b25c";}
  var RIBBON_PALETTE=["#ff4388","#ff9235","#f6c72f","#96cc32","#28bd88","#20bbd7","#397ee8","#7956d9","#bf58d6","#ee5d58","#3aaeb1","#e7e9f7"];
  function ribbonThrowColor(member,attempt) {
    if(RIBBON.throwColors[attempt])return RIBBON.throwColors[attempt];
    var color;
    if(attempt%3===0){var theme=new THREE.Color(ribbonCastColor(member)),hsl={};theme.getHSL(hsl);if(hsl.s>.08)theme.setHSL(hsl.h,Math.max(.7,hsl.s),.55);color="#"+theme.getHexString();}
    else color=RIBBON_PALETTE[(RIBBON.paletteOffset+attempt*5)%RIBBON_PALETTE.length];
    if(color===RIBBON.throwColors[attempt-1])color=RIBBON_PALETTE[(RIBBON.paletteOffset+attempt*5+3)%RIBBON_PALETTE.length];
    RIBBON.throwColors[attempt]=color;return color;
  }

  function ribbonAddCast() {
    var shared=new Set();
    scene.traverse(function(o){if(o.geometry)shared.add(o.geometry);var materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(function(m){if(m){shared.add(m);Object.keys(m).forEach(function(k){if(m[k]&&m[k].isTexture)shared.add(m[k]);});}});});
    RIBBON.castShared=shared;RIBBON.originalCastCount=performers.length;
    while(performers.length<14){var p=makePerformer(performers.length);performers.push(p);perfGroup.add(p.g);}
  }
  function ribbonRestoreCast() {
    if(!RIBBON.castShared)return;
    var owned=new Set(),shared=RIBBON.castShared;
    performers.splice(RIBBON.originalCastCount).forEach(function(p){perfGroup.remove(p.g);p.g.traverse(function(o){
      if(o.geometry&&!shared.has(o.geometry))owned.add(o.geometry);
      (Array.isArray(o.material)?o.material:[o.material]).forEach(function(m){if(m&&!shared.has(m)){owned.add(m);Object.keys(m).forEach(function(k){if(m[k]&&m[k].isTexture&&!shared.has(m[k]))owned.add(m[k]);});}});
    });});
    owned.forEach(function(resource){resource.dispose();});RIBBON.castShared=null;RIBBON.stations=null;RIBBON.heldThrowers={};
    placePerformers(0);
  }
  function ribbonReceiverSnapshot(){return RIBBON.crowd?Array.from(RIBBON.crowd.entries.values()).filter(function(e){return e.caught;}).map(function(e){return e.seat.i;}):[];}
  function ribbonCanReceive(seat,receivers){if(receivers)return !receivers.includes(seat.i);var e=RIBBON.crowd&&RIBBON.crowd.entries.get(seat.i);return !e||!e.caught;}
  function ribbonPickupRowAllowed(seat,point){
    if(!seat.side)return seat.st===0||point.z>=seat.pos.z-ROW_PITCH/2;
    var row=SIDES.find(function(r){return r[0]===seat.row;});return !!row&&(row[6]===0||Math.abs(point.x)>=Math.abs(seat.pos.x)-ROW_PITCH/2);
  }
  function ribbonCandidateSeats() {
    var front = RIBBON.targets.filter(function(s) {
      var row = FRONT.findIndex(function(r) { return r[0] === s.row; });
      return ribbonTargetZone(s)===RIBBON.stations[RIBBON.slot].zone && (s.side || row >= 0 && row <= 2) && s.i !== S.my && ribbonCanReceive(s);
    });
    return front;
  }
  function ribbonSideCandidateOrder(options,slot,random) {
    var station=RIBBON.stations[slot],front=station.zone==="front";
    if(front){
      function angle(s){return Math.abs(Math.atan2(s.pos.x-station.position.x,s.pos.z-station.position.z));}
      var outer=(random===undefined?Math.random():random)>=.92,pool=options.filter(function(s){return outer?angle(s)>Math.PI/4:angle(s)<=Math.PI/4;});
      var rowPick=Math.random(),preferredRow=rowPick<.45?"A":rowPick<.9?"B":"C";
      function rowRank(s){return s.row===preferredRow?0:s.row==="C"?2:1;}
      var ranks=pool.map(function(s){return {seat:s,key:-Math.log(Math.max(1e-9,Math.random()))/(outer?Math.exp(-(angle(s)-Math.PI/4)/.35):1)};});
      var fans=new Set(RIBBON.targets.map(function(s){return s.i;}));ranks.sort(function(a,b){return rowRank(a.seat)-rowRank(b.seat)||Number(RIBBON.used.has(a.seat.i))-Number(RIBBON.used.has(b.seat.i))||Number(!fans.has(a.seat.i))-Number(!fans.has(b.seat.i))||a.key-b.key;});
      var chosen=new Set(pool.map(function(s){return s.i;}));return ranks.map(function(r){return r.seat;}).concat(options.filter(function(s){return !chosen.has(s.i);}));
    }
    if((random===undefined?Math.random():random)>=.8)return options;
    var fans=new Set(RIBBON.targets.map(function(s){return s.i;}));
    var direct=options.filter(function(s){return Math.abs(front?Math.atan2(s.pos.x-station.position.x,Math.abs(s.pos.z-station.position.z)):Math.atan2(s.pos.z-station.position.z,Math.abs(s.pos.x-station.position.x)))<=(front?Math.PI/4:Math.PI/6);});
    direct.sort(function(a,b){return Number(RIBBON.used.has(a.i))-Number(RIBBON.used.has(b.i)) || Number(!fans.has(a.i))-Number(!fans.has(b.i)) || Math.abs(a.pos.z-station.position.z)-Math.abs(b.pos.z-station.position.z);});
    var selected=new Set(direct.map(function(s){return s.i;}));return direct.concat(options.filter(function(s){return !selected.has(s.i);}));
  }
  async function ribbonPickTarget(session) {
    var options = ribbonCandidateSeats().filter(function(s) { return !RIBBON.used.has(s.i); });
    if (!options.length) {
      options = ribbonCandidateSeats();
    }
    for(var j=options.length-1;j>0;j--){var swap=Math.floor(Math.random()*(j+1)),item=options[j];options[j]=options[swap];options[swap]=item;}
    var remaining = ribbonCandidateSeats().filter(function(s){ return RIBBON.used.has(s.i) && !options.includes(s); });
    options = options.concat(remaining);
    var included = new Set(options.map(function(s){return s.i;}));
    // Prefer this member's fans, then retry other real spectators as in the reference.
    options = options.concat(seats.filter(function(s){return !included.has(s.i) && s.i!==S.my && ribbonCanReceive(s) && seatOcc(s) && (s.side || s.st<=2) && ribbonTargetZone(s)===RIBBON.stations[RIBBON.slot].zone;}).sort(function(){return Math.random()-.5;}));
    options=ribbonSideCandidateOrder(options,RIBBON.slot);
    if(RIBBON.egg&&RIBBON.egg.armed&&RIBBON.egg.attempt===RIBBON.attempts){var quiet=options.filter(function(s){return !s.light&&!s.fan&&!s.towel&&(G2.member===null||s.oshi===G2.member);}),quietIds=new Set(quiet.map(function(s){return s.i;}));options=quiet.concat(options.filter(function(s){return !quietIds.has(s.i);}));}
    for (var i = 0; i < options.length; i++) {
      var target = options[i];
      var stations=ribbonStationsFor(RIBBON.slot,target);
      for(var station=0;station<stations.length;station++) {
        var context=stations[station],win=await ribbonWindowFor(session,RIBBON.slot,target,context);
        if (!RIBBON.active || RIBBON.session !== session) return null;
        if (win) return {target:target,window:win,thrower:context};
      }
    }
    return null;
  }
  async function ribbonWindowFor(session,slot,target,thrower) {
    if(!RIBBON.active || RIBBON.session!==session||!ribbonCanReceive(target))return null;
    var key=RIBBON.attempts+":"+slot+":"+(thrower.station||"front")+":"+target.i+":"+(RIBBON.world.actorRevision?RIBBON.world.actorRevision():0)+":"+ribbonReceiverSnapshot().join(",")+":"+(RIBBON.challenge?[RIBBON.challenge.active,RIBBON.challenge.seed].join(","):"none"),cache=RIBBON.windowCache,pending=RIBBON.windowTasks;
    if(cache.has(key))return cache.get(key);
    if(pending.has(key))return pending.get(key);
    var task=ribbonFindWindow(session,target,thrower).then(function(win){
      if(RIBBON.active && RIBBON.session===session) {
        cache.set(key,win);
        if(win) {
          if(!target.side && target.st<4)RIBBON.reachableRows[slot*4+target.st]=true;
          if(RIBBON.roster[slot]!==null)ribbonRecords.setAvailable(G2.team,RIBBON.roster[slot],target.row,true);
        }
      }
      return win;
    }).finally(function(){pending.delete(key);});
    pending.set(key,task);return task;
  }
  async function ribbonExploreRecords(session) {
    var contexts=RIBBON.throwers,roster=RIBBON.roster.slice(),team=G2.team;
    var rows='ABCNOPQ';
    for(var slot=0;slot<roster.length;slot++)for(var row=0;row<rows.length;row++) {
      if(!RIBBON.active || RIBBON.session!==session)return;
      if(roster[slot]===null)continue;
      var label=rows[row],context=contexts[slot];
      var candidates=seats.filter(function(s){return s.row===label&&ribbonTargetZone(s)===context.zone&&s.i!==S.my&&seatOcc(s);});
      candidates.sort(function(a,b){return a.pos.distanceToSquared(context.eye)-b.pos.distanceToSquared(context.eye);});
      var found=false,temporary=false;
      for(var i=0;i<candidates.length;i++) {
        if(!ribbonCanReceive(candidates[i])){temporary=true;continue;}
        var win=await ribbonWindowFor(session,slot,candidates[i],context);
        if(!RIBBON.active || RIBBON.session!==session)return;
        if(win){found=true;break;}
      }
      // Holding a ribbon is temporary; it must not erase a reachable collection cell.
      if(found||!temporary)ribbonRecords.setAvailable(team,roster[slot],label,found||'ABC'.includes(label)&&RIBBON.reachableRows[slot*4+'ABC'.indexOf(label)]===true);
    }
    if(!RIBBON.active || RIBBON.session!==session)return;
    RIBBON.recordsReady=true;ribbonRecords.collection(team,roster.filter(function(m){return m!==null;}));ribbonRecords.save();
  }
  function ribbonShowRecords() {
    var inRun=RIBBON.active||RIBBON.phase==="result",team=inRun?G2.team:+$("gTeam").value;
    var start=+$("gMember").value,roster=inRun?RIBBON.roster:Array.from({length:14},function(_,i){return i<TEAMS[team].members.length?(start+i)%TEAMS[team].members.length:null;});
    var summary=ribbonRecords.collection(team,roster.filter(function(m){return m!==null;})),snapshot=ribbonRecords.snapshot();
    $("ribbonRecordSummary").textContent="最高命中 "+snapshot.bestHit+" 次 · 該次完美 "+snapshot.bestPerfect+" 次 · 累計送達 "+snapshot.hits+" 次／完美 "+snapshot.perfects+" 次 · 已探索 "+summary.known+"/"+summary.total+" 格";
    var html='<table class="ribbon-record-grid"><thead><tr><th scope="col">排</th>'+roster.map(function(member){return '<th scope="col"><span>'+esc(ribbonCastMember(team,member).n)+'</span></th>';}).join('')+'</tr></thead><tbody>';
    'ABCDNOPQ'.split('').forEach(function(row){html+='<tr><th scope="row">'+row+(row==='D'?'（歷史）':'')+(SIDE_NAME[row]?'（'+SIDE_NAME[row]+'）':'')+'</th>'+roster.map(function(member){var a=row==='D'?false:ribbonRecords.available(team,member,row),value=row==='D'?ribbonRecords.get(team,member,row):a===false?0:ribbonRecords.get(team,member,row);return '<td class="'+(value===2?'pf':value?'got':a===false?'no':'')+'" aria-label="'+esc(ribbonCastMember(team,member).n)+' '+row+'排 '+(value===2?'完美':value?'命中':row==='D'?'歷史記錄（不列入新收藏）':a===null?'尚未探索':a?'可達':'本次不可達')+'">'+(value===2?'★':value?'●':row==='D'?'—':a===null?'—':a?'○':'×')+'</td>';}).join('')+'</tr>';});
    $("ribbonRecordGrid").innerHTML=html+'</tbody></table>';
    $("ribbonTitles").innerHTML=ribbonRecords.titles.map(function(title){return '<div class="'+(snapshot.titles.includes(title[0])?'on':'')+'">'+esc(title[1])+'<small>'+esc(title[2])+'</small></div>';}).join('');
    $("ribbonStorageStatus").textContent=ribbonRecords.warning();
    if(!$("ribbonRecordDialog").open)$("ribbonRecordDialog").showModal();
  }
  function ribbonFaceTarget() {
    if (!RIBBON.target) return;
    headWorld(RIBBON.target, ribbonWorld);ribbonWorld.y+=.25;
    eyePos(eye);
    S.yaw = Math.atan2(eye.x - ribbonWorld.x, eye.z - ribbonWorld.z);
    S.pitch=Math.atan2(ribbonWorld.y-eye.y,Math.hypot(ribbonWorld.x-eye.x,ribbonWorld.z-eye.z));
    updateCamera();
  }
  function ribbonCandidateVisible(thrower,target,actors) {
    var aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight),base=Math.max(56,Math.min(86,2*Math.atan(Math.tan(34*Math.PI/180)/aspect)*180/Math.PI));
    if(thrower.zone&&thrower.zone!=="front")base=70;
    var view=new THREE.PerspectiveCamera(S.fov*base/IDOL_FOV,aspect,.05,80),point=new THREE.Vector3();
    headWorld(target,point);point.y+=.25;
    if(RIBBON.world.blocked&&RIBBON.world.blocked(thrower.eye,point,thrower.slot,actors))return false;
    view.position.copy(thrower.eye);view.lookAt(point);view.updateMatrixWorld(true);point.copy(thrower.release).project(view);
    return point.z>-1&&point.z<1&&Math.abs(point.x)<.85&&Math.abs(point.y)<.85;
  }
  function ribbonTargetVisible() {
    if(!RIBBON.active || RIBBON.phase!=="play" || !RIBBON.target || !RIBBON.thrower)return false;
    updateCamera();camera.updateMatrixWorld(true);
    headWorld(RIBBON.target,ribbonProject);
    if(RIBBON.world.blocked&&RIBBON.world.blocked(camera.position,ribbonProject,RIBBON.slot))return false;
    ribbonProject.project(camera);
    var w=canvas.clientWidth,h=canvas.clientHeight;
    if(ribbonProject.z<=-1||ribbonProject.z>=1||Math.abs(ribbonProject.x)>1-48/w||Math.abs(ribbonProject.y)>1-48/h)return false;
    var bounds=canvas.getBoundingClientRect(),hud=$("ribbonHud").getBoundingClientRect(),x=bounds.left+(ribbonProject.x+1)*w/2,y=bounds.top+(1-ribbonProject.y)*h/2;
    if(!$("ribbonHud").hidden && x>=hud.left-20 && x<=hud.right+20 && y>=hud.top-20 && y<=hud.bottom+20)return false;
    ribbonHead.copy(RIBBON.thrower.release).project(camera);
    return ribbonHead.z>-1&&ribbonHead.z<1&&Math.abs(ribbonHead.x)<.95&&Math.abs(ribbonHead.y)<.95;
  }
  function ribbonRequireVisibleTarget() {
    if(ribbonTargetVisible())return true;
    ribbonCancelGesture();ribbonSetPower(0);S.fov=IDOL_FOV;ribbonFaceTarget();ribbonUpdateMarker();
    if(!ribbonTargetVisible())ribbonStartPlay(performance.now());
    toast("目標不在可投擲視線內，這次未投出；已重新對準或準備新目標。");return false;
  }
  async function ribbonYieldSearch(session) {
    await new Promise(function(resolve){setTimeout(resolve,0)});
    while(document.hidden && RIBBON.active && RIBBON.session===session)
      await new Promise(function(resolve){setTimeout(resolve,100)});
  }
  async function ribbonFindWindow(session, target, thrower) {
    if(!ribbonCanReceive(target))return null;
    thrower=ribbonAimThrower(thrower || RIBBON.thrower,target);
    var receivers=ribbonReceiverSnapshot();
    var actors=RIBBON.world.snapshotActors?RIBBON.world.snapshotActors():null,challenge=RIBBON.challenge?Object.assign({},RIBBON.challenge):null,bodies=RIBBON.world.snapshotBodies?RIBBON.world.snapshotBodies():null;
    if(!ribbonCandidateVisible(thrower,target,actors))return null;
    headWorld(target,ribbonHead);
    if(RIBBON.world.blocked && RIBBON.world.blocked(thrower.eye,ribbonHead,thrower.slot,actors))return null;
    var searchState={receivers:receivers,bodies:bodies,challenge:challenge};
    var best = [], run = [], danger = 1.35;
    for (var i = 0; i <= 120; i++) {
      if(i % 8 === 0) {
        await ribbonYieldSearch(session);
        if(!RIBBON.active || RIBBON.session !== session) return null;
      }
      var power = 1.35 * i / 120, shot = ribbonBuildLaunch(power, 0, target, thrower);
      var f = {receivers:receivers,bodies:bodies,interceptors:ribbonInterceptors(shot,target,thrower,challenge), owner:thrower.slot,actors:actors,roll: shot.origin.clone(), velocity: shot.velocity.clone(), tilt: shot.tilt, paid: 0, apex: shot.origin.y, hit: false, time: 0 };
      var outcome = null;
      for (var k = 0; k < 960; k++) {
        var result = ribbonStepRoll(f, target);
        outcome = result.caught;
        if (result.done) break;
      }
      if (f.hit && power < danger) danger = power;
      if (outcome && outcome.seat === target) {
        run.push({ u: power, perfect: outcome.distance < RIBBON_PHYSICS.perfect && !outcome.pickup && !f.hit && !f.snag });
        if(run.length > best.length) best = run.slice();
      } else run = [];
    }
    if (best.length < 5) return null;
    var pf = [], pfRun = [];
    best.forEach(function(v){
      if(v.perfect) { pfRun.push(v); if(pfRun.length > pf.length) pf = pfRun.slice(); }
      else pfRun = [];
    });
    var lo = best[0].u, hi = best[best.length-1].u, mid=(lo+hi)/2;
    var aimLo=0, aimHi=0;
    for (var angle=-1;angle>=-30;angle--) {
      if(angle%4===0) {await ribbonYieldSearch(session);if(!RIBBON.active || RIBBON.session!==session)return null;}
      if (!ribbonPredict(mid,angle,target,thrower,actors,searchState).ok) break;
      aimLo=angle;
    }
    for (var angle=1;angle<=30;angle++) {
      if(angle%4===0) {await ribbonYieldSearch(session);if(!RIBBON.active || RIBBON.session!==session)return null;}
      if (!ribbonPredict(mid,angle,target,thrower,actors,searchState).ok) break;
      aimHi=angle;
    }
    if(aimLo > -3 || aimHi < 3) return null;
    return { lo:lo, hi:hi, mid:mid, aimLo:aimLo, aimHi:aimHi, danger:danger, pfLo: pf.length ? pf[0].u : null, pfHi: pf.length ? pf[pf.length-1].u : null };
  }
  function ribbonPredict(power,angle,target,thrower,actors,state) {
    var shot=ribbonBuildLaunch(power,angle,target,thrower);
    var f={receivers:state?state.receivers:ribbonReceiverSnapshot(),bodies:state?state.bodies:(RIBBON.world.snapshotBodies?RIBBON.world.snapshotBodies():null),interceptors:ribbonInterceptors(shot,target,thrower||RIBBON.thrower,state?state.challenge:undefined),owner:(thrower||RIBBON.thrower).slot,actors:actors||(RIBBON.world.snapshotActors?RIBBON.world.snapshotActors():null),roll:shot.origin.clone(),velocity:shot.velocity.clone(),tilt:shot.tilt,paid:0,apex:shot.origin.y,hit:false,time:0}, result;
    for(var i=0;i<960;i++){result=ribbonStepRoll(f,target);if(result.done)break;}
    return {ok:!!result.caught && result.caught.seat===target,perfect:!!result.caught && result.caught.seat===target && !f.hit && !result.caught.pickup && result.caught.distance<RIBBON_PHYSICS.perfect,hit:f.hit};
  }

  function ribbonPowerOf(speed) {
    var u = Math.max(0, Math.min(1, (speed - 0.5) / (7 - 0.5)));
    return 1.35 * Math.pow(u, 0.75);
  }
  function ribbonMetrics(g, last) {
    var pts = g.points.slice();
    if (last) pts.push(last);
    if (pts.length < 2) return { speed: 0, alpha: 0, travel: 0, power: 0 };
    var end = pts[pts.length - 1], i = pts.length - 1;
    while (i > 0 && end.t - pts[i - 1].t <= 100) i--;
    var first = pts[i], elapsed = Math.max(16, end.t - first.t) / 1000;
    var dx = end.x - first.x, dy = end.y - first.y;
    var speed = Math.hypot(dx, dy) / elapsed / Math.max(1, $("view").clientHeight);
    return { speed: speed, alpha: Math.atan2(dx, -dy) * 180 / Math.PI,
      travel: Math.hypot(end.x - g.x0, end.y - g.y0) / Math.max(1, $("view").clientHeight),
      power: ribbonPowerOf(speed) };
  }
  function ribbonAimOffset(deg) {
    var sign = Math.sign(deg), mag = Math.min(180, Math.abs(deg)), wild = RIBBON_PHYSICS.wildFrom;
    var offset = sign * Math.max(0, Math.min(mag, wild) - RIBBON_PHYSICS.yawDead) * Math.PI / 180;
    var normal = offset * RIBBON_PHYSICS.yawGain;
    return mag <= wild ? normal : sign * (Math.abs(normal) + (mag - wild) * (Math.PI - Math.abs(normal)) / (180 - wild));
  }
  function ribbonBuildLaunch(power, alpha, targetSeat, thrower) {
    targetSeat = targetSeat || RIBBON.target;
    if (!targetSeat) return null;
    headWorld(targetSeat, ribbonWorld);
    var target = ribbonWorld.clone();
    target.y += 0.22;
    var origin = ribbonAimThrower(thrower || RIBBON.thrower,targetSeat).release.clone();
    var dx = target.x - origin.x, dz = target.z - origin.z, dist = Math.hypot(dx, dz) || 1;
    var fx = dx / dist, fz = dz / dist, rawAlpha = alpha || 0, a = ribbonAimOffset(rawAlpha);
    var hx = fx * Math.cos(a) - fz * Math.sin(a), hz = fz * Math.cos(a) + fx * Math.sin(a);
    var u = Math.max(0, Math.min(1.35, power)), speed = RIBBON_PHYSICS.vMin + (RIBBON_PHYSICS.vMax - RIBBON_PHYSICS.vMin) * u;
    var elev = (RIBBON_PHYSICS.elev0 + RIBBON_PHYSICS.elev1 * u) * Math.PI / 180;
    var sign = Math.sign(rawAlpha), mag = Math.min(180, Math.abs(rawAlpha));
    var off = sign * Math.max(0, Math.min(mag, RIBBON_PHYSICS.wildFrom) - RIBBON_PHYSICS.yawDead) * Math.PI / 180;
    return { origin: origin, velocity: new THREE.Vector3(hx * speed * Math.cos(elev), speed * Math.sin(elev), hz * speed * Math.cos(elev)), tilt: off * RIBBON_PHYSICS.tiltGain };
  }
  function ribbonSetPower(power) {
    RIBBON.power = Math.max(0, Math.min(1.35, power || 0));
    var pct = 100 * RIBBON.power / 1.35;
    var win = RIBBON.phase === "play" ? RIBBON.window : null, band = $("ribbonPowerBand"), pf = $("ribbonPerfectBand");
    band.hidden = !win;
    pf.hidden = !win || win.pfLo === null;
    if(win) { band.style.left = (win.lo/1.35*100)+"%"; band.style.width = ((win.hi-win.lo)/1.35*100)+"%";
      if(win.pfLo !== null) {pf.style.left=(win.pfLo/1.35*100)+"%";pf.style.width=(Math.max(.012,win.pfHi-win.pfLo)/1.35*100)+"%";} }
    if (RIBBON.gesture && win && RIBBON.target) {
      var metrics=ribbonMetrics(RIBBON.gesture), predicted=ribbonPredict(RIBBON.power,metrics.alpha,RIBBON.target);
      $("ribbonHint").textContent=predicted.ok ? (predicted.perfect?"★ 這個力度與方向可完美接取":"○ 這個力度與方向可命中") : predicted.hit ? "⚠ 會碰到障礙物，請減輕力度或調整方向" : RIBBON.power<win.lo ? "力度偏弱，請更快速向上滑動" : RIBBON.power>win.hi ? "力度偏強，請減輕力度" : "方向偏離，請向上直滑或調整左右角度";
    }
    $("ribbonPowerFill").style.width = pct.toFixed(1) + "%";
    $("ribbonPowerFill").parentNode.setAttribute("aria-valuenow", String(Math.round(pct)));
  }
  function ribbonUpdateHud() {
    var member = ribbonCastMember(G2.team,G2.member);
    $("ribbonWho").textContent = "你是 " + member.n + "（" + member.nick + "）";
    var completed=RIBBON.attempts>0&&(RIBBON.flight&&RIBBON.flight.resolved||RIBBON.phase==="resultWait");
    var base=(RIBBON.roundIndex||0)*10,rule=RIBBON_ROUNDS[RIBBON.roundIndex||0];
    $("ribbonRound").textContent=rule.name+"・"+(rule.hits===null?"完成十投":"十投至少 "+rule.hits+" 中")+"（本輪 "+RIBBON.results.slice(base).filter(function(r){return r.ok;}).length+" 中）";
    $("ribbonTargetText").textContent = RIBBON.target ? "目標觀眾：" + seatLabel(RIBBON.target) + " · " + (RIBBON.thrower.zone==="left"?"舞台左側站位":RIBBON.thrower.zone==="right"?"舞台右側站位":"舞台正面站位") : "正在尋找下一位目標…";
    $("ribbonAttempt").textContent = String(RIBBON.attempts);
    $("ribbonHits").textContent = String(RIBBON.hits);
    $("ribbonPerfect").textContent = String(RIBBON.perfect);
    $("ribbonCombo").textContent = String(RIBBON.combo);
    $("ribbonDots").style.setProperty("--ribbon-color", RIBBON.color);
    var inRound = RIBBON.attempts-base, dots = [];
    for (var i = 0; i < RIBBON_ROUND_SIZE; i++) {
      var cls = i < inRound ? (RIBBON.results[base + i] && RIBBON.results[base + i].ok ? "hit" : "miss") : i === inRound && RIBBON.phase === "play" && !completed ? "now" : "";
      dots.push('<i class="' + cls + '"></i>');
    }
    $("ribbonDots").innerHTML = dots.join("");
    $("ribbonHint").textContent=RIBBON.phase==="selecting"?"正在準備下一投，請稍候…":rule.name+(rule.hits===null?"完成十投後結算，不設命中門檻":"十投至少 "+rule.hits+" 中")+"；綠色可命中，黃色可完美接取。";
    if(RIBBON.roundIndex>=1&&RIBBON.challenge)$("ribbonHint").textContent+=" 前排攔截機率約 "+Math.round(RIBBON.challenge.chance*100)+"%。";
    if (RIBBON.phase === "play" && RIBBON.window) $("ribbonHint").textContent += " 直滑中央力度時，方向容許 " + RIBBON.window.aimLo + "°～+" + RIBBON.window.aimHi + "°。";
  }
  function ribbonUpdateMarker() {
    if(!ribbonTargetVisible()){ribbonMark.hidden=true;return;}
    var w=$("view").clientWidth,h=$("view").clientHeight;
    var x = (ribbonProject.x + 1) * 0.5 * w, y = (1 - ribbonProject.y) * 0.5 * h;
    ribbonMark.style.left = x + "px";
    ribbonMark.style.top = y + "px";
    ribbonMark.querySelector("span").textContent = "目標 · " + seatLabel(RIBBON.target);
    ribbonMark.hidden = false;
  }
  function ribbonMakeSpool(color) {
    var material=new THREE.MeshLambertMaterial({color:color,emissive:color,emissiveIntensity:.35});
    var spool=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.02,20),material);
    var holeGeometry=new THREE.CircleGeometry(.012,16),holeMaterial=new THREE.MeshBasicMaterial({color:0x17121b,side:THREE.DoubleSide});
    for(var side=-1;side<=1;side+=2){var hole=new THREE.Mesh(holeGeometry,holeMaterial);hole.rotation.x=Math.PI/2;hole.position.y=side*.0105;spool.add(hole);}
    return spool;
  }
  function ribbonDisposeSpool(spool) {
    if(!spool)return;scene.remove(spool);
    var geometries=new Set(),materials=new Set();spool.traverse(function(object){if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
    geometries.forEach(function(g){g.dispose();});materials.forEach(function(m){m.dispose();});
  }
  function ribbonDisposeHeld() {ribbonDisposeSpool(RIBBON.heldSpool);RIBBON.heldSpool=null;}
  var ribbonHeldForward=new THREE.Vector3(),ribbonHeldRight=new THREE.Vector3(),ribbonHeldUp=new THREE.Vector3();
  function ribbonTickHeld(dt) {
    var spool=RIBBON.heldSpool;if(!spool)return;
    spool.visible=RIBBON.active&&RIBBON.phase==="play"&&!RIBBON.flight;
    if(!spool.visible)return;
    camera.updateMatrixWorld(true);
    ribbonHeldForward.set(0,0,-1).applyQuaternion(camera.quaternion);
    ribbonHeldRight.set(1,0,0).applyQuaternion(camera.quaternion);
    ribbonHeldUp.set(0,1,0).applyQuaternion(camera.quaternion);
    var gesture=RIBBON.gesture,last=gesture&&gesture.points[gesture.points.length-1],height=Math.max(1,canvas.clientHeight);
    var dx=last?(last.x-gesture.x0)/height:0,dy=last?(gesture.y0-last.y)/height:0;
    var drop=Math.min(.27,.42*Math.tan(camera.fov*Math.PI/360)*.7);
    spool.position.copy(camera.position).addScaledVector(ribbonHeldForward,.42).addScaledVector(ribbonHeldUp,-drop+.34*dy).addScaledVector(ribbonHeldRight,.3*dx);
    spool.quaternion.copy(camera.quaternion);spool.rotateX(Math.PI/2-6*dy);spool.rotateZ(.25*Math.max(0,1-6*dy));
    RIBBON.heldAge=(RIBBON.heldAge||0)+dt;spool.scale.setScalar(Math.max(.01,Math.min(1,RIBBON.heldAge/.15)));
  }
  function ribbonMakeTrail(color) {
    var geo = new THREE.BufferGeometry(), positions = new Float32Array(RIBBON_MAX * 2 * 3), colors = new Float32Array(RIBBON_MAX * 2 * 3), indices = [];
    for (var i = 0; i < RIBBON_MAX - 1; i++) {
      var j = i * 2;
      indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(indices);
    var mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.94, depthWrite: false, toneMapped: false });
    var meshTape = new THREE.Mesh(geo, mat);
    meshTape.frustumCulled = false;
    scene.add(meshTape);
    var c = new THREE.Color(color);
    var spool = ribbonMakeSpool(color);
    scene.add(spool);
    return { geo: geo, mesh: meshTape, rollMesh:spool, color: c, nodes: [], seed:Math.random()*100 };
  }
  function ribbonAddPoint(f, p, velocity) {
    var q = p.clone(), prev = q.clone();
    if (velocity) prev.addScaledVector(velocity, -RIBBON_PHYSICS.inherit * RIBBON_DT);
    f.nodes.push({ p: q, prev: prev });
  }
  function ribbonAddTrail(f, end) {
    var nodes = f.nodes;
    while (nodes.length < RIBBON_MAX) {
      var base = nodes[nodes.length - 2].p, delta = end.clone().sub(base), d = delta.length();
      if (d < RIBBON_SEGMENT * 1.5) break;
      var q = base.clone().addScaledVector(delta, RIBBON_SEGMENT / d);
      var tail = nodes[nodes.length - 1];
      tail.p.copy(q); tail.prev.copy(q).addScaledVector(f.velocity, -RIBBON_PHYSICS.inherit * RIBBON_DT);
      ribbonAddPoint(f, end, f.velocity);
    }
    nodes[nodes.length - 1].p.copy(end);
    nodes[nodes.length - 1].prev.copy(end);
  }
  function ribbonPrepareDrop(f) {
    var route=RIBBON.world.dropRoute(f.finaleFrom,f.roll,S.stageH+.012);f.dropRoute=route;
    var rest=[route.floor].concat(route.guides,[f.roll]),points=[f.anchor].concat(route.guides,[f.roll]),counts=[],total=0;
    for(var i=1;i<rest.length;i++){var n=Math.max(1,Math.ceil(Math.max(rest[i-1].distanceTo(rest[i]),points[i-1].distanceTo(points[i]))/RIBBON_SEGMENT));counts.push(n);total+=n;}
    counts[counts.length-1]+=Math.max(0,f.nodes.length-1-total);total=counts.reduce(function(a,b){return a+b;},0);
    if(total>=RIBBON_MAX){counts[counts.length-1]-=total-RIBBON_MAX+1;total=RIBBON_MAX-1;}
    while(f.nodes.length<=total)ribbonAddPoint(f,f.anchor);f.nodes.length=total+1;
    f.dropPins=[];var start=0;
    for(var leg=0;leg<counts.length;leg++) {
      for(var j=leg?1:0;j<=counts[leg];j++){var node=f.nodes[start+j];node.p.lerpVectors(points[leg],points[leg+1],j/counts[leg]);node.prev.copy(node.p);node.pin=false;}
      start+=counts[leg];if(leg<route.guides.length){f.dropPins.push({i:start,p:route.guides[leg]});f.nodes[start].pin=true;}
    }
    route.contacts.forEach(function(c,i){c.inner=f.dropPins[2*i].i;c.outer=f.dropPins[2*i+1].i;});
    f.paid=Math.min(RIBBON_PHYSICS.tapeLen,Math.max(f.paid,total*RIBBON_SEGMENT));f.lastLen=Math.max(RIBBON_SEGMENT*.5,f.nodes[total-1].p.distanceTo(f.roll));
    f.asleep=false;f.acc=0;f.calm=0;f.settleAge=0;
  }
  function ribbonConstrainDrop(f) {
    var route=f.dropRoute;if(!route)return;
    for(var pin=0;pin<f.dropPins.length;pin++){var fixed=f.dropPins[pin];f.nodes[fixed.i].p.copy(fixed.p);}
    for(var i=1;i<f.nodes.length-1;i++) {
      var p=f.nodes[i].p;
      for(var k=0;k<route.contacts.length;k++){var c=route.contacts[k],b=c.barrier;if(p.z<b.min.z-.02||p.z>b.max.z+.02)continue;
        if(i<c.inner)p.x=c.sign<0?Math.min(p.x,c.guides[0].x):Math.max(p.x,c.guides[0].x);
        else if(i>c.outer)p.x=c.sign<0?Math.max(p.x,c.guides[1].x):Math.min(p.x,c.guides[1].x);
        else p.y=Math.max(p.y,b.max.y+.02);
      }
      for(var k=0;k<route.separations.length;k++){var c=route.separations[k],b=c.barrier;if(p.z>=b.min.z-.02&&p.z<=b.max.z+.02)p.x=c.sign<0?Math.min(p.x,c.x):Math.max(p.x,c.x);}
    }
    if(Math.abs(f.anchor.x-route.floor.x)>1e-6&&f.nodes.length>2)f.nodes[1].p.y=Math.max(f.nodes[1].p.y,route.slideTop);
    if(route.endSupportTop&&f.nodes.length>2){var before=f.nodes[f.nodes.length-2].p;before.y=Math.max(before.y,route.endSupportTop);}
  }
  function ribbonRopeStep(f, dt) {
    if(f.dropRoute&&!f.dropRoute.barrier&&RIBBON.world.barrierCrosses(f.dropRoute.floor,f.roll))ribbonPrepareDrop(f);
    var nodes = f.nodes, last = nodes.length - 1;
    if (last < 2) return;
    for (var i = 1; i < last; i++) {
      var node=nodes[i];if(node.pin)continue;var before=nodes[i-1].p, after=nodes[i+1].p;
      var tx=after.x-before.x, ty=after.y-before.y, tz=after.z-before.z, length=Math.hypot(tx,ty,tz)||1;
      tx/=length;ty/=length;tz/=length;
      var vx=(node.p.x-node.prev.x)/dt,vy=(node.p.y-node.prev.y)/dt-RIBBON_PHYSICS.g*dt,vz=(node.p.z-node.prev.z)/dt;
      var tangential=vx*tx+vy*ty+vz*tz;
      var nx=vx-tangential*tx,ny=vy-tangential*ty,nz=vz-tangential*tz;
      var normalSpeed=Math.hypot(nx,ny,nz),normalDrag=1/(1+RIBBON_PHYSICS.dragN*normalSpeed*dt);
      var tv=tangential/(1+RIBBON_PHYSICS.dragT*Math.abs(tangential)*dt)*dt;
      var amplitude=RIBBON_PHYSICS.flutter*RIBBON_PHYSICS.g*Math.min(1,normalSpeed*normalSpeed)*dt;
      var phase=i*1.7+(f.seed||0);
      nx=nx*normalDrag+tz*amplitude*Math.sin(phase+f.time*9.1);
      ny=ny*normalDrag+.35*amplitude*Math.sin(phase*.6+f.time*6.3);
      nz=nz*normalDrag-tx*amplitude*Math.sin(phase+f.time*9.1);
      node.prev.copy(node.p);
      node.p.x += nx * dt + tx * tv;
      node.p.y += ny * dt + ty * tv;
      node.p.z += nz * dt + tz * tv;
    }
    for (var pass = 0; pass < 4; pass++) {
      nodes[0].p.copy(f.anchor);
      nodes[last].p.copy(f.roll);ribbonConstrainDrop(f);
      for (var j = 0; j < (f.resolved ? last : last-1); j++) {
        var a = nodes[j].p, b = nodes[j + 1].p, dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        var d = Math.hypot(dx, dy, dz);
        var rest = j===last-1 && f.lastLen ? f.lastLen : RIBBON_SEGMENT;
        if (d <= rest || !d) continue;
        var wa=j===0||nodes[j].pin?0:1,wb=j+1===last||nodes[j+1].pin?0:1,total=wa+wb;if(!total)continue;
        var k=(d-rest)/d/total;a.x+=dx*k*wa;a.y+=dy*k*wa;a.z+=dz*k*wa;b.x-=dx*k*wb;b.y-=dy*k*wb;b.z-=dz*k*wb;
      }
    }
    if (RIBBON.world) for(var n=1;n<last;n++) {
      var v=nodes[n];if(v.pin)continue;
      var contact=RIBBON.world.collide(v.p,null,0.01,f.owner);
      if(contact.hit) v.prev.lerp(v.p,0.7);
    }
    if(RIBBON.world&&RIBBON.world.constrainBodySegment)for(var pass=0;pass<4;pass++)for(var n=0;n<last;n++)RIBBON.world.constrainBodySegment(nodes[n].p,nodes[n+1].p,n>0&&!nodes[n].pin,n+1<last&&!nodes[n+1].pin,.012);
    ribbonConstrainDrop(f);
  }
  var ribbonTangent = new THREE.Vector3(), ribbonView = new THREE.Vector3(), ribbonSide = new THREE.Vector3();
  function ribbonUpdateMesh(f,viewPosition) {
    if(f.rollMesh) {
      f.rollMesh.position.copy(f.roll);
      if(f.visualOffset)f.rollMesh.position.addScaledVector(f.visualOffset,Math.max(0,1-f.time/.09));
      f.rollMesh.rotation.set(Math.PI/2+f.time*8,f.heading||0,(f.alpha||0)*Math.PI/720);
    }
    var nodes = f.nodes, count = nodes.length, attr = f.geo.attributes.position, colors = f.geo.attributes.color, arr = attr.array, col = colors.array;
    for (var i = 0; i < count; i++) {
      var before = nodes[Math.max(0, i - 1)].p, after = nodes[Math.min(count - 1, i + 1)].p, p = nodes[i].p;
      var tangent = ribbonTangent.subVectors(after, before), view = ribbonView.subVectors(viewPosition || camera.position, p), side = ribbonSide.crossVectors(tangent, view);
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
      side.normalize().multiplyScalar(.015);
      var k = i * 6, shade = .7+.3*Math.cos(i*RIBBON_SEGMENT/.5*2*Math.PI+(f.seed||0));
      arr[k] = p.x - side.x; arr[k + 1] = p.y - side.y; arr[k + 2] = p.z - side.z;
      arr[k + 3] = p.x + side.x; arr[k + 4] = p.y + side.y; arr[k + 5] = p.z + side.z;
      col[k] = col[k + 3] = f.color.r * shade; col[k + 1] = col[k + 4] = f.color.g * shade; col[k + 2] = col[k + 5] = f.color.b * shade;
    }
    attr.needsUpdate = true;
    colors.needsUpdate = true;
    f.geo.setDrawRange(0, Math.max(0, count - 1) * 6);

  }
  function ribbonDisposeSettled() {
    RIBBON.settled.forEach(function(f){ scene.remove(f.mesh); f.geo.dispose(); f.mesh.material.dispose(); ribbonDisposeSpool(f.rollMesh); });
    RIBBON.settled = [];
  }
  function ribbonDisposeFlight() {
    if (!RIBBON.flight) return;
    ribbonDisposeSpool(RIBBON.flight.rollMesh);
    scene.remove(RIBBON.flight.mesh);
    RIBBON.flight.geo.dispose();
    RIBBON.flight.mesh.material.dispose();
    RIBBON.flight = null;
  }
  function ribbonClearAudience(restore){if(!RIBBON)return;if(RIBBON.crowd)RIBBON.crowd.clear(restore);if(RIBBON.angrySeats)RIBBON.angrySeats.clear();moodGroup.children.slice().forEach(function(sp){if(sp.userData.ribbonReaction){moodGroup.remove(sp);if(sp.userData.seat.mood===sp)sp.userData.seat.mood=null;}});}
  function ribbonNewEgg() {
    RIBBON.egg = { checked: new Set() };
    RIBBON.angrySeats = new Set();
  }
  function ribbonMaybeEgg(target) {
    var egg = RIBBON.egg;
    if (!egg || target.light || target.fan || target.towel || egg.checked.has(RIBBON.attempts)) return;
    egg.checked.add(RIBBON.attempts);
    if (Math.random() >= .5) return;
    var winners = new Set(RIBBON.results.slice((RIBBON.roundIndex || 0) * 10)
      .filter(function(result) { return result.ok; })
      .map(function(result) { return result.seat; }));
    seats.forEach(function(seat) {
      if (seat === target || !seatOcc(seat) || winners.has(seat.i) || RIBBON.crowd.entries.get(seat.i)?.caught) return;
      if (RIBBON.roundIndex !== 2 && seat.pos.distanceTo(target.pos) > 1.05) return;
      RIBBON.angrySeats.add(seat.i);
      if (seat.mood) {
        moodGroup.remove(seat.mood);
        seat.mood = null;
      }
    });
    if (RIBBON.angrySeats.size) {
      RIBBON.crowd.beginAnger(moodMaterial("😡").map);
      ribbonFeedback({ roll: target.pos }, "又是他！", "#ff706d");
      RIBBON.effects[RIBBON.effects.length - 1].popup = true;
    }
  }


  function ribbonInterceptionChance(){
    if(RIBBON.roundIndex<1)return 0;
    var prior=RIBBON.results.slice(0,RIBBON.roundIndex*10).reduce(function(sum,r){return sum+(r.points||0);},0),hits=RIBBON.results.slice(RIBBON.roundIndex*10).filter(function(r){return r.ok;}).length;
    var chance=Math.min(.7,.12+.03*hits+Math.min(.25,prior/6000*.25));return RIBBON.roundIndex===1?chance*.45:chance;
  }
  function ribbonLockInterception(){
    var key=RIBBON.attempts,decisions=RIBBON.interceptionDecisions;
    if(!decisions)return;
    if(!decisions[key]){var chance=ribbonInterceptionChance();decisions[key]={chance:chance,active:chance>0&&Math.random()<chance,seed:Math.random(),receivers:ribbonReceiverSnapshot()};}
    RIBBON.challenge=decisions[key];
  }
  function ribbonInterceptors(shot,target,thrower,challenge){
    challenge=challenge===undefined?RIBBON.challenge:challenge;
    if(!challenge||!challenge.active||!RIBBON.catchBySeat)return [];
    var dx=shot.velocity.x,dz=shot.velocity.z,speed=Math.hypot(dx,dz)||1;dx/=speed;dz/=speed;
    var targetPoint=headWorld(target,new THREE.Vector3()),end=(targetPoint.x-shot.origin.x)*dx+(targetPoint.z-shot.origin.z)*dz,choices=[];
    RIBBON.catchBySeat.forEach(function(q){if(q.seat===target||!ribbonCanReceive(q.seat,challenge.receivers))return;var x=q.x-shot.origin.x,z=q.z-shot.origin.z,along=x*dx+z*dz,lateral=Math.abs(x*dz-z*dx);if(along<.5||along>end-.4||lateral>.6*q.k)return;
      var hand=new THREE.Vector3(.08*q.k,q.localShoulder.y+.48*q.k,q.localShoulder.z-.34*q.k).applyMatrix4(q.seat.m);
      choices.push({seat:q.seat,hand:hand,k:q.k,start:Math.max(0,(along-.9)/speed),along:along});
    });choices.sort(function(a,b){return a.along-b.along||a.seat.i-b.seat.i;});return choices;
  }
  function ribbonCatchInterception(f){
    var best=null,nearest=Infinity;(f.interceptors||[]).forEach(function(q){
      if(!ribbonCanReceive(q.seat,f.receivers)||f.liveReceivers&&!ribbonCanReceive(q.seat))return;
      var center=RIBBON.catchBySeat.get(q.seat.i),distance=Math.hypot(f.roll.x-center.x,f.roll.y-center.y-.25,f.roll.z-center.z);
      if(f.time>=q.start+.18&&f.roll.distanceTo(q.hand)<.17*q.k&&distance<nearest&&f.roll.distanceTo(center.shoulder)<.615*q.k){nearest=distance;best={seat:q.seat,distance:distance,intercepted:true};}
    });return best;
  }
  function ribbonTickAudience(now){
    var crowd=RIBBON.crowd;if(!crowd||document.hidden||RIBBON.pausedAt)return;var dt=Math.max(0,Math.min(.05,(now-(crowd.last||now))/1000));crowd.last=now;
    if(RIBBON.angrySeats)crowd.tickAnger(RIBBON.angrySeats,camera,RIBBON.fxTime||0,headWorld);
    var f=RIBBON.flight;
    if(f&&!f.resolved){
      var q=RIBBON.catchBySeat&&RIBBON.catchBySeat.get(f.targetSeat.i);
      if(q){var target=new THREE.Vector3(q.x,q.y+.25,q.z);target.add(new THREE.Vector3(0,0,-.24*q.k).transformDirection(q.seat.m).multiplyScalar(.24*q.k));if(f.roll.distanceTo(target)<1.3)crowd.anticipate(q.seat,target,Math.min(1,(1.3-f.roll.distanceTo(target))/.8),f);}
      (f.interceptors||[]).forEach(function(q){if(f.time>=q.start)crowd.anticipate(q.seat,q.hand,(f.time-q.start)/.18,f);});
    }
    crowd.entries.forEach(function(e,i){if(e.caught&&e.flight){if(!e.hand||e.hand.distanceToSquared(e.flight.roll)>1e-10)crowd.pose(e,e.flight.roll);(e.flights||[]).forEach(function(other){if(other!==e.flight&&other.roll&&other.roll.distanceToSquared(e.flight.roll)>1e-10){other.roll.copy(e.flight.roll);if(other.nodes&&other.nodes.length){var tail=other.nodes[other.nodes.length-1];tail.p.copy(other.roll);tail.prev.copy(other.roll);}other.asleep=false;other.calm=0;ribbonUpdateMesh(other);}});}else if(!f||f.resolved||e.anticipation!==f){e.returnAge=(e.returnAge||0)+dt;if(e.returnAge>=.3)crowd.release(i);else if(e.hand)crowd.pose(e,e.hand.clone().lerp(e.hands[1],Math.min(1,dt/.1)));}});
  }
  var ribbonCatchLocal=new THREE.Vector3(),ribbonAudienceMatrix=new THREE.Matrix4();
  function ribbonBuildCatchGrid() {
    RIBBON.catchGrid = new Map();RIBBON.catchBySeat=new Map();
    seats.forEach(function(s){
      if(s.i === S.my || !seatOcc(s)) return;
      headWorld(s, ribbonHead);
      var k=seatHeight(s)/170;IM.arm.getMatrixAt(s.i*2+1,ribbonAudienceMatrix);var shoulder=RibbonCrowd.shoulder(THREE,ribbonAudienceMatrix,k),inverse=s.m.clone().invert();
      var q={seat:s,x:ribbonHead.x,y:ribbonHead.y,z:ribbonHead.z,floor:s.pos.y,k:k,shoulder:shoulder,hold:RibbonCrowd.hold(THREE,s,k,shoulder),inverse:inverse,localShoulder:shoulder.clone().applyMatrix4(inverse)};RIBBON.catchBySeat.set(s.i,q);
      var key = Math.floor(q.x / 0.8) + ":" + Math.floor(q.z / 0.8);
      if(!RIBBON.catchGrid.has(key)) RIBBON.catchGrid.set(key, []);
      RIBBON.catchGrid.get(key).push(q);
    });
  }
  function ribbonCatchAt(p, targetSeat,owner,actors,receivers,live) {
    if(owner===undefined)owner=RIBBON.slot;
    targetSeat = targetSeat || RIBBON.target;
    var best = null, bestD = Infinity, bx = Math.floor(p.x/0.8), bz = Math.floor(p.z/0.8);
    if(!RIBBON.catchGrid) return null;
    for(var x=bx-1;x<=bx+1;x++) for(var z=bz-1;z<=bz+1;z++) {
      var bucket = RIBBON.catchGrid.get(x+":"+z) || [];
      for(var i=0;i<bucket.length;i++) {
        var q=bucket[i], dx=p.x-q.x, dz=p.z-q.z;
        if(!ribbonCanReceive(q.seat,receivers)||live&&!ribbonCanReceive(q.seat))continue;
        if(Math.hypot(dx,dz)>RIBBON_PHYSICS.reachR || p.y<q.floor || p.y>q.y+RIBBON_PHYSICS.reachUp) continue;
        ribbonCatchLocal.copy(p).applyMatrix4(q.inverse);
        if(ribbonCatchLocal.z>q.seat.headZ-.12*q.k||p.distanceTo(q.shoulder)>.615*q.k)continue;
        ribbonHead.set(q.x,q.y+.25,q.z);
        if(RIBBON.world.blocked && RIBBON.world.blocked(p,ribbonHead,owner,actors))continue;
        var distance=Math.hypot(dx,p.y-q.y-0.25,dz);
        if(distance<bestD) {bestD=distance;best={seat:q.seat,distance:distance};}
      }
    }
    return best;
  }
  function ribbonFeedback(f,text,color) {
    RIBBON.effects=RIBBON.effects||[];
    RIBBON.effects.push({at:f.roll.clone(),text:text,color:color,born:RIBBON.fxTime||0});
    if(RIBBON.effects.length>3)RIBBON.effects.shift();
  }
  function ribbonDrawFeedback(width,height) {
    var effects=RIBBON.effects||[];camera.updateMatrixWorld(true);
    for(var i=effects.length-1;i>=0;i--) {
      var effect=effects[i],age=(RIBBON.fxTime||0)-effect.born;if(age>=(effect.popup ? .7 : 1)){effects.splice(i,1);continue;}
      ribbonProject.copy(effect.at).project(camera);
      var x=Math.max(50,Math.min(width-50,(ribbonProject.x+1)*width/2)),y=Math.max(height*.32,Math.min(height-70,(1-ribbonProject.y)*height/2));
      if(ribbonProject.z>1){x=width/2;y=height*.4;}
      if (effect.popup) {
        ribbonCtx.save();
        ribbonCtx.globalAlpha = Math.min(1, age * 12) * Math.min(1, (.7 - age) * 5);
        ribbonCtx.font = "bold 32px sans-serif";
        ribbonCtx.textAlign = "center";
        ribbonCtx.strokeStyle = "#21101b";
        ribbonCtx.fillStyle = effect.color;
        ribbonCtx.lineWidth = 6;
        ribbonCtx.strokeText(effect.text, width / 2, height * .28);
        ribbonCtx.fillText(effect.text, width / 2, height * .28);
        ribbonCtx.restore();
        continue;
      }
      ribbonCtx.save();ribbonCtx.globalAlpha=Math.max(0,1-age);ribbonCtx.strokeStyle=effect.color;ribbonCtx.fillStyle=effect.color;ribbonCtx.lineWidth=2;
      ribbonCtx.beginPath();ribbonCtx.arc(x,y,14+age*36,0,Math.PI*2);ribbonCtx.stroke();
      ribbonCtx.font='bold 18px sans-serif';ribbonCtx.textAlign='center';ribbonCtx.shadowColor='#17121b';ribbonCtx.shadowBlur=8;ribbonCtx.fillText(effect.text,x,y-25-age*20);
      ribbonCtx.restore();
    }
  }
  function ribbonReceiveMood(seat, expression) {
    if (RIBBON.angrySeats) RIBBON.angrySeats.delete(seat.i);
    showMood(seat, expression || "😍");
  }
  function ribbonOutcome(caught, now) {
    var f = RIBBON.flight;
    if(!RIBBON.active || !f || f.resolved) return;
    if(caught&&!ribbonCanReceive(caught.seat))caught=null;
    var target = RIBBON.target, ok = !!caught && caught.seat === target;
    var perfect = ok && caught.distance < RIBBON_PHYSICS.perfect && !caught.pickup && !f.hit && !f.snag;
    RIBBON.attempts++;
    RIBBON.used.add(target.i);
    RIBBON.results.push({ok:ok,perfect:perfect,row:target.row,member:G2.member,points:0,seat:target.i});
    if(ok && G2.member!==null)ribbonRecords.hit(G2.team,G2.member,target.row,perfect);
    f.resolved = true;f.actors=null;
    f.lastLen = Math.max(RIBBON_SEGMENT*.5,f.nodes[f.nodes.length-2].p.distanceTo(f.roll));
    if(caught){f.catchAge=0;f.pickup=!!caught.pickup;f.catchFrom=f.roll.clone();f.receiver=RIBBON.crowd.receive(caught.seat,f.roll,f);f.catchTo=f.receiver.hold.clone();f.catchAge=0;f.intercepted=!!caught.intercepted;}
    if(!caught){f.recoveryPending=true;f.recoveryAge=0;f.recoveryAcc=0;}
    f.removeAt = now + (ok ? 900 : 1200);
    if (ok) {
      RIBBON.hits++;
      RIBBON.combo++;
      RIBBON.bestCombo = Math.max(RIBBON.bestCombo, RIBBON.combo);
      if (perfect) RIBBON.perfect++;
      var points = 100 + (perfect ? 100 : 0) + 10 * Math.min(10, RIBBON.combo - 1);
      RIBBON.score += points;RIBBON.results[RIBBON.results.length-1].points=points;
      target.found = true;
      target.pts = points;
      G2.found = RIBBON.hits;
      G2.score = RIBBON.score;
      G2.combo = RIBBON.combo;
      G2.maxCombo = RIBBON.bestCombo;
      ribbonFeedback(f,perfect?"★ 完美接住":"○ 接住了",perfect?"#ffe27a":"#77e8ae");
      if(!f.pickup)ribbonReceiveMood(target, perfect ? "🤩" : "😍");ribbonMaybeEgg(target);
      SFX.found();
      toast((perfect ? "完美接住！★　" : "接到彩帶！　") + seatLabel(target) + "　+" + points);
    } else {
      RIBBON.misses++;
      RIBBON.combo = 0;
      if (caught) {
        ribbonFeedback(f,caught.intercepted?"× 前排伸手攔截":"× 被接走了","#ff8fc0");
        if(!f.pickup)ribbonReceiveMood(caught.seat);
        toast(seatLabel(caught.seat) + " 把彩帶接走了，沒有送到目標粉絲手上");
      } else if(f.blockedByActor){ribbonFeedback(f,"× 被站位成員擋住","#ff8fc0");toast("彩帶被站位成員擋住，請調整方向，避開成員再投擲。");} else {ribbonFeedback(f,"× 沒有接住","#ff8fc0");toast(f.power < RIBBON.window.lo ? "力度偏弱，下次請更快速向上滑動" : f.power > RIBBON.window.hi ? "力度過強，下次請減輕力度" : "方向偏離，下次請向上直滑，修正左右偏移");}
      SFX.miss();
    }
    if(RIBBON.attempts%RIBBON_ROUND_SIZE===0) {
      var roundIndex=RIBBON.roundIndex,rule=RIBBON_ROUNDS[roundIndex];
      var hits=RIBBON.results.slice(roundIndex*10,(roundIndex+1)*10).filter(function(r){return r.ok;}).length,passed=rule.hits===null||hits>=rule.hits;
      RIBBON.nextRound=passed&&roundIndex<2?roundIndex+1:null;
      RIBBON.cleared=passed&&roundIndex===2;
      RIBBON.phase="resultWait";
      RIBBON.finishReason=RIBBON.cleared?"決勝輪完成十投，三輪挑戰結束！":RIBBON.nextRound!==null?rule.name+"命中 "+hits+"/10，合照後可晉級"+RIBBON_ROUNDS[RIBBON.nextRound].name+"。":rule.name+"命中 "+hits+"/10，未達 "+rule.hits+" 次命中。";
    }
    RIBBON.nextAt=now+(ok?900:1200);
    ribbonUpdateHud();
  }
  function ribbonAdvanceRoll(f, dt) {
    f.time += dt;
    var speed = f.velocity.length(), mass = Math.max(0.004, RIBBON_PHYSICS.rollMass * (1 - f.paid / RIBBON_PHYSICS.tapeLen));
    var dampK = 0.5 * RIBBON_PHYSICS.air * RIBBON_PHYSICS.rollCdA / mass * speed + RIBBON_PHYSICS.pullForce / mass / Math.max(speed, 1e-6);
    var damp = 1 / (1 + dampK * dt);
    f.velocity.multiplyScalar(damp);
    f.velocity.y -= RIBBON_PHYSICS.g * dt;
    if (f.tilt && !f.hit) {
      var vh = Math.hypot(f.velocity.x, f.velocity.z) || 1e-6;
      var sx = -f.velocity.z / vh, sz = f.velocity.x / vh;
      var lift = 0.5 * RIBBON_PHYSICS.air * RIBBON_PHYSICS.liftA / mass * speed * speed * f.tilt * dt;
      f.velocity.x += lift * sx;
      f.velocity.z += lift * sz;
    }
    f.roll.addScaledVector(f.velocity, dt);
    f.paid += speed * dt;
    if (f.roll.y > f.apex) f.apex = f.roll.y;
  }
  var ribbonContactPoint=new THREE.Vector3();
  function ribbonStepRoll(f, target) {
    if(!f.receivers)f.receivers=ribbonReceiverSnapshot();
    for(var half=0;half<2;half++) {
      ribbonAdvanceRoll(f, RIBBON_DT / 2);
      var owner=f.owner===undefined?RIBBON.slot:f.owner;
      var beforeContact=ribbonContactPoint.copy(f.roll),preIntercept=ribbonCatchInterception(f),contact = RIBBON.world.collide(f.roll,f.velocity,RIBBON_PHYSICS.rollR,owner,f.actors,f.liveReceivers?undefined:f.bodies);
      if(!contact.obstacle&&contact.audience!==undefined&&['hand','fore','arm'].includes(contact.part)){
        var nearbyGrip=ribbonCatchAt(beforeContact,target,owner,f.actors,f.receivers,f.liveReceivers),grasp=preIntercept&&(!nearbyGrip||preIntercept.seat===nearbyGrip.seat||preIntercept.distance<nearbyGrip.distance)?preIntercept:nearbyGrip;
        if(grasp&&grasp.seat.i===contact.audience){f.roll.copy(beforeContact);return {done:true,caught:grasp};}
      }
      if (contact.hit) f.hit = true;
      if(contact.actor!==undefined)f.blockedByActor=true;
      var caught=null;
      if(!f.blockedByActor&&contact.audience===undefined){var intercepted=ribbonCatchInterception(f),nearby=ribbonCatchAt(f.roll,target,owner,f.actors,f.receivers,f.liveReceivers);caught=intercepted&&(!nearby||intercepted.seat===nearby.seat||intercepted.distance<nearby.distance)?intercepted:nearby;}
      if (caught) return { done:true, caught:caught };
      if (contact.landed && contact.actor===undefined) {
        f.landed=true;
        return {done:true,caught:null};
      }
      if(f.time>=8) return {done:true,caught:null};
    }
    return {done:false,caught:null};
  }
  function ribbonPhysicsStep(f, dt, now) {
    var outcome = ribbonStepRoll(f, RIBBON.target);
    ribbonAddTrail(f, f.roll);
    ribbonRopeStep(f, dt);
    if (outcome.done) ribbonOutcome(outcome.caught, now);
  }

  function ribbonLaunch(power, alpha, now) {
    if(!RIBBON.active||RIBBON.phase!=="play"||RIBBON.flight||!RIBBON.window||!ribbonRequireVisibleTarget())return;
    if(!ribbonCanReceive(RIBBON.target)){ribbonStartPlay(now);return;}
    var shot = ribbonBuildLaunch(power, alpha);
    if (!shot) return;
    var color = RIBBON.color, f = ribbonMakeTrail(color);
    f.receivers=ribbonReceiverSnapshot();f.liveReceivers=true;f.bodies=RIBBON.world.snapshotBodies?RIBBON.world.snapshotBodies():null;f.interceptors=ribbonInterceptors(shot,RIBBON.target,RIBBON.thrower);f.owner = RIBBON.slot;f.actors=RIBBON.world.snapshotActors?RIBBON.world.snapshotActors():null;
    f.targetSeat = RIBBON.target;
    f.anchor = RIBBON.thrower.hold.clone();
    f.roll = shot.origin.clone();
    f.velocity = shot.velocity;
    f.heading=Math.atan2(shot.velocity.x,shot.velocity.z);
    if(RIBBON.heldSpool){f.visualOffset=RIBBON.heldSpool.position.clone().sub(shot.origin);RIBBON.heldSpool.visible=false;}
    f.acc = 0;
    f.time = 0;
    f.resolved = false;
    f.alpha = alpha;
    f.power = power;
    f.tilt = shot.tilt;
    f.paid = 0;
    f.apex = shot.origin.y;
    f.hit = false;
    f.snag = false;
    f.startAt = now;
    ribbonAddPoint(f, f.anchor);
    ribbonAddPoint(f, f.roll, f.velocity);
    RIBBON.flight = f;
    RIBBON.gesture = null;
    ribbonSetPower(power);
    ribbonUpdateHud();
    SFX.go();
  }
  function ribbonBeginSession(member) {
    RIBBON.session = (RIBBON.session || 0) + 1;
    RIBBON.active = false;
    RIBBON.phase = "idle";
    ribbonRestoreCast();
    RIBBON.photoURL = null;RIBBON.photoAttempted=false;
    $("ribbonFinaleNote").hidden = true;
    RIBBON.target = null; RIBBON.window = null; RIBBON.world = null; RIBBON.thrower = null; RIBBON.pausedAt = 0;
    ribbonMark.hidden = true;
    $("ribbonHud").hidden = true;
    $("countdown").hidden = true;
    ribbonCancelGesture();
    ribbonClearAudience();
    ribbonDisposeHeld();
    ribbonDisposeFlight();
    ribbonDisposeSettled();
    $("ribbonSummary").hidden = true;
    $("ribbonPhoto").hidden = true;
    $("ribbonPhoto").removeAttribute("src");
    var team = TEAMS[G2.team];
    RIBBON.roster = Array.from({length:14},function(_,i){return i<team.members.length?(G2.member+i)%team.members.length:null;});
    RIBBON.stations=ribbonMakeStations();RIBBON.order=Array.from({length:14},function(_,i){return i;});
    for(var order=13;order>1;order--){var swap=1+Math.floor(Math.random()*order),value=RIBBON.order[order];RIBBON.order[order]=RIBBON.order[swap];RIBBON.order[swap]=value;}
    RIBBON.targets = G2.fans.slice();
    if (!RIBBON.targets.length) {
      G2.phase = "idle";
      $("startPanel").hidden = false;
      toast("目前沒有可投遞的應援粉絲，請換一位成員再試。");
      return;
    }
    ribbonAddCast();
    RIBBON.crowd=new RibbonCrowd(THREE,IM,seats,seatHeight,{fans:uchiwa,towels:towelG,scene:scene,getWorld:function(){return RIBBON.world;}});
    ribbonBuildCatchGrid();
    RIBBON.world = new RibbonWorld(THREE, scene, IM, seats, {width:ROOM_W, height:ROOM_H, depth:ROOM_D, z:ROOM_Z, platforms:platforms});
    drag = null; ptrs = {}; pinch = null;
    RIBBON.active = true;
    RIBBON.phase = "countdown";
    RIBBON.thrower = null;RIBBON.throwers=null;RIBBON.heldHeadings={};RIBBON.heldThrowers={};
    RIBBON.attempts = RIBBON.hits = RIBBON.perfect = RIBBON.misses = 0;
    RIBBON.combo = RIBBON.bestCombo = RIBBON.score = 0;
    RIBBON.interceptionDecisions={};RIBBON.challenge=null;RIBBON.cleared=false;RIBBON.roundIndex=0;RIBBON.nextRound=null;RIBBON.runRecorded=false;RIBBON.throwColors=[];RIBBON.paletteOffset=Math.floor(Math.random()*RIBBON_PALETTE.length);RIBBON.results = [];RIBBON.effects=[];RIBBON.waveStart=lastT||0;RIBBON.fxTime=0;RIBBON.runTitles=ribbonRecords.snapshot().titles;ribbonNewEgg();
    ribbonPrepareThrower();
    RIBBON.used.clear();
    RIBBON.windowCache = new Map();RIBBON.windowTasks=new Map();RIBBON.reachableRows={};RIBBON.recordsReady=false;
    var prototype=performers[RIBBON.slot],releaseLocal=prototype.g.worldToLocal(RIBBON.thrower.release.clone()),holdLocal=prototype.g.worldToLocal(RIBBON.thrower.hold.clone());
    RIBBON.throwers=performers.map(function(p){p.g.updateMatrixWorld(true);var matrix=p.g.matrixWorld.clone();matrix.makeRotationY(Math.PI);matrix.scale(p.g.scale);matrix.setPosition(p.g.position);return {slot:p.i,position:p.g.position.clone(),baseForAim:true,heading:0,zone:RIBBON.stations[p.i].zone,station:RIBBON.stations[p.i].station,eye:new THREE.Vector3(p.g.position.x,S.stageH+S.perfH/100*.935,p.g.position.z+.1),release:releaseLocal.clone().applyMatrix4(matrix),hold:holdLocal.clone().applyMatrix4(matrix)};});
    RIBBON.target = null;
    RIBBON.window = null;
    ribbonCancelGesture();
    RIBBON.nextAt = 0;
    RIBBON.lastCd = 0;
    RIBBON.pausedAt = 0;
    RIBBON.cdStart = performance.now();
    RIBBON.lastFrame = RIBBON.cdStart;
    RIBBON.color=ribbonThrowColor(member,0);
    RIBBON.heldSpool=ribbonMakeSpool(RIBBON.color);RIBBON.heldSpool.visible=false;scene.add(RIBBON.heldSpool);
    RIBBON.finishReason = "";
    G2.on = false;
    G2.result = false;
    G2.phase = "ribbon";
    S.blackout = false;
    $("gameHud").hidden = true;
    $("ribbonSummary").hidden = true;
    $("ribbonHud").hidden = true;
    ribbonMark.hidden = true;
    $("countdown").hidden = false;
    $("cdNum").textContent = "3";
    $("app").classList.add("playing");
    $("modeBar").hidden = true;
    ribbonSetPower(0);
    ribbonUpdateHud();
    updateHud();
    canvas.focus({ preventScroll: true });
    RIBBON.collectionTask=ribbonExploreRecords(RIBBON.session).catch(function(error){console.warn("彩帶實績探索未完成",error);});
  }
  function ribbonFillPhotoTapes(){
    var owners=new Set(RIBBON.settled.map(function(f){return f.owner;})),taken=new Set();
    RIBBON.settled.forEach(function(f){if(f.receiver)taken.add(f.receiver.seat.i);});
    var missing=RIBBON.stations.map(function(_,i){return i;}).filter(function(i){return !owners.has(i);}),lists=new Map(),assigned=new Map();
    missing.forEach(function(owner){var station=RIBBON.stations[owner],hold=performers[owner].elL.localToWorld(new THREE.Vector3(0,-.245,0));
      var candidates=seats.filter(function(seat){if(!seatOcc(seat)||seat.i===S.my||taken.has(seat.i)||!ribbonCanReceive(seat))return false;var q=RIBBON.catchBySeat.get(seat.i),point=q.hold,angle=wrapAng(Math.atan2(point.x-station.position.x,point.z-station.position.z)-station.heading);if(Math.abs(angle)>Math.PI/4)return false;return !RIBBON.world.blocked(hold,point,owner);});
      for(var i=candidates.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),q=candidates[i];candidates[i]=candidates[j];candidates[j]=q;}lists.set(owner,candidates);
    });
    function match(owner,seen){var candidates=lists.get(owner);for(var i=0;i<candidates.length;i++){var seat=candidates[i];if(seen.has(seat.i))continue;seen.add(seat.i);var old=assigned.get(seat.i);if(old===undefined||match(old,seen)){assigned.set(seat.i,owner);return true;}}return false;}
    missing.forEach(function(owner){match(owner,new Set());});
    assigned.forEach(function(owner,id){var seat=seats[id],p=performers[owner];p.g.updateMatrixWorld(true);var f=ribbonMakeTrail(RIBBON_PALETTE[(RIBBON.paletteOffset+owner*5+(RIBBON.roundIndex||0)*3)%12]);
      Object.assign(f,{owner:owner,targetSeat:seat,decorative:true,anchor:p.elL.localToWorld(new THREE.Vector3(0,-.245,0)),velocity:new THREE.Vector3(),resolved:true,time:0,paid:0,acc:0,alpha:0,heading:0,hit:false,snag:false});
      f.receiver=RIBBON.crowd.receive(seat,RIBBON.crowd.ensure(seat).hold,f);ribbonReceiveMood(seat);f.roll=f.receiver.hold.clone();f.catchFrom=f.roll.clone();f.catchTo=f.roll.clone();f.catchAge=.75;
      var count=Math.min(RIBBON_MAX-1,Math.max(8,Math.ceil((f.anchor.distanceTo(f.roll)+1.5)/RIBBON_SEGMENT))),point=new THREE.Vector3();
      for(var n=0;n<=count;n++){var t=n/count;point.lerpVectors(f.anchor,f.roll,t);point.y+=.75*Math.sin(Math.PI*t);ribbonAddPoint(f,point);}f.paid=Math.min(30,count*RIBBON_SEGMENT);f.lastLen=RIBBON_SEGMENT;f.mesh.material.opacity=0;f.rollMesh.traverse(function(o){if(o.material){o.material.transparent=true;o.material.opacity=0;}});RIBBON.settled.push(f);
    });
  }
  function finishRibbonGame(reason) {
    if (!RIBBON.active) return;
    if(reason&&reason!==RIBBON.finishReason)RIBBON.nextRound=null;
    RIBBON.resultFrom=performers.map(function(p){return {position:p.g.position.clone(),yaw:p.g.rotation.y,arms:[p.armL.quaternion.clone(),p.armR.quaternion.clone()],elbows:[p.elL.quaternion.clone(),p.elR.quaternion.clone()]};});
    RIBBON.resultStartPosition=camera.position.clone();RIBBON.resultStartQuaternion=camera.quaternion.clone();RIBBON.resultStartFov=camera.fov;RIBBON.resultView=null;
    RIBBON.active = false;
    if(RIBBON.world&&RIBBON.world.setActors)RIBBON.world.setActors([]);
    ribbonDisposeHeld();
    RIBBON.session++;
    RIBBON.phase = "result";
    RIBBON.resultAge = 0;
    RIBBON.finaleDone = false;
    ribbonRecords.finish(RIBBON.results,G2.team,RIBBON.roster.filter(function(m){return m!==null;}),!RIBBON.runRecorded);
    if(RIBBON.results.length)RIBBON.runRecorded=true;
    RIBBON.photoURL = null; RIBBON.photoAttempted = false;
    RIBBON.lastFrame = performance.now();
    S.yaw = 0; S.pitch = 0;
    $("ribbonPhoto").hidden = true;
    $("ribbonExportStatus").textContent = "彩帶正在集合，稍後可儲存合照。";
    $("ribbonExport").disabled = true;
    ribbonCancelGesture();
    RIBBON.window = null;
    RIBBON.target = null;
    G2.on = false;
    G2.phase = "idle";
    S.blackout = false;
    if(RIBBON.flight) { RIBBON.settled.push(RIBBON.flight); RIBBON.flight = null; }
    performers.forEach(function(p){p.g.updateMatrixWorld(true);});ribbonFillPhotoTapes();
    RIBBON.settled.forEach(function(f){f.finaleFrom=f.anchor.clone();f.actors=null;if(f.owner>=6)ribbonPrepareDrop(f);});
    $("countdown").hidden = true;
    $("ribbonHud").hidden = true;
    ribbonMark.hidden = true;
    $("app").classList.remove("playing");
    $("ribbonResultTitle").textContent=RIBBON.nextRound!==null?RIBBON_ROUNDS[RIBBON.roundIndex].name+"合照":RIBBON.cleared?"三輪挑戰完成":"彩帶挑戰結束";
    $("ribbonNext").hidden=RIBBON.nextRound===null;$("ribbonNext").disabled=true;
    if(RIBBON.nextRound!==null)$("ribbonNext").textContent="晉級"+RIBBON_ROUNDS[RIBBON.nextRound].name;
    $("ribbonAgain").className=RIBBON.nextRound===null?"primary":"ghost";
    $("ribbonResultMessage").textContent = (reason || RIBBON.finishReason || "挑戰已結束。")+" 以下為截至目前的累計成果。";
    var ratio=RIBBON.attempts?RIBBON.hits/RIBBON.attempts:0;
    var value=.75*ratio+.25*Math.min(1,RIBBON.bestCombo/Math.max(1,RIBBON.attempts));
    var rank=value>=.72?"ㄅ":value>=.52?"ㄆ":value>=.3?"ㄇ":"ㄈ";
    $("ribbonRank").textContent=rank;$("ribbonBadge").dataset.rank=rank;
    $("ribbonResultScore").textContent=RIBBON.score.toLocaleString("zh-TW");
    var best=ribbonRecords.snapshot();$("ribbonRecordResult").textContent="彩帶實績 · 最高命中 "+best.bestHit+" 次／完美 "+best.bestPerfect+" 次";
    $("ribbonResultStats").innerHTML=[["投出彩帶",RIBBON.attempts+" 次"],["命中次數",RIBBON.hits+" 次"],["完美接取",RIBBON.perfect+" ★"],["最高 Combo",RIBBON.bestCombo],["失手",RIBBON.misses+" 次"],["命中率",Math.round(ratio*100)+"%"]].map(function(item){return "<div><span>"+item[0]+"</span><b>"+item[1]+"</b></div>";}).join("");
    var lastBase=Math.floor(Math.max(0,RIBBON.results.length-1)/RIBBON_ROUND_SIZE)*RIBBON_ROUND_SIZE;
    $("ribbonResultDots").innerHTML=RIBBON.results.slice(lastBase).map(function(r){return '<i class="'+(r.ok?'hit':'miss')+'" title="'+(r.row||'')+'排 '+(r.perfect?'完美':r.ok?'命中':'失手')+'"></i>';}).join('');
    $("ribbonRoundResults").innerHTML=RIBBON_ROUNDS.filter(function(_,i){return i*10<RIBBON.results.length;}).map(function(rule,i){var results=RIBBON.results.slice(i*10,(i+1)*10),hits=results.filter(function(r){return r.ok;}).length;return '<p>'+rule.name+'：命中 '+hits+'/'+results.length+(rule.hits===null?'（不設門檻） · ':'（十投門檻 '+rule.hits+' 中） · ')+(results.length<10?'未完成':rule.hits===null?'完成':hits>=rule.hits?'過關':'未過關')+'</p>';}).join('');
    var newTitles=ribbonRecords.snapshot().titles.filter(function(id){return !(RIBBON.runTitles||[]).includes(id);});
    $("ribbonRunAwards").innerHTML=ribbonRecords.titles.filter(function(title){return newTitles.includes(title[0]);}).map(function(title){return '<span>新實績 · '+esc(title[1])+'</span>';}).join('');
    RIBBON.presentationReady=RIBBON.settled.length===0;
    $("ribbonSummary").hidden=!RIBBON.presentationReady;
    $("ribbonFinaleNote").hidden=RIBBON.presentationReady;
    if (RIBBON.presentationReady) $("ribbonAgain").focus({ preventScroll: true });
    syncModeBar();updateHud();
  }
  function closeRibbonSummary() {
    RIBBON.active=false;RIBBON.session++;RIBBON.nextRound=null;RIBBON.presentationReady=false;
    G2.phase="idle";$("app").classList.remove("playing");$("countdown").hidden=true;$("ribbonHud").hidden=true;ribbonMark.hidden=true;
    ribbonClearAudience();
    if($("ribbonRecordDialog").open)$("ribbonRecordDialog").close();
    ribbonDisposeHeld();
    ribbonDisposeSettled();
    $("ribbonSummary").hidden = true;
    $("ribbonFinaleNote").hidden = true;
    RIBBON.photoURL = null;RIBBON.effects=[];
    RIBBON.phase = "idle";
    ribbonRestoreCast();
    RIBBON.thrower = null;
    RIBBON.pausedAt = 0;
    RIBBON.world = null;
    RIBBON.windowCache = null;
    RIBBON.window = null;
    $("ribbonPhoto").removeAttribute("src");
    camera.aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);resetLook(); updateCamera();
    RIBBON.target = null;
    RIBBON.used.clear();
    ribbonDisposeFlight();
    if (typeof MODE === "undefined" || MODE === "game") {
      $("startPanel").hidden = false;
      $(selectedGame === "ribbon" ? "ribbonStart" : "gStart").focus({ preventScroll: true });
    }
    updateHud();
  }
  function ribbonContinueRound() {
    if(RIBBON.phase!=="result"||!RIBBON.presentationReady||RIBBON.nextRound===null||$("ribbonNext").disabled)return false;
    $("ribbonNext").disabled=true;
    var next=RIBBON.nextRound;RIBBON.nextRound=null;RIBBON.session++;RIBBON.active=true;RIBBON.phase="countdown";RIBBON.roundIndex=next;
    ribbonCancelGesture();ribbonClearAudience();ribbonDisposeHeld();ribbonDisposeFlight();ribbonDisposeSettled();
    RIBBON.photoURL=null;RIBBON.photoAttempted=false;RIBBON.presentationReady=false;RIBBON.resultFrom=null;RIBBON.resultView=null;
    RIBBON.target=null;RIBBON.window=null;RIBBON.thrower=null;RIBBON.heldHeadings={};RIBBON.heldThrowers={};RIBBON.used.clear();
    RIBBON.effects=[];RIBBON.waveStart=lastT||0;RIBBON.fxTime=0;RIBBON.finishReason="";RIBBON.cleared=false;ribbonNewEgg();
    RIBBON.windowCache=new Map();RIBBON.windowTasks=new Map();RIBBON.reachableRows={};RIBBON.recordsReady=false;
    $("ribbonSummary").hidden=true;$("ribbonPhoto").hidden=true;$("ribbonPhoto").removeAttribute("src");$("ribbonFinaleNote").hidden=true;$("ribbonNext").hidden=true;
    drag=null;ptrs={};pinch=null;S.yaw=0;S.pitch=0;S.fov=IDOL_FOV;
    canvas.focus({ preventScroll: true });
    ribbonPrepareThrower();RIBBON.heldSpool=ribbonMakeSpool(RIBBON.color);RIBBON.heldSpool.visible=false;scene.add(RIBBON.heldSpool);
    RIBBON.nextAt=0;RIBBON.lastCd=0;RIBBON.pausedAt=0;RIBBON.cdStart=performance.now();RIBBON.lastFrame=RIBBON.cdStart;
    G2.on=false;G2.result=false;G2.phase="ribbon";S.blackout=false;
    $("app").classList.add("playing");$("modeBar").hidden=true;$("countdown").hidden=false;$("cdNum").textContent="3";$("ribbonHud").hidden=true;ribbonMark.hidden=true;
    ribbonSetPower(0);ribbonUpdateHud();updateCamera();updateHud();
    canvas.focus({ preventScroll: true });
    RIBBON.collectionTask=ribbonExploreRecords(RIBBON.session).catch(function(error){console.warn("彩帶實績探索未完成",error);});
    return true;
  }
  async function ribbonStartPlay(now) {
    if (!RIBBON.active || !["countdown","play"].includes(RIBBON.phase)) return;
    var session = RIBBON.session;
    RIBBON.phase = "selecting";
    if(RIBBON.heldSpool)RIBBON.heldSpool.visible=false;
    ribbonPrepareThrower();
    RIBBON.nextAt = Infinity;
    RIBBON.target = null;
    RIBBON.window = null;
    ribbonCancelGesture();
    ribbonMark.hidden = true;
    gToast.hidden = true;
    clearTimeout(toast.t);
    $("countdown").hidden = true;
    $("ribbonHud").hidden = false;
    $("ribbonHud").setAttribute("aria-busy","true");
    ribbonSetPower(0);
    ribbonUpdateHud();
    try {
      var selection = await ribbonPickTarget(session);
      if (!RIBBON.active || session !== RIBBON.session) return;
      if (!selection) { finishRibbonGame("目前沒有可達的目標粉絲，請換一位成員或重新挑戰。"); return; }
      // Commit only after the entire search succeeds in this session.
      RIBBON.target = selection.target;
      RIBBON.thrower=ribbonAimThrower(selection.thrower||RIBBON.thrower,selection.target);
      RIBBON.heldHeadings[RIBBON.slot]=RIBBON.thrower.heading;
      RIBBON.heldThrowers[RIBBON.slot]=RIBBON.thrower;
      placePerformers(0);performers[RIBBON.slot].g.updateMatrixWorld(true);RIBBON.world.setActors(performers);
      // Existing ribbons remain in this member's holding hand when they turn again.
      RIBBON.settled.forEach(function(f){if(f.owner===RIBBON.slot)f.anchor.copy(RIBBON.thrower.hold);});
      RIBBON.window = selection.window;
      RIBBON.phase = "play";
      $("ribbonHud").setAttribute("aria-busy","false");
      ribbonFaceTarget();
      if(RIBBON.heldSpool){RIBBON.heldSpool.material.color.set(RIBBON.color);RIBBON.heldSpool.material.emissive.set(RIBBON.color);RIBBON.heldAge=0;ribbonTickHeld(0);}
      ribbonSetPower(0);
      ribbonUpdateHud();
      ribbonUpdateMarker();
      toast("瞄準金色標記，快速向上滑動投出彩帶。");
      SFX.go();
    } catch (error) {
      if (!RIBBON.active || session !== RIBBON.session) return;
      console.error("彩帶目標準備失敗", error);
      finishRibbonGame("準備目標時發生錯誤，請重新挑戰。");
    }
  }

  function ribbonDrawPreview(now) {
    var w = $("view").clientWidth, h = $("view").clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var resized = ribbonPreview.width !== Math.round(w * dpr) || ribbonPreview.height !== Math.round(h * dpr);
    if (resized) {
      ribbonPreview.width = Math.round(w * dpr);
      ribbonPreview.height = Math.round(h * dpr);
    }
    var g = RIBBON.gesture;
    var drawing = RIBBON.active && RIBBON.phase === "play" && g && RIBBON.target;
    var feedback=RIBBON.effects&&RIBBON.effects.length;
    if (!drawing && !feedback && !RIBBON.previewDirty && !resized) return;
    ribbonCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ribbonCtx.clearRect(0, 0, w, h);
    RIBBON.previewDirty = !!(drawing||feedback);
    if(feedback)ribbonDrawFeedback(w,h);
    if (!drawing) return;
    var m = ribbonMetrics(g);
    if (m.travel < 0.025) return;
    var shot = ribbonBuildLaunch(m.power, m.alpha);
    if (shot) {
      camera.updateMatrixWorld(true);
      ribbonCtx.save();
      ribbonCtx.beginPath();
      var open = false;
      var predicted = {receivers:ribbonReceiverSnapshot(),bodies:RIBBON.world.snapshotBodies?RIBBON.world.snapshotBodies():null,interceptors:ribbonInterceptors(shot,RIBBON.target,RIBBON.thrower),owner:RIBBON.slot,actors:RIBBON.world.snapshotActors?RIBBON.world.snapshotActors():null, roll: shot.origin.clone(), velocity: shot.velocity.clone(), tilt: shot.tilt, paid: 0, apex: shot.origin.y, hit: false, time: 0 };
      for (var step = 0; step <= 960; step++) {
        var result = step ? ribbonStepRoll(predicted, RIBBON.target) : {done:false};
        var stopped = result.done;
        if(step % 6 && !stopped) continue;
        var pt = predicted.roll.clone().project(camera);
        if (pt.z < 1 && Math.abs(pt.x) < 1.3 && Math.abs(pt.y) < 1.3) {
          var px = (pt.x + 1) * 0.5 * w, py = (1 - pt.y) * 0.5 * h;
          if (!open) { ribbonCtx.moveTo(px, py); open = true; } else ribbonCtx.lineTo(px, py);
        } else if (open) open = false;
        if(stopped) break;
      }
      ribbonCtx.setLineDash([6, 6]);
      ribbonCtx.lineWidth = 2;
      ribbonCtx.strokeStyle = RIBBON.color;
      ribbonCtx.shadowColor = RIBBON.color;
      ribbonCtx.shadowBlur = 9;
      ribbonCtx.stroke();
      ribbonCtx.restore();
    }
    var pts = g.points;
    if (pts.length > 1) {
      ribbonCtx.beginPath();
      ribbonCtx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ribbonCtx.lineTo(pts[i].x, pts[i].y);
      ribbonCtx.lineWidth = 3;
      ribbonCtx.lineCap = "round";
      ribbonCtx.strokeStyle = "rgba(255,255,255,.72)";
      ribbonCtx.stroke();
    }
  }
  // Visual recovery starts only after the scored outcome is immutable.
  function ribbonRecoveryCandidate(f) {
    var best=null,nearest=Infinity,pose=null;
    RIBBON.catchBySeat.forEach(function(q){
      var held=RIBBON.crowd.entries.get(q.seat.i);if(!ribbonCanReceive(q.seat)||!ribbonPickupRowAllowed(q.seat,f.roll))return;
      var distance=Math.hypot(f.roll.x-q.x,f.roll.y-q.floor,f.roll.z-q.z);if(distance>=nearest)return;
      var base=held?held.baseShoulders[1]:q.shoulder,choice=null,pivot=new THREE.Vector3(0,.45+.1*q.k,.05).applyMatrix4(q.seat.m);
      if(f.roll.distanceTo(pivot)>base.distanceTo(pivot)+.61*q.k)return;
      for(var bend of [Math.PI/2,Math.PI/3,Math.PI/6,0]){for(var degrees of [0,-10,10,-20,20,-30,30]){
        var yaw=degrees*Math.PI/180,transform=RibbonCrowd.pickupTransform(THREE,q.seat,q.k,1,yaw,bend),shoulder=base.clone().applyMatrix4(transform);
        if(shoulder.distanceTo(f.roll)>.61*q.k||RIBBON.world.pickupBlocked(f.roll,shoulder,q.seat.i,f.owner))continue;
        choice={yaw:yaw,bend:bend};break;
      }if(choice)break;}
      if(choice){nearest=distance;best=q.seat;pose=choice;}
    });
    if(pose){f.pickupYaw=pose.yaw;f.pickupBend=pose.bend;}
    return best;
  }
  function ribbonTickRecovery(f,dt) {
    if(!f.recoveryPending){
      if(!f.recoveryUnavailable||!f.landed||RIBBON.photoAttempted)return;
      f.retryAge=(f.retryAge||0)+dt;if(f.retryAge<.5)return;f.retryAge=0;
      var key=RIBBON.world.actorRevision()+':'+ribbonReceiverSnapshot().join(',');if(f.retryKey===key)return;f.retryKey=key;
      var retry=ribbonRecoveryCandidate(f);if(!retry)return;
      f.recoveryUnavailable=false;f.recoveryPending=true;
    }
    f.recoveryAge=(f.recoveryAge||0)+dt;f.recoveryAcc=(f.recoveryAcc||0)+dt;
    while(!f.landed&&f.recoveryAcc>=RIBBON_DT){
      f.recoveryAcc-=RIBBON_DT;ribbonAdvanceRoll(f,RIBBON_DT);
      var contact=RIBBON.world.collide(f.roll,f.velocity,RIBBON_PHYSICS.rollR,f.owner);
      if(contact.landed)f.landed=true;
    }
    if(f.nodes&&f.nodes.length>=2){ribbonAddTrail(f,f.roll);f.lastLen=Math.max(RIBBON_SEGMENT*.5,f.nodes[f.nodes.length-2].p.distanceTo(f.roll));}
    if(!f.landed&&f.recoveryAge<8)return;
    f.recoveryPending=false;f.asleep=false;f.calm=0;
    if(!f.landed){f.recoveryUnavailable=true;return;}
    var seat=ribbonRecoveryCandidate(f);
    if(!seat){f.recoveryUnavailable=true;f.retryKey=RIBBON.world.actorRevision()+':'+ribbonReceiverSnapshot().join(',');return;}
    f.velocity.set(0,0,0);f.postScorePickup=true;f.recoveredBy=seat.i;f.pickup=true;f.catchAge=0;f.catchFrom=f.roll.clone();
    f.receiver=RIBBON.crowd.receive(seat,f.roll,f);f.catchTo=f.receiver.hold.clone();
    ribbonFeedback(f,"失手已結算 · 觀眾拾起彩帶","#ffce82");
  }
  function ribbonCatchReady(f){return !f||f.resolved!==false&&!f.recoveryPending&&(!f.catchTo||f.catchAge>=ribbonCatchDuration(f));}
  function ribbonCatchDuration(f){return f.receiver?(f.pickup?.95:.75):.35;}
  function ribbonTickCatch(f,dt) {
    ribbonTickRecovery(f,dt);
    var duration=ribbonCatchDuration(f);if(!f.catchTo||f.catchAge>=duration)return;
    var previousCatchAge = f.catchAge;
    f.catchAge=Math.min(duration,f.catchAge+dt);
    if (f.receiver && f.pickup && previousCatchAge < .2 && f.catchAge >= .2) ribbonReceiveMood(f.receiver.seat);
    var u=f.pickup?Math.max(0,(f.catchAge-.2)/.75):f.catchAge/duration,t=u*u*(3-2*u);f.roll.lerpVectors(f.catchFrom,f.catchTo,t);
    if(f.receiver){f.roll.y+=.05*Math.sin(u*Math.PI);RIBBON.crowd.pose(f.receiver,f.roll);if(f.pickup&&f.catchAge>=.2){var safe=f.receiver.hand.clone();for(var pass=0;pass<4;pass++){var contact=RIBBON.world.collide(safe,null,.035,f.owner,undefined,undefined,f.receiver.seat.i);RIBBON.crowd.pose(f.receiver,safe);safe.copy(f.receiver.hand);if(!contact.hit)break;}f.roll.copy(safe);}}
    if(f.postScorePickup&&f.nodes&&f.nodes.length>=2){ribbonAddTrail(f,f.roll);f.lastLen=Math.max(RIBBON_SEGMENT*.5,f.nodes[f.nodes.length-2].p.distanceTo(f.roll));}
  }
  function ribbonTickSettled(dt) {
    RIBBON.settled.forEach(function(f){
      ribbonTickCatch(f,dt);
      var bodyRevision=RIBBON.world&&RIBBON.world.bodyRevision?RIBBON.world.bodyRevision():0;
      var bodiesMoved=f.bodyRevision!==bodyRevision&&(!f.asleep||!RIBBON.world.touchesChanged||RIBBON.world.touchesChanged(f.nodes,f.bodyRevision));f.bodyRevision=bodyRevision;
      var moved = !f.sleepAnchor || f.sleepAnchor.distanceToSquared(f.anchor) > 1e-8 || f.sleepRoll.distanceToSquared(f.roll) > 1e-8;
      if (moved || bodiesMoved) { f.asleep = false; f.calm = 0; f.settleAge = 0; }
      if (!f.sleepAnchor) { f.sleepAnchor = f.anchor.clone(); f.sleepRoll = f.roll.clone(); }
      f.sleepAnchor.copy(f.anchor); f.sleepRoll.copy(f.roll);
      if (!f.asleep) {
        f.acc += dt;
        var steps = 0, motion = 0;
        while(f.acc >= RIBBON_DT && steps++ < 8) {
          f.acc -= RIBBON_DT;
          if (!f.resolved) {
            var outcome = ribbonStepRoll(f, f.targetSeat);
            ribbonAddTrail(f,f.roll);
            if (outcome.done) {
              f.resolved=true;
              if(!outcome.caught){f.recoveryPending=true;f.recoveryAge=0;f.recoveryAcc=0;}
              else if(ribbonCanReceive(outcome.caught.seat)){f.pickup=!!outcome.caught.pickup;f.catchAge=0;f.catchFrom=f.roll.clone();f.receiver=RIBBON.crowd.receive(outcome.caught.seat,f.roll,f);f.catchTo=f.receiver.hold.clone();if(!f.pickup)ribbonReceiveMood(outcome.caught.seat);}
              f.lastLen=Math.max(RIBBON_SEGMENT*.5,f.nodes[f.nodes.length-2].p.distanceTo(f.roll));
            }
          } else f.time += RIBBON_DT;
          ribbonRopeStep(f, RIBBON_DT);
          for (var i = 1; i < f.nodes.length - 1; i++) motion = Math.max(motion, f.nodes[i].p.distanceToSquared(f.nodes[i].prev));
        }
        if(steps >= 8) f.acc = 0;
        f.settleAge = (f.settleAge || 0) + dt;
        f.calm = motion < 0.000004 ? (f.calm || 0) + dt : 0;
        // As in the reference's nine-second settling cap, retain the full ribbon.
        if (f.resolved && (f.calm > 0.5 || f.settleAge > 9)) { f.asleep = true; f.acc = 0; }
      }
      var cameraMoved = !f.meshCamera || !f.meshCamera.equals(camera.position);
      if (!f.asleep || moved || cameraMoved || !f.meshCamera) ribbonUpdateMesh(f);
      if (!f.meshCamera) f.meshCamera = camera.position.clone();
      else f.meshCamera.copy(camera.position);
    });
  }
  var ribbonFinalHands = [new THREE.Vector3(), new THREE.Vector3()];
  function ribbonTick(now) {
    if (document.hidden || RIBBON.pausedAt) return;
    if (!RIBBON.active) {
      var idleDt = Math.max(0,Math.min(.05,(now-RIBBON.lastFrame)/1000));
      RIBBON.lastFrame = now;
      if(RIBBON.phase === "result") {
        RIBBON.resultAge += idleDt;RIBBON.settled.forEach(function(f){if(f.decorative){var opacity=.94*Math.min(1,RIBBON.resultAge/.45);f.mesh.material.opacity=opacity;f.rollMesh.traverse(function(o){if(o.material)o.material.opacity=opacity;});}});RIBBON.fxTime=(RIBBON.fxTime||0)+idleDt;updateCamera();
        if (!RIBBON.finaleDone) {
          placePerformers(0);
          var blend=Math.min(1,RIBBON.resultAge/1.1); blend=blend*blend*(3-2*blend);
          for(var hand=0;hand<2;hand++) {
            var performer=performers[hand?3:2];performer.g.updateMatrixWorld(true);
            ribbonFinalHands[hand].set(0,-.245,0);
            (hand?performer.elR:performer.elL).localToWorld(ribbonFinalHands[hand]);
          }
          RIBBON.settled.forEach(function(f){
            if (!f.finaleFrom) f.finaleFrom=f.anchor.clone();
            if(f.owner<6)f.anchor.lerpVectors(f.finaleFrom,ribbonFinalHands[f.owner<3?0:1],blend);
            else {var route=f.dropRoute,slide=route&&Math.abs(route.floor.x-f.finaleFrom.x)>1e-6?.16:0,t=Math.max(0,RIBBON.resultAge-slide);f.anchor.copy(f.finaleFrom);if(route)f.anchor.x=THREE.MathUtils.lerp(f.finaleFrom.x,route.floor.x,Math.min(1,RIBBON.resultAge/.16));f.anchor.y=Math.max(S.stageH+.012,f.finaleFrom.y-4.9*t*t);}
          });
          if (RIBBON.resultAge>=1.1) RIBBON.finaleDone=true;
        }
        ribbonTickSettled(idleDt);
        if(RIBBON.resultAge>=2.8 && RIBBON.settled.every(ribbonCatchReady) && !RIBBON.photoAttempted) {
          RIBBON.photoAttempted=true;RIBBON.presentationReady=true;
          $("ribbonSummary").hidden=false;$("ribbonFinaleNote").hidden=true;
          $("ribbonExport").disabled=false;
          ribbonCapturePhoto();$("ribbonNext").disabled=false;
          $(RIBBON.nextRound !== null ? "ribbonNext" : "ribbonAgain").focus({ preventScroll: true });
        }
      }
      ribbonDrawPreview(now); return;
    }
    if (RIBBON.pausedAt) return;
    var dt = Math.max(0, Math.min(0.05, (now - RIBBON.lastFrame) / 1000));
    RIBBON.lastFrame = now;RIBBON.fxTime=(RIBBON.fxTime||0)+dt;
    ribbonTickSettled(dt);
    if (RIBBON.flight && RIBBON.flight.resolved) {
      ribbonTickCatch(RIBBON.flight,dt);
      RIBBON.flight.acc += dt;
      while(RIBBON.flight.acc >= RIBBON_DT) {RIBBON.flight.acc -= RIBBON_DT; RIBBON.flight.time += RIBBON_DT; ribbonRopeStep(RIBBON.flight,RIBBON_DT);}
      ribbonUpdateMesh(RIBBON.flight);
    }
    if (RIBBON.phase === "countdown") {
      var elapsed = now - RIBBON.cdStart, count = 3 - Math.floor(elapsed / 1000);
      if (elapsed < 3000 && count !== RIBBON.lastCd) {
        RIBBON.lastCd = count;
        $("cdNum").textContent = String(count);
        $("cdNum").classList.remove("pop");
        void $("cdNum").offsetWidth;
        $("cdNum").classList.add("pop");
        SFX.count();
      }
      if (elapsed >= 3000) ribbonStartPlay(now);
      ribbonDrawPreview(now);
      return;
    }
    if (RIBBON.phase === "resultWait") {
      if (now >= RIBBON.nextAt && ribbonCatchReady(RIBBON.flight)) finishRibbonGame(RIBBON.finishReason);
      ribbonDrawPreview(now);
      return;
    }
    if (RIBBON.flight && !RIBBON.flight.resolved) {
      var f = RIBBON.flight;
      f.acc += dt;
      var steps = 0;
      while (f.acc >= RIBBON_DT && steps++ < 8 && !f.resolved) {
        f.acc -= RIBBON_DT;
        ribbonPhysicsStep(f, RIBBON_DT, now);
      }
      if (steps >= 8) f.acc = 0;
      if(Math.abs(f.alpha)>RIBBON_PHYSICS.wildFrom && !f.resolved) {
        eyePos(eye);
        var yaw=Math.atan2(eye.x-f.roll.x,eye.z-f.roll.z), pitch=Math.atan2(f.roll.y-eye.y,Math.hypot(f.roll.x-eye.x,f.roll.z-eye.z));
        var follow=1-Math.exp(-6*dt);
        S.yaw+=wrapAng(yaw-S.yaw)*follow;S.pitch+=(Math.max(-.6,Math.min(.5,pitch))-S.pitch)*follow;
        updateCamera();camera.updateMatrixWorld(true);
      }
      ribbonUpdateMesh(f);
    } else if (RIBBON.flight && RIBBON.flight.resolved && now >= RIBBON.flight.removeAt && ribbonCatchReady(RIBBON.flight)) {
      RIBBON.settled.push(RIBBON.flight);
      RIBBON.flight = null;
    }
    if (RIBBON.phase === "play" && !RIBBON.flight && !RIBBON.gesture && Number.isFinite(RIBBON.nextAt) && now >= RIBBON.nextAt) {
      ribbonStartPlay(now);
    }
    ribbonTickHeld(dt);
    ribbonUpdateMarker();
    ribbonDrawPreview(now);
  }

  function startGame(kind) {
    if ($("ribbonRecordDialog").open) $("ribbonRecordDialog").close();
    if (RIBBON.active) finishRibbonGame();
    if (RIBBON.phase === "result") closeRibbonSummary();
    initAudio();
    closeResult();
    if (G2.on || G2.phase === "countdown" || fxList.length) clearFanSession();
    $("startPanel").hidden = true;
    G2.team = +$("gTeam").value;
    G2.member = kind === "ribbon" ? Math.floor(Math.random() * TEAMS[G2.team].members.length) : +$("gMember").value;
    G2.dur = +document.querySelector("input[name=gTime]:checked").value;
    G2.easy = kind !== "ribbon" && document.querySelector("input[name=gDiff]:checked").value === "easy";
    S.seed = newSeed();
    colorAudience();
    G2.conv = {};
    G2.extra = true;
    resetSpecials();
    G2.v101 = kind !== "ribbon" && GAME_VER === "1.01";
    setTeam(G2.team);
    setCam("idol");
    clearMoods();
    G2.fans = seats.filter(isTarget);
    G2.fans.forEach(function(s) {
      s.found = false;
    });
    seats.forEach(function(s) {
      s.amp = 1;
    });
    if (G2.v101) pickSpecials();
    G2.found = 0;
    G2.on = false;
    G2.result = false;
    G2.allAt = 0;
    G2.egg = null;
    G2.converted = 0;
    G2.score = 0;
    G2.combo = 0;
    G2.maxCombo = 0;
    G2.wrongOther = 0;
    G2.miss = 0;
    var m = TEAMS[G2.team].members[G2.member];
    if (kind === "ribbon") {
      ribbonBeginSession(m);
      return;
    }
    $("gWho").textContent = "你是 " + m.n + "（" + m.nick + "）";
    $("gFind").innerHTML = "要找：" + (G2.easy ? "" : colorWords(m) + "手燈、") + "寫「" + esc(m.nick) + "」或「" + esc(m.n) + "」的應援扇、「" + esc(m.n) + "」毛巾";
    G2.phase = "countdown";
    G2.cdStart = performance.now();
    G2.lastCd = 0;
    S.blackout = true;
    $("countdown").hidden = false;
    gHud.hidden = true;
    drawMap();
  }
  function beginPlay(now) {
    S.blackout = false;
    G2.phase = "play";
    G2.on = true;
    G2.end = now + G2.dur * 1e3;
    G2.lastTick = 0;
    $("fanAim").hidden = false;
    gHud.hidden = false;
    updateGameHud(now);
    canvas.focus({ preventScroll: true });
    SFX.go();
    toast("找出帶著你應援道具的粉絲，點一下就給他一個飛吻！");
  }
  function updateGameHud(now) {
    var left = Math.max(0, Math.ceil((G2.end - now) / 1e3));
    var frac = G2.phase === "play" ? Math.max(0, Math.min(1, (G2.end - now) / (G2.dur * 1e3))) : 1;
    $("gBar").style.width = (frac * 100).toFixed(1) + "%";
    gTime.textContent = left;
    gCount.textContent = G2.found + " / " + G2.fans.length;
    $("gScore").textContent = G2.score || 0;
    $("gCombo").textContent = G2.combo > 1 ? G2.combo + " Combo" : "";
    gTime.parentNode.classList.toggle("urgent", left <= 5);
    if (left <= 5 && left > 0 && left !== G2.lastTick) {
      G2.lastTick = left;
      SFX.tick();
    }
  }
  var ndc = new THREE.Vector3();
  function tickGame(now) {
    if (G2.pausedAt) return;
    if (G2.phase === "countdown") {
      var el = now - G2.cdStart, n = 3 - Math.floor(el / 1e3), cd = $("cdNum");
      if (el < 3e3 && n !== G2.lastCd) {
        G2.lastCd = n;
        cd.textContent = n;
        cd.classList.remove("pop");
        void cd.offsetWidth;
        cd.classList.add("pop");
        SFX.count();
      }
      if (el >= 3e3) {
        G2.lastCd = 0;
        cd.textContent = "開始！";
        cd.classList.remove("pop");
        void cd.offsetWidth;
        cd.classList.add("pop");
        beginPlay(now);
      }
      return;
    }
    if (G2.lastCd === 0 && G2.phase === "play" && now - G2.end + G2.dur * 1e3 > 700) $("countdown").hidden = true;
    if (!G2.on) return;
    updateGameHud(now);
    G2.fans.forEach(function(s) {
      headWorld(s, ndc);
      ndc.project(camera);
      var center = ndc.z < 1 && Math.abs(ndc.x) < 0.38 && Math.abs(ndc.y) < 0.5;
      var target = G2.standI === s.i ? 2.6 : s.found ? 1.9 : center ? 1.5 : 1;
      s.amp += (target - (s.amp || 1)) * 0.12;
    });
    tickSpecials(now);
    if (G2.fans.length && G2.found === G2.fans.length && !G2.allAt) G2.allAt = now;
    if (now >= G2.end || G2.allAt && now - G2.allAt > 1100) endGame(G2.found === G2.fans.length);
  }
  var TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  var pA = new THREE.Vector3(), pB = new THREE.Vector3();
  function segDist(px, py, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy, t = L ? ((px - ax) * vx + (py - ay) * vy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
  }
  function pickSeat(clientX, clientY) {
    var W = canvas.clientWidth, H = canvas.clientHeight, best = null, bd = Infinity, mine = null, md = Infinity;
    var f = H / 2 / Math.tan(camera.fov * Math.PI / 360);
    seats.forEach(function(s) {
      if (!seatOcc(s)) return;
      headWorld(s, hw);
      var dist = hw.distanceTo(camera.position);
      pA.copy(hw);
      pA.y -= 0.35;
      pA.project(camera);
      pB.copy(hw);
      pB.y += 0.4;
      pB.project(camera);
      if (pA.z > 1 || pB.z > 1) return;
      var ax = (pA.x + 1) / 2 * W, ay = (1 - pA.y) / 2 * H, bx = (pB.x + 1) / 2 * W, by = (1 - pB.y) / 2 * H;
      var d = segDist(clientX, clientY, ax, ay, bx, by);
      var lim = Math.max(TOUCH ? 44 : 30, f * (TOUCH ? 0.5 : 0.38) / dist);
      if (d > lim) return;
      if (d < bd) {
        bd = d;
        best = s;
      }
      if (isTarget(s) && !s.found && d < md) {
        md = d;
        mine = s;
      }
    });
    return mine || best;
  }
  function onGameClick(cx, cy) {
    if (!G2.on || G2.pausedAt || document.hidden) return;
    if (performance.now() >= G2.end) {
      endGame(G2.found === G2.fans.length);
      return;
    }
    var s = pickSeat(cx, cy);
    if (!s) return;
    var post = G2.v101 ? specialPre(s) : null;
    if (post === "stop") return;
    onGameClickCore(s);
    if (post) specialPost(s, post);
  }
  function onGameClickCore(s) {
    if (isTarget(s)) {
      if (s.found) {
        toast("這位已經找到了");
        return;
      }
      s.found = true;
      G2.found++;
      G2.combo++;
      G2.maxCombo = Math.max(G2.maxCombo, G2.combo);
      var base = s.fan || s.towel ? 100 : 60, pts = Math.round(base * (1 + 0.1 * Math.min(10, G2.combo - 1)));
      G2.score += pts;
      s.pts = pts;
      blowKiss();
      SFX.kiss();
      flyHeart(s, function() {
        burst(s);
        showMood(s, "😍");
        SFX.found();
      });
      toast("+" + pts + (G2.combo > 1 ? "　" + G2.combo + " Combo！" : "") + "　給 " + seatLabel(s) + " 的粉絲一個飛吻");
      updateGameHud(performance.now());
    } else {
      G2.combo = 0;
      G2.miss++;
      if (s.oshi >= 0 && s.oshi !== G2.member) G2.wrongOther++;
      G2.egg = G2.egg && G2.egg.i === s.i ? { i: s.i, n: G2.egg.n + 1 } : { i: s.i, n: 1 };
      if (G2.egg.n >= 5) {
        convertFan(s);
        return;
      }
      SFX.miss();
      missMark(s);
      if (G2.egg.n === 3) toast("……這位觀眾好像有點心動？");
      else if (G2.egg.n === 4) toast("再一下下……");
      else if (s.oshi >= 0) toast("這位是 " + TEAMS[S.team].members[s.oshi].nick + " 的粉絲");
      else toast("這位觀眾沒有帶應援道具");
    }
  }
  function convertFan(s) {
    G2.egg = null;
    G2.conv[s.i] = G2.member;
    updateAudience();
    s.found = true;
    G2.fans = seats.filter(function(q) {
      return isTarget(q) || G2.keep && G2.keep[q.i];
    });
    G2.found = G2.fans.filter(function(q) {
      return q.found;
    }).length;
    G2.converted = (G2.converted || 0) + 1;
    G2.score += 50;
    s.pts = 50;
    blowKiss();
    SFX.kiss();
    flyHeart(s, function() {
      burst(s);
      showMood(s, "🥰");
      SFX.win();
    });
    toast("轉推成功！" + seatLabel(s) + " 的觀眾改成支持你了");
    updateGameHud(performance.now());
  }
  function endGame(all, early) {
    if (G2.phase !== "play" && G2.phase !== "countdown") return;
    settleSpecials();
    G2.on = false;
    G2.result = true;
    G2.phase = "result";
    $("fanAim").hidden = true;
    S.blackout = false;
    $("countdown").hidden = true;
    G2.fans.forEach(function(s) {
      if (!s.found) showMood(s, "😢");
      s.amp = s.found ? 1.6 : 1;
    });
    gHud.hidden = true;
    if (all) SFX.win();
    else SFX.end();
    showResult(all, early);
    $("rAgain").focus({ preventScroll: true });
    drawMap();
  }
  function esc(v) {
    return String(v).replace(/[&<>"']/g, function(c) {
      return "&#" + c.charCodeAt(0) + ";";
    });
  }
  function colorWords(m) {
    var names = String(m.cn || "").split(/[＋+、]/).filter(Boolean);
    if (names.length !== m.c.length) names = m.c.map(function(c, q) {
      return names[q] || (q ? "" : m.cn);
    }).filter(Boolean);
    return names.map(function(nm, q) {
      var c = m.c[Math.min(q, m.c.length - 1)];
      if (c === "rainbow") return '<b class="cw" style="color:#fff">' + ["#ff3b3b", "#ffd400", "#2ee66b", "#3a8bff"].map(function(rc) {
        return '<span style="color:' + rc + '">●</span>';
      }).join("") + esc(nm) + "</b>";
      return '<b class="cw" style="color:' + c + '">' + esc(nm) + "</b>";
    }).join("＋");
  }
  function swatches(m) {
    return m.c.map(function(c) {
      return '<i class="sw" style="background:' + (c === "rainbow" ? "linear-gradient(90deg," + RAINBOW.map(function(rc, q) {
        return rc + " " + (q * 100 / 6).toFixed(1) + "% " + ((q + 1) * 100 / 6).toFixed(1) + "%";
      }).join(",") + ")" : c) + '"></i>';
    }).join("");
  }
  function hex(n) {
    return "#" + ("000000" + n.toString(16)).slice(-6);
  }
  function drawFanThumb(cv, s) {
    var x = cv.getContext("2d"), W = cv.width, H = cv.height, m = TEAMS[S.team].members[s.oshi];
    var L = s.look || { shirt: 3814208, skin: 14263164, hair: 1380366 }, ok = s.found;
    var bg = x.createLinearGradient(0, 0, 0, H);
    if (ok) {
      bg.addColorStop(0, "#5a2a4a");
      bg.addColorStop(1, "#2a1630");
    } else {
      bg.addColorStop(0, "#1d1b20");
      bg.addColorStop(1, "#121114");
    }
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);
    if (ok) {
      x.fillStyle = "rgba(255,214,120,.9)";
      [[14, 16], [W - 18, 22], [22, 52], [W - 12, 60], [W / 2 + 40, 12]].forEach(function(p, k) {
        var r = k % 2 ? 3 : 4.5;
        x.beginPath();
        for (var q = 0; q < 8; q++) {
          var a = q * Math.PI / 4, rr = q % 2 ? r * 0.35 : r;
          x.lineTo(p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr);
        }
        x.closePath();
        x.fill();
      });
    }
    var cx = W / 2, hy = H - 54, skin = hex(L.skin), hair = hex(L.hair);
    if (L.long) {
      x.fillStyle = hair;
      x.beginPath();
      x.ellipse(cx, hy + 10, 21, 26, 0, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = hex(L.shirt);
    x.beginPath();
    x.ellipse(cx, H + 8, 40, 44, 0, Math.PI, 0);
    x.fill();
    x.fillStyle = skin;
    x.fillRect(cx - 6, hy + 14, 12, 10);
    x.beginPath();
    x.ellipse(cx, hy, 16, 19, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = hair;
    x.beginPath();
    if (L.cap) {
      x.fillStyle = hex(L.capColor);
      x.ellipse(cx, hy - 9, 18, 12, 0, Math.PI, 0);
      x.fill();
      x.fillRect(cx - 20, hy - 10, 26, 4);
    } else {
      x.ellipse(cx, hy - 7, 17.5, 14, 0, Math.PI * 0.97, Math.PI * 2.03);
      x.fill();
      if (L.pony) {
        x.beginPath();
        x.ellipse(cx + 17, hy - 2, 5, 11, 0.5, 0, Math.PI * 2);
        x.fill();
      }
    }
    x.strokeStyle = "#2a1712";
    x.lineCap = "round";
    x.lineWidth = 2;
    if (ok) {
      [-6.5, 6.5].forEach(function(d) {
        x.beginPath();
        x.arc(cx + d, hy + 1, 3.2, Math.PI * 1.1, Math.PI * 1.9);
        x.stroke();
      });
      x.fillStyle = "rgba(255,110,140,.55)";
      x.beginPath();
      x.ellipse(cx - 10, hy + 6, 3.5, 2, 0, 0, Math.PI * 2);
      x.ellipse(cx + 10, hy + 6, 3.5, 2, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#b0324f";
      x.beginPath();
      x.arc(cx, hy + 8, 4.2, 0, Math.PI);
      x.fill();
    } else {
      [-6.5, 6.5].forEach(function(d) {
        x.beginPath();
        x.arc(cx + d, hy + 2.5, 1.6, 0, Math.PI * 2);
        x.fillStyle = "#2a1712";
        x.fill();
        x.beginPath();
        x.moveTo(cx + d - 3.5, hy - 3 + (d < 0 ? 1.5 : -0.5));
        x.lineTo(cx + d + 3.5, hy - 3 + (d < 0 ? -0.5 : 1.5));
        x.stroke();
      });
      x.beginPath();
      x.arc(cx, hy + 12, 4, Math.PI * 1.15, Math.PI * 1.85);
      x.stroke();
      x.fillStyle = "#7fc8ff";
      x.beginPath();
      x.ellipse(cx + 8, hy + 7, 1.6, 2.6, 0, 0, Math.PI * 2);
      x.fill();
    }
    if (L.glasses) {
      x.strokeStyle = "#111";
      x.lineWidth = 1.5;
      x.strokeRect(cx - 11, hy - 1, 8.5, 6);
      x.strokeRect(cx + 2.5, hy - 1, 8.5, 6);
      x.beginPath();
      x.moveTo(cx - 2.5, hy + 1);
      x.lineTo(cx + 2.5, hy + 1);
      x.stroke();
    }
    if (L.mask && !ok) {
      x.fillStyle = "#e8edf2";
      x.beginPath();
      x.ellipse(cx, hy + 9, 10, 6.5, 0, 0, Math.PI * 2);
      x.fill();
    }
    var cols = s.light ? s.cols : [];
    cols.forEach(function(c, k) {
      var gx = s.fan || cols.length > 1 ? cx + 26 + k * 8 : cx + 32;
      x.save();
      x.translate(gx, H - 44);
      x.rotate(cols.length > 1 ? (k - (cols.length - 1) / 2) * 0.25 : 0.15);
      if (c === "rainbow") {
        RAINBOW.forEach(function(rc, q) {
          x.shadowColor = rc;
          x.shadowBlur = 10;
          x.fillStyle = rc;
          x.fillRect(-3, -40 + q * 40 / 6, 6, 40 / 6 + 0.5);
        });
      } else {
        x.shadowColor = c;
        x.shadowBlur = 12;
        x.fillStyle = c;
        x.fillRect(-3, -40, 6, 40);
      }
      x.restore();
    });
    if (s.fan) {
      var fx = cx - 40, fy = H - 60, art = fanMaterials(TEAMS[S.team], s.oshi, s.fanBlue ? "B" : s.fanVar).canvas;
      x.fillStyle = "#eee";
      x.fillRect(fx - 1.5, fy + 16, 3, 26);
      x.drawImage(art, fx - 28, fy - 30, 56, 56);
    }
    if (s.towel) x.drawImage(towelMaterials(TEAMS[S.team], s.oshi).canvas, cx - 52, H - 50, 104, 41);
    if (ok) {
      x.strokeStyle = "rgba(255,170,210,.9)";
      x.lineWidth = 3;
      x.strokeRect(1.5, 1.5, W - 3, H - 3);
    }
  }
  function seatPlace(s) {
    if (s.side) return "舞台" + SIDE_NAME[s.row] + "・" + s.row + "排 " + s.num + "號";
    return "正面・" + s.row + "排 " + s.num + "號";
  }
  function achHtml() {
    var A = G2.ach || {}, keys = Object.keys(ACHS).filter(function(k) {
      return A[k];
    });
    keys.sort(function(x, y) {
      return (A[x] === "win" ? 0 : 1) - (A[y] === "win" ? 0 : 1);
    });
    return '<div class="rach"><span>成就</span>' + (keys.length ? keys.map(function(k) {
      return A[k] === "win" ? '<b class="win">🏆 #' + ACHS[k].win + "</b>" : '<b class="fail">💔 #' + ACHS[k].fail + "</b>";
    }).join("") : "<i>這局沒有遇到特別的觀眾</i>") + "</div>";
  }
  function showResult(all, early) {
    var m = TEAMS[G2.team].members[G2.member], miss = G2.fans.length - G2.found;
    var tot = G2.fans.length || 1, ratio = G2.found / tot, rv = 0.75 * ratio + 0.25 * Math.min(1, G2.maxCombo / tot);
    var rank = rv >= 0.72 ? "ㄅ" : rv >= 0.52 ? "ㄆ" : rv >= 0.3 ? "ㄇ" : "ㄈ";
    $("rRank").textContent = rank;
    $("rScore").textContent = G2.score;
    $("rBadge").dataset.rank = rank;
    gRes.classList.remove("compact");
    app.classList.remove("rcompact");
    $("rTitle").textContent = all ? "全部找到了！" : early ? "提前結束" : "時間到";
    eyePos(eye);
    var dists = G2.fans.filter(function(q) {
      return q.found;
    }).map(function(q) {
      headWorld(q, hw);
      return { s: q, d: hw.distanceTo(eye) };
    }).sort(function(a, b) {
      return a.d - b.d;
    });
    var near = dists[0], far = dists[dists.length - 1];
    var stat = function(lab, val) {
      return "<div><span>" + lab + "</span><b>" + val + "</b></div>";
    };
    $("rStats").innerHTML = stat("找到的粉絲", G2.found + " / " + G2.fans.length) + stat("最高 Combo", G2.maxCombo) + stat("點到他人粉絲", G2.wrongOther + " 次") + stat("讓粉絲轉推", (G2.converted || 0) + " 人") + (G2.v101 ? achHtml() : stat("最遠找到的粉絲", far ? far.d.toFixed(1) + " m・" + far.s.row + "排" + far.s.num + "號" : "—") + stat("最近找到的粉絲", near ? near.d.toFixed(1) + " m・" + near.s.row + "排" + near.s.num + "號" : "—"));
    $("rWhere").hidden = !G2.fans.some(function(q) {
      return !q.found;
    });
    var tl = tally();
    var grid = $("rGrid");
    grid.innerHTML = "";
    gRes.hidden = false;
    return;
    var sorter = function(a, b) {
      return b.found - a.found || ROW_ORDER.indexOf(a.row) - ROW_ORDER.indexOf(b.row) || a.num - b.num;
    };
    var list = [];
    [["fan", "拿應援扇的粉絲", tl.fan]].forEach(function(g) {
      var part2 = G2.fans.slice().sort(sorter);
      if (!part2.length) return;
      list.push({ head: g[1] + "　" + g[2].f + " / " + g[2].n });
      list = list.concat(part2);
    });
    list.forEach(function(s) {
      if (s.head) {
        return;
        var h = document.createElement("h3");
        h.className = "rgroup";
        h.textContent = s.head;
        grid.appendChild(h);
        return;
      }
      var cell = document.createElement("div");
      cell.className = "cell " + (s.found ? "ok" : "miss");
      var cv = document.createElement("canvas");
      cv.width = 132;
      cv.height = 108;
      drawFanThumb(cv, s);
      var items = [s.light ? "手燈" : "", s.fan ? "應援扇" : "", s.towel ? "毛巾" : ""].filter(Boolean).join("＋");
      cell.innerHTML = '<div class="mood" aria-hidden="true">' + (s.found ? "😍" : "😢") + "</div>";
      cell.appendChild(cv);
      var cap = document.createElement("div");
      cap.className = "cap";
      cap.innerHTML = "<b>" + seatPlace(s) + "</b><span>" + items + "・" + (G2.conv[s.i] !== void 0 ? "被你轉推了！" : s.found ? "有被看到，好開心" : "沒被看到，有點失落") + "</span>";
      cell.appendChild(cap);
      grid.appendChild(cell);
      cell.tabIndex = 0;
      cell.setAttribute("role", "button");
      cell.setAttribute("aria-label", "把視角拉近到 " + seatPlace(s));
      cell.addEventListener("click", function() {
        zoomTo(s, cell);
      });
      cell.addEventListener("keydown", function(e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          zoomTo(s, cell);
        }
      });
    });
    gRes.hidden = false;
  }
  var markEls = [];
  var FOCUS_PARTS = { torso: 1, head: 1, hair: 1, fringe: 1, long: 1, skin: 1, rstick: 1, arm: 2, fore: 2, hand: 2, thigh: 2, shin: 2, foot: 2, stick: 3 };
  var focus = null, focusCol = new THREE.Color(), focusM = new THREE.Matrix4(), glowTexF = null;
  function dimMat(mt, on) {
    mt.transparent = on;
    mt.opacity = on ? 0.8 : 1;
    mt.depthWrite = !on;
    if (mt.userData.alphaTest0 === void 0) mt.userData.alphaTest0 = mt.alphaTest || 0;
    mt.alphaTest = on && mt.userData.alphaTest0 ? 0.4 : mt.userData.alphaTest0;
    mt.needsUpdate = true;
  }
  function setFocus(s) {
    clearFocus();
    if (!s) return;
    focus = { s, meshes: {}, mats: [] };
    Object.keys(FOCUS_PARTS).forEach(function(k) {
      var src = IM[k], n = FOCUS_PARTS[k], mat = src.material.clone();
      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
      if (mat.emissive) {
        mat.emissive = new THREE.Color(16756952);
        mat.emissiveIntensity = 0;
      }
      var m = new THREE.InstancedMesh(src.geometry, mat, n);
      m.frustumCulled = false;
      m.renderOrder = 3;
      for (var j = 0; j < n; j++) {
        var idx = n === 1 ? s.i : n === 3 ? s.i * 3 + j : s.i * 2 + j;
        if (src.instanceColor) {
          src.getColorAt(idx, focusCol);
          m.setColorAt(j, focusCol);
        }
      }
      scene.add(m);
      focus.meshes[k] = m;
      focus.mats.push(mat);
    });
    var u = s.fan ? uchiwa[s.i] : s.towel ? towelG[s.i] : null;
    if (u && u.visible) {
      focus.u = u;
      focus.uOrig = [u.userData.front.material, u.userData.back.material];
      var f = focus.uOrig[0].clone(), b = focus.uOrig[1].clone();
      [f, b].forEach(function(mt) {
        mt.transparent = false;
        mt.opacity = 1;
        mt.depthWrite = true;
        mt.alphaTest = 0.5;
      });
      u.userData.front.material = f;
      u.userData.back.material = b;
      focus.uMats = [f, b];
    }
    if (!glowTexF) glowTexF = canvasTex(128, function(x, n) {
      var g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.3, "rgba(255,255,255,.55)");
      g.addColorStop(0.62, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, n, n);
    });
    focus.halo = fxSprite(glowTexF, 16751312);
    focus.halo.renderOrder = 2;
    focus.halo.material.depthTest = true;
  }
  function clearFocus() {
    if (!focus) return;
    Object.keys(focus.meshes).forEach(function(k) {
      scene.remove(focus.meshes[k]);
      focus.meshes[k].dispose && focus.meshes[k].dispose();
    });
    focus.mats.forEach(function(mt) {
      mt.dispose();
    });
    if (focus.u) {
      focus.u.userData.front.material = focus.uOrig[0];
      focus.u.userData.back.material = focus.uOrig[1];
      focus.uMats.forEach(function(mt) {
        mt.dispose();
      });
    }
    if (focus.halo) {
      fxGroup.remove(focus.halo);
      focus.halo.material.dispose();
    }
    focus = null;
  }
  function tickFocus(now) {
    if (!focus) return;
    var s = focus.s;
    Object.keys(focus.meshes).forEach(function(k) {
      var src = IM[k], n = FOCUS_PARTS[k], m = focus.meshes[k];
      for (var j = 0; j < n; j++) {
        src.getMatrixAt(n === 1 ? s.i : n === 3 ? s.i * 3 + j : s.i * 2 + j, focusM);
        m.setMatrixAt(j, focusM);
      }
      m.instanceMatrix.needsUpdate = true;
    });
    var p = Math.pow(0.5 + 0.5 * Math.sin(now / 1e3 * Math.PI), 2);
    focus.mats.forEach(function(mt) {
      if (mt.emissive) mt.emissiveIntensity = 0.15 + 0.85 * p;
    });
    if (focus.uMats) focus.uMats.forEach(function(mt) {
      mt.emissiveIntensity = 0.3 + 0.7 * p;
    });
    headWorld(s, hw);
    focus.halo.position.set(hw.x, hw.y - 0.25, hw.z);
    var hs = 1.35 + 0.2 * p;
    focus.halo.scale.set(hs, hs * 1.25, 1);
    focus.halo.material.opacity = 0.3 + 0.6 * p;
  }
  var zoomAnim = null, zoomSeat = null, zoomQ = [];
  function homeView() {
    var c = lookCenter(new THREE.Vector3()).sub(eyePos(eye));
    return { yaw: Math.atan2(0 - c.x, -c.z), pitch: Math.atan2(c.y, Math.hypot(c.x, c.z)), fov: IDOL_FOV };
  }
  function showFullResult() {
    clearFanZoom();
    gRes.classList.remove("compact");
    app.classList.remove("rcompact");
    $("rBack").hidden = true;
    S.fov = IDOL_FOV;
    resetLook();
    updateCamera();
    updateMarks();
    $("rWhere").focus({ preventScroll: true });
  }
  function showResultScene() {
    gRes.classList.add("compact");
    app.classList.add("rcompact");
    $("rBack").hidden = false;
    updateMarks();
  }
  $("rBack").addEventListener("click", showFullResult);
  gRes.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && gRes.classList.contains("compact")) {
      e.preventDefault();
      showFullResult();
    }
  });
  $("missMarks").addEventListener("keydown", function(e) {
    if (e.key === "Escape") { e.preventDefault(); showFullResult(); }
  });
  function viewFan(s) {
    zoomQ = [];
    zoomAnim = null;
    clearFocus();
    eyePos(eye);
    headWorld(s, hw);
    hw.y += 0.15;
    var d = hw.clone().sub(eye), dist = d.length();
    var fov = Math.max(7, Math.min(30, 2 * Math.atan(1 / dist) * 180 / Math.PI));
    var yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    var H = canvas.clientHeight, f = H / 2 / Math.tan(fov * fovFactor() * Math.PI / 360);
    if (!gRes.hidden) pitch -= Math.atan((gRes.offsetHeight + 16) / 2 / f);
    setFocus(s);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      S.yaw = yaw;
      S.pitch = pitch;
      S.fov = fov;
      updateCamera();
    } else {
      zoomQ = [{ to: { yaw, pitch, fov }, dur: 900 }, { wait: 2e3 }, { to: homeView(), dur: 900, done: clearFocus }];
    }
  }
  function nextZoom(now) {
    var q = zoomQ.shift();
    if (!q) return;
    if (q.wait) {
      zoomAnim = { wait: true, t0: now, dur: q.wait, done: q.done };
      return;
    }
    q.to.yaw = S.yaw + wrapAng(q.to.yaw - S.yaw);
    zoomAnim = { t0: now, dur: q.dur, from: { yaw: S.yaw, pitch: S.pitch, fov: S.fov }, to: q.to, done: q.done };
  }
  function wrapAng(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }
  function zoomTo(s, cell) {
    document.querySelectorAll("#rGrid .cell.sel").forEach(function(c2) {
      c2.classList.remove("sel");
    });
    var to;
    if (zoomSeat === s) {
      zoomSeat = null;
      clearFocus();
      to = homeView();
    } else {
      zoomSeat = s;
      cell.classList.add("sel");
      setFocus(s);
      eyePos(eye);
      headWorld(s, hw);
      hw.y += 0.15;
      var d = hw.clone().sub(eye), dist = d.length();
      var fov = Math.max(7, Math.min(30, 2 * Math.atan(1 / dist) * 180 / Math.PI));
      var yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      var W = canvas.clientWidth, H = canvas.clientHeight, f = H / 2 / Math.tan(fov * fovFactor() * Math.PI / 360);
      if (!gRes.hidden) {
        if (app.classList.contains("portrait")) pitch -= Math.atan((gRes.offsetHeight + 16) / 2 / f);
        else yaw -= Math.atan((gRes.offsetWidth + 24) / 2 / f);
      }
      to = { yaw, pitch, fov };
    }
    var home = homeView();
    home.yaw = S.yaw + wrapAng(home.yaw - S.yaw);
    var far = Math.abs(home.yaw - S.yaw) + Math.abs(home.pitch - S.pitch) + Math.abs(home.fov - S.fov) / 60 > 0.05;
    if (zoomSeat && far) {
      zoomAnim = { t0: performance.now(), dur: 650, from: { yaw: S.yaw, pitch: S.pitch, fov: S.fov }, to: home, next: to };
      to.yaw = home.yaw + wrapAng(to.yaw - home.yaw);
    } else {
      zoomAnim = { t0: performance.now(), dur: 900, from: { yaw: S.yaw, pitch: S.pitch, fov: S.fov }, to };
      to.yaw = S.yaw + wrapAng(to.yaw - S.yaw);
    }
  }
  function tickZoom(now) {
    if (!zoomAnim) {
      if (!zoomQ.length) return;
      nextZoom(now);
    }
    if (zoomAnim.wait) {
      if (now - zoomAnim.t0 >= zoomAnim.dur) {
        var dn = zoomAnim.done;
        zoomAnim = null;
        if (dn) dn();
      }
      return;
    }
    var t = Math.min(1, (now - zoomAnim.t0) / zoomAnim.dur), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    var a = zoomAnim.from, b = zoomAnim.to;
    S.yaw = a.yaw + (b.yaw - a.yaw) * e;
    S.pitch = a.pitch + (b.pitch - a.pitch) * e;
    S.fov = a.fov + (b.fov - a.fov) * e + Math.sin(t * Math.PI) * 6;
    if (t >= 1) {
      S.fov = b.fov;
      if (zoomAnim.done) zoomAnim.done();
      zoomAnim = zoomAnim.next ? { t0: now, dur: 900, from: { yaw: S.yaw, pitch: S.pitch, fov: S.fov }, to: zoomAnim.next } : null;
    }
    drawMap();
  }
  function updateMarks() {
    var box = $("missMarks"), show = G2.phase === "result" && gRes.classList.contains("compact");
    if (!show) {
      if (!box.hidden) {
        box.hidden = true;
        box.innerHTML = "";
        markEls = [];
      }
      return;
    }
    var miss = G2.fans.filter(function(s) {
      return !s.found;
    });
    if (box.hidden || markEls.length !== miss.length) {
      box.hidden = false;
      box.innerHTML = "";
      markEls = miss.map(function(s) {
        var e = document.createElement("button");
        e.type = "button";
        e.className = "mark";
        e.setAttribute("aria-label", "查看 " + seatLabel(s) + " 未找到的粉絲");
        e.addEventListener("click", function() {
          showResultScene();
          viewFan(s);
        });
        e.innerHTML = '<span class="lab">😢 ' + s.row + "排" + s.num + '號</span><span class="arw"></span>';
        box.appendChild(e);
        return { el: e, s };
      });
    }
    var bottom = gRes.offsetHeight + 24;
    box.style.bottom = bottom + "px";
    box.style.maxHeight = Math.max(60, canvas.clientHeight - bottom - 100) + "px";
  }

  function clearFanZoom() {
    zoomQ = [];
    zoomAnim = null;
    zoomSeat = null;
    gRes.querySelectorAll(".cell.sel").forEach(function(cell) { cell.classList.remove("sel"); });
    clearFocus();
  }
  function clearFanSession() {
    $("fanAim").hidden = true;
    var rebuild = G2.extra || Object.keys(G2.conv).length > 0;
    G2.on = false;
    G2.result = false;
    G2.phase = "idle";
    G2.pausedAt = 0;
    G2.extra = false;
    resetSpecials();
    G2.v101 = false;
    G2.conv = {};
    G2.fans = [];
    clearMoods();
    fxList.forEach(function(f) {
      fxGroup.remove(f.sp);
      f.sp.material.dispose();
    });
    fxList.length = 0;
    seats.forEach(function(s) { s.amp = 1; s.found = false; });
    if (rebuild) updateAudience();
    updateMarks();
    drawMap();
  }
  function closeResult() {
    var restoreView = zoomAnim || zoomSeat || zoomQ.length || S.fov < 40;
    clearFanZoom();
    gRes.classList.remove("compact");
    app.classList.remove("rcompact");
    if (restoreView) {
      if (S.cam && S.cam.idol) {
        S.fov = IDOL_FOV;
        resetLook();
      }
    }
    gRes.hidden = true;
    $("rBack").hidden = true;
    if (G2.phase === "result" || G2.result) clearFanSession();
    if (IDOL && !G2.on && G2.phase !== "countdown" && (typeof MODE === "undefined" || MODE === "game")) {
      $("startPanel").hidden = false;
      if (!RIBBON.active && RIBBON.phase !== "result") $(selectedGame === "ribbon" ? "ribbonStart" : "gStart").focus({ preventScroll: true });
    }
  }
  var selectedGame = "fan";
  function selectGameTab(game) {
    selectedGame = game;
    ["fan", "ribbon"].forEach(function(name) {
      var active = name === game;
      $(name + "Tab").setAttribute("aria-selected", String(active));
      $(name + "Tab").tabIndex = active ? 0 : -1;
      $(name + "Panel").hidden = !active;
    });
    $("gameMemberField").hidden = game !== "fan";
    $("gCard").hidden = game !== "fan";
    $("gameHeading").textContent = game === "fan" ? "找出我的粉絲" : "彩帶投擲挑戰";
    $("startPanel").querySelector(".story").hidden = game !== "fan";
    fitPanels();
  }
  ["fan", "ribbon"].forEach(function(name) {
    $(name + "Tab").addEventListener("click", function() { selectGameTab(name); });
    $(name + "Tab").addEventListener("keydown", function(e) {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      var game = e.key === "Home" ? "fan" : e.key === "End" ? "ribbon" : selectedGame === "fan" ? "ribbon" : "fan";
      selectGameTab(game);
      $(game + "Tab").focus();
    });
  });
  $("ribbonRecordMenu").addEventListener("click", ribbonShowRecords);
  $("ribbonRecordResult").addEventListener("click", ribbonShowRecords);
  $("ribbonRecordClose").addEventListener("click", function() { $("ribbonRecordDialog").close(); });
  $("gStart").addEventListener("click", function() {
    if (GAME_VER === "1.01") { $("intro").hidden = false; $("introGo").focus(); }
    else startGame();
  });
  $("introGo").addEventListener("click", function() {
    $("intro").hidden = true;
    startGame();
  });
  function ribbonCapturePhoto() {
    if(RIBBON.phase!=="result") return false;
    var target=null, previous=renderer.getRenderTarget(), status=$("ribbonExportStatus");
    try {
      var width=1200,height=800,photoCamera=new THREE.PerspectiveCamera(50,width/height,.05,80);
      var framing=ribbonStageView(width/height);photoCamera.fov=framing.fov;photoCamera.updateProjectionMatrix();
      photoCamera.position.copy(framing.position);photoCamera.quaternion.copy(framing.quaternion);
      target=new THREE.WebGLRenderTarget(width,height,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
      target.texture.encoding=THREE.sRGBEncoding;
      RIBBON.settled.forEach(function(f){ribbonUpdateMesh(f,photoCamera.position);});
      renderer.setRenderTarget(target);renderer.render(scene,photoCamera);
      var pixels=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
      var output=document.createElement("canvas");output.width=width;output.height=height+120;
      var ctx=output.getContext("2d"),data=ctx.createImageData(width,height);
      for(var y=0;y<height;y++)data.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);
      ctx.putImageData(data,0,0);ctx.fillStyle="#18101e";ctx.fillRect(0,height,width,120);
      ctx.fillStyle="#ffe5ac";ctx.font="bold 28px sans-serif";
      ctx.fillText("TPE 彩帶挑戰 · 命中 "+RIBBON.hits+" · 完美 "+RIBBON.perfect+" ★",24,height+45);
      ctx.font="20px sans-serif";ctx.fillText("已完成 "+RIBBON.attempts+" 投 · 分數 "+RIBBON.score+" · "+(RIBBON.cleared?"三輪完成":RIBBON.finishReason||"挑戰結束"),24,height+86);
      var url=output.toDataURL("image/png");if(url==="data:,")throw new Error("empty canvas");
      RIBBON.photoURL=url;$("ribbonPhoto").src=url;$("ribbonPhoto").hidden=false;
      status.textContent="成果合照已完成，可儲存圖片；手機也可以長按圖片儲存。";
      return true;
    } catch(error) {
      status.textContent="無法產生合照，請按儲存合照重試，或改用螢幕截圖。";
      console.error("彩帶合照匯出失敗",error);return false;
    } finally {
      renderer.setRenderTarget(previous);if(target)target.dispose();
      RIBBON.settled.forEach(function(f){ribbonUpdateMesh(f);});
    }
  }
  $("ribbonExport").addEventListener("click", function() {
    if(!RIBBON.photoURL && !ribbonCapturePhoto())return;
    var link=document.createElement("a");link.download="TPE-ribbon-round-"+(RIBBON.roundIndex+1)+".png";link.href=RIBBON.photoURL;link.click();
    $("ribbonExportStatus").textContent="合照已產生；若手機未下載，可長按上方圖片儲存。";
  });
  $("ribbonStart").addEventListener("click", function() { startGame("ribbon"); });
  $("ribbonStop").addEventListener("click", function() { finishRibbonGame("你提前結束了這一局。"); });
  $("ribbonNext").addEventListener("click",ribbonContinueRound);
  $("ribbonAgain").addEventListener("click", function() { startGame("ribbon"); });
  $("ribbonClose").addEventListener("click", closeRibbonSummary);
  var MODE = "game";
  function setMode(m) {
    if (G2.on || G2.phase === "countdown" || RIBBON.active) return;
    if (RIBBON.phase === "result") closeRibbonSummary();
    var wasSeat = MODE === "seat";
    MODE = m;
    closeResult();
    S.overview = m === "over";
    $("seatBar").hidden = m !== "seat";
    setMapDock(m === "seat");
    if (m === "seat") {
      fillSeatView();
      setMySeat(S.my, true);
      S.fov = 40;
      resetLook();
      applySeatProps();
    } else {
      if (S.allProps || !S.props || wasSeat) {
        S.allProps = false;
        S.props = true;
        updateAudience();
      }
      if (!S.cam || !S.cam.idol) {
        S.cam = { idol: true, label: "偶像視角（舞台上）" };
        updateAudience();
        drawMap();
      }
      if (S.overview) {
        S.oAz = Math.PI / 4;
        S.oEl = Math.PI / 4;
        S.oR = 21;
      } else {
        S.fov = IDOL_FOV;
        resetLook();
      }
    }
    $("startPanel").hidden = m !== "game";
    [].forEach.call(document.querySelectorAll("#modeBar button"), function(b) {
      b.setAttribute("aria-pressed", String(b.dataset.mode === m));
    });
    updateHud();
  }
  [].forEach.call(document.querySelectorAll("#modeBar button"), function(b) {
    b.addEventListener("click", function() {
      setMode(b.dataset.mode);
    });
  });
  function fillSeatView() {
    var s = seats[S.my], row = $("svRow"), num = $("svNum"), nums = [];
    row.innerHTML = ROW_ORDER.split("").map(function(r) {
      return '<option value="' + r + '">' + r + " 排" + (SIDE_NAME[r] ? "（舞台" + SIDE_NAME[r] + "）" : "") + "</option>";
    }).join("");
    row.value = s.row;
    seats.forEach(function(q) {
      if (q.row === s.row) nums.push(q.num);
    });
    num.innerHTML = nums.map(function(n) {
      return '<option value="' + n + '">' + n + " 號</option>";
    }).join("");
    num.value = String(s.num);
  }
  function onSeatView() {
    var row = $("svRow").value, i = findSeat(row, parseInt($("svNum").value, 10));
    if (i < 0) i = findSeat(row, 1);
    setMySeat(i, true);
    S.fov = 40;
    resetLook();
    fillSeatView();
    updateHud();
  }
  $("svRow").addEventListener("change", onSeatView);
  $("svNum").addEventListener("change", onSeatView);
  function applySeatProps() {
    var v = $("svProps").value;
    S.props = v !== "none";
    S.allProps = v === "all";
    updateAudience();
  }
  $("svProps").addEventListener("change", applySeatProps);
  var modeBarHidden = false, lastFit = -1e9;
  function fitPanels() {
    var tl = document.querySelector(".hud.tl"), bl = document.querySelector(".hud.bl"), sp = $("startPanel");
    var vh = $("view").clientHeight, top = tl.offsetTop + tl.offsetHeight + 8;
    var hideHint = !sp.hidden && vh < 560;
    bl.style.visibility = hideHint ? "hidden" : "";
    var bot = hideHint ? vh - 8 : bl.offsetTop - 8, avail = Math.max(140, bot - top);
    var st = Math.round((top + bot) / 2) + "px", mh = Math.round(avail) + "px";
    if (sp.style.top !== st) sp.style.top = st;
    if (sp.style.maxHeight !== mh) sp.style.maxHeight = mh;
    sp.classList.toggle("compact", avail < 380);
    var gt = Math.round(top) + "px";
    if (gHud.style.top !== gt) gHud.style.top = gt;
    var full = !gRes.hidden && !gRes.classList.contains("compact");
    if (full) {
      bl.style.visibility = "hidden";
      var rb = vh - 8, ra = Math.max(160, rb - top), vw = $("view").clientWidth;
      var rt = Math.round((top + rb) / 2) + "px", rm = Math.round(ra) + "px";
      if (gRes.style.top !== rt) gRes.style.top = rt;
      if (gRes.style.maxHeight !== rm) gRes.style.maxHeight = rm;
      var land = vw > vh;
      gRes.classList.toggle("wide", land && vw > 430 && ra < 470);
      gRes.classList.toggle("tight", ra < 330 || !land && ra < 440 || vw < 380);
    } else if (gRes.style.top) {
      gRes.style.top = "";
      gRes.style.maxHeight = "";
      gRes.classList.remove("wide", "tight");
    }
    var sb = $("seatBar");
    if (sb.style.top !== gt) sb.style.top = gt;
    var md = $("mapDock");
    if (!md.hidden) {
      var dt = Math.round(top + (sb.hidden ? 0 : sb.offsetHeight + 6)) + "px";
      if (md.style.top !== dt) md.style.top = dt;
      var mh = Math.max(130, vh - (top + (sb.hidden ? 0 : sb.offsetHeight + 6)) - 12) + "px";
      if (md.style.maxHeight !== mh) md.style.maxHeight = mh;
      var bd = $("mapDockBody");
      if (bd.style.maxHeight !== mh) bd.style.maxHeight = mh;
    }
    var vb = $("verBox");
    vb.hidden = sp.hidden || selectedGame === "ribbon";
    if (vb.parentNode !== $("fanPanel")) {
      $("fanPanel").insertBefore(vb, $("gStart"));
      vb.classList.add("inpanel");
    }
  }

  var mapHome = map.parentNode, mapNext = map.nextSibling;
  function setMapDock(on) {
    var md = $("mapDock"), body = $("mapDockBody");
    if (on) {
      body.appendChild(map);
      md.hidden = false;
      body.hidden = true;
      $("mapDockBar").setAttribute("aria-expanded", "false");
    } else if (!md.hidden) {
      mapHome.insertBefore(map, mapNext);
      md.hidden = true;
    }
    drawMap();
    lastFit = -1e9;
  }
  $("mapDockBar").addEventListener("click", function() {
    var body = $("mapDockBody"), open = body.hidden;
    body.hidden = !open;
    this.setAttribute("aria-expanded", String(open));
    drawMap();
    lastFit = -1e9;
  });
  function syncModeBar() {
    var h = !!(G2.on || G2.phase === "countdown" || RIBBON.active);
    if (app.classList.contains("playing") !== h) app.classList.toggle("playing", h);
    if (h !== modeBarHidden) {
      modeBarHidden = h;
      $("modeBar").hidden = h;
    }
  }
  $("rAgain").addEventListener("click", startGame);
  $("rClose").addEventListener("click", closeResult);
  $("rWhere").addEventListener("click", function() {
    showResultScene();
    var first = $("missMarks").querySelector("button");
    if (first) first.focus({ preventScroll: true });
    toast("點畫面上沒被找到的粉絲（或紅色箭頭），鏡頭會轉過去看他");
  });
  $("gStop").addEventListener("click", function() {
    endGame(false, true);
  });
  function onAudienceChanged() {
    ribbonClearAudience(false);
    if (RIBBON.active || RIBBON.phase === "result") {
      if (RIBBON.active) finishRibbonGame("觀眾設定變更，這一局已結束。");
      closeRibbonSummary();
      toast("觀眾設定已變更，彩帶挑戰已結束並清除。");
      return;
    }
    if (!G2 || !G2.on && !G2.result && G2.phase !== "countdown") return;
    var still = G2.fans.every(function(q) {
      return isTarget(q) || G2.keep && G2.keep[q.i];
    });
    if (!still) {
      if (G2.on || G2.phase === "countdown") {
        G2.on = false;
        G2.phase = "idle";
        S.blackout = false;
        $("countdown").hidden = true;
        gHud.hidden = true;
        toast("觀眾設定改變了，這一局已結束");
        if (IDOL) $("startPanel").hidden = false;
      }
      closeResult();
      if (G2.extra) clearFanSession();
    }
  }
  function renderMemberTable() {
    $("memberList").innerHTML = TEAMS.map(function(t, k) {
      var counts = t.members.map(function() {
        return 0;
      });
      if (k === S.team) seats.forEach(function(s) {
        if (s.oshi >= 0) counts[s.oshi]++;
      });
      return "<h3>" + t.name + (k === S.team ? "（目前公演）" : "") + "</h3><table><thead><tr><th>成員</th><th>扇上暱稱</th><th>手燈</th>" + (k === S.team ? "<th>粉絲</th>" : "") + "</tr></thead><tbody>" + t.members.map(function(m, j) {
        return "<tr" + (m.tbd ? ' class="tbd"' : "") + "><td>" + esc(m.n) + "</td><td>" + esc(m.nick) + "</td><td>" + swatches(m) + " " + esc(m.cn) + "</td>" + (k === S.team ? '<td class="num">' + counts[j] + "</td>" : "") + "</tr>";
      }).join("") + "</tbody></table>";
    }).join("");
  }
  function fancySelect(sel) {
    var wrap = document.createElement("div");
    wrap.className = "fsel";
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add("fsel-native");
    sel.tabIndex = -1;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fsel-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    var label = sel.getAttribute("aria-label");
    if (!label && wrap.parentElement.tagName === "LABEL") {
      label = Array.from(wrap.parentElement.childNodes).filter(function(node) {
        return node.nodeType === Node.TEXT_NODE;
      }).map(function(node) { return node.textContent; }).join("").trim();
    }
    if (sel.id) btn.setAttribute("aria-controls", sel.id + "-options");
    btn.setAttribute("aria-expanded", "false");
    var list = document.createElement("div");
    list.className = "fsel-list";
    list.setAttribute("role", "listbox");
    if (sel.id) list.id = sel.id + "-options";
    list.hidden = true;
    wrap.appendChild(btn);
    wrap.appendChild(list);
    function sync() {
      var o = sel.options[sel.selectedIndex];
      btn.textContent = o ? o.text : "";
      if (label) btn.setAttribute("aria-label", label + (o ? "：" + o.text : ""));
    }
    function close() {
      list.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
    function open() {
      list.innerHTML = "";
      Array.prototype.forEach.call(sel.options, function(o) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = o.text;
        b.setAttribute("role", "option");
        if (o.value === sel.value) {
          b.className = "on";
          b.setAttribute("aria-selected", "true");
        }
        b.addEventListener("click", function() {
          sel.value = o.value;
          sync();
          close();
          btn.focus();
          sel.dispatchEvent(new Event("change"));
        });
        list.appendChild(b);
      });
      list.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      var on = list.querySelector(".on");
      (on || list.firstElementChild)?.focus();
    }
    btn.addEventListener("click", function() {
      if (list.hidden) open();
      else close();
    });
    wrap.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && !list.hidden) {
        e.preventDefault();
        close();
        btn.focus();
        return;
      }
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      if (list.hidden) { open(); return; }
      var options = Array.from(list.children);
      var index = options.indexOf(document.activeElement);
      if (e.key === "Home") index = 0;
      else if (e.key === "End") index = options.length - 1;
      else index = Math.max(0, Math.min(options.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)));
      if (options[index]) options[index].focus();
    });
    document.addEventListener("pointerdown", function(e) {
      if (!wrap.contains(e.target)) close();
    });
    wrap.addEventListener("focusout", function(e) {
      if (e.relatedTarget && !wrap.contains(e.relatedTarget)) close();
    });
    new MutationObserver(sync).observe(sel, { childList: true });
    sel.syncFancy = sync;
    sync();
  }
  var app = $("app"), rotated = 0, wantLand = true;
  var COARSE = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  function applyLayout() {
    var W = window.innerWidth, H = window.innerHeight, physLand = W > H;
    if (IDOL) wantLand = physLand;
    rotated = IDOL || !COARSE ? 0 : wantLand && !physLand ? 90 : !wantLand && physLand ? -90 : 0;
    app.classList.toggle("portrait", !wantLand);
    app.classList.toggle("rotated", rotated !== 0);
    if (rotated === 90) {
      app.style.width = H + "px";
      app.style.height = W + "px";
      app.style.transform = "translateX(" + W + "px) rotate(90deg)";
    } else if (rotated === -90) {
      app.style.width = H + "px";
      app.style.height = W + "px";
      app.style.transform = "translateY(" + H + "px) rotate(-90deg)";
    } else {
      app.style.width = "";
      app.style.height = "";
      app.style.transform = "";
    }
    $("oLand").setAttribute("aria-pressed", String(wantLand));
    $("oPort").setAttribute("aria-pressed", String(!wantLand));
    resize();
    drawMap();
  }
  function setOrient(land) {
    wantLand = land;
    applyLayout();
  }
  $("oLand").addEventListener("click", function() {
    setOrient(true);
  });
  $("oPort").addEventListener("click", function() {
    setOrient(false);
  });
  function elLocal(el, cx, cy) {
    if (!rotated) {
      var r = el.getBoundingClientRect();
      return { x: cx - r.left, y: cy - r.top };
    }
    var px = rotated === 90 ? cy : window.innerHeight - cy, py = rotated === 90 ? window.innerWidth - cx : cx, x = 0, y = 0, o = el, a;
    while (o && o !== app) {
      x += o.offsetLeft;
      y += o.offsetTop;
      o = o.offsetParent;
    }
    for (a = el.parentNode; a && a !== app; a = a.parentNode) {
      x -= a.scrollLeft || 0;
      y -= a.scrollTop || 0;
    }
    return { x: px - x, y: py - y };
  }
  window.addEventListener("resize", applyLayout);
  window.addEventListener("orientationchange", function() {
    setTimeout(applyLayout, 120);
  });
  var DRAG_GAIN = 1.4;
  var drag = null;
  var ptrs = {}, pinch = null;
  function ptrDist() {
    var k = Object.keys(ptrs);
    return Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y);
  }
  function setOR(v) {
    S.oR = Math.min(28, Math.max(5, v));
  }
  function gameZoomOK() {
    return G2.on && !zoomAnim && S.cam && S.cam.idol;
  }
  function setGameZoom(f) {
    var minF = 2 * Math.atan(Math.tan(IDOL_FOV * Math.PI / 360) / 1.35) * 180 / Math.PI;
    S.fov = Math.min(IDOL_FOV, Math.max(minF, f));
    drawMap();
  }
  function ribbonCancelGesture() {
    var g = RIBBON.gesture;
    RIBBON.gesture = null;
    if (g) { try { if (canvas.hasPointerCapture(g.id)) canvas.releasePointerCapture(g.id); } catch (error) {} }
  }
  canvas.addEventListener("lostpointercapture", function(e) {
    if (RIBBON.gesture && RIBBON.gesture.id === e.pointerId) { ribbonCancelGesture(); ribbonSetPower(0); }
  });
  canvas.addEventListener("pointerdown", function(e) {
    if (!RIBBON.active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) { ribbonCancelGesture(); ribbonSetPower(0); return; }
    if (RIBBON.phase !== "play" || !RIBBON.window || RIBBON.flight || RIBBON.gesture) return;
    if(!ribbonRequireVisibleTarget())return;
    var p = elLocal(canvas, e.clientX, e.clientY);
    RIBBON.gesture = { width:canvas.clientWidth, height:canvas.clientHeight, id: e.pointerId, x0: p.x, y0: p.y, points: [{ x: p.x, y: p.y, t: e.timeStamp }] };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }, true);
  canvas.addEventListener("pointermove", function(e) {
    if (!RIBBON.active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var g = RIBBON.gesture;
    if (!g || e.pointerId !== g.id) return;
    var p = elLocal(canvas, e.clientX, e.clientY);
    g.points.push({ x: p.x, y: p.y, t: e.timeStamp });
    if (g.points.length > 40) g.points.shift();
    var m = ribbonMetrics(g);
    ribbonSetPower(m.power);
  }, true);
  canvas.addEventListener("pointerup", function(e) {
    if (!RIBBON.active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var g = RIBBON.gesture;
    if (!g || e.pointerId !== g.id) return;
    var p = elLocal(canvas, e.clientX, e.clientY), m = ribbonMetrics(g, { x: p.x, y: p.y, t: e.timeStamp });
    ribbonCancelGesture();
    if (m.travel < 0.06) { ribbonSetPower(0); return; }
    if (m.speed < 0.5) { ribbonSetPower(0); toast("請再快一點向上滑動，才能投出彩帶。"); SFX.miss(); return; }
    ribbonLaunch(m.power, m.alpha, performance.now());
  }, true);
  canvas.addEventListener("pointercancel", function(e) {
    if (!RIBBON.active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (RIBBON.gesture && e.pointerId === RIBBON.gesture.id) ribbonCancelGesture();
    ribbonSetPower(0);
  }, true);
  canvas.addEventListener("pointerdown", function(e) {
    var p = elLocal(canvas, e.clientX, e.clientY);
    if (e.pointerType === "mouse" && e.button !== 0) return;
    clearFanZoom();
    ptrs[e.pointerId] = p;
    canvas.setPointerCapture(e.pointerId);
    if (Object.keys(ptrs).length === 2 && (S.overview || gameZoomOK())) {
      pinch = ptrDist();
      drag = null;
      return;
    }
    drag = Object.keys(ptrs).length === 1 ? { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y } : null;
  });
  canvas.addEventListener("pointermove", function(e) {
    var p = elLocal(canvas, e.clientX, e.clientY);
    if (ptrs[e.pointerId]) ptrs[e.pointerId] = p;
    if (pinch && Object.keys(ptrs).length === 2) {
      var d = ptrDist();
      if (d > 10) {
        if (S.overview) setOR(S.oR * pinch / d);
        else if (gameZoomOK()) setGameZoom(S.fov * pinch / d);
        pinch = d;
      }
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    var dx = p.x - drag.x, dy = p.y - drag.y;
    drag.x = p.x;
    drag.y = p.y;
    if (S.overview) {
      S.oAz -= dx * 6e-3;
      S.oEl = Math.min(1.5, Math.max(0.08, S.oEl + dy * 6e-3));
    } else {
      var k = DRAG_GAIN * (S.fov * (stageGameView() ? fovFactor() : 1) * Math.PI / 180) / canvas.clientHeight;
      S.yaw += dx * k;
      S.pitch = Math.min(1.4, Math.max(-1.4, S.pitch + dy * k));
      drawMap();
    }
  });
  function endDrag(e) {
    drag = null;
    if (e) delete ptrs[e.pointerId];
    if (Object.keys(ptrs).length < 2) pinch = null;
  }
  canvas.addEventListener("pointerup", function(e) {
    var p = elLocal(canvas, e.clientX, e.clientY);
    var tap = drag && drag.id === e.pointerId && (e.pointerType !== "mouse" || e.button === 0) && Math.hypot(p.x - drag.sx, p.y - drag.sy) < (TOUCH ? 14 : 8);
    if (tap && G2.on) onGameClick(p.x, p.y);
    else if (tap && G2.phase === "result" && gRes.classList.contains("compact")) {
      var fs = pickSeat(p.x, p.y);
      if (fs && isTarget(fs) && !fs.found) viewFan(fs);
    }
    endDrag(e);
  });
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", function(e) {
    if (ptrs[e.pointerId]) endDrag(e);
  });
  canvas.addEventListener("wheel", function(e) {
    e.preventDefault();
    if (S.overview) setOR(S.oR + e.deltaY * 0.012);
    else if (gameZoomOK()) setGameZoom(S.fov * (1 + e.deltaY * 12e-4));
  }, { passive: false });
  canvas.addEventListener("keydown", function(e) {
    if (RIBBON.active) return;
    if (G2.on && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      if (!e.repeat) {
        updateCamera();
        onGameClick(canvas.clientWidth / 2, canvas.clientHeight / 2);
      }
      return;
    }
    if (e.key === "Escape" && G2.phase === "result" && gRes.classList.contains("compact")) {
      e.preventDefault();
      showFullResult();
      return;
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) clearFanZoom();
    var st = 0.042, hit = true;
    if (S.overview) {
      if (e.key === "ArrowLeft") S.oAz += st;
      else if (e.key === "ArrowRight") S.oAz -= st;
      else if (e.key === "ArrowUp") S.oEl = Math.min(1.5, S.oEl + st);
      else if (e.key === "ArrowDown") S.oEl = Math.max(0.08, S.oEl - st);
      else hit = false;
    } else if (e.key === "ArrowLeft") S.yaw += st;
    else if (e.key === "ArrowRight") S.yaw -= st;
    else if (e.key === "ArrowUp") S.pitch = Math.min(1.4, S.pitch + st);
    else if (e.key === "ArrowDown") S.pitch = Math.max(-1.4, S.pitch - st);
    else hit = false;
    if (hit) {
      e.preventDefault();
      drawMap();
    }
  });
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if(RIBBON && (RIBBON.active || RIBBON.phase === "result")) {
      var gesture=RIBBON.gesture;
      if(gesture && (gesture.width!==w || gesture.height!==h)) {ribbonCancelGesture();ribbonSetPower(0);}
      updateCamera();camera.updateMatrixWorld(true);
    } else updateCamera();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe($("view"));
  else window.addEventListener("resize", resize);
  var t0 = performance.now();
  function frame(now) {
    try {
      frameBody(now);
    } catch (err) {
      if (!frame.warned) {
        frame.warned = true;
        console.error(err);
      }
    }
    requestAnimationFrame(frame);
  }
  function frameBody(now) {
    var t = (now - t0) / 1e3;
    placePerformers(t);
    wavePens(t);
    tickGif(now);
    updateLights(t);
    tickZoom(now);
    updateCamera();
    tickGame(now);
    ribbonTick(now);
    ribbonTickAudience(now);
    placeMoods(now);
    updateFx(now);
    placeGlasses(now);
    placeShirt();
    tickAudio();
    updateMarks();
    tickFocus(now);
    if (IDOL) {
      syncModeBar();
      if (now - lastFit > 200) {
        lastFit = now;
        fitPanels();
      }
    }
    ribbonRenderFrame();
  }
  buildSeats();
  buildPlatforms();
  S.my = findSeat("F", 5);
  colorAudience();
  updateAudience();
  updateMe();
  if (IDOL) {
    S.mode = "model";
    S.nPerf = 8;
  } else initGif();
  buildPerformers();
  applyStage();
  applyMode();
  fillSelects();
  fillGameSelects();
  renderMemberTable();
  document.querySelectorAll("select").forEach(fancySelect);
  wantLand = window.innerWidth >= window.innerHeight;
  applyLayout();
  if (IDOL) {
    setCam("idol");
  }
  resetLook();
  updateCamera();
  updateHud();
  drawMap();
  requestAnimationFrame(frame);
})();
