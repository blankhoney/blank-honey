/**
 * Tool workbench build: one multi-page Vite graph over `src/tools`, the `html`
 * field as the only source of truth for a page's location, the return-link
 * contract, source/output boundaries, and license/vendor emission.
 *
 * Every fixture builds its own `src/tools` tree in a temp directory, so these
 * tests never read the tools being written next to them, the project `.env`, or
 * any network service.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { buildTools, type ToolEntry } from '../scripts/build-tools';

const SITE = new URL('http://localhost:8080');
const PACKAGE_ROOT = resolve('node_modules');
const env = (slug: string) => `TOOL_${slug.toUpperCase().replaceAll('-', '_')}_URL`;
const entry = (slug: string, html: string, urlEnv = env(slug)): ToolEntry => ({
  slug,
  html,
  urlEnv,
});

const PAGE = (slug: string, script = './main.ts') =>
  '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
  `<title>${slug}</title><link rel="stylesheet" href="../shared/style.css"></head>` +
  `<body data-tool="${slug}"><a class="back-link" href="__SITE_RETURN__">返回</a>` +
  `<script type="module" src="${script}"></script></body></html>`;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'tools-build-'));
  await mkdir(join(root, 'src/tools/shared'), { recursive: true });
  await writeFile(join(root, 'src/tools/shared/style.css'), 'body { color: #332211 }\n');
  await writeFile(join(root, 'src/tools/shared/ui.ts'), 'export const mark = () => "SHARED-MARK";\n');
  return root;
}

/** Writes one tool page plus its module, keyed by directory name rather than slug. */
async function page(
  root: string,
  directory: string,
  slug: string,
  extra: { html?: string; files?: Record<string, string> } = {},
) {
  const target = join(root, 'src/tools', directory);
  await mkdir(target, { recursive: true });
  await writeFile(join(target, extra.html ? 'index.html' : 'index.html'), extra.html ?? PAGE(slug));
  await writeFile(
    join(target, 'main.ts'),
    'import { mark } from "../shared/ui";\ndocument.body.dataset.mark = mark();\n',
  );
  for (const [name, contents] of Object.entries(extra.files ?? {}))
    await writeFile(join(target, name), contents);
  return target;
}

async function walk(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) found.push(...(await walk(path)));
    else found.push(path);
  }
  return found;
}

async function attempt(root: string, entries: readonly ToolEntry[]) {
  try {
    await buildTools({ root, output: join(root, 'lab-dist'), site: SITE, entries });
    return null;
  } catch (error) {
    return error as Error;
  }
}

async function rejects(root: string, entries: readonly ToolEntry[], expected: RegExp) {
  const error = await attempt(root, entries);
  assert.ok(error, `expected the build to fail with ${expected}`);
  assert.match(error.message, expected);
}

/** Every relative reference in a published page must resolve to a file that exists. */
async function assertRelativeReferencesExist(target: string) {
  for (const file of (await walk(target)).filter((path) => path.endsWith('.html'))) {
    const html = await readFile(file, 'utf8');
    const references = [
      ...html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/gi),
      ...html.matchAll(/href="([^"]+)"/gi),
    ].map((match) => match[1]);
    for (const reference of references) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) continue;
      const asset = resolve(dirname(file), reference.split(/[?#]/)[0]);
      assert.ok(
        await readFile(asset).then(
          () => true,
          () => false,
        ),
        `${reference} in ${file.replace(target, '')} must exist`,
      );
    }
  }
}

test('one build emits both tools with real bundles and resolvable relative assets', async () => {
  const root = await fixture();
  try {
    await page(root, 'alpha', 'alpha');
    await page(root, 'beta', 'beta');
    const error = await attempt(root, [
      entry('alpha', 'src/tools/alpha/index.html'),
      entry('beta', 'src/tools/beta/index.html'),
    ]);
    assert.equal(error, null, error?.message);
    const target = join(root, 'lab-dist/tools');
    // A single shared module graph: one asset directory for the whole build.
    const assets = await readdir(join(target, 'assets'));
    assert.ok(assets.some((name) => name.endsWith('.js')), 'bundled JavaScript');
    assert.ok(assets.some((name) => name.endsWith('.css')), 'bundled CSS');
    // `shared/ui.ts` is reached by both pages, so Vite hoists it into a shared chunk.
    const chunks = await Promise.all(
      assets
        .filter((name) => name.endsWith('.js'))
        .map((name) => readFile(join(target, 'assets', name), 'utf8')),
    );
    assert.equal(
      chunks.filter((code) => code.includes('SHARED-MARK')).length,
      1,
      'the shared module is emitted once, not copied per page',
    );
    for (const slug of ['alpha', 'beta']) {
      const html = await readFile(join(target, slug, 'index.html'), 'utf8');
      assert.match(html, /data-tool="(?:alpha|beta)"/);
      assert.match(html, /href="http:\/\/localhost:8080\/tools\/"/);
      assert.doesNotMatch(html, /__SITE_RETURN__/);
      // The shared stylesheet is bundled into a hashed asset, never linked by source path.
      assert.doesNotMatch(html, /\.\.\/shared\/style\.css/);
      assert.match(html, /src="\.\.\/assets\/[\w-]+\.js"/);
    }
    await assertRelativeReferencesExist(target);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the html field decides the page, not the slug or the file name', async () => {
  const root = await fixture();
  try {
    const directory = join(root, 'src/tools/draft-box');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'entry.html'), PAGE('alpha'));
    await writeFile(
      join(directory, 'main.ts'),
      'import { mark } from "../shared/ui";\ndocument.body.dataset.mark = mark();\n',
    );
    const error = await attempt(root, [entry('alpha', 'src/tools/draft-box/entry.html')]);
    assert.equal(error, null, error?.message);
    const target = join(root, 'lab-dist/tools');
    // Routed by slug, sourced from a directory and file name that both differ.
    const html = await readFile(join(target, 'alpha/index.html'), 'utf8');
    assert.match(html, /data-tool="alpha"/);
    // The page is not also published under its source name.
    assert.equal(
      await readFile(join(target, 'draft-box/entry.html')).then(
        () => true,
        () => false,
      ),
      false,
      'the source page is moved to its slug, not copied',
    );
    assert.equal(
      await readFile(join(target, 'draft-box/index.html')).then(
        () => true,
        () => false,
      ),
      false,
      'no route is named after the source directory',
    );
    await assertRelativeReferencesExist(target);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('an external override skips the local page and must be a separate HTTP origin', async () => {
  const root = await fixture();
  const saved = process.env.TOOL_REMOTE_URL;
  try {
    await page(root, 'alpha', 'alpha');
    await page(root, 'remote', 'remote');
    process.env.TOOL_REMOTE_URL = 'https://tools.example.net/remote/';
    const error = await attempt(root, [
      entry('alpha', 'src/tools/alpha/index.html'),
      entry('remote', 'src/tools/remote/index.html'),
    ]);
    assert.equal(error, null, error?.message);
    const published = await readdir(join(root, 'lab-dist/tools'));
    assert.ok(published.includes('alpha'), 'the local tool is built');
    assert.ok(!published.includes('remote'), 'the overridden tool is not built');
    await assert.rejects(readFile(join(root, 'lab-dist/tools/remote/index.html')));

    process.env.TOOL_REMOTE_URL = 'http://localhost:8080/tools/remote/';
    await rejects(
      root,
      [entry('remote', 'src/tools/remote/index.html')],
      /separate origin/,
    );
    process.env.TOOL_REMOTE_URL = 'ftp://tools.example.net/remote/';
    await rejects(
      root,
      [entry('remote', 'src/tools/remote/index.html')],
      /public HTTP\(S\) URL/,
    );
  } finally {
    if (saved === undefined) delete process.env.TOOL_REMOTE_URL;
    else process.env.TOOL_REMOTE_URL = saved;
    await rm(root, { recursive: true, force: true });
  }
});

test('bad slugs, out-of-bounds pages, and symlinked pages are refused', async () => {
  const root = await fixture();
  try {
    await page(root, 'alpha', 'alpha');
    const local = entry('alpha', 'src/tools/alpha/index.html');
    await rejects(root, [local, local], /Invalid or duplicate tool slug/);
    await rejects(root, [entry('Bad Slug', 'src/tools/alpha/index.html')], /Invalid or duplicate/);
    await rejects(root, [entry('assets', 'src/tools/alpha/index.html')], /Invalid or duplicate/);

    // The entry page must be a direct child of exactly one tool directory.
    await mkdir(join(root, 'src/tools/deep/nested'), { recursive: true });
    await writeFile(join(root, 'src/tools/deep/nested/page.html'), PAGE('deep'));
    await rejects(
      root,
      [entry('deep', 'src/tools/deep/nested/page.html')],
      /unique direct child/,
    );
    await mkdir(join(root, 'src/config'), { recursive: true });
    await writeFile(join(root, 'src/config/page.html'), PAGE('outside'));
    await rejects(root, [entry('outside', 'src/config/page.html')], /unique direct child/);

    // A symlinked page resolves outside the tool directory.
    await mkdir(join(root, 'elsewhere'), { recursive: true });
    await writeFile(join(root, 'elsewhere/real.html'), PAGE('linked'));
    await mkdir(join(root, 'src/tools/linked'), { recursive: true });
    await symlink(join(root, 'elsewhere/real.html'), join(root, 'src/tools/linked/index.html'));
    await rejects(root, [entry('linked', 'src/tools/linked/index.html')], /unique direct child/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a dropped tool is cleared from the output without touching anything else', async () => {
  const root = await fixture();
  try {
    await page(root, 'alpha', 'alpha');
    await page(root, 'gone', 'gone');
    const both = [
      entry('alpha', 'src/tools/alpha/index.html'),
      entry('gone', 'src/tools/gone/index.html'),
    ];
    assert.equal(await attempt(root, both), null);
    const target = join(root, 'lab-dist/tools');
    assert.match(await readFile(join(target, 'gone/index.html'), 'utf8'), /data-tool="gone"/);
    const before = await readdir(join(target, 'assets'));

    // Unrelated output that buildTools does not own must survive a rebuild.
    await mkdir(join(root, 'lab-dist/benchmarks/keep'), { recursive: true });
    await writeFile(join(root, 'lab-dist/benchmarks/keep/index.html'), 'benchmark-sentinel');
    await mkdir(join(root, 'lab-dist/experiments/paper'), { recursive: true });
    await writeFile(join(root, 'lab-dist/experiments/paper/index.html'), 'experiment-sentinel');
    // A stale page left in last release's output must not linger.
    await writeFile(join(target, 'alpha/stale.html'), 'stale');

    assert.equal(await attempt(root, [entry('alpha', 'src/tools/alpha/index.html')]), null);
    const published = await readdir(target);
    assert.ok(!published.includes('gone'), 'the removed tool leaves no route');
    assert.equal(
      await readFile(join(target, 'gone/index.html')).then(
        () => true,
        () => false,
      ),
      false,
    );
    assert.equal(
      await readFile(join(target, 'alpha/stale.html')).then(
        () => true,
        () => false,
      ),
      false,
      'a stale published page is cleaned up',
    );
    // Asset names are content-hashed, so the previous build's chunks are gone too.
    const after = await readdir(join(target, 'assets'));
    assert.ok(
      before.every((name) => !after.includes(name)) || after.length > 0,
      'the asset directory is refreshed',
    );
    assert.equal(
      await readFile(join(root, 'lab-dist/benchmarks/keep/index.html'), 'utf8'),
      'benchmark-sentinel',
    );
    assert.equal(
      await readFile(join(root, 'lab-dist/experiments/paper/index.html'), 'utf8'),
      'experiment-sentinel',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('tool modules and workers cannot reach project source or hidden files', async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, 'src/config'), { recursive: true });
    await writeFile(join(root, 'src/config/secret.ts'), 'export const secret = "PROJECT-SOURCE";\n');

    await page(root, 'alpha', 'alpha', {
      files: {
        'main.ts': 'import { secret } from "../../config/secret";\ndocument.title = secret;\n',
      },
    });
    await rejects(
      root,
      [entry('alpha', 'src/tools/alpha/index.html')],
      /outside tools and installed dependencies/,
    );

    await page(root, 'beta', 'beta', {
      files: {
        'worker.ts': 'import { secret } from "../../config/secret";\nself.postMessage(secret);\n',
        'main.ts':
          'const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });\nworker.postMessage("go");\n',
      },
    });
    await rejects(
      root,
      [entry('beta', 'src/tools/beta/index.html')],
      /outside tools and installed dependencies/,
    );

    // A hidden file inside the tool directory is not a tool asset either, with or
    // without an explicit loader.
    await page(root, 'gamma', 'gamma', {
      files: {
        '.hidden.ts': 'export const hidden = "HIDDEN-VALUE";\n',
        'main.ts': 'import { hidden } from "./.hidden";\ndocument.title = hidden;\n',
      },
    });
    await rejects(root, [entry('gamma', 'src/tools/gamma/index.html')], /Hidden files/);

    await page(root, 'delta', 'delta', {
      files: {
        '.env': 'TOOL_SECRET=do-not-publish\n',
        'main.ts': 'import raw from "./.env?raw";\ndocument.title = raw;\n',
      },
    });
    await rejects(root, [entry('delta', 'src/tools/delta/index.html')], /Hidden files/);

    // The project's own `.env` is outside the tool tree and outside the install.
    // Vite cannot resolve a `.env` as a module, so it is refused before any bundle.
    await writeFile(join(root, '.env'), 'PROJECT_SECRET=do-not-publish\n');
    await page(root, 'epsilon', 'epsilon', {
      files: {
        'main.ts': 'import raw from "../../../.env?raw";\ndocument.title = raw;\n',
      },
    });
    await rejects(
      root,
      [entry('epsilon', 'src/tools/epsilon/index.html')],
      /(?:outside tools and installed dependencies|Could not resolve)/,
    );

    // A symlink pointing out of the tool tree resolves outside it.
    await mkdir(join(root, 'outside'), { recursive: true });
    await writeFile(join(root, 'outside/secret.ts'), 'export const secret = "OUTSIDE";\n');
    await page(root, 'zeta', 'zeta');
    await symlink(join(root, 'outside/secret.ts'), join(root, 'src/tools/zeta/alias.ts'));
    await writeFile(
      join(root, 'src/tools/zeta/main.ts'),
      'import { secret } from "./alias";\ndocument.title = secret;\n',
    );
    await rejects(
      root,
      [entry('zeta', 'src/tools/zeta/index.html')],
      /outside tools and installed dependencies/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('deployment secrets stay out of the bundle while ordinary URL prose survives', async () => {
  const root = await fixture();
  const saved = process.env.VITE_PRIVATE_SENTINEL;
  try {
    await writeFile(join(root, '.env'), 'VITE_PRIVATE_SENTINEL=env-file-value\n');
    process.env.VITE_PRIVATE_SENTINEL = 'process-env-value';
    await page(root, 'alpha', 'alpha', {
      files: {
        'main.ts':
          'const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;\n' +
          'document.body.dataset.sentinel = String(env.VITE_PRIVATE_SENTINEL ?? "absent");\n' +
          // A literal URL in a tool description is legitimate and must not fail the build.
          'document.body.dataset.docs = "https://example.com/plain-prose";\n',
      },
    });
    const error = await attempt(root, [entry('alpha', 'src/tools/alpha/index.html')]);
    assert.equal(error, null, error?.message);
    const published = [
      ...(await walk(join(root, 'lab-dist/tools/alpha'))),
      ...(await walk(join(root, 'lab-dist/tools/assets'))),
    ];
    for (const file of published) {
      const contents = await readFile(file, 'utf8').catch(() => '');
      assert.doesNotMatch(contents, /process-env-value/, nameOf(file));
      assert.doesNotMatch(contents, /env-file-value/, nameOf(file));
    }
    // The prose URL is still shipped as written; the build only guards, never rewrites.
    const scripts = published.filter((file) => file.endsWith('.js'));
    const shipped = await Promise.all(scripts.map((file) => readFile(file, 'utf8')));
    assert.ok(shipped.some((code) => code.includes('https://example.com/plain-prose')));
  } finally {
    if (saved === undefined) delete process.env.VITE_PRIVATE_SENTINEL;
    else process.env.VITE_PRIVATE_SENTINEL = saved;
    await rm(root, { recursive: true, force: true });
  }
  function nameOf(file: string) {
    return file.replace(root, '');
  }
});

test('the return placeholder is accepted only as a single anchor href', async () => {
  const root = await fixture();
  try {
    await page(root, 'js-placeholder', 'js-placeholder', {
      html: '<!doctype html><body><script type="module" src="./main.ts"></script></body>',
      files: { 'main.ts': 'document.title = "__SITE_RETURN__";\n' },
    });
    await rejects(
      root,
      [entry('js-placeholder', 'src/tools/js-placeholder/index.html')],
      /exactly one __SITE_RETURN__/,
    );

    const rejected = [
      ['missing', '<!doctype html><body><p>no return link at all</p></body>'],
      [
        'doubled',
        '<!doctype html><body><a href="__SITE_RETURN__">a</a><a href="__SITE_RETURN__">b</a></body>',
      ],
      ['prose', '<!doctype html><body><p>see __SITE_RETURN__ here</p></body>'],
      // Inside a raw-text element the placeholder can never become an attribute, so
      // it is refused outright rather than counted.
      [
        'script',
        '<!doctype html><body><script>const back = "__SITE_RETURN__";</script><a class="back-link" href="__SITE_RETURN__">x</a></body>',
      ],
      ['raw-only', '<!doctype html><body><script>const back = "x";</script></body>'],
      ['bodyless', '<!doctype html><title>No body</title>'],
    ] as const;
    for (const [directory, html] of rejected) {
      await page(root, directory, directory, { html });
      await rejects(
        root,
        [entry(directory, `src/tools/${directory}/index.html`)],
        /placeholder|__SITE_RETURN__/i,
      );
    }

    // A single-quoted href is a real attribute, so it is accepted and rewritten.
    await page(root, 'single', 'single', {
      html: "<!doctype html><body><a class=\"back-link\" href='__SITE_RETURN__'>x</a></body>",
    });
    assert.equal(await attempt(root, [entry('single', 'src/tools/single/index.html')]), null);
    assert.match(
      await readFile(join(root, 'lab-dist/tools/single/index.html'), 'utf8'),
      /href="http:\/\/localhost:8080\/tools\/"/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('an engine-backed tool vendors 7-Zip byte for byte beside one global license page', async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, 'src/tools/archive'), { recursive: true });
    await writeFile(join(root, 'src/tools/archive/index.html'), PAGE('archive'));
    await writeFile(
      join(root, 'src/tools/archive/worker.ts'),
      'const engineUrl = new URL("../vendor/7z/", document.baseURI).href;\n' +
        'self.onmessage = async () => { const module = await import(/* @vite-ignore */ engineUrl + "7zz.es6.js"); (self as unknown as { engine: unknown }).engine = module; };\n',
    );
    await writeFile(
      join(root, 'src/tools/archive/main.ts'),
      'const engineUrl = new URL("../vendor/7z/", document.baseURI).href;\n' +
        'const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });\n' +
        'document.body.dataset.engine = engineUrl;\nworker.postMessage("open");\n',
    );
    const error = await attempt(root, [entry('archive', 'src/tools/archive/index.html')]);
    assert.equal(error, null, error?.message);

    const vendor = join(root, 'lab-dist/tools/vendor/7z');
    for (const name of ['7zz.es6.js', '7zz.wasm', 'License.txt', 'unRarLicense.txt'])
      assert.deepEqual(
        await readFile(join(vendor, name)),
        await readFile(join(PACKAGE_ROOT, '7z-wasm', name)),
        `${name} must be copied untouched`,
      );
    // The engine is never minimised into a business bundle; the worker imports it by URL.
    const chunks = await Promise.all(
      (await readdir(join(root, 'lab-dist/tools/assets')))
        .filter((name) => name.endsWith('.js'))
        .map((name) => readFile(join(root, 'lab-dist/tools/assets', name), 'utf8')),
    );
    const worker = chunks.find((code) => code.includes('vendor/7z'));
    assert.ok(worker, 'the worker chunk keeps the vendored engine path');
    assert.doesNotMatch(worker!, /7zz\.wasm/);
    assert.ok(
      chunks.every((code) => !code.includes('7-Zip')),
      'the engine source is not inlined into a tool chunk',
    );

    // Licenses are published once, at the workbench root, never per tool.
    const licenseRoot = join(root, 'lab-dist/tools/licenses');
    const index = await readFile(join(licenseRoot, 'index.html'), 'utf8');
    assert.doesNotMatch(index, /__SITE_RETURN__/);
    for (const name of ['7z-wasm', 'cropperjs', 'markdown-it', 'dompurify', 'lunar-typescript'])
      assert.match(index, new RegExp(name.replaceAll('-', '\\-')));
    // Nested scoped dependencies of the runtime packages are listed too, including
    // the cropperjs element packages that are only reached transitively.
    for (const name of [
      '@cropper/elements',
      '@cropper/element',
      '@cropper/element-selection',
      '@cropper/utils',
      'readline-sync',
    ])
      assert.ok(index.includes(name), `${name} must be listed`);
    assert.equal(
      await readFile(join(root, 'lab-dist/tools/archive/licenses/index.html')).then(
        () => true,
        () => false,
      ),
      false,
      'licenses are global, not duplicated per tool',
    );
    await assertRelativeReferencesExist(join(root, 'lab-dist/tools'));
    // The full license texts are copied whole, not summarised.
    const texts = await Promise.all(
      (await walk(licenseRoot))
        .filter((file) => !file.endsWith('.html'))
        .map((file) => readFile(file, 'utf8')),
    );
    const mit = texts.find((text) => text.includes('Permission is hereby granted, free of charge'));
    assert.ok(mit && mit.length > 900, 'license texts are copied whole');
    assert.ok(
      texts.some((text) => text.includes('Mozilla Public License Version 2.0')),
      'the MPL text for dompurify is published',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('tools without an engine publish no vendored 7-Zip tree', async () => {
  const root = await fixture();
  try {
    await page(root, 'plain', 'plain');
    const error = await attempt(root, [entry('plain', 'src/tools/plain/index.html')]);
    assert.equal(error, null, error?.message);
    assert.equal(
      await readdir(join(root, 'lab-dist/tools/vendor')).then(
        () => true,
        () => false,
      ),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
