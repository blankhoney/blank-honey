/** Search belongs to the persistent shell, independently of the reading navigation. */
export function initFloatingSearch() {
  const panel = document.querySelector<HTMLElement>('#shell-search')!;
  const trigger = document.querySelector<HTMLButtonElement>('#open-search')!;
  const input = panel.querySelector<HTMLInputElement>('#search')!;
  const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
  let visible = false;
  let pointerInRegion = false;
  let suppressedUntilExit = false;
  let composing = false;
  let lastActivity = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const retentionMs = 60_000;

  function hasCriteria() {
    return Boolean(
      input.value.trim() || [...panel.querySelectorAll('select')].some((select) => select.value),
    );
  }

  function interacting() {
    return composing || panel.contains(document.activeElement) || panel.matches(':hover');
  }

  function schedule() {
    clearTimeout(timer);
    if (!visible) return;
    if (!hasCriteria() && !pointerInRegion && !interacting()) {
      timer = setTimeout(close, 300);
    } else {
      timer = setTimeout(
        () => {
          if (interacting()) return; // Focus/pointer exit schedules the next check.
          close();
        },
        Math.max(0, retentionMs - (Date.now() - lastActivity)),
      );
    }
  }

  function open(focus = false) {
    if (document.documentElement.dataset.family === 'hero') return;
    if (!visible) lastActivity = Date.now();
    visible = true;
    panel.inert = false;
    panel.classList.add('search-open');
    trigger.setAttribute('aria-expanded', 'true');
    if (focus) input.focus({ preventScroll: true });
    schedule();
  }

  function close() {
    clearTimeout(timer);
    if (panel.contains(document.activeElement)) trigger.focus({ preventScroll: true });
    visible = false;
    suppressedUntilExit = pointerInRegion;
    panel.classList.remove('search-open');
    panel.inert = true;
    trigger.setAttribute('aria-expanded', 'false');
  }

  function updatePointer(event: PointerEvent) {
    if (!hoverPointer.matches || event.pointerType !== 'mouse') return;
    const target = event.target;
    const inside =
      event.clientY <= window.innerHeight / 5 || (target instanceof Node && panel.contains(target));
    const entered = inside && !pointerInRegion;
    pointerInRegion = inside;
    if (!inside) suppressedUntilExit = false;
    if (entered && !suppressedUntilExit) open();
    schedule();
  }

  document.addEventListener('pointermove', updatePointer);
  document.documentElement.addEventListener('pointerleave', () => {
    pointerInRegion = false;
    suppressedUntilExit = false;
    schedule();
  });
  trigger.addEventListener('click', () => open(true));
  panel.querySelector('#close-search')!.addEventListener('click', close);
  for (const eventName of ['input', 'change', 'keydown', 'pointerdown']) {
    panel.addEventListener(eventName, () => {
      lastActivity = Date.now();
      schedule();
    });
  }
  panel.addEventListener('compositionstart', () => {
    composing = true;
  });
  panel.addEventListener('compositionend', () => {
    composing = false;
    lastActivity = Date.now();
    schedule();
  });
  panel.addEventListener('focusout', () => queueMicrotask(schedule));
  panel.addEventListener('pointerleave', schedule);
  return { open, close, isOpen: () => visible };
}
