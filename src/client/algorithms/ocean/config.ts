import type { AlgorithmBudget } from '../types';

/**
 * Cascade tile edge lengths in metres, longest swell first. Fixed by the
 * design: the three FFT tilings must not be resizeable because the simulation
 * grid is allocated once and the spectral bands are derived from these edges.
 */
export const CASCADE_LENGTHS = [768, 121, 19] as const;

/** Radial ocean grid extent in metres, measured from the camera's XZ position. */
export const GRID_INNER_RADIUS = 1.5;
export const GRID_OUTER_RADIUS = 24000;

/** Neighbouring cascades overlap by this many wavelengths so the switch is invisible. */
const BAND_MARGIN_WAVES = 6;

/** Lowest wavenumber the spectrum is evaluated at; below this the shader returns zero. */
const BAND_MIN_WAVENUMBER = 0.0001;
/** Highest wavenumber the spectrum is evaluated at. */
const BAND_MAX_WAVENUMBER = 9999;

export type OceanTier = {
  /** FFT resolution along one axis. */
  fftSize: number;
  log2FftSize: number;
  /** Radial grid density. */
  rings: number;
  segs: number;
  /** Downsample levels of the bloom chain; zero disables bloom entirely. */
  bloomLevels: number;
};

const TIERS = {
  full: { fftSize: 256, rings: 128, segs: 192, bloomLevels: 5 },
  light: { fftSize: 128, rings: 64, segs: 96, bloomLevels: 0 },
} as const;

export type OceanConfig = OceanTier & {
  light: boolean;
  cascadeLengths: number[];
  /** Per-cascade spectral band, inclusive low / exclusive high, in radians per metre. */
  bandCutLow: number[];
  bandCutHigh: number[];
  bandBoundaries: number[];
};

/**
 * Band boundaries derived from the *shorter* tile of each adjacent cascade
 * pair, which is what makes the three bands tile k-space without a gap.
 */
export function cascadeBands(lengths: readonly number[]) {
  if (lengths.length < 2) throw new RangeError('At least two cascades are needed for banding');
  for (const length of lengths)
    if (!Number.isFinite(length) || length <= 0)
      throw new RangeError(`Cascade length must be positive and finite, got ${length}`);
  const bandBoundaries = lengths.slice(1).map((length) => (2 * Math.PI * BAND_MARGIN_WAVES) / length);
  return {
    bandBoundaries,
    bandCutLow: [BAND_MIN_WAVENUMBER, ...bandBoundaries],
    bandCutHigh: [...bandBoundaries, BAND_MAX_WAVENUMBER],
  };
}

export function oceanConfig(budget: AlgorithmBudget): OceanConfig {
  const light = budget.light === true;
  const tier = light ? TIERS.light : TIERS.full;
  const log2FftSize = Math.round(Math.log2(tier.fftSize));
  if (2 ** log2FftSize !== tier.fftSize)
    throw new RangeError(`FFT resolution ${tier.fftSize} must be a power of two`);
  const { bandBoundaries, bandCutLow, bandCutHigh } = cascadeBands(CASCADE_LENGTHS);
  return {
    light,
    ...tier,
    log2FftSize,
    cascadeLengths: [...CASCADE_LENGTHS],
    bandBoundaries,
    bandCutLow,
    bandCutHigh,
  };
}

/**
 * Camera-centred polar grid. Vertex 0 is the centre, then `rings + 1` rows of
 * `segs` vertices with geometrically growing radius. The ocean vertex shader
 * offsets this by the camera position, so the grid never needs re-centring:
 * growing radii keep near-field triangles small and horizon triangles cheap.
 */
export function radialGrid(rings: number, segs: number) {
  if (!Number.isInteger(rings) || rings < 1) throw new RangeError(`rings must be a positive integer`);
  if (!Number.isInteger(segs) || segs < 3) throw new RangeError(`segs must be an integer of at least 3`);
  const vertexCount = (rings + 1) * segs + 1;
  const positions = new Float32Array(vertexCount * 3);
  const growth = Math.pow(GRID_OUTER_RADIUS / GRID_INNER_RADIUS, 1 / rings);
  let p = 3; // vertex 0 stays at (0, 0, 0)
  for (let i = 0; i <= rings; i++) {
    const radius = GRID_INNER_RADIUS * Math.pow(growth, i);
    for (let j = 0; j < segs; j++) {
      const angle = (j / segs) * Math.PI * 2;
      positions[p++] = Math.cos(angle) * radius;
      positions[p++] = 0;
      positions[p++] = Math.sin(angle) * radius;
    }
  }
  const indices = new Uint32Array(segs * 3 + rings * segs * 6);
  let q = 0;
  for (let j = 0; j < segs; j++) {
    indices[q++] = 0;
    indices[q++] = 1 + ((j + 1) % segs);
    indices[q++] = 1 + j;
  }
  for (let i = 0; i < rings; i++) {
    const inner = 1 + i * segs;
    const outer = 1 + (i + 1) * segs;
    for (let j = 0; j < segs; j++) {
      const next = (j + 1) % segs;
      indices[q++] = inner + j;
      indices[q++] = outer + next;
      indices[q++] = outer + j;
      indices[q++] = inner + j;
      indices[q++] = inner + next;
      indices[q++] = outer + next;
    }
  }
  return { positions, indices, vertexCount };
}

export type FoamStep = {
  /** Target flipped to before writing this step. */
  read: number;
  /** Target written this step; never the one being read. */
  write: number;
  /** Index the next step starts from. */
  next: number;
};

/**
 * Foam history is a two-target ping-pong, and every cascade advances together
 * within one step. Sharing the rule keeps that invariant explicit: a cascade
 * that lagged a step would diffuse into the wrong history and the foam would
 * flicker at cascade boundaries.
 */
export function foamPingPong(current: number): FoamStep {
  if (current !== 0 && current !== 1)
    throw new RangeError(`Foam ping-pong index must be 0 or 1, got ${current}`);
  const next = current === 0 ? 1 : 0;
  return { read: current, write: next, next };
}
