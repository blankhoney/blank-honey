import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { auditPublicTree } from '../scripts/check-public-tree.mjs';

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
      "export const config = { name: 'YOUR NAME', githubUrl: '', sayings: [],\n  radio: [\n    { url: '' },\n  ],\n};",
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
