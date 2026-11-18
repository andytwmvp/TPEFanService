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
