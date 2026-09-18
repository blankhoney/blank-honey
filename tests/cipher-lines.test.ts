import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import test, { type TestContext } from 'node:test';
import { mountCipherLines } from '../src/client/effects/cipher-lines';

class ElementStub {
  className = '';
  textContent = '';
  readonly classes = new Set<string>();
  readonly classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
  };
  readonly attributes = new Map<string, string>();
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

class FakeBaffle {
  starts = 0;
  stops = 0;
  running = false;
  readonly original: string;

  constructor(
    readonly element: ElementStub,
    readonly options: { characters: string; speed: number },
  ) {
    this.original = element.textContent;
  }
  start() {
    this.starts++;
    this.running = true;
    this.element.textContent = '01_/<>[]';
    return this;
  }
  stop() {
    this.stops++;
    this.running = false;
    return this;
  }
  text(replace: (original: string) => string) {
    this.element.textContent = replace(this.element.textContent);
    return this;
  }
}

function createHarness(t: TestContext, light = false, aborted = false) {
  const names = ['document', 'setTimeout', 'clearTimeout'];
  const saved = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clockSetTimeout = setTimeout;
  const clockClearTimeout = clearTimeout;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const scheduled: { callback: () => void; delay: number }[] = [];
  const effects: FakeBaffle[] = [];
  const host = new ElementStub();
  const controller = new AbortController();
  let created = 0;
  if (aborted) controller.abort();
  for (const [name, value] of Object.entries({
    document: {
      createElement: (tag: string) => {
        assert.equal(tag, 'span');
        created++;
        return new ElementStub();
      },
    },
    setTimeout: (callback: () => void, delay: number) => {
      const timer = clockSetTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
      scheduled.push({ callback, delay });
      return timer;
    },
    clearTimeout: (timer: ReturnType<typeof setTimeout> | undefined) => {
      if (timer !== undefined) timers.delete(timer);
      clockClearTimeout(timer);
    },
  }))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });

  const handle = mountCipherLines(
    host as unknown as HTMLElement,
    controller.signal,
    light,
    (element, options) => {
      assert.equal(Array.isArray(element), false);
      const effect = new FakeBaffle(element as unknown as ElementStub, options);
      effects.push(effect);
      return effect;
    },
  );
  t.after(() => {
    try {
      handle.dispose();
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
    handle,
    controller,
    host,
    effects,
    timers,
    scheduled,
    created: () => created,
    wait: light ? 8500 : 5200,
    burst: light ? 500 : 720,
    assertRestored() {
      for (const effect of effects) {
        assert.equal(effect.running, false);
        assert.equal(effect.element.textContent, effect.original);
        assert.equal(effect.element.classes.has('cipher-active'), false);
      }
    },
    assertDisposed() {
      assert.equal(host.children.length, 0);
      assert.equal(timers.size, 0);
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
      for (const effect of effects) {
        assert.equal(effect.running, false);
        assert.equal(effect.element.parent, undefined);
      }
    },
  };
}

for (const light of [false, true]) {
  test(`${light ? 'light' : 'full'} cipher waits for its deadline, scrambles only one line, then restores it`, (t) => {
    const h = createHarness(t, light);
    assert.equal(h.created(), light ? 2 : 3);
    assert.equal(h.effects.length, light ? 2 : 3);
    assert.equal(h.timers.size, 0, 'the initial state is paused');
    t.mock.timers.tick(100_000);
    assert.ok(h.effects.every((effect) => effect.starts === 0 && effect.stops === 0));
    for (const effect of h.effects) {
      assert.equal(effect.element.className, 'cipher-line');
      assert.equal(effect.element.attributes.get('aria-hidden'), 'true');
      assert.deepEqual(effect.options, { characters: '01_/<>[]', speed: light ? 140 : 90 });
    }
    h.handle.pause(false);
    assert.equal(h.timers.size, 1);
    const stopCounts = h.effects.map((effect) => effect.stops);
    h.handle.pause(false);
    assert.equal(h.timers.size, 1, 'repeated resume cannot duplicate the schedule');
    assert.deepEqual(
      h.effects.map((effect) => effect.stops),
      stopCounts,
    );

    for (let round = 0; round <= h.effects.length; round++) {
      const expected: FakeBaffle = h.effects[round % h.effects.length]!;
      assert.equal(h.scheduled.at(-1)!.delay, h.wait);
      t.mock.timers.tick(h.wait - 1);
      h.assertRestored();
      t.mock.timers.tick(1);
      assert.deepEqual(
        h.effects.filter((effect) => effect.running),
        [expected],
      );
      assert.equal(expected.element.classes.has('cipher-active'), true);
      assert.equal(expected.element.textContent, '01_/<>[]');
      assert.equal(h.timers.size, 1);
      assert.equal(h.scheduled.at(-1)!.delay, h.burst);
      t.mock.timers.tick(h.burst - 1);
      assert.equal(expected.running, true);
      t.mock.timers.tick(1);
      h.assertRestored();
      assert.equal(h.timers.size, 1, 'one future round remains, not an interval per line');
    }
  });
}

test('pause cancels waiting and active bursts; late callbacks cannot restart until a fresh resume', (t) => {
  const h = createHarness(t);
  h.handle.pause(false);
  const lateWait = h.scheduled.at(-1)!.callback;
  t.mock.timers.tick(1000);
  const beforePause = h.effects.map((effect) => effect.stops);
  h.handle.pause(true);
  assert.equal(h.timers.size, 0);
  assert.deepEqual(
    h.effects.map((effect) => effect.stops),
    beforePause.map((count) => count + 1),
  );
  lateWait();
  t.mock.timers.tick(100_000);
  assert.equal(h.timers.size, 0);
  assert.ok(h.effects.every((effect) => effect.starts === 0));
  h.assertRestored();

  h.handle.pause(false);
  t.mock.timers.tick(h.wait);
  assert.equal(h.effects[0]!.running, true);
  const lateBurst = h.scheduled.at(-1)!.callback;
  h.handle.pause(true);
  h.assertRestored();
  assert.equal(h.timers.size, 0);
  lateBurst();
  assert.equal(h.timers.size, 0);
  assert.equal(
    h.effects.reduce((sum, effect) => sum + effect.starts, 0),
    1,
  );
  h.handle.pause(false);
  t.mock.timers.tick(h.wait - 1);
  h.assertRestored();
  t.mock.timers.tick(1);
  assert.equal(h.effects[1]!.running, true, 'resume proceeds to the next line normally');
  assert.equal(h.effects.filter((effect) => effect.running).length, 1);
});

for (const phase of ['waiting', 'scrambling']) {
  test(`abort while ${phase} clears every timer, stops every instance and ignores late callbacks`, (t) => {
    const h = createHarness(t);
    h.handle.pause(false);
    if (phase === 'scrambling') t.mock.timers.tick(h.wait);
    const lateCallbacks = h.scheduled.map(({ callback }) => callback);
    const beforeAbort = h.effects.map((effect) => effect.stops);
    h.controller.abort();
    h.assertDisposed();
    h.assertRestored();
    assert.deepEqual(
      h.effects.map((effect) => effect.stops),
      beforeAbort.map((count) => count + 1),
    );
    h.handle.dispose();
    h.handle.dispose();
    assert.deepEqual(
      h.effects.map((effect) => effect.stops),
      beforeAbort.map((count) => count + 1),
    );
    const starts = h.effects.map((effect) => effect.starts);
    for (const callback of lateCallbacks) callback();
    h.handle.pause(false);
    t.mock.timers.tick(100_000);
    assert.deepEqual(
      h.effects.map((effect) => effect.starts),
      starts,
    );
    h.assertDisposed();
    h.assertRestored();
  });
}

test('explicit disposal is idempotent and detaches its abort listener before the signal fires', (t) => {
  const h = createHarness(t);
  h.handle.pause(false);
  t.mock.timers.tick(h.wait);
  h.handle.dispose();
  h.assertDisposed();
  h.assertRestored();
  const stops = h.effects.map((effect) => effect.stops);
  h.handle.dispose();
  h.controller.abort();
  h.handle.pause(false);
  t.mock.timers.tick(100_000);
  assert.deepEqual(
    h.effects.map((effect) => effect.stops),
    stops,
  );
  h.assertDisposed();
});

test('an initially aborted signal creates no DOM, baffle instance or timer', (t) => {
  const h = createHarness(t, false, true);
  assert.equal(h.created(), 0);
  assert.equal(h.effects.length, 0);
  h.handle.pause(false);
  h.handle.dispose();
  t.mock.timers.tick(100_000);
  h.assertDisposed();
});
