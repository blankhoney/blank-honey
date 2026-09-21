const frameScales = [1, 0.8, 0.65] as const;
const warmupSamples = 15;

export type FrameBudget = {
  sample: (intervalMs: number) => number | undefined;
  reset: () => void;
};

/** A one-way scale ladder; callers reset sampling after resize or background suspension. */
export function createFrameBudget(fps: number): FrameBudget {
  if (!Number.isFinite(fps) || fps <= 0)
    throw new RangeError('Frame rate must be positive and finite');
  const slowInterval = (1000 / fps) * 1.3;
  let level = 0;
  let warmup = warmupSamples;
  let sum = 0;
  let count = 0;
  return {
    sample(intervalMs) {
      if (!Number.isFinite(intervalMs) || intervalMs <= 0) return undefined;
      if (warmup > 0) {
        warmup--;
        return undefined;
      }
      sum += intervalMs;
      count++;
      if (sum < 2000 || count < 15) return undefined;
      const average = sum / count;
      sum = 0;
      count = 0;
      if (average <= slowInterval || level >= frameScales.length - 1) return undefined;
      warmup = warmupSamples;
      return frameScales[++level];
    },
    reset() {
      sum = 0;
      count = 0;
      warmup = warmupSamples;
    },
  };
}

function actualSize(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.min(32768, Math.max(1, value)) : 1;
}

export function flockPixelRatio(
  width: number,
  height: number,
  dpr: number,
  maxDpr: number,
  maxPixels: number,
  scale = 1,
): number {
  if (!Number.isFinite(maxDpr) || maxDpr <= 0)
    throw new RangeError('DPR budget must be positive and finite');
  if (!Number.isFinite(maxPixels) || maxPixels <= 0)
    throw new RangeError('Pixel budget must be positive and finite');
  const w = actualSize(width);
  const h = actualSize(height);
  const deviceRatio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const resolutionScale = Number.isFinite(scale) ? Math.min(1, Math.max(0.65, scale)) : 1;
  // Scale after the caps: DPR 2 must still lose pixels when its budget is already capped at 1.25.
  return Math.min(deviceRatio, maxDpr, Math.sqrt(maxPixels / w / h)) * resolutionScale;
}
