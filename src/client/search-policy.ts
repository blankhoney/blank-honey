/** Small edge target; the open panel remains a separate, larger safe area. */
export function searchTriggerHeight(viewportHeight: number) {
  return Math.min(64, viewportHeight * 0.08);
}

export const searchTiming = {
  enter: 180,
  leave: 450,
  retain: 60_000,
} as const;

export function searchCloseDelay(state: {
  protected: boolean;
  hasCriteria: boolean;
  elapsed: number;
}): number | null {
  if (state.protected) return null;
  return state.hasCriteria ? Math.max(0, searchTiming.retain - state.elapsed) : searchTiming.leave;
}
