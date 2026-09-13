import {
  tsParticles,
  type Particle,
  type Container,
  type IParticleUpdater,
} from '@tsparticles/engine';
import { particles, seed } from './particles';

export type Point = { key: string; x: number; y: number; color: string };
type Flight = {
  from: Point;
  to: Point;
  elapsed: number;
  duration: number;
  bend: number;
  ratio: number;
};
const flights = new WeakMap<Particle, Flight>();
export function pointAt(from: Point, to: Point, progress: number, bend: number) {
  const t = Math.max(0, Math.min(1, progress));
  const ease = t * t * (3 - 2 * t),
    arc = Math.sin(Math.PI * t);
  return {
    x: from.x + (to.x - from.x) * ease + arc * bend,
    y: from.y + (to.y - from.y) * ease + arc * bend * Math.sin(bend),
  };
}
// Public updater extension: the engine owns rendering, timing and particle lifetime.
export const morphUpdater: IParticleUpdater = {
  init() {},
  isEnabled: (particle) => flights.has(particle),
  update(particle, delta) {
    const flight = flights.get(particle);
    if (!flight) return;
    flight.elapsed += delta.value;
    const point = pointAt(flight.from, flight.to, flight.elapsed / flight.duration, flight.bend);
    particle.position.x = Math.max(2, Math.min(innerWidth - 2, point.x)) * flight.ratio;
    particle.position.y = Math.max(2, Math.min(innerHeight - 2, point.y)) * flight.ratio;
  },
  particleDestroyed: (particle) => {
    flights.delete(particle);
  },
};
tsParticles.pluginManager.addParticleUpdater('page-morph', async () => morphUpdater);

/** Sample visible text and borders only; no screenshot renderer or private engine state. */
export function sample(light: boolean): Point[] {
  const terminal = document.documentElement.dataset.family === 'terminal';
  const elements = [
    ...document
      .querySelector('#main')!
      .querySelectorAll<HTMLElement>(
        terminal
          ? '[data-cohort], .terminal h2, .terminal h3, .terminal-head p, .terminal-head small, .metric-value, .metric-label, .probe-metric dt, .probe-state, .probe-card, .metric-bar, .metric-bar > span, .state'
          : 'h1, .journal-mast, .section-kicker, .article-byline',
      ),
  ];
  const result: Point[] = [];
  for (const [index, el] of elements.entries()) {
    const r = el.getBoundingClientRect(),
      style = getComputedStyle(el);
    if (r.bottom < 0 || r.top > innerHeight || r.width < 1 || r.height < 1) continue;
    const text = el.matches('h1,h2,h3,p,small,dt,.metric-value,.metric-label,.state,.probe-state');
    const key =
      el.dataset.cohort || (el.matches('h1') ? 'title' : `${text ? 'number' : 'rule'}-${index}`);
    const group: Point[] = [];
    const add = (x: number, y: number) => {
      if (x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight)
        group.push({
          key,
          x,
          y,
          color: el.matches('.metric-bar > span') ? style.backgroundColor : style.color,
        });
    };
    if (text) {
      const mask = document.createElement('canvas');
      mask.width = Math.ceil(r.width);
      mask.height = Math.ceil(r.height);
      const context = mask.getContext('2d');
      if (!context) continue;
      context.fillStyle = '#fff';
      // Range rects preserve actual line wrapping and nested font sizes.
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parentStyle = getComputedStyle(node.parentElement!);
        context.font = parentStyle.font;
        context.textBaseline = 'alphabetic';
        for (let i = 0; i < (node.textContent?.length || 0); i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const box = range.getBoundingClientRect();
          const glyph = node.textContent![i],
            metrics = context.measureText(glyph);
          const ascent = metrics.fontBoundingBoxAscent || parseFloat(parentStyle.fontSize) * 0.8;
          const descent = metrics.fontBoundingBoxDescent || parseFloat(parentStyle.fontSize) * 0.2;
          context.fillText(
            glyph,
            box.left - r.left,
            box.top - r.top + (box.height - ascent - descent) / 2 + ascent,
          );
        }
      }
      const data = context.getImageData(0, 0, mask.width, mask.height).data;
      const step = light ? 4 : 3;
      for (let y = 0; y < mask.height; y += step)
        for (let x = 0; x < mask.width; x += step)
          if (data[(y * mask.width + x) * 4 + 3] > 80) add(r.left + x, r.top + y);
    } else {
      const step = light ? 9 : 6;
      for (let x = r.left; x < r.right; x += step) {
        add(x, r.top);
        if (r.height > 10) add(x, r.bottom);
      }
      if (el.dataset.cohort === 'frame')
        for (let y = r.top; y < r.bottom; y += step) {
          add(r.left, y);
          add(r.right, y);
        }
    }
    const cap = text ? (light ? 360 : 800) : light ? 120 : 260;
    result.push(...group.filter((_, i) => i % Math.max(1, Math.ceil(group.length / cap)) === 0));
  }
  const cap = light ? 1500 : 3200;
  return result.filter((_, i) => i % Math.max(1, Math.ceil(result.length / cap)) === 0);
}

export async function cloud(
  layer: HTMLElement,
  from: Point[],
  to: Point[],
  duration: number,
  entry: boolean,
  light: boolean,
): Promise<Container | undefined> {
  const engine = await particles(layer.id, {
    fpsLimit: light ? 30 : 60,
    particles: {
      number: { value: 0 },
      size: { value: light ? 1.15 : 1 },
      move: { enable: false },
      opacity: { value: 0.9 },
    },
  });
  if (!engine || !layer.isConnected) {
    engine?.destroy();
    return;
  }
  const ratio = engine.canvas.size.width / innerWidth;
  const groups = new Map<string, Point[]>();
  for (const point of from) {
    const group = groups.get(point.key) || [];
    group.push(point);
    groups.set(point.key, group);
  }
  const counters = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const target of to) totals.set(target.key, (totals.get(target.key) || 0) + 1);
  for (const [i, target] of to.entries()) {
    const sourceGroup = groups.get(target.key);
    const n = counters.get(target.key) || 0;
    counters.set(target.key, n + 1);
    const fallback = { ...target, x: target.x + (seed(i) - 0.5) * 70, y: target.y - 35 };
    let source =
      sourceGroup?.[Math.floor((n * sourceGroup.length) / totals.get(target.key)!)] || fallback;
    if (entry)
      source = {
        ...target,
        x: i % 4 === 0 ? 2 : i % 4 === 1 ? innerWidth - 2 : seed(i) * innerWidth,
        y: i % 4 === 2 ? 2 : i % 4 === 3 ? innerHeight - 2 : seed(i + 19) * innerHeight,
      };
    if (!duration) source = target;
    const particle = engine.particles.addParticle(
      { x: source.x * ratio, y: source.y * ratio },
      {
        paint: { color: { value: target.color } },
      },
    );
    if (particle && duration)
      flights.set(particle, {
        from: source,
        to: target,
        elapsed: 0,
        duration: duration * (0.82 + seed(i + 7) * 0.18),
        // Existing surfaces migrate directly; identical anchors stay in place.
        bend: entry
          ? (seed(i + 29) - 0.5) * 140
          : Math.min(40, Math.hypot(target.x - source.x, target.y - source.y) * 0.08),
        ratio,
      });
  }
  engine.draw(true);
  return engine;
}
