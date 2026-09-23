/**
 * Accretion disc geometry and shading parameters.
 *
 * The upstream demo builds its disc rings with `Math.random()` while assembling the shader (see
 * `src/client/vendor/blackhole/source/camera_view/shader_manager.js`). This module generates the
 * same parameters from a fixed seed instead, so the hero shows the same disc on every load and
 * tests can pin it. The ring physics is unchanged: each ring is an annulus of particles on a circular
 * orbit, and `dthetaDphi` is the same numerical integral of the orbit equation, with the same step
 * count. The shading is the upstream `DefaultDiscColor` with the disc's own look applied on top; see
 * `shader.ts` for exactly where it differs.
 */

export type DiscRing = {
  /** Inverse radius at the far end of the eccentric annulus. */
  u1: number;
  /** Inverse radius at the near end. */
  u2: number;
  /** Initial azimuth of the ring, in radians. */
  phi0: number;
  /** dtheta/dphi of the ring's precession, from the orbit integral. */
  dthetaDphi: number;
};

export type DiscGeometry = {
  innerRadius: number;
  outerRadius: number;
  rings: DiscRing[];
};

/** Fixed seed: the same disc on every load. Chosen once, then pinned by the tests. */
export const DISC_SEED = 20260922;
export const DISC_INNER_RADIUS = 3;
export const DISC_OUTER_RADIUS = 12;
/** Radial step between rings, and the widest eccentricity of a ring. Upstream values. */
const RING_STEP = 0.75;
const RING_ECCENTRICITY = 0.1;
/** Steps of the orbit integral; the upstream generator uses the same count. */
const ORBIT_INTEGRAL_STEPS = 100000;
/**
 * Schwarzschild time per second, in the model's own time unit. The upstream demo advances the
 * observer's time at the physical rate for its default mass (about 53 units per second), which is
 * far too fast for a hero background: the disc pattern would turn over roughly once per second. The
 * hero keeps its own much slower clock instead, so the pattern drifts over minutes.
 */
export const DISC_TIME_SCALE = 0.45;

/**
 * Disc shading. These are the hero's own values, not the upstream demo's slider defaults (indices
 * 500, 300 and 430): a quiet top-layer density, a dimmer per-ring colour and a fixed 3500 K peak, so
 * the disc reads as a restrained band on a black frame rather than the demo's full-range look.
 */
export const DISC_LOOK = {
  density: 0.075,
  opacity: 0.42,
  temperature: 3500,
} as const;

/**
 * Deterministic xorshift32. A fixed seed has to reproduce the same ring layout on every load, which
 * `Math.random()` cannot promise; only reproducibility matters here, not which generator is used.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

/** dtheta/dphi from the orbit equation, integrated exactly as the upstream generator does. */
function orbitPrecession(u1: number, u2: number, u3: number): number {
  const k2 = (u2 - u1) / (u3 - u1);
  let sum = 0;
  for (let i = 0; i < ORBIT_INTEGRAL_STEPS; i++) {
    const dy = 1 / ORBIT_INTEGRAL_STEPS;
    const y = (i + 0.5) / ORBIT_INTEGRAL_STEPS;
    sum += dy / Math.sqrt((1 - y * y) * (1 - k2 * y * y));
  }
  return (Math.PI * Math.sqrt(u3 - u1)) / (4 * sum);
}

/**
 * Builds the ring list. Radii that make the orbit integral imaginary throw here rather than in the
 * shader: the scene then keeps its still image instead of rendering an undefined disc.
 */
export function discGeometry(
  seed: number = DISC_SEED,
  innerRadius: number = DISC_INNER_RADIUS,
  outerRadius: number = DISC_OUTER_RADIUS,
): DiscGeometry {
  if (!(innerRadius > 0) || !(outerRadius > innerRadius))
    throw new RangeError('Disc radii must be positive and ordered');
  const random = createRandom(seed);
  const rings: DiscRing[] = [];
  for (let r1 = innerRadius; r1 < outerRadius; r1 += RING_STEP) {
    const eccentricity = RING_ECCENTRICITY * random();
    const r2 = (r1 * (1 + eccentricity)) / (1 - eccentricity);
    const u1 = 1 / r2;
    const u2 = 1 / r1;
    const u3 = 1 - u1 - u2;
    if (!(u3 > u2))
      throw new RangeError(`Disc ring at r=${r1} does not satisfy the orbit integral`);
    rings.push({ u1, u2, phi0: 2 * Math.PI * random(), dthetaDphi: orbitPrecession(u1, u2, u3) });
  }
  for (const ring of rings) {
    for (const value of Object.values(ring)) {
      if (!Number.isFinite(value)) throw new RangeError('Disc ring parameters must be finite');
    }
  }
  return { innerRadius, outerRadius, rings };
}

/**
 * The GLSL block the upstream shader manager emits, with the same three-digit formatting: the
 * constants the disc shading and the ray intersections read.
 */
export function discParameterSource(geometry: DiscGeometry): string {
  const rings = geometry.rings.map(
    (ring) =>
      `vec4(${ring.u1.toPrecision(3)}, ${ring.u2.toPrecision(3)}, ${ring.phi0.toPrecision(3)}, ${ring.dthetaDphi.toPrecision(3)})`,
  );
  return `const float INNER_DISC_R = ${geometry.innerRadius.toPrecision(3)};
const float OUTER_DISC_R = ${geometry.outerRadius.toPrecision(3)};
const int NUM_DISC_PARTICLES = ${geometry.rings.length};
const vec4 DISC_PARTICLE_PARAMS[${geometry.rings.length}] = vec4[${geometry.rings.length}](
    ${rings.join(',\n    ')}
);`;
}
