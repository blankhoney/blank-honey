import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getRandomFn,
  setRandom,
  tsParticles,
  type Container,
  type IShapeDrawer,
} from '@tsparticles/engine';
import {
  binaryRainOptions,
  createBinaryDrawer,
  loadBinaryRain,
} from '../src/client/effects/binary-rain';

type DrawData = Parameters<IShapeDrawer['draw']>[0];
type ParticleStub = { shapeData?: { interval: number | { min: number; max: number } } };

function canvas() {
  const fills: [string, number, number][] = [];
  const strokes: [string, number, number][] = [];
  return {
    fills,
    strokes,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillText: (text: string, x: number, y: number) => fills.push([text, x, y]),
    strokeText: (text: string, x: number, y: number) => strokes.push([text, x, y]),
  };
}

function draw(
  drawer: IShapeDrawer,
  context: ReturnType<typeof canvas>,
  particle: ParticleStub,
  elapsed: number,
  fill = true,
  stroke = true,
  radius = 9,
) {
  drawer.draw({
    context,
    particle,
    delta: { value: elapsed },
    fill,
    stroke,
    radius,
  } as unknown as DrawData);
}

test('public binary drawing emits only 0 and 1 through repeated 80/240ms frames', (t) => {
  const originalRandom = getRandomFn();
  let randomIndex = 0;
  setRandom(() => [0.1, 0.5, 0.9, 0.5][randomIndex++ % 4]!);
  t.after(() => setRandom(originalRandom));
  const drawer = createBinaryDrawer();
  const context = canvas();
  const particle = { shapeData: { interval: { min: 80, max: 240 } } };
  for (let frame = 0; frame < 200; frame++) draw(drawer, context, particle, frame % 2 ? 240 : 80);
  assert.equal(context.fills.length, 200);
  assert.deepEqual(context.strokes, context.fills);
  assert.deepEqual(new Set(context.fills.map(([text]) => text)), new Set(['0', '1']));
  assert.ok(context.fills.every(([text, x, y]) => /^[01]$/.test(text) && x === 0 && y === 0));
});

test('a particle keeps its character until its interval and does not share another particle state', (t) => {
  const originalRandom = getRandomFn();
  let randomIndex = 0;
  setRandom(() => [0.1, 0.5, 0.9, 0.5][randomIndex++ % 4]!);
  t.after(() => setRandom(originalRandom));
  const drawer = createBinaryDrawer();
  const context = canvas();
  const particle = { shapeData: { interval: 240 } };
  for (const elapsed of [80, 80, 79]) draw(drawer, context, particle, elapsed);
  assert.deepEqual(
    context.fills.map(([text]) => text),
    ['0', '0', '0'],
  );
  draw(drawer, context, particle, 1);
  assert.equal(context.fills.at(-1)![0], '1', 'the exact interval permits a new character');
  draw(drawer, context, { shapeData: { interval: 240 } }, 10);
  assert.equal(context.fills.at(-1)![0], '0', 'a new particle has its own character');
  draw(drawer, context, particle, 10);
  assert.equal(
    context.fills.at(-1)![0],
    '1',
    'drawing another particle did not replace the first state',
  );
});

test('binary text uses VT323, centered alignment and independent fill/stroke switches', () => {
  const drawer = createBinaryDrawer();
  const particle = { shapeData: { interval: 240 } };
  for (const [fill, stroke] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ]) {
    const context = canvas();
    draw(drawer, context, particle, 1, fill, stroke, 7.4);
    assert.equal(context.font, '15px "VT323", monospace');
    assert.equal(context.textAlign, 'center');
    assert.equal(context.textBaseline, 'middle');
    assert.equal(context.fills.length, Number(fill));
    assert.equal(context.strokes.length, Number(stroke));
    assert.ok([...context.fills, ...context.strokes].every(([text]) => /^[01]$/.test(text)));
  }
});

test('binary options impose full/light budgets, straight downward motion and scene-owned colors', () => {
  for (const light of [false, true]) {
    const background = light ? '#101721' : 'rgb(8, 14, 20)';
    const options = binaryRainOptions(light, 1280, 900, background);
    const particles = options.particles!;
    assert.equal(options.preset, 'matrix');
    assert.equal(options.fpsLimit, light ? 15 : 24);
    assert.equal(options.detectRetina, false);
    assert.equal(options.pauseOnBlur, false);
    assert.equal(options.pauseOnOutsideViewport, false);
    assert.deepEqual(options.background, { color: background });
    assert.deepEqual(options.trail, {
      enable: true,
      length: light ? 12 : 20,
      fill: { color: background },
    });
    assert.deepEqual(particles.number, { value: light ? 64 : 136, density: { enable: false } });
    assert.deepEqual(particles.shape, {
      type: 'binary-rain',
      options: { 'binary-rain': { interval: { min: 80, max: 240 } } },
    });
    assert.equal(particles.move!.enable, true);
    assert.equal(particles.move!.direction, 'bottom');
    assert.equal(particles.move!.straight, true);
    assert.deepEqual(particles.move!.outModes, { default: 'out' });
    assert.deepEqual(particles.links, { enable: false });
    assert.equal(
      binaryRainOptions(light, 100_000, 100_000, background).particles!.number!.value,
      light ? 72 : 180,
    );
  }
});

test('small or non-positive areas retain the minimum 24 characters without density scaling', () => {
  for (const light of [false, true]) {
    for (const [width, height] of [
      [1, 1],
      [0, 900],
      [1280, 0],
      [-20, 900],
      [1280, -20],
    ]) {
      assert.deepEqual(binaryRainOptions(light, width!, height!, '#000').particles!.number, {
        value: 24,
        density: { enable: false },
      });
    }
  }
});

test('real concurrent loading shares a promise and exposes the same public binary drawer', async () => {
  const first = loadBinaryRain();
  const concurrent = loadBinaryRain();
  assert.equal(concurrent, first);
  await Promise.all([first, concurrent]);
  // Plugin registration is queued by the real engine until its public initialization step.
  await tsParticles.pluginManager.init();
  const container = {} as Container;
  try {
    const drawers = await tsParticles.pluginManager.getShapeDrawers(container);
    const drawer = drawers.get('binary-rain');
    assert.ok(drawer);
    assert.ok(drawers.has('matrix'), 'the real Matrix preset registered its own shape too');
    assert.ok(tsParticles.pluginManager.getPreset('matrix'));
    assert.equal(loadBinaryRain(), first, 'completed loading remains cached');
    const again = await tsParticles.pluginManager.getShapeDrawers(container);
    assert.equal(again.get('binary-rain'), drawer);
    const context = canvas();
    draw(drawer, context, { shapeData: { interval: 80 } }, 80);
    assert.match(context.fills[0]![0], /^[01]$/);
  } finally {
    tsParticles.pluginManager.clearPlugins(container);
  }
});
