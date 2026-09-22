/**
 * CPU reference for the vendored Gray–Scott shaders.
 *
 * The renderer never calls the step below: it runs the shaders in
 * `src/client/vendor/reaction/reaction-diffusion.ts` on the GPU. This file mirrors them one to one
 * — same 3×3 Laplacian weights, same clamp-to-edge reads, same 16-bit-in-RGBA8 packing, same
 * double-buffer discipline — so the unit tests can pin the behaviour a headless CI cannot ask a
 * browser for: uniform fields, stencil locality, boundary cells, conservation of the diffusion
 * term, long-run stability and quantization error.
 */

export type GrayScottState = {
  /** Concentration of chemical A, one value per cell, row-major starting at the bottom row. */
  a: Float64Array;
  /** Concentration of chemical B in the same layout. */
  b: Float64Array;
};

export type GrayScottParameters = {
  /** Feed rate of A (upstream `uRates.x`). */
  feed: number;
  /** Kill rate of B (upstream `uRates.y`). */
  kill: number;
  /** Diffusion rate of A (upstream `uRates.z`). */
  diffuseA: number;
  /** Diffusion rate of B (upstream `uRates.w`). */
  diffuseB: number;
  /** Time step of the explicit Euler integration (upstream `dt = 1.0`). */
  timeStep: number;
};

/**
 * Working point for the hero: the coral / labyrinth region of the Gray–Scott parameter plane.
 * CPU runs of this reference retain a changing colony instead of
 * dying back to the absorbing A = 1, B = 0 state.
 */
export const GRAY_SCOTT_PARAMETERS: GrayScottParameters = {
  feed: 0.029,
  kill: 0.057,
  diffuseA: 0.8,
  diffuseB: 0.4,
  timeStep: 1,
};

/** Corner weight of the vendored 3×3 Laplacian. */
export const LAPLACIAN_CORNERS = 0.05;
/** Edge weight of the vendored 3×3 Laplacian; the centre cell weighs -1. */
export const LAPLACIAN_EDGES = 0.2;

export type ReactionSettings = {
  /** Simulation grid edge in cells; it does not follow the display size. */
  gridSize: number;
  /** Iterations per displayed frame. */
  updatesPerFrame: number;
  /** Finite warm-up before the first draw, so the first frame is already a colony. */
  prewarm: number;
};

export function reactionSettings(light: boolean): ReactionSettings {
  return light
    ? { gridSize: 256, updatesPerFrame: 4, prewarm: 48 }
    : { gridSize: 512, updatesPerFrame: 8, prewarm: 96 };
}

/** Fewest seed blobs per lattice row and column, even on the smallest grid. */
export const MIN_SEED_LATTICE = 6;
/** Target seed spacing in cells: one blob every 32 cells, so 512² gets a 16×16 lattice. */
export const SEED_SPACING = 32;
/** Seed radius as a fraction of the shorter grid edge. */
export const SEED_RADIUS = 1 / 64;
/** Lattice jitter and blob-size variation, as a fraction of the lattice step / radius. */
export const SEED_JITTER = 0.35;
/** Fixed PRNG seed: every page load starts from the same colony. */
export const SEED_STREAM = 0x5eed2026;

/** Blobs per row and column: one per 32 cells, never fewer than six, so no grid starts with a dot. */
export function seedLattice(width: number, height: number): number {
  return Math.max(MIN_SEED_LATTICE, Math.round(Math.min(width, height) / SEED_SPACING));
}

/** Deterministic 32-bit PRNG (mulberry32), used only to place the seed blobs. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Initial state: A everywhere, B inside a jittered lattice of blobs — the same `vec2(1)` the
 * upstream brush writes. The blobs are deterministic, so the first paint is reproducible.
 */
export function createSeededState(
  width: number,
  height: number,
  lattice: number = seedLattice(width, height),
): GrayScottState {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new RangeError('Gray–Scott grid dimensions must be positive integers');
  }
  if (!Number.isInteger(lattice) || lattice < 1) {
    throw new RangeError('Gray–Scott seed lattice must be a positive integer');
  }
  const cells = width * height;
  const state: GrayScottState = { a: new Float64Array(cells).fill(1), b: new Float64Array(cells) };
  const random = createRandom(SEED_STREAM);
  const radius = SEED_RADIUS * Math.min(width, height);
  const stepX = width / lattice;
  const stepY = height / lattice;
  for (let row = 0; row < lattice; row++) {
    for (let column = 0; column < lattice; column++) {
      const centerX = (column + 0.5 + (random() - 0.5) * SEED_JITTER) * stepX;
      const centerY = (row + 0.5 + (random() - 0.5) * SEED_JITTER) * stepY;
      const blob = radius * (1 - SEED_JITTER * 0.5 * random());
      const firstX = Math.max(0, Math.floor(centerX - blob));
      const lastX = Math.min(width - 1, Math.ceil(centerX + blob));
      const firstY = Math.max(0, Math.floor(centerY - blob));
      const lastY = Math.min(height - 1, Math.ceil(centerY + blob));
      for (let y = firstY; y <= lastY; y++) {
        for (let x = firstX; x <= lastX; x++) {
          const dx = x + 0.5 - centerX;
          const dy = y + 0.5 - centerY;
          if (dx * dx + dy * dy <= blob * blob) state.b[y * width + x] = 1;
        }
      }
    }
  }
  return state;
}

/** Clamp-to-edge read, matching the sampler the update shader reads through. */
function readClamped(
  values: Float64Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const column = x < 0 ? 0 : x >= width ? width - 1 : x;
  const row = y < 0 ? 0 : y >= height ? height - 1 : y;
  return values[row * width + column];
}

/** Discrete Laplacian of one cell: corners 0.05, edges 0.20, centre -1. */
export function laplacianAt(
  values: Float64Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  let sum = -values[y * width + x];
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    sum += LAPLACIAN_CORNERS * readClamped(values, width, height, x + dx, y + dy);
  for (const [dx, dy] of [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ] as const)
    sum += LAPLACIAN_EDGES * readClamped(values, width, height, x + dx, y + dy);
  return sum;
}

/**
 * One explicit Euler step, equation for equation the shader's `computeNewValue`. Reading `source`
 * while writing `target` is the CPU twin of the renderer's strict buffer swap; the same object for
 * both would be the aliasing bug the renderer must never have, so it is rejected here.
 */
export function stepGrayScott(
  source: GrayScottState,
  target: GrayScottState,
  width: number,
  height: number,
  parameters: GrayScottParameters = GRAY_SCOTT_PARAMETERS,
): void {
  if (source === target) {
    throw new TypeError('Gray–Scott needs two buffers: a step cannot read its own output');
  }
  const cells = width * height;
  if (source.a.length !== cells || source.b.length !== cells)
    throw new RangeError('Gray–Scott source buffers do not match the grid');
  if (target.a.length !== cells || target.b.length !== cells)
    throw new RangeError('Gray–Scott target buffers do not match the grid');
  const { feed, kill, diffuseA, diffuseB, timeStep } = parameters;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const a = source.a[index];
      const b = source.b[index];
      const reaction = a * b * b;
      target.a[index] =
        a +
        timeStep *
          (diffuseA * laplacianAt(source.a, width, height, x, y) - reaction + feed * (1 - a));
      target.b[index] =
        b +
        timeStep *
          (diffuseB * laplacianAt(source.b, width, height, x, y) + reaction - (kill + feed) * b);
    }
  }
}

/** The renderer's double buffer, in CPU numbers: a step always reads the buffer it does not write. */
export class GrayScottSimulation {
  private readonly buffers: [GrayScottState, GrayScottState];
  private newest = 0;
  private steps = 0;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly parameters: GrayScottParameters = GRAY_SCOTT_PARAMETERS,
    seed: GrayScottState = createSeededState(width, height),
  ) {
    this.buffers = [
      seed,
      { a: new Float64Array(seed.a.length), b: new Float64Array(seed.b.length) },
    ];
  }

  /** The newest state, i.e. what the renderer samples for display. */
  get front(): GrayScottState {
    return this.buffers[this.newest];
  }

  /** The buffer the next step writes into. */
  get back(): GrayScottState {
    return this.buffers[1 - this.newest];
  }

  get iterations(): number {
    return this.steps;
  }

  iterate(count = 1): void {
    if (!Number.isInteger(count) || count < 0)
      throw new RangeError('Gray–Scott iteration count must be a non-negative integer');
    for (let step = 0; step < count; step++) {
      stepGrayScott(this.front, this.back, this.width, this.height, this.parameters);
      this.newest = 1 - this.newest;
      this.steps++;
    }
  }
}

/** Encodes one concentration as the two bytes the shader writes (high channel, low channel). */
export function encode16bit(value: number): [number, number] {
  const scaled = 255.99 * Math.min(1, Math.max(0, value));
  const high = Math.floor(scaled);
  return [high, Math.round((scaled - high) * 255)];
}

/** Reads those bytes back the way `decode16bit` does: 8 bits at 1/255 plus 8 bits at 1/256. */
export function decode16bit(high: number, low: number): number {
  return (high / 255) * (255 / 256) + (low / 255) * (1 / 256);
}

/** Packs a state into RGBA8 for `texImage2D`: A in `.rg`, B in `.ba`. */
export function encodeState(state: GrayScottState): Uint8Array {
  const cells = state.a.length;
  if (state.b.length !== cells) throw new RangeError('Gray–Scott state channels differ in length');
  const bytes = new Uint8Array(cells * 4);
  for (let index = 0; index < cells; index++) {
    const [aHigh, aLow] = encode16bit(state.a[index]);
    const [bHigh, bLow] = encode16bit(state.b[index]);
    bytes[index * 4] = aHigh;
    bytes[index * 4 + 1] = aLow;
    bytes[index * 4 + 2] = bHigh;
    bytes[index * 4 + 3] = bLow;
  }
  return bytes;
}

export function decodeState(bytes: Uint8Array): GrayScottState {
  if (bytes.length % 4 !== 0) throw new RangeError('Gray–Scott textures hold four bytes per cell');
  const cells = bytes.length / 4;
  const state: GrayScottState = { a: new Float64Array(cells), b: new Float64Array(cells) };
  for (let index = 0; index < cells; index++) {
    state.a[index] = decode16bit(bytes[index * 4], bytes[index * 4 + 1]);
    state.b[index] = decode16bit(bytes[index * 4 + 2], bytes[index * 4 + 3]);
  }
  return state;
}
