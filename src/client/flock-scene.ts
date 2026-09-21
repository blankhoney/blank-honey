import {
  ACESFilmicToneMapping,
  Color,
  DoubleSide,
  FogExp2,
  Mesh,
  PerspectiveCamera,
  Plane,
  Raycaster,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import {
  birdFS,
  birdVS,
  createBirdGeometry,
  fillBirdTexture,
  flockBounds,
  fragmentShaderPosition,
  fragmentShaderVelocity,
} from './vendor/vanta-birds';
import { createFlockLandscape, landscapeFogColor } from './flock-landscape';
import { flockPixelRatio } from './flock-performance';
import { report } from './log';

export type FlockBudget = {
  width: 16 | 24;
  fps: number;
  maxDpr: number;
  maxPixels: number;
};
export type FlockScene = {
  canvas: HTMLCanvasElement;
  resize: (width: number, height: number, dpr: number) => void;
  setResolutionScale: (scale: number) => void;
  frame: (time: number, delta: number, pointer: { x: number; y: number }) => void;
  dispose: () => void;
};

/** One renderer/context for the landscape and flock; the hero owns the only clock. */
export function createFlockScene(budget: FlockBudget): FlockScene {
  const canvas = document.createElement('canvas');
  canvas.className = 'flock-canvas';
  const releases: Array<() => void> = [];
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const release of releases.reverse()) {
      try {
        release();
      } catch (error) {
        report('birds:dispose', error);
      }
    }
    canvas.remove();
  }
  try {
    const context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    if (!context) throw new Error('Birds requires WebGL2');
    releases.push(() => context.getExtension('WEBGL_lose_context')?.loseContext());
    const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: false });
    releases.push(() => renderer.dispose());
    if (!renderer.extensions.has('EXT_color_buffer_float')) {
      throw new Error('Birds requires floating-point render targets');
    }
    renderer.debug.onShaderError = () => {
      throw new Error('Birds shader compilation failed');
    };
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(landscapeFogColor, 1);
    const scene = new Scene();
    scene.fog = new FogExp2(landscapeFogColor, 0.00013);
    const camera = new PerspectiveCamera(55, 1, 5, 24000);
    const landscape = createFlockLandscape(budget.width === 16);
    releases.push(() => landscape.dispose());
    scene.add(landscape.root);

    const compute = new GPUComputationRenderer(budget.width, budget.width, renderer);
    releases.push(() => compute.dispose());
    function variable(name: string, shader: string, velocity = false) {
      const texture = compute.createTexture();
      try {
        fillBirdTexture(texture, velocity);
        return compute.addVariable(name, shader, texture);
      } catch (error) {
        texture.dispose();
        throw error;
      }
    }
    const velocity = variable('textureVelocity', fragmentShaderVelocity, true);
    const position = variable('texturePosition', fragmentShaderPosition);
    const variables = [position, velocity];
    for (const item of variables) {
      compute.setVariableDependencies(item, variables);
      item.wrapS = RepeatWrapping;
      item.wrapT = RepeatWrapping;
      item.material.uniforms.time = { value: 0 };
      item.material.uniforms.delta = { value: 0 };
    }
    const predator = new Vector3(10000, 10000, 0);
    Object.assign(velocity.material.uniforms, {
      separationDistance: { value: 20 },
      alignmentDistance: { value: 20 },
      cohesionDistance: { value: 20 },
      speedLimit: { value: 5 },
      freedomFactor: { value: 1 },
      testing: { value: 1 },
      predator: { value: predator },
    });
    velocity.material.defines.BOUNDS = flockBounds.toFixed(2);
    const error = compute.init();
    if (error) throw new Error(error);
    const geometry = createBirdGeometry(budget.width);
    releases.push(() => geometry.dispose());
    const flockOrigin = new Vector3(0, 820, -500);
    const flockScale = new Vector3(5.5, 1.4, 2);
    const material = new ShaderMaterial({
      uniforms: {
        texturePosition: { value: null },
        textureVelocity: { value: null },
        time: { value: 0 },
        birdSize: { value: 3.4 },
        flockOrigin: { value: flockOrigin },
        flockScale: { value: flockScale },
        fogColor: { value: new Color(landscapeFogColor) },
      },
      vertexShader: birdVS,
      fragmentShader: birdFS,
      side: DoubleSide,
      toneMapped: false,
    });
    releases.push(() => material.dispose());
    const mesh = new Mesh(geometry, material);
    mesh.name = 'flock-birds';
    mesh.rotation.y = Math.PI / 2;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.frustumCulled = false;
    scene.add(mesh);
    releases.push(() => scene.remove(mesh));

    const ray = new Raycaster();
    const mouse = new Vector2();
    const hit = new Vector3();
    const flightPlane = new Plane(new Vector3(0, 0, 1), -flockOrigin.z);
    let hostWidth = 1;
    let hostHeight = 1;
    let hostDpr = 1;
    let resolutionScale = 1;
    function resolution() {
      renderer.setPixelRatio(
        flockPixelRatio(
          hostWidth,
          hostHeight,
          hostDpr,
          budget.maxDpr,
          budget.maxPixels,
          resolutionScale,
        ),
      );
      renderer.setSize(hostWidth, hostHeight, false);
    }
    return {
      canvas,
      resize(width, height, dpr) {
        if (disposed) return;
        const w = Number.isFinite(width) ? Math.max(1, Math.min(32768, width)) : 1;
        const h = Number.isFinite(height) ? Math.max(1, Math.min(32768, height)) : 1;
        const aspectChanged = camera.aspect !== w / h;
        hostWidth = w;
        hostHeight = h;
        hostDpr = dpr;
        resolution();
        camera.aspect = w / h;
        const portrait = Math.max(0, 1 / Math.max(0.3, camera.aspect) - 1);
        camera.position.set(0, 170 + portrait * 80, 1500 + portrait * 1800);
        camera.lookAt(0, 300, -2200);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        if (aspectChanged) landscape.invalidateReflection();
      },
      setResolutionScale(scale) {
        if (disposed || !Number.isFinite(scale)) return;
        const next = Math.max(0.65, Math.min(1, scale));
        if (next === resolutionScale) return;
        resolutionScale = next;
        resolution();
      },
      frame(time, delta, pointer) {
        if (disposed) return;
        landscape.update(time / 1000);
        for (const item of variables) {
          item.material.uniforms.time.value = time;
          item.material.uniforms.delta.value = delta;
        }
        predator.set(10000, 10000, 0);
        if (Math.abs(pointer.x) <= 0.5 && Math.abs(pointer.y) <= 0.5) {
          mouse.set(pointer.x * 2, pointer.y * 2);
          ray.setFromCamera(mouse, camera);
          if (ray.ray.intersectPlane(flightPlane, hit)) {
            predator.set(
              (hit.x - flockOrigin.x) / flockScale.x / flockBounds,
              (hit.y - flockOrigin.y) / flockScale.y / flockBounds,
              0,
            );
          }
        }
        compute.compute();
        material.uniforms.texturePosition.value = compute.getCurrentRenderTarget(position).texture;
        material.uniforms.textureVelocity.value = compute.getCurrentRenderTarget(velocity).texture;
        material.uniforms.time.value = time;
        renderer.render(scene, camera);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
