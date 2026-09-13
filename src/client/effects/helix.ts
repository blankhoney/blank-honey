import { dot, seed, type PresetContext, type ISourceOptions } from '../particles';
export default function ({ count }: PresetContext): ISourceOptions {
  return {
    manualParticles: Array.from({ length: count }, (_, i) => {
      const t = (i / count) * Math.PI * 6,
        lane = i % 2 ? Math.PI : 0;
      return dot(
        39 + t * 2.3 + Math.cos(t + lane) * 5,
        48 + Math.sin(t + lane) * 22 + seed(i) * 2,
        0.6 + seed(i + 300) * 1.1,
        i % 2 ? '#dfb283' : '#8ab4b6',
      );
    }),
    particles: { move: { enable: true, speed: 0.06, distance: 3 }, links: { enable: false } },
  };
}
