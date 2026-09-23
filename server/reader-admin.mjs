import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { openReaderStore } from './reader/store.mjs';
import { createPasswordHash, validateNewPassword } from './reader/auth.mjs';
import { validateFeedUrl } from './reader/fetch.mjs';
import { ReaderError } from './reader/model.mjs';

/** Read only from a terminal, never argv, environment variables or an echoed readline prompt. */
export function readHidden(prompt, input = process.stdin, output = process.stdout) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function')
    return Promise.reject(new ReaderError('TTY_REQUIRED'));
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = input.isRaw;
    const cleanup = () => {
      input.off('data', data);
      input.off('error', failed);
      input.off('end', failed);
      input.setRawMode(wasRaw);
      input.pause();
      output.write('\n');
    };
    const failed = () => {
      cleanup();
      value = '';
      reject(new ReaderError('INPUT_CANCELLED'));
    };
    const data = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(value);
          value = '';
          return;
        }
        if (char === '\u0003' || char === '\u0004') {
          failed();
          return;
        }
        if (char === '\u007f' || char === '\b') value = [...value].slice(0, -1).join('');
        else if (char === '\u0015') value = '';
        else if (!/[\x00-\x1f\x7f]/.test(char)) value += char;
        if (Buffer.byteLength(value) > 1024) {
          cleanup();
          value = '';
          reject(new ReaderError('INVALID_PASSWORD'));
          return;
        }
      }
    };
    output.write(prompt);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.on('data', data);
    input.once('error', failed);
    input.once('end', failed);
    input.resume();
  });
}

export async function runAdmin(
  args,
  {
    dataDir = process.env.READER_DATA_DIR || '/data/reader',
    input = process.stdin,
    output = process.stdout,
  } = {},
) {
  const [command, value, title] = args;
  if (
    !['password', 'add-source', 'backup', 'status'].includes(command) ||
    (['password', 'status'].includes(command) && args.length !== 1) ||
    (command === 'backup' && args.length !== 2) ||
    (command === 'add-source' && (args.length < 2 || args.length > 3))
  )
    throw new ReaderError(
      'USAGE: password | add-source <feed-url> [title] | backup <new-file> | status',
    );
  // Refuse a piped password before opening or creating a store.
  if (command === 'password' && (!input.isTTY || !output.isTTY))
    throw new ReaderError('TTY_REQUIRED');
  const store = openReaderStore(join(dataDir, 'reader.sqlite'));
  try {
    if (command === 'password') {
      let password = await readHidden('新管理员密码（至少12个字符，输入不显示）：', input, output);
      validateNewPassword(password);
      let confirmation = await readHidden('再次输入：', input, output);
      if (confirmation !== password) throw new ReaderError('PASSWORD_MISMATCH');
      const hash = await createPasswordHash(password);
      password = '';
      confirmation = '';
      store.setAdminPassword(hash);
      output.write('管理员密码已设置，旧会话已撤销。\n');
    } else if (command === 'add-source') {
      const feedUrl = validateFeedUrl(value).href;
      const existing = store.listSources(true).find((source) => source.feedUrl === feedUrl);
      if (existing) output.write(`SOURCE_EXISTS ${existing.id}\n`);
      else {
        const source = store.addSource({ feedUrl, title }, Date.now());
        output.write(`SOURCE_ADDED ${source.id}\n`);
      }
    } else if (command === 'backup') {
      await store.backupTo(value);
      output.write('BACKUP_COMPLETE\n');
    } else {
      output.write(
        JSON.stringify({
          configured: Boolean(store.getAdmin()),
          sources: store.listSources().length,
        }) + '\n',
      );
    }
  } finally {
    store.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runAdmin(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof ReaderError ? error.code : 'ADMIN_COMMAND_FAILED');
    process.exitCode = 1;
  }
}
