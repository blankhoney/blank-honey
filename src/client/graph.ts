import type { BoundingBox12, ElementDefinition } from 'cytoscape';
import { capability } from './preferences';

export function outsideViewport(box: BoundingBox12, width: number, height: number) {
  return box.x2 < 0 || box.y2 < 0 || box.x1 > width || box.y1 > height;
}

export async function mountGraph(signal: AbortSignal) {
  const elements: ElementDefinition[] = JSON.parse(
    document.querySelector('#graph-data')!.textContent!,
  );
  if (!elements.length || signal.aborted) return;
  const { default: cytoscape } = await import('cytoscape');
  if (signal.aborted) return;
  const host = document.querySelector<HTMLElement>('#graph')!;
  const colors = () => getComputedStyle(host);
  const padding = () => (host.clientWidth < 500 ? 14 : 48);
  const graph = cytoscape({
    container: host,
    elements,
    layout: { name: 'circle', padding: padding(), animate: false },
    minZoom: 0.15,
    maxZoom: 2,
    style: [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          'background-color': 'data(color)',
          color: colors().getPropertyValue('--fg').trim(),
          'font-size': 19,
          'line-height': 1.4,
          'font-family': 'monospace',
          'text-wrap': 'wrap',
          'text-max-width': host.clientWidth < 500 ? '120px' : '160px',
          'text-valign': 'bottom',
          'text-margin-y': 14,
          'text-background-color': colors().getPropertyValue('--bg').trim(),
          'text-background-opacity': 0.8,
          'text-background-padding': '4px',
          'border-width': 3,
          'border-color': 'data(color)',
          'border-opacity': 0.25,
          'underlay-color': 'data(color)',
          'underlay-opacity': 0.12,
          'underlay-padding': 10,
          'transition-property': 'underlay-opacity, underlay-padding',
          'transition-duration': capability() === 'reduced-motion' ? 0 : 220,
          width: 18,
          height: 18,
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1.5,
          'line-color': '#829baf',
          'curve-style': 'bezier',
          opacity: 0.45,
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#829baf',
          'arrow-scale': 0.7,
        },
      },
      { selector: '.focused', style: { 'underlay-opacity': 0.3, 'underlay-padding': 17 } },
      { selector: '.filtered', style: { display: 'none' } },
    ],
  });

  let recovery: ReturnType<typeof setTimeout> | undefined;
  let interacting = false;
  let fitting = false;
  const cancelRecovery = () => clearTimeout(recovery);
  function fit(animate = true) {
    cancelRecovery();
    const nodes = graph.nodes(':visible');
    if (!nodes.length) return;
    fitting = true;
    graph.stop();
    if (!animate || capability() === 'reduced-motion') {
      graph.fit(nodes, padding());
      fitting = false;
      return;
    }
    graph.animate(
      { fit: { eles: nodes, padding: padding() } },
      {
        duration: 650,
        easing: 'ease-in-out-cubic',
        complete: () => {
          fitting = false;
        },
      },
    );
  }
  function scheduleRecovery() {
    cancelRecovery();
    if (interacting || fitting) return;
    const nodes = graph.nodes(':visible');
    if (
      !nodes.length ||
      nodes.some(
        (node) =>
          !outsideViewport(
            node.renderedBoundingBox({ includeLabels: false }),
            graph.width(),
            graph.height(),
          ),
      )
    )
      return;
    // Only the empty viewport rule is custom; Cytoscape owns fitting and animation.
    recovery = setTimeout(() => {
      if (!signal.aborted && !interacting) fit();
    }, 1500);
  }
  function beginInteraction() {
    interacting = true;
    cancelRecovery();
    graph.stop();
    fitting = false;
  }
  function endInteraction() {
    interacting = false;
    scheduleRecovery();
  }
  host.addEventListener('pointerdown', beginInteraction, { signal });
  document.addEventListener('pointerup', endInteraction, { signal });
  document.addEventListener('pointercancel', endInteraction, { signal });
  host.addEventListener(
    'wheel',
    () => {
      cancelRecovery();
      graph.stop();
      fitting = false;
      scheduleRecovery();
    },
    { signal, passive: true },
  );
  graph.on('pan zoom position', scheduleRecovery);
  graph.on('mouseover', 'node', (event) => {
    event.target.addClass('focused');
    host.style.cursor = 'pointer';
  });
  graph.on('mouseout', 'node', (event) => {
    event.target.removeClass('focused');
    host.style.cursor = '';
  });
  graph.on('tap', 'node', async (event) => {
    const href = event.target.data('href');
    if (typeof href === 'string' && href.startsWith('/blog/')) {
      const { navigate } = await import('astro:transitions/client');
      if (!signal.aborted) void navigate(href);
    }
  });
  document.querySelector('#graph-center')?.addEventListener('click', () => fit(), { signal });
  document.querySelector<HTMLSelectElement>('#graph-category')?.addEventListener(
    'change',
    (event) => {
      const category = (event.target as HTMLSelectElement).value;
      graph.batch(() => {
        graph.nodes().forEach((node) => {
          node.toggleClass('filtered', !!category && node.data('category') !== category);
        });
        graph.edges().forEach((edge) => {
          edge.toggleClass(
            'filtered',
            edge.source().hasClass('filtered') || edge.target().hasClass('filtered'),
          );
        });
      });
      document.querySelectorAll<HTMLElement>('[data-relation-categories]').forEach((row) => {
        row.hidden =
          !!category &&
          !row.dataset.relationCategories!.split(' ').every((value) => value === category);
      });
      fit();
    },
    { signal },
  );
  document.addEventListener(
    'bh:theme',
    () => {
      graph
        .style()
        .selector('node')
        .style({
          color: colors().getPropertyValue('--fg').trim(),
          'text-background-color': colors().getPropertyValue('--bg').trim(),
        })
        .update();
    },
    { signal },
  );
  if (capability() !== 'reduced-motion') {
    host.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 700 },
    );
  }
  const resize = new ResizeObserver(() => {
    graph.resize();
    graph
      .style()
      .selector('node')
      .style({ 'text-max-width': host.clientWidth < 500 ? '120px' : '160px' })
      .update();
    fit(false);
  });
  resize.observe(host);
  signal.addEventListener(
    'abort',
    () => {
      cancelRecovery();
      resize.disconnect();
      graph.destroy();
    },
    { once: true },
  );
}
