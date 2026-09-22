import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import test, { type TestContext } from 'node:test';
import { algorithmBudget, mountAlgorithm } from '../src/client/algorithm-hero';
import type {
  AlgorithmBudget,
  AlgorithmFactory,
  AlgorithmId,
  AlgorithmPointer,
  AlgorithmScene,
} from '../src/client/algorithms/types';
import type { HeroContext } from '../src/client/hero';

type Loader = Parameters<typeof mountAlgorithm>[2];
type Listener = (event: EventStub) => void;

class EventStub {
  pointerType = 'mouse';
  clientX = 0;
  clientY = 0;
  timeStamp = 0;
  isIntersecting = true;
  defaultPrevented = false;
  target: unknown;
  constructor(
    readonly type: string,
    init: Partial<EventStub> = {},
  ) {
    Object.assign(this, init);
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
}

/** A DOM node with bubbling dispatch and AbortSignal aware listener removal. */
class NodeStub {
  readonly listeners = new Map<string, Set<Listener>>();
  parent: NodeStub | undefined;

  addEventListener(type: string, listener: Listener, options?: { signal?: AbortSignal }) {
    const signal = options?.signal;
    if (signal?.aborted) return;
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
    signal?.addEventListener(
      'abort',
      () => {
        set.delete(listener);
      },
      { once: true },
    );
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  count(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }

  get listenerCount() {
    let total = 0;
    for (const set of this.listeners.values()) total += set.size;
    return total;
  }

  dispatchEvent(event: EventStub) {
    event.target ??= this;
    let node: NodeStub | undefined = this;
    while (node) {
      for (const listener of [...(node.listeners.get(event.type) ?? [])]) listener(event);
      node = node.parent;
    }
    return !event.defaultPrevented;
  }
}

class ElementStub extends NodeStub {
  readonly children: ElementStub[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  className = '';
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
    const owner = this.parent as ElementStub | undefined;
    if (!owner) return;
    const index = owner.children.indexOf(this);
    if (index >= 0) owner.children.splice(index, 1);
    this.parent = undefined;
  }
  matches(selector: string) {
    return selector.split(',').some((part) => {
      const rule = part.trim();
      if (rule.startsWith('[') && rule.endsWith(']'))
        return this.attributes.has(rule.slice(1, -1).split('=')[0]!);
      return this.tagName.toLowerCase() === rule.toLowerCase();
    });
  }
  getBoundingClientRect() {
    return this.rect;
  }
  get parentElement() {
    return this.parent;
  }
}

class DocumentStub extends NodeStub {
  hidden = false;
  readonly body = new ElementStub('BODY');
  createElement(tag: string) {
    return new ElementStub(tag.toUpperCase());
  }
}

class WindowStub extends NodeStub {
  devicePixelRatio = 2;
}

/** A CPU stand in for a real scene: it owns the canvas it mounts in the container it is given. */
class SceneStub {
  readonly canvas = new ElementStub('CANVAS');
  readonly frames: Array<{ seconds: number; delta: number; pointer: AlgorithmPointer }> = [];
  readonly resizes: Array<{ width: number; height: number; scale: number }> = [];
  disposals = 0;
  disposeError: Error | undefined;
  frameError: Error | undefined;
  frameErrorAt: number | undefined;

  get scales() {
    return this.resizes.map((resize) => resize.scale);
  }
  frame(seconds: number, delta: number, pointer: AlgorithmPointer) {
    this.frames.push({ seconds, delta, pointer: { ...pointer } });
    if (this.frameError && this.frames.length === this.frameErrorAt) throw this.frameError;
  }
  resize(width: number, height: number, scale: number) {
    this.resizes.push({ width, height, scale });
  }
  dispose() {
    // Deliberately counted every time; the runtime must not release its scene twice.
    this.disposals++;
    this.canvas.remove();
    if (this.disposeError) throw this.disposeError;
  }
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function createHarness(t: TestContext) {
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
  const window = new WindowStub();
  const rafs = new Map<number, FrameRequestCallback>();
  const controllers: AbortController[] = [];
  const observers: ResizeObserverStub[] = [];
  const intersections: IntersectionObserverStub[] = [];
  const posts: Array<Record<string, unknown>> = [];
  let nextRaf = 0;

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
    location: { pathname: '/qa' },
    console: { error: () => {} },
    fetch: async (_url: string, init?: { body?: string }) => {
      posts.push(JSON.parse(init?.body ?? '{}'));
      return { ok: true };
    },
    ResizeObserver: ResizeObserverStub,
    IntersectionObserver: IntersectionObserverStub,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      const id = ++nextRaf;
      rafs.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      rafs.delete(id);
    },
  };
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

  function instance(options: { id?: AlgorithmId; light?: boolean; reduced?: boolean } = {}) {
    const host = new ElementStub('SECTION');
    const stage = new ElementStub('DIV');
    host.append(stage);
    document.body.append(host);
    const controller = new AbortController();
    controllers.push(controller);
    const scene = new SceneStub();
    const calls: Array<{ container: ElementStub; budget: AlgorithmBudget; signal: AbortSignal }> =
      [];
    let loads = 0;
    let loadError: Error | undefined;
    let createError: Error | undefined;
    let stateAtCreation: string | undefined;
    let deferred: { promise: Promise<AlgorithmScene>; container: ElementStub } | undefined;

    const factory: AlgorithmFactory = (container, budget, signal) => {
      const target = container as unknown as ElementStub;
      stateAtCreation = target.dataset.state;
      calls.push({ container: target, budget: { ...budget }, signal });
      if (createError) throw createError;
      if (deferred) {
        deferred.container = target;
        return deferred.promise;
      }
      target.append(scene.canvas);
      return scene as unknown as AlgorithmScene;
    };
    const loader: Loader = async () => {
      loads++;
      if (loadError) throw loadError;
      return { createScene: factory };
    };

    return {
      host,
      stage,
      controller,
      scene,
      calls,
      get loads() {
        return loads;
      },
      get stateAtCreation() {
        return stateAtCreation;
      },
      set loadError(error: Error) {
        loadError = error;
      },
      set createError(error: Error) {
        createError = error;
      },
      get layer() {
        return stage.children[0];
      },
      get state() {
        return stage.children[0]?.dataset.state;
      },
      get paused() {
        return stage.children[0]?.dataset.paused;
      },
      get still() {
        return stage.children[0]?.children[0];
      },
      mount() {
        return mountAlgorithm(
          {
            host,
            stage,
            signal: controller.signal,
            reduced: options.reduced ?? false,
            light: options.light ?? false,
          } as unknown as HeroContext,
          options.id ?? 'blackhole',
          loader,
        );
      },
      defer() {
        let resolve!: (value: AlgorithmScene) => void;
        const promise = new Promise<AlgorithmScene>((done) => {
          resolve = done;
        });
        deferred = { promise, container: stage };
        return () => {
          deferred?.container.append(scene.canvas);
          resolve(scene as unknown as AlgorithmScene);
        };
      },
      pointer(
        type: 'pointermove' | 'pointerdown' | 'pointerup' | 'pointercancel' | 'pointerleave',
        init: Partial<EventStub> = {},
        target: ElementStub = host,
      ) {
        target.dispatchEvent(new EventStub(type, init));
      },
      assertDetached() {
        assert.equal(stage.children.length, 0, 'the layer is removed with the effect');
        assert.equal(scene.canvas.parent, undefined);
        assert.equal(rafs.size, 0, 'no frame stays queued');
        assert.equal(host.listenerCount, 0, 'the host keeps no pointer listener');
        assert.equal(window.count('blur'), 0);
        assert.equal(document.count('visibilitychange'), 0);
        assert.ok(
          observers.every((observer) => observer.targets.size === 0),
          'the resize observer is disconnected',
        );
        assert.ok(
          intersections.every((observer) => observer.targets.size === 0),
          'the intersection observer is disconnected',
        );
        assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
      },
    };
  }

  return {
    document,
    window,
    observers,
    intersections,
    posts,
    get rafs() {
      return rafs;
    },
    instance,
    tick(time: number) {
      for (const [id, callback] of [...rafs]) {
        if (!rafs.delete(id)) continue;
        callback(time);
      }
    },
    visibility(nextHidden: boolean) {
      document.hidden = nextHidden;
      document.dispatchEvent(new EventStub('visibilitychange'));
    },
  };
}

/* ---------- budgets ---------------------------------------------------- */

test('every algorithm gets the planned frame rate, DPR cap and pixel ceiling', () => {
  const ceilings: Array<[AlgorithmId, { full: number; light: number }]> = [
    ['blackhole', { full: 900_000, light: 300_000 }],
    ['ocean', { full: 1_200_000, light: 400_000 }],
    ['mandelbulb', { full: 360_000, light: 160_000 }],
    ['reaction', { full: 1_200_000, light: 450_000 }],
    ['terrain', { full: 1_200_000, light: 450_000 }],
  ];
  for (const [id, ceiling] of ceilings) {
    assert.deepEqual(algorithmBudget(id, false), {
      light: false,
      fps: 30,
      maxPixels: ceiling.full,
      maxDpr: 1.5,
    });
    assert.deepEqual(algorithmBudget(id, true), {
      light: true,
      fps: 20,
      maxPixels: ceiling.light,
      maxDpr: 1,
    });
    assert.ok(ceiling.light < ceiling.full, `${id} must downshift pixels on light devices`);
  }
});

/* ---------- layer and first frame -------------------------------------- */

test('the still shows first and the canvas is revealed only after the first drawn frame', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'blackhole' });
  assert.equal(qa.loads, 0, 'the module is imported per mount, not at page load');
  const mounted = qa.mount();
  assert.equal(qa.loads, 1);
  // The static layer is already in the stage while the module import is still pending.
  assert.equal(qa.layer?.className, 'algorithm-layer');
  assert.equal(qa.state, 'static');
  assert.equal(qa.layer?.attributes.get('aria-hidden'), 'true');
  assert.deepEqual(
    qa.layer?.children.map((child) => child.className),
    ['algorithm-still'],
  );
  assert.equal(qa.still?.attributes.get('aria-hidden'), 'true');
  assert.equal(qa.calls.length, 0, 'no scene exists before the module resolves');
  await mounted;
  assert.equal(qa.stateAtCreation, 'static', 'the scene is built behind the still');
  assert.equal(qa.state, 'live');
  assert.equal(qa.calls.length, 1);
  assert.equal(qa.calls[0]!.container, qa.layer, 'the scene mounts its canvas in the layer');
  assert.deepEqual(qa.calls[0]!.budget, algorithmBudget('blackhole', false));
  assert.equal(qa.calls[0]!.signal, qa.controller.signal, 'the factory can cancel its own loads');
  assert.equal(qa.layer?.children[0], qa.still);
  assert.equal(qa.layer?.children[1], qa.scene.canvas, 'the canvas is mounted in the layer');
  // The reveal frame is drawn with a zero clock, then the loop keeps its own time.
  assert.deepEqual(qa.scene.frames, [
    { seconds: 0, delta: 0, pointer: { x: 0, y: 0, active: false, down: false, tap: false } },
  ]);
  harness.tick(0);
  harness.tick(40);
  assert.deepEqual(qa.scene.frames[1], {
    seconds: 0,
    delta: 0,
    pointer: { x: 0, y: 0, active: false, down: false, tap: false },
  });
  assert.ok(Math.abs(qa.scene.frames[2]!.seconds - 0.04) < 1e-9);
  assert.ok(Math.abs(qa.scene.frames[2]!.delta - 0.04) < 1e-9);
  qa.controller.abort();
  qa.assertDetached();
});

test('reduced motion returns before any GPU module is requested', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'mandelbulb', reduced: true });
  await qa.mount();
  assert.equal(qa.loads, 0);
  assert.equal(qa.calls.length, 0);
  assert.equal(qa.state, 'static');
  assert.equal(qa.still?.className, 'algorithm-still');
  assert.equal(qa.host.listenerCount, 0, 'a static fallback reads no pointer');
  assert.equal(harness.rafs.size, 0);
  qa.controller.abort();
  qa.assertDetached();
});

/* ---------- failures --------------------------------------------------- */

test('a scene that throws on its first frame keeps the still and reports only the source', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'terrain' });
  qa.scene.frameErrorAt = 1;
  qa.scene.frameError = new Error('shader compile failed at /fixtures/private/scene.glsl');
  await qa.mount();
  assert.equal(qa.state, 'static');
  assert.equal(qa.scene.disposals, 1);
  assert.equal(qa.scene.canvas.parent, undefined, 'the broken canvas leaves the layer');
  assert.equal(qa.still?.className, 'algorithm-still', 'the still is still there');
  assert.equal(harness.rafs.size, 0);
  assert.deepEqual(harness.posts, [{ kind: 'algorithm:terrain', code: 'Error', path: '/qa' }]);
  assert.doesNotMatch(
    JSON.stringify(harness.posts),
    /private|someone|compile/,
    'no shader text or path information leaves the page',
  );
  qa.controller.abort();
  assert.equal(qa.scene.disposals, 1, 'the failure path and the abort release the scene once');
  qa.assertDetached();
});

test('a module that fails to import falls back to the still', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'ocean' });
  qa.loadError = new Error('chunk failed');
  await qa.mount();
  assert.equal(qa.calls.length, 0);
  assert.equal(qa.state, 'static');
  assert.equal(qa.scene.disposals, 0);
  assert.deepEqual(harness.posts, [{ kind: 'algorithm:ocean', code: 'Error', path: '/qa' }]);
  qa.controller.abort();
  qa.assertDetached();
});

test('a scene that cannot open a context leaves the layer static', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'reaction' });
  qa.createError = new Error('WebGL2 is unavailable');
  await qa.mount();
  assert.equal(qa.state, 'static');
  assert.equal(qa.calls.length, 1);
  assert.equal(qa.scene.disposals, 0, 'there is no scene object to release');
  assert.equal(harness.rafs.size, 0);
  assert.deepEqual(harness.posts, [{ kind: 'algorithm:reaction', code: 'Error', path: '/qa' }]);
  qa.controller.abort();
  qa.assertDetached();
});

test('a frame that throws while live returns the layer to the still', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'terrain' });
  await qa.mount();
  assert.equal(qa.state, 'live');
  qa.scene.frameErrorAt = 3;
  qa.scene.frameError = new Error('lost the simulation target');
  harness.tick(0);
  harness.tick(40);
  assert.equal(qa.state, 'static');
  assert.equal(qa.scene.disposals, 1);
  assert.equal(harness.rafs.size, 0);
  assert.deepEqual(harness.posts, [{ kind: 'algorithm:terrain', code: 'Error', path: '/qa' }]);
  qa.controller.abort();
  assert.equal(qa.scene.disposals, 1);
  qa.assertDetached();
});

test('a lost WebGL context returns the layer to the still and releases the scene', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'mandelbulb' });
  await qa.mount();
  const event = new EventStub('webglcontextlost');
  qa.scene.canvas.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true, 'the browser must not also destroy the canvas');
  assert.equal(qa.state, 'static');
  assert.equal(qa.scene.disposals, 1);
  assert.equal(qa.scene.canvas.parent, undefined);
  assert.equal(harness.rafs.size, 0);
  assert.deepEqual(harness.posts, [{ kind: 'algorithm:mandelbulb', code: 'Error', path: '/qa' }]);
  qa.controller.abort();
  assert.equal(qa.scene.disposals, 1);
  qa.assertDetached();
});

/* ---------- abort and async scenes ------------------------------------- */

test('a scene that resolves after the abort is disposed immediately', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'terrain' });
  const resolveScene = qa.defer();
  const mounted = qa.mount();
  await settle();
  assert.equal(qa.calls.length, 1, 'the factory is called once the module resolved');
  assert.equal(qa.state, 'static');
  assert.equal(qa.scene.frames.length, 0);
  qa.controller.abort();
  assert.equal(qa.stage.children.length, 0);
  resolveScene();
  await settle();
  assert.equal(qa.scene.disposals, 1, 'the late scene is released without a frame');
  assert.equal(qa.scene.frames.length, 0);
  assert.equal(qa.scene.canvas.parent, undefined);
  assert.equal(harness.rafs.size, 0);
  assert.equal(harness.posts.length, 0, 'a clean abort is not an error');
  await mounted;
  qa.assertDetached();
});

test('an abort while the module import is pending never builds a scene', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'ocean' });
  const mounted = qa.mount();
  qa.controller.abort();
  assert.equal(qa.stage.children.length, 0);
  await mounted;
  assert.equal(qa.calls.length, 0);
  assert.equal(qa.scene.disposals, 0);
  assert.equal(harness.posts.length, 0);
  qa.assertDetached();
});

test('an early aborted signal mounts nothing at all', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'terrain' });
  qa.controller.abort();
  await qa.mount();
  assert.equal(qa.loads, 0);
  assert.equal(qa.stage.children.length, 0);
  assert.equal(qa.host.listenerCount, 0);
  assert.equal(harness.posts.length, 0);
});

test('aborting a live scene releases the loop, the listeners, the observers and the layer', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'ocean' });
  await qa.mount();
  assert.equal(qa.state, 'live');
  assert.ok(harness.rafs.size >= 1, 'the loop is running');
  qa.controller.abort();
  qa.controller.abort();
  assert.equal(qa.scene.disposals, 1, 'release is idempotent');
  assert.equal(qa.scene.canvas.parent, undefined);
  qa.assertDetached();
  harness.tick(1000);
  assert.equal(qa.scene.frames.length, 1, 'no frame runs after the abort');
});

test('a cleanup that throws still detaches the layer, the loop and the signal listener', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'blackhole' });
  await qa.mount();
  assert.equal(qa.state, 'live');
  qa.scene.disposeError = new Error('release failed at /fixtures/private/scene.glsl');
  // The abort must complete: an exception in the scene cleanup cannot block the teardown.
  qa.controller.abort();
  assert.equal(qa.scene.disposals, 1);
  assert.equal(qa.stage.children.length, 0, 'the layer is still removed');
  assert.equal(harness.rafs.size, 0, 'no frame stays queued');
  assert.equal(qa.host.listenerCount, 0);
  assert.equal(getEventListeners(qa.controller.signal, 'abort').length, 0);
  assert.equal(harness.posts.length, 1);
  assert.equal(harness.posts[0]!.kind, 'algorithm:blackhole:dispose');
  assert.equal(harness.posts[0]!.code, 'Error');
  assert.equal(harness.posts[0]!.path, '/qa');
  assert.doesNotMatch(JSON.stringify(harness.posts), /private|someone|release failed/);
  qa.assertDetached();
});

test('a failing frame whose cleanup also throws still falls back to the still', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'reaction' });
  await qa.mount();
  qa.scene.frameErrorAt = 2;
  qa.scene.frameError = new Error('lost the simulation target');
  qa.scene.disposeError = new Error('cleanup also failed');
  harness.tick(0);
  harness.tick(40);
  assert.equal(qa.state, 'static', 'the still returns even when the cleanup fails');
  assert.equal(qa.scene.disposals, 1);
  assert.equal(harness.rafs.size, 0);
  assert.deepEqual(
    harness.posts.map((post) => post.kind),
    ['algorithm:reaction:dispose', 'algorithm:reaction'],
    'the cleanup failure is reported without hiding the frame failure',
  );
  qa.controller.abort();
  assert.equal(qa.scene.disposals, 1);
  qa.assertDetached();
});

/* ---------- size, visibility and quality -------------------------------- */

test('a resize hands the new stage box and the current quality scale to the scene', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'blackhole' });
  await qa.mount();
  const observer = harness.observers.at(-1)!;
  assert.ok(observer.targets.has(qa.host), 'the host is watched for size changes');
  assert.deepEqual(qa.scene.resizes, [{ width: 1000, height: 600, scale: 1 }]);
  qa.host.rect = { left: 0, top: 0, width: 820, height: 420 };
  observer.notify();
  assert.deepEqual(qa.scene.resizes.at(-1), { width: 820, height: 420, scale: 1 });
  qa.controller.abort();
  qa.assertDetached();
});

test('a hidden tab stops the loop and coming back restarts the warm window', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'reaction' });
  await qa.mount();
  // 30 fps means a 33 ms gate and a 43 ms slow threshold; 100 ms frames are slow.
  for (let i = 1; i <= 40; i++) harness.tick(i * 100);
  assert.deepEqual(qa.scene.scales, [1, 0.8], 'sustained slow frames step the shared ladder down');
  // Sit just short of the next step, then leave the tab: those samples must not carry over.
  for (let i = 41; i <= 56; i++) harness.tick(i * 100);
  assert.deepEqual(qa.scene.scales, [1, 0.8]);
  harness.visibility(true);
  assert.equal(qa.paused, 'true');
  assert.equal(harness.rafs.size, 0, 'a hidden page keeps no animation frame');
  harness.visibility(false);
  assert.equal(qa.paused, 'false');
  for (let i = 57; i <= 76; i++) harness.tick(i * 100);
  assert.deepEqual(
    qa.scene.scales,
    [1, 0.8],
    'the resumed loop warms up again before it may downshift',
  );
  qa.controller.abort();
  qa.assertDetached();
});

test('an offscreen stage pauses the loop and coming back resumes it', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'terrain' });
  await qa.mount();
  const observer = harness.intersections.at(-1)!;
  assert.ok(observer.targets.has(qa.host));
  observer.notify([{ isIntersecting: false }]);
  assert.equal(qa.paused, 'true');
  assert.equal(harness.rafs.size, 0);
  observer.notify([{ isIntersecting: true }]);
  assert.equal(qa.paused, 'false');
  assert.equal(harness.rafs.size, 1);
  assert.equal(qa.state, 'live');
  qa.controller.abort();
  qa.assertDetached();
});

/* ---------- pointer ----------------------------------------------------- */

test('mouse input is normalized into stage space with y pointing up', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'reaction' });
  await qa.mount();
  qa.stage.rect = { left: 100, top: 50, width: 400, height: 200 };
  qa.pointer('pointermove', { clientX: 400, clientY: 150 });
  harness.tick(0);
  harness.tick(40);
  const moved = qa.scene.frames.at(-1)!.pointer;
  assert.deepEqual(moved, { x: 0.5, y: 0, active: true, down: false, tap: false });
  qa.pointer('pointermove', { clientX: 5000, clientY: -5000 });
  harness.tick(80);
  assert.deepEqual(qa.scene.frames.at(-1)!.pointer, {
    x: 1,
    y: 1,
    active: true,
    down: false,
    tap: false,
  });
  qa.pointer('pointerdown', { clientX: 400, clientY: 150 });
  harness.tick(120);
  assert.equal(qa.scene.frames.at(-1)!.pointer.down, true);
  qa.pointer('pointerup', { clientX: 400, clientY: 150 });
  harness.tick(160);
  const released = qa.scene.frames.at(-1)!.pointer;
  assert.deepEqual(released, { x: 0.5, y: 0, active: true, down: false, tap: false });
  qa.controller.abort();
  qa.assertDetached();
});

test('leaving the stage or blurring the window clears every pointer field', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'blackhole' });
  await qa.mount();
  qa.pointer('pointermove', { clientX: 500, clientY: 300 });
  qa.pointer('pointerdown', { clientX: 500, clientY: 300 });
  harness.tick(0);
  harness.tick(40);
  assert.deepEqual(qa.scene.frames.at(-1)!.pointer, {
    x: 0,
    y: 0,
    active: true,
    down: true,
    tap: false,
  });
  qa.pointer('pointerleave');
  harness.tick(80);
  assert.deepEqual(qa.scene.frames.at(-1)!.pointer, {
    x: 0,
    y: 0,
    active: false,
    down: false,
    tap: false,
  });
  qa.pointer('pointerdown', { clientX: 500, clientY: 300 });
  harness.window.dispatchEvent(new EventStub('blur'));
  harness.tick(120);
  assert.deepEqual(qa.scene.frames.at(-1)!.pointer, {
    x: 0,
    y: 0,
    active: false,
    down: false,
    tap: false,
  });
  qa.controller.abort();
  qa.assertDetached();
});

test('a browser pointercancel drops a touch candidate before its release arrives', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'terrain' });
  await qa.mount();
  qa.pointer('pointerdown', { pointerType: 'touch', clientX: 25, clientY: 25, timeStamp: 0 });
  // The browser takes over for scrolling: the press is no longer a candidate for a tap.
  qa.pointer('pointercancel', { pointerType: 'touch', clientX: 25, clientY: 25, timeStamp: 40 });
  qa.pointer('pointerup', { pointerType: 'touch', clientX: 25, clientY: 25, timeStamp: 80 });
  harness.tick(0);
  harness.tick(40);
  assert.deepEqual(
    qa.scene.frames.at(-1)!.pointer,
    { x: 0, y: 0, active: false, down: false, tap: false },
    'a cancelled gesture never taps',
  );
  qa.pointer('pointerdown', { pointerType: 'touch', clientX: 25, clientY: 25, timeStamp: 120 });
  qa.pointer('pointerup', { pointerType: 'touch', clientX: 25, clientY: 25, timeStamp: 160 });
  harness.tick(80);
  assert.equal(qa.scene.frames.at(-1)!.pointer.tap, true, 'a later clean tap still works');
  qa.controller.abort();
  qa.assertDetached();
});

test('a short touch tap lasts exactly one rendered frame', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'reaction' });
  await qa.mount();
  qa.stage.rect = { left: 0, top: 0, width: 100, height: 100 };
  qa.pointer('pointerdown', { pointerType: 'touch', clientX: 25, clientY: 25, timeStamp: 1000 });
  harness.tick(0);
  harness.tick(40);
  assert.deepEqual(
    qa.scene.frames.at(-1)!.pointer,
    { x: 0, y: 0, active: false, down: false, tap: false },
    'a press alone is not a brush',
  );
  qa.pointer('pointerup', { pointerType: 'touch', clientX: 25, clientY: 25, timeStamp: 1200 });
  harness.tick(80);
  assert.deepEqual(qa.scene.frames.at(-1)!.pointer, {
    x: -0.5,
    y: 0.5,
    active: true,
    down: false,
    tap: true,
  });
  harness.tick(120);
  assert.deepEqual(
    qa.scene.frames.at(-1)!.pointer,
    { x: -0.5, y: 0.5, active: false, down: false, tap: false },
    'the tap is consumed by that single frame',
  );
  qa.controller.abort();
  qa.assertDetached();
});

test('a long press or a drag never becomes a tap and never brushes', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'reaction' });
  await qa.mount();
  qa.pointer('pointerdown', { pointerType: 'touch', clientX: 25, clientY: 25, timeStamp: 0 });
  qa.pointer('pointerup', { pointerType: 'touch', clientX: 25, clientY: 25, timeStamp: 400 });
  harness.tick(0);
  harness.tick(40);
  assert.equal(qa.scene.frames.at(-1)!.pointer.tap, false, 'a 400 ms press is not a tap');
  qa.pointer('pointerdown', { pointerType: 'touch', clientX: 10, clientY: 10, timeStamp: 500 });
  qa.pointer('pointermove', { pointerType: 'touch', clientX: 40, clientY: 10, timeStamp: 520 });
  qa.pointer('pointerup', { pointerType: 'touch', clientX: 40, clientY: 10, timeStamp: 560 });
  harness.tick(80);
  const dragged = qa.scene.frames.at(-1)!.pointer;
  assert.deepEqual(
    dragged,
    { x: 0, y: 0, active: false, down: false, tap: false },
    'a 30 px touch drag neither taps nor paints',
  );
  qa.controller.abort();
  qa.assertDetached();
});

test('gestures owned by a link, button or editable target never reach the scene', async (t) => {
  const harness = createHarness(t);
  const qa = harness.instance({ id: 'blackhole' });
  await qa.mount();
  const link = new ElementStub('A');
  const button = new ElementStub('BUTTON');
  const editable = new ElementStub('DIV');
  editable.setAttribute('contenteditable', '');
  qa.stage.append(link, button, editable);
  for (const target of [link, button, editable]) {
    qa.pointer('pointerdown', { clientX: 500, clientY: 300 }, target);
    qa.pointer('pointermove', { clientX: 500, clientY: 300 }, target);
  }
  harness.tick(0);
  harness.tick(40);
  assert.deepEqual(
    qa.scene.frames.at(-1)!.pointer,
    { x: 0, y: 0, active: false, down: false, tap: false },
    'the background ignores controls',
  );
  // A release over a control still ends a press that started on the background.
  qa.pointer('pointerdown', { clientX: 500, clientY: 300 });
  harness.tick(80);
  assert.equal(qa.scene.frames.at(-1)!.pointer.down, true);
  qa.pointer('pointerup', { clientX: 500, clientY: 300 }, link);
  harness.tick(120);
  assert.equal(qa.scene.frames.at(-1)!.pointer.down, false);
  qa.controller.abort();
  for (const target of [link, button, editable]) target.remove();
  qa.assertDetached();
});
