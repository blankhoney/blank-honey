import { dot, seed, type PresetContext, type ISourceOptions } from '../particles';
export default function ({ count, mobile }: PresetContext): ISourceOptions {
  return {
    manualParticles: Array.from({ length: count }, (_, i) => {
      const u = seed(i) * Math.PI * 2,
        v = seed(i + 2000) * Math.PI * 2;
      const radius = 21 + Math.cos(v) * 7;
      return dot(
        (mobile ? 66 : 67) + Math.cos(u) * radius,
        47 + Math.sin(u) * radius * 0.73 + Math.sin(v) * 6,
        0.5 + seed(i + 4000) * 1.7,
        Math.sin(v) > 0 ? '#d7b27b' : '#83aaa1',
      );
    }),
    particles: {
      move: { enable: true, speed: 0.08, direction: 'none', distance: 8 },
      links: { enable: false },
    },
  };
}
