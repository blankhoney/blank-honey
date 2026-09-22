import type { HeroContext } from '../hero';
import { mountAlgorithm } from '../algorithm-hero';

/* Wind spectrum plus FFT sea; the scene module carries the whole simulation. */
export default function mountOcean(context: HeroContext): Promise<void> {
  return mountAlgorithm(context, 'ocean', () => import('../algorithms/ocean/scene'));
}
