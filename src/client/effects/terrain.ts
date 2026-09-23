import type { HeroContext } from '../hero';
import { mountAlgorithm } from '../algorithm-hero';

const loadScene = () => import('../algorithms/terrain/scene');

export async function preload(signal: AbortSignal): Promise<void> {
  if (!signal.aborted) await loadScene();
}

/* Procedural ridge noise terrain with distance fog; all textures are generated in the scene. */
export default function mountTerrain(context: HeroContext): Promise<void> {
  return mountAlgorithm(context, 'terrain', loadScene);
}
