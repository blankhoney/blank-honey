import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { config } from '../src/config';

/* The showcase hero owns two optional entries: the profile in the header and the source note. */
const page = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../src/styles/hero.css', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
// The neutral public tree drops the private export path entirely; that is a valid state.
const templatePath = new URL('../scripts/template.mjs', import.meta.url);
const template = existsSync(templatePath) ? readFileSync(templatePath, 'utf8') : '';

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

/** Rules for one exact selector, scoped to a breakpoint block or to the top level. */
function selectors(prelude: string, media: RegExp | null = null): CssRule[] {
  return rules.filter(
    (rule) =>
      rule.prelude === prelude &&
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

test('the header pill reads as a control and keeps a visible keyboard focus ring', () => {
  declares(
    '#hero .hero-top-links',
    null,
    /display:\s*inline-flex/,
    /align-items:\s*center/,
    /gap:\s*18px/,
  );
  declares(
    '#hero .hero-github',
    null,
    /display:\s*inline-flex/,
    /align-items:\s*center/,
    /gap:\s*8px/,
    /min-height:\s*44px/,
    /padding:\s*0 12px/,
    /border:\s*1px solid color-mix\([^)]*currentColor 25%[^)]*\)/,
    /border-radius:\s*999px/,
    /background:\s*color-mix\([^)]*currentColor 5%[^)]*\)/,
    /color:\s*inherit/,
    /font-size:\s*12px/,
    /letter-spacing:\s*0\.02em/,
  );
  declares('#hero .hero-github:hover', null, /background:\s*color-mix\([^)]*currentColor 12%/);
  declares(
    '#hero .hero-github:focus-visible',
    null,
    /outline:\s*2px solid currentColor/,
    /outline-offset:\s*4px/,
  );
  declares('#hero .hero-github svg', null, /width:\s*18px/, /height:\s*18px/);
  // The 44px pill needs the name and the entry centred against each other.
  declares('#hero .hero-top', null, /z-index:\s*5/, /align-items:\s*center/);
  const controls = rules.filter((rule) =>
    /hero-github|hero-source-note|hero-top-links|hero-tagline/.test(rule.prelude),
  );
  assert.ok(controls.length >= 6, 'expected the new controls to be styled');
  for (const rule of controls) assert.doesNotMatch(rule.body, /animation|transition/);
});

test('the source note shares the bottom band and the picker steps up for it', () => {
  const note = declares(
    '#hero .hero-source-note',
    null,
    /position:\s*absolute/,
    /left:\s*16px/,
    /right:\s*16px/,
    /bottom:\s*max\(14px,\s*env\(safe-area-inset-bottom\)\)/,
    /z-index:\s*5/,
    /margin:\s*0/,
    /text-align:\s*center/,
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
  declares(
    '#hero.has-hero-source #effect-picker',
    null,
    /bottom:\s*max\(54px,\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*40px\)\)/,
  );
});

test('the mobile header hides the tagline and keeps the entry link clear of the GitHub pill', () => {
  declares('#hero .hero-tagline', mobile, /display:\s*none/);
  declares('#hero .hero-github', mobile, /font-size:\s*(?:11px|12px)/, /min-height:\s*44px/);
  // The entry link clears the 44px pill with a 10px gap.
  declares(
    '#hero .hero-bottom',
    mobile,
    /top:\s*82px/,
    /right:\s*24px/,
    /bottom:\s*auto/,
    /left:\s*auto/,
  );
});

test('the isaca screen keeps its header hidden but returns the entry and clears the title', () => {
  declares("#hero[data-effect='isaca'] .hero-top", null, /visibility:\s*hidden/);
  declares("#hero[data-effect='isaca'] .hero-github", null, /visibility:\s*visible/);
  declares("#hero[data-effect='isaca'] .hero-copy", null, /top:\s*14%/);
  // On a narrow screen the hidden-name variant shares its top row with the entry link.
  declares(
    "#hero[data-effect='isaca'] .hero-bottom",
    mobile,
    /top:\s*28px/,
    /left:\s*24px/,
    /right:\s*auto/,
  );
  declares("#hero[data-effect='isaca'] .hero-index", mobile, /inset:\s*30% 4% 20%/);
  declares("#hero[data-effect='isaca'] .hero-index", null, /inset:\s*25% 8% 13%/);
});

test('the yantao code window clears the picker on a narrow screen', () => {
  // The copy starts below the entry link and still ends before the code window.
  declares("#hero[data-effect='yantao'] .hero-copy", mobile, /top:\s*21%/);
  declares("#hero[data-effect='yantao'] .hero-code-window", mobile, /top:\s*37%/);
});
