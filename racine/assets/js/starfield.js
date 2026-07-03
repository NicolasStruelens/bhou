// Racine — fond "constellation" : particules qui dérivent + lignes entre voisins proches
(function () {
  function init() {
    var canvas = document.getElementById('starfield');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w, h, dpr;
    var points = [];
    var COUNT = 60;
    var LINK_DIST = 120;

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
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          r: Math.random() * 1.2 + 0.4,
        });
      }
    }

    function step() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      for (var i = 0; i < points.length; i++) {
        for (var j = i + 1; j < points.length; j++) {
          var a = points[i], b = points[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            ctx.strokeStyle = 'rgba(124,108,255,' + (0.12 * (1 - dist / LINK_DIST)) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(232,236,255,0.5)';
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
})();
