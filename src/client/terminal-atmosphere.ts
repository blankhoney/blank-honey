import { particles } from './particles';
import { capability } from './preferences';
import { binaryRainOptions, loadBinaryRain } from './effects/binary-rain';
import { mountCipherLines } from './effects/cipher-lines';
import type { AtmosphereHandle } from './atmosphere';

let sequence = 0;

/** Official Matrix motion/trails with a binary-only drawer and decorative Baffle text. */
export async function mountAtmosphere(
  signal: AbortSignal,
  host?: HTMLElement,
): Promise<AtmosphereHandle | undefined> {
  if (signal.aborted || capability() === 'reduced-motion') return;
  const light = capability() === 'light';
  const layer = document.createElement('div');
  layer.className = 'terminal-atmosphere';
  layer.dataset.mode = light ? 'light' : 'full';
  layer.setAttribute('aria-hidden', 'true');
  const rain = document.createElement('div');
  rain.id = `binary-rain-${++sequence}`;
  rain.className = 'binary-rain';
  layer.append(rain);
  (host ?? document.body).append(layer);
  const cipher = mountCipherLines(layer, signal, light);
  let engine: Awaited<ReturnType<typeof particles>>;
  let disposed = false;
  let held = false;
  function visibility() {
    const paused = held || document.hidden;
    layer.dataset.paused = String(paused);
    cipher.pause(paused);
    if (paused) engine?.pause();
    // Loading already starts playback; v4 play() is not idempotent and would add a RAF chain.
    else if (engine && !engine.animationStatus) engine.play();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('visibilitychange', visibility);
    signal.removeEventListener('abort', dispose);
    cipher.dispose();
    engine?.destroy();
    layer.remove();
  }
  signal.addEventListener('abort', dispose, { once: true });
  try {
    await loadBinaryRain();
    if (disposed || signal.aborted) return;
    const background = getComputedStyle(host ?? document.documentElement)
      .getPropertyValue('--bg')
      .trim();
    engine = await particles(
      rain.id,
      binaryRainOptions(light, innerWidth, innerHeight, background),
    );
    if (disposed || signal.aborted) {
      engine?.destroy();
      return;
    }
    document.addEventListener('visibilitychange', visibility, { signal });
    visibility();
    return {
      element: layer,
      pause(paused) {
        if (disposed) return;
        held = paused;
        visibility();
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
