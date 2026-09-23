// Fixed viewing area: the camera holds a long view down the valley from above
// the lake and drifts only slightly with the clock and the pointer. The result
// is a pure function of elapsed seconds and the pointer, so the same frame time
// always produces the same camera and the LOD rings never have to follow it.

export type TerrainCameraState = {
  yaw: number;
  pitch: number;
  radius: number;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
};

/** Orbit radius around the view centre, in world units. */
export const terrainOrbitRadius = 1500;
/** Camera height above water level; the pitch is solved from this. */
export const terrainCameraHeight = 680;
/** Yaw swing amplitude and rate: a slow drift, never a full turn. */
export const terrainOrbitSwing = 0.025;
export const terrainOrbitRate = 0.045;
/** Pitch swing is pinned to zero: the shot is held and the horizon stays put. */
export const terrainPitchSwing = 0;
export const terrainPitchRate = 0.07;
/** Pointer parallax: small yaw/pitch lean plus a shift of the look-at point. */
export const terrainParallaxYaw = 0.055;
export const terrainParallaxPitch = 0.02;
export const terrainParallaxShift = 55;
/** Height of the aim point above water level. */
export const terrainTargetHeight = 480;

function clamp(value: number, min: number, max: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe < min ? min : safe > max ? max : safe;
}

/**
 * Vertical field of view for a viewport, so the shot keeps the same framing
 * across short and wide screens instead of cropping the banks off a narrow one.
 *
 * Landscape screens hold the designed 52 degrees on the vertical axis. A
 * portrait screen instead holds it on the horizontal axis — the axis that
 * decides how much of the valley is in shot — by widening the vertical angle
 * until the horizontal one is back to 52 degrees. Below the aspect where that
 * would need more than 100 degrees of vertical, the vertical angle is capped
 * and the framing narrows again rather than stretching to an unusable fisheye.
 *
 * Nothing else about the camera moves: this returns an angle only, so the
 * position, the aim point, the height field and the fog are untouched.
 */
export function terrainFieldOfView(width: number, height: number): number {
  // Each unusable dimension is replaced by one before computing the aspect.
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  const aspect = safeWidth / safeHeight;
  // 26 is half the designed 52 degrees: the tangent of the half angle is what
  // a perspective projection needs, and on a portrait viewport dividing it by
  // the aspect solves for the vertical angle whose horizontal one is 52.
  const vertical =
    (360 / Math.PI) * Math.atan(Math.tan((26 * Math.PI) / 180) / Math.min(1, aspect));
  return Math.min(100, vertical);
}

export function terrainCamera(seconds: number, pointerX = 0, pointerY = 0): TerrainCameraState {
  const time = Number.isFinite(seconds) ? seconds : 0;
  const offsetX = clamp(pointerX, -1, 1);
  const offsetY = clamp(pointerY, -1, 1);
  const yaw = terrainOrbitSwing * Math.sin(time * terrainOrbitRate) + offsetX * terrainParallaxYaw;
  const target = {
    x: offsetX * terrainParallaxShift,
    y: terrainTargetHeight + offsetY * 12,
    z: offsetY * terrainParallaxShift * 0.5,
  };
  const pitch =
    Math.asin(clamp((terrainCameraHeight - target.y) / terrainOrbitRadius, -0.99, 0.99)) +
    terrainPitchSwing * Math.sin(time * terrainPitchRate) -
    offsetY * terrainParallaxPitch;
  const ground = Math.cos(pitch) * terrainOrbitRadius;
  return {
    yaw,
    pitch,
    radius: terrainOrbitRadius,
    position: {
      x: target.x + Math.sin(yaw) * ground,
      y: target.y + Math.sin(pitch) * terrainOrbitRadius,
      z: target.z + Math.cos(yaw) * ground,
    },
    target,
  };
}
