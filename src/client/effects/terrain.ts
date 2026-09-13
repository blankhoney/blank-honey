import { dot, type PresetContext, type ISourceOptions } from '../particles';
export default function ({ count }: PresetContext): ISourceOptions {
  const rows = 16,
    columns = Math.floor(count / rows);
  return {
    manualParticles: Array.from({ length: columns * rows }, (_, i) => {
      const x = i % columns,
        y = Math.floor(i / columns);
      return dot(
        32 + (x / columns) * 62 + y * 0.3,
        31 + y * 2.4 + Math.sin((x / columns) * 7 + y * 0.3) * 7,
        0.7 + y * 0.025,
        y % 3 ? '#a5b38c' : '#d2b681',
      );
    }),
    particles: {
      move: { enable: false },
      opacity: {
        value: { min: 0.35, max: 0.9 },
        animation: { enable: true, speed: 0.3, sync: false },
      },
      links: { enable: false },
    },
  };
}
