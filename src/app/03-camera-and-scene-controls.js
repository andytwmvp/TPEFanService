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
