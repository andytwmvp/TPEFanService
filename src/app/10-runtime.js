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
