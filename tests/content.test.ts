import test from 'node:test';
import assert from 'node:assert/strict';
import {
  articleSchema,
  relationsSchema,
  published,
  neighbors,
  validateReferences,
  type Article,
} from '../src/domain/content';
import { enclosure, httpUrl } from '../scripts/build-radio';
const article = (id: string, date: string, category = 'daily', draft = false): Article => ({
  id,
  data: articleSchema.parse({ title: id, description: id, date, category, draft }),
});
test('Publication order, category neighbors, fallback, and draft boundary', () => {
  const entries = [
    article('old', '2024-01-01'),
    article('middle', '2024-02-01', 'travel'),
    article('new', '2024-03-01'),
    article('draft', '2025-01-01', 'daily', true),
  ];
  assert.deepEqual(
    published(entries).map((a) => a.id),
    ['new', 'middle', 'old'],
  );
  assert.equal(neighbors(entries, 'new').older?.id, 'old');
  assert.equal(neighbors(entries, 'middle').older?.id, 'old');
  assert.equal(neighbors(entries, 'middle').newer?.id, 'new');
  assert.deepEqual(neighbors(entries, 'draft'), { newer: undefined, older: undefined });
  assert.equal(entries[0].id, 'old');
});
test('Content references reject unknown and duplicate identifiers, including drafts', () => {
  const entries = [article('one', '2024-01-01')],
    categories = [{ slug: 'daily' }],
    places = { type: 'FeatureCollection' as const, features: [] };
  assert.doesNotThrow(() => validateReferences(entries, categories, places, []));
  assert.throws(() => validateReferences(entries, [], places, []), /Unknown category/);
  assert.throws(
    () => validateReferences([...entries, ...entries], categories, places, []),
    /Duplicate/,
  );
  assert.throws(
    () =>
      validateReferences(entries, categories, places, [
        { source: 'one', target: 'missing', label: 'related', status: 'definite' },
      ]),
    /Unknown relation/,
  );
  const draft = article('draft', '2025-01-01', 'daily', true);
  draft.data.places = ['missing'];
  assert.throws(() => validateReferences([draft], categories, places, []), /Unknown place/);
});
test('RSS handles arrays, XML entities, missing audio, and unsafe URL protocols', () => {
  assert.equal(
    enclosure(
      '<rss><channel><item><title>Skip</title></item><item><enclosure type="audio/mpeg" url="https://example.com/play?a=1&amp;b=2"/></item></channel></rss>',
    ),
    'https://example.com/play?a=1&b=2',
  );
  assert.throws(() => enclosure('<rss><channel/></rss>'), /No audio/);
  assert.throws(() => enclosure('<rss>'), /Invalid/);
  assert.throws(() => httpUrl('javascript:alert(1)'));
  assert.throws(() => httpUrl('https://user:secret@example.com'));
});

test('Article picture output includes real AVIF/WebP files and retains dimensions', async () => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { default: sharp } = await import('sharp');
  const { pictures } = await import('../scripts/pictures');
  const root = await mkdtemp(join(tmpdir(), 'blog-pictures-'));
  try {
    await mkdir(join(root, '_astro'));
    await mkdir(join(root, 'blog'));
    await sharp({ create: { width: 20, height: 10, channels: 3, background: '#f4f0e7' } })
      .webp()
      .toFile(join(root, '_astro/test.webp'));
    await writeFile(
      join(root, 'blog/index.html'),
      '<img alt="test" loading="lazy" width="20" height="10" src="/_astro/test.webp">',
    );
    await pictures(join(root, 'blog'), root);
    const html = await readFile(join(root, 'blog/index.html'), 'utf8');
    assert.match(html, /<picture><source type="image\/avif"/);
    assert.match(html, /<source type="image\/webp"/);
    assert.match(html, /loading="lazy" width="20" height="10"/);
    assert.equal((await sharp(join(root, '_astro/test.webp.20.avif')).metadata()).width, 20);
    assert.equal((await sharp(join(root, '_astro/test.webp.20.webp')).metadata()).height, 10);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Lab build copies relative assets, injects return links, and rejects traversal', async () => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = await mkdtemp(join(tmpdir(), 'blog-lab-'));
  const script = resolve('scripts/build-lab.ts');
  const env = {
    ...process.env,
    SITE_URL: 'http://localhost:8080',
    LAB_ORIGIN: 'http://localhost:8081',
    TOOL_JSON_URL: '',
    TOOL_TIMER_URL: '',
    TOOL_TEXT_URL: '',
    LAB_PAPER_URL: '',
  };
  const run = () =>
    spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), script], {
      cwd: root,
      env,
      encoding: 'utf8',
    });
  try {
    await mkdir(join(root, 'examples'));
    for (const name of ['json', 'timer', 'text', 'paper'])
      await writeFile(
        join(root, `examples/${name}.html`),
        '<a href="__SITE_RETURN__">Return</a><link href="style.css" rel="stylesheet">',
      );
    await writeFile(join(root, 'examples/style.css'), 'body { color: black }');
    assert.equal(run().status, 0);
    assert.match(
      await readFile(join(root, 'lab-dist/tools/json/index.html'), 'utf8'),
      /http:\/\/localhost:8080\/tools\//,
    );
    assert.match(
      await readFile(join(root, 'lab-dist/tools/json/style.css'), 'utf8'),
      /color: black/,
    );
    await writeFile(join(root, 'outside.css'), 'private');
    await writeFile(
      join(root, 'examples/json.html'),
      '<link href="../outside.css" rel="stylesheet">',
    );
    const rejected = run();
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /Asset path escapes/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Relation endpoints accept published Unicode IDs and reject URL separators', () => {
  const edge = {
    source: '教程（一）-搭建博客',
    target: '教程（二）',
    label: '文中引用',
    status: 'definite',
  };
  assert.equal(relationsSchema.parse([edge])[0].source, edge.source);
  for (const source of ['', '../article', 'article?x', 'article#x', 'article\\x'])
    assert.equal(relationsSchema.safeParse([{ ...edge, source }]).success, false);
});
