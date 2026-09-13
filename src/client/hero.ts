import { config } from '../config';
import { capability } from './preferences';
import { report } from './log';

export type HeroContext = {
  host: HTMLElement;
  stage: HTMLElement;
  signal: AbortSignal;
  reduced: boolean;
  light: boolean;
};
const effects = import.meta.glob<{ default: (context: HeroContext) => Promise<void> }>(
  './effects/*.ts',
);

export async function mountHero(signal: AbortSignal) {
  const target = document.querySelector<HTMLElement>('#hero');
  if (!target || signal.aborted) return;
  const host = target;
  const stage = host.querySelector<HTMLElement>('#hero-stage')!;
  const requested = new URLSearchParams(location.search).get('effect');
  let index = config.hero.findIndex((effect) => effect.id === requested);
  if (index < 0) index = Math.floor(Math.random() * config.hero.length);
  let active: AbortController | undefined;

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
      const module = await effects[`./effects/${effect.id}.ts`]();
      if (controller.signal.aborted || signal.aborted) return;
      await module.default({
        host,
        stage,
        signal: controller.signal,
        reduced: capability() === 'reduced-motion',
        light: capability() === 'light',
      });
    } catch (error) {
      if (!controller.signal.aborted) report('hero', error);
    }
  }
  function change(direction: number) {
    index = (index + direction + config.hero.length) % config.hero.length;
    void show();
  }
  host.querySelector('#effect-prev')!.addEventListener('click', () => change(-1), { signal });
  host.querySelector('#effect-next')!.addEventListener('click', () => change(1), { signal });
  document.addEventListener('bh:motion', show, { signal });
  signal.addEventListener('abort', () => active?.abort(), { once: true });
  await show();
}
