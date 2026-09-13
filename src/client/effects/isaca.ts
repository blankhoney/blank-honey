import type { HeroContext } from '../hero';

export default async function ({ host, signal, reduced }: HeroContext) {
  const cards = [...host.querySelectorAll<HTMLElement>('.index-card')];
  let front = 0;
  function rotate() {
    front = (front + 1) % cards.length;
    cards.forEach((card, index) => {
      card.dataset.front = String(index === front);
      card.inert = index !== front;
    });
  }
  cards.forEach((card, index) => {
    card.dataset.front = String(index === 0);
    card.inert = index !== 0;
  });
  host.querySelector('#index-switch')!.addEventListener('click', rotate, { signal });
  if (reduced) return;
  const timer = window.setInterval(() => {
    if (!document.hidden) rotate();
  }, 6500);
  signal.addEventListener('abort', () => clearInterval(timer), { once: true });
}
