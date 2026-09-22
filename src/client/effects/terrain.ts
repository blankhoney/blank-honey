import type { HeroContext } from '../hero';
import { mountAlgorithm } from '../algorithm-hero';

/* Procedural ridge noise terrain with distance fog; all textures are generated in the scene. */
export default function mountTerrain(context: HeroContext): Promise<void> {
  return mountAlgorithm(context, 'terrain', () => import('../algorithms/terrain/scene'));
}
