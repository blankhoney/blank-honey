import assert from 'node:assert/strict';
import { setMaxListeners } from 'node:events';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mountReadingMotion, readingFrame } from '../src/client/reading-motion';

/* ---------- DOM doubles -------------------------------------------------- */

type Bounds = { top: number; height: number };

/** Shared document-space state; the element doubles read scrollY from here. */
const page = { scrollY: 0 };

class StyleStub {
  readonly values = new Map<string, string>();
  setProperty(name: string, value: string) {
    this.values.set(name, value);
  }
  getPropertyValue(name: string) {
    return this.values.get(name) ?? '';
  }
  removeProperty(name: string) {
    this.values.delete(name);
  }
}

class ElementStub extends EventTarget {
  readonly attributes = new Map<string, string>();
  readonly style = new StyleStub();
  readonly children: ElementStub[] = [];
  parent: ElementStub | undefined;
  id = '';
  className = '';
  hidden = false;
  layout: Bounds;
  measurements = 0;
  measureError: Error | undefined;
  /** Real CSS forces `translate: none` while :focus-within or :target protection applies. */
  protectedByCss = false;

  constructor(
    readonly tagName: string,
    layout: Bounds,
    className = '',
  ) {
    super();
    this.layout = layout;
    this.className = className;
  }

  get classList() {
    return this.className.split(/\s+/).filter(Boolean);
  }

  /** What the previous frame asked for; cleared to 0 when CSS protects the block. */
  get translateShift() {
    if (this.protectedByCss) return 0;
    const value = this.style.getPropertyValue('--reading-y');
    return value ? parseFloat(value) || 0 : 0;
  }

  /** The used value of `translate: 0 var(--reading-y, 0px)`. */
  get computedTranslate() {
    return this.protectedByCss
      ? 'none'
      : `0px ${this.style.getPropertyValue('--reading-y') || '0px'}`;
  }

  /** The rect already includes the translate the stylesheet applied. */
  getBoundingClientRect() {
    this.measurements++;
    if (this.measureError) throw this.measureError;
    const top = this.layout.top - page.scrollY + this.translateShift;
    return {
      top,
      height: this.layout.height,
      bottom: top + this.layout.height,
      left: 0,
      width: 640,
      right: 640,
    };
  }

  append(...items: ElementStub[]) {
    for (const item of items) {
      item.parent = this;
      this.children.push(item);
    }
  }

  contains(node: ElementStub | null | undefined): boolean {
    for (
      let current: ElementStub | undefined = node ?? undefined;
      current;
      current = current.parent
    ) {
      if (current === this) return true;
    }
    return false;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  marker() {
    return this.attributes.has('data-reading-motion');
  }
  opacity() {
    return this.style.getPropertyValue('--reading-opacity') || undefined;
  }
  y() {
    return this.style.getPropertyValue('--reading-y') || undefined;
  }
  clean() {
    return !this.marker() && this.opacity() === undefined && this.y() === undefined;
  }

  querySelector(selector: string) {
    if (selector === '.prose')
      return this.children.find((child) => child.className === 'prose') ?? null;
    assert.equal(selector, ':scope > header');
    return this.children.find((child) => child.tagName === 'HEADER') ?? null;
  }
}

function descendants(root: { children: ElementStub[] }): ElementStub[] {
  const found: ElementStub[] = [];
  const walk = (items: ElementStub[]) => {
    for (const item of items) {
      found.push(item);
      walk(item.children);
    }
  };
  walk(root.children);
  return found;
}

class DocumentStub extends EventTarget {
  hidden = false;
  activeElement: ElementStub | null = null;
  selection: { isCollapsed: boolean } | null = { isCollapsed: true };
  readonly children: ElementStub[] = [];
  readonly reads: string[] = [];

  querySelector(selector: string) {
    this.reads.push(selector);
    assert.equal(selector, '#main[data-article] .reading-column');
    const main = this.children.find(
      (child) => child.id === 'main' && child.hasAttribute('data-article'),
    );
    return main?.children.find((child) => child.className === 'reading-column') ?? null;
  }
  getElementById(id: string) {
    this.reads.push(`#${id}`);
    return id ? (descendants(this).find((el) => el.id === id) ?? null) : null;
  }
  getSelection() {
    return this.selection;
  }
}

/* ---------- harness ------------------------------------------------------ */

type BlockSpec = { id?: string; tag?: string; top: number; height: number };

type HarnessOptions = {
  /** First entry is the article header, the rest are `.prose` children. */
  specs?: BlockSpec[];
  /** false leaves `#main` without `data-article`, so the article selector misses. */
  article?: boolean;
  /** false removes `.reading-column` from the DOM. */
  column?: boolean;
  /** false leaves IntersectionObserver/ResizeObserver undefined. */
  observers?: boolean;
  viewportHeight?: number;
  innerWidth?: number;
};

const defaultSpecs: BlockSpec[] = [
  { tag: 'HEADER', top: 160, height: 120 },
  { top: 200, height: 200 },
  { top: -65, height: 200 },
  { top: 2000, height: 300 },
];

class IoRecord {
  targets: ElementStub[] = [];
  disconnected = false;
  constructor(
    readonly callback: (entries: Array<{ target: ElementStub; isIntersecting: boolean }>) => void,
    readonly options?: { rootMargin?: string },
  ) {}
  observe(target: ElementStub) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

class RoRecord {
  targets: ElementStub[] = [];
  disconnected = false;
  constructor(readonly callback: () => void) {}
  observe(target: ElementStub) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

/** `pageshow` carries `persisted` on the event, which a plain Event cannot express. */
class PersistedEvent extends Event {
  constructor(
    type: string,
    readonly persisted: boolean,
  ) {
    super(type);
  }
}

function createHarness(options: HarnessOptions = {}) {
  const specs = options.specs ?? defaultSpecs;
  const document = new DocumentStub();
  const main = new ElementStub('MAIN', { top: 0, height: 10000 });
  main.id = 'main';
  if (options.article !== false) main.setAttribute('data-article', '');
  document.children.push(main);

  const article = new ElementStub('ARTICLE', { top: 0, height: 10000 }, 'reading-column');
  const header = new ElementStub(specs[0].tag ?? 'HEADER', {
    top: specs[0].top,
    height: specs[0].height,
  });
  if (specs[0].id) header.id = specs[0].id;
  const prose = new ElementStub('DIV', { top: 0, height: 10000 }, 'prose');
  article.append(header, prose);
  if (options.column !== false) main.append(article);

  const blocks = [header];
  for (const spec of specs.slice(1)) {
    const paragraph = new ElementStub(spec.tag ?? 'P', { top: spec.top, height: spec.height });
    if (spec.id) paragraph.id = spec.id;
    prose.append(paragraph);
    blocks.push(paragraph);
  }

  const io: IoRecord[] = [];
  const ro: RoRecord[] = [];
  const flags = { failObserve: false };
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;

  class IntersectionObserverStub extends IoRecord {
    constructor(callback: IoRecord['callback'], observerOptions?: { rootMargin?: string }) {
      super(callback, observerOptions);
      if (flags.failObserve) throw new Error('observe failed');
      io.push(this);
    }
  }
  class ResizeObserverStub extends RoRecord {
    constructor(callback: () => void) {
      super(callback);
      ro.push(this);
    }
  }

  const globals: Record<string, unknown> = {
    document,
    window: new EventTarget(),
    IntersectionObserver: options.observers === false ? undefined : IntersectionObserverStub,
    ResizeObserver: options.observers === false ? undefined : ResizeObserverStub,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      frames.delete(id);
    },
    getComputedStyle: (el: ElementStub) => ({ translate: el.computedTranslate }),
    HTMLElement: ElementStub,
    location: { hash: '' },
    matchMedia: (query: string) => ({ matches: false, media: query }),
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    },
    navigator: {},
    innerWidth: options.innerWidth ?? 1024,
  };
  const stored = new Map<string, string>();
  const saved = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const savedScrollY = Object.getOwnPropertyDescriptor(globalThis, 'scrollY');
  const savedInnerHeight = Object.getOwnPropertyDescriptor(globalThis, 'innerHeight');

  page.scrollY = 0;
  Object.defineProperty(globalThis, 'scrollY', {
    configurable: true,
    get: () => page.scrollY,
  });
  Object.defineProperty(globalThis, 'innerHeight', {
    configurable: true,
    get: () => viewportHeight,
  });
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }

  let viewportHeight = options.viewportHeight ?? 900;
  const controller = new AbortController();
  // The module attaches one listener per page event to the same signal.
  setMaxListeners(0, controller.signal);

  const harness = {
    document,
    main,
    article,
    prose,
    header,
    blocks,
    io,
    ro,
    flags,
    controller,
    get domReads() {
      return document.reads;
    },
    get frames() {
      return frames;
    },
    mount(signal: AbortSignal = controller.signal) {
      mountReadingMotion(signal);
    },
    flush() {
      for (const [id, callback] of [...frames]) {
        frames.delete(id);
        callback(performance.now());
      }
    },
    fireWindow(type: string, event?: Event) {
      (globals.window as EventTarget).dispatchEvent(event ?? new Event(type));
    },
    fireDocument(type: string, event?: Event) {
      document.dispatchEvent(event ?? new Event(type));
    },
    /** Feeds the newest observer callback the way the browser would. */
    observe(entries: Array<{ target: ElementStub; isIntersecting: boolean }>) {
      const observer = io[io.length - 1];
      assert.ok(observer, 'no IntersectionObserver was created');
      observer.callback(entries);
    },
    setScroll(y: number) {
      page.scrollY = y;
    },
    setViewport(height: number) {
      viewportHeight = height;
    },
    setMotion(mode: 'full' | 'light' | 'reduced-motion') {
      if (mode === 'full') stored.delete('bh:motion');
      else stored.set('bh:motion', mode);
    },
    setHash(hash: string) {
      (globals.location as { hash: string }).hash = hash;
    },
    setSelection(collapsed: boolean | null) {
      document.selection = collapsed === null ? null : { isCollapsed: collapsed };
    },
    focus(el: ElementStub | null) {
      document.activeElement = el;
    },
    /** Mirrors the stylesheet forcing `translate: none` for :focus-within / :target. */
    protect(el: ElementStub, on: boolean) {
      el.protectedByCss = on;
    },
    dispose() {
      controller.abort();
      frames.clear();
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      if (savedScrollY) Object.defineProperty(globalThis, 'scrollY', savedScrollY);
      else Reflect.deleteProperty(globalThis, 'scrollY');
      if (savedInnerHeight) Object.defineProperty(globalThis, 'innerHeight', savedInnerHeight);
      else Reflect.deleteProperty(globalThis, 'innerHeight');
    },
  };
  return harness;
}

function closeTo(actual: number, expected: number, digits = 6) {
  assert.equal(actual.toFixed(digits), expected.toFixed(digits));
}

/* ---------- 1. pure geometry -------------------------------------------- */

test('readingFrame has visible in-viewport entry and exit bands with a clear center', () => {
  const samples = [
    { top: 940, opacity: 0, y: 28 },
    { top: 830, opacity: 0.5, y: 14 },
    { top: 720, opacity: 1, y: 0 },
    { top: 300, opacity: 1, y: 0 },
    { top: 30, opacity: 0.5, y: -14 },
    { top: -80, opacity: 0, y: -28 },
  ];
  for (const { top, opacity, y } of samples) {
    const frame = readingFrame(top, 120, 1000);
    closeTo(frame.opacity, opacity);
    closeTo(frame.translateY, y);
  }

  const below = readingFrame(2000, 200, 1000);
  closeTo(below.opacity, 0);
  closeTo(below.translateY, 28);
  const above = readingFrame(-400, 200, 1000);
  closeTo(above.opacity, 0);
  closeTo(above.translateY, -28);
});

/* ---------- 2. purity --------------------------------------------------- */

test('the same geometry yields the same frame whether the reader moves forward or back', () => {
  const first = readingFrame(830, 120, 1000);
  // An unrelated geometry in between proves the result is recomputed, not remembered.
  readingFrame(2000, 120, 1000);
  readingFrame(-400, 120, 1000);
  const again = readingFrame(830, 120, 1000);
  assert.deepEqual(again, first);

  const mirrored = readingFrame(30, 120, 1000);
  const back = readingFrame(30, 120, 1000);
  assert.deepEqual(back, mirrored);
  assert.ok(
    Object.is(back.opacity, mirrored.opacity) && Object.is(back.translateY, mirrored.translateY),
  );

  // Scaling distance scales the shift only, never the opacity.
  assert.equal(readingFrame(830, 120, 1000, 18).opacity, first.opacity);
});

/* ---------- 3. band and degenerate geometry ------------------------------ */

test('short, tall, degenerate and light-mode geometries stay readable', () => {
  // Short headings retain the same visible 22%-viewport band as paragraphs.
  const short = readingFrame(830, 20, 1000);
  closeTo(short.opacity, 0.5);
  closeTo(short.translateY, 14);
  const shortLight = readingFrame(830, 20, 1000, 18);
  closeTo(shortLight.opacity, 0.5);
  closeTo(shortLight.translateY, 9);
  closeTo(readingFrame(30, 120, 1000, 18).translateY, -9);
  closeTo(readingFrame(720, 20, 1000).opacity, 1);
  closeTo(readingFrame(720, 20, 1000).translateY, 0);

  const tall = readingFrame(-500, 2000, 1000);
  closeTo(tall.opacity, 1);
  closeTo(tall.translateY, 0);

  for (const geometry of [
    [0, 0, 900],
    [0, -1, 900],
    [200, 200, 0],
    [200, 200, -900],
    [NaN, 200, 900],
    [200, NaN, 900],
    [200, 200, NaN],
    [Infinity, 200, 900],
    [200, Infinity, 900],
    [200, 200, Infinity],
    [200, 200, 900, NaN],
    [200, 200, 900, Infinity],
  ] as number[][]) {
    const frame = (readingFrame as (...args: number[]) => { opacity: number; translateY: number })(
      ...geometry,
    );
    closeTo(frame.opacity, 1, 9);
    closeTo(frame.translateY, 0, 9);
  }

  for (const distance of [-12, 0]) {
    const frame = readingFrame(830, 120, 1000, distance);
    closeTo(frame.opacity, 0.5);
    closeTo(frame.translateY, 0);
  }
});

/* ---------- 4. aborted and non-article pages ----------------------------- */

test('an aborted signal reads nothing and a non-article page is never hidden', () => {
  const aborted = createHarness();
  try {
    aborted.mount(AbortSignal.abort());
    assert.deepEqual(aborted.domReads, []);
    assert.equal(aborted.io.length, 0);
    for (const block of aborted.blocks) assert.equal(block.clean(), true);
  } finally {
    aborted.dispose();
  }

  for (const options of [
    { article: false },
    { column: false },
    { observers: false },
  ] as HarnessOptions[]) {
    const harness = createHarness(options);
    try {
      harness.mount();
      for (const block of harness.blocks) {
        assert.equal(block.marker(), false, 'plain article content must never be hidden');
        assert.equal(block.opacity(), undefined);
      }
      assert.equal(harness.io.length, 0);
      assert.equal(harness.frames.size, 0);
      harness.fireWindow('scroll');
      harness.fireWindow('resize');
      assert.equal(harness.frames.size, 0);
    } finally {
      harness.dispose();
    }
  }
});

/* ---------- 5. first frame and coalescing -------------------------------- */

test('nothing is hidden before the first measurement frame, and scrolls coalesce into one', () => {
  const harness = createHarness();
  try {
    harness.mount();
    assert.equal(harness.frames.size, 1, 'the mount pass is deferred to one animation frame');
    for (const block of harness.blocks) {
      assert.equal(block.clean(), true, 'no marker may exist before the first measurement');
    }

    harness.flush();
    assert.equal(harness.frames.size, 0);
    // The header and the block at 200 occupy the clear reading band. The next block's
    // bottom is at 15% of the viewport, half faded; the far block is out of view below.
    assert.equal(harness.blocks[0].opacity(), '1.0000');
    assert.equal(harness.blocks[0].y(), '0.000px');
    assert.equal(harness.blocks[1].opacity(), '1.0000');
    assert.equal(harness.blocks[2].opacity(), '0.5000');
    assert.equal(harness.blocks[2].y(), '-14.000px');
    assert.equal(harness.blocks[3].opacity(), '0.0000');
    assert.equal(harness.blocks[3].y(), '28.000px');

    for (let step = 1; step <= 5; step++) {
      harness.setScroll(step * 12);
      harness.fireWindow('scroll');
    }
    assert.equal(harness.frames.size, 1, 'continuous scrolling queues at most one frame');
    harness.flush();
    assert.equal(harness.frames.size, 0, 'an idle page keeps no pending frame');
  } finally {
    harness.dispose();
  }
});

/* ---------- 6. intersection set ----------------------------------------- */

test('the intersection set scopes a frame to nearby blocks and keeps the final exit', () => {
  const harness = createHarness({
    specs: [defaultSpecs[0], { top: 200, height: 200 }, { top: 4000, height: 300 }],
  });
  try {
    harness.mount();
    harness.flush();
    const near = harness.blocks[1];
    const far = harness.blocks[2];
    assert.equal(far.opacity(), '0.0000', 'the first pass measures every block');
    assert.equal(harness.io.length, 1);
    assert.equal(harness.io[0].options?.rootMargin, '128px 0px');
    assert.deepEqual(harness.io[0].targets, harness.blocks);

    // A block the observer never reported keeps its last value, even after its layout moves.
    const measured = far.measurements;
    far.layout.top = 200;
    harness.fireWindow('scroll');
    harness.flush();
    assert.equal(far.measurements, measured);
    assert.equal(far.opacity(), '0.0000');

    // A fast jump into the viewport is corrected on the frame that follows the report.
    harness.observe([{ target: far, isIntersecting: true }]);
    assert.equal(harness.frames.size, 1);
    harness.flush();
    assert.equal(far.opacity(), '1.0000');
    assert.equal(far.y(), '0.000px');

    // Leaving the root margin still needs one last offscreen update.
    const nearBefore = near.measurements;
    harness.fireWindow('scroll');
    harness.flush();
    assert.equal(near.measurements, nearBefore, 'an un-reported scroll frame measures nothing');
    near.layout.top = -1000;
    harness.observe([{ target: near, isIntersecting: false }]);
    harness.flush();
    assert.equal(near.opacity(), '0.0000');
    assert.equal(near.y(), '-28.000px');
  } finally {
    harness.dispose();
  }
});

/* ---------- 7. no feedback, stable repeats ------------------------------- */

test('the written translate is subtracted again, so repeated frames stay stable', () => {
  const harness = createHarness({ specs: [defaultSpecs[0], { top: 747, height: 20 }] });
  try {
    harness.mount();
    harness.flush();
    const edge = harness.blocks[1];
    assert.equal(edge.opacity(), '0.5000');
    assert.equal(edge.y(), '14.000px');

    // The double mirrors the stylesheet: the rect includes the translate just written.
    for (let repeat = 0; repeat < 3; repeat++) {
      harness.fireWindow('resize');
      harness.flush();
      assert.equal(edge.opacity(), '0.5000', 'the same layout top keeps the same opacity');
      assert.equal(edge.y(), '14.000px', 'the shift must not accumulate across frames');
    }

    // A stale translate from a protected frame must be subtracted, not added on top.
    edge.style.setProperty('--reading-y', '50.000px');
    harness.fireWindow('resize');
    harness.flush();
    assert.equal(edge.opacity(), '0.5000');
    assert.equal(edge.y(), '14.000px');
  } finally {
    harness.dispose();
  }
});

/* ---------- 8. reduced motion ------------------------------------------- */

test('reduced motion never observes, and every later transition is disposed cleanly', () => {
  const harness = createHarness();
  try {
    harness.setMotion('reduced-motion');
    harness.mount();
    assert.equal(harness.io.length, 0, 'reduced motion must not observe');
    assert.equal(harness.ro.length, 0);
    assert.equal(harness.frames.size, 0);
    for (const block of harness.blocks) assert.equal(block.clean(), true);

    // The site preference turns motion back on: the module re-arms from the page event.
    harness.setMotion('full');
    harness.fireDocument('bh:motion');
    assert.equal(harness.io.length, 1);
    assert.equal(harness.ro.length, 1);
    assert.equal(harness.frames.size, 1);
    harness.flush();
    assert.equal(harness.blocks[2].opacity(), '0.5000');
    const armed = harness.io[0];

    // Turning it off again clears every attribute, private property and observer.
    harness.setMotion('reduced-motion');
    harness.fireDocument('bh:motion');
    assert.equal(armed.disconnected, true);
    assert.equal(harness.ro[0].disconnected, true);
    for (const block of harness.blocks) assert.equal(block.clean(), true);

    armed.callback([{ target: harness.blocks[2], isIntersecting: true }]);
    harness.flush();
    assert.equal(harness.frames.size, 0, 'the stale observer callback cannot re-arm anything');
    assert.equal(harness.blocks[2].clean(), true);

    // A capability change reached through another frame also tears everything down.
    harness.setMotion('full');
    harness.fireDocument('bh:motion');
    harness.flush();
    assert.equal(harness.io.length, 2);
    harness.setMotion('reduced-motion');
    harness.fireWindow('resize');
    assert.equal(harness.frames.size, 1);
    harness.flush();
    assert.equal(harness.io[1].disconnected, true);
    for (const block of harness.blocks) assert.equal(block.clean(), true);
  } finally {
    harness.dispose();
  }
});

/* ---------- 9. focus, target and selection protection -------------------- */

test('focus, a hash target or a selection shows content whole, then hands it back to position', () => {
  const harness = createHarness();
  try {
    harness.mount();
    harness.flush();
    const edge = harness.blocks[2];
    assert.equal(edge.opacity(), '0.5000');

    // focusin from a node inside the block.
    const inside = new ElementStub('A', { top: -65, height: 20 });
    edge.append(inside);
    harness.focus(inside);
    harness.protect(edge, true);
    harness.fireDocument('focusin');
    assert.equal(harness.frames.size, 1);
    harness.flush();
    assert.equal(edge.opacity(), '1.0000');
    assert.equal(edge.y(), '0.000px');

    harness.focus(null);
    harness.protect(edge, false);
    harness.fireDocument('focusout');
    harness.flush();
    assert.equal(edge.opacity(), '0.5000', 'protection release returns the block to its position');
    assert.equal(edge.y(), '-14.000px');

    // hashchange with a percent-encoded fragment resolves an element inside a block.
    const far = harness.blocks[3];
    const anchor = new ElementStub('SPAN', { top: 2000, height: 20 });
    anchor.id = '第二节 说明';
    far.append(anchor);
    harness.setHash(`#${encodeURIComponent(anchor.id)}`);
    harness.protect(far, true);
    harness.fireWindow('hashchange');
    harness.flush();
    assert.equal(far.opacity(), '1.0000');
    assert.equal(far.y(), '0.000px');

    // A fragment that cannot be decoded must not disable readable content.
    harness.setHash('#%E0%A4%A');
    harness.protect(far, false);
    assert.doesNotThrow(() => harness.fireWindow('hashchange'));
    harness.flush();
    assert.equal(far.opacity(), '0.0000');
    assert.equal(far.y(), '28.000px');

    harness.setHash('');
    harness.fireWindow('hashchange');
    harness.flush();

    // A live selection shows every rendered block whole.
    harness.setSelection(false);
    harness.fireDocument('selectionchange');
    harness.flush();
    for (const block of harness.blocks) {
      assert.equal(block.opacity(), '1.0000');
      assert.equal(block.y(), '0.000px');
    }

    harness.setSelection(true);
    harness.fireDocument('selectionchange');
    harness.flush();
    assert.equal(harness.blocks[2].opacity(), '0.5000');
    assert.equal(harness.blocks[2].y(), '-14.000px');
    assert.equal(harness.blocks[3].opacity(), '0.0000');
  } finally {
    harness.dispose();
  }
});

/* ---------- 10. resize --------------------------------------------------- */

test('a resize re-measures every block and picks up the current motion distance', () => {
  const harness = createHarness({
    specs: [defaultSpecs[0], { top: 747, height: 20 }, { top: 200, height: 200 }],
  });
  try {
    harness.mount();
    harness.flush();
    const edge = harness.blocks[1];
    assert.equal(edge.y(), '14.000px');

    // A block that was fully inside the old viewport now straddles the new bottom edge.
    assert.equal(harness.blocks[2].opacity(), '1.0000');
    harness.setViewport(700);
    harness.setMotion('light');
    edge.layout.top = 581;
    harness.blocks[2].layout.top = 581;
    harness.ro[0].callback();
    assert.equal(harness.frames.size, 1);
    harness.flush();
    assert.equal(edge.y(), '9.000px', 'light mode uses the 18px distance');
    assert.equal(edge.opacity(), '0.5000');
    assert.equal(harness.blocks[2].opacity(), '0.5000', 'the changed geometry is re-measured');
    assert.equal(harness.blocks[2].y(), '9.000px');

    // Same geometry, full motion: only the distance changes.
    harness.setMotion('full');
    harness.fireWindow('resize');
    harness.flush();
    assert.equal(edge.opacity(), '0.5000');
    assert.equal(edge.y(), '14.000px');

    assert.ok(harness.ro[0].targets.includes(harness.prose), 'prose growth is observed');
    assert.ok(harness.ro[0].targets.includes(harness.header), 'header growth is observed');
    assert.ok(
      harness.ro[0].targets.includes(harness.article),
      'TOC reflow outside prose is observed',
    );
    edge.layout.top = 300;
    harness.ro[0].callback();
    harness.flush();
    assert.equal(edge.opacity(), '1.0000', 'position-only reflow restores a now-centered block');
  } finally {
    harness.dispose();
  }
});

/* ---------- 11. visibility and printing --------------------------------- */

test('hiding the tab cancels the frame and printing clears every style until it ends', () => {
  const harness = createHarness();
  try {
    harness.mount();
    harness.flush();
    const far = harness.blocks[3];
    harness.fireWindow('scroll');
    assert.equal(harness.frames.size, 1);

    harness.document.hidden = true;
    harness.fireDocument('visibilitychange');
    assert.equal(harness.frames.size, 0, 'a hidden tab cancels the queued frame');

    // Layout moved while hidden: coming back must re-measure everything, not only the
    // blocks the observer had reported.
    far.layout.top = 200;
    harness.document.hidden = false;
    harness.fireDocument('visibilitychange');
    assert.equal(harness.frames.size, 1);
    harness.flush();
    assert.equal(far.opacity(), '1.0000');

    harness.fireWindow('beforeprint');
    for (const block of harness.blocks) assert.equal(block.clean(), true);
    harness.fireWindow('scroll');
    harness.fireWindow('resize');
    assert.equal(harness.frames.size, 0, 'printing must never queue a frame');

    harness.fireWindow('afterprint');
    assert.equal(harness.frames.size, 1);
    harness.flush();
    assert.equal(harness.blocks[2].opacity(), '0.5000');
  } finally {
    harness.dispose();
  }
});

/* ---------- 12. abort, pagehide and pageshow ---------------------------- */

test('abort and pagehide release observers and frames, and late writes never land', () => {
  const harness = createHarness();
  try {
    harness.mount();
    harness.flush();
    const observer = harness.io[0];
    const resizer = harness.ro[0];
    harness.fireWindow('scroll');
    assert.equal(harness.frames.size, 1);

    harness.controller.abort();
    assert.equal(harness.frames.size, 0, 'the pending frame is cancelled');
    assert.equal(observer.disconnected, true);
    assert.equal(resizer.disconnected, true);
    assert.deepEqual(observer.targets, harness.blocks);
    for (const block of harness.blocks) assert.equal(block.clean(), true);

    // Late callbacks and page events from the dead mount must not write anything back.
    observer.callback([{ target: harness.blocks[1], isIntersecting: true }]);
    resizer.callback();
    harness.fireWindow('scroll');
    harness.fireDocument('visibilitychange');
    harness.fireWindow('beforeprint');
    harness.fireWindow('resize');
    assert.equal(harness.frames.size, 0);
    for (const block of harness.blocks) assert.equal(block.clean(), true);
  } finally {
    harness.dispose();
  }

  const revived = createHarness();
  try {
    revived.mount();
    revived.flush();
    const first = revived.io[0];
    assert.equal(revived.blocks[2].opacity(), '0.5000');
    revived.fireWindow('scroll');
    assert.equal(revived.frames.size, 1);

    revived.fireWindow('pagehide');
    assert.equal(revived.frames.size, 0);
    assert.equal(first.disconnected, true);
    assert.equal(revived.ro[0].disconnected, true);
    for (const block of revived.blocks) assert.equal(block.clean(), true);
    first.callback([{ target: revived.blocks[2], isIntersecting: true }]);
    revived.flush();
    assert.equal(revived.frames.size, 0);

    // A normal pageshow keeps the page as it is.
    revived.blocks[2].layout.top = 2000;
    revived.fireWindow('pageshow', new PersistedEvent('pageshow', false));
    assert.equal(revived.io.length, 1);

    // A restored page re-arms from scratch.
    revived.fireWindow('pageshow', new PersistedEvent('pageshow', true));
    assert.equal(revived.io.length, 2);
    assert.equal(revived.ro.length, 2);
    assert.equal(revived.blocks[2].clean(), true);
    revived.flush();
    assert.equal(revived.blocks[3].marker(), true);
    assert.equal(revived.blocks[2].opacity(), '0.0000');
  } finally {
    revived.dispose();
  }
});

/* ---------- 13. failures ------------------------------------------------- */

test('a failing observer or measurement clears every style the module wrote', () => {
  const unobservable = createHarness();
  try {
    unobservable.flags.failObserve = true;
    assert.throws(() => unobservable.mount(), /observe failed/);
    assert.equal(unobservable.io.length, 0);
    assert.equal(unobservable.frames.size, 0);
    for (const block of unobservable.blocks) assert.equal(block.clean(), true);
  } finally {
    unobservable.dispose();
  }

  const unmeasurable = createHarness();
  try {
    unmeasurable.mount();
    unmeasurable.flush();
    assert.equal(unmeasurable.blocks[1].marker(), true);

    unmeasurable.blocks[1].measureError = new Error('layout unavailable');
    unmeasurable.fireWindow('resize');
    assert.throws(() => unmeasurable.flush(), /layout unavailable/);
    for (const block of unmeasurable.blocks) assert.equal(block.clean(), true);
    assert.equal(unmeasurable.io[0].disconnected, true);
    assert.equal(unmeasurable.ro[0].disconnected, true);
  } finally {
    unmeasurable.dispose();
  }
});

/* ---------- 14. stylesheet contract ------------------------------------- */

type CssRule = { prelude: string; body: string; inside: string[] };

function parseCss(source: string): CssRule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const inside: string[] = [];
  let buffer = '';
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '{') {
      const prelude = buffer.trim();
      buffer = '';
      if (prelude.startsWith('@')) {
        inside.push(prelude);
        continue;
      }
      const close = text.indexOf('}', index);
      rules.push({ prelude, body: text.slice(index + 1, close), inside: [...inside] });
      index = close;
    } else if (character === '}') {
      inside.pop();
      buffer = '';
    } else {
      buffer += character;
    }
  }
  return rules;
}

test('the stylesheet only participates after measurement and defers to reading', () => {
  const source = readFileSync(new URL('../src/styles/reading-motion.css', import.meta.url), 'utf8');
  const rules = parseCss(source);
  assert.ok(rules.length >= 3, 'expected the base, the protection and the print rules');

  for (const rule of rules) {
    assert.match(
      rule.prelude,
      /#main\[data-article\]/,
      'every rule stays scoped to an article page',
    );
    assert.doesNotMatch(rule.body, /\bopacity:\s*0(?:[^\d.]|$)/, 'no rule may pre-hide content');
    assert.doesNotMatch(rule.body, /scroll-behavior|\boverflow|\bposition\s*:|scroll-snap/);
  }

  const base = rules.filter(
    (rule) => rule.inside.length === 0 && rule.body.includes('--reading-opacity'),
  );
  assert.equal(base.length, 1);
  assert.match(base[0].prelude, /\[data-reading-motion\]/);
  assert.match(
    base[0].body,
    /opacity:\s*var\(--reading-opacity,\s*1\)/,
    'the default stays opaque',
  );
  assert.match(base[0].body, /translate:\s*0 var\(--reading-y,\s*0px\)/);

  const protection = rules.find((rule) => rule.prelude.includes(':focus-within'));
  assert.ok(protection, 'focus, target and site motion need a restore rule');
  assert.match(protection!.prelude, /:target/);
  assert.match(protection!.prelude, /:has\(:target\)/);
  assert.match(protection!.prelude, /html\[data-motion='reduced-motion'\]/);
  assert.match(protection!.body, /opacity:\s*1/);
  assert.match(protection!.body, /translate:\s*none/);

  const print = rules.filter((rule) => rule.inside.some((media) => media.includes('@media')));
  assert.equal(print.length, 1);
  const media = print[0].inside[0];
  assert.match(media, /print/);
  assert.match(media, /prefers-reduced-motion:\s*reduce/);
  assert.match(print[0].body, /opacity:\s*1/);
  assert.match(print[0].body, /translate:\s*none/);
});
