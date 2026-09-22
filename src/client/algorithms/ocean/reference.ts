/**
 * CPU mirror of the GPU spectral pipeline: `specPass` → `bfPass` → `asmPass`
 * from `src/client/vendor/ocean/index.html`.
 *
 * Nothing in the shipped scene imports this module. It is the executable
 * specification the tests check the twiddle table, the butterfly indexing, the
 * spectrum packing and the Jacobian assembly against — real double-precision
 * arithmetic and a direct DFT oracle, not a source-text assertion. Because it
 * is outside the runtime import graph it costs nothing in the bundle.
 */

import { butterfly2d, butterflyTable, type ButterflyTable } from './butterfly';
import { spectralSample, type SpectralField, type SpectralSample } from './spectrum';

export type SpectralSampler = (nx: number, nz: number) => SpectralSample;

export type WaveFrame = {
  size: number;
  /** Horizontal displacement along x, already scaled by choppiness. */
  displacementX: Float64Array;
  /** Height η. */
  height: Float64Array;
  /** Horizontal displacement along z, already scaled by choppiness. */
  displacementZ: Float64Array;
  /** Surface slope dη/dx; the shader's normal is built from these two. */
  slopeX: Float64Array;
  /** Surface slope dη/dz. */
  slopeZ: Float64Array;
  /** Jacobian determinant; below zero the surface folds and the crest breaks. */
  jacobian: Float64Array;
};

/** `cmul` from the shared GLSL preamble. */
function cmul(a: readonly [number, number], b: readonly [number, number]): [number, number] {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

/** Exposed so a test can build a closed-form expectation independently. */
export const complexMultiply = cmul;

export type ReferenceOptions = {
  size: number;
  tileLength: number;
  depth: number;
  choppiness: number;
  time: number;
  sample: SpectralSampler;
  /** Reuse one table across frames; building it is the expensive part. */
  table?: ButterflyTable;
};

export function referenceWaveFrame(options: ReferenceOptions): WaveFrame {
  const { size, tileLength, depth, choppiness, time, sample } = options;
  const table = options.table ?? butterflyTable(size);
  if (table.size !== size) throw new RangeError('Table size does not match the requested grid');
  const cells = size * size;
  const dk = (2 * Math.PI) / tileLength;
  const half = size / 2;

  // specPass writes two MRT slots holding four complex numbers per texel:
  // 0 = Dx + i·Dz, 1 = Dy + i·dDx/dz, 2 = dDy/dx + i·dDy/dz, 3 = dDx/dx + i·dDz/dz.
  const channels = [0, 1, 2, 3].map(() => ({
    re: new Float64Array(cells),
    im: new Float64Array(cells),
  }));

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const cell = z * size + x;
      const nx = x - half;
      const nz = z - half;
      const kx = nx * dk;
      const kz = nz * dk;
      const wavenumber = Math.hypot(kx, kz);
      if (wavenumber < 1e-6) continue; // specPass writes zeros and returns

      const { forward, reverse, omega } = sample(nx, nz);
      const cos = Math.cos(omega * time);
      const sin = Math.sin(omega * time);
      // h0Pass stores vec4(a.x, a.y, b.x, -b.y): ĥ(k) followed by conj(ĥ(-k)).
      const positive = cmul(forward, [cos, sin]);
      const negative = cmul([reverse[0], -reverse[1]], [cos, -sin]);
      const h: [number, number] = [positive[0] + negative[0], positive[1] + negative[1]];

      const unitX = kx / wavenumber;
      const unitZ = kz / wavenumber;
      const pack0 = [cmul(h, [unitZ, -unitX]), cmul(h, [1, (kx * kz) / wavenumber])];
      // Note the second slot uses the raw wavenumber, not the unit vector: that
      // is what makes it the true ∂η/∂x rather than a scaled one.
      const pack1 = [cmul(h, [-kz, kx]), cmul(h, [(kx * kx) / wavenumber, (kz * kz) / wavenumber])];
      writeComplex(channels[0], cell, pack0[0]);
      writeComplex(channels[1], cell, pack0[1]);
      writeComplex(channels[2], cell, pack1[0]);
      writeComplex(channels[3], cell, pack1[1]);
    }
  }

  const transformed = channels.map((channel) => butterfly2d(table, channel.re, channel.im));
  const frame: WaveFrame = {
    size,
    displacementX: new Float64Array(cells),
    height: new Float64Array(cells),
    displacementZ: new Float64Array(cells),
    slopeX: new Float64Array(cells),
    slopeZ: new Float64Array(cells),
    jacobian: new Float64Array(cells),
  };
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const cell = z * size + x;
      // asmPass multiplies both MRT slots by a checkerboard before unpacking.
      const sign = (x + z) % 2 < 0.5 ? 1 : -1;
      const aX = transformed[0].re[cell] * sign;
      const aY = transformed[0].im[cell] * sign;
      const aZ = transformed[1].re[cell] * sign;
      const aW = transformed[1].im[cell] * sign;
      const bX = transformed[2].re[cell] * sign;
      const bY = transformed[2].im[cell] * sign;
      const bZ = transformed[3].re[cell] * sign;
      const bW = transformed[3].im[cell] * sign;
      const dX = bZ * choppiness;
      const dZ = bW * choppiness;
      const dXZ = aW * choppiness;
      frame.displacementX[cell] = aX * choppiness;
      frame.height[cell] = aZ;
      frame.displacementZ[cell] = aY * choppiness;
      frame.slopeX[cell] = bX;
      frame.slopeZ[cell] = bY;
      frame.jacobian[cell] = (1 + dX) * (1 + dZ) - dXZ * dXZ;
    }
  }
  return frame;
}

function writeComplex(
  channel: { re: Float64Array; im: Float64Array },
  cell: number,
  value: readonly [number, number],
) {
  channel.re[cell] = value[0];
  channel.im[cell] = value[1];
}

export function fieldSampler(field: SpectralField): SpectralSampler {
  return (nx, nz) => spectralSample(nx, nz, field);
}
