import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { WebGLRenderTarget, type WebGLRenderer } from 'three';
import { algorithmResolution, type AlgorithmBudget } from '../src/client/algorithms/types';
import {
  CASCADE_LENGTHS,
  cascadeBands,
  foamPingPong,
  GRID_INNER_RADIUS,
  GRID_OUTER_RADIUS,
  oceanConfig,
  radialGrid,
} from '../src/client/algorithms/ocean/config';
import {
  butterfly2d,
  butterflyTable,
  butterflyTextureData,
  directInverseDft,
} from '../src/client/algorithms/ocean/butterfly';
import {
  angularFrequency,
  gaussianPair,
  pcg,
  spectralSample,
  type SpectralField,
  type SpectralSample,
} from '../src/client/algorithms/ocean/spectrum';
import {
  fieldSampler,
  referenceWaveFrame,
  type SpectralSampler,
} from '../src/client/algorithms/ocean/reference';
import { LOOK, pointerYaw, smoothYaw, sunState } from '../src/client/algorithms/ocean/look';
import { resourceSet } from '../src/client/algorithms/ocean/resources';
import { createScene, isOceanUnsupportedError } from '../src/client/algorithms/ocean/scene';
import type { PassFactory, Uniforms } from '../src/client/algorithms/ocean/pass';
import { createOceanSurface } from '../src/client/algorithms/ocean/render';
import type { OceanSimulation } from '../src/client/algorithms/ocean/simulation';
import {
  ASSEMBLY_FRAGMENT_SHADER,
  BLIT_FRAGMENT_SHADER,
  BLOOM_BRIGHT_FRAGMENT_SHADER,
  BLOOM_DOWN_FRAGMENT_SHADER,
  BLOOM_UP_FRAGMENT_SHADER,
  BUTTERFLY_FRAGMENT_SHADER,
  COMPOSITE_FRAGMENT_SHADER,
  FOAM_FRAGMENT_SHADER,
  GL_DEPTH,
  GL_HEAD,
  GL_NOISE,
  GL_SKY,
  H0_FRAGMENT_SHADER,
  OCEAN_FRAGMENT_SHADER,
  OCEAN_VERTEX_SHADER,
  QUAD_VERTEX_SHADER,
  SKY_FRAGMENT_SHADER,
  SKY_VERTEX_SHADER,
  SPECTRUM_FRAGMENT_SHADER,
} from '../src/client/algorithms/ocean/shaders';

const FIXED_BUDGET: AlgorithmBudget = { light: false, fps: 30, maxPixels: 1_200_000, maxDpr: 1.5 };
const LIGHT_BUDGET: AlgorithmBudget = { light: true, fps: 20, maxPixels: 400_000, maxDpr: 1 };

/** The shipped look, re-expressed as a spectral field so tests exercise real numbers. */
function shippedField(tileLength: number, fftSize: number, cutLow: number, cutHigh: number): SpectralField {
  const angle = (LOOK.windDirectionDeg * Math.PI) / 180;
  return {
    tileLength,
    fftSize,
    windSpeed: LOOK.windSpeed,
    windDirectionX: Math.cos(angle),
    windDirectionY: Math.sin(angle),
    fetchKm: LOOK.fetchKm,
    depth: LOOK.depth,
    swell: LOOK.swell,
    spread: LOOK.spread,
    shortWaves: LOOK.shortWaves,
    amplitude: LOOK.amplitude,
    cutLow,
    cutHigh,
    seed: 1337,
  };
}

function closeTo(actual: number, expected: number, tolerance: number, message: string) {
  assert.ok(
    Number.isFinite(actual),
    `${message}: expected ${expected}, got a non-finite value`,
  );
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual} (delta ${Math.abs(actual - expected)})`,
  );
}

function deterministicField(size: number, seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296 - 0.5;
  };
  const re = new Float64Array(size * size);
  const im = new Float64Array(size * size);
  for (let cell = 0; cell < re.length; cell++) {
    re[cell] = next();
    im[cell] = next();
  }
  return { re, im };
}

/* ── butterfly table ─────────────────────────────────────────────────────── */

test('butterfly table indexes stay inside the grid and describe a real permutation', () => {
  for (const size of [4, 8, 16, 128]) {
    const table = butterflyTable(size);
    assert.equal(table.stages, Math.round(Math.log2(size)), `size ${size} stages`);
    assert.equal(table.cos.length, table.stages * size, `size ${size} twiddle length`);
    for (let index = 0; index < size; index++) {
      for (let stage = 0; stage < table.stages; stage++) {
        const slot = index * table.stages + stage;
        const top = table.top[slot] as number;
        const bottom = table.bottom[slot] as number;
        assert.ok(
          top >= 0 && top < size && bottom >= 0 && bottom < size,
          `size ${size} stage ${stage} index ${index} reads out of range (${top}, ${bottom})`,
        );
        assert.notEqual(top, bottom, `size ${size} stage ${stage} index ${index} reads one cell twice`);
      }
    }
  }
});

test('butterfly stage zero folds in the bit-reversal permutation', () => {
  const size = 16;
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
  const table = butterflyTable(size);
  for (let index = 0; index < size; index++) {
    const top = table.top[index * stages] as number;
    const bottom = table.bottom[index * stages] as number;
    if (index % 2 === 0) {
      assert.equal(top, reverse[index], `even index ${index} top`);
      assert.equal(bottom, reverse[index + 1] as number, `even index ${index} bottom`);
    } else {
      assert.equal(top, reverse[index - 1] as number, `odd index ${index} top`);
      assert.equal(bottom, reverse[index] as number, `odd index ${index} bottom`);
    }
  }
});

test('butterfly twiddles are the forward-exponent roots of unity the kernel expects', () => {
  const size = 16;
  const stages = Math.round(Math.log2(size));
  const table = butterflyTable(size);
  // Stage 0 spans half the grid, so every twiddle is ±1 with no imaginary part.
  for (let index = 0; index < size; index++) {
    const slot = index * stages;
    const expected = index % 2 === 0 ? 1 : -1;
    closeTo(table.cos[slot] as number, expected, 1e-12, `stage 0 index ${index} cos`);
    closeTo(table.sin[slot] as number, 0, 1e-12, `stage 0 index ${index} sin`);
  }
  // The last stage walks the whole circle: k == index.
  const last = stages - 1;
  for (let index = 0; index < size; index++) {
    const angle = (2 * Math.PI * (index % size)) / size;
    const slot = index * stages + last;
    closeTo(table.cos[slot] as number, Math.cos(angle), 1e-12, `last stage index ${index} cos`);
    closeTo(table.sin[slot] as number, Math.sin(angle), 1e-12, `last stage index ${index} sin`);
  }
});

test('butterfly texture rows carry cos, sin, both source indices in that order', () => {
  const size = 8;
  const table = butterflyTable(size);
  const data = butterflyTextureData(table);
  assert.equal(data.length, table.stages * size * 4);
  for (let index = 0; index < size; index++) {
    for (let stage = 0; stage < table.stages; stage++) {
      const slot = index * table.stages + stage;
      const offset = slot * 4;
      // Twiddles round to float32 on the way into the texture; indices are exact.
      closeTo(data[offset] as number, table.cos[slot] as number, 1e-7, `slot ${slot} cos`);
      closeTo(data[offset + 1] as number, table.sin[slot] as number, 1e-7, `slot ${slot} sin`);
      assert.equal(data[offset + 2], table.top[slot], `slot ${slot} top`);
      assert.equal(data[offset + 3], table.bottom[slot], `slot ${slot} bottom`);
    }
  }
});

/* ── transform against a direct DFT ──────────────────────────────────────── */

test('the butterfly reproduces a direct inverse DFT on small grids', () => {
  for (const size of [4, 8, 16]) {
    const table = butterflyTable(size);
    const { re, im } = deterministicField(size, 0x5eed + size);
    const viaButterfly = butterfly2d(table, re, im);
    const viaDft = directInverseDft(re, im, size);
    let worst = 0;
    let energy = 0;
    for (let cell = 0; cell < re.length; cell++) {
      const dRe = Math.abs((viaButterfly.re[cell] as number) - (viaDft.re[cell] as number));
      const dIm = Math.abs((viaButterfly.im[cell] as number) - (viaDft.im[cell] as number));
      worst = Math.max(worst, dRe, dIm);
      energy = Math.max(
        energy,
        Math.abs(viaDft.re[cell] as number),
        Math.abs(viaDft.im[cell] as number),
      );
    }
    assert.ok(energy > 0, `size ${size} produced a degenerate reference transform`);
    assert.ok(
      worst <= energy * 1e-12,
      `size ${size} butterfly deviates from the direct DFT by ${worst} (reference magnitude ${energy})`,
    );
  }
});

test('the butterfly is linear in both grid directions', () => {
  const size = 8;
  const table = butterflyTable(size);
  const a = deterministicField(size, 11);
  const b = deterministicField(size, 29);
  const combined = butterfly2d(
    table,
    Float64Array.from(a.re, (value, cell) => value + (b.re[cell] as number)),
    Float64Array.from(a.im, (value, cell) => value + (b.im[cell] as number)),
  );
  const separate = butterfly2d(table, a.re, a.im);
  const other = butterfly2d(table, b.re, b.im);
  for (let cell = 0; cell < a.re.length; cell++) {
    closeTo(combined.re[cell] as number, (separate.re[cell] as number) + (other.re[cell] as number), 1e-12, `sum re ${cell}`);
    closeTo(combined.im[cell] as number, (separate.im[cell] as number) + (other.im[cell] as number), 1e-12, `sum im ${cell}`);
  }
});

/* ── one wave, closed form ───────────────────────────────────────────────── */

/**
 * A spectrum that is zero everywhere except at ±(indexX, indexZ), where it is a
 * real coefficient. Because the transform is linear and the pair is Hermitian,
 * the resulting surface has a closed form, so this pins the whole chain
 * (h0 pairing → time evolution → butterfly → recentring → channel unpacking)
 * without reusing any of the code under test.
 */
function deltaSpectrum(
  indexX: number,
  indexZ: number,
  amplitude: number,
  depth: number,
  tileLength: number,
): SpectralSampler {
  const dk = (2 * Math.PI) / tileLength;
  const wavenumber = Math.hypot(indexX * dk, indexZ * dk);
  const omega = Math.sqrt(9.81 * wavenumber * Math.tanh(Math.min(wavenumber * depth, 20)));
  const hit = (nx: number, nz: number) =>
    (nx === indexX && nz === indexZ) || (nx === -indexX && nz === -indexZ);
  const empty: SpectralSample = { forward: [0, 0], reverse: [0, 0], omega: 0 };
  return (nx, nz) => (hit(nx, nz) ? { forward: [amplitude, 0], reverse: [amplitude, 0], omega } : empty);
}

test('a single spectral bin produces the closed-form standing wave it should', () => {
  const size = 16;
  const tileLength = 16;
  const depth = 420;
  const amplitude = 1;
  const choppiness = 1.3;
  const dk = (2 * Math.PI) / tileLength;

  for (const harmonic of [1, 2, 3]) {
    const wavenumber = harmonic * dk;
    const omega = Math.sqrt(9.81 * wavenumber * Math.tanh(Math.min(wavenumber * depth, 20)));
    const sample = deltaSpectrum(harmonic, 0, amplitude, depth, tileLength);
    for (const time of [0, 0.7, 2.35]) {
      const frame = referenceWaveFrame({
        size,
        tileLength,
        depth,
        choppiness,
        time,
        sample,
      });
          // h0 pairing: ĥ(k)e^{iωt} + conj(ĥ(-k))e^{-iωt} = 2A cos(ωt) for this pair,
          // so `evolved` is the spectral coefficient the transform will see, and the
          // Hermitian ±k pair doubles it again into the standing wave.
          const evolved = 2 * amplitude * Math.cos(omega * time);
          for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
              const cell = z * size + x;
              const phase = (2 * Math.PI * harmonic * x) / size;
              const label = `harmonic ${harmonic} t=${time} cell ${x},${z}`;
              closeTo(frame.height[cell] as number, 2 * evolved * Math.cos(phase), 1e-9, `${label} height`);
              closeTo(
                frame.displacementX[cell] as number,
                choppiness * 2 * evolved * Math.sin(phase),
                1e-9,
                `${label} displacement x`,
              );
              closeTo(frame.displacementZ[cell] as number, 0, 1e-9, `${label} displacement z`);
              // The slope is the true dη/dx, so it scales with the wavenumber itself.
              closeTo(
                frame.slopeX[cell] as number,
                -2 * evolved * wavenumber * Math.sin(phase),
                1e-9,
                `${label} slope x`,
              );
              closeTo(frame.slopeZ[cell] as number, 0, 1e-9, `${label} slope z`);
              // Dz and both cross terms vanish, so J reduces to the 1-D determinant.
              closeTo(
                frame.jacobian[cell] as number,
                1 + choppiness * 2 * evolved * wavenumber * Math.cos(phase),
                1e-9,
                `${label} jacobian`,
              );
            }
          }
    }
  }
});

test('a wave off the x axis keeps its energy and stays finite', () => {
  const size = 16;
  const tileLength = 16;
  const depth = 420;
  const indexX = 2;
  const indexZ = 3;
  const time = 1.1;
  const dk = (2 * Math.PI) / tileLength;
  const wavenumber = Math.hypot(indexX * dk, indexZ * dk);
  const omega = Math.sqrt(9.81 * wavenumber * Math.tanh(Math.min(wavenumber * depth, 20)));
  const frame = referenceWaveFrame({
    size,
    tileLength,
    depth,
    choppiness: 1.3,
    time,
    sample: deltaSpectrum(indexX, indexZ, 1, depth, tileLength),
  });
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let cell = 0; cell < frame.height.length; cell++) {
    const value = frame.height[cell] as number;
    assert.ok(Number.isFinite(value), `height ${cell} is not finite`);
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  assert.ok(maximum - minimum > 0.1, `a single mode should not collapse to a constant (${minimum}..${maximum})`);
  // For one Hermitian pair the surface is 4A cos(ωt) cos(k·x); the sampled grid
  // reaches that peak because the mode divides the grid evenly.
  const peak = 4 * Math.cos(omega * time);
  closeTo(Math.max(Math.abs(minimum), Math.abs(maximum)), Math.abs(peak), 1e-6, 'peak height of a unit mode');
});

/* ── seeded noise ────────────────────────────────────────────────────────── */

test('the hashed Gaussian draws are finite, reproducible and seed dependent', () => {
  const seen = new Map<string, [number, number]>();
  for (const seed of [0, 1, 1337, 0xffffffff]) {
    for (let nx = -6; nx <= 6; nx++) {
      for (let nz = -6; nz <= 6; nz++) {
        const draw = gaussianPair(nx, nz, seed);
        assert.ok(Number.isFinite(draw[0]) && Number.isFinite(draw[1]), `seed ${seed} (${nx},${nz})`);
        // Box–Muller with pcg's own stream stays inside a few sigma of the mean.
        assert.ok(Math.abs(draw[0]) < 12 && Math.abs(draw[1]) < 12, `seed ${seed} (${nx},${nz}) magnitude`);
        const again = gaussianPair(nx, nz, seed);
        assert.deepEqual(again, draw, `seed ${seed} (${nx},${nz}) is not reproducible`);
        seen.set(`${nx},${nz}`, draw);
      }
    }
  }
  let differences = 0;
  for (let nx = -6; nx <= 6; nx++) {
    for (let nz = -6; nz <= 6; nz++) {
      const base = gaussianPair(nx, nz, 1337);
      const other = gaussianPair(nx, nz, 1338);
      if (base[0] !== other[0] || base[1] !== other[1]) differences++;
    }
  }
  assert.ok(differences > seen.size * 0.9, 'changing the seed should change almost every draw');
});

test('the pcg hash stays a 32-bit unsigned function of its input', () => {
  const outputs = new Set<number>();
  for (let value = 0; value < 512; value++) {
    const hashed = pcg(value);
    assert.ok(Number.isInteger(hashed) && hashed >= 0 && hashed <= 0xffffffff, `pcg(${value}) = ${hashed}`);
    outputs.add(hashed);
  }
  assert.equal(outputs.size, 512, 'the hash collapsed distinct inputs');
});

test('the shipped spectrum is finite, band limited and non-constant', () => {
  const size = 32;
  const field = shippedField(CASCADE_LENGTHS[0], size, 0.0001, 9999);
  const frame = referenceWaveFrame({
    size,
    tileLength: field.tileLength,
    depth: field.depth,
    choppiness: LOOK.choppiness,
    time: 0,
    sample: fieldSampler(field),
  });
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let cell = 0; cell < frame.height.length; cell++) {
    const height = frame.height[cell] as number;
    const jacobian = frame.jacobian[cell] as number;
    assert.ok(Number.isFinite(height), `height ${cell} is not finite`);
    assert.ok(Number.isFinite(jacobian), `jacobian ${cell} is not finite`);
    minimum = Math.min(minimum, height);
    maximum = Math.max(maximum, height);
  }
  assert.ok(maximum - minimum > 0.01, `the shipped field is flat (${minimum}..${maximum})`);

  const later = referenceWaveFrame({
    size,
    tileLength: field.tileLength,
    depth: field.depth,
    choppiness: LOOK.choppiness,
    time: 1.5,
    sample: fieldSampler(field),
  });
  let moved = 0;
  for (let cell = 0; cell < frame.height.length; cell++)
    if (Math.abs((frame.height[cell] as number) - (later.height[cell] as number)) > 1e-9) moved++;
  assert.ok(moved > frame.height.length * 0.9, 'the field should keep evolving with time');
});

test('spectral samples vanish outside the cascade band and stay finite inside it', () => {
  const size = 64;
  const { bandCutLow, bandCutHigh } = cascadeBands(CASCADE_LENGTHS);
  const low = bandCutLow[1] as number;
  const high = bandCutHigh[1] as number;
  const field = shippedField(CASCADE_LENGTHS[1], size, low, high);
  const dk = (2 * Math.PI) / field.tileLength;
  let inside = 0;
  let outside = 0;
  for (let nx = 0; nx < size; nx++) {
    for (let nz = 0; nz < size; nz++) {
      const sample = spectralSample(nx - size / 2, nz - size / 2, field);
      const wavenumber = Math.hypot((nx - size / 2) * dk, (nz - size / 2) * dk);
      const magnitude = Math.hypot(sample.forward[0], sample.forward[1]);
      assert.ok(Number.isFinite(magnitude), `sample ${nx},${nz} is not finite`);
      if (wavenumber >= low && wavenumber < high) {
        inside++;
        assert.ok(magnitude > 0, `sample ${nx},${nz} inside the band is zero`);
      } else {
        outside++;
        assert.equal(magnitude, 0, `sample ${nx},${nz} outside the band should be zero`);
      }
    }
  }
  assert.ok(inside > 0 && outside > 0, 'the sample grid must straddle the band edges');
});

/* ── foam ping-pong ──────────────────────────────────────────────────────── */

test('the foam ping-pong never reads the target it is writing', () => {
  let index = 0;
  const visited: number[] = [];
  for (let step = 0; step < 6; step++) {
    const sequence = foamPingPong(index);
    assert.notEqual(sequence.read, sequence.write, `step ${step} aliased`);
    assert.equal(sequence.read, index, `step ${step} read the wrong slot`);
    assert.equal(sequence.write, sequence.next, `step ${step} next index mismatch`);
    visited.push(sequence.read);
    index = sequence.next;
  }
  assert.deepEqual(visited, [0, 1, 0, 1, 0, 1], 'the history must alternate every step');
  assert.throws(() => foamPingPong(2), RangeError);
  assert.throws(() => foamPingPong(-1), RangeError);
});

test('every cascade advances foam on the same step so their histories stay aligned', () => {
  const cascades = CASCADE_LENGTHS.length;
  let index = 0;
  for (let step = 0; step < 4; step++) {
    const sequence = foamPingPong(index);
    const reads = Array.from({ length: cascades }, () => sequence.read);
    const writes = Array.from({ length: cascades }, () => sequence.write);
    assert.equal(new Set(reads).size, 1, `step ${step} left a cascade reading a stale slot`);
    assert.equal(new Set(writes).size, 1, `step ${step} wrote two different slots`);
    assert.ok(writes.every((slot) => slot !== sequence.read), `step ${step} wrote over the read slot`);
    index = sequence.next;
  }
});

/* ── simulation and canvas budgets ───────────────────────────────────────── */

test('the simulation resolution follows the tier, never the canvas', () => {
  const wide = oceanConfig({ light: false, fps: 30, maxPixels: 4_000_000, maxDpr: 3 });
  const narrow = oceanConfig({ light: false, fps: 12, maxPixels: 240_000, maxDpr: 1 });
  assert.deepEqual(wide, narrow, 'a canvas change must not resize the FFT grid');

  const full = oceanConfig(FIXED_BUDGET);
  assert.equal(full.fftSize, 256);
  assert.equal(full.log2FftSize, 8);
  assert.equal(full.rings, 128);
  assert.equal(full.segs, 192);
  assert.equal(full.bloomLevels, 5);
  assert.equal(2 ** full.log2FftSize, full.fftSize, 'the FFT size must be a power of two');

  const light = oceanConfig(LIGHT_BUDGET);
  assert.equal(light.light, true);
  assert.equal(light.fftSize, 128);
  assert.equal(light.log2FftSize, 7);
  assert.equal(light.rings, 64);
  assert.equal(light.segs, 96);
  assert.equal(light.bloomLevels, 0, 'the low tier must run without a bloom chain');
  assert.ok(light.fftSize < full.fftSize && light.rings < full.rings && light.segs < full.segs);
});

test('the three cascades partition wavenumber space without overlap or gap', () => {
  const config = oceanConfig(FIXED_BUDGET);
  assert.deepEqual(config.cascadeLengths, [768, 121, 19]);
  assert.equal(config.bandBoundaries.length, 2);
  closeTo(config.bandBoundaries[0] as number, (2 * Math.PI * 6) / 121, 1e-12, 'first boundary');
  closeTo(config.bandBoundaries[1] as number, (2 * Math.PI * 6) / 19, 1e-12, 'second boundary');
  for (let band = 0; band < config.cascadeLengths.length; band++) {
    const low = config.bandCutLow[band] as number;
    const high = config.bandCutHigh[band] as number;
    assert.ok(low < high, `band ${band} is empty (${low}..${high})`);
  }
  for (let band = 0; band + 1 < config.cascadeLengths.length; band++)
    assert.equal(
      config.bandCutHigh[band],
      config.bandCutLow[band + 1] as number,
      `band ${band} and ${band + 1} do not tile the axis`,
    );
  // Longest tile owns the lowest wavenumbers, shortest the highest.
  assert.ok(config.bandCutLow[0]! < config.bandCutLow[1]!, 'cascade order reversed');
  assert.ok(config.bandCutLow[1]! < config.bandCutLow[2]!, 'cascade order reversed');
  assert.throws(() => cascadeBands([768]), RangeError);
  assert.throws(() => cascadeBands([768, 0]), RangeError);
});

test('the radial grid grows monotonically from the inner to the outer radius', () => {
  for (const tier of [FIXED_BUDGET, LIGHT_BUDGET]) {
    const config = oceanConfig(tier);
    const grid = radialGrid(config.rings, config.segs);
    assert.equal(grid.vertexCount, (config.rings + 1) * config.segs + 1);
    assert.equal(grid.positions.length, grid.vertexCount * 3);
    assert.equal(grid.indices.length, config.segs * 3 + config.rings * config.segs * 6);
    // Vertex 0 is the centre; everything else is the ring lattice.
    assert.equal(grid.positions[0], 0);
    assert.equal(grid.positions[1], 0);
    assert.equal(grid.positions[2], 0);
    const radiusAt = (ring: number, seg: number) => {
      const vertex = 1 + ring * config.segs + seg;
      return Math.hypot(grid.positions[vertex * 3] ?? 0, grid.positions[vertex * 3 + 2] ?? 0);
    };
    for (let ring = 0; ring <= config.rings; ring++) {
      const first = radiusAt(ring, 0);
      for (let seg = 0; seg < config.segs; seg++) {
        // Radii reach 24 km, where float32 spacing is millimetres; compare relative.
        const tolerance = Math.max(1e-4, first * 1e-6);
        closeTo(radiusAt(ring, seg), first, tolerance, `ring ${ring} is not circular at segment ${seg}`);
      }
      if (ring > 0)
        assert.ok(first > radiusAt(ring - 1, 0), `ring ${ring} did not grow`);
    }
    closeTo(radiusAt(0, 0), GRID_INNER_RADIUS, 1e-6, 'inner radius');
    closeTo(radiusAt(config.rings, 0), GRID_OUTER_RADIUS, 1e-2, 'outer radius');
    for (const index of grid.indices)
      assert.ok(index < grid.vertexCount, `index ${index} exceeds the vertex count`);
  }
  assert.throws(() => radialGrid(0, 8), RangeError);
  assert.throws(() => radialGrid(8, 2), RangeError);
});

test('the canvas budget for both tiers stays inside the shared resolution caps', () => {
  for (const [budget, pixelCap] of [
    [FIXED_BUDGET, 1_200_000],
    [LIGHT_BUDGET, 400_000],
  ] as const) {
    for (const [width, height] of [
      [1920, 1080],
      [390, 780],
      [320, 560],
    ] as const) {
      for (const scale of [1, 0.8, 0.65]) {
        const size = algorithmResolution(width, height, budget, scale, 3);
        assert.ok(
          size.width * size.height <= pixelCap,
          `${width}x${height} at scale ${scale} produced ${size.width}x${size.height}`,
        );
        assert.ok(size.ratio <= budget.maxDpr + 1e-12, `ratio ${size.ratio} exceeded the DPR cap`);
        assert.ok(size.width >= 1 && size.height >= 1, 'resolution collapsed');
      }
      // A downshift may only ever shrink the buffer.
      const full = algorithmResolution(width, height, budget, 1, 3);
      const downshifted = algorithmResolution(width, height, budget, 0.65, 3);
      assert.ok(
        downshifted.width * downshifted.height < full.width * full.height,
        'the quality ladder did not reduce the pixel count',
      );
    }
  }
});

/* ── sun and look ────────────────────────────────────────────────────────── */

test('the low warm sun points where the look says and stays physically sane', () => {
  const sun = sunState(LOOK);
  const length = Math.hypot(...sun.direction);
  closeTo(length, 1, 1e-12, 'sun direction is not a unit vector');
  closeTo((Math.asin(sun.direction[1]) * 180) / Math.PI, LOOK.sunElevationDeg, 1e-9, 'sun elevation');
  assert.ok(sun.energy > 0 && Number.isFinite(sun.energy), 'sun energy is degenerate');
  for (const value of [...sun.betaR, ...sun.betaM, ...sun.color])
    assert.ok(Number.isFinite(value) && value >= 0, 'a Preetham coefficient is not a finite non-negative number');
  // A sunset is red dominated: the blue channel cannot survive the long slant path.
  assert.ok(sun.color[0] > sun.color[1] && sun.color[1] > sun.color[2], `sun is not warm: ${sun.color}`);
  assert.ok(sun.color[0] / Math.max(sun.color[2], 1e-6) > 10, 'sun is not low enough to be a sunset');

  const noon = sunState({ ...LOOK, sunElevationDeg: 70 });
  assert.ok(
    noon.color[2] / Math.max(noon.color[0], 1e-6) > sun.color[2] / Math.max(sun.color[0], 1e-6),
    'raising the sun should cost less blue than a sunset does',
  );
});

test('the look keeps the camera above water and the pointer yaw small', () => {
  assert.ok(LOOK.cameraHeight > 0, 'the camera must sit above the water plane');
  assert.ok(LOOK.cameraHeight < 20, 'the camera should skim the surface, not fly over it');
  assert.ok(LOOK.cameraPitch < 0, 'a downward pitch is what puts the horizon in the upper third');
  assert.ok(
    LOOK.pointerYawRange > 0 && LOOK.pointerYawRange <= 0.25,
    `pointer yaw of ${LOOK.pointerYawRange} rad is not a small bounded offset`,
  );
  // The horizon must land inside the frame so there is sky to reflect.
  const halfFov = (LOOK.fieldOfView * Math.PI) / 360;
  const horizonOffset = Math.tan(Math.abs(LOOK.cameraPitch)) / Math.tan(halfFov);
  assert.ok(horizonOffset > 0 && horizonOffset < 1, `the horizon sits outside the frame (${horizonOffset})`);
  assert.ok(angularFrequency(0.05, LOOK.depth) > 0, 'dispersion relation is degenerate');
});

test('no pointer value can turn the camera past the bounded yaw', () => {
  const low = LOOK.cameraBaseYaw - LOOK.pointerYawRange;
  const high = LOOK.cameraBaseYaw + LOOK.pointerYawRange;
  for (const x of [-9, -1, -0.5, 0, 0.5, 1, 9, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
    const yaw = pointerYaw({ x, active: true }, LOOK);
    assert.ok(Number.isFinite(yaw), `pointer x=${x} produced a non-finite heading`);
    assert.ok(yaw >= low - 1e-12 && yaw <= high + 1e-12, `pointer x=${x} left the yaw bound: ${yaw}`);
  }
  // An inactive pointer, or no pointer at all, holds the base heading exactly.
  for (const pointer of [{ x: 1, active: false }, { x: 0.3 }, {}])
    assert.equal(pointerYaw(pointer, LOOK), LOOK.cameraBaseYaw);
  assert.equal(pointerYaw({ x: 1, active: true }, LOOK), high, 'the pointer cannot reach the edge');
  assert.equal(pointerYaw({ x: -1, active: true }, LOOK), low, 'the pointer cannot reach the edge');
});

test('the yaw approaches its target without overshoot and only by the frame delta', () => {
  const target = LOOK.cameraBaseYaw + LOOK.pointerYawRange;
  assert.equal(smoothYaw(LOOK.cameraBaseYaw, target, 0, LOOK.yawResponse), LOOK.cameraBaseYaw);
  let yaw: number = LOOK.cameraBaseYaw;
  for (let frame = 0; frame < 300; frame++) {
    const next = smoothYaw(yaw, target, 1 / 60, LOOK.yawResponse);
    assert.ok(next >= yaw && next <= target, `the yaw overshot on frame ${frame}: ${next}`);
    yaw = next;
  }
  closeTo(yaw, target, 1e-4, 'the yaw never arrives at its target');
  // A resumed tab cannot jump the heading: the delta is clamped the way the runtime clamps its own.
  assert.ok(smoothYaw(LOOK.cameraBaseYaw, target, 30, LOOK.yawResponse) <= target);
  assert.equal(smoothYaw(Number.NaN, target, 1 / 60, LOOK.yawResponse), target);
  assert.equal(smoothYaw(0.1, Number.NaN, 1 / 60, LOOK.yawResponse), 0.1);
});

/* ── scene construction: capability failures and resource release ────────── */

/** Minimal stand-in for the WebGL2 context the scene asks the canvas for. */
class FakeWebglContext {
  readonly requested: string[] = [];
  loseCalls = 0;
  constructor(private readonly granted: readonly string[]) {}
  getExtension(name: string): unknown {
    this.requested.push(name);
    // A fresh extension object per call, exactly as a real context returns.
    if (name === 'WEBGL_lose_context') {
      return {
        loseContext: () => {
          this.loseCalls += 1;
        },
      };
    }
    return this.granted.includes(name) ? {} : null;
  }
}

class FakeCanvas {
  className = '';
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly requested: string[] = [];
  removed = 0;
  constructor(private readonly context: FakeWebglContext | null) {}
  getContext(id: string) {
    this.requested.push(id);
    return this.context;
  }
  remove() {
    this.removed += 1;
  }
}

/** A container that records what the scene creates and attaches. */
function fakeStage(context: FakeWebglContext | null) {
  const canvases: FakeCanvas[] = [];
  const children: unknown[] = [];
  const container = {
    ownerDocument: {
      defaultView: { devicePixelRatio: 2 },
      createElement: () => {
        const canvas = new FakeCanvas(context);
        canvases.push(canvas);
        return canvas;
      },
    },
    append(child: unknown) {
      children.push(child);
    },
  };
  return { container: container as unknown as HTMLElement, canvases, children };
}

function expectUnsupported(code: string) {
  return (error: unknown) => {
    assert.ok(isOceanUnsupportedError(error), `not an OceanUnsupportedError: ${String(error)}`);
    assert.equal(error.code, code);
    return true;
  };
}

test('a context without float render targets is released once and leaves nothing attached', () => {
  const context = new FakeWebglContext([]);
  const { container, canvases, children } = fakeStage(context);
  assert.throws(
    () => createScene(container, FIXED_BUDGET, new AbortController().signal),
    expectUnsupported('float-render-target'),
  );
  const canvas = canvases[0];
  assert.ok(canvas, 'the scene must still have probed for a context');
  assert.deepEqual(canvas.requested, ['webgl2'], 'the scene probed no other context type');
  assert.ok(context.requested.includes('EXT_color_buffer_float'), 'the capability was not probed');
  // The half-built scene must not strand a live context: the context is the
  // first resource registered, so it is lost exactly once, last of all.
  assert.equal(context.loseCalls, 1, 'the context was not released exactly once');
  assert.equal(
    context.requested.filter((name) => name === 'WEBGL_lose_context').length,
    1,
    'the lose-context extension was requested more than once',
  );
  assert.deepEqual(children, [], 'the canvas was attached to the stage');
  assert.equal(canvas.removed, 0, 'an unattached canvas was removed');
  assert.equal(canvas.style.width, undefined, 'the scene resized a canvas it never built');
});

test('no WebGL2 at all fails before a context can leak, and never loses one', () => {
  const { container, canvases, children } = fakeStage(null);
  assert.throws(
    () => createScene(container, FIXED_BUDGET, new AbortController().signal),
    expectUnsupported('webgl2'),
  );
  assert.deepEqual(canvases[0]?.requested, ['webgl2']);
  assert.deepEqual(children, [], 'nothing may be attached when no context was ever created');
});

test('an already-aborted signal never asks for a context', () => {
  const context = new FakeWebglContext(['EXT_color_buffer_float']);
  const controller = new AbortController();
  controller.abort();
  const { container, canvases, children } = fakeStage(context);
  assert.throws(
    () => createScene(container, FIXED_BUDGET, controller.signal),
    (error: unknown) => (error as Error).name === 'AbortError',
  );
  assert.equal(canvases.length, 0, 'a canvas was created for an aborted scene');
  assert.deepEqual(context.requested, [], 'a context was requested for an aborted scene');
  assert.equal(context.loseCalls, 0, 'a context that was never created was released');
  assert.deepEqual(children, [], 'the stage was touched');
});

test('a resource set releases in reverse order, so the context outlives every other object', () => {
  const released: string[] = [];
  const set = resourceSet();
  set.add({ dispose: () => released.push('context') }); // registered first: the context owner
  set.add({
    dispose: () => {
      released.push('targets');
      throw new Error('a stuck release must not strand the rest');
    },
  });
  set.add({ dispose: () => released.push('geometry') });
  set.dispose();
  set.dispose();
  assert.deepEqual(
    released,
    ['geometry', 'targets', 'context'],
    'release order or idempotence changed: the context could outlive its render targets',
  );
  assert.equal(set.disposed, true);
  // A resource added after release is disposed immediately rather than kept.
  let late = 0;
  const lateResource = { dispose: () => (late += 1) };
  set.add(lateResource);
  assert.equal(late, 1);
});

/* ── framebuffer lifetime across repeated resizes ────────────────────────── */

type PassCall = { shader: string; target: WebGLRenderTarget | null; width: number; height: number };

/** Names the bloom passes by their shader so a frame's pass list can be counted. */
const PASS_NAMES = new Map<string, string>([
  [BLIT_FRAGMENT_SHADER, 'blit'],
  [BLOOM_BRIGHT_FRAGMENT_SHADER, 'bright'],
  [BLOOM_DOWN_FRAGMENT_SHADER, 'down'],
  [BLOOM_UP_FRAGMENT_SHADER, 'up'],
  [COMPOSITE_FRAGMENT_SHADER, 'composite'],
]);

const passName = (shader: string) => PASS_NAMES.get(shader) ?? `other:${shader.slice(0, 16)}`;

/**
 * Builds the real surface against a fake renderer and pass factory. The scene
 * objects are Three's own; only the two things that would need a GPU are
 * stubbed, so the pass sequence and the target lifetimes are the shipped ones.
 */
function surfaceHarness(bloomLevels: number) {
  const calls: PassCall[] = [];
  const uniforms = new Map<string, Uniforms>();
  const textures = ['uD0', 'uD1', 'uD2', 'uV0', 'uV1', 'uV2', 'uF0', 'uF1', 'uF2'].map(
    (name) => ({ name }) as never,
  );
  const simulation = {
    displacement: (cascade: number) => textures[cascade] as never,
    slopes: (cascade: number) => textures[3 + cascade] as never,
    foam: (cascade: number) => textures[6 + cascade] as never,
    simulate: () => {},
    dispose: () => {},
  } as unknown as OceanSimulation;
  const passes = {
    makePass(fragmentShader: string, passUniforms: Uniforms) {
      uniforms.set(passName(fragmentShader), passUniforms);
      return {
        material: {} as never,
        uniforms: passUniforms,
        renderTo(target: WebGLRenderTarget | null) {
          calls.push({
            shader: passName(fragmentShader),
            target,
            width: target?.width ?? 0,
            height: target?.height ?? 0,
          });
        },
      };
    },
    dispose: () => {},
  } as unknown as PassFactory;
  const renderer = {
    setRenderTarget: () => {},
    clear: () => {},
    render: () => {},
  } as unknown as WebGLRenderer;
  const config = { ...oceanConfig(FIXED_BUDGET), bloomLevels };
  const surface = createOceanSurface(renderer, passes, config, LOOK, simulation);
  return { surface, calls, uniforms, config };
}

/** The framebuffer sizes the bloom chain must have for a given drawing buffer. */
function bloomLevelSizes(width: number, height: number, levels: number) {
  const sizes: string[] = [];
  for (let level = 0; level < levels; level++)
    sizes.push(`${Math.max(2, width >> (level + 1))}x${Math.max(2, height >> (level + 1))}`);
  return sizes;
}

test('every resize reallocates the bloom chain instead of growing it', (t) => {
  const LEVELS = 5;
  const originalDispose = WebGLRenderTarget.prototype.dispose;
  const released: WebGLRenderTarget[] = [];
  WebGLRenderTarget.prototype.dispose = function (this: WebGLRenderTarget) {
    released.push(this);
    return originalDispose.call(this);
  };
  t.after(() => {
    WebGLRenderTarget.prototype.dispose = originalDispose;
  });

  const { surface, calls } = surfaceHarness(LEVELS);
  t.after(() => surface.dispose());

  const sizes: Array<[number, number]> = [
    [64, 64], // the construction warm-up
    [320, 180],
    [1920, 1080],
    [1024, 1024],
    [101, 37], // a resize below the bloom floor, where every level clamps to 2x2
  ];
  for (let round = 0; round < sizes.length; round++) {
    const [width, height] = sizes[round] as [number, number];
    const releasedBefore = released.length;
    surface.resizeTargets(width, height);
    const roundReleases = released.slice(releasedBefore);
    // The first round has nothing to release; every later one drops the two
    // full-size buffers plus one target per bloom level. A resize that left the
    // previous chain behind would release nothing here and grow the next one.
    assert.equal(
      roundReleases.length,
      round === 0 ? 0 : 2 + LEVELS,
      `resize to ${width}x${height} released ${roundReleases.length} framebuffers`,
    );

    calls.length = 0;
    surface.renderFrame(0);
    const counts = calls.reduce<Record<string, number>>((totals, call) => {
      totals[call.shader] = (totals[call.shader] ?? 0) + 1;
      return totals;
    }, {});
    assert.equal(counts.blit, 1, `${width}x${height}: the scene blit ran ${counts.blit} times`);
    assert.equal(counts.bright, 1, `${width}x${height}: bright pass count`);
    assert.equal(counts.down, LEVELS - 1, `${width}x${height}: downsample count`);
    assert.equal(counts.up, LEVELS - 1, `${width}x${height}: upsample count`);
    assert.equal(counts.composite, 1, `${width}x${height}: composites`);

    // Every bloom target used this frame is a fresh one, sized for this round.
    const used = calls
      .filter((call) => call.shader === 'down' || call.shader === 'up' || call.shader === 'bright')
      .map((call) => call.target as WebGLRenderTarget);
    assert.ok(
      used.every((target) => !roundReleases.includes(target)),
      `${width}x${height}: a released framebuffer was rendered into again`,
    );
    assert.deepEqual(
      [...new Set(used.map((target) => `${target.width}x${target.height}`))].sort(),
      bloomLevelSizes(width, height, LEVELS).sort(),
      `${width}x${height}: the bloom chain does not match this drawing buffer`,
    );
  }

  // The chain is bounded by the tier, not by how many times the window changed:
  // one full round of framebuffers per resize after the first, and no more.
  assert.equal(released.length, (sizes.length - 1) * (2 + LEVELS));

  surface.dispose();
  const afterDispose = (sizes.length - 1) * (2 + LEVELS) + 2 + LEVELS;
  assert.equal(released.length, afterDispose, 'dispose released the whole chain once');
  calls.length = 0;
  surface.resizeTargets(1920, 1080);
  surface.renderFrame(0);
  assert.deepEqual(calls, [], 'a disposed surface still rendered');
  assert.equal(released.length, afterDispose, 'dispose is not idempotent');
});

test('the light tier allocates no bloom chain at all', (t) => {
  const originalDispose = WebGLRenderTarget.prototype.dispose;
  const released: WebGLRenderTarget[] = [];
  WebGLRenderTarget.prototype.dispose = function (this: WebGLRenderTarget) {
    released.push(this);
    return originalDispose.call(this);
  };
  t.after(() => {
    WebGLRenderTarget.prototype.dispose = originalDispose;
  });

  const { surface, calls } = surfaceHarness(0);
  t.after(() => surface.dispose());
  let rounds = 0;
  for (const [width, height] of [
    [64, 64],
    [800, 450],
  ] as Array<[number, number]>) {
    surface.resizeTargets(width, height);
    calls.length = 0;
    surface.renderFrame(0);
    assert.equal(
      calls.filter((call) => call.shader === 'bright' || call.shader === 'down' || call.shader === 'up')
        .length,
      0,
      `${width}x${height}: the light tier ran bloom passes`,
    );
    // The composite still reads one stand-in bloom texture, so the shader needs
    // no second variant; it is a 1x1 resource, not a chain.
    assert.equal(calls.filter((call) => call.shader === 'composite').length, 1);
    rounds += 1;
  }
  assert.equal(released.length, (rounds - 1) * 2, 'only the two full-size buffers per round');
});

test('the post chain receives the tuned exposure and bloom, and no bloom on the light tier', (t) => {
  // The sunglint is the brightest thing in frame: too much exposure or bloom
  // there turns the right of the frame near-white and costs the heading its
  // contrast. The two dials that control it are checked here against the
  // upstream demo's defaults, which are what the tuned values were lowered from.
  const UPSTREAM_EXPOSURE = 1.05;
  const UPSTREAM_BLOOM = 0.42;
  assert.ok(
    LOOK.exposure > 0 && LOOK.exposure < UPSTREAM_EXPOSURE,
    `exposure ${LOOK.exposure} is not a reduction of the upstream default`,
  );
  assert.ok(
    LOOK.bloomStrength > 0 && LOOK.bloomStrength < UPSTREAM_BLOOM,
    `bloom strength ${LOOK.bloomStrength} is not a reduction of the upstream default`,
  );

  const full = surfaceHarness(5);
  t.after(() => full.surface.dispose());
  const composite = full.uniforms.get('composite');
  assert.ok(composite, 'the composite pass was not created');
  assert.equal(composite.uExposure?.value, LOOK.exposure, 'the composite ignores the exposure');
  assert.equal(composite.uBloomStr?.value, LOOK.bloomStrength, 'the composite ignores the bloom dial');
  // The stand-in bloom texture must contribute nothing when the dial is zeroed.
  assert.equal(full.uniforms.get('bright') !== undefined, true, 'the bloom chain is missing');

  const light = surfaceHarness(0);
  t.after(() => light.surface.dispose());
  const lightComposite = light.uniforms.get('composite');
  assert.equal(
    lightComposite?.uBloomStr?.value,
    0,
    'the light tier must not add bloom even though the dial is non-zero',
  );
  // The bloom passes exist as objects either way; what the light tier must not
  // do is allocate a chain or run them (see the resize tests above).
  light.surface.resizeTargets(800, 450);
  light.calls.length = 0;
  light.surface.renderFrame(0);
  assert.equal(
    light.calls.filter((call) => call.shader === 'bright' || call.shader === 'down' || call.shader === 'up')
      .length,
    0,
    'the light tier ran bloom passes',
  );
});

/* ── vendored upstream and licensing ─────────────────────────────────────── */

const projectPath = (relative: string) => new URL(relative, new URL('../', import.meta.url));
const PINNED_REF = '142265f5013b6f27bea4f4f819b832dec75c7bad';

type ManifestEntry = {
  kind: string;
  path: string;
  url: string;
  ref: string;
  bytes: number;
  sha256: string;
};

const manifest = JSON.parse(
  readFileSync(projectPath('src/client/vendor/ocean/manifest.json'), 'utf8'),
) as { sourceRef: string; licenseFile: string; entries: ManifestEntry[] };

test('the vendored upstream file is the pinned abyssal-ocean revision, byte for byte', () => {
  assert.equal(manifest.sourceRef, PINNED_REF, 'the pinned revision changed');
  assert.ok(manifest.entries.length >= 2, 'the manifest lost its entries');
  for (const entry of manifest.entries) {
    const bytes = readFileSync(projectPath(entry.path));
    assert.equal(bytes.byteLength, entry.bytes, `${entry.path}: byte length`);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      entry.sha256,
      `${entry.path}: sha256`,
    );
    assert.match(entry.url, new RegExp(`/${PINNED_REF}/`), `${entry.path}: URL is not pinned`);
    assert.equal(entry.ref, PINNED_REF, `${entry.path}: ref`);
  }
  const vendored = manifest.entries.find((entry) =>
    entry.path.startsWith('src/client/vendor/ocean/'),
  );
  assert.ok(vendored, 'the pinned upstream source is not vendored');
  // The pinned file is the reference the GLSL was transcribed from; a demo file
  // that no longer contains the spectral passes would invalidate that claim.
  const source = readFileSync(projectPath(vendored.path), 'utf8');
  for (const name of ['h0Pass', 'specPass', 'bfPass', 'asmPass', 'foamPass', 'makeButterflyTexture'])
    assert.ok(source.includes(name), `the pinned source no longer contains ${name}`);
});

test('the shipped licence is the complete unmodified MIT text', () => {
  assert.equal(manifest.licenseFile, 'public/vendor/licenses/ocean-LICENSE.txt');
  const text = readFileSync(projectPath(manifest.licenseFile), 'utf8');
  assert.match(text, /^MIT License\n\nCopyright \(c\) 2026 Sacha \(@squall01337\)\n/);
  // The upstream file hard-wraps its paragraphs, so compare on flattened text.
  const flat = text.replace(/\s+/g, ' ');
  for (const phrase of [
    'Permission is hereby granted, free of charge, to any person obtaining a copy',
    'without restriction, including without limitation the rights',
    'The above copyright notice and this permission notice shall be included in all',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND',
    'MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT',
    'IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE',
    'IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
  ])
    assert.ok(flat.includes(phrase), `the licence is missing: ${phrase}`);
  assert.ok(text.trimEnd().endsWith('SOFTWARE.'), 'the licence is truncated');
});

test('the scene loads nothing at runtime: no CDN, no fetch, no remote URL', () => {
  const modules = [
    'scene.ts',
    'render.ts',
    'simulation.ts',
    'pass.ts',
    'shaders.ts',
    'spectrum.ts',
    'butterfly.ts',
    'config.ts',
    'look.ts',
    'resources.ts',
  ];
  for (const name of modules) {
    const source = readFileSync(projectPath(`src/client/algorithms/ocean/${name}`), 'utf8');
    assert.doesNotMatch(source, /https?:\/\//, `${name}: a remote URL is referenced`);
    assert.doesNotMatch(source, /\bfetch\s*\(/, `${name}: fetch call`);
    assert.doesNotMatch(source, /\bnew\s+XMLHttpRequest\b/, `${name}: XHR`);
    assert.doesNotMatch(source, /\bimportScripts\s*\(/, `${name}: importScripts`);
    assert.doesNotMatch(
      source,
      /\b(?:from|import)\s*\(?\s*['"]https?:/,
      `${name}: a module is imported from a URL`,
    );
  }
});

/* ── the GLSL/JS interface and the documented upstream removals ──────────── */

const SCENE_MODULES = [
  'scene.ts',
  'render.ts',
  'simulation.ts',
  'pass.ts',
  'shaders.ts',
  'spectrum.ts',
  'butterfly.ts',
  'config.ts',
  'look.ts',
  'resources.ts',
];

const moduleSource = (name: string) =>
  readFileSync(projectPath(`src/client/algorithms/ocean/${name}`), 'utf8');

/**
 * Declared uniform names of an assembled GLSL source. The scene passes uniform
 * objects to `RawShaderMaterial`, which ignores a name the shader does not
 * declare and hands an undeclared one the default zero, so a typo on either
 * side is silent until it shows up as a black surface in a browser.
 */
function declaredUniforms(glsl: string): string[] {
  const names: string[] = [];
  for (const match of glsl.matchAll(/^[ \t]*uniform[ \t]+\w+[ \t]+([^;]+);/gm)) {
    const list = match[1];
    if (!list) continue;
    for (const name of list.split(',')) names.push(name.trim());
  }
  return names.sort();
}

test('every spectral pass declares exactly the uniforms the pipeline feeds it', () => {
  const expected: Array<[string, string, string[]]> = [
    [
      'h0',
      H0_FRAGMENT_SHADER,
      [
        'uAmp',
        'uCutHi',
        'uCutLo',
        'uDepth',
        'uFetch',
        'uL',
        'uN',
        'uSeed',
        'uShort',
        'uSpread',
        'uSwell',
        'uWind',
        'uWindDir',
      ],
    ],
    ['spectrum', SPECTRUM_FRAGMENT_SHADER, ['uDepth', 'uH0', 'uL', 'uN', 'uTime']],
    ['butterfly', BUTTERFLY_FRAGMENT_SHADER, ['uBf', 'uDir', 'uSrc0', 'uSrc1', 'uStage']],
    ['assembly', ASSEMBLY_FRAGMENT_SHADER, ['uChop', 'uN', 'uSrc0', 'uSrc1']],
    ['foam', FOAM_FRAGMENT_SHADER, ['uDecay', 'uDisp', 'uDt', 'uN', 'uPrev', 'uStrength', 'uThresh']],
    ['quad', QUAD_VERTEX_SHADER, []],
    ['sky vertex', SKY_VERTEX_SHADER, ['modelMatrix', 'modelViewMatrix', 'projectionMatrix']],
    [
      'ocean vertex',
      OCEAN_VERTEX_SHADER,
      [
        'projectionMatrix',
        'uCamPos',
        'uD0',
        'uD1',
        'uD2',
        'uL0',
        'uL1',
        'uL2',
        'viewMatrix',
      ],
    ],
    ['blit', BLIT_FRAGMENT_SHADER, ['uColor', 'uDepth']],
    ['bloom bright', BLOOM_BRIGHT_FRAGMENT_SHADER, ['uKnee', 'uTex', 'uTexel', 'uThresh']],
    ['bloom down', BLOOM_DOWN_FRAGMENT_SHADER, ['uTex', 'uTexel']],
    ['bloom up', BLOOM_UP_FRAGMENT_SHADER, ['uRadius', 'uTex', 'uTexel']],
    [
      'composite',
      COMPOSITE_FRAGMENT_SHADER,
      ['uBloom', 'uBloomStr', 'uExposure', 'uScene', 'uTexel', 'uTime', 'uVignette'],
    ],
  ];
  for (const [name, source, uniforms] of expected)
    assert.deepEqual(declaredUniforms(source), [...uniforms].sort(), `${name} uniforms`);
});

test('the shared sky, noise and depth chunks are the only sources of the look uniforms', () => {
  // One uniform set drives the dome and the water, so the sky the water
  // reflects cannot drift from the sky it is drawn against.
  const sky = ['uBetaM', 'uBetaR', 'uMieG', 'uSkyGain', 'uSunDir', 'uSunE'];
  assert.deepEqual(declaredUniforms(GL_SKY), [...sky].sort(), 'the sky chunk changed');
  assert.deepEqual(declaredUniforms(GL_NOISE), [], 'the noise chunk declares a uniform');
  assert.deepEqual(declaredUniforms(GL_DEPTH), ['uFar', 'uNear'], 'the depth chunk changed');
  for (const source of [SKY_FRAGMENT_SHADER, OCEAN_FRAGMENT_SHADER])
    for (const name of sky)
      assert.ok(declaredUniforms(source).includes(name), `a scene shader lost ${name}`);
  // The water fragment is the whole look: it must keep every upstream term.
  // The displacement cascades are sampled in the vertex stage, so they are
  // checked there instead.
  const water = declaredUniforms(OCEAN_FRAGMENT_SHADER);
  for (const name of [
    ...sky,
    'uAbsorb',
    'uScatter',
    'uSSSColor',
    'uSSSStrength',
    'uFoamColor',
    'uFoamAmount',
    'uRefract',
    'uFogDensity',
    'uGlitter',
    'uSunColor',
    'uSceneColor',
    'uSceneDepth',
    'uResolution',
    'uTime',
    'uV0',
    'uV1',
    'uV2',
    'uF0',
    'uF1',
    'uF2',
    'uL0',
    'uL1',
    'uL2',
  ])
    assert.ok(water.includes(name), `the water shader lost ${name}`);
  const waterVertex = declaredUniforms(OCEAN_VERTEX_SHADER);
  for (const name of ['uCamPos', 'uD0', 'uD1', 'uD2', 'uL0', 'uL1', 'uL2'])
    assert.ok(waterVertex.includes(name), `the water vertex shader lost ${name}`);
});

/** Flattens GLSL to single spaces with comments removed, so only code tokens remain. */
function flattenGlsl(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('the spectral passes and the shared GLSL chunks are the pinned upstream text', () => {
  // The scene claims to run upstream's FFT, spectrum, foam and sky rather than a
  // look-alike. Flattened to code tokens, each shipped body must still appear
  // verbatim inside the vendored file: a rewrite would break this, a removed
  // comment or a re-indent would not. Only these five passes and the three
  // shared chunks are checked here; the water material drops the shoaling,
  // reflection and underwater branches listed in the vendor README.
  const upstream = flattenGlsl(
    readFileSync(projectPath('src/client/vendor/ocean/index.html'), 'utf8'),
  );
  const head = flattenGlsl(GL_HEAD);
  // The assembled shaders carry the preamble; the three chunks are concatenated
  // into them and are checked on their own.
  const shipped: Array<[string, string, boolean]> = [
    ['h0', H0_FRAGMENT_SHADER, true],
    ['spectrum', SPECTRUM_FRAGMENT_SHADER, true],
    ['butterfly', BUTTERFLY_FRAGMENT_SHADER, true],
    ['assembly', ASSEMBLY_FRAGMENT_SHADER, true],
    ['foam', FOAM_FRAGMENT_SHADER, true],
    ['sky', GL_SKY, false],
    ['noise', GL_NOISE, false],
    ['depth', GL_DEPTH, false],
  ];
  for (const [name, source, assembled] of shipped) {
    const flat = flattenGlsl(source);
    if (assembled) assert.ok(flat.startsWith(head), `${name} does not carry the shared preamble`);
    const body = (flat.startsWith(head) ? flat.slice(head.length) : flat).trim();
    assert.ok(body.length > 100, `${name} is too short to be the upstream kernel`);
    assert.ok(
      upstream.includes(body),
      `${name} is not the pinned upstream GLSL: it was rewritten rather than transcribed`,
    );
  }
});

test('the removed upstream systems leave no identifier behind', () => {
  // Island, sea bed, shoaling, buoys, screen-space reflection, the underwater
  // view, the height probe and the UI: none of it may survive even as a dead
  // uniform, a varying or a leftover call.
  const removed = [
    'uTerrain',
    'uTerrainSize',
    'uShoal',
    'vShoal',
    'uCaustics',
    'uShoreWidth',
    'bedAt',
    'uSSR',
    'uUnderwater',
    'uUnder',
    'uUWDensity',
    'probePass',
    'readRenderTargetPixels',
    'waterY',
    'buildPanel',
    'BUOY_ANCHORS',
    'IS_PHONE',
    'requestAnimationFrame',
    'performance.now',
    'Date.now',
    'new Date',
  ];
  const shaders = [
    H0_FRAGMENT_SHADER,
    SPECTRUM_FRAGMENT_SHADER,
    BUTTERFLY_FRAGMENT_SHADER,
    ASSEMBLY_FRAGMENT_SHADER,
    FOAM_FRAGMENT_SHADER,
    OCEAN_VERTEX_SHADER,
    OCEAN_FRAGMENT_SHADER,
    SKY_VERTEX_SHADER,
    SKY_FRAGMENT_SHADER,
    BLIT_FRAGMENT_SHADER,
    BLOOM_BRIGHT_FRAGMENT_SHADER,
    BLOOM_DOWN_FRAGMENT_SHADER,
    BLOOM_UP_FRAGMENT_SHADER,
    COMPOSITE_FRAGMENT_SHADER,
    QUAD_VERTEX_SHADER,
  ].join('\n');
  for (const name of removed) {
    for (const [label, source] of [
      ['shaders.ts', shaders],
      ...SCENE_MODULES.map((module) => [module, moduleSource(module)] as const),
    ] as Array<readonly [string, string]>)
      assert.ok(
        !new RegExp(`\\b${name.replace('.', '\\.')}\\b`).test(source),
        `${label}: ${name} is still present`,
      );
  }
});
