import { navigate } from 'astro:transitions/client';
import { capability } from './preferences';
export async function mountGraph(signal: AbortSignal) {
  const elements = JSON.parse(document.querySelector('#graph-data')!.textContent!);
  if (!elements.length || signal.aborted) return;
  const { default: cytoscape } = await import('cytoscape');
  if (signal.aborted) return;
  const host = document.querySelector<HTMLElement>('#graph')!;
  const style = getComputedStyle(document.documentElement),
    color = style.getPropertyValue('--fg').trim(),
    accent = style.getPropertyValue('--accent').trim();
  const graph = cytoscape({
    container: host,
    elements,
    layout: { name: 'circle', padding: 24, animate: false },
    minZoom: 0.1,
    maxZoom: 2,
    style: [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          'background-color': accent,
          color,
          'font-size': 16,
          'line-height': 1.3,
          'font-family': 'monospace',
          'text-wrap': 'wrap',
          'text-max-width': '120px',
          'text-valign': 'bottom',
          'text-margin-y': 12,
          width: 8,
          height: 8,
        },
      },
      {
        selector: 'edge',
        style: { width: 1, 'line-color': accent, 'curve-style': 'bezier', opacity: 0.35 },
      },
      { selector: 'node:selected', style: { width: 13, height: 13 } },
    ],
  });
  document.addEventListener(
    'bh:theme',
    () => {
      const style = getComputedStyle(document.documentElement),
        color = style.getPropertyValue('--fg').trim(),
        accent = style.getPropertyValue('--accent').trim();
      graph
        .style()
        .selector('node')
        .style({ color, 'background-color': accent })
        .selector('edge')
        .style({ 'line-color': accent })
        .update();
    },
    { signal },
  );
  graph.on('tap', 'node', (event) => {
    const href = event.target.data('href');
    if (typeof href === 'string' && href.startsWith('/blog/')) void navigate(href);
  });
  if (capability() !== 'reduced-motion')
    host.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450 });
  const resize = new ResizeObserver(() => graph.resize().fit(undefined, 24));
  resize.observe(host);
  signal.addEventListener(
    'abort',
    () => {
      resize.disconnect();
      graph.destroy();
    },
    { once: true },
  );
}
