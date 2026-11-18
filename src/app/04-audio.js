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
