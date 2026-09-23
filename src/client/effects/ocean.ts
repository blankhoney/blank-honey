import type { HeroContext } from '../hero';
import { mountAlgorithm } from '../algorithm-hero';

const loadScene = () => import('../algorithms/ocean/scene');

export async function preload(signal: AbortSignal): Promise<void> {
  if (!signal.aborted) await loadScene();
}

/* Wind spectrum plus FFT sea; the scene module carries the whole simulation. */
export default function mountOcean(context: HeroContext): Promise<void> {
  return mountAlgorithm(context, 'ocean', loadScene);
}
