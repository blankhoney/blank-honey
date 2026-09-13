import { capability, tone } from './preferences';
import { report } from './log';
import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';
import type { Container } from '@tsparticles/engine';
import type { EmitterContainer } from '@tsparticles/plugin-emitters';

type Snapshot = { key: string; rect: DOMRect; text: string; font: string; color: string };

export function initTransitions() {
  let version = 0,
    afterNavigation = false;
  const cleanup: (() => void)[] = [];
  function clear() {
    ++version;
    cleanup.splice(0).forEach((dispose) => dispose());
    document.querySelector('#fx-stage')?.replaceChildren();
  }
  const snapshot = (): Snapshot[] =>
    [...document.querySelectorAll<HTMLElement>('[data-cohort]')]
      .filter((el) => el.getBoundingClientRect().height > 0)
      .slice(0, 4)
      .map((el) => ({
        key: el.dataset.cohort!,
        rect: el.getBoundingClientRect(),
        text: el.dataset.cohort === 'title' ? el.textContent || '' : '',
        font: getComputedStyle(el).font,
        color: getComputedStyle(el).color,
      }));
  function refresh() {
    clear();
    if (document.documentElement.dataset.family === 'terminal' && capability() !== 'reduced-motion')
      void surface(snapshot(), false, version, false);
  }
  document.addEventListener('bh:motion', refresh);
  document.addEventListener('bh:theme', refresh);
  document.addEventListener('astro:before-preparation', clear);
  document.addEventListener('astro:before-swap', (event: TransitionBeforeSwapEvent) => {
    const from = document.documentElement.dataset.family,
      to = event.newDocument.documentElement.dataset.family;
    event.newDocument.documentElement.dataset.tone = tone();
    event.newDocument.documentElement.dataset.motion = capability();
    afterNavigation = true;
    const old = snapshot(),
      swap = event.swap;
    event.swap = () => {
      swap();
      if (capability() === 'reduced-motion') return;
      // Commit the real route first. No animation promise can hold navigation hostage.
      if (from === 'terminal' && to === 'paper') paper();
      else if (to === 'terminal') void surface(old, from === 'paper', version, true);
      else
        document
          .querySelector('#main')
          ?.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: from === 'hero' ? 450 : 150 });
    };
  });
  document.addEventListener('astro:page-load', () => {
    if (!afterNavigation) refresh();
    afterNavigation = false;
  });
  let resizeTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refresh, 180);
  });

  function paper() {
    const stage = document.querySelector('#fx-stage')!;
    const leaf = document.createElement('div');
    leaf.className = 'paper-leaf';
    leaf.innerHTML = '<div class="paper-front"></div><div class="paper-back"></div>';
    stage.append(leaf);
    const animation = leaf.animate(
      [
        { transform: 'rotateY(-145deg)', opacity: 1 },
        { transform: 'rotateY(-95deg)', offset: 0.28 },
        { transform: 'rotateY(-32deg)', offset: 0.68 },
        { transform: 'rotateY(0deg)', opacity: 0 },
      ],
      {
        duration: capability() === 'light' ? 650 : 1250,
        easing: 'cubic-bezier(.25,.65,.2,1)',
        fill: 'forwards',
      },
    );
    cleanup.push(() => {
      animation.cancel();
      leaf.remove();
    });
    void animation.finished.then(() => leaf.remove()).catch(() => {});
  }

  async function surface(old: Snapshot[], entry: boolean, token: number, animate: boolean) {
    try {
      const { particles, dot } = await import('./particles');
      if (token !== version) return;
      const stage = document.querySelector('#fx-stage')!;
      const targets = snapshot();
      if (entry) void cover().catch((error) => report('transition', error));
      await Promise.all(
        targets.map(async (target, index) => {
          const source = old.find((s) => s.key === target.key) ?? target;
          const rect = target.rect;
          if (rect.width < 1 || rect.height < 1) return;
          const layer = document.createElement('div');
          layer.id = `cohort-${token}-${index}`;
          layer.className = 'particle-cohort';
          Object.assign(layer.style, {
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            opacity: '.3',
          });
          stage.append(layer);
          let engine: Container | undefined;
          cleanup.push(() => {
            engine?.destroy();
            layer.remove();
          });
          function points(value: Snapshot) {
            const result = [];
            // ponytail: bounded cohort approximation; increase sampling only if visual QA requires it.
            if (value.text) {
              const mask = document.createElement('canvas');
              mask.width = Math.ceil(value.rect.width);
              mask.height = Math.ceil(value.rect.height);
              const context = mask.getContext('2d');
              if (context) {
                context.font = value.font;
                context.textBaseline = 'top';
                context.fillText(value.text, 0, 0);
                const data = context.getImageData(0, 0, mask.width, mask.height).data;
                const step = capability() === 'light' ? 6 : 4;
                for (let y = 0; y < mask.height; y += step)
                  for (let x = 0; x < mask.width; x += step) {
                    if (data[(y * mask.width + x) * 4 + 3] > 80)
                      result.push(
                        dot((x / mask.width) * 100, (y / mask.height) * 100, 0.85, value.color),
                      );
                  }
              }
            } else {
              for (let i = 0; i < 100; i++) {
                const horizontal = i < 50,
                  fraction = (i % 50) / 50;
                result.push(
                  dot(
                    horizontal ? fraction * 100 : i % 2 ? 0 : 100,
                    horizontal ? (i % 2 ? 0 : 100) : fraction * 100,
                    0.8,
                    value.color,
                  ),
                );
              }
            }
            const cap = capability() === 'light' ? 220 : 440;
            return result.filter((_, i) => i % Math.max(1, Math.ceil(result.length / cap)) === 0);
          }
          async function draw(value: Snapshot) {
            if (token !== version) return;
            engine = await particles(layer.id, {
              particles: { number: { value: 0 }, move: { enable: false }, opacity: { value: 0.6 } },
              manualParticles: points(value),
            });
            if (token !== version) {
              engine?.destroy();
              layer.remove();
            }
          }
          await draw(animate && !entry ? source : target);
          if (token !== version) return;
          if (animate) {
            const start = entry
              ? {
                  left: index % 2 ? -rect.width : innerWidth,
                  top: index % 2 ? innerHeight : 0,
                  width: rect.width,
                  height: rect.height,
                }
              : source.rect;
            const animation = layer.animate(
              [
                {
                  transform: `translate(${start.left - rect.left}px,${start.top - rect.top}px) scale(${start.width / rect.width},${start.height / rect.height})`,
                  opacity: 0.8,
                },
                { transform: 'translate(0,0) scale(1,1)', opacity: 0.3 },
              ],
              {
                duration: capability() === 'light' ? 500 : 900,
                easing: 'cubic-bezier(.22,.7,.24,1)',
                fill: 'forwards',
              },
            );
            cleanup.push(() => animation.cancel());
            await animation.finished.catch(() => {});
            if (token !== version) return;
            animation.cancel();
            if (!entry) {
              engine?.destroy();
              await draw(target);
            }
          }
          if (token !== version) return;
          const anchor = document.querySelector<HTMLElement>(`[data-cohort="${target.key}"]`);
          const follow = () => {
            if (!anchor) return;
            const bounds = anchor.getBoundingClientRect();
            layer.style.top = `${bounds.top}px`;
            layer.style.left = `${bounds.left}px`;
          };
          window.addEventListener('scroll', follow, { passive: true });
          const observer = new ResizeObserver(() => {
            if (token !== version || !anchor) return;
            const bounds = anchor.getBoundingClientRect();
            if (bounds.width !== rect.width || bounds.height !== rect.height) refresh();
            else follow();
          });
          if (anchor) observer.observe(anchor, { box: 'border-box' });
          cleanup.push(() => {
            window.removeEventListener('scroll', follow);
            observer.disconnect();
          });
          follow();
        }),
      );
      async function cover() {
        const layer = document.createElement('div');
        layer.id = `cover-${token}`;
        layer.style.cssText = 'position:absolute;inset:0';
        stage.append(layer);
        let engine: EmitterContainer | undefined;
        cleanup.push(() => {
          engine?.destroy();
          layer.remove();
        });
        engine = (await particles(layer.id, {
          particles: {
            number: { value: 0 },
            paint: { color: { value: '#9aa68c' } },
            size: { value: { min: 0.6, max: 2 } },
            move: {
              enable: true,
              speed: capability() === 'light' ? 10 : 20,
              straight: true,
              outModes: 'destroy',
            },
            life: { count: 1, duration: { value: 0.75 } },
          },
        })) as EmitterContainer;
        if (token !== version) {
          engine?.destroy();
          layer.remove();
          return;
        }
        for (const [x, y, direction] of [
          [0, 50, 'right'],
          [100, 50, 'left'],
          [50, 0, 'bottom'],
          [50, 100, 'top'],
        ] as const) {
          await engine?.addEmitter?.({
            position: { x, y },
            direction,
            size: { width: x === 50 ? 100 : 0, height: y === 50 ? 100 : 0 },
            rate: { quantity: capability() === 'light' ? 7 : 16, delay: 0.04 },
            life: { count: 1, duration: 0.2 },
          });
        }
        const timer = setTimeout(() => {
          engine?.destroy();
          layer.remove();
        }, 1100);
        cleanup.push(() => clearTimeout(timer));
      }
    } catch (error) {
      report('transition', error);
    }
  }
}
