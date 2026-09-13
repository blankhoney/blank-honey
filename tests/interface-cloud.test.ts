import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followScroll } from '../src/client/interface-cloud.js';

test('point ink scroll lag stays bounded and converges exactly after scrolling stops', () => {
  for (const target of [-10000, 10000]) {
    let position = followScroll(0, target, 16);
    assert.ok(Math.abs(position - target) <= 32);
    let previousDistance = Math.abs(position - target);
    for (let frame = 0; frame < 60; frame++) {
      position = followScroll(position, target, 16);
      const distance = Math.abs(position - target);
      assert.ok(distance <= previousDistance);
      previousDistance = distance;
    }
    assert.equal(position, target);
  }
  assert.equal(followScroll(120, 120, 16), 120);
});
