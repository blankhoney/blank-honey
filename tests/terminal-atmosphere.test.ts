import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import test, { type TestContext } from 'node:test';
import { tsParticles, type Container } from '@tsparticles/engine';
import { mountAtmosphere } from '../src/client/terminal-atmosphere';

class ElementStub {
  readonly nodeType = 1;
  id = '';
  className = '';
  textContent = '';
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly classes = new Set<string>();
  readonly classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
  };
  readonly children: ElementStub[] = [];
  parent: ElementStub | undefined;

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  append(element: ElementStub) {
    element.parent = this;
    this.children.push(element);
  }
  remove() {
    if (!this.parent) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = undefined;
  }
}

class DocumentStub extends EventTarget {
  hidden = false;
  readonly body = new ElementStub();
  readonly documentElement = new ElementStub();

  createElement(tag: string) {
    assert.ok(tag === 'div' || tag === 'span');
    return new ElementStub();
  }
}

class EngineStub {
  // The public load() contract returns an already auto-playing container.
  animationStatus = true;
  pauses = 0;
  plays = 0;
  destroys = 0;

  pause() {
    this.pauses++;
    this.animationStatus = false;
  }
  play() {
    this.plays++;
    this.animationStatus = true;
  }
  destroy() {
    this.destroys++;
    this.animationStatus = false;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createHarness(t: TestContext, hidden = false) {
  const names = [
    'document',
    'NodeList',
    'HTMLCollection',
    'matchMedia',
    'localStorage',
    'navigator',
    'innerWidth',
    'innerHeight',
    'getComputedStyle',
    'setTimeout',
    'clearTimeout',
  ];
  const saved = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clockSetTimeout = setTimeout;
  const clockClearTimeout = clearTimeout;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const document = new DocumentStub();
  document.hidden = hidden;
  const host = new ElementStub();
  const controller = new AbortController();
  const engine = new EngineStub();
  const load = t.mock.method(tsParticles, 'load', async () => engine as unknown as Container);

  for (const [name, value] of Object.entries({
    document,
    NodeList: class {},
    HTMLCollection: class {},
    matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => null },
    navigator: {},
    innerWidth: 1280,
    innerHeight: 800,
    getComputedStyle: (element: ElementStub) => {
      assert.equal(element, host);
      return {
        getPropertyValue: (name: string) => {
          assert.equal(name, '--bg');
          return ' #0b0d0e ';
        },
      };
    },
    setTimeout: (callback: () => void, delay: number) => {
      const timer = clockSetTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
      return timer;
    },
    clearTimeout: (timer: ReturnType<typeof setTimeout> | undefined) => {
      if (timer !== undefined) timers.delete(timer);
      clockClearTimeout(timer);
    },
  }))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });

  t.after(() => {
    try {
      controller.abort();
    } finally {
      for (const timer of timers) clockClearTimeout(timer);
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
      t.mock.timers.reset();
    }
  });

  return {
    document,
    host,
    controller,
    engine,
    load,
    timers,
    mount: () => mountAtmosphere(controller.signal, host as unknown as HTMLElement),
    visibility(hidden: boolean) {
      document.hidden = hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    },
    assertDetached() {
      assert.equal(host.children.length, 0);
      assert.equal(timers.size, 0);
      assert.equal(getEventListeners(document, 'visibilitychange').length, 0);
    },
  };
}

test('auto-playing load, repeated resumes and visible events never add another play call', async (t) => {
  const h = createHarness(t);
  const handle = await h.mount();
  assert.ok(handle);
  assert.equal(h.load.mock.callCount(), 1);
  assert.equal(h.host.children.length, 1);
  assert.equal(h.host.children[0]!.children.length, 4, 'rain and three real Baffle lines mount');
  assert.equal(h.timers.size, 1, 'the cipher owns only its future 5200ms deadline');
  for (let index = 0; index < 4; index++) {
    handle.pause(false);
    h.visibility(false);
  }
  assert.equal(h.engine.plays, 0);
  assert.equal(h.engine.pauses, 0);
  assert.equal(h.engine.animationStatus, true);
  assert.equal(h.timers.size, 1);
});

test('a manual hold pauses playback and only the first resume calls play', async (t) => {
  const h = createHarness(t);
  const handle = await h.mount();
  assert.ok(handle);
  handle.pause(true);
  assert.equal(h.engine.pauses, 1);
  assert.equal(h.engine.animationStatus, false);
  assert.equal(h.timers.size, 0);
  handle.pause(false);
  handle.pause(false);
  h.visibility(false);
  assert.equal(h.engine.plays, 1);
  assert.equal(h.engine.animationStatus, true);
  assert.equal(h.timers.size, 1);
});

test('visibility cannot release a manual hold and later hidden/visible cycles resume once', async (t) => {
  const h = createHarness(t);
  const handle = await h.mount();
  assert.ok(handle);
  handle.pause(true);
  h.visibility(true);
  h.visibility(false);
  assert.equal(handle.element.dataset.paused, 'true');
  assert.equal(h.engine.animationStatus, false);
  assert.equal(h.engine.plays, 0);
  assert.equal(h.timers.size, 0);
  handle.pause(false);
  assert.equal(h.engine.plays, 1);
  h.visibility(true);
  assert.equal(handle.element.dataset.paused, 'true');
  assert.equal(h.timers.size, 0);
  h.visibility(false);
  h.visibility(false);
  assert.equal(handle.element.dataset.paused, 'false');
  assert.equal(h.engine.plays, 2);
  assert.equal(h.timers.size, 1);
});

test('loading while hidden pauses the auto-playing engine without creating a permanent hold', async (t) => {
  const h = createHarness(t, true);
  const handle = await h.mount();
  assert.ok(handle);
  assert.equal(h.engine.pauses, 1);
  assert.equal(h.engine.plays, 0);
  assert.equal(h.timers.size, 0);
  handle.pause(false);
  assert.equal(h.engine.animationStatus, false);
  assert.equal(handle.element.dataset.paused, 'true');
  h.visibility(false);
  h.visibility(false);
  handle.pause(false);
  assert.equal(h.engine.plays, 1);
  assert.equal(handle.element.dataset.paused, 'false');
  assert.equal(h.timers.size, 1);
});

test('abort destroys once and removes the layer, real Baffle lines, listeners and deadline', async (t) => {
  const h = createHarness(t);
  const handle = await h.mount();
  assert.ok(handle);
  const layer = h.host.children[0]!;
  const lines = layer.children.filter((element) => element.className === 'cipher-line');
  assert.equal(getEventListeners(h.document, 'visibilitychange').length, 1);
  assert.equal(h.timers.size, 1);
  h.controller.abort();
  h.assertDetached();
  assert.equal(layer.parent, undefined);
  assert.ok(lines.every((line) => line.parent === undefined));
  assert.equal(h.engine.destroys, 1);
  const pauses = h.engine.pauses;
  handle.dispose();
  handle.dispose();
  handle.pause(false);
  h.visibility(true);
  h.visibility(false);
  assert.equal(h.engine.destroys, 1);
  assert.equal(h.engine.pauses, pauses);
  assert.equal(h.engine.plays, 0);
  h.assertDetached();
});

test('explicit disposal before abort is idempotent and releases visibility and cipher resources', async (t) => {
  const h = createHarness(t);
  const handle = await h.mount();
  assert.ok(handle);
  handle.dispose();
  h.assertDetached();
  handle.dispose();
  h.controller.abort();
  handle.pause(false);
  h.visibility(false);
  assert.equal(h.engine.destroys, 1);
  assert.equal(h.engine.plays, 0);
  h.assertDetached();
});

test('an engine resolving after abort is destroyed and never attaches listeners or resumes', async (t) => {
  const h = createHarness(t);
  const entered = deferred<void>();
  const result = deferred<Container>();
  h.load.mock.mockImplementation(() => {
    entered.resolve();
    return result.promise;
  });
  const mounting = h.mount();
  await entered.promise;
  assert.equal(h.host.children.length, 1);
  h.controller.abort();
  h.assertDetached();
  assert.equal(h.engine.destroys, 0, 'the pending container is not yet owned');
  result.resolve(h.engine as unknown as Container);
  assert.equal(await mounting, undefined);
  assert.equal(h.engine.destroys, 1);
  assert.equal(h.engine.plays, 0);
  assert.equal(h.engine.pauses, 0);
  h.assertDetached();
});

test('a rejected public load propagates its error after removing all scene resources', async (t) => {
  const h = createHarness(t);
  const error = new Error('particle load failed');
  h.load.mock.mockImplementation(async () => {
    throw error;
  });
  await assert.rejects(h.mount(), (failure) => failure === error);
  h.assertDetached();
  assert.equal(h.engine.destroys, 0);
  assert.equal(h.engine.plays, 0);
  h.controller.abort();
  h.assertDetached();
});
