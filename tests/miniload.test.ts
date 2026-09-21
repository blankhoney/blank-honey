import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import test, { type TestContext } from 'node:test';
import mountPixelCloud, { pixelCloudBudget } from '../src/client/effects/miniload';
import type { HeroContext } from '../src/client/hero';
import type { PixelCloudBudget, PixelCloudScene } from '../src/client/pixel-cloud';

type SceneLoader = NonNullable<Parameters<typeof mountPixelCloud>[1]>;

class ClassListStub {
  readonly names = new Set<string>();
  add(...names: string[]) {
    for (const name of names) this.names.add(name);
  }
  remove(...names: string[]) {
    for (const name of names) this.names.delete(name);
  }
  contains(name: string) {
    return this.names.has(name);
  }
}

class ElementStub extends EventTarget {
  className = '';
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly classList = new ClassListStub();
  readonly style: Record<string, string> = {};
  readonly children: ElementStub[] = [];
  parent: ElementStub | undefined;
  rect = { left: 0, top: 0, width: 1000, height: 600 };

  constructor(readonly tagName = 'DIV') {
    super();
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  append(...elements: ElementStub[]) {
    for (const element of elements) {
      element.remove();
      element.parent = this;
      this.children.push(element);
    }
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
    assert.equal(tag, 'div');
    const element = new ElementStub();
    this.created.push(element);
    return element;
  }
}

/**
 * A CPU side stand in for the real Paper backed scene: it owns the canvas it inserts into the
 * container it is created with, exactly like the surface based factory does.
 */
class SceneStub {
  readonly canvas = new ElementStub('CANVAS');
  readonly frames: number[] = [];
  readonly resizes: Array<{ width: number; height: number; scale: number }> = [];
  disposals = 0;
  frameError: Error | undefined;
  resizeError: Error | undefined;

  get scales() {
    return this.resizes.map((resize) => resize.scale);
  }
  frame(seconds: number) {
    this.frames.push(seconds);
    if (this.frameError) throw this.frameError;
  }
  resize(width: number, height: number, scale: number) {
    this.resizes.push({ width, height, scale });
    if (this.resizeError) throw this.resizeError;
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

function createHarness(t: TestContext, options: { hidden?: boolean; intersection?: boolean } = {}) {
  const names = [
    'document',
    'window',
    'location',
    'fetch',
    'console',
    'ResizeObserver',
    'IntersectionObserver',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ];
  const saved = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const document = new DocumentStub();
  document.hidden = options.hidden ?? false;
  const window = Object.assign(new EventTarget(), { devicePixelRatio: 2 });
  const rafs = new Map<number, FrameRequestCallback>();
  const controllers: AbortController[] = [];
  const observers: ResizeObserverStub[] = [];
  const intersections: IntersectionObserverStub[] = [];
  const errors: string[] = [];
  const posts: Array<Record<string, unknown>> = [];
  let nextRaf = 0;
  let peakRafs = 0;

  class ResizeObserverStub {
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

  class IntersectionObserverStub {
    readonly targets = new Set<ElementStub>();
    constructor(readonly callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
      intersections.push(this);
    }
    observe(target: ElementStub) {
      this.targets.add(target);
    }
    disconnect() {
      this.targets.clear();
    }
    notify(entries: Array<{ isIntersecting: boolean }>) {
      if (this.targets.size) this.callback(entries);
    }
  }

  const globals: Record<string, unknown> = {
    document,
    window,
    location: { pathname: '/' },
    console: { error: (...args: unknown[]) => errors.push(String(args[0])) },
    fetch: async (_url: string, init?: { body?: string }) => {
      posts.push(JSON.parse(init?.body ?? '{}'));
      return { ok: true };
    },
    ResizeObserver: ResizeObserverStub,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      const id = ++nextRaf;
      rafs.set(id, callback);
      peakRafs = Math.max(peakRafs, rafs.size);
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      rafs.delete(id);
    },
  };
  globals.IntersectionObserver =
    (options.intersection ?? true) ? IntersectionObserverStub : undefined;
  for (const [name, value] of Object.entries(globals))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });

  t.after(() => {
    try {
      for (const controller of controllers) controller.abort();
    } finally {
      rafs.clear();
      for (const observer of [...observers, ...intersections]) observer.disconnect();
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
    intersections,
    errors,
    posts,
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
      const budgets: PixelCloudBudget[] = [];
      const containers: ElementStub[] = [];
      let loads = 0;
      let createError: Error | undefined;
      const module = {
        createPixelCloudScene(container: HTMLElement, budget: PixelCloudBudget) {
          budgets.push({ ...budget });
          containers.push(container as unknown as ElementStub);
          if (createError) throw createError;
          container.append(scene.canvas as unknown as HTMLElement);
          return scene as unknown as PixelCloudScene;
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
        containers,
        module,
        get loads() {
          return loads;
        },
        set createError(error: Error) {
          createError = error;
        },
        mount(load: SceneLoader = loader) {
          return mountPixelCloud(
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
          assert.equal(layer.className, 'pixel-cloud-layer');
          assert.equal(layer.dataset.state, 'static');
          assert.equal(layer.attributes.get('aria-hidden'), 'true');
          assert.deepEqual(
            layer.children.map((child) => child.className),
            ['pixel-cloud-still', 'pixel-cloud-shadow'],
          );
          assert.equal(layer.children[0]!.children.length, 0);
        },
        assertReleased() {
          assert.equal(scene.canvas.parent, undefined);
          assert.equal(rafs.size, 0);
          assert.equal(getEventListeners(host, 'pointermove').length, 0);
          assert.equal(getEventListeners(host, 'pointerleave').length, 0);
          assert.equal(getEventListeners(window, 'blur').length, 0);
          assert.equal(getEventListeners(scene.canvas, 'webglcontextlost').length, 0);
          assert.equal(getEventListeners(document, 'visibilitychange').length, 0);
          assert.ok(observers.every((observer) => observer.targets.size === 0));
          assert.ok(intersections.every((observer) => observer.targets.size === 0));
        },
        assertDetached() {
          this.assertReleased();
          assert.equal(stage.children.length, 0);
          assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
        },
        get shadow() {
          return stage.children[0]?.children[1];
        },
        get state() {
          return stage.children[0]?.dataset.state;
        },
        get paused() {
          return stage.children[0]?.dataset.paused;
        },
      };
    },
  };
}

test('cloud budgets fix frame rate, pixel ceiling and glyph size for full and light', () => {
  assert.deepEqual(pixelCloudBudget(false), {
    light: false,
    fps: 30,
    maxPixels: 900_000,
    pixelSize: 2.4,
  });
  assert.deepEqual(pixelCloudBudget(true), {
    light: true,
    fps: 20,
    maxPixels: 320_000,
    pixelSize: 3,
  });
});

test('an already aborted effect does not append a fallback or invoke the scene loader', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  instance.controller.abort();
  await instance.mount();
  assert.equal(h.document.created.length, 0);
  assert.equal(instance.stage.children.length, 0);
  assert.equal(instance.loads, 0);
  assert.equal(instance.budgets.length, 0);
  assert.equal(h.observers.length, 0);
  assert.equal(h.rafs.size, 0);
  assert.equal(instance.scene.disposals, 0);
  instance.assertDetached();
});

test('reduced motion keeps only the static poster and never loads or schedules a scene', async (t) => {
  const h = createHarness(t);
  const instance = h.instance({ reduced: true });
  await instance.mount();
  instance.assertStatic();
  assert.equal(instance.loads, 0);
  assert.equal(instance.budgets.length, 0);
  assert.equal(h.observers.length, 0);
  assert.equal(h.intersections.length, 0);
  assert.equal(h.rafs.size, 0);
  // The pointer driven shadow belongs to the poster, not to the shader, so it still follows.
  instance.stage.rect = { left: 0, top: 0, width: 100, height: 100 };
  instance.pointer('mouse', 10, 20);
  assert.equal(instance.shadow!.classList.contains('visible'), true);
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
    assert.equal(h.rafs.size, 0);
    instance.controller.abort();
    instance.assertDetached();
    const created = h.document.created.length;
    if (outcome === 'resolve') pending.resolve(instance.module);
    else pending.reject(new Error('late load failure'));
    await mounting;
    h.visibility(false);
    h.tick(1000);
    assert.equal(h.document.created.length, created);
    assert.equal(instance.loads, 0, 'the injected deferred loader bypasses the default loader');
    assert.equal(instance.budgets.length, 0);
    assert.equal(instance.containers.length, 0);
    assert.equal(instance.scene.disposals, 0);
    assert.equal(h.observers.length, 0);
    assert.deepEqual(h.posts, [], 'an aborted mount must not report its late failure');
    instance.assertDetached();
  });
}

for (const light of [false, true]) {
  test(`${light ? 'light' : 'full'} mounting resizes, draws once and then runs a single throttled RAF`, async (t) => {
    const h = createHarness(t);
    const instance = h.instance({ light });
    await instance.mount();
    assert.deepEqual(instance.budgets, [pixelCloudBudget(light)]);
    assert.deepEqual(instance.containers, [instance.stage.children[0]]);
    assert.deepEqual(instance.scene.resizes, [{ width: 1000, height: 600, scale: 1 }]);
    assert.deepEqual(instance.scene.frames, [0], 'mounting draws once at zero seconds');
    assert.equal(instance.state, 'live');
    assert.equal(instance.stage.children[0]!.children[2], instance.scene.canvas);
    assert.equal(h.observers.length, 1);
    assert.ok(h.observers[0]!.targets.has(instance.host));
    assert.equal(h.intersections.length, 1);
    assert.equal(h.rafs.size, 1);
    h.tick(100);
    assert.deepEqual(instance.scene.frames, [0, 0]);
    h.tick(116);
    assert.equal(
      instance.scene.frames.length,
      2,
      'the refresh interval must not exceed the budget',
    );
    h.tick(light ? 150 : 134);
    assert.equal(instance.scene.frames.length, 3);
    assert.equal(instance.scene.frames.at(-1), (light ? 50 : 34) / 1000);
    assert.ok(instance.scene.frames.every((seconds) => seconds >= 0 && seconds < 1));
    assert.deepEqual(instance.scene.scales, [1], 'a healthy cadence never lowers resolution');
    assert.equal(h.rafs.size, 1);
    assert.equal(h.peakRafs, 1);
    instance.controller.abort();
    instance.assertDetached();
    assert.equal(instance.scene.disposals, 1);
    assert.deepEqual(h.errors, []);
  });

  test(`${light ? 'light' : 'full'} sustained slow frames resize twice without rebuilding the scene or RAF`, async (t) => {
    const h = createHarness(t);
    const instance = h.instance({ light });
    await instance.mount();
    instance.host.rect = { left: 0, top: 0, width: 720, height: 480 };
    h.observers[0]!.notify();
    assert.deepEqual(instance.scene.resizes.at(-1), { width: 720, height: 480, scale: 1 });
    let now = 0;
    for (let index = 0; index < 180; index++) h.tick((now += 100));
    assert.deepEqual(instance.scene.scales, [1, 1, 0.8, 0.65]);
    assert.deepEqual(instance.scene.resizes.slice(-2), [
      { width: 720, height: 480, scale: 0.8 },
      { width: 720, height: 480, scale: 0.65 },
    ]);
    assert.equal(instance.loads, 1);
    assert.deepEqual(instance.budgets, [pixelCloudBudget(light)]);
    assert.equal(instance.scene.frames.length, 181);
    assert.equal(instance.scene.disposals, 0);
    assert.equal(instance.state, 'live');
    assert.equal(instance.stage.children[0]!.children[2], instance.scene.canvas);
    assert.equal(h.observers.length, 1);
    assert.equal(h.rafs.size, 1);
    assert.equal(h.peakRafs, 1);
    instance.controller.abort();
    instance.assertDetached();
    assert.equal(instance.scene.disposals, 1);
  });

  test(`${light ? 'light' : 'full'} rendered cadence at the budget does not lower resolution`, async (t) => {
    const h = createHarness(t);
    const instance = h.instance({ light });
    await instance.mount();
    for (let index = 0; index < 300; index++) h.tick(index * (light ? 50 : 34));
    assert.deepEqual(instance.scene.scales, [1]);
    assert.equal(instance.scene.frames.length, 301);
    assert.equal(instance.loads, 1);
    assert.equal(instance.budgets.length, 1);
    assert.equal(h.peakRafs, 1);
    instance.controller.abort();
    instance.assertDetached();
  });
}

test('hidden and out of view pauses the clock and resumes without replaying background time', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  h.tick(100);
  h.tick(200);
  assert.deepEqual(instance.scene.frames, [0, 0, 0.1]);
  h.visibility(true);
  assert.equal(h.rafs.size, 0);
  assert.equal(instance.paused, 'true');
  h.tick(900_000);
  assert.deepEqual(instance.scene.frames, [0, 0, 0.1], 'a hidden page runs no frames');
  h.intersections[0]!.notify([{ isIntersecting: false }]);
  assert.equal(instance.paused, 'true');
  h.visibility(false);
  h.visibility(false);
  h.visibility(false);
  assert.equal(h.rafs.size, 0, 'a visible page off screen must stay suspended');
  h.intersections[0]!.notify([{ isIntersecting: true }]);
  assert.equal(instance.paused, 'false');
  assert.equal(h.rafs.size, 1);
  h.tick(1_200_000);
  assert.deepEqual(instance.scene.frames, [0, 0, 0.1, 0.1], 'background time is not compensated');
  for (let index = 0; index < 8; index++) h.visibility(false);
  assert.equal(h.rafs.size, 1, 'repeated visible events must not add scheduling chains');
  h.tick(1_200_100);
  assert.equal(instance.scene.frames.at(-1), 0.2);
  assert.equal(h.peakRafs, 1);
  instance.controller.abort();
  instance.assertDetached();
});

test('an initially hidden document paints one frame, schedules nothing and later resumes', async (t) => {
  const h = createHarness(t, { hidden: true });
  const instance = h.instance();
  await instance.mount();
  assert.deepEqual(instance.scene.frames, [0], 'only the synchronous validation frame ran');
  assert.equal(h.rafs.size, 0);
  assert.equal(instance.paused, 'true');
  assert.equal(instance.state, 'live');
  h.visibility(false);
  h.visibility(false);
  assert.equal(h.rafs.size, 1);
  h.tick(600_000);
  assert.deepEqual(instance.scene.frames, [0, 0]);
  instance.controller.abort();
  instance.assertDetached();
});

test('without IntersectionObserver only document visibility drives the clock', async (t) => {
  const h = createHarness(t, { intersection: false });
  const instance = h.instance();
  await instance.mount();
  assert.equal(h.intersections.length, 0);
  assert.equal(h.rafs.size, 1);
  assert.equal(instance.paused, 'false');
  h.visibility(true);
  assert.equal(h.rafs.size, 0);
  assert.equal(instance.paused, 'true');
  h.visibility(false);
  assert.equal(h.rafs.size, 1);
  assert.equal(instance.paused, 'false');
  instance.controller.abort();
  instance.assertDetached();
});

test('the black shadow follows a mouse, ignores touch and is hidden by leaving or blurring', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  const layer = instance.stage.children[0]!;
  const fallback = layer.children[0]!;
  const shadow = instance.shadow!;
  instance.stage.rect = { left: 120, top: 40, width: 1000, height: 600 };
  instance.pointer('mouse', 620, 240);
  assert.equal(shadow.style.transform, 'translate3d(500px, 200px, 0) translate(-50%, -50%)');
  assert.equal(shadow.classList.contains('visible'), true);
  assert.deepEqual(layer.style, {}, 'the pointer must not move the poster itself');
  assert.deepEqual(fallback.style, {});
  instance.pointer('touch', 120, 40);
  assert.equal(shadow.style.transform, 'translate3d(500px, 200px, 0) translate(-50%, -50%)');
  assert.equal(shadow.classList.contains('visible'), true);
  instance.host.dispatchEvent(new Event('pointerleave'));
  assert.equal(shadow.classList.contains('visible'), false);
  instance.pointer('mouse', 120, 40);
  assert.equal(shadow.style.transform, 'translate3d(0px, 0px, 0) translate(-50%, -50%)');
  assert.equal(shadow.classList.contains('visible'), true);
  h.window.dispatchEvent(new Event('blur'));
  assert.equal(shadow.classList.contains('visible'), false);
  instance.controller.abort();
  instance.assertDetached();
  assert.deepEqual(h.errors, []);
});

test('abort releases listeners, observers, the scene, the layer and every pending frame', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  h.tick(100);
  const staleFrame = [...h.rafs.values()][0]!;
  const staleResize = h.observers[0]!.callback;
  const staleIntersection = h.intersections[0]!;
  instance.controller.abort();
  instance.controller.abort();
  instance.assertDetached();
  assert.equal(instance.scene.disposals, 1);
  const frames = instance.scene.frames.length;
  const resizes = instance.scene.resizes.length;
  staleFrame(90_000);
  staleResize();
  staleIntersection.notify([{ isIntersecting: false }]);
  h.visibility(false);
  instance.pointer('mouse', 100, 200);
  assert.equal(instance.scene.frames.length, frames);
  assert.equal(instance.scene.resizes.length, resizes);
  assert.equal(instance.scene.disposals, 1);
  assert.equal(h.rafs.size, 0);
  instance.assertDetached();
});

test('a throwing scene factory leaves the static poster and no scheduling chain', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  instance.createError = new Error('unsupported graphics');
  await instance.mount();
  assert.equal(instance.loads, 1);
  assert.equal(instance.budgets.length, 1);
  assert.equal(instance.containers[0], instance.stage.children[0]);
  instance.assertStatic();
  instance.assertReleased();
  assert.equal(instance.scene.disposals, 0, 'a throwing factory never transfers a scene');
  assert.deepEqual(h.posts, [{ kind: 'pixel-cloud', code: 'Error', path: '/' }]);
  assert.deepEqual(h.errors, []);
  instance.controller.abort();
  instance.assertDetached();
});

for (const operation of ['frame', 'resize'] as const) {
  for (const initial of [true, false]) {
    test(`${initial ? 'an initial' : 'a later'} ${operation} failure restores the static poster and releases everything`, async (t) => {
      const h = createHarness(t);
      const instance = h.instance();
      if (initial) instance.scene[`${operation}Error`] = new Error(`${operation} failure`);
      await instance.mount();
      if (!initial) {
        instance.scene[`${operation}Error`] = new Error(`${operation} failure`);
        if (operation === 'frame') h.tick(100);
        else h.observers[0]!.notify();
      }
      assert.equal(instance.scene.disposals, 1);
      assert.equal(instance.state, 'static');
      instance.assertReleased();
      assert.equal(h.document.created.length, 3, 'the layer keeps its still and shadow only');
      assert.deepEqual(h.posts, [{ kind: 'pixel-cloud', code: 'Error', path: '/' }]);
      assert.deepEqual(h.errors, []);
      const frames = instance.scene.frames.length;
      h.visibility(false);
      h.tick(90_000);
      assert.equal(instance.scene.frames.length, frames);
      instance.controller.abort();
      instance.controller.abort();
      assert.equal(instance.scene.disposals, 1);
      instance.assertDetached();
    });
  }
}

test('context loss prevents default, falls back to the static poster and releases the scene once', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount();
  const loss = new Event('webglcontextlost', { cancelable: true });
  instance.scene.canvas.dispatchEvent(loss);
  assert.equal(loss.defaultPrevented, true);
  assert.equal(instance.scene.disposals, 1);
  assert.equal(instance.state, 'static');
  instance.assertReleased();
  assert.deepEqual(h.posts, [{ kind: 'pixel-cloud', code: 'Error', path: '/' }]);
  const frames = instance.scene.frames.length;
  instance.scene.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  h.visibility(false);
  h.tick(1000);
  assert.equal(instance.scene.frames.length, frames);
  assert.equal(instance.scene.disposals, 1);
  instance.controller.abort();
  instance.controller.abort();
  assert.equal(instance.scene.disposals, 1);
  instance.assertDetached();
});

test('abort during scene creation immediately disposes the returned scene without drawing', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount(async () => ({
    createPixelCloudScene(container, budget) {
      const scene = instance.module.createPixelCloudScene(container, budget);
      instance.controller.abort();
      return scene;
    },
  }));
  assert.equal(instance.scene.disposals, 1);
  assert.deepEqual(instance.scene.frames, []);
  assert.deepEqual(instance.scene.resizes, []);
  assert.equal(h.observers.length, 0);
  assert.equal(h.intersections.length, 0);
  instance.assertDetached();
});

test('an active loader rejection keeps the poster and releases effect listeners', async (t) => {
  const h = createHarness(t);
  const instance = h.instance();
  await instance.mount(async () => {
    throw new Error('module failed');
  });
  instance.assertStatic();
  instance.assertReleased();
  assert.equal(instance.budgets.length, 0);
  assert.deepEqual(h.posts, [{ kind: 'pixel-cloud', code: 'Error', path: '/' }]);
  instance.controller.abort();
  instance.assertDetached();
});

for (const reset of ['resize', 'hidden', 'intersection'] as const) {
  test(`${reset} restarts slow-frame warmup without raising an existing resolution tier`, async (t) => {
    const h = createHarness(t);
    const instance = h.instance();
    await instance.mount();
    let now = 0;
    h.tick(now);
    for (let index = 0; index < 34; index++) h.tick((now += 100));
    assert.deepEqual(instance.scene.scales, [1], 'the old slow window is one sample short');
    if (reset === 'resize') {
      h.observers[0]!.notify();
    } else if (reset === 'hidden') {
      h.visibility(true);
      h.visibility(false);
      h.tick((now += 900_000));
    } else {
      h.intersections[0]!.notify([{ isIntersecting: false }]);
      h.intersections[0]!.notify([{ isIntersecting: true }]);
      h.tick((now += 900_000));
    }
    for (let index = 0; index < 15; index++) h.tick((now += 100));
    assert.ok(
      instance.scene.scales.every((scale) => scale === 1),
      'warmup cannot downgrade',
    );
    for (let index = 0; index < 19; index++) h.tick((now += 100));
    assert.ok(
      instance.scene.scales.every((scale) => scale === 1),
      'the new window starts empty',
    );
    h.tick((now += 100));
    assert.equal(instance.scene.scales.at(-1), 0.8);
    h.observers[0]!.notify();
    assert.equal(instance.scene.scales.at(-1), 0.8, 'resize retains the downgraded tier');
    for (let index = 0; index < 100; index++) h.tick((now += 34));
    assert.equal(new Set<number>(instance.scene.scales).has(0.65), false);
    assert.equal(instance.loads, 1);
    assert.equal(h.peakRafs, 1);
    instance.controller.abort();
    instance.assertDetached();
  });
}

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
