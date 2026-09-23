import { Color, Matrix4, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// Reflection projection/clipping/disposal: Three 0.186.0 Reflector (MIT).
// Fresnel and sun-lighting treatment follows the same version's Water example.
export const reflectionLayer = 1;
export const lakeWaves = [
  { x: 0.88, z: 0.47, amplitude: 4.2, frequency: 0.0101, speed: 0.7 },
  { x: -0.35, z: 0.94, amplitude: 2.1, frequency: 0.0224, speed: 1.02 },
  { x: 0.3, z: -0.95, amplitude: 0.8, frequency: 0.0419, speed: 1.43 },
] as const;

export function sampleLakeWave(x: number, z: number, seconds: number) {
  let height = 0;
  for (const wave of lakeWaves) {
    height +=
      wave.amplitude * Math.sin((x * wave.x + z * wave.z) * wave.frequency + seconds * wave.speed);
  }
  return height;
}

export function createReflectionCache() {
  let dirty = true;
  return {
    invalidate() {
      dirty = true;
    },
    update(draw: () => void) {
      if (!dirty) return;
      draw();
      dirty = false;
    },
  };
}

// The CPU sampler and both shader stages use exactly the same wave constants.
const waveFunction = `
vec3 lakeWave(vec2 p, float t) {
  vec3 wave = vec3(0.0);
  ${lakeWaves
    .map(
      (w) => `{
    vec2 direction = vec2(${w.x}, ${w.z});
    float phase = dot(p, direction) * ${w.frequency} + t * ${w.speed};
    wave.x += ${w.amplitude} * sin(phase);
    wave.yz += ${w.amplitude * w.frequency} * direction * cos(phase);
  }`,
    )
    .join('\n')}
  return wave;
}`;

const waterShader = {
  name: 'FlockLake',
  uniforms: {
    tDiffuse: { value: null },
    color: { value: new Color('#3b575b') },
    textureMatrix: { value: new Matrix4() },
    time: { value: 0 },
    sunDirection: { value: new Vector3(-0.18, 0.12, -1).normalize() },
    fogColor: { value: new Color('#bfc9c3') },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    uniform float time;
    varying vec4 reflectionCoord;
    varying vec3 worldPosition;
    ${waveFunction}
    void main() {
      vec3 point = position;
      vec3 world = (modelMatrix * vec4(point, 1.0)).xyz;
      point.z += lakeWave(world.xz, time).x;
      reflectionCoord = textureMatrix * vec4(position, 1.0);
      worldPosition = (modelMatrix * vec4(point, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 color;
    uniform vec3 sunDirection;
    uniform vec3 fogColor;
    uniform float time;
    varying vec4 reflectionCoord;
    varying vec3 worldPosition;
    ${waveFunction}
    void main() {
      vec3 swell = lakeWave(worldPosition.xz, time);
      vec2 fine = vec2(
        sin(worldPosition.x * 0.17 + worldPosition.z * 0.11 + time * 1.7),
        sin(worldPosition.x * -0.09 + worldPosition.z * 0.23 - time * 1.2)
      ) * 0.025;
      vec3 normal = normalize(vec3(-swell.y + fine.x, 1.0, -swell.z + fine.y));
      vec3 eye = normalize(cameraPosition - worldPosition);
      float distanceToEye = distance(cameraPosition, worldPosition);
      vec2 uv = reflectionCoord.xy / max(0.001, reflectionCoord.w);
      uv += normal.xz * (0.012 + 4.0 / max(80.0, distanceToEye));
      vec3 reflection = texture2D(tDiffuse, clamp(uv, vec2(0.002), vec2(0.998))).rgb;
      float fresnel = 0.12 + 0.88 * pow(1.0 - max(0.0, dot(eye, normal)), 5.0);
      float glint = pow(max(0.0, dot(eye, reflect(-sunDirection, normal))), 180.0);
      vec3 water = mix(color * (0.88 + normal.y * 0.12), reflection, 0.28 + fresnel * 0.55);
      water += vec3(1.0, 0.68, 0.39) * glint * 1.8;
      float haze = 1.0 - exp(-pow(distanceToEye * 0.0001, 2.0));
      water = mix(water, fogColor, haze * 0.65);
      gl_FragColor = vec4(water, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export function createLake(light: boolean) {
  const columns = light ? 48 : 96;
  const rows = light ? 64 : 112;
  const geometry = new PlaneGeometry(14000, 19000, columns, rows);
  const position = geometry.getAttribute('position');
  // Keep most detail ahead, but cover the entire portrait camera envelope behind it too.
  for (let row = 0; row <= rows; row++) {
    const progress = row / rows;
    const z =
      progress <= 0.8
        ? 2000 - Math.pow(1 - progress / 0.8, 1.7) * 14000
        : 2000 + ((progress - 0.8) / 0.2) * 5000;
    for (let column = 0; column <= columns; column++) {
      const unit = (column / columns) * 2 - 1;
      position.setXYZ(
        row * (columns + 1) + column,
        Math.sign(unit) * Math.pow(Math.abs(unit), 1.45) * 7000,
        -z - 2500,
        0,
      );
    }
  }
  geometry.computeBoundingSphere();
  // Vertex displacement must not be culled using an infinitely thin CPU plane.
  if (geometry.boundingSphere) geometry.boundingSphere.radius += 8;
  let mesh: Reflector | undefined;
  let disposed = false;
  const cache = createReflectionCache();
  function dispose() {
    if (disposed) return;
    disposed = true;
    mesh?.removeFromParent();
    mesh?.dispose();
    geometry.dispose();
  }
  try {
    mesh = new Reflector(geometry, {
      color: '#3b575b',
      textureWidth: light ? 256 : 512,
      textureHeight: light ? 256 : 512,
      multisample: 0,
      clipBias: 0.003,
      shader: waterShader,
    });
    // The public typings inherit Mesh's material union; verify the actual helper contract.
    if (!(mesh.material instanceof ShaderMaterial)) throw new Error('Unexpected lake material');
    const lake = mesh as Reflector & { material: ShaderMaterial };
    lake.name = 'flock-lake';
    lake.rotation.x = -Math.PI / 2;
    lake.position.z = -2500;
    const renderReflection = lake.onBeforeRender;
    lake.onBeforeRender = function (renderer, scene, camera, ...args) {
      if (disposed) return;
      cache.update(() => {
        // Only static scenery is visible to the reflected camera: no ghost birds/clouds.
        lake.getReflectionCamera(camera).layers.set(reflectionLayer);
        const target = renderer.getRenderTarget();
        const xr = renderer.xr.enabled;
        const shadows = renderer.shadowMap.autoUpdate;
        try {
          renderReflection.call(lake, renderer, scene, camera, ...args);
        } finally {
          lake.visible = true;
          renderer.setRenderTarget(target);
          renderer.xr.enabled = xr;
          renderer.shadowMap.autoUpdate = shadows;
        }
      });
    };
    return {
      mesh: lake,
      update(seconds: number) {
        if (!disposed) lake.material.uniforms.time.value = seconds;
      },
      invalidate() {
        if (!disposed) cache.invalidate();
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
