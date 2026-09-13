import { tsParticles, type ISourceOptions, type Container } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';
import { loadEmittersPlugin } from '@tsparticles/plugin-emitters';
let ready: Promise<void> | undefined;
export async function particles(
  id: string,
  options: ISourceOptions,
): Promise<Container | undefined> {
  await (ready ??= Promise.all([loadSlim(tsParticles), loadEmittersPlugin(tsParticles)]).then(
    () => {},
  ));
  const { manualParticles, ...engineOptions } = options;
  const result = await tsParticles.load({
    id,
    options: {
      fullScreen: { enable: false },
      detectRetina: true,
      pauseOnBlur: true,
      pauseOnOutsideViewport: true,
      fpsLimit: 30,
      ...engineOptions,
      particles: {
        number: { value: 0 },
        size: { value: 1 },
        paint: { color: { value: '#b6a27a' } },
        opacity: { value: 0.8 },
        ...engineOptions.particles,
      },
    },
  });
  // v4 exposes explicit insertion through ParticlesManager; no private particle mutations.
  if (result && Array.isArray(manualParticles)) {
    for (const point of manualParticles as ReturnType<typeof dot>[]) {
      result.particles.addParticle(
        {
          x: (point.position.x / 100) * result.canvas.size.width,
          y: (point.position.y / 100) * result.canvas.size.height,
        },
        point.options,
      );
    }
    result.draw(true);
  }
  return result;
}
export type { ISourceOptions };
export function dot(x: number, y: number, size: number, color: string) {
  return {
    position: { x, y },
    options: { size: { value: size }, paint: { color: { value: color } } },
  };
}
export const seed = (i: number) => {
  const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};
export type PresetContext = { count: number; mobile: boolean; light: boolean };
