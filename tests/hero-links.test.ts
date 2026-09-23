import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { config } from '../src/config';

/* The showcase hero owns two optional entries: the profile in the header and the source note.
 * The stylesheet section pins the shared header, copy and bottom band, and the two screens
 * whose own column (isaca's cards, yantao's notebook) still has to clear the controls. */
const page = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../src/styles/hero.css', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
// The neutral public tree drops the private export path entirely; that is a valid state.
const templatePath = new URL('../scripts/template.mjs', import.meta.url);
const template = existsSync(templatePath) ? readFileSync(templatePath, 'utf8') : '';
// The manifest that strips the private posters is dropped from the public tree as well, so its
// presence is what tells this suite whether the two poster images are still referenced at all.
const privateSource = existsSync(
  new URL('../scripts/public-export.manifest.json', import.meta.url),
);

type Anchor = { tag: string; inner: string; start: number; end: number };

/** The anchor whose opening tag contains the marker, plus everything inside it. */
function findAnchor(source: string, marker: string): Anchor {
  const mark = source.indexOf(marker);
  assert.ok(mark > -1, `expected ${marker} in the showcase page`);
  const start = source.lastIndexOf('<a', mark);
  assert.ok(start > -1, `expected ${marker} to sit inside an anchor`);
  const openEnd = source.indexOf('>', mark) + 1;
  const close = source.indexOf('</a>', openEnd);
  assert.ok(close > -1, `expected ${marker} to close with </a>`);
  return {
    tag: source.slice(start, openEnd),
    inner: source.slice(openEnd, close),
    start,
    end: close + 4,
  };
}

/** A missing or empty configuration must leave the link out of the markup entirely. */
function expectGuarded(source: string, anchor: Anchor, condition: string) {
  const before = source.slice(0, anchor.start).replace(/\s/g, '');
  assert.ok(
    before.endsWith(`{${condition}&&(`),
    `expected the link to render only when ${condition} is set`,
  );
  const after = source.slice(anchor.end).replace(/\s/g, '');
  assert.match(after, /^(?:<\/[a-z]+>)?\)\}/, 'expected the conditional block to close there');
}

/* ---------- 1. configuration -------------------------------------------- */

test('both public links prefer their environment entry and fall back to the site configuration', () => {
  assert.match(page, /const github = import\.meta\.env\.PUBLIC_GITHUB_URL \|\| config\.githubUrl;/);
  assert.match(
    page,
    /const githubSource =\s*import\.meta\.env\.PUBLIC_GITHUB_SOURCE_URL \|\| config\.githubSourceUrl;/,
  );
});

test('a configured source entry names a repository while the profile entry stays a profile', () => {
  // The neutral public template blanks both entries, so an empty source link is valid here.
  const source = String(config.githubSourceUrl);
  const profile = String(config.githubUrl);
  if (source) {
    const url = new URL(source);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'github.com');
    assert.ok(
      url.pathname.split('/').filter(Boolean).length >= 2,
      'the source link must point at an owner and a repository',
    );
    assert.notEqual(source, profile, 'the source is a repository');
  }
  if (profile) {
    const url = new URL(profile);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'github.com');
    assert.equal(url.pathname.split('/').filter(Boolean).length, 1);
  }
});

test('the template export strips the private source entry right after the profile entry', (t) => {
  if (!template) {
    t.skip('the tree ships no export script, so nothing can leak the private entry');
    return;
  }
  const start = template.indexOf("if (file.endsWith('src/config.ts'))");
  assert.ok(start > -1, 'expected the export to special-case the site configuration');
  const end = template.indexOf('writeFileSync', start);
  assert.ok(end > start, 'expected the rewrite to finish before the file is written');
  const block = template.slice(start, end);
  const profile = `.replace(/githubUrl: '[^']*'/, "githubUrl: ''")`;
  const source = `.replace(/githubSourceUrl: '[^']*'/, "githubSourceUrl: ''")`;
  assert.ok(block.includes(profile), 'expected the export to blank the profile entry');
  assert.ok(block.includes(source), 'expected the export to blank the source entry');
  assert.ok(
    block.indexOf(source) > block.indexOf(profile),
    'the source entry is blanked right after the profile entry',
  );
});

test('the example environment keeps one empty variable for the source link', () => {
  const lines = envExample.split('\n');
  const profile = lines.indexOf('PUBLIC_GITHUB_URL=');
  const source = lines.indexOf('PUBLIC_GITHUB_SOURCE_URL=');
  assert.ok(profile > -1, 'expected PUBLIC_GITHUB_URL=');
  assert.ok(source > -1, 'expected PUBLIC_GITHUB_SOURCE_URL=');
  assert.equal(source, profile + 1, 'the source variable follows the profile variable');
  assert.equal(lines[source], 'PUBLIC_GITHUB_SOURCE_URL=', 'the source variable stays empty');
  assert.equal(lines[profile], 'PUBLIC_GITHUB_URL=', 'the profile variable stays empty');
});

/* ---------- 2. page markup ---------------------------------------------- */

test('the header link is optional, labelled, and opens the bound URL in a new window', () => {
  const anchor = findAnchor(page, 'class="hero-github"');
  assert.match(anchor.tag, /href=\{github\}/, 'the href comes from the resolved configuration');
  assert.match(anchor.tag, /target="_blank"/);
  assert.match(anchor.tag, /rel="noopener noreferrer"/);
  assert.match(anchor.tag, /aria-label="访问我的 GitHub（新窗口）"/);
  assert.match(anchor.inner, /GitHub ↗/);
  assert.match(anchor.inner, /<svg[\s\S]*<\/svg>/, 'the brand icon is inline');
  assert.doesNotMatch(anchor.tag + anchor.inner, /<img|xlink:href|src=/, 'no external asset');
  expectGuarded(page, anchor, 'github');
  assert.equal(page.split('class="hero-github"').length - 1, 1, 'one header link only');
});

test('the source note is optional, explains the release, and opens in a new window', () => {
  const anchor = findAnchor(page, 'href={githubSource}');
  assert.match(anchor.tag, /target="_blank"/);
  assert.match(anchor.tag, /rel="noopener noreferrer"/);
  assert.match(anchor.tag, /aria-label="在 GitHub 获取首屏实现（新窗口）"/);
  assert.match(anchor.inner, /去 GitHub 自取 ↗/);
  const block = page.indexOf('<p class="hero-source-note"');
  assert.ok(block > -1, 'expected the note to be a paragraph');
  expectGuarded(page, { ...anchor, start: block }, 'githubSource');
  assert.match(page, /<p\s+class="hero-source-note"\s*>\s*首屏实现已开源，/);
  assert.ok(
    page.indexOf('class="hero-source-note"') > page.indexOf('id="effect-picker"'),
    'the note follows the effect picker',
  );
});

test('neither link carries a listener hook or an inline handler', () => {
  for (const marker of ['class="hero-github"', 'href={githubSource}']) {
    const anchor = findAnchor(page, marker);
    assert.doesNotMatch(anchor.tag, /onclick|onpointer|data-/);
  }
});

test('the hero section flags the optional source and keeps the effect controls intact', () => {
  assert.match(
    page,
    /class:list=\{\s*\[\s*'hero'\s*,\s*\{\s*'has-hero-source':\s*Boolean\(githubSource\)\s*\}\s*\]\s*\}/,
  );
  assert.doesNotMatch(page, /class="hero"/, 'the static hero class is gone');
  for (const attribute of ['id="hero"', 'data-effect="io724"'])
    assert.match(page, new RegExp(attribute), attribute);
  for (const id of [
    'hero-stage',
    'effect-picker',
    'effect-prev',
    'effect-next',
    'effect-label',
    'effect-position',
    'index-switch',
    'hero-code',
  ])
    assert.match(page, new RegExp(`id="${id}"`), id);
});

test('every personal string still ships as markup, not as generated decoration', () => {
  assert.match(page, /\{config\.name\}/);
  assert.match(page, /\{config\.description\}/);
  assert.match(page, /\{config\.sayings\[0\]\}/);
  assert.match(page, /class="hero-description"/);
  assert.match(page, /class="saying"/);
  assert.match(page, /class="eyebrow"/);
});

/* ---------- 3. stylesheet ----------------------------------------------- */

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
const tablet = /@media\s*\(max-width:\s*1100px\)/;

/** Rules that name one exact selector, scoped to a breakpoint block or to the top level.
 *  A prelude may carry several selectors; each one is looked up on its own. */
function selectors(prelude: string, media: RegExp | null = null): CssRule[] {
  return rules.filter(
    (rule) =>
      rule.prelude
        .split(',')
        .map((selector) => selector.trim())
        .includes(prelude) &&
      (media === null
        ? rule.inside.length === 0
        : rule.inside.some((ancestor) => media.test(ancestor))),
  );
}

/** Exactly one rule for the selector declares every property pattern. */
function declares(prelude: string, media: RegExp | null, ...patterns: RegExp[]): CssRule {
  const found = selectors(prelude, media).filter((rule) =>
    patterns.every((pattern) => pattern.test(rule.body)),
  );
  assert.equal(found.length, 1, `expected one ${prelude} rule with ${patterns.join(' ')}`);
  return found[0];
}

test('the header keeps one mono brand line and a lightweight profile entry', () => {
  declares(
    '#hero .hero-top',
    null,
    /z-index:\s*5/,
    /align-items:\s*center/,
    /font:\s*11px var\(--mono\)/,
    /letter-spacing:\s*0\.14em/,
    /color:\s*inherit/,
  );
  declares(
    '#hero .hero-top-links',
    null,
    /display:\s*inline-flex/,
    /align-items:\s*center/,
    /gap:\s*18px/,
  );
  declares(
    '#hero .hero-top-links .hero-tagline',
    null,
    /font-family:\s*var\(--reader\)/,
    /letter-spacing:\s*0\.08em/,
  );
  const entry = declares(
    '#hero .hero-github',
    null,
    /display:\s*inline-flex/,
    /align-items:\s*center/,
    /gap:\s*8px/,
    /min-height:\s*44px/,
    /padding:\s*0 12px/,
    /border:\s*1px solid transparent/,
    /color:\s*inherit/,
    /font-size:\s*12px/,
    /letter-spacing:\s*0\.02em/,
  );
  // The entry is a text control now: no pill fill, a hairline only while hovered or focused.
  assert.doesNotMatch(entry.body, /border-radius:\s*999px/, 'the pill is gone');
  assert.doesNotMatch(entry.body, /background:/, 'the entry carries no fill');
  declares('#hero .hero-github:hover', null, /border-color:\s*var\(--hero-line\)/);
  declares('#hero .hero-github:focus-visible', null, /outline:\s*2px solid currentColor/, /outline-offset:\s*4px/);
  declares('#hero .hero-github svg', null, /width:\s*18px/, /height:\s*18px/);
  const controls = rules.filter((rule) =>
    /hero-github|hero-source-note|hero-top-links|hero-tagline/.test(rule.prelude),
  );
  assert.ok(controls.length >= 6, 'expected the new controls to be styled');
  for (const rule of controls) assert.doesNotMatch(rule.body, /animation|transition/);
});

test('the copy is one shared block placed from the six per-variant variables', () => {
  declares(
    '#hero',
    null,
    /padding:\s*32px clamp\(24px,\s*5vw,\s*80px\)/,
    /--hero-ink:\s*#/,
    /--hero-muted:/,
    /--hero-line:/,
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
  declares(
    '#hero .hero-copy h1',
    null,
    /font-family:\s*var\(--reader\)/,
    /font-weight:\s*400/,
    /font-size:\s*clamp\(42px,\s*5\.5vw,\s*84px\)/,
    /line-height:\s*1\.03/,
    /letter-spacing:\s*-0\.045em/,
    /margin:\s*0/,
  );
  declares(
    '#hero .hero-description',
    null,
    /font-size:\s*15px/,
    /line-height:\s*1\.9/,
    /max-width:\s*28rem/,
    /margin:\s*26px 0 0/,
  );
  declares('#hero .saying', null, /font-style:\s*italic/, /font-size:\s*14px/, /margin:\s*24px 0 0/);
  declares('#hero .eyebrow', null, /font-size:\s*10px/, /letter-spacing:\s*0\.18em/);
});

test('the bottom band keeps the entry left, the picker centred and the note right', () => {
  declares(
    '#hero .hero-bottom',
    null,
    /left:\s*clamp\(24px,\s*5vw,\s*80px\)/,
    /right:\s*auto/,
    /bottom:\s*34px/,
    /z-index:\s*5/,
  );
  const capsule = declares(
    '#hero #effect-picker',
    null,
    /position:\s*absolute/,
    /left:\s*50%/,
    /bottom:\s*max\(34px,\s*env\(safe-area-inset-bottom\)\)/,
    /transform:\s*translateX\(-50%\)/,
    /z-index:\s*5/,
    /border:\s*1px solid var\(--hero-line\)/,
    /padding:\s*4px/,
    /color:\s*inherit/,
    /text-align:\s*center/,
  );
  // The thick outer capsule is gone; a hairline and a light wash keep the control readable.
  assert.doesNotMatch(capsule.body, /padding:\s*(?:[7-9]|1\d)px/, 'the padded pill is gone');
  assert.doesNotMatch(capsule.body, /color-mix\(in srgb,\s*#000 65%/, 'the heavy fill is gone');
  declares('#hero #effect-picker button', null, /width:\s*44px/, /height:\s*44px/, /border-radius:\s*50%/);
  declares('#hero #effect-picker button:hover', null, /background:/);
  declares(
    '#hero #effect-picker button:focus-visible',
    null,
    /outline:\s*2px solid currentColor/,
    /outline-offset:\s*3px/,
  );
  // Both arrows and the name/count readout stay.
  declares('.effect-caption', null, /font:\s*10px\/1\.4 var\(--mono\)/, /white-space:\s*nowrap/);
  declares('#hero #effect-label', null, /font:\s*13px\/1\.5 var\(--mono\)/, /color:\s*inherit/);
});

test('the source note shares the bottom band and the picker steps up for it', () => {
  const note = declares(
    '#hero .hero-source-note',
    null,
    /position:\s*absolute/,
    /right:\s*clamp\(24px,\s*5vw,\s*80px\)/,
    /left:\s*auto/,
    /bottom:\s*34px/,
    /z-index:\s*5/,
    /max-width:\s*260px/,
    /margin:\s*0/,
    /text-align:\s*right/,
    /font:\s*12px\/1\.5 var\(--mono\)/,
    /color:\s*inherit/,
  );
  assert.doesNotMatch(note.body, /nowrap/, 'the note wraps on a 320px screen');
  declares(
    '#hero .hero-source-note a',
    null,
    /color:\s*inherit/,
    /text-decoration:\s*underline/,
    /text-underline-offset:\s*3px/,
  );
  declares(
    '#hero .hero-source-note a:focus-visible',
    null,
    /outline:\s*2px solid currentColor/,
    /outline-offset:\s*3px/,
  );
  // Only the ocean screen puts a plate behind the note: local contrast for one line over the
  // water, never a scrim over the stage. On a phone the plate wraps the line instead of padding it.
  const water = declares(
    "#hero[data-effect='ocean'] .hero-source-note",
    null,
    /background:\s*#0b1a20bf/,
    /padding:\s*6px 10px/,
    /border-radius:\s*2px/,
  );
  assert.doesNotMatch(
    water.body,
    /inset|width:\s*100%|left:\s*0|right:\s*0/,
    'the plate hugs the note instead of becoming a full-screen layer',
  );
  declares("#hero[data-effect='ocean'] .hero-source-note", mobile, /padding:\s*0 8px/);
  // From 1100px down the note takes the bottom-centre line and the picker steps above it.
  declares(
    '#hero .hero-source-note',
    tablet,
    /left:\s*clamp\(24px,\s*5vw,\s*80px\)/,
    /right:\s*clamp\(24px,\s*5vw,\s*80px\)/,
    /bottom:\s*max\(14px,\s*env\(safe-area-inset-bottom\)\)/,
    /max-width:\s*none/,
    /text-align:\s*center/,
  );
  declares(
    '#hero.has-hero-source #effect-picker',
    tablet,
    /bottom:\s*max\(52px,\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*40px\)\)/,
  );
});

test('the mobile band moves the entry under the header and keeps the source line', () => {
  declares('#hero', mobile, /min-height:\s*700px/, /padding:\s*24px/);
  declares(
    '#hero[data-effect]',
    mobile,
    /--hero-copy-top:\s*21%/,
    /--hero-copy-left:\s*24px/,
    /--hero-copy-width:\s*calc\(100% - 48px\)/,
  );
  declares('#hero .hero-copy', mobile, /text-align:\s*center/);
  declares('#hero .hero-copy h1', mobile, /font-size:\s*clamp\(34px,\s*9vw,\s*48px\)/);
  declares('#hero .hero-description', mobile, /font-size:\s*14px/);
  declares('#hero .hero-tagline', mobile, /display:\s*none/);
  declares('#hero .hero-github', mobile, /font-size:\s*11px/, /min-height:\s*44px/);
  // The entry link clears the 44px header entry below the 24px header gutter.
  const band = declares(
    '#hero .hero-bottom',
    mobile,
    /top:\s*82px/,
    /right:\s*24px/,
    /bottom:\s*auto/,
    /left:\s*auto/,
  );
  // The phone band must also name the has-hero-source combination, whose tablet rule is more
  // specific than this default, or a configured source entry would push the picker back down.
  const picker = declares(
    '#hero #effect-picker',
    mobile,
    /bottom:\s*max\(60px,\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*56px\)\)/,
  );
  assert.ok(
    picker.prelude
      .split(',')
      .map((selector) => selector.trim())
      .includes('#hero.has-hero-source #effect-picker'),
    'the phone band outranks the tablet has-hero-source rule by naming it too',
  );
  declares('#hero .hero-source-note', mobile, /bottom:\s*max\(4px,\s*env\(safe-area-inset-bottom\)\)/);
  // The entry row and the source link are both 44px touch targets on a phone; the source link
  // takes that height inside its own line so the note stays one line tall.
  declares(
    '#hero .hero-bottom .enter',
    mobile,
    /min-height:\s*44px/,
    /padding:\s*6px 0/,
    /gap:\s*8px/,
    /font-size:\s*13px/,
  );
  // The ocean entry row leaves the water on a phone and moves up into that screen's pale sky, so
  // it takes the sky's dark ink. Only the row: the note and the picker stay below the waterline
  // in the root's bright ink.
  const sky = declares(
    "#hero[data-effect='ocean'] .hero-bottom",
    mobile,
    /--hero-ink:\s*#213640/,
    /--hero-muted:\s*color-mix\(in srgb,\s*var\(--hero-ink\) 86%,\s*transparent\)/,
    /--hero-line:\s*color-mix\(in srgb,\s*var\(--hero-ink\) 24%,\s*transparent\)/,
    /color:\s*var\(--hero-ink\)/,
  );
  assert.ok(
    rules.indexOf(sky) > rules.indexOf(band),
    'the ocean sky ink lands after the shared band rule, so the moved row is left dark',
  );
  declares(
    '#hero .hero-source-note a',
    mobile,
    /display:\s*inline-flex/,
    /align-items:\s*center/,
    /min-height:\s*44px/,
    /vertical-align:\s*middle/,
  );
  // birds names the narrow scale itself: its own wider step carries the same selector, so the
  // late rule is the one that applies on a phone.
  const desktopTitle = declares(
    "#hero[data-effect='birds'] .hero-copy h1",
    null,
    /font-size:\s*clamp\(40px,\s*4\.8vw,\s*70px\)/,
  );
  const phoneTitle = declares(
    "#hero[data-effect='birds'] .hero-copy h1",
    mobile,
    /font-size:\s*clamp\(34px,\s*9vw,\s*48px\)/,
  );
  assert.ok(
    rules.indexOf(phoneTitle) > rules.indexOf(desktopTitle),
    'the narrow birds title comes last, so it wins over the wider step at equal specificity',
  );
});

test('the isaca screen keeps its header hidden but returns the entry and clears the title', () => {
  declares("#hero[data-effect='isaca'] .hero-top", null, /visibility:\s*hidden/);
  declares("#hero[data-effect='isaca'] .hero-github", null, /visibility:\s*visible/);
  declares(
    "#hero[data-effect='isaca']",
    null,
    /background:\s*#eeeae1/,
    /--hero-ink:\s*#26322f/,
    /--hero-copy-top:\s*14%/,
    /--hero-copy-left:\s*0/,
    /--hero-copy-width:\s*100%/,
  );
  declares("#hero[data-effect='isaca'] .hero-copy h1", null, /font-size:\s*clamp\(36px,\s*4vw,\s*60px\)/);
  // The two cards stay offset paper sheets in the cream/charcoal pair.
  declares(
    '.index-card',
    null,
    /border-radius:\s*4px/,
    /padding:\s*clamp\(26px,\s*4vw,\s*56px\)/,
    /background:\s*#27322f/,
    /color:\s*#f7f4ed/,
    /box-shadow:\s*0 16px 45px #17243b12/,
  );
  declares(
    ".index-card[data-front='true']",
    null,
    /transform:\s*translate\(10%,\s*10%\)/,
    /background:\s*#f7f4ed/,
    /color:\s*#27322f/,
  );
  // The card link is a touch target like the rest of the hero: a flex box around the same line,
  // 44px tall, so the front card's entry clears the bottom band on a phone.
  const cardLink = declares(
    '.index-card a',
    null,
    /display:\s*inline-flex/,
    /align-items:\s*center/,
    /min-height:\s*44px/,
    /margin-top:\s*20px/,
    /font-size:\s*15px/,
  );
  assert.doesNotMatch(cardLink.body, /inline-block/, 'the plain inline link box is gone');
  declares("#hero[data-effect='isaca'] .hero-index", null, /inset:\s*30% 12% 16%/);
  // On a narrow screen the hidden-name variant shares its top row with the entry link.
  declares(
    "#hero[data-effect='isaca'] .hero-bottom",
    mobile,
    /top:\s*24px/,
    /left:\s*24px/,
    /right:\s*auto/,
  );
  // The cards rise 4% on a phone and keep their bottom edge, so the 44px link fits inside the
  // front card while the switch and the bottom band stay exactly where they were.
  declares(
    "#hero[data-effect='isaca'] .hero-index",
    mobile,
    /inset:\s*30% 7% 21%/,
  );
  declares("#hero[data-effect='isaca']", mobile, /--hero-copy-top:\s*14%/);
});

test('the yantao notebook drops its sticker styling and keeps the code window clear', () => {
  declares(
    "#hero[data-effect='yantao']",
    null,
    /background:\s*#efeee8/,
    /--hero-ink:\s*#/,
    /--hero-copy-top:\s*30%/,
    /--hero-copy-left:\s*7%/,
    /--hero-copy-width:\s*36%/,
  );
  declares(
    "#hero[data-effect='yantao'] .hero-code-window",
    null,
    /top:\s*30%/,
    /right:\s*7%/,
    /width:\s*43%/,
    /min-height:\s*300px/,
    /border:\s*1px solid #c7cbc4/,
    /border-radius:\s*4px/,
    /box-shadow:\s*0 18px 44px #17243b14/,
  );
  declares('.hero-code-window pre', null, /font:\s*14px\/1\.9 var\(--mono\)/, /color:\s*#2f4a3c/);
  // The copy starts below the entry link and still ends before the code window.
  declares("#hero[data-effect='yantao']", mobile, /--hero-copy-top:\s*19%/);
  declares(
    "#hero[data-effect='yantao'] .hero-code-window",
    mobile,
    /top:\s*38%/,
    /right:\s*7%/,
    /width:\s*86%/,
    /min-height:\s*240px/,
  );
  declares("#hero[data-effect='yantao'] .hero-description", mobile, /display:\s*none/);
  declares("#hero[data-effect='yantao'] .eyebrow", mobile, /margin-bottom:\s*14px/);
  declares("#hero[data-effect='yantao'] .hero-copy h1", mobile, /font-size:\s*25px/);
  // The rotating title balances its breaks, so a 12-character headline does not leave its last
  // word alone; the title keeps its own clamp, line count and rotation.
  declares(
    "#hero[data-effect='yantao'] .hero-copy h1",
    null,
    /text-wrap:\s*balance/,
    /-webkit-line-clamp:\s*3/,
    /overflow:\s*hidden/,
    /font-size:\s*clamp\(28px,\s*3\.7vw,\s*56px\)/,
  );
  // The code panel keeps its own size and padding on a phone and only tightens its leading, so
  // the panel with the appended title comment ends above the picker instead of running under it.
  const code = declares(
    '.hero-code-window pre',
    mobile,
    /padding:\s*17px/,
    /font-size:\s*12px/,
    /line-height:\s*1\.65/,
  );
  assert.doesNotMatch(code.body, /max-height|overflow:\s*(?:hidden|auto|scroll)/, 'no clipping');
  assert.doesNotMatch(code.body, /font-size:\s*(?:1[01]|9)px/, 'the code is never shrunk further');
  // No framed page, no saturated blobs, no sticker label, no yellow entry badge.
  assert.doesNotMatch(stylesheet, /#ffcf5f|#87c8c6|efbcd9|8fc7c7|Arial/i, 'the old yantao styling is gone');
  for (const rule of rules) {
    if (!rule.prelude.includes("data-effect='yantao'")) continue;
    assert.doesNotMatch(rule.body, /border:\s*[5-9]px/, `${rule.prelude} keeps the hairline only`);
    assert.doesNotMatch(rule.body, /rotate\(/, `${rule.prelude} keeps the label straight`);
  }
  declares("#hero[data-effect='yantao'] .eyebrow", null, /display:\s*inline-block/);
  // The particle field behind the notebook is a source contract too: a quiet hairline web in the
  // same grey-green as the code, and half of it on the light variant.
  const effect = readFileSync(new URL('../src/client/effects/yantao.ts', import.meta.url), 'utf8');
  assert.match(effect, /number:\s*\{\s*value:\s*light\s*\?\s*14\s*:\s*28\s*\}/);
  assert.match(effect, /size:\s*\{\s*value:\s*\{\s*min:\s*0\.5,\s*max:\s*1\.1\s*\}\s*\}/);
  assert.match(effect, /paint:\s*\{\s*color:\s*\{\s*value:\s*'#7f8981'\s*\}\s*\}/);
  assert.match(effect, /move:\s*\{[^}]*speed:\s*0\.08/);
  assert.match(effect, /links:\s*\{[^}]*distance:\s*100/);
  assert.match(effect, /links:\s*\{[^}]*color:\s*'#7f8981'/);
  assert.match(effect, /links:\s*\{[^}]*opacity:\s*0\.07/);
});

test('the birds screen keeps its dark lake, poster and live layer', () => {
  declares(
    "#hero[data-effect='birds']",
    null,
    /background:\s*#07192f/,
    /--hero-ink:\s*#f2f7ff/,
    /--hero-muted:\s*color-mix\(in srgb,\s*var\(--hero-ink\) 84%,\s*transparent\)/,
    /--hero-copy-top:\s*34%/,
    /--hero-copy-left:\s*8%/,
    /--hero-copy-width:\s*84%/,
  );
  // The centred copy sits on the dark lake again, and carries the shadow that keeps it readable.
  declares(
    "#hero[data-effect='birds'] .hero-copy",
    null,
    /text-align:\s*center/,
    /text-shadow:\s*0 2px 26px #07192f/,
  );
  declares(
    "#hero[data-effect='birds'] .hero-copy h1",
    null,
    /font-style:\s*italic/,
    /font-size:\s*clamp\(40px,\s*4\.8vw,\s*70px\)/,
  );
  // The original vignette is back: a soft dark ellipse plus a top-and-bottom wash, no pale mist.
  const lake = declares(
    "#hero[data-effect='birds'] .flock-layer::after",
    null,
    /content:\s*''/,
    /position:\s*absolute/,
    /inset:\s*0/,
    /radial-gradient\(ellipse at 50% 39%,\s*#15294140 0%,\s*#1529411c 30%,\s*transparent 62%\)/,
    /linear-gradient\(to bottom,\s*#15294125,\s*transparent 20%,\s*transparent 76%,\s*#102d4b80\)/,
  );
  assert.doesNotMatch(lake.body, /rgba\(232,\s*233,\s*223/, 'the pale mist is gone');
  // The poster keeps its own frame and the restored lake palette, with no desaturation on it. The
  // private tree still references the poster image; the public export drops that one line and keeps
  // the gradient, so the frame and the palette are pinned here and the image only where it ships.
  const poster = declares(
    "#hero[data-effect='birds'] .flock-still",
    null,
    /linear-gradient\(#829fbe 0%,\s*#e7beb0 48%,\s*#8fabbf 53%,\s*#254c65 100%\)/,
  );
  assert.doesNotMatch(poster.body, /filter\s*:/, 'the poster is no longer desaturated');
  if (privateSource) {
    assert.match(
      poster.body,
      /url\('\/images\/hero\/flock-lake\.webp'\) center 54% \/ cover no-repeat/,
      'the private poster is the lake image at its own position',
    );
  } else {
    assert.match(
      poster.body,
      /background:\s*linear-gradient\(#829fbe/,
      'the public poster falls back to the gradient alone',
    );
    assert.doesNotMatch(poster.body, /url\s*\(/, 'the public poster ships no private image');
  }
  // Nothing filters the birds any more, so the live flock keeps its own colour untouched.
  const filtered = rules.filter(
    (rule) => /filter\s*:/.test(rule.body) && rule.prelude.includes('flock'),
  );
  assert.deepEqual(
    filtered.map((rule) => rule.prelude.trim()),
    [],
    'no birds rule filters the poster or the live canvas',
  );
  // The live layer still fades the poster out once the canvas is up, and a phone keeps the 34% top.
  declares(
    "#hero[data-effect='birds'] .flock-layer[data-state='live'] .flock-still",
    null,
    /visibility:\s*hidden/,
  );
  declares("#hero[data-effect='birds']", mobile, /--hero-copy-top:\s*34%/);
});

test('the pixel-cloud fallback is the full poster again: one image over its gradient', () => {
  // The static fallback paints the whole stage again; the band mask that clipped it to the live
  // cloud is gone. The private tree paints its poster image over the gradient; the public export
  // keeps the gradient alone.
  const still = declares(
    '.pixel-cloud-still',
    null,
    /radial-gradient\(ellipse at 65% 55%,\s*#3c4147,\s*#101214 48%,\s*#000 85%\)/,
  );
  assert.doesNotMatch(still.body, /mask-image/, 'the poster is no longer clipped to a band');
  if (privateSource) {
    assert.match(
      still.body,
      /url\('\/images\/hero\/pixel-cloud\.webp'\) center \/ cover no-repeat/,
      'the private fallback is the poster image over the gradient',
    );
  } else {
    assert.match(
      still.body,
      /background:\s*radial-gradient\(ellipse at 65% 55%/,
      'the public fallback starts at the gradient',
    );
    assert.doesNotMatch(still.body, /url\s*\(/, 'the public fallback ships no private image');
  }
  assert.doesNotMatch(
    still.body,
    /(?<!mask-)image:\s*url/,
    'the poster keeps its one image and gains no second one',
  );
  // The stage's own fade is the only mask left - the poster, the live canvas and its surface keep
  // none, so the cloud scene fills the frame the way the live pass does.
  const masked = rules
    .filter((rule) => /mask-image\s*:/.test(rule.body))
    .map((rule) => rule.prelude.trim())
    .sort();
  assert.deepEqual(masked, ["#hero[data-effect='miniload'] #hero-stage"]);
  declares('.pixel-cloud-surface', null, /visibility:\s*hidden/);
  declares(
    ".pixel-cloud-layer[data-state='live'] .pixel-cloud-surface",
    null,
    /visibility:\s*visible/,
  );
  // The stage's own mask, which fades the whole scene top and bottom, is untouched.
  declares(
    "#hero[data-effect='miniload'] #hero-stage",
    null,
    /mask-image:\s*linear-gradient\(to bottom,\s*#000 55%,\s*#000b 85%,\s*#0006\)/,
  );
});

test('the io724 description keeps the shared muted step and wraps its last line', () => {
  const description = declares(
    "#hero[data-effect='io724'] .hero-description",
    null,
    /letter-spacing:\s*0\.08em/,
    /text-wrap:\s*pretty/,
  );
  // The old letter-spacing stretched the line until its last word fell alone, and the extra
  // opacity dimmed the description on top of the shared muted step - both are gone.
  assert.doesNotMatch(description.body, /opacity/, 'the description is not dimmed a second time');
  assert.doesNotMatch(description.body, /letter-spacing:\s*0?\.1[6-9]em|letter-spacing:\s*0?\.2em/);
  // With the opacity gone it reads at the shared step of the ink, so the screen must not bring
  // its own ratio back through the variable either.
  for (const rule of selectors("#hero[data-effect='io724']", null))
    assert.doesNotMatch(rule.body, /--hero-muted/, 'io724 keeps the shared muted step');
});
