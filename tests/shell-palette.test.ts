import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { animateShellPalette, captureShellPalette } from '../src/client/shell-palette';

type Palette = { color: string; backgroundColor: string; borderColor: string };
const oldColors: Palette = {
  color: 'rgb(48, 43, 38)',
  backgroundColor: 'rgb(250, 243, 227)',
  borderColor: 'rgb(217, 201, 183)',
};
const newColors: Palette = {
  color: 'rgb(215, 246, 235)',
  backgroundColor: 'rgb(8, 14, 20)',
  borderColor: 'rgb(36, 79, 71)',
};
const descendants =
  '#navigation, #shell-search, a, button, input, select, label, legend, small, span, p, .nav-top, .settings, .about';

class FakeAnimation {
  private resolve!: () => void;
  private reject!: (reason: unknown) => void;
  readonly finished = new Promise<void>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
  state: 'running' | 'finished' | 'idle' = 'running';
  cancels = 0;

  constructor(
    readonly element: ElementStub,
    readonly frames: Palette[],
    readonly options: KeyframeAnimationOptions,
  ) {}

  finish() {
    if (this.state !== 'running') return;
    this.state = 'finished';
    this.resolve();
  }
  cancel() {
    this.cancels++;
    const running = this.state === 'running';
    this.state = 'idle';
    if (running) this.reject(new DOMException('Animation cancelled', 'AbortError'));
  }
}

class ElementStub {
  isConnected = true;
  palette = { ...oldColors };
  before = { ...oldColors };
  descendants: ElementStub[] = [];
  onAnimate: (() => void) | undefined;
  animateError: Error | undefined;

  constructor(
    readonly id: string,
    readonly events: string[],
    readonly animations: FakeAnimation[],
  ) {}

  querySelectorAll(selector: string) {
    assert.equal(selector, descendants);
    return this.descendants;
  }
  querySelector(selector: string) {
    assert.equal(selector, '#navigation');
    return this.descendants.find((element) => element.id === 'navigation') ?? null;
  }
  animate(frames: Palette[], options: KeyframeAnimationOptions) {
    this.events.push(`animate:${this.id}${options.pseudoElement ?? ''}`);
    if (this.animateError) throw this.animateError;
    this.onAnimate?.();
    const animation = new FakeAnimation(this, frames, options);
    this.animations.push(animation);
    return animation;
  }
}

function createHarness(t: TestContext) {
  const events: string[] = [];
  const animations: FakeAnimation[] = [];
  const shell = new ElementStub('shell', events, animations);
  const navigation = new ElementStub('navigation', events, animations);
  const search = new ElementStub('shell-search', events, animations);
  const link = new ElementStub('link', events, animations);
  shell.descendants = [navigation, search, link];
  const elements = [shell, navigation, search, link];
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  Object.defineProperty(globalThis, 'getComputedStyle', {
    configurable: true,
    writable: true,
    value: (element: ElementStub, pseudo?: string) => {
      assert.ok(elements.includes(element));
      assert.ok(pseudo === undefined || (pseudo === '::before' && element === navigation));
      events.push(`read:${element.id}${pseudo ?? ''}`);
      // Deliberately return the live object; the production helper must snapshot strings.
      return pseudo ? element.before : element.palette;
    },
  });
  t.after(() => {
    if (saved) Object.defineProperty(globalThis, 'getComputedStyle', saved);
    else Reflect.deleteProperty(globalThis, 'getComputedStyle');
  });
  return {
    shell,
    navigation,
    search,
    link,
    elements,
    events,
    animations,
    capture: () => captureShellPalette(shell as unknown as HTMLElement),
    changePalette() {
      for (const element of elements) {
        Object.assign(element.palette, newColors);
        Object.assign(element.before, newColors);
      }
    },
  };
}

test('capture copies all three colors for the shell, selected descendants and navigation ::before', (t) => {
  const h = createHarness(t);
  h.navigation.before.backgroundColor = 'rgb(246, 235, 218)';
  const snapshots = h.capture();
  assert.equal(snapshots.length, 5);
  assert.deepEqual(
    snapshots.map(({ element }) => element),
    [...h.elements, h.navigation],
  );
  assert.deepEqual(h.events, [
    'read:shell',
    'read:navigation',
    'read:shell-search',
    'read:link',
    'read:navigation::before',
  ]);
  for (let index = 0; index < h.elements.length; index++) {
    const snapshot = snapshots[index]!;
    assert.deepEqual(snapshot.palette, oldColors);
    assert.notEqual(snapshot.palette, h.elements[index]!.palette);
    assert.equal(snapshot.pseudo, undefined);
  }
  const pseudo = snapshots.at(-1)!;
  assert.equal(pseudo.pseudo, '::before');
  assert.deepEqual(pseudo.palette, { ...oldColors, backgroundColor: 'rgb(246, 235, 218)' });
  assert.notEqual(pseudo.palette, h.navigation.before);
  h.changePalette();
  assert.deepEqual(
    snapshots[0]!.palette,
    oldColors,
    'mutating a live computed object cannot rewrite old colors',
  );
  assert.deepEqual(pseudo.palette, { ...oldColors, backgroundColor: 'rgb(246, 235, 218)' });
});

test('a shell without navigation captures its ordinary descendants without a pseudo entry', (t) => {
  const h = createHarness(t);
  h.shell.descendants = [h.link];
  const snapshots = h.capture();
  assert.equal(snapshots.length, 2);
  assert.ok(snapshots.every((snapshot) => snapshot.pseudo === undefined));
  assert.deepEqual(h.events, ['read:shell', 'read:link']);
});

test('all destination colors are measured before any ancestor animation can influence descendants', (t) => {
  const h = createHarness(t);
  const snapshots = h.capture();
  h.changePalette();
  h.events.length = 0;
  h.shell.onAnimate = () => {
    for (const element of h.shell.descendants) {
      Object.assign(element.palette, oldColors);
      Object.assign(element.before, oldColors);
    }
  };
  const dispose = animateShellPalette(snapshots, 675);
  t.after(dispose);
  assert.deepEqual(h.events, [
    'read:shell',
    'read:navigation',
    'read:shell-search',
    'read:link',
    'read:navigation::before',
    'animate:shell',
    'animate:navigation',
    'animate:shell-search',
    'animate:link',
    'animate:navigation::before',
  ]);
  assert.equal(h.animations.length, 5);
  for (let index = 0; index < snapshots.length; index++) {
    const animation = h.animations[index]!;
    assert.equal(animation.element, snapshots[index]!.element as unknown as ElementStub);
    assert.deepEqual(animation.frames, [oldColors, newColors]);
    assert.deepEqual(animation.options, {
      duration: 675,
      easing: 'ease-in-out',
      fill: 'both',
      pseudoElement: snapshots[index]!.pseudo,
    });
  }
});

test('unchanged palettes, disconnected elements and zero duration never start an animation', (t) => {
  const h = createHarness(t);
  const snapshots = h.capture();
  animateShellPalette(snapshots, 900)();
  assert.equal(h.animations.length, 0);
  h.changePalette();
  for (const element of h.elements) element.isConnected = false;
  animateShellPalette(snapshots, 900)();
  assert.equal(h.animations.length, 0);
  for (const element of h.elements) element.isConnected = true;
  animateShellPalette(snapshots, 0)();
  assert.equal(h.animations.length, 0);
  assert.ok(h.events.every((event) => event.startsWith('read:')));
});

test('changing any one palette channel is sufficient while unchanged neighbors stay still', (t) => {
  const h = createHarness(t);
  const snapshots = h.capture();
  for (const key of ['color', 'backgroundColor', 'borderColor'] as const) {
    Object.assign(h.shell.palette, oldColors, { [key]: newColors[key] });
    const before = h.animations.length;
    const dispose = animateShellPalette(snapshots, 600);
    assert.equal(h.animations.length, before + 1);
    const animation = h.animations.at(-1)!;
    assert.equal(animation.element, h.shell);
    assert.deepEqual(animation.frames, [oldColors, { ...oldColors, [key]: newColors[key] }]);
    dispose();
    assert.equal(animation.cancels, 1);
  }
});

test('finished animations cancel their fill and are released before later disposal', async (t) => {
  const h = createHarness(t);
  const snapshots = h.capture();
  h.changePalette();
  const dispose = animateShellPalette(snapshots, 900);
  t.after(dispose);
  for (const animation of h.animations) animation.finish();
  await Promise.resolve();
  assert.ok(
    h.animations.every((animation) => animation.cancels === 1 && animation.state === 'idle'),
  );
  dispose();
  dispose();
  assert.ok(
    h.animations.every((animation) => animation.cancels === 1),
    'finished animations no longer belong to the owner',
  );
});

test('explicit disposal is idempotent and pending finished rejections are handled', async (t) => {
  const h = createHarness(t);
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on('unhandledRejection', onUnhandled);
  t.after(() => {
    process.off('unhandledRejection', onUnhandled);
  });
  const snapshots = h.capture();
  h.changePalette();
  const dispose = animateShellPalette(snapshots, 900);
  t.after(dispose);
  assert.ok(h.animations.every((animation) => animation.state === 'running'));
  dispose();
  dispose();
  assert.ok(
    h.animations.every((animation) => animation.cancels === 1 && animation.state === 'idle'),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(unhandled, []);
  assert.ok(h.animations.every((animation) => animation.cancels === 1));
});

test('a second animate failure cancels the first and rethrows without an unhandled rejection', async (t) => {
  const h = createHarness(t);
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on('unhandledRejection', onUnhandled);
  t.after(() => {
    process.off('unhandledRejection', onUnhandled);
  });
  const snapshots = h.capture();
  h.changePalette();
  const error = new Error('second animation failed');
  h.navigation.animateError = error;
  assert.throws(() => animateShellPalette(snapshots, 900), error);
  assert.equal(h.animations.length, 1);
  assert.equal(h.animations[0]!.element, h.shell);
  assert.equal(h.animations[0]!.cancels, 1);
  assert.equal(h.animations[0]!.state, 'idle');
  assert.equal(h.events.filter((event) => event.startsWith('animate:')).length, 2);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(unhandled, []);
  assert.equal(h.animations[0]!.cancels, 1);
});
