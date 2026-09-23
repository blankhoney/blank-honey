import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { config } from '../src/config';

/* Layout contract for the four algorithm scenes appended to the showcase. It pins the
 * shared stage rules that keep the interface in front, proves the still fallback is a
 * pure-CSS composition without any image, records which variables place the copy, and
 * keeps the withdrawn fractal out of the stylesheet. */
const scenes = ['blackhole', 'ocean', 'reaction', 'terrain'] as const;
/** Every screen the showcase ships: the nine references, none of them withdrawn. */
const variants = ['io724', 'miniload', 'isaca', 'yantao', 'birds', ...scenes] as const;
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
const sceneCss = /algorithm-|data-effect='(?:blackhole|ocean|reaction|terrain)'/;
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

/** The alpha byte of every `rgba(...)` stop, in source order. */
function alphas(body: string): number[] {
  return (body.match(/rgba\([^)]*\)/gi) ?? []).map((color) => {
    const parts = color.match(/[\d.]+/g) ?? [];
    return Number(parts[parts.length - 1]);
  });
}

/** Every `data-effect='...'` screen name the stylesheet targets. */
function styledIds(): string[] {
  return [...stylesheet.matchAll(/data-effect='([^']+)'/g)].map((match) => match[1]);
}

test('the nine shipped screens are the only screens the stylesheet styles', () => {
  const configured = config.hero.map((entry) => entry.id);
  assert.equal(configured.length, 9, 'the showcase ships nine references');
  assert.deepEqual(
    [...new Set(styledIds())].sort(),
    [...configured].sort(),
    'every configured reference owns a rule and no withdrawn one survives',
  );
  assert.doesNotMatch(stylesheet, /mandelbulb/i, 'the withdrawn fractal leaves no rule behind');
  // Every screen names a ground and an ink of its own, whether the ground is one colour or,
  // as on io724, a small layered plate.
  for (const id of variants) declares(scope(id), null, /background:\s*\S/, /--hero-ink:\s*#/);
  declares(
    scope('io724'),
    null,
    /radial-gradient\(ellipse at 80% 75%,\s*#173e4359,\s*transparent 42%\)/,
    /radial-gradient\(ellipse at 65% 90%,\s*#6d49342e,\s*transparent 40%\)/,
    /#030707/,
  );
});

test('the shared copy block is placed from the per-variant variables', () => {
  declares(
    '#hero',
    null,
    /--hero-copy-top:\s*34%/,
    /--hero-copy-left:\s*8%/,
    /--hero-copy-width:\s*38%/,
  );
  declares(
    '#hero .hero-copy',
    null,
    /top:\s*var\(--hero-copy-top\)/,
    /left:\s*var\(--hero-copy-left\)/,
    /width:\s*var\(--hero-copy-width\)/,
    /text-align:\s*left/,
    /pointer-events:\s*none/,
  );
});

test('the four scenes keep the shared stage contract', () => {
  // The shared stage rules, plus a palette rule and a still for every scene on top of them.
  assert.ok(owned.length >= 12, 'expected the scene stylesheet to own rules');
  for (const id of scenes)
    assert.ok(sceneRules(id, null).length >= 2, `${id} owns its palette and its still`);
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

test('each scene names its own copy column', () => {
  const geometry: Record<string, RegExp[]> = {
    blackhole: [/--hero-copy-left:\s*8%/, /--hero-copy-top:\s*34%/, /--hero-copy-width:\s*32%/],
    ocean: [/--hero-copy-left:\s*8%/, /--hero-copy-top:\s*22%/, /--hero-copy-width:\s*38%/],
    reaction: [/--hero-copy-left:\s*8%/, /--hero-copy-top:\s*26%/, /--hero-copy-width:\s*32%/],
    terrain: [/--hero-copy-left:\s*8%/, /--hero-copy-top:\s*14%/, /--hero-copy-width:\s*38%/],
  };
  for (const id of scenes) {
    declares(scope(id), null, /background:\s*#/, /--hero-ink:\s*#/);
    declares(scope(id), null, ...geometry[id]);
  }
});

/* Every scene places its description on the busiest part of its own transition. Instead of a
   mask over the artwork, each screen that needs it names a stronger step of its own ink, so the
   description keeps its contrast and the picture stays untouched. */
test('the scene that needs it names its own muted step of its own ink', () => {
  const ratios: Record<string, number> = { ocean: 86, reaction: 80, terrain: 84 };
  for (const [id, ratio] of Object.entries(ratios)) {
    const scene = declares(scope(id), null, /--hero-muted:\s*color-mix\(in srgb/);
    assert.match(
      scene.body,
      new RegExp(
        `--hero-muted:\\s*color-mix\\(in srgb,\\s*var\\(--hero-ink\\) ${ratio}%,\\s*transparent\\)`,
      ),
      `${id} reads its description at ${ratio}% of its own ink`,
    );
  }
  // The black hole keeps the shared step, and no scene turns the step into a mask: the only
  // colour-mix a palette rule may carry is the muted ink itself.
  for (const id of scenes) {
    const palette = sceneRules(id, null).filter((rule) => /--hero-ink:/.test(rule.body));
    for (const rule of palette) {
      if (id in ratios) continue;
      assert.doesNotMatch(rule.body, /--hero-muted/, `${id} keeps the shared muted step`);
    }
  }
  for (const rule of owned)
    assert.doesNotMatch(
      rule.body,
      /(?:background|mask|inset)[^;]*color-mix\(in srgb,\s*var\(--hero-ink\)/,
      `${rule.prelude} must not grow a mask out of the muted ink`,
    );
});

test('the light reaction screen carries dark ink and needs no dimming pass', () => {
  const scene = declares(scope('reaction'), null, /--hero-ink:\s*#/);
  const ink = scene.body.match(/--hero-ink:\s*#([0-9a-f]{6})/i);
  assert.ok(ink, 'expected the reaction ink to name its colour');
  assert.ok(
    Math.max(...channels(ink[1])) < 0x60,
    'the reaction copy is dark ink on paper, so the scene stays light',
  );
  assert.equal(
    sceneRules('reaction', null).some((rule) =>
      selectors(rule.prelude).some((selector) => selector.endsWith('.algorithm-layer::after')),
    ),
    false,
    'the light screen needs no scrim over its own artwork',
  );
  // Warm white with a grey-green embossed field: every stop of the still stays light.
  const still = sceneRule('reaction', ' .algorithm-still', null, /background:\s*[^;]*gradient/);
  const stops = still.body.match(/#[0-9a-f]{6}/gi) ?? [];
  assert.ok(stops.length >= 3, 'expected the embossed field to name its colours');
  for (const stop of stops)
    assert.ok(
      Math.min(...channels(stop.slice(1))) > 0x60,
      `${stop} must stay light so the dark title keeps its contrast`,
    );
  assert.doesNotMatch(stylesheet, /d9c37a|6fdcab|03110d/i, 'the old green and gold field is gone');
});

test('each scrim dims only the band it must', () => {
  // The black hole disk lights the left column on wide screens, so its scrim runs sideways:
  // 30% at the left edge at most, and already clear by the middle of the stage.
  const disk = sceneRule(
    'blackhole',
    ' .algorithm-layer::after',
    null,
    /position:\s*absolute/,
    /inset:\s*0/,
    /pointer-events:\s*none/,
    /background:\s*linear-gradient\(/,
    /90deg/,
    /50%/,
  );
  const diskStops = alphas(disk.body);
  assert.ok(diskStops.length >= 2, 'expected the black hole scrim to name its stops');
  assert.ok(Math.max(...diskStops) <= 0.3, 'the black hole scrim opens at 30% at most');
  assert.equal(diskStops[diskStops.length - 1], 0, 'and reaches full transparency by the middle');
  for (const shade of disk.body.match(/rgba?\([^)]*\)/gi) ?? [])
    assert.ok(
      Math.max(...rgbChannels(shade)) < 0x40,
      `${shade} must stay dark so the title keeps its contrast`,
    );
  // Ocean needs no dimming pass at all: its sky is pale and the ink above the waterline is dark,
  // so no breakpoint may keep a scrim pseudo-element over that picture.
  for (const breakpoint of [null, mobile])
    assert.equal(
      sceneRules('ocean', breakpoint).some((rule) =>
        selectors(rule.prelude).some((selector) => selector.endsWith('.algorithm-layer::after')),
      ),
      false,
      'the ocean stage keeps no scrim: the bright sky carries its own dark ink',
    );
  // Terrain is a pale scene now, so its mist is pale as well: one short wash from the left
  // behind the title and one from the bottom behind the entry, picker and source note. It never
  // darkens the picture - both layers open well before the middle of the stage.
  const mist = sceneRule(
    'terrain',
    ' .algorithm-layer::after',
    null,
    /position:\s*absolute/,
    /inset:\s*0/,
    /pointer-events:\s*none/,
    /background:\s*linear-gradient\(/,
  );
  assert.match(mist.body, /to right/, 'the title takes the sideways wash');
  assert.match(mist.body, /rgba\(231,\s*226,\s*215,\s*0\.36\),\s*transparent 48%/);
  assert.match(mist.body, /to top/, 'the bottom band takes the rising mist');
  assert.match(mist.body, /rgba\(231,\s*226,\s*215,\s*0\.8\),\s*transparent 26%/);
  assert.doesNotMatch(mist.body, /to bottom|rgba\(9,|rgba\(4,/, 'the old dark top-band pass is gone');
  for (const shade of mist.body.match(/rgba?\([^)]*\)/gi) ?? [])
    assert.ok(
      Math.min(...rgbChannels(shade)) > 0xc0,
      `${shade} must stay pale: this scene protects its ink with mist, not with a dark scrim`,
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

test('the bright ocean sky carries its own dark ink instead of a scrim', () => {
  // The root keeps the bright ink, because the note's plate and the picker read it over water.
  const scene = declares(scope('ocean'), null, /--hero-ink:\s*#/);
  const water = scene.body.match(/--hero-ink:\s*#([0-9a-f]{6})/i);
  assert.ok(water, 'expected the ocean root to name its ink');
  assert.ok(
    Math.min(...channels(water[1])) > 0xd0,
    'the water band keeps the bright ink for the note and the picker below the waterline',
  );
  assert.match(
    scene.body,
    /--hero-muted:\s*color-mix\(in srgb,\s*var\(--hero-ink\) 86%,\s*transparent\)/,
    'and the root keeps its own muted step for the same band',
  );
  // Everything above the waterline - the header and the copy column - names a dark ink of its
  // own, so the pale sky needs no dimming pass for the copy to read.
  const skyTop = declares(`${scope('ocean')} .hero-top`, null, /color:\s*var\(--hero-ink\)/);
  const skyCopy = declares(`${scope('ocean')} .hero-copy`, null, /color:\s*var\(--hero-ink\)/);
  for (const sky of [skyTop, skyCopy]) {
    const ink = sky.body.match(/--hero-ink:\s*#([0-9a-f]{6})/i);
    assert.ok(ink, 'expected the sky ink to name its colour');
    assert.equal(ink[1], '213640', 'the pale sky reads in the dark ink');
    assert.ok(Math.max(...channels(ink[1])) < 0x60, 'and that ink really is dark');
    assert.match(
      sky.body,
      /--hero-muted:\s*color-mix\(in srgb,\s*var\(--hero-ink\) 86%,\s*transparent\)/,
      'the description takes a stronger step of that same dark ink',
    );
    assert.match(
      sky.body,
      /--hero-line:\s*color-mix\(in srgb,\s*var\(--hero-ink\) 24%,\s*transparent\)/,
      'and the hairline follows the sky ink instead of the water colour',
    );
  }
  // Only those two blocks take it, so the note and the picker cannot be darkened by accident.
  assert.deepEqual(
    skyTop.prelude
      .split(',')
      .map((selector) => selector.trim())
      .sort(),
    [`${scope('ocean')} .hero-copy`, `${scope('ocean')} .hero-top`].sort(),
    'only the header and the copy take the sky ink',
  );
  // One pale sky band over one deep water band, with the horizon mist kept at the waterline.
  const still = sceneRule('ocean', ' .algorithm-still', null, /background:\s*[^;]*gradient/);
  assert.match(
    still.body,
    /radial-gradient\(ellipse 40% 9% at 58% 56%,\s*#d3ddd926,\s*#0000 74%\)/,
    'the horizon mist stays where it was',
  );
  assert.match(
    still.body,
    /linear-gradient\(\s*to bottom,\s*#acbcc1 0%,\s*#ece9e1 42%,\s*#91aeb5 42\.5%,\s*#244b60 72%,\s*#0b2030 100%\s*\)/,
    'and the still is the same bright sky over deep water the live scene draws',
  );
  // The old dark stage is gone: the sky end of the still must stay pale.
  const skyStop = still.body.match(/#(?:[0-9a-f]{6})/gi) ?? [];
  assert.ok(
    skyStop.some((stop) => Math.min(...channels(stop.slice(1))) > 0xd0),
    'the sky end of the still stays pale',
  );
});

test('the pale terrain scene reads in dark ink over two placed ridge wedges', () => {
  const scene = declares(scope('terrain'), null, /--hero-ink:\s*#/);
  const ink = scene.body.match(/--hero-ink:\s*#([0-9a-f]{6})/i);
  assert.ok(ink, 'expected the terrain ink to name its colour');
  assert.ok(
    Math.max(...channels(ink[1])) < 0x60,
    'the misty valley is a light scene, so the copy reads in dark ink',
  );
  assert.match(scene.body, /background:\s*#c8cfc8/, 'and the ground under it stays pale');
  // The old composition tiled two sharp triangles across the horizon; the new one places each
  // ridge wedge once, in its own corner and at its own size.
  const still = sceneRule('terrain', ' .algorithm-still', null, /background:\s*[^;]*gradient/);
  assert.doesNotMatch(still.body, /(?<!no-)repeat/, 'the tiled ridge triangles are gone');
  assert.match(
    still.body,
    /linear-gradient\(145deg,\s*transparent 49%,\s*#8c9d97 50%\)\s+left bottom\s*\/\s*60% 50%\s+no-repeat/,
    'the near ridge is one half-height wedge anchored in the lower-left corner',
  );
  assert.match(
    still.body,
    /linear-gradient\(215deg,\s*transparent 49%,\s*#62756f 50%\)\s+right bottom\s*\/\s*65% 60%\s+no-repeat/,
    'the far ridge is one wedge anchored in the lower-right corner',
  );
  assert.match(
    still.body,
    /linear-gradient\(to bottom,\s*#d9dcd2,\s*#8ea3a0 55%,\s*#6c8584\)/,
    'and both sit over the one sky-to-valley wash that carries the scene',
  );
});

test('narrow screens centre every screen from one shared geometry', () => {
  declares('#hero', mobile, /min-height:\s*700px/, /padding:\s*24px/);
  // One column between two 24px gutters for every variant…
  declares(
    '#hero[data-effect]',
    mobile,
    /--hero-copy-top:\s*21%/,
    /--hero-copy-left:\s*24px/,
    /--hero-copy-width:\s*calc\(100% - 48px\)/,
  );
  declares('#hero .hero-copy', mobile, /text-align:\s*center/);
  declares('#hero .hero-copy h1', mobile, /font-size:\s*clamp\(34px,\s*9vw,\s*48px\)/);
  // …with the two screens that own a column below the title keeping their own top edge.
  declares(scope('isaca'), mobile, /--hero-copy-top:\s*14%/);
  declares(scope('yantao'), mobile, /--hero-copy-top:\s*19%/);
  for (const id of scenes)
    assert.equal(
      sceneRules(id, mobile).some((rule) =>
        selectors(rule.prelude).some((selector) => selector.endsWith(' .hero-copy')),
      ),
      false,
      `${id} takes the shared narrow-screen column instead of its own`,
    );
});

test('the CSS fallback is still when motion is reduced', () => {
  declares("#hero[data-reduced='true'] *::after", null, /animation:\s*none/, /transition:\s*none/);
});

test('the showcase still renders its first entry server-side while the picker owns the count', () => {
  assert.match(page, new RegExp(`data-effect="${config.hero[0].id}"`));
  assert.match(page, /id="effect-position"\s*>\s*1 \/ \{config\.hero\.length\}/);
});
