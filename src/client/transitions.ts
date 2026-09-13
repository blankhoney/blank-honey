import { capability, tone } from './preferences';
import { report } from './log';
import type {
  TransitionBeforePreparationEvent,
  TransitionBeforeSwapEvent,
} from 'astro:transitions/client';
import type { Point } from './particle-morph';
import type { Container } from '@tsparticles/engine';

type Painter = typeof import('./particle-morph');
export function foldAt(count: number, width: number, progress: number) {
  let x = 0,
    z = 0;
  return Array.from({ length: count }, (_, i) => {
    const angle = (-24 * Math.sin(Math.PI * progress) * (i + 1)) / count;
    const point = { x, z, angle };
    x += (Math.cos((angle * Math.PI) / 180) * width) / count;
    z -= (Math.sin((angle * Math.PI) / 180) * width) / count;
    return point;
  });
}

export function initTransitions() {
  let version = 0,
    active = false,
    afterNavigation = false;
  let painter: Painter | undefined, observer: ResizeObserver | undefined;
  let refreshTimer: ReturnType<typeof setTimeout>;
  const disposals: (() => void)[] = [];
  const stage = () => document.querySelector<HTMLElement>('#fx-stage')!;
  const main = () => document.querySelector<HTMLElement>('#main')!;
  const load = async () => (painter ??= await import('./particle-morph'));
  function clear() {
    version++;
    active = false;
    clearTimeout(refreshTimer);
    observer?.disconnect();
    disposals.splice(0).forEach((dispose) => dispose());
    stage().replaceChildren();
    delete stage().dataset.effect;
    main().style.opacity = '';
  }
  async function play(
    el: Element,
    frames: Keyframe[],
    duration: number,
    delay = 0,
    easing = 'cubic-bezier(.22,.7,.24,1)',
  ) {
    const animation = el.animate(frames, {
      duration,
      delay,
      easing,
      fill: 'both',
    });
    disposals.push(() => animation.cancel());
    return animation.finished.catch(() => {});
  }
  function watch() {
    observer?.disconnect();
    // Observe dimensions, not mutation noise from the live clock or particle engine.
    let width = main().offsetWidth,
      height = main().offsetHeight;
    observer = new ResizeObserver(() => {
      const next = main();
      if (width === next.offsetWidth && height === next.offsetHeight) return;
      width = next.offsetWidth;
      height = next.offsetHeight;
      if (!active) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => void refresh(), 120);
      }
    });
    observer.observe(main());
    const changes = new MutationObserver((records) => {
      if (!active && records.some((record) => (record.target as Element).id === 'probe')) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => void refresh(), 120);
      }
    });
    changes.observe(main(), { childList: true, subtree: true });
    disposals.push(() => changes.disconnect());
  }
  async function renderCloud(from: Point[], duration: number, entry: boolean, token: number) {
    const module = await load();
    await document.fonts.ready;
    if (token !== version) return;
    const layer = document.createElement('div');
    layer.id = `page-points-${token}`;
    layer.className = 'page-points';
    stage().append(layer);
    let engine: Container | undefined;
    disposals.push(() => {
      engine?.destroy();
      layer.remove();
    });
    engine = await module.cloud(
      layer,
      from,
      module.sample(capability() === 'light'),
      duration,
      entry,
      capability() === 'light',
    );
    if (token !== version) {
      engine?.destroy();
      layer.remove();
      return;
    }
    return layer;
  }
  async function refresh() {
    if (active) return;
    clear();
    if (document.documentElement.dataset.family !== 'terminal' || capability() === 'reduced-motion')
      return;
    const token = version;
    try {
      const layer = await renderCloud([], 0, false, token);
      if (!layer || token !== version) return;
      layer.style.opacity = '.22';
      const startY = scrollY;
      const follow = () => {
        layer.style.transform = `translateY(${startY - scrollY}px)`;
      };
      window.addEventListener('scroll', follow, { passive: true });
      disposals.push(() => window.removeEventListener('scroll', follow));
      watch();
    } catch (error) {
      report('transition', error);
    }
  }
  function capture() {
    const old = main(),
      bounds = old.getBoundingClientRect(),
      clone = old.cloneNode(true) as HTMLElement;
    const ghost = document.createElement('div');
    ghost.className = 'page-ghost';
    ghost.inert = true;
    ghost.setAttribute('aria-hidden', 'true');
    const styles = getComputedStyle(document.documentElement);
    for (const key of ['--bg', '--fg', '--accent', '--muted', '--line', '--soft'])
      ghost.style.setProperty(key, styles.getPropertyValue(key));
    const originals = old.querySelectorAll('canvas');
    clone.querySelectorAll('canvas').forEach((canvas, i) => {
      try {
        canvas.getContext('2d')?.drawImage(originals[i], 0, 0);
      } catch {
        canvas.remove();
      }
    });
    clone.querySelectorAll('script,iframe,audio').forEach((el) => el.remove());
    [clone, ...clone.querySelectorAll('[id]')].forEach((el) => el.removeAttribute('id'));
    Object.assign(clone.style, {
      position: 'absolute',
      left: `${bounds.left}px`,
      top: `${bounds.top}px`,
      width: `${bounds.width}px`,
      margin: '0',
      opacity: '1',
    });
    ghost.append(clone);
    return ghost;
  }
  async function paper(ghost: HTMLElement, duration: number) {
    const sheet = document.createElement('div');
    sheet.className = 'turning-sheet';
    stage().append(sheet);
    const count = capability() === 'light' ? 8 : 12;
    const bends = Array.from({ length: 25 }, (_, step) => foldAt(count, innerWidth, step / 24));
    for (let i = 0; i < count; i++) {
      const strip = document.createElement('div');
      strip.className = 'paper-strip';
      strip.style.cssText = `left:0;width:calc(${100 / count}% + 1px)`;
      const front = document.createElement('div'),
        back = document.createElement('div');
      front.className = 'sheet-front';
      back.className = 'sheet-back';
      back.style.backgroundSize = `${innerWidth}px 100%`;
      back.style.backgroundPosition = `${(-(count - i - 1) * innerWidth) / count}px 0`;
      const print = ghost.cloneNode(true) as HTMLElement;
      print.style.cssText += `;width:${innerWidth}px;left:${(-i * innerWidth) / count}px`;
      front.append(print);
      strip.append(front, back);
      sheet.append(strip);
      void play(
        strip,
        bends.map((positions, step) => ({
          offset: step / 24,
          transform: `translate3d(${positions[i].x}px,0,${positions[i].z}px) rotateY(${positions[i].angle}deg)`,
        })),
        duration,
        0,
        'linear',
      );
    }
    ghost.remove();
    await play(
      sheet,
      [
        { transform: 'translateX(0) rotateY(0deg) rotateZ(0deg)' },
        { transform: 'translateX(1%) rotateY(-12deg) rotateZ(-.4deg)', offset: 0.18 },
        { transform: 'translateX(-5%) rotateY(-68deg) rotateZ(-.8deg)', offset: 0.48 },
        { transform: 'translateX(-24%) rotateY(-125deg) rotateZ(-.3deg)', offset: 0.76 },
        { transform: 'translateX(-105%) rotateY(-155deg) rotateZ(0deg)' },
      ],
      duration,
      0,
      'linear',
    );
    sheet.remove();
  }
  document.addEventListener(
    'astro:before-preparation',
    (event: TransitionBeforePreparationEvent) => {
      clear();
      if (
        capability() !== 'reduced-motion' &&
        /^\/(probe|map|graph|tools|lab)\//.test(event.to.pathname)
      )
        void load().catch(() => {});
    },
  );
  document.addEventListener('astro:before-swap', (event: TransitionBeforeSwapEvent) => {
    const from = document.documentElement.dataset.family,
      to = event.newDocument.documentElement.dataset.family;
    event.newDocument.documentElement.dataset.tone = tone();
    event.newDocument.documentElement.dataset.motion = capability();
    afterNavigation = true;
    if (capability() === 'reduced-motion') return;
    const ghost = capture(),
      points = from === 'terminal' ? painter?.sample(capability() === 'light') || [] : [],
      token = version;
    const swap = event.swap;
    // Our live overlay replaces the browser's root screenshot animation, not the router.
    void event.viewTransition.ready.catch(() => {});
    event.viewTransition.skipTransition();
    event.swap = () => {
      swap();
      stage().append(ghost);
      active = true;
      stage().dataset.effect = `${from}-to-${to}`;
      const timeout = setTimeout(() => {
        if (token === version) {
          clear();
          void refresh();
        }
      }, 2300);
      disposals.push(() => clearTimeout(timeout));
      // Astro restores scroll after swap; sample the destination on the following frame.
      const frame = requestAnimationFrame(() => void exchange());
      disposals.push(() => cancelAnimationFrame(frame));
      async function exchange() {
        if (token !== version) return;
        const content = main(),
          light = capability() === 'light';
        try {
          if (from === 'terminal' && to === 'paper') {
            await paper(ghost, light ? 900 : 1350);
          } else if (to === 'terminal') {
            content.style.opacity = '0';
            const duration = light ? 800 : 1150;
            const layer = await renderCloud(points, duration, from !== 'terminal', token);
            if (!layer || token !== version) return;
            await Promise.all([
              play(
                ghost,
                [{ opacity: 1 }, { opacity: 0, transform: 'scale(.985)' }],
                duration * 0.3,
              ),
              play(content, [{ opacity: 0 }, { opacity: 1 }], duration * 0.32, duration * 0.68),
              play(
                layer,
                [
                  { opacity: 0 },
                  { opacity: 1, offset: 0.14 },
                  { opacity: 1, offset: 0.8 },
                  { opacity: 0.22 },
                ],
                duration,
              ),
            ]);
          } else {
            const duration = from === 'hero' ? (light ? 360 : 600) : light ? 180 : 300;
            await Promise.all([
              play(
                ghost,
                [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-6px)' }],
                duration,
              ),
              play(
                content,
                [
                  { opacity: 0, transform: 'translateY(8px)' },
                  { opacity: 1, transform: 'translateY(0)' },
                ],
                duration,
              ),
            ]);
          }
        } catch (error) {
          report('transition', error);
        } finally {
          if (token === version) {
            clear();
            void refresh();
          }
        }
      }
    };
  });
  document.addEventListener('astro:page-load', () => {
    if (!afterNavigation) void refresh();
    afterNavigation = false;
  });
  for (const name of ['bh:motion', 'bh:theme'])
    document.addEventListener(name, () => {
      clear();
      void refresh();
    });
  window.addEventListener('resize', () => {
    clearTimeout(refreshTimer);
    // Resize invalidates viewport coordinates; reveal real content before rebuilding.
    refreshTimer = setTimeout(() => {
      clear();
      void refresh();
    }, 200);
  });
}
