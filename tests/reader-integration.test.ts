import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { XMLParser } from 'fast-xml-parser';
import { parseFeed } from '../server/reader/feeds.mjs';
import { readHidden, runAdmin } from '../server/reader-admin.mjs';
import { openReaderStore } from '../server/reader/store.mjs';
import { articleSchema, published } from '../src/domain/content';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Atom XHTML preserves mixed text order and spaces, including prefixed feeds', () => {
  for (const prefix of ['', 'a:']) {
    const ns = prefix ? 'xmlns:a' : 'xmlns';
    const xml =
      `<${prefix}feed ${ns}="http://www.w3.org/2005/Atom"><${prefix}entry/>` +
      `<${prefix}entry><${prefix}id>1</${prefix}id><${prefix}content type="xhtml">` +
      '<div xmlns="http://www.w3.org/1999/xhtml"><p>Before <b>middle</b> after.</p></div>' +
      `</${prefix}content></${prefix}entry></${prefix}feed>`;
    const entries = parseFeed(xml, 'https://example.test/feed.xml').entries;
    assert.equal(entries.length, 1);
    assert.equal(
      entries[0].contentHtml,
      '<div xmlns="http://www.w3.org/1999/xhtml"><p>Before <b>middle</b> after.</p></div>',
    );
  }
});

test('RSS xml:base resolves channel and item bases through their actual ancestors', () => {
  const feed = parseFeed(
    '<rss version="2.0" xml:base="/root/"><channel xml:base="section/">' +
      '<title>T</title><link>index.html</link><item xml:base="posts/"><guid>1</guid><link>a.html</link></item>' +
      '</channel></rss>',
    'https://example.test/feed.xml',
  );
  assert.equal(feed.siteUrl, 'https://example.test/root/section/index.html');
  assert.equal(feed.entries[0].url, 'https://example.test/root/section/posts/a.html');
});

test('hidden terminal input restores raw mode and never echoes the entered value', async () => {
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    isRaw: false,
    setRawMode(raw: boolean) {
      this.isRaw = raw;
      return this;
    },
  });
  const output = Object.assign(new PassThrough(), { isTTY: true });
  let displayed = '';
  output.on('data', (chunk) => {
    displayed += chunk.toString();
  });
  const answer = readHidden(
    'Prompt: ',
    input as unknown as typeof process.stdin,
    output as unknown as typeof process.stdout,
  );
  const typed = ['synthetic', '-input', '-value'].join('');
  input.write(`${typed}\r`);
  assert.equal(await answer, typed);
  assert.equal(displayed, 'Prompt: \n');
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('data'), 0);
  input.destroy();
  output.destroy();
});

test('administrator password setup refuses pipes and argv before creating a database', () => {
  const root = mkdtempSync(join(tmpdir(), 'reader-cli-'));
  try {
    const command = new URL('../server/reader-admin.mjs', import.meta.url);
    for (const args of [['password'], ['password', 'not-accepted-as-an-argument']]) {
      const result = spawnSync(process.execPath, [command.pathname, ...args], {
        encoding: 'utf8',
        input: 'not-accepted-from-stdin\n',
        env: { ...process.env, READER_DATA_DIR: root },
      });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.ok(!result.stderr.includes('not-accepted'));
      assert.equal(existsSync(join(root, 'reader.sqlite')), false);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('administrator CLI seeds idempotently without a password and takes an online snapshot', async () => {
  const root = mkdtempSync(join(tmpdir(), 'reader-cli-'));
  const output = new PassThrough();
  let displayed = '';
  output.on('data', (chunk) => {
    displayed += chunk.toString();
  });
  try {
    const options = { dataDir: root, output: output as unknown as typeof process.stdout };
    const args = ['add-source', 'https://example.test/rss.xml', 'Example'];
    await runAdmin(args, options);
    await runAdmin(args, options);
    await runAdmin(['backup', join(root, 'snapshot.sqlite')], options);
    const snapshot = openReaderStore(join(root, 'snapshot.sqlite'));
    try {
      assert.equal(snapshot.listSources().length, 1);
      assert.equal(snapshot.getAdmin(), null);
      assert.equal(snapshot.getSource(snapshot.listSources()[0].id)?.status, 'pending');
    } finally {
      snapshot.close();
    }
    assert.match(displayed, /SOURCE_ADDED/);
    assert.match(displayed, /SOURCE_EXISTS/);
    assert.match(displayed, /BACKUP_COMPLETE/);
    assert.ok(!displayed.includes('https://'));
  } finally {
    output.destroy();
    rmSync(root, { recursive: true, force: true });
  }
});

test('database symlinks and existing backup companion files are refused without changing them', async () => {
  const root = mkdtempSync(join(tmpdir(), 'reader-paths-'));
  const store = openReaderStore(join(root, 'reader.sqlite'));
  try {
    symlinkSync(join(root, 'reader.sqlite'), join(root, 'alias.sqlite'));
    assert.throws(() => openReaderStore(join(root, 'alias.sqlite')), { code: 'STORE_INVALID' });
    const backup = join(root, 'unfinished.sqlite');
    writeFileSync(`${backup}-wal`, 'existing companion');
    await assert.rejects(store.backupTo(backup), { code: 'BACKUP_EXISTS' });
    assert.equal(existsSync(backup), false);
    assert.equal(readFileSync(`${backup}-wal`, 'utf8'), 'existing companion');
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('the actual RSS endpoint projects published originals with absolute links and escaped text', async () => {
  const data = (title: string, date: string, draft = false) =>
    articleSchema.parse({
      title,
      description: 'Text & <markup>',
      date,
      draft,
      category: 'engineering',
    });
  const articles = published([
    { id: 'draft', data: data('Draft', '2026-09-23', true) },
    { id: 'b', data: data('B', '2026-09-22') },
    { id: 'a', data: data('A & <B>', '2026-09-22') },
  ]);
  let endpoint = source('src/pages/rss.xml.ts');
  const replacements = new Map([
    [
      "import rss from '@astrojs/rss';",
      `import rss from ${JSON.stringify(import.meta.resolve('@astrojs/rss'))};`,
    ],
    [
      "import { content } from '../application/content';",
      `const content = async () => ({articles: JSON.parse(${JSON.stringify(JSON.stringify(articles))}, (key, value) => key === 'date' ? new Date(value) : value)});`,
    ],
    [
      "import { config } from '../config';",
      "const config = {name: 'Example', description: 'Original articles'};",
    ],
    [
      "import { siteUrl } from '../application/destinations';",
      "const siteUrl = 'https://example.test';",
    ],
  ]);
  // Replace only framework/config imports; execute the endpoint's real projection and RSS library.
  for (const [from, to] of replacements) {
    assert.equal(endpoint.split(from).length, 2);
    endpoint = endpoint.replace(from, to);
  }
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(endpoint).toString('base64')}`
  );
  const response = await module.GET();
  assert.equal(response.status, 200);
  const xml = await response.text();
  const channel = new XMLParser({ parseTagValue: false }).parse(xml).rss.channel;
  assert.equal(channel.language, 'zh-CN');
  assert.deepEqual(
    channel.item.map((item: { link: string }) => item.link),
    ['https://example.test/blog/a/', 'https://example.test/blog/b/'],
  );
  assert.equal(channel.item[0].title, 'A & <B>');
  assert.equal(channel.item[0].description, 'Text & <markup>');
  assert.equal(Date.parse(channel.item[0].pubDate), Date.parse('2026-09-22'));
  assert.ok(!xml.includes('/reader/'));
  assert.match(source('src/application/content.ts'), /articles = published\(entries\)/);
});

test('reader persistence and proxy rules are scoped to the worker and main site', () => {
  const docker = source('Dockerfile');
  assert.match(docker, /npm ci --omit=dev --ignore-scripts/);
  assert.match(docker, /COPY --chown=node:node server \.\/server/);
  assert.match(docker, /chmod 700 \/data\/reader/);
  assert.match(source('compose.yaml'), /reader-data:\/data\/reader/);
  assert.match(source('deploy/Caddyfile').split(':8081')[0], /\/api\/reader\/\*/);
  assert.doesNotMatch(source('deploy/Caddyfile').split(':8081')[1], /reverse_proxy|\/api\/reader/);
  for (const path of ['.gitignore', '.dockerignore']) {
    assert.ok(source(path).includes('*.sqlite'));
    assert.ok(source(path).includes('reader-data'));
  }
});
