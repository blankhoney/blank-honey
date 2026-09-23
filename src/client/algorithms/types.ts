export type AlgorithmId = 'blackhole' | 'ocean' | 'reaction' | 'terrain';

export type AlgorithmBudget = {
  light: boolean;
  fps: number;
  maxPixels: number;
  maxDpr: number;
};

/** Stage coordinates: x/y in [-1, 1], positive y points up. Tap lasts one rendered frame. */
export type AlgorithmPointer = {
  x: number;
  y: number;
  active: boolean;
  down: boolean;
  tap: boolean;
};

export type AlgorithmScene = {
  canvas: HTMLCanvasElement;
  resize(width: number, height: number, scale: number): void;
  frame(seconds: number, delta: number, pointer: AlgorithmPointer): void;
  dispose(): void;
};

export type AlgorithmFactory = (
  container: HTMLElement,
  budget: AlgorithmBudget,
  signal: AbortSignal,
) => AlgorithmScene | Promise<AlgorithmScene>;

/** Apply quality scale after the device/pixel caps so a slow device really does downshift. */
export function algorithmResolution(
  width: number,
  height: number,
  budget: AlgorithmBudget,
  scale: number,
  deviceRatio = 1,
) {
  const w = Math.max(1, Number.isFinite(width) ? width : 1);
  const h = Math.max(1, Number.isFinite(height) ? height : 1);
  const dpr = Number.isFinite(deviceRatio) ? Math.max(0.1, deviceRatio) : 1;
  const quality = Number.isFinite(scale) ? Math.max(0.1, Math.min(1, scale)) : 1;
  const ratio = Math.min(dpr, budget.maxDpr, Math.sqrt(budget.maxPixels / (w * h))) * quality;
  return {
    width: Math.max(1, Math.floor(w * ratio)),
    height: Math.max(1, Math.floor(h * ratio)),
    ratio,
  };
}
