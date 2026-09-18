import baffle from 'baffle';

/** Background fiction only: these strings never substitute for live metrics or article text. */
export function mountCipherLines(
  host: HTMLElement,
  signal: AbortSignal,
  light: boolean,
  scramble = baffle,
) {
  const entries: { element: HTMLElement; text: string; effect: ReturnType<typeof baffle> }[] = [];
  const messages = ['0101 // QUIET CHANNEL', 'MEMORY / 00110110', 'SIGNAL → PAPER / 0101'];
  let held = true;
  let disposed = false;
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (!signal.aborted) {
    for (const text of messages.slice(0, light ? 2 : 3)) {
      const element = document.createElement('span');
      element.className = 'cipher-line';
      element.setAttribute('aria-hidden', 'true');
      element.textContent = text;
      host.append(element);
      entries.push({
        element,
        text,
        effect: scramble(element, { characters: '01_/<>[]', speed: light ? 140 : 90 }),
      });
    }
  }
  function reset() {
    clearTimeout(timer);
    timer = undefined;
    for (const { element, text, effect } of entries) {
      effect.stop().text(() => text);
      element.classList.remove('cipher-active');
    }
  }
  function schedule() {
    if (disposed || held || !entries.length) return;
    timer = setTimeout(
      () => {
        if (disposed || held) return;
        const entry = entries[index++ % entries.length];
        entry.element.classList.add('cipher-active');
        entry.effect.start();
        // Baffle.reveal() starts an untracked timeout, even with zero delay. Own both
        // burst and restore timers instead, so stop/abort cannot restart its interval.
        timer = setTimeout(
          () => {
            reset();
            schedule();
          },
          light ? 500 : 720,
        );
      },
      light ? 8500 : 5200,
    );
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    reset();
    for (const entry of entries) entry.element.remove();
    signal.removeEventListener('abort', dispose);
  }
  signal.addEventListener('abort', dispose, { once: true });
  if (signal.aborted) dispose();
  return {
    pause(paused: boolean) {
      if (disposed || paused === held) return;
      held = paused;
      reset();
      if (!held) schedule();
    },
    dispose,
  };
}
