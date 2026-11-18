
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
