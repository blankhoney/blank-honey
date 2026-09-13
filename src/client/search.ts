import { report } from './log';
type Result = { url: string; meta: { title?: string }; excerpt: string };
type Pagefind = {
  search: (
    query: string | null,
    options?: unknown,
  ) => Promise<{ results: { data: () => Promise<Result> }[] }>;
};
let engine: Promise<Pagefind> | undefined;
export function initSearch(open: () => void) {
  const input = document.querySelector<HTMLInputElement>('#search')!;
  const category = document.querySelector<HTMLSelectElement>('#filter-category')!;
  const tag = document.querySelector<HTMLSelectElement>('#filter-tag')!;
  const output = document.querySelector<HTMLElement>('#search-results')!;
  let generation = 0,
    timer: ReturnType<typeof setTimeout>;
  const bundle = '/pagefind/pagefind.js';
  const load = (): Promise<Pagefind> =>
    (engine ??= import(/* @vite-ignore */ bundle).catch((error) => {
      engine = undefined;
      throw error;
    }));
  // Pagefind emits markup for highlights; only its mark/b elements survive.
  function excerpt(value: string) {
    const parsed = new DOMParser().parseFromString(value, 'text/html');
    const fragment = document.createDocumentFragment();
    function append(node: Node, parent: Node) {
      if (node.nodeType === Node.TEXT_NODE)
        parent.appendChild(document.createTextNode(node.textContent || ''));
      else if (node instanceof Element) {
        const target = ['MARK', 'B'].includes(node.tagName)
          ? document.createElement('mark')
          : parent;
        if (target !== parent) parent.appendChild(target);
        node.childNodes.forEach((n) => append(n, target));
      }
    }
    parsed.body.childNodes.forEach((n) => append(n, fragment));
    return fragment;
  }
  async function run() {
    const token = ++generation;
    if (!input.value.trim() && !category.value && !tag.value) {
      output.replaceChildren();
      return;
    }
    output.textContent = '正在寻找…';
    try {
      const pagefind = await load();
      const filters: Record<string, string> = {};
      if (category.value) filters.category = category.value;
      if (tag.value) filters.tag = tag.value;
      const found = await pagefind.search(input.value.trim() || null, { filters });
      const results = await Promise.all(found.results.slice(0, 20).map((r) => r.data()));
      if (token !== generation) return;
      output.replaceChildren();
      const count = document.createElement('p');
      count.className = 'muted small';
      count.textContent = `${found.results.length} 条记录`;
      output.append(count);
      for (const result of results) {
        const url = new URL(result.url, location.origin);
        if (url.origin !== location.origin || !url.pathname.startsWith('/blog/')) continue;
        const a = document.createElement('a');
        a.href = url.href;
        const h = document.createElement('h3');
        h.textContent = result.meta.title || '文章';
        const p = document.createElement('p');
        p.append(excerpt(result.excerpt));
        a.append(h, p);
        output.append(a);
      }
    } catch (error) {
      if (token === generation) output.textContent = '搜索暂不可用，请从文章目录浏览。';
      report('search', error);
    }
  }
  input.addEventListener('focus', () => {
    document.querySelector<HTMLElement>('#search-filters')!.hidden = false;
    void load().catch(() => {});
  });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    ++generation;
    timer = setTimeout(run, 160);
  });
  category.addEventListener('change', run);
  tag.addEventListener('change', run);
  document.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-search-tag]');
    if (!button) return;
    tag.value = button.dataset.searchTag!;
    category.value = '';
    input.value = '';
    open();
    input.focus();
    void run();
  });
}
