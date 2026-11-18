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
