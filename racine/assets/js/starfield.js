// Racine — fond "Cortex" : réseau de neurones (dendrites courbes + signaux qui pulsent)
window.RAStarfield = (function () {
  var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  var colors = {
    dark: { line: '52,211,153', line2: '34,211,238', dot: '110,231,183', dotAlpha: 0.65, lineAlpha: 0.16, pulse: '190,255,230' },
    light: { line: '5,150,105', line2: '8,145,178', dot: '5,150,105', dotAlpha: 0.4, lineAlpha: 0.14, pulse: '5,150,105' },
  };

  function init() {
    var canvas = document.getElementById('starfield');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w, h, dpr;
    var points = [];
    var edges = [];
    var pulses = [];
    var COUNT = 26;
    var LINK_DIST = 150;
    var lastSpawn = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makePoints() {
      points = [];
      for (var i = 0; i < COUNT; i++) {
        points.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.1,
          vy: (Math.random() - 0.5) * 0.1,
          r: Math.random() * 1.4 + 0.8,
          bias: (Math.random() - 0.5) * 0.6,
        });
      }
      pulses = [];
    }

    function curvePoint(a, b, bias, t) {
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len, ny = dx / len;
      var offset = len * bias;
      var cx = mx + nx * offset, cy = my + ny * offset;
      var u = 1 - t;
      return {
        x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
        y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
        cx: cx, cy: cy,
      };
    }

    function step(now) {
      var c = colors[theme];
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      edges = [];
      for (var i = 0; i < points.length; i++) {
        for (var j = i + 1; j < points.length; j++) {
          var a = points[i], b = points[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            var bias = (a.bias + b.bias) / 2;
            var alpha = c.lineAlpha * (1 - dist / LINK_DIST);
            var col = (i + j) % 2 === 0 ? c.line : c.line2;
            ctx.strokeStyle = 'rgba(' + col + ',' + alpha + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            var mid = curvePoint(a, b, bias, 0.5);
            ctx.quadraticCurveTo(mid.cx, mid.cy, b.x, b.y);
            ctx.stroke();
            edges.push({ a: a, b: b, bias: bias });
          }
        }
      }

      if (now - lastSpawn > 1400 && edges.length) {
        lastSpawn = now;
        var edge = edges[Math.floor(Math.random() * edges.length)];
        pulses.push({ edge: edge, start: now, dur: 900 + Math.random() * 500, rev: Math.random() < 0.5 });
      }
      pulses = pulses.filter(function (pu) { return now - pu.start < pu.dur; });
      pulses.forEach(function (pu) {
        var t = (now - pu.start) / pu.dur;
        var from = pu.rev ? pu.edge.b : pu.edge.a;
        var to = pu.rev ? pu.edge.a : pu.edge.b;
        var pos = curvePoint(from, to, pu.edge.bias, t);
        var fade = t < 0.15 ? t / 0.15 : (1 - (t - 0.15) / 0.85);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + c.pulse + ',' + (0.9 * fade) + ')';
        ctx.shadowColor = 'rgba(' + c.pulse + ',0.9)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + c.dot + ',' + c.dotAlpha + ')';
        ctx.fill();
      }

      requestAnimationFrame(step);
    }

    resize();
    makePoints();
    window.addEventListener('resize', function () {
      resize();
      makePoints();
    });
    requestAnimationFrame(step);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    setTheme: function (t) { theme = t === 'light' ? 'light' : 'dark'; },
  };
})();
