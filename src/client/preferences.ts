export const store = {
  get(key: string, fallback = '') {
    try {
      return localStorage.getItem(`bh:${key}`) || fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(`bh:${key}`, value);
    } catch {}
  },
};
export function capability() {
  if (
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    store.get('motion') === 'reduced-motion'
  )
    return 'reduced-motion';
  if (
    store.get('motion') === 'light' ||
    innerWidth <= 700 ||
    (navigator as Navigator & { connection?: { saveData: boolean } }).connection?.saveData
  )
    return 'light';
  return 'full';
}
export function tone() {
  const pref = store.get('theme', 'auto');
  if (pref === 'light' || pref === 'dark') return pref;
  const hour = new Date().getHours();
  return Number.isFinite(hour)
    ? hour >= 7 && hour < 19
      ? 'light'
      : 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
}
/** Giscus loads its own stylesheet because it lives in a cross-origin iframe. */
export function commentTheme() {
  return new URL(`/giscus/${tone()}.css`, window.location.origin).href;
}
export function applyPreferences() {
  const next = tone(),
    changed = document.documentElement.dataset.tone !== next;
  document.documentElement.dataset.tone = next;
  if (changed) document.dispatchEvent(new Event('bh:theme'));
  document.documentElement.dataset.motion = capability();
  for (const key of ['theme', 'motion'])
    document
      .querySelectorAll<HTMLButtonElement>(`button[data-${key}]`)
      .forEach((b) =>
        b.setAttribute(
          'aria-pressed',
          String(
            b.dataset[key] ===
              (['auto', 'light', 'dark', 'reduced-motion'].includes(store.get(key, 'auto'))
                ? store.get(key, 'auto')
                : 'auto'),
          ),
        ),
      );
  const frame = document.querySelector<HTMLIFrameElement>('.giscus-frame');
  frame?.contentWindow?.postMessage(
    { giscus: { setConfig: { theme: commentTheme() } } },
    'https://giscus.app',
  );
}
