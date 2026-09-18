/** Small edge target; the open panel remains a separate, larger safe area. */
export function searchTriggerHeight(viewportHeight: number) {
  return Math.min(16, viewportHeight);
}

/** An open search must leave the article's visible return row clickable. */
export function searchPanelTop(
  back: { top: number; bottom: number } | null,
  viewport: number,
): number {
  if (
    !back ||
    ![back.top, back.bottom, viewport].every(Number.isFinite) ||
    viewport <= 0 ||
    back.bottom < back.top ||
    back.bottom <= 0 ||
    back.top >= viewport
  )
    return 24;
  return Math.max(24, back.bottom + 12);
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
