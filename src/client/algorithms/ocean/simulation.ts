import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  HalfFloatType,
  LinearFilter,
  NearestFilter,
  RGBAFormat,
  RepeatWrapping,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { butterflyTable, butterflyTextureData } from './butterfly';
import { foamPingPong, type OceanConfig } from './config';
import type { PassFactory } from './pass';
import { resourceSet, type ResourceSet } from './resources';
import {
  ASSEMBLY_FRAGMENT_SHADER,
  BUTTERFLY_FRAGMENT_SHADER,
  FOAM_FRAGMENT_SHADER,
  H0_FRAGMENT_SHADER,
  SPECTRUM_FRAGMENT_SHADER,
} from './shaders';
import { SPECTRUM_SEED } from './spectrum';
import type { OceanLook } from './look';

/** Foam decay is integrated with this clamped step so a stalled tab cannot blow up. */
const MIN_STEP_SECONDS = 0.0005;
const MAX_STEP_SECONDS = 0.05;

export type OceanSimulation = {
  /** `oDisp`: xyz is the displaced surface point, w the Jacobian determinant. */
  displacement(cascade: number): Texture;
  /** `oDeriv`: dη/dx, dη/dz, then the Jacobian's diagonal terms. */
  slopes(cascade: number): Texture;
  /** The foam field read by this frame; the ping-pong pair swaps every step. */
  foam(cascade: number): Texture;
  simulate(seconds: number, delta: number): void;
  dispose(): void;
};

function rawTarget(resources: ResourceSet, size: number, count: number) {
  return resources.add(
    new WebGLRenderTarget(size, size, {
      type: FloatType,
      format: RGBAFormat,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      count,
    }),
  );
}

function smoothTarget(resources: ResourceSet, size: number, count: number) {
  return resources.add(
    new WebGLRenderTarget(size, size, {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      count,
    }),
  );
}

/**
 * The three-cascade spectral pipeline. Fixed simulation resolution: the grid
 * never follows the canvas, so a resize only reallocates the render targets and
 * a downshift only reallocates them again. Nothing here reads a clock — the
 * caller drives the spectrum with `seconds` and the foam decay with `delta`.
 */
export function createOceanSimulation(
  renderer: WebGLRenderer,
  passes: PassFactory,
  config: OceanConfig,
  look: OceanLook,
): OceanSimulation {
  const resources = resourceSet();
  try {
    const size = config.fftSize;
    const cascadeCount = config.cascadeLengths.length;

    const butterflyData = new Float32Array(butterflyTextureData(butterflyTable(size)));
    const butterflyTexture = resources.add(
      new DataTexture(butterflyData, config.log2FftSize, size, RGBAFormat, FloatType),
    );
    butterflyTexture.minFilter = NearestFilter;
    butterflyTexture.magFilter = NearestFilter;
    butterflyTexture.wrapS = ClampToEdgeWrapping;
    butterflyTexture.wrapT = ClampToEdgeWrapping;
    butterflyTexture.generateMipmaps = false;
    butterflyTexture.needsUpdate = true;

    // Two MRT slots each, so one pass carries four complex channels.
    const pingPongA = rawTarget(resources, size, 2);
    const pingPongB = rawTarget(resources, size, 2);
    const h0Targets = config.cascadeLengths.map(() => rawTarget(resources, size, 1));
    const resultTargets = config.cascadeLengths.map(() => smoothTarget(resources, size, 2));
    const foamTargets = config.cascadeLengths.map(() => [
      smoothTarget(resources, size, 1),
      smoothTarget(resources, size, 1),
    ]);
    let foamIndex = 0;

    const h0Pass = passes.makePass(
      H0_FRAGMENT_SHADER,
      {
        uN: { value: size },
        uL: { value: 1 },
        uWind: { value: 1 },
        uFetch: { value: 1 },
        uDepth: { value: 1 },
        uSwell: { value: 0 },
        uSpread: { value: 0 },
        uShort: { value: 0 },
        uCutLo: { value: 0 },
        uCutHi: { value: 0 },
        uAmp: { value: 1 },
        uWindDir: { value: new Vector2(1, 0) },
        uSeed: { value: SPECTRUM_SEED },
      },
      { depthTest: false, depthWrite: false },
    );
    const spectrumPass = passes.makePass(
      SPECTRUM_FRAGMENT_SHADER,
      {
        uH0: { value: null as Texture | null },
        uN: { value: size },
        uL: { value: 1 },
        uTime: { value: 0 },
        uDepth: { value: 1 },
      },
      { depthTest: false, depthWrite: false },
    );
    const butterflyPass = passes.makePass(
      BUTTERFLY_FRAGMENT_SHADER,
      {
        uSrc0: { value: null as Texture | null },
        uSrc1: { value: null as Texture | null },
        uBf: { value: butterflyTexture },
        uStage: { value: 0 },
        uDir: { value: 0 },
      },
      { depthTest: false, depthWrite: false },
    );
    const assemblyPass = passes.makePass(
      ASSEMBLY_FRAGMENT_SHADER,
      {
        uSrc0: { value: null as Texture | null },
        uSrc1: { value: null as Texture | null },
        uN: { value: size },
        uChop: { value: 1 },
      },
      { depthTest: false, depthWrite: false },
    );
    const foamPass = passes.makePass(
      FOAM_FRAGMENT_SHADER,
      {
        uDisp: { value: null as Texture | null },
        uPrev: { value: null as Texture | null },
        uN: { value: size },
        uThresh: { value: 0.6 },
        uStrength: { value: 1 },
        uDecay: { value: 0.4 },
        uDt: { value: 0.016 },
      },
      { depthTest: false, depthWrite: false },
    );

    function rebuildSpectrum() {
      const angle = (look.windDirectionDeg * Math.PI) / 180;
      for (let cascade = 0; cascade < cascadeCount; cascade++) {
        const u = h0Pass.uniforms;
        u.uL.value = config.cascadeLengths[cascade] ?? 1;
        u.uWind.value = look.windSpeed;
        u.uFetch.value = look.fetchKm * 1000;
        u.uDepth.value = look.depth;
        u.uSwell.value = look.swell;
        u.uSpread.value = look.spread;
        u.uShort.value = look.shortWaves;
        u.uCutLo.value = config.bandCutLow[cascade] ?? 0;
        u.uCutHi.value = config.bandCutHigh[cascade] ?? 0;
        u.uAmp.value = look.amplitude;
        u.uWindDir.value.set(Math.cos(angle), Math.sin(angle));
        h0Pass.renderTo(h0Targets[cascade] ?? null);
      }
    }

    // The first frames must not read uninitialised foam history.
    for (const pair of foamTargets)
      for (const target of pair) {
        renderer.setRenderTarget(target);
        renderer.clear(true, false, false);
      }
    renderer.setRenderTarget(null);

    rebuildSpectrum();

    function simulate(seconds: number, delta: number) {
      const secondsPerStep = Math.min(
        MAX_STEP_SECONDS,
        Math.max(MIN_STEP_SECONDS, Number.isFinite(delta) ? delta : 0),
      );
      const time = Number.isFinite(seconds) ? seconds : 0;
      // One shared step for all cascades: they must advance in lockstep.
      const step = foamPingPong(foamIndex);
      for (let cascade = 0; cascade < cascadeCount; cascade++) {
        const h0Target = h0Targets[cascade];
        const result = resultTargets[cascade];
        const foamPair = foamTargets[cascade];
        if (!h0Target || !result || !foamPair) continue;

        spectrumPass.uniforms.uH0.value = h0Target.texture;
        spectrumPass.uniforms.uL.value = config.cascadeLengths[cascade] ?? 1;
        spectrumPass.uniforms.uTime.value = time;
        spectrumPass.uniforms.uDepth.value = look.depth;
        spectrumPass.renderTo(pingPongA);

        let source = pingPongA;
        let destination = pingPongB;
        for (let direction = 0; direction < 2; direction++) {
          for (let stage = 0; stage < config.log2FftSize; stage++) {
            butterflyPass.uniforms.uSrc0.value = source.textures[0] ?? null;
            butterflyPass.uniforms.uSrc1.value = source.textures[1] ?? null;
            butterflyPass.uniforms.uStage.value = stage;
            butterflyPass.uniforms.uDir.value = direction;
            butterflyPass.renderTo(destination);
            const swap = source;
            source = destination;
            destination = swap;
          }
        }

        assemblyPass.uniforms.uSrc0.value = source.textures[0] ?? null;
        assemblyPass.uniforms.uSrc1.value = source.textures[1] ?? null;
        assemblyPass.uniforms.uChop.value = look.choppiness;
        assemblyPass.renderTo(result);

        foamPass.uniforms.uDisp.value = result.textures[0] ?? null;
        foamPass.uniforms.uPrev.value = foamPair[step.read]?.texture ?? null;
        foamPass.uniforms.uThresh.value = look.foamThreshold;
        foamPass.uniforms.uStrength.value = look.foamStrength;
        foamPass.uniforms.uDecay.value = look.foamDecay;
        foamPass.uniforms.uDt.value = secondsPerStep;
        foamPass.renderTo(foamPair[step.write] ?? null);
      }
      foamIndex = step.next;
    }

    return {
      displacement(cascade) {
        const target = resultTargets[cascade];
        if (!target?.textures[0]) throw new RangeError(`No cascade ${cascade}`);
        return target.textures[0];
      },
      slopes(cascade) {
        const target = resultTargets[cascade];
        if (!target?.textures[1]) throw new RangeError(`No cascade ${cascade}`);
        return target.textures[1];
      },
      foam(cascade) {
        const texture = foamTargets[cascade]?.[foamIndex]?.texture;
        if (!texture) throw new RangeError(`No cascade ${cascade}`);
        return texture;
      },
      simulate,
      dispose: () => resources.dispose(),
    };
  } catch (error) {
    resources.dispose();
    throw error;
  }
}
