import { capability } from './preferences';

/** Fade only at the viewport edges, including blocks taller than the viewport. */
export function readingFrame(top: number, height: number, viewport: number, distance = 18) {
  if (![top, height, viewport, distance].every(Number.isFinite) || height <= 0 || viewport <= 0)
    return { opacity: 1, translateY: 0 };

  const band = Math.min(height / 2, Math.max(48, Math.min(96, viewport * 0.12)));
  const entering = (viewport - top) / band;
  const leaving = (top + height) / band;
  const progress = Math.max(0, Math.min(1, entering, leaving));
  const opacity = progress * progress * (3 - 2 * progress);
  const direction = leaving < entering ? -1 : 1;
  return {
    opacity,
    translateY: opacity === 1 || distance <= 0 ? 0 : direction * distance * (1 - opacity),
  };
}

export function mountReadingMotion(signal: AbortSignal) {
  if (signal.aborted) return;
  const article = document.querySelector<HTMLElement>('#main[data-article] .reading-column');
  const prose = article?.querySelector<HTMLElement>('.prose');
  if (
    !article ||
    !prose ||
    typeof IntersectionObserver === 'undefined' ||
    typeof ResizeObserver === 'undefined'
  )
    return;

  const header = article.querySelector<HTMLElement>(':scope > header');
  const blocks = [header, ...prose.children].filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement &&
      !node.hidden &&
      !['SCRIPT', 'STYLE', 'LINK'].includes(node.tagName),
  );
  if (!blocks.length) return;

  const active = new Set<HTMLElement>();
  const pending = new Set<HTMLElement>();
  let observer: IntersectionObserver | undefined;
  let resize: ResizeObserver | undefined;
  let frame = 0;
  let generation = 0;
  let enabled = false;
  let all = false;
  let printing = false;

  function restore() {
    for (const block of blocks) {
      block.removeAttribute('data-reading-motion');
      block.style.removeProperty('--reading-opacity');
      block.style.removeProperty('--reading-y');
    }
  }

  function cancelFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function stop() {
    generation++;
    enabled = false;
    cancelFrame();
    observer?.disconnect();
    resize?.disconnect();
    observer = undefined;
    resize = undefined;
    active.clear();
    pending.clear();
    all = false;
    restore();
  }

  function schedule(everyBlock = false) {
    if (!enabled || printing || document.hidden || signal.aborted) return;
    all ||= everyBlock;
    // Event-driven only: a still page has no animation loop or scroll catch-up.
    if (!frame)
      frame = requestAnimationFrame(() => {
        try {
          render();
        } catch (error) {
          stop();
          throw error;
        }
      });
  }

  function render() {
    frame = 0;
    if (!enabled || printing || document.hidden || signal.aborted) return;
    const mode = capability();
    if (mode === 'reduced-motion') {
      stop();
      return;
    }
    let target: HTMLElement | null = null;
    try {
      target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    } catch {
      // A malformed URL fragment must not disable readable content.
    }
    const selection = document.getSelection();
    const selecting = selection && !selection.isCollapsed;
    const candidates = all ? blocks : [...new Set([...active, ...pending])];
    all = false;
    pending.clear();

    // Read all geometry first. Subtract the actual individual translate, not the
    // last requested value: focus/target CSS may already have forced it to zero.
    const updates = candidates.map((block) => {
      const bounds = block.getBoundingClientRect();
      const translate = getComputedStyle(block).translate;
      const shift = translate === 'none' ? 0 : parseFloat(translate.split(/\s+/)[1]) || 0;
      const protectedContent =
        selecting || block.contains(document.activeElement) || (target && block.contains(target));
      const state = protectedContent
        ? { opacity: 1, translateY: 0 }
        : readingFrame(bounds.top - shift, bounds.height, innerHeight, mode === 'light' ? 9 : 18);
      return { block, ...state };
    });
    for (const { block, opacity, translateY } of updates) {
      block.style.setProperty('--reading-opacity', opacity.toFixed(4));
      block.style.setProperty('--reading-y', `${translateY.toFixed(3)}px`);
      block.setAttribute('data-reading-motion', '');
    }
  }

  function refresh() {
    stop();
    if (signal.aborted || capability() === 'reduced-motion') return;
    const token = generation;
    try {
      enabled = true;
      observer = new IntersectionObserver(
        (entries) => {
          if (!enabled || token !== generation || signal.aborted) return;
          for (const entry of entries) {
            const block = entry.target as HTMLElement;
            if (entry.isIntersecting) active.add(block);
            else active.delete(block);
            // Exiting the preheat region still needs one final offscreen update.
            pending.add(block);
          }
          schedule();
        },
        { rootMargin: '128px 0px' },
      );
      for (const block of blocks) observer.observe(block);
      resize = new ResizeObserver(() => {
        if (token === generation) schedule(true);
      });
      resize.observe(prose!);
      // A collapsing TOC moves the prose without changing the prose's own size.
      resize.observe(article!);
      if (header) resize.observe(header);
      schedule(true);
    } catch (error) {
      stop();
      throw error;
    }
  }

  const options = { signal };
  window.addEventListener('scroll', () => schedule(), { signal, passive: true });
  window.addEventListener('resize', () => schedule(true), options);
  window.addEventListener('hashchange', () => schedule(true), options);
  document.addEventListener('bh:motion', refresh, options);
  document.addEventListener('focusin', () => schedule(true), options);
  document.addEventListener('focusout', () => schedule(true), options);
  document.addEventListener('selectionchange', () => schedule(true), options);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) cancelFrame();
      else schedule(true);
    },
    options,
  );
  window.addEventListener(
    'beforeprint',
    () => {
      printing = true;
      cancelFrame();
      restore();
    },
    options,
  );
  window.addEventListener(
    'afterprint',
    () => {
      printing = false;
      schedule(true);
    },
    options,
  );
  window.addEventListener('pagehide', stop, options);
  window.addEventListener(
    'pageshow',
    (event) => {
      if (event.persisted) refresh();
    },
    options,
  );
  signal.addEventListener('abort', stop, { once: true });
  refresh();
}
