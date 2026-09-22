import type { HeroContext } from '../hero';
import { mountAlgorithm } from '../algorithm-hero';

/* Distance-estimated fractal; the ray marcher is a single fullscreen program. */
export default function mountMandelbulb(context: HeroContext): Promise<void> {
  return mountAlgorithm(context, 'mandelbulb', () => import('../algorithms/mandelbulb/scene'));
}
