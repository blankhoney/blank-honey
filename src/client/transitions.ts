import { capability, tone } from './preferences';
import { report } from './log';
import type {
  TransitionBeforePreparationEvent,
  TransitionBeforeSwapEvent,
} from 'astro:transitions/client';

type Painter = typeof import('./interface-cloud');
/** Continuous paper fold from the acceptance prototype; each strip starts at its neighbour's edge. */
export function foldAt(count: number, width: number, progress: number) {
  const eased = progress ** 3 * (progress * (progress * 6 - 15) + 10);
  const flex = Math.sin(Math.PI * eased);
  const crease = 1.08 - eased * 1.2;
  let x = 0;
  let z = 0;
  return Array.from({ length: count }, (_, index) => {
    const position = (index + 0.5) / count;
    const angle = (-70 * flex) / (1 + Math.exp(-(position - crease) * 8.5));
    const point = { x, z, angle };
    x += (Math.cos((angle * Math.PI) / 180) * width) / count;
    z -= (Math.sin((angle * Math.PI) / 180) * width) / count;
    return point;
  });
}

export function initTransitions() {
  let atmosphereController: AbortController | undefined;
  const refreshAtmosphere = async () => {
    atmosphereController?.abort();
    const controller = (atmosphereController = new AbortController());
    const family = document.documentElement.dataset.family;
    if (capability() === 'reduced-motion') return;
    if (family === 'terminal') {
      const { mountAtmosphere } = await import('./terminal-atmosphere');
      if (!controller.signal.aborted) await mountAtmosphere(controller.signal);
    } else if (family === 'paper') {
      const { mountPaperAtmosphere } = await import('./paper-atmosphere');
      if (!controller.signal.aborted) mountPaperAtmosphere(controller.signal);
    }
  };
  document.addEventListener('astro:before-swap', () => atmosphereController?.abort());
  for (const event of ['astro:page-load', 'bh:motion', 'bh:theme'])
    document.addEventListener(
      event,
      () => void refreshAtmosphere().catch((error) => report('atmosphere', error)),
    );
  let version = 0;
  let painter: Painter | undefined;
  let previousSurface: ReturnType<
    NonNullable<Painter['interfaceCloud']['active']>['snapshot']
  > | null = null;
  const disposals: (() => void)[] = [];
  const stage = () => document.querySelector<HTMLElement>('#fx-stage')!;
  const main = () => document.querySelector<HTMLElement>('#main')!;
  const load = async () => (painter ??= await import('./interface-cloud'));
  function clear(preserveSurface = false) {
    version++;
    if (!preserveSurface) painter?.interfaceCloud.destroy();
    disposals.splice(0).forEach((dispose) => dispose());
    stage().replaceChildren();
    delete stage().dataset.effect;
    main().style.opacity = '';
    main().inert = false;
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
  async function renderCloud(duration: number, token: number) {
    const module = await load();
    await document.fonts.ready;
    const probe = document.querySelector('#probe');
    if (probe && !probe.querySelector('.probe-card')) {
      await new Promise<void>((resolve) => {
        const observer = new MutationObserver(finish);
        const timeout = setTimeout(finish, 500);
        function finish() {
          clearTimeout(timeout);
          observer.disconnect();
          resolve();
        }
        observer.observe(probe, { childList: true });
        disposals.push(finish);
      });
    }
    if (token !== version) return;
    return module.interfaceCloud.make(main(), {
      light: capability() === 'light',
      animate: true,
      duration,
      seed: previousSurface,
    });
  }
  async function mountSurface() {
    if (document.documentElement.dataset.family !== 'terminal' || capability() === 'reduced-motion')
      return;
    // A route exchange owns assembly until its ghost is removed.
    if (stage().dataset.effect || painter?.interfaceCloud.active) return;
    const token = version;
    await document.fonts.ready;
    const module = await load();
    if (token !== version || stage().dataset.effect) return;
    module.interfaceCloud.make(main(), { light: capability() === 'light', animate: true });
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
        const original = originals[i];
        const image = document.createElement('img');
        image.src = original.toDataURL();
        image.alt = '';
        image.style.cssText = original.style.cssText;
        image.width = original.width;
        image.height = original.height;
        // Images survive cloning into paper strips; cloned canvases lose their pixels.
        canvas.parentElement!.style.height = `${original.parentElement!.getBoundingClientRect().height}px`;
        canvas.replaceWith(image);
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
    const count = capability() === 'light' ? 20 : 36;
    const frames = Array.from({ length: 49 }, (_, step) => {
      const progress = step / 48;
      const eased = progress ** 3 * (progress * (progress * 6 - 15) + 10);
      return { progress, eased, flex: Math.sin(Math.PI * eased), yaw: -180 * eased ** 1.6 };
    });
    const bends = frames.map(({ progress }) => foldAt(count, innerWidth, progress));
    const shadow = document.createElement('div');
    shadow.className = 'paper-contact-shadow';
    stage().prepend(shadow);
    disposals.push(() => shadow.remove());
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
      const frontShade = document.createElement('div');
      const backShade = document.createElement('div');
      frontShade.className = backShade.className = 'paper-shade';
      front.append(frontShade);
      back.append(backShade);
      strip.append(front, back);
      for (const [side, shade] of [frontShade, backShade].entries()) {
        void play(
          shade,
          frames.map((frame, step) => {
            const normal = ((frame.yaw + bends[step][i].angle) * Math.PI) / 180;
            return {
              offset: frame.progress,
              opacity: Math.abs(Math.sin(normal - side * 0.2)) * 0.24,
            };
          }),
          duration,
          0,
          'linear',
        );
      }
      sheet.append(strip);
      void play(
        strip,
        bends.map((positions, step) => ({
          offset: frames[step].progress,
          transform: `translate3d(${positions[i].x}px,0,${positions[i].z}px) rotateY(${positions[i].angle}deg)`,
        })),
        duration,
        0,
        'linear',
      );
    }
    ghost.remove();
    void play(
      shadow,
      frames.map(({ progress, flex, yaw }) => ({
        offset: progress,
        transform: `translateX(${Math.max(-80, innerWidth * Math.max(0, Math.cos((yaw * Math.PI) / 180)) * 0.78 - 70)}px)`,
        width: `${40 + 95 * flex}px`,
        opacity: 0.14 * flex,
      })),
      duration,
      0,
      'linear',
    );
    await play(
      sheet,
      frames.map(({ progress, eased, flex, yaw }) => ({
        offset: progress,
        transform: `translate3d(${-innerWidth * 0.035 * eased ** 2}px,0,${6 * flex}px) rotateY(${yaw}deg) rotateZ(${-1.15 * flex}deg)`,
      })),
      duration,
      0,
      'linear',
    );
    shadow.remove();
    sheet.remove();
  }
  document.addEventListener(
    'astro:before-preparation',
    (event: TransitionBeforePreparationEvent) => {
      previousSurface = painter?.interfaceCloud.active?.snapshot() || null;
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
    if (capability() === 'reduced-motion') return;
    const ghost = capture(),
      token = version;
    const swap = event.swap;
    // Our live overlay replaces the browser's root screenshot animation, not the router.
    void event.viewTransition.ready.catch(() => {});
    event.viewTransition.skipTransition();
    event.swap = () => {
      swap();
      stage().append(ghost);
      stage().dataset.effect = `${from}-to-${to}`;
      const timeout = setTimeout(() => {
        if (token === version) {
          clear();
        }
      }, 4500);
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
            await paper(ghost, light ? 1200 : 1800);
          } else if (to === 'terminal') {
            const duration = light ? 1200 : 1700;
            const surface = await renderCloud(duration, token);
            if (!surface || token !== version) return;
            // Native content fades independently; the external particle ink stays visible.
            await Promise.all([
              play(ghost, [{ opacity: 1 }, { opacity: 0 }], duration * 0.45),
              play(content, [{ opacity: 0 }, { opacity: 1 }], duration * 0.75),
              surface.finished,
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
            clear(to === 'terminal');
          }
        }
      }
    };
  });
  document.addEventListener(
    'astro:page-load',
    () => void mountSurface().catch((error) => report('surface', error)),
  );
  for (const name of ['bh:motion', 'bh:theme'])
    document.addEventListener(name, () => {
      clear();
      void mountSurface().catch((error) => report('surface', error));
    });
}
