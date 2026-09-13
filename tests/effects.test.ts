import { test } from 'node:test';
import assert from 'node:assert/strict';
import orbit from '../src/client/effects/orbit';
import drift from '../src/client/effects/drift';
import helix from '../src/client/effects/helix';
import terrain from '../src/client/effects/terrain';
import archive from '../src/client/effects/archive';

test('Hero presets stay within mobile budget and use the v4 paint contract', () => {
  for (const preset of [orbit, drift, helix, terrain, archive]) {
    const value = preset({ count: 420, mobile: true, light: true });
    const points = value.manualParticles as
      ReturnType<typeof import('../src/client/particles').dot>[] | undefined;
    if (points) {
      assert.ok(points.length <= 420);
      for (const point of points) {
        assert.ok(point.position.x >= 0 && point.position.x <= 100);
        assert.ok(point.position.y >= 0 && point.position.y <= 100);
        assert.ok(point.options.paint.color.value);
      }
    } else assert.ok(value.particles?.paint);
  }
});
