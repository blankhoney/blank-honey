import type { HeroContext } from '../hero';
import { mountAlgorithm } from '../algorithm-hero';
import { loadBlackHoleAssets } from '../algorithms/blackhole/assets';

const loadScene = () => import('../algorithms/blackhole/scene');

/** Fetch the tables alongside the scene code, without constructing its GPU resources. */
export async function preload(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  // import() cannot be cancelled. Keep the speculative slot until it settles even if fetch aborts.
  const results = await Promise.allSettled([loadScene(), loadBlackHoleAssets(signal)]);
  for (const result of results) if (result.status === 'rejected') throw result.reason;
}

/* Lensed accretion disk with measured LUTs; the GPU work only runs for this effect. */
export default function mountBlackhole(context: HeroContext): Promise<void> {
  return mountAlgorithm(context, 'blackhole', loadScene);
}
