import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFrameBudget,
  flockPixelRatio,
  type FrameBudget,
} from '../src/client/flock-performance';

function samples(budget: FrameBudget, count: number, interval: number) {
  const changes: number[] = [];
  for (let index = 0; index < count; index++) {
    const scale = budget.sample(interval);
    if (scale !== undefined) changes.push(scale);
  }
  return changes;
}

for (const fps of [30, 20]) {
  test(`${fps}fps and ordinary cadence jitter do not lower the render scale`, () => {
    const budget = createFrameBudget(fps);
    assert.deepEqual(samples(budget, 1000, 1000 / fps), []);
    for (let index = 0; index < 1000; index++) {
      assert.equal(budget.sample(1000 / fps + (index % 2 ? -4 : 4)), undefined);
    }
  });
}

test('sustained slow frames descend exactly twice and never recover upward', () => {
  const budget = createFrameBudget(30);
  assert.deepEqual(samples(budget, 1000, 100), [0.8, 0.65]);
  assert.deepEqual(samples(budget, 1000, 1000 / 30), []);
  assert.deepEqual(samples(budget, 1000, 100), []);
});

test('the first fifteen valid intervals are warmup, including after a downgrade', () => {
  const budget = createFrameBudget(30);
  assert.deepEqual(samples(budget, 15, 1000), []);
  assert.deepEqual(samples(budget, 14, 1000), []);
  assert.equal(budget.sample(1000), 0.8);
  assert.deepEqual(samples(budget, 15, 1000), []);
  assert.deepEqual(samples(budget, 14, 1000), []);
  assert.equal(budget.sample(1000), 0.65);
});

test('a window needs both two seconds and fifteen measured intervals', () => {
  const elapsed = createFrameBudget(30);
  samples(elapsed, 15, 100);
  assert.deepEqual(samples(elapsed, 19, 100), []);
  assert.equal(elapsed.sample(100), 0.8);

  const count = createFrameBudget(30);
  samples(count, 15, 250);
  assert.deepEqual(samples(count, 14, 250), []);
  assert.equal(count.sample(250), 0.8);
});

test('the slow threshold is strict and evaluates the average rather than one spike', () => {
  const budget = createFrameBudget(20);
  assert.deepEqual(samples(budget, 200, 65), []);
  assert.equal(samples(budget, 200, 66)[0], 0.8);

  const spike = createFrameBudget(30);
  samples(spike, 15, 1000 / 30);
  for (let index = 0; index < 10; index++) {
    assert.equal(spike.sample(100), undefined);
    assert.deepEqual(samples(spike, 80, 1000 / 30), []);
  }
});

test('invalid intervals consume neither warmup nor the measured window', () => {
  const budget = createFrameBudget(30);
  for (let index = 0; index < 20; index++) {
    for (const interval of [NaN, Infinity, -Infinity, 0, -1]) {
      assert.equal(budget.sample(interval), undefined);
    }
  }
  assert.deepEqual(samples(budget, 15, 100), []);
  assert.deepEqual(samples(budget, 19, 100), []);
  for (const interval of [NaN, Infinity, -Infinity, 0, -1]) {
    assert.equal(budget.sample(interval), undefined);
  }
  assert.equal(budget.sample(100), 0.8);
});

test('reset clears a partial window and reinstates warmup without restoring quality', () => {
  const budget = createFrameBudget(30);
  samples(budget, 15, 100);
  samples(budget, 19, 100);
  budget.reset();
  assert.deepEqual(samples(budget, 15, 100), []);
  assert.deepEqual(samples(budget, 19, 100), []);
  assert.equal(budget.sample(100), 0.8);
  budget.reset();
  assert.deepEqual(samples(budget, 15, 100), []);
  assert.deepEqual(samples(budget, 19, 100), []);
  assert.equal(budget.sample(100), 0.65);
  budget.reset();
  assert.deepEqual(samples(budget, 1000, 100), []);
});

test('frame rate must be finite and positive', () => {
  for (const fps of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(() => createFrameBudget(fps), RangeError);
  }
});

test('resolution scale is applied after the DPR cap on high-density devices', () => {
  assert.equal(flockPixelRatio(1000, 600, 2, 1.25, 1_800_000), 1.25);
  assert.equal(flockPixelRatio(1000, 600, 2, 1.25, 1_800_000, 0.8), 1);
  assert.equal(flockPixelRatio(1000, 600, 2, 1.25, 1_800_000, 0.65), 0.8125);
  assert.equal(flockPixelRatio(1000, 600, 0.75, 1.25, 1_800_000), 0.75);
});

test('full and light pixel counts stay inside their budgets at every scale', () => {
  for (const [width, height, maxDpr, maxPixels] of [
    [3840, 2160, 1.25, 1_800_000],
    [390, 844, 1, 700_000],
    [2000, 1200, 1, 700_000],
  ]) {
    for (const scale of [1, 0.8, 0.65]) {
      const ratio = flockPixelRatio(width, height, 3, maxDpr, maxPixels, scale);
      assert.ok(Number.isFinite(ratio) && ratio > 0);
      assert.ok(ratio <= maxDpr * scale);
      assert.ok(width * height * ratio * ratio <= maxPixels + 1e-6);
    }
  }
});

test('dimensions and device ratio have bounded finite fallbacks', () => {
  for (const invalid of [0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(
      flockPixelRatio(invalid, 600, 2, 1.25, 1_800_000),
      flockPixelRatio(1, 600, 2, 1.25, 1_800_000),
    );
    assert.equal(
      flockPixelRatio(1000, invalid, 2, 1.25, 1_800_000),
      flockPixelRatio(1000, 1, 2, 1.25, 1_800_000),
    );
    assert.equal(flockPixelRatio(1000, 600, invalid, 1.25, 1_800_000), 1);
  }
  assert.equal(
    flockPixelRatio(0.5, 0.5, 2, 1.25, 1_800_000),
    flockPixelRatio(1, 1, 2, 1.25, 1_800_000),
  );
  assert.equal(
    flockPixelRatio(Number.MAX_VALUE, Number.MAX_VALUE, 2, 1.25, 1_800_000),
    flockPixelRatio(32768, 32768, 2, 1.25, 1_800_000),
  );
});

test('scale is clamped to the approved ladder envelope and invalid scale means one', () => {
  for (const scale of [0, -1, 0.4])
    assert.equal(flockPixelRatio(1000, 600, 2, 1.25, 1_800_000, scale), 0.8125);
  for (const scale of [1, 2, NaN, Infinity, -Infinity])
    assert.equal(flockPixelRatio(1000, 600, 2, 1.25, 1_800_000, scale), 1.25);
});

test('invalid DPR and pixel budgets are rejected rather than silently enlarged', () => {
  for (const invalid of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(() => flockPixelRatio(1000, 600, 2, invalid, 1_800_000), RangeError);
    assert.throws(() => flockPixelRatio(1000, 600, 2, 1.25, invalid), RangeError);
  }
});
