import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
export async function pictures(directory = 'dist/blog', output = 'dist') {
  const cache = new Map<string, string>();
  async function sources(source: string) {
    if (cache.has(source)) return cache.get(source)!;
    const file = resolve(output, source.slice(1));
    const { width } = await sharp(file).metadata();
    if (!width) throw new Error('Image width missing');
    const widths = [...new Set([Math.min(480, width), width])];
    const tags: string[] = [];
    for (const format of ['avif', 'webp'] as const) {
      const variants: string[] = [];
      for (const size of widths) {
        const suffix = `.${size}.${format}`;
        await sharp(file)
          .resize({ width: size, withoutEnlargement: true })
          .toFormat(format, { quality: format === 'avif' ? 55 : 80 })
          .toFile(file + suffix);
        variants.push(`${source}${suffix} ${size}w`);
      }
      tags.push(
        `<source type="image/${format}" srcset="${variants.join(', ')}" sizes="(max-width: 700px) calc(100vw - 48px), 690px">`,
      );
    }
    const result = tags.join('');
    cache.set(source, result);
    return result;
  }
  async function visit(folder: string) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = resolve(folder, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;
      let html = await readFile(file, 'utf8');
      const images = [
        ...html.matchAll(
          /<img\b[^>]*\bsrc="(\/_astro\/[a-zA-Z0-9_.-]+\.(?:webp|png|jpe?g))"[^>]*>/g,
        ),
      ];
      for (const match of images)
        html = html.replace(match[0], `<picture>${await sources(match[1])}${match[0]}</picture>`);
      await writeFile(file, html);
    }
  }
  try {
    await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  await visit(directory);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await pictures();
