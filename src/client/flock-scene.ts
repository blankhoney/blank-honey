import {
  DoubleSide,
  Mesh,
  PerspectiveCamera,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
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
import { report } from './log';

export type FlockBudget = {
  width: 16 | 32;
  fps: number;
  maxDpr: number;
  maxPixels: number;
};
export type FlockScene = {
  canvas: HTMLCanvasElement;
  resize: (width: number, height: number, dpr: number) => void;
  frame: (time: number, delta: number, pointer: { x: number; y: number }) => void;
  dispose: () => void;
};

/** Owns all GPU resources; scheduling and DOM listeners belong to the hero effect. */
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
    // Register context release before constructing Three, including constructor failures.
    releases.push(() => context.getExtension('WEBGL_lose_context')?.loseContext());
    const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: false });
    releases.push(() => renderer.dispose());
    if (!renderer.extensions.has('EXT_color_buffer_float')) {
      throw new Error('Birds requires floating-point render targets');
    }
    renderer.debug.onShaderError = () => {
      throw new Error('Birds shader compilation failed');
    };
    renderer.setClearColor(0x07192f, 0);
    const scene = new Scene();
    const camera = new PerspectiveCamera(75, 1, 1, 3000);
    camera.position.z = 350;
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
    for (const item of [position, velocity]) {
      compute.setVariableDependencies(item, [position, velocity]);
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
    const material = new ShaderMaterial({
      uniforms: {
        texturePosition: { value: null },
        textureVelocity: { value: null },
        time: { value: 0 },
        birdSize: { value: 1 },
      },
      vertexShader: birdVS,
      fragmentShader: birdFS,
      side: DoubleSide,
    });
    releases.push(() => material.dispose());
    const mesh = new Mesh(geometry, material);
    mesh.rotation.y = Math.PI / 2;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    // Positions live in simulation textures, not in the geometry's CPU bounding sphere.
    mesh.frustumCulled = false;
    scene.add(mesh);
    releases.push(() => scene.remove(mesh));
    return {
      canvas,
      resize(width, height, dpr) {
        if (disposed) return;
        const w = Math.max(1, width);
        const h = Math.max(1, height);
        const ratio = Math.min(
          Math.max(0.1, dpr),
          budget.maxDpr,
          Math.sqrt(budget.maxPixels / (w * h)),
        );
        renderer.setPixelRatio(ratio);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // Pull back on portrait layouts instead of cropping most of the flock off both sides.
        camera.position.z = 350 / Math.sqrt(Math.min(1, camera.aspect));
        camera.updateProjectionMatrix();
      },
      frame(time, delta, pointer) {
        if (disposed) return;
        for (const item of [position, velocity]) {
          item.material.uniforms.time.value = time;
          item.material.uniforms.delta.value = delta;
        }
        predator.set(pointer.x, pointer.y, 0);
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
