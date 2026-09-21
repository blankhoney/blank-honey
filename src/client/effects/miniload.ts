import type { HeroContext } from '../hero';
import type { PixelCloudBudget, PixelCloudScene } from '../pixel-cloud';
import { createFrameBudget } from '../flock-performance';
import { report } from '../log';

export function pixelCloudBudget(light: boolean): PixelCloudBudget {
  return light
    ? { light, fps: 20, maxPixels: 320_000, pixelSize: 3 }
    : { light, fps: 30, maxPixels: 900_000, pixelSize: 2.4 };
}
type SceneLoader = () => Promise<{
  createPixelCloudScene: (container: HTMLElement, budget: PixelCloudBudget) => PixelCloudScene;
}>;

export default async function mountPixelCloud(
  { host, stage, signal, reduced, light }: HeroContext,
  loadScene: SceneLoader = () => import('../pixel-cloud'),
) {
  if (signal.aborted) return;
  const layer = document.createElement('div');
  layer.className = 'pixel-cloud-layer';
  layer.dataset.state = 'static';
  layer.setAttribute('aria-hidden', 'true');
  const fallback = document.createElement('div');
  fallback.className = 'pixel-cloud-still';
  const shadow = document.createElement('div');
  shadow.className = 'pixel-cloud-shadow';
  layer.append(fallback, shadow);
  stage.append(layer);
  const listeners = new AbortController();
  const budget = pixelCloudBudget(light);
  const frameBudget = createFrameBudget(budget.fps);
  let scene: PixelCloudScene | undefined;
  let observer: ResizeObserver | undefined;
  let intersection: IntersectionObserver | undefined;
  let raf: number | undefined;
  let disposed = false;
  let stopped = false;
  let inViewport = true;
  let last: number | undefined;
  let elapsed = 0;
  let scale = 1;
  let width = 1;
  let height = 1;

  function hideShadow() {
    shadow.classList.remove('visible');
  }
  function cancelFrame() {
    if (raf !== undefined) cancelAnimationFrame(raf);
    raf = undefined;
    last = undefined;
    frameBudget.reset();
  }
  function release() {
    stopped = true;
    cancelFrame();
    listeners.abort();
    observer?.disconnect();
    intersection?.disconnect();
    observer = undefined;
    intersection = undefined;
    hideShadow();
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
    report('pixel-cloud', error);
  }
  function schedule() {
    if (!disposed && !stopped && !document.hidden && inViewport && raf === undefined)
      raf = requestAnimationFrame(frame);
  }
  function frame(now: number) {
    raf = undefined;
    if (disposed || stopped || document.hidden || !inViewport || !scene) return;
    if (last === undefined || now - last >= 1000 / budget.fps - 0.25) {
      const interval = last === undefined ? 0 : now - last;
      last = now;
      elapsed += Math.min(interval / 1000, 0.1);
      try {
        const next = frameBudget.sample(interval);
        if (next !== undefined) {
          scale = next;
          scene.resize(width, height, scale);
        }
        scene.frame(elapsed);
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
  signal.addEventListener('abort', dispose, { once: true });
  host.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      const bounds = stage.getBoundingClientRect();
      shadow.style.transform = `translate3d(${event.clientX - bounds.left}px, ${event.clientY - bounds.top}px, 0) translate(-50%, -50%)`;
      shadow.classList.add('visible');
    },
    { signal: listeners.signal },
  );
  host.addEventListener('pointerleave', hideShadow, { signal: listeners.signal });
  window.addEventListener('blur', hideShadow, { signal: listeners.signal });
  if (reduced) return;
  try {
    const module = await loadScene();
    if (disposed || signal.aborted) return;
    scene = module.createPixelCloudScene(layer, budget);
    if (disposed || signal.aborted) {
      scene.dispose();
      return;
    }
    scene.canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        fail(new Error('Pixel cloud WebGL context lost'));
      },
      { signal: listeners.signal },
    );
    resize();
    if (stopped || !scene) return;
    scene.frame(0);
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
