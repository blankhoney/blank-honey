import { copyFile, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { build } from 'vite';
import { config } from '../src/config';
import { httpUrl } from './build-radio';

export type ToolEntry = { readonly slug: string; readonly html: string; readonly urlEnv: string };
const packages = await realpath(resolve(import.meta.dirname, '../node_modules'));
const placeholder = '__SITE_RETURN__';
const runtimePackages = ['7z-wasm', 'cropperjs', 'markdown-it', 'dompurify', 'lunar-typescript'];

function inside(base: string, file: string) {
  const path = relative(base, file);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function sourceBoundary(tools: string) {
  return {
    name: 'tool-source-boundary',
    enforce: 'pre' as const,
    async load(id: string) {
      const file = id.split('?')[0];
      if (!isAbsolute(file)) return null;
      const actual = await realpath(file).catch(() => null);
      if (!actual) return null;
      if (!inside(tools, actual) && !inside(packages, actual))
        throw new Error(`Tool import outside tools and installed dependencies: ${file}`);
      if (
        inside(tools, actual) &&
        relative(tools, actual)
          .split(sep)
          .some((part) => part.startsWith('.'))
      )
        throw new Error('Hidden files cannot be tool assets');
      return null;
    },
  };
}

function escapeHtml(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
}

function returnLink(html: string, site: URL) {
  for (const raw of html.matchAll(/<(script|style|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi))
    if (raw[0].includes(placeholder))
      throw new Error('Return placeholder belongs in an anchor href');
  let count = 0;
  const url = escapeHtml(new URL('/tools/', site).href);
  const result = html.replace(/<a\b[^>]*>/gi, (anchor) =>
    anchor.replace(/\bhref\s*=\s*(["'])__SITE_RETURN__\1/gi, () => {
      count++;
      return `href="${url}"`;
    }),
  );
  if (count !== 1 || result.includes(placeholder))
    throw new Error('A tool needs exactly one __SITE_RETURN__ anchor href, nowhere else');
  return result;
}

export async function buildTools({
  root,
  output,
  site,
  entries = config.tools,
}: {
  root: string;
  output: string;
  site: URL;
  entries?: readonly ToolEntry[];
}) {
  root = await realpath(root);
  const tools = await realpath(join(root, 'src/tools'));
  const target = join(await realpath(dirname(resolve(output))), basename(output), 'tools');
  if (!inside(root, target) || inside(join(root, 'src'), target))
    throw new Error('Tool output must be inside the project and outside source directories');
  const slugs = new Set<string>();
  const sources = new Set<string>();
  const local: { slug: string; file: string; path: string }[] = [];
  for (const entry of entries) {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) ||
      ['assets', 'vendor', 'licenses', 'shared'].includes(entry.slug) ||
      slugs.has(entry.slug)
    )
      throw new Error(`Invalid or duplicate tool slug: ${entry.slug}`);
    slugs.add(entry.slug);
    const override = process.env[entry.urlEnv]?.trim();
    if (override) {
      if (new URL(httpUrl(override)).origin === site.origin)
        throw new Error('Tool destination must use a separate origin');
      continue;
    }
    const file = await realpath(resolve(root, entry.html));
    const path = relative(tools, file).split(sep).join('/');
    // One directory level keeps relative asset URLs valid when mapped to a published slug.
    if (!inside(tools, file) || !/^[^/.][^/]*\/[^/]+\.html$/.test(path) || sources.has(file))
      throw new Error(`Tool HTML must be a unique direct child of a tool directory: ${entry.html}`);
    sources.add(file);
    local.push({ slug: entry.slug, file, path });
  }
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  if (local.length) {
    await build({
      root: tools,
      base: './',
      configFile: false,
      publicDir: false,
      envDir: false,
      envPrefix: [],
      logLevel: 'warn',
      worker: { format: 'es', plugins: () => [sourceBoundary(tools)] },
      build: {
        outDir: target,
        emptyOutDir: false,
        copyPublicDir: false,
        rollupOptions: {
          input: Object.fromEntries(local.map((entry) => [entry.slug, entry.file])),
        },
      },
      plugins: [
        sourceBoundary(tools),
        {
          name: 'tool-return-link',
          transformIndexHtml: {
            order: 'pre',
            handler: (html) => returnLink(html, site),
          },
          generateBundle(_options, bundle) {
            for (const artifact of Object.values(bundle)) {
              const text = artifact.type === 'chunk' ? artifact.code : String(artifact.source);
              if (text.includes(placeholder)) throw new Error('Unresolved tool return placeholder');
            }
          },
        },
      ],
    });
    // Read every page before moving any, so swapped source/slug mappings cannot collide.
    const pages = await Promise.all(
      local.map(async (entry) => ({
        ...entry,
        html: await readFile(join(target, entry.path), 'utf8'),
      })),
    );
    for (const page of pages) await rm(join(target, page.path));
    for (const page of pages) {
      await mkdir(join(target, page.slug), { recursive: true });
      await writeFile(join(target, page.slug, 'index.html'), page.html);
    }
    const hasArchive = local.some((entry) => entry.slug === 'archive');
    if (hasArchive) await vendorEngine(target);
    await emitLicenses(target, hasArchive);
  }
}

async function vendorEngine(target: string) {
  const source = join(packages, '7z-wasm');
  const destination = join(target, 'vendor/7z');
  const metadata = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  if (metadata.version !== '1.2.0')
    throw new Error('Review engine source provenance before upgrading');
  await mkdir(destination, { recursive: true });
  for (const file of ['7zz.es6.js', '7zz.wasm', 'License.txt', 'unRarLicense.txt', 'README.md'])
    await copyFile(join(source, file), join(destination, file));
  for (const file of ['LGPL-2.1.txt', '7z2409-src.7z', '7z-wasm-1.2.0-source.tar.gz'])
    await copyFile(join(import.meta.dirname, 'licenses', file), join(destination, file));
  await copyFile(
    join(import.meta.dirname, 'licenses/7z-SOURCE.md'),
    join(destination, 'SOURCE.md'),
  );
}

async function packageDirectory(name: string, from: string): Promise<string> {
  const require = createRequire(from);
  try {
    return dirname(require.resolve(`${name}/package.json`));
  } catch {
    let directory = dirname(require.resolve(name));
    while (directory !== dirname(directory)) {
      const metadata = await readFile(join(directory, 'package.json'), 'utf8').catch(() => '');
      if (metadata && JSON.parse(metadata).name === name) return directory;
      directory = dirname(directory);
    }
    throw new Error(`Cannot locate license metadata for ${name}`);
  }
}

async function emitLicenses(target: string, hasArchive: boolean) {
  const destination = join(target, 'licenses');
  await mkdir(destination, { recursive: true });
  const seen = new Set<string>();
  const rows: string[] = [];
  async function copyPackage(name: string, from: string) {
    const directory = await packageDirectory(name, from);
    const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    const key = `${metadata.name}@${metadata.version}`;
    if (seen.has(key)) return;
    seen.add(key);
    const folder = key.replaceAll('/', '_').replaceAll('@', '_');
    const files = (await readdir(directory)).filter((file) =>
      /^(?:licen[cs]e|copying|notice)(?:$|[._-])/i.test(file),
    );
    if (!files.length) throw new Error(`Missing license text: ${key}`);
    await mkdir(join(destination, folder), { recursive: true });
    for (const file of files)
      await copyFile(join(directory, file), join(destination, folder, file));
    rows.push(
      `<li>${escapeHtml(key)} — ${escapeHtml(String(metadata.license ?? 'see license'))}: ${files.map((file) => `<a href="./${folder}/${encodeURIComponent(file)}">${escapeHtml(file)}</a>`).join(' · ')}</li>`,
    );
    for (const dependency of Object.keys(metadata.dependencies ?? {}))
      await copyPackage(dependency, join(directory, 'package.json'));
  }
  for (const name of runtimePackages) await copyPackage(name, import.meta.url);
  const engine = hasArchive
    ? '<p>7-Zip WASM 使用 LGPL 2.1 或更新版并附 unRAR 限制，不是 MIT。<a href="../vendor/7z/SOURCE.md">对应源码与构建来源</a> · <a href="../vendor/7z/LGPL-2.1.txt">完整 LGPL 2.1</a>。引擎 JS/WASM 为可单独替换的未修改文件。</p>'
    : '';
  await writeFile(
    join(destination, 'index.html'),
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>工具依赖与许可</title><h1>工具依赖与许可</h1><p>以下第三方代码遵循各自许可，不被重新标记为本项目许可。列出工具族的运行时依赖及其依赖，许可证原文随构建复制。</p><ul>${rows.join('\n')}</ul>${engine}</html>\n`,
  );
}
