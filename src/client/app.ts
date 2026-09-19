import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { initNavigation, isNavigationCurrent } from './navigation';
import { initFloatingSearch } from './floating-search';
import { applyPreferences, commentTheme, store } from './preferences';
import { initSearch } from './search';
import { initAudio } from './audio';
import { report } from './log';
import { initTransitions } from './transitions';
let pageController: AbortController | undefined;
const shell = document.querySelector<HTMLElement>('#shell')!;
const navigation = initNavigation();
const floatingSearch = initFloatingSearch();
let previousFamily: string | undefined;
document.addEventListener('astro:before-preparation', () => {
  floatingSearch.close();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const pickerOpen =
    CSS.supports('appearance', 'base-select') &&
    document.querySelector(':is(#shell, #main) select:open');
  if (pickerOpen) return;
  if (floatingSearch.isOpen()) floatingSearch.close();
  else navigation.setOpen(false);
});
document.addEventListener('click', (event) => {
  const element = event.target as Element;
  const theme = element.closest<HTMLElement>('[data-theme]');
  if (theme) {
    store.set('theme', theme.dataset.theme!);
    applyPreferences();
  }
  const motion = element.closest<HTMLElement>('button[data-motion]');
  if (motion) {
    store.set('motion', motion.dataset.motion!);
    applyPreferences();
    document.dispatchEvent(new Event('bh:motion'));
  }
});
initSearch(() => floatingSearch.open(true));
initAudio();
initTransitions();
window.addEventListener('error', (e) => report('frontend', e.error));
window.addEventListener('unhandledrejection', (e) => report('frontend', e.reason));
for (const query of ['(prefers-reduced-motion: reduce)', '(max-width: 700px)']) {
  matchMedia(query).addEventListener('change', () => {
    applyPreferences();
    document.dispatchEvent(new Event('bh:motion'));
  });
}
setInterval(applyPreferences, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) applyPreferences();
});
document.addEventListener('astro:before-swap', (event: TransitionBeforeSwapEvent) => {
  pageController?.abort();
  // The persistent sidebar and the replacement document must share layout state.
  event.newDocument.documentElement.dataset.navigation =
    document.documentElement.dataset.navigation;
});
async function mount() {
  pageController?.abort();
  const controller = (pageController = new AbortController());
  const signal = controller.signal;
  applyPreferences();
  shell.querySelectorAll<HTMLAnchorElement>('nav a').forEach((a) => {
    const active = isNavigationCurrent(location.pathname, a.pathname);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const family = document.documentElement.dataset.family;
  if (family === 'hero') navigation.setOpen(false, false);
  else if (
    (previousFamily === 'hero' || previousFamily === undefined) &&
    /^\/(articles|blog|category)\//.test(location.pathname)
  ) {
    navigation.setOpen(true, false);
  }
  previousFamily = family;
  try {
    if (document.querySelector('#hero')) await (await import('./hero')).mountHero(signal);
    if (signal.aborted) return;
    if (document.querySelector('#probe')) await (await import('./probe')).mountProbe(signal);
    if (signal.aborted) return;
    if (document.querySelector('#map')) await (await import('./map')).mountMap(signal);
    if (signal.aborted) return;
    if (document.querySelector('#graph')) await (await import('./graph')).mountGraph(signal);
    if (signal.aborted) return;
    if (document.querySelector('#main[data-article]')) {
      const { mountReadingMotion } = await import('./reading-motion');
      if (signal.aborted) return;
      mountReadingMotion(signal);
    }
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
