import { mkdir, readFile, realpath, rm, writeFile, copyFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { config } from '../src/config';
import { httpUrl } from './build-radio';
const root = await realpath('.');
const output = resolve('lab-dist');
const site = new URL(httpUrl(process.env.SITE_URL || 'http://localhost:8080'));
const origin = new URL(httpUrl(process.env.LAB_ORIGIN || 'http://localhost:8081'));
if (site.origin === origin.origin) throw new Error('Lab must use a separate origin');
function inside(base: string, path: string) {
  const rel = relative(base, path);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep);
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const kind of ['tools', 'experiments'] as const) {
  const slugs = new Set<string>();
  for (const item of config[kind]) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || slugs.has(item.slug))
      throw new Error('Invalid or duplicate lab slug');
    slugs.add(item.slug);
    if (process.env[item.urlEnv]) {
      if (new URL(httpUrl(process.env[item.urlEnv]!)).origin === site.origin)
        throw new Error('Tool destination must use a separate origin');
      continue;
    }
    const source = await realpath(resolve(item.html));
    if (!inside(root, source)) throw new Error('HTML outside project');
    const base = dirname(source),
      target = resolve(output, kind, item.slug);
    const seen = new Set<string>();
    // ponytail: follows static HTML/CSS references; bundle JavaScript module trees before registering HTML.
    async function copy(file: string, destination: string) {
      file = await realpath(file);
      if (!inside(base, file) || !inside(target, destination))
        throw new Error('Asset path escapes HTML directory');
      if (seen.has(file)) return;
      seen.add(file);
      await mkdir(dirname(destination), { recursive: true });
      if (!/\.(html?|css)$/i.test(file)) {
        await copyFile(file, destination);
        return;
      }
      let text = await readFile(file, 'utf8');
      for (const match of text.matchAll(
        /(?:\b(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^)'"\s]+)["']?\s*\))/gi,
      )) {
        const value = match[1] || match[2];
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#|__SITE_)/i.test(value)) continue;
        const asset = decodeURIComponent(value.split(/[?#]/)[0]);
        if (!asset) continue;
        if (asset.startsWith('/')) throw new Error('Use relative paths for local lab assets');
        await copy(resolve(dirname(file), asset), resolve(dirname(destination), asset));
      }
      text = text.replaceAll(
        '__SITE_RETURN__',
        new URL(kind === 'tools' ? '/tools/' : '/lab/', site).href
          .replaceAll('&', '&amp;')
          .replaceAll('"', '&quot;'),
      );
      await writeFile(destination, text);
    }
    await copy(source, resolve(target, 'index.html'));
  }
}
