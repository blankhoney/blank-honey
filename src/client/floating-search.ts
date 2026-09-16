import { searchCloseDelay, searchTiming, searchTriggerHeight } from './search-policy';

/** Independent search lifecycle for the persistent shell. */
export function initFloatingSearch() {
  const panel = document.querySelector<HTMLElement>('#shell-search')!;
  const trigger = document.querySelector<HTMLButtonElement>('#open-search')!;
  const input = panel.querySelector<HTMLInputElement>('#search')!;
  const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
  let visible = false;
  let pointerInEdge = false;
  let pointerInPanel = false;
  let suppressedUntilExit = false;
  let composing = false;
  let lastActivity = Date.now();
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function hasCriteria() {
    return Boolean(
      input.value.trim() || [...panel.querySelectorAll('select')].some((select) => select.value),
    );
  }

  function protectedInteraction() {
    return pointerInEdge || pointerInPanel || composing || panel.contains(document.activeElement);
  }

  function scheduleClose() {
    clearTimeout(closeTimer);
    if (!visible) return;
    const delay = searchCloseDelay({
      protected: protectedInteraction(),
      hasCriteria: hasCriteria(),
      elapsed: Date.now() - lastActivity,
    });
    if (delay !== null) {
      closeTimer = setTimeout(() => {
        // A focus or pointer event may have arrived while the timer was queued.
        if (!protectedInteraction()) close();
      }, delay);
    }
  }

  function open(focus = false) {
    clearTimeout(openTimer);
    if (document.documentElement.dataset.family === 'hero') return;
    if (!visible) lastActivity = Date.now();
    visible = true;
    panel.inert = false;
    panel.classList.add('search-open');
    trigger.setAttribute('aria-expanded', 'true');
    if (focus) input.focus({ preventScroll: true });
    scheduleClose();
  }

  function close() {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    visible = false;
    // Even closing by keyboard must not immediately reopen under the mouse.
    suppressedUntilExit = true;
    panel.classList.remove('search-open');
    panel.inert = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (panel.contains(document.activeElement)) trigger.focus({ preventScroll: true });
  }

  function updatePointer(event: PointerEvent) {
    if (!hoverPointer.matches || event.pointerType !== 'mouse') return;
    const target = event.target;
    const inPanel = visible && target instanceof Node && panel.contains(target);
    const inControl =
      target instanceof Element && Boolean(target.closest('#nav-dot, #open-search, #navigation'));
    const inEdge =
      event.clientY >= 0 && event.clientY <= searchTriggerHeight(innerHeight) && !inControl;
    const enteredEdge = inEdge && !pointerInEdge;
    const regionChanged = inEdge !== pointerInEdge || inPanel !== pointerInPanel;
    pointerInEdge = inEdge;
    pointerInPanel = inPanel;
    if (!inEdge) clearTimeout(openTimer);
    if (!inEdge && !inPanel) suppressedUntilExit = false;
    if (enteredEdge && !visible && !suppressedUntilExit) {
      openTimer = setTimeout(() => {
        if (pointerInEdge && !suppressedUntilExit) open();
      }, searchTiming.enter);
    }
    // Ordinary movement outside must not keep postponing the leave deadline.
    if (regionChanged) scheduleClose();
  }

  document.addEventListener('pointermove', updatePointer);
  document.documentElement.addEventListener('pointerleave', () => {
    clearTimeout(openTimer);
    pointerInEdge = false;
    pointerInPanel = false;
    suppressedUntilExit = false;
    scheduleClose();
  });
  trigger.addEventListener('click', () => open(true));
  panel.querySelector('#close-search')!.addEventListener('click', close);
  for (const eventName of ['input', 'change', 'keydown', 'pointerdown']) {
    panel.addEventListener(eventName, () => {
      lastActivity = Date.now();
      scheduleClose();
    });
  }
  panel.addEventListener('focusin', scheduleClose);
  panel.addEventListener('focusout', () => queueMicrotask(scheduleClose));
  panel.addEventListener('compositionstart', () => {
    composing = true;
    scheduleClose();
  });
  panel.addEventListener('compositionend', () => {
    composing = false;
    lastActivity = Date.now();
    scheduleClose();
  });
  return { open, close, isOpen: () => visible };
}
