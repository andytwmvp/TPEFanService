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
