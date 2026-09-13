import { applyPreferences, store } from './preferences';
import { initSearch } from './search';
import { initAudio } from './audio';
import { report } from './log';
import { initTransitions } from './transitions';
let pageController: AbortController | undefined;
const shell = document.querySelector<HTMLElement>('#shell')!;
const panel = shell.querySelector<HTMLElement>('#navigation')!;
const dot = shell.querySelector<HTMLButtonElement>('#nav-dot')!;
function overlay(open: boolean, restore = true) {
  panel.classList.toggle('open', open);
  panel.inert = !open;
  dot.setAttribute('aria-expanded', String(open));
  dot.setAttribute('aria-label', open ? '关闭导航与搜索' : '打开导航与搜索');
  if (!open && restore) dot.focus({ preventScroll: true });
  if (open)
    requestAnimationFrame(() => {
      if (panel.classList.contains('open'))
        panel.querySelector<HTMLInputElement>('#search')!.focus({ preventScroll: true });
    });
}
dot.addEventListener('click', () => overlay(!panel.classList.contains('open')));
shell.querySelector('#close-nav')!.addEventListener('click', () => overlay(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') overlay(false);
  if (event.key === 'Tab' && panel.classList.contains('open')) {
    const items = [...panel.querySelectorAll<HTMLElement>('a,button,input,select')].filter(
      (e) => !e.hasAttribute('disabled') && e.getClientRects().length,
    );
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
  if (el.closest('#search-results a, #navigation nav a')) overlay(false, false);
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
            theme: document.documentElement.dataset.tone!,
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
