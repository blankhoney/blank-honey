import type { HeroContext } from '../hero';
import { mountAlgorithm } from '../algorithm-hero';

/* Lensed accretion disk with measured LUTs; the GPU work only loads for this effect. */
export default function mountBlackhole(context: HeroContext): Promise<void> {
  return mountAlgorithm(context, 'blackhole', () => import('../algorithms/blackhole/scene'));
}
