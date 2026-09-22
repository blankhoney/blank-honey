import { algorithmResolution } from '../types';
import type { AlgorithmBudget, AlgorithmFactory, AlgorithmPointer, AlgorithmScene } from '../types';
import { FULLSCREEN_VERTEX, createSurface, program, triangle } from '../gl';
import { mandelbulbFraming, mandelbulbMotion, mandelbulbQuality } from './model';
import type { MandelbulbFraming, MandelbulbQuality } from './model';
import { mandelbulbFragment } from './shader';

/**
 * Mandelbulb hero scene: one fullscreen triangle, one program, no requestAnimationFrame and no
 * global listener. The shared algorithm runtime owns the clock, visibility and pixel budget and
 * calls `frame` / `resize`; this file only feeds uniforms and draws.
 *
 * Derived from ibrews/mandelbulb-xr (MIT, Copyright (c) 2026 Alex Coulombe / Agile Lens), commit
 * 4b67dde1f420e9bba726d34a396ffb3fd0a2931b — see src/client/vendor/mandelbulb/README.md.
 */

type MandelbulbUniforms = {
  time: WebGLUniformLocation;
  aspect: WebGLUniformLocation;
  cam: WebGLUniformLocation;
  framing: WebGLUniformLocation;
  power: WebGLUniformLocation;
  pulse: WebGLUniformLocation;
};

type MandelbulbResources = {
  linked: WebGLProgram;
  fullscreen: { draw(): void; dispose(): void };
  uniforms: MandelbulbUniforms;
};

function aborted() {
  const error = new Error('Mandelbulb scene construction was aborted');
  error.name = 'AbortError';
  return error;
}

/** A shader without the uniform this file sets is a source mismatch, not something to render around. */
function locate(gl: WebGL2RenderingContext, linked: WebGLProgram, name: string) {
  const location = gl.getUniformLocation(linked, name);
  if (!location) throw new Error(`Mandelbulb shader is missing ${name}`);
  return location;
}

/** Builds the program and its vertex array; anything half built is released before the error leaves. */
function build(
  gl: WebGL2RenderingContext,
  quality: MandelbulbQuality,
  signal: AbortSignal,
): MandelbulbResources {
  const linked = program(gl, FULLSCREEN_VERTEX, mandelbulbFragment(quality));
  let fullscreen: { draw(): void; dispose(): void } | undefined;
  try {
    fullscreen = triangle(gl);
    const uniforms = {
      time: locate(gl, linked, 'u_time'),
      aspect: locate(gl, linked, 'u_aspect'),
      cam: locate(gl, linked, 'u_cam'),
      framing: locate(gl, linked, 'u_framing'),
      power: locate(gl, linked, 'u_power'),
      pulse: locate(gl, linked, 'u_pulse'),
    };
    if (signal.aborted) throw aborted();
    return { linked, fullscreen, uniforms };
  } catch (error) {
    fullscreen?.dispose();
    gl.deleteProgram(linked);
    throw error;
  }
}

function deviceRatio() {
  const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

export const createScene: AlgorithmFactory = (container, budget, signal) => {
  if (signal.aborted) throw aborted();
  const quality = mandelbulbQuality(budget);
  // The surface is created first, so an unavailable WebGL2 leaves the container exactly as it was.
  const surface = createSurface(container);
  const gl = surface.gl;
  let resources: MandelbulbResources;
  try {
    resources = build(gl, quality, signal);
  } catch (error) {
    surface.dispose();
    throw error;
  }
  const { linked, fullscreen, uniforms } = resources;
  const resolution: AlgorithmBudget = {
    ...budget,
    maxPixels: quality.maxPixels,
    maxDpr: quality.maxDpr,
  };
  let disposed = false;
  let aspect = 1;
  let framing: MandelbulbFraming = mandelbulbFraming(aspect);

  function resize(width: number, height: number, scale: number) {
    if (disposed) return;
    const size = algorithmResolution(width, height, resolution, scale, deviceRatio());
    if (surface.canvas.width !== size.width) surface.canvas.width = size.width;
    if (surface.canvas.height !== size.height) surface.canvas.height = size.height;
    gl.viewport(0, 0, size.width, size.height);
    aspect = size.width / size.height;
    framing = mandelbulbFraming(aspect);
  }

  function frame(seconds: number, _delta: number, pointer: AlgorithmPointer) {
    if (disposed) return;
    const motion = mandelbulbMotion(seconds, pointer);
    gl.useProgram(linked);
    gl.uniform1f(uniforms.time, motion.time);
    gl.uniform1f(uniforms.aspect, aspect);
    gl.uniform2f(uniforms.cam, motion.yaw, motion.pitch);
    gl.uniform3f(uniforms.framing, framing.centerX, framing.centerY, framing.zoom);
    gl.uniform1f(uniforms.power, motion.power);
    gl.uniform1f(uniforms.pulse, motion.pulse);
    fullscreen.draw();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    fullscreen.dispose();
    gl.deleteProgram(linked);
    surface.dispose();
  }

  return { canvas: surface.canvas, resize, frame, dispose };
};
