import { capability, tone } from './preferences';
import { report } from './log';
import { initAtmosphere } from './atmosphere';
import { capturePage, playPageTurn } from './page-turn';
import type {
  TransitionBeforePreparationEvent,
  TransitionBeforeSwapEvent,
} from 'astro:transitions/client';

type Painter = typeof import('./interface-cloud');

export function initTransitions() {
  initAtmosphere();
  let version = 0;
  let controller: AbortController | undefined;
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
    controller?.abort();
    controller = undefined;
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
    const animation = el.animate(frames, { duration, delay, easing, fill: 'both' });
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
    if (stage().dataset.effect || painter?.interfaceCloud.active) return;
    const token = version;
    await document.fonts.ready;
    const module = await load();
    if (token !== version || stage().dataset.effect) return;
    module.interfaceCloud.make(main(), { light: capability() === 'light', animate: true });
  }
  document.addEventListener(
    'astro:before-preparation',
    (event: TransitionBeforePreparationEvent) => {
      previousSurface = painter?.interfaceCloud.active?.snapshot() || null;
      clear();
      if (
        capability() !== 'reduced-motion' &&
        /^\/(probe|map|graph|tools|lab)\//.test(event.to.pathname)
      ) {
        void load().catch(() => {});
      }
    },
  );
  document.addEventListener('astro:before-swap', (event: TransitionBeforeSwapEvent) => {
    const from = document.documentElement.dataset.family;
    const to = event.newDocument.documentElement.dataset.family;
    event.newDocument.documentElement.dataset.tone = tone();
    event.newDocument.documentElement.dataset.motion = capability();
    if (capability() === 'reduced-motion') return;
    const turn = from === 'terminal' && to === 'paper';
    const outgoing = capturePage(main(), turn);
    const ghost = outgoing.element;
    const token = version;
    const route = (controller = new AbortController());
    const swap = event.swap;
    // The live overlay replaces the browser's root screenshot, not Astro's router.
    void event.viewTransition.ready.catch(() => {});
    event.viewTransition.skipTransition();
    event.swap = () => {
      swap();
      stage().append(ghost);
      stage().dataset.effect = `${from}-to-${to}`;
      const timeout = setTimeout(() => {
        if (token === version) clear();
      }, 4500);
      disposals.push(() => clearTimeout(timeout));
      // Astro restores scroll after swap; sample the destination on the next frame.
      const frame = requestAnimationFrame(() => void exchange());
      disposals.push(() => cancelAnimationFrame(frame));
      async function exchange() {
        if (token !== version) return;
        const content = main();
        const light = capability() === 'light';
        const width = content.getBoundingClientRect().width;
        const layout = new ResizeObserver(() => {
          // Sidebar changes resize main without producing a window resize event.
          if (token !== version || Math.abs(content.getBoundingClientRect().width - width) < 1)
            return;
          clear();
          restoreSurface();
        });
        layout.observe(content);
        disposals.push(() => layout.disconnect());
        try {
          if (turn) {
            const incoming = capturePage(content);
            content.inert = true;
            await playPageTurn(stage(), outgoing, incoming, light ? 750 : 1100, route.signal);
          } else if (to === 'terminal') {
            const duration = light ? 1200 : 1700;
            const surface = await renderCloud(duration, token);
            if (!surface || token !== version) return;
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
          // Real content was never removed or handed to the renderer. Clearing is a safe fallback.
        } finally {
          if (token === version) clear(to === 'terminal');
        }
      }
    };
  });
  const restoreSurface = () => void mountSurface().catch((error) => report('surface', error));
  document.addEventListener('astro:page-load', restoreSurface);
  for (const name of ['bh:motion', 'bh:theme']) {
    document.addEventListener(name, () => {
      clear();
      restoreSurface();
    });
  }
  window.addEventListener('resize', () => {
    if (!stage().dataset.effect) return;
    clear();
    restoreSurface();
  });
  window.addEventListener('pagehide', () => clear());
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) restoreSurface();
  });
}
