import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPublicTree } from '../scripts/check-public-tree.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The five reviewed runtime binaries, in the order the guard pins them. */
const pinnedRuntimeAssets = [
  'public/vendor/blackhole/deflection.dat',
  'public/vendor/blackhole/inverse_radius.dat',
  'public/vendor/blackhole/doppler.dat',
  'public/vendor/blackhole/black_body.dat',
  'public/vendor/blackhole/noise_texture.png',
];

const vendoredAssetsPresent = pinnedRuntimeAssets.every((asset) =>
  existsSync(join(repositoryRoot, asset)),
);

function fixture(
  run: (root: string, files: string[], put: (name: string, value: string | Buffer) => void) => void,
) {
  const root = mkdtempSync(join(tmpdir(), 'public-tree-'));
  const files: string[] = [];
  const put = (name: string, value: string | Buffer) => {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), value);
    if (!files.includes(name)) files.push(name);
  };
  try {
    for (const name of [
      'src/data/experiments.json',
      'src/data/relations.json',
      'deploy/hosts.json',
    ])
      put(name, '[]');
    put('src/data/places.json', '{"type":"FeatureCollection","features":[]}');
    put(
      'src/config.ts',
      "export const config = { name: 'YOUR NAME', githubUrl: '', githubSourceUrl: '', sayings: [],\n  radio: [\n    { url: '' },\n  ],\n};",
    );
    put(
      'deploy/otel.yaml',
      JSON.stringify({
        receivers: {
          prometheus: {
            config: { scrape_configs: [{ static_configs: [{ targets: ['node-exporter:9100'] }] }] },
          },
        },
      }),
    );
    put(
      '.github/workflows/ci.yml',
      JSON.stringify({
        jobs: { check: { steps: [{ run: 'node scripts/check-public-tree.mjs' }] } },
      }),
    );
    run(root, files, put);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('public tree accepts neutral configuration and empty personal data', () => {
  fixture((root, files) => assert.deepEqual(auditPublicTree(root, files).failures, []));
});

test('public tree rejects private content, deployment configuration and nonempty records', () => {
  fixture((root, files, put) => {
    put('src/content/blog/example.md', 'Personal content');
    put('deploy/production.compose.yaml', 'services: {}');
    put('src/data/experiments.json', '[{"slug":"personal"}]');
    const failures = auditPublicTree(root, files).failures;
    assert.ok(failures.some((f) => f.rule === 'private-path'));
    assert.ok(failures.some((f) => f.rule === 'production-config'));
    assert.ok(failures.some((f) => f.rule === 'nonempty-personal-data'));
  });
});

test('public tree reports rules without exposing secret values and rejects unknown binaries', () => {
  fixture((root, files, put) => {
    const secret = ['ghp', '_', 'a'.repeat(36)].join('');
    put('src/accidental.txt', secret);
    put('public/unknown.bin', Buffer.from([0xff, 0x00, 0xab]));
    const result = auditPublicTree(root, files);
    assert.ok(result.failures.some((f) => f.rule === 'credential-token'));
    assert.ok(result.failures.some((f) => f.rule === 'unreviewed-binary'));
    assert.ok(!JSON.stringify(result).includes(secret));
  });
});

test('public tree rejects symlinks and traversal before reading files', () => {
  fixture((root, files) => {
    symlinkSync(join(root, 'src/config.ts'), join(root, 'src/alias.ts'));
    const failures = auditPublicTree(root, [...files, 'src/alias.ts', '../outside.txt']).failures;
    assert.ok(failures.some((f) => f.rule === 'missing-or-unsafe-file'));
    assert.ok(failures.some((f) => f.rule === 'unsafe-path'));
  });
});

test(
  'public tree accepts the five pinned runtime assets',
  { skip: vendoredAssetsPresent ? false : 'runtime assets are vendored during the overlay stage' },
  () => {
    fixture((root, files, put) => {
      for (const asset of pinnedRuntimeAssets) {
        const bytes = readFileSync(join(repositoryRoot, asset));
        mkdirSync(dirname(join(root, asset)), { recursive: true });
        writeFileSync(join(root, asset), bytes);
        files.push(asset);
      }
      const manifest = readFileSync(
        join(repositoryRoot, 'src/client/vendor/blackhole/manifest.json'),
        'utf8',
      );
      put('src/client/vendor/blackhole/manifest.json', manifest);
      assert.deepEqual(auditPublicTree(root, files).failures, []);
    });
  },
);

test('public tree rejects any byte change to a pinned runtime asset', () => {
  fixture((root, files, put) => {
    for (const asset of pinnedRuntimeAssets) put(asset, Buffer.from([0x01, 0x02, 0x03, 0x04]));
    const failures = auditPublicTree(root, files).failures;
    for (const asset of pinnedRuntimeAssets)
      assert.ok(
        failures.some((f) => f.file === asset && f.rule === 'runtime-asset-changed'),
        `${asset} must be rejected when its bytes change`,
      );
  });
});

test('public tree rejects an unknown binary next to the reviewed assets', () => {
  fixture((root, files, put) => {
    put('public/vendor/blackhole/extra_table.dat', Buffer.from([0xff, 0x00, 0xab]));
    const failures = auditPublicTree(root, files).failures;
    assert.ok(
      failures.some(
        (f) => f.file === 'public/vendor/blackhole/extra_table.dat' && f.rule === 'unreviewed-binary',
      ),
    );
  });
});

test('public tree rejects a nonempty githubSourceUrl', () => {
  fixture((root, files, put) => {
    put(
      'src/config.ts',
      "export const config = { name: 'YOUR NAME', githubUrl: '', githubSourceUrl: 'https://github.com/example/example', sayings: [],\n  radio: [\n    { url: '' },\n  ],\n};",
    );
    const failures = auditPublicTree(root, files).failures;
    assert.ok(failures.some((f) => f.rule === 'personal-identity-config'));
  });
});
