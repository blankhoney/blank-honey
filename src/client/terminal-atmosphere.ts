import { particles, dot } from './particles';
import { capability } from './preferences';

/** Quiet Topography from the supplied prototype, rendered by the existing particle engine. */
export async function mountAtmosphere(signal: AbortSignal) {
  if (capability() === 'reduced-motion') return;
  const layer = document.createElement('div');
  layer.id = 'terminal-atmosphere';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  const color = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
  const light = capability() === 'light';
  const columns = light ? 18 : 28;
  const points = Array.from({ length: columns * 12 }, (_, index) => {
    const x = index % columns;
    const y = Math.floor(index / columns);
    return dot(
      12 + (x * 76) / columns + y * 0.3,
      20 + y * 4 + Math.sin(x * 0.21 + y * 0.32) * 6,
      1 + y / 18,
      color,
    );
  });
  const engine = await particles(layer.id, {
    fpsLimit: light ? 15 : 24,
    manualParticles: points,
    particles: {
      number: { value: 0 },
      move: { enable: true, speed: 0.08, outModes: { default: 'bounce' } },
      links: { enable: true, distance: 60, opacity: 0.12, color, width: 0.5 },
      opacity: { value: 0.38 },
    },
  });
  const dispose = () => {
    engine?.destroy();
    layer.remove();
  };
  if (signal.aborted) dispose();
  else signal.addEventListener('abort', dispose, { once: true });
}
