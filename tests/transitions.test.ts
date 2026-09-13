import test from 'node:test';
import assert from 'node:assert/strict';
import { foldAt } from '../src/client/transitions';

test('Paper segments remain connected throughout the fold', () => {
  assert.ok(
    Math.abs(foldAt(36, 1440, 0.5).at(-1)!.angle) > 50,
    'the edge curls, rather than turning as a rigid card',
  );
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const segments = foldAt(12, 1440, t);
    for (let i = 0; i < segments.length - 1; i++) {
      const edge = segments[i],
        next = segments[i + 1];
      assert.ok(Math.abs(edge.x + Math.cos((edge.angle * Math.PI) / 180) * 120 - next.x) < 0.001);
      assert.ok(Math.abs(edge.z - Math.sin((edge.angle * Math.PI) / 180) * 120 - next.z) < 0.001);
    }
  }
});
