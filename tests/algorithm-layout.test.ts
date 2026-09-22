import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Layout contract for the five algorithm scenes appended to the showcase. It pins the
 * shared stage rules that keep the interface in front, proves the still fallback is a
 * pure-CSS composition without any image, and records the copy geometry. */
const scenes = ['blackhole', 'ocean', 'mandelbulb', 'reaction', 'terrain'] as const;
const stylesheet = readFileSync(new URL('../src/styles/hero.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

type CssRule = { prelude: string; body: string; inside: string[] };

function parseCss(source: string): CssRule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const inside: string[] = [];
  let buffer = '';
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '{') {
      const prelude = buffer.trim();
      buffer = '';
      if (prelude.startsWith('@')) {
        inside.push(prelude);
        continue;
      }
      const close = text.indexOf('}', index);
      rules.push({ prelude, body: text.slice(index + 1, close), inside: [...inside] });
      index = close;
    } else if (character === '}') {
      inside.pop();
      buffer = '';
    } else {
      buffer += character;
    }
  }
  return rules;
}

const rules = parseCss(stylesheet);
const mobile = /@media\s*\(max-width:\s*700px\)/;
/** A prelude may carry several selectors; each one is looked up on its own. */
const selectors = (prelude: string) => prelude.split(',').map((selector) => selector.trim());

/** Exactly one rule declares every pattern for that exact selector at that breakpoint. */
function declares(selector: string, media: RegExp | null, ...patterns: RegExp[]): CssRule {
  const found = rules.filter(
    (rule) =>
      selectors(rule.prelude).includes(selector) &&
      (media === null
        ? rule.inside.length === 0
        : rule.inside.some((ancestor) => media.test(ancestor))) &&
      patterns.every((pattern) => pattern.test(rule.body)),
  );
  assert.equal(found.length, 1, `expected one ${selector} rule with ${patterns.join(' ')}`);
  return found[0];
}

const scope = (id: string) => `#hero[data-effect='${id}']`;

/** Every rule a scene owns, at the top level or inside one breakpoint. */
function sceneRules(id: string, media: RegExp | null): CssRule[] {
  return rules.filter(
    (rule) =>
      (media === null
        ? rule.inside.length === 0
        : rule.inside.some((ancestor) => media.test(ancestor))) &&
      selectors(rule.prelude).some((selector) => selector.includes(scope(id))),
  );
}

const sceneRule = (id: string, tail: string, media: RegExp | null, ...patterns: RegExp[]) =>
  declares(`${scope(id)}${tail}`, media, ...patterns);

/** Rules that belong to the new scenes: the shared stage classes and every scene scope. */
const sceneCss = /algorithm-|data-effect='(?:blackhole|ocean|mandelbulb|reaction|terrain)'/;
const owned = rules.filter((rule) => selectors(rule.prelude).some((s) => sceneCss.test(s)));
/** Interface selectors the scene layers must never hide. */
const interfaceSelectors =
  /#effect-picker|\.hero-github|\.hero-source-note|\.hero-top|\.hero-bottom|\.enter|\.hero-copy|#hero-stage/;
const hidden = /visibility:\s*hidden|display:\s*none|opacity:\s*0(?![\d.])/;

/** '#rrggbb' read as three channel bytes, so a scrim can be proven dark channel by channel. */
function channels(hex: string): number[] {
  return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
}

/** The three colour bytes of an `rgb(...)`/`rgba(...)` function; the alpha is not checked. */
function rgbChannels(color: string): number[] {
  return (color.match(/\d+/g) ?? []).slice(0, 3).map(Number);
}

test('the five scenes keep the shared stage contract', () => {
  assert.ok(owned.length >= 20, 'expected the scene stylesheet to own rules');
  for (const selector of ['.algorithm-layer', '.algorithm-still', '.algorithm-canvas'])
    declares(selector, null, /position:\s*absolute/, /inset:\s*0/);
  declares('.algorithm-layer', null, /pointer-events:\s*none/);
  // The canvas is hidden until the scene reports its first frame, wrapper or not.
  declares('.algorithm-canvas', null, /visibility:\s*hidden/);
  declares('.algorithm-layer canvas', null, /visibility:\s*hidden/);
  declares(".algorithm-layer[data-state='live'] canvas", null, /visibility:\s*visible/);
  declares(".algorithm-layer[data-state='live'] .algorithm-canvas", null, /visibility:\s*visible/);
  // …and the still leaves the stage only once that canvas is up, or not at all.
  declares(".algorithm-layer[data-state='live'] .algorithm-still", null, /visibility:\s*hidden/);
});

test('no scene layer can cover the interface or hold pointer input', () => {
  // The stage itself sits behind the page content; nothing inside may outrank it.
  declares('#hero-stage', null, /z-index:\s*-1/);
  for (const rule of owned) {
    assert.doesNotMatch(rule.body, /z-index/, rule.prelude);
    assert.doesNotMatch(rule.body, /position:\s*fixed/, rule.prelude);
  }
  for (const rule of owned) {
    if (!selectors(rule.prelude).some((selector) => interfaceSelectors.test(selector))) continue;
    assert.doesNotMatch(rule.body, hidden, `${rule.prelude} must leave the interface visible`);
  }
});

test('every still is a CSS composition with no image behind it', () => {
  for (const id of scenes) sceneRule(id, ' .algorithm-still', null, /background:\s*[^;]*gradient/);
  for (const rule of owned) {
    assert.doesNotMatch(rule.body, /url\(/, `${rule.prelude} must not reference an image`);
    assert.doesNotMatch(rule.body, /https?:\/\//, `${rule.prelude} must not reference a host`);
  }
});

test('each scene registers its own palette and its copy geometry', () => {
  const geometry: Record<string, RegExp[]> = {
    blackhole: [/top:\s*32%/, /right:\s*58%/, /text-align:\s*left/],
    ocean: [/top:\s*22%/],
    mandelbulb: [/top:\s*32%/, /right:\s*58%/, /text-align:\s*left/],
    terrain: [/top:\s*20%/],
  };
  for (const id of scenes) {
    declares(scope(id), null, /background:\s*#/, /color:\s*#/);
    if (geometry[id]) sceneRule(id, ' .hero-copy', null, ...geometry[id]);
  }
  // Reaction owns no column: its centred copy is dimmed by a dark mask instead.
  assert.equal(
    sceneRules('reaction', null).some((rule) =>
      selectors(rule.prelude).some((selector) => selector.endsWith('.hero-copy')),
    ),
    false,
    'reaction keeps the centred copy',
  );
  const scrim = sceneRule(
    'reaction',
    ' .algorithm-layer::after',
    null,
    /background:\s*radial-gradient/,
  );
  const stops = scrim.body.match(/#[0-9a-f]{6}/gi) ?? [];
  assert.ok(stops.length > 0, 'expected the mask to name its colours');
  for (const stop of stops)
    assert.ok(
      Math.max(...channels(stop.slice(1))) < 0x40,
      `${stop} must stay dark so the title keeps its contrast`,
    );
  // Ocean needs the same protection over its near-white horizon band, as a vertical scrim.
  const band = sceneRule(
    'ocean',
    ' .algorithm-layer::after',
    null,
    /position:\s*absolute/,
    /inset:\s*0/,
    /pointer-events:\s*none/,
    /background:\s*linear-gradient/,
  );
  const shades = band.body.match(/rgba?\([^)]*\)/gi) ?? [];
  assert.ok(shades.length > 0, 'expected the ocean scrim to name its shades');
  for (const shade of shades)
    assert.ok(
      Math.max(...rgbChannels(shade)) < 0x40,
      `${shade} must stay dark so the title keeps its contrast`,
    );
  // The black hole disk washes out the left column on wide screens, so its scrim runs sideways…
  const disk = sceneRule(
    'blackhole',
    ' .algorithm-layer::after',
    null,
    /position:\s*absolute/,
    /inset:\s*0/,
    /pointer-events:\s*none/,
    /background:\s*linear-gradient\(/,
    /90deg/,
  );
  for (const shade of disk.body.match(/rgba?\([^)]*\)/gi) ?? [])
    assert.ok(
      Math.max(...rgbChannels(shade)) < 0x40,
      `${shade} must stay dark so the title keeps its contrast`,
    );
  // …and vertically on portrait, where the copy sits over the disk instead of beside it.
  sceneRule(
    'blackhole',
    ' .algorithm-layer::after',
    mobile,
    /background:\s*linear-gradient\(/,
    /to bottom/,
  );
});

test('narrow screens centre every new scene and cap the title', () => {
  for (const id of scenes) {
    sceneRule(
      id,
      ' .hero-copy',
      mobile,
      /top:\s*22%/,
      /left:\s*7%/,
      /right:\s*7%/,
      /text-align:\s*center/,
    );
    sceneRule(id, ' .hero-copy h1', mobile, /font-size:\s*clamp\(32px,\s*8vw,\s*48px\)/);
  }
});

test('the CSS fallback is still when motion is reduced', () => {
  declares("#hero[data-reduced='true'] *::after", null, /animation:\s*none/, /transition:\s*none/);
});

test('the showcase still renders its first entry server-side while the picker owns the count', () => {
  assert.match(page, /data-effect="io724"/);
  assert.match(page, /id="effect-position"\s*>\s*1 \/ \{config\.hero\.length\}/);
});
