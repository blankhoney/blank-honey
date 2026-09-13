import type { PresetContext, ISourceOptions } from '../particles';
export default function ({ count, light }: PresetContext): ISourceOptions {
  return {
    particles: {
      number: { value: Math.floor(count * 0.6) },
      paint: { color: { value: ['#dbc6a0', '#83b5c1', '#a2a483'] } },
      shape: { type: 'square' },
      size: { value: { min: 0.5, max: 2.2 } },
      opacity: { value: { min: 0.15, max: 0.8 } },
      move: {
        enable: true,
        direction: 'left',
        speed: light ? 0.8 : 1.6,
        straight: true,
        outModes: 'out',
      },
      links: { enable: false },
    },
  };
}
