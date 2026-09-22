// Fixed three-layer geometry LOD for the terrain scene: one inner square and
// two nested square rings around the fixed viewing area. Every layer samples
// the same world-space height field in ./height.ts on the GPU, so their shared
// boundary vertices land on identical heights; on top of that each layer drops
// a vertical skirt below every boundary loop, which hides the T-junction gaps
// that remain between a coarse edge and the finer edge it meets.
import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three';
import { terrainHeightCeiling, terrainHeightFloor, terrainViewHalf } from './height';

/**
 * How far the skirt walls drop below their surface edge, in world units. The
 * seam measured between neighbouring LOD layers stays below this depth, so the
 * wall always spans the gap.
 */
export const terrainSkirtDepth = 200;

export type TerrainLayerPlan = {
  id: 'near' | 'mid' | 'far';
  /** Half extent of the hole in the middle. 0 for the innermost layer. */
  innerHalf: number;
  /** Half extent of the layer's outer edge. */
  outerHalf: number;
  /** Grid cells across the layer's full 2 * outerHalf span. */
  resolution: number;
};

/**
 * Inner square of 128 cells plus two rings whose cell size doubles per step
 * (the mid and far grids span three and five times the inner half extent). The
 * light path halves the inner grid; the two outer resolutions follow it so the
 * 1 : 2 : 4 cell ladder is identical on both paths. Each layer's hole edge
 * falls exactly on the previous layer's outer edge, and each outer resolution
 * is a multiple of 3 or 5 so that stays true.
 */
export function terrainLodPlan(light: boolean): TerrainLayerPlan[] {
  const near = light ? 64 : 128;
  return [
    { id: 'near', innerHalf: 0, outerHalf: terrainViewHalf, resolution: near },
    { id: 'mid', innerHalf: terrainViewHalf, outerHalf: terrainViewHalf * 3, resolution: (near * 3) / 2 },
    { id: 'far', innerHalf: terrainViewHalf * 3, outerHalf: terrainViewHalf * 5, resolution: (near * 5) / 4 },
  ];
}

/** Boundary loop of the outer grid square, in walk order. */
function outerLoop(cells: number) {
  const loop: Array<[number, number]> = [];
  for (let i = 0; i < cells; i++) loop.push([i, 0]);
  for (let j = 0; j < cells; j++) loop.push([cells, j]);
  for (let i = cells; i > 0; i--) loop.push([i, cells]);
  for (let j = cells; j > 0; j--) loop.push([0, j]);
  return loop;
}

/**
 * Build one layer: a grid over [-outerHalf, outerHalf] with the middle square
 * removed when the layer is a ring, plus a skirt along every boundary loop.
 * Vertices carry y = 0: the vertex shader computes the height from world XZ.
 */
export function createTerrainLayerGeometry(plan: TerrainLayerPlan) {
  const { resolution, innerHalf, outerHalf } = plan;
  const stride = resolution + 1;
  const step = (outerHalf * 2) / resolution;
  const hasHole = innerHalf > 0;
  // Cells between the grid edge and the hole: exact because the hole edge is
  // deliberately placed on the previous layer's outer edge.
  const holeLow = hasHole ? Math.round((outerHalf - innerHalf) / step) : 0;
  const holeHigh = hasHole ? resolution - holeLow : 0;
  if (hasHole && holeLow * step !== outerHalf - innerHalf) {
    throw new RangeError(`Layer ${plan.id} hole does not land on a grid line`);
  }

  const positions: number[] = [];
  const skirts: number[] = [];
  const indices: number[] = [];
  const lookup = new Map<number, number>();

  function surfaceVertex(column: number, row: number) {
    const key = row * stride + column;
    const existing = lookup.get(key);
    if (existing !== undefined) return existing;
    const id = positions.length / 3;
    positions.push(-outerHalf + column * step, 0, -outerHalf + row * step);
    skirts.push(0);
    lookup.set(key, id);
    return id;
  }

  for (let row = 0; row < resolution; row++) {
    for (let column = 0; column < resolution; column++) {
      const inHole =
        hasHole && column >= holeLow && column < holeHigh && row >= holeLow && row < holeHigh;
      if (inHole) continue;
      const a = surfaceVertex(column, row);
      const b = surfaceVertex(column + 1, row);
      const c = surfaceVertex(column, row + 1);
      const d = surfaceVertex(column + 1, row + 1);
      indices.push(a, c, b, b, c, d);
    }
  }

  function skirtLoop(loop: Array<[number, number]>) {
    const ring = loop.map(([column, row]) => {
      const surface = surfaceVertex(column, row);
      const dropped = positions.length / 3;
      // The dropped vertex shares its XZ and its height with the surface edge,
      // so the wall is shaded exactly like the ground it hides.
      positions.push(positions[surface * 3], positions[surface * 3 + 1], positions[surface * 3 + 2]);
      skirts.push(1);
      return { surface, dropped };
    });
    for (let index = 0; index < ring.length; index++) {
      const current = ring[index];
      const next = ring[(index + 1) % ring.length];
      indices.push(
        current.surface,
        current.dropped,
        next.surface,
        next.surface,
        current.dropped,
        next.dropped,
      );
    }
  }

  skirtLoop(outerLoop(resolution));
  if (hasHole) {
    const loop: Array<[number, number]> = [];
    for (let column = holeLow; column < holeHigh; column++) loop.push([column, holeLow]);
    for (let row = holeLow; row < holeHigh; row++) loop.push([holeHigh, row]);
    for (let column = holeHigh; column > holeLow; column--) loop.push([column, holeHigh]);
    for (let row = holeHigh; row > holeLow; row--) loop.push([holeLow, row]);
    skirtLoop(loop);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('aSkirt', new BufferAttribute(new Float32Array(skirts), 1));
  geometry.setIndex(
    new BufferAttribute(
      positions.length / 3 < 65536 ? new Uint16Array(indices) : new Uint32Array(indices),
      1,
    ),
  );
  // The GPU displaces every vertex, so the default bounds (all y = 0) would be
  // wrong for culling. Cover the displaced layer and its skirt instead.
  const yMax = terrainHeightCeiling;
  const yMin = terrainHeightFloor - terrainSkirtDepth;
  geometry.boundingSphere = new Sphere(
    new Vector3(0, (yMax + yMin) / 2, 0),
    Math.hypot(Math.SQRT2 * outerHalf, (yMax - yMin) / 2) * 1.02,
  );
  return geometry;
}
