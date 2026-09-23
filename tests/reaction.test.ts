/**
 * CPU reference tests for the reaction-diffusion hero.
 *
 * These pin the maths of the vendored shaders (3×3 Laplacian, Gray–Scott step, 16-bit-in-RGBA8
 * packing, double-buffer discipline) and the scene's lifecycle contracts. They are not shader
 * compilation or GPU validation: the browser checks for this scene live in the delivery task.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GRAY_SCOTT_PARAMETERS,
  GrayScottSimulation,
  createSeededState,
  decode16bit,
  decodeState,
  encode16bit,
  encodeState,
  laplacianAt,
  reactionSettings,
  seedLattice,
  stepGrayScott,
  type GrayScottState,
} from '../src/client/algorithms/reaction/gray-scott';
import {
  REACTION_VIEW_SCALE,
  REACTION_VIEW_WARP,
  sampledRegion,
  pointerToGrid,
  type SamplingRegion,
} from '../src/client/algorithms/reaction/view';
import {
  REACTION_DISPLAY_FRAGMENT,
  DISPLAY_CREST,
  DISPLAY_RELIEF,
} from '../src/client/algorithms/reaction/display';
import {
  REACTION_BRUSH_FRAGMENT,
  REACTION_UPDATE_FRAGMENT,
} from '../src/client/vendor/reaction/reaction-diffusion';
import { POINTER_RADIUS, createScene } from '../src/client/algorithms/reaction/scene';

/** Worst case of upstream's packing: the low byte covers [0,1) at 1/256, the high byte [0,1] at 255/256. */
const PACKING_ERROR = 5e-5;

function flat(value: number, cells: number): GrayScottState {
  return { a: new Float64Array(cells).fill(value), b: new Float64Array(cells).fill(value) };
}

function empty(cells: number): GrayScottState {
  return { a: new Float64Array(cells), b: new Float64Array(cells) };
}

test('the 16-bit packing round-trips within the error the encoding can promise', () => {
  let worst = 0;
  for (let index = 0; index <= 20000; index++) {
    const value = index / 20000;
    const [high, low] = encode16bit(value);
    assert.ok(high >= 0 && high <= 255 && low >= 0 && low <= 255, `${value} packed out of range`);
    worst = Math.max(worst, Math.abs(decode16bit(high, low) - value));
  }
  assert.ok(worst <= PACKING_ERROR, `worst round-trip error ${worst}`);
  assert.ok(
    worst > 0,
    'a packing without quantization error would mean the test reads the wrong bytes',
  );
  // The scale is set by the low byte: half a step of 1/256 over 255.
  assert.ok(worst < 0.5 / 255 + 1e-9);
});

test('the packing clamps out-of-range concentrations instead of wrapping', () => {
  assert.deepEqual(encode16bit(-3), [0, 0]);
  assert.deepEqual(encode16bit(0), [0, 0]);
  const [high, low] = encode16bit(4.5);
  assert.equal(high, 255);
  assert.ok(decode16bit(high, low) <= 1 && decode16bit(high, low) > 0.999);
});

test('decoding a packed channel is monotone in the encoded value', () => {
  let previous = -Infinity;
  for (let index = 0; index <= 5000; index++) {
    const value = index / 5000;
    const [high, low] = encode16bit(value);
    const decoded = decode16bit(high, low);
    assert.ok(decoded >= previous - 1e-12, `${value} decoded below its predecessor`);
    previous = decoded;
  }
});

test('a state survives the RGBA8 packing within the same tolerance', () => {
  const state = createSeededState(32, 32);
  const packed = encodeState(state);
  assert.equal(packed.length, 32 * 32 * 4);
  const restored = decodeState(packed);
  let worst = 0;
  for (let index = 0; index < state.a.length; index++) {
    worst = Math.max(worst, Math.abs(restored.a[index] - state.a[index]));
    worst = Math.max(worst, Math.abs(restored.b[index] - state.b[index]));
  }
  assert.ok(worst <= PACKING_ERROR, `worst state error ${worst}`);
  // Chemical A is the high pair and B the low pair: the seeded cells (A = 1, B = 1) are near white.
  const seedIndex = state.b.findIndex((value) => value === 1);
  assert.ok(seedIndex >= 0);
  const [aHigh, aLow] = encode16bit(1);
  const [bHigh, bLow] = encode16bit(1);
  assert.deepEqual(Array.from(packed.slice(seedIndex * 4, seedIndex * 4 + 4)), [
    aHigh,
    aLow,
    bHigh,
    bLow,
  ]);
});

test('a uniform field has no diffusion and follows the local reaction only', () => {
  const width = 8;
  const height = 6;
  const a = 0.9;
  const b = 0.2;
  const source = flat(0, width * height);
  source.a.fill(a);
  source.b.fill(b);
  // The weights do not add up bit-exactly in floating point (-1 + 4×0.05 + 4×0.20), so the uniform
  // Laplacian is a rounding residual rather than a hard zero; anything larger would be a real leak.
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const laplacian = laplacianAt(source.a, width, height, x, y);
      assert.ok(Math.abs(laplacian) < 1e-12, `laplacian at ${x},${y} is ${laplacian}`);
    }

  const target = empty(width * height);
  stepGrayScott(source, target, width, height);
  const reaction = a * b * b;
  const expectedA =
    a + (GRAY_SCOTT_PARAMETERS.diffuseA * 0 - reaction + GRAY_SCOTT_PARAMETERS.feed * (1 - a));
  const expectedB =
    b +
    (GRAY_SCOTT_PARAMETERS.diffuseB * 0 +
      reaction -
      (GRAY_SCOTT_PARAMETERS.kill + GRAY_SCOTT_PARAMETERS.feed) * b);
  for (let index = 0; index < width * height; index++) {
    assert.ok(Math.abs(target.a[index] - expectedA) < 1e-15, `A at ${index}`);
    assert.ok(Math.abs(target.b[index] - expectedB) < 1e-15, `B at ${index}`);
  }
  assert.notEqual(expectedA, a, 'the hand calculation must actually move the field');
});

test('a single seeded cell changes exactly its 3×3 block after one step', () => {
  const width = 9;
  const height = 9;
  const source = flat(1, width * height);
  source.b.fill(0);
  const centerX = 4;
  const centerY = 4;
  source.b[centerY * width + centerX] = 1;

  const target = empty(width * height);
  stepGrayScott(source, target, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const inside = Math.max(Math.abs(x - centerX), Math.abs(y - centerY)) <= 1;
      // B starts at zero away from the seed and every term there is exactly zero, so the untouched
      // cells must come back bit-identical.
      if (!inside) {
        assert.equal(target.b[index], source.b[index], `B at ${x},${y} changed`);
        // A only moves by the uniform-field rounding tail of the stencil weights
        // (-1 + 4×0.05 + 4×0.20 is one ULP from zero), never by real transport.
        assert.ok(
          Math.abs(target.a[index] - source.a[index]) <= 1e-12,
          `A at ${x},${y} moved by ${Math.abs(target.a[index] - source.a[index])}`,
        );
      } else {
        assert.notEqual(target.b[index], source.b[index], `B at ${x},${y} did not change`);
      }
    }
  }
  // The disturbance spreads one cell per step and never jumps further.
  const second = empty(width * height);
  stepGrayScott(target, second, width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const inside = Math.max(Math.abs(x - centerX), Math.abs(y - centerY)) <= 2;
      assert.equal(second.b[index] !== target.b[index], inside, `cell ${x},${y} after two steps`);
    }
  }
});

test('edge and corner cells read replicated neighbours, not zeros', () => {
  const width = 4;
  const height = 4;
  const values = new Float64Array(width * height);
  // Row 0 (the bottom) is 1, the rest is 0: the boundary has to replicate that row.
  for (let x = 0; x < width; x++) values[x] = 1;
  // Independent stencil, written from the shader's weights with an explicit clamp-to-edge read.
  const read = (x: number, y: number) =>
    values[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];
  const stencil = (x: number, y: number) =>
    -read(x, y) +
    0.05 * (read(x - 1, y - 1) + read(x + 1, y - 1) + read(x - 1, y + 1) + read(x + 1, y + 1)) +
    0.2 * (read(x, y - 1) + read(x - 1, y) + read(x + 1, y) + read(x, y + 1));
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [3, 0],
    [0, 3],
    [3, 3],
    [1, 1],
  ] as const) {
    const value = laplacianAt(values, width, height, x, y);
    assert.ok(Math.abs(value - stencil(x, y)) < 1e-12, `${x},${y}: ${value} vs ${stencil(x, y)}`);
  }
  // A boundary cell with a real gradient is not a no-op, and the corner is not silently zero.
  assert.ok(Math.abs(laplacianAt(values, width, height, 0, 0)) > 1e-3);
  assert.ok(Math.abs(laplacianAt(values, width, height, 1, 0)) > 1e-3);
});

test('the diffusion operator conserves mass away from the domain border', () => {
  const width = 24;
  const height = 24;
  const values = new Float64Array(width * height);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++)
      values[y * width + x] = Math.sin(x * 0.7) * Math.cos(y * 0.3) + 1.5;
  let sum = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) sum += laplacianAt(values, width, height, x, y);
  assert.ok(Math.abs(sum) < 1e-12, `laplacian sum ${sum}`);
});

test('the light tier warm-up already grows a colony from the seed blobs', () => {
  const light = reactionSettings(true);
  const seed = createSeededState(light.gridSize, light.gridSize);
  const seededArea = seed.b.reduce((total, value) => total + value, 0);
  const simulation = new GrayScottSimulation(light.gridSize, light.gridSize, undefined, seed);
  simulation.iterate(light.prewarm);
  const { b } = simulation.front;
  let maxB = 0;
  let colony = 0;
  for (const value of b) {
    assert.ok(Number.isFinite(value), 'warm-up produced a non-finite concentration');
    maxB = Math.max(maxB, value);
    if (value > 0.02) colony++;
  }
  // Measured with feed 0.030 / kill 0.0601 at 48 steps on 256²: 2649 seeded cells → 23271 in
  // colonies (×8.8), peak B ≈ 0.423, and A never below 0.198.
  assert.ok(
    colony > seededArea * 1.5,
    `warm-up only reached ${colony} of ${seededArea} seeded cells`,
  );
  assert.ok(maxB > 0.2, `warm-up peak B is only ${maxB}`);
});

test('the colony still grows between 500 and 4000 steps at 128² without collapsing', () => {
  const size = 128;
  const seed = createSeededState(size, size);
  const simulation = new GrayScottSimulation(size, size, undefined, seed);
  const sample = () => {
    const { a, b } = simulation.front;
    let maxB = 0;
    let active = 0;
    let minA = Infinity;
    for (let index = 0; index < a.length; index++) {
      assert.ok(
        Number.isFinite(a[index]) && Number.isFinite(b[index]),
        `cell ${index} is not finite`,
      );
      assert.ok(a[index] > -0.1 && a[index] < 1.2, `A at ${index} left its range: ${a[index]}`);
      assert.ok(b[index] > -0.1 && b[index] < 1.2, `B at ${index} left its range: ${b[index]}`);
      maxB = Math.max(maxB, b[index]);
      minA = Math.min(minA, a[index]);
      if (b[index] > 0.02) active++;
    }
    return { maxB, minA, fraction: active / a.length, b: Float64Array.from(b) };
  };

  simulation.iterate(500);
  const early = sample();
  simulation.iterate(1500);
  const middle = sample();
  simulation.iterate(2000);
  const late = sample();
  assert.equal(simulation.iterations, 4000);
  // Measured with feed 0.030 / kill 0.0601: 500 steps → 68.8% active, 2000 → 87.7%, 4000 → 90.5%,
  // peak B ≈ 0.362-0.390, and A never below 0.26. The colony keeps filling in for four thousand
  // steps without the field dying to A = 1, B = 0 or flooding into one sheet.
  assert.ok(early.fraction > 0.5, `active fraction collapsed to ${early.fraction} by 500 steps`);
  assert.ok(middle.fraction > 0.5, `active fraction fell to ${middle.fraction} by 2000 steps`);
  assert.ok(late.fraction > 0.5, `active fraction fell to ${late.fraction} by 4000 steps`);
  assert.ok(late.maxB > 0.2, `peak B fell to ${late.maxB}`);
  // "Still has B" is not enough on its own: the reaction must still be consuming A across the grid.
  assert.ok(late.minA < 0.5, `no cell is consuming A any more: min A is ${late.minA}`);
  // A frozen field would look static on screen even while the average stays healthy.
  for (const [from, to] of [
    [early, late],
    [middle, late],
  ] as const) {
    let changed = 0;
    let maxDelta = 0;
    for (let index = 0; index < to.b.length; index++) {
      const delta = Math.abs(to.b[index] - from.b[index]);
      if (delta > 1e-9) changed++;
      maxDelta = Math.max(maxDelta, delta);
    }
    assert.ok(changed > 0, 'the state did not change between those two checkpoints');
    assert.ok(maxDelta > 0.01, `only ${maxDelta} changed between those two checkpoints`);
  }
});

test('a step refuses to read the buffer it writes', () => {
  const buffer = empty(16);
  assert.throws(() => stepGrayScott(buffer, buffer, 4, 4), TypeError);
  assert.throws(() => stepGrayScott(empty(16), empty(9), 4, 4), RangeError);
});

test('the simulation alternates buffers and matches a manual double buffering', () => {
  const width = 16;
  const height = 16;
  const seed = createSeededState(width, height);
  const simulation = new GrayScottSimulation(width, height, GRAY_SCOTT_PARAMETERS, seed);
  const manual: [GrayScottState, GrayScottState] = [seed, empty(width * height)];
  let current = 0;
  assert.equal(simulation.front, manual[0]);
  for (let step = 0; step < 5; step++) {
    stepGrayScott(manual[current], manual[1 - current], width, height);
    current = 1 - current;
    simulation.iterate();
    assert.deepEqual(simulation.front.a, manual[current].a);
    assert.deepEqual(simulation.front.b, manual[current].b);
    assert.notEqual(simulation.front, simulation.back);
  }
  assert.equal(simulation.iterations, 5);
  assert.throws(() => simulation.iterate(-1), RangeError);
  assert.throws(() => simulation.iterate(1.5), RangeError);
});

test('seeding is deterministic, keeps A full and puts B only in the blobs', () => {
  const first = createSeededState(64, 64);
  const second = createSeededState(64, 64);
  assert.deepEqual(first.a, second.a);
  assert.deepEqual(first.b, second.b);
  const other = createSeededState(64, 64, 3);
  assert.notDeepEqual(first.b, other.b);
  assert.equal(
    first.a.every((value) => value === 1),
    true,
  );
  assert.equal(
    first.b.every((value) => value === 0 || value === 1),
    true,
  );
  const blobs = first.b.reduce((total, value) => total + value, 0);
  // One blob per cell of a 6×6 lattice, radius 1/64 of the grid: far fewer cells than a full grid.
  assert.ok(blobs > 36, `only ${blobs} seeded cells`);
  assert.ok(blobs < 36 * 4 * 4 * 64, `seeding covered too much of the grid: ${blobs} cells`);
});

test('the seed lattice follows the grid, never dropping below six blobs per axis', () => {
  // One blob per 32 cells: 512² → 16, 256² → 8, and small grids stay at the six-blob floor.
  assert.equal(seedLattice(512, 512), 16);
  assert.equal(seedLattice(256, 256), 8);
  assert.equal(seedLattice(128, 128), 6);
  assert.equal(seedLattice(64, 64), 6);
  assert.equal(seedLattice(32, 32), 6);
  assert.equal(seedLattice(512, 256), 8, 'the shorter edge sets the spacing');
  // An explicit lattice still overrides the default.
  assert.equal(
    createSeededState(128, 128, 3).b.reduce((total, value) => total + value, 0),
    87,
  );

  // The full grid must open with real texture: 512² seeds 42727 cells (16.3%), not 36 lonely dots.
  const seeded = createSeededState(512, 512).b.reduce((total, value) => total + value, 0);
  assert.ok(seeded > 20000, `the 512² first paint would start with only ${seeded} seeded cells`);
  assert.ok(seeded < 512 * 512 * 0.25, `512² seeding covered too much: ${seeded} cells`);
});

test('the two quality tiers keep the designed grid, cadence and warm-up', () => {
  assert.deepEqual(reactionSettings(false), { gridSize: 512, updatesPerFrame: 8, prewarm: 96 });
  assert.deepEqual(reactionSettings(true), { gridSize: 256, updatesPerFrame: 4, prewarm: 48 });
  assert.equal(GRAY_SCOTT_PARAMETERS.feed, 0.03);
  assert.equal(GRAY_SCOTT_PARAMETERS.kill, 0.0601);
  assert.equal(GRAY_SCOTT_PARAMETERS.timeStep, 1);
  assert.equal(GRAY_SCOTT_PARAMETERS.diffuseA, 0.8);
  assert.equal(GRAY_SCOTT_PARAMETERS.diffuseB, 0.4);
  assert.ok(POINTER_RADIUS > 0 && POINTER_RADIUS < 1);
});

/**
 * The display's lens on the CPU: the shader's `uv` line before its clamp, expression for expression.
 * The pointer test below reads every stage point back through this, so the two mappings can only
 * agree by really being the same two steps — the window, then `scale * (1 - exp(-warp * q))`.
 */
function lensOnScreen(
  screenX: number,
  screenY: number,
  region: SamplingRegion,
): { x: number; y: number } {
  const qx = (screenX - 0.5) * region.x;
  const qy = (screenY - 0.5) * region.y;
  const angle = REACTION_VIEW_WARP * qy;
  const magnitude = Math.exp(-REACTION_VIEW_WARP * qx);
  return {
    x: 0.5 + REACTION_VIEW_SCALE * (1 - magnitude * Math.cos(angle)),
    y: 0.5 + REACTION_VIEW_SCALE * magnitude * Math.sin(angle),
  };
}

test('the base window crops the square grid, and the pointer runs the display lens', () => {
  // Cover, not fit: a wide canvas keeps the whole grid width and shows fewer rows, a narrow one
  // keeps the whole grid height and shows fewer columns. The cells stay square either way.
  const wide = sampledRegion(1500, 1000, 512, 512);
  assert.equal(wide.x, 1);
  assert.ok(Math.abs(wide.y - 2 / 3) < 1e-12, `${wide.y}`);
  const tall = sampledRegion(600, 1200, 512, 512);
  assert.ok(Math.abs(tall.x - 0.5) < 1e-12, `${tall.x}`);
  assert.equal(tall.y, 1);
  const square = sampledRegion(800, 800, 512, 512);
  assert.deepEqual(square, { x: 1, y: 1 });
  // A non-square grid takes the same cover window: a 2:1 grid on a square canvas keeps its full
  // height and crops the width.
  const rectangular = sampledRegion(1000, 1000, 512, 256);
  assert.deepEqual(rectangular, { x: 0.5, y: 1 });
  // Unusable sizes fall back to the whole grid instead of producing NaN.
  assert.deepEqual(sampledRegion(0, 0, 512, 512), { x: 1, y: 1 });
  assert.deepEqual(sampledRegion(NaN, NaN, NaN, NaN), { x: 1, y: 1 });

  // The pointer is no longer the linear window position: it runs the display's two steps, the base
  // window and then the conformal lens, so what the cursor touches is what the shader draws there.
  // Stage centre is grid centre for any window, on both axes and on the cropped one.
  for (const region of [wide, tall, square, rectangular]) {
    assert.deepEqual(pointerToGrid(0, 0, region), { x: 0.5, y: 0.5 });
  }
  assert.deepEqual(pointerToGrid(NaN, NaN, wide), { x: 0.5, y: 0.5 });

  // Explicit numbers for the 3:2 wide stage, straight from `0.5 + scale * (1 - exp(-warp*qx)*cos)`.
  // Scale 0.38 and warp 2.2 with region (1, 2/3): the stage right edge lands short of the grid edge,
  // the top lands short of the window top, and the far-left corner is the one that runs off it.
  const right = pointerToGrid(1, 0, wide);
  assert.ok(Math.abs(right.x - 0.7535089881947298) < 1e-12, `${right.x}`);
  assert.ok(Math.abs(right.y - 0.5) < 1e-12, `${right.y}`);
  assert.ok(right.x < 1, 'the stage edge is no longer the grid edge');
  assert.ok(right.x < 0.5 + wide.x / 2, 'the lens pulls the far edge inwards');
  const top = pointerToGrid(0, 1, wide);
  assert.ok(Math.abs(top.x - 0.5976800002268633) < 1e-12, `${top.x}`);
  assert.ok(Math.abs(top.y - 0.7543529392951771) < 1e-12, `${top.y}`);
  assert.ok(top.y < 0.5 + wide.y / 2, 'the lens pulls the top inwards too');
  const bottom = pointerToGrid(0, -1, wide);
  assert.ok(bottom.y < 0.5, 'stage down must map to grid down');
  assert.ok(
    Math.abs(bottom.y - (1 - top.y)) < 1e-12,
    `the lens is odd about the centre: ${bottom.y}`,
  );
  assert.ok(Math.abs(bottom.x - top.x) < 1e-12, `x shares the mirror: ${bottom.x}`);
  const farCorner = pointerToGrid(-1, 1, wide);
  assert.ok(Math.abs(farCorner.x - 0.03186384880097787) < 1e-12, `${farCorner.x}`);
  assert.equal(farCorner.y, 1, 'the far corner is what reaches the grid edge');

  // Every stage point lands where the CPU transcription of the shader's uv line says it does: the
  // window first, the lens second, and the clamp only ever against the grid at the end.
  for (const region of [wide, tall, square]) {
    for (let i = -10; i <= 10; i++) {
      for (let j = -10; j <= 10; j++) {
        const stageX = i / 10;
        const stageY = j / 10;
        const expected = lensOnScreen(0.5 + 0.5 * stageX, 0.5 + 0.5 * stageY, region);
        const actual = pointerToGrid(stageX, stageY, region);
        const where = `stage ${stageX},${stageY} on ${region.x}x${region.y}`;
        if (expected.x > 0 && expected.x < 1 && expected.y > 0 && expected.y < 1) {
          assert.ok(Math.abs(actual.x - expected.x) < 1e-12, `${where}: x ${actual.x}`);
          assert.ok(Math.abs(actual.y - expected.y) < 1e-12, `${where}: y ${actual.y}`);
        } else {
          assert.equal(actual.x, Math.min(1, Math.max(0, expected.x)), `${where}: x clamp`);
          assert.equal(actual.y, Math.min(1, Math.max(0, expected.y)), `${where}: y clamp`);
        }
      }
    }
  }

  // The pointer's own mapping magnifies the far side: further right, the same stage step covers
  // fewer grid cells, so the plate is enlarged exactly where the cursor reaches it with less travel.
  // Read off the real function, so a mirror, a linear window or a flipped exponent changes this and
  // not only a transcription. Stage stops are all inside the unclamped range (grid 0 is first hit at
  // stage -0.7634); the explicit numbers are `0.5 + 0.38 * (1 - exp(-2.2 * stage / 2))` evaluated.
  const stageStep = 0.05;
  const perStage = [-0.7, -0.35, 0, 0.35, 0.7, 0.9].map((stageX) => {
    const before = pointerToGrid(stageX, 0, wide);
    const after = pointerToGrid(stageX + stageStep, 0, wide);
    return Math.hypot(after.x - before.x, after.y - before.y) / stageStep;
  });
  for (let index = 1; index < perStage.length; index++)
    assert.ok(
      perStage[index] < perStage[index - 1],
      `the pointer lens stopped growing: ${perStage}`,
    );
  // Measured 0.878 / 0.598 / 0.407 / 0.277 / 0.188 / 0.151 grid units per stage unit: the right end
  // covers 5.8× fewer cells than the left, so the magnified side and the cursor agree.
  assert.ok(Math.abs(perStage[0] - 0.878405) < 1e-5, `${perStage}`);
  assert.ok(Math.abs(perStage[2] - 0.406713) < 1e-5, `${perStage}`);
  assert.ok(Math.abs(perStage[5] - 0.151125) < 1e-5, `${perStage}`);
  assert.ok(perStage[0] > 5 * perStage[5], `the pointer side of the lens is too flat: ${perStage}`);
  // A stage step right of the grid edge is where the clamp ends the ramp, not the lens.
  assert.equal(
    perStage[perStage.length - 1] > 0,
    true,
    'the far edge must still be inside the grid',
  );

  // Out-of-stage coordinates clamp to the stage edge before the lens instead of wrapping around it.
  assert.deepEqual(pointerToGrid(-4, 9, wide), pointerToGrid(-1, 1, wide));
  assert.deepEqual(pointerToGrid(4, -9, wide), pointerToGrid(1, -1, wide));
  // A non-finite pointer reads as the stage centre instead of poisoning the brush position.
  for (const [x, y] of [
    [NaN, 0],
    [0, NaN],
    [NaN, NaN],
    [Infinity, -Infinity],
  ] as const)
    assert.deepEqual(pointerToGrid(x, y, wide), { x: 0.5, y: 0.5 }, `pointer ${x},${y}`);
  // The clamp into the grid is real, and it is the lens that needs it: the stage corners on the far
  // side of the window run past both edges of the grid.
  assert.equal(pointerToGrid(-1, -1, wide).y, 0);
  assert.equal(pointerToGrid(-1, 1, wide).y, 1);
  for (let i = -10; i <= 10; i++) {
    const point = pointerToGrid(i / 10, -1, wide);
    assert.ok(
      point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1,
      `grid escape ${point.x},${point.y}`,
    );
  }
});

test('one grid cell covers the same distance on both screen axes at any canvas size', () => {
  const cases = [
    [1500, 1000, 512, 512],
    [600, 1200, 512, 512],
    [800, 800, 512, 512],
    [2560, 1080, 512, 512],
    [375, 812, 256, 256],
    [1024, 768, 512, 256],
    [1920, 1080, 256, 256],
  ] as const;
  for (const [width, height, gridWidth, gridHeight] of cases) {
    const region = sampledRegion(width, height, gridWidth, gridHeight);
    const label = `${width}x${height} on ${gridWidth}x${gridHeight}`;
    // A cell is `region.x` of the grid width wide and `region.y` of the grid height tall; an
    // anamorphic window would show different pixel sizes per cell on the two axes, i.e. a stretch.
    const cellsPerPixelX = (region.x * gridWidth) / width;
    const cellsPerPixelY = (region.y * gridHeight) / height;
    assert.ok(
      Math.abs(cellsPerPixelX - cellsPerPixelY) < 1e-12,
      `${label}: ${cellsPerPixelX} vs ${cellsPerPixelY} cells per pixel`,
    );
    // Cover: the window fills at least the canvas on both axes (it never shrinks below the grid
    // into a stretched fit), spans the whole grid on one axis, and crops only the other.
    assert.ok(region.x > 0 && region.x <= 1, `${label}: x ${region.x}`);
    assert.ok(region.y > 0 && region.y <= 1, `${label}: y ${region.y}`);
    assert.ok(
      region.x === 1 || region.y === 1,
      `${label}: ${region.x}x${region.y} crops both ways`,
    );
    // The window therefore has the canvas aspect, and the mapping stays isotropic: stage x and
    // stage y advance the grid coordinate by the same number of cells per screen pixel.
    const windowAspect = (region.x * gridWidth) / (region.y * gridHeight);
    assert.ok(
      Math.abs(windowAspect - width / height) < 1e-12,
      `${label}: window aspect ${windowAspect}`,
    );
  }
});

test('the conformal lens keeps one scale and one right angle per pixel on the square grid', () => {
  // The lens is the exponential map `scale * (1 - exp(-warp * q))`: holomorphic, so on the square
  // simulation domain one step across the screen keeps its length and its right angle on the two
  // axes, whatever the canvas aspect. That is the property the linear window did not have once the
  // window and the canvas disagreed, and it is why the plate reads magnified instead of stretched.
  // The numbers come from the production mapping — the same two steps the display shader runs, as
  // the source contract above pins them — so a drift there fails here and not only as text. The
  // scene always builds a square grid (`sampledRegion(w, h, size, size)`); the base window's own
  // squareness on any grid aspect is checked separately.
  const screenToGrid = (screenX: number, screenY: number, region: SamplingRegion) =>
    pointerToGrid(2 * screenX - 1, 2 * screenY - 1, region);
  const cases = [
    [1500, 1000, 512],
    [600, 1200, 512],
    [800, 800, 512],
    [2560, 1080, 512],
    [375, 812, 256],
    [1920, 1080, 256],
  ] as const;
  // Half a pixel each side of the sample: a one-pixel span, small enough that the second derivative
  // is invisible and large enough to stay clear of the double-precision noise of nearby cosines.
  const HALF_PIXEL = 0.5;
  const measured: Record<string, number> = {};
  for (const [width, height, grid] of cases) {
    const region = sampledRegion(width, height, grid, grid);
    const label = `${width}x${height} on ${grid}²`;
    let checked = 0;
    for (let row = 0; row <= 80; row++) {
      for (let column = 0; column <= 80; column++) {
        const screenX = column / 80;
        const screenY = row / 80;
        const stepX = HALF_PIXEL / width;
        const stepY = HALF_PIXEL / height;
        // Three filters, all of them about the edges rather than the lens: stage input outside
        // [-1, 1] is clamped before the map, grid output near an edge is clamped after it, and a
        // difference across either fold measures the clamp. Everything else is the real lens.
        const insideStage = (value: number) => Math.abs(2 * value - 1) < 1;
        const interior = (point: { x: number; y: number }) =>
          point.x > 0.005 && point.x < 0.995 && point.y > 0.005 && point.y < 0.995;
        if (
          !insideStage(screenX + stepX) ||
          !insideStage(screenX - stepX) ||
          !insideStage(screenY + stepY) ||
          !insideStage(screenY - stepY)
        )
          continue;
        const probes = [
          screenToGrid(screenX + stepX, screenY, region),
          screenToGrid(screenX - stepX, screenY, region),
          screenToGrid(screenX, screenY + stepY, region),
          screenToGrid(screenX, screenY - stepY, region),
        ];
        if (!interior(screenToGrid(screenX, screenY, region)) || !probes.every(interior)) continue;
        checked++;
        // One pixel right and one pixel up, in grid cells per pixel.
        const acrossX = [(probes[0].x - probes[1].x) * grid, (probes[0].y - probes[1].y) * grid];
        const acrossY = [(probes[2].x - probes[3].x) * grid, (probes[2].y - probes[3].y) * grid];
        const lengthX = Math.hypot(acrossX[0], acrossX[1]);
        const lengthY = Math.hypot(acrossY[0], acrossY[1]);
        assert.ok(
          lengthX > 0 && lengthY > 0,
          `${label}: a collapsed axis at ${screenX},${screenY}`,
        );
        // Equal lengths: a square of the grid stays a square on screen — no stretch on either axis.
        assert.ok(
          Math.abs(lengthX - lengthY) < 1e-5 * lengthX,
          `${label}: ${lengthX} vs ${lengthY} grid cells per pixel at ${screenX},${screenY}`,
        );
        // Orthogonal: the two axes stay at a right angle — no shear between them.
        const dot = acrossX[0] * acrossY[0] + acrossX[1] * acrossY[1];
        assert.ok(
          Math.abs(dot) < 1e-5 * lengthX * lengthY,
          `${label}: the axes left their right angle at ${screenX},${screenY}: ${dot}`,
        );
        if (row === 40 && column === 40) measured[label] = lengthX;
      }
    }
    // A vacuous pass would mean every sample was filtered out, i.e. the lens was never measured.
    assert.ok(checked > 500, `${label}: only ${checked} measurable sample points`);
  }
  // Measured at the centre of each canvas: 0.2854 / 0.3567 / 0.5350 / 0.1712 / 0.2386 / 0.1114
  // cells per pixel. A linear window would print one constant per canvas instead (0.3413 on the
  // first), which is the stretch this replaced.
  assert.ok(Math.abs(measured['1500x1000 on 512²'] - 0.2854) < 5e-4, `${measured}`);
  assert.ok(Math.abs(measured['600x1200 on 512²'] - 0.3567) < 5e-4, `${measured}`);

  // The lens magnifies the far side of the plate instead of printing the window linearly: on a wide
  // stage the grid cells per pixel fall towards the right, where the relief lives, while the linear
  // window holds that number at 0.3413 everywhere.
  const wide = sampledRegion(1500, 1000, 512, 512);
  const cellsPerPixel = (screenX: number) => {
    const before = screenToGrid(screenX - HALF_PIXEL / 1500, 0.5, wide);
    const after = screenToGrid(screenX + HALF_PIXEL / 1500, 0.5, wide);
    assert.ok(
      screenX + HALF_PIXEL / 1500 < 1 && before.x > 0.005 && after.x < 0.995,
      `the magnification probe at ${screenX} hits a clamp, not the lens`,
    );
    return 512 * Math.hypot(after.x - before.x, after.y - before.y);
  };
  const scales = [0.4, 0.6, 0.8, 0.95].map(cellsPerPixel);
  for (let index = 1; index < scales.length; index++)
    assert.ok(scales[index] < scales[index - 1], `the lens stopped magnifying: ${scales}`);
  assert.ok(
    scales[0] > 2 * scales[scales.length - 1],
    `the far side is not magnified enough to read: ${scales}`,
  );
  // Measured 0.3556 / 0.2290 / 0.1475 / 0.1061 cells per pixel: a ratio of 3.35 across the stage,
  // against the constant 0.3413 a linear window would print — and the centre of the stage is below
  // that constant while the left is above it, so the plate is genuinely re-scaled, not just cropped.
  assert.ok(Math.abs(scales[0] / scales[scales.length - 1] - 3.35) < 0.05, `${scales}`);
  assert.ok(
    scales[3] < 0.3413 && scales[0] > 0.3413,
    `the lens is not re-scaling the plate: ${scales}`,
  );
});

test('the scene factory is exported and rejects what it cannot draw', () => {
  assert.equal(typeof createScene, 'function');
  assert.equal(createScene.length, 3);
  const budget = { light: false, fps: 30, maxPixels: 1_200_000, maxDpr: 1.5 };
  const aborted = new AbortController();
  aborted.abort();
  const container = { append: () => {} } as unknown as HTMLElement;
  assert.throws(
    () => createScene(container, budget, aborted.signal),
    (error: unknown) => error instanceof Error && error.name === 'AbortError',
  );
});

test('a container without WebGL2 fails loudly and leaves no canvas behind', () => {
  const canvas = {
    remove() {
      removed++;
    },
    getContext: () => null,
  };
  let removed = 0;
  const appended: unknown[] = [];
  const container = { append: (node: unknown) => appended.push(node) } as unknown as HTMLElement;
  const globals = globalThis as { document?: unknown };
  const previous = globals.document;
  globals.document = { createElement: () => canvas };
  try {
    assert.throws(
      () =>
        createScene(
          container,
          { light: true, fps: 20, maxPixels: 450_000, maxDpr: 1 },
          new AbortController().signal,
        ),
      /WebGL2/,
    );
  } finally {
    globals.document = previous;
  }
  assert.equal(appended.length, 1);
  assert.equal(removed, 1, 'the orphaned canvas must not stay in the container');
});

test('the packed shaders keep the upstream weights, packing and equations', () => {
  for (const [name, source] of [
    ['update', REACTION_UPDATE_FRAGMENT],
    ['brush', REACTION_BRUSH_FRAGMENT],
    ['display', REACTION_DISPLAY_FRAGMENT],
  ] as const) {
    assert.match(source, /^#version 300 es/, `${name} shader version`);
    assert.match(source, /precision highp float/, `${name} float precision`);
    assert.doesNotMatch(source, /gl_FragColor|texture2D\(|varying |attribute /, name);
    assert.doesNotMatch(source, /Page\.|XMLHttpRequest|fetch\(|requestAnimationFrame/, name);
    assert.doesNotMatch(source, /RGBA32F|EXT_color_buffer_float|OES_texture_float/, name);
  }
  assert.match(REACTION_UPDATE_FRAGMENT, /precision highp sampler2D/);
  assert.match(REACTION_UPDATE_FRAGMENT, /255\.99 \* clamp\(f, 0\.0, 1\.0\)/);
  assert.match(REACTION_UPDATE_FRAGMENT, /255\.0 \/ 256\.0, 1\.0 \/ 256\.0/);
  for (const weight of ['0.05', '0.20']) {
    assert.equal(
      REACTION_UPDATE_FRAGMENT.split(`* ${weight}`).length - 1,
      4,
      `${weight} must appear on all four matching neighbours`,
    );
  }
  assert.match(REACTION_UPDATE_FRAGMENT, /float reaction = A \* B \* B;/);
  assert.match(REACTION_UPDATE_FRAGMENT, /const float dt = 1\.0;/);
  assert.match(REACTION_UPDATE_FRAGMENT, /\(killB \+ feedA\) \* B/);
  assert.match(REACTION_BRUSH_FRAGMENT, /discard/);
  assert.match(REACTION_BRUSH_FRAGMENT, /encode\(vec2\(1\.0\)\)/);

  // The display carves a relief instead of drawing a coloured field: warm-white paper, a grey-green
  // groove, the limestone plate and a pale warm lip, all four read straight off the decoded corners.
  const display = REACTION_DISPLAY_FRAGMENT;
  assert.match(display, /vec3\(0\.94, 0\.925, 0\.89\)/, 'substrate');
  assert.match(display, /vec3\(0\.72, 0\.75, 0\.69\)/, 'groove');
  assert.match(display, /vec3\(0\.92, 0\.90, 0\.84\)/, 'limestone plate');
  assert.match(display, /vec3\(0\.99, 0\.97, 0\.90\)/, 'pale lip');
  // No cyan-green body and no gold crest survive from the previous palette, and the dark plate the
  // hero copy had to fight is gone with them.
  assert.doesNotMatch(display, /0\.914|0\.722|0\.310|0\.478|0\.412|GRAPHITE/);
  // The conformal view reaches the shader as constants injected from view.ts, not as uniforms, so
  // the display and the pointer cannot drift apart and the scene needs no extra state. The literals
  // are read back off the exports here: change one and this test names the other.
  const glslFloat = (value: number) => {
    const text = String(value);
    return /[.eE]/.test(text) ? text : `${text}.0`;
  };
  assert.ok(
    display.includes(`const float VIEW_WARP = ${glslFloat(REACTION_VIEW_WARP)};`),
    `the shader must carry warp ${REACTION_VIEW_WARP}`,
  );
  assert.ok(
    display.includes(`const float VIEW_SCALE = ${glslFloat(REACTION_VIEW_SCALE)};`),
    `the shader must carry scale ${REACTION_VIEW_SCALE}`,
  );
  // The lens, step for step the same as pointerToGrid: the window, the angle, the magnitude, and
  // the map itself, with the clamp only at the end.
  assert.match(display, /vec2 q = \(vUv - 0\.5\) \* uRegion;/);
  assert.match(display, /float angle = VIEW_WARP \* q\.y;/);
  assert.match(display, /float magnitude = exp\(-VIEW_WARP \* q\.x\);/);
  assert.match(display, /0\.5 \+ VIEW_SCALE \* \(1\.0 - magnitude \* cos\(angle\)\)/);
  assert.match(display, /0\.5 \+ VIEW_SCALE \* magnitude \* sin\(angle\)/);
  // The lens turns the field as well as scaling it, and it reads both old components at once: a
  // sequential overwrite would rotate the second component against the first.
  assert.match(
    display,
    /cos\(angle\) \* gradient\.x - sin\(angle\) \* gradient\.y,\n\s+sin\(angle\) \* gradient\.x \+ cos\(angle\) \* gradient\.y/,
  );
  // The material is how deep the pattern has been let into the plate, and the height is
  // 1 - material, so its slope is the colony's slope through the ramp's chain rule: 6t(1-t)/0.16
  // over [0.09, 0.25].
  assert.match(display, /float material = smoothstep\(0\.09, 0\.25, colony\);/);
  assert.match(display, /clamp\(\(colony - 0\.09\) \/ 0\.16, 0\.0, 1\.0\)/);
  assert.match(display, /-gradient \* \(6\.0 \* t \* \(1\.0 - t\) \/ 0\.16\)/);
  assert.match(display, /length\(heightGradient\) \* uCrest/);
  // Analytic slope only: no screen derivative, and therefore no second raster for the relief.
  assert.doesNotMatch(display, /dFdx|dFdy|fwidth/);
  for (const corner of [
    'base',
    'base + vec2(1.0, 0.0)',
    'base + vec2(0.0, 1.0)',
    'base + vec2(1.0, 1.0)',
  ])
    assert.ok(display.includes(`sampleState(${corner})`), `display must read ${corner}`);
  // Nearest sampling at the texel centre is what makes the packed pair decode to a concentration.
  assert.match(display, /\(texel \+ 0\.5\) \* uTexelSize/);
  // Bounded raster: one sampler, no loop, no second pass, four fixed coarse occlusion taps.
  assert.equal((display.match(/uniform sampler2D/g) ?? []).length, 1);
  assert.doesNotMatch(display, /for \(|while \(/);
  for (const tap of [
    '+ vec2(COARSE_STRIDE, 0.0)',
    '- vec2(COARSE_STRIDE, 0.0)',
    '+ vec2(0.0, COARSE_STRIDE)',
    '- vec2(0.0, COARSE_STRIDE)',
  ])
    assert.ok(display.includes(`sampleState(base ${tap})`), `missing occlusion tap ${tap}`);
  assert.match(display, /const float COARSE_STRIDE = 6\.0;/);
  // Lighting: one fixed soft key light, a high-key lambert that never reaches black, a broad rough
  // specular, and the slope of the carved height as the normal.
  assert.match(display, /normalize\(vec3\(-0\.5, 0\.7, 0\.8\)\)/);
  assert.match(
    display,
    /normalize\(vec3\(-heightGradient\.x \* uRelief, -heightGradient\.y \* uRelief, 1\.0\)\)/,
  );
  assert.match(display, /0\.70 \+ 0\.30 \* max\(dot\(normal, lightDirection\), 0\.0\)/);
  assert.match(display, /pow\(max\(dot\(normal, halfVector\), 0\.0\), 12\.0\) \* 0\.012/);
  assert.match(
    display,
    /1\.0 - 0\.12 \* material \* \(1\.0 - smoothstep\(0\.09, 0\.25, coarse\)\)/,
  );
  // The plate is the body colour and the groove cuts into it; the lip is a highlight on the cut
  // edge rather than a second body colour, so it is weighted on its own.
  assert.match(display, /mix\(COLONY, GROOVE, material\)/);
  assert.match(display, /mix\(color, CREST, crest \* 0\.10\)/);
  // Screen framing: the relief keeps the right half on a wide canvas and the lower part on a narrow
  // one, mixed over the plate so the hero copy is never painted onto a dark surface — and the top 9%
  // and the bottom 12% are masked out at either framing for the site navigation.
  assert.match(display, /uniform float uAspect/);
  assert.match(display, /uAspect >= 1\.15/);
  assert.match(display, /smoothstep\(0\.34, 0\.56, vUv\.x \+ 0\.055 \* sin\(vUv\.y \* 5\.3\)\)/);
  assert.match(display, /1\.0 - smoothstep\(0\.46, 0\.67, vUv\.y\)/);
  assert.match(
    display,
    /mask \*= smoothstep\(0\.12, 0\.23, vUv\.y\) \* \(1\.0 - smoothstep\(0\.82, 0\.91, vUv\.y\)\)/,
  );
  assert.match(display, /mix\(SUBSTRATE, color, mask\)/);
  // Grain is pinned to the screen pixel and independent of time: two 8-bit steps peak to peak, and
  // never a dither that flashes between frames.
  assert.match(display, /const float GRAIN = 2\.0 \/ 255\.0;/);
  assert.match(display, /grain\(gl_FragCoord\.xy\)/);
  assert.doesNotMatch(display, /uTime|uClock|uDelta|uSeconds|uSeed/);
  assert.equal(DISPLAY_RELIEF, 6);
  assert.equal(DISPLAY_CREST, 2);
});

/**
 * CPU reference for the display pass. The expressions below are transcribed from
 * `REACTION_DISPLAY_FRAGMENT`, and each test re-reads the source line it mirrors, so a shader change
 * that drifts from the transcription fails here instead of only on the GPU.
 */
const MATERIAL_LOW = 0.09;
const MATERIAL_HIGH = 0.25;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** `material = smoothstep(0.09, 0.25, colony)`: how deep the colony has been let into the plate. */
function grooveMaterial(colony: number): number {
  return smoothstep(MATERIAL_LOW, MATERIAL_HIGH, colony);
}

/** `height = 1 - material`: the surface falls exactly where the colony hollows it out. */
function reliefHeight(colony: number): number {
  return 1 - grooveMaterial(colony);
}

/** The shader's analytic `heightGradient = -gradient * (6t(1-t)/0.16)`. */
function reliefHeightGradient(
  gradientX: number,
  gradientY: number,
  colony: number,
): [number, number] {
  const span = MATERIAL_HIGH - MATERIAL_LOW;
  const t = Math.min(1, Math.max(0, (colony - MATERIAL_LOW) / span));
  const slope = (6 * t * (1 - t)) / span;
  return [-gradientX * slope, -gradientY * slope];
}

/** The screen mask: framing branch first, then the safe navigation band. vUv.y is 0 bottom, 1 top. */
function displayMask(x: number, y: number, aspect: number): number {
  const framing =
    aspect >= 1.15
      ? smoothstep(0.34, 0.56, x + 0.055 * Math.sin(y * 5.3))
      : 1 - smoothstep(0.46, 0.67, y);
  return framing * smoothstep(0.12, 0.23, y) * (1 - smoothstep(0.82, 0.91, y));
}

/** Reads `const vec3 NAME = vec3(...)` out of the display source, so the checks below read the
 *  numbers the GPU gets rather than a second copy of them. */
function displayPalette(name: string): [number, number, number] {
  const match = REACTION_DISPLAY_FRAGMENT.match(
    new RegExp(`const vec3 ${name} = vec3\\(([^)]+)\\);`),
  );
  assert.ok(match, `the display must define ${name}`);
  const channels = match[1].split(',').map(Number);
  assert.equal(channels.length, 3, `${name} must be a vec3`);
  return channels as [number, number, number];
}

test('the hollow material stays a bounded ramp of the colony', () => {
  assert.match(REACTION_DISPLAY_FRAGMENT, /float material = smoothstep\(0\.09, 0\.25, colony\);/);
  // The material is a hollow depth, not a body: it stays finite and inside [0, 1], and it is flat at
  // both ends so bare plate and a saturated hollow cannot invent a shape of their own. The decoded
  // field is already clamped into [0, 1] by the packing — the loop runs past both ends so a future
  // threshold change cannot silently push the material (and the shading built on it) out of range.
  let previous = -Infinity;
  for (let step = 0; step <= 1024; step++) {
    const colony = -0.5 + (step * 2) / 1024;
    const material = grooveMaterial(colony);
    assert.ok(Number.isFinite(material), `material at ${colony} is not finite`);
    assert.ok(material >= 0 && material <= 1, `material at ${colony} is ${material}`);
    assert.ok(material >= previous - 1e-12, `material fell at ${colony}`);
    previous = material;
  }
  assert.equal(grooveMaterial(-0.5), 0);
  assert.equal(grooveMaterial(MATERIAL_LOW), 0);
  assert.equal(grooveMaterial(MATERIAL_HIGH), 1);
  assert.equal(grooveMaterial(1.5), 1);
  assert.ok(grooveMaterial(0.14) > grooveMaterial(0.1), 'the hollow must deepen with the colony');
  assert.ok(grooveMaterial(0.2) > grooveMaterial(0.14), 'the hollow must keep deepening');
  assert.equal(reliefHeight(MATERIAL_HIGH), 0, 'a full hollow is the bottom of the relief');
  assert.equal(reliefHeight(-1), 1, 'bare plate is the top of the relief');

  // Palette direction: dense colony is the darker value, so the pattern reads as hollows in pale
  // stone instead of the bright tubes on a dark ground this relief started as, and the deepest
  // hollow stays a mid tone so the stone never becomes a dark plate the copy has to fight.
  const luma = ([red, green, blue]: [number, number, number]) =>
    red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const groove = luma(displayPalette('GROOVE'));
  const plate = luma(displayPalette('COLONY'));
  assert.ok(groove < plate, `the groove (${groove}) must be darker than the plate (${plate})`);
  assert.ok(
    plate - groove > 0.15,
    `the relief would be invisible at a contrast of ${plate - groove}`,
  );
  assert.ok(groove > 0.5, `the deepest groove is ${groove}: this is not a high-key stone`);
});

test('the analytic height gradient matches the hollowed height and points into the hollow', () => {
  // The shader reads the slope off the ramp rather than from a second raster or a screen derivative,
  // so the chain rule has to be the derivative of the height it comes from.
  assert.match(REACTION_DISPLAY_FRAGMENT, /-gradient \* \(6\.0 \* t \* \(1\.0 - t\) \/ 0\.16\)/);
  const h = 1e-5;
  for (const colony of [0.11, 0.14, 0.17, 0.21, 0.24]) {
    const numeric = (reliefHeight(colony + h) - reliefHeight(colony - h)) / (2 * h);
    // A colony that rises towards +x means gradient = (1, 0), and the height falls at this rate.
    const [x, y] = reliefHeightGradient(1, 0, colony);
    assert.ok(Math.abs(x - numeric) < 1e-6, `slope at ${colony}: ${x} vs ${numeric}`);
    assert.equal(Math.abs(y), 0, `a slope along one axis must not tilt the other at ${colony}`);
    assert.ok(x < 0, `the colony at ${colony} lifts the stone instead of hollowing it: ${x}`);
  }
  // Both axes share one slope factor, so only the direction of the field decides how the relief is
  // tilted — a plus sign here would turn every hollow into a raised tube.
  for (const colony of [0.11, 0.15, 0.19, 0.23]) {
    const [x, y] = reliefHeightGradient(2, -3, colony);
    assert.ok(x < 0 && y > 0, `height gradient ${x},${y} does not oppose the colony gradient`);
    assert.ok(Math.abs(y / x + 1.5) < 1e-12, `the axes disagree: ${x}, ${y}`);
  }
  // Flat at both ends of the ramp: plate and a saturated hollow invent no relief of their own.
  for (const colony of [-0.2, 0, 0.08, 0.26, 0.5, 1]) {
    const [x, y] = reliefHeightGradient(1, 1, colony);
    assert.equal(Math.abs(x), 0, `invented relief at colony ${colony}`);
    assert.equal(Math.abs(y), 0, `invented relief at colony ${colony}`);
  }
});

test('the top and bottom bands of any screen stay bare plate', () => {
  // vUv.y is 0 at the bottom of the canvas and 1 at the top. The site navigation sits in the top 9%
  // and the effect switcher and the entry link in the bottom 12%, so the relief is masked out there
  // at either framing: the copy never lands on carved stone.
  assert.match(
    REACTION_DISPLAY_FRAGMENT,
    /mask \*= smoothstep\(0\.12, 0\.23, vUv\.y\) \* \(1\.0 - smoothstep\(0\.82, 0\.91, vUv\.y\)\)/,
  );
  for (const aspect of [1.6, 1.15, 1.0, 0.62]) {
    for (let column = 0; column <= 32; column++) {
      const x = column / 32;
      for (const y of [0, 0.04, 0.08, 0.12, 0.91, 0.93, 0.96, 1]) {
        assert.equal(displayMask(x, y, aspect), 0, `mask at ${x},${y} (aspect ${aspect})`);
      }
    }
  }
  // Between the bands the mask is a real fraction, never NaN and never outside [0, 1].
  for (const aspect of [1.6, 0.62]) {
    for (let step = 0; step <= 40; step++) {
      const y = 0.12 + (step * (0.91 - 0.12)) / 40;
      for (const x of [0, 0.25, 0.5, 0.75, 1]) {
        const value = displayMask(x, y, aspect);
        assert.ok(
          Number.isFinite(value) && value >= 0 && value <= 1,
          `mask ${value} at ${x},${y} (aspect ${aspect})`,
        );
      }
    }
  }
});

test('the two framings ramp the relief where the design puts it', () => {
  // Wide stage: the relief keeps the right half of the canvas behind a slow sine, so the left half
  // stays clear for the copy whatever the sine does on that row. Rows are taken inside the safe
  // band, where the navigation mask is exactly 1 and only the framing decides.
  for (let row = 0; row <= 20; row++) {
    const y = 0.25 + (row * 0.5) / 20;
    assert.equal(displayMask(0, y, 1.6), 0, `left edge at y=${y}`);
    assert.equal(displayMask(0.28, y, 1.6), 0, `left of the ramp at y=${y}`);
    assert.equal(displayMask(0.62, y, 1.6), 1, `right of the ramp at y=${y}`);
    assert.equal(displayMask(1, y, 1.6), 1, `right edge at y=${y}`);
    // Monotone across the ramp: the sine shifts the boundary, it never folds it back.
    let previous = 0;
    for (let step = 0; step <= 200; step++) {
      const value = displayMask(step / 200, y, 1.6);
      assert.ok(value >= previous - 1e-12, `the mask fell along x at y=${y}`);
      previous = value;
    }
    assert.equal(previous, 1, `the ramp must reach the right edge at y=${y}`);
  }

  // Narrow stage: the relief takes the lower part of the canvas below a straight soft step, so the
  // upper part stays clear for the copy. The plate holds between the bottom band and the step, and
  // the relief closes before the top band as well.
  for (const x of [0, 0.5, 1]) {
    assert.equal(displayMask(x, 0.12, 0.62), 0, `bottom band at x=${x}`);
    assert.equal(displayMask(x, 0.23, 0.62), 1, `top of the bottom band at x=${x}`);
    assert.equal(displayMask(x, 0.45, 0.62), 1, `above the step at x=${x}`);
    assert.equal(displayMask(x, 0.68, 0.62), 0, `below the top band at x=${x}`);
    assert.equal(displayMask(x, 0.91, 0.62), 0, `top band at x=${x}`);
    // From the bottom band up to the top band the narrow mask only ever closes.
    let previous = 1;
    for (let step = 0; step <= 200; step++) {
      const value = displayMask(x, 0.23 + (step * (0.91 - 0.23)) / 200, 0.62);
      assert.ok(value <= previous + 1e-12, `the mask rose along y at x=${x}`);
      previous = value;
    }
    assert.equal(previous, 0, `the ramp must close at the top at x=${x}`);
  }

  // The two framings are not the same mask: at a column and row where the wide one is still bare
  // stone the narrow one is already fully carved, which is what keeps the branch worth having. The
  // column is left of the sine's whole reach (0.25 + 0.055 < 0.34) and the row is below both the
  // narrow step (0.46) and inside the safe band, so neither probe depends on the sine's value.
  assert.equal(displayMask(0.25, 0.4, 1.6), 0);
  assert.equal(displayMask(0.25, 0.4, 0.62), 1);
});

test('the scene source owns its clock, its events and its resolution budget', () => {
  const source = readFileSync(
    new URL('../src/client/algorithms/reaction/scene.ts', import.meta.url),
    'utf8',
  );
  // The runtime drives frames and events; the renderer must not open its own loop or listeners.
  assert.doesNotMatch(source, /requestAnimationFrame|cancelAnimationFrame/);
  assert.doesNotMatch(source, /addEventListener|new ResizeObserver|new IntersectionObserver/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|createImageBitmap|new Image\(/);
  assert.doesNotMatch(source, /Page\./);
  // One shared helper opens the context, and the display size goes through the shared budget.
  assert.match(source, /createSurface\(container\)/);
  assert.match(source, /algorithmResolution\(/);
  assert.match(source, /sampledRegion\(/);
  assert.match(source, /pointerToGrid\(/);
  // The display frames itself per screen, so the scene hands it the drawn canvas aspect.
  assert.match(source, /uniform1f\(aspectLocation, canvas\.width \/ canvas\.height\)/);
  // Two packed ping-pong targets and nothing else: the relief pass adds no render target.
  assert.equal(source.split('createTarget(').length - 1, 3, 'definition plus two buffers');
  // Data textures must not be dithered position-dependently, and this must happen once per context.
  assert.equal(source.split('gl.disable(gl.DITHER)').length - 1, 1);
});
