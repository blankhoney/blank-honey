import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createTerrainGeometry,
  sampleTerrain,
  sceneryInstances,
  seededRandom,
  terrainBounds,
  terrainGrid,
  terrainNoise,
} from '../src/client/flock-terrain';

/** The module text, so the three ramp colours are pinned where they are actually written. */
const terrainSource = readFileSync(
  new URL('../src/client/flock-terrain.ts', import.meta.url),
  'utf8',
);

for (const light of [false, true]) {
  const label = light ? 'light' : 'full';

  test(`${label} terrain has bounded, deterministic geometry and upward unit normals`, () => {
    const geometry = createTerrainGeometry(light);
    const duplicate = createTerrainGeometry(light);
    try {
      const { columns, rows } = terrainGrid(light);
      const position = geometry.getAttribute('position');
      const color = geometry.getAttribute('color');
      const normal = geometry.getAttribute('normal');
      assert.equal(geometry.index, null);
      assert.equal(position.count, columns * rows * 6);
      assert.equal(color.count, position.count);
      assert.equal(normal.count, position.count);
      assert.ok(position.count / 3 <= (light ? 6500 : 18000));
      assert.deepEqual(position.array, duplicate.getAttribute('position').array);
      assert.deepEqual(color.array, duplicate.getAttribute('color').array);
      for (let index = 0; index < position.count; index++) {
        for (const attribute of [position, color, normal]) {
          assert.ok(Number.isFinite(attribute.getX(index)));
          assert.ok(Number.isFinite(attribute.getY(index)));
          assert.ok(Number.isFinite(attribute.getZ(index)));
        }
        for (const component of [color.getX(index), color.getY(index), color.getZ(index)]) {
          assert.ok(component >= 0 && component <= 1);
        }
        assert.ok(normal.getY(index) > 0);
        assert.ok(
          Math.abs(Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index)) - 1) <
            1e-6,
        );
      }
      assert.ok(geometry.boundingSphere);
      assert.ok(
        Number.isFinite(geometry.boundingSphere.radius) && geometry.boundingSphere.radius > 0,
      );
      for (const component of geometry.boundingSphere.center.toArray())
        assert.ok(Number.isFinite(component));
    } finally {
      geometry.dispose();
      duplicate.dispose();
    }
  });

  test(`${label} ground samples agree with actual triangle centroids near banks and peaks`, () => {
    const geometry = createTerrainGeometry(light);
    try {
      const position = geometry.getAttribute('position');
      const { columns, rows } = terrainGrid(light);
      const { minX, maxX, minZ, maxZ } = terrainBounds;
      for (const [x, z] of [
        [-1050, 100],
        [-2300, -2600],
        [1200, -1000],
        [2900, -3500],
        [-3700, -6400],
      ]) {
        const column = Math.floor(((x - minX) / (maxX - minX)) * columns);
        const row = Math.floor(((z - minZ) / (maxZ - minZ)) * rows);
        for (const triangle of [0, 1]) {
          const first = (row * columns + column) * 6 + triangle * 3;
          const cx =
            (position.getX(first) + position.getX(first + 1) + position.getX(first + 2)) / 3;
          const cy =
            (position.getY(first) + position.getY(first + 1) + position.getY(first + 2)) / 3;
          const cz =
            (position.getZ(first) + position.getZ(first + 1) + position.getZ(first + 2)) / 3;
          assert.ok(
            Math.abs(sampleTerrain(cx, cz, light) - cy) < 0.005,
            `${label} cell ${column},${row}, triangle ${triangle}`,
          );
        }
      }
    } finally {
      geometry.dispose();
    }
  });

  test(`${label} central lake stays below the water plane`, () => {
    for (const z of [-4000, -3000, -2000, -1000, 0]) assert.ok(sampleTerrain(0, z, light) < 0);
  });

  for (const rocks of [false, true]) {
    test(`${label} ${rocks ? 'rock' : 'tree'} instances are deterministic and sit on the rendered ground`, () => {
      const instances = sceneryInstances(light, rocks);
      assert.deepEqual(instances, sceneryInstances(light, rocks));
      assert.ok(instances.length > 0);
      assert.ok(instances.length <= (rocks ? (light ? 30 : 60) : light ? 75 : 180));
      for (const instance of instances) {
        for (const value of Object.values(instance)) assert.ok(Number.isFinite(value));
        assert.ok(instance.size > 0);
        assert.ok(instance.y > 0);
        assert.equal(instance.y, sampleTerrain(instance.x, instance.z, light));
        assert.ok(instance.rotation >= 0 && instance.rotation < Math.PI * 2);
      }
    });
  }
}

test('light terrain uses fewer triangles than full terrain', () => {
  const full = terrainGrid(false);
  const light = terrainGrid(true);
  assert.ok(light.columns * light.rows < full.columns * full.rows);
});

for (const light of [false, true]) {
  const label = light ? 'light' : 'full';

  test(`${label} terrain colours follow the original cold hillside ramp`, () => {
    const geometry = createTerrainGeometry(light);
    try {
      const color = geometry.getAttribute('color');
      for (let index = 0; index < color.count; index++) {
        const red = color.getX(index);
        const green = color.getY(index);
        const blue = color.getZ(index);
        for (const [channel, value] of [
          ['red', red],
          ['green', green],
          ['blue', blue],
        ] as const) {
          assert.ok(Number.isFinite(value), `vertex ${index}: ${channel} is not finite`);
          assert.ok(
            value >= 0 && value <= 1,
            `vertex ${index}: ${channel} ${value} leaves the colour range`,
          );
        }
        // The cold hillside - green slope #38575a, grey rock #788597 and snow #d5deeb - holds
        // blue above green above red at all three endpoints, so every lerp between them does too;
        // the shading multiply is a positive 0.8 + noise * 0.25, which keeps that order and
        // stays inside 0..1. The bounding box of the endpoints alone would not hold here.
        assert.ok(
          blue > green && green > red,
          `vertex ${index}: blue ${blue}, green ${green}, red ${red} left the cold ramp`,
        );
      }
      // The ramp itself: the three exact colours the terrain is built from, and no moss grey.
      for (const colour of ['#38575a', '#788597', '#d5deeb']) {
        assert.ok(terrainSource.includes(`'${colour}'`), `flock-terrain.ts must keep ${colour}`);
      }
      for (const replaced of ['#4c625c', '#808b8b', '#d2d9d4']) {
        assert.ok(!terrainSource.includes(`'${replaced}'`), `${replaced} must be gone`);
      }
    } finally {
      geometry.dispose();
    }
  });
}

test('seeded placement randomness is repeatable, seed-sensitive and inside [0, 1)', () => {
  const first = seededRandom(1234);
  const same = seededRandom(1234);
  const other = seededRandom(4321);
  let differs = false;
  for (let index = 0; index < 128; index++) {
    const value = first();
    assert.equal(value, same());
    assert.ok(value >= 0 && value < 1);
    if (value !== other()) differs = true;
  }
  assert.equal(differs, true);
});

test('terrain noise stays bounded and continuous across negative lattice boundaries', () => {
  for (let x = -10; x <= 10; x += 0.37) {
    for (let z = -10; z <= 10; z += 0.61) {
      const value = terrainNoise(x, z);
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    }
  }
  for (const boundary of [-7, -3, -1, 0, 2]) {
    assert.ok(
      Math.abs(terrainNoise(boundary - 1e-5, -2.3) - terrainNoise(boundary + 1e-5, -2.3)) < 1e-4,
    );
    assert.ok(
      Math.abs(terrainNoise(-4.7, boundary - 1e-5) - terrainNoise(-4.7, boundary + 1e-5)) < 1e-4,
    );
  }
});
