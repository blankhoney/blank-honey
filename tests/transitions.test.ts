import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { tsParticles, type Container } from '@tsparticles/engine';
import { initTransitions } from '../src/client/transitions';

test('cohorts rebuild after async content resize, stay stable, and disconnect on navigation', async (t) => {
  let bounds = { left: 20, top: 100, width: 600, height: 80 };
  const anchor = { dataset: { cohort: 'frame' }, getBoundingClientRect: () => ({ ...bounds }) };
  const layers: { style: Record<string, string>; remove: () => void }[] = [];
  const observers: Observer[] = [];
  class Observer {
    connected = false;
    constructor(readonly callback: () => void) {
      observers.push(this);
    }
    observe() {
      this.connected = true;
      queueMicrotask(this.callback);
    }
    disconnect() {
      this.connected = false;
    }
  }
  const stage = {
    append(layer: (typeof layers)[number]) {
      layers.push(layer);
    },
    replaceChildren() {
      layers.length = 0;
    },
  };
  const document = Object.assign(new EventTarget(), {
    documentElement: { dataset: { family: 'terminal' } },
    querySelectorAll: () => [anchor],
    querySelector: (selector: string) => (selector === '#fx-stage' ? stage : anchor),
    createElement: () => {
      const layer = {
        style: {},
        remove() {
          const index = layers.indexOf(layer);
          if (index >= 0) layers.splice(index, 1);
        },
      };
      return layer;
    },
  });
  let destroyed = 0;
  t.mock.method(
    tsParticles,
    'load',
    async () =>
      ({
        canvas: { size: { width: bounds.width, height: bounds.height } },
        particles: { addParticle() {} },
        draw() {},
        destroy() {
          destroyed++;
        },
      }) as unknown as Container,
  );
  const globals = {
    document,
    window: new EventTarget(),
    ResizeObserver: Observer,
    matchMedia: () => ({ matches: false }),
    innerWidth: 1200,
    getComputedStyle: () => ({ font: '16px sans-serif', color: '#fff' }),
  };
  const saved = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  async function settled(count: number) {
    for (let attempt = 0; attempt < 50 && observers.length < count; attempt++) await delay(10);
    assert.equal(observers.length, count);
  }
  try {
    initTransitions();
    document.dispatchEvent(new Event('astro:page-load'));
    await settled(1);
    assert.equal(layers[0].style.height, '80px');
    bounds = { ...bounds, height: 420 };
    observers[0].callback();
    await settled(2);
    assert.equal(layers.length, 1);
    assert.equal(layers[0].style.height, '420px');
    assert.equal(observers[0].connected, false);
    assert.equal(destroyed, 1);
    observers[1].callback();
    await delay(20);
    assert.equal(observers.length, 2, 'unchanged size must not trigger a rebuild loop');
    document.dispatchEvent(new Event('astro:before-preparation'));
    observers[1].callback();
    await delay(20);
    assert.equal(observers[1].connected, false);
    assert.equal(layers.length, 0);
    assert.equal(destroyed, 2);
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
