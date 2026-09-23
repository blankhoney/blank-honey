import { BufferAttribute, BufferGeometry, Color } from 'three';

export const terrainBounds = { minX: -6000, maxX: 6000, minZ: -11000, maxZ: 1400 };
export const scenerySeed = 72419;

export function seededRandom(seed = scenerySeed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hash(x: number, z: number) {
  let n = Math.imul(x, 374761393) + Math.imul(z, 668265263) + scenerySeed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function terrainNoise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u;
  const b = hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u;
  return a * (1 - v) + b * v;
}

export function shoreAt(z: number) {
  return 1200 + 170 * Math.sin(z * 0.00085) + 90 * Math.sin(z * 0.002 + 1.2);
}

const peaks = [
  [-3100, -2600, 1850, 1900, 2600],
  [-4500, -4300, 2750, 2500, 3000],
  [-3000, -6600, 2050, 2100, 2900],
  [3500, -3400, 2350, 2100, 2700],
  [4900, -6000, 2700, 2500, 3200],
  [2700, -7800, 1700, 1900, 2500],
  [-1400, -10400, 1300, 2300, 2000],
  [1500, -11300, 1600, 2700, 2100],
];

function heightAt(x: number, z: number) {
  const bank = Math.abs(x) - shoreAt(z) - (x > 0 ? 180 : 0);
  if (bank < 0 && z > -8400) return -55;
  const rise = Math.min(1, Math.max(0, bank / 900));
  const back = Math.max(0, Math.min(1, (-z - 8400) / 2400));
  const edge = Math.max(rise, back);
  let summit = 0;
  for (const [px, pz, height, rx, rz] of peaks) {
    const ridge = Math.max(0, 1 - Math.hypot((x - px) / rx, (z - pz) / rz));
    summit = Math.max(summit, height * Math.pow(ridge, 1.25));
  }
  const detail = terrainNoise(x * 0.0014, z * 0.0014);
  const low = edge * (150 + detail * 270);
  const crags = terrainNoise(x * 0.0035, z * 0.0035);
  const height = -30 + low + summit * edge * (0.72 + detail * 0.16 + crags * 0.25);
  // Small terraces on the banks, broad unquantized silhouettes on the summits.
  return height < 250 ? Math.floor(height / 18) * 18 : height;
}

export function terrainGrid(light: boolean) {
  return light ? { columns: 48, rows: 64 } : { columns: 80, rows: 112 };
}

/** Interpolate the exact triangle used by the terrain, not a different noise surface. */
export function sampleTerrain(x: number, z: number, light: boolean) {
  const { columns, rows } = terrainGrid(light);
  const { minX, maxX, minZ, maxZ } = terrainBounds;
  const gx = Math.max(0, Math.min(columns - 0.000001, ((x - minX) / (maxX - minX)) * columns));
  const gz = Math.max(0, Math.min(rows - 0.000001, ((z - minZ) / (maxZ - minZ)) * rows));
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const u = gx - ix;
  const v = gz - iz;
  const x0 = minX + ((maxX - minX) * ix) / columns;
  const z0 = minZ + ((maxZ - minZ) * iz) / rows;
  const x1 = x0 + (maxX - minX) / columns;
  const z1 = z0 + (maxZ - minZ) / rows;
  const a = heightAt(x0, z0);
  const b = heightAt(x1, z0);
  const c = heightAt(x0, z1);
  const d = heightAt(x1, z1);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}

export function createTerrainGeometry(light: boolean) {
  const { columns, rows } = terrainGrid(light);
  const { minX, maxX, minZ, maxZ } = terrainBounds;
  const positions = new Float32Array(columns * rows * 18);
  const colors = new Float32Array(positions.length);
  const green = new Color('#4c625c');
  const rock = new Color('#808b8b');
  const snow = new Color('#d2d9d4');
  const color = new Color();
  const stride = columns + 1;
  const gridPositions = new Float32Array(stride * (rows + 1) * 3);
  const gridColors = new Float32Array(gridPositions.length);
  // Sample noise once per grid point, not six times for its flat-shaded triangle copies.
  for (let row = 0; row <= rows; row++) {
    const z = minZ + ((maxZ - minZ) * row) / rows;
    for (let column = 0; column <= columns; column++) {
      const x = minX + ((maxX - minX) * column) / columns;
      const y = heightAt(x, z);
      const index = (row * stride + column) * 3;
      gridPositions[index] = x;
      gridPositions[index + 1] = y;
      gridPositions[index + 2] = z;
      const noise = terrainNoise(x * 0.002, z * 0.002);
      color.copy(green).lerp(rock, Math.min(1, Math.max(0, (y - 160) / 700)));
      color.lerp(snow, Math.max(0, Math.min(1, (y - 1450 - noise * 300) / 450)));
      color.multiplyScalar(0.8 + noise * 0.25);
      gridColors[index] = color.r;
      gridColors[index + 1] = color.g;
      gridColors[index + 2] = color.b;
    }
  }
  let index = 0;
  function vertex(point: number) {
    for (let component = 0; component < 3; component++) {
      positions[index] = gridPositions[point * 3 + component];
      colors[index] = gridColors[point * 3 + component];
      index++;
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const point = row * stride + column;
      vertex(point);
      vertex(point + stride);
      vertex(point + 1);
      vertex(point + 1);
      vertex(point + stride);
      vertex(point + stride + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export type SceneryInstance = { x: number; y: number; z: number; size: number; rotation: number };

export function sceneryInstances(light: boolean, rocks = false): SceneryInstance[] {
  const random = seededRandom(scenerySeed + (rocks ? 17 : 0));
  const count = rocks ? (light ? 30 : 60) : light ? 75 : 180;
  const instances: SceneryInstance[] = [];
  for (let attempt = 0; instances.length < count && attempt < count * 12; attempt++) {
    const z = 850 - random() * (rocks ? 5500 : 8200);
    const sign = random() < 0.5 ? -1 : 1;
    const x = sign * (shoreAt(z) + (sign > 0 ? 180 : 0) + 90 + random() * (rocks ? 250 : 900));
    const y = sampleTerrain(x, z, light);
    if (y < 8 || y > (rocks ? 400 : 1250)) continue;
    instances.push({
      x,
      y,
      z,
      size: (rocks ? 28 : 36) + random() * (rocks ? 45 : 62),
      rotation: random() * Math.PI * 2,
    });
  }
  return instances;
}
