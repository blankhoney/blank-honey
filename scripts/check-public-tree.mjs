import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const roots = new Set([
  '.gitignore',
  '.github',
  '.prettierrc.json',
  '.prettierignore',
  '.env.example',
  'package.json',
  'package-lock.json',
  'astro.config.mjs',
  'tsconfig.json',
  'src',
  'public',
  'scripts',
  'tests',
  'examples',
  'server',
  'deploy',
  'Dockerfile',
  'compose.yaml',
  '.dockerignore',
  'README.md',
  'LICENSE',
  'docs',
]);
const forbidden =
  /^(?:src\/(?:content\/blog|assets)(?:\/|$)|public\/(?:content-diagrams|benchmarks|images\/hero)(?:\/|$)|examples\/benchmarks(?:\/|$))/;
const deployFiles = new Set([
  'Caddyfile',
  'hosts.json',
  'otel.yaml',
  'prometheus.yaml',
  'README.md',
]);
const runtimeDirectories = new Set(['.git', 'node_modules', '.astro', 'dist', 'lab-dist', 'logs']);
/* Reviewed runtime binaries.  These five runtime binaries are allowed in addition
   to the pinned source archives listed by digest below, and each is pinned here by
   exact byte length and SHA-256.  The values come from the reviewed upstream data
   ref below.  The on-disk manifest is cross-checked against this table but is never
   read as the source of truth, so an added manifest entry cannot admit a new
   binary. */
const runtimeAssetRef = '0a65035fa6ed8557b7bcb1492894c55f555fdae8';
const runtimeAssets = {
  'public/vendor/blackhole/deflection.dat': {
    bytes: 2097160,
    sha256: '1080f45a12fba81321771c2071f4a31795444b110833f61384a9bdf7d057c19d',
  },
  'public/vendor/blackhole/inverse_radius.dat': {
    bytes: 16392,
    sha256: '7fa22a9270e61f2842c97fb1a9398bcb13e1a965ad39b0f73169354a0d608b04',
  },
  'public/vendor/blackhole/doppler.dat': {
    bytes: 1572864,
    sha256: '5174fff7559f82771977f7aadf00bbc071a010fc2913fe9a26d9ecd0f04afe50',
  },
  'public/vendor/blackhole/black_body.dat': {
    bytes: 1536,
    sha256: 'aac8ed78dde66d9b44da8b65142429470c89b5edeb74a8fde8dfc000777a2d97',
  },
  'public/vendor/blackhole/noise_texture.png': {
    bytes: 13774,
    sha256: '7ba6d84ad14496b6299b57dbbc75b400fad4e9ab022dcacfc7f3fa3751009ed9',
  },
};

const archiveDigests = {
  'scripts/licenses/7z2409-src.7z':
    'a33569eed0ce628fb9ceb9f46ac257d3f36b3966471667e65ba01878673c9faa',
  'scripts/licenses/7z-wasm-1.2.0-source.tar.gz':
    '0ca44328d043031ad3e2b750d18f94f13126cdbaeacfc8243fefaa331dff487a',
};

function filesIn(root) {
  try {
    const top = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (resolve(top) === root)
      return execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' })
        .split('\0')
        .filter(Boolean);
  } catch {
    /* An isolated export need not have Git metadata. */
  }
  const files = [];
  function visit(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!prefix && runtimeDirectories.has(entry.name)) continue;
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(join(directory, entry.name), name);
      else files.push(name);
    }
  }
  visit(root);
  return files;
}

export function auditPublicTree(directory, explicitFiles) {
  const root = resolve(directory);
  const files = explicitFiles ?? filesIn(root);
  const failures = [];
  const report = (file, rule) => failures.push({ file, rule });
  for (const file of files) {
    if (file.startsWith('/') || file.split('/').some((part) => part === '..' || !part)) {
      report(file, 'unsafe-path');
      continue;
    }
    if (!roots.has(file.split('/')[0]) || forbidden.test(file)) report(file, 'private-path');
    if (/(?:^|\/)reader-data(?:\/|$)|\.(?:sqlite|db)(?:-[^/]*)?$/i.test(file))
      report(file, 'reader-runtime-data');
    if (file.startsWith('deploy/') && !deployFiles.has(file.slice(7)))
      report(file, 'production-config');
    if (file.startsWith('.github/') && file !== '.github/workflows/ci.yml')
      report(file, 'unexpected-workflow');
    if (file.startsWith('docs/') && file !== 'docs/operations.md') report(file, 'private-record');
    if (file === 'src/content/LICENSE.md' || file === 'scripts/template.mjs')
      report(file, 'legacy-export-content');
    if (
      /(?:^|\/)(?:\.env(?:\..+)?|id_rsa|id_ed25519|credentials\.[^/]+)$/.test(file) &&
      file !== '.env.example'
    )
      report(file, 'credential-file');
    let data;
    try {
      let path = root;
      for (const part of file.split('/')) {
        path = join(path, part);
        if (lstatSync(path).isSymbolicLink()) throw new Error('symlink');
      }
      if (!lstatSync(path).isFile()) throw new Error('not a regular file');
      data = readFileSync(path);
    } catch {
      report(file, 'missing-or-unsafe-file');
      continue;
    }
    if (archiveDigests[file]) {
      if (createHash('sha256').update(data).digest('hex') !== archiveDigests[file])
        report(file, 'third-party-archive-changed');
      continue;
    }
    if (runtimeAssets[file]) {
      const pinned = runtimeAssets[file];
      if (
        data.length !== pinned.bytes ||
        createHash('sha256').update(data).digest('hex') !== pinned.sha256
      )
        report(file, 'runtime-asset-changed');
      continue;
    }
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch {
      report(file, 'unreviewed-binary');
      continue;
    }
    if (data.includes(0)) report(file, 'binary-disguised-as-text');
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{40,}?-----END/.test(text))
      report(file, 'private-key');
    if (
      /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16})\b/.test(text)
    )
      report(file, 'credential-token');
    if (/(?:\/Users|\/home)\/[a-zA-Z0-9_.-]+\//.test(text)) report(file, 'personal-home-path');
    if (file.endsWith('.css') && /url\(['"]?\/images\/hero\//.test(text))
      report(file, 'removed-poster-reference');
  }
  function json(file, expected) {
    try {
      if (
        JSON.stringify(JSON.parse(readFileSync(join(root, file), 'utf8'))) !==
        JSON.stringify(expected)
      )
        report(file, 'nonempty-personal-data');
    } catch {
      report(file, 'invalid-or-missing-data');
    }
  }
  json('src/data/experiments.json', []);
  json('src/data/relations.json', []);
  json('src/data/places.json', { type: 'FeatureCollection', features: [] });
  json('deploy/hosts.json', []);
  try {
    const config = readFileSync(join(root, 'src/config.ts'), 'utf8');
    if (
      !/name: 'YOUR NAME'/.test(config) ||
      !/githubUrl: ''/.test(config) ||
      !/githubSourceUrl: ''/.test(config) ||
      !/sayings: \[\]/.test(config)
    )
      report('src/config.ts', 'personal-identity-config');
    const radio = config.match(/radio: \[([\s\S]*?)\n  \],/);
    if (!radio || [...radio[1].matchAll(/\burl: '([^']*)'/g)].some((match) => match[1] !== ''))
      report('src/config.ts', 'personal-radio-selection');
    let manifestText = null;
    try {
      manifestText = readFileSync(join(root, 'src/client/vendor/blackhole/manifest.json'), 'utf8');
    } catch {
      /* Synthetic fixtures may omit the manifest; the pinned table still applies. */
    }
    if (manifestText !== null) {
      const manifest = JSON.parse(manifestText);
      const runtime = (manifest.entries ?? []).filter((entry) => entry.kind === 'runtime-asset');
      const pinnedPaths = Object.keys(runtimeAssets);
      if (
        manifest.dataRef !== runtimeAssetRef ||
        runtime.length !== pinnedPaths.length ||
        runtime.some(
          (entry) =>
            !runtimeAssets[entry.path] ||
            entry.ref !== runtimeAssetRef ||
            entry.bytes !== runtimeAssets[entry.path].bytes ||
            entry.sha256 !== runtimeAssets[entry.path].sha256,
        )
      )
        report('src/client/vendor/blackhole/manifest.json', 'runtime-asset-manifest-drift');
    }
    const collector = parse(readFileSync(join(root, 'deploy/otel.yaml'), 'utf8'));
    const jobs = collector.receivers.prometheus.config.scrape_configs;
    if (
      jobs.length !== 1 ||
      JSON.stringify(jobs[0].static_configs) !==
        JSON.stringify([{ targets: ['node-exporter:9100'] }])
    )
      report('deploy/otel.yaml', 'remote-monitoring-target');
    const ci = parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8'));
    if (!ci.jobs.check.steps.some((step) => step.run === 'node scripts/check-public-tree.mjs'))
      report('.github/workflows/ci.yml', 'missing-privacy-gate');
  } catch {
    report('configuration', 'invalid-configuration');
  }
  return { checked: files.length, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditPublicTree(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length) process.exitCode = 1;
}
