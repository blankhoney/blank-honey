import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BufferGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  Light,
  Material,
  Mesh,
  ShaderMaterial,
  Texture,
  WebGLRenderTarget,
} from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createFlockLandscape } from '../src/client/flock-landscape';
import { reflectionLayer } from '../src/client/flock-water';

// CPU-only contracts: shader compilation, actual draw calls and GPU release are browser checks.
function inspect(root: Group) {
  const meshes: Mesh[] = [];
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const dataTextures = new Set<DataTexture>();
  const targets = new Set<WebGLRenderTarget>();
  const instances = new Set<InstancedMesh>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshes.push(object);
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      if (material instanceof ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
          if (uniform.value instanceof DataTexture) dataTextures.add(uniform.value);
        }
      }
    }
    if (object instanceof Reflector) targets.add(object.getRenderTarget());
    if (object instanceof InstancedMesh) instances.add(object);
  });
  const lake = root.getObjectByName('flock-lake');
  assert.ok(lake instanceof Reflector);
  assert.ok(lake.material instanceof ShaderMaterial);
  const lakeMesh = lake as Reflector & { material: ShaderMaterial };
  const mist = meshes.filter((mesh) => mesh.name.startsWith('flock-mist-'));
  assert.ok(mist.length > 0);
  const mistMaterial = mist[0].material;
  assert.ok(mistMaterial instanceof ShaderMaterial);
  return {
    meshes,
    geometries,
    materials,
    dataTextures,
    targets,
    instances,
    lake: lakeMesh,
    mist,
    mistMaterial,
  };
}

function watchDisposal(resource: {
  addEventListener: (type: 'dispose', listener: () => void) => void;
}) {
  let count = 0;
  resource.addEventListener('dispose', () => {
    count++;
  });
  return () => count;
}

for (const light of [false, true]) {
  const label = light ? 'light' : 'full';

  test(`${label} landscape constructs without DOM or WebGL and keeps geometry, mesh and reflection-layer budgets`, (t) => {
    assert.equal(typeof document, 'undefined');
    const landscape = createFlockLandscape(light);
    try {
      const { meshes, lake, mist } = inspect(landscape.root);
      let triangles = 0;
      let visibleMeshes = 0;
      landscape.root.traverseVisible((object) => {
        if (!(object instanceof Mesh)) return;
        visibleMeshes++;
        const vertices =
          object.geometry.index?.count ?? object.geometry.getAttribute('position').count;
        triangles += (vertices / 3) * (object instanceof InstancedMesh ? object.count : 1);
      });
      assert.ok(triangles > 0 && triangles <= (light ? 35_000 : 100_000));
      assert.ok(visibleMeshes > 0 && visibleMeshes <= (light ? 11 : 19));
      t.diagnostic(
        `${label}: ${visibleMeshes} visible mesh objects, ${triangles} instanced triangles`,
      );
      const staticNames = new Set(['flock-sky', 'flock-mountains', 'flock-trees', 'flock-rocks']);
      const reflectedNames = new Set<string>();
      let reflectedLights = 0;
      landscape.root.traverse((object) => {
        if (!(object.layers.mask & (1 << reflectionLayer))) return;
        if (object instanceof Light) {
          reflectedLights++;
          return;
        }
        assert.ok(object instanceof Mesh);
        assert.ok(
          staticNames.has(object.name),
          `${object.name} must not enter the static reflection`,
        );
        reflectedNames.add(object.name);
      });
      assert.deepEqual(reflectedNames, staticNames);
      assert.ok(reflectedLights > 0);
      assert.equal(lake.layers.mask & (1 << reflectionLayer), 0);
      for (const mesh of mist) assert.equal(mesh.layers.mask & (1 << reflectionLayer), 0);
      assert.equal(meshes.length, visibleMeshes);
    } finally {
      landscape.dispose();
    }
  });

  test(`${label} landscape animates water and shared mist time without replacing scenery resources`, () => {
    const landscape = createFlockLandscape(light);
    try {
      const resources = inspect(landscape.root);
      const { lake, mist, mistMaterial } = resources;
      assert.equal(new Set(mist.map((mesh) => mesh.geometry)).size, 1);
      assert.equal(new Set(mist.map((mesh) => mesh.material)).size, 1);
      const noise = mistMaterial.uniforms.noiseMap.value;
      assert.ok(noise instanceof DataTexture);
      assert.ok(noise.image.width > 0 && noise.image.width <= 128);
      assert.ok(noise.image.height > 0 && noise.image.height <= 128);
      assert.equal(resources.dataTextures.size, 1);
      assert.equal(mistMaterial.depthWrite, false);
      landscape.update(0);
      landscape.root.updateMatrixWorld(true);
      const fogPositions = mist.map((mesh) => mesh.position.toArray());
      const staticStates = resources.meshes
        .filter((mesh) => ['flock-mountains', 'flock-trees', 'flock-rocks'].includes(mesh.name))
        .map((mesh) => ({
          mesh,
          matrix: mesh.matrix.toArray(),
          world: mesh.matrixWorld.toArray(),
          instances:
            mesh instanceof InstancedMesh ? Array.from(mesh.instanceMatrix.array) : undefined,
          instanceArray: mesh instanceof InstancedMesh ? mesh.instanceMatrix.array : undefined,
        }));
      const geometryStates = [...resources.geometries].map((geometry) => ({
        geometry,
        index: geometry.index?.array,
        attributes: Object.entries(geometry.attributes).map(
          ([name, attribute]) => [name, attribute.array] as const,
        ),
      }));
      const meshStates = resources.meshes.map((mesh) => ({
        mesh,
        geometry: mesh.geometry,
        material: mesh.material,
      }));
      const textureStates = [...resources.materials].flatMap((material) =>
        material instanceof ShaderMaterial
          ? Object.entries(material.uniforms)
              .filter(([, uniform]) => uniform.value instanceof Texture)
              .map(([name, uniform]) => ({ material, name, texture: uniform.value }))
          : [],
      );
      const target = lake.getRenderTarget();
      landscape.update(5);
      landscape.invalidateReflection();
      landscape.root.updateMatrixWorld(true);
      assert.equal(lake.material.uniforms.time.value, 5);
      assert.equal(mistMaterial.uniforms.time.value, 5);
      assert.ok(
        mist.some((mesh, index) =>
          mesh.position.toArray().some((value, axis) => value !== fogPositions[index][axis]),
        ),
      );
      for (const mesh of mist) {
        assert.equal(mesh.material, mistMaterial);
        assert.equal(mistMaterial.uniforms.noiseMap.value, noise);
      }
      for (const state of staticStates) {
        assert.deepEqual(state.mesh.matrix.toArray(), state.matrix);
        assert.deepEqual(state.mesh.matrixWorld.toArray(), state.world);
        if (state.mesh instanceof InstancedMesh) {
          assert.equal(state.mesh.instanceMatrix.array, state.instanceArray);
          assert.deepEqual(Array.from(state.mesh.instanceMatrix.array), state.instances);
        }
      }
      for (const state of geometryStates) {
        assert.equal(state.geometry.index?.array, state.index);
        for (const [name, array] of state.attributes)
          assert.equal(state.geometry.getAttribute(name).array, array);
      }
      for (const state of meshStates) {
        assert.equal(state.mesh.geometry, state.geometry);
        assert.equal(state.mesh.material, state.material);
      }
      for (const state of textureStates)
        assert.equal(state.material.uniforms[state.name].value, state.texture);
      assert.equal(lake.getRenderTarget(), target);
    } finally {
      landscape.dispose();
    }
  });

  test(`${label} landscape releases every distinct owned resource once and cannot revive after disposal`, () => {
    const landscape = createFlockLandscape(light);
    const parent = new Group();
    parent.add(landscape.root);
    const resources = inspect(landscape.root);
    const owned = [
      ...resources.geometries,
      ...resources.materials,
      ...resources.dataTextures,
      ...resources.targets,
      ...resources.instances,
    ];
    const counts = owned.map(watchDisposal);
    assert.ok(resources.geometries.size > 0);
    assert.ok(resources.materials.size > 0);
    assert.equal(resources.dataTextures.size, 1);
    assert.equal(resources.targets.size, 1);
    assert.equal(resources.instances.size, 2);
    try {
      landscape.update(5);
      const positions = resources.mist.map((mesh) => mesh.position.toArray());
      landscape.dispose();
      landscape.dispose();
      assert.equal(landscape.root.parent, null);
      assert.equal(parent.children.length, 0);
      assert.equal(landscape.root.children.length, 0);
      for (const count of counts) assert.equal(count(), 1);
      landscape.update(99);
      landscape.invalidateReflection();
      assert.equal(resources.lake.material.uniforms.time.value, 5);
      assert.equal(resources.mistMaterial.uniforms.time.value, 5);
      assert.deepEqual(
        resources.mist.map((mesh) => mesh.position.toArray()),
        positions,
      );
      assert.equal(landscape.root.children.length, 0);
      for (const count of counts) assert.equal(count(), 1);
    } finally {
      landscape.dispose();
    }
  });
}

test('disposing one landscape does not dispose or freeze another instance', () => {
  const first = createFlockLandscape(false);
  const second = createFlockLandscape(true);
  try {
    const a = inspect(first.root);
    const b = inspect(second.root);
    assert.notEqual(a.mistMaterial, b.mistMaterial);
    assert.notEqual(a.mist[0].geometry, b.mist[0].geometry);
    assert.notEqual(a.mistMaterial.uniforms.noiseMap.value, b.mistMaterial.uniforms.noiseMap.value);
    assert.notEqual(a.lake.getRenderTarget(), b.lake.getRenderTarget());
    const stillOwned = [
      ...b.geometries,
      ...b.materials,
      ...b.dataTextures,
      ...b.targets,
      ...b.instances,
    ].map(watchDisposal);
    first.update(2);
    second.update(3);
    const before = b.mist.map((mesh) => mesh.position.toArray());
    first.dispose();
    second.update(8);
    second.invalidateReflection();
    assert.equal(first.root.children.length, 0);
    assert.ok(second.root.children.length > 0);
    assert.equal(b.lake.material.uniforms.time.value, 8);
    assert.equal(b.mistMaterial.uniforms.time.value, 8);
    assert.ok(
      b.mist.some((mesh, index) =>
        mesh.position.toArray().some((value, axis) => value !== before[index][axis]),
      ),
    );
    for (const count of stillOwned) assert.equal(count(), 0);
    second.dispose();
    for (const count of stillOwned) assert.equal(count(), 1);
  } finally {
    first.dispose();
    second.dispose();
  }
});
