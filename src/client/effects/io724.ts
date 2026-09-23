import type { HeroContext } from '../hero';

export default async function ({ stage, signal, reduced, light }: HeroContext) {
  if (reduced) return;
  const { default: Fluid } = await import('webgl-fluid-enhanced');
  if (signal.aborted) return;
  const fluid = new Fluid(stage);
  stage.style.position = 'absolute';
  fluid.setConfig({
    simResolution: light ? 64 : 128,
    dyeResolution: light ? 256 : 512,
    densityDissipation: 1,
    velocityDissipation: 0.2,
    curl: 30,
    splatRadius: 0.25,
    splatForce: 6000,
    backgroundColor: '#000000',
    hover: true,
    bloom: !light,
    sunrays: !light,
  });
  fluid.start();
  fluid.multipleSplats(7);
  // A lazy import can finish while the tab is already hidden; park the loop until it is visible.
  if (document.hidden) fluid.stop();
  // The upstream stop releases listeners and RAF; explicitly release its WebGL context too.
  signal.addEventListener(
    'abort',
    () => {
      fluid.stop();
      const canvas = stage.querySelector('canvas');
      const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    },
    { once: true },
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      // Only stop and start: a resume keeps the dye, so the opening splats are never re-injected.
      if (document.hidden) fluid.stop();
      else fluid.start();
    },
    { signal },
  );
}
