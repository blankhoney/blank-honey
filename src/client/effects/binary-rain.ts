import {
  getRandom,
  getRangeMax,
  getRangeMin,
  tsParticles,
  type IShapeDrawer,
  type ISourceOptions,
  type RangeValue,
} from '@tsparticles/engine';
import { loadMatrixPreset } from '@tsparticles/preset-matrix';

/** Adapted from @tsparticles/shape-matrix 4.4.0 (MIT): only the alphabet/font differ. */
export function createBinaryDrawer(): IShapeDrawer {
  const states = new WeakMap<object, { char: string; elapsed: number; interval: number }>();
  const character = () => (getRandom() < 0.5 ? '0' : '1');
  return {
    draw({ context, radius, particle, delta, fill, stroke }) {
      const data = particle.shapeData as { interval?: RangeValue } | undefined;
      const min = getRangeMin(data?.interval ?? 100);
      const max = getRangeMax(data?.interval ?? 2000);
      const interval = () => min + getRandom() * (max - min);
      let state = states.get(particle);
      if (!state) {
        state = { char: character(), elapsed: 0, interval: interval() };
        states.set(particle, state);
      }
      state.elapsed += delta.value;
      if (state.elapsed >= state.interval) {
        state.char = character();
        state.elapsed -= state.interval;
        state.interval = interval();
      }
      context.font = `${Math.round(radius * 2)}px "VT323", monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      if (fill) context.fillText(state.char, 0, 0);
      if (stroke) context.strokeText(state.char, 0, 0);
    },
  };
}

let ready: Promise<void> | undefined;
export function loadBinaryRain() {
  return (ready ??= loadMatrixPreset(tsParticles)
    .then(() =>
      tsParticles.pluginManager.register((engine) => {
        engine.pluginManager.addShape(['binary-rain'], () => Promise.resolve(createBinaryDrawer()));
      }),
    )
    .catch((error) => {
      ready = undefined;
      throw error;
    }));
}

/** Explicit limits override the shared particle helper's zero-count default. */
export function binaryRainOptions(
  light: boolean,
  width: number,
  height: number,
  background: string,
): ISourceOptions {
  const area = Math.max(0, width) * Math.max(0, height);
  const count = Math.min(light ? 72 : 180, Math.max(24, Math.round(area / (light ? 18000 : 8500))));
  return {
    preset: 'matrix',
    fpsLimit: light ? 15 : 24,
    detectRetina: false,
    // The scene owner combines visibility with its own outgoing-scene pause.
    pauseOnBlur: false,
    pauseOnOutsideViewport: false,
    background: { color: background },
    trail: { enable: true, length: light ? 12 : 20, fill: { color: background } },
    particles: {
      number: { value: count, density: { enable: false } },
      shape: {
        type: 'binary-rain',
        options: { 'binary-rain': { interval: { min: 80, max: 240 } } },
      },
      size: { value: { min: 7, max: 10 } },
      opacity: { value: { min: 0.45, max: 0.9 } },
      paint: {
        fill: {
          enable: true,
          color: {
            value: ['#3bebba', '#55dfbf', '#26c9a6', '#67eacb', '#cf78c6'],
            animation: { l: { enable: true, speed: 18, sync: false, min: 32, max: 80 } },
          },
        },
      },
      effect: { type: 'shadow', options: { shadow: { color: '#2ddbb8', blur: light ? 0 : 4 } } },
      move: {
        enable: true,
        direction: 'bottom',
        straight: true,
        speed: { min: 2.5, max: 6 },
        outModes: { default: 'out' },
      },
      links: { enable: false },
    },
  };
}
