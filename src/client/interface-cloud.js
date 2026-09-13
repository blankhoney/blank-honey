import Phenomenon from 'phenomenon';
import { capability } from './preferences';
import { vertexShader, fragmentShader } from './interface-cloud-shaders';

/** Bounded scroll inertia; native content and point ink converge exactly at rest.
 * @param {number} current
 * @param {number} target
 * @param {number} elapsed
 */
export function followScroll(current, target, elapsed) {
  const distance = Math.max(-32, Math.min(32, current - target));
  const position = target + distance * Math.exp(-Math.max(0, elapsed) / 65);
  return Math.abs(position - target) < 0.025 ? target : position;
}

/**
 * Live DOM point surface from the user-provided acceptance HTML (BHInterfaceCloud).
 * Phenomenon owns the WebGL buffers; native text remains accessible beneath the ink.
 * @typedef {{xyz: number[], tint: number[], size: number, kind: number}} SnapshotPoint
 * @typedef {{points: SnapshotPoint[], width: number, height: number}} CloudSnapshot
 */
export const interfaceCloud = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  let pool = null,
    active = null;
  const inkSelectors =
    '.terminal h1,.terminal h2,.terminal h3,.metric-value,.directory-row > span:first-child,.places strong';
  const ruleSelectors =
    '.terminal-rule,.probe-card,.directory-row,.tool-row,.terminal-footer,#graph,.graph-relations p,.map-stage';

  function createRenderer(host, light) {
    // Keep the pooled renderer: Phenomenon owns one anonymous window resize listener.
    // A restored context can reuse it; a lost context leaves native content visible.
    if (pool?.renderer.gl.isContextLost()) throw new Error('WebGL context is lost');
    if (!pool) {
      const canvas = document.createElement('canvas');
      canvas.className = 'interface-cloud-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      host.append(canvas);
      if (
        !canvas.getContext('webgl', { alpha: true, antialias: false, preserveDrawingBuffer: true })
      ) {
        canvas.remove();
        throw new Error('WebGL unavailable');
      }
      const renderer = new Phenomenon({
        canvas,
        contextType: 'webgl',
        context: { alpha: true, antialias: false, preserveDrawingBuffer: true },
        settings: {
          shouldRender: false,
          devicePixelRatio: light ? 1 : Math.min(devicePixelRatio || 1, 2),
          onSetup(gl) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.clearColor(0, 0, 0, 0);
          },
        },
      });
      pool = { canvas, renderer };
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        active?.destroy('context-lost');
      });
    } else host.append(pool.canvas);
    pool.renderer.devicePixelRatio = light
      ? Math.min(devicePixelRatio || 1, 1.5)
      : Math.min(devicePixelRatio || 1, 2);
    pool.renderer.resize();
    return pool;
  }
  // Native Canvas resolves rgb(), color(srgb), and color-mix results consistently.
  let colorContext;
  function color(cssColor) {
    if (!colorContext)
      colorContext = document
        .createElement('canvas')
        .getContext('2d', { willReadFrequently: true });
    if (!colorContext) return [0.84, 0.84, 0.82];
    colorContext.clearRect(0, 0, 1, 1);
    colorContext.fillStyle = cssColor;
    colorContext.fillRect(0, 0, 1, 1);
    return Array.from(colorContext.getImageData(0, 0, 1, 1).data)
      .slice(0, 3)
      .map((value) => value / 255);
  }
  function isShellMoving() {
    return document.getAnimations().some((animation) => {
      if (animation.playState !== 'running') return false;
      const effect = animation.effect;
      if (!(effect instanceof KeyframeEffect) || !(effect.target instanceof Element)) return false;
      if (effect.target.closest('#shell')) return true;
      return effect.target.id === 'main' && effect.getKeyframes().some((frame) => 'width' in frame);
    });
  }
  // Main opacity belongs to the native-content cross-fade, not the external particle surface.
  function opacity(el) {
    let value = 1;
    for (let n = el; n && n !== document.body && n.id !== 'main'; n = n.parentElement)
      value *= Number(getComputedStyle(n).opacity);
    return value;
  }
  /**
   * @param {HTMLElement} root
   * @param {{light?: boolean, animate?: boolean, duration?: number, seed?: CloudSnapshot|null}} options
   */
  function make(root, { light = false, animate = false, duration = 1800, seed = null } = {}) {
    active?.destroy('new-page');
    if (!root || capability() === 'reduced-motion') return null;
    const host = document.createElement('div');
    host.id = 'interface-cloud';
    host.setAttribute('aria-hidden', 'true');
    document.body.append(host);
    let owner;
    try {
      owner = createRenderer(host, light);
    } catch (error) {
      host.remove();
      throw error;
    }
    const { renderer, canvas } = owner;
    let sourceSeed = seed?.points?.length ? seed : null,
      morphing = !!sourceSeed;
    if (morphing) animate = true;
    let instance = null,
      dead = false,
      progress = animate ? 0 : 1,
      raf = 0,
      rebuildTimer = 0,
      resizeTimer = 0,
      previous = 0,
      started = 0,
      settled = !animate;
    let points = [],
      ink = [],
      rules = [],
      tracks = [],
      values = Array(12).fill(0),
      wanted = values.slice(),
      pointer = [0, 0],
      targetPointer = [0, 0];
    const maskCache = new WeakMap(),
      disposers = [];
    const anchorMemory = new WeakMap();
    let groups = [],
      groupIndex = -1,
      groupKind = 0,
      groupRect = null;
    let renderedScroll = scrollY;
    let boxes = new Float32Array(64 * 4),
      flow = 0,
      clock = 0,
      lastRender = 0,
      layoutDirty = true,
      resampleAfterLayout = false;
    let finish;
    const finished = new Promise((r) => (finish = r));
    const stats = {
      renderer: 'Phenomenon / WebGL',
      pointCount: 0,
      depth: 0,
      frameCount: 0,
      phase: animate ? 'assembling' : 'settled',
      elements: 0,
      light,
      cancelled: false,
      ambientFrames: 0,
      layoutFrames: 0,
      rebuilds: 0,
      flow: 0,
    };
    stats.transition = morphing ? 'interface-reform' : 'assembly';
    stats.sourcePoints = sourceSeed?.points.length || 0;
    const on = (el, name, fn, options) => {
      el.addEventListener(name, fn, options);
      disposers.push(() => el.removeEventListener(name, fn, options));
    };
    function restoreInk() {
      ink.forEach((el) => el.classList.remove('pc-ink'));
      rules.forEach((el) => el.classList.remove('pc-rule'));
      tracks.forEach((el) => el.classList.remove('pc-track'));
      root.classList.remove('pc-assembling');
    }
    function collect() {
      restoreInk();
      points = [];
      groups = [];
      stats.rebuilds++;
      const width = canvas.clientWidth,
        height = canvas.clientHeight,
        rootBox = root.getBoundingClientRect();
      ink = Array.from(root.querySelectorAll(inkSelectors)).filter(
        (el) => el.getBoundingClientRect().width > 0,
      );
      rules = Array.from(root.querySelectorAll(ruleSelectors));
      tracks = Array.from(root.querySelectorAll('.metric-bar')).slice(0, 12);
      // ponytail: the original shader has 12 bar uniforms; extra bars remain native until that ceiling matters.
      const pageTop = rootBox.top + scrollY;
      const anchor = (el, kind) => {
        if (groups.length >= 64) return false;
        const r = el.getBoundingClientRect();
        groupRect = { x: r.left, y: r.top + scrollY, w: r.width, h: r.height };
        groupIndex = groups.length;
        groupKind = kind;
        let box = anchorMemory.get(el);
        if (!box) {
          box = [r.left, r.top + scrollY, r.width, r.height];
          anchorMemory.set(el, box);
        }
        groups.push({ el, box, kind });
        return true;
      };
      const add = (x, y, z, col, alpha, size, group = -1, fraction = 0) => {
        const i = points.length,
          order = clamp(
            ((y - pageTop) / Math.max(height, root.scrollHeight)) * 0.58 +
              (x / Math.max(1, width)) * 0.22 +
              hash(i + 72) * 0.2,
            0,
            1,
          );
        const t = hash(i + 25) * Math.PI * 2,
          side = hash(i + 115) * Math.PI * 2,
          r = 0.5 + 0.12 * Math.cos(t * 3);
        const c = [
          (2 + 0.62 * Math.cos(3 * t)) * Math.cos(2 * t),
          (2 + 0.62 * Math.cos(3 * t)) * Math.sin(2 * t),
          0.96 * Math.sin(3 * t),
        ];
        const scale = Math.min(width * 0.12, height * 0.16);
        const start = [
          width * 0.51 + (c[0] + r * Math.cos(side)) * scale,
          height * 0.45 + (c[1] + r * Math.sin(side)) * scale,
          c[2] * scale * 0.8 + hash(i + 201) * 60,
        ];
        // Recessed side surfaces have a small oblique offset even with a centered view.
        points.push({
          xyz: [x, y, z],
          origin: start,
          tint: [...col, alpha],
          info: [order, size, group, fraction],
          layout: [
            groupIndex,
            (x - groupRect.x) / (groupKind ? Math.max(1, groupRect.w) : 1),
            (y - groupRect.y) / (groupKind ? Math.max(1, groupRect.h) : 1),
            groupKind,
          ],
        });
      };
      function textPoints(el) {
        const bounds = el.getBoundingClientRect(),
          cs = getComputedStyle(el),
          fs = parseFloat(cs.fontSize),
          step = fs >= 65 ? (light ? 3.7 : 3.2) : fs >= 28 ? (light ? 2.4 : 2.05) : 1.5;
        if (bounds.width < 1 || bounds.height < 1 || !anchor(el, 0)) return;
        const signature = [
          el.textContent,
          cs.font,
          cs.letterSpacing,
          Math.round(bounds.width),
          Math.round(bounds.height),
        ].join('|');
        let cached = maskCache.get(el);
        if (!cached || cached.signature !== signature) {
          const pad = Math.ceil(Math.max(8, fs * 0.4)),
            w = Math.ceil(bounds.width) + pad * 2,
            h = Math.ceil(bounds.height) + pad * 2,
            mask = document.createElement('canvas');
          mask.width = w;
          mask.height = h;
          const ctx = mask.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Canvas text sampling unavailable');
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let node;
          ctx.fillStyle = '#fff';
          while ((node = walker.nextNode())) {
            const style = getComputedStyle(node.parentElement);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            ctx.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(
              ' ',
            );
            ctx.textBaseline = 'alphabetic';
            const metrics = ctx.measureText('Hg'),
              ascent = metrics.fontBoundingBoxAscent || parseFloat(style.fontSize) * 0.8,
              descent = metrics.fontBoundingBoxDescent || parseFloat(style.fontSize) * 0.2;
            const range = document.createRange();
            let index = 0;
            for (const char of node.textContent) {
              range.setStart(node, index);
              index += char.length;
              range.setEnd(node, index);
              const r = range.getBoundingClientRect();
              if (!char.trim() || r.width === 0) continue;
              const glyph = style.textTransform === 'uppercase' ? char.toUpperCase() : char;
              ctx.fillText(
                glyph,
                r.left - bounds.left + pad,
                r.top - bounds.top + pad + (r.height - ascent - descent) / 2 + ascent,
              );
            }
          }
          const data = ctx.getImageData(0, 0, w, h).data,
            samples = [];
          for (let y = pad * 0.5; y < h - pad * 0.5; y += step)
            for (let x = pad * 0.5; x < w - pad * 0.5; x += step) {
              const ix = Math.round(x),
                iy = Math.round(y),
                alpha = data[(iy * w + ix) * 4 + 3] / 255;
              if (alpha < 0.22) continue;
              const edge = [
                [-2, 0],
                [2, 0],
                [0, -2],
                [0, 2],
              ].some(([dx, dy]) => {
                const a = ix + dx,
                  b = iy + dy;
                return a < 0 || b < 0 || a >= w || b >= h || data[(b * w + a) * 4 + 3] < 70;
              });
              samples.push([x - pad, y - pad, alpha, edge]);
            }
          cached = { signature, samples };
          maskCache.set(el, cached);
        }
        const col = color(cs.color),
          alpha = opacity(el),
          depth = fs >= 65 ? 11 : fs >= 28 ? 5 : 2.2,
          dot = step * 0.78;
        cached.samples.forEach(([x, y, a, edge]) => {
          const px = bounds.left + x,
            py = bounds.top + scrollY + y;
          add(px, py, 0, col, Math.min(1, 0.62 + a * 0.42) * alpha, dot);
          if (edge) {
            for (let d = light ? depth : depth / 2; d <= depth; d += light ? depth : depth / 2) {
              add(
                px + d * 0.62,
                py + d * 0.36,
                -d,
                col.map((c) => c * 0.64),
                alpha * 0.64,
                dot * 0.88,
              );
            }
          }
        });
      }
      ink = ink.filter((el) => {
        const before = groups.length;
        textPoints(el);
        return groups.length > before;
      });
      function line(x1, y1, x2, y2, col, alpha = 1, raised = false) {
        const len = Math.hypot(x2 - x1, y2 - y1),
          n = Math.max(1, Math.ceil(len / (light ? 4 : 3.2)));
        for (let i = 0; i <= n; i++) {
          const t = i / n,
            x = x1 + (x2 - x1) * t,
            y = y1 + (y2 - y1) * t;
          add(x, y, 0, col, alpha, 1.35);
          if (raised && i % 2 === 0) add(x + 2.8, y + 1.6, -4, col, alpha * 0.38, 1.15);
        }
      }
      rules = rules.filter((el) => {
        if (!anchor(el, 1)) return false;
        const r = el.getBoundingClientRect(),
          s = getComputedStyle(el),
          a = opacity(el);
        for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
          if (
            parseFloat(s['border' + side + 'Width']) < 0.1 ||
            s['border' + side + 'Style'] === 'none'
          )
            continue;
          const col = color(s['border' + side + 'Color']),
            x = r.left,
            y = r.top + scrollY,
            w = r.width,
            h = r.height;
          if (side === 'Top') line(x, y, x + w, y, col, a, true);
          if (side === 'Bottom') line(x, y + h, x + w, y + h, col, a, true);
          if (side === 'Left') line(x, y, x, y + h, col, a);
          if (side === 'Right') line(x + w, y, x + w, y + h, col, a);
        }
        return true;
      });
      tracks = tracks.filter((el, id) => {
        if (!el.firstElementChild || !anchor(el, 1)) return false;
        const r = el.getBoundingClientRect(),
          cs = getComputedStyle(el),
          bar = el.firstElementChild,
          x = r.left,
          y = r.top + scrollY,
          w = r.width,
          h = r.height;
        const base = color(cs.backgroundColor),
          fill = color(getComputedStyle(bar).backgroundColor),
          alpha = opacity(el);
        line(x, y, x + w, y, base, alpha);
        line(x, y + h, x + w, y + h, base, alpha);
        line(x, y, x, y + h, base, alpha);
        line(x + w, y, x + w, y + h, base, alpha);
        const step = light ? 3.2 : 2.7;
        for (let xx = 0; xx <= w; xx += step)
          for (let yy = 1; yy < h; yy += 2.8) {
            add(x + xx, y + yy, 0, fill, alpha, 0.83 * step, id, xx / w);
            if (yy < 2 || yy > h - 3)
              add(
                x + xx + 2.4,
                y + yy + 1.4,
                -4.3,
                fill.map((c) => c * 0.7),
                alpha * 0.55,
                0.72 * step,
                id,
                xx / w,
              );
          }
        wanted[id] = clamp(parseFloat(bar.style.width) / 100 || 0, 0, 1);
        return true;
      });
      if (!instance) values = wanted.slice();
      if (sourceSeed && !settled) {
        const targets = points,
          paired = [];
        const order = (a, b) =>
          Math.floor(a.xyz[1] / 28) - Math.floor(b.xyz[1] / 28) ||
          a.xyz[0] - b.xyz[0] ||
          a.xyz[2] - b.xyz[2];
        stats.targetPoints = targets.length;
        for (const kind of [0, 1]) {
          const from = sourceSeed.points.filter((p) => p.kind === kind).sort(order);
          const to = targets.filter((p) => (p.layout[3] > 0.5 ? 1 : 0) === kind).sort(order);
          const count = Math.max(from.length, to.length);
          let lastFrom = -1,
            lastTo = -1;
          for (let i = 0; i < count; i++) {
            const fi = from.length ? Math.floor((i * from.length) / count) : -1;
            const ti = to.length ? Math.floor((i * to.length) / count) : -1;
            const base = to[ti] || targets[0];
            if (!base) continue;
            const origin = from[fi];
            const firstFrom = fi !== lastFrom && fi >= 0,
              firstTo = ti !== lastTo && ti >= 0;
            const tint = base.tint.slice();
            if (!firstTo) tint[3] = 0;
            const seedTint = origin ? origin.tint.slice() : base.tint.slice();
            if (!firstFrom) seedTint[3] = 0;
            const fallback = [base.xyz[0], base.xyz[1] - scrollY, -80];
            paired.push({
              ...base,
              origin: origin ? origin.xyz.slice() : fallback,
              tint,
              seedTint,
              seedInfo: [origin?.size || base.info[1], hash(paired.length + 191)],
            });
            lastFrom = fi;
            lastTo = ti;
          }
        }
        points = paired;
        stats.carriedPoints = sourceSeed.points.length;
      }
      const attributes = [
        { name: 'aTarget', size: 3, data: (i) => points[i].xyz },
        { name: 'aOrigin', size: 3, data: (i) => points[i].origin },
        { name: 'aTint', size: 4, data: (i) => points[i].tint },
        { name: 'aInfo', size: 4, data: (i) => points[i].info },
        { name: 'aLayout', size: 4, data: (i) => points[i].layout },
        { name: 'aSeedTint', size: 4, data: (i) => points[i].seedTint || points[i].tint },
        {
          name: 'aSeedInfo',
          size: 2,
          data: (i) => points[i].seedInfo || [points[i].info[1], hash(i + 191)],
        },
      ];
      renderer.remove('interface');
      if (!points.length) {
        instance = null;
        return;
      }
      renderer.resize();
      instance = renderer.add('interface', {
        mode: 0,
        multiplier: points.length,
        attributes,
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          uMorph: { type: 'float', value: sourceSeed && !settled ? 1 : 0 },
          uBoxes: { type: 'vec4', value: boxes },
          uTime: { type: 'float', value: clock },
          uFlow: { type: 'float', value: flow },
          uLight: { type: 'float', value: light ? 1 : 0 },
          uProgress: { type: 'float', value: progress },
          uPixelRatio: { type: 'float', value: renderer.devicePixelRatio },
          uScroll: { type: 'float', value: renderedScroll },
          uViewport: { type: 'vec2', value: [width, height] },
          uPointer: { type: 'vec2', value: pointer },
          uBarsA: { type: 'vec4', value: values.slice(0, 4) },
          uBarsB: { type: 'vec4', value: values.slice(4, 8) },
          uBarsC: { type: 'vec4', value: values.slice(8, 12) },
        },
      });
      const gl = renderer.gl;
      if (!gl.getProgramParameter(instance.program, gl.LINK_STATUS))
        throw new Error('Interface shader: ' + gl.getProgramInfoLog(instance.program));
      gl.getAttachedShaders(instance.program).forEach((shader) => gl.deleteShader(shader));
      stats.pointCount = points.length;
      stats.elements = ink.length + rules.length + tracks.length;
      stats.depth = points.reduce((depth, point) => Math.max(depth, -point.xyz[2]), 0);
      measureAnchors(16, true);
      draw();
      ink.forEach((el) => el.classList.add('pc-ink'));
      rules.forEach((el) => el.classList.add('pc-rule'));
      tracks.forEach((el) => el.classList.add('pc-track'));
    }
    function measureAnchors(dt, snap = false) {
      let displacement = 0;
      const follow = 1 - Math.exp(-dt / 32);
      groups.forEach(({ el, box }, i) => {
        const r = el.getBoundingClientRect(),
          target = [r.left, r.top + scrollY, r.width, r.height];
        for (let k = 0; k < 4; k++) {
          const delta = target[k] - box[k];
          displacement = Math.max(displacement, Math.abs(delta));
          box[k] = snap ? target[k] : box[k] + delta * follow;
          if (Math.abs(target[k] - box[k]) < 0.025) box[k] = target[k];
          boxes[i * 4 + k] = box[k];
        }
      });
      flow += (Math.min(1, displacement / 18) - flow) * (1 - Math.exp(-dt / 100));
      stats.flow = flow;
      if (displacement > 0.1) stats.layoutFrames++;
      layoutDirty = displacement > 0.04;
    }
    function draw() {
      if (dead || !instance || renderer.gl.isContextLost()) return;
      const u = instance.uniforms;
      u.uProgress.value = progress;
      u.uScroll.value = renderedScroll;
      u.uViewport.value = [canvas.clientWidth, canvas.clientHeight];
      u.uPointer.value = pointer;
      u.uBoxes.value = boxes;
      u.uTime.value = clock;
      u.uFlow.value = flow;
      u.uBarsA.value = values.slice(0, 4);
      u.uBarsB.value = values.slice(4, 8);
      u.uBarsC.value = values.slice(8, 12);
      renderer.render();
      stats.frameCount++;
    }
    function tick(now) {
      raf = 0;
      if (dead || document.hidden) return;
      const shellMoving = isShellMoving();
      // Ambient motion is modest and capped; assembly/reflow can use each browser frame.
      if (settled && !shellMoving && !layoutDirty && now - lastRender < (light ? 50 : 32)) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = previous ? Math.min(now - previous, 80) : 16;
      previous = now;
      lastRender = now;
      clock += dt / 1000;
      // A bounded 65 ms catch-up gives scrolling slight inertia, then exact alignment.
      renderedScroll = followScroll(renderedScroll, scrollY, dt);
      if (!settled) {
        if (!started) started = now;
        progress = clamp((now - started) / duration, 0, 1);
        if (progress >= 1) {
          settled = true;
          stats.phase = 'living';
          root.classList.remove('pc-assembling');
          finish('settled');
          if (morphing) {
            sourceSeed = null;
            morphing = false;
            schedule(40);
          }
        }
      }
      stats.progress = progress;
      if (morphing && !settled) stats.phase = 'migrating';
      if (shellMoving) resampleAfterLayout = true;
      if (resampleAfterLayout && !shellMoving) {
        resampleAfterLayout = false;
        schedule(80);
      }
      measureAnchors(dt);
      const lerp = 1 - Math.exp(-dt / 95);
      for (let i = 0; i < 2; i++) pointer[i] += (targetPointer[i] - pointer[i]) * lerp;
      for (let i = 0; i < 12; i++) {
        values[i] += (wanted[i] - values[i]) * lerp;
        if (Math.abs(wanted[i] - values[i]) < 0.0003) values[i] = wanted[i];
      }
      if (settled) stats.ambientFrames++;
      draw();
      raf = requestAnimationFrame(tick);
    }
    function wake() {
      if (!raf && !dead && !document.hidden) raf = requestAnimationFrame(tick);
    }
    function rebuild() {
      if (dead) return;
      clearTimeout(rebuildTimer);
      if (morphing && !settled) {
        resampleAfterLayout = true;
        return;
      }
      if (isShellMoving()) {
        resampleAfterLayout = true;
        layoutDirty = true;
        wake();
        return;
      }
      try {
        collect();
        layoutDirty = true;
        wake();
      } catch (error) {
        console.warn('[Your Name] 界面点云降级为原生内容:', error.message);
        destroy('sampling-failed');
      }
    }
    function schedule(delay = 80) {
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(rebuild, delay);
    }
    function snapshot() {
      if (dead || !instance || renderer.gl.isContextLost()) return null;
      measureAnchors(16, true);
      const width = canvas.clientWidth,
        height = canvas.clientHeight,
        focal = Math.max(width, height) * 1.45;
      const result = [];
      for (const item of points) {
        const [index, lx, ly, relative] = item.layout,
          box = groups[index]?.box;
        if (!box) continue;
        const [order, size, bar, fraction] = item.info;
        if (item.tint[3] < 0.01 || (bar >= 0 && fraction > values[bar])) continue;
        const z0 = item.xyz[2];
        let x = box[0] + lx * (relative > 0.5 ? box[2] : 1),
          y = box[1] + ly * (relative > 0.5 ? box[3] : 1) - renderedScroll,
          z = z0;
        x = (x - width * 0.5) * (1 - z / focal) + width * 0.5;
        y = (y - height * 0.5) * (1 - z / focal) + height * 0.5;
        const phase = clock * 0.82 + x * 0.009 + y * 0.006,
          slow = Math.sin(phase) + 0.36 * Math.sin(clock * 0.47 - x * 0.005 + y * 0.007);
        const idle = 1 - (light ? 0.45 : 0),
          relief = z0 < -0.1 ? 1 : 0.26;
        z += slow * 2.8 * idle * relief;
        x += Math.sin(phase * 0.83) * 0.2 * idle;
        y += Math.cos(phase * 0.67) * 0.16 * idle;
        z += Math.sin(order * 6.28 + clock * 2) * flow * 13;
        x += Math.sin(order * 11 + clock) * flow * 1.6;
        x += pointer[0] * 0.5 * -z;
        y += pointer[1] * 0.35 * -z;
        const perspective = 1 - z / focal,
          sx = (x - width * 0.5) / perspective + width * 0.5,
          sy = (y - height * 0.5) / perspective + height * 0.5;
        if (sx < -35 || sx > width + 35 || sy < -35 || sy > height + 35) continue;
        const breathe = 1 + (0.045 * Math.sin(phase) + 0.018 * Math.cos(phase * 0.61)) * idle;
        const acquisition = 1 + 0.18 * Math.exp(-Math.pow((1 - 0.87) * 13, 2));
        result.push({
          xyz: [x, y, z],
          tint: [...item.tint.slice(0, 3).map((c) => c * breathe * acquisition), item.tint[3]],
          size,
          kind: relative > 0.5 ? 1 : 0,
        });
      }
      return result.length ? { points: result, width, height } : null;
    }
    function destroy(reason = 'removed') {
      if (dead) return;
      dead = true;
      clearTimeout(rebuildTimer);
      clearTimeout(resizeTimer);
      cancelAnimationFrame(raf);
      restoreInk();
      disposers.forEach((fn) => fn());
      renderer.remove('interface');
      host.remove();
      stats.cancelled = true;
      stats.phase = reason;
      if (active === api) active = null;
      finish(reason);
    }
    const api = {
      canvas,
      host,
      stats,
      finished,
      snapshot,
      rebuild: () => schedule(0),
      destroy,
      settle() {
        progress = 1;
        settled = true;
        stats.phase = 'living';
        root.classList.remove('pc-assembling');
        draw();
        finish('settled');
        if (morphing) {
          sourceSeed = null;
          morphing = false;
          schedule(40);
        }
      },
      get progress() {
        return progress;
      },
      get points() {
        return points;
      },
      get anchors() {
        return groups.map((g) => ({
          text: g.el.textContent?.slice(0, 30),
          box: [...g.box],
          actual: (() => {
            const r = g.el.getBoundingClientRect();
            return [r.left, r.top + scrollY, r.width, r.height];
          })(),
        }));
      },
      followLayout() {
        layoutDirty = true;
        if (instance && !dead) {
          measureAnchors(16, true);
          draw();
        }
        wake();
      },
      draw,
    };
    active = api;
    try {
      if (animate) root.classList.add('pc-assembling');
      collect();
      const observer = new MutationObserver((records) => {
        const changed = records.some((record) => {
          const target =
            record.target instanceof Element ? record.target : record.target.parentElement;
          // The local clock changes every second without changing point geometry.
          if (target?.closest('time,[data-zone]')) return false;
          return (
            record.type === 'characterData' ||
            record.type === 'childList' ||
            record.attributeName === 'hidden'
          );
        });
        if (changed) schedule(65);
      });
      observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['hidden'],
      });
      disposers.push(() => observer.disconnect());
      let lastWidth = root.getBoundingClientRect().width;
      const ro = new ResizeObserver(() => {
        const width = root.getBoundingClientRect().width;
        if (Math.abs(lastWidth - width) > 0.5) {
          lastWidth = width;
          schedule(60);
        }
      });
      ro.observe(root);
      disposers.push(() => ro.disconnect());
      on(
        window,
        'scroll',
        () => {
          wake();
        },
        { passive: true },
      );
      on(
        window,
        'resize',
        () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(rebuild, 100);
        },
        { passive: true },
      );
      on(
        window,
        'pointermove',
        (e) => {
          if (light || e.pointerType === 'touch') return;
          targetPointer = [
            (e.clientX / innerWidth - 0.5) * 1.1,
            (e.clientY / innerHeight - 0.5) * 1.1,
          ];
          wake();
        },
        { passive: true },
      );
      on(document, 'visibilitychange', () => {
        if (document.hidden) {
          cancelAnimationFrame(raf);
          raf = 0;
          previous = 0;
        } else {
          previous = 0;
          wake();
        }
      });
      on(document.fonts, 'loadingdone', () => schedule(0));
      on(document, 'bh:motion', () => {
        if (capability() === 'reduced-motion') destroy('reduced-motion');
      });
      if (!animate) {
        stats.phase = 'living';
        finish('settled');
      }
      wake();
    } catch (error) {
      destroy('unavailable');
      throw error;
    }
    return api;
  }
  return {
    make,
    get active() {
      return active;
    },
    destroy: () => active?.destroy(),
    rebuild: () => active?.rebuild(),
    settle: () => active?.settle(),
    followLayout: () => active?.followLayout(),
  };
})();
