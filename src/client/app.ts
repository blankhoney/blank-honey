import { applyPreferences, capability, commentTheme, store } from './preferences';
import { initSearch } from './search';
import { initAudio } from './audio';
import { report } from './log';
import { initTransitions } from './transitions';
let pageController: AbortController | undefined;
const shell = document.querySelector<HTMLElement>('#shell')!;
const panel = shell.querySelector<HTMLElement>('#navigation')!;
const dot = shell.querySelector<HTMLButtonElement>('#nav-dot')!;
const searchPanel = shell.querySelector<HTMLElement>('#shell-search')!;
let shellVersion = 0;
let shellAnimations: Animation[] = [];
function overlay(open: boolean, restore = true, instant = false) {
  const token = ++shellVersion;
  const main = document.querySelector<HTMLElement>('#main')!;
  const currentPageWidth = getComputedStyle(main).width;
  const active = shell.classList.contains('shell-active');
  const members = [
    searchPanel,
    ...panel.querySelectorAll<HTMLElement>('.nav-top, nav a, .settings, .about'),
  ];
  const current = members.map((member) => {
    const style = getComputedStyle(member);
    return { transform: style.transform, opacity: style.opacity };
  });
  shellAnimations.forEach((animation) => animation.cancel());
  shellAnimations = [];
  document.documentElement.dataset.navigation = open ? 'open' : 'closed';
  panel.classList.toggle('open', open);
  panel.inert = searchPanel.inert = !open;
  dot.setAttribute('aria-expanded', String(open));
  dot.setAttribute('aria-label', open ? '关闭导航与搜索' : '打开导航与搜索');
  if (open) {
    if (!active) panel.scrollTop = 0;
    shell.classList.add('shell-active');
    searchPanel.querySelector<HTMLInputElement>('#search')!.focus({ preventScroll: true });
    shell.style.setProperty('--shell-search-height', `${searchPanel.offsetHeight}px`);
  }
  if (
    !open &&
    (restore ||
      searchPanel.contains(document.activeElement) ||
      panel.contains(document.activeElement))
  )
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
      const closed =
        index === 0
          ? `translate(80px, ${-bounds.bottom - 30}px) rotate(-9deg) scale(.92)`
          : `translate(${origin.left + origin.width / 2 - bounds.left}px, ${origin.top + origin.height / 2 - bounds.top - bounds.height / 2}px) rotate(-110deg) scale(.025)`;
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
const searchSize = new ResizeObserver(() => {
  shell.style.setProperty('--shell-search-height', `${searchPanel.offsetHeight}px`);
});
searchSize.observe(searchPanel);
window.addEventListener('resize', () => overlay(panel.classList.contains('open'), false, true));
document.addEventListener('astro:before-preparation', () => overlay(false, false, true));
document.addEventListener('bh:motion', () =>
  overlay(panel.classList.contains('open'), false, true),
);
dot.addEventListener('click', () => overlay(!panel.classList.contains('open')));
shell.querySelector('#close-nav')!.addEventListener('click', () => overlay(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    // The first Escape belongs to an open native picker; the next closes the shell.
    const pickerOpen =
      CSS.supports('appearance', 'base-select') && shell.querySelector('select:open');
    if (!pickerOpen) overlay(false);
  }
  if (event.key === 'Tab' && panel.classList.contains('open')) {
    const items = [
      ...shell.querySelectorAll<HTMLElement>(
        '#shell-search a, #shell-search input, #shell-search select, #navigation a, #navigation button, #navigation input, #navigation select',
      ),
    ].filter((e) => !e.hasAttribute('disabled') && e.getClientRects().length);
    const first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
document.addEventListener('click', (event) => {
  const el = event.target as Element;
  if (panel.classList.contains('open') && !shell.contains(el)) overlay(false, false);
  if (el.closest('#search-results a, #navigation nav a')) overlay(false, false, true);
  const theme = el.closest<HTMLElement>('[data-theme]');
  if (theme) {
    store.set('theme', theme.dataset.theme!);
    applyPreferences();
  }
  const motion = el.closest<HTMLElement>('button[data-motion]');
  if (motion) {
    store.set('motion', motion.dataset.motion!);
    applyPreferences();
    document.dispatchEvent(new Event('bh:motion'));
  }
});
initSearch(() => overlay(true));
initAudio();
initTransitions();
window.addEventListener('error', (e) => report('frontend', e.error));
window.addEventListener('unhandledrejection', (e) => report('frontend', e.reason));
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
reduce.addEventListener('change', () => {
  applyPreferences();
  document.dispatchEvent(new Event('bh:motion'));
});
setInterval(applyPreferences, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) applyPreferences();
});
document.addEventListener('astro:before-swap', () => pageController?.abort());
async function mount() {
  pageController?.abort();
  const controller = (pageController = new AbortController());
  const signal = controller.signal;
  applyPreferences();
  shell.querySelectorAll<HTMLAnchorElement>('nav a').forEach((a) => {
    const active =
      location.pathname.startsWith(a.pathname) ||
      (a.pathname === '/articles/' && /^\/(blog|category)\//.test(location.pathname));
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (document.documentElement.dataset.family === 'hero') overlay(false, false);
  try {
    if (document.querySelector('#hero')) await (await import('./hero')).mountHero(signal);
    if (signal.aborted) return;
    if (document.querySelector('#probe')) await (await import('./probe')).mountProbe(signal);
    if (signal.aborted) return;
    if (document.querySelector('#map')) await (await import('./map')).mountMap(signal);
    if (signal.aborted) return;
    if (document.querySelector('#graph')) await (await import('./graph')).mountGraph(signal);
    if (signal.aborted) return;
    const comments = document.querySelector<HTMLElement>('#giscus');
    if (comments) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          observer.disconnect();
          const script = document.createElement('script');
          script.src = 'https://giscus.app/client.js';
          script.async = true;
          script.crossOrigin = 'anonymous';
          for (const [key, value] of Object.entries({
            repo: comments.dataset.repo!,
            'repo-id': comments.dataset.repoId!,
            category: 'Announcements',
            'category-id': comments.dataset.categoryId!,
            mapping: 'pathname',
            strict: '1',
            'reactions-enabled': '1',
            'emit-metadata': '0',
            'input-position': 'bottom',
            theme: commentTheme(),
            lang: 'zh-CN',
          }))
            script.setAttribute(`data-${key}`, value);
          comments.append(script);
        },
        { rootMargin: '250px' },
      );
      observer.observe(comments);
      signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    }
  } catch (error) {
    if (!signal.aborted) report('enhancement', error);
  }
}
document.addEventListener('astro:page-load', mount);
