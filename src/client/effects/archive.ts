import { dot, seed, type PresetContext, type ISourceOptions } from '../particles';
export default function ({ count }: PresetContext): ISourceOptions {
  return {
    manualParticles: Array.from({ length: Math.floor(count * 0.8) }, (_, i) => {
      const u = seed(i) * Math.PI * 2,
        r = Math.sqrt(seed(i + 1000)) * 28,
        gap = (Math.floor(u * 7) % 3) * 2;
      return dot(
        67 + Math.cos(u) * (r + gap),
        48 + Math.sin(u) * r * 0.95,
        0.6 + seed(i + 2000) * 1.8,
        i % 5 ? '#a2a889' : '#d19d83',
      );
    }),
    particles: {
      shape: { type: 'square' },
      move: { enable: true, speed: 0.1, direction: 'top', distance: 7 },
      links: { enable: false },
    },
  };
}
