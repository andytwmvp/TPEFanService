  // Pure gesture calculations: dependencies enter through arguments, never DOM or game state.
  var RibbonInput = (function() {
    "use strict";
    function powerOf(speed) {
      var u = Math.max(0, Math.min(1, (speed - 0.5) / (7 - 0.5)));
      return 1.35 * Math.pow(u, 0.75);
    }
    function metrics(g, last, viewHeight) {
      var pts = g.points.slice();
      if (last) pts.push(last);
      if (pts.length < 2) return { speed: 0, alpha: 0, travel: 0, power: 0 };
      var end = pts[pts.length - 1], i = pts.length - 1;
      while (i > 0 && end.t - pts[i - 1].t <= 100) i--;
      var first = pts[i], elapsed = Math.max(16, end.t - first.t) / 1000;
      var dx = end.x - first.x, dy = end.y - first.y;
      var speed = Math.hypot(dx, dy) / elapsed / Math.max(1, viewHeight);
      return { speed: speed, alpha: Math.atan2(dx, -dy) * 180 / Math.PI,
        travel: Math.hypot(end.x - g.x0, end.y - g.y0) / Math.max(1, viewHeight),
        power: powerOf(speed) };
    }
    function aimOffset(deg, physics) {
      var sign = Math.sign(deg), mag = Math.min(180, Math.abs(deg)), wild = physics.wildFrom;
      var offset = sign * Math.max(0, Math.min(mag, wild) - physics.yawDead) * Math.PI / 180;
      var normal = offset * physics.yawGain;
      return mag <= wild ? normal : sign * (Math.abs(normal) + (mag - wild) * (Math.PI - Math.abs(normal)) / (180 - wild));
    }
    return Object.freeze({ powerOf: powerOf, metrics: metrics, aimOffset: aimOffset });
  })();
