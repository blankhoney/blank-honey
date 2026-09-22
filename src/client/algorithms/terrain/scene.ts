// Procedural mountain terrain for the hero stage: a fixed viewing area over a
// lake, three nested LOD rings around it, warm distance fog and a blue-green
// foreground. The renderer is driven entirely by resize() and frame() — no RAF,
// no event listeners, no external assets. Ported design notes and the upstream
// licence are in ../../vendor/terrain/README.md.
import {
  ACESFilmicToneMapping,
  BackSide,
  Color,
  DoubleSide,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { report } from '../../log';
import {
  algorithmResolution,
  type AlgorithmBudget,
  type AlgorithmFactory,
  type AlgorithmScene,
} from '../types';
import { terrainCamera } from './camera';
import { createTerrainLayerGeometry, terrainLodPlan, terrainSkirtDepth } from './geometry';
import {
  skyFragmentShader,
  skyVertexShader,
  terrainFragmentShader,
  terrainVertexShader,
  waterFragmentShader,
  waterVertexShader,
} from './glsl';
import { terrainWaterLevel, terrainViewHalf } from './height';

const palette = {
  zenith: '#223f5c',
  horizon: '#d4c6b0',
  fog: '#75959f',
  sun: '#ffd9a8',
  skyAmbient: '#a1b5c9',
  groundBounce: '#3d4b45',
  snow: '#e9eef4',
  rock: '#4c6065',
  vegetation: '#245b4c',
  dry: '#596a51',
  sand: '#849788',
  waterDeep: '#092f42',
  waterShallow: '#176b6b',
};

const sunDirection = new Vector3(-0.34, 0.24, -0.9).normalize();
/** Fog reaches the far ring edge; the shader stops shading past the cutoff. */
const fogDensity = 1 / 4200;
const skyRadius = 14000;
const cameraNear = 3;
const cameraFar = 17000;
const fieldOfView = 52;
const normalEpsilon = 6;
const snowLine = 0.58;
/** Pointer easing rate, per second. Frames after a pause cannot jump. */
const pointerEase = 2.2;

/** Real drawing-buffer pixels for a CSS size, capped by the algorithm budget. */
export function terrainResolution(
  width: number,
  height: number,
  budget: AlgorithmBudget,
  scale = 1,
  deviceRatio: number | undefined = typeof window === 'undefined' ? 1 : window.devicePixelRatio,
) {
  return algorithmResolution(width, height, budget, scale, deviceRatio);
}

function createTerrainScene(
  container: HTMLElement,
  budget: AlgorithmBudget,
  signal: AbortSignal,
): AlgorithmScene {
  if (signal.aborted) throw new Error('Terrain scene aborted before start');
  const canvas = document.createElement('canvas');
  canvas.className = 'terrain-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  const releases: Array<() => void> = [];
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const release of releases.reverse()) {
      try {
        release();
      } catch (error) {
        report('terrain:dispose', error);
      }
    }
    canvas.remove();
  }
  try {
    container.append(canvas);
    const context = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    });
    if (!context) throw new Error('Terrain requires WebGL2');
    // Released last, after every GPU resource above has been dropped.
    releases.push(() => context.getExtension('WEBGL_lose_context')?.loseContext());
    const renderer = new WebGLRenderer({ canvas, context, alpha: false, antialias: false });
    releases.push(() => renderer.dispose());
    renderer.debug.onShaderError = () => {
      throw new Error('Terrain shader compilation failed');
    };
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(new Color(palette.fog), 1);

    const scene = new Scene();
    const camera = new PerspectiveCamera(fieldOfView, 1, cameraNear, cameraFar);
    const fogColor = new Color(palette.fog);

    const skyGeometry = new SphereGeometry(skyRadius, 32, 16);
    releases.push(() => skyGeometry.dispose());
    const skyMaterial = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uZenithColor: { value: new Color(palette.zenith) },
        uHorizonColor: { value: new Color(palette.horizon) },
        uSunDirection: { value: sunDirection.clone() },
        uSunColor: { value: new Color(palette.sun) },
      },
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
    });
    releases.push(() => skyMaterial.dispose());
    const sky = new Mesh(skyGeometry, skyMaterial);
    sky.name = 'terrain-sky';
    sky.renderOrder = -2;
    sky.frustumCulled = false;
    scene.add(sky);
    releases.push(() => scene.remove(sky));

    const terrainMaterial = new ShaderMaterial({
      side: DoubleSide,
      uniforms: {
        uSkirtDepth: { value: terrainSkirtDepth },
        uNormalEpsilon: { value: normalEpsilon },
        uWaterLevel: { value: terrainWaterLevel },
        uSnowLine: { value: snowLine },
        uSunDirection: { value: sunDirection.clone() },
        uSunColor: { value: new Color(palette.sun) },
        uSkyColor: { value: new Color(palette.skyAmbient) },
        uGroundColor: { value: new Color(palette.groundBounce) },
        uSnowColor: { value: new Color(palette.snow) },
        uRockColor: { value: new Color(palette.rock) },
        uVegetationColor: { value: new Color(palette.vegetation) },
        uDryColor: { value: new Color(palette.dry) },
        uSandColor: { value: new Color(palette.sand) },
        uFogDensity: { value: fogDensity },
        uFogColor: { value: fogColor.clone() },
      },
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
    });
    releases.push(() => terrainMaterial.dispose());
    for (const plan of terrainLodPlan(budget.light)) {
      const geometry = createTerrainLayerGeometry(plan);
      releases.push(() => geometry.dispose());
      const mesh = new Mesh(geometry, terrainMaterial);
      mesh.name = `terrain-${plan.id}`;
      // The mesh must stay untransformed: the shader treats position.xz as world XZ.
      scene.add(mesh);
      releases.push(() => scene.remove(mesh));
    }

    const waterExtent = terrainViewHalf * 4 * 2;
    const waterGeometry = new PlaneGeometry(waterExtent, waterExtent);
    releases.push(() => waterGeometry.dispose());
    const waterMaterial = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWaterLevel: { value: terrainWaterLevel },
        uRipple: { value: 0.09 },
        uSunDirection: { value: sunDirection.clone() },
        uSunColor: { value: new Color(palette.sun) },
        uHorizonColor: { value: new Color(palette.horizon) },
        uDeepColor: { value: new Color(palette.waterDeep) },
        uShallowColor: { value: new Color(palette.waterShallow) },
        uFogDensity: { value: fogDensity },
        uFogColor: { value: fogColor.clone() },
      },
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
    });
    releases.push(() => waterMaterial.dispose());
    const water = new Mesh(waterGeometry, waterMaterial);
    water.name = 'terrain-water';
    water.rotation.x = -Math.PI / 2;
    water.position.y = terrainWaterLevel;
    scene.add(water);
    releases.push(() => scene.remove(water));

    function applySize(width: number, height: number, scale: number) {
      const resolution = terrainResolution(width, height, budget, scale);
      // Real pixels, no second device-pixel-ratio pass: the CSS size stays 100%.
      renderer.setPixelRatio(1);
      renderer.setSize(resolution.width, resolution.height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    applySize(
      Math.max(1, container.clientWidth || 1),
      Math.max(1, container.clientHeight || 1),
      1,
    );

    let pointerX = 0;
    let pointerY = 0;
    let elapsed = 0;
    return {
      canvas,
      resize(width, height, scale) {
        if (disposed) return;
        const safeWidth = Number.isFinite(width) ? Math.max(1, Math.min(32768, width)) : 1;
        const safeHeight = Number.isFinite(height) ? Math.max(1, Math.min(32768, height)) : 1;
        const safeScale = Number.isFinite(scale) ? Math.max(0.1, Math.min(1, scale)) : 1;
        applySize(safeWidth, safeHeight, safeScale);
      },
      frame(seconds, delta, pointer) {
        if (disposed) return;
        elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : elapsed;
        const step = Number.isFinite(delta) ? Math.min(Math.max(delta, 0), 0.1) : 0;
        const blend = 1 - Math.exp(-step * pointerEase);
        const targetX = pointer && pointer.active && Number.isFinite(pointer.x) ? pointer.x : 0;
        const targetY = pointer && pointer.active && Number.isFinite(pointer.y) ? pointer.y : 0;
        pointerX += (Math.max(-1, Math.min(1, targetX)) - pointerX) * blend;
        pointerY += (Math.max(-1, Math.min(1, targetY)) - pointerY) * blend;

        const view = terrainCamera(elapsed, pointerX, pointerY);
        camera.position.set(view.position.x, view.position.y, view.position.z);
        camera.lookAt(view.target.x, view.target.y, view.target.z);
        camera.updateMatrixWorld();
        // Keep the gradient sphere centred on the viewer so it never shifts.
        sky.position.set(camera.position.x, 0, camera.position.z);
        sky.updateMatrix();
        waterMaterial.uniforms.uTime.value = elapsed;
        renderer.render(scene, camera);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

export const createScene: AlgorithmFactory = (container, budget, signal) => {
  const scene = createTerrainScene(container, budget, signal);
  // The scene is built synchronously, so an abort can only land after it exists.
  if (signal.aborted) {
    scene.dispose();
    throw new Error('Terrain scene aborted during construction');
  }
  return scene;
};
