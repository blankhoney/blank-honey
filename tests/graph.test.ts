import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outsideViewport } from '../src/client/graph';

test('graph recovery only treats entirely offscreen nodes as invisible', () => {
  assert.equal(outsideViewport({ x1: -20, y1: 10, x2: 1, y2: 30 }, 100, 100), false);
  assert.equal(outsideViewport({ x1: 99, y1: 99, x2: 130, y2: 130 }, 100, 100), false);
  for (const box of [
    { x1: -20, y1: 10, x2: -1, y2: 30 },
    { x1: 101, y1: 10, x2: 120, y2: 30 },
    { x1: 10, y1: -20, x2: 30, y2: -1 },
    { x1: 10, y1: 101, x2: 30, y2: 130 },
  ])
    assert.equal(outsideViewport(box, 100, 100), true);
});
