/**
 * Camera uniforms for the black hole scene.
 *
 * These are the upstream `Model` camera values (see
 * `src/client/vendor/blackhole/source/model/model.js` and `.../source/camera_view/camera_view.js`)
 * for a static observer. Two upstream terms are exactly identities at a fixed radius and are
 * therefore not built here: a zero 4-velocity makes the Lorentz boost the identity, and an orbit
 * azimuth of phi = 0 makes the rotation into the orbit frame the identity as well, so the camera
 * rotation alone maps the static reference frame to the camera frame. `tests/blackhole.test.ts`
 * checks this reduction against a direct port of the upstream matrix pipeline.
 *
 * Units are the model's own: 1 is the event horizon, 3 the innermost stable circular orbit, and the
 * disc runs from 3 to 12 (`disc.ts`).
 */

export type CameraUniforms = {
  /** Schwarzschild coordinates (t, r, theta, phi) of the observer. */
  cameraPosition: [number, number, number, number];
  /** Observer position in (pseudo-)Cartesian coordinates. */
  p: [number, number, number];
  /** Observer 4-velocity in the rotated Schwarzschild frame, as the shader expects it. */
  kS: [number, number, number, number];
  /** Camera frame base vectors: time, right, up and view direction (spatial components only). */
  eTau: [number, number, number];
  eW: [number, number, number];
  eH: [number, number, number];
  eD: [number, number, number];
};

export type ObserverPose = {
  /** Observer radius; must stay outside the disc's inner edge and above the horizon. */
  radius?: number;
  /** Elevation above the disc plane, in radians. */
  elevation?: number;
  /** Schwarzschild time of the observer, which drives the disc pattern. */
  time?: number;
  /** Bounded look-around offsets; see `pointerOrbit`. */
  yaw?: number;
  pitch?: number;
};

/** Distance from the singularity. Upstream's demo orbits at about 35; the hero keeps a fixed 30. */
export const CAMERA_RADIUS = 30;
/** Elevation above the disc plane: slightly lower than the upstream demo's default 7.05 degrees. */
export const CAMERA_ELEVATION = (6 * Math.PI) / 180;
/** Vertical field of view, unchanged from the upstream demo. */
export const CAMERA_FOV_Y = (50 * Math.PI) / 180;
/**
 * Bounds of the pointer look-around. The view never tumbles and never leaves the disc; the hero
 * narrows the upstream demo's free look to a restrained drift so the subject keeps its place.
 */
export const POINTER_YAW_LIMIT = 0.09;
export const POINTER_PITCH_LIMIT = 0.045;
/** Approach rate of the pointer orbit, per second: high enough to follow, low enough to stay calm. */
export const ORBIT_RATE = 3;

/**
 * Viewport aspect at which the framed composition switches from the wide to the narrow layout.
 * Above it the copy sits beside the subject, below it the copy sits above it.
 */
export const VIEW_CENTER_ASPECT = 1.15;

/**
 * Composition of the frame, as the UV of the viewport that the centre of the frame shows: (0.5, 0.5)
 * is upstream's centred view, and y counts up from the bottom. The wide layout keeps the subject on
 * the right of the copy, at the middle of the height; the narrow layout lowers it, so on a phone it
 * sits in the lower 66% of the height with the copy above it. Both are the hero's own framing.
 */
const VIEW_CENTER_WIDE: [number, number] = [0.7, 0.5];
const VIEW_CENTER_NARROW: [number, number] = [0.5, 0.34];

/**
 * The view centre for a viewport of the given aspect, as the `view_center` uniform takes it: a
 * fresh pair, so a caller cannot change the layout for everyone else. An aspect that is not a
 * positive finite number gets the narrow layout, which keeps the subject clear of the copy.
 */
export function blackHoleFraming(aspect: number): [number, number] {
  const wide = Number.isFinite(aspect) && aspect >= VIEW_CENTER_ASPECT;
  const pair = wide ? VIEW_CENTER_WIDE : VIEW_CENTER_NARROW;
  return [pair[0], pair[1]];
}

/** The static observer's clock rate dt/dtau = 1/sqrt(1-u), which slows its own time coordinate. */
export function staticClockRate(radius: number): number {
  if (!Number.isFinite(radius) || radius <= 1)
    throw new RangeError('Observer radius must be finite and outside the horizon');
  return 1 / Math.sqrt(1 - 1 / radius);
}

/**
 * Evaluates the camera frame at the given pose. Everything is validated as finite here rather than
 * at draw time, so a bad pose is a scene failure (still image) instead of a black frame.
 */
export function staticObserverUniforms(pose: ObserverPose = {}): CameraUniforms {
  const radius = pose.radius ?? CAMERA_RADIUS;
  const elevation = pose.elevation ?? CAMERA_ELEVATION;
  const time = pose.time ?? 0;
  const yaw = pose.yaw ?? 0;
  const pitch = pose.pitch ?? 0;
  for (const [name, value] of Object.entries({ radius, elevation, time, yaw, pitch })) {
    if (!Number.isFinite(value)) throw new RangeError(`Observer ${name} must be finite`);
  }
  if (radius <= 1) throw new RangeError('Observer radius must stay outside the horizon');
  if (elevation <= -Math.PI / 2 || elevation >= Math.PI / 2)
    throw new RangeError('Observer elevation must stay off the poles');

  // staticClockRate guards the radius; the camera is a static observer, so u = 1/r and v = 1/dt/dtau.
  const v = 1 / staticClockRate(radius);
  const cosTheta = Math.sin(elevation);
  const sinTheta = Math.cos(elevation);
  // phi = 0 in the orbit frame: (sin theta cos phi, sin theta sin phi, cos theta).
  const radial: [number, number, number] = [sinTheta, 0, cosTheta];
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  // Static reference frame at (theta, phi): the radial, polar and azimuthal base vectors, with the
  // radial one scaled by v as the upstream model stores it. The time base vector is purely temporal.
  const eRadial: [number, number, number] = [v * radial[0], 0, v * radial[2]];
  const ePolar: [number, number, number] = [cosTheta, 0, -sinTheta];
  const eAzimuth: [number, number, number] = [0, 1, 0];
  // Rows 1 to 3 of the upstream camera rotation, applied to the three spatial base vectors.
  const combine = (
    radialPart: number,
    polarPart: number,
    azimuthPart: number,
  ): [number, number, number] => [
    radialPart * eRadial[0] + polarPart * ePolar[0] + azimuthPart * eAzimuth[0],
    radialPart * eRadial[1] + polarPart * ePolar[1] + azimuthPart * eAzimuth[1],
    radialPart * eRadial[2] + polarPart * ePolar[2] + azimuthPart * eAzimuth[2],
  ];
  return {
    cameraPosition: [time, radius, Math.acos(cosTheta), 0],
    p: [radius * radial[0], radius * radial[1], radius * radial[2]],
    // L[0] is [1, 0, 0, 0] for every yaw and pitch, so only its first term survives.
    kS: [staticClockRate(radius), 0, 0, 0],
    eTau: [0, 0, 0],
    eW: combine(-sinYaw, 0, cosYaw),
    eH: combine(-cosYaw * sinPitch, -cosPitch, -sinYaw * sinPitch),
    eD: combine(cosYaw * cosPitch, -sinPitch, sinYaw * cosPitch),
  };
}

/**
 * Maps the stage pointer (x/y in [-1, 1], y up) to bounded yaw/pitch offsets: the right and top of
 * the stage turn the view right and up. An inactive pointer returns to the neutral view.
 */
export function pointerOrbit(pointer: { x: number; y: number; active: boolean }): {
  yaw: number;
  pitch: number;
} {
  if (!pointer.active) return { yaw: 0, pitch: 0 };
  const x = Number.isFinite(pointer.x) ? Math.max(-1, Math.min(1, pointer.x)) : 0;
  const y = Number.isFinite(pointer.y) ? Math.max(-1, Math.min(1, pointer.y)) : 0;
  return { yaw: x * POINTER_YAW_LIMIT, pitch: y * POINTER_PITCH_LIMIT };
}

/**
 * Frame-rate independent exponential approach. `delta` is clamped the way the hero runtime clamps
 * its own frame delta, so a resumed or throttled tab cannot jump the view; delta 0 changes nothing.
 */
export function smoothToward(current: number, target: number, delta: number, rate: number): number {
  if (!Number.isFinite(current)) return Number.isFinite(target) ? target : 0;
  if (!Number.isFinite(target)) return current;
  const step = Math.min(Math.max(Number.isFinite(delta) ? delta : 0, 0), 0.1);
  return current + (target - current) * (1 - Math.exp(-rate * step));
}
