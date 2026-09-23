import { config } from '../config';
import { capability } from './preferences';
import { report } from './log';
import { canPreloadHero, createHeroPreloader, type PreloadableHero } from './hero-preload';

export type HeroContext = {
  host: HTMLElement;
  stage: HTMLElement;
  signal: AbortSignal;
  reduced: boolean;
  light: boolean;
};
type HeroModule = PreloadableHero & { default: (context: HeroContext) => Promise<void> };
const effects = import.meta.glob<HeroModule>('./effects/*.ts');
type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };
const connection = () => (navigator as Navigator & { connection?: Connection }).connection;
const preloader = createHeroPreloader((id) => effects[`./effects/${id}.ts`](), {
  allowed: () =>
    canPreloadHero({
      reduced: capability() === 'reduced-motion',
      hidden: document.hidden,
      online: navigator.onLine,
      saveData: connection()?.saveData,
      effectiveType: connection()?.effectiveType,
    }),
  idle(callback) {
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(callback, { timeout: 1500 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(callback, 250);
    return () => window.clearTimeout(handle);
  },
});

export async function mountHero(signal: AbortSignal) {
  const target = document.querySelector<HTMLElement>('#hero');
  if (!target || signal.aborted) return;
  const host = target;
  const stage = host.querySelector<HTMLElement>('#hero-stage')!;
  const requested = new URLSearchParams(location.search).get('effect');
  let index = config.hero.findIndex((effect) => effect.id === requested);
  if (index < 0) index = Math.floor(Math.random() * config.hero.length);
  let active: AbortController | undefined;
  const warming = preloader.attach(signal);
  const neighbour = (direction: number) =>
    config.hero[(index + direction + config.hero.length) % config.hero.length].id;

  async function show() {
    active?.abort();
    const controller = new AbortController();
    active = controller;
    stage.replaceChildren();
    const effect = config.hero[index];
    host.dataset.effect = effect.id;
    host.querySelector('h1')!.textContent = config.name;
    host.dataset.reduced = String(capability() === 'reduced-motion');
    host.querySelector('#effect-label')!.textContent = effect.name;
    host.querySelector('#effect-position')!.textContent = `${index + 1} / ${config.hero.length}`;
    try {
      const module = await warming.loadCurrent(
        effect.id,
        controller.signal,
        capability() === 'reduced-motion',
      );
      if (controller.signal.aborted || signal.aborted) return;
      await module.default({
        host,
        stage,
        signal: controller.signal,
        reduced: capability() === 'reduced-motion',
        light: capability() === 'light',
      });
      warming.ready(controller.signal, neighbour(1));
    } catch (error) {
      if (!controller.signal.aborted && !signal.aborted) report('hero', error);
    }
  }
  function change(direction: number) {
    index = (index + direction + config.hero.length) % config.hero.length;
    void show();
  }
  for (const [selector, direction] of [
    ['#effect-prev', -1],
    ['#effect-next', 1],
  ] as const) {
    const button = host.querySelector(selector)!;
    button.addEventListener('click', () => change(direction), { signal });
    for (const event of ['pointerenter', 'focusin', 'pointerdown'])
      button.addEventListener(event, () => warming.intent(neighbour(direction)), { signal });
  }
  document.addEventListener('bh:motion', show, { signal });
  document.addEventListener('visibilitychange', () => warming.refresh(), { signal });
  connection()?.addEventListener('change', () => warming.refresh(), { signal });
  window.addEventListener('online', () => warming.refresh(), { signal });
  window.addEventListener('offline', () => warming.refresh(), { signal });
  signal.addEventListener(
    'abort',
    () => {
      warming.dispose();
      active?.abort();
    },
    { once: true },
  );
  await show();
}
