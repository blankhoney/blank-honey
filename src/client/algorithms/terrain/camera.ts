// Fixed viewing area: the camera slowly orbits a point above the lake and leans
// a little with the pointer. The result is a pure function of elapsed seconds
// and the pointer, so the same frame time always produces the same camera and
// the LOD rings never have to follow it.

export type TerrainCameraState = {
  yaw: number;
  pitch: number;
  radius: number;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
};

/** Orbit radius around the view centre, in world units. */
export const terrainOrbitRadius = 820;
/** Camera height above water level; the pitch is solved from this. */
export const terrainCameraHeight = 400;
/** Yaw swing amplitude and rate: a slow drift, never a full turn. */
export const terrainOrbitSwing = 0.16;
export const terrainOrbitRate = 0.045;
/** Slow vertical breathing so the horizon line is never static. */
export const terrainPitchSwing = 0.01;
export const terrainPitchRate = 0.07;
/** Pointer parallax: small yaw/pitch lean plus a shift of the look-at point. */
export const terrainParallaxYaw = 0.055;
export const terrainParallaxPitch = 0.02;
export const terrainParallaxShift = 55;
/** Height of the aim point above water level. */
export const terrainTargetHeight = 260;

function clamp(value: number, min: number, max: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe < min ? min : safe > max ? max : safe;
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
