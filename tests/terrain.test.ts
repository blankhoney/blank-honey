// Contract test for the `terrain` algorithm scene. The scene itself renders on
// the GPU, but its design rests on a pure height field and on fixed geometry, so
// the numbers the shaders and the mesh depend on are checked here directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3, type BufferGeometry } from 'three';
import { createScene } from '../src/client/algorithms/terrain/scene';
import {
  createTerrainLayerGeometry,
  terrainLodPlan,
  terrainSkirtDepth,
} from '../src/client/algorithms/terrain/geometry';
import {
  terrainFlowDirection,
  terrainFlowMeander,
  terrainFlowMeanderScale,
  terrainFlowWidth,
  terrainFjordBank,
  terrainFjordCore,
  terrainFrequency,
  terrainHeight,
  terrainHeightCeiling,
  terrainHeightFloor,
  terrainHeightRef,
  terrainHeightScale,
  terrainLacunarity,
  terrainPersistence,
  terrainSeedX,
  terrainSeedZ,
  terrainValley,
  terrainWaterLevel,
  terrainViewHalf,
  terrainWarp,
} from '../src/client/algorithms/terrain/height';
import {
  terrainCamera,
  terrainCameraHeight,
  terrainFieldOfView,
  terrainOrbitRadius,
  terrainOrbitSwing,
  terrainParallaxShift,
  terrainParallaxYaw,
  terrainTargetHeight,
} from '../src/client/algorithms/terrain/camera';
import {
  skyFragmentShader,
  terrainFragmentShader,
  terrainVertexShader,
  waterFragmentShader,
} from '../src/client/algorithms/terrain/glsl';
import { NOISE_GLSL, NOISE_STACK_PRIMS2D_GLSL } from '../src/client/vendor/terrain/noise-glsl';
import { terrainResolution } from '../src/client/algorithms/terrain/scene';

const extent = terrainViewHalf * 5;
/** The scene module's source, for the values that are not exported. */
const sceneSource = readFileSync(
  new URL('../src/client/algorithms/terrain/scene.ts', import.meta.url),
  'utf8',
);
// The scene's own budget, before the pixel and DPR caps of the test viewport.
const fullBudget = { light: false, fps: 30, maxPixels: 1_200_000, maxDpr: 1.5 };
const lightBudget = { light: true, fps: 20, maxPixels: 450_000, maxDpr: 1 };

function grid(step: number) {
  const points: Array<[number, number]> = [];
  for (let x = -extent; x <= extent; x += step) {
    for (let z = -extent; z <= extent; z += step) points.push([x, z]);
  }
  return points;
}

test('terrain height and valley are finite and inside their declared bounds', () => {
  assert.ok(terrainHeightFloor < 0 && terrainHeightCeiling > terrainHeightScale);
  for (const [x, z] of grid(97)) {
    const height = terrainHeight(x, z);
    assert.ok(Number.isFinite(height), `height at ${x},${z}`);
    assert.ok(height >= terrainHeightFloor && height <= terrainHeightCeiling, `height at ${x},${z}`);
    const valley = terrainValley(x, z);
    assert.ok(valley >= 0 && valley <= 1, `valley at ${x},${z}`);
  }
});

test('terrain height is deterministic and varies across the viewing area', () => {
  for (const [x, z] of grid(311)) {
    assert.equal(terrainHeight(x, z), terrainHeight(x, z));
    assert.equal(terrainValley(x, z), terrainValley(x, z));
  }
  const local = terrainHeight(0, 0);
  assert.notEqual(local, terrainHeight(terrainViewHalf, 0));
  assert.notEqual(local, terrainHeight(0, -terrainViewHalf));
  assert.notEqual(local, terrainHeight(-terrainViewHalf / 2, terrainViewHalf / 3));
});

test('the height field is continuous and flat enough for the skirt to close seams', () => {
  // A LOD seam is a straight line drawn between two coarse edge samples while
  // the finer layer next to it follows the field: the visible crack is the
  // height difference between the two, so measure exactly that on both seams
  // and confirm the skirt wall is deep enough to cover it.
  const seamError = (line: number, span: number, fineSpacing: number, coarseSpacing: number) => {
    const half = span / 2;
    const coarseCount = Math.round(span / coarseSpacing);
    assert.ok(Math.abs(span / coarseSpacing - coarseCount) < 1e-9, 'coarse step must divide the seam');
    let worst = 0;
    for (let step = 0; step * fineSpacing <= span; step++) {
      const along = -half + step * fineSpacing;
      const position = (along + half) / coarseSpacing;
      const index = Math.min(Math.floor(position), coarseCount - 1);
      const fraction = position - index;
      const low = terrainHeight(line, -half + index * coarseSpacing);
      const high = terrainHeight(line, -half + (index + 1) * coarseSpacing);
      const coarse = low + (high - low) * fraction;
      worst = Math.max(worst, Math.abs(terrainHeight(line, along) - coarse));
    }
    return worst;
  };
  for (const light of [false, true]) {
    const plan = terrainLodPlan(light);
    const cells = plan.map((layer) => (2 * layer.outerHalf) / layer.resolution);
    const nearMid = seamError(plan[0].outerHalf, 2 * plan[0].outerHalf, cells[0], cells[1]);
    const midFar = seamError(plan[1].outerHalf, 2 * plan[1].outerHalf, cells[1], cells[2]);
    assert.ok(nearMid > 0 && midFar > 0, 'the seams must be real, not identical grids');
    assert.ok(
      nearMid < terrainSkirtDepth * 0.75,
      `${light ? 'light' : 'full'} near/mid seam ${nearMid.toFixed(0)} vs ${terrainSkirtDepth}`,
    );
    assert.ok(
      midFar < terrainSkirtDepth * 0.75,
      `${light ? 'light' : 'full'} mid/far seam ${midFar.toFixed(0)} vs ${terrainSkirtDepth}`,
    );
  }
  // The field also has to keep varying: a constant field would pass the above.
  assert.notEqual(terrainHeight(0, 0), terrainHeight(terrainViewHalf / 3, -terrainViewHalf / 3));
});

test('the water level divides the field into a real lake and real peaks', () => {
  let below = 0;
  let above = 0;
  for (const [x, z] of grid(107)) {
    const height = terrainHeight(x, z);
    if (height < terrainWaterLevel) below++;
    if (height > terrainWaterLevel + 400) above++;
  }
  assert.ok(below > 0 && above > 0, `below ${below}, above ${above}`);
  assert.ok(above > 0, 'mountains must exist for snow and rock to shade');
  assert.equal(terrainWaterLevel, 0);
  assert.ok(terrainHeightRef > 0.1 && terrainHeightRef < 0.5, 'water sits inside the h01 range');
});

test('the fjord runs the whole field as one continuous channel', () => {
  // The centre line the field carries is two fixed sine terms in world Z; it is
  // written out here the way the design states it, so this test measures the
  // channel the shaders actually carve and not a re-derivation of it.
  const centreAt = (z: number) => 450 * Math.sin(z / 2200) + 200 * Math.sin(z / 4300 + 0.5);
  let worstValley = Infinity;
  let worstAt = '';
  let shallowestBed = -Infinity;
  let bedAt = '';
  for (let z = -4000; z <= 4000; z += 7) {
    const centre = centreAt(z);
    const valley = terrainValley(centre, z);
    if (valley < worstValley) {
      worstValley = valley;
      worstAt = `${centre.toFixed(0)},${z}`;
    }
    const bed = terrainHeight(centre, z);
    if (bed > shallowestBed) {
      shallowestBed = bed;
      bedAt = `${centre.toFixed(0)},${z}`;
    }
  }
  // Full valley strength along the whole line: the channel never pinches shut
  // between two basins, so it reads as one fjord and not as local patches.
  assert.ok(worstValley >= 0.99, `valley ${worstValley.toFixed(3)} at ${worstAt}`);
  // The bed under the line stays below water the whole way too. The banks
  // either side are ordinary terrain and are free to rise above water.
  assert.ok(
    shallowestBed < terrainWaterLevel,
    `bed ${shallowestBed.toFixed(0)} surfaces at ${bedAt}`,
  );
  // Wide as well as continuous: the mask holds full strength across the whole
  // core, which is what the banks are measured against.
  assert.ok(terrainFjordCore > 0 && terrainFjordBank > terrainFjordCore);
  for (const z of [-3600, -1800, 0, 1800, 3600]) {
    const centre = centreAt(z);
    for (const across of [0, terrainFjordCore / 2, terrainFjordCore]) {
      for (const side of [-1, 1]) {
        const x = centre + side * across;
        assert.ok(
          terrainValley(x, z) >= 0.99,
          `valley ${terrainValley(x, z)} at ${x},${z} inside the core`,
        );
      }
    }
  }
  // The channel is a channel: past the bank the mask is free to drop away, and
  // it does, so the fjord has real sides rather than masking the whole field.
  const far = centreAt(0) + terrainFjordBank * 1.5;
  assert.ok(terrainValley(far, 0) < 0.99, 'the mask must fall off past the bank');
});

test('the fixed viewing area holds both the lake and a summit', () => {
  let underwater = 0;
  let highest = -Infinity;
  for (let x = -terrainViewHalf; x <= terrainViewHalf; x += terrainViewHalf / 25) {
    for (let z = -terrainViewHalf; z <= terrainViewHalf; z += terrainViewHalf / 25) {
      const height = terrainHeight(x, z);
      if (height < terrainWaterLevel) underwater++;
      highest = Math.max(highest, height);
    }
  }
  assert.ok(underwater > 0, 'the near layer must be covered by the lake somewhere');
  assert.ok(highest > terrainWaterLevel + 300, 'the near layer must show land too');
});

test('finite-difference normals from the height field are unit and upward', () => {
  const epsilon = 6;
  for (const [x, z] of grid(251)) {
    const hC = terrainHeight(x, z);
    const hX = terrainHeight(x + epsilon, z);
    const hZ = terrainHeight(x, z + epsilon);
    const normal = new Vector3(-(hX - hC) / epsilon, 1, -(hZ - hC) / epsilon).normalize();
    assert.ok(Number.isFinite(normal.x) && Number.isFinite(normal.y) && Number.isFinite(normal.z));
    assert.ok(Math.abs(normal.length() - 1) < 1e-6, 'the normal must be normalized');
    assert.ok(normal.y > 0, 'terrain normals point up');
  }
});

for (const light of [false, true]) {
  const label = light ? 'light' : 'full';
  const plan = terrainLodPlan(light);
  const near = light ? 64 : 128;

  test(`${label} LOD plan nests three layers and doubles the cell size per step`, () => {
    assert.equal(plan.length, 3);
    assert.deepEqual(
      plan.map((layer) => layer.id),
      ['near', 'mid', 'far'],
    );
    assert.equal(plan[0].innerHalf, 0);
    assert.equal(plan[0].outerHalf, terrainViewHalf);
    assert.equal(plan[1].innerHalf, plan[0].outerHalf);
    assert.equal(plan[2].innerHalf, plan[1].outerHalf);
    assert.deepEqual(
      plan.map((layer) => layer.resolution),
      [near, (near * 3) / 2, (near * 5) / 4],
    );
    for (const layer of plan) {
      assert.ok(Number.isInteger(layer.resolution) && layer.resolution > 0);
      assert.ok(layer.outerHalf > layer.innerHalf);
    }
    // Doubling the cell size per step is what keeps each seam inside the skirt.
    const cells = plan.map((layer) => (2 * layer.outerHalf) / layer.resolution);
    assert.ok(Math.abs(cells[1] / cells[0] - 2) < 1e-9, `${cells}`);
    assert.ok(Math.abs(cells[2] / cells[1] - 2) < 1e-9, `${cells}`);
  });

  test(`${label} LOD geometry stays inside budget with valid skirt closure`, () => {
    let vertices = 0;
    let triangles = 0;
    for (const [index, layer] of plan.entries()) {
      const geometry = createTerrainLayerGeometry(layer);
      try {
        const position = geometry.getAttribute('position');
        const skirt = geometry.getAttribute('aSkirt');
        const indices = geometry.getIndex()!;
        const cells = plan[index].resolution;
        const step = (2 * layer.outerHalf) / cells;
        const holeCells = layer.innerHalf > 0 ? Math.round((2 * layer.innerHalf) / step) : 0;
        // Two triangles per drawn cell plus one wall quad (two triangles) per
        // boundary-loop vertex: the outer loop and the hole loop.
        const loopVertices = 4 * cells + (layer.innerHalf > 0 ? 4 * holeCells : 0);
        assert.equal(indices.count / 3, (cells * cells - holeCells * holeCells) * 2 + loopVertices * 2);
        assert.equal(skirt.count, position.count);
        for (let i = 0; i < indices.count; i++) {
          assert.ok(indices.getX(i) < position.count, `index ${i} in range`);
        }
        for (let i = 0; i < indices.count; i += 3) {
          assert.equal(new Set([indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)]).size, 3);
        }
        // Surface vertices sit on the layer lattice with y left to the GPU, and
        // never inside the hole the next layer fills.
        let skirtCount = 0;
        const surfaceByXZ = new Map<string, number>();
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i);
          const y = position.getY(i);
          const z = position.getZ(i);
          assert.equal(y, 0, 'height comes from the vertex shader');
          assert.ok(x >= -layer.outerHalf && x <= layer.outerHalf, `x ${x}`);
          assert.ok(z >= -layer.outerHalf && z <= layer.outerHalf, `z ${z}`);
          if (layer.innerHalf > 0) {
            assert.ok(
              Math.abs(x) >= layer.innerHalf || Math.abs(z) >= layer.innerHalf,
              `vertex inside the hole at ${x},${z}`,
            );
          }
          if (skirt.getX(i) > 0.5) {
            skirtCount++;
            // A skirt vertex is the dropped copy of one surface edge vertex.
            const surface = surfaceByXZ.get(`${x},${z}`);
            assert.notEqual(surface, undefined, `skirt vertex ${i} has no surface partner`);
          } else {
            surfaceByXZ.set(`${x},${z}`, i);
          }
        }
        assert.equal(skirtCount, loopVertices);
        vertices += position.count;
        triangles += indices.count / 3;
      } finally {
        geometry.dispose();
      }
    }
    assert.ok(vertices <= (light ? 19000 : 70000), `vertices ${vertices}`);
    assert.ok(triangles <= (light ? 36000 : 137000), `triangles ${triangles}`);
  });
}

test('each ring hole edge reuses the previous layer lattice exactly', () => {
  const plans = terrainLodPlan(false);
  const layers = plans.map((plan) => createTerrainLayerGeometry(plan));
  try {
    const lattice = (geometry: BufferGeometry) => {
      const position = geometry.getAttribute('position');
      const keys = new Set<string>();
      for (let i = 0; i < position.count; i++) {
        keys.add(`${position.getX(i)},${position.getZ(i)}`);
      }
      return keys;
    };
    // The ring samples every second point of the layer it meets, so every ring
    // hole vertex must already exist in that layer; that is what makes both
    // evaluate the same height at the shared points.
    const shared = (inner: BufferGeometry, ring: BufferGeometry, innerHalf: number, count: number) => {
      const keys = lattice(inner);
      const position = ring.getAttribute('position');
      // Skirt vertices duplicate their surface edge, so count unique positions.
      const visited = new Set<string>();
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const z = position.getZ(i);
        const onXEdge = Math.abs(Math.abs(x) - innerHalf) < 1e-6 && Math.abs(z) <= innerHalf + 1e-6;
        const onZEdge = Math.abs(Math.abs(z) - innerHalf) < 1e-6 && Math.abs(x) <= innerHalf + 1e-6;
        if (!onXEdge && !onZEdge) continue;
        assert.ok(keys.has(`${x},${z}`), `ring hole vertex ${x},${z} is not a layer vertex`);
        visited.add(`${x},${z}`);
      }
      assert.equal(visited.size, count, 'every hole edge vertex must be visited');
    };
    const holeVertices = (plan: (typeof plans)[number]) => {
      const step = (2 * plan.outerHalf) / plan.resolution;
      // The hole is the previous layer's square, so it spans 2 * innerHalf.
      return 4 * Math.round((2 * plan.innerHalf) / step);
    };
    shared(layers[0], layers[1], plans[0].outerHalf, holeVertices(plans[1]));
    shared(layers[1], layers[2], plans[1].outerHalf, holeVertices(plans[2]));
  } finally {
    for (const layer of layers) layer.dispose();
  }
});

test('the camera stays above the terrain it orbits and over water level', () => {
  // Fixed domain: a long cycle crossed with the whole pointer square, because
  // the pointer leans the aim point and therefore the camera height too.
  const pointers: Array<[number, number]> = [];
  for (const x of [-1, -0.5, 0, 0.5, 1]) for (const y of [-1, -0.5, 0, 0.5, 1]) pointers.push([x, y]);
  let lowest = Infinity;
  let lowestAt = '';
  for (let seconds = 0; seconds < 900; seconds += 0.25) {
    for (const [pointerX, pointerY] of pointers) {
      const view = terrainCamera(seconds, pointerX, pointerY);
      assert.ok(Number.isFinite(view.position.x + view.position.y + view.position.z));
      assert.ok(view.position.y > terrainWaterLevel, 'the camera never dips to water level');
      const clearance = view.position.y - terrainHeight(view.position.x, view.position.z);
      if (clearance < lowest) {
        lowest = clearance;
        lowestAt = `${seconds}s, pointer ${pointerX},${pointerY}`;
      }
      const horizontal = Math.hypot(
        view.position.x - view.target.x,
        view.position.z - view.target.z,
      );
      assert.ok(horizontal > 0 && horizontal <= terrainOrbitRadius);
    }
  }
  assert.ok(lowest > 120, `camera clearance ${lowest.toFixed(0)} at ${lowestAt} is too small`);
  // The two designed heights: the camera sits at terrainCameraHeight (the pitch
  // is solved from it) and aims at terrainTargetHeight when the pointer rests.
  const centred = terrainCamera(123, 0, 0);
  assert.ok(Math.abs(centred.position.y - terrainCameraHeight) < 10);
  assert.equal(centred.target.y, terrainTargetHeight);
  assert.ok(terrainCameraHeight > terrainTargetHeight, 'the camera looks down at the lake');
  // The shot is held. The pitch is solved once from the fixed camera height and
  // pinned there, so with a resting pointer the camera never rises or falls and
  // the aim point never moves; only the yaw drifts, and only by the swing.
  for (const seconds of [0, 30, 120, 600]) {
    const view = terrainCamera(seconds, 0, 0);
    assert.equal(view.position.y, centred.position.y, 'the camera must not breathe with time');
    assert.deepEqual(view.target, centred.target, 'the aim point must not drift with time');
    assert.ok(Math.abs(view.yaw) <= terrainOrbitSwing + 1e-12, `yaw ${view.yaw} escapes the swing`);
  }
  // Independent bound: the camera never leaves a narrow arc in front of the
  // viewing area — the orbit swing plus the pointer lean, over the band the aim
  // point can shift the whole rig through. Sample that band directly instead of
  // the whole orbit ring: the ring reaches far enough round to cross mountains
  // the shot can never visit, and the field is designed to have them.
  const yawReach = terrainOrbitSwing + terrainParallaxYaw;
  let bandHighest = -Infinity;
  for (let yaw = -yawReach; yaw <= yawReach + 1e-9; yaw += yawReach / 32) {
    for (let shiftX = -1; shiftX <= 1; shiftX += 0.25) {
      for (let shiftZ = -1; shiftZ <= 1; shiftZ += 0.25) {
        const x = shiftX * terrainParallaxShift + Math.sin(yaw) * terrainOrbitRadius;
        const z = shiftZ * terrainParallaxShift * 0.5 + Math.cos(yaw) * terrainOrbitRadius;
        bandHighest = Math.max(bandHighest, terrainHeight(x, z));
      }
    }
  }
  const lowestCameraHeight = Math.min(
    ...[0, 1].flatMap((x) => [0, 1].map((y) => terrainCamera(0, x, y).position.y)),
  );
  assert.ok(
    lowestCameraHeight - bandHighest > 100,
    `band clearance ${(lowestCameraHeight - bandHighest).toFixed(0)} is too small`,
  );
});

test('the camera is deterministic and its pointer lean is bounded', () => {
  for (const seconds of [0, 12.5, 200, 1000]) {
    assert.deepEqual(terrainCamera(seconds, 0.3, -0.2), terrainCamera(seconds, 0.3, -0.2));
  }
  const still = terrainCamera(100, 0, 0);
  const leaning = terrainCamera(100, 1, 1);
  assert.notDeepEqual(still.position, leaning.position);
  for (const [x, y] of [
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    const lean = terrainCamera(50, x, y);
    const base = terrainCamera(50, 0, 0);
    assert.ok(Math.hypot(lean.position.x - base.position.x, lean.position.z - base.position.z) < 220);
    assert.ok(Math.abs(lean.position.y - base.position.y) < 90);
  }
  // Out-of-range and non-finite pointer input cannot throw or escape.
  for (const [x, y] of [
    [4, -4],
    [Number.NaN, Number.POSITIVE_INFINITY],
  ]) {
    const view = terrainCamera(10, x, y);
    assert.ok(Number.isFinite(view.position.x + view.position.y + view.position.z));
  }
});

test('the field of view holds the shot across wide, square and narrow screens', () => {
  // three builds a perspective frustum from the vertical angle and the aspect:
  // the half height at unit distance is tan(fov/2), the half width is that
  // times the aspect. Horizontal therefore follows from the two.
  const halfWidthAtUnit = (width: number, height: number) =>
    Math.tan(((terrainFieldOfView(width, height) / 2) * Math.PI) / 180) * (width / height);
  const horizontal = (width: number, height: number) =>
    2 * (180 / Math.PI) * Math.atan(halfWidthAtUnit(width, height));
  // Landscape and square screens hold the designed vertical angle exactly.
  for (const [width, height] of [
    [1440, 900],
    [1000, 600],
    [1920, 1080],
    [320, 320],
  ]) {
    assert.equal(terrainFieldOfView(width, height), 52, `${width}x${height} must hold 52`);
  }
  // Portrait widens the vertical angle instead, until the horizontal one is back
  // to the design: that is the axis that decides how much valley is in shot.
  for (const [width, height] of [
    [390, 844],
    [320, 700],
    [360, 780],
  ]) {
    const vertical = terrainFieldOfView(width, height);
    assert.ok(vertical > 52 && vertical < 100, `portrait ${width}x${height} vertical ${vertical}`);
    assert.ok(
      Math.abs(horizontal(width, height) - 52) < 1e-9,
      `${width}x${height} horizontal ${horizontal(width, height)}`,
    );
  }
  // Only the aspect matters, so a scaled pair is the same viewport.
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
    [1000, 600],
  ]) {
    assert.equal(terrainFieldOfView(width, height), terrainFieldOfView(width * 2, height * 2));
    assert.equal(terrainFieldOfView(width, height), terrainFieldOfView(width * 0.5, height * 0.5));
  }
  // Every aspect from very tall to very wide returns a usable angle, and the
  // cap only ever binds at the narrow end: the horizontal never collapses to
  // nothing on a tall screen, which is what the narrow viewport needs.
  for (let aspect = 0.01; aspect <= 10; aspect *= 1.07) {
    const vertical = terrainFieldOfView(aspect, 1);
    assert.ok(Number.isFinite(vertical), `aspect ${aspect}`);
    assert.ok(vertical >= 52 - 1e-9 && vertical <= 100, `aspect ${aspect} gave ${vertical}`);
    if (aspect >= 1) assert.equal(vertical, 52, `aspect ${aspect} must not widen`);
  }
  assert.equal(terrainFieldOfView(0.01, 1), 100, 'the cap binds on the narrowest screens');
  // A degenerate viewport must still return a usable angle, never NaN.
  for (const [width, height] of [
    [0, 844],
    [-390, 844],
    [Number.NaN, 844],
    [Number.POSITIVE_INFINITY, 844],
    [390, 0],
    [390, -700],
    [390, Number.NaN],
    [390, Number.POSITIVE_INFINITY],
    [0, 0],
    [Number.NaN, Number.NaN],
  ]) {
    const vertical = terrainFieldOfView(width, height);
    assert.ok(Number.isFinite(vertical), `${width}x${height} gave ${vertical}`);
    assert.ok(vertical >= 52 && vertical <= 100, `${width}x${height} gave ${vertical}`);
  }
});

test('the scene drives the camera angle from every resize, before the matrix', () => {
  // The angle has to be applied to the camera the renderer builds its
  // projection uniform from, on every size change, and before the matrix is
  // rebuilt; and the scene must never write a projection matrix itself.
  const aspect = sceneSource.indexOf('camera.aspect = width / height;');
  const fov = sceneSource.indexOf('camera.fov = terrainFieldOfView(width, height);');
  const matrix = sceneSource.indexOf('camera.updateProjectionMatrix();');
  assert.notEqual(aspect, -1, 'applySize must set the aspect');
  assert.notEqual(fov, -1, 'applySize must set the angle from the viewport');
  assert.notEqual(matrix, -1, 'applySize must rebuild the projection');
  assert.ok(aspect < fov && fov < matrix, 'the angle must land before the matrix is rebuilt');
  assert.ok(
    sceneSource.includes(
      'new PerspectiveCamera(terrainFieldOfView(1, 1), 1, cameraNear, cameraFar)',
    ),
    'the camera must be built from the same function',
  );
  assert.ok(!sceneSource.includes('const fieldOfView = 52'), 'no orphaned fixed angle may remain');
  // resize applies the size every time it is called, so frames never keep a
  // stale angle after the viewport changes.
  assert.ok(sceneSource.includes('applySize(safeWidth, safeHeight, safeScale);'));
  assert.equal(sceneSource.split('applySize(').length - 1, 3, 'construction plus one resize path');
  // The projection uniform stays three's: the scene never builds or copies one.
  assert.ok(
    !sceneSource.includes('projectionMatrix'),
    'the scene must not write a projection matrix',
  );
  assert.ok(
    !sceneSource.includes('matrixWorldInverse'),
    'the scene must not build a view-projection',
  );
});

test('terrain resolution uses real pixels and respects the pixel and DPR caps', () => {
  const budget = { light: false, fps: 30, maxPixels: 1_200_000, maxDpr: 1.5 };
  // A device ratio of 3 must not be applied twice: the canvas is sized to real
  // drawing-buffer pixels and the renderer keeps pixel ratio 1.
  const capped = terrainResolution(800, 600, budget, 1, 3);
  assert.equal(capped.ratio, 1.5);
  assert.equal(capped.width, 1200);
  assert.equal(capped.height, 900);
  assert.ok(capped.width * capped.height <= budget.maxPixels);
  // A large viewport is capped by the pixel budget instead of the DPR.
  const wide = terrainResolution(3840, 2160, budget, 1, 2);
  assert.ok(wide.width * wide.height <= budget.maxPixels, `${wide.width}x${wide.height}`);
  assert.ok(wide.ratio < budget.maxDpr);
  // The quality ladder only ever lowers the ratio further.
  const scaled = terrainResolution(800, 600, budget, 0.65, 3);
  assert.ok(scaled.ratio < capped.ratio);
  assert.equal(scaled.ratio, 1.5 * 0.65);
  assert.ok(scaled.width >= 1 && scaled.height >= 1);
  const degenerate = terrainResolution(0, Number.NaN, budget, Number.NaN, Number.NaN);
  assert.ok(degenerate.width >= 1 && degenerate.height >= 1);
});

/**
 * Every numeric smoothstep call has to have ascending edges: the reversed-edge
 * form is undefined in GLSL, and this scene relies on the mask value being the
 * same arithmetic the CPU reference already computed.
 */
function ascendingSmoothsteps(source: string, label: string) {
  const pattern = /smoothstep\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,/g;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = pattern.exec(source)) !== null) {
    count++;
    assert.ok(
      Number(match[1]) < Number(match[2]),
      `${label}: smoothstep(${match[1]}, ${match[2]}, ...) has reversed, undefined edges`,
    );
  }
  return count;
}

test('no shader calls smoothstep with reversed edges', () => {
  const shaders: Array<[string, string]> = [
    ['terrain vertex', terrainVertexShader],
    ['terrain fragment', terrainFragmentShader],
    ['water fragment', waterFragmentShader],
  ];
  let total = 0;
  for (const [label, source] of shaders) {
    total += ascendingSmoothsteps(source, label);
    // The valley mask is an inverted ramp, written the defined way.
    assert.ok(!source.includes('smoothstep(0.66'), `${label} still has the reversed basin ramp`);
  }
  assert.ok(total >= 10, `only ${total} numeric smoothstep calls found`);
  assert.ok(terrainFragmentShader.includes('1.0 - smoothstep(0.32, 0.66,'));
  assert.ok(waterFragmentShader.includes('1.0 - smoothstep(0.0, 5.0, depth)'));
});

test('the rock grain is a distance-faded lighting detail that never flips a face', () => {
  // It is three noise samples tilting the sunlit normal and nothing more: the
  // height field, the geometry normal and every mask stay as they were, and the
  // far early-out still runs before any of it. There is no GPU here, so the
  // checks are the structure of the shader text plus a sampled run of the
  // production expression over the slope, noise and weight ranges.
  const cutoff = terrainFragmentShader.indexOf('if (fog >= terrainFogCutoff)');
  const firstHeight = terrainFragmentShader.indexOf('terrainHeight(xz)');
  const grain = terrainFragmentShader.indexOf('vec2 grainPos = xz * 0.018;');
  const diffuse = terrainFragmentShader.indexOf(
    'float diffuse = max(dot(normalLit, uSunDirection), 0.0);',
  );
  assert.ok(
    cutoff > 0 && firstHeight > cutoff,
    'the early-out must stay ahead of every height sample',
  );
  assert.ok(grain > firstHeight, 'the grain must come after the height field is sampled');
  assert.ok(diffuse > grain, 'the grain must be built before it lights the sun term');
  // Exactly the three forward differences the normal already needed: the grain
  // must never evaluate the height field again.
  assert.equal(
    terrainFragmentShader.match(/terrainHeight\(xz/g)?.length,
    3,
    'one height sample per call',
  );
  // The geometry normal still drives the masks and the sky/ground terms.
  assert.ok(terrainFragmentShader.includes('float slope = 1.0 - normalGeo.y;'));
  assert.ok(
    terrainFragmentShader.includes(
      'smoothstep(uSnowLine - 0.07, uSnowLine + 0.07, h01 - slope * 0.35)',
    ),
    'the snow line still reads the geometry slope',
  );
  assert.ok(
    terrainFragmentShader.includes('vec3 ambient = uSkyColor * 0.42 * (0.5 + 0.5 * normalGeo.y);'),
  );
  assert.ok(
    terrainFragmentShader.includes(
      'vec3 bounce = uGroundColor * 0.16 * (1.0 - normalGeo.y * 0.5);',
    ),
  );
  // The lit normal is the sun term's normal and nothing else's: declared once,
  // used once. The geometry normal is not even read again after it.
  assert.equal(
    terrainFragmentShader.match(/normalLit/g)?.length,
    2,
    'normalLit is the sun term only',
  );
  assert.equal(
    terrainFragmentShader.match(/grainWeight/g)?.length,
    2,
    'grainWeight scales the tilt only',
  );
  // The production expression itself, with the tilt scale read out of it rather
  // than restated here, so the samples below cannot drift from the shader.
  const litForm =
    /vec3 normalLit = normalize\(normalGeo \+ vec3\(grainSlope\.x, 0\.0, grainSlope\.y\) \* \(([\d.]+) \* grainWeight\)\);/.exec(
      terrainFragmentShader,
    );
  assert.notEqual(litForm, null, 'the lit normal must be the designed expression');
  const tilt = Number(litForm![1]);
  assert.ok(Number.isFinite(tilt) && tilt > 0, `tilt ${litForm![1]}`);
  // Sampled, not proved: the geometry normal is whatever the local forward
  // differences give — its X and Z both move — so there is no single lower
  // bound to state for the lit normal's y. What holds for every combination is
  // weaker and enough: the perturbation only ever moves the two horizontal
  // axes, so the y of an upward geometry normal survives untouched, and the
  // renormalisation of a finite, non-zero vector keeps it unit length and
  // upward. The grid spans both extreme slope signs, the full noise range and
  // the whole weight range. This is a sample of the arithmetic, not a GPU run.
  const slopes = [-100, -2, 0, 2, 100];
  const noises = [0, 0.5, 1];
  const weights = [0, 0.5, 1];
  let checked = 0;
  for (const dx of slopes) {
    for (const dz of slopes) {
      const geo = new Vector3(-dx, 1, -dz).normalize();
      assert.ok(geo.y > 0, `the geometry normal must point up at slope ${dx},${dz}`);
      for (const h0 of noises) {
        for (const hx of noises) {
          for (const hz of noises) {
            for (const weight of weights) {
              const tiltX = (h0 - hx) * tilt * weight;
              const tiltZ = (h0 - hz) * tilt * weight;
              const lit = new Vector3(geo.x + tiltX, geo.y, geo.z + tiltZ).normalize();
              assert.ok(
                Number.isFinite(lit.x) && Number.isFinite(lit.y) && Number.isFinite(lit.z),
                `lit normal at ${dx},${dz},${h0},${hx},${hz},${weight}`,
              );
              assert.ok(Math.abs(lit.length() - 1) < 1e-12, 'the lit normal must be normalized');
              assert.ok(lit.y > 0, `the lit normal must stay upward at ${dx},${dz},${weight}`);
              if (weight === 0) {
                assert.ok(
                  Math.abs(lit.x - geo.x) < 1e-12 &&
                    Math.abs(lit.y - geo.y) < 1e-12 &&
                    Math.abs(lit.z - geo.z) < 1e-12,
                  'a zero weight must leave the geometry normal untouched',
                );
              }
              checked++;
            }
          }
        }
      }
    }
  }
  assert.equal(checked, slopes.length ** 2 * noises.length ** 3 * weights.length);
  // The fade is a real ramp over a declared distance band: full strength at the
  // camera, gone by the far edge, and monotone in between.
  const fade = /float grainWeight = 1\.0 - smoothstep\(([\d.]+), ([\d.]+), viewDistance\);/.exec(
    terrainFragmentShader,
  );
  assert.notEqual(fade, null, 'the grain fade must be a distance ramp');
  const nearEdge = Number(fade![1]);
  const farEdge = Number(fade![2]);
  assert.ok(farEdge > nearEdge && nearEdge >= terrainOrbitRadius, `fade ${nearEdge}..${farEdge}`);
  assert.ok(
    Math.abs(nearEdge - terrainOrbitRadius) < 200,
    `the ramp starts at ${nearEdge} against the camera orbit ${terrainOrbitRadius}`,
  );
  const weight = (distance: number) => {
    const t = Math.min(1, Math.max(0, (distance - nearEdge) / (farEdge - nearEdge)));
    return 1 - t * t * (3 - 2 * t);
  };
  assert.equal(weight(0), 1, 'full grain at the camera');
  assert.equal(weight(nearEdge), 1);
  assert.equal(weight(farEdge), 0, 'no grain at the far edge');
  assert.equal(weight(farEdge * 4), 0);
  assert.ok(weight((nearEdge + farEdge) / 2) > 0.45 && weight((nearEdge + farEdge) / 2) < 0.55);
  let previous = 1;
  for (let distance = 0; distance <= farEdge * 2; distance += 50) {
    const current = weight(distance);
    assert.ok(current >= 0 && current <= 1, `weight ${current} at ${distance}`);
    assert.ok(current <= previous + 1e-12, `the fade must not rise at ${distance}`);
    previous = current;
  }
  // The water and the sky keep their own shading: the grain is terrain only.
  assert.ok(!terrainVertexShader.includes('grainPos'), 'the vertex stage must not carry the grain');
  for (const [label, source] of [
    ['water', waterFragmentShader],
    ['sky', skyFragmentShader],
  ] as const) {
    assert.ok(
      !source.includes('grainPos') && !source.includes('normalLit'),
      `${label} must not carry the grain`,
    );
  }
});

test('the sky horizon and the fog are one colour, wired through every material', () => {
  // The field is finite, so the terrain runs out against the sky at the far
  // edge. Matching the two colours is what makes that edge dissolve instead of
  // drawing a line where the fogged ground stops. The scene owns the palette,
  // so the check reads it out of the module source; it must be the same string,
  // and both colours must actually reach the materials and the clear colour.
  const colour = (key: string) => {
    const match = new RegExp(`\\n  ${key}: '(#[0-9a-f]{6})',`).exec(sceneSource);
    assert.notEqual(match, null, `the palette must declare ${key}`);
    return match![1];
  };
  assert.equal(colour('horizon'), colour('fog'), 'the horizon band must be the fog colour exactly');
  assert.ok(
    sceneSource.includes('setClearColor(new Color(palette.fog), 1)'),
    'the clear colour is the fog',
  );
  assert.ok(
    sceneSource.includes('const fogColor = new Color(palette.fog)'),
    'one fog colour for both materials',
  );
  for (const wiring of [
    'uHorizonColor: { value: new Color(palette.horizon) }',
    'uFogColor: { value: fogColor.clone() }',
  ]) {
    assert.equal(
      sceneSource.split(wiring).length - 1,
      2,
      `${wiring} must reach both the sky/water and the fog uniforms`,
    );
  }
  // The density is the shader's own constant, injected for both materials.
  assert.ok(sceneSource.includes('const fogDensity = 1 / 4200;'));
  assert.equal(sceneSource.split('uFogDensity: { value: fogDensity }').length - 1, 2);
});

test('the shader constants are the CPU height field constants', () => {
  // glsl.ts renders each of these from the TypeScript export, so reading the
  // numbers back out of the shader text is what proves the two sides agree.
  const shared: Array<[string, number]> = [
    ['uPersistence', terrainPersistence],
    ['uLacunarity', terrainLacunarity],
    ['terrainFrequency', terrainFrequency],
    ['terrainWarp', terrainWarp],
    ['terrainHeightScale', terrainHeightScale],
    ['terrainHeightRef', terrainHeightRef],
    ['terrainViewHalf', terrainViewHalf],
    ['terrainFlowDirection', terrainFlowDirection],
    ['terrainFlowWidth', terrainFlowWidth],
    ['terrainFlowMeander', terrainFlowMeander],
    ['terrainFlowMeanderScale', terrainFlowMeanderScale],
    ['terrainFjordCore', terrainFjordCore],
    ['terrainFjordBank', terrainFjordBank],
  ];
  for (const [label, source] of [
    ['terrain vertex', terrainVertexShader],
    ['terrain fragment', terrainFragmentShader],
    ['water fragment', waterFragmentShader],
  ] as const) {
    assert.ok(source.includes('#define OCTAVES 4'), `${label} must pin the octave count`);
    for (const [name, value] of shared) {
      const match = new RegExp(`const float ${name} = (-?[\\d.eE+-]+);`).exec(source);
      assert.notEqual(match, null, `${label} must declare ${name}`);
      assert.equal(Number(match![1]), value, `${label} ${name}`);
    }
    const seed = /const vec2 terrainSeed = vec2\((-?[\d.eE+-]+), (-?[\d.eE+-]+)\);/.exec(source);
    assert.notEqual(seed, null, `${label} must declare terrainSeed`);
    assert.equal(Number(seed![1]), terrainSeedX);
    assert.equal(Number(seed![2]), terrainSeedZ);
  }
});

test('the vendored GLSL keeps every primitive the terrain shaders call', () => {
  const primitives = [
    'float hash12(',
    'float vnoise(',
    'const mat2 ROT2 =',
    'float fbm(',
    'float fbm4(',
    'float ridgedFBM(',
  ];
  for (const primitive of primitives) {
    assert.ok(NOISE_GLSL.includes(primitive), `missing ${primitive}`);
  }
  assert.ok(NOISE_STACK_PRIMS2D_GLSL.includes('vec3 vnoised2('));
  assert.ok(NOISE_STACK_PRIMS2D_GLSL.includes('float flow2('));
  for (const shader of [terrainVertexShader, terrainFragmentShader, waterFragmentShader]) {
    // Every stage that samples the field has to bring the primitives with it:
    // the noise is not injected by three, it is part of this string.
    assert.ok(shader.includes(NOISE_GLSL), 'shader must include the vendored noise');
    assert.ok(shader.includes('float terrainHeight(vec2 xz)'));
    const open = (shader.match(/\{/g) ?? []).length;
    const close = (shader.match(/\}/g) ?? []).length;
    assert.equal(open, close, 'unbalanced braces in the shader source');
  }
  // The height field is sampled from world XZ only; nothing may read the clock.
  assert.ok(!terrainVertexShader.includes('uTime'));
  // The scene's own primitives that the shaders rely on.
  assert.ok(terrainVertexShader.includes('float terrainRidged3(vec2 p)'));
  assert.ok(terrainFragmentShader.includes('float terrainMoisture(vec2 p)'));
});

/**
 * Enough of a WebGL2 context for three's WebGLRenderer to build, draw, resize
 * and dispose the scene without a browser. Anything the renderer only needs to
 * call is a recorded no-op; the numbers it reads have to be real.
 */
function createGlStub() {
  const calls: string[] = [];
  const shaderSources: string[] = [];
  const parameters: Record<string, unknown> = {
    VERSION: 'WebGL 2.0 (terrain test stub)',
    SHADING_LANGUAGE_VERSION: 'WebGL GLSL ES 3.00 (terrain test stub)',
    VENDOR: 'test',
    RENDERER: 'test',
    MAX_TEXTURE_IMAGE_UNITS: 16,
    MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 32,
    MAX_TEXTURE_SIZE: 4096,
    MAX_CUBE_MAP_TEXTURE_SIZE: 4096,
    MAX_VERTEX_ATTRIBS: 16,
    MAX_VERTEX_UNIFORM_VECTORS: 256,
    MAX_FRAGMENT_UNIFORM_VECTORS: 256,
    MAX_VARYING_VECTORS: 15,
    MAX_ARRAY_TEXTURE_LAYERS: 256,
    MAX_3D_TEXTURE_SIZE: 256,
    MAX_TEXTURE_MAX_ANISOTROPY_EXT: 16,
  };
  const names = new Map<string, number>();
  let nextConstant = 1000;
  const enumName = new Map<number, string>();
  const base: Record<string, unknown> = {
    getParameter: (name: unknown) =>
      typeof name === 'number' ? (parameters[enumName.get(name) ?? ''] ?? 4096) : (parameters[String(name)] ?? 4096),
    getShaderPrecisionFormat: () => ({ rangeMin: 127, rangeMax: 127, precision: 23 }),
    getContextAttributes: () => ({ alpha: false, antialias: false, depth: true, stencil: true }),
    getExtension: (name: string) =>
      name === 'WEBGL_lose_context' ? { loseContext: () => calls.push('loseContext') } : null,
    getShaderParameter: () => true,
    getProgramParameter: (_program: unknown, parameter: unknown) => {
      // LINK_STATUS is a boolean; the two count queries must be numbers.
      const key = enumName.get(parameter as number) ?? '';
      return key === 'ACTIVE_UNIFORMS' || key === 'ACTIVE_ATTRIBUTES' ? 0 : true;
    },
    getShaderInfoLog: () => '',
    getProgramInfoLog: () => '',
    createShader: () => ({ kind: 'shader' }),
    createProgram: () => ({ kind: 'program' }),
    createTexture: () => ({ kind: 'texture' }),
    createBuffer: () => ({ kind: 'buffer' }),
    createVertexArray: () => ({ kind: 'vertexArray' }),
    getUniformLocation: () => null,
    getAttribLocation: () => 0,
    shaderSource: (_shader: unknown, source: string) => shaderSources.push(source),
  };
  const gl = new Proxy(base, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (/^[A-Z][A-Z0-9_]*$/.test(key)) {
        let id = names.get(key);
        if (id === undefined) {
          id = nextConstant++;
          names.set(key, id);
          enumName.set(id, key);
        }
        return id;
      }
      return (...args: unknown[]) => {
        // The two-argument shaderSource call is captured above through the base.
        calls.push(key);
        return args.length === 0 ? undefined : undefined;
      };
    },
  });
  return { gl: gl as unknown as WebGL2RenderingContext, calls, shaderSources };
}

/** Container, canvas and globals the scene needs, with every listener recorded. */
function createDomStub(gl: WebGL2RenderingContext) {
  const children: unknown[] = [];
  const listeners: string[] = [];
  const contexts: Array<{ type: string; options: WebGLContextAttributes }> = [];
  const canvas = {
    width: 300,
    height: 150,
    style: {} as Record<string, string>,
    addEventListener: (name: string) => listeners.push(`add:${name}`),
    removeEventListener: (name: string) => listeners.push(`remove:${name}`),
    remove() {
      const index = children.indexOf(canvas);
      if (index >= 0) children.splice(index, 1);
    },
    getContext(type: string, options: WebGLContextAttributes) {
      contexts.push({ type, options });
      return gl;
    },
  };
  const container = {
    clientWidth: 1200,
    clientHeight: 700,
    children,
    append: (element: unknown) => children.push(element),
  } as unknown as HTMLElement;
  return {
    container,
    canvas,
    children,
    listeners,
    contexts,
    document: {
      createElement: (tag: string) => {
        assert.equal(tag, 'canvas');
        return canvas;
      },
      addEventListener: () => {
        throw new Error('the terrain scene must not register document listeners');
      },
    },
  };
}

type DomStub = ReturnType<typeof createDomStub>;

/** The scene may read `window.devicePixelRatio`; it may never listen or schedule. */
function useDom(dom: DomStub, deviceRatio = 2) {
  const globals = globalThis as Record<string, unknown>;
  const previous = {
    document: globals.document,
    window: globals.window,
    requestAnimationFrame: globals.requestAnimationFrame,
  };
  globals.document = dom.document;
  globals.window = {
    devicePixelRatio: deviceRatio,
    addEventListener: () => {
      throw new Error('the terrain scene must not register window listeners');
    },
  };
  globals.requestAnimationFrame = () => {
    throw new Error('the terrain scene must not schedule frames');
  };
  return () => {
    for (const [key, value] of Object.entries(previous)) globals[key] = value;
  };
}

function drawCount(calls: string[]) {
  return calls.filter((call) => call === 'drawElements' || call === 'drawArrays').length;
}

function mount(dom: DomStub, budget = fullBudget) {
  const scene = createScene(dom.container, budget, new AbortController().signal);
  assert.ok(!(scene instanceof Promise), 'the terrain factory is synchronous');
  return scene;
}

test('the scene builds one canvas per draw target and never schedules its own frames', () => {
  const stub = createGlStub();
  const dom = createDomStub(stub.gl);
  const restore = useDom(dom);
  try {
    const scene = mount(dom);
    assert.equal(scene.canvas, dom.canvas);
    assert.deepEqual(
      dom.contexts.map((entry) => entry.type),
      ['webgl2'],
    );
    // alpha: false because the scene draws its own sky; no second DPR pass.
    assert.equal(dom.contexts[0].options.alpha, false);
    assert.equal(dom.contexts[0].options.antialias, false);
    // Nothing is compiled before the first frame; three builds the programs lazily.
    assert.equal(stub.calls.filter((call) => call === 'compileShader').length, 0);
    scene.resize(1000, 600, 1);
    scene.frame(0, 0, { x: 0, y: 0, active: false, down: false, tap: false });
    // Three programs: terrain, water, sky. Two shaders each.
    assert.equal(stub.calls.filter((call) => call === 'linkProgram').length, 3);
    assert.equal(stub.calls.filter((call) => call === 'compileShader').length, 6);
    scene.frame(0.5, 0.016, { x: 0, y: 0, active: false, down: false, tap: false });
    assert.equal(stub.calls.filter((call) => call === 'linkProgram').length, 3, 'no per-frame recompile');
    // The only listeners are three's own context handlers on its canvas.
    assert.deepEqual(
      [...new Set(dom.listeners.filter((entry) => entry.startsWith('add:')))].sort(),
      ['add:webglcontextcreationerror', 'add:webglcontextlost', 'add:webglcontextrestored'],
    );
    scene.dispose();
  } finally {
    restore();
  }
});

test('every frame draws the three terrain layers, the water and the sky once', () => {
  const stub = createGlStub();
  const dom = createDomStub(stub.gl);
  const restore = useDom(dom);
  try {
    const scene = mount(dom);
    scene.resize(1000, 600, 1);
    const before = drawCount(stub.calls);
    scene.frame(0, 0, { x: 0, y: 0, active: false, down: false, tap: false });
    assert.equal(drawCount(stub.calls) - before, 5, 'near, mid, far, water, sky');
    scene.frame(1, 0.016, { x: 0.5, y: -0.5, active: true, down: false, tap: false });
    assert.equal(drawCount(stub.calls) - before, 10);
    // Broken input must not stop the scene drawing or throw.
    for (const seconds of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
      scene.frame(seconds, Number.NaN, { x: Number.NaN, y: Number.NaN, active: true, down: false, tap: false });
    }
    assert.equal(drawCount(stub.calls) - before, 25);
    scene.dispose();
  } finally {
    restore();
  }
});

test('the shaders the GPU receives carry the same shared height field', () => {
  const stub = createGlStub();
  const dom = createDomStub(stub.gl);
  const restore = useDom(dom);
  try {
    const scene = mount(dom);
    scene.resize(1000, 600, 1);
    scene.frame(0, 0, { x: 0, y: 0, active: false, down: false, tap: false });
    assert.equal(stub.shaderSources.length, 6);
    const heightField = 'float terrainHeight(vec2 xz)';
    const withField = stub.shaderSources.filter((source) => source.includes(heightField));
    // Terrain vertex, terrain fragment and water fragment all sample the field.
    assert.equal(withField.length, 3, `${withField.length} shaders sample the height field`);
    for (const source of withField) {
      assert.ok(source.includes('float terrainValleyAt(vec2 xz, vec2 p)'));
      assert.ok(source.includes('float vnoise(vec2 p)'), 'the vendored noise must travel with it');
    }
    // Every stage that samples it uses identical text, so the heights agree.
    const fieldBody = (source: string) => {
      const start = source.indexOf('float terrainChannel(vec2 p)');
      const end = source.indexOf('float terrainHeight(vec2 xz)');
      return source.slice(start, source.indexOf('\n}', end) + 2);
    };
    const bodies = new Set(withField.map(fieldBody));
    assert.equal(bodies.size, 1, 'the height field must not drift between stages');
    const body = bodies.values().next().value!;
    // The floor terrace can never reach terrainHeightRef, so the bed stays under
    // water however the valley blends; the mountains carry the fBM trend plus
    // the crest-shaped ridge; and the fjord centre line is the same two fixed
    // sine terms the CPU reference uses, since those coefficients live only here.
    assert.ok(body.includes('base * 0.10 + 0.10'), 'the floor terrace');
    assert.ok(body.includes('0.30 + base * 0.32 + ridge * 0.44'), 'the mountain blend');
    assert.ok(body.includes('pow(terrainRidged3(q * 1.05 + vec2(31.4, 27.2)), 1.5)'), 'the ridge');
    assert.ok(
      body.includes('450.0 * sin(xz.y / 2200.0) + 200.0 * sin(xz.y / 4300.0 + 0.5)'),
      'the fjord centre line',
    );
    // The two shaders that do not sample it are the sky and the water surface
    // vertex stage, which is a flat quad.
    const without = stub.shaderSources.filter((source) => !source.includes(heightField));
    assert.equal(without.length, 3);
    scene.dispose();
  } finally {
    restore();
  }
});

test('resize keeps the drawing buffer inside the budget at every scale', () => {
  const stub = createGlStub();
  const dom = createDomStub(stub.gl);
  const restore = useDom(dom);
  try {
    const scene = mount(dom, { ...fullBudget, maxPixels: 1_200_000, maxDpr: 1.5 });
    scene.resize(1000, 600, 1);
    const full = dom.canvas.width * dom.canvas.height;
    assert.ok(full > 0 && full <= 1_200_000, `${dom.canvas.width}x${dom.canvas.height}`);
    // The canvas holds real drawing-buffer pixels, floored to whole pixels.
    assert.ok(Math.abs(dom.canvas.width - 1000 * Math.sqrt(1_200_000 / 600_000)) <= 1);
    scene.resize(1000, 600, 0.8);
    const reduced = dom.canvas.width * dom.canvas.height;
    assert.ok(reduced < full, 'the slow-frame ladder must really lose pixels');
    // A small canvas is where the DPR cap binds instead of the pixel budget.
    scene.resize(400, 300, 1);
    assert.ok(Math.abs(dom.canvas.width / 400 - 1.5) < 1e-9);
    scene.resize(0, 0, 1);
    assert.ok(dom.canvas.width >= 1 && dom.canvas.height >= 1);
    scene.dispose();
    restore();

    const lightStub = createGlStub();
    const lightDom = createDomStub(lightStub.gl);
    const restoreLight = useDom(lightDom, 3);
    try {
      const light = mount(lightDom, { ...lightBudget, maxPixels: 450_000, maxDpr: 1 });
      light.resize(400, 300, 1);
      assert.ok(Math.abs(lightDom.canvas.width / 400 - 1) < 1e-9, 'the light tier caps DPR at 1');
      light.resize(2000, 1200, 1);
      assert.ok(lightDom.canvas.width * lightDom.canvas.height <= 450_000);
      light.dispose();
    } finally {
      restoreLight();
    }
  } finally {
    restore();
  }
});

test('dispose is idempotent, drops the context once and leaves the stage empty', () => {
  const stub = createGlStub();
  const dom = createDomStub(stub.gl);
  const restore = useDom(dom);
  try {
    const scene = mount(dom);
    scene.resize(800, 600, 1);
    scene.frame(0, 0, { x: 0, y: 0, active: false, down: false, tap: false });
    scene.dispose();
    scene.dispose();
    assert.deepEqual(dom.children, []);
    assert.equal(stub.calls.filter((call) => call === 'loseContext').length, 1);
    // Every program and geometry buffer went back to the driver.
    assert.equal(stub.calls.filter((call) => call === 'deleteProgram').length, 3);
    assert.ok(stub.calls.filter((call) => call === 'deleteBuffer').length >= 4);
    assert.deepEqual(dom.listeners.filter((entry) => entry.startsWith('remove:')).sort(), [
      'remove:webglcontextcreationerror',
      'remove:webglcontextlost',
      'remove:webglcontextrestored',
    ]);
    const after = stub.calls.length;
    scene.frame(5, 0.1, { x: 0, y: 0, active: false, down: false, tap: false });
    scene.resize(900, 700, 1);
    assert.equal(stub.calls.length, after, 'a disposed scene must do no more work');
  } finally {
    restore();
  }
});

test('an aborted signal opens no surface, before or during the build', () => {
  const stub = createGlStub();
  const dom = createDomStub(stub.gl);
  let restore = useDom(dom);
  try {
    const controller = new AbortController();
    controller.abort();
    assert.throws(() => createScene(dom.container, fullBudget, controller.signal), /aborted/);
    assert.deepEqual(dom.children, []);
    assert.deepEqual(dom.contexts, [], 'a cancelled scene must not open a context');
    assert.equal(stub.calls.length, 0);
  } finally {
    restore();
  }

  // An abort that lands while the build runs still leaves the canvas removed.
  const late = new AbortController();
  const lateStub = createGlStub();
  const lateDom = createDomStub(lateStub.gl);
  restore = useDom(lateDom);
  try {
    const originalCreateElement = lateDom.document.createElement;
    lateDom.document.createElement = (tag: string) => {
      const element = originalCreateElement(tag);
      late.abort();
      return element;
    };
    assert.throws(() => createScene(lateDom.container, fullBudget, late.signal), /aborted/);
    assert.deepEqual(lateDom.children, []);
    assert.equal(lateStub.calls.filter((call) => call === 'loseContext').length, 1);
  } finally {
    restore();
  }
});
