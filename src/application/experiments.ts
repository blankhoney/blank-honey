import { lstat, readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { experimentsSchema, type Experiment } from '../domain/experiments';

export async function experiments(root = process.cwd()) {
  let json: string;
  try {
    json = await readFile(join(root, 'src/data/experiments.json'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return experimentsSchema.parse(JSON.parse(json));
}

const extensions = new Set([
  '.html',
  '.css',
  '.js',
  '.mjs',
  '.json',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.glb',
  '.map',
  '.txt',
  '.zip',
]);
export async function experimentFiles(item: Experiment, root = process.cwd()) {
  const base = resolve(root, item.directory);
  let directory = resolve(root);
  // Reject symlinks even when they currently resolve inside the tree: no hidden publishing aliases.
  for (const part of item.directory.split('/')) {
    directory = join(directory, part);
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Unsafe benchmark directory');
  }
  const files: { path: string; bytes: number }[] = [];
  async function visit(relative = '') {
    for (const name of (await readdir(join(base, relative))).sort()) {
      if (
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) ||
        /^(?:secrets?|credentials?|passwords?|id_rsa|id_ed25519)(?:[._-]|$)/i.test(name)
      )
        throw new Error('Private or unsupported benchmark filename');
      const path = relative ? `${relative}/${name}` : name;
      const info = await lstat(join(base, path));
      if (info.isSymbolicLink()) throw new Error('Benchmark symlinks are not publishable');
      if (info.isDirectory()) await visit(path);
      else if (info.isFile() && extensions.has(extname(name).toLowerCase())) {
        if (extname(name).toLowerCase() === '.zip') {
          if (path !== 'source.zip')
            throw new Error('Only the original source.zip archive is allowed');
          const archive = await readFile(join(base, path));
          if (archive.length < 22 || archive.readUInt32LE(0) !== 0x04034b50)
            throw new Error('Invalid source ZIP archive');
        }
        files.push({ path, bytes: info.size });
      } else throw new Error('Unsupported benchmark file');
    }
  }
  await visit();
  if (!item.entry.endsWith('.html') || !files.some((file) => file.path === item.entry))
    throw new Error('Missing benchmark HTML entry');
  return files;
}
