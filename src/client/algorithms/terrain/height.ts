// The terrain height field: a pure, deterministic function of world XZ and a
// fixed seed. Nothing here reads the camera, the clock or the viewport, so the
// GPU vertex shader, the fragment shader's finite differences and this CPU
// reference all agree for a given (x, z).
//
// The arithmetic mirrors the GLSL in ./glsl.ts statement by statement, with
// Math.fround at every step. The upstream Dave Hoskins hash depends on float32
// rounding, so a double-precision evaluation drifts away from what the GPU
// renders; the float32 emulation keeps the two within rounding noise. See
// ../../vendor/terrain/README.md for what was copied from upstream.

const f = Math.fround;

/** World units per noise unit. One noise cell spans 1500 world units. */
export const terrainFrequency = 1 / 1500;
export const terrainSeedX = 137.7;
export const terrainSeedZ = 419.2;
/** Domain warp strength of the 4-octave fBM pair that bends the sample point. */
export const terrainWarp = 0.85;
/** Upstream NOISE_GLSL defaults, injected into the vendored fbm/ridgedFBM. */
export const terrainPersistence = 0.5;
export const terrainLacunarity = 2.05;
/** h01 -> world units. Water sits at `terrainWaterLevel`, h01 `terrainHeightRef`. */
export const terrainHeightScale = 1700;
export const terrainHeightRef = 0.26;
export const terrainWaterLevel = 0;
/** Half extent of the innermost LOD layer; the outer rings nest outward. */
export const terrainViewHalf = 1000;
/** Meridian of the meandering valley channel, radians. */
export const terrainFlowDirection = 0.7;
export const terrainFlowWidth = 0.5;
export const terrainFlowMeander = 1.7;
export const terrainFlowMeanderScale = 0.3;

/** Safe world-space bounds of the height field, used for frustum bounds. */
export const terrainHeightCeiling = 2000;
export const terrainHeightFloor = -400;

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value;
}

/**
 * GLSL smoothstep. Edges are always given ascending here: the reversed-edge
 * form is undefined in GLSL, so an inverted ramp is written as 1 - smoothstep.
 */
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp(f(f(x - edge0) / f(edge1 - edge0)), 0, 1);
  return f(f(t * t) * f(3 - f(2 * t)));
}

function mix(a: number, b: number, t: number) {
  return f(a + f(f(b - a) * t));
}

// --- hash without sine precision issues (Dave Hoskins) — port of hash12 ------
function fract32(value: number) {
  return f(value - Math.floor(value));
}

function hash12(px: number, py: number) {
  let p3x = fract32(f(px * 0.1031));
  let p3y = fract32(f(py * 0.1031));
  const p3z = p3x;
  const dot = f(
    f(f(p3x * f(p3y + 33.33)) + f(p3y * f(p3z + 33.33))) + f(p3z * f(p3x + 33.33)),
  );
  p3x = f(p3x + dot);
  p3y = f(p3y + dot);
  return fract32(f(f(p3x + p3y) * f(p3z + dot)));
}

/** Quintic value noise: the .x channel of upstream's vnoised2 / vnoise. */
function vnoise(px: number, py: number) {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = f(px - ix);
  const fy = f(py - iy);
  const ux = f(f(f(fx * fx) * fx) * f(f(fx * f(f(fx * 6) - 15)) + 10));
  const uy = f(f(f(fy * fy) * fy) * f(f(fy * f(f(fy * 6) - 15)) + 10));
  const a = hash12(ix, iy);
  const b = hash12(f(ix + 1), iy);
  const c = hash12(ix, f(iy + 1));
  const d = hash12(f(ix + 1), f(iy + 1));
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
}

/** p = ROT2 * p * lacunarity, with upstream's ROT2 = mat2(0.80,-0.60,0.60,0.80). */
function rotate2(x: number, y: number) {
  const rx = f(f(0.8 * x) + f(0.6 * y));
  const ry = f(f(-0.6 * x) + f(0.8 * y));
  return { x: f(rx * terrainLacunarity), y: f(ry * terrainLacunarity) };
}

/** Upstream fbm4: the vendored 4-octave fBM with its octave count baked in. */
function fbm4(px: number, py: number) {
  let x = px;
  let y = py;
  let amplitude = 0.5;
  let sum = 0;
  let norm = 0;
  for (let octave = 0; octave < 4; octave++) {
    sum = f(sum + f(amplitude * vnoise(x, y)));
    norm = f(norm + amplitude);
    amplitude = f(amplitude * terrainPersistence);
    ({ x, y } = rotate2(x, y));
  }
  return f(sum / f(Math.max(norm, 1e-4)));
}

/**
 * 3-octave ridged multifractal: upstream ridgedFBM with the octave count baked
 * as a literal, so the warp/base fBM can keep four octaves in the same shader.
 */
function ridged3(px: number, py: number) {
  let x = px;
  let y = py;
  let amplitude = 0.5;
  let sum = 0;
  let norm = 0;
  let carry = 1;
  for (let octave = 0; octave < 3; octave++) {
    const value = vnoise(x, y);
    let ridge = f(1 - f(Math.abs(f(value * 2) - 1)));
    ridge = f(ridge * ridge);
    sum = f(sum + f(f(amplitude * ridge) * carry));
    carry = clamp(f(ridge * 1.4), 0, 1);
    norm = f(norm + amplitude);
    amplitude = f(amplitude * terrainPersistence);
    ({ x, y } = rotate2(x, y));
  }
  return f(sum / f(Math.max(norm, 1e-4)));
}

/** worldXZ -> shared noise domain: xz * frequency + seed. */
function noiseDomain(x: number, z: number) {
  return { x: f(f(x * terrainFrequency) + terrainSeedX), z: f(f(z * terrainFrequency) + terrainSeedZ) };
}

/** Upstream flow2: gaussian valley mask 0..1 along a meandering direction. */
function channel(dx: number, dz: number) {
  const dirX = Math.cos(terrainFlowDirection);
  const dirZ = Math.sin(terrainFlowDirection);
  const across = f(f(-dirZ * dx) + f(dirX * dz));
  const along = f(f(dirX * dx) + f(dirZ * dz));
  const wobble = f(f(vnoise(f(along * terrainFlowMeanderScale), 13.1) - 0.5) * terrainFlowMeander);
  const t = f(f(across + wobble) / Math.max(terrainFlowWidth, 0.02));
  return clamp(f(Math.exp(-f(t * t))), 0, 1);
}

/**
 * Continuous valley mask: 0 on mountain chains, 1 on the lake floor. It is the
 * strongest of the meandering channel, a broad low basin, and the view basin
 * that keeps the fixed viewing area under water level.
 */
export function terrainValley(x: number, z: number) {
  const p = noiseDomain(x, z);
  const flow = channel(f(f(p.x * 0.6) + 61.4), f(f(p.z * 0.6) + 27.8));
  const basin = f(1 - smoothstep(0.32, 0.66, vnoise(f(f(p.x * 0.33) + 5.1), f(f(p.z * 0.33) + 17.7))));
  const open = smoothstep(
    f(terrainViewHalf * 0.6),
    f(terrainViewHalf * 1.45),
    f(Math.sqrt(f(f(x * x) + f(z * z)))),
  );
  const blended = clamp(f(f(flow * 0.85) + f(basin * 0.7)), 0, 1);
  return clamp(Math.max(blended, f(f(1 - open) * 0.99)), 0, 1);
}

/** Domain-warped 4-octave fBM and 3-octave ridged chains blended by the valley. */
export function terrainHeight01(x: number, z: number) {
  const p = noiseDomain(x, z);
  const warpX = fbm4(f(p.x + 13.7), f(p.z + 41.3));
  const warpZ = fbm4(f(p.x + 87.2), f(p.z + 9.1));
  const qx = f(p.x + f(f(warpX - 0.5) * terrainWarp));
  const qz = f(p.z + f(f(warpZ - 0.5) * terrainWarp));
  const floor = f(f(fbm4(qx, qz) * 0.3) + 0.1);
  const ridge = f(Math.pow(ridged3(f(f(qx * 1.7) + 31.4), f(f(qz * 1.7) + 27.2)), 1.2));
  const mountains = f(0.35 + f(ridge * 0.95));
  return mix(mountains, floor, terrainValley(x, z));
}

/** World-space height in the same units the mesh and camera use. */
export function terrainHeight(x: number, z: number) {
  return f(f(terrainHeight01(x, z) - terrainHeightRef) * terrainHeightScale);
}
