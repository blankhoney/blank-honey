import assert from 'node:assert/strict';
import { setMaxListeners } from 'node:events';
import { test } from 'node:test';
import { initFloatingSearch } from '../src/client/floating-search';

const controlSelector =
  '#nav-dot, #navigation, a[href], button, input, textarea, select, summary, [role="button"], [contenteditable]:not([contenteditable="false"])';
const controlKinds = new Set([
  'link',
  'button',
  'input',
  'textarea',
  'select',
  'summary',
  'role-button',
  'editable',
  'navigation',
  'nav-dot',
]);

class ElementStub extends EventTarget {
  parent: ElementStub | null = null;
  readonly children: ElementStub[] = [];
  readonly attributes = new Map<string, string>();
  readonly classes = new Set<string>();
  readonly classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
    contains: (name: string) => this.classes.has(name),
  };
  readonly properties = new Map<string, string>();
  readonly style = {
    setProperty: (name: string, value: string) => this.properties.set(name, value),
    removeProperty: (name: string) => this.properties.delete(name),
  };
  readonly dataset = { family: 'paper' };
  inert = false;
  value = '';
  focusCalls = 0;
  bounds = { top: 0, bottom: 0 };
  id = '';

  constructor(readonly kind = 'plain') {
    super();
  }

  get isContentEditable(): boolean {
    return this.kind === 'editable' || Boolean(this.parent?.isContentEditable);
  }
  append(...children: ElementStub[]) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }
  contains(node: ElementStub | null) {
    for (let current = node; current; current = current.parent) {
      if (current === this) return true;
    }
    return false;
  }
  closest(selector: string) {
    assert.ok(selector === controlSelector || selector === 'input, textarea, select');
    const kinds =
      selector === controlSelector ? controlKinds : new Set(['input', 'textarea', 'select']);
    for (let current: ElementStub | null = this; current; current = current.parent) {
      if (kinds.has(current.kind)) return current;
    }
    return null;
  }
  querySelector(selector: string) {
    assert.ok(selector === '#search' || selector === '#close-search');
    return this.children.find((child) => child.id === selector.slice(1)) ?? null;
  }
  querySelectorAll(selector: string) {
    assert.equal(selector, 'select');
    return this.children.filter((child) => child.kind === 'select');
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getBoundingClientRect() {
    return this.bounds;
  }
  focus() {
    this.focusCalls++;
    (globalThis.document as unknown as DocumentStub).activeElement = this;
  }
}

class DocumentStub extends EventTarget {
  readonly documentElement = new ElementStub();
  activeElement: ElementStub | null = null;
  reads = 0;
  back: ElementStub | null = new ElementStub('link');
  readonly panel = new ElementStub();
  readonly trigger = new ElementStub('button');
  readonly input = new ElementStub('input');
  readonly close = new ElementStub('button');
  readonly select = new ElementStub('select');

  constructor() {
    super();
    this.input.id = 'search';
    this.close.id = 'close-search';
    this.panel.inert = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.panel.append(this.input, this.close, this.select);
    this.back!.bounds = { top: 32, bottom: 63 };
  }
  querySelector(selector: string) {
    this.reads++;
    if (selector === '#shell-search') return this.panel;
    if (selector === '#search-edge') return this.trigger;
    assert.equal(selector, '#main[data-article] .reading-page > .back');
    return this.back;
  }
}

function event(type: string, target: EventTarget, values: Record<string, unknown> = {}) {
  const result = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries({ target, ...values }))
    Object.defineProperty(result, key, { value });
  return result;
}

function createHarness() {
  const document = new DocumentStub();
  const window = new EventTarget();
  const controller = new AbortController();
  setMaxListeners(0, controller.signal);
  let now = 0;
  let nextTimer = 1;
  let nextFrame = 1;
  let app: ReturnType<typeof initFloatingSearch> | undefined;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const frames = new Map<number, FrameRequestCallback>();
  const globals = {
    document,
    window,
    innerHeight: 900,
    Node: ElementStub,
    Element: ElementStub,
    HTMLElement: ElementStub,
    matchMedia: () => ({ matches: true }),
    setTimeout: (callback: () => void, delay = 0) => {
      const id = nextTimer++;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout: (id?: number) => {
      if (id !== undefined) timers.delete(id);
    },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  const saved = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const dateNow = Date.now;
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  Date.now = () => now;

  return {
    document,
    window,
    controller,
    timers,
    frames,
    mount(signal: AbortSignal | undefined = controller.signal) {
      return (app = initFloatingSearch(signal));
    },
    tick(duration: number) {
      const end = now + duration;
      for (;;) {
        const next = [...timers]
          .filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.at;
        timers.delete(id);
        timer.callback();
      }
      now = end;
    },
    flush() {
      for (const [id, callback] of [...frames]) {
        frames.delete(id);
        callback(now);
      }
    },
    pointer(target: ElementStub, y: number, pointerType = 'mouse') {
      document.dispatchEvent(event('pointermove', target, { clientY: y, pointerType }));
    },
    key(target: ElementStub, values: Record<string, unknown> = {}) {
      const pressed = event('keydown', target, { key: '/', ...values });
      document.dispatchEvent(pressed);
      return pressed;
    },
    dispose() {
      app?.close();
      controller.abort();
      Date.now = dateNow;
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('an already-aborted search never reads the DOM or opens', () => {
  const h = createHarness();
  try {
    const search = h.mount(AbortSignal.abort());
    search.open(true);
    search.close();
    assert.equal(search.isOpen(), false);
    assert.equal(h.document.reads, 0);
    assert.equal(h.timers.size, 0);
    assert.equal(h.frames.size, 0);
  } finally {
    h.dispose();
  }
});

test('the return link and other controls cancel pending hover intent, including their children', () => {
  const h = createHarness();
  try {
    const search = h.mount();
    const blank = new ElementStub();
    for (const kind of controlKinds) {
      const control = new ElementStub(kind);
      const child = new ElementStub();
      control.append(child);
      h.pointer(blank, 100);
      h.pointer(blank, 8);
      h.tick(90);
      h.pointer(child, 8);
      h.tick(500);
      assert.equal(search.isOpen(), false, `${kind} must retain its pointer intent`);
      assert.equal(h.timers.size, 0);
    }
    h.pointer(h.document.back!, 45);
    h.tick(500);
    assert.equal(search.isOpen(), false, 'the real return row is outside the 16px band');
  } finally {
    h.dispose();
  }
});

test('the actual 16px edge opens after 180ms and ordinary movement does not postpone closing', () => {
  const h = createHarness();
  try {
    const search = h.mount();
    const blank = new ElementStub();
    h.pointer(blank, 17);
    h.tick(300);
    assert.equal(search.isOpen(), false);
    h.pointer(blank, 16);
    h.tick(179);
    assert.equal(search.isOpen(), false);
    h.tick(1);
    assert.equal(search.isOpen(), true);
    assert.equal(h.document.input.focusCalls, 0, 'hover never steals focus');
    assert.equal(h.document.panel.properties.get('--search-top'), '75px');
    assert.equal(h.document.panel.inert, false);
    assert.equal(h.document.trigger.attributes.get('aria-expanded'), 'true');

    h.pointer(blank, 100);
    h.tick(200);
    h.pointer(blank, 120);
    h.tick(249);
    assert.equal(search.isOpen(), true);
    h.tick(1);
    assert.equal(search.isOpen(), false);
    assert.equal(h.document.panel.inert, true);
  } finally {
    h.dispose();
  }
});

test('pointerdown cancels a queued hover but an explicit trigger click still opens', () => {
  const h = createHarness();
  try {
    const search = h.mount();
    const blank = new ElementStub();
    h.pointer(blank, 8);
    h.tick(90);
    h.document.dispatchEvent(event('pointerdown', blank));
    h.tick(500);
    assert.equal(search.isOpen(), false);
    h.pointer(blank, 100);
    h.pointer(blank, 8, 'touch');
    h.tick(500);
    assert.equal(search.isOpen(), false, 'touch does not opt into mouse hover');
    h.document.dispatchEvent(event('pointerdown', h.document.trigger));
    h.document.trigger.dispatchEvent(new Event('click'));
    assert.equal(search.isOpen(), true);
    assert.equal(h.document.activeElement, h.document.input);
  } finally {
    h.dispose();
  }
});

test('open search measures the current return row and coalesces scroll and resize into one frame', () => {
  const h = createHarness();
  try {
    const search = h.mount();
    h.window.dispatchEvent(new Event('scroll'));
    assert.equal(h.frames.size, 0);
    search.open();
    assert.equal(h.document.panel.properties.get('--search-top'), '75px');
    h.document.back!.bounds = { top: -50, bottom: -20 };
    h.window.dispatchEvent(new Event('scroll'));
    h.window.dispatchEvent(new Event('resize'));
    h.window.dispatchEvent(new Event('scroll'));
    assert.equal(h.frames.size, 1);
    h.flush();
    assert.equal(h.document.panel.properties.get('--search-top'), '24px');
    assert.equal(h.frames.size, 0, 'positioning has no idle loop');
    h.window.dispatchEvent(new Event('scroll'));
    search.close();
    assert.equal(h.frames.size, 0);
    h.document.back!.bounds = { top: 48, bottom: 88 };
    search.open();
    assert.equal(h.document.panel.properties.get('--search-top'), '100px', 'opening remeasures');
  } finally {
    h.dispose();
  }
});

test('slash respects editing controls and closing requires exiting before hover can reopen', () => {
  const h = createHarness();
  try {
    const search = h.mount();
    const blank = new ElementStub();
    for (const kind of ['input', 'textarea', 'select', 'editable']) {
      const pressed = h.key(new ElementStub(kind));
      assert.equal(pressed.defaultPrevented, false);
      assert.equal(search.isOpen(), false);
    }
    assert.equal(h.key(blank, { ctrlKey: true }).defaultPrevented, false);
    assert.equal(search.isOpen(), false);
    assert.equal(h.key(blank).defaultPrevented, true);
    assert.equal(search.isOpen(), true);
    assert.equal(h.document.activeElement, h.document.input);
    search.close();
    assert.equal(h.document.activeElement, h.document.trigger);
    h.pointer(blank, 8);
    h.tick(500);
    assert.equal(search.isOpen(), false);
    h.pointer(blank, 100);
    h.pointer(blank, 8);
    h.tick(180);
    assert.equal(search.isOpen(), true);
    search.close();
    h.document.documentElement.dataset.family = 'hero';
    assert.equal(h.key(blank).defaultPrevented, false);
    h.document.trigger.dispatchEvent(new Event('click'));
    assert.equal(search.isOpen(), false);
  } finally {
    h.dispose();
  }
});

test('criteria, focus and IME protect the open panel without creating a hover loop', () => {
  const h = createHarness();
  try {
    const search = h.mount();
    h.document.select.value = 'tutorials';
    search.open();
    h.tick(59_999);
    assert.equal(search.isOpen(), true);
    h.document.activeElement = h.document.input;
    h.document.panel.dispatchEvent(new Event('focusin'));
    h.tick(60_001);
    assert.equal(search.isOpen(), true);
    h.document.activeElement = null;
    h.document.panel.dispatchEvent(new Event('compositionstart'));
    h.document.select.value = '';
    h.tick(60_001);
    assert.equal(search.isOpen(), true);
    h.document.panel.dispatchEvent(new Event('compositionend'));
    h.tick(449);
    assert.equal(search.isOpen(), true);
    h.tick(1);
    assert.equal(search.isOpen(), false);
  } finally {
    h.dispose();
  }
});

test('abort cancels queued hover and leave deadlines before they can run', () => {
  for (const pending of ['hover', 'leave']) {
    const h = createHarness();
    try {
      const search = h.mount();
      if (pending === 'hover') h.pointer(new ElementStub(), 8);
      else search.open();
      assert.equal(h.timers.size, 1, `${pending} has a pending deadline`);
      h.controller.abort();
      assert.equal(h.timers.size, 0);
      h.tick(1000);
      assert.equal(search.isOpen(), false);
      assert.equal(h.document.panel.properties.has('--search-top'), false);
    } finally {
      h.dispose();
    }
  }
});

test('abort clears timers, frames, UI state and listeners without moving focus', () => {
  const h = createHarness();
  try {
    const search = h.mount();
    search.open(true);
    h.window.dispatchEvent(new Event('scroll'));
    assert.equal(h.frames.size, 1);
    const lateFrame = [...h.frames.values()][0]!;
    h.controller.abort();
    lateFrame(123);
    assert.equal(search.isOpen(), false);
    assert.equal(h.document.panel.inert, true);
    assert.equal(h.document.panel.classList.contains('search-open'), false);
    assert.equal(h.document.trigger.attributes.get('aria-expanded'), 'false');
    assert.equal(h.document.panel.properties.has('--search-top'), false);
    assert.equal(h.document.activeElement, h.document.input, 'abort does not transfer focus');
    assert.equal(h.document.trigger.focusCalls, 0);
    assert.equal(h.frames.size, 0);
    assert.equal(h.timers.size, 0);

    h.document.trigger.dispatchEvent(new Event('click'));
    h.key(new ElementStub());
    h.pointer(new ElementStub(), 8);
    h.window.dispatchEvent(new Event('resize'));
    search.open();
    h.tick(1000);
    assert.equal(search.isOpen(), false);
    assert.equal(h.frames.size, 0);
    assert.equal(h.timers.size, 0);
  } finally {
    h.dispose();
  }
});
