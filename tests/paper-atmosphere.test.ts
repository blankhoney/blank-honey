import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
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

test('paper handle mounts in its host, freezes outgoing layout and releases observers and listeners', () => {
  class ElementStub {
    className = '';
    hidden = false;
    dataset: Record<string, string> = {};
    properties = new Map<string, string>();
    attributes = new Map<string, string>();
    style = {
      left: '',
      width: '',
      setProperty: (key: string, value: string) => this.properties.set(key, value),
    };
    children: ElementStub[] = [];
    parent?: ElementStub;
    bounds = { left: 0, right: 1280 };
    measurements = 0;
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
    append(...children: ElementStub[]) {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
    }
    remove() {
      if (this.parent) {
        this.parent.children = this.parent.children.filter((child) => child !== this);
        this.parent = undefined;
      }
    }
    getBoundingClientRect() {
      this.measurements++;
      return this.bounds;
    }
    getClientRects() {
      return [this.bounds];
    }
  }
  const reading = new ElementStub();
  reading.bounds = { left: 300, right: 980 };
  const main = Object.assign(new ElementStub(), {
    querySelector: (selector: string) => {
      assert.ok(
        ['.reading-column', '.journal', '.article-toc-rail', '.reading-page > .back'].includes(
          selector,
        ),
      );
      return selector === '.reading-column' ? reading : null;
    },
  });
  const body = new ElementStub();
  const host = new ElementStub();
  let created = 0;
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    body,
    documentElement: { clientWidth: 1280, dataset: { tone: 'light' } },
    querySelector: (selector: string) => {
      assert.equal(selector, '#main');
      return main;
    },
    createElement: (tag: string) => {
      assert.ok(['div', 'span'].includes(tag));
      created++;
      return new ElementStub();
    },
    createElementNS: (namespace: string, tag: string) => {
      assert.equal(namespace, 'http://www.w3.org/2000/svg');
      assert.ok(['svg', 'path'].includes(tag));
      created++;
      return new ElementStub();
    },
  });
  const observers: ResizeObserverStub[] = [];
  class ResizeObserverStub {
    disconnects = 0;
    readonly observed: ElementStub[] = [];
    constructor(public update: () => void) {
      observers.push(this);
    }
    observe(element: ElementStub) {
      this.observed.push(element);
    }
    disconnect() {
      this.disconnects++;
      this.observed.length = 0;
    }
  }
  const window = new EventTarget();
  let reduced = false;
  const globals: Record<string, unknown> = {
    document,
    window,
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
  const secondController = new AbortController();
  try {
    assert.equal(
      mountPaperAtmosphere(AbortSignal.abort(), host as unknown as HTMLElement),
      undefined,
    );
    assert.equal(created, 0, 'a pre-aborted mount creates no elements');
    const handle = mountPaperAtmosphere(controller.signal, host as unknown as HTMLElement);
    assert.ok(handle);
    assert.equal(body.children.length, 0, 'an explicit host takes precedence over document.body');
    assert.equal(host.children.length, 1);
    const layer = host.children[0]!;
    assert.equal(handle.element, layer as unknown as HTMLElement);
    assert.equal(layer.className, 'paper-atmosphere');
    assert.equal(layer.attributes.get('aria-hidden'), 'true');
    assert.equal(layer.dataset.tone, 'light');
    assert.equal(layer.dataset.paused, 'false');
    assert.deepEqual(observers[0]!.observed, [main, reading]);
    assert.equal(getEventListeners(document, 'visibilitychange').length, 1);
    assert.equal(getEventListeners(window, 'resize').length, 1);
    assert.equal(layer.children[0]!.style.width, '294px');
    assert.equal(
      layer.children.flatMap((band) => band.children).filter((leaf) => !leaf.hidden).length,
      10,
    );

    handle.pause(true);
    assert.equal(layer.dataset.paused, 'true');
    const frozenMeasurements = [main.measurements, reading.measurements];
    globalThis.innerWidth = 390;
    document.documentElement.clientWidth = 390;
    main.bounds = { left: 0, right: 230 };
    reading.bounds = { left: 24, right: 206 };
    observers[0]!.update();
    window.dispatchEvent(new Event('resize'));
    assert.deepEqual([main.measurements, reading.measurements], frozenMeasurements);
    assert.equal(
      layer.children[0]!.style.width,
      '294px',
      'held outgoing pixels keep their old layout',
    );
    assert.equal(layer.dataset.mode, 'full');

    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    handle.pause(false);
    assert.equal(
      layer.dataset.paused,
      'true',
      'resuming a hidden page must not restart CSS animation',
    );
    assert.equal(layer.dataset.mode, 'light');
    assert.equal(layer.children[0]!.style.width, '18px');
    assert.equal(layer.children[1]!.style.left, '212px');
    assert.equal(
      layer.children.flatMap((band) => band.children).filter((leaf) => !leaf.hidden).length,
      4,
    );
    document.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(
      layer.dataset.paused,
      'false',
      'provider visibility resumes independently of the owner',
    );
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(layer.dataset.paused, 'true');
    handle.pause(true);
    document.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(layer.dataset.paused, 'true', 'visibility cannot override an owner pause');
    handle.pause(false);
    assert.equal(layer.dataset.paused, 'false');

    controller.abort();
    assert.equal(host.children.length, 0);
    assert.equal(layer.parent, undefined);
    assert.equal(observers[0]!.disconnects, 1);
    assert.equal(observers[0]!.observed.length, 0);
    assert.equal(getEventListeners(document, 'visibilitychange').length, 0);
    assert.equal(getEventListeners(window, 'resize').length, 0);
    const measurements = [main.measurements, reading.measurements];
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('resize'));
    observers[0]!.update();
    handle.pause(false);
    handle.dispose();
    handle.dispose();
    assert.deepEqual([main.measurements, reading.measurements], measurements);
    assert.equal(
      layer.dataset.paused,
      'false',
      'late visibility and observer callbacks cannot write after disposal',
    );
    assert.equal(observers[0]!.disconnects, 1);

    document.hidden = false;
    const second = mountPaperAtmosphere(secondController.signal);
    assert.ok(second);
    assert.equal(body.children.length, 1, 'the existing body fallback remains supported');
    assert.equal(observers.length, 2);
    second.dispose();
    second.dispose();
    secondController.abort();
    assert.equal(body.children.length, 0);
    assert.equal(observers[1]!.disconnects, 1);
    assert.equal(observers[1]!.observed.length, 0);
    assert.equal(getEventListeners(document, 'visibilitychange').length, 0);
    assert.equal(getEventListeners(window, 'resize').length, 0);

    reduced = true;
    const beforeReduced = created;
    assert.equal(mountPaperAtmosphere(new AbortController().signal), undefined);
    assert.equal(created, beforeReduced);
    assert.equal(body.children.length, 0);
    assert.equal(host.children.length, 0);
    assert.ok(observers.every((observer) => observer.disconnects === 1));
  } finally {
    controller.abort();
    secondController.abort();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
