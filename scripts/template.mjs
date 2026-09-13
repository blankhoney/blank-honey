import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain'))
  throw new Error('Commit or stash changes before creating the template');
if (git('branch', '--list', 'template'))
  throw new Error('Template branch already exists; inspect it before replacing it');
const directory = mkdtempSync(join(tmpdir(), 'blank-honey-template-'));
let added = false;
try {
  git('worktree', 'add', '--detach', directory, 'HEAD');
  added = true;
  const run = (...args) =>
    execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
  run('checkout', '--orphan', 'template');
  // Use a root allowlist so new personal folders never enter the template by accident.
  const keep = new Set([
    '.git',
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
    'compose.yml',
    'docker-compose.yml',
    '.dockerignore',
    'README.md',
    'LICENSE',
    'docs',
    'STATE.md',
  ]);
  for (const item of readdirSync(directory))
    if (!keep.has(item)) rmSync(join(directory, item), { recursive: true, force: true });
  for (const item of [
    'src/content/blog',
    'src/assets',
    'docs/reference',
    'docs/acceptance.md',
    '.github/workflows/deploy.yml',
    '.github/README.md',
  ])
    rmSync(join(directory, item), { recursive: true, force: true });
  writeFileSync(
    join(directory, 'src/data/places.json'),
    '{"type":"FeatureCollection","features":[]}\n',
  );
  writeFileSync(join(directory, 'src/data/relations.json'), '[]\n');
  writeFileSync(join(directory, 'src/data/radio.generated.json'), '[]\n');
  if (existsSync(join(directory, 'deploy/hosts.json')))
    writeFileSync(join(directory, 'deploy/hosts.json'), '[]\n');
  function neutralize(path) {
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, item.name);
      if (item.isSymbolicLink()) {
        rmSync(file);
        continue;
      }
      if (item.isDirectory()) {
        if (item.name !== '.git') neutralize(file);
        continue;
      }
      if (!/\.(?:ts|mjs|astro|md|html|json|ya?ml|sh)$/.test(file)) continue;
      let text = readFileSync(file, 'utf8')
        .replaceAll('Blank<em>Honey.</em>', 'Your<em>Name.</em>')
        .replaceAll('Blank <em>Honey.</em>', 'Your <em>Name.</em>')
        .replaceAll('BH /', 'YN /')
        .replaceAll('Blank Honey', 'Your Name')
        .replaceAll('BLANK HONEY', 'YOUR NAME')
        .replaceAll('blank-honey', 'personal-site')
        .replaceAll('blankhoney', 'site-owner');
      if (file.endsWith('src/config.ts'))
        text = text.replace(/demoContent: true/, 'demoContent: false');
      writeFileSync(file, text);
    }
  }
  neutralize(directory);
  writeFileSync(
    join(directory, 'STATE.md'),
    '# 施工状态\n\n- [x] 已创建去个人化模板。\n- [ ] 配置站点信息、内容和部署环境。\n- [ ] 运行检查、测试和 Docker 验收。\n',
  );
  run('add', '-A');
  run('commit', '-m', 'Create neutral site template');
  console.log('Created orphan template branch. Inspect and configure it before publishing.');
} finally {
  if (added) git('worktree', 'remove', '--force', directory);
  else rmSync(directory, { recursive: true, force: true });
}
