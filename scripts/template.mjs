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
  const deploymentFiles = new Set([
    'Caddyfile',
    'hosts.json',
    'otel.yaml',
    'prometheus.yaml',
    'backup.sh',
    'README.md',
  ]);
  for (const item of readdirSync(join(directory, 'deploy')))
    if (!deploymentFiles.has(item))
      rmSync(join(directory, 'deploy', item), { recursive: true, force: true });
  for (const item of readdirSync(join(directory, 'docs')))
    if (item !== 'operations.md')
      rmSync(join(directory, 'docs', item), { recursive: true, force: true });
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
        text = text
          .replace(/demoContent: true/, 'demoContent: false')
          .replace(/githubUrl: '[^']*'/, "githubUrl: ''");
      writeFileSync(file, text);
    }
  }
  neutralize(directory);
  writeFileSync(
    join(directory, 'README.md'),
    `# Your Name

这是空白个人博客模板，保留 Astro 静态页面、Pagefind 搜索、独立工具站和只读探针架构。
文章、照片、地点、关系、电台、主机清单和原站部署记录均已移除。模板不代表你的环境已通过验收。

## 开始使用

使用 Node.js 24 LTS 和 Docker，运行以下命令：

\`\`\`sh
npm ci
cp .env.example .env
npm run check
npm test
npm run build
npm run docker:up
\`\`\`

主站为 http://localhost:8080，工具站为 http://localhost:8081。
Docker 默认读取 .env.example；使用自己的构建配置时运行 \`BUILD_ENV_FILE=.env docker compose up -d --build\`。
运行 \`npm run docker:down\` 停止服务。

## 配置内容

- 在 \`src/config.ts\` 设置名称、介绍、GitHub 链接、分类、工具和实验。
- 创建 \`src/content/blog/*.md\`，Frontmatter 包含 title、description、date、category，可选 slug、tags、draft、places。
- 文章图片放在 \`src/assets/\`，地点和明确的文章关系配置在 \`src/data/\`。
- 在 .env 配置真实域名、电台、Giscus 和外部工具；不得提交密钥。
- 工具或实验记录的 html 指向本地 HTML，资源使用相对路径；修改后重新构建。

CI 保留安装、检查、测试和构建步骤。模板没有生产自动部署工作流，生产配置与验收由使用者完成。
操作说明见 [docs/operations.md](docs/operations.md) 和 [deploy/README.md](deploy/README.md)。
代码使用 MIT；自行添加的文章、照片和第三方资源版权另行管理。
`,
  );
  writeFileSync(
    join(directory, 'deploy/README.md'),
    `# 本地运行与部署配置

从仓库根目录运行 \`mkdir -p logs && docker compose up -d --build\`。
主站和工具站分别监听本机 8080、8081 端口；指标服务不公开端口。本模板未预设生产服务器或 TLS 配置。

hosts.json 初始为空。需要探针时，添加 publicId、displayName、regionLabel、timeZone 和内部 instance；
instance 应与 otel.yaml 的采集目标一致。对外展示字段不得包含私人主机地址。

生产环境使用不同的主站和工具域名，通过私有配置覆盖真实主机和采集目标，并自行配置 TLS。
构建配置可通过 \`BUILD_ENV_FILE=.env\` 传入。保留日志目录写权限，禁止公开指标端口或环境文件。

backup.sh 使用 restic；先配置私有仓库与密码文件，再按脚本检查备份目录。
恢复时使用 \`restic restore latest --target /path/to/restore-review\` 写入独立目录，完成检查后再替换运行文件。
模板没有预设定时器、远程部署命令或已通过的备份验收记录。
`,
  );
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
