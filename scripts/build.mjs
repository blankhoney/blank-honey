import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
try {
  try {
    process.loadEnvFile('.env');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const [command, args] of [
    [process.execPath, ['--import', 'tsx', 'scripts/build-radio.ts']],
    [process.execPath, ['--import', 'tsx', 'scripts/build-lab.ts']],
    ['npm', ['run', 'build:site']],
    [
      'npx',
      [
        'pagefind',
        '--site',
        'dist',
        '--force-language',
        'zh-CN',
        '--root-selector',
        '[data-pagefind-body]',
      ],
    ],
    [process.execPath, ['--import', 'tsx', 'scripts/pictures.ts']],
  ]) {
    if (command === 'npx' && !existsSync('dist/blog')) continue;
    const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
    if (result.error || result.status !== 0)
      throw new Error(
        `${args.at(-1)} failed: ${result.error?.message || result.signal || result.status}`,
      );
  }
} catch (error) {
  mkdirSync('logs', { recursive: true });
  appendFileSync(
    'logs/build.jsonl',
    JSON.stringify({ time: new Date().toISOString(), kind: 'build', message: String(error) }) +
      '\n',
  );
  console.error(error.message);
  process.exitCode = 1;
}
