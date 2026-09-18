import { capability } from './preferences';
import { report } from './log';
import { animateShellPalette, captureShellPalette, type ShellPalette } from './shell-palette';

export type AtmosphereHandle = {
  element: HTMLElement;
  pause(paused: boolean): void;
  dispose(): void;
};
type SceneLoader = (
  family: string,
  signal: AbortSignal,
  host: HTMLElement,
) => Promise<AtmosphereHandle | undefined>;
type Scene = {
  element: HTMLElement;
  controller: AbortController;
  handle?: AtmosphereHandle;
};
const tokens = ['--bg', '--fg', '--accent', '--muted', '--line', '--soft'];

async function loadScene(family: string, signal: AbortSignal, host: HTMLElement) {
  if (family === 'paper') {
    const { mountPaperAtmosphere } = await import('./paper-atmosphere');
    if (!signal.aborted) return mountPaperAtmosphere(signal, host);
  } else if (family === 'terminal') {
    const { mountAtmosphere } = await import('./terminal-atmosphere');
    if (!signal.aborted) return mountAtmosphere(signal, host);
  }
}

/** The persistent host owns at most two scenes; a router swap must not remove their pixels. */
export function createAtmosphereController(host: HTMLElement, load: SceneLoader = loadScene) {
  let current: Scene | undefined;
  let outgoing: Scene | undefined;
  let pending: Scene | undefined;
  let generation = 0;
  const animations = new Set<Animation>();

  function disposeScene(scene: Scene | undefined) {
    if (!scene) return;
    scene.controller.abort();
    scene.handle?.dispose();
    scene.element.remove();
  }

  function cancelFade() {
    for (const animation of animations) animation.cancel();
    animations.clear();
  }

  function prepare() {
    generation++;
    cancelFade();
    disposeScene(pending);
    pending = undefined;
    // An interrupted exchange settles to the current route before another one begins.
    if (current) {
      disposeScene(outgoing);
      outgoing = current;
      current = undefined;
    }
    if (outgoing) {
      outgoing.element.style.opacity = '1';
      outgoing.handle?.pause(true);
    }
  }

  function dispose() {
    generation++;
    cancelFade();
    for (const scene of [pending, current, outgoing]) disposeScene(scene);
    pending = current = outgoing = undefined;
  }

  async function refresh() {
    prepare();
    if (capability() === 'reduced-motion') {
      dispose();
      return;
    }
    const token = generation;
    const previous = outgoing;
    const element = document.createElement('div');
    element.className = 'atmosphere-scene';
    element.setAttribute('aria-hidden', 'true');
    const palette = getComputedStyle(document.documentElement);
    for (const name of tokens) element.style.setProperty(name, palette.getPropertyValue(name));
    element.style.backgroundColor = palette.getPropertyValue('--bg');
    element.style.opacity = previous ? '0' : '1';
    const next: Scene = { element, controller: new AbortController() };
    const signal = next.controller.signal;
    pending = next;
    host.append(element);
    signal.addEventListener('abort', () => element.remove(), { once: true });
    let failure: unknown;
    try {
      next.handle = await load(document.documentElement.dataset.family ?? '', signal, element);
    } catch (error) {
      // A static scene still supplies the new color if an optional renderer fails.
      failure = error;
    }
    if (signal.aborted || token !== generation) {
      disposeScene(next);
      return;
    }
    pending = undefined;
    current = next;
    // Visibility is the provider's concern; a hidden tab must not become a permanent manual hold.
    next.handle?.pause(false);
    const duration = capability() === 'light' ? 600 : 900;
    try {
      if (previous) {
        const incoming = element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration,
          easing: 'ease-in-out',
          fill: 'both',
        });
        animations.add(incoming);
        const leaving = previous.element.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration,
          easing: 'ease-in-out',
          fill: 'both',
        });
        animations.add(leaving);
        await Promise.all([incoming.finished.catch(() => {}), leaving.finished.catch(() => {})]);
      }
    } finally {
      if (token === generation) {
        element.style.opacity = '1';
        cancelFade();
        disposeScene(previous);
        outgoing = undefined;
      }
    }
    if (failure && token === generation) throw failure;
  }

  return { prepare, refresh, dispose };
}

export function initAtmosphere() {
  const host = document.querySelector<HTMLElement>('#atmosphere-stage');
  if (!host) return;
  const controller = createAtmosphereController(host);
  let palette: ShellPalette = [];
  let clearPalette = () => {};
  const refresh = () => void controller.refresh().catch((error) => report('atmosphere', error));
  document.addEventListener('astro:before-swap', () => {
    const shell = document.querySelector<HTMLElement>('#shell');
    palette = shell && capability() !== 'reduced-motion' ? captureShellPalette(shell) : [];
    clearPalette();
    controller.prepare();
  });
  document.addEventListener('astro:after-swap', () => {
    try {
      clearPalette = animateShellPalette(
        palette,
        capability() === 'reduced-motion' ? 0 : capability() === 'light' ? 600 : 900,
      );
    } catch (error) {
      report('shell-palette', error);
    }
    palette = [];
  });
  document.addEventListener('astro:page-load', refresh);
  for (const event of ['bh:motion', 'bh:theme']) {
    document.addEventListener(event, () => {
      clearPalette();
      palette = [];
      refresh();
    });
  }
  window.addEventListener('pagehide', () => {
    clearPalette();
    palette = [];
    controller.dispose();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) refresh();
  });
}
