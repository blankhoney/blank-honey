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
import { sampledRegion, pointerToGrid } from '../src/client/algorithms/reaction/view';
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
  // Measured at 48 steps on 256²: 2649 seeded cells → about 24470 in colonies, peak B ≈ 0.455.
  assert.ok(
    colony > seededArea * 1.5,
    `warm-up only reached ${colony} of ${seededArea} seeded cells`,
  );
  assert.ok(maxB > 0.2, `warm-up peak B is only ${maxB}`);
});

test('the colony still grows between 500 and 2000 steps at 128² without collapsing', () => {
  const size = 128;
  const seed = createSeededState(size, size);
  const simulation = new GrayScottSimulation(size, size, undefined, seed);
  const sample = () => {
    const { a, b } = simulation.front;
    let maxB = 0;
    let active = 0;
    for (let index = 0; index < a.length; index++) {
      assert.ok(
        Number.isFinite(a[index]) && Number.isFinite(b[index]),
        `cell ${index} is not finite`,
      );
      assert.ok(a[index] > -0.1 && a[index] < 1.2, `A at ${index} left its range: ${a[index]}`);
      assert.ok(b[index] > -0.1 && b[index] < 1.2, `B at ${index} left its range: ${b[index]}`);
      maxB = Math.max(maxB, b[index]);
      if (b[index] > 0.02) active++;
    }
    return { maxB, fraction: active / a.length, b: Float64Array.from(b) };
  };

  simulation.iterate(500);
  const early = sample();
  simulation.iterate(1500);
  const late = sample();
  assert.equal(simulation.iterations, 2000);
  // Measured: 500 steps → 77.6% active, 2000 steps → 98.4% active, peak B ≈ 0.35-0.40.
  assert.ok(early.fraction > 0.5, `active fraction collapsed to ${early.fraction} by 500 steps`);
  assert.ok(late.fraction > 0.5, `active fraction collapsed to ${late.fraction} by 2000 steps`);
  assert.ok(late.maxB > 0.2, `peak B fell to ${late.maxB}`);
  // A frozen field would look static on screen even while the average stays healthy.
  let changed = 0;
  let maxDelta = 0;
  for (let index = 0; index < late.b.length; index++) {
    const delta = Math.abs(late.b[index] - early.b[index]);
    if (delta > 1e-9) changed++;
    maxDelta = Math.max(maxDelta, delta);
  }
  assert.ok(changed > 0, 'the state did not change between 500 and 2000 steps');
  assert.ok(maxDelta > 0.01, `only ${maxDelta} changed between 500 and 2000 steps`);
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
  assert.equal(GRAY_SCOTT_PARAMETERS.feed, 0.029);
  assert.equal(GRAY_SCOTT_PARAMETERS.kill, 0.057);
  assert.equal(GRAY_SCOTT_PARAMETERS.timeStep, 1);
  assert.equal(GRAY_SCOTT_PARAMETERS.diffuseA, 0.8);
  assert.equal(GRAY_SCOTT_PARAMETERS.diffuseB, 0.4);
  assert.ok(POINTER_RADIUS > 0 && POINTER_RADIUS < 1);
});

test('the display keeps cells square by cropping, and the pointer follows the same crop', () => {
  const wide = sampledRegion(1500, 1000, 512, 512);
  assert.ok(Math.abs(wide.x - 2 / 3) < 1e-12);
  assert.equal(wide.y, 1);
  const tall = sampledRegion(600, 1200, 512, 512);
  assert.equal(tall.x, 1);
  assert.ok(Math.abs(tall.y - 0.5) < 1e-12);
  const square = sampledRegion(800, 800, 512, 512);
  assert.deepEqual(square, { x: 1, y: 1 });

  // Centre stays centre, and stage +y stays grid +y (the stage is y-up like the texture).
  assert.deepEqual(pointerToGrid(0, 0, wide), { x: 0.5, y: 0.5 });
  const top = pointerToGrid(0, 1, wide);
  assert.equal(top.x, 0.5);
  assert.ok(Math.abs(top.y - 1) < 1e-12);
  const bottom = pointerToGrid(0, -1, wide);
  assert.ok(bottom.y < 0.5, 'stage down must map to grid down');
  // The stage edge lands on the edge of the visible region, and a cropped axis reaches the grid edge.
  const right = pointerToGrid(1, 0, wide);
  assert.ok(Math.abs(right.x - (0.5 + wide.x / 2)) < 1e-12, `${right.x}`);
  const croppedAxis = pointerToGrid(1, 0, tall);
  assert.ok(Math.abs(croppedAxis.x - 1) < 1e-12);
  // Out-of-stage coordinates clamp into the grid instead of wrapping: stage left is grid left.
  assert.deepEqual(pointerToGrid(-4, 9, wide), { x: (1 - wide.x) / 2, y: 1 });
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
  assert.match(REACTION_DISPLAY_FRAGMENT, /smoothstep\(0\.02, 0\.30, colony\)/);
  assert.ok(DISPLAY_RELIEF > 0 && DISPLAY_CREST > 0);
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
  // Data textures must not be dithered position-dependently, and this must happen once per context.
  assert.equal(source.split('gl.disable(gl.DITHER)').length - 1, 1);
});
