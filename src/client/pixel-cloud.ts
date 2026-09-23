import { ShaderMount, ditheringFragmentShader } from '@paper-design/shaders';
import { pixelCloudShader } from './pixel-cloud-shader';
import { report } from './log';

export type PixelCloudBudget = {
  light: boolean;
  fps: number;
  maxPixels: number;
  pixelSize: number;
};
export type PixelCloudScene = {
  canvas: HTMLCanvasElement;
  frame(seconds: number): void;
  resize(width: number, height: number, scale: number): void;
  dispose(): void;
};
type PaperScene = Pick<
  ShaderMount,
  'canvasElement' | 'setFrame' | 'setUniforms' | 'setMaxPixelCount' | 'dispose'
>;
type PaperFactory = (
  container: HTMLElement,
  source: string,
  uniforms: Record<string, number | number[]>,
  maxPixels: number,
) => PaperScene;

export function pixelCloudResolution(
  width: number,
  height: number,
  budget: PixelCloudBudget,
  scale = 1,
) {
  if (!Number.isFinite(budget.maxPixels) || budget.maxPixels < 1)
    throw new RangeError('Cloud pixel budget must be positive and finite');
  if (!Number.isFinite(budget.pixelSize) || budget.pixelSize <= 0)
    throw new RangeError('Cloud pixel size must be positive and finite');
  const dimension = (value: number) =>
    Number.isFinite(value) ? Math.max(1, Math.min(32768, value)) : 1;
  const w = dimension(width);
  const h = dimension(height);
  const area = w * h;
  const factor = Number.isFinite(scale) ? Math.max(0.65, Math.min(1, scale)) : 1;
  const target = Math.max(1, Math.floor(Math.min(budget.maxPixels, area) * factor * factor));
  // Paper rounds both canvas dimensions: reserve their combined half-pixel overshoot.
  const rounding = Math.ceil(0.5 * (w + h) * Math.sqrt(target / area) + 0.25);
  const maxPixels = Math.max(1, target - rounding);
  return { maxPixels, pixelSize: Math.max(budget.pixelSize, Math.sqrt(area / maxPixels)) };
}

const mountPaper: PaperFactory = (container, source, uniforms, maxPixels) =>
  new ShaderMount(
    container,
    source,
    uniforms,
    { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' },
    0,
    0,
    1,
    maxPixels,
  );

/** Paper supplies rendering, but only the effect owner advances its public frame clock. */
export function createPixelCloudScene(
  container: HTMLElement,
  budget: PixelCloudBudget,
  mount: PaperFactory = mountPaper,
): PixelCloudScene {
  const surface = document.createElement('div');
  surface.className = 'pixel-cloud-surface';
  container.append(surface);
  let paper: PaperScene | undefined;
  let disposed = false;
  let verified = false;
  let lastPixels = 0;
  let lastPixelSize = 0;
  function dispose() {
    if (disposed) return;
    disposed = true;
    // Capture even a canvas left behind by a throwing constructor, before Paper removes it.
    const canvases = Array.from(surface.querySelectorAll('canvas'));
    try {
      paper?.dispose();
    } catch (error) {
      report('pixel-cloud:dispose', error);
    } finally {
      for (const canvas of canvases) {
        try {
          const gl = canvas.getContext('webgl2');
          if (gl && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
        } catch (error) {
          report('pixel-cloud:context', error);
        }
      }
      surface.remove();
    }
  }
  try {
    const bounds = container.getBoundingClientRect();
    const resolution = pixelCloudResolution(bounds.width, bounds.height, budget);
    lastPixels = resolution.maxPixels;
    lastPixelSize = resolution.pixelSize;
    paper = mount(
      surface,
      pixelCloudShader(ditheringFragmentShader, budget.light),
      {
        u_colorBack: [0, 0, 0, 1],
        u_colorFront: [0.82, 0.8, 0.75, 1],
        u_shape: 1,
        u_type: 4,
        u_pxSize: lastPixelSize,
        u_fit: 2,
        u_scale: 0.48,
        u_rotation: 0,
        u_originX: 0.5,
        u_originY: 0.5,
        u_offsetX: 0,
        u_offsetY: 0,
        u_worldWidth: 0,
        u_worldHeight: 0,
      },
      lastPixels,
    );
    const instance = paper;
    const canvas = instance.canvasElement;
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('Pixel cloud requires WebGL2');
    return {
      canvas,
      frame(seconds) {
        if (disposed) return;
        if (!Number.isFinite(seconds)) throw new RangeError('Cloud time must be finite');
        instance.setFrame(Math.max(0, seconds) * 1000);
        if (!verified) {
          const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
          if (gl.isContextLost() || !program || !gl.getProgramParameter(program, gl.LINK_STATUS))
            throw new Error('Pixel cloud shader did not initialize');
          verified = true;
        }
      },
      resize(width, height, scale) {
        if (disposed) return;
        const next = pixelCloudResolution(width, height, budget, scale);
        if (next.maxPixels !== lastPixels) {
          instance.setMaxPixelCount(next.maxPixels);
          lastPixels = next.maxPixels;
        }
        if (next.pixelSize !== lastPixelSize) {
          instance.setUniforms({ u_pxSize: next.pixelSize });
          lastPixelSize = next.pixelSize;
        }
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
