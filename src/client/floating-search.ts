import {
  searchCloseDelay,
  searchPanelTop,
  searchTiming,
  searchTriggerHeight,
} from './search-policy';

/** Independent search lifecycle for the persistent shell. */
export function initFloatingSearch(signal?: AbortSignal) {
  if (signal?.aborted)
    return { open: (_focus = false) => {}, close: () => {}, isOpen: () => false };
  const panel = document.querySelector<HTMLElement>('#shell-search')!;
  const trigger = document.querySelector<HTMLButtonElement>('#search-edge')!;
  const input = panel.querySelector<HTMLInputElement>('#search')!;
  const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
  const listenerOptions = { signal };
  let visible = false;
  let pointerInEdge = false;
  let pointerInPanel = false;
  let suppressedUntilExit = false;
  let composing = false;
  let lastActivity = Date.now();
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let positionFrame = 0;

  function positionPanel() {
    const back = document.querySelector<HTMLElement>('#main[data-article] .reading-page > .back');
    const top = searchPanelTop(back?.getBoundingClientRect() ?? null, innerHeight);
    panel.style.setProperty('--search-top', `${top}px`);
  }

  function cancelPositionFrame() {
    if (positionFrame) cancelAnimationFrame(positionFrame);
    positionFrame = 0;
  }

  function schedulePosition() {
    if (!visible || signal?.aborted || positionFrame) return;
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      if (visible && !signal?.aborted) positionPanel();
    });
  }

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
    if (signal?.aborted || document.documentElement.dataset.family === 'hero') return;
    positionPanel();
    if (!visible) lastActivity = Date.now();
    visible = true;
    panel.inert = false;
    panel.classList.add('search-open');
    trigger.setAttribute('aria-expanded', 'true');
    if (focus) input.focus({ preventScroll: true });
    scheduleClose();
  }

  function close() {
    const restoreFocus = !signal?.aborted && panel.contains(document.activeElement);
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    cancelPositionFrame();
    visible = false;
    // Even closing by keyboard must not immediately reopen under the mouse.
    suppressedUntilExit = true;
    panel.classList.remove('search-open');
    panel.inert = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function updatePointer(event: PointerEvent) {
    if (!hoverPointer.matches || event.pointerType !== 'mouse') return;
    const target = event.target;
    const inPanel = visible && target instanceof Node && panel.contains(target);
    // Controls keep their own pointer intent, even when a child occupies the edge.
    const inControl =
      target instanceof Element &&
      Boolean(
        target.closest(
          '#nav-dot, #navigation, a[href], button, input, textarea, select, summary, [role="button"], [contenteditable]:not([contenteditable="false"])',
        ),
      );
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

  document.addEventListener('pointermove', updatePointer, listenerOptions);
  document.addEventListener('pointerdown', () => clearTimeout(openTimer), listenerOptions);
  document.documentElement.addEventListener(
    'pointerleave',
    () => {
      clearTimeout(openTimer);
      pointerInEdge = false;
      pointerInPanel = false;
      suppressedUntilExit = false;
      scheduleClose();
    },
    listenerOptions,
  );
  trigger.addEventListener('click', () => open(true), listenerOptions);
  document.addEventListener(
    'keydown',
    (event) => {
      const target = event.target;
      const editing =
        target instanceof HTMLElement &&
        (target.isContentEditable || Boolean(target.closest('input, textarea, select')));
      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !editing &&
        document.documentElement.dataset.family !== 'hero'
      ) {
        event.preventDefault();
        open(true);
      }
    },
    listenerOptions,
  );
  panel.querySelector('#close-search')!.addEventListener('click', close, listenerOptions);
  for (const eventName of ['input', 'change', 'keydown', 'pointerdown']) {
    panel.addEventListener(
      eventName,
      () => {
        lastActivity = Date.now();
        scheduleClose();
      },
      listenerOptions,
    );
  }
  panel.addEventListener('focusin', scheduleClose, listenerOptions);
  panel.addEventListener('focusout', () => queueMicrotask(scheduleClose), listenerOptions);
  panel.addEventListener(
    'compositionstart',
    () => {
      composing = true;
      scheduleClose();
    },
    listenerOptions,
  );
  panel.addEventListener(
    'compositionend',
    () => {
      composing = false;
      lastActivity = Date.now();
      scheduleClose();
    },
    listenerOptions,
  );
  window.addEventListener('scroll', schedulePosition, { signal, passive: true });
  window.addEventListener('resize', schedulePosition, listenerOptions);
  signal?.addEventListener(
    'abort',
    () => {
      close();
      panel.style.removeProperty('--search-top');
    },
    { once: true },
  );
  return { open, close, isOpen: () => visible };
}
