import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import test, { type TestContext } from 'node:test';
import { createAtmosphereController, type AtmosphereHandle } from '../src/client/atmosphere';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

class FakeAnimation {
  private readonly completion = deferred<void>();
  readonly finished = this.completion.promise;
  state: 'running' | 'finished' | 'idle' = 'running';
  cancels = 0;

  constructor(
    readonly keyframes: Keyframe[],
    readonly options: KeyframeAnimationOptions,
  ) {}

  finish() {
    if (this.state !== 'running') return;
    this.state = 'finished';
    this.completion.resolve();
  }
  cancel() {
    this.cancels++;
    const wasRunning = this.state === 'running';
    this.state = 'idle';
    if (wasRunning) this.completion.reject(new DOMException('Animation cancelled', 'AbortError'));
  }
}

class SceneElement extends EventTarget {
  readonly children: SceneElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly properties = new Map<string, string>();
  readonly style = {
    opacity: '',
    backgroundColor: '',
    setProperty: (name: string, value: string) => this.properties.set(name, value),
  };
  parent: SceneElement | undefined;
  className = '';
  peakChildren = 0;

  constructor(readonly animations: FakeAnimation[]) {
    super();
  }

  append(child: SceneElement) {
    child.remove();
    child.parent = this;
    this.children.push(child);
    this.peakChildren = Math.max(this.peakChildren, this.children.length);
  }
  remove() {
    if (!this.parent) return;
    const siblings = this.parent.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parent = undefined;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  animate(keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = new FakeAnimation(keyframes, options);
    this.animations.push(animation);
    return animation;
  }
}

type LoadRequest = {
  family: string;
  signal: AbortSignal;
  element: SceneElement;
  result: ReturnType<typeof deferred<AtmosphereHandle | undefined>>;
};

function createHarness(t: TestContext) {
  const animations: FakeAnimation[] = [];
  const host = new SceneElement(animations);
  const document = Object.assign(new EventTarget(), {
    documentElement: { dataset: { family: 'paper' } },
    hidden: false,
    createElement: (tag: string) => {
      assert.equal(tag, 'div');
      return new SceneElement(animations);
    },
  });
  const preferences = { motion: 'full', systemReduced: false };
  const palette = new Map([
    ['--bg', 'rgb(250, 243, 227)'],
    ['--fg', '#302b26'],
    ['--accent', '#936040'],
    ['--muted', '#786e63'],
    ['--line', '#d9c9b7'],
    ['--soft', '#f1e5d4'],
  ]);
  const globals = {
    document,
    getComputedStyle: (element: unknown) => {
      assert.equal(element, document.documentElement);
      return { getPropertyValue: (name: string) => palette.get(name) ?? '' };
    },
    matchMedia: (query: string) => {
      assert.equal(query, '(prefers-reduced-motion: reduce)');
      return { matches: preferences.systemReduced };
    },
    localStorage: {
      getItem: (key: string) => {
        assert.equal(key, 'bh:motion');
        return preferences.motion;
      },
    },
    innerWidth: 1280,
    navigator: { connection: { saveData: false } },
  };
  const saved = new Map(
    Object.keys(globals).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  for (const [name, value] of Object.entries(globals))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });

  const requests: LoadRequest[] = [];
  const handles: {
    element: SceneElement;
    pauses: boolean[];
    disposes: number;
    handle: AtmosphereHandle;
  }[] = [];
  const controller = createAtmosphereController(
    host as unknown as HTMLElement,
    (family, signal, element) => {
      const result = deferred<AtmosphereHandle | undefined>();
      requests.push({ family, signal, element: element as unknown as SceneElement, result });
      return result.promise;
    },
  );
  t.after(async () => {
    controller.dispose();
    for (const request of requests) request.result.resolve(undefined);
    await Promise.resolve();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });

  return {
    host,
    document,
    preferences,
    palette,
    requests,
    handles,
    animations,
    controller,
    route(family: string, background: string) {
      document.documentElement.dataset.family = family;
      palette.set('--bg', background);
    },
    async fulfill(index: number) {
      const request = requests[index]!;
      const element = new SceneElement(animations);
      request.element.append(element);
      const record = {
        element,
        pauses: [] as boolean[],
        disposes: 0,
        handle: undefined as unknown as AtmosphereHandle,
      };
      record.handle = {
        element: element as unknown as HTMLElement,
        pause: (paused) => record.pauses.push(paused),
        dispose: () => {
          record.disposes++;
          element.remove();
        },
      };
      handles.push(record);
      request.result.resolve(record.handle);
      await Promise.resolve();
      return record;
    },
    finishFades() {
      for (const animation of animations) animation.finish();
    },
    assertEmpty() {
      assert.equal(host.children.length, 0);
      assert.ok(host.peakChildren <= 2, 'the persistent host never owns more than two scenes');
      assert.ok(animations.every((animation) => animation.state === 'idle'));
      for (const handle of handles) {
        assert.equal(handle.disposes, 1, 'each loaded renderer is disposed once');
        assert.equal(handle.element.parent, undefined);
      }
      for (const request of requests) {
        assert.equal(request.signal.aborted, true);
        assert.equal(getEventListeners(request.signal, 'abort').length, 0);
      }
    },
  };
}

test('first completion owns one scene and snapshots the palette without a fade', async (t) => {
  const h = createHarness(t);
  const refreshing = h.controller.refresh();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0]!.family, 'paper');
  assert.equal(h.host.children.length, 1);
  const scene = h.host.children[0]!;
  assert.equal(scene.className, 'atmosphere-scene');
  assert.equal(scene.attributes.get('aria-hidden'), 'true');
  assert.equal(scene.style.opacity, '1');
  const handle = await h.fulfill(0);
  await refreshing;
  assert.deepEqual(handle.pauses, [false]);
  assert.equal(handle.disposes, 0);
  assert.equal(h.animations.length, 0);
  assert.deepEqual([...scene.properties], [...h.palette]);
  h.route('terminal', 'rgb(8, 14, 20)');
  assert.equal(scene.style.backgroundColor, 'rgb(250, 243, 227)');
  assert.equal(
    scene.properties.get('--bg'),
    'rgb(250, 243, 227)',
    'old tokens do not follow the root',
  );
  h.controller.dispose();
  h.assertEmpty();
});

test('prepare keeps and pauses old pixels until both sides of the exchange finish', async (t) => {
  const h = createHarness(t);
  const first = h.controller.refresh();
  const old = await h.fulfill(0);
  await first;
  const oldScene = h.requests[0]!.element;
  h.controller.prepare();
  assert.equal(old.pauses.at(-1), true);
  assert.equal(old.disposes, 0);
  assert.equal(h.requests[0]!.signal.aborted, false);
  assert.deepEqual(h.host.children, [oldScene]);
  assert.equal(oldScene.style.opacity, '1');

  h.route('terminal', 'rgb(8, 14, 20)');
  const exchanging = h.controller.refresh();
  const nextScene = h.requests[1]!.element;
  assert.deepEqual(h.host.children, [oldScene, nextScene]);
  assert.equal(nextScene.style.opacity, '0');
  assert.equal(old.disposes, 0, 'a pending import cannot remove the outgoing pixels');
  assert.equal(h.animations.length, 0);
  const next = await h.fulfill(1);
  assert.deepEqual(next.pauses, [false]);
  assert.equal(h.animations.length, 2);
  assert.deepEqual(
    h.animations.map((animation) => animation.options.duration),
    [900, 900],
  );
  assert.deepEqual(h.animations[0]!.keyframes, [{ opacity: 0 }, { opacity: 1 }]);
  assert.deepEqual(h.animations[1]!.keyframes, [{ opacity: 1 }, { opacity: 0 }]);
  h.animations[0]!.finish();
  await Promise.resolve();
  assert.equal(old.disposes, 0, 'one finished side is not a completed exchange');
  assert.equal(h.host.children.length, 2);
  h.animations[1]!.finish();
  await exchanging;
  assert.equal(old.disposes, 1);
  assert.equal(h.requests[0]!.signal.aborted, true);
  assert.deepEqual(h.host.children, [nextScene]);
  assert.equal(nextScene.style.opacity, '1');
  assert.equal(nextScene.style.backgroundColor, 'rgb(8, 14, 20)');
  assert.ok(
    h.animations.every((animation) => animation.cancels === 1 && animation.state === 'idle'),
  );
  h.controller.dispose();
  h.assertEmpty();
});

test('light capability uses 600ms fades without permanently holding a scene loaded in a hidden tab', async (t) => {
  const h = createHarness(t);
  h.preferences.motion = 'light';
  const first = h.controller.refresh();
  await h.fulfill(0);
  await first;
  h.document.hidden = true;
  h.route('terminal', '#080e14');
  const exchanging = h.controller.refresh();
  const next = await h.fulfill(1);
  assert.deepEqual(
    next.pauses,
    [false],
    'providers independently combine visibility with manual holds',
  );
  assert.deepEqual(
    h.animations.map((animation) => animation.options.duration),
    [600, 600],
  );
  h.finishFades();
  await exchanging;
  h.controller.dispose();
  h.assertEmpty();
});

test('a second prepare cancels pending work and disposes its late handle without replacing current', async (t) => {
  const h = createHarness(t);
  const first = h.controller.refresh();
  const original = await h.fulfill(0);
  await first;
  h.route('terminal', '#080e14');
  const staleRefresh = h.controller.refresh();
  const stale = h.requests[1]!;
  assert.equal(h.host.children.length, 2);
  h.controller.prepare();
  assert.equal(stale.signal.aborted, true);
  assert.equal(stale.element.parent, undefined);
  assert.deepEqual(h.host.children, [h.requests[0]!.element]);
  assert.equal(original.disposes, 0);

  h.route('paper', '#fff7eb');
  const latestRefresh = h.controller.refresh();
  const latest = await h.fulfill(2);
  h.finishFades();
  await latestRefresh;
  const late = await h.fulfill(1);
  await staleRefresh;
  assert.equal(late.disposes, 1);
  assert.deepEqual(late.pauses, [], 'a cancelled loader cannot become active');
  assert.equal(latest.disposes, 0);
  assert.deepEqual(h.host.children, [h.requests[2]!.element]);
  assert.equal(h.requests[2]!.element.style.backgroundColor, '#fff7eb');
  assert.equal(h.animations.length, 2, 'late completion did not create another fade');
  h.controller.dispose();
  h.assertEmpty();
});

test('rapid refresh cancels obsolete WAAPI exchanges while keeping at most two scenes', async (t) => {
  const h = createHarness(t);
  const first = h.controller.refresh();
  await h.fulfill(0);
  await first;
  const refreshes: Promise<void>[] = [];
  for (let index = 1; index <= 5; index++) {
    h.route(index % 2 ? 'terminal' : 'paper', `route-${index}`);
    refreshes.push(h.controller.refresh());
    assert.equal(h.host.children.length, 2);
    await h.fulfill(index);
    assert.equal(h.host.children.length, 2);
    assert.equal(h.animations.filter((animation) => animation.state === 'running').length, 2);
    assert.ok(h.animations.slice(0, -2).every((animation) => animation.cancels === 1));
  }
  h.finishFades();
  await Promise.all(refreshes);
  assert.equal(h.host.peakChildren, 2);
  assert.deepEqual(h.host.children, [h.requests[5]!.element]);
  assert.ok(h.handles.slice(0, -1).every((handle) => handle.disposes === 1));
  assert.equal(h.handles.at(-1)!.disposes, 0);
  assert.ok(h.animations.every((animation) => animation.cancels === 1));
  h.controller.dispose();
  h.assertEmpty();
});

test('stored reduced motion cancels an active exchange and removes every scene', async (t) => {
  const h = createHarness(t);
  const first = h.controller.refresh();
  await h.fulfill(0);
  await first;
  const exchanging = h.controller.refresh();
  await h.fulfill(1);
  assert.equal(h.animations.filter((animation) => animation.state === 'running').length, 2);
  h.preferences.motion = 'reduced-motion';
  await h.controller.refresh();
  await exchanging;
  assert.equal(h.requests.length, 2, 'reduced motion never starts another loader');
  h.assertEmpty();
  h.controller.dispose();
  h.assertEmpty();
});

test('system reduced motion starts no loader even when stored motion is full', async (t) => {
  const h = createHarness(t);
  h.preferences.systemReduced = true;
  await h.controller.refresh();
  assert.equal(h.requests.length, 0);
  h.assertEmpty();
});

test('a failed initial loader rejects but leaves the new static color visible', async (t) => {
  const h = createHarness(t);
  h.route('terminal', '#080e14');
  const error = new Error('renderer import failed');
  const rejected = assert.rejects(h.controller.refresh(), error);
  h.requests[0]!.result.reject(error);
  await rejected;
  assert.deepEqual(h.host.children, [h.requests[0]!.element]);
  assert.equal(h.host.children[0]!.style.opacity, '1');
  assert.equal(h.host.children[0]!.style.backgroundColor, '#080e14');
  assert.equal(h.requests[0]!.signal.aborted, false);
  assert.equal(h.animations.length, 0);
  h.controller.dispose();
  h.assertEmpty();
});

test('a failed replacement loader finishes the color exchange before rejecting', async (t) => {
  const h = createHarness(t);
  const first = h.controller.refresh();
  const old = await h.fulfill(0);
  await first;
  h.route('terminal', '#080e14');
  const error = new Error('replacement renderer failed');
  const rejected = assert.rejects(h.controller.refresh(), error);
  h.requests[1]!.result.reject(error);
  await Promise.resolve();
  assert.equal(h.host.children.length, 2);
  assert.equal(old.disposes, 0);
  assert.equal(h.animations.length, 2);
  h.finishFades();
  await rejected;
  assert.equal(old.disposes, 1);
  assert.deepEqual(h.host.children, [h.requests[1]!.element]);
  assert.equal(h.host.children[0]!.style.opacity, '1');
  assert.equal(h.host.children[0]!.style.backgroundColor, '#080e14');
  h.controller.dispose();
  h.assertEmpty();
});

test('dispose is idempotent while fading and leaves no scene, animation or renderer alive', async (t) => {
  const h = createHarness(t);
  const first = h.controller.refresh();
  await h.fulfill(0);
  await first;
  const exchanging = h.controller.refresh();
  await h.fulfill(1);
  h.controller.dispose();
  h.controller.dispose();
  await exchanging;
  assert.ok(h.animations.every((animation) => animation.cancels === 1));
  h.assertEmpty();
});

test('dispose during loading also disposes a late handle without reviving the host', async (t) => {
  const h = createHarness(t);
  const first = h.controller.refresh();
  await h.fulfill(0);
  await first;
  const pending = h.controller.refresh();
  h.controller.dispose();
  h.controller.dispose();
  assert.equal(h.host.children.length, 0);
  assert.equal(h.requests[1]!.signal.aborted, true);
  const late = await h.fulfill(1);
  await pending;
  assert.equal(late.disposes, 1);
  assert.deepEqual(late.pauses, []);
  assert.equal(h.animations.length, 0);
  h.assertEmpty();
});
