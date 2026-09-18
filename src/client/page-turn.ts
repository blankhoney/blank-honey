import type { PageFlip } from './vendor/page-flip';

export type PageSnapshot = { element: HTMLElement; left: number; width: number; height: number };
type Book = Pick<PageFlip, 'on' | 'loadFromHTML' | 'flipNext' | 'destroy'>;

/** Only inert copies enter the book; it must never own or remove the real main element. */
export function capturePage(root: HTMLElement, includeAtmosphere = false): PageSnapshot {
  const bounds = root.getBoundingClientRect();
  const clone = root.cloneNode(true) as HTMLElement;
  clone.dataset.pageSnapshot = '';
  const element = document.createElement('div');
  element.className = 'page-ghost';
  element.inert = true;
  element.setAttribute('aria-hidden', 'true');
  element.dataset.density = 'soft';
  const tokens = getComputedStyle(document.documentElement);
  for (const key of ['--bg', '--fg', '--accent', '--muted', '--line', '--soft']) {
    element.style.setProperty(key, tokens.getPropertyValue(key));
  }
  const originals = root.querySelectorAll('canvas');
  clone.querySelectorAll('canvas').forEach((canvas, index) => {
    try {
      const source = originals[index];
      const image = document.createElement('img');
      image.src = source.toDataURL();
      image.alt = '';
      image.style.cssText = source.style.cssText;
      image.width = source.width;
      image.height = source.height;
      canvas.parentElement!.style.height = `${source.parentElement!.getBoundingClientRect().height}px`;
      canvas.replaceWith(image);
    } catch {
      canvas.remove();
    }
  });
  clone.querySelectorAll('script, iframe, audio, video').forEach((node) => node.remove());
  for (const node of [clone, ...clone.querySelectorAll('[id]')]) node.removeAttribute('id');
  for (const node of clone.querySelectorAll<HTMLElement>('[data-reading-motion]')) {
    node.removeAttribute('data-reading-motion');
    node.style.removeProperty('--reading-opacity');
    node.style.removeProperty('--reading-y');
  }
  Object.assign(clone.style, {
    position: 'absolute',
    left: '0',
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    margin: '0',
    opacity: '1',
    containerType: 'inline-size',
  });
  Object.assign(element.style, {
    left: `${bounds.left}px`,
    width: `${bounds.width}px`,
    height: `${innerHeight}px`,
  });
  if (includeAtmosphere) {
    const atmosphere = document.querySelector<HTMLElement>('.terminal-atmosphere');
    if (atmosphere) {
      const background = atmosphere.cloneNode(true) as HTMLElement;
      const sources = atmosphere.querySelectorAll('canvas');
      background.querySelectorAll('canvas').forEach((canvas, index) => {
        try {
          const image = document.createElement('img');
          image.src = sources[index].toDataURL();
          image.alt = '';
          image.style.cssText = 'display:block;width:100%;height:100%';
          canvas.replaceWith(image);
        } catch {
          canvas.remove();
        }
      });
      for (const node of [background, ...background.querySelectorAll('[id]')])
        node.removeAttribute('id');
      Object.assign(background.style, {
        left: `${-bounds.left}px`,
        right: 'auto',
        width: `${innerWidth}px`,
      });
      element.append(background);
    }
  }
  element.append(clone);
  return { element, left: bounds.left, width: bounds.width, height: innerHeight };
}

/** Owns the renderer's complete lifetime, including initialization, completion and cancellation. */
export function animateBook(
  book: Book,
  pages: HTMLElement[],
  signal: AbortSignal,
  duration: number,
) {
  return new Promise<void>((resolve, reject) => {
    let done = false;
    let started = false;
    let frame = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    function finish(error?: unknown) {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      try {
        book.destroy();
      } catch (failure) {
        error ??= failure;
      }
      if (error) reject(error);
      else resolve();
    }
    const abort = () => finish();
    if (signal.aborted) return finish();
    signal.addEventListener('abort', abort, { once: true });
    book.on('init', () => {
      if (done || frame) return;
      // The vendor's first render must set its clock before a programmatic flip begins.
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (done) return;
        try {
          book.flipNext('bottom');
        } catch (error) {
          finish(error);
        }
      });
    });
    book.on('changeState', ({ data }) => {
      if (data === 'flipping') started = true;
      if (data === 'read' && started) finish();
    });
    timeout = setTimeout(() => finish(new Error('Page turn did not finish')), duration + 1200);
    try {
      book.loadFromHTML(pages);
    } catch (error) {
      finish(error);
    }
  });
}

export async function playPageTurn(
  stage: HTMLElement,
  outgoing: PageSnapshot,
  incoming: PageSnapshot,
  duration: number,
  signal: AbortSignal,
) {
  if (signal.aborted) return;
  const { PageFlip } = await import('./vendor/page-flip');
  if (signal.aborted) return;
  const host = document.createElement('div');
  host.className = 'page-turn';
  host.inert = true;
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    left: `${outgoing.left}px`,
    width: `${outgoing.width}px`,
    height: `${outgoing.height}px`,
  });
  stage.append(host);
  try {
    for (const snapshot of [outgoing, incoming]) {
      snapshot.element.style.left = '0';
      snapshot.element.style.width = '100%';
      host.append(snapshot.element);
    }
    const book = new PageFlip(host, {
      width: Math.max(1, Math.round(outgoing.width)),
      height: Math.max(1, Math.round(outgoing.height)),
      size: 'fixed',
      usePortrait: true,
      useMouseEvents: false,
      autoSize: false,
      showCover: false,
      showPageCorners: false,
      disableFlipByClick: true,
      drawShadow: true,
      maxShadowOpacity: 0.36,
      flippingTime: duration,
    });
    await animateBook(book, [outgoing.element, incoming.element], signal, duration);
  } finally {
    host.remove();
  }
}
