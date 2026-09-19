import { capability } from './preferences';

export function isNavigationCurrent(pathname: string, target: string): boolean {
  if (target === '/') return pathname === '/';
  return (
    pathname.startsWith(target) ||
    (target === '/articles/' && /^\/(blog|category)\//.test(pathname))
  );
}

export function initNavigation() {
  const shell = document.querySelector<HTMLElement>('#shell')!;
  const panel = shell.querySelector<HTMLElement>('#navigation')!;
  const dot = shell.querySelector<HTMLButtonElement>('#nav-dot')!;
  let shellVersion = 0;
  let shellAnimations: Animation[] = [];
  function setOpen(open: boolean, restore = true, instant = false) {
    const token = ++shellVersion;
    const main = document.querySelector<HTMLElement>('#main')!;
    const currentPageWidth = getComputedStyle(main).width;
    const active = shell.classList.contains('shell-active');
    const members = [...panel.querySelectorAll<HTMLElement>('.nav-top, nav a, .settings, .about')];
    const current = members.map((member) => {
      const style = getComputedStyle(member);
      return { transform: style.transform, opacity: style.opacity };
    });
    shellAnimations.forEach((animation) => animation.cancel());
    shellAnimations = [];
    document.documentElement.dataset.navigation = open ? 'open' : 'closed';
    panel.classList.toggle('open', open);
    panel.inert = !open;
    dot.setAttribute('aria-expanded', String(open));
    dot.title = open ? '收起导航' : '打开导航';
    dot.setAttribute('aria-label', open ? '收起导航' : '打开导航');
    if (open) {
      if (!active) panel.scrollTop = 0;
      shell.classList.add('shell-active');
    }
    if (!open && (restore || panel.contains(document.activeElement)))
      dot.focus({ preventScroll: true });
    function finish() {
      if (token !== shellVersion) return;
      shell.classList.toggle('shell-active', open);
      shell.classList.remove('shell-moving');
      shellAnimations.forEach((animation) => animation.cancel());
      shellAnimations = [];
    }
    if (instant || capability() === 'reduced-motion' || (!active && !open)) {
      finish();
    } else {
      shell.classList.add('shell-active', 'shell-moving');
      const origin = dot.getBoundingClientRect();
      // A slower release gives the sidebar and reading surface one shared rhythm.
      const duration = capability() === 'light' ? 500 : 850;
      shellAnimations = members.map((member, index) => {
        const bounds = member.getBoundingClientRect();
        const closed = `translate(${origin.left + origin.width / 2 - bounds.left}px, ${origin.top + origin.height / 2 - bounds.top - bounds.height / 2}px) rotate(-110deg) scale(.025)`;
        return member.animate(
          [
            active ? current[index] : { transform: closed, opacity: 0 },
            {
              transform: open ? 'translate(0, 0) rotate(0) scale(1)' : closed,
              opacity: open ? 1 : 0,
            },
          ],
          {
            duration,
            delay: open ? index * 12 : 0,
            easing: 'cubic-bezier(.22,.7,.24,1)',
            fill: 'both',
          },
        );
      });
      shellAnimations.push(
        main.animate([{ width: currentPageWidth }, { width: getComputedStyle(main).width }], {
          duration,
          easing: 'cubic-bezier(.22,.7,.24,1)',
          fill: 'both',
        }),
      );
      void Promise.all(shellAnimations.map((animation) => animation.finished.catch(() => {}))).then(
        finish,
      );
    }
  }

  dot.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  shell.querySelector('#close-nav')!.addEventListener('click', () => setOpen(false));
  window.addEventListener('resize', () => setOpen(panel.classList.contains('open'), false, true));
  document.addEventListener('bh:motion', () =>
    setOpen(panel.classList.contains('open'), false, true),
  );
  return { setOpen };
}
