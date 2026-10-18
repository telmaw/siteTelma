/* Telma Soares · Proposta 02 · movimento v1.0.0
 * Dependência: window.TelmaBrandGeometry (carregada antes deste arquivo).
 * Sem rede, importações, tipografia, textos editoriais ou runtime de carrossel.
 */
(function (win) {
  'use strict';
  if (!win || !win.document) return;
  if (win.TelmaMotion && win.TelmaMotion.version === '1.0.0') return;

  var doc = win.document;
  var sceneRegistry = new WeakMap();
  var groupRegistry = new WeakMap();
  var buttonRegistry = new WeakMap();
  var scenes = new Set();
  var groups = new Set();
  var buttonBindings = new Set();
  var globalListeners = [];
  var media = typeof win.matchMedia === 'function'
    ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var mediaListening = false;

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function rgba(color, alpha) {
    return 'rgba(' + color.map(Math.round).join(',') + ',' + clamp(alpha, 0, 1) + ')';
  }
  function mix(a, b, amount) {
    return a.map(function (value, i) { return value + (b[i] - value) * amount; });
  }
  function hex(value, fallback) {
    var text = String(value || '').replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(text)) text = text.replace(/./g, function (c) { return c + c; });
    if (!/^[0-9a-f]{6}$/i.test(text)) return fallback.slice();
    return [0, 2, 4].map(function (i) { return parseInt(text.slice(i, i + 2), 16); });
  }
  function listen(target, type, callback, options, list) {
    target.addEventListener(type, callback, options);
    list.push([target, type, callback, options]);
  }
  function removeListeners(list) {
    list.splice(0).forEach(function (item) { item[0].removeEventListener(item[1], item[2], item[3]); });
  }
  function collect(root, selector) {
    var found = Array.from(root.querySelectorAll(selector));
    if (root.nodeType === 1 && root.matches(selector)) found.unshift(root);
    return found;
  }
  function saveAttributes(element, names) {
    var saved = {};
    names.forEach(function (name) { saved[name] = element.getAttribute(name); });
    return saved;
  }
  function restoreAttributes(element, values) {
    Object.keys(values).forEach(function (name) {
      if (values[name] === null) element.removeAttribute(name);
      else element.setAttribute(name, values[name]);
    });
  }
  function geometry() {
    var master = win.TelmaBrandGeometry;
    var glyph = master && master.glyphs && master.glyphs.S;
    if (!glyph || typeof glyph.path !== 'string' || !glyph.path.trim()) return null;
    if (![glyph.width, glyph.height, glyph.length].every(function (n) {
      return typeof n === 'number' && Number.isFinite(n) && n > 0;
    })) return null;
    var colors = master.colors || {};
    return {
      glyph: glyph,
      ink: hex(colors.petroleo, [20, 63, 73]),
      paper: hex(colors.marfim, [250, 247, 242]),
      copper: hex(colors.cobre, [180, 83, 42])
    };
  }
  function supportsMotion() {
    return typeof win.Path2D === 'function'
      && typeof win.IntersectionObserver === 'function'
      && typeof win.ResizeObserver === 'function'
      && typeof win.requestAnimationFrame === 'function'
      && typeof win.cancelAnimationFrame === 'function';
  }
  function updateButtons() {
    buttonBindings.forEach(function (binding) {
      var owners = Array.from(binding.owners);
      var available = owners.some(function (group) {
        return Array.from(group.scenes).some(function (scene) { return scene.ready; });
      });
      var paused = !available || owners.every(function (group) { return group.isPaused(); });
      binding.element.disabled = binding.originalDisabled || !available;
      binding.element.setAttribute('aria-pressed', String(paused));
      var key = !available ? 'data-label-unavailable' : paused ? 'data-label-paused' : 'data-label-running';
      var label = binding.element.getAttribute(key);
      if (label !== null && binding.labelTarget) binding.labelTarget.textContent = label;
    });
  }
  function bindButton(element, group) {
    var binding = buttonRegistry.get(element);
    if (!binding) {
      var target = element.querySelector('[data-telma-motion-label]');
      if (!target && element.childElementCount === 0) target = element;
      binding = {
        element: element, owners: new Set(), labelTarget: target,
        originalLabel: target ? target.textContent : null,
        originalDisabled: element.disabled,
        originalAttributes: saveAttributes(element, ['aria-pressed'])
      };
      binding.click = function () {
        if (element.disabled) return;
        var owners = Array.from(binding.owners);
        var nextPaused = !owners.every(function (owner) { return owner.isPaused(); });
        owners.forEach(function (owner) { owner.setPaused(nextPaused); });
      };
      element.addEventListener('click', binding.click);
      buttonRegistry.set(element, binding);
      buttonBindings.add(binding);
    }
    binding.owners.add(group);
  }
  function unbindButton(element, group) {
    var binding = buttonRegistry.get(element);
    if (!binding) return;
    binding.owners.delete(group);
    if (binding.owners.size) return;
    element.removeEventListener('click', binding.click);
    element.disabled = binding.originalDisabled;
    restoreAttributes(element, binding.originalAttributes);
    if (binding.labelTarget) binding.labelTarget.textContent = binding.originalLabel;
    buttonRegistry.delete(element);
    buttonBindings.delete(binding);
  }
  function onPreferenceChange() {
    groups.forEach(function (group) { group.pauseOverride = null; });
    scenes.forEach(function (scene) { scene.sync(true); });
    updateButtons();
  }
  function attachGlobals() {
    if (groups.size !== 1) return;
    listen(doc, 'visibilitychange', function () {
      scenes.forEach(function (scene) { scene.sync(false); });
    }, false, globalListeners);
    listen(doc, 'mouseleave', function () {
      scenes.forEach(function (scene) { scene.hover = false; scene.touchUntil = 0; });
    }, false, globalListeners);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onPreferenceChange);
      mediaListening = true;
    } else if (typeof media.addListener === 'function') {
      media.addListener(onPreferenceChange);
      mediaListening = true;
    }
  }
  function detachGlobals() {
    if (groups.size) return;
    removeListeners(globalListeners);
    if (mediaListening && typeof media.removeEventListener === 'function') media.removeEventListener('change', onPreferenceChange);
    else if (mediaListening && typeof media.removeListener === 'function') media.removeListener(onPreferenceChange);
    mediaListening = false;
  }

  class Scene {
    constructor(element) {
      this.element = element;
      this.owners = new Set();
      this.alive = true;
      this.ready = false;
      this.visible = false;
      this.listeners = [];
      this.raf = 0;
      this.last = 0;
      this.time = 0;
      this.frames = 0;
      this.presence = 0;
      this.px = 0; this.py = 0; this.tx = 0; this.ty = 0;
      this.hover = false; this.touchUntil = 0;
      this.cells = [];
      this.originalAttributes = saveAttributes(element, ['data-telma-motion-state', 'data-telma-motion-frames']);
      this.tick = this.tick.bind(this);
    }
    isPaused() {
      return !this.owners.size || Array.from(this.owners).some(function (group) { return group.isPaused(); });
    }
    isRunning() { return this.ready && this.visible && !doc.hidden && !this.isPaused(); }
    setState() {
      this.element.setAttribute('data-telma-motion-state', !this.ready ? 'static'
        : this.isPaused() ? 'paused' : !this.visible || doc.hidden ? 'offscreen' : 'running');
    }
    refresh() {
      if (!this.alive) return;
      var master = geometry();
      var mode = this.element.getAttribute('data-telma-motion');
      if (!supportsMotion() || !master || (mode !== 'signature' && mode !== 'field')) {
        this.releaseGraphics(); this.setState(); return;
      }
      this.field = mode === 'field';
      this.dark = this.element.getAttribute('data-telma-surface') === 'dark'
        || (this.field && this.element.getAttribute('data-telma-surface') !== 'light');
      this.intensity = this.element.getAttribute('data-telma-intensity') === 'quiet' ? 0.55 : 1;
      this.ink = master.ink; this.paper = master.paper; this.copper = master.copper;
      try {
        if (!this.path || this.glyph.path !== master.glyph.path) this.path = new win.Path2D(master.glyph.path);
        this.glyph = master.glyph;
        if (!this.ready) this.build();
        this.measure(); this.sync(false);
      } catch (_) { this.releaseGraphics(); this.setState(); }
    }
    build() {
      var scene = this;
      var canvas = doc.createElement('canvas');
      canvas.className = 'telma-motion-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      var context = canvas.getContext('2d');
      if (!context) return;
      this.canvas = canvas; this.context = context;
      this.io = new win.IntersectionObserver(function (entries) {
        if (!scene.alive || !scene.ready) return;
        entries.forEach(function (entry) { if (entry.target === scene.element) scene.visible = entry.isIntersecting; });
        if (scene.visible) scene.measure(); else scene.hover = false;
        scene.sync(false);
      }, { threshold: 0.01 });
      this.ro = new win.ResizeObserver(function () { if (scene.alive && scene.ready) scene.measure(); });
      function point(event) {
        var rect = scene.element.getBoundingClientRect();
        scene.tx = event.clientX - rect.left; scene.ty = event.clientY - rect.top;
      }
      listen(this.element, 'pointermove', function (event) {
        if (!scene.isRunning()) return;
        point(event);
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') scene.hover = true;
        else if (event.buttons) scene.touchUntil = win.performance.now() + 2000;
      }, { passive: true }, this.listeners);
      listen(this.element, 'pointerdown', function (event) {
        if (!scene.isRunning() || (event.target.closest && event.target.closest('[data-telma-motion-toggle]'))) return;
        point(event);
        if (event.pointerType === 'touch') { scene.touchUntil = win.performance.now() + 2400; scene.hover = false; }
        else scene.hover = true;
      }, { passive: true }, this.listeners);
      listen(this.element, 'pointerleave', function () { scene.hover = false; }, { passive: true }, this.listeners);
      listen(this.element, 'pointercancel', function () {
        scene.hover = false; scene.touchUntil = 0;
      }, { passive: true }, this.listeners);
      this.element.insertBefore(canvas, this.element.firstChild);
      this.ready = true;
      this.io.observe(this.element); this.ro.observe(this.element);
    }
    measure() {
      if (!this.ready || !this.alive) return;
      var w = this.element.clientWidth, h = this.element.clientHeight;
      if (!w || !h) { this.stop(); return; }
      this.width = w; this.height = h;
      this.dpr = Math.min(win.devicePixelRatio || 1, 1.8);
      this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
      var step = w < 480 ? 112 : 132;
      this.cells = [];
      for (var y = -1; y < Math.ceil(h / 146) + 1; y++) {
        for (var x = -1; x < Math.ceil(w / step) + 1; x++) {
          var phase = ((x + 5) * 17 + (y + 6) * 31) % 23;
          this.cells.push({ x: x * step + (y % 2) * step * 0.36 + step * 0.5,
            y: y * 146 + 77, phase: phase * 0.67, size: 83 + (phase % 3) * 9, ox: 0, oy: 0, e: 0 });
        }
      }
      this.draw(0, win.performance.now());
      this.start();
    }
    light(x, y, radius, alpha, color) {
      var ctx = this.context;
      var gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, rgba(color, alpha));
      gradient.addColorStop(0.47, rgba(color, alpha * 0.38));
      gradient.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.width, this.height);
    }
    glyphAt(x, y, size, fillAlpha, strokeAlpha, color, dash, extraScale) {
      var ctx = this.context;
      var scale = size / this.glyph.height * (extraScale || 1);
      ctx.save();
      ctx.translate(x - this.glyph.width * scale / 2, y - this.glyph.height * scale / 2);
      ctx.scale(scale, scale);
      if (fillAlpha > 0) { ctx.fillStyle = rgba(color, fillAlpha); ctx.fill(this.path); }
      if (strokeAlpha > 0) {
        ctx.strokeStyle = rgba(color, strokeAlpha); ctx.lineWidth = (dash ? 2 : 1) / scale;
        if (dash) {
          ctx.setLineDash([this.glyph.length * 0.12, this.glyph.length * 0.88]);
          ctx.lineDashOffset = -(this.time / 15 % 1) * this.glyph.length;
          ctx.lineCap = 'round';
        }
        ctx.stroke(this.path);
      }
      ctx.restore();
    }
    draw(dt, now) {
      if (!this.ready || !this.width || !this.height || !this.alive) return false;
      try {
        var ctx = this.context, w = this.width, h = this.height, t = this.time, q = this.intensity;
        var touch = clamp((this.touchUntil - now) / 1600, 0, 1);
        var target = this.hover ? 1 : touch;
        var response = dt ? 1 - Math.exp(-dt * 8) : 1;
        this.presence += (target - this.presence) * response;
        this.px += (this.tx - this.px) * (dt ? 1 - Math.exp(-dt * 12) : 1);
        this.py += (this.ty - this.py) * (dt ? 1 - Math.exp(-dt * 12) : 1);
        var pr = this.presence, base = this.dark ? this.paper : this.ink;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, w, h);
        if (!this.field) {
          var gx = w * (0.83 + 0.035 * Math.sin(t * 0.25) * q);
          var gy = h * (0.49 + 0.035 * Math.cos(t * 0.21) * q);
          gx += (this.px - w * 0.5) * 0.045 * pr * q;
          gy += (this.py - h * 0.5) * 0.035 * pr * q;
          this.light(w * 0.89 + Math.sin(t * 0.19) * w * 0.10 * q,
            h * 0.57 + Math.cos(t * 0.23) * 40 * q, w * 0.69, 0.14 * q, this.copper);
          if (pr > 0.003) this.light(this.px, this.py, w * 0.43, 0.10 * pr * q, this.copper);
          var size = h * (0.85 + 0.012 * Math.sin(t * 0.29) * q);
          this.glyphAt(gx, gy, size, 0.055 * q, 0.12 * q, base, false, 1);
          this.glyphAt(gx, gy, size, 0, (0.36 + 0.22 * pr) * q, this.copper, true, 1);
          this.glyphAt(w * 1.07 + Math.sin(t * 0.22) * 8 * q, h * 0.89,
            size * 0.50, 0, 0.075 * q, base, false, 1);
          ctx.globalCompositeOperation = 'destination-in';
          var column = ctx.createLinearGradient(0, 0, w, 0);
          column.addColorStop(0, 'rgba(0,0,0,.02)'); column.addColorStop(0.35, 'rgba(0,0,0,.08)');
          column.addColorStop(0.67, 'rgba(0,0,0,.86)'); column.addColorStop(1, 'rgba(0,0,0,1)');
          ctx.fillStyle = column; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
        } else {
          this.light(w * (0.70 + 0.19 * Math.sin(t * 0.16) * q),
            h * (0.50 + 0.12 * Math.cos(t * 0.18) * q), w * 0.76, 0.07 * q, this.copper);
          var radius = w < 480 ? 155 : 210;
          var scene = this;
          this.cells.forEach(function (cell) {
            var dx = cell.x - scene.px, dy = cell.y - scene.py, distance = Math.hypot(dx, dy);
            var u = clamp(1 - distance / radius, 0, 1), e = u * u * pr;
            var ox = distance > 1 ? dx / distance * 24 * e * q : 0;
            var oy = distance > 1 ? dy / distance * 24 * e * q : 0;
            cell.ox += (ox - cell.ox) * response; cell.oy += (oy - cell.oy) * response;
            cell.e += (e - cell.e) * response;
            var breathe = Math.sin(t * 0.285 + cell.phase);
            var x = cell.x + Math.sin(t * 0.25 + cell.phase) * 5 * q + cell.ox;
            var y = cell.y + Math.cos(t * 0.21 + cell.phase) * 6 * q + cell.oy;
            var color = mix(base, scene.copper, cell.e * 0.78 * q);
            var scale = 1 + 0.012 * breathe * q + 0.15 * cell.e * q;
            scene.glyphAt(x, y, cell.size, (0.006 + cell.e * 0.11) * q,
              (0.09 + 0.012 * breathe + cell.e * 0.32) * q, color, false, scale);
          });
          ctx.globalCompositeOperation = 'destination-out';
          var center = ctx.createRadialGradient(w * 0.5, h * 0.50, Math.min(w * 0.20, 115),
            w * 0.5, h * 0.50, Math.max(w * 0.44, 235));
          center.addColorStop(0, 'rgba(0,0,0,.92)'); center.addColorStop(0.48, 'rgba(0,0,0,.65)');
          center.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = center; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
        }
        this.frames += 1;
        this.element.setAttribute('data-telma-motion-frames', String(this.frames));
        // O fallback só desaparece depois de um desenho completo e bem-sucedido.
        this.element.classList.add('is-telma-motion-ready');
        return true;
      } catch (_) {
        this.releaseGraphics(); this.setState(); updateButtons(); return false;
      }
    }
    tick(now) {
      this.raf = 0;
      if (!this.alive || !this.isRunning()) { this.setState(); return; }
      var dt = this.last ? Math.min((now - this.last) / 1000, 0.065) : 0;
      if (this.last && dt < 0.029) { this.raf = win.requestAnimationFrame(this.tick); return; }
      this.last = now; this.time += dt;
      if (this.draw(dt, now)) this.raf = win.requestAnimationFrame(this.tick);
    }
    start() {
      if (this.alive && this.isRunning() && !this.raf && this.width && this.height) {
        this.last = 0; this.raf = win.requestAnimationFrame(this.tick);
      }
    }
    stop() {
      if (this.raf) win.cancelAnimationFrame(this.raf);
      this.raf = 0; this.last = 0;
    }
    sync(resetInteraction) {
      if (!this.alive) return;
      if (resetInteraction) { this.presence = 0; this.hover = false; this.touchUntil = 0; }
      if (this.isRunning()) this.start();
      else {
        this.stop();
        if (resetInteraction && this.ready) this.draw(0, win.performance.now());
      }
      this.setState();
    }
    releaseGraphics() {
      this.stop(); this.ready = false;
      if (this.io) this.io.disconnect(); if (this.ro) this.ro.disconnect();
      this.io = null; this.ro = null;
      removeListeners(this.listeners);
      if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null; this.context = null; this.visible = false;
      this.element.classList.remove('is-telma-motion-ready');
    }
    destroy() {
      if (!this.alive) return;
      this.alive = false; this.releaseGraphics();
      restoreAttributes(this.element, this.originalAttributes);
      scenes.delete(this); sceneRegistry.delete(this.element);
    }
  }

  class Group {
    constructor(root, selector, registry) {
      this.root = root; this.selector = selector; this.registry = registry;
      this.scenes = new Set(); this.buttons = new Set(); this.pauseOverride = null; this.alive = true;
      var group = this;
      this.controller = Object.freeze({
        setPaused: function (paused) { group.setPaused(Boolean(paused)); },
        refresh: function () { group.refresh(); },
        destroy: function () { group.destroy(); }
      });
    }
    isPaused() { return this.pauseOverride === null ? media.matches : this.pauseOverride; }
    setPaused(paused) {
      if (!this.alive) return;
      this.pauseOverride = Boolean(paused);
      this.scenes.forEach(function (scene) { scene.sync(false); });
      updateButtons();
    }
    refresh() {
      if (!this.alive) return;
      var group = this;
      var elements = new Set(collect(this.root, this.selector));
      this.scenes.forEach(function (scene) {
        if (!elements.has(scene.element)) {
          scene.owners.delete(group); group.scenes.delete(scene);
          if (!scene.owners.size) scene.destroy(); else scene.sync(false);
        }
      });
      elements.forEach(function (element) {
        var scene = sceneRegistry.get(element);
        if (!scene) { scene = new Scene(element); sceneRegistry.set(element, scene); scenes.add(scene); }
        scene.owners.add(group); group.scenes.add(scene); scene.refresh();
      });
      var buttons = new Set(collect(this.root, '[data-telma-motion-toggle]'));
      this.buttons.forEach(function (button) { if (!buttons.has(button)) unbindButton(button, group); });
      buttons.forEach(function (button) { bindButton(button, group); });
      this.buttons = buttons; updateButtons();
    }
    destroy() {
      if (!this.alive) return;
      this.alive = false;
      var group = this;
      this.buttons.forEach(function (button) { unbindButton(button, group); }); this.buttons.clear();
      this.scenes.forEach(function (scene) {
        scene.owners.delete(group);
        if (!scene.owners.size) scene.destroy(); else scene.sync(false);
      });
      this.scenes.clear(); groups.delete(this); this.registry.delete(this.selector);
      if (!this.registry.size) groupRegistry.delete(this.root);
      detachGlobals(); updateButtons();
    }
  }

  win.TelmaMotion = Object.freeze({
    version: '1.0.0',
    mountAll: function (options) {
      options = options || {};
      var root = options.root || doc;
      var selector = options.selector || '[data-telma-motion]';
      if (!root || typeof root.querySelectorAll !== 'function') throw new TypeError('TelmaMotion: root precisa ser um Document, Element ou ShadowRoot.');
      // Valida o seletor antes de instalar qualquer listener ou observer.
      root.querySelectorAll(selector);
      var registry = groupRegistry.get(root);
      if (!registry) { registry = new Map(); groupRegistry.set(root, registry); }
      var existing = registry.get(selector);
      if (existing) { existing.refresh(); return existing.controller; }
      var group = new Group(root, selector, registry);
      registry.set(selector, group); groups.add(group); attachGlobals(); group.refresh();
      return group.controller;
    }
  });
})(typeof window !== 'undefined' ? window : null);
