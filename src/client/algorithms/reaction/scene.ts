/**
 * Gray–Scott reaction-diffusion hero scene.
 *
 * Two RGBA8 textures hold the two chemical concentrations packed as 16-bit values (upstream's
 * encoding), so no float texture or extension is required. Every displayed frame injects the
 * pointer when it is down, runs a fixed number of simulation steps and draws the palette pass. The
 * scene owns no clock and no event listener: the shared hero runtime calls `frame`, `resize` and
 * `dispose`.
 */

import type { AlgorithmFactory, AlgorithmPointer, AlgorithmScene } from '../types';
import { algorithmResolution } from '../types';
import { FULLSCREEN_VERTEX, createSurface, program, triangle } from '../gl';
import {
  REACTION_BRUSH_FRAGMENT,
  REACTION_UPDATE_FRAGMENT,
} from '../../vendor/reaction/reaction-diffusion';
import { DISPLAY_CREST, DISPLAY_RELIEF, REACTION_DISPLAY_FRAGMENT } from './display';
import {
  GRAY_SCOTT_PARAMETERS,
  createSeededState,
  encodeState,
  reactionSettings,
} from './gray-scott';
import { pointerToGrid, sampledRegion } from './view';

/** Radius of the pointer disturbance as a fraction of the grid — 32 cells on the 512 grid. */
export const POINTER_RADIUS = 1 / 16;

type Target = { texture: WebGLTexture; framebuffer: WebGLFramebuffer };

function createTarget(gl: WebGL2RenderingContext, size: number, bytes: Uint8Array): Target {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    if (texture) gl.deleteTexture(texture);
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    throw new Error('Unable to allocate the reaction-diffusion targets');
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // RGBA8 and NEAREST: the packed value only decodes at a texel centre, so the display pass
  // interpolates the decoded values itself instead of asking the sampler to blend bytes.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    throw new Error(`Reaction-diffusion target is incomplete (${status})`);
  }
  return { texture, framebuffer };
}

export const createScene: AlgorithmFactory = (container, budget, signal) => {
  if (signal.aborted) throw new DOMException('Reaction scene request aborted', 'AbortError');
  const settings = reactionSettings(budget.light);
  const surface = createSurface(container);
  const gl = surface.gl;
  const canvas = surface.canvas;
  // The simulation textures carry data, not colour, so no per-channel rounding may depend on the
  // pixel position. Hardening only: CPU runs showed the field's fate is set by parameters and seed,
  // not by the sub-LSB dithering.
  gl.disable(gl.DITHER);
  const texelSize = 1 / settings.gridSize;
  let mesh: ReturnType<typeof triangle> | undefined;
  let updateProgram: WebGLProgram | undefined;
  let brushProgram: WebGLProgram | undefined;
  let displayProgram: WebGLProgram | undefined;
  let targets: [Target, Target] | undefined;
  let front = 0;
  let region = { x: 1, y: 1 };
  let disposed = false;

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (!gl.isContextLost()) {
      for (const target of targets ?? []) {
        gl.deleteFramebuffer(target.framebuffer);
        gl.deleteTexture(target.texture);
      }
      for (const shader of [updateProgram, brushProgram, displayProgram])
        if (shader) gl.deleteProgram(shader);
    }
    targets = undefined;
    updateProgram = undefined;
    brushProgram = undefined;
    displayProgram = undefined;
    mesh?.dispose();
    mesh = undefined;
    surface.dispose();
  }

  try {
    const seed = encodeState(createSeededState(settings.gridSize, settings.gridSize));
    const buffers: [Target, Target] = [
      createTarget(gl, settings.gridSize, seed),
      createTarget(gl, settings.gridSize, seed),
    ];
    targets = buffers;
    mesh = triangle(gl);
    updateProgram = program(gl, FULLSCREEN_VERTEX, REACTION_UPDATE_FRAGMENT);
    brushProgram = program(gl, FULLSCREEN_VERTEX, REACTION_BRUSH_FRAGMENT);
    displayProgram = program(gl, FULLSCREEN_VERTEX, REACTION_DISPLAY_FRAGMENT);
    const previousLocation = gl.getUniformLocation(updateProgram, 'uPreviousIteration');
    const updateTexelLocation = gl.getUniformLocation(updateProgram, 'uTexelSize');
    const ratesLocation = gl.getUniformLocation(updateProgram, 'uRates');
    const brushCenterLocation = gl.getUniformLocation(brushProgram, 'uCenter');
    const brushRadiusLocation = gl.getUniformLocation(brushProgram, 'uRadius');
    const stateLocation = gl.getUniformLocation(displayProgram, 'uState');
    const displayTexelLocation = gl.getUniformLocation(displayProgram, 'uTexelSize');
    const regionLocation = gl.getUniformLocation(displayProgram, 'uRegion');
    const reliefLocation = gl.getUniformLocation(displayProgram, 'uRelief');
    const crestLocation = gl.getUniformLocation(displayProgram, 'uCrest');

    /** Runs `count` simulation steps; each one reads `front` and draws into the other buffer. */
    function iterate(count: number) {
      gl.useProgram(updateProgram!);
      gl.uniform1i(previousLocation, 0);
      gl.uniform2f(updateTexelLocation, texelSize, texelSize);
      gl.uniform4f(
        ratesLocation,
        GRAY_SCOTT_PARAMETERS.feed,
        GRAY_SCOTT_PARAMETERS.kill,
        GRAY_SCOTT_PARAMETERS.diffuseA,
        GRAY_SCOTT_PARAMETERS.diffuseB,
      );
      gl.viewport(0, 0, settings.gridSize, settings.gridSize);
      gl.activeTexture(gl.TEXTURE0);
      for (let step = 0; step < count; step++) {
        gl.bindTexture(gl.TEXTURE_2D, buffers[front].texture);
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffers[1 - front].framebuffer);
        mesh!.draw();
        front = 1 - front;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /** Delivers the pointer disturbance upstream's brush writes: `vec2(1)` inside the circle. */
    function inject(x: number, y: number) {
      gl.useProgram(brushProgram!);
      gl.uniform2f(brushCenterLocation, x, y);
      gl.uniform1f(brushRadiusLocation, POINTER_RADIUS);
      gl.viewport(0, 0, settings.gridSize, settings.gridSize);
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffers[front].framebuffer);
      mesh!.draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function draw() {
      gl.useProgram(displayProgram!);
      gl.uniform1i(stateLocation, 0);
      gl.uniform2f(displayTexelLocation, texelSize, texelSize);
      gl.uniform2f(regionLocation, region.x, region.y);
      gl.uniform1f(reliefLocation, DISPLAY_RELIEF);
      gl.uniform1f(crestLocation, DISPLAY_CREST);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, buffers[front].texture);
      mesh!.draw();
    }

    function resize(width: number, height: number, scale: number) {
      if (disposed) return;
      const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
      const resolution = algorithmResolution(width, height, budget, scale, device);
      region = sampledRegion(
        resolution.width,
        resolution.height,
        settings.gridSize,
        settings.gridSize,
      );
      // Assigning the same size would still clear the drawing buffer, so only real changes resize.
      if (canvas.width !== resolution.width || canvas.height !== resolution.height) {
        canvas.width = resolution.width;
        canvas.height = resolution.height;
      }
      draw();
    }

    function frame(seconds: number, _delta: number, pointer: AlgorithmPointer) {
      if (disposed) return;
      if (!Number.isFinite(seconds)) throw new RangeError('Reaction time must be finite');
      if (pointer.active && (pointer.down || pointer.tap)) {
        const point = pointerToGrid(pointer.x, pointer.y, region);
        inject(point.x, point.y);
      }
      iterate(settings.updatesPerFrame);
      draw();
    }

    // Warm the colony up on the GPU before anything is drawn, then keep evolving it frame by frame.
    iterate(settings.prewarm);
    const bounds = container.getBoundingClientRect();
    resize(bounds.width, bounds.height, 1);

    return { canvas, resize, frame, dispose } satisfies AlgorithmScene;
  } catch (error) {
    dispose();
    throw error;
  }
};
