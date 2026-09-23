import type { HeroContext } from './hero';
import type {
  AlgorithmBudget,
  AlgorithmFactory,
  AlgorithmId,
  AlgorithmPointer,
  AlgorithmScene,
} from './algorithms/types';
import { createFrameBudget } from './flock-performance';
import { report } from './log';

type AlgorithmLoader = () => Promise<{ createScene: AlgorithmFactory }>;

/** Pixel ceiling per algorithm, full first and light second. */
const pixelBudgets: Record<AlgorithmId, { full: number; light: number }> = {
  blackhole: { full: 900_000, light: 300_000 },
  ocean: { full: 1_200_000, light: 400_000 },
  reaction: { full: 1_200_000, light: 450_000 },
  terrain: { full: 1_200_000, light: 450_000 },
};

/** Frame rate: 30 fps full, 20 fps light. DPR cap: 1.5 full, 1 light. */
export function algorithmBudget(id: AlgorithmId, light: boolean): AlgorithmBudget {
  const pixels = pixelBudgets[id];
  return light
    ? { light, fps: 20, maxPixels: pixels.light, maxDpr: 1 }
    : { light, fps: 30, maxPixels: pixels.full, maxDpr: 1.5 };
}

/** Targets that own their own gestures; the background must not react to them. */
const interactive = 'a,button,input,select,textarea,summary,[contenteditable]';
/** A touch still counts as a tap below this span (ms) and travel (css px). */
const tapSpan = 350;
const tapTravel = 12;

type TreeNode = { matches?: (selector: string) => boolean; parentElement?: TreeNode | null };

/** Walks up to the host looking for a target that handles its own pointer input. */
function insideInteractive(target: EventTarget | null, host: HTMLElement): boolean {
  let node = target as TreeNode | null;
  while (node && node !== (host as unknown as TreeNode)) {
    if (typeof node.matches === 'function' && node.matches(interactive)) return true;
    node = node.parentElement ?? null;
  }
  return false;
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

/**
 * Drives one procedural hero scene: static layer first, lazy GPU import, one capped render loop,
 * and an idempotent teardown. The scene owns its canvas and GL objects; this runtime owns the
 * layer, the observers, the listeners, the frame loop and the pointer state.
 */
export async function mountAlgorithm(
  { host, stage, signal, reduced, light }: HeroContext,
  id: AlgorithmId,
  load: AlgorithmLoader,
): Promise<void> {
  if (signal.aborted) return;
  const layer = document.createElement('div');
  layer.className = 'algorithm-layer';
  layer.dataset.state = 'static';
  layer.setAttribute('aria-hidden', 'true');
  const fallback = document.createElement('div');
  fallback.className = 'algorithm-still';
  fallback.setAttribute('aria-hidden', 'true');
  layer.append(fallback);
  stage.append(layer);
  const listeners = new AbortController();
  const budget = algorithmBudget(id, light);
  const frameBudget = createFrameBudget(budget.fps);
  const pointer: AlgorithmPointer = { x: 0, y: 0, active: false, down: false, tap: false };
  let scene: AlgorithmScene | undefined;
  let observer: ResizeObserver | undefined;
  let intersection: IntersectionObserver | undefined;
  let raf: number | undefined;
  let touch: { time: number; x: number; y: number; moved: boolean } | undefined;
  let tapFrame = false;
  let disposed = false;
  let stopped = false;
  let inViewport = true;
  let last: number | undefined;
  let elapsed = 0;
  let scale = 1;
  let width = 1;
  let height = 1;

  function cancelFrame() {
    if (raf !== undefined) cancelAnimationFrame(raf);
    raf = undefined;
    last = undefined;
    // Resuming starts a fresh warm window, so one slow frame cannot downshift the scene.
    frameBudget.reset();
  }
  function clearPointer() {
    touch = undefined;
    tapFrame = false;
    pointer.active = false;
    pointer.down = false;
    pointer.tap = false;
  }
  function release() {
    stopped = true;
    cancelFrame();
    listeners.abort();
    observer?.disconnect();
    intersection?.disconnect();
    observer = undefined;
    intersection = undefined;
    clearPointer();
    const released = scene;
    // Drop the field first: a throwing cleanup must not leave a dead scene behind it.
    scene = undefined;
    if (!released) return;
    try {
      released.dispose();
    } catch (error) {
      // A stuck release cannot be allowed to block the abort path from dropping the layer.
      report(`algorithm-${id}-dispose`, error);
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    release();
    signal.removeEventListener('abort', dispose);
    layer.remove();
  }
  function fail(error: unknown) {
    if (disposed || stopped) return;
    release();
    layer.dataset.state = 'static';
    // Keep the failing algorithm identifiable; report() sends only a name and the page path.
    report(`algorithm-${id}`, error);
  }
  function schedule() {
    if (disposed || stopped || document.hidden || !inViewport || raf !== undefined) return;
    raf = requestAnimationFrame(frame);
  }
  /** A tap lasts exactly the frame that consumes it. */
  function flushTap() {
    if (!pointer.tap) return;
    pointer.tap = false;
    if (tapFrame) {
      tapFrame = false;
      pointer.active = false;
      pointer.down = false;
    }
  }
  function frame(now: number) {
    raf = undefined;
    if (disposed || stopped || document.hidden || !inViewport || !scene) return;
    if (last === undefined || now - last >= 1000 / budget.fps - 0.25) {
      const interval = last === undefined ? 0 : now - last;
      last = now;
      const delta = Math.min(interval / 1000, 0.1);
      elapsed += delta;
      try {
        const next = frameBudget.sample(interval);
        if (next !== undefined) {
          scale = next;
          scene.resize(width, height, scale);
        }
        scene.frame(elapsed, delta, pointer);
        flushTap();
      } catch (error) {
        fail(error);
        return;
      }
    }
    schedule();
  }
  function visibility() {
    layer.dataset.paused = String(document.hidden || !inViewport);
    if (document.hidden || !inViewport) cancelFrame();
    else schedule();
  }
  function resize() {
    if (disposed || stopped || !scene) return;
    frameBudget.reset();
    const bounds = host.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    try {
      scene.resize(width, height, scale);
    } catch (error) {
      fail(error);
    }
  }
  /** Stage space: x/y in [-1, 1] with y pointing up, clamped for pointers outside the box. */
  function position(event: PointerEvent) {
    const bounds = stage.getBoundingClientRect();
    const boxWidth = Math.max(1, bounds.width);
    const boxHeight = Math.max(1, bounds.height);
    return {
      x: clamp(((event.clientX - bounds.left) / boxWidth) * 2 - 1),
      y: clamp(1 - ((event.clientY - bounds.top) / boxHeight) * 2),
    };
  }
  function onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      // Touch reads as a tap or as a scroll gesture; a drag must never brush the scene.
      if (touch) {
        const travel = Math.hypot(event.clientX - touch.x, event.clientY - touch.y);
        if (travel >= tapTravel) touch.moved = true;
      }
      return;
    }
    if (insideInteractive(event.target, host)) return;
    const at = position(event);
    pointer.x = at.x;
    pointer.y = at.y;
    pointer.active = true;
  }
  function onPointerDown(event: PointerEvent) {
    if (insideInteractive(event.target, host)) return;
    if (event.pointerType === 'touch') {
      // No brush and no press state on touch; only the release decides whether it was a tap.
      touch = { time: event.timeStamp, x: event.clientX, y: event.clientY, moved: false };
      return;
    }
    const at = position(event);
    pointer.x = at.x;
    pointer.y = at.y;
    pointer.active = true;
    pointer.down = true;
    // Hold the press edge until the next real render: a click whose release lands in the same
    // frame window would otherwise be gone before the scene is asked to read it.
    pointer.tap = true;
  }
  function onPointerUp(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      const start = touch;
      touch = undefined;
      if (!start || insideInteractive(event.target, host)) return;
      const travel = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (start.moved || travel >= tapTravel || event.timeStamp - start.time >= tapSpan) return;
      const at = position(event);
      pointer.x = at.x;
      pointer.y = at.y;
      pointer.active = true;
      pointer.tap = true;
      tapFrame = true;
      return;
    }
    // The release always ends a press, even when it happens over a link.
    pointer.down = false;
  }

  signal.addEventListener('abort', dispose, { once: true });
  if (reduced) return;
  host.addEventListener('pointermove', onPointerMove, { passive: true, signal: listeners.signal });
  host.addEventListener('pointerdown', onPointerDown, { passive: true, signal: listeners.signal });
  host.addEventListener('pointerup', onPointerUp, { passive: true, signal: listeners.signal });
  // The browser takes the gesture over on scroll or zoom; a stale touch candidate must not tap.
  host.addEventListener('pointercancel', clearPointer, { signal: listeners.signal });
  host.addEventListener('pointerleave', clearPointer, { signal: listeners.signal });
  window.addEventListener('blur', clearPointer, { signal: listeners.signal });
  try {
    const module = await load();
    if (disposed || stopped || signal.aborted) return;
    const created = await module.createScene(layer, budget, signal);
    // A scene that arrives after the abort must not stay alive, not even for one frame.
    if (disposed || stopped || signal.aborted) {
      created.dispose();
      return;
    }
    scene = created;
    scene.canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        fail(new Error(`Algorithm ${id} lost its WebGL context`));
      },
      { signal: listeners.signal },
    );
    resize();
    if (disposed || stopped || !scene) return;
    // Compile and draw once before revealing the canvas, so a broken shader keeps the still image.
    scene.frame(0, 0, pointer);
    flushTap();
    layer.dataset.state = 'live';
    observer = new ResizeObserver(resize);
    observer.observe(host);
    if (typeof IntersectionObserver !== 'undefined') {
      intersection = new IntersectionObserver(([entry]) => {
        if (disposed || stopped) return;
        inViewport = entry?.isIntersecting ?? true;
        visibility();
      });
      intersection.observe(host);
    }
    document.addEventListener('visibilitychange', visibility, { signal: listeners.signal });
    visibility();
  } catch (error) {
    fail(error);
  }
}
