import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { FLUID_PALETTE, FLUID_SEEDS, seedFluid } from '../src/client/effects/io724';

/**
 * CPU-side checks of the io724 opening inks and of the effect's shape. Upstream's GL work is not
 * exercised here: the splats and the config calls are recorded through a fake that matches the
 * public signatures, and the rendered fluid belongs to the browser verification step.
 */

const projectPath = (relative: string) => new URL(`../${relative}`, import.meta.url);
const readText = (relative: string) => readFileSync(projectPath(relative), 'utf8');

/** The effect source, read as text: the contract checks below are about what it does, not draws. */
const effectSource = readText('src/client/effects/io724.ts');
/** Comments removed, so a word in prose is never read as code. */
const effectCode = effectSource.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

/** The pinned look: the interaction value, and the brighter one the seeds borrow. */
const BRIGHTNESS = 0.3;
const SEED_BRIGHTNESS = 0.45;
const SPLAT_RADIUS = 0.2;
const SEED_SPLAT_RADIUS = 0.5;

type CanvasBox = { width: number; clientHeight: number };
type FluidConfig = { colorPalette?: string[]; brightness?: number; splatRadius?: number };
type Splat = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** How many arguments the call carried, so a stray trailing colour is visible. */
  argc: number;
  /** The settings in force when this splat went out. */
  color: string | undefined;
  brightness: number | undefined;
  splatRadius: number | undefined;
};
type Trace = { splats: Splat[]; configs: FluidConfig[]; error: unknown };

/**
 * Runs seedFluid against a recorder that keeps the live settings, so each splat can be checked
 * against what was configured before it. `throwAt` makes that splat call fail, so the restore path
 * can be checked without a simulation; the error is captured rather than propagated.
 */
function trace(canvas: CanvasBox, throwAt = 0): Trace {
  const splats: Splat[] = [];
  const configs: FluidConfig[] = [];
  let palette: string[] | undefined;
  let brightness: number | undefined;
  let splatRadius: number | undefined;
  const fluid = {
    setConfig(config: FluidConfig) {
      // Record the payload as sent: no invented keys, so a partial config stays partial.
      configs.push({
        ...config,
        ...(config.colorPalette && { colorPalette: [...config.colorPalette] }),
      });
      if (config.colorPalette !== undefined) palette = [...config.colorPalette];
      if (config.brightness !== undefined) brightness = config.brightness;
      if (config.splatRadius !== undefined) splatRadius = config.splatRadius;
    },
    splatAtLocation(x: number, y: number, dx: number, dy: number) {
      splats.push({
        x,
        y,
        dx,
        dy,
        argc: arguments.length,
        color: palette?.[0],
        brightness,
        splatRadius,
      });
      if (splats.length === throwAt) throw new Error('splat failed');
    },
  };
  let error: unknown;
  try {
    seedFluid(fluid, canvas);
  } catch (thrown) {
    error = thrown;
  }
  return { splats, configs, error };
}

/** The 0.8.0 `HEXtoHSV`: the 0..255 bytes scaled to 0..1, read back as hue and saturation. */
function upstreamHueSaturation(hex: string): { h: number; s: number } {
  const bytes = [0, 2, 4].map(
    (offset) => Number.parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255,
  );
  const [r, g, b] = bytes;
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  const span = high - low;
  let hue = 0;
  if (span !== 0) {
    if (high === r) hue = ((g - b) / span + 6) % 6;
    else if (high === g) hue = (b - r) / span + 2;
    else hue = (r - g) / span + 4;
  }
  return { h: hue / 6, s: high === 0 ? 0 : span / high };
}

/** The 0.8.0 `HSVtoRGB`, with V taken from the configured brightness. */
function upstreamRgb(h: number, s: number, v: number): [number, number, number] {
  const sector = Math.floor(h * 6);
  const fraction = h * 6 - sector;
  const p = v * (1 - s);
  const q = v * (1 - fraction * s);
  const t = v * (1 - (1 - fraction) * s);
  const table: [number, number, number][] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ];
  return table[sector % 6];
}

/** The 0.8.0 `generateColor` dye: hue and saturation from the palette entry, V from brightness. */
function upstreamDye(hex: string, brightness: number): number[] {
  const { h, s } = upstreamHueSaturation(hex);
  return upstreamRgb(h, s, brightness).map((channel) => channel * 0.15);
}

/** The largest dye channel a palette reaches at that brightness, as splatAtLocation writes it. */
function peakDye(brightness: number): number {
  return Math.max(...FLUID_PALETTE.flatMap((color) => upstreamDye(color, brightness))) * 10;
}

/** The largest dye channel a pointer writes at that brightness: its colour, with no x10. */
function peakPointerDye(brightness: number): number {
  return Math.max(...FLUID_PALETTE.flatMap((color) => upstreamDye(color, brightness)));
}

/** The 0.8.0 `HEXtoRGB`: raw 0..255 bytes, with no scaling at all. */
function upstreamBytes(hex: string): number[] {
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(1 + offset, 3 + offset), 16));
}

/** The 0.8.0 mapping: x over the drawing buffer, y over the css height, then flipped. */
function upstreamPoint(splat: Splat, canvas: CanvasBox): [number, number] {
  return [splat.x / canvas.width, 1 - splat.y / canvas.clientHeight];
}

test('the opening paints the four inks once, in their seeded order', () => {
  const canvas = { width: 1000, clientHeight: 600 };
  const { splats, configs, error } = trace(canvas);
  assert.equal(error, undefined);
  assert.equal(splats.length, 4);
  assert.equal(splats.length, FLUID_SEEDS.length);
  for (const [index, seed] of FLUID_SEEDS.entries()) {
    const splat = splats[index];
    assert.equal(splat.x, seed.x * canvas.width, `splat ${index} x`);
    assert.equal(splat.y, seed.y * canvas.clientHeight, `splat ${index} y`);
    assert.equal(splat.dx, seed.dx, `splat ${index} dx`);
    assert.equal(splat.dy, seed.dy, `splat ${index} dy`);
    // The colour travels as the configured palette, never as the call's own HEX argument.
    assert.equal(splat.argc, 4, `splat ${index} passes exactly the four positional arguments`);
    assert.equal(splat.color, seed.color, `splat ${index} paints its own colour alone`);
    // The boosted settings are live for every seed, not just the first.
    assert.equal(splat.brightness, SEED_BRIGHTNESS, `splat ${index} brightness`);
    assert.equal(splat.splatRadius, SEED_SPLAT_RADIUS, `splat ${index} radius`);
  }
  // The boost, one colour per seed, then the restore: two more calls than there are seeds.
  assert.equal(configs.length, FLUID_SEEDS.length + 2);
  assert.deepEqual(configs[0], { brightness: SEED_BRIGHTNESS, splatRadius: SEED_SPLAT_RADIUS });
  for (const [index, seed] of FLUID_SEEDS.entries()) {
    assert.deepEqual(configs[index + 1], { colorPalette: [seed.color] }, `config ${index}`);
  }
  assert.deepEqual(configs.at(-1), {
    colorPalette: [...FLUID_PALETTE],
    brightness: BRIGHTNESS,
    splatRadius: SPLAT_RADIUS,
  });
  // The order is the array's, not the recorder's: two runs of the same box agree call for call.
  assert.deepEqual(trace(canvas).splats, splats);
});

test('a failed splat still restores the hero settings', () => {
  const { splats, configs, error } = trace({ width: 1000, clientHeight: 600 }, 3);
  // The failure leaves seedFluid, so a caller sees it, and the restore happens regardless.
  assert.ok(error instanceof Error);
  assert.equal(error.message, 'splat failed');
  assert.equal(splats.length, 3);
  // The boost, one colour for each attempted seed (the third fails after its config), the restore.
  assert.equal(configs.length, 5);
  assert.deepEqual(configs.at(-1), {
    colorPalette: [...FLUID_PALETTE],
    brightness: BRIGHTNESS,
    splatRadius: SPLAT_RADIUS,
  });
});

test('one screen ratio lands on one spot at every device pixel ratio', () => {
  // Same css box, four drawing buffers: DPR 1, 2, 3 and a fractional step.
  const boxes: CanvasBox[] = [
    { width: 1000, clientHeight: 600 },
    { width: 2000, clientHeight: 600 },
    { width: 3000, clientHeight: 600 },
    { width: 1500, clientHeight: 600 },
  ];
  const runs = boxes.map((box) => trace(box).splats);
  for (const [index, box] of boxes.entries()) {
    const run = runs[index];
    assert.equal(run.length, FLUID_SEEDS.length);
    for (const [seedIndex, seed] of FLUID_SEEDS.entries()) {
      const [x, y] = upstreamPoint(run[seedIndex], box);
      assert.ok(Math.abs(x - seed.x) < 1e-9, `splat ${seedIndex} x on a ${box.width} buffer`);
      assert.ok(Math.abs(y - (1 - seed.y)) < 1e-9, `splat ${seedIndex} y on a ${box.width} buffer`);
    }
  }
  // The compensation shows in the raw arguments: x follows the drawing buffer, y stays in css px.
  for (const [index] of FLUID_SEEDS.entries()) {
    const raw = runs.map((run) => run[index]);
    for (const scale of [2, 3]) {
      const scaled = raw[0].x * scale;
      assert.ok(Math.abs(raw[scale - 1].x - scaled) < 1e-9, `splat ${index} x at x${scale}`);
      assert.equal(raw[scale - 1].y, raw[0].y, `splat ${index} y ignores the buffer`);
    }
  }
  // Nothing leaves the box, and nothing folds back through the flip, on any stage shape.
  const shapes: CanvasBox[] = [
    { width: 1440, clientHeight: 900 },
    { width: 2340, clientHeight: 1688 },
    { width: 390, clientHeight: 844 },
    { width: 585, clientHeight: 2532 },
  ];
  for (const box of shapes) {
    for (const splat of trace(box).splats) {
      assert.ok(splat.x >= 0 && splat.x <= box.width, `x inside a ${box.width} buffer`);
      assert.ok(splat.y >= 0 && splat.y <= box.clientHeight, `y inside a ${box.width} box`);
      const [x, y] = upstreamPoint(splat, box);
      assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `point inside the ${box.width} clip`);
    }
  }
});

test('the inks ride the upstream brightness path, not the raw HEX argument', () => {
  // A one-colour palette is what makes upstream rebuild the dye: hue and saturation from the
  // palette entry, V from the brightness in force, then x0.15 and splatAtLocation's own x10.
  // Each number below bounds a single write, not the frame: writes accumulate in the dye, advection
  // and the display pass move the value on, and the pressure pass only reworks the velocity field,
  // so it does not set the dye's brightness directly.
  const seedPeak = peakDye(SEED_BRIGHTNESS);
  assert.ok(Math.abs(seedPeak - 0.675) < 1e-9, `a seed peaks at ${seedPeak}`);
  assert.ok(seedPeak <= 1, 'a seed stays inside 0..1');
  // The pointer does not go through splatAtLocation: splatPointer passes its own colour straight to
  // splat, so a pointer stroke reaches 0.3 x 0.15, a tenth of the seeded ink.
  const pointerPeak = peakPointerDye(BRIGHTNESS);
  assert.ok(Math.abs(pointerPeak - 0.045) < 1e-9, `a pointer stroke peaks at ${pointerPeak}`);
  assert.ok(pointerPeak < seedPeak, 'the seeds are the brighter of the two');
  // What the public splat API would write with the restored brightness, once the seeds are done.
  const restoredApiPeak = peakDye(BRIGHTNESS);
  assert.ok(
    Math.abs(restoredApiPeak - 0.45) < 1e-9,
    `the restored API peaks at ${restoredApiPeak}`,
  );
  assert.ok(restoredApiPeak < seedPeak, 'the borrowed brightness really is the brighter one');
  for (const brightness of [BRIGHTNESS, SEED_BRIGHTNESS]) {
    for (const color of FLUID_PALETTE) {
      for (const channel of upstreamDye(color, brightness)) {
        assert.ok(channel >= 0 && channel <= 1, `${color} at ${brightness} channel ${channel}`);
      }
    }
  }
  // The argument path this replaced is not bounded at all: raw bytes x10, far past a 0..1 dye.
  for (const color of FLUID_PALETTE) {
    assert.ok(
      Math.max(...upstreamBytes(color)) * 10 > 100,
      `${color} as a HEX argument would clip the dye`,
    );
  }
  // The seeds name the palette rather than repeating it, in the pinned rotation.
  assert.deepEqual(
    FLUID_SEEDS.map((seed) => seed.color),
    [FLUID_PALETTE[0], FLUID_PALETTE[1], FLUID_PALETTE[0], FLUID_PALETTE[1]],
  );
});

test('the effect keeps its lazy, cleaned-up lifecycle', () => {
  // The inks replace the upstream random burst: no burst, no timer, no own frame loop.
  assert.doesNotMatch(effectCode, /multipleSplats/);
  assert.doesNotMatch(effectCode, /setInterval|setTimeout/);
  assert.doesNotMatch(effectCode, /requestAnimationFrame/);
  // Reduced motion returns before the GPU module is ever requested.
  const reduced = effectCode.indexOf('if (reduced) return');
  const dynamic = effectCode.indexOf('await import(');
  assert.ok(reduced >= 0 && dynamic >= 0 && reduced < dynamic);
  // The module is still reached lazily, and the stage still takes its inline absolute box.
  assert.match(
    effectCode,
    /\{\s*default:\s*Fluid\s*\}\s*=\s*await import\('webgl-fluid-enhanced'\)/,
  );
  assert.match(effectCode, /stage\.style\.position = 'absolute'/);
  // One start, then one seed on the canvas the fluid owns.
  assert.match(effectCode, /fluid\.start\(\);\s*[\s\S]*?stage\.querySelector\('canvas'\)/);
  assert.match(effectCode, /stage\.querySelector\('canvas'\)[\s\S]*?seedFluid\(/);
  // Seeding is defined once and called once: a resume must never lay the inks down again.
  assert.equal(effectCode.match(/seedFluid\(/g)?.length, 2);
  assert.doesNotMatch(effectCode, /startWithInk/);
  // The resume only restarts the loop: the dye survives the hidden stop.
  assert.match(effectCode, /if \(document\.hidden\) fluid\.stop\(\);\s*else fluid\.start\(\)/);
  assert.equal(effectCode.match(/fluid\.start\(\)/g)?.length, 2, 'init and resume are the starts');
  // A tab that hides while the import is still pending is parked at once.
  assert.match(effectCode, /seedFluid\([\s\S]*?if \(document\.hidden\) fluid\.stop\(\)/);
  // Teardown stays: an abort stops the fluid and releases its context.
  assert.match(effectCode, /addEventListener\(\s*'abort'/);
  assert.match(effectCode, /fluid\.stop\(\)/);
  assert.match(effectCode, /WEBGL_lose_context/);
  assert.match(effectCode, /'visibilitychange'/);
  assert.match(effectCode, /\{ signal \}/);
});

test('the look is pinned to the frozen public config', () => {
  const numbers: [string, number][] = [
    ['densityDissipation', 0],
    ['velocityDissipation', 0.15],
    ['curl', 0],
    ['splatRadius', SPLAT_RADIUS],
    ['splatForce', 4200],
    ['colorUpdateSpeed', 0.15],
    ['brightness', BRIGHTNESS],
    ['bloomIntensity', 0.22],
    ['bloomThreshold', 0.8],
    ['bloomSoftKnee', 0.7],
  ];
  for (const [key, value] of numbers) {
    // The value must end at the entry: `\b` would let a `0` target match a `0.15` entry.
    assert.match(effectCode, new RegExp(`\\b${key}:\\s*${value}(?=\\s*[,}])`), key);
  }
  assert.match(effectCode, /simResolution: light \? 64 : 128/);
  assert.match(effectCode, /dyeResolution: light \? 256 : 512/);
  assert.match(effectCode, /bloom: !light/);
  assert.match(effectCode, /backgroundColor: '#000000'/);
  // The startup config spreads the same exported palette the seeds name.
  assert.match(effectCode, /colorPalette:\s*\[\.\.\.FLUID_PALETTE\]/);
  assert.match(effectCode, /hover: true/);
  assert.match(effectCode, /colorful: true/);
  assert.match(effectCode, /sunrays: false/);
});
