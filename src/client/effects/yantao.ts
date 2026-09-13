import type { HeroContext } from '../hero';

export default async function ({ host, stage, signal, reduced, light }: HeroContext) {
  const code = host.querySelector<HTMLElement>('#hero-code')!;
  const text = code.dataset.text ?? '';
  code.textContent = text;
  if (reduced) return;
  const { particles } = await import('../particles');
  if (signal.aborted) return;
  const container = await particles(stage.id, {
    particles: {
      number: { value: light ? 28 : 65 },
      size: { value: { min: 0.6, max: 1.6 } },
      paint: { color: { value: '#73babc' } },
      move: { enable: true, speed: 0.2, outModes: { default: 'bounce' } },
      links: { enable: true, distance: 140, color: '#73babc', opacity: 0.2 },
    },
  });
  if (signal.aborted) {
    container?.destroy();
    return;
  }
  const headlines: string[] = JSON.parse(host.dataset.headlines ?? '[]');
  const heading = host.querySelector('h1')!;
  const panel = host.querySelector<HTMLElement>('.hero-code-window')!;
  let slide = 0;
  let position = 0;
  let currentText = text;
  let animation: Animation | undefined;
  let typing: number | undefined;
  function nextSlide() {
    clearInterval(typing);
    animation?.cancel();
    if (headlines.length) {
      heading.textContent = headlines[slide % headlines.length];
      currentText = `${text}\n\n// ${headlines[slide % headlines.length]}`;
      slide++;
    }
    position = 0;
    code.textContent = '';
    animation = panel.animate(
      [
        { opacity: 0, transform: 'translateY(18px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 800, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
    typing = window.setInterval(() => {
      if (document.hidden) return;
      position += 2;
      code.textContent = currentText.slice(0, position);
      if (position >= currentText.length) clearInterval(typing);
    }, 28);
  }
  nextSlide();
  const carousel = window.setInterval(() => {
    if (!document.hidden) nextSlide();
  }, 7500);
  signal.addEventListener(
    'abort',
    () => {
      animation?.cancel();
      clearInterval(typing);
      clearInterval(carousel);
      container?.destroy();
    },
    { once: true },
  );
}
