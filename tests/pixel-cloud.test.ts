import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { ditheringFragmentShader } from '@paper-design/shaders';
import { createPixelCloudScene, pixelCloudResolution } from '../src/client/pixel-cloud';
import { pixelCloudShader } from '../src/client/pixel-cloud-shader';
import type { PixelCloudBudget } from '../src/client/pixel-cloud';

// The exact noise function Paper Shaders 0.0.80 ships inside ditheringFragmentShader. The cloud
// effect may only replace this block, exactly once, so the test pins the shipped text.
const ORIGINAL = [
  'float getSimplexNoise(vec2 uv, float t) {',
  '  float noise = .5 * snoise(uv - vec2(0., .3 * t));',
  '  noise += .5 * snoise(2. * uv + vec2(0., .32 * t));',
  '',
  '  return noise;',
  '}',
].join('\n');

const FULL: PixelCloudBudget = { light: false, fps: 30, maxPixels: 900_000, pixelSize: 2.4 };
const LIGHT: PixelCloudBudget = { light: true, fps: 20, maxPixels: 320_000, pixelSize: 3 };
const SCALED: PixelCloudBudget = { light: false, fps: 30, maxPixels: 900_000, pixelSize: 1 };
const TINY: PixelCloudBudget = { light: false, fps: 30, maxPixels: 4, pixelSize: 0.5 };
const PINNED: PixelCloudBudget = { light: false, fps: 30, maxPixels: 10_000, pixelSize: 100 };

/**
 * Splits a rewritten shader into the untouched prefix/suffix of the shipped shader and the block
 * that replaced the reference noise function.
 */
function rewrite(source: string, rewritten: string) {
  const start = source.indexOf(ORIGINAL);
  assert.ok(start >= 0, 'the shipped dithering shader must contain the reference noise function');
  const prefix = source.slice(0, start);
  const suffix = source.slice(start + ORIGINAL.length);
  assert.equal(
    rewritten.split(ORIGINAL).length - 1,
    0,
    'the reference noise function must be gone',
  );
  assert.ok(rewritten.startsWith(prefix), 'shader text before the noise function must not change');
  assert.ok(rewritten.endsWith(suffix), 'shader text after the noise function must not change');
  assert.ok(
    rewritten.length > prefix.length + suffix.length,
    'the noise function must be replaced',
  );
  return {
    prefix,
    suffix,
    replaced: rewritten.slice(prefix.length, rewritten.length - suffix.length),
  };
}

test('the cloud noise swaps the shipped Paper noise once, keeping every Bayer and main byte', () => {
  const full = pixelCloudShader(ditheringFragmentShader, false);
  const light = pixelCloudShader(ditheringFragmentShader, true);
  const fullRewrite = rewrite(ditheringFragmentShader, full);
  const lightRewrite = rewrite(ditheringFragmentShader, light);
  const replacement = fullRewrite.replaced;

  // Only the noise function is exchanged: one definition each, and nothing pixel related in it.
  for (const name of ['float cloudFbm(vec2 p) {', 'float getSimplexNoise(vec2 uv, float t) {'])
    assert.equal(full.split(name).length - 1, 1);
  assert.doesNotMatch(replacement, /void main/);
  assert.doesNotMatch(replacement, /gl_FragCoord/);
  assert.doesNotMatch(
    replacement,
    /u_resolution/,
    'the density must not be screened by the canvas',
  );
  assert.doesNotMatch(replacement, /u_time/, 'the shader receives time as the t argument only');
  assert.equal(
    replacement.split('{').length,
    replacement.split('}').length,
    'the replacement must be brace balanced',
  );
  // The Bayer 8x8 matrix, the pixelisation and the type switch all live in the untouched suffix.
  const bayer = ditheringFragmentShader.slice(
    ditheringFragmentShader.indexOf('const int bayer8x8[64]'),
    ditheringFragmentShader.indexOf('float getBayerValue'),
  );
  assert.ok(bayer.includes('63, 31, 55, 23, 61, 29, 53, 21'));
  assert.ok(fullRewrite.suffix.includes(bayer));
  assert.ok(fullRewrite.suffix.includes('dithering = getBayerValue(pxSizeUV, 8);'));

  // Full and light differ only inside the replaced block, and only by the fbm octave count.
  assert.equal(fullRewrite.prefix, lightRewrite.prefix);
  assert.equal(fullRewrite.suffix, lightRewrite.suffix);
  assert.notEqual(fullRewrite.replaced, lightRewrite.replaced);
  assert.match(fullRewrite.replaced, /for \(int octave = 0; octave < 3; octave\+\+\)/);
  assert.match(lightRewrite.replaced, /for \(int octave = 0; octave < 2; octave\+\+\)/);
  assert.doesNotMatch(fullRewrite.replaced, /octave < 2/);
  assert.doesNotMatch(lightRewrite.replaced, /octave < 3/);

  // The density is deformed by a two dimensional, genuinely different time warp per octave stack.
  assert.match(replacement, /vec2\(\s*cloudFbm\([\s\S]*?\),\s*cloudFbm\(/);
  const drifts = [
    ...replacement.matchAll(/vec2\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*\*\s*t/g),
  ].map((match) => `${match[1]},${match[2]}`);
  assert.ok(drifts.length >= 3, 'the drift and both warp trajectories must be time dependent');
  assert.equal(new Set(drifts).size, drifts.length, 'each time trajectory must be distinct');
  for (const drift of drifts)
    for (const part of drift.split(',')) assert.notEqual(Number(part), 0, `vec2(${drift}) is 1D`);
  assert.doesNotMatch(replacement, /vec2\(0\.,/, 'no axis aligned time translation may remain');

  // The whole canvas receives the warped density: no screen window and no windowed mix remain.
  assert.match(replacement, /return cloudFbm\(drift \+ warp \* 1\.35\);/);
  assert.doesNotMatch(replacement, /\bmix\(/, 'the density must reach the suffix unmixed');

  assert.equal(
    pixelCloudShader(ditheringFragmentShader, false),
    full,
    'the rewrite is deterministic',
  );
  assert.equal(pixelCloudShader(ditheringFragmentShader, true), light);
});

test('the cloud noise refuses a missing, altered or duplicated reference function', () => {
  const message = { name: 'Error', message: 'Unsupported Paper Dithering noise function' };
  assert.throws(() => pixelCloudShader('void main() {}', false), message);
  assert.throws(() => pixelCloudShader('', true), message);
  assert.throws(
    () => pixelCloudShader(ORIGINAL.replace('vec2(0., .3 * t)', 'vec2(0., .3*t)'), false),
    message,
  );
  assert.throws(() => pixelCloudShader(`${ORIGINAL}\n${ORIGINAL}`, false), message);
  assert.throws(() => pixelCloudShader(`${ditheringFragmentShader}\n${ORIGINAL}`, true), message);
  assert.equal(pixelCloudShader(ORIGINAL, false).split(ORIGINAL).length - 1, 0);
});

test('pixel cloud resolution reserves rounded-edge headroom and clamps the scale', () => {
  for (const budget of [FULL, LIGHT, SCALED]) {
    for (const scale of [1, 0.8, 0.65]) {
      const target = Math.floor(Math.min(budget.maxPixels, 600_000) * scale * scale);
      const headroom = Math.ceil(800 * Math.sqrt(target / 600_000) + 0.25);
      const result = pixelCloudResolution(1000, 600, budget, scale);
      assert.equal(result.maxPixels, target - headroom);
      assert.equal(
        result.pixelSize,
        Math.max(budget.pixelSize, Math.sqrt(600_000 / result.maxPixels)),
      );
      assert.ok(result.maxPixels < target);
    }
  }
  // scale is clamped into [0.65, 1] and a non finite scale falls back to 1
  assert.deepEqual(
    pixelCloudResolution(1000, 600, FULL, 0.1),
    pixelCloudResolution(1000, 600, FULL, 0.65),
  );
  assert.deepEqual(
    pixelCloudResolution(1000, 600, FULL, 12),
    pixelCloudResolution(1000, 600, FULL, 1),
  );
  assert.deepEqual(
    pixelCloudResolution(1000, 600, FULL, NaN),
    pixelCloudResolution(1000, 600, FULL, 1),
  );
  assert.deepEqual(
    pixelCloudResolution(1000, 600, FULL, Infinity),
    pixelCloudResolution(1000, 600, FULL, 1),
  );
});

test('pixel cloud resolution treats unusable dimensions as one pixel instead of throwing', () => {
  // The budget is deliberately tiny so the clamped area is observable through the pixel size.
  assert.deepEqual(pixelCloudResolution(2, 2, TINY), { maxPixels: 1, pixelSize: 2 });
  assert.deepEqual(pixelCloudResolution(2, 2, TINY, 0.65), { maxPixels: 1, pixelSize: 2 });
  assert.deepEqual(pixelCloudResolution(40000, 40000, TINY), { maxPixels: 1, pixelSize: 32768 });
  assert.deepEqual(pixelCloudResolution(Infinity, Infinity, TINY), { maxPixels: 1, pixelSize: 1 });
  assert.deepEqual(pixelCloudResolution(0, NaN, TINY), { maxPixels: 1, pixelSize: 1 });
  assert.deepEqual(pixelCloudResolution(-5, 2.5, TINY), pixelCloudResolution(1, 2.5, TINY));
  assert.deepEqual(pixelCloudResolution(9, 3, TINY), { maxPixels: 1, pixelSize: Math.sqrt(27) });
  assert.deepEqual(
    pixelCloudResolution(40000, 40000, FULL),
    pixelCloudResolution(32768, 32768, FULL),
  );
  for (const width of [NaN, Infinity, -40000, 0, 1, 40000])
    for (const height of [NaN, Infinity, -1, 2.5, 32768, 40000]) {
      const result = pixelCloudResolution(width, height, TINY, 0.65);
      assert.ok(Number.isInteger(result.maxPixels) && result.maxPixels >= 1);
      assert.ok(result.maxPixels <= TINY.maxPixels);
      assert.ok(Number.isFinite(result.pixelSize) && result.pixelSize >= TINY.pixelSize);
    }
});

test('Paper dimension rounding cannot exceed the desktop, mobile or downgraded pixel target', () => {
  for (const [width, height] of [
    [1200, 800],
    [390, 844],
    [320, 1000],
    [1920, 1080],
    [3840, 2160],
    [32768, 32768],
  ]) {
    for (const budget of [FULL, LIGHT]) {
      for (const scale of [1, 0.8, 0.65]) {
        const result = pixelCloudResolution(width, height, budget, scale);
        const target = Math.floor(Math.min(budget.maxPixels, width * height) * scale * scale);
        for (const dpr of [1, 2, 3]) {
          // Paper rounds each output dimension independently after scaling its device-pixel area.
          const ratio = Math.min(1, Math.sqrt(result.maxPixels / (width * height * dpr * dpr)));
          const canvasWidth = Math.round(width * dpr * ratio);
          const canvasHeight = Math.round(height * dpr * ratio);
          assert.ok(canvasWidth > 0 && canvasHeight > 0);
          assert.ok(
            canvasWidth * canvasHeight <= target,
            `${width}x${height}, DPR ${dpr}, scale ${scale}: ${canvasWidth * canvasHeight} > ${target}`,
          );
          assert.ok(result.pixelSize * Math.sqrt(result.maxPixels / (width * height)) >= 1 - 1e-12);
        }
      }
    }
  }
});

test('pixel cloud resolution rejects an unusable budget before touching any renderer', () => {
  for (const maxPixels of [0, -1, NaN, Infinity, -Infinity])
    assert.throws(
      () => pixelCloudResolution(1000, 600, { ...FULL, maxPixels }),
      { name: 'RangeError', message: 'Cloud pixel budget must be positive and finite' },
      `maxPixels ${maxPixels}`,
    );
  for (const pixelSize of [0, -2.4, NaN, Infinity])
    assert.throws(
      () => pixelCloudResolution(1000, 600, { ...FULL, pixelSize }),
      { name: 'RangeError', message: 'Cloud pixel size must be positive and finite' },
      `pixelSize ${pixelSize}`,
    );
});

class ElementStub extends EventTarget {
  className = '';
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly children: ElementStub[] = [];
  parent: ElementStub | undefined;
  rect = { left: 0, top: 0, width: 1000, height: 600 };

  constructor(readonly tagName = 'DIV') {
    super();
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  append(element: ElementStub) {
    element.remove();
    element.parent = this;
    this.children.push(element);
  }
  remove() {
    if (!this.parent) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = undefined;
  }
  getBoundingClientRect() {
    return this.rect;
  }
  querySelectorAll(selector: string) {
    const found: ElementStub[] = [];
    const walk = (element: ElementStub) => {
      for (const child of element.children) {
        if (child.tagName.toLowerCase() === selector) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
}

/** A CPU side stand in for the browser context: it records how the scene probes the program. */
class GlStub {
  readonly CURRENT_PROGRAM = 0x8b8d;
  readonly LINK_STATUS = 0x8b82;
  readonly calls: string[] = [];
  program: object | null = { name: 'program' };
  linked = true;
  lost = false;
  loseContexts = 0;

  count(call: string) {
    return this.calls.filter((entry) => entry === call).length;
  }
  getParameter(name: number) {
    this.calls.push('getParameter');
    assert.equal(name, this.CURRENT_PROGRAM);
    return this.program;
  }
  getProgramParameter(program: unknown, name: number) {
    this.calls.push('getProgramParameter');
    assert.equal(program, this.program);
    assert.equal(name, this.LINK_STATUS);
    return this.linked;
  }
  isContextLost() {
    this.calls.push('isContextLost');
    return this.lost;
  }
  getExtension(name: string) {
    this.calls.push(`getExtension:${name}`);
    assert.equal(name, 'WEBGL_lose_context');
    return {
      loseContext: () => {
        this.loseContexts++;
        this.lost = true;
      },
    };
  }
}

class CanvasStub extends ElementStub {
  readonly gl = new GlStub();
  readonly requests: string[] = [];
  nullContext = false;
  contextError: Error | undefined;

  constructor() {
    super('CANVAS');
  }
  getContext(kind: string) {
    this.requests.push(kind);
    assert.equal(kind, 'webgl2');
    if (this.contextError) throw this.contextError;
    return this.nullContext ? null : this.gl;
  }
}

/** A CPU side stand in for a Paper shader mount; it owns the canvas it inserts into the surface. */
class PaperStub {
  readonly setFrames: number[] = [];
  readonly uniforms: Array<Record<string, number | number[]>> = [];
  readonly pixelCounts: number[] = [];
  disposals = 0;
  frameError: Error | undefined;
  disposeError: Error | undefined;

  constructor(
    readonly container: ElementStub,
    readonly canvas: CanvasStub,
  ) {
    container.append(canvas);
  }
  get canvasElement() {
    return this.canvas;
  }
  setFrame(milliseconds: number) {
    this.setFrames.push(milliseconds);
    if (this.frameError) throw this.frameError;
  }
  setUniforms(values: Record<string, number | number[]>) {
    this.uniforms.push({ ...values });
  }
  setMaxPixelCount(count: number) {
    this.pixelCounts.push(count);
  }
  dispose() {
    this.disposals++;
    this.canvas.remove();
    if (this.disposeError) throw this.disposeError;
  }
}

type MountCall = {
  container: ElementStub;
  source: string;
  uniforms: Record<string, number | number[]>;
  maxPixels: number;
};

type MountOptions = {
  canvas?: CanvasStub;
  throwOnCreate?: boolean;
  disposeError?: Error;
  frameError?: Error;
};

function createMount(options: MountOptions = {}) {
  const calls: MountCall[] = [];
  const instances: PaperStub[] = [];
  const mount = (
    container: ElementStub,
    source: string,
    uniforms: Record<string, number | number[]>,
    maxPixels: number,
  ) => {
    calls.push({ container, source, uniforms, maxPixels });
    const instance = new PaperStub(container, options.canvas ?? new CanvasStub());
    instance.disposeError = options.disposeError;
    instance.frameError = options.frameError;
    instances.push(instance);
    if (options.throwOnCreate) throw new Error('paper mount failed');
    return instance;
  };
  return {
    mount: mount as unknown as NonNullable<Parameters<typeof createPixelCloudScene>[2]>,
    calls,
    instances,
    get instance() {
      return instances[0]!;
    },
  };
}

function createHarness(t: TestContext) {
  const names = ['document', 'fetch', 'location'];
  const saved = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const created: ElementStub[] = [];
  const errors: string[] = [];
  const posts: Array<Record<string, unknown>> = [];
  const document = Object.assign(new EventTarget(), {
    createElement: (tag: string) => {
      assert.equal(tag, 'div');
      const element = new ElementStub();
      created.push(element);
      return element;
    },
  });
  const console = { error: (...args: unknown[]) => errors.push(String(args[0])) };
  const fetch = async (_url: string, init?: { body?: string }) => {
    posts.push(JSON.parse(init?.body ?? '{}'));
    return { ok: true };
  };
  const consoleSaved = Object.getOwnPropertyDescriptor(globalThis, 'console');
  for (const [name, value] of Object.entries({
    document,
    console,
    fetch,
    location: { pathname: '/hero' },
  }))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });

  const container = new ElementStub();
  const scenes: Array<ReturnType<typeof createPixelCloudScene>> = [];
  t.after(() => {
    try {
      for (const scene of scenes) scene.dispose();
    } finally {
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
      if (consoleSaved) Object.defineProperty(globalThis, 'console', consoleSaved);
      else Reflect.deleteProperty(globalThis, 'console');
    }
  });

  return {
    document,
    created,
    errors,
    posts,
    container,
    scene(budget: PixelCloudBudget = FULL, options: MountOptions = {}) {
      const injected = createMount(options);
      const scene = createPixelCloudScene(
        container as unknown as HTMLElement,
        budget,
        injected.mount,
      );
      scenes.push(scene);
      return { mount: injected, scene };
    },
  };
}

for (const [budget, light] of [
  [FULL, false],
  [LIGHT, true],
] as const) {
  test(`the ${light ? 'light' : 'full'} scene mounts Paper into its own surface with the cloud shader`, (t) => {
    const h = createHarness(t);
    const { scene, mount } = h.scene(budget);
    assert.equal(h.container.children.length, 1);
    const surface = h.container.children[0]!;
    assert.equal(surface.className, 'pixel-cloud-surface');
    assert.equal(mount.calls.length, 1);
    const call = mount.calls[0]!;
    assert.equal(call.container, surface);
    assert.equal(call.source, pixelCloudShader(ditheringFragmentShader, light));
    assert.equal(call.maxPixels, pixelCloudResolution(1000, 600, budget).maxPixels);
    assert.ok(call.maxPixels <= Math.min(budget.maxPixels, 600_000));
    // Paper drives the 8x8 Bayer dithering with a pixelised simplex shape. The front colour and
    // pattern scale are cosmetic constants that the design tunes, so only their shape is pinned.
    const { u_colorFront: front, u_scale: patternScale, ...pinned } = call.uniforms;
    assert.deepEqual(pinned, {
      u_colorBack: [0, 0, 0, 1],
      u_shape: 1,
      u_type: 4,
      u_pxSize: budget.pixelSize,
      u_fit: 2,
      u_rotation: 0,
      u_originX: 0.5,
      u_originY: 0.5,
      u_offsetX: 0,
      u_offsetY: 0,
      u_worldWidth: 0,
      u_worldHeight: 0,
    });
    assert.equal(Object.keys(call.uniforms).length, 14, 'no unexpected uniform may be sent');
    const channels = front as number[];
    assert.equal(channels.length, 4);
    assert.equal(channels.at(-1), 1);
    assert.ok(channels.slice(0, 3).every((channel) => channel >= 0 && channel <= 1));
    assert.ok(Number.isFinite(patternScale as number) && (patternScale as number) > 0);
    assert.equal(scene.canvas, mount.instance.canvas as unknown as HTMLCanvasElement);
    assert.equal(mount.instance.canvas.parent, surface);
    assert.deepEqual(mount.instance.setFrames, [], 'mounting alone must not advance the clock');
    assert.deepEqual(h.errors, []);
  });
}

test('frames advance the Paper clock in milliseconds and verify the program link only once', (t) => {
  const h = createHarness(t);
  const { scene, mount } = h.scene();
  scene.frame(0.25);
  scene.frame(1);
  scene.frame(-4);
  assert.deepEqual(mount.instance.setFrames, [250, 1000, 0]);
  assert.equal(mount.instance.canvas.gl.count('getParameter'), 1);
  assert.equal(mount.instance.canvas.gl.count('getProgramParameter'), 1);
  assert.deepEqual(mount.instance.uniforms, [], 'advancing time must not reconfigure uniforms');
  assert.deepEqual(mount.instance.pixelCounts, []);
  for (const seconds of [NaN, Infinity, -Infinity])
    assert.throws(
      () => scene.frame(seconds),
      { name: 'RangeError', message: 'Cloud time must be finite' },
      `${seconds}`,
    );
  assert.deepEqual(mount.instance.setFrames, [250, 1000, 0], 'non finite time never reaches Paper');
  assert.deepEqual(h.errors, []);
});

test('a failed link check rejects the frame and re-verifies until the shader is usable', (t) => {
  const h = createHarness(t);
  const { scene, mount } = h.scene();
  const gl = mount.instance.canvas.gl;
  const message = { name: 'Error', message: 'Pixel cloud shader did not initialize' };
  gl.linked = false;
  assert.throws(() => scene.frame(0.5), message);
  gl.linked = true;
  gl.program = null;
  assert.throws(() => scene.frame(0.5), message);
  gl.program = { name: 'program' };
  gl.lost = true;
  assert.throws(() => scene.frame(0.5), message);
  gl.lost = false;
  assert.deepEqual(
    mount.instance.setFrames,
    [500, 500, 500],
    'the clock advanced before the check',
  );
  scene.frame(0.5);
  assert.equal(gl.count('getParameter'), 4);
  scene.frame(0.75);
  assert.equal(gl.count('getParameter'), 4, 'a verified program is never probed again');
  assert.deepEqual(mount.instance.setFrames, [500, 500, 500, 500, 750]);
});

test('resize reapplies the budget only when pixel count or pixel size actually change', (t) => {
  const h = createHarness(t);
  h.container.rect = { left: 0, top: 0, width: 2000, height: 2000 };
  const { scene, mount } = h.scene(SCALED);
  scene.resize(2000, 2000, 1);
  assert.deepEqual(mount.instance.pixelCounts, []);
  assert.deepEqual(mount.instance.uniforms, []);
  const reduced = pixelCloudResolution(2000, 2000, SCALED, 0.65);
  const full = pixelCloudResolution(2000, 2000, SCALED, 1);
  scene.resize(2000, 2000, 0.65);
  assert.deepEqual(mount.instance.pixelCounts, [reduced.maxPixels]);
  assert.deepEqual(mount.instance.uniforms, [{ u_pxSize: reduced.pixelSize }]);
  scene.resize(2000, 2000, 0.65);
  assert.equal(mount.instance.pixelCounts.length, 1, 'an unchanged budget is not re-sent');
  assert.equal(mount.instance.uniforms.length, 1);
  scene.resize(2000, 2000, 0.1);
  assert.deepEqual(
    mount.instance.pixelCounts,
    [reduced.maxPixels],
    'scale below 0.65 clamps to 0.65',
  );
  scene.resize(2000, 2000, 12);
  assert.deepEqual(mount.instance.pixelCounts, [reduced.maxPixels, full.maxPixels]);
  assert.deepEqual(mount.instance.uniforms.at(-1), { u_pxSize: full.pixelSize });
});

test('a resize that leaves both budget outputs unchanged does not touch Paper', (t) => {
  const h = createHarness(t);
  const { scene, mount } = h.scene(PINNED);
  assert.equal(mount.calls[0]!.maxPixels, pixelCloudResolution(1000, 600, PINNED).maxPixels);
  assert.equal(mount.calls[0]!.uniforms.u_pxSize, 100);
  scene.resize(600, 1000, 1);
  scene.resize(2000, 1200, 1);
  assert.deepEqual(mount.instance.pixelCounts, []);
  assert.deepEqual(mount.instance.uniforms, []);
  scene.resize(Infinity, NaN, NaN);
  assert.deepEqual(mount.instance.pixelCounts, [1], 'unusable dimensions collapse to one pixel');
  assert.deepEqual(mount.instance.uniforms, []);
});

test('dispose is idempotent, loses the WebGL context and removes the surface it owns', (t) => {
  const h = createHarness(t);
  const { scene, mount } = h.scene();
  const surface = h.container.children[0]!;
  const canvas = mount.instance.canvas;
  assert.equal(canvas.parent, surface);
  scene.dispose();
  scene.dispose();
  assert.equal(mount.instance.disposals, 1);
  assert.equal(canvas.gl.count('getExtension:WEBGL_lose_context'), 1);
  assert.equal(canvas.gl.loseContexts, 1);
  assert.equal(canvas.gl.lost, true);
  assert.equal(canvas.parent, undefined);
  assert.equal(h.container.children.length, 0);
  const frames = mount.instance.setFrames.length;
  const counts = mount.instance.pixelCounts.length;
  scene.frame(1);
  scene.frame(NaN);
  scene.resize(100, 100, 0.65);
  assert.equal(mount.instance.setFrames.length, frames, 'a disposed scene ignores frames');
  assert.equal(mount.instance.pixelCounts.length, counts, 'a disposed scene ignores resizes');
  assert.equal(h.container.children.length, 0);
});

test('an already lost context is not asked to lose again', (t) => {
  const h = createHarness(t);
  const { scene, mount } = h.scene();
  mount.instance.canvas.gl.lost = true;
  scene.dispose();
  assert.equal(mount.instance.canvas.gl.loseContexts, 0);
  assert.equal(h.container.children.length, 0);
});

test('a disposal failure is reported as a controlled summary and still tears the surface down', (t) => {
  const h = createHarness(t);
  const { scene, mount } = h.scene(FULL, { disposeError: new Error('paper dispose failed') });
  scene.dispose();
  assert.equal(mount.instance.disposals, 1);
  assert.equal(h.container.children.length, 0);
  assert.equal(mount.instance.canvas.gl.loseContexts, 1, 'context loss still runs after a failure');
  assert.deepEqual(h.posts, [{ kind: 'pixel-cloud:dispose', code: 'Error', path: '/hero' }]);
  assert.deepEqual(h.errors, []);
});

test('a failed context lookup during disposal is reported without leaking the teardown', (t) => {
  const h = createHarness(t);
  const { scene, mount } = h.scene();
  mount.instance.canvas.contextError = new Error('context lookup failed');
  scene.dispose();
  assert.equal(h.container.children.length, 0);
  assert.ok(h.posts.some((post) => post.kind === 'pixel-cloud:context'));
  assert.deepEqual(h.errors, []);
});

test('a canvas without WebGL2 fails the mount and leaves no surface behind', (t) => {
  const h = createHarness(t);
  const canvas = new CanvasStub();
  canvas.nullContext = true;
  const mount = createMount({ canvas });
  assert.throws(
    () => createPixelCloudScene(h.container as unknown as HTMLElement, FULL, mount.mount),
    /Pixel cloud requires WebGL2/,
  );
  assert.equal(h.container.children.length, 0);
  assert.equal(canvas.parent, undefined, 'the half mounted canvas must not keep a surface alive');
  assert.equal(canvas.gl.loseContexts, 0);
});

test('a factory that throws after inserting its canvas has that canvas reclaimed', (t) => {
  const h = createHarness(t);
  const canvas = new CanvasStub();
  const mount = createMount({ canvas, throwOnCreate: true });
  assert.throws(
    () => createPixelCloudScene(h.container as unknown as HTMLElement, FULL, mount.mount),
    /paper mount failed/,
  );
  assert.equal(mount.calls.length, 1);
  assert.equal(h.container.children.length, 0);
  assert.ok(!h.container.children.includes(canvas));
  assert.equal(canvas.gl.count('getExtension:WEBGL_lose_context'), 1);
  assert.equal(canvas.gl.loseContexts, 1, 'the abandoned canvas context is released');
  assert.equal(mount.instances[0]!.disposals, 0, 'a throwing factory never hands over a scene');
  assert.deepEqual(h.errors, []);
});
