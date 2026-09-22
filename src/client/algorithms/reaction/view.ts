/**
 * Mapping between the stage, the display canvas and the simulation grid.
 *
 * The simulation grid is a fixed square that does not follow the viewport, so the display crops it
 * the way `background-size: cover` would rather than stretching the cells with the window, and the
 * pointer is mapped through the same crop so that what the cursor touches is what it shows.
 */

export type SamplingRegion = {
  /** Fraction of the grid width that is on screen, in (0, 1]. */
  x: number;
  /** Fraction of the grid height that is on screen, in (0, 1]. */
  y: number;
};

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Fraction of a `gridWidth`×`gridHeight` grid that covers `width`×`height` without distortion. */
export function sampledRegion(
  width: number,
  height: number,
  gridWidth: number,
  gridHeight: number,
): SamplingRegion {
  const canvasAspect = positive(width) / positive(height);
  const gridAspect = positive(gridWidth) / positive(gridHeight);
  if (canvasAspect > gridAspect) return { x: gridAspect / canvasAspect, y: 1 };
  return { x: 1, y: canvasAspect / gridAspect };
}

/**
 * Stage point (x/y in [-1, 1], positive y up) to the simulation coordinate the display samples
 * there. The inverse of the display shader's `(vUv - 0.5) * uRegion + 0.5`, clamped to the grid.
 */
export function pointerToGrid(
  x: number,
  y: number,
  region: SamplingRegion,
): { x: number; y: number } {
  const screenX = 0.5 + 0.5 * clamp(Number.isFinite(x) ? x : 0, -1, 1);
  const screenY = 0.5 + 0.5 * clamp(Number.isFinite(y) ? y : 0, -1, 1);
  return {
    x: clamp((screenX - 0.5) * region.x + 0.5, 0, 1),
    y: clamp((screenY - 0.5) * region.y + 0.5, 0, 1),
  };
}
