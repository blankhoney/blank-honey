import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { experimentsSchema, type Experiment } from '../src/domain/experiments';
import { experimentFiles } from '../src/application/experiments';
import { config } from '../src/config';

const benchmark: Experiment = {
  slug: 'sample',
  title: 'Sample',
  description: 'Fixture',
  directory: 'examples/benchmarks/sample',
  entry: 'index.html',
  prompt: 'First\r\nSecond\r\n',
  modelId: 'fixture-model',
  reasoningEffort: 'high',
  generatedAt: '2026-09-14',
  author: { name: 'Fixture', sourceUrl: 'https://example.com/source' },
  promptVersion: 'fixture',
  run: { singleUserTask: true, agentTools: false, selfCheck: 'Not run' },
  observations: [],
};

test('benchmark manifest rejects escaping paths, duplicate identifiers and credential URLs', () => {
  assert.equal(experimentsSchema.parse([benchmark])[0].prompt, benchmark.prompt);
  assert.equal(
    experimentsSchema.safeParse([{ ...benchmark, preview: '/benchmarks/sample.webp' }]).success,
    true,
  );
  for (const preview of [
    'https://example.com/image.webp',
    '/benchmarks/other.webp',
    '/benchmarks/../sample.webp',
  ])
    assert.equal(experimentsSchema.safeParse([{ ...benchmark, preview }]).success, false);
  for (const entry of ['../index.html', '/index.html', 'a/../../index.html', 'a//index.html'])
    assert.equal(experimentsSchema.safeParse([{ ...benchmark, entry }]).success, false);
  assert.equal(experimentsSchema.safeParse([benchmark, benchmark]).success, false);
  assert.equal(
    experimentsSchema.safeParse([{ ...benchmark, directory: 'examples/private' }]).success,
    false,
  );
  assert.equal(
    experimentsSchema.safeParse([
      { ...benchmark, author: { name: 'X', sourceUrl: 'https://user:secret@example.com' } },
    ]).success,
    false,
  );
});

test('benchmark packaging preserves bytes and JS module trees, excludes private files and symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'benchmark-packaging-'));
  const base = join(root, benchmark.directory);
  try {
    await mkdir(join(base, 'assets'), { recursive: true });
    await mkdir(join(root, 'src/data'), { recursive: true });
    await writeFile(join(root, 'src/data/experiments.json'), JSON.stringify([benchmark]));
    const raw =
      '<!doctype html>\r\n<script type="module" src="assets/main.js"></script>\r\n__SITE_RETURN__\r\n';
    await writeFile(join(base, 'index.html'), raw);
    const archive = Buffer.from(
      'UEsDBBQAAAAAABoVLl1usc1UDwAAAA8AAAAKAAAAaW5kZXguaHRtbDxwPk9yaWdpbmFsPC9wPlBLAQIUAxQAAAAAABoVLl1usc1UDwAAAA8AAAAKAAAAAAAAAAAAAACAAQAAAABpbmRleC5odG1sUEsFBgAAAAABAAEAOAAAADcAAAAAAA==',
      'base64',
    );
    await writeFile(join(base, 'source.zip'), archive);
    await writeFile(join(base, 'assets/main.js'), "import './nested.mjs';\n");
    await writeFile(join(base, 'assets/nested.mjs'), 'export const untouched = true;\n');
    const model = Buffer.from('676c54460200000014000000000000004a534f4e', 'hex');
    await writeFile(join(base, 'assets/boat.glb'), model);
    const sourceMap = '{"version":3,"sources":["main.js"],"mappings":""}\n';
    await writeFile(join(base, 'assets/main.js.map'), sourceMap);
    // The registered experiment is the only static lab page this build copies.
    for (const experiment of config.experiments)
      await writeFile(
        join(root, experiment.html),
        '<a href="__SITE_RETURN__">Return</a>',
      );
    // Every registered local tool builds from its own source tree, so the fixture
    // provides one minimal page per slug rather than the tools under construction.
    await mkdir(join(root, 'src/tools/shared'), { recursive: true });
    await writeFile(join(root, 'src/tools/shared/style.css'), 'body { color: black }');
    for (const tool of config.tools) {
      await mkdir(join(root, 'src/tools', tool.slug), { recursive: true });
      await writeFile(
        join(root, 'src/tools', tool.slug, 'index.html'),
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
          `<title>${tool.name}</title></head><body data-tool="${tool.slug}">` +
          '<a class="back-link" href="__SITE_RETURN__">Return</a>' +
          '<script type="module" src="./main.ts"></script></body></html>',
      );
      await writeFile(
        join(root, 'src/tools', tool.slug, 'main.ts'),
        `document.body.dataset.tool = ${JSON.stringify(tool.slug)};\n`,
      );
    }
    const run = spawnSync(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), resolve('scripts/build-lab.ts')],
      {
        cwd: root,
        env: {
          ...process.env,
          SITE_URL: 'http://localhost:8080',
          LAB_ORIGIN: 'http://localhost:8081',
          LAB_PAPER_URL: '',
          ...Object.fromEntries(config.tools.map((tool) => [tool.urlEnv, ''])),
        },
        encoding: 'utf8',
      },
    );
    assert.equal(run.status, 0, run.stderr);
    assert.equal(await readFile(join(root, 'lab-dist/benchmarks/sample/index.html'), 'utf8'), raw);
    assert.equal(
      await readFile(join(root, 'lab-dist/benchmark-sources/sample/index.html.txt'), 'utf8'),
      raw,
    );
    assert.equal(
      await readFile(join(root, 'lab-dist/benchmarks/sample/assets/nested.mjs'), 'utf8'),
      'export const untouched = true;\n',
    );
    const files = JSON.parse(
      await readFile(join(root, 'lab-dist/benchmark-sources/sample/files.json'), 'utf8'),
    );
    assert.equal(files.length, 6);
    for (const path of [
      'lab-dist/benchmarks/sample/assets/main.js.map',
      'lab-dist/benchmark-sources/sample/assets/main.js.map.txt',
    ]) {
      assert.equal(await readFile(join(root, path), 'utf8'), sourceMap);
    }
    assert.deepEqual(
      await readFile(join(root, 'lab-dist/benchmarks/sample/assets/boat.glb')),
      model,
    );
    assert.deepEqual(
      await readFile(join(root, 'lab-dist/benchmark-sources/sample/assets/boat.glb.txt')),
      model,
    );
    assert.deepEqual(await readFile(join(root, 'lab-dist/benchmarks/sample/source.zip')), archive);
    assert.deepEqual(
      await readFile(join(root, 'lab-dist/benchmark-sources/sample/source.zip')),
      archive,
    );
    await assert.rejects(readFile(join(root, 'lab-dist/benchmark-sources/sample/source.zip.txt')));
    assert.equal(
      files.find((file: { path: string }) => file.path === 'index.html').bytes,
      Buffer.byteLength(raw),
    );
    assert.match(
      await readFile(join(root, 'lab-dist/experiments/paper/index.html'), 'utf8'),
      /http:\/\/localhost:8080\/lab\//,
    );
    for (const name of ['.env', 'credentials.json', 'private.pem', 'other.zip']) {
      await writeFile(join(base, name), 'must not publish');
      await assert.rejects(experimentFiles(benchmark, root), /Private|Unsupported|Only/);
      await rm(join(base, name));
    }
    await writeFile(join(base, 'source.zip'), 'not a zip');
    await assert.rejects(experimentFiles(benchmark, root), /Invalid source ZIP/);
    await writeFile(join(base, 'source.zip'), archive);
    await symlink(join(base, 'index.html'), join(base, 'alias.html'));
    await assert.rejects(experimentFiles(benchmark, root), /symlinks/);
    await rm(join(base, 'alias.html'));
    await rm(join(base, 'assets'), { recursive: true });
    await symlink(root, join(base, 'assets'));
    await assert.rejects(experimentFiles(benchmark, root), /symlinks/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('prompt copying preserves line endings and falls back to selectable text when denied', async () => {
  const { transpile } = await import('typescript');
  const page = await readFile(resolve('src/pages/lab/[slug].astro'), 'utf8');
  const script = page.match(/<script>([\s\S]*?)<\/script>/)![1];
  const status = { textContent: '' };
  let focused = false;
  const section = {
    querySelector: (selector: string) => {
      if (selector === '.benchmark-copy-status') return status;
      if (selector === '[data-prompt-source]')
        return { textContent: JSON.stringify(benchmark.prompt) };
      return {
        focus: () => {
          focused = true;
        },
      };
    },
  };
  const event = { target: { closest: () => ({ closest: () => section }) } };
  let listener: (event: unknown) => Promise<void> = async () => {};
  let registrations = 0;
  const document = {
    addEventListener: (_name: string, callback: typeof listener) => {
      listener = callback;
      registrations++;
    },
  };
  let copied = '';
  let denied = false;
  const navigator = {
    clipboard: {
      writeText: async (text: string) => {
        if (denied) throw new Error('Permission denied');
        copied = text;
      },
    },
  };
  new Function('document', 'navigator', transpile(script))(document, navigator);
  await listener(event);
  assert.equal(copied, benchmark.prompt);
  assert.equal(status.textContent, '提示词已复制。');
  denied = true;
  await listener(event);
  assert.match(status.textContent, /手动复制/);
  assert.equal(focused, true);
  assert.equal(registrations, 1);
});
