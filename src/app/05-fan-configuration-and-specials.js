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
