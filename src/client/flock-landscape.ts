import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  DodecahedronGeometry,
  Group,
  HemisphereLight,
  InstancedMesh,
  LinearFilter,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTerrainGeometry, sceneryInstances, terrainNoise } from './flock-terrain';
import { createLake, reflectionLayer } from './flock-water';
import { report } from './log';

export const landscapeFogColor = '#bfc9c3';

function createTreeGeometry() {
  const trunk = new CylinderGeometry(0.045, 0.065, 0.5, 5).translate(0, 0.25, 0);
  const lower = new ConeGeometry(0.38, 1.05, 7).translate(0, 0.82, 0);
  const upper = new ConeGeometry(0.26, 0.95, 7).translate(0, 1.32, 0);
  const parts = [trunk, lower, upper];
  try {
    for (const [index, part] of parts.entries()) {
      const color = new Color(index === 0 ? '#635b4f' : index === 1 ? '#344a40' : '#536459');
      const colors = new Float32Array(part.getAttribute('position').count * 3);
      for (let vertex = 0; vertex < colors.length; vertex += 3)
        colors.set([color.r, color.g, color.b], vertex);
      part.setAttribute('color', new BufferAttribute(colors, 3));
    }
    const geometry = mergeGeometries(parts);
    if (!geometry) throw new Error('Could not assemble the shared tree geometry');
    return geometry;
  } finally {
    for (const part of parts) part.dispose();
  }
}

function createMistTexture() {
  const size = 128;
  const bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Periodic sampling makes RepeatWrapping seamless without a downloaded texture.
      const angleX = (x / size) * Math.PI * 2;
      const angleY = (y / size) * Math.PI * 2;
      const u = Math.cos(angleX) * 2 + Math.sin(angleY);
      const v = Math.sin(angleX) * 2 + Math.cos(angleY);
      const noise = terrainNoise(u, v) * 0.65 + terrainNoise(u * 3, v * 3) * 0.35;
      const index = (y * size + x) * 4;
      bytes[index] = bytes[index + 1] = bytes[index + 2] = Math.round(noise * 255);
      bytes[index + 3] = 255;
    }
  }
  const texture = new DataTexture(bytes, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Scene-local ownership only: the hero remains the sole clock and event owner. */
export function createFlockLandscape(light: boolean) {
  const root = new Group();
  root.name = 'flock-landscape';
  const releases: Array<() => void> = [];
  let disposed = false;
  function own<T extends { dispose: () => void }>(resource: T): T {
    releases.push(() => resource.dispose());
    return resource;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    root.removeFromParent();
    for (const release of releases.reverse()) {
      try {
        release();
      } catch (error) {
        report('flock-landscape:dispose', error);
      }
    }
    root.clear();
  }
  function scenery<T extends Object3D>(object: T) {
    object.layers.enable(reflectionLayer);
    root.add(object);
    return object;
  }
  try {
    const skyGeometry = own(new SphereGeometry(17000, 24, 12));
    const skyMaterial = own(
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        uniforms: {
          zenith: { value: new Color('#91a4aa') },
          horizon: { value: new Color('#dddcd0') },
          sunDirection: { value: new Vector3(-0.18, 0.12, -1).normalize() },
        },
        vertexShader: `
        varying vec3 direction;
        void main() {
          direction = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
        fragmentShader: `
        uniform vec3 zenith;
        uniform vec3 horizon;
        uniform vec3 sunDirection;
        varying vec3 direction;
        void main() {
          vec3 d = normalize(direction);
          float height = smoothstep(-0.03, 0.42, d.y);
          vec3 sky = mix(horizon, zenith, height);
          float sun = max(0.0, dot(d, sunDirection));
          sky += vec3(0.18, 0.14, 0.10) * pow(sun, 18.0);
          sky = mix(sky, vec3(1.15, 1.08, 0.94), smoothstep(0.99982, 0.99995, sun));
          gl_FragColor = vec4(sky, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      }),
    );
    const sky = scenery(new Mesh(skyGeometry, skyMaterial));
    sky.name = 'flock-sky';
    sky.renderOrder = -2;
    sky.frustumCulled = false;
    scenery(new HemisphereLight('#dbe2de', '#646f66', 1.75));
    const sun = scenery(new DirectionalLight('#f8ead4', 1.7));
    sun.position.set(-3000, 4500, -5000);

    const terrain = scenery(
      new Mesh(
        own(createTerrainGeometry(light)),
        own(new MeshLambertMaterial({ vertexColors: true, flatShading: true })),
      ),
    );
    terrain.name = 'flock-mountains';
    const transform = new Object3D();
    function instances(geometry: BufferGeometry, material: MeshLambertMaterial, rocks: boolean) {
      const points = sceneryInstances(light, rocks);
      const mesh = own(new InstancedMesh(geometry, material, points.length));
      mesh.name = rocks ? 'flock-rocks' : 'flock-trees';
      for (const [index, point] of points.entries()) {
        transform.position.set(point.x, point.y + (rocks ? point.size * 0.15 : -2), point.z);
        transform.rotation.set(rocks ? 0.2 : 0, point.rotation, rocks ? 0.1 : 0);
        transform.scale.set(point.size, point.size * (rocks ? 0.65 : 1), point.size);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      scenery(mesh);
    }
    instances(
      own(createTreeGeometry()),
      own(new MeshLambertMaterial({ vertexColors: true, flatShading: true })),
      false,
    );
    instances(
      own(new DodecahedronGeometry(1, 0)),
      own(new MeshLambertMaterial({ color: '#78827a', flatShading: true })),
      true,
    );

    const lake = own(createLake(light));
    root.add(lake.mesh);
    const mistTexture = own(createMistTexture());
    const mistMaterial = own(
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          time: { value: 0 },
          noiseMap: { value: mistTexture },
          color: { value: new Color('#d8ded6') },
        },
        vertexShader: `
        varying vec2 texcoord;
        varying float altitude;
        void main() {
          texcoord = uv;
          altitude = (modelMatrix * vec4(position, 1.0)).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
        fragmentShader: `
        uniform sampler2D noiseMap;
        uniform float time;
        uniform vec3 color;
        varying vec2 texcoord;
        varying float altitude;
        void main() {
          vec2 uv = texcoord;
          float a = texture2D(noiseMap, uv * vec2(1.5, 0.65) + vec2(time * 0.018, time * 0.002)).r;
          float b = texture2D(noiseMap, uv * vec2(2.2, 1.1) - vec2(time * 0.011, 0.0)).r;
          float edge = smoothstep(0.0, 0.24, uv.x) * smoothstep(0.0, 0.24, 1.0 - uv.x);
          edge *= smoothstep(0.0, 0.38, uv.y) * smoothstep(0.0, 0.4, 1.0 - uv.y);
          edge *= smoothstep(0.0, 130.0, altitude);
          float density = smoothstep(0.12, 0.9, a * 0.7 + b * 0.3);
          gl_FragColor = vec4(color, edge * density * 0.32);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      }),
    );
    const mistGeometry = own(new PlaneGeometry(1, 1));
    const fogLayout = [
      [0, 240, -7000, 7200, 650],
      [-1450, 210, -4300, 3400, 580],
      [1750, 180, -3000, 3800, 520],
      [0, 60, -2100, 3500, 250],
      [-1400, 130, -1600, 2600, 440],
      [1700, 120, -850, 2700, 400],
      [-1400, 110, -400, 1800, 330],
      [1100, 55, 200, 1300, 220],
    ];
    const mist = fogLayout
      .filter((_, index) => !light || index % 2 === 0)
      .map(([x, y, z, width, height], index) => {
        const mesh = new Mesh(mistGeometry, mistMaterial);
        mesh.name = `flock-mist-${index}`;
        mesh.position.set(x, y, z);
        mesh.scale.set(width, height, 1);
        root.add(mesh);
        return { mesh, x };
      });
    return {
      root,
      update(seconds: number) {
        if (disposed) return;
        lake.update(seconds);
        mistMaterial.uniforms.time.value = seconds;
        for (let index = 0; index < mist.length; index++) {
          mist[index].mesh.position.x = mist[index].x + Math.sin(seconds * 0.035 + index) * 75;
        }
      },
      invalidateReflection() {
        if (!disposed) lake.invalidate();
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
