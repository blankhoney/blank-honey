import { mkdir, stat, rename, appendFile } from 'node:fs/promises';
import { join } from 'node:path';

export function validateError(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'code,kind,path'
  )
    return null;
  const { kind, code, path } = value;
  if (
    typeof kind !== 'string' ||
    !/^[a-z-]{1,32}$/.test(kind) ||
    typeof code !== 'string' ||
    !/^[A-Za-z0-9_.-]{1,64}$/.test(code)
  )
    return null;
  if (
    typeof path !== 'string' ||
    path.length > 180 ||
    !/^\/(?:[A-Za-z0-9_./~%-]*)$/.test(path) ||
    path.startsWith('//')
  )
    return null;
  return { kind, code, path };
}

export function createLog(directory, maxBytes = 1024 * 1024) {
  let pending = Promise.resolve();
  return (event) => {
    // ponytail: one serialized writer, use a log daemon only for multiple worker processes.
    const write = pending.then(async () => {
      await mkdir(directory, { recursive: true });
      const file = join(directory, 'site.jsonl');
      let size = 0;
      try {
        size = (await stat(file)).size;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      const line = JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n';
      if (size + Buffer.byteLength(line) > maxBytes)
        await rename(file, file + '.1').catch((error) => {
          if (error.code !== 'ENOENT') throw error;
        });
      await appendFile(file, line, { mode: 0o600 });
    });
    pending = write.catch(() => {});
    return write;
  };
}
