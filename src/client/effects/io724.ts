import type { HeroContext } from '../hero';
import type Fluid from 'webgl-fluid-enhanced';

/** The hero's three inks. A seed names one of them and upstream reads it back as hue and value. */
export const FLUID_PALETTE = ['#326b76', '#b17b52', '#728e8d'] as const;

/** One opening ink: a screen ratio for the position, plus the velocity and the colour of the dye. */
type FluidSeed = { x: number; y: number; dx: number; dy: number; color: string };

/**
 * The four opening inks, in paint order. They sit in the lower right, clear of the copy on the
 * left. x and y are ratios of the stage box: x counts from the left, y from the top. Colours come
 * from FLUID_PALETTE, which is what keeps them inside upstream's brightness range (see seedFluid).
 */
export const FLUID_SEEDS = [
  { x: 0.78, y: 0.65, dx: -162.5, dy: 65, color: FLUID_PALETTE[0] },
  { x: 0.88, y: 0.76, dx: -105, dy: -70, color: FLUID_PALETTE[1] },
  { x: 0.58, y: 0.83, dx: 175, dy: 20, color: FLUID_PALETTE[0] },
  { x: 0.7, y: 0.54, dx: 45, dy: -125, color: FLUID_PALETTE[1] },
] as const satisfies readonly FluidSeed[];

/**
 * Paints the opening inks once, through the public splat API.
 *
 * The two axes are scaled by different boxes on purpose: in 0.8.0 `splatAtLocation` takes x over
 * `canvas.width` (the drawing buffer, in device pixels) and y over `canvas.clientHeight` (the css
 * box). Scaling each ratio by that same box is what cancels the mismatch, so one screen ratio lands
 * on one spot at every device pixel ratio.
 *
 * The colour travels as a one-colour palette rather than as the call's HEX argument, because that
 * argument takes upstream's raw-byte branch (0..255, then x10) and would clip the dye. A palette
 * lets `generateColor` rebuild the ink from hue and saturation, bounded by the boosted brightness.
 * The brightness, the radius and the hero palette are restored in the finally, so the seeds borrow
 * them for one pass and the pointer keeps the hero's own look.
 */
export function seedFluid(
  fluid: Pick<Fluid, 'splatAtLocation' | 'setConfig'>,
  canvas: Pick<HTMLCanvasElement, 'width' | 'clientHeight'>,
): void {
  try {
    // Short-lived boost, so the opening ink is fat and bright enough to survive the first frames.
    fluid.setConfig({ brightness: 0.45, splatRadius: 0.5 });
    for (const seed of FLUID_SEEDS) {
      fluid.setConfig({ colorPalette: [seed.color] });
      fluid.splatAtLocation(seed.x * canvas.width, seed.y * canvas.clientHeight, seed.dx, seed.dy);
    }
  } finally {
    fluid.setConfig({ colorPalette: [...FLUID_PALETTE], brightness: 0.3, splatRadius: 0.2 });
  }
}

export default async function ({ stage, signal, reduced, light }: HeroContext) {
  if (reduced) return;
  const { default: Fluid } = await import('webgl-fluid-enhanced');
  if (signal.aborted) return;
  const fluid = new Fluid(stage);
  stage.style.position = 'absolute';
  fluid.setConfig({
    simResolution: light ? 64 : 128,
    dyeResolution: light ? 256 : 512,
    densityDissipation: 0,
    velocityDissipation: 0.15,
    curl: 0,
    splatRadius: 0.2,
    splatForce: 4200,
    backgroundColor: '#000000',
    hover: true,
    colorful: true,
    colorUpdateSpeed: 0.15,
    colorPalette: [...FLUID_PALETTE],
    brightness: 0.3,
    bloom: !light,
    bloomIntensity: 0.22,
    bloomThreshold: 0.8,
    bloomSoftKnee: 0.7,
    sunrays: false,
  });
  fluid.start();
  // The inks go in once, on the canvas the fluid owns.
  const surface = stage.querySelector('canvas');
  if (surface) seedFluid(fluid, surface);
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
      // Only stop and start: a resume keeps the dye, so it never seeds a second time.
      if (document.hidden) fluid.stop();
      else fluid.start();
    },
    { signal },
  );
}
