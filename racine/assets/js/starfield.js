// Racine v53 — Univers neuronal réactif.
// Le fond n'est plus un décor : il respire avec la vue et répond aux gestes de l'utilisateur.
window.RAStarfield = window.RAUniverse = (function () {
  var canvas, ctx, fxCanvas, fxCtx, w = 0, h = 0, dpr = 1;
  var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  var scene = 'today';
  var requestedCount = 28;
  var points = [], edges = [], pulses = [], particles = [], rings = [], waves = [];
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  var raf = 0, lastFrame = 0, lastPulse = 0, lastBurst = 0, typingTimer = 0;
  var hidden = document.hidden;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var mobile = window.matchMedia('(max-width: 720px)').matches;
  var activePalette = null, targetPalette = null;

  var PALETTES = {
    dark: {
      login:     { a: [52,211,153], b: [34,211,238], c: [167,139,250], bg: [2,6,23] },
      today:     { a: [52,211,153], b: [34,211,238], c: [255,210,63], bg: [2,6,23] },
      notes:     { a: [34,211,238], b: [52,211,153], c: [129,140,248], bg: [2,6,23] },
      graph:     { a: [129,140,248], b: [34,211,238], c: [192,132,252], bg: [3,4,20] },
      clips:     { a: [56,189,248], b: [34,211,238], c: [52,211,153], bg: [2,6,23] },
      recipes:   { a: [251,191,36], b: [52,211,153], c: [251,113,133], bg: [8,7,17] },
      reminders: { a: [255,210,63], b: [251,113,133], c: [34,211,238], bg: [8,6,16] },
      completed: { a: [52,211,153], b: [163,230,53], c: [255,210,63], bg: [2,9,17] },
      trash:     { a: [244,114,182], b: [167,139,250], c: [100,116,139], bg: [7,5,17] },
    },
    light: {
      login:     { a: [5,150,105], b: [8,145,178], c: [109,40,217], bg: [240,247,244] },
      today:     { a: [5,150,105], b: [8,145,178], c: [184,134,11], bg: [240,247,244] },
      notes:     { a: [8,145,178], b: [5,150,105], c: [79,70,229], bg: [240,247,244] },
      graph:     { a: [79,70,229], b: [8,145,178], c: [126,34,206], bg: [243,244,255] },
      clips:     { a: [2,132,199], b: [8,145,178], c: [5,150,105], bg: [240,247,250] },
      recipes:   { a: [180,110,8], b: [5,150,105], c: [225,29,72], bg: [250,247,238] },
      reminders: { a: [184,134,11], b: [225,29,72], c: [8,145,178], bg: [250,247,238] },
      completed: { a: [5,150,105], b: [77,124,15], c: [184,134,11], bg: [240,248,241] },
      trash:     { a: [190,24,93], b: [109,40,217], c: [71,85,105], bg: [248,242,248] },
    },
  };

  function clonePalette(p) {
    return { a: p.a.slice(), b: p.b.slice(), c: p.c.slice(), bg: p.bg.slice() };
  }
  function paletteFor(nextScene) {
    var bank = PALETTES[theme] || PALETTES.dark;
    return bank[nextScene] || bank.today;
  }
  function rgb(v, alpha) { return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + alpha + ')'; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixPalette() {
    if (!activePalette) activePalette = clonePalette(paletteFor(scene));
    if (!targetPalette) targetPalette = clonePalette(paletteFor(scene));
    ['a', 'b', 'c', 'bg'].forEach(function (key) {
      for (var i = 0; i < 3; i++) activePalette[key][i] = lerp(activePalette[key][i], targetPalette[key][i], 0.035);
    });
  }
  function point(x, y) {
    return {
      x: x == null ? Math.random() * w : x,
      y: y == null ? Math.random() * h : y,
      vx: (Math.random() - .5) * .085,
      vy: (Math.random() - .5) * .085,
      r: .75 + Math.random() * 1.35,
      bias: (Math.random() - .5) * .52,
      phase: Math.random() * Math.PI * 2,
    };
  }
  function targetCount() {
    var cap = mobile ? 24 : 58;
    var base = mobile ? 17 : 25;
    if (saveData) cap = Math.min(cap, 20);
    return Math.max(base, Math.min(cap, requestedCount));
  }
  function reconcilePoints() {
    var wanted = targetCount();
    while (points.length < wanted) points.push(point());
    if (points.length > wanted) points.length = wanted;
  }
  function resize() {
    if (!canvas) return;
    mobile = window.matchMedia('(max-width: 720px)').matches;
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.45 : 1.8);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (fxCanvas && fxCtx) {
      fxCanvas.width = Math.round(w * dpr); fxCanvas.height = Math.round(h * dpr);
      fxCanvas.style.width = w + 'px'; fxCanvas.style.height = h + 'px';
      fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    reconcilePoints();
  }
  function curve(a, b, bias, t) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var cx = mx + (-dy / len) * len * bias, cy = my + (dx / len) * len * bias, u = 1 - t;
    return { x: u*u*a.x + 2*u*t*cx + t*t*b.x, y: u*u*a.y + 2*u*t*cy + t*t*b.y, cx: cx, cy: cy };
  }
  function coords(source) {
    if (source && typeof source.x === 'number') return { x: source.x, y: source.y };
    if (source && source.getBoundingClientRect) {
      var r = source.getBoundingClientRect();
      return { x: Math.max(0, Math.min(w, r.left + r.width / 2)), y: Math.max(0, Math.min(h, r.top + r.height / 2)) };
    }
    return { x: w * (.42 + Math.random() * .16), y: h * (.38 + Math.random() * .24) };
  }
  function colorFor(type) {
    var p = activePalette || paletteFor(scene);
    if (type === 'delete') return theme === 'light' ? [190,24,93] : [255,84,112];
    if (type === 'harvest' || type === 'restore') return p.a;
    if (type === 'link') return p.b;
    if (type === 'reminder') return p.c;
    return type === 'typing' ? p.b : p.a;
  }
  function ring(x, y, color, options) {
    options = options || {};
    rings.push({
      x: x, y: y, color: color, born: performance.now(),
      life: options.life || 900, max: options.max || 90,
      inward: !!options.inward, width: options.width || 1.4,
    });
  }
  function spark(x, y, color, count, mode) {
    count = Math.min(count || 10, mobile ? 12 : 22);
    for (var i = 0; i < count; i++) {
      var angle = Math.PI * 2 * (i / count) + (Math.random() - .5) * .45;
      var speed = mode === 'collapse' ? .25 + Math.random() * .45 : .45 + Math.random() * 1.15;
      var dist = mode === 'collapse' ? 38 + Math.random() * 46 : 0;
      particles.push({
        x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * speed * (mode === 'collapse' ? -1 : 1),
        vy: Math.sin(angle) * speed * (mode === 'collapse' ? -1 : 1),
        color: color, born: performance.now(), life: 550 + Math.random() * 520,
        size: .8 + Math.random() * 2.1, leaf: mode === 'leaf',
      });
    }
  }
  function nearbyPulse(x, y, count, color) {
    if (!edges.length) return;
    edges.slice().sort(function (e1, e2) {
      var d1 = Math.hypot(e1.a.x - x, e1.a.y - y) + Math.hypot(e1.b.x - x, e1.b.y - y);
      var d2 = Math.hypot(e2.a.x - x, e2.a.y - y) + Math.hypot(e2.b.x - x, e2.b.y - y);
      return d1 - d2;
    }).slice(0, count || 4).forEach(function (edge, index) {
      pulses.push({ edge: edge, born: performance.now() + index * 55, life: 650 + index * 55, reverse: index % 2, color: color, strong: true });
    });
  }
  function surfaceReact(source, type) {
    if (!source || !source.classList) return;
    source.classList.remove('universe-react-' + type);
    void source.offsetWidth;
    source.classList.add('universe-react-' + type);
    setTimeout(function () { source.classList.remove('universe-react-' + type); }, 780);
  }
  function emit(type, source, options) {
    if (!canvas || reduceMotion) return;
    options = options || {};
    var p = coords(source), color = options.color || colorFor(type);
    if (type === 'typing') {
      ring(p.x, p.y, color, { life: 470, max: 28, width: 1 });
      nearbyPulse(p.x, p.y, 2, color);
      return;
    }
    if (type === 'touch') {
      ring(p.x, p.y, color, { life: 430, max: 34, width: 1 });
      return;
    }
    if (type === 'delete') {
      ring(p.x, p.y, color, { life: 680, max: 72, inward: true, width: 1.8 });
      spark(p.x, p.y, color, 15, 'collapse');
      nearbyPulse(p.x, p.y, 5, color);
    } else if (type === 'link') {
      ring(p.x, p.y, color, { life: 850, max: 110 });
      nearbyPulse(p.x, p.y, 8, color);
      waves.push({ born: performance.now(), life: 1000, color: color, y: p.y, direction: 1 });
    } else if (type === 'harvest') {
      ring(p.x, p.y, color, { life: 1000, max: 120, width: 2 });
      spark(p.x, p.y, color, 18, 'leaf');
      nearbyPulse(p.x, p.y, 7, color);
    } else if (type === 'restore') {
      ring(p.x, p.y, color, { life: 850, max: 95, inward: true });
      spark(p.x, p.y, color, 12, 'normal');
    } else if (type === 'view') {
      waves.push({ born: performance.now(), life: 1150, color: color, y: p.y, direction: Math.random() < .5 ? -1 : 1 });
      nearbyPulse(p.x, p.y, 6, color);
    } else {
      ring(p.x, p.y, color, { life: 900, max: type === 'create' ? 125 : 85, width: 1.7 });
      spark(p.x, p.y, color, type === 'create' ? 18 : 10, type === 'create' ? 'leaf' : 'normal');
      nearbyPulse(p.x, p.y, type === 'create' ? 7 : 4, color);
    }
    surfaceReact(source, type);
  }
  function setScene(next, source) {
    next = PALETTES[theme][next] ? next : 'today';
    if (scene === next && activePalette) return;
    scene = next;
    document.documentElement.setAttribute('data-scene', next);
    targetPalette = clonePalette(paletteFor(next));
    emit('view', source || { x: w / 2, y: Math.min(120, h * .18) });
  }
  function setTheme(next) {
    theme = next === 'light' ? 'light' : 'dark';
    targetPalette = clonePalette(paletteFor(scene));
    emit('view', { x: w * .8, y: 70 });
  }
  function connectPoints() {
    edges = [];
    var limit = mobile ? 132 : 158;
    for (var i = 0; i < points.length; i++) {
      for (var j = i + 1; j < points.length; j++) {
        var a = points[i], b = points[j], dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < limit) edges.push({ a: a, b: b, bias: (a.bias + b.bias) / 2, ai: i, bi: j, dist: dist, limit: limit });
      }
    }
  }
  function drawNetwork(now) {
    var p = activePalette, lineAlpha = theme === 'light' ? .115 : .14;
    ctx.save();
    ctx.translate(pointer.x, pointer.y);
    edges.forEach(function (edge, index) {
      var alpha = lineAlpha * (1 - edge.dist / edge.limit);
      var col = index % 3 === 0 ? p.b : p.a;
      var mid = curve(edge.a, edge.b, edge.bias, .5);
      ctx.beginPath(); ctx.moveTo(edge.a.x, edge.a.y); ctx.quadraticCurveTo(mid.cx, mid.cy, edge.b.x, edge.b.y);
      ctx.strokeStyle = rgb(col, alpha); ctx.lineWidth = .85; ctx.stroke();
    });
    points.forEach(function (node) {
      var breath = .75 + Math.sin(now * .00065 + node.phase) * .25;
      ctx.beginPath(); ctx.arc(node.x, node.y, node.r * breath, 0, Math.PI * 2);
      ctx.fillStyle = rgb(p.a, (theme === 'light' ? .32 : .56) * breath); ctx.fill();
    });
    ctx.restore();
  }
  function drawPulses(now) {
    var p = activePalette;
    if (now - lastPulse > 1250 && edges.length) {
      lastPulse = now;
      var e = edges[Math.floor(Math.random() * edges.length)];
      pulses.push({ edge: e, born: now, life: 900 + Math.random() * 420, reverse: Math.random() < .5, color: p.b });
    }
    if (now - lastBurst > 7200 && edges.length) {
      lastBurst = now + Math.random() * 2600;
      var hub = Math.floor(Math.random() * points.length);
      edges.filter(function (e) { return e.ai === hub || e.bi === hub; }).slice(0, 7).forEach(function (e, i) {
        pulses.push({ edge: e, born: now + i * 52, life: 720, reverse: e.bi === hub, color: p.c, strong: true });
      });
    }
    pulses = pulses.filter(function (pulse) { return now - pulse.born < pulse.life; });
    pulses.forEach(function (pulse) {
      if (now < pulse.born) return;
      var t = (now - pulse.born) / pulse.life, from = pulse.reverse ? pulse.edge.b : pulse.edge.a, to = pulse.reverse ? pulse.edge.a : pulse.edge.b;
      var pos = curve(from, to, pulse.edge.bias, t), fade = Math.sin(Math.PI * t);
      ctx.beginPath(); ctx.arc(pos.x + pointer.x, pos.y + pointer.y, pulse.strong ? 2.8 : 1.9, 0, Math.PI * 2);
      ctx.fillStyle = rgb(pulse.color || p.b, .86 * fade);
      ctx.shadowColor = rgb(pulse.color || p.b, .75); ctx.shadowBlur = pulse.strong ? 12 : 7; ctx.fill(); ctx.shadowBlur = 0;
    });
  }
  function drawEffects(now) {
    var paint = fxCtx || ctx;
    rings = rings.filter(function (r) { return now - r.born < r.life; });
    rings.forEach(function (r) {
      var t = (now - r.born) / r.life, radius = r.inward ? r.max * (1 - t) : 8 + r.max * t;
      paint.beginPath(); paint.arc(r.x, r.y, Math.max(2, radius), 0, Math.PI * 2);
      paint.strokeStyle = rgb(r.color, Math.sin(Math.PI * t) * .48); paint.lineWidth = r.width; paint.stroke();
    });
    particles = particles.filter(function (p) { return now - p.born < p.life; });
    particles.forEach(function (p) {
      var age = (now - p.born) / p.life;
      p.x += p.vx; p.y += p.vy; p.vx *= .985; p.vy = p.vy * .985 + (p.leaf ? .008 : 0);
      paint.save(); paint.translate(p.x, p.y); paint.rotate(Math.atan2(p.vy, p.vx) + age * 2);
      paint.fillStyle = rgb(p.color, (1 - age) * .78);
      if (p.leaf) { paint.beginPath(); paint.ellipse(0, 0, p.size * 1.7, p.size * .7, 0, 0, Math.PI * 2); paint.fill(); }
      else { paint.beginPath(); paint.arc(0, 0, p.size * (1 - age * .45), 0, Math.PI * 2); paint.fill(); }
      paint.restore();
    });
    waves = waves.filter(function (wave) { return now - wave.born < wave.life; });
    waves.forEach(function (wave) {
      var t = (now - wave.born) / wave.life, x = wave.direction > 0 ? -w * .15 + w * 1.3 * t : w * 1.15 - w * 1.3 * t;
      var grad = paint.createLinearGradient(x - 120, 0, x + 120, 0);
      grad.addColorStop(0, rgb(wave.color, 0)); grad.addColorStop(.5, rgb(wave.color, Math.sin(Math.PI * t) * .055)); grad.addColorStop(1, rgb(wave.color, 0));
      paint.fillStyle = grad; paint.fillRect(x - 120, 0, 240, h);
    });
  }
  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (hidden) return;
    var minFrame = mobile || saveData ? 32 : 16;
    if (now - lastFrame < minFrame) return;
    lastFrame = now;
    mixPalette(); reconcilePoints();
    pointer.x += (pointer.tx - pointer.x) * .035; pointer.y += (pointer.ty - pointer.y) * .035;
    ctx.clearRect(0, 0, w, h);
    if (fxCtx) fxCtx.clearRect(0, 0, w, h);
    points.forEach(function (p) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -15 || p.x > w + 15) p.vx *= -1;
      if (p.y < -15 || p.y > h + 15) p.vy *= -1;
    });
    connectPoints(); drawNetwork(now);
    if (!reduceMotion) { drawPulses(now); drawEffects(now); }
  }
  function writingTarget(el) {
    return el.closest('.capture-bar, .deposit-card, .modal-card, .clip-form, .recipe-form, .search-wrap, .harvest-search') || el;
  }
  function bindReactivity() {
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (!el.matches || !el.matches('input, textarea')) return;
      var surface = writingTarget(el);
      surface.classList.add('neural-writing');
      clearTimeout(typingTimer);
      typingTimer = setTimeout(function () { surface.classList.remove('neural-writing'); }, 650);
      var now = Date.now();
      if (!el._lastNeuralPulse || now - el._lastNeuralPulse > 130) {
        el._lastNeuralPulse = now; emit('typing', el);
      }
    }, true);
    document.addEventListener('pointerdown', function (e) {
      var interactive = e.target.closest && e.target.closest('button, [role="button"], a');
      if (interactive && !interactive.disabled) emit('touch', interactive);
    }, true);
    document.addEventListener('visibilitychange', function () { hidden = document.hidden; });
    window.addEventListener('mousemove', function (e) {
      pointer.tx = (e.clientX / Math.max(w, 1) - .5) * 14;
      pointer.ty = (e.clientY / Math.max(h, 1) - .5) * 10;
    }, { passive: true });
  }
  function inferInitialScene() {
    if (document.querySelector('.login-shell')) return 'login';
    var active = document.querySelector('.view.active');
    return active ? active.id.replace('view-', '') : 'today';
  }
  function init() {
    canvas = document.getElementById('starfield');
    if (!canvas) return;
    canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d', { alpha: true });
    fxCanvas = document.createElement('canvas');
    fxCanvas.id = 'neuralEffects';
    fxCanvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fxCanvas);
    fxCtx = fxCanvas.getContext('2d', { alpha: true });
    scene = inferInitialScene();
    document.documentElement.setAttribute('data-scene', scene);
    activePalette = clonePalette(paletteFor(scene)); targetPalette = clonePalette(activePalette);
    resize(); bindReactivity();
    window.addEventListener('resize', resize, { passive: true });
    cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    emit: emit,
    setTheme: setTheme,
    setScene: setScene,
    setNodeCount: function (n) { requestedCount = Math.max(14, Number(n) || 26); },
    snapshot: function () { return { scene: scene, theme: theme, points: points.length, effects: rings.length + particles.length + waves.length, reducedMotion: reduceMotion }; },
  };
})();
