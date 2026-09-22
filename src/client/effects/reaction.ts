import type { HeroContext } from '../hero';
import { mountAlgorithm } from '../algorithm-hero';

/* Gray-Scott reaction diffusion in ping-pong targets; the pointer seeds the growth. */
export default function mountReaction(context: HeroContext): Promise<void> {
  return mountAlgorithm(context, 'reaction', () => import('../algorithms/reaction/scene'));
}
