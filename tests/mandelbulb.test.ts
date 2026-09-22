import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mandelbulbFraming,
  mandelbulbMotion,
  mandelbulbQuality,
  mandelbulbSubjectRadius,
} from '../src/client/algorithms/mandelbulb/model';
import { createScene } from '../src/client/algorithms/mandelbulb/scene';
import { mandelbulbFragment } from '../src/client/algorithms/mandelbulb/shader';
import type {
  AlgorithmBudget,
  AlgorithmPointer,
  AlgorithmScene,
} from '../src/client/algorithms/types';

const full: AlgorithmBudget = { light: false, fps: 30, maxPixels: 360_000, maxDpr: 1.5 };
const light: AlgorithmBudget = { light: true, fps: 20, maxPixels: 160_000, maxDpr: 1 };
const idle: AlgorithmPointer = { x: 0, y: 0, active: false, down: false, tap: false };
const defines = ['#define MAX_STEPS', '#define ITERS', '#define SHADOW_STEPS'];

function tier(quality: ReturnType<typeof mandelbulbQuality>) {
  return {
    steps: quality.steps,
    iterations: quality.iterations,
    shadowSteps: quality.shadowSteps,
  };
}

function count(calls: string[], name: string) {
  return calls.filter((call) => call === name).length;
}

type WebGLStub = {
  gl: WebGL2RenderingContext;
  calls: string[];
  values: Map<string, number[]>;
};

/** Enough of a WebGL2 context to build, drive and dispose the scene without a browser. */
function createWebGLStub(
  options: { linkFails?: boolean; missingUniform?: string; onLink?: () => void } = {},
): WebGLStub {
  const calls: string[] = [];
  const values = new Map<string, number[]>();
  const locations = new Map<string, { name: string }>();
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    TRIANGLES: 5,
    createShader: () => ({}),
    shaderSource: () => calls.push('shaderSource'),
    compileShader: () => calls.push('compileShader'),
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => calls.push('deleteShader'),
    createProgram: () => ({}),
    attachShader: () => calls.push('attachShader'),
    linkProgram: () => {
      calls.push('linkProgram');
      options.onLink?.();
    },
    getProgramParameter: () => options.linkFails !== true,
    getProgramInfoLog: () => 'stub link log',
    deleteProgram: () => calls.push('deleteProgram'),
    createVertexArray: () => ({}),
    bindVertexArray: () => calls.push('bindVertexArray'),
    deleteVertexArray: () => calls.push('deleteVertexArray'),
    drawArrays: () => calls.push('drawArrays'),
    getUniformLocation: (_linked: unknown, name: string) => {
      if (name === options.missingUniform) return null;
      let location = locations.get(name);
      if (!location) {
        location = { name };
        locations.set(name, location);
      }
      return location;
    },
    useProgram: () => calls.push('useProgram'),
    uniform1f: (location: { name: string }, value: number) => values.set(location.name, [value]),
    uniform2f: (location: { name: string }, x: number, y: number) =>
      values.set(location.name, [x, y]),
    uniform3f: (location: { name: string }, x: number, y: number, z: number) =>
      values.set(location.name, [x, y, z]),
    viewport: () => calls.push('viewport'),
    getExtension: (name: string) =>
      name === 'WEBGL_lose_context' ? { loseContext: () => calls.push('loseContext') } : null,
  };
  return { gl: gl as unknown as WebGL2RenderingContext, calls, values };
}

/** A container that owns its canvas the way `createSurface` expects, plus the document it needs. */
function createDomStub(gl: WebGL2RenderingContext) {
  const children: unknown[] = [];
  const contexts: Array<{ type: string; options: WebGLContextAttributes }> = [];
  const canvas = {
    width: 300,
    height: 150,
    remove() {
      const index = children.indexOf(canvas);
      if (index >= 0) children.splice(index, 1);
    },
    getContext(type: string, options: WebGLContextAttributes) {
      contexts.push({ type, options });
      return gl;
    },
  };
  return {
    container: {
      children,
      append(element: unknown) {
        children.push(element);
      },
    } as unknown as HTMLElement,
    canvas,
    children,
    contexts,
    document: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        return canvas;
      },
      addEventListener() {
        throw new Error('the mandelbulb scene must not register document listeners');
      },
    },
  };
}

type DomStub = ReturnType<typeof createDomStub>;

/** Installs the stubs; the scene may read `window.devicePixelRatio` but never listen or schedule. */
function useDom(dom: DomStub, deviceRatio = 2) {
  const globals = globalThis as {
    document?: unknown;
    window?: unknown;
    requestAnimationFrame?: unknown;
  };
  const previous = {
    document: globals.document,
    window: globals.window,
    requestAnimationFrame: globals.requestAnimationFrame,
  };
  globals.document = dom.document;
  globals.window = {
    devicePixelRatio: deviceRatio,
    addEventListener() {
      throw new Error('the mandelbulb scene must not register window listeners');
    },
  };
  globals.requestAnimationFrame = () => {
    throw new Error('the mandelbulb scene must not schedule frames');
  };
  return () => {
    globals.document = previous.document;
    globals.window = previous.window;
    globals.requestAnimationFrame = previous.requestAnimationFrame;
  };
}

test('the shader tier follows the budget: 128/10/16 full, 72/7/8 light', () => {
  assert.deepEqual(tier(mandelbulbQuality(full)), { steps: 128, iterations: 10, shadowSteps: 16 });
  assert.deepEqual(tier(mandelbulbQuality(light)), { steps: 72, iterations: 7, shadowSteps: 8 });
  const fullShader = mandelbulbFragment(mandelbulbQuality(full));
  const lightShader = mandelbulbFragment(mandelbulbQuality(light));
  for (const define of ['#define MAX_STEPS 128', '#define ITERS 10', '#define SHADOW_STEPS 16'])
    assert.ok(fullShader.includes(define), `the full tier must define ${define}`);
  for (const define of ['#define MAX_STEPS 72', '#define ITERS 7', '#define SHADOW_STEPS 8'])
    assert.ok(lightShader.includes(define), `the light tier must define ${define}`);
});

test('the two tiers differ only in their budget defines', () => {
  const fullLines = mandelbulbFragment(mandelbulbQuality(full)).split('\n');
  const lightLines = mandelbulbFragment(mandelbulbQuality(light)).split('\n');
  const strip = (lines: string[]) =>
    lines.filter((line) => !defines.some((define) => line.startsWith(define)));
  assert.deepEqual(strip(fullLines), strip(lightLines));
  assert.deepEqual(
    fullLines.filter((line) => defines.some((define) => line.startsWith(define))),
    ['#define MAX_STEPS 128', '#define ITERS 10', '#define SHADOW_STEPS 16'],
  );
  assert.equal(mandelbulbFragment(mandelbulbQuality(full)), fullLines.join('\n'));
});

test('power and pulse are CPU uniforms, so the shader has no second clock', () => {
  const shader = mandelbulbFragment(mandelbulbQuality(full));
  for (const uniform of ['u_time', 'u_aspect', 'u_power', 'u_pulse'])
    assert.match(shader, new RegExp(`uniform float\\s+${uniform};`));
  for (const uniform of ['u_cam', 'u_framing'])
    assert.match(shader, new RegExp(`uniform (vec2|vec3)\\s+${uniform};`));
  assert.ok(shader.includes('return bulbDE(p/u_pulse,power,trap)*u_pulse;'));
  assert.ok(shader.includes('float power=u_power;'));
  assert.ok(
    !shader.includes('0.03*sin') && !shader.includes('1.4*sin'),
    'the living power and the pulse belong to the CPU model',
  );
  // The soft shadow, the distance estimator and the normal all take the same dynamic power: the
  // upstream core variant froze the shadow at 8.0, which is what this pins down.
  assert.ok(shader.includes('float sha=softShadow(p+n*0.01,lightDir,power);'));
  assert.ok(shader.includes('vec3 n=calcNormal(p,power);'));
  assert.ok(shader.includes('float softShadow(vec3 ro,vec3 rd,float power)'));
  assert.ok(
    !shader.includes('8.0'),
    'no power may be frozen into the shadow march the way the core variant froze it at 8.0',
  );
});

test('the living power wanders on two incommensurate sines instead of ping-ponging', () => {
  const start = mandelbulbMotion(0);
  assert.notEqual(start.power, mandelbulbMotion(37.5).power);
  assert.notEqual(start.pulse, mandelbulbMotion(3.9).pulse);
  const seen = new Set<string>();
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let seconds = 0; seconds <= 600; seconds += 0.5) {
    const { power, pulse, yaw, pitch } = mandelbulbMotion(seconds, {
      x: 0.4,
      y: -0.6,
      active: true,
    });
    assert.ok(
      [power, pulse, yaw, pitch].every(Number.isFinite),
      `${seconds}s must produce finite uniforms`,
    );
    assert.ok(power >= 5.2 && power <= 9.8, `power ${power} left its designed range`);
    assert.ok(pulse >= 0.97 && pulse <= 1.03, `pulse ${pulse} left its designed range`);
    seen.add(power.toFixed(6));
    minimum = Math.min(minimum, power);
    maximum = Math.max(maximum, power);
  }
  // A single sine would sweep 2.8 wide and repeat one value per period; this wanders ~4.6 of range.
  assert.ok(maximum - minimum > 4, 'the power must wander the whole designed range');
  assert.ok(seen.size > 600, 'the power must not repeat as a simple ping-pong would');
});

test('the pointer parallax is bounded, gated on activity and keeps the camera off the poles', () => {
  const at = (pointer?: AlgorithmPointer) => mandelbulbMotion(0, pointer);
  const rest = at();
  assert.ok(Math.abs(rest.yaw - 0.35) < 1e-12 && Math.abs(rest.pitch - 0.35) < 1e-12);
  const pushed = at({ ...idle, x: 1, y: 1, active: true });
  assert.ok(Math.abs(pushed.yaw - rest.yaw - 0.35) < 1e-12, 'yaw gain is 0.35 rad');
  assert.ok(Math.abs(pushed.pitch - rest.pitch - 0.2) < 1e-12, 'pitch gain is 0.2 rad');
  const extreme = at({ ...idle, x: 40, y: -40, active: true });
  assert.ok(Math.abs(extreme.yaw - rest.yaw - 0.35) < 1e-12, 'a clamped x keeps the full yaw gain');
  assert.ok(
    Math.abs(extreme.pitch - rest.pitch + 0.2) < 1e-12,
    'a clamped y keeps the full pitch gain',
  );
  assert.ok(Math.abs(extreme.yaw - rest.yaw) <= 0.35 + 1e-12, 'yaw stays inside its gain');
  assert.ok(Math.abs(extreme.pitch - rest.pitch) <= 0.2 + 1e-12, 'pitch stays inside its gain');
  const gated = at({ ...idle, x: 1, y: 1, active: false });
  assert.equal(gated.yaw, rest.yaw);
  assert.equal(gated.pitch, rest.pitch);
  for (const seconds of [0, 1e5, 1e9]) {
    for (const y of [-1, -0.5, 0, 0.5, 1]) {
      const { pitch } = mandelbulbMotion(seconds, { x: 0, y, active: true });
      assert.ok(Math.abs(pitch) <= 1.4, 'the orbit basis must never reach the poles');
    }
  }
  // Slow self-rotation: the upstream 0.15 rad/s orbit keeps the structure evolving.
  assert.ok(Math.abs(mandelbulbMotion(10).yaw - mandelbulbMotion(0).yaw - 1.5) < 1e-9);
});

test('a broken clock or pointer still produces finite uniforms', () => {
  for (const seconds of [NaN, Infinity, -Infinity, -5, undefined as unknown as number]) {
    const motion = mandelbulbMotion(seconds);
    assert.ok(Number.isFinite(motion.time) && motion.time >= 0);
    assert.ok([motion.power, motion.pulse, motion.yaw, motion.pitch].every(Number.isFinite));
  }
  const broken = mandelbulbMotion(0, { x: NaN, y: NaN, active: true });
  assert.deepEqual(broken, mandelbulbMotion(0));
  assert.deepEqual(mandelbulbMotion(0, { x: Infinity, y: -Infinity, active: true }), broken);
});

test('the quality tier caps pixels and DPR for any budget it is handed', () => {
  assert.deepEqual(
    { pixels: mandelbulbQuality(full).maxPixels, dpr: mandelbulbQuality(full).maxDpr },
    { pixels: 360_000, dpr: 1.5 },
  );
  assert.deepEqual(
    { pixels: mandelbulbQuality(light).maxPixels, dpr: mandelbulbQuality(light).maxDpr },
    { pixels: 160_000, dpr: 1 },
  );
  // A smaller device budget is respected; the light tier never exceeds DPR 1 or 160k pixels.
  assert.equal(mandelbulbQuality({ ...full, maxPixels: 90_000 }).maxPixels, 90_000);
  assert.equal(mandelbulbQuality({ ...full, maxPixels: 1e7, maxDpr: 99 }).maxPixels, 360_000);
  assert.equal(mandelbulbQuality({ ...light, maxPixels: Infinity, maxDpr: Infinity }).maxDpr, 1);
  const lightBroken = mandelbulbQuality({
    light: true,
    fps: NaN,
    maxPixels: NaN,
    maxDpr: -1,
  });
  assert.equal(lightBroken.maxPixels, 160_000);
  assert.equal(lightBroken.maxDpr, 1);
  for (const broken of [
    undefined,
    { light: false, fps: NaN, maxPixels: NaN, maxDpr: NaN },
    { light: false, fps: -1, maxPixels: -1, maxDpr: 0 },
  ]) {
    const quality = mandelbulbQuality(broken);
    assert.ok(Number.isFinite(quality.maxPixels) && quality.maxPixels > 0);
    assert.ok(Number.isFinite(quality.maxDpr) && quality.maxDpr > 0 && quality.maxDpr <= 1.5);
    for (const value of [quality.steps, quality.iterations, quality.shadowSteps])
      assert.ok(Number.isInteger(value) && value > 0);
  }
});

test('the subject stays inside the frame with padding at every aspect ratio', () => {
  const aspects = [0.3, 0.35, 0.46, 0.6, 0.75, 0.9, 1, 1.1, 1.25, 1.33, 1.5, 1.78, 2, 2.4, 3, 4];
  for (const aspect of aspects) {
    const { centerX, centerY, zoom } = mandelbulbFraming(aspect);
    assert.ok([centerX, centerY, zoom].every(Number.isFinite), `${aspect} must frame finitely`);
    assert.ok(zoom > 1 && zoom < 4, `${aspect} zoom ${zoom} left its envelope`);
    const radius = mandelbulbSubjectRadius / zoom;
    assert.ok(radius >= 0.2, `${aspect} must keep the subject visible`);
    assert.ok(
      aspect - (Math.abs(centerX) + radius) >= 0.05,
      `${aspect} must leave horizontal padding around the subject`,
    );
    assert.ok(
      1 - (Math.abs(centerY) + radius) >= 0.05,
      `${aspect} must leave vertical padding around the subject`,
    );
    // Lower than the middle everywhere; further right the wider the canvas gets.
    assert.ok(centerY <= 0.05, `${aspect} must not cover the upper band with the subject`);
    assert.ok(centerY >= -0.4);
    const middle = (centerX / aspect + 1) / 2;
    assert.ok(middle >= 0.4 && middle <= 0.7, `${aspect} subject sits at ${middle} of the width`);
    if (aspect >= 1.33)
      assert.ok(middle >= 0.6, `${aspect} should place the subject right of centre`);
    if (aspect <= 1) assert.ok(Math.abs(centerX) <= 0.05, `${aspect} should centre the subject`);
  }
  for (const broken of [NaN, Infinity, -1, 0]) {
    const framing = mandelbulbFraming(broken);
    assert.ok(
      [framing.centerX, framing.centerY, framing.zoom].every(Number.isFinite),
      `${broken} must fall back to a finite framing`,
    );
  }
});

test('the shader keeps the upstream clip, distance estimator and gamma output', () => {
  const shader = mandelbulbFragment(mandelbulbQuality(full));
  assert.ok(shader.startsWith('#version 300 es\n'));
  assert.ok(shader.includes('in vec2 vUv;'));
  assert.ok(!shader.includes('gl_FragCoord') && !shader.includes('u_resolution'));
  assert.ok(shader.includes('vec2 uv=(2.0*vUv-1.0)*vec2(u_aspect,1.0);'));
  assert.ok(shader.includes('vec2 fuv=(uv-u_framing.xy)*u_framing.z;'));
  // Bounding-sphere clip, then the Koebe/derivative distance estimate.
  assert.ok(shader.includes('float b=dot(ro,rd),c=dot(ro,ro)-1.6; float disc=b*b-c;'));
  assert.ok(shader.includes('tfar=-b+h'));
  assert.ok(shader.includes('trap=tr; return 0.25*log(m)*sqrt(m)/dz;'));
  assert.ok(shader.includes('vec2 e=vec2(1.0,-1.0)*0.0007;'));
  assert.ok(shader.includes('col=1.0-exp(-2.2*col);'));
  assert.ok(shader.includes('col=pow(col,vec3(0.4545));'));
  assert.ok(shader.includes('outColor=vec4(col,1.0);'));
  // Orbit-trap albedo, deep indigo background, gold/violet palette instead of the rainbow one.
  for (const trap of [
    'clamp(trap.y,0.0,1.0)',
    'clamp(trap.z*trap.z,0.0,1.0)',
    'clamp(pow(trap.w,6.0),0.0,1.0)',
  ])
    assert.ok(shader.includes(trap));
  assert.ok(shader.includes('vec3 col=vec3(0.016,0.020,0.072);'));
  assert.ok(shader.includes('vec3 palette(float u){ return mix('));
  assert.ok(!shader.includes('cos(6.28318'));
});

test('the scene draws one triangle per frame with finite uniforms and no scheduler of its own', () => {
  const stub = createWebGLStub();
  const dom = createDomStub(stub.gl);
  const restore = useDom(dom);
  try {
    const controller = new AbortController();
    const scene = createScene(dom.container, full, controller.signal) as AlgorithmScene;
    assert.equal(scene.canvas, dom.canvas);
    assert.equal(dom.contexts.length, 1);
    assert.equal(dom.contexts[0].type, 'webgl2');
    assert.equal(dom.contexts[0].options.preserveDrawingBuffer, false);
    scene.resize(1000, 600, 1);
    scene.frame(0, 0, idle);
    assert.equal(count(stub.calls, 'drawArrays'), 1);
    assert.ok(stub.calls.indexOf('useProgram') < stub.calls.indexOf('drawArrays'));
    assert.deepEqual(stub.values.get('u_time'), [0]);
    assert.deepEqual(stub.values.get('u_cam'), [0.35, 0.35]);
    assert.deepEqual(stub.values.get('u_pulse'), [1]);
    assert.ok(
      Math.abs(stub.values.get('u_aspect')![0] - dom.canvas.width / dom.canvas.height) < 1e-12,
    );
    const framing = stub.values.get('u_framing')!;
    assert.equal(framing.length, 3);
    assert.ok(framing.every(Number.isFinite));
    const first = stub.values.get('u_power')![0];
    assert.ok(first >= 5.2 && first <= 9.8);

    const pointer: AlgorithmPointer = { x: 1, y: 1, active: true, down: false, tap: false };
    scene.frame(30, 0.5, pointer);
    const motion = mandelbulbMotion(30, pointer);
    assert.equal(count(stub.calls, 'drawArrays'), 2);
    assert.ok(Math.abs(stub.values.get('u_power')![0] - motion.power) < 1e-12);
    assert.notEqual(stub.values.get('u_power')![0], first);
    assert.deepEqual(stub.values.get('u_cam'), [motion.yaw, motion.pitch]);
    assert.equal(count(stub.calls, 'requestAnimationFrame'), 0);
    scene.dispose();
  } finally {
    restore();
  }
});

test('resize keeps the canvas inside the pixel budget and the DPR cap at every scale', () => {
  const stub = createWebGLStub();
  const dom = createDomStub(stub.gl);
  const restore = useDom(dom);
  try {
    const scene = createScene(dom.container, full, new AbortController().signal) as AlgorithmScene;
    scene.resize(1000, 600, 1);
    const pixels = dom.canvas.width * dom.canvas.height;
    assert.ok(pixels > 0 && pixels <= 360_000, `full budget drew ${pixels} pixels`);
    scene.resize(1000, 600, 0.8);
    const reduced = dom.canvas.width * dom.canvas.height;
    assert.ok(reduced < pixels, 'a slow frame ladder must really lose pixels');
    assert.ok(reduced > 0 && reduced <= 360_000);
    // A small canvas is where the DPR cap binds: DPR 2 must still be capped at 1.5.
    scene.resize(400, 300, 1);
    assert.ok(Math.abs(dom.canvas.width / 400 - 1.5) < 1e-12);
    assert.equal(dom.canvas.width * dom.canvas.height, 600 * 450);
    scene.resize(0, 0, 1);
    assert.ok(dom.canvas.width >= 1 && dom.canvas.height >= 1);
    scene.dispose();

    const lightDom = createDomStub(stub.gl);
    const restoreLight = useDom(lightDom);
    const lightScene = createScene(
      lightDom.container,
      light,
      new AbortController().signal,
    ) as AlgorithmScene;
    assert.equal(lightScene.canvas, lightDom.canvas);
    lightScene.resize(400, 300, 1);
    assert.ok(Math.abs(lightDom.canvas.width / 400 - 1) < 1e-12, 'the light tier caps DPR at 1');
    lightScene.resize(2000, 1200, 1);
    const lightPixels = lightDom.canvas.width * lightDom.canvas.height;
    assert.ok(lightPixels > 0 && lightPixels <= 160_000, `light budget drew ${lightPixels} pixels`);
    lightScene.dispose();
    restoreLight();
  } finally {
    restore();
  }
});

test('dispose is idempotent and releases the program, the vertex array and the surface', () => {
  const stub = createWebGLStub();
  const dom = createDomStub(stub.gl);
  const restore = useDom(dom);
  try {
    const scene = createScene(dom.container, full, new AbortController().signal) as AlgorithmScene;
    scene.resize(800, 600, 1);
    scene.frame(0, 0, idle);
    scene.dispose();
    scene.dispose();
    assert.equal(count(stub.calls, 'deleteProgram'), 1);
    assert.equal(count(stub.calls, 'deleteVertexArray'), 1);
    assert.equal(count(stub.calls, 'loseContext'), 1);
    assert.deepEqual(dom.children, []);
    const calls = stub.calls.length;
    scene.frame(5, 0.1, idle);
    scene.resize(900, 700, 1);
    assert.equal(stub.calls.length, calls, 'a disposed scene must do no more work');
  } finally {
    restore();
  }
});

test('a build that fails part way releases what it created and rethrows', () => {
  const linkStub = createWebGLStub({ linkFails: true });
  const linkDom = createDomStub(linkStub.gl);
  let restore = useDom(linkDom);
  try {
    assert.throws(
      () => createScene(linkDom.container, full, new AbortController().signal),
      /failed to link/,
    );
    assert.deepEqual(linkDom.children, [], 'the canvas must leave the container');
    assert.equal(count(linkStub.calls, 'deleteProgram'), 1);
    assert.equal(count(linkStub.calls, 'deleteShader'), 2);
  } finally {
    restore();
  }

  const uniformStub = createWebGLStub({ missingUniform: 'u_pulse' });
  const uniformDom = createDomStub(uniformStub.gl);
  restore = useDom(uniformDom);
  try {
    assert.throws(
      () => createScene(uniformDom.container, full, new AbortController().signal),
      /u_pulse/,
    );
    assert.deepEqual(uniformDom.children, []);
    assert.equal(count(uniformStub.calls, 'deleteProgram'), 1);
    assert.equal(count(uniformStub.calls, 'deleteVertexArray'), 1);
    assert.equal(count(uniformStub.calls, 'loseContext'), 1);
  } finally {
    restore();
  }
});

test('an aborted signal opens no surface, before or during the build', () => {
  const stub = createWebGLStub();
  const dom = createDomStub(stub.gl);
  let restore = useDom(dom);
  try {
    const controller = new AbortController();
    controller.abort();
    assert.throws(
      () => createScene(dom.container, full, controller.signal),
      (error: Error) => error.name === 'AbortError',
    );
    assert.deepEqual(dom.children, []);
    assert.deepEqual(dom.contexts, []);
    assert.equal(stub.calls.length, 0);
  } finally {
    restore();
  }

  const late = new AbortController();
  const lateStub = createWebGLStub({ onLink: () => late.abort() });
  const lateDom = createDomStub(lateStub.gl);
  restore = useDom(lateDom);
  try {
    assert.throws(
      () => createScene(lateDom.container, full, late.signal),
      (error: Error) => error.name === 'AbortError',
    );
    assert.deepEqual(lateDom.children, [], 'a cancelled build must not keep its canvas');
    assert.equal(count(lateStub.calls, 'deleteProgram'), 1);
    assert.equal(count(lateStub.calls, 'deleteVertexArray'), 1);
  } finally {
    restore();
  }
});
