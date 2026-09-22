import { WebGLRenderer } from 'three';
import {
  algorithmResolution,
  type AlgorithmBudget,
  type AlgorithmFactory,
  type AlgorithmPointer,
  type AlgorithmScene,
} from '../types';
import { oceanConfig } from './config';
import { LOOK, pointerYaw, smoothYaw } from './look';
import { createPassFactory } from './pass';
import { resourceSet } from './resources';
import { createOceanSimulation } from './simulation';
import { createOceanSurface } from './render';

export type OceanUnsupportedCode =
  /** No WebGL2 context at all. */
  | 'webgl2'
  /** WebGL2 without EXT_color_buffer_float: the FFT cannot render to float targets. */
  | 'float-render-target';

/**
 * Thrown, never silently degraded, when the device cannot run the real spectral
 * simulation. `name` is stable so a caller can detect it without importing this
 * module: the runtime must fall back to the static hero instead of showing a
 * different wave algorithm that pretends to be this one.
 */
export class OceanUnsupportedError extends Error {
  readonly code: OceanUnsupportedCode;

  constructor(code: OceanUnsupportedCode, message: string) {
    super(message);
    this.name = 'OceanUnsupportedError';
    this.code = code;
  }
}

export function isOceanUnsupportedError(error: unknown): error is OceanUnsupportedError {
  return error instanceof Error && error.name === 'OceanUnsupportedError';
}

/** Attribute set of the one context the scene creates. */
const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: true,
  stencil: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
  failIfMajorPerformanceCaveat: false,
};

/**
 * Smallest sensible warm-up render. Two cascade simulation steps dominate the
 * cost, not these pixels, so there is nothing to gain from a larger buffer.
 */
const WARMUP_EDGE = 64;

const MAX_STEP_SECONDS = 0.25;

type ShaderDiagnostics = {
  program: string;
  vertex: string;
  fragment: string;
};

export const createScene: AlgorithmFactory = (
  container: HTMLElement,
  budget: AlgorithmBudget,
  signal: AbortSignal,
): AlgorithmScene => {
  if (signal.aborted)
    throw new DOMException('Ocean scene was aborted before construction', 'AbortError');

  const config = oceanConfig(budget);
  const ownerDocument = container.ownerDocument;
  const canvas = ownerDocument.createElement('canvas');
  canvas.className = 'algorithm-ocean-canvas';
  canvas.dataset.algorithm = 'ocean';
  canvas.style.display = 'block';
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';

  // The FFT cannot run without float render targets, and a look-alike substitute
  // is not the surface this scene claims to be, so say so instead of degrading.
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', CONTEXT_ATTRIBUTES) as WebGL2RenderingContext | null;
  } catch {
    gl = null;
  }
  if (!gl)
    throw new OceanUnsupportedError('webgl2', 'WebGL2 is unavailable for the ocean scene');

  const context = gl;
  const resources = resourceSet();
  // The context is owned here, not by the page, so it is the first resource in:
  // reverse-order release makes it the last one out, after every render target,
  // material and geometry is gone. Registering it before the capability checks
  // is what keeps a half-built scene from stranding a live context.
  resources.add({
    dispose: () => {
      context.getExtension('WEBGL_lose_context')?.loseContext();
    },
  });

  let disposed = false;
  let yaw: number = LOOK.cameraBaseYaw;

  try {
    if (!context.getExtension('EXT_color_buffer_float'))
      throw new OceanUnsupportedError(
        'float-render-target',
        'EXT_color_buffer_float is unavailable; the ocean FFT needs float render targets',
      );
    context.getExtension('EXT_float_blend');

    // The canvas is a child of the container, which the layer's CSS sizes and
    // hides until the first successful frame; a failed construction must not
    // leave it behind, so it goes into the resource set that releases it.
    container.append(canvas);
    resources.add({ dispose: () => canvas.remove() });

    const renderer = new WebGLRenderer({
      canvas,
      context,
      alpha: false,
      antialias: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    renderer.autoClear = false;
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 1);
    // Three does not own this context, so it must not lose it: the context
    // disposable above is the only place that happens, exactly once.
    resources.add({ dispose: () => renderer.dispose() });

    const passes = createPassFactory(renderer);
    resources.add(passes);
    const simulation = createOceanSimulation(renderer, passes, config, LOOK);
    resources.add(simulation);
    const surface = createOceanSurface(renderer, passes, config, LOOK, simulation);
    resources.add(surface);
    surface.setYaw(yaw);

    /**
     * One real frame at construction cost: shader link failures and render
     * target allocation errors surface here, where the caller still has a
     * fallback, rather than as a silently blank canvas on the first tick. It
     * also means the canvas already holds the scene when it is first shown.
     */
    function warmUp() {
      const diagnostics: ShaderDiagnostics[] = [];
      const previousHandler = renderer.debug.onShaderError;
      renderer.debug.onShaderError = (context, program, vertexShader, fragmentShader) => {
        diagnostics.push({
          program: context.getProgramInfoLog(program) ?? '',
          vertex: context.getShaderInfoLog(vertexShader) ?? '',
          fragment: context.getShaderInfoLog(fragmentShader) ?? '',
        });
        previousHandler?.(context, program, vertexShader, fragmentShader);
      };
      try {
        renderer.setSize(2, 2, false);
        surface.resizeTargets(WARMUP_EDGE, WARMUP_EDGE);
        simulation.simulate(0, 0);
        surface.renderFrame(0);
      } finally {
        renderer.debug.onShaderError = previousHandler;
      }
      if (diagnostics.length > 0) {
        const detail = diagnostics
          .map((entry) => [entry.program, entry.vertex, entry.fragment].filter(Boolean).join('\n'))
          .join('\n');
        throw new Error(`Ocean shader program failed to link:\n${detail}`);
      }
    }
    warmUp();

    function resize(width: number, height: number, scale: number) {
      if (disposed) return;
      const cssWidth = Number.isFinite(width) && width > 0 ? width : 1;
      const cssHeight = Number.isFinite(height) && height > 0 ? height : 1;
      const deviceRatio = ownerDocument.defaultView?.devicePixelRatio ?? 1;
      const pixels = algorithmResolution(cssWidth, cssHeight, budget, scale, deviceRatio);
      // Three draws at DPR 1 into an already-reduced buffer: applying the device
      // ratio here as well would multiply the downshift in twice.
      renderer.setPixelRatio(1);
      renderer.setSize(pixels.width, pixels.height, false);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      surface.resizeTargets(pixels.width, pixels.height);
    }

    function frame(seconds: number, delta: number, pointer: AlgorithmPointer) {
      if (disposed) return;
      const time = Number.isFinite(seconds) ? seconds : 0;
      const step = Number.isFinite(delta) ? Math.min(MAX_STEP_SECONDS, Math.max(0, delta)) : 0;
      // Frame-driven smoothing: the scene owns no clock of its own.
      yaw = smoothYaw(yaw, pointerYaw(pointer ?? {}, LOOK), step, LOOK.yawResponse);
      simulation.simulate(time, step);
      surface.setYaw(yaw);
      surface.renderFrame(time);
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      signal.removeEventListener('abort', dispose);
      resources.dispose();
    }

    signal.addEventListener('abort', dispose, { once: true });

    return { canvas, resize, frame, dispose };
  } catch (error) {
    resources.dispose();
    throw error;
  }
};
