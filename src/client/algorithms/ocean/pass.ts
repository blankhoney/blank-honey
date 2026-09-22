import {
  Camera,
  GLSL3,
  Mesh,
  PlaneGeometry,
  RawShaderMaterial,
  Scene,
  type Material,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { QUAD_VERTEX_SHADER } from './shaders';
import { resourceSet } from './resources';

export type UniformSlot = { value: unknown };
export type Uniforms = Record<string, UniformSlot>;

export type PassOptions = {
  depthTest?: boolean;
  depthWrite?: boolean;
  depthFunc?: Material['depthFunc'];
};

export type Pass<U extends Uniforms> = {
  material: RawShaderMaterial;
  uniforms: U;
  renderTo(target: WebGLRenderTarget | null): void;
};

export type PassFactory = {
  makePass<U extends Uniforms>(
    fragmentShader: string,
    uniforms: U,
    options?: PassOptions,
  ): Pass<U>;
  dispose(): void;
};

/**
 * Fullscreen-pass helper. Every pass shares one unit quad, one dummy camera and
 * its own scene, so a pass costs a material and nothing else. All materials and
 * the quad live in one resource set: whatever the caller built before a failure
 * is released together with the rest.
 */
export function createPassFactory(renderer: WebGLRenderer): PassFactory {
  const resources = resourceSet();
  const geometry = resources.add(new PlaneGeometry(2, 2));
  const camera = new Camera();

  function makePass<U extends Uniforms>(
    fragmentShader: string,
    uniforms: U,
    options: PassOptions = {},
  ): Pass<U> {
    const material = resources.add(
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: QUAD_VERTEX_SHADER,
        fragmentShader,
        uniforms,
        depthTest: options.depthTest ?? false,
        depthWrite: options.depthWrite ?? false,
      }),
    );
    if (options.depthFunc !== undefined) material.depthFunc = options.depthFunc;
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    const scene = new Scene();
    scene.add(mesh);
    return {
      material,
      uniforms,
      renderTo(target) {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
      },
    };
  }

  return { makePass, dispose: () => resources.dispose() };
}
