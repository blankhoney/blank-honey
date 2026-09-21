import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import test, { type TestContext } from 'node:test';
import { BufferGeometry, DataTexture, FloatType, RGBAFormat } from 'three';
import mountBirds, { birdBudget } from '../src/client/effects/birds';
import type { FlockBudget, FlockScene } from '../src/client/flock-scene';
import type { HeroContext } from '../src/client/hero';
import {
  birdVS,
  createBirdGeometry,
  fillBirdTexture,
  flockBounds,
} from '../src/client/vendor/vanta-birds';

type SceneLoader = NonNullable<Parameters<typeof mountBirds>[1]>;

class ElementStub extends EventTarget {
  className = '';
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly styles = new Map<string, string>();
  readonly style = {
    setProperty: (name: string, value: string) => this.styles.set(name, value),
  };
  readonly children: ElementStub[] = [];
  parent: ElementStub | undefined;
  rect = { left: 80, top: 50, width: 1000, height: 600 };

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
}

class DocumentStub extends EventTarget {
  hidden = false;
  readonly body = new ElementStub('BODY');
  readonly created: ElementStub[] = [];

  createElement(tag: string) {
    assert.ok(['div', 'i', 'canvas'].includes(tag));
    const element = new ElementStub(tag.toUpperCase());
    this.created.push(element);
    return element;
  }
}

class SceneStub {
  readonly canvas = new ElementStub('CANVAS');
  readonly resizes: Array<{ width: number; height: number; dpr: number }> = [];
  readonly frames: Array<{ time: number; delta: number; pointer: { x: number; y: number } }> = [];
  readonly scales: number[] = [];
  disposals = 0;
  resizeError: Error | undefined;
  frameError: Error | undefined;
  scaleError: Error | undefined;

  resize(width: number, height: number, dpr: number) {
    this.resizes.push({ width, height, dpr });
    if (this.resizeError) throw this.resizeError;
  }
  setResolutionScale(scale: number) {
    this.scales.push(scale);
    if (this.scaleError) throw this.scaleError;
  }
  frame(time: number, delta: number, pointer: { x: number; y: number }) {
    this.frames.push({ time, delta, pointer: { ...pointer } });
    if (this.frameError) throw this.frameError;
  }
  dispose() {
    // Deliberately count every invocation; the wrapper must not release its scene twice.
    this.disposals++;
    this.canvas.remove();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function createHarness(t: TestContext, hidden = false) {
  const names = [
    'document',
    'window',
    'location',
    'fetch',
    'ResizeObserver',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ];
  const saved = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const document = new DocumentStub();
  document.hidden = hidden;
  const window = { devicePixelRatio: 2 };
  const rafs = new Map<number, FrameRequestCallback>();
  const controllers: AbortController[] = [];
  const observers: ObserverStub[] = [];
  let nextRaf = 0;
  let peakRafs = 0;

  class ObserverStub {
    readonly targets = new Set<ElementStub>();
    constructor(readonly callback: () => void) {
      observers.push(this);
    }
    observe(target: ElementStub) {
      this.targets.add(target);
    }
    disconnect() {
      this.targets.clear();
    }
    notify() {
      if (this.targets.size) this.callback();
    }
  }

  for (const [name, value] of Object.entries({
    document,
    window,
    location: { pathname: '/' },
    fetch: async () => ({ ok: true }),
    ResizeObserver: ObserverStub,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      const id = ++nextRaf;
      rafs.set(id, callback);
      peakRafs = Math.max(peakRafs, rafs.size);
      return id;
    },
    cancelAnimationFrame: (id: number) => rafs.delete(id),
  }))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });

  t.after(() => {
    try {
      for (const controller of controllers) controller.abort();
    } finally {
      rafs.clear();
      for (const observer of observers) observer.disconnect();
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    }
  });

  return {
    document,
    window,
    rafs,
    observers,
    get peakRafs() {
      return peakRafs;
    },
    tick(time: number) {
      for (const [id, callback] of [...rafs]) {
        if (!rafs.delete(id)) continue;
        callback(time);
      }
    },
    visibility(nextHidden: boolean) {
      document.hidden = nextHidden;
      document.dispatchEvent(new Event('visibilitychange'));
    },
    instance(options: { reduced?: boolean; light?: boolean } = {}) {
      const host = new ElementStub();
      const stage = new ElementStub();
      host.append(stage);
      document.body.append(host);
      const controller = new AbortController();
      controllers.push(controller);
      const scene = new SceneStub();
      const budgets: FlockBudget[] = [];
      let loads = 0;
      let createError: Error | undefined;
      const module = {
        createFlockScene(budget: FlockBudget): FlockScene {
          budgets.push({ ...budget });
          if (createError) throw createError;
          return scene as unknown as FlockScene;
        },
      };
      const loader: SceneLoader = async () => {
        loads++;
        return module;
      };
      return {
        host,
        stage,
        controller,
        scene,
        budgets,
        module,
        get loads() {
          return loads;
        },
        set createError(error: Error) {
          createError = error;
        },
        mount(load: SceneLoader = loader) {
          return mountBirds(
            {
              host,
              stage,
              signal: controller.signal,
              reduced: options.reduced ?? false,
              light: options.light ?? false,
            } as unknown as HeroContext,
            load,
          );
        },
        pointer(type: string, x: number, y: number) {
          host.dispatchEvent(
            Object.assign(new Event('pointermove'), {
              pointerType: type,
              clientX: x,
              clientY: y,
            }),
          );
        },
        assertStatic() {
          assert.equal(stage.children.length, 1);
          const layer = stage.children[0]!;
          assert.equal(layer.className, 'flock-layer');
          assert.equal(layer.dataset.state, 'static');
          assert.equal(layer.attributes.get('aria-hidden'), 'true');
          assert.equal(layer.children.length, 1);
          assert.equal(layer.children[0]!.className, 'flock-still');
          assert.equal(layer.children[0]!.children.length, 0);
        },
        assertReleased() {
          assert.equal(scene.canvas.parent, undefined);
          assert.equal(rafs.size, 0);
          assert.equal(getEventListeners(host, 'pointermove').length, 0);
          assert.equal(getEventListeners(host, 'pointerleave').length, 0);
          assert.equal(getEventListeners(scene.canvas, 'webglcontextlost').length, 0);
          assert.equal(getEventListeners(document, 'visibilitychange').length, 0);
          assert.ok(observers.every((observer) => observer.targets.size === 0));
        },
        assertDetached() {
          this.assertReleased();
          assert.equal(stage.children.length, 0);
          assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
        },
      };
    },
  };
}

test('bird budgets fix simulation count, frame rate and rendering limits for full and light', () => {
  assert.deepEqual(birdBudget(false), { width: 24, fps: 30, maxDpr: 1.25, maxPixels: 1_800_000 });
  assert.deepEqual(birdBudget(true), { width: 16, fps: 20, maxDpr: 1, maxPixels: 700_000 });
});

for (const width of [16, 24, 32]) {
  test(`${width}×${width} bird geometry shares one centered simulation texel across nine vertices`, (t) => {
    const geometry = createBirdGeometry(width);
    t.after(() => geometry.dispose());
    assert.ok(geometry instanceof BufferGeometry);
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('birdColor');
    const reference = geometry.getAttribute('reference');
    const birdVertex = geometry.getAttribute('birdVertex');
    for (const attribute of [position, color, reference, birdVertex])
      assert.equal(attribute.count, width * width * 9);
    assert.deepEqual(
      [position.itemSize, color.itemSize, reference.itemSize, birdVertex.itemSize],
      [3, 3, 2, 1],
    );
    for (let bird = 0; bird < width * width; bird++) {
      const u = ((bird % width) + 0.5) / width;
      const v = (Math.floor(bird / width) + 0.5) / width;
      for (let vertex = 0; vertex < 9; vertex++) {
        const index = bird * 9 + vertex;
        // The 24-wide grid has non-dyadic texel centres stored in Float32 attributes.
        assert.equal(reference.getX(index), Math.fround(u));
        assert.equal(reference.getY(index), Math.fround(v));
        assert.ok(reference.getX(index) > 0 && reference.getX(index) < 1);
        assert.ok(reference.getY(index) > 0 && reference.getY(index) < 1);
        assert.equal(birdVertex.getX(index), vertex);
        for (const value of [color.getX(index), color.getY(index), color.getZ(index)])
          assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
      }
      assert.equal(position.getX(bird * 9 + 4), -6);
      assert.equal(position.getX(bird * 9 + 7), 6);
      assert.equal(position.getY(bird * 9 + 4), 0);
      assert.equal(position.getY(bird * 9 + 7), 0);
    }
    assert.match(birdVS, /birdVertex == 4\.0 \|\| birdVertex == 7\.0/);
  });

  for (const velocity of [false, true]) {
    test(`${width}×${width} ${velocity ? 'velocity' : 'position'} texture fills xyz within its range and w with one`, (t) => {
      const data = new Float32Array(width * width * 4);
      const texture = new DataTexture(data, width, width, RGBAFormat, FloatType);
      t.after(() => texture.dispose());
      let calls = 0;
      // Texture construction generates UUIDs; isolate the random sequence used by the fill.
      const random = t.mock.method(Math, 'random', () => [0, 0.5, 0.999][calls++ % 3]!);
      t.after(() => random.mock.restore());
      fillBirdTexture(texture, velocity);
      const scale = velocity ? 10 : flockBounds;
      assert.equal(calls, width * width * 3);
      for (let index = 0; index < data.length; index += 4) {
        assert.equal(data[index], -scale / 2);
        assert.equal(data[index + 1], 0);
        assert.ok(Math.abs(data[index + 2]! - 0.499 * scale) < 0.0001);
        for (let offset = 0; offset < 3; offset++)
          assert.ok(data[index + offset]! >= -scale / 2 && data[index + offset]! < scale / 2);
        assert.equal(data[index + 3], 1);
      }
    });
  }
}

test('an already aborted effect does not append a fallback or invoke the scene loader', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  instance.controller.abort();
  const created = h.document.created.length;
  await instance.mount();
  assert.equal(h.document.created.length, created);
  assert.equal(instance.loads, 0);
  assert.equal(instance.budgets.length, 0);
  assert.equal(h.observers.length, 0);
  instance.assertDetached();
});

test('reduced motion mounts only the static landscape poster, without loading a scene or scheduling RAF', async (t) => {
  const h = createHarness(t);
  const instance = h.instance({ reduced: true });
  await instance.mount();
  instance.assertStatic();
  assert.equal(instance.loads, 0);
  assert.equal(instance.budgets.length, 0);
  assert.equal(h.observers.length, 0);
  assert.equal(h.rafs.size, 0);
  instance.controller.abort();
  instance.controller.abort();
  instance.assertDetached();
  assert.equal(instance.scene.disposals, 0);
});

for (const outcome of ['resolve', 'reject'] as const) {
  test(`a scene loader that ${outcome}s after abort cannot create, append or revive an effect`, async (t) => {
    const h = createHarness(t);
    const instance = h.instance();
    const pending = deferred<Awaited<ReturnType<SceneLoader>>>();
    const mounting = instance.mount(() => pending.promise);
    instance.assertStatic();
    instance.controller.abort();
    instance.assertDetached();
    const created = h.document.created.length;
    if (outcome === 'resolve') pending.resolve(instance.module);
    else pending.reject(new Error('late load failure'));
    await mounting;
    h.visibility(false);
    h.tick(1000);
    assert.equal(h.document.created.length, created);
    assert.equal(instance.budgets.length, 0);
    assert.equal(instance.scene.disposals, 0);
    assert.equal(h.observers.length, 0);
    instance.assertDetached();
  });
}

test('a scene creation exception keeps the fallback until abort removes it', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  instance.createError = new Error('unsupported graphics');
  await instance.mount();
  assert.equal(instance.loads, 1);
  assert.equal(instance.budgets.length, 1);
  instance.assertStatic();
  instance.assertReleased();
  assert.equal(instance.scene.disposals, 0, 'a throwing factory never transfers a scene');
  instance.controller.abort();
  instance.assertDetached();
});

for (const light of [false, true]) {
  test(`${light ? 'light' : 'full'} mounting performs initial resize and draw, then uses one rate-limited RAF`, async (t) => {
    const h = createHarness(t);
    const instance = h.instance({ light });
    await instance.mount();
    assert.deepEqual(instance.budgets, [birdBudget(light)]);
    assert.deepEqual(instance.scene.resizes, [{ width: 1000, height: 600, dpr: 2 }]);
    assert.deepEqual(instance.scene.frames, [
      { time: 0, delta: 0, pointer: { x: 10000, y: 10000 } },
    ]);
    const layer = instance.stage.children[0]!;
    assert.equal(layer.dataset.state, 'live');
    assert.equal(layer.children[1], instance.scene.canvas);
    assert.equal(h.observers.length, 1);
    assert.ok(h.observers[0]!.targets.has(instance.host));
    assert.equal(h.rafs.size, 1);
    h.tick(100);
    assert.equal(instance.scene.frames.length, 2);
    h.tick(116);
    assert.equal(
      instance.scene.frames.length,
      2,
      'the refresh interval must not exceed the budget',
    );
    h.tick(light ? 150 : 134);
    assert.equal(instance.scene.frames.length, 3);
    assert.equal(h.rafs.size, 1);
    assert.equal(h.peakRafs, 1);
    instance.controller.abort();
    instance.assertDetached();
    assert.equal(instance.scene.disposals, 1);
  });
}

for (const light of [false, true]) {
  test(`${light ? 'light' : 'full'} sustained slow frames lower resolution twice without replacing the scene or RAF`, async (t) => {
    const h = createHarness(t);
    const instance = h.instance({ light });
    await instance.mount();
    for (let index = 0; index < 180; index++) h.tick(index * 100);
    assert.deepEqual(instance.scene.scales, [0.8, 0.65]);
    assert.equal(instance.loads, 1);
    assert.deepEqual(instance.budgets, [birdBudget(light)]);
    assert.equal(instance.scene.frames.length, 181);
    assert.equal(instance.scene.disposals, 0);
    assert.equal(instance.stage.children[0]!.dataset.state, 'live');
    assert.equal(instance.stage.children[0]!.children[1], instance.scene.canvas);
    assert.equal(h.observers.length, 1);
    assert.equal(h.rafs.size, 1);
    assert.equal(h.peakRafs, 1);
    instance.controller.abort();
    instance.assertDetached();
    assert.equal(instance.scene.disposals, 1);
  });

  test(`${light ? 'light' : 'full'} normal rendered cadence does not lower resolution`, async (t) => {
    const h = createHarness(t);
    const instance = h.instance({ light });
    await instance.mount();
    for (let index = 0; index < 300; index++) h.tick(index * (light ? 50 : 34));
    assert.deepEqual(instance.scene.scales, []);
    assert.equal(instance.scene.frames.length, 301);
    assert.equal(instance.loads, 1);
    assert.equal(instance.budgets.length, 1);
    assert.equal(h.peakRafs, 1);
    instance.controller.abort();
    instance.assertDetached();
  });
}

test('hidden recovery discards a nearly slow window and a large timestamp jump before warming up again', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  h.tick(0);
  let now = 0;
  for (let index = 0; index < 34; index++) h.tick((now += 100));
  assert.deepEqual(instance.scene.scales, []);
  const frames = instance.scene.frames.length;
  const elapsed = instance.scene.frames.at(-1)!.time;
  h.visibility(true);
  h.tick(600_000);
  assert.equal(instance.scene.frames.length, frames);
  assert.equal(h.rafs.size, 0);
  h.visibility(false);
  h.visibility(false);
  now = 600_000;
  h.tick(now);
  assert.equal(instance.scene.frames.at(-1)!.delta, 0);
  assert.equal(instance.scene.frames.at(-1)!.time, elapsed);
  assert.deepEqual(instance.scene.scales, []);
  for (let index = 0; index < 34; index++) h.tick((now += 100));
  assert.deepEqual(
    instance.scene.scales,
    [],
    'fifteen warmup plus nineteen measured intervals must not lower resolution',
  );
  h.tick((now += 100));
  assert.deepEqual(instance.scene.scales, [0.8]);
  assert.equal(instance.loads, 1);
  assert.equal(instance.budgets.length, 1);
  assert.equal(h.peakRafs, 1);
  instance.controller.abort();
  instance.assertDetached();
});

test('resize restarts warmup and drops a partial window without restoring the already lowered level', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  h.tick(0);
  let now = 0;
  for (let index = 0; index < 35; index++) h.tick((now += 100));
  assert.deepEqual(instance.scene.scales, [0.8]);
  for (let index = 0; index < 34; index++) h.tick((now += 100));
  assert.deepEqual(instance.scene.scales, [0.8]);
  instance.host.rect.width = 720;
  h.observers[0]!.notify();
  assert.equal(instance.scene.resizes.length, 2);
  for (let index = 0; index < 34; index++) h.tick((now += 100));
  assert.deepEqual(instance.scene.scales, [0.8]);
  h.tick((now += 100));
  assert.deepEqual(instance.scene.scales, [0.8, 0.65]);
  assert.equal(instance.loads, 1);
  assert.equal(instance.budgets.length, 1);
  assert.equal(h.peakRafs, 1);
  instance.controller.abort();
  instance.assertDetached();
});

test('a resolution callback exception restores the static poster and completely releases the scene', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  instance.scene.scaleError = new Error('resolution resize failed');
  for (let index = 0; index < 150; index++) h.tick(index * 100);
  assert.deepEqual(instance.scene.scales, [0.8]);
  assert.equal(instance.scene.disposals, 1);
  instance.assertStatic();
  instance.assertReleased();
  const frames = instance.scene.frames.length;
  h.visibility(false);
  h.tick(90_000);
  assert.equal(instance.scene.frames.length, frames);
  assert.deepEqual(instance.scene.scales, [0.8]);
  instance.controller.abort();
  instance.controller.abort();
  assert.equal(instance.scene.disposals, 1);
  instance.assertDetached();
});

test('an abort immediately before a scale decision prevents stale callbacks from lowering resolution', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  h.tick(0);
  let now = 0;
  for (let index = 0; index < 34; index++) h.tick((now += 100));
  assert.deepEqual(instance.scene.scales, []);
  const staleFrame = [...h.rafs.values()][0]!;
  const staleResize = h.observers[0]!.callback;
  const frames = instance.scene.frames.length;
  instance.controller.abort();
  staleFrame(now + 100);
  staleResize();
  h.visibility(false);
  h.tick(90_000);
  assert.deepEqual(instance.scene.scales, []);
  assert.equal(instance.scene.frames.length, frames);
  assert.equal(instance.scene.disposals, 1);
  instance.assertDetached();
});

test('repeated visible events never add scheduling chains and hidden cancels all frames', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  for (let index = 0; index < 8; index++) h.visibility(false);
  assert.equal(h.rafs.size, 1);
  h.tick(100);
  for (let index = 0; index < 8; index++) h.visibility(false);
  h.tick(140);
  assert.equal(h.peakRafs, 1);
  const count = instance.scene.frames.length;
  h.visibility(true);
  h.visibility(true);
  assert.equal(h.rafs.size, 0);
  assert.equal(instance.stage.children[0]!.dataset.paused, 'true');
  h.tick(600_000);
  assert.equal(instance.scene.frames.length, count);
  h.visibility(false);
  h.visibility(false);
  assert.equal(h.rafs.size, 1);
  h.tick(600_000);
  const resumed = instance.scene.frames.at(-1)!;
  assert.equal(resumed.delta, 0);
  assert.equal(resumed.time, instance.scene.frames[count - 1]!.time);
  h.tick(900_000);
  assert.equal(instance.scene.frames.at(-1)!.delta, 0.05);
  assert.ok(instance.scene.frames.every(({ delta }) => delta >= 0 && delta <= 0.05));
  assert.equal(h.peakRafs, 1);
  instance.controller.abort();
  instance.assertDetached();
});

test('an initially hidden document does not schedule RAF and resumes without a permanent hold', async (t) => {
  const h = createHarness(t, true);
  const instance = h.instance();
  await instance.mount();
  assert.equal(h.rafs.size, 0);
  assert.equal(instance.scene.frames.length, 1, 'only the synchronous validation draw ran');
  h.visibility(false);
  h.visibility(false);
  assert.equal(h.rafs.size, 1);
  h.tick(600_000);
  assert.equal(instance.scene.frames.at(-1)!.delta, 0);
  assert.equal(h.peakRafs, 1);
});

test('host resize observations use the current host dimensions and device pixel ratio', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  instance.host.rect = { left: 120, top: 10, width: 390, height: 720 };
  h.window.devicePixelRatio = 1.25;
  h.observers[0]!.notify();
  assert.deepEqual(instance.scene.resizes.at(-1), { width: 390, height: 720, dpr: 1.25 });
  instance.controller.abort();
  const count = instance.scene.resizes.length;
  h.observers[0]!.notify();
  assert.equal(instance.scene.resizes.length, count);
  instance.assertDetached();
});

test('mouse coordinates normalize relative to the host, touch is ignored and leaving clears them', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  instance.pointer('mouse', 830, 200);
  h.tick(100);
  assert.deepEqual(instance.scene.frames.at(-1)!.pointer, { x: 0.25, y: 0.25 });
  instance.pointer('touch', 80, 650);
  h.tick(140);
  assert.deepEqual(instance.scene.frames.at(-1)!.pointer, { x: 0.25, y: 0.25 });
  instance.host.dispatchEvent(new Event('pointerleave'));
  h.tick(180);
  assert.deepEqual(instance.scene.frames.at(-1)!.pointer, { x: 10000, y: 10000 });
});

test('context loss prevents default, releases the scene once and keeps static content until abort', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  const loss = new Event('webglcontextlost', { cancelable: true });
  instance.scene.canvas.dispatchEvent(loss);
  assert.equal(loss.defaultPrevented, true);
  assert.equal(instance.scene.disposals, 1);
  instance.assertStatic();
  instance.assertReleased();
  const count = instance.scene.frames.length;
  instance.scene.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  h.visibility(false);
  h.tick(1000);
  assert.equal(instance.scene.frames.length, count);
  instance.controller.abort();
  instance.controller.abort();
  assert.equal(instance.scene.disposals, 1);
  instance.assertDetached();
});

for (const operation of ['frame', 'resize'] as const) {
  for (const initial of [true, false]) {
    test(`${initial ? 'initial' : 'later'} ${operation} exceptions release the scene and restore static content`, async (t) => {
      const h = createHarness(t);
      const instance = h.instance();
      const failure = new Error(`${operation} failure`);
      if (initial) instance.scene[`${operation}Error`] = failure;
      await instance.mount();
      if (!initial) {
        instance.scene[`${operation}Error`] = failure;
        if (operation === 'frame') h.tick(100);
        else h.observers[0]!.notify();
      }
      assert.equal(instance.scene.disposals, 1);
      instance.assertStatic();
      instance.assertReleased();
      instance.controller.abort();
      instance.controller.abort();
      assert.equal(instance.scene.disposals, 1);
      instance.assertDetached();
    });
  }
}

test('normal double abort disposes once and stale frame or observer callbacks cannot revive the effect', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  const staleFrame = [...h.rafs.values()][0]!;
  const staleResize = h.observers[0]!.callback;
  instance.controller.abort();
  instance.controller.abort();
  instance.assertDetached();
  assert.equal(instance.scene.disposals, 1);
  const frames = instance.scene.frames.length;
  const resizes = instance.scene.resizes.length;
  staleFrame(1000);
  staleResize();
  h.visibility(false);
  instance.pointer('mouse', 100, 200);
  assert.equal(instance.scene.frames.length, frames);
  assert.equal(instance.scene.resizes.length, resizes);
  assert.equal(instance.scene.disposals, 1);
  instance.assertDetached();
});

test('rapid mount and abort cycles leave no listeners, observers, canvas or stale scheduling chain', async (t) => {
  const h = createHarness(t);
  const instances = [];
  for (let index = 0; index < 12; index++) {
    const instance = h.instance({ light: index % 2 === 0 });
    instances.push(instance);
    await instance.mount();
    assert.equal(h.rafs.size, 1);
    h.tick(index * 100);
    instance.controller.abort();
    instance.assertDetached();
    assert.equal(instance.scene.disposals, 1);
  }
  h.visibility(false);
  h.tick(900_000);
  assert.equal(h.peakRafs, 1);
  for (const instance of instances) instance.assertDetached();
});
