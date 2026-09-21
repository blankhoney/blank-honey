import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import {
  createLake,
  createReflectionCache,
  lakeWaves,
  reflectionLayer,
  sampleLakeWave,
} from '../src/client/flock-water';

// These are CPU geometry/resource-contract tests, not shader compilation or GPU validation.
test('lake waves change over time at different positions without exceeding the amplitude budget', () => {
  const amplitude = lakeWaves.reduce((sum, wave) => sum + wave.amplitude, 0);
  for (const [x, z] of [
    [0, 0],
    [170, -330],
    [-1200, -3400],
    [2100, -7000],
  ]) {
    const initial = sampleLakeWave(x, z, 0);
    let changed = false;
    for (let index = 0; index < 100; index++) {
      const height = sampleLakeWave(x, z, index * 0.37);
      assert.ok(Number.isFinite(height));
      assert.ok(Math.abs(height) <= amplitude + 1e-12);
      if (Math.abs(height - initial) > 0.1) changed = true;
    }
    assert.equal(changed, true, `${x}, ${z}`);
  }
});

test('reflection is drawn only on first use and after invalidation', () => {
  const cache = createReflectionCache();
  let draws = 0;
  const draw = () => {
    draws++;
  };
  cache.update(draw);
  assert.equal(draws, 1);
  for (let index = 0; index < 60; index++) cache.update(draw);
  assert.equal(draws, 1);
  cache.invalidate();
  cache.invalidate();
  cache.update(draw);
  assert.equal(draws, 2);
  cache.update(draw);
  assert.equal(draws, 2);
});

test('a failed reflection is not cached and can be retried', () => {
  const cache = createReflectionCache();
  const failure = new Error('reflection draw failed');
  let draws = 0;
  assert.throws(
    () =>
      cache.update(() => {
        draws++;
        throw failure;
      }),
    (error) => error === failure,
  );
  cache.update(() => {
    draws++;
  });
  cache.update(() => {
    draws++;
  });
  assert.equal(draws, 2);
  cache.invalidate();
  assert.throws(
    () =>
      cache.update(() => {
        draws++;
        throw failure;
      }),
    (error) => error === failure,
  );
  cache.update(() => {
    draws++;
  });
  cache.update(() => {
    draws++;
  });
  assert.equal(draws, 4);
});

for (const light of [false, true]) {
  const label = light ? 'light' : 'full';

  test(`${label} lake geometry and reflection allocation fit their fixed budgets`, () => {
    const lake = createLake(light);
    try {
      const geometry = lake.mesh.geometry;
      const position = geometry.getAttribute('position');
      assert.ok(position.count > 0);
      assert.ok(geometry.index);
      assert.ok(geometry.index.count / 3 <= (light ? 6500 : 22000));
      for (const attribute of [
        position,
        geometry.getAttribute('normal'),
        geometry.getAttribute('uv'),
      ]) {
        for (const value of attribute.array) assert.ok(Number.isFinite(value));
      }
      for (const index of geometry.index.array) assert.ok(index >= 0 && index < position.count);
      assert.ok(geometry.boundingSphere);
      assert.ok(
        Number.isFinite(geometry.boundingSphere.radius) && geometry.boundingSphere.radius > 0,
      );
      const target = lake.mesh.getRenderTarget();
      assert.equal(target.width, light ? 256 : 512);
      assert.equal(target.height, light ? 256 : 512);
      assert.equal(target.samples, 0);
      assert.equal(lake.mesh.layers.mask & (1 << reflectionLayer), 0);
      assert.equal(lake.mesh.rotation.x, -Math.PI / 2);
      let nearest = -Infinity;
      let farthest = Infinity;
      for (let index = 0; index < position.count; index++) {
        const worldZ = -position.getY(index) + lake.mesh.position.z;
        nearest = Math.max(nearest, worldZ);
        farthest = Math.min(farthest, worldZ);
      }
      // The portrait camera can retreat to z=5700; water must still extend behind it.
      assert.ok(nearest >= 6500, 'portrait foreground must not expose the lower sky dome');
      assert.ok(farthest <= -11000, 'water must also reach the distant valley');
    } finally {
      lake.dispose();
    }
  });

  test(`${label} time updates and invalidation reuse the same geometry, material and target`, () => {
    const lake = createLake(light);
    try {
      const geometry = lake.mesh.geometry;
      const position = geometry.getAttribute('position').array;
      const material = lake.mesh.material;
      const target = lake.mesh.getRenderTarget();
      const texture = target.texture;
      for (let index = 0; index < 20; index++) {
        lake.update(index * 0.5);
        lake.invalidate();
        assert.equal(material.uniforms.time.value, index * 0.5);
        assert.equal(lake.mesh.geometry, geometry);
        assert.equal(lake.mesh.geometry.getAttribute('position').array, position);
        assert.equal(lake.mesh.material, material);
        assert.equal(lake.mesh.getRenderTarget(), target);
        assert.equal(target.texture, texture);
      }
    } finally {
      lake.dispose();
    }
  });

  test(`${label} disposal releases each owned resource once and later updates do nothing`, () => {
    const lake = createLake(light);
    const parent = new Group();
    parent.add(lake.mesh);
    const counts = { geometry: 0, material: 0, target: 0 };
    lake.mesh.geometry.addEventListener('dispose', () => {
      counts.geometry++;
    });
    lake.mesh.material.addEventListener('dispose', () => {
      counts.material++;
    });
    lake.mesh.getRenderTarget().addEventListener('dispose', () => {
      counts.target++;
    });
    try {
      lake.update(3);
      lake.dispose();
      assert.deepEqual(counts, { geometry: 1, material: 1, target: 1 });
      assert.equal(lake.mesh.parent, null);
      assert.equal(parent.children.length, 0);
      lake.update(99);
      lake.invalidate();
      lake.dispose();
      assert.equal(lake.mesh.material.uniforms.time.value, 3);
      assert.deepEqual(counts, { geometry: 1, material: 1, target: 1 });
    } finally {
      lake.dispose();
    }
  });
}
