import { capability } from './preferences';
import type { AtmosphereHandle } from './atmosphere';

type Span = { left: number; right: number };
type Gutter = { left: number; width: number };

/** Keep the whole reading column (including its displaced TOC) free of moving ink. */
export function paperGutters(viewport: number, main: Span, quiet: Span[]): [Gutter, Gutter] {
  const left = Math.max(0, Math.min(viewport, main.left));
  const right = Math.max(left, Math.min(viewport, main.right));
  const columns = quiet.filter((span) => span.right > span.left);
  const contentLeft = columns.length ? Math.min(...columns.map((span) => span.left)) : left;
  const contentRight = columns.length ? Math.max(...columns.map((span) => span.right)) : right;
  // Six pixels of separation remain even when an open mobile sidebar leaves narrow gutters.
  return [
    { left, width: Math.max(0, Math.min(right, contentLeft - 6) - left) },
    {
      left: Math.max(left, Math.min(right, contentRight + 6)),
      width: Math.max(0, right - Math.max(left, contentRight + 6)),
    },
  ];
}

export function leavesPerGutter(mode: ReturnType<typeof capability>) {
  return mode === 'reduced-motion' ? 0 : mode === 'light' ? 2 : 5;
}

const namespace = 'http://www.w3.org/2000/svg';
const silhouettes = [
  'M17 2C6 8 2 18 7 27c3 6 10 9 15 4 8-7 5-19-5-29Z',
  'M17 3 13 12 5 8 8 18 2 21 11 25 12 33 19 29 26 32 25 24 32 19 23 17 24 8 19 12Z',
  'M18 3C9 5 3 12 3 20c0 7 6 11 13 10 10-1 16-12 17-25-5 2-10 2-15-2Z',
];

function leaf(index: number, side: number) {
  const wrapper = document.createElement('span');
  wrapper.className = 'paper-leaf';
  const duration = 29 + ((index * 7 + side * 3) % 17);
  wrapper.style.setProperty('--leaf-x', `${14 + ((index * 37 + side * 23) % 72)}%`);
  wrapper.style.setProperty('--leaf-size', `${14 + ((index * 3 + side * 2) % 10)}px`);
  wrapper.style.setProperty('--leaf-duration', `${duration}s`);
  wrapper.style.setProperty('--leaf-delay', `${-((index + side * 2 + 1) * 7.3) % duration}s`);
  wrapper.style.setProperty('--leaf-sway-duration', `${5 + ((index + side) % 4)}s`);
  wrapper.style.setProperty('--leaf-turn', `${-35 + ((index * 31 + side * 18) % 80)}deg`);
  const figure = document.createElementNS(namespace, 'svg');
  figure.setAttribute('viewBox', '0 0 36 42');
  figure.setAttribute('focusable', 'false');
  const outline = document.createElementNS(namespace, 'path');
  outline.setAttribute('d', silhouettes[(index + side) % silhouettes.length]);
  outline.setAttribute('fill', 'currentColor');
  const veins = document.createElementNS(namespace, 'path');
  veins.setAttribute('d', 'M17 10c0 10 1 18-3 29m3-16-6-7m6 13 6-8');
  veins.setAttribute('fill', 'none');
  veins.setAttribute('stroke', 'currentColor');
  veins.setAttribute('stroke-width', '1.1');
  veins.setAttribute('stroke-linecap', 'round');
  figure.append(outline, veins);
  wrapper.append(figure);
  return wrapper;
}

/** CSS does the idle animation; JS only responds to layout, visibility and route changes. */
export function mountPaperAtmosphere(
  signal: AbortSignal,
  host?: HTMLElement,
): AtmosphereHandle | undefined {
  if (signal.aborted || capability() === 'reduced-motion') return;
  const main = document.querySelector<HTMLElement>('#main');
  if (!main) return;
  const layer = document.createElement('div');
  layer.className = 'paper-atmosphere';
  layer.dataset.tone = document.documentElement.dataset.tone;
  layer.setAttribute('aria-hidden', 'true');
  let held = false;
  let disposed = false;
  const bands = [0, 1].map((side) => {
    const band = document.createElement('div');
    band.className = 'paper-gutter';
    band.append(...Array.from({ length: 5 }, (_, index) => leaf(index, side)));
    layer.append(band);
    return band;
  });
  (host ?? document.body).append(layer);

  const reading = main.querySelector<HTMLElement>('.reading-column');
  const journal = main.querySelector<HTMLElement>('.journal');
  const toc = main.querySelector<HTMLElement>('.article-toc-rail');
  const back = main.querySelector<HTMLElement>('.reading-page > .back');
  function updateLayout() {
    // A departing scene keeps its old geometry after Astro removes the old main.
    if (disposed || signal.aborted || held) return;
    const quiet: Span[] = [];
    for (const element of [reading, toc, back]) {
      if (element && element.getClientRects().length) quiet.push(element.getBoundingClientRect());
    }
    if (journal) {
      const bounds = journal.getBoundingClientRect();
      const style = getComputedStyle(journal);
      quiet.push({
        left: bounds.left + (parseFloat(style.paddingLeft) || 0),
        right: bounds.right - (parseFloat(style.paddingRight) || 0),
      });
    }
    const mode = capability();
    layer.dataset.mode = mode;
    const gutters = paperGutters(
      document.documentElement.clientWidth,
      main!.getBoundingClientRect(),
      quiet,
    );
    bands.forEach((band, side) => {
      const gutter = gutters[side];
      band.hidden = gutter.width < 8;
      band.style.left = `${gutter.left}px`;
      band.style.width = `${gutter.width}px`;
      band.style.setProperty('--leaf-sway', `${Math.min(10, gutter.width / 8)}px`);
      Array.from(band.children).forEach((child, index) => {
        (child as HTMLElement).hidden = index >= leavesPerGutter(mode);
      });
    });
  }
  const visibility = () => {
    layer.dataset.paused = String(held || document.hidden);
  };
  const observer = new ResizeObserver(updateLayout);
  for (const element of [main, reading, journal, toc, back]) {
    if (element) observer.observe(element);
  }
  document.addEventListener('visibilitychange', visibility, { signal });
  window.addEventListener('resize', updateLayout, { signal });
  function dispose() {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('resize', updateLayout);
    signal.removeEventListener('abort', dispose);
    layer.remove();
  }
  signal.addEventListener('abort', dispose, { once: true });
  updateLayout();
  visibility();
  return {
    element: layer,
    pause(paused) {
      if (disposed) return;
      held = paused;
      visibility();
      if (!held) updateLayout();
    },
    dispose,
  };
}
