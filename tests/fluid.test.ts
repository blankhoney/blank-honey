import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Source-level contracts for the io724 effect, read from the module text: the upstream config it
 * sends, the one opening burst, the resume path and the teardown. Nothing here compiles a shader or
 * draws a dye - the rendered fluid belongs to the browser verification step, and these checks do not
 * stand in for it.
 */

const projectPath = (relative: string) => new URL(`../${relative}`, import.meta.url);
const effectSource = readFileSync(projectPath('src/client/effects/io724.ts'), 'utf8');
/** Comments removed, so a word in prose is never read as code. */
const effectCode = effectSource.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

test('the effect opens on the upstream multi-colour defaults, with no palette of its own', () => {
  // The three inks and the four seeds were a local invention; the effect must not carry them back.
  assert.equal(effectSource.match(/export /g)?.length, 1, 'only the default export remains');
  assert.doesNotMatch(effectSource, /FLUID_PALETTE|FLUID_SEEDS|seedFluid/);
  // Upstream's own colour behaviour is what paints the ink: it is never pinned here, so the empty
  // palette (colorful), the colour update speed and the brightness all stay at the library default.
  assert.doesNotMatch(effectCode, /colorPalette/);
  assert.doesNotMatch(effectCode, /colorUpdateSpeed/);
  assert.doesNotMatch(effectCode, /colorful/);
  assert.doesNotMatch(effectCode, /brightness/);
  // No spot inks either: the only opening paint is the upstream burst below.
  assert.doesNotMatch(effectCode, /splatAtLocation/);
});

test('the config is exactly the restored interaction settings', () => {
  const numbers: [string, number][] = [
    ['densityDissipation', 1],
    ['velocityDissipation', 0.2],
    ['curl', 30],
    ['splatRadius', 0.25],
    ['splatForce', 6000],
  ];
  for (const [key, value] of numbers) {
    // The value must end at the entry: `\b` would let a `0` target match a `0.2` entry.
    assert.match(effectCode, new RegExp(`\\b${key}:\\s*${value}(?=\\s*[,}])`), key);
  }
  assert.match(effectCode, /simResolution: light \? 64 : 128/);
  assert.match(effectCode, /dyeResolution: light \? 256 : 512/);
  assert.match(effectCode, /backgroundColor: '#000000'/);
  assert.match(effectCode, /hover: true/);
  // Both effects follow the budget flag again: no separate low-intensity bloom override.
  assert.match(effectCode, /bloom: !light/);
  assert.match(effectCode, /sunrays: !light/);
  assert.doesNotMatch(effectCode, /bloomIntensity|bloomThreshold|bloomSoftKnee/);
});

test('the opening is one upstream burst of seven splats, and a resume never replays it', () => {
  assert.match(effectCode, /fluid\.start\(\);\s*fluid\.multipleSplats\(7\);/);
  assert.equal(effectCode.match(/multipleSplats/g)?.length, 1, 'exactly one burst exists');
  // Two starts: the first mount and a resume. The burst sits with the first, not the resume.
  assert.equal(effectCode.match(/fluid\.start\(\)/g)?.length, 2, 'init and resume are the starts');
  assert.match(effectCode, /if \(document\.hidden\) fluid\.stop\(\);\s*else fluid\.start\(\)/);
  const burst = effectCode.indexOf('multipleSplats');
  const handler = effectCode.indexOf("'visibilitychange'");
  assert.ok(burst >= 0 && handler > burst, 'the burst runs before the resume handler exists');
});

test('the effect keeps its lazy start, hidden-tab guard and cleaned-up teardown', () => {
  // Reduced motion returns before the GPU module is ever requested.
  const reduced = effectCode.indexOf('if (reduced) return');
  const dynamic = effectCode.indexOf('await import(');
  assert.ok(reduced >= 0 && dynamic >= 0 && reduced < dynamic);
  assert.match(
    effectCode,
    /\{\s*default:\s*Fluid\s*\}\s*=\s*await import\('webgl-fluid-enhanced'\)/,
  );
  assert.match(effectCode, /stage\.style\.position = 'absolute'/);
  // A lazy import that lands while the tab is hidden parks the loop at once.
  assert.match(
    effectCode,
    /multipleSplats\(7\);\s*[\s\S]*?if \(document\.hidden\) fluid\.stop\(\)/,
  );
  // Nothing here owns a clock of its own.
  assert.doesNotMatch(effectCode, /setInterval|setTimeout|requestAnimationFrame/);
  // Teardown: an abort stops the fluid and releases its context, and the listener is signal-scoped.
  assert.match(effectCode, /addEventListener\(\s*'abort'/);
  assert.match(effectCode, /fluid\.stop\(\)/);
  assert.match(effectCode, /WEBGL_lose_context/);
  assert.match(effectCode, /'visibilitychange'/);
  assert.match(effectCode, /\{ signal \}/);
});
