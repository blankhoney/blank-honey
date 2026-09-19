import type { HeroContext } from '../hero';
import type { FlockBudget, FlockScene } from '../flock-scene';
import { report } from '../log';

export function birdBudget(light: boolean): FlockBudget {
  return light
    ? { width: 16, fps: 20, maxDpr: 1, maxPixels: 900_000 }
    : { width: 32, fps: 30, maxDpr: 1.5, maxPixels: 2_400_000 };
}

type SceneLoader = () => Promise<{ createFlockScene: (budget: FlockBudget) => FlockScene }>;

export default async function mountBirds(
  { host, stage, signal, reduced, light }: HeroContext,
  loadScene: SceneLoader = () => import('../flock-scene'),
) {
  if (signal.aborted) return;
  const layer = document.createElement('div');
  layer.className = 'flock-layer';
  layer.dataset.state = 'static';
  layer.setAttribute('aria-hidden', 'true');
  const fallback = document.createElement('div');
  fallback.className = 'flock-still';
  for (let index = 0; index < 28; index++) {
    const bird = document.createElement('i');
    bird.style.setProperty('--x', `${(index * 37 + 9) % 100}%`);
    bird.style.setProperty('--y', `${(index * 19 + 11) % 100}%`);
    bird.style.setProperty('--size', `${10 + (index % 5) * 7}px`);
    bird.style.setProperty('--tilt', `${((index * 29) % 100) - 50}deg`);
    fallback.append(bird);
  }
  layer.append(fallback);
  stage.append(layer);
  const listeners = new AbortController();
  const budget = birdBudget(light);
  let scene: FlockScene | undefined;
  let observer: ResizeObserver | undefined;
  let raf: number | undefined;
  let disposed = false;
  let stopped = false;
  let last: number | undefined;
  let elapsed = 0;
  const pointer = { x: 10000, y: 10000 };

  function cancelFrame() {
    if (raf !== undefined) cancelAnimationFrame(raf);
    raf = undefined;
    last = undefined;
  }
  function release() {
    stopped = true;
    cancelFrame();
    listeners.abort();
    observer?.disconnect();
    observer = undefined;
    scene?.dispose();
    scene = undefined;
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
    report('birds', error);
  }
  function schedule() {
    if (!disposed && !stopped && !document.hidden && raf === undefined) {
      raf = requestAnimationFrame(frame);
    }
  }
  function frame(now: number) {
    raf = undefined;
    if (disposed || stopped || document.hidden || !scene) return;
    if (last === undefined || now - last >= 1000 / budget.fps - 0.25) {
      const delta = last === undefined ? 0 : Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += delta;
      try {
        scene.frame(elapsed * 1000, delta, pointer);
      } catch (error) {
        fail(error);
        return;
      }
    }
    schedule();
  }
  function visibility() {
    layer.dataset.paused = String(document.hidden);
    if (document.hidden) cancelFrame();
    else schedule();
  }
  function resize() {
    if (!scene || stopped || disposed) return;
    const { width, height } = host.getBoundingClientRect();
    try {
      scene.resize(width, height, window.devicePixelRatio || 1);
    } catch (error) {
      fail(error);
    }
  }
  function clearPointer() {
    pointer.x = 10000;
    pointer.y = 10000;
  }
  signal.addEventListener('abort', dispose, { once: true });
  if (reduced) return;
  try {
    const module = await loadScene();
    if (disposed || signal.aborted) return;
    scene = module.createFlockScene(budget);
    if (disposed || signal.aborted) {
      scene.dispose();
      return;
    }
    scene.canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        fail(new Error('Birds WebGL context lost'));
      },
      { signal: listeners.signal },
    );
    resize();
    if (stopped || !scene) return;
    // Compile/draw before revealing the canvas so shader failures retain the still image.
    scene.frame(0, 0, pointer);
    layer.append(scene.canvas);
    layer.dataset.state = 'live';
    observer = new ResizeObserver(resize);
    observer.observe(host);
    host.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse') return;
        const rect = host.getBoundingClientRect();
        pointer.x = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
        pointer.y = 0.5 - (event.clientY - rect.top) / Math.max(1, rect.height);
      },
      { passive: true, signal: listeners.signal },
    );
    host.addEventListener('pointerleave', clearPointer, { signal: listeners.signal });
    document.addEventListener('visibilitychange', visibility, { signal: listeners.signal });
    visibility();
  } catch (error) {
    fail(error);
  }
}
