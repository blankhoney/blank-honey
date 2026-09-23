/**
 * Mapping between the stage, the display canvas and the simulation grid.
 *
 * The simulation grid is a fixed square that does not follow the viewport, so the base window crops
 * it the way `background-size: cover` would: the window has the aspect of the canvas, shows the
 * whole grid on one axis and crops the other, which keeps the cells square instead of stretching
 * them with the window. The display then does not print that window linearly: it lenses the window
 * through a conformal exponential, so the far side of the plate reads larger while every pixel keeps
 * the same scale on both axes. The pointer is mapped through the same two steps, lens included, so
 * what the cursor touches is what it shows.
 */

export type SamplingRegion = {
  /** Fraction of the grid width that is on screen, in (0, 1]. */
  x: number;
  /** Fraction of the grid height that is on screen, in (0, 1]. */
  y: number;
};

/**
 * Lens strength of the display's conformal view, in radians of turn per unit of the base window.
 *
 * The window is read as complex `q` and mapped by `scale * (1 - exp(-warp * q))`. That map is
 * conformal, so locally it only rotates and grows the field instead of shearing it: the plate's
 * right side reads magnified rather than stretched, and the pointer stays on the same map. It is
 * baked into the shader source, not passed as a uniform, so the scene needs no extra state.
 */
export const REACTION_VIEW_WARP = 2.2;
/**
 * How far the lens opens. `scale` is the asymptote of the magnified side: `uv - 0.5` grows towards
 * `scale` as the window runs out to the right, so the plate can never reach further than `scale`
 * grid units from the centre there, while the shrinking side runs past the grid edge and is caught
 * by the display clamp.
 */
export const REACTION_VIEW_SCALE = 0.38;

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Fraction of a `gridWidth`×`gridHeight` grid the isotropic base window covers on `width`×`height`.
 *
 * Cover, not fit: the window has the canvas aspect and is as large as the grid allows, so it spans
 * the whole grid on the less extreme axis and crops the other. A wide canvas therefore keeps the
 * full grid width and shows fewer rows (`y < 1`); a narrow one keeps the full grid height.
 *
 * This is the base window only. It is no longer the whole story of what lands on the canvas: the
 * display lenses the window with `REACTION_VIEW_WARP`/`REACTION_VIEW_SCALE` after the crop, so the
 * screen position of a grid point is `sampledRegion` and then the lens, on both the display and the
 * pointer.
 */
export function sampledRegion(
  width: number,
  height: number,
  gridWidth: number,
  gridHeight: number,
): SamplingRegion {
  const canvasAspect = positive(width) / positive(height);
  const gridAspect = positive(gridWidth) / positive(gridHeight);
  if (canvasAspect > gridAspect) return { x: 1, y: gridAspect / canvasAspect };
  return { x: canvasAspect / gridAspect, y: 1 };
}

/**
 * Stage point (x/y in [-1, 1], positive y up) to the simulation coordinate the display samples
 * there. Same two steps the display shader takes, expression for expression: the base window
 * `(screen - 0.5) * region`, then the conformal lens `0.5 + scale * (1 - exp(-warp*qx) * cos/sin)`,
 * and only then the clamp into the grid. Non-finite input reads as the stage centre, so a broken
 * pointer never drags the brush somewhere else.
 */
export function pointerToGrid(
  x: number,
  y: number,
  region: SamplingRegion,
): { x: number; y: number } {
  const screenX = 0.5 + 0.5 * clamp(Number.isFinite(x) ? x : 0, -1, 1);
  const screenY = 0.5 + 0.5 * clamp(Number.isFinite(y) ? y : 0, -1, 1);
  const qx = (screenX - 0.5) * region.x;
  const qy = (screenY - 0.5) * region.y;
  const angle = REACTION_VIEW_WARP * qy;
  const magnitude = Math.exp(-REACTION_VIEW_WARP * qx);
  return {
    x: clamp(0.5 + REACTION_VIEW_SCALE * (1 - magnitude * Math.cos(angle)), 0, 1),
    y: clamp(0.5 + REACTION_VIEW_SCALE * magnitude * Math.sin(angle), 0, 1),
  };
}
