import test from 'node:test';
import assert from 'node:assert/strict';
import { foldAt } from '../src/client/transitions';
import { tsParticles, type Container, type Particle } from '@tsparticles/engine';
import { cloud, pointAt, morphUpdater, sample, type Point } from '../src/client/particle-morph';

const from: Point = { key: 'title', x: 80, y: 120, color: '#fff' };
const to: Point = { key: 'title', x: 240, y: 180, color: '#fff' };
test('Particle paths preserve endpoints and allow straight semantic migration', () => {
  assert.deepEqual(pointAt(from, to, 0, 45), { x: 80, y: 120 });
  assert.deepEqual(pointAt(from, to, 1, 45), { x: 240, y: 180 });
  assert.deepEqual(pointAt(from, from, 0.5, 0), { x: from.x, y: from.y });
  assert.deepEqual(pointAt(from, to, 2, 45), pointAt(from, to, 1, 45));
});
test('Public updater moves actual particles independently and releases destroyed particles', async (t) => {
  const created: Particle[] = [];
  const engine = {
    canvas: { size: { width: 2000, height: 1200 } },
    particles: {
      addParticle(position: { x: number; y: number }) {
        const particle = { position: { ...position } } as Particle;
        created.push(particle);
        return particle;
      },
    },
    draw() {},
    destroy() {},
  } as unknown as Container;
  t.mock.method(tsParticles, 'load', async () => engine);
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'innerWidth');
  const savedHeight = Object.getOwnPropertyDescriptor(globalThis, 'innerHeight');
  Object.defineProperty(globalThis, 'innerHeight', { value: 600, configurable: true });
  Object.defineProperty(globalThis, 'innerWidth', { value: 1000, configurable: true });
  try {
    await cloud(
      { id: 'test-cloud', isConnected: true } as HTMLElement,
      [from],
      [to, { ...to, x: 400 }],
      1000,
      false,
      false,
    );
    assert.equal(created.length, 2);
    assert.equal(created[0].position.x, 160, 'CSS coordinates scale to the engine canvas');
    for (const particle of created) morphUpdater.update(particle, { value: 450, factor: 27 });
    assert.notEqual(created[0].position.x, created[1].position.x, 'not a whole-layer translation');
    for (const particle of created) morphUpdater.update(particle, { value: 1000, factor: 60 });
    assert.ok(Math.abs(created[0].position.x - 480) < 0.001);
    assert.ok(Math.abs(created[1].position.x - 800) < 0.001);
    morphUpdater.particleDestroyed?.(created[0]);
    assert.equal(morphUpdater.isEnabled(created[0]), false);
    const unrelated = { position: { x: 7, y: 9 } } as Particle;
    morphUpdater.update(unrelated, { value: 16, factor: 1 });
    assert.deepEqual(unrelated.position, { x: 7, y: 9 });
  } finally {
    if (savedHeight) Object.defineProperty(globalThis, 'innerHeight', savedHeight);
    else Reflect.deleteProperty(globalThis, 'innerHeight');
    if (saved) Object.defineProperty(globalThis, 'innerWidth', saved);
    else Reflect.deleteProperty(globalThis, 'innerWidth');
  }
});

test('Destination sampling excludes the outgoing page ghost', () => {
  const frame = (left: number) => ({
    dataset: { cohort: 'frame' },
    matches: () => false,
    getBoundingClientRect: () => ({
      left,
      right: left + 120,
      top: 30,
      bottom: 110,
      width: 120,
      height: 80,
    }),
  });
  const target = frame(50),
    ghost = frame(800);
  const globals = {
    document: {
      documentElement: { dataset: { family: 'terminal' } },
      querySelector: () => ({ querySelectorAll: () => [target] }),
      querySelectorAll: () => [target, ghost],
    },
    innerWidth: 1200,
    innerHeight: 800,
    getComputedStyle: () => ({ color: '#fff' }),
  };
  const saved = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  try {
    for (const [key, value] of Object.entries(globals))
      Object.defineProperty(globalThis, key, { value, configurable: true });
    const points = sample(false);
    assert.ok(points.length > 0);
    assert.ok(points.every((point) => point.x >= 50 && point.x <= 170));
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('Paper segments remain connected throughout the fold', () => {
  assert.ok(
    Math.abs(foldAt(36, 1440, 0.5).at(-1)!.angle) > 50,
    'the edge curls, rather than turning as a rigid card',
  );
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const segments = foldAt(12, 1440, t);
    for (let i = 0; i < segments.length - 1; i++) {
      const edge = segments[i],
        next = segments[i + 1];
      assert.ok(Math.abs(edge.x + Math.cos((edge.angle * Math.PI) / 180) * 120 - next.x) < 0.001);
      assert.ok(Math.abs(edge.z - Math.sin((edge.angle * Math.PI) / 180) * 120 - next.z) < 0.001);
    }
  }
});
