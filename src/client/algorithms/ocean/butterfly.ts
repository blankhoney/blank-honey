/**
 * Twiddle/index table and CPU mirror of the upstream bidirectional Cooley–Tukey
 * butterfly (`makeButterflyTexture` and `bfPass` in
 * `src/client/vendor/ocean/index.html`).
 *
 * The table is the only place the transform's indexing convention lives: the
 * GLSL kernel reads one texel of it per stage and index, so a table that is
 * wrong produces a wrong ocean everywhere. `butterfly2d` replays the same
 * kernel in double precision against that same table, which lets the transform
 * be checked against a direct DFT without a GPU.
 */

export type ButterflyTable = {
  size: number;
  stages: number;
  /** cos of the stage twiddle, indexed `index * stages + stage`. */
  cos: Float64Array;
  sin: Float64Array;
  /** Table-space index sourced by the top and bottom operands of each butterfly. */
  top: Int32Array;
  bottom: Int32Array;
};

export function butterflyTable(size: number): ButterflyTable {
  if (!Number.isInteger(size) || size < 2 || (size & (size - 1)) !== 0)
    throw new RangeError(`Butterfly size must be a power of two of at least 2, got ${size}`);
  const stages = Math.round(Math.log2(size));

  const reverse = new Int32Array(size);
  for (let i = 0; i < size; i++) {
    let value = i;
    let reversed = 0;
    for (let bit = 0; bit < stages; bit++) {
      reversed = (reversed << 1) | (value & 1);
      value >>= 1;
    }
    reverse[i] = reversed;
  }

  const cos = new Float64Array(stages * size);
  const sin = new Float64Array(stages * size);
  const top = new Int32Array(stages * size);
  const bottom = new Int32Array(stages * size);
  for (let stage = 0; stage < stages; stage++) {
    for (let index = 0; index < size; index++) {
      const wave = (index * (size >> (stage + 1))) % size;
      const angle = (2 * Math.PI * wave) / size; // positive exponent: inverse transform
      const span = 1 << stage;
      const inTopHalf = index % (1 << (stage + 1)) < span;
      let sourceTop: number;
      let sourceBottom: number;
      if (stage === 0) {
        // The first stage folds the bit-reversal permutation into its reads.
        if (inTopHalf) {
          sourceTop = reverse[index];
          sourceBottom = reverse[index + 1];
        } else {
          sourceTop = reverse[index - 1];
          sourceBottom = reverse[index];
        }
      } else if (inTopHalf) {
        sourceTop = index;
        sourceBottom = index + span;
      } else {
        sourceTop = index - span;
        sourceBottom = index;
      }
      const slot = index * stages + stage;
      cos[slot] = Math.cos(angle);
      sin[slot] = Math.sin(angle);
      top[slot] = sourceTop;
      bottom[slot] = sourceBottom;
    }
  }
  return { size, stages, cos, sin, top, bottom };
}

/**
 * Interleaved RGBA rows for the `DataTexture(stages × size)` the shader
 * samples: `(cos, sin, sourceTop, sourceBottom)`.
 */
export function butterflyTextureData(table: ButterflyTable): Float32Array {
  const { size, stages, cos, sin, top, bottom } = table;
  const data = new Float32Array(stages * size * 4);
  for (let index = 0; index < size; index++) {
    for (let stage = 0; stage < stages; stage++) {
      const slot = index * stages + stage;
      const offset = (index * stages + stage) * 4;
      data[offset] = cos[slot];
      data[offset + 1] = sin[slot];
      data[offset + 2] = top[slot];
      data[offset + 3] = bottom[slot];
    }
  }
  return data;
}

type ComplexField = { re: Float64Array; im: Float64Array };

function emptyField(cells: number): ComplexField {
  return { re: new Float64Array(cells), im: new Float64Array(cells) };
}

/**
 * CPU replay of the GPU kernel. `direction` 0 transforms along x (each row
 * independently, matching `uDir = 0`), 1 transforms along z. Both passes are
 * unnormalised, exactly like the shader: the caller applies the normalisation
 * and sign that the assembly pass expects.
 */
export function butterfly2d(
  table: ButterflyTable,
  real: Float64Array,
  imag: Float64Array,
): ComplexField {
  const { size, stages, cos, sin, top, bottom } = table;
  const cells = size * size;
  if (real.length !== cells || imag.length !== cells)
    throw new RangeError(`Expected ${cells} cells of input, got ${real.length}/${imag.length}`);

  let source: ComplexField = { re: Float64Array.from(real), im: Float64Array.from(imag) };
  for (let direction = 0; direction < 2; direction++) {
    for (let stage = 0; stage < stages; stage++) {
      const target = emptyField(cells);
      for (let z = 0; z < size; z++) {
        for (let x = 0; x < size; x++) {
          const index = direction === 0 ? x : z;
          const slot = index * stages + stage;
          const twiddleRe = cos[slot];
          const twiddleIm = sin[slot];
          const topCell = direction === 0 ? z * size + top[slot] : top[slot] * size + x;
          const bottomCell = direction === 0 ? z * size + bottom[slot] : bottom[slot] * size + x;
          const rotatedRe = twiddleRe * source.re[bottomCell] - twiddleIm * source.im[bottomCell];
          const rotatedIm = twiddleRe * source.im[bottomCell] + twiddleIm * source.re[bottomCell];
          const cell = z * size + x;
          target.re[cell] = source.re[topCell] + rotatedRe;
          target.im[cell] = source.im[topCell] + rotatedIm;
        }
      }
      source = target;
    }
  }
  return source;
}

/**
 * Direct O(N⁴) reference: the unnormalised inverse DFT in natural index order,
 *
 *   out[q][p] = Σ_{b,a} in[b][a] · e^{+2πi(ap + bq)/N}
 *
 * `butterfly2d` reproduces this exactly; the test asserts that identity.
 */
export function directInverseDft(
  real: Float64Array,
  imag: Float64Array,
  size: number,
): ComplexField {
  const cells = size * size;
  if (real.length !== cells) throw new RangeError(`Expected ${cells} cells, got ${real.length}`);
  const out = emptyField(cells);
  for (let q = 0; q < size; q++) {
    for (let p = 0; p < size; p++) {
      let sumRe = 0;
      let sumIm = 0;
      for (let b = 0; b < size; b++) {
        for (let a = 0; a < size; a++) {
          const angle = (2 * Math.PI * (a * p + b * q)) / size;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const cell = b * size + a;
          sumRe += real[cell] * cos - imag[cell] * sin;
          sumIm += real[cell] * sin + imag[cell] * cos;
        }
      }
      const cell = q * size + p;
      out.re[cell] = sumRe;
      out.im[cell] = sumIm;
    }
  }
  return out;
}
