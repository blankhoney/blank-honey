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
import { config } from '../src/config';
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

test('Lab build bundles tool pages, injects return links, and rejects traversal', async () => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const { tools, experiments } = config;
  const root = await mkdtemp(join(tmpdir(), 'blog-lab-'));
  const script = resolve('scripts/build-lab.ts');
  const env = {
    ...process.env,
    SITE_URL: 'http://localhost:8080',
    LAB_ORIGIN: 'http://localhost:8081',
    LAB_PAPER_URL: '',
    ...Object.fromEntries(tools.map((tool) => [tool.urlEnv, ''])),
  };
  const run = () =>
    spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), script], {
      cwd: root,
      env,
      encoding: 'utf8',
    });
  try {
    // The lab build reads config for its slugs but the sources from the working
    // directory, so a minimal tool per registered slug stands in for the real ones.
    await mkdir(join(root, 'src/tools/shared'), { recursive: true });
    await writeFile(join(root, 'src/tools/shared/style.css'), 'body { color: black }');
    for (const tool of tools) {
      await mkdir(join(root, 'src/tools', tool.slug), { recursive: true });
      await writeFile(
        join(root, 'src/tools', tool.slug, 'index.html'),
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
          `<title>${tool.name}</title><link href="../shared/style.css" rel="stylesheet"></head>` +
          `<body data-tool="${tool.slug}"><a class="back-link" href="__SITE_RETURN__">Return</a>` +
          '<script type="module" src="./main.ts"></script></body></html>',
      );
      await writeFile(
        join(root, 'src/tools', tool.slug, 'main.ts'),
        `document.body.dataset.tool = ${JSON.stringify(tool.slug)};\n`,
      );
    }
    await mkdir(join(root, 'examples'));
    for (const experiment of experiments)
      await writeFile(
        join(root, experiment.html),
        '<a href="__SITE_RETURN__">Return</a><link href="style.css" rel="stylesheet">',
      );
    await writeFile(join(root, 'examples/style.css'), 'body { color: black }');
    const built = run();
    assert.equal(built.status, 0, built.stderr);
    for (const tool of tools) {
      const html = await readFile(join(root, 'lab-dist/tools', tool.slug, 'index.html'), 'utf8');
      assert.match(html, /http:\/\/localhost:8080\/tools\//);
      assert.doesNotMatch(html, /__SITE_RETURN__/);
      assert.doesNotMatch(html, /\.\.\/shared\/style\.css/);
      const assets = [...html.matchAll(/(?:src|href)="(\.\.\/assets\/[^"?#]+)"/g)].map(
        (match) => match[1],
      );
      assert.ok(
        assets.some((name) => name.endsWith('.css')),
        `${tool.slug} has bundled CSS`,
      );
      assert.ok(
        assets.some((name) => name.endsWith('.js')),
        `${tool.slug} has bundled JS`,
      );
      for (const asset of assets)
        assert.ok((await readFile(resolve(root, 'lab-dist/tools', tool.slug, asset))).length > 0);
    }
    for (const experiment of experiments)
      assert.match(
        await readFile(join(root, 'lab-dist/experiments', experiment.slug, 'index.html'), 'utf8'),
        /http:\/\/localhost:8080\/lab\//,
      );
    assert.match(
      await readFile(join(root, 'lab-dist/experiments/paper/style.css'), 'utf8'),
      /color: black/,
    );
    // The static experiment copy still refuses to follow a reference out of its own
    // directory, even though the tool build has its own boundary.
    await writeFile(join(root, 'outside.css'), 'private');
    await writeFile(
      join(root, 'examples/paper.html'),
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
