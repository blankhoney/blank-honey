import {
  AdditiveBlending,
  AlwaysDepth,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DepthTexture,
  DoubleSide,
  GLSL3,
  HalfFloatType,
  LinearFilter,
  Mesh,
  PerspectiveCamera,
  RGBAFormat,
  RawShaderMaterial,
  Scene,
  SphereGeometry,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { radialGrid, type OceanConfig } from './config';
import { sunState, type OceanLook } from './look';
import type { PassFactory } from './pass';
import { resourceSet } from './resources';
import type { OceanSimulation } from './simulation';
import {
  BLIT_FRAGMENT_SHADER,
  BLOOM_BRIGHT_FRAGMENT_SHADER,
  BLOOM_DOWN_FRAGMENT_SHADER,
  BLOOM_UP_FRAGMENT_SHADER,
  COMPOSITE_FRAGMENT_SHADER,
  OCEAN_FRAGMENT_SHADER,
  OCEAN_VERTEX_SHADER,
  SKY_FRAGMENT_SHADER,
  SKY_VERTEX_SHADER,
} from './shaders';

/** Lowest render-target edge; the downshift ladder can shrink the canvas a lot. */
const MIN_TARGET_EDGE = 2;

const SKY_RADIUS = 20000;

export type OceanSurface = {
  camera: PerspectiveCamera;
  /** Bounded heading in radians. The camera position itself never changes. */
  setYaw(yaw: number): void;
  /** Reallocates the scene, water and bloom targets for a new drawing buffer. */
  resizeTargets(pixelWidth: number, pixelHeight: number): void;
  renderFrame(seconds: number): void;
  dispose(): void;
};

export function createOceanSurface(
  renderer: WebGLRenderer,
  passes: PassFactory,
  config: OceanConfig,
  look: OceanLook,
  simulation: OceanSimulation,
): OceanSurface {
  const resources = resourceSet();
  // Declared next to the flat list, before the try: releaseTargets may run from
  // the catch of a half-built surface, and the bloom chain must be part of what
  // it drops. Each framebuffer lives in exactly one of the two lists.
  const targets: WebGLRenderTarget[] = [];
  const bloomTargets: WebGLRenderTarget[] = [];
  let disposed = false;

  /**
   * Drops every reallocatable framebuffer. Both lists are emptied, so a resize
   * can never leave a disposed target behind in the bloom chain for the next
   * allocation to append to: the chain would grow by one tier's worth per
   * resize and keep rendering into released framebuffers.
   */
  function releaseTargets() {
    for (const list of [targets, bloomTargets]) {
      for (const target of list) {
        target.depthTexture?.dispose();
        target.dispose();
      }
      list.length = 0;
    }
  }

  try {
    if (config.cascadeLengths.length !== 3)
      throw new RangeError(
        `The water shader is wired for three cascades, got ${config.cascadeLengths.length}`,
      );

    const sun = sunState(look);
    // One shared uniform set drives the dome and the water, so the sky the
    // water reflects can never drift from the sky it is drawn against.
    const skyUniforms = {
      uSunDir: { value: new Vector3(...sun.direction) },
      uBetaR: { value: new Vector3(...sun.betaR) },
      uBetaM: { value: new Vector3(...sun.betaM) },
      uSunE: { value: sun.energy },
      uMieG: { value: look.mieG },
      uSkyGain: { value: look.skyGain },
    };

    const camera = new PerspectiveCamera(look.fieldOfView, 1, look.near, look.far);
    camera.position.set(0, look.cameraHeight, 0);
    camera.rotation.set(look.cameraPitch, look.cameraBaseYaw, 0, 'YXZ');
    camera.updateMatrixWorld(true);

    /* ── sky dome ───────────────────────────────────────────────────────── */
    const skyCamPos = new Vector3().copy(camera.position);
    const skyMaterial = resources.add(
      new RawShaderMaterial({
        glslVersion: GLSL3,
        side: BackSide,
        depthWrite: false,
        depthTest: false,
        uniforms: { ...skyUniforms, uCamPos: { value: skyCamPos } },
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: SKY_FRAGMENT_SHADER,
      }),
    );
    const skyGeometry = resources.add(new SphereGeometry(SKY_RADIUS, 48, 32));
    const skyMesh = new Mesh(skyGeometry, skyMaterial);
    skyMesh.frustumCulled = false;
    skyMesh.renderOrder = -1000;
    const skyScene = new Scene();
    skyScene.add(skyMesh);

    /* ── water surface ──────────────────────────────────────────────────── */
    const scatter = new Color(look.scatter);
    const subsurface = new Color(look.sss);
    const clarity = 1 / Math.max(0.15, look.clarity);
    const waterUniforms = {
      ...skyUniforms,
      // Live camera position, so no per-frame copy is needed.
      uCamPos: { value: camera.position },
      uSunColor: { value: new Vector3(...sun.color) },
      uD0: { value: simulation.displacement(0) as Texture },
      uD1: { value: simulation.displacement(1) as Texture },
      uD2: { value: simulation.displacement(2) as Texture },
      uV0: { value: simulation.slopes(0) as Texture },
      uV1: { value: simulation.slopes(1) as Texture },
      uV2: { value: simulation.slopes(2) as Texture },
      uF0: { value: simulation.foam(0) as Texture },
      uF1: { value: simulation.foam(1) as Texture },
      uF2: { value: simulation.foam(2) as Texture },
      uL0: { value: config.cascadeLengths[0] ?? 1 },
      uL1: { value: config.cascadeLengths[1] ?? 1 },
      uL2: { value: config.cascadeLengths[2] ?? 1 },
      uSceneColor: { value: null as Texture | null },
      uSceneDepth: { value: null as Texture | null },
      uResolution: { value: new Vector2(1, 1) },
      uNear: { value: look.near },
      uFar: { value: look.far },
      uTime: { value: 0 },
      uAbsorb: {
        value: new Vector3(look.absorbR * clarity, look.absorbG * clarity, look.absorbB * clarity),
      },
      uScatter: { value: new Vector3(scatter.r, scatter.g, scatter.b) },
      uSSSColor: { value: new Vector3(subsurface.r, subsurface.g, subsurface.b) },
      uFoamColor: { value: new Vector3(0.92, 0.96, 0.98) },
      uSSSStrength: { value: look.sssStrength },
      uFoamAmount: { value: look.foamAmount },
      uRefract: { value: look.refract },
      uFogDensity: { value: look.fogDensity },
      uGlitter: { value: look.glitter },
    };

    const waterMaterial = resources.add(
      new RawShaderMaterial({
        glslVersion: GLSL3,
        side: DoubleSide,
        uniforms: waterUniforms,
        vertexShader: OCEAN_VERTEX_SHADER,
        fragmentShader: OCEAN_FRAGMENT_SHADER,
      }),
    );
    const grid = radialGrid(config.rings, config.segs);
    const waterGeometry = resources.add(new BufferGeometry());
    waterGeometry.setAttribute('position', new BufferAttribute(grid.positions, 3));
    waterGeometry.setIndex(new BufferAttribute(grid.indices, 1));
    const waterMesh = new Mesh(waterGeometry, waterMaterial);
    waterMesh.frustumCulled = false;
    const waterScene = new Scene();
    waterScene.add(waterMesh);

    /* ── passes ─────────────────────────────────────────────────────────── */
    const blitPass = passes.makePass(
      BLIT_FRAGMENT_SHADER,
      { uColor: { value: null as Texture | null }, uDepth: { value: null as Texture | null } },
      { depthTest: true, depthWrite: true, depthFunc: AlwaysDepth },
    );
    const brightPass = passes.makePass(BLOOM_BRIGHT_FRAGMENT_SHADER, {
      uTex: { value: null as Texture | null },
      uTexel: { value: new Vector2() },
      uThresh: { value: look.bloomThreshold },
      uKnee: { value: look.bloomKnee },
    });
    const downPass = passes.makePass(BLOOM_DOWN_FRAGMENT_SHADER, {
      uTex: { value: null as Texture | null },
      uTexel: { value: new Vector2() },
    });
    const upPass = passes.makePass(BLOOM_UP_FRAGMENT_SHADER, {
      uTex: { value: null as Texture | null },
      uTexel: { value: new Vector2() },
      uRadius: { value: 1 },
    });
    upPass.material.blending = AdditiveBlending;
    upPass.material.transparent = true;
    const compositePass = passes.makePass(COMPOSITE_FRAGMENT_SHADER, {
      uScene: { value: null as Texture | null },
      uBloom: { value: null as Texture | null },
      uTexel: { value: new Vector2() },
      uExposure: { value: look.exposure },
      uBloomStr: { value: config.bloomLevels > 0 ? look.bloomStrength : 0 },
      uTime: { value: 0 },
      uVignette: { value: look.vignette },
    });

    // A one-texel black stand-in keeps the composite shader branch-free when the
    // low tier runs without a bloom chain at all.
    const blackTexture = resources.add(
      new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat, UnsignedByteType),
    );
    blackTexture.needsUpdate = true;
    compositePass.uniforms.uBloom.value = blackTexture;

    /* ── resizeable framebuffers ────────────────────────────────────────── */
    let sceneTarget: WebGLRenderTarget | null = null;
    let mainTarget: WebGLRenderTarget | null = null;
    let pixelWidth = MIN_TARGET_EDGE;
    let pixelHeight = MIN_TARGET_EDGE;

    /**
     * Allocates one framebuffer into `list`. Ownership has to be disjoint —
     * the release walks both lists — so this is the only place a target is
     * registered, and callers pass the list they mean.
     */
    function allocate(
      list: WebGLRenderTarget[],
      width: number,
      height: number,
      withDepth: boolean,
    ) {
      const target = new WebGLRenderTarget(width, height, {
        type: HalfFloatType,
        format: RGBAFormat,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        depthBuffer: withDepth,
        stencilBuffer: false,
        generateMipmaps: false,
        ...(withDepth ? { depthTexture: new DepthTexture(width, height, UnsignedIntType) } : {}),
      });
      target.texture.generateMipmaps = false;
      list.push(target);
      return target;
    }

    function resizeTargets(width: number, height: number) {
      if (disposed) return;
      releaseTargets();
      pixelWidth = Math.max(MIN_TARGET_EDGE, Math.round(width));
      pixelHeight = Math.max(MIN_TARGET_EDGE, Math.round(height));
      sceneTarget = allocate(targets, pixelWidth, pixelHeight, true);
      mainTarget = allocate(targets, pixelWidth, pixelHeight, true);
      if (config.bloomLevels > 0) {
        for (let level = 0; level < config.bloomLevels; level++) {
          allocate(
            bloomTargets,
            Math.max(MIN_TARGET_EDGE, pixelWidth >> (level + 1)),
            Math.max(MIN_TARGET_EDGE, pixelHeight >> (level + 1)),
            false,
          );
        }
      }
      waterUniforms.uResolution.value.set(pixelWidth, pixelHeight);
      compositePass.uniforms.uTexel.value.set(1 / pixelWidth, 1 / pixelHeight);
      camera.aspect = pixelWidth / pixelHeight;
      camera.updateProjectionMatrix();
    }

    function renderFrame(seconds: number) {
      if (disposed) return;
      const scene = sceneTarget;
      const main = mainTarget;
      if (!scene || !main) return;

      // The dome rides with the camera so the horizon stays centred on the eye.
      skyMesh.position.copy(camera.position);
      skyMesh.updateMatrixWorld(true);
      skyCamPos.copy(camera.position);

      waterUniforms.uTime.value = seconds;
      waterUniforms.uF0.value = simulation.foam(0);
      waterUniforms.uF1.value = simulation.foam(1);
      waterUniforms.uF2.value = simulation.foam(2);
      compositePass.uniforms.uTime.value = seconds;

      /* scene pass: sky only, but it is what the water refracts and reflects */
      renderer.setRenderTarget(scene);
      renderer.clear(true, true, false);
      renderer.render(skyScene, camera);

      /* water pass: blit colour+depth first so the surface has a depth buffer */
      renderer.setRenderTarget(main);
      renderer.clear(true, true, false);
      blitPass.uniforms.uColor.value = scene.texture;
      blitPass.uniforms.uDepth.value = scene.depthTexture;
      blitPass.renderTo(main);

      waterUniforms.uSceneColor.value = scene.texture;
      waterUniforms.uSceneDepth.value = scene.depthTexture;
      renderer.setRenderTarget(main);
      renderer.render(waterScene, camera);

      /* bloom: threshold, downsample, additive upsample */
      const firstBloom = bloomTargets[0];
      if (firstBloom) {
        brightPass.uniforms.uTex.value = main.texture;
        brightPass.uniforms.uTexel.value.set(1 / pixelWidth, 1 / pixelHeight);
        brightPass.renderTo(firstBloom);
        for (let level = 0; level < bloomTargets.length - 1; level++) {
          const source = bloomTargets[level];
          const destination = bloomTargets[level + 1];
          if (!source || !destination) continue;
          downPass.uniforms.uTex.value = source.texture;
          downPass.uniforms.uTexel.value.set(1 / source.width, 1 / source.height);
          downPass.renderTo(destination);
        }
        for (let level = bloomTargets.length - 1; level > 0; level--) {
          const source = bloomTargets[level];
          const destination = bloomTargets[level - 1];
          if (!source || !destination) continue;
          upPass.uniforms.uTex.value = source.texture;
          upPass.uniforms.uTexel.value.set(1 / source.width, 1 / source.height);
          upPass.renderTo(destination);
        }
        compositePass.uniforms.uBloom.value = firstBloom.texture;
      }

      compositePass.uniforms.uScene.value = main.texture;
      compositePass.renderTo(null);
    }

    return {
      camera,
      setYaw(yaw) {
        camera.rotation.set(look.cameraPitch, yaw, 0, 'YXZ');
      },
      resizeTargets,
      renderFrame,
      dispose() {
        if (disposed) return;
        disposed = true;
        releaseTargets();
        resources.dispose();
      },
    };
  } catch (error) {
    releaseTargets();
    resources.dispose();
    throw error;
  }
}
