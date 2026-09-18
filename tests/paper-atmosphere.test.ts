import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  leavesPerGutter,
  mountPaperAtmosphere,
  paperGutters,
} from '../src/client/paper-atmosphere';

test('paper gutters follow the reading column, displaced TOC and open mobile sidebar', () => {
  assert.deepEqual(
    paperGutters(1440, { left: 0, right: 1160 }, [
      { left: 235, right: 925 },
      { left: 30, right: 200 },
    ]),
    [
      { left: 0, width: 24 },
      { left: 931, width: 229 },
    ],
  );
  assert.deepEqual(paperGutters(390, { left: 0, right: 230 }, [{ left: 24, right: 206 }]), [
    { left: 0, width: 18 },
    { left: 212, width: 18 },
  ]);
  for (const quiet of [[], [{ left: -50, right: 1700 }], [{ left: 0, right: 0 }]]) {
    const gutters = paperGutters(390, { left: 0, right: 390 }, quiet);
    assert.ok(gutters.every((gutter) => gutter.width === 0));
  }
  for (const gutter of paperGutters(390, { left: -10, right: 450 }, [{ left: 100, right: 290 }])) {
    assert.ok(gutter.left >= 0 && gutter.width >= 0);
    assert.ok(gutter.left + gutter.width <= 390);
  }
});

test('leaf budget has a genuine motion-free mode and a smaller mobile budget', () => {
  assert.equal(leavesPerGutter('full'), 5);
  assert.equal(leavesPerGutter('light'), 2);
  assert.equal(leavesPerGutter('reduced-motion'), 0);
  // A late dynamic import must not create a layer for the route that was just left.
  assert.doesNotThrow(() => mountPaperAtmosphere(AbortSignal.abort()));
});

test('paper atmosphere pauses, adapts to layout and disposes every observer and listener', () => {
  class ElementStub {
    id = '';
    className = '';
    hidden = false;
    dataset: Record<string, string> = {};
    properties = new Map<string, string>();
    style = {
      left: '',
      width: '',
      setProperty: (key: string, value: string) => this.properties.set(key, value),
    };
    children: ElementStub[] = [];
    parent?: ElementStub;
    bounds = { left: 0, right: 1280 };
    setAttribute() {}
    append(...children: ElementStub[]) {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
    }
    remove() {
      if (this.parent)
        this.parent.children = this.parent.children.filter((child) => child !== this);
    }
    getBoundingClientRect() {
      return this.bounds;
    }
    getClientRects() {
      return [this.bounds];
    }
  }
  const reading = new ElementStub();
  reading.bounds = { left: 300, right: 980 };
  const main = Object.assign(new ElementStub(), {
    querySelector: (selector: string) => (selector === '.reading-column' ? reading : null),
  });
  const body = new ElementStub();
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    body,
    documentElement: { clientWidth: 1280 },
    querySelector: () => main,
    createElement: () => new ElementStub(),
    createElementNS: () => new ElementStub(),
  });
  let observer: { update: () => void; disconnected: boolean } | undefined;
  class ResizeObserverStub {
    disconnected = false;
    constructor(public update: () => void) {
      observer = this;
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  }
  let reduced = false;
  const globals: Record<string, unknown> = {
    document,
    window: new EventTarget(),
    ResizeObserver: ResizeObserverStub,
    matchMedia: () => ({ matches: reduced }),
    localStorage: { getItem: () => null },
    innerWidth: 1280,
    navigator: {},
  };
  const saved = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const controller = new AbortController();
  try {
    mountPaperAtmosphere(controller.signal);
    assert.equal(body.children.length, 1);
    const layer = body.children[0];
    assert.equal(layer.id, 'paper-atmosphere');
    assert.equal(layer.dataset.paused, 'false');
    assert.equal(
      layer.children.flatMap((band) => band.children).filter((leaf) => !leaf.hidden).length,
      10,
    );
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(layer.dataset.paused, 'true');

    globalThis.innerWidth = 390;
    document.documentElement.clientWidth = 390;
    main.bounds = { left: 0, right: 230 };
    reading.bounds = { left: 24, right: 206 };
    observer!.update();
    assert.equal(layer.dataset.mode, 'light');
    assert.equal(layer.children[0].style.width, '18px');
    assert.equal(layer.children[1].style.left, '212px');
    assert.equal(
      layer.children.flatMap((band) => band.children).filter((leaf) => !leaf.hidden).length,
      4,
    );

    controller.abort();
    assert.equal(body.children.length, 0);
    assert.equal(observer!.disconnected, true);
    document.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(
      layer.dataset.paused,
      'true',
      'the visibility listener was removed with its layer',
    );
    reduced = true;
    mountPaperAtmosphere(new AbortController().signal);
    assert.equal(body.children.length, 0);
  } finally {
    controller.abort();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
