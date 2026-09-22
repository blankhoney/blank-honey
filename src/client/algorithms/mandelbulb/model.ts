import type { AlgorithmBudget } from '../types';

/**
 * Mandelbulb scene model: budget tier, the CPU clock that drives the uniforms, and the framing that
 * keeps the subject inside the frame. Pure functions only, so the runtime stays in `scene.ts`.
 *
 * Derived from ibrews/mandelbulb-xr (MIT, Copyright (c) 2026 Alex Coulombe / Agile Lens), commit
 * 4b67dde1f420e9bba726d34a396ffb3fd0a2931b — see src/client/vendor/mandelbulb/README.md.
 */

/** Upstream camera: the eye sits 3.2 from the origin, clipping the march to a sphere of r = √1.6. */
const cameraDistance = 3.2;
const clipSphereRadiusSquared = 1.6;
/** Rays are built on a plane 1.6 in front of the eye; uv is measured in that plane. */
const focalLength = 1.6;

/**
 * Silhouette radius of the clip sphere in the uv plane. Every drawn pixel lies inside this disc, so
 * keeping the disc inside the frame is exactly what guarantees the fractal is never cut off.
 */
export const mandelbulbSubjectRadius =
  focalLength * Math.tan(Math.asin(Math.sqrt(clipSphereRadiusSquared) / cameraDistance));

export type MandelbulbQuality = {
  light: boolean;
  steps: number;
  iterations: number;
  shadowSteps: number;
  maxPixels: number;
  maxDpr: number;
};

/**
 * Quality tiers: the full budget may spend 128 raymarch steps, 10 distance-estimator iterations and
 * 16 shadow samples on at most 360k pixels / DPR 1.5; the light tier gets 72 / 7 / 8 on 160k / DPR 1.
 */
const tiers = {
  full: { steps: 128, iterations: 10, shadowSteps: 16, maxPixels: 360_000, maxDpr: 1.5 },
  light: { steps: 72, iterations: 7, shadowSteps: 8, maxPixels: 160_000, maxDpr: 1 },
} as const;

/** A smaller device budget is respected; a missing or broken one falls back to the configured cap. */
function capped(value: unknown, ceiling: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(value, ceiling)
    : ceiling;
}

export function mandelbulbQuality(budget: AlgorithmBudget | undefined): MandelbulbQuality {
  const light = budget?.light === true;
  const tier = light ? tiers.light : tiers.full;
  return {
    light,
    steps: tier.steps,
    iterations: tier.iterations,
    shadowSteps: tier.shadowSteps,
    maxPixels: capped(budget?.maxPixels, tier.maxPixels),
    maxDpr: capped(budget?.maxDpr, tier.maxDpr),
  };
}

export type MandelbulbPointer = { x: number; y: number; active: boolean };

export type MandelbulbMotion = {
  time: number;
  power: number;
  pulse: number;
  yaw: number;
  pitch: number;
};

/** The upstream page seeds its orbit at yaw 0.35 / pitch 0.35 rad and auto-orbits at 0.15 rad/s. */
const baseYaw = 0.35;
const basePitch = 0.35;
const orbitRate = 0.15;
/** Bounded pointer parallax: 0.35 rad of yaw and 0.2 rad of pitch at full deflection. */
const pointerYaw = 0.35;
const pointerPitch = 0.2;
/** Keeps the orbit basis away from the poles, where cross(forward, up) collapses (upstream clamp). */
const pitchLimit = 1.4;

/** Clamps to ±limit; anything that is not a finite number (a broken pointer) means "no deflection". */
function bounded(value: number, limit: number) {
  return Number.isFinite(value) ? Math.min(limit, Math.max(-limit, value)) : 0;
}

/**
 * The single clock of the scene. `power` and `pulse` use the upstream formulas — two incommensurate
 * sines, so the shape wanders instead of ping-ponging — and are handed to the shader as uniforms, so
 * the CPU and the GPU can never drift apart.
 */
export function mandelbulbMotion(seconds: number, pointer?: MandelbulbPointer): MandelbulbMotion {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const x = pointer?.active ? bounded(pointer.x, 1) : 0;
  const y = pointer?.active ? bounded(pointer.y, 1) : 0;
  return {
    time,
    power: 7.5 + 1.4 * Math.sin(time * 0.11) + 0.9 * Math.sin(time * 0.063 + 1.7),
    pulse: 1 + 0.03 * Math.sin(time * 0.8),
    yaw: baseYaw + orbitRate * time + x * pointerYaw,
    pitch: bounded(basePitch + y * pointerPitch, pitchLimit),
  };
}

export type MandelbulbFraming = { centerX: number; centerY: number; zoom: number };

/** Gap between the subject silhouette and the frame edge, in uv units (half the canvas height). */
const padding = 0.06;
/** Subject height as a fraction of the canvas height; the wide layout gets the bolder subject. */
const subjectHeight = 0.58;
/** Right-hand placement on wide viewports, as a fraction of the half width. */
const widePlacement = 0.3;
/** Slightly below centre in both layouts: the tall hero copy keeps the upper band. */
const portraitCenterY = -0.16;
const wideCenterY = -0.1;

function fraction(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * Places the subject for a canvas of `aspect` (width / height). The uv plane spans
 * [-aspect, aspect] × [-1, 1], so the clamp below is the whole "no hard crop" guarantee: the subject
 * disc plus `padding` always fits, and narrow viewports shrink the subject instead of cropping it.
 */
export function mandelbulbFraming(aspect: number): MandelbulbFraming {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? Math.min(4, Math.max(0.3, aspect)) : 1;
  const roomX = Math.max(0.1, ratio - padding);
  const roomY = 1 - padding;
  const radius = Math.min(subjectHeight, roomX * 0.95, roomY * 0.95, ratio * 0.82);
  // Wide viewports move the subject right; portrait centres it and sits lower.
  const wide = fraction((ratio - 0.95) / 0.35);
  const limitX = Math.max(0, roomX - radius);
  const limitY = Math.max(0, roomY - radius);
  return {
    centerX: Math.min(limitX, Math.max(-limitX, widePlacement * ratio * wide)),
    centerY: Math.min(
      limitY,
      Math.max(-limitY, portraitCenterY + (wideCenterY - portraitCenterY) * wide),
    ),
    zoom: mandelbulbSubjectRadius / radius,
  };
}
