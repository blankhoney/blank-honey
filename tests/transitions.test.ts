import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import test, { type TestContext } from 'node:test';
import { animateBook } from '../src/client/page-turn';
import { PageFlip } from '../src/client/vendor/page-flip';

class FakeBook {
  readonly callbacks = new Map<'init' | 'changeState', (event: { data: unknown }) => void>();
  readonly loads: HTMLElement[][] = [];
  readonly flips: (string | undefined)[] = [];
  destroys = 0;
  initOnLoad = false;
  loadError: Error | undefined;
  flipError: Error | undefined;
  destroyError: Error | undefined;

  on(name: 'init' | 'changeState', callback: (event: { data: unknown }) => void) {
    this.callbacks.set(name, callback);
    return this;
  }
  emit(name: 'init' | 'changeState', data?: unknown) {
    this.callbacks.get(name)?.({ data });
  }
  loadFromHTML(pages: HTMLElement[]) {
    this.loads.push(pages);
    if (this.initOnLoad) this.emit('init');
    if (this.loadError) throw this.loadError;
  }
  flipNext(corner?: 'top' | 'bottom') {
    this.flips.push(corner);
    if (this.flipError) throw this.flipError;
  }
  destroy() {
    this.destroys++;
    if (this.destroyError) throw this.destroyError;
  }
}

function createHarness(t: TestContext) {
  const names = [
    'window',
    'requestAnimationFrame',
    'cancelAnimationFrame',
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
  const frames = new Map<number, FrameRequestCallback>();
  const controller = new AbortController();
  const cleanup: (() => void)[] = [];
  let frameId = 0;
  const scheduleTimeout = (callback: () => void, delay: number) => {
    const timer = clockSetTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  };
  const cancelTimeout = (timer: ReturnType<typeof setTimeout> | undefined) => {
    if (timer !== undefined) timers.delete(timer);
    clockClearTimeout(timer);
  };
  const window = Object.assign(new EventTarget(), {
    navigator: { userAgent: 'node:test' },
    setTimeout: scheduleTimeout,
    clearTimeout: cancelTimeout,
  });
  for (const [name, value] of Object.entries({
    window,
    setTimeout: scheduleTimeout,
    clearTimeout: cancelTimeout,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  }))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });

  t.after(() => {
    try {
      for (const dispose of cleanup) dispose();
      controller.abort();
    } finally {
      for (const timer of timers) clockClearTimeout(timer);
      frames.clear();
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
      t.mock.timers.reset();
    }
  });
  return {
    cleanup,
    controller,
    frames,
    timers,
    window,
    flush(timestamp = 16) {
      const queued = [...frames.values()];
      frames.clear();
      for (const callback of queued) callback(timestamp);
    },
    assertReleased() {
      assert.equal(frames.size, 0, 'no queued animation frame');
      assert.equal(timers.size, 0, 'no pending deadline');
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0, 'no abort listener');
    },
  };
}

const pages = [{}, {}] as HTMLElement[];

test('a book waits one frame after init and completes only after flipping then read', async (t) => {
  const h = createHarness(t);
  const book = new FakeBook();
  const playing = animateBook(book, pages, h.controller.signal, 1100);
  assert.deepEqual(book.loads, [pages]);
  assert.equal(getEventListeners(h.controller.signal, 'abort').length, 1);
  assert.equal(h.timers.size, 1);
  assert.equal(h.frames.size, 0);
  book.emit('changeState', 'read');
  assert.equal(book.destroys, 0, 'the initial read state is not completion');
  book.emit('init');
  book.emit('init');
  assert.equal(h.frames.size, 1, 'duplicate initialization coalesces');
  assert.deepEqual(book.flips, []);
  h.flush();
  assert.deepEqual(book.flips, ['bottom']);
  book.emit('changeState', 'read');
  assert.equal(book.destroys, 0);
  book.emit('changeState', 'flipping');
  assert.equal(book.destroys, 0);
  book.emit('changeState', 'read');
  await playing;
  assert.equal(book.destroys, 1);
  h.assertReleased();
  book.emit('init');
  book.emit('changeState', 'flipping');
  book.emit('changeState', 'read');
  h.assertReleased();
  assert.equal(book.destroys, 1, 'late vendor events cannot settle twice');
});

test('an initially aborted book is disposed without loading or scheduling', async (t) => {
  const h = createHarness(t);
  h.controller.abort();
  const book = new FakeBook();
  await animateBook(book, pages, h.controller.signal, 1100);
  assert.equal(book.loads.length, 0);
  assert.equal(book.callbacks.size, 0);
  assert.equal(book.destroys, 1);
  h.assertReleased();
});

test('a load failure rejects and releases even a frame queued during initialization', async (t) => {
  const h = createHarness(t);
  const book = new FakeBook();
  book.initOnLoad = true;
  book.loadError = new Error('load failed');
  await assert.rejects(animateBook(book, pages, h.controller.signal, 1100), book.loadError);
  assert.equal(book.destroys, 1);
  assert.equal(book.flips.length, 0);
  h.assertReleased();
});

test('a flip failure rejects and releases its deadline and abort listener', async (t) => {
  const h = createHarness(t);
  const book = new FakeBook();
  book.flipError = new Error('flip failed');
  const rejected = assert.rejects(
    animateBook(book, pages, h.controller.signal, 750),
    book.flipError,
  );
  book.emit('init');
  h.flush();
  await rejected;
  assert.equal(book.destroys, 1);
  h.assertReleased();
});

test('a destroy failure rejects completion rather than leaving the promise pending', async (t) => {
  const h = createHarness(t);
  const book = new FakeBook();
  book.destroyError = new Error('destroy failed');
  const rejected = assert.rejects(
    animateBook(book, pages, h.controller.signal, 1100),
    book.destroyError,
  );
  book.emit('init');
  h.flush();
  book.emit('changeState', 'flipping');
  assert.doesNotThrow(() => book.emit('changeState', 'read'));
  await rejected;
  assert.equal(book.destroys, 1);
  h.assertReleased();
});

test('abort after loading disposes once and ignores a late init', async (t) => {
  const h = createHarness(t);
  const book = new FakeBook();
  const playing = animateBook(book, pages, h.controller.signal, 1100);
  assert.equal(book.loads.length, 1);
  h.controller.abort();
  await playing;
  book.emit('init');
  h.flush();
  assert.equal(book.flips.length, 0);
  assert.equal(book.destroys, 1);
  h.assertReleased();
});

test('abort after init cancels the queued frame and protects against its late callback', async (t) => {
  const h = createHarness(t);
  const book = new FakeBook();
  const playing = animateBook(book, pages, h.controller.signal, 1100);
  book.emit('init');
  const lateFrame = [...h.frames.values()][0]!;
  h.controller.abort();
  await playing;
  lateFrame(32);
  book.emit('init');
  assert.equal(book.flips.length, 0);
  assert.equal(book.destroys, 1);
  h.assertReleased();
});

test('destroy failure during abort still rejects and releases the queued frame', async (t) => {
  const h = createHarness(t);
  const book = new FakeBook();
  book.destroyError = new Error('abort cleanup failed');
  const rejected = assert.rejects(
    animateBook(book, pages, h.controller.signal, 750),
    book.destroyError,
  );
  book.emit('init');
  h.controller.abort();
  await rejected;
  assert.equal(book.destroys, 1);
  h.assertReleased();
});

test('duration plus 1200ms is a rejecting disposal deadline, not a silent completion', async (t) => {
  const h = createHarness(t);
  const book = new FakeBook();
  const duration = 750;
  const rejected = assert.rejects(
    animateBook(book, pages, h.controller.signal, duration),
    /Page turn did not finish/,
  );
  t.mock.timers.tick(duration + 1199);
  assert.equal(book.destroys, 0);
  assert.equal(h.timers.size, 1);
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(book.destroys, 1);
  h.assertReleased();
});

/** Only the vendor's fixed wrapper, block and shadow nodes; no HTML or selector parser. */
class VendorElement extends EventTarget {
  readonly children: VendorElement[] = [];
  readonly classes = new Set<string>();
  readonly classList = {
    add: (...names: string[]) => names.forEach((name) => this.classes.add(name)),
    remove: (...names: string[]) => names.forEach((name) => this.classes.delete(name)),
  };
  readonly style: Record<string, string> = {};
  readonly dataset = { density: 'soft' };
  parentElement: VendorElement | null = null;
  offsetWidth = 640;
  offsetHeight = 900;

  cloneNode(deep: boolean) {
    assert.equal(deep, true);
    assert.equal(this.children.length, 0, 'only the empty page fixtures are cloned');
    const copy = new VendorElement();
    copy.offsetWidth = this.offsetWidth;
    copy.offsetHeight = this.offsetHeight;
    Object.assign(copy.style, this.style);
    Object.assign(copy.dataset, this.dataset);
    copy.classList.add(...this.classes);
    return copy;
  }
  appendChild(child: VendorElement) {
    child.remove();
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentElement = null;
  }
  insertAdjacentHTML(position: string, html: string) {
    const names =
      html === '<div class="stf__wrapper"></div>'
        ? ['stf__wrapper']
        : html === '<div class="stf__block"></div>'
          ? ['stf__block']
          : html.includes('<div class="stf__outerShadow"></div>')
            ? ['stf__outerShadow', 'stf__innerShadow', 'stf__hardShadow', 'stf__hardInnerShadow']
            : undefined;
    assert.ok(names, `unexpected vendor markup: ${html}`);
    assert.ok(position === 'afterbegin' || position === 'beforeend');
    for (const name of names) {
      const child = new VendorElement();
      child.classes.add(name);
      if (name === 'stf__wrapper' || name === 'stf__block') {
        child.offsetWidth = this.offsetWidth;
        child.offsetHeight = this.offsetHeight;
      }
      this.appendChild(child);
      if (position === 'afterbegin') this.children.unshift(this.children.pop()!);
    }
  }
  querySelector(selector: string): VendorElement | null {
    assert.ok(
      [
        '.stf__wrapper',
        '.stf__block',
        '.stf__outerShadow',
        '.stf__innerShadow',
        '.stf__hardShadow',
        '.stf__hardInnerShadow',
      ].includes(selector),
    );
    for (const child of this.children) {
      if (child.classes.has(selector.slice(1))) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
}

function createVendor(width = 640, height = 900, flippingTime = 1100) {
  const stage = new VendorElement();
  const host = stage.appendChild(new VendorElement());
  host.offsetWidth = width;
  host.offsetHeight = height;
  const book = new PageFlip(host as unknown as HTMLElement, {
    width,
    height,
    size: 'fixed',
    usePortrait: true,
    useMouseEvents: false,
    autoSize: false,
    showCover: false,
    showPageCorners: false,
    disableFlipByClick: true,
    drawShadow: true,
    maxShadowOpacity: 0.36,
    flippingTime,
  });
  const elements = [new VendorElement(), new VendorElement()];
  for (const element of elements) {
    element.offsetWidth = width;
    element.offsetHeight = height;
  }
  return { stage, host, book, elements };
}

test('the real vendor releases its renderer, delayed init and programmatic-only resize handler', (t) => {
  const h = createHarness(t);
  const { stage, book, elements } = createVendor();
  h.cleanup.push(() => book.destroy());
  let initialized = 0;
  book.on('init', () => initialized++);
  book.loadFromHTML(elements as unknown as HTMLElement[]);
  assert.equal(h.frames.size, 1);
  assert.equal(h.timers.size, 1);
  assert.equal(getEventListeners(h.window, 'resize').length, 1);
  const lateFrame = [...h.frames.values()][0]!;
  book.destroy();
  book.destroy();
  lateFrame(32);
  t.mock.timers.tick(1000);
  assert.equal(initialized, 0, 'destroy cancels delayed initialization');
  assert.equal(stage.children.length, 0);
  assert.equal(getEventListeners(h.window, 'resize').length, 0);
  h.assertReleased();
});

test('the real renderer cannot queue another frame when completion destroys the book', (t) => {
  const h = createHarness(t);
  const { stage, book, elements } = createVendor();
  h.cleanup.push(() => book.destroy());
  book.loadFromHTML(elements as unknown as HTMLElement[]);
  t.mock.timers.tick(1);
  h.flush(16);
  assert.equal(h.frames.size, 1, 'the live vendor owns its render loop');
  const render = (
    book as unknown as {
      getRender(): {
        startAnimation(frames: (() => void)[], duration: number, onEnd: () => void): void;
      };
    }
  ).getRender();
  render.startAnimation([() => {}], 1, () => book.destroy());
  h.flush(32);
  assert.equal(stage.children.length, 0);
  assert.equal(getEventListeners(h.window, 'resize').length, 0);
  h.assertReleased();
});

test('a real 230px programmatic page keeps its 750ms duration instead of scaling it by distance', (t) => {
  const h = createHarness(t);
  const { stage, host, book, elements } = createVendor(230, 844, 750);
  h.cleanup.push(() => book.destroy());
  const states: unknown[] = [];
  let initialized = 0;
  book.on('init', () => initialized++);
  book.on('changeState', ({ data }) => states.push(data));
  book.loadFromHTML(elements as unknown as HTMLElement[]);
  const block = host.querySelector('.stf__block')!;
  assert.equal(block.offsetWidth, 230);
  assert.equal(block.offsetHeight, 844);
  t.mock.timers.tick(1);
  assert.equal(initialized, 1);
  const startedAt = 16;
  h.flush(startedAt);
  book.flipNext('bottom');
  assert.deepEqual(states, ['flipping']);
  for (const elapsed of [375, 700]) {
    h.flush(startedAt + elapsed);
    assert.deepEqual(states, ['flipping'], `the narrow page still turns at ${elapsed}ms`);
    assert.equal(h.frames.size, 1);
  }
  h.flush(startedAt + 750 + 16);
  assert.deepEqual(states, ['flipping', 'read']);
  book.destroy();
  assert.equal(stage.children.length, 0);
  assert.equal(getEventListeners(h.window, 'resize').length, 0);
  h.assertReleased();
});
