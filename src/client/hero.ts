import { config } from '../config';
import { capability } from './preferences';
import { report } from './log';
import type { Container } from '@tsparticles/engine';
const presets = import.meta.glob('./effects/*.ts');
export async function mountHero(signal: AbortSignal) {
  if (signal.aborted) return;
  const host = document.querySelector<HTMLElement>('#hero')!;
  let current: Container | undefined,
    version = 0;
  let creation: Promise<Container | undefined> = Promise.resolve(undefined);
  const requested = new URLSearchParams(location.search).get('effect');
  let index = config.hero.findIndex((e) => e.id === requested);
  if (index < 0) index = Math.floor(Math.random() * config.hero.length);
  document.querySelector('#saying')!.textContent =
    config.sayings[Math.floor(Math.random() * config.sayings.length)];
  async function show() {
    const token = ++version;
    current?.destroy();
    current = undefined;
    host.classList.remove('ready');
    const effect = config.hero[index];
    host.dataset.effect = effect.id;
    document.querySelector('#effect-label')!.textContent =
      `${String(index + 1).padStart(2, '0')} / ${effect.name}`;
    document.querySelector('#effect-position')!.textContent =
      `${String(index + 1).padStart(2, '0')} / ${String(config.hero.length).padStart(2, '0')}`;
    if (capability() === 'reduced-motion') return;
    try {
      const { particles } = await import('./particles');
      const module = (await presets[`./effects/${effect.id}.ts`]()) as {
        default: (ctx: import('./particles').PresetContext) => import('./particles').ISourceOptions;
      };
      if (signal.aborted || token !== version) return;
      const light = capability() === 'light',
        mobile = innerWidth <= 700;
      const options = module.default({
        count: mobile
          ? config.particles.mobile
          : light
            ? config.particles.light
            : config.particles.desktop,
        mobile,
        light,
      });
      const result = await (creation = creation
        .catch(() => undefined)
        .then(() => {
          if (signal.aborted || token !== version) return undefined;
          return particles('hero-particles', {
            fpsLimit: light ? 30 : 60,
            particles: {
              number: { value: 0 },
              size: { value: 1 },
              paint: { color: { value: '#b6a27a' } },
              opacity: { value: 0.8 },
              move: { enable: false },
            },
            ...options,
          });
        }));
      if (signal.aborted || token !== version) {
        result?.destroy();
        return;
      }
      current = result;
      if (result) host.classList.add('ready');
    } catch (error) {
      report('hero', error);
    }
  }
  const change = (direction: number) => {
    index = (index + direction + config.hero.length) % config.hero.length;
    void show();
  };
  document.querySelector('#effect-prev')!.addEventListener('click', () => change(-1), { signal });
  document.querySelector('#effect-next')!.addEventListener('click', () => change(1), { signal });
  document.addEventListener('bh:motion', show, { signal });
  matchMedia('(max-width: 700px)').addEventListener('change', show, { signal });
  signal.addEventListener(
    'abort',
    () => {
      ++version;
      current?.destroy();
    },
    { once: true },
  );
  await show();
}
