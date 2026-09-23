/**
 * The `blackhole` hero scene: upstream Schwarzschild ray tracing with the measured tables.
 *
 * The scene owns its canvas, its tables and its program, and draws only when the hero runtime calls
 * `frame`. It schedules no animation frames of its own, listens on nothing global and reads no
 * events: time, the frame delta and the normalised pointer all arrive as arguments, so the runtime
 * stays the only owner of the frame loop, the observers and the listeners.
 */

import { report } from '../../log';
import { createSurface, program, triangle, type AlgorithmSurface } from '../gl';
import type { AlgorithmFactory, AlgorithmScene } from '../types';
import { algorithmResolution } from '../types';
import {
  blackHoleFraming,
  CAMERA_FOV_Y,
  CAMERA_RADIUS,
  ORBIT_RATE,
  pointerOrbit,
  smoothToward,
  staticClockRate,
  staticObserverUniforms,
} from './camera';
import { DISC_LOOK, DISC_TIME_SCALE, discGeometry } from './disc';
import { fetchAsset, LUTS, NOISE_TEXTURE, parseLut, parsePngHeader } from './lut';
import { fragmentSource, STARFIELD_SEED, vertexSource } from './shader';
import {
  bindTextures,
  createTextures,
  decodeNoiseTexture,
  TEXTURE_UNITS,
  throwOnGlError,
  type BlackHoleTextures,
} from './textures';

/**
 * Exposure of the output tone map, applied to the HDR scene colour before the ACES curve. The
 * upstream demo has the same multiplication, but in a separate pass that first mixes in its
 * multi-level bloom; this scene has no bloom and no pre-clamp of its own, so the constant is this
 * site's own and the tone map's shoulder places the brightest pixels. It is deliberately low: the
 * curve is applied per channel, so the exposure is what keeps the disc below the shoulder, where its
 * brightness differences survive, instead of on top of it.
 */
export const SCENE_EXPOSURE = 0.00011;

type SceneResources = {
  surface: AlgorithmSurface;
  textures: BlackHoleTextures;
  program: WebGLProgram;
  fullscreen: { draw(): void; dispose(): void };
};

type UniformLocations = Record<
  | 'camera_position'
  | 'p'
  | 'k_s'
  | 'e_tau'
  | 'e_w'
  | 'e_h'
  | 'e_d'
  | 'camera_size'
  | 'view_center'
  | 'disc_params'
  | 'exposure'
  | 'star_seed'
  | 'ray_deflection_texture'
  | 'ray_inverse_radius_texture'
  | 'black_body_texture'
  | 'doppler_texture'
  | 'noise_texture',
  WebGLUniformLocation
>;

/** Looked up eagerly: a uniform optimized away would otherwise fail silently as a no-op. */
function locateUniforms(gl: WebGL2RenderingContext, linked: WebGLProgram): UniformLocations {
  const find = (name: keyof UniformLocations): WebGLUniformLocation => {
    const location = gl.getUniformLocation(linked, name);
    if (!location) throw new Error(`Black hole shader is missing its ${name} uniform`);
    return location;
  };
  return {
    camera_position: find('camera_position'),
    p: find('p'),
    k_s: find('k_s'),
    e_tau: find('e_tau'),
    e_w: find('e_w'),
    e_h: find('e_h'),
    e_d: find('e_d'),
    camera_size: find('camera_size'),
    view_center: find('view_center'),
    disc_params: find('disc_params'),
    exposure: find('exposure'),
    star_seed: find('star_seed'),
    ray_deflection_texture: find('ray_deflection_texture'),
    ray_inverse_radius_texture: find('ray_inverse_radius_texture'),
    black_body_texture: find('black_body_texture'),
    doppler_texture: find('doppler_texture'),
    noise_texture: find('noise_texture'),
  };
}

function deviceRatio(): number {
  if (typeof window === 'undefined') return 1;
  const ratio = window.devicePixelRatio;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

export const createScene: AlgorithmFactory = async (container, budget, signal) => {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const resources: Partial<SceneResources> = {};
  let disposed = false;

  function attempt(step: () => void) {
    try {
      step();
    } catch (error) {
      report('blackhole:release', error);
    }
  }

  function release() {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', cancel);
    // Cancels any fetch still in flight; the already loaded tables simply become garbage.
    abort.abort();
    const current = resources;
    // GL objects go before the surface, which drops the context they belong to. Each step runs even
    // when an earlier one throws, so one failure cannot strand the rest.
    attempt(() => current.textures?.dispose());
    attempt(() => {
      if (current.program && current.surface) current.surface.gl.deleteProgram(current.program);
    });
    attempt(() => current.fullscreen?.dispose());
    attempt(() => current.surface?.dispose());
  }

  let noise: ImageBitmap | undefined;
  try {
    // 1. The four tables and the noise pattern, same origin, strictly validated before upload.
    const [deflection, inverseRadius, doppler, blackBody, noiseBytes] = await Promise.all([
      fetchAsset(LUTS.deflection.file, abort.signal),
      fetchAsset(LUTS.inverseRadius.file, abort.signal),
      fetchAsset(LUTS.doppler.file, abort.signal),
      fetchAsset(LUTS.blackBody.file, abort.signal),
      fetchAsset(NOISE_TEXTURE.file, abort.signal),
    ]);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const data = {
      deflection: parseLut(deflection, LUTS.deflection),
      inverseRadius: parseLut(inverseRadius, LUTS.inverseRadius),
      doppler: parseLut(doppler, LUTS.doppler),
      blackBody: parseLut(blackBody, LUTS.blackBody),
    };
    const noiseBytesView = new Uint8Array(noiseBytes);
    parsePngHeader(noiseBytesView, NOISE_TEXTURE);
    noise = await decodeNoiseTexture(noiseBytesView);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // 2. Surface and GPU objects; everything from here is registered for release.
    const surface = createSurface(container);
    resources.surface = surface;
    const gl = surface.gl;
    // Only what the code path needs: ES 3.0 for the 3D table, and linear filtering for float
    // textures because every table is sampled with LINEAR. No float render target, no blending.
    if (!gl.getExtension('OES_texture_float_linear'))
      throw new Error('Black hole scene needs linear filtering of float textures');
    const canvas = surface.canvas;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    const fullscreen = triangle(gl);
    resources.fullscreen = fullscreen;
    const linked = program(gl, vertexSource, fragmentSource(discGeometry()));
    resources.program = linked;
    const uniforms = locateUniforms(gl, linked);
    const tables = createTextures(gl, data, noise);
    resources.textures = tables;

    // 3. Constant uniforms. The tables are bound per frame anyway, so a stale unit cannot survive.
    gl.useProgram(linked);
    gl.uniform1f(uniforms.exposure, SCENE_EXPOSURE);
    gl.uniform3f(uniforms.disc_params, DISC_LOOK.density, DISC_LOOK.opacity, DISC_LOOK.temperature);
    gl.uniform3ui(uniforms.star_seed, ...STARFIELD_SEED);
    gl.uniform1i(uniforms.ray_deflection_texture, TEXTURE_UNITS.deflection);
    gl.uniform1i(uniforms.ray_inverse_radius_texture, TEXTURE_UNITS.inverseRadius);
    gl.uniform1i(uniforms.black_body_texture, TEXTURE_UNITS.blackBody);
    gl.uniform1i(uniforms.doppler_texture, TEXTURE_UNITS.doppler);
    gl.uniform1i(uniforms.noise_texture, TEXTURE_UNITS.noise);
    throwOnGlError(gl, 'Black hole program setup');

    let yaw = 0;
    let pitch = 0;

    /** Sizes the backing store to the budget and refits the projection to the drawable. */
    function resize(width: number, height: number, scale: number) {
      if (disposed) return;
      const resolution = algorithmResolution(width, height, budget, scale, deviceRatio());
      if (canvas.width !== resolution.width || canvas.height !== resolution.height) {
        canvas.width = resolution.width;
        canvas.height = resolution.height;
        gl.viewport(0, 0, resolution.width, resolution.height);
      }
      // Focal length from the drawable height, as in the upstream demo.
      const focal = resolution.height / (2 * Math.tan(CAMERA_FOV_Y / 2));
      gl.useProgram(linked);
      gl.uniform3f(uniforms.camera_size, resolution.width / 2, resolution.height / 2, focal);
      // Framing follows the drawable's aspect (the same aspect the projection uses), so the subject
      // keeps its place in the composition when the box is resized.
      gl.uniform2f(uniforms.view_center, ...blackHoleFraming(resolution.width / resolution.height));
    }

    const bounds = container.getBoundingClientRect();
    resize(bounds.width, bounds.height, 1);

    const scene: AlgorithmScene = {
      canvas,
      resize,
      frame(seconds, delta, pointer) {
        if (disposed || gl.isContextLost()) return;
        if (!Number.isFinite(seconds) || !Number.isFinite(delta))
          throw new RangeError('Black hole frame time must be finite');
        // The disc pattern turns on Schwarzschild time, at the static observer's own rate. The
        // upstream demo advances that time at the physical rate for its default mass (about 53
        // units per second); `disc.ts` fixes a much slower clock instead.
        const time = (DISC_TIME_SCALE * Math.max(seconds, 0)) / staticClockRate(CAMERA_RADIUS);
        const orbit = pointerOrbit(pointer);
        yaw = smoothToward(yaw, orbit.yaw, delta, ORBIT_RATE);
        pitch = smoothToward(pitch, orbit.pitch, delta, ORBIT_RATE);
        const camera = staticObserverUniforms({ time, yaw, pitch });
        gl.useProgram(linked);
        bindTextures(gl, tables);
        gl.uniform4f(uniforms.camera_position, ...camera.cameraPosition);
        gl.uniform3f(uniforms.p, ...camera.p);
        gl.uniform4f(uniforms.k_s, ...camera.kS);
        gl.uniform3f(uniforms.e_tau, ...camera.eTau);
        gl.uniform3f(uniforms.e_w, ...camera.eW);
        gl.uniform3f(uniforms.e_h, ...camera.eH);
        gl.uniform3f(uniforms.e_d, ...camera.eD);
        fullscreen.draw();
      },
      dispose: release,
    };
    return scene;
  } catch (error) {
    release();
    throw error;
  } finally {
    // createTextures closes it after upload; on an earlier failure nothing else does.
    noise?.close();
  }
};
