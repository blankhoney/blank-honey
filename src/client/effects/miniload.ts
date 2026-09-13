import type { HeroContext } from '../hero';

export default async function ({ stage, signal, reduced, light }: HeroContext) {
  const { ShaderMount, ditheringFragmentShader, DitheringShapes, DitheringTypes } =
    await import('@paper-design/shaders');
  if (signal.aborted) return;
  // Paper's reusable Bayer/noise shader replaces the reference's redistribution-restricted component.
  const shader = new ShaderMount(
    stage,
    ditheringFragmentShader,
    {
      u_colorBack: [0, 0, 0, 1],
      u_colorFront: [0.42, 0.42, 0.42, 1],
      u_shape: DitheringShapes.simplex,
      u_type: DitheringTypes['8x8'],
      u_pxSize: 2,
      u_fit: 2,
      u_scale: 0.45,
      u_rotation: 0,
      u_originX: 0.5,
      u_originY: 0.5,
      u_offsetX: 0,
      u_offsetY: 0,
      u_worldWidth: 0,
      u_worldHeight: 0,
    },
    undefined,
    reduced ? 0 : 0.14,
    0,
    1,
    light ? 500_000 : 1_800_000,
  );
  signal.addEventListener('abort', () => shader.dispose(), { once: true });
}
